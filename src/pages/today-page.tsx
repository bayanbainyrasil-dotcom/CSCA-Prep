import { Brain, Check, ChevronRight, Clock3, Languages, Play, Target, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';
import type { DailyPlanBlock } from '@/domain';

const iconFor = (block: DailyPlanBlock) => {
  if (block.kind === 'mental-math') return Brain;
  if (block.kind === 'english') return Languages;
  if (block.kind === 'new-physics') return Zap;
  if (block.kind === 'review') return Check;
  return Target;
};

export default function TodayPage() {
  const { isDemo } = useAuth();
  const completedDays = useAppStore((state) => state.metrics.completedDays);
  const plan = useAppStore((state) => state.dailyPlan);
  const lessons = useAppStore((state) => state.lessons);
  const completeBlock = useAppStore((state) => state.completeDailyPlanBlock);

  if (!plan) {
    return <div><PageHeading eyebrow="Today" title="Building your next session…" description="The plan appears after local progress and published topics finish loading." /><Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Your saved work is being checked first.</CardContent></Card></div>;
  }

  const completed = plan.blocks.filter((block) => block.status === 'completed').length;
  const progress = Math.round((completed / plan.blocks.length) * 100);
  const next = plan.blocks.find((block) => block.status !== 'completed');
  const pathFor = (block: DailyPlanBlock) => {
    if (block.kind === 'mental-math') return '/mental-math';
    if (block.kind === 'english') return '/vocabulary';
    if (block.kind === 'mock') return '/mock';
    if (block.kind === 'review') return `/practice/session?mode=mistakes${block.topicIds[0] ? `&topic=${encodeURIComponent(block.topicIds[0])}` : ''}`;
    if (block.kind === 'weak-topic') return `/practice/session?mode=weak-topics${block.topicIds[0] ? `&topic=${encodeURIComponent(block.topicIds[0])}` : ''}`;
    const lesson = lessons.find((item) => block.topicIds.includes(item.topicId));
    return lesson ? `/lesson/${encodeURIComponent(lesson.id)}` : block.subject === 'physics' ? '/physics' : '/mathematics';
  };
  const markComplete = async (block: DailyPlanBlock) => {
    if (block.status === 'completed') return;
    try {
      await completeBlock(block.id);
      toast.success(`${block.title} completed`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'This block could not be saved.');
    }
  };

  return (
    <div>
      <PageHeading eyebrow={`Today · Day ${isDemo ? 18 : Math.min(84, completedDays + 1)}`} title="One session. Deliberate next steps." description="The order is rebuilt from published topics, current mastery, review dates and your daily time target." actions={<Badge variant={progress === 100 ? 'success' : isDemo ? 'warning' : 'default'}>{isDemo ? `Demo plan · ${progress}%` : `${progress}% complete`}</Badge>} />
      <div className="content-grid">
        <section className="lg:col-span-8">
          <Card><CardContent className="p-5 sm:p-6">
            <div className="mb-6"><div className="mb-2 flex justify-between text-xs font-semibold"><span>Session progress</span><span>{completed} / {plan.blocks.length}</span></div><Progress value={progress} label={`Session ${progress} percent complete`} /></div>
            <ol className="space-y-2">
              {plan.blocks.map((block, index) => {
                const done = block.status === 'completed';
                const Icon = iconFor(block);
                return (
                  <li key={block.id} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${done ? 'bg-success/[0.04]' : block.id === next?.id ? 'border-primary/35 bg-primary/[0.035]' : 'bg-background/50'}`}>
                    <button disabled={done} onClick={() => void markComplete(block)} className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${done ? 'bg-success text-white' : 'bg-secondary text-muted-foreground'}`} aria-label={done ? `${block.title} completed` : `Mark complete: ${block.title}`}>{done ? <Check className="h-4 w-4" /> : <span className="font-mono text-xs font-bold">{index + 1}</span>}</button>
                    <Icon className="hidden h-4 w-4 text-primary sm:block" />
                    <div className="min-w-0 flex-1"><p className="data-label">{block.kind.replaceAll('-', ' ')}</p><p className={`truncate text-sm font-semibold ${done ? 'line-through opacity-55' : ''}`}>{block.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{block.targetMinutes} min{block.targetQuestionCount ? ` · ${block.targetQuestionCount} questions` : ''} · {block.reason}</p></div>
                    <Button variant="ghost" size="icon" asChild aria-label={`Open ${block.title}`}><Link to={pathFor(block)}><ChevronRight className="h-4 w-4" /></Link></Button>
                  </li>
                );
              })}
            </ol>
          </CardContent></Card>
        </section>
        <aside className="lg:col-span-4">
          <Card className="sticky top-24 border-primary/25 bg-primary/[0.045]"><CardContent className="p-6">{next ? <><p className="data-label">Up next</p><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">{next.title}</h2><p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{next.targetMinutes} minutes · {next.reason}</p><Button size="lg" className="mt-6 w-full" asChild><Link to={pathFor(next)}><Play className="h-4 w-4 fill-current" /> Start now</Link></Button><p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">Finish one block at a time. Every completion is saved locally first.</p></> : <><span className="grid h-12 w-12 place-items-center rounded-2xl bg-success/10 text-success"><Check className="h-5 w-5" /></span><h2 className="mt-5 font-display text-2xl font-semibold">Today is complete</h2><p className="mt-2 text-sm text-muted-foreground">Your next plan will use today’s answers and review schedule.</p></>}</CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
