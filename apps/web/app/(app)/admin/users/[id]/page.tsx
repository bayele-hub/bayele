import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { ArrowLeft, ExternalLink, TriangleAlert } from 'lucide-react';
import { getSession } from '@/lib/auth/session';
import { getDictionary, formatFcfa, type Dictionary } from '@/i18n/dictionaries';
import type { Locale } from '@/i18n/config';
import { getMemberDetail } from '@/lib/data/admin-members';
import { countOf, safeMembersBack, type AdminMemberDetail } from '@/lib/admin-members';
import { memberWarnings, type WarningKey } from '@/lib/member-quality';
import { countryName } from '@/lib/countries';
import { fill } from '@/lib/campaign-board';
import { providerLabel } from '@/lib/data/campaigns';
import { SmartAvatar } from '@/components/smart-avatar';
import { SocialIcon, SOCIAL_META, type Platform } from '@/components/social-icons';
import { SectionTip } from '@/components/admin/section-tip';
import { MemberStatusPill } from '@/components/admin/member-status-pill';
import { MaskedValue } from '@/components/admin/masked-value';
import { DecisionPanel } from '@/components/admin/decision-panel';

export const dynamic = 'force-dynamic';

type L = Dictionary['admin']['members'];
const ROLE_ORDER = ['super_admin', 'business', 'consultant', 'creator'] as const;
const KNOWN: Platform[] = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];
// Server checklist items that duplicate a client warning (shown once).
const SERVER_DUP: Record<string, WarningKey> = { no_platform: 'noSocials', no_payout_number: 'noPayout', no_avatar: 'noAvatar', no_billing_email: 'businessNoBilling' };

/**
 * Admin member detail (design §A.4, D2/D7): any role, any status, before and after approval. One read
 * (admin_member_detail, logged once per admin/member/day); sensitive values arrive masked and are
 * revealed one by one with a reason (logged every time). Decisions go through the sticky bar.
 */
