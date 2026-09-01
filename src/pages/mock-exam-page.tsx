import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bookmark, ChevronLeft, ChevronRight, Grid3X3, LogOut, Timer } from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { buildMockQuestions, MockRecoverySchema, recoveryKey, resultKey, type MockRecovery, type MockSubject } from '@/features/mock/mock-data';
import { isServerMockAvailable } from '@/features/mock/mock-service';
import { QuestionNavigator } from '@/features/mock/question-navigator';
import { ServerMockRunner } from '@/features/mock/server-mock-runner';
import { getDeviceId } from '@/app/app-data-provider';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';

const EXAM_SECONDS = 60 * 60;

function loadRecovery(ownerId: string, subject: MockSubject): MockRecovery | null {
  try {
    const raw = localStorage.getItem(recoveryKey(ownerId, subject));
    if (!raw) return null;
    const parsed = MockRecoverySchema.safeParse(JSON.parse(raw) as unknown);
    return parsed.success && parsed.data.subject === subject ? parsed.data : null;
  } catch { return null; }
}

/**
 * Route entry. A published server-graded mock is addressed as
 * `/mock/:subject/active?exam=<mockExamId>` and runs entirely through the
 * trusted callables. Everything else falls back to the built-in template mock,
 * which is a local demo: its questions and answer key are generated in the
 * browser, so its score is a practice indicator and never an exam result.
 */
export default function MockExamPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const serverExamId = searchParams.get('exam');

  if (serverExamId && isServerMockAvailable()) {
    return (
      <ServerMockRunner
        ownerId={user?.uid ?? 'anonymous'}
        mockExamId={serverExamId}
        deviceId={getDeviceId()}
      />
    );
  }

  return <DemoMockRunner />;
}

