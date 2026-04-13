import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function PageShell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.06),_transparent_42%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-3 md:px-6 md:py-4', className)}>{children}</div>;
}

export function PageContainer({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('mx-auto flex w-full max-w-[1680px] flex-col gap-3', className)}>{children}</div>;
}

export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-background/90 px-5 py-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</div> : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('rounded-2xl', className)}>
      {(title || action) && (
        <CardHeader className="flex-row items-start justify-between gap-4 border-b border-border/80 py-3">
          <div className="space-y-1">
            {title ? <CardTitle>{title}</CardTitle> : null}
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      )}
      <CardContent className={cn(title || action ? 'pt-3' : 'pt-4', 'pb-4')}>{children}</CardContent>
    </Card>
  );
}

export function MetricPanel({
  title,
  tooltip,
  children,
  className,
}: {
  title: string;
  tooltip?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('rounded-xl border-border/80 shadow-sm', className)}>
      <CardHeader className="space-y-0 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
          <span>{title}</span>
          {tooltip ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground">
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{tooltip}</TooltipContent>
            </Tooltip>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

export function StatusHint({ tone = 'neutral', children }: { tone?: 'neutral' | 'info' | 'error'; children: ReactNode }) {
  const variant = tone === 'error' ? 'destructive' : tone === 'info' ? 'default' : 'outline';
  return <Badge variant={variant}>{children}</Badge>;
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <div className="text-base font-medium text-foreground">{title}</div>
      <div className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
