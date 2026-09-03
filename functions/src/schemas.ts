import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, "Invalid identifier.");

const safeText = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (value) =>
        !/<\/?[a-z][^>]*>/iu.test(value) &&
        !/javascript\s*:/iu.test(value) &&
        !/\bon[a-z]+\s*=/iu.test(value),
      "Raw HTML and executable markup are not accepted.",
    );

export const BootstrapAdminSchema = z
  .object({
    code: z.string().min(1).max(128),
  })
  .strict();

export const UserSettingsSchema = z
  .object({
    theme: z.enum(["system", "light", "dark"]).optional(),
    dailyStudyMinutes: z.number().int().min(5).max(480).optional(),
    explanationLanguage: z.enum(["en", "ru", "en-ru", "zh"]).optional(),
    preferredDifficulty: z.number().int().min(1).max(5).optional(),
    soundEffects: z.boolean().optional(),
    animations: z.boolean().optional(),
    studyReminders: z.boolean().optional(),
  })
  .strict();

export const EnsureUserProfileSchema = z
  .object({
    timezone: z.string().trim().min(1).max(64).optional(),
    targetExam: z.string().trim().min(1).max(80).optional(),
    targetDate: z.string().datetime({ offset: true }).optional(),
    preferredLanguage: z.enum(["en", "ru", "en-ru", "zh"]).optional(),
    settings: UserSettingsSchema.optional(),
    onboarding: z
      .object({
        mathLevel: z.enum(["foundation", "basic", "intermediate"]).optional(),
        physicsLevel: z
          .enum(["new", "foundation", "basic", "intermediate"])
          .optional(),
        dailyAvailableMinutes: z.number().int().min(10).max(480).optional(),
        completed: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const SetUserRoleSchema = z
  .object({
    targetUid: z.string().min(1).max(128),
    role: z.enum(["user", "admin"]),
  })
  .strict();

export const UserExportCollectionSchema = z.enum([
  "profile",
  "progress",
  "topicMastery",
  "attempts",
  "studySessions",
  "dailyPlans",
  "mistakes",
  "bookmarks",
  "notes",
  "examAttempts",
  "vocabularyProgress",
  "formulaProgress",
  "diagnostics",
  "syncState",
]);

export const ExportMyDataSchema = z
  .object({
    collection: UserExportCollectionSchema.default("profile"),
    pageSize: z.number().int().min(1).max(250).default(100),
    cursor: z.string().min(1).max(1_500).optional(),
  })
  .strict();

const QuestionOptionSchema = z
  .object({
    id: identifier,
    text: safeText(2_000),
  })
  .strict();

const CommonMistakeSchema = z
  .object({
    id: identifier,
    description: safeText(2_000),
    distractorOptionId: identifier.optional(),
  })
  .strict();

// The key schema is passed explicitly so this shared contract compiles under both
// the Functions toolchain (Zod 3) and the web toolchain (Zod 4), where the
// single-argument `z.record(value)` overload was removed.
const TemplateParameterKeySchema = z.string().min(1).max(120);

const TemplateParametersSchema = z
  .record(
    TemplateParameterKeySchema,
    z.union([z.string().max(500), z.number().finite(), z.boolean()]),
  )
  .refine((value) => Object.keys(value).length <= 50, "Too many template parameters.");

export const QuestionSchema = z
  .object({
    subject: z.enum(["mathematics", "physics"]),
    module: safeText(120),
    topicId: identifier,
    skill: safeText(160),
    difficulty: z.number().int().min(1).max(5),
    language: z.enum(["en", "ru", "zh"]),
    question: safeText(10_000),
    questionTranslation: safeText(10_000).optional(),
    options: z.array(QuestionOptionSchema).min(2).max(8),
    correctAnswer: identifier,
    solution: safeText(20_000),
    shortSolution: safeText(4_000),
    explanation: safeText(20_000),
    formulas: z.array(safeText(1_000)).max(20).default([]),
    vocabulary: z.array(safeText(120)).max(50).default([]),
    commonMistakes: z.array(CommonMistakeSchema).max(20).default([]),
    estimatedTime: z.number().int().min(5).max(3_600),
    sourceType: z.enum([
      "official-outline",
      "original-csca-style",
      "template-generated",
      "diagnostic",
    ]),
    sourceNote: safeText(2_000),
    tags: z.array(safeText(80)).max(50).default([]),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    demo: z.boolean().default(false),
    templateId: identifier.optional(),
    templateParameters: TemplateParametersSchema.optional(),
    /**
     * Blueprint linkage, required: a question that answers no stated requirement
     * cannot be published, because it would be served to learners while measuring
     * nothing. Verification fields are deliberately absent — an import cannot
     * declare itself reviewed. Only `setContentVerification` writes those, and it
     * stamps the reviewer and the time on the server.
     */
    cellId: identifier,
    questionType: z.enum([
      "concept-recognition",
      "single-step-calculation",
      "multi-step-calculation",
      "formula-selection",
      "unit-conversion",
      "graph-reading",
      "estimation",
      "word-problem",
    ]),
  })
  .strict()
  .superRefine((question, context) => {
    const optionIds = new Set(question.options.map((option) => option.id));
    if (optionIds.size !== question.options.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Option ids must be unique.",
        path: ["options"],
      });
    }
    if (!optionIds.has(question.correctAnswer)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "correctAnswer must reference an option id.",
        path: ["correctAnswer"],
      });
    }
    if (question.sourceType === "template-generated" && !question.templateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Template-generated questions require templateId.",
        path: ["templateId"],
      });
    }
  });

