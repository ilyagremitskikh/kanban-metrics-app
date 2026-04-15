import { useState, useRef } from 'react';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Props {
  value: string;
  onChange: (v: string) => void;
  n8nBaseUrl: string;
  context?: OptimizeContext;
  label?: string;
  placeholder?: string;
  variant?: 'default' | 'title';
}

export default function AiSummaryInput({
  value,
  onChange,
  n8nBaseUrl,
  context,
  label = 'Заголовок (Summary)',
  placeholder = 'Краткое описание задачи',
  variant = 'default',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState(false);
  const prevValue = useRef<string | null>(null);

  const handleOptimize = async () => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    prevValue.current = value;
    try {
      const { optimized_text } = await aiOptimize(n8nBaseUrl, 'summary', value, context);
      onChange(optimized_text);
      setHighlighted(true);
      setTimeout(() => setHighlighted(false), 2000);
    } catch {
      setError('Не удалось оптимизировать. Проверьте подключение.');
      prevValue.current = null;
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleUndo = () => {
    if (prevValue.current !== null) {
      onChange(prevValue.current);
      prevValue.current = null;
      setHighlighted(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</Label>
      )}
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className={cn(
            'w-full border-transparent bg-transparent px-2 pr-11 shadow-none transition-colors hover:bg-muted/60 focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border disabled:opacity-60',
            variant === 'title'
              ? 'h-auto min-h-12 py-2 text-2xl font-semibold leading-tight'
              : 'h-10 text-sm',
            highlighted && 'border-border bg-background ring-1 ring-violet-200',
          )}
        />
        <Button
          type="button"
          onClick={handleOptimize}
          disabled={loading || !value.trim()}
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 size-8 -translate-y-1/2 text-violet-500 hover:bg-violet-50 hover:text-violet-700"
          title="Оптимизировать с ИИ"
        >
          {loading
            ? <Loader2 size={16} className="animate-spin" />
            : <Sparkles size={16} />
          }
        </Button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {prevValue.current !== null && !loading && (
        <Button
          type="button"
          onClick={handleUndo}
          variant="ghost"
          size="sm"
          className="self-start px-0 text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
        >
          <Undo2 size={12} />
          Отменить
        </Button>
      )}
    </div>
  );
}
