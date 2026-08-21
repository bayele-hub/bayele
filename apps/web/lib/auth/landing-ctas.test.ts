import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { landingCtaHrefs, isAuthFunnel, AUTH_FUNNEL } from './landing-ctas';

describe('AUTH_FUNNEL matcher', () => {
  it('matches auth-funnel hrefs', () => {
    for (const h of ['/auth', '/auth?mode=signup', '/auth?mode=signin', '/auth/callback', '/auth#x']) {
      expect(isAuthFunnel(h)).toBe(true);
    }
  });
  it('does not match app or lookalike hrefs', () => {
    for (const h of ['/dashboard', '/creators', '/consultants', '/authentic', '/legal', 'https://x/auth']) {
      expect(isAuthFunnel(h)).toBe(false);
    }
    // sanity: the exported regex is anchored at the start
    expect(AUTH_FUNNEL.test('/x/auth')).toBe(false);
  });
});

describe('landingCtaHrefs — logged-in visitors are never sent into the signup/sign-in funnel', () => {
  const authed = landingCtaHrefs(true);

  it('routes every CTA into the app, never to /auth', () => {
    // Iterating the whole object means ANY slot added to the resolver is automatically guarded.
    for (const [slot, href] of Object.entries(authed)) {
      if (href === null) continue;
      expect(isAuthFunnel(href), `authed CTA "${slot}" must not point at /auth (got ${href})`).toBe(false);
    }
  });

  it('hides the sign-in link entirely when authed', () => {
    expect(authed.headerSignin).toBeNull();
  });

  it('points the primary CTAs at the dashboard, and hero browse at the directory', () => {
    expect(authed.heroPrimary).toBe('/dashboard');
    expect(authed.splitBrand).toBe('/dashboard');
    expect(authed.splitCreator).toBe('/dashboard');
    expect(authed.finalPrimary).toBe('/dashboard');
    expect(authed.headerPrimary).toBe('/dashboard');
    expect(authed.heroSecondary).toBe('/creators');
  });
});

describe('landingCtaHrefs — logged-out visitors still get the signup funnel', () => {
  const anon = landingCtaHrefs(false);

  it('routes the primary conversion CTAs into the signup funnel', () => {
    for (const slot of ['heroPrimary', 'splitBrand', 'splitCreator', 'finalPrimary', 'headerPrimary'] as const) {
      expect(isAuthFunnel(anon[slot]), `anon CTA "${slot}" should enter the funnel`).toBe(true);
    }
    expect(anon.headerSignin).toBe('/auth?mode=signin');
  });

  it('preserves role intent on the role-specific CTAs', () => {
    expect(anon.heroPrimary).toContain('role=business');
    expect(anon.splitCreator).toContain('role=creator');
  });
});

// Drift guard: the landing files must resolve auth hrefs through landing-ctas, never hard-code them.
// If someone drops an `/auth?mode=signup|signin` link straight into the JSX (the exact regression this
// suite exists to prevent), these fail — even if it's wrapped in the right auth check today.
describe('no hard-coded auth CTAs in the landing surface', () => {
  const files = {
    'app/(public)/page.tsx': '../../app/(public)/page.tsx',
    'components/site-header.tsx': '../../components/site-header.tsx',
  };
  for (const [name, rel] of Object.entries(files)) {
    it(`${name} has no inline /auth?mode= literal`, () => {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
      expect(src, `${name} should route auth CTAs through landingCtaHrefs`).not.toMatch(/\/auth\?mode=(signup|signin)/);
    });
  }
});
