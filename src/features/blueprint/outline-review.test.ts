import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkRequiredAreas,
  outlineIsConfirmed,
  outlineReviewIsCurrent,
  summariseOutlineReviews,
  validateOutlineReview,
  EMPTY_OUTLINE_REVIEW,
  OUTLINE_REVIEW_STATUSES,
  REQUIRED_AREAS,
  type OutlineReviewRecord,
} from '../../../functions/src/outline-engine';
import { recordOutlineReview, readOutlineReviews } from '../../../functions/src/outline-callables';
import { RecordOutlineReviewSchema } from '../../../functions/src/schemas';
import { BLUEPRINT_CELL_SEED } from '../../../functions/src/blueprint-seed';
import { evaluateBlueprintCoverage } from './blueprint';
import { listDocuments, readDocument, resetFirestore, seedDocument } from '@/test/firebase/firestore';
import type { CallableRequest, TestableCallable } from '@/test/firebase/functions';

const ADMIN = { uid: 'admin-1', token: { admin: true, email: 'reviewer@example.test' } };
const LEARNER = { uid: 'learner-1', token: { email: 'learner@example.test' } };
const CELL_ID = 'math-linear-isolate-unknown';

function run<R>(callable: unknown, data: Record<string, unknown>, auth: CallableRequest['auth'] | null = ADMIN): Promise<R> {
  const request = { data, ...(auth === null ? {} : { auth }) } as CallableRequest<Record<string, unknown>>;
  return (callable as TestableCallable<Record<string, unknown>, R>).__handler(request);
}

async function refusalOf(promise: Promise<unknown>): Promise<{ code: string; message: string; details: unknown }> {
  try {
    await promise;
  } catch (cause) {
    const error = cause as { code?: string; message?: string; details?: unknown };
    return { code: error.code ?? '', message: error.message ?? '', details: error.details };
  }
  throw new Error('Expected a refusal, but the call succeeded.');
}

function seedCell(version = 1): void {
  seedDocument('blueprintCells', CELL_ID, {
    subject: 'mathematics',
    module: 'Algebra',
    topic: 'Linear equations',
    skill: 'Solve linear relations',
    microSkill: 'Isolate the unknown',
    version,
  });
}

const VALID = {
  cellId: CELL_ID,
  status: 'matches-source' as const,
  expectedCellVersion: 1,
  sourceUrl: 'https://example.edu/csca-outline-2026.pdf',
  sourceTitle: 'CSCA subject outline',
  sourceEdition: '2026 edition',
  sourcePublishedAt: '2026-01-15',
  differenceNote: '',
  ownSummary: 'Source requires one-step linear equations at this level.',
  ownWordsAttested: true as const,
};

beforeEach(resetFirestore);

