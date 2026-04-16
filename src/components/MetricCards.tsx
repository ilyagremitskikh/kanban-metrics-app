import { Children, Fragment, type ReactNode } from 'react';
import { mean, percentile, fmtNum } from '../lib/utils';
import type { ThroughputWeek } from '../types';
import { MetricPanel, SectionCard } from '@/components/ui/admin';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IssueTypeIcon } from './TaskTableCells';
import { StatusBadge } from './Badges';

function MetricTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
          ℹ
        </button>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

interface MetricStatProps {
  label: string;
  value: string | number;
}

function MetricStat({ label, value }: MetricStatProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-right text-sm font-semibold text-foreground tabular-nums">{value}</div>
    </div>
  );
}

function formatDays(value: number | null) {
  if (value === null) return '—';
  return `${fmtNum(value)} дн.`;
}

interface TimeSliceProps {
  title: string;
  tooltip: string;
  values: number[];
}

function TimeSlice({ title, tooltip, values }: TimeSliceProps) {
  return (
    <div className="flex h-full flex-col gap-4 py-1">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        {title} <MetricTooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{fmtNum(mean(values))}</div>
        <div className="mt-1 text-xs text-muted-foreground">среднее, дн.</div>
      </div>
      <div className="grid gap-y-2">
        <MetricStat label="Медиана (P50)" value={formatDays(percentile(values, 50))} />
        <MetricStat label="P85" value={formatDays(percentile(values, 85))} />
        <MetricStat label="P95" value={formatDays(percentile(values, 95))} />
        <MetricStat label="Выполнено" value={values.length} />
      </div>
    </div>
  );
}

interface WipSliceProps {
  title: string;
  tooltip: string;
  statusCounts: Record<string, number>;
}

function WipSlice({ title, tooltip, statusCounts }: WipSliceProps) {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex h-full flex-col gap-4 py-1">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        {title} <MetricTooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{total}</div>
        <div className="mt-1 text-xs text-muted-foreground">задач в работе</div>
      </div>
      {total > 0 && (
        <div className="mt-auto flex flex-col gap-2">
          {Object.entries(statusCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm">
                <StatusBadge status={status} />
                <span className="text-sm font-semibold text-foreground tabular-nums">{count}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

interface CompositeCardProps {
  title: string;
  children: ReactNode;
}

function CompositeCard({ title, children }: CompositeCardProps) {
  const items = Children.toArray(children);

  return (
    <SectionCard title={title}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-stretch md:gap-5">
        {items.map((child, index) => (
          <Fragment key={index}>
            {index > 0 ? (
              <>
                <Separator className="md:hidden" />
                <Separator orientation="vertical" className="hidden bg-border/60 md:block" />
              </>
            ) : null}
            {child}
          </Fragment>
        ))}
      </div>
    </SectionCard>
  );
}

interface Props {
  ltValues: number[];
  ctValues: number[];
  upstreamValues: number[];
  tpWeeks: ThroughputWeek[];
  wipBuckets: { upstream: Record<string, number>; downstream: Record<string, number> };
  completedTotal: number;
}

export function MetricCards({ ltValues, ctValues, upstreamValues, tpWeeks, wipBuckets, completedTotal }: Props) {
  const tpValues = tpWeeks.map((w) => w.count);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-6">
        <MetricPanel
          title="Время доставки (Lead Time)"
          tooltip="Полное время жизни задачи: от создания до перехода в «Готово». Включает ожидание в очереди. Отражает скорость доставки ценности с точки зрения клиента."
          className="xl:col-span-2"
        >
          <div className="text-[38px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{fmtNum(mean(ltValues))}</div>
          <div className="mb-3.5 mt-1 text-xs text-muted-foreground">среднее, дн.</div>
          <div className="grid gap-y-2">
            <MetricStat label="Медиана (P50)" value={formatDays(percentile(ltValues, 50))} />
            <MetricStat label="P85" value={formatDays(percentile(ltValues, 85))} />
            <MetricStat label="P95" value={formatDays(percentile(ltValues, 95))} />
            <MetricStat label="Выполнено" value={ltValues.length} />
          </div>
        </MetricPanel>

        <div className="xl:col-span-2">
          <CompositeCard title="Время в потоке (Cycle Time)">
            <TimeSlice
              title="Время разработки (Downstream CT)"
              tooltip="Время разработки: от первого входа в Downstream (Разработка и далее) до «Готово». Не включает аналитику и ожидание в очереди."
              values={ctValues}
            />
            <TimeSlice
              title="Время подготовки (Upstream CT)"
              tooltip="Время аналитики/подготовки: от первого входа в Upstream (Анализ и подготовка) до начала разработки. Отражает эффективность Discovery-процесса."
              values={upstreamValues}
            />
          </CompositeCard>
        </div>

        <MetricPanel title="Скорость завершения (Throughput)" tooltip="Производительность команды: сколько задач завершается за неделю. Стабильный Throughput — признак предсказуемого потока. Используйте для прогнозирования сроков." className="flex flex-col justify-between xl:col-span-2">
          <div>
            <div className="text-[38px] font-semibold leading-none tracking-tight text-foreground tabular-nums">{fmtNum(mean(tpValues))}</div>
            <div className="mt-1 text-xs text-muted-foreground">среднее задач / нед.</div>
            {(() => {
              const typeNames = [...new Set(tpWeeks.flatMap((w) => Object.keys(w.byType ?? {})))];
              if (!typeNames.length) return null;
              return (
                <div className="mb-2 mt-2 flex flex-col gap-1.5">
                  {typeNames.map((name) => {
                    const avg = tpWeeks.reduce((sum, week) => sum + (week.byType?.[name] ?? 0), 0) / (tpWeeks.length || 1);
                    return (
                      <div key={name} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 text-sm">
                        <span className="opacity-80">
                          <IssueTypeIcon type={name} />
                        </span>
                        <span className="truncate text-muted-foreground">{name}</span>
                        <span className="font-medium text-foreground tabular-nums">{avg.toFixed(1)} / нед.</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="mt-auto grid gap-y-2">
            <MetricStat label="Макс / нед." value={tpValues.length ? Math.max(...tpValues) : '—'} />
            <MetricStat label="Всего выполнено" value={completedTotal} />
          </div>
        </MetricPanel>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <CompositeCard title="Работа в процессе (WIP)">
          <WipSlice
            title="Подготовка (Upstream)"
            tooltip="Задачи в стадии аналитики, подготовки и Discovery. Статусы: Готово к анализу, Анализ, Готово к разработке и др."
            statusCounts={wipBuckets.upstream}
          />
          <WipSlice
            title="Разработка (Downstream)"
            tooltip="Задачи в стадии разработки, тестирования и релиза. Статусы: Разработка, Code review, Тестирование и др."
            statusCounts={wipBuckets.downstream}
          />
        </CompositeCard>
      </div>
    </div>
  );
}
