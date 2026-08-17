# Bayele — Production Architecture Specification (v1.1.1)

**Status:** Implemented on paper, pending independent verification against a real deployment — not self-certified as "passed." Treat every claim below as a design decision to be tested, not a finished fact.

**Supersedes:** the v1.1.0 draft's schema, RLS policies, and webhook handler (four defects found in review, all fixed here — see §0). Builds on `bayele-tech-stack-v1.md` (phase 1) and `bayele-phase2-escrow-whatsapp-agency.md` (phase 2); this document is now the canonical source for anything that overlaps.

**One open dependency, flagged not assumed:** this spec integrates SokoClick as the OHADA invoicing engine, on the working assumption that your own SokoClick platform will expose (or already exposes) an invoicing API for external callers. That has not been confirmed. Everything downstream of `packages/sokoclick-sdk` should be treated as provisional until that's verified — if SokoClick doesn't have this capability yet, Bayele needs either its own lightweight OHADA-invoice generator or a scoped API added to SokoClick first.

---UnitedAfrica@2052

## 0. What changed from v1.1.0, and why

| # | Defect in v1.1.0 | Severity | Fix in this version |
|---|---|---|---|
| 1 | `is_admin(user_id UUID)` — parameter name collides with the column it's compared against (`WHERE user_id = user_id`), a known Postgres footgun that at best fails to deploy, at worst always evaluates true | **Critical — privilege escalation** | Parameter renamed `p_user_id`; column references explicitly qualified (§3.2) |
| 2 | Webhook handler wrote to `invoices`, `campaigns`, and `escrow_transactions` as three separate sequential REST calls — no transaction, so a crash mid-sequence leaves inconsistent state | **Critical — financial integrity** | Entire flow moved into one `security definer` Postgres function, `handle_sokoclick_invoice_paid()`, called once via RPC (§4.2) — atomic by construction |
| 3 | Escrow rows were inserted directly with `status: 'held'`, bypassing `transition_escrow()` — the audit-log gap sits exactly at the moment money enters escrow | **Critical — breaks the audit trail** | `handle_sokoclick_invoice_paid()` inserts at `pending` then calls `transition_escrow()` to move to `held`, same as every other caller |
| 4 | Escrow fee hardcoded at flat 10%, wrong for anything above Spark tier | **High — silently wrong revenue** | `campaigns.platform_fee_rate` is set once at campaign creation (by tier) and read at funding time, not re-derived or guessed in the webhook (§3.1, §4.2) |
| 5 | Webhook omitted `provider_ref`, disabling the idempotency guarantee that column exists for | **High — duplicate-payout risk** | `provider_ref` set to `sokoclick_invoice_id`; function also checks `invoices` for the same ID before doing anything (§4.2) |
| 6 | `business_profiles` had a public `SELECT USING (true)` policy — exposes `tax_id` and `billing_address` to anyone, and contradicts the phase-1 decision that only Creators and Consultants are public-facing marketplace actors | **High — data leak + scope drift** | Policy removed; `business_profiles` is owner + admin only (§3.2). Businesses are B2B platform clients, not directory listings. |
| 7 | Gemini `confidenceScore ≥ 0.85` auto-transitioned escrow toward release with no human step | **Medium — fraud/error surface on real payouts** | Score is now a **queue-priority signal only**; every proof still requires a human `verify_proof_of_post()` call before funds move (§5, §6) |
| 8 | `agency_retainers` dropped the 5% KPI bonus field from the phase-2 design | **Low — feature regression** | `kpi_bonus_fcfa` restored, deliberately excluded from the `retainer_math_integrity` check since it's earned on completion, not part of the funded contract (§3.1) |

Everything else from v1.1.0 — the four-actor model, `business_profiles`, multi-provider support, the CHECK constraints, the Gemini structured-output pattern — was sound and is kept.

---

## 1. Executive summary

