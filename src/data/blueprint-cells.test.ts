import { describe, expect, it } from 'vitest';
import { mathTopics, physicsTopics } from '@/data/curriculum';
import { BLUEPRINT_CELL_SEED, BLUEPRINT_CELLS_BY_SUBJECT } from '@/data/blueprint-cells';
import {
  BlueprintCellSchema,
  BlueprintQuestionRecordSchema,
  analysePrerequisites,
  canPublishExam,
  evaluateBlueprintCoverage,
} from '@/features/blueprint/blueprint';

describe('blueprint seed shape', () => {
  it('parses every cell against the schema', () => {
    for (const cell of BLUEPRINT_CELL_SEED) {
      const parsed = BlueprintCellSchema.safeParse(cell);
      if (!parsed.success) {
        throw new Error(`${cell.id}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`);
      }
    }
    expect(BLUEPRINT_CELL_SEED.length).toBeGreaterThan(80);
  });

  it('uses stable unique cell ids', () => {
    const ids = BLUEPRINT_CELL_SEED.map((cell) => cell.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('derives every cell id from its topic, so a cell cannot drift from its topic', () => {
    for (const cell of BLUEPRINT_CELL_SEED) {
      expect(cell.id.startsWith(`${cell.topicId}-`)).toBe(true);
      expect(cell.id).toBe(`${cell.topicId}-${cell.microSkillId}`);
    }
  });

  it('keeps every cell in its subject namespace', () => {
    for (const cell of BLUEPRINT_CELLS_BY_SUBJECT.mathematics) {
      expect(cell.subject).toBe('mathematics');
      expect(cell.topicId.startsWith('math-')).toBe(true);
    }
    for (const cell of BLUEPRINT_CELLS_BY_SUBJECT.physics) {
      expect(cell.subject).toBe('physics');
      expect(cell.topicId.startsWith('phys-')).toBe(true);
    }
    expect(BLUEPRINT_CELLS_BY_SUBJECT.mathematics.length + BLUEPRINT_CELLS_BY_SUBJECT.physics.length).toBe(
      BLUEPRINT_CELL_SEED.length,
    );
  });
});

describe('the seed claims nothing it has not earned', () => {
  it('leaves every cell draft, unreviewed and undated', () => {
    for (const cell of BLUEPRINT_CELL_SEED) {
      expect(cell.verificationStatus).toBe('draft');
      expect(cell.reviewer).toBeNull();
      expect(cell.reviewedAt).toBeNull();
    }
  });

  it('never claims to be an official CSCA specification', () => {
    for (const cell of BLUEPRINT_CELL_SEED) {
      expect(cell.sourceType).not.toBe('official-outline');
      expect(cell.sourceReference).toMatch(/Not an official CSCA specification/);
      expect(cell.knownLimitations).toMatch(/no subject-matter review/i);
    }
  });

  it('records a real, checkable source rather than an invented one', () => {
    for (const cell of BLUEPRINT_CELL_SEED) {
      expect(cell.sourceReference).toMatch(/src\/data\/curriculum\.ts/);
    }
  });
});

describe('curriculum alignment', () => {
  const moduleCount = (subject: 'mathematics' | 'physics') =>
    new Set(BLUEPRINT_CELLS_BY_SUBJECT[subject].map((cell) => cell.module)).size;

  it('covers a topic for every subject area the curriculum lists', () => {
    // The blueprint groups the curriculum's topic names into modules, so it has
    // fewer modules than topic names but must not have fewer topics than modules.
    const mathTopicIds = new Set(BLUEPRINT_CELLS_BY_SUBJECT.mathematics.map((cell) => cell.topicId));
    const physicsTopicIds = new Set(BLUEPRINT_CELLS_BY_SUBJECT.physics.map((cell) => cell.topicId));

    expect(mathTopicIds.size).toBeGreaterThanOrEqual(moduleCount('mathematics'));
    expect(physicsTopicIds.size).toBeGreaterThanOrEqual(moduleCount('physics'));
    expect(mathTopics.length).toBeGreaterThan(0);
    expect(physicsTopics.length).toBeGreaterThan(0);
  });

  it('gives every topic at least one micro-skill and every micro-skill a difficulty and a question type', () => {
    const byTopic = new Map<string, number>();
    for (const cell of BLUEPRINT_CELL_SEED) {
      byTopic.set(cell.topicId, (byTopic.get(cell.topicId) ?? 0) + 1);
      expect(cell.difficultyLevels.length).toBeGreaterThan(0);
      expect(cell.questionTypes.length).toBeGreaterThan(0);
      expect(cell.supportedLanguages).toContain('en');
      expect(cell.allowedExamModes.length).toBeGreaterThan(0);
      expect(cell.minimumItems).toBeGreaterThan(0);
    }
    for (const [, count] of byTopic) expect(count).toBeGreaterThan(0);
  });

  it('keeps one skill and topic title per topic id', () => {
    const titles = new Map<string, string>();
    for (const cell of BLUEPRINT_CELL_SEED) {
      const existing = titles.get(cell.topicId);
      if (existing) expect(cell.topic).toBe(existing);
      else titles.set(cell.topicId, cell.topic);
    }
  });
});

describe('prerequisite graph', () => {
  it('has no orphan prerequisite and no cycle', () => {
    const { dangling, cycles } = analysePrerequisites(BLUEPRINT_CELL_SEED);
    expect(dangling).toEqual([]);
    expect(cycles).toEqual([]);
  });

  it('never crosses subjects in a prerequisite', () => {
    const subjectById = new Map(BLUEPRINT_CELL_SEED.map((cell) => [cell.id, cell.subject]));
    for (const cell of BLUEPRINT_CELL_SEED) {
      for (const prerequisite of cell.prerequisiteCellIds) {
        expect(subjectById.get(prerequisite)).toBe(cell.subject);
      }
    }
  });

  it('starts each subject from at least one cell with no prerequisite', () => {
    for (const subject of ['mathematics', 'physics'] as const) {
      const roots = BLUEPRINT_CELLS_BY_SUBJECT[subject].filter((cell) => cell.prerequisiteCellIds.length === 0);
      expect(roots.length).toBeGreaterThan(0);
    }
  });
});

describe('coverage of the seed as it stands today', () => {
  const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, []);

  it('reports every cell empty, because no reviewed question exists yet', () => {
    expect(coverage.totals.empty).toBe(BLUEPRINT_CELL_SEED.length);
    expect(coverage.totals.covered).toBe(0);
    expect(coverage.verifiedCells).toBe(0);
    expect(coverage.gaps).toHaveLength(BLUEPRINT_CELL_SEED.length);
  });

  it('raises no structural issue: the gaps are content, not a broken blueprint', () => {
    expect(coverage.issues).toEqual([]);
    expect(coverage.danglingPrerequisites).toEqual([]);
    expect(coverage.prerequisiteCycles).toEqual([]);
    expect(coverage.orphanQuestionIds).toEqual([]);
  });

  it('refuses to publish a mock from the seed alone', () => {
    const mockCells = BLUEPRINT_CELLS_BY_SUBJECT.mathematics
      .filter((cell) => cell.allowedExamModes.includes('mock'))
      .slice(0, 5)
      .map((cell) => cell.id);
    const decision = canPublishExam(coverage, { subject: 'mathematics', mode: 'mock', cellIds: mockCells });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.join(' ')).toMatch(/No question has been authored/);
  });

  it('still refuses when the bank holds only demo questions', () => {
    const cell = BLUEPRINT_CELL_SEED[0]!;
    const demoBank = [
      BlueprintQuestionRecordSchema.parse({
        questionId: 'demo-1',
        cellId: cell.id,
        subject: cell.subject,
        topicId: cell.topicId,
        difficulty: cell.difficultyLevels[0],
        questionType: cell.questionTypes[0],
        language: 'en',
        status: 'published',
        demo: true,
        verificationStatus: 'demo',
        sourceType: 'template-generated',
        sourceReference: 'Generated in the browser for the local demo',
        reviewer: null,
        reviewedAt: null,
        correctAnswerLabel: 'a',
        knownLimitations: '',
        contentVersion: 1,
        verifiedContentVersion: null,
      }),
    ];
    const demoCoverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, demoBank);
    const entry = demoCoverage.cells.find((item) => item.cell.id === cell.id);
    expect(entry?.demoItems).toBe(1);
    expect(entry?.verifiedItems).toBe(0);
    expect(entry?.status).toBe('unverified');
    expect(canPublishExam(demoCoverage, { subject: cell.subject, mode: 'mock', cellIds: [cell.id] }).allowed).toBe(false);
  });
});

