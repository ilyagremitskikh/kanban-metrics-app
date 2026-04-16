import * as React from 'react';

import { cn } from '@/lib/utils';

type InputVariant = 'default' | 'ghost';

interface InputProps extends React.ComponentProps<'input'> {
  variant?: InputVariant;
}

const inputVariants: Record<InputVariant, string> = {
  default: 'border-input bg-muted/35 shadow-xs focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/20',
  ghost: 'border-transparent bg-transparent shadow-none hover:border-border hover:bg-muted/35 focus-visible:border-ring focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring/20',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, variant = 'default', ...props }, ref) => {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border px-3 py-2 text-sm text-foreground transition-[color,box-shadow,background-color,border-color] outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
        inputVariants[variant],
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
