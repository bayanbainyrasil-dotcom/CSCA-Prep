/**
 * Progress through one teaching slice.
 *
 * A slice is the path a learner takes through a single blueprint cell: read the
 * lesson, work through guided practice, answer independently, then a short timed
 * set. This module owns the rules of that path and nothing else — no storage, no
 * React, no clock it does not receive — so the rules can be tested directly.
 *
 * Three properties matter more than the rest, and each has a test:
 *
 * - A stage cannot be skipped. Progress is a prefix of the sequence.
 * - Completing a stage twice is the same as completing it once. A retried
 *   request, a double tap or a replayed offline mutation must not advance the
 *   path twice or count an attempt twice.
 * - Nothing reveals a solution before the learner has answered.
 */

export const SLICE_STAGES = ['lesson', 'guided', 'independent', 'timed'] as const;
export type SliceStage = (typeof SLICE_STAGES)[number];

export interface SliceStageRecord {
  stage: SliceStage;
  completedAt: string;
  /** Items answered in this stage. Zero for the lesson. */
  answered: number;
  correct: number;
  /** Seconds the learner spent. Server- or client-measured; not trusted for grading. */
  durationSeconds: number;
}

export interface SliceProgress {
  /** `slice-progress:<userId>:<cellId>`, which is what keeps learners apart. */
  id: string;
  userId: string;
  cellId: string;
  lessonId: string;
  stages: SliceStageRecord[];
  startedAt: string;
  updatedAt: string;
  version: number;
}

/** The storage key. Two learners on one device cannot collide. */
export function sliceProgressId(userId: string, cellId: string): string {
  return `slice-progress:${userId}:${cellId}`;
}

export function emptySliceProgress(input: {
  userId: string;
  cellId: string;
  lessonId: string;
  now: string;
}): SliceProgress {
  return {
    id: sliceProgressId(input.userId, input.cellId),
    userId: input.userId,
    cellId: input.cellId,
    lessonId: input.lessonId,
    stages: [],
    startedAt: input.now,
    updatedAt: input.now,
    version: 1,
  };
}

export function completedStages(progress: SliceProgress | null | undefined): Set<SliceStage> {
  return new Set((progress?.stages ?? []).map((record) => record.stage));
}

/**
 * The stage to open now. After a reload this is what puts the learner back where
 * they were, and once every stage is done it is `null` — the slice is finished.
 */
export function currentStage(progress: SliceProgress | null | undefined): SliceStage | null {
  const done = completedStages(progress);
  return SLICE_STAGES.find((stage) => !done.has(stage)) ?? null;
}

export function isSliceComplete(progress: SliceProgress | null | undefined): boolean {
  return currentStage(progress) === null;
}

/**
 * A learner may open the stage they are on, or any stage already finished — a
 * lesson stays readable. They may not jump ahead: reading the worked solutions
 * of the timed set before doing the practice would defeat the sequence.
 */
export function canEnterStage(progress: SliceProgress | null | undefined, stage: SliceStage): boolean {
  const done = completedStages(progress);
  if (done.has(stage)) return true;
  return currentStage(progress) === stage;
}

export interface StageCompletion {
  stage: SliceStage;
  answered: number;
  correct: number;
  durationSeconds: number;
  now: string;
}

export type CompletionOutcome =
  | { applied: true; progress: SliceProgress; reason: null }
  | { applied: false; progress: SliceProgress; reason: 'already-completed' | 'out-of-order' };

/**
 * Records a finished stage.
 *
 * Returns the unchanged progress when the stage is already done, so a replayed
 * mutation is a no-op rather than a second attempt, and when the stage is out of
 * order, so a crafted request cannot skip the path.
 */
