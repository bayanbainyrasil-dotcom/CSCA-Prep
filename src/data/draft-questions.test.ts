import { describe, expect, it } from 'vitest';
import { AUTHORED_SLICE_CELL_IDS, DRAFT_QUESTION_SEED, type DraftQuestion } from '@/data/draft-questions';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { QuestionSchema } from '../../functions/src/schemas';
import { validateQuestionAgainstCell } from '@/features/blueprint/blueprint';

/**
 * Independent technical verification of the authored slice.
 *
 * Every answer below is recomputed here from the question's own parameters, by
 * arithmetic written separately from the item, and compared against the option
 * the author marked correct. This catches a wrong key, a wrong distractor or a
 * changed number. It is not subject-matter review: it says the arithmetic is
 * self-consistent, not that the item is a good exam question, so nothing here
 * lets an item reach `reviewer-verified`.
 */

const CELLS_BY_ID = new Map(BLUEPRINT_CELL_SEED.map((cell) => [cell.id, cell]));

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4',
  '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-',
};

function parseNumber(text: string): number {
  // Options are written for learners: "x = −5", "4.5%", "15 km", "2.4 × 10²".
  const normalised = text
    .replace(/−/g, '-')
    .replace(/^x\s*=\s*/, '')
    .replace(/%$/, '')
    .replace(/\s*(km|kg)$/, '')
    .trim();

  const scientific = /^(-?[\d.]+)\s*×\s*10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)$/.exec(normalised);
  if (scientific) {
    const exponent = [...scientific[2]!].map((character) => SUPERSCRIPTS[character] ?? '').join('');
    return Number(scientific[1]) * 10 ** Number(exponent);
  }

  const value = Number(normalised);
  expect(Number.isFinite(value), `option "${text}" should be numeric`).toBe(true);
  return value;
}

function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/** A second implementation of each item's mathematics, written independently. */
const INDEPENDENT: Record<string, (p: Record<string, string | number | boolean>) => string> = {
  'a-plus-b-over-c': (p) => String(Number(p.a) + Number(p.b) / Number(p.c)),
  'k-times-diff-plus-square': (p) =>
    String(Number(p.k) * (Number(p.p) - Number(p.q)) + Number(p.base) ** 2),
  'square-over-divisor': (p) => String(Number(p.base) ** 2 / Number(p.divisor)),
  'fraction-to-decimal': (p) => String(Number(p.numerator) / Number(p.denominator)),
  'decimal-to-percent': (p) => String(Number(p.value) * 100),
  'percent-to-fraction': (p) => {
    const numerator = Number(p.percent);
    const divisor = gcd(numerator, 100);
    return `${numerator / divisor}/${100 / divisor}`;
  },
  'scientific-quotient': (p) =>
    String((Number(p.m1) / Number(p.m2)) * 10 ** (Number(p.e1) - Number(p.e2))),
  'rounded-product': (p) => String(Number(p.x) * Number(p.y)),
  'x-plus-b-equals-c': (p) => String(Number(p.c) - Number(p.b)),
  'ax-equals-c': (p) => String(Number(p.c) / Number(p.a)),
  'x-over-a-equals-c': (p) => String(Number(p.c) * Number(p.a)),
  'ax-plus-b-equals-cx-plus-d': (p) =>
    String((Number(p.d) - Number(p.b)) / (Number(p.a) - Number(p.c))),
  'k-times-x-minus-p-equals-cx-plus-d': (p) => {
    // k(x - p) = cx + d  ->  (k - c)x = d + kp
    const k = Number(p.k);
    const c = Number(p.c);
    return String((Number(p.d) + k * Number(p.p)) / (k - c));
  },
  'two-fractions-equals-one': (p) => {
    // (a x + b)/den1 - (c x + d)/den2 = rhs
    const den1 = Number(p.den1);
    const den2 = Number(p.den2);
    const lcm = (den1 * den2) / gcd(den1, den2);
    const xCoefficient = (Number(p.a) * lcm) / den1 - (Number(p.c) * lcm) / den2;
    const constant = (Number(p.b) * lcm) / den1 - (Number(p.d) * lcm) / den2;
    return String((Number(p.rhs) * lcm - constant) / xCoefficient);
  },
  'fixed-plus-rate': (p) => {
    const value = (Number(p.total) - Number(p.fixed)) / Number(p.rate);
    return String(Math.round(value * 1e9) / 1e9);
  },
  'mean-shift': (p) => String(Number(p.n2) * Number(p.mean2) - Number(p.n1) * Number(p.mean1)),
};

/** Items whose correct option is an estimate rather than the exact value. */
const ESTIMATION_TOLERANCE: Record<string, number> = {
  'math-foundation-estimate-magnitude-001': 0.15,
  'math-foundation-estimate-magnitude-002': 0.15,
};

