import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import { adminMessageFlags, adminSelfDealing } from '@/lib/data/partner-gov';
import { SectionTip } from '@/components/admin/section-tip';
import { MaskedText } from '@/components/gov/masked-text';
import { HubRail } from '../_components/hub-rail';
import { Chip, age } from '../_components/bits';
import { OriginalReveal, ResolveFlag, SelfDealingDecide } from '../_components/flag-actions';

export const dynamic = 'force-dynamic';

const TABS = ['auto', 'report', 'self'] as const;
const STATES = ['open', 'done', 'all'] as const;
type Tab = (typeof TABS)[number];
type State = (typeof STATES)[number];

function href(tab: Tab, state: State, partner: string | null) {
  const p = new URLSearchParams();
  if (tab !== 'auto') p.set('tab', tab);
  if (state !== 'open') p.set('state', state);
  if (partner) p.set('partner', partner);
  const s = p.toString();
  return `/admin/partners/flags${s ? `?${s}` : ''}`;
}

/** §1.8 flags queue: masked details, reports, self-dealing; « Voir l'original » with a logged reason (P5). */
export default async function FlagsQueue({ searchParams }: { searchParams: Promise<{ tab?: string; state?: string; partner?: string }> }) {
  const [session, sp, { locale, t }] = await Promise.all([getSession(), searchParams, getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const A = t.adminPartners;
  const loc = locale === 'en' ? 'en' : 'fr';
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? '') ? (sp.tab as Tab) : 'auto';
  const state: State = (STATES as readonly string[]).includes(sp.state ?? '') ? (sp.state as State) : 'open';
  const partner = sp.partner && /^[0-9a-f-]{36}$/i.test(sp.partner) ? sp.partner : null;
  const kindsOf = (ks: string[], map: Record<string, string>) => ks.map((k) => map[k] ?? k);

  const msg = tab === 'self' ? null : await adminMessageFlags(state === 'open' ? 'open' : state === 'done' ? 'resolved' : null);
  const self = tab === 'self' ? await adminSelfDealing(state === 'open' ? 'open' : null) : null;
  const msgRows = (msg ?? []).filter((f) => (tab === 'auto' ? f.source === 'auto_mask' : f.source !== 'auto_mask')).filter((f) => !partner || f.partner_id === partner);
  const selfRows = (self ?? []).filter((f) => (state === 'done' ? f.status !== 'open' : true)).filter((f) => !partner || f.partner_id === partner);
  const failed = tab === 'self' ? self === null : msg === null;
  const empty = tab === 'self' ? selfRows.length === 0 : msgRows.length === 0;

  return (
    <section className="min-w-0 space-y-4">
      <h2 className="flex items-center text-sm font-bold text-ink">{A.hub[3]}<SectionTip id="ap-flagsq" label={A.hub[3]!} text={A.tips.flagsQueue} ariaTemplate={t.admin.briefs.tips.aria} /></h2>
      <HubRail active={3} labels={A.hub} />

      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1 rounded-xl bg-surface p-1">
          {TABS.map((k, i) => (
            <li key={k} className="flex items-center">
              <Link href={href(k, state, partner)} aria-current={tab === k ? 'page' : undefined}
                className={`inline-flex min-h-tap items-center whitespace-nowrap rounded-lg px-3 text-xs font-bold ${tab === k ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
                {A.flagsTabs[i]}
              </Link>
              {k === 'self' && tab === 'self' && <SectionTip id="ap-self" label={A.flagsTabs[2]!} text={A.tips.selfDealing} ariaTemplate={t.admin.briefs.tips.aria} />}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {STATES.map((s, i) => (
          <Link key={s} href={href(tab, s, partner)} aria-current={state === s ? 'page' : undefined}
            className={`inline-flex min-h-tap items-center rounded-full border px-3.5 text-xs font-bold ${state === s ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink'}`}>
            {A.flagStatus[i]}
          </Link>
        ))}
        {partner && <Link href={href(tab, state, null)} className="inline-flex min-h-tap items-center text-xs font-bold text-brand-700 underline">{A.flags.showAllPartners}</Link>}
      </div>

      {failed ? (
        <p className="rounded-2xl border border-line bg-white p-4 text-sm text-muted">{A.unavailable}</p>
      ) : empty ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-center text-sm text-muted">{A.flags.empty}</p>
      ) : tab === 'self' ? (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {selfRows.map((f) => (
            <li key={f.id} className="min-w-0">
              <article className="min-w-0 space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <time dateTime={f.created_at}>{age(f.created_at, A)}</time>
                  <Chip tone={f.status === 'open' ? 'blocked' : 'closed'}>{(A.flagState as Record<string, string>)[f.status]}</Chip>
                </div>
                <p className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">
                  <Link href={`/admin/partners/${f.partner_id}`} className="font-bold hover:underline">@{f.partner_handle}</Link>
                  {' ↔ '}{f.brand_company ? `${f.brand_company} (@${f.brand_handle})` : `@${f.brand_handle}`}
                </p>
                <div className="flex flex-wrap gap-1.5">{kindsOf(f.kinds, A.selfKinds as Record<string, string>).map((k) => <Chip key={k} tone="blocked">{k}</Chip>)}</div>
                <p className="text-xs text-muted">{(A.selfSource as Record<string, string>)[f.source] ?? f.source}{f.status !== 'cleared' ? ` · ${A.flags.holdNote}` : ''}</p>
                {f.note && <p className="text-xs text-muted [overflow-wrap:anywhere]">{fill(A.decisionNote, { note: f.note })}</p>}
                {f.status === 'open' && <div className="border-t border-line pt-3"><SelfDealingDecide A={A} flagId={f.id} /></div>}
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid min-w-0 gap-3 lg:grid-cols-2">
          {msgRows.map((f) => (
            <li key={f.id} className="min-w-0">
              <article className="min-w-0 space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                  <time dateTime={f.created_at}>{age(f.created_at, A)}</time>
                  {f.status !== 'open' && <Chip tone="closed">{(A.flagState as Record<string, string>)[f.status]}</Chip>}
                </div>
                <p className="min-w-0 text-sm text-ink [overflow-wrap:anywhere]">
                  {f.source === 'auto_mask'
                    ? fill(A.flags.sender, { handle: f.sender_handle ?? '—' })
                    : fill(A.flags.reportedBy, { handle: f.reported_by_handle ?? '—' })}
                </p>
                <p className="min-w-0 truncate text-xs text-muted">
                  <Link href={`/admin/partners/${f.partner_id}`} className="font-semibold hover:underline">{fill(A.flags.pair, { partner: f.partner_handle, brand: f.brand_handle ?? '—' })}</Link>
                </p>
                {f.kinds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {kindsOf(f.kinds, A.kinds as Record<string, string>).map((k) => <Chip key={k} tone="brand">{k}</Chip>)}
                    <span className="text-[11px] text-muted">{fill(A.flags.count, { n: f.mask_count })}</span>
                  </div>
                )}
                {f.report_reason && <p className="line-clamp-3 text-sm text-ink [overflow-wrap:anywhere]">« <MaskedText text={f.report_reason} /> »</p>}
                <p className="text-[11px] text-muted">{fill(A.flags.partner30, { n: f.partner_flags_30d })}</p>
                <div className="flex flex-wrap items-start gap-2 border-t border-line pt-3">
                  {f.conversation_id && (
                    <Link href={`/messages/${f.conversation_id}`} className="inline-flex min-h-tap items-center gap-1 rounded-xl px-2 text-xs font-bold text-brand-700">
                      {A.flags.openThread} <ChevronRight className="h-3 w-3" aria-hidden />
                    </Link>
                  )}
                  <OriginalReveal A={A} messageId={f.message_id} available={f.original_available} locale={loc} />
                  {f.status === 'open' && <ResolveFlag A={A} flagId={f.id} />}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
