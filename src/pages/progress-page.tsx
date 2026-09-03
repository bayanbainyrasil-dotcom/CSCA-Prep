import { useMemo, useState } from 'react';
import { Activity, Brain, Clock3, Languages, TrendingUp } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores';
import type { Attempt } from '@/domain';

function accuracy(attempts: Attempt[], subject: Attempt['subject']) {
  const items = attempts.filter((item) => item.subject === subject);
  return items.length ? Math.round(items.filter((item) => item.isCorrect).length / items.length * 100) : 0;
}

function buildHistory(attempts: Attempt[]) {
  const sorted = [...attempts].sort((left, right) => left.answeredAt.localeCompare(right.answeredAt));
  const groups = new Map<string, Attempt[]>();
  for (const attempt of sorted) {
    const day = attempt.answeredAt.slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), attempt]);
  }
  const cumulative: Attempt[] = [];
  return [...groups.entries()].map(([day, daily]) => {
    cumulative.push(...daily);
    const math = accuracy(cumulative, 'mathematics');
    const physics = accuracy(cumulative, 'physics');
    const english = cumulative.length ? Math.round(cumulative.reduce((sum, item) => sum + item.englishComprehension, 0) / cumulative.length * 100) : 0;
    const speed = cumulative.length ? Math.round(cumulative.reduce((sum, item) => sum + Math.max(0, Math.min(1, 1 - Math.max(0, item.durationSeconds - 60) / 120)), 0) / cumulative.length * 100) : 0;
    return { date: new Date(`${day}T00:00:00`).toLocaleDateString('en', { month: 'short', day: 'numeric' }), iso: day, math, physics, readiness: Math.round(math * 0.35 + physics * 0.35 + english * 0.15 + speed * 0.15), speed };
  });
}

