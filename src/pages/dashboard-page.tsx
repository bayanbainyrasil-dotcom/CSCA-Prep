import { ArrowRight, BookOpen, Brain, CheckCircle2, ChevronRight, Clock3, Flame, Languages, Play, Target, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ReadinessOrbit } from '@/features/dashboard/readiness-orbit';
import { Trajectory } from '@/features/dashboard/trajectory';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';

const demoPlan = [
  { subject: 'Physics', title: 'Newton’s laws', duration: 25, icon: Zap, color: 'text-amber-600 dark:text-physics', background: 'bg-physics/15' },
  { subject: 'Mathematics', title: 'Quadratic functions', duration: 20, icon: Brain, color: 'text-primary', background: 'bg-primary/10' },
  { subject: 'English', title: '12 exam terms', duration: 10, icon: Languages, color: 'text-accent', background: 'bg-accent/10' },
  { subject: 'Review', title: '8 questions due', duration: 12, icon: Target, color: 'text-success', background: 'bg-success/10' },
] as const;

const demoReadiness = [
  { label: 'Mathematics', value: 63, color: 'bg-primary' },
  { label: 'Physics', value: 41, color: 'bg-physics' },
  { label: 'English comprehension', value: 72, color: 'bg-accent' },
  { label: 'Exam speed', value: 54, color: 'bg-success' },
];

