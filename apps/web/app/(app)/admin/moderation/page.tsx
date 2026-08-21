import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { ModerationQueue, type PendingRow } from '../moderation-queue';

export const dynamic = 'force-dynamic';

// Highest-privilege role first, matching the users table — so a multi-role profile shows a stable,
// meaningful role on its approval card instead of whichever row the join happened to return first.
const ROLE_ORDER = ['super_admin', 'business', 'consultant', 'creator'];
const primaryRole = (roles: string[]): string => ROLE_ORDER.find((r) => roles.includes(r)) ?? '—';

export default async function AdminModeration() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  const { data: pending } = await supabase
    .from('profiles')
    .select('id, handle, display_name, city, country, created_at, user_roles(role)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })
    .limit(200);

  const rows: PendingRow[] = (pending ?? []).map((p) => ({
    id: p.id,
    handle: p.handle,
    displayName: p.display_name,
    city: p.city,
    country: p.country,
    role: primaryRole((p.user_roles ?? []).map((r) => r.role as string)),
    createdAt: p.created_at,
  }));

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Profils à valider</h2>
        <p className="mt-0.5 text-xs text-muted">
          Un profil ne devient visible dans l'annuaire qu'après validation (spec §3.1).
        </p>
      </div>
      <ModerationQueue rows={rows} />
    </section>
  );
}