describe('the wire contract', () => {
  it('accepts a complete review', () => {
    expect(RecordOutlineReviewSchema.safeParse(VALID).success).toBe(true);
  });

  it('refuses a caller-supplied reviewer, time or version', () => {
    for (const forged of [
      { reviewer: 'Someone Else' },
      { reviewerUid: 'other-uid' },
      { reviewedAt: '2020-01-01T00:00:00.000Z' },
      { lastCheckedAt: '2020-01-01T00:00:00.000Z' },
      { version: 99 },
      { reviewedCellVersion: 99 },
    ]) {
      expect(RecordOutlineReviewSchema.safeParse({ ...VALID, ...forged }).success, JSON.stringify(forged)).toBe(false);
    }
  });

  it('has no field able to hold an extract of the source', () => {
    for (const forged of [
      { sourceText: 'A verbatim paragraph from the official document.' },
      { extract: 'copied' },
      { officialWording: 'copied' },
      { attachment: 'copied' },
    ]) {
      expect(RecordOutlineReviewSchema.safeParse({ ...VALID, ...forged }).success, JSON.stringify(forged)).toBe(false);
    }
    // The two free-text fields are bounded, so neither can hold a document.
    expect(RecordOutlineReviewSchema.safeParse({ ...VALID, ownSummary: 'x'.repeat(401) }).success).toBe(false);
    expect(RecordOutlineReviewSchema.safeParse({ ...VALID, differenceNote: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('requires the reviewer to attest the summary is their own words', () => {
    const withoutAttestation: Record<string, unknown> = { ...VALID };
    delete withoutAttestation.ownWordsAttested;
    expect(RecordOutlineReviewSchema.safeParse(withoutAttestation).success).toBe(false);
    expect(RecordOutlineReviewSchema.safeParse({ ...VALID, ownWordsAttested: false }).success).toBe(false);
  });

  it('cannot record the status back to unreviewed', () => {
    expect(RecordOutlineReviewSchema.safeParse({ ...VALID, status: 'unreviewed' }).success).toBe(false);
  });
});

describe('what a review must contain', () => {
  it('requires a named, dated, linked source for a substantive judgement', () => {
    for (const status of ['matches-source', 'difference-found', 'superseded'] as const) {
      const codes = validateOutlineReview({ status, differenceNote: 'A stated difference in scope.' }).map((p) => p.code);
      expect(codes, status).toContain('source-url-required');
      expect(codes, status).toContain('source-title-required');
      expect(codes, status).toContain('source-date-required');
    }
  });

  it('lets a reviewer say a specialist is needed without having a source yet', () => {
    const problems = validateOutlineReview({
      status: 'needs-specialist',
      differenceNote: 'Cannot judge whether this is examinable without a physics specialist.',
    });
    expect(problems).toEqual([]);
  });

  it('requires an explanation whenever the answer is not a plain match', () => {
    for (const status of ['difference-found', 'needs-specialist', 'superseded'] as const) {
      const codes = validateOutlineReview({ ...VALID, status, differenceNote: '' }).map((p) => p.code);
      expect(codes, status).toContain('difference-note-required');
    }
    expect(validateOutlineReview({ ...VALID, status: 'matches-source', differenceNote: '' })).toEqual([]);
  });

  it('rejects a date that is not a real calendar shape', () => {
    const codes = validateOutlineReview({ ...VALID, sourcePublishedAt: 'January 2026' }).map((p) => p.code);
    expect(codes).toContain('source-date-required');
  });
});

describe('the version guard', () => {
  const reviewed: OutlineReviewRecord = {
    cellId: CELL_ID,
    ...EMPTY_OUTLINE_REVIEW,
    status: 'matches-source',
    reviewedCellVersion: 3,
    version: 1,
  };

  it('holds while the cell is unchanged', () => {
    expect(outlineReviewIsCurrent(reviewed, 3)).toBe(true);
    expect(outlineIsConfirmed(reviewed, 3)).toBe(true);
  });

  it('lapses the moment the cell is edited', () => {
    expect(outlineReviewIsCurrent(reviewed, 4)).toBe(false);
    expect(outlineIsConfirmed(reviewed, 4)).toBe(false);
  });

  it('treats an absent or unreviewed record as not current', () => {
    expect(outlineReviewIsCurrent(null, 1)).toBe(false);
    expect(outlineReviewIsCurrent({ cellId: CELL_ID, ...EMPTY_OUTLINE_REVIEW }, 0)).toBe(false);
  });

  it('refuses a write against a version the reviewer did not read', async () => {
    seedCell(2);
    const failure = await refusalOf(run(recordOutlineReview, { ...VALID, expectedCellVersion: 1 }));
    expect(failure.code).toBe('aborted');
    expect((failure.details as { code: string }).code).toBe('cell-version-moved');
    expect(readDocument('blueprintOutlineReviews', CELL_ID)).toBeUndefined();
  });
});

describe('recording a review', () => {
  beforeEach(() => seedCell(1));

  it('refuses an anonymous caller and a signed-in learner', async () => {
    expect((await refusalOf(run(recordOutlineReview, VALID, null))).code).toBe('unauthenticated');
    expect((await refusalOf(run(recordOutlineReview, VALID, LEARNER))).code).toBe('permission-denied');
    expect(listDocuments('blueprintOutlineReviews')).toHaveLength(0);
  });

  it('enforces App Check on both callables', () => {
    for (const callable of [recordOutlineReview, readOutlineReviews]) {
      const options = (callable as unknown as TestableCallable).__options;
      expect(options.enforceAppCheck).toBe(true);
      expect(options.consumeAppCheckToken).toBe(true);
    }
  });

  it('stamps the reviewer from the authenticated caller, not from the request', async () => {
    await run(recordOutlineReview, VALID);
    const stored = readDocument('blueprintOutlineReviews', CELL_ID);
    expect(stored?.reviewer).toBe('reviewer@example.test');
    expect(stored?.reviewerUid).toBe('admin-1');
    expect(typeof stored?.reviewedAt).toBe('string');
    expect(typeof stored?.lastCheckedAt).toBe('string');
    expect(stored?.reviewedCellVersion).toBe(1);
  });

  it('refuses an incomplete review rather than storing a partial judgement', async () => {
    const failure = await refusalOf(run(recordOutlineReview, { ...VALID, sourceUrl: null }));
    expect(failure.code).toBe('invalid-argument');
    expect(listDocuments('blueprintOutlineReviews')).toHaveLength(0);
  });

  it('refuses a cell that does not exist', async () => {
    expect((await refusalOf(run(recordOutlineReview, { ...VALID, cellId: 'no-such-cell' }))).code).toBe('not-found');
  });

  it('increments its own version on re-review, without touching the cell', async () => {
    await run(recordOutlineReview, VALID);
    await run(recordOutlineReview, { ...VALID, status: 'difference-found', differenceNote: 'The source now splits this into two outcomes.' });
    const stored = readDocument('blueprintOutlineReviews', CELL_ID);
    expect(stored?.version).toBe(2);
    expect(stored?.status).toBe('difference-found');
    expect(readDocument('blueprintCells', CELL_ID)?.version).toBe(1);
  });

  it('writes an audit entry with the status but not the reviewer’s note', async () => {
    await run(recordOutlineReview, {
      ...VALID,
      status: 'difference-found',
      differenceNote: 'PRIVATE-NOTE-TOKEN the source wording differs.',
    });
    const serialised = JSON.stringify(listDocuments('_auditLogs'));
    expect(serialised).toContain('blueprint.outlineReviewed');
    expect(serialised).toContain(CELL_ID);
    expect(serialised).not.toContain('PRIVATE-NOTE-TOKEN');
    expect(serialised).not.toContain('ownSummary');
  });
});

describe('reading the comparison screen', () => {
  it('returns every cell with its review state, defaulting to unreviewed', async () => {
    seedCell(1);
    seedDocument('blueprintCells', 'phys-optics-lens-mirror', { subject: 'physics', module: 'Optics', topic: 'Optics', skill: 'Lenses', microSkill: 'Apply the lens relation', version: 1 });

    const response = await run<{ cells: { id: string; review: { status: string } }[] }>(readOutlineReviews, {});

    expect(response.cells).toHaveLength(2);
    expect(response.cells.every((cell) => cell.review.status === 'unreviewed')).toBe(true);
  });

  it('filters by subject', async () => {
    seedCell(1);
    seedDocument('blueprintCells', 'phys-optics-lens-mirror', { subject: 'physics', module: 'Optics', topic: 'Optics', skill: 'Lenses', microSkill: 'Apply the lens relation', version: 1 });

    const response = await run<{ cells: { id: string }[] }>(readOutlineReviews, { subject: 'physics' });
    expect(response.cells.map((cell) => cell.id)).toEqual(['phys-optics-lens-mirror']);
  });
});

describe('an outline review is not a content verification', () => {
  /**
   * The property the whole separation exists for. A cell whose outline matches
   * the official source still has no approved questions, so coverage must not
   * move. Confusing the two would let a syllabus check silently unlock a mock.
   */
  it('does not make a cell count as covered', () => {
    const before = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, []);
    expect(before.verifiedCells).toBe(0);

    const records = new Map<string, OutlineReviewRecord>(
      BLUEPRINT_CELL_SEED.map((cell) => [
        cell.id,
        { cellId: cell.id, ...EMPTY_OUTLINE_REVIEW, status: 'matches-source' as const, reviewedCellVersion: cell.version, version: 1 },
      ]),
    );
    const outline = summariseOutlineReviews(BLUEPRINT_CELL_SEED, records);
    expect(outline.confirmed).toBe(BLUEPRINT_CELL_SEED.length);

    // Every cell confirmed against the source; coverage is still zero.
    const after = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, []);
    expect(after.verifiedCells).toBe(0);
    expect(after.totals.covered).toBe(0);
  });

  it('the coverage engine does not import the outline module', async () => {
    // `official-outline` is an existing sourceType value in that file and is
    // unrelated, so the check is on imports rather than on the word.
    const source = String((await import('../../../functions/src/blueprint-engine?raw')).default);
    const imports = [...source.matchAll(/(?:import|from)\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    expect(imports.filter((specifier) => /outline/i.test(specifier ?? ''))).toEqual([]);
    expect(source).not.toContain('OutlineReview');
    expect(source).not.toContain('outlineReview');
    // It imports nothing at all: it is the shared pure engine.
    expect(imports).toEqual([]);
  });
});

describe('the summary', () => {
  it('counts each status, and separates stale from unreviewed', () => {
    const cells = [
      { id: 'a', version: 1 },
      { id: 'b', version: 2 },
      { id: 'c', version: 1 },
      { id: 'd', version: 1 },
    ];
    const records = new Map<string, OutlineReviewRecord>([
      ['a', { cellId: 'a', ...EMPTY_OUTLINE_REVIEW, status: 'matches-source', reviewedCellVersion: 1, version: 1 }],
      // reviewed at version 1, but the cell has moved to 2 — stale, not counted.
      ['b', { cellId: 'b', ...EMPTY_OUTLINE_REVIEW, status: 'matches-source', reviewedCellVersion: 1, version: 1 }],
      ['c', { cellId: 'c', ...EMPTY_OUTLINE_REVIEW, status: 'difference-found', reviewedCellVersion: 1, version: 1 }],
    ]);

    expect(summariseOutlineReviews(cells, records)).toEqual({
      total: 4,
      unreviewed: 1,
      matchesSource: 1,
      differenceFound: 1,
      needsSpecialist: 0,
      superseded: 0,
      stale: 1,
      confirmed: 1,
    });
  });

  it('offers exactly the five statuses the workflow defines', () => {
    expect(OUTLINE_REVIEW_STATUSES).toEqual([
      'unreviewed',
      'matches-source',
      'difference-found',
      'needs-specialist',
      'superseded',
    ]);
  });
});

describe('the required-area checklist', () => {
  const coverage = checkRequiredAreas(BLUEPRINT_CELL_SEED);

  it('checks every area the audit named, in both subjects', () => {
    expect(REQUIRED_AREAS.filter((area) => area.subject === 'mathematics')).toHaveLength(9);
    expect(REQUIRED_AREAS.filter((area) => area.subject === 'physics')).toHaveLength(10);
  });

  it('reports the areas that match no cell at all as gaps', () => {
    const missing = coverage.filter((entry) => entry.missing).map((entry) => entry.area.id);
    expect(missing).toEqual(['math-solid-geometry', 'phys-kinetic-theory', 'phys-diffraction']);
  });

  it('reports interference as present only inside a bundled cell', () => {
    const interference = coverage.find((entry) => entry.area.id === 'phys-interference');
    expect(interference?.missing).toBe(false);
    expect(interference?.bundledOnly).toBe(true);
    expect(interference?.cellIds).toEqual(['phys-waves-wave-behaviour']);
  });

  it('records why each flagged area is called out, so the reason is not lost', () => {
    for (const entry of coverage.filter((item) => item.missing || item.bundledOnly)) {
      expect(entry.area.note.length, entry.area.id).toBeGreaterThan(20);
    }
  });

  it('finds the remaining areas present', () => {
    const fine = coverage.filter((entry) => !entry.missing && !entry.bundledOnly);
    expect(fine.length).toBe(REQUIRED_AREAS.length - 4);
  });
});
