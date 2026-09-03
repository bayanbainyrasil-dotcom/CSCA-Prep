import { createHash, timingSafeEqual } from "node:crypto";

import { FieldPath, FieldValue, Timestamp } from "firebase-admin/firestore";
import type {
  DocumentData,
  Query,
  QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import {
  enforceRateLimit,
  jsonSafe,
  parseInput,
  requireAdmin,
  requireAuth,
  writeAuditLog,
} from "./callable";
import { validateQuestionAgainstCell } from "./blueprint-engine";
import { loadBlueprintCell } from "./blueprint-callables";
import { auth, db } from "./platform";
import {
  BootstrapAdminSchema,
  ClassifyMistakeSchema,
  DeleteMyAccountSchema,
  EnsureUserProfileSchema,
  ExportMyDataSchema,
  ExportQuestionBankSchema,
  FinalizeDiagnosticSchema,
  GradeQuestionSchema,
  ImportQuestionBankSchema,
  ResetMyProgressSchema,
  SetUserRoleSchema,
  type QuestionInput,
} from "./schemas";

const ADMIN_BOOTSTRAP_CODE = defineSecret("ADMIN_BOOTSTRAP_CODE");

// Server-authoritative mock exam lifecycle. Kept in its own module so the
// answer-key boundary stays reviewable in one place.
export {
  resumeMockExam,
  reviewMockExam,
  saveMockAnswer,
  startMockExam,
  submitMockExam,
} from "./mock-callables";

// Curriculum blueprint administration and the exam publication gate.
export {
  getBlueprintCoverage,
  publishMockExam,
  setContentVerification,
  upsertBlueprintCell,
} from "./blueprint-callables";

// Content import: blueprint requirements, the public practice seed, and an
// administrator's private production file.
export {
  importBlueprintDraft,
  importPrivateQuestions,
  importPublicQuestionSeed,
} from "./import-callables";

export { recordOutlineReview, readOutlineReviews } from "./outline-callables";

const standardCallableOptions = {
  enforceAppCheck: true,
  cors: true,
} as const;

const sensitiveCallableOptions = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  cors: true,
} as const;

const USER_PROGRESS_COLLECTIONS = [
  "progress",
  "topicMastery",
  "attempts",
  "studySessions",
  "dailyPlans",
  "mistakes",
  "bookmarks",
  "notes",
  "examAttempts",
  "vocabularyProgress",
  "formulaProgress",
  "studyPlans",
  "diagnostics",
  "syncState",
] as const;

function secretMatches(candidate: string, expected: string): boolean {
  const candidateHash = createHash("sha256").update(candidate).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
}

async function auditWithoutBreakingRequest(
  actorUid: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await writeAuditLog(actorUid, action, details);
  } catch (error) {
    logger.error("Audit log write failed.", { actorUid, action, error });
  }
}

