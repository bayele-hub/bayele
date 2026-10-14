import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import fr from '../messages/fr.json';
import en from '../messages/en.json';
import { MAX_SPECIALTIES, SPECIALTIES_FALLBACK, parseSpecialtyCodes, specialtyLabels, toggleSpecialty } from './gov/specialties';
import { MASK_TOKENS, joinKinds, splitMasked } from './gov/masked';
import { detectContacts } from './gov/contact-detect';
import { GOAL_MAX, normalizeGoal, validateContactRequest } from './gov/contact-request';
import { brandCtaState, canProposeRetainer, needsConsent, retainerPartnerIds, threadMode, modeFromSendError, mapCode } from './gov/rules';
import { MAX_BYTES, QUALITY_STEPS, TARGET_BYTES, compressToTarget, fitWithin, proofPath, sha256Hex, withRetry, isAcceptedType } from './gov/proof-shots';
import { OTHER_CITY, cityFromForm, filterCities, foldCity, initialCityChoice, resolveCity } from './gov/cities';
import { NON_CIRCUMVENTION_VERSION, CONSENT_VERSION_RE } from './legal';
import { normalizeOverview } from './data/partner-gov-normalize';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const src = (p: string) => readFileSync(join(ROOT, p), 'utf8');

describe('G1 specialties: a fixed list, max 3', () => {
  const codes = SPECIALTIES_FALLBACK.map((s) => s.code);
  it('the v1 list has the 14 decided codes', () => {
    expect(codes).toHaveLength(14);
    expect(codes[0]).toBe('talent_management');
    expect(codes).toContain('ngo_impact');
  });
  it('toggle refuses a 4th code and keeps the selection', () => {
    let sel: string[] = [];
    for (const c of codes.slice(0, 3)) sel = toggleSpecialty(sel, c).next;
    expect(sel).toHaveLength(MAX_SPECIALTIES);
    const r = toggleSpecialty(sel, codes[5]!);
    expect(r.limitHit).toBe(true);
    expect(r.next).toEqual(sel);
    expect(toggleSpecialty(sel, codes[0]!).next).toHaveLength(2); // removing always works
  });
  it('parse: known codes only, deduplicated, at most 3', () => {
    expect(parseSpecialtyCodes('ugc,photography,ugc', codes)).toEqual({ codes: ['ugc', 'photography'], error: null });
    expect(parseSpecialtyCodes('ugc,Balafon', codes).error).toBe('invalid_specialty');
    expect(parseSpecialtyCodes('ugc,photography,tech_fintech,ngo_impact', codes).error).toBe('too_many_specialties');
    expect(parseSpecialtyCodes('', codes)).toEqual({ codes: [], error: null });
  });
  it('labels by locale; legacy free text shows as typed', () => {
    expect(specialtyLabels(['ugc', 'fashion_beauty', 'Vue whatsapp'], SPECIALTIES_FALLBACK, 'fr')).toEqual(['UGC', 'Mode et beauté', 'Vue whatsapp']);
    expect(specialtyLabels(['fashion_beauty'], SPECIALTIES_FALLBACK, 'en')).toEqual(['Fashion & beauty']);
  });
  it('the picker renders aria-pressed chips, a counter and a hidden input of codes', async () => {
    const { SpecialtyPicker } = await import('../components/gov/specialty-picker');
    const L = { legend: 'Spécialités', counter: '{n}/3', help: 'h', max: 'm', legacy: 'Votre ancien texte : {legacy}', tip: 't', aria: 'Aide : {section}' };
    const html = renderToStaticMarkup(createElement(SpecialtyPicker, {
      options: SPECIALTIES_FALLBACK.map((s) => ({ code: s.code, label: s.label_fr })),
      initial: ['ugc', 'photography', 'tech_fintech', 'ngo_impact'], legacy: ['Balafon'], L,
    }));
    expect(html).toContain('name="specialties" value="ugc,photography,tech_fintech"');
    expect(html).toContain('3/3');
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(3);
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Votre ancien texte : Balafon');
  });
  it('onboarding and /profile use the picker (no comma-separated specialties input)', () => {
    for (const f of ['app/(auth)/onboarding/[role]/onboarding-form.tsx', 'app/(app)/profile/profile-form.tsx']) {
      expect(src(f)).toContain('<SpecialtyPicker');
      expect(src(f)).not.toContain('Spécialités (séparées par des virgules)');
    }
    expect(src('app/(app)/profile/actions.ts')).toContain('parseSpecialtyCodes');
    expect(src('app/(auth)/onboarding/actions.ts')).toContain('parseSpecialtyCodes');
  });
});

