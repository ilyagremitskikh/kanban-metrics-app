import type { Settings as SettingsType, JQLMode } from '../types';

interface Props {
  settings: SettingsType;
  onChange: (s: SettingsType) => void;
  onFetch: () => void;
  loading: boolean;
  loadingLabel: string;
}

const ISSUE_TYPES = ['User Story', 'Задача', 'Ошибка', 'Техдолг'];

const inputCls = 'w-full px-3 py-2 border border-gray-100 rounded-xl text-sm font-semibold outline-none transition-all duration-200 focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light bg-gray-50';
const labelCls = 'block text-xs font-bold text-gray-500 mb-1.5';

export function Settings({ settings, onChange, onFetch, loading, loadingLabel }: Props) {
  const set = (patch: Partial<SettingsType>) => onChange({ ...settings, ...patch });
  const toggleMode = (mode: JQLMode) => set({ mode });

  const toggleType = (t: string) => {
    const types = settings.issueTypes.includes(t)
      ? settings.issueTypes.filter((x) => x !== t)
      : [...settings.issueTypes, t];
    set({ issueTypes: types });
  };

  return (
    <div className="bg-white rounded-3xl p-6 mb-6 shadow-donezo border border-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Настройки</div>
        <div className="flex bg-gray-100 rounded-lg p-1 gap-0.5">
          {(['standard', 'custom'] as JQLMode[]).map((m) => (
            <button
              key={m}
              className={`px-4 py-1.5 rounded-md text-xs font-bold cursor-pointer border-none transition-all duration-200 ${
                settings.mode === m
                  ? 'bg-white text-donezo-dark shadow-sm'
                  : 'bg-transparent text-gray-500 hover:text-gray-900'
              }`}
              onClick={() => toggleMode(m)}
            >
              {m === 'standard' ? 'Стандартный' : 'Свой JQL'}
            </button>
          ))}
        </div>
      </div>

      {/* Top row: URL + dates */}
      <div className="grid grid-cols-1 md:grid-cols-[2fr_140px_140px] gap-3 mb-4">
        <div>
          <label className={labelCls}>n8n Webhook URL</label>
          <input
            type="url"
            className={inputCls}
            value={settings.webhookUrl}
            placeholder="https://n8n.example.com/webhook/kanban-metrics"
            onChange={(e) => set({ webhookUrl: e.target.value })}
          />
        </div>
        <div>
          <label className={labelCls}>Дата с</label>
          <input type="date" className={inputCls} value={settings.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Дата по</label>
          <input type="date" className={inputCls} value={settings.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />
        </div>
      </div>

      {settings.mode === 'standard' ? (
        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelCls}>Проект</label>
            <input
              type="text"
              className={inputCls}
              value={settings.projectKey}
              placeholder="PROJ"
              onChange={(e) => set({ projectKey: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Типы задач</label>
            <div className="flex gap-1.5 flex-wrap pt-0.5">
              {ISSUE_TYPES.map((t) => (
                <label
                  key={t}
                  className={`flex items-center gap-1.5 text-xs font-bold cursor-pointer px-3 py-1.5 rounded-full transition-all duration-200 border select-none hover:-translate-y-0.5 ${
                    settings.issueTypes.includes(t)
                      ? 'bg-donezo-dark text-white border-donezo-dark shadow-md'
                      : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-donezo-primary hover:text-donezo-primary hover:bg-donezo-light'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="hidden"
                    checked={settings.issueTypes.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>
              Доп. условие JQL{' '}
              <span className="text-gray-400 font-normal ml-1">необязательно</span>
            </label>
            <input
              type="text"
              className={inputCls}
              value={settings.extraConditions}
              placeholder="labels = Партнерские_Интеграции"
              onChange={(e) => set({ extraConditions: e.target.value })}
            />
          </div>
          <div>
            <button
              className="px-6 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold shadow-sm cursor-pointer border-none transition-all duration-200 hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none whitespace-nowrap"
              onClick={onFetch}
              disabled={loading}
            >
              {loading ? loadingLabel : 'Загрузить данные'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <label className={labelCls}>JQL-запрос</label>
            <textarea
              rows={2}
              className={`${inputCls} resize-y leading-relaxed`}
              value={settings.customJql}
              placeholder='project = CREDITS AND issuetype in ("User Story", Задача) AND labels = Партнерские_Интеграции ORDER BY created ASC'
              onChange={(e) => set({ customJql: e.target.value })}
            />
          </div>
          <div className="mt-3">
            <button
              className="px-6 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold shadow-sm cursor-pointer border-none transition-all duration-200 hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
              onClick={onFetch}
              disabled={loading}
            >
              {loading ? loadingLabel : 'Загрузить данные'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
