import type { ReactNode } from 'react';
import { CornerDownRight, Layers } from 'lucide-react';

import { StatusBadge } from './Badges';
import { JIRA_BASE_URL } from '../types';
import type { JiraIssueShort } from '../types';
import { isSubtaskType } from '../lib/issueTypes';
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

function HierarchyIssueCell({ issueKey, className }: { issueKey: string; className?: string }) {
  return (
    <div className={cn('whitespace-nowrap pl-2', className)}>
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

export function ParentIssueCell({ parentKey }: { parentKey?: string | null }) {
  return parentKey ? <HierarchyIssueCell issueKey={parentKey} /> : <span className="text-base text-gray-300">—</span>;
}

export function EpicIssueCell({ epicKey }: { epicKey?: string | null }) {
  return epicKey ? <HierarchyIssueCell issueKey={epicKey} /> : <span className="text-base text-gray-300">—</span>;
}

function ContextIssueLink({
  issueKey,
  label,
  icon,
}: {
  issueKey: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={`${JIRA_BASE_URL}/${issueKey}`}
      target="_blank"
      rel="noopener noreferrer"
      title={`${label} ${issueKey}`}
      aria-label={`${label} ${issueKey}`}
      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 underline-offset-2 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:underline"
    >
      {icon}
      <span>{issueKey}</span>
    </a>
  );
}

export function IssueContextCell({ issue }: { issue: JiraIssueShort }) {
  const epicKey = issue.epic_key ?? issue.epic?.key ?? null;
  const parentKey = issue.parent_key ?? issue.parent?.key ?? null;
  const isSubtask = isSubtaskType(issue.issuetype);

  if (!epicKey && !parentKey && !isSubtask) {
    return <span className="text-base text-gray-300">—</span>;
  }

  return (
    <div className="flex min-w-[132px] flex-wrap items-center gap-1.5">
      {epicKey ? (
        <ContextIssueLink
          issueKey={epicKey}
          label="Эпик"
          icon={<Layers size={12} aria-hidden="true" />}
        />
      ) : null}
      {parentKey ? (
        <ContextIssueLink
          issueKey={parentKey}
          label="Родитель"
          icon={<CornerDownRight size={12} aria-hidden="true" />}
        />
      ) : null}
      {isSubtask ? (
        <Badge
          variant="outline"
          title="Подзадача"
          aria-label="Подзадача"
          className="size-6 justify-center rounded-md px-0 text-slate-500"
        >
          <CornerDownRight size={12} aria-hidden="true" />
        </Badge>
      ) : null}
    </div>
  );
}

export function SummaryCell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'line-clamp-2 block min-w-[240px] max-w-[34rem] break-words text-[13px] font-medium leading-5 text-slate-900 transition-colors group-hover:text-slate-950',
        className,
      )}
    >
      {children}
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
