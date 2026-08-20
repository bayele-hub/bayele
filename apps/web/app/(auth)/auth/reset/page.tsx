'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { createClient, isSupabaseConfigured } from '@bayele/database/client';
import { ArrowRight, Loader2, AlertCircle, Info, MailCheck } from 'lucide-react';

/**
 * Password-reset request. Sends a recovery link via Supabase Auth. The link lands on
 * /auth/callback?next=/auth/update-password, which exchanges the code for a (recovery) session and
 * forwards to the update-password screen. We show a neutral confirmation regardless of whether the
 * address exists, so this endpoint can't be used to enumerate accounts.
 */
export default function ResetRequestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isSupabaseConfigured()) {
      setError('Connexion indisponible : configuration Supabase manquante.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
          <span className="font-display text-lg font-extrabold text-ink">Bayele<span className="brand-dot">.</span></span>
        </Link>
        <span className="text-xs font-medium text-muted">Réinitialisation</span>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <h1 className="font-display text-xl font-extrabold text-ink">Mot de passe oublié</h1>
        <p className="mt-1 text-sm text-muted">Entrez votre adresse email — nous vous enverrons un lien pour définir un nouveau mot de passe.</p>

        {sent ? (
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Si un compte existe pour <span className="font-bold">{email.trim()}</span>, un lien de réinitialisation vient d&apos;être envoyé. Vérifiez votre boîte mail (et vos spams).</span>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-ink">Adresse email</label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Envoyer le lien <ArrowRight className="h-3.5 w-3.5" /></>)}
              </button>
            </form>
          </>
        )}

        <div className="mt-4 flex items-center gap-1.5 text-[11px] text-muted">
          <Info className="h-3.5 w-3.5 shrink-0" />
          <Link href="/auth?mode=signin" className="font-semibold text-brand hover:underline">Retour à la connexion</Link>
        </div>
      </div>

      <div className="py-4 text-center">
        <Link href="/" className="text-xs text-muted hover:text-ink">← Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
