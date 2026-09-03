import { describe, expect, it } from 'vitest';
import {
  canEnterStage,
  completeStage,
  currentStage,
  emptySliceProgress,
  hintsShown,
  isSliceComplete,
  mayRevealSolution,
  mergeSliceProgress,
  sliceProgressId,
  summariseSlice,
  SLICE_STAGES,
  type SliceProgress,
  type SliceStage,
} from './slice-progress';

const BASE = { userId: 'learner-1', cellId: 'math-linear-isolate-unknown', lessonId: 'lesson-math-linear-isolate-unknown' };

function fresh(now = '2026-09-03T09:00:00.000Z'): SliceProgress {
  return emptySliceProgress({ ...BASE, now });
}

function finish(progress: SliceProgress, stage: SliceStage, now: string, answered = 3, correct = 2): SliceProgress {
  const outcome = completeStage(progress, { stage, answered, correct, durationSeconds: 60, now });
  expect(outcome.applied, `${stage} should apply`).toBe(true);
  return outcome.progress;
}

describe('the path runs in one order', () => {
  it('starts at the lesson', () => {
    expect(currentStage(fresh())).toBe('lesson');
    expect(currentStage(null)).toBe('lesson');
    expect(SLICE_STAGES).toEqual(['lesson', 'guided', 'independent', 'timed']);
  });

  it('advances one stage at a time and then finishes', () => {
    let progress = fresh();
    const seen: (SliceStage | null)[] = [currentStage(progress)];
    for (const stage of SLICE_STAGES) {
      progress = finish(progress, stage, `2026-09-03T10:0${SLICE_STAGES.indexOf(stage)}:00.000Z`);
      seen.push(currentStage(progress));
    }
    expect(seen).toEqual(['lesson', 'guided', 'independent', 'timed', null]);
    expect(isSliceComplete(progress)).toBe(true);
  });

  it('refuses a stage out of order and changes nothing', () => {
    const progress = fresh();
    const outcome = completeStage(progress, { stage: 'timed', answered: 4, correct: 4, durationSeconds: 300, now: '2026-09-03T10:00:00.000Z' });

    expect(outcome.applied).toBe(false);
    expect(outcome.reason).toBe('out-of-order');
    expect(outcome.progress).toBe(progress);
    expect(currentStage(outcome.progress)).toBe('lesson');
  });

  it('opens the current stage and any finished one, never a later one', () => {
    const progress = finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);

    expect(canEnterStage(progress, 'lesson')).toBe(true);
    expect(canEnterStage(progress, 'guided')).toBe(true);
    expect(canEnterStage(progress, 'independent')).toBe(false);
    expect(canEnterStage(progress, 'timed')).toBe(false);
  });
});

describe('finishing a stage twice does nothing the second time', () => {
  it('is refused, with the progress returned unchanged', () => {
    const once = finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);
    const twice = completeStage(once, { stage: 'lesson', answered: 0, correct: 0, durationSeconds: 60, now: '2026-09-03T10:05:00.000Z' });

    expect(twice.applied).toBe(false);
    expect(twice.reason).toBe('already-completed');
    expect(twice.progress).toBe(once);
    expect(once.stages).toHaveLength(1);
    expect(once.version).toBe(2);
  });

  it('does not count the answers twice', () => {
    const once = finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);
    const guided = finish(once, 'guided', '2026-09-03T10:10:00.000Z', 3, 3);
    const replayed = completeStage(guided, { stage: 'guided', answered: 3, correct: 3, durationSeconds: 60, now: '2026-09-03T10:11:00.000Z' });

    expect(summariseSlice(replayed.progress, BASE).answered).toBe(3);
    expect(summariseSlice(replayed.progress, BASE).correct).toBe(3);
  });

  it('never records more correct than answered, however it is called', () => {
    const outcome = completeStage(fresh(), { stage: 'lesson', answered: 2, correct: 9, durationSeconds: -5, now: '2026-09-03T10:00:00.000Z' });
    expect(outcome.applied).toBe(true);
    expect(outcome.progress.stages[0]!.correct).toBe(2);
    expect(outcome.progress.stages[0]!.durationSeconds).toBe(0);
  });
});

describe('resuming after a reload', () => {
  it('returns the learner to the stage they had not finished', () => {
    let progress = fresh();
    progress = finish(progress, 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);
    progress = finish(progress, 'guided', '2026-09-03T10:10:00.000Z');

    // A reload rebuilds from the stored record alone.
    const restored: SliceProgress = JSON.parse(JSON.stringify(progress)) as SliceProgress;

    expect(currentStage(restored)).toBe('independent');
    expect(canEnterStage(restored, 'independent')).toBe(true);
    expect(summariseSlice(restored, BASE).percent).toBe(50);
  });

  it('reports a finished slice as finished after a reload', () => {
    let progress = fresh();
    for (const stage of SLICE_STAGES) progress = finish(progress, stage, `2026-09-03T1${SLICE_STAGES.indexOf(stage)}:00:00.000Z`);
    const restored: SliceProgress = JSON.parse(JSON.stringify(progress)) as SliceProgress;

    expect(isSliceComplete(restored)).toBe(true);
    expect(summariseSlice(restored, BASE).percent).toBe(100);
    expect(summariseSlice(restored, BASE).current).toBeNull();
  });
});

