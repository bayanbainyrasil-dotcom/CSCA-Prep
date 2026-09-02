import { describe, expect, it } from 'vitest';
import { BlueprintCellSchema, validateQuestionAgainstCell, type BlueprintCell } from './blueprint';

const cell: BlueprintCell = BlueprintCellSchema.parse({
  id: 'math-linear-isolate-unknown',
  subject: 'mathematics',
  module: 'Algebra',
  topicId: 'math-linear',
  topic: 'Linear equations and inequalities',
  skillId: 'solve-linear',
  skill: 'Solve linear relations',
  microSkillId: 'isolate-unknown',
  microSkill: 'Isolate the unknown in a one-step equation',
  prerequisiteCellIds: [],
  difficultyLevels: [1, 2],
  questionTypes: ['single-step-calculation'],
  minimumItems: 3,
  supportedLanguages: ['en'],
  allowedExamModes: ['diagnostic', 'practice', 'mock'],
  verificationStatus: 'draft',
  sourceType: 'original-csca-style',
  sourceReference: 'Derived from src/data/curriculum.ts. Not an official CSCA specification.',
  reviewer: null,
  reviewedAt: null,
  knownLimitations: '',
  version: 1,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
});

const draft = {
  subject: 'mathematics' as const,
  topicId: 'math-linear',
  questionType: 'single-step-calculation' as const,
  difficulty: 2,
  language: 'en' as const,
};

describe('validateQuestionAgainstCell', () => {
  it('accepts a question that matches its cell', () => {
    expect(validateQuestionAgainstCell(cell, draft, cell.id)).toEqual([]);
  });

  it('refuses a cell that does not exist', () => {
    const problems = validateQuestionAgainstCell(undefined, draft, 'no-such-cell');
    expect(problems).toHaveLength(1);
    expect(problems[0]?.code).toBe('unknown-cell');
    expect(problems[0]?.message).toMatch(/no-such-cell/);
  });

  it('refuses a subject mismatch', () => {
    const problems = validateQuestionAgainstCell(cell, { ...draft, subject: 'physics' }, cell.id);
    expect(problems.map((problem) => problem.code)).toContain('subject-mismatch');
  });

  it('refuses a topic mismatch', () => {
    const problems = validateQuestionAgainstCell(cell, { ...draft, topicId: 'math-foundation' }, cell.id);
    expect(problems.map((problem) => problem.code)).toContain('topic-mismatch');
  });

  it('refuses a question type the cell does not ask for', () => {
    const problems = validateQuestionAgainstCell(cell, { ...draft, questionType: 'graph-reading' }, cell.id);
    expect(problems.map((problem) => problem.code)).toContain('question-type-not-allowed');
    expect(problems[0]?.message).toMatch(/single-step-calculation/);
  });

  it('refuses a difficulty outside the cell', () => {
    expect(validateQuestionAgainstCell(cell, { ...draft, difficulty: 4 }, cell.id).map((p) => p.code)).toContain(
      'difficulty-not-allowed',
    );
    expect(validateQuestionAgainstCell(cell, { ...draft, difficulty: 1 }, cell.id)).toEqual([]);
  });

  it('refuses a language the cell does not support', () => {
    expect(validateQuestionAgainstCell(cell, { ...draft, language: 'ru' }, cell.id).map((p) => p.code)).toContain(
      'language-not-supported',
    );
  });

  it('refuses an exam mode the cell does not allow', () => {
    const practiceOnly = BlueprintCellSchema.parse({ ...cell, allowedExamModes: ['practice'] });
    const problems = validateQuestionAgainstCell(practiceOnly, { ...draft, intendedModes: ['mock'] }, cell.id);
    expect(problems.map((problem) => problem.code)).toContain('mode-not-allowed');
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const problems = validateQuestionAgainstCell(
      cell,
      { subject: 'physics', topicId: 'phys-units', questionType: 'estimation', difficulty: 5, language: 'zh' },
      cell.id,
    );
    expect(problems.map((problem) => problem.code).sort()).toEqual([
      'difficulty-not-allowed',
      'language-not-supported',
      'question-type-not-allowed',
      'subject-mismatch',
      'topic-mismatch',
    ]);
  });
});
