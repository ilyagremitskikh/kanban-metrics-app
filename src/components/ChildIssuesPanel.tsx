import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Plus, Sparkles } from 'lucide-react';

import { aiGenerate, createJiraIssue } from '../lib/jiraApi';
import { isEpicType, getEpicChildTypeOptions, getSubtaskTypeOption } from '../lib/issueTypes';
import { JIRA_BASE_URL, type ChecklistItem, type JiraIssueShort, type TaskMutationPatch } from '../types';
import {
  buildChildAiContext,
  buildChildCreateLinks,
  buildChildOptimisticLinks,
  resolveChildAiDraft,
} from './childIssueDraft';
import { FormSection } from './IssueFormLayout';
import { ChecklistEditor, LabelsInput, PrioritySelect } from './IssueFormFields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ParentIssue = Pick<
  JiraIssueShort,
  'key' | 'issuetype' | 'summary' | 'description' | 'status' | 'priority' | 'labels' | 'epic_key' | 'children'
>;

interface Props {
  n8nBaseUrl: string;
  availableTypes: string[];
  mode: 'create' | 'edit';
  parentIssue?: ParentIssue | null;
  onCreated: (patch: TaskMutationPatch) => void;
}

function getRelationLabel(child: JiraIssueShort, parentKey: string): string {
  if (child.parent_key === parentKey) return 'Подзадача';
  if (child.epic_key === parentKey) return 'В эпике';
  return 'Связана';
}

function buildCreatedChildPatch(args: {
  key: string;
  summary: string;
  description: string;
  priority: string;
  issuetype: string;
  labels: string[];
  parentKey?: string;
  epicKey?: string;
}): TaskMutationPatch {
  const now = new Date().toISOString();
  return {
    key: args.key,
    summary: args.summary,
    description: args.description,
    status: 'Создана',
    priority: args.priority,
    issuetype: args.issuetype,
    parent_key: args.parentKey,
    epic_key: args.epicKey,
    labels: args.labels,
    created: now,
    updated: now,
  };
}

