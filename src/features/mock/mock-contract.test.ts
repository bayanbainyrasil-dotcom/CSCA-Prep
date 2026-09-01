import { describe, expect, it } from 'vitest';
import {
  SaveMockAnswerSchema,
  StartMockExamSchema,
  SubmitMockExamSchema,
} from '../../../functions/src/schemas';

describe('mock exam callable contracts', () => {
  it('start accepts only an exam and a device', () => {
    expect(StartMockExamSchema.safeParse({ mockExamId: 'mock-math-1', deviceId: 'device-1' }).success).toBe(true);
    expect(StartMockExamSchema.safeParse({ mockExamId: 'mock-math-1' }).success).toBe(false);
  });

  it('start refuses client-supplied timing or question selection', () => {
    for (const extra of [
      { startedAt: '2026-09-01T10:00:00.000Z' },
      { durationSeconds: 1 },
      { questionIds: ['q1'] },
      { remainingSeconds: 99_999 },
    ]) {
      expect(
        StartMockExamSchema.safeParse({ mockExamId: 'mock-math-1', deviceId: 'device-1', ...extra }).success,
      ).toBe(false);
    }
  });

  const answer = { attemptId: 'attempt-1', questionId: 'q1', selectedAnswer: 'a', mutationId: 'm1' };

  it('answer save accepts a selection or an explicit clear', () => {
    expect(SaveMockAnswerSchema.safeParse(answer).success).toBe(true);
    expect(SaveMockAnswerSchema.safeParse({ ...answer, selectedAnswer: null }).success).toBe(true);
  });

  it('answer save requires an idempotency key', () => {
    const withoutKey: Record<string, unknown> = { ...answer };
    delete withoutKey.mutationId;
    expect(SaveMockAnswerSchema.safeParse(withoutKey).success).toBe(false);
  });

  it('answer save refuses anything that would imply a grade', () => {
    for (const extra of [
      { isCorrect: true },
      { correctAnswer: 'a' },
      { score: 100 },
      { status: 'submitted' },
      { result: { correct: 48 } },
      { answeredAt: '2026-09-01T10:00:00.000Z' },
      { durationSeconds: 0 },
    ]) {
      expect(SaveMockAnswerSchema.safeParse({ ...answer, ...extra }).success).toBe(false);
    }
  });

  it('answer save rejects duplicate flags and out-of-range indexes', () => {
    expect(SaveMockAnswerSchema.safeParse({ ...answer, flaggedQuestionIds: ['q1', 'q1'] }).success).toBe(false);
    expect(SaveMockAnswerSchema.safeParse({ ...answer, flaggedQuestionIds: ['q1', 'q2'] }).success).toBe(true);
    expect(SaveMockAnswerSchema.safeParse({ ...answer, currentQuestionIndex: -1 }).success).toBe(false);
    expect(SaveMockAnswerSchema.safeParse({ ...answer, currentQuestionIndex: 100 }).success).toBe(false);
    expect(SaveMockAnswerSchema.safeParse({ ...answer, currentQuestionIndex: 47 }).success).toBe(true);
  });

  it('submit takes an attempt and an idempotency key, and nothing else', () => {
    expect(SubmitMockExamSchema.safeParse({ attemptId: 'attempt-1', mutationId: 'm1' }).success).toBe(true);
    expect(SubmitMockExamSchema.safeParse({ attemptId: 'attempt-1' }).success).toBe(false);
    for (const extra of [
      { correct: 48 },
      { result: { correct: 48 } },
      { status: 'submitted' },
      { submittedAt: '2026-09-01T11:00:00.000Z' },
      { answers: {} },
    ]) {
      expect(
        SubmitMockExamSchema.safeParse({ attemptId: 'attempt-1', mutationId: 'm1', ...extra }).success,
      ).toBe(false);
    }
  });
});
