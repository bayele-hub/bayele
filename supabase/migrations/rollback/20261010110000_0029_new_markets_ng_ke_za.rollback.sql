-- ============================================================================
-- Rollback of:        20261010110000_0029_new_markets_ng_ke_za.sql
-- Inverse type:       NOT A TRUE INVERSE — Postgres cannot drop an enum value.
-- Removing NG/KE/ZA or mpesa/opay/palmpay would mean recreating both enums and rewriting every
-- column that uses them, after moving any rows that use the new values. Do this only if no
-- profile, campaign or payout uses them:
--   SELECT count(*) FROM public.profiles  WHERE country IN ('NG','KE','ZA');
--   SELECT count(*) FROM public.campaigns WHERE target_country IN ('NG','KE','ZA');
--   SELECT count(*) FROM public.creator_profiles WHERE momo_provider IN ('mpesa','opay','palmpay');
-- In practice, roll back the APP (hide the countries/providers in lib/countries.ts and
-- lib/data/campaigns.ts) and leave the enum values in place — unused values are harmless.
-- ============================================================================

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261010110000';
