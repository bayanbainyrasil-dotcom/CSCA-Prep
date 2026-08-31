import { describe, expect, it } from 'vitest';
import {
  AttemptSchema,
  TopicMasterySchema,
  createInitialTopicMastery,
  type Attempt,
  type TopicMastery,
} from '@/domain';
import { getMasteryBand, isTopicMastered, updateTopicMastery } from './mastery';

const NOW = new Date('2026-04-20T09:00:00.000Z');

function createAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return AttemptSchema.parse({
    id: 'attempt-1',
    userId: 'learner-1',
    deviceId: 'device-test-12345678',
    questionId: 'question-1',
    subject: 'physics',
    topicId: 'physics-kinematics',
    mode: 'practice',
    selectedAnswer: 'B',
    correctAnswer: 'B',
    isCorrect: true,
    confidence: 'sure',
    errorType: null,
    hintUsed: false,
    englishComprehension: 0.9,
    difficulty: 3,
    startedAt: '2026-04-20T08:59:20.000Z',
    answeredAt: NOW.toISOString(),
    durationSeconds: 40,
    version: 1,
    updatedAt: NOW.toISOString(),
    ...overrides,
  });
}

function createMastery(overrides: Partial<TopicMastery> = {}): TopicMastery {
  const initial = createInitialTopicMastery({
    userId: 'learner-1',
    topicId: 'physics-kinematics',
    subject: 'physics',
    now: new Date('2026-04-19T09:00:00.000Z'),
  });
  return TopicMasterySchema.parse({ ...initial, ...overrides });
}

describe('topic mastery', () => {
  it('credits confident knowledge more than a correct guess', () => {
    const initial = createMastery();
    const sure = updateTopicMastery(initial, createAttempt({ confidence: 'sure' }), {
      expectedTimeSeconds: 60,
      now: NOW,
    });
    const guess = updateTopicMastery(initial, createAttempt({ confidence: 'guess' }), {
      expectedTimeSeconds: 60,
      now: NOW,
    });

    expect(sure.score).toBeGreaterThan(guess.score);
    expect(sure.confidenceCalibration).toBe(1);
    expect(guess.confidenceCalibration).toBe(0.35);
    expect(guess.highestSuccessfulDifficulty).toBe(0);
    expect(sure.highestSuccessfulDifficulty).toBe(3);
  });

  it('decays established mastery after an error and resets the success streak', () => {
    const current = createMastery({
      score: 76,
      accuracy: 0.8,
      attemptCount: 10,
      correctAttemptCount: 8,
      consecutiveCorrect: 4,
      reviewStage: 4,
      repetitions: 10,
      highestSuccessfulDifficulty: 4,
    });
    const wrong = createAttempt({
      id: 'attempt-wrong',
      selectedAnswer: 'A',
      isCorrect: false,
      confidence: 'sure',
      errorType: 'concept',
    });
    const updated = updateTopicMastery(current, wrong, {
      expectedTimeSeconds: 60,
      now: NOW,
    });

    expect(updated.score).toBeLessThan(current.score);
    expect(updated.consecutiveCorrect).toBe(0);
    expect(updated.lapses).toBe(current.lapses + 1);
    expect(updated.reviewStage).toBe(0);
    expect(updated.correctAttemptCount).toBe(8);
    expect(updated.attemptCount).toBe(11);
  });

  it('requires repeated, difficult and accurate evidence before declaring mastery', () => {
    const almost = createMastery({
      score: 88,
      accuracy: 0.9,
      attemptCount: 7,
      correctAttemptCount: 7,
      highestSuccessfulDifficulty: 4,
      consecutiveCorrect: 3,
    });
    const mastered = TopicMasterySchema.parse({
      ...almost,
      attemptCount: 8,
      correctAttemptCount: 7,
    });

    expect(isTopicMastered(almost)).toBe(false);
    expect(getMasteryBand(almost)).toBe('proficient');
    expect(isTopicMastered(mastered)).toBe(true);
    expect(getMasteryBand(mastered)).toBe('mastered');
  });

  it('keeps only the 20 most recent attempt identifiers', () => {
    const current = createMastery({
      recentAttemptIds: Array.from({ length: 20 }, (_, index) => `attempt-${index}`),
    });
    const updated = updateTopicMastery(
      current,
      createAttempt({ id: 'attempt-new' }),
      { expectedTimeSeconds: 60, now: NOW },
    );

    expect(updated.recentAttemptIds).toHaveLength(20);
    expect(updated.recentAttemptIds[0]).toBe('attempt-1');
    expect(updated.recentAttemptIds.at(-1)).toBe('attempt-new');
  });

  it('rejects evidence belonging to a different user or topic', () => {
    expect(() => updateTopicMastery(
      createMastery(),
      createAttempt({ userId: 'another-learner' }),
      { expectedTimeSeconds: 60, now: NOW },
    )).toThrow('does not belong');
  });
});