async function assignBootstrapOwner(uid: string): Promise<void> {
  const authUser = await auth.getUser(uid);
  const currentClaims = authUser.customClaims ?? {};
  await auth.setCustomUserClaims(uid, {
    ...currentClaims,
    admin: true,
    role: "admin",
  });

  const userRef = db.collection("users").doc(uid);
  const bootstrapRef = db.collection("_system").doc("adminBootstrap");
  await db.runTransaction(async (transaction) => {
    const profile = await transaction.get(userRef);
    const profileData = profile.data();
    const roleVersion =
      typeof profileData?.roleVersion === "number"
        ? profileData.roleVersion + 1
        : 1;

    transaction.set(
      userRef,
      {
        uid,
        name: authUser.displayName ?? "CSCA Admin",
        email: authUser.email ?? null,
        photoURL: authUser.photoURL ?? null,
        role: "admin",
        roleVersion,
        createdAt: profile.exists
          ? (profileData?.createdAt ?? FieldValue.serverTimestamp())
          : FieldValue.serverTimestamp(),
        lastActiveAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(profile.exists ? {} : { version: 1 }),
      },
      { merge: true },
    );
    transaction.set(
      bootstrapRef,
      {
        status: "completed",
        ownerUid: uid,
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export const ensureUserProfile = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(EnsureUserProfileSchema, request.data);
    const authUser = await auth.getUser(principal.uid);
    const ref = db.collection("users").doc(principal.uid);

    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const existing = snapshot.data();
      const currentVersion =
        typeof existing?.version === "number" ? existing.version : 0;
      const role = existing?.role === "admin" ? "admin" : "user";

      const profile = {
        uid: principal.uid,
        name: authUser.displayName ?? "CSCA Learner",
        email: authUser.email ?? null,
        photoURL: authUser.photoURL ?? null,
        role,
        timezone: input.timezone ?? existing?.timezone ?? "UTC",
        targetExam: input.targetExam ?? existing?.targetExam ?? "CSCA",
        targetDate:
          input.targetDate !== undefined
            ? Timestamp.fromDate(new Date(input.targetDate))
            : (existing?.targetDate ?? null),
        preferredLanguage:
          input.preferredLanguage ?? existing?.preferredLanguage ?? "en-ru",
        settings: input.settings ?? existing?.settings ?? {},
        onboarding: input.onboarding ?? existing?.onboarding ?? {},
        version: currentVersion + 1,
        lastActiveAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(snapshot.exists
          ? {}
          : { createdAt: FieldValue.serverTimestamp(), roleVersion: 0 }),
      };

      transaction.set(ref, profile, { merge: true });
      return { created: !snapshot.exists, version: currentVersion + 1, role };
    });

    return result;
  },
);

export const bootstrapAdmin = onCall(
  {
    ...sensitiveCallableOptions,
    secrets: [ADMIN_BOOTSTRAP_CODE],
  },
  async (request) => {
    const principal = requireAuth(request);
    const firebaseClaim =
      principal.token.firebase !== null &&
      typeof principal.token.firebase === "object"
        ? (principal.token.firebase as Record<string, unknown>)
        : undefined;

    if (
      principal.token.email_verified !== true ||
      firebaseClaim?.sign_in_provider !== "google.com"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Bootstrap requires a verified Google sign-in.",
      );
    }

    const bootstrapRef = db.collection("_system").doc("adminBootstrap");
    const currentState = await bootstrapRef.get();
    if (currentState.data()?.status === "completed") {
      if (currentState.data()?.ownerUid !== principal.uid) {
        throw new HttpsError(
          "failed-precondition",
          "Administrator bootstrap has already been completed.",
        );
      }
      await assignBootstrapOwner(principal.uid);
      return { role: "admin", alreadyConfigured: true, refreshToken: true };
    }

    const input = parseInput(BootstrapAdminSchema, request.data);
    const sourceIp = request.rawRequest.ip || "unknown";
    await enforceRateLimit(
      "bootstrapAdmin",
      `${principal.uid}:${sourceIp}`,
      5,
      15 * 60,
    );

    const expectedCode = ADMIN_BOOTSTRAP_CODE.value();
    if (!expectedCode || !secretMatches(input.code, expectedCode)) {
      await auditWithoutBreakingRequest(principal.uid, "admin.bootstrap.denied");
      throw new HttpsError("permission-denied", "Bootstrap credentials are invalid.");
    }

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(bootstrapRef);
      const state = snapshot.data();
      if (state?.status === "completed") {
        throw new HttpsError(
          "failed-precondition",
          "Administrator bootstrap has already been completed.",
        );
      }
      if (
        state?.status === "provisioning" &&
        state.ownerUid !== principal.uid
      ) {
        throw new HttpsError(
          "aborted",
          "Administrator bootstrap is already in progress.",
        );
      }
      transaction.set(
        bootstrapRef,
        {
          status: "provisioning",
          ownerUid: principal.uid,
          reservedAt: state?.reservedAt ?? FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });

    await assignBootstrapOwner(principal.uid);
    await auditWithoutBreakingRequest(principal.uid, "admin.bootstrap.completed");

    return { role: "admin", alreadyConfigured: false, refreshToken: true };
  },
);

export const setUserRole = onCall(
  sensitiveCallableOptions,
  async (request) => {
    const principal = requireAdmin(request);
    const input = parseInput(SetUserRoleSchema, request.data);
    if (input.targetUid === principal.uid && input.role !== "admin") {
      throw new HttpsError(
        "failed-precondition",
        "Administrators cannot remove their own final access.",
      );
    }

    await enforceRateLimit("setUserRole", principal.uid, 20, 60 * 60);
    const target = await auth.getUser(input.targetUid);
    const nextClaims: Record<string, unknown> = { ...(target.customClaims ?? {}) };
    if (input.role === "admin") {
      nextClaims.admin = true;
      nextClaims.role = "admin";
    } else {
      delete nextClaims.admin;
      delete nextClaims.role;
    }

    await auth.setCustomUserClaims(input.targetUid, nextClaims);
    const profileRef = db.collection("users").doc(input.targetUid);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(profileRef);
      const roleVersion =
        typeof snapshot.data()?.roleVersion === "number"
          ? snapshot.data()!.roleVersion + 1
          : 1;
      transaction.set(
        profileRef,
        {
          uid: input.targetUid,
          role: input.role,
          roleVersion,
          updatedAt: FieldValue.serverTimestamp(),
          ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        },
        { merge: true },
      );
    });

    await auditWithoutBreakingRequest(principal.uid, "admin.role.changed", {
      targetUid: input.targetUid,
      role: input.role,
    });
    return { targetUid: input.targetUid, role: input.role, refreshToken: true };
  },
);

function pageResult(documents: QueryDocumentSnapshot<DocumentData>[]) {
  return {
    documents: documents.map((document) => ({
      id: document.id,
      data: jsonSafe(document.data()),
    })),
    nextCursor:
      documents.length > 0 ? documents[documents.length - 1]!.id : null,
  };
}

