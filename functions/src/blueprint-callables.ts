/**
 * Trusted blueprint administration and the exam publication gate.
 *
 * Rules of this module:
 * - only an authenticated administrator may write a blueprint cell or change any
 *   verification status;
 * - a caller can never assert that content is verified: `reviewer` comes from the
 *   authenticated identity and `reviewedAt` from the server clock;
 * - coverage is always recomputed from the published question bank at the moment
 *   of publication or of starting a mock, never read from a stored number;
 * - every verification change is written to the audit log.
 */
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  canPublishExam,
  composeExam,
  evaluateBlueprintCoverage,
  type BlueprintCell,
  type BlueprintExamMode,
  type BlueprintLanguage,
  type BlueprintQuestionRecord,
  type BlueprintSubject,
} from "./blueprint-engine";
import { enforceRateLimit, parseInput, requireAdmin, writeAuditLog } from "./callable";
import { db } from "./platform";
import {
  BlueprintCoverageSchema,
  PublishMockExamSchema,
  SetContentVerificationSchema,
  UpsertBlueprintCellSchema,
} from "./schemas";

const adminCallableOptions = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  cors: true,
} as const;

const BLUEPRINT_COLLECTION = "blueprintCells";

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

function asNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
    : [];
}

function toCell(id: string, data: Record<string, unknown>): BlueprintCell {
  return {
    id,
    subject: data.subject === "physics" ? "physics" : "mathematics",
    module: asString(data.module),
    topicId: asString(data.topicId),
    topic: asString(data.topic),
    skillId: asString(data.skillId),
    skill: asString(data.skill),
    microSkillId: asString(data.microSkillId),
    microSkill: asString(data.microSkill),
    prerequisiteCellIds: asStringArray(data.prerequisiteCellIds),
    difficultyLevels: asNumberArray(data.difficultyLevels),
    questionTypes: asStringArray(data.questionTypes) as BlueprintCell["questionTypes"],
    minimumItems: typeof data.minimumItems === "number" ? data.minimumItems : 1,
    supportedLanguages: asStringArray(data.supportedLanguages) as BlueprintLanguage[],
    allowedExamModes: asStringArray(data.allowedExamModes) as BlueprintExamMode[],
    verificationStatus: (asString(data.verificationStatus, "draft") as BlueprintCell["verificationStatus"]),
    sourceType: (asString(data.sourceType, "original-csca-style") as BlueprintCell["sourceType"]),
    sourceReference: asString(data.sourceReference),
    reviewer: typeof data.reviewer === "string" ? data.reviewer : null,
    reviewedAt: typeof data.reviewedAt === "string" ? data.reviewedAt : null,
    knownLimitations: asString(data.knownLimitations),
    version: typeof data.version === "number" ? data.version : 1,
    createdAt: asString(data.createdAt, new Date(0).toISOString()),
    updatedAt: asString(data.updatedAt, new Date(0).toISOString()),
  };
}

function toQuestionRecord(
  id: string,
  data: Record<string, unknown>,
  correctAnswerLabel: string,
): BlueprintQuestionRecord {
  return {
    questionId: id,
    cellId: typeof data.cellId === "string" ? data.cellId : null,
    subject: data.subject === "physics" ? "physics" : "mathematics",
    topicId: asString(data.topicId),
    difficulty: typeof data.difficulty === "number" ? data.difficulty : 1,
    questionType: (asString(data.questionType, "concept-recognition") as BlueprintQuestionRecord["questionType"]),
    language: (asString(data.language, "en") as BlueprintLanguage),
    status: (asString(data.status, "draft") as BlueprintQuestionRecord["status"]),
    demo: data.demo === true,
    verificationStatus: (asString(data.verificationStatus, "unverified") as BlueprintQuestionRecord["verificationStatus"]),
    sourceType: (asString(data.sourceType, "template-generated") as BlueprintQuestionRecord["sourceType"]),
    sourceReference: asString(data.sourceReference, asString(data.sourceNote)),
    reviewer: typeof data.reviewer === "string" ? data.reviewer : null,
    reviewedAt: typeof data.reviewedAt === "string" ? data.reviewedAt : null,
    correctAnswerLabel,
    knownLimitations: asString(data.knownLimitations),
    contentVersion: typeof data.version === "number" ? data.version : 0,
    verifiedContentVersion:
      typeof data.verifiedContentVersion === "number" ? data.verifiedContentVersion : null,
    publicAnswerKey: data.publicAnswerKey === true,
  };
}

/** Reads one blueprint cell, or `undefined` when it does not exist. */
export async function loadBlueprintCell(cellId: string): Promise<BlueprintCell | undefined> {
  const snapshot = await db.collection(BLUEPRINT_COLLECTION).doc(cellId).get();
  const data = snapshot.data();
  return snapshot.exists && data ? toCell(snapshot.id, data) : undefined;
}

