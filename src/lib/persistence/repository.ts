import { nanoid } from "nanoid";
import {
  FormulaSchema,
  LessonSchema,
  QuestionSchema,
  TopicSchema,
  VocabularyEntrySchema,
  getSyncEntityId,
  getSyncEntityOwnerId,
  getSyncEntityUpdatedAt,
  getSyncEntityVersion,
  parseSyncEntity,
  type SyncEntity,
  type SyncEntityType,
} from "../../domain";
import {
  LocalEntityRecordSchema,
  OutboxRecordSchema,
  localEntityKey,
  type CachedContentRecord,
  type CachedContentType,
  type CscaDatabase,
  type LocalEntityRecord,
  type OutboxRecord,
} from "./database";

const FORBIDDEN_LOCAL_KEYS = /^(?:password|secret|credential|accessToken|refreshToken|idToken|authToken|apiKey|privateKey)$/i;
const APPEND_ONLY_ENTITY_TYPES = new Set<SyncEntityType>(["attempt"]);
const DELETABLE_ENTITY_TYPES = new Set<SyncEntityType>(["note", "bookmark"]);

function assertStorageSafe(value: unknown, path = "payload"): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertStorageSafe(item, `${path}[${index}]`));
    return;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_LOCAL_KEYS.test(key)) {
      throw new Error(`Refusing to persist credential-like field at ${path}.${key}`);
    }
    assertStorageSafe(nested, `${path}.${key}`);
  }
}

function parseCachedContent(contentType: CachedContentType, input: unknown): unknown {
  switch (contentType) {
    case "topic":
      return TopicSchema.parse(input);
    case "lesson":
      return LessonSchema.parse(input);
    case "question":
      return QuestionSchema.parse(input);
    case "vocabulary":
      return VocabularyEntrySchema.parse(input);
    case "formula":
      return FormulaSchema.parse(input);
  }
}

function cachedContentIdentity(contentType: CachedContentType, value: unknown): { id: string; version: number; updatedAt: string } {
  const parsed = parseCachedContent(contentType, value) as { id: string; version: number; updatedAt: string };
  return { id: parsed.id, version: parsed.version, updatedAt: parsed.updatedAt };
}

export interface SaveEntityOptions {
  critical?: boolean;
  mutationId?: string;
}

export class LocalFirstRepository {
  constructor(
    private readonly database: CscaDatabase,
    private readonly ownerId: string,
    private readonly deviceId: string,
  ) {}

  async save(entityType: SyncEntityType, input: unknown, options: SaveEntityOptions = {}): Promise<SyncEntity> {
    if (entityType === "profile") {
      throw new Error("Profiles are handled by the authenticated profile repository and are never placed in the generic local outbox");
    }
    const entity = parseSyncEntity(entityType, input);
    assertStorageSafe(entity);
    const entityId = getSyncEntityId(entityType, entity);
    const entityOwnerId = getSyncEntityOwnerId(entityType, entity);
    if (entityOwnerId !== this.ownerId) throw new Error("Cannot persist another user's entity");
    const key = localEntityKey(this.ownerId, entityType, entityId);
    const existingRaw = await this.database.entities.get(key);
    const existing = existingRaw ? LocalEntityRecordSchema.parse(existingRaw) : null;
    const baseVersion = existing?.version ?? 0;
    const version = getSyncEntityVersion(entity);

    if (APPEND_ONLY_ENTITY_TYPES.has(entityType) && existing) {
      throw new Error(`${entityType} records are append-only and cannot be overwritten`);
    }
    if (version !== baseVersion + 1) {
      throw new Error(`Stale ${entityType} write: expected version ${baseVersion + 1}, received ${version}`);
    }

    const mutationId = options.mutationId ?? nanoid();
    const timestamp = getSyncEntityUpdatedAt(entity);
    const localRecord = LocalEntityRecordSchema.parse({
      key,
      ownerId: this.ownerId,
      entityType,
      entityId,
      operation: "upsert",
      data: entity,
      version,
      updatedAt: timestamp,
      lastMutationId: mutationId,
      syncedVersion: existing?.syncedVersion ?? 0,
      dirty: 1,
    }) as LocalEntityRecord;
    const outboxRecord = OutboxRecordSchema.parse({
      id: mutationId,
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      entityType,
      entityId,
      operation: "upsert",
      baseVersion,
      version,
      payload: entity,
      critical: options.critical ?? APPEND_ONLY_ENTITY_TYPES.has(entityType),
      createdAt: timestamp,
      status: "pending",
      retryCount: 0,
      nextAttemptAt: timestamp,
      lastError: null,
    }) as OutboxRecord;

    await this.database.transaction("rw", this.database.entities, this.database.outbox, async () => {
      await this.database.entities.put(localRecord);
      await this.database.outbox.put(outboxRecord);
    });
    return entity;
  }

