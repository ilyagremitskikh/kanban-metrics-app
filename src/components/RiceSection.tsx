import { useState } from 'react';
import { fetchRiceIssues, saveRiceScores } from '../lib/riceApi';
import type { RiceIssue } from '../types';

const JIRA_BASE    = 'https://jira.tochka.com/browse';
const IMPACT_OPTIONS = [0.25, 0.5, 1, 2, 3];
const CONF_OPTIONS   = [25, 50, 80, 100];
const EFFORT_MIN     = 0.5;
const EFFORT_STEP    = 0.5;
const EFFORT_MAX     = 40;

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
  options, value, onChange, fmt = String,
}: {
  options: number[]; value: string; onChange: (v: string) => void; fmt?: (v: number) => string;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => {
        const s = String(opt);
        return (
          <button
            key={s}
            className={`px-2.5 py-1 border rounded-lg text-xs font-semibold cursor-pointer transition whitespace-nowrap leading-none ${
              value === s
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-700 hover:bg-blue-50'
            }`}
            onClick={() => onChange(value === s ? '' : s)}
          >
            {fmt(opt)}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const num = parseFloat(value) || 0;
  const dec = (n: number) => onChange(String(Math.max(EFFORT_MIN, +(n - EFFORT_STEP).toFixed(1))));
  const inc = (n: number) => onChange(String(Math.min(EFFORT_MAX, +(n + EFFORT_STEP).toFixed(1))));
  return (
    <div className="inline-flex items-center border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-8 h-9 border-none bg-gray-50 text-gray-700 text-lg leading-none cursor-pointer flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition"
        onClick={() => dec(num)}
      >−</button>
      <input
        className="w-12 text-center text-sm font-semibold text-slate-900 border-none outline-none bg-white h-9 no-spinner"
        type="number"
        min={EFFORT_MIN}
        max={EFFORT_MAX}
        step={EFFORT_STEP}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        className="w-8 h-9 border-none bg-gray-50 text-gray-700 text-lg leading-none cursor-pointer flex items-center justify-center flex-shrink-0 hover:bg-gray-200 transition"
        onClick={() => inc(num)}
      >+</button>
    </div>
  );
}

interface Props {
  webhookUrl: string;
  onSendToQueue: (items: string[]) => void;
  onSwitchToMetrics: () => void;
}

export function RiceSection({ webhookUrl, onSendToQueue, onSwitchToMetrics }: Props) {
  const [issues, setIssues]   = useState<RiceIssue[]>([]);
  const [scores, setScores]   = useState<Map<string, ScoreRow>>(new Map());
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
      setMsg({ text: `Загружено ${data.length} задач`, ok: true });
    } catch (e) {
      setMsg({ text: `Ошибка: ${(e as Error).message}`, ok: false });
    } finally { setLoading(false); }
  };

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const updates = issues.flatMap((issue) => {
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
      if (!updates.length) { setMsg({ text: 'Нет задач с заполненными оценками', ok: false }); return; }
      await saveRiceScores(webhookUrl, updates);
      setMsg({ text: `Сохранено ${updates.length} задач`, ok: true });
    } catch (e) {
      setMsg({ text: `Ошибка: ${(e as Error).message}`, ok: false });
    } finally { setSaving(false); }
  };

  const setField = (key: string, field: keyof ScoreRow, value: string) =>
    setScores((prev) => { const m = new Map(prev); m.set(key, { ...m.get(key)!, [field]: value }); return m; });

  const sortedIssues = [...issues].sort((a, b) => {
    const sa = calcScore(scores.get(a.key) ?? initRow(a)) ?? -1;
    const sb = calcScore(scores.get(b.key) ?? initRow(b)) ?? -1;
    return sb - sa;
  });

  const allScores   = sortedIssues.map((i) => calcScore(scores.get(i.key)!)).filter((s): s is number => s !== null);
  const maxScore    = allScores.length ? Math.max(...allScores) : 0;
  const scoredCount = allScores.length;

  const sendToQueue = () => {
    const ranked = sortedIssues.filter((i) => calcScore(scores.get(i.key)!) !== null);
    onSendToQueue(ranked.map((i) => `${i.key} — ${i.summary}`));
    onSwitchToMetrics();
  };

  const btnSecondary = 'px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm font-semibold cursor-pointer transition hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed';
  const btnPrimary   = 'px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold cursor-pointer border-none transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <div>
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
          <button className={btnSecondary} onClick={load} disabled={loading}>
            {loading ? 'Загрузка…' : 'Загрузить из Jira'}
          </button>
          {issues.length > 0 && (
            <>
              <button className={btnSecondary} onClick={save} disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить оценки'}
              </button>
              {scoredCount > 0 && (
                <button className={btnPrimary} onClick={sendToQueue}>
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
        <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-11 text-center px-3 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">#</th>
                <th className="w-28 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">Задача</th>
                <th className="px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">Summary</th>
                <th className="w-36 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">Статус</th>
                <th className="w-28 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">
                  Reach<span className="block font-normal normal-case text-gray-300 tracking-normal">польз./мес.</span>
                </th>
                <th className="w-52 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">
                  Impact<span className="block font-normal normal-case text-gray-300 tracking-normal">0.25 · 0.5 · 1 · 2 · 3</span>
                </th>
                <th className="w-48 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">
                  Confidence<span className="block font-normal normal-case text-gray-300 tracking-normal">уверенность</span>
                </th>
                <th className="w-32 px-3 py-3.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">
                  Effort<span className="block font-normal normal-case text-gray-300 tracking-normal">сторипоинты</span>
                </th>
                <th className="w-24 text-center px-3 py-3.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b-2 border-gray-200 bg-white sticky top-0 z-10">RICE</th>
              </tr>
            </thead>
            <tbody>
              {sortedIssues.map((issue, idx) => {
                const row   = scores.get(issue.key)!;
                const score = calcScore(row);
                const cls   = scoreBadgeCls(score, maxScore);
                return (
                  <tr key={issue.key} className={`border-b border-gray-100 last:border-none hover:bg-blue-50/30 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-3 py-2.5 text-center text-xs font-bold text-gray-400 align-middle">
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
                        className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm outline-none no-spinner focus:border-blue-400 transition"
                        type="number"
                        min={0}
                        placeholder="0"
                        value={row.reach}
                        onChange={(e) => setField(issue.key, 'reach', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect
                        options={IMPACT_OPTIONS}
                        value={row.impact}
                        onChange={(v) => setField(issue.key, 'impact', v)}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <ChipSelect
                        options={CONF_OPTIONS}
                        value={row.confidence}
                        onChange={(v) => setField(issue.key, 'confidence', v)}
                        fmt={(v) => `${v}%`}
                      />
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Stepper value={row.effort} onChange={(v) => setField(issue.key, 'effort', v)} />
                    </td>
                    <td className="px-3 py-2.5 text-center align-middle">
                      {score !== null
                        ? <span className={`inline-block text-sm font-bold px-3 py-1 rounded-full min-w-[52px] text-center ${cls}`}>{score}</span>
                        : <span className="text-gray-300 text-base">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