/** Reads the blueprint and the published bank, and recomputes coverage from them. */
export async function loadBlueprintState(): Promise<{
  cells: BlueprintCell[];
  items: BlueprintQuestionRecord[];
}> {
  const [cellSnapshot, questionSnapshot] = await Promise.all([
    db.collection(BLUEPRINT_COLLECTION).get(),
    db.collection("questions").get(),
  ]);

  const cells = cellSnapshot.docs.map((document) => toCell(document.id, document.data()));

  // The correct-answer label is private content and is read here only to detect
  // answer-key skew. It is never returned to any caller.
  const solutionSnapshots = await db.getAll(
    ...questionSnapshot.docs.map((document) => db.collection("questionSolutions").doc(document.id)),
  );
  const labelById = new Map(
    solutionSnapshots.map((snapshot) => [snapshot.id, asString(snapshot.data()?.correctAnswer, "?")]),
  );

  const items = questionSnapshot.docs.map((document) =>
    toQuestionRecord(document.id, document.data(), labelById.get(document.id) ?? "?"),
  );

  return { cells, items };
}

export const getBlueprintCoverage = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(BlueprintCoverageSchema, request.data);
  await enforceRateLimit("getBlueprintCoverage", principal.uid, 120, 60 * 60);

  const { cells, items } = await loadBlueprintState();
  const scoped = input.subject ? cells.filter((cell) => cell.subject === input.subject) : cells;
  const coverage = evaluateBlueprintCoverage(scoped, items, {
    ...(input.mode ? { requiredModes: [input.mode] } : {}),
  });

  return {
    generatedAt: new Date().toISOString(),
    totals: coverage.totals,
    verifiedCells: coverage.verifiedCells,
    issues: coverage.issues,
    orphanQuestionIds: coverage.orphanQuestionIds,
    cells: coverage.cells.map((entry) => ({
      id: entry.cell.id,
      subject: entry.cell.subject,
      module: entry.cell.module,
      topicId: entry.cell.topicId,
      topic: entry.cell.topic,
      skill: entry.cell.skill,
      microSkill: entry.cell.microSkill,
      difficultyLevels: entry.cell.difficultyLevels,
      questionTypes: entry.cell.questionTypes,
      supportedLanguages: entry.cell.supportedLanguages,
      allowedExamModes: entry.cell.allowedExamModes,
      minimumItems: entry.cell.minimumItems,
      verificationStatus: entry.cell.verificationStatus,
      sourceType: entry.cell.sourceType,
      sourceReference: entry.cell.sourceReference,
      reviewer: entry.cell.reviewer,
      reviewedAt: entry.cell.reviewedAt,
      knownLimitations: entry.cell.knownLimitations,
      totalItems: entry.totalItems,
      verifiedItems: entry.verifiedItems,
      demoItems: entry.demoItems,
      publicKeyItems: entry.publicKeyItems,
      excludedForMode: entry.excludedForMode,
      languages: entry.languages,
      missingLanguages: entry.missingLanguages,
      missingDifficulties: entry.missingDifficulties,
      missingQuestionTypes: entry.missingQuestionTypes,
      status: entry.status,
      reasons: entry.reasons,
    })),
  };
});

export const upsertBlueprintCell = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(UpsertBlueprintCellSchema, request.data);
  await enforceRateLimit("upsertBlueprintCell", principal.uid, 300, 60 * 60);

  const reference = db.collection(BLUEPRINT_COLLECTION).doc(input.cellId);
  const now = new Date().toISOString();

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.data();
    const { cellId, ...cell } = input;

    transaction.set(
      reference,
      {
        ...cell,
        id: cellId,
        // Editing a requirement invalidates any previous certification of it.
        verificationStatus: snapshot.exists ? "draft" : "draft",
        reviewer: null,
        reviewedAt: null,
        version: typeof existing?.version === "number" ? existing.version + 1 : 1,
        createdAt: typeof existing?.createdAt === "string" ? existing.createdAt : now,
        updatedAt: now,
        updatedBy: principal.uid,
        serverUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );
  });

  await writeAuditLog(principal.uid, "blueprint.cell.upsert", {
    cellId: input.cellId,
    subject: input.subject,
    topicId: input.topicId,
  });

  return { cellId: input.cellId, verificationStatus: "draft" as const };
});

/**
 * The only path that can mark content verified. The reviewer identity and the
 * review time are server-side facts, so a caller cannot certify content by
 * claiming someone else reviewed it, or backdate a review.
 */
