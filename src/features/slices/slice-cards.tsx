import { Link } from 'react-router-dom';
import { ArrowRight, Check, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { SLICE_LESSONS, SLICE_LESSON_CELL_IDS } from '@/data/teaching-slices';
import { sliceAccess, sliceAudience } from './slice-access';
import { currentStage, isSliceComplete, summariseSlice, type SliceProgress } from './slice-progress';

/**
 * The authored teaching slices, as they stand for this learner on this
 * deployment.
 *
 * Each card says the actual state and nothing more. It never says "Verified",
 * "Adaptive" or "Recommended": none of those is true of this content, and the
 * point of the whole review pipeline is that the interface does not claim them
 * before a human has.
 */

const STAGE_LABEL: Record<string, string> = {
  lesson: 'Lesson',
  guided: 'Guided practice',
  independent: 'Independent practice',
  timed: 'Timed set',
};

export interface SliceCardsProps {
  progress: Record<string, SliceProgress>;
  isDemo: boolean;
  role: 'user' | 'admin' | undefined;
}

export function SliceCards({ progress, isDemo, role }: SliceCardsProps) {
  const audience = sliceAudience({ isDemo, role });
  const knownCellIds = Object.values(SLICE_LESSON_CELL_IDS);

  return (
    <section className="mt-4" aria-labelledby="teaching-slices-heading">
      <h2 id="teaching-slices-heading" className="font-display text-lg font-semibold tracking-tight">
        Teaching slices
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Complete learning paths for two blueprint cells. Both are awaiting a subject-matter review and count toward no
        coverage.
      </p>

      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {SLICE_LESSONS.map((lesson) => {
          const cellId = SLICE_LESSON_CELL_IDS[lesson.id]!;
          const access = sliceAccess({ cellId, knownCellIds, audience });
          const record = progress[cellId];
          const summary = summariseSlice(record, { cellId, lessonId: lesson.id });
          const complete = isSliceComplete(record);
          const stage = currentStage(record);
          const started = summary.stagesDone > 0;

          // The badge already carries the label for a locked card, so the state
          // line stays empty there rather than repeating it.
          const state = !access.allowed
            ? null
            : complete
              ? 'Completed'
              : started
                ? `In progress · ${STAGE_LABEL[stage ?? 'lesson']}`
                : 'Not started';

          return (
            <li key={lesson.id}>
              <Card className="h-full"><CardContent className="flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="data-label">{lesson.subject === 'mathematics' ? 'Mathematics' : 'Physics'}</p>
                  <Badge variant={complete ? 'success' : 'outline'}>
                    {access.allowed ? 'Awaiting review' : access.label}
                  </Badge>
                </div>
                <h3 className="mt-3 font-display text-base font-semibold tracking-tight">{lesson.title.en}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{lesson.summary.en}</p>

                {state ? (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold">
                    {complete ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : null}
                    {state}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                    <Lock className="h-4 w-4" aria-hidden="true" />Locked until a reviewer approves it
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">{summary.stagesDone} of {summary.stagesTotal} steps</p>

                <div className="mt-auto pt-4">
                  {access.allowed ? (
                    <Link
                      to={`/slice/${cellId}`}
                      className="tap-target inline-flex items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold hover:border-primary"
                    >
                      {started ? (complete ? 'Review it again' : 'Continue') : 'Start'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <p className="text-xs text-muted-foreground">{access.note}</p>
                  )}
                </div>
              </CardContent></Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
