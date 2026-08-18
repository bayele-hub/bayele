-- ============================================================================
-- Rollback of:        20260818090000_0018_security_hardening_audit.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       PARTIAL / DANGEROUS. This migration REPLACED existing functions with hardened
--                     bodies and tightened column grants. This rollback undoes the grant lockdown and
--                     drops the new RPC, but does NOT restore the pre-0018 (vulnerable) function bodies
--                     — reverting those re-opens the escrow-drain, double-funding, and race defects and
--                     must be done deliberately by restoring the prior definitions from git
--                     (0003/0012/0013/0016/0017). Do not run this on production except to debug.
-- ============================================================================

-- Re-open the PII column lockdown (RESTORES THE LEAK — anon/authenticated regain full-row read).
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.creator_profiles TO anon, authenticated;
GRANT SELECT ON public.consultant_profiles TO anon, authenticated;

-- Drop the owner-only payout-settings reader.
DROP FUNCTION IF EXISTS public.get_my_payout_settings();

-- NOTE: private.guard_campaigns, public.submit_proof_of_post, public.verify_proof_of_post,
-- public.decide_application, public.handle_sokoclick_invoice_paid, public.admin_confirm_campaign_funding,
-- public.admin_confirm_creator_payout, and public.admin_refund_campaign remain in their HARDENED form.
-- Restore their prior bodies from git history only if you must fully revert 0018.

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260818090000';
