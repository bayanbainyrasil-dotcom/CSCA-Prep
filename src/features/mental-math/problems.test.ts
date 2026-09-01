import { describe, expect, it } from 'vitest';
import {
  generateMentalMathProblems,
  MENTAL_MATH_PROBLEM_COUNT,
  type MentalMathProblem,
} from './problems';

function independentlySolve(problem: MentalMathProblem): number {
  if (problem.kind === 'square') return problem.operands[0]! ** 2;
  if (problem.kind === 'percentage') return (problem.operands[0]! * problem.operands[1]!) / 100;
  if (problem.kind === 'fraction') {
    return problem.operands[0]! / problem.operands[1]!
      + problem.operands[2]! / problem.operands[3]!;
  }
  if (problem.kind === 'root') return Math.sqrt(problem.operands[0]!);
  if (problem.kind === 'product') return problem.operands[0]! * problem.operands[1]!;
  if (problem.kind === 'scientific-notation') {
    return problem.operands[0]! * 10 ** problem.operands[1]!;
  }
  return Math.round(
    (problem.operands[0]! * problem.operands[1]!) / problem.operands[2]!,
  ) * problem.operands[2]!;
}

describe('mental-math problem generator', () => {
  it('is deterministic and covers every advertised problem family', () => {
    const first = generateMentalMathProblems(3);
    const second = generateMentalMathProblems(3);

    expect(second).toEqual(first);
    expect(first).toHaveLength(MENTAL_MATH_PROBLEM_COUNT);
    expect(new Set(first.map((problem) => problem.kind))).toEqual(new Set([
      'square',
      'percentage',
      'fraction',
      'root',
      'product',
      'scientific-notation',
      'estimation',
    ]));
  });

  it('matches an independent calculation for 10,000 generated problems', () => {
    for (let seed = -500; seed < 500; seed += 1) {
      const problems = generateMentalMathProblems(seed);
      expect(new Set(problems.map((problem) => problem.id)).size).toBe(problems.length);

      for (const problem of problems) {
        expect(Number.isFinite(problem.answer)).toBe(true);
        expect(problem.answer).toBeCloseTo(independentlySolve(problem), 10);
      }
    }
  });

  it('calculates percentages from the displayed percentage and base', () => {
    for (let seed = 0; seed < 100; seed += 1) {
      const problem = generateMentalMathProblems(seed).find((item) => item.kind === 'percentage');
      if (!problem) throw new Error('Percentage problem is missing.');
      const [percentage, base] = problem.operands;

      expect(problem.answer).toBe((percentage! * base!) / 100);
      expect(problem.prompt).toBe(`${percentage}% of ${base}`);
    }
  });

  it('rejects seeds that cannot be reproduced safely', () => {
    expect(() => generateMentalMathProblems(Number.NaN)).toThrow(RangeError);
    expect(() => generateMentalMathProblems(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => generateMentalMathProblems(1.5)).toThrow(RangeError);
  });
});
