import type { JiraIssueShort } from '../types';
import { isEpicType } from './issueTypes';

export const UNGROUPED_TASKS_ID = '__without_epic__';

export interface TaskHierarchyRow {
  issue: JiraIssueShort;
  depth: 0 | 1;
  parentKey: string | null;
  parentFound: boolean;
}

export interface TaskHierarchyGroup {
  id: string;
  epicKey: string | null;
  epic: JiraIssueShort | null;
  rows: TaskHierarchyRow[];
  latestIssue: JiraIssueShort | null;
  isUngrouped: boolean;
}

interface TaskHierarchyTableBase {
  id: string;
  epicKey: string | null;
  parentKey: string | null;
  parentFound: boolean;
  subRows: TaskHierarchyTableRow[];
}

export interface TaskHierarchyTableGroupRow extends TaskHierarchyTableBase {
  kind: 'epic-group' | 'orphan-group';
  issue: JiraIssueShort | null;
  title: string;
  isSynthetic: boolean;
  latestIssue: JiraIssueShort | null;
  parentKey: null;
  parentFound: true;
}

export interface TaskHierarchyTableIssueRow extends TaskHierarchyTableBase {
  kind: 'issue';
  issue: JiraIssueShort;
  title: string;
  isSynthetic: false;
  latestIssue: null;
}

export type TaskHierarchyTableRow = TaskHierarchyTableGroupRow | TaskHierarchyTableIssueRow;

function issueKeyRank(key: string): number {
  const match = key.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function issueDateMs(issue: JiraIssueShort): number | null {
  const value = issue.updated ?? issue.created;
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function compareIssueFreshness(left: JiraIssueShort, right: JiraIssueShort): number {
  const leftDate = issueDateMs(left);
  const rightDate = issueDateMs(right);

  if (leftDate !== null && rightDate !== null && leftDate !== rightDate) {
    return rightDate - leftDate;
  }

  if (leftDate !== null && rightDate === null) return -1;
  if (leftDate === null && rightDate !== null) return 1;

  const leftRank = issueKeyRank(left.key);
  const rightRank = issueKeyRank(right.key);
  if (leftRank !== rightRank) return rightRank - leftRank;

  return right.key.localeCompare(left.key, 'ru', { numeric: true, sensitivity: 'base' });
}

function compareIssueKeyDesc(left: JiraIssueShort, right: JiraIssueShort): number {
  return right.key.localeCompare(left.key, 'ru', { numeric: true, sensitivity: 'base' });
}

function relationKey(issue: JiraIssueShort, field: 'epic' | 'parent'): string | null {
  if (field === 'epic') return issue.epic_key ?? issue.epic?.key ?? null;
  return issue.parent_key ?? issue.parent?.key ?? null;
}

function resolveIssueEpicKey(
  issue: JiraIssueShort,
  issueByKey: Map<string, JiraIssueShort>,
  seen = new Set<string>(),
): string | null {
  const ownEpicKey = relationKey(issue, 'epic');
  if (ownEpicKey) return ownEpicKey;

  const parentKey = relationKey(issue, 'parent');
  if (!parentKey || seen.has(parentKey)) return null;

  const parent = issueByKey.get(parentKey);
  if (!parent) return null;
  if (isEpicType(parent.issuetype)) return parent.key;

  seen.add(issue.key);
  return resolveIssueEpicKey(parent, issueByKey, seen);
}

function pickLatest(issues: JiraIssueShort[]): JiraIssueShort | null {
  if (issues.length === 0) return null;
  return [...issues].sort(compareIssueFreshness)[0] ?? null;
}

function buildGroupRows(members: JiraIssueShort[]): TaskHierarchyRow[] {
  const memberKeys = new Set(members.map((issue) => issue.key));
  const childrenByParent = new Map<string, JiraIssueShort[]>();
  const topLevel: JiraIssueShort[] = [];
  const orphanChildren: JiraIssueShort[] = [];

  for (const issue of members) {
    const parentKey = relationKey(issue, 'parent');
    if (parentKey && memberKeys.has(parentKey)) {
      const children = childrenByParent.get(parentKey) ?? [];
      children.push(issue);
      childrenByParent.set(parentKey, children);
      continue;
    }

    if (parentKey) {
      orphanChildren.push(issue);
      continue;
    }

    topLevel.push(issue);
  }

  const rows: TaskHierarchyRow[] = [];
  for (const issue of topLevel.sort(compareIssueFreshness)) {
    rows.push({ issue, depth: 0, parentKey: null, parentFound: false });
    const children = childrenByParent.get(issue.key) ?? [];
    for (const child of children.sort(compareIssueFreshness)) {
      rows.push({ issue: child, depth: 1, parentKey: issue.key, parentFound: true });
    }
  }

  for (const issue of orphanChildren.sort(compareIssueFreshness)) {
    rows.push({ issue, depth: 1, parentKey: relationKey(issue, 'parent'), parentFound: false });
  }

  return rows;
}

function buildIssueTableRow(issue: JiraIssueShort, parentKey: string | null, parentFound: boolean): TaskHierarchyTableIssueRow {
  return {
    id: `issue:${issue.key}`,
    kind: 'issue',
    issue,
    title: issue.summary,
    epicKey: relationKey(issue, 'epic'),
    parentKey,
    parentFound,
    isSynthetic: false,
    latestIssue: null,
    subRows: [],
  };
}

function buildNestedGroupRows(members: JiraIssueShort[]): TaskHierarchyTableIssueRow[] {
  const memberKeys = new Set(members.map((issue) => issue.key));
  const childrenByParent = new Map<string, JiraIssueShort[]>();
  const topLevel: JiraIssueShort[] = [];
  const orphanChildren: JiraIssueShort[] = [];

  for (const issue of members) {
    const parentKey = relationKey(issue, 'parent');
    if (parentKey && memberKeys.has(parentKey)) {
      const children = childrenByParent.get(parentKey) ?? [];
      children.push(issue);
      childrenByParent.set(parentKey, children);
      continue;
    }

    if (parentKey) {
      orphanChildren.push(issue);
      continue;
    }

    topLevel.push(issue);
  }

  const rows = topLevel.sort(compareIssueKeyDesc).map((issue) => {
    const row = buildIssueTableRow(issue, null, false);
    row.subRows = (childrenByParent.get(issue.key) ?? [])
      .sort(compareIssueKeyDesc)
      .map((child) => buildIssueTableRow(child, issue.key, true));
    return row;
  });

  rows.push(
    ...orphanChildren
      .sort(compareIssueKeyDesc)
      .map((issue) => buildIssueTableRow(issue, relationKey(issue, 'parent'), false)),
  );

  return rows;
}

export function buildTaskHierarchyGroups(issues: JiraIssueShort[]): TaskHierarchyGroup[] {
  const buckets = new Map<string, { epic: JiraIssueShort | null; members: JiraIssueShort[] }>();
  const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));

  const ensureBucket = (id: string) => {
    const existing = buckets.get(id);
    if (existing) return existing;
    const bucket = { epic: null, members: [] };
    buckets.set(id, bucket);
    return bucket;
  };

  for (const issue of issues) {
    if (isEpicType(issue.issuetype)) {
      ensureBucket(issue.key).epic = issue;
      continue;
    }

    const epicKey = resolveIssueEpicKey(issue, issueByKey);
    ensureBucket(epicKey ?? UNGROUPED_TASKS_ID).members.push(issue);
  }

  const groups = [...buckets.entries()].map(([id, bucket]): TaskHierarchyGroup => {
    const rows = buildGroupRows(bucket.members);
    const latestIssue = pickLatest(bucket.epic ? [bucket.epic, ...bucket.members] : bucket.members);

    return {
      id,
      epicKey: id === UNGROUPED_TASKS_ID ? null : id,
      epic: bucket.epic,
      rows,
      latestIssue,
      isUngrouped: id === UNGROUPED_TASKS_ID,
    };
  });

  return groups.sort((left, right) => {
    if (left.latestIssue && right.latestIssue) {
      const freshness = compareIssueFreshness(left.latestIssue, right.latestIssue);
      if (freshness !== 0) return freshness;
    }

    if (left.latestIssue && !right.latestIssue) return -1;
    if (!left.latestIssue && right.latestIssue) return 1;

    return left.id.localeCompare(right.id, 'ru', { numeric: true, sensitivity: 'base' });
  });
}

