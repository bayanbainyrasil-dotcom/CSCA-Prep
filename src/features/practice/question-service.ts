import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { AttemptSchema, ErrorTypeSchema, GradeablePracticeModeSchema, type Attempt, type ErrorType, type GradeablePracticeMode } from '@/domain';
import { firestore, functions } from '@/lib/firebase';
import { getCscaDatabase, PendingGradeRecordSchema, type PendingGradeRecord } from '@/lib/persistence';

const OptionSchema = z.object({
  id: z.string().min(1).max(160),
  text: z.string().min(1).max(2_000),
});

const PublicQuestionPromptSchema = z.object({
  id: z.string().min(1).max(160),
  subject: z.enum(['mathematics', 'physics']),
  module: z.string().min(1).max(120),
  topicId: z.string().min(1).max(160),
  skill: z.string().min(1).max(160),
  difficulty: z.number().int().min(1).max(5),
  question: z.string().min(1).max(10_000),
  questionTranslation: z.string().min(1).max(10_000).optional(),
  options: z.array(OptionSchema).min(2).max(8),
  formulas: z.array(z.string().min(1).max(1_000)).max(20).default([]),
  estimatedTime: z.number().int().min(5).max(3_600),
  status: z.literal('published'),
  demo: z.boolean().default(false),
});

export type PublicQuestionPrompt = z.infer<typeof PublicQuestionPromptSchema>;

const GradeResponseSchema = z.object({
  correct: z.boolean(),
  correctAnswer: z.string().min(1),
  shortSolution: z.string().min(1),
  solution: z.string().min(1),
  explanation: z.string().min(1),
  record: z.object({ payload: AttemptSchema }),
});

export interface GradeQuestionInput {
  questionId: string;
  selectedAnswer: string;
  deviceId: string;
  confidence: Attempt['confidence'];
  hintUsed: boolean;
  englishComprehension: number;
  startedAt: string;
  answeredAt: string;
  elapsedMs: number;
  idempotencyKey: string;
  mode: GradeablePracticeMode;
}

export async function loadPublishedQuestions(count = 6): Promise<PublicQuestionPrompt[]> {
  if (!firestore) return [];
  const snapshot = await getDocs(query(
    collection(firestore, 'questions'),
    where('status', '==', 'published'),
    limit(Math.max(1, Math.min(40, count))),
  ));
  return snapshot.docs.flatMap((item) => {
    const parsed = PublicQuestionPromptSchema.safeParse({ id: item.id, ...item.data() });
    return parsed.success ? [parsed.data] : [];
  });
}

export async function gradePublishedQuestion(input: GradeQuestionInput) {
  if (!functions) throw new Error('Secure grading is unavailable. Check your connection and Firebase configuration.');
  const mode = GradeablePracticeModeSchema.parse(input.mode);
  const call = httpsCallable(functions, 'gradeQuestion');
  const response = await call({
    ...input,
    mode,
  });
  return GradeResponseSchema.parse(response.data);
}

export async function queuePublishedQuestionGrade(ownerId: string, input: GradeQuestionInput): Promise<void> {
  const record = PendingGradeRecordSchema.parse({
    ...input,
    id: input.idempotencyKey,
    ownerId,
    createdAt: new Date().toISOString(),
  });
  await getCscaDatabase().pendingGrades.put(record);
}

/** Flushes oldest-first. Successful records are removed; failures remain for the next online retry. */
export async function flushPendingQuestionGrades(ownerId: string): Promise<number> {
  if (!functions) return 0;
  const database = getCscaDatabase();
  const records = await database.pendingGrades.where('ownerId').equals(ownerId).sortBy('createdAt');
  let flushed = 0;
  for (const rawRecord of records) {
    const record: PendingGradeRecord = PendingGradeRecordSchema.parse(rawRecord);
    await gradePublishedQuestion({
      questionId: record.questionId,
      selectedAnswer: record.selectedAnswer,
      deviceId: record.deviceId,
      confidence: record.confidence,
      hintUsed: record.hintUsed,
      englishComprehension: record.englishComprehension,
      startedAt: record.startedAt,
      answeredAt: record.answeredAt,
      elapsedMs: record.elapsedMs,
      idempotencyKey: record.id,
      mode: record.mode,
    });
    await database.pendingGrades.delete(record.id);
    flushed += 1;
  }
  return flushed;
}

export async function classifyPublishedMistake(input: { attemptId: string; questionId: string; errorType: ErrorType }) {
  if (!functions) throw new Error('Mistake classification is unavailable.');
  ErrorTypeSchema.parse(input.errorType);
  const call = httpsCallable(functions, 'classifyMistake');
  await call(input);
}

export async function finalizePublishedDiagnostic(input: { sessionId: string; subject: 'mathematics' | 'physics'; attemptIds: string[] }) {
  if (!functions) throw new Error('Diagnostic finalization is unavailable.');
  const call = httpsCallable(functions, 'finalizeDiagnostic');
  await call(input);
}
