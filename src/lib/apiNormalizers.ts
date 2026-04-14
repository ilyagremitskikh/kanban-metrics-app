import type { Issue, JiraIssueEpic, JiraIssueParent, JiraIssueShort, RiceIssue, ThroughputIssueRaw } from '../types';

type RawIssue = Partial<Issue> & {
  type?: string;
  issuetype?: string;
  issueType?: string;
  issue_type?: string;
  currentStatus?: string;
  status?: string;
};

type RawJiraIssue = Partial<JiraIssueShort> & {
  issue_type?: string;
  issueType?: string;
  parent?: unknown;
  epic?: unknown;
  epic_key?: unknown;
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
  parent?: unknown;
  epic?: unknown;
  epic_key?: unknown;
};

type RawParent = Partial<JiraIssueParent> & {
  fields?: {
    summary?: unknown;
    status?: { name?: unknown };
    priority?: { name?: unknown };
  };
};

type RawEpic = Partial<JiraIssueEpic> & {
  fields?: {
    summary?: unknown;
    status?: { name?: unknown };
    priority?: { name?: unknown };
  };
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

function normalizeParent(raw: unknown): JiraIssueParent | null {
  if (!raw || typeof raw !== 'object') return null;
  const parent = raw as RawParent;
  const key = typeof parent.key === 'string' ? parent.key : '';
  if (!key) return null;

  const summary = typeof parent.summary === 'string'
    ? parent.summary
    : typeof parent.fields?.summary === 'string'
      ? parent.fields.summary
      : '';

  const status = typeof parent.status === 'string'
    ? parent.status
    : typeof parent.fields?.status?.name === 'string'
      ? parent.fields.status.name
      : undefined;

  const priority = typeof parent.priority === 'string'
    ? parent.priority
    : typeof parent.fields?.priority?.name === 'string'
      ? parent.fields.priority.name
      : undefined;

  return {
    id: typeof parent.id === 'string' ? parent.id : undefined,
    key,
    summary,
    status,
    priority,
  };
}

function normalizeEpic(raw: unknown): JiraIssueEpic | null {
  if (typeof raw === 'string') {
    const key = raw.trim();
    return key ? { key } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const epic = raw as RawEpic;
  const key = typeof epic.key === 'string' ? epic.key : '';
  if (!key) return null;

  const summary = typeof epic.summary === 'string'
    ? epic.summary
    : typeof epic.fields?.summary === 'string'
      ? epic.fields.summary
      : undefined;

  const status = typeof epic.status === 'string'
    ? epic.status
    : typeof epic.fields?.status?.name === 'string'
      ? epic.fields.status.name
      : undefined;

  const priority = typeof epic.priority === 'string'
    ? epic.priority
    : typeof epic.fields?.priority?.name === 'string'
      ? epic.fields.priority.name
      : undefined;

  return { key, summary, status, priority };
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
  const epic = normalizeEpic(raw.epic ?? raw.epic_key);
  return {
    ...raw,
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    status: raw.status ?? '',
    priority: raw.priority ?? '',
    issuetype: raw.issuetype ?? raw.issue_type ?? raw.issueType ?? '',
    parent: normalizeParent(raw.parent),
    epic,
    epic_key: typeof raw.epic_key === 'string' ? raw.epic_key : epic?.key ?? null,
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
  const epic = normalizeEpic(raw.epic ?? raw.epic_key);
  return {
    key: raw.key ?? '',
    summary: raw.summary ?? '',
    issue_type: raw.issue_type ?? raw.issuetype ?? raw.issueType ?? '',
    parent: normalizeParent(raw.parent),
    epic,
    epic_key: typeof raw.epic_key === 'string' ? raw.epic_key : epic?.key ?? null,
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
