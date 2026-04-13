import { RefreshCw } from 'lucide-react';

import IssuesTab from './IssuesTab';
import { RiceSection } from './RiceSection';
import type { JiraIssueShort, RiceIssue } from '../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { SectionCard, StatusHint } from '@/components/ui/admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TasksMode = 'edit' | 'priorities';

const MODE_COPY: Record<TasksMode, { label: string; description: string }> = {
  edit: {
    label: 'Редактирование',
    description: 'Единая таблица всех Jira-тикетов с типами, приоритетами и score-метками.',
  },
  priorities: {
    label: 'Приоритеты',
    description: 'Единая панель приоритизации для задач, багов и техдолга.',
  },
};

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
            issues={issues}
            loading={loading}
            refreshing={refreshing}
            error={error}
            lastUpdatedText={null}
            onRefresh={onRefresh}
            embedded
          />
        ) : null}

        {(!loading || hasLoadedData) && mode === 'priorities' ? (
          <RiceSection
            n8nBaseUrl={n8nBaseUrl}
            issues={scoringIssues}
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
