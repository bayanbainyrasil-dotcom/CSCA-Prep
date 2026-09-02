import { describe, expect, it } from 'vitest';
import type { DailyBudgetState } from '../../../functions/src/tutor/tutor-budget';
import {
  answerTutorAsk,
  TUTOR_CACHE_TTL_MS,
  type TutorCacheEntry,
  type TutorEvent,
  type TutorRuntime,
} from '../../../functions/src/tutor/tutor-engine';
import { createFakeTutorProvider } from '../../../functions/src/tutor/fake-provider';
import { TutorProviderError } from '../../../functions/src/tutor/provider';
import type { QuotaWindow, TutorAsk, TutorQuestionContext, TutorSecrets } from '../../../functions/src/tutor/tutor-contract';

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

const NOW = 1_800_000_000_000;

interface Harness {
  runtime: TutorRuntime;
  events: TutorEvent[];
  cache: Map<string, TutorCacheEntry>;
  prompts: string[];
  quota: { window: QuotaWindow | null };
  budget: { state: DailyBudgetState | null };
}

function harness(overrides: Partial<TutorRuntime> & { reply?: (prompt: string) => string; failWith?: Error } = {}): Harness {
  const events: TutorEvent[] = [];
  const cache = new Map<string, TutorCacheEntry>();
  const prompts: string[] = [];
  const quota: { window: QuotaWindow | null } = { window: null };
  const { reply, failWith, ...runtimeOverrides } = overrides;

  const budget: { state: DailyBudgetState | null } = { state: null };
  const runtime: TutorRuntime = {
    environment: { AI_TUTOR_ENABLED: 'true' },
    now: NOW,
    session: { examMode: 'practice', answerRevealed: false },
    provider: createFakeTutorProvider({
      seen: prompts,
      ...(reply ? { reply } : {}),
      ...(failWith ? { failWith } : {}),
    }),
    readQuota: () => Promise.resolve(quota.window),
    writeQuota: (window) => {
      quota.window = window;
      return Promise.resolve();
    },
    readBudget: () => Promise.resolve(budget.state),
    writeBudget: (state) => {
      budget.state = state;
      return Promise.resolve();
    },
    readCache: (key) => Promise.resolve(cache.get(key) ?? null),
    writeCache: (key, entry) => {
      cache.set(key, entry);
      return Promise.resolve();
    },
    recordEvent: (event) => {
      events.push(event);
      return Promise.resolve();
    },
    ...runtimeOverrides,
  };

  return { runtime, events, cache, prompts, quota, budget };
}

/**
 * Every refusal path returns fixed human-written guidance rather than throwing,
 * so a learner is never left with nothing. What must hold is that the provider's
 * words did not reach them and the reason is recorded.
 */
function expectNotFromProvider(reply: { text: string; source: string; withheldReason: string | null }, forbidden?: string) {
  expect(reply.source).not.toBe('provider');
  expect(reply.withheldReason).toBeTruthy();
  expect(reply.text.length).toBeGreaterThan(20);
  if (forbidden !== undefined) expect(reply.text).not.toContain(forbidden);
}

describe('the feature flag decides before anything else', () => {
  it('calls no provider when the flag is absent, and still helps the learner', async () => {
    const { runtime, prompts, events, quota } = harness({ environment: {} });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply);
    expect(reply.source).toBe('fixed-guidance');
    expect(prompts).toEqual([]);
    expect(quota.window).toBeNull();
    expect(events.map((entry) => entry.outcome)).toEqual(['disabled']);
  });

  it('calls no provider for a value that merely looks enabled', async () => {
    for (const value of ['1', 'yes', 'TRUE']) {
      const { runtime, prompts, events } = harness({ environment: { AI_TUTOR_ENABLED: value } });
      const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
      expectNotFromProvider(reply);
      expect(events.at(-1)?.outcome, value).toBe('disabled');
      expect(prompts, value).toEqual([]);
    }
  });

  it('stops everything when the kill switch is on, even with the flag on', async () => {
    const { runtime, prompts, events } = harness({
      environment: { AI_TUTOR_ENABLED: 'true', AI_TUTOR_KILL_SWITCH: 'true' },
    });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply);
    expect(prompts).toEqual([]);
    expect(events.at(-1)?.outcome).toBe('killed');
  });
});

