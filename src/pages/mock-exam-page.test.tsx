import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AuthProvider, createLocalSession, persistLocalSession } from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { isServerMockAvailable } from '@/features/mock/mock-service';
import MockExamPage from './mock-exam-page';
import MockResultsPage from './mock-results-page';

function renderAt(path: string) {
  persistLocalSession({ ...createLocalSession(), onboardingCompleted: true });
  const router = createMemoryRouter(
    [
      { path: '/mock/:subject/active', element: <MockExamPage /> },
      { path: '/mock/:subject/results', element: <MockResultsPage /> },
      { path: '/mock', element: <div>Mock index</div> },
    ],
    { initialEntries: [path] },
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

describe('mock routes in local-demo mode', () => {
  it('reports that the trusted mock service is unavailable in this build', () => {
    expect(isServerMockAvailable()).toBe(false);
  });

  it('still runs the built-in mock and labels it a local demo', () => {
    renderAt('/mock/physics/active');

    expect(screen.getByRole('button', { name: /Start exam/i })).toBeVisible();
    expect(screen.getAllByText('Local demo').length).toBeGreaterThan(0);
    expect(screen.getByText(/generated in your browser/i)).toBeVisible();
  });

  it('falls back to the labelled demo when a server exam is requested but unavailable', () => {
    renderAt('/mock/physics/active?exam=mock-physics-1');

    expect(screen.getByRole('button', { name: /Start exam/i })).toBeVisible();
    expect(screen.getAllByText('Local demo').length).toBeGreaterThan(0);
  });

  it('does not treat a demo result as a server-graded one', () => {
    renderAt('/mock/physics/results?attempt=attempt-1');

    // No local result was stored, so the demo empty state shows rather than a
    // server review, because the trusted service is not configured here.
    expect(screen.getByText('No submitted mock found.')).toBeVisible();
  });
});