function optionText(question: DraftQuestion, optionId: string): string {
  const option = question.options.find((entry) => entry.id === optionId);
  expect(option, `${question.id} has an option ${optionId}`).toBeDefined();
  return option!.text;
}

describe('authored slice structure', () => {
  it('produces at least the minimum items each targeted cell requires', () => {
    for (const cellId of AUTHORED_SLICE_CELL_IDS) {
      const cell = CELLS_BY_ID.get(cellId);
      expect(cell, `${cellId} is a blueprint cell`).toBeDefined();
      const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === cellId);
      expect(items.length, `${cellId} needs ${cell!.minimumItems} items`).toBeGreaterThanOrEqual(
        cell!.minimumItems,
      );
    }
  });

  it('covers every difficulty and question type each targeted cell declares', () => {
    for (const cellId of AUTHORED_SLICE_CELL_IDS) {
      const cell = CELLS_BY_ID.get(cellId)!;
      const items = DRAFT_QUESTION_SEED.filter((question) => question.cellId === cellId);
      const difficulties = new Set(items.map((question) => question.difficulty));
      const types = new Set(items.map((question) => question.questionType));
      for (const level of cell.difficultyLevels) {
        expect(difficulties.has(level), `${cellId} needs an item at difficulty ${level}`).toBe(true);
      }
      for (const type of cell.questionTypes) {
        expect(types.has(type), `${cellId} needs a ${type} item`).toBe(true);
      }
    }
  });

  it('uses unique question ids and unique wording', () => {
    const ids = DRAFT_QUESTION_SEED.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
    const prompts = DRAFT_QUESTION_SEED.map((question) => question.question.trim().toLowerCase());
    expect(new Set(prompts).size).toBe(prompts.length);
  });

  it('gives every item four distinct options with one key that exists', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      expect(question.options, `${question.id} option count`).toHaveLength(4);
      const optionIds = question.options.map((option) => option.id);
      expect(new Set(optionIds).size, `${question.id} option ids`).toBe(4);
      const texts = question.options.map((option) => option.text.trim());
      expect(new Set(texts).size, `${question.id} option texts`).toBe(4);
      expect(optionIds, `${question.id} key exists`).toContain(question.correctAnswer);
    }
  });

  it('explains every distractor it names, and names only real options', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const optionIds = new Set(question.options.map((option) => option.id));
      expect(question.commonMistakes.length, `${question.id} explains its mistakes`).toBeGreaterThan(0);
      for (const mistake of question.commonMistakes) {
        if (mistake.distractorOptionId === undefined) continue;
        expect(optionIds.has(mistake.distractorOptionId), `${question.id} -> ${mistake.distractorOptionId}`).toBe(true);
        expect(mistake.distractorOptionId).not.toBe(question.correctAnswer);
      }
      const explained = new Set(
        question.commonMistakes.flatMap((mistake) => (mistake.distractorOptionId ? [mistake.distractorOptionId] : [])),
      );
      for (const option of question.options) {
        if (option.id === question.correctAnswer) continue;
        expect(explained.has(option.id), `${question.id} explains distractor ${option.id}`).toBe(true);
      }
    }
  });

  it('carries an English prompt, a Russian rendering, a full and a short solution', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      expect(question.language).toBe('en');
      expect(question.question.length, `${question.id} prompt`).toBeGreaterThan(10);
      expect(question.questionTranslation.length, `${question.id} translation`).toBeGreaterThan(10);
      expect(/[а-яА-ЯёЁ]/.test(question.questionTranslation), `${question.id} translation is Russian`).toBe(true);
      expect(question.solution.length, `${question.id} solution`).toBeGreaterThan(40);
      expect(question.shortSolution.length, `${question.id} short solution`).toBeGreaterThan(5);
      expect(question.shortSolution.length, `${question.id} short solution is shorter`).toBeLessThan(
        question.solution.length,
      );
      expect(question.explanation.length, `${question.id} explanation`).toBeGreaterThan(20);
      expect(question.estimatedTime).toBeGreaterThan(0);
    }
  });

  it('never claims to be official or copied material', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const text = `${question.question} ${question.solution} ${question.explanation}`.toLowerCase();
      expect(text).not.toContain('official');
      expect(text).not.toContain('past paper');
      expect(question.tags).toContain('authored-slice-1');
    }
  });
});

