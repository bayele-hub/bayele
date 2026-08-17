import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { AdminNav } from './admin-nav';

export const dynamic = 'force-dynamic';

/**
 * Admin console shell. The RLS on every table is the real boundary, but we also bounce non-admins
 * out of the UI here so the whole /admin/* subtree is gated in one place, and render the mobile-first
 * section nav above each page.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (session.primary !== 'super_admin') redirect('/dashboard');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-50 text-brand">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div>
          <h1 className="font-display text-xl font-extrabold leading-none text-ink">Console admin</h1>
          <p className="mt-0.5 text-[11px] text-muted">Bayele — supervision & séquestre</p>
        </div>
      </div>

      <AdminNav />

      <div>{children}</div>
    </div>
  );
}
