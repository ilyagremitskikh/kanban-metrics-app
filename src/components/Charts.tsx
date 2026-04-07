import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { percentile, fmtNum, fmtWeekLabel } from '../lib/utils';
import type { TableRow, ThroughputWeek } from '../types';

Chart.register(...registerables);

// ─── Scatter Chart (Lead Time / Cycle Time) ───────────────────────────────────

interface ScatterProps {
  id: string;
  rows: TableRow[];
  field: 'leadTime' | 'devCycleTime' | 'upstreamTime';
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
            label: field === 'leadTime' ? 'Lead Time' : field === 'devCycleTime' ? 'Dev Cycle Time' : 'Upstream Time',
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

const TYPE_COLORS: Record<string, string> = {
  'Задача':     '#10b981',
  'User Story': '#10b981',
  'Ошибка':     '#ef4444',
  'Техдолг':    '#f59e0b',
};
const DEFAULT_TYPE_COLOR = '#64748b';
function typeColor(name: string): string { return TYPE_COLORS[name] ?? DEFAULT_TYPE_COLOR; }

export function ThroughputChart({ weeks }: { weeks: ThroughputWeek[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();

    const hasBreakdown = weeks.some((w) => w.byType && Object.keys(w.byType).length > 0);
    const labels = weeks.map((w) => fmtWeekLabel(w.date));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let datasets: any[];
    if (hasBreakdown) {
      const allTypes = [...new Set(weeks.flatMap((w) => Object.keys(w.byType ?? {})))];
      datasets = allTypes.map((t) => ({
        label: t,
        data: weeks.map((w) => w.byType?.[t] ?? 0),
        backgroundColor: typeColor(t) + 'cc',
        borderColor: typeColor(t),
        borderWidth: 1,
        borderRadius: 4,
        stack: 'tp',
      }));
    } else {
      datasets = [{
        label: 'Задач выполнено',
        data: weeks.map((w) => w.count),
        backgroundColor: '#10b981aa',
        borderColor: '#10b981',
        borderWidth: 1.5,
        borderRadius: 4,
      }];
    }

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: hasBreakdown, position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: { stacked: hasBreakdown, grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { stacked: hasBreakdown, min: 0, ticks: { stepSize: 1, font: { size: 11 } }, grid: { color: '#f3f4f6' } },
        },
      },
    });
  }, [weeks]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);
  return <div className="relative h-[260px]"><canvas ref={canvasRef} /></div>;
}

