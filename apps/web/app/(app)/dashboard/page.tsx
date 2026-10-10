import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { onboardingPath, roleDashboardPath, roleFromSlug } from '@/lib/roles';
import { continueTarget, withNext } from '@/lib/auth/return-path';

/**
 * Post-auth dispatcher. Not a page a user lingers on — it routes by state:
 *   no session         → /auth
 *   no profile yet          → /onboarding/<role from signup metadata>
 *   not active yet/anymore  → /onboarding/done (the status screen: under review / suspended / rejected)
 *   active                  → the role's dashboard
 */
export default async function DashboardDispatch({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [session, { next }] = await Promise.all([getSession(), searchParams]);

  if (!session.userId) redirect('/auth?mode=signin');

  // `next` (validated same-origin) is the page the visitor signed up from — e.g. the alert opt-in
  // return /creator/campaigns?alert_country=…#alertes. It rides through onboarding to « Continuer ».
  if (!session.profile) {
    const metaRole = session.metadata.role as string | undefined;
    redirect(withNext(onboardingPath(roleFromSlug(metaRole) ?? 'creator'), next));
  }

  const resume = continueTarget(session.profile.status, next);
  if (resume) redirect(resume);

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
