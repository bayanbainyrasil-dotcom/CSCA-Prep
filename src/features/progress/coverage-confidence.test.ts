import { describe, expect, it } from 'vitest';
import {
  coverageConfidence,
  CATEGORY_DEFINITION,
  CONFIDENCE_DISCLAIMER,
  type CoverageCellSummary,
} from './coverage-confidence';
import { BLUEPRINT_CELL_COUNTS } from '../../../functions/src/blueprint-summary';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { AUTHORED_SLICE_CELL_IDS, DRAFT_QUESTION_SEED } from '@/data/draft-questions';
import {
  BlueprintQuestionRecordSchema,
  evaluateBlueprintCoverage,
  type BlueprintQuestionRecord,
} from '@/features/blueprint/blueprint';

/**
 * The counting rules behind the learner-facing panel. The four categories are
 * kept apart here, so nothing downstream can blend them into a single score.
 */

function summarise(items: BlueprintQuestionRecord[], mode?: 'mock' | 'practice'): CoverageCellSummary[] {
  const report = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, items, mode ? { mode } : {});
  return report.cells.map((entry) => ({
    id: entry.cell.id,
    subject: entry.cell.subject,
    status: entry.status,
    publicKeyItems: entry.publicKeyItems,
    demoItems: entry.demoItems,
    totalItems: entry.totalItems,
  }));
}

function record(question: (typeof DRAFT_QUESTION_SEED)[number], overrides: Partial<BlueprintQuestionRecord> = {}): BlueprintQuestionRecord {
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
    reviewedAt: '2026-09-03T09:00:00.000Z',
    correctAnswerLabel: question.correctAnswer,
    knownLimitations: '',
    contentVersion: 1,
    verifiedContentVersion: 1,
    ...overrides,
  });
}

describe('the denominator comes from the real seed', () => {
  it('matches the blueprint exactly, so the counts cannot drift', () => {
    expect(BLUEPRINT_CELL_COUNTS.total).toBe(BLUEPRINT_CELL_SEED.length);
    expect(BLUEPRINT_CELL_COUNTS.mathematics).toBe(BLUEPRINT_CELL_SEED.filter((cell) => cell.subject === 'mathematics').length);
    expect(BLUEPRINT_CELL_COUNTS.physics).toBe(BLUEPRINT_CELL_SEED.filter((cell) => cell.subject === 'physics').length);
    expect(BLUEPRINT_CELL_COUNTS.mathematics + BLUEPRINT_CELL_COUNTS.physics).toBe(BLUEPRINT_CELL_COUNTS.total);
  });
});

describe('today, honestly', () => {
  const confidence = coverageConfidence({
    counts: BLUEPRINT_CELL_COUNTS,
    cells: summarise([]),
    studiedCellIds: [],
  });

  it('reports nought approved out of a hundred and nine', () => {
    expect(confidence.reviewerApproved).toBe(0);
    expect(confidence.outOf).toBe(109);
  });

  it('reports everything unmeasured, and nothing studied', () => {
    expect(confidence.studied).toBe(0);
    expect(confidence.notMeasured).toBe(109);
  });

  it('splits into 47 Mathematics and 62 Physics, summing to the total', () => {
    const [maths, physics] = confidence.bySubject;
    expect(maths!.outOf).toBe(47);
    expect(physics!.outOf).toBe(62);
    expect(maths!.outOf + physics!.outOf).toBe(confidence.outOf);
    for (const key of ['studied', 'reviewerApproved', 'demoOnly', 'notMeasured'] as const) {
      expect(maths![key] + physics![key], key).toBe(confidence[key]);
    }
  });
});

describe('what does not count as reviewer-approved', () => {
  it('pending review does not', () => {
    const pending = DRAFT_QUESTION_SEED.map((question) => record(question, { verificationStatus: 'pending-review', reviewer: null, reviewedAt: null, verifiedContentVersion: null }));
    expect(coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(pending), studiedCellIds: [] }).reviewerApproved).toBe(0);
  });

  it('demo content does not — the schema will not even let it claim to be', () => {
    // BlueprintQuestionRecordSchema refuses demo + reviewer-verified outright
    // ("Demo material cannot be reviewer-verified"), which is a stronger
    // guarantee than counting it and then discounting it.
    expect(() => record(DRAFT_QUESTION_SEED[0]!, { demo: true })).toThrow(/Demo material cannot be reviewer-verified/);

    const demo = DRAFT_QUESTION_SEED.map((question) =>
      record(question, { demo: true, verificationStatus: 'pending-review', reviewer: null, reviewedAt: null, verifiedContentVersion: null }),
    );
    const confidence = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(demo), studiedCellIds: [] });
    expect(confidence.reviewerApproved).toBe(0);
    // It is material, so it shows as demo-only rather than vanishing.
    expect(confidence.demoOnly).toBeGreaterThan(0);
  });

  it('an unpublished or archived item does not', () => {
    for (const status of ['draft', 'archived'] as const) {
      const items = DRAFT_QUESTION_SEED.map((question) => record(question, { status }));
      expect(coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(items), studiedCellIds: [] }).reviewerApproved, status).toBe(0);
    }
  });

  it('an item edited after its review does not', () => {
    const stale = DRAFT_QUESTION_SEED.map((question) => record(question, { contentVersion: 2, verifiedContentVersion: 1 }));
    expect(coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(stale), studiedCellIds: [] }).reviewerApproved).toBe(0);
  });

  it('a public answer key does not, when the question is whether a mock is secure', () => {
    const publicKeys = DRAFT_QUESTION_SEED.map((question) => record(question, { publicAnswerKey: true }));

    const forMock = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(publicKeys, 'mock'), studiedCellIds: [] });
    expect(forMock.reviewerApproved).toBe(0);
    expect(forMock.demoOnly).toBeGreaterThan(0);

    // The same items do cover their cells for practice.
    const forPractice = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(publicKeys, 'practice'), studiedCellIds: [] });
    expect(forPractice.reviewerApproved).toBeGreaterThan(0);
  });
});

