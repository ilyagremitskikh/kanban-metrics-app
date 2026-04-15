import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import IssuesTab from './IssuesTab';
import { RiceSection } from './RiceSection';
import type { JiraIssueShort, RiceIssue, TaskMutationPatch } from '../types';
import { getAvailableIssueTypes, isBusinessType, isEpicType } from '../lib/issueTypes';
import type { RiceUpdate } from '../lib/riceApi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionCard, StatusHint } from '@/components/ui/admin';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

type TasksMode = 'edit' | 'priorities';

const MODE_COPY: Record<TasksMode, { label: string; description: string }> = {
  edit: {
    label: 'Редактирование',
    description: 'Бизнес-задачи (User Story, Epic) и Downstream (задачи, баги, техдолг).',
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

function issueEpicKey(issue: JiraIssueShort, issueByKey: Map<string, JiraIssueShort>, seen = new Set<string>()): string | null {
  const directEpicKey = issue.epic_key ?? issue.epic?.key ?? null;
  if (directEpicKey) return directEpicKey;

  const parentKey = issue.parent_key ?? issue.parent?.key ?? null;
  if (!parentKey || seen.has(parentKey)) return null;

  const parent = issueByKey.get(parentKey);
  if (!parent) return null;
  if (isEpicType(parent.issuetype)) return parent.key;

  seen.add(issue.key);
  return issueEpicKey(parent, issueByKey, seen);
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
  onTaskMutated: (patch: TaskMutationPatch) => void;
  onScoringSaved?: (updates: RiceUpdate[]) => void;
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
  onTaskMutated,
  onScoringSaved,
  refreshBlocked,
  refreshBlockedReason,
  onSendToQueue,
  onSwitchToMetrics,
  onDirtyChange,
}: Props) {
  const [editSubTab, setEditSubTab] = useState<'business' | 'downstream'>('downstream');
  const modeCopy = MODE_COPY[mode];
  const hasLoadedData = issues.length > 0 || scoringIssues.length > 0;
  const availableTypes = useMemo(() => getAvailableIssueTypes(issues), [issues]);

  const businessIssues = useMemo(
    () => issues.filter((i) => isBusinessType(i.issuetype)),
    [issues],
  );
  const downstreamIssues = useMemo(
    () => issues.filter((i) => !isBusinessType(i.issuetype)),
    [issues],
  );
  const epicIssues = useMemo(
    () => issues.filter((i) => isEpicType(i.issuetype)),
    [issues],
  );
  const downstreamHierarchyIssues = useMemo(
    () => {
      const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));
      const downstreamEpicKeys = new Set(
        downstreamIssues
          .map((issue) => issueEpicKey(issue, issueByKey))
          .filter((key): key is string => Boolean(key)),
      );
      return [
        ...epicIssues.filter((issue) => downstreamEpicKeys.has(issue.key)),
        ...downstreamIssues,
      ];
    },
    [downstreamIssues, epicIssues, issues],
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
          <Tabs value={editSubTab} onValueChange={(v) => setEditSubTab(v as 'business' | 'downstream')}>
            <TabsList>
              <TabsTrigger value="business">
                Бизнес
                {businessIssues.length > 0 && (
                  <Badge variant={editSubTab === 'business' ? 'default' : 'secondary'}>{businessIssues.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="downstream">
                Downstream
                {downstreamIssues.length > 0 && (
                  <Badge variant={editSubTab === 'downstream' ? 'default' : 'secondary'}>{downstreamIssues.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="business">
              <IssuesTab
                n8nBaseUrl={n8nBaseUrl}
                issues={businessIssues}
                loading={loading}
                refreshing={refreshing}
                error={error}
                lastUpdatedText={null}
                onRefresh={onRefresh}
                onTaskMutated={onTaskMutated}
                availableTypes={availableTypes}
                embedded
                defaultIssueType="User Story"
              />
            </TabsContent>
            <TabsContent value="downstream">
              <IssuesTab
                n8nBaseUrl={n8nBaseUrl}
                issues={downstreamIssues}
                hierarchyIssues={downstreamHierarchyIssues}
                loading={loading}
                refreshing={refreshing}
                error={error}
                lastUpdatedText={null}
                onRefresh={onRefresh}
                onTaskMutated={onTaskMutated}
                availableTypes={availableTypes}
                embedded
                defaultIssueType="Задача"
              />
            </TabsContent>
          </Tabs>
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
            onSaved={onScoringSaved ?? (() => onRefresh())}
            embedded
            defaultTab="rice"
            allowedTabs={['rice', 'bugs', 'techdebt']}
          />
        ) : null}
      </div>
    </SectionCard>
  );
}
