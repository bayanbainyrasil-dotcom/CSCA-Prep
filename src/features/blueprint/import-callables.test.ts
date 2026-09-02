import { beforeEach, describe, expect, it } from 'vitest';
import {
  importBlueprintDraft,
  importPrivateQuestions,
  importPublicQuestionSeed,
} from '../../../functions/src/import-callables';
import { BLUEPRINT_CELL_SEED } from '../../../functions/src/blueprint-seed';
import { DRAFT_QUESTION_SEED } from '../../../functions/src/public-question-seed';
import { BLUEPRINT_SEED_VERSION, PUBLIC_SEED_VERSION } from '../../../functions/src/seed-versions';
import {
  collectionNames,
  listDocuments,
  readDocument,
  recordedWrites,
  resetFirestore,
} from '@/test/firebase/firestore';
import type { CallableRequest, TestableCallable } from '@/test/firebase/functions';

/**
 * These run the trusted import callables themselves — the same handlers Firebase
 * deploys — against an in-memory Firestore. Nothing here is a re-implementation:
 * a change to `functions/src/import-callables.ts` is a change to what is tested.
 */

interface ImportSummary {
  create: number;
  update: number;
  unchanged: number;
  conflict: number;
  invalid: number;
  total: number;
  blocked: boolean;
}

interface ImportResponse {
  dryRun: boolean;
  summary: ImportSummary;
  decisions: { id: string; outcome: string; existingVersion: number | null; nextVersion: number | null }[];
  alreadyApplied?: boolean;
  publicAnswerKey?: boolean;
  allowedModes?: string[];
}

type Callable = TestableCallable<Record<string, unknown>, ImportResponse>;

const ADMIN = { uid: 'admin-1', token: { admin: true, email: 'admin@example.test' } };
const LEARNER = { uid: 'learner-1', token: { email: 'learner@example.test' } };

/** Collections a dry run is forbidden to touch. Rate-limit counters are not content. */
const CONTENT_COLLECTIONS = ['blueprintCells', 'questions', 'questionSolutions', '_importBatches', '_auditLogs'];

/** `null` means "no signed-in caller at all", which a default parameter cannot express. */
function run(
  callable: unknown,
  data: Record<string, unknown>,
  auth: CallableRequest['auth'] | null = ADMIN,
): Promise<ImportResponse> {
  const request = { data, ...(auth === null ? {} : { auth }) } as CallableRequest<Record<string, unknown>>;
  return (callable as Callable).__handler(request);
}

function optionsOf(callable: unknown) {
  return (callable as Callable).__options;
}

async function expectRejection(promise: Promise<unknown>): Promise<{ code: string; message: string; details: unknown }> {
  try {
    await promise;
  } catch (cause) {
    const error = cause as { code?: string; message?: string; details?: unknown };
    return { code: error.code ?? '', message: error.message ?? '', details: error.details };
  }
  throw new Error('Expected the callable to refuse, but it resolved.');
}

function importBlueprint(dryRun: boolean, batchId = 'batch-blueprint') {
  return run(importBlueprintDraft, { batchId, seedVersion: BLUEPRINT_SEED_VERSION, dryRun });
}

function importPublicSeed(dryRun: boolean, batchId = 'batch-public') {
  return run(importPublicQuestionSeed, { batchId, seedVersion: PUBLIC_SEED_VERSION, dryRun });
}

const FIRST_SEED_ITEM = DRAFT_QUESTION_SEED[0]!;

