import { describe, expect, it } from 'vitest';
import {
  calculateReviewQuality,
  isReviewDue,
  scheduleNextReview,
  type ReviewState,
} from './spacedRepetition';

const BASE_STATE: ReviewState = {
  reviewStage: 0,
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
};
const NOW = new Date('2026-03-10T12:00:00.000Z');

describe('spaced repetition', () => {
  it('orders evidence quality from a confident error to confident success', () => {
    const common = { durationSeconds: 45, expectedSeconds: 60 };

    expect(calculateReviewQuality({ ...common, isCorrect: false, confidence: 'sure' })).toBe(0);
    expect(calculateReviewQuality({ ...common, isCorrect: false, confidence: 'guess' })).toBe(2);
    expect(calculateReviewQuality({ ...common, isCorrect: true, confidence: 'guess' })).toBe(3);
    expect(calculateReviewQuality({ ...common, isCorrect: true, confidence: 'not-sure' })).toBe(4);
    expect(calculateReviewQuality({ ...common, isCorrect: true, confidence: 'sure' })).toBe(5);
  });

  it('penalizes hints, slow work and poor English comprehension', () => {
    expect(calculateReviewQuality({
      isCorrect: true,
      confidence: 'sure',
      durationSeconds: 100,
      expectedSeconds: 60,
      hintUsed: true,
      englishComprehension: 0.3,
    })).toBe(2);
  });

  it('resets a lapsed item and schedules it for the next day', () => {
    const schedule = scheduleNextReview(
      { ...BASE_STATE, reviewStage: 5, repetitions: 8, lapses: 2 },
      {
        isCorrect: false,
        confidence: 'sure',
        durationSeconds: 20,
        expectedSeconds: 60,
      },
      NOW,
    );

    expect(schedule.reviewStage).toBe(0);
    expect(schedule.intervalDays).toBe(1);
    expect(schedule.lapses).toBe(3);
    expect(schedule.repetitions).toBe(9);
    expect(schedule.easeFactor).toBeCloseTo(2.25);
    expect(schedule.nextReviewAt).toBe('2026-03-11T12:00:00.000Z');
  });

  it('keeps a correct guess conservative while advancing confident recall', () => {
    const guess = scheduleNextReview(
      { ...BASE_STATE, reviewStage: 2 },
      {
        isCorrect: true,
        confidence: 'guess',
        durationSeconds: 40,
        expectedSeconds: 60,
      },
      NOW,
    );
    const sure = scheduleNextReview(
      { ...BASE_STATE, reviewStage: 2 },
      {
        isCorrect: true,
        confidence: 'sure',
        durationSeconds: 40,
        expectedSeconds: 60,
      },
      NOW,
    );

    expect(guess.reviewStage).toBe(2);
    expect(guess.intervalDays).toBeLessThan(sure.intervalDays);
    expect(sure.reviewStage).toBe(4);
    expect(sure.easeFactor).toBeCloseTo(2.6);
  });

  it('recognizes due, future and malformed review timestamps', () => {
    expect(isReviewDue('2026-03-10T11:59:59.000Z', NOW)).toBe(true);
    expect(isReviewDue('2026-03-10T12:00:00.000Z', NOW)).toBe(true);
    expect(isReviewDue('2026-03-10T12:00:01.000Z', NOW)).toBe(false);
    expect(isReviewDue('not-a-date', NOW)).toBe(false);
  });
});
