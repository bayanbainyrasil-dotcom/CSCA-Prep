import { useMemo } from 'react';
import { useAppStore } from '@/stores';
import { dateKeyInTimezone, preparationDay } from '@/lib/date';
import { DEFAULT_TOTAL_DAYS, planStatus, type PlanStatus } from './plan-schedule';

export interface PlanView extends PlanStatus {
  /** The learner's calendar day key, used for every day-scoped action. */
  todayKey: string;
  timezone: string;
  /** False until the stored plan calendar has loaded, which keeps the UI honest. */
  hasPlan: boolean;
}

/**
 * Single source of the preparation day for the whole app.
 *
 * Before the stored plan is available (first paint, or a session that has not
 * hydrated yet) this falls back to the previous account-creation calculation, so
 * the number never jumps for an existing learner, and `hasPlan` says which of the
 * two produced it.
 */
export function usePlanStatus(): PlanView {
  const profile = useAppStore((state) => state.profile);
  const studyPlan = useAppStore((state) => state.studyPlan);

  return useMemo(() => {
    const timezone = profile?.timezone ?? 'UTC';
    const todayKey = dateKeyInTimezone(new Date(), timezone);

    if (!studyPlan) {
      const fallbackDay = preparationDay(
        profile?.createdAt ?? new Date().toISOString(),
        new Date(),
        timezone,
      );
      return {
        todayKey,
        timezone,
        hasPlan: false,
        planDay: fallbackDay,
        totalDays: DEFAULT_TOTAL_DAYS,
        remainingPlanDays: Math.max(0, DEFAULT_TOTAL_DAYS - fallbackDay + 1),
        calendarDaysUntilExam: null,
        missedDays: [],
        needsMissedDayChoice: false,
        dailyLoadMultiplier: 1,
        behindExamDate: false,
      };
    }

    return { todayKey, timezone, hasPlan: true, ...planStatus(studyPlan, todayKey) };
  }, [profile, studyPlan]);
}
