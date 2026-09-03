import { describe, expect, it } from 'vitest';
import { DRAFT_QUESTION_SEED } from '@/data/draft-questions';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { BlueprintQuestionRecordSchema, evaluateBlueprintCoverage } from '@/features/blueprint/blueprint';

/**
 * The Physics vertical slice for `phys-thermodynamics-heat-transfer`.
 *
 * The generic seed tests already recompute every answer independently and check
 * that exactly one option matches. What is checked here is slice completeness
 * against the cell's own requirements, unit discipline, and — most importantly —
 * that authoring this content moved no coverage number.
 */

const CELL_ID = 'phys-thermodynamics-heat-transfer';
const cell = BLUEPRINT_CELL_SEED.find((entry) => entry.id === CELL_ID)!;
const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === CELL_ID);

describe('the physics slice satisfies what its cell asks for', () => {
  it('exists, and reaches the cell’s minimum item count', () => {
    expect(cell).toBeDefined();
    expect(items.length).toBeGreaterThanOrEqual(cell.minimumItems);
  });

  it('covers every difficulty the cell requires', () => {
    const present = new Set(items.map((item) => item.difficulty));
    for (const level of cell.difficultyLevels) {
      expect(present.has(level), `difficulty ${level}`).toBe(true);
    }
    // And offers nothing the cell does not allow.
    for (const item of items) expect(cell.difficultyLevels, item.id).toContain(item.difficulty);
  });

  it('covers every question type the cell requires', () => {
    const present = new Set(items.map((item) => item.questionType));
    for (const type of cell.questionTypes) {
      expect(present.has(type), type).toBe(true);
    }
    for (const item of items) expect(cell.questionTypes, item.id).toContain(item.questionType);
  });

  it('files every item under the cell’s own subject, module and topic', () => {
    for (const item of items) {
      expect(item.subject, item.id).toBe(cell.subject);
      expect(item.topicId, item.id).toBe(cell.topicId);
      expect(item.module, item.id).toBe(cell.module);
      expect(item.skill, item.id).toBe(cell.skill);
    }
  });
});

describe('every item is answerable and unambiguous', () => {
  it('offers four options with distinct ids and distinct text', () => {
    for (const item of items) {
      expect(item.options, item.id).toHaveLength(4);
      expect(new Set(item.options.map((option) => option.id)).size, item.id).toBe(4);
      expect(new Set(item.options.map((option) => option.text)).size, item.id).toBe(4);
    }
  });

  it('names a correct answer that is one of its own options', () => {
    for (const item of items) {
      expect(item.options.map((option) => option.id), item.id).toContain(item.correctAnswer);
    }
  });

  it('explains every wrong option, and never the right one', () => {
    for (const item of items) {
      const wrong = item.options.filter((option) => option.id !== item.correctAnswer).map((option) => option.id);
      const explained = item.commonMistakes.map((mistake) => mistake.distractorOptionId).filter(Boolean);
      expect(explained.sort(), item.id).toEqual(wrong.sort());
      expect(explained, item.id).not.toContain(item.correctAnswer);
    }
  });

  it('keeps every option in one unit, so the comparison is between numbers', () => {
    for (const item of items) {
      const units = item.options.map((option) => option.text.replace(/^[\d.,\s−-]+/, '').trim());
      expect(new Set(units).size, `${item.id} mixes units: ${units.join(' | ')}`).toBe(1);
      expect(units[0]!.length, item.id).toBeGreaterThan(0);
    }
  });

  it('either states the specific heat capacity or asks for it, never assumes it', () => {
    for (const item of items) {
      const states = /specific heat capacity of [a-z]+ is [\d.]+ J\/\(kg·K\)/.test(item.question);
      const asks = /What is the specific heat capacity/.test(item.question);
      expect(states || asks, `${item.id} must supply c or ask for it`).toBe(true);
      // An item that asks for c must not also hand it over.
      if (asks) expect(states, item.id).toBe(false);
    }
  });
});

describe('every item teaches, in both languages', () => {
  it('carries a Russian rendering of the prompt as well as the English one', () => {
    for (const item of items) {
      expect(item.question.length, item.id).toBeGreaterThan(40);
      expect(item.questionTranslation.length, item.id).toBeGreaterThan(40);
      // A real translation, not the English text copied across.
      expect(item.questionTranslation, item.id).not.toBe(item.question);
      expect(item.questionTranslation, item.id).toMatch(/[А-Яа-я]/);
    }
  });

  it('carries a full solution, a short one for revision, and an explanation', () => {
    for (const item of items) {
      expect(item.solution.length, item.id).toBeGreaterThan(60);
      expect(item.shortSolution.length, item.id).toBeGreaterThan(10);
      expect(item.shortSolution.length, item.id).toBeLessThan(item.solution.length);
      expect(item.explanation.length, item.id).toBeGreaterThan(40);
    }
  });

  it('names the relation it is teaching', () => {
    for (const item of items) {
      expect(`${item.solution} ${item.shortSolution}`, item.id).toMatch(/Q = mcΔT|c = Q ÷|Q = 0|Q = mc/);
      expect(item.formulas, item.id).toContain('Q = mcΔT');
    }
  });

  it('claims nothing official and copies nothing', () => {
    for (const item of items) {
      const text = `${item.question} ${item.solution} ${item.explanation}`.toLowerCase();
      expect(text, item.id).not.toContain('official');
      expect(text, item.id).not.toContain('past paper');
      expect(item.tags, item.id).toContain('authored-slice-2');
    }
  });
});

describe('authoring this slice approved nothing', () => {
  it('leaves coverage at zero over the whole blueprint', () => {
    const report = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, []);
    expect(report.verifiedCells).toBe(0);
    expect(report.totals.covered).toBe(0);
    expect(report.totals.empty).toBe(BLUEPRINT_CELL_SEED.length);
  });

  it('would still not count as mock coverage once reviewed, because the keys are public', () => {
    const reviewed = items.map((item) =>
      BlueprintQuestionRecordSchema.parse({
        questionId: item.id,
        cellId: item.cellId,
        subject: item.subject,
        topicId: item.topicId,
        difficulty: item.difficulty,
        questionType: item.questionType,
        language: item.language,
        status: 'published',
        demo: false,
        verificationStatus: 'reviewer-verified',
        sourceType: 'original-csca-style',
        sourceReference: 'Authored for CSCA Prep',
        reviewer: 'A. Reviewer',
        reviewedAt: '2026-09-03T09:00:00.000Z',
        correctAnswerLabel: item.correctAnswer,
        knownLimitations: '',
        contentVersion: 1,
        verifiedContentVersion: 1,
        publicAnswerKey: true,
      }),
    );

    const forMock = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, reviewed, { mode: 'mock' });
    const entry = forMock.cells.find((item) => item.cell.id === CELL_ID);
    expect(entry?.verifiedItems).toBe(0);
    expect(entry?.excludedForMode).toBe(true);
    expect(entry?.reasons.join(' ')).toContain('published answer key');

    // The same items do cover the cell for practice.
    const forPractice = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, reviewed, { mode: 'practice' });
    expect(forPractice.cells.find((item) => item.cell.id === CELL_ID)?.status).toBe('covered');
  });
});
