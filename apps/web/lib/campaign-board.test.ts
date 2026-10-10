import { describe, it, expect } from 'vitest';
import { placesMeter, daysUntil, cardPill, fill, plural, doualaToday } from './campaign-board';
import { parseCategorySlug, categoryValue, categorySlugOf, categoryLabel, CAMPAIGN_CATEGORIES } from './campaign-categories';
import { formatFcfa } from '@/i18n/format';
import en from '../messages/en.json';

describe('placesMeter (design §0.3)', () => {
  it('bar only when someone was selected and places remain', () => {
    expect(placesMeter(3, 10)).toEqual({ kind: 'bar', left: 3, target: 10, takenPct: 70 });
  });
  it('text only when nobody was selected yet', () => {
    expect(placesMeter(10, 10)).toEqual({ kind: 'total', target: 10 });
  });
  it('full at 0 places', () => {
    expect(placesMeter(0, 10)).toEqual({ kind: 'full' });
  });
  it('hidden when unknown or target ≤ 0', () => {
    expect(placesMeter(null, 10)).toBeNull();
    expect(placesMeter(3, 0)).toBeNull();
    expect(placesMeter(undefined, undefined)).toBeNull();
  });
});

describe('daysUntil — Africa/Douala calendar days', () => {
  // 2026-10-10 23:30 UTC is already 2026-10-11 00:30 in Douala (UTC+1).
  const lateUtc = new Date('2026-10-10T23:30:00Z');
  it('uses the Douala date', () => {
    expect(doualaToday(lateUtc)).toBe('2026-10-11');
    expect(daysUntil('2026-10-11', lateUtc)).toBe(0);
    expect(daysUntil('2026-10-12', lateUtc)).toBe(1);
    expect(daysUntil('2026-10-15', lateUtc)).toBe(4);
  });
  it('null when past, missing or malformed', () => {
    expect(daysUntil('2026-10-10', lateUtc)).toBeNull();
    expect(daysUntil(null, lateUtc)).toBeNull();
    expect(daysUntil('10/12/2026', lateUtc)).toBeNull();
  });
});

describe('cardPill — at most one', () => {
  const now = new Date('2026-10-10T12:00:00Z');
  const old = '2026-09-01T00:00:00Z';
  const fresh = '2026-10-08T00:00:00Z';
  it('Complet at 0 places', () => expect(cardPill({ placesLeft: 0, creatorCountTarget: 10, createdAt: fresh }, now)).toBe('full'));
  it('Bientôt complet at ≤ 20 % left (wins over Nouveau)', () => {
    expect(cardPill({ placesLeft: 2, creatorCountTarget: 10, createdAt: fresh }, now)).toBe('almostFull');
    expect(cardPill({ placesLeft: 3, creatorCountTarget: 10, createdAt: old }, now)).toBeNull();
  });
  it('Nouveau within 7 days', () => {
    expect(cardPill({ placesLeft: 8, creatorCountTarget: 10, createdAt: fresh }, now)).toBe('new');
    expect(cardPill({ placesLeft: 8, creatorCountTarget: 10, createdAt: old }, now)).toBeNull();
  });
});

describe('copy helpers', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(fill('par {brand} {x}', { brand: 'Djino' })).toBe('par Djino {x}');
  });
  it('picks One/Many', () => {
    expect(plural(1, '1 place restante', '{n} places restantes')).toBe('1 place restante');
    expect(plural(3, '1 place restante', '{n} places restantes')).toBe('3 places restantes');
  });
  it('formatFcfa never lets « FCFA » wrap on its own line', () => {
    expect(formatFcfa(1500000, 'fr')).toMatch(/ FCFA$/);
    expect(formatFcfa(25000, 'en')).toBe('25,000 FCFA');
  });
});

describe('campaign categories', () => {
  it('maps slugs and DB values both ways', () => {
    expect(parseCategorySlug('Sante-Bien-Etre')).toBe('sante-bien-etre');
    expect(parseCategorySlug('nope')).toBeNull();
    expect(categoryValue('sante-bien-etre')).toBe('Santé & Bien-être');
    expect(categorySlugOf('beauté')).toBe('beaute');
    expect(categorySlugOf('Autre chose')).toBeNull();
  });
  it('the English labels line up with the category list', () => {
    expect(en.categories.length).toBe(CAMPAIGN_CATEGORIES.length);
    expect(categoryLabel('Beauté', 'en', en.categories)).toBe(en.categories[0]);
    expect(categoryLabel('Beauté', 'fr', en.categories)).toBe('Beauté');
    expect(categoryLabel('Free text', 'en', en.categories)).toBe('Free text');
  });
});
