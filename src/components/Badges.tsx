import type { JSX } from 'react';
import { getTypeBadgeClasses } from '../lib/issueTypes';

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

export function StatusBadge({ status }: { status: string }): JSX.Element {
  const norm = status.toUpperCase();
  let bg = 'bg-gray-100 text-gray-700 border-gray-200';

  // Discovery / Research
  if (['ИДЕЯ', 'ПРОРАБОТКА ИДЕИ', 'ПОДГОТОВКА К ИССЛЕДОВАНИЮ', 'ПРОВЕРКА ГИПОТЕЗЫ', 'РАЗРАБОТКА ПРОТОТИПА', 'ОЦЕНКА РИСКА'].includes(norm)) {
    bg = 'bg-purple-50 text-purple-700 border-purple-200';
  } 
  // Backlog & Analysis & Ready for dev
  else if (['БЭКЛОГ', 'ГОТОВО К АНАЛИЗУ', 'АНАЛИЗ', 'ОЖИДАЕТ ПЛАНА ПРИЕМКИ', 'ПЛАН ПРИЕМКИ', 'ГОТОВО К РАЗРАБОТКЕ', 'ПОДГОТОВКА ТЕСТ-КЕЙСОВ'].includes(norm)) {
    bg = 'bg-blue-50 text-blue-700 border-blue-200';
  } 
  // In Progress
  else if (['РАЗРАБОТКА', 'IN PROGRESS'].includes(norm)) {
    bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
  } 
  // QA / Review / Testing
  else if (['CODE REVIEW', 'ПРАВКИ', 'ГОТОВО К ТЕСТИРОВАНИЮ', 'ТЕСТИРОВАНИЕ STAGE', 'РЕГРЕСС', 'ТЕСТ ОО', 'ГОТОВО К ПРИЕМКЕ', 'ПРИЕМКА'].includes(norm)) {
    bg = 'bg-orange-50 text-orange-700 border-orange-200';
  } 
  // Done / Release
  else if (['ГОТОВО К PROD', 'УСТАНОВЛЕНО', 'ЧАСТИЧНЫЙ РЕЛИЗ', 'РЕЛИЗ', 'РЕВЬЮ', 'ГОТОВО', 'DONE'].includes(norm)) {
    bg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } 
  // Cancelled / Archive
  else if (['ОТМЕНЕНА', 'CANCELED', 'CANCELLED'].includes(norm)) {
    bg = 'bg-red-50 text-red-700 border-red-200';
  } else if (['АРХИВ', 'ARCHIVE'].includes(norm)) {
    bg = 'bg-slate-100 text-slate-600 border-slate-200';
  }

  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${bg}`}>
      {status}
    </span>
  );
}
