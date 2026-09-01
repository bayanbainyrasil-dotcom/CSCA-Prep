import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { ProtectedRoute } from '@/app/protected-route';
import { AuthProvider, createLocalSession, persistLocalSession } from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import AdminPage from '@/pages/admin-page';
import DashboardPage from '@/pages/dashboard-page';
import MockPage from '@/pages/mock-page';
import PracticePage from '@/pages/practice-page';
import PracticeSessionPage from '@/pages/practice-session-page';

function renderRoute(initialEntry: string) {
  const now = new Date();
  const target = new Date(now.getTime() + 84 * 86_400_000).toISOString().slice(0, 10);
  persistLocalSession({ ...createLocalSession(), onboardingCompleted: true, targetDate: target, createdAt: now.toISOString() });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'practice', element: <PracticePage /> },
              { path: 'practice/session', element: <PracticeSessionPage /> },
              { path: 'mock', element: <MockPage /> },
              { path: 'admin', element: <AdminPage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

  return render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('key application routes', () => {
  it('renders the protected dashboard with recorded values and navigates to practice', async () => {
    const user = userEvent.setup();
    renderRoute('/');

    expect(screen.getByRole('heading', { name: /Good (morning|afternoon|evening), Nurasyl/i })).toBeInTheDocument();
    expect(screen.queryByText(/Demo progress/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Internal CSCA readiness score 0 percent')).toBeInTheDocument();

    const mobileNavigation = screen.getByRole('navigation', { name: 'Mobile navigation' });
    await user.click(within(mobileNavigation).getByRole('link', { name: 'Start practice' }));

    expect(await screen.findByRole('heading', { name: 'Train the exact failure point.' }))
      .toBeInTheDocument();
    // With no recorded attempts there is nothing to recommend from, so the page
    // suggests a first session rather than claiming a weak-topic recommendation.
    expect(screen.getByRole('link', { name: /Start suggested session/i })).toHaveAttribute(
      'href',
      '/practice/session?mode=learn',
    );
    expect(screen.getByRole('heading', { name: 'Start with a first session' })).toBeInTheDocument();
    expect(screen.getByText(/Nothing has been measured yet/i)).toBeInTheDocument();
    expect(screen.getByText('None due')).toBeInTheDocument();
    expect(screen.getByText('Needs practice data')).toBeInTheDocument();
  });

  it('enforces the understand-answer-confidence-feedback sequence', async () => {
    const user = userEvent.setup();
    renderRoute('/practice/session?mode=practice');

    const unlock = screen.getByRole('button', { name: /Unlock answer choices/i });
    expect(unlock).toBeDisabled();

    for (const legend of [
      'What is given?',
      'What are you asked to find?',
      'Which topic is this?',
      'Which relationship could help?',
    ]) {
      const group = screen.getByRole('group', { name: legend });
      await user.click(within(group).getAllByRole('button')[0]!);
    }

    expect(unlock).toBeEnabled();
    await user.click(unlock);

    const choices = screen.getAllByRole('button').filter((button) =>
      /^[A-D]\./.test(button.textContent?.trim() ?? ''),
    );
    expect(choices).toHaveLength(4);
    await user.click(choices[0]!);

    expect(screen.getByText('How sure were you?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sure' }));

    expect(screen.getByRole('heading', { name: /Correct reasoning|lost point/i }))
      .toBeInTheDocument();
    expect(screen.getByText(/Short solution:/i)).toBeInTheDocument();
  });

  it('exposes both mock routes and marks them a local demo without a trusted service', () => {
    renderRoute('/mock');

    expect(screen.getByRole('heading', { name: 'Prove what survives under time.' }))
      .toBeInTheDocument();
    // Without a configured Firebase deployment there is no server to own timing
    // or grading, so every built-in mock is labelled as a device-scored demo.
    expect(screen.getAllByText('Local demo').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/generated in your browser from open templates/i))
      .toBeInTheDocument();
    const examLinks = screen.getAllByRole('link', { name: /Review instructions & start/i });
    expect(examLinks.map((link) => link.getAttribute('href'))).toEqual([
      '/mock/mathematics/active',
      '/mock/physics/active',
    ]);
  });

  it('keeps cloud administration unavailable in on-device mode', () => {
    renderRoute('/admin');

    expect(screen.getByRole('heading', { name: 'Cloud administration is unavailable' }))
      .toBeInTheDocument();
    expect(screen.getByText('No client-side password or administrator bypass is available.'))
      .toBeInTheDocument();
    expect(screen.queryByLabelText('Initial setup code')).not.toBeInTheDocument();
  });
});
