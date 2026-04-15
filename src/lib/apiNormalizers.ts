import type { Issue, JiraIssueRef, JiraIssueShort, RiceIssue, ThroughputIssueRaw } from '../types';

type RawIssue = Partial<Issue> & {
  type?: string;
  issuetype?: string;
  issueType?: string;
  issue_type?: string;
  currentStatus?: string;
  status?: string;
};

type RawJiraIssue = Omit<Partial<JiraIssueShort>, 'children'> & {
  parent?: JiraIssueRef | null;
  epic?: JiraIssueRef | null;
  children?: RawJiraIssue[];
  issue_type?: string;
  issueType?: string;
  parentKey?: string | null;
  epicKey?: string | null;
};

type RawThroughputIssue = Partial<ThroughputIssueRaw> & {
  issue_type?: string;
  issuetype?: string;
  type?: string;
};

type RawRiceIssue = Partial<RiceIssue> & {
  issuetype?: string;
  issueType?: string;
  labels?: string | string[];
};

function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  return '';
}

function toNumber(value: unknown): number | null | undefined {
  if (value == null) return value as null | undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function normalizeIssue(raw: RawIssue): Issue {
  const transitions = Array.isArray(raw.transitions)
    ? raw.transitions.filter((t): t is Issue['transitions'][number] => Boolean(t?.to && t?.date))
    : [];
  return {
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    type: raw.type ?? raw.issuetype ?? raw.issueType ?? raw.issue_type ?? 'Не указан',
    created: raw.created ?? new Date().toISOString(),
    currentStatus: raw.currentStatus ?? raw.status ?? '',
    transitions,
  };
}

export function normalizeJiraIssue(raw: RawJiraIssue): JiraIssueShort {
  const parentKey = raw.parent_key ?? raw.parentKey ?? raw.parent?.key;
  const epicKey = raw.epic_key ?? raw.epicKey ?? raw.epic?.key;
  const children = Array.isArray(raw.children)
    ? raw.children.map((child) => normalizeJiraIssue(child))
    : undefined;

  return {
    ...raw,
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    status: raw.status ?? '',
    priority: raw.priority ?? '',
    issuetype: raw.issuetype ?? raw.issue_type ?? raw.issueType ?? '',
    parent: raw.parent ?? undefined,
    parent_key: parentKey,
    epic: raw.epic ?? undefined,
    epic_key: epicKey,
    children,
    score: toNumber(raw.score),
    rice_score: toNumber(raw.rice_score),
    bug_score: toNumber(raw.bug_score),
    td_roi: toNumber(raw.td_roi),
    reach: toNumber(raw.reach),
    impact: toNumber(raw.impact),
    confidence: toNumber(raw.confidence),
    effort: toNumber(raw.effort),
    bug_risk: toNumber(raw.bug_risk),
    bug_process: toNumber(raw.bug_process),
    bug_scale: toNumber(raw.bug_scale),
    bug_workaround: toNumber(raw.bug_workaround),
    td_impact: toNumber(raw.td_impact),
    td_effort: toNumber(raw.td_effort),
  };
}

export function normalizeThroughputIssue(raw: RawThroughputIssue): ThroughputIssueRaw {
  return {
    key: raw.key ?? '',
    issueType: raw.issueType ?? raw.issue_type ?? raw.issuetype ?? raw.type ?? '',
    assignee: raw.assignee ?? null,
    resolution: raw.resolution ?? null,
    resolutionDate: raw.resolutionDate ?? null,
  };
}

export function normalizeRiceIssue(raw: RawRiceIssue): RiceIssue {
  return {
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    issue_type: raw.issue_type ?? raw.issuetype ?? raw.issueType ?? '',
    labels: toText(raw.labels),
    priority: raw.priority ?? '',
    status: raw.status ?? '',
    reach: toNumber(raw.reach) ?? null,
    impact: toNumber(raw.impact) ?? null,
    confidence: toNumber(raw.confidence) ?? null,
    effort: toNumber(raw.effort) ?? null,
    rice_score: toNumber(raw.rice_score) ?? null,
    bug_risk: toNumber(raw.bug_risk) ?? null,
    bug_process: toNumber(raw.bug_process) ?? null,
    bug_scale: toNumber(raw.bug_scale) ?? null,
    bug_workaround: toNumber(raw.bug_workaround) ?? null,
    bug_score: toNumber(raw.bug_score) ?? null,
    td_impact: toNumber(raw.td_impact) ?? null,
    td_effort: toNumber(raw.td_effort) ?? null,
    td_roi: toNumber(raw.td_roi) ?? null,
  };
}
