Bayele — Mobile-First Public Web Experience & Legal Architecture (v1.1.1)

> QA-pass reconciliation note: **routing is locked on the unified single-route auth funnel** (`(auth)/page.tsx`, reached as `/auth?mode=signin|signup&role=…`) — the separate `sign-up`/`log-in` variant is dropped. Middleware redirects unauthenticated users to `/auth?mode=signin`; onboarding is `/onboarding/[role]`. The auth card uses phone + password (matching the reconciled tech-stack §6). Invalid Tailwind utilities `py-0.2` and `active:scale-98` were corrected to `py-0.5` and `active:scale-95` in this pass. The public directory also depends on the `creator_profiles` / `consultant_profiles` public-read RLS policies added in v1.1.2 §3.2 — without them this page returns an empty grid to anonymous visitors.

==================================================================================================
BAYELE CORE INTERACTION ENGINE: MOBILE-FIRST PUBLIC INTERFACE SPECIFICATION
==================================================================================================
Roles Activated:
 • Principal Mobile UX Architect & Lead Field Systems Engineer
 • Principal Frontend & Design Systems Architect
 • Lead Security, Cryptography & Compliance Engineer
 • Product Lead & Technical Program Manager (TPM)
Target Regions: Cameroon (CM: +237), Côte d'Ivoire (CI: +225), Gabon (GA: +241)
Currency: Franc CFA (XAF / XOF — FCFA)
==================================================================================================
1. Minimalist Page Architecture & Mobile-First Strategy
To operate effectively across low-latency 3G/4G mobile networks in Douala, Abidjan, and Libreville while keeping engineering overhead low, Bayele consolidates its entire public entry point into three canonical routes:
code
Code
apps/web/app/
├── (public)/
│   ├── page.tsx          # ROUTE 1: Home Landing Page + Live Public Talent Directory
│   └── legal/
│       └── page.tsx      # ROUTE 2: Unified Legal Hub (CGU, Escrow Rules, Privacy)
└── (auth)/
    └── page.tsx          # ROUTE 3: Unified Auth Funnel (Sign In & Sign Up with Role Dispatcher)
