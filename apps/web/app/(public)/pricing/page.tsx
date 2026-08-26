import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck, Star, Sparkles, ArrowRight, Lock, Clock, Handshake, Megaphone } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { getSession } from '@/lib/auth/session';
import { landingCtaHrefs } from '@/lib/auth/landing-ctas';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { JsonLd } from '@/components/json-ld';
import { breadcrumbLd } from '@/lib/seo';
import { computeBudget, fmtFcfa } from '@/lib/data/campaigns';
import { COMMISSION_TIERS, PRO_PLANS, MATCH_PASS_FCFA, SPOTLIGHT_WEEKLY_FCFA } from '@/lib/data/pricing';

export const metadata: Metadata = {
  title: 'Tarifs',
  description:
    "Commission transparente par campagne, séquestre Mobile Money inclus. Les créateurs fixent leur prix ; Bayele sécurise le paiement. Facturation OHADA, retraits MTN, Orange, Wave.",
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Tarifs — Bayele',
    description: 'Commission claire par campagne, séquestre inclus. Les créateurs fixent leur prix ; Bayele sécurise le paiement.',
    url: '/pricing',
  },
};

// Small presentational helpers -------------------------------------------------
function LiveTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> En vigueur
    </span>
  );
}
function SoonTag() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700">
      <Clock className="h-3 w-3" /> Bientôt
    </span>
  );
}

