import { describe, it, expect } from 'vitest';
import { parseBrandCampaign } from './brand-campaign';
import fr from '../messages/fr.json';

const copy = { autoTitle: fr.brandForm.autoTitle, generatedBrief: fr.brandForm.generatedBrief, briefPlace: fr.brandForm.briefPlace };
const base = {
  content_type: 'Vidéo courte', quantity: '3', count: '2', city: 'Douala', country: 'CM', deadline: '2026-11-01',
  budget_mode: 'total', total: '100000', rights: 'organic_6m', category: 'Food', tier: 'spark',
};
const run = (over: Record<string, string> = {}, floors = {}) => parseBrandCampaign({ ...base, ...over }, { today: '2026-10-10', floors, copy });

describe('brand self-serve form (R4/R5, design §7)', () => {
  it('maps the TOTAL budget to payout_per_creator (tier fee) and keeps budget_math_check', () => {
    const r = run();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.total_budget_fcfa).toBe(100000);
    expect(r.values.payout_per_creator_fcfa).toBe(45000);
    expect(r.values.platform_fee_rate).toBe(0.1);
    expect(r.values.total_budget_fcfa).toBeGreaterThanOrEqual(r.values.payout_per_creator_fcfa * r.values.creator_count_target);
    expect(r.values.title).toBe('3 vidéos courtes · Food · Douala');
    expect(r.values.brief).toContain('Lieu de tournage : Douala, Cameroun.');
    expect(r.values.usage_rights).toBe('Usage organique sur les réseaux de la marque, Cameroun, 6 mois.');
    expect(r.values.platforms).toEqual([]);
  });
  it('agency tier 25 % and the advanced per-creator net', () => {
    const a = run({ tier: 'agency' });
    expect(a.ok && a.values.payout_per_creator_fcfa).toBe(37500);
    const p = run({ budget_mode: 'payout', payout: '45000', total: '' });
    expect(p.ok && p.values.payout_per_creator_fcfa).toBe(45000);
    expect(p.ok && p.values.total_budget_fcfa).toBe(100000);
  });
  it('requires the six answers, a future deadline and a payable budget', () => {
    expect(run({ city: '' })).toMatchObject({ ok: false, error: 'required', field: 'city' });
    expect(run({ content_type: 'Podcast' })).toMatchObject({ ok: false, error: 'required' });
    expect(run({ deadline: '' })).toMatchObject({ ok: false, error: 'required', field: 'deadline' });
    expect(run({ deadline: '2026-10-09' })).toMatchObject({ ok: false, error: 'deadline' });
    expect(run({ category: 'Inventée' })).toMatchObject({ ok: false, error: 'required', field: 'category' });
    expect(run({ total: '1', count: '2' })).toMatchObject({ ok: false, error: 'budget' });
    expect(run({ rights: 'custom', rights_custom: '' })).toMatchObject({ ok: false, error: 'required', field: 'rights' });
  });
  it('R5: below a floor needs the acknowledgement tick — warned, never blocked', () => {
    const floors = { short_video: 20000 }; // 45 000 < 20 000 × 3
    expect(run({}, floors)).toMatchObject({ ok: false, error: 'floorAck' });
    const acked = run({ floor_ack: 'on' }, floors);
    expect(acked).toMatchObject({ ok: true, belowFloor: true });
    expect(run({}, { short_video: 15000 })).toMatchObject({ ok: true, belowFloor: false });
  });
  it('R7 language with « Autre » free text', () => {
    const r = run({ language_key: 'other', language_other: 'Ewondo' });
    expect(r.ok && r.values.language).toBe('Ewondo');
    const p = run({ language_key: 'pcm' });
    expect(p.ok && p.values.language).toBe('Pidgin');
  });
});
