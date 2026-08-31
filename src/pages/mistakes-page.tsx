import { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, RefreshCcw, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { clearMistake, readMistakes, type MistakeEntry } from '@/features/practice/history';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';

type DisplayMistake = MistakeEntry & { storeId?: string };

export default function MistakesPage() {
  const { user } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const records = useAppStore((state) => state.mistakes);
  const resolveMistake = useAppStore((state) => state.resolveMistake);
  const [legacy, setLegacy] = useState(() => readMistakes(ownerId));
  const [pending, setPending] = useState<string | null>(null);
  const mistakes = useMemo<DisplayMistake[]>(() => {
    const legacyByQuestion = new Map(legacy.map((item) => [item.questionId, item]));
    const live = Object.values(records).filter((item) => !item.resolved).map((item) => {
      const fallback = legacyByQuestion.get(item.questionId);
      return {
        id: item.id,
        storeId: item.id,
        questionId: item.questionId,
        question: item.question ?? fallback?.question ?? `Question ${item.questionId}`,
        userAnswer: item.userAnswerText ?? fallback?.userAnswer ?? item.selectedAnswer ?? 'Skipped',
        correctAnswer: item.correctAnswerText ?? fallback?.correctAnswer ?? item.correctAnswer,
        reason: item.reason ?? fallback?.reason ?? 'Review the concept and identify the first uncertain step.',
        solution: item.solution ?? fallback?.solution ?? 'Open a similar question to rebuild the solution path.',
        topic: item.topic ?? fallback?.topic ?? item.topicId,
        mistakeType: item.errorType ?? fallback?.mistakeType ?? 'unclassified',
        date: item.lastSeenAt,
        repeatedAttempts: item.repeatedAttempts,
        nextReview: item.nextReviewAt,
      };
    });
    const liveQuestionIds = new Set(live.map((item) => item.questionId));
    return [...live, ...legacy.filter((item) => !liveQuestionIds.has(item.questionId))]
      .sort((left, right) => right.date.localeCompare(left.date));
  }, [legacy, records]);

  const clear = async (item: DisplayMistake) => {
    setPending(item.id);
    try {
      if (item.storeId) await resolveMistake(item.storeId);
      clearMistake(ownerId, item.id);
      setLegacy(readMistakes(ownerId));
      toast.success('Marked as repaired');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update this mistake.');
    } finally {
      setPending(null);
    }
  };

  return <div>
    <PageHeading eyebrow="Mistake notebook" title="Turn every lost point into a review event." description="Errors are saved automatically with the reason, solution, repeat count and next review." actions={mistakes.length ? <Badge variant="warning">{mistakes.length} to repair</Badge> : undefined} />
    {mistakes.length ? <div className="space-y-3">{mistakes.map((item) => <Card key={item.id}><CardContent className="p-5 sm:p-6"><div className="flex flex-col gap-5 lg:flex-row lg:items-start"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><TriangleAlert className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap gap-2"><Badge variant="outline">{item.topic}</Badge><Badge variant="warning">{item.mistakeType.replaceAll('-', ' ')}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Review {new Date(item.nextReview).toLocaleDateString()}</span></div><h2 className="mt-3 text-sm font-semibold leading-6">{item.question}</h2><div className="mt-4 grid gap-2 sm:grid-cols-2"><div className="rounded-xl bg-destructive/[0.045] p-3 text-sm"><span className="data-label">Your answer</span><p className="mt-1 font-semibold">{item.userAnswer}</p></div><div className="rounded-xl bg-success/[0.055] p-3 text-sm"><span className="data-label">Correct</span><p className="mt-1 font-semibold text-success">{item.correctAnswer}</p></div></div><details className="mt-3 rounded-xl border p-3 text-sm"><summary className="cursor-pointer font-semibold">Why it failed & solution</summary><p className="mt-2 text-muted-foreground"><strong className="text-foreground">Reason:</strong> {item.reason}</p><p className="mt-2 text-muted-foreground"><strong className="text-foreground">Solution:</strong> {item.solution}</p></details><p className="mt-2 text-[0.68rem] text-muted-foreground">Seen {item.repeatedAttempts} time{item.repeatedAttempts === 1 ? '' : 's'} · last attempt {new Date(item.date).toLocaleDateString()}</p></div><div className="flex shrink-0 gap-2 lg:flex-col"><Button asChild><Link to={`/practice/session?mode=mistakes&question=${encodeURIComponent(item.questionId)}`}><RefreshCcw className="h-4 w-4" />Try similar</Link></Button><Button variant="ghost" disabled={pending === item.id} onClick={() => void clear(item)}>{pending === item.id ? 'Saving…' : 'Mark repaired'}</Button></div></div></CardContent></Card>)}</div> : <Card><CardContent className="p-10 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></span><h2 className="mt-5 font-display text-2xl font-semibold">No saved mistakes yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Incorrect practice answers will appear here automatically after you classify the reason.</p><Button className="mt-6" asChild><Link to="/practice">Start practice</Link></Button></CardContent></Card>}
  </div>;
}