  async remove(entityType: SyncEntityType, entityId: string, options: SaveEntityOptions = {}): Promise<void> {
    if (!DELETABLE_ENTITY_TYPES.has(entityType)) {
      throw new Error(`${entityType} records cannot be deleted by the client`);
    }
    const key = localEntityKey(this.ownerId, entityType, entityId);
    const existingRaw = await this.database.entities.get(key);
    if (!existingRaw) return;
    const existing = LocalEntityRecordSchema.parse(existingRaw);
    const mutationId = options.mutationId ?? nanoid();
    const now = new Date().toISOString();
    const version = existing.version + 1;
    const tombstone = LocalEntityRecordSchema.parse({
      key,
      ownerId: this.ownerId,
      entityType,
      entityId,
      operation: "delete",
      version,
      updatedAt: now,
      lastMutationId: mutationId,
      syncedVersion: existing.syncedVersion,
      dirty: 1,
    }) as LocalEntityRecord;
    const outbox = OutboxRecordSchema.parse({
      id: mutationId,
      ownerId: this.ownerId,
      deviceId: this.deviceId,
      entityType,
      entityId,
      operation: "delete",
      baseVersion: existing.version,
      version,
      critical: options.critical ?? true,
      createdAt: now,
      status: "pending",
      retryCount: 0,
      nextAttemptAt: now,
      lastError: null,
    }) as OutboxRecord;
    await this.database.transaction("rw", this.database.entities, this.database.outbox, async () => {
      await this.database.entities.put(tombstone);
      await this.database.outbox.put(outbox);
    });
  }

  async get(entityType: SyncEntityType, entityId: string): Promise<SyncEntity | null> {
    const raw = await this.database.entities.get(localEntityKey(this.ownerId, entityType, entityId));
    if (!raw) return null;
    const record = LocalEntityRecordSchema.parse(raw);
    if (record.ownerId !== this.ownerId || record.entityType !== entityType || record.entityId !== entityId) {
      throw new Error("Local entity index does not match stored data");
    }
    if (record.operation === "delete") return null;
    return parseSyncEntity(entityType, record.data);
  }

  async list(entityType: SyncEntityType): Promise<SyncEntity[]> {
    const records = await this.database.entities.where("[ownerId+entityType]").equals([this.ownerId, entityType]).toArray();
    return records.map((raw) => LocalEntityRecordSchema.parse(raw)).flatMap((record) => {
      if (record.operation === "delete") return [];
      return [parseSyncEntity(entityType, record.data)];
    });
  }

  async cacheContent(contentType: CachedContentType, input: unknown): Promise<void> {
    const parsed = parseCachedContent(contentType, input);
    assertStorageSafe(parsed);
    const identity = cachedContentIdentity(contentType, parsed);
    const record: CachedContentRecord = {
      key: `${contentType}::${identity.id}`,
      contentType,
      contentId: identity.id,
      data: parsed,
      version: identity.version,
      updatedAt: identity.updatedAt,
      cachedAt: new Date().toISOString(),
    };
    await this.database.content.put(record);
  }

  async getCachedContent(contentType: CachedContentType, contentId: string): Promise<unknown | null> {
    const record = await this.database.content.get(`${contentType}::${contentId}`);
    if (!record) return null;
    if (record.contentType !== contentType || record.contentId !== contentId) {
      throw new Error("Cached content index does not match stored data");
    }
    return parseCachedContent(contentType, record.data);
  }

  async listCachedContent(contentType: CachedContentType): Promise<unknown[]> {
    const records = await this.database.content.where("contentType").equals(contentType).toArray();
    return records.map((record) => parseCachedContent(contentType, record.data));
  }

  async pendingCount(): Promise<number> {
    return this.database.outbox.where("ownerId").equals(this.ownerId).count();
  }

  async exportValidatedData(): Promise<{ entities: SyncEntity[]; exportedAt: string }> {
    const rawRecords = await this.database.entities.where("ownerId").equals(this.ownerId).toArray();
    const entities = rawRecords.map((raw) => LocalEntityRecordSchema.parse(raw)).flatMap((record) => {
      if (record.operation === "delete") return [];
      return [parseSyncEntity(record.entityType, record.data)];
    });
    return { entities, exportedAt: new Date().toISOString() };
  }
}

export { assertStorageSafe };
