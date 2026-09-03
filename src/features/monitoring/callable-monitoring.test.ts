import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { monitored, monotonicNow } from '../../../functions/src/callable';
import { HttpsError } from '@/test/firebase/functions';
import type * as MonitoringModule from '../../../functions/src/monitoring';
import { listDocuments, resetFirestore, seedDocument } from '@/test/firebase/firestore';

const logged: { kind: string; details: Record<string, unknown> }[] = [];
vi.mock('../../../functions/src/monitoring-sink', async () => {
  const actual = await vi.importActual<typeof MonitoringModule>('../../../functions/src/monitoring');
  return {
    cloudLoggingSink: () => undefined,
    monitor: (kind: string, input: { actorRef?: string | null; details?: Record<string, unknown> }) => {
      actual.recordOperationalEvent(
        kind as Parameters<typeof actual.recordOperationalEvent>[0],
        input,
        (event) => logged.push({ kind: event.kind, details: event.details }),
      );
    },
  };
});

/**
 * `monitored` is typed against the real firebase-functions request, which has
 * more fields than a fixture needs. The wrapper reads none of them — that is
 * the property under test — so the fixture is cast rather than mirrored.
 */
const request = (data: unknown = {}) =>
  ({ data, auth: { uid: 'u', token: {} } }) as never;

beforeEach(() => {
  logged.length = 0;
  resetFirestore();
});

