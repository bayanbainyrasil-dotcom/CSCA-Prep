import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { AlertTriangle, Bookmark, ChevronLeft, ChevronRight, CloudOff, Grid3X3, LoaderCircle, LogOut, RefreshCw, Timer } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { QuestionNavigator } from '@/features/mock/question-navigator';
import {
  resumeServerMockExam,
  saveServerMockAnswer,
  startServerMockExam,
  submitServerMockExam,
  type OpenMockAttempt,
} from '@/features/mock/mock-service';
import { cn } from '@/lib/utils';

/**
 * Production mock runner.
 *
 * This component never sees a correct answer: it renders prompts returned by
 * `startMockExam`/`resumeMockExam`, sends selections to `saveMockAnswer`, and
 * shows only what `submitMockExam` reports. It does not import the built-in
 * template questions, does not compute a score, and does not write status,
 * `questionIds` or `durationSeconds` anywhere.
 *
 * The only thing kept in browser storage is the attempt id, so a reload can ask
 * the server to restore the attempt. Answers and timing are never restored from
 * the device.
 */

export const attemptPointerKey = (ownerId: string, mockExamId: string) =>
  `csca-mock-attempt-v1:${ownerId}:${mockExamId}`;

/**
 * Mutation ids are built from a token created once when this module loads plus
 * a counter, so they are unique across reloads without calling a clock or a
 * random source while rendering. Reusing an id is how a retry stays a no-op, so
 * the id must belong to the user action, not to the attempt.
 */
const RUNNER_SESSION = nanoid(10);
let mutationSequence = 0;

function nextMutationId(attemptId: string): string {
  mutationSequence += 1;
  return `${attemptId}:${RUNNER_SESSION}:${mutationSequence}`;
}

function readStoredAttemptId(pointerKey: string): string | null {
  try {
    return localStorage.getItem(pointerKey);
  } catch {
    return null;
  }
}

type Phase = 'idle' | 'loading' | 'ready' | 'submitting' | 'error';
type SaveState = 'saved' | 'saving' | 'failed';

interface PendingSave {
  questionId: string;
  selectedAnswer: string | null;
  mutationId: string;
  currentQuestionIndex: number;
  flaggedQuestionIds: string[];
}

/** Friendly text for the small set of failures a learner can act on. */
export function describeMockError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code.includes('deadline-exceeded')) return 'The exam time has ended. Submit to see your result.';
  if (code.includes('unauthenticated')) return 'Your session expired. Sign in again to continue this attempt.';
  if (code.includes('permission-denied')) return 'This attempt belongs to another account.';
  if (code.includes('not-found')) return 'This mock exam is no longer available.';
  if (code.includes('failed-precondition')) return 'This attempt can no longer be changed.';
  if (code.includes('resource-exhausted')) return 'Too many requests. Wait a moment and try again.';
  if (code.includes('unavailable') || code.includes('internal')) return 'The exam service is unreachable. Your last answer will be retried.';
  return 'Something went wrong. Your progress is saved on the server; try again.';
}

export interface ServerMockRunnerProps {
  ownerId: string;
  mockExamId: string;
  deviceId: string;
}