export default async function MemberDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ from?: string }> }) {
  const [{ id }, sp, session, { locale, t }] = await Promise.all([params, searchParams, getSession(), getDictionary()]);
  if (!session.userId) redirect('/auth?mode=signin');
  const d = await getMemberDetail(id);
  if (!d) notFound();
  const L = t.admin.members;
  const p = d.profile;
  const aria = t.admin.briefs.tips.aria;
  const date = (iso: string | null | undefined) =>
    iso ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso)) : null;
  const money = (n: number) => formatFcfa(n, locale);
  const roles = ROLE_ORDER.filter((r) => p.roles.includes(r));

  const clientWarn = memberWarnings({
    city: p.city, displayName: p.display_name, roles: p.roles,
    platforms: d.creator ? d.creator.platforms : undefined, audienceSize: d.creator?.audience_size,
    hasPayout: d.creator ? d.creator.payout.phone.present : d.partner ? d.partner.payout.phone.present : undefined,
    hasAvatar: !!p.avatar_url, defaultRating: !!(d.creator || d.partner),
    hasBillingEmail: d.business ? d.business.billing_email.present : undefined,
  });
  const serverWarn = d.checklist.filter((c) => !(SERVER_DUP[c] && clientWarn.includes(SERVER_DUP[c]!)));
  const warnTexts = [...clientWarn.map((w) => L.warn[w]), ...serverWarn.map((c) => L.warn[c as keyof L['warn']] ?? c)];
  const blocking = clientWarn.filter((w) => w !== 'defaultRating').length + serverWarn.length;
  const source = d.attribution?.signup_source ?? 'none';
  const sourceLabel = L.source[source as keyof L['source']] ?? source;
  const colon = locale === 'fr' ? '\u00a0:' : ':';
  const [open, close] = locale === 'fr' ? ['«\u00a0', '\u00a0»'] : ['"', '"'];
  const publicPath = roles.includes('creator') ? `/creators/${p.handle}` : roles.includes('consultant') ? `/partners/${p.handle}` : null;

  return (
    <section className="min-w-0 space-y-4">
      <Link href={safeMembersBack(sp.from)} className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {L.back}
      </Link>

      <header className="flex min-w-0 items-start gap-3">
        <SmartAvatar src={p.avatar_url} name={p.display_name} className="h-14 w-14 shrink-0 text-base" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-extrabold text-ink">{p.display_name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {roles.map((r) => <span key={r} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{L.role[r]}</span>)}
            <MemberStatusPill status={p.status} label={L.pill[p.status] ?? p.status} />
          </div>
          <p className="mt-1 text-xs text-muted [overflow-wrap:anywhere]">
            @{p.handle} · {fill(L.joined, { date: date(p.created_at) ?? '' })} · {fill(L.via, { source: sourceLabel })}
          </p>
          {p.resubmitted_at && <p className="mt-0.5 text-xs font-semibold text-ink">{fill(L.resubmitted, { date: date(p.resubmitted_at) ?? '' })}</p>}
          {d.moderation.open_correction && (
            <p className="mt-0.5 text-xs font-semibold text-ink">{fill(L.correctionOpen, { date: date(d.moderation.open_correction.requested_at) ?? '' })}</p>
          )}
        </div>
      </header>

      {warnTexts.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <p className="flex items-center gap-1.5 font-bold">
            <TriangleAlert className="h-4 w-4" aria-hidden /> {warnTexts.length === 1 ? L.warningsTitleOne : fill(L.warningsTitleMany, { n: warnTexts.length })}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 [overflow-wrap:anywhere]">
            {warnTexts.map((w) => <li key={w}>{w}</li>)}
          </ul>
          <p className="mt-1 text-rose-700">{L.warningsHint}</p>
        </div>
      )}

      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Card title={L.section.identity} tip={<SectionTip id="member-identity" label={L.section.identity} text={L.tips.identity} ariaTemplate={aria} />}>
            <Dl>
              <Item label={L.field.displayName}>{p.display_name}</Item>
              <Item label={L.field.handle}>
                {p.status === 'active' && publicPath ? (
                  <Link href={publicPath} target="_blank" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand">
                    @{p.handle} <ExternalLink className="h-3 w-3" aria-hidden />
                  </Link>
                ) : (
                  <>@{p.handle} <span className="block text-[11px] text-muted">{L.publicHidden}</span></>
                )}
              </Item>
              <Item label={L.field.roles}>{roles.map((r) => L.role[r]).join(', ') || L.notSet}</Item>
              {p.avatar_url && (
                <Item label={L.fix.avatar}>
                  <a href={p.avatar_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:text-brand">{L.reveal}</a>
                </Item>
              )}
              <Item label={L.field.bio} wide>{p.bio ? <span className="whitespace-pre-line">{p.bio}</span> : <NotSet L={L} />}</Item>
            </Dl>
          </Card>

          <Card title={L.section.location} tip={<SectionTip id="member-location" label={L.section.location} text={L.tips.location} ariaTemplate={aria} />}>
            <Dl>
              {/* city · country on one line so a mismatch (« Kayes · Cameroun ») catches the eye */}
              <Item label={`${L.field.city} · ${L.field.country}`} wide>{[p.city || null, countryName(p.country, locale)].filter(Boolean).join(' · ')}</Item>
            </Dl>
          </Card>

          {d.creator && <CreatorSections d={d} L={L} locale={locale} money={money} aria={aria} />}
          {d.business && <BusinessSections d={d} L={L} money={money} aria={aria} />}
          {d.partner && <PartnerSections d={d} L={L} money={money} aria={aria} />}

          <Card title={L.section.activity} tip={<SectionTip id="member-activity" label={L.section.activity} text={L.tips.activity} ariaTemplate={aria} />}>
            <Dl>
              <Item label={L.field.lastSignIn}>{date(p.last_sign_in_at) ?? <NotSet L={L} />}</Item>
              <Item label={L.field.updated}>{date(p.updated_at) ?? <NotSet L={L} />}</Item>
              <Item label={L.field.disputes}>{d.trust.disputes}</Item>
              <Item label={L.field.conversations}>{d.trust.conversations}</Item>
              <Item label={L.field.reports}>{d.trust.reports_involving}</Item>
            </Dl>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title={L.section.contact} tip={<SectionTip id="member-contact" label={L.section.contact} text={L.tips.contact} ariaTemplate={aria} />}>
            <Dl single>
              <Item label={L.field.email}><MaskedValue userId={p.id} field="email" value={p.email} L={L} /></Item>
              <Item label={L.field.emailConfirmed}>{p.email_confirmed_at ? date(p.email_confirmed_at) : L.no}</Item>
              <Item label={L.field.phone}><MaskedValue userId={p.id} field="phone" value={p.phone} L={L} /></Item>
            </Dl>
          </Card>

          <Card title={L.section.attribution} tip={<SectionTip id="member-attribution" label={L.section.attribution} text={L.tips.attribution} ariaTemplate={aria} />}>
            <Dl single>
              <Item label={L.field.signupSource}>{sourceLabel}</Item>
              <Item label={L.field.referredBy}>
                {d.attribution?.referred_by ? (
                  <Link href={`/admin/users/${d.attribution.referred_by.id}`} className="font-semibold text-brand-700 hover:text-brand">@{d.attribution.referred_by.handle}</Link>
                ) : <NotSet L={L} />}
              </Item>
              <Item label={L.field.referrals}>{d.referrals}</Item>
            </Dl>
          </Card>

          <Card title={L.section.log} tip={<SectionTip id="member-log" label={L.section.log} text={L.tips.log} ariaTemplate={aria} />}>
            {d.moderation.history.length === 0 ? (
              <p className="text-sm text-muted">{L.logEmpty}</p>
            ) : (
              <ol className="space-y-3">
                {d.moderation.history.map((e) => (
                  <li key={String(e.id)} className="min-w-0 border-l-2 border-line pl-3 text-xs [overflow-wrap:anywhere]">
                    <p className="font-bold text-ink">
                      {L.logAction[e.action as keyof L['logAction']] ?? e.action}
                      {e.admin_handle && <span className="font-normal text-muted"> · {fill(L.logBy, { admin: e.admin_handle })}</span>}
                    </p>
                    <p className="text-muted">{date(e.at)}</p>
                    {e.reason_code && <p className="text-ink">{L.reasonLabel}{colon} {L.reasons[e.reason_code as keyof L['reasons']]?.label ?? e.reason_code}</p>}
                    {e.correction_fields && e.correction_fields.length > 0 && (
                      <p className="text-ink">{L.logFields} {e.correction_fields.map((f) => L.fix[f as keyof L['fix']] ?? f).join(', ')}</p>
                    )}
                    {e.message && <p className="mt-0.5 whitespace-pre-line text-ink/80">{open}{e.message}{close}</p>}
                    {e.internal_note && <p className="mt-0.5 text-muted">{L.logNote} {e.internal_note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      {/* Sticky decision bar, inside <main> so it sits above the mobile BottomNav. */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-line bg-white/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
        <p className="mb-1 flex items-center text-[11px] font-bold uppercase tracking-wide text-muted">
          {L.section.decision}
          <SectionTip id="member-decision" label={L.section.decision} text={L.tips.decision} ariaTemplate={aria} placement="top" />
        </p>
        <DecisionPanel userId={p.id} name={p.display_name} status={p.status} warnings={blocking} L={L} mode="bar" />
      </div>
    </section>
  );
}

function CreatorSections({ d, L, locale, money, aria }: { d: AdminMemberDetail; L: L; locale: Locale; money: (n: number) => string; aria: string }) {
  const c = d.creator!;
  const id = d.profile.id;
  const rows = KNOWN.map((k) => ({ k, v: c.platforms[k] })).filter((x) => x.v && (x.v.url || x.v.followers));
  const sum = rows.reduce((s, x) => s + (Number(x.v?.followers) || 0), 0);
  const fmt = new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-US');
  const apps = c.stats.applications;
  return (
    <>
      <Card title={L.section.socials} tip={<SectionTip id="member-socials" label={L.section.socials} text={L.tips.socials} ariaTemplate={aria} />}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">{L.warn.noSocials}</p>
        ) : (
          // AR-6: each row is a 44 px target (was 28 px + 8 px gap), the link fills the row height.
          <ul>
            {rows.map(({ k, v }) => (
              <li key={k} className="flex min-h-[44px] min-w-0 items-center gap-2 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: SOCIAL_META[k].brand }}>
                  <SocialIcon platform={k} className="h-3.5 w-3.5" aria-hidden />
                </span>
                {v?.url ? (
                  <a href={v.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] min-w-0 flex-1 items-center self-stretch font-semibold text-brand-700 hover:text-brand"><span className="truncate">{v.url}</span></a>
                ) : (
                  <span className="min-w-0 flex-1 truncate text-muted">{SOCIAL_META[k].label}</span>
                )}
                <span className="shrink-0 tabular-nums text-muted">{fmt.format(Number(v?.followers) || 0)}</span>
              </li>
            ))}
          </ul>
        )}
        <Dl>
          <Item label={L.field.audienceDeclared}>{fmt.format(c.audience_size)}</Item>
          <Item label={L.field.audienceSum}>{fmt.format(sum)}</Item>
          <Item label={L.field.categories} wide>
            {c.categories.length ? (
              <span className="flex flex-wrap gap-1">{c.categories.map((x) => <span key={x} className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink">{x}</span>)}</span>
            ) : <NotSet L={L} />}
          </Item>
        </Dl>
      </Card>

      <Card title={L.section.standing}>
        <Dl>
          <Item label={L.field.pro}>{c.is_pro ? `${L.yes}${c.pro_expires_at ? ` · ${fill(L.field.proUntil, { date: c.pro_expires_at.slice(0, 10) })}` : ''}` : L.no}</Item>
          <Item label={L.field.founder}>{c.founder_number !== null ? `#${c.founder_number}` : L.no}</Item>
          {/* D6: never an invented rating */}
          <Item label={L.field.rating}>{c.rating.reviews > 0 && c.rating.value != null ? c.rating.value.toFixed(1) : L.ratingNew}</Item>
        </Dl>
      </Card>

      <Card title={L.section.payout} tip={<SectionTip id="member-payout" label={L.section.payout} text={L.tips.payout} ariaTemplate={aria} />}>
        <Dl single>
          <Item label={L.field.payoutPhone}><MaskedValue userId={id} field="creator_payout_phone" value={c.payout.phone} L={L} emptyLabel={L.noPayout} /></Item>
          <Item label={L.field.provider}>{c.payout.provider ? providerLabel(c.payout.provider) : <NotSet L={L} />}</Item>
        </Dl>
      </Card>

      <Card title={L.section.creatorActivity}>
        <Dl>
          <Item label={L.field.applications}>{countOf(apps)}</Item>
          <Item label={L.field.approved}>{countOf(apps, ['approved', 'content_submitted', 'verified', 'paid'])}</Item>
          <Item label={L.field.paid}>{countOf(apps, ['paid'])}</Item>
          <Item label={L.field.receivedNet}>{money(c.stats.earnings_net_fcfa)}</Item>
          <Item label={L.field.partnerCommission}>{money(c.stats.partner_commission_fcfa)}</Item>
          <Item label={L.field.pendingPayout}>{money(c.stats.pending_payout_fcfa)}</Item>
          <Item label={L.field.proofsRejected}>{c.stats.proofs_rejected}</Item>
        </Dl>
      </Card>

      <Card title={L.section.partner}>
        <Dl>
          <Item label={L.field.representedBy}>
            {c.partner ? <Link href={`/admin/users/${c.partner.id}`} className="font-semibold text-brand-700 hover:text-brand">@{c.partner.handle}</Link> : <NotSet L={L} />}
          </Item>
          {c.partner && <Item label={L.field.commission}>{Math.round(c.partner.commission_rate * 100)}{locale === 'fr' ? '\u202f%' : '%'}</Item>}
          <Item label={L.field.pendingOffers}>{c.pending_partner_offers}</Item>
        </Dl>
      </Card>
    </>
  );
}

function BusinessSections({ d, L, money, aria }: { d: AdminMemberDetail; L: L; money: (n: number) => string; aria: string }) {
  const b = d.business!;
  const id = d.profile.id;
  return (
    <>
      <Card title={L.section.company}>
        <Dl>
          <Item label={L.field.company}>{b.company_name || <NotSet L={L} />}</Item>
          <Item label={L.field.industry}>{b.industry || <NotSet L={L} />}</Item>
          <Item label={L.field.website}>
            {b.website ? <a href={b.website} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:text-brand">{b.website}</a> : <NotSet L={L} />}
          </Item>
          <Item label={L.field.verified}>{b.is_verified ? L.yes : L.no}</Item>
        </Dl>
      </Card>
      <Card title={L.section.billing} tip={<SectionTip id="member-billing" label={L.section.billing} text={L.tips.billing} ariaTemplate={aria} />}>
        <Dl single>
          <Item label={L.field.billingEmail}><MaskedValue userId={id} field="billing_email" value={b.billing_email} L={L} /></Item>
          <Item label={L.field.billingAddress}><MaskedValue userId={id} field="billing_address" value={b.billing_address} L={L} /></Item>
          <Item label={L.field.taxId}><MaskedValue userId={id} field="business_tax_id" value={b.tax_id} L={L} /></Item>
        </Dl>
      </Card>
      <Card title={L.section.brandActivity}>
        <Dl>
          <Item label={L.field.campaigns}>{countOf(b.stats.campaigns)}</Item>
          <Item label={L.field.campaignsFunded}>{countOf(b.stats.campaigns, ['published', 'in_progress', 'under_review', 'completed', 'disputed'])}</Item>
          <Item label={L.field.fundedTotal}>{money(b.stats.funded_total_fcfa)}</Item>
          <Item label={L.field.fees}>{money(b.stats.fees_fcfa)}</Item>
          <Item label={L.field.escrowHeld}>{money(b.stats.escrow_held_net_fcfa)}</Item>
          <Item label={L.field.refunded}>{money(b.stats.refunded_total_fcfa)}</Item>
          <Item label={L.field.leftoverPending}>{money(b.stats.leftover_refund_pending_fcfa)}</Item>
          <Item label={L.field.retainers}>{countOf(b.stats.retainers)}</Item>
          <Item label={L.field.retainerFunded}>{money(b.stats.retainer_funded_value_fcfa)}</Item>
        </Dl>
      </Card>
    </>
  );
}

function PartnerSections({ d, L, money, aria }: { d: AdminMemberDetail; L: L; money: (n: number) => string; aria: string }) {
  const k = d.partner!;
  const id = d.profile.id;
  return (
    <>
      <Card title={L.section.partnerProfile}>
        <Dl>
          <Item label={L.field.specialties} wide>
            {k.specialties.length ? (
              <>
                <span className="flex flex-wrap gap-1">{k.specialties.map((x) => <span key={x} className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink">{x}</span>)}</span>
                <span className="mt-0.5 block text-[11px] text-muted">{L.field.specialtiesNote}</span>
              </>
            ) : <NotSet L={L} />}
          </Item>
          <Item label={L.field.years}>{k.years_experience > 0 ? k.years_experience : <NotSet L={L} />}</Item>
          <Item label={L.field.agencyAccess}>{k.agency_access ? L.yes : L.no}</Item>
          <Item label={L.field.rating}>{L.ratingNew}</Item>
          <Item label={L.field.taxId}><MaskedValue userId={id} field="partner_tax_id" value={k.tax_id} L={L} /></Item>
        </Dl>
      </Card>
      <Card title={L.section.payout} tip={<SectionTip id="member-partner-payout" label={L.section.payout} text={L.tips.payout} ariaTemplate={aria} />}>
        <Dl single>
          <Item label={L.field.payoutPhone}><MaskedValue userId={id} field="partner_payout_phone" value={k.payout.phone} L={L} emptyLabel={L.noPayout} /></Item>
          <Item label={L.field.provider}>{k.payout.provider ? providerLabel(k.payout.provider) : <NotSet L={L} />}</Item>
        </Dl>
      </Card>
      <Card title={L.section.partnerActivity}>
        <Dl>
          <Item label={L.field.creatorsActive}>{k.stats.creators_active}</Item>
          <Item label={L.field.creatorsEnded}>{k.stats.creators_ended}</Item>
          <Item label={L.field.invitesPending}>{k.stats.invites_pending}</Item>
          <Item label={L.field.applicationsMade}>{k.stats.applications_made}</Item>
          <Item label={L.field.commissionOwed}>{money(k.stats.commission_owed_fcfa)}</Item>
          <Item label={L.field.commissionPaid}>{money(k.stats.commission_paid_fcfa)}</Item>
          <Item label={L.field.retainers}>{countOf(k.stats.retainers)}</Item>
          <Item label={L.field.settlementsPending}>{money(k.stats.settlements_pending_fcfa)}</Item>
          <Item label={L.field.settlementsPaid}>{money(k.stats.settlements_paid_fcfa)}</Item>
        </Dl>
      </Card>
    </>
  );
}

function Card({ title, tip, children }: { title: string; tip?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
      <h3 className="flex items-center text-sm font-bold text-ink">{title}{tip}</h3>
      {children}
    </section>
  );
}

function Dl({ children, single = false }: { children: ReactNode; single?: boolean }) {
  return <dl className={`grid min-w-0 gap-3 ${single ? '' : 'sm:grid-cols-2'}`}>{children}</dl>;
}

function Item({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? 'sm:col-span-2' : ''}`}>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function NotSet({ L }: { L: L }) {
  return <span className="text-muted">{L.notSet}</span>;
}
