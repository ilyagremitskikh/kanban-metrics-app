import type { ReactNode } from 'react';
import { mean, percentile, fmtNum } from '../lib/utils';
import type { ThroughputWeek } from '../types';
import { Badge } from '@/components/ui/badge';
import { MetricPanel, SectionCard } from '@/components/ui/admin';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
    <div>
      <div className="mb-0.5 text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
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
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        {title} <MetricTooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-semibold leading-none tracking-tight text-foreground">{fmtNum(mean(values))}</div>
        <div className="mt-1 text-xs text-muted-foreground">среднее, дн.</div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
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
  badgeClass: string;
  badgeTextClass: string;
}

function WipSlice({ title, tooltip, statusCounts, badgeClass, badgeTextClass }: WipSliceProps) {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
        {title} <MetricTooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-semibold leading-none tracking-tight text-foreground">{total}</div>
        <div className="mt-1 text-xs text-muted-foreground">задач в работе</div>
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {Object.entries(statusCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
              >
                <span className={`font-bold ${badgeTextClass}`}>{count}</span>
                <span className="max-w-[120px] truncate text-slate-600">{status}</span>
              </span>
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
  return (
    <SectionCard title={title}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {children}
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
          <div className="text-[38px] font-semibold leading-none tracking-tight text-foreground">{fmtNum(mean(ltValues))}</div>
          <div className="mb-3.5 mt-1 text-xs text-muted-foreground">среднее, дн.</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
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
            <div className="text-[38px] font-semibold leading-none tracking-tight text-foreground">{fmtNum(mean(tpValues))}</div>
            <div className="mt-1 text-xs text-muted-foreground">среднее задач / нед.</div>
            {(() => {
              const typeNames = [...new Set(tpWeeks.flatMap((w) => Object.keys(w.byType ?? {})))];
              if (!typeNames.length) return null;
              return (
                <div className="mb-2 mt-1.5 flex flex-wrap gap-1.5">
                  {typeNames.map((name) => {
                    const avg = tpWeeks.reduce((sum, week) => sum + (week.byType?.[name] ?? 0), 0) / (tpWeeks.length || 1);
                    return (
                      <Badge key={name} variant="outline">{name}: {avg.toFixed(1)} / нед.</Badge>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-auto">
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
            badgeClass="border border-amber-100 bg-amber-50"
            badgeTextClass="text-amber-700"
          />
          <WipSlice
            title="Разработка (Downstream)"
            tooltip="Задачи в стадии разработки, тестирования и релиза. Статусы: Разработка, Code review, Тестирование и др."
            statusCounts={wipBuckets.downstream}
            badgeClass="border border-blue-100 bg-blue-50"
            badgeTextClass="text-blue-700"
          />
        </CompositeCard>
      </div>
    </div>
  );
}
