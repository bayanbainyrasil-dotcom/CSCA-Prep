import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportPanel, PUBLIC_SEED_WARNING } from './import-panel';
import type { ImportResult } from './blueprint-service';

const importBlueprintDraft = vi.fn<(input: unknown) => Promise<ImportResult>>();
const importPublicQuestionSeed = vi.fn<(input: unknown) => Promise<ImportResult>>();
const importPrivateQuestions = vi.fn<(input: unknown) => Promise<ImportResult>>();
const readImportProblems = vi.fn<(cause: unknown) => { id: string; outcome: string; reason: string }[]>();

vi.mock('./blueprint-service', () => ({
  importBlueprintDraft: (input: unknown) => importBlueprintDraft(input),
  importPublicQuestionSeed: (input: unknown) => importPublicQuestionSeed(input),
  importPrivateQuestions: (input: unknown) => importPrivateQuestions(input),
  readImportProblems: (cause: unknown) => readImportProblems(cause),
}));

function summary(overrides: Partial<ImportResult['summary']> = {}): ImportResult['summary'] {
  return { create: 1, update: 0, unchanged: 0, conflict: 0, invalid: 0, total: 1, blocked: false, ...overrides };
}

function result(overrides: Partial<ImportResult> = {}): ImportResult {
  return {
    dryRun: true,
    summary: summary(),
    decisions: [
      { id: 'item-1', outcome: 'create', reason: '', contentHash: 'h1', existingVersion: null, nextVersion: 1 },
    ],
    ...overrides,
  };
}

const PRIVATE_FILE_TEXT = JSON.stringify({
  items: [
    {
      id: 'private-item-001',
      question: {
        question: 'SECRET-PROMPT-TOKEN what is x?',
        correctAnswer: 'c',
        solution: 'SECRET-SOLUTION-TOKEN full working.',
      },
    },
  ],
});

function privateFile(): File {
  return new File([PRIVATE_FILE_TEXT], 'questions.json', { type: 'application/json' });
}

function renderPanel() {
  return render(<ImportPanel blueprintSeedVersion="2026-09-02.1" publicSeedVersion="2026-09-02.1" />);
}

beforeEach(() => {
  vi.clearAllMocks();
  readImportProblems.mockReturnValue([]);
  importBlueprintDraft.mockResolvedValue(result());
  importPublicQuestionSeed.mockResolvedValue(result());
  importPrivateQuestions.mockResolvedValue(result());
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(cleanup);

describe('the import sequence', () => {
  it('will not let anything be confirmed before a dry run has been read', async () => {
    const user = userEvent.setup();
    renderPanel();

    const confirm = screen.getByRole('button', { name: /Confirm import/i });
    expect(confirm).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /Dry run/i }));

    await waitFor(() => expect(confirm).toBeEnabled());
    expect(importBlueprintDraft).toHaveBeenCalledWith(expect.objectContaining({ dryRun: true }));
    expect(importBlueprintDraft).not.toHaveBeenCalledWith(expect.objectContaining({ dryRun: false }));
  });

  it('keeps confirmation disabled while any item conflicts or fails validation', async () => {
    const user = userEvent.setup();
    importBlueprintDraft.mockResolvedValue(
      result({ summary: summary({ create: 0, conflict: 1, total: 1, blocked: true }) }),
    );
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Dry run/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm import/i })).toBeDisabled());
    expect(screen.getByText(/Nothing will be written while any item conflicts/i)).toBeVisible();
  });

  it('says plainly that an import leaves everything awaiting a reviewer', async () => {
    const user = userEvent.setup();
    importBlueprintDraft.mockResolvedValueOnce(result()).mockResolvedValueOnce(result({ dryRun: false }));
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Dry run/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm import/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /Confirm import/i }));

    await waitFor(() =>
      expect(screen.getByText(/Imported as pending review/i)).toBeVisible(),
    );
    expect(screen.getByText(/Nothing counts as coverage until a named reviewer approves it/i)).toBeVisible();
  });

  it('reports a partial failure item by item instead of a bare error', async () => {
    const user = userEvent.setup();
    const refusal = Object.assign(new Error('The batch was not applied.'), { code: 'aborted' });
    importBlueprintDraft.mockRejectedValue(refusal);
    readImportProblems.mockReturnValue([
      { id: 'item-7', outcome: 'invalid', reason: 'question-type-not-allowed for cell math-linear-isolate-unknown' },
      { id: 'item-9', outcome: 'conflict', reason: 'stored version 3, file expected 2' },
    ]);
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Dry run/i }));

    await waitFor(() => expect(screen.getByText('item-7')).toBeVisible());
    expect(screen.getByText(/question-type-not-allowed/)).toBeVisible();
    expect(screen.getByText('item-9')).toBeVisible();
    expect(screen.getByText(/stored version 3, file expected 2/)).toBeVisible();
    expect(screen.getAllByRole('alert').map((node) => node.textContent ?? '').join(' ')).toContain(
      'The batch was not applied.',
    );
  });

  it('re-running the same choice sends the same batch id, so a retry is not a second import', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: /Dry run/i }));
    await waitFor(() => expect(importBlueprintDraft).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: /Dry run/i }));
    await waitFor(() => expect(importBlueprintDraft).toHaveBeenCalledTimes(2));

    const [first] = importBlueprintDraft.mock.calls[0] as [{ batchId: string }];
    const [second] = importBlueprintDraft.mock.calls[1] as [{ batchId: string }];
    expect(second.batchId).toBe(first.batchId);
  });
});

