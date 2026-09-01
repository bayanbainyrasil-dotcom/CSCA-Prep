import { useMemo } from 'react';
import { ArrowRight, BookOpen, Brain, Clock3, Dice5, History, Lightbulb, Target, Timer, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { isReviewDue } from '@/lib/adaptive';
import { useAppStore } from '@/stores';

const MODES = [
  { id: 'learn', title: 'Learn', description: 'Hints, translation and a worked path.', icon: Lightbulb, tone: 'bg-primary/10 text-primary', meta: '10–15 min' },
  { id: 'practice', title: 'Practice', description: 'No hard timer. Feedback after each answer.', icon: Target, tone: 'bg-accent/10 text-accent', meta: '12 questions' },
  { id: 'timed', title: 'Timed', description: 'CSCA pacing with calm time pressure.', icon: Timer, tone: 'bg-physics/15 text-amber-700 dark:text-physics', meta: '60 sec / item' },
  { id: 'weak-topics', title: 'Weak topics', description: 'Mix drawn from your lowest mastery scores.', icon: TriangleAlert, tone: 'bg-destructive/10 text-destructive', meta: null },
  { id: 'mistakes', title: 'Mistakes', description: 'Retry errors when their review is due.', icon: History, tone: 'bg-success/10 text-success', meta: null },
  { id: 'random', title: 'Random mix', description: 'Switch topics and retrieve without context.', icon: Dice5, tone: 'bg-secondary text-foreground', meta: 'Mixed' },
] as const;

export default function PracticePage() {
  const masteries = useAppStore((state) => state.masteries);
  const mistakes = useAppStore((state) => state.mistakes);
  const topics = useAppStore((state) => state.topics);

  /**
   * Every number on this page is computed from the learner's own records. When
   * there is no record yet the page says so instead of showing a placeholder
   * that looks like a recommendation.
   */
  const summary = useMemo(() => {
    const now = new Date();
    const dueMistakes = Object.values(mistakes).filter(
      (mistake) => !mistake.resolved && isReviewDue(mistake.nextReviewAt, now),
    ).length;
    const attempted = Object.values(masteries).filter((mastery) => mastery.attemptCount > 0);
    const weakest = [...attempted].sort((left, right) => left.score - right.score)[0];
    const weakCount = attempted.filter((mastery) => mastery.score < 60).length;
    const weakestTopic = weakest ? topics.find((topic) => topic.id === weakest.topicId) : undefined;
    return { dueMistakes, weakCount, weakest, weakestTopic };
  }, [masteries, mistakes, topics]);

  const hasEvidence = summary.weakest !== undefined;
  const recommendedMode = summary.dueMistakes > 0 ? 'mistakes' : hasEvidence ? 'weak-topics' : 'learn';

  const metaFor = (id: (typeof MODES)[number]['id'], fallback: string | null): string | null => {
    if (id === 'weak-topics') return hasEvidence ? `${summary.weakCount} below 60%` : 'Needs practice data';
    if (id === 'mistakes') return summary.dueMistakes > 0 ? `${summary.dueMistakes} due` : 'None due';
    return fallback;
  };

  return (
    <div>
      <PageHeading
        eyebrow="Practice engine"
        title="Train the exact failure point."
        description="Start by understanding the English prompt, then select the method, solve, and calibrate your confidence."
        actions={
          <Button asChild>
            <Link to={`/practice/session?mode=${recommendedMode}`}><Brain className="h-4 w-4" /> Start suggested session</Link>
          </Button>
        }
      />

      <Card className="mb-6 border-primary/25 bg-primary/[0.04]"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold tracking-tight">
            {summary.dueMistakes > 0
              ? `Clear ${summary.dueMistakes} mistake ${summary.dueMistakes === 1 ? 'review' : 'reviews'} first`
              : hasEvidence
                ? `Weakest topic: ${summary.weakestTopic?.title.en ?? 'an unnamed topic'}`
                : 'Start with a first session'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.dueMistakes > 0
              ? 'These are your own past errors whose spaced review has come due.'
              : hasEvidence && summary.weakest
                ? `Mastery ${Math.round(summary.weakest.score)}% across ${summary.weakest.attemptCount} answered ${summary.weakest.attemptCount === 1 ? 'question' : 'questions'}.`
                : 'Nothing has been measured yet, so this suggestion is a starting point rather than a recommendation.'}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/practice/session?mode=${recommendedMode}`}>Begin <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </CardContent></Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODES.map(({ id, title, description, icon: Icon, tone, meta }) => {
          const modeMeta = metaFor(id, meta);
          return (
            <Link key={id} to={`/practice/session?mode=${id}`} className="group h-full">
              <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5"><CardContent className="flex h-full flex-col p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-4.5 w-4.5" aria-hidden="true" /></span>
                  {modeMeta ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{modeMeta}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h2>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">
                  Open mode <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </CardContent></Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