```
                          THE 4-ACTOR BAYELE ECOSYSTEM

     ┌──────────────────────┐                           ┌──────────────────────┐
     │  BUSINESSES & BRANDS │ ── SokoClick invoicing ──► │  AGENCY CONSULTANTS  │
     │  fund campaigns via  │                            │  manage retainers,   │
     │  Match Pass / Escrow │                            │  query creator DB    │
     └──────────┬───────────┘                            └──────────┬───────────┘
                │ funds escrow                                      │ deploys briefs
                ▼                                                   ▼
     ┌─────────────────────────────────────────────────────────────────────────┐
     │                          BAYELE CORE ENGINE                             │
     │   transition_escrow() state machine · Gemini-assisted PoP review queue  │
     │   · Realtime notification bus                                          │
     └────────────────────────────────────┬────────────────────────────────────┘
                                          │ pays out on verified proof
                                          ▼
                               ┌──────────────────────┐
                               │    NANO-CREATORS     │
                               │  WhatsApp / TikTok    │
                               │  MoMo payout          │
                               └──────────────────────┘
```

Businesses are new to the platform as a first-class role in this revision — previously they were represented only as `owner_id` on a campaign with no dedicated workspace. They get a company profile, self-serve campaign creation, an invoice/receipt portal, and live campaign monitoring — but they are **not** part of the public marketplace directory. `/` still lists only Creators and Consultants, per the original brief; a business account is something you sign up for, not something you browse.

---

## 2. Monorepo topology

```
bayele-core/
├── apps/
│   └── web/
│       ├── app/
│       │   ├── (public)/                  # no auth — Creators & Consultants only
│       │   │   ├── page.tsx
│       │   │   ├── creators/{page.tsx,[handle]/page.tsx}
│       │   │   └── consultants/{page.tsx,[handle]/page.tsx}
│       │   ├── (auth)/
│       │   │   ├── sign-up/page.tsx
│       │   │   ├── log-in/page.tsx
│       │   │   └── onboarding/{creator,consultant,business}/page.tsx
│       │   ├── (app)/
│       │   │   ├── layout.tsx             # shared shell: notif bell, realtime bus
│       │   │   ├── creator/{dashboard,campaigns,wallet}/page.tsx
│       │   │   ├── consultant/{dashboard,retainers,talent-search}/page.tsx
│       │   │   ├── business/
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── campaigns/{page.tsx,new/page.tsx,[id]/page.tsx}
│       │   │   │   ├── invoices/page.tsx
│       │   │   │   └── profile/page.tsx
│       │   │   └── admin/{dashboard,broadcasts,escrow-ledger,disputes}/page.tsx
│       │   ├── api/webhooks/sokoclick/route.ts   # thin — verifies signature, calls one RPC
│       │   └── middleware.ts
├── packages/
│   ├── auth/            # session + role helpers
│   ├── database/         # generated types + query helpers
│   ├── notifications/    # notify() — single write path, see phase-1 spec §5
│   ├── sokoclick-sdk/     # invoicing client — see §4.1, still provisional
│   └── ui/
├── services/
│   ├── momo-engine/       # Fly.io — MoMo webhook receiver
│   └── whatsapp-engine/   # Fly.io — WhatsApp Cloud API + Gemini PoP scoring
└── supabase/
    ├── migrations/
    └── functions/
```

No structural change from v1.1.0 here — the topology was fine. The fixes are all in the schema and the webhook.

---

## 3. Database

### 3.1 Migration

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ENUMS -----------------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('super_admin', 'creator', 'consultant', 'business');
CREATE TYPE public.account_status AS ENUM ('pending_review', 'active', 'suspended', 'rejected');
CREATE TYPE public.country_code AS ENUM ('CM', 'GA', 'CI');
CREATE TYPE public.campaign_status AS ENUM (
  'draft', 'pending_funding', 'published', 'in_progress',
  'under_review', 'completed', 'disputed', 'cancelled'
);
CREATE TYPE public.creator_campaign_status AS ENUM (
  'invited', 'applied', 'approved', 'rejected',
  'content_submitted', 'verified', 'paid', 'disputed'
);
CREATE TYPE public.escrow_status AS ENUM (
  'pending', 'held', 'proof_pending', 'releasable',
  'disputed', 'paid_out', 'refunding', 'refunded'
);
CREATE TYPE public.payment_provider AS ENUM ('mtn_momo', 'orange_money', 'wave', 'airtel_money', 'bank_wire');
CREATE TYPE public.retainer_status AS ENUM ('draft', 'invoiced', 'funded', 'active', 'completed', 'terminated');
CREATE TYPE public.invoice_type AS ENUM ('match_pass', 'campaign_escrow', 'agency_retainer', 'pro_subscription');

