-- ============================================================================
-- Rollback of:        20261010100000_0028_partner_payout_and_lockdown.sql
-- Inverse type:       TRUE INVERSE.
-- WARNING: dropping the columns deletes every partner's saved payout number.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.founder_badge_stats() TO anon, authenticated;
DROP FUNCTION IF EXISTS public.admin_owed_commissions();
DROP FUNCTION IF EXISTS public.get_my_partner_payout_settings();
ALTER TABLE public.consultant_profiles DROP CONSTRAINT IF EXISTS consultant_momo_e164;
ALTER TABLE public.consultant_profiles DROP COLUMN IF EXISTS momo_payout_phone_e164, DROP COLUMN IF EXISTS momo_provider;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261010100000';
