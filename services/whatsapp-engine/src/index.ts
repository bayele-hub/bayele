import { Hono } from 'hono';
import { scoreProofOfPost } from './gemini/verifier';

/**
 * WhatsApp engine (Fly.io). Receives WhatsApp Cloud API events and runs Gemini
 * Proof-of-Post SCORING (never auto-release — SKILL.md invariant #4). The score is
 * written to proof_of_post.verification_score to prioritise the human review queue.
 */
const app = new Hono();

app.get('/health', (c) => c.json({ ok: true, service: 'whatsapp-engine' }));

app.post('/pop/score', async (c) => {
  const { imageUrl, brief, expectedHandle } = await c.req.json();
  const result = await scoreProofOfPost({ imageUrl, brief, expectedHandle });
  // NOTE: this only scores. A human calls verify_proof_of_post() to release funds.
  return c.json(result);
});

export default { port: 8080, fetch: app.fetch };
