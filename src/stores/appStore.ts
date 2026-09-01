import { nanoid } from "nanoid";
import { create } from "zustand";
import { createStore, type StateCreator, type StoreApi } from "zustand/vanilla";
import { z } from "zod";
import {
  AttemptSchema,
  BookmarkSchema,
  DailyPlanSchema,
  ErrorTypeSchema,
  FormulaSchema,
  LessonSchema,
  MistakeRecordSchema,
  MockAttemptSchema,
  MockExamSchema,
  MockResultSchema,
  PracticeModeSchema,
  QuestionSchema,
  TopicMasterySchema,
  TopicSchema,
  UserNoteSchema,
  UserProfileSchema,
  UserSettingsSchema,
  StudyPlanSchema,
  VocabularyEntrySchema,
  createInitialTopicMastery,
  type Attempt,
  type Bookmark,
  type DailyPlan,
  type ErrorType,
  type Formula,
  type Lesson,
  type MistakeRecord,
  type MockAttempt,
  type MockExam,
  type PracticeMode,
  type Question,
  type SyncEntityType,
  type Topic,
  type TopicMastery,
  type UserNote,
  type UserProfile,
  type MissedDayPolicy,
  type StudyPlan,
  type UserSettings,
  type VocabularyEntry,
} from "../domain";
import {
  applyMissedDayChoice,
  markDayCompleted,
  markDayPaused,
  setExamDate as setPlanExamDate,
  setPlanStartDate as movePlanStartDate,
} from "../features/plan/plan-schedule";
import { updateTopicMastery } from "../lib/adaptive";
import type { SaveEntityOptions } from "../lib/persistence";
import type { SyncStatusSnapshot } from "../lib/persistence";

export interface ActivePracticeSession {
  id: string;
  mode: PracticeMode;
  questionIds: string[];
  currentQuestionIndex: number;
  attemptIds: string[];
  startedAt: string;
}

const ActivePracticeSessionSchema = z
  .object({
    id: z.string().min(1),
    mode: PracticeModeSchema,
    questionIds: z.array(z.string().min(1)).min(1),
    currentQuestionIndex: z.number().int().nonnegative(),
    attemptIds: z.array(z.string().min(1)),
    startedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
  })
  .strict();

export interface ProgressMetrics {
  mathematicsReadiness: number;
  physicsReadiness: number;
  englishComprehension: number;
  examSpeed: number;
  readinessScore: number;
  readinessDisclaimer: string;
  currentStreak: number;
  longestStreak: number;
  completedDays: number;
  hoursStudied: number;
  questionsSolved: number;
  lossReasons: Record<ErrorType | "unclassified", number>;
}

export interface StorePersistence {
  save(entityType: SyncEntityType, input: unknown, options?: SaveEntityOptions): Promise<unknown>;
  remove(entityType: SyncEntityType, entityId: string, options?: SaveEntityOptions): Promise<void>;
  saveProfile?: (profile: UserProfile) => Promise<void>;
  syncNow?: () => Promise<SyncStatusSnapshot>;
  pauseSync?: () => Promise<void>;
  resumeSync?: () => void;
}

export interface HydrationPayload {
  profile?: unknown;
  topics?: unknown;
  lessons?: unknown;
  questions?: unknown;
  formulas?: unknown;
  vocabulary?: unknown;
  attempts?: unknown;
  masteries?: unknown;
  mistakes?: unknown;
  bookmarks?: unknown;
  notes?: unknown;
  dailyPlan?: unknown;
  studyPlan?: unknown;
  mockExams?: unknown;
  activeMock?: unknown;
  activePractice?: unknown;
}

