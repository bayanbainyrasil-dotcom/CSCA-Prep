import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { DEMO_LESSONS } from '@/data/seed';
import {
  AuthProvider,
  createLocalSession,
  persistLocalSession,
} from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { useAppStore } from '@/stores';
import LessonPage from './lesson-page';

function renderLesson(path: string) {
  persistLocalSession({ ...createLocalSession(), onboardingCompleted: true });
  useAppStore.getState().loadContent({ lessons: DEMO_LESSONS });
  const router = createMemoryRouter([
    { path: '/lesson/:lessonId', element: <LessonPage /> },
    { path: '/learn', element: <div>Learning hub</div> },
  ], { initialEntries: [path] });

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
  useAppStore.getState().loadContent({ lessons: [] });
});

describe('lesson page', () => {
  it('renders the published constant-speed demo lesson for its route', () => {
    renderLesson('/lesson/lesson-physics-constant-speed-demo');

    expect(screen.getByRole('heading', { name: 'Distance at Constant Speed' }))
      .toBeInTheDocument();
    expect(screen.getAllByText('Speed tells you how much distance is covered in one unit of time.'))
      .toHaveLength(2);
    expect(screen.queryByRole('heading', { name: 'Newton’s second law' }))
      .not.toBeInTheDocument();
  });

  it('shows an unavailable state for an unknown lesson route', () => {
    renderLesson('/lesson/unknown-lesson');

    expect(screen.getByRole('heading', { name: 'This lesson is not available.' }))
      .toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to learning hub' }))
      .toHaveAttribute('href', '/learn');
  });
});
