import { useState, useEffect } from 'react';
import type {
  Issue,
  CalculatedMetrics,
  WorkflowConfig,
  Settings,
  AIWipResponse,
  AIBottlenecksResponse,
  AICache,
} from '../types';
import { prepareWipPayload, prepareBottlenecksPayload } from '../lib/ai-helper';

interface Props {
  issues: Issue[];
  metrics: CalculatedMetrics;
  workflows: WorkflowConfig[];
  settings: Settings;
}

export function AIAgentTab({ issues, metrics, workflows, settings }: Props) {
  const [wipCache, setWipCache] = useState<AICache<AIWipResponse> | null>(null);
  const [btnCache, setBtnCache] = useState<AICache<AIBottlenecksResponse> | null>(null);
  const [loadingWip, setLoadingWip] = useState(false);
  const [loadingBtn, setLoadingBtn] = useState(false);
  const [errorWip, setErrorWip] = useState<string | null>(null);
  const [errorBtn, setErrorBtn] = useState<string | null>(null);

  useEffect(() => {
    const rawWip = localStorage.getItem('ai_wip_cache');
    const rawBtn = localStorage.getItem('ai_btn_cache');

    if (rawWip) {
      try {
        const parsed = JSON.parse(rawWip);
        // 24h expiration
        if (Date.now() - parsed.timestamp < 86400000) setWipCache(parsed);
      } catch (e) {}
    }
    if (rawBtn) {
      try {
        const parsed = JSON.parse(rawBtn);
        if (Date.now() - parsed.timestamp < 86400000) setBtnCache(parsed);
      } catch (e) {}
    }
  }, []);

  const handleWipCalc = async () => {
    if (!settings.aiWebhookUrl) {
      setErrorWip('Пожалуйста, укажите AI Webhook URL в настройках');
      return;
    }
    setLoadingWip(true);
    setErrorWip(null);

    try {
      const payload = prepareWipPayload(issues, metrics, workflows);
      const res = await fetch(settings.aiWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Ошибка сети при запросе к AI');

      const rawText = await res.text();
      if (!rawText) throw new Error('n8n вернул пустой ответ. Проверьте логи workflow.');
      
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        throw new Error('n8n вернул неформатированный ответ вместо JSON. Проверьте Code ноду в n8n.');
      }
      
      if (Array.isArray(data) && data[0]?.output) {
        data = data[0].output;
      } else if (Array.isArray(data) && data[0]) {
        data = data[0];
      }

      if (data?.error) throw new Error(data.error);

      const cacheVal: AICache<AIWipResponse> = { timestamp: Date.now(), data };

      setWipCache(cacheVal);
      localStorage.setItem('ai_wip_cache', JSON.stringify(cacheVal));
    } catch (err: any) {
      setErrorWip(err.message || 'Произошла ошибка при обращении к ИИ');
    } finally {
      setLoadingWip(false);
    }
  };

  const handleBtnCalc = async () => {
    if (!settings.aiWebhookUrl) {
      setErrorBtn('Пожалуйста, укажите AI Webhook URL в настройках');
      return;
    }
    setLoadingBtn(true);
    setErrorBtn(null);

    try {
      const payload = prepareBottlenecksPayload(issues, workflows);
      const res = await fetch(settings.aiWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Ошибка сети при запросе к AI');

      const rawText = await res.text();
      if (!rawText) throw new Error('n8n вернул пустой ответ. Проверьте логи workflow.');
      
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch (err) {
        throw new Error('n8n вернул неформатированный ответ вместо JSON. Проверьте Code ноду в n8n.');
      }
      
      if (Array.isArray(data) && data[0]?.output) {
        data = data[0].output;
      } else if (Array.isArray(data) && data[0]) {
        data = data[0];
      }

      if (data?.error) throw new Error(data.error);

      const cacheVal: AICache<AIBottlenecksResponse> = { timestamp: Date.now(), data };

      setBtnCache(cacheVal);
      localStorage.setItem('ai_btn_cache', JSON.stringify(cacheVal));
    } catch (err: any) {
      setErrorBtn(err.message || 'Произошла ошибка при обращении к ИИ');
    } finally {
      setLoadingBtn(false);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString('ru-RU');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-extrabold text-donezo-dark tracking-tight mb-2">
            ИИ-Аналитика
          </h2>
          <p className="text-gray-500 font-medium">Анализ потока задач с использованием ИИ.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Dynamic WIP Limits Panel */}
        <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-donezo-dark">WIP-Лимиты</h3>
              <p className="text-sm text-gray-500 mt-1">
                Расчет оптимальных лимитов по закону Литтла
              </p>
            </div>
            <button
              onClick={handleWipCalc}
              disabled={loadingWip}
              className="px-5 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold shadow-sm hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:transform-none transition-all"
            >
              {loadingWip ? 'Анализ...' : 'Рассчитать ИИ'}
            </button>
          </div>

          {errorWip && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-semibold border border-red-100">
              {errorWip}
            </div>
          )}

          {wipCache && !errorWip ? (
            <div className="flex flex-col flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-donezo-light bg-opacity-20 p-4 rounded-2xl border border-donezo-light">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    Глобальный лимит
                  </div>
                  <div className="text-3xl font-extrabold text-donezo-dark">
                    {wipCache.data.globalLimit}
                  </div>
                </div>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                    По колонкам
                  </div>
                  <div className="space-y-1.5">
                    {Object.entries(wipCache.data.limits || {}).map(([status, limit]) => (
                      <div key={status} className="flex justify-between text-sm font-bold">
                        <span className="text-gray-600">{status}</span>
                        <span className="text-donezo-dark bg-white px-2 py-0.5 rounded-md shadow-sm">
                          {limit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 bg-blue-50/50 p-5 rounded-2xl border border-blue-100 mt-auto">
                <div className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-2">
                  Совет ИИ
                </div>
                <div className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {wipCache.data.advice}
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-400 text-right mt-2">
                Анализ от: {formatDate(wipCache.timestamp)}
              </div>
            </div>
          ) : (
            !loadingWip && !errorWip && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <div className="text-4xl mb-3">⚖️</div>
                <div className="text-gray-400 font-medium">Нажмите кнопку для расчета</div>
              </div>
            )
          )}
        </div>

        {/* Bottleneck Analysis Panel */}
        <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-donezo-dark">Узкие места</h3>
              <p className="text-sm text-gray-500 mt-1">Очереди и стареющие задачи</p>
            </div>
            <button
              onClick={handleBtnCalc}
              disabled={loadingBtn}
              className="px-5 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold shadow-sm hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:transform-none transition-all"
            >
              {loadingBtn ? 'Анализ...' : 'Рассчитать ИИ'}
            </button>
          </div>

          {errorBtn && (
            <div className="mb-4 p-4 rounded-xl bg-red-50 text-red-600 text-sm font-semibold border border-red-100">
              {errorBtn}
            </div>
          )}

          {btnCache && !errorBtn ? (
            <div className="flex flex-col flex-1 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <div className="text-xs font-bold text-orange-600 uppercase tracking-widest mb-2">
                    Статусы (Заторы)
                  </div>
                  {btnCache.data.bottlenecks?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {btnCache.data.bottlenecks.map((b) => (
                        <span
                          key={b}
                          className="px-2.5 py-1 bg-white text-orange-700 text-xs font-bold rounded-md shadow-sm border border-orange-100"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-orange-400 text-sm font-medium">Заторов не найдено</span>
                  )}
                </div>

                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <div className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">
                    Алерт старения (P85)
                  </div>
                  {btnCache.data.agingAlerts?.length ? (
                    <div className="space-y-1.5">
                      {btnCache.data.agingAlerts.map((a, idx) => (
                        <div key={idx} className="text-xs font-bold text-red-700 bg-white px-2 py-1.5 rounded-md shadow-sm border border-red-100">
                          {a}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-red-400 text-sm font-medium">Нет застрявших задач</span>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-donezo-light bg-opacity-20 p-5 rounded-2xl border border-donezo-light mt-auto">
                <div className="text-xs font-bold text-donezo-dark uppercase tracking-widest mb-2">
                  Совет ИИ
                </div>
                <div className="text-sm font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {btnCache.data.advice}
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-400 text-right mt-2">
                Анализ от: {formatDate(btnCache.timestamp)}
              </div>
            </div>
          ) : (
            !loadingBtn && !errorBtn && (
              <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
                <div className="text-4xl mb-3">🔍</div>
                <div className="text-gray-400 font-medium">Нажмите кнопку для поиска заторов</div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
