import { useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, Clock3, Search, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { mathTopics, physicsTopics } from '@/data/curriculum';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';

const demoMastery = [86, 74, 69, 63, 48, 42, 51, 33, 22];

interface TopicCard {
  id: string;
  title: string;
  order: number;
  mastery: number;
  lessonId?: string;
}

export default function SubjectPage({ subject }: { subject: 'mathematics' | 'physics' }) {
  const [query, setQuery] = useState('');
  const { isDemo } = useAuth();
  const masteries = useAppStore((state) => state.masteries);
  const topicRecords = useAppStore((state) => state.topics);
  const lessons = useAppStore((state) => state.lessons);
  const reduced = useReducedMotion();
  const isMath = subject === 'mathematics';
  const demoTopics = isMath ? mathTopics : physicsTopics;
  const cards = useMemo<TopicCard[]>(() => {
    if (isDemo) return demoTopics.map((title, index) => ({
      id: title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-'),
      title,
      order: index + 1,
      mastery: demoMastery[index] ?? 0,
      ...(title === (isMath ? 'Functions' : 'Newton’s laws') ? { lessonId: isMath ? 'quadratic-functions' : 'newtons-laws' } : {}),
    }));
    return topicRecords
      .filter((topic) => topic.subject === subject && topic.status === 'published' && !topic.demo)
      .sort((left, right) => left.order - right.order)
      .map((topic) => ({
        id: topic.id,
        title: topic.title.en,
        order: topic.order,
        mastery: Math.round(Object.values(masteries).find((item) => item.topicId === topic.id)?.score ?? 0),
        lessonId: lessons.find((lesson) => lesson.topicId === topic.id && lesson.status === 'published' && !lesson.demo)?.id,
      }));
  }, [demoTopics, isDemo, isMath, lessons, masteries, subject, topicRecords]);
  const filtered = useMemo(() => cards.filter((topic) => topic.title.toLowerCase().includes(query.toLowerCase())), [cards, query]);
  const nextTopic = cards.reduce<TopicCard | undefined>((best, topic) => !best || topic.mastery < best.mastery ? topic : best, undefined);
  const pathFor = (topic: TopicCard) => topic.lessonId
    ? `/lesson/${encodeURIComponent(topic.lessonId)}`
    : `/practice/session?mode=practice&topic=${encodeURIComponent(topic.id)}`;

  return (
    <div>
      <PageHeading
        eyebrow={`${isMath ? 'Mathematics' : 'Physics'} · ${cards.length} ${isDemo ? 'roadmap' : 'published'} topics`}
        title={isMath ? 'Build methods you can retrieve fast.' : 'See the model before using the formula.'}
        description={isMath ? 'From forgotten foundations to CSCA-speed problem solving, with mastery earned across repeated attempts.' : 'Learn each physical idea in Russian, recognize its English exam language, then solve it under time.'}
        actions={<div className="flex items-center gap-2">{isDemo ? <Badge variant="warning">Demo mastery</Badge> : <Badge variant="success">Published content</Badge>}{nextTopic ? <Button asChild><Link to={pathFor(nextTopic)}><BookOpen className="h-4 w-4" /> Continue</Link></Button> : null}</div>}
      />

      {nextTopic ? <Card className={`mb-6 overflow-hidden border-0 ${isMath ? 'bg-primary text-primary-foreground' : 'bg-foreground text-background'}`}>
        <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className={`font-mono text-[0.67rem] font-medium uppercase tracking-[0.15em] ${isMath ? 'text-primary-foreground/65' : 'text-background/55'}`}>Next recommended · {nextTopic.mastery ? 'adaptive review' : 'new topic'}</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.05em]">{nextTopic.title}</h2>
            <p className={`mt-2 max-w-xl text-sm leading-relaxed ${isMath ? 'text-primary-foreground/75' : 'text-background/65'}`}>{nextTopic.lessonId ? 'Open the verified lesson, then reinforce it with targeted questions.' : 'No lesson is linked yet, so start with verified topic practice.'}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Badge className="bg-white/15 text-current">Mastery {nextTopic.mastery}%</Badge><Badge className="bg-white/15 text-current">English-first prompts</Badge><Badge className="bg-white/15 text-current">Adaptive review</Badge></div>
          </div>
          <Button variant="secondary" size="lg" asChild><Link to={pathFor(nextTopic)}>Start <ArrowRight className="h-4 w-4" /></Link></Button>
        </CardContent>
      </Card> : <Card className="mb-6"><CardContent className="p-10 text-center"><Sparkles className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl font-semibold">No {isMath ? 'Mathematics' : 'Physics'} topics are published</h2><p className="mt-2 text-sm text-muted-foreground">An administrator can publish the verified topic sequence before learners begin.</p></CardContent></Card>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="font-display text-xl font-semibold tracking-tight">Topic map</h2><p className="text-sm text-muted-foreground">Mastery rises through accuracy, speed, confidence and review.</p></div>
        <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-10" placeholder="Find a topic" aria-label="Find a topic" /></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((topic, index) => {
          const active = topic.id === nextTopic?.id;
          const complete = topic.mastery >= 70;
          return <motion.div key={topic.id} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.18) }}><Link to={pathFor(topic)} className="group block h-full rounded-xl focus-visible:ring-2"><Card className={`h-full transition-transform duration-200 group-hover:-translate-y-0.5 ${active ? 'border-primary/40 bg-primary/[0.035]' : ''}`}><CardContent className="flex h-full flex-col p-5"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl text-xs font-bold ${complete ? 'bg-success/10 text-success' : active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}`}>{complete ? <Check className="h-4 w-4" /> : String(topic.order).padStart(2, '0')}</span>{active ? <Badge>Active</Badge> : topic.mastery === 0 ? <Badge variant="outline">Upcoming</Badge> : <span className="font-mono text-xs font-semibold">{topic.mastery}%</span>}</div><h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{topic.title}</h3><div className="mt-auto pt-4"><Progress value={topic.mastery} indicatorClassName={isMath ? 'bg-primary' : 'bg-physics'} label={`${topic.title} mastery ${topic.mastery} percent`} /><div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{topic.mastery ? 'Review scheduled' : topic.lessonId ? 'Lesson ready' : 'Practice available'}</span><ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></div></div></CardContent></Card></Link></motion.div>;
        })}
      </div>

      {cards.length > 0 && !filtered.length ? <div className="rounded-xl border border-dashed p-10 text-center"><Sparkles className="mx-auto h-5 w-5 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No topic matches “{query}”.</p><Button variant="ghost" className="mt-2" onClick={() => setQuery('')}>Clear search</Button></div> : null}
    </div>
  );
}
