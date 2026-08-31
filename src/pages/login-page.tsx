import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/auth-provider';

export default function LoginPage() {
  const { user, loading, isDemo, signIn } = useAuth();
  const [pending, setPending] = useState(false);
  if (loading) return <div className="grid min-h-dvh place-items-center bg-background"><span className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" /></div>;
  if (user) return <Navigate to={user.onboardingCompleted ? '/' : '/onboarding'} replace />;
  const login = async () => {
    setPending(true);
    try { await signIn(); } finally { setPending(false); }
  };
  return <div className="min-h-dvh bg-background p-4 sm:p-6"><div className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden rounded-[2rem] border bg-card shadow-float lg:grid-cols-[1.08fr_.92fr]">
    <section className="relative overflow-hidden bg-foreground p-7 text-background sm:p-10 lg:p-14"><div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 20% 10%, #6875f5 0, transparent 28%), radial-gradient(circle at 90% 85%, #2fb9aa 0, transparent 25%)' }} /><div className="relative flex h-full flex-col"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-950"><Zap className="h-4 w-4" /></span><span className="font-display text-lg font-semibold">CSCA Prep</span></div><div className="my-auto py-16"><p className="font-mono text-xs uppercase tracking-[0.16em] text-background/55">Master Math. Master Physics. Master CSCA.</p><h1 className="mt-5 max-w-xl font-display text-[clamp(2.6rem,6vw,5.7rem)] font-semibold leading-[.95] tracking-[-0.07em]">Know the next move.</h1><p className="mt-6 max-w-lg text-base leading-relaxed text-background/65">A personal 84-day system that turns English exam language into a clear model, a correct method and a fast check.</p></div><div className="grid gap-2 sm:grid-cols-3">{['Offline-first progress', 'Adaptive daily plan', 'Strict mock recovery'].map((item) => <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.05] p-3 text-xs font-semibold text-background/75"><Check className="mb-2 h-4 w-4 text-emerald-300" />{item}</div>)}</div></div></section>
    <section className="grid place-items-center p-7 sm:p-12"><div className="w-full max-w-sm"><Badge variant={isDemo ? 'outline' : 'success'}>{isDemo ? 'On-device storage' : 'Firebase secured'}</Badge><h2 className="mt-5 font-display text-3xl font-semibold tracking-[-0.05em]">Continue your preparation</h2><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{isDemo ? 'Your lessons and progress stay in this browser on this device.' : 'Sign in once to synchronize lessons, attempts and mock exams across your devices.'}</p><Button size="lg" className="mt-8 w-full justify-between" onClick={() => void login()} disabled={pending}><span className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-blue-600">{isDemo ? <Sparkles className="h-3.5 w-3.5" /> : 'G'}</span>{pending ? 'Connecting…' : isDemo ? 'Continue on this device' : 'Continue with Google'}</span><ArrowRight className="h-4 w-4" /></Button><div className="mt-6 flex gap-3 rounded-2xl bg-secondary/60 p-4"><ShieldCheck className="h-5 w-5 shrink-0 text-success" /><p className="text-xs leading-relaxed text-muted-foreground">{isDemo ? 'Progress is stored locally. Cloud synchronization requires a configured Firebase account.' : 'Firebase handles authentication. CSCA Prep never stores your Google password, and admin access is enforced server-side.'}</p></div><div className="mt-7 flex items-center justify-center gap-2 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5" />Built-in questions are original and not official CSCA material.</div></div></section>
  </div></div>;
}
