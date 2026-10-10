import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fr from '../messages/fr.json';
import en from '../messages/en.json';

const src = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8');

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

  it('QA D2: the brand comes from public_campaign_stats, never a direct profiles read (RLS hides brands)', () => {
    const start = data.indexOf('export const getPublicCampaign');
    const fn = data.slice(start, data.indexOf('\n});', start));
    expect(fn).toContain('statsRow(id)');
    expect(fn).not.toMatch(/from\('profiles'\)/);
    expect(data).toMatch(/rpc\('public_campaign_stats'/);
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
