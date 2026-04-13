import { useState, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronsUp, ChevronUp, Minus, ChevronDown, ChevronsDown,
  Sparkles, Loader2, Check, MinusCircle, Equal,
} from 'lucide-react';
import type { ChecklistItem } from '../types';
import { aiChecklist } from '../lib/jiraApi';
import { normalizePriority } from '../lib/priorities';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

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
      <Label className="mb-2 block">Приоритет</Label>
      <div ref={ref} className="relative">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          variant="secondary"
          className={`h-10 w-full justify-start gap-2 rounded-xl border bg-background px-3 text-left text-sm shadow-none transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed
            ${open
              ? 'border-blue-600 ring-2 ring-blue-100 bg-white'
              : 'border-input hover:border-slate-300'
            }`}
        >
          <span className={`flex h-6 w-6 items-center justify-center rounded-full ${current.colorCls}`}>
            {current.icon}
          </span>
          <span className="flex-1 font-medium text-slate-800">{current.label}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        </Button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
            {PRIORITY_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                variant="ghost"
                className={cn(
                  'h-auto w-full justify-start rounded-none px-4 py-2.5 text-sm transition-colors duration-150 hover:bg-blue-50',
                  opt.value === normalizedValue ? 'bg-blue-50' : '',
                )}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${opt.colorCls}`}>
                  {opt.icon}
                </span>
                <span className={`font-medium ${opt.value === normalizedValue ? 'text-slate-900' : 'text-gray-700'}`}>
                  {opt.label}
                </span>
                {opt.value === normalizedValue && (
                  <Check size={13} className="ml-auto text-blue-600" />
                )}
              </Button>
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
      <Label className="mb-2 block">Тип задачи</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm
          focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100
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
      <Label className="mb-2 block">Метки (Labels)</Label>
      <div className="flex min-h-[46px] flex-wrap gap-1.5 rounded-xl border border-input bg-background p-3 transition-all duration-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
        {value.map(label => (
          <Badge key={label} variant="secondary" className="rounded-full px-2.5 py-1 text-xs font-medium text-slate-700">
            {label}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLabel(label)}
              className="size-4 hover:text-red-500"
            >
              <X size={11} />
            </Button>
          </Badge>
        ))}
        <Input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addLabel}
          placeholder={value.length === 0 ? 'Введите метку и нажмите Enter' : ''}
          className="min-w-[120px] flex-1 border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
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
  n8nBaseUrl?: string;
  context?: ChecklistContext;
}

export function ChecklistEditor({ value, onChange, n8nBaseUrl, context }: ChecklistEditorProps) {
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

  const canGenerateAi = !!(n8nBaseUrl && context?.summary?.trim());

  const handleAiGenerate = async () => {
    if (!n8nBaseUrl || !context) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const generated = await aiChecklist(n8nBaseUrl, {
        issue_type: context.issue_type,
        summary: context.summary,
        description: context.description,
      });
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
      <div className="flex items-center justify-between">
        <Label>Чеклист</Label>
        {canGenerateAi && (
          <Button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiLoading}
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-blue-600 hover:text-slate-900"
            title={context?.summary ? '' : 'Заполните заголовок задачи для генерации'}
          >
            {aiLoading
              ? <><Loader2 size={12} className="animate-spin" /> Генерирую...</>
              : <><Sparkles size={12} /> Сгенерировать с ИИ</>
            }
          </Button>
        )}
      </div>

      {aiError && <p className="text-xs text-red-500">{aiError}</p>}

      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-background p-2">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => updateItem(i, { checked: e.target.checked })}
                className="w-4 h-4 rounded accent-blue-600 flex-shrink-0"
              />
              <Input
                type="text"
                value={item.name}
                onChange={e => updateItem(i, { name: e.target.value })}
                placeholder="Пункт чеклиста"
                className="flex-1"
              />
              <label className="flex shrink-0 items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.mandatory}
                  onChange={e => updateItem(i, { mandatory: e.target.checked })}
                  className="w-3.5 h-3.5 rounded accent-blue-600"
                />
                Обяз.
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                className="size-8 shrink-0 text-gray-400 hover:text-red-500"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={addItem}
        variant="ghost"
        size="sm"
        className="self-start px-0 text-xs text-gray-500 hover:text-blue-600"
      >
        <Plus size={14} />
        Добавить пункт
      </Button>
    </div>
  );
}
