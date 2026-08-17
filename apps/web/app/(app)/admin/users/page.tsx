import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { UsersTable, type AdminUser } from '../users-table';

export const dynamic = 'force-dynamic';

const ROLE_ORDER = ['super_admin', 'business', 'consultant', 'creator'];

export default async function AdminUsers() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');

  const supabase = await createClient();
  // Admin RLS returns every profile + its roles.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, handle, display_name, city, country, status, created_at, user_roles(role)')
    .order('created_at', { ascending: false })
    .limit(2000);

  const users: AdminUser[] = (profiles ?? []).map((p) => {
    const roleList = (p.user_roles ?? []).map((r) => r.role as string);
    const primary = ROLE_ORDER.find((r) => roleList.includes(r)) ?? roleList[0] ?? '—';
    return {
      id: p.id,
      handle: p.handle,
      displayName: p.display_name,
      city: p.city,
      country: p.country,
      status: p.status,
      role: primary,
      createdAt: p.created_at,
    };
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">Utilisateurs</h2>
        <p className="mt-0.5 text-xs text-muted">Gérez les comptes : approuver, suspendre ou réactiver un membre.</p>
      </div>
      <UsersTable users={users} />
    </section>
  );
}
