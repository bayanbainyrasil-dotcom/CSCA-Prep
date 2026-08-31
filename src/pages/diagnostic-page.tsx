import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FlaskConical, LoaderCircle, Sigma, Target, TriangleAlert } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getDeviceId } from '@/app/app-data-provider';
import { AttemptSchema, type Attempt, type Question } from '@/domain';
import { useAuth } from '@/features/auth/auth-provider';
import {
  buildDiagnosticQuestions,
  diagnosticRecoveryKey,
  diagnosticResultKey,
  type DiagnosticSubject,
} from '@/features/diagnostic/diagnostic-data';
import { finalizePublishedDiagnostic, gradePublishedQuestion, loadPublishedQuestions, type PublicQuestionPrompt } from '@/features/practice/question-service';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores';

type DiagnosticQuestion = PublicQuestionPrompt & { correctAnswer?: string };
type BaselineTopic = { topic: string; correct: number; total: number; score: number; status: 'strong' | 'developing' | 'weak' };
type BaselineResult = { subject: DiagnosticSubject; correct: number; answered: number; total: number; score: number; topics: BaselineTopic[] };

const RecoverySchema = z.object({
  sessionId: z.string().min(1),
  subject: z.enum(['mathematics', 'physics']),
  startedAt: z.number().int().positive(),
  currentIndex: z.number().int().nonnegative(),
  answers: z.record(z.string(), z.string()),
}).strict();

function readRecovery(ownerId: string, subject: DiagnosticSubject) {
  try {
    const parsed = RecoverySchema.safeParse(JSON.parse(localStorage.getItem(diagnosticRecoveryKey(ownerId, subject)) ?? 'null') as unknown);
    return parsed.success ? parsed.data : null;
  } catch { return null; }
}

function toPrompt(question: Question): DiagnosticQuestion {
  if (question.subject === 'english') throw new Error('Diagnostics only support Mathematics and Physics.');
  return {
    id: question.id,
    subject: question.subject,
    module: question.module,
    topicId: question.topicId,
    skill: question.skill,
    difficulty: question.difficulty,
    question: question.question,
    options: question.options,
    formulas: [],
    estimatedTime: question.estimatedTime,
    status: 'published',
    demo: true,
    correctAnswer: question.correctAnswer,
  };
}

function summarize(subject: DiagnosticSubject, questions: DiagnosticQuestion[], attempts: Attempt[]): BaselineResult {
  const groups = new Map<string, { correct: number; total: number }>();
  for (const attempt of attempts) {
    const title = questions.find((item) => item.id === attempt.questionId)?.module ?? attempt.topicId;
    const row = groups.get(title) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (attempt.isCorrect) row.correct += 1;
    groups.set(title, row);
  }
  const topics = [...groups.entries()].map(([topic, row]) => {
    const score = row.total ? Math.round(row.correct / row.total * 100) : 0;
    return { topic, ...row, score, status: score >= 75 ? 'strong' as const : score >= 50 ? 'developing' as const : 'weak' as const };
  }).sort((left, right) => left.score - right.score);
  const correct = attempts.filter((item) => item.isCorrect).length;
  return { subject, correct, answered: attempts.length, total: questions.length, score: attempts.length ? Math.round(correct / attempts.length * 100) : 0, topics };
}

