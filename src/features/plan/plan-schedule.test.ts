import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyMissedDayChoice,
  calendarDaysUntilExam,
  createStudyPlan,
  currentPlanDay,
  dailyLoadMultiplier,
  dateKeyRange,
  detectMissedDays,
  markDayCompleted,
  markDayPaused,
  migrateLegacyStudyPlan,
  planStatus,
  remainingPlanDays,
  setExamDate,
  setPlanStartDate,
  unacknowledgedMissedDays,
} from './plan-schedule';

const NOW = new Date('2026-09-10T08:00:00.000Z');
const USER = 'user-1';
const base = () => createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 84, now: NOW });

describe('date key helpers', () => {
  it('adds and subtracts days across a month boundary', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('builds an inclusive range and an empty one when reversed', () => {
    expect(dateKeyRange('2026-09-01', '2026-09-03')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(dateKeyRange('2026-09-03', '2026-09-01')).toEqual([]);
    expect(dateKeyRange('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
  });
});

describe('currentPlanDay', () => {
  it('starts at day 1 on the start date and before it', () => {
    expect(currentPlanDay(base(), '2026-09-01')).toBe(1);
    expect(currentPlanDay(base(), '2026-08-20')).toBe(1);
  });

  it('advances with the calendar when nothing was missed', () => {
    let schedule = base();
    for (const dateKey of dateKeyRange('2026-09-01', '2026-09-04')) {
      schedule = markDayCompleted(schedule, dateKey, NOW);
    }
    expect(currentPlanDay(schedule, '2026-09-05')).toBe(5);
  });

  it('never exceeds the plan length', () => {
    expect(currentPlanDay(base(), '2027-09-01')).toBe(84);
  });

  it('does not spend a plan day on an explicitly paused day', () => {
    let schedule = base();
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    schedule = markDayPaused(schedule, '2026-09-02', NOW);
    schedule = markDayCompleted(schedule, '2026-09-03', NOW);
    expect(currentPlanDay(schedule, '2026-09-04')).toBe(3);
  });
});

describe('missed days', () => {
  it('reports days that passed with neither completion nor a pause', () => {
    let schedule = base();
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    schedule = markDayPaused(schedule, '2026-09-02', NOW);
    expect(detectMissedDays(schedule, '2026-09-05')).toEqual(['2026-09-03', '2026-09-04']);
  });

  it('never counts today as missed', () => {
    const schedule = base();
    expect(detectMissedDays(schedule, '2026-09-01')).toEqual([]);
  });

  it('stops at the end of the plan', () => {
    const schedule = createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 3, now: NOW });
    expect(detectMissedDays(schedule, '2026-09-20')).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });
});

describe('missed-day policies', () => {
  const withGap = () => {
    let schedule = base();
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    schedule = markDayCompleted(schedule, '2026-09-02', NOW);
    return schedule; // 03, 04, 05 missed when today is the 6th
  };

  it('shift keeps the learner on the next unfinished plan day', () => {
    const schedule = applyMissedDayChoice(withGap(), 'shift', '2026-09-06', NOW);
    expect(detectMissedDays(schedule, '2026-09-06')).toHaveLength(3);
    expect(currentPlanDay(schedule, '2026-09-06')).toBe(3);
  });

  it('calendar keeps the original dates and drops the missed work', () => {
    const schedule = applyMissedDayChoice(withGap(), 'calendar', '2026-09-06', NOW);
    expect(currentPlanDay(schedule, '2026-09-06')).toBe(6);
  });

  it('redistribute keeps the calendar day but raises the daily load', () => {
    const schedule = applyMissedDayChoice(withGap(), 'redistribute', '2026-09-06', NOW);
    expect(currentPlanDay(schedule, '2026-09-06')).toBe(6);
    expect(dailyLoadMultiplier(schedule, '2026-09-06')).toBeGreaterThan(1);
  });

  it('caps the redistributed load so a long absence stays honest', () => {
    let schedule = createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 10, missedDayPolicy: 'redistribute', now: NOW });
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    expect(dailyLoadMultiplier(schedule, '2026-09-10')).toBeLessThanOrEqual(2);
  });

  it('leaves the load untouched for the other policies', () => {
    expect(dailyLoadMultiplier(applyMissedDayChoice(withGap(), 'shift', '2026-09-06', NOW), '2026-09-06')).toBe(1);
    expect(dailyLoadMultiplier(applyMissedDayChoice(withGap(), 'calendar', '2026-09-06', NOW), '2026-09-06')).toBe(1);
  });

  it('never changes the plan silently: a choice must be recorded first', () => {
    const schedule = withGap();
    expect(unacknowledgedMissedDays(schedule, '2026-09-06')).toHaveLength(3);
    expect(planStatus(schedule, '2026-09-06').needsMissedDayChoice).toBe(true);

    const answered = applyMissedDayChoice(schedule, 'shift', '2026-09-06', NOW);
    expect(unacknowledgedMissedDays(answered, '2026-09-06')).toHaveLength(0);
    expect(planStatus(answered, '2026-09-06').needsMissedDayChoice).toBe(false);
  });

  it('asks again when new days are missed after an earlier answer', () => {
    const answered = applyMissedDayChoice(withGap(), 'shift', '2026-09-06', NOW);
    expect(unacknowledgedMissedDays(answered, '2026-09-09')).toEqual(['2026-09-06', '2026-09-07', '2026-09-08']);
  });
});

