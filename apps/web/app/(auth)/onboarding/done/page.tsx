import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { continueTarget, withNext } from '@/lib/auth/return-path';
import { getMyModerationStatus } from '@/lib/data/moderation';
import { ModerationStatusCard } from '@/components/moderation-status-card';

/**
 * One screen for every non-dashboard account state (the dispatcher sends pending / suspended /
 * rejected profiles here). D8: steps « Reçu → En revue → Décision », what to do meanwhile, the open
 * correction request or reject reason with a fix link (my_moderation_status). No invented durations.
 */
export default async function OnboardingDone({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [session, { next }, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.profile) redirect(withNext('/dashboard', next));

  const U = t.creatorUx;
  const status = session.profile.status;
  const mod = (await getMyModerationStatus()) ?? { status, resubmitted_at: null, open_correction: null, last_decision: null };
  // Signed up from a specific page (a campaign, the alert opt-in…): « Continuer » takes them back there.
  const resume = continueTarget(status, next);
  const isCreator = session.roles.includes('creator');
  const btn = 'flex min-h-tap items-center justify-center rounded-xl px-4 text-sm font-bold transition active:scale-95';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
        <span className="font-display text-lg font-extrabold text-ink">
          Bayele<span className="brand-dot">.</span>
        </span>
      </Link>

      <div className="w-full max-w-sm space-y-4">
        <ModerationStatusCard s={mod} U={U} tips={t.creatorTips} locale={locale} />

        <div className="grid gap-2">
          {resume && <Link href={resume} className={`${btn} bg-brand text-white hover:bg-brand-600`}>{U.continue}</Link>}
          {status === 'active' && !resume && <Link href="/dashboard" className={`${btn} bg-brand text-white hover:bg-brand-600`}>{U.active.cta}</Link>}
          {status === 'pending_review' && isCreator && !resume && (
            <Link href="/creator/campaigns" className={`${btn} bg-brand text-white hover:bg-brand-600`}>{U.pending.ctaCampaigns}</Link>
          )}
          {(status === 'pending_review' || status === 'rejected') && !mod.open_correction && (
            <Link href="/profile" className={`${btn} border border-line bg-white text-ink hover:border-brand`}>{U.pending.ctaProfile}</Link>
          )}
          <Link href="/" className={`${btn} border border-line font-semibold text-muted hover:text-ink`}>{U.pending.home}</Link>
        </div>
      </div>
    </div>
  );
}
