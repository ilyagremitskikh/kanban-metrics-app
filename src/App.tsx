import { useEffect, useMemo, useState } from 'react';
import './App.css';

import { Settings as SettingsPanel } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { MetricCards } from './components/MetricCards';
import { ScatterChart, ThroughputChart } from './components/Charts';
import { MonteCarlo } from './components/MonteCarlo';
import { AgingWIP } from './components/AgingWIP';
import { IssuesTable } from './components/IssuesTable';
import { TasksSection } from './components/TasksSection';
import { useLocalStorage } from './hooks/useLocalStorage';
import { fetchIssues, fetchThroughputRaw } from './lib/api';
import { type RiceUpdate } from './lib/riceApi';
import type { WebhookMeta } from './lib/apiClient';
import { fetchJiraIssues } from './lib/jiraApi';
import {
  applyRicePatchToSnapshot,
  buildMetricsSnapshotKey,
  buildTasksSnapshotKey,
  createMetricsSnapshot,
  createTasksSnapshot,
  loadMetricsSnapshot,
  loadTasksSnapshot,
  saveTasksSnapshot,
  saveMetricsSnapshot,
  upsertTaskInSnapshot,
} from './lib/snapshots';
import {
  buildTableRows,
  buildThroughputWeeks,
  buildThroughputWeeksFromRaw,
  getWipBuckets,
} from './lib/metrics';
import type {
  Issue,
  JiraIssueShort,
  PersistedTasksSnapshot,
  ResourceSource,
  RiceIssue,
  Settings as SettingsType,
  TaskMutationPatch,
  ThroughputWeek,
} from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, PageContainer, PageShell, SectionCard, StatusHint } from '@/components/ui/admin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const DEFAULT_SETTINGS: SettingsType = {
  n8nBaseUrl: '',
  mode: 'standard',
  projectKey: '',
  customJql: '',
};

type AppTab = 'metrics' | 'tasks' | 'settings';
type TasksMode = 'edit' | 'priorities';
type StatusType = 'hidden' | 'info' | 'error' | 'success';
type ResourceKey = 'metrics' | 'tasks';
type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

interface ResourceState {
  status: ResourceStatus;
  error: string | null;
  lastSyncAt: number | null;
  lastMutationAt: number | null;
  source: ResourceSource | null;
  isRefreshing: boolean;
  hasEverLoaded: boolean;
}

const INITIAL_RESOURCE_STATE: ResourceState = {
  status: 'idle',
  error: null,
  lastSyncAt: null,
  lastMutationAt: null,
  source: null,
  isRefreshing: false,
  hasEverLoaded: false,
};

const TABS: { id: AppTab; label: string }[] = [
  { id: 'metrics', label: 'Метрики' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'settings', label: 'Настройки' },
];

function migrateSettings(raw: unknown): SettingsType {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const s = raw as Record<string, unknown>;
  let n8nBaseUrl = typeof s.n8nBaseUrl === 'string' ? s.n8nBaseUrl : '';
  if (!n8nBaseUrl && typeof s.webhookUrl === 'string' && s.webhookUrl) {
    try {
      n8nBaseUrl = new URL(s.webhookUrl).origin;
    } catch {
      // ignore legacy invalid value
    }
  }
  return {
    n8nBaseUrl,
    mode: s.mode === 'standard' || s.mode === 'custom' ? s.mode : 'standard',
    projectKey: typeof s.projectKey === 'string' ? s.projectKey : '',
    customJql: typeof s.customJql === 'string' ? s.customJql : '',
  };
}

function toTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatRelativeTimestamp(timestamp: number | null): string | null {
  if (!timestamp) return null;
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin <= 0) return 'только что';
  if (diffMin < 60) return `${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} ч назад`;
  return new Date(timestamp).toLocaleString('ru-RU');
}