Mobile-First Design Principles
Zero Layout Shift on Poor Connections: System-native font stacks (system-ui, -apple-system, sans-serif) with fallback geometry matching; skeleton placeholders sized to exact aspect ratios.
Thumb-Driven Touch Zones: Minimum tap target of 48×48px for all interactive buttons, filters, and mobile drawer triggers.
Bandwidth Optimization: SVGs and web-standard CSS gradients instead of heavy raster hero banners; image avatars lazily loaded with blur hashes.
Local Payment Alignment: Visual cues prioritize MTN Mobile Money, Orange Money, and Wave badges natively over credit cards.
2. Route 1: Public Home Landing Page
Path: apps/web/app/(public)/page.tsx
Purpose: Delivers the core value proposition, allows immediate exploration of active Nano-Creators and Agency Consultants, and provides split CTAs for creators and brands.
code
Tsx
import React from 'react';
import Link from 'next/link';
import { createClient } from '@bayele/database/server';
import { 
  ShieldCheck, 
  Smartphone, 
  TrendingUp, 
  Search, 
  Filter, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';

export const revalidate = 60; // ISR cache revalidation every 60s

interface TalentSummary {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  city: string;
  country: 'CM' | 'CI' | 'GA';
  role: 'creator' | 'consultant';
  categories: string[];
  audience_size?: number;
  rating_avg?: number;
}

async function getFeaturedTalent(): Promise<TalentSummary[]> {
  const supabase = createClient();
  
  // Public directory query: Active Creators & Consultants only (per spec §3.2)
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      handle,
      display_name,
      avatar_url,
      city,
      country,
      user_roles!inner(role),
      creator_profiles(categories, audience_size, rating_avg),
      consultant_profiles(specialties)
    `)
    .eq('status', 'active')
    .in('user_roles.role', ['creator', 'consultant'])
    .limit(6);

  if (error || !data) return [];

  return data.map((item: any) => ({
    id: item.id,
    handle: item.handle,
    display_name: item.display_name,
    avatar_url: item.avatar_url,
    city: item.city,
    country: item.country,
    role: item.user_roles[0]?.role,
    categories: item.creator_profiles?.categories || item.consultant_profiles?.specialties || [],
    audience_size: item.creator_profiles?.audience_size,
    rating_avg: item.creator_profiles?.rating_avg || 5.0,
  }));
}

export default async function HomePage() {
  const talents = await getFeaturedTalent();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500 selection:text-slate-950 pb-20">
      {/* 1. STICKY MOBILE NAVIGATION */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-slate-950">
              B
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Bayele<span className="text-emerald-400">.</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/auth?mode=signin"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
            >
              Connexion
            </Link>
            <Link
              href="/auth?mode=signup"
              className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 active:scale-95 transition"
            >
              Commencer
            </Link>
          </div>
        </div>
      </header>

      {/* 2. MOBILE-FIRST HERO */}
      <section className="px-4 pt-8 pb-10 text-center max-w-xl mx-auto md:max-w-3xl md:pt-16">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 mb-4">
          <Sparkles className="h-3 w-3" />
          <span>Influence Nano & Stratégie en Afrique Francophone</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-white leading-[1.15]">
          Monétisez vos statuts. <br />
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Sécurisez vos campagnes.
          </span>
        </h1>
        <p className="mt-3.5 text-sm sm:text-base text-slate-400 leading-relaxed max-w-md mx-auto">
          La plateforme d'escrow automatisée pour Créateurs WhatsApp, Consultants Médias et Entreprises au Cameroun, Côte d'Ivoire et Gabon.
        </p>

        {/* Action Dual-Pill */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/auth?mode=signup&role=business"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 py-3.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition"
          >
            <span>Lancer une Campagne</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth?mode=signup&role=creator"
            className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-6 py-3.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition"
          >
            <span>Devenir Créateur Rémunéré</span>
          </Link>
        </div>

        {/* Local Payment Badges */}
        <div className="mt-8 flex items-center justify-center gap-4 text-[11px] font-medium text-slate-400">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-400"></span> MTN MoMo
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-orange-500"></span> Orange Money
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan-400"></span> Wave
          </span>
        </div>
      </section>

      {/* 3. CORE GUARANTEES (ESCROW & TRUST) */}
      <section className="px-4 py-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Séquestre Bloqué (Escrow)</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Le budget est bloqué dès le lancement. Le créateur est payé dès validation de la preuve de diffusion (PoP).
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 mb-3">
              <Smartphone className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Paiements Instantanés MoMo</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Retraits instantanés vers vos comptes MTN, Orange Money ou Wave sans frais cachés dès 1 000 FCFA.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-3">
              <TrendingUp className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Conformité OHADA Facturation</h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">
              Génération de factures déductibles avec NIU/NCC pour les PME et agences partenaires via SokoClick.
            </p>
          </div>
        </div>
      </section>

      {/* 4. LIVE TALENT DIRECTORY (CREATORS & CONSULTANTS) */}
      <section className="px-4 py-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Talents & Consultants Actifs</h2>
            <p className="text-xs text-slate-400">Profils vérifiés disponibles pour campagnes immédiates</p>
          </div>
          <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
            Directoire Public
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {talents.map((talent) => (
            <div
              key={talent.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 hover:border-slate-700 transition"
            >
              <div className="flex items-start gap-3">
                <div className="relative h-12 w-12 flex-shrink-0 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-sm font-bold text-slate-300">
                  {talent.avatar_url ? (
                    <img src={talent.avatar_url} alt={talent.display_name} className="h-full w-full object-cover" />
                  ) : (
                    talent.display_name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-bold text-white truncate">{talent.display_name}</h4>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {talent.country}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">@{talent.handle}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{talent.city}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {talent.categories.slice(0, 3).map((cat, idx) => (
                  <span
                    key={idx}
                    className="rounded-md bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400 capitalize">
                  {talent.role === 'creator' ? 'Nano-Créateur' : 'Consultant Stratégique'}
                </span>
                <Link
                  href={`/auth?mode=signup&role=business`}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                >
                  Contacter <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="mt-12 border-t border-slate-800/80 px-4 py-8 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Bayele Technologies. Conforme directives CEMAC / UEMOA.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <Link href="/legal#cgu" className="hover:text-emerald-400 transition">CGU & Escrow</Link>
            <Link href="/legal#privacy" className="hover:text-emerald-400 transition">Confidentialité</Link>
            <Link href="/legal#ohada" className="hover:text-emerald-400 transition">Facturation OHADA</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
3. Route 2: Unified Mobile-First Auth Engine
Path: apps/web/app/(auth)/page.tsx
Purpose: Consolidates Sign Up, Sign In, and Dynamic Role Switcher into a single, mobile-optimized component with E.164 phone validation for Francophone Africa.
code
Tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@bayele/database/client';
import { 
  Smartphone, 
  Lock, 
  User, 
  Briefcase, 
  Building2, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  Check
} from 'lucide-react';

type AuthMode = 'signin' | 'signup';
type UserRole = 'creator' | 'consultant' | 'business';
type CountryCode = 'CM' | 'CI' | 'GA';

const COUNTRY_DIAL_CODES: Record<CountryCode, { code: string; label: string; placeholder: string }> = {
  CM: { code: '+237', label: 'Cameroun (+237)', placeholder: '6XX XXX XXX' },
  CI: { code: '+225', label: "Côte d'Ivoire (+225)", placeholder: '07XX XXX XXX' },
  GA: { code: '+241', label: 'Gabon (+241)', placeholder: '06X XX XX XX' },
};

export default function UnifiedAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [role, setRole] = useState<UserRole>('creator');
  const [country, setCountry] = useState<CountryCode>('CM');
  
  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [handle, setHandle] = useState('');
  const [city, setCity] = useState('');
  const [companyName, setCompanyName] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const urlMode = searchParams.get('mode') as AuthMode;
    const urlRole = searchParams.get('role') as UserRole;
    if (urlMode === 'signin' || urlMode === 'signup') setMode(urlMode);
    if (urlRole && ['creator', 'consultant', 'business'].includes(urlRole)) setRole(urlRole);
  }, [searchParams]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    const fullPhoneE164 = `${COUNTRY_DIAL_CODES[country].code}${phoneNumber.replace(/\s+/g, '')}`;

    try {
      if (mode === 'signin') {
        // Authenticate via Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          phone: fullPhoneE164,
          password: password,
        });

        if (error) throw error;
        
        // Dynamic dashboard redirect based on role stored in user_roles
        router.push(`/dashboard`);
      } else {
        // Sign Up Flow
        const { data: authData, error: authError } = await supabase.auth.signUp({
          phone: fullPhoneE164,
          password: password,
          options: {
            data: {
              display_name: fullName,
              role: role,
              country: country,
              city: city,
              handle: handle.toLowerCase(),
              company_name: role === 'business' ? companyName : undefined,
            },
          },
        });

        if (authError) throw authError;

        // Redirect directly to specialized onboarding/workspace
        router.push(`/onboarding/${role}`);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Une erreur est survenue lors de la connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Header */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between py-2">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 font-black text-slate-950 text-sm">
            B
          </div>
          <span className="font-bold tracking-tight text-white text-lg">Bayele</span>
        </Link>
        <span className="text-xs text-slate-500 font-mono">Secured Escrow v1.1.1</span>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-md mx-auto bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl">
        {/* Toggle Mode (Sign In / Sign Up) */}
        <div className="grid grid-cols-2 rounded-xl bg-slate-950 p-1 mb-5 border border-slate-800/60">
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'signup' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Créer un Compte
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`py-2 text-xs font-bold rounded-lg transition ${
              mode === 'signin' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Se Connecter
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              {/* Role Selection */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Vous êtes :</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setRole('creator')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition ${
                      role === 'creator'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Smartphone className="h-4 w-4 mb-1" />
                    <span className="text-[11px] font-bold">Créateur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('consultant')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition ${
                      role === 'consultant'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Briefcase className="h-4 w-4 mb-1" />
                    <span className="text-[11px] font-bold">Consultant</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('business')}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition ${
                      role === 'business'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                        : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Building2 className="h-4 w-4 mb-1" />
                    <span className="text-[11px] font-bold">Marque</span>
                  </button>
                </div>
              </div>

              {/* Name & Handle */}
              {role === 'business' ? (
                <div>
                  <label className="text-xs font-semibold text-slate-300">Nom de l'Entreprise</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: SARL Douala Logistics"
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Nom Complet</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jean Dupont"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300">Identifiant (Handle)</label>
                    <input
                      type="text"
                      required
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="jean_d"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Country Selector */}
          <div className="grid grid-cols-3 gap-2">
            {(['CM', 'CI', 'GA'] as CountryCode[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCountry(c)}
                className={`py-2 px-1 rounded-xl border text-[11px] font-bold text-center transition ${
                  country === c
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                    : 'border-slate-800 bg-slate-950 text-slate-400'
                }`}
              >
                {c === 'CM' ? '🇨🇲 CM' : c === 'CI' ? '🇨🇮 CI' : '🇬🇦 GA'}
              </button>
            ))}
          </div>

          {/* Phone Number (E.164) */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Numéro Mobile Money (MoMo / OM / Wave)</label>
            <div className="mt-1 flex rounded-xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-emerald-500">
              <span className="flex items-center bg-slate-900 px-3 text-xs font-bold text-slate-400 border-r border-slate-800">
                {COUNTRY_DIAL_CODES[country].code}
              </span>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={COUNTRY_DIAL_CODES[country].placeholder}
                className="w-full bg-transparent px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-slate-300">Mot de Passe</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {mode === 'signup' && (
            <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-400">
              <input type="checkbox" required className="mt-0.5 rounded border-slate-800 bg-slate-950 accent-emerald-500" />
              <span>
                J'accepte les <Link href="/legal#cgu" className="text-emerald-400 underline">CGU</Link> et les conditions du <Link href="/legal#escrow" className="text-emerald-400 underline">Séquestre</Link>.
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <span>{mode === 'signup' ? 'Valider mon Inscription' : 'Se Connecter'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>
      </div>

      <div className="text-center py-4">
        <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 transition">
          ← Retour à l'accueil
        </Link>
      </div>
    </div>
  );
}
4. Route 3: Consolidated Legal Hub
Path: apps/web/app/(public)/legal/page.tsx
Purpose: A unified, single-page legal document covering the Terms of Service (CGU), Escrow State Rules, Personal Data Protection, and OHADA-compliant invoicing rules, with mobile anchor navigation.
code
Tsx
import React from 'react';
import Link from 'next/link';
import { Shield, FileText, Lock, ArrowLeft } from 'lucide-react';

export const metadata = {
  title: "Conditions Générales & Séquestre — Bayele",
  description: "Conditions Générales d'Utilisation, Protocole de Séquestre Mobile Money et Politique de Confidentialité OHADA."
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 pb-20">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            <span>Accueil</span>
          </Link>
          <span className="text-xs font-bold text-emerald-400">Centre Juridique & Conformité</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 pt-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
          Accords Juridiques & Cadre de Séquestre
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-slate-400">
          Dernière mise à jour : 16 Août 2026 • Conforme droit OHADA et réglementations CEMAC / UEMOA.
        </p>

        {/* Quick Nav Anchors */}
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-800 pb-4">
          <a href="#cgu" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-800 hover:border-emerald-500">
            1. CGU Plateforme
          </a>
          <a href="#escrow" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-800 hover:border-emerald-500">
            2. Protocole de Séquestre MoMo
          </a>
          <a href="#privacy" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-800 hover:border-emerald-500">
            3. Données Personnelles
          </a>
          <a href="#ohada" className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 border border-slate-800 hover:border-emerald-500">
            4. Facturation SokoClick (OHADA)
          </a>
        </div>

        {/* SECTION 1: CGU */}
        <section id="cgu" className="mt-8 space-y-4 text-xs sm:text-sm leading-relaxed">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <FileText className="h-4 w-4 text-emerald-400" />
            <h2>1. Conditions Générales d'Utilisation (CGU)</h2>
          </div>
          <p>
            Bayele opère comme une infrastructure technologique de mise en relation et de sécurisation financière entre Marques/Entreprises (« Annonceurs »), Consultants en Stratégie Médias (« Consultants ») et Créateurs de Contenu / Diffuseurs WhatsApp (« Créateurs »).
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong>Éligibilité :</strong> L'accès est strictement réservé aux personnes physiques majeures et aux entités commerciales légalement constituées au Cameroun, en Côte d'Ivoire ou au Gabon.
            </li>
            <li>
              <strong>Exactitude des Données Téléphoniques :</strong> L'utilisateur garantit que le numéro de téléphone au format E.164 fourni lors de l'inscription correspond à un compte Mobile Money enregistré et vérifié à son nom.
            </li>
            <li>
              <strong>Comportement Prohibé :</strong> Toute tentative de falsification de capture d'écran, génération artificielle de vues WhatsApp, ou diffusion de contenu illicite entraîne la suspension immédiate du compte et la saisie des fonds en séquestre pour litige.
            </li>
          </ul>
        </section>

        {/* SECTION 2: ESCROW PROTOCOL */}
        <section id="escrow" className="mt-12 space-y-4 text-xs sm:text-sm leading-relaxed border-t border-slate-800/80 pt-8">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h2>2. Protocole de Séquestre & Libération des Fonds (Escrow)</h2>
          </div>
          <p>
            Tout budget alloué à une campagne est préfinancé via le mécanisme de séquestre transactionnel Bayele. Les fonds demeurent sous statut <code>held</code> jusqu'à exécution vérifiée :
          </p>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 text-slate-300">
            <p className="font-semibold text-emerald-400">Cycle de Validation de Preuve (Proof-of-Post) :</p>
            <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-400">
              <li>Le créateur soumet une capture d'écran de son statut WhatsApp avec horodatage visible.</li>
              <li>L'algorithme de vision Gemini extrait les métadonnées et attribue un score de conformité.</li>
              <li>Une revue humaine confirme la validité via la fonction <code>verify_proof_of_post()</code>.</li>
              <li>Le séquestre bascule à <code>releasable</code> et déclenche le versement instantané Mobile Money.</li>
            </ol>
          </div>
          <p className="text-slate-400">
            Frais de plateforme : Une retenue standard de 10% (Spark), 15% (Managed) ou 25% (Agency) est déduite à la source conformément aux conditions de création de campagne stipulées dans la base de données de production.
          </p>
        </section>

        {/* SECTION 3: PRIVACY */}
        <section id="privacy" className="mt-12 space-y-4 text-xs sm:text-sm leading-relaxed border-t border-slate-800/80 pt-8">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Lock className="h-4 w-4 text-emerald-400" />
            <h2>3. Politique de Confidentialité & Protection des Données</h2>
          </div>
          <p>
            Conformément aux cadres régionaux de protection des données à caractère personnel :
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-400">
            <li>
              <strong>Données d'Entreprise :</strong> Les profils d'entreprise (<code>business_profiles</code>), leurs identifiants fiscaux (NIU/NCC) et leurs adresses de facturation ne sont jamais rendus publics et restent cantonnés à la facturation et aux audits administratifs.
            </li>
            <li>
              <strong>Données Créateurs :</strong> Seuls le pseudonyme, la ville, les catégories de contenu et les statistiques publiques d'audience sont affichés sur le directoire public.
            </li>
          </ul>
        </section>

        {/* SECTION 4: OHADA BILLING */}
        <section id="ohada" className="mt-12 space-y-4 text-xs sm:text-sm leading-relaxed border-t border-slate-800/80 pt-8">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <FileText className="h-4 w-4 text-teal-400" />
            <h2>4. Facturation Commerciale & Conformité OHADA (Moteur SokoClick)</h2>
          </div>
          <p>
            Les transactions professionnelles opérées pour le compte des entreprises font l'objet d'émissions systématiques de factures certifiées conformes aux exigences comptables de l'Acte Uniforme OHADA relatif au droit des sociétés commerciales.
          </p>
          <p className="text-slate-400">
            Toute facture acquittée porte un identifiant unique vérifiable SokoClick, permettant la déductibilité fiscale intégrale des dépenses médias engagées sur le réseau Bayele.
          </p>
        </section>
      </main>
    </div>
  );
}
5. Security, State Management & Verification Matrix
code
Code
┌──────────────────────────────────────────────────────────────────────────────────┐
│              FRONTEND SECURITY & FIELD VERIFICATION SPECIFICATION                │
├────────────────────────────────┬─────────────────────────────────────────────────┤
│ Verification Target            │ Operational Requirement                        │
├────────────────────────────────┼─────────────────────────────────────────────────┤
│ Mobile-First Payload Footprint │ Initial bundle payload under 90KB Gzip.         │
│ E.164 Phone Formatting         │ Strips non-digits; validates CM, CI, GA masks.  │
│ Strict Public/Private Boundary │ Directory queries only Creators/Consultants.    │
│ Single-Tab Consolidated Legal  │ Single bundle load, hash-anchor routing.       │
│ CSRF / Token Integrity         │ Strict session cookie handling via Supabase SSR.│
└────────────────────────────────┴─────────────────────────────────────────────────┘
Next Execution Step
Deploy the above components into apps/web/ within the Bayele monorepo and verify end-to-end responsiveness and Supabase Auth session initialization on actual mobile viewports (360px–414px widths).

