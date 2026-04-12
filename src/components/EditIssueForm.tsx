import { useState, useEffect, useRef } from 'react';
import { Loader2, Save, Paperclip, MessageSquare } from 'lucide-react';
import { fetchJiraIssueDetail, updateJiraIssue } from '../lib/jiraApi';
import type { JiraIssueDetailed, ChecklistItem, UpdateIssueRequest } from '../types';
import AiSummaryInput from './AiSummaryInput';
import AiDescriptionDiff from './AiDescriptionDiff';
import { PrioritySelect, LabelsInput, ChecklistEditor, normalizePriority } from './IssueFormFields';

interface Props {
  webhookUrl: string;
  n8nBaseUrl?: string;
  availableTypes: string[];
  issueKey: string;
  onUpdated: () => void;
  onClose: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function EditIssueForm({ webhookUrl, n8nBaseUrl, availableTypes, issueKey, onUpdated, onClose }: Props) {
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchJiraIssueDetail(webhookUrl, issueKey, n8nBaseUrl)
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
      })
      .catch(() => {
        if (!cancelled) setLoadError('Не удалось загрузить задачу.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [webhookUrl, issueKey, n8nBaseUrl]);

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
      await updateJiraIssue(webhookUrl, issueKey, updates, n8nBaseUrl);
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
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-gray-400">
        <Loader2 size={28} className="animate-spin text-donezo-primary" />
        <span className="text-sm">Загружаем данные задачи...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-red-400">
        <p className="text-sm">{loadError}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200 transition-colors"
        >
          Закрыть
        </button>
      </div>
    );
  }

  const dirtyCount = Object.keys(getDirtyFields()).length;
  const fallbackIssueType = initial.current?.issuetype ?? availableTypes[0] ?? '';

  return (
    <form onSubmit={handleSave} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-8 py-6 flex flex-col gap-6">

        {/* Issue key badge */}
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-donezo-light text-donezo-dark text-xs font-bold rounded-full">
            {issueKey}
          </span>
          {isDirty && (
            <span className="px-2.5 py-1 bg-amber-50 text-amber-600 text-xs font-medium rounded-full border border-amber-200">
              {dirtyCount} изм.
            </span>
          )}
        </div>

        {/* Editable fields */}
        <AiSummaryInput
          value={summary}
          onChange={setSummary}
          webhookUrl={webhookUrl}
          n8nBaseUrl={n8nBaseUrl}
          context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
        />

        <AiDescriptionDiff
          value={description}
          onChange={setDescription}
          webhookUrl={webhookUrl}
          n8nBaseUrl={n8nBaseUrl}
          context={{ issue_type: fallbackIssueType, summary, description, comments: comments.length ? comments : undefined }}
        />

        <PrioritySelect value={priority} onChange={setPriority} />
        <LabelsInput value={labels} onChange={setLabels} />
        <ChecklistEditor
          value={checklists}
          onChange={setChecklists}
          webhookUrl={webhookUrl}
          n8nBaseUrl={n8nBaseUrl}
          context={{
            issue_type: fallbackIssueType,
            summary,
            description,
          }}
        />

        {/* Comments */}
        {comments.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              <MessageSquare size={13} />
              Комментарии ({comments.length})
            </div>
            <div className="flex flex-col gap-3">
              {comments.map((c, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-donezo-dark">{c.author}</span>
                    <span className="text-xs text-gray-400">{formatDate(c.created)}</span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
              <Paperclip size={13} />
              Вложения ({attachments.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((a, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-600"
                >
                  <Paperclip size={12} className="text-gray-400" />
                  {a.filename}
                  <span className="text-gray-400">· {a.mimeType}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="flex-shrink-0 px-8 py-5 border-t border-gray-100 bg-white">
        {submitError && <p className="text-xs text-red-500 mb-3">{submitError}</p>}
        {submitSuccess && <p className="text-xs text-emerald-600 mb-3">Изменения сохранены!</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !isDirty}
            className="flex items-center gap-2 px-6 py-3 bg-donezo-dark text-white font-semibold text-sm
              rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200
              shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {submitting
              ? <><Loader2 size={15} className="animate-spin" /> Сохранение...</>
              : <><Save size={15} /> Сохранить изменения{dirtyCount > 0 ? ` (${dirtyCount})` : ''}</>
            }
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-white text-gray-600 text-sm font-medium border border-gray-200
              rounded-full hover:bg-donezo-light hover:text-donezo-dark transition-all duration-200"
          >
            Закрыть
          </button>
        </div>
      </div>
    </form>
  );
}