export function buildTaskHierarchyTableRows(issues: JiraIssueShort[]): TaskHierarchyTableRow[] {
  const buckets = new Map<string, { epic: JiraIssueShort | null; members: JiraIssueShort[] }>();
  const issueByKey = new Map(issues.map((issue) => [issue.key, issue]));

  const ensureBucket = (id: string) => {
    const existing = buckets.get(id);
    if (existing) return existing;
    const bucket = { epic: null, members: [] };
    buckets.set(id, bucket);
    return bucket;
  };

  for (const issue of issues) {
    if (isEpicType(issue.issuetype)) {
      ensureBucket(issue.key).epic = issue;
      continue;
    }

    const epicKey = resolveIssueEpicKey(issue, issueByKey);
    ensureBucket(epicKey ?? UNGROUPED_TASKS_ID).members.push(issue);
  }

  const rows = [...buckets.entries()].map(([id, bucket]): TaskHierarchyTableGroupRow => {
    const subRows = buildNestedGroupRows(bucket.members);
    const latestIssue = pickLatest(bucket.epic ? [bucket.epic, ...bucket.members] : bucket.members);
    const isUngrouped = id === UNGROUPED_TASKS_ID;

    return {
      id: `group:${id}`,
      kind: isUngrouped ? 'orphan-group' : 'epic-group',
      issue: bucket.epic,
      title: bucket.epic?.summary ?? (isUngrouped ? 'Без эпика' : id),
      epicKey: isUngrouped ? null : id,
      parentKey: null,
      parentFound: true,
      isSynthetic: !bucket.epic,
      latestIssue,
      subRows,
    };
  });

  return rows.sort((left, right) => {
    if (left.kind === 'orphan-group' && right.kind !== 'orphan-group') return -1;
    if (left.kind !== 'orphan-group' && right.kind === 'orphan-group') return 1;

    const leftKey = left.epicKey ?? left.id;
    const rightKey = right.epicKey ?? right.id;
    return rightKey.localeCompare(leftKey, 'ru', { numeric: true, sensitivity: 'base' });
  });
}
