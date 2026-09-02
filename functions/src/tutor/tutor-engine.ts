/**
 * The tutor request, start to finish, with no Firebase and no I/O.
 *
 * Everything the server does around a provider call lives here, in the order it
 * happens: kill switch, feature flag, action gate, cache, per-learner quota,
 * daily budget, prompt construction, the provider, screening, accounting.
 *
 * The engine returns text. It never grades, writes a score, touches mastery,
 * readiness, the plan or a verification, and never writes to a content
 * collection — see TUTOR_FORBIDDEN_EFFECTS, which the tests assert against.
 *
 * A refusal is never a dead end: every path that cannot produce a model reply
 * returns fixed, human-written guidance instead, or the stored short solution
 * where the server has already revealed the result.
 */
import {
  buildTutorPrompt,
  isTutorEnabled,
  promptLeaksSecrets,
  screenTutorReply,
  tutorCacheKey,
  decideQuota,
  TUTOR_PROMPT_VERSION,
  type QuotaWindow,
  type TutorAsk,
  type TutorQuestionContext,
  type TutorReply,
  type TutorSecrets,
} from './tutor-contract';
import { gateTutorAction, type LearnerSession } from './tutor-actions';
import { decideBudget, isTutorKilled, settleBudget, type DailyBudgetState } from './tutor-budget';
import { detectInjectionAttempt } from './tutor-injection';
import { tutorFallback } from './tutor-fallback';
import { TutorProviderError, type TutorProvider } from './provider';

export interface TutorCacheEntry {
  text: string;
  storedAt: number;
}

export interface TutorRuntime {
  environment: Record<string, string | undefined>;
  now: number;
  provider: TutorProvider;
  session: LearnerSession;
  readQuota: () => Promise<QuotaWindow | null>;
  writeQuota: (window: QuotaWindow) => Promise<void>;
  readBudget: () => Promise<DailyBudgetState | null>;
  writeBudget: (state: DailyBudgetState) => Promise<void>;
  readCache: (key: string) => Promise<TutorCacheEntry | null>;
  writeCache: (key: string, entry: TutorCacheEntry) => Promise<void>;
  /** Counts and reasons only. Never a prompt, a reply or a learner's words. */
  recordEvent: (event: TutorEvent) => Promise<void>;
}

export type TutorOutcome =
  | 'killed'
  | 'disabled'
  | 'action-refused'
  | 'quota-exceeded'
  | 'budget-exceeded'
  | 'cache-hit'
  | 'answered'
  | 'withheld'
  | 'provider-failed';

export interface TutorEvent {
  outcome: TutorOutcome;
  action: string;
  questionId: string;
  reasons: string[];
  injectionPatterns: number;
  promptTokens: number;
  replyTokens: number;
}

/** A cached reply older than this is discarded, so a prompt change takes effect. */
export const TUTOR_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** A rough count, used to reserve budget before the call. */
function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export async function answerTutorAsk(
  ask: TutorAsk,
  context: TutorQuestionContext,
  secrets: TutorSecrets,
  runtime: TutorRuntime,
): Promise<TutorReply> {
  const injection = detectInjectionAttempt(ask.learnerAttempt);
  const base = { action: ask.action, questionId: ask.questionId, injectionPatterns: injection.length };
  const record = (outcome: TutorOutcome, reasons: string[], usage = { promptTokens: 0, replyTokens: 0 }) =>
    runtime.recordEvent({ ...base, outcome, reasons, ...usage });
  const fallbackReply = (outcome: TutorOutcome, reasons: string[]): TutorReply => {
    const fallback = tutorFallback(ask.action, runtime.session, context, secrets);
    return { action: ask.action, text: fallback.text, cached: false, withheldReason: reasons.join(' ') || null, source: fallback.source };
  };

  // The kill switch is first and separate, so stopping the tutor in an incident
  // is one variable rather than a redeployment.
  if (isTutorKilled(runtime.environment)) {
    await record('killed', ['kill-switch']);
    return fallbackReply('killed', ['kill-switch']);
  }
  if (!isTutorEnabled(runtime.environment)) {
    await record('disabled', ['flag-off']);
    return fallbackReply('disabled', ['flag-off']);
  }

  const gate = gateTutorAction(ask.action, runtime.session);
  if (!gate.allowed) {
    await record('action-refused', [gate.code ?? 'refused']);
    const fallback = tutorFallback(ask.action, runtime.session, context, secrets);
    return { action: ask.action, text: gate.reason ?? fallback.text, cached: false, withheldReason: gate.code, source: 'fixed-guidance' };
  }

  const key = tutorCacheKey(ask, TUTOR_PROMPT_VERSION);
  const cached = await runtime.readCache(key);
  if (cached && runtime.now - cached.storedAt < TUTOR_CACHE_TTL_MS) {
    // A cached reply was screened before it was stored, but it is screened again:
    // the secrets it is checked against may have changed since.
    if (gate.mayUseSecrets || screenTutorReply(cached.text, secrets).safe) {
      await record('cache-hit', []);
      return { action: ask.action, text: cached.text, cached: true, withheldReason: null, source: 'provider' };
    }
  }

  // Quota and budget are spent only when a provider is going to be called, so a
  // cache hit costs a learner nothing.
  const quota = decideQuota(await runtime.readQuota(), runtime.now);
  await runtime.writeQuota(quota.next);
  if (!quota.allowed) {
    await record('quota-exceeded', ['quota']);
    return fallbackReply('quota-exceeded', [quota.reason ?? 'quota']);
  }

  const prompt = buildTutorPrompt(ask, context);
  const leaked = promptLeaksSecrets(prompt, secrets);
  if (!gate.mayUseSecrets && leaked.length > 0) {
    // A prompt carrying the key is a bug in prompt construction. Sending it
    // would publish the key to a third party before screening could help.
    await record('withheld', leaked.map((name) => `prompt-contains-${name}`));
    return fallbackReply('withheld', ['prompt-would-leak']);
  }

  const reserved = estimateTokens(prompt) * 2;
  const budget = decideBudget(await runtime.readBudget(), runtime.now, reserved);
  await runtime.writeBudget(budget.next);
  if (!budget.allowed) {
    await record('budget-exceeded', ['daily-budget']);
    return fallbackReply('budget-exceeded', [budget.reason ?? 'daily-budget']);
  }

  let output;
  try {
    output = await runtime.provider.generate(prompt, {});
  } catch (cause) {
    const retryable = cause instanceof TutorProviderError && cause.retryable;
    await record('provider-failed', [retryable ? 'retryable' : 'permanent']);
    return fallbackReply('provider-failed', ['provider-unavailable']);
  }

  const used = output.usage.promptTokens + output.usage.replyTokens;
  await runtime.writeBudget(settleBudget(budget.next, reserved, used));

  // A post-answer explanation is allowed to name the key: the server has already
  // shown the learner the result. Every other action is screened.
  const screened = gate.mayUseSecrets ? { safe: true, reasons: [] } : screenTutorReply(output.text, secrets);
  if (!screened.safe) {
    await record('withheld', screened.reasons, output.usage);
    return fallbackReply('withheld', screened.reasons);
  }

  await runtime.writeCache(key, { text: output.text, storedAt: runtime.now });
  await record('answered', [], output.usage);
  return { action: ask.action, text: output.text, cached: false, withheldReason: null, source: 'provider' };
}
