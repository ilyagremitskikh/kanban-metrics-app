import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

import { fetchIssues, fetchThroughputRaw } from './lib/api';
import { percentile } from './lib/utils';
import {
  buildTableRows,
  buildThroughputWeeks,
  buildThroughputWeeksFromRaw,
  getWipBuckets,
  calcPredictabilityHistory,
} from './lib/metrics';
import { useLocalStorage } from './hooks/useLocalStorage';

import { Settings as SettingsPanel } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { MetricCards } from './components/MetricCards';
import { ScatterChart, ThroughputChart } from './components/Charts';
import { MonteCarlo } from './components/MonteCarlo';
import { PredictabilityWidget } from './components/PredictabilityWidget';
import { AgingWIP } from './components/AgingWIP';
import { IssuesTable } from './components/IssuesTable';
import { RiceSection } from './components/RiceSection';
import IssuesTab from './components/IssuesTab';

import { fetchRiceIssues, refreshRiceIssues } from './lib/riceApi';
import { fetchJiraIssues } from './lib/jiraApi';

import type { Issue, ThroughputWeek, Settings as SettingsType, RiceIssue, JiraIssueShort } from './types';
import type { WebhookMeta } from './lib/apiClient';

const DEFAULT_SETTINGS: SettingsType = {
  n8nBaseUrl: '',
  mode: 'standard',
  projectKey: '',
  customJql: '',
};

const METRICS_TTL_MS = 10 * 60 * 1000;
const RICE_TTL_MS = 5 * 60 * 1000;
const ISSUES_TTL_MS = 5 * 60 * 1000;

type AppTab = 'metrics' | 'rice' | 'issues' | 'settings';
type StatusType = 'hidden' | 'info' | 'error' | 'success';
type ResourceKey = 'metrics' | 'rice' | 'issues';
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
  { id: 'rice', label: 'Scoring' },
  { id: 'issues', label: 'Задачи' },
  { id: 'settings', label: 'Настройки' },
];

