import {
  AttemptSchema,
  TopicMasterySchema,
  type Attempt,
  type TopicMastery,
} from "../../domain";
import { scheduleNextReview } from "./spacedRepetition";

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value: number, decimals = 4): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function confidenceKnowledgeFactor(attempt: Attempt): number {
  if (!attempt.isCorrect) return 0;
  if (attempt.confidence === "guess") return 0.35;
  if (attempt.confidence === "not-sure") return 0.72;
  return 1;
}

function confidenceCalibration(attempt: Attempt): number {
  if (attempt.isCorrect) {
    if (attempt.confidence === "sure") return 1;
    if (attempt.confidence === "not-sure") return 0.72;
    return 0.35;
  }
  if (attempt.confidence === "guess") return 0.85;
  if (attempt.confidence === "not-sure") return 0.55;
  return 0.05;
}

export interface MasteryUpdateOptions {
  expectedTimeSeconds: number;
  now?: Date;
}

/**
 * Combines accuracy, question difficulty, speed, confidence, English
 * comprehension, and repeated evidence. No single answer can establish mastery.
 */
export function updateTopicMastery(
  currentInput: TopicMastery,
  attemptInput: Attempt,
  options: MasteryUpdateOptions,
): TopicMastery {
  const current = TopicMasterySchema.parse(currentInput);
  const attempt = AttemptSchema.parse(attemptInput);
  if (current.userId !== attempt.userId || current.topicId !== attempt.topicId) {
    throw new Error("Attempt does not belong to this user/topic mastery record");
  }

  const now = options.now ?? new Date(attempt.answeredAt);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid mastery update time");
  const expectedTime = Math.max(1, options.expectedTimeSeconds);
  const speedScore = clamp(expectedTime / Math.max(1, attempt.durationSeconds), 0, 1);
  const difficultyScore = (attempt.difficulty - 1) / 4;
  const knowledgeConfidence = confidenceKnowledgeFactor(attempt);
  const observedPerformance = attempt.isCorrect
    ? 100 *
      (0.48 +
        0.17 * difficultyScore +
        0.1 * speedScore +
        0.15 * knowledgeConfidence +
        0.1 * attempt.englishComprehension)
    : 0;

  // Wrong answers decay faster than correct answers raise the score. As the
  // evidence base grows, each individual attempt has less influence.
  const evidenceDamping = clamp(1 / Math.sqrt(current.attemptCount + 1), 0.35, 1);
  const learningRate = (attempt.isCorrect ? 0.16 : 0.24) * evidenceDamping;
  let nextScore = current.score + learningRate * (observedPerformance - current.score);

  // Repeated, confident success at exam-relevant difficulty earns a small
  // stability bonus; it is capped and cannot turn one answer into mastery.
  if (
    attempt.isCorrect &&
    attempt.confidence === "sure" &&
    attempt.difficulty >= 3 &&
    current.consecutiveCorrect >= 2
  ) {
    nextScore += Math.min(1.5, 0.35 * current.consecutiveCorrect);
  }

  const nextAttemptCount = current.attemptCount + 1;
  const nextCorrectCount = current.correctAttemptCount + (attempt.isCorrect ? 1 : 0);
  const emaWeight = current.attemptCount === 0 ? 1 : 0.25;
  const schedule = scheduleNextReview(
    current,
    {
      isCorrect: attempt.isCorrect,
      confidence: attempt.confidence,
      durationSeconds: attempt.durationSeconds,
      expectedSeconds: expectedTime,
      hintUsed: attempt.hintUsed,
      englishComprehension: attempt.englishComprehension,
    },
    now,
  );

  return TopicMasterySchema.parse({
    ...current,
    score: round(clamp(nextScore, 0, 100)),
    accuracy: round(nextCorrectCount / nextAttemptCount),
    speedScore: round(current.speedScore * (1 - emaWeight) + speedScore * emaWeight),
    confidenceCalibration: round(
      current.confidenceCalibration * (1 - emaWeight) + confidenceCalibration(attempt) * emaWeight,
    ),
    englishComprehension: round(
      current.englishComprehension * (1 - emaWeight) + attempt.englishComprehension * emaWeight,
    ),
    attemptCount: nextAttemptCount,
    correctAttemptCount: nextCorrectCount,
    repetitions: schedule.repetitions,
    consecutiveCorrect: attempt.isCorrect ? current.consecutiveCorrect + 1 : 0,
    lapses: schedule.lapses,
    reviewStage: schedule.reviewStage,
    easeFactor: round(schedule.easeFactor),
    intervalDays: schedule.intervalDays,
    highestSuccessfulDifficulty:
      attempt.isCorrect && attempt.confidence !== "guess"
        ? Math.max(current.highestSuccessfulDifficulty, attempt.difficulty)
        : current.highestSuccessfulDifficulty,
    recentAttemptIds: [...current.recentAttemptIds, attempt.id].slice(-20),
    lastReviewedAt: now.toISOString(),
    nextReviewAt: schedule.nextReviewAt,
    version: current.version + 1,
    updatedAt: now.toISOString(),
  });
}

export type MasteryBand = "unseen" | "starting" | "developing" | "proficient" | "mastered";

export function getMasteryBand(mastery: TopicMastery): MasteryBand {
  if (mastery.attemptCount === 0) return "unseen";
  if (mastery.score < 30) return "starting";
  if (mastery.score < 60) return "developing";
  if (mastery.score < 80) return "proficient";
  return isTopicMastered(mastery) ? "mastered" : "proficient";
}

export function isTopicMastered(masteryInput: TopicMastery): boolean {
  const mastery = TopicMasterySchema.parse(masteryInput);
  return (
    mastery.score >= 80 &&
    mastery.accuracy >= 0.75 &&
    mastery.attemptCount >= 8 &&
    mastery.highestSuccessfulDifficulty >= 3 &&
    mastery.consecutiveCorrect >= 2
  );
}