describe('a normal ask', () => {
  it('answers, caches the reply and spends one of the quota', async () => {
    const { runtime, cache, quota, events } = harness();

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(reply.cached).toBe(false);
    expect(reply.withheldReason).toBeNull();
    expect(reply.text.length).toBeGreaterThan(20);
    expect(cache.size).toBe(1);
    expect(quota.window?.used).toBe(1);
    expect(events.at(-1)?.outcome).toBe('answered');
  });

  it('gives the provider a prompt with no answer key in it', async () => {
    const { runtime, prompts } = harness();

    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]).not.toContain(SECRETS.solution);
    expect(prompts[0]).not.toContain(SECRETS.shortSolution);
    expect(prompts[0]).not.toContain('correctAnswer');
  });
});

describe('the cache', () => {
  it('serves the second identical ask without calling the provider or spending quota', async () => {
    const { runtime, prompts, quota } = harness();

    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    const second = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(second.cached).toBe(true);
    expect(prompts).toHaveLength(1);
    expect(quota.window?.used).toBe(1);
  });

  it('does not serve a stale entry once the prompt has had time to change', async () => {
    const { runtime, cache, prompts } = harness();
    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    for (const [key, entry] of cache) cache.set(key, { ...entry, storedAt: NOW - TUTOR_CACHE_TTL_MS - 1 });

    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(prompts).toHaveLength(2);
  });

  it('re-screens a cached reply, so a changed answer key cannot be served from the cache', async () => {
    // A reply that was safe when stored becomes a leak once the item's correct
    // option changes. The cache must not keep serving it.
    const { runtime, cache } = harness({ reply: () => 'Think about what makes 3x equal 15 here.' });
    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    expect(cache.size).toBe(1);

    const movedKey: TutorSecrets = { ...SECRETS, correctOptionText: '3x equal 15' };
    const second = await answerTutorAsk(ASK, CONTEXT, movedKey, runtime);

    expect(second.cached).toBe(false);
  });
});

describe('quotas', () => {
  it('calls no provider once the window is spent', async () => {
    const { runtime, prompts, events } = harness({
      readQuota: () => Promise.resolve({ used: 30, limit: 30, windowSeconds: 3600, expiresAt: NOW + 600_000 }),
    });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply);
    expect(prompts).toEqual([]);
    expect(events.at(-1)?.outcome).toBe('quota-exceeded');
  });

  it('calls no provider once the shared daily budget is spent', async () => {
    const { runtime, prompts, events } = harness({
      readBudget: () => Promise.resolve({ day: new Date(NOW).toISOString().slice(0, 10), requests: 2_000, tokens: 10 }),
    });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply);
    expect(prompts).toEqual([]);
    expect(events.at(-1)?.outcome).toBe('budget-exceeded');
  });

  it('records what a successful call actually used, not the reservation', async () => {
    const { runtime, budget } = harness();
    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    expect(budget.state?.requests).toBe(1);
    expect(budget.state?.tokens).toBeGreaterThan(0);
  });
});

describe('the exam gate', () => {
  for (const examMode of ['diagnostic', 'mock'] as const) {
    it(`refuses every action during a ${examMode} and calls no provider`, async () => {
      for (const action of ['practice_hint', 'explain_step', 'prerequisite_coach', 'post_answer_explanation', 'translate_explanation'] as const) {
        const { runtime, prompts, events } = harness({ session: { examMode, answerRevealed: true } });
        const reply = await answerTutorAsk({ ...ASK, action }, CONTEXT, SECRETS, runtime);
        expect(reply.source, `${examMode}/${action}`).toBe('fixed-guidance');
        expect(reply.withheldReason, `${examMode}/${action}`).toBe('exam-in-progress');
        expect(reply.text).toContain('unavailable while a diagnostic or a mock');
        expect(prompts, `${examMode}/${action}`).toEqual([]);
        expect(events.at(-1)?.outcome).toBe('action-refused');
      }
    });
  }

  it('allows the early actions during practice', async () => {
    for (const action of ['practice_hint', 'explain_step', 'prerequisite_coach'] as const) {
      const { runtime } = harness({ session: { examMode: 'practice', answerRevealed: false } });
      const reply = await answerTutorAsk({ ...ASK, action }, CONTEXT, SECRETS, runtime);
      expect(reply.source, action).toBe('provider');
    }
  });
});

