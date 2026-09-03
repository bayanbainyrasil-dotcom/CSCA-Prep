import { describe, expect, it, vi } from 'vitest';
import {
  actorRef,
  latencyBucket,
  recordOperationalEvent,
  redactForMonitoring,
  ALLOWED_DETAIL_KEYS,
  type OperationalEventKind,
} from '../../../functions/src/monitoring';

/**
 * Monitoring has to be useful and quiet at the same time. These tests are mostly
 * about the quiet half: what must never reach an operational log.
 */

/** Things that must never be recorded, whatever key they arrive under. */
const LEARNER_DATA = {
  question: 'Solve 3x + 7 = 22 for x.',
  correctAnswer: 'a',
  solution: 'Subtract 7 from both sides to get 3x = 15.',
  shortSolution: 'x = 5.',
  note: 'I keep forgetting to flip the sign',
  email: 'learner@example.test',
  name: 'A Learner',
  uid: 'learner-1',
  searchQuery: 'why did I get this wrong',
  message: 'Error: expected 42 but the learner answered 17',
  learnerAttempt: 'I moved the 7 across',
  ipAddress: '203.0.113.9',
};

describe('redaction keeps only what is on the allow-list', () => {
  it('drops every key that is not allowed, however innocent it looks', () => {
    const safe = redactForMonitoring({ ...LEARNER_DATA, operation: 'startMockExam' });

    expect(safe).toEqual({ operation: 'startMockExam' });
    for (const key of Object.keys(LEARNER_DATA)) {
      expect(safe, key).not.toHaveProperty(key);
    }
  });

  it('leaks nothing when handed learner data alone', () => {
    expect(redactForMonitoring(LEARNER_DATA)).toEqual({});
    expect(JSON.stringify(redactForMonitoring(LEARNER_DATA))).toBe('{}');
  });

  it('keeps each allowed key only in the shape it is declared as', () => {
    const safe = redactForMonitoring({
      operation: 'submitMockExam',
      code: 'aborted',
      count: 3.7,
      recovered: true,
      attempt: 'three',
      stage: 42,
      latencyBucket: false,
    });

    expect(safe).toEqual({ operation: 'submitMockExam', code: 'aborted', count: 3, recovered: true });
  });

  it('drops a value that would need trimming rather than truncating it', () => {
    const safe = redactForMonitoring({ operation: 'a sentence with spaces in it', code: 'x'.repeat(200) });
    expect(safe).toEqual({});
  });

  it('declares every allowed key with a shape, so none is unchecked', () => {
    for (const [key, shape] of Object.entries(ALLOWED_DETAIL_KEYS)) {
      expect(['identifier', 'number', 'boolean'], key).toContain(shape);
    }
    expect(Object.keys(ALLOWED_DETAIL_KEYS).length).toBeGreaterThan(5);
  });

  it('has no allow-listed key that could plausibly hold free text', () => {
    for (const key of Object.keys(ALLOWED_DETAIL_KEYS)) {
      expect(key, key).not.toMatch(/message|text|body|note|query|prompt|answer|solution|reason/i);
    }
  });
});

describe('the actor reference', () => {
  it('is stable, so repeated failures by one account are visible', () => {
    expect(actorRef('learner-1', 'project')).toBe(actorRef('learner-1', 'project'));
  });

  it('does not contain the uid it was made from', () => {
    const reference = actorRef('learner-1', 'project');
    expect(reference).not.toContain('learner-1');
    expect(reference).toMatch(/^actor-[0-9a-f]{8}$/);
  });

  it('differs between accounts and between deployments', () => {
    expect(actorRef('learner-1', 'project')).not.toBe(actorRef('learner-2', 'project'));
    expect(actorRef('learner-1', 'project-a')).not.toBe(actorRef('learner-1', 'project-b'));
  });
});

describe('latency is bucketed, not measured', () => {
  it('answers "is it slow" without being a timing fingerprint', () => {
    expect(latencyBucket(10)).toBe('under-250ms');
    expect(latencyBucket(500)).toBe('250ms-1s');
    expect(latencyBucket(2_000)).toBe('1s-3s');
    expect(latencyBucket(5_000)).toBe('3s-10s');
    expect(latencyBucket(30_000)).toBe('over-10s');
  });

  it('never returns a raw figure, and copes with nonsense', () => {
    for (const value of [0, 1, 999_999, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(String(latencyBucket(value)), String(value)).not.toMatch(/^\d+$/);
    }
    expect(latencyBucket(-1)).toBe('unknown');
    expect(latencyBucket(Number.NaN)).toBe('unknown');
  });
});

describe('recording an event', () => {
  const KINDS: OperationalEventKind[] = [
    'callable-error',
    'sync-failure',
    'import-conflict',
    'account-deletion-failure',
    'mock-submission',
  ];

  it('covers each thing the audit asked to be monitored', () => {
    for (const kind of KINDS) {
      const emit = vi.fn();
      recordOperationalEvent(kind, { details: { operation: 'x' } }, emit);
      expect(emit, kind).toHaveBeenCalledWith(expect.objectContaining({ kind }));
    }
  });

  it('redacts at the recorder, so a call site cannot forget to', () => {
    const emit = vi.fn();
    recordOperationalEvent('callable-error', { details: { ...LEARNER_DATA, code: 'internal' } }, emit);

    const [event] = emit.mock.calls[0] as [{ details: Record<string, unknown> }];
    expect(event.details).toEqual({ code: 'internal' });
    expect(JSON.stringify(event)).not.toContain('learner@example.test');
    expect(JSON.stringify(event)).not.toContain('Solve 3x');
  });

  it('refuses an actor reference that is not one', () => {
    const emit = vi.fn();
    recordOperationalEvent('sync-failure', { actorRef: 'learner@example.test', details: {} }, emit);
    const [event] = emit.mock.calls[0] as [{ actorRef: string | null }];
    expect(event.actorRef).toBeNull();
  });

  it('records nothing at all when given nothing', () => {
    const emit = vi.fn();
    const event = recordOperationalEvent('mock-submission', {}, emit);
    expect(event).toEqual({ kind: 'mock-submission', actorRef: null, details: {} });
  });
});

describe('the module itself stays dependency-free', () => {
  it('imports nothing, so it cannot reach a database or a network', async () => {
    const source = String((await import('../../../functions/src/monitoring?raw')).default);
    expect([...source.matchAll(/(?:^|\n)import\s/g)]).toEqual([]);
    expect(source).not.toContain('firebase');
    expect(source).not.toContain('db.collection');
  });
});
