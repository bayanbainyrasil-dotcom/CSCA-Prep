import { useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, Clock3, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeading } from '@/components/layout/page-heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { roadmapWeeks } from '@/data/curriculum';
import { cn } from '@/lib/utils';
import { useAuth } from '@/features/auth/auth-provider';
import { useAppStore } from '@/stores';

type DayState = 'completed' | 'active' | 'upcoming' | 'overdue';

export default function RoadmapPage() {
  const { isDemo } = useAuth();
  const completedDays = useAppStore((state) => state.metrics.completedDays);
  const currentDay = isDemo ? 18 : Math.max(1, Math.min(84, completedDays + 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [intensity, setIntensity] = useState<'steady' | 'lighter' | 'intensive'>('steady');
  const days = useMemo(() => Array.from({ length: 84 }, (_, index) => index + 1), []);
  const stateFor = (day: number): DayState => day < currentDay ? (isDemo && day === 15 ? 'overdue' : day <= completedDays || isDemo ? 'completed' : 'overdue') : day === currentDay ? 'active' : 'upcoming';

  return (
    <div>
      <PageHeading
        eyebrow="Adaptive preparation plan"
        title="84 days, always one clear next step."
        description="The sequence stays stable; the workload adapts when mastery, missed days or exam speed change."
        actions={<Button variant="outline" onClick={() => setIntensity(intensity === 'steady' ? 'lighter' : intensity === 'lighter' ? 'intensive' : 'steady')}><SlidersHorizontal className="h-4 w-4" /> {intensity[0]!.toUpperCase() + intensity.slice(1)}</Button>}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[[`${isDemo ? 17 : completedDays} days`, 'Completed', 'text-success'], ['Today', `Day ${currentDay}`, 'text-primary'], [`${84 - currentDay} days`, 'Remaining', 'text-muted-foreground']].map(([value, label, color]) => (
          <Card key={label}><CardContent className="p-4 sm:p-5"><p className={`font-display text-2xl font-semibold tracking-tight ${color}`}>{value}</p><p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p></CardContent></Card>
        ))}
      </div>

      <div className="space-y-4">
        {roadmapWeeks.map((week) => {
          const weekDays = days.slice((week.week - 1) * 7, week.week * 7);
          const current = weekDays.includes(currentDay);
          return (
            <Card key={week.week} className={current ? 'border-primary/40 shadow-[0_0_0_1px_hsl(var(--primary)/.08)]' : ''}>
              <CardContent className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[220px_1fr] lg:items-center">
                <div>
                  <div className="flex items-center gap-2"><span className="data-label">Week {week.week}</span>{current ? <Badge>Current</Badge> : week.week < 3 ? <Badge variant="success">Complete</Badge> : null}</div>
                  <h2 className="mt-2 font-display text-lg font-semibold tracking-tight">{week.focus}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Math: {week.math}<br />Physics: {week.physics}</p>
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {weekDays.map((day) => {
                    const state = stateFor(day);
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        aria-label={`Day ${day}, ${state}`}
                        className={cn(
                          'aspect-square min-h-10 rounded-xl border text-xs font-bold transition-transform hover:-translate-y-0.5',
                          state === 'completed' && 'border-success/15 bg-success/10 text-success',
                          state === 'active' && 'border-primary bg-primary text-primary-foreground shadow-md',
                          state === 'overdue' && 'border-physics/35 bg-physics/10 text-amber-700 dark:text-physics',
                          state === 'upcoming' && 'bg-background text-muted-foreground',
                        )}
                      >
                        {state === 'completed' ? <Check className="mx-auto h-3.5 w-3.5" /> : day}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={selectedDay !== null} onOpenChange={(open) => { if (!open) setSelectedDay(null); }}>
        <DialogContent title={`Day ${selectedDay ?? ''}`} description={selectedDay === currentDay ? 'Today’s adaptive session' : 'Planned learning sequence'}>
          <div className="space-y-2">
            {[
              ['Mental math', 'Powers and roots', '5 min'],
              ['Mathematics', 'Quadratic functions', '20 min'],
              ['Physics', 'Newton’s laws', '25 min'],
              ['English', 'Force and motion terms', '10 min'],
              ['Review', 'Spaced repetition', '8 questions'],
            ].map(([area, title, duration]) => (
              <div key={area} className="flex items-center gap-3 rounded-xl border p-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary"><CalendarDays className="h-3.5 w-3.5" /></span><div className="min-w-0 flex-1"><p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">{area}</p><p className="truncate text-sm font-semibold">{title}</p></div><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" />{duration}</span></div>
            ))}
          </div>
          <div className="mt-5 flex gap-2"><Button className="flex-1" asChild><Link to="/today">Start this day <ChevronRight className="h-4 w-4" /></Link></Button><Button variant="outline" size="icon" aria-label="Recalculate this day" onClick={() => setIntensity((value) => value === 'steady' ? 'lighter' : value === 'lighter' ? 'intensive' : 'steady')}><RotateCcw className="h-4 w-4" /></Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
