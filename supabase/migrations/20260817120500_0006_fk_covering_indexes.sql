-- ============================================================================
-- Migration:          Covering indexes for foreign keys (performance advisor 0001 → clean)
-- Version:            20260817120500_0006
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-PERF-006  (closes get_advisors(performance) unindexed-FK findings)
-- Dependencies:       20260817120000_0001 (all referenced tables/columns)
-- Rollback Script:    supabase/migrations/rollback/20260817120500_0006_fk_covering_indexes.rollback.sql
-- Estimated Duration: <0.2s (tables are empty; builds are instant)
-- ============================================================================
-- Description:        Adds a covering B-tree index for every foreign key whose leading column is
--                     not already indexed by a PK or unique constraint. This speeds up joins,
--                     RLS EXISTS() predicates, and — importantly — the ON DELETE RESTRICT/CASCADE
--                     integrity checks, which otherwise sequential-scan the child table.
-- Breaking Changes:   NONE (additive indexes).
-- Performance Impact: Positive. Built inline (no CONCURRENTLY) because the tables are empty at
--                     apply time; on a populated table these would move to their own CONCURRENTLY
--                     migration per DATABASE-MIGRATIONS.md Part 3.3.
-- Compliance Notes:   None. Pure performance.
-- ============================================================================

CREATE INDEX IF NOT EXISTS campaigns_owner_id_idx                  ON public.campaigns (owner_id);
CREATE INDEX IF NOT EXISTS campaign_creators_creator_id_idx        ON public.campaign_creators (creator_id);
CREATE INDEX IF NOT EXISTS escrow_transactions_campaign_id_idx     ON public.escrow_transactions (campaign_id);
CREATE INDEX IF NOT EXISTS escrow_transactions_campaign_creator_idx ON public.escrow_transactions (campaign_creator_id);
CREATE INDEX IF NOT EXISTS escrow_transactions_recipient_idx       ON public.escrow_transactions (recipient_profile_id);
CREATE INDEX IF NOT EXISTS escrow_audit_log_transaction_id_idx     ON public.escrow_audit_log (transaction_id);
CREATE INDEX IF NOT EXISTS escrow_audit_log_actor_id_idx           ON public.escrow_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS proof_of_post_reviewed_by_idx           ON public.proof_of_post (reviewed_by);
CREATE INDEX IF NOT EXISTS invoices_business_id_idx                ON public.invoices (business_id);
CREATE INDEX IF NOT EXISTS agency_retainers_business_id_idx        ON public.agency_retainers (business_id);
CREATE INDEX IF NOT EXISTS agency_retainers_consultant_id_idx      ON public.agency_retainers (consultant_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx               ON public.notifications (user_id);

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6): get_advisors(performance) returns no unindexed_foreign_keys.
-- ============================================================================
