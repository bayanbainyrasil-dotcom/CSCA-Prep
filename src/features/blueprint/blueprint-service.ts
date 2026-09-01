import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { functions } from '@/lib/firebase';

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

export async function setContentVerification(input: {
  target: 'blueprint-cell' | 'question';
  targetId: string;
  verificationStatus: 'demo' | 'draft' | 'unverified' | 'author-checked' | 'reviewer-verified';
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
    })
    .strict()
    .parse(response.data);
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
