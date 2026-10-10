-- ============================================================================
-- Migration:          New markets — Nigeria, Kenya, South Africa + their payout rails
-- Version:            20261010110000_0029
-- Date:               2026-10-10
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001 (country_code, payment_provider enums)
-- Rollback Script:    supabase/migrations/rollback/20261010110000_0029_new_markets_ng_ke_za.rollback.sql
-- ============================================================================
-- Creators, partners and brands can register in NG / KE / ZA, and brands can target those countries
-- with campaigns. Campaign money stays in FCFA (unchanged maths); payouts in the new markets go
-- through local rails and are converted by the admin at payout.
-- Additive only: ADD VALUE never rewrites existing rows. (Postgres can't use a new enum value in the
-- same transaction that adds it, so nothing below references the new values.)
-- ============================================================================

ALTER TYPE public.country_code ADD VALUE IF NOT EXISTS 'NG';
ALTER TYPE public.country_code ADD VALUE IF NOT EXISTS 'KE';
ALTER TYPE public.country_code ADD VALUE IF NOT EXISTS 'ZA';

ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'mpesa';    -- Kenya
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'opay';     -- Nigeria
ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'palmpay';  -- Nigeria
