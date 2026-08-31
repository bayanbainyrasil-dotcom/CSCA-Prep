import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, ChevronRight, Clock3, RefreshCcw, RotateCcw, Sparkles, TriangleAlert, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DEMO_CONTENT_DISCLAIMER, DEMO_QUESTIONS } from '@/data/seed';
import { AttemptSchema, PracticeModeSchema, type Attempt, type Confidence, type ErrorType, type PracticeMode, type Question } from '@/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getDeviceId } from '@/app/app-data-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { saveMistake } from '@/features/practice/history';
import {
  classifyPublishedMistake,
  gradePublishedQuestion,
  loadPublishedQuestions,
  queuePublishedQuestionGrade,
  type GradeQuestionInput,
  type PublicQuestionPrompt,
} from '@/features/practice/question-service';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores';

type Phase = 'understand' | 'answer' | 'confidence' | 'feedback';
type Feedback = { correct: boolean; correctAnswer: string; explanation: string; shortSolution: string };
type SessionQuestion = PublicQuestionPrompt & {
  correctAnswer?: string;
  explanation?: string;
  shortSolution?: string;
  solution?: string;
  templateParameters?: Record<string, string | number | boolean>;
};

const errorTypes: { value: ErrorType; label: string }[] = [
  { value: 'english-comprehension', label: 'Didn’t understand English' },
  { value: 'concept', label: 'Didn’t know the concept' },
  { value: 'formula', label: 'Forgot the formula' },
  { value: 'calculation', label: 'Calculation mistake' },
  { value: 'careless', label: 'Careless mistake' },
  { value: 'time', label: 'Ran out of time' },
  { value: 'guessed', label: 'Guessed' },
];

function toSessionQuestion(question: Question): SessionQuestion | null {
  if (question.subject === 'english') return null;
  return {
    id: question.id,
    subject: question.subject,
    module: question.module,
    topicId: question.topicId,
    skill: question.skill,
    difficulty: question.difficulty,
    question: question.question,
    ...(question.questionTranslation ? { questionTranslation: question.questionTranslation } : {}),
    options: question.options,
    formulas: question.formulas,
    estimatedTime: question.estimatedTime,
    status: 'published',
    demo: true,
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    shortSolution: question.shortSolution,
    solution: question.solution,
    ...(question.templateParameters ? { templateParameters: question.templateParameters } : {}),
  };
}

function normalizedMode(value: string | null): PracticeMode {
  if (value === 'review') return 'mistakes';
  const parsed = PracticeModeSchema.safeParse(value ?? 'practice');
  return parsed.success ? parsed.data : 'practice';
}

function isRetryableGradingError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return /unavailable|deadline-exceeded|network|offline|failed to fetch|timeout/i.test(`${code} ${message}`);
}

