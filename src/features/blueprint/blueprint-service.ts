import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { functions } from '@/lib/firebase';
import type { BlueprintCell } from './blueprint';

/**
 * Client side of blueprint administration.
 *
 * The response schemas are `.strict()` and carry no answer keys: the coverage
 * report is aggregate only. Verification is requested here but decided on the
 * server, which stamps the reviewer and the time.
 */

const CoverageCellSchema = z
  .object({
    id: z.string(),
    subject: z.enum(['mathematics', 'physics']),
    module: z.string(),
    topicId: z.string(),
    topic: z.string(),
    skill: z.string(),
    microSkill: z.string(),
    difficultyLevels: z.array(z.number()),
    questionTypes: z.array(z.string()),
    supportedLanguages: z.array(z.string()),
    allowedExamModes: z.array(z.string()),
    minimumItems: z.number(),
    verificationStatus: z.string(),
    sourceType: z.string(),
    sourceReference: z.string(),
    reviewer: z.string().nullable(),
    reviewedAt: z.string().nullable(),
    knownLimitations: z.string(),
    totalItems: z.number(),
    verifiedItems: z.number(),
    demoItems: z.number(),
    languages: z.array(z.string()),
    missingLanguages: z.array(z.string()),
    missingDifficulties: z.array(z.number()),
    missingQuestionTypes: z.array(z.string()),
    status: z.enum(['covered', 'partial', 'unverified', 'empty']),
    reasons: z.array(z.string()),
  })
  .strict();
export type CoverageCell = z.infer<typeof CoverageCellSchema>;

const CoverageReportSchema = z
  .object({
    generatedAt: z.string(),
    totals: z.object({
      covered: z.number(),
      partial: z.number(),
      unverified: z.number(),
      empty: z.number(),
    }).strict(),
    verifiedCells: z.number(),
    issues: z.array(
      z
        .object({
          code: z.string(),
          severity: z.enum(['blocker', 'warning']),
          message: z.string(),
          cellId: z.string().optional(),
          questionId: z.string().optional(),
        })
        .strict(),
    ),
    orphanQuestionIds: z.array(z.string()),
    cells: z.array(CoverageCellSchema),
  })
  .strict();
export type CoverageReport = z.infer<typeof CoverageReportSchema>;

function requireFunctions() {
  if (!functions) throw new Error('Blueprint administration needs a configured Firebase deployment.');
  return functions;
}

export async function fetchBlueprintCoverage(input: {
  subject?: 'mathematics' | 'physics';
  mode?: 'diagnostic' | 'practice' | 'mock';
} = {}): Promise<CoverageReport> {
  const call = httpsCallable(requireFunctions(), 'getBlueprintCoverage');
  const response = await call(input);
  return CoverageReportSchema.parse(response.data);
}

/**
 * Uploads the blueprint requirement seed through the trusted callable, one cell
 * at a time so a rejected cell is reported rather than silently skipped. The
 * server writes every cell as `draft`; nothing here can certify anything.
 */
