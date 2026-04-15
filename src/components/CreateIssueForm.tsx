import { useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { aiGenerate, createJiraIssue } from '../lib/jiraApi';
import type { ChecklistItem, TaskMutationPatch } from '../types';
import { normalizePriority } from '../lib/priorities';
import AiSummaryInput from './AiSummaryInput';
import AiDescriptionDiff from './AiDescriptionDiff';
import ChildIssuesPanel from './ChildIssuesPanel';
import { FormSection, type IssueFormLayoutMode } from './IssueFormLayout';
import { PrioritySelect, IssueTypeSelect, LabelsInput, ChecklistEditor } from './IssueFormFields';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

interface Props {
  n8nBaseUrl: string;
  availableTypes: string[];
  onCreated: (patch: TaskMutationPatch) => void;
  onClose: () => void;
  layout?: IssueFormLayoutMode;
  defaultIssueType?: string;
}

export default function CreateIssueForm({ n8nBaseUrl, availableTypes, onCreated, onClose, layout = 'sheet', defaultIssueType }: Props) {
  const issueTypes = availableTypes.length ? availableTypes : ['User Story'];
  // AI generator state
  const [aiIssueType, setAiIssueType] = useState(defaultIssueType ?? issueTypes[0]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Нормальный');
  const [issuetype, setIssuetype] = useState(defaultIssueType ?? issueTypes[0]);
  const [needToUpdateSource, setNeedToUpdateSource] = useState(false);
  const [slService, setSlService] = useState('TB\\expresscredit');
  const [productCatalog, setProductCatalog] = useState('Экспресс-кредит');
  const [labels, setLabels] = useState<string[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiGenerate(n8nBaseUrl, aiIssueType, aiPrompt);
      setSummary(result.summary ?? '');
      setDescription(result.description ?? '');
      setPriority(normalizePriority(result.priority ?? 'Medium'));
      setIssuetype(result.issuetype ?? aiIssueType);
    } catch {
      setAiError('Ошибка ИИ-генерации. Проверьте подключение и повторите.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const now = new Date().toISOString();
      const { key } = await createJiraIssue(n8nBaseUrl, {
        summary,
        description,
        priority,
        issuetype,
        needToUpdateSource: needToUpdateSource ? 'Да' : '',
        slService,
        productCatalog,
        labels: labels.length ? labels : undefined,
        checklists: checklists.length ? checklists : undefined,
      });
      onCreated({
        key,
        summary,
        description,
        priority,
        issuetype,
        labels,
        created: now,
        updated: now,
      });
      onClose();
    } catch {
      setSubmitError('Не удалось создать задачу. Проверьте подключение и заполненность полей.');
    } finally {
      setSubmitting(false);
    }
  };

  const formDisabled = aiLoading || submitting;

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col', layout === 'page' ? 'min-h-[70vh]' : 'h-full')}>
      <div className={cn('flex flex-1 flex-col gap-4 overflow-y-auto', layout === 'page' ? 'px-0 py-1' : 'px-6 py-5')}>
        <FormSection
          title="ИИ-черновик"
          className="border-blue-200 bg-blue-50/50"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label className="mb-2 block">Тип задачи</Label>
              <select
                value={aiIssueType}
                onChange={e => setAiIssueType(e.target.value)}
                disabled={formDisabled}
                className="h-10 w-full rounded-xl border border-blue-200 bg-white px-3 text-sm
                  focus:border-blue-600 focus:ring-2 focus:ring-blue-100 focus:outline-none
                  transition-all duration-200 cursor-pointer disabled:opacity-60"
              >
                {issueTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="mb-2 block">Контекст задачи</Label>
              <Textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                disabled={formDisabled}
                placeholder="Опишите задачу в свободной форме. Например: «Нужна кнопка экспорта отчёта в PDF с выбором периода»"
                rows={3}
                className="min-h-[90px] resize-none border-white/60 bg-white disabled:opacity-60"
              />
            </div>

            {aiError && <p className="text-xs text-red-600">{aiError}</p>}

            <Button
              type="button"
              onClick={handleAiGenerate}
              disabled={formDisabled || !aiPrompt.trim()}
              className="self-start"
            >
              {aiLoading
                ? <><Loader2 size={14} className="animate-spin" /> Нейросеть формирует задачу...</>
                : <><Sparkles size={14} /> Сгенерировать</>
              }
            </Button>
          </div>
        </FormSection>

        <fieldset disabled={formDisabled} className="flex flex-col gap-4 disabled:opacity-60">
          <AiSummaryInput
            value={summary}
            onChange={setSummary}
            n8nBaseUrl={n8nBaseUrl}
            context={{ issue_type: issuetype, summary, description }}
          />

          <AiDescriptionDiff
            value={description}
            onChange={setDescription}
            n8nBaseUrl={n8nBaseUrl}
            context={{ issue_type: issuetype, summary, description }}
          />

          <FormSection title="Основные поля">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <PrioritySelect value={priority} onChange={setPriority} />
              <IssueTypeSelect value={issuetype} availableTypes={issueTypes} onChange={setIssuetype} />
            </div>
          </FormSection>

          <FormSection title="Служебные атрибуты">
            <div
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/20 p-4"
              onClick={() => setNeedToUpdateSource(v => !v)}
            >
              <input
                type="checkbox"
                checked={needToUpdateSource}
                onChange={e => setNeedToUpdateSource(e.target.checked)}
                onClick={e => e.stopPropagation()}
                className="mt-0.5 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Нужно обновить информацию в источнике?</p>
                <p className="text-xs text-gray-400 mt-0.5">Отметьте, если после выполнения задачи необходимо обновить документацию или источник данных</p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="mb-2 block">SL Service</Label>
                <Input
                  type="text"
                  value={slService}
                  onChange={e => setSlService(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="mb-2 block">Product Catalog</Label>
                <Input
                  type="text"
                  value={productCatalog}
                  onChange={e => setProductCatalog(e.target.value)}
                />
              </div>
            </div>
          </FormSection>

          <FormSection title="Метки">
            <LabelsInput value={labels} onChange={setLabels} />
          </FormSection>

          <FormSection title="Чеклист">
            <ChecklistEditor value={checklists} onChange={setChecklists} />
          </FormSection>

          <ChildIssuesPanel
            n8nBaseUrl={n8nBaseUrl}
            availableTypes={issueTypes}
            mode="create"
            onCreated={() => undefined}
          />
        </fieldset>
      </div>

      <div className={cn('flex-shrink-0 border-t border-border bg-background', layout === 'page' ? 'sticky bottom-0 px-0 py-4' : 'px-6 py-4')}>
        {submitError && <Alert variant="destructive" className="mb-3"><AlertDescription>{submitError}</AlertDescription></Alert>}
        <div className="flex items-center gap-3">
          <Button
            type="submit"
            disabled={submitting || !summary.trim()}
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Создание...</>
              : <><Send size={15} /> Создать в Jira</>
            }
          </Button>
          <Button
            type="button"
            onClick={onClose}
            variant="secondary"
          >
            {layout === 'page' ? 'Назад к списку' : 'Отмена'}
          </Button>
        </div>
      </div>
    </form>
  );
}
