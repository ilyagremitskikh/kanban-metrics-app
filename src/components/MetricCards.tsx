import { mean, percentile, fmtNum } from '../lib/utils';
import type { ThroughputWeek } from '../types';

function Tooltip({ text }: { text: string }) {
  return (
    <span className="metric-tooltip">
      ℹ<span className="tooltip-text">{text}</span>
    </span>
  );
}

interface TimeCardProps {
  title: string;
  tooltip: string;
  values: number[];
}

function TimeCard({ title, tooltip, values }: TimeCardProps) {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
        {title} <Tooltip text={tooltip} />
      </div>
      <div className="text-[38px] font-extrabold text-donezo-dark leading-none tracking-tight">{fmtNum(mean(values))}</div>
      <div className="text-xs text-gray-400 mt-1 mb-3.5">среднее, дней</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Медиана (P50)</div>
          <div className="text-sm font-bold text-gray-700">{fmtNum(percentile(values, 50))} d.</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">P85</div>
          <div className="text-sm font-bold text-gray-700">{fmtNum(percentile(values, 85))} d.</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">P95</div>
          <div className="text-sm font-bold text-gray-700">{fmtNum(percentile(values, 95))} d.</div>
        </div>
        <div>
          <div className="text-xs text-gray-400 mb-0.5">Выполнено</div>
          <div className="text-sm font-bold text-gray-700">{values.length}</div>
        </div>
      </div>
    </div>
  );
}

interface WipBucketCardProps {
  title: string;
  tooltip: string;
  statusCounts: Record<string, number>;
  badgeClass: string;
  badgeTextClass: string;
}

function WipBucketCard({ title, tooltip, statusCounts, badgeClass, badgeTextClass }: WipBucketCardProps) {
  const total = Object.values(statusCounts).reduce((s, n) => s + n, 0);
  return (
    <div className="bg-white rounded-3xl p-6 shadow-donezo border border-gray-100 flex flex-col">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
        {title} <Tooltip text={tooltip} />
      </div>
      <div className="text-[38px] font-extrabold text-donezo-dark leading-none tracking-tight">{total}</div>
      <div className="text-xs text-gray-400 mt-1 mb-3.5">задач в работе</div>
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
      {/* Row 1: Time metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TimeCard
          title="Lead Time"
          tooltip="Полное время жизни задачи: от создания до перехода в «Готово». Включает ожидание в очереди. Отражает скорость доставки ценности с точки зрения клиента."
          values={ltValues}
        />
        <TimeCard
          title="Dev Cycle Time"
          tooltip="Время разработки: от первого входа в Downstream (Разработка и далее) до «Готово». Не включает аналитику и ожидание в очереди."
          values={ctValues}
        />
        <TimeCard
          title="Upstream Time"
          tooltip="Время аналитики/подготовки: от первого входа в Upstream (Анализ и подготовка) до начала разработки. Отражает эффективность Discovery-процесса."
          values={upstreamValues}
        />
      </div>

      {/* Row 2: WIP + Throughput */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <WipBucketCard
          title="WIP Upstream"
          tooltip="Задачи в стадии аналитики, подготовки и Discovery. Статусы: Готово к анализу, Анализ, Готово к разработке и др."
          statusCounts={wipBuckets.upstream}
          badgeClass="bg-amber-50 border border-amber-100"
          badgeTextClass="text-amber-700"
        />
        <WipBucketCard
          title="WIP Downstream"
          tooltip="Задачи в стадии разработки, тестирования и релиза. Статусы: Разработка, Code review, Тестирование и др."
          statusCounts={wipBuckets.downstream}
          badgeClass="bg-blue-50 border border-blue-100"
          badgeTextClass="text-blue-700"
        />
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
                    const avg = tpWeeks.reduce((s, w) => s + (w.byType?.[name] ?? 0), 0) / (tpWeeks.length || 1);
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
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Макс / нед.</div>
              <div className="text-sm font-bold text-gray-700">{tpValues.length ? Math.max(...tpValues) : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Всего выполнено</div>
              <div className="text-sm font-bold text-gray-700">{completedTotal}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
