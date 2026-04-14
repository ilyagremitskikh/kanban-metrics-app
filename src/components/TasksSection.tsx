import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';

import IssuesTab from './IssuesTab';
import { RiceSection } from './RiceSection';
import type { JiraIssueEpic, JiraIssueShort, RiceIssue } from '../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SectionCard, StatusHint } from '@/components/ui/admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TasksMode = 'edit' | 'epics' | 'priorities';

const MODE_COPY: Record<TasksMode, { label: string; description: string }> = {
  edit: {
    label: 'Редактирование',
    description: 'Единая таблица всех Jira-тикетов с типами, приоритетами и score-метками.',
  },
  priorities: {
    label: 'Приоритеты',
    description: 'Единая панель приоритизации для задач, багов и техдолга.',
  },
  epics: {
    label: 'Эпики',
    description: 'Эпики проекта: редактирование и создание вложенных тикетов.',
  },
};

function isEpicType(issueType: string | null | undefined): boolean {
  const normalized = (issueType ?? '').trim().toLowerCase();
  return normalized === 'epic' || normalized === 'эпик';
}

function TasksSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="grid grid-cols-[120px_100px_1fr_120px_80px] gap-4">
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
              <Skeleton className="h-5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface Props {
  n8nBaseUrl: string;
  issues: JiraIssueShort[];
  scoringIssues: RiceIssue[];
  mode: TasksMode;
  onModeChange: (mode: TasksMode) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedText: string | null;
  onRefresh: () => void;
  onScoringSaved?: () => void;
  refreshBlocked: boolean;
  refreshBlockedReason: string;
  onSendToQueue: (items: string[]) => void;
  onSwitchToMetrics: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function TasksSection({
  n8nBaseUrl,
  issues,
  scoringIssues,
  mode,
  onModeChange,
  loading,
  refreshing,
  error,
  lastUpdatedText,
  onRefresh,
  onScoringSaved,
  refreshBlocked,
  refreshBlockedReason,
  onSendToQueue,
  onSwitchToMetrics,
  onDirtyChange,
}: Props) {
  const modeCopy = MODE_COPY[mode];
  const hasLoadedData = issues.length > 0 || scoringIssues.length > 0;
  const epicByKey = useMemo<Record<string, JiraIssueEpic>>(
    () => Object.fromEntries(issues
      .filter((issue) => isEpicType(issue.issuetype))
      .map((issue) => [issue.key, {
        key: issue.key,
        summary: issue.summary,
        status: issue.status,
        priority: issue.priority,
      }])),
    [issues],
  );
  const displayIssues = useMemo(() => {
    const issuesWithDirectEpic = issues.map((issue) => {
      if (isEpicType(issue.issuetype)) return { ...issue, epic: null, epic_key: null };
      const directEpicKey = issue.epic?.key ?? issue.epic_key ?? null;
      const epicFromList = directEpicKey ? epicByKey[directEpicKey] : null;
      const directEpic = directEpicKey
        ? {
            key: directEpicKey,
            summary: issue.epic?.summary || epicFromList?.summary,
            status: issue.epic?.status || epicFromList?.status,
            priority: issue.epic?.priority || epicFromList?.priority,
          }
        : null;
      return { ...issue, epic: directEpic, epic_key: directEpic?.key ?? directEpicKey };
    });
    const issueByKey = Object.fromEntries(issuesWithDirectEpic.map((issue) => [issue.key, issue]));

    return issuesWithDirectEpic.map((issue) => {
      if (issue.epic || !issue.parent?.key || isEpicType(issue.issuetype)) return issue;
      const parentIssue = issueByKey[issue.parent.key];
      const parentEpic = isEpicType(parentIssue?.issuetype) ? epicByKey[issue.parent.key] : parentIssue?.epic ?? null;
      return parentEpic ? { ...issue, epic: parentEpic, epic_key: parentEpic.key } : issue;
    });
  }, [epicByKey, issues]);
  const editableIssues = useMemo(() => displayIssues.filter((issue) => !isEpicType(issue.issuetype)), [displayIssues]);
  const epicIssues = useMemo(() => displayIssues.filter((issue) => isEpicType(issue.issuetype)), [displayIssues]);
  const scoringDisplayIssues = useMemo(
    () => scoringIssues.filter((issue) => !isEpicType(issue.issue_type)),
    [scoringIssues],
  );
  const issueParentByKey = useMemo(
    () => Object.fromEntries(displayIssues.map((issue) => [issue.key, issue.parent ?? null])),
    [displayIssues],
  );
  const issueEpicByKey = useMemo(
    () => Object.fromEntries(displayIssues.map((issue) => [issue.key, issue.epic ?? null])),
    [displayIssues],
  );

  const handleRefresh = () => {
    if (refreshBlocked) return;
    onRefresh();
  };

  return (
    <SectionCard
      title="Задачи"
      description={modeCopy.description}
      action={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lastUpdatedText ? <StatusHint>{lastUpdatedText}</StatusHint> : null}
          <Button
            onClick={handleRefresh}
            disabled={loading || refreshBlocked}
            variant="secondary"
            title={refreshBlocked ? refreshBlockedReason : 'Обновить задачи'}
          >
            {loading || refreshing ? <Spinner /> : <RefreshCw size={14} />}
            Обновить
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <ToggleGroup
            type="single"
            value={mode}
            onValueChange={(value) => {
              if (value) onModeChange(value as TasksMode);
            }}
            variant="outline"
            className="w-fit rounded-xl border border-border bg-muted/35 p-1"
          >
            {Object.entries(MODE_COPY).map(([id, copy]) => (
              <ToggleGroupItem key={id} value={id} className="rounded-lg px-4 text-sm font-semibold data-[state=on]:bg-background data-[state=on]:shadow-sm">
                {copy.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="text-sm text-muted-foreground">
            {modeCopy.label}
          </div>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading && !hasLoadedData ? <TasksSkeleton /> : null}

        {(!loading || hasLoadedData) && mode === 'edit' ? (
          <IssuesTab
            n8nBaseUrl={n8nBaseUrl}
            issues={editableIssues}
            loading={loading}
            refreshing={refreshing}
            error={error}
            lastUpdatedText={null}
            onRefresh={onRefresh}
            listTitle="Задачи"
            embedded
          />
        ) : null}

        {(!loading || hasLoadedData) && mode === 'epics' ? (
          <IssuesTab
            n8nBaseUrl={n8nBaseUrl}
            issues={epicIssues}
            loading={loading}
            refreshing={refreshing}
            error={error}
            lastUpdatedText={null}
            onRefresh={onRefresh}
            allowCreate={false}
            listTitle="Эпики"
            embedded
          />
        ) : null}

        {(!loading || hasLoadedData) && mode === 'priorities' ? (
          <RiceSection
            n8nBaseUrl={n8nBaseUrl}
            issues={scoringDisplayIssues}
            issueParentByKey={issueParentByKey}
            issueEpicByKey={issueEpicByKey}
            loading={loading}
            refreshing={refreshing}
            error={error}
            lastUpdatedText={null}
            onRefreshFromJira={onRefresh}
            refreshBlocked={refreshBlocked}
            refreshBlockedReason={refreshBlockedReason}
            onSendToQueue={onSendToQueue}
            onSwitchToMetrics={onSwitchToMetrics}
            onDirtyChange={onDirtyChange}
            onSaved={onScoringSaved ?? onRefresh}
            embedded
            defaultTab="rice"
            allowedTabs={['rice', 'bugs', 'techdebt']}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
