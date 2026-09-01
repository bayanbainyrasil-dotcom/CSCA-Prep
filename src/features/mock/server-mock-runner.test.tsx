import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';

const startServerMockExam = vi.fn();
const resumeServerMockExam = vi.fn();
const saveServerMockAnswer = vi.fn();
const submitServerMockExam = vi.fn();
const reviewServerMockExam = vi.fn();

import type * as MockServiceModule from '@/features/mock/mock-service';

vi.mock('@/features/mock/mock-service', async (importOriginal) => {
  const actual = await importOriginal<typeof MockServiceModule>();
  return {
    ...actual,
    isServerMockAvailable: () => true,
    listPublishedMockExams: vi.fn().mockResolvedValue([]),
    startServerMockExam: (...args: unknown[]) => startServerMockExam(...args) as unknown,
    resumeServerMockExam: (...args: unknown[]) => resumeServerMockExam(...args) as unknown,
    saveServerMockAnswer: (...args: unknown[]) => saveServerMockAnswer(...args) as unknown,
    submitServerMockExam: (...args: unknown[]) => submitServerMockExam(...args) as unknown,
    reviewServerMockExam: (...args: unknown[]) => reviewServerMockExam(...args) as unknown,
  };
});

const { ServerMockRunner, attemptPointerKey } = await import('@/features/mock/server-mock-runner');
const { ServerMockResults } = await import('@/features/mock/server-mock-results');

const OWNER = 'user-1';
const EXAM = 'mock-physics-1';

function attemptFixture(overrides: Record<string, unknown> = {}) {
  return {
    attemptId: 'attempt-1',
    mockExamId: EXAM,
    subject: 'physics' as const,
    status: 'in-progress' as const,
    startedAt: '2026-09-01T10:00:00.000Z',
    durationSeconds: 3_600,
    remainingSeconds: 3_500,
    currentQuestionIndex: 0,
    flaggedQuestionIds: [] as string[],
    answers: [] as { questionId: string; selectedAnswer: string | null }[],
    questions: [
      {
        id: 'q1',
        subject: 'physics' as const,
        module: 'Mechanics',
        topicId: 'mech-newton-2',
        skill: "Newton's second law",
        difficulty: 3,
        language: 'en',
        question: 'A 2 kg trolley accelerates at 3 m/s^2. What is the resultant force?',
        options: [
          { id: 'a', text: '6 N' },
          { id: 'b', text: '1.5 N' },
        ],
        estimatedTime: 75,
      },
      {
        id: 'q2',
        subject: 'physics' as const,
        module: 'Mechanics',
        topicId: 'mech-newton-2',
        skill: "Newton's second law",
        difficulty: 2,
        language: 'en',
        question: 'What is the unit of force?',
        options: [
          { id: 'a', text: 'newton' },
          { id: 'b', text: 'joule' },
        ],
        estimatedTime: 40,
      },
    ],
    ...overrides,
  };
}