export const exportMyData = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(ExportMyDataSchema, request.data);
    await enforceRateLimit("exportMyData", principal.uid, 120, 60 * 60);
    const userRef = db.collection("users").doc(principal.uid);

    if (input.collection === "profile") {
      const snapshot = await userRef.get();
      return {
        collection: "profile",
        documents: snapshot.exists
          ? [{ id: principal.uid, data: jsonSafe(snapshot.data()) }]
          : [],
        nextCursor: null,
      };
    }

    let query: Query<DocumentData> = userRef
      .collection(input.collection)
      .orderBy(FieldPath.documentId())
      .limit(input.pageSize);
    if (input.cursor) {
      query = query.startAfter(input.cursor);
    }
    const snapshot = await query.get();
    return { collection: input.collection, ...pageResult(snapshot.docs) };
  },
);

function splitQuestion(question: QuestionInput) {
  const {
    correctAnswer,
    solution,
    shortSolution,
    explanation,
    commonMistakes,
    ...prompt
  } = question;
  return {
    prompt,
    privateSolution: {
      correctAnswer,
      solution,
      shortSolution,
      explanation,
      commonMistakes,
    },
  };
}

function withoutServerMetadata(data: DocumentData): Record<string, unknown> {
  const {
    version: _version,
    createdAt: _createdAt,
    createdBy: _createdBy,
    updatedAt: _updatedAt,
    updatedBy: _updatedBy,
    questionId: _questionId,
    ...content
  } = data;
  return content;
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(maximum, Math.max(minimum, numeric));
}

