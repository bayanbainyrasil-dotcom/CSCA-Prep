import { describe, expect, it } from 'vitest';
import {
  PRIVATE_QUESTION_FIELDS,
  PROMPT_ONLY_QUESTION_FIELDS,
  applyAnswer,
  gradeMockAttempt,
  isExpired,
  remainingSeconds,
  toPromptOnlyQuestion,
  type StoredAnswer,
} from '../../../functions/src/mock-engine';

const storedQuestion = {
  subject: 'physics',
  module: 'Mechanics',
  topicId: 'mech-newton-2',
  skill: "Apply Newton's second law",
  difficulty: 3,
  language: 'en',
  question: 'A 2 kg trolley accelerates at 3 m/s^2. What is the resultant force?',
  options: [
    { id: 'a', text: '6 N', isCorrect: true },
    { id: 'b', text: '1.5 N', isCorrect: false },
  ],
  estimatedTime: 75,
  status: 'published',
  correctAnswer: 'a',
  solution: 'F = ma = 2 * 3 = 6 N',
  shortSolution: '6 N',
  explanation: 'Newton II relates resultant force to mass and acceleration.',
  commonMistakes: [{ id: 'm1', description: 'Dividing instead of multiplying.' }],
};

describe('toPromptOnlyQuestion', () => {
  const prompt = toPromptOnlyQuestion('question-1', storedQuestion);

  it('exposes exactly the allow-listed fields', () => {
    expect(Object.keys(prompt).sort()).toEqual([...PROMPT_ONLY_QUESTION_FIELDS].sort());
  });

  it('never carries a private field, at any depth', () => {
    const serialized = JSON.stringify(prompt);
    for (const field of PRIVATE_QUESTION_FIELDS) {
      expect(serialized).not.toContain(field);
    }
    expect(serialized).not.toContain('isCorrect');
    expect(serialized).not.toContain('F = ma');
  });

  it('rebuilds options from id and text only', () => {
    expect(prompt.options).toEqual([
      { id: 'a', text: '6 N' },
      { id: 'b', text: '1.5 N' },
    ]);
  });

  it('drops malformed options instead of forwarding them', () => {
    const prompt2 = toPromptOnlyQuestion('question-2', {
      ...storedQuestion,
      options: [null, 'not-an-option', { id: 'a', text: 'ok' }],
    });
    expect(prompt2.options).toEqual([{ id: 'a', text: 'ok' }]);
  });
});

describe('attempt clock', () => {
  const startedAtMs = Date.parse('2026-09-01T10:00:00.000Z');
  const durationSeconds = 3_600;

  it('counts down from the full duration', () => {
    expect(remainingSeconds({ startedAtMs, durationSeconds, nowMs: startedAtMs })).toBe(3_600);
    expect(
      remainingSeconds({ startedAtMs, durationSeconds, nowMs: startedAtMs + 600_000 }),
    ).toBe(3_000);
  });

  it('never returns a negative or inflated value', () => {
    expect(
      remainingSeconds({ startedAtMs, durationSeconds, nowMs: startedAtMs + 7_200_000 }),
    ).toBe(0);
    expect(
      remainingSeconds({ startedAtMs, durationSeconds, nowMs: startedAtMs - 60_000 }),
    ).toBe(3_600);
  });

  it('expires only after the duration plus the grace window', () => {
    expect(isExpired({ startedAtMs, durationSeconds, nowMs: startedAtMs + 3_600_000 })).toBe(false);
    expect(isExpired({ startedAtMs, durationSeconds, nowMs: startedAtMs + 3_603_000 })).toBe(false);
    expect(isExpired({ startedAtMs, durationSeconds, nowMs: startedAtMs + 3_610_000 })).toBe(true);
  });
});

describe('gradeMockAttempt', () => {
  const questionIds = ['q1', 'q2', 'q3', 'q4'];
  const correctAnswers = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };
  const questionMeta = {
    q1: { topicId: 'algebra' },
    q2: { topicId: 'algebra' },
    q3: { topicId: 'geometry' },
    q4: { topicId: 'geometry' },
  };
  const answer = (
    questionId: string,
    selectedAnswer: string | null,
    durationSeconds = 30,
  ): StoredAnswer => ({
    questionId,
    selectedAnswer,
    answeredAt: '2026-09-01T10:05:00.000Z',
    durationSeconds,
  });

  it('separates correct, wrong and skipped', () => {
    const result = gradeMockAttempt({
      questionIds,
      answers: [answer('q1', 'a'), answer('q2', 'a'), answer('q3', null)],
      correctAnswers,
      questionMeta,
    });

    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.correct + result.wrong + result.skipped).toBe(questionIds.length);
    expect(result.accuracy).toBe(0.25);
  });

  it('scores each topic over every question in that topic', () => {
    const result = gradeMockAttempt({
      questionIds,
      answers: [answer('q1', 'a'), answer('q2', 'b'), answer('q3', 'x')],
      correctAnswers,
      questionMeta,
    });

    expect(result.topicScores).toEqual({ algebra: 1, geometry: 0 });
  });

  it('averages time over answered questions only', () => {
    const result = gradeMockAttempt({
      questionIds,
      answers: [answer('q1', 'a', 20), answer('q2', 'b', 40), answer('q3', null, 999)],
      correctAnswers,
      questionMeta,
    });

    expect(result.averageTimeSeconds).toBe(30);
  });

  it('returns zeros for an untouched attempt', () => {
    const result = gradeMockAttempt({ questionIds, answers: [], correctAnswers, questionMeta });
    expect(result).toMatchObject({ correct: 0, wrong: 0, skipped: 4, accuracy: 0, averageTimeSeconds: 0 });
  });

  it('counts a question with no stored solution as skipped, never as correct', () => {
    const result = gradeMockAttempt({
      questionIds,
      answers: [answer('q1', 'a'), answer('q2', 'b')],
      correctAnswers: { q1: 'a' },
      questionMeta,
    });

    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(0);
    expect(result.skipped).toBe(3);
  });

  it('ignores answers for questions outside the recorded exam order', () => {
    const result = gradeMockAttempt({
      questionIds: ['q1'],
      answers: [answer('q1', 'a'), answer('q2', 'b'), answer('q9', 'z')],
      correctAnswers,
      questionMeta,
    });

    expect(result).toMatchObject({ correct: 1, wrong: 0, skipped: 0, accuracy: 1 });
  });
});

describe('applyAnswer', () => {
  const base: StoredAnswer = {
    questionId: 'q1',
    selectedAnswer: 'a',
    answeredAt: '2026-09-01T10:05:00.000Z',
    durationSeconds: 30,
  };

  it('appends a first answer', () => {
    const { answers, changed } = applyAnswer([], base);
    expect(changed).toBe(true);
    expect(answers).toEqual([base]);
  });

  it('is a no-op when the identical save is retried', () => {
    const { answers, changed } = applyAnswer([base], { ...base });
    expect(changed).toBe(false);
    expect(answers).toHaveLength(1);
  });

  it('replaces rather than duplicates when the selection changes', () => {
    const { answers, changed } = applyAnswer([base], { ...base, selectedAnswer: 'b' });
    expect(changed).toBe(true);
    expect(answers).toHaveLength(1);
    expect(answers[0]?.selectedAnswer).toBe('b');
  });

  it('keeps one entry per question across many saves', () => {
    let answers: StoredAnswer[] = [];
    for (const selected of ['a', 'b', 'c', null]) {
      answers = applyAnswer(answers, { ...base, selectedAnswer: selected }).answers;
    }
    expect(answers).toHaveLength(1);
    expect(answers[0]?.selectedAnswer).toBeNull();
  });
});
