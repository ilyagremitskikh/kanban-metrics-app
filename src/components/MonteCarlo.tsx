import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import {
  runMCItems,
  runMCDate,
  runMCQueue,
  buildMCSamplesFromWeeks,
  calculateEffectiveWip,
  MC_HISTORY_START_DATE,
  type MCResult,
  type QueueItemResult,
} from '../lib/monteCarlo';
import { getDownstreamWipNow, getIssueAgeInActiveBucket, isDownstreamWipIssue } from '../lib/metrics';
import { percentile, fmtNum } from '../lib/utils';
import type { Issue, MCMode, QueueForecastMode, ThroughputWeek } from '../types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SectionCard } from '@/components/ui/admin';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

Chart.register(...registerables);

interface Props {
  issues: Issue[];
  tpWeeks: ThroughputWeek[];
  ctValues: number[];
  queuePreset?: string[] | null;
}

const fmtShort = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
const fmtYear  = (d: Date) => d.toLocaleDateString('ru-RU', { year: 'numeric' });

const MODE_META: Record<MCMode, { label: string; hint: string }> = {
  items: { label: 'N задач → когда?',  hint: 'Введите число задач — получите вероятностные даты завершения' },
  date:  { label: 'К дате → сколько?', hint: 'Выберите дату — узнайте сколько задач успеете закрыть' },
  queue: { label: 'Очередь',           hint: 'Прогноз доставки: когда будут готовы задачи после попадания в очередь разработки?' },
};

const PCT_STYLES = {
  p50: { bg: 'bg-blue-50',   label: 'text-blue-700',  value: 'text-blue-900' },
  p85: { bg: 'bg-amber-50',  label: 'text-amber-700', value: 'text-amber-900' },
  p95: { bg: 'bg-red-50',    label: 'text-red-700',   value: 'text-red-900' },
};

const QUEUE_MODE_META: Record<QueueForecastMode, { label: string; hint: string }> = {
  conservative: { label: 'Осторожный', hint: 'Весь downstream WIP полностью блокирует очередь разработки' },
  realistic: { label: 'Реалистичный', hint: 'Downstream WIP считается частично уже обработанным' },
  agingAware: { label: 'С учётом возраста', hint: 'Downstream WIP взвешивается по возрасту задач в delivery' },
};

