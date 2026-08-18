import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { getSession } from '@/lib/auth/session';
import { NotificationBell } from '@/components/notification-bell';
import { AccountMenu } from '@/components/account-menu';
import { BottomNav } from '@/components/bottom-nav';
import type { Database } from '@bayele/database';

type Notif = Database['public']['Tables']['notifications']['Row'];
type Role = Database['public']['Enums']['user_role'];

const ROLE_FR: Record<Role, string> = {
  super_admin: 'Admin',
  business: 'Marque',
  consultant: 'Consultant',
  creator: 'Créateur',
};

// Signed-in workspaces are private — keep them out of the index (belt-and-suspenders with robots.txt).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Shared authenticated shell: header with the Realtime notification bell + a per-role bottom nav.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  let notifications: Notif[] = [];
  let unread = 0;
  if (session.userId) {
    const supabase = await createClient();
    // RLS scopes both queries to the signed-in user; the unread count uses the partial index.
    const [{ data }, { count }] = await Promise.all([
      supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
    ]);
    notifications = (data ?? []) as Notif[];
    unread = count ?? 0;
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
            <span className="font-display font-extrabold text-ink">
              Bayele<span className="brand-dot">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell userId={session.userId} initial={notifications} initialUnread={unread} />
            <AccountMenu
              displayName={session.profile?.display_name ?? null}
              email={session.email}
              roleLabel={session.primary ? ROLE_FR[session.primary] : null}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 sm:pb-8">{children}</main>

      {session.primary && <BottomNav role={session.primary} />}
    </div>
  );
}
