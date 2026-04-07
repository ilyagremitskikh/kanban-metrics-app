import { useState } from 'react';
import { fmtNum } from '../lib/utils';
import type { TableRow, SortState, SortCol } from '../types';
import { TypeBadge, StatusBadge } from './Badges';

const JIRA_BASE = 'https://jira.tochka.com/browse';

interface Props {
  rows: TableRow[];
}

export function IssuesTable({ rows }: Props) {
  const [sort, setSort] = useState<SortState>({ col: 'leadTime', dir: 'desc' });

  const handleSort = (col: SortCol) => {
    setSort((prev) => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : (
        col === 'summary' || col === 'key' || col === 'type' || col === 'currentStatus'
          ? 'asc'
          : 'desc'
      ),
    }));
  };

  const sorted = [...rows].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const va = a[sort.col], vb = b[sort.col];
    if (va === null && vb === null) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va instanceof Date && vb instanceof Date) return dir * (va.getTime() - vb.getTime());
    if (typeof va === 'number' && typeof vb === 'number') return dir * (va - vb);
    return dir * String(va).localeCompare(String(vb), 'ru');
  });

  const thCls = 'text-left px-3 py-3.5 bg-gray-50/50 text-xs font-bold text-gray-400 uppercase tracking-wider border-b-2 border-gray-100 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100/50 transition-colors duration-200';

  const th = (col: SortCol, label: string, extraCls = '') => (
    <th
      key={col}
      onClick={() => handleSort(col)}
      className={`${thCls} ${extraCls} ${sort.col === col ? `sort-${sort.dir}` : ''}`}
    >
      {label}
    </th>
  );

  return (
    <div className="bg-white rounded-3xl shadow-none border border-gray-100 overflow-hidden mb-6 p-2">
      <div className="px-5 py-4 border-b border-gray-50">
        <h3 className="text-sm font-bold text-gray-700">Задачи ({rows.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {th('key', 'Ключ')}
              {th('summary', 'Название')}
              {th('type', 'Тип')}
              {th('leadTime', 'Lead Time', 'text-right')}
              {th('devCycleTime', 'Dev CT', 'text-right')}
              {th('upstreamTime', 'Upstream', 'text-right')}
              {th('currentStatus', 'Статус')}
              {th('completedAt', 'Завершена')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.key} className="border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200 group">
                <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                  <a
                    href={`${JIRA_BASE}/${row.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm font-bold text-donezo-dark hover:text-donezo-primary hover:underline transition-colors"
                  >
                    {row.key}
                  </a>
                </td>
                <td className="px-3 py-3.5 align-middle text-gray-700 min-w-[200px] max-w-[500px] group-hover:text-donezo-dark transition-colors">
                  {row.summary}
                </td>
                <td className="px-3 py-3.5 align-middle">
                  <TypeBadge type={row.type} />
                </td>
                <td className="px-3 py-3.5 align-middle text-right font-bold text-gray-700 whitespace-nowrap group-hover:text-donezo-dark transition-colors">
                  {row.leadTime !== null ? `${fmtNum(row.leadTime)} d.` : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-3 py-3.5 align-middle text-right font-bold text-gray-700 whitespace-nowrap group-hover:text-donezo-dark transition-colors">
                  {row.devCycleTime !== null ? `${fmtNum(row.devCycleTime)} d.` : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-3 py-3.5 align-middle text-right font-bold text-gray-700 whitespace-nowrap group-hover:text-donezo-dark transition-colors">
                  {row.upstreamTime !== null ? `${fmtNum(row.upstreamTime)} d.` : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                  <StatusBadge status={row.currentStatus} />
                </td>
                <td className="px-3 py-3.5 align-middle text-gray-500 whitespace-nowrap group-hover:text-donezo-dark transition-colors">
                  {row.completedAt ? row.completedAt.toLocaleDateString('ru-RU') : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