export const ImportQuestionBankSchema = z
  .object({
    dryRun: z.boolean().default(false),
    items: z
      .array(
        z
          .object({
            id: identifier,
            expectedVersion: z.number().int().min(0),
            question: QuestionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = new Set(input.items.map((item) => item.id));
    if (ids.size !== input.items.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Question ids must be unique within an import batch.",
        path: ["items"],
      });
    }
  });

export const ExportQuestionBankSchema = z
  .object({
    pageSize: z.number().int().min(1).max(100).default(50),
    cursor: z.string().min(1).max(1_500).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
  })
  .strict();

export const GradeQuestionModeSchema = z.enum([
  "learn",
  "practice",
  "timed",
  "weak-topics",
  "mistakes",
  "random",
  "diagnostic",
]);

export const GradeQuestionSchema = z
  .object({
    questionId: identifier,
    selectedAnswer: identifier,
    deviceId: identifier,
    confidence: z.enum(["guess", "not-sure", "sure"]),
    errorType: z
      .enum([
        "english-comprehension",
        "concept",
        "formula",
        "calculation",
        "careless",
        "time",
        "guessed",
      ])
      .optional(),
    hintUsed: z.boolean(),
    englishComprehension: z.number().min(0).max(1),
    startedAt: z.string().datetime({ offset: true }),
    answeredAt: z.string().datetime({ offset: true }),
    elapsedMs: z.number().int().min(0).max(7_200_000),
    idempotencyKey: identifier,
    mode: GradeQuestionModeSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.answeredAt) < Date.parse(input.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "answeredAt cannot precede startedAt.",
        path: ["answeredAt"],
      });
    }
  });

export const ClassifyMistakeSchema = z
  .object({
    attemptId: identifier,
    questionId: identifier,
    errorType: z.enum([
      "english-comprehension",
      "concept",
      "formula",
      "calculation",
      "careless",
      "time",
      "guessed",
    ]),
  })
  .strict();

export const FinalizeDiagnosticSchema = z
  .object({
    sessionId: identifier,
    subject: z.enum(["mathematics", "physics"]),
    attemptIds: z.array(identifier).min(1).max(40),
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.attemptIds).size !== input.attemptIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attemptIds"],
        message: "Diagnostic attempt IDs must be unique.",
      });
    }
  });

