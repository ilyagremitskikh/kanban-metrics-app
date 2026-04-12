import { useState, useMemo } from 'react';
import { Plus, Pencil, Loader2, ClipboardList, RefreshCw, ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown, MinusCircle, Equal } from 'lucide-react';
import type { JiraIssueShort } from '../types';
import { JIRA_BASE_URL } from '../types';
import IssueSlideOver from './IssueSlideOver';
import CreateIssueForm from './CreateIssueForm';
import EditIssueForm from './EditIssueForm';
import { TypeBadge, StatusBadge } from './Badges';
import { getUniqueTypes } from '../lib/issueTypes';
import { normalizePriority } from '../lib/priorities';

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

// Priority display config — русские значения из Jira
interface PriorityCfg { icon: React.ReactNode; cls: string }
const PRIORITY_CFG: Record<string, PriorityCfg> = {
  'Неотложный':    { icon: <MinusCircle size={12} />, cls: 'text-red-600 bg-red-50' },
  'Срочный':       { icon: <ChevronsUp size={12} />,  cls: 'text-orange-600 bg-orange-50' },
  'Высокий':       { icon: <ChevronUp size={12} />,   cls: 'text-orange-500 bg-orange-50' },
  'Нормальный':    { icon: <ChevronDown size={12} />, cls: 'text-blue-500 bg-blue-50' },
  'Средний':       { icon: <Equal size={12} />,       cls: 'text-yellow-600 bg-yellow-50' },
  'Низкий':        { icon: <ChevronsDown size={12} />,cls: 'text-blue-400 bg-blue-50' },
  'Незначительный':{ icon: <Minus size={12} />,       cls: 'text-gray-400 bg-gray-100' },
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY_CFG[normalizePriority(priority)] ?? PRIORITY_CFG['Нормальный'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${cfg.cls}`}>
      {cfg.icon}
      {priority}
    </span>
  );
}

// --- T-001: Category bucket logic ---
const CATEGORY_MAP: Record<string, string> = {
  'User Story': 'User Story',
  'Задача':     'Задача',
  'Sub-task':   'Задача',
  'Подзадача':  'Задача',
  'Ошибка':     'Ошибки',
  'Bug':        'Ошибки',
  'Техдолг':    'Техдолг',
  'Tech Debt':  'Техдолг',
};

const CATEGORY_ORDER = ['User Story', 'Задача', 'Ошибки', 'Техдолг', 'Прочее'] as const;

// Category colors for section headers
const CATEGORY_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  'User Story': { bg: 'bg-emerald-50',  text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  'Задача':     { bg: 'bg-gray-50',     text: 'text-gray-600',    badge: 'bg-gray-200 text-gray-600' },
  'Ошибки':     { bg: 'bg-red-50',      text: 'text-red-700',     badge: 'bg-red-100 text-red-700' },
  'Техдолг':    { bg: 'bg-amber-50',    text: 'text-amber-700',   badge: 'bg-amber-100 text-amber-700' },
  'Прочее':     { bg: 'bg-gray-50',     text: 'text-gray-500',    badge: 'bg-gray-200 text-gray-500' },
};

function groupByCategory(issues: JiraIssueShort[]): { name: string; issues: JiraIssueShort[] }[] {
  const buckets = new Map<string, JiraIssueShort[]>(
    CATEGORY_ORDER.map(name => [name, []])
  );
  for (const issue of issues) {
    const category = CATEGORY_MAP[issue.issuetype] ?? 'Прочее';
    buckets.get(category)!.push(issue);
  }
  return CATEGORY_ORDER.map(name => ({ name, issues: buckets.get(name)! }));
}
// --- End T-001 ---

export default function IssuesTab({ n8nBaseUrl, issues, loading, refreshing, error, lastUpdatedText, onRefresh }: Props) {
  const [slideOver, setSlideOver] = useState<SlideOverMode | null>(null);
  const [scoreSortDir, setScoreSortDir] = useState<'desc' | 'asc' | null>(null);
  // T-003: collapse state — empty set = all expanded
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const getScore = (issue: JiraIssueShort): { value: number; type: 'rice' | 'bug' | 'techdebt' } | null => {
    if (issue.rice_score != null) return { value: issue.rice_score, type: 'rice' };
    if (issue.bug_score != null) return { value: issue.bug_score, type: 'bug' };
    if (issue.td_roi != null) return { value: issue.td_roi, type: 'techdebt' };
    if (issue.score != null) return { value: issue.score, type: 'rice' };
    return null;
  };

  const handleCreated = () => { onRefresh(); };
  const handleUpdated = () => { onRefresh(); };

  const slideOverTitle = slideOver?.mode === 'create'
    ? 'Создать задачу'
    : slideOver?.mode === 'edit'
      ? `Редактировать: ${slideOver.issueKey}`
      : '';

  const sortedIssues = useMemo(() => {
    if (!scoreSortDir) return issues;
    return [...issues].sort((a, b) => {
      const sa = getScore(a);
      const sb = getScore(b);
      if (sa === null && sb === null) return 0;
      if (sa === null) return 1;
      if (sb === null) return -1;
      return scoreSortDir === 'desc' ? sb.value - sa.value : sa.value - sb.value;
    });
  }, [issues, scoreSortDir]);

  // T-001 + T-002: memoized grouped categories, filter empty
  const groupedIssues = useMemo(() => groupByCategory(sortedIssues), [sortedIssues]);
  const nonEmptyGroups = useMemo(
    () => groupedIssues.filter(g => g.issues.length > 0),
    [groupedIssues]
  );
  const availableTypes = useMemo(() => getUniqueTypes(issues), [issues]);

  // T-003: toggle collapse
  const toggleCategory = (name: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleScoreSort = () => {
    setScoreSortDir(prev => (prev === null ? 'desc' : prev === 'desc' ? 'asc' : 'desc'));
  };

  const scoreHeaderSuffix = scoreSortDir === null ? '' : scoreSortDir === 'desc' ? ' ↓' : ' ↑';

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold text-donezo-dark tracking-tight">Задачи</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 text-sm font-medium
              border border-gray-200 rounded-full hover:bg-donezo-light hover:text-donezo-dark
              transition-all duration-200 disabled:opacity-50"
            title="Обновить"
          >
            <RefreshCw size={14} className={loading || refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setSlideOver({ mode: 'create' })}
            className="flex items-center gap-2 px-5 py-2.5 bg-donezo-dark text-white text-sm font-semibold
              rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
          >
            <Plus size={16} />
            Создать задачу
          </button>
        </div>
      </div>

      {/* Error */}
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

      {/* Loading */}
      {loading && issues.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
          <Loader2 size={28} className="animate-spin text-donezo-primary" />
          <span className="text-sm">Загружаем задачи...</span>
        </div>
      )}

      {/* Empty state */}
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
            className="flex items-center gap-2 px-5 py-2.5 bg-donezo-dark text-white text-sm font-semibold
              rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
          >
            <Plus size={16} />
            Создать задачу
          </button>
        </div>
      )}

      {/* T-002 + T-003: Grouped table */}
      {issues.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-donezo">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col className="w-28" />
              <col className="w-32" />
              <col /> {/* Summary — занимает всё остальное */}
              <col className="w-48" />
              <col className="w-28" />
              <col className="w-32" />
              <col className="w-12" />
            </colgroup>
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Ключ
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Тип
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Заголовок
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Статус
                </th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Приоритет
                </th>
                <th
                  className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-widest cursor-pointer select-none"
                  onClick={toggleScoreSort}
                >
                  Score{scoreHeaderSuffix}
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {nonEmptyGroups.map(group => {
                const colors = CATEGORY_COLORS[group.name] ?? CATEGORY_COLORS['Прочее'];
                const collapsed = collapsedCategories.has(group.name);
                return (
                  <>
                    {/* T-002: Category section header */}
                    <tr
                      key={`header-${group.name}`}
                      onClick={() => toggleCategory(group.name)}
                      className={`cursor-pointer border-t border-gray-100 ${colors.bg} hover:brightness-95 transition-all duration-150`}
                    >
                      <td colSpan={7} className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          {/* T-003: chevron indicator */}
                          {collapsed
                            ? <ChevronDown size={13} className={colors.text} />
                            : <ChevronUp size={13} className={colors.text} />
                          }
                          <span className={`text-xs font-bold uppercase tracking-widest ${colors.text}`}>
                            {group.name}
                          </span>
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${colors.badge}`}>
                            {group.issues.length}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* T-003: Issue rows — hidden when collapsed */}
                    {!collapsed && group.issues.map(issue => (
                      <tr
                        key={issue.key}
                        className="hover:bg-donezo-light/40 transition-colors duration-150 group border-t border-gray-50"
                      >
                        <td className="px-5 py-3.5">
                          <a
                            href={`${JIRA_BASE_URL}/${issue.key}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-xs font-bold text-donezo-primary hover:text-donezo-dark
                              hover:underline underline-offset-2 transition-colors duration-150 whitespace-nowrap"
                          >
                            {issue.key}
                          </a>
                        </td>
                        <td className="px-5 py-3.5">
                          <TypeBadge type={issue.issuetype} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-gray-800 text-sm line-clamp-2 break-words">
                            {issue.summary}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={issue.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          <PriorityBadge priority={issue.priority} />
                        </td>
                        <td className="px-5 py-3.5">
                          {(() => {
                            const score = getScore(issue);
                            if (!score) return null;
                            const cls = score.type === 'rice'
                              ? 'bg-blue-50 text-blue-700'
                              : score.type === 'bug'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-amber-50 text-amber-700';
                            const label = score.type === 'rice' ? 'RICE' : score.type === 'bug' ? 'Bug' : 'TechDebt';
                            return (
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold ${cls}`}>
                                {score.value}
                                <span>{label}</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3.5">
                          <button
                            onClick={() => setSlideOver({ mode: 'edit', issueKey: issue.key })}
                            className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-8 h-8
                              rounded-full bg-white border border-gray-200 text-gray-400 hover:text-donezo-dark
                              hover:border-donezo-light transition-all duration-200"
                            title="Редактировать"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
          {/* T-004: Footer with total count across all categories */}
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
            {issues.length} {issues.length === 1 ? 'задача' : issues.length < 5 ? 'задачи' : 'задач'}
          </div>
        </div>
      )}

      {/* Slide-over */}
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