-- PROFILES ----------------------------------------------------------------
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  city TEXT NOT NULL,
  country public.country_code NOT NULL,
  phone_e164 TEXT UNIQUE NOT NULL,
  status public.account_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT handle_format CHECK (handle ~* '^[a-z0-9_]{3,30}$')
);

CREATE TABLE public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, role)
);

-- ROLE-SPECIALIZED PROFILES -------------------------------------------------
CREATE TABLE public.creator_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  categories TEXT[] NOT NULL DEFAULT '{}',
  audience_size INT NOT NULL DEFAULT 0,
  platforms JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  pro_expires_at TIMESTAMPTZ,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  momo_payout_phone_e164 TEXT,
  momo_provider public.payment_provider DEFAULT 'mtn_momo'
);

CREATE TABLE public.consultant_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  tax_id TEXT,                                   -- NIU (CM) / NCC (CI)
  agency_access BOOLEAN NOT NULL DEFAULT FALSE,   -- gates the creator-database search
  years_experience INT NOT NULL DEFAULT 0
);

-- Businesses are platform clients, not directory listings: no public SELECT policy on this table (§3.2).
CREATE TABLE public.business_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  tax_id TEXT,
  billing_address TEXT,
  website TEXT,
  sokoclick_customer_id TEXT UNIQUE,             -- provisional, see header note
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- CAMPAIGNS ------------------------------------------------------------------
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  owner_role public.user_role NOT NULL,
  title TEXT NOT NULL,
  brief TEXT NOT NULL,
  target_country public.country_code NOT NULL,
  category TEXT NOT NULL,
  total_budget_fcfa BIGINT NOT NULL,
  payout_per_creator_fcfa BIGINT NOT NULL,
  creator_count_target INT NOT NULL DEFAULT 1,
  -- Fixed at creation, by tier — the webhook reads this instead of guessing a flat rate (fixes defect #4).
  platform_fee_rate NUMERIC(4,3) NOT NULL DEFAULT 0.10,
  status public.campaign_status NOT NULL DEFAULT 'draft',
  match_pass_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT valid_campaign_owner CHECK (owner_role IN ('business', 'consultant', 'super_admin')),
  CONSTRAINT budget_math_check CHECK (total_budget_fcfa >= (payout_per_creator_fcfa * creator_count_target)),
  CONSTRAINT valid_fee_rate CHECK (platform_fee_rate IN (0.10, 0.15, 0.25))  -- Spark / Managed / Agency, per the business model
);

CREATE TABLE public.campaign_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status public.creator_campaign_status NOT NULL DEFAULT 'invited',
  agreed_payout_fcfa BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (campaign_id, creator_id)
);

