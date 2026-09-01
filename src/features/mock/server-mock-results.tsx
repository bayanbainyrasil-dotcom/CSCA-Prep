import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, LoaderCircle, Target, TriangleAlert, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { describeMockError } from '@/features/mock/server-mock-runner';
import { reviewServerMockExam, type MockReview } from '@/features/mock/mock-service';

/**
 * Post-exam review for a server-graded attempt.
 *
 * Every number and every solution on this screen comes from `reviewMockExam`,
 * which the server answers only once the attempt is submitted. Nothing here is
 * recomputed in the browser.
 */
export function ServerMockResults({ attemptId }: { attemptId: string }) {
  const [review, setReview] = useState<MockReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void reviewServerMockExam({ attemptId })
      .then((response) => { if (!cancelled) { setReview(response); setError(null); } })
      .catch((cause: unknown) => { if (!cancelled) setError(describeMockError(cause)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attemptId]);

  if (loading) {
    return (
      <div className="grid min-h-[40vh] place-items-center text-center">
        <div>
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground" role="status">Loading your graded attempt…</p>
        </div>
      </div>
    );
  }

  if (error || !review || !review.result) {
    return (
      <div>
        <PageHeading title="This attempt is not available." description="Solutions and scores appear once an attempt has been submitted and graded on the server." />
        <p className="mb-5 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm text-destructive" role="alert">
          <AlertTriangle className="h-4 w-4 shrink-0" />{error ?? 'No graded result was returned for this attempt.'}
        </p>
        <Button asChild><Link to="/mock"><ArrowLeft className="h-4 w-4" /> Mock exams</Link></Button>
      </div>
    );
  }

  const { result } = review;
  const total = result.correct + result.wrong + result.skipped;
  const accuracy = Math.round(result.accuracy * 100);
  const topicRows = Object.entries(result.topicScores).sort(([, left], [, right]) => left - right);

  return (
    <div>
      <PageHeading
        eyebrow="Post-exam analysis"
        title={`${accuracy}% · ${result.correct} of ${total} correct`}
        description="Graded on the server from the private solution set. Answers were locked when you submitted."
        actions={<Badge variant="outline">Server-graded</Badge>}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([
          [CheckCircle2, String(result.correct), 'Correct', 'text-success'],
          [XCircle, String(result.wrong), 'Wrong', 'text-destructive'],
          [TriangleAlert, String(result.skipped), 'Skipped', 'text-amber-700 dark:text-physics'],
          [Clock3, `${Math.round(result.averageTimeSeconds)}s`, 'Average per answer', 'text-primary'],
        ] as const).map(([Icon, value, label, color]) => (
          <Card key={label}><CardContent className="p-5">
            <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
            <p className="mt-4 font-display text-3xl font-semibold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="content-grid mt-5">
        <Card className="lg:col-span-8"><CardContent className="p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold tracking-tight">Score by topic</h2>
          <ul className="mt-5 space-y-3">
            {topicRows.map(([topicId, score]) => (
              <li key={topicId}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{topicId}</span>
                  <span className="text-muted-foreground">{Math.round(score * 100)}%</span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.round(score * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </CardContent></Card>
        <Card className="lg:col-span-4"><CardContent className="p-5 sm:p-6">
          <Target className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">Suggested repair</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Start with the lowest topic score, work one lesson on it, then retry similar questions.
          </p>
          <Button className="mt-5 w-full" asChild><Link to="/practice/session?mode=weak-topics">Start weak-topic practice</Link></Button>
          <Button variant="ghost" className="mt-2 w-full" asChild><Link to="/mock">Back to mocks</Link></Button>
        </CardContent></Card>
      </div>

      <Card className="mt-5"><CardContent className="p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold tracking-tight">Question review</h2>
        <ol className="mt-5 space-y-4">
          {review.questions.map((item, index) => (
            <li key={item.questionId} className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-muted-foreground">Question {index + 1}</span>
                <Badge variant="outline">
                  {item.selectedAnswer === null ? 'Skipped' : item.isCorrect ? 'Correct' : 'Wrong'}
                </Badge>
              </div>
              {item.prompt ? (
                <p className="mt-2 text-sm leading-relaxed">{item.prompt.question}</p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Your answer: {item.selectedAnswer ?? '—'} · Correct answer: {item.correctAnswer ?? '—'}
              </p>
              {item.shortSolution ? <p className="mt-2 text-sm">{item.shortSolution}</p> : null}
              {item.explanation ? (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.explanation}</p>
              ) : null}
            </li>
          ))}
        </ol>
      </CardContent></Card>
    </div>
  );
}
