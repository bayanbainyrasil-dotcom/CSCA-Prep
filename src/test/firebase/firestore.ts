/**
 * An in-memory stand-in for `firebase-admin/firestore`, used only by Vitest.
 *
 * It exists so the import callables in `functions/src` can be exercised as the
 * server actually runs them — same validation, same idempotency bookkeeping,
 * same document shapes — without a network, an emulator or a credential. The
 * alias that swaps it in lives in `vitest.config.ts`, so nothing here can reach
 * `vite.config.ts` or the production bundle.
 *
 * It implements only the surface `functions/src` uses. Anything else throws,
 * so an untested code path fails loudly instead of silently passing.
 */

export class Timestamp {
  constructor(private readonly millis: number) {}
  static now(): Timestamp {
    return new Timestamp(Date.now());
  }
  static fromMillis(millis: number): Timestamp {
    return new Timestamp(millis);
  }
  static fromDate(date: Date): Timestamp {
    return new Timestamp(date.getTime());
  }
  toMillis(): number {
    return this.millis;
  }
  toDate(): Date {
    return new Date(this.millis);
  }
}

const SERVER_TIMESTAMP = '__serverTimestamp__';
const DELETE = '__delete__';

interface Sentinel {
  readonly __sentinel: typeof SERVER_TIMESTAMP | typeof DELETE;
}

function isSentinel(value: unknown): value is Sentinel {
  return typeof value === 'object' && value !== null && '__sentinel' in value;
}

export const FieldValue = {
  serverTimestamp: (): Sentinel => ({ __sentinel: SERVER_TIMESTAMP }),
  delete: (): Sentinel => ({ __sentinel: DELETE }),
};

export class FieldPath {
  private constructor(readonly segment: string) {}
  static documentId(): FieldPath {
    return new FieldPath('__name__');
  }
}

export type DocumentData = Record<string, unknown>;

/** Every document currently stored, keyed `collection/id`. */
const store = new Map<string, Map<string, DocumentData>>();
/** Every write that reached the store, in order, for "wrote nothing" assertions. */
export const recordedWrites: { collection: string; id: string; merge: boolean }[] = [];

export function resetFirestore(): void {
  store.clear();
  recordedWrites.length = 0;
}

export function seedDocument(collection: string, id: string, data: DocumentData): void {
  collectionOf(collection).set(id, { ...data });
}

export function readDocument(collection: string, id: string): DocumentData | undefined {
  const found = collectionOf(collection).get(id);
  return found ? { ...found } : undefined;
}

export function listDocuments(collection: string): { id: string; data: DocumentData }[] {
  return [...collectionOf(collection).entries()].map(([id, data]) => ({ id, data: { ...data } }));
}

export function collectionNames(): string[] {
  return [...store.entries()].filter(([, documents]) => documents.size > 0).map(([name]) => name);
}

function collectionOf(name: string): Map<string, DocumentData> {
  let documents = store.get(name);
  if (!documents) {
    documents = new Map();
    store.set(name, documents);
  }
  return documents;
}

function resolveSentinels(data: DocumentData): DocumentData {
  const output: DocumentData = {};
  for (const [key, value] of Object.entries(data)) {
    if (isSentinel(value)) {
      if (value.__sentinel === SERVER_TIMESTAMP) output[key] = Timestamp.now();
      continue;
    }
    if (value !== undefined) output[key] = value;
  }
  return output;
}

function applyWrite(collection: string, id: string, data: DocumentData, merge: boolean): void {
  const documents = collectionOf(collection);
  const resolved = resolveSentinels(data);
  const previous = documents.get(id);
  documents.set(id, merge && previous ? { ...previous, ...resolved } : resolved);
  recordedWrites.push({ collection, id, merge });
}

export class DocumentSnapshot {
  constructor(
    readonly id: string,
    private readonly document: DocumentData | undefined,
    readonly ref: DocumentReference,
  ) {}
  get exists(): boolean {
    return this.document !== undefined;
  }
  data(): DocumentData | undefined {
    return this.document ? { ...this.document } : undefined;
  }
}

export class DocumentReference {
  constructor(
    readonly collectionId: string,
    readonly id: string,
  ) {}
  get path(): string {
    return `${this.collectionId}/${this.id}`;
  }
  collection(name: string): CollectionReference {
    return new CollectionReference(`${this.path}/${name}`);
  }
  get(): Promise<DocumentSnapshot> {
    return Promise.resolve(new DocumentSnapshot(this.id, collectionOf(this.collectionId).get(this.id), this));
  }
  set(data: DocumentData, options?: { merge?: boolean }): Promise<void> {
    applyWrite(this.collectionId, this.id, data, options?.merge === true);
    return Promise.resolve();
  }
  update(data: DocumentData): Promise<void> {
    applyWrite(this.collectionId, this.id, data, true);
    return Promise.resolve();
  }
  delete(): Promise<void> {
    collectionOf(this.collectionId).delete(this.id);
    return Promise.resolve();
  }
}

