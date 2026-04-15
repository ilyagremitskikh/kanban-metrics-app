import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type IssueFormLayoutMode = 'sheet' | 'page';

export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('border-t border-border/70 pt-5 first:border-t-0 first:pt-0', className)}>
      <div className={cn(description ? 'mb-3' : 'mb-2')}>
        <div className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {children}
    </section>
  );
}
