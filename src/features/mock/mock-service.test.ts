import { describe, expect, it } from 'vitest';
import {
  MockReviewSchema,
  OpenMockAttemptSchema,
  MockPromptQuestionSchema,
} from './mock-service';

const promptQuestion = {
  id: 'q1',
  subject: 'physics' as const,
  module: 'Mechanics',
  topicId: 'mech-newton-2',
  skill: "Apply Newton's second law",
  difficulty: 3,
  language: 'en',
  question: 'A 2 kg trolley accelerates at 3 m/s^2. What is the resultant force?',
  options: [
    { id: 'a', text: '6 N' },
    { id: 'b', text: '1.5 N' },
  ],
  estimatedTime: 75,
};

const openAttempt = {
  attemptId: 'attempt-1',
  mockExamId: 'mock-physics-1',
  subject: 'physics' as const,
  status: 'in-progress' as const,
  startedAt: '2026-09-01T10:00:00.000Z',
  durationSeconds: 3_600,
  remainingSeconds: 3_540,
  currentQuestionIndex: 0,
  flaggedQuestionIds: [],
  answers: [{ questionId: 'q1', selectedAnswer: null }],
  questions: [promptQuestion],
};

describe('open mock attempt payload', () => {
  it('accepts a prompt-only attempt', () => {
    expect(OpenMockAttemptSchema.safeParse(openAttempt).success).toBe(true);
  });

  it('rejects a question that carries an answer key or a solution', () => {
    for (const leak of [
      { correctAnswer: 'a' },
      { solution: 'F = ma' },
      { shortSolution: '6 N' },
      { explanation: 'Newton II' },
      { commonMistakes: [] },
    ]) {
      const parsed = MockPromptQuestionSchema.safeParse({ ...promptQuestion, ...leak });
      expect(parsed.success).toBe(false);
    }
  });

  it('rejects an option that carries a correctness marker', () => {
    const parsed = MockPromptQuestionSchema.safeParse({
      ...promptQuestion,
      options: [{ id: 'a', text: '6 N', isCorrect: true }, { id: 'b', text: '1.5 N' }],
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an attempt payload that leaks a result while still open', () => {
    for (const leak of [
      { result: { correct: 10 } },
      { correctAnswers: { q1: 'a' } },
      { score: 42 },
    ]) {
      expect(OpenMockAttemptSchema.safeParse({ ...openAttempt, ...leak }).success).toBe(false);
    }
  });

  it('rejects a stored answer that claims correctness', () => {
    expect(
      OpenMockAttemptSchema.safeParse({
        ...openAttempt,
        answers: [{ questionId: 'q1', selectedAnswer: 'a', isCorrect: true }],
      }).success,
    ).toBe(false);
  });
});

describe('mock review payload', () => {
  it('is the only shape that accepts answer keys and solutions', () => {
    const review = {
      attemptId: 'attempt-1',
      subject: 'physics' as const,
      submittedAt: '2026-09-01T11:00:00.000Z',
      result: {
        correct: 1,
        wrong: 0,
        skipped: 0,
        accuracy: 1,
        averageTimeSeconds: 30,
        topicScores: { 'mech-newton-2': 1 },
      },
      questions: [
        {
          questionId: 'q1',
          prompt: promptQuestion,
          selectedAnswer: 'a',
          durationSeconds: 30,
          correctAnswer: 'a',
          isCorrect: true,
          shortSolution: '6 N',
          solution: 'F = ma = 6 N',
          explanation: 'Newton II',
          commonMistakes: [],
        },
      ],
    };
    expect(MockReviewSchema.safeParse(review).success).toBe(true);
  });
});