const blueprintCellCore = {
  subject: z.enum(["mathematics", "physics"]),
  module: safeText(120),
  topicId: identifier,
  topic: safeText(200),
  skillId: identifier,
  skill: safeText(200),
  microSkillId: identifier,
  microSkill: safeText(200),
  prerequisiteCellIds: z.array(identifier).max(20),
  difficultyLevels: z.array(z.number().int().min(1).max(5)).min(1).max(5),
  questionTypes: z
    .array(
      z.enum([
        "concept-recognition",
        "single-step-calculation",
        "multi-step-calculation",
        "formula-selection",
        "unit-conversion",
        "graph-reading",
        "estimation",
        "word-problem",
      ]),
    )
    .min(1)
    .max(8),
  minimumItems: z.number().int().min(1).max(50),
  supportedLanguages: z.array(z.enum(["en", "ru", "zh"])).min(1).max(3),
  allowedExamModes: z.array(z.enum(["diagnostic", "practice", "mock"])).min(1).max(3),
  sourceType: z.enum([
    "official-outline",
    "original-csca-style",
    "template-generated",
    "diagnostic",
  ]),
  sourceReference: z.string().trim().max(500),
  knownLimitations: z.string().trim().max(2_000),
};

/**
 * Administrators author the requirement. They cannot author its verification:
 * `verificationStatus`, `reviewer` and `reviewedAt` are absent here and are
 * written only by `setContentVerification`, which stamps them server-side.
 */
export const UpsertBlueprintCellSchema = z
  .object({ cellId: identifier, ...blueprintCellCore })
  .strict()
  .superRefine((cell, context) => {
    if (cell.prerequisiteCellIds.includes(cell.cellId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prerequisiteCellIds"],
        message: "A cell cannot be its own prerequisite.",
      });
    }
    if (new Set(cell.difficultyLevels).size !== cell.difficultyLevels.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["difficultyLevels"],
        message: "Difficulty levels must not repeat.",
      });
    }
  });

export const SetContentVerificationSchema = z
  .object({
    target: z.enum(["blueprint-cell", "question"]),
    targetId: identifier,
    /**
     * `reviewer-verified` is the only status that certifies content. The reviewer
     * identity and the review time are taken from the authenticated caller and the
     * server clock, never from this payload.
     */
    verificationStatus: z.enum([
      "demo",
      "draft",
      "pending-review",
      "unverified",
      "author-checked",
      "reviewer-verified",
    ]),
    /**
     * The content version the reviewer actually read. Approving a version that is
     * no longer current is refused, so an edit after review cannot inherit it.
     */
    contentVersion: z.number().int().nonnegative(),
    sourceReference: z.string().trim().max(500).optional(),
    note: safeText(1_000).optional(),
  })
  .strict();

export const BlueprintCoverageSchema = z
  .object({
    subject: z.enum(["mathematics", "physics"]).optional(),
    mode: z.enum(["diagnostic", "practice", "mock"]).optional(),
  })
  .strict();

export const PublishMockExamSchema = z
  .object({
    mockExamId: identifier,
    title: safeText(200),
    subject: z.enum(["mathematics", "physics"]),
    cellIds: z.array(identifier).min(1).max(200),
    questionCount: z.number().int().min(1).max(100),
    durationMinutes: z.number().int().min(1).max(240),
    instructions: safeText(10_000),
    language: z.enum(["en", "ru", "zh"]).default("en"),
    seed: identifier,
  })
  .strict()
  .superRefine((input, context) => {
    if (new Set(input.cellIds).size !== input.cellIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cellIds"],
        message: "Blueprint cell IDs must be unique.",
      });
    }
  });

const importBatchFields = {
  /** Stable per attempt, so re-running the same batch is a no-op. */
  batchId: identifier,
  dryRun: z.boolean(),
};

export const ImportBlueprintDraftSchema = z
  .object({ ...importBatchFields, seedVersion: z.string().trim().min(1).max(64) })
  .strict();

/**
 * The caller names which server-held seed to import and at which version. It
 * cannot send the content, a verification status, a reviewer or a coverage
 * count: the server reads its own copy.
 */
export const ImportPublicQuestionSeedSchema = z
  .object({ ...importBatchFields, seedVersion: z.string().trim().min(1).max(64) })
  .strict();

/**
 * Confidential content an administrator holds locally. The answer key and the
 * solution travel in this payload and are split server-side: only the prompt is
 * written to `questions`, and the key and solution go to `questionSolutions`,
 * which no learner can read.
 */
