/**
 * What the tutor is allowed to do, and when.
 *
 * The gates here are the product rules, kept apart from the leak screening so
 * each can be read on its own. Two things they exist to prevent:
 *
 * - The tutor becoming a way to sit an exam. A diagnostic or a mock in progress
 *   refuses every action, whatever the flag says.
 * - The tutor becoming a way to read the answer early. Before the server has
 *   revealed a result, only the early actions run, and the key and the worked
 *   solution are withheld from the prompt entirely.
 *
 * The tutor never grades, never writes a score, never touches mastery, plan or
 * verification, and never writes to a content collection: it returns text, and
 * the callable that hosts it does nothing else with the reply.
 */

export type TutorAction =
  | 'practice_hint'
  | 'post_answer_explanation'
  | 'explain_step'
  | 'translate_explanation'
  | 'prerequisite_coach';

export const TUTOR_ACTIONS: TutorAction[] = [
  'practice_hint',
  'post_answer_explanation',
  'explain_step',
  'translate_explanation',
  'prerequisite_coach',
];

/** Runs while the learner is still working. Never sees the key or the solution. */
export const PRE_ANSWER_ACTIONS: TutorAction[] = ['practice_hint', 'explain_step', 'prerequisite_coach'];

/** Runs only after the server has revealed the result for this question. */
export const POST_ANSWER_ACTIONS: TutorAction[] = ['post_answer_explanation', 'translate_explanation'];

/** Exam modes in which the tutor is unavailable, whatever else is configured. */
export const EXAM_MODES_WITHOUT_TUTOR = ['diagnostic', 'mock'] as const;

export interface LearnerSession {
  /** What the learner is doing right now, as the server understands it. */
  examMode: 'none' | 'practice' | 'lesson' | 'diagnostic' | 'mock';
  /** True once the server has shown this learner the result for this question. */
  answerRevealed: boolean;
}

export interface ActionGate {
  allowed: boolean;
  reason: string | null;
  code: 'exam-in-progress' | 'answer-not-revealed' | 'unknown-action' | null;
  /** Whether the answer key may be given to a provider for this call. */
  mayUseSecrets: boolean;
}

export function gateTutorAction(action: TutorAction, session: LearnerSession): ActionGate {
  if (!TUTOR_ACTIONS.includes(action)) {
    return { allowed: false, reason: 'That is not a tutor action.', code: 'unknown-action', mayUseSecrets: false };
  }

  if ((EXAM_MODES_WITHOUT_TUTOR as readonly string[]).includes(session.examMode)) {
    return {
      allowed: false,
      reason: 'The tutor is unavailable while a diagnostic or a mock exam is in progress.',
      code: 'exam-in-progress',
      mayUseSecrets: false,
    };
  }

  if (POST_ANSWER_ACTIONS.includes(action) && !session.answerRevealed) {
    return {
      allowed: false,
      reason: 'That explanation is available once you have answered and seen the result.',
      code: 'answer-not-revealed',
      mayUseSecrets: false,
    };
  }

  // Only a post-answer action on a revealed question may reference the key: at
  // that point the learner has already been shown it by the server.
  return {
    allowed: true,
    reason: null,
    code: null,
    mayUseSecrets: POST_ANSWER_ACTIONS.includes(action) && session.answerRevealed,
  };
}

/**
 * Everything the tutor is forbidden to do, named so a test can assert the list
 * rather than a reader having to trust a comment. Nothing in `tutor/` writes to
 * any of these; the engine returns text and nothing else.
 */
export const TUTOR_FORBIDDEN_EFFECTS = [
  'grade-a-diagnostic',
  'grade-a-mock',
  'write-a-score',
  'change-mastery',
  'change-readiness',
  'change-the-study-plan',
  'set-verification',
  'publish-content',
  'write-to-the-database',
  'reveal-an-answer-early',
] as const;
