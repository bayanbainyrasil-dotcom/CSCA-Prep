import { StudyPlanSchema, type MissedDayPolicy, type StudyPlan } from '@/domain';
import { calendarDayDifference, dateKeyInTimezone } from '@/lib/date';

/**
 * Plan scheduling.
 *
 * The preparation day used to be derived from the account creation timestamp,
 * which meant a learner who signed up to look around, or who paused for a week,
 * silently lost days they never studied. This module makes the plan start an
 * explicit date and makes every day that did not happen an explicit, learner-
 * visible decision.
 *
 * Everything here is pure and works on `YYYY-MM-DD` keys already resolved in the
 * learner's timezone, so a device that travels between zones cannot shift a day
 * boundary by arithmetic alone.
 */

export const DEFAULT_TOTAL_DAYS = 84;

/** Every learner has exactly one plan calendar, so the id is derived, not random. */
export const studyPlanId = (userId: string) => `study-plan:${userId}`;

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function daysBetween(from: string, to: string): number {
  return calendarDayDifference(from, to) ?? 0;
}

export function addDays(dateKey: string, days: number): string {
  const [year = '1970', month = '01', day = '01'] = dateKey.split('-');
  const base = Date.UTC(Number(year), Number(month) - 1, Number(day));
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10);
}

/** Every date key from `from` to `to`, inclusive. Empty when `to` precedes `from`. */
export function dateKeyRange(from: string, to: string): string[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addDays(from, index));
}

export interface CreateStudyPlanInput {
  userId: string;
  planStartDate: string;
  totalDays?: number;
  examDate?: string | null;
  missedDayPolicy?: MissedDayPolicy;
  now?: Date;
}

