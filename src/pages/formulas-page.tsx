import { useMemo, useState } from 'react';
import { Bookmark, ChevronRight, Sigma } from 'lucide-react';
import { InlineMath } from 'react-katex';
import { toast } from 'sonner';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { readBookmarks, toggleBookmark as toggleUiBookmark } from '@/features/bookmarks/storage';
import { useAuth } from '@/features/auth/auth-provider';
import { countDue, describeInterval } from '@/features/trainers/review-progress';
import { useAppStore } from '@/stores';

interface FormulaView {
  id: string;
  name: string;
  math: string;
  calculates: string;
  variables: string;
  limit: string;
}

interface FormulaQuestion {
  /** The formula this retrieval check belongs to, so the answer updates its progress. */
  formulaId: string;
  prompt: string;
  answers: string[];
  correct: number;
  explain: string;
}

const demoFormulas: FormulaView[] = [
  { id: 'newton', name: 'Newton’s second law', math: 'F=ma', calculates: 'Resultant force from mass and acceleration.', variables: 'F: N · m: kg · a: m/s²', limit: 'Use the resultant force, not an individual force.' },
  { id: 'distance', name: 'Constant-speed distance', math: 's=vt', calculates: 'Distance at constant speed.', variables: 's: m · v: m/s · t: s', limit: 'Do not use this form when speed changes.' },
  { id: 'kinematic', name: 'Velocity after acceleration', math: 'v=u+at', calculates: 'Final velocity under constant acceleration.', variables: 'v,u: m/s · a: m/s² · t: s', limit: 'Acceleration must be constant.' },
  { id: 'quadratic', name: 'Quadratic formula', math: 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}', calculates: 'Roots of ax² + bx + c = 0.', variables: 'a ≠ 0 · discriminant Δ=b²−4ac', limit: 'Real roots require Δ ≥ 0.' },
];

const demoQuestions: FormulaQuestion[] = [
  { formulaId: 'newton', prompt: 'What does F calculate in F = ma?', answers: ['Resultant force', 'Energy', 'Momentum', 'Power'], correct: 0, explain: 'F is the resultant (net) force measured in newtons.' },
  { formulaId: 'distance', prompt: 'Rearrange s = vt for t.', answers: ['t = s/v', 't = sv', 't = v/s', 't = s − v'], correct: 0, explain: 'Divide both sides by v: t = s/v.' },
  { formulaId: 'distance', prompt: 'When should s = vt NOT be used directly?', answers: ['When speed changes', 'When time is in seconds', 'When distance is in metres', 'When v is known'], correct: 0, explain: 'The simple product assumes constant speed.' },
];

function buildQuestions(formulas: FormulaView[]): FormulaQuestion[] {
  const genericDistractors = ['A different physical quantity.', 'Only the graph intercept.', 'A unit conversion by itself.'];
  return formulas.flatMap((formula, index) => {
    const alternatives = formulas.filter((_, itemIndex) => itemIndex !== index).map((item) => item.calculates);
    return [
      {
        formulaId: formula.id,
        prompt: `What does ${formula.name} calculate?`,
        answers: [formula.calculates, ...alternatives, ...genericDistractors].slice(0, 4),
        correct: 0,
        explain: formula.calculates,
      },
      {
        formulaId: formula.id,
        prompt: `Which limitation belongs to ${formula.name}?`,
        answers: [formula.limit, ...formulas.filter((_, itemIndex) => itemIndex !== index).map((item) => item.limit), 'It has no conditions.'].slice(0, 4),
        correct: 0,
        explain: formula.limit,
      },
    ];
  });
}

