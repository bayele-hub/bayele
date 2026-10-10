import { describe, it, expect } from 'vitest';
import { MANAGED_ERROR_CODES, fieldLabels, managedErrorMessage, parseFloorDetails } from './managed-errors';

describe('contract error codes → French copy', () => {
  it('every contract code has its own FR and EN message (never the generic fallback)', () => {
    const generic = managedErrorMessage({ message: 'something_else' });
    for (const code of MANAGED_ERROR_CODES) {
      const fr = managedErrorMessage({ message: code }, 'fr');
      const en = managedErrorMessage({ message: code }, 'en');
      expect(fr, code).not.toBe(generic);
      expect(en, code).not.toBe(managedErrorMessage({ message: 'x' }, 'en'));
      expect(fr, code).not.toMatch(/ [:?!;%]/); // French typography
    }
  });
  it('missing_fields / brief_locked list readable field names from error.details', () => {
    expect(managedErrorMessage({ message: 'missing_fields', details: 'brand_label,city,deadline' })).toBe('Champ manquant : Libellé public, Ville, Date limite.');
    expect(managedErrorMessage({ message: 'brief_locked', details: 'title,places' })).toContain('Service, Places');
    expect(fieldLabels('title,service', 'fr')).toBe('Service');
  });
  it('CHECK constraints and enum errors are mapped too', () => {
    expect(managedErrorMessage({ message: 'new row violates check constraint "managed_briefs_whatsapp_e164"' })).toContain('WhatsApp');
    expect(managedErrorMessage({ message: 'invalid input value for enum deliverable_type: "x"' })).toContain('invalide');
  });
  it('parses below_pay_floor details', () => {
    expect(parseFloorDetails('net_per_unit=2500 floor=3000')).toEqual({ netPerUnit: 2500, floor: 3000 });
    expect(parseFloorDetails(null)).toBeNull();
  });
});
