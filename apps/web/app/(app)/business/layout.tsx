import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { BusinessNav } from './business-nav';

export const dynamic = 'force-dynamic';

export default async function BusinessLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business') && session.primary !== 'super_admin') redirect('/dashboard');
  // Only an active profile may use the workspace (see creator/layout for rationale). Admins bypass.
  if (session.primary !== 'super_admin' && session.profile?.status !== 'active') redirect('/dashboard');

  return (
    <div className="space-y-5">
      <BusinessNav />
      <div>{children}</div>
    </div>
  );
}