export const ImportPrivateQuestionsSchema = z
  .object({
    ...importBatchFields,
    items: z
      .array(
        z
          .object({
            id: identifier,
            expectedVersion: z.number().int().nonnegative().optional(),
            question: QuestionSchema,
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((input, context) => {
    const ids = input.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Question IDs must be unique within one import.",
      });
    }
  });

export const StartMockExamSchema = z
  .object({
    mockExamId: identifier,
    deviceId: identifier,
  })
  .strict();

export const SaveMockAnswerSchema = z
  .object({
    attemptId: identifier,
    questionId: identifier,
    /** `null` clears a selection; it is stored as "reached but not answered". */
    selectedAnswer: identifier.nullable(),
    /** Stable per user action, so a retried save cannot double-apply. */
    mutationId: identifier,
    currentQuestionIndex: z.number().int().min(0).max(99).optional(),
    flaggedQuestionIds: z.array(identifier).max(100).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const flagged = input.flaggedQuestionIds;
    if (flagged && new Set(flagged).size !== flagged.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["flaggedQuestionIds"],
        message: "Flagged question IDs must be unique.",
      });
    }
  });

export const SubmitMockExamSchema = z
  .object({
    attemptId: identifier,
    /** Present so a retried submission returns the first result instead of regrading. */
    mutationId: identifier,
  })
  .strict();

export const ResumeMockExamSchema = z
  .object({
    attemptId: identifier,
  })
  .strict();

export const ReviewMockExamSchema = z
  .object({
    attemptId: identifier,
  })
  .strict();

export const ResetMyProgressSchema = z
  .object({
    confirmation: z.literal("RESET"),
  })
  .strict();

/**
 * Recording an official-outline review.
 *
 * Strict, and deliberately missing every field a caller might want to forge:
 * there is no reviewer, reviewerUid, reviewedAt, lastCheckedAt or version here.
 * All five are server facts. There is also no field able to hold an extract of
 * the source: `ownSummary` and `differenceNote` are bounded and are the
 * reviewer's own words about a document, never the document.
 */
/**
 * The one thing a browser may report about itself.
 *
 * A client-writable telemetry endpoint is attack surface, so this is as small as
 * it can be and still be useful: a fixed event name, a fixed reason, an entity
 * type and a small attempt count. Every field is an enum or a bounded integer.
 * There is deliberately no string field at all — nothing here can carry a URL,
 * an email, a uid, an IP, a question id, an answer or a document.
 */
export const ClientOperationalEventSchema = z
  .object({
    kind: z.literal("sync-failure"),
    reason: z.enum([
      "network-unavailable",
      "conflict-unresolved",
      "outbox-stalled",
      "version-gap",
      "storage-full",
      "unknown",
    ]),
    entityType: z.enum([
      "attempt",
      "mistake",
      "mastery",
      "daily-plan",
      "mock-attempt",
      "vocabulary-progress",
      "formula-progress",
      "note",
      "bookmark",
      "study-plan",
      "slice-progress",
    ]),
    attempt: z.number().int().min(1).max(50),
  })
  .strict();

export const OutlineReviewStatusSchema = z.enum([
  "matches-source",
  "difference-found",
  "needs-specialist",
  "superseded",
]);

export const RecordOutlineReviewSchema = z
  .object({
    cellId: z.string().trim().min(1).max(120),
    status: OutlineReviewStatusSchema,
    /** The cell version the reviewer actually read. Guards against a race. */
    expectedCellVersion: z.number().int().nonnegative(),
    sourceUrl: z.string().url().max(500).nullable().default(null),
    sourceTitle: z.string().trim().max(200).nullable().default(null),
    sourceEdition: z.string().trim().max(120).nullable().default(null),
    sourcePublishedAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
      .nullable()
      .default(null),
    differenceNote: z.string().max(1000).default(""),
    ownSummary: z.string().max(400).default(""),
    /** The reviewer states the summary is their own words, not a quotation. */
    ownWordsAttested: z.literal(true),
  })
  .strict();

export const ReadOutlineReviewsSchema = z
  .object({
    subject: z.enum(["mathematics", "physics"]).optional(),
  })
  .strict();

/**
 * Account deletion is irreversible, so the caller types the word rather than
 * clicking once. The freshness of the sign-in is checked server-side from the
 * token, not asserted by the caller.
 */
export const DeleteMyAccountSchema = z
  .object({
    confirmation: z.literal("DELETE"),
  })
  .strict();

export type QuestionInput = z.infer<typeof QuestionSchema>;