function migrateSettings(raw: unknown): SettingsType {
  if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
  const s = raw as Record<string, unknown>;
  let n8nBaseUrl = typeof s.n8nBaseUrl === 'string' ? s.n8nBaseUrl : '';
  if (!n8nBaseUrl && typeof s.webhookUrl === 'string' && s.webhookUrl) {
    try { n8nBaseUrl = new URL(s.webhookUrl).origin; } catch { /* ignore */ }
  }
  return {
    n8nBaseUrl,
    mode: (s.mode === 'standard' || s.mode === 'custom') ? s.mode : 'standard',
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

function hintClass(tone: 'neutral' | 'info' | 'error'): string {
  if (tone === 'error') return 'bg-red-50 text-red-700 border-red-200';
  if (tone === 'info') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-50 text-gray-500 border-gray-200';
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
  const [tpWeeksRaw, setTpWeeksRaw] = useState<ThroughputWeek[] | null>(null);
  const [riceDirty, setRiceDirty] = useState(false);
  const [resourceStates, setResourceStates] = useState<Record<ResourceKey, ResourceState>>({
    metrics: INITIAL_RESOURCE_STATE,
    rice: INITIAL_RESOURCE_STATE,
    issues: INITIAL_RESOURCE_STATE,
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

  useEffect(() => {
    if (previousBaseUrlRef.current !== settings.n8nBaseUrl) {
      previousBaseUrlRef.current = settings.n8nBaseUrl;
      setMetricsIssues([]);
      setRiceIssues([]);
      setJiraIssues([]);
      setTpWeeksRaw(null);
      setResourceStates((prev) => ({
        ...prev,
        metrics: INITIAL_RESOURCE_STATE,
        rice: INITIAL_RESOURCE_STATE,
        issues: INITIAL_RESOURCE_STATE,
      }));
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

  const loadRiceSnapshot = async (force = false) => {
    if (!baseUrlReady) {
      failLoad('rice', 'Укажите n8n URL в настройках');
      return;
    }
    const current = resourceStates.rice;
    if (!force && current.hasEverLoaded && !isExpired(current)) return;
    if (!force && riceDirty) return;

    beginLoad('rice');
    try {
      const loaded = await fetchRiceIssues(settings.n8nBaseUrl);
      setRiceIssues(loaded.issues);
      completeLoad('rice', RICE_TTL_MS, loaded.meta);
    } catch (err) {
      failLoad('rice', `Ошибка: ${(err as Error).message}`);
    }
  };

  const refreshRiceFromJira = async () => {
    if (!baseUrlReady) {
      failLoad('rice', 'Укажите n8n URL в настройках');
      return;
    }
    if (riceDirty) {
      failLoad('rice', 'Сначала сохраните оценки, потом обновите данные из Jira.');
      return;
    }

    beginLoad('rice');
    try {
      const loaded = await refreshRiceIssues(settings.n8nBaseUrl);
      setRiceIssues(loaded.issues);
      completeLoad('rice', RICE_TTL_MS, loaded.meta);
    } catch (err) {
      failLoad('rice', `Ошибка: ${(err as Error).message}`);
    }
  };

  const loadIssuesList = async (force = false) => {
    if (!baseUrlReady) {
      failLoad('issues', 'Укажите n8n URL в настройках');
      return;
    }
    const current = resourceStates.issues;
    if (!force && current.hasEverLoaded && !isExpired(current)) return;

    beginLoad('issues');
    try {
      const loaded = await fetchJiraIssues(settings.n8nBaseUrl);
      setJiraIssues(loaded.issues);
      completeLoad('issues', ISSUES_TTL_MS, loaded.meta);
    } catch (err) {
      failLoad('issues', `Ошибка: ${(err as Error).message}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'metrics' && metricsReady) {
      void loadMetrics(false, false);
    }
    if (activeTab === 'rice' && baseUrlReady && !riceDirty) {
      void loadRiceSnapshot(false);
    }
    if (activeTab === 'issues' && baseUrlReady) {
      void loadIssuesList(false);
    }
  }, [activeTab, metricsReady, baseUrlReady, riceDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  const tableRows = resourceStates.metrics.hasEverLoaded ? buildTableRows(metricsIssues) : [];
  const ltValues = tableRows.filter((r) => r.leadTime !== null).map((r) => r.leadTime as number);
  const ctValues = tableRows.filter((r) => r.devCycleTime !== null).map((r) => r.devCycleTime as number);
  const upstreamValues = tableRows.filter((r) => r.upstreamTime !== null).map((r) => r.upstreamTime as number);
  const tpWeeksFallback = resourceStates.metrics.hasEverLoaded ? buildThroughputWeeks(metricsIssues) : [];
  const tpWeeks = tpWeeksRaw ?? tpWeeksFallback;
  const wipBuckets = resourceStates.metrics.hasEverLoaded ? getWipBuckets(metricsIssues) : { upstream: {}, downstream: {} };
  const completedTotal = tableRows.filter((r) => r.completedAt !== null).length;

  const metricsHint = getResourceHint(resourceStates.metrics);
  const riceHint = getResourceHint(resourceStates.rice);
  const issuesHint = getResourceHint(resourceStates.issues);
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
    <div className="min-h-screen bg-donezo-bg font-sans p-4 md:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-[1500px] w-full bg-donezo-bg flex flex-col gap-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-donezo-dark flex items-center justify-center text-white font-bold text-2xl shadow-sm">
              KM
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">Kanban Metrics</h1>
              <div className="text-xs text-gray-500 mt-1.5 tracking-wider font-semibold uppercase">
                Analytics &nbsp;•&nbsp; Scoring
              </div>
            </div>
          </div>

          <div className="flex bg-white rounded-full p-1.5 shadow-donezo border border-gray-100">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                className={`flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-full cursor-pointer transition-all whitespace-nowrap ${
                  activeTab === id
                    ? 'bg-donezo-dark text-white shadow-md transform scale-[1.02]'
                    : 'bg-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setActiveTab(id)}
              >
                {label}
                {id === 'metrics' && resourceStates.metrics.hasEverLoaded && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center justify-center ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {metricsIssues.length}
                  </span>
                )}
                {id === 'rice' && resourceStates.rice.hasEverLoaded && riceIssues.length > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center justify-center ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {riceIssues.length}
                  </span>
                )}
                {id === 'issues' && resourceStates.issues.hasEverLoaded && jiraIssues.length > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center justify-center ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {jiraIssues.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full">
          <StatusBar message={status.msg} type={status.type} />
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-donezo border border-gray-100/50 min-h-[70vh]">
          {activeTab === 'settings' && (
            <SettingsPanel
              settings={settings}
              onChange={updateSettings}
              onFetch={() => void loadMetrics(true, true)}
              loading={metricsLoading}
              loadingLabel={metricsRefreshLabel}
            />
          )}

          {activeTab === 'metrics' && (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <div className="text-lg font-bold text-slate-900">Метрики потока</div>
                  {metricsHint && (
                    <div className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${hintClass(metricsHint.tone)}`}>
                      {metricsHint.text}
                    </div>
                  )}
                </div>
                <button
                  className="px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-bold cursor-pointer transition-all duration-200 hover:bg-donezo-light hover:text-donezo-dark hover:border-donezo-primary hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none shadow-sm"
                  onClick={() => void loadMetrics(true, false)}
                  disabled={metricsLoading || !metricsReady}
                >
                  {metricsRefreshLabel}
                </button>
              </div>

              {!resourceStates.metrics.hasEverLoaded ? (
                <div className="text-center py-24 px-6">
                  <div className="text-6xl mb-5 opacity-30">📊</div>
                  <div className="text-xl font-semibold text-gray-700 mb-2">Данные не загружены</div>
                  <div className="text-sm text-gray-400">
                    {metricsEmptyState}
                  </div>
                </div>
              ) : (
                <>
                  <MetricCards
                    ltValues={ltValues}
                    ctValues={ctValues}
                    upstreamValues={upstreamValues}
                    tpWeeks={tpWeeks}
                    wipBuckets={wipBuckets}
                    completedTotal={completedTotal}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                      <h3 className="text-sm font-bold text-gray-700 mb-4">Lead Time по задачам (scatter)</h3>
                      <ScatterChart id="lt" rows={tableRows} field="leadTime" color="#1e5138" values={ltValues} />
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                      <h3 className="text-sm font-bold text-gray-700 mb-4">Dev Cycle Time по задачам (scatter)</h3>
                      <ScatterChart id="ct" rows={tableRows} field="devCycleTime" color="#2c7a51" values={ctValues} />
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                      <h3 className="text-sm font-bold text-gray-700 mb-4">Upstream Time по задачам (scatter)</h3>
                      <ScatterChart id="upstream" rows={tableRows} field="upstreamTime" color="#7c3aed" values={upstreamValues} />
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                      <h3 className="text-sm font-bold text-gray-700 mb-4 text-center">Throughput (задач / неделю)</h3>
                      <ThroughputChart weeks={tpWeeks} />
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center justify-center gap-1.5">
                        Процент прогнозируемости
                      </h3>
                      <PredictabilityWidget data={calcPredictabilityHistory(tableRows, percentile(ctValues, 85), 12)} />
                    </div>
                  </div>

                  <MonteCarlo issues={metricsIssues} queuePreset={queuePreset} />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-auto overflow-hidden">
                      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
                        Upstream Aging WIP{' '}
                        <span className="metric-tooltip">
                          ℹ<span className="tooltip-text">
                            Задачи в аналитике/подготовке. Возраст считается с первого входа в Upstream. Пороги — по Upstream Time P50/P85.
                          </span>
                        </span>
                      </h3>
                      <AgingWIP issues={metricsIssues} bucket="upstream" thresholdValues={upstreamValues} />
                    </div>
                    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-auto overflow-hidden">
                      <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
                        Downstream Aging WIP{' '}
                        <span className="metric-tooltip">
                          ℹ<span className="tooltip-text">
                            Задачи в разработке/тестировании/релизе. Возраст считается с первого входа в Downstream. Пороги — по Dev Cycle Time P50/P85.
                          </span>
                        </span>
                      </h3>
                      <AgingWIP issues={metricsIssues} bucket="downstream" thresholdValues={ctValues} />
                    </div>
                  </div>

                  <IssuesTable rows={tableRows} />
                </>
              )}
            </>
          )}

          <div className={activeTab === 'rice' ? 'block' : 'hidden'}>
            <RiceSection
              n8nBaseUrl={settings.n8nBaseUrl}
              issues={riceIssues}
              loading={resourceStates.rice.status === 'loading'}
              refreshing={resourceStates.rice.isRefreshing}
              error={resourceStates.rice.error}
              lastUpdatedText={riceHint && riceHint.tone !== 'error' ? riceHint.text : null}
              onRefreshFromJira={() => void refreshRiceFromJira()}
              refreshBlocked={riceRefreshBlocked}
              refreshBlockedReason="Сначала сохраните оценки, потом обновите данные из Jira."
              onSendToQueue={(items) => setQueuePreset(items)}
              onSwitchToMetrics={() => setActiveTab('metrics')}
              onDirtyChange={setRiceDirty}
            />
          </div>

          {activeTab === 'issues' && (
            <IssuesTab
              n8nBaseUrl={settings.n8nBaseUrl}
              issues={jiraIssues}
              loading={resourceStates.issues.status === 'loading'}
              refreshing={resourceStates.issues.isRefreshing}
              error={resourceStates.issues.error}
              lastUpdatedText={issuesHint && issuesHint.tone !== 'error' ? issuesHint.text : null}
              onRefresh={() => void loadIssuesList(true)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
