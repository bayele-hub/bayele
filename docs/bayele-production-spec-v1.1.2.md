# Bayele — Production Architecture Specification (v1.1.2)

**Status:** Implemented on paper, pending independent verification against a real deployment — not self-certified as "passed." Treat every claim below as a design decision to be tested, not a finished fact.

**Supersedes:** the v1.1.1 spec. v1.1.2 is a QA-hardening pass — it closes completeness and security gaps found in an independent review of v1.1.1 (see §0.1) without redesigning anything that was already sound. Builds on `bayele-tech-stack-v1.md` (phase 1); the phase-2 escrow/WhatsApp/agency detail is folded into this document, which is now the canonical source for anything that overlaps. (`bayele-phase2-escrow-whatsapp-agency.md` is referenced historically but is not present in the repo — its content lives here.)

**One open dependency, flagged not assumed:** this spec integrates SokoClick as the OHADA invoicing engine, on the working assumption that your own SokoClick platform will expose (or already exposes) an invoicing API for external callers. That has not been confirmed. Everything downstream of `packages/sokoclick-sdk` should be treated as provisional until that's verified — if SokoClick doesn't have this capability yet, Bayele needs either its own lightweight OHADA-invoice generator or a scoped API added to SokoClick first.

---

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

## 0.1 What changed from v1.1.1 → v1.1.2, and why

An independent QA pass on v1.1.1 found that the *write-path* fixes in §0 were correct, but the spec was not yet buildable end-to-end: the core state-machine function it leans on was never defined, several tables had RLS enabled with no policy (which denies all access, silently breaking the public directory), and one `SECURITY DEFINER` function had the same class of authorization hole that §0 was written to eliminate. These are completeness and security gaps, not redesigns.

| # | Gap in v1.1.1 | Severity | Fix in v1.1.2 |
|---|---|---|---|
| A | `transition_escrow()` is called by `handle_sokoclick_invoice_paid()` (§4.2) and `verify_proof_of_post()` (§5) but is **never defined anywhere** — the spec cannot run | **Critical — non-buildable** | Defined in §3.3 with an explicit allowed-transition guard and an `escrow_audit_log` write on every hop, so the audit trail is closed by construction |
| B | `creator_profiles` / `consultant_profiles` have `ENABLE ROW LEVEL SECURITY` but **no SELECT policy** — RLS-enabled + no policy = deny-all, so the public directory query in `bayele-home.md` (which joins these tables) returns nothing for anon users | **High — public marketplace is dead on arrival** | Public read policies added for both, scoped to profiles that are `active` and hold the matching role (§3.2) |
| C | `verify_proof_of_post()` is `SECURITY DEFINER` and, exposed as an RPC, performed no authorization check — any authenticated user could approve **their own** proof and release escrow, the exact footgun §0 #1/#7 were about | **High — self-approval / payout theft** | Function now asserts the caller is the campaign owner or an admin before it mutates anything (§5) |
| D | The escrow state machine had no path from campaign funding to a **per-creator** payout row: inbound escrow is created at campaign level with no `campaign_creator_id`, yet `verify_proof_of_post()` looks for a `proof_pending` row keyed by `campaign_creator_id` that nothing ever creates | **Medium-High — payouts can never fire** | Added `submit_proof_of_post()` (§5.1): when a creator submits proof it creates the outbound per-creator escrow row and moves it `held → proof_pending`, closing the loop into `verify_proof_of_post()` |
| E | `notifications` — a first-class subsystem in phase 1 (tech-stack §5) — was dropped from the canonical migration, so the Realtime notification bus referenced in §2 has no table | **Medium — subsystem missing** | `notifications` table + RLS carried forward into §3.1/§3.2 |
| F | `SokoClickEngine` hardcodes `currency: 'XAF'`, but Côte d'Ivoire is in UEMOA and uses **XOF**, not XAF (CEMAC). Every CI invoice would carry the wrong currency | **High — wrong currency for a launch market** | Currency derived from country: `CM`/`GA` → `XAF`, `CI` → `XOF` (§4.1) |
| G | The SokoClick invoice needs a customer `email`, but no email is modelled anywhere (`profiles` stores `phone_e164` only, `business_profiles` has none) | **Low-Medium — integration can't populate a required field** | `billing_email` added to `business_profiles` (§3.1) as the invoice contact of record |
| H | Both prior specs place `middleware.ts` inside `app/` — in Next.js it must sit at the **project/`src` root** or it never runs, silently disabling every RBAC route gate | **Medium — RBAC gate silently inert** | Location corrected to repo root in §2 and noted in the tech-stack doc |

