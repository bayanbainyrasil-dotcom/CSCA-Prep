import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlueprintCellPicker, EMPTY_DRAFT, QuestionEditor, type QuestionDraftValue } from './question-editor';
import type { CoverageCell } from './blueprint-service';

function cell(overrides: Partial<CoverageCell> & { id: string }): CoverageCell {
  return {
    subject: 'mathematics',
    module: 'Algebra',
    topicId: 'math-linear',
    topic: 'Linear equations',
    skill: 'Solve linear relations',
    microSkill: 'Isolate the unknown',
    difficultyLevels: [1, 2],
    questionTypes: ['single-step-calculation'],
    supportedLanguages: ['en'],
    allowedExamModes: ['diagnostic', 'practice', 'mock'],
    minimumItems: 3,
    verificationStatus: 'draft',
    sourceType: 'original-csca-style',
    sourceReference: 'Derived from src/data/curriculum.ts',
    reviewer: null,
    reviewedAt: null,
    knownLimitations: '',
    totalItems: 0,
    verifiedItems: 0,
    demoItems: 0,
    languages: [],
    missingLanguages: [],
    missingDifficulties: [],
    missingQuestionTypes: [],
    status: 'empty',
    reasons: ['No question has been authored for this cell.'],
    ...overrides,
  };
}

const CELLS: CoverageCell[] = [
  cell({ id: 'math-linear-isolate-unknown' }),
  cell({ id: 'math-foundation-integer-operations', module: 'Number and foundations', topicId: 'math-foundation', topic: 'Arithmetic foundation', microSkill: 'Order of operations with signed integers' }),
  cell({
    id: 'phys-units-si-base-derived',
    subject: 'physics',
    module: 'Measurement and mathematical tools',
    topicId: 'phys-units',
    topic: 'Units and SI',
    skill: 'Use SI units consistently',
    microSkill: 'Identify SI base and derived units',
    questionTypes: ['concept-recognition'],
    difficultyLevels: [1, 2],
  }),
];

afterEach(cleanup);

describe('blueprint cell picker', () => {
  it('groups cells by module and reports how many match', () => {
    render(<BlueprintCellPicker cells={CELLS} value="" onChange={() => undefined} />);

    expect(screen.getByRole('status')).toHaveTextContent('3 of 3 cells match.');
    // One <legend> and one visible heading per module group.
    expect(screen.getAllByText('Algebra')).toHaveLength(2);
    expect(screen.getAllByText('Number and foundations')).toHaveLength(2);
    expect(screen.getAllByText('Measurement and mathematical tools')).toHaveLength(2);
  });

  it('filters by subject', async () => {
    const user = userEvent.setup();
    render(<BlueprintCellPicker cells={CELLS} value="" onChange={() => undefined} />);

    await user.selectOptions(screen.getByLabelText('Subject'), 'physics');

    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 cells match.');
    expect(screen.getByText('Identify SI base and derived units')).toBeVisible();
    expect(screen.queryByText('Number and foundations')).toBeNull();
    expect(screen.queryByText('Isolate the unknown')).toBeNull();
  });

  it('filters by free text across module, topic, skill and micro-skill', async () => {
    const user = userEvent.setup();
    render(<BlueprintCellPicker cells={CELLS} value="" onChange={() => undefined} />);

    await user.type(screen.getByLabelText('Find a blueprint cell'), 'signed integers');

    expect(screen.getByRole('status')).toHaveTextContent('1 of 3 cells match.');
    expect(screen.getByText('Order of operations with signed integers')).toBeVisible();
  });

  it('says so when nothing matches instead of showing an empty box', async () => {
    const user = userEvent.setup();
    render(<BlueprintCellPicker cells={CELLS} value="" onChange={() => undefined} />);

    await user.type(screen.getByLabelText('Find a blueprint cell'), 'thermodynamics');

    expect(screen.getByText('No blueprint cell matches this search.')).toBeVisible();
  });

  it('selects a cell from the keyboard through a labelled radio', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<BlueprintCellPicker cells={CELLS} value="" onChange={onChange} />);

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    await user.click(options[0]!);
    expect(onChange).toHaveBeenCalledWith(expect.any(String));
  });

  it('shows each cell’s real coverage rather than a bare name', () => {
    render(<BlueprintCellPicker cells={[cell({ id: 'c1', verifiedItems: 1, minimumItems: 3, status: 'partial' })]} value="" onChange={() => undefined} />);
    expect(screen.getByText(/1 \/ 3 verified · partial/)).toBeVisible();
  });
});

