import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/app/app-shell';
import { ProtectedRoute } from '@/app/protected-route';
import { AuthProvider, createLocalSession, persistLocalSession } from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { Progress } from '@/components/ui/progress';
import DashboardPage from '@/pages/dashboard-page';
import OnboardingPage from '@/pages/onboarding-page';

/**
 * The accessibility properties that are easy to lose in a refactor, checked
 * against the rendered output rather than the source.
 */

function renderShell() {
  const now = new Date();
  const target = new Date(now.getTime() + 84 * 86_400_000).toISOString().slice(0, 10);
  persistLocalSession({ ...createLocalSession(), onboardingCompleted: true, targetDate: target, createdAt: now.toISOString() });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <ProtectedRoute />,
        children: [{ element: <AppShell />, children: [{ index: true, element: <DashboardPage /> }] }],
      },
    ],
    { initialEntries: ['/'] },
  );
  return render(
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>,
  );
}

function renderOnboarding() {
  const router = createMemoryRouter([{ path: '/', element: <OnboardingPage /> }], { initialEntries: ['/'] });
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

describe('landmarks and the skip link', () => {
  it('gives the application one main landmark', () => {
    renderShell();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('puts a skip link first in the tab order, pointing at that landmark', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();

    const skip = screen.getByRole('link', { name: /Skip to main content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(container.querySelector('#main-content')).toBe(screen.getByRole('main'));

    await user.tab();
    expect(skip).toHaveFocus();
  });

  it('gives the onboarding screen its own main landmark', () => {
    renderOnboarding();
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});

describe('progress bars', () => {
  it('carries an accessible name rather than a bare percentage', () => {
    render(<Progress value={40} label="Lesson 40 percent complete" />);
    expect(screen.getByRole('progressbar', { name: 'Lesson 40 percent complete' })).toBeInTheDocument();
  });

  it('names the onboarding progress bar with the step the learner is on', () => {
    renderOnboarding();
    expect(screen.getByRole('progressbar', { name: /Setup step 1 of 5/i })).toBeInTheDocument();
  });
});

describe('validation errors', () => {
  it('moves focus to the control that has to change, and marks it invalid', async () => {
    const user = userEvent.setup();
    renderOnboarding();

    const dateField = screen.getByLabelText('Target CSCA date');
    expect(dateField).toHaveAttribute('aria-invalid', 'false');

    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/Choose today or a future date/i);
    expect(dateField).toHaveFocus();
    expect(dateField).toHaveAttribute('aria-invalid', 'true');
  });

  it('describes the date field, so the constraint is announced with it', () => {
    renderOnboarding();
    const dateField = screen.getByLabelText('Target CSCA date');
    const describedBy = dateField.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(/No date is guessed for you/i);
  });
});
