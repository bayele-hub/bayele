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
  /** Hero primary button — the brand door ("Soumettre un brief"). */
  heroPrimary: string;
  /** Hero secondary button — the creator door ("Créer mon profil" / "Compléter mon profil"). */
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
  /** "Soumettre un brief" — brands get creators through Bayele until the directory opens. */
  brief: string;
  /** "Devenir partenaire" — Partner program signup. */
  partnerJoin: string;
}

/**
 * Resolve every landing CTA href for the given auth state. When authed, all of them stay inside the
 * app (dashboard / profile / brief); none point at `/auth`.
 */
export function landingCtaHrefs(authed: boolean): LandingCtaHrefs {
  if (authed) {
    return {
      heroPrimary: '/dashboard',
      // The creator directory is unlisted until launch, so the secondary door completes the profile.
      heroSecondary: '/profile',
      splitBrand: '/dashboard',
      splitCreator: '/dashboard',
      finalPrimary: '/dashboard',
      headerPrimary: '/dashboard',
      headerSignin: null,
      // Non-business accounts are bounced to /dashboard by the business layout — safe for everyone.
      brief: '/business/campaigns/new',
      partnerJoin: '/dashboard',
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
    brief: '/auth?mode=signup&role=business',
    partnerJoin: '/auth?mode=signup&role=partner',
  };
}
