import { useState, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown,
  Sparkles, Loader2, Check, MinusCircle, Equal,
} from 'lucide-react';
import type { ChecklistItem } from '../types';
import { aiChecklist } from '../lib/jiraApi';
import { normalizePriority } from '../lib/priorities';

// ── PrioritySelect (custom dropdown with icons) ───────────────────────────────

interface PriorityOption {
  value: string;
  label: string;
  icon: React.ReactNode;
  colorCls: string;   // Tailwind classes for text + bg
  dotCls: string;     // dot color class
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: 'Неотложный',
    label: 'Неотложный',
    icon: <MinusCircle size={14} />,
    colorCls: 'text-red-600 bg-red-50',
    dotCls: 'bg-red-500',
  },
  {
    value: 'Срочный',
    label: 'Срочный',
    icon: <ChevronsUp size={14} />,
    colorCls: 'text-orange-600 bg-orange-50',
    dotCls: 'bg-orange-500',
  },
  {
    value: 'Высокий',
    label: 'Высокий',
    icon: <ChevronUp size={14} />,
    colorCls: 'text-orange-500 bg-orange-50',
    dotCls: 'bg-orange-400',
  },
  {
    value: 'Нормальный',
    label: 'Нормальный',
    icon: <ChevronDown size={14} />,
    colorCls: 'text-blue-500 bg-blue-50',
    dotCls: 'bg-blue-400',
  },
  {
    value: 'Средний',
    label: 'Средний',
    icon: <Equal size={14} />,
    colorCls: 'text-yellow-600 bg-yellow-50',
    dotCls: 'bg-yellow-400',
  },
  {
    value: 'Низкий',
    label: 'Низкий',
    icon: <ChevronsDown size={14} />,
    colorCls: 'text-blue-400 bg-blue-50',
    dotCls: 'bg-blue-300',
  },
  {
    value: 'Незначительный',
    label: 'Незначительный',
    icon: <Minus size={14} />,
    colorCls: 'text-gray-400 bg-gray-100',
    dotCls: 'bg-gray-300',
  },
];

