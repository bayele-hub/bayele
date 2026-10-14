import Link from 'next/link';
import { CheckCircle2, Clock, PencilLine, ShieldAlert, XCircle } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { fill } from '@/lib/campaign-board';
import { fixLink, pendingStep, type MyModerationStatus } from '@/lib/moderation-status';
import { SectionTip } from '@/components/admin/section-tip';

/**
 * The member's status (D8): steps « Reçu → En revue → Décision », what to complete meanwhile, the open
 * correction request or the reject reason with a link to the field to fix. No invented durations;
 * every "we'll tell you" is « dans l'application » (C2).
 */
export function ModerationStatusCard({ s, U, tips, locale, compact = false }: { s: MyModerationStatus; U: Dictionary['creatorUx']; tips: Dictionary['creatorTips']; locale: Locale; compact?: boolean }) {
  const date = (iso: string) => new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(iso));
  const oc = s.open_correction;
  const ld = s.last_decision;

  if (oc) {
    return (
      <section className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-ink"><PencilLine className="h-4 w-4 text-ink" aria-hidden /> {U.correction.title}</p>
        <p className="mt-1 text-[13px] text-ink">{fill(U.correction.reason, { reason: oc.reason_label })}</p>
        {oc.message && <p className="mt-1 whitespace-pre-line text-[13px] text-ink/80 [overflow-wrap:anywhere]">{oc.message}</p>}
        <p className="mt-2 text-[13px] text-ink">
          {U.correction.fields} {oc.fields.map((f) => U.fix[f as keyof typeof U.fix] ?? f).join(', ')}
        </p>
        <p className="mt-1 text-[12px] text-muted">{U.correction.note}</p>
        <Link href={fixLink(oc.fields)} className="mt-3 inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-600">{U.correction.cta}</Link>
      </section>
    );
  }

  if (s.status === 'rejected') {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-rose-800"><XCircle className="h-4 w-4" aria-hidden /> {U.rejected.title}</p>
        {ld?.reason_label && <p className="mt-1 text-[13px] text-rose-800">{fill(U.rejected.reason, { reason: ld.reason_label })}</p>}
        {ld?.message && <p className="mt-1 whitespace-pre-line text-[13px] text-rose-800/90 [overflow-wrap:anywhere]">{ld.message}</p>}
        <p className="mt-1 text-[13px] text-rose-800">{U.rejected.body}</p>
        <Link href="/profile" className="mt-3 inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white hover:bg-brand-600">{U.rejected.cta}</Link>
      </section>
    );
  }

  if (s.status === 'suspended') {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-rose-800"><ShieldAlert className="h-4 w-4" aria-hidden /> {U.suspended.title}</p>
        {ld?.reason_label && <p className="mt-1 text-[13px] text-rose-800">{fill(U.suspended.reason, { reason: ld.reason_label })}</p>}
        {ld?.message && <p className="mt-1 whitespace-pre-line text-[13px] text-rose-800/90 [overflow-wrap:anywhere]">{ld.message}</p>}
        <p className="mt-1 text-[13px] text-rose-800">{U.suspended.body}</p>
      </section>
    );
  }

  if (s.status === 'active') {
    if (compact) return null;
    return (
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-left">
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" aria-hidden /> {U.active.title}</p>
        <p className="mt-1 text-[13px] text-emerald-800">{U.active.body}</p>
      </section>
    );
  }

  const step = pendingStep(s);
  return (
    <section className="rounded-2xl border border-line bg-white p-4 text-left">
      <p className="flex items-center text-sm font-bold text-ink">
        <Clock className="mr-2 h-4 w-4 text-accent" aria-hidden /> {U.pending.title}
        <SectionTip id="creator-pending" label={U.pending.title} text={tips.pending} ariaTemplate={tips.aria} />
      </p>
      <ol className="mt-3 grid grid-cols-3 gap-1 text-center text-[11px] font-semibold" aria-label={U.pending.title}>
        {U.pending.steps.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined}
            className={`rounded-lg px-1 py-1.5 ${i < step ? 'bg-emerald-50 text-emerald-700' : i === step ? 'bg-accent-soft text-ink' : 'bg-surface text-muted'}`}>
            {label}
          </li>
        ))}
      </ol>
      {s.resubmitted_at && <p className="mt-2 text-[12px] text-ink">{fill(U.pending.resubmitted, { date: date(s.resubmitted_at) })}</p>}
      {!compact && (
        <>
          <p className="mt-3 text-[13px] text-muted">{U.pending.body}</p>
          <p className="mt-3 text-xs font-bold text-ink">{U.pending.meanwhileTitle}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[13px] text-ink">
            {U.pending.meanwhile.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}
