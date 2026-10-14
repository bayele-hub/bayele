import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { getSpecialties, partnerByHandle } from '@/lib/data/partner-gov';
import { specialtyLabels } from '@/lib/gov/specialties';
import { SmartAvatar } from '@/components/smart-avatar';
import { RequestForm } from './request-form';

export const dynamic = 'force-dynamic';

/** §2.2 « Demander un partenaire » — only approved brands (O8), only listed active partners (G4). */
export default async function RequestPartnerPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  if (!session.roles.includes('business')) redirect('/dashboard');
  const R = t.partnerRequest;
  const handle = (sp.partner ?? '').replace(/^@/, '').trim();
  const [partner, specs] = await Promise.all([handle ? partnerByHandle(handle) : Promise.resolve(null), getSpecialties()]);
  const approved = session.profile?.status === 'active';

  return (
    <section className="mx-auto max-w-lg space-y-4">
      <Link href="/business/partners" className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {R.back}
      </Link>
      <h1 className="font-display text-2xl font-extrabold text-ink">{R.title}</h1>
      {!partner ? (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">{R.partnerUnavailable}</p>
      ) : !approved ? (
        <p className="rounded-xl bg-surface p-3 text-[13px] text-ink">
          {R.cta.notApproved} <Link href="/profile" className="font-bold text-brand-700 underline">{R.cta.completeProfile}</Link>
        </p>
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
            <SmartAvatar src={partner.avatar_url} name={partner.display_name} className="h-12 w-12 shrink-0 text-sm" />
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">{partner.display_name}</p>
              <p className="truncate text-xs text-muted">@{partner.handle}{partner.city ? ` · ${partner.city}` : ''}</p>
              {partner.specialties.length > 0 && (
                <p className="mt-1 line-clamp-2 text-xs text-ink [overflow-wrap:anywhere]">{specialtyLabels(partner.specialties, specs, locale === 'en' ? 'en' : 'fr').join(' · ')}</p>
              )}
            </div>
          </div>
          <RequestForm partnerId={partner.id} R={R} consentLabel={t.consent.request.label} readClause={t.consent.readClause} aria={t.admin.briefs.tips.aria} />
        </>
      )}
    </section>
  );
}