export default async function PricingPage() {
  const [{ t }, session] = await Promise.all([getDictionary(), getSession()]);
  const authed = !!session.userId;
  // Session-aware CTAs so a signed-in visitor is never pushed back into the signup funnel.
  const cta = landingCtaHrefs(authed);

  // Worked example, computed from the real money math (not hardcoded) — Managed tier, 100k pool.
  const managedRate = COMMISSION_TIERS.find((x) => x.id === 'managed')?.rate ?? 0.15;
  const example = computeBudget(100_000, 1, managedRate);

  const breadcrumb = breadcrumbLd([
    { name: 'Accueil', path: '/' },
    { name: 'Tarifs', path: '/pricing' },
  ]);

  return (
    <div className="bg-white">
      <JsonLd data={breadcrumb} />
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{ background: 'radial-gradient(46rem 24rem at 12% -10%, #EAF2FB 0%, transparent 55%), radial-gradient(38rem 22rem at 100% 0%, #FEF1DF 0%, transparent 50%)' }}
        />
        <div className="mx-auto max-w-3xl px-4 pb-6 pt-14 text-center sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Tarifs
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl font-display text-[2.3rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-[3rem]">
            Vous fixez le prix.<br />Bayele <span className="text-brand">sécurise le paiement</span><span className="brand-dot">.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base">
            Les créateurs fixent librement leur tarif. Bayele prélève une commission transparente sur chaque campagne —
            et cette commission finance le séquestre qui protège la marque comme le créateur.
          </p>
        </div>
      </section>

      {/* Commission tiers */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Commission par campagne</h2>
          <LiveTag />
        </div>
        <p className="mb-8 max-w-2xl text-sm text-muted">
          Le cœur du modèle. La marque finance la campagne ; le créateur touche l'intégralité de sa cagnotte ; Bayele
          conserve la commission, prélevée à l'intérieur du séquestre. Le taux est fixé une fois, à la création.
        </p>

        <div className="grid gap-4 lg:grid-cols-3">
          {COMMISSION_TIERS.map((tier) => {
            const featured = tier.featured;
            return (
              <div
                key={tier.id}
                className={`relative flex flex-col rounded-2xl border p-6 shadow-card ${
                  featured ? 'border-brand bg-brand text-white shadow-cardHover' : 'border-line bg-white'
                }`}
              >
                {featured && (
                  <span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-[11px] font-bold text-white">
                    Le plus choisi
                  </span>
                )}
                <div className={`font-display text-xl font-extrabold ${featured ? 'text-white' : 'text-ink'}`}>{tier.label}</div>
                <p className={`mt-1 min-h-[2.5rem] text-[13px] ${featured ? 'text-white/80' : 'text-muted'}`}>{tier.tagline}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-display text-5xl font-extrabold tracking-tight tabular-nums">{Math.round(tier.rate * 100)}</span>
                  <span className={`text-2xl font-extrabold ${featured ? 'text-white/90' : 'text-ink'}`}>%</span>
                </div>
                <p className={`mt-1 text-[13px] ${featured ? 'text-white/80' : 'text-muted'}`}>de la cagnotte créateurs</p>

                <ul className="mt-6 flex flex-1 flex-col gap-2.5">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className={`mt-0.5 h-4 w-4 shrink-0 ${featured ? 'text-white' : 'text-brand'}`} />
                      <span className={featured ? 'text-white/95' : 'text-ink'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={cta.heroPrimary}
                  className={`mt-6 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition active:scale-95 ${
                    featured ? 'bg-white text-brand hover:bg-white/90' : 'bg-brand text-white hover:bg-brand-600'
                  }`}
                >
                  {authed ? t.hero.ctaDashboard : 'Lancer une campagne'} <ArrowRight className="h-4 w-4" />
                </Link>
                <p className={`mt-3 text-center text-[11px] ${featured ? 'text-white/70' : 'text-muted'}`}>{tier.footnote}</p>
              </div>
            );
          })}
        </div>

        <p className="mt-6 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-muted">
          <b className="text-ink">Exemple.</b> Une cagnotte de {fmtFcfa(100_000)} en Managed ({Math.round(managedRate * 100)} %) → la marque
          finance <span className="font-semibold text-ink">{fmtFcfa(example.total)}</span>, le créateur touche{' '}
          <span className="font-semibold text-ink">{fmtFcfa(example.pool)}</span>, Bayele conserve{' '}
          <span className="font-semibold text-ink">{fmtFcfa(example.fee)}</span>.
        </p>
      </section>

      {/* Bayele Pro */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Bayele Pro</h2>
          <SoonTag />
        </div>
        <p className="mb-8 max-w-2xl text-sm text-muted">
          Un abonnement mensuel, pensé par audience. Il ne remplace pas la commission — il la réduit et débloque la
          visibilité et les badges premium.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {PRO_PLANS.map((plan) => (
            <div key={plan.id} className="flex flex-col rounded-2xl border border-line bg-white p-6 shadow-card">
              <div className="flex items-center justify-between gap-3">
                <div className="font-display text-lg font-extrabold text-ink">{plan.name}</div>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-bold text-brand-700">{plan.audience}</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">{plan.blurb}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold tracking-tight tabular-nums text-ink">{fmtFcfa(plan.priceMonthlyFcfa)}</span>
                <span className="text-sm font-medium text-muted">/mois</span>
              </div>
              <p className="mt-1 text-[12px] text-muted">soit {fmtFcfa(plan.priceYearlyFcfa)}/an — 2 mois offerts</p>

              <ul className="mt-5 flex flex-1 flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-ink">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" /> <span>{f}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6 inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface px-5 text-sm font-semibold text-muted">
                <Clock className="h-4 w-4" /> Bientôt disponible
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mise en relation */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Mise en relation</h2>
          <SoonTag />
        </div>
        <div className="grid items-center gap-6 rounded-2xl border border-line bg-white p-6 shadow-card sm:grid-cols-[auto_1fr]">
          <div>
            <div className="font-display text-4xl font-extrabold tracking-tight tabular-nums text-brand">{fmtFcfa(MATCH_PASS_FCFA)}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">par contact</div>
          </div>
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
              <Handshake className="h-4 w-4 text-brand" /> Débloquer un contact direct
            </h3>
            <p className="mt-1.5 text-sm text-muted">
              Un frais unique pour ouvrir un fil sécurisé avec un créateur choisi dans l'annuaire — utile pour tester une
              collaboration avant d'engager un budget de campagne. Le fil reste encadré par Bayele. Inclus sans frais dans
              Bayele Pro Marques.
            </p>
          </div>
        </div>
      </section>

      {/* Badges & visibilité */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Badges &amp; visibilité</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[13px] font-bold text-emerald-700">
              <ShieldCheck className="h-4 w-4" /> Vérifié
            </span>
            <div className="mt-3 font-display text-xl font-extrabold text-ink">Gratuit <span className="text-sm font-normal text-muted">· toujours</span></div>
            <p className="mt-1 text-[13px] text-muted">
              Accordé par la modération Bayele après contrôle. C'est un signal de confiance — le vendre le viderait de son sens.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[13px] font-bold text-white">
              <Star className="h-4 w-4" /> Pro
            </span>
            <div className="mt-3 font-display text-xl font-extrabold text-ink">Inclus <span className="text-sm font-normal text-muted">· dans l'abonnement</span></div>
            <p className="mt-1 text-[13px] text-muted">
              Distingue un profil abonné : placement prioritaire, portfolio enrichi. Un badge de service, pas de confiance.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-bold text-accent">
              <Sparkles className="h-4 w-4" /> Spotlight
            </span>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="font-display text-xl font-extrabold tabular-nums text-ink">{fmtFcfa(SPOTLIGHT_WEEKLY_FCFA)}</span>
              <span className="text-sm text-muted">/ semaine</span>
              <span className="ml-1"><SoonTag /></span>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Mise en avant ponctuelle en tête d'annuaire. Vend de la visibilité, jamais de la crédibilité.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-r-xl border-l-4 border-accent bg-accent-soft px-4 py-3">
          <p className="text-[13px] text-ink">
            <b>Notre règle :</b> la confiance ne s'achète pas, la visibilité peut se financer. « Vérifié » reste gratuit ;
            le revenu passe par la visibilité (Pro, Spotlight), jamais par un badge qui simule un contrôle.
          </p>
        </div>
      </section>

      {/* What the commission funds — escrow */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink">Ce que la commission finance</h2>
          <LiveTag />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h3 className="mb-5 font-display text-lg font-bold text-ink">Le séquestre, de bout en bout</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: '01', t: 'La marque finance', d: 'Fonds bloqués en séquestre via Mobile Money.', I: Lock },
              { n: '02', t: 'Le créateur publie', d: 'Preuve de publication déposée et vérifiée.', I: Megaphone },
              { n: '03', t: 'Bayele valide', d: 'Contrôle proof-of-post, séquestre libérable.', I: ShieldCheck },
              { n: '04', t: 'Paiement instantané', d: 'Versement MTN, Orange ou Wave au créateur.', I: Check },
            ].map((s) => (
              <div key={s.n}>
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand"><s.I className="h-4 w-4" /></span>
                  <span className="font-display text-xs font-bold text-brand">{s.n}</span>
                </div>
                <div className="mt-2 text-sm font-bold text-ink">{s.t}</div>
                <div className="mt-0.5 text-[12.5px] text-muted">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1.5 text-[12.5px] text-muted">
          <span><b className="text-ink">Devise :</b> XAF (CM, GA) · XOF (CI)</span>
          <span><b className="text-ink">Retraits :</b> dès 1 000 FCFA vers MTN, Orange Money, Wave</span>
          <span><b className="text-ink">Facturation :</b> OHADA, générée automatiquement</span>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-4">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-line bg-brand px-6 py-10 text-center text-white shadow-cardHover">
          <h2 className="font-display text-2xl font-extrabold tracking-tight">Prêt à lancer votre première campagne&nbsp;?</h2>
          <p className="max-w-md text-sm text-white/85">Pas d'abonnement requis pour démarrer. Vous ne payez que la commission, séquestre inclus.</p>
          <Link
            href={cta.heroPrimary}
            className="inline-flex min-h-tap items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-brand transition hover:bg-white/90 active:scale-95"
          >
            {authed ? t.hero.ctaDashboard : 'Commencer'} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
