import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Star, Briefcase, MapPin, ArrowUpRight, Globe, KeyRound } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SmartAvatar } from '@/components/smart-avatar';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { JsonLd } from '@/components/json-ld';
import { ProfileContactCTA } from '@/components/profile-contact-cta';
import { getConsultant, type ConsultantLink } from '@/lib/data/talent';
import { getDictionary } from '@/i18n/dictionaries';
import { personLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';

const FLAG: Record<'CM' | 'CI' | 'GA', string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const c = await getConsultant(handle);
  if (!c) return { title: 'Consultant introuvable', robots: { index: false } };
  const path = `/consultants/${c.handle}`;
  const description =
    c.bio ||
    `Confiez vos campagnes à ${c.displayName}, consultant média ${c.tags.slice(0, 3).join(', ')} à ${c.city} (${COUNTRY_NAME[c.country]}). Gestion et exécution sécurisées par séquestre sur ${SITE_NAME}.`;
  const title = `${c.displayName} (@${c.handle}) — Consultant`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'profile', title: `${c.displayName} · ${SITE_NAME}`, description, url: path },
    twitter: { card: 'summary_large_image', title: `${c.displayName} · ${SITE_NAME}`, description },
  };
}

function linkLabel(link: ConsultantLink, websiteLabel: string): string {
  return link.kind === 'website' ? websiteLabel : SOCIAL_META[link.kind as Platform].label;
}

export default async function ConsultantProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [{ t }, c] = await Promise.all([getDictionary(), getConsultant(handle)]);
  if (!c) notFound();

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          personLd({
            handle: c.handle,
            displayName: c.displayName,
            bio: c.bio,
            avatarUrl: c.avatarUrl,
            city: c.city,
            country: c.country,
            role: 'consultant',
            tags: c.tags,
            path: `/consultants/${c.handle}`,
          }),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Consultants', path: '/consultants' },
            { name: c.displayName, path: `/consultants/${c.handle}` },
          ]),
        ]}
      />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/consultants" className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {t.profile.backConsultants}
        </Link>

        {/* Hero */}
        <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <div className="h-24 bg-gradient-to-r from-brand-50 via-white to-accent-soft sm:h-28" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="rounded-full border-4 border-white shadow-sm">
                <SmartAvatar src={c.photoUrl} name={c.displayName} className="h-24 w-24 text-2xl sm:h-28 sm:w-28" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{c.displayName}</h1>
                  <span title={t.profile.verified} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> {t.profile.verified}
                  </span>
                  {c.agencyAccess && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                      <KeyRound className="h-3.5 w-3.5" /> {t.profile.agencyAccess}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted">@{c.handle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {c.city} {FLAG[c.country]}</span>
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-accent text-accent" /> {c.ratingAvg.toFixed(1)}</span>
                  <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5 text-brand" /> {c.yearsExperience} {t.profile.experience.toLowerCase()}</span>
                </div>
              </div>
              <ProfileContactCTA handle={c.handle} kind="consultant" primaryLabel={t.profile.hire} messageLabel={t.profile.message} />
            </div>

            {c.bio && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink/80">{c.bio}</p>}
          </div>
        </section>

        {/* Stats */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: t.profile.rating, value: c.ratingAvg.toFixed(1) },
            { label: t.profile.managedCampaigns, value: String(c.completedCampaigns) },
            { label: t.profile.experience, value: String(c.yearsExperience) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface px-4 py-5 text-center">
              <div className="font-display text-2xl font-extrabold text-ink">{s.value}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Expertise */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">{t.profile.expertiseHeading}</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {c.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-line bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">{tag}</span>
            ))}
          </div>
        </section>

        {/* Professional links */}
        {c.links.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-lg font-bold text-ink">{t.profile.linksHeading}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {c.links.map((link) => (
                <a key={link.kind} href={link.url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-white"
                      style={{ backgroundColor: link.kind === 'website' ? '#0B1B2B' : SOCIAL_META[link.kind as Platform].brand }}>
                      {link.kind === 'website' ? <Globe className="h-5 w-5" /> : <SocialIcon platform={link.kind as Platform} className="h-5 w-5" />}
                    </span>
                    <p className="text-sm font-bold text-ink">{linkLabel(link, t.profile.website)}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted transition group-hover:text-brand" />
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Client references */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">{t.profile.referencesHeading}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex aspect-[3/2] items-center justify-center rounded-2xl border border-line bg-gradient-to-br from-brand-50 to-accent-soft text-[12px] font-medium text-muted">
                {t.profile.referencesSoon}
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
