import type { JSX, ReactNode } from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown, MinusCircle, Equal } from 'lucide-react';

import { normalizePriority } from '../lib/priorities';
import { IssueTypeIcon } from './TaskTableCells';

type DotTone = 'green' | 'yellow' | 'red' | 'blue' | 'violet' | 'orange' | 'grey';

function statusTone(status: string): DotTone {
  const normalized = status.trim().toUpperCase();

  if (['ГОТОВО К PROD', 'УСТАНОВЛЕНО', 'ЧАСТИЧНЫЙ РЕЛИЗ', 'РЕЛИЗ', 'РЕВЬЮ', 'ГОТОВО', 'DONE'].includes(normalized)) {
    return 'green';
  }

  if (['РАЗРАБОТКА', 'IN PROGRESS'].includes(normalized)) {
    return 'yellow';
  }

  if (['CODE REVIEW', 'ПРАВКИ', 'ГОТОВО К ТЕСТИРОВАНИЮ', 'ТЕСТИРОВАНИЕ STAGE', 'РЕГРЕСС', 'ТЕСТ ОО', 'ГОТОВО К ПРИЕМКЕ', 'ПРИЕМКА'].includes(normalized)) {
    return 'orange';
  }

  if (['ОТМЕНЕНА', 'CANCELED', 'CANCELLED'].includes(normalized)) {
    return 'red';
  }

  if (['ИДЕЯ', 'ПРОРАБОТКА ИДЕИ', 'ПОДГОТОВКА К ИССЛЕДОВАНИЮ', 'ПРОВЕРКА ГИПОТЕЗЫ', 'РАЗРАБОТКА ПРОТОТИПА', 'ОЦЕНКА РИСКА'].includes(normalized)) {
    return 'violet';
  }

  if (['БЭКЛОГ', 'ГОТОВО К АНАЛИЗУ', 'АНАЛИЗ', 'ОЖИДАЕТ ПЛАНА ПРИЕМКИ', 'ПЛАН ПРИЕМКИ', 'ГОТОВО К РАЗРАБОТКЕ', 'ПОДГОТОВКА ТЕСТ-КЕЙСОВ'].includes(normalized)) {
    return 'blue';
  }

  return 'grey';
}

function statusDotClass(tone: DotTone): string {
  switch (tone) {
    case 'green':
      return 'bg-emerald-500';
    case 'yellow':
      return 'bg-amber-400';
    case 'red':
      return 'bg-rose-500';
    case 'blue':
      return 'bg-sky-400';
    case 'violet':
      return 'bg-violet-400';
    case 'orange':
      return 'bg-amber-500';
    default:
      return 'bg-zinc-400';
  }
}

interface PriorityCfg { icon: ReactNode; cls: string }
const PRIORITY_CFG: Record<string, PriorityCfg> = {
  'Неотложный':    { icon: <MinusCircle size={12} />, cls: 'text-red-700 bg-red-100 border-red-200' },
  'Срочный':       { icon: <ChevronsUp size={12} />, cls: 'text-orange-700 bg-orange-100 border-orange-200' },
  'Высокий':       { icon: <ChevronUp size={12} />, cls: 'text-orange-600 bg-orange-50 border-orange-200' },
  'Нормальный':    { icon: <ChevronDown size={12} />, cls: 'text-sky-700 bg-sky-100 border-sky-200' },
  'Средний':       { icon: <Equal size={12} />, cls: 'text-amber-700 bg-amber-100 border-amber-200' },
  'Низкий':        { icon: <ChevronsDown size={12} />, cls: 'text-blue-700 bg-blue-100 border-blue-200' },
  'Незначительный':{ icon: <Minus size={12} />, cls: 'text-slate-500 bg-slate-100 border-slate-200' },
};

export function TypeBadge({ type }: { type: string }): JSX.Element {
  return (
    <span
      title={type}
      className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium text-muted-foreground"
    >
      <span className="shrink-0 opacity-80">
        <IssueTypeIcon type={type} />
      </span>
      <span className="truncate">{type}</span>
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }): JSX.Element {
  const normalized = normalizePriority(priority);
  const cfg = PRIORITY_CFG[normalized] ?? PRIORITY_CFG['Нормальный'];

  return (
    <span
      title={normalized}
      aria-label={`Приоритет: ${normalized}`}
      className={`inline-flex items-center justify-center rounded-xl border px-2.5 py-1 ${cfg.cls}`}
    >
      {cfg.icon}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const tone = statusTone(status);

  return (
    <span
      title={status}
      className="inline-flex max-w-full items-center gap-1.5 text-[12px] font-medium text-foreground"
    >
      <span className={`size-2 shrink-0 rounded-full ${statusDotClass(tone)}`} aria-hidden="true" />
      <span className="truncate">{status}</span>
    </span>
  );
}
