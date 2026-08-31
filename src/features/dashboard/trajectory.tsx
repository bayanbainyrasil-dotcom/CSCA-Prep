import { Check, LockKeyhole } from 'lucide-react';

const points = [
  { day: 1, x: 28, y: 102, label: 'Baseline', state: 'done' },
  { day: 18, x: 128, y: 76, label: 'Today', state: 'active' },
  { day: 28, x: 230, y: 82, label: 'Foundation', state: 'next' },
  { day: 56, x: 348, y: 38, label: 'Exam speed', state: 'locked' },
  { day: 84, x: 474, y: 20, label: 'Ready', state: 'locked' },
] as const;

export function Trajectory() {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-foreground px-5 py-5 text-background shadow-soft sm:px-7 sm:py-6">
      <div className="relative z-10 mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[0.65rem] font-medium uppercase tracking-[0.16em] text-background/55">84-day trajectory</p>
          <h2 className="mt-1.5 font-display text-xl font-semibold tracking-tight">Foundation → exam fluency</h2>
        </div>
        <span className="rounded-full border border-background/15 px-2.5 py-1 font-mono text-[0.68rem] text-background/70">DAY 18</span>
      </div>
      <div className="scrollbar-none overflow-x-auto">
        <div className="relative h-[138px] min-w-[520px]">
          <svg viewBox="0 0 510 125" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden="true">
            <path d="M28 102 C85 96 82 70 128 76 S182 96 230 82 S300 70 348 38 S430 42 474 20" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="2" />
            <path
              d="M28 102 C85 96 82 70 128 76"
              fill="none"
              stroke="#7e8cff"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {points.map((point) => (
            <div key={point.day} className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${(point.x / 510) * 100}%`, top: `${(point.y / 125) * 72 + 10}%` }}>
              <span className={`mx-auto grid h-7 w-7 place-items-center rounded-full border ${point.state === 'active' ? 'border-[#7e8cff] bg-[#7e8cff] text-white shadow-[0_0_0_7px_rgba(126,140,255,.15)]' : point.state === 'done' ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/20 bg-slate-900 text-white/45'}`}>
                {point.state === 'done' ? <Check className="h-3.5 w-3.5" /> : point.state === 'locked' ? <LockKeyhole className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
              </span>
              <p className="mt-2 whitespace-nowrap text-[0.69rem] font-bold text-background/80">{point.label}</p>
              <p className="font-mono text-[0.6rem] text-background/40">D{point.day}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
