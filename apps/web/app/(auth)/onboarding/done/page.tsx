import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

export default async function OnboardingDone() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  // No profile yet → they haven't finished onboarding.
  if (!session.profile) redirect('/dashboard');

  const active = session.profile.status === 'active';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
        <span className="font-display text-lg font-extrabold text-ink">
          Bayele<span className="brand-dot">.</span>
        </span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${active ? 'bg-emerald-50 text-emerald-600' : 'bg-accent-soft text-accent'}`}>
          {active ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
        </div>

        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">
          {active ? 'Compte validé 🎉' : 'Profil envoyé pour validation'}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {active
            ? 'Votre compte est actif. Bienvenue sur Bayele.'
            : "Merci ! Votre profil est en cours de vérification par notre équipe. Vous recevrez une notification dès qu'il sera approuvé — en général sous 24–48h."}
        </p>

        <div className="mt-6 grid gap-2">
          <Link
            href="/dashboard"
            className="flex min-h-tap items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
          >
            Aller à mon espace
          </Link>
          <Link href="/" className="flex min-h-tap items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted transition hover:text-ink">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
