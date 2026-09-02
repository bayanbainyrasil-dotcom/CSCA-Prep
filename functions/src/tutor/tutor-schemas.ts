/**
 * The wire contract for a tutor request.
 *
 * Strict throughout: a caller cannot send a question's answer, a solution, a
 * provider name, a quota, a model or a system prompt. Everything the tutor
 * knows about a question it reads from Firestore itself.
 */
import { z } from "zod";

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Identifiers use letters, digits, dot, colon, underscore and hyphen.");

export const TutorModeSchema = z.enum(["hint", "explain-concept", "check-reasoning"]);

export const AskTutorSchema = z
  .object({
    mode: TutorModeSchema,
    questionId: identifier,
    language: z.enum(["en", "ru", "zh"]),
    /** The learner's own working. Bounded so a prompt cannot be smuggled in. */
    learnerAttempt: z.string().max(600).default(""),
    /** Stable per user action, so a retried ask does not spend the quota twice. */
    mutationId: identifier,
  })
  .strict();

export type AskTutorInput = z.infer<typeof AskTutorSchema>;

export const TutorReplySchema = z
  .object({
    mode: TutorModeSchema,
    text: z.string(),
    cached: z.boolean(),
    withheldReason: z.string().nullable(),
    remaining: z.number().int().nonnegative(),
  })
  .strict();