export default function FormulasPage() {
  const { user, isDemo } = useAuth();
  const ownerId = user?.uid ?? 'anonymous';
  const published = useAppStore((state) => state.formulas);
  const formulas = useMemo<FormulaView[]>(() => isDemo ? demoFormulas : published
    .filter((formula) => formula.status === 'published' && !formula.demo)
    .map((formula) => ({
      id: formula.id,
      name: formula.name.en,
      math: formula.katex,
      calculates: formula.calculates.en,
      variables: formula.variables.map((variable) => `${variable.symbol}: ${variable.meaning.en}${variable.siUnit ? ` · ${variable.siUnit}` : ''}`).join(' · '),
      limit: formula.limitations.en,
    })), [isDemo, published]);
  const questions = useMemo(() => isDemo ? demoQuestions : buildQuestions(formulas), [formulas, isDemo]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const formulaProgress = useAppStore((state) => state.formulaProgress);
  const reviewFormula = useAppStore((state) => state.reviewFormula);
  const [bookmarked, setBookmarked] = useState<string[]>(() => readBookmarks(ownerId).filter((item) => item.type === 'formula').map((item) => item.id.replace(/^formula-/, '')));
  const toggleStoredBookmark = useAppStore((state) => state.toggleBookmark);
  const q = questions.length ? questions[index % questions.length]! : null;
  const next = () => { setIndex((value) => (value + 1) % questions.length); setSelected(null); setSaveError(null); };
  const dueCount = countDue(formulas.map((formula) => formula.id), formulaProgress);
  const currentProgress = q ? formulaProgress[q.formulaId] : undefined;

  /**
   * The answer is graded here against the question's own key, and the result is
   * recorded through the shared scheduler, so the library's due dates come from
   * real retrieval rather than from opening the page.
   */
  const answerQuestion = async (question: FormulaQuestion, choice: number) => {
    setSelected(choice);
    setSaveError(null);
    try {
      await reviewFormula(question.formulaId, {
        isCorrect: choice === question.correct,
        confidence: choice === question.correct ? 'sure' : 'guess',
      });
    } catch {
      setSaveError('That answer could not be saved. Your earlier progress is unchanged.');
    }
  };
  const bookmark = async (formula: FormulaView) => {
    try {
      await toggleStoredBookmark('formula', formula.id);
      const active = toggleUiBookmark(ownerId, { id: `formula-${formula.id}`, type: 'formula', title: formula.name, subtitle: formula.calculates, path: '/formulas' });
      setBookmarked((current) => active ? [...new Set([...current, formula.id])] : current.filter((id) => id !== formula.id));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bookmark could not be saved.');
    }
  };

  if (!q) return <div><PageHeading eyebrow="Formula trainer" title="Know when the formula deserves to be used." description="Train meaning, variables, SI units, rearrangement and limitations." actions={<Badge variant="outline">Published content</Badge>} /><Card><CardContent className="p-10 text-center"><Sigma className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl font-semibold">No formulas are published yet</h2><p className="mt-2 text-sm text-muted-foreground">An administrator can publish verified formulas with variables, units and limitations.</p></CardContent></Card></div>;

  return <div><PageHeading eyebrow="Formula trainer" title="Know when the formula deserves to be used." description="Train meaning, variables, SI units, rearrangement and limitations — not visual recognition alone." actions={<Badge variant={isDemo ? 'outline' : 'success'}>{isDemo ? 'Original formula set' : 'Published formulas'}</Badge>} /><div className="content-grid"><section className="lg:col-span-7"><Card><CardContent className="p-6 sm:p-8"><div className="flex items-center justify-between"><p className="data-label">Retrieval check · {(index % questions.length) + 1}/{questions.length}</p><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Sigma className="h-4 w-4" /></span></div><h2 className="mt-7 font-display text-2xl font-semibold leading-snug tracking-tight">{q.prompt}</h2><div className="mt-6 grid gap-2 sm:grid-cols-2">{q.answers.map((item, itemIndex) => <button key={`${itemIndex}-${item}`} onClick={() => void answerQuestion(q, itemIndex)} disabled={selected !== null} className={`min-h-14 rounded-2xl border p-4 text-left text-sm font-semibold ${selected !== null && itemIndex === q.correct ? 'border-success/30 bg-success/[0.06] text-success' : selected === itemIndex ? 'border-destructive/30 bg-destructive/[0.05]' : 'hover:border-primary'}`}>{item}</button>)}</div>{selected !== null ? <div className="mt-5 rounded-xl bg-secondary p-4 text-sm"><strong>{selected === q.correct ? 'Correct.' : 'Repair:'}</strong> {q.explain}<Button size="sm" className="float-right" onClick={next}>Next <ChevronRight className="h-3.5 w-3.5" /></Button></div> : null}{saveError ? <p className="mt-4 text-sm text-destructive" role="alert">{saveError}</p> : null}<p className="mt-5 border-t pt-4 text-xs leading-relaxed text-muted-foreground">{dueCount} of {formulas.length} {formulas.length === 1 ? 'formula is' : 'formulas are'} due for retrieval. {currentProgress ? `This one scores ${Math.round(currentProgress.score)}% over ${currentProgress.attempts} ${currentProgress.attempts === 1 ? 'attempt' : 'attempts'}${describeInterval(currentProgress.intervalDays) ? `; ${describeInterval(currentProgress.intervalDays)!.toLowerCase()}` : ''}.` : 'This one has not been retrieved yet, so no interval is scheduled.'}</p></CardContent></Card></section><aside className="lg:col-span-5"><Card><CardContent className="p-5 sm:p-6"><p className="data-label">Formula library</p><div className="mt-4 space-y-3">{formulas.map((formula) => <details key={formula.id} className="group rounded-xl border bg-background/50 p-4"><summary className="cursor-pointer list-none"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{formula.name}</p><div className="mt-1 text-primary"><InlineMath math={formula.math} /></div></div><button onClick={(event) => { event.preventDefault(); void bookmark(formula); }} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-secondary" aria-label={`Bookmark ${formula.name}`}><Bookmark className={`h-4 w-4 ${bookmarked.includes(formula.id) ? 'fill-current text-primary' : ''}`} /></button></div></summary><div className="mt-4 space-y-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground"><p><strong className="text-foreground">Calculates:</strong> {formula.calculates}</p><p><strong className="text-foreground">Variables:</strong> {formula.variables}</p><p><strong className="text-foreground">Limit:</strong> {formula.limit}</p></div></details>)}</div></CardContent></Card></aside></div></div>;
}