function rounded(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildTrustedMastery(input: {
  uid: string;
  attemptId: string;
  subject: "mathematics" | "physics";
  topicId: string;
  isCorrect: boolean;
  confidence: "guess" | "not-sure" | "sure";
  difficulty: number;
  englishComprehension: number;
  hintUsed: boolean;
  durationSeconds: number;
  expectedTimeSeconds: number;
  eventTime: string;
  existing?: Record<string, unknown>;
}) {
  const current = input.existing ?? {};
  const attemptCount = Math.trunc(clampNumber(current.attemptCount, 0, 0, 1_000_000));
  const correctAttemptCount = Math.trunc(clampNumber(current.correctAttemptCount, 0, 0, attemptCount));
  const score = clampNumber(current.score, 0, 0, 100);
  const speed = Math.min(1, Math.max(0, input.expectedTimeSeconds / Math.max(1, input.durationSeconds)));
  const knowledgeConfidence = !input.isCorrect ? 0 : input.confidence === "sure" ? 1 : input.confidence === "not-sure" ? 0.72 : 0.35;
  const calibration = input.isCorrect
    ? input.confidence === "sure" ? 1 : input.confidence === "not-sure" ? 0.72 : 0.35
    : input.confidence === "guess" ? 0.85 : input.confidence === "not-sure" ? 0.55 : 0.05;
  const difficultyScore = (input.difficulty - 1) / 4;
  const observed = input.isCorrect
    ? 100 * (0.48 + 0.17 * difficultyScore + 0.1 * speed + 0.15 * knowledgeConfidence + 0.1 * input.englishComprehension)
    : 0;
  const evidenceDamping = Math.min(1, Math.max(0.35, 1 / Math.sqrt(attemptCount + 1)));
  const learningRate = (input.isCorrect ? 0.16 : 0.24) * evidenceDamping;
  const currentConsecutive = Math.trunc(clampNumber(current.consecutiveCorrect, 0, 0, 1_000_000));
  let nextScore = score + learningRate * (observed - score);
  if (input.isCorrect && input.confidence === "sure" && input.difficulty >= 3 && currentConsecutive >= 2) {
    nextScore += Math.min(1.5, 0.35 * currentConsecutive);
  }

  let quality: number;
  if (!input.isCorrect) quality = input.confidence === "sure" ? 0 : input.confidence === "not-sure" ? 1 : 2;
  else {
    quality = input.confidence === "sure" ? 5 : input.confidence === "not-sure" ? 4 : 3;
    if (input.hintUsed) quality -= 1;
    if (input.durationSeconds > input.expectedTimeSeconds * 1.5) quality -= 1;
    if (input.englishComprehension < 0.5) quality -= 1;
    quality = Math.min(5, Math.max(0, Math.round(quality)));
  }

  const previousStage = Math.trunc(clampNumber(current.reviewStage, 0, 0, 20));
  const previousEase = clampNumber(current.easeFactor, 2.5, 1.3, 3);
  let reviewStage: number;
  let easeFactor: number;
  let lapses = Math.trunc(clampNumber(current.lapses, 0, 0, 1_000_000));
  if (quality < 3) {
    reviewStage = 0;
    lapses += 1;
    easeFactor = Math.max(1.3, previousEase - (quality === 0 ? 0.25 : 0.15));
  } else {
    const canAdvance = input.confidence !== "guess" && !input.hintUsed;
    reviewStage = canAdvance ? previousStage + 1 + (quality === 5 ? 1 : 0) : previousStage;
    easeFactor = Math.min(3, Math.max(1.3, previousEase + (quality === 5 ? 0.1 : quality === 4 ? 0.03 : -0.05)));
  }
  reviewStage = Math.min(20, Math.max(0, reviewStage));
  const baseIntervals = [1, 3, 7, 14, 30, 60, 120, 240, 365];
  const baseInterval = baseIntervals[Math.min(reviewStage, baseIntervals.length - 1)] ?? 1;
  const confidenceMultiplier = input.confidence === "guess" ? 0.6 : input.confidence === "not-sure" ? 0.85 : 1;
  const intervalDays = Math.min(365, Math.max(1, Math.round(baseInterval * Math.min(1.2, Math.max(0.65, easeFactor / 2.5)) * confidenceMultiplier)));
  const nextReviewAt = new Date(Date.parse(input.eventTime) + intervalDays * 86_400_000).toISOString();
  const nextAttemptCount = attemptCount + 1;
  const nextCorrectCount = correctAttemptCount + (input.isCorrect ? 1 : 0);
  const emaWeight = attemptCount === 0 ? 1 : 0.25;
  const recent = Array.isArray(current.recentAttemptIds)
    ? current.recentAttemptIds.filter((value): value is string => typeof value === "string").slice(-19)
    : [];

  return {
    id: createHash("sha256").update(`${input.uid}:${input.topicId}`).digest("hex"),
    userId: input.uid,
    topicId: input.topicId,
    subject: input.subject,
    score: rounded(Math.min(100, Math.max(0, nextScore))),
    accuracy: rounded(nextCorrectCount / nextAttemptCount),
    speedScore: rounded(clampNumber(current.speedScore, 0, 0, 1) * (1 - emaWeight) + speed * emaWeight),
    confidenceCalibration: rounded(clampNumber(current.confidenceCalibration, 0, 0, 1) * (1 - emaWeight) + calibration * emaWeight),
    englishComprehension: rounded(clampNumber(current.englishComprehension, 0, 0, 1) * (1 - emaWeight) + input.englishComprehension * emaWeight),
    attemptCount: nextAttemptCount,
    correctAttemptCount: nextCorrectCount,
    repetitions: Math.trunc(clampNumber(current.repetitions, 0, 0, 1_000_000)) + 1,
    consecutiveCorrect: input.isCorrect ? currentConsecutive + 1 : 0,
    lapses,
    reviewStage,
    easeFactor: rounded(easeFactor),
    intervalDays,
    highestSuccessfulDifficulty: input.isCorrect && input.confidence !== "guess"
      ? Math.max(Math.trunc(clampNumber(current.highestSuccessfulDifficulty, 0, 0, 5)), input.difficulty)
      : Math.trunc(clampNumber(current.highestSuccessfulDifficulty, 0, 0, 5)),
    recentAttemptIds: [...recent, input.attemptId],
    lastReviewedAt: input.eventTime,
    nextReviewAt,
    version: Math.trunc(clampNumber(current.version, 0, 0, 1_000_000)) + 1,
    createdAt: typeof current.createdAt === "string" ? current.createdAt : input.eventTime,
    updatedAt: input.eventTime,
  };
}

export const importQuestionBank = onCall(
  sensitiveCallableOptions,
  async (request) => {
    const principal = requireAdmin(request);
    const input = parseInput(ImportQuestionBankSchema, request.data);
    await enforceRateLimit("importQuestionBank", principal.uid, 30, 60 * 60);

    // Every item must answer a real requirement, and must actually fit it. This
    // runs on a dry run too, so the editor reports the same refusal it would get
    // on save rather than discovering it afterwards.
    const cellIds = [...new Set(input.items.map((item) => item.question.cellId))];
    const cells = new Map(
      await Promise.all(
        cellIds.map(async (cellId) => [cellId, await loadBlueprintCell(cellId)] as const),
      ),
    );
    const mappingErrors = input.items.flatMap((item) => {
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
      return problems.map((problem) => ({ id: item.id, ...problem }));
    });
    if (mappingErrors.length > 0) {
      throw new HttpsError(
        "failed-precondition",
        "Some questions do not match the blueprint cell they claim.",
        { mappingErrors: mappingErrors.slice(0, 50) },
      );
    }

    if (input.dryRun) {
      return {
        dryRun: true,
        valid: true,
        count: input.items.length,
        ids: input.items.map((item) => item.id),
      };
    }

    const promptRefs = input.items.map((item) =>
      db.collection("questions").doc(item.id),
    );
    const result = await db.runTransaction(async (transaction) => {
      const snapshots = await Promise.all(
        promptRefs.map((reference) => transaction.get(reference)),
      );
      const versions: Record<string, number> = {};

      input.items.forEach((item, index) => {
        const snapshot = snapshots[index]!;
        const currentVersion = snapshot.exists
          ? Number(snapshot.data()?.version ?? 0)
          : 0;
        if (
          item.expectedVersion !== undefined &&
          item.expectedVersion !== currentVersion
        ) {
          throw new HttpsError(
            "aborted",
            `Version conflict for question ${item.id}.`,
            { id: item.id, expected: item.expectedVersion, actual: currentVersion },
          );
        }

        const nextVersion = currentVersion + 1;
        const { prompt, privateSolution } = splitQuestion(item.question);
        // A content write always resets verification: whatever a reviewer approved
        // before, they did not approve this text. An import can never publish an
        // item as verified.
        const verification = {
          verificationStatus: "pending-review" as const,
          reviewer: null,
          reviewedAt: null,
          verifiedContentVersion: null,
        };
        const common = {
          version: nextVersion,
          createdAt: snapshot.exists
            ? (snapshot.data()?.createdAt ?? FieldValue.serverTimestamp())
            : FieldValue.serverTimestamp(),
          createdBy: snapshot.exists
            ? (snapshot.data()?.createdBy ?? principal.uid)
            : principal.uid,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: principal.uid,
        };
        transaction.set(
          promptRefs[index]!,
          { id: item.id, ...prompt, ...verification, ...common },
          { merge: false },
        );
        transaction.set(
          db.collection("questionSolutions").doc(item.id),
          {
            questionId: item.id,
            status: item.question.status,
            ...privateSolution,
            ...common,
          },
          { merge: false },
        );
        versions[item.id] = nextVersion;
      });
      return versions;
    });

    await auditWithoutBreakingRequest(principal.uid, "questions.imported", {
      count: input.items.length,
      ids: input.items.map((item) => item.id),
    });
    return { dryRun: false, imported: input.items.length, versions: result };
  },
);

export const exportQuestionBank = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAdmin(request);
    const input = parseInput(ExportQuestionBankSchema, request.data);
    await enforceRateLimit("exportQuestionBank", principal.uid, 120, 60 * 60);

    let query: Query<DocumentData> = db.collection("questions");
    if (input.status) {
      query = query.where("status", "==", input.status);
    }
    query = query.orderBy(FieldPath.documentId()).limit(input.pageSize);
    if (input.cursor) {
      query = query.startAfter(input.cursor);
    }

    const prompts = await query.get();
    const solutionRefs = prompts.docs.map((document) =>
      db.collection("questionSolutions").doc(document.id),
    );
    const solutions =
      solutionRefs.length > 0 ? await db.getAll(...solutionRefs) : [];
    const solutionById = new Map(
      solutions.map((snapshot) => [snapshot.id, snapshot.data()]),
    );
    const items = prompts.docs.map((document) => {
      const prompt = withoutServerMetadata(document.data());
      const privateSolution = solutionById.get(document.id);
      const { id: _id, ...promptWithoutId } = prompt;
      return {
        id: document.id,
        expectedVersion: Number(document.data().version ?? 0),
        question:
          privateSolution === undefined
            ? null
            : jsonSafe({
                ...promptWithoutId,
                ...withoutServerMetadata(privateSolution),
              }),
      };
    });

    await auditWithoutBreakingRequest(principal.uid, "questions.exported", {
      count: items.length,
    });
    return {
      items,
      nextCursor:
        prompts.docs.length > 0
          ? prompts.docs[prompts.docs.length - 1]!.id
          : null,
    };
  },
);

