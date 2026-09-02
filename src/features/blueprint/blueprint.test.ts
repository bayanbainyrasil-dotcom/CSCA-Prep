import { describe, expect, it } from 'vitest';
import {
  BlueprintCellSchema,
  BlueprintQuestionRecordSchema,
  analysePrerequisites,
  answerDistributionSkew,
  canPublishExam,
  countsAsVerifiedCoverage,
  describeDistribution,
  difficultyDistributionSkew,
  evaluateBlueprintCoverage,
  prerequisiteRepairPath,
  type BlueprintCell,
  type BlueprintQuestionRecord,
} from './blueprint';

const REVIEWED_AT = '2026-08-20T10:00:00.000Z';
const CREATED_AT = '2026-08-01T10:00:00.000Z';

function cell(overrides: Partial<BlueprintCell> & { id: string }): BlueprintCell {
  return BlueprintCellSchema.parse({
    subject: 'mathematics',
    module: 'Algebra',
    topicId: 'alg-linear',
    topic: 'Linear equations',
    skillId: 'solve-linear',
    skill: 'Solve linear equations',
    microSkillId: 'isolate-unknown',
    microSkill: 'Isolate the unknown in one step',
    prerequisiteCellIds: [],
    difficultyLevels: [2],
    questionTypes: ['single-step-calculation'],
    minimumItems: 2,
    supportedLanguages: ['en'],
    allowedExamModes: ['diagnostic', 'practice', 'mock'],
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'CSCA published subject outline, algebra section',
    reviewer: 'A. Reviewer',
    reviewedAt: REVIEWED_AT,
    knownLimitations: '',
    version: 1,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    ...overrides,
  });
}