Nothing in §0 (the v1.1.0 → v1.1.1 fixes) is reverted; v1.1.2 only adds what was missing to make the design runnable and safe.

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
│       │   ├── (auth)/                     # DECISION: unified single-route funnel at /auth (?mode=signin|signup&role=…)
│       │   │   ├── page.tsx                 # sign in + sign up + role dispatcher (see bayele-home.md Route 3)
│       │   │   └── onboarding/[role]/page.tsx  # post-signup completion → status = pending_review
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
│       │   └── api/webhooks/sokoclick/route.ts   # thin — verifies signature, calls one RPC
│       └── middleware.ts                          # MUST be at the app root (sibling of app/), not inside app/ — Next.js only runs it here (fixes gap #H)
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

**Routing decision (locked):** auth is a **single unified route, `/auth`** (`(auth)/page.tsx`, driven by `?mode=signin|signup&role=…`), not separate `sign-up` / `log-in` pages. Middleware redirects unauthenticated users to `/auth?mode=signin`. Onboarding remains `/onboarding/[role]`. This matches the shipped UI in `bayele-home.md` and removes the earlier cross-doc ambiguity.

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
  billing_email TEXT,                            -- invoice contact of record for SokoClick (profiles stores phone only) — fixes gap #G
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

-- NOTIFICATIONS ---------------------------------------------------------------
-- First-class subsystem from phase 1 (tech-stack §5); carried into the canonical
-- migration so the Realtime bus referenced in §2 has a table to subscribe to. Fixes gap #E.
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                             -- 'campaign_invite', 'proof_verified', 'escrow_paid_out', 'profile_approved', ...
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;
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
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

-- ── Added in v1.1.2 (fixes gaps #B and #E) ───────────────────────────────────
-- Without these, RLS is enabled on the role-profile tables with NO policy, which
-- denies all reads — including the anon public-directory query in bayele-home.md.

-- Creator profiles: publicly readable when the owning profile is active + creator;
-- owner and admin can always read/write their own.
CREATE POLICY "public read active creator profiles"
  ON public.creator_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'creator'
      WHERE p.id = creator_profiles.user_id AND p.status = 'active'
    )
  );
CREATE POLICY "creators manage own creator profile"
  ON public.creator_profiles FOR ALL
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Consultant profiles: same shape. Note tax_id lives here but is not sensitive
-- the way business tax_id is; if you'd rather keep it private, split it into a
-- separate owner-only table and expose only specialties/years_experience publicly.
CREATE POLICY "public read active consultant profiles"
  ON public.consultant_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
      WHERE p.id = consultant_profiles.user_id AND p.status = 'active'
    )
  );
