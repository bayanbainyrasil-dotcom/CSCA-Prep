import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleHelp, ExternalLink, LoaderCircle, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel, Input, Textarea } from '@/components/ui/field';
import {
  fetchOutlineReviews,
  readOutlineProblems,
  recordOutlineReview,
  type OutlineCell,
} from './blueprint-service';

/**
 * The official-outline comparison screen.
 *
 * It shows what this blueprint claims a cell requires, beside the source the
 * reviewer recorded for it — a link and dated metadata, never the official
 * material itself. The reviewer reads the source in its own tab and records a
 * judgement here in their own words.
 *
 * Recording a judgement here changes nothing about coverage. That is stated on
 * the screen, because a reviewer who believes otherwise would be misled about
 * what their approval means.
 */

type ReviewStatus = 'matches-source' | 'difference-found' | 'needs-specialist' | 'superseded';

const STATUS_LABEL: Record<string, string> = {
  unreviewed: 'Not yet checked',
  'matches-source': 'Matches the source',
  'difference-found': 'Difference found',
  'needs-specialist': 'Needs a specialist',
  superseded: 'Superseded',
};

const RECORDABLE: ReviewStatus[] = ['matches-source', 'difference-found', 'needs-specialist', 'superseded'];
const NOTE_REQUIRED: ReviewStatus[] = ['difference-found', 'needs-specialist', 'superseded'];

interface DraftReview {
  status: ReviewStatus;
  sourceUrl: string;
  sourceTitle: string;
  sourceEdition: string;
  sourcePublishedAt: string;
  differenceNote: string;
  ownSummary: string;
  ownWordsAttested: boolean;
}

const EMPTY_DRAFT: DraftReview = {
  status: 'matches-source',
  sourceUrl: '',
  sourceTitle: '',
  sourceEdition: '',
  sourcePublishedAt: '',
  differenceNote: '',
  ownSummary: '',
  ownWordsAttested: false,
};

/** A review is only current while the cell it judged is unchanged. */
function isStale(cell: OutlineCell): boolean {
  return (
    cell.review.status !== 'unreviewed' &&
    cell.review.reviewedCellVersion !== null &&
    cell.review.reviewedCellVersion !== cell.version
  );
}

function statusTone(cell: OutlineCell): 'default' | 'success' | 'outline' {
  if (isStale(cell) || cell.review.status === 'unreviewed') return 'outline';
  return cell.review.status === 'matches-source' ? 'success' : 'default';
}

