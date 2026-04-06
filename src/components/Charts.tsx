import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { percentile, fmtNum, fmtWeekLabel, mean } from '../lib/utils';
import type { TableRow, ThroughputWeek, WipWeek, CfdWeek } from '../types';

Chart.register(...registerables);

// ─── Scatter Chart (Lead Time / Cycle Time) ───────────────────────────────────

interface ScatterProps {
  id: string;
  rows: TableRow[];
  field: 'leadTime' | 'cycleTime';
  color: string;
  values: number[];
}

export function ScatterChart({ id, rows, field, color, values }: ScatterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const points = rows
      .filter((r) => r[field] !== null && r.completedAt !== null)
      .map((r) => ({ x: r.completedAt!.getTime(), y: r[field] as number, key: r.key, summary: r.summary }));

    if (!points.length) {
      chartRef.current = new Chart(canvasRef.current, { type: 'scatter', data: { datasets: [] } });
      return;
    }

    const xMin = Math.min(...points.map((p) => p.x));
    const xMax = Math.max(...points.map((p) => p.x));
    const pad  = (xMax - xMin) * 0.03 || 86_400_000;

    const p50 = percentile(values, 50);
    const p85 = percentile(values, 85);
    const p95 = percentile(values, 95);

    const makeLine = (y: number | null, label: string, lineColor: string, dash: number[] = []) =>
      y !== null
        ? {
            type: 'line' as const,
            label,
            data: [{ x: xMin - pad, y }, { x: xMax + pad, y }],
            borderColor: lineColor,
            borderWidth: 1.5,
            borderDash: dash,
            pointRadius: 0,
            fill: false,
            tension: 0,
          }
        : null;

    chartRef.current = new Chart(canvasRef.current, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: field === 'leadTime' ? 'Lead Time' : 'Cycle Time',
            data: points,
            backgroundColor: color + 'aa',
            borderColor: color,
            borderWidth: 1,
            pointRadius: 5,
            pointHoverRadius: 7,
          },
          makeLine(p50, `P50: ${fmtNum(p50)}d.`, '#6b7280', [3, 3]),
          makeLine(p85, `P85: ${fmtNum(p85)}d.`, '#f59e0b', [4, 4]),
          makeLine(p95, `P95: ${fmtNum(p95)}d.`, '#ef4444', [4, 4]),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ].filter(Boolean) as any[],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            callbacks: {
              title: (items) => new Date(items[0].parsed.x ?? 0).toLocaleDateString('ru-RU'),
              label: (item) => {
                const raw = item.raw as { key: string; summary: string };
                const y   = item.parsed.y ?? 0;
                return `${raw.key}: ${y.toFixed(1)} d. — ${raw.summary.slice(0, 50)}`;
              },
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            ticks: {
              maxTicksLimit: 8,
              callback: (v) =>
                new Date(Number(v)).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
            },
            grid: { color: '#f3f4f6' },
          },
          y: { title: { display: true, text: 'Days', font: { size: 11 } }, min: 0, grid: { color: '#f3f4f6' } },
        },
      },
    });
  }, [rows, field, color, values, id]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  return <div className="relative h-[260px]"><canvas ref={canvasRef} /></div>;
}

// ─── Throughput Chart ─────────────────────────────────────────────────────────

export function ThroughputChart({ weeks }: { weeks: ThroughputWeek[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: weeks.map((w) => fmtWeekLabel(w.date)),
        datasets: [{
          label: 'Задач выполнено',
          data: weeks.map((w) => w.count),
          backgroundColor: '#10b981aa',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { min: 0, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        },
      },
    });
  }, [weeks]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);
  return <div className="relative h-[260px]"><canvas ref={canvasRef} /></div>;
}


// ─── WIP Run Chart ─────────────────────────────────────────────────────────────

export function WipRunChart({ weeks }: { weeks: WipWeek[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    if (!weeks.length) {
      chartRef.current = new Chart(canvasRef.current, { type: 'line', data: { datasets: [] } });
      return;
    }

    const counts = weeks.map((w) => w.count);
    const avg = mean(counts) ?? 0;
    const labels = weeks.map((w) => fmtWeekLabel(w.date));

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'WIP',
            data: counts,
            borderColor: '#6366f1',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            borderWidth: 2,
            pointRadius: 3,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.3,
          },
          {
            label: `Среднее: ${avg.toFixed(1)}`,
            data: Array(weeks.length).fill(avg),
            borderColor: '#a78bfa',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false,
            tension: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: (items) => `Неделя с ${weeks[items[0].dataIndex]?.date ?? ''}`,
              label: (item) =>
                item.datasetIndex === 0
                  ? `WIP: ${item.parsed.y} задач`
                  : `Среднее: ${avg.toFixed(1)} задач`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { min: 0, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        },
      },
    });
  }, [weeks]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);
  return <div className="relative h-[260px]"><canvas ref={canvasRef} /></div>;
}


// ─── Cumulative Flow Diagram ───────────────────────────────────────────────────

interface CfdChartProps {
  weeks: CfdWeek[];
  /** Statuses ordered ltStart → ltEnd (from workflow.statuses, terminals excluded) */
  statuses: string[];
  /** Name of the ltEnd status — painted green to signal delivered work */
  ltEnd: string;
}

// 12-step palette: violet (early statuses) → teal/green (done)
const CFD_PALETTE = [
  '#ddd6fe', '#c4b5fd', '#a78bfa', '#8b5cf6',
  '#6d28d9', '#4c1d95', '#2563eb', '#1d4ed8',
  '#0369a1', '#0e7490', '#0f766e', '#10b981',
];

export function CfdChart({ weeks, statuses, ltEnd }: CfdChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    if (!weeks.length || !statuses.length) {
      chartRef.current = new Chart(canvasRef.current, { type: 'line', data: { datasets: [] } });
      return;
    }

    const labels = weeks.map((w) => fmtWeekLabel(w.date));

    // Classic CFD: ltEnd at bottom (smallest cumulative count), ltStart at top.
    // Reversing the statuses array puts ltEnd first in the dataset array = bottom line.
    const orderedStatuses = [...statuses].reverse();

    const datasets = orderedStatuses.map((status, idx) => {
      const paletteIdx = Math.round(
        (idx / Math.max(orderedStatuses.length - 1, 1)) * (CFD_PALETTE.length - 1),
      );
      const baseColor = status === ltEnd ? '#10b981' : CFD_PALETTE[paletteIdx];

      return {
        label: status,
        data: weeks.map((w) => w.counts[status] ?? 0),
        borderColor: baseColor,
        backgroundColor: baseColor + '33', // ~20% opacity fill
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        // fill '-1' colours the band between this line and the one below it
        fill: idx === 0 ? 'origin' : '-1',
        tension: 0.2,
      };
    });

    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { size: 10 },
              // Reverse so legend reads top-to-bottom (ltStart first) matching the chart visually
              generateLabels: (chart) =>
                [...(Chart.defaults.plugins.legend.labels.generateLabels?.(chart) ?? [])].reverse(),
            },
          },
          tooltip: {
            callbacks: {
              title: (items) => `Нед. ${weeks[items[0].dataIndex]?.date ?? ''}`,
              label: (item) => `${item.dataset.label}: ${item.parsed.y} задач`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { min: 0, ticks: { font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        },
      },
    });
  }, [weeks, statuses, ltEnd]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);
  return <div className="relative h-[340px]"><canvas ref={canvasRef} /></div>;
}
