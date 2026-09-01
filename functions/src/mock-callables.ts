/**
 * Server-authoritative mock exam lifecycle.
 *
 * Rules of this module:
 * - the browser never receives `questionSolutions` data while an attempt is open;
 * - the browser never supplies timing, status, score or correctness;
 * - the exam order is snapshotted at start, so editing the template mid-attempt
 *   cannot change what a running attempt is graded against;
 * - every mutation is idempotent, so a retried call cannot double-apply.
 */
import { createHash } from "node:crypto";

import { FieldValue } from "firebase-admin/firestore";
import type {
  DocumentReference,
  DocumentSnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceRateLimit, parseInput, requireAuth } from "./callable";
import {
  applyAnswer,
  gradeMockAttempt,
  isExpired,
  remainingSeconds,
  toPromptOnlyQuestion,
  type GradedQuestionMeta,
  type MockGradeResult,
  type PromptOnlyQuestion,
  type StoredAnswer,
} from "./mock-engine";
import { db } from "./platform";
import {
  ResumeMockExamSchema,
  ReviewMockExamSchema,
  SaveMockAnswerSchema,
  StartMockExamSchema,
  SubmitMockExamSchema,
} from "./schemas";

const standardCallableOptions = {
  enforceAppCheck: true,
  cors: true,
} as const;

const MAX_OPEN_ATTEMPT_SCAN = 10;

type AttemptPayload = {
  id: string;
  userId: string;
  deviceId: string;
  mockExamId: string;
  subject: "mathematics" | "physics";
  status: "in-progress" | "submitted" | "abandoned";
  answers: StoredAnswer[];
  flaggedQuestionIds: string[];
  currentQuestionIndex: number;
  remainingSeconds: number;
  startedAt: string;
  submittedAt: string | null;
  result: MockGradeResult | null;
  questionIds: string[];
  durationSeconds: number;
  version: number;
  createdAt: string;
  updatedAt: string;
};

function attemptCollection(uid: string) {
  return db.collection("users").doc(uid).collection("examAttempts");
}

function envelope(uid: string, payload: AttemptPayload, mutationId: string) {
  return {
    entityType: "mock-attempt",
    entityId: payload.id,
    ownerId: uid,
    operation: "upsert",
    version: payload.version,
    mutationId,
    updatedAt: payload.updatedAt,
    serverUpdatedAt: FieldValue.serverTimestamp(),
    payload,
  };
}

function readAttemptPayload(
  snapshot: DocumentSnapshot,
  uid: string,
): AttemptPayload {
  const data = snapshot.data();
  const payload = data?.payload as AttemptPayload | undefined;
  if (!snapshot.exists || !payload || data?.ownerId !== uid || payload.userId !== uid) {
    throw new HttpsError("not-found", "Mock attempt was not found.");
  }
  if (!Array.isArray(payload.questionIds) || payload.questionIds.length === 0) {
    throw new HttpsError(
      "failed-precondition",
      "This attempt was not created by the trusted mock engine and cannot be graded on the server.",
    );
  }
  return payload;
}

/**
 * The exam window is derived from the server-recorded start, never from a
 * client clock, so pausing, reloading or changing the device clock cannot buy
 * extra time.
 */
function clockFor(payload: AttemptPayload, nowMs: number) {
  return {
    startedAtMs: Date.parse(payload.startedAt),
    durationSeconds: payload.durationSeconds,
    nowMs,
  };
}

async function loadPrompts(questionIds: string[]): Promise<PromptOnlyQuestion[]> {
  if (questionIds.length === 0) return [];
  const refs = questionIds.map((id) => db.collection("questions").doc(id));
  const snapshots = await db.getAll(...refs);
  const prompts: PromptOnlyQuestion[] = [];
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    if (!snapshot.exists || !data || data.status !== "published") continue;
    prompts.push(toPromptOnlyQuestion(snapshot.id, data));
  }
  return prompts;
}

/** What the browser is allowed to know about an open attempt. */
function openAttemptView(payload: AttemptPayload, prompts: PromptOnlyQuestion[], nowMs: number) {
  return {
    attemptId: payload.id,
    mockExamId: payload.mockExamId,
    subject: payload.subject,
    status: payload.status,
    startedAt: payload.startedAt,
    durationSeconds: payload.durationSeconds,
    remainingSeconds: remainingSeconds(clockFor(payload, nowMs)),
    currentQuestionIndex: payload.currentQuestionIndex,
    flaggedQuestionIds: payload.flaggedQuestionIds,
    answers: payload.answers.map((answer) => ({
      questionId: answer.questionId,
      selectedAnswer: answer.selectedAnswer,
    })),
    questions: prompts,
  };
}

