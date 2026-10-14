import { describe, it, expect, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fr from '../messages/fr.json';
import en from '../messages/en.json';
import { allowedDecisions, membersHref, normalizeDetail, pageRange, parseMemberFilters, safeMembersBack, validateDecision } from './admin-members';
import { cityIsName, cityLooksLikeBio, memberWarnings, cardWarnings } from './member-quality';
import { ratingDisplay, ratingLabel } from './ratings';
import { canInvoice, canRespond, earlyEndSettlement, retainerSplit, retainerStage, splitIsBalanced } from './retainers';
import { PROFILE_LIMITS, checkProfileText, limitErrorField } from './profile-limits';
import { fixLink, parseModerationStatus, pendingStep } from './moderation-status';
import { PROFILE_COLUMNS } from './auth/session-columns';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((f) => {
    const rel = join(dir, f);
    if (f === 'node_modules' || f.startsWith('.')) return [];
    return statSync(join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f) ? [rel] : [];
  });
}
const SOURCES = ['app', 'components', 'lib'].flatMap(walk);

// ── D1 security ──────────────────────────────────────────────────────────────────────────────────
describe('D1: no select(*) on profiles, no phone_e164 read (ships with 0035)', () => {
  it('no .from("profiles")…select("*") anywhere, and no profiles select naming phone_e164', () => {
    for (const f of SOURCES) {
      const s = src(f);
      for (const m of s.matchAll(/from\(['"]profiles['"]\)\s*\.select\(\s*(['"`])([\s\S]*?)\1/g)) {
        expect(m[2], f).not.toBe('*');
        expect(m[2], f).not.toMatch(/phone_e164/);
      }
      expect(s, f).not.toMatch(/from\(['"]profiles['"]\)\.select\(\s*['"]\*['"]/);
      // own phone only via get_my_contact; never `profile.phone_e164`
      expect(s, f).not.toMatch(/profile\??\.phone_e164/);
    }
  });
  it('session.ts selects exactly the 0035 column grant', () => {
    expect(PROFILE_COLUMNS.split(/\s*,\s*/).sort()).toEqual(
      ['id', 'handle', 'display_name', 'avatar_url', 'bio', 'city', 'country', 'status', 'created_at', 'updated_at', 'resubmitted_at'].sort(),
    );
    expect(src('lib/auth/session.ts')).toMatch(/select\(PROFILE_COLUMNS\)/);
    expect(src('app/(app)/profile/page.tsx')).toContain('getMyContact');
  });
  it('the retainer form has no editable Bayele cut', () => {
    const form = src('app/(app)/business/retainers/retainer-form.tsx');
    expect(form).not.toMatch(/name="cut"/);
    expect(form).toContain('retainerSplit');
  });
});

// ── D2/D3 masking + reveal ─────────────────────────────────────────────────────────────────────────
describe('D2: sensitive values stay masked until a logged reveal', () => {
  it('normalizeDetail keeps only {present, masked} — a full value the server might send is dropped', () => {
    const d = normalizeDetail({
      profile: { id: 'u', handle: 'h', display_name: 'N', city: 'Douala', country: 'CM', status: 'pending_review', roles: ['creator'],
        phone: { present: true, masked: '••••••0301', value: '+237690000301' }, email: { present: true, masked: 'j•••@x.cm' } },
      creator: { payout: { phone: { present: true, masked: '••••0042', full: '+237677000042' }, provider: 'mtn_momo' }, platforms: {}, stats: {} },
    })!;
    expect(d.profile.phone).toEqual({ present: true, masked: '••••••0301' });
    expect(JSON.stringify(d)).not.toContain('+237690000301');
    expect(JSON.stringify(d)).not.toContain('+237677000042');
    expect(d.creator!.stats.earnings_net_fcfa).toBe(0);
    expect(normalizeDetail(null)).toBeNull();
  });

  it('MaskedValue renders the mask only (the value is absent from the HTML)', async () => {
    vi.doMock('../app/(app)/admin/member-actions', () => ({ revealMemberFieldAction: vi.fn() }));
    const { MaskedValue } = await import('../components/admin/masked-value');
    const html = renderToStaticMarkup(createElement(MaskedValue, { userId: 'u', field: 'phone', value: { present: true, masked: '••••••0301' }, L: fr.admin.members }));
    expect(html).toContain('••••••0301');
    expect(html).toContain(fr.admin.members.reveal);
    const none = renderToStaticMarkup(createElement(MaskedValue, { userId: 'u', field: 'phone', value: { present: false, masked: null }, L: fr.admin.members }));
    expect(none).toContain(fr.admin.members.notSet);
    expect(none).not.toContain(fr.admin.members.reveal);
  });

  it('revealMemberFieldAction requires a reason and a known field, then calls the logged RPC', async () => {
    vi.resetModules();
    const rpc = vi.fn(async () => ({ data: '+237690000301', error: null }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));
    vi.doMock('@/i18n/dictionaries', () => ({ getDictionary: async () => ({ locale: 'fr', t: fr }) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doUnmock('../app/(app)/admin/member-actions');
    const { revealMemberFieldAction } = await import('../app/(app)/admin/member-actions');
    expect(await revealMemberFieldAction('u', 'phone', '  ')).toEqual({ ok: false, error: fr.admin.members.revealReason });
    expect((await revealMemberFieldAction('u', 'password', 'x')).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    expect(await revealMemberFieldAction('u', 'phone', 'vérif paiement')).toEqual({ ok: true, value: '+237690000301' });
    expect(rpc).toHaveBeenCalledWith('admin_reveal_member_field', { p_user_id: 'u', p_field: 'phone', p_reason: 'vérif paiement' });
  });
});

// ── D4 decision bar ──────────────────────────────────────────────────────────────────────────────
describe('D4: decision validation mirrors admin_moderate_member', () => {
  it('reject / request_changes / suspend need a reason code; « other » needs a message', () => {
    expect(validateDecision({ action: 'approve' })).toBeNull();
    expect(validateDecision({ action: 'reactivate' })).toBeNull();
    expect(validateDecision({ action: 'reject' })).toBe('reason_required');
    expect(validateDecision({ action: 'suspend', reasonCode: 'bogus' })).toBe('invalid_reason_code');
    expect(validateDecision({ action: 'reject', reasonCode: 'other' })).toBe('message_required');
    expect(validateDecision({ action: 'reject', reasonCode: 'other', message: 'Pourquoi' })).toBeNull();
    expect(validateDecision({ action: 'reject', reasonCode: 'duplicate', message: 'x'.repeat(501) })).toBe('message_too_long');
    expect(validateDecision({ action: 'suspend', reasonCode: 'spam_or_test', note: 'x'.repeat(1001) })).toBe('note_too_long');
    expect(validateDecision({ action: 'request_changes', reasonCode: 'incomplete' })).toBe('fields_required');
    expect(validateDecision({ action: 'request_changes', reasonCode: 'incomplete', fields: ['city', 'nope'] })).toBe('invalid_fields');
    expect(validateDecision({ action: 'request_changes', reasonCode: 'incomplete', fields: ['city', 'bio'] })).toBeNull();
    expect(validateDecision({ action: 'delete' })).toBe('invalid_action');
  });
  it('offers only the transitions the RPC allows', () => {
    expect(allowedDecisions('pending_review')).toEqual(['reject', 'request_changes', 'approve', 'suspend']);
    expect(allowedDecisions('active')).toEqual(['request_changes', 'suspend']);
    expect(allowedDecisions('rejected')).toEqual(['reactivate']);
    expect(allowedDecisions('suspended')).toEqual(['reactivate']);
  });
  it('every reason code and error has FR + EN copy', () => {
    for (const d of [fr, en]) {
      for (const c of ['fake_or_unreachable', 'duplicate', 'incomplete', 'inappropriate', 'not_eligible', 'spam_or_test', 'other'] as const) expect(d.admin.members.reasons[c].label).toBeTruthy();
      for (const e of ['reason_required', 'message_required', 'fields_required', 'invalid_transition', 'cannot_moderate_self'] as const) expect(d.admin.members.errors[e]).toBeTruthy();
    }
    expect(fr.admin.members.reasons.fake_or_unreachable.label).toBe('Informations fausses ou impossibles à vérifier');
  });
  it('no one-tap reject: the card opens the reason panel', () => {
    const panel = src('components/admin/decision-panel.tsx');
    expect(panel).toMatch(/if \(a === 'approve'\)/);
    expect(panel).toMatch(/setOpen\(a\)/);
  });
});

// ── D7 list ──────────────────────────────────────────────────────────────────────────────────────
describe('D7: URL filters, pagination, safe back link, card overflow rules', () => {
  it('defaults to « À valider » when members are waiting; status=all shows everyone', () => {
    expect(parseMemberFilters({}, 3).status).toBe('pending_review');
    expect(parseMemberFilters({}, 0).status).toBeNull();
    expect(parseMemberFilters({ status: 'all' }, 3).status).toBeNull();
    const f = parseMemberFilters({ status: 'active', role: 'creator', country: 'cm', q: ' leo ', flag: '1', page: '2' });
    expect(f).toEqual({ status: 'active', role: 'creator', country: 'CM', q: 'leo', flag: true, page: 2 });
    expect(membersHref(f)).toBe('/admin/users?status=active&role=creator&country=CM&q=leo&flag=1&page=2');
    expect(membersHref(f, { status: null, page: 1 })).toBe('/admin/users?status=all&role=creator&country=CM&q=leo&flag=1');
    expect(parseMemberFilters({ role: 'hacker', country: 'FR' })).toMatchObject({ role: null, country: null });
  });
  it('pages of 50 and « 51–100 sur 312 »', () => {
    expect(pageRange(2, 312)).toEqual({ from: 51, to: 100 });
    expect(pageRange(7, 312)).toEqual({ from: 301, to: 312 });
    expect(pageRange(1, 0)).toBeNull();
    expect(pageRange(9, 312)).toBeNull();
  });
  it('the back link only accepts an internal /admin/users URL', () => {
    expect(safeMembersBack('/admin/users?status=active&page=2')).toBe('/admin/users?status=active&page=2');
    expect(safeMembersBack('https://evil.example/admin/users')).toBe('/admin/users');
    expect(safeMembersBack('//evil.example')).toBe('/admin/users');
    expect(safeMembersBack('/admin/ledger')).toBe('/admin/users');
  });
  it('the member card never puts user text in a shrink-0 / nowrap box', () => {
    const card = src('components/admin/member-card.tsx');
    expect(card).toMatch(/line-clamp-1 min-w-0 \[overflow-wrap:anywhere\]/);
    expect(card).not.toMatch(/shrink-0[^"]*">\s*\{m\.city/);
    expect(src('app/(app)/admin/moderation/page.tsx')).toMatch(/redirect\('\/admin\/users\?status=pending_review'\)/);
  });
  it('the pending pill is contrast-safe (never text-accent on accent-soft)', () => {
    expect(src('components/admin/member-status-pill.tsx')).toContain("pending_review: 'bg-accent-soft text-ink'");
    for (const f of SOURCES) expect(src(f), f).not.toMatch(/bg-accent-soft(\/\d+)? text-accent\b/);
  });
});

describe('data-quality warnings (deterministic, never blocking)', () => {
  const leo = 'DoualaCréatrice de contenus lifestyle et beauté, je partage mes routines, mes looks et mes bons plans à Douala. Collaborations : DM ou WhatsApp 6 90 00 00 00';
  it('flags the 167-character city and a city equal to a name word', () => {
    expect(leo.length).toBeGreaterThan(150);
    expect(cityLooksLikeBio(leo)).toBe(true);
    expect(cityLooksLikeBio('Douala')).toBe(false);
    expect(cityLooksLikeBio('Saint-Louis')).toBe(false);
    expect(cityLooksLikeBio('Port Harcourt')).toBe(false);
    expect(cityIsName('Aboubacar', 'Aboubacar Diallo')).toBe(true);
    expect(cityIsName('Yaoundé', 'Awa Ngono')).toBe(false);
    expect(cardWarnings({ city: leo, displayName: 'Léopoldine', roles: ['creator'] })).toEqual(['cityLooksLikeBio']);
  });
  it('creator / partner / brand checks', () => {
    const w = memberWarnings({ city: 'Douala', displayName: 'Awa', roles: ['creator'], platforms: {}, audienceSize: 4000, hasPayout: false, hasAvatar: false, defaultRating: true });
    expect(w).toEqual(['noSocials', 'audienceNoSource', 'noPayout', 'defaultRating', 'noAvatar']);
    expect(memberWarnings({ city: 'Abidjan', displayName: 'SARL X', roles: ['business'], hasBillingEmail: false, hasAvatar: true })).toEqual(['businessNoBilling']);
    expect(memberWarnings({ city: 'Lagos', displayName: 'A', roles: ['creator'], platforms: { instagram: { url: 'https://i/x', followers: 10 } }, audienceSize: 10, hasPayout: true, hasAvatar: true })).toEqual([]);
  });
});

// ── D6 ratings ───────────────────────────────────────────────────────────────────────────────────
describe('D6: « Nouveau » instead of any default rating', () => {
  it('no reviews → new, whatever the DB default says', () => {
    expect(ratingDisplay(5, 0)).toEqual({ kind: 'new' });
    expect(ratingDisplay(null, 3)).toEqual({ kind: 'new' });
    expect(ratingDisplay(4.66, 3)).toEqual({ kind: 'rating', value: 4.7, reviews: 3 });
    expect(ratingLabel(ratingDisplay(5, 0), fr.profile.new, 'fr')).toBe('Nouveau');
    expect(ratingLabel(ratingDisplay(4.5, 2), 'New', 'en')).toBe('4.5');
  });
  it('no page prints ratingAvg or a 5.0 fallback any more; talent data passes 0 reviews', () => {
    for (const f of SOURCES) {
      const s = src(f);
      expect(s, f).not.toMatch(/ratingAvg/);
      expect(s, f).not.toMatch(/rating_avg \?\? 5/);
    }
    expect(src('lib/data/talent.ts')).toMatch(/ratingDisplay\(item\.creator_profiles\?\.rating_avg \?\? null, 0\)/);
    expect(src('lib/data/talent.ts')).not.toMatch(/completedCampaigns: 0/);
  });
});

// ── O7 retainers ─────────────────────────────────────────────────────────────────────────────────
describe('O7: fixed 25 % cut and partner acceptance before invoicing', () => {
  it('cut = floor(contract × 25 / 100), fee + media must equal the net', () => {
    expect(retainerSplit(1_000_000)).toEqual({ contract: 1_000_000, cut: 250_000, net: 750_000 });
    expect(retainerSplit(100_001)).toEqual({ contract: 100_001, cut: 25_000, net: 75_001 });
    expect(splitIsBalanced(1_000_000, 450_000, 300_000)).toBe(true);
    expect(splitIsBalanced(1_000_000, 550_000, 300_000)).toBe(false);
    expect(retainerSplit(0)).toBeNull();
  });
  it('early end maths from the contract (100 000, p = 30 000 → kept 10 000, refund 60 000)', () => {
    expect(earlyEndSettlement(100_000, 30_000)).toEqual({ kept: 10_000, refund: 60_000 });
    for (const [c, p] of [[100_001, 1], [999_999, 333_333], [50_000, 37_500], [50_000, 0]] as const) {
      const r = earlyEndSettlement(c, p)!;
      expect(p + r.kept + r.refund).toBe(c);
    }
    expect(earlyEndSettlement(100_000, 75_001)).toBeNull();
  });
  it('the brand can invoice only after acceptance; the partner answers drafts and legacy invoiced rows', () => {
    const draft = { status: 'draft', partner_accepted_at: null, partner_declined_at: null };
    expect(retainerStage(draft)).toBe('awaiting_partner');
    expect(canInvoice(draft)).toBe(false);
    expect(canRespond(draft)).toBe(true);
    const accepted = { ...draft, partner_accepted_at: '2026-10-14T10:00:00Z' };
    expect(retainerStage(accepted)).toBe('ready_to_invoice');
    expect(canInvoice(accepted)).toBe(true);
    expect(canRespond(accepted)).toBe(false);
    expect(retainerStage({ status: 'invoiced', partner_accepted_at: null })).toBe('awaiting_partner');
    expect(canRespond({ status: 'invoiced', partner_accepted_at: null })).toBe(true);
    expect(canInvoice({ status: 'invoiced', partner_accepted_at: 'x' })).toBe(false);
    expect(retainerStage({ status: 'terminated', partner_declined_at: 'x' })).toBe('declined');
    expect(retainerStage({ status: 'funded', partner_accepted_at: 'x' })).toBe('funded');
  });
  it('the brand list gates the invoice button on canInvoice; the partner page uses respond_retainer', () => {
    expect(src('app/(app)/business/retainers/page.tsx')).toMatch(/canInvoice\(r\) && <InvoiceButton/);
    expect(src('app/(app)/partner/actions.ts')).toMatch(/rpc\('respond_retainer'/);
    expect(src('app/(app)/business/retainers/actions.ts')).toMatch(/rpc\('attach_retainer_invoice'/);
  });
});

// ── D5 creator limits ────────────────────────────────────────────────────────────────────────────
describe('D5: 80 / 60 / 500 limits with field errors', () => {
  it('matches the 0036 CHECKs', () => {
    expect(PROFILE_LIMITS).toEqual({ displayName: 80, city: 60, bio: 500 });
    expect(checkProfileText({ displayName: 'Awa', city: 'Douala', bio: '' })).toEqual({});
    expect(checkProfileText({ city: 'x'.repeat(61) })).toEqual({ city: 'tooLong' });
    expect(checkProfileText({ city: '  ' + 'x'.repeat(60) + '  ' })).toEqual({});
    expect(checkProfileText({ displayName: ' ', city: '' })).toEqual({ displayName: 'required', city: 'required' });
    expect(checkProfileText({ displayName: 'x'.repeat(81), bio: 'x'.repeat(501) })).toEqual({ displayName: 'tooLong', bio: 'tooLong' });
  });
  it('maps 23514 constraint names and onboard_profile codes to the field', () => {
    expect(limitErrorField('new row for relation "profiles" violates check constraint "profiles_city_len"')).toBe('city');
    expect(limitErrorField('display_name_too_long')).toBe('displayName');
    expect(limitErrorField('bio_too_long')).toBe('bio');
    expect(limitErrorField('handle_taken')).toBeNull();
  });
  it('forms use the shared limits (counter + max) on city, bio and name', () => {
    for (const f of ['app/(app)/profile/profile-form.tsx', 'app/(auth)/onboarding/[role]/onboarding-form.tsx']) {
      const s = src(f);
      for (const k of ['PROFILE_LIMITS.city', 'PROFILE_LIMITS.bio', 'PROFILE_LIMITS.displayName']) expect(s, `${f} ${k}`).toContain(k);
    }
    expect(src('app/(auth)/onboarding/[role]/onboarding-form.tsx')).not.toContain('pending_review');
    expect(src('app/(auth)/onboarding/[role]/onboarding-form.tsx')).not.toContain('45000');
  });
});

describe('D8: the member status view', () => {
  it('parses my_moderation_status and links the correction to the field', () => {
    const s = parseModerationStatus({ status: 'pending_review', resubmitted_at: null, open_correction: { fields: ['city', 'bio'], reason_code: 'incomplete', reason_label: 'Profil incomplet', message: null, requested_at: 'x' }, last_decision: null })!;
    expect(pendingStep(s)).toBe(1);
    expect(fixLink(s.open_correction!.fields)).toBe('/profile#field-city');
    expect(fixLink(['payout_phone'])).toBe('/profile#paiement');
    expect(pendingStep({ ...s, status: 'active' })).toBe(2);
    expect(parseModerationStatus(null)).toBeNull();
  });
  it('no unsupported claims or developer wording in creator copy', () => {
    const blob = JSON.stringify([fr.creatorUx, fr.creatorTips, fr.creatorForm]).toLowerCase();
    expect(blob).not.toMatch(/24\s*[–-]\s*48/);
    expect(blob).not.toContain('régulièrement');
    expect(blob).not.toContain('pending_review');
    for (const f of SOURCES) expect(src(f), f).not.toMatch(/sous 24[–-]48h|publient régulièrement/);
  });
  it('the Mobile Money nudges deep-link to the payout field', () => {
    for (const f of ['app/(app)/creator/dashboard/page.tsx', 'app/(app)/creator/wallet/page.tsx', 'app/(app)/partner/creators/page.tsx']) {
      expect(src(f), f).toContain('/profile#paiement');
    }
    expect(src('app/(app)/profile/profile-form.tsx')).toContain('id="paiement"');
  });
});

describe('dictionaries for this round: parity, typography, tip length, no reward words', () => {
  const NS = [['admin', 'members'], ['admin', 'queues'], ['creatorTips'], ['creatorForm'], ['creatorUx'], ['retainers']] as const;
  const pick = (d: any, path: readonly string[]) => path.reduce((o, k) => o?.[k], d);
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [`${p}${Array.isArray(o) ? `[${o.length}]` : ''}`];
  it('same keys (and array lengths) in FR and EN', () => {
    for (const n of NS) expect(keys(pick(en, n)).sort(), n.join('.')).toEqual(keys(pick(fr, n)).sort());
  });
  it('French typography', () => {
    const s = JSON.stringify(NS.map((n) => pick(fr, n)));
    expect(s).not.toMatch(/ [:?!;%]/);
    expect(s).not.toMatch(/« | »/);
  });
  it('the 16 creator tips (+ aria) exist and every tip is ≤ 220 characters', () => {
    const tips = ['city', 'bio', 'handle', 'categories', 'socials', 'audience', 'payout', 'provider', 'pending', 'lockedTab', 'applications', 'proof', 'walletInProgress', 'walletApproved', 'partnerCommission', 'alerts'];
    for (const d of [fr, en]) {
      for (const k of tips) expect((d.creatorTips as Record<string, string>)[k], k).toBeTruthy();
      for (const v of [...Object.values(d.creatorTips), ...Object.values(d.admin.members.tips)]) expect(v.length).toBeLessThanOrEqual(220);
    }
  });
  it('no reward wording (C3)', () => {
    const blob = JSON.stringify(NS.map((n) => [pick(fr, n), pick(en, n)])).toLowerCase();
    for (const w of [/gagne/, /r[ée]compense/, /(?<!kpi )\bbonus\b(?! kpi)/, /reward/, /\bearn/, /cadeau/]) expect(blob, String(w)).not.toMatch(w);
  });
});
