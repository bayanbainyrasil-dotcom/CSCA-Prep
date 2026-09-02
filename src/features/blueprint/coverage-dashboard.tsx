import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, LoaderCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FieldLabel, Input } from '@/components/ui/field';
import { BLUEPRINT_CELL_SEED } from '@/data/blueprint-cells';
import { fetchBlueprintCoverage, seedBlueprintCells, type CoverageCell, type CoverageReport } from './blueprint-service';

/**
 * Blueprint coverage for administrators.
 *
 * The one rule of this screen is that nothing shows green unless the cell is
 * genuinely covered: enough reviewer-verified items, in every required language,
 * at every required difficulty and question type. Demo and generated content is
 * counted separately and never turns a cell green.
 */

const STATUS_STYLE: Record<CoverageCell['status'], { label: string; className: string }> = {
  covered: { label: 'Covered', className: 'border-success/30 bg-success/10 text-success' },
  partial: { label: 'Partial', className: 'border-physics/40 bg-physics/10 text-amber-700 dark:text-physics' },
  unverified: { label: 'Unverified', className: 'border-destructive/30 bg-destructive/10 text-destructive' },
  empty: { label: 'Empty', className: 'border-muted-foreground/30 bg-secondary text-muted-foreground' },
};

type ModeFilter = 'all' | 'diagnostic' | 'practice' | 'mock';
type SubjectFilter = 'all' | 'mathematics' | 'physics';
type StatusFilter = 'all' | CoverageCell['status'];

