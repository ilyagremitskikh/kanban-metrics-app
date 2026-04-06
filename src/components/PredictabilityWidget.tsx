import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import type { PredictabilityResult } from '../lib/metrics';
import { fmtWeekLabel } from '../lib/utils';

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
    return <span className="text-xs font-semibold text-gray-400 ml-2">→ стабильно</span>;
  }
  const up = diff > 0;
  return (
    <span
      className="text-xs font-bold ml-2"
      style={{ color: up ? '#16a34a' : '#dc2626' }}
    >
      {up ? '▲' : '▼'} {Math.abs(diff)}%
    </span>
  );
}

// ─── Main widget ───────────────────────────────────────────────────────────────

export function PredictabilityWidget({ data }: Props) {
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-10 text-gray-400">
        <div className="text-4xl mb-3 opacity-30">📉</div>
        <p className="text-sm">Недостаточно данных</p>
        <p className="text-xs mt-1 text-gray-300">Нужно ≥ 2 завершённых задачи с Cycle Time</p>
      </div>
    );
  }

  const { score, cv, meanCT, stdDev, sleHitRate, history, n } = data;
  const { text: scoreTextColor, bg: scoreBg, ring: scoreRing } = scoreColor(score);

  return (
    <div className="flex flex-col h-full gap-3">

      {/* ── Top row: big score + stats ── */}
      <div className="flex items-start gap-4">

        {/* Score pill */}
        <div
          className="flex flex-col items-center justify-center rounded-2xl px-5 py-3 shrink-0"
          style={{ background: scoreBg, border: `2px solid ${scoreRing}` }}
        >
          <div className="flex items-end leading-none gap-1">
            <span className="text-4xl font-extrabold tabular-nums" style={{ color: scoreTextColor }}>
              {score}
            </span>
            <span className="text-xl font-bold mb-0.5" style={{ color: scoreTextColor }}>%</span>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: scoreTextColor }}>
            {scoreLabel(score)}
          </span>
        </div>

        {/* Stats column */}
        <div className="flex flex-col gap-1.5 text-xs text-gray-600 min-w-0">

          {/* Trend */}
          <div className="flex items-center">
            <span className="text-gray-400 mr-1">Тренд</span>
            <TrendBadge history={history} />
          </div>

          {/* SLE Hit Rate */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">SLE Hit Rate</span>
            <span
              className="font-bold tabular-nums"
              style={{ color: sleHitRate >= 80 ? '#16a34a' : sleHitRate >= 60 ? '#d97706' : '#dc2626' }}
            >
              {sleHitRate}%
            </span>
            <span className="text-gray-300 text-[10px]">(P85)</span>
          </div>

          {/* Mean CT */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">Средний CT</span>
            <span className="font-semibold tabular-nums">{meanCT}д</span>
          </div>

          {/* StdDev + CV */}
          <div className="flex items-center gap-1.5">
            <span className="text-gray-400">StdDev</span>
            <span className="font-semibold tabular-nums">{stdDev}д</span>
            <span className="text-gray-300">·</span>
            <span className="text-gray-400">CV</span>
            <span className="font-semibold tabular-nums">{cv}</span>
          </div>

          {/* Sample size */}
          <div className="text-gray-300 text-[10px]">
            выборка: {n} задач · окно 12 нед.
          </div>
        </div>

        {/* Tooltip / info */}
        <div className="ml-auto shrink-0">
          <div className="metric-tooltip text-gray-400">
            ℹ
            <span className="tooltip-text" style={{ width: '220px' }}>
              <strong>Формула:</strong> Score = max(0, 100 − CV × 25)<br />
              CV = σ(CT) / μ(CT)<br /><br />
              Скользящее окно: 12 недель.<br />
              <strong>SLE Hit Rate</strong> — % задач завершившихся ≤ P85.<br />
              70% — benchmark зрелой команды.
            </span>
          </div>
        </div>
      </div>

      {/* ── Sparkline ── */}
      <div className="flex-1 min-h-0">
        <Sparkline history={history} color={scoreTextColor} />
      </div>

    </div>
  );
}
