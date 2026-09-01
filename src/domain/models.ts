import { z } from "zod";

/**
 * Domain values are deliberately JSON-safe. Firestore Timestamp objects are
 * converted at the adapter boundary; IndexedDB only receives ISO-8601 strings.
 */
export const IdSchema = z.string().trim().min(1).max(160);

export const IsoDateTimeSchema = z
  .string()
  .refine(
    (value) => value.includes("T") && Number.isFinite(Date.parse(value)),
    "Expected an ISO-8601 date-time",
  );

export const LocalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    if (year === undefined || month === undefined || day === undefined) return false;
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, "Expected a valid calendar date");

export const TimezoneSchema = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}, "Expected an IANA timezone");

export const SubjectSchema = z.enum(["mathematics", "physics", "english"]);
export type Subject = z.infer<typeof SubjectSchema>;

export const ExplanationLanguageSchema = z.enum(["en", "ru", "en-ru", "zh"]);
export type ExplanationLanguage = z.infer<typeof ExplanationLanguageSchema>;

export const ContentLanguageSchema = z.enum(["en", "ru", "zh"]);
export type ContentLanguage = z.infer<typeof ContentLanguageSchema>;

export const DifficultySchema = z.number().int().min(1).max(5);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ContentStatusSchema = z.enum(["draft", "published", "archived"]);
export type ContentStatus = z.infer<typeof ContentStatusSchema>;

export const LocalizedTextSchema = z
  .object({
    en: z.string().trim().min(1).max(20_000),
    ru: z.string().trim().min(1).max(20_000).optional(),
    zh: z.string().trim().min(1).max(20_000).optional(),
  })
  .strict();
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const ThemeSchema = z.enum(["system", "light", "dark"]);
export const RoleSchema = z.enum(["user", "admin"]);

export const UserSettingsSchema = z
  .object({
    theme: ThemeSchema.default("system"),
    dailyStudyMinutes: z.number().int().min(10).max(360).default(90),
    explanationLanguage: ExplanationLanguageSchema.default("en-ru"),
    soundEffects: z.boolean().default(false),
    animations: z.boolean().default(true),
    studyReminders: z.boolean().default(false),
    preferredDifficulty: DifficultySchema.default(2),
  })
  .strict();
export type UserSettings = z.infer<typeof UserSettingsSchema>;

export const UserProfileSchema = z
  .object({
    uid: IdSchema,
    name: z.string().trim().min(1).max(120),
    email: z.string().email().max(320).nullable(),
    photoURL: z.string().url().max(2_048).nullable(),
    createdAt: IsoDateTimeSchema,
    lastActiveAt: IsoDateTimeSchema,
    role: RoleSchema,
    timezone: TimezoneSchema,
    targetExam: z.literal("CSCA"),
    targetDate: LocalDateSchema.nullable(),
    preferredLanguage: ExplanationLanguageSchema,
    onboardingCompleted: z.boolean(),
    settings: UserSettingsSchema,
    version: z.number().int().positive(),
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const TopicSchema = z
  .object({
    id: IdSchema,
    subject: SubjectSchema,
    parentId: IdSchema.nullable(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    title: LocalizedTextSchema,
    description: LocalizedTextSchema,
    order: z.number().int().nonnegative(),
    prerequisiteTopicIds: z.array(IdSchema).max(20),
    estimatedMinutes: z.number().int().min(5).max(10_000),
    status: ContentStatusSchema,
    demo: z.boolean(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict()
  .superRefine((topic, context) => {
    if (topic.parentId === topic.id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parentId"],
        message: "A topic cannot be its own parent",
      });
    }
    if (new Set(topic.prerequisiteTopicIds).size !== topic.prerequisiteTopicIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prerequisiteTopicIds"],
        message: "Prerequisite topic IDs must be unique",
      });
    }
  });
export type Topic = z.infer<typeof TopicSchema>;

export const LessonSectionKindSchema = z.enum([
  "big-idea",
  "visual",
  "english",
  "vocabulary",
  "formula",
  "worked-example",
  "guided-practice",
  "independent-practice",
  "csca-style",
  "speed-round",
]);
export type LessonSectionKind = z.infer<typeof LessonSectionKindSchema>;

export const LessonVisualSchema = z
  .object({
    kind: z.enum(["diagram", "graph", "animation", "interactive"]),
    description: LocalizedTextSchema,
    assetUrl: z.string().url().max(2_048).optional(),
    componentKey: IdSchema.optional(),
  })
  .strict();

export const LessonSectionSchema = z
  .object({
    id: IdSchema,
    kind: LessonSectionKindSchema,
    title: LocalizedTextSchema,
    body: LocalizedTextSchema,
    katex: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
    visual: LessonVisualSchema.optional(),
    estimatedMinutes: z.number().int().min(1).max(120),
  })
  .strict()
  .superRefine((section, context) => {
    if (section.kind === "visual" && section.visual === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["visual"],
        message: "Visual sections require accessible visual metadata",
      });
    }
  });
