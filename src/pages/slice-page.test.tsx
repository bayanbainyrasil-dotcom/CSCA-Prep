import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import SlicePage from '@/pages/slice-page';
import { SLICE_LESSONS } from '@/data/teaching-slices';
import { emptySliceProgress, completeStage, type SliceProgress, type SliceStage } from '@/features/slices/slice-progress';

const MATH_CELL = 'math-linear-isolate-unknown';
const LESSON = SLICE_LESSONS.find((entry) => entry.id === 'lesson-math-linear-isolate-unknown')!;

const auth = { user: { uid: 'learner-1', role: 'user' as 'user' | 'admin' }, isDemo: true };
vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => auth }));

const completeSliceStage = vi.fn<(input: { stage: SliceStage }) => Promise<{ applied: boolean; reason: string | null }>>();
const state: {
  profile: unknown;
  hydrated: boolean;
  sliceProgress: Record<string, SliceProgress>;
  questions: { topicId: string }[];
  completeSliceStage: typeof completeSliceStage;
} = {
  profile: { uid: 'learner-1', settings: { explanationLanguage: 'en' } },
  hydrated: true,
  sliceProgress: {},
  questions: [],
  completeSliceStage,
};
vi.mock('@/stores', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T): T => selector(state),
}));

function renderSlice(cellId = MATH_CELL) {
  const router = createMemoryRouter([{ path: '/slice/:cellId', element: <SlicePage /> }], {
    initialEntries: [`/slice/${cellId}`],
  });
  return render(<RouterProvider router={router} />);
}

function progressWith(stages: SliceStage[]): SliceProgress {
  let progress = emptySliceProgress({ userId: 'learner-1', cellId: MATH_CELL, lessonId: LESSON.id, now: '2026-09-03T09:00:00.000Z' });
  stages.forEach((stage, index) => {
    progress = completeStage(progress, { stage, answered: 0, correct: 0, durationSeconds: 0, now: `2026-09-03T1${index}:00:00.000Z` }).progress;
  });
  return progress;
}

beforeEach(() => {
  vi.clearAllMocks();
  completeSliceStage.mockResolvedValue({ applied: true, reason: null });
  auth.user = { uid: 'learner-1', role: 'user' };
  auth.isDemo = true;
  state.profile = { uid: 'learner-1', settings: { explanationLanguage: 'en' } };
  state.hydrated = true;
  state.sliceProgress = {};
  state.questions = [];
});

afterEach(cleanup);

describe('the trust boundary', () => {
  it('refuses an ordinary learner on a real deployment, without calling it broken', async () => {
    auth.isDemo = false;
    renderSlice();

    expect(await screen.findByRole('heading', { name: 'Coming soon' })).toBeVisible();
    expect(screen.getByText(/waiting for a subject-matter review/i)).toBeVisible();
    // Said twice on purpose: once as the reason, once as the standing rule.
    expect(screen.getAllByText(/Nothing unreviewed is shown as study material/i)).toHaveLength(2);
    expect(screen.queryByRole('heading', { name: /Lesson/ })).toBeNull();
  });

  it('opens for an administrator on a real deployment, labelled as a review preview', async () => {
    auth.isDemo = false;
    auth.user = { uid: 'admin-1', role: 'admin' };
    renderSlice();

    expect(await screen.findByText(/Review preview — awaiting human review/)).toBeVisible();
    expect(screen.getByText(/hidden from learners/i)).toBeVisible();
  });

  it('opens in the demo, labelled as awaiting review', async () => {
    renderSlice();
    expect(await screen.findByText('Awaiting human review')).toBeVisible();
    expect(screen.getByText(/no subject-matter reviewer has read it yet/i)).toBeVisible();
  });

  it('says an unknown cell is not found', async () => {
    renderSlice('no-such-cell');
    expect(await screen.findByRole('heading', { name: 'Not found' })).toBeVisible();
  });
});

describe('the four stages run in order', () => {
  it('starts at the lesson', async () => {
    renderSlice();
    expect(await screen.findByRole('heading', { name: 'Lesson', level: 2 })).toBeVisible();
    expect(screen.getByText('0 / 4')).toBeVisible();
  });

  it('resumes at the first unfinished stage after a reload', async () => {
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson', 'guided']) };
    renderSlice();

    expect(await screen.findByRole('heading', { name: 'Independent practice', level: 2 })).toBeVisible();
    expect(screen.getByText('2 / 4')).toBeVisible();
  });

  it('shows the result screen once every stage is finished', async () => {
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson', 'guided', 'independent', 'timed']) };
    renderSlice();

    expect(await screen.findByRole('heading', { name: 'Slice complete' })).toBeVisible();
    expect(screen.getByText(/record of work done, not a measure of knowledge/i)).toBeVisible();
    expect(screen.getByText(/counts toward no coverage/i)).toBeVisible();
  });

  it('marks the current stage for assistive technology', async () => {
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson']) };
    const { container } = renderSlice();
    await screen.findByRole('heading', { name: 'Guided practice', level: 2 });
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.textContent).toContain('Guided practice');
  });
});