export default function PracticeSessionPage() {
  const [params] = useSearchParams();
  const mode = normalizedMode(params.get('mode'));
  const requestedQuestionId = params.get('question');
  const requestedTopicId = params.get('topic');
  const { user, isDemo } = useAuth();
  const recordAnswer = useAppStore((state) => state.recordAnswer);
  const syncNow = useAppStore((state) => state.syncNow);
  const masteries = useAppStore((state) => state.masteries);
  const mistakes = useAppStore((state) => state.mistakes);
  const demoQuestions = useMemo(() => {
    const available = DEMO_QUESTIONS.map(toSessionQuestion).filter((item): item is SessionQuestion => item !== null);
    const ordered = requestedQuestionId
      ? [...available.filter((item) => item.id === requestedQuestionId), ...available.filter((item) => item.id !== requestedQuestionId)]
      : available;
    return ordered.slice(0, Math.max(1, Math.min(6, ordered.length)));
  }, [requestedQuestionId]);
  const [publishedQuestions, setPublishedQuestions] = useState<SessionQuestion[]>([]);
  const [loading, setLoading] = useState(!isDemo);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>(mode === 'learn' ? 'answer' : 'understand');
  const [understanding, setUnderstanding] = useState<Record<string, string>>({});
  const [answer, setAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [pendingAttempt, setPendingAttempt] = useState<Attempt | null>(null);
  const [saving, setSaving] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startRef = useRef(0);
  const attemptIdRef = useRef(`attempt-${nanoid(18)}`);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    void loadPublishedQuestions(40)
      .then((items) => { if (!cancelled) setPublishedQuestions(items); })
      .catch((error: unknown) => { if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load the question bank.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isDemo]);

  useEffect(() => {
    startRef.current = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - startRef.current) / 1_000)), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const questions = useMemo(() => {
    if (isDemo) return demoQuestions;
    const weakRank = new Map(Object.values(masteries)
      .sort((left, right) => left.score - right.score)
      .map((item, rank) => [item.topicId, rank]));
    const mistakeIds = new Set(Object.values(mistakes).filter((item) => !item.resolved).map((item) => item.questionId));
    const ordered = [...publishedQuestions].sort((left, right) => {
      if (requestedQuestionId) {
        const direct = Number(right.id === requestedQuestionId) - Number(left.id === requestedQuestionId);
        if (direct) return direct;
      }
      if (requestedTopicId) {
        const topic = Number(right.topicId === requestedTopicId) - Number(left.topicId === requestedTopicId);
        if (topic) return topic;
      }
      if (mode === 'mistakes') {
        const due = Number(mistakeIds.has(right.id)) - Number(mistakeIds.has(left.id));
        if (due) return due;
      }
      if (mode === 'weak-topics') {
        const leftRank = weakRank.get(left.topicId) ?? Number.MAX_SAFE_INTEGER;
        const rightRank = weakRank.get(right.topicId) ?? Number.MAX_SAFE_INTEGER;
        if (leftRank !== rightRank) return leftRank - rightRank;
      }
      if (mode === 'timed' && left.estimatedTime !== right.estimatedTime) return left.estimatedTime - right.estimatedTime;
      return left.id.localeCompare(right.id);
    });
    return ordered.slice(0, 6);
  }, [demoQuestions, isDemo, masteries, mistakes, mode, publishedQuestions, requestedQuestionId, requestedTopicId]);
  const question = questions[index];
  const isCorrect = feedback?.correct ?? false;
  const understandComplete = ['given', 'asked', 'topic', 'formula'].every((key) => understanding[key]);
  const progress = questions.length ? ((index + (phase === 'feedback' ? 1 : 0)) / questions.length) * 100 : 0;

  const resetQuestionState = (nextStartedAt: number, nextAttemptId: string) => {
    setPhase(mode === 'learn' ? 'answer' : 'understand');
    setUnderstanding({});
    setAnswer(null);
    setConfidence(null);
    setErrorType(null);
    setFeedback(null);
    setPendingAttempt(null);
    startRef.current = nextStartedAt;
    attemptIdRef.current = nextAttemptId;
    setSeconds(0);
  };

  const chooseAnswer = (optionId: string) => {
    if (phase !== 'answer') return;
    setAnswer(optionId);
    setPhase('confidence');
  };

  const chooseConfidence = async (value: Confidence) => {
    if (!question || !answer || !user || saving) return;
    setConfidence(value);
    setSaving(true);
    const startedAt = new Date(startRef.current).toISOString();
    const answeredAt = new Date().toISOString();
    const secureGradeInput: GradeQuestionInput | null = question.demo ? null : {
      questionId: question.id,
      selectedAnswer: answer,
      deviceId: getDeviceId(),
      confidence: value,
      hintUsed: mode === 'learn',
      englishComprehension: understanding.asked ? 1 : mode === 'learn' ? 0.8 : 0.6,
      startedAt,
      answeredAt,
      elapsedMs: Math.max(0, Date.parse(answeredAt) - Date.parse(startedAt)),
      idempotencyKey: attemptIdRef.current,
      mode,
    };
    try {
      if (question.demo) {
        if (!question.correctAnswer || !question.explanation || !question.shortSolution) throw new Error('This demo question is missing its verified answer.');
        const correct = answer === question.correctAnswer;
        const nextFeedback: Feedback = { correct, correctAnswer: question.correctAnswer, explanation: question.explanation, shortSolution: question.shortSolution };
        const attempt = AttemptSchema.parse({
          id: attemptIdRef.current,
          userId: user.uid,
          deviceId: getDeviceId(),
          questionId: question.id,
          subject: question.subject,
          topicId: question.topicId,
          mode,
          selectedAnswer: answer,
          correctAnswer: question.correctAnswer,
          isCorrect: correct,
          confidence: value,
          errorType: null,
          hintUsed: mode === 'learn',
          englishComprehension: understanding.asked ? 1 : mode === 'learn' ? 0.8 : 0.6,
          difficulty: question.difficulty,
          startedAt,
          answeredAt,
          durationSeconds: Math.max(0, Math.round((Date.parse(answeredAt) - Date.parse(startedAt)) / 1_000)),
          version: 1,
          updatedAt: answeredAt,
        });
        setPendingAttempt(attempt);
        setFeedback(nextFeedback);
        if (correct) {
          await recordAnswer(attempt);
          setCorrectCount((current) => current + 1);
        }
      } else {
        const gradeInput = secureGradeInput;
        if (!gradeInput) throw new Error('Secure grading input is unavailable.');
        if (!navigator.onLine) {
          await queuePublishedQuestionGrade(user.uid, gradeInput);
          setQueuedCount((current) => current + 1);
          toast.success('Answer saved on this device. It will be securely graded when you are online.');
          if (index >= questions.length - 1) setFinished(true);
          else {
            setIndex((current) => current + 1);
            resetQuestionState(new Date().getTime(), `attempt-${nanoid(18)}`);
          }
          return;
        }
        const result = await gradePublishedQuestion(gradeInput);
        setPendingAttempt(result.record.payload);
        setFeedback(result);
        if (result.correct) setCorrectCount((current) => current + 1);
        await syncNow();
      }
      setPhase('feedback');
    } catch (error) {
      if (secureGradeInput && isRetryableGradingError(error)) {
        try {
          await queuePublishedQuestionGrade(user.uid, secureGradeInput);
          setQueuedCount((current) => current + 1);
          toast.success('Answer saved on this device. It will be securely graded when you are online.');
          if (index >= questions.length - 1) setFinished(true);
          else {
            setIndex((current) => current + 1);
            resetQuestionState(new Date().getTime(), `attempt-${nanoid(18)}`);
          }
          return;
        } catch {
          // Continue to the original error below if local persistence also failed.
        }
      }
      toast.error(error instanceof Error ? error.message : 'The answer could not be graded.');
    } finally {
      setSaving(false);
    }
  };

  const chooseErrorType = async (value: ErrorType) => {
    if (!question || !pendingAttempt || saving) return;
    setErrorType(value);
    if (question.demo) return;
    setSaving(true);
    try {
      await classifyPublishedMistake({ attemptId: pendingAttempt.id, questionId: question.id, errorType: value });
      await syncNow();
    } catch (error) {
      setErrorType(null);
      toast.error(error instanceof Error ? error.message : 'The mistake label could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const next = async () => {
    if (!question || saving || (!isCorrect && !errorType)) return;
    setSaving(true);
    try {
      if (question.demo && !isCorrect && pendingAttempt && errorType) {
        await recordAnswer(AttemptSchema.parse({ ...pendingAttempt, errorType }));
        const original = DEMO_QUESTIONS.find((item) => item.id === question.id);
        if (original && user) saveMistake(user.uid, original, answer, errorType);
      }
      if (index >= questions.length - 1) {
        setFinished(true);
        return;
      }
      setIndex((current) => current + 1);
      resetQuestionState(new Date().getTime(), `attempt-${nanoid(18)}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Progress could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card><CardContent className="p-10 text-center"><RefreshCcw className="mx-auto h-5 w-5 animate-spin text-primary" /><p className="mt-4 text-sm text-muted-foreground">Loading verified questions…</p></CardContent></Card>;

  if (!question) return <Card><CardContent className="p-8 text-center"><TriangleAlert className="mx-auto h-6 w-6 text-amber-700 dark:text-physics" /><h1 className="mt-4 font-display text-2xl font-semibold">No published questions yet</h1><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{loadError ?? 'An administrator needs to publish verified prompts and private solutions before this mode becomes available.'}</p><Button className="mt-6" asChild><Link to="/practice"><ArrowLeft className="h-4 w-4" />Back to practice</Link></Button></CardContent></Card>;

  if (finished) {
    const confirmedCount = questions.length - queuedCount;
    const accuracy = confirmedCount > 0 ? Math.round((correctCount / confirmedCount) * 100) : null;
    const title = queuedCount > 0
      ? `${queuedCount} answer${queuedCount === 1 ? '' : 's'} awaiting secure grading`
      : `${accuracy}% accuracy`;
    const summary = queuedCount > 0
      ? `Saved safely on this device. ${confirmedCount > 0 ? `${correctCount} of ${confirmedCount} confirmed answers were correct. ` : ''}Pending results will appear after you reconnect.`
      : `${correctCount} of ${questions.length} correct. Confidence and error labels are now part of your next review.`;
    return <div className="mx-auto max-w-2xl py-6 sm:py-10"><Card className="overflow-hidden"><CardContent className="p-7 text-center sm:p-10"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="h-6 w-6" /></span><p className="data-label mt-6">Session complete</p><h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em] sm:text-4xl">{title}</h1><p className="mt-3 text-sm text-muted-foreground">{summary}</p><div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center"><Button asChild><Link to="/practice"><RotateCcw className="h-4 w-4" />Choose another mode</Link></Button><Button variant="outline" asChild><Link to="/progress">View progress <ChevronRight className="h-4 w-4" /></Link></Button></div></CardContent></Card></div>;
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between gap-3"><Button variant="ghost" asChild><Link to="/practice"><ArrowLeft className="h-4 w-4" />Exit</Link></Button><div className="flex items-center gap-2">{question.demo ? <Badge variant="warning">Demo question</Badge> : <Badge variant="success">Secure grading</Badge>}<span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div></div>
      <div className="mb-5"><div className="mb-2 flex justify-between text-xs font-semibold"><span>{mode.replace('-', ' ')}</span><span>{index + 1} / {questions.length}</span></div><Progress value={progress} label={`Question ${index + 1} of ${questions.length}`} /></div>
      <Card><CardContent className="p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{question.subject}</Badge><Badge variant="outline">Difficulty {question.difficulty}</Badge><span className="text-xs text-muted-foreground">Target {question.estimatedTime}s</span></div>
        <h1 className="mt-5 max-w-3xl font-display text-xl font-semibold leading-relaxed tracking-[-0.02em] sm:text-2xl">{question.question}</h1>
        {mode === 'learn' && question.questionTranslation ? <details className="mt-3 rounded-xl bg-secondary/55 p-4 text-sm text-muted-foreground"><summary className="cursor-pointer font-semibold text-foreground">Show Russian support</summary><p className="mt-2">{question.questionTranslation}</p></details> : null}
        {phase === 'understand' ? <UnderstandStep question={question} values={understanding} onChange={(key, value) => setUnderstanding((current) => ({ ...current, [key]: value }))} onContinue={() => setPhase('answer')} complete={understandComplete} /> : null}
        {phase !== 'understand' ? <div className="mt-6 grid gap-2 sm:grid-cols-2">{question.options.map((option, optionIndex) => { const selected = option.id === answer; const showCorrect = phase === 'feedback' && option.id === feedback?.correctAnswer; const showWrong = phase === 'feedback' && selected && !isCorrect; return <button key={option.id} disabled={phase !== 'answer'} onClick={() => chooseAnswer(option.id)} className={cn('min-h-14 rounded-2xl border p-4 text-left text-sm font-semibold transition-colors', phase === 'answer' && 'hover:border-primary hover:bg-primary/[0.035]', selected && phase === 'confidence' && 'border-primary bg-primary/[0.05]', showCorrect && 'border-success/40 bg-success/[0.06] text-success', showWrong && 'border-destructive/30 bg-destructive/[0.04]')}><span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + optionIndex)}.</span>{option.text}{showCorrect ? <Check className="float-right h-4 w-4" /> : showWrong ? <X className="float-right h-4 w-4 text-destructive" /> : null}</button>; })}</div> : null}
        {phase === 'confidence' ? <div className="mt-6 rounded-xl border bg-background p-5"><p className="text-sm font-semibold">How sure were you?</p><div className="mt-3 grid grid-cols-3 gap-2">{([['guess', 'Guess'], ['not-sure', 'Not sure'], ['sure', 'Sure']] as const).map(([value, label]) => <Button key={value} variant="outline" disabled={saving} onClick={() => void chooseConfidence(value)}>{saving && confidence === value ? 'Checking…' : label}</Button>)}</div></div> : null}
        {phase === 'feedback' && feedback ? <div className={`mt-6 rounded-xl border p-5 ${isCorrect ? 'border-success/25 bg-success/[0.045]' : 'border-physics/30 bg-physics/[0.055]'}`}><div className="flex gap-3"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${isCorrect ? 'bg-success/10 text-success' : 'bg-physics/15 text-amber-700 dark:text-physics'}`}>{isCorrect ? <Check className="h-4 w-4" /> : <TriangleAlert className="h-4 w-4" />}</span><div><h2 className="font-display text-lg font-semibold">{isCorrect ? (confidence === 'guess' ? 'Correct — but not secure yet' : 'Correct reasoning') : 'Let’s locate the lost point'}</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{feedback.explanation}</p><p className="mt-3 text-sm"><strong>Short solution:</strong> {feedback.shortSolution}</p></div></div>{!isCorrect ? <div className="mt-5 border-t pt-4"><p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What went wrong?</p><div className="mt-3 flex flex-wrap gap-2">{errorTypes.map((item) => <button key={item.value} disabled={saving} onClick={() => void chooseErrorType(item.value)} className={cn('rounded-full border px-3 py-2 text-xs font-semibold disabled:opacity-55', errorType === item.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary')}>{item.label}</button>)}</div></div> : null}<div className="mt-5 flex justify-end"><Button disabled={saving || (!isCorrect && !errorType)} onClick={() => void next()}>{saving ? 'Saving…' : index === questions.length - 1 ? 'Finish session' : 'Next question'} <ChevronRight className="h-4 w-4" /></Button></div></div> : null}
      </CardContent></Card>
      <p className="mx-auto mt-4 max-w-2xl text-center text-[0.68rem] leading-relaxed text-muted-foreground">{question.demo ? DEMO_CONTENT_DISCLAIMER : 'Prompts are public; correct answers and solutions are released only by the authenticated grading service.'}</p>
    </div>
  );
}

function UnderstandStep({ question, values, onChange, onContinue, complete }: { question: SessionQuestion; values: Record<string, string>; onChange: (key: string, value: string) => void; onContinue: () => void; complete: boolean }) {
  const fields = [
    { key: 'given', label: 'What is given?', options: question.templateParameters ? Object.entries(question.templateParameters).slice(0, 3).map(([key, value]) => `${key} = ${value}`) : ['Known values', 'A graph', 'No numerical data'] },
    { key: 'asked', label: 'What are you asked to find?', options: [question.skill, 'A definition', 'A proof'] },
    { key: 'topic', label: 'Which topic is this?', options: [question.module, 'Thermodynamics', 'Probability'] },
    { key: 'formula', label: 'Which relationship could help?', options: question.formulas.length ? question.formulas : ['Use units first', 'Draw a graph', 'Estimate only'] },
  ];
  return <div className="mt-7 rounded-xl border bg-background/65 p-4 sm:p-5"><div className="mb-5 flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-4 w-4" /></span><div><p className="font-semibold">Understand the question</p><p className="text-xs text-muted-foreground">Name the structure before calculating.</p></div></div><div className="space-y-5">{fields.map((field) => <fieldset key={field.key}><legend className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{field.label}</legend><div className="flex flex-wrap gap-2">{field.options.map((option) => <button key={String(option)} onClick={() => onChange(field.key, String(option))} className={cn('rounded-full border px-3 py-2 text-xs font-semibold', values[field.key] === String(option) ? 'border-primary bg-primary text-primary-foreground' : 'bg-card hover:bg-secondary')}>{String(option)}</button>)}</div></fieldset>)}</div><div className="mt-6 flex justify-end"><Button disabled={!complete} onClick={onContinue}>Unlock answer choices <ChevronRight className="h-4 w-4" /></Button></div></div>;
}
