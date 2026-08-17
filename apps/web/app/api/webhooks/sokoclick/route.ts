import { NextRequest, NextResponse } from 'next/server';
import { SokoClickEngine } from '@bayele/sokoclick-sdk';
import { createServiceClient } from '@bayele/database/server';
import type { Database } from '@bayele/database';

type InvoicePaidArgs = Database['public']['Functions']['handle_sokoclick_invoice_paid']['Args'];

// Thin handler: verify signature, then call ONE idempotent RPC (spec §4.2).
const sokoclick = new SokoClickEngine();

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-sokoclick-signature') || '';
  const rawBody = await req.text();

  if (!sokoclick.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: { event?: string; data?: Record<string, any> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (payload.event !== 'invoice.paid') return NextResponse.json({ ignored: true });

  const d = payload.data ?? {};
  const supabase = createServiceClient();

  // Typed against the generated Database schema — the RPC name and argument shape are now
  // compile-time checked (a typo in the function name is a build error).
  const rpcArgs: InvoicePaidArgs = {
    p_sokoclick_invoice_id: d.id,
    p_sokoclick_receipt_id: d.receipt_id,
    p_business_id: d.metadata?.businessId,
    p_invoice_type: d.metadata?.invoiceType,
    p_amount_fcfa: d.amount,
    p_pdf_url: d.receipt_url,
    p_campaign_id: d.metadata?.campaignId ?? undefined,
    p_retainer_id: d.metadata?.retainerId ?? undefined,
  };
  try {
    const { error } = await supabase.rpc('handle_sokoclick_invoice_paid', rpcArgs);
    if (error) throw error;
    return NextResponse.json({ processed: true });
  } catch (err) {
    // 500 => SokoClick retries; safe because the RPC is idempotent on invoice id.
    console.error('sokoclick webhook processing failed', err);
    return NextResponse.json({ error: 'PROCESSING_FAILED' }, { status: 500 });
  }
}
