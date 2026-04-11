import { useState } from 'react';
import { Sparkles, Loader2, Send } from 'lucide-react';
import { aiGenerate, createJiraIssue } from '../lib/jiraApi';
import type { ChecklistItem } from '../types';
import AiSummaryInput from './AiSummaryInput';
import AiDescriptionDiff from './AiDescriptionDiff';
import { PrioritySelect, IssueTypeSelect, LabelsInput, ChecklistEditor, normalizePriority } from './IssueFormFields';

interface Props {
  webhookUrl: string;
  onCreated: (key: string) => void;
  onClose: () => void;
}

const ISSUE_TYPES = ['User Story', 'Задача', 'Ошибка', 'Техдолг'];

export default function CreateIssueForm({ webhookUrl, onCreated, onClose }: Props) {
  // AI generator state
  const [aiIssueType, setAiIssueType] = useState(ISSUE_TYPES[0]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form fields
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Нормальный');
  const [issuetype, setIssuetype] = useState(ISSUE_TYPES[0]);
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
      const result = await aiGenerate(webhookUrl, aiIssueType, aiPrompt);
      setSummary(result.summary ?? '');
      setDescription(result.description ?? '');
      setPriority(normalizePriority(result.priority ?? 'Medium'));
      setIssuetype(result.issuetype ?? aiIssueType);
      if (result.checklists?.length) setChecklists(result.checklists);
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
      const { key } = await createJiraIssue(webhookUrl, {
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
      onCreated(key);
      onClose();
    } catch {
      setSubmitError('Не удалось создать задачу. Проверьте подключение и заполненность полей.');
    } finally {
      setSubmitting(false);
    }
  };

  const formDisabled = aiLoading || submitting;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">

        {/* AI Generator block */}
        <div className="bg-donezo-light rounded-2xl p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-donezo-dark" />
            <span className="text-sm font-bold text-donezo-dark">ИИ-генератор задачи</span>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Тип задачи
              </label>
              <select
                value={aiIssueType}
                onChange={e => setAiIssueType(e.target.value)}
                disabled={formDisabled}
                className="w-full px-4 py-2.5 bg-white border border-white/60 rounded-xl text-sm
                  focus:border-donezo-primary focus:ring-2 focus:ring-donezo-primary/20 focus:outline-none
                  transition-all duration-200 cursor-pointer disabled:opacity-60"
              >
                {ISSUE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Контекст задачи
              </label>
              <textarea
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                disabled={formDisabled}
                placeholder="Опишите задачу в свободной форме. Например: «Нужна кнопка экспорта отчёта в PDF с выбором периода»"
                rows={3}
                className="w-full px-4 py-3 bg-white border border-white/60 rounded-xl text-sm
                  focus:border-donezo-primary focus:ring-2 focus:ring-donezo-primary/20 focus:outline-none
                  transition-all duration-200 resize-none disabled:opacity-60"
              />
            </div>

            {aiError && <p className="text-xs text-red-600">{aiError}</p>}

            <button
              type="button"
              onClick={handleAiGenerate}
              disabled={formDisabled || !aiPrompt.trim()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-donezo-dark text-white text-sm font-medium
                rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm
                disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none self-start"
            >
              {aiLoading
                ? <><Loader2 size={14} className="animate-spin" /> Нейросеть формирует задачу...</>
                : <><Sparkles size={14} /> Сгенерировать</>
              }
            </button>
          </div>
        </div>

        {/* Form fields */}
        <fieldset disabled={formDisabled} className="flex flex-col gap-5 disabled:opacity-60">

          <AiSummaryInput
            value={summary}
            onChange={setSummary}
            webhookUrl={webhookUrl}
            context={{ issue_type: issuetype, summary, description }}
          />

          <AiDescriptionDiff
            value={description}
            onChange={setDescription}
            webhookUrl={webhookUrl}
            context={{ issue_type: issuetype, summary, description }}
          />

          <div className="grid grid-cols-2 gap-4">
            <PrioritySelect value={priority} onChange={setPriority} />
            <IssueTypeSelect value={issuetype} onChange={setIssuetype} />
          </div>

          {/* Custom fields */}
          <div className="flex flex-col gap-4">
            {/* needToUpdateSource — чекбокс */}
            <div className="flex items-start gap-3 p-4 bg-gray-50 border border-gray-100 rounded-xl cursor-pointer"
              onClick={() => setNeedToUpdateSource(v => !v)}
            >
              <input
                type="checkbox"
                checked={needToUpdateSource}
                onChange={e => setNeedToUpdateSource(e.target.checked)}
                onClick={e => e.stopPropagation()}
                className="mt-0.5 w-4 h-4 rounded accent-donezo-primary flex-shrink-0 cursor-pointer"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">Нужно обновить информацию в источнике?</p>
                <p className="text-xs text-gray-400 mt-0.5">Отметьте, если после выполнения задачи необходимо обновить документацию или источник данных</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  SL Service
                </label>
                <input
                  type="text"
                  value={slService}
                  onChange={e => setSlService(e.target.value)}
                  className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
                    focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light
                    focus:outline-none transition-all duration-200"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                  Product Catalog
                </label>
                <input
                  type="text"
                  value={productCatalog}
                  onChange={e => setProductCatalog(e.target.value)}
                  className="px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
                    focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light
                    focus:outline-none transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <LabelsInput value={labels} onChange={setLabels} />

          <ChecklistEditor
            value={checklists}
            onChange={setChecklists}
            webhookUrl={webhookUrl}
            context={{ issue_type: issuetype, summary, description }}
          />
        </fieldset>
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 px-8 py-5 border-t border-gray-100 bg-white">
        {submitError && (
          <p className="text-xs text-red-500 mb-3">{submitError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !summary.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-donezo-dark text-white font-semibold text-sm
              rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200
              shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Создание...</>
              : <><Send size={15} /> Создать в Jira</>
            }
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-white text-gray-600 text-sm font-medium border border-gray-200
              rounded-full hover:bg-donezo-light hover:text-donezo-dark transition-all duration-200"
          >
            Отмена
          </button>
        </div>
      </div>
    </form>
  );
}
