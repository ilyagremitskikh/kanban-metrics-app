import { useState, useCallback } from 'react';
import './App.css';

import { fetchIssues } from './lib/api';
import { detectWorkflows } from './lib/utils';
import { buildTableRows, buildThroughputWeeks, getWipNow, getWipByStatus } from './lib/metrics';
import { useLocalStorage } from './hooks/useLocalStorage';

import { Settings as SettingsPanel } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { StatusConfig } from './components/StatusConfig';
import { MetricCards } from './components/MetricCards';
import { ScatterChart, ThroughputChart } from './components/Charts';
import { MonteCarlo } from './components/MonteCarlo';
import { AgingWIP } from './components/AgingWIP';
import { IssuesTable } from './components/IssuesTable';
import { RiceSection } from './components/RiceSection';

import type { Issue, WorkflowConfig, Settings as SettingsType } from './types';

const today = new Date();
const defaultFrom = new Date(today);
defaultFrom.setMonth(defaultFrom.getMonth() - 3);

const DEFAULT_SETTINGS: SettingsType = {
  webhookUrl: '',
  dateFrom: defaultFrom.toISOString().slice(0, 10),
  dateTo: today.toISOString().slice(0, 10),
  mode: 'standard',
  projectKey: '',
  issueTypes: ['User Story', 'Задача', 'Ошибка', 'Техдолг'],
  extraConditions: '',
  customJql: '',
};

type AppTab     = 'metrics' | 'rice' | 'settings';
type StatusType = 'hidden' | 'info' | 'error' | 'success';

const TABS: { id: AppTab; label: string }[] = [
  { id: 'metrics',  label: 'Метрики' },
  { id: 'rice',     label: 'RICE' },
  { id: 'settings', label: 'Настройки' },
];

export default function App() {
  const [settings, setSettings]   = useLocalStorage<SettingsType>('km_settings', DEFAULT_SETTINGS);
  const [workflows, setWorkflows] = useLocalStorage<WorkflowConfig[]>('km_workflows', []);

  const [activeTab, setActiveTab]       = useState<AppTab>('settings');
  const [issues, setIssues]             = useState<Issue[]>([]);
  const [queuePreset, setQueuePreset]   = useState<string[] | null>(null);
  const [status, setStatus]             = useState<{ msg: string; type: StatusType }>({ msg: '', type: 'hidden' });
  const [loading, setLoading]           = useState(false);
  const [loadingLabel, setLoadingLabel] = useState('Загрузить данные');
  const [hasData, setHasData]           = useState(false);

  const applyWorkflows = useCallback((loaded: Issue[]) => {
    setWorkflows(detectWorkflows(loaded));
  }, [setWorkflows]);

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
      setStatus({ msg: `Загружено ${loaded.length} задач`, type: 'success' });
      applyWorkflows(loaded);
      setHasData(true);
      setActiveTab('metrics');
    } catch (err) {
      setStatus({ msg: `Ошибка: ${(err as Error).message}`, type: 'error' });
    } finally {
      setLoading(false);
      setLoadingLabel('Загрузить данные');
    }
  };

  const tableRows      = hasData ? buildTableRows(issues, workflows) : [];
  const ltValues       = tableRows.filter((r) => r.leadTime  !== null).map((r) => r.leadTime  as number);
  const ctValues       = tableRows.filter((r) => r.cycleTime !== null).map((r) => r.cycleTime as number);
  const tpWeeks        = hasData ? buildThroughputWeeks(issues, workflows) : [];
  const wipNow         = hasData ? getWipNow(issues, workflows) : 0;
  const wipByStatus    = hasData ? getWipByStatus(issues, workflows) : {};
  const completedTotal = tableRows.filter((r) => r.completedAt !== null).length;

  return (
    <>
      {/* ── Header ── */}
      <div className="bg-slate-900 text-white px-7 py-4 flex items-center gap-4">
        <div>
          <div className="text-lg font-bold tracking-tight">Kanban Metrics</div>
          <div className="text-xs text-white/40 mt-0.5 tracking-widest font-medium">
            LEAD TIME &nbsp;·&nbsp; CYCLE TIME &nbsp;·&nbsp; WIP &nbsp;·&nbsp; THROUGHPUT &nbsp;·&nbsp; RICE
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-[100] shadow-sm">
        <div className="max-w-[1440px] mx-auto px-6 flex gap-0.5">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm border-none bg-transparent cursor-pointer border-b-2 -mb-px transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'text-slate-900 border-b-blue-500 font-semibold'
                  : 'text-gray-500 border-b-transparent font-medium hover:text-gray-800'
              }`}
              onClick={() => setActiveTab(id)}
            >
              {label}
              {id === 'metrics' && hasData && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  activeTab === id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {issues.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Global status bar ── */}
      <div className="max-w-[1440px] mx-auto px-6">
        <StatusBar message={status.msg} type={status.type} />
      </div>

      {/* ── Tab content ── */}
      <div className="max-w-[1440px] mx-auto px-6 py-6">

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
                <StatusConfig workflows={workflows} onChange={setWorkflows} issueCount={issues.length} />

                <MetricCards
                  ltValues={ltValues} ctValues={ctValues}
                  tpWeeks={tpWeeks} wipByStatus={wipByStatus}
                  wipNow={wipNow} completedTotal={completedTotal}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                  <div className="bg-white rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Lead Time по задачам (scatter)</h3>
                    <ScatterChart id="lt" rows={tableRows} field="leadTime" color="#3b82f6" values={ltValues} />
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Cycle Time по задачам (scatter)</h3>
                    <ScatterChart id="ct" rows={tableRows} field="cycleTime" color="#8b5cf6" values={ctValues} />
                  </div>
                  <div className="bg-white rounded-xl p-5 shadow-sm">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Throughput (задач / неделю)</h3>
                    <ThroughputChart weeks={tpWeeks} />
                  </div>
                </div>

                <MonteCarlo issues={issues} workflows={workflows} queuePreset={queuePreset} />

                <div className="bg-white rounded-xl p-5 shadow-sm mb-5">
                  <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-1.5">
                    Aging WIP{' '}
                    <span className="metric-tooltip">
                      ℹ<span className="tooltip-text">
                        Текущие задачи в работе, упорядоченные по времени в работе (дней с момента взятия в ctStart). Зелёный — до P50 CT, жёлтый — до P85, красный — выше P85.
                      </span>
                    </span>
                  </h3>
                  <AgingWIP issues={issues} workflows={workflows} ctValues={ctValues} />
                </div>

                <IssuesTable rows={tableRows} />
              </>
            )}
          </>
        )}

        {activeTab === 'rice' && (
          <RiceSection
            webhookUrl={settings.webhookUrl}
            onSendToQueue={(items) => setQueuePreset(items)}
            onSwitchToMetrics={() => setActiveTab('metrics')}
          />
        )}

      </div>
    </>
  );
}
