/**
 * Pure import bookkeeping, shared by the trusted server and the web tests.
 *
 * Dependency-free for the same reason as `mock-engine.ts` and
 * `blueprint-engine.ts`: the tests exercise exactly the code the server runs.
 */

export type ImportOutcome = 'create' | 'update' | 'unchanged' | 'conflict' | 'invalid';

export interface ImportDecision {
  id: string;
  outcome: ImportOutcome;
  /** Why, in words an administrator can act on. Empty for create/unchanged. */
  reason: string;
  contentHash: string;
  existingVersion: number | null;
  nextVersion: number | null;
}

export interface ExistingRecord {
  version: number;
  contentHash: string | null;
}

/** Deterministic serialisation: key order must not change the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}

/**
 * A short content fingerprint. This only has to detect change, never to resist
 * an attacker, so a dependency-free FNV-1a over the stable serialisation is
 * enough and keeps this module importable by both toolchains.
 */
export function contentHash(value: unknown): string {
  const text = stableStringify(value);
  let high = 0x811c9dc5;
  let low = 0x01000193;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    high ^= code;
    high = Math.imul(high, 0x01000193) >>> 0;
    low = (Math.imul(low ^ code, 0x85ebca6b) + index) >>> 0;
  }
  return `${high.toString(16).padStart(8, '0')}${low.toString(16).padStart(8, '0')}`;
}

export interface ClassifyInput {
  id: string;
  /** The content being imported, already validated. */
  payload: unknown;
  existing: ExistingRecord | null;
  /**
   * The version the caller believes is current. When given and wrong, the import
   * is a conflict rather than an overwrite, so an edit someone else made in the
   * meantime is never silently lost.
   */
  expectedVersion?: number;
}

export function classifyImport(input: ClassifyInput): ImportDecision {
  const hash = contentHash(input.payload);

  if (!input.existing) {
    if (input.expectedVersion !== undefined && input.expectedVersion !== 0) {
      return {
        id: input.id,
        outcome: 'conflict',
        reason: `Expected version ${input.expectedVersion}, but no record exists.`,
        contentHash: hash,
        existingVersion: null,
        nextVersion: null,
      };
    }
    return { id: input.id, outcome: 'create', reason: '', contentHash: hash, existingVersion: null, nextVersion: 1 };
  }

  if (input.existing.contentHash === hash) {
    return {
      id: input.id,
      outcome: 'unchanged',
      reason: '',
      contentHash: hash,
      existingVersion: input.existing.version,
      nextVersion: input.existing.version,
    };
  }

  if (input.expectedVersion !== undefined && input.expectedVersion !== input.existing.version) {
    return {
      id: input.id,
      outcome: 'conflict',
      reason: `Expected version ${input.expectedVersion}, but the stored version is ${input.existing.version}. It changed since you last read it.`,
      contentHash: hash,
      existingVersion: input.existing.version,
      nextVersion: null,
    };
  }

  return {
    id: input.id,
    outcome: 'update',
    reason: '',
    contentHash: hash,
    existingVersion: input.existing.version,
    nextVersion: input.existing.version + 1,
  };
}

export interface ImportSummary {
  create: number;
  update: number;
  unchanged: number;
  conflict: number;
  invalid: number;
  total: number;
  /** True when at least one item cannot be written; nothing is written then. */
  blocked: boolean;
}

export function summariseImport(decisions: ImportDecision[]): ImportSummary {
  const summary: ImportSummary = {
    create: 0,
    update: 0,
    unchanged: 0,
    conflict: 0,
    invalid: 0,
    total: decisions.length,
    blocked: false,
  };
  for (const decision of decisions) summary[decision.outcome] += 1;
  summary.blocked = summary.conflict > 0 || summary.invalid > 0;
  return summary;
}

/**
 * Decisions that actually cause a write. `unchanged` writes nothing, which is
 * what makes re-running the same batch a no-op rather than a duplicate.
 */
export function writableDecisions(decisions: ImportDecision[]): ImportDecision[] {
  return decisions.filter((decision) => decision.outcome === 'create' || decision.outcome === 'update');
}

/**
 * Audit details for an import. Deliberately carries no question text, no answer
 * key and no solution: an audit log is read by more people than the question
 * bank is, and an answer that leaks there is just as leaked.
 */
export function auditDetailsFor(
  batchId: string,
  seedVersion: string,
  decisions: ImportDecision[],
): Record<string, unknown> {
  return {
    batchId,
    seedVersion,
    ...summariseImport(decisions),
    ids: decisions.map((decision) => decision.id).slice(0, 200),
    conflicts: decisions
      .filter((decision) => decision.outcome === 'conflict')
      .map((decision) => decision.id)
      .slice(0, 50),
  };
}
