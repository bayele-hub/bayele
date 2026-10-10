import Link from 'next/link';
import { AlarmClock, ArrowRight, ClipboardList, Eye, Plus, Search } from 'lucide-react';
import { getDictionary, formatFcfa, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { campaignStatuses, floorMap, listManagedBriefs, listPayFloors, type ManagedBriefRow } from '@/lib/data/managed-briefs';
import { COUNTRY_CODES, countryName, isCountryCode, type CountryCode } from '@/lib/countries';
import { fill, plural } from '@/lib/campaign-board';
import { fmtDeadline } from '@/components/campaign-brief-details';
import { languageLabel, managedNetPreview } from '@/lib/managed-listing';
import { ACTIVE_STAGES, PIPELINE, ageDays, isPipelineKey, isStale, matchesQuery, pipelineKey, sortBriefs, type PipelineKey } from '@/lib/managed-brief-state';
import { waMeHref } from '@/lib/whatsapp';
import { nudgeText } from '@/lib/managed-order-form';
import { WhatsAppTile } from '@/components/campaigns/card-parts';
import { FloorChip, StatusPill, rowChecklist } from './_components/brief-bits';

export const dynamic = 'force-dynamic';

type SP = { status?: string; q?: string; country?: string };

/**
 * « Briefs gérés » intake tracker (design §1). Server-rendered; the pipeline rail is the status filter
 * (links), search + country is a GET form (works without JS). Default view = the work queue (every
 * stage except published / declined), oldest action first.
 */
export default async function AdminBriefsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ locale, t }, sp] = await Promise.all([getDictionary(), searchParams]);
  const L = t.admin.briefs;
  const [rows, floorsRows] = await Promise.all([listManagedBriefs(), listPayFloors()]);
  const floors = floorMap(floorsRows);
  const statuses = await campaignStatuses((rows ?? []).map((r) => r.campaign_id).filter((x): x is string => !!x));

  const filter: PipelineKey | 'all' | null = sp.status === 'all' ? 'all' : isPipelineKey(sp.status) ? sp.status : null;
  const q = (sp.q ?? '').trim().slice(0, 80);
  const countryRaw = (sp.country ?? '').trim().toUpperCase();
  const country: CountryCode | null = isCountryCode(countryRaw) ? countryRaw : null;

  const all = (rows ?? []).map((r) => ({ row: r, key: pipelineKey(r, r.campaign_id ? statuses[r.campaign_id] : null) }));
  const counts = Object.fromEntries(PIPELINE.map((k) => [k, all.filter((x) => x.key === k).length])) as Record<PipelineKey, number>;
  const filtered = sortBriefs(
    all
      .filter((x) => (filter === 'all' ? true : filter ? x.key === filter : ACTIVE_STAGES.includes(x.key)))
      .filter((x) => !country || x.row.country === country)
      .filter((x) => matchesQuery(x.row, q))
      .map((x) => ({ ...x, updated_at: x.row.updated_at })),
    filter,
  );

  const href = (next: Partial<SP>) => {
    const p = new URLSearchParams();
    const st = 'status' in next ? next.status : sp.status;
    if (st) p.set('status', st);
    if (q) p.set('q', q);
    if (country) p.set('country', country);
    const s = p.toString();
    return s ? `/admin/briefs?${s}` : '/admin/briefs';
  };
  const clearSearchHref = (() => {
    const p = new URLSearchParams();
    if (sp.status) p.set('status', sp.status);
    if (country) p.set('country', country);
    const s = p.toString();
    return s ? `/admin/briefs?${s}` : '/admin/briefs';
  })();
  const chip = 'inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition';
  const on = 'border-brand bg-brand text-white';
  const off = 'border-line bg-white text-ink hover:border-brand hover:text-brand';

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">
            {L.title} {rows && rows.length > 0 && <span className="ml-1 font-semibold text-muted">· {plural(rows.length, L.countOne, L.countMany)}</span>}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{L.subtitle}</p>
          <Link href="/admin/pay-floors" className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand">
            {L.floorsLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
        <Link href="/admin/briefs/new" className="inline-flex min-h-tap w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-600 active:scale-95 sm:w-auto">
          <Plus className="h-4 w-4" aria-hidden /> {L.new}
        </Link>
      </div>

      {rows === null ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{L.empty.unavailable}</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand"><ClipboardList className="h-6 w-6" aria-hidden /></span>
          <h3 className="mt-3 font-display text-lg font-bold text-ink">{L.empty.title}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">{L.empty.body}</p>
          <Link href="/admin/briefs/new" className="mt-4 inline-flex min-h-tap items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-600">
            <Plus className="h-4 w-4" aria-hidden /> {L.new}
          </Link>
        </div>
      ) : (
        <>
          <nav aria-label={L.filterLabel} className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex min-w-max items-center gap-1.5 sm:min-w-0 sm:flex-wrap">
              <li>
                <Link scroll={false} href={href({ status: 'all' })} aria-current={filter === 'all' ? 'true' : undefined} className={`${chip} ${filter === 'all' ? on : off}`}>
                  {L.all} <span className={`tabular-nums ${filter === 'all' ? 'text-white/80' : 'text-muted'}`}>{rows.length}</span>
                </Link>
              </li>
              {PIPELINE.map((k) => (
                <li key={k} className="flex items-center gap-1.5">
                  <span aria-hidden className="text-muted">{k === 'declined' ? '·' : '›'}</span>
                  <Link scroll={false} href={href({ status: k })} aria-current={filter === k ? 'true' : undefined} className={`${chip} ${filter === k ? on : off}`}>
                    {L.statusShort[k]} <span className={`tabular-nums ${filter === k ? 'text-white/80' : 'text-muted'}`}>{counts[k]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <form method="get" action="/admin/briefs" className="flex flex-wrap gap-2">
            {filter && <input type="hidden" name="status" value={filter} />}
            <label className="relative min-w-0 flex-1">
              <span className="sr-only">{L.search}</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input name="q" defaultValue={q} placeholder={L.search} className="min-h-tap w-full rounded-xl border border-line bg-white pl-9 pr-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm" />
            </label>
            <label>
              <span className="sr-only">{t.admin.briefs.brand.country}</span>
              <select name="country" defaultValue={country ?? ''} className="min-h-tap rounded-xl border border-line bg-white px-3 text-[16px] text-ink focus:border-brand focus:outline-none sm:text-sm">
                <option value="">{L.allCountries}</option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c} value={c}>{countryName(c, locale)}</option>
                ))}
              </select>
            </label>
            <button type="submit" className="min-h-tap rounded-xl border border-line bg-white px-4 text-xs font-bold text-ink hover:border-brand hover:text-brand">{L.searchSubmit}</button>
          </form>

          {filtered.length === 0 ? (
            <p className="text-sm text-muted">
              {q ? fill(L.empty.search, { q }) : L.empty.filtered}{' '}
              <Link href={q ? clearSearchHref : '/admin/briefs?status=all'} className="inline-flex min-h-[44px] items-center font-semibold text-brand-700 hover:text-brand">
                {q ? L.empty.clearSearch : L.empty.showAll}
              </Link>
            </p>
          ) : (
            <ul className="grid gap-3">
              {filtered.map(({ row, key }) => (
                <BriefCard key={row.id} row={row} stage={key} t={t} locale={locale} floors={floors} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function BriefCard({ row, stage, t, locale, floors }: { row: ManagedBriefRow; stage: PipelineKey; t: Dictionary; locale: Locale; floors: ReturnType<typeof floorMap> }) {
  const L = t.admin.briefs;
  const days = ageDays(row.updated_at);
  const stale = isStale(stage, row.updated_at);
  const net = managedNetPreview(row.total_budget_fcfa, row.places, row.deliverable_count);
  const done = rowChecklist(row, floors);
  const deadline = fmtDeadline(row.deadline, locale);
  const contact = (row.contact_name ?? '').trim();
  const service = (row.title ?? row.service ?? '').trim();
  const nudgeKind = stage === 'awaiting_order' ? 'order' : stage === 'awaiting_payment' ? 'payment' : null;
  const nudge = nudgeKind && row.contact_whatsapp
    ? waMeHref(row.contact_whatsapp, nudgeText(nudgeKind, locale, { contact, service, total: net ? formatFcfa(net.totalFcfa, locale) : '' }))
    : null;
  const label = [row.brand_label?.trim(), row.city?.trim()].filter(Boolean).join(' · ');
  const [moneyBefore = '', moneyAfter = ''] = L.row.money.split('{net}');
  const facts = [row.country ? countryName(row.country, locale) : null, deadline ? fill(L.row.deadline, { date: deadline }) : null, row.language ? languageLabel(row.language, locale) : null].filter(Boolean);
  const btn = 'inline-flex min-h-tap items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition';
  const primary = `${btn} bg-brand text-white hover:bg-brand-600`;
  const secondary = `${btn} border border-line bg-white text-ink hover:border-brand hover:text-brand`;
  const open = `/admin/briefs/${row.id}`;
  const primaryAction: Record<PipelineKey, { label: string; href: string }> = {
    draft: { label: L.action.complete, href: open },
    awaiting_order: { label: L.action.recordYes, href: `${open}#field-yes` },
    ready: { label: L.action.publish, href: `${open}#publish` },
    awaiting_payment: { label: L.action.confirmFunding, href: row.campaign_id ? `/admin/funding?campaign=${row.campaign_id}` : open },
    published: { label: L.action.viewListing, href: row.campaign_id ? `/campaigns/${row.campaign_id}` : open },
    declined: { label: L.action.reopen, href: open },
  };

  return (
    <li>
      <article className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <StatusPill stage={stage} label={L.status[stage]} />
          <span className="flex items-center gap-1.5 text-[11px] text-muted">
            <time dateTime={row.updated_at}>{days === 0 ? L.row.ageToday : fill(L.row.age, { n: days })}</time>
            {stale && (
              <>
                <AlarmClock className="h-4 w-4 text-rose-600" aria-hidden />
                <span className="sr-only">{L.row.stale}</span>
              </>
            )}
          </span>
        </div>
        <Link href={open} className="mt-2 line-clamp-1 font-bold text-ink hover:text-brand">{row.brand_name}</Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Eye className="h-3.5 w-3.5" aria-hidden /> {L.row.public}{' '}
          {label ? <span className="font-semibold text-ink">{label}</span> : <span className="text-rose-600">{L.row.labelMissing}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.brand_consent ? 'bg-emerald-50 text-emerald-700' : 'bg-surface text-muted'}`}>
            {row.brand_consent ? L.row.consentReal : L.row.consentDescriptor}
          </span>
        </p>
        {service && <p className="mt-1 line-clamp-1 text-sm text-ink">{service}</p>}
        {facts.length > 0 && <p className="mt-0.5 text-xs text-muted">{facts.join(' · ')}</p>}

        <div className="mt-3 border-t border-line pt-3">
          {net && (
            <p className="text-xs tabular-nums text-muted">
              {fill(moneyBefore, { total: formatFcfa(net.totalFcfa, locale), places: row.places })}
              <span className="font-display text-sm font-extrabold text-ink">{formatFcfa(net.netPerPlaceFcfa, locale)}</span>
              {fill(moneyAfter, { total: formatFcfa(net.totalFcfa, locale), places: row.places })}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <FloorChip state={row.floor_check} labels={L.row} />
            <span className="flex items-center gap-2 text-[11px] text-muted">
              <span aria-hidden className="flex gap-px">
                {Array.from({ length: done.total }, (_, i) => (
                  <span key={i} className={`h-1.5 w-1.5 rounded-sm ${i < done.done ? 'bg-brand' : 'bg-line'}`} />
                ))}
              </span>
              {fill(L.row.fields, { done: done.done, total: done.total })}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={primaryAction[stage].href} className={primary}>{primaryAction[stage].label}</Link>
            {nudge ? (
              <a href={nudge} target="_blank" rel="noopener noreferrer" className={secondary}>
                <WhatsAppTile className="h-5 w-5" /> {L.action.nudge}
              </a>
            ) : stage !== 'draft' ? (
              <Link href={open} className={secondary}>{L.action.open}</Link>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
