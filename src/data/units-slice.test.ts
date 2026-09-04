import { describe, expect, it } from 'vitest';
import { DRAFT_QUESTION_SEED } from '@/data/draft-questions';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { SLICE_LESSONS, SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';

/**
 * The Physics slice for `phys-units-unit-conversion-si`.
 *
 * Every answer here is already recomputed independently by
 * `draft-questions.test.ts`, and every option's uniqueness is checked there
 * too. What this file checks is what is specific to a conversion cell: that the
 * options differ only in their power of ten, so the item tests reading the
 * prefix rather than reading the digits; that the digits of the key match the
 * digits of the question, because a conversion that changes them is a different
 * calculation; and that the cell's own requirements are met rather than a
 * remembered number.
 */

const CELL_ID = 'phys-units-unit-conversion-si';
const cell = BLUEPRINT_CELL_SEED.find((entry) => entry.id === CELL_ID)!;
const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === CELL_ID);

/** The unit at the end of an option, which is the part that is not a number. */
function unitOf(text: string): string {
  return text.replace(/^[\d.,\s×⁰¹²³⁴⁵⁶⁷⁸⁹⁻−-]+/, '').replace(/^10\s*/, '').trim();
}

/** The significant digits of a number, ignoring its power of ten and any unit. */
function digitsOf(text: string): string {
  const mantissa = /(\d[\d.]*)/.exec(text.trim())?.[1] ?? '';
  return mantissa.replace(/\./g, '').replace(/^0+/, '').replace(/0+$/, '');
}

describe('the units slice satisfies what its cell asks for', () => {
  it('exists and reaches the cell’s own minimum, not a remembered number', () => {
    expect(cell).toBeDefined();
    expect(items.length).toBeGreaterThanOrEqual(cell.minimumItems);
  });

  it('covers every question type and difficulty the cell requires, and offers nothing else', () => {
    const types = new Set(items.map((item) => item.questionType));
    for (const type of cell.questionTypes) expect(types.has(type), type).toBe(true);
    for (const item of items) expect(cell.questionTypes, item.id).toContain(item.questionType);

    const levels = new Set(items.map((item) => item.difficulty));
    for (const level of cell.difficultyLevels) expect(levels.has(level), `difficulty ${level}`).toBe(true);
    for (const item of items) expect(cell.difficultyLevels, item.id).toContain(item.difficulty);
  });

  it('has a lesson attached to it', () => {
    const lessonId = Object.entries(SLICE_LESSON_CELL_IDS).find(([, id]) => id === CELL_ID)?.[0];
    expect(lessonId, 'the cell has a teaching slice').toBeDefined();
    expect(SLICE_LESSONS.some((lesson) => lesson.id === lessonId)).toBe(true);
  });
});

describe('each item tests the prefix, not the arithmetic', () => {
  it('keeps every option in one unit, so the comparison is between values', () => {
    for (const item of items) {
      const units = item.options.map((option) => unitOf(option.text));
      expect(new Set(units).size, `${item.id} mixes units: ${units.join(' | ')}`).toBe(1);
      expect(units[0]!.length, item.id).toBeGreaterThan(0);
    }
  });

  /**
   * Only for the pure prefix conversions. A compound conversion such as km/h to
   * m/s divides by 3.6, and its distractors come from dividing by 60 or by 3600
   * — real slips that genuinely produce different digits. Requiring those to
   * match would mean inventing distractors nobody would ever arrive at.
   */
  it('changes only the power of ten when the item is a prefix conversion', () => {
    const prefixItems = items.filter((item) => item.templateParameters.check === 'si-prefix-scale');
    expect(prefixItems.length, 'the slice has at least one prefix conversion').toBeGreaterThan(0);

    for (const item of prefixItems) {
      const asked = digitsOf(item.question);
      const key = item.options.find((option) => option.id === item.correctAnswer)!;
      expect(digitsOf(key.text), `${item.id} changes the digits it was given`).toBe(asked);

      // And every option carries those same digits, so reading them picks nothing.
      for (const option of item.options) {
        expect(digitsOf(option.text), `${item.id} option ${option.id} is identifiable by its digits`).toBe(asked);
      }
    }
  });

  it('names a specific slip behind every distractor', () => {
    for (const item of items) {
      const distractors = item.options.filter((option) => option.id !== item.correctAnswer);
      const explained = new Set(item.commonMistakes.map((mistake) => mistake.distractorOptionId));
      for (const distractor of distractors) {
        expect(explained.has(distractor.id), `${item.id} option ${distractor.id} is unexplained`).toBe(true);
      }
    }
  });
});

describe('every item teaches, in both languages', () => {
  it('carries a real Russian rendering of the prompt', () => {
    for (const item of items) {
      expect(item.questionTranslation, item.id).not.toBe(item.question);
      expect(item.questionTranslation, item.id).toMatch(/[А-Яа-я]/);
      expect(item.questionTranslation.length, item.id).toBeGreaterThan(30);
    }
  });

  it('carries a full solution, a short one, and an explanation that adds something', () => {
    for (const item of items) {
      expect(item.solution.length, item.id).toBeGreaterThan(60);
      expect(item.shortSolution.length, item.id).toBeLessThan(item.solution.length);
      expect(item.explanation.length, item.id).toBeGreaterThan(40);
      expect(item.explanation, item.id).not.toBe(item.solution);
    }
  });

  it('claims nothing official, and is tagged as its own authored slice', () => {
    for (const item of items) {
      const text = `${item.question} ${item.solution} ${item.explanation}`.toLowerCase();
      expect(text, item.id).not.toContain('official');
      expect(text, item.id).not.toContain('past paper');
      expect(item.tags, item.id).toContain('authored-slice-3');
    }
  });
});
