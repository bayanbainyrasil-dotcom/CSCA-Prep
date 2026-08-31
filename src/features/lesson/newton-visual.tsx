import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';

export function NewtonVisual() {
  const [force, setForce] = useState(12);
  const [mass, setMass] = useState(3);
  const acceleration = useMemo(() => force / mass, [force, mass]);
  const distance = Math.min(62, 18 + acceleration * 6);

  return (
    <div className="rounded-xl border bg-foreground p-5 text-background sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><p className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-background/50">Interactive model</p><h3 className="mt-1 font-display text-xl font-semibold">Same force, different mass</h3></div><span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">a = {acceleration.toFixed(1)} m/s²</span></div>
      <div className="relative mt-7 h-28 overflow-hidden rounded-2xl bg-white/[0.06]">
        <div className="absolute inset-x-0 bottom-5 h-px bg-white/15" />
        <div className="absolute bottom-6 transition-[left] duration-500" style={{ left: `${distance}%` }}>
          <div className="relative h-12 w-16 rounded-lg border border-white/25 bg-[#7e8cff] shadow-lg"><span className="absolute inset-0 grid place-items-center font-mono text-xs font-bold text-white">{mass} kg</span><ArrowRight className="absolute -right-12 top-3 h-5 w-9 text-amber-300" style={{ strokeWidth: Math.min(4, 1.5 + force / 12) }} /></div>
        </div>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-xs font-semibold">Force <span className="float-right font-mono text-background/60">{force} N</span><input className="mt-2 w-full accent-[#7e8cff]" type="range" min="3" max="24" step="3" value={force} onChange={(event) => setForce(Number(event.target.value))} /></label>
        <label className="text-xs font-semibold">Mass <span className="float-right font-mono text-background/60">{mass} kg</span><input className="mt-2 w-full accent-amber-300" type="range" min="1" max="8" value={mass} onChange={(event) => setMass(Number(event.target.value))} /></label>
      </div>
    </div>
  );
}
