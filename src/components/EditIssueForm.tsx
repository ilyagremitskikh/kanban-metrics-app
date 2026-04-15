import { useState, useEffect, useRef } from 'react';
import { Loader2, Save, Paperclip } from 'lucide-react';
import { fetchJiraIssueDetail, updateJiraIssue } from '../lib/jiraApi';
import type { JiraIssueDetailed, ChecklistItem, TaskMutationPatch, UpdateIssueRequest } from '../types';
import { normalizePriority } from '../lib/priorities';
import AiSummaryInput from './AiSummaryInput';
import AiDescriptionDiff from './AiDescriptionDiff';
import ChildIssuesPanel from './ChildIssuesPanel';
import { FormSection, type IssueFormLayoutMode } from './IssueFormLayout';
import { PrioritySelect, LabelsInput, ChecklistEditor } from './IssueFormFields';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  n8nBaseUrl: string;
  availableTypes: string[];
  issueKey: string;
  onUpdated: (patch: TaskMutationPatch) => void;
  onChildCreated?: (patch: TaskMutationPatch) => void;
  onClose: () => void;
  layout?: IssueFormLayoutMode;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EditIssueForm({ n8nBaseUrl, availableTypes, issueKey, onUpdated, onChildCreated, onClose, layout = 'sheet' }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const initial = useRef<JiraIssueDetailed | null>(null);

  // Editable fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [labels, setLabels] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Read-only info
  const [comments, setComments] = useState<JiraIssueDetailed['comments']>([]);
  const [attachments, setAttachments] = useState<JiraIssueDetailed['attachments_info']>([]);
  const [children, setChildren] = useState<JiraIssueDetailed['children']>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchJiraIssueDetail(n8nBaseUrl, issueKey)
      .then(issue => {
        if (cancelled) return;
        initial.current = issue;
        setSummary(issue.summary ?? '');
        setDescription(issue.description ?? '');
        setPriority(normalizePriority(issue.priority ?? 'Medium'));
        setLabels(issue.labels ?? []);
        setChecklists(issue.checklists ?? []);
        setComments(issue.comments ?? []);
        setAttachments(issue.attachments_info ?? []);
        setChildren(issue.children ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Не удалось загрузить задачу.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [n8nBaseUrl, issueKey]);

  // Dirty tracking
  const getDirtyFields = (): UpdateIssueRequest => {
    const orig = initial.current;
    if (!orig) return {};
    const updates: UpdateIssueRequest = {};
    if (summary !== orig.summary) updates.summary = summary;
    if (description !== (orig.description ?? '')) updates.description = description;
    if (priority !== orig.priority) updates.priority = priority;
    if (JSON.stringify(labels) !== JSON.stringify(orig.labels ?? [])) updates.labels = labels;
    if (JSON.stringify(checklists) !== JSON.stringify(orig.checklists ?? [])) {
      updates.checklists = checklists;
    }
    return updates;
  };

  const isDirty = Object.keys(getDirtyFields()).length > 0;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updates = getDirtyFields();
    if (!Object.keys(updates).length) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await updateJiraIssue(n8nBaseUrl, issueKey, updates);
      const mutationPatch: TaskMutationPatch = {
        key: issueKey,
        updated: new Date().toISOString(),
        summary: updates.summary,
        description: updates.description,
        priority: updates.priority,
        labels: updates.labels,
      };
      // Update initial ref so dirty tracking resets
      if (initial.current) {
        initial.current = {
          ...initial.current,
          ...updates,
          labels: updates.labels ?? initial.current.labels,
          checklists: updates.checklists ?? initial.current.checklists,
        };
      }
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      onUpdated(mutationPatch);
    } catch {
      setSubmitError('Не удалось сохранить изменения.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin text-blue-600" />
        <span className="text-sm">Загружаем данные задачи...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-red-400">
        <p className="text-sm">{loadError}</p>
        <Button onClick={onClose} variant="secondary">
          Закрыть
        </Button>
      </div>
    );
  }

  const dirtyCount = Object.keys(getDirtyFields()).length;
  const fallbackIssueType = initial.current?.issuetype ?? availableTypes[0] ?? '';
  const epicKey = initial.current?.epic_key ?? null;
  const status = initial.current?.status ?? '';
  const assignee = initial.current?.assignee ?? '';

  const handleChildCreated = (patch: TaskMutationPatch) => {
    const nextChild = {
      key: patch.key,
      summary: patch.summary ?? '',
      description: patch.description,
      status: patch.status ?? 'Создана',
      priority: patch.priority ?? 'Нормальный',
      issuetype: patch.issuetype ?? '',
      parent_key: patch.parent_key,
      epic_key: patch.epic_key,
      labels: patch.labels ?? [],
      created: patch.created,
      updated: patch.updated,
    };

    setChildren((current) => [nextChild, ...(current ?? [])]);
    if (initial.current) {
      initial.current = {
        ...initial.current,
        children: [nextChild, ...(initial.current.children ?? [])],
      };
    }
    onChildCreated?.(patch);
  };

  return (
    <form onSubmit={handleSave} className={cn('flex flex-col', layout === 'page' ? 'min-h-[70vh]' : 'h-full')}>
      <div className={cn('flex-1 overflow-y-auto', layout === 'page' ? 'px-0 py-1' : 'px-6 py-5')}>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
          <div className="flex min-w-0 flex-col gap-8">
            <AiSummaryInput
              value={summary}
              onChange={setSummary}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
              variant="title"
            />

            <AiDescriptionDiff
              value={description}
              onChange={setDescription}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
            />

            <FormSection title="Чеклист">
              <ChecklistEditor
                value={checklists}
                onChange={setChecklists}
                n8nBaseUrl={n8nBaseUrl}
                context={{ issue_type: fallbackIssueType, summary, description }}
              />
            </FormSection>

            {comments.length > 0 && (
              <FormSection title={`Комментарии (${comments.length})`}>
                <div className="flex flex-col gap-3">
                  {comments.map((c, i) => (
                    <div key={i} className="rounded-md border border-border/70 bg-background px-4 py-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{c.author}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(c.created)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-foreground/80">{c.body}</p>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}

            {attachments.length > 0 && (
              <FormSection title={`Вложения (${attachments.length})`}>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground"
                    >
                      <Paperclip size={12} />
                      {a.filename}
                      <span className="text-muted-foreground/80">· {a.mimeType}</span>
                    </div>
                  ))}
                </div>
              </FormSection>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{issueKey}</Badge>
                <Badge variant="outline">{fallbackIssueType}</Badge>
                {isDirty && (
                  <Badge variant="warning">
                    {dirtyCount} изм.
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Статус</span>
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                  <span className="size-2 rounded-full bg-yellow-400" />
                  <span className="truncate">{status || 'Не указан'}</span>
                </span>
                {epicKey && (
                  <>
                    <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Эпик</span>
                    <span className="truncate font-medium text-foreground">{epicKey}</span>
                  </>
                )}
                {assignee && (
                  <>
                    <span className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Assignee</span>
                    <span className="truncate font-medium text-foreground">{assignee}</span>
                  </>
                )}
              </div>
            </div>

            <PrioritySelect value={priority} onChange={setPriority} />
            <LabelsInput value={labels} onChange={setLabels} />

            <ChildIssuesPanel
              n8nBaseUrl={n8nBaseUrl}
              availableTypes={availableTypes}
              mode="edit"
              parentIssue={{
                key: issueKey,
                issuetype: fallbackIssueType,
                summary,
                description,
                status: initial.current?.status ?? '',
                priority,
                labels,
                epic_key: epicKey,
                children: children ?? [],
              }}
              onCreated={handleChildCreated}
            />
          </aside>
        </div>
      </div>

      <div className={cn('flex-shrink-0 border-t border-border/70 bg-background/95 backdrop-blur', layout === 'page' ? 'sticky bottom-0 px-0 py-4' : 'px-6 py-4')}>
        {submitError && <Alert variant="destructive" className="mb-3"><AlertDescription>{submitError}</AlertDescription></Alert>}
        {submitSuccess && <Alert variant="success" className="mb-3"><AlertDescription>Изменения сохранены!</AlertDescription></Alert>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={submitting || !isDirty}
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Сохранение...</>
              : <><Save size={15} /> Сохранить изменения{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</>
            }
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="ghost"
          >
            {layout === 'page' ? 'Назад к списку' : 'Закрыть'}
          </Button>
        </div>
      </div>
    </form>
  );
}