function renderRunner() {
  const router = createMemoryRouter(
    [
      { path: '/mock/physics/active', element: <ServerMockRunner ownerId={OWNER} mockExamId={EXAM} deviceId="device-1" /> },
      { path: '/mock/:subject/results', element: <div>Results route</div> },
      { path: '/mock', element: <div>Mock index</div> },
    ],
    { initialEntries: ['/mock/physics/active'] },
  );
  return render(<RouterProvider router={router} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  saveServerMockAnswer.mockResolvedValue({ changed: true, answeredCount: 1, remainingSeconds: 3_490 });
  submitServerMockExam.mockResolvedValue({
    alreadySubmitted: false,
    status: 'submitted',
    submittedAt: '2026-09-01T11:00:00.000Z',
    result: { correct: 1, wrong: 1, skipped: 0, accuracy: 0.5, averageTimeSeconds: 20, topicScores: {} },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('production mock runner', () => {
  it('never receives or renders an answer key while the attempt is open', async () => {
    startServerMockExam.mockResolvedValue({ resumed: false, attempt: attemptFixture() });
    const user = userEvent.setup();
    const { container } = renderRunner();

    await user.click(screen.getByRole('button', { name: /Start exam/i }));
    await screen.findByText(/resultant force/i);

    // Nothing the server sent, and nothing rendered, mentions a solution.
    const rendered = container.innerHTML;
    for (const leak of ['correctAnswer', 'shortSolution', 'explanation', 'isCorrect']) {
      expect(rendered).not.toContain(leak);
    }
    const startPayload = JSON.stringify(startServerMockExam.mock.calls);
    expect(startPayload).not.toContain('correctAnswer');
  });

  it('sends the selection to the server and shows the saving state', async () => {
    startServerMockExam.mockResolvedValue({ resumed: false, attempt: attemptFixture() });
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole('button', { name: /Start exam/i }));
    await screen.findByText(/resultant force/i);
    await user.click(screen.getByRole('button', { name: /6 N/ }));

    await waitFor(() => expect(saveServerMockAnswer).toHaveBeenCalledTimes(1));
    const call = saveServerMockAnswer.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call.questionId).toBe('q1');
    expect(call.selectedAnswer).toBe('a');
    expect(typeof call.mutationId).toBe('string');
    // The client never sends anything the server owns.
    expect(call).not.toHaveProperty('status');
    expect(call).not.toHaveProperty('result');
    expect(call).not.toHaveProperty('durationSeconds');
    expect(call).not.toHaveProperty('questionIds');
  });

  it('offers a retry and reuses the same mutation id when a save fails', async () => {
    startServerMockExam.mockResolvedValue({ resumed: false, attempt: attemptFixture() });
    saveServerMockAnswer.mockRejectedValueOnce({ code: 'functions/unavailable' });
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole('button', { name: /Start exam/i }));
    await screen.findByText(/resultant force/i);
    await user.click(screen.getByRole('button', { name: /6 N/ }));

    const retry = await screen.findByRole('button', { name: /Retry/i });
    await user.click(retry);

    await waitFor(() => expect(saveServerMockAnswer).toHaveBeenCalledTimes(2));
    const first = saveServerMockAnswer.mock.calls[0]?.[0] as { mutationId: string };
    const second = saveServerMockAnswer.mock.calls[1]?.[0] as { mutationId: string };
    expect(second.mutationId).toBe(first.mutationId);
  });

  it('restores an attempt from the server, not from the device', async () => {
    localStorage.setItem(attemptPointerKey(OWNER, EXAM), 'attempt-1');
    resumeServerMockExam.mockResolvedValue({
      expired: false,
      attempt: attemptFixture({
        answers: [{ questionId: 'q1', selectedAnswer: 'a' }],
        flaggedQuestionIds: ['q1'],
        currentQuestionIndex: 0,
        remainingSeconds: 1_200,
      }),
    });

    renderRunner();

    await screen.findByText(/Attempt restored from the server/i);
    expect(resumeServerMockExam).toHaveBeenCalledWith({ attemptId: 'attempt-1' });
    expect(startServerMockExam).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Flagged' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Question 1, answered, flagged' })).toBeVisible();
    expect(screen.getByText('20:00')).toBeVisible();
  });

  it('reuses one submit mutation id across retries so a repeat submit cannot regrade', async () => {
    startServerMockExam.mockResolvedValue({ resumed: false, attempt: attemptFixture() });
    submitServerMockExam.mockRejectedValueOnce({ code: 'functions/unavailable' });
    const user = userEvent.setup();
    renderRunner();

    await user.click(screen.getByRole('button', { name: /Start exam/i }));
    await screen.findByText(/resultant force/i);

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: /Submit exam/i }));
    await waitFor(() => expect(submitServerMockExam).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await user.click(await screen.findByRole('button', { name: /Submit exam/i }));
    await waitFor(() => expect(submitServerMockExam).toHaveBeenCalledTimes(2));

    const first = submitServerMockExam.mock.calls[0]?.[0] as { mutationId: string };
    const second = submitServerMockExam.mock.calls[1]?.[0] as { mutationId: string };
    expect(second.mutationId).toBe(first.mutationId);
  });

  it('shows a readable message and no internal detail when the service fails', async () => {
    startServerMockExam.mockRejectedValue({
      code: 'functions/internal',
      message: 'FIRESTORE users/user-1/examAttempts internal assertion failed',
    });
    const user = userEvent.setup();
    const { container } = renderRunner();

    await user.click(screen.getByRole('button', { name: /Start exam/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/exam service is unreachable/i);
    expect(container.innerHTML).not.toContain('assertion failed');
    expect(container.innerHTML).not.toContain('examAttempts');
  });
});

describe('production mock review', () => {
  function renderResults() {
    const router = createMemoryRouter(
      [
        { path: '/results', element: <ServerMockResults attemptId="attempt-1" /> },
        { path: '/mock', element: <div>Mock index</div> },
      ],
      { initialEntries: ['/results'] },
    );
    return render(<RouterProvider router={router} />);
  }

  it('renders only what the server graded', async () => {
    reviewServerMockExam.mockResolvedValue({
      attemptId: 'attempt-1',
      subject: 'physics',
      submittedAt: '2026-09-01T11:00:00.000Z',
      result: { correct: 1, wrong: 1, skipped: 0, accuracy: 0.5, averageTimeSeconds: 20, topicScores: { 'mech-newton-2': 0.5 } },
      questions: [
        {
          questionId: 'q1',
          prompt: null,
          selectedAnswer: 'a',
          durationSeconds: 20,
          correctAnswer: 'a',
          isCorrect: true,
          shortSolution: '6 N',
          solution: 'F = ma',
          explanation: 'Newton II',
          commonMistakes: [],
        },
      ],
    });

    renderResults();

    expect(await screen.findByText(/50% · 1 of 2 correct/)).toBeVisible();
    expect(screen.getByText('Server-graded')).toBeVisible();
    expect(screen.getByText('6 N')).toBeVisible();
  });

  it('refuses to show a review before the attempt is finalized', async () => {
    reviewServerMockExam.mockRejectedValue({ code: 'functions/failed-precondition' });
    renderResults();

    expect(await screen.findByRole('alert')).toHaveTextContent(/no longer be changed|not available/i);
    expect(screen.getByText(/Solutions and scores appear once an attempt has been submitted/i)).toBeVisible();
  });
});
