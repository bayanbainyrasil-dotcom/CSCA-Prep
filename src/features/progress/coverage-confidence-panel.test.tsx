import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoverageConfidencePanel } from './coverage-confidence-panel';
import { coverageConfidence, type CoverageConfidence } from './coverage-confidence';
import { BLUEPRINT_CELL_COUNTS } from '../../../functions/src/blueprint-summary';

const EMPTY: CoverageConfidence = coverageConfidence({
  counts: BLUEPRINT_CELL_COUNTS,
  cells: [],
  studiedCellIds: [],
  generatedAt: '2026-09-03T10:00:00.000Z',
});

function renderPanel(props: Partial<Parameters<typeof CoverageConfidencePanel>[0]> = {}) {
  return render(<CoverageConfidencePanel state="ready" confidence={EMPTY} russian={false} {...props} />);
}

/** Each heading appears twice by design — once on its card, once as a table column. */
function cards(container: HTMLElement): HTMLElement {
  return container.querySelector('dl') as HTMLElement;
}

afterEach(cleanup);

describe('what the panel shows today', () => {
  it('reports nought approved out of a hundred and nine, with the denominator visible', () => {
    const { container } = renderPanel();
    const approved = within(cards(container)).getByText('Approved by a reviewer').closest('div')!;
    expect(within(approved).getByText(/^0/)).toBeVisible();
    expect(within(approved).getByText('/ 109')).toBeVisible();
  });

  it('says the secure mock is unavailable and why', () => {
    renderPanel();
    expect(screen.getByText(/secure mock exam is unavailable/i)).toBeVisible();
    expect(screen.getByText(/only a human review does/i)).toBeVisible();
  });

  it('shows all four categories separately, with a definition for each', () => {
    const { container } = renderPanel();
    for (const heading of ['Studied by you', 'Approved by a reviewer', 'Demo or practice only', 'Not measured']) {
      expect(within(cards(container)).getByText(heading), heading).toBeVisible();
    }
    expect(screen.getByText(/your own record of work, not a judgement/i)).toBeVisible();
    expect(screen.getByText(/Nothing you do can move this number/i)).toBeVisible();
    expect(screen.getByText(/never used in a secure mock/i)).toBeVisible();
  });

  it('splits by subject, and the two subjects sum to the total', () => {
    renderPanel();
    const table = screen.getByRole('table');
    expect(within(table).getByRole('rowheader', { name: 'Mathematics' })).toBeVisible();
    expect(within(table).getByRole('rowheader', { name: 'Physics' })).toBeVisible();
    expect(within(table).getAllByText('/ 47').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('/ 62').length).toBeGreaterThan(0);
  });

  it('shows when the figures were produced', () => {
    renderPanel();
    expect(screen.getByText(/^Updated:/)).toBeVisible();
  });
});

describe('it is never a score', () => {
  it('shows no percentage, no total and none of the forbidden claims', () => {
    const { container } = renderPanel();
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/\d+\s?%/);
    expect(text).toMatch(/four separate counts, not one score/i);
    for (const claim of ['pass probability', 'predicted score', 'likely to pass', 'guarantee', 'ready to pass']) {
      expect(text.toLowerCase(), claim).not.toContain(claim);
    }
  });
});

describe('the states', () => {
  it('says it is loading rather than showing zeroes', () => {
    renderPanel({ state: 'loading', confidence: null });
    expect(screen.getByRole('status')).toHaveTextContent(/Reading the current coverage/i);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('refuses to guess when coverage cannot be read, and offers a retry', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderPanel({ state: 'error', confidence: null, onRetry });

    expect(screen.getByRole('alert')).toHaveTextContent(/showing an approximate figure instead of the real one would be worse/i);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('marks cached figures as possibly out of date', () => {
    renderPanel({ confidence: { ...EMPTY, stale: true } });
    expect(screen.getByText(/these may be out of date/i)).toBeVisible();
  });

  it('does not claim freshness it does not have', () => {
    renderPanel({ confidence: { ...EMPTY, generatedAt: null } });
    expect(screen.getByText(/Update time unknown/i)).toBeVisible();
  });
});

describe('language', () => {
  it('renders every heading and definition in Russian', () => {
    const { container } = renderPanel({ russian: true });
    for (const heading of ['Изучено вами', 'Одобрено рецензентом', 'Только демо или практика', 'Не измерено']) {
      expect(within(cards(container)).getByText(heading), heading).toBeVisible();
    }
    expect(screen.getByText(/четыре отдельных счётчика/i)).toBeVisible();
    expect(screen.getByRole('rowheader', { name: 'Математика' })).toBeVisible();
  });

  it('translates the mock explanation, not only the labels', () => {
    renderPanel({ russian: true });
    expect(screen.getByText(/защищённый пробный экзамен недоступен/i)).toBeVisible();
  });
});

describe('accessibility', () => {
  it('names each figure for a screen reader, not just visually', () => {
    renderPanel();
    // The visible number is "0 / 109"; the label is attached, not implied by position.
    expect(screen.getByText('Approved by a reviewer:')).toBeInTheDocument();
  });

  it('gives the subject table a caption and row headers', () => {
    renderPanel();
    const table = screen.getByRole('table');
    expect(within(table).getByText('By subject')).toBeInTheDocument();
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2);
  });

  it('uses a definition list, so each number is tied to its term', () => {
    const { container } = renderPanel();
    expect(container.querySelector('dl')).not.toBeNull();
    expect(container.querySelectorAll('dt')).toHaveLength(4);
    expect(container.querySelectorAll('dd')).toHaveLength(4);
  });

  it('keeps the wide table scrollable inside its own container', () => {
    const { container } = renderPanel();
    const scroller = container.querySelector('.overflow-x-auto');
    expect(scroller).not.toBeNull();
    expect(scroller!.querySelector('table')).not.toBeNull();
  });
});
