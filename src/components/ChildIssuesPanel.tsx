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
  const [draftOpen, setDraftOpen] = useState(false);

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
      setDraftOpen(false);
      onCreated(childPatch);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Не удалось создать дочернюю задачу. Проверьте подключение и повторите.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSection title="Дочерние задачи">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет дочерних элементов.</p>
          ) : (
            children.map((child) => (
              <div
                key={child.key}
                className="rounded-md border border-border/70 bg-background px-3 py-2.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={`${JIRA_BASE_URL}/${child.key}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-slate-600"
                    >
                      {child.key}
                      <ExternalLink size={12} />
                    </a>
                    <Badge variant="outline" className="font-medium">{child.issuetype}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        getRelationLabel(child, parentKey ?? '') === 'Подзадача'
                          ? 'border-sky-200 text-sky-700'
                          : 'border-amber-200 text-amber-700',
                      )}
                    >
                      {getRelationLabel(child, parentKey ?? '')}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium text-foreground">{child.summary}</p>
                  <div className="text-xs text-muted-foreground">{child.status || 'Создана'}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {!canCreate && (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            Сначала сохраните задачу, потом можно будет добавить дочерние элементы
          </p>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDraftOpen((open) => !open)}
          disabled={!canCreate}
          className="justify-start px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Plus size={14} />
          {draftOpen ? 'Скрыть черновик' : `+ ${actionLabel}`}
        </Button>

        {draftOpen && (
          <fieldset disabled={!canCreate || submitting} className="flex flex-col gap-4 disabled:opacity-60">
            <div className="flex flex-col gap-3 rounded-md border border-violet-100 bg-violet-50/30 p-3">
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Тип для ИИ</Label>
                {parentIsEpic ? (
                  <select
                    value={resolvedSelectedType}
                    onChange={(event) => setSelectedType(event.target.value)}
                    disabled={!canCreate || aiLoading || epicChildTypes.length === 0}
                    className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-foreground transition-colors hover:bg-background/80 focus:border-border focus:bg-background focus:ring-1 focus:ring-border focus:outline-none disabled:opacity-60"
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
                  <Input value={subtaskType} disabled className="border-transparent bg-transparent shadow-none" />
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Контекст для черновика</Label>
                <Textarea
                  value={aiPrompt}
                  onChange={(event) => setAiPrompt(event.target.value)}
                  disabled={!canCreate || aiLoading}
                  placeholder={parentIsEpic ? 'Что нужно добавить внутри эпика' : 'Что нужно сделать в рамках родительской задачи'}
                  rows={3}
                  className="min-h-[88px] resize-none border-transparent bg-transparent shadow-none hover:bg-background/70 focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border disabled:opacity-60"
                />
              </div>

              {aiError && <p className="text-xs text-red-600">{aiError}</p>}

              <Button
                type="button"
                onClick={handleAiGenerate}
                disabled={!canCreate || aiLoading || !aiPrompt.trim() || !resolvedSelectedType}
                variant="ghost"
                size="sm"
                className="self-start px-0 text-violet-500 hover:bg-transparent hover:text-violet-700"
              >
                {aiLoading
                  ? <><Loader2 size={14} className="animate-spin" /> Нейросеть формирует черновик...</>
                  : <><Sparkles size={14} /> Сгенерировать</>
                }
              </Button>
            </div>

            {parentIsEpic && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Тип дочерней задачи</Label>
                <select
                  value={resolvedSelectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                  disabled={!canCreate || epicChildTypes.length === 0}
                  className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus:border-border focus:bg-background focus:ring-1 focus:ring-border focus:outline-none disabled:opacity-60"
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

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Краткое описание</Label>
              <Input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                placeholder={parentIsEpic ? 'Например: реализовать API для эпика' : 'Например: доработать дочернюю задачу'}
                className="border-transparent bg-transparent shadow-none hover:bg-muted/60 focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border"
              />
            </div>

            <PrioritySelect value={priority} onChange={setPriority} disabled={!canCreate || submitting} />

            <div className="flex flex-col gap-2">
              <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Описание</Label>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="min-h-[88px] resize-none border-transparent bg-transparent shadow-none hover:bg-muted/60 focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border"
                placeholder="Что нужно сделать"
              />
            </div>

            <LabelsInput value={labels} onChange={setLabels} />
            <ChecklistEditor
              value={checklists}
              onChange={setChecklists}
              n8nBaseUrl={n8nBaseUrl}
              context={{ issue_type: parentIsEpic ? resolvedSelectedType : subtaskType, summary, description, ...aiContext }}
            />

            {submitError && (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-3">
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
        )}
      </div>
    </FormSection>
  );
}
