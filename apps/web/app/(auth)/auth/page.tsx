'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient, isSupabaseConfigured } from '@bayele/database/client';
import { Smartphone, Briefcase, Building2, ArrowRight, Loader2, AlertCircle, Info } from 'lucide-react';

type Mode = 'signin' | 'signup';
type Role = 'creator' | 'consultant' | 'business';
type CC = 'CM' | 'CI' | 'GA';

// Country is kept as a profile attribute (market + future MoMo payout). Phone-based
// auth arrives in v2; email/password is the primary method today.
const COUNTRIES: { code: CC; label: string }[] = [
  { code: 'CM', label: '🇨🇲 Cameroun' },
  { code: 'CI', label: "🇨🇮 Côte d'Ivoire" },
  { code: 'GA', label: '🇬🇦 Gabon' },
];

export default function AuthPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<Mode>('signup');
  const [role, setRole] = useState<Role>('creator');
  const [country, setCountry] = useState<CC>('CM');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [handle, setHandle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    setConfigured(isSupabaseConfigured());
    const m = params.get('mode');
    const r = params.get('role');
    if (m === 'signin' || m === 'signup') setMode(m);
    if (r && ['creator', 'consultant', 'business'].includes(r)) setRole(r as Role);
  }, [params]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!isSupabaseConfigured()) {
      setError('Connexion indisponible : configuration Supabase manquante. Ajoutez vos clés NEXT_PUBLIC_SUPABASE_* dans .env.local, puis redémarrez le serveur.');
      return;
    }
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push('/dashboard');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: fullName,
              role,
              country,
              handle: handle.toLowerCase(),
              company_name: role === 'business' ? companyName : undefined,
            },
          },
        });
        if (error) throw error;
        // If email confirmation is on, there is no session yet.
        if (!data.session) {
          setNotice("Vérifiez votre boîte mail pour confirmer votre adresse, puis connectez-vous.");
        } else {
          router.push(`/onboarding/${role}`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  const roles: { id: Role; label: string; Icon: typeof Smartphone }[] = [
    { id: 'creator', label: 'Créateur', Icon: Smartphone },
    { id: 'consultant', label: 'Consultant', Icon: Briefcase },
    { id: 'business', label: 'Marque', Icon: Building2 },
  ];

  return (
    <div className="flex min-h-screen flex-col justify-between bg-surface p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-md items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.jpeg" alt="Bayele" width={28} height={28} className="h-7 w-7 rounded-lg object-contain" />
          <span className="font-display text-lg font-extrabold text-ink">Bayele<span className="brand-dot">.</span></span>
        </Link>
        <span className="text-xs font-medium text-muted">Séquestre sécurisé</span>
      </div>

      <div className="mx-auto w-full max-w-md rounded-2xl border border-line bg-white p-5 shadow-card sm:p-6">
        {!configured && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-xs text-brand-700">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Mode démo : la connexion s'activera une fois Supabase configuré (<code>.env.local</code>).</span>
          </div>
        )}

        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface p-1">
          {(['signup', 'signin'] as Mode[]).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)}
              className={`min-h-tap rounded-lg text-xs font-bold transition ${mode === m ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'}`}>
              {m === 'signup' ? 'Créer un compte' : 'Se connecter'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
            <Info className="h-4 w-4 shrink-0" /> {notice}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {roles.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => setRole(id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-2.5 text-[11px] font-bold transition ${role === id ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted hover:border-brand-100'}`}>
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>

              {role === 'business' ? (
                <Field label="Nom de l'entreprise" value={companyName} onChange={setCompanyName} placeholder="SARL Douala Logistics" />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nom complet" value={fullName} onChange={setFullName} placeholder="Jean Dupont" />
                  <Field label="Identifiant" value={handle} onChange={setHandle} placeholder="jean_d" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-ink">Pays</label>
                <div className="mt-1 grid grid-cols-3 gap-2">
                  {COUNTRIES.map((c) => (
                    <button key={c.code} type="button" onClick={() => setCountry(c.code)}
                      className={`min-h-tap rounded-xl border text-[11px] font-bold transition ${country === c.code ? 'border-brand bg-brand-50 text-brand-700' : 'border-line bg-white text-muted'}`}>
                      {c.label.split(' ')[0]} {c.code}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-ink">Adresse email</label>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@exemple.com"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-ink">Mot de passe</label>
            <input type="password" required autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none" />
          </div>

          {mode === 'signup' && (
            <label className="flex items-start gap-2 pt-1 text-[11px] text-muted">
              <input type="checkbox" required className="mt-0.5 accent-brand" />
              <span>J'accepte les <Link href="/legal#cgu" className="font-semibold text-brand underline">CGU</Link> et les conditions du <Link href="/legal#escrow" className="font-semibold text-brand underline">Séquestre</Link>.</span>
            </label>
          )}

          <button type="submit" disabled={loading}
            className="mt-2 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{mode === 'signup' ? 'Valider mon inscription' : 'Se connecter'} <ArrowRight className="h-3.5 w-3.5" /></>)}
          </button>
        </form>
      </div>

      <div className="py-4 text-center">
        <Link href="/" className="text-xs text-muted hover:text-ink">← Retour à l'accueil</Link>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-ink">{props.label}</label>
      <input type="text" required value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder={props.placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink placeholder-muted/60 focus:border-brand focus:outline-none" />
    </div>
  );
}
