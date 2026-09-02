/**
 * The wire contract for a tutor request.
 *
 * Strict throughout: a caller cannot send a question's answer, a solution, a
 * provider name, a model, a system prompt, a quota or a budget. It cannot claim
 * its own answer has been revealed either — the server reads that from the
 * attempt it owns.
 */
import { z } from "zod";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Identifiers use letters, digits, dot, colon, underscore and hyphen.");

export const TutorActionSchema = z.enum([
  "practice_hint",
  "post_answer_explanation",
  "explain_step",
  "translate_explanation",
  "prerequisite_coach",
]);

export const AskTutorSchema = z
  .object({
    action: TutorActionSchema,
    questionId: identifier,
    language: z.enum(["en", "ru", "zh"]),
    /** The learner's own working. Bounded so a long prompt cannot be smuggled in. */
    learnerAttempt: z.string().max(600).default(""),
    /** Stable per user action, so a retried ask does not spend the quota twice. */
    mutationId: identifier,
  })
  .strict();

export type AskTutorInput = z.infer<typeof AskTutorSchema>;

export const TutorReplySchema = z
  .object({
    action: TutorActionSchema,
    text: z.string(),
    cached: z.boolean(),
    withheldReason: z.string().nullable(),
    source: z.enum(["provider", "verified-content", "fixed-guidance"]),
    remaining: z.number().int().nonnegative(),
  })
  .strict();
