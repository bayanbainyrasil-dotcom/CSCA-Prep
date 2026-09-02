/**
 * Spending limits above the per-learner quota: a shared daily budget and a kill
 * switch, both of which stop calls before a provider is reached.
 *
 * The budget is deliberately checked against an estimate before the call and
 * updated with the real usage after it, so a run of unexpectedly long replies
 * cannot overshoot by more than one call.
 */

export const TUTOR_KILL_SWITCH = 'AI_TUTOR_KILL_SWITCH';

/**
 * A single switch that stops every tutor call, regardless of the feature flag.
 * It is checked first and separately so turning the tutor off in an incident is
 * one variable, not a redeployment.
 */
export function isTutorKilled(environment: Record<string, string | undefined>): boolean {
  return environment[TUTOR_KILL_SWITCH] === 'true';
}

export interface DailyBudgetState {
  /** ISO date, UTC. A different day resets the counters. */
  day: string;
  requests: number;
  tokens: number;
}

export const DEFAULT_TUTOR_BUDGET = { maxRequests: 2_000, maxTokens: 1_000_000 } as const;

export interface BudgetDecision {
  allowed: boolean;
  reason: string | null;
  next: DailyBudgetState;
}

export function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function decideBudget(
  state: DailyBudgetState | null,
  now: number,
  estimatedTokens: number,
  limits = DEFAULT_TUTOR_BUDGET,
): BudgetDecision {
  const day = utcDay(now);
  const current = state !== null && state.day === day ? state : { day, requests: 0, tokens: 0 };

  if (current.requests >= limits.maxRequests) {
    return { allowed: false, reason: 'The tutor has reached its daily request budget.', next: current };
  }
  if (current.tokens + estimatedTokens > limits.maxTokens) {
    return { allowed: false, reason: 'The tutor has reached its daily token budget.', next: current };
  }

  return {
    allowed: true,
    reason: null,
    next: { day, requests: current.requests + 1, tokens: current.tokens + estimatedTokens },
  };
}

/** Replaces the estimate with what the call actually used. */
export function settleBudget(state: DailyBudgetState, estimated: number, actual: number): DailyBudgetState {
  return { ...state, tokens: Math.max(0, state.tokens - estimated + actual) };
}