export async function seedBlueprintCells(
  cells: BlueprintCell[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ created: number; failures: { cellId: string; message: string }[] }> {
  const call = httpsCallable(requireFunctions(), 'upsertBlueprintCell');
  const failures: { cellId: string; message: string }[] = [];
  let created = 0;

  for (const [index, cell] of cells.entries()) {
    try {
      await call({
        cellId: cell.id,
        subject: cell.subject,
        module: cell.module,
        topicId: cell.topicId,
        topic: cell.topic,
        skillId: cell.skillId,
        skill: cell.skill,
        microSkillId: cell.microSkillId,
        microSkill: cell.microSkill,
        prerequisiteCellIds: cell.prerequisiteCellIds,
        difficultyLevels: cell.difficultyLevels,
        questionTypes: cell.questionTypes,
        minimumItems: cell.minimumItems,
        supportedLanguages: cell.supportedLanguages,
        allowedExamModes: cell.allowedExamModes,
        sourceType: cell.sourceType,
        sourceReference: cell.sourceReference,
        knownLimitations: cell.knownLimitations,
      });
      created += 1;
    } catch (error) {
      failures.push({ cellId: cell.id, message: error instanceof Error ? error.message : 'Rejected by the server.' });
    }
    onProgress?.(index + 1, cells.length);
  }

  return { created, failures };
}

export async function setContentVerification(input: {
  target: 'blueprint-cell' | 'question';
  targetId: string;
  verificationStatus: 'demo' | 'draft' | 'pending-review' | 'unverified' | 'author-checked' | 'reviewer-verified';
  /** The content version the reviewer actually read. */
  contentVersion: number;
  sourceReference?: string;
  note?: string;
}) {
  const call = httpsCallable(requireFunctions(), 'setContentVerification');
  const response = await call(input);
  return z
    .object({
      targetId: z.string(),
      verificationStatus: z.string(),
      reviewer: z.string().nullable(),
      reviewedAt: z.string().nullable(),
      verifiedContentVersion: z.number().nullable(),
    })
    .strict()
    .parse(response.data);
}

const ReviewItemSchema = z
  .object({
    id: z.string(),
    expectedVersion: z.number(),
    question: z
      .object({
        subject: z.string(),
        module: z.string(),
        topicId: z.string(),
        skill: z.string(),
        difficulty: z.number(),
        language: z.string(),
        question: z.string(),
        questionTranslation: z.string().optional(),
        options: z.array(z.object({ id: z.string(), text: z.string() }).loose()),
        correctAnswer: z.string(),
        solution: z.string(),
        shortSolution: z.string(),
        explanation: z.string(),
        commonMistakes: z.array(z.object({ id: z.string(), description: z.string() }).loose()).default([]),
        cellId: z.string().optional(),
        questionType: z.string().optional(),
        sourceType: z.string(),
        sourceNote: z.string().optional(),
        sourceReference: z.string().optional(),
        status: z.string(),
        demo: z.boolean().optional(),
        verificationStatus: z.string().optional(),
        reviewer: z.string().nullable().optional(),
        reviewedAt: z.string().nullable().optional(),
        verifiedContentVersion: z.number().nullable().optional(),
        templateParameters: z.record(z.string(), z.unknown()).optional(),
      })
      .loose()
      .nullable(),
  })
  .strict();
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

/**
 * The review packet: every item awaiting a human, with its full solution, its
 * blueprint mapping, its provenance and the content version a reviewer must
 * approve. Approving a different version is refused by the server.
 */
export async function fetchReviewQueue(pageSize = 100): Promise<ReviewItem[]> {
  const call = httpsCallable(requireFunctions(), 'exportQuestionBank');
  const response = await call({ pageSize });
  const parsed = z.object({ items: z.array(ReviewItemSchema), nextCursor: z.string().nullable() }).parse(response.data);
  return parsed.items.filter((item) => item.question !== null);
}

export async function publishMockExam(input: {
  mockExamId: string;
  title: string;
  subject: 'mathematics' | 'physics';
  cellIds: string[];
  questionCount: number;
  durationMinutes: number;
  instructions: string;
  language: 'en' | 'ru' | 'zh';
  seed: string;
}) {
  const call = httpsCallable(requireFunctions(), 'publishMockExam');
  const response = await call(input);
  return z
    .object({ mockExamId: z.string(), questionCount: z.number(), cellIds: z.array(z.string()) })
    .strict()
    .parse(response.data);
}

/** Reads the blockers a failed publication or mock start returned. */
export function readBlueprintBlockers(error: unknown): string[] {
  const details = (error as { details?: unknown })?.details;
  if (!details || typeof details !== 'object') return [];
  const parsed = z
    .object({ blockers: z.array(z.string()).optional(), emptyCells: z.array(z.string()).optional() })
    .safeParse(details);
  if (!parsed.success) return [];
  return [...(parsed.data.blockers ?? []), ...(parsed.data.emptyCells ?? []).map((id) => `${id}: no verified questions.`)];
}
