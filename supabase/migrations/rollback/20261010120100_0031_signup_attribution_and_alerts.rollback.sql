-- ============================================================================
-- Rollback of:        20261010120100_0031_signup_attribution_and_alerts.sql
-- Inverse type:       TRUE INVERSE — DESTRUCTIVE: drops all sign-up attribution rows and all
--                     campaign alerts. Notifications already sent (type 'campaign_alert') are kept.
-- Export first if the data matters:
--   COPY public.signup_attribution TO STDOUT WITH CSV HEADER;
--   COPY public.campaign_alerts    TO STDOUT WITH CSV HEADER;
-- ============================================================================

DROP TRIGGER IF EXISTS trg_notify_campaign_alerts ON public.campaigns;
DROP FUNCTION IF EXISTS private.notify_campaign_alerts();

DROP FUNCTION IF EXISTS public.my_campaign_alerts();
DROP FUNCTION IF EXISTS public.unsubscribe_campaign_alert(uuid);
DROP FUNCTION IF EXISTS public.subscribe_campaign_alert(public.country_code, text);
DROP FUNCTION IF EXISTS public.campaign_alert_limit();
DROP TABLE IF EXISTS public.campaign_alerts;

DROP FUNCTION IF EXISTS public.admin_signup_attribution_stats();
DROP FUNCTION IF EXISTS public.my_referral_count();
DROP FUNCTION IF EXISTS public.record_signup_attribution(text, text);
DROP TABLE IF EXISTS public.signup_attribution;
DROP INDEX IF EXISTS public.profiles_handle_lower_idx;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS handle_lowercase;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261010120100';