export default function ProgressPage() {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('30d');
  const [referenceNow] = useState(() => Date.now());
  const metrics = useAppStore((state) => state.metrics);
  const attempts = useAppStore((state) => state.attempts);
  const masteries = useAppStore((state) => state.masteries);
  const topicRecords = useAppStore((state) => state.topics);
  const allHistory = useMemo(() => buildHistory(attempts), [attempts]);
  const history = useMemo(() => {
    if (range === 'all') return allHistory;
    const cutoff = referenceNow - (range === '7d' ? 7 : 30) * 86_400_000;
    return allHistory.filter((item) => Date.parse(`${item.iso}T00:00:00`) >= cutoff);
  }, [allHistory, range, referenceNow]);
  const topics = Object.values(masteries)
    .sort((left, right) => right.score - left.score)
    .slice(0, 12)
    .map((mastery) => [topicRecords.find((item) => item.id === mastery.topicId)?.title.en ?? mastery.topicId, Math.round(mastery.score)] as const);
  const errors = [
    { name: 'English comprehension', value: metrics.lossReasons['english-comprehension'] },
    { name: 'Concept', value: metrics.lossReasons.concept },
    { name: 'Formula', value: metrics.lossReasons.formula },
    { name: 'Calculation', value: metrics.lossReasons.calculation },
    { name: 'Careless', value: metrics.lossReasons.careless },
    { name: 'Time', value: metrics.lossReasons.time },
    { name: 'Guessed', value: metrics.lossReasons.guessed },
  ].filter((item) => item.value > 0);
  const cards = [[Brain, `${metrics.mathematicsReadiness}%`, 'Mathematics', `${metrics.questionsSolved} answers`, 'text-primary'], [Activity, `${metrics.physicsReadiness}%`, 'Physics', `${metrics.questionsSolved} answers`, 'text-amber-700 dark:text-physics'], [Languages, `${metrics.englishComprehension}%`, 'English comprehension', `${metrics.questionsSolved} answers`, 'text-accent'], [Clock3, `${metrics.examSpeed}%`, 'Exam speed', `${metrics.questionsSolved} answers`, 'text-success']] as const;
  const studyRecord = [['Current streak', `${metrics.currentStreak} days`], ['Longest streak', `${metrics.longestStreak} days`], ['Completed days', String(metrics.completedDays)], ['Hours studied', `${metrics.hoursStudied} h`], ['Questions solved', String(metrics.questionsSolved)]];

  return <div>
    <PageHeading eyebrow="Progress intelligence" title="Measure retrieval, not time spent." description="Mastery combines repeated accuracy, speed, confidence, difficulty and spaced review. Scores shown here are internal planning metrics." actions={<Badge variant="success">Your recorded data</Badge>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([Icon, value, label, delta, color]) => <Card key={label}><CardContent className="p-5"><div className="flex items-start justify-between"><Icon className={`h-5 w-5 ${color}`} /><Badge variant="outline">{delta}</Badge></div><p className="mt-5 font-display text-3xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>
    <div className="content-grid mt-5">
      <Card className="lg:col-span-8"><CardContent className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="data-label">Readiness history</p><h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Knowledge becomes faster through retrieval</h2></div><div className="flex rounded-xl bg-secondary p-1">{([['7d', '7 days'], ['30d', '30 days'], ['all', 'All time']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)} className={cn('min-h-12 rounded-lg px-3 py-1.5 text-xs font-bold', range === value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>{label}</button>)}</div></div>{history.length ? <div className="mt-6 h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={history}><defs><linearGradient id="ready" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" /><XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} /><Legend /><Area type="monotone" dataKey="readiness" name="Readiness" stroke="hsl(var(--primary))" fill="url(#ready)" strokeWidth={2.5} /><Area type="monotone" dataKey="speed" name="Speed" stroke="hsl(var(--success))" fill="transparent" strokeWidth={2} /></AreaChart></ResponsiveContainer></div> : <EmptyMetric text="Complete your first practice questions to start a real readiness history." />}</CardContent></Card>
      <Card className="lg:col-span-4"><CardContent className="p-5 sm:p-6"><div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /><h2 className="font-display text-lg font-semibold">Study record</h2></div><div className="mt-5 space-y-4">{studyRecord.map(([label, value]) => <div key={label} className="flex items-center justify-between border-b pb-3 last:border-0"><span className="text-sm text-muted-foreground">{label}</span><strong className="font-mono text-sm">{value}</strong></div>)}</div></CardContent></Card>
    </div>
    <div className="content-grid mt-5">
      <Card className="lg:col-span-7"><CardContent className="p-5 sm:p-6"><div><p className="data-label">Topic mastery heatmap</p><h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Strong patterns and repair zones</h2></div>{topics.length ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">{topics.map(([topic, value]) => <div key={topic} className={cn('rounded-2xl border p-4', value >= 70 ? 'border-success/20 bg-success/[0.07]' : value >= 50 ? 'border-physics/25 bg-physics/[0.07]' : 'border-destructive/15 bg-destructive/[0.045]')}><p className="font-display text-2xl font-semibold">{value}</p><p className="mt-1 text-xs font-semibold">{topic}</p><p className="mt-1 text-[0.65rem] text-muted-foreground">{value >= 70 ? 'Strong' : value >= 50 ? 'Developing' : 'Needs repair'}</p></div>)}</div> : <EmptyMetric text="Topic mastery appears after your first graded attempts." />}</CardContent></Card>
      <Card className="lg:col-span-5"><CardContent className="p-5 sm:p-6"><p className="data-label">Why you lose points</p><h2 className="mt-1 font-display text-xl font-semibold tracking-tight">Error classification</h2>{errors.length ? <div className="mt-5 h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={errors} layout="vertical" margin={{ left: 18, right: 10 }}><CartesianGrid horizontal={false} stroke="hsl(var(--border))" /><XAxis type="number" domain={[0, 100]} hide /><YAxis type="category" dataKey="name" width={115} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" /><Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 14 }} /><Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 7, 7, 0]} /></BarChart></ResponsiveContainer></div> : <EmptyMetric text="Classified mistakes will reveal your point-loss pattern." />}</CardContent></Card>
    </div>
  </div>;
}

function EmptyMetric({ text }: { text: string }) {
  return <div className="mt-5 grid min-h-48 place-items-center rounded-2xl border border-dashed bg-secondary/25 p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
