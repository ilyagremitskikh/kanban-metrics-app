import { useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';

type DiffState = 'idle' | 'loading' | 'diff';

interface Props {
  value: string;
  onChange: (v: string) => void;
  webhookUrl: string;
  context?: OptimizeContext;
  label?: string;
}

export default function AiDescriptionDiff({
  value,
  onChange,
  webhookUrl,
  context,
  label = 'Описание (Description)',
}: Props) {
  const [state, setState] = useState<DiffState>('idle');
  const [original, setOriginal] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async () => {
    if (!value.trim()) return;
    setOriginal(value);
    setState('loading');
    setError(null);
    try {
      const { optimized_text } = await aiOptimize(webhookUrl, 'description', value, context);
      setAiResult(optimized_text);
      setState('diff');
    } catch {
      setError('Не удалось оптимизировать. Проверьте подключение.');
      setState('idle');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleAccept = () => {
    onChange(aiResult);
    setState('idle');
  };

  const handleReject = () => {
    setState('idle');
  };

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
          {label}
        </label>
      )}

      {state === 'idle' && (
        <div className="relative">
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Подробное описание задачи, шаги воспроизведения, критерии приёмки..."
            rows={6}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
              focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light
              focus:outline-none transition-all duration-200 resize-y"
          />
          <button
            type="button"
            onClick={handleOptimize}
            disabled={!value.trim()}
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-donezo-primary
              disabled:opacity-40 transition-colors duration-200"
          >
            <Sparkles size={13} />
            Оптимизировать с ИИ
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="relative">
          <textarea
            value={value}
            disabled
            rows={6}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
              opacity-50 resize-none"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-donezo-dark font-medium">
              <Loader2 size={16} className="animate-spin" />
              Нейросеть формирует описание...
            </div>
          </div>
        </div>
      )}

      {state === 'diff' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Оригинал</span>
              <textarea
                value={original}
                disabled
                rows={8}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-sm
                  text-gray-400 resize-none"
              />
            </div>
            {/* AI result */}
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-donezo-primary uppercase tracking-widest">ИИ-результат</span>
              <textarea
                value={aiResult}
                onChange={e => setAiResult(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 bg-white border-2 border-donezo-primary rounded-xl text-sm
                  focus:outline-none focus:ring-2 focus:ring-donezo-light transition-all duration-200 resize-y"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleAccept}
              className="flex items-center gap-1.5 px-4 py-2 bg-donezo-dark text-white text-sm font-medium
                rounded-full hover:bg-donezo-primary hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              <Check size={14} />
              Принять изменения
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 text-sm font-medium
                border border-gray-200 rounded-full hover:bg-donezo-light hover:text-donezo-dark
                transition-all duration-200"
            >
              <X size={14} />
              Отклонить
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
