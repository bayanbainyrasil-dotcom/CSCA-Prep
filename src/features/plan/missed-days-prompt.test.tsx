import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAppStore } from '@/stores';
import { UserProfileSchema, UserSettingsSchema } from '@/domain';
import { createStudyPlan, currentPlanDay, markDayCompleted } from './plan-schedule';
import { MissedDaysPrompt } from './missed-days-prompt';

const USER = 'user-1';

function seed(options: { completeThrough?: string } = {}) {
  const now = new Date().toISOString();
  const timezone = 'UTC';
  const profile = UserProfileSchema.parse({
    uid: USER,
    name: 'Learner',
    email: null,
    photoURL: null,
    createdAt: now,
    lastActiveAt: now,
    role: 'user',
    timezone,
    targetExam: 'CSCA',
    targetDate: null,
    preferredLanguage: 'en',
    onboardingCompleted: true,
    settings: UserSettingsSchema.parse({}),
    version: 1,
    updatedAt: now,
  });

  // A plan that started 5 days ago in the learner's timezone.
  const start = new Date(Date.now() - 5 * 86_400_000).toISOString().slice(0, 10);
  let plan = createStudyPlan({ userId: USER, planStartDate: start, totalDays: 84 });
  if (options.completeThrough) plan = markDayCompleted(plan, options.completeThrough);

  useAppStore.setState({ profile, studyPlan: plan, hydrated: true });
  return plan;
}

afterEach(() => {
  cleanup();
  useAppStore.getState().resetUserState();
  useAppStore.setState({ studyPlan: null });
});

describe('missed-days prompt', () => {
  it('stays hidden when there is no plan', () => {
    useAppStore.setState({ studyPlan: null });
    const { container } = render(<MissedDaysPrompt />);
    expect(container).toBeEmptyDOMElement();
  });

  it('asks about the gap and changes nothing until an answer is given', () => {
    const plan = seed();
    render(<MissedDaysPrompt />);

    expect(screen.getByText(/study days passed without work/i)).toBeVisible();
    expect(screen.getByText(/Nothing has been changed yet/i)).toBeVisible();
    expect(useAppStore.getState().studyPlan).toBe(plan);
  });

  it('offers all three choices with their consequences spelled out', () => {
    seed();
    render(<MissedDaysPrompt />);

    expect(screen.getByRole('button', { name: /Move the plan forward/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Keep my finish date/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /Skip what I missed/i })).toBeVisible();
  });

  it('records the choice and stops asking about the same days', async () => {
    seed();
    const user = userEvent.setup();
    render(<MissedDaysPrompt />);

    await user.click(screen.getByRole('button', { name: /Move the plan forward/i }));

    await waitFor(() => {
      expect(useAppStore.getState().studyPlan?.missedDayPolicy).toBe('shift');
    });
    const updated = useAppStore.getState().studyPlan!;
    expect(updated.acknowledgedMissedDays.length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.queryByText(/passed without work/i)).toBeNull());
  });

  it('shift keeps the learner on their next unfinished day', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    seed();
    const user = userEvent.setup();
    render(<MissedDaysPrompt />);

    await user.click(screen.getByRole('button', { name: /Move the plan forward/i }));
    await waitFor(() => expect(useAppStore.getState().studyPlan?.missedDayPolicy).toBe('shift'));

    expect(currentPlanDay(useAppStore.getState().studyPlan!, todayKey)).toBe(1);
  });

  it('skip keeps the calendar day', async () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    seed();
    const user = userEvent.setup();
    render(<MissedDaysPrompt />);

    await user.click(screen.getByRole('button', { name: /Skip what I missed/i }));
    await waitFor(() => expect(useAppStore.getState().studyPlan?.missedDayPolicy).toBe('calendar'));

    expect(currentPlanDay(useAppStore.getState().studyPlan!, todayKey)).toBe(6);
  });
});