export interface CscaAppState {
  hydrated: boolean;
  profile: UserProfile | null;
  topics: Topic[];
  lessons: Lesson[];
  questions: Question[];
  formulas: Formula[];
  vocabulary: VocabularyEntry[];
  attempts: Attempt[];
  masteries: Record<string, TopicMastery>;
  mistakes: Record<string, MistakeRecord>;
  bookmarks: Record<string, Bookmark>;
  notes: Record<string, UserNote>;
  dailyPlan: DailyPlan | null;
  studyPlan: StudyPlan | null;
  mockExams: MockExam[];
  activeMock: MockAttempt | null;
  activePractice: ActivePracticeSession | null;
  settings: UserSettings;
  theme: UserSettings["theme"];
  metrics: ProgressMetrics;
  sync: SyncStatusSnapshot;

  configurePersistence: (persistence: StorePersistence | null) => void;
  hydrate: (payload: HydrationPayload) => void;
  resetUserState: () => void;
  setProfile: (profile: unknown) => void;
  loadContent: (content: { topics?: unknown; lessons?: unknown; questions?: unknown; formulas?: unknown; vocabulary?: unknown; mockExams?: unknown }) => void;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  setDailyPlan: (plan: unknown, persist?: boolean) => Promise<void>;
  completeDailyPlanBlock: (blockId: string) => Promise<void>;
  setStudyPlan: (plan: unknown, persist?: boolean) => Promise<void>;
  chooseMissedDayPolicy: (policy: MissedDayPolicy, todayKey: string) => Promise<void>;
  markStudyDayCompleted: (dateKey: string) => Promise<void>;
  markStudyDayPaused: (dateKey: string) => Promise<void>;
  movePlanStart: (dateKey: string) => Promise<void>;
  setStudyPlanExamDate: (dateKey: string | null) => Promise<void>;
  startPractice: (mode: PracticeMode, questionIds: string[]) => void;
  advancePractice: () => void;
  endPractice: () => void;
  recordAnswer: (attempt: unknown) => Promise<void>;
  classifyMistake: (mistakeId: string, errorType: ErrorType) => Promise<void>;
  resolveMistake: (mistakeId: string) => Promise<void>;
  toggleBookmark: (targetType: Bookmark["targetType"], targetId: string) => Promise<void>;
  saveNote: (topicId: string, text: string) => Promise<void>;
  startMock: (attempt: unknown) => Promise<void>;
  recoverMock: (attempt: unknown) => void;
  answerMockQuestion: (questionId: string, selectedAnswer: string | null, durationSeconds: number) => Promise<void>;
  toggleMockFlag: (questionId: string) => Promise<void>;
  checkpointMock: (currentQuestionIndex: number, remainingSeconds: number) => Promise<void>;
  submitMock: (result: unknown) => Promise<void>;
  setSyncStatus: (snapshot: SyncStatusSnapshot) => void;
  syncNow: () => Promise<void>;
  pauseSync: () => Promise<void>;
  resumeSync: () => void;
}

const DEFAULT_SETTINGS = UserSettingsSchema.parse({});
const DEFAULT_SYNC: SyncStatusSnapshot = {
  status: "saved",
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
};

const EMPTY_METRICS: ProgressMetrics = {
  mathematicsReadiness: 0,
  physicsReadiness: 0,
  englishComprehension: 0,
  examSpeed: 0,
  readinessScore: 0,
  readinessDisclaimer: "Internal CSCA Prep estimate — not an official CSCA score.",
  currentStreak: 0,
  longestStreak: 0,
  completedDays: 0,
  hoursStudied: 0,
  questionsSolved: 0,
  lossReasons: {
    "english-comprehension": 0,
    concept: 0,
    formula: 0,
    calculation: 0,
    careless: 0,
    time: 0,
    guessed: 0,
    unclassified: 0,
  },
};

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function localDateKey(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function shiftDateKey(dateKey: string, delta: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) throw new Error("Invalid date key");
  const date = new Date(Date.UTC(year, month - 1, day + delta));
  return date.toISOString().slice(0, 10);
}

