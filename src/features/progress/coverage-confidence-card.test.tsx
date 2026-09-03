/**
 * The container: which of the three states the panel ends in, where "studied"
 * comes from, and that a failed read never becomes a page full of zeros.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SliceProgress } from '@/domain';

import type { CoverageSummaryResult } from './coverage-summary-service';

const fetchCoverageSummary = vi.fn<() => Promise<CoverageSummaryResult>>();
vi.mock('./coverage-summary-service', () => ({
  fetchCoverageSummary: (): Promise<CoverageSummaryResult> => fetchCoverageSummary(),
}));

const state = {
  profile: null as { settings: { explanationLanguage: string } } | null,
  sliceProgress: {} as Record<string, SliceProgress>,
};
vi.mock('@/stores', () => ({
  useAppStore: <T,>(selector: (value: typeof state) => T): T => selector(state),
}));

const { CoverageConfidenceCard } = await import('./coverage-confidence-card');

function summary(overrides: Partial<CoverageSummaryResult['summary']> = {}): CoverageSummaryResult {
  const base: CoverageSummaryResult['summary'] = {
    generatedAt: '2026-09-01T10:00:00.000Z',
    outOf: { total: 4, mathematics: 2, physics: 2 },
    cells: [
      { id: 'math-a', subject: 'mathematics', status: 'covered', totalItems: 4, demoItems: 0, publicKeyItems: 0 },
      { id: 'math-b', subject: 'mathematics', status: 'unverified', totalItems: 2, demoItems: 0, publicKeyItems: 2 },
      { id: 'phys-a', subject: 'physics', status: 'empty', totalItems: 0, demoItems: 0, publicKeyItems: 0 },
      { id: 'phys-b', subject: 'physics', status: 'empty', totalItems: 0, demoItems: 0, publicKeyItems: 0 },
    ] as const,
    ...overrides,
  };
  return { summary: base, cells: [...base.cells], stale: false };
}

/** Each heading appears twice by design — once on its card, once as a table column. */
function cards(): HTMLElement {
  return document.querySelector('dl') as HTMLElement;
}

function cardHeading(heading: string): HTMLElement {
  return within(cards()).getByText(heading);
}

function cardValue(heading: string): string {
  return cardHeading(heading).closest('div')?.textContent ?? '';
}

beforeEach(() => {
  fetchCoverageSummary.mockReset();
  // `en-ru` is the shipped default and means bilingual, so English-only has to
  // be asked for explicitly. Each test says which language it is reading.
  state.profile = { settings: { explanationLanguage: 'en' } };
  state.sliceProgress = {};
});

describe('the coverage card', () => {
  it('shows a loading state before the read returns', async () => {
    let release: (value: CoverageSummaryResult) => void = () => {};
    fetchCoverageSummary.mockReturnValue(new Promise<CoverageSummaryResult>((resolve) => { release = resolve; }));
    render(<CoverageConfidenceCard />);
    expect(screen.getByRole('status')).toHaveTextContent(/Reading the current coverage/i);
    release(summary());
    await waitFor(() => expect(cardHeading('Approved by a reviewer')).toBeInTheDocument());
  });

  it('shows the four counts against the deployment’s own denominator', async () => {
    fetchCoverageSummary.mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(cardValue('Approved by a reviewer')).toContain('1 / 4'));
    expect(cardValue('Demo or practice only')).toContain('1 / 4');
    expect(cardValue('Studied by you')).toContain('0 / 4');
    expect(cardValue('Not measured')).toContain('2 / 4');
  });

  it('counts a cell as studied only when this learner has slice progress in it', async () => {
    state.sliceProgress = { 'math-a': { cellId: 'math-a' } as SliceProgress };
    fetchCoverageSummary.mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(cardValue('Studied by you')).toContain('1 / 4'));
  });

  it('says when the deployment publishes fewer requirements than the documented blueprint', async () => {
    fetchCoverageSummary.mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() =>
      expect(screen.getByText(/This deployment publishes 4 blueprint requirements\./)).toBeInTheDocument(),
    );
    expect(screen.getByText(/The documented blueprint has 109\./)).toBeInTheDocument();
  });

  it('shows an error, not zeros, when coverage cannot be read', async () => {
    fetchCoverageSummary.mockRejectedValue(new Error('offline'));
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Coverage is unavailable right now/i));
    expect(document.querySelector('dl')).toBeNull();
  });

  it('reads again when the learner retries', async () => {
    fetchCoverageSummary.mockRejectedValueOnce(new Error('offline')).mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: /Try again/i }));
    await waitFor(() => expect(cardHeading('Approved by a reviewer')).toBeInTheDocument());
    expect(fetchCoverageSummary).toHaveBeenCalledTimes(2);
  });

  it('marks a cached read as possibly out of date', async () => {
    fetchCoverageSummary.mockResolvedValue({ ...summary(), stale: true });
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(screen.getByText(/Showing saved figures/i)).toBeInTheDocument());
  });

  it('follows the learner’s explanation language', async () => {
    state.profile = { settings: { explanationLanguage: 'en-ru' } };
    fetchCoverageSummary.mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(within(cards()).getByText('Одобрено рецензентом')).toBeInTheDocument());
  });

  it('never renders a percentage or a prediction', async () => {
    fetchCoverageSummary.mockResolvedValue(summary());
    const { container } = render(<CoverageConfidenceCard />);
    await waitFor(() => expect(cardHeading('Approved by a reviewer')).toBeInTheDocument());
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\d+\s?%/);
    for (const claim of ['pass probability', 'predicted score', 'likely to pass', 'ready to pass']) {
      expect(text.toLowerCase(), claim).not.toContain(claim);
    }
  });

  it('splits the counts by subject', async () => {
    fetchCoverageSummary.mockResolvedValue(summary());
    render(<CoverageConfidenceCard />);
    await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const physics = rows.find((row) => row.textContent?.startsWith('Physics'));
    expect(physics?.textContent).toContain('/ 2');
  });
});
