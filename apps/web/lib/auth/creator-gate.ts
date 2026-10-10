/**
 * Creator workspace access by profile status.
 *   - active creators (and admins) use every creator page;
 *   - pending_review creators may already browse, apply and set alerts (migration 0021 lets them
 *     apply; brands can only select verified profiles), so they get /creator/campaigns and nothing else;
 *   - suspended / rejected / not onboarded / not a creator → the /dashboard dispatcher.
 */
export type CreatorArea = 'campaigns' | 'workspace';

export interface CreatorGateInput {
  roles: readonly string[];
  primary: string | null;
  status: string | null | undefined;
}

export function creatorAllowed(s: CreatorGateInput, area: CreatorArea): boolean {
  if (s.primary === 'super_admin') return true;
  if (!s.roles.includes('creator')) return false;
  if (s.status === 'active') return true;
  return area === 'campaigns' && s.status === 'pending_review';
}

export interface CreatorTab {
  href: string;
  label: string;
  icon: 'home' | 'megaphone' | 'wallet' | 'handshake' | 'user';
  /** Rendered as a disabled tab (no link) because the page would bounce this viewer. */
  disabled: boolean;
}

const TABS: (Omit<CreatorTab, 'disabled'> & { area: CreatorArea | 'profile' })[] = [
  { href: '/creator/dashboard', label: 'Accueil', icon: 'home', area: 'workspace' },
  { href: '/creator/campaigns', label: 'Campagnes', icon: 'megaphone', area: 'campaigns' },
  { href: '/creator/wallet', label: 'Portefeuille', icon: 'wallet', area: 'workspace' },
  { href: '/creator/partner', label: 'Partenaire', icon: 'handshake', area: 'workspace' },
  // /profile is outside the creator workspace and open to every onboarded user.
  { href: '/profile', label: 'Profil', icon: 'user', area: 'profile' },
];

/** Creator nav tabs for a viewer; tabs that would bounce them are marked disabled. */
export function creatorTabs(s: CreatorGateInput): CreatorTab[] {
  return TABS.map(({ area, ...t }) => ({ ...t, disabled: area !== 'profile' && !creatorAllowed(s, area) }));
}
