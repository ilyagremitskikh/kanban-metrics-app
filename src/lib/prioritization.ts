import type { RiceUpdate } from './riceApi';
import type { RiceIssue } from '../types';

export type PrioritizationIssueType = 'Story' | 'Task' | 'Bug' | 'TechDebt' | 'Subtask' | 'Epic' | 'Other';

export interface PrioritizationEpicRef {
  id: string;
  key: string;
  title: string;
}

export type PrioritizationIssue = Omit<RiceIssue, 'epic'> & {
  id: string;
  title: string;
  type: PrioritizationIssueType;
  parentId: string | null;
  parentEpicId: string | null;
  epic: PrioritizationEpicRef | null;
};

export interface PrioritizationData {
  featuresData: PrioritizationIssue[];
  bugsData: PrioritizationIssue[];
  techDebtData: PrioritizationIssue[];
  allById: Map<string, PrioritizationIssue>;
}

export interface PrioritizationGroupRow {
  id: string;
  kind: 'group';
  epicKey: string | null;
  title: string;
  isSynthetic: boolean;
  isOrphan: boolean;
  subRows: PrioritizationTaskRow[];
}

export type PrioritizationTaskRow = PrioritizationIssue & {
  kind: 'task';
  subRows?: never[];
};

export type PrioritizationTableRow = PrioritizationGroupRow | PrioritizationTaskRow;

type IssueTypeLike = {
  issue_type?: string | null;
  issuetype?: string | null;
  issueType?: string | null;
  type?: string | null;
};

function typeValue(issue: IssueTypeLike | string): string {
  if (typeof issue === 'string') return issue;
  return issue.issue_type ?? issue.issuetype ?? issue.issueType ?? issue.type ?? '';
}

function normalizedType(issue: IssueTypeLike | string): string {
  return typeValue(issue).trim().toLowerCase();
}

function compactType(issue: IssueTypeLike | string): string {
  return normalizedType(issue).replace(/[\s_-]+/g, '');
}

export function toPrioritizationIssueType(issue: IssueTypeLike | string): PrioritizationIssueType {
  const normalized = normalizedType(issue);
  const compact = compactType(issue);

  if (compact.includes('subtask') || normalized.includes('подзадача')) return 'Subtask';
  if (normalized === 'user story' || normalized === 'story' || normalized === 'пользовательская история') return 'Story';
  if (compact === 'techdebt' || normalized === 'техдолг') return 'TechDebt';
  if (normalized === 'bug' || normalized === 'ошибка') return 'Bug';
  if (normalized === 'task' || normalized === 'задача') return 'Task';
  if (normalized === 'epic' || normalized === 'эпик') return 'Epic';

  return 'Other';
}

function parentId(issue: RiceIssue): string | null {
  return issue.parent_key ?? issue.parent?.key ?? null;
}

function directEpicId(issue: RiceIssue): string | null {
  return issue.epic_key ?? issue.epic?.key ?? null;
}

function resolveEpicId(issue: PrioritizationIssue, byId: Map<string, PrioritizationIssue>, seen = new Set<string>()): string | null {
  if (issue.parentEpicId) return issue.parentEpicId;
  if (!issue.parentId || seen.has(issue.id)) return null;

  const parent = byId.get(issue.parentId);
  if (!parent) return null;
  if (parent.type === 'Epic') return parent.id;

  seen.add(issue.id);
  return resolveEpicId(parent, byId, seen);
}

function toPrioritizationIssue(issue: RiceIssue): PrioritizationIssue {
  return {
    ...issue,
    id: issue.key,
    title: issue.summary,
    type: toPrioritizationIssueType(issue),
    parentId: parentId(issue),
    parentEpicId: directEpicId(issue),
    epic: null,
  };
}

export function preparePrioritizationData(issues: RiceIssue[]): PrioritizationData {
  const allById = new Map<string, PrioritizationIssue>();

  for (const issue of issues) {
    const prepared = toPrioritizationIssue(issue);
    allById.set(prepared.id, prepared);
  }

  for (const issue of allById.values()) {
    const epicId = resolveEpicId(issue, allById);
    const epicIssue = epicId ? allById.get(epicId) : undefined;
    issue.parentEpicId = epicId;
    issue.epic = epicId ? { id: epicId, key: epicId, title: epicIssue?.title ?? epicId } : null;
  }

  const featuresData: PrioritizationIssue[] = [];
  const bugsData: PrioritizationIssue[] = [];
  const techDebtData: PrioritizationIssue[] = [];

  for (const issue of allById.values()) {
    if (issue.type === 'Story' || issue.type === 'Task') featuresData.push(issue);
    if (issue.type === 'Bug') bugsData.push(issue);
    if (issue.type === 'TechDebt') techDebtData.push(issue);
  }

  return { featuresData, bugsData, techDebtData, allById };
}

export function buildPrioritizationHierarchy(issues: PrioritizationIssue[]): PrioritizationTableRow[] {
  const rows: PrioritizationTableRow[] = [];
  let currentGroup: PrioritizationGroupRow | null = null;
  let segmentIndex = 0;

  for (const issue of issues) {
    if (issue.type === 'Subtask') continue;

    const epicKey = issue.parentEpicId ?? issue.epic?.key ?? null;
    const groupId = epicKey ?? '__without_epic__';
    if (!currentGroup || currentGroup.epicKey !== epicKey) {
      currentGroup = {
        id: `group:${groupId}:${segmentIndex}`,
        kind: 'group' as const,
        epicKey,
        title: epicKey ? (issue.epic?.title ?? epicKey) : 'Без эпика',
        isSynthetic: Boolean(epicKey && issue.epic?.title === epicKey),
        isOrphan: !epicKey,
        subRows: [],
      };
      rows.push(currentGroup);
      segmentIndex += 1;
    }

    currentGroup.subRows.push({ ...issue, kind: 'task' });
  }

  return rows;
}

function childrenOf(parentId: string, issues: PrioritizationIssue[]): PrioritizationIssue[] {
  return issues.filter((issue) => issue.parentId === parentId);
}

export function buildScoreInheritanceUpdates(parentUpdate: RiceUpdate, allIssues: Iterable<PrioritizationIssue>): RiceUpdate[] {
  const issues = Array.from(allIssues);
  const parentIssue = issues.find((issue) => issue.id === parentUpdate.key);
  const inheritedPriority = parentUpdate.priority ?? parentIssue?.priority;
  const updates: RiceUpdate[] = [{ ...parentUpdate, priority: inheritedPriority }];
  const queue = childrenOf(parentUpdate.key, issues);
  const seen = new Set<string>([parentUpdate.key]);

  while (queue.length > 0) {
    const issue = queue.shift();
    if (!issue || seen.has(issue.id)) continue;
    seen.add(issue.id);

    if (issue.type === 'Subtask') {
      updates.push({
        ...parentUpdate,
        key: issue.id,
        priority: inheritedPriority,
      });
    }

    queue.push(...childrenOf(issue.id, issues));
  }

  return updates;
}
