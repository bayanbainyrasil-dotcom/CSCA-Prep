import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookOpen, Bookmark, Brain, Check, ChevronRight, CircleHelp, Eye, Languages, Lightbulb, NotebookPen, Play, Sparkles, TimerReset } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/field';
import { Progress } from '@/components/ui/progress';
import { isBookmarked, toggleBookmark as toggleUiBookmark } from '@/features/bookmarks/storage';
import { NewtonVisual } from '@/features/lesson/newton-visual';
import { QuadraticVisual } from '@/features/lesson/quadratic-visual';
import { useAppStore } from '@/stores';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';
import type { LessonSection } from '@/domain';

const steps = ['Big idea', 'Visual', 'English', 'Vocabulary', 'Formula', 'Worked example', 'Guided practice', 'Independent', 'CSCA-style', 'Speed round'];

export default function LessonPage() {
  const { lessonId = 'newtons-laws' } = useParams();
  const { user, isDemo } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const publishedLessons = useAppStore((state) => state.lessons);
  const publishedLesson = isDemo ? undefined : publishedLessons.find((item) => item.id === lessonId && item.status === 'published');
  const isMath = publishedLesson ? publishedLesson.subject === 'mathematics' : lessonId.includes('quadratic');
  const [step, setStep] = useState(0);
  const [rescue, setRescue] = useState(false);
  const hydrated = useAppStore((state) => state.hydrated);
  const storedNotes = useAppStore((state) => state.notes);
  const storedBookmarks = useAppStore((state) => state.bookmarks);
  const saveNote = useAppStore((state) => state.saveNote);
  const toggleStoredBookmark = useAppStore((state) => state.toggleBookmark);
  const storedNote = Object.values(storedNotes).find((item) => item.topicId === lessonId);
  const [bookmarked, setBookmarked] = useState(() => Object.values(storedBookmarks).some((item) => item.targetType === 'lesson' && item.targetId === lessonId) || isBookmarked(ownerId, `lesson-${lessonId}`));
  const navigate = useNavigate();
  const title = publishedLesson?.title.en ?? (isMath ? 'Quadratic functions' : 'Newton’s second law');
  const lessonSteps = publishedLesson?.sections.map((section) => section.title.en) ?? steps;
  const progress = ((step + 1) / lessonSteps.length) * 100;
  const content = publishedLesson
    ? { icon: <BookOpen className="h-4 w-4" />, title: publishedLesson.sections[step]?.title.en ?? publishedLesson.title.en }
    : getLessonContent(step, isMath);

  const toggleLessonBookmark = async () => {
    try {
      await toggleStoredBookmark('lesson', lessonId);
      const active = toggleUiBookmark(ownerId, { id: `lesson-${lessonId}`, type: 'lesson', title, subtitle: isMath ? 'Mathematics · Foundation' : 'Physics · Foundation', path: `/lesson/${lessonId}` });
      setBookmarked(active);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bookmark could not be saved.');
    }
  };

  if (!isDemo && !publishedLesson) {
    return <div><PageHeading eyebrow="Published lessons" title="This lesson is not available." description="It may have been archived or has not been published yet." /><Button variant="outline" asChild><Link to={isMath ? '/mathematics' : '/physics'}><ArrowLeft className="h-4 w-4" />Back to topic map</Link></Button></div>;
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3"><Button variant="ghost" asChild><Link to={isMath ? '/mathematics' : '/physics'}><ArrowLeft className="h-4 w-4" /> Topic map</Link></Button><div className="flex items-center gap-2"><Button variant={bookmarked ? 'secondary' : 'ghost'} size="icon" onClick={() => void toggleLessonBookmark()} aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark lesson'}><Bookmark className={`h-4 w-4 ${bookmarked ? 'fill-current' : ''}`} /></Button><Button variant="outline" onClick={() => setRescue(!rescue)}><CircleHelp className="h-4 w-4" /> I don’t understand</Button></div></div>
      <PageHeading eyebrow={`${isMath ? 'Mathematics' : 'Physics'} · ${publishedLesson ? 'Published lesson' : 'Foundation'}`} title={title} description={publishedLesson?.summary.en ?? (isMath ? 'Recognize what the graph tells you before choosing an algebraic method.' : 'Turn a sentence about forces into one diagram and one relationship.')} actions={!publishedLesson ? <Badge variant="outline">Built-in lesson</Badge> : <Badge variant="success">Verified content</Badge>} />

      <div className="mb-6"><div className="scrollbar-none mb-3 flex gap-2 overflow-x-auto pb-1">{lessonSteps.map((label, index) => <button key={label} onClick={() => setStep(index)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${index === step ? 'bg-foreground text-background' : index < step ? 'bg-success/10 text-success' : 'bg-secondary text-muted-foreground'}`}>{index < step ? <Check className="mr-1 inline h-3 w-3" /> : null}{index + 1}. {label}</button>)}</div><Progress value={progress} label={`Lesson ${Math.round(progress)} percent complete`} /></div>

      {rescue ? (
        <Card className="mb-5 border-accent/30 bg-accent/[0.045]"><CardContent className="p-5 sm:p-6"><div className="flex gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><Sparkles className="h-4 w-4" /></span><div><p className="data-label">Rescue explanation</p><h2 className="mt-1 font-display text-xl font-semibold">{publishedLesson ? 'Read the idea in its simplest form.' : 'Imagine pushing shopping carts.'}</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{publishedLesson ? (publishedLesson.sections[step]?.body.ru ?? publishedLesson.summary.ru ?? publishedLesson.summary.en) : 'The same push changes an empty cart’s motion more than a full cart’s. Force is your push, mass is how hard the cart is to accelerate, and acceleration is the change you see.'}</p><div className="mt-4 rounded-xl border bg-card p-4 text-sm"><strong>One step:</strong> {publishedLesson ? publishedLesson.sections[step]?.body.en : 'if the push doubles while mass stays the same, acceleration doubles.'}</div></div></div></CardContent></Card>
      ) : null}

      <div className="content-grid">
        <section className="lg:col-span-8">
          <Card><CardContent className="p-5 sm:p-7">
            <div className="mb-5 flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{content.icon}</span><div><p className="data-label">Step {step + 1} · {lessonSteps[step]}</p><h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{content.title}</h2></div></div>
            {publishedLesson ? <PublishedLessonSection section={publishedLesson.sections[step]!} /> : step === 1 ? (isMath ? <QuadraticVisual /> : <NewtonVisual />) : <LessonBody key={`${lessonId}-${step}`} step={step} isMath={isMath} />}
            <div className="mt-7 flex items-center justify-between border-t pt-5"><Button variant="ghost" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}>Back</Button>{step < lessonSteps.length - 1 ? <Button onClick={() => setStep((value) => value + 1)}>Continue <ChevronRight className="h-4 w-4" /></Button> : <Button onClick={() => navigate(`/practice?topic=${publishedLesson?.topicId ?? lessonId}`)}><Play className="h-4 w-4 fill-current" /> Practice this idea</Button>}</div>
          </CardContent></Card>
        </section>
        <aside className="space-y-4 lg:col-span-4">
          <LessonNotes key={`${ownerId}:${lessonId}:${hydrated ? storedNote?.id ?? 'local' : 'loading'}`} ownerId={ownerId} lessonId={lessonId} hydrated={hydrated} storedText={storedNote?.text} saveNote={saveNote} />
          <Card><CardContent className="p-5"><p className="data-label">Lesson outcome</p><ul className="mt-3 space-y-2 text-sm text-muted-foreground"><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />Complete all {lessonSteps.length} learning stages.</li><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />Name the known and unknown quantities.</li><li className="flex gap-2"><Check className="mt-0.5 h-4 w-4 text-success" />Choose and check the relationship.</li></ul></CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

function LessonNotes({ ownerId, lessonId, hydrated, storedText, saveNote }: { ownerId: string; lessonId: string; hydrated: boolean; storedText?: string; saveNote: (topicId: string, text: string) => Promise<void> }) {
  const noteKey = `csca-note-ui-v1:${ownerId}:${lessonId}`;
  const initialText = hydrated ? storedText ?? localStorage.getItem(noteKey) ?? '' : '';
  const [notes, setNotes] = useState(initialText);
  const noteTimer = useRef<number | undefined>(undefined);
  const noteValue = useRef(initialText);
  const noteDirty = useRef(false);

  useEffect(() => () => {
    if (noteTimer.current !== undefined) window.clearTimeout(noteTimer.current);
    if (noteDirty.current) void saveNote(lessonId, noteValue.current).catch(() => undefined);
  }, [lessonId, saveNote]);

  const updateNote = (value: string) => {
    setNotes(value);
    noteValue.current = value;
    noteDirty.current = true;
    localStorage.setItem(noteKey, value);
    if (noteTimer.current !== undefined) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => {
      void saveNote(lessonId, value)
        .then(() => { noteDirty.current = false; })
        .catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Note could not be saved.'));
    }, 1_200);
  };

  return <Card><CardContent className="p-5"><div className="flex items-center gap-2"><NotebookPen className="h-4 w-4 text-primary" /><h3 className="font-display font-semibold">My notes</h3></div><Textarea value={notes} disabled={!hydrated} onChange={(event) => updateNote(event.target.value)} className="mt-4 min-h-32" placeholder={hydrated ? 'Write the idea in your own words…' : 'Loading your saved note…'} /><p className="mt-2 text-xs text-muted-foreground">Saved locally while you type; cloud sync is debounced.</p></CardContent></Card>;
}

function PublishedLessonSection({ section }: { section: LessonSection }) {
  const componentKey = section.visual?.componentKey?.toLowerCase();
  const builtInVisual = componentKey?.includes('newton')
    ? <NewtonVisual />
    : componentKey?.includes('quadratic')
      ? <QuadraticVisual />
      : null;

  return (
    <div className="space-y-5">
      <p className="text-sm leading-7 text-muted-foreground sm:text-base">{section.body.en}</p>
      {section.body.ru ? (
        <details className="rounded-xl border bg-secondary/35 p-4">
          <summary className="cursor-pointer text-sm font-semibold">Russian support</summary>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{section.body.ru}</p>
        </details>
      ) : null}
      {section.katex.map((expression) => (
        <div key={expression} className="overflow-x-auto rounded-xl border bg-background p-4 text-center">
          <BlockMath math={expression} />
        </div>
      ))}
      {builtInVisual}
      {!builtInVisual && section.visual?.assetUrl ? (
        <figure className="overflow-hidden rounded-xl border bg-background">
          <img
            src={section.visual.assetUrl}
            alt={section.visual.description.en}
            className="max-h-[32rem] w-full object-contain"
            loading="lazy"
          />
          <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
            {section.visual.description.en}
          </figcaption>
        </figure>
      ) : null}
      {!builtInVisual && section.visual && !section.visual.assetUrl ? (
        <div className="rounded-xl border border-dashed bg-secondary/35 p-5 text-sm leading-6 text-muted-foreground">
          <Eye className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
          {section.visual.description.en}
        </div>
      ) : null}
    </div>
  );
}

function getLessonContent(step: number, isMath: boolean) {
  const icons = [<Lightbulb key="a" className="h-4 w-4" />, <Eye key="b" className="h-4 w-4" />, <Languages key="c" className="h-4 w-4" />, <Languages key="d" className="h-4 w-4" />, <Brain key="e" className="h-4 w-4" />, <NotebookPen key="f" className="h-4 w-4" />, <CircleHelp key="g" className="h-4 w-4" />, <Check key="h" className="h-4 w-4" />, <Sparkles key="i" className="h-4 w-4" />, <TimerReset key="j" className="h-4 w-4" />];
  const titles = isMath
    ? ['A parabola is a map of change', 'Move the coefficient and watch', 'Recognize the exam sentence', 'Words attached to the graph', 'Three forms, three jobs', 'Find the vertex before roots', 'Build the equation together', 'Your turn without hints', 'Read, classify, solve', 'See the shortcut fast']
    : ['Forces explain changes in motion', 'Push the model yourself', 'Recognize the exam sentence', 'Words that signal force', 'One relationship, three quantities', 'Draw before substituting', 'Build the equation together', 'Your turn without hints', 'Read, classify, solve', 'One minute, one clean chain'];
  return { icon: icons[step], title: titles[step] ?? titles[0] };
}

function LessonBody({ step, isMath }: { step: number; isMath: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  useEffect(() => {
    if (step !== 9 || selected !== null || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [selected, step, timeLeft]);
  if (step === 0) return <div className="space-y-4 text-sm leading-7 text-muted-foreground"><p>{isMath ? 'A quadratic function does more than produce a curved graph. Its shape immediately tells you whether there is a maximum or minimum, where the turning point lies, and how many real roots may exist.' : 'An object changes its velocity only when the forces on it do not balance. The net force points in the same direction as the acceleration.'}</p><div className="rounded-xl border-l-4 border-l-primary bg-secondary/55 p-5 text-foreground"><strong>Remember:</strong> {isMath ? 'shape first, method second.' : 'no net force means no acceleration — not necessarily no motion.'}</div></div>;
  if (step === 2) return <div className="space-y-4"><p className="rounded-xl border bg-background p-5 font-medium leading-7">{isMath ? 'The graph of a quadratic function has its vertex at (2, −3). Determine the minimum value of the function.' : 'A 3 kg block is acted on by a resultant force of 12 N. Determine the acceleration of the block.'}</p><p className="text-sm text-muted-foreground"><strong className="text-foreground">Signal words:</strong> {isMath ? 'vertex, minimum value, quadratic function.' : 'resultant force, acceleration, acted on.'}</p></div>;
  if (step === 3) return <div className="grid gap-3 sm:grid-cols-2">{(isMath ? [['vertex','вершина'],['roots','корни'],['opens upward','ветви направлены вверх'],['minimum value','минимальное значение']] : [['resultant force','равнодействующая сила'],['at rest','в состоянии покоя'],['magnitude','величина / модуль'],['accelerates','ускоряется']]).map(([en,ru]) => <div key={en} className="rounded-xl border p-4"><p className="font-semibold">{en}</p><p className="mt-1 text-sm text-muted-foreground">{ru}</p></div>)}</div>;
  if (step === 4) return <div className="rounded-xl border bg-background p-6 text-center"><BlockMath math={isMath ? 'y=a(x-h)^2+k' : 'F_{net}=ma'} /><p className="mt-4 text-sm text-muted-foreground">{isMath ? <><InlineMath math="(h,k)" /> is the vertex; <InlineMath math="a" /> controls direction and width.</> : <><InlineMath math="F_{net}" /> in newtons, <InlineMath math="m" /> in kilograms, <InlineMath math="a" /> in m/s².</>}</p></div>;
  if (step === 5) return <div className="space-y-3 text-sm"><p className="rounded-xl border bg-background p-4"><strong>Given:</strong> {isMath ? 'y = 2(x − 3)² − 5' : 'm = 3 kg, Fnet = 12 N'}<br /><strong>Find:</strong> {isMath ? 'vertex and minimum' : 'acceleration'}</p><div className="rounded-xl bg-secondary/55 p-5"><BlockMath math={isMath ? '(h,k)=(3,-5)\\Rightarrow y_{min}=-5' : 'a=\\frac{F_{net}}{m}=\\frac{12}{3}=4\\,\\mathrm{m/s^2}'} /></div><p className="text-muted-foreground"><strong className="text-foreground">Check:</strong> {isMath ? 'a > 0, so the vertex is a minimum.' : 'N/kg equals m/s² and the direction matches the net force.'}</p></div>;
  const prompt = isMath ? 'For y = −(x + 1)² + 4, identify the vertex and maximum value.' : 'A 5 kg object accelerates at 2 m/s². What net force acts on it?';
  const answers = isMath ? ['(−1, 4), max 4', '(1, 4), max 4', '(−1, −4), min −4', '(1, −4), min −4'] : ['2.5 N', '7 N', '10 N', '25 N'];
  const correctIndex = isMath ? 0 : 2;
  return <div className="space-y-4"><div className="rounded-xl border bg-background p-5"><div className="flex items-center justify-between"><p className="data-label">Question</p>{step === 9 ? <Badge variant={timeLeft <= 10 ? 'warning' : 'outline'}>{timeLeft}s</Badge> : null}</div><p className="mt-3 text-base font-semibold leading-7">{prompt}</p></div>{step === 6 ? <div className="rounded-xl bg-primary/[0.06] p-4 text-sm"><strong>Hint:</strong> {isMath ? 'Compare with y = a(x − h)² + k.' : 'Name the three quantities in F = ma before calculating.'}</div> : null}<div className="grid grid-cols-2 gap-2">{answers.map((answer, index) => <button key={answer} disabled={selected !== null || timeLeft === 0} onClick={() => setSelected(index)} className={cn('min-h-12 rounded-xl border bg-card px-3 text-sm font-semibold hover:border-primary hover:bg-primary/[0.03]', selected !== null && index === correctIndex && 'border-success/30 bg-success/[0.06] text-success', selected === index && index !== correctIndex && 'border-destructive/30 bg-destructive/[0.05]')}>{String.fromCharCode(65 + index)}. {answer}</button>)}</div>{selected !== null ? <div className="rounded-xl bg-secondary p-4 text-sm"><strong>{selected === correctIndex ? 'Correct.' : 'Repair:'}</strong> {isMath ? 'In vertex form, x + 1 means h = −1 and k = 4; the negative coefficient makes 4 a maximum.' : 'Use F = ma = 5 × 2 = 10 N.'}</div> : timeLeft === 0 ? <div className="rounded-xl bg-physics/10 p-4 text-sm"><strong>Time.</strong> Review the signal words, then move to the next step.</div> : null}</div>;
}
