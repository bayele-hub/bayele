import { describe, it, expect } from 'vitest';
import { Constants } from '../../../packages/database/src/types.gen';
import {
  DELIVERABLE_KEYS, LANGUAGES, RIGHTS_PRESETS, briefChecklist, cityUnlessInLabel, contentTypeLabel, deliverableSummary, floorCheck,
  floorTypeForContent, labelReusesName, languageKeyOf, languageLabel, languageValue, localizedRights, managedNetPreview, netPerPlace,
  readyForOrder, resolveRights, rightsPresetOf, selfServeFloor, selfServeFromPayout, selfServeFromTotal, type BriefDraft,
} from './managed-listing';

describe('managedNetPreview — client mirror of public.managed_net_preview (E3)', () => {
  it('matches the contract example exactly', () => {
    expect(managedNetPreview(70001, 2, 10)).toMatchObject({ feeFcfa: 17500, poolFcfa: 52501, netPerPlaceFcfa: 26250, netPerUnitFcfa: 2625, remainderFcfa: 1 });
  });
  it('K7: net per place = floor(total × 0.75 ÷ places); remainder stays ≥ 0 and adds up', () => {
    for (const [t, p, c] of [[30000, 1, 3], [100000, 5, 2], [50000, 3, 4], [1, 1, 1], [999_999, 7, 3], [155000, 1, 12]] as const) {
      const n = managedNetPreview(t, p, c)!;
      expect(n.netPerPlaceFcfa).toBe(Math.floor((t * 3) / (4 * p)));
      expect(n.feeFcfa).toBe(Math.floor(t * 0.25));
      expect(n.feeFcfa + n.netPerPlaceFcfa * p + n.remainderFcfa).toBe(t);
      expect(n.remainderFcfa).toBeGreaterThanOrEqual(0);
      expect(n.netPerUnitFcfa).toBe(Math.floor(n.netPerPlaceFcfa / c));
      // budget_math_check: total ≥ payout × places
      expect(t).toBeGreaterThanOrEqual(n.netPerPlaceFcfa * p);
    }
    expect(netPerPlace(100000, 5)).toBe(15000);
  });
  it('returns null for incomplete input (like the SQL zero rows)', () => {
    expect(managedNetPreview(0, 1)).toBeNull();
    expect(managedNetPreview(1000, 0)).toBeNull();
    expect(managedNetPreview('', '1')).toBeNull();
    expect(managedNetPreview('70 001', '2', '10')?.netPerPlaceFcfa).toBe(26250);
  });
});

describe('pay floors (K1 managed block · R5 self-serve warning)', () => {
  const net = managedNetPreview(100000, 5, 2)!; // 15 000 / place, 7 500 / unit
  it('no floor → « Seuil non défini » (the launch state: the table ships empty)', () => {
    expect(floorCheck('short_video', 2, net, {})).toEqual({ kind: 'not_set' });
    expect(floorCheck('short_video', 2, net, { short_video: null })).toEqual({ kind: 'not_set' });
    expect(floorCheck('short_video', 2, null, { short_video: 1000 })).toEqual({ kind: 'not_set' });
  });
  it('equal passes, one FCFA short is below (same rule as private.managed_floor_check)', () => {
    expect(floorCheck('short_video', 2, net, { short_video: 7500 })).toMatchObject({ kind: 'pass', perUnitFcfa: 7500 });
    const below = floorCheck('short_video', 2, net, { short_video: 7501 });
    expect(below.kind).toBe('below');
    if (below.kind === 'below') {
      expect(below.gapPerPlaceFcfa).toBe(2);
      // counter-offer 1: the smallest total that clears the floor
      const fixed = managedNetPreview(below.totalForSameWorkFcfa, 5, 2)!;
      expect(fixed.netPerPlaceFcfa).toBeGreaterThanOrEqual(7501 * 2);
      expect(managedNetPreview(below.totalForSameWorkFcfa - 1, 5, 2)!.netPerPlaceFcfa).toBeLessThan(7501 * 2);
      // counter-offer 2: units the same budget covers
      expect(below.unitsForSameBudget).toBe(1);
    }
  });
  it('self-serve: per-creator payout vs floor × quantity of the mapped type', () => {
    expect(floorTypeForContent('Reel')).toBe('short_video');
    expect(floorTypeForContent('Statut / Story')).toBe('story');
    expect(selfServeFloor('Vidéo courte', 3, 9000, { short_video: 3000 })).toEqual({ below: false, floorFcfa: 3000 });
    expect(selfServeFloor('Vidéo courte', 3, 8999, { short_video: 3000 })).toEqual({ below: true, floorFcfa: 3000 });
    expect(selfServeFloor('Vidéo courte', 3, 1, {})).toEqual({ below: false, floorFcfa: null });
  });
});

