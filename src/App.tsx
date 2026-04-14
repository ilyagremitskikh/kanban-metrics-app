import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { WebhookMeta } from './lib/apiClient';
import { fetchJiraIssues } from './lib/jiraApi';
import {
  buildTableRows,
  getThroughputTotal,
  buildThroughputWeeks,
  buildThroughputWeeksFromRaw,
  getWipBuckets,
} from './lib/metrics';
import type { Issue, JiraIssueShort, RiceIssue, Settings as SettingsType, ThroughputWeek } from './types';
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

const METRICS_TTL_MS = 10 * 60 * 1000;
const TASKS_TTL_MS = 5 * 60 * 1000;

type AppTab = 'metrics' | 'tasks' | 'settings';
type TasksMode = 'edit' | 'epics' | 'priorities';
type StatusType = 'hidden' | 'info' | 'error' | 'success';
type ResourceKey = 'metrics' | 'tasks';
type ResourceStatus = 'idle' | 'loading' | 'success' | 'error';

interface ResourceState {
  status: ResourceStatus;
  error: string | null;
  lastLoadedAt: number | null;
  expiresAt: number | null;
  isRefreshing: boolean;
  hasEverLoaded: boolean;
}

const INITIAL_RESOURCE_STATE: ResourceState = {
  status: 'idle',
  error: null,
  lastLoadedAt: null,
  expiresAt: null,
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

function isExpired(state: ResourceState): boolean {
  return !state.expiresAt || state.expiresAt <= Date.now();
}

function getLoadedAt(meta: WebhookMeta | null, fallbackNow: number): number {
  if (!meta?.fetchedAt) return fallbackNow;
  const parsed = new Date(meta.fetchedAt).getTime();
  return Number.isFinite(parsed) ? parsed : fallbackNow;
}

function formatLastUpdated(lastLoadedAt: number | null): string | null {
  if (!lastLoadedAt) return null;
  const diffMs = Date.now() - lastLoadedAt;
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin <= 0) return 'Обновлено только что';
  if (diffMin < 60) return `Обновлено ${diffMin} мин назад`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Обновлено ${diffHours} ч назад`;
  return `Обновлено ${new Date(lastLoadedAt).toLocaleString('ru-RU')}`;
}

function getResourceHint(state: ResourceState): { text: string; tone: 'neutral' | 'info' | 'error' } | null {
  if (state.error) return { text: state.error, tone: 'error' };
  if (state.status === 'loading') return { text: 'Загрузка данных…', tone: 'info' };
  if (state.isRefreshing) return { text: 'Идёт обновление данных…', tone: 'info' };
  const lastUpdated = formatLastUpdated(state.lastLoadedAt);
  return lastUpdated ? { text: lastUpdated, tone: 'neutral' } : null;
}

function mapHintTone(tone: 'neutral' | 'info' | 'error'): 'neutral' | 'info' | 'error' {
  return tone;
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
    parent: issue.parent ?? null,
    epic: issue.epic ?? null,
    epic_key: issue.epic_key ?? null,
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
  const previousBaseUrlRef = useRef(settings.n8nBaseUrl);
  const previousMetricsQueryRef = useRef(`${settings.mode}:${settings.projectKey}:${settings.customJql}`);

  const setResourceState = (key: ResourceKey, updater: (prev: ResourceState) => ResourceState) => {
    setResourceStates((prev) => ({ ...prev, [key]: updater(prev[key]) }));
  };

  const beginLoad = (key: ResourceKey) => {
    setResourceState(key, (prev) => ({
      ...prev,
      status: prev.hasEverLoaded ? prev.status : 'loading',
      isRefreshing: prev.hasEverLoaded,
      error: null,
    }));
  };

  const completeLoad = (key: ResourceKey, ttlMs: number, meta: WebhookMeta | null = null) => {
    const now = Date.now();
    const loadedAt = getLoadedAt(meta, now);
    setResourceState(key, () => ({
      status: 'success',
      error: null,
      lastLoadedAt: loadedAt,
      expiresAt: loadedAt + ttlMs,
      isRefreshing: false,
      hasEverLoaded: true,
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

  const metricsReady = !!settings.n8nBaseUrl
    && ((settings.mode === 'standard' && !!settings.projectKey.trim())
      || (settings.mode === 'custom' && !!settings.customJql.trim()));
  const baseUrlReady = !!settings.n8nBaseUrl.trim();

  const metricsLoading = resourceStates.metrics.status === 'loading' || resourceStates.metrics.isRefreshing;

  /* eslint-disable react-hooks/set-state-in-effect -- Existing cache reset/load effects intentionally synchronize local resource state. */
  useEffect(() => {
    if (previousBaseUrlRef.current !== settings.n8nBaseUrl) {
      previousBaseUrlRef.current = settings.n8nBaseUrl;
      setMetricsIssues([]);
      setRiceIssues([]);
      setJiraIssues([]);
      setTpWeeksRaw(null);
      setResourceStates({
        metrics: INITIAL_RESOURCE_STATE,
        tasks: INITIAL_RESOURCE_STATE,
      });
      setRiceDirty(false);
    }
  }, [settings.n8nBaseUrl]);

  useEffect(() => {
    const currentMetricsQuery = `${settings.mode}:${settings.projectKey}:${settings.customJql}`;
    if (previousMetricsQueryRef.current !== currentMetricsQuery) {
      previousMetricsQueryRef.current = currentMetricsQuery;
      setMetricsIssues([]);
      setTpWeeksRaw(null);
      setResourceStates((prev) => ({
        ...prev,
        metrics: INITIAL_RESOURCE_STATE,
      }));
    }
  }, [settings.mode, settings.projectKey, settings.customJql]);

  const loadMetrics = async (force = false, switchToMetrics = false) => {
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

    const current = resourceStates.metrics;
    if (!force && current.hasEverLoaded && !isExpired(current)) {
      if (switchToMetrics) setActiveTab('metrics');
      return;
    }

    beginLoad('metrics');
    setStatus({ msg: 'Запрашиваем данные из Jira через n8n…', type: 'info' });

    try {
      const loaded = await fetchIssues(settings, (msg) => {
        setStatus({ msg, type: 'info' });
      });
      setMetricsIssues(loaded.issues);

      try {
        const rawItems = await fetchThroughputRaw(settings, (msg) => setStatus({ msg, type: 'info' }));
        setTpWeeksRaw(buildThroughputWeeksFromRaw(rawItems));
      } catch (err) {
        console.warn('Throughput webhook failed, falling back:', err);
        setTpWeeksRaw(null);
      }

      completeLoad('metrics', METRICS_TTL_MS, loaded.meta);
      setStatus({ msg: '', type: 'hidden' });
      if (switchToMetrics) setActiveTab('metrics');
    } catch (err) {
      const error = `Ошибка: ${(err as Error).message}`;
      failLoad('metrics', error);
      setStatus({ msg: error, type: 'error' });
    }
  };

  const loadTasks = async (force = false, allowDirty = false) => {
    if (!baseUrlReady) {
      failLoad('tasks', 'Укажите n8n URL в настройках');
      return;
    }
    const current = resourceStates.tasks;
    if (!force && current.hasEverLoaded && !isExpired(current)) return;
    if (riceDirty && !allowDirty) return;

    beginLoad('tasks');
    try {
      const loaded = await fetchJiraIssues(settings.n8nBaseUrl, { forceRefresh: force });
      setJiraIssues(loaded.issues);
      setRiceIssues(loaded.issues.map(mapJiraIssueToRiceIssue));
      completeLoad('tasks', TASKS_TTL_MS, loaded.meta);
    } catch (err) {
      failLoad('tasks', `Ошибка: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'metrics' && metricsReady) {
      void loadMetrics(false, false);
    }
    if (activeTab === 'tasks' && baseUrlReady) {
      void loadTasks(false);
    }
  }, [activeTab, metricsReady, baseUrlReady, riceDirty]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const tableRows = resourceStates.metrics.hasEverLoaded ? buildTableRows(metricsIssues) : [];
  const ltValues = tableRows.filter((r) => r.leadTime !== null).map((r) => r.leadTime as number);
  const ctValues = tableRows.filter((r) => r.devCycleTime !== null).map((r) => r.devCycleTime as number);
  const upstreamValues = tableRows.filter((r) => r.upstreamTime !== null).map((r) => r.upstreamTime as number);
  const tpWeeksFallback = resourceStates.metrics.hasEverLoaded ? buildThroughputWeeks(metricsIssues) : [];
  const tpWeeks = tpWeeksRaw ?? tpWeeksFallback;
  const wipBuckets = resourceStates.metrics.hasEverLoaded ? getWipBuckets(metricsIssues) : { upstream: {}, downstream: {} };
  const throughputTotal = getThroughputTotal(tpWeeks);

  const metricsHint = getResourceHint(resourceStates.metrics);
  const tasksHint = getResourceHint(resourceStates.tasks);
  const riceRefreshBlocked = riceDirty;

  const metricsRefreshLabel = metricsLoading
    ? (resourceStates.metrics.hasEverLoaded ? 'Обновление…' : 'Загрузка…')
    : (resourceStates.metrics.hasEverLoaded ? 'Обновить метрики' : 'Загрузить данные');

  const metricsEmptyState = useMemo(() => {
    if (metricsLoading) return 'Загружаем данные…';
    if (!metricsReady) return 'Перейдите в Настройки и задайте параметры для загрузки';
    return 'Откройте вкладку или нажмите «Загрузить данные» в настройках';
  }, [metricsLoading, metricsReady]);

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
              onFetch={() => void loadMetrics(true, true)}
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
                  {metricsHint ? <StatusHint tone={mapHintTone(metricsHint.tone)}>{metricsHint.text}</StatusHint> : null}
                  <Button variant="secondary" onClick={() => void loadMetrics(true, false)} disabled={metricsLoading || !metricsReady}>
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
                    throughputTotal={throughputTotal}
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
              onRefresh={() => void loadTasks(true)}
              onScoringSaved={() => void loadTasks(true, true)}
              refreshBlocked={riceRefreshBlocked}
              refreshBlockedReason="Сначала сохраните оценки, потом обновите данные из Jira."
              onSendToQueue={(items) => setQueuePreset(items)}
              onSwitchToMetrics={() => setActiveTab('metrics')}
              onDirtyChange={setRiceDirty}
            />
          </TabsContent>
        </Tabs>
      </PageContainer>
    </PageShell>
  );
}
