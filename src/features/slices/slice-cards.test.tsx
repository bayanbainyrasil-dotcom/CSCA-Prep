import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SLICE_LESSONS, SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';
import { SliceCards } from './slice-cards';
import { completeStage, emptySliceProgress, type SliceProgress, type SliceStage } from './slice-progress';

const MATH_CELL = 'math-linear-isolate-unknown';
const PHYSICS_CELL = 'phys-thermodynamics-heat-transfer';
/**
 * Counts come from the authored content, not from a literal. A new slice is a
 * content change; having it fail eight rendering tests taught nothing.
 */
const SLICES = SLICE_LESSONS.length;

/** The card for one cell, found by its link or its heading rather than by index. */
function cardFor(cellId: string): HTMLElement {
  const lesson = SLICE_LESSONS.find((entry) => SLICE_LESSON_CELL_IDS[entry.id] === cellId);
  const cards = screen.getAllByRole('listitem');
  const found = cards.find((card) => within(card).queryByText(lesson?.title.en ?? '') !== null);
  if (!found) throw new Error(`No card rendered for ${cellId}`);
  return found;
}

function progressWith(cellId: string, stages: SliceStage[]): SliceProgress {
  let progress = emptySliceProgress({ userId: 'learner-1', cellId, lessonId: `lesson-${cellId}`, now: '2026-09-03T09:00:00.000Z' });
  stages.forEach((stage, index) => {
    progress = completeStage(progress, { stage, answered: 0, correct: 0, durationSeconds: 0, now: `2026-09-03T1${index}:00:00.000Z` }).progress;
  });
  return progress;
}

function renderCards(props: Partial<Parameters<typeof SliceCards>[0]> = {}) {
  return render(
    <MemoryRouter>
      <SliceCards progress={{}} isDemo role="user" {...props} />
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('what each card says', () => {
  it('shows every authored slice, each labelled with its own subject', () => {
    renderCards();
    expect(screen.getAllByRole('listitem')).toHaveLength(SLICES);
    for (const lesson of SLICE_LESSONS) {
      const card = cardFor(SLICE_LESSON_CELL_IDS[lesson.id]!);
      const subject = lesson.subject === 'physics' ? 'Physics' : 'Mathematics';
      expect(within(card).getByText(subject), lesson.id).toBeVisible();
    }
  });

  it('reports not started, in progress with the stage, and completed', () => {
    const { rerender } = renderCards();
    expect(screen.getAllByText('Not started')).toHaveLength(SLICES);

    rerender(
      <MemoryRouter>
        <SliceCards progress={{ [MATH_CELL]: progressWith(MATH_CELL, ['lesson']) }} isDemo role="user" />
      </MemoryRouter>,
    );
    expect(screen.getByText('In progress · Guided practice')).toBeVisible();
    expect(screen.getByText('1 of 4 steps')).toBeVisible();

    rerender(
      <MemoryRouter>
        <SliceCards
          progress={{ [MATH_CELL]: progressWith(MATH_CELL, ['lesson', 'guided', 'independent', 'timed']) }}
          isDemo
          role="user"
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Completed')).toBeVisible();
    expect(screen.getByText('4 of 4 steps')).toBeVisible();
  });

  it('links each card to its own slice route by cell id', () => {
    renderCards();
    // Every card says "Start", so each link is read from its own card.
    for (const lesson of SLICE_LESSONS) {
      const cellId = SLICE_LESSON_CELL_IDS[lesson.id]!;
      expect(within(cardFor(cellId)).getByRole('link'), lesson.id).toHaveAttribute('href', `/slice/${cellId}`);
    }
  });

  it('offers Continue once started and Review it again once finished', () => {
    const { rerender } = renderCards({ progress: { [MATH_CELL]: progressWith(MATH_CELL, ['lesson']) } });
    expect(screen.getByRole('link', { name: /Continue/ })).toBeVisible();

    rerender(
      <MemoryRouter>
        <SliceCards
          progress={{ [MATH_CELL]: progressWith(MATH_CELL, ['lesson', 'guided', 'independent', 'timed']) }}
          isDemo
          role="user"
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: /Review it again/ })).toBeVisible();
  });
});

describe('what the cards never claim', () => {
  it('says awaiting review, and never verified, adaptive or recommended', () => {
    const { container } = renderCards();
    expect(screen.getAllByText('Awaiting review')).toHaveLength(SLICES);
    expect(screen.getByText(/count toward no coverage/i)).toBeVisible();

    const text = container.textContent ?? '';
    for (const word of ['Verified', 'Adaptive', 'Recommended']) {
      expect(text, word).not.toContain(word);
    }
  });
});

describe('an ordinary learner on a real deployment', () => {
  it('sees the slices locked rather than openable', () => {
    renderCards({ isDemo: false, role: 'user' });

    expect(screen.getAllByText('Coming soon')).toHaveLength(SLICES);
    expect(screen.getAllByText(/Locked until a reviewer approves it/)).toHaveLength(SLICES);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getAllByText(/waiting for a subject-matter review/i)).toHaveLength(SLICES);
  });

  it('opens for an administrator instead', () => {
    renderCards({ isDemo: false, role: 'admin' });
    expect(screen.getAllByRole('link')).toHaveLength(SLICES);
  });
});

describe('progress belongs to one learner', () => {
  it('reads only the record for the cell it is showing', () => {
    renderCards({ progress: { [PHYSICS_CELL]: progressWith(PHYSICS_CELL, ['lesson', 'guided']) } });

    expect(within(cardFor(MATH_CELL)).getByText('Not started')).toBeVisible();
    expect(within(cardFor(PHYSICS_CELL)).getByText('In progress · Independent practice')).toBeVisible();
  });
});
