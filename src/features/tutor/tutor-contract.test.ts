import { describe, expect, it } from 'vitest';
import {
  buildTutorPrompt,
  decideQuota,
  isTutorEnabled,
  promptLeaksSecrets,
  screenTutorReply,
  tutorCacheKey,
  TUTOR_PROMPT_VERSION,
  type QuotaWindow,
  type TutorAsk,
  type TutorQuestionContext,
  type TutorSecrets,
} from '../../../functions/src/tutor/tutor-contract';

const CONTEXT: TutorQuestionContext = {
  questionId: 'math-linear-isolate-unknown-001',
  prompt: 'Solve 3x + 7 = 22 for x.',
  options: [
    { id: 'a', text: 'x = 5' },
    { id: 'b', text: 'x = 7' },
    { id: 'c', text: 'x = 15' },
    { id: 'd', text: 'x = 9' },
  ],
  topic: 'Linear equations',
  skill: 'Solve linear relations',
  difficulty: 2,
};

const SECRETS: TutorSecrets = {
  correctAnswerId: 'a',
  correctOptionText: 'x = 5',
  solution: 'Subtract 7 from both sides to get 3x = 15. Divide both sides by 3 to get x = 5.',
  shortSolution: 'x = 5 after subtracting 7 and dividing by 3.',
};

const ASK: TutorAsk = {
  action: 'practice_hint',
  questionId: CONTEXT.questionId,
  language: 'en',
  learnerAttempt: 'I moved the 7 across but got 3x = 29.',
};

describe('the feature flag', () => {
  it('is off when nothing is configured', () => {
    expect(isTutorEnabled({})).toBe(false);
  });

  it('is off for every value except the exact string "true"', () => {
    for (const value of ['', 'false', '1', 'yes', 'TRUE', 'True', 'on', 'enabled', ' true']) {
      expect(isTutorEnabled({ AI_TUTOR_ENABLED: value }), value).toBe(false);
    }
  });

  it('is on only when a deployment says so explicitly', () => {
    expect(isTutorEnabled({ AI_TUTOR_ENABLED: 'true' })).toBe(true);
  });
});

describe('quotas', () => {
  const now = 1_800_000_000_000;

  it('opens a fresh window for a learner who has never asked', () => {
    const decision = decideQuota(null, now);
    expect(decision.allowed).toBe(true);
    expect(decision.next.used).toBe(1);
    expect(decision.remaining).toBe(29);
  });

  it('counts within the window and refuses at the limit', () => {
    let window: QuotaWindow | null = null;
    for (let index = 0; index < 30; index += 1) {
      const decision = decideQuota(window, now);
      expect(decision.allowed, `call ${index + 1}`).toBe(true);
      window = decision.next;
    }
    const refused = decideQuota(window, now);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.reason).toContain('30');
    expect(refused.reason).toMatch(/resets in about \d+ minute/);
  });

  it('does not reset a full window by asking again inside it', () => {
    const full: QuotaWindow = { used: 30, limit: 30, windowSeconds: 3600, expiresAt: now + 600_000 };
    expect(decideQuota(full, now).allowed).toBe(false);
    expect(decideQuota(full, now).next.used).toBe(30);
  });

  it('starts a new window once the old one has expired', () => {
    const expired: QuotaWindow = { used: 30, limit: 30, windowSeconds: 3600, expiresAt: now - 1 };
    const decision = decideQuota(expired, now);
    expect(decision.allowed).toBe(true);
    expect(decision.next.used).toBe(1);
    expect(decision.next.expiresAt).toBeGreaterThan(now);
  });
});

describe('the cache key', () => {
  it('is stable for the same ask', () => {
    expect(tutorCacheKey(ASK, TUTOR_PROMPT_VERSION)).toBe(tutorCacheKey({ ...ASK }, TUTOR_PROMPT_VERSION));
  });

  it('ignores whitespace and case in the attempt, so near-identical asks share a reply', () => {
    const noisy = { ...ASK, learnerAttempt: '  I MOVED   the 7 across but got 3x = 29.  ' };
    expect(tutorCacheKey(noisy, TUTOR_PROMPT_VERSION)).toBe(tutorCacheKey(ASK, TUTOR_PROMPT_VERSION));
  });

  it('changes with the mode, the question, the language and the prompt version', () => {
    const base = tutorCacheKey(ASK, TUTOR_PROMPT_VERSION);
    expect(tutorCacheKey({ ...ASK, action: 'explain_step' as const }, TUTOR_PROMPT_VERSION)).not.toBe(base);
    expect(tutorCacheKey({ ...ASK, questionId: 'other-001' }, TUTOR_PROMPT_VERSION)).not.toBe(base);
    expect(tutorCacheKey({ ...ASK, language: 'ru' }, TUTOR_PROMPT_VERSION)).not.toBe(base);
    expect(tutorCacheKey(ASK, '2099-01-01.1')).not.toBe(base);
  });

  it('carries no learner identity, so two learners share one cached reply', () => {
    expect(tutorCacheKey(ASK, TUTOR_PROMPT_VERSION)).not.toContain('uid');
    expect(tutorCacheKey(ASK, TUTOR_PROMPT_VERSION).split(':')).toHaveLength(5);
  });
});

