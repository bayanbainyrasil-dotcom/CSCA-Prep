import { useEffect, useState } from 'react';
import { CalendarClock, MapPin } from 'lucide-react';
import { localDateTimeLabels } from '@/lib/date';
import { cn } from '@/lib/utils';

export function LocalTimeStatus({ timezone, compact = false, className }: { timezone: string; compact?: boolean; className?: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const labels = localDateTimeLabels(now, timezone);
  if (compact) {
    return <span data-testid="device-local-time" className={cn('inline-flex min-h-8 items-center gap-2 rounded-2xl border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground', className)} aria-label={`Device date and time: ${labels.date}, ${labels.time}, ${labels.zone}`}><CalendarClock className="h-3.5 w-3.5 shrink-0" /><span className="leading-tight"><span className="block">{labels.date} · {labels.time}</span><span className="mt-0.5 block text-[0.65rem] font-medium">{labels.zone}</span></span></span>;
  }

  return <div data-testid="device-local-time" className={cn('rounded-2xl border bg-background/55 p-4', className)} aria-label={`Device date and time: ${labels.date}, ${labels.time}, ${labels.zone}`}>
    <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></span><div><p className="font-display text-lg font-semibold">{labels.date} · {labels.time}</p><p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3.5 w-3.5" />{labels.zone}</p></div></div>
  </div>;
}
