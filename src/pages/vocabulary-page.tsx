import { useCallback, useMemo, useState } from 'react';
import { Check, Languages, RotateCcw, Search, Shuffle, Volume2 } from 'lucide-react';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { useAuth } from '@/features/auth/auth-provider';
import { pickLocalized } from '@/features/i18n/localized-text';
import { countDue, describeInterval, isTrainerItemDue } from '@/features/trainers/review-progress';
import { useAppStore } from '@/stores';
import type { ExplanationLanguage } from '@/domain';

interface VocabCard {
  /** Stable across reloads, so review progress can be stored against it. */
  id: string;
  english: string;
  russian: string;
  explanation: string;
  explanationIsFallback: boolean;
  example: string;
  category: string;
}

const DEMO_WORDS = [
  ['determine', 'определить / найти', 'Find the requested value from the given information.', 'Determine the acceleration of the object.', 'Commands'],
  ['given', 'дано', 'Information supplied in the question.', 'Given that x > 0, simplify the expression.', 'Commands'],
  ['respectively', 'соответственно', 'Match items in the same stated order.', 'The masses are 2 kg and 3 kg, respectively.', 'Comparison'],
  ['at rest', 'в состоянии покоя', 'Velocity equals zero at that moment.', 'The car starts from rest.', 'Physics'],
  ['magnitude', 'величина / модуль', 'Size without direction.', 'Find the magnitude of the resultant force.', 'Physics'],
  ['displacement', 'перемещение', 'Change in position with direction.', 'Calculate the total displacement.', 'Physics'],
  ['slope', 'наклон', 'Rate of vertical change per horizontal change.', 'Determine the slope of the graph.', 'Graphs'],
  ['domain', 'область определения', 'All allowed input values of a function.', 'State the domain of the function.', 'Math'],
  ['range', 'область значений', 'All possible output values of a function.', 'Find the range shown on the graph.', 'Math'],
  ['approximately', 'приблизительно', 'A value close to, but not exactly equal to, another.', 'The answer is approximately 3.14.', 'Comparison'],
] as const;

