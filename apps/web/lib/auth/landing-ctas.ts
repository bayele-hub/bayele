/**
 * Single source of truth for the auth-dependent CTAs on the PUBLIC LANDING SURFACE
 * (the home page + the shared site header).
 *
 * Centralizing the hrefs here lets a unit test lock one invariant that's easy to regress:
 *   a logged-in visitor is NEVER routed into the signup / sign-in funnel.
 *
 * If you add a CTA to the landing page or header, resolve its href through here rather than
 * hard-coding `/auth?...` in JSX — the test in landing-ctas.test.ts guards every slot returned
 * by `landingCtaHrefs`, and also fails if an `/auth?mode=...` literal reappears in those files.
 */

/** Matches any href that points into the auth funnel (`/auth`, `/auth?...`, `/auth/...`, `/auth#...`). */
export const AUTH_FUNNEL = /^\/auth(?:[/?#]|$)/;

export function isAuthFunnel(href: string): boolean {
  return AUTH_FUNNEL.test(href);
}

export interface LandingCtaHrefs {
  /** Hero primary button. */
  heroPrimary: string;
  /** Hero secondary button. */
  heroSecondary: string;
  /** "For brands" split-card CTA. */
  splitBrand: string;
  /** "For creators" split-card CTA. */
  splitCreator: string;
  /** Bottom final-CTA primary button. */
  finalPrimary: string;
  /** Header primary button — dashboard when authed, else signup. */
  headerPrimary: string;
  /** Header secondary sign-in link — null when authed (nothing to render). */
  headerSignin: string | null;
}

/**
 * Resolve every landing CTA href for the given auth state. When authed, all of them stay inside the
 * app (dashboard / directory); none point at `/auth`.
 */
export function landingCtaHrefs(authed: boolean): LandingCtaHrefs {
  if (authed) {
    return {
      heroPrimary: '/dashboard',
      heroSecondary: '/creators',
      splitBrand: '/dashboard',
      splitCreator: '/dashboard',
      finalPrimary: '/dashboard',
      headerPrimary: '/dashboard',
      headerSignin: null,
    };
  }
  return {
    heroPrimary: '/auth?mode=signup&role=business',
    heroSecondary: '/auth?mode=signup&role=creator',
    splitBrand: '/auth?mode=signup&role=business',
    splitCreator: '/auth?mode=signup&role=creator',
    finalPrimary: '/auth?mode=signup',
    headerPrimary: '/auth?mode=signup',
    headerSignin: '/auth?mode=signin',
  };
}
