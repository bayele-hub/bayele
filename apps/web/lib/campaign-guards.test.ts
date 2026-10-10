import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fr from '../messages/fr.json';
import en from '../messages/en.json';

const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');
/** Source without comments (so a comment that names a forbidden column doesn't trip a guard). */
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

// D1 soft wall + migration 0032: anon may not read brief / mandatory_tags / budget / fee, and the
// brief must never reach logged-out HTML, metadata, OpenGraph or JSON-LD.
describe('soft wall — the public campaign query and page never expose the brief', () => {
  const data = src('./data/public-campaigns.ts');
  const publicCols = /const PUBLIC_COLUMNS =\s*'([^']+)'/.exec(data)?.[1] ?? '';

  it('the anon query names only anon-readable columns', () => {
    expect(publicCols).toContain('title');
    for (const col of ['brief', 'mandatory_tags', 'total_budget_fcfa', 'platform_fee_rate', 'match_pass_paid', '*']) {
      expect(publicCols.split(/\s*,\s*/)).not.toContain(col);
    }
  });

  it('getPublicCampaign selects PUBLIC_COLUMNS (no inline column list)', () => {
    const start = data.indexOf('export const getPublicCampaign');
    const fn = data.slice(start, data.indexOf('\n});', start));
    expect(fn).toContain('.select(PUBLIC_COLUMNS)');
    expect(fn).not.toMatch(/brief|mandatory_tags/);
  });

  it('QA D2: the brand comes from public_campaign_stats_v2, never a direct profiles read (RLS hides brands)', () => {
    const start = data.indexOf('export const getPublicCampaign');
    const fn = data.slice(start, data.indexOf('\n});', start));
    expect(fn).toContain('statsRow(id)');
    expect(fn).not.toMatch(/from\('profiles'\)/);
    expect(data).toMatch(/rpc\('public_campaign_stats_v2'/);
  });

  it('the campaign page reads the brief only from the members-only fetch, gated on a session', () => {
    const page = src('../app/(public)/campaigns/[id]/page.tsx');
    expect(page).toMatch(/signedIn \? getCampaignBriefForMember\(c\.id\)/);
    expect(page).not.toMatch(/\bc\.brief\b|c\.mandatoryTags/);
    // metadata + JSON-LD descriptions come from the public teaser
    expect(page).toMatch(/description: teaser\(c, t, locale\)/);
  });

  it('the OG image and the board never touch the brief', () => {
    for (const p of ['../app/(public)/campaigns/[id]/opengraph-image.tsx', '../app/(public)/campaigns/page.tsx', '../components/campaigns/campaign-card.tsx', '../components/campaigns/campaign-ticket.tsx']) {
      expect(src(p), p).not.toMatch(/brief/i);
    }
  });
});

// Council C3 / C6: no referral-reward wording, no unconfirmed « sans limite » claim.
describe('campaign copy rules (council C2, C3, C6)', () => {
  const blob = JSON.stringify({ fr: [fr.campaignBoard, fr.share, fr.alerts], en: [en.campaignBoard, en.share, en.alerts] }).toLowerCase();
  it('no reward wording', () => {
    for (const w of [/gagne/, /r[ée]compense/, /\bbonus/, /reward/, /\bearn/, /\bprimes?\b/, /cadeau/]) expect(blob, String(w)).not.toMatch(w);
  });
  it('no « sans limite » claim', () => {
    expect(blob).not.toContain('sans limite');
    expect(blob).not.toContain('no time limit');
  });
  it('uses « inscription gratuite » wording', () => {
    expect(fr.campaignBoard.wall.body.toLowerCase()).toContain('inscription gratuite');
    expect(fr.alerts.guestHint.toLowerCase()).toContain('inscription gratuite');
  });
  it('FR and EN have the same campaign keys', () => {
    const keys = (o: unknown, p = ''): string[] =>
      o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p];
    for (const ns of ['campaignBoard', 'share', 'alerts'] as const) expect(keys(en[ns]).sort()).toEqual(keys(fr[ns]).sort());
    expect(en.nav.campaigns).toBeTruthy();
  });
  it('French typography: no plain space before : ? ! ; % in the new FR strings', () => {
    const strings = JSON.stringify([fr.campaignBoard, fr.share, fr.alerts, fr.nav.campaigns]);
    expect(strings).not.toMatch(/ [:?!;%]/);
  });
});

