const USER_STORY_TYPE_MARKERS = ['user story', 'пользовательская история'];
const EPIC_TYPE_MARKERS = ['epic', 'эпик'];
const SUBTASK_TYPE_MARKERS = ['sub-task', 'subtask', 'подзадача'];

export const STANDARD_ISSUE_TYPES = [
  'Epic',
  'User Story',
  'Задача',
  'Ошибка',
  'Техдолг',
  'BUSINESS SUB-TASK',
  'Подзадача',
] as const;

export function isBusinessType(issuetype: string): boolean {
  const normalized = issuetype.trim().toLowerCase();
  return USER_STORY_TYPE_MARKERS.includes(normalized) || EPIC_TYPE_MARKERS.includes(normalized);
}

export function isEpicType(issuetype: string): boolean {
  return EPIC_TYPE_MARKERS.includes(issuetype.trim().toLowerCase());
}

export function isSubtaskType(issuetype: string): boolean {
  const normalized = issuetype.trim().toLowerCase();
  return SUBTASK_TYPE_MARKERS.some((marker) => normalized.includes(marker));
}

export function getEpicChildTypeOptions(availableTypes: readonly string[]): string[] {
  return availableTypes.filter((typeName) => {
    const normalized = typeName.trim();
    if (!normalized) return false;
    return !isEpicType(normalized) && !isSubtaskType(normalized);
  });
}

export function getStandaloneIssueTypeOptions(availableTypes: readonly string[]): string[] {
  return availableTypes.filter((typeName) => {
    const normalized = typeName.trim();
    if (!normalized) return false;
    return !isSubtaskType(normalized);
  });
}

export function getSubtaskTypeOption(availableTypes: readonly string[]): string {
  return availableTypes.find((typeName) => typeName.trim().toLowerCase() === 'подзадача')
    ?? availableTypes.find((typeName) => isSubtaskType(typeName))
    ?? 'Подзадача';
}

export function getAvailableIssueTypes(issues: IssueLike[]): string[] {
  const actualTypes = getUniqueTypes(issues);
  const standardTypes = [...STANDARD_ISSUE_TYPES];
  const standardNormalized = new Set(standardTypes.map((typeName) => typeName.toLowerCase()));
  const extras = actualTypes.filter((typeName) => !standardNormalized.has(typeName.toLowerCase()));

  return [...standardTypes, ...extras];
}

const PALETTE = [
  '#2563eb',
  '#ef4444',
  '#f59e0b',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#6366f1',
  '#d946ef',
] as const;

const BADGE_CLASSES = [
  { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100' },
  { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-100' },
  { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
  { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' },
  { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
  { bg: 'bg-pink-50', text: 'text-pink-700', border: 'border-pink-100' },
  { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-100' },
  { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-100' },
  { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  { bg: 'bg-lime-50', text: 'text-lime-700', border: 'border-lime-100' },
  { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
  { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-100' },
] as const;

type IssueLike = {
  issuetype?: string | null;
  type?: string | null;
  issueType?: string | null;
  issue_type?: string | null;
};

function normalizeType(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function hashType(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pickTypeName(issue: IssueLike): string | null | undefined {
  const candidates = [issue.issuetype, issue.type, issue.issueType, issue.issue_type];
  return candidates.find((value) => typeof value === 'string' && normalizeType(value).length > 0);
}

export function getUniqueTypes(issues: IssueLike[]): string[] {
  const unique = new Set<string>();
  for (const issue of issues) {
    const typeName = pickTypeName(issue);
    if (!typeName) continue;
    const normalized = normalizeType(typeName);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return [...unique].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function getTypeColor(typeName: string | null | undefined): string {
  const normalized = normalizeType(typeName);
  if (!normalized) return PALETTE[0];
  return PALETTE[hashType(normalized) % PALETTE.length];
}

export function getTypeBadgeClasses(typeName: string | null | undefined): {
  bg: string;
  text: string;
  border: string;
} {
  const normalized = normalizeType(typeName);
  if (!normalized) return BADGE_CLASSES[0];
  return BADGE_CLASSES[hashType(normalized) % BADGE_CLASSES.length];
}