export type LessonSection = z.infer<typeof LessonSectionSchema>;

const REQUIRED_PUBLISHED_LESSON_SECTIONS: readonly LessonSectionKind[] = [
  "big-idea",
  "visual",
  "english",
  "vocabulary",
  "formula",
  "worked-example",
  "guided-practice",
  "independent-practice",
  "csca-style",
  "speed-round",
];

export const LessonSchema = z
  .object({
    id: IdSchema,
    topicId: IdSchema,
    subject: SubjectSchema,
    title: LocalizedTextSchema,
    summary: LocalizedTextSchema,
    sections: z.array(LessonSectionSchema).min(1).max(40),
    vocabularyIds: z.array(IdSchema).max(100),
    formulaIds: z.array(IdSchema).max(100),
    prerequisiteLessonIds: z.array(IdSchema).max(20),
    status: ContentStatusSchema,
    demo: z.boolean(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict()
  .superRefine((lesson, context) => {
    const sectionIds = lesson.sections.map((section) => section.id);
    if (new Set(sectionIds).size !== sectionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections"],
        message: "Lesson section IDs must be unique",
      });
    }
    if (lesson.status === "published") {
      const present = new Set(lesson.sections.map((section) => section.kind));
      for (const kind of REQUIRED_PUBLISHED_LESSON_SECTIONS) {
        if (!present.has(kind)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["sections"],
            message: `Published lessons require a ${kind} section`,
          });
        }
      }
    }
  });
export type Lesson = z.infer<typeof LessonSchema>;

export const QuestionSourceTypeSchema = z.enum([
  "official-outline",
  "original-csca-style",
  "template-generated",
  "diagnostic",
]);
export type QuestionSourceType = z.infer<typeof QuestionSourceTypeSchema>;

export const QuestionOptionSchema = z
  .object({
    id: IdSchema,
    text: z.string().trim().min(1).max(2_000),
  })
  .strict();
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const CommonMistakeSchema = z
  .object({
    id: IdSchema,
    description: z.string().trim().min(1).max(2_000),
    distractorOptionId: IdSchema.optional(),
  })
  .strict();

export const QuestionSchema = z
  .object({
    id: IdSchema,
    subject: SubjectSchema,
    module: z.string().trim().min(1).max(120),
    topicId: IdSchema,
    skill: z.string().trim().min(1).max(160),
    difficulty: DifficultySchema,
    language: ContentLanguageSchema,
    question: z.string().trim().min(1).max(10_000),
    questionTranslation: z.string().trim().min(1).max(10_000).optional(),
    options: z.array(QuestionOptionSchema).min(2).max(8),
    correctAnswer: IdSchema,
    solution: z.string().trim().min(1).max(20_000),
    shortSolution: z.string().trim().min(1).max(4_000),
    explanation: z.string().trim().min(1).max(20_000),
    formulas: z.array(z.string().trim().min(1).max(1_000)).max(20),
    vocabulary: z.array(z.string().trim().min(1).max(120)).max(50),
    commonMistakes: z.array(CommonMistakeSchema).max(20),
    estimatedTime: z.number().int().min(5).max(3_600),
    sourceType: QuestionSourceTypeSchema,
    sourceNote: z.string().trim().min(1).max(2_000),
    tags: z.array(z.string().trim().min(1).max(80)).max(50),
    status: ContentStatusSchema,
    demo: z.boolean(),
    templateId: IdSchema.optional(),
    templateParameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict()
  .superRefine((question, context) => {
    const optionIds = question.options.map((option) => option.id);
    if (new Set(optionIds).size !== optionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Option IDs must be unique",
      });
    }
    if (!optionIds.includes(question.correctAnswer)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctAnswer"],
        message: "Correct answer must reference an existing option",
      });
    }
    const optionTexts = question.options.map((option) => option.text.trim().toLowerCase());
    if (new Set(optionTexts).size !== optionTexts.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Option text must be unique",
      });
    }
    if (question.sourceType === "template-generated" && !question.templateId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateId"],
        message: "Template-generated questions require a template ID",
      });
    }
  });