describe('rejections the seed must keep enforcing', () => {
  const base = BLUEPRINT_CELL_SEED[0]!;

  it('rejects a cell marked verified with no reviewer', () => {
    expect(
      BlueprintCellSchema.safeParse({ ...base, verificationStatus: 'reviewer-verified', reviewedAt: '2026-09-01T00:00:00.000Z' }).success,
    ).toBe(false);
  });

  it('rejects a cell marked verified with no review date', () => {
    expect(
      BlueprintCellSchema.safeParse({ ...base, verificationStatus: 'reviewer-verified', reviewer: 'A. Reviewer' }).success,
    ).toBe(false);
  });

  it('accepts a cell marked verified only with both', () => {
    expect(
      BlueprintCellSchema.safeParse({
        ...base,
        verificationStatus: 'reviewer-verified',
        reviewer: 'A. Reviewer',
        reviewedAt: '2026-09-01T00:00:00.000Z',
      }).success,
    ).toBe(true);
  });

  it('flags a published question that names no seeded cell', () => {
    const stray = BlueprintQuestionRecordSchema.parse({
      questionId: 'stray-1',
      cellId: 'no-such-cell',
      subject: 'mathematics',
      topicId: 'math-foundation',
      difficulty: 2,
      questionType: 'single-step-calculation',
      language: 'en',
      status: 'published',
      demo: false,
      verificationStatus: 'draft',
      sourceType: 'original-csca-style',
      sourceReference: 'Authored for CSCA Prep',
      reviewer: null,
      reviewedAt: null,
      correctAnswerLabel: 'a',
      knownLimitations: '',
      contentVersion: 1,
      verifiedContentVersion: null,
    });
    const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, [stray]);
    expect(coverage.orphanQuestionIds).toEqual(['stray-1']);
    expect(coverage.issues.some((issue) => issue.code === 'question-without-cell')).toBe(true);
  });

  it('flags a question filed under the wrong subject or topic for its cell', () => {
    const cell = BLUEPRINT_CELL_SEED[0]!;
    const misfiled = BlueprintQuestionRecordSchema.parse({
      questionId: 'misfiled-1',
      cellId: cell.id,
      subject: 'physics',
      topicId: 'phys-units',
      difficulty: 2,
      questionType: 'single-step-calculation',
      language: 'en',
      status: 'published',
      demo: false,
      verificationStatus: 'draft',
      sourceType: 'original-csca-style',
      sourceReference: 'Authored for CSCA Prep',
      reviewer: null,
      reviewedAt: null,
      correctAnswerLabel: 'a',
      knownLimitations: '',
      contentVersion: 1,
      verifiedContentVersion: null,
    });
    const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, [misfiled]);
    expect(coverage.issues.some((issue) => issue.code === 'question-subject-mismatch')).toBe(true);
    expect(coverage.issues.some((issue) => issue.code === 'question-topic-mismatch')).toBe(true);
  });
});
