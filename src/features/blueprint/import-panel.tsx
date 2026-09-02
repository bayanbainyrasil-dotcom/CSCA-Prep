import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, FileUp, LoaderCircle, ShieldAlert, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel } from '@/components/ui/field';
import {
  importBlueprintDraft,
  importPrivateQuestions,
  importPublicQuestionSeed,
  readImportProblems,
  type ImportResult,
} from './blueprint-service';

/**
 * Content import, in one deliberate sequence: choose a source, dry-run it, read
 * what would happen, confirm, then go and review.
 *
 * The private file is read in memory and sent straight to the server. It is
 * never written to `localStorage`, IndexedDB or any cache, and its contents are
 * never logged — an answer key that reaches a log is just as leaked as one in a
 * bundle.
 */

export type ImportKind = 'blueprint-draft' | 'public-seed' | 'private-file';

export interface ImportPanelProps {
  blueprintSeedVersion: string;
  publicSeedVersion: string;
  onImported?: () => void;
}

const KIND_LABEL: Record<ImportKind, string> = {
  'blueprint-draft': 'Import blueprint draft',
  'public-seed': 'Import public practice seed',
  'private-file': 'Import a private question file',
};

export const PUBLIC_SEED_WARNING =
  'Public seed questions are suitable for practice/demo only and must not be treated as confidential production mock content.';

interface PrivateFilePayload {
  items: { id: string; expectedVersion?: number; question: unknown }[];
}

function parsePrivateFile(text: string): PrivateFilePayload {
  const parsed: unknown = JSON.parse(text);
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray((parsed as { items?: unknown }).items)) {
    throw new Error('The file must be a JSON object with an "items" array.');
  }
  const items = (parsed as { items: unknown[] }).items.map((entry, index) => {
    if (entry === null || typeof entry !== 'object') throw new Error(`Item ${index + 1} is not an object.`);
    const record = entry as { id?: unknown; expectedVersion?: unknown; question?: unknown };
    if (typeof record.id !== 'string' || record.id.trim() === '') throw new Error(`Item ${index + 1} has no id.`);
    if (record.question === undefined) throw new Error(`Item ${index + 1} has no question.`);
    return {
      id: record.id,
      ...(typeof record.expectedVersion === 'number' ? { expectedVersion: record.expectedVersion } : {}),
      question: record.question,
    };
  });
  if (items.length === 0) throw new Error('The file contains no items.');
  return { items };
}