export type Question = z.infer<typeof QuestionSchema>;

export const PracticeModeSchema = z.enum([
  "learn",
  "practice",
  "timed",
  "weak-topics",
  "mistakes",
  "random",
  "diagnostic",
  "mock",
]);
export type PracticeMode = z.infer<typeof PracticeModeSchema>;

export const GradeablePracticeModeSchema = z.enum([
  "learn",
  "practice",
  "timed",
  "weak-topics",
  "mistakes",
  "random",
  "diagnostic",
]);
export type GradeablePracticeMode = z.infer<typeof GradeablePracticeModeSchema>;

export const ConfidenceSchema = z.enum(["guess", "not-sure", "sure"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const ErrorTypeSchema = z.enum([
  "english-comprehension",
  "concept",
  "formula",
  "calculation",
  "careless",
  "time",
  "guessed",
]);
export type ErrorType = z.infer<typeof ErrorTypeSchema>;

export const AttemptSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    deviceId: IdSchema,
    questionId: IdSchema,
    subject: SubjectSchema,
    topicId: IdSchema,
    mode: PracticeModeSchema,
    selectedAnswer: IdSchema.nullable(),
    correctAnswer: IdSchema,
    isCorrect: z.boolean(),
    confidence: ConfidenceSchema,
    errorType: ErrorTypeSchema.nullable(),
    hintUsed: z.boolean(),
    englishComprehension: z.number().min(0).max(1),
    difficulty: DifficultySchema,
    startedAt: IsoDateTimeSchema,
    answeredAt: IsoDateTimeSchema,
    durationSeconds: z.number().min(0).max(86_400),
    version: z.literal(1),
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((attempt, context) => {
    if (attempt.isCorrect && attempt.errorType !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["errorType"],
        message: "Correct attempts cannot have an error type",
      });
    }
    if (Date.parse(attempt.answeredAt) < Date.parse(attempt.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answeredAt"],
        message: "answeredAt cannot precede startedAt",
      });
    }
  });
export type Attempt = z.infer<typeof AttemptSchema>;

export const MistakeRecordSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    attemptId: IdSchema,
    questionId: IdSchema,
    topicId: IdSchema,
    subject: SubjectSchema,
    selectedAnswer: IdSchema.nullable(),
    correctAnswer: IdSchema,
    errorType: ErrorTypeSchema.nullable(),
    firstSeenAt: IsoDateTimeSchema,
    lastSeenAt: IsoDateTimeSchema,
    repeatedAttempts: z.number().int().positive(),
    nextReviewAt: IsoDateTimeSchema,
    resolved: z.boolean(),
    question: z.string().trim().min(1).max(10_000).optional(),
    userAnswerText: z.string().trim().min(1).max(2_000).optional(),
    correctAnswerText: z.string().trim().min(1).max(2_000).optional(),
    reason: z.string().trim().min(1).max(20_000).optional(),
    solution: z.string().trim().min(1).max(20_000).optional(),
    topic: z.string().trim().min(1).max(160).optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type MistakeRecord = z.infer<typeof MistakeRecordSchema>;

export const TopicMasterySchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    topicId: IdSchema,
    subject: SubjectSchema,
    score: z.number().min(0).max(100),
    accuracy: z.number().min(0).max(1),
    speedScore: z.number().min(0).max(1),
    confidenceCalibration: z.number().min(0).max(1),
    englishComprehension: z.number().min(0).max(1),
    attemptCount: z.number().int().nonnegative(),
    correctAttemptCount: z.number().int().nonnegative(),
    repetitions: z.number().int().nonnegative(),
    consecutiveCorrect: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    reviewStage: z.number().int().min(0).max(20),
    easeFactor: z.number().min(1.3).max(3.0),
    intervalDays: z.number().min(0).max(365),
    highestSuccessfulDifficulty: z.number().int().min(0).max(5),
    recentAttemptIds: z.array(IdSchema).max(20),
    lastReviewedAt: IsoDateTimeSchema.nullable(),
    nextReviewAt: IsoDateTimeSchema,
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((mastery, context) => {
    if (mastery.correctAttemptCount > mastery.attemptCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctAttemptCount"],
        message: "Correct attempts cannot exceed all attempts",
      });
    }
  });
export type TopicMastery = z.infer<typeof TopicMasterySchema>;

