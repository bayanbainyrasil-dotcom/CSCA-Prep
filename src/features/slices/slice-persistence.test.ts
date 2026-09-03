import { describe, expect, it } from 'vitest';
import { parseSyncEntity, SliceProgressSchema, SyncEntityTypeSchema } from '@/domain';
import rawRules from '../../../firestore.rules?raw';
import adapterSource from '@/lib/persistence/firebaseAdapter.ts?raw';
import { normalizeLineEndings } from '@/lib/security/normalize-line-endings';
import { completeStage, emptySliceProgress, mergeSliceProgress, sliceProgressId } from './slice-progress';

/**
 * The stored side of slice progress: that the shape the engine produces is the
 * shape the schema accepts, that a crafted record cannot claim a skipped or
 * duplicated stage, and that the record travels the same versioned sync path as
 * every other piece of learner progress rather than a new one.
 */

const BASE = { userId: 'learner-1', cellId: 'math-linear-isolate-unknown', lessonId: 'lesson-math-linear-isolate-unknown' };
const NOW = '2026-09-03T09:00:00.000Z';

function withStages(count: number) {
  let progress = emptySliceProgress({ ...BASE, now: NOW });
  const stages = ['lesson', 'guided', 'independent', 'timed'] as const;
  for (let index = 0; index < count; index += 1) {
    progress = completeStage(progress, {
      stage: stages[index]!,
      answered: 3,
      correct: 2,
      durationSeconds: 60,
      now: `2026-09-03T1${index}:00:00.000Z`,
    }).progress;
  }
  return progress;
}

describe('what the engine produces is what the schema stores', () => {
  it('accepts an empty slice and every partially finished one', () => {
    for (let count = 0; count <= 4; count += 1) {
      const parsed = SliceProgressSchema.safeParse(withStages(count));
      expect(parsed.success, `${count} stages`).toBe(true);
    }
  });

  it('round-trips through the sync entity parser under its own entity type', () => {
    expect(SyncEntityTypeSchema.options).toContain('slice-progress');
    const progress = withStages(2);
    expect(parseSyncEntity('slice-progress', progress)).toEqual(progress);
  });
});

describe('a crafted record is refused', () => {
  it('refuses a skipped stage', () => {
    const forged = { ...withStages(1), stages: [{ stage: 'timed', completedAt: NOW, answered: 4, correct: 4, durationSeconds: 300 }] };
    const parsed = SliceProgressSchema.safeParse(forged);
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed)).toMatch(/in order, with none skipped/);
  });

  it('refuses the same stage twice', () => {
    const record = { stage: 'lesson', completedAt: NOW, answered: 0, correct: 0, durationSeconds: 10 };
    const parsed = SliceProgressSchema.safeParse({ ...withStages(1), stages: [record, record] });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed)).toMatch(/cannot be completed twice/);
  });

  it('refuses more correct answers than answers', () => {
    const forged = { ...withStages(1), stages: [{ stage: 'lesson', completedAt: NOW, answered: 2, correct: 5, durationSeconds: 10 }] };
    expect(SliceProgressSchema.safeParse(forged).success).toBe(false);
  });

  it('refuses an unknown field, so nothing can smuggle a claim of verification', () => {
    for (const forged of [{ verified: true }, { reviewer: 'someone' }, { mastery: 100 }]) {
      expect(SliceProgressSchema.safeParse({ ...withStages(1), ...forged }).success, JSON.stringify(forged)).toBe(false);
    }
  });

  it('refuses more stages than the path has', () => {
    const stages = [...withStages(4).stages, { stage: 'lesson', completedAt: NOW, answered: 0, correct: 0, durationSeconds: 1 }];
    expect(SliceProgressSchema.safeParse({ ...withStages(4), stages }).success).toBe(false);
  });
});

describe('it travels the existing sync path, not a new one', () => {
  const rules = normalizeLineEndings(rawRules);

  it('maps to one collection under the learner’s own subtree', () => {
    expect(adapterSource).toContain('"slice-progress": "sliceProgress"');
    expect(adapterSource).toContain('doc(firestore, "users", ownerId, collectionName, incoming.entityId)');
  });

  it('is a mutable sync collection, subject to the same versioned envelope', () => {
    expect(rules).toContain("'sliceProgress',");
    const mutable = rules.slice(rules.indexOf('function isMutableSyncCollection'), rules.indexOf('function isAppendOnlyCollection'));
    expect(mutable).toContain("'sliceProgress'");
  });

  it('is not tombstonable, so a finished stage cannot be deleted away', () => {
    const tombstone = rules.slice(rules.indexOf('function mayTombstone'));
    expect(tombstone.slice(0, 200)).not.toContain('sliceProgress');
  });
});

describe('two learners and one device', () => {
  it('write to different documents', () => {
    expect(sliceProgressId('learner-1', BASE.cellId)).not.toBe(sliceProgressId('learner-2', BASE.cellId));
  });

  it('keep their own owner on the record after a merge', () => {
    const mine = withStages(2);
    const laterCopyOfMine = { ...mine, updatedAt: '2026-09-04T00:00:00.000Z' };
    const merged = mergeSliceProgress(mine, laterCopyOfMine);
    expect(merged.userId).toBe('learner-1');
    expect(SliceProgressSchema.safeParse(merged).success).toBe(true);
  });

  it('produces a merge the schema still accepts, whichever side wins', () => {
    const offline = withStages(3);
    const server = withStages(1);
    for (const merged of [mergeSliceProgress(offline, server), mergeSliceProgress(server, offline)]) {
      expect(SliceProgressSchema.safeParse(merged).success).toBe(true);
      expect(merged.stages).toHaveLength(3);
    }
  });
});
