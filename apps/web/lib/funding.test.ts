import { describe, it, expect, vi } from 'vitest';
import { confirmFunding, mapFundingError, type FundingClient } from './funding';
import fr from '../messages/fr.json';
import en from '../messages/en.json';

const E = fr.admin.briefs.funding.errors;

function client(rpcError: { message: string } | null, status: string | null, readError: { message: string } | null = null) {
  const maybeSingle = vi.fn(async () => ({ data: status ? { status } : null, error: readError }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const c = {
    rpc: vi.fn(async () => ({ error: rpcError })),
    from: vi.fn(() => ({ select })),
  };
  return { c: c as unknown as FundingClient, spies: { rpc: c.rpc, from: c.from, select, eq, maybeSingle } };
}
const input = { campaign: '1c620338-0000-4000-8000-000000000000', invoice: 'REF-X', provider: 'mtn_momo' };

describe('funding confirmation (F2/F3)', () => {
  it('F2: invoice_already_used → the dedicated error, flagged on the ref field, no success', async () => {
    const { c, spies } = client({ message: 'invoice_already_used' }, null);
    const r = await confirmFunding(c, input, E);
    expect(r).toEqual({ error: E.invoiceAlreadyUsed, field: 'invoice' });
    expect(r.ok).toBeUndefined();
    expect(spies.from).not.toHaveBeenCalled();
  });
  it('maps the other RPC codes', () => {
    expect(mapFundingError({ message: 'not_authorized' }, E).error).toBe(E.notAuthorized);
    expect(mapFundingError({ message: 'campaign_not_fundable' }, E).error).toBe(E.alreadyFunded);
    expect(mapFundingError({ message: 'boom' }, E).error).toBe(E.generic);
    expect(mapFundingError({ message: 'invoice_already_used' }, en.admin.briefs.funding.errors).error).toBe(en.admin.briefs.funding.errors.invoiceAlreadyUsed);
  });
  it('F3: RPC ok but status still pending_funding (the FINEX case) → notPublished, never ok', async () => {
    const { c, spies } = client(null, 'pending_funding');
    const r = await confirmFunding(c, input, E);
    expect(r.ok).toBeUndefined();
    expect(r.error).toBe(E.notPublished);
    expect(spies.from).toHaveBeenCalledWith('campaigns');
    expect(spies.eq).toHaveBeenCalledWith('id', input.campaign);
  });
  it('F3: unreadable campaign or read error → notPublished', async () => {
    expect((await confirmFunding(client(null, null).c, input, E)).error).toBe(E.notPublished);
    expect((await confirmFunding(client(null, 'published', { message: 'x' }).c, input, E)).error).toBe(E.notPublished);
  });
  it('ok only when the re-read status is published or in_progress', async () => {
    expect(await confirmFunding(client(null, 'published').c, input, E)).toEqual({ error: null, ok: true });
    expect(await confirmFunding(client(null, 'in_progress').c, input, E)).toEqual({ error: null, ok: true });
  });
  it('validates input before calling the RPC', async () => {
    const { c, spies } = client(null, 'published');
    expect((await confirmFunding(c, { ...input, campaign: '' }, E)).error).toBe(E.missing);
    expect((await confirmFunding(c, { ...input, invoice: '' }, E)).error).toBe(E.refRequired);
    expect(spies.rpc).not.toHaveBeenCalled();
  });
  it('the placeholder is guidance, not a value (no digits, no reference pattern)', () => {
    for (const d of [fr, en]) expect(d.admin.briefs.funding.refPlaceholder).not.toMatch(/\d/);
  });
});
