import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { z } from 'zod';
import { deploymentConfiguration } from '@/lib/deployment';
import { firestore, functions } from '@/lib/firebase';

/**
 * Client side of the server-authoritative mock exam.
 *
 * Every response schema is `.strict()`. That is deliberate: if a server change
 * ever started returning a correct answer or a solution alongside an open
 * attempt, this client would reject the payload instead of rendering it. The
 * only schema that carries answer keys is the review schema, which is reachable
 * only after submission.
 */

const MockOptionSchema = z
  .object({ id: z.string().min(1).max(160), text: z.string().min(1).max(2_000) })
  .strict();

export const MockPromptQuestionSchema = z
  .object({
    id: z.string().min(1).max(160),
    subject: z.enum(['mathematics', 'physics']),
    module: z.string().max(120),
    topicId: z.string().max(160),
    skill: z.string().max(160),
    difficulty: z.number().int().min(0).max(5),
    language: z.string().max(8),
    question: z.string().min(1).max(10_000),
    options: z.array(MockOptionSchema).min(2).max(8),
    estimatedTime: z.number().min(0).max(3_600),
  })
  .strict();
export type MockPromptQuestion = z.infer<typeof MockPromptQuestionSchema>;

export const OpenMockAttemptSchema = z
  .object({
    attemptId: z.string().min(1).max(160),
    mockExamId: z.string().min(1).max(160),
    subject: z.enum(['mathematics', 'physics']),
    status: z.enum(['in-progress', 'submitted', 'abandoned']),
    startedAt: z.string().min(20).max(40),
    durationSeconds: z.number().int().min(1).max(14_400),
    remainingSeconds: z.number().int().min(0).max(14_400),
    currentQuestionIndex: z.number().int().min(0).max(99),
    flaggedQuestionIds: z.array(z.string().min(1).max(160)).max(100),
    answers: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(160),
            selectedAnswer: z.string().min(1).max(160).nullable(),
          })
          .strict(),
      )
      .max(100),
    questions: z.array(MockPromptQuestionSchema).min(1).max(100),
  })
  .strict();
export type OpenMockAttempt = z.infer<typeof OpenMockAttemptSchema>;

export const MockGradeResultSchema = z
  .object({
    correct: z.number().int().min(0),
    wrong: z.number().int().min(0),
    skipped: z.number().int().min(0),
    accuracy: z.number().min(0).max(1),
    averageTimeSeconds: z.number().min(0),
    topicScores: z.record(z.string(), z.number().min(0).max(1)),
  })
  .strict();
export type MockGradeResult = z.infer<typeof MockGradeResultSchema>;

const StartResponseSchema = z
  .object({ resumed: z.boolean(), attempt: OpenMockAttemptSchema })
  .strict();

const ResumeResponseSchema = z
  .object({ attempt: OpenMockAttemptSchema, expired: z.boolean() })
  .strict();

const SaveAnswerResponseSchema = z
  .object({
    changed: z.boolean(),
    answeredCount: z.number().int().min(0).max(100),
    remainingSeconds: z.number().int().min(0).max(14_400),
  })
  .strict();

const SubmitResponseSchema = z
  .object({
    alreadySubmitted: z.boolean(),
    status: z.enum(['in-progress', 'submitted', 'abandoned']),
    submittedAt: z.string().min(20).max(40).nullable(),
    result: MockGradeResultSchema.nullable(),
  })
  .strict();

export const MockReviewSchema = z
  .object({
    attemptId: z.string().min(1).max(160),
    subject: z.enum(['mathematics', 'physics']),
    submittedAt: z.string().min(20).max(40).nullable(),
    result: MockGradeResultSchema.nullable(),
    questions: z
      .array(
        z
          .object({
            questionId: z.string().min(1).max(160),
            prompt: MockPromptQuestionSchema.nullable(),
            selectedAnswer: z.string().min(1).max(160).nullable(),
            durationSeconds: z.number().min(0),
            correctAnswer: z.string().min(1).max(160).nullable(),
            isCorrect: z.boolean(),
            shortSolution: z.string().max(4_000).nullable(),
            solution: z.string().max(20_000).nullable(),
            explanation: z.string().max(20_000).nullable(),
            commonMistakes: z.array(z.unknown()).max(20),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export type MockReview = z.infer<typeof MockReviewSchema>;

export const PublishedMockExamSchema = z
  .object({
    id: z.string().min(1).max(160),
    title: z.string().min(1).max(200),
    subject: z.enum(['mathematics', 'physics']),
    questionCount: z.number().int().min(1).max(100),
    durationMinutes: z.number().int().min(1).max(240),
    instructions: z.string().min(1).max(10_000),
    demo: z.boolean().default(false),
  });
export type PublishedMockExam = z.infer<typeof PublishedMockExamSchema>;

/**
 * The trusted mock flow is available only when the build is wired to a real
 * Firebase deployment. In `local-demo` mode there is no server to own timing or
 * grading, so the built-in template mock is the only thing offered — and it is
 * labelled as a demo rather than presented as an exam score.
 */
export function isServerMockAvailable(): boolean {
  return deploymentConfiguration.mode === 'firebase' && Boolean(functions);
}

function requireFunctions() {
  if (!functions) {
    throw new Error('The trusted mock service is unavailable. Check your connection.');
  }
  return functions;
}

export async function listPublishedMockExams(subject?: 'mathematics' | 'physics'): Promise<PublishedMockExam[]> {
  if (!firestore) return [];
  const constraints = [where('status', '==', 'published'), limit(20)];
  const snapshot = await getDocs(
    subject
      ? query(collection(firestore, 'examTemplates'), where('subject', '==', subject), ...constraints)
      : query(collection(firestore, 'examTemplates'), ...constraints),
  );
  return snapshot.docs.flatMap((document) => {
    const parsed = PublishedMockExamSchema.safeParse({ id: document.id, ...document.data() });
    return parsed.success ? [parsed.data] : [];
  });
}

export async function startServerMockExam(input: { mockExamId: string; deviceId: string }) {
  const call = httpsCallable(requireFunctions(), 'startMockExam');
  const response = await call(input);
  return StartResponseSchema.parse(response.data);
}

export async function resumeServerMockExam(input: { attemptId: string }) {
  const call = httpsCallable(requireFunctions(), 'resumeMockExam');
  const response = await call(input);
  return ResumeResponseSchema.parse(response.data);
}

export async function saveServerMockAnswer(input: {
  attemptId: string;
  questionId: string;
  selectedAnswer: string | null;
  mutationId: string;
  currentQuestionIndex?: number;
  flaggedQuestionIds?: string[];
}) {
  const call = httpsCallable(requireFunctions(), 'saveMockAnswer');
  const response = await call(input);
  return SaveAnswerResponseSchema.parse(response.data);
}

export async function submitServerMockExam(input: { attemptId: string; mutationId: string }) {
  const call = httpsCallable(requireFunctions(), 'submitMockExam');
  const response = await call(input);
  return SubmitResponseSchema.parse(response.data);
}

export async function reviewServerMockExam(input: { attemptId: string }): Promise<MockReview> {
  const call = httpsCallable(requireFunctions(), 'reviewMockExam');
  const response = await call(input);
  return MockReviewSchema.parse(response.data);
}