describe('question editor', () => {
  function renderEditor(value: QuestionDraftValue) {
    const onChange = vi.fn<(next: QuestionDraftValue) => void>();
    const result = render(
      <QuestionEditor
        cells={CELLS}
        value={value}
        onChange={onChange}
        onSaveDraft={vi.fn()}
        onSubmitForReview={vi.fn()}
        pending={false}
      />,
    );
    return { ...result, onChange };
  }

  it('says plainly that nothing authored here is verified', () => {
    renderEditor(EMPTY_DRAFT);
    expect(screen.getByText(/stored as/i)).toHaveTextContent(/pending review/i);
    expect(screen.getByText(/until a named person approves it/i)).toBeVisible();
  });

  it('refuses to enable saving until the required fields exist', () => {
    renderEditor(EMPTY_DRAFT);
    expect(screen.getByRole('button', { name: /Save as draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Submit for review/i })).toBeDisabled();
    const statuses = screen.getAllByRole('status').map((node) => node.textContent ?? '');
    expect(statuses.join(' ')).toMatch(/a blueprint cell/);
  });

  it('adopts the cell’s allowed type, difficulty and language when a cell is chosen', async () => {
    const user = userEvent.setup();
    const { onChange } = renderEditor(EMPTY_DRAFT);

    await user.click(screen.getAllByRole('radio')[0]!);

    // Groups are ordered by module, so the first radio is the Algebra cell.
    expect(onChange).toHaveBeenCalledWith({
      ...EMPTY_DRAFT,
      cellId: 'math-linear-isolate-unknown',
      questionType: 'single-step-calculation',
      difficulty: 1,
      language: 'en',
    });
  });

  it('offers only the difficulties and types the chosen cell asks for', () => {
    renderEditor({ ...EMPTY_DRAFT, cellId: 'phys-units-si-base-derived', questionType: 'concept-recognition', difficulty: 1 });

    const types = within(screen.getByLabelText('Question type')).getAllByRole('option').map((option) => option.textContent);
    expect(types).toEqual(['Select a type', 'concept-recognition']);

    const difficulties = within(screen.getByLabelText('Difficulty')).getAllByRole('option').map((option) => option.textContent);
    expect(difficulties).toEqual(['Select a difficulty', '1', '2']);
  });

  it('shows the module, topic, skill and micro-skill of the chosen cell', () => {
    renderEditor({ ...EMPTY_DRAFT, cellId: 'math-linear-isolate-unknown', questionType: 'single-step-calculation', difficulty: 1 });
    // The summary repeats the picker row, so both occurrences are expected.
    expect(screen.getAllByText('Linear equations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Solve linear relations').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Isolate the unknown').length).toBeGreaterThan(0);
    expect(screen.getByText('Module')).toBeVisible();
    expect(screen.getByText('Micro-skill')).toBeVisible();
  });

  it('reports a mapping refusal before saving, with the server’s own codes', () => {
    renderEditor({ ...EMPTY_DRAFT, cellId: 'math-linear-isolate-unknown', questionType: 'graph-reading', difficulty: 5 });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('question-type-not-allowed');
    expect(alert).toHaveTextContent('difficulty-not-allowed');
    expect(screen.getByRole('button', { name: /Submit for review/i })).toBeDisabled();
  });

  it('explains that no cell exists yet rather than showing an empty picker', () => {
    render(
      <QuestionEditor cells={[]} value={EMPTY_DRAFT} onChange={vi.fn()} onSaveDraft={vi.fn()} onSubmitForReview={vi.fn()} pending={false} />,
    );
    expect(screen.getByText(/No blueprint cell exists yet/i)).toBeVisible();
  });

  it('labels every control, so the form is usable from the keyboard on any device', () => {
    renderEditor({ ...EMPTY_DRAFT, cellId: 'math-linear-isolate-unknown', questionType: 'single-step-calculation', difficulty: 1 });
    for (const label of ['Question ID', 'Question type', 'Difficulty', 'Language', 'Source reference', 'English question']) {
      expect(screen.getByLabelText(label), label).toBeVisible();
    }
    expect(screen.getByRole('button', { name: 'Mark option A correct' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Mark option B correct' })).toHaveAttribute('aria-pressed', 'false');
  });
});
