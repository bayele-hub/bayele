import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { CreatorNav } from './creator-nav';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('creator') && session.primary !== 'super_admin') redirect('/dashboard');

  return (
    <div className="space-y-5">
      <CreatorNav />
      <div>{children}</div>
    </div>
  );
}