describe('brand self-serve money (R4)', () => {
  it('from the TOTAL: payout = floor(total × (1 − rate) ÷ count), fee = floor(total × rate)', () => {
    expect(selfServeFromTotal(100000, 2, 0.1)).toEqual({ totalFcfa: 100000, feeFcfa: 10000, poolFcfa: 90000, payoutPerCreatorFcfa: 45000, ratePct: 10 });
    const s = selfServeFromTotal(99999, 7, 0.15)!;
    expect(s.payoutPerCreatorFcfa).toBe(Math.floor((99999 * 85) / 700));
    expect(s.payoutPerCreatorFcfa * 7).toBeLessThanOrEqual(s.poolFcfa);
    expect(selfServeFromTotal(0, 1, 0.1)).toBeNull();
  });
  it('advanced: from the per-creator net, the total covers payout × count after the fee', () => {
    for (const rate of [0.1, 0.15, 0.25]) {
      for (const [p, n] of [[45000, 2], [7777, 3], [1, 1], [50001, 9]] as const) {
        const s = selfServeFromPayout(p, n, rate)!;
        expect(s.totalFcfa - s.feeFcfa).toBeGreaterThanOrEqual(p * n);
        expect(s.feeFcfa).toBe(Math.floor((s.totalFcfa * Math.round(rate * 100)) / 100));
        // never more than one FCFA-percent step above the exact gross-up
        expect(s.totalFcfa).toBeLessThanOrEqual(Math.ceil((p * n * 100) / (100 - Math.round(rate * 100))) + 1);
      }
    }
  });
});

