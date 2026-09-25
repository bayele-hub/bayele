import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Users, Sparkles, ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { getCreatorDirectoryGate } from '@/lib/data/launch-gate';
import { listCreators } from '@/lib/data/talent';
import { TalentGrid, type TalentItem } from '@/components/talent-grid';

export const dynamic = 'force-dynamic';

/**
 * In-app creator directory for brands. A logged-in business browses creators here and opens a
 * profile to contact them (the profile's CTA launches a campaign for signed-in brands). Server-renders
 * the first page of the directory so mobile never shows a client-side empty flash.
 *
 * Until the launch milestone (lib/launch-gate.ts) brands don't browse: they submit a brief and Bayele
 * proposes creators. Admins keep the full directory for curation.
 */
export default async function BusinessTalent() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

  const gate = await getCreatorDirectoryGate();
  if (!gate.open && session.primary !== 'super_admin') {
    const { t } = await getDictionary();
    const c = t.curated;
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-line bg-gradient-to-br from-brand-50 via-white to-accent-soft p-5 shadow-card">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-brand-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> {c.badge}
          </span>
          <h1 className="mt-3 font-display text-xl font-extrabold text-ink">{c.appTitle}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">{c.appBody}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/business/campaigns/new" className="inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95">
              {c.appCta} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link href="/business/campaigns" className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink transition hover:border-brand hover:text-brand">
              {c.appSecondary}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const creators = await listCreators({ limit: 60 });
  const items: TalentItem[] = creators.map((c) => ({
    handle: c.handle,
    displayName: c.displayName,
    avatarUrl: c.avatarUrl,
    city: c.city,
    country: c.country,
    tags: c.tags,
    ratingAvg: c.ratingAvg,
    audienceSize: c.audienceSize,
  }));

  return (
    <section className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-brand" />
          <h1 className="font-display text-xl font-extrabold text-ink">Trouver des créateurs</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">Parcourez l&apos;annuaire, ouvrez un profil et lancez une campagne pour collaborer.</p>
      </div>
      <TalentGrid creators={items} />
    </section>
  );
}