-- ESCROW ----------------------------------------------------------------------
CREATE TABLE public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  campaign_creator_id UUID REFERENCES public.campaign_creators(id) ON DELETE RESTRICT,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL,                        -- 'inbound' | 'outbound'
  amount_fcfa BIGINT NOT NULL,
  fee_fcfa BIGINT NOT NULL DEFAULT 0,
  net_amount_fcfa BIGINT NOT NULL,
  provider public.payment_provider NOT NULL,
  provider_ref TEXT UNIQUE,                        -- idempotency key — must always be set (fixes defect #5)
  status public.escrow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.escrow_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  from_status public.escrow_status NOT NULL,
  to_status public.escrow_status NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.proof_of_post (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_creator_id UUID UNIQUE NOT NULL REFERENCES public.campaign_creators(id) ON DELETE CASCADE,
  media_storage_path TEXT NOT NULL,
  media_sha256 TEXT NOT NULL,
  media_type TEXT NOT NULL,
  gemini_raw_response JSONB,
  verification_score NUMERIC(4,3),                 -- queue-priority signal only, see §5 (fixes defect #7)
  is_valid BOOLEAN,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- INVOICES & RETAINERS ----------------------------------------------------------
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sokoclick_invoice_id TEXT UNIQUE NOT NULL,
  sokoclick_receipt_id TEXT UNIQUE,
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invoice_type public.invoice_type NOT NULL,
  amount_fcfa BIGINT NOT NULL,
  tax_amount_fcfa BIGINT NOT NULL DEFAULT 0,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.agency_retainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consultant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contract_value_fcfa BIGINT NOT NULL,
  bayele_cut_fcfa BIGINT NOT NULL,
  consultant_fee_fcfa BIGINT NOT NULL,
  media_budget_fcfa BIGINT NOT NULL,
  kpi_bonus_fcfa BIGINT NOT NULL DEFAULT 0,        -- restored (fixes defect #8) — earned on completion, not funded upfront
  status public.retainer_status NOT NULL DEFAULT 'draft',
  sokoclick_invoice_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  -- kpi_bonus deliberately excluded — it's paid on top of the contract, not carved out of it
  CONSTRAINT retainer_math_integrity CHECK (
    contract_value_fcfa = (bayele_cut_fcfa + consultant_fee_fcfa + media_budget_fcfa)
  )
);
```

### 3.2 RLS — corrected

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_retainers ENABLE ROW LEVEL SECURITY;

-- Fixed: parameter renamed so it can never shadow the column it's checked against (fixes defect #1).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
  );
$$;

-- Public marketplace: Creators and Consultants only, active profiles only.
CREATE POLICY "public profiles are readable"
  ON public.profiles FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.id AND ur.role IN ('creator', 'consultant')
    )
  );

CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "admins manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin(auth.uid()));

-- Businesses: owner + admin only. No public policy — fixes defect #6.
CREATE POLICY "businesses manage their own profile"
  ON public.business_profiles FOR ALL
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Campaigns: owners manage their own; creators can see published ones to apply.
CREATE POLICY "campaign owners manage their campaigns"
  ON public.campaigns FOR ALL
  USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "active campaigns are viewable by creators"
  ON public.campaigns FOR SELECT
  USING (status IN ('published', 'in_progress', 'completed'));

-- Invoices: business owner + admin only.
CREATE POLICY "businesses view their invoices"
  ON public.invoices FOR SELECT
  USING (business_id = auth.uid() OR public.is_admin(auth.uid()));

-- Escrow: visible to the two parties involved (payer via campaign ownership, payee directly) + admin.
CREATE POLICY "escrow visible to involved parties"
  ON public.escrow_transactions FOR SELECT
  USING (
    recipient_profile_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );
```

---

## 4. SokoClick invoicing integration

### 4.1 SDK

Unchanged from v1.1.0's shape — the client itself was reasonable. Kept as-is:

```typescript
// packages/sokoclick-sdk/src/index.ts
import crypto from 'crypto';

export interface CreateInvoiceOptions {
  business: { id: string; companyName: string; email: string; taxId?: string; country: 'CM' | 'GA' | 'CI' };
  invoiceType: 'match_pass' | 'campaign_escrow' | 'agency_retainer';
  items: Array<{ description: string; unitPriceFcfa: number; quantity: number }>;
  metadata: Record<string, any>;
}

export class SokoClickEngine {
  private readonly apiUrl = process.env.SOKOCLICK_API_URL || 'https://api.sokoclick.com/v2';
  private readonly apiKey = process.env.SOKOCLICK_API_KEY as string;
  private readonly webhookSecret = process.env.SOKOCLICK_WEBHOOK_SECRET as string;

  async createInvoice(options: CreateInvoiceOptions) {
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
        currency: 'XAF',
        line_items: options.items.map((i) => ({ description: i.description, unit_amount: i.unitPriceFcfa, quantity: i.quantity })),
        metadata: options.metadata,
      }),
    });
    if (!response.ok) throw new Error(`SokoClick API error: ${await response.text()}`);
    return (await response.json()) as { id: string; invoice_number: string; payment_url: string; pdf_url: string; amount_fcfa: number };
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean {
    const digest = crypto.createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(digest));
  }
}
```

**Do not build against this until the "open dependency" note at the top of this doc is resolved.** If SokoClick doesn't expose `/v2/invoices` today, this package is a spec for work that needs to happen on the SokoClick side first, not a client for something that exists.

### 4.2 The transactional funding path (fixes defects #2, #3, #4, #5)

The webhook route no longer touches multiple tables — it does exactly one thing: verify the signature, then call one Postgres function.

```sql
-- One transaction. Idempotent. Always goes through transition_escrow().
CREATE OR REPLACE FUNCTION public.handle_sokoclick_invoice_paid(
  p_sokoclick_invoice_id TEXT,
  p_sokoclick_receipt_id TEXT,
  p_business_id UUID,
  p_invoice_type public.invoice_type,
  p_amount_fcfa BIGINT,
  p_pdf_url TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_retainer_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fee_rate NUMERIC;
  v_fee_fcfa BIGINT;
  v_net_fcfa BIGINT;
  v_txn_id UUID;
BEGIN
  -- Idempotency: a redelivered webhook is a no-op past this point.
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, pdf_url, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, p_business_id, p_invoice_type, p_amount_fcfa, p_pdf_url, 'paid');

  IF p_campaign_id IS NOT NULL THEN
    SELECT platform_fee_rate INTO v_fee_rate FROM public.campaigns WHERE id = p_campaign_id;
    IF v_fee_rate IS NULL THEN
      RAISE EXCEPTION 'campaign % has no platform_fee_rate set', p_campaign_id;
    END IF;

    v_fee_fcfa := floor(p_amount_fcfa * v_fee_rate);
    v_net_fcfa := p_amount_fcfa - v_fee_fcfa;

    UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now() WHERE id = p_campaign_id;

    INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
    VALUES (p_campaign_id, 'inbound', p_amount_fcfa, v_fee_fcfa, v_net_fcfa, 'mtn_momo', p_sokoclick_invoice_id, 'pending')
    RETURNING id INTO v_txn_id;

    PERFORM public.transition_escrow(v_txn_id, 'held', p_business_id);

  ELSIF p_retainer_id IS NOT NULL THEN
    UPDATE public.agency_retainers SET status = 'funded' WHERE id = p_retainer_id;
  END IF;
END;
$$;
```

```typescript
// apps/web/app/api/webhooks/sokoclick/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SokoClickEngine } from '@bayele/sokoclick-sdk';
import { createClient } from '@supabase/supabase-js';

const sokoclick = new SokoClickEngine();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-sokoclick-signature') || '';
  const rawBody = await req.text();

  if (!sokoclick.verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 });
  }

  if (payload.event !== 'invoice.paid') {
    return NextResponse.json({ ignored: true });
  }

  const { metadata, id: invoiceId, receipt_id, receipt_url, amount } = payload.data;

  try {
    const { error } = await supabase.rpc('handle_sokoclick_invoice_paid', {
      p_sokoclick_invoice_id: invoiceId,
      p_sokoclick_receipt_id: receipt_id,
      p_business_id: metadata.businessId,
      p_invoice_type: metadata.invoiceType,
      p_amount_fcfa: amount,
      p_pdf_url: receipt_url,
      p_campaign_id: metadata.campaignId ?? null,
      p_retainer_id: metadata.retainerId ?? null,
    });
    if (error) throw error;
    return NextResponse.json({ processed: true });
  } catch (err) {
    // 500 tells SokoClick to retry — safe now, because the RPC is idempotent.
    console.error('sokoclick webhook processing failed', err);
    return NextResponse.json({ error: 'PROCESSING_FAILED' }, { status: 500 });
  }
}
```

Note the signature check is no longer skipped outside production — a webhook endpoint that only validates in prod isn't validated at all; test against a real signed payload in staging instead.

---

## 5. Gemini Proof-of-Post — scored, not self-approving

```
   Creator uploads image
            │
            ▼
   Gemini 2.5 Flash: OCR, timestamp, handle match, brief match
            │  structured JSON: { isValid, confidenceScore, viewCount, isDurationValid, rejectionReason? }
            ▼
   proof_of_post row inserted with verification_score, is_valid = NULL (still pending)
            │
            ▼
   Review queue, sorted by verification_score ascending
   (low-confidence proofs surface first — that's where a human is most needed;
    high-confidence proofs are still reviewed, just faster to clear)
            │
            ▼
   Business owner or admin calls verify_proof_of_post() ──► transition_escrow(releasable)
```

The verifier function itself is unchanged from v1.1.0 (`services/whatsapp-engine/src/gemini/verifier.ts` — the prompt and structured schema were well-designed). What changes is what happens with the score:

```sql
CREATE OR REPLACE FUNCTION public.verify_proof_of_post(
  p_proof_id UUID, p_approve BOOLEAN, p_actor UUID, p_rejection_reason TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_campaign_creator_id UUID;
  v_txn_id UUID;
BEGIN
  UPDATE public.proof_of_post
    SET is_valid = p_approve, reviewed_by = p_actor, reviewed_at = now(),
        rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_rejection_reason END
    WHERE id = p_proof_id
    RETURNING campaign_creator_id INTO v_campaign_creator_id;

  UPDATE public.campaign_creators
    SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END, updated_at = now()
    WHERE id = v_campaign_creator_id;

  IF p_approve THEN
    SELECT id INTO v_txn_id FROM public.escrow_transactions
      WHERE campaign_creator_id = v_campaign_creator_id AND status = 'proof_pending'
      LIMIT 1;
    IF v_txn_id IS NOT NULL THEN
      PERFORM public.transition_escrow(v_txn_id, 'releasable', p_actor);
    END IF;
  END IF;
END;
$$;
```

Revisit auto-approval once you have enough reviewed volume to know Gemini's real false-positive rate on this specific use case (WhatsApp Status screenshots, not the general imagery it was likely benchmarked on) — that's a data-driven call to make later, not a default to ship with.

---

## 6. Business workspace

Route structure and the two dashboard pages from v1.1.0 (`business/campaigns/[id]/page.tsx`, `business/invoices/page.tsx`) are sound and unchanged — they read from the corrected schema without modification, since the fixes were all in the write path (webhook + RLS), not the read path. One addition worth making: the campaign detail page's proof review list should surface `verification_score` and wire its "Approve/Reject" buttons to `verify_proof_of_post()` via a server action, rather than writing to `campaign_creators`/`escrow_transactions` directly from the client.

---

## 7. Infrastructure

Unchanged from v1.1.0 — Fly.io for `whatsapp-engine` and `momo-engine` (Paris region for Francophone Africa peering), Vercel + Supabase for everything else. No issues found here.

---

## 8. Verification matrix

| Pillar | Spec status | What "done" actually requires |
|---|---|---|
| Business workspace & RBAC | Designed | Migration applied to a staging DB, RLS tested with real JWTs per role, not just read from the SQL |
| SokoClick invoicing | **Blocked** | Confirmation that SokoClick exposes (or will expose) an invoicing API — nothing else in this section can be verified until then |
| Escrow state machine | Designed, atomicity fixed | Integration test: fire the same webhook payload twice, confirm no duplicate escrow row and no partial state |
| Gemini PoP scoring | Designed, auto-release removed | A review-queue pilot with real submissions before touching the auto-approval question again |
| RLS / RBAC | Designed, one critical bug fixed | Test `is_admin()` explicitly with a non-admin JWT — write the failing test first, confirm it fails, then confirm the fix passes it |

This table intentionally doesn't say "PASSED" anywhere — nothing here has been run against a live system yet.