describe('G5 masked markers', () => {
  it('splits the four server tokens into marks, keeping order', () => {
    const segs = splitMasked('Appelez-moi au [numéro masqué] ou [e-mail masqué], merci');
    expect(segs.map((s) => s.masked)).toEqual([false, true, false, true, false]);
    expect(segs[1]!.text).toBe('[numéro masqué]');
    expect(splitMasked('[lien masqué][compte masqué]').every((s) => s.masked)).toBe(true);
    expect(splitMasked('rien à masquer')).toEqual([{ text: 'rien à masquer', masked: false }]);
    expect(MASK_TOKENS).toHaveLength(4);
  });
  it('renders <mark> with the token text read as is (icon aria-hidden)', async () => {
    const { MaskedText } = await import('../components/gov/masked-text');
    const html = renderToStaticMarkup(createElement(MaskedText, { text: 'WhatsApp : [lien masqué] !' }));
    expect(html).toMatch(/<mark data-masked="true" class="[^"]*bg-black\/10[^"]*">.*\[lien masqué\]<\/mark>/);
    expect(html).toContain('aria-hidden="true"');
    const mine = renderToStaticMarkup(createElement(MaskedText, { text: '[numéro masqué]', onBrand: true }));
    expect(mine).toContain('bg-white/20');
  });
  it('joins kinds with « et » / "and"', () => {
    expect(joinKinds(['phone', 'email'], fr.messaging.mask.kinds, fr.messaging.mask.and)).toBe('un numéro de téléphone et une adresse e-mail');
    expect(joinKinds(['phone', 'email', 'social_handle'], en.messaging.mask.kinds, en.messaging.mask.and)).toBe('a phone number, an e-mail address and a social account');
    expect(joinKinds(['phone'], fr.messaging.mask.kinds, 'et')).toBe('un numéro de téléphone');
  });
  it('the thread renders markers, the bubble note, the pre-send notice and the read-only box', () => {
    const s = src('components/message-thread.tsx');
    expect(s).toContain('<MaskedText');
    expect(s).toContain('M.mask.bubbleNote');
    expect(s).toContain('M.mask.preSend');
    expect(s).toContain('M.closed.expired');
    expect(s).toContain('M.report.menu');
  });
  it('the client detector mirrors the server rules (only drives the notice)', () => {
    expect(detectContacts('appelle +237 6 90 00 03 01')).toContain('phone');
    expect(detectContacts('wa.me/237690000301')).toContain('messaging_link');
    expect(detectContacts('ecris a awa arobase gmail point com')).toContain('email');
    expect(detectContacts('mon insta : awa_style')).toContain('social_handle');
    expect(detectContacts('suivez @awa.style')).toContain('social_handle');
    expect(detectContacts('Budget 150 000 FCFA')).toEqual([]);
    expect(detectContacts('1 500 000 et 75.000')).toEqual([]);
    expect(detectContacts('Facture SOKO-2026-000123 du 12/10/2026, 15 %')).toEqual([]);
  });
});