/** A private item mapped to a real cell, shaped as the admin file format requires. */
function privateItem(overrides: { id?: string; expectedVersion?: number; question?: Record<string, unknown> } = {}) {
  const { question: questionOverrides, ...rest } = overrides;
  return {
    id: 'private-item-001',
    ...rest,
    question: {
      cellId: FIRST_SEED_ITEM.cellId,
      questionType: FIRST_SEED_ITEM.questionType,
      subject: FIRST_SEED_ITEM.subject,
      module: FIRST_SEED_ITEM.module,
      topicId: FIRST_SEED_ITEM.topicId,
      skill: FIRST_SEED_ITEM.skill,
      difficulty: FIRST_SEED_ITEM.difficulty,
      language: 'en',
      question: 'PRIVATE-PROMPT-TOKEN What is the value of x?',
      questionTranslation: 'PRIVATE-PROMPT-TOKEN Чему равно x?',
      options: [
        { id: 'a', text: 'x = 1' },
        { id: 'b', text: 'x = 2' },
        { id: 'c', text: 'x = 3' },
        { id: 'd', text: 'x = 4' },
      ],
      correctAnswer: 'c',
      solution: 'PRIVATE-SOLUTION-TOKEN the full worked solution.',
      shortSolution: 'PRIVATE-SHORT-TOKEN x = 3.',
      explanation: 'PRIVATE-EXPLANATION-TOKEN why it works.',
      commonMistakes: [{ id: 'slip', description: 'PRIVATE-MISTAKE-TOKEN a sign slip.', distractorOptionId: 'b' }],
      formulas: [],
      vocabulary: ['solve'],
      estimatedTime: 30,
      tags: ['private-test'],
      sourceType: 'original-csca-style',
      sourceNote: 'Authored for this test only.',
      status: 'published',
      demo: false,
      ...questionOverrides,
    },
  };
}

function importPrivate(items: unknown[], dryRun: boolean, batchId = 'batch-private') {
  return run(importPrivateQuestions, { batchId, dryRun, items });
}

beforeEach(resetFirestore);

describe('who may import', () => {
  const doors = [
    ['importBlueprintDraft', importBlueprintDraft, { batchId: 'b', seedVersion: BLUEPRINT_SEED_VERSION, dryRun: true }],
    ['importPublicQuestionSeed', importPublicQuestionSeed, { batchId: 'b', seedVersion: PUBLIC_SEED_VERSION, dryRun: true }],
    ['importPrivateQuestions', importPrivateQuestions, { batchId: 'b', dryRun: true, items: [privateItem()] }],
  ] as const;

  for (const [name, callable, data] of doors) {
    it(`${name} refuses an anonymous caller`, async () => {
      const failure = await expectRejection(run(callable, data as Record<string, unknown>, null));
      expect(failure.code).toBe('unauthenticated');
    });

    it(`${name} refuses a signed-in learner without the admin claim`, async () => {
      const failure = await expectRejection(run(callable, data as Record<string, unknown>, LEARNER));
      expect(failure.code).toBe('permission-denied');
      expect(collectionNames()).not.toContain('blueprintCells');
    });

    it(`${name} enforces App Check and consumes the token`, () => {
      expect(optionsOf(callable).enforceAppCheck).toBe(true);
      expect(optionsOf(callable).consumeAppCheckToken).toBe(true);
    });
  }

  it('accepts the admin claim in either shape the backend recognises', async () => {
    const byRole = await run(importBlueprintDraft, { batchId: 'b', seedVersion: BLUEPRINT_SEED_VERSION, dryRun: true }, {
      uid: 'admin-2',
      token: { role: 'admin' },
    });
    expect(byRole.dryRun).toBe(true);
  });
});

