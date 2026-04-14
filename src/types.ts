export interface Transition {
  to: string;
  date: string;
  from?: string;
}

export interface Issue {
  key: string;
  summary: string;
  type: string;
  created: string;
  currentStatus: string;
  transitions: Transition[];
}

export interface TableRow {
  key: string;
  summary: string;
  type: string;
  currentStatus: string;
  created: string;
  leadTime: number | null;
  devCycleTime: number | null;
  upstreamTime: number | null;
  completedAt: Date | null;
}

export interface ThroughputWeek {
  date: string;
  count: number;
  byType?: Record<string, number>;
  byAssignee?: Record<string, number>;
}

export interface ThroughputIssueRaw {
  key: string;
  issueType: string;
  assignee?: string | null;
  resolution: string | null;
  resolutionDate: string | null;
}

export type JQLMode = 'standard' | 'custom';
export type MCMode = 'items' | 'date' | 'queue';
export type QueueForecastMode = 'conservative' | 'realistic' | 'agingAware';
export type SortDir = 'asc' | 'desc';
export type SortCol = keyof TableRow;

export interface SortState {
  col: SortCol;
  dir: SortDir;
}

export const JIRA_BASE_URL = 'https://jira.tochka.com/browse';

export interface Settings {
  n8nBaseUrl: string;
  mode: JQLMode;
  projectKey: string;
  customJql: string;
}

export interface RiceIssue {
  key: string;
  summary: string;
  issue_type: string;
  parent?: JiraIssueParent | null;
  epic?: JiraIssueEpic | null;
  epic_key?: string | null;
  labels: string;
  priority: string;
  status: string;
  // RICE fields (User Story / Задача)
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  rice_score: number | null;
  // Bug fields (FinTech Defect Scoring: R + P + S + W)
  bug_risk:       number | null;  // R: Финансовые/юридические/репутационные риски (40/15/0)
  bug_process:    number | null;  // P: Влияние на кредитный конвейер (30/10/2)
  bug_scale:      number | null;  // S: Масштаб проблемы (15/8/2)
  bug_workaround: number | null;  // W: Наличие обходного пути (15/7/1)
  bug_score:      number | null;  // Итого: R + P + S + W (макс. 100)
  // Tech Debt fields (Impact / Effort Matrix)
  td_impact: number | null;  // Влияние от решения (1–10)
  td_effort: number | null;  // Трудозатраты (1–10)
  td_roi:    number | null;  // ROI = Impact / Effort
}

// ── Jira Issues & AI Assistant ────────────────────────────────────────────────

export interface ChecklistItem {
  name: string;
  checked: boolean;
  mandatory: boolean;
  rank: number;
  isHeader: boolean;
  id?: number;
  assigneeIds?: string[];
  status?: string | null;
}

export interface JiraIssueShort {
  key: string;
  summary: string;
  status: string;
  priority: string;
  issuetype: string;
  parent?: JiraIssueParent | null;
  epic?: JiraIssueEpic | null;
  epic_key?: string | null;
  score?: number | null;
  rice_score?: number | null;
  bug_score?: number | null;
  td_roi?: number | null;
  reach?: number | null;
  impact?: number | null;
  confidence?: number | null;
  effort?: number | null;
  bug_risk?: number | null;
  bug_process?: number | null;
  bug_scale?: number | null;
  bug_workaround?: number | null;
  td_impact?: number | null;
  td_effort?: number | null;
  description?: string;
  project?: string;
  assignee?: string;
  reporter?: string;
  labels?: string[];
  created?: string;
  updated?: string;
  needToUpdateSource?: string;
  slService?: string;
  productCatalog?: string;
}

export interface JiraComment {
  author: string;
  body: string;
  created: string;
}

export interface JiraIssueParent {
  id?: string;
  key: string;
  summary: string;
  status?: string;
  priority?: string;
}

export interface JiraIssueEpic {
  key: string;
  summary?: string;
  status?: string;
  priority?: string;
}

export interface ParentIssueContext {
  key: string;
  summary: string;
  description: string;
  issuetype: string;
  status: string;
  priority: string;
  labels: string[];
}

export interface EpicIssueContext {
  key: string;
  summary: string;
  description: string;
  issuetype: string;
  status: string;
  priority: string;
  labels: string[];
}

export interface JiraAttachment {
  filename: string;
  mimeType: string;
  url: string;
}

export interface JiraIssueDetailed extends JiraIssueShort {
  comments: JiraComment[];
  attachments_info: JiraAttachment[];
  checklists: ChecklistItem[];
}

export interface CreateIssueRequest {
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
  parent?: { key: string };
  epic?: { key: string };
  needToUpdateSource: string;
  slService: string;
  productCatalog: string;
  labels?: string[];
  checklists?: ChecklistItem[];
}

export interface UpdateIssueRequest {
  summary?: string;
  description?: string;
  priority?: string;
  issuetype?: string;
  needToUpdateSource?: string;
  slService?: string;
  productCatalog?: string;
  labels?: string[];
  checklists?: ChecklistItem[];
}

export interface OptimizeContext {
  issue_type?: string;
  summary?: string;
  description?: string;
  comments?: JiraComment[];
  parent?: ParentIssueContext;
  epic?: EpicIssueContext;
}

export interface AiGenerateResponse {
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
  checklists?: ChecklistItem[];
}
