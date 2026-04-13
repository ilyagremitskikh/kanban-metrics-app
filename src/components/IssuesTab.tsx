import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Pencil, Plus, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import type { JiraIssueShort } from '../types';
import CreateIssueForm from './CreateIssueForm';
import EditIssueForm from './EditIssueForm';
import { TypeBadge, PriorityBadge } from './Badges';
import { getUniqueTypes } from '../lib/issueTypes';
import { IssueKeyCell, StatusCell, SummaryCell, TaskScoreBadge, type TaskScoreTone } from './TaskTableCells';
import { TasksDataTable, TasksDataTableSortHeader } from './TasksDataTable';
import { Badge } from '@/components/ui/badge';
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
type IssueCategory = 'User Story' | 'Задача' | 'Ошибки' | 'Техдолг' | 'Прочее';

const CATEGORY_MAP: Record<string, IssueCategory> = {
  'User Story': 'User Story',
  'Задача': 'Задача',
  'Sub-task': 'Задача',
  'Подзадача': 'Задача',
  'Ошибка': 'Ошибки',
  'Bug': 'Ошибки',
  'Техдолг': 'Техдолг',
  'Tech Debt': 'Техдолг',
};

const CATEGORY_ORDER: readonly IssueCategory[] = ['User Story', 'Задача', 'Ошибки', 'Техдолг', 'Прочее'];