interface PrioritySelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function PrioritySelect({ value, onChange, disabled }: PrioritySelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const normalizedValue = normalizePriority(value);
  const current = PRIORITY_OPTIONS.find(o => o.value === normalizedValue) ?? PRIORITY_OPTIONS[2];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Приоритет
      </label>
      <div ref={ref} className="relative">
        {/* Trigger */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border rounded-xl text-sm
            text-left transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
            ${open
              ? 'border-donezo-primary ring-2 ring-donezo-light bg-white'
              : 'border-gray-100 hover:border-gray-200'
            }`}
        >
          <span className={`flex items-center justify-center w-6 h-6 rounded-full ${current.colorCls}`}>
            {current.icon}
          </span>
          <span className="flex-1 font-medium text-gray-800">{current.label}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-donezo overflow-hidden">
            {PRIORITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left
                  hover:bg-donezo-light transition-colors duration-150
                  ${opt.value === normalizedValue ? 'bg-donezo-light/60' : ''}`}
              >
                <span className={`flex items-center justify-center w-6 h-6 rounded-full ${opt.colorCls}`}>
                  {opt.icon}
                </span>
                <span className={`font-medium ${opt.value === normalizedValue ? 'text-donezo-dark' : 'text-gray-700'}`}>
                  {opt.label}
                </span>
                {opt.value === normalizedValue && (
                  <Check size={13} className="ml-auto text-donezo-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── IssueTypeSelect ───────────────────────────────────────────────────────────

interface IssueTypeSelectProps {
  value: string;
  availableTypes: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function IssueTypeSelect({ value, availableTypes, onChange, disabled }: IssueTypeSelectProps) {
  const options = availableTypes.length ? availableTypes : [value];
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Тип задачи
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
          focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light
          focus:outline-none transition-all duration-200 cursor-pointer disabled:opacity-60"
      >
        {options.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}

// ── LabelsInput ───────────────────────────────────────────────────────────────

interface LabelsInputProps {
  value: string[];
  onChange: (v: string[]) => void;
}

export function LabelsInput({ value, onChange }: LabelsInputProps) {
  const [input, setInput] = useState('');

  const addLabel = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  const removeLabel = (label: string) => {
    onChange(value.filter(l => l !== label));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addLabel();
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
        Метки (Labels)
      </label>
      <div className="flex flex-wrap gap-1.5 p-3 bg-gray-50 border border-gray-100 rounded-xl min-h-[46px] transition-all duration-200 focus-within:bg-white focus-within:border-donezo-primary focus-within:ring-2 focus-within:ring-donezo-light">
        {value.map(label => (
          <span
            key={label}
            className="flex items-center gap-1 px-2.5 py-1 bg-donezo-light text-donezo-dark text-xs font-medium rounded-full"
          >
            {label}
            <button
              type="button"
              onClick={() => removeLabel(label)}
              className="hover:text-red-500 transition-colors"
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addLabel}
          placeholder={value.length === 0 ? 'Введите метку и нажмите Enter' : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}

// ── ChecklistEditor (с AI-генерацией) ────────────────────────────────────────

export interface ChecklistContext {
  issue_type: string;
  summary: string;
  description: string;
}

interface ChecklistEditorProps {
  value: ChecklistItem[];
  onChange: (v: ChecklistItem[]) => void;
  webhookUrl?: string;
  n8nBaseUrl?: string;
  context?: ChecklistContext;
}

export function ChecklistEditor({ value, onChange, webhookUrl, n8nBaseUrl, context }: ChecklistEditorProps) {
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const addItem = () => {
    const newItem: ChecklistItem = {
      name: '',
      checked: false,
      mandatory: false,
      rank: value.length,
      isHeader: false,
    };
    onChange([...value, newItem]);
  };

  const updateItem = (index: number, patch: Partial<ChecklistItem>) => {
    onChange(value.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const canGenerateAi = !!(webhookUrl && context?.summary?.trim());

  const handleAiGenerate = async () => {
    if (!webhookUrl || !context) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const generated = await aiChecklist(webhookUrl, {
        issue_type: context.issue_type,
        summary: context.summary,
        description: context.description,
      }, n8nBaseUrl);
      // Merge: append generated items after existing ones, re-ranking
      const merged = [
        ...value,
        ...generated.map((item, i) => ({ ...item, rank: value.length + i })),
      ];
      onChange(merged);
    } catch {
      setAiError('Не удалось сгенерировать чеклист. Проверьте подключение.');
      setTimeout(() => setAiError(null), 4000);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          Чеклист
        </label>
        {canGenerateAi && (
          <button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-donezo-primary hover:text-donezo-dark
              transition-colors duration-200 disabled:opacity-50"
            title={context?.summary ? '' : 'Заполните заголовок задачи для генерации'}
          >
            {aiLoading
              ? <><Loader2 size={12} className="animate-spin" /> Генерирую...</>
              : <><Sparkles size={12} /> Сгенерировать с ИИ</>
            }
          </button>
        )}
      </div>

      {aiError && <p className="text-xs text-red-500">{aiError}</p>}

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => updateItem(i, { checked: e.target.checked })}
                className="w-4 h-4 rounded accent-donezo-primary flex-shrink-0"
              />
              <input
                type="text"
                value={item.name}
                onChange={e => updateItem(i, { name: e.target.value })}
                placeholder="Пункт чеклиста"
                className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm
                  focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light
                  focus:outline-none transition-all duration-200"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 flex-shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.mandatory}
                  onChange={e => updateItem(i, { mandatory: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-donezo-primary"
                />
                Обяз.
              </label>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-gray-400 hover:text-red-500 transition-colors duration-200 flex-shrink-0"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-donezo-primary
          transition-colors duration-200 self-start"
      >
        <Plus size={14} />
        Добавить пункт
      </button>
    </div>
  );
}