export const gradeQuestion = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(GradeQuestionSchema, request.data);
    await enforceRateLimit("gradeQuestion", principal.uid, 600, 60 * 60);

    const [promptSnapshot, solutionSnapshot] = await Promise.all([
      db.collection("questions").doc(input.questionId).get(),
      db.collection("questionSolutions").doc(input.questionId).get(),
    ]);
    if (
      !promptSnapshot.exists ||
      promptSnapshot.data()?.status !== "published" ||
      !solutionSnapshot.exists ||
      solutionSnapshot.data()?.status !== "published"
    ) {
      throw new HttpsError("not-found", "Published question was not found.");
    }

    const options = promptSnapshot.data()?.options;
    if (
      !Array.isArray(options) ||
      !options.some(
        (option) =>
          option !== null &&
          typeof option === "object" &&
          (option as Record<string, unknown>).id === input.selectedAnswer,
      )
    ) {
      throw new HttpsError("invalid-argument", "Selected answer is not an option.");
    }

    const solution = solutionSnapshot.data()!;
    const correct = input.selectedAnswer === solution.correctAnswer;
    const attemptRef = db
      .collection("users")
      .doc(principal.uid)
      .collection("attempts")
      .doc(input.idempotencyKey);
    const mistakeId = createHash("sha256")
      .update(`${input.questionId}:${input.idempotencyKey}`)
      .digest("hex");
    const mistakeRef = db
      .collection("users")
      .doc(principal.uid)
      .collection("mistakes")
      .doc(mistakeId);
    const masteryId = createHash("sha256")
      .update(`${principal.uid}:${String(promptSnapshot.data()?.topicId)}`)
      .digest("hex");
    const masteryRef = db
      .collection("users")
      .doc(principal.uid)
      .collection("topicMastery")
      .doc(masteryId);

    const eventTime = new Date().toISOString();
    const outcome = await db.runTransaction(async (transaction) => {
      const [existingAttempt, existingMastery] = await Promise.all([
        transaction.get(attemptRef),
        transaction.get(masteryRef),
      ]);
      if (existingAttempt.exists) {
        return { created: false, payload: existingAttempt.data()?.payload };
      }

      const payload = {
        id: input.idempotencyKey,
        userId: principal.uid,
        deviceId: input.deviceId,
        questionId: input.questionId,
        subject: promptSnapshot.data()?.subject,
        topicId: promptSnapshot.data()?.topicId,
        mode: input.mode,
        selectedAnswer: input.selectedAnswer,
        correctAnswer: solution.correctAnswer,
        isCorrect: correct,
        confidence: input.confidence,
        errorType: correct ? null : (input.errorType ?? null),
        hintUsed: input.hintUsed,
        englishComprehension: input.englishComprehension,
        difficulty: promptSnapshot.data()?.difficulty,
        startedAt: input.startedAt,
        answeredAt: input.answeredAt,
        durationSeconds: input.elapsedMs / 1_000,
        version: 1,
        updatedAt: eventTime,
      };
      transaction.set(attemptRef, {
        entityType: "attempt",
        entityId: input.idempotencyKey,
        ownerId: principal.uid,
        operation: "upsert",
        version: 1,
        mutationId: input.idempotencyKey,
        updatedAt: eventTime,
        serverUpdatedAt: FieldValue.serverTimestamp(),
        payload,
      });

      const masteryPayload = buildTrustedMastery({
        uid: principal.uid,
        attemptId: input.idempotencyKey,
        subject: promptSnapshot.data()?.subject as "mathematics" | "physics",
        topicId: String(promptSnapshot.data()?.topicId),
        isCorrect: correct,
        confidence: input.confidence,
        difficulty: Number(promptSnapshot.data()?.difficulty ?? 1),
        englishComprehension: input.englishComprehension,
        hintUsed: input.hintUsed,
        durationSeconds: input.elapsedMs / 1_000,
        expectedTimeSeconds: Number(promptSnapshot.data()?.estimatedTime ?? 60),
        eventTime,
        ...(existingMastery.exists && existingMastery.data()?.payload && typeof existingMastery.data()?.payload === "object"
          ? { existing: existingMastery.data()!.payload as Record<string, unknown> }
          : {}),
      });
      const masteryMutationId = createHash("sha256")
        .update(`${principal.uid}:${input.idempotencyKey}:mastery`)
        .digest("hex");
      transaction.set(masteryRef, {
        entityType: "mastery",
        entityId: masteryPayload.id,
        ownerId: principal.uid,
        operation: "upsert",
        version: masteryPayload.version,
        mutationId: masteryMutationId,
        updatedAt: eventTime,
        serverUpdatedAt: FieldValue.serverTimestamp(),
        payload: masteryPayload,
      });

      if (!correct) {
        const promptOptions = Array.isArray(promptSnapshot.data()?.options)
          ? promptSnapshot.data()?.options as Array<Record<string, unknown>>
          : [];
        const mistakePayload = {
          id: mistakeId,
          userId: principal.uid,
          attemptId: input.idempotencyKey,
          questionId: input.questionId,
          topicId: promptSnapshot.data()?.topicId,
          subject: promptSnapshot.data()?.subject,
          selectedAnswer: input.selectedAnswer,
          correctAnswer: solution.correctAnswer,
          errorType: input.errorType ?? null,
          firstSeenAt: input.answeredAt,
          lastSeenAt: input.answeredAt,
          repeatedAttempts: 1,
          nextReviewAt: new Date(Date.parse(input.answeredAt) + 86_400_000).toISOString(),
          resolved: false,
          question: promptSnapshot.data()?.question,
          userAnswerText: promptOptions.find((item) => item.id === input.selectedAnswer)?.text ?? input.selectedAnswer,
          correctAnswerText: promptOptions.find((item) => item.id === solution.correctAnswer)?.text ?? solution.correctAnswer,
          reason: solution.explanation,
          solution: solution.shortSolution,
          topic: promptSnapshot.data()?.module,
          version: 1,
          createdAt: eventTime,
          updatedAt: eventTime,
        };
        transaction.set(mistakeRef, {
          entityType: "mistake",
          entityId: mistakeId,
          ownerId: principal.uid,
          operation: "upsert",
          version: 1,
          mutationId: input.idempotencyKey,
          updatedAt: eventTime,
          serverUpdatedAt: FieldValue.serverTimestamp(),
          payload: mistakePayload,
        });
      }
      return { created: true, payload };
    });

    const recordUpdatedAt =
      typeof outcome.payload?.updatedAt === "string"
        ? outcome.payload.updatedAt
        : eventTime;
    return {
      created: outcome.created,
      record: jsonSafe({
        entityType: "attempt",
        entityId: input.idempotencyKey,
        ownerId: principal.uid,
        operation: "upsert",
        version: 1,
        updatedAt: recordUpdatedAt,
        mutationId: input.idempotencyKey,
        payload: outcome.payload,
      }),
      correct: outcome.payload?.isCorrect ?? correct,
      correctAnswer: solution.correctAnswer,
      shortSolution: solution.shortSolution,
      solution: solution.solution,
      explanation: solution.explanation,
      commonMistakes: solution.commonMistakes,
    };
  },
);