// ── Managed campaigns (« Géré par Bayele ») ─────────────────────────────────────────────────────
const PUBLIC_FILES = [
  './data/public-campaigns.ts',
  '../app/(public)/campaigns/page.tsx',
  '../app/(public)/campaigns/[id]/page.tsx',
  '../app/(public)/campaigns/[id]/opengraph-image.tsx',
  '../app/(public)/page.tsx',
  '../components/campaigns/campaign-card.tsx',
  '../components/campaigns/campaign-ticket.tsx',
  '../components/campaigns/card-parts.tsx',
  '../components/campaigns/home-campaigns-strip.tsx',
];

describe('managed campaigns — public reads (contract §0, council R2/R3)', () => {
  it('public pages never call the v1 board/stats (they print the admin name for managed rows)', () => {
    const all = PUBLIC_FILES.map((p) => src(p)).join('\n');
    expect(all).not.toMatch(/['"]public_campaign_board['"]/);
    expect(all).not.toMatch(/['"]public_campaign_stats['"]/);
    const data = src('./data/public-campaigns.ts');
    expect(data).toMatch(/rpc\('public_campaign_board_v2'/);
    expect(data).toMatch(/rpc\('public_campaign_stats_v2'/);
  });

  it('R2: no total budget / fee on any public path', () => {
    for (const p of PUBLIC_FILES) {
      const s = code(p);
      expect(s, p).not.toMatch(/total_budget_fcfa|totalBudget|platform_fee_rate|brand_consent|claims_verified/);
    }
    const data = src('./data/public-campaigns.ts');
    const cols = /const PUBLIC_COLUMNS =\s*'([^']+)'/.exec(data)?.[1]?.split(/\s*,\s*/) ?? [];
    for (const c of ['total_budget_fcfa', 'platform_fee_rate', 'brand_consent', 'claims_verified']) expect(cols).not.toContain(c);
    for (const c of ['is_managed', 'brand_label', 'brand_city', 'language', 'usage_rights', 'creator_requirements', 'equipment']) expect(cols).toContain(c);
  });

  it('managed listings never link a brand handle (v2 returns null; the page forces null too)', () => {
    expect(src('./data/public-campaigns.ts')).toMatch(/brandHandle: managed \? null/);
  });

  it('R3: no « Bayele sélectionne » / « sécurise votre paiement » anywhere in the copy', () => {
    const blob = JSON.stringify({ fr, en }).toLowerCase();
    for (const w of [/bayele s[ée]lectionne/, /s[ée]curise votre paiement/, /bayele selects/, /secures your payment/]) expect(blob, String(w)).not.toMatch(w);
    expect(fr.managed.badge).toBe('Géré par Bayele');
    expect(en.managed.badge).toBe('Managed by Bayele');
    expect(fr.managed.detailLine).toBe('Campagne gérée par Bayele pour la marque · paiement via le séquestre Bayele');
    expect(fr.managed.processLine).toBe('Bayele propose les créateurs, la marque valide.');
  });

  it('K5: no hardcoded WhatsApp number — the CTA reads NEXT_PUBLIC_BAYELE_WHATSAPP only', () => {
    const files = [
      './whatsapp.ts',
      '../components/publish-whatsapp-cta.tsx',
      '../app/(public)/campaigns/page.tsx',
      '../app/(public)/page.tsx',
      '../app/(public)/pricing/page.tsx',
      '../app/(auth)/auth/page.tsx',
      '../app/(app)/business/campaigns/new/campaign-form.tsx',
    ];
    for (const p of files) {
      const s = src(p);
      expect(s, p).not.toMatch(/wa\.me\/\+?\d/);
      expect(s, p).not.toMatch(/\+?(237|225|241|234|254|27)\d{7,}/);
    }
    expect(src('./whatsapp.ts')).toContain('process.env.NEXT_PUBLIC_BAYELE_WHATSAPP');
    const json = JSON.stringify({ fr, en });
    expect(json).not.toMatch(/wa\.me\/\d/);
  });

  it('R6: on /campaigns the brand CTA is only the small footer link', () => {
    const page = src('../app/(public)/campaigns/page.tsx');
    const uses = page.match(/<PublishWhatsAppCta[\s\S]*?\/>/g) ?? [];
    expect(uses).toHaveLength(1);
    expect(uses[0]).toContain('variant="link"');
    expect(uses[0]).toContain('campaignsLink');
  });

  it('the auth page inline WhatsApp message mirrors publishWhatsapp.message (FR)', () => {
    const page = src('../app/(auth)/auth/page.tsx');
    const m = /const WA_MESSAGE_FR =\s*'((?:[^'\\]|\\.)*)'/.exec(page)?.[1] ?? '';
    const decoded = m.replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16))).replace(/\\n/g, '\n').replace(/\\'/g, "'");
    expect(decoded).toBe(fr.publishWhatsapp.message);
  });
});