describe('G4 contact-request form validation', () => {
  const today = '2026-10-14';
  it('goal is 1–280 after trimming and collapsing spaces', () => {
    expect(normalizeGoal('  Lancer   notre menu  ')).toBe('Lancer notre menu');
    expect(validateContactRequest({ goal: '   ', consent: true }, today).goal).toBe('invalid_goal');
    expect(validateContactRequest({ goal: 'x'.repeat(GOAL_MAX + 1), consent: true }, today).goal).toBe('invalid_goal');
    expect(validateContactRequest({ goal: `${'x'.repeat(GOAL_MAX)}    `, consent: true }, today)).toEqual({});
  });
  it('budget ≤ 60, deadline today or later, consent required', () => {
    expect(validateContactRequest({ goal: 'ok', budget: 'b'.repeat(61), consent: true }, today).budget).toBe('budget_too_long');
    expect(validateContactRequest({ goal: 'ok', deadline: '2026-10-13', consent: true }, today).deadline).toBe('deadline_in_past');
    expect(validateContactRequest({ goal: 'ok', deadline: '2026-10-14', consent: true }, today)).toEqual({});
    expect(validateContactRequest({ goal: 'ok', consent: false }, today).consent).toBe('consent_required');
  });

  let rpc: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.resetModules();
    rpc = vi.fn(async (name: string) => (name === 'my_consents'
      ? { data: [{ kind: 'cgu_non_circumvention', version: NON_CIRCUMVENTION_VERSION, context_id: null, created_at: '' }], error: null }
      : { data: 'req-1', error: null }));
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc }) }));
    vi.doMock('@/lib/auth/session', () => ({ getSession: async () => ({ userId: 'brand-1', roles: ['business'], primary: 'business' }) }));
    vi.doMock('@/i18n/dictionaries', () => ({ getDictionary: async () => ({ locale: 'fr', t: fr }) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));
  });
  const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

  it('an unticked consent never reaches the RPC; a valid one sends the clause version', async () => {
    const { requestPartnerAction } = await import('../app/(app)/business/partners/actions');
    const bad = await requestPartnerAction({ error: null }, form({ partner_id: 'p1', goal: 'Lancer notre menu' }));
    expect(bad).toMatchObject({ field: 'consent', error: fr.partnerRequest.errors.consent_required });
    expect(rpc).not.toHaveBeenCalled();
    await expect(requestPartnerAction({ error: null }, form({ partner_id: 'p1', goal: '  Lancer   notre menu ', consent: 'on' }))).rejects.toThrow('REDIRECT /business/partners?sent=1');
    expect(rpc).toHaveBeenCalledWith('request_partner_contact', expect.objectContaining({ p_partner_id: 'p1', p_goal: 'Lancer notre menu', p_consent_version: NON_CIRCUMVENTION_VERSION }));
  });
  it('server codes map to the spec copy (too_many_requests)', async () => {
    rpc.mockImplementation(async (name: string) => (name === 'my_consents'
      ? { data: [{ kind: 'cgu_non_circumvention', version: NON_CIRCUMVENTION_VERSION }], error: null }
      : { data: null, error: { message: 'too_many_requests' } }));
    const { requestPartnerAction } = await import('../app/(app)/business/partners/actions');
    const r = await requestPartnerAction({ error: null }, form({ partner_id: 'p1', goal: 'ok', consent: 'on' }));
    expect(r.error).toBe(fr.partnerRequest.errors.too_many_requests);
  });
  it('PG-6: refuses (fail closed) when the current acknowledgement is not on record or unreadable', async () => {
    const { requestPartnerAction } = await import('../app/(app)/business/partners/actions');
    for (const res of [{ data: [{ kind: 'cgu_non_circumvention', version: '2025-01-01' }], error: null }, { data: null, error: { message: 'boom' } }]) {
      rpc.mockImplementation(async (name: string) => (name === 'my_consents' ? res : { data: 'req-1', error: null }));
      const r = await requestPartnerAction({ error: null }, form({ partner_id: 'p1', goal: 'ok', consent: 'on' }));
      expect(r).toMatchObject({ error: fr.consent.requiredError, code: 'consent_not_recorded' });
      expect(rpc).not.toHaveBeenCalledWith('request_partner_contact', expect.anything());
    }
    expect(src('app/(app)/business/retainers/actions.ts')).toContain('currentConsentRecorded()');
  });
});

