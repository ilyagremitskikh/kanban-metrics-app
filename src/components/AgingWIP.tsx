import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { percentile, fmtNum } from '../lib/utils';
import { BUCKETS } from '../lib/metrics';
import type { Issue } from '../types';
import { JIRA_BASE_URL } from '../types';
import { TypeBadge, StatusBadge } from './Badges';

Chart.register(...registerables);

interface AgedIssue {
  key: string;
  summary: string;
  type: string;
  currentStatus: string;
  age: number;
}

interface Props {
  issues: Issue[];
  bucket: 'upstream' | 'downstream';
  thresholdValues: number[];
}

function deltaLabel(age: number, p: number | null): string {
  if (p === null) return '—';
  const d = age - p;
  return (d >= 0 ? '+' : '') + fmtNum(d) + 'd.';
}

function deltaClass(age: number, p: number | null): string {
  if (p === null) return 'text-gray-400';
  return age > p ? 'text-red-600 font-semibold' : 'text-emerald-600';
}

export function AgingWIP({ issues, bucket, thresholdValues }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);
  const [showTable, setShowTable] = useState(false);

  const activeBucketStatuses = bucket === 'upstream'
    ? BUCKETS.UPSTREAM_ACTIVE
    : BUCKETS.DOWNSTREAM_ACTIVE;

  const p50 = percentile(thresholdValues, 50);
  const p85 = percentile(thresholdValues, 85);

  const aged = useMemo<AgedIssue[]>(() => {
    const now = new Date();
    const wipIssues = issues.filter((i) => activeBucketStatuses.includes(i.currentStatus));

    return wipIssues
      .map((i) => {
        const sorted = [...i.transitions].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        // Age = time since first entry into this bucket's active statuses
        const firstBucketTransition = sorted.find((t) => activeBucketStatuses.includes(t.to));
        const startTs = firstBucketTransition
          ? new Date(firstBucketTransition.date).getTime()
          : new Date(i.created).getTime();
        return {
          key: i.key,
          summary: i.summary,
          type: i.type,
          currentStatus: i.currentStatus,
          age: (now.getTime() - startTs) / 86_400_000,
        };
      })
      .sort((a, b) => b.age - a.age)
      .slice(0, 40);
  }, [issues, activeBucketStatuses]);

  useEffect(() => {
    if (!canvasRef.current || !aged.length) return;
    chartRef.current?.destroy();

    const barColors = aged.map((i) => {
      if (p50 !== null && i.age <= p50) return '#10b981cc';
      if (p85 !== null && i.age <= p85) return '#f59e0bcc';
      return '#ef4444cc';
    });

    const h = Math.max(200, aged.length * 28);
    canvasRef.current.style.height = h + 'px';
    canvasRef.current.height = h;

    const metricLabel = bucket === 'upstream' ? 'Upstream' : 'Dev CT';

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: aged.map((i) => i.key),
        datasets: [
          {
            label: 'Days in progress',
            data: aged.map((i) => i.age),
            backgroundColor: barColors,
            borderWidth: 0,
            borderRadius: 3,
          },
          ...(p50 !== null
            ? [{
                type: 'line' as const,
                label: `${metricLabel} P50 (${fmtNum(p50)}d.)`,
                data: aged.map(() => p50),
                borderColor: '#6b7280',
                borderWidth: 1.5,
                borderDash: [3, 3],
                pointRadius: 0,
                fill: false,
              }]
            : []),
          ...(p85 !== null
            ? [{
                type: 'line' as const,
                label: `${metricLabel} P85 (${fmtNum(p85)}d.)`,
                data: aged.map(() => p85),
                borderColor: '#f59e0b',
                borderWidth: 1.5,
                borderDash: [4, 4],
                pointRadius: 0,
                fill: false,
              }]
            : []),
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              title: (items) => aged[items[0].dataIndex]?.key,
              label: (item) =>
                item.datasetIndex === 0
                  ? `${fmtNum(item.parsed.x)} d. — ${aged[item.dataIndex]?.summary?.slice(0, 60)}`
                  : (item.dataset.label ?? ''),
            },
          },
        },
        scales: {
          x: {
            min: 0,
            title: { display: true, text: 'Days in progress', font: { size: 11 } },
            grid: { color: '#f3f4f6' },
          },
          y: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }, [aged, p50, p85, bucket]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  if (!aged.length) return <div className="text-gray-400 py-4 text-sm">Нет задач в работе</div>;

  return (
    <div>
      <div className="relative overflow-y-auto max-h-[420px]">
        <canvas ref={canvasRef} />
      </div>

      <button
        className="mt-4 bg-transparent border border-gray-100 rounded-full px-5 py-2 text-xs font-bold text-gray-500 cursor-pointer transition-all duration-200 hover:bg-donezo-light hover:text-donezo-dark hover:border-donezo-primary hover:-translate-y-0.5 shadow-sm"
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? '▲ Скрыть детали' : `▼ Детали WIP (${aged.length} задач)`}
      </button>

      {showTable && (
        <div className="mt-3 overflow-x-auto rounded-3xl border border-gray-100 shadow-none p-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['Задача', 'Тип', 'Текущий статус', 'Дней в работе', 'vs P50', 'vs P85'].map((h) => (
                  <th key={h} className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-gray-100 bg-gray-50/50 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aged.map((i) => {
                const color =
                  p50 !== null && i.age <= p50 ? 'green'
                  : p85 !== null && i.age <= p85 ? 'yellow'
                  : 'red';
                return (
                  <tr key={i.key} className={`border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200 group wip-row-${color}`}>
                    <td className="px-3 py-3.5 align-top">
                      <a
                        href={`${JIRA_BASE_URL}/${i.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-donezo-dark hover:text-donezo-primary hover:underline transition-colors mr-2 whitespace-nowrap"
                      >
                        {i.key}
                      </a>
                      <span className="text-gray-500 group-hover:text-donezo-dark transition-colors">{i.summary}</span>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <TypeBadge type={i.type} />
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      <StatusBadge status={i.currentStatus} />
                    </td>
                    <td className="px-3 py-3.5 font-bold whitespace-nowrap group-hover:text-donezo-dark transition-colors">{fmtNum(i.age)}d.</td>
                    <td className={`px-3 py-3.5 whitespace-nowrap ${deltaClass(i.age, p50)} group-hover:text-donezo-dark transition-colors`}>{deltaLabel(i.age, p50)}</td>
                    <td className={`px-3 py-3.5 whitespace-nowrap ${deltaClass(i.age, p85)} group-hover:text-donezo-dark transition-colors`}>{deltaLabel(i.age, p85)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