export function ServerMockRunner({ ownerId, mockExamId, deviceId }: ServerMockRunnerProps) {
  const navigate = useNavigate();
  const pointerKey = attemptPointerKey(ownerId, mockExamId);
  const [storedAttemptId] = useState<string | null>(() => readStoredAttemptId(pointerKey));
  const [phase, setPhase] = useState<Phase>(storedAttemptId ? 'loading' : 'idle');
  const [attempt, setAttempt] = useState<OpenMockAttempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [message, setMessage] = useState<string | null>(null);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [resumed, setResumed] = useState(false);
  const pendingRef = useRef<PendingSave | null>(null);
  const submitMutationRef = useRef<string | null>(null);

  const questions = attempt?.questions ?? [];
  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const total = questions.length;
  const expired = attempt !== null && remaining === 0;

  const adopt = useCallback((next: OpenMockAttempt) => {
    setAttempt(next);
    setAnswers(
      Object.fromEntries(
        next.answers
          .filter((answer): answer is { questionId: string; selectedAnswer: string } => answer.selectedAnswer !== null)
          .map((answer) => [answer.questionId, answer.selectedAnswer]),
      ),
    );
    setFlagged(next.flaggedQuestionIds);
    setCurrentIndex(Math.min(next.currentQuestionIndex, Math.max(0, next.questions.length - 1)));
    setRemaining(next.remainingSeconds);
    setPhase('ready');
    setMessage(null);
  }, []);

  // Safe recovery: only the attempt id lives on the device, so the server
  // decides what the attempt contains and how much time is left.
  useEffect(() => {
    let cancelled = false;
    if (!storedAttemptId) return;

    void resumeServerMockExam({ attemptId: storedAttemptId })
      .then((response) => {
        if (cancelled) return;
        if (response.attempt.status !== 'in-progress') {
          try { localStorage.removeItem(pointerKey); } catch { /* storage disabled */ }
          void navigate(`/mock/${response.attempt.subject}/results?attempt=${response.attempt.attemptId}`, { replace: true });
          return;
        }
        setResumed(true);
        adopt(response.attempt);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        try { localStorage.removeItem(pointerKey); } catch { /* storage disabled */ }
        setPhase('idle');
        setMessage(describeMockError(error));
      });
    return () => { cancelled = true; };
  }, [adopt, navigate, pointerKey, storedAttemptId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (phase !== 'ready' || !attempt) return;
    const id = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1_000);
    return () => window.clearInterval(id);
  }, [attempt, phase]);

  const start = async () => {
    setPhase('loading');
    setMessage(null);
    try {
      const response = await startServerMockExam({ mockExamId, deviceId });
      try { localStorage.setItem(pointerKey, response.attempt.attemptId); } catch { /* storage disabled */ }
      setResumed(response.resumed);
      adopt(response.attempt);
    } catch (error) {
      setPhase('error');
      setMessage(describeMockError(error));
    }
  };

  const pushSave = useCallback(async (save: PendingSave) => {
    pendingRef.current = save;
    setSaveState('saving');
    try {
      const response = await saveServerMockAnswer({
        attemptId: attempt!.attemptId,
        questionId: save.questionId,
        selectedAnswer: save.selectedAnswer,
        mutationId: save.mutationId,
        currentQuestionIndex: save.currentQuestionIndex,
        flaggedQuestionIds: save.flaggedQuestionIds,
      });
      pendingRef.current = null;
      setSaveState('saved');
      setRemaining(response.remainingSeconds);
      setMessage(null);
    } catch (error) {
      setSaveState('failed');
      setMessage(describeMockError(error));
    }
  }, [attempt]);

  const retrySave = () => {
    const pending = pendingRef.current;
    if (pending) void pushSave(pending);
  };

  const chooseAnswer = (answerId: string) => {
    if (!question || !attempt || expired) return;
    setAnswers((current) => ({ ...current, [question.id]: answerId }));
    void pushSave({
      questionId: question.id,
      selectedAnswer: answerId,
      mutationId: nextMutationId(attempt.attemptId),
      currentQuestionIndex: currentIndex,
      flaggedQuestionIds: flagged,
    });
  };

  const toggleFlag = () => {
    if (!question || !attempt || expired) return;
    const nextFlags = flagged.includes(question.id)
      ? flagged.filter((id) => id !== question.id)
      : [...flagged, question.id];
    setFlagged(nextFlags);
    void pushSave({
      questionId: question.id,
      selectedAnswer: answers[question.id] ?? null,
      mutationId: nextMutationId(attempt.attemptId),
      currentQuestionIndex: currentIndex,
      flaggedQuestionIds: nextFlags,
    });
  };

  const submit = async () => {
    if (!attempt) return;
    setPhase('submitting');
    setSubmitOpen(false);
    try {
      // The same mutation id is reused for every retry, so a repeated submit
      // returns the first result instead of grading twice.
      submitMutationRef.current ??= nextMutationId(attempt.attemptId);
      await submitServerMockExam({ attemptId: attempt.attemptId, mutationId: submitMutationRef.current });
      try { localStorage.removeItem(pointerKey); } catch { /* storage disabled */ }
      void navigate(`/mock/${attempt.subject}/results?attempt=${attempt.attemptId}`, { replace: true });
    } catch (error) {
      setPhase('ready');
      setMessage(describeMockError(error));
    }
  };

  const statusLine = useMemo(() => {
    if (!online) return { icon: CloudOff, text: 'Offline — answers are saved on the server, so reconnect before the timer ends.' };
    if (saveState === 'saving') return { icon: LoaderCircle, text: 'Saving answer…' };
    if (saveState === 'failed') return { icon: AlertTriangle, text: message ?? 'The last answer was not saved.' };
    return null;
  }, [message, online, saveState]);

  if (phase === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-background p-6 text-center">
        <div>
          <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-primary" aria-hidden="true" />
          <p className="mt-4 text-sm text-muted-foreground" role="status">Restoring your exam from the server…</p>
        </div>
      </div>
    );
  }

  if (phase === 'idle' || phase === 'error' || !attempt || !question) {
    return (
      <div className="min-h-dvh bg-background px-4 py-8 sm:grid sm:place-items-center">
        <div className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 shadow-soft sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <Badge variant="outline">Server-graded mock</Badge>
            <Button variant="ghost" asChild><Link to="/mock"><LogOut className="h-4 w-4" /> Exit</Link></Button>
          </div>
          <h1 className="mt-8 font-display text-4xl font-semibold tracking-[-0.05em]">Timed mock exam</h1>
          <div className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>• Questions and controls are English-only.</p>
            <p>• Answers are saved on the server as you choose them.</p>
            <p>• The timer runs on the server, so closing the tab does not pause it.</p>
            <p>• Solutions become available only after you submit.</p>
          </div>
          {message ? (
            <p className="mt-6 flex gap-2 rounded-xl border border-destructive/30 bg-destructive/[0.06] p-4 text-sm text-destructive" role="alert">
              <AlertTriangle className="h-4 w-4 shrink-0" />{message}
            </p>
          ) : null}
          <Button size="lg" className="mt-7 w-full" onClick={() => void start()}>
            Start exam <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b bg-card/92 px-4 backdrop-blur-xl sm:px-6">
        <div>
          <p className="font-display text-sm font-semibold">CSCA {attempt.subject === 'mathematics' ? 'Mathematics' : 'Physics'}</p>
          <p className="text-[0.65rem] text-muted-foreground">Question {currentIndex + 1} of {total}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm font-semibold', remaining < 600 && 'border-physics/40 text-amber-700 dark:text-physics')}>
            <Timer className="h-4 w-4" />{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}
          </span>
          <Button variant="outline" onClick={() => setSubmitOpen(true)} disabled={phase === 'submitting'}>
            {phase === 'submitting' ? 'Submitting…' : 'Submit'}
          </Button>
        </div>
      </header>

      {resumed ? (
        <p className="border-b bg-secondary px-4 py-2 text-center text-xs text-muted-foreground" role="status">
          Attempt restored from the server. Your answers and remaining time come from the exam record, not from this device.
        </p>
      ) : null}

      {expired ? (
        <p className="border-b border-physics/30 bg-physics/[0.08] px-4 py-2 text-center text-sm font-semibold text-amber-700 dark:text-physics" role="alert">
          Time is up. Submit to see your result — no further answers are accepted.
        </p>
      ) : null}

      {statusLine ? (
        <div className="flex items-center justify-center gap-2 border-b bg-card px-4 py-2 text-xs text-muted-foreground" role="status">
          <statusLine.icon className={cn('h-3.5 w-3.5', saveState === 'saving' && 'animate-spin')} aria-hidden="true" />
          <span>{statusLine.text}</span>
          {saveState === 'failed' ? (
            <Button size="sm" variant="outline" onClick={retrySave}><RefreshCw className="h-3.5 w-3.5" /> Retry</Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid min-h-[calc(100dvh-68px)] lg:grid-cols-[1fr_280px]">
        <main className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-8 lg:pb-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex gap-2">
              <Badge variant="outline">{question.module}</Badge>
              <Badge variant="outline">Difficulty {question.difficulty}</Badge>
            </div>
            <Button variant={flagged.includes(question.id) ? 'secondary' : 'ghost'} onClick={toggleFlag} disabled={expired}>
              <Bookmark className={cn('h-4 w-4', flagged.includes(question.id) && 'fill-current')} />
              {flagged.includes(question.id) ? 'Flagged' : 'Flag'}
            </Button>
          </div>
          <h1 className="font-display text-xl font-semibold leading-relaxed tracking-[-0.02em] sm:text-2xl">{question.question}</h1>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {question.options.map((option, index) => (
              <button
                key={option.id}
                onClick={() => chooseAnswer(option.id)}
                disabled={expired}
                className={cn(
                  'min-h-16 rounded-2xl border bg-card p-4 text-left text-sm font-semibold transition-colors hover:border-primary disabled:opacity-60',
                  answers[question.id] === option.id && 'border-primary bg-primary/[0.06] ring-1 ring-primary',
                )}
              >
                <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
                {option.text}
              </button>
            ))}
          </div>
          <div className="mt-10 flex items-center justify-between border-t pt-5">
            <Button variant="outline" disabled={currentIndex === 0} onClick={() => setCurrentIndex(currentIndex - 1)}>
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>
            <Button className="lg:hidden" variant="secondary" onClick={() => setNavigatorOpen(true)}>
              <Grid3X3 className="h-4 w-4" /> Questions
            </Button>
            <Button disabled={currentIndex >= total - 1} onClick={() => setCurrentIndex(currentIndex + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </main>
        <aside className="hidden border-l bg-card/55 p-5 lg:block">
          <QuestionNavigator questions={questions} answers={answers} flagged={flagged} currentIndex={currentIndex} onSelect={setCurrentIndex} />
          <div className="mt-6 border-t pt-5 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Answered</span><strong className="text-foreground">{answeredCount}</strong></div>
            <div className="mt-2 flex justify-between"><span>Unanswered</span><strong className="text-foreground">{total - answeredCount}</strong></div>
            <div className="mt-2 flex justify-between"><span>Flagged</span><strong className="text-foreground">{flagged.length}</strong></div>
          </div>
        </aside>
      </div>

      <Dialog open={navigatorOpen} onOpenChange={setNavigatorOpen}>
        <DialogContent title="Question navigator" description={`${answeredCount} answered · ${flagged.length} flagged`} className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl">
          <QuestionNavigator questions={questions} answers={answers} flagged={flagged} currentIndex={currentIndex} onSelect={(value) => { setCurrentIndex(value); setNavigatorOpen(false); }} />
        </DialogContent>
      </Dialog>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent title="Submit mock exam?" description="You cannot change answers after submission.">
          <div className="rounded-xl bg-secondary p-4 text-sm">
            <div className="flex justify-between"><span>Answered</span><strong>{answeredCount} / {total}</strong></div>
            <div className="mt-2 flex justify-between"><span>Unanswered</span><strong>{total - answeredCount}</strong></div>
            <div className="mt-2 flex justify-between"><span>Flagged</span><strong>{flagged.length}</strong></div>
          </div>
          {total - answeredCount > 0 ? (
            <p className="mt-4 flex gap-2 text-sm text-amber-700 dark:text-physics"><AlertTriangle className="h-4 w-4 shrink-0" />Some questions are unanswered.</p>
          ) : null}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Keep working</Button>
            <Button onClick={() => void submit()}>Submit exam</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
