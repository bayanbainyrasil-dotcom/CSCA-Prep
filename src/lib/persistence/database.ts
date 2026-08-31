import Dexie, { type Table } from "dexie";
import { z } from "zod";
import {
  ConfidenceSchema,
  IdSchema,
  IsoDateTimeSchema,
  PracticeModeSchema,
  SyncEntityTypeSchema,
  SyncOperationSchema,
  type Confidence,
  type PracticeMode,
  type SyncEntityType,
  type SyncOperation,
} from "../../domain";

export interface LocalEntityRecord {
  key: string;
  ownerId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  data?: unknown;
  version: number;
  updatedAt: string;
  lastMutationId: string;
  syncedVersion: number;
  dirty: 0 | 1;
}

export interface OutboxRecord {
  id: string;
  ownerId: string;
  deviceId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  baseVersion: number;
  version: number;
  payload?: unknown;
  critical: boolean;
  createdAt: string;
  status: "pending" | "processing" | "failed";
  retryCount: number;
  nextAttemptAt: string;
  lastError: string | null;
}

export interface ConflictRecord {
  id: string;
  ownerId: string;
  entityType: SyncEntityType;
  entityId: string;
  local: unknown;
  remote: unknown;
  reason: string;
  createdAt: string;
  resolved: 0 | 1;
}

export type CachedContentType = "topic" | "lesson" | "question" | "vocabulary" | "formula";

export interface CachedContentRecord {
  key: string;
  contentType: CachedContentType;
  contentId: string;
  data: unknown;
  version: number;
  updatedAt: string;
  cachedAt: string;
}

export interface LocalSyncState {
  ownerId: string;
  status: "saved" | "saving" | "offline" | "syncing" | "error";
  cursor: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingCount: number;
}

/** A public answer waiting to be securely graded after connectivity returns. */
export interface PendingGradeRecord {
  id: string;
  ownerId: string;
  questionId: string;
  selectedAnswer: string;
  deviceId: string;
  confidence: Confidence;
  hintUsed: boolean;
  englishComprehension: number;
  startedAt: string;
  answeredAt: string;
  elapsedMs: number;
  mode: PracticeMode;
  createdAt: string;
}

export const LocalEntityRecordSchema = z
  .object({
    key: z.string().min(3).max(400),
    ownerId: IdSchema,
    entityType: SyncEntityTypeSchema,
    entityId: IdSchema,
    operation: SyncOperationSchema,
    data: z.unknown().optional(),
    version: z.number().int().positive(),
    updatedAt: IsoDateTimeSchema,
    lastMutationId: IdSchema,
    syncedVersion: z.number().int().nonnegative(),
    dirty: z.union([z.literal(0), z.literal(1)]),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.operation === "upsert" && record.data === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["data"], message: "Upserts require data" });
    }
    if (record.operation === "delete" && record.data !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["data"], message: "Tombstones cannot retain data" });
    }
    if (record.syncedVersion > record.version) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["syncedVersion"], message: "Synced version cannot exceed local version" });
    }
  });

export const OutboxRecordSchema = z
  .object({
    id: IdSchema,
    ownerId: IdSchema,
    deviceId: IdSchema,
    entityType: SyncEntityTypeSchema,
    entityId: IdSchema,
    operation: SyncOperationSchema,
    baseVersion: z.number().int().nonnegative(),
    version: z.number().int().positive(),
    payload: z.unknown().optional(),
    critical: z.boolean(),
    createdAt: IsoDateTimeSchema,
    status: z.enum(["pending", "processing", "failed"]),
    retryCount: z.number().int().nonnegative(),
    nextAttemptAt: IsoDateTimeSchema,
    lastError: z.string().max(2_000).nullable(),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.version !== record.baseVersion + 1) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["version"], message: "Version must be baseVersion + 1" });
    }
    if (record.operation === "upsert" && record.payload === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["payload"], message: "Upserts require a payload" });
    }
    if (record.operation === "delete" && record.payload !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["payload"], message: "Deletes cannot include a payload" });
    }
  });

