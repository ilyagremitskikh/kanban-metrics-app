import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { PredictabilityResult } from '../lib/metrics';
import { fmtWeekLabel } from '../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

Chart.register(...registerables);

interface Props {
  data: PredictabilityResult | null;
}

// ─── Colour helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number): { text: string; bg: string; ring: string } {
  if (score >= 75) return { text: '#16a34a', bg: '#f0fdf4', ring: '#bbf7d0' };
  if (score >= 50) return { text: '#d97706', bg: '#fffbeb', ring: '#fde68a' };
  return             { text: '#dc2626', bg: '#fef2f2', ring: '#fecaca' };
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Высокая';
  if (score >= 50) return 'Средняя';
  return                  'Низкая';
}

// ─── Sparkline ─────────────────────────────────────────────────────────────────

function Sparkline({ history, color }: { history: PredictabilityResult['history']; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  // Show last 16 points max
  const pts = history.slice(-16);

  useEffect(() => {
    if (!canvasRef.current || !pts.length) return;
    chartRef.current?.destroy();

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: pts.map((p) => fmtWeekLabel(p.date)),
        datasets: [
          {
            data: pts.map((p) => p.score),
            borderColor: color,
            borderWidth: 2,
            pointRadius: pts.length <= 8 ? 3 : 0,
            pointHoverRadius: 5,
            pointBackgroundColor: color,
            fill: true,
            backgroundColor: color + '22',
            tension: 0.35,
          },
          // Benchmark line at 70%
          {
            data: pts.map(() => 70),
            borderColor: '#9ca3af',
            borderWidth: 1,
            borderDash: [4, 4],
            pointRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 400 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => {
                if (item.datasetIndex === 1) return 'Benchmark: 70%';
                const pt = pts[item.dataIndex];
                return [
                  `Прогнозируемость: ${item.parsed.y}%`,
                  `CV: ${pt.cv}`,
                  `Выборка: ${pt.n} задач`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            display: true,
            ticks: {
              maxTicksLimit: 5,
              font: { size: 10 },
              color: '#9ca3af',
              maxRotation: 0,
            },
            grid: { display: false },
            border: { display: false },
          },
          y: {
            display: true,
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              font: { size: 10 },
              color: '#9ca3af',
              callback: (v) => `${v}%`,
            },
            grid: { color: '#f3f4f6' },
            border: { display: false },
          },
        },
      },
    });
  }, [history, color, pts]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  return <div className="relative" style={{ height: '130px' }}><canvas ref={canvasRef} /></div>;
}

// ─── Trend badge ───────────────────────────────────────────────────────────────

function TrendBadge({ history }: { history: PredictabilityResult['history'] }) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2].score;
  const curr = history[history.length - 1].score;
  const diff = curr - prev;
  if (Math.abs(diff) < 1) {
    return <Badge variant="outline">стабильно</Badge>;
  }
  const up = diff > 0;
  return (
    <Badge variant={up ? 'success' : 'destructive'}>
      {up ? '▲' : '▼'} {Math.abs(diff)}%
    </Badge>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────────

export function PredictabilityWidget({ data }: Props) {
  if (!data) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <div className="mb-3 text-4xl opacity-30">📉</div>
        <p className="text-sm">Недостаточно данных</p>
        <p className="mt-1 text-xs text-slate-300">Нужно ≥ 2 завершённых задачи с Cycle Time</p>
      </div>
    );
  }

  const { score, cv, meanCT, stdDev, sleHitRate, history, n } = data;
  const { text: scoreTextColor, bg: scoreBg, ring: scoreRing } = scoreColor(score);

  return (
    <div className="flex flex-col h-full gap-3">
      <div className="flex items-start gap-4">
        <div
          className="flex shrink-0 flex-col items-center justify-center rounded-xl px-4 py-3"
          style={{ background: scoreBg, border: `2px solid ${scoreRing}` }}
        >
          <div className="flex items-end leading-none gap-1">
            <span className="text-4xl font-semibold tabular-nums" style={{ color: scoreTextColor }}>
              {score}
            </span>
            <span className="mb-0.5 text-xl font-semibold" style={{ color: scoreTextColor }}>%</span>
          </div>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: scoreTextColor }}>
            {scoreLabel(score)}
          </span>
        </div>

        <div className="min-w-0 flex flex-col gap-1.5 text-xs text-slate-600">
          <div className="flex items-center">
            <span className="mr-2 text-muted-foreground">Тренд</span>
            <TrendBadge history={history} />
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">SLE Hit Rate</span>
            <span
              className="font-semibold tabular-nums"
              style={{ color: sleHitRate >= 80 ? '#16a34a' : sleHitRate >= 60 ? '#d97706' : '#dc2626' }}
            >
              {sleHitRate}%
            </span>
            <span className="text-[10px] text-slate-300">(P85)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">Средний CT</span>
            <span className="font-semibold tabular-nums">{meanCT}д</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground">StdDev</span>
            <span className="font-semibold tabular-nums">{stdDev}д</span>
            <span className="text-slate-300">·</span>
            <span className="text-muted-foreground">CV</span>
            <span className="font-semibold tabular-nums">{cv}</span>
          </div>

          <div className="text-[10px] text-slate-300">
            выборка: {n} задач · окно 12 нед.
          </div>
        </div>

        <div className="ml-auto shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-flex size-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground">
                ℹ
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[220px]">
              <strong>Формула:</strong> Score = max(0, 100 − CV × 25)<br />
              CV = σ(CT) / μ(CT)<br /><br />
              Скользящее окно: 12 недель.<br />
              <strong>SLE Hit Rate</strong> — % задач завершившихся ≤ P85.<br />
              70% — benchmark зрелой команды.
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <Sparkline history={history} color={scoreTextColor} />
      </div>
    </div>
  );
}
