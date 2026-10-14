import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Search, TriangleAlert } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { COUNTRY_CODES, countryName } from '@/lib/countries';
import { fill, plural } from '@/lib/campaign-board';
import { listMembers, memberCounts } from '@/lib/data/admin-members';
import { MEMBER_ROLES, MEMBER_STATUSES, hasActiveFilters, membersHref, pageRange, parseMemberFilters } from '@/lib/admin-members';
import { cardWarnings } from '@/lib/member-quality';
import { MemberCard } from '@/components/admin/member-card';

export const dynamic = 'force-dynamic';

type SP = Record<string, string | string[] | undefined>;

/**
 * Admin « Membres » (design §A.3, D7): every filter lives in the URL (status, role, country, q,
 * « À vérifier », page), read on the server; 50 per page via admin_member_list; chip counts via
 * admin_member_counts. « À valider » is the default while members are waiting.
 */
export default async function AdminUsers({ searchParams }: { searchParams: Promise<SP> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const L = t.admin.members;

  const base = parseMemberFilters(sp);
  const preCounts = await memberCounts(base);
  const f = parseMemberFilters(sp, preCounts?.pending_review ?? 0);
  const page = await listMembers(f);
  const counts = page?.counts ?? preCounts;
  const allCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const here = membersHref(f);
  const range = page ? pageRange(f.page, page.total) : null;
  const flaggedHere = (page?.rows ?? []).filter((r) => cardWarnings({ city: r.city, displayName: r.display_name, roles: r.roles ?? [] }).length).length;
  const chip = 'inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-xs font-bold transition';
  const on = 'border-brand bg-brand text-white';
  const off = 'border-line bg-white text-ink hover:border-brand hover:text-brand';
  const filterWords = [f.role ? L.roleFilter[f.role] : null, f.country ? countryName(f.country, locale) : null, f.q ? `« ${f.q} »` : null, f.flag ? L.flagFilter : null].filter(Boolean);

  return (
    <section className="min-w-0 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-ink">{L.title}</h2>
        <p className="mt-0.5 text-xs text-muted">{L.subtitle}</p>
      </div>

      <form method="get" action="/admin/users" className="space-y-2">
        <input type="hidden" name="status" value={f.status ?? 'all'} />
        {f.flag && <input type="hidden" name="flag" value="1" />}
        <div className="flex min-w-0 gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">{L.search}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input type="search" name="q" defaultValue={f.q} placeholder={L.search}
              className="min-h-tap w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[16px] text-ink placeholder:text-muted focus:border-brand focus:outline-none sm:text-sm" />
          </label>
          <button type="submit" className="inline-flex min-h-tap shrink-0 items-center rounded-xl bg-brand px-4 text-xs font-bold text-white hover:bg-brand-600">{L.searchSubmit}</button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <label className="min-w-0">
            <span className="sr-only">{L.roleLabel}</span>
            <select name="role" defaultValue={f.role ?? ''} className="min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
              <option value="">{L.roleFilter.all}</option>
              {MEMBER_ROLES.map((r) => <option key={r} value={r}>{L.roleFilter[r]}</option>)}
            </select>
          </label>
          <label className="min-w-0">
            <span className="sr-only">{L.countryLabel}</span>
            <select name="country" defaultValue={f.country ?? ''} className="min-h-tap w-full rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
              <option value="">{L.countryAll}</option>
              {COUNTRY_CODES.map((c) => <option key={c} value={c}>{countryName(c, locale)}</option>)}
            </select>
          </label>
        </div>
      </form>

      <nav aria-label={L.statusFilter} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max items-center gap-2 sm:min-w-0 sm:flex-wrap">
          {MEMBER_STATUSES.map((s) => (
            <li key={s}>
              <Link scroll={false} href={membersHref(f, { status: s, page: 1 })} aria-current={f.status === s ? 'true' : undefined} className={`${chip} ${f.status === s ? on : off}`}>
                {L.status[s]} {counts && <span className={`tabular-nums ${f.status === s ? 'text-white/80' : 'text-muted'}`}>{counts[s]}</span>}
              </Link>
            </li>
          ))}
          <li>
            <Link scroll={false} href={membersHref(f, { status: null, page: 1 })} aria-current={f.status === null ? 'true' : undefined} className={`${chip} ${f.status === null ? on : off}`}>
              {L.status.all} {counts && <span className={`tabular-nums ${f.status === null ? 'text-white/80' : 'text-muted'}`}>{allCount}</span>}
            </Link>
          </li>
          <li>
            <Link scroll={false} href={membersHref(f, { flag: !f.flag, page: 1 })} aria-pressed={f.flag} className={`${chip} ${f.flag ? 'border-rose-700 bg-rose-700 text-white' : off}`}>
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {L.flagFilter}
            </Link>
          </li>
        </ul>
      </nav>

      {page === null ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{L.unavailable}</p>
      ) : (
        <>
          <p className="min-w-0 text-xs text-muted [overflow-wrap:anywhere]">
            <strong className="text-ink">{plural(page.total, L.countOne, L.countMany)}</strong>
            {counts && counts.pending_review > 0 && <> · {fill(L.countPending, { n: counts.pending_review })}</>}
            {flaggedHere > 0 && <> · {fill(L.countFlagged, { n: flaggedHere })}</>}
            {filterWords.length > 0 && <> · {filterWords.join(' · ')}</>}
            {hasActiveFilters(f) && (
              <>
                {' · '}
                <Link href={membersHref({ ...f, role: null, country: null, q: '', flag: false, page: 1 })} className="font-semibold text-brand-700 hover:text-brand">{L.clearFilters}</Link>
              </>
            )}
          </p>

          {page.rows.length === 0 ? (
            <div className="rounded-2xl border border-line bg-white p-10 text-center text-sm text-muted">
              {f.status === 'pending_review' && !hasActiveFilters(f) ? L.emptyPending : L.emptyFiltered}
            </div>
          ) : (
            <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
              {page.rows.map((r) => (
                <MemberCard
                  key={r.id}
                  L={L}
                  locale={locale}
                  back={here}
                  m={{
                    id: r.id, handle: r.handle, displayName: r.display_name, avatarUrl: r.avatar_url, city: r.city, country: r.country, status: r.status,
                    roles: r.roles ?? [], companyName: r.company_name, createdAt: r.created_at, resubmittedAt: r.resubmitted_at, openCorrection: r.open_correction,
                  }}
                />
              ))}
            </ul>
          )}

          {range && page.total > range.to - range.from + 1 && (
            <nav className="flex items-center justify-between gap-2 text-xs" aria-label={L.range}>
              {f.page > 1 ? <Link href={membersHref(f, { page: f.page - 1 })} className="inline-flex min-h-tap items-center font-bold text-brand-700">{L.prev}</Link> : <span />}
              <span className="tabular-nums text-muted">{fill(L.range, { from: range.from, to: range.to, total: page.total })}</span>
              {range.to < page.total ? <Link href={membersHref(f, { page: f.page + 1 })} className="inline-flex min-h-tap items-center font-bold text-brand-700">{L.next}</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </section>
  );
}
