import type { Settings as SettingsType, JQLMode } from '../types';
import { buildStandardMetricsJql, getStandardFilterDescription } from '../lib/metricsQuery';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SectionCard } from '@/components/ui/admin';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  settings: SettingsType;
  onChange: (s: SettingsType) => void;
  onFetch: () => void;
  loading: boolean;
  loadingLabel: string;
}

export function Settings({ settings, onChange, onFetch, loading, loadingLabel }: Props) {
  const set = (patch: Partial<SettingsType>) => onChange({ ...settings, ...patch });
  const toggleMode = (mode: JQLMode) => set({ mode });
  const standardJql = buildStandardMetricsJql(settings.projectKey);

  return (
    <SectionCard title="Настройки подключения" description="Быстрый конфиг источника данных и режима фильтрации для Jira/n8n.">
      <div className="grid gap-5">
        <div>
          <Label className="mb-2 block">n8n URL</Label>
          <Input
            type="url"
            value={settings.n8nBaseUrl}
            placeholder="https://n8n.example.com"
            onChange={(e) => set({ n8nBaseUrl: e.target.value })}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-foreground">Фильтрация</div>
            <Badge variant="outline">{settings.mode === 'standard' ? 'Standard' : 'Custom JQL'}</Badge>
          </div>
          <Tabs value={settings.mode} onValueChange={(value) => toggleMode(value as JQLMode)} className="gap-3">
            <TabsList>
              <TabsTrigger value="standard">Стандартный</TabsTrigger>
              <TabsTrigger value="custom">Свой JQL</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {settings.mode === 'standard' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[140px_auto] md:items-end">
              <div>
                <Label className="mb-2 block">Проект</Label>
                <Input
                  type="text"
                  value={settings.projectKey}
                  placeholder="PROJ"
                  onChange={(e) => set({ projectKey: e.target.value })}
                />
              </div>
              <div>
                <Button onClick={onFetch} disabled={loading}>
                  {loading ? loadingLabel : 'Загрузить данные'}
                </Button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
              <div className="text-sm text-muted-foreground">
                {getStandardFilterDescription()}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  Показать стандартный JQL
                </summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-background px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                  {standardJql}
                </pre>
              </details>
            </div>
          </div>
        ) : (
          <>
            <div>
              <Label className="mb-2 block">JQL-запрос</Label>
              <Textarea
                rows={2}
                className="min-h-[90px] resize-y leading-relaxed"
                value={settings.customJql}
                placeholder='project = CREDITS ORDER BY created ASC'
                onChange={(e) => set({ customJql: e.target.value })}
              />
            </div>
            <div className="mt-3">
              <Button onClick={onFetch} disabled={loading}>
                {loading ? loadingLabel : 'Загрузить данные'}
              </Button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
}