/** Demo cards need an id that survives a reload, but must not collide with published ids. */
const demoCardId = (english: string) => `demo-vocab:${english.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

type Direction = 'en-ru' | 'ru-en' | 'meaning-word';
type Rating = 'again' | 'hard' | 'good';

const RATINGS: Record<Rating, { isCorrect: boolean; confidence: 'sure' | 'not-sure' | 'guess' }> = {
  again: { isCorrect: false, confidence: 'guess' },
  hard: { isCorrect: true, confidence: 'not-sure' },
  good: { isCorrect: true, confidence: 'sure' },
};

export default function VocabularyPage() {
  const { isDemo } = useAuth();
  const publishedVocabulary = useAppStore((state) => state.vocabulary);
  const progressByVocabularyId = useAppStore((state) => state.vocabularyProgress);
  const reviewVocabulary = useAppStore((state) => state.reviewVocabulary);
  const language: ExplanationLanguage = useAppStore((state) => state.settings.explanationLanguage);

  const cards = useMemo<VocabCard[]>(() => {
    if (isDemo) {
      return DEMO_WORDS.map(([english, russian, explanation, example, category]) => ({
        id: demoCardId(english),
        english,
        russian,
        // The demo set carries English explanations only; say so rather than
        // showing a blank panel to a learner who asked for Russian.
        explanation: language === 'ru' ? russian : explanation,
        explanationIsFallback: language === 'ru' || language === 'zh',
        example,
        category,
      }));
    }
    return publishedVocabulary
      .filter((entry) => entry.status === 'published' && !entry.demo)
      .map((entry) => {
        const explanation = pickLocalized(entry.simpleExplanation, language);
        return {
          id: entry.id,
          english: entry.english,
          russian: entry.russian,
          explanation: explanation.text,
          explanationIsFallback: explanation.fallback,
          example: entry.exampleSentence,
          category: entry.category,
        };
      });
  }, [isDemo, language, publishedVocabulary]);

  const [query, setQuery] = useState('');
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [direction, setDirection] = useState<Direction>('en-ru');
  const [saveError, setSaveError] = useState<string | null>(null);

  const filtered = useMemo(
    () => cards.filter((item) => `${item.english} ${item.russian} ${item.category}`.toLowerCase().includes(query.toLowerCase())),
    [cards, query],
  );
  const card = cards.length ? cards[cardIndex % cards.length] : undefined;
  const progress = card ? progressByVocabularyId[card.id] : undefined;

  const dueCount = useMemo(
    () => countDue(cards.map((item) => item.id), progressByVocabularyId),
    [cards, progressByVocabularyId],
  );
  const masteredCount = useMemo(
    () => cards.filter((item) => progressByVocabularyId[item.id]?.mastered === true).length,
    [cards, progressByVocabularyId],
  );

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card) return;
      setSaveError(null);
      try {
        await reviewVocabulary(card.id, RATINGS[rating]);
      } catch {
        setSaveError('That review could not be saved. Your earlier progress is unchanged.');
      }
      setCardIndex((value) => (value + 1) % Math.max(1, cards.length));
      setRevealed(false);
    },
    [card, cards.length, reviewVocabulary],
  );

  if (!card) {
    return (
      <div>
        <PageHeading
          eyebrow="English for CSCA"
          title="Recognize the instruction before the maths."
          description="Cards alternate word, meaning and sentence contexts, and each rating schedules the next review."
          actions={<Badge variant="outline">Published content</Badge>}
        />
        <Card><CardContent className="p-10 text-center">
          <Languages className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-2xl font-semibold">No vocabulary is published yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">An administrator can add verified Mathematics, Physics and command-language entries.</p>
        </CardContent></Card>
      </div>
    );
  }

  const prompt = direction === 'en-ru' ? card.english : direction === 'ru-en' ? card.russian : card.explanation;
  const answer = direction === 'en-ru' ? card.russian : card.english;
  const intervalText = describeInterval(progress?.intervalDays);
  const isDue = isTrainerItemDue(progress);

  return (
    <div>
      <PageHeading
        eyebrow="English for CSCA"
        title="Recognize the instruction before the maths."
        description="Cards alternate word, meaning and sentence contexts, and each rating schedules the next review."
        actions={<Badge variant={isDemo ? 'outline' : 'success'}>{isDemo ? 'Original vocabulary set' : 'Published vocabulary'}</Badge>}
      />

      <div className="content-grid">
        <section className="lg:col-span-7">
          <Card className="overflow-hidden"><CardContent className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5">
              <div className="flex gap-2">
                {([['en-ru', 'EN → RU'], ['ru-en', 'RU → EN'], ['meaning-word', 'Meaning → word']] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => { setDirection(value); setRevealed(false); }}
                    className={`rounded-full px-3 py-2 text-xs font-bold ${direction === value ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setCardIndex(Math.floor(Math.random() * cards.length))} aria-label="Shuffle cards">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid min-h-[360px] place-items-center p-6 text-center sm:p-10">
              <div>
                <p className="data-label">
                  Card {cardIndex + 1} · {card.category}
                  {isDue ? ' · due now' : intervalText ? ` · ${intervalText.toLowerCase()}` : ''}
                </p>
                <button onClick={() => setRevealed(true)} className="mt-6 block max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">
                  {prompt}
                </button>
                {revealed ? (
                  <div className="mt-8">
                    <p className="font-display text-2xl font-semibold text-primary">{answer}</p>
                    <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{card.explanation}</p>
                    {card.explanationIsFallback ? (
                      <p className="mt-2 text-xs text-muted-foreground">This entry has no translated explanation yet, so the English one is shown.</p>
                    ) : null}
                    <p className="mt-4 rounded-xl bg-secondary p-4 text-sm italic">“{card.example}”</p>
                  </div>
                ) : (
                  <p className="mt-6 text-sm text-muted-foreground">Tap the card to reveal</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t p-4 sm:p-5">
              {revealed ? (
                <>
                  <Button variant="outline" onClick={() => void rate('again')}><RotateCcw className="h-4 w-4" /> Again</Button>
                  <Button variant="outline" onClick={() => void rate('hard')}>Hard</Button>
                  <Button onClick={() => void rate('good')}><Check className="h-4 w-4" /> Good</Button>
                </>
              ) : (
                <Button className="col-span-3" onClick={() => setRevealed(true)}>Show answer</Button>
              )}
            </div>
            {saveError ? <p className="border-t p-4 text-sm text-destructive" role="alert">{saveError}</p> : null}
          </CardContent></Card>
        </section>

        <aside className="space-y-4 lg:col-span-5">
          <Card><CardContent className="p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="data-label">Due now</p>
                <p className="mt-1 font-display text-2xl font-semibold">{dueCount} {dueCount === 1 ? 'card' : 'cards'}</p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent"><Languages className="h-5 w-5" aria-hidden="true" /></span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-secondary p-3">
                <p className="font-display text-xl font-semibold">{masteredCount}</p>
                <p className="text-xs text-muted-foreground">mastered</p>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <p className="font-display text-xl font-semibold">{progress?.repetitions ?? 0}</p>
                <p className="text-xs text-muted-foreground">reviews of this card</p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              {intervalText
                ? `${intervalText} for this card${progress?.lapses ? ` · ${progress.lapses} ${progress.lapses === 1 ? 'lapse' : 'lapses'}` : ''}.`
                : 'This card has not been reviewed yet, so no interval is scheduled.'}
            </p>
          </CardContent></Card>

          <Card><CardContent className="p-5">
            <p className="data-label">Word bank</p>
            <div className="relative mt-3">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input className="pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search words" aria-label="Search words" />
            </div>
            <div className="scrollbar-none mt-3 max-h-72 space-y-1 overflow-y-auto">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setCardIndex(cards.indexOf(item)); setRevealed(true); }}
                  className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary"
                >
                  <Volume2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.english}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.russian}</span>
                  </span>
                  {progressByVocabularyId[item.id]?.mastered ? <Check className="h-4 w-4 text-success" aria-label="mastered" /> : null}
                </button>
              ))}
            </div>
          </CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
