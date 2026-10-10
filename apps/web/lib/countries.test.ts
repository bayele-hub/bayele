import { describe, it, expect } from 'vitest';
import { COUNTRY_CODES, parseCountry, countryLabel, countryName, fcfaCurrency, countryOptions } from './countries';
import { PROVIDERS, PROVIDER_IDS, parseProvider, providerLabel } from './data/campaigns';

describe('countries', () => {
  it('covers the six markets, in display order', () => {
    expect(COUNTRY_CODES).toEqual(['CM', 'CI', 'GA', 'NG', 'KE', 'ZA']);
    expect(countryOptions().map((o) => o.code)).toEqual([...COUNTRY_CODES]);
  });

  it('validates untrusted input', () => {
    expect(parseCountry('NG')).toBe('NG');
    expect(parseCountry(' ke ')).toBe('KE');
    expect(parseCountry('FR')).toBe('CM');
    expect(parseCountry(undefined, 'ZA')).toBe('ZA');
  });

  it('labels per locale', () => {
    expect(countryLabel('ZA', 'fr')).toBe('Afrique du Sud');
    expect(countryLabel('NG', 'en')).toBe('Nigeria');
    expect(countryName('ZA', 'en')).toBe('South Africa');
    expect(countryName('XX')).toBe('XX');
  });

  it('design §8.2: no flag emoji (regional indicators) in any label', () => {
    for (const locale of ['fr', 'en'] as const) {
      for (const o of countryOptions(locale)) expect(o.label).not.toMatch(/[\u{1F1E6}-\u{1F1FF}]/u);
    }
  });

  it('keeps FCFA currencies: XOF for CI, XAF otherwise', () => {
    expect(fcfaCurrency('CI')).toBe('XOF');
    expect(fcfaCurrency('CM')).toBe('XAF');
    expect(fcfaCurrency('NG')).toBe('XAF');
  });
});

describe('payment providers', () => {
  it('includes the local rails for the new markets', () => {
    expect(PROVIDER_IDS).toEqual(expect.arrayContaining(['mpesa', 'opay', 'palmpay', 'mtn_momo', 'bank_wire']));
    expect(PROVIDERS).toHaveLength(PROVIDER_IDS.length);
  });

  it('validates and labels providers', () => {
    expect(parseProvider('mpesa')).toBe('mpesa');
    expect(parseProvider('paypal')).toBe('mtn_momo');
    expect(providerLabel('palmpay')).toBe('PalmPay');
    expect(providerLabel(null)).toBe('');
  });
});
