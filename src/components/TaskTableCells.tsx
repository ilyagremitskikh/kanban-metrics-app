import type { ReactNode } from 'react';
import { ChevronsDown } from 'lucide-react';

import { StatusBadge } from './Badges';
import { JIRA_BASE_URL, type JiraIssueParent } from '../types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TaskScoreTone = 'primary' | 'muted' | 'warning' | 'orange' | 'danger';

const scoreToneClasses: Record<TaskScoreTone, string> = {
  primary: 'border-blue-200 bg-blue-50 text-blue-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

export function IssueKeyCell({
  issueKey,
  isDirty = false,
  className,
}: {
  issueKey: string;
  isDirty?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('relative whitespace-nowrap pl-2', className)}>
      {isDirty ? (
        <div
          className="absolute left-0 top-1/2 size-2 -translate-y-1/2 rounded-full bg-orange-400 shadow-sm"
          title="Несохраненные изменения"
        />
      ) : null}
      <a
        href={`${JIRA_BASE_URL}/${issueKey}`}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-xs font-bold text-blue-700 underline-offset-2 transition-colors duration-150 hover:text-slate-900 hover:underline"
      >
        {issueKey}
      </a>
    </div>
  );
}

export function SummaryCell({
  children,
  className,
  parent,
}: {
  children: ReactNode;
  className?: string;
  parent?: JiraIssueParent | null;
}) {
  return (
    <span className={cn('block min-w-[240px] max-w-[34rem]', className)}>
      {parent?.key ? (
        <span className="mb-1 inline-flex max-w-full items-center gap-1.5 text-[11px] font-medium leading-4 text-slate-500 transition-colors group-hover:text-slate-700">
          <ChevronsDown size={12} className="shrink-0 text-blue-500" />
          <span className="truncate">
            <span className="font-mono font-semibold text-slate-600">{parent.key}</span>
            {parent.summary ? ` · ${parent.summary}` : ''}
          </span>
        </span>
      ) : null}
      <span
        className={cn(
          'line-clamp-2 block break-words text-[13px] font-medium leading-5 text-slate-900 transition-colors group-hover:text-slate-950',
        )}
      >
        {children}
      </span>
    </span>
  );
}

export function StatusCell({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}

export function TaskScoreBadge({
  value,
  label,
  tone = 'primary',
  className,
}: {
  value: number | string;
  label?: string;
  tone?: TaskScoreTone;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'inline-flex min-w-[48px] justify-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-extrabold',
        scoreToneClasses[tone],
        className,
      )}
    >
      <span>{value}</span>
      {label ? <span className="text-[10px] font-extrabold uppercase opacity-90">{label}</span> : null}
    </Badge>
  );
}

export function TaskScoreLabelBadge({
  children,
  tone = 'primary',
  className,
}: {
  children: ReactNode;
  tone?: TaskScoreTone;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase',
        scoreToneClasses[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}
