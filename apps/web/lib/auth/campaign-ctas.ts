/**
 * Single source of truth for every auth-dependent href on the PUBLIC CAMPAIGN SURFACES
 * (/campaigns, /campaigns/[id], the home « Campagnes ouvertes » strip, the alert opt-in).
 *
 * Invariants locked by campaign-ctas.test.ts (same drift-guard approach as landing-ctas):
 *   - a signed-in viewer is NEVER routed into the sign-up / sign-in funnel (D5: their own workspace);
 *   - every sign-up link carries `source` (and a validated `ref` when the page was opened with one),
 *     so onboarding can record where the account came from (plan §4.7);
 *   - `next` is always an internal path.
 * Pages must resolve hrefs here instead of hard-coding `/auth?mode=…` in JSX.
 */
import { SITE_URL } from '@/lib/seo';
import { effectiveSource, safeNextPath, type SignupSource } from '@/lib/attribution';
import type { CountryCode } from '@/lib/countries';
import type { CategorySlug } from '@/lib/campaign-categories';

/** Roles as stored in the database. */
export type ViewerRole = 'creator' | 'business' | 'consultant' | 'super_admin';

export interface CampaignViewer {
  /** null = logged out. */
  userId: string | null;
  /** Highest-privilege role (session.primary); null = signed in but not onboarded yet. */
  primary: ViewerRole | null;
  /** Public handle (profiles.handle), used for `?ref=` on shares. */
  handle: string | null;
  /** profiles.status, when a profile exists. */
  status?: string | null;
  /** profiles.country, used to preselect the alert country. */
  country?: string | null;
}

export type BoardCtaKey = 'guest' | 'creator' | 'partner' | 'brand' | 'admin';

export interface BoardPageCta {
  /** Copy key under `campaignBoard.cta`. */
  key: BoardCtaKey;
  href: string;
  /** « Déjà membre ? Se connecter » — guests only. */
  signinHref: string | null;
}

interface AuthLink {
  mode: 'signup' | 'signin';
  role?: 'creator' | 'business';
  intent?: 'campaigns' | 'alerts' | 'apply';
  target?: string;
  source?: SignupSource | null;
  ref?: string | null;
  next?: string;
}

function authHref(a: AuthLink): string {
  const q = new URLSearchParams();
  q.set('mode', a.mode);
  if (a.role) q.set('role', a.role);
  if (a.intent) q.set('intent', a.intent);
  if (a.target) q.set('target', a.target);
  const source = a.mode === 'signup' ? effectiveSource(a.source ?? null, a.ref ?? null) : null;
  if (source) q.set('source', source);
  if (a.mode === 'signup' && a.ref) q.set('ref', a.ref);
  const next = safeNextPath(a.next);
  if (next) q.set('next', next);
  return `/auth?${q.toString()}`;
}

/** Which audience a viewer belongs to (D5; multi-role accounts use `primary`). */
export function boardCtaKey(v: CampaignViewer): BoardCtaKey {
  if (!v.userId) return 'guest';
  switch (v.primary) {
    case 'super_admin':
      return 'admin';
    case 'business':
      return 'brand';
    case 'consultant':
      return 'partner';
    default:
      return 'creator';
  }
}

/** « Voir toutes les campagnes » panel (design §1.6, D5). */
export function boardPageCta(v: CampaignViewer, ref: string | null = null): BoardPageCta {
  const key = boardCtaKey(v);
  switch (key) {
    case 'guest':
      return {
        key,
        href: authHref({ mode: 'signup', role: 'creator', intent: 'campaigns', source: 'campaigns_list', ref, next: '/creator/campaigns' }),
        signinHref: authHref({ mode: 'signin', next: '/creator/campaigns' }),
      };
    case 'admin':
      return { key, href: '/admin/dashboard', signinHref: null };
    case 'brand':
      return { key, href: '/business/campaigns/new', signinHref: null };
    case 'partner':
      return { key, href: '/partner/campaigns', signinHref: null };
    default:
      // Not onboarded yet → the dispatcher finishes onboarding first; suspended/rejected creators are
      // shown their status there too. Everyone else lands in their campaign section.
      if (!v.primary || v.status === 'suspended' || v.status === 'rejected') return { key, href: '/dashboard', signinHref: null };
      return { key, href: '/creator/campaigns', signinHref: null };
  }
}

/**
 * Card link (D1 soft wall: everyone opens the campaign page). A guest who arrived through a share
 * link keeps the `ref` so the campaign page can forward it into its sign-up link (URL-only, C4).
 */
export function campaignCardHref(id: string, v: CampaignViewer, ref: string | null = null): string {
  const path = `/campaigns/${encodeURIComponent(id)}`;
  return !v.userId && ref ? `${path}?ref=${encodeURIComponent(ref)}` : path;
}

/** The locked-brief panel's two links on /campaigns/[id] (design §2.2). */
export function campaignWallHrefs(id: string, ref: string | null = null): { signup: string; signin: string } {
  const next = `/campaigns/${id}`;
  return {
    signup: authHref({ mode: 'signup', role: 'creator', intent: 'apply', target: id, source: 'campaign_page', ref, next }),
    signin: authHref({ mode: 'signin', next }),
  };
}

/** « Vous êtes une marque ? Lancer une campagne » on the empty board (brand sign-up, no creator source). */
export function brandSignupHref(): string {
  return authHref({ mode: 'signup', role: 'business' });
}

/** Where alerts are managed (design §4). */
export function alertsManagePath(): string {
  return '/creator/campaigns#alertes';
}

/**
 * Guest alert opt-in → sign-up, returning to /creator/campaigns with the chosen filters so the
 * creator confirms the alert in one tap there (nothing is written before the account exists).
 */
export function alertSignupHref(opts: { country?: CountryCode | null; cat?: CategorySlug | null; ref?: string | null; source?: SignupSource }): string {
  const back = new URLSearchParams();
  if (opts.country) back.set('alert_country', opts.country);
  if (opts.cat) back.set('alert_cat', opts.cat);
  const qs = back.toString();
  const next = `/creator/campaigns${qs ? `?${qs}` : ''}#alertes`;
  return authHref({ mode: 'signup', role: 'creator', intent: 'alerts', source: opts.source ?? 'campaigns_list', ref: opts.ref ?? null, next });
}

/** Only guests and creators see the alert form; brands, partners and admins get their role CTA. */
export function canSeeAlertOptIn(v: CampaignViewer): boolean {
  const key = boardCtaKey(v);
  return key === 'guest' || key === 'creator';
}

/** True when the viewer's shares carry `?ref=<handle>` (signed-in creators and partners only). */
export function sharesWithRef(v: CampaignViewer): boolean {
  if (!v.userId || !v.handle) return false;
  return v.primary === 'creator' || v.primary === 'consultant';
}

/** Absolute campaign URL for sharing; `?ref=<handle>` only for signed-in creators/partners (design §3). */
export function campaignShareUrl(id: string, v: CampaignViewer): string {
  const url = `${SITE_URL}/campaigns/${encodeURIComponent(id)}`;
  return sharesWithRef(v) ? `${url}?ref=${encodeURIComponent(v.handle as string)}` : url;
}

/** Plain WhatsApp share link (no client JS). */
export function whatsappHref(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
