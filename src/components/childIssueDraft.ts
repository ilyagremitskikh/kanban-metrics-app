import { normalizePriority } from '../lib/priorities';
import type { AiGenerateResponse, AiIssueContext, AiIssueContextRef, ChecklistItem, JiraIssueShort } from '../types';

type ParentIssueForAi = Pick<
  JiraIssueShort,
  'key' | 'issuetype' | 'summary' | 'description' | 'status' | 'priority' | 'labels'
>;

interface BuildChildAiContextArgs {
  parentIssue?: ParentIssueForAi | null;
  parentIsEpic: boolean;
}

function compactIssueContext(issue: ParentIssueForAi): AiIssueContextRef {
  return {
    key: issue.key,
    issuetype: issue.issuetype,
    summary: issue.summary,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    labels: issue.labels ?? [],
  };
}

export function buildChildAiContext({ parentIssue, parentIsEpic }: BuildChildAiContextArgs): AiIssueContext {
  if (!parentIssue) return {};

  const context = compactIssueContext(parentIssue);
  return parentIsEpic ? { epic: context } : { parent: context };
}

interface ResolveChildAiDraftArgs {
  result: Partial<AiGenerateResponse>;
  parentIsEpic: boolean;
  currentType: string;
  allowedEpicTypes: string[];
  subtaskType: string;
}

export interface ChildAiDraft {
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
  checklists?: ChecklistItem[];
}

export function resolveChildAiDraft({
  result,
  parentIsEpic,
  currentType,
  allowedEpicTypes,
  subtaskType,
}: ResolveChildAiDraftArgs): ChildAiDraft {
  const aiIssueType = result.issuetype;
  const issuetype = parentIsEpic && aiIssueType && allowedEpicTypes.includes(aiIssueType)
    ? aiIssueType
    : parentIsEpic
      ? currentType
      : subtaskType;

  return {
    summary: result.summary ?? '',
    description: result.description ?? '',
    priority: normalizePriority(result.priority ?? 'Нормальный'),
    issuetype,
    checklists: result.checklists,
  };
}

interface BuildChildCreateLinksArgs {
  parentKey: string;
  parentIsEpic: boolean;
}

export function buildChildCreateLinks({ parentKey, parentIsEpic }: BuildChildCreateLinksArgs): {
  parentKey?: string;
  epicKey?: string;
  parent?: { key: string };
  epic?: { key: string };
} {
  if (parentIsEpic) {
    return {
      epicKey: parentKey,
      epic: { key: parentKey },
    };
  }

  return {
    parentKey,
    parent: { key: parentKey },
  };
}

interface BuildChildOptimisticLinksArgs {
  parentKey: string;
  parentIsEpic: boolean;
  parentEpicKey?: string | null;
}

export function buildChildOptimisticLinks({
  parentKey,
  parentIsEpic,
  parentEpicKey,
}: BuildChildOptimisticLinksArgs): {
  parentKey?: string;
  epicKey?: string;
} {
  if (parentIsEpic) {
    return { epicKey: parentKey };
  }

  return {
    parentKey,
    epicKey: parentEpicKey ?? undefined,
  };
}
