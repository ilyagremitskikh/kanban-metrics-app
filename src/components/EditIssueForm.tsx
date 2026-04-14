import { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, Save, Paperclip, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { fetchJiraIssueDetail, updateJiraIssue } from '../lib/jiraApi';
import type { EpicIssueContext, JiraIssueDetailed, ChecklistItem, ParentIssueContext, UpdateIssueRequest } from '../types';
import { normalizePriority } from '../lib/priorities';
import AiSummaryInput from './AiSummaryInput';
import AiDescriptionDiff from './AiDescriptionDiff';
import CreateIssueForm from './CreateIssueForm';
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
  onUpdated: (options?: { close?: boolean }) => void;
  onClose: () => void;
  layout?: IssueFormLayoutMode;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function isEpicType(issueType: string): boolean {
  const normalized = issueType.trim().toLowerCase();
  return normalized === 'epic' || normalized === 'эпик';
}

export default function EditIssueForm({ n8nBaseUrl, availableTypes, issueKey, onUpdated, onClose, layout = 'sheet' }: Props) {
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
  const [subtaskOpen, setSubtaskOpen] = useState(false);
  const [subtaskCreatedKey, setSubtaskCreatedKey] = useState<string | null>(null);

  // Read-only info
  const [comments, setComments] = useState<JiraIssueDetailed['comments']>([]);
  const [attachments, setAttachments] = useState<JiraIssueDetailed['attachments_info']>([]);

  const loadIssue = useCallback(async (currentIssueKey: string) => {
    return fetchJiraIssueDetail(n8nBaseUrl, currentIssueKey);
  }, [n8nBaseUrl]);

  const applyIssue = (issue: JiraIssueDetailed) => {
    initial.current = issue;
    setSummary(issue.summary ?? '');
    setDescription(issue.description ?? '');
    setPriority(normalizePriority(issue.priority ?? 'Medium'));
    setLabels(issue.labels ?? []);
    setChecklists(issue.checklists ?? []);
    setComments(issue.comments ?? []);
    setAttachments(issue.attachments_info ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadIssue(issueKey)
      .then((issue) => {
        if (cancelled) return;
        applyIssue(issue);
      })
      .catch(() => {
        if (!cancelled) setLoadError('Не удалось загрузить задачу.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [issueKey, loadIssue]);

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
      onUpdated();
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
  const currentIssue = initial.current;
  const fallbackIssueType = currentIssue?.issuetype ?? availableTypes[0] ?? '';
  const isEpic = isEpicType(fallbackIssueType);
  const parentIssue = currentIssue?.parent;
  const currentEpic = isEpic ? null : currentIssue?.epic;
  const parentIssueContext: ParentIssueContext | undefined = currentIssue
    ? {
        key: currentIssue.key,
        summary: currentIssue.summary ?? '',
        description: currentIssue.description ?? '',
        issuetype: currentIssue.issuetype ?? '',
        status: currentIssue.status ?? '',
        priority: currentIssue.priority ?? '',
        labels: currentIssue.labels ?? [],
      }
    : undefined;
  const epicIssueContext: EpicIssueContext | undefined = currentIssue
    ? {
        key: currentIssue.key,
        summary: currentIssue.summary ?? '',
        description: currentIssue.description ?? '',
        issuetype: currentIssue.issuetype ?? '',
        status: currentIssue.status ?? '',
        priority: currentIssue.priority ?? '',
        labels: currentIssue.labels ?? [],
      }
    : undefined;
  const childIssueTypes = availableTypes.filter((type) => {
    const normalized = type.trim().toLowerCase();
    return normalized !== 'epic' && normalized !== 'эпик' && normalized !== 'подзадача' && normalized !== 'business sub-task';
  });
  const epicChildIssueTypes = childIssueTypes.length ? childIssueTypes : ['User Story', 'Задача', 'Ошибка', 'Техдолг'];

  const handleSubtaskCreated = async (createdKey: string) => {
    setSubtaskCreatedKey(createdKey);
    setSubtaskOpen(false);
    setLoading(true);
    setLoadError(null);
    try {
      const issue = await loadIssue(issueKey);
      applyIssue(issue);
      onUpdated({ close: false });
    } catch {
      setLoadError('Подзадача создана, но не удалось обновить данные родителя.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col', layout === 'page' ? 'min-h-[70vh]' : 'h-full')}>
      <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto', layout === 'page' ? 'px-0 py-1' : 'px-6 py-5')}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{issueKey}</Badge>
          <Badge variant="outline">{fallbackIssueType}</Badge>
          {isDirty && (
            <Badge variant="warning">
              {dirtyCount} изм.
            </Badge>
          )}
        </div>

        {parentIssue ? (
          <Alert variant="info">
            <AlertDescription>
              Родительская задача: <strong>{parentIssue.key}</strong>
              {parentIssue.summary ? ` · ${parentIssue.summary}` : ''}
            </AlertDescription>
          </Alert>
        ) : null}

        {currentEpic ? (
          <Alert variant="info">
            <AlertDescription>
              Эпик: <strong>{currentEpic.key}</strong>
              {currentEpic.summary ? ` · ${currentEpic.summary}` : ''}
            </AlertDescription>
          </Alert>
        ) : null}

        {subtaskCreatedKey ? (
          <Alert variant="success">
            <AlertDescription>
              {isEpic ? 'Тикет' : 'Подзадача'} <strong>{subtaskCreatedKey}</strong> {isEpic ? 'создан в эпике' : 'создана и привязана к'} {issueKey}.
            </AlertDescription>
          </Alert>
        ) : null}

        <form id="edit-issue-form" onSubmit={handleSave} className="contents">
        <FormSection title="Основные поля">
          <div className="space-y-4">
            <AiSummaryInput
              value={summary}
              onChange={setSummary}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
            />

            <AiDescriptionDiff
              value={description}
              onChange={setDescription}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PrioritySelect value={priority} onChange={setPriority} />
              <LabelsInput value={labels} onChange={setLabels} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Чеклист">
          <ChecklistEditor
            value={checklists}
            onChange={setChecklists}
            n8nBaseUrl={n8nBaseUrl}
            context={{
              issue_type: fallbackIssueType,
              summary,
              description,
            }}
          />
        </FormSection>

        {comments.length > 0 && (
          <FormSection title={`Комментарии (${comments.length})`}>
            <div className="flex flex-col gap-3">
              {comments.map((c, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/25 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-900">{c.author}</span>
                    <span className="text-xs text-gray-400">{formatDate(c.created)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
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
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/25 px-3 py-2 text-xs text-gray-600"
                >
                  <Paperclip size={12} className="text-gray-400" />
                  {a.filename}
                  <span className="text-gray-400">· {a.mimeType}</span>
                </div>
              ))}
            </div>
          </FormSection>
        )}
        </form>

        <FormSection
          title={isEpic ? 'Тикеты в эпике' : 'Подзадачи'}
          description={isEpic ? 'Быстро создать задачу, баг или техдолг внутри этого эпика.' : 'Быстро создать подзадачу, не выходя из редактирования родительской задачи.'}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {isEpic ? `Новый тикет автоматически попадёт в эпик ${issueKey}.` : `Новая подзадача автоматически создастся под ${issueKey}.`}
              </div>
              <Button
                type="button"
                variant={subtaskOpen ? 'secondary' : 'outline'}
                onClick={() => setSubtaskOpen((prev) => !prev)}
              >
                {subtaskOpen ? <ChevronDown size={15} /> : <Plus size={15} />}
                {subtaskOpen ? 'Скрыть форму' : isEpic ? 'Создать тикет в эпике' : 'Создать подзадачу'}
              </Button>
            </div>

            {subtaskOpen ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                {isEpic ? (
                  <CreateIssueForm
                    n8nBaseUrl={n8nBaseUrl}
                    availableTypes={epicChildIssueTypes}
                    epicIssueKey={issueKey}
                    epicIssueSummary={currentIssue?.summary}
                    epicIssueContext={epicIssueContext}
                    onCreated={handleSubtaskCreated}
                    onClose={() => setSubtaskOpen(false)}
                    layout="page"
                  />
                ) : (
                  <CreateIssueForm
                    n8nBaseUrl={n8nBaseUrl}
                    availableTypes={availableTypes}
                    fixedIssueType="Подзадача"
                    parentIssueKey={issueKey}
                    parentIssueSummary={currentIssue?.summary}
                    parentIssueContext={parentIssueContext}
                    onCreated={handleSubtaskCreated}
                    onClose={() => setSubtaskOpen(false)}
                    layout="page"
                  />
                )}
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 self-start text-sm font-medium text-blue-700 transition-colors hover:text-slate-900"
                onClick={() => setSubtaskOpen(true)}
              >
                <ChevronRight size={15} />
                {isEpic ? 'Открыть полную форму тикета' : 'Открыть полную форму подзадачи'}
              </button>
            )}
          </div>
        </FormSection>
      </div>

      <div className={cn('flex-shrink-0 border-t border-border bg-background', layout === 'page' ? 'sticky bottom-0 px-0 py-4' : 'px-6 py-4')}>
        {submitError && <Alert variant="destructive" className="mb-3"><AlertDescription>{submitError}</AlertDescription></Alert>}
        {submitSuccess && <Alert variant="success" className="mb-3"><AlertDescription>Изменения сохранены!</AlertDescription></Alert>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            form="edit-issue-form"
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
            variant="secondary"
          >
            {layout === 'page' ? 'Назад к списку' : 'Закрыть'}
          </Button>
        </div>
      </div>
    </div>
  );
}