async function readCorrectAnswers(
  questionIds: string[],
): Promise<Record<string, string>> {
  if (questionIds.length === 0) return {};
  const refs = questionIds.map((id) => db.collection("questionSolutions").doc(id));
  const snapshots = await db.getAll(...refs);
  const correctAnswers: Record<string, string> = {};
  for (const snapshot of snapshots) {
    const data = snapshot.data();
    if (!snapshot.exists || !data || data.status !== "published") continue;
    if (typeof data.correctAnswer === "string" && data.correctAnswer.length > 0) {
      correctAnswers[snapshot.id] = data.correctAnswer;
    }
  }
  return correctAnswers;
}

async function readQuestionMeta(
  questionIds: string[],
): Promise<Record<string, GradedQuestionMeta>> {
  const prompts = await loadPrompts(questionIds);
  const meta: Record<string, GradedQuestionMeta> = {};
  for (const prompt of prompts) {
    meta[prompt.id] = { topicId: prompt.topicId };
  }
  return meta;
}

/**
 * Grades and closes an attempt. The read of the private solutions happens
 * outside the transaction because solutions are immutable published content;
 * the status transition itself is transactional, so two concurrent submissions
 * cannot both write a result.
 */
async function finalizeAttempt(
  uid: string,
  attemptRef: DocumentReference,
  payload: AttemptPayload,
  mutationId: string,
): Promise<{ payload: AttemptPayload; alreadySubmitted: boolean }> {
  const [correctAnswers, questionMeta] = await Promise.all([
    readCorrectAnswers(payload.questionIds),
    readQuestionMeta(payload.questionIds),
  ]);

  const graded = gradeMockAttempt({
    questionIds: payload.questionIds,
    answers: payload.answers,
    correctAnswers,
    questionMeta,
  });

  return db.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(attemptRef);
    const current = readAttemptPayload(snapshot, uid);

    if (current.status === "submitted") {
      return { payload: current, alreadySubmitted: true };
    }
    if (current.status === "abandoned") {
      throw new HttpsError("failed-precondition", "This attempt was abandoned.");
    }

    const submittedAt = new Date().toISOString();
    const next: AttemptPayload = {
      ...current,
      status: "submitted",
      submittedAt,
      result: graded,
      remainingSeconds: 0,
      version: current.version + 1,
      updatedAt: submittedAt,
    };
    transaction.set(attemptRef, envelope(uid, next, mutationId));
    return { payload: next, alreadySubmitted: false };
  });
}

async function findOpenAttempt(uid: string, mockExamId: string) {
  const snapshot = await attemptCollection(uid)
    .where("payload.status", "==", "in-progress")
    .limit(MAX_OPEN_ATTEMPT_SCAN)
    .get();
  return snapshot.docs.find((doc) => doc.data()?.payload?.mockExamId === mockExamId);
}

export const startMockExam = onCall(standardCallableOptions, async (request) => {
  const principal = requireAuth(request);
  const input = parseInput(StartMockExamSchema, request.data);
  await enforceRateLimit("startMockExam", principal.uid, 20, 60 * 60);

  const templateSnapshot = await db
    .collection("examTemplates")
    .doc(input.mockExamId)
    .get();
  const template = templateSnapshot.data();
  if (!templateSnapshot.exists || !template || template.status !== "published") {
    throw new HttpsError("not-found", "Published mock exam was not found.");
  }

  const questionIds = Array.isArray(template.questionIds)
    ? template.questionIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const questionCount = Number(template.questionCount ?? 0);
  const durationMinutes = Number(template.durationMinutes ?? 0);
  if (
    questionIds.length === 0 ||
    questionIds.length !== questionCount ||
    new Set(questionIds).size !== questionIds.length ||
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0
  ) {
    throw new HttpsError(
      "failed-precondition",
      "This mock exam blueprint is incomplete and cannot be started.",
    );
  }

  const prompts = await loadPrompts(questionIds);
  if (prompts.length !== questionIds.length) {
    throw new HttpsError(
      "failed-precondition",
      "This mock exam references questions that are not published.",
    );
  }

  const nowMs = Date.now();
  const durationSeconds = durationMinutes * 60;

  const openAttempt = await findOpenAttempt(principal.uid, input.mockExamId);
  if (openAttempt) {
    const existing = readAttemptPayload(openAttempt, principal.uid);
    if (!isExpired(clockFor(existing, nowMs))) {
      const existingPrompts = await loadPrompts(existing.questionIds);
      return { resumed: true, attempt: openAttemptView(existing, existingPrompts, nowMs) };
    }
    // The window elapsed while the attempt was open: the server closes it on the
    // answers it actually received before a new attempt may begin.
    await finalizeAttempt(
      principal.uid,
      openAttempt.ref,
      existing,
      createHash("sha256").update(`${existing.id}:expired`).digest("hex"),
    );
  }

  const startedAt = new Date(nowMs).toISOString();
  const attemptRef = attemptCollection(principal.uid).doc();
  const payload: AttemptPayload = {
    id: attemptRef.id,
    userId: principal.uid,
    deviceId: input.deviceId,
    mockExamId: input.mockExamId,
    subject: template.subject === "mathematics" ? "mathematics" : "physics",
    status: "in-progress",
    answers: [],
    flaggedQuestionIds: [],
    currentQuestionIndex: 0,
    remainingSeconds: durationSeconds,
    startedAt,
    submittedAt: null,
    result: null,
    questionIds,
    durationSeconds,
    version: 1,
    createdAt: startedAt,
    updatedAt: startedAt,
  };

  await attemptRef.set(envelope(principal.uid, payload, attemptRef.id));
  return { resumed: false, attempt: openAttemptView(payload, prompts, nowMs) };
});

