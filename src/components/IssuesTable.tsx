import { useState } from 'react';
import { fmtNum } from '../lib/utils';
import type { TableRow as MetricsTableRow, SortState, SortCol } from '../types';
import { JIRA_BASE_URL } from '../types';
import { TypeBadge, StatusBadge } from './Badges';
import { SectionCard } from '@/components/ui/admin';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
  rows: MetricsTableRow[];
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

  const thCls = 'cursor-pointer select-none whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground';

  const th = (col: SortCol, label: string, extraCls = '') => (
    <TableHead
      key={col}
      onClick={() => handleSort(col)}
      className={cn(thCls, extraCls, sort.col === col ? `sort-${sort.dir}` : '')}
    >
      {label}
    </TableHead>
  );

  return (
    <SectionCard title={`Задачи (${rows.length})`}>
      <div className="overflow-x-auto">
        <Table className="border-collapse tabular-nums">
          <TableHeader>
            <TableRow className="border-border/40 bg-muted/15 hover:bg-transparent">
              {th('key', 'Ключ')}
              {th('summary', 'Название')}
              {th('type', 'Тип')}
              {th('leadTime', 'Время доставки', 'text-right')}
              {th('devCycleTime', 'Время разработки', 'text-right')}
              {th('upstreamTime', 'Время подготовки', 'text-right')}
              {th('currentStatus', 'Статус')}
              {th('completedAt', 'Завершена')}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.key} className="group border-border/40 hover:bg-muted/50">
                <TableCell className="whitespace-nowrap">
                  <a
                    href={`${JIRA_BASE_URL}/${row.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm font-normal text-muted-foreground transition-colors hover:text-foreground hover:underline"
                  >
                    {row.key}
                  </a>
                </TableCell>
                <TableCell className="min-w-[200px] max-w-[500px] text-foreground/80 transition-colors group-hover:text-foreground">
                  {row.summary}
                </TableCell>
                <TableCell>
                  <TypeBadge type={row.type} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold text-foreground/80 transition-colors group-hover:text-foreground">
                  {row.leadTime !== null ? `${fmtNum(row.leadTime)} дн.` : <span className="font-normal text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold text-foreground/80 transition-colors group-hover:text-foreground">
                  {row.devCycleTime !== null ? `${fmtNum(row.devCycleTime)} дн.` : <span className="font-normal text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right font-semibold text-foreground/80 transition-colors group-hover:text-foreground">
                  {row.upstreamTime !== null ? `${fmtNum(row.upstreamTime)} дн.` : <span className="font-normal text-muted-foreground/40">—</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  <StatusBadge status={row.currentStatus} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground transition-colors group-hover:text-foreground">
                  {row.completedAt ? row.completedAt.toLocaleDateString('ru-RU') : <span className="text-muted-foreground/40">—</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
