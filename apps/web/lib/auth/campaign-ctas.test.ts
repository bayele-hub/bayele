import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isAuthFunnel } from './landing-ctas';
import {
  boardPageCta,
  boardCtaKey,
  campaignCardHref,
  campaignWallHrefs,
  alertSignupHref,
  canSeeAlertOptIn,
  campaignShareUrl,
  sharesWithRef,
  whatsappHref,
  type CampaignViewer,
} from './campaign-ctas';

const guest: CampaignViewer = { userId: null, primary: null, handle: null };
const creator: CampaignViewer = { userId: 'u1', primary: 'creator', handle: 'awa_creates', status: 'active' };
const pendingCreator: CampaignViewer = { userId: 'u2', primary: 'creator', handle: 'new_one', status: 'pending_review' };
const suspendedCreator: CampaignViewer = { userId: 'u3', primary: 'creator', handle: 'sus', status: 'suspended' };
const notOnboarded: CampaignViewer = { userId: 'u4', primary: null, handle: null };
const partner: CampaignViewer = { userId: 'u5', primary: 'consultant', handle: 'agence_x', status: 'active' };
const brand: CampaignViewer = { userId: 'u6', primary: 'business', handle: 'djino', status: 'active' };
const admin: CampaignViewer = { userId: 'u7', primary: 'super_admin', handle: 'root', status: 'active' };
const signedIn = [creator, pendingCreator, suspendedCreator, notOnboarded, partner, brand, admin];

const q = (href: string) => new URL(href, 'https://bayele.com').searchParams;

describe('boardPageCta — D5 « Voir toutes les campagnes »', () => {
  it('routes each role to its own workspace', () => {
    expect(boardPageCta(creator).href).toBe('/creator/campaigns');
    expect(boardPageCta(pendingCreator).href).toBe('/creator/campaigns');
    expect(boardPageCta(partner).href).toBe('/partner/campaigns');
    expect(boardPageCta(brand).href).toBe('/business/campaigns/new');
    expect(boardPageCta(admin).href).toBe('/admin/dashboard');
    expect(boardPageCta(notOnboarded).href).toBe('/dashboard');
    expect(boardPageCta(suspendedCreator).href).toBe('/dashboard');
  });

  it('never sends a signed-in viewer into the auth funnel', () => {
    for (const v of signedIn) {
      const c = boardPageCta(v, 'some_ref');
      expect(isAuthFunnel(c.href), `${v.primary} → ${c.href}`).toBe(false);
      expect(c.signinHref).toBeNull();
    }
  });

  it('uses the partner copy key and URL for consultants (never "consultant" in a URL)', () => {
    expect(boardCtaKey(partner)).toBe('partner');
    expect(boardPageCta(partner).href).not.toContain('consultant');
  });

  it('guest: creator sign-up with intent, source and next=/creator/campaigns', () => {
    const c = boardPageCta(guest);
    expect(c.key).toBe('guest');
    expect(isAuthFunnel(c.href)).toBe(true);
    const p = q(c.href);
    expect(p.get('mode')).toBe('signup');
    expect(p.get('role')).toBe('creator');
    expect(p.get('intent')).toBe('campaigns');
    expect(p.get('source')).toBe('campaigns_list');
    expect(p.get('next')).toBe('/creator/campaigns');
    expect(p.has('ref')).toBe(false);
    expect(q(c.signinHref!).get('mode')).toBe('signin');
    expect(q(c.signinHref!).get('next')).toBe('/creator/campaigns');
  });

  it('guest with a ref: forwards it and attributes the sign-up to the referral', () => {
    const p = q(boardPageCta(guest, 'awa_creates').href);
    expect(p.get('ref')).toBe('awa_creates');
    expect(p.get('source')).toBe('referral');
  });
});

describe('campaign cards — soft wall: everyone opens the campaign page', () => {
  it('links to /campaigns/<id> for every viewer', () => {
    for (const v of [guest, ...signedIn]) expect(campaignCardHref('abc-123', v)).toBe('/campaigns/abc-123');
  });
  it('keeps a guest’s ref through to the campaign page, never for signed-in viewers', () => {
    expect(campaignCardHref('abc', guest, 'awa_creates')).toBe('/campaigns/abc?ref=awa_creates');
    expect(campaignCardHref('abc', creator, 'awa_creates')).toBe('/campaigns/abc');
  });
});

