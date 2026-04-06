import type { JSX } from 'react';

export function TypeBadge({ type }: { type: string }): JSX.Element {
  let icon = null;
  let colorCls = 'bg-gray-50 text-gray-600 border border-gray-200';

  if (type === 'User Story') {
    colorCls = 'bg-donezo-light text-donezo-dark border border-donezo-light';
    icon = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3.5 h-3.5 mr-1"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>;
  } else if (type === 'Ошибка' || type === 'Bug') {
    colorCls = 'bg-red-50 text-red-700 border border-red-100';
    icon = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3.5 h-3.5 mr-1"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
  } else if (type === 'Техдолг' || type === 'Tech Debt') {
    colorCls = 'bg-amber-50 text-amber-700 border border-amber-100';
    icon = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3.5 h-3.5 mr-1"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
  } else {
    icon = <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-3.5 h-3.5 mr-1"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
  }

  return (
    <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${colorCls} max-w-fit`} title={type}>
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
