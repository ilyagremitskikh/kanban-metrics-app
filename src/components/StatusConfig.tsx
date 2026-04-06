import type { WorkflowConfig } from '../types';

interface Props {
  workflows: WorkflowConfig[];
  onChange: (workflows: WorkflowConfig[]) => void;
  issueCount: number;
}

const selectCls = 'flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-slate-900 outline-none cursor-pointer focus:border-blue-400 transition';

export function StatusConfig({ workflows, onChange, issueCount }: Props) {
  const updateWorkflow = (idx: number, patch: Partial<WorkflowConfig>) => {
    const updated = workflows.map((w, i) => (i === idx ? { ...w, ...patch } : w));
    onChange(updated);
  };

  return (
    <div className="bg-white rounded-xl px-6 py-5 mb-5 shadow-sm">
      <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Определение метрик</div>
      {workflows.map((wf, idx) => (
        <div key={idx} className="border border-gray-100 rounded-xl px-4 py-3.5 mb-3 last:mb-0 bg-gray-50/50">
          <div className="text-xs font-semibold text-gray-500 mb-3">{wf.types.join(', ')}</div>
          {(() => {
            // Include current config values even if they're not in wf.statuses
            // (e.g. fallback defaults that don't appear in this workflow's transitions)
            const opts = [...new Set([
              wf.ltStart, wf.ltEnd, wf.ctStart, wf.ctEnd,
              ...wf.statuses,
            ])];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 min-w-[72px]">Lead Time</span>
                  <select value={wf.ltStart} onChange={(e) => updateWorkflow(idx, { ltStart: e.target.value })} className={selectCls}>
                    {opts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                  <select value={wf.ltEnd} onChange={(e) => updateWorkflow(idx, { ltEnd: e.target.value })} className={selectCls}>
                    {opts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-500 min-w-[72px]">Cycle Time</span>
                  <select value={wf.ctStart} onChange={(e) => updateWorkflow(idx, { ctStart: e.target.value })} className={selectCls}>
                    {opts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="text-gray-300 text-sm flex-shrink-0">→</span>
                  <select value={wf.ctEnd} onChange={(e) => updateWorkflow(idx, { ctEnd: e.target.value })} className={selectCls}>
                    {opts.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            );
          })()}
        </div>
      ))}
      <div className="mt-3 text-xs text-gray-400">
        Загружено: {issueCount} задач · Workflow: {workflows.length}
      </div>
    </div>
  );
}