export const classifyMistake = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(ClassifyMistakeSchema, request.data);
    await enforceRateLimit("classifyMistake", principal.uid, 600, 60 * 60);

    const mistakeId = createHash("sha256")
      .update(`${input.questionId}:${input.attemptId}`)
      .digest("hex");
    const mistakeRef = db
      .collection("users")
      .doc(principal.uid)
      .collection("mistakes")
      .doc(mistakeId);
    const eventTime = new Date().toISOString();

    const record = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(mistakeRef);
      if (!snapshot.exists) {
        throw new HttpsError("not-found", "The mistake record was not found.");
      }
      const existing = snapshot.data()!;
      const payload = existing.payload as Record<string, unknown> | undefined;
      if (
        existing.ownerId !== principal.uid ||
        payload?.attemptId !== input.attemptId ||
        payload?.questionId !== input.questionId
      ) {
        throw new HttpsError("permission-denied", "The mistake record does not belong to this attempt.");
      }
      const version = Number(existing.version ?? 1) + 1;
      const nextPayload = {
        ...payload,
        errorType: input.errorType,
        version,
        updatedAt: eventTime,
      };
      const mutationId = createHash("sha256")
        .update(`${principal.uid}:${input.attemptId}:${version}:${input.errorType}`)
        .digest("hex");
      transaction.update(mistakeRef, {
        version,
        updatedAt: eventTime,
        mutationId,
        serverUpdatedAt: FieldValue.serverTimestamp(),
        payload: nextPayload,
      });
      return {
        entityType: "mistake",
        entityId: mistakeId,
        ownerId: principal.uid,
        operation: "upsert",
        version,
        updatedAt: eventTime,
        mutationId,
        payload: nextPayload,
      };
    });

    return { record: jsonSafe(record) };
  },
);

