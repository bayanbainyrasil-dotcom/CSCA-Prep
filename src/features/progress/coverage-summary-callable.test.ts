/**
 * The learner-facing coverage read, exercised as the deployed callable.
 *
 * The point of these tests is the boundary, not the arithmetic: the arithmetic
 * is `evaluateBlueprintCoverage`, which has its own suite. What is checked here
 * is that a learner may call it, that a signed-out caller may not, that App
 * Check is required, and above all that nothing private comes back — including
 * when a correct answer is sitting in Firestore next to the question.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getCoverageSummary } from '../../../functions/src/coverage-summary-callables';
import { getBlueprintCoverage } from '../../../functions/src/blueprint-callables';
import { CoverageSummarySchema } from '../../../functions/src/schemas';
import { listDocuments, readCollections, resetFirestore, seedDocument } from '@/test/firebase/firestore';
import type { CallableRequest, TestableCallable } from '@/test/firebase/functions';

const LEARNER = { uid: 'learner-1', token: { email: 'learner@example.test' } };
const OTHER = { uid: 'learner-2', token: { email: 'other@example.test' } };
const SECRET_ANSWER = 'option-delta-is-the-key';

interface SummaryResponse {
  generatedAt: string;
  outOf: { total: number; mathematics: number; physics: number };
  cells: Array<{
    id: string;
    subject: string;
    status: string;
    totalItems: number;
    demoItems: number;
    publicKeyItems: number;
  }>;
}

function run(data: Record<string, unknown> = {}, auth: CallableRequest['auth'] | null = LEARNER): Promise<SummaryResponse> {
  const request = { data, ...(auth === null ? {} : { auth }) } as CallableRequest<Record<string, unknown>>;
  return (getCoverageSummary as unknown as TestableCallable<Record<string, unknown>, SummaryResponse>).__handler(request);
}

async function refusalOf(promise: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await promise;
  } catch (cause) {
    const error = cause as { code?: string; message?: string };
    return { code: error.code ?? '', message: error.message ?? '' };
  }
  throw new Error('Expected a refusal, but the call succeeded.');
}

function seedCell(id: string, subject: 'mathematics' | 'physics'): void {
  seedDocument('blueprintCells', id, {
    id,
    subject,
    module: 'Algebra',
    topicId: 'topic-1',
    topic: 'Linear equations',
    skillId: 'skill-1',
    skill: 'Solve linear relations',
    microSkillId: 'micro-1',
    microSkill: 'Isolate the unknown',
    difficultyLevels: [1],
    questionTypes: ['concept-recognition'],
    minimumItems: 1,
    supportedLanguages: ['en'],
    allowedExamModes: ['practice'],
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'Internal note',
    knownLimitations: 'Not an official CSCA specification',
    version: 1,
  });
}

function seedQuestion(
  id: string,
  cellId: string,
  overrides: Record<string, unknown> = {},
): void {
  seedDocument('questions', id, {
    cellId,
    subject: 'mathematics',
    topicId: 'topic-1',
    difficulty: 1,
    questionType: 'concept-recognition',
    language: 'en',
    status: 'published',
    demo: false,
    verificationStatus: 'reviewer-verified',
    sourceType: 'original-csca-style',
    sourceReference: 'Internal note',
    reviewer: 'reviewer@example.test',
    reviewedAt: '2026-01-01T00:00:00.000Z',
    knownLimitations: '',
    version: 1,
    verifiedContentVersion: 1,
    publicAnswerKey: false,
    ...overrides,
  });
  // The private half of the same question, exactly where the real import puts it.
  seedDocument('questionSolutions', id, { correctAnswer: SECRET_ANSWER, solution: SECRET_ANSWER });
}

beforeEach(() => {
  resetFirestore();
  seedCell('math-cell', 'mathematics');
  seedCell('phys-cell', 'physics');
  seedQuestion('q-1', 'math-cell');
});

describe('the wire contract', () => {
  it('takes no arguments at all', () => {
    expect(CoverageSummarySchema.safeParse({}).success).toBe(true);
    for (const probe of [{ subject: 'physics' }, { mode: 'mock' }, { uid: 'someone-else' }, { includeAnswers: true }]) {
      expect(CoverageSummarySchema.safeParse(probe).success, JSON.stringify(probe)).toBe(false);
    }
  });

  it('requires App Check on the deployed callable', () => {
    const options = (getCoverageSummary as unknown as TestableCallable<unknown, unknown>).__options as {
      enforceAppCheck?: boolean;
    };
    expect(options.enforceAppCheck).toBe(true);
  });
});

describe('who may read coverage', () => {
  it('refuses a signed-out caller', async () => {
    expect((await refusalOf(run({}, null))).code).toBe('unauthenticated');
  });

  it('answers any signed-in learner, with no administrator claim', async () => {
    const response = await run();
    expect(response.outOf.total).toBe(2);
  });

  it('rejects an argument rather than ignoring it', async () => {
    expect((await refusalOf(run({ subject: 'physics' }))).code).toBe('invalid-argument');
  });

  it('rate-limits per caller, not globally', async () => {
    await run();
    const limits = listDocuments('_rateLimits');
    expect(limits).toHaveLength(1);
    await run({}, OTHER);
    expect(listDocuments('_rateLimits')).toHaveLength(2);
  });
});

describe('what comes back', () => {
  it('reports the deployment’s own blueprint size, split by subject', async () => {
    const response = await run();
    expect(response.outOf).toEqual({ total: 2, mathematics: 1, physics: 1 });
    expect(response.cells.map((cell) => cell.id).sort()).toEqual(['math-cell', 'phys-cell']);
  });

  it('carries only the six safe fields on every cell', async () => {
    const response = await run();
    for (const cell of response.cells) {
      expect(Object.keys(cell).sort()).toEqual([
        'demoItems',
        'id',
        'publicKeyItems',
        'status',
        'subject',
        'totalItems',
      ]);
    }
  });

  it('never returns a reviewer, a source, a limitation or a question id', async () => {
    const serialised = JSON.stringify(await run());
    for (const forbidden of ['reviewer@example.test', 'Internal note', 'Not an official CSCA specification', 'q-1', 'issues', 'orphan']) {
      expect(serialised, forbidden).not.toContain(forbidden);
    }
  });

  it('never returns a correct answer, even though one sits beside the question', async () => {
    expect(JSON.stringify(await run())).not.toContain(SECRET_ANSWER);
  });

  it('never opens the private answer collection at all', async () => {
    await run();
    expect(readCollections).toContain('questions');
    expect(readCollections).not.toContain('questionSolutions');
  });

  /**
   * The control for the assertion above. The administrator report does read the
   * private answers, so a passing "never read" test on the learner path is a
   * real difference between the two callables and not an artefact of the test
   * double failing to notice reads.
   */
  it('differs from the administrator report, which does read them', async () => {
    const request = { data: {}, auth: { uid: 'admin-1', token: { admin: true } } } as CallableRequest<Record<string, unknown>>;
    await (getBlueprintCoverage as unknown as TestableCallable<Record<string, unknown>, unknown>).__handler(request);
    expect(readCollections).toContain('questionSolutions');
  });

  it('counts demo and public-answer-key items so the client can separate them', async () => {
    seedQuestion('q-2', 'phys-cell', { subject: 'physics', demo: true, verificationStatus: 'demo' });
    seedQuestion('q-3', 'phys-cell', { subject: 'physics', publicAnswerKey: true, verificationStatus: 'pending-review' });
    const physics = (await run()).cells.find((cell) => cell.id === 'phys-cell');
    expect(physics?.totalItems).toBe(2);
    expect(physics?.demoItems).toBe(1);
    expect(physics?.publicKeyItems).toBe(1);
    expect(physics?.status).not.toBe('covered');
  });

  it('reports an empty cell as empty rather than omitting it', async () => {
    const physics = (await run()).cells.find((cell) => cell.id === 'phys-cell');
    expect(physics?.status).toBe('empty');
    expect(physics?.totalItems).toBe(0);
  });

  it('is a read: it writes nothing but its own rate-limit counter', async () => {
    await run();
    expect(listDocuments('blueprintCells')).toHaveLength(2);
    expect(listDocuments('questions')).toHaveLength(1);
    expect(listDocuments('_auditLogs')).toHaveLength(0);
  });
});
