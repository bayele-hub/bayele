import Link from 'next/link';
import { MapPin, Star } from 'lucide-react';
import { getDictionary } from '@/i18n/dictionaries';
import { COUNTRY_CODES, countryName, isCountryCode } from '@/lib/countries';
import { listConsultants } from '@/lib/data/talent';
import { getSpecialties, myAssignments, myContactRequests } from '@/lib/data/partner-gov';
import { getSession } from '@/lib/auth/session';
import { brandCtaState } from '@/lib/gov/rules';
import { SmartAvatar } from '@/components/smart-avatar';
import { SectionTip } from '@/components/admin/section-tip';

export async function TalentTabs({ active }: { active: 'creators' | 'partners' }) {
  const { t } = await getDictionary();
  const [creators, partners] = t.businessPartners.talentTabs;
  const cls = (on: boolean) => `inline-flex min-h-tap items-center rounded-lg px-4 text-sm font-bold ${on ? 'bg-white text-ink shadow-sm' : 'text-muted'}`;
  return (
    <nav aria-label={t.businessPartners.nav} className="inline-flex gap-1 rounded-xl bg-white/60 p-1 ring-1 ring-line">
      <Link href="/business/talent" aria-current={active === 'creators' ? 'page' : undefined} className={cls(active === 'creators')}>{creators}</Link>
      <Link href="/business/talent?tab=partners" aria-current={active === 'partners' ? 'page' : undefined} className={cls(active === 'partners')}>{partners}</Link>
    </nav>
  );
}

/** §2.1 partners tab: listed, active partners (public directory data) with the request CTA states. */
export async function PartnersTab({ userId, spec, country }: { userId: string; spec: string; country: string }) {
  const [{ locale, t }, session, specs] = await Promise.all([getDictionary(), getSession(), getSpecialties()]);
  const B = t.businessPartners;
  const R = t.partnerRequest;
  const c = isCountryCode(country) ? country : undefined;
  const [list, assignments, requests] = await Promise.all([listConsultants({ country: c, limit: 60 }), myAssignments(userId, 'brand'), myContactRequests(userId)]);
  const filtered = spec ? list.filter((p) => (p.specialtyCodes ?? []).includes(spec)) : list;
  const loc = locale === 'en' ? 'en' : 'fr';

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-extrabold text-ink">{B.directoryTitle}</h1>
      <form method="get" action="/business/talent" className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="hidden" name="tab" value="partners" />
        <label className="min-w-0"><span className="sr-only">{t.adminPartners.specialtyFilter}</span>
          <select name="spec" defaultValue={spec} className="min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm">
            <option value="">{B.allSpecialties}</option>
            {specs.map((s) => <option key={s.code} value={s.code}>{loc === 'fr' ? s.label_fr : s.label_en}</option>)}
          </select>
        </label>
        <label className="min-w-0"><span className="sr-only">{B.allCountries}</span>
          <select name="country" defaultValue={c ?? ''} className="min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm">
            <option value="">{B.allCountries}</option>
            {COUNTRY_CODES.map((k) => <option key={k} value={k}>{countryName(k, locale)}</option>)}
          </select>
        </label>
        <button className="inline-flex min-h-tap items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{B.filter}</button>
      </form>
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{B.directoryEmpty}</p>
      ) : (
        <ul className="grid min-w-0 gap-3 sm:grid-cols-2">
          {filtered.map((p) => {
            const asg = assignments.find((a) => a.partner_id === p.id && a.status === 'active');
            const state = brandCtaState({
              signedIn: true, roles: session.roles, status: session.profile?.status ?? null,
              pendingRequest: requests.some((r) => r.partner_id === p.id && r.status === 'pending'),
              activeAssignment: asg ? { conversationId: asg.conversation_id } : null,
            });
            return (
              <li key={p.id} className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex min-w-0 items-start gap-3">
                  <SmartAvatar src={p.avatarUrl} name={p.displayName} className="h-11 w-11 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/partners/${p.handle}`} className="relative -my-2.5 block truncate py-2.5 font-bold text-ink hover:underline">{p.displayName}</Link>
                    <p className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
                      <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{[p.city, countryName(p.country, locale)].filter(Boolean).join(', ')}</span></span>
                      <span className="inline-flex shrink-0 items-center gap-1"><Star className="h-3 w-3 fill-accent text-accent" aria-hidden /> {t.profile.new}</span>
                    </p>
                  </div>
                </div>
                {p.tags.length > 0 && (
                  <div className="mt-2">
                    <p className="flex items-center text-[11px] font-semibold text-muted">{t.specialties.publicHeading}<SectionTip id={`bt-spec-${p.id}`} label={t.specialties.publicHeading} text={t.specialties.publicTip} ariaTemplate={t.profile.tipAria} /></p>
                    <div className="mt-1 flex flex-wrap gap-1">{p.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{tag}</span>)}</div>
                  </div>
                )}
                <div className="mt-3 border-t border-line pt-3">
                  {state.kind === 'request' && <Link href={`/business/partners/request?partner=${encodeURIComponent(p.handle)}`} className="inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{R.cta.request}</Link>}
                  {state.kind === 'pending' && <Link href="/business/partners" className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-4 text-sm font-bold text-ink">{R.cta.sent}</Link>}
                  {state.kind === 'assigned' && state.conversationId && <Link href={`/messages/${state.conversationId}`} className="inline-flex min-h-tap items-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{R.cta.openThread}</Link>}
                  {state.kind === 'not_approved' && <p className="text-[12px] text-muted">{R.cta.notApproved}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
