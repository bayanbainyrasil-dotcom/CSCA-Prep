/**
 * Content import.
 *
 * Three doors, all administrator-only, all App Check enforced, all idempotent,
 * and none of which can publish verified content:
 *
 * - `importBlueprintDraft` writes the curriculum requirements as drafts.
 * - `importPublicQuestionSeed` writes the seed committed to this repository.
 *   Its answers are public, so every item is marked `publicAnswerKey` and can
 *   back practice only, never a confidential mock.
 * - `importPrivateQuestions` takes a file an administrator holds locally and
 *   splits it: the prompt goes to `questions`, the key and solution go to the
 *   protected `questionSolutions`.
 *
 * Every path runs a dry run that writes nothing, refuses the whole batch when
 * any item conflicts, and records an audit entry that contains no question text,
 * no answer key and no solution.
 */
import { FieldValue } from "firebase-admin/firestore";
import type { Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { BLUEPRINT_CELL_SEED, BLUEPRINT_SEED_VERSION } from "./blueprint-seed";
import { validateQuestionAgainstCell, type BlueprintCell } from "./blueprint-engine";
import { loadBlueprintCell } from "./blueprint-callables";
import { enforceRateLimit, parseInput, requireAdmin, writeAuditLog } from "./callable";
import {
  auditDetailsFor,
  classifyImport,
  contentHash,
  summariseImport,
  writableDecisions,
  type ExistingRecord,
  type ImportDecision,
} from "./import-engine";
import { db } from "./platform";
import {
  DRAFT_QUESTION_SEED,
  PUBLIC_SEED_ALLOWED_MODES,
  PUBLIC_SEED_VERSION,
} from "./public-question-seed";
import {
  ImportBlueprintDraftSchema,
  ImportPrivateQuestionsSchema,
  ImportPublicQuestionSeedSchema,
  QuestionSchema,
  type QuestionInput,
} from "./schemas";

const adminCallableOptions = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  cors: true,
} as const;

const BLUEPRINT_COLLECTION = "blueprintCells";

async function readExisting(collection: string, ids: string[]): Promise<Map<string, ExistingRecord>> {
  if (ids.length === 0) return new Map();
  const snapshots = await db.getAll(...ids.map((id) => db.collection(collection).doc(id)));
  const existing = new Map<string, ExistingRecord>();
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    if (!snapshot.exists || !data) continue;
    existing.set(snapshot.id, {
      version: typeof data.version === "number" ? data.version : 0,
      contentHash: typeof data.contentHash === "string" ? data.contentHash : null,
    });
  }
  return existing;
}

/** A batch already applied returns its recorded result instead of running again. */
async function completedBatch(batchId: string): Promise<Record<string, unknown> | null> {
  const snapshot = await db.collection("_importBatches").doc(batchId).get();
  const data = snapshot.data();
  return snapshot.exists && data ? (data.result as Record<string, unknown>) : null;
}

async function recordBatch(
  batchId: string,
  actorUid: string,
  kind: string,
  result: Record<string, unknown>,
): Promise<void> {
  await db.collection("_importBatches").doc(batchId).set({
    batchId,
    kind,
    actorUid,
    result,
    createdAt: FieldValue.serverTimestamp(),
  });
}

function refuseIfBlocked(decisions: ImportDecision[]): void {
  const summary = summariseImport(decisions);
  if (!summary.blocked) return;
  throw new HttpsError("aborted", "The batch was not applied: some items cannot be written safely.", {
    summary,
    problems: decisions
      .filter((decision) => decision.outcome === "conflict" || decision.outcome === "invalid")
      .map((decision) => ({ id: decision.id, outcome: decision.outcome, reason: decision.reason }))
      .slice(0, 50),
  });
}

