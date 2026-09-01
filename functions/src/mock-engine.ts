/**
 * Pure, dependency-free logic for the server-authoritative mock exam.
 *
 * Nothing here touches Firestore, so the same code is unit tested from the web
 * toolchain (see `src/features/mock/mock-engine.test.ts`). Keeping the answer-key
 * boundary in a pure function is what makes it testable: `toPromptOnlyQuestion`
 * is an allow-list projection, so a new private field added to the question bank
 * cannot leak into a client payload by default.
 */

/** Fields the browser is allowed to see while an attempt is open. */
export const PROMPT_ONLY_QUESTION_FIELDS = [
  "id",
  "subject",
  "module",
  "topicId",
  "skill",
  "difficulty",
  "language",
  "question",
  "options",
  "estimatedTime",
] as const;

/** Fields that must never reach the browser before finalization. */
export const PRIVATE_QUESTION_FIELDS = [
  "correctAnswer",
  "solution",
  "shortSolution",
  "explanation",
  "commonMistakes",
] as const;

export interface PromptOption {
  id: string;
  text: string;
}

export interface PromptOnlyQuestion {
  id: string;
  subject: string;
  module: string;
  topicId: string;
  skill: string;
  difficulty: number;
  language: string;
  question: string;
  options: PromptOption[];
  estimatedTime: number;
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function readNumber(source: Record<string, unknown>, key: string): number {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/**
 * Projects a stored question onto the allow-list above. Option objects are
 * rebuilt field by field so a private field stored inside an option (for
 * example an `isCorrect` marker) is dropped too.
 */
export function toPromptOnlyQuestion(
  id: string,
  stored: Record<string, unknown>,
): PromptOnlyQuestion {
  const rawOptions = Array.isArray(stored.options) ? stored.options : [];
  const options: PromptOption[] = [];
  for (const rawOption of rawOptions) {
    if (rawOption === null || typeof rawOption !== "object") continue;
    const option = rawOption as Record<string, unknown>;
    options.push({
      id: readString(option, "id"),
      text: readString(option, "text"),
    });
  }

  return {
    id,
    subject: readString(stored, "subject"),
    module: readString(stored, "module"),
    topicId: readString(stored, "topicId"),
    skill: readString(stored, "skill"),
    difficulty: readNumber(stored, "difficulty"),
    language: readString(stored, "language"),
    question: readString(stored, "question"),
    options,
    estimatedTime: readNumber(stored, "estimatedTime"),
  };
}

export interface AttemptClock {
  startedAtMs: number;
  durationSeconds: number;
  nowMs: number;
}

/** Whole seconds left, never negative and never above the exam duration. */
export function remainingSeconds({
  startedAtMs,
  durationSeconds,
  nowMs,
}: AttemptClock): number {
  const elapsed = Math.floor((nowMs - startedAtMs) / 1_000);
  if (!Number.isFinite(elapsed)) return 0;
  return Math.max(0, Math.min(durationSeconds, durationSeconds - elapsed));
}

/**
 * An attempt is expired once the clock reaches zero. A grace window absorbs
 * clock skew and in-flight requests so a save that left the device before the
 * deadline is not rejected by a few hundred milliseconds.
 */
export function isExpired(
  clock: AttemptClock,
  graceSeconds = 5,
): boolean {
  const elapsed = Math.floor((clock.nowMs - clock.startedAtMs) / 1_000);
  return elapsed > clock.durationSeconds + graceSeconds;
}

export interface StoredAnswer {
  questionId: string;
  selectedAnswer: string | null;
  answeredAt: string | null;
  durationSeconds: number;
}

export interface GradedQuestionMeta {
  topicId: string;
}

export interface MockGradeResult {
  correct: number;
  wrong: number;
  skipped: number;
  accuracy: number;
  averageTimeSeconds: number;
  topicScores: Record<string, number>;
}

export interface GradeMockAttemptInput {
  /** Exam order recorded when the attempt started, not the current template. */
  questionIds: string[];
  answers: StoredAnswer[];
  /** questionId -> correct option id, read from the private solutions collection. */
  correctAnswers: Record<string, string>;
  /** questionId -> public metadata used only for reporting. */
  questionMeta: Record<string, GradedQuestionMeta>;
}

function roundToFourDecimals(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Grades an attempt from the recorded exam order. A question with no stored
 * answer, or a stored answer of `null`, counts as skipped rather than wrong,
 * which keeps "did not reach it" separate from "got it wrong" in the report.
 * A question whose solution is missing is also counted as skipped so a content
 * gap can never silently inflate a score.
 */
export function gradeMockAttempt({
  questionIds,
  answers,
  correctAnswers,
  questionMeta,
}: GradeMockAttemptInput): MockGradeResult {
  const answerByQuestion = new Map<string, StoredAnswer>();
  for (const answer of answers) {
    answerByQuestion.set(answer.questionId, answer);
  }

  let correct = 0;
  let wrong = 0;
  let skipped = 0;
  let answeredDurationTotal = 0;
  let answeredCount = 0;
  const topics = new Map<string, { correct: number; total: number }>();

  for (const questionId of questionIds) {
    const topicId = questionMeta[questionId]?.topicId ?? "unknown";
    const topicRow = topics.get(topicId) ?? { correct: 0, total: 0 };
    topicRow.total += 1;

    const answer = answerByQuestion.get(questionId);
    const expected = correctAnswers[questionId];

    if (!answer || answer.selectedAnswer === null || expected === undefined) {
      skipped += 1;
    } else {
      answeredCount += 1;
      answeredDurationTotal += Math.max(0, answer.durationSeconds);
      if (answer.selectedAnswer === expected) {
        correct += 1;
        topicRow.correct += 1;
      } else {
        wrong += 1;
      }
    }

    topics.set(topicId, topicRow);
  }

  const total = questionIds.length;
  const topicScores: Record<string, number> = {};
  for (const [topicId, row] of topics) {
    topicScores[topicId] = row.total === 0 ? 0 : roundToFourDecimals(row.correct / row.total);
  }

  return {
    correct,
    wrong,
    skipped,
    accuracy: total === 0 ? 0 : roundToFourDecimals(correct / total),
    averageTimeSeconds:
      answeredCount === 0
        ? 0
        : roundToFourDecimals(answeredDurationTotal / answeredCount),
    topicScores,
  };
}

/**
 * Applies one answer save to the recorded answer list. Replacing an answer with
 * the identical selection is a no-op, which is what makes a retried save safe.
 */
export function applyAnswer(
  answers: StoredAnswer[],
  next: StoredAnswer,
): { answers: StoredAnswer[]; changed: boolean } {
  const index = answers.findIndex((answer) => answer.questionId === next.questionId);
  if (index === -1) {
    return { answers: [...answers, next], changed: true };
  }

  const existing = answers[index]!;
  if (
    existing.selectedAnswer === next.selectedAnswer &&
    existing.answeredAt === next.answeredAt &&
    existing.durationSeconds === next.durationSeconds
  ) {
    return { answers, changed: false };
  }

  const updated = [...answers];
  updated[index] = next;
  return { answers: updated, changed: true };
}
