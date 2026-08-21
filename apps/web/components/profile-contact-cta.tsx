import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

/**
 * Session-aware contact CTA for the public creator/consultant profiles.
 *
 * Previously these buttons always linked to the signup screen, so a brand that was ALREADY logged in
 * got bounced to "create an account" instead of a real action. This resolves the viewer:
 *   - logged-in business → an in-app action (launch a campaign for a creator, or a pre-filled retainer
 *     proposal for a consultant);
 *   - logged-out visitor → the original signup-with-intent links (unchanged funnel);
 *   - logged-in creator/consultant/admin → nothing (they aren't the ones commissioning work here).
 *
 * getSession() is React-cached, so calling it here adds no extra round-trip on a page that already
 * resolves the session/dictionary.
 */
export async function ProfileContactCTA({
  handle,
  kind,
  primaryLabel,
  messageLabel,
}: {
  handle: string;
  kind: 'creator' | 'consultant';
  primaryLabel: string;
  messageLabel: string;
}) {
  const session = await getSession();
  const isBusiness = !!session.userId && session.roles.includes('business');
  const profilePath = kind === 'creator' ? `/creators/${handle}` : `/consultants/${handle}`;

  const primaryClass =
    'inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto';
  const secondaryClass =
    'inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-ink transition hover:border-brand hover:text-brand sm:w-auto';

  // Logged-in brand: real in-app action.
  if (isBusiness) {
    const href = kind === 'creator' ? '/business/campaigns/new' : `/business/retainers/new?consultant=${handle}`;
    return (
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Link href={href} className={primaryClass}>{primaryLabel}</Link>
      </div>
    );
  }

  // Other signed-in roles don't commission work from this page.
  if (session.userId) return null;

  // Logged-out: the original signup-with-intent funnel.
  const primaryIntent = kind === 'creator' ? 'invite' : 'hire';
  const next = encodeURIComponent(profilePath);
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
      <Link
        href={`/auth?mode=signup&role=business&intent=${primaryIntent}&target=${handle}&next=${next}`}
        className={primaryClass}
      >
        {primaryLabel}
      </Link>
      <Link
        href={`/auth?mode=signup&role=business&intent=message&target=${handle}&next=${next}`}
        className={secondaryClass}
      >
        <MessageCircle className="h-4 w-4" /> {messageLabel}
      </Link>
    </div>
  );
}
