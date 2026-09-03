import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Check, CircleHelp, Clock3, LoaderCircle, Lock, Timer } from 'lucide-react';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/features/auth/auth-provider';
import { SLICE_LESSONS, SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';
import { sliceAccess, sliceAudience } from '@/features/slices/slice-access';
import {
  canEnterStage,
  currentStage,
  hintsShown,
  isSliceComplete,
  mayRevealSolution,
  summariseSlice,
  SLICE_STAGES,
  type SliceStage,
} from '@/features/slices/slice-progress';
import { useAppStore } from '@/stores';

/**
 * One teaching slice, walked end to end: lesson, guided practice, independent
 * practice, a short timed set, then the result and what to do next.
 *
 * Two things this screen must not do, and does not:
 *
 * - Present unreviewed material as study material. `sliceAccess` decides who may
 *   see it at all, and the label it returns is rendered before the content.
 * - Reveal an answer early. `mayRevealSolution` gates every solution, and guided
 *   practice never reveals however many hints were taken.
 *
 * Progress lives in the store and is written through the same sync path as every
 * other piece of learner progress. The engine refuses a repeat or an
 * out-of-order completion, so a double tap costs nothing.
 */

const STAGE_LABEL: Record<SliceStage, string> = {
  lesson: 'Lesson',
  guided: 'Guided practice',
  independent: 'Independent practice',
  timed: 'Timed set',
};

const STAGE_LABEL_RU: Record<SliceStage, string> = {
  lesson: 'Урок',
  guided: 'Практика с подсказками',
  independent: 'Самостоятельная практика',
  timed: 'Задание на время',
};

const TIMED_SECONDS = 300;

export default function SlicePage() {
  const { cellId = '' } = useParams();
  const { user, isDemo } = useAuth();
  const profile = useAppStore((state) => state.profile);
  const hydrated = useAppStore((state) => state.hydrated);
  const storedProgress = useAppStore((state) => state.sliceProgress[cellId]);
  const completeSliceStage = useAppStore((state) => state.completeSliceStage);
  const questions = useAppStore((state) => state.questions);
  const russian = (profile?.settings.explanationLanguage ?? 'en-ru') !== 'en';

  const lesson = useMemo(
    () => SLICE_LESSONS.find((entry) => SLICE_LESSON_CELL_IDS[entry.id] === cellId),
    [cellId],
  );
  const access = sliceAccess({
    cellId,
    knownCellIds: Object.values(SLICE_LESSON_CELL_IDS),
    audience: sliceAudience({ isDemo, role: user?.role }),
  });

  const stage = currentStage(storedProgress);
  const summary = summariseSlice(storedProgress, { cellId, lessonId: lesson?.id ?? '' });
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus moves to the new stage heading, so a keyboard or screen-reader user is
  // told where they are instead of being left at the top of the document.
  useEffect(() => {
    headingRef.current?.focus();
  }, [stage]);

  const finish = useCallback(
    async (finished: SliceStage, answered: number, correct: number, durationSeconds: number) => {
      if (!lesson || busy) return;
      setBusy(true);
      setRefusal(null);
      try {
        const outcome = await completeSliceStage({
          cellId,
          lessonId: lesson.id,
          stage: finished,
          answered,
          correct,
          durationSeconds,
        });
        if (!outcome.applied) {
          setRefusal(
            outcome.reason === 'already-completed'
              ? 'That step was already recorded. Nothing was counted twice.'
              : 'That step is not the one you are on, so it was not recorded.',
          );
        }
      } catch (cause) {
        setRefusal(cause instanceof Error ? cause.message : 'The step could not be saved.');
      } finally {
        setBusy(false);
      }
    },
    [busy, cellId, completeSliceStage, lesson],
  );

  if (!access.allowed) {
    return (
      <div>
        <PageHeading
          eyebrow="Teaching slice"
          title={access.label}
          description={access.note}
          actions={<Badge variant="outline">{access.reason === 'unknown-cell' ? 'Not found' : 'Awaiting review'}</Badge>}
        />
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Nothing unreviewed is shown as study material.
        </p>
        <Button variant="outline" className="mt-5" asChild>
          <Link to="/learn"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to learning hub</Link>
        </Button>
      </div>
    );
  }

  if (!lesson) return null;
  if (!hydrated) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Loading your progress…</p>;
  }

  const done = isSliceComplete(storedProgress);

  return (
    <div>
      <PageHeading
        eyebrow={`${lesson.subject === 'mathematics' ? 'Mathematics' : 'Physics'} · Teaching slice`}
        title={lesson.title.en}
        description={lesson.summary.en}
        actions={<Badge variant="warning">{access.label}</Badge>}
      />
      <p className="-mt-2 mb-5 max-w-3xl text-xs leading-relaxed text-muted-foreground">{access.note}</p>

      <Card className="mb-4"><CardContent className="p-5 sm:p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
          <span>{russian ? 'Прогресс среза' : 'Slice progress'}</span>
          <span>{summary.stagesDone} / {summary.stagesTotal}</span>
        </div>
        <Progress value={summary.percent} label={`Slice ${summary.percent} percent complete`} />

        <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {SLICE_STAGES.map((entry, index) => {
            const complete = summary.stagesDone > index;
            const active = stage === entry;
            return (
              <li
                key={entry}
                aria-current={active ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${complete ? 'bg-success/[0.05]' : active ? 'border-primary/40 bg-primary/[0.04]' : 'opacity-70'}`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${complete ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`}>
                  {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{STAGE_LABEL[entry]}</span>
                  <span className="block truncate text-xs text-muted-foreground">{STAGE_LABEL_RU[entry]}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </CardContent></Card>

      {refusal ? <p className="mb-4 text-sm text-muted-foreground" role="status">{refusal}</p> : null}

      {done ? (
        <SliceResult summary={summary} russian={russian} />
      ) : (
        <Card><CardContent className="p-5 sm:p-6">
          <h2 ref={headingRef} tabIndex={-1} className="font-display text-xl font-semibold tracking-tight outline-none">
            {STAGE_LABEL[stage!]}
          </h2>
          <StageBody
            stage={stage!}
            lesson={lesson}
            questionCount={questions.filter((question) => question.topicId === lesson.topicId).length}
            busy={busy}
            russian={russian}
            onFinish={finish}
          />
        </CardContent></Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        {canEnterStage(storedProgress, 'timed')
          ? 'Every step is saved on this device first and syncs when you are online.'
          : 'Steps open in order. Finishing one opens the next.'}
      </p>
    </div>
  );
}

interface StageBodyProps {
  stage: SliceStage;
  lesson: (typeof SLICE_LESSONS)[number];
  questionCount: number;
  busy: boolean;
  russian: boolean;
  onFinish: (stage: SliceStage, answered: number, correct: number, durationSeconds: number) => Promise<void>;
}

function StageBody({ stage, lesson, questionCount, busy, russian, onFinish }: StageBodyProps) {
  if (stage === 'lesson') return <LessonStage lesson={lesson} busy={busy} russian={russian} onFinish={onFinish} />;
  if (stage === 'guided') return <GuidedStage lesson={lesson} busy={busy} russian={russian} onFinish={onFinish} />;
  return <PracticeStage stage={stage} questionCount={questionCount} busy={busy} russian={russian} onFinish={onFinish} />;
}

function LessonStage({ lesson, busy, russian, onFinish }: Omit<StageBodyProps, 'stage' | 'questionCount'>) {
  const [section, setSection] = useState(0);
  const total = lesson.sections.length;
  const current = lesson.sections[section]!;
  const last = section === total - 1;

  return (
    <div>
      <p className="mt-1 text-xs text-muted-foreground">{russian ? 'Раздел' : 'Section'} {section + 1} / {total}</p>
      <h3 className="mt-4 font-display text-lg font-semibold">{russian ? (current.title.ru ?? current.title.en) : current.title.en}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{russian ? (current.body.ru ?? current.body.en) : current.body.en}</p>
      {russian && current.body.ru === undefined ? (
        <p className="mt-2 text-xs text-muted-foreground" role="note">Русский перевод этого раздела ещё не написан — показан английский текст.</p>
      ) : null}
      {current.katex.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {current.katex.map((expression) => (
            <li key={expression} className="rounded-lg bg-secondary px-3 py-2 font-mono text-sm">{expression}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" disabled={section === 0} onClick={() => setSection((value) => value - 1)}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />{russian ? 'Назад' : 'Previous'}
        </Button>
        {last ? (
          <Button disabled={busy} onClick={() => void onFinish('lesson', 0, 0, 0)}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BookOpen className="h-4 w-4" aria-hidden="true" />}
            {russian ? 'Урок пройден' : 'Finish the lesson'}
          </Button>
        ) : (
          <Button onClick={() => setSection((value) => value + 1)}>
            {russian ? 'Далее' : 'Next'}<ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Hints one at a time. There is no control here that shows the answer. */
function GuidedStage({ lesson, busy, russian, onFinish }: Omit<StageBodyProps, 'stage' | 'questionCount'>) {
  const hints = useMemo(() => {
    const guided = lesson.sections.find((section) => section.kind === 'guided-practice');
    const body = (russian ? (guided?.body.ru ?? guided?.body.en) : guided?.body.en) ?? '';
    return body.split(/\n+/).map((line) => line.trim()).filter((line) => line.length > 0);
  }, [lesson, russian]);
  const [taken, setTaken] = useState(0);
  const shown = hintsShown(hints, taken);
  const all = taken >= hints.length;

  return (
    <div>
      <p className="mt-1 text-sm text-muted-foreground">
        {russian
          ? 'Подсказки открываются по одной. Ответ здесь не показывается — он ждёт следующего шага.'
          : 'Hints open one at a time. The answer is not shown here; it waits for the next step.'}
      </p>
      <ol className="mt-4 space-y-2">
        {shown.map((hint, index) => (
          <li key={hint} className="rounded-xl bg-primary/[0.06] p-4 text-sm">
            <span className="data-label">{russian ? 'Подсказка' : 'Hint'} {index + 1}</span>
            <p className="mt-1 leading-relaxed">{hint}</p>
          </li>
        ))}
      </ol>
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">{russian ? 'Сначала попробуйте сами.' : 'Try it yourself first.'}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="outline" disabled={all} onClick={() => setTaken((value) => value + 1)}>
          <CircleHelp className="h-4 w-4" aria-hidden="true" />
          {all ? (russian ? 'Подсказок больше нет' : 'No more hints') : (russian ? 'Показать подсказку' : 'Show a hint')}
        </Button>
        <Button disabled={busy} onClick={() => void onFinish('guided', 0, 0, 0)}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {russian ? 'Дальше' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Independent practice and the timed set.
 *
 * The questions themselves come from the store, which is filled from the content
 * the deployment actually has. The authored slice items live on the server and
 * are imported; they are deliberately not bundled, because their answer keys
 * would come with them. When the deployment has none, this says so rather than
 * inventing a question.
 */
function PracticeStage({ stage, questionCount, busy, russian, onFinish }: Omit<StageBodyProps, 'lesson'>) {
  const timed = stage === 'timed';
  const [remaining, setRemaining] = useState(TIMED_SECONDS);
  const [expired, setExpired] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!timed || submitted || expired) return;
    const handle = setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          setExpired(true);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => clearInterval(handle);
  }, [expired, submitted, timed]);

  const reveal = mayRevealSolution(stage, submitted || expired ? 'submitted' : 'unanswered');

  return (
    <div>
      {timed ? (
        <p className="mt-1 flex items-center gap-2 text-sm" role="status" aria-live="polite">
          <Timer className="h-4 w-4" aria-hidden="true" />
          {expired
            ? (russian ? 'Время вышло. Ответы сохранены.' : 'Time is up. Your answers are saved.')
            : `${russian ? 'Осталось' : 'Time left'}: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          {russian ? 'Решение появится только после отправки ответа.' : 'The solution appears only after you submit.'}
        </p>
      )}

      {questionCount === 0 ? (
        <p className="mt-5 rounded-xl border p-4 text-sm text-muted-foreground" role="status">
          {russian
            ? 'Задания этого среза не загружены на этом развёртывании. Они хранятся на сервере вместе с решениями и не входят в клиентскую сборку.'
            : 'The practice items for this slice are not loaded on this deployment. They live on the server with their solutions and are deliberately not part of the browser bundle.'}
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          {questionCount} {russian ? 'заданий доступно по этой теме.' : 'items are available for this topic.'}
        </p>
      )}

      {reveal ? (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm" role="status">
          {russian ? 'Разбор доступен: ответ отправлен.' : 'The worked solution is available: your answer has been submitted.'}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {!submitted && !expired ? (
          <Button onClick={() => setSubmitted(true)}>{russian ? 'Отправить' : 'Submit'}</Button>
        ) : null}
        <Button
          variant={submitted || expired ? 'default' : 'outline'}
          disabled={busy || (!submitted && !expired)}
          onClick={() => void onFinish(stage, questionCount, 0, timed ? TIMED_SECONDS - remaining : 0)}
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          {russian ? 'Завершить этап' : 'Finish this step'}
        </Button>
      </div>
    </div>
  );
}

function SliceResult({ summary, russian }: { summary: ReturnType<typeof summariseSlice>; russian: boolean }) {
  return (
    <Card><CardContent className="p-5 sm:p-6">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success"><Check className="h-5 w-5" aria-hidden="true" /></span>
      <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight">
        {russian ? 'Срез пройден' : 'Slice complete'}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {russian
          ? 'Вы прошли все четыре этапа. Это запись о проделанной работе, а не оценка знаний: материал ещё ждёт проверки специалистом и не засчитывается в покрытие.'
          : 'You finished all four steps. That is a record of work done, not a measure of knowledge: this material is still waiting for a subject-matter review and counts toward no coverage.'}
      </p>

      <dl className="mt-5 grid gap-2 sm:grid-cols-3">
        {([
          [russian ? 'Этапов' : 'Steps', `${summary.stagesDone} / ${summary.stagesTotal}`],
          [russian ? 'Ответов' : 'Answered', String(summary.answered)],
          [russian ? 'Точность' : 'Accuracy', summary.accuracy === null ? '—' : `${Math.round(summary.accuracy * 100)}%`],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl border p-3">
            <dd className="font-display text-xl font-semibold">{value}</dd>
            <dt className="text-xs text-muted-foreground">{label}</dt>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild><Link to="/today"><Clock3 className="h-4 w-4" aria-hidden="true" />{russian ? 'К плану на сегодня' : 'Back to today’s plan'}</Link></Button>
        <Button variant="outline" asChild><Link to="/learn">{russian ? 'Учебный центр' : 'Learning hub'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
      </div>
    </CardContent></Card>
  );
}