describe('a dry run', () => {
  it('writes no content, no batch record and no audit entry', async () => {
    const result = await importBlueprint(true);

    expect(result.dryRun).toBe(true);
    expect(result.summary.total).toBe(BLUEPRINT_CELL_SEED.length);
    expect(result.summary.create).toBe(BLUEPRINT_CELL_SEED.length);
    for (const collection of CONTENT_COLLECTIONS) {
      expect(listDocuments(collection), collection).toHaveLength(0);
    }
    expect(recordedWrites.filter((write) => CONTENT_COLLECTIONS.includes(write.collection))).toHaveLength(0);
  });

  it('writes nothing on the public seed path either', async () => {
    await importBlueprint(false);
    const before = recordedWrites.length;

    const result = await importPublicSeed(true);

    expect(result.dryRun).toBe(true);
    expect(result.summary.create).toBe(DRAFT_QUESTION_SEED.length);
    expect(listDocuments('questions')).toHaveLength(0);
    expect(listDocuments('questionSolutions')).toHaveLength(0);
    expect(recordedWrites.slice(before).filter((write) => CONTENT_COLLECTIONS.includes(write.collection))).toHaveLength(0);
  });

  it('writes nothing on the private path either', async () => {
    await importBlueprint(false);

    const result = await importPrivate([privateItem()], true);

    expect(result.dryRun).toBe(true);
    expect(result.summary.create).toBe(1);
    expect(listDocuments('questions')).toHaveLength(0);
    expect(listDocuments('questionSolutions')).toHaveLength(0);
  });
});

describe('the blueprint import', () => {
  it('leaves every seeded cell stored as a draft with no reviewer', async () => {
    const result = await importBlueprint(false);

    const stored = listDocuments('blueprintCells');
    expect(stored).toHaveLength(BLUEPRINT_CELL_SEED.length);
    expect(result.summary.blocked).toBe(false);
    for (const { id, data } of stored) {
      expect(data.verificationStatus, id).toBe('draft');
      expect(data.reviewer, id).toBeNull();
      expect(data.reviewedAt, id).toBeNull();
      expect(data.version, id).toBe(1);
    }
  });

  it('refuses a seed version the server does not hold', async () => {
    const failure = await expectRejection(
      run(importBlueprintDraft, { batchId: 'b', seedVersion: '1999-01-01.1', dryRun: true }),
    );
    expect(failure.code).toBe('failed-precondition');
    expect(listDocuments('blueprintCells')).toHaveLength(0);
  });
});

describe('idempotency', () => {
  it('re-running the same batch writes nothing again and reports it', async () => {
    await importBlueprint(false, 'batch-once');
    const afterFirst = listDocuments('blueprintCells');
    const writesAfterFirst = recordedWrites.filter((write) => write.collection === 'blueprintCells').length;

    const second = await importBlueprint(false, 'batch-once');

    expect(second.alreadyApplied).toBe(true);
    expect(recordedWrites.filter((write) => write.collection === 'blueprintCells')).toHaveLength(writesAfterFirst);
    expect(listDocuments('blueprintCells')).toHaveLength(afterFirst.length);
    for (const { id, data } of listDocuments('blueprintCells')) {
      expect(data.version, id).toBe(1);
    }
  });

  it('a fresh batch id over unchanged content writes nothing and creates no duplicate', async () => {
    await importBlueprint(false, 'batch-a');

    const second = await importBlueprint(false, 'batch-b');

    expect(second.alreadyApplied).toBeUndefined();
    expect(second.summary.unchanged).toBe(BLUEPRINT_CELL_SEED.length);
    expect(second.summary.create).toBe(0);
    expect(second.summary.update).toBe(0);
    expect(listDocuments('blueprintCells')).toHaveLength(BLUEPRINT_CELL_SEED.length);
    for (const { id, data } of listDocuments('blueprintCells')) {
      expect(data.version, id).toBe(1);
    }
  });

  it('re-importing questions leaves one document per id, not two', async () => {
    await importBlueprint(false);
    await importPublicSeed(false, 'seed-1');
    await importPublicSeed(false, 'seed-2');

    expect(listDocuments('questions')).toHaveLength(DRAFT_QUESTION_SEED.length);
    expect(listDocuments('questionSolutions')).toHaveLength(DRAFT_QUESTION_SEED.length);
  });
});

