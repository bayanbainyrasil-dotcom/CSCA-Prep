import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, RefreshCw, ShieldQuestion } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { fetchReviewQueue, setContentVerification, type ReviewItem } from './blueprint-service';

/**
 * The human review step.
 *
 * Nothing on this screen approves anything by itself. A reviewer reads the whole
 * packet — prompt, options, key, full and short solution, common mistakes,
 * blueprint mapping, difficulty, type, source and content version — and then
 * makes an explicit decision. The server records who they are and when, and
 * refuses the approval if the item changed while it was open.
 */

const PENDING_STATES = new Set(['pending-review', 'draft', 'unverified', 'author-checked']);

type Decision = 'reviewer-verified' | 'draft';

export function ReviewQueue({ onReviewed }: { onReviewed?: () => void }) {
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchReviewQueue()
      .then((next) => { if (!cancelled) { setItems(next); setError(null); } })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'The review queue could not be loaded.');
      });
    return () => { cancelled = true; };
  }, [reloadToken]);

  const pending = useMemo(
    () => (items ?? []).filter((item) => PENDING_STATES.has(String(item.question?.verificationStatus ?? 'unverified'))),
    [items],
  );
  const verified = useMemo(
    () => (items ?? []).filter((item) => item.question?.verificationStatus === 'reviewer-verified'),
    [items],
  );

  const decide = async (item: ReviewItem, decision: Decision) => {
    setBusyId(item.id);
    setMessage(null);
    try {
      const result = await setContentVerification({
        target: 'question',
        targetId: item.id,
        verificationStatus: decision,
        contentVersion: item.expectedVersion,
      });
      setMessage(
        decision === 'reviewer-verified'
          ? `${item.id} approved by ${result.reviewer ?? 'the signed-in reviewer'} at version ${String(result.verifiedContentVersion)}.`
          : `${item.id} sent back as draft.`,
      );
      setReloadToken((value) => value + 1);
      onReviewed?.();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'That decision could not be recorded.');
    } finally {
      setBusyId(null);
    }
  };

  if (items === null && error === null) {
    return (
      <Card className="mt-4"><CardContent className="grid min-h-32 place-items-center p-6 text-center">
        <div>
          <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground" role="status">Loading the review queue…</p>
        </div>
      </CardContent></Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4"><CardContent className="p-5 sm:p-6">
        <p className="flex gap-2 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
        </Button>
      </CardContent></Card>
    );
  }

  return (
    <section className="mt-4" aria-labelledby="review-queue-title">
      <Card><CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="data-label">Human review</p>
            <h2 id="review-queue-title" className="mt-1 font-display text-xl font-semibold tracking-tight">
              {pending.length} awaiting review · {verified.length} approved
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Approval records your identity and the server time against the exact content version you read. If the item
              changes afterwards, the approval stops counting and it returns here.
            </p>
          </div>
          <Button variant="outline" onClick={() => setReloadToken((value) => value + 1)}>
            <RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </Button>
        </div>

        {message ? <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p> : null}

        {pending.length === 0 ? (
          <p className="mt-5 flex gap-2 rounded-xl border p-4 text-sm text-muted-foreground">
            <ShieldQuestion className="h-4 w-4 shrink-0" aria-hidden="true" />
            Nothing is waiting for review. Authored items appear here as soon as they are imported.
          </p>
        ) : (
          <ul className="mt-5 space-y-3">
            {pending.map((item) => {
              const question = item.question!;
              const open = expanded === item.id;
              return (
                <li key={item.id} className="rounded-xl border">
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{question.question}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{item.id} · version {item.expectedVersion}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{String(question.verificationStatus ?? 'unverified')}</Badge>
                        <Badge variant="outline">{question.cellId ?? 'no blueprint cell'}</Badge>
                        <Badge variant="outline">difficulty {question.difficulty}</Badge>
                        <Badge variant="outline">{question.questionType ?? 'no type'}</Badge>
                        <Badge variant="outline">{question.language}</Badge>
                      </div>
                    </div>
                    <Button variant="outline" aria-expanded={open} onClick={() => setExpanded(open ? null : item.id)}>
                      {open ? 'Hide packet' : 'Read packet'}
                    </Button>
                  </div>

                  {open ? (
                    <div className="border-t p-4 text-sm">
                      {question.questionTranslation ? (
                        <p className="text-muted-foreground">{question.questionTranslation}</p>
                      ) : null}
                      <ol className="mt-3 space-y-1">
                        {question.options.map((option) => (
                          <li key={option.id} className={option.id === question.correctAnswer ? 'font-semibold text-success' : ''}>
                            {option.id}. {option.text}
                            {option.id === question.correctAnswer ? ' — marked correct' : ''}
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3"><strong>Full solution.</strong> {question.solution}</p>
                      <p className="mt-2"><strong>Short solution.</strong> {question.shortSolution}</p>
                      <p className="mt-2"><strong>Explanation.</strong> {question.explanation}</p>
                      {question.commonMistakes.length > 0 ? (
                        <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                          {question.commonMistakes.map((mistake) => (
                            <li key={mistake.id}>{mistake.description}</li>
                          ))}
                        </ul>
                      ) : null}
                      <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <div><dt className="font-semibold">Module / topic</dt><dd>{question.module} · {question.topicId}</dd></div>
                        <div><dt className="font-semibold">Skill</dt><dd>{question.skill}</dd></div>
                        <div><dt className="font-semibold">Source</dt><dd>{question.sourceType} · {question.sourceReference ?? question.sourceNote ?? '—'}</dd></div>
                        <div><dt className="font-semibold">Parameters</dt><dd className="font-mono">{JSON.stringify(question.templateParameters ?? {})}</dd></div>
                      </dl>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Automatic checks confirm the arithmetic is self-consistent and the mapping fits the cell. They do
                        not judge whether this is a good exam question — that is what your reading decides.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Button variant="outline" disabled={busyId === item.id} onClick={() => void decide(item, 'draft')}>
                          Send back as draft
                        </Button>
                        <Button disabled={busyId === item.id} onClick={() => void decide(item, 'reviewer-verified')}>
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          {busyId === item.id ? 'Recording…' : `Approve version ${item.expectedVersion}`}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent></Card>
    </section>
  );
}