const CATEGORY_COLORS: Record<IssueCategory, { pill: string }> = {
  'User Story': { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  'Задача': { pill: 'bg-slate-100 text-slate-800 border-slate-200' },
  'Ошибки': { pill: 'bg-red-100 text-red-800 border-red-200' },
  'Техдолг': { pill: 'bg-amber-100 text-amber-800 border-amber-200' },
  'Прочее': { pill: 'bg-gray-100 text-gray-700 border-gray-200' },
};

function getIssueCategory(issue: JiraIssueShort): IssueCategory {
  return CATEGORY_MAP[issue.issuetype] ?? 'Прочее';
}

function getScoreBadge(issue: JiraIssueShort, category: IssueCategory): { value: number; label: 'RICE' | 'Bug' | 'TechDebt'; tone: TaskScoreTone } | null {
  if (category === 'User Story' || category === 'Задача') {
    const value = issue.rice_score ?? issue.score;
    if (value != null) return { value, label: 'RICE', tone: 'primary' };
  }
  if (category === 'Ошибки') {
    const value = issue.bug_score ?? issue.score;
    if (value != null) return { value, label: 'Bug', tone: 'danger' };
  }
  if (category === 'Техдолг') {
    const value = issue.td_roi ?? issue.score;
    if (value != null) return { value, label: 'TechDebt', tone: 'warning' };
  }
  return null;
}

export default function IssuesTab({ n8nBaseUrl, issues, loading, refreshing, error, lastUpdatedText, onRefresh, embedded = false }: Props) {
  const [viewMode, setViewMode] = useState<IssuesViewMode>({ mode: 'list' });
  const [scoreSortDir, setScoreSortDir] = useState<'desc' | 'asc' | null>(null);
  const [activeCategory, setActiveCategory] = useState<IssueCategory | null>(null);

  const handleCreated = () => {
    setViewMode({ mode: 'list' });
    onRefresh();
  };

  const handleUpdated = () => {
    setViewMode({ mode: 'list' });
    onRefresh();
  };

  const availableTypes = useMemo(() => getUniqueTypes(issues), [issues]);

  const visibleTabs = useMemo(() => {
    const counts = new Map<IssueCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]));
    for (const issue of issues) {
      const category = getIssueCategory(issue);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return CATEGORY_ORDER
      .map((category) => ({ category, count: counts.get(category) ?? 0 }))
      .filter((tab) => tab.count > 0);
  }, [issues]);

  /* eslint-disable react-hooks/set-state-in-effect -- Keep active category in sync with the fetched category set. */
  useEffect(() => {
    if (!visibleTabs.length) {
      setActiveCategory(null);
      return;
    }
    if (activeCategory && visibleTabs.some((tab) => tab.category === activeCategory)) return;
    setActiveCategory(visibleTabs[0].category);
  }, [activeCategory, visibleTabs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const activeIssues = useMemo(() => {
    if (!activeCategory) return [];
    const filtered = issues.filter((issue) => getIssueCategory(issue) === activeCategory);
    if (!scoreSortDir) return filtered;

    return [...filtered].sort((a, b) => {
      const sa = getScoreBadge(a, activeCategory);
      const sb = getScoreBadge(b, activeCategory);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return scoreSortDir === 'desc' ? sb.value - sa.value : sa.value - sb.value;
    });
  }, [activeCategory, issues, scoreSortDir]);

  const activeCategoryColors = activeCategory ? CATEGORY_COLORS[activeCategory] : CATEGORY_COLORS['Прочее'];

  const columns = useMemo<ColumnDef<JiraIssueShort>[]>(() => [
    {
      id: 'key',
      header: 'Ключ',
      cell: ({ row }) => <IssueKeyCell issueKey={row.original.key} />,
    },
    {
      id: 'type',
      header: 'Тип',
      cell: ({ row }) => <TypeBadge type={row.original.issuetype} />,
    },
    {
      id: 'summary',
      header: 'Заголовок',
      cell: ({ row }) => <SummaryCell>{row.original.summary}</SummaryCell>,
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'priority',
      header: 'Приор.',
      cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
    },
    {
      id: 'score',
      header: () => (
        <TasksDataTableSortHeader
          active={scoreSortDir !== null}
          dir={scoreSortDir ?? 'desc'}
          align="center"
          onClick={() => setScoreSortDir((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : 'desc'))}
        >
          Score
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => {
        const category = getIssueCategory(row.original);
        const score = getScoreBadge(row.original, category);
        return score ? (
          <TaskScoreBadge value={score.value} label={score.label} tone={score.tone} />
        ) : null;
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
  ], [scoreSortDir]);

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
      {!embedded && <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">{embedded ? 'Редактирование' : 'Задачи'}</h2>
          {!embedded && activeCategory && (
            <div className={`mt-1.5 inline-flex items-center gap-2 rounded-xl border px-3 py-1 text-xs font-semibold ${activeCategoryColors.pill}`}>
              {activeCategory}
              <Badge variant="outline" className="rounded-md bg-white/80">{activeIssues.length}</Badge>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onRefresh} disabled={loading} variant="secondary" title="Обновить">
            <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
          </Button>
          <Button onClick={() => setViewMode({ mode: 'create' })}>
            <Plus size={16} />
            Создать задачу
          </Button>
        </div>
      </div>}

      {!embedded && error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {!embedded && !error && lastUpdatedText && <StatusHint>{lastUpdatedText}</StatusHint>}

      {!loading && !error && issues.length === 0 && (
        <div className="space-y-3">
          <EmptyState
            title="Задач пока нет"
            description={n8nBaseUrl ? 'Данные загрузятся автоматически при открытии вкладки или по кнопке обновления' : 'Укажите n8n URL в настройках'}
            icon={<ClipboardList size={28} className="text-slate-900" />}
          />
          <Button onClick={() => setViewMode({ mode: 'create' })}>
            <Plus size={16} />
            Создать задачу
          </Button>
        </div>
      )}

      {visibleTabs.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/25 p-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {visibleTabs.map((tab) => {
              const colors = CATEGORY_COLORS[tab.category];
              const isActive = activeCategory === tab.category;
              return (
                <Button
                  key={tab.category}
                  onClick={() => setActiveCategory(tab.category)}
                  variant={isActive ? 'default' : 'secondary'}
                  className={`h-8 rounded-lg px-3 text-sm font-semibold ${
                    isActive ? colors.pill : 'text-muted-foreground'
                  }`}
                >
                  {tab.category}
                  <Badge variant={isActive ? 'outline' : 'secondary'} className="rounded-md bg-background/80">{tab.count}</Badge>
                </Button>
              );
            })}
          </div>
          {embedded && (
            <Button onClick={() => setViewMode({ mode: 'create' })} className="w-full md:w-auto">
              <Plus size={16} />
              Создать задачу
            </Button>
          )}
        </div>
      )}

      {activeCategory && activeIssues.length > 0 && (
        <SectionCard
          title={activeCategory}
          description={`${activeIssues.length} задач в этой категории`}
          className="rounded-2xl border-border"
        >
          <TasksDataTable
            data={activeIssues}
            columns={columns}
            getRowId={(issue) => issue.key}
            footerText={`${activeIssues.length} ${activeIssues.length === 1 ? 'задача' : activeIssues.length < 5 ? 'задачи' : 'задач'} на вкладке`}
            emptyTitle="Задачи этой категории не найдены"
          />
        </SectionCard>
      )}
    </div>
  );
}
