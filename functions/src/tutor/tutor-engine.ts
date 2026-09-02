/**
 * The tutor request, start to finish, with no Firebase and no I/O.
 *
 * Everything the server does around a provider call lives here: the flag, the
 * quota, the cache, the prompt, the screening and the accounting. The callable
 * supplies storage and a clock; this decides what happens.
 */
import {
  buildTutorPrompt,
  decideQuota,
  isTutorEnabled,
  promptLeaksSecrets,
  screenTutorReply,
  tutorCacheKey,
  TUTOR_PROMPT_VERSION,
  WITHHELD_REPLY,
  type QuotaWindow,
  type TutorAsk,
  type TutorQuestionContext,
  type TutorReply,
  type TutorSecrets,
} from './tutor-contract';
import { TutorProviderError, type TutorProvider } from './provider';

export interface TutorCacheEntry {
  text: string;
  storedAt: number;
}

export interface TutorRuntime {
  environment: Record<string, string | undefined>;
  now: number;
  provider: TutorProvider;
  readQuota: () => Promise<QuotaWindow | null>;
  writeQuota: (window: QuotaWindow) => Promise<void>;
  readCache: (key: string) => Promise<TutorCacheEntry | null>;
  writeCache: (key: string, entry: TutorCacheEntry) => Promise<void>;
  /** Counts and reasons only. Never a prompt, a reply or a learner's words. */
  recordEvent: (event: TutorEvent) => Promise<void>;
}

export interface TutorEvent {
  outcome: 'disabled' | 'quota-exceeded' | 'cache-hit' | 'answered' | 'withheld' | 'provider-failed';
  mode: string;
  questionId: string;
  reasons: string[];
  promptTokens: number;
  replyTokens: number;
}

export class TutorRefusal extends Error {
  constructor(
    readonly code: 'disabled' | 'quota-exceeded' | 'provider-failed',
    message: string,
  ) {
    super(message);
    this.name = 'TutorRefusal';
  }
}

/** A cached reply older than this is discarded, so a prompt change takes effect. */
export const TUTOR_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function answerTutorAsk(
  ask: TutorAsk,
  context: TutorQuestionContext,
  secrets: TutorSecrets,
  runtime: TutorRuntime,
): Promise<TutorReply> {
  if (!isTutorEnabled(runtime.environment)) {
    await runtime.recordEvent(event('disabled', ask, ['flag-off']));
    throw new TutorRefusal('disabled', 'The AI tutor is not enabled for this deployment.');
  }

  const key = tutorCacheKey(ask, TUTOR_PROMPT_VERSION);
  const cached = await runtime.readCache(key);
  if (cached && runtime.now - cached.storedAt < TUTOR_CACHE_TTL_MS) {
    // A cached reply was screened before it was stored, but a stored reply is
    // screened again: the secrets it is checked against may have changed since.
    const recheck = screenTutorReply(cached.text, secrets);
    if (recheck.safe) {
      await runtime.recordEvent(event('cache-hit', ask, []));
      return { mode: ask.mode, text: cached.text, cached: true, withheldReason: null };
    }
  }

  // The quota is spent only when a provider is actually going to be called, so
  // a cache hit costs a learner nothing.
  const quota = decideQuota(await runtime.readQuota(), runtime.now);
  await runtime.writeQuota(quota.next);
  if (!quota.allowed) {
    await runtime.recordEvent(event('quota-exceeded', ask, ['quota']));
    throw new TutorRefusal('quota-exceeded', quota.reason ?? 'The tutor limit is reached.');
  }

  const prompt = buildTutorPrompt(ask, context);
  const leaked = promptLeaksSecrets(prompt, secrets);
  if (leaked.length > 0) {
    // Refusing here rather than calling out is deliberate: a prompt carrying the
    // key is a bug in prompt construction, and sending it would publish the key
    // to a third party before any screening could help.
    await runtime.recordEvent(event('withheld', ask, leaked.map((name) => `prompt-contains-${name}`)));
    return { mode: ask.mode, text: WITHHELD_REPLY, cached: false, withheldReason: 'prompt-would-leak' };
  }

  let output;
  try {
    output = await runtime.provider.generate(prompt, {});
  } catch (cause) {
    const retryable = cause instanceof TutorProviderError && cause.retryable;
    await runtime.recordEvent(event('provider-failed', ask, [retryable ? 'retryable' : 'permanent']));
    throw new TutorRefusal('provider-failed', 'The tutor is unavailable right now.');
  }

  const screened = screenTutorReply(output.text, secrets);
  if (!screened.safe) {
    await runtime.recordEvent({
      ...event('withheld', ask, screened.reasons),
      promptTokens: output.usage.promptTokens,
      replyTokens: output.usage.replyTokens,
    });
    return { mode: ask.mode, text: WITHHELD_REPLY, cached: false, withheldReason: screened.reasons.join(' ') };
  }

  await runtime.writeCache(key, { text: output.text, storedAt: runtime.now });
  await runtime.recordEvent({
    ...event('answered', ask, []),
    promptTokens: output.usage.promptTokens,
    replyTokens: output.usage.replyTokens,
  });
  return { mode: ask.mode, text: output.text, cached: false, withheldReason: null };
}

function event(outcome: TutorEvent['outcome'], ask: TutorAsk, reasons: string[]): TutorEvent {
  return { outcome, mode: ask.mode, questionId: ask.questionId, reasons, promptTokens: 0, replyTokens: 0 };
}