function calculateStreaks(attempts: Attempt[], timezone: string): { current: number; longest: number; days: number } {
  const days = new Set(attempts.map((attempt) => localDateKey(attempt.answeredAt, timezone)));
  if (days.size === 0) return { current: 0, longest: 0, days: 0 };
  const sorted = [...days].sort();
  let longest = 1;
  let run = 1;
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const currentDay = sorted[index];
    if (previous !== undefined && currentDay !== undefined && shiftDateKey(previous, 1) === currentDay) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  const today = localDateKey(new Date().toISOString(), timezone);
  let cursor = days.has(today) ? today : shiftDateKey(today, -1);
  let current = 0;
  while (days.has(cursor)) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return { current, longest, days: days.size };
}

function calculateMetrics(input: {
  attempts: Attempt[];
  masteries: Record<string, TopicMastery>;
  mistakes: Record<string, MistakeRecord>;
  timezone: string;
}): ProgressMetrics {
  const masteries = Object.values(input.masteries);
  const mathematicsMasteries = masteries.filter((item) => item.subject === "mathematics");
  const physicsMasteries = masteries.filter((item) => item.subject === "physics");
  const mathematicsAttempts = input.attempts.filter((item) => item.subject === "mathematics");
  const physicsAttempts = input.attempts.filter((item) => item.subject === "physics");
  const attemptReadiness = (attempts: Attempt[]) => average(attempts.map((attempt) => {
    const confidenceWeight = attempt.confidence === "sure" ? 1 : attempt.confidence === "not-sure" ? 0.82 : 0.58;
    const difficultyWeight = 0.75 + attempt.difficulty * 0.05;
    return attempt.isCorrect ? 100 * confidenceWeight * difficultyWeight : 0;
  }));
  const math = mathematicsMasteries.length > 0
    ? average(mathematicsMasteries.map((item) => item.score))
    : attemptReadiness(mathematicsAttempts);
  const physics = physicsMasteries.length > 0
    ? average(physicsMasteries.map((item) => item.score))
    : attemptReadiness(physicsAttempts);
  const english = average(input.attempts.map((attempt) => attempt.englishComprehension)) * 100;
  const speed = masteries.length > 0
    ? average(masteries.map((item) => item.speedScore)) * 100
    : average(input.attempts.map((attempt) => Math.max(0, Math.min(1, 1 - Math.max(0, attempt.durationSeconds - 60) / 120)))) * 100;
  const streaks = calculateStreaks(input.attempts, input.timezone);
  const lossCounts = { ...EMPTY_METRICS.lossReasons };
  const unresolved = Object.values(input.mistakes).filter((mistake) => !mistake.resolved);
  for (const mistake of unresolved) lossCounts[mistake.errorType ?? "unclassified"] += 1;
  const totalLosses = Math.max(1, unresolved.length);
  const lossReasons = Object.fromEntries(
    Object.entries(lossCounts).map(([key, value]) => [key, round((value / totalLosses) * 100)]),
  ) as ProgressMetrics["lossReasons"];
  return {
    mathematicsReadiness: round(math),
    physicsReadiness: round(physics),
    englishComprehension: round(english),
    examSpeed: round(speed),
    readinessScore: round(math * 0.35 + physics * 0.35 + english * 0.15 + speed * 0.15),
    readinessDisclaimer: EMPTY_METRICS.readinessDisclaimer,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    completedDays: streaks.days,
    hoursStudied: round(input.attempts.reduce((sum, attempt) => sum + attempt.durationSeconds, 0) / 3_600, 2),
    questionsSolved: input.attempts.length,
    lossReasons,
  };
}

function toRecord<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function parseArray<T>(schema: z.ZodType<T>, input: unknown | undefined): T[] | undefined {
  return input === undefined ? undefined : z.array(schema).parse(input);
}

