import { useState, useMemo } from 'react';
import { fetchRiceIssues, saveRiceScores } from '../lib/riceApi';
import type { RiceIssue } from '../types';

const JIRA_BASE    = 'https://jira.tochka.com/browse';
const IMPACT_OPTIONS = [0.25, 0.5, 1, 2, 3];
const CONF_OPTIONS   = [25, 50, 80, 100];
const EFFORT_MIN     = 0.5;
const EFFORT_STEP    = 0.5;
const EFFORT_MAX     = 40;

const IMPACT_LABELS: Record<string, string> = {
  '0.25': 'Minimal',
  '0.5': 'Low',
  '1': 'Medium',
  '2': 'High',
  '3': 'Massive',
};

interface ScoreRow { reach: string; impact: string; confidence: string; effort: string }

function calcScore(row: ScoreRow): number | null {
  const r = parseFloat(row.reach);
  const i = parseFloat(row.impact);
  const c = parseFloat(row.confidence);
  const e = parseFloat(row.effort);
  if (isNaN(r) || isNaN(i) || isNaN(c) || isNaN(e) || e === 0) return null;
  if (row.reach === '' || row.impact === '' || row.confidence === '' || row.effort === '') return null;
  return Math.round((r * i * (c / 100)) / e);
}

function initRow(issue: RiceIssue): ScoreRow {
  return {
    reach:      issue.reach      != null ? String(issue.reach)      : '',
    impact:     issue.impact     != null ? String(issue.impact)     : '',
    confidence: issue.confidence != null ? String(issue.confidence) : '',
    effort:     issue.effort     != null ? String(issue.effort)     : '',
  };
}