CREATE POLICY "consultants manage own consultant profile"
  ON public.consultant_profiles FOR ALL
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- user_roles: readable by the owner and admins; the public-directory join above
-- reads roles via SECURITY DEFINER paths / the profiles policy, so no anon read here.
CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- campaign_creators: the creator sees their own rows; the campaign owner sees rows
-- on their campaigns; admin sees all. Needed for the proof-review list in §6.
CREATE POLICY "campaign_creators visible to creator, owner, admin"
  ON public.campaign_creators FOR SELECT
  USING (
    creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

-- Notifications: strictly private to the recipient (fixes gap #E).
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "users mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());
-- Writes go through the notify() helper / triggers running as service role or
-- SECURITY DEFINER; there is deliberately no INSERT policy for end users.
```

### 3.3 The escrow state machine — `transition_escrow()` (fixes gap #A)

Both `handle_sokoclick_invoice_paid()` (§4.2) and `verify_proof_of_post()` (§5) call `transition_escrow()`. v1.1.1 never defined it, so the spec could not run. Here it is, and it is the **only** function permitted to change `escrow_transactions.status`. It does two things atomically: validate that the requested hop is legal, and write the before/after pair to `escrow_audit_log`. That is what makes the audit trail gap-free — there is no way to move money that doesn't leave a row.

```sql
-- Single source of truth for escrow status changes. Every hop is validated and logged.
-- SECURITY DEFINER because it writes the audit log and is called from other definer
-- functions and service-role code paths; it must never be exposed directly to end users.
CREATE OR REPLACE FUNCTION public.transition_escrow(
  p_txn_id UUID,
  p_to_status public.escrow_status,
  p_actor UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_from public.escrow_status;
  v_allowed BOOLEAN;
BEGIN
  -- Lock the row so two concurrent transitions can't race (e.g. release vs. refund).
  SELECT status INTO v_from FROM public.escrow_transactions WHERE id = p_txn_id FOR UPDATE;
  IF v_from IS NULL THEN
    RAISE EXCEPTION 'escrow transaction % not found', p_txn_id;
  END IF;

  -- No-op re-requests are allowed and silently ignored (keeps callers idempotent).
  IF v_from = p_to_status THEN
    RETURN;
  END IF;

  -- Allowed transitions. Anything not listed is rejected — the machine is closed.
  v_allowed := CASE
    WHEN v_from = 'pending'       AND p_to_status IN ('held', 'refunding')                 THEN TRUE
    WHEN v_from = 'held'          AND p_to_status IN ('proof_pending', 'disputed', 'refunding') THEN TRUE
    WHEN v_from = 'proof_pending' AND p_to_status IN ('releasable', 'disputed', 'refunding')    THEN TRUE
    WHEN v_from = 'releasable'    AND p_to_status IN ('paid_out', 'disputed')              THEN TRUE
    WHEN v_from = 'disputed'      AND p_to_status IN ('releasable', 'refunding')           THEN TRUE
    WHEN v_from = 'refunding'     AND p_to_status = 'refunded'                             THEN TRUE
    ELSE FALSE
  END;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'illegal escrow transition: % -> %', v_from, p_to_status;
  END IF;

  UPDATE public.escrow_transactions
    SET status = p_to_status, updated_at = now()
    WHERE id = p_txn_id;

  INSERT INTO public.escrow_audit_log (transaction_id, from_status, to_status, actor_id, metadata)
  VALUES (p_txn_id, v_from, p_to_status, p_actor, p_metadata);
END;
$$;

-- Terminal states: 'paid_out' and 'refunded'. Reachable states from funding:
--   pending → held → proof_pending → releasable → paid_out
-- with disputed / refunding / refunded as the exception branches.
REVOKE ALL ON FUNCTION public.transition_escrow(UUID, public.escrow_status, UUID, JSONB) FROM anon, authenticated;
```

Two things worth calling out. First, the `FOR UPDATE` lock is not decoration — the release path and the refund path can be triggered by different actors (a reviewer approving vs. an admin refunding a dispute) at nearly the same time, and without the lock both could read `proof_pending` and each think their transition is legal. Second, `paid_out` is set here but the actual MoMo disbursement is a separate side effect owned by `services/momo-engine`; `transition_escrow()` records intent and the payout worker reconciles against it, so a DB commit is never coupled to an external payment call inside the same transaction.

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
        // Côte d'Ivoire is UEMOA (West African CFA, XOF); Cameroon & Gabon are CEMAC (Central African CFA, XAF).
        // Both are "FCFA" colloquially and 1:1 pegged to EUR, but they are DISTINCT ISO codes and must not be mixed on an invoice. (fixes gap #F)
        currency: options.business.country === 'CI' ? 'XOF' : 'XAF',
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
  v_campaign_id UUID;
  v_owner_id UUID;
  v_txn_id UUID;
BEGIN
  -- Resolve the campaign and its owner up front, for the authorization check.
  SELECT cc.id, cc.campaign_id, c.owner_id
    INTO v_campaign_creator_id, v_campaign_id, v_owner_id
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;

  IF v_campaign_creator_id IS NULL THEN
    RAISE EXCEPTION 'proof % not found', p_proof_id;
  END IF;

  -- Authorization (fixes gap #C): only the campaign owner or an admin may verify.
  -- SECURITY DEFINER bypasses RLS, so this guard is the ONLY thing preventing a
  -- creator from calling this RPC to approve their own proof and release their own payout.
  IF NOT (v_owner_id = p_actor OR public.is_admin(p_actor)) THEN
    RAISE EXCEPTION 'actor % not authorized to verify proofs on campaign %', p_actor, v_campaign_id;
  END IF;

  UPDATE public.proof_of_post
    SET is_valid = p_approve, reviewed_by = p_actor, reviewed_at = now(),
        rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_rejection_reason END
    WHERE id = p_proof_id;

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

-- End users reach this only through a server action that passes the authenticated
-- user as p_actor; never expose it such that the caller can spoof p_actor.
REVOKE ALL ON FUNCTION public.verify_proof_of_post(UUID, BOOLEAN, UUID, TEXT) FROM anon;
```

Revisit auto-approval once you have enough reviewed volume to know Gemini's real false-positive rate on this specific use case (WhatsApp Status screenshots, not the general imagery it was likely benchmarked on) — that's a data-driven call to make later, not a default to ship with.

### 5.1 Closing the loop — `submit_proof_of_post()` (fixes gap #D)

v1.1.1 had a hole in the middle of the state machine: `handle_sokoclick_invoice_paid()` creates a **campaign-level, inbound** escrow row (no `campaign_creator_id`), but `verify_proof_of_post()` looks for a **per-creator, `proof_pending`** row — and nothing ever created one. So no payout could ever reach `releasable`. This function is the missing hop. When a creator submits proof, it records the proof, creates the outbound per-creator payout row, and walks it `pending → held → proof_pending`, landing exactly where `verify_proof_of_post()` expects to find it.

```sql
-- Creator submits proof for their assignment. Creates the per-creator payout row
-- and moves it into the review queue. Returns the new proof_of_post id.
CREATE OR REPLACE FUNCTION public.submit_proof_of_post(
  p_campaign_creator_id UUID,
  p_actor UUID,
  p_media_storage_path TEXT,
  p_media_sha256 TEXT,
  p_media_type TEXT,
  p_gemini_raw JSONB DEFAULT NULL,
  p_verification_score NUMERIC DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'mtn_momo'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_id UUID;
  v_campaign_id UUID;
  v_agreed BIGINT;
  v_txn_id UUID;
  v_proof_id UUID;
BEGIN
  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa
    INTO v_creator_id, v_campaign_id, v_agreed
    FROM public.campaign_creators cc
    WHERE cc.id = p_campaign_creator_id
    FOR UPDATE;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'campaign_creator % not found', p_campaign_creator_id;
  END IF;

  -- Only the assigned creator may submit their own proof.
  IF v_creator_id <> p_actor THEN
    RAISE EXCEPTION 'actor % is not the assigned creator for %', p_actor, p_campaign_creator_id;
  END IF;

  -- One proof per assignment: proof_of_post.campaign_creator_id is UNIQUE, and the
  -- outbound provider_ref below is unique per assignment, so a double submission is
  -- rejected by the DB rather than creating a second payout row.
  INSERT INTO public.proof_of_post (
    campaign_creator_id, media_storage_path, media_sha256, media_type,
    gemini_raw_response, verification_score, is_valid
  ) VALUES (
    p_campaign_creator_id, p_media_storage_path, p_media_sha256, p_media_type,
    p_gemini_raw, p_verification_score, NULL
  ) RETURNING id INTO v_proof_id;

  UPDATE public.campaign_creators
    SET status = 'content_submitted', updated_at = now()
    WHERE id = p_campaign_creator_id;

  -- Outbound per-creator payout row. The platform fee was already taken on the
  -- inbound side, so fee here is 0 and net == agreed payout.
  INSERT INTO public.escrow_transactions (
    campaign_id, campaign_creator_id, recipient_profile_id, direction,
    amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status
  ) VALUES (
    v_campaign_id, p_campaign_creator_id, v_creator_id, 'outbound',
    v_agreed, 0, v_agreed, p_provider, 'payout:' || p_campaign_creator_id::text, 'pending'
  ) RETURNING id INTO v_txn_id;

  PERFORM public.transition_escrow(v_txn_id, 'held', p_actor,
    jsonb_build_object('reason', 'earmarked_from_campaign_pool', 'campaign_id', v_campaign_id));
  PERFORM public.transition_escrow(v_txn_id, 'proof_pending', p_actor,
    jsonb_build_object('proof_id', v_proof_id));

  RETURN v_proof_id;
END;
$$;
```

End-to-end, the money now has one continuous, fully-audited path:

```
invoice.paid ─► handle_sokoclick_invoice_paid()   inbound  pending → held      (campaign funded)
creator submits ─► submit_proof_of_post()          outbound pending → held → proof_pending
owner/admin approves ─► verify_proof_of_post()     outbound proof_pending → releasable
momo-engine disburses ─► transition_escrow()       outbound releasable → paid_out
```

Every arrow is a `transition_escrow()` call, so every arrow is a row in `escrow_audit_log`. There is no way to move a creator's money that isn't logged and isn't authorized.

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
| Escrow state machine defined (v1.1.2 #A) | Designed | Unit-test `transition_escrow()`: assert every legal hop succeeds, every illegal hop raises, and each writes exactly one `escrow_audit_log` row. Concurrency test: two transitions on one row under load, confirm the `FOR UPDATE` lock serializes them |
| Public directory RLS (v1.1.2 #B) | Designed | Query `creator_profiles`/`consultant_profiles` with an anon JWT and confirm active profiles are returned; confirm a `pending_review` profile is not |
| Proof self-approval guard (v1.1.2 #C) | Designed | As a creator JWT, call `verify_proof_of_post()` on your own proof and confirm it raises `not authorized`; as the campaign owner, confirm it succeeds |
| Per-creator payout loop (v1.1.2 #D) | Designed | Integration test: fund → `submit_proof_of_post()` → `verify_proof_of_post()` → assert the outbound row reaches `releasable` and the audit log shows the full chain |
| Currency by market (v1.1.2 #F) | Designed | Assert a CI business produces an `XOF` invoice and a CM/GA business produces `XAF` |

This table intentionally doesn't say "PASSED" anywhere — nothing here has been run against a live system yet. The v1.1.2 rows are new *design* that closes gaps; they raise the same bar for verification as everything above them.
