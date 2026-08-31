import type { Confidence } from "../../domain";

const BASE_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60, 120, 240, 365] as const;

export interface ReviewState {
  reviewStage: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
}

export interface ReviewResponse {
  isCorrect: boolean;
  confidence: Confidence;
  durationSeconds: number;
  expectedSeconds: number;
  hintUsed?: boolean;
  englishComprehension?: number;
}

export interface ReviewSchedule extends ReviewState {
  quality: number;
  nextReviewAt: string;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function addUtcDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** Maps answer evidence to an SM-2-style quality value from 0 through 5. */
export function calculateReviewQuality(response: ReviewResponse): number {
  if (!response.isCorrect) {
    if (response.confidence === "sure") return 0;
    if (response.confidence === "not-sure") return 1;
    return 2;
  }

  let quality = response.confidence === "sure" ? 5 : response.confidence === "not-sure" ? 4 : 3;
  if (response.hintUsed) quality -= 1;
  if (response.expectedSeconds > 0 && response.durationSeconds > response.expectedSeconds * 1.5) {
    quality -= 1;
  }
  if ((response.englishComprehension ?? 1) < 0.5) quality -= 1;
  return clamp(Math.round(quality), 0, 5);
}

/**
 * Schedules the next review. A correct guess is intentionally conservative:
 * it never advances more than one stage and may remain at the one-day interval.
 */
export function scheduleNextReview(
  state: ReviewState,
  response: ReviewResponse,
  now: Date = new Date(),
): ReviewSchedule {
  const quality = calculateReviewQuality(response);
  const previousStage = clamp(Math.trunc(state.reviewStage), 0, 20);
  let stage: number;
  let easeFactor: number;
  let lapses = state.lapses;

  if (quality < 3) {
    stage = 0;
    lapses += 1;
    easeFactor = clamp(state.easeFactor - (quality === 0 ? 0.25 : 0.15), 1.3, 3);
  } else {
    const confidentAdvance = quality === 5 ? 1 : 0;
    const canAdvance = response.confidence !== "guess" && !response.hintUsed;
    stage = canAdvance ? previousStage + 1 + confidentAdvance : Math.max(0, previousStage);
    easeFactor = clamp(
      state.easeFactor + (quality === 5 ? 0.1 : quality === 4 ? 0.03 : -0.05),
      1.3,
      3,
    );
  }

  stage = clamp(stage, 0, 20);
  const baseInterval = BASE_INTERVALS_DAYS[Math.min(stage, BASE_INTERVALS_DAYS.length - 1)] ?? 1;
  const easeMultiplier = clamp(easeFactor / 2.5, 0.65, 1.2);
  const confidenceMultiplier = response.confidence === "guess" ? 0.6 : response.confidence === "not-sure" ? 0.85 : 1;
  const intervalDays = clamp(Math.max(1, Math.round(baseInterval * easeMultiplier * confidenceMultiplier)), 1, 365);

  return {
    reviewStage: stage,
    easeFactor,
    intervalDays,
    repetitions: state.repetitions + 1,
    lapses,
    quality,
    nextReviewAt: addUtcDays(now, intervalDays).toISOString(),
  };
}

export function isReviewDue(nextReviewAt: string, now: Date = new Date()): boolean {
  const dueAt = Date.parse(nextReviewAt);
  return Number.isFinite(dueAt) && dueAt <= now.getTime();
}

export { BASE_INTERVALS_DAYS };
