import { redirect } from 'next/navigation';
import { Users } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { listCreators } from '@/lib/data/talent';
import { TalentGrid, type TalentItem } from './talent-grid';

export const dynamic = 'force-dynamic';

export default async function TalentSearch() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  // Server-rendered first page of the directory (mobile invariant §3 #10 — never a client empty fetch).
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
        <p className="mt-0.5 text-xs text-muted">Parcourez l'annuaire pour composer vos campagnes.</p>
      </div>
      <TalentGrid creators={items} />
    </section>
  );
}
