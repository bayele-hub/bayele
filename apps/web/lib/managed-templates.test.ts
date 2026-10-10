import { describe, it, expect } from 'vitest';
import { MANAGED_TEMPLATES, findTemplate } from './managed-templates';
import { CATEGORY_VALUES } from './campaign-categories';
import { DELIVERABLE_KEYS, RIGHTS_PRESETS } from './managed-listing';
import { PROVIDER_IDS } from './data/campaigns';

describe('industry templates (design §9.1, K1: text only)', () => {
  it('13 unique templates with valid categories, types, rights and platforms', () => {
    expect(MANAGED_TEMPLATES).toHaveLength(13);
    expect(new Set(MANAGED_TEMPLATES.map((t) => t.key)).size).toBe(13);
    const platforms = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'youtube', 'x', 'linkedin', 'snapchat', 'telegram'];
    for (const t of MANAGED_TEMPLATES) {
      expect(CATEGORY_VALUES, t.key).toContain(t.category);
      expect(DELIVERABLE_KEYS, t.key).toContain(t.type);
      expect(RIGHTS_PRESETS.map((r) => r.key), t.key).toContain(t.rights);
      for (const p of t.platforms) expect(platforms, `${t.key}:${p}`).toContain(p);
      expect(t.platforms.length).toBeGreaterThan(0);
    }
    expect(PROVIDER_IDS.length).toBeGreaterThan(0);
  });
  it('never carries a price, an amount or a quantity (no digits in the prefilled text)', () => {
    for (const t of MANAGED_TEMPLATES) {
      const text = JSON.stringify([t.service, t.deliverables, t.requirements, t.equipment]);
      expect(text.replace(/B2B/g, ''), t.key).not.toMatch(/fcfa|xaf|xof|\d/i);
    }
  });
  it('R8: the new categories are used by their templates', () => {
    expect(findTemplate('immobilier')?.category).toBe('Immobilier');
    expect(findTemplate('fintech')?.category).toBe('Finance / Fintech');
    expect(findTemplate('ong')?.category).toBe('ONG / Impact social');
    expect(findTemplate('hotel')?.category).toBe('Hôtellerie');
    expect(findTemplate('nope')).toBeNull();
  });
  it('FR + EN text for every field', () => {
    for (const t of MANAGED_TEMPLATES) {
      for (const x of [t.label, t.service, t.deliverables, t.requirements]) {
        expect(x.fr.trim(), t.key).not.toBe('');
        expect(x.en.trim(), t.key).not.toBe('');
      }
    }
  });
});

describe('templates — French typography', () => {
  it('no plain space before ; : ? ! % in FR text', () => {
    for (const t of MANAGED_TEMPLATES) {
      const fr = [t.label, t.service, t.deliverables, t.requirements, t.equipment, t.hint].map((x) => x?.fr ?? '').join(' | ');
      expect(fr, t.key).not.toMatch(/ [:?!;%]/);
    }
  });
});
