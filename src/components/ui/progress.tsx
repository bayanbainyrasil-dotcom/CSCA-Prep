import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn, clamp } from '@/lib/utils';

/**
 * `label` is required. A progressbar with no accessible name is announced as
 * bare percentage with nothing to attach it to, so the type refuses to compile
 * a usage that omits one rather than leaving it to a review to catch.
 */
export function Progress({ value = 0, className, indicatorClassName, label }: { value?: number; className?: string; indicatorClassName?: string; label: string }) {
  const safeValue = clamp(value);
  return (
    <ProgressPrimitive.Root
      className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
      value={safeValue}
      aria-label={label}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full bg-primary transition-transform duration-500', indicatorClassName)}
        style={{ transform: `translateX(-${100 - safeValue}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
