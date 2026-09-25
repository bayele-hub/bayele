import { describe, it, expect } from 'vitest';
import { roleSlug, roleFromSlug, roleDashboardPath, onboardingPath } from './roles';

describe('public role naming (Consultant is presented as Partner)', () => {
  it('maps the internal consultant role to the partner slug', () => {
    expect(roleSlug('consultant')).toBe('partner');
    expect(roleSlug('creator')).toBe('creator');
    expect(roleSlug('business')).toBe('business');
  });

  it('resolves both the public slug and legacy links to the internal role', () => {
    expect(roleFromSlug('partner')).toBe('consultant');
    expect(roleFromSlug('consultant')).toBe('consultant');
    expect(roleFromSlug('Creator')).toBe('creator');
    expect(roleFromSlug('super_admin')).toBeNull();
    expect(roleFromSlug(undefined)).toBeNull();
  });

  it('never exposes /consultant in generated URLs', () => {
    expect(roleDashboardPath('consultant')).toBe('/partner/dashboard');
    expect(onboardingPath('consultant')).toBe('/onboarding/partner');
    for (const r of ['creator', 'consultant', 'business'] as const) {
      expect(roleDashboardPath(r)).not.toContain('consultant');
      expect(onboardingPath(r)).not.toContain('consultant');
    }
  });
});