describe('the prompt a provider is allowed to see', () => {
  it('carries the question, the options and the learner’s own words', () => {
    const prompt = buildTutorPrompt(ASK, CONTEXT);
    expect(prompt).toContain('Solve 3x + 7 = 22 for x.');
    expect(prompt).toContain('a) x = 5');
    expect(prompt).toContain('I moved the 7 across but got 3x = 29.');
  });

  it('never carries the answer key or the worked solution, in any mode', () => {
    for (const mode of ['practice_hint', 'explain_step', 'prerequisite_coach'] as const) {
      const prompt = buildTutorPrompt({ ...ASK, action: mode }, CONTEXT);
      expect(promptLeaksSecrets(prompt, SECRETS), mode).toEqual([]);
      expect(prompt, mode).not.toContain(SECRETS.solution);
      expect(prompt, mode).not.toContain(SECRETS.shortSolution);
      expect(prompt, mode).not.toMatch(/correct(?:Answer)?(?:Id)?\s*[:=]/i);
    }
  });

  it('tells the provider not to state the answer', () => {
    expect(buildTutorPrompt(ASK, CONTEXT)).toContain('Do not state which option is correct');
    expect(buildTutorPrompt({ ...ASK, action: 'prerequisite_coach' }, CONTEXT)).toContain('do not state which option is correct');
  });

  it('detects a leak if prompt construction ever regresses', () => {
    const forged = `${buildTutorPrompt(ASK, CONTEXT)}\n\n${SECRETS.solution}`;
    expect(promptLeaksSecrets(forged, SECRETS)).toContain('solution');
  });
});

describe('screening a provider reply', () => {
  it('passes a hint that teaches the step without giving the value', () => {
    const reply = 'You subtracted on one side only. Apply the same operation to both sides and see what 3x becomes.';
    expect(screenTutorReply(reply, SECRETS)).toEqual({ safe: true, reasons: [] });
  });

  it('refuses a reply containing the correct option text', () => {
    const result = screenTutorReply('Work it through and you will find x = 5.', SECRETS);
    expect(result.safe).toBe(false);
    expect(result.reasons).toContain('reply-contains-correct-option');
  });

  it('refuses a reply that quotes the stored solution', () => {
    const result = screenTutorReply(
      `Here is how it goes. Subtract 7 from both sides to get 3x = 15. Try the rest yourself.`,
      SECRETS,
    );
    expect(result.safe).toBe(false);
    expect(result.reasons).toContain('reply-quotes-solution');
  });

  it('refuses a reply that announces an answer, in English, Russian or Chinese', () => {
    for (const reply of [
      'The correct answer is option A.',
      'Answer: a',
      'Option A is correct here.',
      'Just choose option A and move on.',
      'Правильный ответ — первый вариант.',
      '正确答案是第一个。',
    ]) {
      expect(screenTutorReply(reply, SECRETS).safe, reply).toBe(false);
    }
  });

  it('refuses a bare option letter dressed up as a reply', () => {
    for (const reply of ['a', 'A.', ' b) ', 'C']) {
      expect(screenTutorReply(reply, SECRETS).safe, reply).toBe(false);
    }
  });

  it('is not fooled by casing or extra whitespace', () => {
    expect(screenTutorReply('THE   CORRECT   ANSWER   IS   A', SECRETS).safe).toBe(false);
    expect(screenTutorReply('the value works out to X  =  5 exactly', SECRETS).safe).toBe(false);
  });

  it('does not refuse a reply that merely mentions an unrelated number', () => {
    expect(screenTutorReply('Notice that 22 - 7 is what 3x must equal. What is left to do?', SECRETS).safe).toBe(true);
  });

  it('reports every distinct reason once, so a log line is readable', () => {
    const result = screenTutorReply('The correct answer is x = 5. The correct answer is x = 5.', SECRETS);
    expect(result.reasons).toEqual([...new Set(result.reasons)]);
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });
});
