// Role naming: internal vs. public.
//
// The database, RLS policies and auth metadata keep the original role names (`consultant`,
// `consultant_profiles`, …) — renaming a Postgres enum is risky and invisible to users. Everything a
// person SEES uses the product name: the `consultant` role is presented as a **Partner** and lives
// under /partner (app area), /partners (public directory) and /onboarding/partner.
//
// Always build role URLs through these helpers instead of interpolating the raw role name.

export type SignupRole = 'creator' | 'consultant' | 'business';

const SLUG: Record<SignupRole, string> = {
  creator: 'creator',
  consultant: 'partner',
  business: 'business',
};

/** Public URL slug for a role (`consultant` → `partner`). */
export function roleSlug(role: SignupRole): string {
  return SLUG[role];
}

/**
 * Internal role for a URL value. Accepts the public slug and, for old links, the internal name
 * (`partner` and `consultant` both resolve to `consultant`). Returns null for anything else.
 */
export function roleFromSlug(value: string | null | undefined): SignupRole | null {
  switch ((value ?? '').toLowerCase()) {
    case 'creator':
      return 'creator';
    case 'business':
      return 'business';
    case 'partner':
    case 'consultant':
      return 'consultant';
    default:
      return null;
  }
}

/** Home of each role's workspace. */
export function roleDashboardPath(role: SignupRole): string {
  return `/${roleSlug(role)}/dashboard`;
}

/** Onboarding page for a role. */
export function onboardingPath(role: SignupRole): string {
  return `/onboarding/${roleSlug(role)}`;
}
