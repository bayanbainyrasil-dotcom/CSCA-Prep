import { z } from "zod";
import {
  IdSchema,
  IsoDateTimeSchema,
  SyncEntityTypeSchema,
  SyncOperationSchema,
  parseSyncEntity,
  type SyncEntity,
  type SyncEntityType,
  type SyncOperation,
} from "../../domain";

export const RemoteSyncEnvelopeSchema = z
  .object({
    entityType: SyncEntityTypeSchema,
    entityId: IdSchema,
    ownerId: IdSchema,
    operation: SyncOperationSchema,
    version: z.number().int().positive(),
    updatedAt: IsoDateTimeSchema,
    mutationId: IdSchema,
    payload: z.unknown().optional(),
    serverUpdatedAt: IsoDateTimeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((envelope, context) => {
    if (envelope.operation === "upsert" && envelope.payload === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["payload"], message: "Upserts require payload" });
    }
    if (envelope.operation === "delete" && envelope.payload !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["payload"], message: "Deletes cannot retain payload" });
    }
  });

export interface RemoteSyncEnvelope {
  entityType: SyncEntityType;
  entityId: string;
  ownerId: string;
  operation: SyncOperation;
  version: number;
  updatedAt: string;
  mutationId: string;
  payload?: unknown;
  serverUpdatedAt?: string | null;
}

export interface RemotePushResult {
  accepted: boolean;
  record: RemoteSyncEnvelope;
}

export interface RemotePullResult {
  records: RemoteSyncEnvelope[];
  cursor: string | null;
  hasMore: boolean;
}

export interface RemoteSyncAdapter {
  push(record: RemoteSyncEnvelope): Promise<RemotePushResult>;
  pull(cursor: string | null): Promise<RemotePullResult>;
}

export interface ConflictResolution {
  winner: RemoteSyncEnvelope;
  source: "local" | "remote";
  reason: "same" | "higher-version" | "newer-timestamp" | "tombstone" | "deterministic-tiebreak" | "append-only-collision";
  conflict: boolean;
}

const APPEND_ONLY_TYPES = new Set<SyncEntityType>(["attempt"]);

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nested]) => `${JSON.stringify(key)}:${stableJson(nested)}`)
    .join(",")}}`;
}

export function parseRemoteSyncEnvelope(input: unknown): RemoteSyncEnvelope {
  const envelope = RemoteSyncEnvelopeSchema.parse(input) as RemoteSyncEnvelope;
  if (envelope.operation === "upsert") {
    const payload = parseSyncEntity(envelope.entityType, envelope.payload);
    const payloadId = envelope.entityType === "profile" ? "uid" : "id";
    const ownerField = envelope.entityType === "profile" ? "uid" : "userId";
    if ((payload as unknown as Record<string, unknown>)[payloadId] !== envelope.entityId) {
      throw new Error("Remote envelope entityId does not match its payload");
    }
    if ((payload as unknown as Record<string, unknown>)[ownerField] !== envelope.ownerId) {
      throw new Error("Remote envelope ownerId does not match its payload");
    }
    if (payload.version !== envelope.version) {
      throw new Error("Remote envelope version does not match its payload");
    }
    return { ...envelope, payload };
  }
  return envelope;
}

export function envelopeFromEntity(input: {
  entityType: SyncEntityType;
  entity: SyncEntity;
  ownerId: string;
  entityId: string;
  mutationId: string;
}): RemoteSyncEnvelope {
  return parseRemoteSyncEnvelope({
    entityType: input.entityType,
    entityId: input.entityId,
    ownerId: input.ownerId,
    operation: "upsert",
    version: input.entity.version,
    updatedAt: input.entity.updatedAt,
    mutationId: input.mutationId,
    payload: input.entity,
  });
}

/** Deterministic convergence for two devices, including equal-version races. */
export function resolveVersionConflict(
  localInput: RemoteSyncEnvelope,
  remoteInput: RemoteSyncEnvelope,
): ConflictResolution {
  const local = parseRemoteSyncEnvelope(localInput);
  const remote = parseRemoteSyncEnvelope(remoteInput);
  if (
    local.entityType !== remote.entityType ||
    local.entityId !== remote.entityId ||
    local.ownerId !== remote.ownerId
  ) {
    throw new Error("Cannot resolve records for different entities");
  }

  const same =
    local.version === remote.version &&
    local.operation === remote.operation &&
    stableJson(local.payload) === stableJson(remote.payload);
  if (same) return { winner: remote, source: "remote", reason: "same", conflict: false };

  if (APPEND_ONLY_TYPES.has(local.entityType)) {
    const localWins = local.mutationId.localeCompare(remote.mutationId) > 0;
    return {
      winner: localWins ? local : remote,
      source: localWins ? "local" : "remote",
      reason: "append-only-collision",
      conflict: true,
    };
  }
  if (local.version !== remote.version) {
    const localWins = local.version > remote.version;
    return {
      winner: localWins ? local : remote,
      source: localWins ? "local" : "remote",
      reason: "higher-version",
      conflict: false,
    };
  }

  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (localTime !== remoteTime) {
    const localWins = localTime > remoteTime;
    return {
      winner: localWins ? local : remote,
      source: localWins ? "local" : "remote",
      reason: "newer-timestamp",
      conflict: true,
    };
  }
  if (local.operation !== remote.operation) {
    const localWins = local.operation === "delete";
    return {
      winner: localWins ? local : remote,
      source: localWins ? "local" : "remote",
      reason: "tombstone",
      conflict: true,
    };
  }
  const localWins = local.mutationId.localeCompare(remote.mutationId) > 0;
  return {
    winner: localWins ? local : remote,
    source: localWins ? "local" : "remote",
    reason: "deterministic-tiebreak",
    conflict: true,
  };
}
