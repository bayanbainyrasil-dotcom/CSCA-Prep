import { describe, expect, it } from 'vitest';
import {
  applyFormulaReview,
  applyVocabularyReview,
  countDue,
  createFormulaProgress,
  createVocabularyProgress,
  describeInterval,
  formulaIntervalDays,
  formulaProgressId,
  isTrainerItemDue,
  vocabularyProgressId,
} from './review-progress';
import { FormulaProgressSchema, VocabularyProgressSchema } from '@/domain';

const NOW = new Date('2026-09-10T08:00:00.000Z');
const good = { isCorrect: true, confidence: 'sure' as const };
const wrong = { isCorrect: false, confidence: 'guess' as const };

describe('vocabulary review progress', () => {
  it('starts due, with no interval and no history', () => {
    const progress = createVocabularyProgress('user-1', 'word-1', NOW);
    expect(isTrainerItemDue(progress, NOW)).toBe(true);
    expect(progress.intervalDays).toBe(0);
    expect(progress.repetitions).toBe(0);
    expect(progress.lastReviewedAt).toBeNull();
    expect(describeInterval(progress.intervalDays)).toBeNull();
  });

  it('records quality, interval, due date, repetitions and last reviewed time', () => {
    const progress = applyVocabularyReview(createVocabularyProgress('user-1', 'word-1', NOW), good, NOW);

    expect(progress.lastQuality).toBe(5);
    expect(progress.intervalDays).toBeGreaterThan(0);
    expect(Date.parse(progress.nextReviewAt)).toBeGreaterThan(NOW.getTime());
    expect(progress.repetitions).toBe(1);
    expect(progress.correctCount).toBe(1);
    expect(progress.incorrectCount).toBe(0);
    expect(progress.lastReviewedAt).toBe(NOW.toISOString());
    expect(isTrainerItemDue(progress, NOW)).toBe(false);
  });

  it('counts a lapse and returns the card to the short interval after a miss', () => {
    let progress = createVocabularyProgress('user-1', 'word-1', NOW);
    for (let index = 0; index < 4; index += 1) {
      progress = applyVocabularyReview(progress, good, new Date(NOW.getTime() + index * 86_400_000));
    }
    const beforeLapse = progress.intervalDays;

    progress = applyVocabularyReview(progress, wrong, NOW);

    expect(progress.lapses).toBe(1);
    expect(progress.incorrectCount).toBe(1);
    expect(progress.intervalDays).toBeLessThan(beforeLapse);
    expect(progress.reviewStage).toBe(0);
  });

  it('only calls a card mastered after sustained success', () => {
    let progress = createVocabularyProgress('user-1', 'word-1', NOW);
    expect(progress.mastered).toBe(false);
    progress = applyVocabularyReview(progress, good, NOW);
    expect(progress.mastered).toBe(false);

    for (let index = 0; index < 6; index += 1) {
      progress = applyVocabularyReview(progress, good, new Date(NOW.getTime() + index * 86_400_000));
    }
    expect(progress.mastered).toBe(true);
    expect(progress.intervalDays).toBeGreaterThanOrEqual(21);
  });

  it('bumps the version on every review so sync sees a change', () => {
    const first = applyVocabularyReview(createVocabularyProgress('user-1', 'word-1', NOW), good, NOW);
    const second = applyVocabularyReview(first, good, NOW);
    expect(second.version).toBe(first.version + 1);
  });

  it('keeps demo and cloud progress apart through the record id', () => {
    expect(vocabularyProgressId('demo-local-user', 'word-1')).not.toBe(
      vocabularyProgressId('google-uid-1', 'word-1'),
    );
    expect(formulaProgressId('demo-local-user', 'f-1')).not.toBe(formulaProgressId('google-uid-1', 'f-1'));
  });
});

describe('formula review progress', () => {
  it('raises the score and pushes the interval out on a correct retrieval', () => {
    const progress = applyFormulaReview(createFormulaProgress('user-1', 'f-1', NOW), good, NOW);
    expect(progress.score).toBeGreaterThan(0);
    expect(progress.attempts).toBe(1);
    expect(progress.correctCount).toBe(1);
    expect(progress.intervalDays).toBe(formulaIntervalDays(progress.score));
    expect(Date.parse(progress.nextReviewAt)).toBeGreaterThan(NOW.getTime());
  });

  it('drops the score and counts a lapse on a miss', () => {
    let progress = createFormulaProgress('user-1', 'f-1', NOW);
    progress = applyFormulaReview(progress, good, NOW);
    const scored = progress.score;
    progress = applyFormulaReview(progress, wrong, NOW);

    expect(progress.score).toBeLessThan(scored);
    expect(progress.lapses).toBe(1);
    expect(progress.incorrectCount).toBe(1);
    expect(progress.attempts).toBe(2);
  });

  it('uses a rolling average so one answer neither proves nor erases mastery', () => {
    let progress = createFormulaProgress('user-1', 'f-1', NOW);
    for (let index = 0; index < 8; index += 1) progress = applyFormulaReview(progress, good, NOW);
    expect(progress.score).toBeGreaterThan(90);

    progress = applyFormulaReview(progress, wrong, NOW);
    expect(progress.score).toBeGreaterThan(40);
    expect(progress.score).toBeLessThan(90);
  });
});

describe('due counting', () => {
  it('treats an item with no record as due', () => {
    expect(countDue(['a', 'b'], {}, NOW)).toBe(2);
  });

  it('counts only items whose review time has arrived', () => {
    const reviewed = applyVocabularyReview(createVocabularyProgress('user-1', 'a', NOW), good, NOW);
    expect(countDue(['a', 'b'], { a: reviewed }, NOW)).toBe(1);
    expect(countDue(['a', 'b'], { a: reviewed }, new Date(NOW.getTime() + 400 * 86_400_000))).toBe(2);
  });
});

describe('records written before the extra fields existed', () => {
  const legacyVocabulary = {
    id: 'user-1:vocab:word-1',
    userId: 'user-1',
    vocabularyId: 'word-1',
    reviewStage: 2,
    easeFactor: 2.5,
    intervalDays: 7,
    repetitions: 2,
    lapses: 0,
    mastered: false,
    lastReviewedAt: '2026-09-01T08:00:00.000Z',
    nextReviewAt: '2026-09-08T08:00:00.000Z',
    version: 3,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };

  const legacyFormula = {
    id: 'user-1:formula:f-1',
    userId: 'user-1',
    formulaId: 'f-1',
    score: 55,
    attempts: 4,
    lastReviewedAt: '2026-09-01T08:00:00.000Z',
    nextReviewAt: '2026-09-03T08:00:00.000Z',
    version: 2,
    createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };

  it('still validate', () => {
    expect(VocabularyProgressSchema.safeParse(legacyVocabulary).success).toBe(true);
    expect(FormulaProgressSchema.safeParse(legacyFormula).success).toBe(true);
  });

  it('gain the new counters on the next review without losing their history', () => {
    const vocabulary = applyVocabularyReview(VocabularyProgressSchema.parse(legacyVocabulary), good, NOW);
    expect(vocabulary.correctCount).toBe(1);
    expect(vocabulary.repetitions).toBeGreaterThan(2);
    expect(vocabulary.createdAt).toBe(legacyVocabulary.createdAt);

    const formula = applyFormulaReview(FormulaProgressSchema.parse(legacyFormula), good, NOW);
    expect(formula.correctCount).toBe(1);
    expect(formula.lapses).toBe(0);
    expect(formula.attempts).toBe(5);
    expect(formula.createdAt).toBe(legacyFormula.createdAt);
  });
});
