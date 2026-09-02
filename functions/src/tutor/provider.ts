/**
 * The provider seam.
 *
 * A provider receives a prompt string and returns text. It is never given the
 * answer key, a learner identity, or anything else: everything a provider is
 * allowed to know is already in the prompt that `buildTutorPrompt` produced.
 * That keeps the eventual real provider a thin adapter, and keeps the parts
 * worth testing on this side of the seam.
 *
 * No real provider exists yet. There is no SDK dependency, no endpoint and no
 * key anywhere under `tutor/`; a key will live in Secret Manager and be read at
 * call time, never in this repository.
 */

export interface TutorProviderOutput {
  text: string;
  /** For quota accounting and cost reporting; a fake reports its own estimate. */
  usage: { promptTokens: number; replyTokens: number };
}

export interface TutorProvider {
  readonly name: string;
  /** Rejects rather than returning empty text, so a failure is never a reply. */
  generate(prompt: string, options: { signal?: AbortSignal }): Promise<TutorProviderOutput>;
}

export class TutorProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'TutorProviderError';
  }
}

const registry = new Map<string, TutorProvider>();

export function registerTutorProvider(provider: TutorProvider): void {
  registry.set(provider.name, provider);
}

export function getTutorProvider(name: string): TutorProvider {
  const provider = registry.get(name);
  if (!provider) {
    throw new TutorProviderError(`No tutor provider named "${name}" is registered.`, false);
  }
  return provider;
}

export function registeredTutorProviders(): string[] {
  return [...registry.keys()].sort();
}

/** Test isolation; production never calls this. */
export function clearTutorProviders(): void {
  registry.clear();
}