function createStateCreator(initialPersistence: StorePersistence | null = null): StateCreator<CscaAppState> {
  let persistence = initialPersistence;
  const persistAndSync = async (
    entityType: SyncEntityType,
    entity: unknown,
    critical: boolean,
  ): Promise<void> => {
    if (!persistence) return;
    await persistence.save(entityType, entity, { critical });
    if (critical) await persistence.syncNow?.();
  };

  return (set, get) => ({
    hydrated: false,
    profile: null,
    topics: [],
    lessons: [],
    questions: [],
    formulas: [],
    vocabulary: [],
    attempts: [],
    masteries: {},
    mistakes: {},
    bookmarks: {},
    notes: {},
    dailyPlan: null,
    studyPlan: null,
    mockExams: [],
    activeMock: null,
    activePractice: null,
    settings: DEFAULT_SETTINGS,
    theme: DEFAULT_SETTINGS.theme,
    metrics: EMPTY_METRICS,
    sync: DEFAULT_SYNC,

    configurePersistence: (next) => {
      persistence = next;
    },

    hydrate: (payload) => {
      const profile = payload.profile === undefined ? get().profile : UserProfileSchema.parse(payload.profile);
      const attempts = parseArray(AttemptSchema, payload.attempts) ?? get().attempts;
      const masteries = parseArray(TopicMasterySchema, payload.masteries);
      const mistakes = parseArray(MistakeRecordSchema, payload.mistakes);
      const timezone = profile?.timezone ?? "UTC";
      const nextMasteries = masteries ? toRecord(masteries) : get().masteries;
      const nextMistakes = mistakes ? toRecord(mistakes) : get().mistakes;
      set({
        hydrated: true,
        profile,
        topics: parseArray(TopicSchema, payload.topics) ?? get().topics,
        lessons: parseArray(LessonSchema, payload.lessons) ?? get().lessons,
        questions: parseArray(QuestionSchema, payload.questions) ?? get().questions,
        formulas: parseArray(FormulaSchema, payload.formulas) ?? get().formulas,
        vocabulary: parseArray(VocabularyEntrySchema, payload.vocabulary) ?? get().vocabulary,
        attempts,
        masteries: nextMasteries,
        mistakes: nextMistakes,
        bookmarks: payload.bookmarks === undefined ? get().bookmarks : toRecord(z.array(BookmarkSchema).parse(payload.bookmarks)),
        notes: payload.notes === undefined ? get().notes : toRecord(z.array(UserNoteSchema).parse(payload.notes)),
        dailyPlan: payload.dailyPlan === undefined || payload.dailyPlan === null ? null : DailyPlanSchema.parse(payload.dailyPlan),
        studyPlan:
          payload.studyPlan === undefined
            ? get().studyPlan
            : payload.studyPlan === null
              ? null
              : StudyPlanSchema.parse(payload.studyPlan),
        mockExams: parseArray(MockExamSchema, payload.mockExams) ?? get().mockExams,
        activeMock: payload.activeMock === undefined || payload.activeMock === null ? null : MockAttemptSchema.parse(payload.activeMock),
        activePractice:
          payload.activePractice === undefined || payload.activePractice === null
            ? null
            : ActivePracticeSessionSchema.parse(payload.activePractice),
        settings: profile?.settings ?? get().settings,
        theme: profile?.settings.theme ?? get().theme,
        metrics: calculateMetrics({ attempts, masteries: nextMasteries, mistakes: nextMistakes, timezone }),
      });
    },

    resetUserState: () => {
      set({
        hydrated: false,
        profile: null,
        attempts: [],
        masteries: {},
        mistakes: {},
        bookmarks: {},
        notes: {},
        dailyPlan: null,
        studyPlan: null,
        activeMock: null,
        activePractice: null,
        settings: DEFAULT_SETTINGS,
        theme: DEFAULT_SETTINGS.theme,
        metrics: EMPTY_METRICS,
        sync: DEFAULT_SYNC,
      });
    },

    setProfile: (input) => {
      const profile = UserProfileSchema.parse(input);
      set({ profile, settings: profile.settings, theme: profile.settings.theme });
    },

    loadContent: (content) => {
      set({
        topics: parseArray(TopicSchema, content.topics) ?? get().topics,
        lessons: parseArray(LessonSchema, content.lessons) ?? get().lessons,
        questions: parseArray(QuestionSchema, content.questions) ?? get().questions,
        formulas: parseArray(FormulaSchema, content.formulas) ?? get().formulas,
        vocabulary: parseArray(VocabularyEntrySchema, content.vocabulary) ?? get().vocabulary,
        mockExams: parseArray(MockExamSchema, content.mockExams) ?? get().mockExams,
      });
    },

    updateSettings: async (patch) => {
      const settings = UserSettingsSchema.parse({ ...get().settings, ...patch });
      const profile = get().profile;
      if (!profile) throw new Error("A profile is required to update settings");
      const now = new Date().toISOString();
      const updatedProfile = UserProfileSchema.parse({
        ...profile,
        settings,
        preferredLanguage: settings.explanationLanguage,
        lastActiveAt: now,
        updatedAt: now,
        version: profile.version + 1,
      });
      set({ settings, theme: settings.theme, profile: updatedProfile });
      await persistence?.saveProfile?.(updatedProfile);
    },

    setDailyPlan: async (input, shouldPersist = true) => {
      const plan = DailyPlanSchema.parse(input);
      if (get().profile && plan.userId !== get().profile?.uid) throw new Error("Daily plan belongs to another user");
      set({ dailyPlan: plan });
      if (shouldPersist) await persistAndSync("daily-plan", plan, true);
    },

    completeDailyPlanBlock: async (blockId) => {
      const plan = get().dailyPlan;
      if (!plan) throw new Error("No active daily plan");
      const now = new Date().toISOString();
      let found = false;
      const updated = DailyPlanSchema.parse({
        ...plan,
        blocks: plan.blocks.map((block) => {
          if (block.id !== blockId) return block;
          found = true;
          return { ...block, status: "completed", completedAt: now };
        }),
        version: plan.version + 1,
        updatedAt: now,
      });
      if (!found) throw new Error("Unknown daily plan block");
      set({ dailyPlan: updated });
      await persistAndSync("daily-plan", updated, true);

      // A plan day counts as done only when every block of it is done, so the
      // plan calendar reflects real work rather than an opened page.
      if (updated.blocks.every((block) => block.status === "completed")) {
        await get().markStudyDayCompleted(updated.date);
      }
    },

    setStudyPlan: async (input, shouldPersist = true) => {
      const plan = StudyPlanSchema.parse(input);
      const profile = get().profile;
      if (profile && plan.userId !== profile.uid) throw new Error("Study plan belongs to another user");
      set({ studyPlan: plan });
      if (shouldPersist) await persistAndSync("study-plan", plan, true);
    },

    /**
     * The learner's answer to "you missed some days". Nothing about the plan
     * changes until this is called, so the schedule is never rewritten silently.
     */
    chooseMissedDayPolicy: async (policy, todayKey) => {
      const plan = get().studyPlan;
      if (!plan) throw new Error("No study plan to update");
      const updated = applyMissedDayChoice(plan, policy, todayKey);
      set({ studyPlan: updated });
      await persistAndSync("study-plan", updated, true);
    },

    markStudyDayCompleted: async (dateKey) => {
      const plan = get().studyPlan;
      if (!plan) return;
      const updated = markDayCompleted(plan, dateKey);
      if (updated === plan) return;
      set({ studyPlan: updated });
      await persistAndSync("study-plan", updated, true);
    },

    markStudyDayPaused: async (dateKey) => {
      const plan = get().studyPlan;
      if (!plan) throw new Error("No study plan to update");
      const updated = markDayPaused(plan, dateKey);
      if (updated === plan) return;
      set({ studyPlan: updated });
      await persistAndSync("study-plan", updated, true);
    },

    movePlanStart: async (dateKey) => {
      const plan = get().studyPlan;
      if (!plan) throw new Error("No study plan to update");
      const updated = movePlanStartDate(plan, dateKey);
      if (updated === plan) return;
      set({ studyPlan: updated });
      await persistAndSync("study-plan", updated, true);
    },

    setStudyPlanExamDate: async (dateKey) => {
      const plan = get().studyPlan;
      if (!plan) throw new Error("No study plan to update");
      const updated = setPlanExamDate(plan, dateKey);
      if (updated === plan) return;
      set({ studyPlan: updated });
      await persistAndSync("study-plan", updated, true);
    },

    startPractice: (mode, questionIds) => {
      const session = ActivePracticeSessionSchema.parse({
        id: nanoid(),
        mode,
        questionIds,
        currentQuestionIndex: 0,
        attemptIds: [],
        startedAt: new Date().toISOString(),
      });
      set({ activePractice: session });
    },

    advancePractice: () => {
      const session = get().activePractice;
      if (!session) return;
      set({
        activePractice: {
          ...session,
          currentQuestionIndex: Math.min(session.questionIds.length - 1, session.currentQuestionIndex + 1),
        },
      });
    },

    endPractice: () => set({ activePractice: null }),

    recordAnswer: async (input) => {
      const attempt = AttemptSchema.parse(input);
      const state = get();
      if (state.profile && attempt.userId !== state.profile.uid) throw new Error("Attempt belongs to another user");
      if (state.attempts.some((existing) => existing.id === attempt.id)) return;
      const masteryId = `${attempt.userId}:${attempt.topicId}`;
      const currentMastery = state.masteries[masteryId];
      const initialMastery = currentMastery ?? createInitialTopicMastery({
        userId: attempt.userId,
        topicId: attempt.topicId,
        subject: attempt.subject,
        now: new Date(attempt.startedAt),
      });
      const question = state.questions.find((item) => item.id === attempt.questionId);
      const updatedMastery = updateTopicMastery(initialMastery, attempt, {
        expectedTimeSeconds: question?.estimatedTime ?? 60,
        now: new Date(attempt.answeredAt),
      });
      const mistake = attempt.isCorrect
        ? null
        : MistakeRecordSchema.parse({
            id: `mistake:${attempt.id}`,
            userId: attempt.userId,
            attemptId: attempt.id,
            questionId: attempt.questionId,
            topicId: attempt.topicId,
            subject: attempt.subject,
            selectedAnswer: attempt.selectedAnswer,
            correctAnswer: attempt.correctAnswer,
            errorType: attempt.errorType,
            firstSeenAt: attempt.answeredAt,
            lastSeenAt: attempt.answeredAt,
            repeatedAttempts: 1,
            nextReviewAt: new Date(Date.parse(attempt.answeredAt) + 86_400_000).toISOString(),
            resolved: false,
            ...(question ? {
              question: question.question,
              userAnswerText: question.options.find((item) => item.id === attempt.selectedAnswer)?.text ?? "Skipped",
              correctAnswerText: question.options.find((item) => item.id === attempt.correctAnswer)?.text ?? attempt.correctAnswer,
              reason: question.explanation,
              solution: question.shortSolution,
              topic: question.module,
            } : {}),
            version: 1,
            createdAt: attempt.answeredAt,
            updatedAt: attempt.answeredAt,
          });
      const attempts = [...state.attempts, attempt];
      const masteries = { ...state.masteries, [masteryId]: updatedMastery };
      const mistakes = mistake ? { ...state.mistakes, [mistake.id]: mistake } : state.mistakes;
      const activePractice = state.activePractice
        ? { ...state.activePractice, attemptIds: [...state.activePractice.attemptIds, attempt.id] }
        : null;
      set({
        attempts,
        masteries,
        mistakes,
        activePractice,
        metrics: calculateMetrics({
          attempts,
          masteries,
          mistakes,
          timezone: state.profile?.timezone ?? "UTC",
        }),
      });

      await persistAndSync("attempt", attempt, true);
      if (!currentMastery) await persistAndSync("mastery", initialMastery, false);
      await persistAndSync("mastery", updatedMastery, true);
      if (mistake) await persistAndSync("mistake", mistake, true);
    },

    classifyMistake: async (mistakeId, errorType) => {
      ErrorTypeSchema.parse(errorType);
      const current = get().mistakes[mistakeId];
      if (!current) throw new Error("Unknown mistake");
      const now = new Date().toISOString();
      const updated = MistakeRecordSchema.parse({ ...current, errorType, version: current.version + 1, updatedAt: now });
      const mistakes = { ...get().mistakes, [mistakeId]: updated };
      set({
        mistakes,
        metrics: calculateMetrics({
          attempts: get().attempts,
          masteries: get().masteries,
          mistakes,
          timezone: get().profile?.timezone ?? "UTC",
        }),
      });
      await persistAndSync("mistake", updated, true);
    },

    resolveMistake: async (mistakeId) => {
      const current = get().mistakes[mistakeId];
      if (!current) throw new Error("Unknown mistake");
      const now = new Date().toISOString();
      const updated = MistakeRecordSchema.parse({ ...current, resolved: true, version: current.version + 1, updatedAt: now });
      const mistakes = { ...get().mistakes, [mistakeId]: updated };
      set({
        mistakes,
        metrics: calculateMetrics({
          attempts: get().attempts,
          masteries: get().masteries,
          mistakes,
          timezone: get().profile?.timezone ?? "UTC",
        }),
      });
      await persistAndSync("mistake", updated, true);
    },

    toggleBookmark: async (targetType, targetId) => {
      const profile = get().profile;
      if (!profile) throw new Error("A profile is required to manage bookmarks");
      const existing = Object.values(get().bookmarks).find(
        (bookmark) => bookmark.targetType === targetType && bookmark.targetId === targetId,
      );
      if (existing) {
        const bookmarks = { ...get().bookmarks };
        delete bookmarks[existing.id];
        set({ bookmarks });
        await persistence?.remove("bookmark", existing.id, { critical: true });
        await persistence?.syncNow?.();
        return;
      }
      const now = new Date().toISOString();
      const bookmark = BookmarkSchema.parse({
        id: nanoid(),
        userId: profile.uid,
        targetType,
        targetId,
        version: 1,
        createdAt: now,
        updatedAt: now,
      });
      set({ bookmarks: { ...get().bookmarks, [bookmark.id]: bookmark } });
      await persistAndSync("bookmark", bookmark, true);
    },

    saveNote: async (topicId, text) => {
      const profile = get().profile;
      if (!profile) throw new Error("A profile is required to save notes");
      const existing = Object.values(get().notes).find((note) => note.topicId === topicId);
      const now = new Date().toISOString();
      const note = UserNoteSchema.parse({
        id: existing?.id ?? nanoid(),
        userId: profile.uid,
        topicId,
        text,
        version: (existing?.version ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      set({ notes: { ...get().notes, [note.id]: note } });
      await persistAndSync("note", note, false);
    },

    startMock: async (input) => {
      const attempt = MockAttemptSchema.parse(input);
      if (attempt.status !== "in-progress" || attempt.version !== 1) {
        throw new Error("A new mock must be in progress at version 1");
      }
      set({ activeMock: attempt });
      await persistAndSync("mock-attempt", attempt, true);
    },

    recoverMock: (input) => {
      const attempt = MockAttemptSchema.parse(input);
      if (attempt.status !== "in-progress") throw new Error("Only an in-progress mock can be recovered");
      set({ activeMock: attempt });
    },

    answerMockQuestion: async (questionId, selectedAnswer, durationSeconds) => {
      const current = get().activeMock;
      if (!current || current.status !== "in-progress") throw new Error("No active mock");
      const now = new Date().toISOString();
      const existing = current.answers.find((answer) => answer.questionId === questionId);
      const answers = existing
        ? current.answers.map((answer) =>
            answer.questionId === questionId ? { ...answer, selectedAnswer, answeredAt: now, durationSeconds } : answer,
          )
        : [...current.answers, { questionId, selectedAnswer, answeredAt: now, durationSeconds }];
      const updated = MockAttemptSchema.parse({ ...current, answers, version: current.version + 1, updatedAt: now });
      set({ activeMock: updated });
      await persistAndSync("mock-attempt", updated, true);
    },

    toggleMockFlag: async (questionId) => {
      const current = get().activeMock;
      if (!current || current.status !== "in-progress") throw new Error("No active mock");
      const now = new Date().toISOString();
      const flagged = current.flaggedQuestionIds.includes(questionId)
        ? current.flaggedQuestionIds.filter((id) => id !== questionId)
        : [...current.flaggedQuestionIds, questionId];
      const updated = MockAttemptSchema.parse({
        ...current,
        flaggedQuestionIds: flagged,
        version: current.version + 1,
        updatedAt: now,
      });
      set({ activeMock: updated });
      await persistAndSync("mock-attempt", updated, true);
    },

    checkpointMock: async (currentQuestionIndex, remainingSeconds) => {
      const current = get().activeMock;
      if (!current || current.status !== "in-progress") throw new Error("No active mock");
      const now = new Date().toISOString();
      const updated = MockAttemptSchema.parse({
        ...current,
        currentQuestionIndex,
        remainingSeconds,
        version: current.version + 1,
        updatedAt: now,
      });
      set({ activeMock: updated });
      await persistAndSync("mock-attempt", updated, false);
    },

    submitMock: async (resultInput) => {
      const current = get().activeMock;
      if (!current || current.status !== "in-progress") throw new Error("No active mock");
      const result = MockResultSchema.parse(resultInput);
      const now = new Date().toISOString();
      const submitted = MockAttemptSchema.parse({
        ...current,
        status: "submitted",
        submittedAt: now,
        result,
        remainingSeconds: 0,
        version: current.version + 1,
        updatedAt: now,
      });
      set({ activeMock: submitted });
      await persistAndSync("mock-attempt", submitted, true);
    },

    setSyncStatus: (sync) => set({ sync }),

    syncNow: async () => {
      if (!persistence?.syncNow) return;
      set({ sync: { ...get().sync, status: "syncing", error: null } });
      const snapshot = await persistence.syncNow();
      set({ sync: snapshot });
    },

    pauseSync: async () => {
      await persistence?.pauseSync?.();
    },

    resumeSync: () => {
      persistence?.resumeSync?.();
    },
  });
}

export function createAppStore(persistence: StorePersistence | null = null): StoreApi<CscaAppState> {
  return createStore<CscaAppState>(createStateCreator(persistence));
}

export const useAppStore = create<CscaAppState>(createStateCreator());

export const selectProgressMetrics = (state: CscaAppState): ProgressMetrics => state.metrics;
export const selectCurrentQuestion = (state: CscaAppState): Question | null => {
  const session = state.activePractice;
  if (!session) return null;
  const id = session.questionIds[session.currentQuestionIndex];
  return state.questions.find((question) => question.id === id) ?? null;
};
export const selectDueMasteries = (state: CscaAppState, now = new Date()): TopicMastery[] =>
  Object.values(state.masteries)
    .filter((mastery) => Date.parse(mastery.nextReviewAt) <= now.getTime())
    .sort((left, right) => Date.parse(left.nextReviewAt) - Date.parse(right.nextReviewAt));
export const selectSyncLabel = (state: CscaAppState): string => {
  switch (state.sync.status) {
    case "saved":
      return "✓ Saved";
    case "saving":
      return "Saving…";
    case "offline":
      return "Offline — saved locally";
    case "syncing":
      return "Syncing…";
    case "error":
      return "Saved locally — sync needs attention";
  }
};
