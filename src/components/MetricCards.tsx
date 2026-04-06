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
    <div className="bg-white rounded-xl p-5 shadow-sm">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
        {title} <Tooltip text={tooltip} />
      </div>
      <div className="text-[38px] font-extrabold text-slate-900 leading-none tracking-tight">{fmtNum(mean(values))}</div>
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

interface Props {
  ltValues: number[];
  ctValues: number[];
  tpWeeks: ThroughputWeek[];
  wipByStatus: Record<string, number>;
  wipNow: number;
  completedTotal: number;
}

export function MetricCards({ ltValues, ctValues, tpWeeks, wipByStatus, wipNow, completedTotal }: Props) {
  const tpValues  = tpWeeks.map((w) => w.count);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
      <TimeCard
        title="Lead Time"
        tooltip="Полное время жизни задачи: от входа в выбранный стартовый статус до финального. Включает ожидание в очереди. Отражает скорость доставки ценности с точки зрения клиента."
        values={ltValues}
      />
      <TimeCard
        title="Cycle Time"
        tooltip="Время активной работы: от момента, когда задача взята в работу, до завершения. Не включает ожидание в очереди. Отражает реальную производительность команды."
        values={ctValues}
      />
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          WIP (сейчас){' '}
          <Tooltip text="Work in Progress — задачи в работе, не достигшие финального статуса. По закону Литтла: Lead Time = WIP ÷ Throughput. Высокий WIP замедляет доставку." />
        </div>
        <div className="text-[38px] font-extrabold text-slate-900 leading-none tracking-tight">{wipNow}</div>
        <div className="text-xs text-gray-400 mt-1 mb-3.5">задач в работе</div>
        {Object.keys(wipByStatus).length > 0 && (
          <div className="space-y-1">
            {Object.entries(wipByStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 truncate mr-2">{status}</span>
                  <span className="font-bold text-gray-700 whitespace-nowrap">{count}</span>
                </div>
              ))}
          </div>
        )}
      </div>
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5 flex items-center gap-1.5">
          Throughput{' '}
          <Tooltip text="Производительность команды: сколько задач завершается за неделю. Стабильный Throughput — признак предсказуемого потока. Используйте для прогнозирования сроков." />
        </div>
        <div className="text-[38px] font-extrabold text-slate-900 leading-none tracking-tight">{fmtNum(mean(tpValues))}</div>
        <div className="text-xs text-gray-400 mt-1 mb-3.5">среднее задач / нед.</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
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
  );
}
