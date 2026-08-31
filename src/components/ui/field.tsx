import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn('tap-target w-full rounded-xl border bg-card px-3.5 text-sm placeholder:text-muted-foreground/70 focus:border-primary', className)}
      {...props}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn('w-full resize-y rounded-xl border bg-card px-3.5 py-3 text-sm placeholder:text-muted-foreground/70 focus:border-primary', className)}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('mb-2 block text-sm font-semibold', className)} {...props} />;
}
