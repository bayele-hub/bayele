// QA drift-guard (verification only): the brand form and managed preview money maths must satisfy the
// DB invariants exactly — budget_math_check (total ≥ payout × count), valid_fee_rate (0.10 | 0.15 | 0.25),
// the escrow pool computed by admin_confirm_campaign_funding (total − floor(total × rate)) and the
// managed SQL formula net = floor(total × 3 ÷ (4 × places)) (migration 0033).
import { describe, it, expect } from 'vitest';
import { selfServeFromTotal, selfServeFromPayout, managedNetPreview, netPerPlace } from './managed-listing';
import { parseBrandCampaign } from './brand-campaign';

const RATES = [0.1, 0.15, 0.25];
// Deterministic pseudo-random sample (no Math.random → reproducible).
function* sample(n: number) {
  let x = 123456789;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    const total = 1 + (x % 50_000_000);
    x = (x * 1103515245 + 12345) % 2147483648;
    const count = 1 + (x % 200);
    yield { total, count };
  }
}
// Escrow side, exactly as SQL computes it with numeric rate: floor(total × rate).
const escrowFee = (total: number, rate: number) => Number((BigInt(total) * BigInt(Math.round(rate * 100))) / 100n);

describe('QA: self-serve split vs DB invariants', () => {
  it('from total: payout × count ≤ escrow pool ≤ total (budget_math_check + funding)', () => {
    for (const rate of RATES) {
      for (const { total, count } of sample(4000)) {
        const s = selfServeFromTotal(total, count, rate);
        if (!s) throw new Error('null split');
        expect(s.feeFcfa).toBe(escrowFee(total, rate));
        expect(s.poolFcfa).toBe(total - escrowFee(total, rate));
        expect(s.payoutPerCreatorFcfa * count).toBeLessThanOrEqual(s.poolFcfa);
        expect(s.payoutPerCreatorFcfa * count).toBeLessThanOrEqual(total);
        // net equals the SQL-style floor(total × (100 − r) ÷ (100 × count)) — may leave a remainder in the pool
        expect(s.payoutPerCreatorFcfa).toBe(Number((BigInt(total) * BigInt(100 - Math.round(rate * 100))) / (100n * BigInt(count))));
      }
    }
  });
  it('from payout: total covers payout × count and is at most 2 FCFA above the minimum', () => {
    for (const rate of RATES) {
      for (const { total: payout, count } of sample(3000)) {
        const s = selfServeFromPayout(payout % 2_000_000 + 1, count, rate);
        if (!s) throw new Error('null split');
        const need = s.payoutPerCreatorFcfa * count;
        expect(s.totalFcfa - escrowFee(s.totalFcfa, rate)).toBeGreaterThanOrEqual(need);
        // Info (QA): the gross-up is 1–2 FCFA above the true minimum (fee floors in the pool's favour).
        expect(s.totalFcfa - 3 - escrowFee(s.totalFcfa - 3, rate)).toBeLessThan(need);
      }
    }
  });
});

describe('QA: managed preview mirrors managed_net_preview / admin_publish_managed_brief', () => {
  it('net = floor(total × 3 ÷ (4 × places)); remainder = pool − net × places ≥ 0', () => {
    for (const { total, count: places } of sample(4000)) {
      const sqlNet = Number((BigInt(total) * 3n) / (4n * BigInt(places)));
      expect(netPerPlace(total, places)).toBe(sqlNet);
      const p = managedNetPreview(total, places, 3);
      if (!p) throw new Error('null preview');
      const fee = escrowFee(total, 0.25);
      expect(p).toMatchObject({ feeFcfa: fee, poolFcfa: total - fee, netPerPlaceFcfa: sqlNet, netPerUnitFcfa: Math.floor(sqlNet / 3) });
      expect(p.remainderFcfa).toBe(total - fee - sqlNet * places);
      expect(p.remainderFcfa).toBeGreaterThanOrEqual(0);
    }
  });
  it('contract example: 70 001 FCFA, 2 places, 10 units', () => {
    expect(managedNetPreview(70001, 2, 10)).toMatchObject({ feeFcfa: 17500, poolFcfa: 52501, netPerPlaceFcfa: 26250, netPerUnitFcfa: 2625, remainderFcfa: 1 });
  });
  it('invalid input → null (SQL returns no row)', () => {
    for (const [t, p] of [[0, 1], [-5, 1], [100, 0], [null, 1], ['abc', 2]] as const) expect(managedNetPreview(t, p)).toBeNull();
  });
});

describe('QA: parseBrandCampaign output always passes budget_math_check and valid_fee_rate', () => {
  const copy = { autoTitle: '{what} — {sector} à {city}', generatedBrief: '{what} avant le {deadline}', briefPlace: '{city}, {country}' };
  const base = { content_type: 'Vidéo courte', quantity: '2', count: '3', city: 'Douala', country: 'CM', deadline: '2099-01-01', rights: 'organic_6m', category: 'Mode' };
  it.each([
    ['total', { budget_mode: 'total', total: '100000' }],
    ['total odd', { budget_mode: 'total', total: '100 001', tier: 'managed' }],
    ['payout', { budget_mode: 'payout', payout: '33333', tier: 'agency' }],
    ['unknown tier → spark', { budget_mode: 'total', total: '7', tier: 'gold' }],
  ])('%s', (_n, extra) => {
    const r = parseBrandCampaign({ ...base, ...extra }, { today: '2026-10-11', floors: {}, copy });
    if (!r.ok) throw new Error(`unexpected ${r.error}`);
    const v = r.values;
    expect([0.1, 0.15, 0.25]).toContain(v.platform_fee_rate);
    expect(v.total_budget_fcfa).toBeGreaterThanOrEqual(v.payout_per_creator_fcfa * v.creator_count_target);
    expect(v.total_budget_fcfa - escrowFee(v.total_budget_fcfa, v.platform_fee_rate)).toBeGreaterThanOrEqual(v.payout_per_creator_fcfa * v.creator_count_target);
  });
  it('a total too small for one FCFA per creator is rejected (budget)', () => {
    const r = parseBrandCampaign({ ...base, count: '50', budget_mode: 'total', total: '10' }, { today: '2026-10-11', floors: {}, copy });
    expect(r).toMatchObject({ ok: false, error: 'budget' });
  });
});
