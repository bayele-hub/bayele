import { describe, it, expect } from 'vitest';
import { alertErrorKey, parseAlertFilters } from './state';
import fr from '../../messages/fr.json';

describe('alertErrorKey — backend codes → French copy keys', () => {
  it('maps every documented code', () => {
    expect(alertErrorKey('alert_limit_reached')).toBe('limit');
    expect(alertErrorKey('invalid_category')).toBe('invalid');
    expect(alertErrorKey('profile_required')).toBe('profileRequired');
    expect(alertErrorKey('not_authenticated')).toBe('profileRequired');
    expect(alertErrorKey('boom')).toBe('error');
    expect(alertErrorKey(undefined)).toBe('error');
  });
  it('every key has French copy; the limit copy says « limite atteinte » (C5)', () => {
    for (const k of ['limit', 'invalid', 'profileRequired', 'error'] as const) expect(fr.alerts[k]).toBeTruthy();
    expect(fr.alerts.limit.toLowerCase()).toContain('limite atteinte');
  });
  it('alert copy promises in-app notifications only (C2)', () => {
    expect(fr.alerts.successBody).toContain("dans l'application");
    expect(JSON.stringify(fr.alerts).toLowerCase()).not.toMatch(/e-?mail|whatsapp|sms/);
  });
});

describe('parseAlertFilters', () => {
  it('empty means any', () => expect(parseAlertFilters('', '')).toEqual({ ok: true, country: null, cat: null }));
  it('accepts known values', () => expect(parseAlertFilters('ng', 'beaute')).toEqual({ ok: true, country: 'NG', cat: 'beaute' }));
  it('rejects unknown values instead of widening to any', () => {
    expect(parseAlertFilters('FR', '')).toEqual({ ok: false });
    expect(parseAlertFilters('', 'Beauté')).toEqual({ ok: false });
  });
});
