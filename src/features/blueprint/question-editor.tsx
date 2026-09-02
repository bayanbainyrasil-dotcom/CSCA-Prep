import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Plus, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel, Input, Textarea } from '@/components/ui/field';
import { validateQuestionAgainstCell, type BlueprintQuestionType } from './blueprint';
import type { CoverageCell } from './blueprint-service';

/**
 * Authoring a question against the blueprint.
 *
 * The cell is chosen first and the module, topic and skill are then read from
 * it rather than typed, so an item cannot drift from the requirement it claims.
 * Difficulty, question type and language are restricted to what the cell asks
 * for, and the same `validateQuestionAgainstCell` the server runs is shown live,
 * so a refusal is visible before saving rather than after.
 *
 * Nothing here can publish verified content: the callable stores every import as
 * `pending-review`.
 */

export interface QuestionDraftValue {
  id: string;
  cellId: string;
  questionType: BlueprintQuestionType | '';
  difficulty: number;
  language: 'en' | 'ru' | 'zh';
  question: string;
  questionTranslation: string;
  options: string[];
  correctIndex: number;
  solution: string;
  shortSolution: string;
  explanation: string;
  sourceReference: string;
}

export const EMPTY_DRAFT: QuestionDraftValue = {
  id: '',
  cellId: '',
  questionType: '',
  difficulty: 0,
  language: 'en',
  question: '',
  questionTranslation: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  solution: '',
  shortSolution: '',
  explanation: '',
  sourceReference: '',
};

const STATUS_LABEL: Record<CoverageCell['status'], string> = {
  covered: 'covered',
  partial: 'partial',
  unverified: 'unverified',
  empty: 'empty',
};

/**
 * A searchable, grouped picker. 105 cells in one flat list would be unusable, so
 * this filters by subject and text and groups what remains by module.
 */
