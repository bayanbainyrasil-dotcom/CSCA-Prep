/**
 * Official-outline review, server side.
 *
 * Two callables, both administrator-only and App Check enforced. Everything
 * that could be forged is stamped here rather than accepted from the caller:
 * the reviewer's identity and uid, the review time and the last-checked time.
 *
 * A review is written against a specific cell version. If the cell changed
 * between the reviewer reading it and submitting, the write is refused rather
 * than silently attaching a judgement to text nobody read.
 *
 * Recording an outline review never changes content verification. Coverage is
 * computed by `evaluateBlueprintCoverage`, which does not read this collection.
 */
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { enforceRateLimit, monitored, parseInput, requireAdmin, writeAuditLog } from "./callable";
import {
  EMPTY_OUTLINE_REVIEW,
  validateOutlineReview,
  type OutlineReviewRecord,
  type OutlineReviewStatus,
} from "./outline-engine";
import { db } from "./platform";
import { ReadOutlineReviewsSchema, RecordOutlineReviewSchema } from "./schemas";

const adminCallableOptions = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  cors: true,
} as const;

const OUTLINE_COLLECTION = "blueprintOutlineReviews";
const BLUEPRINT_COLLECTION = "blueprintCells";

function toRecord(cellId: string, data: Record<string, unknown> | undefined): OutlineReviewRecord {
  if (!data) return { cellId, ...EMPTY_OUTLINE_REVIEW };
  const asString = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
  return {
    cellId,
    status: (typeof data.status === "string" ? data.status : "unreviewed") as OutlineReviewStatus,
    sourceUrl: asString(data.sourceUrl),
    sourceTitle: asString(data.sourceTitle),
    sourceEdition: asString(data.sourceEdition),
    sourcePublishedAt: asString(data.sourcePublishedAt),
    lastCheckedAt: asString(data.lastCheckedAt),
    reviewer: asString(data.reviewer),
    reviewerUid: asString(data.reviewerUid),
    reviewedAt: asString(data.reviewedAt),
    differenceNote: typeof data.differenceNote === "string" ? data.differenceNote : "",
    ownSummary: typeof data.ownSummary === "string" ? data.ownSummary : "",
    reviewedCellVersion: typeof data.reviewedCellVersion === "number" ? data.reviewedCellVersion : null,
    version: typeof data.version === "number" ? data.version : 0,
  };
}

export const recordOutlineReview = onCall(adminCallableOptions, monitored("recordOutlineReview", async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(RecordOutlineReviewSchema, request.data);
  await enforceRateLimit("recordOutlineReview", principal.uid, 300, 60 * 60);

  const problems = validateOutlineReview(input);
  if (problems.length > 0) {
    throw new HttpsError("invalid-argument", "The review is incomplete.", { problems });
  }

  const cellRef = db.collection(BLUEPRINT_COLLECTION).doc(input.cellId);
  const reviewRef = db.collection(OUTLINE_COLLECTION).doc(input.cellId);
  const now = new Date().toISOString();

  const stored = await db.runTransaction(async (transaction) => {
    const cellSnapshot = await transaction.get(cellRef);
    if (!cellSnapshot.exists) {
      throw new HttpsError("not-found", `${input.cellId} is not a blueprint cell.`);
    }
    const cellData = cellSnapshot.data() ?? {};
    const cellVersion = typeof cellData.version === "number" ? cellData.version : 0;

    // The reviewer judged a specific version of the cell. If it moved, the
    // judgement is about text nobody read, so it is refused rather than stored.
    if (cellVersion !== input.expectedCellVersion) {
      throw new HttpsError(
        "aborted",
        `${input.cellId} changed while it was being reviewed: it is now version ${cellVersion}, not ${input.expectedCellVersion}. Re-read it and record the review again.`,
        { code: "cell-version-moved", currentVersion: cellVersion },
      );
    }

    const previousSnapshot = await transaction.get(reviewRef);
    const previous = toRecord(input.cellId, previousSnapshot.data());

    const record = {
      cellId: input.cellId,
      status: input.status,
      sourceUrl: input.sourceUrl,
      sourceTitle: input.sourceTitle,
      sourceEdition: input.sourceEdition,
      sourcePublishedAt: input.sourcePublishedAt,
      differenceNote: input.differenceNote,
      ownSummary: input.ownSummary,
      ownWordsAttested: true,
      reviewedCellVersion: cellVersion,
      // Server facts. Nothing below can be supplied by a caller.
      reviewer: principal.email ?? principal.uid,
      reviewerUid: principal.uid,
      reviewedAt: now,
      lastCheckedAt: now,
      version: previous.version + 1,
      serverUpdatedAt: FieldValue.serverTimestamp(),
    };
    transaction.set(reviewRef, record, { merge: false });
    return record;
  });

  // Status and identifiers only. The reviewer's note is their own text about a
  // document and is not duplicated into the audit trail.
  await writeAuditLog(principal.uid, "blueprint.outlineReviewed", {
    cellId: input.cellId,
    status: input.status,
    reviewedCellVersion: stored.reviewedCellVersion,
    sourcePublishedAt: input.sourcePublishedAt,
    version: stored.version,
  });

  return { cellId: input.cellId, status: stored.status, version: stored.version, reviewedCellVersion: stored.reviewedCellVersion };
}));

export const readOutlineReviews = onCall(adminCallableOptions, monitored("readOutlineReviews", async (request) => {
  const principal = requireAdmin(request);
  const input = parseInput(ReadOutlineReviewsSchema, request.data);
  await enforceRateLimit("readOutlineReviews", principal.uid, 300, 60 * 60);

  const [cellSnapshot, reviewSnapshot] = await Promise.all([
    db.collection(BLUEPRINT_COLLECTION).get(),
    db.collection(OUTLINE_COLLECTION).get(),
  ]);

  const reviews = new Map(reviewSnapshot.docs.map((document) => [document.id, toRecord(document.id, document.data())]));
  const cells = cellSnapshot.docs
    .map((document) => {
      const data = document.data();
      return {
        id: document.id,
        subject: typeof data.subject === "string" ? data.subject : "mathematics",
        module: typeof data.module === "string" ? data.module : "",
        topic: typeof data.topic === "string" ? data.topic : "",
        skill: typeof data.skill === "string" ? data.skill : "",
        microSkill: typeof data.microSkill === "string" ? data.microSkill : "",
        version: typeof data.version === "number" ? data.version : 0,
      };
    })
    .filter((cell) => (input.subject ? cell.subject === input.subject : true))
    .sort((left, right) => (left.id < right.id ? -1 : 1));

  return {
    cells: cells.map((cell) => ({ ...cell, review: reviews.get(cell.id) ?? { cellId: cell.id, ...EMPTY_OUTLINE_REVIEW } })),
  };
}));
