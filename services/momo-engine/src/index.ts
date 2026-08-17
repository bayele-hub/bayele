import { Hono } from 'hono';

/**
 * MoMo engine (Fly.io). Long-running receiver for Mobile Money provider callbacks
 * (MTN, Orange, Wave). Reconciles disbursements against escrow_transactions that
 * transition_escrow() moved to 'releasable', then drives them to 'paid_out'.
 * Kept off Vercel serverless because provider callbacks want a stable listener.
 */
const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, service: 'momo-engine' }));

app.post('/callbacks/:provider', async (c) => {
  const provider = c.req.param('provider'); // mtn_momo | orange_money | wave
  // TODO: verify provider signature, look up the payout by provider_ref,
  // then call transition_escrow(txn, 'paid_out', system_actor). Idempotent.
  return c.json({ received: true, provider });
});

export default { port: 8080, fetch: app.fetch };