export const finalizeDiagnostic = onCall(
  standardCallableOptions,
  async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(FinalizeDiagnosticSchema, request.data);
    await enforceRateLimit("finalizeDiagnostic", principal.uid, 20, 60 * 60);
    const userRef = db.collection("users").doc(principal.uid);
    const attemptRefs = input.attemptIds.map((id) => userRef.collection("attempts").doc(id));
    const snapshots = await db.getAll(...attemptRefs);
    const attempts = snapshots.map((snapshot) => snapshot.data()?.payload as Record<string, unknown> | undefined);
    if (attempts.some((attempt) => !attempt)) {
      throw new HttpsError("failed-precondition", "Every diagnostic answer must be graded before finalization.");
    }
    const verified = attempts as Record<string, unknown>[];
    if (verified.some((attempt) => attempt.userId !== principal.uid || attempt.subject !== input.subject || attempt.mode !== "diagnostic")) {
      throw new HttpsError("permission-denied", "The supplied attempts do not belong to this diagnostic.");
    }

    const topics = new Map<string, { correct: number; total: number }>();
    for (const attempt of verified) {
      const topicId = String(attempt.topicId);
      const row = topics.get(topicId) ?? { correct: 0, total: 0 };
      row.total += 1;
      if (attempt.isCorrect === true) row.correct += 1;
      topics.set(topicId, row);
    }
    const correct = verified.filter((attempt) => attempt.isCorrect === true).length;
    const topicBaseline = [...topics.entries()].map(([topicId, row]) => {
      const score = Math.round((row.correct / row.total) * 100);
      return {
        topicId,
        ...row,
        score,
        status: score >= 75 ? "strong" : score >= 50 ? "developing" : "weak",
      };
    }).sort((left, right) => left.score - right.score);
    const eventTime = new Date().toISOString();
    const diagnosticId = createHash("sha256").update(`${principal.uid}:${input.sessionId}`).digest("hex");
    const payload = {
      id: diagnosticId,
      userId: principal.uid,
      sessionId: input.sessionId,
      subject: input.subject,
      correct,
      answered: verified.length,
      score: Math.round((correct / verified.length) * 100),
      topics: topicBaseline,
      attemptIds: input.attemptIds,
      completedAt: eventTime,
      version: 1,
      createdAt: eventTime,
      updatedAt: eventTime,
    };
    await userRef.collection("diagnostics").doc(diagnosticId).set({
      entityType: "diagnostic",
      entityId: diagnosticId,
      ownerId: principal.uid,
      operation: "upsert",
      version: 1,
      mutationId: diagnosticId,
      updatedAt: eventTime,
      serverUpdatedAt: FieldValue.serverTimestamp(),
      payload,
    });
    await auditWithoutBreakingRequest(principal.uid, "diagnostic.completed", {
      diagnosticId,
      subject: input.subject,
      answered: verified.length,
    });
    return { baseline: payload };
  },
);