export const DailyPlanBlockKindSchema = z.enum([
  "mental-math",
  "new-math",
  "new-physics",
  "english",
  "weak-topic",
  "review",
  "mock",
]);
export type DailyPlanBlockKind = z.infer<typeof DailyPlanBlockKindSchema>;

export const DailyPlanBlockSchema = z
  .object({
    id: IdSchema,
    kind: DailyPlanBlockKindSchema,
    subject: SubjectSchema.nullable(),
    title: z.string().trim().min(1).max(160),
    topicIds: z.array(IdSchema).max(20),
    targetMinutes: z.number().int().min(1).max(180),
    targetQuestionCount: z.number().int().min(0).max(100),
    reason: z.string().trim().min(1).max(500),
    status: z.enum(["upcoming", "active", "completed", "overdue"]),
    completedAt: IsoDateTimeSchema.nullable(),
  })
  .strict();
export type DailyPlanBlock = z.infer<typeof DailyPlanBlockSchema>;

export const DailyPlanSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    date: LocalDateSchema,
    timezone: TimezoneSchema,
    blocks: z.array(DailyPlanBlockSchema).min(1).max(20),
    targetMinutes: z.number().int().min(10).max(360),
    adaptiveReasons: z.array(z.string().trim().min(1).max(500)).max(30),
    generatedAt: IsoDateTimeSchema,
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    const blockIds = plan.blocks.map((block) => block.id);
    if (new Set(blockIds).size !== blockIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks"],
        message: "Daily plan block IDs must be unique",
      });
    }
  });
export type DailyPlan = z.infer<typeof DailyPlanSchema>;

export const MockExamSchema = z
  .object({
    id: IdSchema,
    title: z.string().trim().min(1).max(200),
    subject: z.enum(["mathematics", "physics"]),
    questionIds: z.array(IdSchema).min(1).max(100),
    questionCount: z.number().int().min(1).max(100),
    durationMinutes: z.number().int().min(1).max(240),
    instructions: z.string().trim().min(1).max(10_000),
    status: ContentStatusSchema,
    demo: z.boolean(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict()
  .superRefine((exam, context) => {
    if (exam.questionIds.length !== exam.questionCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIds"],
        message: "questionCount must match the number of question IDs",
      });
    }
    if (new Set(exam.questionIds).size !== exam.questionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIds"],
        message: "Mock exam question IDs must be unique",
      });
    }
  });
export type MockExam = z.infer<typeof MockExamSchema>;

export const MockAnswerSchema = z
  .object({
    questionId: IdSchema,
    selectedAnswer: IdSchema.nullable(),
    answeredAt: IsoDateTimeSchema.nullable(),
    durationSeconds: z.number().min(0).max(86_400),
  })
  .strict();

export const MockResultSchema = z
  .object({
    correct: z.number().int().nonnegative(),
    wrong: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1),
    averageTimeSeconds: z.number().nonnegative(),
    topicScores: z.record(z.string(), z.number().min(0).max(1)),
  })
  .strict();

export const MockAttemptSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    deviceId: IdSchema,
    mockExamId: IdSchema,
    subject: z.enum(["mathematics", "physics"]),
    status: z.enum(["in-progress", "submitted", "abandoned"]),
    answers: z.array(MockAnswerSchema).max(100),
    flaggedQuestionIds: z.array(IdSchema).max(100),
    currentQuestionIndex: z.number().int().nonnegative(),
    remainingSeconds: z.number().int().nonnegative().max(14_400),
    startedAt: IsoDateTimeSchema,
    submittedAt: IsoDateTimeSchema.nullable(),
    result: MockResultSchema.nullable(),
    /**
     * Exam order snapshotted by the server when the attempt started. Present
     * only on server-authoritative attempts; a browser-authored local demo
     * draft omits it, which is how the two are told apart.
     */
    questionIds: z.array(IdSchema).max(100).optional(),
    /** Server-owned exam window. Absent on local demo drafts. */
    durationSeconds: z.number().int().positive().max(14_400).optional(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((attempt, context) => {
    const answerIds = attempt.answers.map((answer) => answer.questionId);
    if (new Set(answerIds).size !== answerIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["answers"],
        message: "Only one answer per question may be stored",
      });
    }
    if (attempt.status === "submitted" && (!attempt.submittedAt || !attempt.result)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["result"],
        message: "Submitted mocks require a submission time and result",
      });
    }
    if (attempt.status === "in-progress" && attempt.submittedAt !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["submittedAt"],
        message: "An in-progress mock cannot have a submission time",
      });
    }
    if (attempt.questionIds && new Set(attempt.questionIds).size !== attempt.questionIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIds"],
        message: "Recorded exam order must not repeat a question",
      });
    }
    if (attempt.questionIds) {
      const recorded = new Set(attempt.questionIds);
      if (attempt.answers.some((answer) => !recorded.has(answer.questionId))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["answers"],
          message: "A server attempt cannot hold an answer outside its recorded exam order",
        });
      }
    }
  });

