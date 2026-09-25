import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { onboardingPath, roleDashboardPath, roleFromSlug } from '@/lib/roles';

/**
 * Post-auth dispatcher. Not a page a user lingers on — it routes by state:
 *   no session         → /auth
 *   no profile yet          → /onboarding/<role from signup metadata>
 *   not active yet/anymore  → /onboarding/done (the status screen: under review / suspended / rejected)
 *   active                  → the role's dashboard
 */
export default async function DashboardDispatch() {
  const session = await getSession();

  if (!session.userId) redirect('/auth?mode=signin');

  if (!session.profile) {
    const metaRole = session.metadata.role as string | undefined;
    redirect(onboardingPath(roleFromSlug(metaRole) ?? 'creator'));
  }

  // Only an active profile reaches a role dashboard. Every role layout also redirects a non-active
  // profile back here, so any non-active status MUST be caught first or the two bounce forever
  // (pending_review → under-review screen; suspended/rejected → the status screen explains why).
  if (session.profile.status !== 'active') redirect('/onboarding/done');

  const dest =
    session.primary === 'super_admin'
      ? '/admin/dashboard'
      : session.primary === 'business'
        ? '/business/dashboard'
        : session.primary === 'consultant'
          ? roleDashboardPath('consultant')
          : roleDashboardPath('creator');

  redirect(dest);
}
