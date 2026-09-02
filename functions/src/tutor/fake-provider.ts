/**
 * A deterministic provider, used by the tests and by any deployment that turns
 * the tutor on before a real model is wired up.
 *
 * It is deliberately dull: it restates the step the learner is on and asks a
 * question back. It cannot leak an answer because it is never told one — which
 * is also why the screening tests drive it with a scripted reply instead, to
 * prove the guard works against a provider that does misbehave.
 */
import type { TutorProvider, TutorProviderOutput } from './provider';

export interface FakeTutorProviderOptions {
  name?: string;
  /** Scripted reply, for exercising the screening path. */
  reply?: (prompt: string) => string;
  /** Throws instead of replying, for exercising the failure path. */
  failWith?: Error;
  /** Records every prompt the provider was given, so tests can inspect them. */
  seen?: string[];
}

const OPENERS: Record<string, string> = {
  hint: 'Look at what changes between the two sides of the relation, and name that first.',
  'explain-concept': 'The idea here is that the same operation applied to both sides keeps the relation true.',
  'check-reasoning': 'Your first step looks reasonable; check whether the sign survived it.',
};

export function createFakeTutorProvider(options: FakeTutorProviderOptions = {}): TutorProvider {
  const name = options.name ?? 'fake';
  return {
    name,
    generate(prompt: string): Promise<TutorProviderOutput> {
      options.seen?.push(prompt);
      if (options.failWith) return Promise.reject(options.failWith);

      const text = options.reply
        ? options.reply(prompt)
        : `${openerFor(prompt)} What would you try next, and why?`;
      return Promise.resolve({
        text,
        usage: { promptTokens: estimateTokens(prompt), replyTokens: estimateTokens(text) },
      });
    },
  };
}

function openerFor(prompt: string): string {
  for (const [mode, opener] of Object.entries(OPENERS)) {
    if (prompt.includes(mode === 'hint' ? 'Give one short hint' : mode === 'explain-concept' ? 'Explain the idea' : 'has a gap')) {
      return opener;
    }
  }
  return OPENERS.hint!;
}

/** A rough count, good enough for quota accounting and never billed against. */
function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}
