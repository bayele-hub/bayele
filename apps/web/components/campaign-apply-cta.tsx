import Link from 'next/link';
import { Clock, CheckCircle2, Building2, ArrowRight, ShieldCheck, Users } from 'lucide-react';
import type { Dictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { ApplyButton } from '@/app/(app)/creator/campaigns/apply-button';

type StatusKey = keyof Dictionary['applyCta']['status'];

/**
 * Session-aware "Apply" control for the public campaign page (LinkedIn-job model), localized
 * (`applyCta.*`, design §8.1):
 *   - logged-out            → sign up as a creator, returning to this campaign afterwards;
 *   - creator               → apply right here (or the status of their application);
 *   - brand / partner / admin → a notice for THAT account type (partners get a link to put their
 *     creators forward);
 *   - full campaign (no places left, council C1) → apply disabled (an existing application still shows).
 * Real authorization stays in apply_to_campaign; this only decides which affordance to show.
 */
export async function CampaignApplyCTA({ campaignId, full = false, t }: { campaignId: string; full?: boolean; t: Dictionary }) {
  const a = t.applyCta;
  const session = await getSession();
  const next = encodeURIComponent(`/campaigns/${campaignId}`);

  if (!session.userId) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/auth?mode=signup&role=creator&intent=apply&target=${campaignId}&next=${next}`}
          className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto"
        >
          {a.applyLong}
        </Link>
        <p className="text-[11px] text-muted">
          {a.signinPrefix}{' '}
          <Link href={`/auth?mode=signin&next=${next}`} className="font-semibold text-brand hover:underline">{a.signin}</Link>
        </p>
      </div>
    );
  }

  // Signed in but onboarding not finished → complete the profile before applying.
  if (!session.profile) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto"
      >
        {a.finishSignup} <ArrowRight className="h-4 w-4" aria-hidden />
      </Link>
    );
  }

  // Not a creator: one notice per account type (multi-role accounts use the highest role).
  if (!session.roles.includes('creator')) {
    const notice = (Icon: typeof Building2, text: string, extra?: React.ReactNode) => (
      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-muted sm:max-w-sm">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span>
          {text}
          {extra}
        </span>
      </div>
    );
    if (session.primary === 'super_admin') return notice(ShieldCheck, a.adminNotice);
    if (session.primary === 'consultant') {
      return notice(
        Users,
        a.partnerNotice,
        <>
          {' '}
          <Link href="/partner/campaigns" className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 hover:text-brand">
            {a.partnerLink}
          </Link>
        </>,
      );
    }
    return notice(Building2, a.brandNotice);
  }

  // Suspended/rejected accounts can't apply. Pending + active creators CAN apply — selection is
  // still gated (a brand can only approve a verified creator), so applying early is safe.
  const status = session.profile.status;
  if (status === 'suspended' || status === 'rejected') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-muted sm:max-w-xs">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{a.ineligible}</span>
      </div>
    );
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('campaign_creators')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('creator_id', session.userId)
    .maybeSingle();

  if (existing) {
    const label = a.status[existing.status as StatusKey] ?? a.sent;
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" aria-hidden /> {label}
      </span>
    );
  }

  if (full) {
    return (
      <button type="button" disabled aria-disabled="true"
        className="inline-flex min-h-tap w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 text-sm font-bold text-muted sm:w-auto">
        {a.full}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <ApplyButton campaignId={campaignId} label={a.apply} sentLabel={a.sent} />
      {status !== 'active' && <p className="text-[11px] text-muted">{a.pendingHint}</p>}
    </div>
  );
}
