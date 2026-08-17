import * as React from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'outline';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const styles: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600 active:scale-95',
  ghost: 'text-ink hover:text-brand',
  outline: 'border border-line bg-white text-ink hover:border-brand hover:text-brand',
};

/** Min-height honours the 48px tap target (SKILL.md invariant #10). */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex min-h-tap items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition disabled:opacity-50',
        styles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