export function completeStage(progress: SliceProgress, completion: StageCompletion): CompletionOutcome {
  if (completedStages(progress).has(completion.stage)) {
    return { applied: false, progress, reason: 'already-completed' };
  }
  if (currentStage(progress) !== completion.stage) {
    return { applied: false, progress, reason: 'out-of-order' };
  }

  const record: SliceStageRecord = {
    stage: completion.stage,
    completedAt: completion.now,
    answered: Math.max(0, Math.trunc(completion.answered)),
    correct: Math.max(0, Math.min(Math.trunc(completion.correct), Math.trunc(completion.answered))),
    durationSeconds: Math.max(0, Math.trunc(completion.durationSeconds)),
  };

  return {
    applied: true,
    reason: null,
    progress: {
      ...progress,
      stages: [...progress.stages, record],
      updatedAt: completion.now,
      version: progress.version + 1,
    },
  };
}

/**
 * Merges two copies of the same slice after an offline period.
 *
 * The union of completed stages is taken rather than the later version winning,
 * because a stage finished offline is finished. Order follows the sequence, not
 * the arrival time, so the result is the same whichever side is merged first.
 */
export function mergeSliceProgress(left: SliceProgress, right: SliceProgress): SliceProgress {
  if (left.id !== right.id) {
    throw new Error('Refusing to merge progress for two different slices.');
  }
  const byStage = new Map<SliceStage, SliceStageRecord>();
  for (const record of [...left.stages, ...right.stages]) {
    const existing = byStage.get(record.stage);
    // The earlier completion wins, so a replayed later copy cannot move the date.
    if (!existing || record.completedAt < existing.completedAt) byStage.set(record.stage, record);
  }
  const stages = SLICE_STAGES.filter((stage) => byStage.has(stage)).map((stage) => byStage.get(stage)!);
  const newer = left.updatedAt >= right.updatedAt ? left : right;
  return {
    ...newer,
    stages,
    startedAt: left.startedAt <= right.startedAt ? left.startedAt : right.startedAt,
    version: Math.max(left.version, right.version),
  };
}

// --- What a learner may see ------------------------------------------------

export type StageAnswerState = 'unanswered' | 'submitted';

/**
 * Whether the worked solution and the correct option may be shown.
 *
 * The lesson may show its own worked example freely — that is teaching, not an
 * answer to a question the learner is being asked. Guided practice offers hints
 * and never the answer, however many hints have been taken. Independent practice
 * and the timed set reveal only after a submission.
 */
export function mayRevealSolution(stage: SliceStage, answer: StageAnswerState): boolean {
  if (stage === 'lesson') return true;
  if (stage === 'guided') return false;
  return answer === 'submitted';
}

/**
 * The hints available in guided practice, revealed one at a time. Asking for a
 * hint beyond the last one returns the last one rather than the answer.
 */
export function hintsShown(hints: readonly string[], taken: number): string[] {
  return hints.slice(0, Math.max(0, Math.min(Math.trunc(taken), hints.length)));
}

// --- Reporting --------------------------------------------------------------

export interface SliceSummary {
  cellId: string;
  lessonId: string;
  stagesDone: number;
  stagesTotal: number;
  percent: number;
  current: SliceStage | null;
  answered: number;
  correct: number;
  /** Never a mastery claim: it is what the learner did, not what they know. */
  accuracy: number | null;
}

export function summariseSlice(progress: SliceProgress | null | undefined, fallback: { cellId: string; lessonId: string }): SliceSummary {
  const stages = progress?.stages ?? [];
  const answered = stages.reduce((total, record) => total + record.answered, 0);
  const correct = stages.reduce((total, record) => total + record.correct, 0);
  return {
    cellId: progress?.cellId ?? fallback.cellId,
    lessonId: progress?.lessonId ?? fallback.lessonId,
    stagesDone: stages.length,
    stagesTotal: SLICE_STAGES.length,
    percent: Math.round((stages.length / SLICE_STAGES.length) * 100),
    current: currentStage(progress),
    answered,
    correct,
    accuracy: answered > 0 ? correct / answered : null,
  };
}
