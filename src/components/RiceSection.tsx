import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';
import { InlineNumberInput } from './InlineNumberInput';
import { saveRiceScores, type RiceUpdate } from '../lib/riceApi';
import type { RiceIssue } from '../types';
import {
  StatusCell,
  SummaryCell,
  TaskScoreBadge,
  TaskScoreLabelBadge,
  type TaskScoreTone,
} from './TaskTableCells';
import { TasksDataTable, TasksDataTableSortHeader } from './TasksDataTable';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionCard, StatusHint } from '@/components/ui/admin';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Constants ─────────────────────────────────────────────────────────────────
const IMPACT_OPTIONS = [0.25, 0.5, 1, 2, 3];
const CONF_OPTIONS   = [25, 50, 80, 100];
const EFFORT_MIN     = 0.5;
const EFFORT_STEP    = 0.5;
const EFFORT_MAX     = 40;

const IMPACT_LABELS: Record<string, string> = {
  '0.25': 'Minimal', '0.5': 'Low', '1': 'Medium', '2': 'High', '3': 'Massive',
};

// FinTech Defect Scoring Model — discrete option sets (R / P / S / W)
const BUG_RISK_OPTIONS    = [0, 15, 40] as const;
const BUG_PROCESS_OPTIONS = [2, 10, 30] as const;
const BUG_SCALE_OPTIONS   = [2, 8,  15] as const;
const BUG_WA_OPTIONS      = [1, 7,  15] as const;

const BUG_RISK_LABELS:    Record<number, string> = { 40: 'Фин. риск / Закон / ИБ', 15: 'Массовые жалобы', 0: 'Нет влияния' };
const BUG_PROCESS_LABELS: Record<number, string> = { 30: 'Блокирует выдачу', 10: 'Частичный сбой', 2: 'Косметика' };
const BUG_SCALE_LABELS:   Record<number, string> = { 15: 'Все клиенты', 8: 'Сегмент / Редко', 2: 'Единичные случаи' };
const BUG_WA_LABELS:      Record<number, string> = { 15: 'Нет пути / Нужны технари', 7: 'Ручная поддержка', 1: 'Клиент сам обойдёт' };
const EMPTY_SELECT_VALUE = '__empty';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ScoreRow { reach: string; impact: string; confidence: string; effort: string }
interface BugRow   { bug_risk: string; bug_process: string; bug_scale: string; bug_workaround: string }
interface TdRow    { td_impact: string; td_effort: string }

type ScoringTab = 'rice' | 'bugs' | 'techdebt';

// ── Score calculators ─────────────────────────────────────────────────────────
function calcScore(row: ScoreRow): number | null {
  const r = parseFloat(row.reach), i = parseFloat(row.impact),
        c = parseFloat(row.confidence), e = parseFloat(row.effort);
  if (!row.reach || !row.impact || !row.confidence || !row.effort) return null;
  if (isNaN(r) || isNaN(i) || isNaN(c) || isNaN(e) || e === 0) return null;
  return Math.round((r * i * (c / 100)) / e);
}

function calcBugScore(row: BugRow): number | null {
  // Check empty strings explicitly — bug_risk can be "0" (valid value)
  if (row.bug_risk === '' || row.bug_process === '' || row.bug_scale === '' || row.bug_workaround === '') return null;
  const r = parseFloat(row.bug_risk), p = parseFloat(row.bug_process),
        s = parseFloat(row.bug_scale), w = parseFloat(row.bug_workaround);
  if (isNaN(r) || isNaN(p) || isNaN(s) || isNaN(w)) return null;
  return r + p + s + w;
}

function calcTdRoi(row: TdRow): number | null {
  if (!row.td_impact || !row.td_effort) return null;
  const i = parseFloat(row.td_impact), e = parseFloat(row.td_effort);
  if (isNaN(i) || isNaN(e) || e === 0) return null;
  return Math.round((i / e) * 100) / 100;
}

function tdQuadrant(impact: string, effort: string): { label: string; tone: TaskScoreTone; order: number } | null {
  const i = parseFloat(impact), e = parseFloat(effort);
  if (isNaN(i) || isNaN(e)) return null;
  if (i > 5 && e <= 5) return { label: 'Быстрая победа', tone: 'primary', order: 1 };
  if (i > 5 && e > 5)  return { label: 'Крупный проект', tone: 'primary', order: 2 };
  if (i <= 5 && e <= 5) return { label: 'Фоновая задача', tone: 'warning', order: 3 };
  return { label: 'Трата времени', tone: 'danger', order: 4 };
}

// ── Row initialisers ──────────────────────────────────────────────────────────
function initRow(issue: RiceIssue): ScoreRow {
  return {
    reach:      issue.reach      != null ? String(issue.reach)      : '',
    impact:     issue.impact     != null ? String(issue.impact)     : '',
    confidence: issue.confidence != null ? String(issue.confidence) : '',
    effort:     issue.effort     != null ? String(issue.effort)     : '',
  };
}

function initBugRow(issue: RiceIssue): BugRow {
  return {
    bug_risk:       issue.bug_risk       != null ? String(issue.bug_risk)       : '',
    bug_process:    issue.bug_process    != null ? String(issue.bug_process)    : '',
    bug_scale:      issue.bug_scale      != null ? String(issue.bug_scale)      : '',
    bug_workaround: issue.bug_workaround != null ? String(issue.bug_workaround) : '',
  };
}

