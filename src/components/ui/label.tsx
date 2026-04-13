import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground', className)} {...props} />;
}

export { Label };
