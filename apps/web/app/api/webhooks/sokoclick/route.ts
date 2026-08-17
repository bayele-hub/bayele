import { NextRequest, NextResponse } from 'next/server';
import { SokoClickEngine } from '@bayele/sokoclick-sdk';
import { createServiceClient } from '@bayele/database/server';

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
  try {
    const { error } = await supabase.rpc('handle_sokoclick_invoice_paid', {
      p_sokoclick_invoice_id: d.id,
      p_sokoclick_receipt_id: d.receipt_id,
      p_business_id: d.metadata?.businessId,
      p_invoice_type: d.metadata?.invoiceType,
      p_amount_fcfa: d.amount,
      p_pdf_url: d.receipt_url,
      p_campaign_id: d.metadata?.campaignId ?? null,
      p_retainer_id: d.metadata?.retainerId ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ processed: true });
  } catch (err) {
    // 500 => SokoClick retries; safe because the RPC is idempotent on invoice id.
    console.error('sokoclick webhook processing failed', err);
    return NextResponse.json({ error: 'PROCESSING_FAILED' }, { status: 500 });
  }
}
