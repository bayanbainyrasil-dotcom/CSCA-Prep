import { z } from 'zod';

/**
 * Zod validation for blueprint data.
 *
 * The logic itself lives in `functions/src/blueprint-engine.ts` and is shared
 * with the trusted server, so the coverage rules the tests exercise are exactly
 * the rules the server enforces. This module only validates shapes with the web
 * toolchain's Zod and re-exports the engine.
 */

export * from '../../../functions/src/blueprint-engine';

export const BlueprintSubjectSchema = z.enum(['mathematics', 'physics']);

export const BlueprintQuestionTypeSchema = z.enum([
  'concept-recognition',
  'single-step-calculation',
  'multi-step-calculation',
  'formula-selection',
  'unit-conversion',
  'graph-reading',
  'estimation',
  'word-problem',
]);

export const BlueprintExamModeSchema = z.enum(['diagnostic', 'practice', 'mock']);

export const VerificationStatusSchema = z.enum([
  'demo',
  'draft',
  'pending-review',
  'unverified',
  'author-checked',
  'reviewer-verified',
]);

export const BlueprintSourceTypeSchema = z.enum([
  'official-outline',
  'original-csca-style',
  'template-generated',
  'diagnostic',
]);

export const BlueprintLanguageSchema = z.enum(['en', 'ru', 'zh']);

const IdField = z.string().trim().min(1).max(160);
const NameField = z.string().trim().min(1).max(200);
const IsoField = z.string().trim().min(10).max(40);

export const BlueprintCellSchema = z
  .object({
    id: IdField,
    subject: BlueprintSubjectSchema,
    module: NameField,
    topicId: IdField,
    topic: NameField,
    skillId: IdField,
    skill: NameField,
    microSkillId: IdField,
    microSkill: NameField,
    prerequisiteCellIds: z.array(IdField).max(20),
    difficultyLevels: z.array(z.number().int().min(1).max(5)).min(1).max(5),
    questionTypes: z.array(BlueprintQuestionTypeSchema).min(1).max(8),
    minimumItems: z.number().int().min(1).max(50),
    supportedLanguages: z.array(BlueprintLanguageSchema).min(1),
    allowedExamModes: z.array(BlueprintExamModeSchema).min(1),
    verificationStatus: VerificationStatusSchema,
    sourceType: BlueprintSourceTypeSchema,
    sourceReference: z.string().trim().max(500),
    reviewer: z.string().trim().min(1).max(160).nullable(),
    reviewedAt: IsoField.nullable(),
    knownLimitations: z.string().max(2_000).default(''),
    version: z.number().int().positive(),
    createdAt: IsoField,
    updatedAt: IsoField,
  })
  .strict()
  .superRefine((cell, context) => {
    if (cell.verificationStatus === 'reviewer-verified' && (!cell.reviewer || !cell.reviewedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewer'],
        message: 'A reviewer-verified blueprint cell must name its reviewer and review date',
      });
    }
    if (new Set(cell.difficultyLevels).size !== cell.difficultyLevels.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['difficultyLevels'], message: 'Difficulty levels must not repeat' });
    }
    if (new Set(cell.questionTypes).size !== cell.questionTypes.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['questionTypes'], message: 'Question types must not repeat' });
    }
    if (cell.prerequisiteCellIds.includes(cell.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['prerequisiteCellIds'], message: 'A cell cannot be its own prerequisite' });
    }
  });

export const BlueprintQuestionRecordSchema = z
  .object({
    questionId: IdField,
    cellId: IdField.nullable(),
    subject: BlueprintSubjectSchema,
    topicId: IdField,
    difficulty: z.number().int().min(1).max(5),
    questionType: BlueprintQuestionTypeSchema,
    language: BlueprintLanguageSchema,
    status: z.enum(['draft', 'published', 'archived']),
    demo: z.boolean(),
    verificationStatus: VerificationStatusSchema,
    sourceType: BlueprintSourceTypeSchema,
    sourceReference: z.string().trim().max(500),
    reviewer: z.string().trim().min(1).max(160).nullable(),
    reviewedAt: IsoField.nullable(),
    correctAnswerLabel: z.string().trim().min(1).max(32),
    knownLimitations: z.string().max(2_000).default(''),
    contentVersion: z.number().int().nonnegative(),
    verifiedContentVersion: z.number().int().nonnegative().nullable(),
    publicAnswerKey: z.boolean().default(false),
  })
  .strict()
  .superRefine((item, context) => {
    if (item.verificationStatus === 'reviewer-verified' && (!item.reviewer || !item.reviewedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewer'],
        message: 'A reviewer-verified item must name its reviewer and review date',
      });
    }
    if (item.demo && item.verificationStatus === 'reviewer-verified') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['verificationStatus'],
        message: 'Demo material cannot be reviewer-verified',
      });
    }
  });
