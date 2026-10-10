import { CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react';
import type { PipelineKey } from '@/lib/managed-brief-state';

export { rowChecklist } from '@/lib/managed-brief-state';

const PILL: Record<PipelineKey, string> = {
  draft: 'bg-surface text-muted',
  awaiting_order: 'bg-accent-soft text-ink',
  ready: 'bg-brand-50 text-brand-700',
  awaiting_payment: 'bg-accent-soft text-ink',
  published: 'bg-emerald-50 text-emerald-700',
  declined: 'bg-rose-50 text-rose-700',
};

/** Status pill (design §1.3): text always present — colour is never the only signal. */
export function StatusPill({ stage, label }: { stage: PipelineKey; label: string }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${PILL[stage]}`}>{label}</span>;
}

/** Compact floor chip from the server's stored floor_check. */
export function FloorChip({ state, labels }: { state: 'not_set' | 'pass' | 'below'; labels: { floorNotSet: string; floorOk: string; floorBelow: string } }) {
  if (state === 'pass')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {labels.floorOk}
      </span>
    );
  if (state === 'below')
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
        <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {labels.floorBelow}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted">
      <CircleDashed className="h-3.5 w-3.5" aria-hidden /> {labels.floorNotSet}
    </span>
  );
}