describe('G3 retainers only to assigned partners', () => {
  const rows = [
    { id: 'a1', partner_id: 'p1', brand_id: 'b1', status: 'active' as const },
    { id: 'a2', partner_id: 'p2', brand_id: 'b1', status: 'ended' as const },
    { id: 'a3', partner_id: 'p1', brand_id: 'b1', status: 'active' as const, campaign_id: 'c1' },
    { id: 'a4', partner_id: 'p3', brand_id: 'b2', status: 'active' as const },
  ];
  it('only ACTIVE assignments of this brand, one entry per partner', () => {
    expect(retainerPartnerIds(rows, 'b1')).toEqual(['p1']);
    expect(canProposeRetainer(rows, 'b1', 'p1')).toBe(true);
    expect(canProposeRetainer(rows, 'b1', 'p2')).toBe(false);
    expect(canProposeRetainer(rows, 'b1', 'p3')).toBe(false);
  });
  it('the form is a select of assignments; partner_not_assigned sends to a request', () => {
    expect(src('app/(app)/business/retainers/new/page.tsx')).toContain("myAssignments(session.userId, 'brand')");
    expect(src('app/(app)/business/retainers/retainer-form.tsx')).toContain('<select id="ret-partner" name="consultant"');
    expect(src('app/(app)/business/retainers/retainer-form.tsx')).not.toContain('Partenaire (identifiant)');
    expect(src('app/(app)/business/retainers/actions.ts')).toContain("msg === 'partner_not_assigned'");
  });
  it('the public partner CTA has no cold message or retainer link (§2.1)', () => {
    expect(brandCtaState({ signedIn: false, roles: [], status: null, pendingRequest: false, activeAssignment: null })).toEqual({ kind: 'signup' });
    expect(brandCtaState({ signedIn: true, roles: ['business'], status: 'pending_review', pendingRequest: false, activeAssignment: null }).kind).toBe('not_approved');
    expect(brandCtaState({ signedIn: true, roles: ['business'], status: 'active', pendingRequest: true, activeAssignment: null }).kind).toBe('pending');
    expect(brandCtaState({ signedIn: true, roles: ['business'], status: 'active', pendingRequest: false, activeAssignment: { conversationId: 'c' } })).toEqual({ kind: 'assigned', conversationId: 'c' });
    expect(brandCtaState({ signedIn: true, roles: ['creator'], status: 'active', pendingRequest: false, activeAssignment: null }).kind).toBe('none');
    const cta = src('components/profile-contact-cta.tsx');
    const consultantBranch = cta.slice(cta.indexOf("if (kind === 'consultant')"), cta.indexOf('// Creators — logged-in brand'));
    expect(consultantBranch).not.toContain('intent=message');
    expect(consultantBranch).toContain('/business/partners/request?partner=');
  });
});

