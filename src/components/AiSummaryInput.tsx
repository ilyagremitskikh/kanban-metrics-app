import { useState, useRef } from 'react';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  value: string;
  onChange: (v: string) => void;
  n8nBaseUrl: string;
  context?: OptimizeContext;
  label?: string;
  placeholder?: string;
}

export default function AiSummaryInput({
  value,
  onChange,
  n8nBaseUrl,
  context,
  label = 'Заголовок (Summary)',
  placeholder = 'Краткое описание задачи',
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
    <div className="flex flex-col gap-1">
      {label && (
        <Label className="mb-2 block">{label}</Label>
      )}
      <div className="relative">
        <Input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className={`h-10 w-full bg-background px-3 pr-10 text-sm transition-all duration-200
            focus:bg-white focus:outline-none disabled:opacity-60
            ${highlighted
              ? 'border-blue-600 ring-2 ring-blue-100 bg-white'
              : 'border-input focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
            }`}
        />
        <Button
          type="button"
          onClick={handleOptimize}
          disabled={loading || !value.trim()}
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600"
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
          className="self-start px-0 text-xs text-gray-400 hover:text-blue-600"
        >
          <Undo2 size={12} />
          Отменить
        </Button>
      )}
    </div>
  );
}
