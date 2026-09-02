/**
 * What a learner gets when the tutor cannot answer: the flag is off, the kill
 * switch is on, the budget is spent, the provider failed, or a reply was
 * withheld.
 *
 * Every line below is human-written and fixed. Nothing here is generated, and
 * nothing here reads a question's answer key unless the server has already
 * revealed the result to this learner — in which case the stored short solution
 * is the best answer available and is verified content by definition.
 */
import { POST_ANSWER_ACTIONS, type LearnerSession, type TutorAction } from './tutor-actions';
import type { TutorQuestionContext, TutorSecrets } from './tutor-contract';

const PRE_ANSWER_FALLBACK: Record<TutorAction, string> = {
  practice_hint:
    'Write down what the question gives you and what it asks for, then name the one operation that connects them. If that step is not obvious, the skill summary for this topic is the place to start.',
  explain_step:
    'Re-read your last line and ask what changed between it and the line before. A step that cannot be named in words is usually the step that went wrong.',
  prerequisite_coach:
    'This item builds on an earlier skill. Open the topic it belongs to and work one easier item first; coming back afterwards is faster than pushing through.',
  post_answer_explanation:
    'The worked solution appears once you have answered and seen the result.',
  translate_explanation:
    'The translated explanation appears once you have answered and seen the result.',
};

export interface TutorFallback {
  text: string;
  /** Says where the words came from, so nothing implies a model wrote them. */
  source: 'verified-content' | 'fixed-guidance';
}

export function tutorFallback(
  action: TutorAction,
  session: LearnerSession,
  context: TutorQuestionContext,
  secrets: TutorSecrets | null,
): TutorFallback {
  if (POST_ANSWER_ACTIONS.includes(action) && session.answerRevealed && secrets) {
    const text = secrets.shortSolution.trim() || secrets.solution.trim();
    if (text.length > 0) return { text, source: 'verified-content' };
  }
  const guidance = PRE_ANSWER_FALLBACK[action];
  return { text: `${guidance} (${context.skill})`, source: 'fixed-guidance' };
}
