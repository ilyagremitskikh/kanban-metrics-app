import type { JSX, ReactNode } from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown, MinusCircle, Equal } from 'lucide-react';
import { getTypeBadgeClasses } from '../lib/issueTypes';
import { normalizePriority } from '../lib/priorities';

export function TypeBadge({ type }: { type: string }): JSX.Element {
  const color = getTypeBadgeClasses(type);
  const icon = (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3.5 h-3.5 mr-1">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );

  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${color.bg} ${color.text} ${color.border} max-w-fit`} title={type}>
      {icon}
      <span>{type}</span>
    </div>
  );
}

interface PriorityCfg { icon: ReactNode; cls: string }
const PRIORITY_CFG: Record<string, PriorityCfg> = {
  'Неотложный':    { icon: <MinusCircle size={12} />, cls: 'text-red-700 bg-red-100 border-red-200' },
  'Срочный':       { icon: <ChevronsUp size={12} />,  cls: 'text-orange-700 bg-orange-100 border-orange-200' },
  'Высокий':       { icon: <ChevronUp size={12} />,   cls: 'text-orange-600 bg-orange-50 border-orange-200' },
  'Нормальный':    { icon: <ChevronDown size={12} />, cls: 'text-sky-700 bg-sky-100 border-sky-200' },
  'Средний':       { icon: <Equal size={12} />,       cls: 'text-amber-700 bg-amber-100 border-amber-200' },
  'Низкий':        { icon: <ChevronsDown size={12} />,cls: 'text-blue-700 bg-blue-100 border-blue-200' },
  'Незначительный':{ icon: <Minus size={12} />,       cls: 'text-slate-500 bg-slate-100 border-slate-200' },
};

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
  const norm = status.toUpperCase();
  let bg = 'bg-gray-100 text-gray-700 border-gray-200';
  let dot = 'bg-gray-400';

  if (['ИДЕЯ', 'ПРОРАБОТКА ИДЕИ', 'ПОДГОТОВКА К ИССЛЕДОВАНИЮ', 'ПРОВЕРКА ГИПОТЕЗЫ', 'РАЗРАБОТКА ПРОТОТИПА', 'ОЦЕНКА РИСКА'].includes(norm)) {
    bg = 'bg-purple-50 text-purple-800 border-purple-200';
    dot = 'bg-purple-500';
  } else if (['БЭКЛОГ', 'ГОТОВО К АНАЛИЗУ', 'АНАЛИЗ', 'ОЖИДАЕТ ПЛАНА ПРИЕМКИ', 'ПЛАН ПРИЕМКИ', 'ГОТОВО К РАЗРАБОТКЕ', 'ПОДГОТОВКА ТЕСТ-КЕЙСОВ'].includes(norm)) {
    bg = 'bg-cyan-50 text-cyan-800 border-cyan-200';
    dot = 'bg-cyan-500';
  } else if (['РАЗРАБОТКА', 'IN PROGRESS'].includes(norm)) {
    bg = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    dot = 'bg-indigo-500';
  } else if (['CODE REVIEW', 'ПРАВКИ', 'ГОТОВО К ТЕСТИРОВАНИЮ', 'ТЕСТИРОВАНИЕ STAGE', 'РЕГРЕСС', 'ТЕСТ ОО', 'ГОТОВО К ПРИЕМКЕ', 'ПРИЕМКА'].includes(norm)) {
    bg = 'bg-amber-100 text-amber-800 border-amber-200';
    dot = 'bg-amber-500';
  } else if (['ГОТОВО К PROD', 'УСТАНОВЛЕНО', 'ЧАСТИЧНЫЙ РЕЛИЗ', 'РЕЛИЗ', 'РЕВЬЮ', 'ГОТОВО', 'DONE'].includes(norm)) {
    bg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
    dot = 'bg-emerald-500';
  } else if (['ОТМЕНЕНА', 'CANCELED', 'CANCELLED'].includes(norm)) {
    bg = 'bg-red-100 text-red-800 border-red-200';
    dot = 'bg-red-500';
  } else if (['АРХИВ', 'ARCHIVE'].includes(norm)) {
    bg = 'bg-slate-100 text-slate-600 border-slate-200';
    dot = 'bg-slate-400';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold border ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
