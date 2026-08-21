import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { listCreators } from '@/lib/data/talent';
import { TalentGrid, type TalentItem } from '@/components/talent-grid';

export const dynamic = 'force-dynamic';

/**
 * In-app creator directory for brands. A logged-in business browses creators here and opens a
 * profile to contact them (the profile's CTA launches a campaign for signed-in brands). Server-renders
 * the first page of the directory so mobile never shows a client-side empty flash.
 */
export default async function BusinessTalent() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');

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
