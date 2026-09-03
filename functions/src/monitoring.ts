/**
 * Operational monitoring.
 *
 * What this exists for: knowing that callables are failing, that sync is not
 * converging, that imports are conflicting, that account deletions are breaking,
 * and how long a mock submission takes — without collecting anything about a
 * learner that we would not want to explain.
 *
 * The central decision is that redaction works from an **allow-list**. A
 * deny-list would leak every field nobody thought to forbid; with an allow-list
 * a new field is dropped until someone deliberately adds it, and adding it means
 * writing it down where a reviewer can see it. Free text is never allowed at
 * all: no question text, no answer, no solution, no note a learner wrote, no
 * search query.
 *
 * Pure and dependency-free, so the rules are testable directly. The caller
 * supplies the emit function.
 */

export type OperationalEventKind =
  | "callable-error"
  | "sync-failure"
  | "import-conflict"
  | "account-deletion-failure"
  | "mock-submission";

/**
 * The only keys that may ever be recorded, and what each is for.
 *
 * Every one is a bounded identifier, an enum, a count or a duration. None can
 * hold a sentence.
 */
export const ALLOWED_DETAIL_KEYS = {
  /** The callable that failed, e.g. "startMockExam". */
  operation: "identifier",
  /** The error code, e.g. "permission-denied". Never the message. */
  code: "identifier",
  /** An entity type such as "attempt". Never an entity's content. */
  entityType: "identifier",
  /** A blueprint cell id. Public structure, not learner data. */
  cellId: "identifier",
  /** An import batch id, so a failing batch can be found. */
  batchId: "identifier",
  /** How many items were affected. */
  count: "number",
  /** How many attempts a retry took. */
  attempt: "number",
  /** Latency bucket, not a raw millisecond figure. */
  latencyBucket: "identifier",
  /** Whether the operation eventually succeeded. */
  recovered: "boolean",
  /** Which stage of a multi-step operation failed. */
  stage: "identifier",
} as const;

export type AllowedDetailKey = keyof typeof ALLOWED_DETAIL_KEYS;

export interface OperationalEvent {
  kind: OperationalEventKind;
  /** A hash or an opaque id, never an email or a name. */
  actorRef: string | null;
  details: Partial<Record<AllowedDetailKey, string | number | boolean>>;
}

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

/**
 * Drops everything not on the allow-list, and everything on it whose value is
 * the wrong shape. A value that would need trimming is dropped rather than
 * truncated: a truncated sentence is still a sentence.
 */
export function redactForMonitoring(
  details: Record<string, unknown>,
): Partial<Record<AllowedDetailKey, string | number | boolean>> {
  const safe: Partial<Record<AllowedDetailKey, string | number | boolean>> = {};

  for (const [key, expected] of Object.entries(ALLOWED_DETAIL_KEYS) as [AllowedDetailKey, string][]) {
    if (!(key in details)) continue;
    const value = details[key];

    if (expected === "identifier") {
      if (typeof value === "string" && IDENTIFIER.test(value)) safe[key] = value;
      continue;
    }
    if (expected === "number") {
      if (typeof value === "number" && Number.isFinite(value)) safe[key] = Math.trunc(value);
      continue;
    }
    if (expected === "boolean" && typeof value === "boolean") safe[key] = value;
  }

  return safe;
}

/**
 * Buckets a duration. A raw millisecond figure alongside a user reference is a
 * timing fingerprint; a bucket answers "is submission slow?" without being one.
 */
export function latencyBucket(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "unknown";
  if (milliseconds < 250) return "under-250ms";
  if (milliseconds < 1_000) return "250ms-1s";
  if (milliseconds < 3_000) return "1s-3s";
  if (milliseconds < 10_000) return "3s-10s";
  return "over-10s";
}

/**
 * A stable, non-reversible reference to an actor.
 *
 * Enough to see that one account is failing repeatedly, not enough to identify
 * whose. The salt is the deployment's project id, which is not a secret but does
 * mean references cannot be compared across deployments.
 */
export function actorRef(uid: string, salt: string): string {
  let hash = 0x811c9dc5;
  for (const character of `${salt}:${uid}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `actor-${hash.toString(16).padStart(8, "0")}`;
}

export interface MonitoringSink {
  (event: { kind: OperationalEventKind; actorRef: string | null; details: Record<string, unknown> }): void;
}

/**
 * Records one event. Redaction happens here rather than at the call sites, so a
 * caller cannot forget it: whatever is passed in, only allow-listed keys leave.
 */
export function recordOperationalEvent(
  kind: OperationalEventKind,
  input: { actorRef?: string | null; details?: Record<string, unknown> },
  emit: MonitoringSink,
): OperationalEvent {
  const event: OperationalEvent = {
    kind,
    actorRef: typeof input.actorRef === "string" && IDENTIFIER.test(input.actorRef) ? input.actorRef : null,
    details: redactForMonitoring(input.details ?? {}),
  };
  emit(event);
  return event;
}