describe('completion and pause bookkeeping', () => {
  it('is idempotent and keeps a day in exactly one state', () => {
    let schedule = base();
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    const sameAgain = markDayCompleted(schedule, '2026-09-01', NOW);
    expect(sameAgain).toBe(schedule);

    schedule = markDayPaused(schedule, '2026-09-01', NOW);
    expect(schedule.completedDays).not.toContain('2026-09-01');
    expect(schedule.pausedDays).toContain('2026-09-01');

    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    expect(schedule.pausedDays).not.toContain('2026-09-01');
    expect(schedule.completedDays).toContain('2026-09-01');
  });

  it('bumps the version on every real change and not on a no-op', () => {
    const schedule = base();
    expect(markDayCompleted(schedule, '2026-09-01', NOW).version).toBe(schedule.version + 1);
    expect(setPlanStartDate(schedule, schedule.planStartDate, NOW).version).toBe(schedule.version);
  });
});

describe('exam-date boundaries', () => {
  it('counts calendar days to the exam inclusively and never below zero', () => {
    const schedule = setExamDate(base(), '2026-09-15', NOW);
    expect(calendarDaysUntilExam(schedule, '2026-09-10')).toBe(6);
    expect(calendarDaysUntilExam(schedule, '2026-09-15')).toBe(1);
    expect(calendarDaysUntilExam(schedule, '2026-09-20')).toBe(0);
    expect(calendarDaysUntilExam(base(), '2026-09-10')).toBeNull();
  });

  it('flags a plan that cannot finish before the exam', () => {
    const schedule = setExamDate(createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 84, now: NOW }), '2026-09-20', NOW);
    const status = planStatus(schedule, '2026-09-10');
    expect(status.remainingPlanDays).toBeGreaterThan(status.calendarDaysUntilExam ?? 0);
    expect(status.behindExamDate).toBe(true);
  });

  it('does not flag a plan that still fits', () => {
    const schedule = setExamDate(createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 10, now: NOW }), '2027-01-01', NOW);
    expect(planStatus(schedule, '2026-09-02').behindExamDate).toBe(false);
  });
});

describe('migration from the account-creation model', () => {
  it('keeps the day number a returning learner already saw', () => {
    const schedule = migrateLegacyStudyPlan({
      userId: USER,
      profileCreatedAt: '2026-09-01T22:00:00.000Z',
      timezone: 'Asia/Qyzylorda',
      now: NOW,
    });
    // 22:00 UTC on the 1st is already the 2nd at UTC+5, which is the day the
    // old model would have used as day 1.
    expect(schedule.planStartDate).toBe('2026-09-02');
    expect(schedule.missedDayPolicy).toBe('calendar');
    expect(currentPlanDay(schedule, '2026-09-05')).toBe(4);
  });

  it('falls back to today when the stored timestamp is unusable', () => {
    const schedule = migrateLegacyStudyPlan({
      userId: USER,
      profileCreatedAt: 'not-a-date',
      timezone: 'UTC',
      now: NOW,
    });
    expect(schedule.planStartDate).toBe('2026-09-10');
    expect(currentPlanDay(schedule, '2026-09-10')).toBe(1);
  });

  it('preserves completed days when the start date is moved', () => {
    let schedule = markDayCompleted(base(), '2026-09-02', NOW);
    schedule = setPlanStartDate(schedule, '2026-09-02', NOW);
    expect(schedule.completedDays).toEqual(['2026-09-02']);
    expect(currentPlanDay(schedule, '2026-09-03')).toBe(2);
  });
});

describe('remainingPlanDays', () => {
  it('counts today as remaining and never drops below the final day', () => {
    const schedule = createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 5, missedDayPolicy: 'calendar', now: NOW });
    expect(remainingPlanDays(schedule, '2026-09-01')).toBe(5);
    expect(remainingPlanDays(schedule, '2026-09-05')).toBe(1);
    expect(remainingPlanDays(schedule, '2026-10-05')).toBe(1);
  });

  it('under `shift`, a learner who studied nothing has the whole plan left', () => {
    const schedule = createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 5, missedDayPolicy: 'shift', now: NOW });
    expect(currentPlanDay(schedule, '2026-09-05')).toBe(1);
    expect(remainingPlanDays(schedule, '2026-09-05')).toBe(5);
  });

  it('under `shift`, each completed day consumes exactly one plan day', () => {
    let schedule = createStudyPlan({ userId: USER, planStartDate: '2026-09-01', totalDays: 5, missedDayPolicy: 'shift', now: NOW });
    schedule = markDayCompleted(schedule, '2026-09-01', NOW);
    schedule = markDayCompleted(schedule, '2026-09-03', NOW);
    expect(currentPlanDay(schedule, '2026-09-05')).toBe(3);
    expect(remainingPlanDays(schedule, '2026-09-05')).toBe(3);
  });
});