describe('the public seed', () => {
  beforeEach(async () => {
    await importBlueprint(false);
  });

  it('stores every authored item as pending review, with no reviewer and no verified version', async () => {
    await importPublicSeed(false);

    const stored = listDocuments('questions');
    expect(stored).toHaveLength(DRAFT_QUESTION_SEED.length);
    for (const { id, data } of stored) {
      expect(data.verificationStatus, id).toBe('pending-review');
      expect(data.reviewer, id).toBeNull();
      expect(data.reviewedAt, id).toBeNull();
      expect(data.verifiedContentVersion, id).toBeNull();
    }
  });

  it('marks the answer key public and confines the item to practice', async () => {
    const result = await importPublicSeed(false);

    expect(result.publicAnswerKey).toBe(true);
    expect(result.allowedModes).toEqual(['practice']);
    for (const { id, data } of listDocuments('questions')) {
      expect(data.publicAnswerKey, id).toBe(true);
      expect(data.allowedModes, id).toEqual(['practice']);
      expect(data.allowedModes, id).not.toContain('mock');
    }
  });

  it('keeps the key and the worked solution out of the readable document', async () => {
    await importPublicSeed(false);

    for (const { id, data } of listDocuments('questions')) {
      for (const secret of ['correctAnswer', 'solution', 'shortSolution', 'explanation', 'commonMistakes']) {
        expect(data, `${id}.${secret}`).not.toHaveProperty(secret);
      }
      expect(readDocument('questionSolutions', id)).toHaveProperty('correctAnswer');
    }
  });
});

describe('the private import', () => {
  beforeEach(async () => {
    await importBlueprint(false);
  });

  it('splits the prompt from the key and the solution', async () => {
    await importPrivate([privateItem()], false);

    const prompt = readDocument('questions', 'private-item-001');
    const solution = readDocument('questionSolutions', 'private-item-001');

    expect(prompt?.question).toContain('PRIVATE-PROMPT-TOKEN');
    expect(prompt?.options).toHaveLength(4);
    for (const secret of ['correctAnswer', 'solution', 'shortSolution', 'explanation', 'commonMistakes']) {
      expect(prompt).not.toHaveProperty(secret);
    }

    expect(solution?.correctAnswer).toBe('c');
    expect(solution?.solution).toContain('PRIVATE-SOLUTION-TOKEN');
    expect(solution?.shortSolution).toContain('PRIVATE-SHORT-TOKEN');
    expect(solution?.explanation).toContain('PRIVATE-EXPLANATION-TOKEN');
    // The prompt document carries none of the four private strings anywhere.
    const promptText = JSON.stringify(prompt);
    for (const token of ['PRIVATE-SOLUTION-TOKEN', 'PRIVATE-SHORT-TOKEN', 'PRIVATE-EXPLANATION-TOKEN', 'PRIVATE-MISTAKE-TOKEN']) {
      expect(promptText, token).not.toContain(token);
    }
  });

  it('stores a privately imported item as pending review with no reviewer', async () => {
    await importPrivate([privateItem()], false);

    const prompt = readDocument('questions', 'private-item-001');
    expect(prompt?.verificationStatus).toBe('pending-review');
    expect(prompt?.reviewer).toBeNull();
    expect(prompt?.reviewedAt).toBeNull();
    expect(prompt?.verifiedContentVersion).toBeNull();
  });

  it('leaves a private item usable in a mock, unlike the published seed', async () => {
    await importPrivate([privateItem()], false);

    const prompt = readDocument('questions', 'private-item-001');
    expect(prompt?.publicAnswerKey).toBe(false);
    expect(prompt?.allowedModes).toContain('mock');
  });
});