/** True for attempts created and graded by the trusted server engine. */
export function isServerAuthoritativeMockAttempt(attempt: MockAttempt): boolean {
  return Array.isArray(attempt.questionIds)
    && attempt.questionIds.length > 0
    && typeof attempt.durationSeconds === "number";
}
export type MockAttempt = z.infer<typeof MockAttemptSchema>;

export const VocabularyEntrySchema = z
  .object({
    id: IdSchema,
    english: z.string().trim().min(1).max(160),
    russian: z.string().trim().min(1).max(300),
    chinese: z.string().trim().min(1).max(300).optional(),
    simpleExplanation: LocalizedTextSchema,
    exampleSentence: z.string().trim().min(1).max(2_000),
    category: z.enum(["math", "physics", "question-command", "graph", "unit", "comparison"]),
    subject: SubjectSchema,
    status: ContentStatusSchema,
    demo: z.boolean(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict();
export type VocabularyEntry = z.infer<typeof VocabularyEntrySchema>;

export const FormulaSchema = z
  .object({
    id: IdSchema,
    subject: SubjectSchema,
    topicId: IdSchema,
    name: LocalizedTextSchema,
    katex: z.string().trim().min(1).max(1_000),
    calculates: LocalizedTextSchema,
    variables: z
      .array(
        z
          .object({
            symbol: z.string().trim().min(1).max(30),
            meaning: LocalizedTextSchema,
            siUnit: z.string().trim().min(1).max(80).nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    limitations: LocalizedTextSchema,
    status: ContentStatusSchema,
    demo: z.boolean(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    createdBy: IdSchema,
  })
  .strict();
export type Formula = z.infer<typeof FormulaSchema>;

export const VocabularyProgressSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    vocabularyId: IdSchema,
    reviewStage: z.number().int().min(0).max(20),
    easeFactor: z.number().min(1.3).max(3),
    intervalDays: z.number().min(0).max(365),
    repetitions: z.number().int().nonnegative(),
    lapses: z.number().int().nonnegative(),
    mastered: z.boolean(),
    lastReviewedAt: IsoDateTimeSchema.nullable(),
    nextReviewAt: IsoDateTimeSchema,
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type VocabularyProgress = z.infer<typeof VocabularyProgressSchema>;

export const FormulaProgressSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    formulaId: IdSchema,
    score: z.number().min(0).max(100),
    attempts: z.number().int().nonnegative(),
    lastReviewedAt: IsoDateTimeSchema.nullable(),
    nextReviewAt: IsoDateTimeSchema,
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type FormulaProgress = z.infer<typeof FormulaProgressSchema>;

export const UserNoteSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    topicId: IdSchema,
    text: z.string().max(20_000),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type UserNote = z.infer<typeof UserNoteSchema>;

export const BookmarkSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    targetType: z.enum(["question", "formula", "lesson", "vocabulary"]),
    targetId: IdSchema,
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
export type Bookmark = z.infer<typeof BookmarkSchema>;

/** A calendar day in the learner's timezone, `YYYY-MM-DD`. */
export const DateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date key");

/**
 * What to do about study days that passed without work.
 * - `shift`: a missed day does not consume a plan day; the plan follows the learner.
 * - `redistribute`: calendar dates are kept and the remaining work is spread over the days left.
 * - `calendar`: original dates are kept and missed work is dropped.
 */
export const MissedDayPolicySchema = z.enum(["shift", "redistribute", "calendar"]);
export type MissedDayPolicy = z.infer<typeof MissedDayPolicySchema>;

/**
 * The learner's plan calendar. Replaces deriving the preparation day from the
 * account creation timestamp, which silently consumed days a learner never
 * studied.
 */
export const StudyPlanSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    planStartDate: DateKeySchema,
    totalDays: z.number().int().min(1).max(400),
    completedDays: z.array(DateKeySchema).max(400),
    pausedDays: z.array(DateKeySchema).max(400),
    missedDayPolicy: MissedDayPolicySchema,
    acknowledgedMissedDays: z.array(DateKeySchema).max(400),
    examDate: DateKeySchema.nullable(),
    version: z.number().int().positive(),
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((plan, context) => {
    const overlap = plan.completedDays.filter((dateKey) => plan.pausedDays.includes(dateKey));
    if (overlap.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pausedDays"],
        message: "A day cannot be both completed and paused",
      });
    }
    for (const [field, values] of [
      ["completedDays", plan.completedDays],
      ["pausedDays", plan.pausedDays],
      ["acknowledgedMissedDays", plan.acknowledgedMissedDays],
    ] as const) {
      if (new Set(values).size !== values.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Day lists must not repeat a date",
        });
      }
    }
  });
export type StudyPlan = z.infer<typeof StudyPlanSchema>;

export const SyncEntityTypeSchema = z.enum([
  "profile",
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
]);
export type SyncEntityType = z.infer<typeof SyncEntityTypeSchema>;

export const SyncOperationSchema = z.enum(["upsert", "delete"]);
export type SyncOperation = z.infer<typeof SyncOperationSchema>;

export const SyncEventSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    deviceId: IdSchema,
    entityType: SyncEntityTypeSchema,
    entityId: IdSchema,
    operation: SyncOperationSchema,
    baseVersion: z.number().int().nonnegative(),
    version: z.number().int().positive(),
    payload: z.unknown().optional(),
    critical: z.boolean(),
    createdAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((event, context) => {
    if (event.operation === "upsert" && event.payload === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "Upsert events require a payload",
      });
    }
    if (event.operation === "delete" && event.payload !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["payload"],
        message: "Delete events cannot include a payload",
      });
    }
    if (event.version !== event.baseVersion + 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["version"],
        message: "Sync event version must be baseVersion + 1",
      });
    }
  });
