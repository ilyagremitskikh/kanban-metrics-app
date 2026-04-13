import { useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Pencil, Plus, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';

import type { JiraIssueShort } from '../types';
import CreateIssueForm from './CreateIssueForm';
import EditIssueForm from './EditIssueForm';
import { TypeBadge, PriorityBadge } from './Badges';
import { getUniqueTypes } from '../lib/issueTypes';
import { IssueKeyCell, StatusCell, SummaryCell, TaskScoreBadge, type TaskScoreTone } from './TaskTableCells';
import { TasksDataTable, TasksDataTableSortHeader } from './TasksDataTable';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, SectionCard, StatusHint } from '@/components/ui/admin';

interface Props {
  n8nBaseUrl: string;
  issues: JiraIssueShort[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedText: string | null;
  onRefresh: () => void;
  embedded?: boolean;
}

type IssuesViewMode = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; issueKey: string };
type IssueScoreKind = 'rice' | 'bug' | 'techdebt';
type SortField = 'key' | 'score';

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function getIssueScoreKind(issue: JiraIssueShort): IssueScoreKind {
  const normalized = normalizeType(issue.issuetype);
  if (normalized === 'ошибка' || normalized === 'bug') return 'bug';
  if (normalized === 'техдолг' || normalized === 'tech debt') return 'techdebt';
  return 'rice';
}

function riceScoreTone(score: number | null, max: number): TaskScoreTone {
  if (score === null || max === 0) return 'muted';
  const pct = score / max;
  if (pct >= 0.66) return 'primary';
  if (pct >= 0.33) return 'warning';
  return 'muted';
}

function bugScoreTone(score: number | null): TaskScoreTone {
  if (score === null) return 'muted';
  if (score >= 75) return 'danger';
  if (score >= 50) return 'orange';
  if (score >= 20) return 'warning';
  return 'muted';
}

function tdQuadrant(impact: number | null | undefined, effort: number | null | undefined): { tone: TaskScoreTone } | null {
  if (impact == null || effort == null || effort === 0) return null;
  if (impact > 5 && effort <= 5) return { tone: 'primary' };
  if (impact > 5 && effort > 5) return { tone: 'primary' };
  if (impact <= 5 && effort <= 5) return { tone: 'warning' };
  return { tone: 'danger' };
}

function getIssueScoreMeta(
  issue: JiraIssueShort,
  maxRiceScore: number,
): { value: number; label: 'RICE' | 'BUG' | 'ROI'; tone: TaskScoreTone } | null {
  const kind = getIssueScoreKind(issue);

  if (kind === 'rice') {
    const value = issue.rice_score ?? issue.score;
    if (value != null) return { value, label: 'RICE', tone: riceScoreTone(value, maxRiceScore) };
    return null;
  }

  if (kind === 'bug') {
    const value = issue.bug_score ?? issue.score;
    if (value != null) return { value, label: 'BUG', tone: bugScoreTone(value) };
    return null;
  }

  const value = issue.td_roi ?? issue.score;
  if (value == null) return null;
  return {
    value,
    label: 'ROI',
    tone: tdQuadrant(issue.td_impact, issue.td_effort)?.tone ?? 'warning',
  };
}

function compareIssueKeys(a: string, b: string, dir: 'asc' | 'desc'): number {
  const result = a.localeCompare(b, 'ru', { numeric: true, sensitivity: 'base' });
  return dir === 'asc' ? result : -result;
}