describe('conflicts and partial failure', () => {
  beforeEach(async () => {
    await importBlueprint(false);
  });

  it('refuses to overwrite an item whose stored version is not the one the file expected', async () => {
    await importPrivate([privateItem({ expectedVersion: 0 })], false, 'first');
    const stored = readDocument('questions', 'private-item-001');
    expect(stored?.version).toBe(1);

    const failure = await expectRejection(
      importPrivate(
        [privateItem({ expectedVersion: 0, question: { question: 'PRIVATE-PROMPT-TOKEN a different prompt.' } })],
        false,
        'second',
      ),
    );

    expect(failure.code).toBe('aborted');
    const after = readDocument('questions', 'private-item-001');
    expect(after?.version).toBe(1);
    expect(after?.question).toBe(stored?.question);
  });

  it('reports the conflict in a dry run instead of writing it', async () => {
    await importPrivate([privateItem({ expectedVersion: 0 })], false, 'first');

    const result = await importPrivate(
      [privateItem({ expectedVersion: 0, question: { question: 'PRIVATE-PROMPT-TOKEN changed.' } })],
      true,
      'second',
    );

    expect(result.summary.conflict).toBe(1);
    expect(result.summary.blocked).toBe(true);
  });

  it('writes nothing at all when one item of a batch cannot be mapped', async () => {
    const good = privateItem();
    const bad = privateItem({ id: 'private-item-002', question: { cellId: 'no-such-cell' } });

    const failure = await expectRejection(importPrivate([good, bad], false));

    expect(failure.code).toBe('aborted');
    const details = failure.details as { problems: { id: string; outcome: string; reason: string }[] };
    expect(details.problems.map((problem) => problem.id)).toContain('private-item-002');
    expect(details.problems[0]?.outcome).toBe('invalid');
    expect(details.problems[0]?.reason).not.toBe('');
    // Neither item was written: a partial import is never applied.
    expect(readDocument('questions', 'private-item-001')).toBeUndefined();
    expect(readDocument('questions', 'private-item-002')).toBeUndefined();
    expect(readDocument('_importBatches', 'batch-private')).toBeUndefined();
  });

  it('names the failing items in a dry run so the operator sees them before confirming', async () => {
    const result = await importPrivate(
      [privateItem(), privateItem({ id: 'private-item-002', question: { difficulty: 5 } })],
      true,
    );

    expect(result.summary.blocked).toBe(true);
    expect(result.summary.invalid).toBe(1);
    expect(result.decisions.find((decision) => decision.id === 'private-item-002')?.outcome).toBe('invalid');
  });
});

describe('the audit trail', () => {
  it('records the batch without a prompt, an answer or a solution', async () => {
    await importBlueprint(false);
    await importPrivate([privateItem()], false);

    const entries = listDocuments('_auditLogs');
    expect(entries.length).toBeGreaterThanOrEqual(2);
    const serialised = JSON.stringify(entries);
    for (const token of [
      'PRIVATE-PROMPT-TOKEN',
      'PRIVATE-SOLUTION-TOKEN',
      'PRIVATE-SHORT-TOKEN',
      'PRIVATE-EXPLANATION-TOKEN',
      'PRIVATE-MISTAKE-TOKEN',
    ]) {
      expect(serialised, token).not.toContain(token);
    }
    for (const field of ['correctAnswer', '"solution"', 'shortSolution', 'explanation', 'commonMistakes', 'options']) {
      expect(serialised, field).not.toContain(field);
    }
  });

  it('records the batch without any seed answer text', async () => {
    await importBlueprint(false);
    await importPublicSeed(false);

    const serialised = JSON.stringify(listDocuments('_auditLogs'));
    for (const item of DRAFT_QUESTION_SEED) {
      expect(serialised, item.id).not.toContain(item.solution);
      expect(serialised, item.id).not.toContain(item.shortSolution);
      expect(serialised, item.id).not.toContain(item.question);
    }
  });

  it('records who ran it and which batch, so an import can be traced', async () => {
    await importBlueprint(false, 'traceable-batch');

    const entry = listDocuments('_auditLogs').find((row) => row.data.action === 'blueprint.imported');
    expect(entry?.data.actorUid).toBe(ADMIN.uid);
    expect(JSON.stringify(entry?.data.details)).toContain('traceable-batch');
  });
});
