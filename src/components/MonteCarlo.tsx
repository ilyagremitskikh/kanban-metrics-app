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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  p50: { bg: 'bg-slate-50', label: 'text-slate-600', value: 'text-slate-900' },
  p85: { bg: 'bg-amber-50/70', label: 'text-amber-700', value: 'text-amber-900' },
  p95: { bg: 'bg-rose-50/80', label: 'text-rose-700', value: 'text-rose-900' },
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
      setError(`Недостаточно throughput-данных после ${new Date(MC_HISTORY_START_DATE).toLocaleDateString('ru-RU')}`);
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
    <SectionCard title="Прогнозирование (Monte Carlo)" description={MODE_META[mode].hint} className="rounded-xl">
      <Tabs
        value={mode}
        onValueChange={(value) => {
          if (value === 'items' || value === 'date' || value === 'queue') switchMode(value);
        }}
        className="mb-6 gap-0"
      >
        <TabsList className="h-auto w-fit flex-wrap justify-start">
          {(['items', 'date', 'queue'] as MCMode[]).map((m) => (
            <TabsTrigger key={m} value={m} className="px-4 text-sm">
              {MODE_META[m].label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {mode !== 'queue' && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-muted/15 p-3.5">
            {mode === 'items' ? (
              <div className="min-w-[220px] flex-1">
                <Label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Задач нужно завершить</Label>
                <Input
                  type="number" min={1} value={itemCount}
                  className="h-9 w-full max-w-[220px] no-spinner"
                  onChange={(e) => setItemCount(Number(e.target.value))}
                />
              </div>
            ) : (
              <div className="min-w-[220px] flex-1">
                <Label className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Целевая дата</Label>
                <Input type="date" value={targetDate} className="h-9 w-full max-w-[220px]" onChange={(e) => setTargetDate(e.target.value)} />
              </div>
            )}
            <Button onClick={run} className="min-w-[120px]">Рассчитать</Button>
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
                      <div className="mb-3 text-xs text-muted-foreground">{sub}</div>
                      {mode === 'items' ? (
                        <>
                          <div className={`text-2xl font-extrabold leading-tight tabular-nums ${s.value}`}>{fmtShort(toDate(v))}</div>
                          <div className="mt-0.5 text-sm text-muted-foreground">{fmtYear(toDate(v))}</div>
                        </>
                      ) : (
                        <div className={`text-4xl font-extrabold leading-none tabular-nums ${s.value}`}>
                          {Math.round(v)}<span className="text-base font-medium text-muted-foreground"> задач</span>
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
            <div className="mb-4 rounded-lg bg-muted/20 px-4 py-3.5">
              <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Текущий downstream WIP</span>
                <Badge variant="secondary" className="tabular-nums">{wipCount}</Badge>
              </div>
              <input
                type="range" min={0} max={20} value={wipCount}
                onChange={(e) => setWipCount(Number(e.target.value))}
                className="w-full cursor-pointer accent-slate-500"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground"><span>0</span><span>20</span></div>
              <div className="mt-3 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Эффективный downstream WIP</span>
                <Badge variant="outline" className="tabular-nums">{fmtNum(effectiveWip)}</Badge>
              </div>
            </div>

            <div className="mb-4 rounded-lg bg-background p-3.5">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Режим расчёта</div>
              <Tabs
                value={queueMode}
                onValueChange={(value) => {
                  if (value === 'conservative' || value === 'realistic' || value === 'agingAware') setQueueMode(value);
                }}
                className="gap-2"
              >
                <TabsList className="h-auto w-fit flex-wrap justify-start">
                {(['conservative', 'realistic', 'agingAware'] as QueueForecastMode[]).map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="px-3 text-xs"
                  >
                    {QUEUE_MODE_META[value].label}
                  </TabsTrigger>
                ))}
                </TabsList>
              </Tabs>
              <div className="mt-2 text-xs leading-relaxed text-muted-foreground">{QUEUE_MODE_META[queueMode].hint}</div>
            </div>

            <div className="mb-4 rounded-lg bg-muted/15 px-4 py-3">
              <div className="text-xs font-semibold text-foreground">Точка обязательства (Commitment point): `Готово к разработке`</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Этот прогноз считает только delivery-часть потока: задачи уже готовы к входу в разработку и стоят в очереди на downstream.
              </div>
            </div>

            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Очередь разработки</div>
            <div className="mb-2.5 flex max-h-[240px] flex-col gap-1.5 overflow-y-auto">
              {queueItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 min-w-[24px] flex-shrink-0 items-center justify-center rounded-md border border-border/60 bg-muted/20 text-xs font-medium text-muted-foreground">{idx + 1}</span>
                  <Input
                    type="text"
                    placeholder={`Задача ${idx + 1}`}
                    value={item}
                    onChange={(e) => updateQueueItem(idx, e.target.value)}
                    className="flex-1"
                  />
                  {queueItems.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-muted-foreground"
                      onClick={() => removeQueueItem(idx)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="ghost" onClick={addQueueItem}>+ задача</Button>
              <Button onClick={run}>Рассчитать</Button>
            </div>
            {error && <Alert variant="destructive" className="mt-2.5"><AlertDescription>{error}</AlertDescription></Alert>}
          </div>

          <div className="flex flex-col border-t border-border/60 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {!queueResult ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2.5">
                <div className="text-4xl opacity-30">📋</div>
                <div className="text-center text-sm leading-relaxed text-muted-foreground">
                  Заполните список задач<br />и нажмите «Рассчитать»
                </div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/40 bg-muted/15 hover:bg-transparent">
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Задача</TableHead>
                      <TableHead className="text-slate-600">P50</TableHead>
                      <TableHead className="text-amber-700">P85</TableHead>
                      <TableHead className="text-rose-700">P95</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueResult.map((row, idx) => (
                      <TableRow key={idx} className="group border-border/40 hover:bg-muted/50">
                        <TableCell className="text-center text-xs font-medium text-muted-foreground tabular-nums group-hover:text-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-slate-700 tabular-nums">{fmtShort(row.p50)}</TableCell>
                        <TableCell className="whitespace-nowrap font-semibold text-amber-800 tabular-nums">{fmtShort(row.p85)}</TableCell>
                        <TableCell className="whitespace-nowrap font-medium text-rose-700 tabular-nums">{fmtShort(row.p95)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 rounded-lg border border-border/60 bg-muted/15 px-4 py-3">
                  <div className="text-xs font-semibold text-foreground/80">
                    P85 — рабочий срок планирования; P50 — оптимистичный сценарий; P95 — защитный хвост
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Прогноз начинается после попадания задачи в очередь разработки (`Готово к разработке`) · Downstream WIP: {wipCount} · Эффективный WIP: {fmtNum(effectiveWip)} · История MC от {new Date(MC_HISTORY_START_DATE).toLocaleDateString('ru-RU')} · Прогноз от {today.toLocaleDateString('ru-RU')}
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
