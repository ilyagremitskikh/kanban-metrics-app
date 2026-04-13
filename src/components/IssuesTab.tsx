import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Loader2, ClipboardList, RefreshCw } from 'lucide-react';
import type { JiraIssueShort } from '../types';
import { JIRA_BASE_URL } from '../types';
import IssueSlideOver from './IssueSlideOver';
import CreateIssueForm from './CreateIssueForm';
import EditIssueForm from './EditIssueForm';
import { TypeBadge, StatusBadge, PriorityBadge } from './Badges';
import { getUniqueTypes } from '../lib/issueTypes';

interface Props {
  n8nBaseUrl: string;
  issues: JiraIssueShort[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedText: string | null;
  onRefresh: () => void;
}

type SlideOverMode = { mode: 'create' } | { mode: 'edit'; issueKey: string };
type IssueCategory = 'User Story' | 'Задача' | 'Ошибки' | 'Техдолг' | 'Прочее';

const CATEGORY_MAP: Record<string, IssueCategory> = {
  'User Story': 'User Story',
  'Задача': 'Задача',
  'Sub-task': 'Задача',
  'Подзадача': 'Задача',
  'Ошибка': 'Ошибки',
  'Bug': 'Ошибки',
  'Техдолг': 'Техдолг',
  'Tech Debt': 'Техдолг',
};

const CATEGORY_ORDER: readonly IssueCategory[] = ['User Story', 'Задача', 'Ошибки', 'Техдолг', 'Прочее'];

const CATEGORY_COLORS: Record<IssueCategory, { pill: string; text: string; muted: string }> = {
  'User Story': { pill: 'bg-emerald-100 text-emerald-800 border-emerald-200', text: 'text-emerald-900', muted: 'text-emerald-700' },
  'Задача': { pill: 'bg-slate-100 text-slate-800 border-slate-200', text: 'text-slate-900', muted: 'text-slate-600' },
  'Ошибки': { pill: 'bg-red-100 text-red-800 border-red-200', text: 'text-red-900', muted: 'text-red-700' },
  'Техдолг': { pill: 'bg-amber-100 text-amber-800 border-amber-200', text: 'text-amber-900', muted: 'text-amber-700' },
  'Прочее': { pill: 'bg-gray-100 text-gray-700 border-gray-200', text: 'text-gray-900', muted: 'text-gray-500' },
};

function getIssueCategory(issue: JiraIssueShort): IssueCategory {
  return CATEGORY_MAP[issue.issuetype] ?? 'Прочее';
}

function getScoreBadge(issue: JiraIssueShort, category: IssueCategory): { value: number; label: 'RICE' | 'Bug' | 'TechDebt'; cls: string } | null {
  if (category === 'User Story' || category === 'Задача') {
    const value = issue.rice_score ?? issue.score;
    if (value != null) return { value, label: 'RICE', cls: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (category === 'Ошибки') {
    const value = issue.bug_score ?? issue.score;
    if (value != null) return { value, label: 'Bug', cls: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (category === 'Техдолг') {
    const value = issue.td_roi ?? issue.score;
    if (value != null) return { value, label: 'TechDebt', cls: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  return null;
}

export default function IssuesTab({ n8nBaseUrl, issues, loading, refreshing, error, lastUpdatedText, onRefresh }: Props) {
  const [slideOver, setSlideOver] = useState<SlideOverMode | null>(null);
  const [scoreSortDir, setScoreSortDir] = useState<'desc' | 'asc' | null>(null);
  const [activeCategory, setActiveCategory] = useState<IssueCategory | null>(null);

  const handleCreated = () => { onRefresh(); };
  const handleUpdated = () => { onRefresh(); };

  const slideOverTitle = slideOver?.mode === 'create'
    ? 'Создать задачу'
    : slideOver?.mode === 'edit'
      ? `Редактировать: ${slideOver.issueKey}`
      : '';

  const availableTypes = useMemo(() => getUniqueTypes(issues), [issues]);

  const visibleTabs = useMemo(() => {
    const counts = new Map<IssueCategory, number>(CATEGORY_ORDER.map((category) => [category, 0]));
    for (const issue of issues) {
      const category = getIssueCategory(issue);
      counts.set(category, (counts.get(category) ?? 0) + 1);
    }
    return CATEGORY_ORDER
      .map((category) => ({ category, count: counts.get(category) ?? 0 }))
      .filter((tab) => tab.count > 0);
  }, [issues]);

  useEffect(() => {
    if (!visibleTabs.length) {
      setActiveCategory(null);
      return;
    }
    if (activeCategory && visibleTabs.some((tab) => tab.category === activeCategory)) return;
    setActiveCategory(visibleTabs[0].category);
  }, [activeCategory, visibleTabs]);

  const activeIssues = useMemo(() => {
    if (!activeCategory) return [];
    const filtered = issues.filter((issue) => getIssueCategory(issue) === activeCategory);
    if (!scoreSortDir) return filtered;

    return [...filtered].sort((a, b) => {
      const sa = getScoreBadge(a, activeCategory);
      const sb = getScoreBadge(b, activeCategory);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return scoreSortDir === 'desc' ? sb.value - sa.value : sa.value - sb.value;
    });
  }, [activeCategory, issues, scoreSortDir]);

  const scoreHeaderSuffix = scoreSortDir === null ? '' : scoreSortDir === 'desc' ? ' ↓' : ' ↑';
  const activeCategoryColors = activeCategory ? CATEGORY_COLORS[activeCategory] : CATEGORY_COLORS['Прочее'];

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-extrabold text-donezo-dark tracking-tight">Задачи</h2>
          {activeCategory && (
            <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${activeCategoryColors.pill}`}>
              {activeCategory}
              <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-extrabold">{activeIssues.length}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium border border-gray-200 rounded-full hover:bg-donezo-light hover:text-donezo-dark transition-all duration-200 disabled:opacity-50"
            title="Обновить"
          >
            <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setSlideOver({ mode: 'create' })}
            className="flex items-center gap-2 px-5 py-2.5 bg-donezo-dark text-white text-sm font-semibold rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
          >
            <Plus size={16} />
            Создать задачу
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600">
          {error}
        </div>
      )}

      {!error && lastUpdatedText && (
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm text-gray-500">
          {lastUpdatedText}
        </div>
      )}

      {loading && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin text-donezo-primary" />
          <span className="text-sm">Загружаем задачи...</span>
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-16 h-16 rounded-full bg-donezo-light flex items-center justify-center">
            <ClipboardList size={28} className="text-donezo-dark" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-700">Задач пока нет</p>
            <p className="text-sm text-gray-400 mt-1">{n8nBaseUrl ? 'Данные загрузятся автоматически при открытии вкладки или по кнопке обновления' : 'Укажите n8n URL в настройках'}</p>
          </div>
          <button
            onClick={() => setSlideOver({ mode: 'create' })}
            className="flex items-center gap-2 px-5 py-2.5 bg-donezo-dark text-white text-sm font-semibold rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
          >
            <Plus size={16} />
            Создать задачу
          </button>
        </div>
      )}

      {visibleTabs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {visibleTabs.map((tab) => {
            const colors = CATEGORY_COLORS[tab.category];
            const isActive = activeCategory === tab.category;
            return (
              <button
                key={tab.category}
                onClick={() => setActiveCategory(tab.category)}
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? `${colors.pill} shadow-sm`
                    : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-800'
                }`}
              >
                {tab.category}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${isActive ? 'bg-white/80 text-current' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeCategory && activeIssues.length > 0 && (
        <div className="bg-white rounded-[28px] border border-gray-100 overflow-hidden shadow-donezo">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-white via-white to-gray-50/80">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className={`text-sm font-extrabold ${activeCategoryColors.text}`}>{activeCategory}</div>
                <div className={`text-xs mt-1 ${activeCategoryColors.muted}`}>{activeIssues.length} задач в этой категории</div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col className="w-28" />
                <col className="w-32" />
                <col />
                <col className="w-36" />
                <col className="w-20" />
                <col className="w-28" />
                <col className="w-12" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Ключ</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Тип</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Заголовок</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Статус</th>
                  <th className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Приор.</th>
                  <th
                    className="text-left px-4 py-3.5 text-[11px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer select-none"
                    onClick={() => setScoreSortDir((prev) => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : 'desc'))}
                  >
                    Score{scoreHeaderSuffix}
                  </th>
                  <th className="w-12" />
                </tr>
              </thead>
              <tbody>
                {activeIssues.map((issue) => {
                  const category = getIssueCategory(issue);
                  const score = getScoreBadge(issue, category);

                  return (
                    <tr
                      key={issue.key}
                      className="group border-b border-gray-50 last:border-none transition-colors duration-150 hover:bg-donezo-light/40"
                    >
                      <td className="px-4 py-3.5 align-middle">
                        <a
                          href={`${JIRA_BASE_URL}/${issue.key}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs font-bold text-donezo-primary hover:text-donezo-dark hover:underline underline-offset-2 transition-colors duration-150 whitespace-nowrap"
                        >
                          {issue.key}
                        </a>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <TypeBadge type={issue.issuetype} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <span className="text-slate-900 text-sm font-medium leading-6 line-clamp-2 break-words group-hover:text-donezo-dark transition-colors">
                          {issue.summary}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <StatusBadge status={issue.status} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        <PriorityBadge priority={issue.priority} />
                      </td>
                      <td className="px-4 py-3.5 align-middle">
                        {score ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[10px] font-extrabold ${score.cls}`}>
                            <span>{score.value}</span>
                            <span>{score.label}</span>
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-3.5 align-middle">
                        <button
                          onClick={() => setSlideOver({ mode: 'edit', issueKey: issue.key })}
                          className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8 rounded-full bg-white border border-gray-200 text-gray-400 hover:text-donezo-dark hover:border-donezo-light transition-all duration-200 shadow-sm"
                          title="Редактировать"
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
            {activeIssues.length} {activeIssues.length === 1 ? 'задача' : activeIssues.length < 5 ? 'задачи' : 'задач'} на вкладке
          </div>
        </div>
      )}

      <IssueSlideOver
        open={slideOver !== null}
        onClose={() => setSlideOver(null)}
        title={slideOverTitle}
      >
        {slideOver?.mode === 'create' && (
          <CreateIssueForm
            n8nBaseUrl={n8nBaseUrl}
            availableTypes={availableTypes}
            onCreated={handleCreated}
            onClose={() => setSlideOver(null)}
          />
        )}
        {slideOver?.mode === 'edit' && (
          <EditIssueForm
            n8nBaseUrl={n8nBaseUrl}
            availableTypes={availableTypes}
            issueKey={slideOver.issueKey}
            onUpdated={handleUpdated}
            onClose={() => setSlideOver(null)}
          />
        )}
      </IssueSlideOver>
    </div>
  );
}
