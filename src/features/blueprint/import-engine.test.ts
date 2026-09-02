import { describe, expect, it } from 'vitest';
import {
  auditDetailsFor,
  classifyImport,
  contentHash,
  stableStringify,
  summariseImport,
  writableDecisions,
  type ImportDecision,
} from '../../../functions/src/import-engine';

describe('stable serialisation and hashing', () => {
  it('ignores key order', () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
    expect(contentHash({ a: 1, b: [1, 2] })).toBe(contentHash({ b: [1, 2], a: 1 }));
  });

  it('respects array order and value changes', () => {
    expect(contentHash([1, 2])).not.toBe(contentHash([2, 1]));
    expect(contentHash({ a: 1 })).not.toBe(contentHash({ a: 2 }));
    expect(contentHash({ a: 'x' })).not.toBe(contentHash({ a: 'y' }));
  });

  it('drops undefined so an absent field and an undefined field agree', () => {
    expect(contentHash({ a: 1, b: undefined })).toBe(contentHash({ a: 1 }));
  });

  it('is stable across runs', () => {
    const value = { question: 'Solve x + 9 = 4.', options: ['a', 'b'], difficulty: 1 };
    const runs = new Set(Array.from({ length: 100 }, () => contentHash(value)));
    expect(runs.size).toBe(1);
  });
});

describe('classifyImport', () => {
  const payload = { question: 'Solve x + 9 = 4.' };

  it('creates when nothing exists', () => {
    const decision = classifyImport({ id: 'q1', payload, existing: null });
    expect(decision.outcome).toBe('create');
    expect(decision.nextVersion).toBe(1);
  });

  it('is a no-op when the stored content is identical', () => {
    const hash = contentHash(payload);
    const decision = classifyImport({ id: 'q1', payload, existing: { version: 3, contentHash: hash } });
    expect(decision.outcome).toBe('unchanged');
    expect(decision.nextVersion).toBe(3);
    expect(writableDecisions([decision])).toEqual([]);
  });

  it('updates when the content changed and the version matches', () => {
    const decision = classifyImport({
      id: 'q1',
      payload,
      existing: { version: 3, contentHash: 'something-else' },
      expectedVersion: 3,
    });
    expect(decision.outcome).toBe('update');
    expect(decision.nextVersion).toBe(4);
  });

  it('refuses to overwrite a record that moved on', () => {
    const decision = classifyImport({
      id: 'q1',
      payload,
      existing: { version: 5, contentHash: 'something-else' },
      expectedVersion: 3,
    });
    expect(decision.outcome).toBe('conflict');
    expect(decision.reason).toMatch(/stored version is 5/);
    expect(decision.nextVersion).toBeNull();
  });

  it('refuses when the caller expected a record that does not exist', () => {
    expect(classifyImport({ id: 'q1', payload, existing: null, expectedVersion: 2 }).outcome).toBe('conflict');
  });

  it('updates without an expected version, but never silently on a conflict', () => {
    expect(
      classifyImport({ id: 'q1', payload, existing: { version: 9, contentHash: 'other' } }).outcome,
    ).toBe('update');
  });

  it('re-running the same batch changes nothing the second time', () => {
    const first = classifyImport({ id: 'q1', payload, existing: null });
    const stored = { version: first.nextVersion!, contentHash: first.contentHash };
    const second = classifyImport({ id: 'q1', payload, existing: stored });
    expect(second.outcome).toBe('unchanged');
    const third = classifyImport({ id: 'q1', payload, existing: stored });
    expect(third.outcome).toBe('unchanged');
  });
});

describe('summary and audit', () => {
  const decisions: ImportDecision[] = [
    { id: 'a', outcome: 'create', reason: '', contentHash: 'h1', existingVersion: null, nextVersion: 1 },
    { id: 'b', outcome: 'unchanged', reason: '', contentHash: 'h2', existingVersion: 2, nextVersion: 2 },
    { id: 'c', outcome: 'conflict', reason: 'moved on', contentHash: 'h3', existingVersion: 4, nextVersion: null },
  ];

  it('counts every outcome and blocks the batch on a conflict', () => {
    const summary = summariseImport(decisions);
    expect(summary).toMatchObject({ create: 1, unchanged: 1, conflict: 1, update: 0, invalid: 0, total: 3 });
    expect(summary.blocked).toBe(true);
  });

  it('does not block a clean batch', () => {
    expect(summariseImport(decisions.slice(0, 2)).blocked).toBe(false);
  });

  it('writes only creates and updates', () => {
    expect(writableDecisions(decisions).map((decision) => decision.id)).toEqual(['a']);
  });

  it('records what happened without recording any content', () => {
    const details = auditDetailsFor('batch-1', 'seed-1', decisions);
    const serialised = JSON.stringify(details);
    expect(details).toMatchObject({ batchId: 'batch-1', seedVersion: 'seed-1', create: 1, conflict: 1 });
    expect(details.conflicts).toEqual(['c']);
    for (const forbidden of ['question', 'correctAnswer', 'solution', 'explanation', 'answer']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});
