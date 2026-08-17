-- ============================================================================
-- Rollback of:        20260817121100_0012_campaign_funding.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       TRUE INVERSE — drop the funding RPC. (Escrow rows it created remain; unwinding
--                     funded money is a deliberate financial operation, never an automatic drop.)
-- ============================================================================

DROP FUNCTION IF EXISTS public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text);

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817121100';