describe('nothing reveals an answer early', () => {
  it('offers hints one at a time in guided practice, and no answer control', async () => {
    const user = userEvent.setup();
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson']) };
    renderSlice();
    await screen.findByRole('heading', { name: 'Guided practice', level: 2 });

    expect(screen.getByText(/The answer is not shown here/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /show (the )?answer|reveal/i })).toBeNull();

    expect(screen.queryByText(/^Hint 1$/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /Show a hint/i }));
    expect(screen.getByText('Hint 1')).toBeVisible();
    expect(screen.queryByText('Hint 2')).toBeNull();
  });

  it('withholds the worked solution in independent practice until submit', async () => {
    const user = userEvent.setup();
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson', 'guided']) };
    renderSlice();
    await screen.findByRole('heading', { name: 'Independent practice', level: 2 });

    expect(screen.getByText(/solution appears only after you submit/i)).toBeVisible();
    expect(screen.queryByText(/worked solution is available/i)).toBeNull();
    expect(screen.getByRole('button', { name: /Finish this step/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    expect(screen.getByText(/worked solution is available/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /Finish this step/i })).toBeEnabled();
  });
});

describe('the timed set', () => {
  it('counts down and finishes itself when the time runs out', async () => {
    vi.useFakeTimers();
    try {
      state.sliceProgress = { [MATH_CELL]: progressWith(['lesson', 'guided', 'independent']) };
      renderSlice();
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: 'Timed set', level: 2 })).toBeVisible());

      expect(screen.getByText(/Time left: 5:00/)).toBeVisible();
      vi.advanceTimersByTime(1000);
      await vi.waitFor(() => expect(screen.getByText(/Time left: 4:59/)).toBeVisible());

      vi.advanceTimersByTime(300_000);
      await vi.waitFor(() => expect(screen.getByText(/Time is up\. Your answers are saved\./)).toBeVisible());
      // Expiry counts as a submission, so the step can be completed.
      expect(screen.getByRole('button', { name: /Finish this step/i })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('a repeated action costs nothing', () => {
  it('records the stage once and reports a refused repeat honestly', async () => {
    const user = userEvent.setup();
    completeSliceStage.mockResolvedValueOnce({ applied: false, reason: 'already-completed' });
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson']) };
    renderSlice();
    await screen.findByRole('heading', { name: 'Guided practice', level: 2 });

    await user.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => expect(screen.getByText(/already recorded\. Nothing was counted twice/i)).toBeVisible());
    expect(completeSliceStage).toHaveBeenCalledTimes(1);
  });

  it('sends the stage the learner is actually on', async () => {
    const user = userEvent.setup();
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson']) };
    renderSlice();
    await screen.findByRole('heading', { name: 'Guided practice', level: 2 });

    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(completeSliceStage).toHaveBeenCalledWith(expect.objectContaining({ stage: 'guided', cellId: MATH_CELL, lessonId: LESSON.id }));
  });
});

describe('language', () => {
  it('renders Russian when that is the explanation language', async () => {
    state.profile = { uid: 'learner-1', settings: { explanationLanguage: 'ru' } };
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson']) };
    renderSlice();

    await screen.findByRole('heading', { name: 'Guided practice', level: 2 });
    expect(screen.getByText(/Подсказки открываются по одной/)).toBeVisible();
    expect(screen.getByRole('button', { name: /Показать подсказку/ })).toBeVisible();
  });

  it('shows both language names for every stage, so the path reads in either', async () => {
    renderSlice();
    await screen.findByRole('heading', { name: 'Lesson', level: 2 });
    for (const label of ['Урок', 'Практика с подсказками', 'Самостоятельная практика', 'Задание на время']) {
      expect(screen.getByText(label), label).toBeVisible();
    }
  });
});

describe('honesty about what this deployment has', () => {
  it('says when the practice items are not bundled rather than inventing one', async () => {
    state.sliceProgress = { [MATH_CELL]: progressWith(['lesson', 'guided']) };
    renderSlice();
    await screen.findByRole('heading', { name: 'Independent practice', level: 2 });

    expect(screen.getByText(/not loaded on this deployment/i)).toBeVisible();
    expect(screen.getByText(/deliberately not part of the browser bundle/i)).toBeVisible();
  });
});