export function MonteCarlo({ issues, tpWeeks, ctValues, queuePreset }: Props) {
  const presetQueue = queuePreset && queuePreset.length > 0 ? queuePreset : null;
  const [mode, setMode]             = useState<MCMode>(presetQueue ? 'queue' : 'items');
  const [queueMode, setQueueMode]   = useState<QueueForecastMode>('realistic');
  const [itemCount, setItemCount]   = useState(10);
  const [targetDate, setTargetDate] = useState('');
  const [result, setResult]         = useState<MCResult | null>(null);
  const [queueResult, setQueueResult] = useState<QueueItemResult[] | null>(null);
  const [wipCount, setWipCount]     = useState(() => getDownstreamWipNow(issues));
  const [queueItems, setQueueItems] = useState<string[]>(() => presetQueue ?? ['', '', '']);
  const [error, setError]           = useState('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);
  const historyStartLabel = new Date(MC_HISTORY_START_DATE).toLocaleDateString('ru-RU');

  const switchMode = (m: MCMode) => {
    setMode(m);
    setResult(null);
    setQueueResult(null);
    setError('');
    if (m === 'queue') setWipCount(getDownstreamWipNow(issues));
  };

  const getSamples = () => {
    const samples = buildMCSamplesFromWeeks(tpWeeks);
    if (samples.length < 2) {
      setError(`Недостаточно throughput-данных после ${historyStartLabel}`);
      return null;
    }
    setError('');
    return samples;
  };

  const now = new Date();
  const downstreamP85 = percentile(ctValues, 85);
  const wipAging = issues
    .filter(isDownstreamWipIssue)
    .map((issue) => ({ age: getIssueAgeInActiveBucket(issue, 'downstream', now) }));
  const effectiveWip = calculateEffectiveWip({
    mode: queueMode,
    wipCount,
    downstreamP85,
    wipAging,
  });

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
      setQueueResult(runMCQueue(samples, effectiveWip, named));
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
    <SectionCard title="Прогнозирование (Monte Carlo)" description={`${MODE_META[mode].hint} История throughput с ${historyStartLabel}.`} className="rounded-xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(value) => {
            if (value === 'items' || value === 'date' || value === 'queue') switchMode(value);
          }}
          className="w-fit flex-wrap justify-start rounded-lg bg-muted p-1"
          size="sm"
        >
          {(['items', 'date', 'queue'] as MCMode[]).map((m) => (
            <ToggleGroupItem key={m} value={m} aria-label={MODE_META[m].label} className="px-4 text-sm font-semibold">
              {MODE_META[m].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {mode !== 'queue' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-end gap-3">
            {mode === 'items' ? (
              <div>
                <Label className="mb-2 block">Задач нужно завершить</Label>
                <Input
                  type="number" min={1} value={itemCount}
                  className="w-40 no-spinner"
                  onChange={(e) => setItemCount(Number(e.target.value))}
                />
              </div>
            ) : (
              <div>
                <Label className="mb-2 block">Целевая дата</Label>
                <Input type="date" value={targetDate} className="w-40" onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            )}
            <Button onClick={run}>Рассчитать</Button>
          </div>

          {error && (
            <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
          )}

          {result && (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {([
                  { key: 'p50', label: 'P50', sub: 'вероятность 50%', v: result.p50 },
                  { key: 'p85', label: 'P85', sub: 'вероятность 85%', v: result.p85 },
                  { key: 'p95', label: 'P95', sub: 'вероятность 95%', v: result.p95 },
                ] as const).map(({ key, label, sub, v }) => {
                  const s = PCT_STYLES[key];
                  return (
                    <div key={key} className={`rounded-lg border border-border/60 p-5 ${s.bg}`}>
                      <div className={`mb-0.5 text-sm font-extrabold uppercase ${s.label}`}>{label}</div>
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

      {mode === 'queue' && (
        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr] gap-6 min-h-[360px]">
          <div>
            <div className="mb-4 rounded-lg bg-muted/60 px-4 py-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
                <span>Текущий downstream WIP</span>
                <Badge>{wipCount}</Badge>
              </div>
              <input
                type="range" min={0} max={20} value={wipCount}
                onChange={(e) => setWipCount(Number(e.target.value))}
                className="w-full cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>20</span></div>
              <div className="mt-3 flex items-center justify-between text-xs font-medium text-gray-500">
                <span>Эффективный downstream WIP</span>
                <Badge variant="outline">{fmtNum(effectiveWip)}</Badge>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-border bg-background p-3.5">
              <div className="text-xs font-semibold text-gray-500 mb-2">Режим расчёта</div>
              <ToggleGroup
                type="single"
                value={queueMode}
                onValueChange={(value) => {
                  if (value === 'conservative' || value === 'realistic' || value === 'agingAware') setQueueMode(value);
                }}
                className="w-fit flex-wrap justify-start rounded-lg bg-muted p-1"
                size="sm"
              >
                {(['conservative', 'realistic', 'agingAware'] as QueueForecastMode[]).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    aria-label={QUEUE_MODE_META[value].label}
                    className="px-3 text-xs font-semibold"
                  >
                    {QUEUE_MODE_META[value].label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="mt-2 text-xs text-gray-400 leading-relaxed">{QUEUE_MODE_META[queueMode].hint}</div>
            </div>

            <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-xs font-semibold text-blue-900">Точка обязательства (Commitment point): `Готово к разработке`</div>
              <div className="text-xs text-blue-700 mt-1 leading-relaxed">
                Этот прогноз считает только delivery-часть потока: задачи уже готовы к входу в разработку и стоят в очереди на downstream.
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-500 mb-2">Очередь разработки — порядок приоритетов</div>
            <div className="flex flex-col gap-1.5 mb-2.5 max-h-[240px] overflow-y-auto">
              {queueItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-400 min-w-[20px] w-5 h-5 flex items-center justify-center bg-gray-100 rounded-full flex-shrink-0">{idx + 1}</span>
                  <Input
                    type="text"
                    placeholder={`Задача ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateQueueItem(idx, e.target.value)}
                    className="flex-1"
                  />
                  {queueItems.length > 1 && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="size-6"
                      onClick={() => removeQueueItem(idx)}
                    >×</Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="secondary" onClick={addQueueItem}>+ задача</Button>
              <Button onClick={run}>Рассчитать</Button>
            </div>
            {error && <Alert variant="destructive" className="mt-2.5"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>

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
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Задача</TableHead>
                      <TableHead className="text-blue-600">P50</TableHead>
                      <TableHead className="bg-amber-50/60 text-amber-700">P85</TableHead>
                      <TableHead className="text-red-600">P95</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueResult.map((row, idx) => (
                      <TableRow key={idx} className="group">
                        <TableCell className="text-center text-xs font-bold text-gray-400 group-hover:text-slate-900">{idx + 1}</TableCell>
                        <TableCell className="font-bold text-slate-900">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-blue-700">{fmtShort(row.p50)}</TableCell>
                        <TableCell className="whitespace-nowrap bg-amber-50/60 font-extrabold text-amber-800">{fmtShort(row.p85)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-red-700">{fmtShort(row.p95)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
                  <div className="text-xs font-semibold text-gray-500">
                    P85 — рабочий срок планирования; P50 — оптимистичный сценарий; P95 — защитный хвост
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Прогноз начинается после попадания задачи в очередь разработки (`Готово к разработке`) · Downstream WIP: {wipCount} · Эффективный WIP: {fmtNum(effectiveWip)} · История MC от {historyStartLabel} · Прогноз от {today.toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}
