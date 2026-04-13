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
    <section className={cn('rounded-lg border border-border bg-card p-4 shadow-sm', className)}>
      <div className={cn(description ? 'mb-3' : 'mb-2')}>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {children}
    </section>
  );
}