export const resumeMockExam = onCall(standardCallableOptions, async (request) => {
  const principal = requireAuth(request);
  const input = parseInput(ResumeMockExamSchema, request.data);
  await enforceRateLimit("resumeMockExam", principal.uid, 120, 60 * 60);

  const attemptRef = attemptCollection(principal.uid).doc(input.attemptId);
  const payload = readAttemptPayload(await attemptRef.get(), principal.uid);
  const nowMs = Date.now();
  const prompts = await loadPrompts(payload.questionIds);
  return {
    attempt: openAttemptView(payload, prompts, nowMs),
    expired: payload.status === "in-progress" && isExpired(clockFor(payload, nowMs)),
  };
});

export const saveMockAnswer = onCall(standardCallableOptions, async (request) => {
  const principal = requireAuth(request);
  const input = parseInput(SaveMockAnswerSchema, request.data);
  await enforceRateLimit("saveMockAnswer", principal.uid, 1_200, 60 * 60);

  const attemptRef = attemptCollection(principal.uid).doc(input.attemptId);
  const preview = readAttemptPayload(await attemptRef.get(), principal.uid);
  if (preview.status !== "in-progress") {
    throw new HttpsError("failed-precondition", "This attempt is no longer open.");
  }
  if (!preview.questionIds.includes(input.questionId)) {
    throw new HttpsError("invalid-argument", "That question is not part of this attempt.");
  }

  // A selection is checked against the public prompt only. The solutions
  // collection is never read on this path.
  if (input.selectedAnswer !== null) {
    const questionSnapshot = await db.collection("questions").doc(input.questionId).get();
    const question = questionSnapshot.data();
    const options = Array.isArray(question?.options) ? question.options : [];
    const optionExists = options.some(
      (option: unknown) =>
        option !== null &&
        typeof option === "object" &&
        (option as Record<string, unknown>).id === input.selectedAnswer,
    );
    if (!questionSnapshot.exists || question?.status !== "published" || !optionExists) {
      throw new HttpsError("invalid-argument", "Selected answer is not an option of that question.");
    }
  }

  const answerRef = attemptRef.collection("answers").doc(input.questionId);

  return db.runTransaction(async (transaction: Transaction) => {
    const [attemptSnapshot, answerSnapshot] = await Promise.all([
      transaction.get(attemptRef),
      transaction.get(answerRef),
    ]);
    const current = readAttemptPayload(attemptSnapshot, principal.uid);
    const nowMs = Date.now();

    if (current.status !== "in-progress") {
      throw new HttpsError("failed-precondition", "This attempt is no longer open.");
    }
    if (isExpired(clockFor(current, nowMs))) {
      throw new HttpsError(
        "deadline-exceeded",
        "The exam time has ended. Submit the attempt to see the result.",
      );
    }

    // A retried call carrying the same mutation id changes nothing.
    if (answerSnapshot.exists && answerSnapshot.data()?.mutationId === input.mutationId) {
      return {
        changed: false,
        answeredCount: current.answers.filter((answer) => answer.selectedAnswer !== null).length,
        remainingSeconds: remainingSeconds(clockFor(current, nowMs)),
      };
    }

    const answeredAt = new Date(nowMs).toISOString();
    const previousMs = Date.parse(current.updatedAt);
    const durationSeconds = Number.isFinite(previousMs)
      ? Math.max(0, Math.round((nowMs - previousMs) / 1_000))
      : 0;
    const nextAnswer: StoredAnswer = {
      questionId: input.questionId,
      selectedAnswer: input.selectedAnswer,
      answeredAt: input.selectedAnswer === null ? null : answeredAt,
      durationSeconds,
    };
    const { answers } = applyAnswer(current.answers, nextAnswer);

    const flagged = input.flaggedQuestionIds
      ? input.flaggedQuestionIds.filter((id) => current.questionIds.includes(id))
      : current.flaggedQuestionIds;
    const index =
      input.currentQuestionIndex !== undefined &&
      input.currentQuestionIndex < current.questionIds.length
        ? input.currentQuestionIndex
        : current.currentQuestionIndex;

    const next: AttemptPayload = {
      ...current,
      answers,
      flaggedQuestionIds: flagged,
      currentQuestionIndex: index,
      remainingSeconds: remainingSeconds(clockFor(current, nowMs)),
      version: current.version + 1,
      updatedAt: answeredAt,
    };

    transaction.set(attemptRef, envelope(principal.uid, next, input.mutationId));
    transaction.set(answerRef, {
      entityType: "mock-answer",
      entityId: input.questionId,
      ownerId: principal.uid,
      operation: "upsert",
      version: (answerSnapshot.data()?.version ?? 0) + 1,
      mutationId: input.mutationId,
      updatedAt: answeredAt,
      serverUpdatedAt: FieldValue.serverTimestamp(),
      payload: nextAnswer,
    });

    return {
      changed: true,
      answeredCount: answers.filter((answer) => answer.selectedAnswer !== null).length,
      remainingSeconds: next.remainingSeconds,
    };
  });
});

