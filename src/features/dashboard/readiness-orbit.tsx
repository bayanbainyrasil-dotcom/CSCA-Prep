import { clamp } from '@/lib/utils';

export function ReadinessOrbit({ score }: { score: number }) {
  const value = clamp(score);
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[215px]" aria-label={`Internal CSCA readiness score ${value} percent`}>
      <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-secondary" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke="url(#readinessGradient)"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
        <defs>
          <linearGradient id="readinessGradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#6875f5" />
            <stop offset="1" stopColor="#2fb9aa" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-5xl font-semibold tracking-[-0.07em]">{value}</p>
          <p className="mt-1 text-xs font-bold text-muted-foreground">of 100</p>
        </div>
      </div>
    </div>
  );
}
