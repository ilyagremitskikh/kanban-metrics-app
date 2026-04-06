import type { Issue, WorkflowConfig } from '../types';

export function mean(arr: number[]): number | null {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
}

export function percentile(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

export function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

export function fmtWeekLabel(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' });
}

export function extractStatusesOrdered(issues: Issue[]): string[] {
  const posSum = new Map<string, number>();
  const posCnt = new Map<string, number>();

  for (const issue of issues) {
    const sorted = [...issue.transitions].sort(
      (a, b) => new Date(a.enteredAt).getTime() - new Date(b.enteredAt).getTime(),
    );
    sorted.forEach((t, i) => {
      posSum.set(t.status, (posSum.get(t.status) || 0) + i);
      posCnt.set(t.status, (posCnt.get(t.status) || 0) + 1);
    });
  }

  return [...posSum.keys()].sort((a, b) => {
    const avgA = posSum.get(a)! / posCnt.get(a)!;
    const avgB = posSum.get(b)! / posCnt.get(b)!;
    return avgA - avgB;
  });
}

export function getMonthlyChunks(
  fromDate: Date,
  toDate: Date,
): { from: string; to: string; label: string }[] {
  const chunks: { from: string; to: string; label: string }[] = [];
  const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  while (cur <= toDate) {
    const chunkFrom = new Date(Math.max(cur.getTime(), fromDate.getTime()));
    const lastDay = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
    const chunkTo = new Date(Math.min(lastDay.getTime(), toDate.getTime()));
    chunks.push({
      from: chunkFrom.toISOString().slice(0, 10),
      to: chunkTo.toISOString().slice(0, 10),
      label: cur.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
    });
    cur.setMonth(cur.getMonth() + 1);
  }
  return chunks;
}

export function toMonday(d: Date): Date {
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

/** Statuses that are terminal but don't represent delivered work (fallback when statusCategory is absent) */
export const NON_DONE_TERMINAL = new Set(['Отменена', 'Архив', 'Установлено']);

/** Returns true if the issue is in a non-done terminal state (cancelled/archived).
 *  Prefers Jira's statusCategory when available; falls back to the hardcoded set. */
export function isNonDoneTerminal(issue: { currentStatus: string; statusCategory?: string }): boolean {
  if (issue.statusCategory !== undefined) {
    // "new" = todo, "indeterminate" = in-progress, "done" = completed (delivered).
    // Anything "done" that isn't delivered work has resolution set — handled separately.
    // We treat statusCategory "done" with no resolution as delivered, so only
    // hardcode-check remains for statuses whose category Jira reports as "done" but
    // which aren't real deliveries (e.g. "Установлено" meaning "installed/deployed").
    return NON_DONE_TERMINAL.has(issue.currentStatus);
  }
  return NON_DONE_TERMINAL.has(issue.currentStatus);
}

/** Find first status matching any of the given name fragments.
 *  Priority: exact → startsWith → includes.
 *  startsWith prevents "Готово к разработке" from beating "Разработка::В работе"
 *  when searching for fragment "разработка".
 */
function findStatus(statuses: string[], fragments: string[]): string | undefined {
  for (const frag of fragments) {
    const f = frag.toLowerCase();
    const exact = statuses.find((s) => s.toLowerCase() === f);
    if (exact) return exact;
    const starts = statuses.find((s) => s.toLowerCase().startsWith(f));
    if (starts) return starts;
    const partial = statuses.find((s) => s.toLowerCase().includes(f));
    if (partial) return partial;
  }
}

export function detectWorkflows(issues: Issue[]): WorkflowConfig[] {
  const typeStatuses = new Map<string, Set<string>>();
  for (const issue of issues) {
    if (!typeStatuses.has(issue.type)) typeStatuses.set(issue.type, new Set());
    const set = typeStatuses.get(issue.type)!;
    for (const t of issue.transitions) set.add(t.status);
  }

  const types = [...typeStatuses.keys()];
  const groups: string[][] = [];
  const assigned = new Set<string>();

  for (const type of types) {
    if (assigned.has(type)) continue;
    const group = [type];
    assigned.add(type);
    const setA = typeStatuses.get(type)!;

    for (const other of types) {
      if (assigned.has(other)) continue;
      const setB = typeStatuses.get(other)!;
      const intersection = [...setA].filter((s) => setB.has(s)).length;
      const union = new Set([...setA, ...setB]).size;
      if (intersection / union > 0.5) {
        group.push(other);
        assigned.add(other);
      }
    }
    groups.push(group);
  }

  return groups.map((groupTypes) => {
    const groupIssues = issues.filter((i) => groupTypes.includes(i.type));
    const statuses = extractStatusesOrdered(groupIssues);
    // Collect all statuses ever seen for this group (including from type-level sets)
    const allStatuses = new Set<string>();
    for (const t of groupTypes) {
      for (const s of typeStatuses.get(t) ?? []) allStatuses.add(s);
    }
    // Exclude non-done terminals when picking end statuses
    const doneStatuses = statuses.filter((s) => !NON_DONE_TERMINAL.has(s));

    // User Story group has unique discovery-phase statuses; Tasks/Ошибка/Техдолг don't
    const isUserStory = ['Идея', 'Проработка идеи', 'Готово к проработке'].some((s) =>
      allStatuses.has(s),
    );

    // ltStart differs by group:
    // User Story: lifecycle starts at 'Идея' (discovery phase); 'Бэклог' is a side branch
    // Tasks/Ошибка/Техдолг: lifecycle starts at 'Бэклог'
    const ltStart = isUserStory
      ? findStatus(statuses, ['идея', 'idea']) ?? 'Идея'
      : findStatus(statuses, ['бэклог', 'backlog']) ?? 'Бэклог';

    const ltEnd =
      findStatus(doneStatuses, ['готово', 'done', 'выполнено']) ??
      doneStatuses[doneStatuses.length - 1] ??
      statuses[statuses.length - 1] ?? '';

    // ctStart: US workflow uses different dev status names than Tasks.
    // Search broadly for US, narrowly for Tasks (to avoid matching 'Готово к разработке').
    // ctStart: for US search broadly (dev status may be named differently from Tasks).
    // For Tasks search narrowly to avoid matching 'Готово к разработке'.
    // ctStart: for US, exact match "Разработка" first to avoid matching "Разработка прототипа".
    // For Tasks, findStatus is safe because "Готово к разработке" doesn't startsWith "разработка".
    const ctStart = isUserStory
      ? (statuses.find((s) => s.toLowerCase() === 'разработка')
         ?? findStatus(statuses, ['в работе', 'в разработке', 'development'])
         ?? 'Разработка')
      : findStatus(statuses, ['разработка']) ?? 'Разработка';

    // ctEnd differs by group:
    // Tasks/Ошибка/Техдолг: 'Готова к Prod' (development done, awaiting release)
    // User Story: 'Готово' (no separate Prod-ready status in US flow)
    const ctEnd = isUserStory
      ? ltEnd
      : findStatus(doneStatuses, ['готова к prod', 'к prod', 'готова к прод']) ??
        'Готова к Prod';

    return { types: groupTypes, statuses, ltStart, ltEnd, ctStart, ctEnd };
  });
}
