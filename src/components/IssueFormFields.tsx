import { useState, useRef, useEffect } from 'react';
import {
  X, Plus, Trash2, ChevronDown, Check, Loader2, Sparkles,
} from 'lucide-react';
import type { AiIssueContext, ChecklistItem } from '../types';
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
  textCls: string;
  dotCls: string;
}

const PRIORITY_OPTIONS: PriorityOption[] = [
  {
    value: 'Неотложный',
    label: 'Неотложный',
    textCls: 'text-red-600',
    dotCls: 'bg-red-500',
  },
  {
    value: 'Срочный',
    label: 'Срочный',
    textCls: 'text-orange-600',
    dotCls: 'bg-orange-500',
  },
  {
    value: 'Высокий',
    label: 'Высокий',
    textCls: 'text-orange-500',
    dotCls: 'bg-orange-400',
  },
  {
    value: 'Нормальный',
    label: 'Нормальный',
    textCls: 'text-sky-600',
    dotCls: 'bg-blue-400',
  },
  {
    value: 'Средний',
    label: 'Средний',
    textCls: 'text-yellow-700',
    dotCls: 'bg-yellow-400',
  },
  {
    value: 'Низкий',
    label: 'Низкий',
    textCls: 'text-slate-500',
    dotCls: 'bg-blue-300',
  },
  {
    value: 'Незначительный',
    label: 'Незначительный',
    textCls: 'text-muted-foreground',
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
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Приоритет</Label>
      <div ref={ref} className="relative">
        <Button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          variant="ghost"
          className={cn(
            'h-9 w-full justify-start gap-2 px-2 text-left text-sm shadow-none disabled:cursor-not-allowed disabled:opacity-60',
            open ? 'bg-muted text-foreground ring-1 ring-border' : 'hover:bg-muted/70',
          )}
        >
          <span className={cn('size-2 rounded-full', current.dotCls)} />
          <span className={cn('flex-1 font-medium', current.textCls)}>{current.label}</span>
          <ChevronDown size={14} className={cn('text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
        </Button>

        {open && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-lg">
            {PRIORITY_OPTIONS.map(opt => (
              <Button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                variant="ghost"
                className={cn(
                  'h-auto w-full justify-start rounded-none px-3 py-2.5 text-sm transition-colors duration-150 hover:bg-muted',
                  opt.value === normalizedValue ? 'bg-muted' : '',
                )}
              >
                <span className={cn('size-2 rounded-full', opt.dotCls)} />
                <span className={cn('font-medium', opt.textCls)}>
                  {opt.label}
                </span>
                {opt.value === normalizedValue && (
                  <Check size={13} className="ml-auto text-foreground" />
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
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Тип задачи</Label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="h-9 w-full cursor-pointer rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/70 focus:border-border focus:bg-background focus:ring-1 focus:ring-border focus:outline-none disabled:opacity-60"
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
    <div className="flex flex-col gap-2">
      <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Метки (Labels)</Label>
      <div className="flex min-h-9 flex-wrap gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1.5 transition-colors hover:bg-muted/60 focus-within:border-border focus-within:bg-background focus-within:ring-1 focus-within:ring-border">
        {value.map(label => (
          <Badge key={label} variant="secondary" className="rounded-md px-2 py-1 text-xs font-medium text-slate-700">
            {label}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeLabel(label)}
              className="size-4 hover:bg-transparent hover:text-red-500"
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

// ── ChecklistEditor ──────────────────────────────────────────────────────────

interface ChecklistEditorProps {
  value: ChecklistItem[];
  onChange: (v: ChecklistItem[]) => void;
  n8nBaseUrl?: string;
  context?: {
    issue_type: string;
    summary: string;
    description: string;
  } & AiIssueContext;
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

  const canGenerateAi = Boolean(
    n8nBaseUrl
    && context?.issue_type
    && ((context.summary ?? '').trim() || (context.description ?? '').trim()),
  );

  const handleAiGenerate = async () => {
    if (!n8nBaseUrl || !context || !canGenerateAi) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const generated = await aiChecklist(n8nBaseUrl, context);
      onChange([
        ...value,
        ...generated.map((item, index) => ({ ...item, rank: value.length + index })),
      ]);
    } catch {
      setAiError('Не удалось сгенерировать чеклист.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Чеклист</Label>

      {value.length > 0 && (
        <div className="flex flex-col gap-1">
          {value.map((item, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-transparent bg-transparent px-2 py-1.5 transition-colors hover:bg-muted/60 focus-within:border-border focus-within:bg-background focus-within:ring-1 focus-within:ring-border">
              <input
                type="checkbox"
                checked={item.checked}
                onChange={e => updateItem(i, { checked: e.target.checked })}
                className="h-4 w-4 flex-shrink-0 rounded accent-slate-700"
              />
              <Input
                type="text"
                value={item.name}
                onChange={e => updateItem(i, { name: e.target.value })}
                placeholder="Пункт чеклиста"
                className="h-8 flex-1 border-transparent bg-transparent px-1 shadow-none hover:bg-transparent focus-visible:border-transparent focus-visible:bg-transparent focus-visible:ring-0"
              />
              <label className="flex shrink-0 cursor-pointer items-center gap-1 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={item.mandatory}
                  onChange={e => updateItem(i, { mandatory: e.target.checked })}
                  className="h-3.5 w-3.5 rounded accent-slate-700"
                />
                Обяз.
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(i)}
                className="size-8 shrink-0 text-muted-foreground hover:text-red-500"
              >
                <Trash2 size={15} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {aiError && <p className="text-xs text-red-600">{aiError}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={addItem}
          variant="ghost"
          size="sm"
          className="px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Plus size={14} />
          Добавить пункт
        </Button>

        {n8nBaseUrl && context && (
          <Button
            type="button"
            onClick={handleAiGenerate}
            disabled={aiLoading || !canGenerateAi}
            variant="ghost"
            size="sm"
            className="px-0 text-xs text-violet-500 hover:bg-transparent hover:text-violet-700"
          >
            {aiLoading
              ? <><Loader2 size={14} className="animate-spin" /> Генерирую чеклист...</>
              : <><Sparkles size={14} /> Сгенерировать с ИИ</>
            }
          </Button>
        )}
      </div>
    </div>
  );
}
