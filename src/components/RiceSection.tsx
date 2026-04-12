import { useState, useMemo } from 'react';
import { fetchRiceIssues, saveRiceScores, type RiceUpdate } from '../lib/riceApi';
import type { RiceIssue } from '../types';

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

function tdQuadrant(impact: string, effort: string): { label: string; cls: string; order: number } | null {
  const i = parseFloat(impact), e = parseFloat(effort);
  if (isNaN(i) || isNaN(e)) return null;
  if (i > 5 && e <= 5) return { label: 'Быстрая победа', cls: 'bg-emerald-100 text-emerald-700', order: 1 };
  if (i > 5 && e > 5)  return { label: 'Крупный проект', cls: 'bg-blue-100 text-blue-700',       order: 2 };
  if (i <= 5 && e <= 5) return { label: 'Фоновая задача', cls: 'bg-amber-50 text-amber-700',      order: 3 };
  return { label: 'Трата времени', cls: 'bg-red-100 text-red-700', order: 4 };
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
function scoreBadgeCls(score: number | null, max: number): string {
  if (score === null || max === 0) return '';
  const pct = score / max;
  if (pct >= 0.66) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 0.33) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

function bugScoreCls(score: number | null): string {
  if (score === null) return '';
  if (score >= 75) return 'bg-red-100 text-red-700';
  if (score >= 50) return 'bg-orange-100 text-orange-700';
  if (score >= 20) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

function bugSlaLabel(score: number): string {
  if (score >= 75) return 'BLOCKER';
  if (score >= 50) return 'CRITICAL';
  if (score >= 20) return 'MAJOR';
  return 'MINOR';
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ChipSelect({ options, value, onChange, disabled, fmt = String }: {
  options: number[]; value: string; onChange: (v: string) => void;
  disabled?: boolean; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => {
        const s = String(opt);
        return (
          <button key={s} disabled={disabled}
            className={`px-3 py-1.5 border rounded-full text-xs font-bold whitespace-nowrap leading-none transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'} ${value === s ? 'bg-donezo-dark border-donezo-dark text-white shadow-md' : 'bg-white text-gray-500 border-gray-200 hover:border-donezo-primary hover:text-donezo-primary hover:bg-donezo-light'}`}
            onClick={() => { if (!disabled) onChange(value === s ? '' : s); }}
          >{fmt(opt)}</button>
        );
      })}
    </div>
  );
}


function Stepper({ value, onChange, disabled, min = EFFORT_MIN, max = EFFORT_MAX, step = EFFORT_STEP }: {
  value: string; onChange: (v: string) => void; disabled?: boolean;
  min?: number; max?: number; step?: number;
}) {
  const num = parseFloat(value) || 0;
  const dec = (n: number) => onChange(String(Math.max(min, +(n - step).toFixed(1))));
  const inc = (n: number) => onChange(String(Math.min(max, +(n + step).toFixed(1))));
  return (
    <div className={`inline-flex items-center border rounded-full overflow-hidden transition-colors ${disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white focus-within:border-donezo-primary focus-within:ring-2 focus-within:ring-donezo-light'}`}>
      <button disabled={disabled}
        className={`w-9 h-10 border-none text-gray-700 text-xl font-bold leading-none flex items-center justify-center flex-shrink-0 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : 'cursor-pointer bg-gray-50 hover:bg-donezo-light hover:text-donezo-primary'}`}
        onClick={() => { if (!disabled) dec(num); }}>−</button>
      <input disabled={disabled}
        className={`w-12 text-center text-sm font-bold border-none outline-none h-10 no-spinner transition-colors text-slate-900 caret-slate-900 ${disabled ? 'bg-transparent text-gray-400' : 'bg-white'}`}
        type="number" min={min} max={max} step={step} value={value}
        onChange={(e) => { if (!disabled) onChange(e.target.value); }} />
      <button disabled={disabled}
        className={`w-9 h-10 border-none text-gray-700 text-xl font-bold leading-none flex items-center justify-center flex-shrink-0 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : 'cursor-pointer bg-gray-50 hover:bg-donezo-light hover:text-donezo-primary'}`}
        onClick={() => { if (!disabled) inc(num); }}>+</button>
    </div>
  );
}

// ── Chevron icon ──────────────────────────────────────────────────────────────
function SortChevron({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  return (
    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${active ? 'text-donezo-primary opacity-100' : 'text-gray-300 opacity-0 group-hover/sort:opacity-100'} ${active && dir === 'desc' ? 'rotate-180' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
    </svg>
  );
}

// ── Jira link cell ────────────────────────────────────────────────────────────
function IssueLink({ issueKey, isDirty, jiraBaseUrl }: { issueKey: string; isDirty: boolean; jiraBaseUrl: string }) {
  return (
    <td className="px-3 py-2.5 align-middle whitespace-nowrap relative">
      {isDirty && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />
      )}
      <a href={`${jiraBaseUrl}/${issueKey}`} target="_blank" rel="noopener noreferrer"
        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline">
        {issueKey}
      </a>
    </td>
  );
}

// ── Main props ────────────────────────────────────────────────────────────────
interface Props {
  webhookUrl: string;
  n8nBaseUrl?: string;
  jiraBaseUrl: string;
  onSendToQueue: (items: string[]) => void;
  onSwitchToMetrics: () => void;
  onIssuesCountChange?: (count: number) => void;
}

// ═════════════════════════════════════════════════════════════════════════════
export function RiceSection({ webhookUrl, n8nBaseUrl, jiraBaseUrl, onSendToQueue, onSwitchToMetrics, onIssuesCountChange }: Props) {

  // ── State ─────────────────────────────────────────────────────────────────
  const [scoringTab, setScoringTab] = useState<ScoringTab>('rice');
  const [issues, setIssues]         = useState<RiceIssue[]>([]);
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

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!webhookUrl) { setMsg({ text: 'Укажите Webhook URL в настройках', ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const data = await fetchRiceIssues(webhookUrl, n8nBaseUrl);
      setIssues(data);
      const riceMap = new Map<string, ScoreRow>();
      const bugMap  = new Map<string, BugRow>();
      const tdMap   = new Map<string, TdRow>();
      for (const issue of data) {
        riceMap.set(issue.key, initRow(issue));
        bugMap.set(issue.key, initBugRow(issue));
        tdMap.set(issue.key, initTdRow(issue));
      }
      setScores(riceMap);
      setBugScores(bugMap);
      setTdScores(tdMap);
      setDirtyKeys(new Set());
      setSortTrigger(t => t + 1);
      onIssuesCountChange?.(data.length);
    } catch (e) {
      setMsg({ text: `Ошибка: ${(e as Error).message}`, ok: false });
    } finally { setLoading(false); }
  };

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
      await saveRiceScores(webhookUrl, updates, n8nBaseUrl);
      setDirtyKeys(new Set());
      setMsg({ text: `Успешно сохранено ${updates.length} задач`, ok: true });
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
  const riceScoreValues = sortedRice.map(i => calcScore(scores.get(i.key)!)).filter((s): s is number => s !== null);
  const maxRiceScore    = riceScoreValues.length ? Math.max(...riceScoreValues) : 0;
  const scoredRice      = riceScoreValues.length;
  const scoredBugs      = bugIssues.filter(i => calcBugScore(bugScores.get(i.key)!) !== null).length;
  const scoredTd        = tdIssues.filter(i => calcTdRoi(tdScores.get(i.key) ?? initTdRow(i)) !== null).length;

  // ── Send to MC queue ──────────────────────────────────────────────────────
  const sendToQueue = async () => {
    if (dirtyKeys.size > 0) await save();
    const ranked = sortedRice.filter(i => calcScore(scores.get(i.key)!) !== null);
    onSendToQueue(ranked.map(i => `${i.key} — ${i.summary}`));
    onSwitchToMetrics();
  };

  // ── Style helpers ─────────────────────────────────────────────────────────
  const btnSecondary = 'px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-bold cursor-pointer transition-all duration-200 hover:bg-donezo-light hover:text-donezo-dark hover:border-donezo-primary hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none shadow-sm';
  const btnPrimary   = 'px-6 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold cursor-pointer border-none transition-all duration-200 hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';
  const thBase       = 'px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10';
  const thSort       = `${thBase} cursor-pointer hover:bg-gray-50 transition-colors group/sort`;

  const SUB_TABS: { id: ScoringTab; label: string; scored: number; total: number }[] = [
    { id: 'rice',     label: 'User Stories & Tasks', scored: scoredRice,  total: riceIssues.length },
    { id: 'bugs',     label: 'Bugs',                  scored: scoredBugs,  total: bugIssues.length  },
    { id: 'techdebt', label: 'Tech Debt',              scored: scoredTd,    total: tdIssues.length   },
  ];

  // ── Current tab issues count for toolbar label ────────────────────────────
  const currentTabLabel = {
    rice:     `${riceIssues.length} задач · ${scoredRice} оценено`,
    bugs:     `${bugIssues.length} багов · ${scoredBugs} оценено`,
    techdebt: `${tdIssues.length} задач · ${scoredTd} оценено`,
  }[scoringTab];

  const currentTabTitle = {
    rice:     'RICE Приоритизация',
    bugs:     'FinTech: Defect Scoring Model',
    techdebt: 'Impact / Effort Matrix',
  }[scoringTab];

  // ── Current tab has items ─────────────────────────────────────────────────
  const currentTabItems = { rice: riceIssues, bugs: bugIssues, techdebt: tdIssues }[scoringTab];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div>
      {/* Tooltip click-away overlay */}
      {activeTooltip && <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveTooltip(null)} />}

      {/* ── Sub-tab navigation ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="flex bg-gray-50 rounded-2xl p-1 gap-1 border border-gray-100">
          {SUB_TABS.map(({ id, label, scored, total }) => (
            <button key={id} onClick={() => setScoringTab(id)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                scoringTab === id
                  ? 'bg-white text-donezo-dark shadow-sm border border-gray-100'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {label}
              {total > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  scoringTab === id ? 'bg-donezo-light text-donezo-dark' : 'bg-gray-200 text-gray-500'
                }`}>
                  {scored}/{total}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Collapsible guide (per tab) ──────────────────────────────────── */}
      <div className="mb-6 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <details className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none font-bold text-slate-900 transition-colors hover:bg-donezo-light/50 rounded-3xl group-open:rounded-b-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-donezo-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              {scoringTab === 'rice'     && 'Что такое метод RICE и как он считается?'}
              {scoringTab === 'bugs'     && 'Как приоритизировать баги: FinTech Defect Scoring Model'}
              {scoringTab === 'techdebt' && 'Как приоритизировать техдолг: Impact / Effort Matrix'}
            </div>
            <svg className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>

          <div className="px-6 py-5 text-sm text-gray-600 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl leading-relaxed space-y-4">

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
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-1">🌍 Reach (Охват)</strong>
                    Сколько пользователей затронет изменение за месяц? (любое положительное число).
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-1">🎯 Impact (Влияние)</strong>
                    Насколько сильно влияет на пользователя?
                    <span className="block mt-1 text-xs text-gray-400">Massive (3), High (2), Medium (1), Low (0.5), Minimal (0.25).</span>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-1">📊 Confidence (Уверенность)</strong>
                    Насколько вы уверены в оценках?
                    <span className="block mt-1 text-xs text-gray-400">100% (уверен), 80% (довольно уверен), 50% (интуиция), 25% (пальцем в небо).</span>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
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
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-2">R — Риски (макс. 40)</strong>
                    Финансовые, юридические, репутационные последствия.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">40</span> — Потеря денег / уязвимость ИБ / нарушение закона ЦБ</li>
                      <li><span className="font-bold text-orange-600">15</span> — Жалобы в саппорт, простой бэк-офиса</li>
                      <li><span className="font-bold text-slate-500">0</span> — Прямого влияния нет</li>
                    </ul>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-2">P — Процесс (макс. 30)</strong>
                    Влияние на кредитный конвейер.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">30</span> — Блокирует выдачу, скоринг, подписание, погашение</li>
                      <li><span className="font-bold text-orange-600">10</span> — Процесс работает с деградацией</li>
                      <li><span className="font-bold text-slate-500">2</span> — Косметический дефект</li>
                    </ul>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-2">S — Масштаб (макс. 15)</strong>
                    Охват затронутых клиентов.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">15</span> — Все клиенты или флагманский продукт</li>
                      <li><span className="font-bold text-orange-600">8</span> — Узкий сегмент или редкий сценарий</li>
                      <li><span className="font-bold text-slate-500">2</span> — Единичные уникальные случаи</li>
                    </ul>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-2">W — Workaround (макс. 15)</strong>
                    Есть ли обходной путь.
                    <ul className="mt-2 space-y-1 text-xs text-gray-500">
                      <li><span className="font-bold text-red-600">15</span> — Нет пути / нужно вмешательство технарей (БД/скрипты)</li>
                      <li><span className="font-bold text-orange-600">7</span> — Решается вручную L1/L2 поддержкой</li>
                      <li><span className="font-bold text-slate-500">1</span> — Клиент может сам (перезагрузить, повторить)</li>
                    </ul>
                  </li>
                </ul>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-xs text-gray-600">
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
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-1">Impact (Влияние) — 1–10</strong>
                    Какую пользу принесёт решение: ускорение работы, снижение нагрузки, устранение боли разработчиков.
                    <div className="mt-2 text-xs text-gray-400">10 = огромная польза, 1 = почти никакой</div>
                  </li>
                  <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <strong className="block text-slate-900 mb-1">Effort (Усилия) — 1–10</strong>
                    Сколько времени, денег и человеческих ресурсов потребуется на реализацию.
                    <div className="mt-2 text-xs text-gray-400">10 = огромные затраты, 1 = минимум усилий</div>
                  </li>
                </ul>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-xs text-gray-600">
                  <strong className="block text-slate-900 mb-2">Матрица квадрантов (порог = 5):</strong>
                  <ul className="space-y-1">
                    <li><span className="font-bold text-emerald-700">Быстрая победа</span> — Impact &gt; 5, Effort ≤ 5 → Высший приоритет, максимальный ROI</li>
                    <li><span className="font-bold text-blue-700">Крупный проект</span> — Impact &gt; 5, Effort &gt; 5 → Стратегический долг, брать дозированно</li>
                    <li><span className="font-bold text-amber-700">Фоновая задача</span> — Impact ≤ 5, Effort ≤ 5 → Делать в свободное время</li>
                    <li><span className="font-bold text-red-700">Трата времени</span> — Impact ≤ 5, Effort &gt; 5 → Заморозить или удалить из бэклога</li>
                  </ul>
                </div>
                <p className="text-xs text-gray-400">Задачи отсортированы по убыванию ROI — «быстрые победы» с наивысшим коэффициентом вверху.</p>
              </>
            )}
          </div>
        </details>
      </div>

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="text-lg font-bold text-slate-900">{currentTabTitle}</div>
          {issues.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">{currentTabLabel}</div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button className={btnSecondary} onClick={load} disabled={loading || saving}>
            {loading ? 'Загрузка…' : 'Загрузить из Jira'}
          </button>
          {issues.length > 0 && (
            <>
              {(scoringTab === 'rice' || scoringTab === 'techdebt') && (
                <button
                  className={`${btnSecondary} flex items-center justify-center min-w-[36px] px-2 leading-none`}
                  onClick={() => setSortTrigger(t => t + 1)}
                  disabled={saving || loading}
                  title="Применить сортировку"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </button>
              )}
              <button
                className={`${btnSecondary} ${dirtyKeys.size > 0 ? 'bg-donezo-light border-donezo-light text-donezo-dark hover:bg-donezo-primary hover:text-white' : ''}`}
                onClick={save}
                disabled={saving || loading || dirtyKeys.size === 0}
              >
                {saving ? 'Сохранение…' : `Сохранить оценки${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ''}`}
              </button>
              {scoringTab === 'rice' && scoredRice > 0 && (
                <button className={btnPrimary} onClick={sendToQueue} disabled={loading || saving}>
                  Отправить в очередь MC →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Status message ────────────────────────────────────────────────── */}
      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 border ${msg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {/* ── Empty states ─────────────────────────────────────────────────── */}
      {issues.length === 0 && !loading && (
        <div className="flex justify-center py-16">
          <div className="text-center">
            <div className="text-base font-medium text-gray-600 mb-2">
              {scoringTab === 'rice'     && <>RICE = <strong>Reach</strong> × <strong>Impact</strong> × <strong>Confidence%</strong> / <strong>Effort</strong></>}
              {scoringTab === 'bugs'     && <>Score = <strong>R</strong> (Риски) + <strong>P</strong> (Процесс) + <strong>S</strong> (Масштаб) + <strong>W</strong> (Workaround)</>}
              {scoringTab === 'techdebt' && <>ROI = <strong>Impact</strong> ÷ <strong>Effort</strong> → Квадранты приоритизации</>}
            </div>
            <div className="text-sm text-gray-400">Нажмите «Загрузить из Jira» чтобы начать оценку</div>
          </div>
        </div>
      )}

      {issues.length > 0 && currentTabItems.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="text-center text-sm text-gray-400">
            Задачи этого типа не найдены в загруженных данных
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: RICE (User Stories & Tasks)
      ════════════════════════════════════════════════════════════════════ */}
      {scoringTab === 'rice' && sortedRice.length > 0 && (
        <div className="overflow-auto max-h-[65vh] bg-white rounded-3xl border border-gray-100 px-2 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`w-11 text-center ${thBase}`}>#</th>
                <th className={`w-28 ${thSort}`}
                  onClick={() => { if (sortField === 'key') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('key'); setSortDir('asc'); } }}>
                  <div className="flex items-center gap-1">Задача <SortChevron active={sortField === 'key'} dir={sortDir} /></div>
                </th>
                <th className={`${thBase}`}>Summary</th>
                <th className={`w-36 ${thBase}`}>Статус</th>
                <th className={`w-28 ${thBase} relative`}>
                  <div className="flex items-center gap-1">
                    Reach
                    <button onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'reach' ? null : 'reach'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'reach' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">польз./мес.</span>
                  {activeTooltip === 'reach' && (
                    <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">🌍</span> Reach (Охват)</div>
                      <div className="text-gray-600 leading-relaxed">
                        Сколько уникальных пользователей затронет изменение за месяц?
                        <div className="mt-2 text-xs bg-gray-50 p-2 rounded-lg text-slate-800">
                          <strong className="block text-donezo-primary mb-1">Пример:</strong>
                          Если фичей воспользуются 500 клиентов — впишите <strong>500</strong>.
                        </div>
                      </div>
                    </div>
                  )}
                </th>
                <th className={`w-64 ${thBase} relative`}>
                  <div className="flex items-center gap-1">
                    Impact
                    <button onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'impact' ? null : 'impact'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'impact' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">множитель</span>
                  {activeTooltip === 'impact' && (
                    <div className="absolute top-full mt-2 left-0 md:-left-8 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">🎯</span> Impact (Влияние)</div>
                      <div className="text-gray-600 leading-relaxed mb-2">Насколько сильно изменение решает боль клиента?</div>
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>3 (Massive):</strong> Огромное влияние, киллер-фича.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>2 (High):</strong> Заметное решение сильной боли.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>1 (Medium):</strong> Среднее, обычное улучшение.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>0.5 (Low):</strong> Небольшое «nice to have».</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-200 mt-1 shrink-0"></span><span className="text-slate-800"><strong>0.25 (Minimal):</strong> Едва заметная микро-оптимизация.</span></li>
                      </ul>
                    </div>
                  )}
                </th>
                <th className={`w-48 ${thBase} relative`}>
                  <div className="flex items-center gap-1">
                    Confidence
                    <button onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'confidence' ? null : 'confidence'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'confidence' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">уверенность</span>
                  {activeTooltip === 'confidence' && (
                    <div className="absolute top-full mt-2 left-0 md:-left-8 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">📊</span> Confidence (Уверенность)</div>
                      <div className="text-gray-600 leading-relaxed mb-2">Насколько вы уверены в оценках Reach, Impact и Effort?</div>
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></span><span className="text-slate-800"><strong>100%:</strong> Есть точные данные.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>80%:</strong> Хорошие данные, есть допущения.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1 shrink-0"></span><span className="text-slate-800"><strong>50%:</strong> Уверенность ниже среднего.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1 shrink-0"></span><span className="text-slate-800"><strong>25%:</strong> Пальцем в небо.</span></li>
                      </ul>
                    </div>
                  )}
                </th>
                <th className={`w-32 ${thBase} relative`}>
                  <div className="flex items-center gap-1">
                    Effort
                    <button onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'effort' ? null : 'effort'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'effort' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">сторипоинты</span>
                  {activeTooltip === 'effort' && (
                    <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">⏳</span> Effort (Усилия)</div>
                      <div className="text-gray-600 leading-relaxed">
                        Сколько сторипоинтов займёт реализация? (0.5–40). Чем больше Effort, тем ниже RICE Score.
                      </div>
                    </div>
                  )}
                </th>
                <th className={`w-24 text-center ${thSort}`}
                  onClick={() => { if (sortField === 'rice') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('rice'); setSortDir('desc'); } }}>
                  <div className="flex items-center justify-center gap-1">
                    RICE <SortChevron active={sortField === 'rice'} dir={sortDir} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRice.map((issue, idx) => {
                const row   = scores.get(issue.key)!;
                const score = calcScore(row);
                const cls   = scoreBadgeCls(score, maxRiceScore);
                return (
                  <tr key={issue.key} className="border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200 group">
                    <td className="px-3 py-3.5 text-center text-xs font-bold text-gray-400 align-middle relative group-hover:text-donezo-dark transition-colors">
                      {dirtyKeys.has(issue.key) && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />}
                      {score !== null ? idx + 1 : '—'}
                    </td>
                    <IssueLink issueKey={issue.key} isDirty={false} jiraBaseUrl={jiraBaseUrl} />
                    <td className="px-3 py-2.5 align-middle text-slate-900 min-w-[200px]">{issue.summary}</td>
                    <td className="px-3 py-2.5 align-middle text-xs text-gray-500 whitespace-nowrap">{issue.status}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        className={`w-24 px-3 py-2 border rounded-xl text-sm font-semibold outline-none no-spinner transition-all duration-200 text-slate-900 caret-slate-900 ${saving ? 'bg-transparent text-gray-400 border-transparent' : 'bg-gray-50 border-gray-100 focus:border-donezo-primary focus:bg-white focus:ring-2 focus:ring-donezo-light'}`}
                        type="number" min={0} placeholder="0" value={row.reach} disabled={saving}
                        onChange={(e) => setField(issue.key, 'reach', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={IMPACT_OPTIONS} value={row.impact} onChange={(v) => setField(issue.key, 'impact', v)} disabled={saving} fmt={(v) => `${IMPACT_LABELS[String(v)]} (${v})`} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={CONF_OPTIONS} value={row.confidence} onChange={(v) => setField(issue.key, 'confidence', v)} disabled={saving} fmt={(v) => `${v}%`} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Stepper value={row.effort} onChange={(v) => setField(issue.key, 'effort', v)} disabled={saving} />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle relative group/rice">
                      {score !== null
                        ? <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full min-w-[52px] text-center transition-all ${cls}`}>{score}</span>
                        : <span className="text-gray-300 text-base">—</span>}
                      <button
                        title="Установить срочно (RICE 9999)"
                        onClick={() => setUrgent9999(issue.key)}
                        disabled={saving}
                        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/rice:opacity-100 p-1 hover:scale-125 transition-all text-lg cursor-pointer bg-white rounded-full shadow-sm border border-gray-100 disabled:opacity-0 disabled:cursor-auto"
                      >🔥</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: BUGS (FinTech Defect Scoring: R + P + S + W)
      ════════════════════════════════════════════════════════════════════ */}
      {scoringTab === 'bugs' && sortedBugs.length > 0 && (
        <div className="overflow-auto max-h-[65vh] bg-white rounded-3xl border border-gray-100 px-2 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`w-11 text-center ${thBase}`}>#</th>
                <th className={`w-28 ${thSort}`}
                  onClick={() => { if (bugSortField === 'key') setBugSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setBugSortField('key'); setBugSortDir('asc'); } }}>
                  <div className="flex items-center gap-1">Задача <SortChevron active={bugSortField === 'key'} dir={bugSortDir} /></div>
                </th>
                <th className={`${thBase}`}>Summary</th>
                <th className={`w-36 ${thBase}`}>Статус</th>
                <th className={`w-64 ${thBase}`}>
                  R — Риски
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">Фин./юрид./репутационные</span>
                </th>
                <th className={`w-56 ${thBase}`}>
                  P — Процесс
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">Кредитный конвейер</span>
                </th>
                <th className={`w-56 ${thBase}`}>
                  S — Масштаб
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">Охват проблемы</span>
                </th>
                <th className={`w-56 ${thBase}`}>
                  W — Workaround
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">Обходной путь</span>
                </th>
                <th className={`w-28 text-center ${thSort}`}
                  onClick={() => { if (bugSortField === 'score') setBugSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setBugSortField('score'); setBugSortDir('desc'); } }}>
                  <div className="flex items-center justify-center gap-1">
                    Score <SortChevron active={bugSortField === 'score'} dir={bugSortDir} />
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">макс. 100</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedBugs.map((issue, idx) => {
                const row   = bugScores.get(issue.key)!;
                const score = calcBugScore(row);
                return (
                  <tr key={issue.key} className="border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200">
                    <td className="px-3 py-3.5 text-center text-xs font-bold text-gray-400 align-middle relative">
                      {dirtyKeys.has(issue.key) && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />}
                      {score !== null ? idx + 1 : '—'}
                    </td>
                    <IssueLink issueKey={issue.key} isDirty={false} jiraBaseUrl={jiraBaseUrl} />
                    <td className="px-3 py-2.5 align-middle text-slate-900 min-w-[200px]">{issue.summary}</td>
                    <td className="px-3 py-2.5 align-middle text-xs text-gray-500 whitespace-nowrap">{issue.status}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={[...BUG_RISK_OPTIONS]} value={row.bug_risk}
                        onChange={(v) => setBugField(issue.key, 'bug_risk', v)} disabled={saving}
                        fmt={(v) => BUG_RISK_LABELS[v]} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={[...BUG_PROCESS_OPTIONS]} value={row.bug_process}
                        onChange={(v) => setBugField(issue.key, 'bug_process', v)} disabled={saving}
                        fmt={(v) => BUG_PROCESS_LABELS[v]} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={[...BUG_SCALE_OPTIONS]} value={row.bug_scale}
                        onChange={(v) => setBugField(issue.key, 'bug_scale', v)} disabled={saving}
                        fmt={(v) => BUG_SCALE_LABELS[v]} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect options={[...BUG_WA_OPTIONS]} value={row.bug_workaround}
                        onChange={(v) => setBugField(issue.key, 'bug_workaround', v)} disabled={saving}
                        fmt={(v) => BUG_WA_LABELS[v]} />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {score !== null ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full min-w-[48px] text-center transition-all ${bugScoreCls(score)}`}>{score}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bugScoreCls(score)}`}>{bugSlaLabel(score)}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-base">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB: TECH DEBT (Impact / Effort Matrix)
      ════════════════════════════════════════════════════════════════════ */}
      {scoringTab === 'techdebt' && sortedTd.length > 0 && (
        <div className="overflow-auto max-h-[65vh] bg-white rounded-3xl border border-gray-100 px-2 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className={`w-11 text-center ${thBase}`}>#</th>
                <th className={`w-28 ${thBase}`}>Задача</th>
                <th className={`${thBase}`}>Summary</th>
                <th className={`w-36 ${thBase}`}>Статус</th>
                <th className={`w-44 ${thBase}`}>
                  Impact
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">ценность решения (1–10)</span>
                </th>
                <th className={`w-44 ${thBase}`}>
                  Effort
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">трудозатраты (1–10)</span>
                </th>
                <th className={`w-36 text-center ${thSort}`}
                  onClick={() => setTdSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
                  <div className="flex items-center justify-center gap-1">
                    ROI <SortChevron active={true} dir={tdSortDir} />
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">Impact ÷ Effort</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTd.map((issue, idx) => {
                const row = tdScores.get(issue.key)!;
                const roi = calcTdRoi(row);
                const q   = tdQuadrant(row.td_impact, row.td_effort);
                return (
                  <tr key={issue.key} className="border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200">
                    <td className="px-3 py-3.5 text-center text-xs font-bold text-gray-400 align-middle relative">
                      {dirtyKeys.has(issue.key) && <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />}
                      {roi !== null ? idx + 1 : '—'}
                    </td>
                    <IssueLink issueKey={issue.key} isDirty={false} jiraBaseUrl={jiraBaseUrl} />
                    <td className="px-3 py-2.5 align-middle text-slate-900 min-w-[200px]">{issue.summary}</td>
                    <td className="px-3 py-2.5 align-middle text-xs text-gray-500 whitespace-nowrap">{issue.status}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <Stepper value={row.td_impact} onChange={(v) => setTdField(issue.key, 'td_impact', v)}
                        disabled={saving} min={1} max={10} step={1} />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Stepper value={row.td_effort} onChange={(v) => setTdField(issue.key, 'td_effort', v)}
                        disabled={saving} min={1} max={10} step={1} />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {roi !== null && q ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full min-w-[48px] text-center transition-all ${q.cls}`}>{roi}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${q.cls}`}>{q.label}</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-base">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── FAB ──────────────────────────────────────────────────────────── */}
      {dirtyKeys.size > 0 && (
        <div className="fixed bottom-8 right-8 z-50 group">
          <div className="absolute -inset-2 bg-donezo-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <button
            className="relative px-8 py-4 bg-donezo-dark text-white rounded-full text-sm font-bold cursor-pointer border border-donezo-light shadow-2xl transition-all hover:bg-donezo-primary hover:-translate-y-1 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </button>
        </div>
      )}
    </div>
  );
}
