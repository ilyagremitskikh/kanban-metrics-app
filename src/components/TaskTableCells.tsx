import type { ReactNode } from 'react';
import { BookOpen, BugPlay, ClipboardList, CornerDownRight, Layers, Layers2, ListChecks, TriangleAlert, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { JIRA_BASE_URL } from '../types';
import type { JiraIssueShort } from '../types';
import { isSubtaskType } from '../lib/issueTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TaskScoreTone = 'primary' | 'muted' | 'warning' | 'orange' | 'danger';
type DotTone = 'green' | 'yellow' | 'red' | 'blue' | 'cyan' | 'violet' | 'orange' | 'grey';

interface IssueTypeIconMeta {
  Icon: LucideIcon;
  tone: DotTone;
  label: string;
}

const scoreToneClasses: Record<TaskScoreTone, string> = {
  primary: 'border-blue-200 bg-blue-50 text-blue-700',
  muted: 'border-slate-200 bg-slate-100 text-slate-600',
  warning: 'border-amber-200 bg-amber-50 text-amber-700',
  orange: 'border-orange-200 bg-orange-50 text-orange-700',
  danger: 'border-red-200 bg-red-50 text-red-700',
};

const dotToneClasses: Record<DotTone, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-sky-400',
  cyan: 'bg-cyan-500',
  violet: 'bg-violet-400',
  orange: 'bg-orange-500',
  grey: 'bg-zinc-400',
};

const issueTypeToneClasses: Record<DotTone, string> = {
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
  blue: 'text-blue-600',
  cyan: 'text-cyan-600',
  violet: 'text-violet-600',
  orange: 'text-orange-600',
  grey: 'text-muted-foreground',
};

function statusTone(status: string): DotTone {
  const normalized = status.trim().toUpperCase();

  if (['ГОТОВО К PROD', 'УСТАНОВЛЕНО', 'ЧАСТИЧНЫЙ РЕЛИЗ', 'РЕЛИЗ', 'РЕВЬЮ', 'ГОТОВО', 'DONE'].includes(normalized)) {
    return 'green';
  }

  if (['РАЗРАБОТКА', 'IN PROGRESS'].includes(normalized)) {
    return 'yellow';
  }

  if (['CODE REVIEW', 'ПРАВКИ', 'ГОТОВО К ТЕСТИРОВАНИЮ', 'ТЕСТИРОВАНИЕ STAGE', 'РЕГРЕСС', 'ТЕСТ ОО', 'ГОТОВО К ПРИЕМКЕ', 'ПРИЕМКА'].includes(normalized)) {
    return 'orange';
  }

  if (['ОТМЕНЕНА', 'CANCELED', 'CANCELLED'].includes(normalized)) {
    return 'red';
  }

  if (['ИДЕЯ', 'ПРОРАБОТКА ИДЕИ', 'ПОДГОТОВКА К ИССЛЕДОВАНИЮ', 'ПРОВЕРКА ГИПОТЕЗЫ', 'РАЗРАБОТКА ПРОТОТИПА', 'ОЦЕНКА РИСКА'].includes(normalized)) {
    return 'violet';
  }

  if (['БЭКЛОГ', 'ГОТОВО К АНАЛИЗУ', 'АНАЛИЗ', 'ОЖИДАЕТ ПЛАНА ПРИЕМКИ', 'ПЛАН ПРИЕМКИ', 'ГОТОВО К РАЗРАБОТКЕ', 'ПОДГОТОВКА ТЕСТ-КЕЙСОВ'].includes(normalized)) {
    return 'blue';
  }

  return 'grey';
}

function issueTypeIconMeta(type: string): IssueTypeIconMeta {
  const normalized = type.trim().toLowerCase();

  if (normalized === 'ошибка' || normalized === 'bug') {
    return { Icon: BugPlay, tone: 'red', label: type || 'Ошибка' };
  }

  if (normalized === 'техдолг' || normalized === 'tech debt') {
    return { Icon: Wrench, tone: 'orange', label: type || 'Техдолг' };
  }

  if (normalized === 'user story') {
    return { Icon: BookOpen, tone: 'green', label: type || 'User Story' };
  }

  if (normalized === 'sub-task' || normalized === 'подзадача' || normalized === 'business sub-task') {
    return { Icon: ListChecks, tone: 'cyan', label: type || 'Подзадача' };
  }

  if (normalized === 'epic') {
    return { Icon: Layers2, tone: 'violet', label: type || 'Epic' };
  }

  if (normalized.includes('риск') || normalized.includes('risk')) {
    return { Icon: TriangleAlert, tone: 'red', label: type || 'Риск' };
  }

  return { Icon: ClipboardList, tone: normalized === 'задача' || normalized === 'task' ? 'blue' : 'grey', label: type || 'Задача' };
}

export function IssueTypeIcon({ type }: { type: string }) {
  const { Icon, tone, label } = issueTypeIconMeta(type);

  return (
    <span
      className={cn('inline-flex size-[18px] shrink-0 items-center justify-center', issueTypeToneClasses[tone])}
      title={label}
      aria-label={label}
    >
      <Icon size={15} strokeWidth={2.1} aria-hidden="true" />
    </span>
  );
}

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
        className="text-[13px] font-normal leading-tight text-muted-foreground underline-offset-[3px] transition-colors duration-150 hover:text-foreground hover:underline"
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
        className="text-[13px] font-semibold leading-tight text-muted-foreground underline-offset-[3px] transition-colors duration-150 hover:text-foreground hover:underline"
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

export function SummaryCell({
  children,
  className,
  epicKey,
  epicTitle,
  issueKey,
  issueType,
}: {
  children: ReactNode;
  className?: string;
  epicKey?: string | null;
  epicTitle?: string | null;
  issueKey?: string;
  issueType?: string;
}) {
  const epicLabel = epicTitle && epicTitle !== epicKey ? `${epicKey} · ${epicTitle}` : epicKey;

  if (issueKey || issueType) {
    return (
      <div className={cn('flex w-[40rem] max-w-[40rem] items-start gap-2 py-1', className)}>
        {issueType ? <IssueTypeIcon type={issueType} /> : null}
        {issueKey ? <IssueKeyCell issueKey={issueKey} className="shrink-0 pl-0 pt-px" /> : null}
        <span className="min-w-0 whitespace-normal break-words text-sm font-semibold leading-5 text-zinc-800 transition-colors group-hover:text-zinc-950">
          {children}
        </span>
        {epicKey ? (
          <a
            href={`${JIRA_BASE_URL}/${epicKey}`}
            target="_blank"
            rel="noopener noreferrer"
            title={epicLabel ? `Эпик ${epicLabel}` : `Эпик ${epicKey}`}
            aria-label={epicLabel ? `Эпик ${epicLabel}` : `Эпик ${epicKey}`}
            className="mt-[-1px] inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 underline-offset-2 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:underline"
          >
            <Layers size={12} aria-hidden="true" />
            <span>{epicKey}</span>
          </a>
        ) : null}
      </div>
    );
  }

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
  const label = status || 'Не указан';

  return (
    <span className="inline-flex max-w-full items-center gap-2 text-[13px] font-medium leading-tight text-zinc-600" title={label}>
      <span className={cn('size-[7px] shrink-0 rounded-full', dotToneClasses[statusTone(status)])} aria-hidden="true" />
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
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
