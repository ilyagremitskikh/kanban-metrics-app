import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { runMCItems, runMCDate, runMCQueue, type MCResult, type QueueItemResult } from '../lib/monteCarlo';
import { buildThroughputWeeksWithZeros } from '../lib/metrics';
import { getWipNow } from '../lib/metrics';
import type { Issue, MCMode, WorkflowConfig } from '../types';

Chart.register(...registerables);

interface Props {
  issues: Issue[];
  workflows: WorkflowConfig[];
  queuePreset?: string[] | null;
}

const fmtShort = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const fmtYear  = (d: Date) => d.toLocaleDateString('ru-RU', { year: 'numeric' });

const MODE_META: Record<MCMode, { label: string; hint: string }> = {
  items: { label: 'N задач → когда?',  hint: 'Введите число задач — получите вероятностные даты завершения' },
  date:  { label: 'К дате → сколько?', hint: 'Выберите дату — узнайте сколько задач успеете закрыть' },
  queue: { label: 'Очередь',           hint: 'Приоритизированный список: когда будет готова каждая задача?' },
};

const PCT_STYLES = {
  p50: { bg: 'bg-blue-50',   label: 'text-blue-700',  value: 'text-blue-900' },
  p85: { bg: 'bg-amber-50',  label: 'text-amber-700', value: 'text-amber-900' },
  p95: { bg: 'bg-red-50',    label: 'text-red-700',   value: 'text-red-900' },
};

const inputCls = 'px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10';
const btnPrimary = 'px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold cursor-pointer border-none transition hover:bg-blue-700 whitespace-nowrap';

