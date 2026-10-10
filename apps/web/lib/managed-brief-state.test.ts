import { describe, it, expect } from 'vitest';
import { ageDays, isLive, isStale, matchesQuery, pipelineKey, sortBriefs } from './managed-brief-state';

const now = new Date('2026-10-10T12:00:00Z');

describe('« Briefs gérés » pipeline (E6: `ready` is derived, not stored)', () => {
  it('derives « Prête à publier » from the recorded « OUI » + proof on a brief without a live campaign', () => {
    const b = { status: 'awaiting_order' as const, order_confirmed_at: '2026-10-09T10:00:00Z', order_proof: 'capture', campaign_id: null };
    expect(pipelineKey(b)).toBe('ready');
    expect(pipelineKey({ ...b, order_proof: ' ' })).toBe('awaiting_order');
    expect(pipelineKey({ ...b, status: 'draft', order_confirmed_at: null })).toBe('draft');
    expect(pipelineKey({ ...b, status: 'awaiting_payment', campaign_id: 'c' }, 'pending_funding')).toBe('awaiting_payment');
    expect(pipelineKey({ ...b, status: 'declined' })).toBe('declined');
    // E8: cancelled campaign → the brief is back to draft and may be published again
    expect(pipelineKey({ ...b, status: 'draft', campaign_id: 'c' }, 'cancelled')).toBe('ready');
  });
  it('live = linked campaign that is not cancelled', () => {
    expect(isLive('c', 'pending_funding')).toBe(true);
    expect(isLive('c', 'cancelled')).toBe(false);
    expect(isLive(null, null)).toBe(false);
  });
  it('stale after 48 h in the two waiting stages only', () => {
    expect(isStale('awaiting_order', '2026-10-08T11:00:00Z', now)).toBe(true);
    expect(isStale('awaiting_order', '2026-10-08T13:00:00Z', now)).toBe(false);
    expect(isStale('draft', '2026-01-01T00:00:00Z', now)).toBe(false);
    expect(ageDays('2026-10-07T12:00:00Z', now)).toBe(3);
  });
  it('search on name, label and phone digits; sort by waiting time', () => {
    const r = { brand_name: 'Saveurs du Wouri', brand_label: 'Restaurant', contact_whatsapp: '+237690112233' };
    expect(matchesQuery(r, 'wouri')).toBe(true);
    expect(matchesQuery(r, 'restau')).toBe(true);
    expect(matchesQuery(r, '6901 12')).toBe(true);
    expect(matchesQuery(r, 'finex')).toBe(false);
    const rows = [{ updated_at: '2026-10-09T00:00:00Z' }, { updated_at: '2026-10-01T00:00:00Z' }];
    expect(sortBriefs(rows, null)[0]!.updated_at).toBe('2026-10-01T00:00:00Z');
    expect(sortBriefs(rows, 'published')[0]!.updated_at).toBe('2026-10-09T00:00:00Z');
  });
});
