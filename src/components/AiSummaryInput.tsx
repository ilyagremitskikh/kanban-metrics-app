import { useState, useRef } from 'react';
import { Sparkles, Loader2, Undo2 } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';

interface Props {
  value: string;
  onChange: (v: string) => void;
  webhookUrl: string;
  context?: OptimizeContext;
  label?: string;
  placeholder?: string;
}

export default function AiSummaryInput({
  value,
  onChange,
  webhookUrl,
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
      const { optimized_text } = await aiOptimize(webhookUrl, 'summary', value, context);
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
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          className={`w-full pr-10 py-3 px-4 bg-gray-50 border rounded-xl text-sm transition-all duration-200
            focus:bg-white focus:outline-none disabled:opacity-60
            ${highlighted
              ? 'border-donezo-primary ring-2 ring-donezo-light bg-white'
              : 'border-gray-100 focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light'
            }`}
        />
        <button
          type="button"
          onClick={handleOptimize}
          disabled={loading || !value.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-donezo-primary disabled:opacity-40 transition-colors duration-200"
          title="Оптимизировать с ИИ"
        >
          {loading
            ? <Loader2 size={16} className="animate-spin" />
            : <Sparkles size={16} />
          }
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}

      {prevValue.current !== null && !loading && (
        <button
          type="button"
          onClick={handleUndo}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-donezo-primary transition-colors duration-200 self-start"
        >
          <Undo2 size={12} />
          Отменить
        </button>
      )}
    </div>
  );
}
