import {
  DISTANCE_AT_CONSTANT_SPEED_TEMPLATE,
  LINEAR_EQUATION_TEMPLATE,
  NEWTON_SECOND_LAW_TEMPLATE,
  SPEED_CONVERSION_TEMPLATE,
} from '@/data/questionTemplates';
import { generateQuestion } from '@/lib/adaptive';
import type { Question } from '@/domain';

export type DiagnosticSubject = 'mathematics' | 'physics';

export function buildDiagnosticQuestions(subject: DiagnosticSubject, sessionId: string, count = 32): Question[] {
  return Array.from({ length: count }, (_, index) => {
    const options = {
      seed: `${sessionId}-${subject}-${index + 1}`,
      id: `diagnostic-${subject}-${index + 1}-${sessionId.slice(-8)}`,
      now: new Date('2025-01-01T00:00:00.000Z'),
    };
    if (subject === 'mathematics') return generateQuestion(LINEAR_EQUATION_TEMPLATE, options);
    if (index % 3 === 0) return generateQuestion(DISTANCE_AT_CONSTANT_SPEED_TEMPLATE, options);
    if (index % 3 === 1) return generateQuestion(NEWTON_SECOND_LAW_TEMPLATE, options);
    return generateQuestion(SPEED_CONVERSION_TEMPLATE, options);
  });
}

export const diagnosticRecoveryKey = (ownerId: string, subject: DiagnosticSubject) => `csca-diagnostic-recovery-v1:${ownerId}:${subject}`;
export const diagnosticResultKey = (ownerId: string, subject: DiagnosticSubject) => `csca-diagnostic-result-v1:${ownerId}:${subject}`;