export type SyncEvent = z.infer<typeof SyncEventSchema>;

export type SyncEntity =
  | UserProfile
  | Attempt
  | MistakeRecord
  | TopicMastery
  | DailyPlan
  | MockAttempt
  | VocabularyProgress
  | FormulaProgress
  | UserNote
  | Bookmark
  | StudyPlan;

export function parseSyncEntity(entityType: SyncEntityType, input: unknown): SyncEntity {
  switch (entityType) {
    case "profile":
      return UserProfileSchema.parse(input);
    case "attempt":
      return AttemptSchema.parse(input);
    case "mistake":
      return MistakeRecordSchema.parse(input);
    case "mastery":
      return TopicMasterySchema.parse(input);
    case "daily-plan":
      return DailyPlanSchema.parse(input);
    case "mock-attempt":
      return MockAttemptSchema.parse(input);
    case "vocabulary-progress":
      return VocabularyProgressSchema.parse(input);
    case "formula-progress":
      return FormulaProgressSchema.parse(input);
    case "note":
      return UserNoteSchema.parse(input);
    case "bookmark":
      return BookmarkSchema.parse(input);
    case "study-plan":
      return StudyPlanSchema.parse(input);
  }
}

export function getSyncEntityId(entityType: SyncEntityType, entity: SyncEntity): string {
  if (entityType === "profile") return (entity as UserProfile).uid;
  return (entity as Exclude<SyncEntity, UserProfile>).id;
}

export function getSyncEntityOwnerId(entityType: SyncEntityType, entity: SyncEntity): string {
  if (entityType === "profile") return (entity as UserProfile).uid;
  return (entity as Exclude<SyncEntity, UserProfile>).userId;
}

export function getSyncEntityVersion(entity: SyncEntity): number {
  return entity.version;
}

export function getSyncEntityUpdatedAt(entity: SyncEntity): string {
  return entity.updatedAt;
}

export function createInitialTopicMastery(input: {
  userId: string;
  topicId: string;
  subject: Subject;
  now?: Date;
}): TopicMastery {
  const now = (input.now ?? new Date()).toISOString();
  return TopicMasterySchema.parse({
    id: `${input.userId}:${input.topicId}`,
    userId: input.userId,
    topicId: input.topicId,
    subject: input.subject,
    score: 0,
    accuracy: 0,
    speedScore: 0,
    confidenceCalibration: 0,
    englishComprehension: 0,
    attemptCount: 0,
    correctAttemptCount: 0,
    repetitions: 0,
    consecutiveCorrect: 0,
    lapses: 0,
    reviewStage: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    highestSuccessfulDifficulty: 0,
    recentAttemptIds: [],
    lastReviewedAt: null,
    nextReviewAt: now,
    version: 1,
    createdAt: now,
    updatedAt: now,
  });
}