export default function DiagnosticPage() {
  const { user, isDemo } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const recordAnswer = useAppStore((state) => state.recordAnswer);
  const syncNow = useAppStore((state) => state.syncNow);
  const [published, setPublished] = useState<PublicQuestionPrompt[]>([]);
  const [loadingBank, setLoadingBank] = useState(!isDemo);
  const [subject, setSubject] = useState<DiagnosticSubject | null>(null);
  const [sessionId, setSessionId] = useState('');
  const [startedAt, setStartedAt] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BaselineResult | null>(null);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    void loadPublishedQuestions(40)
      .then((items) => { if (!cancelled) setPublished(items); })
      .catch((error: unknown) => { if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not load diagnostic questions.'); })
      .finally(() => { if (!cancelled) setLoadingBank(false); });
    return () => { cancelled = true; };
  }, [isDemo]);

  const questions = useMemo<DiagnosticQuestion[]>(() => {
    if (!subject) return [];
    if (!isDemo) return published.filter((item) => item.subject === subject).slice(0, 40);
    return buildDiagnosticQuestions(subject, sessionId || 'diagnostic-preview', 32).map(toPrompt);
  }, [isDemo, published, sessionId, subject]);
  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  const start = (nextSubject: DiagnosticSubject) => {
    const recovery = readRecovery(ownerId, nextSubject);
    const nextSessionId = recovery?.sessionId ?? `diagnostic-${nanoid(14)}`;
    const nextStartedAt = recovery?.startedAt ?? Date.now();
    setSubject(nextSubject);
    setSessionId(nextSessionId);
    setStartedAt(nextStartedAt);
    setCurrentIndex(recovery?.currentIndex ?? 0);
    setAnswers(recovery?.answers ?? {});
    setResult(null);
    if (!recovery) localStorage.setItem(diagnosticRecoveryKey(ownerId, nextSubject), JSON.stringify({ sessionId: nextSessionId, subject: nextSubject, startedAt: nextStartedAt, currentIndex: 0, answers: {} }));
  };

  const save = (nextAnswers: Record<string, string>, nextIndex: number) => {
    if (!subject) return;
    localStorage.setItem(diagnosticRecoveryKey(ownerId, subject), JSON.stringify({ sessionId, subject, startedAt, currentIndex: nextIndex, answers: nextAnswers }));
  };

  const chooseAnswer = (value: string) => {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    save(next, currentIndex);
  };

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(questions.length - 1, index));
    setCurrentIndex(next);
    save(answers, next);
  };

  const finish = async () => {
    if (!subject || !user || submitting || !answeredCount) return;
    setSubmitting(true);
    const answeredAt = new Date().toISOString();
    const averageDuration = Math.max(1, Math.round((Date.now() - startedAt) / 1_000 / answeredCount));
    try {
      const attempts: Attempt[] = [];
      for (const item of questions) {
        const selectedAnswer = answers[item.id];
        if (!selectedAnswer) continue;
        if (item.demo) {
          if (!item.correctAnswer) throw new Error('A verified built-in answer is missing.');
          const attempt = AttemptSchema.parse({
            id: `${sessionId}:${item.id}`,
            userId: user.uid,
            deviceId: getDeviceId(),
            questionId: item.id,
            subject: item.subject,
            topicId: item.topicId,
            mode: 'diagnostic',
            selectedAnswer,
            correctAnswer: item.correctAnswer,
            isCorrect: selectedAnswer === item.correctAnswer,
            confidence: 'not-sure',
            errorType: null,
            hintUsed: false,
            englishComprehension: 0.75,
            difficulty: item.difficulty,
            startedAt: new Date(startedAt).toISOString(),
            answeredAt,
            durationSeconds: averageDuration,
            version: 1,
            updatedAt: answeredAt,
          });
          await recordAnswer(attempt);
          attempts.push(attempt);
        } else {
          const graded = await gradePublishedQuestion({
            questionId: item.id,
            selectedAnswer,
            deviceId: getDeviceId(),
            confidence: 'not-sure',
            hintUsed: false,
            englishComprehension: 0.75,
            startedAt: new Date(startedAt).toISOString(),
            answeredAt,
            elapsedMs: averageDuration * 1_000,
            idempotencyKey: `${sessionId}:${item.id}`,
            mode: 'diagnostic',
          });
          attempts.push(graded.record.payload);
        }
      }
      if (!isDemo) {
        await finalizePublishedDiagnostic({ sessionId, subject, attemptIds: attempts.map((attempt) => attempt.id) });
        await syncNow();
      }
      const baseline = summarize(subject, questions, attempts);
      setResult(baseline);
      localStorage.setItem(diagnosticResultKey(ownerId, subject), JSON.stringify({ ...baseline, completedAt: answeredAt }));
      localStorage.removeItem(diagnosticRecoveryKey(ownerId, subject));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The diagnostic could not be submitted. Your answers remain saved locally.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) return <div><PageHeading eyebrow="Diagnostic baseline" title={`${result.score}% in ${result.subject}`} description="This is a starting map, not a verdict. Unknown curriculum areas remain scheduled for later diagnostics." actions={<Badge variant="success">Saved baseline</Badge>} /><div className="grid gap-3 sm:grid-cols-3"><Metric value={String(result.correct)} label="Correct" /><Metric value={String(result.answered)} label="Answered" /><Metric value={`${result.score}%`} label="Baseline" /></div><Card className="mt-5"><CardContent className="p-5 sm:p-6"><h2 className="font-display text-xl font-semibold">Topic classification</h2><div className="mt-4 space-y-2">{result.topics.map((item) => <div key={item.topic} className="flex items-center gap-3 rounded-xl border p-3"><span className={cn('h-2.5 w-2.5 rounded-full', item.status === 'strong' ? 'bg-success' : item.status === 'developing' ? 'bg-physics' : 'bg-destructive')} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.topic}</p><p className="text-xs text-muted-foreground">{item.correct} / {item.total} correct</p></div><Badge variant={item.status === 'strong' ? 'success' : 'warning'}>{item.status}</Badge></div>)}</div><div className="mt-6 flex flex-col gap-2 sm:flex-row"><Button asChild><Link to="/today">Open adaptive plan <ArrowRight className="h-4 w-4" /></Link></Button><Button variant="outline" onClick={() => { setResult(null); setSubject(null); }}>Test another subject</Button></div></CardContent></Card></div>;

  if (!subject) return <div><PageHeading eyebrow="Foundation diagnostic" title="Find the first reliable starting point." description="Choose a subject. The test is English-only, gives no hints, autosaves locally, and classifies tested topics as strong, developing or weak." actions={<Badge variant={isDemo ? 'outline' : 'success'}>{isDemo ? 'Original practice set' : 'Published question bank'}</Badge>} />{loadingBank ? <Card><CardContent className="p-10 text-center"><LoaderCircle className="mx-auto h-5 w-5 animate-spin text-primary" /><p className="mt-3 text-sm text-muted-foreground">Loading the verified bank…</p></CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2"><SubjectCard ownerId={ownerId} subject="mathematics" title="Mathematics foundation" description="Algebraic reasoning, equations and calculation discipline." icon={Sigma} count={isDemo ? 32 : published.filter((item) => item.subject === 'mathematics').length} onStart={start} /><SubjectCard ownerId={ownerId} subject="physics" title="Physics foundation" description="Units, motion, force and formula recognition." icon={FlaskConical} count={isDemo ? 32 : published.filter((item) => item.subject === 'physics').length} onStart={start} /></div>}{isDemo ? <p className="mt-5 text-center text-xs text-muted-foreground">Built-in diagnostics use original, deterministic templates and are not official CSCA questions.</p> : null}</div>;

  if (!question) return <Card><CardContent className="p-10 text-center"><TriangleAlert className="mx-auto h-6 w-6 text-amber-700 dark:text-physics" /><h1 className="mt-4 font-display text-2xl font-semibold">No {subject} diagnostic is published</h1><p className="mt-2 text-sm text-muted-foreground">Ask an administrator to publish verified questions for this subject.</p><Button className="mt-5" variant="outline" onClick={() => setSubject(null)}><ArrowLeft className="h-4 w-4" />Choose subject</Button></CardContent></Card>;

  return <div className="mx-auto max-w-5xl"><div className="mb-4 flex items-center justify-between"><Button variant="ghost" onClick={() => setSubject(null)}><ArrowLeft className="h-4 w-4" />Exit</Button><Badge variant="outline">{answeredCount} / {questions.length} answered</Badge></div><Progress value={(answeredCount / questions.length) * 100} label={`${answeredCount} of ${questions.length} answered`} /><Card className="mt-5"><CardContent className="p-5 sm:p-8"><div className="flex flex-wrap gap-2"><Badge variant="outline">{question.module}</Badge><Badge variant="outline">Question {currentIndex + 1} / {questions.length}</Badge></div><h1 className="mt-6 font-display text-xl font-semibold leading-relaxed sm:text-2xl">{question.question}</h1><div className="mt-7 grid gap-3 sm:grid-cols-2">{question.options.map((option, index) => <button key={option.id} onClick={() => chooseAnswer(option.id)} className={cn('min-h-16 rounded-2xl border p-4 text-left text-sm font-semibold hover:border-primary', answers[question.id] === option.id && 'border-primary bg-primary/[0.06] ring-1 ring-primary')}><span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + index)}.</span>{option.text}</button>)}</div><div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t pt-5"><Button variant="outline" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}><ArrowLeft className="h-4 w-4" />Previous</Button>{currentIndex < questions.length - 1 ? <Button onClick={() => goTo(currentIndex + 1)}>Next <ArrowRight className="h-4 w-4" /></Button> : <Button disabled={!answeredCount || submitting} onClick={() => void finish()}>{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}{submitting ? 'Grading securely…' : `Finish (${answeredCount}/${questions.length})`}</Button>}</div></CardContent></Card><div className="mt-4 grid grid-cols-8 gap-1.5 sm:grid-cols-12 lg:grid-cols-16">{questions.map((item, index) => <button key={item.id} onClick={() => goTo(index)} aria-label={`Question ${index + 1}${answers[item.id] ? ', answered' : ''}`} className={cn('aspect-square min-h-9 rounded-lg border text-xs font-bold', index === currentIndex ? 'border-primary bg-primary text-primary-foreground' : answers[item.id] ? 'border-success/25 bg-success/10 text-success' : 'bg-card text-muted-foreground')}>{index + 1}</button>)}</div></div>;
}

function SubjectCard({ ownerId, subject, title, description, icon: Icon, count, onStart }: { ownerId: string; subject: DiagnosticSubject; title: string; description: string; icon: typeof Sigma; count: number; onStart: (subject: DiagnosticSubject) => void }) {
  const recovery = readRecovery(ownerId, subject);
  return <Card><CardContent className="p-6 sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><h2 className="mt-6 font-display text-2xl font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p><div className="mt-5 flex items-center justify-between border-y py-4 text-xs"><span>{count} verified questions available</span>{recovery ? <Badge variant="warning">Recovery found</Badge> : null}</div><Button className="mt-5 w-full" disabled={count === 0} onClick={() => onStart(subject)}>{recovery ? 'Resume diagnostic' : 'Start diagnostic'} <ArrowRight className="h-4 w-4" /></Button></CardContent></Card>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <Card><CardContent className="p-5 text-center"><CheckCircle2 className="mx-auto h-5 w-5 text-success" /><p className="mt-3 font-display text-3xl font-semibold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}