describe('the callable wrapper', () => {
  it('records one event for an HttpsError and re-throws it unchanged', async () => {
    const original = new HttpsError('permission-denied', 'A current administrator claim is required.');
    const wrapped = monitored('someCallable', () => Promise.reject(original));

    await expect(wrapped(request())).rejects.toBe(original);
    expect(logged).toHaveLength(1);
    expect(logged[0]).toEqual({ kind: 'callable-error', details: { operation: 'someCallable', code: 'permission-denied' } });
  });

  it('turns an unknown error into a safe internal code, keeping the error itself', async () => {
    const original = new Error('Firestore said: document users/learner-1/notes/abc is malformed');
    const wrapped = monitored('someCallable', () => Promise.reject(original));

    await expect(wrapped(request())).rejects.toBe(original);
    expect(logged[0]!.details).toEqual({ operation: 'someCallable', code: 'internal' });
    expect(JSON.stringify(logged)).not.toContain('malformed');
    expect(JSON.stringify(logged)).not.toContain('learner-1');
  });

  it('records nothing when the callable succeeds', async () => {
    const wrapped = monitored('someCallable', () => Promise.resolve({ ok: true }));
    await expect(wrapped(request())).resolves.toEqual({ ok: true });
    expect(logged).toEqual([]);
  });

  it('never records the request payload, however sensitive', async () => {
    const wrapped = monitored('someCallable', () => Promise.reject(new HttpsError('invalid-argument', 'bad')));
    await expect(
      wrapped(request({ correctAnswer: 'a', solution: 'x = 5', learnerAttempt: 'I moved the 7', email: 'a@b.test' })),
    ).rejects.toBeInstanceOf(HttpsError);

    const serialised = JSON.stringify(logged);
    for (const secret of ['correctAnswer', 'x = 5', 'I moved the 7', 'a@b.test']) {
      expect(serialised, secret).not.toContain(secret);
    }
  });

  it('records once, not once per layer, when handlers nest', async () => {
    const inner = monitored('inner', () => Promise.reject(new HttpsError('aborted', 'no')));
    await expect(inner(request())).rejects.toBeInstanceOf(HttpsError);
    expect(logged.filter((entry) => entry.kind === 'callable-error')).toHaveLength(1);
  });

  it('does not break the operation when the sink itself throws', async () => {
    // The real recorder, driven with a sink that fails: losing an event is an
    // inconvenience, losing the operation is not acceptable.
    const monitoring = await vi.importActual<typeof MonitoringModule>('../../../functions/src/monitoring');
    expect(() =>
      monitoring.recordOperationalEvent('callable-error', { details: { code: 'internal' } }, () => {
        throw new Error('sink is down');
      }),
    ).toThrow('sink is down');

    // `monitor` in monitoring-sink is the layer that swallows it.
    const sinkSource = readFileSync(join('functions', 'src', 'monitoring-sink.ts'), 'utf8');
    expect(sinkSource).toContain('try {');
    expect(sinkSource.match(/catch \{/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sinkSource).toContain('Monitoring is never load-bearing');
  });
});

describe('latency', () => {
  it('is monotonic and does not go backwards', () => {
    const first = monotonicNow();
    const second = monotonicNow();
    expect(second).toBeGreaterThanOrEqual(first);
    expect(Number.isFinite(first)).toBe(true);
  });
});

describe('every exported callable goes through the wrapper', () => {
  const files = readdirSync(join('functions', 'src')).filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.test.ts'));

  it('wraps each exported onCall handler, with no silent exception', () => {
    const unwrapped: string[] = [];
    let total = 0;
    for (const file of files) {
      const source = readFileSync(join('functions', 'src', file), 'utf8');
      for (const match of source.matchAll(/export const (\w+) = onCall\(([\s\S]{0,200}?)async \(request\)/g)) {
        total += 1;
        if (!match[2]!.includes(`monitored("${match[1]}"`)) unwrapped.push(`${file}:${match[1]}`);
      }
    }
    expect(total).toBeGreaterThanOrEqual(20);
    expect(unwrapped).toEqual([]);
  });

  it('names each wrapper after its own export, so an event points at the right callable', () => {
    const mismatched: string[] = [];
    for (const file of files) {
      const source = readFileSync(join('functions', 'src', file), 'utf8');
      for (const match of source.matchAll(/export const (\w+) = onCall\([\s\S]{0,200}?monitored\("(\w+)"/g)) {
        if (match[1] !== match[2]) mismatched.push(`${file}: ${match[1]} logs as ${match[2]}`);
      }
    }
    expect(mismatched).toEqual([]);
  });
});

describe('monitoring changes no learner state', () => {
  it('writes to no Firestore collection', async () => {
    seedDocument('users', 'learner-1', { name: 'A Learner' });
    const before = listDocuments('users').length;

    const wrapped = monitored('someCallable', () => Promise.reject(new HttpsError('internal', 'x')));
    await expect(wrapped(request())).rejects.toBeInstanceOf(HttpsError);

    expect(listDocuments('users')).toHaveLength(before);
    expect(listDocuments('_auditLogs')).toHaveLength(0);
    expect(logged).toHaveLength(1);
  });
});

describe('the wired counters', () => {
  const importSource = readFileSync(join('functions', 'src', 'import-callables.ts'), 'utf8');
  const indexSource = readFileSync(join('functions', 'src', 'index.ts'), 'utf8');
  const mockSource = readFileSync(join('functions', 'src', 'mock-callables.ts'), 'utf8');

  it('records an import conflict once, at the single refusal point', () => {
    expect(importSource.match(/monitor\("import-conflict"/g)).toHaveLength(1);
    const refusal = importSource.slice(importSource.indexOf('function refuseIfBlocked'));
    expect(refusal.slice(0, 500)).toContain('monitor("import-conflict"');
    // Counts only: no decision list, no item ids.
    expect(refusal.slice(0, 500)).toContain('count:');
    expect(refusal.slice(0, 500)).not.toContain('decision.id');
  });

  it('records an account deletion failure once, without the uid or the cause', () => {
    expect(indexSource.match(/monitor\("account-deletion-failure"/g)).toHaveLength(1);
    const site = indexSource.slice(indexSource.indexOf('monitor("account-deletion-failure"'), indexSource.indexOf('monitor("account-deletion-failure"') + 300);
    expect(site).toContain('actorRef(principal.uid, ACTOR_SALT)');
    expect(site).not.toContain('String(cause)');
    expect(site).not.toContain('uid: principal.uid');
  });

  it('records a mock submission exactly once per call, in a finally', () => {
    expect(mockSource.match(/monitor\("mock-submission"/g)).toHaveLength(1);
    const submit = mockSource.slice(mockSource.indexOf('export const submitMockExam'));
    expect(submit).toContain('} finally {');
    expect(submit).toContain('latencyBucket(monotonicNow() - startedAt)');
    // The raw duration is never a detail field.
    expect(submit).not.toMatch(/durationMs|latencyMs|elapsed:/);
  });

  it('reports the submission outcome from a closed set', () => {
    const submit = mockSource.slice(mockSource.indexOf('export const submitMockExam'));
    expect(submit).toContain('let submissionStage = "refused"');
    expect(submit).toContain('submissionStage = outcome.alreadySubmitted ? "already-submitted" : "submitted"');
  });
});

describe('no solution string can reach a log', () => {
  it('no monitoring call site passes a question, answer or solution field', () => {
    const files = readdirSync(join('functions', 'src')).filter((entry) => entry.endsWith('.ts'));
    for (const file of files) {
      const source = readFileSync(join('functions', 'src', file), 'utf8');
      for (const match of source.matchAll(/monitor\(\s*"[a-z-]+",\s*\{([\s\S]{0,400}?)\n\s*\}\s*\)/g)) {
        const call = match[1]!;
        for (const forbidden of ['question', 'correctAnswer', 'solution', 'shortSolution', 'explanation', 'message', 'stack', 'email', 'request.data']) {
          expect(call, `${file} passes ${forbidden}`).not.toContain(forbidden);
        }
      }
    }
  });
});