export const resetMyProgress = onCall(
  {
    ...sensitiveCallableOptions,
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const principal = requireAuth(request);
    parseInput(ResetMyProgressSchema, request.data);
    await enforceRateLimit("resetMyProgress", principal.uid, 3, 60 * 60);

    const lockRef = db.collection("_resetLocks").doc(principal.uid);
    await lockRef.set({
      uid: principal.uid,
      startedAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 10 * 60 * 1_000),
    });

    try {
      const userRef = db.collection("users").doc(principal.uid);
      for (let index = 0; index < USER_PROGRESS_COLLECTIONS.length; index += 3) {
        const group = USER_PROGRESS_COLLECTIONS.slice(index, index + 3);
        await Promise.all(
          group.map((collectionName) =>
            db.recursiveDelete(userRef.collection(collectionName)),
          ),
        );
      }
    } finally {
      await lockRef.delete();
    }

    await auditWithoutBreakingRequest(principal.uid, "progress.reset", {
      collections: [...USER_PROGRESS_COLLECTIONS],
    });
    return {
      reset: true,
      preserved: ["Firebase Auth account", `users/${principal.uid}`],
    };
  },
);

/** How recently the caller must have signed in for account deletion to proceed. */
const REAUTHENTICATION_WINDOW_SECONDS = 5 * 60;

/**
 * Deletes the caller's own account: their study data, their profile, their
 * uploaded files and their Firebase Auth user.
 *
 * Three things guard it. The caller types the word DELETE, so a stray click
 * cannot do this. The sign-in must be recent, checked from `auth_time` in the
 * verified token rather than from anything the client says — a session left
 * open on a shared machine cannot delete the account. And the Auth user is
 * removed last, so a failure part-way leaves an account that can sign in and
 * try again rather than orphaned data with no owner.
 */
export const deleteMyAccount = onCall(
  {
    ...sensitiveCallableOptions,
    timeoutSeconds: 540,
    memory: "512MiB",
    maxInstances: 5,
  },
  async (request) => {
    const principal = requireAuth(request);
    parseInput(DeleteMyAccountSchema, request.data);
    await enforceRateLimit("deleteMyAccount", principal.uid, 5, 60 * 60);

    const authTime = principal.token.auth_time;
    const signedInAt = typeof authTime === "number" ? authTime : 0;
    const secondsSinceSignIn = Math.floor(Date.now() / 1_000) - signedInAt;
    if (signedInAt === 0 || secondsSinceSignIn > REAUTHENTICATION_WINDOW_SECONDS) {
      throw new HttpsError(
        "failed-precondition",
        "Sign in again to confirm it is you, then delete the account.",
        { code: "reauthentication-required", windowSeconds: REAUTHENTICATION_WINDOW_SECONDS },
      );
    }

    const userRef = db.collection("users").doc(principal.uid);
    for (let index = 0; index < USER_PROGRESS_COLLECTIONS.length; index += 3) {
      const group = USER_PROGRESS_COLLECTIONS.slice(index, index + 3);
      await Promise.all(
        group.map((collectionName) => db.recursiveDelete(userRef.collection(collectionName))),
      );
    }
    // recursiveDelete on the document removes the profile and any subcollection
    // added since this list was written, so nothing is left behind by omission.
    await db.recursiveDelete(userRef);

    let filesDeleted = 0;
    try {
      const [files] = await getStorage()
        .bucket()
        .getFiles({ prefix: `users/${principal.uid}/` });
      await Promise.all(files.map((file) => file.delete()));
      filesDeleted = files.length;
    } catch (cause) {
      // A storage failure must not leave the account half-deleted with no way
      // to retry, so it is recorded and the deletion continues.
      logger.warn("account deletion: storage cleanup failed", { uid: principal.uid, cause: String(cause) });
    }

    // Counts and the uid only: nothing a learner wrote reaches the audit trail.
    await auditWithoutBreakingRequest(principal.uid, "account.deleted", {
      collections: USER_PROGRESS_COLLECTIONS.length,
      filesDeleted,
    });

    // Last, and after the data: an account that can still sign in can retry.
    await auth.deleteUser(principal.uid);

    return { deleted: true, filesDeleted };
  },
);
