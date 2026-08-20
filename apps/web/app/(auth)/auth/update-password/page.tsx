'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient, isSupabaseConfigured } from '@bayele/database/client';
import { ArrowRight, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';

const MIN_LEN = 8;

/**
 * Set a new password. Reached from the recovery link → /auth/callback (which exchanges the code for a
 * recovery session) → here. We confirm a session is present before showing the form, so a visitor who
 * lands here without a valid link gets a clear "expired link" message instead of a failing submit.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<'checking' | 'ok' | 'no-session'>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setReady('no-session');
      return;
    }
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(data.session ? 'ok' : 'no-session');
    });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN_LEN) {
      setError(`Le mot de passe doit contenir au moins ${MIN_LEN} caractères.`);
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // The recovery session is now a normal session — send them into the app.
      setTimeout(() => router.push('/dashboard'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La mise à jour a échoué. Réessayez.');
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
        <span className="text-xs font-medium text-muted">Nouveau mot de passe</span>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        <h1 className="font-display text-xl font-extrabold text-ink">Définir un nouveau mot de passe</h1>

        {ready === 'checking' && (
          <div className="mt-6 flex items-center justify-center py-4">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        )}

        {ready === 'no-session' && (
          <div className="mt-4">
            <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un nouveau.</span>
            </div>
            <Link href="/auth/reset" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline">
              Renvoyer un lien <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {ready === 'ok' && (
          done ? (
            <div className="mt-5 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Mot de passe mis à jour. Redirection en cours…</span>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">Choisissez un mot de passe d&apos;au moins {MIN_LEN} caractères.</p>
              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              <form onSubmit={onSubmit} className="mt-4 space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-ink">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-ink">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••••••"
                    className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Enregistrer <ArrowRight className="h-3.5 w-3.5" /></>)}
                </button>
              </form>
            </>
          )
        )}
      </div>

      <div className="py-4 text-center">
        <Link href="/" className="text-xs text-muted hover:text-ink">← Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