export function createStudyPlan({
  userId,
  planStartDate,
  totalDays = DEFAULT_TOTAL_DAYS,
  examDate = null,
  missedDayPolicy = 'shift',
  now = new Date(),
}: CreateStudyPlanInput): StudyPlan {
  const timestamp = now.toISOString();
  return StudyPlanSchema.parse({
    id: studyPlanId(userId),
    userId,
    planStartDate,
    totalDays,
    completedDays: [],
    pausedDays: [],
    missedDayPolicy,
    acknowledgedMissedDays: [],
    examDate,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/**
 * Builds a schedule for a learner who already has progress recorded against the
 * old account-creation model. The start date is their account creation day, so
 * the day number they saw yesterday is the day number they see today; nothing
 * they have already done is invalidated.
 */
export function migrateLegacyStudyPlan(input: {
  userId: string;
  profileCreatedAt: string;
  timezone: string;
  examDate?: string | null;
  totalDays?: number;
  now?: Date;
}): StudyPlan {
  const created = new Date(input.profileCreatedAt);
  const now = input.now ?? new Date();
  const startSource = Number.isFinite(created.getTime()) ? created : now;
  return createStudyPlan({
    userId: input.userId,
    planStartDate: dateKeyInTimezone(startSource, input.timezone),
    totalDays: input.totalDays ?? DEFAULT_TOTAL_DAYS,
    examDate: input.examDate ?? null,
    // Preserving the previous behaviour on migration: the old model advanced with
    // the calendar. The learner chooses a different policy the first time a
    // missed day is detected.
    missedDayPolicy: 'calendar',
    now,
  });
}

/** Days that have already passed with neither completion nor an explicit pause. */
export function detectMissedDays(schedule: StudyPlan, todayKey: string): string[] {
  const yesterday = addDays(todayKey, -1);
  if (daysBetween(schedule.planStartDate, yesterday) < 0) return [];

  const completed = new Set(schedule.completedDays);
  const paused = new Set(schedule.pausedDays);
  const lastScheduled = addDays(schedule.planStartDate, schedule.totalDays - 1);
  const end = daysBetween(yesterday, lastScheduled) < 0 ? lastScheduled : yesterday;

  return dateKeyRange(schedule.planStartDate, end).filter(
    (dateKey) => !completed.has(dateKey) && !paused.has(dateKey),
  );
}

/** Missed days the learner has not yet been asked about. */
export function unacknowledgedMissedDays(schedule: StudyPlan, todayKey: string): string[] {
  const acknowledged = new Set(schedule.acknowledgedMissedDays);
  return detectMissedDays(schedule, todayKey).filter((dateKey) => !acknowledged.has(dateKey));
}

/**
 * The plan day shown to the learner.
 *
 * `calendar` counts elapsed days minus explicit pauses. `shift` also refuses to
 * spend a plan day on a day that was missed, so the plan follows the learner
 * rather than running ahead of them. `redistribute` keeps calendar dates, so its
 * day number matches `calendar`; the difference shows up in the daily load.
 */
export function currentPlanDay(schedule: StudyPlan, todayKey: string): number {
  const elapsed = daysBetween(schedule.planStartDate, todayKey);
  if (elapsed < 0) return 1;

  const window = new Set(dateKeyRange(schedule.planStartDate, addDays(todayKey, -1)));
  const paused = schedule.pausedDays.filter((dateKey) => window.has(dateKey)).length;
  const skipped =
    schedule.missedDayPolicy === 'shift' ? detectMissedDays(schedule, todayKey).length : 0;

  return Math.max(1, Math.min(schedule.totalDays, elapsed + 1 - paused - skipped));
}

/** Plan days that still have to happen, today included. */
export function remainingPlanDays(schedule: StudyPlan, todayKey: string): number {
  return Math.max(0, schedule.totalDays - currentPlanDay(schedule, todayKey) + 1);
}

/** Calendar days left before the exam, today included. `null` when no exam date is set. */
export function calendarDaysUntilExam(schedule: StudyPlan, todayKey: string): number | null {
  if (!schedule.examDate) return null;
  return Math.max(0, daysBetween(todayKey, schedule.examDate) + 1);
}

/**
 * How much heavier each remaining day becomes under `redistribute`. Capped so a
 * long absence cannot present an impossible day as if it were a normal one.
 */
export function dailyLoadMultiplier(schedule: StudyPlan, todayKey: string, cap = 2): number {
  if (schedule.missedDayPolicy !== 'redistribute') return 1;
  const remaining = remainingPlanDays(schedule, todayKey);
  if (remaining <= 0) return 1;
  const missed = detectMissedDays(schedule, todayKey).length;
  if (missed === 0) return 1;
  return Math.min(cap, Math.round(((remaining + missed) / remaining) * 100) / 100);
}

function touch(schedule: StudyPlan, changes: Partial<StudyPlan>, now: Date): StudyPlan {
  return StudyPlanSchema.parse({
    ...schedule,
    ...changes,
    version: schedule.version + 1,
    updatedAt: now.toISOString(),
  });
}

export function markDayCompleted(schedule: StudyPlan, dateKey: string, now = new Date()): StudyPlan {
  if (schedule.completedDays.includes(dateKey)) return schedule;
  return touch(
    schedule,
    {
      completedDays: unique([...schedule.completedDays, dateKey]),
      pausedDays: schedule.pausedDays.filter((value) => value !== dateKey),
    },
    now,
  );
}

export function markDayPaused(schedule: StudyPlan, dateKey: string, now = new Date()): StudyPlan {
  if (schedule.pausedDays.includes(dateKey)) return schedule;
  return touch(
    schedule,
    {
      pausedDays: unique([...schedule.pausedDays, dateKey]),
      completedDays: schedule.completedDays.filter((value) => value !== dateKey),
    },
    now,
  );
}

/**
 * Records the learner's answer to the missed-day question. The days that
 * prompted it are acknowledged either way, so the same question is not asked
 * again for the same days — but the policy itself stays changeable.
 */
export function applyMissedDayChoice(
  schedule: StudyPlan,
  choice: MissedDayPolicy,
  todayKey: string,
  now = new Date(),
): StudyPlan {
  const missed = detectMissedDays(schedule, todayKey);
  return touch(
    schedule,
    {
      missedDayPolicy: choice,
      acknowledgedMissedDays: unique([...schedule.acknowledgedMissedDays, ...missed]),
    },
    now,
  );
}

/** Moves the plan start without losing which days were completed or paused. */
export function setPlanStartDate(schedule: StudyPlan, planStartDate: string, now = new Date()): StudyPlan {
  if (planStartDate === schedule.planStartDate) return schedule;
  return touch(schedule, { planStartDate }, now);
}

export function setExamDate(schedule: StudyPlan, examDate: string | null, now = new Date()): StudyPlan {
  if (examDate === schedule.examDate) return schedule;
  return touch(schedule, { examDate }, now);
}

export interface PlanStatus {
  planDay: number;
  totalDays: number;
  remainingPlanDays: number;
  calendarDaysUntilExam: number | null;
  missedDays: string[];
  needsMissedDayChoice: boolean;
  dailyLoadMultiplier: number;
  /** True when the plan cannot finish before the exam at the current pace. */
  behindExamDate: boolean;
}

export function planStatus(schedule: StudyPlan, todayKey: string): PlanStatus {
  const remaining = remainingPlanDays(schedule, todayKey);
  const untilExam = calendarDaysUntilExam(schedule, todayKey);
  return {
    planDay: currentPlanDay(schedule, todayKey),
    totalDays: schedule.totalDays,
    remainingPlanDays: remaining,
    calendarDaysUntilExam: untilExam,
    missedDays: detectMissedDays(schedule, todayKey),
    needsMissedDayChoice: unacknowledgedMissedDays(schedule, todayKey).length > 0,
    dailyLoadMultiplier: dailyLoadMultiplier(schedule, todayKey),
    behindExamDate: untilExam !== null && remaining > untilExam,
  };
}
