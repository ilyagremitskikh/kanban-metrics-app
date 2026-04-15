import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import { ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface TasksDataTableProps<TData extends RowData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  getRowId?: (row: TData, index: number) => string;
  emptyTitle?: string;
  footerText?: string;
  maxHeight?: string;
  className?: string;
  renderBody?: (table: TanStackTable<TData>) => ReactNode;
}

interface TasksDataTableSortHeaderProps {
  children: ReactNode;
  active: boolean;
  dir: 'asc' | 'desc';
  onClick: () => void;
  align?: 'left' | 'center';
  hint?: string;
}

export function TasksDataTableSortHeader({
  children,
  active,
  dir,
  onClick,
  align = 'left',
  hint,
}: TasksDataTableSortHeaderProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-auto w-full justify-start gap-1 rounded-md px-1 py-0.5 text-xs font-bold uppercase tracking-wide hover:bg-muted/70',
        align === 'center' && 'justify-center text-center',
      )}
    >
      <span className={cn('flex flex-col gap-0.5', align === 'center' ? 'items-center' : 'items-start')}>
        <span className="inline-flex items-center gap-1">
          {children}
          <ChevronUp
            className={cn(
              'size-3.5 transition-all',
              active ? 'text-blue-600 opacity-100' : 'text-muted-foreground opacity-35',
              active && dir === 'desc' && 'rotate-180',
            )}
          />
        </span>
        {hint ? <span className="text-[10px] font-normal normal-case tracking-normal text-muted-foreground">{hint}</span> : null}
      </span>
    </Button>
  );
}

export function TasksDataTable<TData extends RowData>({
  data,
  columns,
  getRowId,
  emptyTitle = 'Нет данных',
  footerText,
  maxHeight,
  className,
  renderBody,
}: TasksDataTableProps<TData>) {
  // TanStack Table owns its row model and returns non-memoizable helpers by design.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-card shadow-sm', className)}>
      <div className={cn('overflow-auto', !maxHeight && 'overflow-visible')} style={maxHeight ? { maxHeight } : undefined}>
        <Table className="border-collapse">
          <TableHeader className="sticky top-0 z-20 bg-card shadow-[0_1px_0_0_hsl(var(--border))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {renderBody ? renderBody(table) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group h-12 hover:bg-muted/35">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyTitle}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {footerText ? (
        <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
          {footerText}
        </div>
      ) : null}
    </div>
  );
}