describe('the public seed', () => {
  it('carries the warning that it is practice material, not confidential mock content', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.queryByText(PUBLIC_SEED_WARNING)).toBeNull();
    await user.click(screen.getByRole('radio', { name: /Import public practice seed/i }));

    expect(screen.getByText(PUBLIC_SEED_WARNING)).toBeVisible();
    expect(PUBLIC_SEED_WARNING).toContain('practice/demo only');
    expect(PUBLIC_SEED_WARNING).toContain('must not be treated as confidential production mock content');
  });
});

describe('a private question file', () => {
  it('is never written to browser storage', async () => {
    const user = userEvent.setup();
    importPrivateQuestions.mockResolvedValueOnce(result()).mockResolvedValueOnce(result({ dryRun: false }));
    renderPanel();

    await user.click(screen.getByRole('radio', { name: /Import a private question file/i }));
    await user.upload(screen.getByLabelText(/Question file \(JSON/i), privateFile());
    await waitFor(() => expect(screen.getByText(/questions.json/)).toBeVisible());

    await user.click(screen.getByRole('button', { name: /Dry run/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm import/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /Confirm import/i }));
    await waitFor(() => expect(importPrivateQuestions).toHaveBeenCalledTimes(2));

    for (const store of [localStorage, sessionStorage]) {
      const dumped = JSON.stringify(Object.fromEntries(Object.entries(store)));
      expect(dumped).not.toContain('SECRET-PROMPT-TOKEN');
      expect(dumped).not.toContain('SECRET-SOLUTION-TOKEN');
      expect(dumped).not.toContain('private-item-001');
      expect(store.length).toBe(0);
    }
  });

  it('is dropped from memory once it has been applied', async () => {
    const user = userEvent.setup();
    importPrivateQuestions.mockResolvedValueOnce(result()).mockResolvedValueOnce(result({ dryRun: false }));
    renderPanel();

    await user.click(screen.getByRole('radio', { name: /Import a private question file/i }));
    await user.upload(screen.getByLabelText(/Question file \(JSON/i), privateFile());
    await waitFor(() => expect(screen.getByText(/questions.json/)).toBeVisible());
    await user.click(screen.getByRole('button', { name: /Dry run/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm import/i })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: /Confirm import/i }));

    // The file name disappears and the dry run cannot be run again without re-choosing it.
    await waitFor(() => expect(screen.queryByText(/questions.json/)).toBeNull());
    expect(screen.getByRole('button', { name: /Dry run/i })).toBeDisabled();
  });

  it('cannot be dry-run at all until a file has been chosen', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('radio', { name: /Import a private question file/i }));

    expect(screen.getByRole('button', { name: /Dry run/i })).toBeDisabled();
    expect(importPrivateQuestions).not.toHaveBeenCalled();
  });

  it('refuses a malformed file with a readable reason and sends nothing', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('radio', { name: /Import a private question file/i }));
    await user.upload(
      screen.getByLabelText(/Question file \(JSON/i),
      new File(['{"items":[]}'], 'empty.json', { type: 'application/json' }),
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/contains no items/i));
    expect(screen.getByRole('button', { name: /Dry run/i })).toBeDisabled();
    expect(importPrivateQuestions).not.toHaveBeenCalled();
  });

  it('tells the operator the file is not saved, cached or logged', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('radio', { name: /Import a private question file/i }));

    const note = screen.getByText(/read in this tab and sent straight to the server/i);
    expect(note).toHaveTextContent(/not saved in the browser/i);
    expect(note).toHaveTextContent(/not cached/i);
    expect(note).toHaveTextContent(/never appear in a log/i);
  });
});