describe('before the learner has answered', () => {
  it('refuses a post-answer explanation and calls no provider', async () => {
    const { runtime, prompts, events } = harness({ session: { examMode: 'practice', answerRevealed: false } });

    const reply = await answerTutorAsk({ ...ASK, action: 'post_answer_explanation' }, CONTEXT, SECRETS, runtime);

    expect(reply.withheldReason).toBe('answer-not-revealed');
    expect(reply.text).not.toContain(SECRETS.correctOptionText);
    expect(reply.text).not.toContain(SECRETS.solution);
    expect(prompts).toEqual([]);
    expect(events.at(-1)?.outcome).toBe('action-refused');
  });

  it('gives the provider no key and no solution for any early action', async () => {
    for (const action of ['practice_hint', 'explain_step', 'prerequisite_coach'] as const) {
      const { runtime, prompts } = harness({ session: { examMode: 'practice', answerRevealed: false } });
      await answerTutorAsk({ ...ASK, action }, CONTEXT, SECRETS, runtime);
      expect(prompts[0], action).not.toContain(SECRETS.solution);
      expect(prompts[0], action).not.toContain(SECRETS.shortSolution);
      expect(prompts[0], action).not.toContain('correctAnswerId');
    }
  });
});

describe('after the server has revealed the result', () => {
  it('lets a post-answer explanation name the option the learner has already seen', async () => {
    const { runtime } = harness({
      session: { examMode: 'practice', answerRevealed: true },
      reply: () => 'Option A is correct because subtracting 7 leaves 3x = 15.',
    });

    const reply = await answerTutorAsk({ ...ASK, action: 'post_answer_explanation' }, CONTEXT, SECRETS, runtime);

    expect(reply.source).toBe('provider');
    expect(reply.withheldReason).toBeNull();
  });

  it('falls back to the stored short solution when the tutor is off', async () => {
    const { runtime } = harness({ environment: {}, session: { examMode: 'practice', answerRevealed: true } });

    const reply = await answerTutorAsk({ ...ASK, action: 'post_answer_explanation' }, CONTEXT, SECRETS, runtime);

    expect(reply.source).toBe('verified-content');
    expect(reply.text).toBe(SECRETS.shortSolution);
  });
});

describe('a misbehaving provider', () => {
  it('withholds a reply that states the correct option, and says so', async () => {
    const { runtime, cache, events } = harness({ reply: () => 'Straightforward: x = 5.' });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply, SECRETS.correctOptionText);
    expect(reply.withheldReason).toContain('reply-contains-correct-option');
    // A withheld reply is never cached: nothing should serve it later.
    expect(cache.size).toBe(0);
    expect(events.at(-1)?.outcome).toBe('withheld');
  });

  it('withholds a reply that quotes the stored solution', async () => {
    const { runtime } = harness({ reply: () => `Here you go. ${SECRETS.solution}` });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply, SECRETS.solution);
    expect(reply.withheldReason).toContain('reply-quotes-solution');
  });

  it('withholds a reply that announces the answer', async () => {
    const { runtime } = harness({ reply: () => 'The correct answer is option A, obviously.' });
    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    expectNotFromProvider(reply);
    expect(reply.withheldReason).toContain('announces');
  });

  it('turns a provider failure into fixed guidance, never an empty or raw reply', async () => {
    const { runtime, events } = harness({ failWith: new TutorProviderError('upstream 503', true) });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expectNotFromProvider(reply, '503');
    expect(reply.source).toBe('fixed-guidance');
    expect(events.at(-1)?.outcome).toBe('provider-failed');
  });
});

describe('what is recorded', () => {
  it('never records a prompt, a reply or the learner’s words', async () => {
    const { runtime, events } = harness({ reply: () => 'Straightforward: x = 5.' });

    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    await answerTutorAsk({ ...ASK, action: 'explain_step' }, CONTEXT, SECRETS, runtime);

    const serialised = JSON.stringify(events);
    expect(serialised).not.toContain(ASK.learnerAttempt);
    expect(serialised).not.toContain(CONTEXT.prompt);
    expect(serialised).not.toContain(SECRETS.solution);
    expect(serialised).not.toContain(SECRETS.correctOptionText);
    expect(serialised).not.toContain('x = 5');
    // What it does record is enough to see a problem.
    expect(events.every((event) => typeof event.outcome === 'string')).toBe(true);
    expect(events.some((event) => event.reasons.length > 0)).toBe(true);
  });

  it('counts tokens for cost reporting without naming any content', async () => {
    const { runtime, events } = harness();
    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    const answered = events.find((event) => event.outcome === 'answered');
    expect(answered?.promptTokens).toBeGreaterThan(0);
    expect(answered?.replyTokens).toBeGreaterThan(0);
  });
});
