-- ============================================================================
-- Migration:          Core schema — four-actor model, campaigns, escrow, invoices
-- Version:            20260817120000_0001
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-CORE-001  (spec: bayele-production-spec-v1.1.2 §3.1)
-- Dependencies:       none (greenfield — depends only on the Supabase-managed auth.users)
-- Rollback Script:    supabase/migrations/rollback/20260817120000_0001_core_schema.rollback.sql
-- Estimated Duration: ~1.5s on an empty database
-- ============================================================================
-- Description:        Provisions the canonical four-actor schema: profiles + role tables
--                     (creator/consultant/business), campaigns and per-creator assignments,
--                     the escrow ledger + append-only audit log, proof-of-post, SokoClick
--                     invoices, agency retainers, and notifications. DDL only; RLS and RPCs
--                     arrive in 0002 and 0003.
-- Breaking Changes:   NONE — purely additive, greenfield.
-- Performance Impact: All tables created empty (no locks of consequence). One partial index on
--                     notifications(user_id, created_at DESC) WHERE read_at IS NULL powers the
--                     unread-bell count without a full scan. ~0.5–1KB per row across tables.
-- Compliance Notes:   Enforces the money/identity invariants in the schema itself:
--                       • budget_math_check, valid_fee_rate, retainer_math_integrity (money math)
--                       • billing_email/tax_id/billing_address live only on business_profiles (PII,
--                         locked to owner+admin by 0002 — never public) [OHADA invoicing party]
--                       • country_code ∈ {CM,GA,CI}; XAF (CEMAC: CM,GA) vs XOF (UEMOA: CI) is
--                         derived from country downstream — no ISO mixing on one invoice.
--                     Identity seam is a single FK profiles.id → auth.users(id) (portability §9).
-- ============================================================================

-- SUPABASE-SPECIFIC: pgcrypto (gen_random_uuid) + pg_cron (scheduled jobs). Both are first-class
-- on RDS/Cloud SQL, so this is portable; kept idempotent.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ENUMS (idempotent guards so the file is safe to re-apply) --------------------
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='user_role') THEN
  CREATE TYPE public.user_role AS ENUM ('super_admin','creator','consultant','business'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='account_status') THEN
  CREATE TYPE public.account_status AS ENUM ('pending_review','active','suspended','rejected'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='country_code') THEN
  CREATE TYPE public.country_code AS ENUM ('CM','GA','CI'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='campaign_status') THEN
  CREATE TYPE public.campaign_status AS ENUM
    ('draft','pending_funding','published','in_progress','under_review','completed','disputed','cancelled'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='creator_campaign_status') THEN
  CREATE TYPE public.creator_campaign_status AS ENUM
    ('invited','applied','approved','rejected','content_submitted','verified','paid','disputed'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='escrow_status') THEN
  CREATE TYPE public.escrow_status AS ENUM
    ('pending','held','proof_pending','releasable','disputed','paid_out','refunding','refunded'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='payment_provider') THEN
  CREATE TYPE public.payment_provider AS ENUM ('mtn_momo','orange_money','wave','airtel_money','bank_wire'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='retainer_status') THEN
  CREATE TYPE public.retainer_status AS ENUM ('draft','invoiced','funded','active','completed','terminated'); END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='invoice_type') THEN
  CREATE TYPE public.invoice_type AS ENUM ('match_pass','campaign_escrow','agency_retainer','pro_subscription'); END IF; END $$;

-- PROFILES --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,   -- the ONE identity seam (§9)
  handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  city TEXT NOT NULL,
  country public.country_code NOT NULL,
  phone_e164 TEXT UNIQUE,                        -- optional; phone auth/payout is v2 (email/password primary)
  status public.account_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT handle_format CHECK (handle ~* '^[a-z0-9_]{3,30}$')
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.creator_profiles (
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

CREATE TABLE IF NOT EXISTS public.consultant_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  tax_id TEXT,
  agency_access BOOLEAN NOT NULL DEFAULT FALSE,
  years_experience INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.business_profiles (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL,
  tax_id TEXT,                                   -- PII: owner+admin only (0002)
  billing_email TEXT,                            -- invoice contact of record (spec §0.1 #G)
  billing_address TEXT,                          -- PII: owner+admin only (0002)
  website TEXT,
  sokoclick_customer_id TEXT UNIQUE,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- CAMPAIGNS -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaigns (
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
  platform_fee_rate NUMERIC(4,3) NOT NULL DEFAULT 0.10,   -- set once by tier, read at funding (spec §0 #4)
  status public.campaign_status NOT NULL DEFAULT 'draft',
  match_pass_paid BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT valid_campaign_owner CHECK (owner_role IN ('business','consultant','super_admin')),
  CONSTRAINT budget_math_check CHECK (total_budget_fcfa >= (payout_per_creator_fcfa * creator_count_target)),
  CONSTRAINT valid_fee_rate CHECK (platform_fee_rate IN (0.10, 0.15, 0.25))
);

CREATE TABLE IF NOT EXISTS public.campaign_creators (
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
CREATE TABLE IF NOT EXISTS public.escrow_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  campaign_creator_id UUID REFERENCES public.campaign_creators(id) ON DELETE RESTRICT,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  direction TEXT NOT NULL,
  amount_fcfa BIGINT NOT NULL,
  fee_fcfa BIGINT NOT NULL DEFAULT 0,
  net_amount_fcfa BIGINT NOT NULL,
  provider public.payment_provider NOT NULL,
  provider_ref TEXT UNIQUE,                        -- idempotency key, always set (spec §0 #5)
  status public.escrow_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.escrow_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  from_status public.escrow_status NOT NULL,
  to_status public.escrow_status NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.proof_of_post (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_creator_id UUID UNIQUE NOT NULL REFERENCES public.campaign_creators(id) ON DELETE CASCADE,
  media_storage_path TEXT NOT NULL,
  media_sha256 TEXT NOT NULL,
  media_type TEXT NOT NULL,
  gemini_raw_response JSONB,
  verification_score NUMERIC(4,3),                 -- queue-priority signal only (spec §0 #7)
  is_valid BOOLEAN,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- INVOICES & RETAINERS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sokoclick_invoice_id TEXT UNIQUE NOT NULL,       -- idempotency key (spec §0 #5)
  sokoclick_receipt_id TEXT UNIQUE,
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  invoice_type public.invoice_type NOT NULL,
  amount_fcfa BIGINT NOT NULL,
  tax_amount_fcfa BIGINT NOT NULL DEFAULT 0,
  pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.agency_retainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  consultant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  contract_value_fcfa BIGINT NOT NULL,
  bayele_cut_fcfa BIGINT NOT NULL,
  consultant_fee_fcfa BIGINT NOT NULL,
  media_budget_fcfa BIGINT NOT NULL,
  kpi_bonus_fcfa BIGINT NOT NULL DEFAULT 0,        -- earned on completion, not funded upfront (spec §0 #8)
  status public.retainer_status NOT NULL DEFAULT 'draft',
  sokoclick_invoice_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT retainer_math_integrity CHECK (
    contract_value_fcfa = (bayele_cut_fcfa + consultant_fee_fcfa + media_budget_fcfa)
  )
);

-- NOTIFICATIONS ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC) WHERE read_at IS NULL;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — run against the live schema, expect 14:
--   SELECT count(*) FROM information_schema.tables
--   WHERE table_schema='public' AND table_type='BASE TABLE';
-- And expect the 9 enums:
--   SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace
--   WHERE n.nspname='public' AND t.typtype='e';
-- ============================================================================
