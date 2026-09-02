/**
 * AI tutor groundwork — the parts that must be right before any model is called.
 *
 * Everything here is pure and dependency-free, so the same code the server runs
 * is what the tests exercise. There is no provider SDK, no key, and no network
 * call in this file or anywhere under `tutor/` yet: the only provider that
 * exists is a deterministic fake.
 *
 * The design assumption is that a language model will eventually say something
 * it should not. So the answer key never enters a hint prompt, and every reply
 * is screened before it reaches a learner.
 */

export type TutorMode = 'hint' | 'explain-concept' | 'check-reasoning';

/** What the caller asks for. No mode implies the learner has earned the answer. */
export interface TutorAsk {
  mode: TutorMode;
  questionId: string;
  language: 'en' | 'ru' | 'zh';
  /** The learner's own words or working, never a stored solution. */
  learnerAttempt: string;
}

/** The public half of a question: what a hint may be built from. */
export interface TutorQuestionContext {
  questionId: string;
  prompt: string;
  options: { id: string; text: string }[];
  topic: string;
  skill: string;
  difficulty: number;
}

/**
 * The private half. It is passed only to the screening step, never to a
 * provider, so a hint cannot contain what the provider was never told.
 */
export interface TutorSecrets {
  correctAnswerId: string;
  correctOptionText: string;
  solution: string;
  shortSolution: string;
}

export interface TutorReply {
  mode: TutorMode;
  text: string;
  /** True when the reply came from the cache rather than a provider call. */
  cached: boolean;
  /** Set when screening replaced a provider reply it refused to pass on. */
  withheldReason: string | null;
}

// --- Feature flag -----------------------------------------------------------

/**
 * The tutor is off unless a deployment turns it on explicitly. An absent, empty
 * or unparseable value is off; only the exact string "true" enables it, so a
 * stray "1" or "yes" in a deployment config cannot switch on a paid model.
 */
export const TUTOR_FLAG = 'AI_TUTOR_ENABLED';

export function isTutorEnabled(environment: Record<string, string | undefined>): boolean {
  return environment[TUTOR_FLAG] === 'true';
}

// --- Quotas -----------------------------------------------------------------

export interface QuotaWindow {
  /** Calls already made by this learner inside the current window. */
  used: number;
  limit: number;
  windowSeconds: number;
  /** Epoch milliseconds at which the current window ends. */
  expiresAt: number;
}

export interface QuotaDecision {
  allowed: boolean;
  remaining: number;
  reason: string | null;
  /** The window to store back, whether or not the call was allowed. */
  next: QuotaWindow;
}

export const DEFAULT_TUTOR_QUOTA = { limit: 30, windowSeconds: 60 * 60 } as const;

