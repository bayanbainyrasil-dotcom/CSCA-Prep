import {
  collection,
  doc,
  documentId,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  type DocumentData,
  type Firestore,
  type QueryConstraint,
} from "firebase/firestore";
import { z } from "zod";
import { AttemptSchema, DailyPlanSchema, type Attempt, type SyncEntityType } from "../../domain";
import {
  parseRemoteSyncEnvelope,
  type RemotePullResult,
  type RemoteSyncAdapter,
  type RemoteSyncEnvelope,
} from "./contracts";

const COLLECTION_BY_TYPE: Record<Exclude<SyncEntityType, "profile">, string> = {
  attempt: "attempts",
  mistake: "mistakes",
  mastery: "topicMastery",
  "daily-plan": "dailyPlans",
  "mock-attempt": "examAttempts",
  "vocabulary-progress": "vocabularyProgress",
  "formula-progress": "formulaProgress",
  note: "notes",
  bookmark: "bookmarks",
  "study-plan": "studyPlans",
};

const MUTABLE_DELETE_TYPES = new Set<SyncEntityType>(["note", "bookmark"]);
const APPEND_ONLY_TYPES = new Set<SyncEntityType>(["attempt"]);
const CursorSchema = z.record(
  z.string(),
  z
    .object({
      serverUpdatedAt: z.string(),
      entityId: z.string(),
    })
    .strict(),
);
type CollectionCursor = z.infer<typeof CursorSchema>;