interface QueryState {
  readonly collectionId: string;
  readonly filters: { field: string; operator: string; value: unknown }[];
  readonly orderByDocumentId: boolean;
  readonly startAfterId: string | null;
  readonly limit: number | null;
}

export class Query {
  constructor(protected readonly state: QueryState) {}

  where(field: string, operator: string, value: unknown): Query {
    if (operator !== '==') throw new Error(`The Firestore double supports only '==', not '${operator}'.`);
    return new Query({ ...this.state, filters: [...this.state.filters, { field, operator, value }] });
  }

  orderBy(field: string | FieldPath): Query {
    if (!(field instanceof FieldPath)) {
      throw new Error('The Firestore double orders by document id only.');
    }
    return new Query({ ...this.state, orderByDocumentId: true });
  }

  limit(count: number): Query {
    return new Query({ ...this.state, limit: count });
  }

  startAfter(cursor: string): Query {
    return new Query({ ...this.state, startAfterId: cursor });
  }

  get(): Promise<{ docs: DocumentSnapshot[]; empty: boolean; size: number }> {
    let entries = [...collectionOf(this.state.collectionId).entries()];
    for (const filter of this.state.filters) {
      entries = entries.filter(([, data]) => data[filter.field] === filter.value);
    }
    if (this.state.orderByDocumentId || this.state.startAfterId !== null) {
      entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
    }
    if (this.state.startAfterId !== null) {
      const cursor = this.state.startAfterId;
      entries = entries.filter(([id]) => id > cursor);
    }
    if (this.state.limit !== null) entries = entries.slice(0, this.state.limit);
    const docs = entries.map(
      ([id, data]) => new DocumentSnapshot(id, data, new DocumentReference(this.state.collectionId, id)),
    );
    return Promise.resolve({ docs, empty: docs.length === 0, size: docs.length });
  }
}

export class CollectionReference extends Query {
  constructor(readonly collectionId: string) {
    super({ collectionId, filters: [], orderByDocumentId: false, startAfterId: null, limit: null });
  }
  doc(id?: string): DocumentReference {
    return new DocumentReference(this.collectionId, id ?? `auto-${Math.random().toString(36).slice(2, 12)}`);
  }
  add(data: DocumentData): Promise<DocumentReference> {
    const reference = this.doc();
    applyWrite(this.collectionId, reference.id, data, false);
    return Promise.resolve(reference);
  }
}

type QueuedWrite = () => void;

export class WriteBatch {
  private readonly queued: QueuedWrite[] = [];
  set(reference: DocumentReference, data: DocumentData, options?: { merge?: boolean }): WriteBatch {
    this.queued.push(() => applyWrite(reference.collectionId, reference.id, data, options?.merge === true));
    return this;
  }
  update(reference: DocumentReference, data: DocumentData): WriteBatch {
    this.queued.push(() => applyWrite(reference.collectionId, reference.id, data, true));
    return this;
  }
  delete(reference: DocumentReference): WriteBatch {
    this.queued.push(() => collectionOf(reference.collectionId).delete(reference.id));
    return this;
  }
  commit(): Promise<void> {
    for (const write of this.queued) write();
    this.queued.length = 0;
    return Promise.resolve();
  }
}

/**
 * Writes are held until the body returns. A body that throws — a version
 * conflict, for example — leaves the store untouched, which is the property the
 * conflict tests rely on.
 */
export class Transaction {
  private readonly queued: QueuedWrite[] = [];
  get(reference: DocumentReference): Promise<DocumentSnapshot> {
    return reference.get();
  }
  getAll(...references: DocumentReference[]): Promise<DocumentSnapshot[]> {
    return Promise.all(references.map((reference) => reference.get()));
  }
  set(reference: DocumentReference, data: DocumentData, options?: { merge?: boolean }): Transaction {
    this.queued.push(() => applyWrite(reference.collectionId, reference.id, data, options?.merge === true));
    return this;
  }
  update(reference: DocumentReference, data: DocumentData): Transaction {
    this.queued.push(() => applyWrite(reference.collectionId, reference.id, data, true));
    return this;
  }
  delete(reference: DocumentReference): Transaction {
    this.queued.push(() => collectionOf(reference.collectionId).delete(reference.id));
    return this;
  }
  flush(): void {
    for (const write of this.queued) write();
    this.queued.length = 0;
  }
}

export class Firestore {
  settings(): void {
    // The real client accepts options here; the double has nothing to configure.
  }
  collection(name: string): CollectionReference {
    return new CollectionReference(name);
  }
  batch(): WriteBatch {
    return new WriteBatch();
  }
  getAll(...references: DocumentReference[]): Promise<DocumentSnapshot[]> {
    return Promise.all(references.map((reference) => reference.get()));
  }
  async runTransaction<T>(body: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = new Transaction();
    const result = await body(transaction);
    transaction.flush();
    return result;
  }
}

const instance = new Firestore();

export function getFirestore(): Firestore {
  return instance;
}
