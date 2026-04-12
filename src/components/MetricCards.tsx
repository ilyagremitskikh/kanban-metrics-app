import type { ReactNode } from 'react';
import { mean, percentile, fmtNum } from '../lib/utils';
import type { ThroughputWeek } from '../types';

function Tooltip({ text }: { text: string }) {
  return (
    <span className="metric-tooltip">
      ℹ<span className="tooltip-text">{text}</span>
    </span>
  );
}

interface MetricStatProps {
  label: string;
  value: string | number;
}

function MetricStat({ label, value }: MetricStatProps) {
  return (
    <div>
      <div className="text-xs text-gray-400 mb-0.5">{label}</div>
      <div className="text-sm font-bold text-gray-700">{value}</div>
    </div>
  );
}

interface TimeSliceProps {
  title: string;
  tooltip: string;
  values: number[];
}

function TimeSlice({ title, tooltip, values }: TimeSliceProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
        {title} <Tooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-extrabold text-donezo-dark leading-none tracking-tight">{fmtNum(mean(values))}</div>
        <div className="text-xs text-gray-400 mt-1">среднее, дней</div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <MetricStat label="Медиана (P50)" value={`${fmtNum(percentile(values, 50))} d.`} />
        <MetricStat label="P85" value={`${fmtNum(percentile(values, 85))} d.`} />
        <MetricStat label="P95" value={`${fmtNum(percentile(values, 95))} d.`} />
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
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
        {title} <Tooltip text={tooltip} />
      </div>
      <div>
        <div className="text-[30px] font-extrabold text-donezo-dark leading-none tracking-tight">{total}</div>
        <div className="text-xs text-gray-400 mt-1">задач в работе</div>
      </div>
      {total > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {Object.entries(statusCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}
              >
                <span className={`font-bold ${badgeTextClass}`}>{count}</span>
                <span className="text-gray-600 truncate max-w-[120px]">{status}</span>
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
    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
        {title}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {children}
      </div>
    </div>
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
    <div className="flex flex-col gap-4 mb-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
            Lead Time <Tooltip text="Полное время жизни задачи: от создания до перехода в «Готово». Включает ожидание в очереди. Отражает скорость доставки ценности с точки зрения клиента." />
          </div>
          <div className="text-[38px] font-extrabold text-donezo-dark leading-none tracking-tight">{fmtNum(mean(ltValues))}</div>
          <div className="text-xs text-gray-400 mt-1 mb-3.5">среднее, дней</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <MetricStat label="Медиана (P50)" value={`${fmtNum(percentile(ltValues, 50))} d.`} />
            <MetricStat label="P85" value={`${fmtNum(percentile(ltValues, 85))} d.`} />
            <MetricStat label="P95" value={`${fmtNum(percentile(ltValues, 95))} d.`} />
            <MetricStat label="Выполнено" value={ltValues.length} />
          </div>
        </div>

        <CompositeCard title="Cycle Time">
          <TimeSlice
            title="Downstream CT"
            tooltip="Время разработки: от первого входа в Downstream (Разработка и далее) до «Готово». Не включает аналитику и ожидание в очереди."
            values={ctValues}
          />
          <TimeSlice
            title="Upstream CT"
            tooltip="Время аналитики/подготовки: от первого входа в Upstream (Анализ и подготовка) до начала разработки. Отражает эффективность Discovery-процесса."
            values={upstreamValues}
          />
        </CompositeCard>

        <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
              Throughput{' '}
              <Tooltip text="Производительность команды: сколько задач завершается за неделю. Стабильный Throughput — признак предсказуемого потока. Используйте для прогнозирования сроков." />
            </div>
            <div className="text-[38px] font-extrabold text-donezo-dark leading-none tracking-tight">{fmtNum(mean(tpValues))}</div>
            <div className="text-xs text-gray-400 mt-1">среднее задач / нед.</div>
            {(() => {
              const typeNames = [...new Set(tpWeeks.flatMap((w) => Object.keys(w.byType ?? {})))];
              if (!typeNames.length) return null;
              return (
                <div className="mt-1.5 mb-2 space-y-0.5">
                  {typeNames.map((name) => {
                    const avg = tpWeeks.reduce((sum, week) => sum + (week.byType?.[name] ?? 0), 0) / (tpWeeks.length || 1);
                    return (
                      <div key={name} className="text-xs text-gray-400">
                        {name}: {avg.toFixed(1)} / нед.
                      </div>
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
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <CompositeCard title="WIP">
          <WipSlice
            title="Upstream"
            tooltip="Задачи в стадии аналитики, подготовки и Discovery. Статусы: Готово к анализу, Анализ, Готово к разработке и др."
            statusCounts={wipBuckets.upstream}
            badgeClass="bg-amber-50 border border-amber-100"
            badgeTextClass="text-amber-700"
          />
          <WipSlice
            title="Downstream"
            tooltip="Задачи в стадии разработки, тестирования и релиза. Статусы: Разработка, Code review, Тестирование и др."
            statusCounts={wipBuckets.downstream}
            badgeClass="bg-blue-50 border border-blue-100"
            badgeTextClass="text-blue-700"
          />
        </CompositeCard>
      </div>
    </div>
  );
}