export const setContentVerification = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(SetContentVerificationSchema, request.data);
  await enforceRateLimit("setContentVerification", principal.uid, 600, 60 * 60);

  const reference =
    input.target === "blueprint-cell"
      ? db.collection(BLUEPRINT_COLLECTION).doc(input.targetId)
      : db.collection("questions").doc(input.targetId);

  const verified = input.verificationStatus === "reviewer-verified";
  const reviewedAt = new Date().toISOString();
  const reviewer = principal.email ?? principal.uid;

  const outcome = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "That content does not exist.");
    }
    const data = snapshot.data() ?? {};
    const contentVersion = typeof data.version === "number" ? data.version : 0;

    if (input.target === "question" && data.demo === true && verified) {
      throw new HttpsError(
        "failed-precondition",
        "Demo material cannot be marked verified. Publish a reviewed original item instead.",
      );
    }

    // A review certifies a specific wording. If the item changed since the
    // reviewer opened it, the approval is for text that no longer exists.
    if (verified && input.contentVersion !== contentVersion) {
      throw new HttpsError(
        "aborted",
        "This item changed since it was opened for review. Re-read the current version before approving it.",
        { expected: input.contentVersion, actual: contentVersion },
      );
    }

    transaction.set(
      reference,
      {
        verificationStatus: input.verificationStatus,
        reviewer: verified ? reviewer : null,
        reviewedAt: verified ? reviewedAt : null,
        verifiedContentVersion: verified ? contentVersion : null,
        ...(input.sourceReference === undefined ? {} : { sourceReference: input.sourceReference }),
        // Deliberately no version bump: recording a review is not a content change.
        updatedAt: reviewedAt,
        updatedBy: principal.uid,
        serverUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return {
      previous: typeof data.verificationStatus === "string" ? data.verificationStatus : "unverified",
      contentVersion,
    };
  });
  const previous = outcome.previous;

  await writeAuditLog(principal.uid, "content.verification.changed", {
    target: input.target,
    targetId: input.targetId,
    from: previous,
    to: input.verificationStatus,
    contentVersion: outcome.contentVersion,
    reviewer: verified ? reviewer : null,
    reviewedAt: verified ? reviewedAt : null,
    ...(input.note === undefined ? {} : { note: input.note }),
  });

  return {
    targetId: input.targetId,
    verificationStatus: input.verificationStatus,
    reviewer: verified ? reviewer : null,
    reviewedAt: verified ? reviewedAt : null,
    verifiedContentVersion: verified ? outcome.contentVersion : null,
  };
});

export interface BlueprintGateResult {
  cellIds: string[];
  questionIds: string[];
}

/**
 * Recomputes coverage and refuses unless the exam can honestly be published.
 * Shared by `publishMockExam` and by `startMockExam`, so an exam published before
 * a cell regressed cannot keep being served.
 */
export async function assertExamIsPublishable(input: {
  subject: BlueprintSubject;
  mode: BlueprintExamMode;
  cellIds: string[];
  questionCount: number;
  language: BlueprintLanguage;
  seed: string;
}): Promise<BlueprintGateResult> {
  const { cells, items } = await loadBlueprintState();
  // The report is computed for the mode being published, so an item whose answer
  // key is public cannot secure a confidential mock.
  const coverage = evaluateBlueprintCoverage(cells, items, { mode: input.mode });
  const decision = canPublishExam(coverage, {
    subject: input.subject,
    mode: input.mode,
    cellIds: input.cellIds,
  });

  if (!decision.allowed) {
    throw new HttpsError("failed-precondition", "The blueprint does not support this exam.", {
      reason: "insufficient-verified-coverage",
      blockers: decision.blockers.slice(0, 50),
    });
  }

  const composed = composeExam(cells, items, {
    subject: input.subject,
    mode: input.mode,
    questionCount: input.questionCount,
    language: input.language,
    cellIds: input.cellIds,
    seed: input.seed,
  });

  if (!composed.ok) {
    throw new HttpsError("failed-precondition", composed.message, {
      reason: composed.error,
      available: composed.available,
      required: composed.required,
      emptyCells: composed.shortfallByCell.map((entry) => entry.cellId).slice(0, 50),
    });
  }

  return {
    cellIds: composed.usedCellIds,
    questionIds: composed.questions.map((question) => question.questionId),
  };
}

export const publishMockExam = onCall(adminCallableOptions, async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(PublishMockExamSchema, request.data);
  await enforceRateLimit("publishMockExam", principal.uid, 60, 60 * 60);

  const gate = await assertExamIsPublishable({
    subject: input.subject,
    mode: "mock",
    cellIds: input.cellIds,
    questionCount: input.questionCount,
    language: input.language,
    seed: input.seed,
  });

  const now = new Date().toISOString();
  const reference = db.collection("examTemplates").doc(input.mockExamId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.data();
    transaction.set(
      reference,
      {
        id: input.mockExamId,
        title: input.title,
        subject: input.subject,
        questionIds: gate.questionIds,
        questionCount: gate.questionIds.length,
        durationMinutes: input.durationMinutes,
        instructions: input.instructions,
        blueprintCellIds: gate.cellIds,
        language: input.language,
        seed: input.seed,
        status: "published",
        demo: false,
        version: typeof existing?.version === "number" ? existing.version + 1 : 1,
        createdBy: typeof existing?.createdBy === "string" ? existing.createdBy : principal.uid,
        updatedBy: principal.uid,
        createdAt: typeof existing?.createdAt === "string" ? existing.createdAt : now,
        updatedAt: now,
        publishedAt: now,
        serverUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: false },
    );
  });

  await writeAuditLog(principal.uid, "mock.published", {
    mockExamId: input.mockExamId,
    subject: input.subject,
    questionCount: gate.questionIds.length,
    cellCount: gate.cellIds.length,
  });

  return { mockExamId: input.mockExamId, questionCount: gate.questionIds.length, cellIds: gate.cellIds };
});
