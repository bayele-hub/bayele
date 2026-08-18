import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { CreatorNav } from './creator-nav';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('creator') && session.primary !== 'super_admin') redirect('/dashboard');
  // Status gate: only an active profile may use the workspace. Non-active (no profile / pending_review /
  // suspended / rejected) is bounced to the dispatcher, which routes to onboarding or the review screen.
  // Admins bypass. Without this, a pending creator could reach the live dashboard by direct URL.
  if (session.primary !== 'super_admin' && session.profile?.status !== 'active') redirect('/dashboard');

  return (
    <div className="space-y-5">
      <CreatorNav />
      <div>{children}</div>
    </div>
  );
}