export default function IssuesTab({
  n8nBaseUrl,
  issues,
  loading,
  refreshing,
  error,
  lastUpdatedText,
  onRefresh,
  embedded = false,
}: Props) {
  const [viewMode, setViewMode] = useState<IssuesViewMode>({ mode: 'list' });
  const [sortField, setSortField] = useState<SortField>('key');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const handleCreated = () => {
    setViewMode({ mode: 'list' });
    onRefresh();
  };

  const handleUpdated = () => {
    setViewMode({ mode: 'list' });
    onRefresh();
  };

  const availableTypes = useMemo(() => getUniqueTypes(issues), [issues]);

  const maxRiceScore = useMemo(() => {
    const values = issues
      .filter((issue) => getIssueScoreKind(issue) === 'rice')
      .map((issue) => issue.rice_score ?? issue.score)
      .filter((value): value is number => value != null);

    return values.length ? Math.max(...values) : 0;
  }, [issues]);

  const sortedIssues = useMemo(() => {
    const rows = [...issues];

    rows.sort((left, right) => {
      if (sortField === 'score') {
        const leftScore = getIssueScoreMeta(left, maxRiceScore)?.value ?? null;
        const rightScore = getIssueScoreMeta(right, maxRiceScore)?.value ?? null;

        if (leftScore === null && rightScore === null) return compareIssueKeys(left.key, right.key, 'desc');
        if (leftScore === null) return 1;
        if (rightScore === null) return -1;
        if (leftScore !== rightScore) return sortDir === 'desc' ? rightScore - leftScore : leftScore - rightScore;
      }

      return compareIssueKeys(left.key, right.key, sortField === 'key' ? sortDir : 'desc');
    });

    return rows;
  }, [issues, maxRiceScore, sortDir, sortField]);

  const columns = useMemo<ColumnDef<JiraIssueShort>[]>(() => [
    {
      id: 'key',
      header: () => (
        <TasksDataTableSortHeader
          active={sortField === 'key'}
          dir={sortField === 'key' ? sortDir : 'desc'}
          onClick={() => {
            if (sortField === 'key') {
              setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
              return;
            }
            setSortField('key');
            setSortDir('desc');
          }}
        >
          Задача
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => <IssueKeyCell issueKey={row.original.key} />,
    },
    {
      id: 'type',
      header: 'Тип',
      cell: ({ row }) => <TypeBadge type={row.original.issuetype || 'Не указан'} />,
    },
    {
      id: 'summary',
      header: () => (
        <div>
          <span>Summary</span>
          <span className="block text-[10px] font-normal normal-case tracking-normal text-muted-foreground">контекст задачи</span>
        </div>
      ),
      cell: ({ row }) => <SummaryCell>{row.original.summary}</SummaryCell>,
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'priority',
      header: 'Приоритет',
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      id: 'score',
      header: () => (
        <TasksDataTableSortHeader
          active={sortField === 'score'}
          dir={sortField === 'score' ? sortDir : 'desc'}
          align="center"
          onClick={() => {
            if (sortField === 'score') {
              setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
              return;
            }
            setSortField('score');
            setSortDir('desc');
          }}
        >
          Score
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => {
        const score = getIssueScoreMeta(row.original, maxRiceScore);
        return score ? (
          <TaskScoreBadge value={score.value} label={score.label} tone={score.tone} />
        ) : (
          <span className="text-base text-gray-300">—</span>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          onClick={() => setViewMode({ mode: 'edit', issueKey: row.original.key })}
          variant="secondary"
          size="icon"
          className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
          title="Редактировать"
        >
          <Pencil size={13} />
        </Button>
      ),
    },
  ], [maxRiceScore, sortDir, sortField]);

  if (viewMode.mode !== 'list') {
    return (
      <SectionCard
        title={viewMode.mode === 'create' ? 'Создать задачу' : `Редактировать ${viewMode.issueKey}`}
        className="rounded-xl"
        action={(
          <Button variant="secondary" onClick={() => setViewMode({ mode: 'list' })}>
            <ArrowLeft size={14} />
            Назад к списку
          </Button>
        )}
      >
        <div className="mx-auto w-full max-w-6xl">
          {viewMode.mode === 'create' ? (
            <CreateIssueForm
              n8nBaseUrl={n8nBaseUrl}
              availableTypes={availableTypes}
              onCreated={handleCreated}
              onClose={() => setViewMode({ mode: 'list' })}
              layout="page"
            />
          ) : (
            <EditIssueForm
              n8nBaseUrl={n8nBaseUrl}
              availableTypes={availableTypes}
              issueKey={viewMode.issueKey}
              onUpdated={handleUpdated}
              onClose={() => setViewMode({ mode: 'list' })}
              layout="page"
            />
          )}
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/25 p-3">
        <div className="space-y-1">
          {!embedded ? <h2 className="text-2xl font-semibold tracking-tight text-foreground">Задачи</h2> : null}
          <div className="text-sm text-muted-foreground">
            {sortedIssues.length} {sortedIssues.length === 1 ? 'тикет' : sortedIssues.length < 5 ? 'тикета' : 'тикетов'} в общем списке
          </div>
          {!embedded && error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {!embedded && !error && lastUpdatedText ? <StatusHint>{lastUpdatedText}</StatusHint> : null}
        </div>

        <div className="flex items-center gap-2">
          {!embedded ? (
            <Button onClick={onRefresh} disabled={loading} variant="secondary" title="Обновить">
              <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
            </Button>
          ) : null}
          <Button onClick={() => setViewMode({ mode: 'create' })}>
            <Plus size={16} />
            Создать задачу
          </Button>
        </div>
      </div>

      {!loading && !error && issues.length === 0 && (
        <EmptyState
          title="Задач пока нет"
          description={n8nBaseUrl ? 'Данные загрузятся автоматически при открытии вкладки или по кнопке обновления' : 'Укажите n8n URL в настройках'}
          icon={<ClipboardList size={28} className="text-slate-900" />}
        />
      )}

      {(issues.length > 0 || loading) && (
        <TasksDataTable
          data={sortedIssues}
          columns={columns}
          getRowId={(issue) => issue.key}
          footerText={`${sortedIssues.length} ${sortedIssues.length === 1 ? 'тикет' : sortedIssues.length < 5 ? 'тикета' : 'тикетов'} в таблице`}
          emptyTitle={loading ? 'Загружаем тикеты…' : 'Тикеты не найдены'}
        />
      )}
    </div>
  );
}