export default function DashboardPage() {
  const { user, isDemo } = useAuth();
  const metrics = useAppStore((state) => state.metrics);
  const profile = useAppStore((state) => state.profile);
  const attempts = useAppStore((state) => state.attempts);
  const masteries = useAppStore((state) => state.masteries);
  const topics = useAppStore((state) => state.topics);
  const dailyPlan = useAppStore((state) => state.dailyPlan);
  const readiness = isDemo ? demoReadiness : [
    { label: 'Mathematics', value: metrics.mathematicsReadiness, color: 'bg-primary' },
    { label: 'Physics', value: metrics.physicsReadiness, color: 'bg-physics' },
    { label: 'English comprehension', value: metrics.englishComprehension, color: 'bg-accent' },
    { label: 'Exam speed', value: metrics.examSpeed, color: 'bg-success' },
  ];
  const today = new Date();
  const createdAt = profile?.createdAt ? new Date(profile.createdAt) : today;
  const dayNumber = isDemo ? 18 : Math.max(1, Math.min(84, Math.floor((today.getTime() - createdAt.getTime()) / 86_400_000) + 1));
  const targetDate = profile?.targetDate ? new Date(`${profile.targetDate}T00:00:00`) : null;
  const daysUntilExam = targetDate ? Math.max(0, Math.ceil((targetDate.getTime() - today.getTime()) / 86_400_000)) : null;
  const lowestMastery = Object.values(masteries).sort((left, right) => left.score - right.score)[0];
  const reviewTopic = lowestMastery ? topics.find((item) => item.id === lowestMastery.topicId) : null;
  const livePlan = dailyPlan?.blocks.map((block) => ({
    subject: block.subject === 'mathematics' ? 'Mathematics' : block.subject === 'physics' ? 'Physics' : block.subject === 'english' ? 'English' : 'Review',
    title: block.title,
    duration: block.targetMinutes,
    icon: block.subject === 'physics' ? Zap : block.subject === 'english' ? Languages : block.kind === 'review' || block.kind === 'weak-topic' ? Target : Brain,
    color: block.subject === 'physics' ? 'text-amber-600 dark:text-physics' : block.subject === 'english' ? 'text-accent' : block.kind === 'review' || block.kind === 'weak-topic' ? 'text-success' : 'text-primary',
    background: block.subject === 'physics' ? 'bg-physics/15' : block.subject === 'english' ? 'bg-accent/10' : block.kind === 'review' || block.kind === 'weak-topic' ? 'bg-success/10' : 'bg-primary/10',
  })) ?? [];
  const displayPlan = isDemo ? demoPlan : livePlan;
  const planMinutes = displayPlan.reduce((total, block) => total + block.duration, 0);

  return (
    <div>
      <PageHeading
        eyebrow={`${today.toLocaleDateString('en', { weekday: 'long' })} · Day ${dayNumber} / 84`}
        title={`Good evening, ${user?.name.split(' ')[0] ?? 'Nurasyl'}`}
        description={isDemo ? 'Your next step is ready. Today reinforces force recognition before adding harder calculations.' : dailyPlan?.adaptiveReasons[0] ?? 'Your plan will appear as soon as published topics and saved mastery are loaded.'}
        actions={<Badge variant={isDemo ? 'warning' : 'success'}>{isDemo ? 'Demo progress' : daysUntilExam === null ? 'Set your CSCA date' : `${daysUntilExam} days until CSCA`}</Badge>}
      />

      <div className="content-grid">
        <section className="lg:col-span-8" aria-labelledby="today-plan-title">
          <Card className="h-full overflow-hidden">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <p className="data-label">Today’s plan · {planMinutes} min</p>
                <CardTitle id="today-plan-title" className="mt-1.5 text-2xl">{dailyPlan && !isDemo ? 'Your adaptive session' : 'Build one clean chain of reasoning'}</CardTitle>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {displayPlan.map(({ subject, title, duration, icon: Icon, color, background }, index) => (
                  <div key={`${subject}-${title}`} className="group flex items-center gap-3 rounded-2xl border bg-background/55 p-3.5 transition-colors hover:bg-secondary/55">
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-muted-foreground">{index + 1}. {subject}</p>
                      <p className="truncate text-sm font-semibold">{title}</p>
                    </div>
                    <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{duration}</span>
                  </div>
                ))}
                {!displayPlan.length ? <p className="col-span-full rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">Publish Mathematics and Physics topics to generate the first adaptive session.</p> : null}
              </div>
              <div className="mt-5 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-success" /> Local work is preserved; cloud grading and sync resume online</div>
                <Button size="lg" asChild><Link to="/today"><Play className="h-4 w-4 fill-current" /> Start today’s session</Link></Button>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-4" aria-labelledby="readiness-title">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div><p className="data-label">Internal metric</p><CardTitle id="readiness-title" className="mt-1.5">CSCA readiness</CardTitle></div>
                <Badge variant="outline">{isDemo ? '+4 this week' : `${metrics.questionsSolved} answers`}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <ReadinessOrbit score={isDemo ? 57 : metrics.readinessScore} />
              <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">A planning signal from mastery, accuracy and speed — not an official CSCA score.</p>
            </CardContent>
          </Card>
        </section>
      </div>

      {isDemo ? <div className="mt-4 lg:mt-6"><Trajectory /></div> : attempts.length > 0 ? <Card className="mt-4 lg:mt-6"><CardContent className="flex items-center justify-between gap-4 p-5 sm:p-6"><div><p className="data-label">Live trajectory</p><p className="mt-1 font-display text-xl font-semibold">{metrics.questionsSolved} answers are shaping your baseline</p><p className="mt-1 text-sm text-muted-foreground">Historical curves appear as your daily record grows; no sample values are mixed into your account.</p></div><Badge variant="success">Live</Badge></CardContent></Card> : null}

      <div className="content-grid mt-4 lg:mt-6">
        <section className="lg:col-span-7" aria-labelledby="subject-readiness-title">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div><p className="data-label">Readiness profile</p><CardTitle id="subject-readiness-title" className="mt-1.5">Where you stand</CardTitle></div>
              <Button variant="ghost" size="sm" asChild><Link to="/progress">View analysis <ArrowRight className="h-3.5 w-3.5" /></Link></Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {readiness.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">{item.label}</span><span className="font-mono text-xs font-medium">{item.value}%</span></div>
                  <Progress value={item.value} indicatorClassName={item.color} label={`${item.label} ${item.value} percent`} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          <Card>
            <CardContent className="flex items-center gap-4 pt-5 sm:pt-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-physics/15 text-amber-600 dark:text-physics"><Flame className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="data-label">Current streak</p><p className="mt-1 font-display text-2xl font-semibold tracking-tight">{isDemo ? 9 : metrics.currentStreak} focused days</p><p className="text-xs text-muted-foreground">Longest: {isDemo ? 14 : metrics.longestStreak} · {isDemo ? 26.4 : metrics.hoursStudied} hours studied</p></div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card className="border-primary/20 bg-primary/[0.04]">
            <CardContent className="pt-5 sm:pt-6">
              <div className="flex items-center justify-between"><p className="data-label">Next review</p><Badge variant="default">{isDemo || lowestMastery ? 'Due now' : 'Start here'}</Badge></div>
              <p className="mt-2 font-display text-xl font-semibold tracking-tight">{isDemo ? 'Newton’s second law' : reviewTopic?.title.en ?? 'Build your diagnostic baseline'}</p>
              <p className="mt-1 text-sm text-muted-foreground">{isDemo ? '8 questions · mastery 71%' : lowestMastery ? `Mastery ${Math.round(lowestMastery.score)}% · adaptive review` : 'Answer a short verified set to personalize the plan.'}</p>
              <Button variant="outline" className="mt-4 w-full justify-between" asChild><Link to={isDemo || lowestMastery ? '/practice?mode=review' : '/diagnostic'}>{isDemo || lowestMastery ? 'Start 9-minute review' : 'Start baseline'} <ChevronRight className="h-4 w-4" /></Link></Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
