import { describe, expect, it } from 'vitest';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { AUTHORED_SLICE_CELL_IDS, DRAFT_QUESTION_SEED } from '@/data/draft-questions';
import {
  BlueprintQuestionRecordSchema,
  canPublishExam,
  evaluateBlueprintCoverage,
  type BlueprintQuestionRecord,
  type VerificationStatus,
} from './blueprint';

/**
 * What coverage does and does not count, exercised against the real blueprint
 * seed and the real authored slice rather than fixtures. This is the property
 * that keeps a score from being presented as readiness.
 */

const REVIEWED_AT = '2026-09-02T09:00:00.000Z';

function asRecord(
  question: (typeof DRAFT_QUESTION_SEED)[number],
  overrides: Partial<BlueprintQuestionRecord> = {},
): BlueprintQuestionRecord {
  return BlueprintQuestionRecordSchema.parse({
    questionId: question.id,
    cellId: question.cellId,
    subject: question.subject,
    topicId: question.topicId,
    difficulty: question.difficulty,
    questionType: question.questionType,
    language: question.language,
    status: 'published',
    demo: false,
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'Authored for CSCA Prep',
    reviewer: 'A. Reviewer',
    reviewedAt: REVIEWED_AT,
    correctAnswerLabel: question.correctAnswer,
    knownLimitations: '',
    contentVersion: 1,
    verifiedContentVersion: 1,
    ...overrides,
  });
}

const SLICE = new Set<string>(AUTHORED_SLICE_CELL_IDS);
const OTHER_CELLS = BLUEPRINT_CELL_SEED.filter((cell) => !SLICE.has(cell.id));

describe('states that never count as coverage', () => {
  const uncounted: { label: string; overrides: Partial<BlueprintQuestionRecord> }[] = [
    { label: 'draft', overrides: { verificationStatus: 'draft', reviewer: null, reviewedAt: null, verifiedContentVersion: null } },
    { label: 'pending review', overrides: { verificationStatus: 'pending-review', reviewer: null, reviewedAt: null, verifiedContentVersion: null } },
    { label: 'author-checked but unreviewed', overrides: { verificationStatus: 'author-checked', reviewer: null, reviewedAt: null, verifiedContentVersion: null } },
    { label: 'demo', overrides: { demo: true, verificationStatus: 'demo', reviewer: null, reviewedAt: null, verifiedContentVersion: null } },
    { label: 'unpublished draft in the bank', overrides: { status: 'draft' } },
    { label: 'archived', overrides: { status: 'archived' } },
    { label: 'verified at an older content version', overrides: { contentVersion: 4, verifiedContentVersion: 3 } },
    { label: 'never reviewed at any version', overrides: { verifiedContentVersion: null } },
  ];

  for (const { label, overrides } of uncounted) {
    it(`does not count ${label}`, () => {
      const bank = DRAFT_QUESTION_SEED.map((question) => asRecord(question, overrides));
      const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, bank);
      expect(coverage.totals.covered).toBe(0);
      expect(coverage.verifiedCells).toBe(0);
      for (const cellId of AUTHORED_SLICE_CELL_IDS) {
        const entry = coverage.cells.find((item) => item.cell.id === cellId);
        expect(entry?.verifiedItems, cellId).toBe(0);
        expect(entry?.status, cellId).not.toBe('covered');
      }
    });
  }

  it('technical self-consistency alone is not verification', () => {
    // These are the same items whose arithmetic `draft-questions.test.ts` proves
    // correct. Passing those checks changes nothing about coverage.
    const bank = DRAFT_QUESTION_SEED.map((question) =>
      asRecord(question, {
        verificationStatus: 'pending-review' satisfies VerificationStatus,
        reviewer: null,
        reviewedAt: null,
        verifiedContentVersion: null,
      }),
    );
    const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, bank);
    expect(coverage.totals.covered).toBe(0);
    expect(coverage.cells.filter((entry) => entry.status === 'unverified')).toHaveLength(
      AUTHORED_SLICE_CELL_IDS.length,
    );
  });
});

describe('after a real human approval', () => {
  const verifiedBank = DRAFT_QUESTION_SEED.map((question) => asRecord(question));
  const coverage = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, verifiedBank);

  it('covers exactly the six cells of the authored slice', () => {
    const covered = coverage.cells.filter((entry) => entry.status === 'covered').map((entry) => entry.cell.id);
    expect(covered.sort()).toEqual([...AUTHORED_SLICE_CELL_IDS].sort());
    expect(coverage.verifiedCells).toBe(6);
  });

  it('leaves the other 99 cells empty', () => {
    for (const cell of OTHER_CELLS) {
      const entry = coverage.cells.find((item) => item.cell.id === cell.id);
      expect(entry?.status, cell.id).toBe('empty');
    }
    expect(coverage.totals.empty).toBe(99);
  });

  it('raises no structural issue', () => {
    expect(coverage.issues.filter((issue) => issue.severity === 'blocker')).toEqual([]);
    expect(coverage.orphanQuestionIds).toEqual([]);
  });

  it('allows an exam built only from those six covered cells', () => {
    const decision = canPublishExam(coverage, {
      subject: 'mathematics',
      mode: 'mock',
      cellIds: [...AUTHORED_SLICE_CELL_IDS],
    });
    expect(decision).toEqual({ allowed: true, blockers: [] });
  });

  it('still refuses a mock that draws on the rest of the Mathematics blueprint', () => {
    const allMathematicsCells = BLUEPRINT_CELL_SEED.filter(
      (cell) => cell.subject === 'mathematics' && cell.allowedExamModes.includes('mock'),
    ).map((cell) => cell.id);
    const decision = canPublishExam(coverage, {
      subject: 'mathematics',
      mode: 'mock',
      cellIds: allMathematicsCells,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.blockers.length).toBeGreaterThan(30);
    expect(decision.blockers.join(' ')).toMatch(/No question has been authored/);
  });

  it('refuses a Physics mock entirely: none of it is authored', () => {
    const physicsCells = BLUEPRINT_CELL_SEED.filter((cell) => cell.subject === 'physics').map((cell) => cell.id);
    const decision = canPublishExam(coverage, { subject: 'physics', mode: 'mock', cellIds: physicsCells });
    expect(decision.allowed).toBe(false);
  });

  it('stops counting an item as soon as its text changes after approval', () => {
    const editedAfterApproval = verifiedBank.map((item) =>
      item.cellId === 'math-linear-isolate-unknown' ? { ...item, contentVersion: item.contentVersion + 1 } : item,
    );
    const after = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, editedAfterApproval);
    const entry = after.cells.find((item) => item.cell.id === 'math-linear-isolate-unknown');
    expect(entry?.verifiedItems).toBe(0);
    expect(entry?.status).toBe('unverified');
    expect(after.verifiedCells).toBe(5);
    expect(
      canPublishExam(after, { subject: 'mathematics', mode: 'mock', cellIds: [...AUTHORED_SLICE_CELL_IDS] }).allowed,
    ).toBe(false);
  });

  it('lets one approved item cover only its own cell', () => {
    const singleCell = DRAFT_QUESTION_SEED.map((question) =>
      question.cellId === 'math-linear-isolate-unknown'
        ? asRecord(question)
        : asRecord(question, {
            verificationStatus: 'pending-review',
            reviewer: null,
            reviewedAt: null,
            verifiedContentVersion: null,
          }),
    );
    const partial = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, singleCell);
    expect(partial.cells.filter((entry) => entry.status === 'covered').map((entry) => entry.cell.id)).toEqual([
      'math-linear-isolate-unknown',
    ]);
  });
});
