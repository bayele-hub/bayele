import { describe, it, expect } from 'vitest';
import { withNext, continueTarget } from './return-path';
import { creatorAllowed, creatorTabs } from './creator-gate';
import { alertSignupHref } from './campaign-ctas';

const ALERT_NEXT = '/creator/campaigns?alert_country=NG&alert_cat=beaute#alertes';

describe('withNext — carries the return path, encoded', () => {
  it('round-trips the alert return (query + #alertes) through one URL param', () => {
    const href = withNext('/onboarding/creator', ALERT_NEXT);
    expect(new URL(href, 'https://bayele.com').searchParams.get('next')).toBe(ALERT_NEXT);
    // the fragment is inside the param, not the URL's own hash
    expect(new URL(href, 'https://bayele.com').hash).toBe('');
  });
  it('survives every hop: sign-up link → callback → dashboard → onboarding → done', () => {
    let next = new URL(alertSignupHref({ country: 'NG', cat: 'beaute' }), 'https://x').searchParams.get('next');
    for (const hop of ['/auth/callback', '/dashboard', '/onboarding/creator', '/onboarding/done']) {
      next = new URL(withNext(hop, next), 'https://x').searchParams.get('next');
    }
    expect(next).toBe(ALERT_NEXT);
  });
  it('appends with & when the path already has a query', () => {
    expect(withNext('/auth/callback?code=1', '/x')).toBe('/auth/callback?code=1&next=%2Fx');
  });
  it('drops unsafe values', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil', null, undefined, '']) expect(withNext('/dashboard', bad)).toBe('/dashboard');
  });
});

describe('continueTarget', () => {
  it('active and pending_review users continue to next', () => {
    expect(continueTarget('active', ALERT_NEXT)).toBe(ALERT_NEXT);
    expect(continueTarget('pending_review', ALERT_NEXT)).toBe(ALERT_NEXT);
  });
  it('suspended / rejected / unknown keep their status screen', () => {
    for (const s of ['suspended', 'rejected', null, undefined]) expect(continueTarget(s, ALERT_NEXT)).toBeNull();
  });
  it('never returns an external URL', () => expect(continueTarget('active', '//evil.com')).toBeNull());
});

describe('creator gate', () => {
  const c = (status: string | null) => ({ roles: ['creator'], primary: 'creator', status });
  it('pending creators get campaigns only', () => {
    expect(creatorAllowed(c('pending_review'), 'campaigns')).toBe(true);
    expect(creatorAllowed(c('pending_review'), 'workspace')).toBe(false);
  });
  it('active creators get everything; suspended/rejected/no profile get nothing', () => {
    expect(creatorAllowed(c('active'), 'workspace')).toBe(true);
    for (const s of ['suspended', 'rejected', null]) {
      expect(creatorAllowed(c(s), 'campaigns')).toBe(false);
      expect(creatorAllowed(c(s), 'workspace')).toBe(false);
    }
  });
  it('admins bypass; non-creators are refused', () => {
    expect(creatorAllowed({ roles: ['super_admin'], primary: 'super_admin', status: 'active' }, 'workspace')).toBe(true);
    expect(creatorAllowed({ roles: ['business'], primary: 'business', status: 'active' }, 'campaigns')).toBe(false);
  });
  it('pending creators see bouncing tabs as disabled, Campagnes and Profil enabled', () => {
    const tabs = creatorTabs(c('pending_review'));
    expect(tabs.filter((t) => !t.disabled).map((t) => t.href)).toEqual(['/creator/campaigns', '/profile']);
    expect(creatorTabs(c('active')).every((t) => !t.disabled)).toBe(true);
  });
});

// Drift guard: every creator workspace page other than /creator/campaigns must re-check
// 'workspace' access, because the layout also admits pending_review creators.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
describe('creator pages enforce the gate', () => {
  const dir = fileURLToPath(new URL('../../app/(app)/creator/', import.meta.url));
  const pages = readdirSync(dir).filter((d) => statSync(dir + d).isDirectory() && d !== 'campaigns');
  it('found the workspace pages', () => expect(pages.sort()).toEqual(expect.arrayContaining(['dashboard', 'partner', 'wallet'])));
  for (const d of pages) {
    it(`/creator/${d} requires workspace access`, () => {
      expect(readFileSync(`${dir}${d}/page.tsx`, 'utf8')).toMatch(/creatorAllowed\([^)]*\}, 'workspace'\)/);
    });
  }
});
