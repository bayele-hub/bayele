import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { createClient } from '@/lib/supabase/server';
import { brandCtaState } from '@/lib/gov/rules';

/**
 * Session-aware contact CTA for the public creator/consultant profiles.
 *
 * Creators: unchanged (a logged-in brand launches a campaign; logged-out visitors get the signup
 * funnel). Partners (G3/G4, §2.1): brands never message or hire a partner cold — they « Demander ce
 * partenaire », Bayele approves and introduces them. The public « Envoyer un message » and the
 * retainer link are gone for partners; an assigned brand gets « Ouvrir la conversation ».
 */
export async function ProfileContactCTA({
  handle,
  kind,
  primaryLabel,
  messageLabel,
  partnerId,
}: {
  handle: string;
  kind: 'creator' | 'consultant';
  primaryLabel: string;
  messageLabel: string;
  partnerId?: string;
}) {
  const session = await getSession();
  const isBusiness = !!session.userId && session.roles.includes('business');
  const profilePath = kind === 'creator' ? `/creators/${handle}` : `/partners/${handle}`;

  const primaryClass =
    'inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto';
  const secondaryClass =
    'inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand sm:w-auto';
  const next = encodeURIComponent(profilePath);

  if (kind === 'consultant') {
    const { t } = await getDictionary();
    const R = t.partnerRequest;
    let pendingRequest = false;
    let assignment: { conversationId: string | null } | null = null;
    if (isBusiness && partnerId) {
      const supabase = await createClient();
      const [{ data: reqs }, { data: asg }] = await Promise.all([
        supabase.from('partner_contact_requests').select('id').eq('brand_id', session.userId!).eq('partner_id', partnerId).eq('status', 'pending').limit(1),
        supabase.from('partner_assignments').select('conversation_id').eq('brand_id', session.userId!).eq('partner_id', partnerId).eq('status', 'active').limit(1),
      ]);
      pendingRequest = (reqs ?? []).length > 0;
      if (asg && asg.length) assignment = { conversationId: asg[0]!.conversation_id };
    }
    const state = brandCtaState({
      signedIn: !!session.userId, roles: session.roles, status: session.profile?.status ?? null,
      pendingRequest, activeAssignment: assignment, self: session.userId === partnerId,
    });
    switch (state.kind) {
      case 'signup':
        return (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link href={`/auth?mode=signup&role=business&intent=hire&target=${handle}&next=${next}`} className={primaryClass}>{R.cta.request}</Link>
          </div>
        );
      case 'request':
        return (
          <div className="flex w-full flex-col gap-1 sm:w-auto">
            <Link href={`/business/partners/request?partner=${encodeURIComponent(handle)}`} className={primaryClass}>{R.cta.request}</Link>
            <p className="text-[12px] text-muted">{R.cta.help}</p>
          </div>
        );
      case 'pending':
        return <Link href="/business/partners" className={secondaryClass}>{R.cta.sent}</Link>;
      case 'assigned':
        return (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {state.conversationId && <Link href={`/messages/${state.conversationId}`} className={primaryClass}><MessageCircle className="h-4 w-4" aria-hidden /> {R.cta.openThread}</Link>}
            <Link href={`/business/retainers/new?partner=${encodeURIComponent(handle)}`} className={secondaryClass}>{R.cta.proposeRetainer}</Link>
          </div>
        );
      case 'not_approved':
        return (
          <div className="w-full rounded-xl bg-surface p-3 text-[13px] text-ink sm:max-w-sm">
            {R.cta.notApproved}{' '}
            <Link href="/profile" className="font-bold text-brand-700 underline">{R.cta.completeProfile}</Link>
          </div>
        );
      default:
        return null;
    }
  }

  // Creators — logged-in brand: real in-app action.
  if (isBusiness) {
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Link href="/business/campaigns/new" className={primaryClass}>{primaryLabel}</Link>
      </div>
    );
  }

  // Other signed-in roles don't commission work from this page.
  if (session.userId) return null;

  // Logged-out: the original signup-with-intent funnel.
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Link href={`/auth?mode=signup&role=business&intent=invite&target=${handle}&next=${next}`} className={primaryClass}>
        {primaryLabel}
      </Link>
      <Link href={`/auth?mode=signup&role=business&intent=message&target=${handle}&next=${next}`} className={secondaryClass}>
        <MessageCircle className="h-4 w-4" /> {messageLabel}
      </Link>
    </div>
  );
}
