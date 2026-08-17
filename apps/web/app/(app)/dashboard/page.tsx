import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

/**
 * Post-auth dispatcher. Not a page a user lingers on — it routes by state:
 *   no session         → /auth
 *   no profile yet     → /onboarding/<role from signup metadata>
 *   pending_review     → /onboarding/done (the "under review" screen)
 *   active/suspended   → the role's dashboard
 */
export default async function DashboardDispatch() {
  const session = await getSession();

  if (!session.userId) redirect('/auth?mode=signin');

  if (!session.profile) {
    const metaRole = session.metadata.role as string | undefined;
    const role = ['creator', 'consultant', 'business'].includes(metaRole ?? '') ? metaRole : 'creator';
    redirect(`/onboarding/${role}`);
  }

  if (session.profile.status === 'pending_review') redirect('/onboarding/done');

  const dest =
    session.primary === 'super_admin'
      ? '/admin/dashboard'
      : session.primary === 'business'
        ? '/business/dashboard'
        : session.primary === 'consultant'
          ? '/consultant/dashboard'
          : '/creator/dashboard';

  redirect(dest);
}
