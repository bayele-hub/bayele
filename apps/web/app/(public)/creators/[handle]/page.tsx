import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BadgeCheck, Star, Users, MapPin, ArrowUpRight } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { SmartAvatar } from '@/components/smart-avatar';
import { SocialIcon, SOCIAL_META } from '@/components/social-icons';
import { JsonLd } from '@/components/json-ld';
import { ProfileContactCTA } from '@/components/profile-contact-cta';
import { getCreator } from '@/lib/data/talent';
import { getDictionary, formatFollowers } from '@/i18n/dictionaries';
import { personLd, breadcrumbLd, COUNTRY_NAME, SITE_NAME } from '@/lib/seo';

const FLAG: Record<'CM' | 'CI' | 'GA', string> = { CM: '🇨🇲', CI: '🇨🇮', GA: '🇬🇦' };

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params;
  const creator = await getCreator(handle);
  if (!creator) return { title: 'Créateur introuvable', robots: { index: false } };
  const path = `/creators/${creator.handle}`;
  const description =
    creator.bio ||
    `Collaborez avec ${creator.displayName}, créateur ${creator.tags.slice(0, 3).join(', ')} à ${creator.city} (${COUNTRY_NAME[creator.country]}). Campagnes rémunérées et sécurisées par séquestre sur ${SITE_NAME}.`;
  const title = `${creator.displayName} (@${creator.handle}) — Créateur`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'profile', title: `${creator.displayName} · ${SITE_NAME}`, description, url: path },
    twitter: { card: 'summary_large_image', title: `${creator.displayName} · ${SITE_NAME}`, description },
  };
}

export default async function CreatorProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const [{ locale, t }, creator] = await Promise.all([getDictionary(), getCreator(handle)]);
  if (!creator) notFound();

  return (
    <div className="min-h-screen bg-white">
      <JsonLd
        data={[
          personLd({
            handle: creator.handle,
            displayName: creator.displayName,
            bio: creator.bio,
            avatarUrl: creator.avatarUrl,
            city: creator.city,
            country: creator.country,
            role: 'creator',
            tags: creator.tags,
            path: `/creators/${creator.handle}`,
          }),
          breadcrumbLd([
            { name: 'Accueil', path: '/' },
            { name: 'Créateurs', path: '/creators' },
            { name: creator.displayName, path: `/creators/${creator.handle}` },
          ]),
        ]}
      />
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/creators" className="inline-flex min-h-tap items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> {t.profile.back}
        </Link>

        {/* Profile hero */}
        <section className="mt-4 overflow-hidden rounded-3xl border border-line bg-white shadow-card">
          <div className="h-24 bg-gradient-to-r from-brand-50 via-white to-accent-soft sm:h-28" />
          <div className="px-5 pb-6 sm:px-8">
            <div className="-mt-12 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="rounded-full border-4 border-white shadow-sm">
                <SmartAvatar src={creator.photoUrl} name={creator.displayName} className="h-24 w-24 text-2xl sm:h-28 sm:w-28" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{creator.displayName}</h1>
                  <span title={t.profile.verified} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">
                    <BadgeCheck className="h-3.5 w-3.5" /> {t.profile.verified}
                  </span>
                </div>
                <p className="text-sm text-muted">@{creator.handle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {creator.city} {FLAG[creator.country]}</span>
                  <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-accent text-accent" /> {creator.ratingAvg.toFixed(1)}</span>
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5 text-brand" /> {formatFollowers(creator.audienceSize ?? 0, locale)} {t.directory.followers}</span>
                </div>
              </div>
              <ProfileContactCTA handle={creator.handle} kind="creator" primaryLabel={t.profile.invite} messageLabel={t.profile.message} />
            </div>

            {creator.bio && <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink/80">{creator.bio}</p>}

            <div className="mt-4 flex flex-wrap gap-1.5">
              {creator.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-surface px-2.5 py-1 text-[12px] font-medium text-ink/70">{tag}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: t.profile.totalAudience, value: formatFollowers(creator.audienceSize ?? 0, locale) },
            { label: t.profile.rating, value: creator.ratingAvg.toFixed(1) },
            { label: t.profile.campaigns, value: String(creator.completedCampaigns) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-line bg-surface px-4 py-5 text-center">
              <div className="font-display text-2xl font-extrabold text-ink">{s.value}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted">{s.label}</div>
            </div>
          ))}
        </section>

        {/* Social media */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">{t.profile.socialsHeading}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creator.socials.map((s) => (
              <a key={s.platform} href={s.url} target="_blank" rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl"
                    style={{ backgroundColor: SOCIAL_META[s.platform].brand, color: SOCIAL_META[s.platform].fg ?? '#fff' }}>
                    <SocialIcon platform={s.platform} className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">{SOCIAL_META[s.platform].label}</p>
                    <p className="text-[12px] text-muted">{formatFollowers(s.followers, locale)} {t.directory.followers}</p>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted transition group-hover:text-brand" />
              </a>
            ))}
          </div>
        </section>

        {/* Content preview */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-ink">{t.profile.contentHeading}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-gradient-to-br from-brand-50 to-accent-soft text-[12px] font-medium text-muted">
                {t.profile.contentSoon}
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
