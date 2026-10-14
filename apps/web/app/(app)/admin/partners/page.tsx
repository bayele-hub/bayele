import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight, MapPin, Search, Flag, PauseCircle } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { countryName } from '@/lib/countries';
import { fill } from '@/lib/campaign-board';
import { ADMIN_PAGE, adminPartnerList, getSpecialties, parsePartnerFilters, partnersHref, type ListingFilter } from '@/lib/data/partner-gov';
import { specialtyLabels } from '@/lib/gov/specialties';
import { SmartAvatar } from '@/components/smart-avatar';
import { MemberStatusPill } from '@/components/admin/member-status-pill';
import { HubRail } from './_components/hub-rail';
import { Chip, age } from './_components/bits';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/** §1.1 admin partner list: URL filters (listing, q, spec, page), 50 per page via admin_partner_list. */
export default async function AdminPartners({ searchParams }: { searchParams: Promise<SP> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const A = t.adminPartners;
  const M = t.admin.members;
  const f = parsePartnerFilters(sp);
  const [page, specs] = await Promise.all([adminPartnerList(f), getSpecialties()]);
  const total = page?.total ?? 0;
  const from = total ? (f.page - 1) * ADMIN_PAGE + 1 : 0;
  const to = Math.min(total, f.page * ADMIN_PAGE);
  const loc = locale === 'en' ? 'en' : 'fr';
  const chips: [ListingFilter, string][] = [['all', A.filter.all], ['listed', A.filter.listed], ['delisted', A.filter.delisted], ['suspended', A.filter.suspended], ['pending', A.filter.pending]];
  const active = f.listing !== 'all' || !!f.q || !!f.spec;
  const words = [f.listing !== 'all' ? chips.find((c) => c[0] === f.listing)?.[1] : null, f.q ? `« ${f.q} »` : null, f.spec ? specialtyLabels([f.spec], specs, loc)[0] : null].filter(Boolean);

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="text-sm font-bold text-ink">{A.title}</h2>
      <HubRail active={0} labels={A.hub} />

      <form method="get" action="/admin/partners" className="grid gap-2 sm:grid-cols-[1fr_14rem_auto]">
        {f.listing !== 'all' && <input type="hidden" name="listing" value={f.listing} />}
        <label className="relative min-w-0">
          <span className="sr-only">{A.searchLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input name="q" defaultValue={f.q} placeholder={A.search} className="min-h-tap w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
        </label>
        <label className="min-w-0">
          <span className="sr-only">{A.specialtyFilter}</span>
          <select name="spec" defaultValue={f.spec ?? ''} className="min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink sm:text-sm">
            <option value="">{A.specialtyAll}</option>
            {specs.map((s) => <option key={s.code} value={s.code}>{loc === 'fr' ? s.label_fr : s.label_en}</option>)}
          </select>
        </label>
        <button className="inline-flex min-h-tap items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-white">{A.searchSubmit}</button>
      </form>

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2">
          {chips.map(([k, label]) => (
            <li key={k}>
              <Link href={partnersHref(f, { listing: k, page: 1 })} aria-current={f.listing === k ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center whitespace-nowrap rounded-full border px-3.5 text-xs font-bold ${f.listing === k ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-brand'}`}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted [overflow-wrap:anywhere]">
        <strong className="text-ink">{total === 1 ? A.countOne : fill(A.countMany, { n: total })}</strong>
        {words.length > 0 && <> · {words.join(' · ')}</>}
        {active && <> · <Link href="/admin/partners" className="font-bold text-brand-700 underline">{A.clearFilters}</Link></>}
      </p>

      {!page ? (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">{A.unavailable}</p>
      ) : page.rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-center">
          <p className="text-sm text-muted">{A.empty}</p>
          {active && <Link href="/admin/partners" className="mt-2 inline-flex min-h-tap items-center text-sm font-bold text-brand-700">{A.clearFilters}</Link>}
        </div>
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {page.rows.map((p) => {
            const flags = Number(p.open_flags) + Number(p.open_self_dealing);
            const href = `/admin/partners/${p.id}`;
            return (
              <li key={p.id} className="min-w-0">
                <article className="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">
                  <div className="flex min-w-0 items-start gap-3">
                    <SmartAvatar src={p.avatar_url} name={p.display_name} className="h-10 w-10 shrink-0 text-sm" />
                    <div className="min-w-0 flex-1">
                      <Link href={href} className="relative -my-2.5 block truncate py-2.5 font-bold text-ink hover:underline">{p.display_name}</Link>
                      <p className="flex min-w-0 items-center gap-1 text-xs text-muted">
                        <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">@{p.handle} · {[p.city, countryName(p.country, locale)].filter(Boolean).join(', ')}</span>
                      </p>
                    </div>
                    <time dateTime={p.created_at} className="shrink-0 whitespace-nowrap text-[11px] text-muted">{age(p.created_at, A)}</time>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {p.directory_listed ? <Chip tone="ok">{A.chip.listed}</Chip> : <Chip tone="closed">{A.chip.delisted}</Chip>}
                    <MemberStatusPill status={p.status} label={M.pill[p.status as keyof typeof M.pill] ?? p.status} />
                    {p.payouts_on_hold && <Chip tone="blocked"><PauseCircle className="h-3 w-3" aria-hidden /> {A.chip.hold}</Chip>}
                    {flags > 0 && <Chip tone="blocked"><Flag className="h-3 w-3" aria-hidden /> {flags}<span className="sr-only"> {A.chip.flagsSr}</span></Chip>}
                    {Number(p.open_end_requests) > 0 && <Chip tone="wait">{A.chip.endRequested}</Chip>}
                  </div>
                  {p.specialties.length > 0 && (
                    <p className="mt-2 line-clamp-1 text-xs text-ink [overflow-wrap:anywhere]">{specialtyLabels(p.specialties, specs, loc).join(' · ')}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">{fill(A.cardCounts, { c: p.creators_active, a: p.assignments_active })}</p>
                  <div className="mt-3 border-t border-line pt-2">
                    <Link href={href} className="inline-flex min-h-tap items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand">
                      {A.card.open} <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {total > ADMIN_PAGE && (
        <nav className="flex flex-wrap items-center justify-between gap-2 text-xs" aria-label={A.title}>
          {f.page > 1 ? <Link href={partnersHref(f, { page: f.page - 1 })} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-3 font-bold text-ink">{A.prev}</Link> : <span />}
          <span className="text-muted tabular-nums">{fill(A.range, { from, to, total })}</span>
          {to < total ? <Link href={partnersHref(f, { page: f.page + 1 })} className="inline-flex min-h-tap items-center rounded-xl border border-line bg-white px-3 font-bold text-ink">{A.next}</Link> : <span />}
        </nav>
      )}
    </section>
  );
}
