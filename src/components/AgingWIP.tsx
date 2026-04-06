import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { percentile, fmtNum } from '../lib/utils';
import { getWorkflowForIssue, isWipIssue } from '../lib/metrics';
import type { Issue, WorkflowConfig } from '../types';

Chart.register(...registerables);

const JIRA_BASE = 'https://jira.tochka.com/browse';

interface AgedIssue {
  key: string;
  summary: string;
  type: string;
  currentStatus: string;
  age: number;
}

interface Props {
  issues: Issue[];
  workflows: WorkflowConfig[];
  ctValues: number[];
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

export function AgingWIP({ issues, workflows, ctValues }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef  = useRef<Chart | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [aged, setAged]           = useState<AgedIssue[]>([]);

  const ctP50 = percentile(ctValues, 50);
  const ctP85 = percentile(ctValues, 85);

  useEffect(() => {
    const now = new Date();
    const wipIssues = issues.filter((i) => {
      const wf = getWorkflowForIssue(i, workflows);
      return wf ? isWipIssue(i, wf) : false;
    });

    const computed = wipIssues
      .map((i) => {
        const wf = getWorkflowForIssue(i, workflows)!;
        const ctStartTs = i.transitions
          .filter((t) => t.status === wf.ctStart)
          .map((t) => new Date(t.enteredAt).getTime());
        // Fall back to earliest transition or issue.created when ctStart was never entered
        // (e.g. task went directly to Code Review, skipping ctStart).
        const fallbackTs = i.transitions.length
          ? Math.min(...i.transitions.map((t) => new Date(t.enteredAt).getTime()))
          : new Date(i.created).getTime();
        const startTs = ctStartTs.length ? Math.max(...ctStartTs) : fallbackTs;
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

    setAged(computed);
  }, [issues, workflows]);

  useEffect(() => {
    if (!canvasRef.current || !aged.length) return;
    chartRef.current?.destroy();

    const barColors = aged.map((i) => {
      if (ctP50 !== null && i.age <= ctP50) return '#10b981cc';
      if (ctP85 !== null && i.age <= ctP85) return '#f59e0bcc';
      return '#ef4444cc';
    });

    const h = Math.max(200, aged.length * 28);
    canvasRef.current.style.height = h + 'px';
    canvasRef.current.height = h;

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
          ...(ctP50 !== null
            ? [{
                type: 'line' as const,
                label: `CT P50 (${fmtNum(ctP50)}d.)`,
                data: aged.map(() => ctP50),
                borderColor: '#6b7280',
                borderWidth: 1.5,
                borderDash: [3, 3],
                pointRadius: 0,
                fill: false,
              }]
            : []),
          ...(ctP85 !== null
            ? [{
                type: 'line' as const,
                label: `CT P85 (${fmtNum(ctP85)}d.)`,
                data: aged.map(() => ctP85),
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
  }, [aged, ctP50, ctP85]);

  useEffect(() => () => { chartRef.current?.destroy(); }, []);

  if (!aged.length) return <div className="text-gray-400 py-4 text-sm">Нет задач в работе</div>;

  return (
    <div>
      <div className="relative overflow-y-auto max-h-[420px]">
        <canvas ref={canvasRef} />
      </div>

      <button
        className="mt-4 bg-transparent border border-gray-200 rounded-lg px-4 py-1.5 text-xs font-semibold text-gray-500 cursor-pointer transition hover:bg-gray-50"
        onClick={() => setShowTable((v) => !v)}
      >
        {showTable ? '▲ Скрыть детали' : `▼ Детали WIP (${aged.length} задач)`}
      </button>

      {showTable && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Задача', 'Тип', 'Текущий статус', 'Дней в работе', 'vs P50', 'vs P85'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-400 border-b-2 border-gray-200 bg-gray-50 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aged.map((i) => {
                const color =
                  ctP50 !== null && i.age <= ctP50 ? 'green'
                  : ctP85 !== null && i.age <= ctP85 ? 'yellow'
                  : 'red';
                return (
                  <tr key={i.key} className={`border-b border-gray-100 last:border-none hover:bg-gray-50 transition-colors wip-row-${color}`}>
                    <td className="px-3 py-2.5 align-top">
                      <a
                        href={`${JIRA_BASE}/${i.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-bold text-blue-600 hover:text-blue-800 hover:underline mr-2 whitespace-nowrap"
                      >
                        {i.key}
                      </a>
                      <span className="text-gray-500">{i.summary}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">{i.type}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{i.currentStatus}</td>
                    <td className="px-3 py-2.5 font-bold whitespace-nowrap">{fmtNum(i.age)}d.</td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${deltaClass(i.age, ctP50)}`}>{deltaLabel(i.age, ctP50)}</td>
                    <td className={`px-3 py-2.5 whitespace-nowrap ${deltaClass(i.age, ctP85)}`}>{deltaLabel(i.age, ctP85)}</td>
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