describe('managed campaigns — dictionaries (FR + EN parity, French typography)', () => {
  const NS = ['managed', 'briefDetails', 'applyCta', 'publishWhatsapp', 'brandForm', 'admin', 'payFloors'] as const;
  const keys = (o: unknown, p = ''): string[] =>
    o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${p}${k}.`)) : [p];

  it('FR and EN have the same keys (and the same array lengths)', () => {
    for (const ns of NS) expect(keys(en[ns]).sort(), ns).toEqual(keys(fr[ns]).sort());
    const arrays = (o: unknown, p = ''): string[] =>
      Array.isArray(o) ? [`${p}${o.length}`] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => arrays(v, `${p}${k}.`)) : [];
    for (const ns of NS) expect(arrays(en[ns]).sort(), ns).toEqual(arrays(fr[ns]).sort());
    expect(en.categories).toHaveLength(fr.categories.length);
  });

  it('French typography: no plain space before : ? ! ; % and no plain space inside « »', () => {
    const s = JSON.stringify(NS.map((ns) => fr[ns]));
    expect(s).not.toMatch(/ [:?!;%]/);
    expect(s).not.toMatch(/« | »/);
  });

  it('no reward wording, alerts stay « dans l’application » (C2/C3), no invented figure in templates copy', () => {
    const blob = JSON.stringify(NS.map((ns) => [fr[ns], en[ns]])).toLowerCase();
    for (const w of [/gagne/, /r[ée]compense/, /\bbonus/, /reward/, /\bearn/, /cadeau/]) expect(blob, String(w)).not.toMatch(w);
  });
});

describe('pay floors — who reads what (round 2)', () => {
  it('the brand form reads pay_floors_public; admin pages keep pay_floor_list', () => {
    for (const p of ['../app/(app)/business/actions.ts', '../app/(app)/business/campaigns/new/page.tsx']) {
      expect(src(p), p).toContain('publicFloorMap');
      expect(src(p), p).not.toContain('listPayFloors');
    }
    const data = src('./data/managed-briefs.ts');
    expect(data).toMatch(/rpc\('pay_floors_public'\)/);
    expect(data).toMatch(/rpc\('pay_floor_list'\)/);
    expect(src('../app/(app)/admin/pay-floors/page.tsx')).toContain('listPayFloors');
  });
  it('« Postuler » errors are localized (no hardcoded FR in applyAction)', () => {
    const a = src('../app/(app)/creator/actions.ts');
    const fn = a.slice(a.indexOf('export async function applyAction'), a.indexOf('export async function submitProofAction'));
    expect(fn).toContain('t.applyCta.errors');
    expect(fn).not.toMatch(/error: '[^']/);
  });
});
