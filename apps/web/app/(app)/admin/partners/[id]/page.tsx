import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, ChevronRight, ExternalLink, PauseCircle, ShieldCheck } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary, formatFcfa } from '@/i18n/dictionaries';
import { fill } from '@/lib/campaign-board';
import { formatPct } from '@/lib/founder';
import { adminPartnerOverview, campaignTitles, getSpecialties } from '@/lib/data/partner-gov';
import { specialtyLabels } from '@/lib/gov/specialties';
import { SmartAvatar } from '@/components/smart-avatar';
import { SectionTip } from '@/components/admin/section-tip';
import { MemberStatusPill } from '@/components/admin/member-status-pill';
import { DecisionPanel } from '@/components/admin/decision-panel';
import { Card, Chip, Muted } from '../_components/bits';
import { PartnerActions } from '../_components/partner-actions';
import { EndAssignment, LinkActions } from '../_components/row-actions';

export const dynamic = 'force-dynamic';

/** §1.2 partner overview: header, action bar, sections (one column; two from lg: work | governance). */
export default async function PartnerOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session, { locale, t }] = await Promise.all([params, getSession(), getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const [o, specs] = await Promise.all([adminPartnerOverview(id), getSpecialties()]);
  if (!o) notFound();
  const titles = await campaignTitles(o.assignments.map((a) => a.campaign_id ?? ''));
  const A = t.adminPartners;
  const M = t.admin.members;
  const loc = locale === 'en' ? 'en' : 'fr';
  const aria = t.admin.briefs.tips.aria;
  const tip = (k: keyof typeof A.tips, label: string) => <SectionTip id={`ap-${k}`} label={label} text={A.tips[k]} ariaTemplate={aria} />;
  const date = (iso: string | null | undefined) => (iso ? new Intl.DateTimeFormat(loc === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : '');
  const money = (n: number) => formatFcfa(n, locale);
  const p = o.partner;
  const openLinks = o.links.filter((l) => l.status === 'active' || l.status === 'pending' || l.status === 'invited');
  const pastLinks = o.links.filter((l) => !openLinks.includes(l));
  const activeAssign = o.assignments.filter((a) => a.status === 'active');
  const pastAssign = o.assignments.filter((a) => a.status !== 'active');
  const originLabel = (k: string) => (A.origin as Record<string, string>)[k] ?? k;
  const linkStatus = (k: string) => (A.linkStatus as Record<string, string>)[k] ?? k;
  const reqStatus = (k: string) => (A.requestStatus as Record<string, string>)[k] ?? k;
  const endStatus = (k: string) => (A.endStatus as Record<string, string>)[k] ?? k;
  const reasonLabel = (k: string | null) => (k ? (A.requests.reasons as Record<string, { label: string }>)[k]?.label ?? k : '');
  const flagState = (k: string) => (A.flagState as Record<string, string>)[k] ?? k;
  const kinds = (ks: string[], map: Record<string, string>) => ks.map((k) => map[k] ?? k).join(', ');

  const assignmentRow = (a: (typeof o.assignments)[number]) => {
    const ends = o.end_requests.filter((e) => e.assignment_id === a.id);
    return (
      <li key={a.id} className="min-w-0 border-t border-line pt-2 first:border-0 first:pt-0">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="min-w-0 truncate font-semibold">@{a.brand_handle}</span>
          <Chip tone={a.status === 'active' ? 'ok' : 'closed'}>{(A.status as Record<string, string>)[a.status] ?? a.status}</Chip>
          <Chip tone="brand">{originLabel(a.origin)}</Chip>
        </div>
        <p className="text-xs text-muted">{a.campaign_id ? fill(A.scope.campaign, { title: titles.get(a.campaign_id) ?? '…' }) : A.scope.brand} · {date(a.created_at)}{a.ended_at ? ` → ${date(a.ended_at)}` : ''}</p>
        {a.end_reason && <p className="text-xs text-muted [overflow-wrap:anywhere]">{fill(A.endedReason, { reason: a.end_reason === 'window_expired' ? t.messaging.header.expired : a.end_reason })}</p>}
        {ends.map((e) => (
          <p key={e.id} className="mt-1 rounded-lg bg-surface px-2 py-1 text-xs text-ink [overflow-wrap:anywhere]">
            {fill(A.endRequestRow, { reason: e.reason })} · {endStatus(e.status)}{e.decision_note ? ` · ${fill(A.decisionNote, { note: e.decision_note })}` : ''}
          </p>
        ))}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {a.conversation_id && <Link href={`/messages/${a.conversation_id}`} className="inline-flex min-h-tap items-center gap-1 text-xs font-bold text-brand-700">{A.assign.openThread} <ChevronRight className="h-3 w-3" aria-hidden /></Link>}
          {a.status === 'active' && <EndAssignment A={A} assignmentId={a.id} brand={`@${a.brand_handle}`} partnerId={p.id} />}
        </div>
      </li>
    );
  };

  return (
    <section className="min-w-0 space-y-4">
      <Link href="/admin/partners" className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {A.back}
      </Link>

      <header className="flex min-w-0 items-start gap-3">
        <SmartAvatar src={null} name={p.display_name} className="h-14 w-14 shrink-0 text-base" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-extrabold text-ink">{p.display_name}</h2>
          <p className="truncate text-xs text-muted">@{p.handle}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {p.directory_listed ? <Chip tone="ok">{A.chip.listed}</Chip> : <Chip tone="closed">{A.chip.delisted}</Chip>}
            <MemberStatusPill status={p.status} label={M.pill[p.status as keyof typeof M.pill] ?? p.status} />
            {p.payouts_on_hold && <Chip tone="blocked"><PauseCircle className="h-3 w-3" aria-hidden /> {A.chip.hold}</Chip>}
          </div>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="[overflow-wrap:anywhere]">{p.cgu_version ? fill(A.cgu.accepted, { version: p.cgu_version }) : A.cgu.missing}</span>
          </p>
          <Link href={`/admin/users/${p.id}?from=${encodeURIComponent('/admin/users')}`} className="mt-1 inline-flex min-h-[44px] items-center gap-1 text-xs font-bold text-brand-700">
            {A.memberLink} <ChevronRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      </header>

      <div className="space-y-3 rounded-2xl border border-line bg-white p-3 shadow-card">
        <PartnerActions A={A} partnerId={p.id} name={p.display_name} listed={p.directory_listed} fmt={loc}
          blocked={!p.directory_listed ? A.blocked.delisted : p.status === 'suspended' ? A.blocked.suspended : p.status === 'pending_review' ? A.blocked.pending : p.status === 'rejected' ? A.blocked.rejected : null} />
        <div className="border-t border-line pt-3">
          <DecisionPanel userId={p.id} name={p.display_name} status={p.status} warnings={0} L={M} mode="card" />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <Card title={A.section.links} tip={tip('links', A.section.links)}>
            {openLinks.length === 0 ? <Muted>{A.emptyLinks}</Muted> : (
              <ul className="space-y-2">
                {openLinks.map((l) => (
                  <li key={l.id} className="min-w-0 border-t border-line pt-2 first:border-0 first:pt-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="min-w-0 truncate font-semibold">@{l.creator_handle}</span>
                      <span className="text-xs tabular-nums text-ink">{formatPct(Number(l.commission_rate), loc)}</span>
                      <Chip tone={l.status === 'active' ? 'ok' : 'wait'}>{linkStatus(l.status)}</Chip>
                    </div>
                    {l.responded_at && <p className="text-xs text-muted">{fill(A.since, { date: date(l.responded_at) })}</p>}
                    {l.status === 'active' && <LinkActions A={A} linkId={l.id} creator={l.creator_handle} ratePct={formatPct(Number(l.commission_rate), loc).replace(/\s?%$/, '')} partnerId={p.id} />}
                  </li>
                ))}
              </ul>
            )}
            {pastLinks.length > 0 && (
              <details className="text-xs">
                <summary className="min-h-tap cursor-pointer py-2 font-bold text-brand-700">{fill(A.historyToggle, { n: pastLinks.length })}</summary>
                <ul className="space-y-1">{pastLinks.map((l) => <li key={l.id} className="text-muted">@{l.creator_handle} · {linkStatus(l.status)}{l.ended_at ? ` · ${date(l.ended_at)}` : ''}</li>)}</ul>
              </details>
            )}
          </Card>

          <Card title={A.section.deals}>
            {o.deals.length === 0 ? <Muted>{A.dealsEmpty}</Muted> : (
              <ul className="space-y-2">
                {o.deals.slice(0, 100).map((d) => (
                  <li key={d.id} className="min-w-0 border-t border-line pt-2 text-xs first:border-0 first:pt-0">
                    <p className="truncate font-semibold text-ink">{d.campaign_title}</p>
                    <p className="text-muted [overflow-wrap:anywhere]">@{d.creator_handle} · {(A.dealStatus as Record<string, string>)[d.status] ?? d.status} · {money(Number(d.agreed_payout_fcfa))}{d.commission_rate ? ` · ${formatPct(Number(d.commission_rate), loc)}` : ''}{d.applied_by_partner ? ` · ${A.dealsApplied}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={A.section.commissions} tip={tip('commissions', A.section.commissions)}>
            <p>{fill(A.commissions.line, { owed: money(o.commissions.owed_fcfa), paid: money(o.commissions.paid_fcfa), count: o.commissions.count })}</p>
            {p.payouts_on_hold && (
              <p className="rounded-xl bg-rose-50 p-2 text-[12px] text-rose-700">{A.commissions.hold} <Link href={`/admin/partners/flags?tab=self&partner=${p.id}`} className="font-bold underline">{A.section.flags}</Link></p>
            )}
          </Card>

          <Card title={A.section.retainers}>
            {o.retainers.length === 0 ? <Muted>{A.emptyRetainers}</Muted> : (
              <ul className="space-y-2">
                {o.retainers.map((r) => (
                  <li key={r.id} className="min-w-0 border-t border-line pt-2 text-xs first:border-0 first:pt-0">
                    <p className="font-semibold text-ink">@{r.brand_handle} · {(A.retainerStatus as Record<string, string>)[r.status] ?? r.status} · {money(Number(r.contract_value_fcfa))}</p>
                    {r.partner_accepted_at && <p className="text-muted">{fill(A.acceptedOn, { date: date(r.partner_accepted_at) })}</p>}
                    {r.settlements.map((s) => <p key={s.id} className="text-muted">{(A.settlement as Record<string, string>)[s.kind] ?? s.kind} · {money(Number(s.amount_fcfa))} · {(A.settlementStatus as Record<string, string>)[s.status] ?? s.status}</p>)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title={A.section.listing} tip={tip('listing', A.section.listing)}>
            <p className="[overflow-wrap:anywhere]">
              {p.directory_listed
                ? (p.listing_changed_at ? fill(A.listing.since, { date: date(p.listing_changed_at) }) : A.listing.listed)
                : fill(A.listing.delistedOn, { date: date(p.listing_changed_at), reason: p.listing_reason ?? '' })}
            </p>
          </Card>

          <Card title={A.section.specialties} tip={tip('specialties', A.section.specialties)}>
            {p.specialties.length === 0 ? <Muted>{t.specialties.none}</Muted> : (
              <div className="flex flex-wrap gap-1.5">{specialtyLabels(p.specialties, specs, loc).map((s) => <Chip key={s} tone="closed">{s}</Chip>)}</div>
            )}
            {p.specialties_legacy && (
              <p className="rounded-xl bg-surface p-2 text-[12px] text-muted [overflow-wrap:anywhere]">{fill(A.legacy, { values: p.specialties_legacy.join(', ') })}</p>
            )}
          </Card>

          <Card title={A.section.assignments} tip={tip('assignments', A.section.assignments)}>
            {o.assignments.length === 0 ? <Muted>{A.emptyAssignments}</Muted> : <ul className="space-y-2">{activeAssign.map(assignmentRow)}</ul>}
            {pastAssign.length > 0 && (
              <details>
                <summary className="min-h-tap cursor-pointer py-2 text-xs font-bold text-brand-700">{fill(A.historyToggle, { n: pastAssign.length })}</summary>
                <ul className="space-y-2">{pastAssign.map(assignmentRow)}</ul>
              </details>
            )}
          </Card>

          <Card title={A.section.requests}>
            {o.contact_requests.length === 0 ? <Muted>{A.emptyRequests}</Muted> : (
              <ul className="space-y-1 text-xs">
                {o.contact_requests.map((r) => (
                  <li key={r.id} className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span className="min-w-0 truncate font-semibold text-ink">@{r.brand_handle}</span>
                    <Chip tone={r.status === 'pending' ? 'wait' : r.status === 'declined' ? 'blocked' : r.status === 'approved' ? 'ok' : 'closed'}>{reqStatus(r.status)}</Chip>
                    {r.decision_reason_code && <span className="text-muted">{reasonLabel(r.decision_reason_code)}</span>}
                    <span className="text-muted">{date(r.created_at)}</span>
                    {r.status === 'pending' && <Link href="/admin/partners/requests" className="font-bold text-brand-700">›</Link>}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title={A.section.flags} tip={tip('flags', A.section.flags)}>
            <p>{fill(A.flags.line, { open: o.flags.open, n30: o.flags.last_30_days })}</p>
            {o.flags.recent.length === 0 && o.self_dealing.length === 0 ? <Muted>{A.emptyFlags}</Muted> : (
              <ul className="space-y-1 text-xs">
                {o.flags.recent.map((f) => (
                  <li key={f.id} className="text-muted [overflow-wrap:anywhere]">
                    {(A.flagSource as Record<string, string>)[f.source] ?? f.source} · {kinds(f.kinds, A.kinds as Record<string, string>)} · {fill(A.flags.count, { n: f.mask_count })} · {flagState(f.status)} · {date(f.created_at)}
                  </li>
                ))}
                {o.self_dealing.map((s) => (
                  <li key={s.id} className="text-rose-700 [overflow-wrap:anywhere]">
                    {kinds(s.kinds, A.selfKinds as Record<string, string>)} · {(A.selfSource as Record<string, string>)[s.source] ?? s.source} · {flagState(s.status)} · {date(s.created_at)}
                  </li>
                ))}
              </ul>
            )}
            <Link href={`/admin/partners/flags?partner=${p.id}`} className="inline-flex min-h-tap items-center gap-1 text-xs font-bold text-brand-700">{A.section.flags} <ExternalLink className="h-3 w-3" aria-hidden /></Link>
          </Card>
        </div>
      </div>
    </section>
  );
}
