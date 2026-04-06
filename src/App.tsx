import { useState, useCallback } from 'react';
import './App.css';

import { fetchIssues } from './lib/api';
import { detectWorkflows } from './lib/utils';
import { buildTableRows, buildThroughputWeeks, getWipNow, getWipByStatus, buildWipRunChart, buildCFD } from './lib/metrics';
import { useLocalStorage } from './hooks/useLocalStorage';

import { Settings as SettingsPanel } from './components/Settings';
import { StatusBar } from './components/StatusBar';
import { StatusConfig } from './components/StatusConfig';
import { MetricCards } from './components/MetricCards';
import { ScatterChart, ThroughputChart, WipRunChart, CfdChart } from './components/Charts';
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
  const [riceCount, setRiceCount]       = useState<number | null>(null);

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
      setStatus({ msg: '', type: 'hidden' });
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
  const wipRunData     = hasData ? buildWipRunChart(issues, workflows) : [];
  const cfdByWorkflow  = hasData ? workflows.map((wf) => ({
    label: wf.types.join(' / '),
    statuses: wf.statuses.filter((s) => !['Отменена', 'Архив', 'Установлено'].includes(s)),
    ltEnd: wf.ltEnd,
    weeks: buildCFD(issues, wf),
  })) : [];
  const [activeCfdWf, setActiveCfdWf] = useState(0);

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
                Analytics &nbsp;•&nbsp; RICE
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
                <StatusConfig workflows={workflows} onChange={setWorkflows} issueCount={issues.length} />

                <MetricCards
                  ltValues={ltValues} ctValues={ctValues}
                  tpWeeks={tpWeeks} wipByStatus={wipByStatus}
                  wipNow={wipNow} completedTotal={completedTotal}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Lead Time по задачам (scatter)</h3>
                    <ScatterChart id="lt" rows={tableRows} field="leadTime" color="#1e5138" values={ltValues} />
                  </div>
                  <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Cycle Time по задачам (scatter)</h3>
                    <ScatterChart id="ct" rows={tableRows} field="cycleTime" color="#2c7a51" values={ctValues} />
                  </div>
                  <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">Throughput (задач / неделю)</h3>
                    <ThroughputChart weeks={tpWeeks} />
                  </div>
                  <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col h-[400px]">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">WIP (задач в работе / неделю)</h3>
                    <WipRunChart weeks={wipRunData} />
                  </div>
                </div>

                {cfdByWorkflow.length > 0 && (
                  <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 mb-6">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <h3 className="text-sm font-bold text-gray-700">Cumulative Flow Diagram</h3>
                      {cfdByWorkflow.length > 1 && (
                        <div className="flex gap-1">
                          {cfdByWorkflow.map((wf, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveCfdWf(idx)}
                              className={`px-3 py-1 text-xs font-semibold rounded-full transition-all ${
                                activeCfdWf === idx
                                  ? 'bg-donezo-dark text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {wf.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {cfdByWorkflow[activeCfdWf] && (
                      <CfdChart
                        weeks={cfdByWorkflow[activeCfdWf].weeks}
                        statuses={cfdByWorkflow[activeCfdWf].statuses}
                        ltEnd={cfdByWorkflow[activeCfdWf].ltEnd}
                      />
                    )}
                  </div>
                )}

                <MonteCarlo issues={issues} workflows={workflows} queuePreset={queuePreset} />

                <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 mb-6 flex flex-col h-auto overflow-hidden">
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
            onIssuesCountChange={setRiceCount}
          />
        )}

      </div>
    </div>
    </div>
  );
}
