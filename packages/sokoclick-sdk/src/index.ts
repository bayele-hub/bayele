import crypto from 'node:crypto';

export type Country = 'CM' | 'GA' | 'CI';

export interface CreateInvoiceOptions {
  business: { id: string; companyName: string; email: string; taxId?: string; country: Country };
  invoiceType: 'match_pass' | 'campaign_escrow' | 'agency_retainer' | 'pro_subscription';
  items: Array<{ description: string; unitPriceFcfa: number; quantity: number }>;
  metadata: Record<string, unknown>;
}

export interface SokoClickInvoice {
  id: string;
  invoice_number: string;
  payment_url: string;
  pdf_url: string;
  amount_fcfa: number;
}

/**
 * Currency follows the monetary union, not the word "FCFA" (production spec §0.1 #F):
 *   CM, GA -> XAF (CEMAC) ; CI -> XOF (UEMOA). Distinct ISO codes, never mixed.
 */
export function currencyFor(country: Country): 'XAF' | 'XOF' {
  return country === 'CI' ? 'XOF' : 'XAF';
}

/**
 * PROVISIONAL: depends on SokoClick exposing /v2/invoices. See production spec
 * header "One open dependency" before building against this.
 */
export class SokoClickEngine {
  private readonly apiUrl = process.env.SOKOCLICK_API_URL || 'https://api.sokoclick.com/v2';
  private readonly apiKey = process.env.SOKOCLICK_API_KEY as string;
  private readonly webhookSecret = process.env.SOKOCLICK_WEBHOOK_SECRET as string;

  async createInvoice(options: CreateInvoiceOptions): Promise<SokoClickInvoice> {
    const response = await fetch(`${this.apiUrl}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        customer: {
          external_id: options.business.id,
          name: options.business.companyName,
          email: options.business.email,
          tax_number: options.business.taxId,
          country_code: options.business.country,
        },
        type: options.invoiceType,
        currency: currencyFor(options.business.country),
        line_items: options.items.map((i) => ({
          description: i.description,
          unit_amount: i.unitPriceFcfa,
          quantity: i.quantity,
        })),
        metadata: options.metadata,
      }),
    });
    if (!response.ok) throw new Error(`SokoClick API error: ${await response.text()}`);
    return (await response.json()) as SokoClickInvoice;
  }

  /** Constant-time HMAC-SHA256 check. Runs in EVERY environment (spec §4.2). */
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const digest = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(signatureHeader);
    const b = Buffer.from(digest);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
