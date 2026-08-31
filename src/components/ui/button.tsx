import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'tap-target inline-flex shrink-0 items-center justify-center gap-2 rounded-[0.9rem] px-4 text-sm font-semibold transition-[transform,background-color,color,box-shadow] duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/75',
        outline: 'border bg-card/60 text-foreground hover:bg-secondary/60',
        ghost: 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        default: 'h-11',
        sm: 'h-9 min-h-9 rounded-xl px-3 text-xs',
        lg: 'h-13 min-h-[52px] rounded-2xl px-6 text-base',
        icon: 'h-11 w-11 px-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Component = asChild ? Slot : 'button';
    return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = 'Button';

export { buttonVariants };
