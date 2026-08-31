import { useState } from 'react';

export function QuadraticVisual() {
  const [a, setA] = useState(1);
  const points = Array.from({ length: 41 }, (_, index) => {
    const x = -5 + index * 0.25;
    const y = a * x * x;
    return `${50 + x * 9},${78 - Math.min(65, y * 2.4)}`;
  }).join(' ');
  return (
    <div className="rounded-xl border bg-foreground p-5 text-background sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-background/50">Interactive graph</p><h3 className="mt-1 font-display text-xl font-semibold">The coefficient controls the opening</h3></div><span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">y = {a}x²</span></div>
      <svg viewBox="0 0 100 90" className="mt-5 h-44 w-full rounded-2xl bg-white/[0.05]" aria-label={`Graph of y equals ${a} x squared`}>
        <path d="M4 78H96M50 6V84" stroke="rgba(255,255,255,.18)" strokeWidth=".6" />
        <polyline points={points} fill="none" stroke="#7e8cff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <label className="mt-4 block text-xs font-semibold">Coefficient a <span className="float-right font-mono text-background/60">{a}</span><input className="mt-2 w-full accent-[#7e8cff]" type="range" min="-2" max="2" step="0.25" value={a} onChange={(event) => setA(Number(event.target.value) || 0.25)} /></label>
    </div>
  );
}