function DemoMockRunner() {
  const { user } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const params = useParams();
  const subject: MockSubject = params.subject === 'mathematics' ? 'mathematics' : 'physics';
  const questions = useMemo(() => buildMockQuestions(subject), [subject]);
  const recovered = useMemo(() => loadRecovery(ownerId, subject), [ownerId, subject]);
  const [started, setStarted] = useState(Boolean(recovered));
  const [startedAt, setStartedAt] = useState(() => recovered?.startedAt ?? 0);
  const [currentIndex, setCurrentIndex] = useState(recovered?.currentIndex ?? 0);
  const [answers, setAnswers] = useState<Record<string, string>>(recovered?.answers ?? {});
  const [flagged, setFlagged] = useState<string[]>(recovered?.flagged ?? []);
  const [remaining, setRemaining] = useState(() => startedAt ? Math.max(0, EXAM_SECONDS - Math.floor((Date.now() - startedAt) / 1000)) : EXAM_SECONDS);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const navigate = useNavigate();
  const question = questions[currentIndex]!;
  const answeredCount = Object.keys(answers).length;

  const saveLocal = useCallback((nextAnswers: Record<string,string>, nextFlags: string[], nextIndex: number) => {
    const payload: MockRecovery = { subject, startedAt, currentIndex: nextIndex, answers: nextAnswers, flagged: nextFlags };
    localStorage.setItem(recoveryKey(ownerId, subject), JSON.stringify(payload));
  }, [ownerId, startedAt, subject]);

  useEffect(() => {
    if (!started) return;
    const id = window.setInterval(() => {
      const next = Math.max(0, EXAM_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
      setRemaining(next);
      if (next === 0) setSubmitOpen(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [started, startedAt]);

  const chooseAnswer = (answerId: string) => {
    const next = { ...answers, [question.id]: answerId };
    setAnswers(next);
    saveLocal(next, flagged, currentIndex);
  };

  const toggleFlag = () => {
    const next = flagged.includes(question.id) ? flagged.filter((id) => id !== question.id) : [...flagged, question.id];
    setFlagged(next);
    saveLocal(answers, next, currentIndex);
  };

  const goTo = (index: number) => {
    setCurrentIndex(index);
    saveLocal(answers, flagged, index);
  };

  const submit = () => {
    const correct = questions.reduce((total, item) => total + (answers[item.id] === item.correctAnswer ? 1 : 0), 0);
    const skipped = 48 - answeredCount;
    const result = { subject, correct, wrong: 48 - correct - skipped, skipped, durationSeconds: EXAM_SECONDS - remaining, answers, completedAt: Date.now() };
    localStorage.setItem(resultKey(ownerId, subject), JSON.stringify(result));
    localStorage.removeItem(recoveryKey(ownerId, subject));
    void navigate(`/mock/${subject}/results`, { replace: true });
  };

  if (!started) {
    return <div className="min-h-dvh bg-background px-4 py-8 sm:grid sm:place-items-center"><div className="mx-auto w-full max-w-2xl rounded-xl border bg-card p-6 shadow-soft sm:p-9"><div className="flex items-center justify-between gap-4"><Badge variant="outline">Local demo</Badge><Button variant="ghost" asChild><Link to="/mock"><LogOut className="h-4 w-4" /> Exit</Link></Button></div><p className="data-label mt-8">{subject} · 48 questions</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em]">60-minute mock</h1><div className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground"><p>• Questions and controls are English-only.</p><p>• No hints, translation, formula trainer or solutions.</p><p>• Each answer saves immediately. You can restore this mock after closing the browser.</p><p>• Flag questions and return to them before submitting.</p></div><div className="mt-7 rounded-xl border border-physics/30 bg-physics/[0.06] p-4 text-sm"><strong>Local demo.</strong> These questions are generated in your browser from open templates and scored on this device, so the result is practice feedback rather than an exam score. Timing is kept by this device only.</div><div className="mt-3 rounded-xl border p-4 text-sm text-muted-foreground"><strong>Before you begin:</strong> find a quiet place and reserve the full hour. The timer starts when you press Start.</div><Button size="lg" className="mt-7 w-full" onClick={() => { const now=Date.now(); setStartedAt(now); setStarted(true); localStorage.setItem(recoveryKey(ownerId, subject),JSON.stringify({subject,startedAt:now,currentIndex:0,answers:{},flagged:[]})); }}>Start exam <ChevronRight className="h-4 w-4" /></Button></div></div>;
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="safe-top sticky top-0 z-30 flex min-h-[68px] items-center justify-between border-b bg-card/92 px-4 backdrop-blur-xl sm:px-6"><div><p className="font-display text-sm font-semibold">CSCA {subject === 'mathematics' ? 'Mathematics' : 'Physics'}</p><p className="text-[0.65rem] text-muted-foreground">Question {currentIndex + 1} of 48</p></div><div className="hidden sm:block"><Badge variant="outline">Local demo</Badge></div><div className="flex items-center gap-2"><span className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 font-mono text-sm font-semibold', remaining < 600 && 'border-physics/40 text-amber-700 dark:text-physics')}><Timer className="h-4 w-4" />{String(Math.floor(remaining / 60)).padStart(2,'0')}:{String(remaining % 60).padStart(2,'0')}</span><Button variant="outline" onClick={() => setSubmitOpen(true)}>Submit</Button></div></header>
      <div className="grid min-h-[calc(100dvh-68px)] lg:grid-cols-[1fr_280px]">
        <main className="mx-auto w-full max-w-4xl p-4 pb-28 sm:p-8 lg:pb-8"><div className="mb-6 flex items-center justify-between"><div className="flex gap-2"><Badge variant="outline">{question.module}</Badge><Badge variant="outline">Difficulty {question.difficulty}</Badge></div><Button variant={flagged.includes(question.id) ? 'secondary' : 'ghost'} onClick={toggleFlag}><Bookmark className={cn('h-4 w-4', flagged.includes(question.id) && 'fill-current')} /> {flagged.includes(question.id) ? 'Flagged' : 'Flag'}</Button></div><h1 className="font-display text-xl font-semibold leading-relaxed tracking-[-0.02em] sm:text-2xl">{question.question}</h1><div className="mt-7 grid gap-3 sm:grid-cols-2">{question.options.map((option, index) => <button key={option.id} onClick={() => chooseAnswer(option.id)} className={cn('min-h-16 rounded-2xl border bg-card p-4 text-left text-sm font-semibold transition-colors hover:border-primary', answers[question.id] === option.id && 'border-primary bg-primary/[0.06] ring-1 ring-primary')}><span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + index)}.</span>{option.text}</button>)}</div><div className="mt-10 flex items-center justify-between border-t pt-5"><Button variant="outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}><ChevronLeft className="h-4 w-4" /> Previous</Button><Button className="lg:hidden" variant="secondary" onClick={() => setNavigatorOpen(true)}><Grid3X3 className="h-4 w-4" /> Questions</Button><Button disabled={currentIndex === 47} onClick={() => goTo(currentIndex + 1)}>Next <ChevronRight className="h-4 w-4" /></Button></div></main>
        <aside className="hidden border-l bg-card/55 p-5 lg:block"><QuestionNavigator questions={questions} answers={answers} flagged={flagged} currentIndex={currentIndex} onSelect={goTo} /><div className="mt-6 border-t pt-5 text-xs text-muted-foreground"><div className="flex justify-between"><span>Answered</span><strong className="text-foreground">{answeredCount}</strong></div><div className="mt-2 flex justify-between"><span>Unanswered</span><strong className="text-foreground">{48 - answeredCount}</strong></div><div className="mt-2 flex justify-between"><span>Flagged</span><strong className="text-foreground">{flagged.length}</strong></div></div></aside>
      </div>
      <Dialog open={navigatorOpen} onOpenChange={setNavigatorOpen}><DialogContent title="Question navigator" description={`${answeredCount} answered · ${flagged.length} flagged`} className="top-auto bottom-0 w-full max-w-none translate-y-0 rounded-b-none sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:rounded-xl"><QuestionNavigator questions={questions} answers={answers} flagged={flagged} currentIndex={currentIndex} onSelect={(value) => { goTo(value); setNavigatorOpen(false); }} /></DialogContent></Dialog>
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}><DialogContent title="Submit mock exam?" description="You cannot change answers after submission."><div className="rounded-xl bg-secondary p-4 text-sm"><div className="flex justify-between"><span>Answered</span><strong>{answeredCount} / 48</strong></div><div className="mt-2 flex justify-between"><span>Unanswered</span><strong>{48 - answeredCount}</strong></div><div className="mt-2 flex justify-between"><span>Flagged</span><strong>{flagged.length}</strong></div></div>{48 - answeredCount > 0 ? <p className="mt-4 flex gap-2 text-sm text-amber-700 dark:text-physics"><AlertTriangle className="h-4 w-4 shrink-0" />Some questions are unanswered.</p> : null}<div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={() => setSubmitOpen(false)}>Keep working</Button><Button onClick={() => void submit()}>Submit exam</Button></div></DialogContent></Dialog>
    </div>
  );
}
