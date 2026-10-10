import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { CreatorNav } from './creator-nav';
import { creatorAllowed, creatorTabs } from '@/lib/auth/creator-gate';

export const dynamic = 'force-dynamic';

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  // Status gate (lib/auth/creator-gate.ts). The layout admits the widest audience of its pages:
  // active creators, plus pending_review creators who may already use /creator/campaigns (browse,
  // apply, alerts). Every other page (dashboard, wallet, partner) re-checks for 'workspace' access,
  // so a pending creator can't reach them by direct URL. No profile / suspended / rejected → dispatcher.
  const gate = { roles: session.roles, primary: session.primary, status: session.profile?.status };
  if (!creatorAllowed(gate, 'campaigns')) redirect('/dashboard');

  return (
    <div className="space-y-5">
      <CreatorNav tabs={creatorTabs(gate)} />
      <div>{children}</div>
    </div>
  );
}