describe('G8 screenshot compression and hash', () => {
  const blob = (n: number) => ({ size: n }) as Blob;
  it('steps quality down until ≈ 300 KB and keeps the first hit', async () => {
    const sizes: Record<number, number> = { 0.82: 900_000, 0.72: 500_000, 0.62: 290_000, 0.52: 200_000 };
    const seen: number[] = [];
    const out = await compressToTarget(async (q) => { seen.push(q); return blob(sizes[q] ?? 100_000); });
    expect(out?.quality).toBe(0.62);
    expect(out?.blob.size).toBeLessThanOrEqual(TARGET_BYTES);
    expect(seen).toEqual([0.82, 0.72, 0.62]);
    expect(out?.tooLarge).toBe(false);
  });
  it('keeps the smallest result and flags > 5 MB', async () => {
    const out = await compressToTarget(async () => blob(MAX_BYTES + 1));
    expect(out?.tooLarge).toBe(true);
    expect(await compressToTarget(async () => null)).toBeNull();
    expect(QUALITY_STEPS.length).toBeGreaterThan(3);
  });
  it('fits the longest side within 1600 px without upscaling', () => {
    expect(fitWithin(1080, 2400)).toEqual({ width: 720, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('SHA-256 hex of the final bytes (known vector)', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('path follows the contract and retries twice', async () => {
    expect(proofPath('u1', 'cc1', 'a b/c?d', 'webp')).toBe('u1/cc1/abcd.webp');
    let n = 0;
    await expect(withRetry(async () => { n++; if (n < 3) throw new Error('net'); return 'ok'; })).resolves.toBe('ok');
    n = 0;
    await expect(withRetry(async () => { n++; throw new Error('net'); })).rejects.toThrow('net');
    expect(n).toBe(3);
    expect(isAcceptedType('image/webp')).toBe(true);
    expect(isAcceptedType('image/gif')).toBe(false);
  });
});

describe('G9 city picker with « Autre »', () => {
  const CM = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua'];
  it('filters accent- and case-insensitively, prefix first', () => {
    expect(foldCity(' Yaoundé ')).toBe('yaounde');
    expect(filterCities(CM, 'yaou')).toEqual(['Yaoundé']);
    expect(filterCities(CM, 'OU')[0]).toBe('Douala');
    expect(filterCities(CM, '')).toEqual(CM);
  });
  it('resolves a listed city to its spelling, « Autre » text as typed', () => {
    expect(resolveCity(CM, 'yaounde')).toEqual({ city: 'Yaoundé', inList: true, error: null });
    expect(resolveCity(CM, OTHER_CITY, '  Kribi  ')).toEqual({ city: 'Kribi', inList: false, error: null });
    expect(resolveCity(CM, OTHER_CITY, 'douala')).toEqual({ city: 'Douala', inList: true, error: null });
    expect(resolveCity(CM, OTHER_CITY, '').error).toBe('required');
    expect(resolveCity(CM, OTHER_CITY, 'x'.repeat(61)).error).toBe('too_long');
  });
  it('a stored free-text city opens on « Autre » with its text (the 167-char legacy case too)', () => {
    expect(initialCityChoice(CM, 'Douala')).toEqual({ choice: 'Douala', other: '' });
    expect(initialCityChoice(CM, 'Limbé')).toEqual({ choice: OTHER_CITY, other: 'Limbé' });
  });
  it('the server reads city_choice / city_other, falling back to city', () => {
    const fd = (o: Record<string, string>) => (k: string) => o[k] ?? null;
    expect(cityFromForm(fd({ city_choice: 'Douala', city_other: 'x' }))).toBe('Douala');
    expect(cityFromForm(fd({ city_choice: OTHER_CITY, city_other: 'Kribi' }))).toBe('Kribi');
    expect(cityFromForm(fd({ city_choice: '', city_other: 'Ebolowa' }))).toBe('Ebolowa');
    expect(cityFromForm(fd({ city: 'Limbé' }))).toBe('Limbé');
  });
  it('renders a native select + text input before hydration (works without JS), country first', async () => {
    const { CountryCityFields } = await import('../components/gov/city-picker');
    const L = { country: 'Pays', city: 'Ville', placeholder: 'p', other: 'Autre ville…', otherLabel: 'Nom de votre ville', noMatch: 'n', countryChanged: 'c', cityHelp: 'h', tip: 't', aria: 'Aide : {section}', overLimit: 'o' };
    const html = renderToStaticMarkup(createElement(CountryCityFields, { cities: { CM }, countries: [{ code: 'CM', label: 'Cameroun' }], defaultCountry: 'CM', defaultCity: 'Kribi', L }));
    expect(html.indexOf('name="country"')).toBeLessThan(html.indexOf('name="city_choice"'));
    expect(html).toContain(`value="${OTHER_CITY}"`);
    expect(html).toContain('Autre ville…');
    expect(html).toContain('name="city_other"');
  });
});

describe('G7 consent modal gating', () => {
  const base = { consents: [] as { kind: string; version: string }[], version: NON_CIRCUMVENTION_VERSION };
  it('partners and brands without the current version see it once; others never', () => {
    expect(needsConsent({ ...base, roles: ['consultant'], primary: 'consultant' })).toBe(true);
    expect(needsConsent({ ...base, roles: ['business'], primary: 'business' })).toBe(true);
    expect(needsConsent({ ...base, roles: ['creator'], primary: 'creator' })).toBe(false);
    expect(needsConsent({ ...base, roles: ['super_admin', 'business'], primary: 'super_admin' })).toBe(false);
    expect(needsConsent({ ...base, roles: ['business'], primary: 'business', consents: [{ kind: 'cgu_non_circumvention', version: NON_CIRCUMVENTION_VERSION }] })).toBe(false);
    expect(needsConsent({ ...base, roles: ['business'], primary: 'business', consents: [{ kind: 'cgu_non_circumvention', version: '2025-01-01' }] })).toBe(true);
    expect(needsConsent({ ...base, roles: ['business'], primary: 'business', path: '/legal' })).toBe(false);
    expect(CONSENT_VERSION_RE.test(NON_CIRCUMVENTION_VERSION)).toBe(true);
    // PG-6: unreadable consents fail closed (the modal shows).
    expect(needsConsent({ ...base, roles: ['business'], primary: 'business', consents: null })).toBe(true);
    expect(needsConsent({ ...base, roles: ['creator'], primary: 'creator', consents: null })).toBe(false);
  });
  it('the modal is a native dialog, not dismissable, with a sign-out exit; mounted from the (app) layout only', () => {
    const m = src('components/gov/consent-modal.tsx');
    expect(m).toContain('showModal');
    expect(m).toContain("addEventListener('cancel'");
    expect(m).toContain('signOutAction');
    expect(src('app/(app)/layout.tsx')).toContain('<ConsentModal');
    expect(src('app/(public)/legal/page.tsx')).not.toContain('ConsentModal');
    expect(src('app/(auth)/onboarding/actions.ts')).toContain("record_consent', { p_kind: 'cgu_non_circumvention'");
  });
});

describe('threads, overview, error mapping', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  it('§3.2 states', () => {
    expect(threadMode({ context: 'campaign_creator', frozenReason: null, expiresAt: null, fundedRetainer: false })).toBe('normal');
    expect(threadMode({ context: 'partner_assignment', frozenReason: null, expiresAt: future, fundedRetainer: false })).toBe('masked');
    expect(threadMode({ context: 'retainer', frozenReason: null, expiresAt: null, fundedRetainer: true })).toBe('signed');
    expect(threadMode({ context: 'partner_assignment', frozenReason: null, expiresAt: past, fundedRetainer: false })).toBe('expired');
    expect(threadMode({ context: 'partner_assignment', frozenReason: 'member_suspended', expiresAt: future, fundedRetainer: false })).toBe('suspended');
    expect(threadMode({ context: 'partner_assignment', frozenReason: 'assignment_ended', expiresAt: future, fundedRetainer: false })).toBe('closed');
    expect(modeFromSendError('conversation_expired')).toBe('expired');
    expect(modeFromSendError('rate_limited')).toBeNull();
  });
  it('unknown codes fall back', () => {
    expect(mapCode({ a: 'A' }, 'a', 'F')).toBe('A');
    expect(mapCode({ a: 'A' }, 'zzz', 'F')).toBe('F');
  });
  it('the overview JSON is normalised defensively', () => {
    const o = normalizeOverview({ partner: { id: 'p', handle: 'h', display_name: 'D', status: 'active', specialties_legacy: [] }, flags: { open: '2' } });
    expect(o?.partner.directory_listed).toBe(true);
    expect(o?.partner.specialties_legacy).toBeNull();
    expect(o?.flags.open).toBe(2);
    expect(o?.links).toEqual([]);
    expect(normalizeOverview(null)).toBeNull();
  });
});

describe('PG-2 / PG-3 admin partner page', () => {
  it('every deal, retainer, settlement and campaign status has an FR and EN label', () => {
    const enums = {
      dealStatus: ['invited', 'applied', 'approved', 'rejected', 'content_submitted', 'verified', 'paid', 'disputed'],
      retainerStatus: ['draft', 'invoiced', 'funded', 'active', 'completed', 'terminated'],
      settlementStatus: ['pending', 'paid'],
      campaignStatus: ['draft', 'pending_funding', 'published', 'in_progress', 'under_review', 'completed', 'disputed', 'cancelled'],
      linkStatus: ['pending', 'active', 'declined', 'ended'],
    } as const;
    for (const d of [fr, en]) for (const [k, vals] of Object.entries(enums)) for (const v of vals) expect((d.adminPartners as any)[k][v], `${k}.${v}`).toBeTruthy();
    const page = src('app/(app)/admin/partners/[id]/page.tsx');
    expect(page).toContain('A.dealStatus');
    expect(page).toContain('A.retainerStatus');
    expect(page).toContain('A.settlementStatus');
    expect(src('app/(app)/admin/partners/_components/partner-actions.tsx')).toContain('A.campaignStatus');
  });
  it('assign / retainer are disabled with a reason for delisted, suspended, pending or rejected partners', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
    vi.doMock('../app/(app)/admin/partners/actions', () => ({ setListingAction: vi.fn(), assignPartnerAction: vi.fn(), adminProposeRetainerAction: vi.fn(), brandCampaignsAction: vi.fn(), searchBrandsAction: vi.fn() }));
    const { PartnerActions } = await import('../app/(app)/admin/partners/_components/partner-actions');
    const html = renderToStaticMarkup(createElement(PartnerActions, { A: fr.adminPartners, partnerId: 'p', name: 'P', listed: false, fmt: 'fr', blocked: fr.adminPartners.blocked.delisted }));
    expect((html.match(/disabled=""/g) ?? []).length).toBe(2);
    expect(html).toContain('id="pa-blocked"');
    expect(html).toContain(fr.adminPartners.blocked.delisted.slice(0, 10));
    const ok = renderToStaticMarkup(createElement(PartnerActions, { A: fr.adminPartners, partnerId: 'p', name: 'P', listed: true, fmt: 'fr' }));
    expect(ok).not.toContain('disabled=""');
    vi.doUnmock('../app/(app)/admin/partners/actions');
    expect(src('app/(app)/admin/partners/[id]/page.tsx')).toContain("p.status === 'suspended' ? A.blocked.suspended");
  });
});

describe('dictionaries for partner governance: parity, typography, tips, no [À CONFIRMER]', () => {
  const NS = ['adminPartners', 'partnerRequest', 'businessPartners', 'partnerAssignments', 'specialties', 'messaging', 'proofShots', 'cityPicker', 'consent', 'legal'] as const;
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [`${p}${Array.isArray(o) ? `[${o.length}]` : ''}`];
  const F = fr as unknown as Record<string, unknown>;
  const E = en as unknown as Record<string, unknown>;
  it('same keys and array lengths in FR and EN', () => {
    for (const n of NS) expect(keys(E[n]).sort(), n).toEqual(keys(F[n]).sort());
  });
  it('French typography', () => {
    const s = JSON.stringify(NS.map((n) => F[n]));
    expect(s).not.toMatch(/ [:?!;%]/);
    expect(s).not.toMatch(/« | »/);
  });
  it('every §9 tooltip exists and is ≤ 200 characters; no reward words', () => {
    const tips = [
      ...Object.values((F.adminPartners as any).tips), (F.partnerRequest as any).tips.goal, (F.businessPartners as any).tips.window,
      (F.partnerAssignments as any).tips.howItWorks, (F.specialties as any).tip, (F.specialties as any).publicTip,
      (F.messaging as any).tips.masked, (F.messaging as any).tips.why, (F.proofShots as any).tip, (F.proofShots as any).reviewTip, (F.cityPicker as any).tip,
    ] as string[];
    expect(tips).toHaveLength(20);
    for (const v of tips) { expect(v).toBeTruthy(); expect(v.length).toBeLessThanOrEqual(200); }
    const blob = JSON.stringify(NS.map((n) => [F[n], E[n]])).toLowerCase();
    for (const w of [/gagne/, /r[ée]compense/, /(?<!kpi )\bbonus\b(?! kpi)/, /reward/, /\bearn/, /cadeau/, /interdit/, /fraude/]) expect(blob, String(w)).not.toMatch(w);
  });
  it('no « [À CONFIRMER] » in the messages or the legal page; decided retention values are published', () => {
    for (const d of [fr, en]) expect(JSON.stringify(d)).not.toMatch(/À CONFIRMER|TO CONFIRM|TO BE CONFIRMED/);
    expect(src('app/(public)/legal/page.tsx')).not.toMatch(/À CONFIRMER/);
    expect(fr.legal.privacy.logs.body).toContain('12 mois');
    expect(fr.legal.privacy.logs.body).toContain('5 ans');
    expect(fr.legal.privacy.proofs.body).toContain('30 jours');
    expect(fr.legal.privacy.messages.body).toContain('90 jours');
    expect(fr.legal.nonCircumvention.body[0]).toContain('12 mois');
    expect(fr.legal.privacy.rights.body).toContain('support@bayele.com');
    expect(src('app/(public)/legal/page.tsx')).toContain("sub('non-contournement'");
  });
  it('decline reason labels match the server notification labels (contract §4)', () => {
    const R = fr.adminPartners.requests.reasons;
    expect([R.incomplete.label, R.brand_unverified.label, R.poor_fit.label, R.suspected_offplatform.label, R.other.label])
      .toEqual(['Demande incomplète', 'Compte marque à compléter', 'Partenaire peu adapté à ce besoin', 'Échanges hors plateforme suspectés', 'Autre motif']);
  });
});

describe('PG-12 consent_required details (brand / partner)', () => {
  const consented = { data: [{ kind: 'cgu_non_circumvention', version: NON_CIRCUMVENTION_VERSION }], error: null };
  function mocks(fail: { message: string; details?: string }) {
    vi.resetModules();
    const rpc = vi.fn(async (name: string) => (name === 'my_consents' ? consented : { data: null, error: fail }));
    const from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'p1' } }) }) }) });
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc, from }) }));
    vi.doMock('@/lib/auth/session', () => ({ getSession: async () => ({ userId: 'brand-1', roles: ['business'], primary: 'business' }) }));
    vi.doMock('@/i18n/dictionaries', () => ({ getDictionary: async () => ({ locale: 'fr', t: fr }) }));
    vi.doMock('next/cache', () => ({ revalidatePath: vi.fn() }));
    vi.doMock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));
    return rpc;
  }
  const retainerForm = () => { const f = new FormData(); f.set('consultant', 'partner1'); f.set('contract', '1000000'); f.set('fee', '450000'); f.set('media', '300000'); f.set('kpi', '0'); return f; };

  it('propose_retainer: partner → « Ce partenaire doit d’abord accepter… » (no « prévenu »: no notification is sent)', async () => {
    mocks({ message: 'consent_required', details: 'partner' });
    const { createRetainerAction } = await import('../app/(app)/business/retainers/actions');
    expect(await createRetainerAction({ error: null }, retainerForm())).toEqual({ error: fr.consent.partnerRequired });
    expect(fr.consent.partnerRequired).not.toMatch(/prévenu/);
    expect(en.consent.partnerRequired).toMatch(/Try again later or contact Bayele/);
  });
  it('propose_retainer: brand → reload and accept the rule', async () => {
    mocks({ message: 'consent_required', details: 'brand' });
    const { createRetainerAction } = await import('../app/(app)/business/retainers/actions');
    expect(await createRetainerAction({ error: null }, retainerForm())).toEqual({ error: fr.consent.requiredError });
  });
  it('request_partner_contact: brand details → reload message; no details → the tick-box message', async () => {
    mocks({ message: 'consent_required', details: 'brand' });
    let mod = await import('../app/(app)/business/partners/actions');
    const f = () => { const x = new FormData(); x.set('partner_id', 'p1'); x.set('goal', 'ok'); x.set('consent', 'on'); return x; };
    expect(await mod.requestPartnerAction({ error: null }, f())).toMatchObject({ error: fr.consent.requiredError, field: null, code: 'consent_required' });
    mocks({ message: 'consent_required' });
    mod = await import('../app/(app)/business/partners/actions');
    expect(await mod.requestPartnerAction({ error: null }, f())).toMatchObject({ error: fr.partnerRequest.errors.consent_required, field: 'consent' });
  });
});