export const LocalSyncStateSchema = z
  .object({
    ownerId: IdSchema,
    status: z.enum(["saved", "saving", "offline", "syncing", "error"]),
    cursor: z.string().max(20_000).nullable(),
    lastSyncedAt: IsoDateTimeSchema.nullable(),
    lastError: z.string().max(2_000).nullable(),
    pendingCount: z.number().int().nonnegative(),
  })
  .strict();

export const PendingGradeRecordSchema = z
  .object({
    id: IdSchema,
    ownerId: IdSchema,
    questionId: IdSchema,
    selectedAnswer: z.string().min(1).max(160),
    deviceId: IdSchema,
    confidence: ConfidenceSchema,
    hintUsed: z.boolean(),
    englishComprehension: z.number().min(0).max(1),
    startedAt: IsoDateTimeSchema,
    answeredAt: IsoDateTimeSchema,
    elapsedMs: z.number().int().nonnegative().max(86_400_000),
    mode: PracticeModeSchema,
    createdAt: IsoDateTimeSchema,
  })
  .strict();

/** IndexedDB contains progress/content only. Auth tokens and secrets never enter this schema. */
export class CscaDatabase extends Dexie {
  entities!: Table<LocalEntityRecord, string>;
  outbox!: Table<OutboxRecord, string>;
  conflicts!: Table<ConflictRecord, string>;
  content!: Table<CachedContentRecord, string>;
  syncState!: Table<LocalSyncState, string>;
  pendingGrades!: Table<PendingGradeRecord, string>;

  constructor(name = "csca-prep-local-v1") {
    super(name);
    this.version(1).stores({
      entities: "&key, ownerId, [ownerId+entityType], [ownerId+updatedAt], [ownerId+dirty]",
      outbox: "&id, ownerId, [ownerId+status], [ownerId+nextAttemptAt], [entityType+entityId], createdAt",
      conflicts: "&id, ownerId, [ownerId+resolved], [entityType+entityId], createdAt",
      content: "&key, contentType, [contentType+updatedAt], cachedAt",
      syncState: "&ownerId, status",
    });
    this.version(2).stores({
      entities: "&key, ownerId, [ownerId+entityType], [ownerId+updatedAt], [ownerId+dirty]",
      outbox: "&id, ownerId, [ownerId+status], [ownerId+nextAttemptAt], [entityType+entityId], createdAt",
      conflicts: "&id, ownerId, [ownerId+resolved], [entityType+entityId], createdAt",
      content: "&key, contentType, [contentType+updatedAt], cachedAt",
      syncState: "&ownerId, status",
      pendingGrades: "&id, ownerId, [ownerId+createdAt]",
    });
  }
}

let defaultDatabase: CscaDatabase | undefined;

/** Lazy construction keeps SSR and unit tests from touching IndexedDB on import. */
export function getCscaDatabase(): CscaDatabase {
  defaultDatabase ??= new CscaDatabase();
  return defaultDatabase;
}

export async function clearLocalUserData(ownerId: string): Promise<void> {
  IdSchema.parse(ownerId);
  const database = getCscaDatabase();
  await database.transaction("rw", database.entities, database.outbox, database.conflicts, database.syncState, database.pendingGrades, async () => {
    const [entities, outbox, conflicts, pendingGrades] = await Promise.all([
      database.entities.where("ownerId").equals(ownerId).primaryKeys(),
      database.outbox.where("ownerId").equals(ownerId).primaryKeys(),
      database.conflicts.where("ownerId").equals(ownerId).primaryKeys(),
      database.pendingGrades.where("ownerId").equals(ownerId).primaryKeys(),
    ]);
    await Promise.all([
      database.entities.bulkDelete(entities),
      database.outbox.bulkDelete(outbox),
      database.conflicts.bulkDelete(conflicts),
      database.pendingGrades.bulkDelete(pendingGrades),
      database.syncState.delete(ownerId),
    ]);
  });
}

export function localEntityKey(ownerId: string, entityType: SyncEntityType, entityId: string): string {
  return `${ownerId}::${entityType}::${entityId}`;
}
