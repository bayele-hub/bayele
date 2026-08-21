import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getSession } from '@/lib/auth/session';
import { OnboardingForm } from './onboarding-form';

const VALID = ['creator', 'consultant', 'business'] as const;
type Role = (typeof VALID)[number];

export default async function OnboardingPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;

  // Resolve the session first, so a mistyped role URL never bounces a signed-in user to signup.
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  // Already onboarded → straight to the dispatcher.
  if (session.profile) redirect('/dashboard');

  // The role is bound to what was chosen at signup (captured in auth metadata). This prevents a user
  // from self-assigning a different — potentially higher-privilege — role by editing the URL. When
  // signup captured no role, the URL role is honored.
  const metaRole = session.metadata.role as string | undefined;
  const intendedRole = VALID.includes(metaRole as Role) ? (metaRole as Role) : null;
  if (!VALID.includes(role as Role)) redirect(intendedRole ? `/onboarding/${intendedRole}` : '/dashboard');
  if (intendedRole && intendedRole !== role) redirect(`/onboarding/${intendedRole}`);

  const meta = session.metadata;
  const defaults = {
    displayName: (meta.display_name as string) ?? (meta.company_name as string) ?? '',
    handle: (meta.handle as string) ?? '',
    country: (['CM', 'CI', 'GA'].includes(meta.country as string) ? (meta.country as string) : 'CM') as
      | 'CM'
      | 'CI'
      | 'GA',
    companyName: (meta.company_name as string) ?? '',
  };

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-lg items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
          <span className="font-display text-lg font-extrabold text-ink">
            Bayele<span className="brand-dot">.</span>
          </span>
        </Link>
        <span className="text-xs font-medium text-muted">Étape 2 / 2 — Profil</span>
      </div>

      <div className="mx-auto mt-2 w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <OnboardingForm role={role as Role} userId={session.userId} defaults={defaults} />
      </div>
    </div>
  );
}
