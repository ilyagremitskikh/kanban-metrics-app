import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { percentile, fmtNum } from '../lib/utils';
import { BUCKETS, getIssueAgeInActiveBucket } from '../lib/metrics';
import type { Issue } from '../types';
import { JIRA_BASE_URL } from '../types';
import { TypeBadge, StatusBadge } from './Badges';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  return (d >= 0 ? '+' : '') + fmtNum(d) + ' дн.';
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
        return {
          key: i.key,
          summary: i.summary,
          type: i.type,
          currentStatus: i.currentStatus,
          age: getIssueAgeInActiveBucket(i, bucket, now),
        };
      })
      .sort((a, b) => b.age - a.age)
      .slice(0, 40);
  }, [issues, activeBucketStatuses, bucket]);

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

    const metricLabel = bucket === 'upstream' ? 'Время подготовки' : 'Время разработки';

    chartRef.current = new Chart(canvasRef.current, {
      type: 'bar',
      data: {
        labels: aged.map((i) => i.key),
        datasets: [
          {
            label: 'Дней в работе',
            data: aged.map((i) => i.age),
            backgroundColor: barColors,
            borderWidth: 0,
            borderRadius: 3,
          },
          ...(p50 !== null
            ? [{
                type: 'line' as const,
                label: `${metricLabel} P50 (${fmtNum(p50)} дн.)`,
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
                label: `${metricLabel} P85 (${fmtNum(p85)} дн.)`,
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
                  ? `${fmtNum(item.parsed.x)} дн. — ${aged[item.dataIndex]?.summary?.slice(0, 60)}`
                  : (item.dataset.label ?? ''),
            },
          },
        },
        scales: {
          x: {
            min: 0,
            title: { display: true, text: 'Дни в работе', font: { size: 11 } },
            grid: { color: '#f3f4f6' },
          },
          y: { ticks: { font: { size: 11 } }, grid: { display: false } },
        },
      },
    });
  }, [aged, p50, p85, bucket]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  if (!aged.length) return <div className="py-4 text-sm text-gray-400">Нет задач в работе</div>;

  return (
    <div>
      <div className="relative overflow-y-auto max-h-[420px]">
        <canvas ref={canvasRef} />
      </div>

      <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowTable((v) => !v)}>
        {showTable ? '▲ Скрыть детали' : `▼ Детали WIP (${aged.length} задач)`}
      </Button>

      {showTable && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border p-2">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                {['Задача', 'Тип', 'Текущий статус', 'Дни в работе', 'vs P50', 'vs P85'].map((h) => (
                  <TableHead key={h} className="whitespace-nowrap">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {aged.map((i) => {
                const color =
                  p50 !== null && i.age <= p50 ? 'green'
                  : p85 !== null && i.age <= p85 ? 'yellow'
                  : 'red';
                return (
                  <TableRow key={i.key} className={`group wip-row-${color}`}>
                    <TableCell className="align-top">
                      <a
                        href={`${JIRA_BASE_URL}/${i.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mr-2 whitespace-nowrap font-mono font-bold text-slate-900 transition-colors hover:text-blue-700 hover:underline"
                      >
                        {i.key}
                      </a>
                      <span className="text-gray-500 transition-colors group-hover:text-slate-900">{i.summary}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <TypeBadge type={i.type} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusBadge status={i.currentStatus} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-bold transition-colors group-hover:text-slate-900">{fmtNum(i.age)} дн.</TableCell>
                    <TableCell className={`whitespace-nowrap ${deltaClass(i.age, p50)} transition-colors group-hover:text-slate-900`}>{deltaLabel(i.age, p50)}</TableCell>
                    <TableCell className={`whitespace-nowrap ${deltaClass(i.age, p85)} transition-colors group-hover:text-slate-900`}>{deltaLabel(i.age, p85)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
