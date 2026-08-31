import { useMemo, useState } from 'react';
import { Check, Languages, RotateCcw, Search, Shuffle, Volume2 } from 'lucide-react';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/field';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';

type VocabCard = readonly [string, string, string, string, string];

const demoWords: VocabCard[] = [
  ['determine','определить / найти','Find the requested value from the given information.','Determine the acceleration of the object.','Commands'],
  ['given','дано','Information supplied in the question.','Given that x > 0, simplify the expression.','Commands'],
  ['respectively','соответственно','Match items in the same stated order.','The masses are 2 kg and 3 kg, respectively.','Comparison'],
  ['at rest','в состоянии покоя','Velocity equals zero at that moment.','The car starts from rest.','Physics'],
  ['magnitude','величина / модуль','Size without direction.','Find the magnitude of the resultant force.','Physics'],
  ['displacement','перемещение','Change in position with direction.','Calculate the total displacement.','Physics'],
  ['slope','наклон','Rate of vertical change per horizontal change.','Determine the slope of the graph.','Graphs'],
  ['domain','область определения','All allowed input values of a function.','State the domain of the function.','Math'],
  ['range','область значений','All possible output values of a function.','Find the range shown on the graph.','Math'],
  ['approximately','приблизительно','A value close to, but not exactly equal to, another.','The answer is approximately 3.14.','Comparison'],
];

type Direction = 'en-ru' | 'ru-en' | 'meaning-word';

export default function VocabularyPage() {
  const { isDemo } = useAuth();
  const publishedVocabulary = useAppStore((state) => state.vocabulary);
  const words = useMemo<VocabCard[]>(() => isDemo ? demoWords : publishedVocabulary
    .filter((entry) => entry.status === 'published' && !entry.demo)
    .map((entry) => [entry.english, entry.russian, entry.simpleExplanation.en, entry.exampleSentence, entry.category] as const), [isDemo, publishedVocabulary]);
  const [query,setQuery]=useState('');
  const [cardIndex,setCardIndex]=useState(0);
  const [revealed,setRevealed]=useState(false);
  const [direction,setDirection]=useState<Direction>('en-ru');
  const [mastered,setMastered]=useState<string[]>([]);
  const filtered=useMemo(()=>words.filter((word)=>word.join(' ').toLowerCase().includes(query.toLowerCase())),[query, words]);
  const card=words.length ? words[cardIndex % words.length]! : null;
  const prompt=card ? direction==='en-ru'?card[0]:direction==='ru-en'?card[1]:card[2] : '';
  const answer=card ? direction==='en-ru'?card[1]:card[0] : '';
  const rate=(quality:'again'|'hard'|'good')=>{if(!card)return;if(quality==='good')setMastered((current)=>current.includes(card[0])?current:[...current,card[0]]);setCardIndex((value)=>(value+1)%words.length);setRevealed(false);};
  if (!card) return <div><PageHeading eyebrow="English for CSCA" title="Recognize the instruction before the maths." description="Smart cards alternate word, meaning and sentence contexts with adaptive review." actions={<Badge variant="outline">Published content</Badge>} /><Card><CardContent className="p-10 text-center"><Languages className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-4 font-display text-2xl font-semibold">No vocabulary is published yet</h2><p className="mt-2 text-sm text-muted-foreground">An administrator can add verified Mathematics, Physics and command-language entries.</p></CardContent></Card></div>;
  return <div><PageHeading eyebrow="English for CSCA" title="Recognize the instruction before the maths." description="Smart cards alternate word, meaning and sentence contexts with adaptive review." actions={<Badge variant={isDemo?'warning':'success'}>{isDemo?'Demo vocabulary':'Published vocabulary'}</Badge>} />
    <div className="content-grid"><section className="lg:col-span-7"><Card className="overflow-hidden"><CardContent className="p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 sm:p-5"><div className="flex gap-2">{([['en-ru','EN → RU'],['ru-en','RU → EN'],['meaning-word','Meaning → word']] as const).map(([value,label])=><button key={value} onClick={()=>{setDirection(value);setRevealed(false);}} className={`rounded-full px-3 py-2 text-xs font-bold ${direction===value?'bg-foreground text-background':'bg-secondary text-muted-foreground'}`}>{label}</button>)}</div><Button variant="ghost" size="icon" onClick={()=>setCardIndex(Math.floor(Math.random()*words.length))} aria-label="Shuffle cards"><Shuffle className="h-4 w-4" /></Button></div><div className="grid min-h-[360px] place-items-center p-6 text-center sm:p-10"><div><p className="data-label">Card {cardIndex+1} · {card[4]}</p><button onClick={()=>setRevealed(true)} className="mt-6 block max-w-xl font-display text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">{prompt}</button>{revealed?<div className="mt-8"><p className="font-display text-2xl font-semibold text-primary">{answer}</p><p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{card[2]}</p><p className="mt-4 rounded-xl bg-secondary p-4 text-sm italic">“{card[3]}”</p></div>:<p className="mt-6 text-sm text-muted-foreground">Tap the card to reveal</p>}</div></div><div className="grid grid-cols-3 gap-2 border-t p-4 sm:p-5">{revealed?<><Button variant="outline" onClick={()=>rate('again')}><RotateCcw className="h-4 w-4" /> Again</Button><Button variant="outline" onClick={()=>rate('hard')}>Hard</Button><Button onClick={()=>rate('good')}><Check className="h-4 w-4" /> Good</Button></>:<Button className="col-span-3" onClick={()=>setRevealed(true)}>Show answer</Button>}</div></CardContent></Card></section>
      <aside className="space-y-4 lg:col-span-5"><Card><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="data-label">Review queue</p><p className="mt-1 font-display text-2xl font-semibold">{words.length-mastered.length} cards</p></div><span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/10 text-accent"><Languages className="h-5 w-5" /></span></div><div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-xl bg-secondary p-3"><p className="font-display text-xl font-semibold">{mastered.length}</p><p className="text-xs text-muted-foreground">mastered</p></div><div className="rounded-xl bg-secondary p-3"><p className="font-display text-xl font-semibold">{isDemo?'3 days':'Adaptive'}</p><p className="text-xs text-muted-foreground">next interval</p></div></div></CardContent></Card><Card><CardContent className="p-5"><p className="data-label">Word bank</p><div className="relative mt-3"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-10" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search words" /></div><div className="scrollbar-none mt-3 max-h-72 space-y-1 overflow-y-auto">{filtered.map((word)=><button key={word[0]} onClick={()=>{setCardIndex(words.indexOf(word));setRevealed(true);}} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-secondary"><Volume2 className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{word[0]}</span><span className="block truncate text-xs text-muted-foreground">{word[1]}</span></span>{mastered.includes(word[0])?<Check className="h-4 w-4 text-success" />:null}</button>)}</div></CardContent></Card></aside></div></div>;
}
