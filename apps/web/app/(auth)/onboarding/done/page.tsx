import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, ShieldAlert, XCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';

// One screen for every non-dashboard account state, so the dispatcher has a safe place to send
// pending / suspended / rejected profiles (see the dashboard dispatcher for why this must not bounce).
const STATUS_UI = {
  active: {
    tone: 'bg-emerald-50 text-emerald-600',
    Icon: CheckCircle2,
    title: 'Compte validé 🎉',
    body: 'Votre compte est actif. Bienvenue sur Bayele.',
    showEnter: true,
  },
  pending_review: {
    tone: 'bg-accent-soft text-accent',
    Icon: Clock,
    title: 'Profil envoyé pour validation',
    body: "Merci ! Votre profil est en cours de vérification par notre équipe. Vous recevrez une notification dès qu'il sera approuvé — en général sous 24–48h.",
    showEnter: false,
  },
  suspended: {
    tone: 'bg-amber-50 text-amber-600',
    Icon: ShieldAlert,
    title: 'Compte suspendu',
    body: "Votre compte est temporairement suspendu. Contactez notre équipe à support@bayele.com pour rétablir l'accès.",
    showEnter: false,
  },
  rejected: {
    tone: 'bg-rose-50 text-rose-600',
    Icon: XCircle,
    title: 'Profil non approuvé',
    body: "Votre profil n'a pas été approuvé. Pour toute question ou pour soumettre à nouveau, écrivez-nous à support@bayele.com.",
    showEnter: false,
  },
} as const;

export default async function OnboardingDone() {
  const session = await getSession();
  if (!session.userId) redirect('/auth?mode=signin');
  // No profile yet → they haven't finished onboarding.
  if (!session.profile) redirect('/dashboard');

  const ui = STATUS_UI[session.profile.status] ?? STATUS_UI.pending_review;
  const { Icon } = ui;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
        <span className="font-display text-lg font-extrabold text-ink">
          Bayele<span className="brand-dot">.</span>
        </span>
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-card">
        <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${ui.tone}`}>
          <Icon className="h-6 w-6" />
        </div>

        <h1 className="mt-4 font-display text-xl font-extrabold text-ink">{ui.title}</h1>
        <p className="mt-2 text-sm text-muted">{ui.body}</p>

        <div className="mt-6 grid gap-2">
          {ui.showEnter && (
            <Link
              href="/dashboard"
              className="flex min-h-tap items-center justify-center rounded-xl bg-brand text-sm font-bold text-white transition hover:bg-brand-600 active:scale-95"
            >
              Aller à mon espace
            </Link>
          )}
          <Link href="/" className="flex min-h-tap items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted transition hover:text-ink">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
