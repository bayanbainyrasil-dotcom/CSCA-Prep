import { describe, expect, it } from 'vitest';
import {
  PublishMockExamSchema,
  SetContentVerificationSchema,
  UpsertBlueprintCellSchema,
} from '../../../functions/src/schemas';
import { QuestionSchema } from '../../../functions/src/schemas';

const validCell = {
  cellId: 'math-alg-linear-isolate-d2',
  subject: 'mathematics' as const,
  module: 'Algebra',
  topicId: 'alg-linear',
  topic: 'Linear equations',
  skillId: 'solve-linear',
  skill: 'Solve linear equations',
  microSkillId: 'isolate-unknown',
  microSkill: 'Isolate the unknown in one step',
  prerequisiteCellIds: [],
  difficultyLevels: [2, 3],
  questionTypes: ['single-step-calculation' as const],
  minimumItems: 3,
  supportedLanguages: ['en' as const],
  allowedExamModes: ['diagnostic' as const, 'mock' as const],
  sourceType: 'original-csca-style' as const,
  sourceReference: 'Derived from the published CSCA subject outline',
  knownLimitations: '',
};

describe('blueprint authoring contract', () => {
  it('accepts a complete cell', () => {
    expect(UpsertBlueprintCellSchema.safeParse(validCell).success).toBe(true);
  });

  it('refuses to let the caller certify its own content', () => {
    for (const forged of [
      { verificationStatus: 'reviewer-verified' },
      { reviewer: 'Someone Else' },
      { reviewedAt: '2020-01-01T00:00:00.000Z' },
      { coverageCount: 40 },
      { verifiedItems: 40 },
      { status: 'published' },
    ]) {
      expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, ...forged }).success).toBe(false);
    }
  });

  it('refuses a self-referential prerequisite and repeated difficulty levels', () => {
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, prerequisiteCellIds: [validCell.cellId] }).success).toBe(false);
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, difficultyLevels: [2, 2] }).success).toBe(false);
  });

  it('requires at least one language, difficulty, question type and exam mode', () => {
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, supportedLanguages: [] }).success).toBe(false);
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, difficultyLevels: [] }).success).toBe(false);
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, questionTypes: [] }).success).toBe(false);
    expect(UpsertBlueprintCellSchema.safeParse({ ...validCell, allowedExamModes: [] }).success).toBe(false);
  });
});

describe('verification contract', () => {
  const base = { target: 'question' as const, targetId: 'q1', verificationStatus: 'reviewer-verified' as const };

  it('takes only the target and the new status', () => {
    expect(SetContentVerificationSchema.safeParse(base).success).toBe(true);
    expect(SetContentVerificationSchema.safeParse({ ...base, sourceReference: 'Textbook chapter 4' }).success).toBe(true);
  });

  it('does not let the caller supply the reviewer or the review time', () => {
    for (const forged of [
      { reviewer: 'A. Reviewer' },
      { reviewedAt: '2026-01-01T00:00:00.000Z' },
      { verifiedItems: 10 },
      { coverage: 'covered' },
    ]) {
      expect(SetContentVerificationSchema.safeParse({ ...base, ...forged }).success).toBe(false);
    }
  });

  it('rejects an unknown target and an unknown status', () => {
    expect(SetContentVerificationSchema.safeParse({ ...base, target: 'lesson' }).success).toBe(false);
    expect(SetContentVerificationSchema.safeParse({ ...base, verificationStatus: 'verified' }).success).toBe(false);
  });
});

describe('mock publication contract', () => {
  const base = {
    mockExamId: 'mock-math-2026-01',
    title: 'Mathematics mock 1',
    subject: 'mathematics' as const,
    cellIds: ['cell-a', 'cell-b'],
    questionCount: 48,
    durationMinutes: 60,
    instructions: 'English only. No hints or formulas.',
    language: 'en' as const,
    seed: 'mock-math-2026-01-seed',
  };

  it('accepts a complete request', () => {
    expect(PublishMockExamSchema.safeParse(base).success).toBe(true);
  });

  it('refuses a caller-supplied question list, status or coverage claim', () => {
    for (const forged of [
      { questionIds: ['q1', 'q2'] },
      { status: 'published' },
      { verified: true },
      { coverage: { covered: 48 } },
      { blueprintCellIds: ['cell-a'] },
    ]) {
      expect(PublishMockExamSchema.safeParse({ ...base, ...forged }).success).toBe(false);
    }
  });

  it('refuses a repeated blueprint cell and an empty cell list', () => {
    expect(PublishMockExamSchema.safeParse({ ...base, cellIds: ['cell-a', 'cell-a'] }).success).toBe(false);
    expect(PublishMockExamSchema.safeParse({ ...base, cellIds: [] }).success).toBe(false);
  });
});

describe('question bank contract', () => {
  const baseQuestion = {
    subject: 'mathematics' as const,
    module: 'Algebra',
    topicId: 'alg-linear',
    skill: 'Solve linear equations',
    difficulty: 2,
    language: 'en' as const,
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
    sourceType: 'original-csca-style' as const,
    sourceNote: 'Authored for CSCA Prep.',
  };

  it('lets an import declare its blueprint cell and question type', () => {
    expect(
      QuestionSchema.safeParse({ ...baseQuestion, cellId: 'cell-a', questionType: 'single-step-calculation' }).success,
    ).toBe(true);
  });

  it('does not let an import declare itself reviewed', () => {
    for (const forged of [
      { verificationStatus: 'reviewer-verified' },
      { reviewer: 'A. Reviewer' },
      { reviewedAt: '2026-01-01T00:00:00.000Z' },
    ]) {
      expect(QuestionSchema.safeParse({ ...baseQuestion, ...forged }).success).toBe(false);
    }
  });
});
