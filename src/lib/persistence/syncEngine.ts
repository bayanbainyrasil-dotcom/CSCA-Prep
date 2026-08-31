import { nanoid } from "nanoid";
import {
  parseSyncEntity,
  type SyncEntity,
  type SyncEntityType,
} from "../../domain";
import {
  LocalEntityRecordSchema,
  LocalSyncStateSchema,
  OutboxRecordSchema,
  localEntityKey,
  type ConflictRecord,
  type CscaDatabase,
  type LocalEntityRecord,
  type OutboxRecord,
} from "./database";
import {
  parseRemoteSyncEnvelope,
  resolveVersionConflict,
  type RemoteSyncAdapter,
  type RemoteSyncEnvelope,
} from "./contracts";

export interface SyncEngineOptions {
  isOnline?: () => boolean;
  now?: () => Date;
  onStatusChange?: (status: SyncStatusSnapshot) => void;
}

export interface SyncStatusSnapshot {
  status: "saved" | "saving" | "offline" | "syncing" | "error";
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2_000) : "Unknown synchronization error";
}

function outboxToEnvelope(input: OutboxRecord): RemoteSyncEnvelope {
  const record = OutboxRecordSchema.parse(input);
  if (record.operation === "upsert") {
    const payload = parseSyncEntity(record.entityType, record.payload);
    return parseRemoteSyncEnvelope({
      entityType: record.entityType,
      entityId: record.entityId,
      ownerId: record.ownerId,
      operation: "upsert",
      version: record.version,
      updatedAt: payload.updatedAt,
      mutationId: record.id,
      payload,
    });
  }
  return parseRemoteSyncEnvelope({
    entityType: record.entityType,
    entityId: record.entityId,
    ownerId: record.ownerId,
    operation: "delete",
    version: record.version,
    updatedAt: record.createdAt,
    mutationId: record.id,
  });
}

function localToEnvelope(recordInput: LocalEntityRecord): RemoteSyncEnvelope {
  const record = LocalEntityRecordSchema.parse(recordInput);
  return parseRemoteSyncEnvelope({
    entityType: record.entityType,
    entityId: record.entityId,
    ownerId: record.ownerId,
    operation: record.operation,
    version: record.version,
    updatedAt: record.updatedAt,
    mutationId: record.lastMutationId,
    ...(record.operation === "upsert" ? { payload: record.data } : {}),
  });
}

function envelopeToLocal(recordInput: RemoteSyncEnvelope, dirty: 0 | 1): LocalEntityRecord {
  const record = parseRemoteSyncEnvelope(recordInput);
  return LocalEntityRecordSchema.parse({
    key: localEntityKey(record.ownerId, record.entityType, record.entityId),
    ownerId: record.ownerId,
    entityType: record.entityType,
    entityId: record.entityId,
    operation: record.operation,
    ...(record.operation === "upsert" ? { data: record.payload } : {}),
    version: record.version,
    updatedAt: record.updatedAt,
    lastMutationId: record.mutationId,
    syncedVersion: dirty ? Math.max(0, record.version - 1) : record.version,
    dirty,
  }) as LocalEntityRecord;
}

function withRebasedVersion(entityType: SyncEntityType, payload: unknown, version: number, updatedAt: string): SyncEntity {
  return parseSyncEntity(entityType, {
    ...(payload as Record<string, unknown>),
    version,
    updatedAt,
  });
}

export class SyncEngine {
  private running: Promise<SyncStatusSnapshot> | null = null;
  private readonly isOnline: () => boolean;
  private readonly now: () => Date;

  constructor(
    private readonly database: CscaDatabase,
    private readonly remote: RemoteSyncAdapter,
    private readonly ownerId: string,
    private readonly deviceId: string,
    private readonly options: SyncEngineOptions = {},
  ) {
    this.isOnline = options.isOnline ?? (() => typeof navigator === "undefined" || navigator.onLine);
    this.now = options.now ?? (() => new Date());
  }

