-- ============================================================================
-- Migration:          Partner payout number + founder counter lockdown
-- Version:            20261010100000_0028
-- Date:               2026-10-10
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0018 (column-level SELECT grants), 0026, 0027
-- Rollback Script:    supabase/migrations/rollback/20261010100000_0028_partner_payout_and_lockdown.rollback.sql
-- ============================================================================
-- 1) Partners get their own Mobile Money payout number for commissions (managed creators, 0027).
--    PII: 0018 replaced the table-wide SELECT on consultant_profiles with a column list, so these new
--    columns are NOT readable by anon/authenticated. The owner reads them through
--    get_my_partner_payout_settings(); admins through admin_owed_commissions(). The owner still
--    writes them with the existing "manage own consultant profile" policy.
-- 2) founder_badge_stats() is no longer used by the site (the home-page promotion was removed), so it
--    stops being callable from the public API. The service role keeps it for a later relaunch.
-- ============================================================================

ALTER TABLE public.consultant_profiles
  ADD COLUMN IF NOT EXISTS momo_payout_phone_e164 text,
  ADD COLUMN IF NOT EXISTS momo_provider public.payment_provider DEFAULT 'mtn_momo';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultant_momo_e164') THEN
    ALTER TABLE public.consultant_profiles ADD CONSTRAINT consultant_momo_e164
      CHECK (momo_payout_phone_e164 IS NULL OR momo_payout_phone_e164 ~ '^\+[1-9][0-9]{7,14}$');
  END IF;
END $$;

-- Owner-only read of the partner's own payout settings.
CREATE OR REPLACE FUNCTION public.get_my_partner_payout_settings()
 RETURNS TABLE (momo_payout_phone_e164 text, momo_provider public.payment_provider)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
  SELECT kp.momo_payout_phone_e164, kp.momo_provider
    FROM public.consultant_profiles kp WHERE kp.user_id = auth.uid();
$function$;
REVOKE ALL ON FUNCTION public.get_my_partner_payout_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_partner_payout_settings() TO authenticated;

-- Admin queue of commissions to pay, with where to send them. Admin-only (raises otherwise).
CREATE OR REPLACE FUNCTION public.admin_owed_commissions()
 RETURNS TABLE (
   id uuid, partner_id uuid, partner_name text, partner_handle text,
   payout_phone text, payout_provider public.payment_provider,
   creator_name text, campaign_title text,
   commission_fcfa bigint, commission_rate numeric, gross_payout_fcfa bigint, created_at timestamptz
 ) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
  SELECT pc.id, pc.partner_id, pp.display_name, pp.handle,
         kp.momo_payout_phone_e164, kp.momo_provider,
         cp.display_name, c.title,
         pc.commission_fcfa, pc.commission_rate, pc.gross_payout_fcfa, pc.created_at
    FROM public.partner_commissions pc
    JOIN public.profiles pp ON pp.id = pc.partner_id
    LEFT JOIN public.consultant_profiles kp ON kp.user_id = pc.partner_id
    JOIN public.profiles cp ON cp.id = pc.creator_id
    JOIN public.campaign_creators cc ON cc.id = pc.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
   WHERE pc.status = 'owed'
   ORDER BY pc.created_at
   LIMIT 200;
END;
$function$;
REVOKE ALL ON FUNCTION public.admin_owed_commissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_owed_commissions() TO authenticated;

-- Founder counter: server-side only from now on.
REVOKE EXECUTE ON FUNCTION public.founder_badge_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.founder_badge_stats() TO service_role;