export function ImportPanel({ blueprintSeedVersion, publicSeedVersion, onImported }: ImportPanelProps) {
  const [kind, setKind] = useState<ImportKind>('blueprint-draft');
  const [batchId, setBatchId] = useState(() => `batch-${Date.now().toString(36)}`);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [problems, setProblems] = useState<{ id: string; outcome: string; reason: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'dry-run' | 'apply' | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileItemCount, setFileItemCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  /** Held in memory only, for the length of this import. Never persisted. */
  const filePayloadRef = useRef<PrivateFilePayload | null>(null);
  const headingId = useId();

  // Readiness is derived from state, never from the ref: the ref exists only to
  // carry the parsed file to the request without putting its contents in state.
  const readyToRun = kind !== 'private-file' || fileItemCount > 0;

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(dryRun ? 'dry-run' : 'apply');
      setError(null);
      setProblems([]);
      try {
        let next: ImportResult;
        if (kind === 'blueprint-draft') {
          next = await importBlueprintDraft({ batchId, seedVersion: blueprintSeedVersion, dryRun });
        } else if (kind === 'public-seed') {
          next = await importPublicQuestionSeed({ batchId, seedVersion: publicSeedVersion, dryRun });
        } else {
          const payload = filePayloadRef.current;
          if (!payload) throw new Error('Choose a file first.');
          next = await importPrivateQuestions({ batchId, dryRun, items: payload.items });
        }
        setResult(next);
        if (!dryRun) {
          // The file leaves memory as soon as it has been applied.
          filePayloadRef.current = null;
          setFileName(null);
          setFileItemCount(0);
          if (fileInputRef.current) fileInputRef.current.value = '';
          setBatchId(`batch-${Date.now().toString(36)}`);
          onImported?.();
        }
      } catch (cause) {
        setProblems(readImportProblems(cause));
        setError(cause instanceof Error ? cause.message : 'The import could not be completed.');
      } finally {
        setBusy(null);
      }
    },
    [batchId, blueprintSeedVersion, kind, onImported, publicSeedVersion],
  );

  const chooseFile = async (file: File | undefined) => {
    setError(null);
    setResult(null);
    if (!file) {
      filePayloadRef.current = null;
      setFileName(null);
      setFileItemCount(0);
      return;
    }
    try {
      const payload = parsePrivateFile(await file.text());
      filePayloadRef.current = payload;
      setFileName(file.name);
      setFileItemCount(payload.items.length);
    } catch (cause) {
      filePayloadRef.current = null;
      setFileName(null);
      setFileItemCount(0);
      setError(cause instanceof Error ? cause.message : 'That file could not be read.');
    }
  };

  const decisions = useMemo(() => result?.decisions ?? [], [result]);
  const notable = decisions.filter((decision) => decision.outcome !== 'unchanged');

  return (
    <section className="mt-4" aria-labelledby={headingId}>
      <Card><CardContent className="p-5 sm:p-6">
        <p className="data-label">Content import</p>
        <h2 id={headingId} className="mt-1 font-display text-xl font-semibold tracking-tight">
          Import in one step
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every import runs a dry run first, writes nothing until you confirm, deletes nothing, and stores every
          question as pending review. Re-running the same batch changes nothing.
        </p>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold">1. Choose what to import</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {(Object.keys(KIND_LABEL) as ImportKind[]).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${kind === option ? 'border-primary bg-primary/[0.06]' : ''}`}
              >
                <input
                  type="radio"
                  name="import-kind"
                  className="mt-1"
                  value={option}
                  checked={kind === option}
                  onChange={() => { setKind(option); setResult(null); setError(null); }}
                />
                <span>{KIND_LABEL[option]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === 'public-seed' ? (
          <p className="mt-4 flex gap-2 rounded-xl border border-physics/40 bg-physics/[0.06] p-4 text-sm" role="note">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 dark:text-physics" aria-hidden="true" />
            <span>{PUBLIC_SEED_WARNING}</span>
          </p>
        ) : null}

        {kind === 'private-file' ? (
          <div className="mt-4">
            <FieldLabel htmlFor="private-import-file">Question file (JSON, from your own device)</FieldLabel>
            <input
              id="private-import-file"
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="tap-target w-full rounded-xl border bg-card p-2 text-sm"
              onChange={(event) => void chooseFile(event.target.files?.[0])}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              The file is read in this tab and sent straight to the server. It is not saved in the browser, not cached,
              and its contents never appear in a log. Answer keys and solutions are stored only in the protected
              solutions collection.
            </p>
            {fileName ? (
              <p className="mt-2 text-sm" role="status">
                {fileName} — {fileItemCount} {fileItemCount === 1 ? 'item' : 'items'} ready.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="outline" disabled={busy !== null || !readyToRun} onClick={() => void run(true)}>
            {busy === 'dry-run' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileUp className="h-4 w-4" aria-hidden="true" />}
            2. Dry run
          </Button>
          <Button
            disabled={busy !== null || result === null || !result.dryRun || result.summary.blocked}
            onClick={() => void run(false)}
          >
            {busy === 'apply' ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            4. Confirm import
          </Button>
          <span className="font-mono text-xs text-muted-foreground">batch {batchId}</span>
        </div>

        {error ? (
          <p className="mt-4 flex gap-2 text-sm text-destructive" role="alert">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}
          </p>
        ) : null}

        {problems.length > 0 ? (
          <ul className="mt-3 space-y-1 text-sm text-destructive" role="alert">
            {problems.map((problem) => (
              <li key={problem.id}><span className="font-mono text-xs">{problem.id}</span> — {problem.outcome}: {problem.reason}</li>
            ))}
          </ul>
        ) : null}

        {result ? (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">3. {result.dryRun ? 'Dry run result' : 'Import result'}</h3>
            <dl className="mt-2 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {([
                ['New', result.summary.create],
                ['Updated', result.summary.update],
                ['Unchanged', result.summary.unchanged],
                ['Conflicts', result.summary.conflict],
                ['Invalid', result.summary.invalid],
                ['Total', result.summary.total],
              ] as const).map(([label, count]) => (
                <div key={label} className="rounded-xl border p-3">
                  <dd className="font-display text-xl font-semibold">{count}</dd>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>

            {result.alreadyApplied ? (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                This batch was already applied. Nothing was written again.
              </p>
            ) : null}

            {result.summary.blocked ? (
              <p className="mt-3 flex gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Nothing will be written while any item conflicts or fails validation. Resolve the items below and run
                the dry run again.
              </p>
            ) : null}

            {notable.length > 0 ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <caption className="sr-only">Per-item import outcome</caption>
                  <thead>
                    <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                      <th scope="col" className="p-2 font-semibold">Item</th>
                      <th scope="col" className="p-2 font-semibold">Outcome</th>
                      <th scope="col" className="p-2 font-semibold">Version</th>
                      <th scope="col" className="p-2 font-semibold">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notable.slice(0, 60).map((decision) => (
                      <tr key={decision.id} className="border-b last:border-0">
                        <td className="p-2 font-mono text-xs">{decision.id}</td>
                        <td className="p-2"><Badge variant="outline">{decision.outcome}</Badge></td>
                        <td className="p-2 text-xs">{decision.existingVersion ?? '—'} → {decision.nextVersion ?? '—'}</td>
                        <td className="p-2 text-xs text-muted-foreground">{decision.reason || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Every item already matches what is stored.</p>
            )}

            {!result.dryRun && !result.summary.blocked ? (
              <p className="mt-4 flex items-center gap-2 text-sm" role="status">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                5. Imported as pending review. Nothing counts as coverage until a named reviewer approves it in the
                review queue above.
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent></Card>
    </section>
  );
}