export const importBlueprintDraft = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(ImportBlueprintDraftSchema, request.data);
  await enforceRateLimit("importBlueprintDraft", principal.uid, 30, 60 * 60);

  if (input.seedVersion !== BLUEPRINT_SEED_VERSION) {
    throw new HttpsError(
      "failed-precondition",
      `This server holds blueprint seed ${BLUEPRINT_SEED_VERSION}, not ${input.seedVersion}. Reload the admin page.`,
    );
  }

  const applied = input.dryRun ? null : await completedBatch(input.batchId);
  if (applied) return { ...applied, alreadyApplied: true };

  const existing = await readExisting(BLUEPRINT_COLLECTION, BLUEPRINT_CELL_SEED.map((cell) => cell.id));
  const decisions = BLUEPRINT_CELL_SEED.map((cell) => {
    // Verification metadata is never part of the imported payload, so re-running
    // an import can never reset or grant a review.
    const { verificationStatus: _status, reviewer: _reviewer, reviewedAt: _reviewedAt, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = cell;
    return classifyImport({ id: cell.id, payload, existing: existing.get(cell.id) ?? null });
  });

  const summary = summariseImport(decisions);
  if (input.dryRun) {
    return { dryRun: true, summary, decisions, seedVersion: BLUEPRINT_SEED_VERSION };
  }
  refuseIfBlocked(decisions);

  const writable = writableDecisions(decisions);
  const byId = new Map(BLUEPRINT_CELL_SEED.map((cell) => [cell.id, cell]));
  const now = new Date().toISOString();

  for (let index = 0; index < writable.length; index += 200) {
    const chunk = writable.slice(index, index + 200);
    const batch = db.batch();
    for (const decision of chunk) {
      const cell = byId.get(decision.id)!;
      const { verificationStatus: _status, reviewer: _reviewer, reviewedAt: _reviewedAt, version: _version, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = cell;
      batch.set(
        db.collection(BLUEPRINT_COLLECTION).doc(cell.id),
        {
          ...payload,
          // Imported requirements are drafts. Nothing here names a reviewer.
          verificationStatus: "draft",
          reviewer: null,
          reviewedAt: null,
          contentHash: decision.contentHash,
          version: decision.nextVersion,
          // A re-import must not restamp when the cell first appeared, so
          // `createdAt` is written once and then left alone by the merge.
          ...(decision.outcome === "create" ? { createdAt: now } : {}),
          updatedAt: now,
          updatedBy: principal.uid,
          serverUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
    await batch.commit();
  }

  const result = { dryRun: false, summary, decisions, seedVersion: BLUEPRINT_SEED_VERSION };
  await recordBatch(input.batchId, principal.uid, "blueprint-draft", { summary, seedVersion: BLUEPRINT_SEED_VERSION });
  await writeAuditLog(principal.uid, "blueprint.imported", auditDetailsFor(input.batchId, BLUEPRINT_SEED_VERSION, decisions));
  return result;
});

interface PreparedQuestion {
  id: string;
  expectedVersion?: number;
  question: QuestionInput;
  publicAnswerKey: boolean;
  allowedModes: string[];
}

/** Validates mapping and shape, and turns a rejection into an `invalid` decision. */
async function prepareDecisions(
  prepared: PreparedQuestion[],
): Promise<{ decisions: ImportDecision[]; cells: Map<string, BlueprintCell | undefined> }> {
  const cellIds = [...new Set(prepared.map((item) => item.question.cellId))];
  const cells = new Map(
    await Promise.all(cellIds.map(async (cellId) => [cellId, await loadBlueprintCell(cellId)] as const)),
  );
  const existing = await readExisting("questions", prepared.map((item) => item.id));

  const decisions = prepared.map((item) => {
    const problems = validateQuestionAgainstCell(
      cells.get(item.question.cellId),
      {
        subject: item.question.subject,
        topicId: item.question.topicId,
        questionType: item.question.questionType,
        difficulty: item.question.difficulty,
        language: item.question.language,
      },
      item.question.cellId,
    );
    if (problems.length > 0) {
      return {
        id: item.id,
        outcome: "invalid" as const,
        reason: problems.map((problem) => problem.message).join(' '),
        contentHash: contentHash(item.question),
        existingVersion: existing.get(item.id)?.version ?? null,
        nextVersion: null,
      };
    }
    return classifyImport({
      id: item.id,
      payload: item.question,
      existing: existing.get(item.id) ?? null,
      ...(item.expectedVersion === undefined ? {} : { expectedVersion: item.expectedVersion }),
    });
  });

  return { decisions, cells };
}

function splitQuestion(question: QuestionInput) {
  const { correctAnswer, solution, shortSolution, explanation, commonMistakes, ...prompt } = question;
  return { prompt, privateSolution: { correctAnswer, solution, shortSolution, explanation, commonMistakes } };
}

async function applyQuestionWrites(
  prepared: PreparedQuestion[],
  decisions: ImportDecision[],
  actorUid: string,
): Promise<void> {
  const byId = new Map(prepared.map((item) => [item.id, item]));
  const now = new Date().toISOString();

  for (const decision of writableDecisions(decisions)) {
    const item = byId.get(decision.id)!;
    const { prompt, privateSolution } = splitQuestion(item.question);
    const promptRef = db.collection("questions").doc(item.id);
    const solutionRef = db.collection("questionSolutions").doc(item.id);

    await db.runTransaction(async (transaction: Transaction) => {
      const snapshot = await transaction.get(promptRef);
      const data = snapshot.data();
      const currentVersion = typeof data?.version === "number" ? data.version : 0;
      if (decision.existingVersion !== null && currentVersion !== decision.existingVersion) {
        throw new HttpsError("aborted", `${item.id} changed while the import was running.`);
      }

      const common = {
        contentHash: decision.contentHash,
        version: decision.nextVersion,
        createdAt: typeof data?.createdAt === "string" ? data.createdAt : now,
        createdBy: typeof data?.createdBy === "string" ? data.createdBy : actorUid,
        updatedAt: now,
        updatedBy: actorUid,
        serverUpdatedAt: FieldValue.serverTimestamp(),
      };

      // A content write always leaves the item awaiting a human.
      transaction.set(
        promptRef,
        {
          id: item.id,
          ...prompt,
          publicAnswerKey: item.publicAnswerKey,
          allowedModes: item.allowedModes,
          verificationStatus: "pending-review",
          reviewer: null,
          reviewedAt: null,
          verifiedContentVersion: null,
          ...common,
        },
        { merge: false },
      );
      // The key and the worked solution never enter the public document.
      transaction.set(
        solutionRef,
        { questionId: item.id, status: item.question.status, ...privateSolution, ...common },
        { merge: false },
      );
    });
  }
}

export const importPublicQuestionSeed = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(ImportPublicQuestionSeedSchema, request.data);
  await enforceRateLimit("importPublicQuestionSeed", principal.uid, 30, 60 * 60);

  if (input.seedVersion !== PUBLIC_SEED_VERSION) {
    throw new HttpsError(
      "failed-precondition",
      `This server holds public seed ${PUBLIC_SEED_VERSION}, not ${input.seedVersion}. Reload the admin page.`,
    );
  }

  const applied = input.dryRun ? null : await completedBatch(input.batchId);
  if (applied) return { ...applied, alreadyApplied: true };

  const prepared: PreparedQuestion[] = DRAFT_QUESTION_SEED.map((item) => ({
    id: item.id,
    question: QuestionSchema.parse({
      subject: item.subject,
      module: item.module,
      topicId: item.topicId,
      skill: item.skill,
      difficulty: item.difficulty,
      language: item.language,
      question: item.question,
      questionTranslation: item.questionTranslation,
      options: item.options,
      correctAnswer: item.correctAnswer,
      solution: item.solution,
      shortSolution: item.shortSolution,
      explanation: item.explanation,
      formulas: item.formulas,
      vocabulary: item.vocabulary,
      commonMistakes: item.commonMistakes,
      estimatedTime: item.estimatedTime,
      sourceType: "original-csca-style",
      sourceNote:
        "Original CSCA-style item published in the CSCA Prep repository. Its answer is public, so it is practice material only.",
      tags: item.tags,
      status: "published",
      demo: false,
      cellId: item.cellId,
      questionType: item.questionType,
      templateParameters: item.templateParameters,
    }),
    // The answers are in a public repository. No later move can unpublish them.
    publicAnswerKey: true,
    allowedModes: [...PUBLIC_SEED_ALLOWED_MODES],
  }));

  const { decisions } = await prepareDecisions(prepared);
  const summary = summariseImport(decisions);

  if (input.dryRun) {
    return {
      dryRun: true,
      summary,
      decisions,
      seedVersion: PUBLIC_SEED_VERSION,
      publicAnswerKey: true,
      allowedModes: [...PUBLIC_SEED_ALLOWED_MODES],
    };
  }
  refuseIfBlocked(decisions);
  await applyQuestionWrites(prepared, decisions, principal.uid);

  const result = {
    dryRun: false,
    summary,
    decisions,
    seedVersion: PUBLIC_SEED_VERSION,
    publicAnswerKey: true,
    allowedModes: [...PUBLIC_SEED_ALLOWED_MODES],
  };
  await recordBatch(input.batchId, principal.uid, "public-question-seed", { summary, seedVersion: PUBLIC_SEED_VERSION });
  await writeAuditLog(
    principal.uid,
    "questions.publicSeedImported",
    auditDetailsFor(input.batchId, PUBLIC_SEED_VERSION, decisions),
  );
  return result;
});

export const importPrivateQuestions = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(ImportPrivateQuestionsSchema, request.data);
  await enforceRateLimit("importPrivateQuestions", principal.uid, 30, 60 * 60);

  const applied = input.dryRun ? null : await completedBatch(input.batchId);
  if (applied) return { ...applied, alreadyApplied: true };

  const prepared: PreparedQuestion[] = input.items.map((item) => ({
    id: item.id,
    ...(item.expectedVersion === undefined ? {} : { expectedVersion: item.expectedVersion }),
    question: item.question,
    publicAnswerKey: false,
    allowedModes: ["diagnostic", "practice", "mock"],
  }));

  const { decisions } = await prepareDecisions(prepared);
  const summary = summariseImport(decisions);

  if (input.dryRun) return { dryRun: true, summary, decisions };
  refuseIfBlocked(decisions);
  await applyQuestionWrites(prepared, decisions, principal.uid);

  const result = { dryRun: false, summary, decisions };
  await recordBatch(input.batchId, principal.uid, "private-questions", { summary });
  // No question text, no key and no solution reaches the audit log.
  await writeAuditLog(principal.uid, "questions.privateImported", auditDetailsFor(input.batchId, "private", decisions));
  return result;
});