function initTdRow(issue: RiceIssue): TdRow {
  return {
    td_impact: issue.td_impact != null ? String(issue.td_impact) : '',
    td_effort: issue.td_effort != null ? String(issue.td_effort) : '',
  };
}

// ── Badge colours ─────────────────────────────────────────────────────────────
function riceScoreTone(score: number | null, max: number): TaskScoreTone {
  if (score === null || max === 0) return 'muted';
  const pct = score / max;
  if (pct >= 0.66) return 'primary';
  if (pct >= 0.33) return 'warning';
  return 'muted';
}

function bugScoreTone(score: number | null): TaskScoreTone {
  if (score === null) return 'muted';
  if (score >= 75) return 'danger';
  if (score >= 50) return 'orange';
  if (score >= 20) return 'warning';
  return 'muted';
}

function bugSlaLabel(score: number): string {
  if (score >= 75) return 'BLOCKER';
  if (score >= 50) return 'CRITICAL';
  if (score >= 20) return 'MAJOR';
  return 'MINOR';
}

function minimalLabelToneClass(tone: TaskScoreTone): string {
  if (tone === 'danger') return 'border-transparent bg-red-50 text-red-700';
  if (tone === 'orange') return 'border-transparent bg-orange-50 text-orange-700';
  if (tone === 'warning') return 'border-transparent bg-amber-50 text-amber-700';
  if (tone === 'primary') return 'border-transparent bg-blue-50 text-blue-700';
  return 'border-transparent bg-muted text-muted-foreground';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function HeaderLabel({ title, hint, align = 'left' }: { title: string; hint?: string; align?: 'left' | 'center' }) {
  return (
    <div className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground ${align === 'center' ? 'justify-center text-center' : ''}`}>
      <span>{title}</span>
      {hint ? (
        <span title={hint} aria-label={hint}>
          <Info className="size-3 text-muted-foreground/70" />
        </span>
      ) : null}
    </div>
  );
}

function TableSelect({ options, value, onChange, disabled, placeholder = 'Выбрать…', getLabel = String, className = 'w-32' }: {
  options: readonly number[]; value: string; onChange: (v: string) => void;
  disabled?: boolean; placeholder?: string; getLabel?: (v: number) => string; className?: string;
}) {
  return (
    <Select
      value={value || EMPTY_SELECT_VALUE}
      onValueChange={(nextValue) => onChange(nextValue === EMPTY_SELECT_VALUE ? '' : nextValue)}
      disabled={disabled}
    >
      <SelectTrigger
        variant="ghost"
        className={`h-8 max-w-full rounded-md px-2 text-sm font-medium ${disabled ? 'text-muted-foreground' : ''} ${className}`}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={EMPTY_SELECT_VALUE}>{placeholder}</SelectItem>
        {options.map((opt) => {
          const s = String(opt);
          return <SelectItem key={s} value={s}>{getLabel(opt)}</SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}

function GhostNumberInput({ value, onChange, disabled, min = EFFORT_MIN, max = EFFORT_MAX, step = EFFORT_STEP, className }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  min?: number; max?: number; step?: number;
  className?: string;
}) {
  return (
    <InlineNumberInput
      value={value}
      onChange={onChange}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      variant="ghost"
      className={`h-8 w-16 no-spinner px-2 text-right text-sm font-medium tabular-nums ${disabled ? 'text-muted-foreground' : ''} ${className ?? ''}`}
    />
  );
}

function RankCell({ value, isDirty }: { value: number | null; isDirty: boolean }) {
  return (
    <div className="relative text-center text-xs font-bold text-gray-400 group-hover:text-slate-900">
      {isDirty && (
        <div className="absolute left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />
      )}
      {value ?? '—'}
    </div>
  );
}

// ── Main props ────────────────────────────────────────────────────────────────
interface Props {
  n8nBaseUrl: string;
  issues: RiceIssue[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdatedText: string | null;
  onRefreshFromJira: () => void;
  refreshBlocked: boolean;
  refreshBlockedReason: string;
  onSendToQueue: (items: string[]) => void;
  onSwitchToMetrics: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onSaved?: (updates: RiceUpdate[]) => void;
  embedded?: boolean;
  defaultTab?: ScoringTab;
  allowedTabs?: ScoringTab[];
}

// ═════════════════════════════════════════════════════════════════════════════
export function RiceSection({
  n8nBaseUrl,
  issues,
  loading,
  refreshing,
  error,
  lastUpdatedText,
  onRefreshFromJira,
  refreshBlocked,
  refreshBlockedReason,
  onSendToQueue,
  onSwitchToMetrics,
  onDirtyChange,
  onSaved,
  embedded = false,
  defaultTab = 'rice',
  allowedTabs,
}: Props) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [scoringTab, setScoringTab] = useState<ScoringTab>(defaultTab);
  const [scores,    setScores]    = useState<Map<string, ScoreRow>>(new Map());
  const [bugScores, setBugScores] = useState<Map<string, BugRow>>(new Map());
  const [tdScores,  setTdScores]  = useState<Map<string, TdRow>>(new Map());
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());

  // RICE sort
  const [sortTrigger, setSortTrigger] = useState(0);
  const [sortField,   setSortField]   = useState<'rice' | 'key'>('rice');
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc');
  // Bugs sort
  const [bugSortField, setBugSortField] = useState<'score' | 'key'>('score');
  const [bugSortDir,   setBugSortDir]   = useState<'asc' | 'desc'>('desc');
  // Tech Debt sort
  const [tdSortDir, setTdSortDir] = useState<'asc' | 'desc'>('desc');

  const [guideOpen, setGuideOpen] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    const riceMap = new Map<string, ScoreRow>();
    const bugMap  = new Map<string, BugRow>();
    const tdMap   = new Map<string, TdRow>();
    for (const issue of issues) {
      riceMap.set(issue.key, initRow(issue));
      bugMap.set(issue.key, initBugRow(issue));
      tdMap.set(issue.key, initTdRow(issue));
    }
    setScores(riceMap);
    setBugScores(bugMap);
    setTdScores(tdMap);
    setDirtyKeys(new Set());
    setSortTrigger((t) => t + 1);
  }, [issues]);

  useEffect(() => {
    onDirtyChange?.(dirtyKeys.size > 0);
  }, [dirtyKeys.size, onDirtyChange]);

  useEffect(() => {
    if (!allowedTabs?.length) return;
    if (!allowedTabs.includes(scoringTab)) setScoringTab(allowedTabs[0]);
  }, [allowedTabs, scoringTab]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const updates = issues.flatMap((issue): RiceUpdate[] => {
        if (!dirtyKeys.has(issue.key)) return [];

        if (issue.issue_type === 'Ошибка') {
          const row = bugScores.get(issue.key);
          if (!row) return [];
          const bug_score = calcBugScore(row);
          if (bug_score === null) return [];
          return [{ key: issue.key, reach: null, impact: null, confidence: null, effort: null, rice_score: null,
            bug_risk: parseFloat(row.bug_risk), bug_process: parseFloat(row.bug_process),
            bug_scale: parseFloat(row.bug_scale), bug_workaround: parseFloat(row.bug_workaround),
            bug_score, td_impact: null, td_effort: null, td_roi: null }];
        }

        if (issue.issue_type === 'Техдолг') {
          const row = tdScores.get(issue.key);
          if (!row) return [];
          const td_roi = calcTdRoi(row);
          if (td_roi === null) return [];
          return [{ key: issue.key, reach: null, impact: null, confidence: null, effort: null, rice_score: null,
            bug_risk: null, bug_process: null, bug_scale: null, bug_workaround: null, bug_score: null,
            td_impact: parseFloat(row.td_impact), td_effort: parseFloat(row.td_effort), td_roi }];
        }

        // User Story / Задача → RICE
        const row = scores.get(issue.key);
        if (!row) return [];
        const rice_score = calcScore(row);
        if (rice_score === null) return [];
        return [{ key: issue.key, reach: parseFloat(row.reach), impact: parseFloat(row.impact), confidence: parseFloat(row.confidence), effort: parseFloat(row.effort), rice_score,
          bug_risk: null, bug_process: null, bug_scale: null, bug_workaround: null, bug_score: null,
          td_impact: null, td_effort: null, td_roi: null }];
      });

      if (!updates.length) { setMsg({ text: 'Нет задач с корректно заполненными оценками для сохранения', ok: false }); return; }
      await saveRiceScores(n8nBaseUrl, updates);
      setDirtyKeys(new Set());
      onDirtyChange?.(false);
      setMsg({ text: `Успешно сохранено ${updates.length} задач`, ok: true });
      onSaved?.(updates);
    } catch (e) {
      setMsg({ text: `Ошибка при сохранении: ${(e as Error).message}`, ok: false });
    } finally { setSaving(false); }
  };

  // ── Field setters ─────────────────────────────────────────────────────────
  const markDirty = (key: string) => setDirtyKeys(prev => new Set(prev).add(key));

  const setField = (key: string, field: keyof ScoreRow, value: string) => {
    markDirty(key);
    setScores(prev => {
      const m = new Map(prev);
      const val = field === 'reach' && parseFloat(value) < 0 ? String(Math.abs(parseFloat(value))) : value;
      m.set(key, { ...m.get(key)!, [field]: val });
      return m;
    });
  };

  const setBugField = (key: string, field: keyof BugRow, value: string) => {
    markDirty(key);
    setBugScores(prev => { const m = new Map(prev); m.set(key, { ...m.get(key)!, [field]: value }); return m; });
  };

  const setTdField = (key: string, field: keyof TdRow, value: string) => {
    markDirty(key);
    setTdScores(prev => { const m = new Map(prev); m.set(key, { ...m.get(key)!, [field]: value }); return m; });
  };

  const setUrgent9999 = (key: string) => {
    markDirty(key);
    setScores(prev => { const m = new Map(prev); m.set(key, { reach: '9999', impact: '1', confidence: '100', effort: '1' }); return m; });
  };

  // ── Filtered lists ────────────────────────────────────────────────────────
  const riceIssues = useMemo(() => issues.filter(i => i.issue_type !== 'Ошибка' && i.issue_type !== 'Техдолг'), [issues]);
  const bugIssues  = useMemo(() => issues.filter(i => i.issue_type === 'Ошибка'), [issues]);
  const tdIssues   = useMemo(() => issues.filter(i => i.issue_type === 'Техдолг'), [issues]);

  // ── Sorted lists ──────────────────────────────────────────────────────────
  const sortedRice = useMemo(() => [...riceIssues].sort((a, b) => {
    if (sortField === 'rice') {
      const sa = calcScore(scores.get(a.key) ?? initRow(a)) ?? -1;
      const sb = calcScore(scores.get(b.key) ?? initRow(b)) ?? -1;
      return sortDir === 'desc' ? sb - sa : sa - sb;
    }
    return sortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [riceIssues, sortTrigger, sortField, sortDir]);

  const sortedBugs = useMemo(() => [...bugIssues].sort((a, b) => {
    if (bugSortField === 'score') {
      const sa = calcBugScore(bugScores.get(a.key) ?? initBugRow(a)) ?? -1;
      const sb = calcBugScore(bugScores.get(b.key) ?? initBugRow(b)) ?? -1;
      return bugSortDir === 'desc' ? sb - sa : sa - sb;
    }
    return bugSortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bugIssues, bugSortField, bugSortDir]);

  const sortedTd = useMemo(() => [...tdIssues].sort((a, b) => {
    const rowA = tdScores.get(a.key) ?? initTdRow(a);
    const rowB = tdScores.get(b.key) ?? initTdRow(b);
    const qA = tdQuadrant(rowA.td_impact, rowA.td_effort)?.order ?? 99;
    const qB = tdQuadrant(rowB.td_impact, rowB.td_effort)?.order ?? 99;
    if (qA !== qB) return tdSortDir === 'desc' ? qA - qB : qB - qA;
    const roiA = calcTdRoi(rowA) ?? -1;
    const roiB = calcTdRoi(rowB) ?? -1;
    return tdSortDir === 'desc' ? roiB - roiA : roiA - roiB;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [tdIssues, tdSortDir, sortTrigger]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const riceScoreValues = sortedRice
    .map(i => calcScore(scores.get(i.key) ?? initRow(i)))
    .filter((s): s is number => s !== null);
  const maxRiceScore    = riceScoreValues.length ? Math.max(...riceScoreValues) : 0;
  const scoredRice      = riceScoreValues.length;
  const scoredBugs      = bugIssues.filter(i => calcBugScore(bugScores.get(i.key) ?? initBugRow(i)) !== null).length;
  const scoredTd        = tdIssues.filter(i => calcTdRoi(tdScores.get(i.key) ?? initTdRow(i)) !== null).length;

  // ── Send to MC queue ──────────────────────────────────────────────────────
  const sendToQueue = async () => {
    if (dirtyKeys.size > 0) await save();
    const ranked = sortedRice.filter(i => calcScore(scores.get(i.key) ?? initRow(i)) !== null);
    onSendToQueue(ranked.map(i => `${i.key} — ${i.summary}`));
    onSwitchToMetrics();
  };

  const riceColumns = useMemo<ColumnDef<RiceIssue>[]>(() => [
    {
      id: 'rank',
      header: '#',
      cell: ({ row }) => {
        const score = calcScore(scores.get(row.original.key) ?? initRow(row.original));
        return <RankCell value={score !== null ? row.index + 1 : null} isDirty={dirtyKeys.has(row.original.key)} />;
      },
    },
    {
      id: 'summary',
      header: () => <HeaderLabel title="Summary" hint="контекст задачи" />,
      cell: ({ row }) => (
        <SummaryCell issueKey={row.original.key} issueType={row.original.issue_type}>
          {row.original.summary}
        </SummaryCell>
      ),
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'reach',
      header: () => <HeaderLabel title="Reach" hint="польз./мес." />,
      cell: ({ row }) => {
        const scoreRow = scores.get(row.original.key) ?? initRow(row.original);
        return (
          <InlineNumberInput
            className={`h-8 w-20 no-spinner px-2 text-right text-sm font-medium tabular-nums ${saving ? 'text-muted-foreground' : ''}`}
            value={scoreRow.reach}
            disabled={saving}
            variant="ghost"
            onChange={(v) => setField(row.original.key, 'reach', v)}
          />
        );
      },
    },
    {
      id: 'impact',
      header: () => <HeaderLabel title="Impact" hint="множитель" />,
      cell: ({ row }) => {
        const scoreRow = scores.get(row.original.key) ?? initRow(row.original);
        return (
          <TableSelect
            options={IMPACT_OPTIONS}
            value={scoreRow.impact}
            onChange={(v) => setField(row.original.key, 'impact', v)}
            disabled={saving}
            className="w-32"
            getLabel={(v) => `${IMPACT_LABELS[String(v)]} (${v})`}
          />
        );
      },
    },
    {
      id: 'confidence',
      header: () => <HeaderLabel title="Confidence" hint="уверенность" />,
      cell: ({ row }) => {
        const scoreRow = scores.get(row.original.key) ?? initRow(row.original);
        return (
          <TableSelect
            options={CONF_OPTIONS}
            value={scoreRow.confidence}
            onChange={(v) => setField(row.original.key, 'confidence', v)}
            disabled={saving}
            className="w-24"
            getLabel={(v) => `${v}%`}
          />
        );
      },
    },
    {
      id: 'effort',
      header: () => <HeaderLabel title="Effort" hint="сторипоинты" />,
      cell: ({ row }) => {
        const scoreRow = scores.get(row.original.key) ?? initRow(row.original);
        return <GhostNumberInput value={scoreRow.effort} onChange={(v) => setField(row.original.key, 'effort', v)} disabled={saving} />;
      },
    },
    {
      id: 'rice',
      header: () => (
        <TasksDataTableSortHeader
          active={sortField === 'rice'}
          dir={sortDir}
          align="center"
          onClick={() => { if (sortField === 'rice') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('rice'); setSortDir('desc'); } }}
        >
          RICE
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => {
        const score = calcScore(scores.get(row.original.key) ?? initRow(row.original));
        return (
          <div className="relative text-center group/rice">
            {score !== null
              ? (
                <TaskScoreBadge
                  value={score}
                  tone={riceScoreTone(score, maxRiceScore)}
                  className="rounded-md border-transparent bg-transparent px-1 text-sm font-bold text-foreground shadow-none"
                />
              )
              : <span className="text-gray-300 text-base">—</span>}
            <Button
              title="Установить срочно (RICE 9999)"
              onClick={() => setUrgent9999(row.original.key)}
              disabled={saving}
              variant="secondary"
              size="icon"
              className="absolute right-0 top-1/2 size-7 -translate-y-1/2 opacity-0 transition-all group-hover/rice:opacity-100 disabled:opacity-0"
            >🔥</Button>
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [scores, dirtyKeys, saving, sortField, sortDir, maxRiceScore]);

  const bugColumns = useMemo<ColumnDef<RiceIssue>[]>(() => [
    {
      id: 'rank',
      header: '#',
      cell: ({ row }) => {
        const score = calcBugScore(bugScores.get(row.original.key) ?? initBugRow(row.original));
        return <RankCell value={score !== null ? row.index + 1 : null} isDirty={dirtyKeys.has(row.original.key)} />;
      },
    },
    {
      id: 'summary',
      header: () => <HeaderLabel title="Summary" hint="контекст дефекта" />,
      cell: ({ row }) => (
        <SummaryCell issueKey={row.original.key} issueType={row.original.issue_type}>
          {row.original.summary}
        </SummaryCell>
      ),
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'risk',
      header: () => <HeaderLabel title="R — Риски" hint="фин./юрид./репутационные" />,
      cell: ({ row }) => {
        const bugRow = bugScores.get(row.original.key) ?? initBugRow(row.original);
        return <TableSelect options={[...BUG_RISK_OPTIONS]} value={bugRow.bug_risk} onChange={(v) => setBugField(row.original.key, 'bug_risk', v)} disabled={saving} getLabel={(v) => BUG_RISK_LABELS[v]} />;
      },
    },
    {
      id: 'process',
      header: () => <HeaderLabel title="P — Процесс" hint="кредитный конвейер" />,
      cell: ({ row }) => {
        const bugRow = bugScores.get(row.original.key) ?? initBugRow(row.original);
        return <TableSelect options={[...BUG_PROCESS_OPTIONS]} value={bugRow.bug_process} onChange={(v) => setBugField(row.original.key, 'bug_process', v)} disabled={saving} getLabel={(v) => BUG_PROCESS_LABELS[v]} />;
      },
    },
    {
      id: 'scale',
      header: () => <HeaderLabel title="S — Масштаб" hint="охват проблемы" />,
      cell: ({ row }) => {
        const bugRow = bugScores.get(row.original.key) ?? initBugRow(row.original);
        return <TableSelect options={[...BUG_SCALE_OPTIONS]} value={bugRow.bug_scale} onChange={(v) => setBugField(row.original.key, 'bug_scale', v)} disabled={saving} getLabel={(v) => BUG_SCALE_LABELS[v]} />;
      },
    },
    {
      id: 'workaround',
      header: () => <HeaderLabel title="W — Workaround" hint="обходной путь" />,
      cell: ({ row }) => {
        const bugRow = bugScores.get(row.original.key) ?? initBugRow(row.original);
        return <TableSelect options={[...BUG_WA_OPTIONS]} value={bugRow.bug_workaround} onChange={(v) => setBugField(row.original.key, 'bug_workaround', v)} disabled={saving} getLabel={(v) => BUG_WA_LABELS[v]} />;
      },
    },
    {
      id: 'score',
      header: () => (
        <TasksDataTableSortHeader
          active={bugSortField === 'score'}
          dir={bugSortDir}
          align="center"
          hint="макс. 100"
          onClick={() => { if (bugSortField === 'score') setBugSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setBugSortField('score'); setBugSortDir('desc'); } }}
        >
          Score
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => {
        const score = calcBugScore(bugScores.get(row.original.key) ?? initBugRow(row.original));
        const tone = bugScoreTone(score);
        return (
          <div className="text-center">
            {score !== null ? (
              <div className="flex flex-col items-center gap-1">
                <TaskScoreBadge
                  value={score}
                  tone={tone}
                  className="rounded-md border-transparent bg-transparent px-1 text-sm font-bold text-foreground shadow-none"
                />
                <TaskScoreLabelBadge tone={tone} className={`shadow-none ${minimalLabelToneClass(tone)}`}>
                  {bugSlaLabel(score)}
                </TaskScoreLabelBadge>
              </div>
            ) : <span className="text-gray-300 text-base">—</span>}
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [bugScores, dirtyKeys, saving, bugSortField, bugSortDir]);

  const tdColumns = useMemo<ColumnDef<RiceIssue>[]>(() => [
    {
      id: 'rank',
      header: '#',
      cell: ({ row }) => {
        const roi = calcTdRoi(tdScores.get(row.original.key) ?? initTdRow(row.original));
        return <RankCell value={roi !== null ? row.index + 1 : null} isDirty={dirtyKeys.has(row.original.key)} />;
      },
    },
    {
      id: 'summary',
      header: () => <HeaderLabel title="Summary" hint="контекст долга" />,
      cell: ({ row }) => (
        <SummaryCell issueKey={row.original.key} issueType={row.original.issue_type}>
          {row.original.summary}
        </SummaryCell>
      ),
    },
    {
      id: 'status',
      header: 'Статус',
      cell: ({ row }) => <StatusCell status={row.original.status} />,
    },
    {
      id: 'impact',
      header: () => <HeaderLabel title="Impact" hint="ценность решения (1–10)" />,
      cell: ({ row }) => {
        const tdRow = tdScores.get(row.original.key) ?? initTdRow(row.original);
        return <GhostNumberInput value={tdRow.td_impact} onChange={(v) => setTdField(row.original.key, 'td_impact', v)} disabled={saving} min={1} max={10} step={1} />;
      },
    },
    {
      id: 'effort',
      header: () => <HeaderLabel title="Effort" hint="трудозатраты (1–10)" />,
      cell: ({ row }) => {
        const tdRow = tdScores.get(row.original.key) ?? initTdRow(row.original);
        return <GhostNumberInput value={tdRow.td_effort} onChange={(v) => setTdField(row.original.key, 'td_effort', v)} disabled={saving} min={1} max={10} step={1} />;
      },
    },
    {
      id: 'roi',
      header: () => (
        <TasksDataTableSortHeader
          active
          dir={tdSortDir}
          align="center"
          hint="Impact ÷ Effort"
          onClick={() => setTdSortDir(d => d === 'asc' ? 'desc' : 'asc')}
        >
          ROI
        </TasksDataTableSortHeader>
      ),
      cell: ({ row }) => {
        const tdRow = tdScores.get(row.original.key) ?? initTdRow(row.original);
        const roi = calcTdRoi(tdRow);
        const q = tdQuadrant(tdRow.td_impact, tdRow.td_effort);
        return (
          <div className="text-center">
            {roi !== null && q ? (
              <div className="flex flex-col items-center gap-1">
                <TaskScoreBadge
                  value={roi}
                  tone={q.tone}
                  className="rounded-md border-transparent bg-transparent px-1 text-sm font-bold text-foreground shadow-none"
                />
                <TaskScoreLabelBadge tone={q.tone} className={`shadow-none ${minimalLabelToneClass(q.tone)}`}>
                  {q.label}
                </TaskScoreLabelBadge>
              </div>
            ) : <span className="text-gray-300 text-base">—</span>}
          </div>
        );
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [tdScores, dirtyKeys, saving, tdSortDir]);

  const ALL_SUB_TABS: { id: ScoringTab; label: string; scored: number; total: number }[] = [
    { id: 'rice',     label: 'Задачи',      scored: scoredRice,  total: riceIssues.length },
    { id: 'bugs',     label: 'Баги',        scored: scoredBugs,  total: bugIssues.length  },
    { id: 'techdebt', label: 'Техдолг',     scored: scoredTd,    total: tdIssues.length   },
  ];
  const SUB_TABS = ALL_SUB_TABS.filter((tab) => !allowedTabs || allowedTabs.includes(tab.id));

  // ── Current tab issues count for toolbar label ────────────────────────────
  const currentTabLabel = {
    rice:     `${riceIssues.length} задач · ${scoredRice} оценено`,
    bugs:     `${bugIssues.length} багов · ${scoredBugs} оценено`,
    techdebt: `${tdIssues.length} задач · ${scoredTd} оценено`,
  }[scoringTab];

  const currentTabTitle = {
    rice:     'Задачи: RICE приоритизация',
    bugs:     'Баги: FinTech Defect Scoring Model',
    techdebt: 'Техдолг: Impact / Effort Matrix',
  }[scoringTab];

  // ── Current tab has items ─────────────────────────────────────────────────
  const currentTabItems = { rice: riceIssues, bugs: bugIssues, techdebt: tdIssues }[scoringTab];

  // ═══════════════════════════════════════════════════════════════════════════
  const content = (
    <>
      {/* ── Sub-tab navigation ───────────────────────────────────────────── */}
      {SUB_TABS.length > 1 && <div className="mb-4 flex flex-wrap items-center gap-2">
        {SUB_TABS.map(({ id, label, scored, total }) => {
          const active = scoringTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => setScoringTab(id)}
              className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
            >
              <Badge
                variant={active ? 'secondary' : 'outline'}
                className="h-8 cursor-pointer gap-2 px-3 py-1.5 text-sm transition-colors hover:border-foreground/30 hover:bg-accent hover:text-accent-foreground"
              >
                <span>{label}</span>
                <span className="tabular-nums">{scored}/{total}</span>
              </Badge>
            </button>
          );
        })}
      </div>}

      {/* ── Collapsible guide (per tab) ──────────────────────────────────── */}
      <div className="mb-4 rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
        <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
          <CollapsibleTrigger className="flex w-full cursor-pointer list-none items-center justify-between rounded-2xl px-5 py-3 text-left font-bold text-slate-900 transition-colors hover:bg-muted/50 data-[state=open]:rounded-b-none">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              {scoringTab === 'rice'     && 'Что такое метод RICE и как он считается?'}
              {scoringTab === 'bugs'     && 'Как приоритизировать баги: FinTech Defect Scoring Model'}
              {scoringTab === 'techdebt' && 'Как приоритизировать техдолг: Impact / Effort Matrix'}
            </div>
            <svg className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${guideOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </CollapsibleTrigger>

          <CollapsibleContent className="space-y-4 rounded-b-2xl border-t border-border bg-muted/25 px-5 py-4 text-sm leading-relaxed text-gray-600">

            {/* RICE guide */}
            {scoringTab === 'rice' && (
              <>
                <p><strong>RICE</strong> — фреймворк для приоритизации фич и задач на основе объективных данных. Итоговый балл:</p>
                <div className="flex items-center justify-center py-2">
                  <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 font-mono text-center">
                    <div className="border-b border-gray-200 pb-1 mb-1">(Reach × Impact × Confidence%)</div>
                    <div>Effort</div>
                  </div>
                </div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">🌍 Reach (Охват)</strong>
                    Сколько пользователей затронет изменение за месяц? (любое положительное число).
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">🎯 Impact (Влияние)</strong>
                    Насколько сильно влияет на пользователя?
                    <span className="block mt-1 text-xs text-gray-400">Massive (3), High (2), Medium (1), Low (0.5), Minimal (0.25).</span>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">📊 Confidence (Уверенность)</strong>
                    Насколько вы уверены в оценках?
                    <span className="block mt-1 text-xs text-gray-400">100% (уверен), 80% (довольно уверен), 50% (интуиция), 25% (пальцем в небо).</span>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">⏳ Effort (Усилия)</strong>
                    Сколько сторипоинтов займёт внедрение? (от 0.5 до 40).
                  </li>
                </ul>
              </>
            )}

            {/* Bugs guide */}
            {scoringTab === 'bugs' && (
              <>
                <p><strong>FinTech Defect Scoring Model</strong> — реактивная оценка инцидентов, учитывающая специфику финансовых продуктов. Формула: <strong>Score = R + P + S + W</strong> (макс. 100)</p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-2">R — Риски (макс. 40)</strong>
                    Финансовые, юридические, репутационные последствия.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">40</span> — Потеря денег / уязвимость ИБ / нарушение закона ЦБ</li>
                      <li><span className="font-bold text-orange-600">15</span> — Жалобы в саппорт, простой бэк-офиса</li>
                      <li><span className="font-bold text-slate-500">0</span> — Прямого влияния нет</li>
                    </ul>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-2">P — Процесс (макс. 30)</strong>
                    Влияние на кредитный конвейер.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">30</span> — Блокирует выдачу, скоринг, подписание, погашение</li>
                      <li><span className="font-bold text-orange-600">10</span> — Процесс работает с деградацией</li>
                      <li><span className="font-bold text-slate-500">2</span> — Косметический дефект</li>
                    </ul>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-2">S — Масштаб (макс. 15)</strong>
                    Охват затронутых клиентов.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">15</span> — Все клиенты или флагманский продукт</li>
                      <li><span className="font-bold text-orange-600">8</span> — Узкий сегмент или редкий сценарий</li>
                      <li><span className="font-bold text-slate-500">2</span> — Единичные уникальные случаи</li>
                    </ul>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-2">W — Workaround (макс. 15)</strong>
                    Есть ли обходной путь.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">15</span> — Нет пути / нужно вмешательство технарей (БД/скрипты)</li>
                      <li><span className="font-bold text-orange-600">7</span> — Решается вручную L1/L2 поддержкой</li>
                      <li><span className="font-bold text-slate-500">1</span> — Клиент может сам (перезагрузить, повторить)</li>
                    </ul>
                  </li>
                </ul>
                <div className="rounded-xl border border-border bg-card p-4 text-xs text-gray-600 shadow-sm">
                  <strong className="block text-slate-900 mb-2">SLA-матрица реагирования:</strong>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-red-600">≥ 75 → BLOCKER</span> — Немедленный хотфикс, инцидент-команда, остановка релизов</li>
                    <li><span className="font-bold text-orange-600">50–74 → CRITICAL</span> — Высший приоритет, исправление в течение 24–48 ч</li>
                    <li><span className="font-bold text-amber-600">20–49 → MAJOR</span> — Плановое исправление в текущем или следующем спринте</li>
                    <li><span className="font-bold text-slate-500">&lt; 20 → MINOR</span> — Бэклог, исправляется по остаточному принципу</li>
                  </ul>
                </div>
              </>
            )}

            {/* Tech Debt guide */}
            {scoringTab === 'techdebt' && (
              <>
                <p><strong>Impact / Effort Matrix</strong> — максимизирует ROI от времени разработчиков. Задачи ранжируются по коэффициенту: <strong>ROI = Impact ÷ Effort</strong></p>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">Impact (Влияние) — 1–10</strong>
                    Какую пользу принесёт решение: ускорение работы, снижение нагрузки, устранение боли разработчиков.
                    <div className="mt-2 text-xs text-gray-400">10 = огромная польза, 1 = почти никакой</div>
                  </li>
                  <li className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <strong className="block text-slate-900 mb-1">Effort (Усилия) — 1–10</strong>
                    Сколько времени, денег и человеческих ресурсов потребуется на реализацию.
                    <div className="mt-2 text-xs text-gray-400">10 = огромные затраты, 1 = минимум усилий</div>
                  </li>
                </ul>
                <div className="rounded-xl border border-border bg-card p-4 text-xs text-gray-600 shadow-sm">
                  <strong className="block text-slate-900 mb-2">Матрица квадрантов (порог = 5):</strong>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-blue-700">Быстрая победа</span> — Impact &gt; 5, Effort ≤ 5 → Высший приоритет, максимальный ROI</li>
                    <li><span className="font-bold text-blue-700">Крупный проект</span> — Impact &gt; 5, Effort &gt; 5 → Стратегический долг, брать дозированно</li>
                    <li><span className="font-bold text-amber-700">Фоновая задача</span> — Impact ≤ 5, Effort ≤ 5 → Делать в свободное время</li>
                    <li><span className="font-bold text-red-700">Трата времени</span> — Impact ≤ 5, Effort &gt; 5 → Заморозить или удалить из бэклога</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-400">Задачи отсортированы по убыванию ROI — «быстрые победы» с наивысшим коэффициентом вверху.</p>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="mb-3 flex flex-col gap-3 rounded-2xl border border-border bg-muted/25 p-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-900">{currentTabTitle}</div>
          {issues.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">{currentTabLabel}</div>
          )}
          {!embedded && error ? (
            <div className="mt-2"><StatusHint tone="error">{error}</StatusHint></div>
          ) : !embedded && lastUpdatedText ? (
            <div className="mt-2"><StatusHint>{lastUpdatedText}</StatusHint></div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!embedded && <Button
            variant="secondary"
            onClick={onRefreshFromJira}
            disabled={loading || saving || refreshBlocked}
            title={refreshBlocked ? refreshBlockedReason : 'Обновить snapshot из Jira'}
          >
            {loading || refreshing ? 'Обновление…' : 'Обновить из Jira'}
          </Button>}
          {issues.length > 0 && (
            <>
              {(scoringTab === 'rice' || scoringTab === 'techdebt') && (
                <Button
                  variant="secondary"
                  size="icon"
                  className="min-w-[36px]"
                  onClick={() => setSortTrigger(t => t + 1)}
                  disabled={saving || loading}
                  title="Применить сортировку"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </Button>
              )}
              <Button
                variant={dirtyKeys.size > 0 ? 'default' : 'secondary'}
                onClick={save}
                disabled={saving || loading || dirtyKeys.size === 0}
              >
                {saving ? 'Сохранение…' : `Сохранить оценки${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ''}`}
              </Button>
              {scoringTab === 'rice' && scoredRice > 0 && (
                <Button onClick={sendToQueue} disabled={loading || saving}>
                  Отправить в очередь MC →
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Status message ────────────────────────────────────────────────── */}
      {msg && (
        <Alert variant={msg.ok ? 'success' : 'destructive'} className="mb-4"><AlertDescription>{msg.text}</AlertDescription></Alert>
      )}

      {/* ── Empty states ─────────────────────────────────────────────────── */}
      {issues.length === 0 && !loading && (
        <EmptyState
          title={scoringTab === 'rice' ? 'RICE: Reach × Impact × Confidence / Effort' : scoringTab === 'bugs' ? 'Score = R + P + S + W' : 'ROI = Impact / Effort'}
          description={n8nBaseUrl ? 'Данные загружаются автоматически при открытии вкладки. Кнопка сверху запускает принудительное обновление из Jira.' : 'Укажите n8n URL в настройках'}
        />
      )}

      {issues.length > 0 && currentTabItems.length === 0 && (
        <EmptyState title="Пустая категория" description="Задачи этого типа не найдены в загруженных данных" />
      )}

      {scoringTab === "rice" && sortedRice.length > 0 && (
        <TasksDataTable
          data={sortedRice}
          columns={riceColumns}
          getRowId={(issue) => issue.key}
          footerText={String(sortedRice.length) + " " + (sortedRice.length === 1 ? "задача" : sortedRice.length < 5 ? "задачи" : "задач") + " в RICE"}
          emptyTitle="Нет задач для RICE-оценки"
        />
      )}

      {scoringTab === "bugs" && sortedBugs.length > 0 && (
        <TasksDataTable
          data={sortedBugs}
          columns={bugColumns}
          getRowId={(issue) => issue.key}
          footerText={String(sortedBugs.length) + " " + (sortedBugs.length === 1 ? "баг" : sortedBugs.length < 5 ? "бага" : "багов") + " в оценке"}
          emptyTitle="Нет багов для оценки"
        />
      )}

      {scoringTab === "techdebt" && sortedTd.length > 0 && (
        <TasksDataTable
          data={sortedTd}
          columns={tdColumns}
          getRowId={(issue) => issue.key}
          footerText={String(sortedTd.length) + " " + (sortedTd.length === 1 ? "задача" : sortedTd.length < 5 ? "задачи" : "задач") + " техдолга"}
          emptyTitle="Нет техдолга для оценки"
        />
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      {!embedded && dirtyKeys.size > 0 && (
        <div className="fixed bottom-8 right-8 z-50 group">
          <div className="absolute -inset-2 rounded-full bg-blue-500/20 opacity-0 blur-lg transition-opacity duration-300 pointer-events-none group-hover:opacity-100"></div>
          <Button
            className="relative h-auto rounded-full border border-blue-200 px-8 py-4 text-sm font-bold shadow-2xl transition-all hover:-translate-y-1 flex items-center gap-3"
            onClick={save} disabled={saving || loading}
          >
            {saving ? 'Сохранение...' : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Сохранить {dirtyKeys.size} изм.
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );

  if (embedded) return <div className="flex flex-col gap-4">{content}</div>;

  return (
    <SectionCard
      title="Приоритеты"
      description="Единая панель приоритизации для задач, багов и техдолга."
      className="rounded-2xl"
    >
      {content}
    </SectionCard>
  );
}