function record(
  overrides: Partial<BlueprintQuestionRecord> & { questionId: string; cellId: string | null },
): BlueprintQuestionRecord {
  return BlueprintQuestionRecordSchema.parse({
    subject: 'mathematics',
    topicId: 'alg-linear',
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

describe('provenance rules', () => {
  it('refuses to call a cell reviewer-verified without a reviewer and a date', () => {
    expect(() => cell({ id: 'c1', reviewer: null })).toThrow();
    expect(() => cell({ id: 'c1', reviewedAt: null })).toThrow();
    expect(cell({ id: 'c1', verificationStatus: 'draft', reviewer: null, reviewedAt: null }).id).toBe('c1');
  });

  it('refuses to call an item reviewer-verified without a reviewer and a date', () => {
    expect(() => record({ questionId: 'q1', cellId: 'c1', reviewer: null })).toThrow();
    expect(
      record({ questionId: 'q1', cellId: 'c1', verificationStatus: 'draft', reviewer: null, reviewedAt: null, verifiedContentVersion: null }).questionId,
    ).toBe('q1');
  });

  it('refuses to mark demo material verified', () => {
    expect(() => record({ questionId: 'q1', cellId: 'c1', demo: true })).toThrow();
    expect(record({ questionId: 'q1', cellId: 'c1', demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null }).demo).toBe(true);
  });

  it('rejects a cell that is its own prerequisite and repeated levels', () => {
    expect(() => cell({ id: 'c1', prerequisiteCellIds: ['c1'] })).toThrow();
    expect(() => cell({ id: 'c1', difficultyLevels: [2, 2] })).toThrow();
    expect(() => cell({ id: 'c1', questionTypes: ['estimation', 'estimation'] })).toThrow();
  });
});

describe('what counts as coverage', () => {
  const target = cell({ id: 'c1', difficultyLevels: [2, 3], questionTypes: ['single-step-calculation', 'graph-reading'] });

  it('accepts a published, reviewed, correctly filed item', () => {
    expect(countsAsVerifiedCoverage(target, record({ questionId: 'q1', cellId: 'c1' }))).toBe(true);
  });

  it('rejects an item whose review is for an earlier version of its text', () => {
    expect(countsAsVerifiedCoverage(target, record({ questionId: 'q-stale', cellId: 'c1', contentVersion: 3, verifiedContentVersion: 2 }))).toBe(false);
    expect(countsAsVerifiedCoverage(target, record({ questionId: 'q-fresh', cellId: 'c1', contentVersion: 3, verifiedContentVersion: 3 }))).toBe(true);
    expect(countsAsVerifiedCoverage(target, record({ questionId: 'q-never', cellId: 'c1', verifiedContentVersion: null }))).toBe(false);
  });

  it('rejects demo, draft, archived, unreviewed and misfiled items', () => {
    const rejected: BlueprintQuestionRecord[] = [
      record({ questionId: 'q2', cellId: 'c1', demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
      record({ questionId: 'q3', cellId: 'c1', status: 'draft' }),
      record({ questionId: 'q4', cellId: 'c1', status: 'archived' }),
      record({ questionId: 'q5', cellId: 'c1', verificationStatus: 'author-checked', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
      record({ questionId: 'q5b', cellId: 'c1', verificationStatus: 'pending-review', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
      record({ questionId: 'q6', cellId: 'c1', verificationStatus: 'unverified', reviewer: null, reviewedAt: null, sourceType: 'template-generated', verifiedContentVersion: null }),
      record({ questionId: 'q7', cellId: 'c1', topicId: 'other-topic' }),
      record({ questionId: 'q8', cellId: 'c1', subject: 'physics' }),
      record({ questionId: 'q9', cellId: 'c1', difficulty: 5 }),
      record({ questionId: 'q10', cellId: 'c1', questionType: 'estimation' }),
      record({ questionId: 'q11', cellId: 'other-cell' }),
    ];

    for (const item of rejected) {
      expect(countsAsVerifiedCoverage(target, item)).toBe(false);
    }
  });
});

describe('coverage evaluation', () => {
  const cells = [cell({ id: 'c1' }), cell({ id: 'c2' }), cell({ id: 'c3' })];

  it('calls a cell with no items empty', () => {
    const coverage = evaluateBlueprintCoverage(cells, []);
    expect(coverage.totals.empty).toBe(3);
    expect(coverage.gaps).toHaveLength(3);
    expect(coverage.cells[0]?.reasons[0]).toMatch(/No question has been authored/);
  });

  it('does not count demo content as coverage and says so', () => {
    const coverage = evaluateBlueprintCoverage(cells, [
      record({ questionId: 'q1', cellId: 'c1', demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null }),
      record({ questionId: 'q2', cellId: 'c1', demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
    ]);
    const first = coverage.cells.find((entry) => entry.cell.id === 'c1');
    expect(first?.totalItems).toBe(2);
    expect(first?.demoItems).toBe(2);
    expect(first?.verifiedItems).toBe(0);
    expect(first?.status).toBe('unverified');
    expect(first?.reasons.join(' ')).toMatch(/2 demo/);
  });

  it('computes coverage from the bank, never from a stored number', () => {
    const coverage = evaluateBlueprintCoverage(cells, [
      record({ questionId: 'q1', cellId: 'c1' }),
      record({ questionId: 'q2', cellId: 'c1' }),
      record({ questionId: 'q3', cellId: 'c2' }),
    ]);
    expect(coverage.cells.find((entry) => entry.cell.id === 'c1')?.verifiedItems).toBe(2);
    expect(coverage.cells.find((entry) => entry.cell.id === 'c1')?.status).toBe('covered');
    expect(coverage.cells.find((entry) => entry.cell.id === 'c2')?.status).toBe('partial');
    expect(coverage.cells.find((entry) => entry.cell.id === 'c3')?.status).toBe('empty');
    expect(coverage.verifiedCells).toBe(1);
  });

  it('reports a required language with no verified item', () => {
    const bilingual = [cell({ id: 'c1', supportedLanguages: ['en', 'ru'], minimumItems: 1 })];
    const coverage = evaluateBlueprintCoverage(bilingual, [record({ questionId: 'q1', cellId: 'c1', language: 'en' })]);
    expect(coverage.cells[0]?.missingLanguages).toEqual(['ru']);
    expect(coverage.cells[0]?.status).toBe('partial');
  });

  it('reports a required difficulty or question type with no verified item', () => {
    const wide = [cell({ id: 'c1', minimumItems: 1, difficultyLevels: [1, 4], questionTypes: ['estimation', 'graph-reading'] })];
    const coverage = evaluateBlueprintCoverage(wide, [
      record({ questionId: 'q1', cellId: 'c1', difficulty: 1, questionType: 'estimation' }),
    ]);
    expect(coverage.cells[0]?.missingDifficulties).toEqual([4]);
    expect(coverage.cells[0]?.missingQuestionTypes).toEqual(['graph-reading']);
    expect(coverage.cells[0]?.status).toBe('partial');
  });

  it('flags a published question that belongs to no blueprint cell', () => {
    const coverage = evaluateBlueprintCoverage(cells, [record({ questionId: 'stray', cellId: null })]);
    expect(coverage.orphanQuestionIds).toEqual(['stray']);
    expect(coverage.issues.some((issue) => issue.code === 'question-without-cell')).toBe(true);
  });

  it('flags an item filed under the wrong subject or topic', () => {
    const coverage = evaluateBlueprintCoverage(cells, [
      record({ questionId: 'q1', cellId: 'c1', subject: 'physics' }),
      record({ questionId: 'q2', cellId: 'c1', topicId: 'not-this-topic' }),
    ]);
    expect(coverage.issues.some((issue) => issue.code === 'question-subject-mismatch')).toBe(true);
    expect(coverage.issues.some((issue) => issue.code === 'question-topic-mismatch')).toBe(true);
  });

  it('flags duplicate cell and question ids', () => {
    const coverage = evaluateBlueprintCoverage([cell({ id: 'c1' }), cell({ id: 'c1' })], [
      record({ questionId: 'q1', cellId: 'c1' }),
      record({ questionId: 'q1', cellId: 'c1' }),
    ]);
    expect(coverage.issues.some((issue) => issue.code === 'duplicate-cell-id')).toBe(true);
    expect(coverage.issues.some((issue) => issue.code === 'duplicate-question-id')).toBe(true);
  });

  it('reports insufficient coverage for a required exam mode', () => {
    const coverage = evaluateBlueprintCoverage(cells, [], { requiredModes: ['mock'] });
    expect(coverage.issues.some((issue) => issue.code === 'insufficient-mode-coverage')).toBe(true);
  });
});

describe('distribution skew', () => {
  const many = (count: number, overrides: Partial<BlueprintQuestionRecord>) =>
    Array.from({ length: count }, (_, index) => record({ questionId: `q${index}`, cellId: 'c1', ...overrides }));

  it('does not report skew on a small sample', () => {
    expect(answerDistributionSkew(many(6, { correctAnswerLabel: 'a' })).skewed).toBe(false);
  });

  it('reports a dominant answer key', () => {
    const skew = answerDistributionSkew([...many(9, { correctAnswerLabel: 'a' }), ...many(3, { correctAnswerLabel: 'b' })]);
    expect(skew.skewed).toBe(true);
    expect(skew.dominantLabel).toBe('a');
  });

  it('reports a dominant difficulty', () => {
    expect(difficultyDistributionSkew(many(12, { difficulty: 2 })).skewed).toBe(true);
  });

  it('accepts a spread answer key', () => {
    const spread = [
      ...many(3, { correctAnswerLabel: 'a' }),
      ...many(3, { correctAnswerLabel: 'b' }),
      ...many(3, { correctAnswerLabel: 'c' }),
      ...many(3, { correctAnswerLabel: 'd' }),
    ];
    expect(answerDistributionSkew(spread).skewed).toBe(false);
  });
});

describe('prerequisites', () => {
  it('reports a prerequisite that names no cell', () => {
    const { dangling } = analysePrerequisites([cell({ id: 'c1', prerequisiteCellIds: ['missing'] })]);
    expect(dangling).toEqual([{ cellId: 'c1', missing: ['missing'] }]);
  });

  it('detects a cycle', () => {
    const { cycles } = analysePrerequisites([
      cell({ id: 'a', prerequisiteCellIds: ['b'] }),
      cell({ id: 'b', prerequisiteCellIds: ['a'] }),
    ]);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('accepts a clean chain', () => {
    const { dangling, cycles } = analysePrerequisites([
      cell({ id: 'a' }),
      cell({ id: 'b', prerequisiteCellIds: ['a'] }),
      cell({ id: 'c', prerequisiteCellIds: ['b'] }),
    ]);
    expect(dangling).toEqual([]);
    expect(cycles).toEqual([]);
  });

  it('builds a repair path in prerequisite order, deepest first', () => {
    const cells = [
      cell({ id: 'arith' }),
      cell({ id: 'algebra', prerequisiteCellIds: ['arith'] }),
      cell({ id: 'quadratics', prerequisiteCellIds: ['algebra'] }),
    ];
    expect(prerequisiteRepairPath(cells, ['quadratics'])).toEqual(['arith', 'algebra']);
  });

  it('does not loop forever on a cyclic graph', () => {
    const cells = [
      cell({ id: 'a', prerequisiteCellIds: ['b'] }),
      cell({ id: 'b', prerequisiteCellIds: ['a'] }),
    ];
    expect(prerequisiteRepairPath(cells, ['a'])).toEqual(['a', 'b']);
  });
});

describe('publication gate', () => {
  const cells = [
    cell({ id: 'c1', minimumItems: 1 }),
    cell({ id: 'c2', minimumItems: 1 }),
    cell({ id: 'practice-only', minimumItems: 1, allowedExamModes: ['practice'] }),
    cell({ id: 'phys-1', minimumItems: 1, subject: 'physics', topicId: 'mech-1' }),
  ];
  const allVerified = cells.map((entry) =>
    record({ questionId: `q-${entry.id}`, cellId: entry.id, subject: entry.subject, topicId: entry.topicId }),
  );

  it('allows a mock whose cells are all covered and mock-eligible', () => {
    const coverage = evaluateBlueprintCoverage(cells, allVerified);
    expect(canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['c1', 'c2'] })).toEqual({
      allowed: true,
      blockers: [],
    });
  });

  it('refuses a mock that draws on an empty cell', () => {
    const coverage = evaluateBlueprintCoverage(cells, allVerified.filter((entry) => entry.cellId !== 'c2'));
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['c1', 'c2'] });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/c2: No question has been authored/);
  });

  it('refuses a mock whose cell has only demo content', () => {
    const coverage = evaluateBlueprintCoverage(cells, [
      record({ questionId: 'q-c1', cellId: 'c1' }),
      record({ questionId: 'q-c2', cellId: 'c2', demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
    ]);
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['c1', 'c2'] });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/none reviewer-verified/);
  });

  it('refuses a cell that is not allowed in that exam mode', () => {
    const coverage = evaluateBlueprintCoverage(cells, allVerified);
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['c1', 'practice-only'] });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/not allowed in mock mode/);
  });

  it('refuses a cell from another subject, an unknown cell and a repeated cell', () => {
    const coverage = evaluateBlueprintCoverage(cells, allVerified);
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['phys-1', 'nope', 'c1', 'c1'] });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/belongs to physics/);
    expect(decision.blockers.join(' ')).toMatch(/not a blueprint cell/);
    expect(decision.blockers.join(' ')).toMatch(/more than once/);
  });

  it('refuses an exam that references no cell at all', () => {
    const coverage = evaluateBlueprintCoverage(cells, allVerified);
    expect(canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: [] }).allowed).toBe(false);
  });

  it('refuses a cell whose prerequisite does not exist', () => {
    const broken = [cell({ id: 'c1', minimumItems: 1, prerequisiteCellIds: ['ghost'] })];
    const coverage = evaluateBlueprintCoverage(broken, [record({ questionId: 'q1', cellId: 'c1' })]);
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: ['c1'] });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/does not exist/);
  });
});

describe('distribution reporting', () => {
  it('counts topics, difficulties, question types and modules', () => {
    const distribution = describeDistribution([
      cell({ id: 'a', difficultyLevels: [1], questionTypes: ['graph-reading'], topicId: 't1', module: 'M1' }),
      cell({ id: 'b', difficultyLevels: [1], questionTypes: ['estimation'], topicId: 't1', module: 'M1' }),
      cell({ id: 'c', difficultyLevels: [4], questionTypes: ['graph-reading'], topicId: 't2', module: 'M2' }),
    ]);
    expect(distribution.byTopic).toEqual({ t1: 2, t2: 1 });
    expect(distribution.byDifficulty).toEqual({ '1': 2, '4': 1 });
    expect(distribution.byQuestionType).toEqual({ 'graph-reading': 2, estimation: 1 });
    expect(distribution.byModule).toEqual({ M1: 2, M2: 1 });
  });
});
