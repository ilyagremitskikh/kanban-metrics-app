import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type ExpandedState,
  type Row,
} from '@tanstack/react-table';
import { BookOpen, BugPlay, ChevronDown, ClipboardList, Layers2, ListChecks, Pencil, TriangleAlert, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import './TaskHierarchyTable.css';

import { buildTaskHierarchyTableRows, type TaskHierarchyTableRow } from '../lib/taskHierarchy';
import type { JiraIssueShort } from '../types';
import { JIRA_BASE_URL } from '../types';

export type TaskHierarchyTone = 'primary' | 'muted' | 'warning' | 'orange' | 'danger';

export interface TaskHierarchyScoreMeta {
  value: number;
  label: 'RICE' | 'BUG' | 'ROI';
  tone: TaskHierarchyTone;
}

interface TaskHierarchyTableProps {
  issues: JiraIssueShort[];
  hierarchyIssues?: JiraIssueShort[];
  loading: boolean;
  emptyTitle?: string;
  footerText?: string;
  getScoreMeta: (issue: JiraIssueShort) => TaskHierarchyScoreMeta | null;
  onEditIssue: (issueKey: string) => void;
}

type DotTone = 'green' | 'yellow' | 'red' | 'blue' | 'cyan' | 'violet' | 'orange' | 'grey';

interface IssueTypeIconMeta {
  Icon: LucideIcon;
  tone: DotTone;
  label: string;
}

function collectExpandedRows(rows: TaskHierarchyTableRow[]): Record<string, boolean> {
  return rows.reduce<Record<string, boolean>>((acc, row) => {
    if (row.subRows.length > 0) {
      acc[row.id] = true;
      Object.assign(acc, collectExpandedRows(row.subRows));
    }

    return acc;
  }, {});
}

function countIssueRows(rows: TaskHierarchyTableRow[]): number {
  return rows.reduce((count, row) => count + (row.kind === 'issue' ? 1 : 0) + countIssueRows(row.subRows), 0);
}

function dotClass(tone: DotTone): string {
  return `task-hierarchy__dot task-hierarchy__dot--${tone}`;
}

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

function priorityTone(priority: string): DotTone {
  const normalized = priority.trim().toLowerCase();

  if (['неотложный', 'срочный', 'highest', 'urgent'].includes(normalized)) return 'red';
  if (['высокий', 'high'].includes(normalized)) return 'orange';
  if (['нормальный', 'средний', 'medium'].includes(normalized)) return 'yellow';
  if (['низкий', 'незначительный', 'low', 'lowest'].includes(normalized)) return 'blue';
  return 'grey';
}

function scoreTone(tone: TaskHierarchyTone): DotTone {
  if (tone === 'primary') return 'green';
  if (tone === 'warning') return 'yellow';
  if (tone === 'orange') return 'orange';
  if (tone === 'danger') return 'red';
  return 'grey';
}

function DotLabel({ tone, children }: { tone: DotTone; children: string }) {
  return (
    <span className="task-hierarchy__badge" title={children}>
      <span className={dotClass(tone)} aria-hidden="true" />
      <span className="task-hierarchy__badge-text">{children}</span>
    </span>
  );
}

function issueKeyLink(issueKey: string, className = 'task-hierarchy__key') {
  return (
    <a href={`${JIRA_BASE_URL}/${issueKey}`} target="_blank" rel="noopener noreferrer" className={className}>
      {issueKey}
    </a>
  );
}

function IssueTypeIcon({ type }: { type: string }) {
  const { Icon, tone, label } = issueTypeIconMeta(type);

  return (
    <span className={`task-hierarchy__type-icon task-hierarchy__type-icon--${tone}`} title={label} aria-label={label}>
      <Icon size={15} strokeWidth={2.1} aria-hidden="true" />
    </span>
  );
}

function ExpandToggle({ row }: { row: Row<TaskHierarchyTableRow> }) {
  if (!row.getCanExpand()) {
    return <span className="task-hierarchy__toggle-spacer" aria-hidden="true" />;
  }

  return (
    <button
      type="button"
      className="task-hierarchy__toggle"
      onClick={row.getToggleExpandedHandler()}
      aria-label={row.getIsExpanded() ? 'Свернуть' : 'Развернуть'}
      aria-expanded={row.getIsExpanded()}
    >
      <ChevronDown
        size={15}
        className={row.getIsExpanded() ? 'task-hierarchy__chevron' : 'task-hierarchy__chevron task-hierarchy__chevron--closed'}
        aria-hidden="true"
      />
    </button>
  );
}

function TaskCell({ row }: { row: Row<TaskHierarchyTableRow> }) {
  const item = row.original;
  const issueCount = item.kind === 'issue' ? 0 : countIssueRows(item.subRows);

  return (
    <div className="task-hierarchy__task" style={{ marginLeft: row.depth * 28 }}>
      <ExpandToggle row={row} />
      <div className="task-hierarchy__main">
        {item.kind === 'issue' ? (
          <>
            <IssueTypeIcon type={item.issue.issuetype} />
            {issueKeyLink(item.issue.key)}
          </>
        ) : null}
        {item.kind === 'epic-group' && item.epicKey ? (
          <>
            <IssueTypeIcon type={item.issue?.issuetype ?? 'Epic'} />
            {issueKeyLink(item.epicKey)}
          </>
        ) : null}
        {item.kind === 'orphan-group' ? <span className="task-hierarchy__key">Без эпика</span> : null}
        <span className="task-hierarchy__title">{item.title}</span>
        {item.kind !== 'issue' ? (
          <span className="task-hierarchy__meta">
            {issueCount} {issueCount === 1 ? 'тикет' : issueCount < 5 ? 'тикета' : 'тикетов'}
          </span>
        ) : null}
        {item.kind === 'issue' && item.parentKey && !item.parentFound ? (
          <span className="task-hierarchy__missing-note">родитель {item.parentKey} не загружен</span>
        ) : null}
      </div>
    </div>
  );
}

export function TaskHierarchyTable({
  issues,
  hierarchyIssues,
  loading,
  emptyTitle = 'Нет данных',
  footerText,
  getScoreMeta,
  onEditIssue,
}: TaskHierarchyTableProps) {
  const data = useMemo(() => buildTaskHierarchyTableRows(hierarchyIssues ?? issues), [hierarchyIssues, issues]);
  const defaultExpanded = useMemo(() => collectExpandedRows(data), [data]);
  const [expanded, setExpanded] = useState<ExpandedState>(defaultExpanded);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const columns = useMemo<ColumnDef<TaskHierarchyTableRow>[]>(() => [
    {
      id: 'task',
      header: 'Задача',
      cell: ({ row }) => <TaskCell row={row} />,
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => {
        const issue = row.original.issue;
        return issue ? <DotLabel tone={statusTone(issue.status)}>{issue.status || 'Не указан'}</DotLabel> : null;
      },
    },
    {
      id: 'priority',
      header: 'Приоритет',
      cell: ({ row }) => {
        const issue = row.original.issue;
        return issue ? <DotLabel tone={priorityTone(issue.priority)}>{issue.priority || 'Не указан'}</DotLabel> : null;
      },
    },
    {
      id: 'score',
      header: 'Score',
      cell: ({ row }) => {
        const issue = row.original.issue;
        if (!issue) return null;

        const score = getScoreMeta(issue);
        return score ? <DotLabel tone={scoreTone(score.tone)}>{`${score.value} ${score.label}`}</DotLabel> : null;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const item = row.original;
        const editableIssue = item.issue;
        if (!editableIssue) return null;

        return (
          <button
            type="button"
            className="task-hierarchy__action"
            onClick={() => onEditIssue(editableIssue.key)}
            title="Редактировать"
            aria-label={`Редактировать ${editableIssue.key}`}
          >
            <Pencil size={14} aria-hidden="true" />
          </button>
        );
      },
    },
  ], [getScoreMeta, onEditIssue]);

  // TanStack Table owns its row model and returns non-memoizable helpers by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    state: { expanded },
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="task-hierarchy">
      <div className="task-hierarchy__scroll">
        <div className="task-hierarchy__grid" role="table" aria-label="Иерархия задач">
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} className="task-hierarchy__header" role="row">
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className={`task-hierarchy__cell task-hierarchy__cell--${header.column.id}`}
                  role="columnheader"
                >
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </div>
              ))}
            </div>
          ))}

          {rows.length > 0 ? (
            rows.map((row) => (
              <div
                key={row.id}
                className={[
                  'task-hierarchy__row',
                  row.original.kind !== 'issue' ? 'task-hierarchy__row--group' : '',
                  row.original.kind === 'issue' && row.original.parentKey && !row.original.parentFound ? 'task-hierarchy__row--missing-parent' : '',
                ].filter(Boolean).join(' ')}
                role="row"
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className={`task-hierarchy__cell task-hierarchy__cell--${cell.column.id}`}
                    role="cell"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="task-hierarchy__empty" role="row">
              {loading ? 'Загружаем тикеты...' : emptyTitle}
            </div>
          )}
        </div>
      </div>
      {footerText ? <div className="task-hierarchy__footer">{footerText}</div> : null}
    </div>
  );
}