export function MonteCarlo({ issues, workflows, queuePreset }: Props) {
  const [mode, setMode]             = useState<MCMode>('items');
  const [itemCount, setItemCount]   = useState(10);
  const [targetDate, setTargetDate] = useState('');
  const [result, setResult]         = useState<MCResult | null>(null);
  const [queueResult, setQueueResult] = useState<QueueItemResult[] | null>(null);
  const [wipCount, setWipCount]     = useState(() => getWipNow(issues, workflows));
  const [queueItems, setQueueItems] = useState<string[]>(['', '', '']);
  const [error, setError]           = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (queuePreset && queuePreset.length > 0) {
      setQueueItems(queuePreset);
      setWipCount(getWipNow(issues, workflows));
      setMode('queue');
      setQueueResult(null);
      setError('');
    }
  }, [queuePreset]); // eslint-disable-line react-hooks/exhaustive-deps

  const switchMode = (m: MCMode) => {
    setMode(m);
    setResult(null);
    setQueueResult(null);
    setError('');
    if (m === 'queue') setWipCount(getWipNow(issues, workflows));
  };

  const getSamples = () => {
    const samples = buildThroughputWeeksWithZeros(issues, workflows);
    if (samples.length < 2) {
      setError('Недостаточно данных (нужно ≥ 2 недель Throughput)');
      return null;
    }
    setError('');
    return samples;
  };

  const run = () => {
    const samples = getSamples();
    if (!samples) return;
    if (mode === 'items') {
      setResult(runMCItems(samples, itemCount));
    } else if (mode === 'date') {
      if (!targetDate) { setError('Выберите дату'); return; }
      setResult(runMCDate(samples, new Date(targetDate)));
    } else {
      const named = queueItems.map((s, i) => s.trim() || `Задача ${i + 1}`);
      setQueueResult(runMCQueue(samples, wipCount, named));
    }
  };

  useEffect(() => {
    if (!result || !canvasRef.current) return;
    chartRef.current?.destroy();
    const { histogram, p50, p85, p95 } = result;
    const labelFn = (v: number) =>
      mode === 'items' ? `${Math.round(v)} нед.` : `${Math.round(v)} зад.`;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: histogram.map((b) => labelFn((b.from + b.to) / 2)),
        datasets: [{
          label: 'Симуляций',
          data: histogram.map((b) => b.count),
          backgroundColor: histogram.map((b) => b.color),
          borderWidth: 0,
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              afterBody: () => [`P50: ${labelFn(p50)}  P85: ${labelFn(p85)}  P95: ${labelFn(p95)}`],
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxTicksLimit: 10 } },
          y: { display: false },
        },
      },
    });
  }, [result, mode]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  const today  = new Date();
  const toDate = (weeks: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + Math.round(weeks) * 7);
    return d;
  };

  const addQueueItem    = () => setQueueItems((p) => [...p, '']);
  const removeQueueItem = (i: number) => setQueueItems((p) => p.filter((_, j) => j !== i));
  const updateQueueItem = (i: number, v: string) =>
    setQueueItems((p) => p.map((x, j) => (j === i ? v : x)));

  return (
    <div className="bg-white rounded-xl px-6 py-5 mb-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Прогноз (Monte Carlo)</div>
          <div className="text-xs text-gray-400">{MODE_META[mode].hint}</div>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {(['items', 'date', 'queue'] as MCMode[]).map((m) => (
            <button
              key={m}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer border-none transition whitespace-nowrap ${
                mode === m ? 'bg-white text-slate-900 shadow-sm' : 'bg-transparent text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => switchMode(m)}
            >
              {MODE_META[m].label}
            </button>
          ))}
        </div>
      </div>

      {/* Items / Date modes */}
      {mode !== 'queue' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-end gap-3">
            {mode === 'items' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Задач нужно завершить</label>
                <input
                  type="number" min={1} value={itemCount}
                  className={`${inputCls} w-40 no-spinner`}
                  onChange={(e) => setItemCount(Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Целевая дата</label>
                <input type="date" value={targetDate} className={`${inputCls} w-40`} onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            )}
            <button className={btnPrimary} onClick={run}>Рассчитать</button>
          </div>

          {error && (
            <div className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>
          )}

          {result && (
            <>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: 'p50', label: 'P50', sub: 'вероятность 50%', v: result.p50 },
                  { key: 'p85', label: 'P85', sub: 'вероятность 85%', v: result.p85 },
                  { key: 'p95', label: 'P95', sub: 'вероятность 95%', v: result.p95 },
                ] as const).map(({ key, label, sub, v }) => {
                  const s = PCT_STYLES[key];
                  return (
                    <div key={key} className={`p-5 rounded-2xl ${s.bg}`}>
                      <div className={`text-sm font-extrabold uppercase tracking-widest mb-0.5 ${s.label}`}>{label}</div>
                      <div className="text-xs text-gray-400 mb-3">{sub}</div>
                      {mode === 'items' ? (
                        <>
                          <div className={`text-2xl font-extrabold leading-tight ${s.value}`}>{fmtShort(toDate(v))}</div>
                          <div className="text-sm text-gray-500 mt-0.5">{fmtYear(toDate(v))}</div>
                        </>
                      ) : (
                        <div className={`text-4xl font-extrabold leading-none ${s.value}`}>
                          {Math.round(v)}<span className="text-base font-medium text-gray-500"> задач</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="relative h-[220px]">
                <canvas ref={canvasRef} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Queue mode */}
      {mode === 'queue' && (
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 min-h-[360px]">
          {/* Left: input */}
          <div>
            <div className="bg-gray-50 rounded-xl px-4 py-3.5 mb-4">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2.5">
                <span>Задач в работе прямо сейчас</span>
                <span className="bg-slate-900 text-white text-sm font-bold px-2.5 py-0.5 rounded-full min-w-[32px] text-center">{wipCount}</span>
              </div>
              <input
                type="range" min={0} max={20} value={wipCount}
                onChange={(e) => setWipCount(Number(e.target.value))}
                className="w-full cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>20</span></div>
            </div>

            <div className="text-xs font-semibold text-gray-500 mb-2">Бэклог — порядок приоритетов</div>
            <div className="flex flex-col gap-1.5 mb-2.5 max-h-[240px] overflow-y-auto">
              {queueItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 min-w-[20px] w-5 h-5 flex items-center justify-center bg-gray-100 rounded-full flex-shrink-0">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`Задача ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateQueueItem(idx, e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-400 transition"
                  />
                  {queueItems.length > 1 && (
                    <button
                      className="w-6 h-6 border-none bg-gray-100 text-gray-400 rounded-md cursor-pointer flex items-center justify-center flex-shrink-0 hover:bg-red-50 hover:text-red-600 transition text-base"
                      onClick={() => removeQueueItem(idx)}
                    >×</button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                className="bg-transparent border border-dashed border-gray-300 rounded-lg px-3.5 py-1.5 text-xs text-gray-500 cursor-pointer hover:border-blue-400 hover:text-blue-500 transition"
                onClick={addQueueItem}
              >+ задача</button>
              <button className={btnPrimary} onClick={run}>Рассчитать</button>
            </div>
            {error && <div className="mt-2.5 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
          </div>

          {/* Right: results */}
          <div className="flex flex-col border-l border-gray-100 pl-6">
            {!queueResult ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
                <div className="text-4xl opacity-30">📋</div>
                <div className="text-sm text-gray-400 text-center leading-relaxed">
                  Заполните список задач<br />и нажмите «Рассчитать»
                </div>
              </div>
            ) : (
              <>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="text-[10px] font-bold uppercase tracking-wider pb-3 pr-3 text-left border-b-2 border-gray-200 w-8 text-gray-400">#</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider pb-3 pr-3 text-left border-b-2 border-gray-200 text-gray-500">Задача</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider pb-3 pr-3 text-left border-b-2 border-gray-200 text-blue-600">P50</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider pb-3 pr-3 text-left border-b-2 border-gray-200 text-amber-600">P85</th>
                      <th className="text-[10px] font-bold uppercase tracking-wider pb-3 text-left border-b-2 border-gray-200 text-red-600">P95</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueResult.map((row, idx) => (
                      <tr key={idx} className="border-b border-gray-100 last:border-none hover:bg-gray-50">
                        <td className="text-gray-400 text-xs font-bold text-center py-2.5 pr-3 align-middle">{idx + 1}</td>
                        <td className="text-slate-900 font-medium py-2.5 pr-3 align-middle">{row.name}</td>
                        <td className="text-blue-700 font-semibold whitespace-nowrap py-2.5 pr-3 align-middle">{fmtShort(row.p50)}</td>
                        <td className="text-amber-700 font-semibold whitespace-nowrap py-2.5 pr-3 align-middle">{fmtShort(row.p85)}</td>
                        <td className="text-red-700 font-semibold whitespace-nowrap py-2.5 align-middle">{fmtShort(row.p95)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-gray-400 mt-4">
                  WIP в расчёте: {wipCount} · Прогноз от {today.toLocaleDateString('ru-RU')}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
