import { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, FlaskConical, Languages, Sigma, Sparkles } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useAuth, type OnboardingInput } from '@/features/auth/auth-provider';
import { dateKeyInTimezone } from '@/lib/date';

const steps = [
  { title: 'When is your CSCA?', description: 'Use the date shown on your exam registration. The roadmap will pace new learning and mock exams.', icon: CalendarDays },
  { title: 'Where is your maths today?', description: 'Choose the closest honest starting point.', icon: Sigma },
  { title: 'How much physics have you studied?', description: 'Starting from zero is expected and supported.', icon: FlaskConical },
  { title: 'How should explanations work?', description: 'Exam questions stay English; support can be bilingual.', icon: Languages },
  { title: 'How much time can you protect?', description: 'The daily plan adapts to the time you actually have.', icon: Clock3 },
] as const;

export default function OnboardingPage() {
  const { user, completeOnboarding } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetDateRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<OnboardingInput>({
    targetDate: '',
    mathLevel: 'foundation',
    physicsLevel: 'new',
    preferredLanguage: 'bilingual',
    dailyAvailableMinutes: 90,
  });
  if (!user) return <Navigate to="/login" replace />;

  const today = dateKeyInTimezone(new Date(), user.timezone);
  const hasValidTargetDate = /^\d{4}-\d{2}-\d{2}$/.test(data.targetDate) && data.targetDate >= today;
  const finish = async () => {
    setPending(true);
    setError(null);
    try {
      await completeOnboarding(data);
      void navigate('/diagnostic');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your setup could not be saved. Please try again.');
    } finally {
      setPending(false);
    }
  };
  const next = () => {
    if (step === 0 && !hasValidTargetDate) {
      setError('Choose today or a future date from your exam registration.');
      // Announcing the problem is not enough: keyboard and screen-reader users
      // need to be put back on the control that has to change.
      targetDateRef.current?.focus();
      return;
    }
    setError(null);
    if (step < 4) setStep((value) => value + 1);
    else void finish();
  };
  const CurrentIcon = steps[step]!.icon;


  return <main className="min-h-dvh bg-background p-4 sm:grid sm:place-items-center sm:p-6">
    <div className="w-full max-w-2xl rounded-[2rem] border bg-card p-6 shadow-float sm:p-10">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-background"><Sparkles className="h-4 w-4" /></span><span className="font-display font-semibold">CSCA Prep</span></div><span className="data-label">Step {step + 1} / 5</span></div>
      <Progress className="mt-6" value={((step + 1) / 5) * 100} label={`Setup step ${step + 1} of 5`} />
      <div className="py-10 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><CurrentIcon className="h-5 w-5" /></span>
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-[-0.05em]">{steps[step]!.title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{steps[step]!.description}</p>
        <div className="mx-auto mt-8 max-w-lg">
          {step === 0 ? <div><input ref={targetDateRef} aria-label="Target CSCA date" aria-describedby="target-date-help" aria-invalid={error !== null} type="date" min={today} value={data.targetDate} onChange={(event) => { setData({ ...data, targetDate: event.target.value }); setError(null); }} className="tap-target w-full rounded-xl border bg-card px-4 text-sm" /><p id="target-date-help" className="mt-3 text-xs text-muted-foreground">No date is guessed for you. You can change it later in Settings.</p></div> : null}
          {step === 1 ? <ChoiceGrid value={data.mathLevel} choices={[['foundation', '8–9 class, much forgotten'], ['basic', 'Basic algebra is familiar'], ['intermediate', 'Ready for mixed problems']]} onChange={(value) => setData({ ...data, mathLevel: value as OnboardingInput['mathLevel'] })} /> : null}
          {step === 2 ? <ChoiceGrid value={data.physicsLevel} choices={[['new', 'Almost from zero'], ['foundation', 'Units and simple motion'], ['basic', 'Mechanics basics'], ['intermediate', 'Ready for mixed physics']]} onChange={(value) => setData({ ...data, physicsLevel: value as OnboardingInput['physicsLevel'] })} /> : null}
          {step === 3 ? <ChoiceGrid value={data.preferredLanguage} choices={[['bilingual', 'English + Russian support'], ['en', 'English explanations'], ['ru', 'Russian explanations']]} onChange={(value) => setData({ ...data, preferredLanguage: value as OnboardingInput['preferredLanguage'] })} /> : null}
          {step === 4 ? <ChoiceGrid value={String(data.dailyAvailableMinutes)} choices={[['45', '45 minutes'], ['60', '60 minutes'], ['90', '90 minutes'], ['120', '2 hours'], ['180', '3 hours']]} onChange={(value) => setData({ ...data, dailyAvailableMinutes: Number(value) })} /> : null}
          {error ? <p role="alert" className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}
        </div>
      </div>
      <div className="flex items-center justify-between border-t pt-5"><Button variant="ghost" disabled={step === 0 || pending} onClick={() => { setError(null); setStep((value) => value - 1); }}><ArrowLeft className="h-4 w-4" />Back</Button><Button onClick={next} disabled={pending}>{step === 4 ? (pending ? 'Saving…' : 'Take diagnostic test') : 'Continue'}{step === 4 ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}</Button></div>
    </div>
  </main>;
}

function ChoiceGrid({ value, choices, onChange }: { value: string; choices: readonly (readonly [string, string])[]; onChange: (value: string) => void }) {
  return <div className="grid gap-2">{choices.map(([option, label]) => <button key={option} onClick={() => onChange(option)} className={`flex min-h-14 items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold ${value === option ? 'border-primary bg-primary/[0.05] text-primary' : 'hover:bg-secondary'}`}>{label}{value === option ? <Check className="h-4 w-4" /> : null}</button>)}</div>;
}