function getResourceHint(state: ResourceState): { text: string; tone: 'neutral' | 'info' | 'error' } | null {
  if (state.error) return { text: state.error, tone: 'error' };
  if (state.status === 'loading' && !state.hasEverLoaded) return { text: 'Читаем локальный снапшот…', tone: 'info' };
  if (state.isRefreshing) return { text: 'Идёт синхронизация…', tone: 'info' };

  const lastSync = formatRelativeTimestamp(state.lastSyncAt);
  const lastMutation = formatRelativeTimestamp(state.lastMutationAt);

  if (state.lastSyncAt && state.lastMutationAt && state.lastMutationAt > state.lastSyncAt) {
    return { text: `Последняя синхронизация ${lastSync} · есть локально сохранённые изменения`, tone: 'neutral' };
  }
  if (state.lastSyncAt) {
    return { text: `Последняя синхронизация ${lastSync}`, tone: 'neutral' };
  }
  if (state.lastMutationAt) {
    return { text: `Локально сохранено ${lastMutation}`, tone: 'neutral' };
  }

  return null;
}

function MetricChartCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <SectionCard title={title} className={className ?? 'rounded-xl'}>
      {children}
    </SectionCard>
  );
}

function mapJiraIssueToRiceIssue(issue: JiraIssueShort): RiceIssue {
  return {
    key: issue.key,
    summary: issue.summary,
    issue_type: issue.issuetype,
    labels: Array.isArray(issue.labels) ? issue.labels.join(', ') : '',
    priority: issue.priority,
    status: issue.status,
    reach: issue.reach ?? null,
    impact: issue.impact ?? null,
    confidence: issue.confidence ?? null,
    effort: issue.effort ?? null,
    rice_score: issue.rice_score ?? null,
    bug_risk: issue.bug_risk ?? null,
    bug_process: issue.bug_process ?? null,
    bug_scale: issue.bug_scale ?? null,
    bug_workaround: issue.bug_workaround ?? null,
    bug_score: issue.bug_score ?? null,
    td_impact: issue.td_impact ?? null,
    td_effort: issue.td_effort ?? null,
    td_roi: issue.td_roi ?? null,
  };
}

function getMetaSyncTimestamp(meta: WebhookMeta | null): string {
  return meta?.fetchedAt ?? new Date().toISOString();
}

