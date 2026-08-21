import Link from 'next/link';
import { Clock, CheckCircle2, Building2, ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CREATOR_STATUS_FR } from '@/lib/data/campaigns';
import { ApplyButton } from '@/app/(app)/creator/campaigns/apply-button';

/**
 * Session-aware "Apply" control for the public campaign page (LinkedIn-job model).
 *   - logged-out            → sign up as a creator, returning to this campaign afterwards;
 *   - active creator        → apply right here (or a badge if they already applied);
 *   - not-yet-active creator → must be approved first (product decision: approval-gated apply);
 *   - brand/consultant/admin → a note that only creator accounts apply.
 * Real authorization stays in apply_to_campaign; this only decides which affordance to show.
 */
export async function CampaignApplyCTA({ campaignId }: { campaignId: string }) {
  const session = await getSession();
  const next = encodeURIComponent(`/campaigns/${campaignId}`);

  // Logged-out visitor → signup funnel (role creator), coming back to the campaign.
  if (!session.userId) {
    return (
      <div className="flex flex-col gap-2">
        <Link
          href={`/auth?mode=signup&role=creator&intent=apply&target=${campaignId}&next=${next}`}
          className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto"
        >
          Postuler à cette campagne
        </Link>
        <p className="text-[11px] text-muted">
          Déjà membre ?{' '}
          <Link href={`/auth?mode=signin&next=${next}`} className="font-semibold text-brand hover:underline">Se connecter</Link>
        </p>
      </div>
    );
  }

  // Signed in but hasn't finished onboarding yet (e.g. just confirmed their email via the apply
  // link) → send them to complete their profile before they can apply.
  if (!session.profile) {
    return (
      <Link
        href="/dashboard"
        className="inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto"
      >
        Terminez votre inscription pour postuler <ArrowRight className="h-4 w-4" />
      </Link>
    );
  }

  const isCreator = session.roles.includes('creator');

  // Signed in, but not as a creator → they can't apply from a brand/consultant account.
  if (!isCreator) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-muted sm:max-w-xs">
        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <span>Vous êtes connecté avec un compte marque. Seuls les comptes créateurs peuvent postuler aux campagnes.</span>
      </div>
    );
  }

  // Suspended/rejected accounts can't apply. Pending + active creators CAN apply — selection is
  // still gated (a brand can only approve a verified creator), so applying early is safe.
  const status = session.profile.status;
  if (status === 'suspended' || status === 'rejected') {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-xs text-muted sm:max-w-xs">
        <Clock className="mt-0.5 h-4 w-4 shrink-0" />
        <span>Votre compte n&apos;est pas éligible pour postuler pour le moment.</span>
      </div>
    );
  }

  // Already applied → status badge.
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('campaign_creators')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('creator_id', session.userId)
    .maybeSingle();

  if (existing) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-4 w-4" /> {CREATOR_STATUS_FR[existing.status] ?? 'Candidature envoyée'}
      </span>
    );
  }

  // Apply now. A pending creator sees a verification hint so expectations are clear.
  return (
    <div className="flex flex-col gap-1.5">
      <ApplyButton campaignId={campaignId} />
      {status !== 'active' && (
        <p className="text-[11px] text-muted">Votre profil est en cours de validation par Bayele — vous pourrez être retenu une fois vérifié.</p>
      )}
    </div>
  );
}