export function BlueprintCellPicker({
  cells,
  value,
  onChange,
}: {
  cells: CoverageCell[];
  value: string;
  onChange: (cellId: string) => void;
}) {
  const [subject, setSubject] = useState<'all' | 'mathematics' | 'physics'>('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const text = query.trim().toLowerCase();
    const matching = cells.filter((cell) => {
      if (subject !== 'all' && cell.subject !== subject) return false;
      if (text.length === 0) return true;
      return `${cell.module} ${cell.topic} ${cell.skill} ${cell.microSkill} ${cell.id}`.toLowerCase().includes(text);
    });
    const byModule = new Map<string, CoverageCell[]>();
    for (const cell of matching) {
      const list = byModule.get(cell.module) ?? [];
      list.push(cell);
      byModule.set(cell.module, list);
    }
    return [...byModule.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [cells, query, subject]);

  const matchCount = groups.reduce((total, [, list]) => total + list.length, 0);

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="editor-cell-subject">Subject</FieldLabel>
          <select
            id="editor-cell-subject"
            className="tap-target w-full rounded-xl border bg-card px-3"
            value={subject}
            onChange={(event) => setSubject(event.target.value as typeof subject)}
          >
            <option value="all">All subjects</option>
            <option value="mathematics">Mathematics</option>
            <option value="physics">Physics</option>
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="editor-cell-search">Find a blueprint cell</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="editor-cell-search"
              className="pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Module, topic, skill or micro-skill"
            />
          </div>
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground" role="status">
        {matchCount} of {cells.length} cells match.
      </p>

      <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border">
        {groups.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No blueprint cell matches this search.</p>
        ) : (
          groups.map(([module, list]) => (
            <fieldset key={module} className="border-b last:border-0">
              <legend className="sr-only">{module}</legend>
              <p className="sticky top-0 bg-secondary px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {module}
              </p>
              {list.map((cell) => (
                <label
                  key={cell.id}
                  className={`flex cursor-pointer items-start gap-3 border-t p-3 text-sm first:border-t-0 hover:bg-secondary ${
                    value === cell.id ? 'bg-primary/[0.06]' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="blueprint-cell"
                    className="mt-1"
                    value={cell.id}
                    checked={value === cell.id}
                    onChange={() => onChange(cell.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{cell.microSkill}</span>
                    <span className="block text-xs text-muted-foreground">
                      {cell.topic} · difficulty {cell.difficultyLevels.join('/')} · {cell.questionTypes.join(', ')}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {cell.verifiedItems} / {cell.minimumItems} verified · {STATUS_LABEL[cell.status]}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
          ))
        )}
      </div>
    </div>
  );
}

export function QuestionEditor({
  cells,
  value,
  onChange,
  onSaveDraft,
  onSubmitForReview,
  pending,
}: {
  cells: CoverageCell[];
  value: QuestionDraftValue;
  onChange: (next: QuestionDraftValue) => void;
  onSaveDraft: () => void;
  onSubmitForReview: () => void;
  pending: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const cell = cells.find((entry) => entry.id === value.cellId);

  const problems = useMemo(() => {
    if (!cell || !value.questionType || value.difficulty === 0) return [];
    return validateQuestionAgainstCell(
      {
        id: cell.id,
        subject: cell.subject,
        module: cell.module,
        topicId: cell.topicId,
        topic: cell.topic,
        skillId: cell.id,
        skill: cell.skill,
        microSkillId: cell.id,
        microSkill: cell.microSkill,
        prerequisiteCellIds: [],
        difficultyLevels: cell.difficultyLevels,
        questionTypes: cell.questionTypes as BlueprintQuestionType[],
        minimumItems: cell.minimumItems,
        supportedLanguages: cell.supportedLanguages as ('en' | 'ru' | 'zh')[],
        allowedExamModes: cell.allowedExamModes as ('diagnostic' | 'practice' | 'mock')[],
        verificationStatus: 'draft',
        sourceType: 'original-csca-style',
        sourceReference: cell.sourceReference,
        reviewer: null,
        reviewedAt: null,
        knownLimitations: cell.knownLimitations,
        version: 1,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        subject: cell.subject,
        topicId: cell.topicId,
        questionType: value.questionType,
        difficulty: value.difficulty,
        language: value.language,
      },
      cell.id,
    );
  }, [cell, value.difficulty, value.language, value.questionType]);

  const missingFields = [
    value.id.trim() === '' ? 'a question id' : null,
    value.cellId === '' ? 'a blueprint cell' : null,
    value.questionType === '' ? 'a question type' : null,
    value.difficulty === 0 ? 'a difficulty' : null,
    value.question.trim() === '' ? 'the English prompt' : null,
    value.options.some((option) => option.trim() === '') ? 'all four options' : null,
    value.solution.trim() === '' ? 'a full solution' : null,
    value.shortSolution.trim() === '' ? 'a short solution' : null,
    value.sourceReference.trim() === '' ? 'a source reference' : null,
  ].filter((entry): entry is string => entry !== null);

  const blocked = pending || problems.length > 0 || missingFields.length > 0;

  return (
    <Card><CardContent className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="data-label">Question editor</p>
          <h2 className="mt-1 font-display text-xl font-semibold">Author against the blueprint</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            New items are stored as <strong>pending review</strong>. Nothing written here counts as coverage until a
            named person approves it.
          </p>
        </div>
        <Button variant="outline" onClick={() => setPreview(!preview)}>{preview ? 'Edit' : 'Preview'}</Button>
      </div>

      {cells.length === 0 ? (
        <p className="mt-5 flex gap-2 rounded-xl border border-physics/40 bg-physics/[0.06] p-4 text-sm" role="status">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-physics" aria-hidden="true" />
          No blueprint cell exists yet. Upload the curriculum requirements first — a question cannot be authored
          against a requirement that has not been stated.
        </p>
      ) : null}

      {preview ? (
        <div className="mt-6 rounded-xl border bg-background p-5">
          <Badge variant="outline">{cell ? `${cell.module} · ${cell.topic}` : 'No cell selected'}</Badge>
          <p className="mt-4 text-base font-semibold">{value.question || 'Question preview'}</p>
          {value.questionTranslation ? (
            <p className="mt-2 text-sm text-muted-foreground">{value.questionTranslation}</p>
          ) : null}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {value.options.map((option, index) => (
              <div
                key={index}
                className={`rounded-xl border p-3 text-sm ${index === value.correctIndex ? 'border-success/30 bg-success/[0.05]' : ''}`}
              >
                {String.fromCharCode(65 + index)}. {option || 'Option'}
              </div>
            ))}
          </div>
          {value.solution ? <p className="mt-4 rounded-xl bg-secondary p-4 text-sm">{value.solution}</p> : null}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <BlueprintCellPicker
            cells={cells}
            value={value.cellId}
            onChange={(cellId) => {
              const next = cells.find((entry) => entry.id === cellId);
              onChange({
                ...value,
                cellId,
                questionType: (next?.questionTypes[0] as BlueprintQuestionType | undefined) ?? '',
                difficulty: next?.difficultyLevels[0] ?? 0,
                language: (next?.supportedLanguages[0] as 'en' | 'ru' | 'zh' | undefined) ?? 'en',
              });
            }}
          />

          {cell ? (
            <dl className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Module</dt><dd className="font-semibold">{cell.module}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Topic</dt><dd className="font-semibold">{cell.topic}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Skill</dt><dd className="font-semibold">{cell.skill}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Micro-skill</dt><dd className="font-semibold">{cell.microSkill}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Allowed modes</dt><dd>{cell.allowedExamModes.join(', ')}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Cell status</dt><dd>{STATUS_LABEL[cell.status]} · {cell.verifiedItems}/{cell.minimumItems} verified</dd></div>
            </dl>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="editor-question-id">Question ID</FieldLabel>
              <Input
                id="editor-question-id"
                value={value.id}
                onChange={(event) => onChange({ ...value, id: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                placeholder="math-linear-isolate-unknown-004"
              />
            </div>
            <div>
              <FieldLabel htmlFor="editor-question-type">Question type</FieldLabel>
              <select
                id="editor-question-type"
                className="tap-target w-full rounded-xl border bg-card px-3"
                value={value.questionType}
                disabled={!cell}
                onChange={(event) => onChange({ ...value, questionType: event.target.value as BlueprintQuestionType })}
              >
                <option value="">Select a type</option>
                {(cell?.questionTypes ?? []).map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="editor-difficulty">Difficulty</FieldLabel>
              <select
                id="editor-difficulty"
                className="tap-target w-full rounded-xl border bg-card px-3"
                value={value.difficulty || ''}
                disabled={!cell}
                onChange={(event) => onChange({ ...value, difficulty: Number(event.target.value) })}
              >
                <option value="">Select a difficulty</option>
                {(cell?.difficultyLevels ?? []).map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="editor-language">Language</FieldLabel>
              <select
                id="editor-language"
                className="tap-target w-full rounded-xl border bg-card px-3"
                value={value.language}
                disabled={!cell}
                onChange={(event) => onChange({ ...value, language: event.target.value as 'en' | 'ru' | 'zh' })}
              >
                {(cell?.supportedLanguages ?? ['en']).map((language) => (
                  <option key={language} value={language}>{language}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-source">Source reference</FieldLabel>
              <Input
                id="editor-source"
                value={value.sourceReference}
                onChange={(event) => onChange({ ...value, sourceReference: event.target.value })}
                placeholder="Where this item came from, so a reviewer can follow it up"
              />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-question">English question</FieldLabel>
              <Textarea id="editor-question" value={value.question} onChange={(event) => onChange({ ...value, question: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-translation">Russian rendering (optional)</FieldLabel>
              <Textarea id="editor-translation" value={value.questionTranslation} onChange={(event) => onChange({ ...value, questionTranslation: event.target.value })} />
            </div>
            {value.options.map((option, index) => (
              <div key={index}>
                <FieldLabel htmlFor={`editor-option-${index}`}>
                  Option {String.fromCharCode(65 + index)}{value.correctIndex === index ? ' · correct' : ''}
                </FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id={`editor-option-${index}`}
                    value={option}
                    onChange={(event) => {
                      const options = [...value.options];
                      options[index] = event.target.value;
                      onChange({ ...value, options });
                    }}
                  />
                  <Button
                    type="button"
                    variant={value.correctIndex === index ? 'default' : 'outline'}
                    size="icon"
                    aria-label={`Mark option ${String.fromCharCode(65 + index)} correct`}
                    aria-pressed={value.correctIndex === index}
                    onClick={() => onChange({ ...value, correctIndex: index })}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-solution">Full solution</FieldLabel>
              <Textarea id="editor-solution" value={value.solution} onChange={(event) => onChange({ ...value, solution: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-short-solution">Short solution</FieldLabel>
              <Input id="editor-short-solution" value={value.shortSolution} onChange={(event) => onChange({ ...value, shortSolution: event.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <FieldLabel htmlFor="editor-explanation">Explanation of the common mistake</FieldLabel>
              <Textarea id="editor-explanation" value={value.explanation} onChange={(event) => onChange({ ...value, explanation: event.target.value })} />
            </div>
          </div>
        </div>
      )}

      {problems.length > 0 ? (
        <ul className="mt-5 space-y-2" role="alert">
          {problems.map((problem) => (
            <li key={problem.code} className="flex gap-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span><span className="font-mono text-xs">{problem.code}</span> — {problem.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {missingFields.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground" role="status">
          Still needed: {missingFields.join(', ')}.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="outline" disabled={blocked} onClick={onSaveDraft}>Save as draft</Button>
        <Button disabled={blocked} onClick={onSubmitForReview}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {pending ? 'Validating…' : 'Submit for review'}
        </Button>
      </div>
    </CardContent></Card>
  );
}