export default function App() {
  const [rawSettings, setSettings] = useLocalStorage<unknown>('km_settings', DEFAULT_SETTINGS);
  const settings: SettingsType = migrateSettings(rawSettings);
  const updateSettings = (s: SettingsType) => setSettings(s);

  const [activeTab, setActiveTab] = useState<AppTab>('settings');
  const [metricsIssues, setMetricsIssues] = useState<Issue[]>([]);
  const [queuePreset, setQueuePreset] = useState<string[] | null>(null);
  const [status, setStatus] = useState<{ msg: string; type: StatusType }>({ msg: '', type: 'hidden' });
  const [riceIssues, setRiceIssues] = useState<RiceIssue[]>([]);
  const [jiraIssues, setJiraIssues] = useState<JiraIssueShort[]>([]);
  const [tasksMode, setTasksMode] = useState<TasksMode>('edit');
  const [tpWeeksRaw, setTpWeeksRaw] = useState<ThroughputWeek[] | null>(null);
  const [riceDirty, setRiceDirty] = useState(false);
  const [resourceStates, setResourceStates] = useState<Record<ResourceKey, ResourceState>>({
    metrics: INITIAL_RESOURCE_STATE,
    tasks: INITIAL_RESOURCE_STATE,
  });

  const metricsReady = !!settings.n8nBaseUrl
    && ((settings.mode === 'standard' && !!settings.projectKey.trim())
      || (settings.mode === 'custom' && !!settings.customJql.trim()));
  const baseUrlReady = !!settings.n8nBaseUrl.trim();
  const metricsSnapshotKey = metricsReady ? buildMetricsSnapshotKey(settings) : null;
  const tasksSnapshotKey = baseUrlReady ? buildTasksSnapshotKey(settings.n8nBaseUrl) : null;
  const metricsLoading = resourceStates.metrics.status === 'loading' || resourceStates.metrics.isRefreshing;

  const setResourceState = (key: ResourceKey, updater: (prev: ResourceState) => ResourceState) => {
    setResourceStates((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  };

  const markResourceLoaded = (
    key: ResourceKey,
    meta: { lastSyncAt: string | null; lastMutationAt: string | null; source: ResourceSource },
  ) => {
    setResourceState(key, () => ({
      status: 'success',
      error: null,
      lastSyncAt: toTimestamp(meta.lastSyncAt),
      lastMutationAt: toTimestamp(meta.lastMutationAt),
      source: meta.source,
      isRefreshing: false,
      hasEverLoaded: true,
    }));
  };

  const beginLoad = (key: ResourceKey) => {
    setResourceState(key, (prev) => ({
      ...prev,
      status: prev.hasEverLoaded ? prev.status : 'loading',
      isRefreshing: prev.hasEverLoaded,
      error: null,
    }));
  };

  const failLoad = (key: ResourceKey, error: string) => {
    setResourceState(key, (prev) => ({
      ...prev,
      status: prev.hasEverLoaded ? 'success' : 'error',
      error,
      isRefreshing: false,
    }));
  };

  /* eslint-disable react-hooks/set-state-in-effect -- Snapshot hydration intentionally synchronizes React state with IndexedDB-backed keys. */
  useEffect(() => {
    let cancelled = false;

    if (!metricsSnapshotKey) {
      setMetricsIssues([]);
      setTpWeeksRaw(null);
      setResourceState('metrics', () => INITIAL_RESOURCE_STATE);
      return () => { cancelled = true; };
    }

    setResourceState('metrics', (prev) => ({
      ...prev,
      status: prev.hasEverLoaded ? prev.status : 'loading',
      error: null,
    }));

    void loadMetricsSnapshot(metricsSnapshotKey)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot) {
          setMetricsIssues([]);
          setTpWeeksRaw(null);
          setResourceState('metrics', () => INITIAL_RESOURCE_STATE);
          return;
        }

        setMetricsIssues(snapshot.issues);
        setTpWeeksRaw(snapshot.throughputWeeks);
        markResourceLoaded('metrics', snapshot.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setMetricsIssues([]);
        setTpWeeksRaw(null);
        failLoad('metrics', `Не удалось прочитать локальный снапшот: ${(err as Error).message}`);
      });

    return () => { cancelled = true; };
  }, [metricsSnapshotKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;

    if (!tasksSnapshotKey) {
      setJiraIssues([]);
      setRiceIssues([]);
      setRiceDirty(false);
      setResourceState('tasks', () => INITIAL_RESOURCE_STATE);
      return () => { cancelled = true; };
    }

    setResourceState('tasks', (prev) => ({
      ...prev,
      status: prev.hasEverLoaded ? prev.status : 'loading',
      error: null,
    }));

    void loadTasksSnapshot(tasksSnapshotKey)
      .then((snapshot) => {
        if (cancelled) return;
        if (!snapshot) {
          setJiraIssues([]);
          setRiceIssues([]);
          setRiceDirty(false);
          setResourceState('tasks', () => INITIAL_RESOURCE_STATE);
          return;
        }

        setJiraIssues(snapshot.jiraIssues);
        setRiceIssues(snapshot.riceIssues);
        setRiceDirty(false);
        markResourceLoaded('tasks', snapshot.meta);
      })
      .catch((err) => {
        if (cancelled) return;
        setJiraIssues([]);
        setRiceIssues([]);
        failLoad('tasks', `Не удалось прочитать локальный снапшот: ${(err as Error).message}`);
      });

    return () => { cancelled = true; };
  }, [tasksSnapshotKey]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const loadMetrics = async (switchToMetrics = false) => {
    if (!settings.n8nBaseUrl) {
      const error = 'Укажите n8n URL в настройках';
      failLoad('metrics', error);
      setStatus({ msg: error, type: 'error' });
      return;
    }
    if (settings.mode === 'standard' && !settings.projectKey.trim()) {
      const error = 'Укажите ключ проекта Jira';
      failLoad('metrics', error);
      setStatus({ msg: error, type: 'error' });
      return;
    }
    if (settings.mode === 'custom' && !settings.customJql.trim()) {
      const error = 'Введите JQL-запрос';
      failLoad('metrics', error);
      setStatus({ msg: error, type: 'error' });
      return;
    }

    const snapshotKey = buildMetricsSnapshotKey(settings);
    beginLoad('metrics');
    setStatus({ msg: 'Запрашиваем данные из Jira через n8n…', type: 'info' });

    try {
      const loaded = await fetchIssues(settings, (msg) => {
        setStatus({ msg, type: 'info' });
      });

      let throughputWeeks: ThroughputWeek[] | null = null;
      try {
        const rawItems = await fetchThroughputRaw(settings, (msg) => setStatus({ msg, type: 'info' }));
        throughputWeeks = buildThroughputWeeksFromRaw(rawItems);
      } catch (err) {
        console.warn('Throughput webhook failed, falling back:', err);
      }

      const snapshot = createMetricsSnapshot(
        snapshotKey,
        loaded.issues,
        throughputWeeks,
        getMetaSyncTimestamp(loaded.meta),
      );

      await saveMetricsSnapshot(snapshotKey, snapshot);
      setMetricsIssues(snapshot.issues);
      setTpWeeksRaw(snapshot.throughputWeeks);
      markResourceLoaded('metrics', snapshot.meta);
      setStatus({ msg: '', type: 'hidden' });
      if (switchToMetrics) setActiveTab('metrics');
    } catch (err) {
      const error = `Ошибка: ${(err as Error).message}`;
      failLoad('metrics', error);
      setStatus({ msg: error, type: 'error' });
    }
  };

  const loadTasks = async (allowDirty = false) => {
    if (!baseUrlReady) {
      failLoad('tasks', 'Укажите n8n URL в настройках');
      return;
    }
    if (riceDirty && !allowDirty) return;

    const snapshotKey = buildTasksSnapshotKey(settings.n8nBaseUrl);
    beginLoad('tasks');

    try {
      const loaded = await fetchJiraIssues(settings.n8nBaseUrl, { forceRefresh: true });
      const nextRiceIssues = loaded.issues.map(mapJiraIssueToRiceIssue);
      const snapshot = createTasksSnapshot(
        snapshotKey,
        loaded.issues,
        nextRiceIssues,
        getMetaSyncTimestamp(loaded.meta),
      );

      await saveTasksSnapshot(snapshotKey, snapshot);
      setJiraIssues(snapshot.jiraIssues);
      setRiceIssues(snapshot.riceIssues);
      setRiceDirty(false);
      markResourceLoaded('tasks', snapshot.meta);
    } catch (err) {
      failLoad('tasks', `Ошибка: ${(err as Error).message}`);
    }
  };

  const handleTaskMutation = async (patch: TaskMutationPatch) => {
    if (!tasksSnapshotKey) return;

    try {
      const snapshot = await upsertTaskInSnapshot(tasksSnapshotKey, patch);
      setJiraIssues(snapshot.jiraIssues);
      setRiceIssues(snapshot.riceIssues);
      markResourceLoaded('tasks', snapshot.meta);
    } catch (err) {
      failLoad('tasks', `Не удалось сохранить локальный снапшот: ${(err as Error).message}`);
    }
  };

  const handleRiceSaved = async (updates: RiceUpdate[]) => {
    if (!tasksSnapshotKey || updates.length === 0) return;

    try {
      let snapshot: PersistedTasksSnapshot | null = await loadTasksSnapshot(tasksSnapshotKey);
      if (!snapshot) {
        snapshot = createTasksSnapshot(
          tasksSnapshotKey,
          jiraIssues,
          riceIssues,
          resourceStates.tasks.lastSyncAt ? new Date(resourceStates.tasks.lastSyncAt).toISOString() : null,
        );
      }

      for (const update of updates) {
        snapshot = applyRicePatchToSnapshot(snapshot, tasksSnapshotKey, { ...update });
      }

      await saveTasksSnapshot(tasksSnapshotKey, snapshot);
      setJiraIssues(snapshot.jiraIssues);
      setRiceIssues(snapshot.riceIssues);
      setRiceDirty(false);
      markResourceLoaded('tasks', snapshot.meta);
    } catch (err) {
      failLoad('tasks', `Не удалось обновить локальный снапшот: ${(err as Error).message}`);
    }
  };

  const tableRows = resourceStates.metrics.hasEverLoaded ? buildTableRows(metricsIssues) : [];
  const ltValues = tableRows.filter((r) => r.leadTime !== null).map((r) => r.leadTime as number);
  const ctValues = tableRows.filter((r) => r.devCycleTime !== null).map((r) => r.devCycleTime as number);
  const upstreamValues = tableRows.filter((r) => r.upstreamTime !== null).map((r) => r.upstreamTime as number);
  const tpWeeksFallback = resourceStates.metrics.hasEverLoaded ? buildThroughputWeeks(metricsIssues) : [];
  const tpWeeks = tpWeeksRaw ?? tpWeeksFallback;
  const wipBuckets = resourceStates.metrics.hasEverLoaded ? getWipBuckets(metricsIssues) : { upstream: {}, downstream: {} };
  const completedTotal = tableRows.filter((r) => r.completedAt !== null).length;

  const metricsHint = getResourceHint(resourceStates.metrics);
  const tasksHint = getResourceHint(resourceStates.tasks);
  const riceRefreshBlocked = riceDirty;

  const metricsRefreshLabel = metricsLoading
    ? (resourceStates.metrics.hasEverLoaded ? 'Синхронизация…' : 'Загрузка…')
    : (resourceStates.metrics.hasEverLoaded ? 'Обновить данные' : 'Загрузить данные');

  const metricsEmptyState = useMemo(() => {
    if (metricsLoading) return 'Загружаем локальный снапшот…';
    if (!metricsReady) return 'Перейдите в Настройки и задайте параметры для загрузки';
    return 'Нажмите «Загрузить данные», чтобы подтянуть свежий снимок из Jira';
  }, [metricsLoading, metricsReady]);

  const tasksEmptyState = baseUrlReady
    ? 'Нажмите «Обновить», чтобы подтянуть список задач, или создайте новую задачу'
    : 'Укажите n8n URL в настройках';

  return (
    <PageShell>
      <PageContainer>
        <StatusBar message={status.msg} type={status.type} />

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AppTab)} className="gap-4">
          <TabsList className="h-auto w-fit flex-wrap">
            {TABS.map(({ id, label }) => {
              const count = id === 'metrics'
                ? (resourceStates.metrics.hasEverLoaded ? metricsIssues.length : null)
                : id === 'tasks'
                  ? (resourceStates.tasks.hasEverLoaded && jiraIssues.length > 0 ? jiraIssues.length : null)
                  : null;

              return (
                <TabsTrigger key={id} value={id}>
                  {label}
                  {count !== null ? <Badge variant={activeTab === id ? 'default' : 'secondary'}>{count}</Badge> : null}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="settings">
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onFetch={() => void loadMetrics(true)}
              loading={metricsLoading}
              loadingLabel={metricsRefreshLabel}
            />
          </TabsContent>

          <TabsContent value="metrics">
            <SectionCard
              title="Метрики потока"
              description="Дашборд по времени доставки, скорости завершения, работе в процессе и прогнозированию."
              action={
                <div className="flex items-center gap-2">
                  {metricsHint ? <StatusHint tone={metricsHint.tone}>{metricsHint.text}</StatusHint> : null}
                  <Button variant="secondary" onClick={() => void loadMetrics(false)} disabled={metricsLoading || !metricsReady}>
                    {metricsRefreshLabel}
                  </Button>
                </div>
              }
            >
              {!resourceStates.metrics.hasEverLoaded ? (
                <EmptyState title="Данные не загружены" description={metricsEmptyState} icon={<span className="text-4xl">📊</span>} />
              ) : (
                <div className="flex flex-col gap-6">
                  <MetricCards
                    ltValues={ltValues}
                    ctValues={ctValues}
                    upstreamValues={upstreamValues}
                    tpWeeks={tpWeeks}
                    wipBuckets={wipBuckets}
                    completedTotal={completedTotal}
                  />

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
                    <MetricChartCard title="Время доставки (Lead Time)" className="xl:col-span-3">
                      <ScatterChart id="lt" rows={tableRows} field="leadTime" color="#0f172a" values={ltValues} />
                    </MetricChartCard>
                    <MetricChartCard title="Время разработки (Downstream CT)" className="xl:col-span-3">
                      <ScatterChart id="ct" rows={tableRows} field="devCycleTime" color="#0f766e" values={ctValues} />
                    </MetricChartCard>
                    <MetricChartCard title="Время подготовки (Upstream CT)" className="xl:col-span-2">
                      <ScatterChart id="upstream" rows={tableRows} field="upstreamTime" color="#475569" values={upstreamValues} />
                    </MetricChartCard>
                    <MetricChartCard title="Скорость завершения (Throughput)" className="xl:col-span-4">
                      <ThroughputChart weeks={tpWeeks} />
                    </MetricChartCard>
                  </div>

                  <MonteCarlo issues={metricsIssues} tpWeeks={tpWeeks} ctValues={ctValues} queuePreset={queuePreset} />

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    <SectionCard
                      title="Старение подготовки (Upstream Aging WIP)"
                      className="rounded-xl"
                      action={
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" type="button">ℹ</Button>
                          </TooltipTrigger>
                          <TooltipContent>Задачи в аналитике/подготовке. Возраст считается с первого входа в Upstream. Пороги — по Upstream Time P50/P85.</TooltipContent>
                        </Tooltip>
                      }
                    >
                      <AgingWIP issues={metricsIssues} bucket="upstream" thresholdValues={upstreamValues} />
                    </SectionCard>
                    <SectionCard
                      title="Старение разработки (Downstream Aging WIP)"
                      className="rounded-xl"
                      action={
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" type="button">ℹ</Button>
                          </TooltipTrigger>
                          <TooltipContent>Задачи в разработке/тестировании/релизе. Возраст считается с первого входа в Downstream. Пороги — по Dev Cycle Time P50/P85.</TooltipContent>
                        </Tooltip>
                      }
                    >
                      <AgingWIP issues={metricsIssues} bucket="downstream" thresholdValues={ctValues} />
                    </SectionCard>
                  </div>

                  <IssuesTable rows={tableRows} />
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="tasks">
            {!resourceStates.tasks.hasEverLoaded && !baseUrlReady ? (
              <SectionCard title="Задачи" description="Работа со списком Jira-задач и локальным снапшотом.">
                <EmptyState title="Данные не загружены" description={tasksEmptyState} icon={<span className="text-4xl">🗂️</span>} />
              </SectionCard>
            ) : (
              <TasksSection
                n8nBaseUrl={settings.n8nBaseUrl}
                issues={jiraIssues}
                scoringIssues={riceIssues}
                mode={tasksMode}
                onModeChange={setTasksMode}
                loading={resourceStates.tasks.status === 'loading'}
                refreshing={resourceStates.tasks.isRefreshing}
                error={resourceStates.tasks.error}
                lastUpdatedText={tasksHint && tasksHint.tone !== 'error' ? tasksHint.text : null}
                onRefresh={() => void loadTasks(false)}
                onTaskMutated={(patch) => void handleTaskMutation(patch)}
                onScoringSaved={(updates) => void handleRiceSaved(updates)}
                refreshBlocked={riceRefreshBlocked}
                refreshBlockedReason="Сначала сохраните оценки, потом обновите данные из Jira."
                onSendToQueue={(items) => setQueuePreset(items)}
                onSwitchToMetrics={() => setActiveTab('metrics')}
                onDirtyChange={setRiceDirty}
              />
            )}
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageShell>
  );
}
