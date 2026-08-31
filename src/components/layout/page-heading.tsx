import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PageHeading({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow ? <p className="data-label mb-2">{eyebrow}</p> : null}
        <h1 className="font-display text-[clamp(1.85rem,4vw,3.05rem)] font-semibold leading-[1.04] tracking-[-0.05em]">{title}</h1>
        {description ? <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
