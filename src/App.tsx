import { useState } from 'react';
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

import type { Issue, ThroughputWeek, Settings as SettingsType } from './types';

const DEFAULT_SETTINGS: SettingsType = {
  webhookUrl: '',
  mode: 'standard',
  projectKey: '',
  issueTypes: ['User Story', 'Задача', 'Ошибка', 'Техдолг'],
  customJql: '',
};

type AppTab     = 'metrics' | 'rice' | 'settings';
type StatusType = 'hidden' | 'info' | 'error' | 'success';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'metrics',  label: 'Метрики' },
  { id: 'rice',     label: 'Scoring' },
  { id: 'settings', label: 'Настройки' },
];

export default function App() {
  const [settings, setSettings] = useLocalStorage<SettingsType>('km_settings', DEFAULT_SETTINGS);

  const [activeTab, setActiveTab]       = useState<AppTab>('settings');
  const [issues, setIssues]             = useState<Issue[]>([]);
  const [queuePreset, setQueuePreset]   = useState<string[] | null>(null);
  const [status, setStatus]             = useState<{ msg: string; type: StatusType }>({ msg: '', type: 'hidden' });
  const [loading, setLoading]           = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Загрузить данные');
  const [hasData, setHasData]           = useState(false);
  const [riceCount, setRiceCount]       = useState<number | null>(null);
  const [tpWeeksRaw, setTpWeeksRaw]     = useState<ThroughputWeek[] | null>(null);

  const handleFetch = async () => {
    if (!settings.webhookUrl) { setStatus({ msg: 'Укажите n8n Webhook URL', type: 'error' }); return; }
    if (settings.mode === 'standard' && !settings.projectKey) { setStatus({ msg: 'Укажите ключ проекта Jira', type: 'error' }); return; }
    if (settings.mode === 'standard' && !settings.issueTypes.length) { setStatus({ msg: 'Выберите хотя бы один тип задач', type: 'error' }); return; }
    if (settings.mode === 'custom' && !settings.customJql.trim()) { setStatus({ msg: 'Введите JQL-запрос', type: 'error' }); return; }

    setLoading(true);
    try {
      const loaded = await fetchIssues(settings, (msg) => {
        setStatus({ msg, type: 'info' });
        setLoadingLabel(msg.split('…')[0] || 'Загрузка…');
      });
      setIssues(loaded);
      setStatus({ msg: '', type: 'hidden' });

      if (settings.throughputWebhookUrl) {
        try {
          const rawItems = await fetchThroughputRaw(settings, (msg) => setStatus({ msg, type: 'info' }));
          setTpWeeksRaw(buildThroughputWeeksFromRaw(rawItems));
        } catch (err) {
          console.warn('Throughput webhook failed, falling back:', err);
          setTpWeeksRaw(null);
        }
        setStatus({ msg: '', type: 'hidden' });
      } else {
        setTpWeeksRaw(null);
      }

      setHasData(true);
      setActiveTab('metrics');
    } catch (err) {
      setStatus({ msg: `Ошибка: ${(err as Error).message}`, type: 'error' });
    } finally {
      setLoading(false);
      setLoadingLabel('Загрузить данные');
    }
  };

  const tableRows      = hasData ? buildTableRows(issues) : [];
  const ltValues       = tableRows.filter((r) => r.leadTime      !== null).map((r) => r.leadTime      as number);
  const ctValues       = tableRows.filter((r) => r.devCycleTime  !== null).map((r) => r.devCycleTime  as number);
  const upstreamValues = tableRows.filter((r) => r.upstreamTime  !== null).map((r) => r.upstreamTime  as number);
  const tpWeeksFallback = hasData ? buildThroughputWeeks(issues) : [];
  const tpWeeks         = tpWeeksRaw ?? tpWeeksFallback;
  const wipBuckets      = hasData ? getWipBuckets(issues) : { upstream: {}, downstream: {} };
  const completedTotal  = tableRows.filter((r) => r.completedAt !== null).length;

  return (
    <div className="min-h-screen bg-donezo-bg font-sans p-4 md:p-6 lg:p-8 flex items-center justify-center">
      <div className="max-w-[1500px] w-full bg-donezo-bg flex flex-col gap-6">

        {/* ── Header & Tab bar ── */}
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
                {id === 'metrics' && hasData && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center justify-center ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {issues.length}
                  </span>
                )}
                {id === 'rice' && riceCount !== null && riceCount > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full leading-none flex items-center justify-center ${
                    activeTab === id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {riceCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Global status bar ── */}
        <div className="w-full">
          <StatusBar message={status.msg} type={status.type} />
        </div>

        {/* ── Tab content ── */}
        <div className="bg-white rounded-[32px] p-6 shadow-donezo border border-gray-100/50 min-h-[70vh]">

        {activeTab === 'settings' && (
          <SettingsPanel
            settings={settings}
            onChange={setSettings}
            onFetch={handleFetch}
            loading={loading}
            loadingLabel={loadingLabel}
          />
        )}

        {activeTab === 'metrics' && (
          <>
            {!hasData ? (
              <div className="text-center py-24 px-6">
                <div className="text-6xl mb-5 opacity-30">📊</div>
                <div className="text-xl font-semibold text-gray-700 mb-2">Данные не загружены</div>
                <div className="text-sm text-gray-400">
                  Перейдите в{' '}
                  <button
                    className="text-blue-500 underline bg-transparent border-none cursor-pointer text-sm p-0 hover:text-blue-700"
                    onClick={() => setActiveTab('settings')}
                  >
                    Настройки
                  </button>
                  {' '}и нажмите «Загрузить данные»
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

                <MonteCarlo issues={issues} queuePreset={queuePreset} />

                {/* ── Aging WIP (split Upstream / Downstream) ── */}
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
                    <AgingWIP issues={issues} bucket="upstream" thresholdValues={upstreamValues} />
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
                    <AgingWIP issues={issues} bucket="downstream" thresholdValues={ctValues} />
                  </div>
                </div>

                <IssuesTable rows={tableRows} />
              </>
            )}
          </>
        )}

        <div className={activeTab === 'rice' ? 'block' : 'hidden'}>
          <RiceSection
            webhookUrl={settings.webhookUrl}
            onSendToQueue={(items) => setQueuePreset(items)}
            onSwitchToMetrics={() => setActiveTab('metrics')}
            onIssuesCountChange={setRiceCount}
          />
        </div>

      </div>
    </div>
    </div>
  );
}
