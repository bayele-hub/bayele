-- pgTAP suite for the money path. Runs in CI via `supabase test db`.
BEGIN;
SELECT plan(4);

-- is_admin() is false for a random (non-admin) uuid (spec §0 #1 regression guard).
SELECT ok(NOT public.is_admin(gen_random_uuid()), 'is_admin false for non-admin');

-- Seed a minimal campaign + inbound escrow row to exercise transitions.
INSERT INTO auth.users (id) VALUES ('00000000-0000-0000-0000-000000000001') ON CONFLICT DO NOTHING;
INSERT INTO public.profiles (id, handle, display_name, city, country, phone_e164, status)
  VALUES ('00000000-0000-0000-0000-000000000001','owner_biz','Owner','Douala','CM','+237600000001','active');
INSERT INTO public.campaigns (id, owner_id, owner_role, title, brief, target_country, category, total_budget_fcfa, payout_per_creator_fcfa, platform_fee_rate)
  VALUES ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','business','T','B','CM','beauty',10000,10000,0.10);
INSERT INTO public.escrow_transactions (id, campaign_id, direction, amount_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','inbound',10000,9000,'mtn_momo','inv_1','pending');

-- Legal hop pending -> held succeeds and writes exactly one audit row.
SELECT lives_ok(
  $$ SELECT public.transition_escrow('20000000-0000-0000-0000-000000000001','held','00000000-0000-0000-0000-000000000001') $$,
  'pending -> held is legal');
SELECT is(
  (SELECT count(*)::int FROM public.escrow_audit_log WHERE transaction_id = '20000000-0000-0000-0000-000000000001'),
  1, 'one audit row written');

-- Illegal hop held -> paid_out is rejected.
SELECT throws_ok(
  $$ SELECT public.transition_escrow('20000000-0000-0000-0000-000000000001','paid_out','00000000-0000-0000-0000-000000000001') $$,
  NULL, 'illegal escrow transition: held -> paid_out', 'illegal hop rejected');

SELECT * FROM finish();
ROLLBACK;
