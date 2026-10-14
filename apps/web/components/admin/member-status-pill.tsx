import { Clock } from 'lucide-react';

/** Contrast-safe status pill (design §A.6): never `text-accent` on white or accent-soft. */
const CLASS: Record<string, string> = {
  pending_review: 'bg-accent-soft text-ink',
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-rose-50 text-rose-700',
  rejected: 'bg-surface text-muted',
};

export function MemberStatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${CLASS[status] ?? 'bg-surface text-muted'}`}>
      {status === 'pending_review' && <Clock className="h-3 w-3 text-accent" aria-hidden />}
      {label}
    </span>
  );
}
