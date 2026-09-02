import { describe, expect, it } from 'vitest';
import {
  ImportBlueprintDraftSchema,
  ImportPrivateQuestionsSchema,
  ImportPublicQuestionSeedSchema,
} from '../../../functions/src/schemas';

/**
 * What an import request is allowed to say. Verification is a server-stamped
 * fact, so a caller that could send `verificationStatus`, a reviewer or a
 * review date could certify its own content by importing it.
 */

const validQuestion = {
  cellId: 'math-linear-isolate-unknown',
  questionType: 'single-step-calculation',
  subject: 'mathematics',
  module: 'Algebra',
  topicId: 'math-linear',
  skill: 'Solve linear relations',
  difficulty: 1,
  language: 'en',
  question: 'Solve x + 1 = 4.',
  questionTranslation: 'Решите x + 1 = 4.',
  options: [
    { id: 'a', text: 'x = 3' },
    { id: 'b', text: 'x = 5' },
    { id: 'c', text: 'x = 4' },
    { id: 'd', text: 'x = 1' },
  ],
  correctAnswer: 'a',
  solution: 'Subtract 1 from both sides.',
  shortSolution: 'x = 3.',
  explanation: 'One inverse operation isolates the unknown.',
  commonMistakes: [{ id: 'add', description: 'Adding instead of subtracting.', distractorOptionId: 'b' }],
  formulas: [],
  vocabulary: ['solve'],
  estimatedTime: 30,
  tags: ['contract-test'],
  sourceType: 'original-csca-style',
  sourceNote: 'Authored for this test.',
  status: 'published',
  demo: false,
};

const validPrivate = { batchId: 'batch-1', dryRun: true, items: [{ id: 'q-1', question: validQuestion }] };

describe('the seed import requests', () => {
  it('name a seed and a batch, and nothing else', () => {
    expect(ImportBlueprintDraftSchema.safeParse({ batchId: 'b1', seedVersion: '2026-09-02.1', dryRun: true }).success).toBe(true);
    expect(ImportPublicQuestionSeedSchema.safeParse({ batchId: 'b1', seedVersion: '2026-09-02.1', dryRun: false }).success).toBe(true);
  });

  it('require an explicit dry-run choice and a batch id', () => {
    expect(ImportBlueprintDraftSchema.safeParse({ batchId: 'b1', seedVersion: '2026-09-02.1' }).success).toBe(false);
    expect(ImportBlueprintDraftSchema.safeParse({ seedVersion: '2026-09-02.1', dryRun: true }).success).toBe(false);
  });

  for (const [name, schema] of [
    ['blueprint', ImportBlueprintDraftSchema],
    ['public seed', ImportPublicQuestionSeedSchema],
  ] as const) {
    it(`the ${name} import cannot carry content, a verification or a coverage count`, () => {
      const base = { batchId: 'b1', seedVersion: '2026-09-02.1', dryRun: true };
      for (const forged of [
        { verificationStatus: 'reviewer-verified' },
        { reviewer: 'Someone Else' },
        { reviewedAt: '2020-01-01T00:00:00.000Z' },
        { verifiedContentVersion: 3 },
        { cells: [] },
        { items: [] },
        { questions: [] },
        { publicAnswerKey: false },
        { allowedModes: ['mock'] },
        { coverageCount: 105 },
      ]) {
        expect(schema.safeParse({ ...base, ...forged }).success, JSON.stringify(forged)).toBe(false);
      }
    });
  }
});

describe('the private question import request', () => {
  it('accepts an administrator’s own file', () => {
    expect(ImportPrivateQuestionsSchema.safeParse(validPrivate).success).toBe(true);
  });

  it('accepts an expected version, which is how a stale file is caught', () => {
    expect(
      ImportPrivateQuestionsSchema.safeParse({
        ...validPrivate,
        items: [{ id: 'q-1', expectedVersion: 2, question: validQuestion }],
      }).success,
    ).toBe(true);
    expect(
      ImportPrivateQuestionsSchema.safeParse({
        ...validPrivate,
        items: [{ id: 'q-1', expectedVersion: -1, question: validQuestion }],
      }).success,
    ).toBe(false);
  });

  it('refuses a caller-supplied verification on the item or the batch', () => {
    for (const forged of [
      { verificationStatus: 'reviewer-verified' },
      { reviewer: 'Someone Else' },
      { reviewedAt: '2020-01-01T00:00:00.000Z' },
      { verifiedContentVersion: 1 },
      { publicAnswerKey: false },
      { allowedModes: ['mock'] },
    ]) {
      expect(ImportPrivateQuestionsSchema.safeParse({ ...validPrivate, ...forged }).success, `batch ${JSON.stringify(forged)}`).toBe(false);
      expect(
        ImportPrivateQuestionsSchema.safeParse({
          ...validPrivate,
          items: [{ id: 'q-1', question: validQuestion, ...forged }],
        }).success,
        `item ${JSON.stringify(forged)}`,
      ).toBe(false);
    }
  });

  it('refuses the same question id twice in one file', () => {
    expect(
      ImportPrivateQuestionsSchema.safeParse({
        ...validPrivate,
        items: [
          { id: 'q-1', question: validQuestion },
          { id: 'q-1', question: validQuestion },
        ],
      }).success,
    ).toBe(false);
  });

  it('refuses an empty file and caps a single batch', () => {
    expect(ImportPrivateQuestionsSchema.safeParse({ ...validPrivate, items: [] }).success).toBe(false);
    const tooMany = Array.from({ length: 101 }, (_, index) => ({ id: `q-${index}`, question: validQuestion }));
    expect(ImportPrivateQuestionsSchema.safeParse({ ...validPrivate, items: tooMany }).success).toBe(false);
  });

  it('requires the blueprint mapping on every item, so nothing lands unmapped', () => {
    const unmapped: Record<string, unknown> = { ...validQuestion };
    delete unmapped.cellId;
    expect(
      ImportPrivateQuestionsSchema.safeParse({ ...validPrivate, items: [{ id: 'q-1', question: unmapped }] }).success,
    ).toBe(false);
  });
});
