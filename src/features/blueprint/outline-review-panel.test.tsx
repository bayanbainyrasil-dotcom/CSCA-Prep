import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutlineReviewPanel } from './outline-review';
import type { OutlineCell } from './blueprint-service';

const fetchOutlineReviews = vi.fn<(subject?: string) => Promise<OutlineCell[]>>();
const recordOutlineReview = vi.fn<(input: unknown) => Promise<unknown>>();
const readOutlineProblems = vi.fn<(cause: unknown) => { code: string; message: string }[]>();

vi.mock('./blueprint-service', () => ({
  fetchOutlineReviews: (subject?: string) => fetchOutlineReviews(subject),
  recordOutlineReview: (input: unknown) => recordOutlineReview(input),
  readOutlineProblems: (cause: unknown) => readOutlineProblems(cause),
}));

function cell(overrides: Partial<OutlineCell> & { id: string }): OutlineCell {
  return {
    subject: 'physics',
    module: 'Optics',
    topic: 'Optics',
    skill: 'Apply the laws of reflection and refraction',
    microSkill: 'Apply the laws of reflection and refraction',
    version: 1,
    review: {
      cellId: overrides.id,
      status: 'unreviewed',
      sourceUrl: null,
      sourceTitle: null,
      sourceEdition: null,
      sourcePublishedAt: null,
      lastCheckedAt: null,
      reviewer: null,
      reviewerUid: null,
      reviewedAt: null,
      differenceNote: '',
      ownSummary: '',
      reviewedCellVersion: null,
      version: 0,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  readOutlineProblems.mockReturnValue([]);
  recordOutlineReview.mockResolvedValue({ cellId: 'c', status: 'matches-source', version: 1, reviewedCellVersion: 1 });
  fetchOutlineReviews.mockResolvedValue([cell({ id: 'phys-optics-reflection-refraction' })]);
});

afterEach(cleanup);

describe('the comparison screen', () => {
  it('says plainly that recording a check does not verify any content', async () => {
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByText(/phys-optics-reflection-refraction/)).toBeVisible());

    expect(screen.getByText(/changes no coverage number/i)).toBeVisible();
    expect(screen.getByText(/still needs human-approved questions before it counts/i)).toBeVisible();
  });

  it('tells the reviewer not to paste official material', async () => {
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('note')).toBeVisible());
    expect(screen.getByRole('note')).toHaveTextContent(/Do not paste text from the official materials/i);
  });

  it('will not submit until the reviewer attests the words are their own', async () => {
    const user = userEvent.setup();
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await user.type(screen.getByLabelText(/Source link/i), 'https://example.edu/outline.pdf');
    await user.type(screen.getByLabelText(/Document name/i), 'CSCA outline');
    await user.type(screen.getByLabelText(/Source publication date/i), '2026-01-15');

    const submit = screen.getByRole('button', { name: /Record this check/i });
    expect(submit).toBeDisabled();

    await user.click(screen.getByLabelText(/These are my own words/i));
    expect(submit).toBeEnabled();
  });

  it('requires a source link, name and date for a plain match', async () => {
    const user = userEvent.setup();
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.click(screen.getByLabelText(/These are my own words/i));

    expect(screen.getByRole('button', { name: /Record this check/i })).toBeDisabled();
    expect(recordOutlineReview).not.toHaveBeenCalled();
  });

  it('lets a specialist referral be recorded without a source, but not without a reason', async () => {
    const user = userEvent.setup();
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.selectOptions(screen.getByLabelText(/What did you find/i), 'needs-specialist');
    await user.click(screen.getByLabelText(/These are my own words/i));

    const submit = screen.getByRole('button', { name: /Record this check/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/What differs, or what a specialist must settle/i), 'A physics specialist must confirm this is examinable.');
    expect(submit).toBeEnabled();
  });

  it('sends the cell version it displayed, so a concurrent edit is caught', async () => {
    const user = userEvent.setup();
    fetchOutlineReviews.mockResolvedValue([cell({ id: 'phys-optics-lens-mirror', version: 7 })]);
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Check' }));

    await user.type(screen.getByLabelText(/Source link/i), 'https://example.edu/outline.pdf');
    await user.type(screen.getByLabelText(/Document name/i), 'CSCA outline');
    await user.type(screen.getByLabelText(/Source publication date/i), '2026-01-15');
    await user.click(screen.getByLabelText(/These are my own words/i));
    await user.click(screen.getByRole('button', { name: /Record this check/i }));

    await waitFor(() => expect(recordOutlineReview).toHaveBeenCalled());
    expect(recordOutlineReview).toHaveBeenCalledWith(expect.objectContaining({ expectedCellVersion: 7, ownWordsAttested: true }));
    // Nothing that would let the client name a reviewer or a time.
    const [sent] = recordOutlineReview.mock.calls[0] as [Record<string, unknown>];
    for (const forbidden of ['reviewer', 'reviewerUid', 'reviewedAt', 'lastCheckedAt', 'version', 'reviewedCellVersion']) {
      expect(sent, forbidden).not.toHaveProperty(forbidden);
    }
  });

  it('shows a review as lapsed once its cell has moved on', async () => {
    fetchOutlineReviews.mockResolvedValue([
      cell({
        id: 'phys-optics-lens-mirror',
        version: 4,
        review: { ...cell({ id: 'phys-optics-lens-mirror' }).review, status: 'matches-source', reviewedCellVersion: 3, version: 1, reviewer: 'r@example.test', reviewedAt: '2026-02-01T00:00:00.000Z' },
      }),
    ]);
    render(<OutlineReviewPanel />);

    await waitFor(() => expect(screen.getByText(/Lapsed — cell changed/)).toBeVisible());
    expect(screen.getByText(/1 review has lapsed because the cell changed/i)).toBeVisible();
  });

  it('shows the recorded source as a link with its date and reviewer', async () => {
    fetchOutlineReviews.mockResolvedValue([
      cell({
        id: 'phys-optics-lens-mirror',
        review: {
          ...cell({ id: 'phys-optics-lens-mirror' }).review,
          status: 'matches-source',
          reviewedCellVersion: 1,
          sourceUrl: 'https://example.edu/outline.pdf',
          sourceTitle: 'CSCA subject outline',
          sourcePublishedAt: '2026-01-15',
          reviewer: 'reviewer@example.test',
          reviewedAt: '2026-02-01T00:00:00.000Z',
          version: 1,
        },
      }),
    ]);
    render(<OutlineReviewPanel />);

    const table = await screen.findByRole('table');
    const link = within(table).getByRole('link', { name: /CSCA subject outline/ });
    expect(link).toHaveAttribute('href', 'https://example.edu/outline.pdf');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    expect(within(table).getByText(/dated 2026-01-15/)).toBeVisible();
    expect(within(table).getByText(/reviewer@example.test, 2026-02-01/)).toBeVisible();
  });

  it('reports the server’s own reasons when a review is refused', async () => {
    const user = userEvent.setup();
    recordOutlineReview.mockRejectedValue(new Error('The review is incomplete.'));
    readOutlineProblems.mockReturnValue([{ code: 'source-date-required', message: "Record the source's publication date as YYYY-MM-DD." }]);
    render(<OutlineReviewPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Check' })).toBeVisible());
    await user.click(screen.getByRole('button', { name: 'Check' }));
    await user.type(screen.getByLabelText(/Source link/i), 'https://example.edu/outline.pdf');
    await user.type(screen.getByLabelText(/Document name/i), 'CSCA outline');
    await user.type(screen.getByLabelText(/Source publication date/i), '2026-01-15');
    await user.click(screen.getByLabelText(/These are my own words/i));
    await user.click(screen.getByRole('button', { name: /Record this check/i }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/publication date as YYYY-MM-DD/));
  });
});
