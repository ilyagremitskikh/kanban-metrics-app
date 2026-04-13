import type { JSX, ReactNode } from 'react';
import { ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown, MinusCircle, Equal } from 'lucide-react';
import { normalizePriority } from '../lib/priorities';

type TypeTone = {
  cls: string;
  icon: JSX.Element;
};

function normalizeIssueType(type: string): string {
  return type.trim().toLowerCase();
}

function getTypeTone(type: string): TypeTone {
  const normalized = normalizeIssueType(type);

  if (normalized === 'ошибка' || normalized === 'bug') {
    return {
      cls: 'border-red-200 bg-red-50 text-red-700',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9V7a4 4 0 118 0v2m-9 0h10l-1 8H8l-1-8Zm3 4h.01M14 13h.01" />
        </svg>
      ),
    };
  }

  if (normalized === 'техдолг' || normalized === 'tech debt') {
    return {
      cls: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.5 6.5a4.5 4.5 0 01-6.36 6.36L4 17l3 3 4.14-4.14a4.5 4.5 0 006.36-6.36L14.5 6.5Z" />
        </svg>
      ),
    };
  }

  if (normalized === 'user story') {
    return {
      cls: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6m2-6h8a2 2 0 012 2v8a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2Z" />
        </svg>
      ),
    };
  }

  if (normalized === 'задача' || normalized === 'task') {
    return {
      cls: 'border-sky-200 bg-sky-50 text-sky-700',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" />
        </svg>
      ),
    };
  }

  if (normalized === 'sub-task' || normalized === 'подзадача' || normalized === 'business sub-task') {
    return {
      cls: 'border-indigo-200 bg-indigo-50 text-indigo-700',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h6m-6 5h10M4 7h.01M4 12h.01M4 17h.01" />
        </svg>
      ),
    };
  }

  return {
    cls: 'border-slate-200 bg-slate-50 text-slate-700',
    icon: (
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="mr-1 h-3.5 w-3.5">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9l-4-4H9Z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6" />
      </svg>
    ),
  };
}

export function TypeBadge({ type }: { type: string }): JSX.Element {
  const tone = getTypeTone(type);

  return (
    <div className={`inline-flex max-w-fit items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${tone.cls}`} title={type}>
      {tone.icon}
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