describe('independent recomputation of every answer', () => {
  it('recomputes each key from the item parameters', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const kind = String(question.templateParameters.check);
      const compute = INDEPENDENT[kind];
      expect(compute, `${question.id} has an independent check for "${kind}"`).toBeDefined();

      const expected = compute!(question.templateParameters);
      const keyText = optionText(question, question.correctAnswer);

      if (expected.includes('/')) {
        expect(keyText.replace(/\s/g, ''), question.id).toBe(expected);
        continue;
      }

      const expectedValue = Number(expected);
      const keyValue = parseNumber(keyText);
      const tolerance = ESTIMATION_TOLERANCE[question.id];
      if (tolerance !== undefined) {
        expect(
          Math.abs(keyValue - expectedValue) / Math.abs(expectedValue),
          `${question.id} estimate is within ${tolerance * 100}%`,
        ).toBeLessThanOrEqual(tolerance);
      } else {
        expect(keyValue, question.id).toBeCloseTo(expectedValue, 6);
      }
    }
  });

  it('leaves exactly one option matching the recomputed answer', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const expected = INDEPENDENT[String(question.templateParameters.check)]!(question.templateParameters);
      if (expected.includes('/')) {
        const matches = question.options.filter((option) => option.text.replace(/\s/g, '') === expected);
        expect(matches.map((option) => option.id), question.id).toEqual([question.correctAnswer]);
        continue;
      }
      const expectedValue = Number(expected);
      const tolerance = ESTIMATION_TOLERANCE[question.id];
      const matches = question.options.filter((option) => {
        const value = parseNumber(option.text);
        return tolerance === undefined
          ? Math.abs(value - expectedValue) < 1e-6
          : Math.abs(value - expectedValue) / Math.abs(expectedValue) <= tolerance;
      });
      expect(matches.map((option) => option.id), question.id).toEqual([question.correctAnswer]);
    }
  });

  it('never divides by zero and never depends on an undefined value', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      for (const [key, value] of Object.entries(question.templateParameters)) {
        if (key === 'check') continue;
        expect(typeof value, `${question.id}.${key}`).toBe('number');
        expect(Number.isFinite(Number(value)), `${question.id}.${key}`).toBe(true);
      }
      const parameters = question.templateParameters;
      for (const divisorKey of ['c', 'denominator', 'divisor', 'rate', 'den1', 'den2', 'm2', 'a']) {
        if (!(divisorKey in parameters)) continue;
        const kind = String(parameters.check);
        // `a` is a divisor only where the item divides by it.
        if (divisorKey === 'a' && !['ax-equals-c', 'x-over-a-equals-c'].includes(kind)) continue;
        if (divisorKey === 'c' && kind !== 'a-plus-b-over-c') continue;
        expect(Number(parameters[divisorKey]), `${question.id}.${divisorKey}`).not.toBe(0);
      }
      const expected = INDEPENDENT[String(parameters.check)]!(parameters);
      if (!expected.includes('/')) {
        expect(Number.isFinite(Number(expected)), `${question.id} result is finite`).toBe(true);
      }
    }
  });

  it('is deterministic: the same parameters always give the same answer', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const compute = INDEPENDENT[String(question.templateParameters.check)]!;
      const runs = Array.from({ length: 200 }, () => compute(question.templateParameters));
      expect(new Set(runs).size, question.id).toBe(1);
    }
  });
});

describe('blueprint mapping of the authored slice', () => {
  it('maps every item onto a real cell it actually fits', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const problems = validateQuestionAgainstCell(
        CELLS_BY_ID.get(question.cellId),
        {
          subject: question.subject,
          topicId: question.topicId,
          questionType: question.questionType,
          difficulty: question.difficulty,
          language: question.language,
        },
        question.cellId,
      );
      expect(problems.map((problem) => problem.message), question.id).toEqual([]);
    }
  });

  it('passes the shared import contract, and only as unverified content', () => {
    for (const question of DRAFT_QUESTION_SEED) {
      const parsed = QuestionSchema.safeParse({
        subject: question.subject,
        module: question.module,
        topicId: question.topicId,
        skill: question.skill,
        difficulty: question.difficulty,
        language: question.language,
        question: question.question,
        questionTranslation: question.questionTranslation,
        options: question.options,
        correctAnswer: question.correctAnswer,
        solution: question.solution,
        shortSolution: question.shortSolution,
        explanation: question.explanation,
        formulas: question.formulas,
        vocabulary: question.vocabulary,
        commonMistakes: question.commonMistakes,
        estimatedTime: question.estimatedTime,
        sourceType: 'original-csca-style',
        sourceNote: 'Original CSCA-style item authored for CSCA Prep. Not an official CSCA question.',
        tags: question.tags,
        status: 'draft',
        demo: false,
        cellId: question.cellId,
        questionType: question.questionType,
        templateParameters: question.templateParameters,
      });
      if (!parsed.success) {
        throw new Error(`${question.id}: ${parsed.error.issues.map((issue) => `${issue.path.join('.')} ${issue.message}`).join('; ')}`);
      }
    }
  });

  it('touches only the six cells of this slice, leaving the other 99 empty', () => {
    const targeted = new Set(DRAFT_QUESTION_SEED.map((question) => question.cellId));
    expect([...targeted].sort()).toEqual([...AUTHORED_SLICE_CELL_IDS].sort());
    expect(BLUEPRINT_CELL_SEED.length - targeted.size).toBe(99);
  });
});
