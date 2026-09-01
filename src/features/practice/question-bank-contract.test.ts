import { describe, expect, it } from 'vitest';
import { QuestionSchema } from '../../../functions/src/schemas';

/**
 * `functions/src/schemas.ts` is compiled twice: by the Functions toolchain
 * (Zod 3) and by this web toolchain (Zod 4). Zod 4 removed the single-argument
 * `z.record(value)` overload, which broke the root typecheck. These assertions
 * run the shared contract under the web toolchain's Zod so a future divergence
 * fails a test instead of only a build.
 */
const baseQuestion = {
  subject: 'mathematics',
  module: 'Algebra',
  topicId: 'alg-linear-equations',
  skill: 'Solve one-variable linear equations',
  difficulty: 2,
  language: 'en',
  question: 'Solve 2x + 3 = 7.',
  options: [
    { id: 'a', text: 'x = 2' },
    { id: 'b', text: 'x = 5' },
  ],
  correctAnswer: 'a',
  solution: 'Subtract 3, then divide by 2.',
  shortSolution: 'x = 2',
  explanation: 'Isolate x by inverse operations.',
  estimatedTime: 60,
  sourceType: 'template-generated',
  sourceNote: 'Original CSCA-style item generated from a reviewed template.',
  templateId: 'tpl-linear-equation-1',
} as const;

const withParameters = (templateParameters: Record<string, unknown>) =>
  QuestionSchema.safeParse({ ...baseQuestion, templateParameters });

describe('shared question bank contract (template parameters)', () => {
  it('accepts string, number, and boolean parameter values', () => {
    expect(withParameters({ a: '2', b: 3, exact: true }).success).toBe(true);
  });

  it('accepts an empty parameter record', () => {
    expect(withParameters({}).success).toBe(true);
  });

  it('rejects an empty parameter key', () => {
    expect(withParameters({ '': '2' }).success).toBe(false);
  });

  it('bounds parameter key length at 120 characters', () => {
    expect(withParameters({ ['k'.repeat(120)]: '2' }).success).toBe(true);
    expect(withParameters({ ['k'.repeat(121)]: '2' }).success).toBe(false);
  });

  it('rejects non-primitive parameter values', () => {
    expect(withParameters({ a: { nested: 1 } }).success).toBe(false);
    expect(withParameters({ a: [1, 2] }).success).toBe(false);
    expect(withParameters({ a: Number.NaN }).success).toBe(false);
  });

  it('allows at most 50 parameters', () => {
    const entries = (count: number) =>
      Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, index]));

    expect(withParameters(entries(50)).success).toBe(true);
    expect(withParameters(entries(51)).success).toBe(false);
  });

  it('still enforces the surrounding question invariants', () => {
    expect(
      QuestionSchema.safeParse({ ...baseQuestion, correctAnswer: 'missing-option' }).success,
    ).toBe(false);
    expect(
      QuestionSchema.safeParse({ ...baseQuestion, templateId: undefined }).success,
    ).toBe(false);
  });
});
