import { describe, expect, it } from 'vitest';
import { GradeQuestionModeSchema, GradeQuestionSchema } from '../../../functions/src/schemas';
import { GradeablePracticeModeSchema } from '@/domain';

const gradeInput = {
  questionId: 'question-1',
  selectedAnswer: 'option-a',
  deviceId: 'device-1',
  confidence: 'sure' as const,
  hintUsed: false,
  englishComprehension: 1,
  startedAt: '2026-09-01T10:00:00.000Z',
  answeredAt: '2026-09-01T10:01:00.000Z',
  elapsedMs: 60_000,
  idempotencyKey: 'attempt-1',
};

describe('ordinary grading mode contract', () => {
  it.each([
    'learn',
    'practice',
    'timed',
    'weak-topics',
    'mistakes',
    'random',
    'diagnostic',
  ] as const)('keeps %s available on both client and server', (mode) => {
    expect(GradeablePracticeModeSchema.safeParse(mode).success).toBe(true);
    expect(GradeQuestionModeSchema.safeParse(mode).success).toBe(true);
    expect(GradeQuestionSchema.safeParse({ ...gradeInput, mode }).success).toBe(true);
  });

  it('rejects mock before the callable can read a private solution', () => {
    expect(GradeablePracticeModeSchema.safeParse('mock').success).toBe(false);
    expect(GradeQuestionModeSchema.safeParse('mock').success).toBe(false);
    expect(GradeQuestionSchema.safeParse({ ...gradeInput, mode: 'mock' }).success).toBe(false);
  });
});
