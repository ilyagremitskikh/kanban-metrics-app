import { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { aiOptimize } from '../lib/jiraApi';
import type { OptimizeContext } from '../types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type DiffState = 'idle' | 'loading' | 'diff';

interface Props {
  value: string;
  onChange: (v: string) => void;
  n8nBaseUrl: string;
  context?: OptimizeContext;
  label?: string;
  compact?: boolean;
}

export default function AiDescriptionDiff({
  value,
  onChange,
  n8nBaseUrl,
  context,
  label = 'Описание (Description)',
  compact = false,
}: Props) {
  const [state, setState] = useState<DiffState>('idle');
  const [original, setOriginal] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const aiResultRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value, state]);

  useEffect(() => {
    const textarea = aiResultRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [aiResult, state]);

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
    <div className="flex flex-col gap-2">
      {label && (
        <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</Label>
      )}

      {state === 'idle' && (
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Подробное описание задачи, шаги воспроизведения, критерии приёмки..."
            rows={6}
            className={cn(
              'overflow-hidden resize-none border-transparent bg-transparent px-2 py-2 shadow-none hover:bg-muted/60 focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-border',
              compact ? 'min-h-[104px]' : 'min-h-[180px]',
            )}
          />
          <Button
            type="button"
            onClick={handleOptimize}
            disabled={!value.trim()}
            variant="ghost"
            size="sm"
            className="mt-2 px-0 text-xs text-violet-500 hover:bg-transparent hover:text-violet-700"
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
            className="resize-none border-transparent bg-transparent opacity-50"
          />
          <div className="absolute inset-0 flex items-center justify-center rounded-md bg-background/70">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
              <Loader2 size={16} className="animate-spin" />
              Нейросеть формирует описание...
            </div>
          </div>
        </div>
      )}

      {state === 'diff' && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Оригинал</Label>
              <Textarea
                value={original}
                disabled
                rows={8}
                className="resize-none border-transparent bg-muted/40 text-muted-foreground shadow-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs font-semibold uppercase tracking-normal text-violet-600">ИИ-результат</Label>
              <Textarea
                ref={aiResultRef}
                value={aiResult}
                onChange={e => setAiResult(e.target.value)}
                rows={8}
                className="overflow-hidden resize-none border-violet-200 bg-violet-50/40 shadow-none focus-visible:ring-1 focus-visible:ring-violet-200"
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
              variant="ghost"
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
