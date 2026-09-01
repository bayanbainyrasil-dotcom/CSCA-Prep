import {
  FormulaProgressSchema,
  VocabularyProgressSchema,
  type Confidence,
  type FormulaProgress,
  type VocabularyProgress,
} from '@/domain';
import { calculateReviewQuality, isReviewDue, scheduleNextReview } from '@/lib/adaptive';

/**
 * Persistent review state for the vocabulary and formula trainers.
 *
 * These trainers previously kept "mastered" in React state and displayed an
 * "Adaptive next interval" that no algorithm produced. Everything here runs
 * through the same SM-2-style scheduler the topic mastery uses, and the result
 * is a real entity that the local-first repository stores and syncs.
 */

export interface TrainerReview {
  isCorrect: boolean;
  confidence: Confidence;
  durationSeconds?: number;
  expectedSeconds?: number;
  hintUsed?: boolean;
}

const DEFAULT_EXPECTED_SECONDS = 20;

export const vocabularyProgressId = (userId: string, vocabularyId: string) =>
  `${userId}:vocab:${vocabularyId}`;

export const formulaProgressId = (userId: string, formulaId: string) =>
  `${userId}:formula:${formulaId}`;

export function createVocabularyProgress(
  userId: string,
  vocabularyId: string,
  now = new Date(),
): VocabularyProgress {
  const timestamp = now.toISOString();
  return VocabularyProgressSchema.parse({
    id: vocabularyProgressId(userId, vocabularyId),
    userId,
    vocabularyId,
    reviewStage: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    mastered: false,
    lastReviewedAt: null,
    nextReviewAt: timestamp,
    correctCount: 0,
    incorrectCount: 0,
    lastQuality: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** A word counts as mastered once it survives several correct reviews at a long interval. */
function isMastered(intervalDays: number, repetitions: number): boolean {
  return intervalDays >= 21 && repetitions >= 4;
}

export function applyVocabularyReview(
  progress: VocabularyProgress,
  review: TrainerReview,
  now = new Date(),
): VocabularyProgress {
  const response = {
    isCorrect: review.isCorrect,
    confidence: review.confidence,
    durationSeconds: review.durationSeconds ?? 0,
    expectedSeconds: review.expectedSeconds ?? DEFAULT_EXPECTED_SECONDS,
    ...(review.hintUsed === undefined ? {} : { hintUsed: review.hintUsed }),
  };
  const schedule = scheduleNextReview(
    {
      reviewStage: progress.reviewStage,
      easeFactor: progress.easeFactor,
      intervalDays: progress.intervalDays,
      repetitions: progress.repetitions,
      lapses: progress.lapses,
    },
    response,
    now,
  );
  const timestamp = now.toISOString();

  return VocabularyProgressSchema.parse({
    ...progress,
    reviewStage: schedule.reviewStage,
    easeFactor: schedule.easeFactor,
    intervalDays: schedule.intervalDays,
    repetitions: schedule.repetitions,
    lapses: schedule.lapses,
    mastered: isMastered(schedule.intervalDays, schedule.repetitions),
    lastReviewedAt: timestamp,
    nextReviewAt: schedule.nextReviewAt,
    correctCount: (progress.correctCount ?? 0) + (review.isCorrect ? 1 : 0),
    incorrectCount: (progress.incorrectCount ?? 0) + (review.isCorrect ? 0 : 1),
    lastQuality: schedule.quality,
    version: progress.version + 1,
    updatedAt: timestamp,
  });
}

export function createFormulaProgress(
  userId: string,
  formulaId: string,
  now = new Date(),
): FormulaProgress {
  const timestamp = now.toISOString();
  return FormulaProgressSchema.parse({
    id: formulaProgressId(userId, formulaId),
    userId,
    formulaId,
    score: 0,
    attempts: 0,
    lastReviewedAt: null,
    nextReviewAt: timestamp,
    intervalDays: 0,
    lapses: 0,
    correctCount: 0,
    incorrectCount: 0,
    lastQuality: null,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** Interval bands for formula retrieval, derived from the rolling score. */
export function formulaIntervalDays(score: number): number {
  if (score < 40) return 1;
  if (score < 60) return 2;
  if (score < 75) return 4;
  if (score < 90) return 7;
  return 14;
}

export function applyFormulaReview(
  progress: FormulaProgress,
  review: TrainerReview,
  now = new Date(),
): FormulaProgress {
  const quality = calculateReviewQuality({
    isCorrect: review.isCorrect,
    confidence: review.confidence,
    durationSeconds: review.durationSeconds ?? 0,
    expectedSeconds: review.expectedSeconds ?? DEFAULT_EXPECTED_SECONDS,
    ...(review.hintUsed === undefined ? {} : { hintUsed: review.hintUsed }),
  });

  // A rolling average, so one lucky recall does not read as mastery and one slip
  // does not erase weeks of work.
  const target = review.isCorrect ? (quality / 5) * 100 : 0;
  const score = Math.round(progress.score * 0.6 + target * 0.4);
  const intervalDays = formulaIntervalDays(score);
  const timestamp = now.toISOString();

  return FormulaProgressSchema.parse({
    ...progress,
    score,
    attempts: progress.attempts + 1,
    lastReviewedAt: timestamp,
    nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000).toISOString(),
    intervalDays,
    lapses: (progress.lapses ?? 0) + (review.isCorrect ? 0 : 1),
    correctCount: (progress.correctCount ?? 0) + (review.isCorrect ? 1 : 0),
    incorrectCount: (progress.incorrectCount ?? 0) + (review.isCorrect ? 0 : 1),
    lastQuality: quality,
    version: progress.version + 1,
    updatedAt: timestamp,
  });
}

export function isTrainerItemDue(
  progress: { nextReviewAt: string } | undefined,
  now = new Date(),
): boolean {
  if (!progress) return true;
  return isReviewDue(progress.nextReviewAt, now);
}

/** Counts items whose review is due, including items never reviewed. */
export function countDue(
  itemIds: string[],
  progressByItemId: Record<string, { nextReviewAt: string }>,
  now = new Date(),
): number {
  return itemIds.filter((id) => isTrainerItemDue(progressByItemId[id], now)).length;
}

/** Human-readable interval text, or an honest blank when nothing is scheduled. */
export function describeInterval(intervalDays: number | undefined): string | null {
  if (intervalDays === undefined || intervalDays <= 0) return null;
  if (intervalDays === 1) return 'Next review tomorrow';
  if (intervalDays < 30) return `Next review in ${Math.round(intervalDays)} days`;
  const months = Math.round(intervalDays / 30);
  return `Next review in ${months} ${months === 1 ? 'month' : 'months'}`;
}
