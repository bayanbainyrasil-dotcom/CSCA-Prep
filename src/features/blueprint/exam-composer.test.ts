import { describe, expect, it } from 'vitest';
import {
  BlueprintCellSchema,
  BlueprintQuestionRecordSchema,
  type BlueprintCell,
  type BlueprintQuestionRecord,
} from './blueprint';
import { composeExam } from './exam-composer';

const REVIEWED_AT = '2026-08-20T10:00:00.000Z';
const CREATED_AT = '2026-08-01T10:00:00.000Z';

function cell(id: string, overrides: Partial<BlueprintCell> = {}): BlueprintCell {
  return BlueprintCellSchema.parse({
    id,
    subject: 'mathematics',
    module: 'Algebra',
    topicId: `topic-${id}`,
    topic: 'Linear equations',
    skillId: 'solve-linear',
    skill: 'Solve linear equations',
    microSkillId: 'isolate-unknown',
    microSkill: 'Isolate the unknown',
    prerequisiteCellIds: [],
    difficultyLevels: [2],
    questionTypes: ['single-step-calculation'],
    minimumItems: 1,
    supportedLanguages: ['en'],
    allowedExamModes: ['diagnostic', 'practice', 'mock'],
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'Authored for CSCA Prep',
    reviewer: 'A. Reviewer',
    reviewedAt: REVIEWED_AT,
    knownLimitations: '',
    version: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  });
}

function item(
  questionId: string,
  cellId: string,
  overrides: Partial<BlueprintQuestionRecord> = {},
): BlueprintQuestionRecord {
  return BlueprintQuestionRecordSchema.parse({
    questionId,
    cellId,
    subject: 'mathematics',
    topicId: `topic-${cellId}`,
    difficulty: 2,
    questionType: 'single-step-calculation',
    language: 'en',
    status: 'published',
    demo: false,
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'Authored for CSCA Prep',
    reviewer: 'A. Reviewer',
    reviewedAt: REVIEWED_AT,
    correctAnswerLabel: 'a',
    knownLimitations: '',
    contentVersion: 1,
    verifiedContentVersion: 1,
    ...overrides,
  });
}

const CELLS = [cell('c1'), cell('c2'), cell('c3')];
const BANK = [
  ...Array.from({ length: 4 }, (_, index) => item(`c1-${index}`, 'c1')),
  ...Array.from({ length: 4 }, (_, index) => item(`c2-${index}`, 'c2')),
  ...Array.from({ length: 4 }, (_, index) => item(`c3-${index}`, 'c3')),
];

const spec = {
  subject: 'mathematics' as const,
  mode: 'mock' as const,
  questionCount: 6,
  language: 'en' as const,
  seed: 'seed-1',
};

describe('composeExam', () => {
  it('draws the requested number of distinct verified questions', () => {
    const result = composeExam(CELLS, BANK, spec);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toHaveLength(6);
    expect(new Set(result.questions.map((question) => question.questionId)).size).toBe(6);
  });

  it('spreads across cells rather than repeating one', () => {
    const result = composeExam(CELLS, BANK, spec);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedCellIds).toEqual(['c1', 'c2', 'c3']);
    const perCell = new Map<string, number>();
    for (const question of result.questions) {
      perCell.set(question.cellId, (perCell.get(question.cellId) ?? 0) + 1);
    }
    expect([...perCell.values()]).toEqual([2, 2, 2]);
  });

  it('is deterministic for a seed and different across seeds', () => {
    const first = composeExam(CELLS, BANK, spec);
    const same = composeExam(CELLS, BANK, spec);
    const other = composeExam(CELLS, BANK, { ...spec, seed: 'seed-2' });
    expect(first).toEqual(same);
    if (!first.ok || !other.ok) return;
    expect(first.questions.map((q) => q.questionId)).not.toEqual(other.questions.map((q) => q.questionId));
  });

  it('refuses rather than returning a short exam', () => {
    const result = composeExam(CELLS, BANK, { ...spec, questionCount: 20 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('insufficient-verified-coverage');
    expect(result.available).toBe(12);
    expect(result.required).toBe(20);
    expect(result.message).toMatch(/Only 12 verified/);
  });

  it('ignores demo, draft and unreviewed items entirely', () => {
    const unusable = [
      item('demo-1', 'c1', { demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
      item('draft-1', 'c1', { status: 'draft' }),
      item('unreviewed-1', 'c1', { verificationStatus: 'pending-review', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
    ];
    const result = composeExam([cell('c1')], unusable, { ...spec, questionCount: 1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.available).toBe(0);
    expect(result.shortfallByCell).toEqual([{ cellId: 'c1', available: 0 }]);
  });

  it('excludes cells that are not allowed in the requested mode', () => {
    const cells = [cell('c1'), cell('practice-only', { allowedExamModes: ['practice'] })];
    const bank = [...Array.from({ length: 3 }, (_, i) => item(`c1-${i}`, 'c1')), item('p-1', 'practice-only')];
    const result = composeExam(cells, bank, { ...spec, questionCount: 4 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.available).toBe(3);
  });

  it('excludes the other subject', () => {
    const cells = [cell('c1'), cell('p1', { subject: 'physics' })];
    const bank = [
      item('c1-0', 'c1'),
      item('p1-0', 'p1', { subject: 'physics', topicId: 'topic-p1' }),
    ];
    const result = composeExam(cells, bank, { ...spec, questionCount: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.available).toBe(1);
  });

  it('honours the requested language', () => {
    const bank = [item('ru-1', 'c1', { language: 'ru' }), item('en-1', 'c1')];
    const result = composeExam([cell('c1', { supportedLanguages: ['en', 'ru'] })], bank, {
      ...spec,
      questionCount: 1,
      language: 'ru',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions[0]?.questionId).toBe('ru-1');
  });

  it('can be limited to an explicit set of cells', () => {
    const result = composeExam(CELLS, BANK, { ...spec, questionCount: 4, cellIds: ['c1', 'c2'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.usedCellIds).toEqual(['c1', 'c2']);
  });
});
