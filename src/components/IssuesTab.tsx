import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, Plus, RefreshCw } from 'lucide-react';

import type { JiraIssueShort, TaskMutationPatch } from '../types';
import CreateIssueForm from './CreateIssueForm';
import EditIssueForm from './EditIssueForm';
import { getStandaloneIssueTypeOptions, getUniqueTypes } from '../lib/issueTypes';
import { TaskHierarchyTable, type TaskHierarchyScoreMeta, type TaskHierarchyTone } from './TaskHierarchyTable';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState, SectionCard, StatusHint } from '@/components/ui/admin';

interface Props {
  n8nBaseUrl: string;
  issues: JiraIssueShort[];
  hierarchyIssues?: JiraIssueShort[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedText: string | null;
  onRefresh: () => void;
  onTaskMutated: (patch: TaskMutationPatch) => void;
  availableTypes?: string[];
  embedded?: boolean;
  defaultIssueType?: string;
}

type IssuesViewMode = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; issueKey: string };
type IssueScoreKind = 'rice' | 'bug' | 'techdebt';

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

function getIssueScoreKind(issue: JiraIssueShort): IssueScoreKind {
  const normalized = normalizeType(issue.issuetype);
  if (normalized === 'ошибка' || normalized === 'bug') return 'bug';
  if (normalized === 'техдолг' || normalized === 'tech debt') return 'techdebt';
  return 'rice';
}

function riceScoreTone(score: number | null, max: number): TaskHierarchyTone {
  if (score === null || max === 0) return 'muted';
  const pct = score / max;
  if (pct >= 0.66) return 'primary';
  if (pct >= 0.33) return 'warning';
  return 'muted';
}

function bugScoreTone(score: number | null): TaskHierarchyTone {
  if (score === null) return 'muted';
  if (score >= 75) return 'danger';
  if (score >= 50) return 'orange';
  if (score >= 20) return 'warning';
  return 'muted';
}

function tdQuadrant(impact: number | null | undefined, effort: number | null | undefined): { tone: TaskHierarchyTone } | null {
  if (impact == null || effort == null || effort === 0) return null;
  if (impact > 5 && effort <= 5) return { tone: 'primary' };
  if (impact > 5 && effort > 5) return { tone: 'primary' };
  if (impact <= 5 && effort <= 5) return { tone: 'warning' };
  return { tone: 'danger' };
}

function getIssueScoreMeta(
  issue: JiraIssueShort,
  maxRiceScore: number,
): TaskHierarchyScoreMeta | null {
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

export default function IssuesTab({
  n8nBaseUrl,
  issues,
  hierarchyIssues,
  loading,
  refreshing,
  error,
  lastUpdatedText,
  onRefresh,
  onTaskMutated,
  availableTypes: allAvailableTypes,
  embedded = false,
  defaultIssueType,
}: Props) {
  const [viewMode, setViewMode] = useState<IssuesViewMode>({ mode: 'list' });

  const handleCreated = (patch: TaskMutationPatch) => {
    setViewMode({ mode: 'list' });
    onTaskMutated(patch);
  };

  const handleUpdated = (patch: TaskMutationPatch) => {
    setViewMode({ mode: 'list' });
    onTaskMutated(patch);
  };

  const availableTypes = useMemo(
    () => allAvailableTypes?.length ? allAvailableTypes : getUniqueTypes(issues),
    [allAvailableTypes, issues],
  );
  const standaloneIssueTypes = useMemo(
    () => getStandaloneIssueTypeOptions(availableTypes),
    [availableTypes],
  );

  const maxRiceScore = useMemo(() => {
    const values = issues
      .filter((issue) => getIssueScoreKind(issue) === 'rice')
      .map((issue) => issue.rice_score ?? issue.score)
      .filter((value): value is number => value != null);

    return values.length ? Math.max(...values) : 0;
  }, [issues]);

  const getScoreMeta = useCallback(
    (issue: JiraIssueShort) => getIssueScoreMeta(issue, maxRiceScore),
    [maxRiceScore],
  );

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
              availableTypes={standaloneIssueTypes}
              onCreated={handleCreated}
              onClose={() => setViewMode({ mode: 'list' })}
              layout="page"
              defaultIssueType={defaultIssueType}
            />
          ) : (
            <EditIssueForm
              n8nBaseUrl={n8nBaseUrl}
              availableTypes={availableTypes}
              issueKey={viewMode.issueKey}
              onUpdated={handleUpdated}
              onChildCreated={onTaskMutated}
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
            {issues.length} {issues.length === 1 ? 'тикет' : issues.length < 5 ? 'тикета' : 'тикетов'} в общем списке
          </div>
          {!embedded && error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {!embedded && !error && lastUpdatedText ? <StatusHint>{lastUpdatedText}</StatusHint> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        <TaskHierarchyTable
          issues={issues}
          loading={loading}
          footerText={`${issues.length} ${issues.length === 1 ? 'тикет' : issues.length < 5 ? 'тикета' : 'тикетов'} в таблице`}
          emptyTitle={loading ? 'Загружаем тикеты…' : 'Тикеты не найдены'}
          getScoreMeta={getScoreMeta}
          hierarchyIssues={hierarchyIssues}
          onEditIssue={(issueKey) => setViewMode({ mode: 'edit', issueKey })}
        />
      )}
    </div>
  );
}