function timestampToIso(value: unknown): string | null {
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

function fromDocument(data: DocumentData): RemoteSyncEnvelope {
  const payload = data.payload;
  return parseRemoteSyncEnvelope({
    entityType: data.entityType,
    entityId: data.entityId,
    ownerId: data.ownerId,
    operation: data.operation,
    version: data.version,
    updatedAt: data.updatedAt,
    mutationId: data.mutationId,
    ...(data.operation === "upsert" ? { payload } : {}),
    serverUpdatedAt: timestampToIso(data.serverUpdatedAt),
  });
}

function toDocument(record: RemoteSyncEnvelope): DocumentData {
  return {
    entityType: record.entityType,
    entityId: record.entityId,
    ownerId: record.ownerId,
    operation: record.operation,
    version: record.version,
    updatedAt: record.updatedAt,
    mutationId: record.mutationId,
    ...(record.operation === "upsert" ? { payload: record.payload } : {}),
    serverUpdatedAt: serverTimestamp(),
  };
}

function mergeDailyPlan(existing: RemoteSyncEnvelope, incoming: RemoteSyncEnvelope): RemoteSyncEnvelope | null {
  if (existing.entityType !== "daily-plan" || incoming.entityType !== "daily-plan" || existing.operation !== "upsert" || incoming.operation !== "upsert") return null;
  const remotePlan = DailyPlanSchema.parse(existing.payload);
  const localPlan = DailyPlanSchema.parse(incoming.payload);
  if (remotePlan.id !== localPlan.id || remotePlan.date !== localPlan.date) return null;
  const localById = new Map(localPlan.blocks.map((block) => [block.id, block]));
  let changed = false;
  const blocks = remotePlan.blocks.map((remoteBlock) => {
    const localBlock = localById.get(remoteBlock.id);
    if (!localBlock || localBlock.status !== "completed" || remoteBlock.status === "completed") return remoteBlock;
    changed = true;
    return { ...remoteBlock, status: "completed" as const, completedAt: localBlock.completedAt ?? incoming.updatedAt };
  });
  if (!changed) return null;
  const version = existing.version + 1;
  const updatedAt = incoming.updatedAt > existing.updatedAt ? incoming.updatedAt : new Date().toISOString();
  return parseRemoteSyncEnvelope({
    ...existing,
    version,
    updatedAt,
    mutationId: incoming.mutationId,
    payload: { ...remotePlan, blocks, version, updatedAt },
  });
}

function parseCursor(cursor: string | null): CollectionCursor {
  if (!cursor) return {};
  try {
    return CursorSchema.parse(JSON.parse(cursor));
  } catch {
    // Older clients used a cursor based on device-authored updatedAt. A full,
    // idempotent pull safely migrates them to the trusted server-time cursor.
    return {};
  }
}

export interface FirebaseSyncAdapterOptions {
  pageSize?: number;
  /** Attempts must be graded server-side so clients never author correctness fields. */
  gradeAttempt?: (attempt: Attempt) => Promise<unknown>;
}

/**
 * Generic user-progress adapter. The direct users/{uid} profile document is
 * intentionally excluded so client sync can never overwrite role/auth fields.
 */
export function createFirestoreSyncAdapter(
  firestore: Firestore,
  ownerId: string,
  options: FirebaseSyncAdapterOptions = {},
): RemoteSyncAdapter {
  const pageSize = Math.max(10, Math.min(500, Math.trunc(options.pageSize ?? 100)));

  return {
    async push(input): Promise<{ accepted: boolean; record: RemoteSyncEnvelope }> {
      const incoming = parseRemoteSyncEnvelope(input);
      if (incoming.ownerId !== ownerId) throw new Error("Cannot push another user's data");
      if (incoming.entityType === "profile") throw new Error("Profile writes use the dedicated profile repository");
      if (incoming.entityType === "attempt") {
        if (incoming.operation !== "upsert" || !options.gradeAttempt) {
          throw new Error("Attempts require the server-side grading adapter");
        }
        const attempt = AttemptSchema.parse(incoming.payload);
        const graded = await options.gradeAttempt(attempt);
        const record = parseRemoteSyncEnvelope(graded);
        if (record.entityType !== "attempt" || record.entityId !== attempt.id || record.ownerId !== ownerId) {
          throw new Error("Grading returned a mismatched attempt record");
        }
        return { accepted: true, record };
      }
      if (incoming.operation === "delete" && !MUTABLE_DELETE_TYPES.has(incoming.entityType)) {
        throw new Error(`${incoming.entityType} cannot be deleted by the client`);
      }

      const collectionName = COLLECTION_BY_TYPE[incoming.entityType];
      const reference = doc(firestore, "users", ownerId, collectionName, incoming.entityId);
      return runTransaction(firestore, async (transaction) => {
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) {
          if (incoming.version !== 1) throw new Error("Remote version gap: a new record must start at version 1");
          transaction.set(reference, toDocument(incoming));
          return { accepted: true, record: incoming };
        }

        const existing = fromDocument(snapshot.data());
        if (existing.mutationId === incoming.mutationId) return { accepted: true, record: existing };
        if (incoming.entityType === "daily-plan") {
          const merged = mergeDailyPlan(existing, incoming);
          if (!merged) return { accepted: false, record: existing };
          transaction.set(reference, toDocument(merged));
          return { accepted: true, record: merged };
        }
        if (APPEND_ONLY_TYPES.has(incoming.entityType)) return { accepted: false, record: existing };
        if (incoming.version <= existing.version) return { accepted: false, record: existing };
        if (incoming.version !== existing.version + 1) {
          throw new Error(`Remote version gap: expected ${existing.version + 1}, received ${incoming.version}`);
        }
        transaction.set(reference, toDocument(incoming));
        return { accepted: true, record: incoming };
      });
    },

    async pull(cursorInput): Promise<RemotePullResult> {
      const cursor = parseCursor(cursorInput);
      const nextCursor: CollectionCursor = { ...cursor };
      const records: RemoteSyncEnvelope[] = [];
      let hasMore = false;

      for (const [entityType, collectionName] of Object.entries(COLLECTION_BY_TYPE) as Array<
        [Exclude<SyncEntityType, "profile">, string]
      >) {
        const collectionReference = collection(firestore, "users", ownerId, collectionName);
        const constraints: QueryConstraint[] = [orderBy("serverUpdatedAt"), orderBy(documentId())];
        const position = cursor[entityType];
        if (position) constraints.push(startAfter(Timestamp.fromDate(new Date(position.serverUpdatedAt)), position.entityId));
        constraints.push(limit(pageSize));
        const snapshot = await getDocs(query(collectionReference, ...constraints));
        for (const documentSnapshot of snapshot.docs) {
          const record = fromDocument(documentSnapshot.data());
          if (record.ownerId !== ownerId || record.entityType !== entityType) {
            throw new Error("Firebase returned a document outside the requested sync partition");
          }
          records.push(record);
          if (!record.serverUpdatedAt) throw new Error("Firebase sync record is missing a trusted server timestamp");
          nextCursor[entityType] = { serverUpdatedAt: record.serverUpdatedAt, entityId: documentSnapshot.id };
        }
        if (snapshot.size === pageSize) hasMore = true;
      }

      records.sort((left, right) => left.updatedAt.localeCompare(right.updatedAt) || left.entityId.localeCompare(right.entityId));
      return {
        records,
        cursor: JSON.stringify(nextCursor),
        hasMore,
      };
    },
  };
}

export { COLLECTION_BY_TYPE };