function scoreBadgeCls(score: number | null, max: number): string {
  if (score === null || max === 0) return '';
  const pct = score / max;
  if (pct >= 0.66) return 'bg-emerald-100 text-emerald-700';
  if (pct >= 0.33) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

function ChipSelect({
  options, value, onChange, disabled, fmt = String,
}: {
  options: number[]; value: string; onChange: (v: string) => void; disabled?: boolean; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => {
        const s = String(opt);
        return (
          <button
            key={s}
            disabled={disabled}
            className={`px-3 py-1.5 border rounded-full text-xs font-bold whitespace-nowrap leading-none transition-all duration-200 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'} ${
              value === s
                ? 'bg-donezo-dark border-donezo-dark text-white shadow-md'
                : 'bg-white text-gray-500 border-gray-200 hover:border-donezo-primary hover:text-donezo-primary hover:bg-donezo-light'
            }`}
            onClick={() => { if(!disabled) onChange(value === s ? '' : s); }}
          >
            {fmt(opt)}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const num = parseFloat(value) || 0;
  const dec = (n: number) => onChange(String(Math.max(EFFORT_MIN, +(n - EFFORT_STEP).toFixed(1))));
  const inc = (n: number) => onChange(String(Math.min(EFFORT_MAX, +(n + EFFORT_STEP).toFixed(1))));
  return (
    <div className={`inline-flex items-center border rounded-full overflow-hidden transition-colors ${disabled ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white focus-within:border-donezo-primary focus-within:ring-2 focus-within:ring-donezo-light'}`}>
      <button
        disabled={disabled}
        className={`w-9 h-10 border-none text-gray-700 text-xl font-bold leading-none flex items-center justify-center flex-shrink-0 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : 'cursor-pointer bg-gray-50 hover:bg-donezo-light hover:text-donezo-primary'}`}
        onClick={() => { if(!disabled) dec(num); }}
      >−</button>
      <input
        disabled={disabled}
        className={`w-12 text-center text-sm font-bold border-none outline-none h-10 no-spinner transition-colors text-slate-900 caret-slate-900 ${disabled ? 'bg-transparent text-gray-400' : 'bg-white'}`}
        type="number"
        min={EFFORT_MIN}
        max={EFFORT_MAX}
        step={EFFORT_STEP}
        value={value}
        onChange={(e) => { if(!disabled) onChange(e.target.value); }}
      />
      <button
        disabled={disabled}
        className={`w-9 h-10 border-none text-gray-700 text-xl font-bold leading-none flex items-center justify-center flex-shrink-0 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed bg-transparent' : 'cursor-pointer bg-gray-50 hover:bg-donezo-light hover:text-donezo-primary'}`}
        onClick={() => { if(!disabled) inc(num); }}
      >+</button>
    </div>
  );
}

interface Props {
  webhookUrl: string;
  onSendToQueue: (items: string[]) => void;
  onSwitchToMetrics: () => void;
  onIssuesCountChange?: (count: number) => void;
}

export function RiceSection({ webhookUrl, onSendToQueue, onSwitchToMetrics, onIssuesCountChange }: Props) {
  const [issues, setIssues]   = useState<RiceIssue[]>([]);
  const [scores, setScores]   = useState<Map<string, ScoreRow>>(new Map());
  const [dirtyKeys, setDirtyKeys] = useState<Set<string>>(new Set());
  const [sortTrigger, setSortTrigger] = useState(0);
  const [sortField, setSortField]     = useState<'rice' | 'key'>('rice');
  const [sortDir, setSortDir]         = useState<'asc' | 'desc'>('desc');
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const load = async () => {
    if (!webhookUrl) { setMsg({ text: 'Укажите Webhook URL в настройках', ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const data = await fetchRiceIssues(webhookUrl);
      setIssues(data);
      const map = new Map<string, ScoreRow>();
      for (const issue of data) map.set(issue.key, initRow(issue));
      setScores(map);
      setDirtyKeys(new Set());
      setSortTrigger(t => t + 1); // trigger initial sort
      onIssuesCountChange?.(data.length);
    } catch (e) {
      setMsg({ text: `Ошибка: ${(e as Error).message}`, ok: false });
    } finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const updates = issues.flatMap((issue) => {
        if (!dirtyKeys.has(issue.key)) return [];
        const row = scores.get(issue.key);
        if (!row) return [];
        const rice_score = calcScore(row);
        if (rice_score === null) return [];
        return [{
          key: issue.key,
          reach:      parseFloat(row.reach),
          impact:     parseFloat(row.impact),
          confidence: parseFloat(row.confidence),
          effort:     parseFloat(row.effort),
          rice_score,
        }];
      });
      if (!updates.length) { setMsg({ text: 'Нет задач с корректно заполненными оценками для сохранения', ok: false }); return; }
      await saveRiceScores(webhookUrl, updates);
      setDirtyKeys(new Set()); // successfully saved, clear dirty state
      setMsg({ text: `Успешно сохранено ${updates.length} задач`, ok: true });
    } catch (e) {
      setMsg({ text: `Ошибка при сохранении: ${(e as Error).message}`, ok: false });
    } finally { setSaving(false); }
  };

  const setField = (key: string, field: keyof ScoreRow, value: string) => {
    let finalValue = value;
    if (field === 'reach') {
      const v = parseFloat(value);
      if (v < 0) finalValue = String(Math.abs(v));
    }
    setDirtyKeys((prev) => new Set(prev).add(key));
    setScores((prev) => { const m = new Map(prev); m.set(key, { ...m.get(key)!, [field]: finalValue }); return m; });
  };

  const setUrgent9999 = (key: string) => {
    setDirtyKeys((prev) => new Set(prev).add(key));
    setScores((prev) => {
      const m = new Map(prev);
      m.set(key, { reach: '9999', impact: '1', confidence: '100', effort: '1' });
      return m;
    });
  };

  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      if (sortField === 'rice') {
        const sa = calcScore(scores.get(a.key) ?? initRow(a)) ?? -1;
        const sb = calcScore(scores.get(b.key) ?? initRow(b)) ?? -1;
        return sortDir === 'desc' ? sb - sa : sa - sb;
      } else {
        return sortDir === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issues, sortTrigger, sortField, sortDir]); // 'scores' omitted intentionally to prevent visual jumping while typing

  const allScores   = sortedIssues.map((i) => calcScore(scores.get(i.key)!)).filter((s): s is number => s !== null);
  const maxScore    = allScores.length ? Math.max(...allScores) : 0;
  const scoredCount = allScores.length;

  const sendToQueue = async () => {
    if (dirtyKeys.size > 0) {
      await save();
    }
    const ranked = sortedIssues.filter((i) => calcScore(scores.get(i.key)!) !== null);
    onSendToQueue(ranked.map((i) => `${i.key} — ${i.summary}`));
    onSwitchToMetrics();
  };

  const btnSecondary = 'px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-bold cursor-pointer transition-all duration-200 hover:bg-donezo-light hover:text-donezo-dark hover:border-donezo-primary hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none shadow-sm';
  const btnPrimary   = 'px-6 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold cursor-pointer border-none transition-all duration-200 hover:bg-donezo-primary hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';

  return (
    <div>
      {/* Tooltip Click-away Observer */}
      {activeTooltip && (
        <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setActiveTooltip(null)} />
      )}

      {/* Collapsible Guide */}
      <div className="mb-6 bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
        <details className="group [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none font-bold text-slate-900 transition-colors hover:bg-donezo-light/50 rounded-3xl group-open:rounded-b-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-donezo-primary">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              Что такое метод RICE и как он считается?
            </div>
            <svg className="w-5 h-5 text-gray-400 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-6 py-5 text-sm text-gray-600 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl leading-relaxed space-y-4">
            <p><strong>RICE</strong> — это фреймворк для оценки и приоритизации задач, который помогает принимать решения на основе объективных данных, а не интуиции. Итоговый балл считается по формуле:</p>
            <div className="flex items-center justify-center py-2">
              <div className="px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-100 font-mono text-center">
                <div className="border-b border-gray-200 pb-1 mb-1">(Reach × Impact × Confidence%)</div>
                <div>Effort</div>
              </div>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <strong className="block text-slate-900 mb-1 flex items-center gap-1.5"><svg className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg> Reach (Охват)</strong>
                Какое количество пользователей затронет это изменение за один месяц? (Любое положительное число).
              </li>
              <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <strong className="block text-slate-900 mb-1 flex items-center gap-1.5"><svg className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Impact (Влияние)</strong>
                Насколько сильно изменение повлияет на пользователя? 
                <span className="block mt-1 text-xs text-gray-400">Massive (3), High (2), Medium (1), Low (0.5), Minimal (0.25).</span>
              </li>
              <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <strong className="block text-slate-900 mb-1 flex items-center gap-1.5"><svg className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Confidence (Уверенность)</strong>
                Насколько вы уверены в оценках охвата, влияния и усилий? 
                <span className="block mt-1 text-xs text-gray-400">100% (уверен), 80% (довольно уверен), 50% (ниже среднего), 25% (пальцем в небо).</span>
              </li>
              <li className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <strong className="block text-slate-900 mb-1 flex items-center gap-1.5"><svg className="w-4 h-4 text-donezo-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> Effort (Усилия)</strong>
                Сколько сторипоинтов займет внедрение? (От 0.5 до 40).
              </li>
            </ul>
          </div>
        </details>
      </div>

      {/* Toolbar */}
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <div className="text-lg font-bold text-slate-900">RICE Приоритизация</div>
          {issues.length > 0 && (
            <div className="text-xs text-gray-400 mt-1">
              {issues.length} задач · {scoredCount} оценено · сортировка по убыванию RICE Score
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button className={btnSecondary} onClick={load} disabled={loading || saving}>
            {loading ? 'Загрузка…' : 'Загрузить из Jira'}
          </button>
          
          {issues.length > 0 && (
            <>
              <button 
                className={`${btnSecondary} flex items-center justify-center min-w-[36px] px-2 leading-none`} 
                onClick={() => setSortTrigger(t => t + 1)} 
                title="Отсортировать-применить изменения RICE"
                disabled={saving || loading}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

              <button 
                className={`${btnSecondary} ${dirtyKeys.size > 0 ? 'bg-donezo-light border-donezo-light text-donezo-dark hover:bg-donezo-primary hover:text-white' : ''}`} 
                onClick={save} 
                disabled={saving || loading || dirtyKeys.size === 0}
              >
                {saving ? 'Сохранение…' : `Сохранить оценки${dirtyKeys.size > 0 ? ` (${dirtyKeys.size})` : ''}`}
              </button>

              {scoredCount > 0 && (
                <button className={btnPrimary} onClick={sendToQueue} disabled={loading || saving}>
                  Отправить в очередь MC →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {msg && (
        <div className={`text-sm px-3 py-2 rounded-lg mb-4 border ${
          msg.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {msg.text}
        </div>
      )}

      {/* Empty state */}
      {issues.length === 0 && !loading && (
        <div className="flex justify-center py-16">
          <div className="text-center">
            <div className="text-base font-medium text-gray-600 mb-2">
              RICE = <strong className="text-slate-900">Reach</strong> × <strong className="text-slate-900">Impact</strong> × <strong className="text-slate-900">Confidence%</strong> / <strong className="text-slate-900">Effort</strong>
            </div>
            <div className="text-sm text-gray-400">Нажмите «Загрузить из Jira» чтобы начать оценку</div>
          </div>
        </div>
      )}

      {/* Table */}
      {issues.length > 0 && (
        <div className="overflow-auto max-h-[65vh] bg-white rounded-3xl shadow-none border border-gray-100 px-2 pb-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-11 text-center px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 transition-colors">#</th>
                <th 
                  className="w-28 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 cursor-pointer hover:bg-gray-50 transition-colors group/sort"
                  onClick={() => { if (sortField === 'key') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('key'); setSortDir('asc'); } }}
                >
                  <div className="flex items-center gap-1">
                    Задача
                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${sortField === 'key' ? 'text-donezo-primary opacity-100' : 'text-gray-300 opacity-0 group-hover/sort:opacity-100'} ${sortField === 'key' && sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </div>
                </th>
                <th className="px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10">Summary</th>
                <th className="w-36 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10">Статус</th>
                <th className="w-28 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 relative">
                  <div className="flex items-center gap-1">
                    Reach 
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'reach' ? null : 'reach'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'reach' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">польз./мес.</span>
                  
                  {activeTooltip === 'reach' && (
                    <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">🌍</span> Reach (Охват)</div>
                      <div className="text-gray-600 leading-relaxed">
                        Какое количество уникальных пользователей затронет это изменение за один месяц?
                        <div className="mt-2 text-xs bg-gray-50 p-2 rounded-lg text-slate-800">
                          <strong className="block text-donezo-primary mb-1">Пример:</strong>
                          Если фичей воспользуются 500 клиентов бизнеса — впишите <strong>500</strong>.
                        </div>
                      </div>
                    </div>
                  )}
                </th>
                <th className="w-64 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 relative">
                  <div className="flex items-center gap-1">
                    Impact 
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'impact' ? null : 'impact'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'impact' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}
                    >
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
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>0.5 (Low):</strong> Небольшое улучшение «nice to have».</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-green-200 mt-1 shrink-0"></span><span className="text-slate-800"><strong>0.25 (Minimal):</strong> Едва заметное, микро-оптимизация.</span></li>
                      </ul>
                    </div>
                  )}
                </th>
                <th className="w-48 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 relative">
                  <div className="flex items-center gap-1">
                    Confidence 
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'confidence' ? null : 'confidence'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'confidence' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">уверенность</span>

                  {activeTooltip === 'confidence' && (
                    <div className="absolute top-full mt-2 left-0 md:-left-8 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">📊</span> Confidence (Уверенность)</div>
                      <div className="text-gray-600 leading-relaxed mb-2">Насколько вы уверены в ваших оценках Reach, Impact и Effort?</div>
                      <ul className="space-y-1.5 text-xs">
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shrink-0"></span><span className="text-slate-800"><strong>100%:</strong> Есть точные данные / аналитика.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0"></span><span className="text-slate-800"><strong>80%:</strong> Хорошие данные, но есть допущения.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-blue-300 mt-1 shrink-0"></span><span className="text-slate-800"><strong>50%:</strong> Уверенность ниже среднего, интуиция.</span></li>
                        <li className="flex items-start gap-2"><span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1 shrink-0"></span><span className="text-slate-800"><strong>25%:</strong> Пальцем в небо (очень рискованно).</span></li>
                      </ul>
                    </div>
                  )}
                </th>
                <th className="w-32 px-3 py-3.5 text-left text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 relative">
                  <div className="flex items-center gap-1">
                    Effort 
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveTooltip(activeTooltip === 'effort' ? null : 'effort'); }}
                      className={`transition-colors rounded-full p-0.5 ${activeTooltip === 'effort' ? 'bg-donezo-light text-donezo-primary' : 'text-gray-400 hover:text-donezo-primary hover:bg-gray-50'}`}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                  </div>
                  <span className="block font-normal normal-case text-gray-400 tracking-normal text-[10px] mt-0.5">сторипоинты</span>

                  {activeTooltip === 'effort' && (
                    <div className="absolute top-full mt-2 right-0 w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-50 normal-case font-normal text-sm" onClick={e => e.stopPropagation()}>
                      <div className="font-bold text-slate-900 mb-2 border-b border-gray-50 pb-2 flex items-center gap-2"><span className="text-xl">⏳</span> Effort (Усилия)</div>
                      <div className="text-gray-600 leading-relaxed">
                        Сколько сторипоинтов (или человеко-месяцев) займет внедрение задачи?
                        <div className="mt-2 text-xs bg-gray-50 p-2 rounded-lg text-slate-800">
                          <strong className="block text-donezo-primary mb-1">Совет:</strong>
                          Оценивайте грубо, но честно (допустимо от 0.5 до 40). Чем больше значение Effort, тем ниже итоговый потенциал (RICE).
                        </div>
                      </div>
                    </div>
                  )}
                </th>
                <th 
                  className="w-24 px-3 py-3.5 text-xs font-bold uppercase tracking-wider text-donezo-dark border-b-2 border-gray-200 bg-white sticky top-0 z-10 cursor-pointer hover:bg-gray-50 transition-colors group/sort"
                  onClick={() => { if (sortField === 'rice') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('rice'); setSortDir('desc'); } }}
                >
                  <div className="flex items-center justify-center gap-1">
                    RICE
                    <svg className={`w-3.5 h-3.5 transition-transform duration-200 ${sortField === 'rice' ? 'text-donezo-primary opacity-100' : 'text-gray-300 opacity-0 group-hover/sort:opacity-100'} ${sortField === 'rice' && sortDir === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                    </svg>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map((issue, idx) => {
                const row   = scores.get(issue.key)!;
                const score = calcScore(row);
                const cls   = scoreBadgeCls(score, maxScore);
                const isDirty = dirtyKeys.has(issue.key);
                
                return (
                  <tr key={issue.key} className={`border-b border-gray-50 last:border-none hover:bg-donezo-light/30 transition-colors duration-200 group`}>
                    <td className="px-3 py-3.5 text-center text-xs font-bold text-gray-400 align-middle relative group-hover:text-donezo-dark transition-colors">
                      {isDirty && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-orange-400 shadow-sm" title="Несохраненные изменения" />
                      )}
                      {score !== null ? idx + 1 : '—'}
                    </td>
                    <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                      <a
                        href={`${JIRA_BASE}/${issue.key}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {issue.key}
                      </a>
                    </td>
                    <td className="px-3 py-2.5 align-middle text-slate-900 min-w-[200px]">
                      {issue.summary}
                    </td>
                    <td className="px-3 py-2.5 align-middle text-xs text-gray-500 whitespace-nowrap">{issue.status}</td>
                    <td className="px-3 py-2.5 align-middle">
                      <input
                        className={`w-24 px-3 py-2 border rounded-xl text-sm font-semibold outline-none no-spinner transition-all duration-200 text-slate-900 caret-slate-900 ${saving ? 'bg-transparent text-gray-400 border-transparent' : 'bg-gray-50 border-gray-100 focus:border-donezo-primary focus:bg-white focus:ring-2 focus:ring-donezo-light'}`}
                        type="number"
                        min={0}
                        placeholder="0"
                        value={row.reach}
                        disabled={saving}
                        onChange={(e) => setField(issue.key, 'reach', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect
                        options={IMPACT_OPTIONS}
                        value={row.impact}
                        onChange={(v) => setField(issue.key, 'impact', v)}
                        disabled={saving}
                        fmt={(v) => `${IMPACT_LABELS[String(v)]} (${v})`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect
                        options={CONF_OPTIONS}
                        value={row.confidence}
                        onChange={(v) => setField(issue.key, 'confidence', v)}
                        disabled={saving}
                        fmt={(v) => `${v}%`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Stepper value={row.effort} onChange={(v) => setField(issue.key, 'effort', v)} disabled={saving} />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle relative group/rice">
                      {score !== null
                        ? <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full min-w-[52px] text-center transition-all ${cls}`}>{score}</span>
                        : <span className="text-gray-300 text-base">—</span>}
                      
                      {/* Urgent 9999 Button */}
                      <button
                        title="Установить срочно (RICE 9999)"
                        onClick={() => setUrgent9999(issue.key)}
                        disabled={saving}
                        className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/rice:opacity-100 p-1 hover:scale-125 transition-all text-lg cursor-pointer bg-white rounded-full shadow-sm border border-gray-100 disabled:opacity-0 disabled:cursor-auto"
                      >
                        🔥
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Action Button (FAB) */}
      {dirtyKeys.size > 0 && (
        <div className="fixed bottom-8 right-8 z-50 group">
          <div className="absolute -inset-2 bg-donezo-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <button 
            className="relative px-8 py-4 bg-donezo-dark text-white rounded-full text-sm font-bold cursor-pointer border border-donezo-light shadow-2xl transition-all hover:bg-donezo-primary hover:-translate-y-1 flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={save}
            disabled={saving || loading}
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