export function OutlineReviewPanel() {
  const [cells, setCells] = useState<OutlineCell[] | null>(null);
  const [subject, setSubject] = useState<'all' | 'mathematics' | 'physics'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftReview>(EMPTY_DRAFT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ code: string; message: string }[]>([]);
  const headingId = useId();

  const [reloadToken, setReloadToken] = useState(0);
  const load = useCallback(() => setReloadToken((value) => value + 1), []);

  // Same shape as the coverage dashboard: the fetch settles outside render and
  // a cancelled flag stops a late response from overwriting a newer one.
  useEffect(() => {
    let cancelled = false;
    fetchOutlineReviews(subject === 'all' ? undefined : subject)
      .then((next) => { if (!cancelled) { setCells(next); setError(null); } })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setCells([]);
          setError(cause instanceof Error ? cause.message : 'The blueprint could not be read.');
        }
      });
    return () => { cancelled = true; };
  }, [subject, reloadToken]);

  const selected = useMemo(() => cells?.find((cell) => cell.id === selectedId) ?? null, [cells, selectedId]);

  const counts = useMemo(() => {
    const tally = { total: 0, unreviewed: 0, confirmed: 0, difference: 0, specialist: 0, superseded: 0, stale: 0 };
    for (const cell of cells ?? []) {
      tally.total += 1;
      if (cell.review.status === 'unreviewed') tally.unreviewed += 1;
      else if (isStale(cell)) tally.stale += 1;
      else if (cell.review.status === 'matches-source') tally.confirmed += 1;
      else if (cell.review.status === 'difference-found') tally.difference += 1;
      else if (cell.review.status === 'needs-specialist') tally.specialist += 1;
      else if (cell.review.status === 'superseded') tally.superseded += 1;
    }
    return tally;
  }, [cells]);

  const select = (cell: OutlineCell) => {
    setSelectedId(cell.id);
    setProblems([]);
    setError(null);
    // Carry the previous source forward: a reviewer usually works through many
    // cells against the same document, and retyping it invites mistakes.
    setDraft((previous) => ({
      ...EMPTY_DRAFT,
      sourceUrl: cell.review.sourceUrl ?? previous.sourceUrl,
      sourceTitle: cell.review.sourceTitle ?? previous.sourceTitle,
      sourceEdition: cell.review.sourceEdition ?? previous.sourceEdition,
      sourcePublishedAt: cell.review.sourcePublishedAt ?? previous.sourcePublishedAt,
    }));
  };

  const submit = async () => {
    if (!selected || !draft.ownWordsAttested) return;
    setBusy(true);
    setError(null);
    setProblems([]);
    try {
      await recordOutlineReview({
        cellId: selected.id,
        status: draft.status,
        expectedCellVersion: selected.version,
        sourceUrl: draft.sourceUrl.trim() || null,
        sourceTitle: draft.sourceTitle.trim() || null,
        sourceEdition: draft.sourceEdition.trim() || null,
        sourcePublishedAt: draft.sourcePublishedAt || null,
        differenceNote: draft.differenceNote,
        ownSummary: draft.ownSummary,
        ownWordsAttested: true,
      });
      setSelectedId(null);
      setDraft(EMPTY_DRAFT);
      load();
    } catch (cause) {
      setProblems(readOutlineProblems(cause));
      setError(cause instanceof Error ? cause.message : 'The review could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  const noteRequired = NOTE_REQUIRED.includes(draft.status);
  const sourceRequired = draft.status !== 'needs-specialist';
  const canSubmit =
    selected !== null &&
    draft.ownWordsAttested &&
    (!noteRequired || draft.differenceNote.trim().length >= 10) &&
    (!sourceRequired || (draft.sourceUrl.trim() !== '' && draft.sourceTitle.trim() !== '' && /^\d{4}-\d{2}-\d{2}$/.test(draft.sourcePublishedAt)));

  return (
    <section className="mt-4" aria-labelledby={headingId}>
      <Card><CardContent className="p-5 sm:p-6">
        <p className="data-label">Official outline</p>
        <h2 id={headingId} className="mt-1 font-display text-xl font-semibold tracking-tight">
          Compare the blueprint against the current source
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          This records whether a cell still corresponds to something the official materials require. It is a different
          question from whether a question is correct, and it changes no coverage number: a cell confirmed here still
          needs human-approved questions before it counts.
        </p>
        <p className="mt-2 flex gap-2 rounded-xl border border-physics/40 bg-physics/[0.06] p-3 text-xs" role="note">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-physics" aria-hidden="true" />
          <span>
            Record a link, the document name and its date, and your own short description. Do not paste text from the
            official materials into this screen.
          </span>
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <FieldLabel htmlFor="outline-subject" className="mb-0">Subject</FieldLabel>
          <select
            id="outline-subject"
            className="tap-target rounded-xl border bg-card px-3 text-sm"
            value={subject}
            onChange={(event) => { setSubject(event.target.value as typeof subject); setSelectedId(null); }}
          >
            <option value="all">All</option>
            <option value="mathematics">Mathematics</option>
            <option value="physics">Physics</option>
          </select>
          <Button variant="outline" onClick={load}>
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />Reload
          </Button>
        </div>

        {cells === null ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Reading the blueprint…
          </p>
        ) : (
          <>
            <dl className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {([
                ['Cells', counts.total],
                ['Not checked', counts.unreviewed],
                ['Matches source', counts.confirmed],
                ['Difference', counts.difference],
                ['Needs specialist', counts.specialist],
                ['Stale', counts.stale],
              ] as const).map(([label, count]) => (
                <div key={label} className="rounded-xl border p-3">
                  <dd className="font-display text-xl font-semibold">{count}</dd>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>

            {counts.stale > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                {counts.stale} {counts.stale === 1 ? 'review has' : 'reviews have'} lapsed because the cell changed after
                the check. They no longer count and need re-reading.
              </p>
            ) : null}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <caption className="sr-only">Blueprint cells and their outline review state</caption>
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="p-2 font-semibold">Cell</th>
                    <th scope="col" className="p-2 font-semibold">What this blueprint claims</th>
                    <th scope="col" className="p-2 font-semibold">Recorded source</th>
                    <th scope="col" className="p-2 font-semibold">State</th>
                    <th scope="col" className="p-2 font-semibold"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {cells.map((cell) => (
                    <tr key={cell.id} className="border-b align-top last:border-0">
                      <td className="p-2 font-mono text-xs">{cell.id}</td>
                      <td className="p-2">
                        <span className="block text-xs text-muted-foreground">{cell.topic} · {cell.skill}</span>
                        {cell.microSkill}
                      </td>
                      <td className="p-2 text-xs">
                        {cell.review.sourceUrl ? (
                          <a className="inline-flex items-center gap-1 underline" href={cell.review.sourceUrl} target="_blank" rel="noreferrer noopener">
                            {cell.review.sourceTitle ?? cell.review.sourceUrl}
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        ) : <span className="text-muted-foreground">—</span>}
                        {cell.review.sourcePublishedAt ? (
                          <span className="block text-muted-foreground">dated {cell.review.sourcePublishedAt}</span>
                        ) : null}
                        {cell.review.reviewer ? (
                          <span className="block text-muted-foreground">{cell.review.reviewer}, {cell.review.reviewedAt?.slice(0, 10)}</span>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <Badge variant={statusTone(cell)}>
                          {isStale(cell) ? 'Lapsed — cell changed' : STATUS_LABEL[cell.review.status]}
                        </Badge>
                        {cell.review.differenceNote ? (
                          <span className="mt-1 block text-xs text-muted-foreground">{cell.review.differenceNote}</span>
                        ) : null}
                      </td>
                      <td className="p-2">
                        <Button variant="outline" size="sm" onClick={() => select(cell)}>
                          {cell.review.status === 'unreviewed' ? 'Check' : 'Re-check'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {selected ? (
          <div className="mt-6 rounded-2xl border p-4 sm:p-5">
            <h3 className="font-display text-lg font-semibold">Record a check for {selected.id}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Cell version {selected.version}. The check is recorded against this version and lapses if the cell is edited.
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <FieldLabel htmlFor="outline-status">What did you find?</FieldLabel>
                <select
                  id="outline-status"
                  className="tap-target w-full rounded-xl border bg-card px-3 text-sm"
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value as ReviewStatus })}
                >
                  {RECORDABLE.map((status) => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
                </select>
              </div>

              <div>
                <FieldLabel htmlFor="outline-source-url">Source link{sourceRequired ? '' : ' (optional)'}</FieldLabel>
                <Input id="outline-source-url" type="url" inputMode="url" value={draft.sourceUrl}
                  onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor="outline-source-title">Document name{sourceRequired ? '' : ' (optional)'}</FieldLabel>
                <Input id="outline-source-title" value={draft.sourceTitle}
                  onChange={(event) => setDraft({ ...draft, sourceTitle: event.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor="outline-source-edition">Edition (optional)</FieldLabel>
                <Input id="outline-source-edition" value={draft.sourceEdition}
                  onChange={(event) => setDraft({ ...draft, sourceEdition: event.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor="outline-source-date">Source publication date{sourceRequired ? '' : ' (optional)'}</FieldLabel>
                <Input id="outline-source-date" type="date" value={draft.sourcePublishedAt}
                  onChange={(event) => setDraft({ ...draft, sourcePublishedAt: event.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="outline-own-summary">Your own one-line description of what the source requires</FieldLabel>
                <Input id="outline-own-summary" maxLength={400} value={draft.ownSummary}
                  onChange={(event) => setDraft({ ...draft, ownSummary: event.target.value })} />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel htmlFor="outline-difference">
                  {noteRequired ? 'What differs, or what a specialist must settle' : 'Notes (optional)'}
                </FieldLabel>
                <Textarea id="outline-difference" rows={3} maxLength={1000} value={draft.differenceNote}
                  onChange={(event) => setDraft({ ...draft, differenceNote: event.target.value })} />
              </div>
            </div>

            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={draft.ownWordsAttested}
                onChange={(event) => setDraft({ ...draft, ownWordsAttested: event.target.checked })} />
              <span>These are my own words. I have not pasted text from the official materials.</span>
            </label>

            {problems.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-destructive" role="alert">
                {problems.map((problem) => <li key={problem.code}>{problem.message}</li>)}
              </ul>
            ) : null}
            {error && problems.length === 0 ? (
              <p className="mt-3 flex gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Button disabled={!canSubmit || busy} onClick={() => void submit()}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                Record this check
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => setSelectedId(null)}>Cancel</Button>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                Recording this does not mark any question verified.
              </span>
            </div>
          </div>
        ) : null}
      </CardContent></Card>
    </section>
  );
}