describe('two learners never share progress', () => {
  it('keys the record on the learner and the cell together', () => {
    expect(sliceProgressId('learner-1', 'math-linear-isolate-unknown')).toBe('slice-progress:learner-1:math-linear-isolate-unknown');
    expect(sliceProgressId('learner-1', 'a')).not.toBe(sliceProgressId('learner-2', 'a'));
    expect(sliceProgressId('learner-1', 'a')).not.toBe(sliceProgressId('learner-1', 'b'));
  });

  it('carries the owner on the record itself, not only in the key', () => {
    const mine = fresh();
    const theirs = emptySliceProgress({ ...BASE, userId: 'learner-2', now: '2026-09-03T09:00:00.000Z' });
    expect(mine.userId).not.toBe(theirs.userId);
    expect(mine.id).not.toBe(theirs.id);
  });

  it('refuses to merge two different slices', () => {
    const mine = fresh();
    const theirs = emptySliceProgress({ ...BASE, userId: 'learner-2', now: '2026-09-03T09:00:00.000Z' });
    expect(() => mergeSliceProgress(mine, theirs)).toThrow(/two different slices/);
  });
});

describe('coming back online', () => {
  it('keeps a stage finished offline, and is the same whichever side merges first', () => {
    const start = fresh();
    const offline = finish(finish(start, 'lesson', '2026-09-03T10:00:00.000Z', 0, 0), 'guided', '2026-09-03T10:10:00.000Z');
    const server = finish(start, 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);

    const merged = mergeSliceProgress(offline, server);
    const reversed = mergeSliceProgress(server, offline);

    expect(merged.stages.map((record) => record.stage)).toEqual(['lesson', 'guided']);
    expect(reversed.stages.map((record) => record.stage)).toEqual(['lesson', 'guided']);
    expect(currentStage(merged)).toBe('independent');
  });

  it('is idempotent: merging the same copy again changes nothing', () => {
    const progress = finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);
    const once = mergeSliceProgress(progress, progress);
    const twice = mergeSliceProgress(once, progress);

    expect(twice.stages).toEqual(once.stages);
    expect(twice.stages).toHaveLength(1);
  });

  it('keeps the earlier completion time, so a replayed copy cannot move it', () => {
    const early = finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0);
    const late: SliceProgress = {
      ...early,
      stages: [{ ...early.stages[0]!, completedAt: '2026-09-04T10:00:00.000Z' }],
      updatedAt: '2026-09-04T10:00:00.000Z',
    };

    expect(mergeSliceProgress(early, late).stages[0]!.completedAt).toBe('2026-09-03T10:00:00.000Z');
    expect(mergeSliceProgress(late, early).stages[0]!.completedAt).toBe('2026-09-03T10:00:00.000Z');
  });
});

describe('nothing gives the answer away early', () => {
  it('never reveals in guided practice, however many hints were taken', () => {
    expect(mayRevealSolution('guided', 'unanswered')).toBe(false);
    expect(mayRevealSolution('guided', 'submitted')).toBe(false);
  });

  it('reveals in independent practice and the timed set only after a submission', () => {
    for (const stage of ['independent', 'timed'] as const) {
      expect(mayRevealSolution(stage, 'unanswered'), stage).toBe(false);
      expect(mayRevealSolution(stage, 'submitted'), stage).toBe(true);
    }
  });

  it('lets the lesson show its own worked example', () => {
    expect(mayRevealSolution('lesson', 'unanswered')).toBe(true);
  });

  it('hands out hints one at a time and never more than exist', () => {
    const hints = ['Name the operation.', 'Apply its inverse.', 'Check by substituting.'];
    expect(hintsShown(hints, 0)).toEqual([]);
    expect(hintsShown(hints, 1)).toEqual([hints[0]]);
    expect(hintsShown(hints, 2)).toEqual([hints[0], hints[1]]);
    expect(hintsShown(hints, 99)).toEqual(hints);
    expect(hintsShown(hints, -3)).toEqual([]);
  });
});

describe('the summary reports work done, not knowledge', () => {
  it('reports accuracy only once something has been answered', () => {
    expect(summariseSlice(null, BASE).accuracy).toBeNull();
    expect(summariseSlice(null, BASE).percent).toBe(0);
    expect(summariseSlice(null, BASE).current).toBe('lesson');

    const progress = finish(finish(fresh(), 'lesson', '2026-09-03T10:00:00.000Z', 0, 0), 'guided', '2026-09-03T10:10:00.000Z', 4, 3);
    expect(summariseSlice(progress, BASE).accuracy).toBe(0.75);
  });
});
