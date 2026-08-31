import { z } from 'zod';
import type { ErrorType, Question } from '@/domain';

const MistakeEntrySchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  question: z.string().min(1),
  userAnswer: z.string(),
  correctAnswer: z.string(),
  reason: z.string(),
  solution: z.string(),
  topic: z.string(),
  mistakeType: z.string(),
  date: z.string(),
  repeatedAttempts: z.number().int().nonnegative(),
  nextReview: z.string(),
}).strict();
const MistakeListSchema = z.array(MistakeEntrySchema).max(500);
export type MistakeEntry = z.infer<typeof MistakeEntrySchema>;
const keyFor = (ownerId: string) => `csca-mistakes-ui-v1:${ownerId}`;

export function readMistakes(ownerId: string): MistakeEntry[] {
  try {
    const raw = localStorage.getItem(keyFor(ownerId));
    if (!raw) return [];
    const parsed = MistakeListSchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success ? parsed.data : [];
  } catch { return []; }
}

export function saveMistake(ownerId: string, question: Question, selectedAnswer: string | null, errorType: ErrorType) {
  const current = readMistakes(ownerId);
  const existing = current.find((item) => item.questionId === question.id);
  const selectedText = question.options.find((item) => item.id === selectedAnswer)?.text ?? 'Skipped';
  const correctText = question.options.find((item) => item.id === question.correctAnswer)?.text ?? question.correctAnswer;
  const now = new Date();
  const nextReview = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const entry: MistakeEntry = {
    id: existing?.id ?? `mistake-${question.id}`,
    questionId: question.id,
    question: question.question,
    userAnswer: selectedText,
    correctAnswer: correctText,
    reason: question.explanation,
    solution: question.shortSolution,
    topic: question.module,
    mistakeType: errorType,
    date: now.toISOString(),
    repeatedAttempts: (existing?.repeatedAttempts ?? 0) + 1,
    nextReview,
  };
  const next = [entry, ...current.filter((item) => item.questionId !== question.id)].slice(0, 500);
  localStorage.setItem(keyFor(ownerId), JSON.stringify(next));
}

export function clearMistake(ownerId: string, id: string) {
  localStorage.setItem(keyFor(ownerId), JSON.stringify(readMistakes(ownerId).filter((item) => item.id !== id)));
}