export default function ChildIssuesPanel({ n8nBaseUrl, availableTypes, mode, parentIssue, onCreated }: Props) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Нормальный');
  const [labels, setLabels] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [children, setChildren] = useState<JiraIssueShort[]>(parentIssue?.children ?? []);

  const parentType = parentIssue?.issuetype ?? '';
  const parentKey = parentIssue?.key;
  const parentIsEpic = isEpicType(parentType);
  const canCreate = mode === 'edit' && !!parentKey;
  const epicChildTypes = useMemo(() => getEpicChildTypeOptions(availableTypes), [availableTypes]);
  const subtaskType = useMemo(() => getSubtaskTypeOption(availableTypes), [availableTypes]);
  const resolvedSelectedType = parentIsEpic ? (selectedType || epicChildTypes[0] || '') : subtaskType;
  const actionLabel = parentIsEpic ? 'Добавить задачу в эпик' : 'Добавить подзадачу';
  const aiContext = useMemo(
    () => buildChildAiContext({ parentIssue, parentIsEpic }),
    [parentIssue, parentIsEpic],
  );

  useEffect(() => {
    setChildren(parentIssue?.children ?? []);
  }, [parentIssue?.children]);

  useEffect(() => {
    if (!parentIsEpic) {
      setSelectedType('');
      return;
    }

    if (!epicChildTypes.includes(selectedType)) {
      setSelectedType(epicChildTypes[0] ?? '');
    }
  }, [epicChildTypes, parentIsEpic, selectedType]);

  const resetForm = () => {
    setSummary('');
    setDescription('');
    setPriority('Нормальный');
    setLabels([]);
    setChecklists([]);
    setSubmitError(null);
    setAiPrompt('');
    setAiError(null);
  };

  const handleAiGenerate = async () => {
    if (!canCreate || !aiPrompt.trim()) return;

    const issueType = parentIsEpic ? resolvedSelectedType : subtaskType;
    if (!issueType) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiGenerate(n8nBaseUrl, issueType, aiPrompt, aiContext);
      const draft = resolveChildAiDraft({
        result,
        parentIsEpic,
        currentType: resolvedSelectedType,
        allowedEpicTypes: epicChildTypes,
        subtaskType,
      });

      setSummary(draft.summary);
      setDescription(draft.description);
      setPriority(draft.priority);
      if (parentIsEpic && draft.issuetype) setSelectedType(draft.issuetype);
      if (draft.checklists) setChecklists(draft.checklists);
    } catch {
      setAiError('ИИ не смог подготовить черновик. Проверьте подключение и попробуйте ещё раз.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!canCreate || !parentKey || !summary.trim()) return;

    const issuetype = parentIsEpic ? resolvedSelectedType : subtaskType;
    if (!issuetype) return;

    const links = buildChildCreateLinks({ parentKey, parentIsEpic });
    const optimisticLinks = buildChildOptimisticLinks({
      parentKey,
      parentIsEpic,
      parentEpicKey: parentIssue?.epic_key,
    });

    setSubmitting(true);
    setSubmitError(null);
    try {
      const { key } = await createJiraIssue(n8nBaseUrl, {
        summary: summary.trim(),
        description,
        priority,
        issuetype,
        needToUpdateSource: '',
        slService: '',
        productCatalog: '',
        parentKey: links.parentKey,
        epicKey: links.epicKey,
        parent: links.parent,
        epic: links.epic,
        labels: labels.length ? labels : undefined,
        checklists: checklists.length ? checklists : undefined,
      });

      const childPatch = buildCreatedChildPatch({
        key,
        summary: summary.trim(),
        description,
        priority,
        issuetype,
        labels,
        parentKey: optimisticLinks.parentKey,
        epicKey: optimisticLinks.epicKey,
      });

      setChildren((current) => [childPatch as JiraIssueShort, ...current]);
      resetForm();
      onCreated(childPatch);
    } catch {
      setSubmitError('Не удалось создать дочернюю задачу. Проверьте подключение и повторите.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSection title="Дочерние задачи">
      <div className="flex flex-col gap-4">
        {!canCreate && (
          <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
            Сначала сохраните задачу, потом можно будет добавить дочерние элементы
          </p>
        )}

        <fieldset disabled={!canCreate || submitting} className="flex flex-col gap-4 disabled:opacity-60">
          <div className="flex flex-col gap-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="flex flex-col gap-1">
                <Label className="mb-2 block">Тип для ИИ</Label>
                {parentIsEpic ? (
                  <select
                    value={resolvedSelectedType}
                    onChange={(event) => setSelectedType(event.target.value)}
                    disabled={!canCreate || aiLoading || epicChildTypes.length === 0}
                    className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm transition-all duration-200 cursor-pointer focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-60"
                  >
                    {epicChildTypes.length > 0 ? (
                      epicChildTypes.map((typeName) => (
                        <option key={typeName} value={typeName}>{typeName}</option>
                      ))
                    ) : (
                      <option value="">Нет доступных типов</option>
                    )}
                  </select>
                ) : (
                  <Input value={subtaskType} disabled className="border-blue-200 bg-white" />
                )}
              </div>

              <div className="flex flex-col gap-1">
                <Label className="mb-2 block">Контекст для черновика</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  disabled={!canCreate || aiLoading}
                  placeholder={parentIsEpic ? 'Что нужно добавить внутри эпика' : 'Что нужно сделать в рамках родительской задачи'}
                  rows={3}
                  className="min-h-[90px] resize-none border-white/60 bg-white disabled:opacity-60"
                />
              </div>
            </div>

            {aiError && <p className="text-xs text-red-600">{aiError}</p>}

            <Button
              type="button"
              onClick={handleAiGenerate}
              disabled={!canCreate || aiLoading || !aiPrompt.trim() || !resolvedSelectedType}
              className="self-start"
            >
              {aiLoading
                ? <><Loader2 size={14} className="animate-spin" /> Нейросеть формирует черновик...</>
                : <><Sparkles size={14} /> Сгенерировать</>
              }
            </Button>
          </div>

          {parentIsEpic && (
            <div className="flex flex-col gap-1">
              <Label className="mb-2 block">Тип дочерней задачи</Label>
              <select
                value={resolvedSelectedType}
                onChange={(event) => setSelectedType(event.target.value)}
                disabled={!canCreate || epicChildTypes.length === 0}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm transition-all duration-200 cursor-pointer focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-100 focus:outline-none disabled:opacity-60"
              >
                {epicChildTypes.length > 0 ? (
                  epicChildTypes.map((typeName) => (
                    <option key={typeName} value={typeName}>{typeName}</option>
                  ))
                ) : (
                  <option value="">Нет доступных типов</option>
                )}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex flex-col gap-1">
              <Label className="mb-2 block">Краткое описание</Label>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder={parentIsEpic ? 'Например: реализовать API для эпика' : 'Например: доработать дочернюю задачу'}
              />
            </div>
            <PrioritySelect value={priority} onChange={setPriority} disabled={!canCreate || submitting} />
          </div>

          <div className="flex flex-col gap-1">
            <Label className="mb-2 block">Описание</Label>
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="min-h-[88px] resize-none"
              placeholder="Что нужно сделать"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <LabelsInput value={labels} onChange={setLabels} />
            <ChecklistEditor
              value={checklists}
              onChange={setChecklists}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: parentIsEpic ? resolvedSelectedType : subtaskType, summary, description, ...aiContext }}
            />
          </div>

          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {parentIsEpic
                ? 'Новая задача попадёт в эпик без родителя-подзадачи'
                : 'Новая задача будет создана как подзадача текущей'}
            </div>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || submitting || !summary.trim() || (parentIsEpic && !resolvedSelectedType)}
            >
              {submitting
                ? <><Loader2 size={14} className="animate-spin" /> Создание...</>
                : <><Plus size={14} /> {actionLabel}</>
              }
            </Button>
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет дочерних элементов.</p>
          ) : (
            children.map((child) => (
              <div
                key={child.key}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background px-4 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`${JIRA_BASE_URL}/${child.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                    >
                      {child.key}
                      <ExternalLink size={12} />
                    </a>
                    <Badge variant="outline">{child.issuetype}</Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        getRelationLabel(child, parentKey ?? '') === 'Подзадача'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700',
                      )}
                    >
                      {getRelationLabel(child, parentKey ?? '')}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{child.summary}</p>
                </div>
                <div className="text-sm text-muted-foreground">{child.status || 'Создана'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </FormSection>
  );
}
