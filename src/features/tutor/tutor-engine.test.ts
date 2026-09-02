import { describe, expect, it } from 'vitest';
import {
  answerTutorAsk,
  TutorRefusal,
  TUTOR_CACHE_TTL_MS,
  type TutorCacheEntry,
  type TutorEvent,
  type TutorRuntime,
} from '../../../functions/src/tutor/tutor-engine';
import { createFakeTutorProvider } from '../../../functions/src/tutor/fake-provider';
import { TutorProviderError } from '../../../functions/src/tutor/provider';
import { WITHHELD_REPLY, type QuotaWindow, type TutorAsk, type TutorQuestionContext, type TutorSecrets } from '../../../functions/src/tutor/tutor-contract';

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
  mode: 'hint',
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
}

function harness(overrides: Partial<TutorRuntime> & { reply?: (prompt: string) => string; failWith?: Error } = {}): Harness {
  const events: TutorEvent[] = [];
  const cache = new Map<string, TutorCacheEntry>();
  const prompts: string[] = [];
  const quota: { window: QuotaWindow | null } = { window: null };
  const { reply, failWith, ...runtimeOverrides } = overrides;

  const runtime: TutorRuntime = {
    environment: { AI_TUTOR_ENABLED: 'true' },
    now: NOW,
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

  return { runtime, events, cache, prompts, quota };
}

async function refusalOf(promise: Promise<unknown>): Promise<TutorRefusal> {
  try {
    await promise;
  } catch (cause) {
    if (cause instanceof TutorRefusal) return cause;
    throw cause;
  }
  throw new Error('Expected the tutor to refuse, but it answered.');
}

describe('the feature flag decides before anything else', () => {
  it('refuses when the flag is absent, and calls no provider', async () => {
    const { runtime, prompts, events, quota } = harness({ environment: {} });

    const refusal = await refusalOf(answerTutorAsk(ASK, CONTEXT, SECRETS, runtime));

    expect(refusal.code).toBe('disabled');
    expect(prompts).toEqual([]);
    expect(quota.window).toBeNull();
    expect(events.map((entry) => entry.outcome)).toEqual(['disabled']);
  });

  it('refuses for a value that merely looks enabled', async () => {
    for (const value of ['1', 'yes', 'TRUE']) {
      const { runtime, prompts } = harness({ environment: { AI_TUTOR_ENABLED: value } });
      expect((await refusalOf(answerTutorAsk(ASK, CONTEXT, SECRETS, runtime))).code, value).toBe('disabled');
      expect(prompts, value).toEqual([]);
    }
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
  it('refuses once the window is spent, and does not call the provider', async () => {
    const { runtime, prompts, events } = harness({
      readQuota: () => Promise.resolve({ used: 30, limit: 30, windowSeconds: 3600, expiresAt: NOW + 600_000 }),
    });

    const refusal = await refusalOf(answerTutorAsk(ASK, CONTEXT, SECRETS, runtime));

    expect(refusal.code).toBe('quota-exceeded');
    expect(refusal.message).toContain('30');
    expect(prompts).toEqual([]);
    expect(events.at(-1)?.outcome).toBe('quota-exceeded');
  });
});

describe('a misbehaving provider', () => {
  it('withholds a reply that states the correct option, and says so', async () => {
    const { runtime, cache, events } = harness({ reply: () => 'Straightforward: x = 5.' });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(reply.text).toBe(WITHHELD_REPLY);
    expect(reply.withheldReason).toContain('reply-contains-correct-option');
    // A withheld reply is never cached: nothing should serve it later.
    expect(cache.size).toBe(0);
    expect(events.at(-1)?.outcome).toBe('withheld');
  });

  it('withholds a reply that quotes the stored solution', async () => {
    const { runtime } = harness({ reply: () => `Here you go. ${SECRETS.solution}` });

    const reply = await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);

    expect(reply.text).toBe(WITHHELD_REPLY);
    expect(reply.withheldReason).toContain('reply-quotes-solution');
  });

  it('withholds a reply that announces the answer', async () => {
    const { runtime } = harness({ reply: () => 'The correct answer is option A, obviously.' });
    expect((await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime)).withheldReason).toContain('announces');
  });

  it('turns a provider failure into a refusal, never into an empty reply', async () => {
    const { runtime, events } = harness({ failWith: new TutorProviderError('upstream 503', true) });

    const refusal = await refusalOf(answerTutorAsk(ASK, CONTEXT, SECRETS, runtime));

    expect(refusal.code).toBe('provider-failed');
    expect(refusal.message).not.toContain('503');
    expect(events.at(-1)?.outcome).toBe('provider-failed');
  });
});

describe('what is recorded', () => {
  it('never records a prompt, a reply or the learner’s words', async () => {
    const { runtime, events } = harness({ reply: () => 'Straightforward: x = 5.' });

    await answerTutorAsk(ASK, CONTEXT, SECRETS, runtime);
    await answerTutorAsk({ ...ASK, mode: 'explain-concept' }, CONTEXT, SECRETS, runtime);

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
