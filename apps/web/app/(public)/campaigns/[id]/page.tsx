import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Coins, MapPin, Users, ShieldCheck, Megaphone } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { JsonLd } from '@/components/json-ld';
import { CampaignApplyCTA } from '@/components/campaign-apply-cta';
import { getPublicCampaign } from '@/lib/data/public-campaigns';
import { fmtFcfa } from '@/lib/data/campaigns';
import { jobPostingLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';

const FLAG: Record<'CM' | 'CI' | 'GA', string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const c = await getPublicCampaign(id);
  if (!c) return { title: 'Campagne introuvable', robots: { index: false } };
  const path = `/campaigns/${c.id}`;
  const title = `${c.title} — Campagne ${c.category} · ${fmtFcfa(c.payoutPerCreatorFcfa)}/créateur`;
  const description =
    c.brief ||
    `${c.brandName} recrute des créateurs pour une campagne ${c.category} en ${COUNTRY_NAME[c.country]}. ${fmtFcfa(c.payoutPerCreatorFcfa)} par créateur, paiement sécurisé par séquestre sur ${SITE_NAME}.`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', title: `${c.title} · ${SITE_NAME}`, description, url: path },
    twitter: { card: 'summary_large_image', title: `${c.title} · ${SITE_NAME}`, description },
  };
}

export default async function PublicCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getPublicCampaign(id);
  if (!c) notFound();

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          jobPostingLd({
            id: c.id,
            title: c.title,
            description: c.brief,
            datePosted: c.createdAt,
            country: c.country,
            payoutFcfa: c.payoutPerCreatorFcfa,
            brandName: c.brandName,
            path: `/campaigns/${c.id}`,
          }),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Campagnes', path: '/campaigns' },
            { name: c.title, path: `/campaigns/${c.id}` },
          ]),
        ]}
      />
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link href="/creators" className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Découvrir Bayele
        </Link>

        <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <div className="h-20 bg-gradient-to-r from-brand-50 via-white to-accent-soft" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-8 flex items-center gap-3">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border-4 border-white bg-brand text-white shadow-sm">
                <Megaphone className="h-7 w-7" />
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-brand-700">{c.category}</span>
              <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                <MapPin className="h-3.5 w-3.5" /> {COUNTRY_NAME[c.country]} {FLAG[c.country]}
              </span>
            </div>

            <h1 className="mt-2 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{c.title}</h1>
            <p className="mt-1 text-sm text-muted">
              Proposée par <span className="font-semibold text-ink">{c.brandName}</span>
            </p>

            {c.brief && <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-ink/80">{c.brief}</p>}

            <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
              <div className="rounded-2xl border border-line bg-surface px-4 py-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Coins className="h-3.5 w-3.5 text-accent" /> Rémunération</div>
                <div className="mt-1 font-display text-lg font-extrabold text-ink">{fmtFcfa(c.payoutPerCreatorFcfa)}</div>
                <div className="text-[11px] text-muted">par créateur</div>
              </div>
              <div className="rounded-2xl border border-line bg-surface px-4 py-4">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted"><Users className="h-3.5 w-3.5 text-brand" /> Créateurs recherchés</div>
                <div className="mt-1 font-display text-lg font-extrabold text-ink">{c.creatorCountTarget}</div>
                <div className="text-[11px] text-muted">places</div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4 shrink-0" /> Paiement garanti : les fonds sont déjà sous séquestre. Vous êtes payé dès la validation de votre publication.
            </div>

            <div className="mt-5">
              <CampaignApplyCTA campaignId={c.id} />
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted">
          Bayele — la marketplace d&apos;influence sécurisée par séquestre.{' '}
          <Link href="/" className="font-semibold text-brand hover:underline">En savoir plus</Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
