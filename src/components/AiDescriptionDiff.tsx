import { useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type DiffState = 'idle' | 'loading' | 'diff';

interface Props {
  value: string;
  onChange: (v: string) => void;
  n8nBaseUrl: string;
  context?: OptimizeContext;
  label?: string;
}

export default function AiDescriptionDiff({
  value,
  onChange,
  n8nBaseUrl,
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
      const { optimized_text } = await aiOptimize(n8nBaseUrl, 'description', value, context);
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
        <Label className="mb-2 block">{label}</Label>
      )}

      {state === 'idle' && (
        <div className="relative">
          <Textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Подробное описание задачи, шаги воспроизведения, критерии приёмки..."
            rows={6}
            className="resize-y"
          />
          <Button
            type="button"
            onClick={handleOptimize}
            disabled={!value.trim()}
            variant="ghost"
            size="sm"
            className="mt-2 px-0 text-xs text-gray-500 hover:text-blue-600"
          >
            <Sparkles size={13} />
            Оптимизировать с ИИ
          </Button>
        </div>
      )}

      {state === 'loading' && (
        <div className="relative">
          <Textarea
            value={value}
            disabled
            rows={6}
            className="resize-none opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Loader2 size={16} className="animate-spin" />
              Нейросеть формирует описание...
            </div>
          </div>
        </div>
      )}

      {state === 'diff' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label className="mb-2 block text-gray-400">Оригинал</Label>
              <Textarea
                value={original}
                disabled
                rows={8}
                className="resize-none text-gray-400"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="mb-2 block text-blue-700">ИИ-результат</Label>
              <Textarea
                value={aiResult}
                onChange={e => setAiResult(e.target.value)}
                rows={8}
                className="resize-y border-2 border-blue-300"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAccept}
            >
              <Check size={14} />
              Принять изменения
            </Button>
            <Button
              type="button"
              onClick={handleReject}
              variant="secondary"
            >
              <X size={14} />
              Отклонить
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