  async sync(): Promise<SyncStatusSnapshot> {
    this.running ??= this.performSync().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  start(options: { intervalMs?: number } = {}): () => void {
    const intervalMs = Math.max(5_000, options.intervalMs ?? 30_000);
    const onOnline = () => void this.sync();
    if (typeof window !== "undefined") window.addEventListener("online", onOnline);
    const timer = typeof window !== "undefined" ? window.setInterval(onOnline, intervalMs) : undefined;
    void this.sync();
    return () => {
      if (typeof window !== "undefined") window.removeEventListener("online", onOnline);
      if (timer !== undefined && typeof window !== "undefined") window.clearInterval(timer);
    };
  }

  private async performSync(): Promise<SyncStatusSnapshot> {
    if (!this.isOnline()) return this.setStatus("offline", null);
    await this.setStatus("syncing", null);
    try {
      await this.pullAll();
      await this.flushOutbox();
      const pending = await this.pendingCount();
      return this.setStatus(pending === 0 ? "saved" : "saving", null, this.now().toISOString());
    } catch (error) {
      return this.setStatus("error", errorMessage(error));
    }
  }

  private async pullAll(): Promise<void> {
    const stateRaw = await this.database.syncState.get(this.ownerId);
    const state = stateRaw ? LocalSyncStateSchema.parse(stateRaw) : null;
    let cursor = state?.cursor ?? null;
    for (let page = 0; page < 100; page += 1) {
      const result = await this.remote.pull(cursor);
      for (const raw of result.records) await this.applyRemote(raw);
      cursor = result.cursor;
      await this.database.syncState.put(
        LocalSyncStateSchema.parse({
          ownerId: this.ownerId,
          status: "syncing",
          cursor,
          lastSyncedAt: state?.lastSyncedAt ?? null,
          lastError: null,
          pendingCount: await this.pendingCount(),
        }),
      );
      if (!result.hasMore) return;
    }
    throw new Error("Remote sync pagination exceeded the safety limit");
  }

  private async flushOutbox(): Promise<void> {
    const nowIso = this.now().toISOString();
    const candidates = (await this.database.outbox.where("ownerId").equals(this.ownerId).sortBy("createdAt"))
      .map((raw) => OutboxRecordSchema.parse(raw) as OutboxRecord)
      .filter((record) => record.status !== "failed" && record.nextAttemptAt <= nowIso);

    for (const record of candidates) {
      await this.database.outbox.update(record.id, { status: "processing" });
      try {
        const result = await this.remote.push(outboxToEnvelope(record));
        await this.applyRemote(result.record);
        await this.database.outbox.delete(record.id);
        await this.refreshDirtyFlag(record.entityType, record.entityId);
      } catch (error) {
        const retryCount = record.retryCount + 1;
        const delaySeconds = Math.min(300, 2 ** Math.min(retryCount, 8));
        const nextAttempt = new Date(this.now().getTime() + delaySeconds * 1_000).toISOString();
        await this.database.outbox.update(record.id, {
          status: retryCount >= 8 ? "failed" : "pending",
          retryCount,
          nextAttemptAt: nextAttempt,
          lastError: errorMessage(error),
        });
        if (record.critical) throw error;
      }
    }
  }

  private async applyRemote(remoteInput: RemoteSyncEnvelope): Promise<void> {
    const remote = parseRemoteSyncEnvelope(remoteInput);
    if (remote.ownerId !== this.ownerId) throw new Error("Remote adapter returned another user's record");
    if (remote.entityType === "profile") throw new Error("Profiles cannot enter the generic sync engine");
    const key = localEntityKey(this.ownerId, remote.entityType, remote.entityId);
    const localRaw = await this.database.entities.get(key);
    if (!localRaw) {
      await this.database.entities.put(envelopeToLocal(remote, 0));
      return;
    }

    const local = LocalEntityRecordSchema.parse(localRaw) as LocalEntityRecord;
    const resolution = resolveVersionConflict(localToEnvelope(local), remote);
    if (resolution.conflict) await this.recordConflict(localToEnvelope(local), remote, resolution.reason);

    if (resolution.reason === "append-only-collision") {
      // Cloud is authoritative for the colliding ID; the losing event remains
      // recoverable in the conflict table instead of being silently discarded.
      await this.removeStaleOutbox(remote.entityType, remote.entityId, remote.version);
      await this.database.entities.put(envelopeToLocal(remote, 0));
      return;
    }

    if (resolution.source === "remote") {
      await this.removeStaleOutbox(remote.entityType, remote.entityId, remote.version);
      const remaining = await this.hasPendingAfter(remote.entityType, remote.entityId, remote.version);
      await this.database.entities.put(envelopeToLocal(remote, remaining ? 1 : 0));
      return;
    }

    if (local.version === remote.version) {
      await this.rebaseLocalWinner(local, remote.version);
    }
  }

  private async rebaseLocalWinner(local: LocalEntityRecord, remoteVersion: number): Promise<void> {
    if (local.operation === "delete" && local.entityType !== "note" && local.entityType !== "bookmark") return;
    const mutationId = nanoid();
    const updatedAt = this.now().toISOString();
    const version = remoteVersion + 1;
    const payload = local.operation === "upsert"
      ? withRebasedVersion(local.entityType, local.data, version, updatedAt)
      : undefined;
    await this.database.transaction("rw", this.database.entities, this.database.outbox, async () => {
      await this.removeStaleOutbox(local.entityType, local.entityId, remoteVersion);
      await this.database.entities.put(
        LocalEntityRecordSchema.parse({
          ...local,
          ...(payload === undefined ? { data: undefined } : { data: payload }),
          version,
          updatedAt,
          lastMutationId: mutationId,
          syncedVersion: remoteVersion,
          dirty: 1,
        }) as LocalEntityRecord,
      );
      await this.database.outbox.put(
        OutboxRecordSchema.parse({
          id: mutationId,
          ownerId: this.ownerId,
          deviceId: this.deviceId,
          entityType: local.entityType,
          entityId: local.entityId,
          operation: local.operation,
          baseVersion: remoteVersion,
          version,
          ...(payload === undefined ? {} : { payload }),
          critical: local.entityType === "note" || local.entityType === "bookmark",
          createdAt: updatedAt,
          status: "pending",
          retryCount: 0,
          nextAttemptAt: updatedAt,
          lastError: null,
        }) as OutboxRecord,
      );
    });
  }

  private async removeStaleOutbox(entityType: SyncEntityType, entityId: string, throughVersion: number): Promise<void> {
    const records = await this.database.outbox.where("[entityType+entityId]").equals([entityType, entityId]).toArray();
    const ids = records
      .map((record) => OutboxRecordSchema.parse(record) as OutboxRecord)
      .filter((record) => record.ownerId === this.ownerId && record.version <= throughVersion)
      .map((record) => record.id);
    await this.database.outbox.bulkDelete(ids);
  }

  private async hasPendingAfter(entityType: SyncEntityType, entityId: string, version: number): Promise<boolean> {
    const records = await this.database.outbox.where("[entityType+entityId]").equals([entityType, entityId]).toArray();
    return records
      .map((record) => OutboxRecordSchema.parse(record) as OutboxRecord)
      .some((record) => record.ownerId === this.ownerId && record.version > version);
  }

  private async refreshDirtyFlag(entityType: SyncEntityType, entityId: string): Promise<void> {
    const pending = await this.hasPendingAfter(entityType, entityId, -1);
    const key = localEntityKey(this.ownerId, entityType, entityId);
    const raw = await this.database.entities.get(key);
    if (!raw) return;
    const record = LocalEntityRecordSchema.parse(raw);
    await this.database.entities.put(
      LocalEntityRecordSchema.parse({
        ...record,
        syncedVersion: pending ? record.syncedVersion : record.version,
        dirty: pending ? 1 : 0,
      }) as LocalEntityRecord,
    );
  }

  private async recordConflict(local: RemoteSyncEnvelope, remote: RemoteSyncEnvelope, reason: string): Promise<void> {
    const record: ConflictRecord = {
      id: nanoid(),
      ownerId: this.ownerId,
      entityType: local.entityType,
      entityId: local.entityId,
      local,
      remote,
      reason,
      createdAt: this.now().toISOString(),
      resolved: 0,
    };
    await this.database.conflicts.put(record);
  }

  private async pendingCount(): Promise<number> {
    return this.database.outbox.where("ownerId").equals(this.ownerId).count();
  }

  private async setStatus(
    status: SyncStatusSnapshot["status"],
    error: string | null,
    lastSyncedAt?: string,
  ): Promise<SyncStatusSnapshot> {
    const existingRaw = await this.database.syncState.get(this.ownerId);
    const existing = existingRaw ? LocalSyncStateSchema.parse(existingRaw) : null;
    const snapshot: SyncStatusSnapshot = {
      status,
      pendingCount: await this.pendingCount(),
      lastSyncedAt: lastSyncedAt ?? existing?.lastSyncedAt ?? null,
      error,
    };
    await this.database.syncState.put(
      LocalSyncStateSchema.parse({
        ownerId: this.ownerId,
        status,
        cursor: existing?.cursor ?? null,
        lastSyncedAt: snapshot.lastSyncedAt,
        lastError: error,
        pendingCount: snapshot.pendingCount,
      }),
    );
    this.options.onStatusChange?.(snapshot);
    return snapshot;
  }
}
