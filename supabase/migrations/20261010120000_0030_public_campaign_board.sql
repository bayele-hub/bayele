-- ============================================================================
-- Migration:          Public campaign board (/campaigns) + per-campaign public stats
-- Version:            20261010120000_0030
-- Date:               2026-10-10
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0005, 0022 (campaign brief & visibility), 0029 (country_code NG/KE/ZA)
-- Rollback Script:    supabase/migrations/rollback/20261010120000_0030_public_campaign_board.rollback.sql
-- Plan:               docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md §6 Phase 1, decisions D2 + D4
-- ============================================================================
-- Rules:
--   * Anonymous visitors read the board ONLY through these two SECURITY DEFINER functions, which
--     return a fixed, safe column list. No new table grants for anon (SKILL.md §3 #1).
--   * Each function filters to is_public AND status IN ('published','in_progress') itself (#3).
--   * Never returned: total_budget_fcfa, platform_fee_rate, owner_id, owner_role, brief,
--     mandatory_tags, match_pass_paid. business_profiles is never read (#7) — the brand identity is
--     the owner's profiles.display_name / handle only.
--   * Counts:
--       applied_count = campaign_creators rows in applied | approved | content_submitted | verified | paid | disputed
--       places_left   = greatest(creator_count_target − rows in approved | content_submitted | verified | paid | disputed, 0)
--       (QA D6, decided: a disputed deal still occupies its place.)
--   * Ranking (D4 + council C1): campaigns with places first (full ones stay, ranked last), then
--     payout_per_creator_fcfa DESC, places_left DESC, created_at DESC (id as tiebreak).
-- ============================================================================

-- ── Board ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_campaign_board(
  p_country  public.country_code DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_limit    integer DEFAULT 10
)
 RETURNS TABLE (
  id                      uuid,
  title                   text,
  category                text,
  target_country          public.country_code,
  payout_per_creator_fcfa bigint,
  creator_count_target    integer,
  platforms               text[],
  content_type            text,
  deliverable_quantity    integer,
  deadline                date,
  created_at              timestamptz,
  brand_name              text,
  brand_handle            text,
  applied_count           integer,
  places_left             integer
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH open_campaigns AS (
    SELECT c.id, c.title, c.category, c.target_country, c.payout_per_creator_fcfa,
           c.creator_count_target, c.platforms, c.content_type, c.deliverable_quantity,
           c.deadline, c.created_at, c.owner_id
      FROM public.campaigns c
     WHERE c.is_public
       AND c.status IN ('published', 'in_progress')
       AND (p_country IS NULL OR c.target_country = p_country)
       AND (nullif(btrim(p_category), '') IS NULL OR lower(c.category) = lower(btrim(p_category)))
  ),
  counted AS (
    SELECT oc.*,
           coalesce(cnt.applied, 0)  AS applied,
           coalesce(cnt.engaged, 0)  AS engaged
      FROM open_campaigns oc
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE cc.status IN ('applied','approved','content_submitted','verified','paid','disputed'))::integer AS applied,
               count(*) FILTER (WHERE cc.status IN ('approved','content_submitted','verified','paid','disputed'))::integer           AS engaged
          FROM public.campaign_creators cc
         WHERE cc.campaign_id = oc.id
      ) cnt ON true
  )
  SELECT k.id, k.title, k.category, k.target_country, k.payout_per_creator_fcfa,
         k.creator_count_target, k.platforms, k.content_type, k.deliverable_quantity,
         k.deadline, k.created_at,
         p.display_name AS brand_name,
         p.handle       AS brand_handle,
         k.applied      AS applied_count,
         greatest(k.creator_count_target - k.engaged, 0) AS places_left
    FROM counted k
    LEFT JOIN public.profiles p ON p.id = k.owner_id
   ORDER BY (k.creator_count_target - k.engaged > 0) DESC,   -- C1: full campaigns stay, ranked last
            k.payout_per_creator_fcfa DESC,
            greatest(k.creator_count_target - k.engaged, 0) DESC,
            k.created_at DESC,
            k.id
   LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;

COMMENT ON FUNCTION public.public_campaign_board(public.country_code, text, integer) IS
  'Public board of open campaigns (is_public AND published|in_progress). Safe columns only; ranked: has places first, then pay, places left, newest. Limit clamped to 1..50.';

REVOKE ALL ON FUNCTION public.public_campaign_board(public.country_code, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_campaign_board(public.country_code, text, integer) TO anon, authenticated, service_role;

-- ── Single-campaign stats (soft-wall campaign page) ──────────────────────────
-- (DROP first: CREATE OR REPLACE cannot change a function's result columns.)
DROP FUNCTION IF EXISTS public.public_campaign_stats(uuid);
-- Returns exactly one row for a public + open campaign, zero rows otherwise (unknown id, draft,
-- private, completed, cancelled …), so the page can hide the stat rather than invent one.
-- brand_name / brand_handle come from the owner's profile exactly as in the board (QA D2: the
-- profiles RLS policy hides business rows, so the page cannot read them itself).
CREATE OR REPLACE FUNCTION public.public_campaign_stats(p_campaign_id uuid)
 RETURNS TABLE (applied_count integer, places_left integer, brand_name text, brand_handle text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(cc.id) FILTER (WHERE cc.status IN ('applied','approved','content_submitted','verified','paid','disputed'))::integer,
         greatest(c.creator_count_target
                  - count(cc.id) FILTER (WHERE cc.status IN ('approved','content_submitted','verified','paid','disputed'))::integer, 0),
         p.display_name,
         p.handle
    FROM public.campaigns c
    LEFT JOIN public.profiles p ON p.id = c.owner_id
    LEFT JOIN public.campaign_creators cc ON cc.campaign_id = c.id
   WHERE c.id = p_campaign_id
     AND c.is_public
     AND c.status IN ('published', 'in_progress')
   GROUP BY c.id, c.creator_count_target, p.display_name, p.handle;
$function$;

COMMENT ON FUNCTION public.public_campaign_stats(uuid) IS
  'applied_count, places_left, brand_name, brand_handle for ONE public, open campaign; empty result otherwise.';

REVOKE ALL ON FUNCTION public.public_campaign_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_campaign_stats(uuid) TO anon, authenticated, service_role;

-- ── D2: new campaigns are public by default (existing rows untouched) ────────
ALTER TABLE public.campaigns ALTER COLUMN is_public SET DEFAULT true;
