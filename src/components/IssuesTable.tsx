import { useState } from 'react';
import { fmtNum } from '../lib/utils';
import type { TableRow, SortState, SortCol } from '../types';

const JIRA_BASE = 'https://jira.tochka.com/browse';

interface Props {
  rows: TableRow[];
}

function typeBadgeCls(type: string): string {
  if (type === 'User Story') return 'bg-blue-100 text-blue-800';
  if (type === 'Ошибка')     return 'bg-red-100 text-red-700';
  if (type === 'Техдолг')    return 'bg-amber-50 text-amber-700';
  return 'bg-gray-100 text-gray-600';
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

  const thCls = 'text-left px-3 py-2.5 bg-gray-50 text-[10px] font-bold text-gray-500 uppercase tracking-wider border-b-2 border-gray-200 cursor-pointer select-none whitespace-nowrap hover:bg-gray-100 transition-colors';

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
    <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-700">Задачи ({rows.length})</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {th('key', 'Ключ')}
              {th('summary', 'Название')}
              {th('type', 'Тип')}
              {th('leadTime', 'Lead Time', 'text-right')}
              {th('cycleTime', 'Cycle Time', 'text-right')}
              {th('currentStatus', 'Статус')}
              {th('completedAt', 'Завершена')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.key} className="border-b border-gray-100 last:border-none hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                  <a
                    href={`${JIRA_BASE}/${row.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {row.key}
                  </a>
                </td>
                <td className="px-3 py-2.5 align-middle text-gray-700 min-w-[200px] max-w-[500px]">
                  {row.summary}
                </td>
                <td className="px-3 py-2.5 align-middle">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${typeBadgeCls(row.type)}`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-2.5 align-middle text-right font-bold text-gray-700 whitespace-nowrap">
                  {row.leadTime !== null ? `${fmtNum(row.leadTime)} d.` : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-3 py-2.5 align-middle text-right font-bold text-gray-700 whitespace-nowrap">
                  {row.cycleTime !== null ? `${fmtNum(row.cycleTime)} d.` : <span className="text-gray-300 font-normal">—</span>}
                </td>
                <td className="px-3 py-2.5 align-middle text-gray-500 whitespace-nowrap">{row.currentStatus}</td>
                <td className="px-3 py-2.5 align-middle text-gray-500 whitespace-nowrap">
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