describe('campaignWallHrefs — locked brief panel', () => {
  it('sign-up returns to the campaign with apply intent and campaign_page source', () => {
    const { signup, signin } = campaignWallHrefs('c1');
    const p = q(signup);
    expect(p.get('intent')).toBe('apply');
    expect(p.get('target')).toBe('c1');
    expect(p.get('source')).toBe('campaign_page');
    expect(p.get('next')).toBe('/campaigns/c1');
    expect(q(signin).get('next')).toBe('/campaigns/c1');
    expect(q(signin).has('source')).toBe(false);
  });
  it('a ref switches the source to referral', () => {
    const p = q(campaignWallHrefs('c1', 'awa_creates').signup);
    expect(p.get('source')).toBe('referral');
    expect(p.get('ref')).toBe('awa_creates');
  });
});

describe('alertSignupHref — guest alert opt-in', () => {
  it('returns to /creator/campaigns#alertes with the chosen filters', () => {
    const p = q(alertSignupHref({ country: 'NG', cat: 'beaute' }));
    expect(p.get('intent')).toBe('alerts');
    expect(p.get('source')).toBe('campaigns_list');
    expect(p.get('next')).toBe('/creator/campaigns?alert_country=NG&alert_cat=beaute#alertes');
  });
  it('omits empty filters', () => {
    expect(q(alertSignupHref({})).get('next')).toBe('/creator/campaigns#alertes');
  });
  it('carries a ref', () => {
    const p = q(alertSignupHref({ ref: 'awa_creates' }));
    expect(p.get('ref')).toBe('awa_creates');
    expect(p.get('source')).toBe('referral');
  });
});

describe('alert opt-in visibility and share links', () => {
  it('shows the alert form to guests and creators only', () => {
    expect(canSeeAlertOptIn(guest)).toBe(true);
    expect(canSeeAlertOptIn(creator)).toBe(true);
    expect(canSeeAlertOptIn(partner)).toBe(false);
    expect(canSeeAlertOptIn(brand)).toBe(false);
    expect(canSeeAlertOptIn(admin)).toBe(false);
  });
  it('adds ?ref only for signed-in creators and partners', () => {
    expect(campaignShareUrl('c1', creator)).toBe('https://bayele.com/campaigns/c1?ref=awa_creates');
    expect(campaignShareUrl('c1', partner)).toBe('https://bayele.com/campaigns/c1?ref=agence_x');
    for (const v of [guest, brand, admin, notOnboarded]) {
      expect(campaignShareUrl('c1', v)).toBe('https://bayele.com/campaigns/c1');
      expect(sharesWithRef(v)).toBe(false);
    }
  });
  it('builds a wa.me link with the encoded message', () => {
    expect(whatsappHref('a b & c')).toBe('https://wa.me/?text=a%20b%20%26%20c');
  });
});

// Drift guard: the campaign surfaces must resolve auth hrefs through campaign-ctas, never hard-code them.
describe('no hard-coded auth CTAs on the campaign surfaces', () => {
  const rel = (p: string) => fileURLToPath(new URL(p, import.meta.url));
  const files: Record<string, string> = {
    'app/(public)/campaigns/page.tsx': '../../app/(public)/campaigns/page.tsx',
    'app/(public)/campaigns/[id]/page.tsx': '../../app/(public)/campaigns/[id]/page.tsx',
  };
  for (const f of readdirSync(rel('../../components/campaigns'))) {
    if (f.endsWith('.tsx') || f.endsWith('.ts')) files[`components/campaigns/${f}`] = `../../components/campaigns/${f}`;
  }
  for (const [name, path] of Object.entries(files)) {
    it(`${name} has no inline /auth?mode= literal`, () => {
      const src = readFileSync(rel(path), 'utf8');
      expect(src, `${name} should route auth CTAs through campaign-ctas`).not.toMatch(/\/auth\?mode=/);
    });
  }
});
