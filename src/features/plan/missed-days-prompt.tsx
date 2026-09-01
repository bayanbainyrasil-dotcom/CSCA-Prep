import { useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/stores';
import type { MissedDayPolicy } from '@/domain';
import { usePlanStatus } from './use-plan-status';

const CHOICES: { policy: MissedDayPolicy; label: string; description: string }[] = [
  {
    policy: 'shift',
    label: 'Move the plan forward',
    description: 'Pick up where you left off. The whole schedule shifts, so the plan finishes later.',
  },
  {
    policy: 'redistribute',
    label: 'Keep my finish date',
    description: 'Stay on the original dates and spread the missed work across the days that are left. Each day gets heavier.',
  },
  {
    policy: 'calendar',
    label: 'Skip what I missed',
    description: 'Stay on the original dates and let the missed work go. Nothing is added to the days ahead.',
  },
];

/**
 * A missed day never changes the plan on its own. This asks once per gap and
 * records the answer, so the learner always knows why today looks different.
 */
export function MissedDaysPrompt() {
  const plan = usePlanStatus();
  const chooseMissedDayPolicy = useAppStore((state) => state.chooseMissedDayPolicy);
  const [saving, setSaving] = useState<MissedDayPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!plan.hasPlan || !plan.needsMissedDayChoice) return null;

  const missedCount = plan.missedDays.length;

  const choose = async (policy: MissedDayPolicy) => {
    setSaving(policy);
    setError(null);
    try {
      await chooseMissedDayPolicy(policy, plan.todayKey);
    } catch {
      setError('That choice could not be saved. It will still be here when you try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card className="mb-5 border-physics/40 bg-physics/[0.06]">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-physics" aria-hidden="true" />
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight">
              {missedCount === 1 ? 'One study day passed without work' : `${missedCount} study days passed without work`}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Nothing has been changed yet. Choose what should happen to the rest of your plan.
              {plan.calendarDaysUntilExam !== null
                ? ` You have ${plan.calendarDaysUntilExam} calendar ${plan.calendarDaysUntilExam === 1 ? 'day' : 'days'} before the exam and ${plan.remainingPlanDays} plan ${plan.remainingPlanDays === 1 ? 'day' : 'days'} left.`
                : ''}
            </p>
          </div>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {CHOICES.map((choice) => (
            <li key={choice.policy}>
              <Button
                variant="outline"
                className="h-auto w-full flex-col items-start gap-1 whitespace-normal p-4 text-left"
                onClick={() => void choose(choice.policy)}
                disabled={saving !== null}
              >
                <span className="text-sm font-semibold">
                  {saving === choice.policy ? 'Saving…' : choice.label}
                </span>
                <span className="text-xs font-normal leading-relaxed text-muted-foreground">{choice.description}</span>
              </Button>
            </li>
          ))}
        </ul>

        {plan.behindExamDate ? (
          <p className="mt-4 text-xs leading-relaxed text-amber-700 dark:text-physics">
            At the current length the plan no longer finishes before your exam date, whichever option you pick.
            Consider shortening it in Settings as well.
          </p>
        ) : null}

        {error ? (
          <p className="mt-4 text-xs text-destructive" role="alert">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