describe('partial coverage', () => {
  const approved = DRAFT_QUESTION_SEED.map((question) => record(question));
  const confidence = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(approved), studiedCellIds: [] });

  it('counts exactly the cells the coverage engine calls covered', () => {
    const report = evaluateBlueprintCoverage(BLUEPRINT_CELL_SEED, approved);
    expect(confidence.reviewerApproved).toBe(report.verifiedCells);
    expect(confidence.reviewerApproved).toBe(AUTHORED_SLICE_CELL_IDS.length);
  });

  it('leaves the rest unmeasured rather than counting them against the learner', () => {
    expect(confidence.reviewerApproved + confidence.notMeasured).toBe(confidence.outOf);
  });

  it('still splits correctly by subject', () => {
    const [maths, physics] = confidence.bySubject;
    // Counted from the seed, so authoring a cell does not require editing a
    // literal here — only the split itself is asserted.
    const bySubject = { mathematics: 0, physics: 0 };
    for (const cellId of AUTHORED_SLICE_CELL_IDS) {
      const cell = BLUEPRINT_CELL_SEED.find((entry) => entry.id === cellId)!;
      bySubject[cell.subject] += 1;
    }
    expect(maths!.reviewerApproved).toBe(bySubject.mathematics);
    expect(physics!.reviewerApproved).toBe(bySubject.physics);
    expect(maths!.reviewerApproved + physics!.reviewerApproved).toBe(confidence.reviewerApproved);
  });
});

describe('the learner and the reviewer never move each other’s number', () => {
  const approved = DRAFT_QUESTION_SEED.map((question) => record(question));

  it('studying a topic does not make it reviewer-approved', () => {
    const studiedEverything = BLUEPRINT_CELL_SEED.map((cell) => cell.id);
    const confidence = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise([]), studiedCellIds: studiedEverything });

    expect(confidence.studied).toBe(109);
    expect(confidence.reviewerApproved).toBe(0);
  });

  it('approving content does not mean the learner has studied it', () => {
    const confidence = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise(approved), studiedCellIds: [] });
    expect(confidence.reviewerApproved).toBe(AUTHORED_SLICE_CELL_IDS.length);
    expect(confidence.studied).toBe(0);
  });

  it('reports both independently when both are true', () => {
    const confidence = coverageConfidence({
      counts: BLUEPRINT_CELL_COUNTS,
      cells: summarise(approved),
      studiedCellIds: ['math-linear-isolate-unknown'],
    });
    expect(confidence.studied).toBe(1);
    expect(confidence.reviewerApproved).toBe(AUTHORED_SLICE_CELL_IDS.length);
  });
});

describe('the four numbers are not a score', () => {
  it('does not add up to the denominator, and is not meant to', () => {
    const approved = DRAFT_QUESTION_SEED.map((question) => record(question));
    const confidence = coverageConfidence({
      counts: BLUEPRINT_CELL_COUNTS,
      cells: summarise(approved),
      studiedCellIds: ['math-linear-isolate-unknown'],
    });
    const sum = confidence.studied + confidence.reviewerApproved + confidence.demoOnly + confidence.notMeasured;
    expect(sum).not.toBe(confidence.outOf);
  });

  it('exposes no total, percentage or score field', () => {
    const confidence = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: summarise([]), studiedCellIds: [] });
    for (const forbidden of ['score', 'percent', 'percentage', 'total', 'readiness', 'confidenceScore']) {
      expect(confidence, forbidden).not.toHaveProperty(forbidden);
    }
  });

  it('says in both languages that these are separate counts', () => {
    expect(CONFIDENCE_DISCLAIMER.en).toMatch(/four separate counts, not one score/i);
    expect(CONFIDENCE_DISCLAIMER.en).toMatch(/none of them is a predicted result/i);
    expect(CONFIDENCE_DISCLAIMER.ru).toMatch(/четыре отдельных счётчика/);
    expect(CONFIDENCE_DISCLAIMER.ru).toMatch(/не является прогнозом/);
  });
});

describe('the definitions', () => {
  it('explains all four categories in both languages', () => {
    for (const [category, text] of Object.entries(CATEGORY_DEFINITION)) {
      expect(text.en.length, category).toBeGreaterThan(40);
      expect(text.ru.length, category).toBeGreaterThan(40);
      expect(text.ru, category).toMatch(/[А-Яа-я]/);
    }
    expect(Object.keys(CATEGORY_DEFINITION)).toEqual(['studied', 'reviewerApproved', 'demoOnly', 'notMeasured']);
  });

  it('says plainly that the learner cannot move the approved number', () => {
    expect(CATEGORY_DEFINITION.reviewerApproved.en).toMatch(/Nothing you do can move this number/i);
  });

  it('says demo material never reaches a secure mock', () => {
    expect(CATEGORY_DEFINITION.demoOnly.en).toMatch(/never used in a secure mock/i);
  });
});

describe('freshness', () => {
  it('carries the report time and a stale flag through untouched', () => {
    const fresh = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: [], studiedCellIds: [], generatedAt: '2026-09-03T10:00:00.000Z' });
    expect(fresh.generatedAt).toBe('2026-09-03T10:00:00.000Z');
    expect(fresh.stale).toBe(false);

    const cached = coverageConfidence({ counts: BLUEPRINT_CELL_COUNTS, cells: [], studiedCellIds: [], stale: true });
    expect(cached.stale).toBe(true);
    expect(cached.generatedAt).toBeNull();
  });
});