export const submitMockExam = onCall(standardCallableOptions, async (request) => {
  const principal = requireAuth(request);
  const input = parseInput(SubmitMockExamSchema, request.data);
  await enforceRateLimit("submitMockExam", principal.uid, 40, 60 * 60);

  const attemptRef = attemptCollection(principal.uid).doc(input.attemptId);
  const payload = readAttemptPayload(await attemptRef.get(), principal.uid);
  const outcome = await finalizeAttempt(principal.uid, attemptRef, payload, input.mutationId);

  return {
    alreadySubmitted: outcome.alreadySubmitted,
    status: outcome.payload.status,
    submittedAt: outcome.payload.submittedAt,
    result: outcome.payload.result,
  };
});

/**
 * Detailed solutions become readable only after the attempt is finalized.
 */
export const reviewMockExam = onCall(standardCallableOptions, async (request) => {
  const principal = requireAuth(request);
  const input = parseInput(ReviewMockExamSchema, request.data);
  await enforceRateLimit("reviewMockExam", principal.uid, 120, 60 * 60);

  const attemptRef = attemptCollection(principal.uid).doc(input.attemptId);
  const payload = readAttemptPayload(await attemptRef.get(), principal.uid);
  if (payload.status !== "submitted") {
    throw new HttpsError(
      "failed-precondition",
      "Solutions become available after the attempt is submitted.",
    );
  }

  const [prompts, solutionSnapshots] = await Promise.all([
    loadPrompts(payload.questionIds),
    db.getAll(
      ...payload.questionIds.map((id) => db.collection("questionSolutions").doc(id)),
    ),
  ]);
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const solutionById = new Map(
    solutionSnapshots
      .filter((snapshot) => snapshot.exists && snapshot.data()?.status === "published")
      .map((snapshot) => [snapshot.id, snapshot.data()!]),
  );
  const answerByQuestion = new Map(
    payload.answers.map((answer) => [answer.questionId, answer]),
  );

  const questions = payload.questionIds.map((questionId) => {
    const solution = solutionById.get(questionId);
    const answer = answerByQuestion.get(questionId) ?? null;
    return {
      questionId,
      prompt: promptById.get(questionId) ?? null,
      selectedAnswer: answer?.selectedAnswer ?? null,
      durationSeconds: answer?.durationSeconds ?? 0,
      correctAnswer: solution?.correctAnswer ?? null,
      isCorrect:
        answer?.selectedAnswer != null &&
        solution?.correctAnswer != null &&
        answer.selectedAnswer === solution.correctAnswer,
      shortSolution: solution?.shortSolution ?? null,
      solution: solution?.solution ?? null,
      explanation: solution?.explanation ?? null,
      commonMistakes: solution?.commonMistakes ?? [],
    };
  });

  return {
    attemptId: payload.id,
    subject: payload.subject,
    submittedAt: payload.submittedAt,
    result: payload.result,
    questions,
  };
});
