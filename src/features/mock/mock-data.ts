import { z } from 'zod';
import {
  DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
  LINEAR_EQUATION_TEMPLATE,
  NEWTON_SECOND_LAW_TEMPLATE,
  SPEED_CONVERSION_TEMPLATE,
} from '@/data/questionTemplates';
import { generateQuestion } from '@/lib/adaptive';
import type { Question } from '@/domain';

export type MockSubject = 'mathematics' | 'physics';

export function buildMockQuestions(subject: MockSubject): Question[] {
  return Array.from({ length: 48 }, (_, index) => {
    const options = {
      seed: `mock-${subject}-${index + 1}`,
      id: `mock-${subject}-question-${index + 1}`,
      now: new Date('2025-01-01T00:00:00.000Z'),
    };
    if (subject === 'mathematics') return generateQuestion(LINEAR_EQUATION_TEMPLATE, options);
    if (index % 3 === 0) return generateQuestion(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE, options);
    if (index % 3 === 1) return generateQuestion(NEWTON_SECOND_LAW_TEMPLATE, options);
    return generateQuestion(SPEED_CONVERSION_TEMPLATE, options);
  });
}

export const MockRecoverySchema = z.object({
  subject: z.enum(['mathematics', 'physics']),
  startedAt: z.number().int().positive(),
  currentIndex: z.number().int().min(0).max(47),
  answers: z.record(z.string(), z.string()),
  flagged: z.array(z.string()).max(48),
}).strict();
export type MockRecovery = z.infer<typeof MockRecoverySchema>;

export const MockResultSchema = z.object({
  subject: z.enum(['mathematics', 'physics']),
  correct: z.number().int().min(0).max(48),
  wrong: z.number().int().min(0).max(48),
  skipped: z.number().int().min(0).max(48),
  durationSeconds: z.number().int().min(0),
  answers: z.record(z.string(), z.string()),
  completedAt: z.number().int().positive(),
}).strict();
export type MockResult = z.infer<typeof MockResultSchema>;

export const recoveryKey = (ownerId: string, subject: MockSubject) => `csca-mock-recovery-v1:${ownerId}:${subject}`;
export const resultKey = (ownerId: string, subject: MockSubject) => `csca-mock-result-v1:${ownerId}:${subject}`;