export function decideQuota(window: QuotaWindow | null, now: number, defaults = DEFAULT_TUTOR_QUOTA): QuotaDecision {
  const fresh: QuotaWindow = {
    used: 0,
    limit: defaults.limit,
    windowSeconds: defaults.windowSeconds,
    expiresAt: now + defaults.windowSeconds * 1000,
  };
  const current = window !== null && window.expiresAt > now ? window : fresh;

  if (current.used >= current.limit) {
    const minutes = Math.max(1, Math.ceil((current.expiresAt - now) / 60_000));
    return {
      allowed: false,
      remaining: 0,
      reason: `The tutor limit of ${current.limit} questions is reached. It resets in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      next: current,
    };
  }

  const next = { ...current, used: current.used + 1 };
  return { allowed: true, remaining: next.limit - next.used, reason: null, next };
}

// --- Cache ------------------------------------------------------------------

/**
 * A cache key covers everything that could change the reply. The learner's id is
 * deliberately absent: two learners asking the same thing about the same
 * question share an answer, which is what makes the cache worth having. The
 * attempt text is normalised so trivial whitespace differences still hit.
 */
export function tutorCacheKey(ask: TutorAsk, promptVersion: string): string {
  const attempt = ask.learnerAttempt.trim().toLowerCase().replace(/\s+/g, ' ');
  return [promptVersion, ask.mode, ask.questionId, ask.language, fnv1a(attempt)].join(':');
}

function fnv1a(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

// --- Prompt construction ----------------------------------------------------

export const TUTOR_PROMPT_VERSION = '2026-09-02.1';

/**
 * Builds what a provider is allowed to see. A hint gets the question and the
 * learner's attempt and nothing else: no correct option id, no solution text.
 * Withholding the key from the prompt is the only leak defence that cannot be
 * argued with; the screening below is the second line, not the first.
 */
export function buildTutorPrompt(ask: TutorAsk, context: TutorQuestionContext): string {
  const options = context.options.map((option) => `${option.id}) ${option.text}`).join('\n');
  const instruction: Record<TutorMode, string> = {
    hint: 'Give one short hint about the next step. Do not state which option is correct and do not give the final value.',
    'explain-concept': `Explain the idea behind "${context.skill}" in two or three sentences. Do not solve this question.`,
    'check-reasoning': 'Say whether the reasoning below has a gap, and name the gap. Do not state the correct option or the final value.',
  };
  return [
    `Topic: ${context.topic}`,
    `Skill: ${context.skill}`,
    `Difficulty: ${context.difficulty}`,
    `Question: ${context.prompt}`,
    `Options:\n${options}`,
    `Learner wrote: ${ask.learnerAttempt || '(nothing yet)'}`,
    `Language: ${ask.language}`,
    instruction[ask.mode],
  ].join('\n\n');
}

/** Nothing private may appear in a prompt. This is asserted, not assumed. */
export function promptLeaksSecrets(prompt: string, secrets: TutorSecrets): string[] {
  const found: string[] = [];
  for (const [name, value] of Object.entries({
    correctOptionText: secrets.correctOptionText,
    solution: secrets.solution,
    shortSolution: secrets.shortSolution,
  })) {
    if (value.trim().length >= 8 && prompt.includes(value)) found.push(name);
  }
  return found;
}

// --- Reply screening --------------------------------------------------------

export const WITHHELD_REPLY =
  'The tutor could not give a safe hint for this one. Try writing what you already worked out, and check the worked solution after you answer.';

/** Phrases that announce an answer whatever the surrounding wording. */
const ANSWER_ANNOUNCEMENTS = [
  /\bthe (?:correct )?answer is\b/i,
  /\bcorrect (?:option|choice) is\b/i,
  /\banswer:\s*[a-d]\b/i,
  /\boption\s+[a-d]\s+is\s+(?:the\s+)?correct\b/i,
  /\bchoose\s+(?:option\s+)?[a-d]\b/i,
  // Cyrillic and Han characters are not ASCII word characters, so `\b` would
  // never fire next to them. These patterns match on the characters themselves.
  /правильный ответ/i,
  /верный ответ/i,
  /ответ:\s*[a-dа-г]/i,
  /正确答案/,
  /答案是/,
];

export interface ScreenResult {
  safe: boolean;
  reasons: string[];
}

/**
 * Screens a provider reply for anything that hands the learner the answer:
 * the correct option's text, a sentence lifted from the stored solution, or a
 * phrase that announces a choice. A reply that fails is withheld entirely
 * rather than edited, because a partially redacted hint still leaks.
 */
export function screenTutorReply(text: string, secrets: TutorSecrets): ScreenResult {
  const reasons: string[] = [];
  const normalised = normalise(text);

  if (secrets.correctOptionText.trim().length >= 4 && normalised.includes(normalise(secrets.correctOptionText))) {
    reasons.push('reply-contains-correct-option');
  }
  for (const [name, source] of [
    ['solution', secrets.solution],
    ['shortSolution', secrets.shortSolution],
  ] as const) {
    for (const sentence of sentencesOf(source)) {
      if (sentence.length >= 20 && normalised.includes(normalise(sentence))) {
        reasons.push(`reply-quotes-${name}`);
        break;
      }
    }
  }
  // Matched against the normalised text as well, so padding out the spaces
  // between the words does not slip an announcement past the check.
  if (ANSWER_ANNOUNCEMENTS.some((pattern) => pattern.test(text) || pattern.test(normalised))) {
    reasons.push('reply-announces-an-answer');
  }
  // A bare "B" on its own line is an answer however innocent the rest reads.
  if (/(^|\n)\s*[a-d]\s*(\.|\)|$)/i.test(text.trim()) && text.trim().length < 12) {
    reasons.push('reply-is-a-bare-option');
  }

  return { safe: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function sentencesOf(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
