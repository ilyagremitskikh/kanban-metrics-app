import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type Table as TanStackTable,
} from '@tanstack/react-table';
import { ChevronUp, Info } from 'lucide-react';
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
        'h-auto w-full justify-start gap-1 rounded-md px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        align === 'center' && 'justify-center text-center',
      )}
    >
      <span className="inline-flex items-center gap-1 whitespace-nowrap">
        {children}
        {hint ? (
          <span title={hint} aria-label={hint}>
            <Info className="size-3 text-muted-foreground/70" />
          </span>
        ) : null}
        <ChevronUp
          className={cn(
            'size-3.5 transition-all',
            active ? 'text-foreground opacity-100' : 'text-muted-foreground opacity-35',
            active && dir === 'desc' && 'rotate-180',
          )}
        />
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
    <div className={cn('overflow-hidden rounded-lg border border-border bg-background font-[var(--font-sans)] tabular-nums', className)}>
      <div className={cn('overflow-x-auto p-1.5', maxHeight ? 'overflow-y-auto' : 'overflow-y-visible')} style={maxHeight ? { maxHeight } : undefined}>
        <Table className="min-w-max border-separate border-spacing-y-1">
          <TableHeader className="sticky top-0 z-20 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="h-[34px] border-0 bg-background hover:bg-background">
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
                <TableRow key={row.id} className="group min-h-[46px] border-0 transition-colors hover:bg-muted/50">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="first:rounded-l-md last:rounded-r-md">
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
