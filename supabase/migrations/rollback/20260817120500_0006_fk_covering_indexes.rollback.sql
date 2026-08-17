-- ============================================================================
-- Rollback of:        20260817120500_0006_fk_covering_indexes.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the covering indexes this file created.
-- ============================================================================

DROP INDEX IF EXISTS public.campaigns_owner_id_idx;
DROP INDEX IF EXISTS public.campaign_creators_creator_id_idx;
DROP INDEX IF EXISTS public.escrow_transactions_campaign_id_idx;
DROP INDEX IF EXISTS public.escrow_transactions_campaign_creator_idx;
DROP INDEX IF EXISTS public.escrow_transactions_recipient_idx;
DROP INDEX IF EXISTS public.escrow_audit_log_transaction_id_idx;
DROP INDEX IF EXISTS public.escrow_audit_log_actor_id_idx;
DROP INDEX IF EXISTS public.proof_of_post_reviewed_by_idx;
DROP INDEX IF EXISTS public.invoices_business_id_idx;
DROP INDEX IF EXISTS public.agency_retainers_business_id_idx;
DROP INDEX IF EXISTS public.agency_retainers_consultant_id_idx;
DROP INDEX IF EXISTS public.notifications_user_id_idx;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120500';