export function BlueprintCoverageDashboard() {
  const [report, setReport] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState<SubjectFilter>('all');
  const [mode, setMode] = useState<ModeFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [reloadToken, setReloadToken] = useState(0);
  const [seeding, setSeeding] = useState<{ done: number; total: number } | null>(null);
  const [seedResult, setSeedResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchBlueprintCoverage()
      .then((next) => { if (!cancelled) { setReport(next); setError(null); } })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Coverage could not be loaded.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reloadToken]);

  const cells = useMemo(() => {
    const all = report?.cells ?? [];
    const query = search.trim().toLowerCase();
    return all.filter((cell) => {
      if (subject !== 'all' && cell.subject !== subject) return false;
      if (mode !== 'all' && !cell.allowedExamModes.includes(mode)) return false;
      if (status !== 'all' && cell.status !== status) return false;
      if (query.length === 0) return true;
      return `${cell.module} ${cell.topic} ${cell.skill} ${cell.microSkill} ${cell.id}`.toLowerCase().includes(query);
    });
  }, [mode, report, search, status, subject]);

  const visibleTotals = useMemo(() => {
    const totals = { covered: 0, partial: 0, unverified: 0, empty: 0 };
    for (const cell of cells) totals[cell.status] += 1;
    return totals;
  }, [cells]);

  const blockers = (report?.issues ?? []).filter((issue) => issue.severity === 'blocker');
  const warnings = (report?.issues ?? []).filter((issue) => issue.severity === 'warning');

  if (loading) {
    return (
      <Card><CardContent className="grid min-h-40 place-items-center p-6 text-center">
        <div>
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground" role="status">Recomputing coverage from the published question bank…</p>
        </div>
      </CardContent></Card>
    );
  }

  if (error || !report) {
    return (
      <Card><CardContent className="p-6">
        <p className="flex gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {error ?? 'Coverage could not be loaded.'}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => { setLoading(true); setReloadToken((value) => value + 1); }}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      </CardContent></Card>
    );
  }

  return (
    <section aria-labelledby="blueprint-coverage-title">
      <Card><CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="data-label">Curriculum blueprint</p>
            <h2 id="blueprint-coverage-title" className="mt-1 font-display text-xl font-semibold tracking-tight">
              Verified coverage
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Computed from the published bank at {new Date(report.generatedAt).toLocaleString()}. Demo and unreviewed
              material is never counted.
            </p>
          </div>
          <Button variant="outline" onClick={() => { setLoading(true); setReloadToken((value) => value + 1); }}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Recompute
          </Button>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['Covered', visibleTotals.covered, CheckCircle2, 'text-success'],
            ['Partial', visibleTotals.partial, TriangleAlert, 'text-amber-700 dark:text-physics'],
            ['Unverified', visibleTotals.unverified, AlertTriangle, 'text-destructive'],
            ['Empty', visibleTotals.empty, CircleDashed, 'text-muted-foreground'],
          ] as const).map(([label, value, Icon, tone]) => (
            <div key={label} className="rounded-xl border p-4">
              <Icon className={`h-4 w-4 ${tone}`} aria-hidden="true" />
              <dd className="mt-3 font-display text-2xl font-semibold">{value}</dd>
              <dt className="text-xs text-muted-foreground">{label} cells</dt>
            </div>
          ))}
        </dl>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <FieldLabel htmlFor="coverage-subject">Subject</FieldLabel>
            <select
              id="coverage-subject"
              className="tap-target w-full rounded-xl border bg-card px-3"
              value={subject}
              onChange={(event) => setSubject(event.target.value as SubjectFilter)}
            >
              <option value="all">All subjects</option>
              <option value="mathematics">Mathematics</option>
              <option value="physics">Physics</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="coverage-mode">Exam mode</FieldLabel>
            <select
              id="coverage-mode"
              className="tap-target w-full rounded-xl border bg-card px-3"
              value={mode}
              onChange={(event) => setMode(event.target.value as ModeFilter)}
            >
              <option value="all">All modes</option>
              <option value="diagnostic">Diagnostic</option>
              <option value="practice">Practice</option>
              <option value="mock">Mock</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="coverage-status">Status</FieldLabel>
            <select
              id="coverage-status"
              className="tap-target w-full rounded-xl border bg-card px-3"
              value={status}
              onChange={(event) => setStatus(event.target.value as StatusFilter)}
            >
              <option value="all">All statuses</option>
              <option value="covered">Covered</option>
              <option value="partial">Partial</option>
              <option value="unverified">Unverified</option>
              <option value="empty">Empty</option>
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="coverage-search">Module, topic or skill</FieldLabel>
            <Input
              id="coverage-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search the blueprint"
            />
          </div>
        </div>
      </CardContent></Card>

      {blockers.length > 0 ? (
        <Card className="mt-4 border-destructive/30"><CardContent className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {blockers.length} {blockers.length === 1 ? 'blocker' : 'blockers'} prevent publication
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {blockers.slice(0, 25).map((issue, index) => (
              <li key={`${issue.code}-${index}`} className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                <span><span className="font-mono text-xs">{issue.code}</span> — {issue.message}</span>
              </li>
            ))}
          </ul>
          {blockers.length > 25 ? (
            <p className="mt-3 text-xs text-muted-foreground">{blockers.length - 25} further blockers are not listed.</p>
          ) : null}
        </CardContent></Card>
      ) : null}

      {warnings.length > 0 ? (
        <Card className="mt-4 border-physics/30"><CardContent className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">Warnings</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {warnings.map((issue, index) => (
              <li key={`${issue.code}-${index}`}><span className="font-mono text-xs">{issue.code}</span> — {issue.message}</li>
            ))}
          </ul>
        </CardContent></Card>
      ) : null}

      <Card className="mt-4"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <caption className="sr-only">
              Blueprint cells with their verified coverage, required difficulties, question types, languages and review state
            </caption>
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="p-3 font-semibold">Status</th>
                <th scope="col" className="p-3 font-semibold">Module / topic</th>
                <th scope="col" className="p-3 font-semibold">Micro-skill</th>
                <th scope="col" className="p-3 font-semibold">Verified / required</th>
                <th scope="col" className="p-3 font-semibold">Difficulty</th>
                <th scope="col" className="p-3 font-semibold">Question types</th>
                <th scope="col" className="p-3 font-semibold">Languages</th>
                <th scope="col" className="p-3 font-semibold">Review</th>
                <th scope="col" className="p-3 font-semibold">Why not covered</th>
              </tr>
            </thead>
            <tbody>
              {cells.map((cell) => {
                const style = STATUS_STYLE[cell.status];
                return (
                  <tr key={cell.id} className="border-b align-top last:border-0">
                    <td className="p-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${style.className}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="block font-semibold">{cell.module}</span>
                      <span className="block text-xs text-muted-foreground">{cell.topic}</span>
                    </td>
                    <td className="p-3">
                      <span className="block">{cell.microSkill}</span>
                      <span className="block font-mono text-[0.65rem] text-muted-foreground">{cell.id}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold">{cell.verifiedItems}</span> / {cell.minimumItems}
                      <span className="block text-xs text-muted-foreground">
                        {cell.totalItems} authored{cell.demoItems > 0 ? `, ${cell.demoItems} demo` : ''}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{cell.difficultyLevels.join(', ')}</td>
                    <td className="p-3 text-xs">{cell.questionTypes.join(', ')}</td>
                    <td className="p-3 text-xs">
                      {cell.languages.length > 0 ? cell.languages.join(', ') : '—'}
                      {cell.missingLanguages.length > 0 ? (
                        <span className="block text-destructive">missing {cell.missingLanguages.join(', ')}</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs">
                      <span className="block">{cell.verificationStatus}</span>
                      <span className="block text-muted-foreground">{cell.sourceType}</span>
                      {cell.reviewer ? <span className="block text-muted-foreground">{cell.reviewer}</span> : null}
                      {cell.reviewedAt ? (
                        <span className="block text-muted-foreground">{new Date(cell.reviewedAt).toLocaleDateString()}</span>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {cell.status === 'covered' ? '—' : cell.reasons.join(' ')}
                      {cell.knownLimitations ? <span className="block">{cell.knownLimitations}</span> : null}
                    </td>
                  </tr>
                );
              })}
              {cells.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-sm text-muted-foreground" colSpan={9}>
                    {report.cells.length === 0
                      ? 'No blueprint cell has been authored yet, so no exam can be published.'
                      : 'No cell matches these filters.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent></Card>

      {report.cells.length === 0 ? (
        <Card className="mt-4"><CardContent className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">Load the curriculum requirements</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The repository carries a drafted blueprint of {BLUEPRINT_CELL_SEED.length} micro-skills derived from the
            recorded CSCA topic list. Uploading it states what the curriculum requires; every cell is written as
            <strong> draft</strong> with no reviewer and no review date, and certifies nothing on its own.
          </p>
          <Button
            className="mt-4"
            disabled={seeding !== null}
            onClick={() => {
              setSeedResult(null);
              setSeeding({ done: 0, total: BLUEPRINT_CELL_SEED.length });
              void seedBlueprintCells(BLUEPRINT_CELL_SEED, (done, total) => setSeeding({ done, total }))
                .then((outcome) => {
                  setSeedResult(
                    outcome.failures.length === 0
                      ? `${outcome.created} blueprint cells written as draft.`
                      : `${outcome.created} written, ${outcome.failures.length} rejected: ${outcome.failures.slice(0, 3).map((entry) => `${entry.cellId} (${entry.message})`).join('; ')}`,
                  );
                  setReloadToken((value) => value + 1);
                })
                .catch((cause: unknown) => {
                  setSeedResult(cause instanceof Error ? cause.message : 'The blueprint could not be uploaded.');
                })
                .finally(() => setSeeding(null));
            }}
          >
            {seeding ? `Uploading ${seeding.done} / ${seeding.total}…` : `Upload ${BLUEPRINT_CELL_SEED.length} draft cells`}
          </Button>
          {seedResult ? <p className="mt-3 text-sm text-muted-foreground" role="status">{seedResult}</p> : null}
        </CardContent></Card>
      ) : null}

      {report.orphanQuestionIds.length > 0 ? (
        <Card className="mt-4"><CardContent className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {report.orphanQuestionIds.length} published {report.orphanQuestionIds.length === 1 ? 'question belongs' : 'questions belong'} to no blueprint cell
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            These are served to learners but measure nothing the blueprint asks for. Assign a cell or unpublish them.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {report.orphanQuestionIds.slice(0, 40).map((questionId) => (
              <li key={questionId}>
                <Badge variant="outline">{questionId}</Badge>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      ) : null}
    </section>
  );
}