describe('listing libraries', () => {
  it('deliverable types match the Postgres enum (0033)', () => {
    expect([...DELIVERABLE_KEYS]).toEqual([...Constants.public.Enums.deliverable_type]);
  });
  it('R1: public « 3 vidéos courtes » for self-serve and managed content types', () => {
    expect(deliverableSummary(3, 'Vidéo courte', 'fr')).toBe('3 vidéos courtes');
    expect(deliverableSummary(1, 'Vidéo courte', 'en')).toBe('1 short video');
    expect(deliverableSummary(5, 'Vidéo courte (Reel, TikTok, Short)', 'fr')).toBe('5 vidéos courtes');
    expect(deliverableSummary(2, 'Statut / Story', 'en')).toBe('2 statuses / stories');
    expect(deliverableSummary(4, 'Truc libre', 'fr')).toBe('4 × Truc libre');
    expect(deliverableSummary(null, 'Reel', 'fr')).toBeNull();
    expect(deliverableSummary(2, '', 'fr')).toBeNull();
    expect(contentTypeLabel('Post photo', 'en')).toBe('Photo post');
  });
  it('R7 languages: fixed list + « Autre » free text', () => {
    expect(LANGUAGES.map((l) => l.fr)).toEqual(['Français', 'Anglais', 'Pidgin', 'Kiswahili', 'Arabe', 'Autre']);
    expect(languageValue('ar')).toBe('Arabe');
    expect(languageValue('other', '  Ewondo ')).toBe('Ewondo');
    expect(languageValue('other', '')).toBeNull();
    expect(languageKeyOf('Ewondo')).toEqual({ key: 'other', other: 'Ewondo' });
    expect(languageKeyOf('Kiswahili')).toEqual({ key: 'sw', other: '' });
    expect(languageLabel('Arabe', 'en')).toBe('Arabic');
    expect(languageLabel('Ewondo', 'en')).toBe('Ewondo');
  });
  it('rights presets resolve the country and round-trip', () => {
    expect(RIGHTS_PRESETS[0]!.key).toBe('organic_6m');
    const fr = resolveRights('organic_6m', 'Cameroun', 'fr');
    expect(fr).toBe('Usage organique sur les réseaux de la marque, Cameroun, 6 mois.');
    expect(rightsPresetOf(fr, 'Cameroun')).toBe('organic_6m');
    expect(rightsPresetOf('Autre chose', 'Cameroun')).toBe('custom');
    expect(resolveRights('custom', 'Cameroun', 'fr', ' 12 mois ')).toBe('12 mois');
    expect(localizedRights(fr, 'CM', 'en')).toBe("Organic use on the brand's own channels, Cameroon, 6 months.");
    expect(localizedRights('Texte libre', 'CM', 'en')).toBe('Texte libre');
  });
  it('K3 guard and city de-duplication', () => {
    expect(labelReusesName('Saveurs du Wouri', 'SAVEURS DU WOURI SARL')).toBe(true);
    expect(labelReusesName('Restaurant', 'Saveurs du Wouri SARL')).toBe(false);
    expect(labelReusesName('Finex — produits', 'FINEX')).toBe(true);
    expect(cityUnlessInLabel('Restaurant · Douala', 'douala')).toBeNull();
    expect(cityUnlessInLabel('Restaurant', 'Douala')).toBe('Douala');
  });
});

describe('mandatory checklist (plan §4, items 1–14 mirror the publish RPC)', () => {
  const base: BriefDraft = {
    brandName: 'Saveurs du Wouri SARL', brandLabel: 'Restaurant', realName: false, brandConsent: false, brandConsentProof: '',
    city: 'Douala', country: 'CM', service: 'Pack contenu food', title: '', category: 'Food', deliverableType: 'short_video',
    deliverableCount: '5', platforms: ['instagram'], deliverables: 'Photos et vidéos.', deadline: '2026-12-01', totalBudget: '70000',
    places: '1', rightsText: 'Usage organique…', creatorRequirements: 'Vidéaste food', language: 'Français', claimsVerified: false,
    orderConfirmed: true, orderProof: 'capture',
  };
  const ok = { kind: 'not_set' } as const;
  it('a complete brief is all green', () => {
    const c = briefChecklist(base, ok, '2026-10-10');
    expect(Object.values(c).every(Boolean)).toBe(true);
    expect(readyForOrder(c)).toBe(true);
  });
  it('flags the K3 clash, missing consent proof, past deadline, below floor and sensitive claims', () => {
    expect(briefChecklist({ ...base, brandLabel: 'Saveurs du Wouri' }, ok, '2026-10-10').label).toBe(false);
    expect(briefChecklist({ ...base, realName: true, brandConsent: true }, ok, '2026-10-10').consent).toBe(false);
    expect(briefChecklist({ ...base, deadline: '2026-10-09' }, ok, '2026-10-10').deadline).toBe(false);
    expect(briefChecklist(base, { kind: 'below', floorFcfa: 1, perUnitFcfa: 0, gapPerPlaceFcfa: 1, totalForSameWorkFcfa: 1, unitsForSameBudget: 0 }, '2026-10-10').floor).toBe(false);
    expect(briefChecklist({ ...base, category: 'Immobilier' }, ok, '2026-10-10').service).toBe(false);
    expect(briefChecklist({ ...base, category: 'Immobilier', claimsVerified: true }, ok, '2026-10-10').service).toBe(true);
    const noYes = briefChecklist({ ...base, orderConfirmed: false }, ok, '2026-10-10');
    expect(noYes.yes).toBe(false);
    expect(readyForOrder(noYes)).toBe(true);
  });
});
