import { ArrowRight, BookOpen, Brain, Clock3, Dice5, History, Lightbulb, Target, Timer, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const modes = [
  { id: 'learn', title: 'Learn', description: 'Hints, translation and a worked path.', icon: Lightbulb, tone: 'bg-primary/10 text-primary', meta: '10–15 min' },
  { id: 'practice', title: 'Practice', description: 'No hard timer. Feedback after each answer.', icon: Target, tone: 'bg-accent/10 text-accent', meta: '12 questions' },
  { id: 'timed', title: 'Timed', description: 'CSCA pacing with calm time pressure.', icon: Timer, tone: 'bg-physics/15 text-amber-700 dark:text-physics', meta: '60 sec / item' },
  { id: 'weak-topics', title: 'Weak topics', description: 'Adaptive mix from lowest mastery areas.', icon: TriangleAlert, tone: 'bg-destructive/10 text-destructive', meta: 'Recommended' },
  { id: 'mistakes', title: 'Mistakes', description: 'Retry errors when their review is due.', icon: History, tone: 'bg-success/10 text-success', meta: '8 due' },
  { id: 'random', title: 'Random mix', description: 'Switch topics and retrieve without context.', icon: Dice5, tone: 'bg-secondary text-foreground', meta: 'Mixed' },
] as const;

export default function PracticePage() {
  return (
    <div>
      <PageHeading eyebrow="Practice engine" title="Train the exact failure point." description="Start by understanding the English prompt, then select the method, solve, and calibrate your confidence." actions={<Button asChild><Link to="/practice/session?mode=weak-topics"><Brain className="h-4 w-4" /> Start recommended</Link></Button>} />
      <Card className="mb-6 border-primary/25 bg-primary/[0.04]"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><BookOpen className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-xl font-semibold tracking-tight">Recommended: force recognition</h2><Badge>Adaptive</Badge></div><p className="mt-1 text-sm text-muted-foreground">Newton’s laws · English comprehension + formula choice · 9 min</p></div><Button variant="outline" asChild><Link to="/practice/session?mode=weak-topics">Begin <ArrowRight className="h-4 w-4" /></Link></Button></CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modes.map(({ id, title, description, icon: Icon, tone, meta }) => (
          <Link key={id} to={`/practice/session?mode=${id}`} className="group h-full">
            <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5"><CardContent className="flex h-full flex-col p-5 sm:p-6"><div className="flex items-start justify-between"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${tone}`}><Icon className="h-4.5 w-4.5" /></span><span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{meta}</span></div><h2 className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</h2><p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p><span className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-primary">Open mode <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span></CardContent></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
