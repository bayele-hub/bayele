-- ============================================================================
-- Migration:          Managed campaigns (« Géré par Bayele ») — campaign fields, board/stats v2,
--                     pay floors, internal intake tracker (managed_briefs) + publish RPC
-- Version:            20261011090000_0033
-- Date:               2026-10-11
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0001, 0005, 0012, 0018 (guard_campaigns, admin_confirm_campaign_funding),
--                     0022, 0030 (board/stats v1), 0031 (alerts trigger), 0032 (anon column grants)
-- Rollback Script:    supabase/migrations/rollback/20261011090000_0033_managed_campaigns.rollback.sql
-- Plan:               docs/MANAGED-CAMPAIGNS-PLAN.md §1 (M1–M10), §4, §6; Co-CTO decisions K1–K9
-- ============================================================================
-- K8: this file contains no destructive keywords, so the Supabase connector can apply it. Everything
-- is additive and re-runnable: ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, CREATE OR
-- REPLACE (unchanged signatures only), guarded DO blocks for constraints / policies / the enum.
--
-- 1. campaigns: is_managed, brand_label, brand_consent, brand_city, language, usage_rights,
--    creator_requirements, equipment.
--      * campaigns_managed_fields  — managed ⇒ brand_label, brand_city, language, usage_rights,
--        deadline set AND owner_role = 'super_admin' AND platform_fee_rate = 0.25 (Agency, M4/K6);
--        not managed ⇒ brand_label / brand_city NULL and brand_consent false.
--      * campaigns_managed_text_lengths — length caps on the new text fields.
--      * anon may read the public-safe new columns (NOT brand_consent — internal, K3).
--      * private.guard_campaigns: non-admins can never set is_managed or the brand_* fields
--        (forced on INSERT, pinned on UPDATE); is_managed is frozen for everyone once funded.
-- 2. public_campaign_board_v2 / public_campaign_stats_v2: same filters, ranking (D4 + C1) and grants
--    as the 0030 versions, plus is_managed + brand_city; when is_managed, brand_name = brand_label
--    and brand_handle = NULL. v1 is left unchanged (a new result shape needs a new name under K8).
-- 3. pay_floors (K1): one row per deliverable_type, min net FCFA per unit; NULL = not set. Ships
--    EMPTY. Admin RPCs only (no table grants to anon/authenticated).
-- 4. managed_briefs: admin-only intake tracker (M2 order proof, deposit, floor check, link to the
--    campaign). admin_publish_managed_brief creates the managed campaign in 'pending_funding'
--    (invisible on the board); it becomes 'published' only through the existing
--    admin_confirm_campaign_funding path (M2/M10/K6) — this migration does not fork that flow.
-- Round 2 (Co-CTO E1–E10, council R1–R8, Legal):
--   E2  admin_confirm_campaign_funding + admin_refund_campaign (same signatures): the funded /
--       refunded notification of an admin-owned managed campaign links to /admin/briefs.
--   E3  managed_net_preview(total, places, count): fee / pool / net per place / per unit / rounding
--       remainder (remainder stays in the escrow pool).
--   E4  admin_decline_managed_brief: status 'declined' + cancels a linked pending_funding campaign.
--   E5  a brief with a live (not cancelled) campaign: listing fields locked (brief_locked).
--   E6  manual status only draft | awaiting_order | declined; awaiting_payment / published are system-set.
--   E7  managed_briefs.brand_consent_proof (internal); required to publish when brand_consent.
--   E8  a brief whose campaign was cancelled returns to 'draft' and may be published again.
--   E9  guard: a non-admin INSERT gets owner_role = the caller's real role (business | consultant).
--   E10 floor checked on the brief's main deliverable_type only (v1).
--   Legal: claims_verified on managed_briefs + campaigns; publish raises claims_not_verified when the
--       normalised category (or sector) contains immobilier | fintech | finance | sante (QA D1).
--   R7  language stays free text (≤ 60). R8: campaigns.category has no DB allow-list — nothing to change.
-- ============================================================================

-- ── 1. campaigns: managed fields ────────────────────────────────────────────
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_managed           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_label          text,
  ADD COLUMN IF NOT EXISTS brand_consent        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_city           text,
  ADD COLUMN IF NOT EXISTS language             text,
  ADD COLUMN IF NOT EXISTS usage_rights         text,
  ADD COLUMN IF NOT EXISTS creator_requirements text,
  ADD COLUMN IF NOT EXISTS equipment            text,
  ADD COLUMN IF NOT EXISTS claims_verified      boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.campaigns.is_managed IS
  'Managed by Bayele (« Géré par Bayele »): owned by a super_admin, Agency fee 0.25, brand shown via brand_label.';
COMMENT ON COLUMN public.campaigns.brand_label IS
  'Public brand line of a managed campaign: consented real name or an honest descriptor (« Restaurant · Douala »). Never an unconsented real company name (K3).';
COMMENT ON COLUMN public.campaigns.brand_consent IS
  'Internal: the brand gave written consent to be named. Not readable by anon.';
COMMENT ON COLUMN public.campaigns.claims_verified IS
  'Internal (Legal): real-estate / finance / health claims of a managed campaign were substantiated before publishing. Admin-only write; not readable by anon.';

-- Added NOT VALID, then validated separately (validation takes only SHARE UPDATE EXCLUSIVE).
-- Existing rows have is_managed = false and NULL brand fields, so validation cannot fail.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.campaigns'::regclass AND conname = 'campaigns_managed_fields') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_managed_fields CHECK (
      CASE WHEN is_managed THEN
             nullif(btrim(brand_label), '')  IS NOT NULL
         AND nullif(btrim(brand_city), '')   IS NOT NULL
         AND nullif(btrim(language), '')     IS NOT NULL
         AND nullif(btrim(usage_rights), '') IS NOT NULL
         AND deadline IS NOT NULL
         AND owner_role = 'super_admin'
         AND platform_fee_rate = 0.25
      ELSE brand_label IS NULL AND brand_city IS NULL AND brand_consent = false
      END
    ) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'public.campaigns'::regclass AND conname = 'campaigns_managed_text_lengths') THEN
    ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_managed_text_lengths CHECK (
          coalesce(char_length(brand_label), 0)          <= 80
      AND coalesce(char_length(brand_city), 0)           <= 80
      AND coalesce(char_length(language), 0)             <= 60
      AND coalesce(char_length(usage_rights), 0)         <= 500
      AND coalesce(char_length(creator_requirements), 0) <= 1000
      AND coalesce(char_length(equipment), 0)            <= 500
    ) NOT VALID;
  END IF;
END $$;

ALTER TABLE public.campaigns VALIDATE CONSTRAINT campaigns_managed_fields;
ALTER TABLE public.campaigns VALIDATE CONSTRAINT campaigns_managed_text_lengths;

-- anon column grant (0032 pattern): public-safe new columns only. brand_consent stays internal.
GRANT SELECT (is_managed, brand_label, brand_city, language, usage_rights, creator_requirements, equipment)
  ON public.campaigns TO anon;

-- Write guard (0018 body + managed rules). Definer RPCs run as the function owner and bypass it.
CREATE OR REPLACE FUNCTION private.guard_campaigns()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_admin boolean;
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    v_admin := coalesce(private.is_admin(auth.uid()), false);
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'draft';
      NEW.match_pass_paid := false;
      IF NOT v_admin THEN
        -- E9: owner_role is the caller's real role, never 'super_admin'.
        -- Read inline (guard is SECURITY INVOKER; the caller sees its own user_roles rows via RLS), so no
        -- callable helper exists that could be used as a role oracle (QA D2). Fails closed (NULL → raise).
        NEW.owner_role := (SELECT ur.role FROM public.user_roles ur
                            WHERE ur.user_id = auth.uid() AND ur.role IN ('business', 'consultant')
                            ORDER BY (ur.role = NEW.owner_role) DESC, (ur.role = 'business') DESC
                            LIMIT 1);
        IF NEW.owner_role IS NULL THEN RAISE EXCEPTION 'not_authorized'; END IF;
        -- Only admins may create a managed campaign or set the brand / legal fields (M1/K3/K6).
        NEW.is_managed := false;
        NEW.brand_label := NULL;
        NEW.brand_city := NULL;
        NEW.brand_consent := false;
        NEW.claims_verified := false;
      END IF;
    ELSE
      NEW.status := OLD.status;
      NEW.platform_fee_rate := OLD.platform_fee_rate;
      NEW.match_pass_paid := OLD.match_pass_paid;
      NEW.owner_id := OLD.owner_id;
      NEW.owner_role := OLD.owner_role;
      -- Economic terms are immutable once the campaign exists (read by funding + payout).
      NEW.payout_per_creator_fcfa := OLD.payout_per_creator_fcfa;
      NEW.total_budget_fcfa := OLD.total_budget_fcfa;
      NEW.creator_count_target := OLD.creator_count_target;
      -- Managed flag: never by a non-admin; frozen for everyone once the campaign is funded.
      IF NOT v_admin OR OLD.status NOT IN ('draft', 'pending_funding') THEN
        NEW.is_managed := OLD.is_managed;
      END IF;
      IF NOT v_admin THEN
        NEW.brand_label := OLD.brand_label;
        NEW.brand_city := OLD.brand_city;
        NEW.brand_consent := OLD.brand_consent;
        NEW.claims_verified := OLD.claims_verified;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 2. Board / stats v2 (managed brand line) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_campaign_board_v2(
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
  places_left             integer,
  is_managed              boolean,
  brand_city              text
 )
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH open_campaigns AS (
    SELECT c.id, c.title, c.category, c.target_country, c.payout_per_creator_fcfa,
           c.creator_count_target, c.platforms, c.content_type, c.deliverable_quantity,
           c.deadline, c.created_at, c.owner_id, c.is_managed, c.brand_label, c.brand_city
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
         CASE WHEN k.is_managed THEN k.brand_label ELSE p.display_name END AS brand_name,
         CASE WHEN k.is_managed THEN NULL ELSE p.handle END               AS brand_handle,
         k.applied      AS applied_count,
         greatest(k.creator_count_target - k.engaged, 0) AS places_left,
         k.is_managed,
         k.brand_city
    FROM counted k
    LEFT JOIN public.profiles p ON p.id = k.owner_id
   ORDER BY (k.creator_count_target - k.engaged > 0) DESC,   -- C1: full campaigns stay, ranked last
            k.payout_per_creator_fcfa DESC,
            greatest(k.creator_count_target - k.engaged, 0) DESC,
            k.created_at DESC,
            k.id
   LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$function$;

COMMENT ON FUNCTION public.public_campaign_board_v2(public.country_code, text, integer) IS
  'v1 + is_managed, brand_city; managed rows: brand_name = brand_label, brand_handle = NULL. Same filters, ranking and limit clamp as public_campaign_board.';

REVOKE ALL ON FUNCTION public.public_campaign_board_v2(public.country_code, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_campaign_board_v2(public.country_code, text, integer) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.public_campaign_stats_v2(p_campaign_id uuid)
 RETURNS TABLE (applied_count integer, places_left integer, brand_name text, brand_handle text,
                is_managed boolean, brand_city text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT count(cc.id) FILTER (WHERE cc.status IN ('applied','approved','content_submitted','verified','paid','disputed'))::integer,
         greatest(c.creator_count_target
                  - count(cc.id) FILTER (WHERE cc.status IN ('approved','content_submitted','verified','paid','disputed'))::integer, 0),
         CASE WHEN c.is_managed THEN c.brand_label ELSE p.display_name END,
         CASE WHEN c.is_managed THEN NULL ELSE p.handle END,
         c.is_managed,
         c.brand_city
    FROM public.campaigns c
    LEFT JOIN public.profiles p ON p.id = c.owner_id
    LEFT JOIN public.campaign_creators cc ON cc.campaign_id = c.id
   WHERE c.id = p_campaign_id
     AND c.is_public
     AND c.status IN ('published', 'in_progress')
   GROUP BY c.id, c.creator_count_target, c.is_managed, c.brand_label, c.brand_city, p.display_name, p.handle;
$function$;

COMMENT ON FUNCTION public.public_campaign_stats_v2(uuid) IS
  'v1 + is_managed, brand_city for ONE public, open campaign (managed: brand_name = brand_label, brand_handle NULL); empty result otherwise.';

REVOKE ALL ON FUNCTION public.public_campaign_stats_v2(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_campaign_stats_v2(uuid) TO anon, authenticated, service_role;

-- ── 3. Pay floors (K1 / M5) ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
                  WHERE n.nspname = 'public' AND t.typname = 'deliverable_type') THEN
    CREATE TYPE public.deliverable_type AS ENUM
      ('photo', 'short_video', 'long_video', 'animation', 'shoot_day', 'post', 'story', 'ugc_video', 'other');
  END IF;
END $$;

COMMENT ON TYPE public.deliverable_type IS
  'Unit a pay floor is expressed in (plan §8 O1: photo, short video, explainer/animation, shoot day, LinkedIn post …).';

CREATE TABLE IF NOT EXISTS public.pay_floors (
  deliverable_type public.deliverable_type PRIMARY KEY,
  min_net_fcfa     integer,
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by       uuid REFERENCES public.profiles(id),
  CONSTRAINT pay_floors_min_positive CHECK (min_net_fcfa IS NULL OR min_net_fcfa > 0)
);

COMMENT ON TABLE public.pay_floors IS
  'K1: minimum creator NET pay per deliverable unit (FCFA). min_net_fcfa NULL = not set (« Seuil non défini »). Ships empty; admin RPCs only.';

CREATE INDEX IF NOT EXISTS pay_floors_updated_by_idx ON public.pay_floors (updated_by);

ALTER TABLE public.pay_floors ENABLE ROW LEVEL SECURITY;
-- No policies: no direct table access for anon/authenticated (admin RPCs below are SECURITY DEFINER).
REVOKE ALL ON public.pay_floors FROM PUBLIC, anon, authenticated;

-- 'not_set' | 'pass' | 'below' for a brief's economics against the current floor.
-- below ⇔ net per place < floor × deliverable_count  (≡ floor(net per place ÷ count) < floor).
CREATE OR REPLACE FUNCTION private.managed_floor_check(
  p_total bigint, p_places integer, p_count integer, p_type public.deliverable_type
) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE
           WHEN f.min_net_fcfa IS NULL OR p_total IS NULL OR coalesce(p_places, 0) < 1 THEN 'not_set'
           WHEN (p_total * 3) / (4 * p_places) < f.min_net_fcfa::bigint * greatest(coalesce(p_count, 1), 1) THEN 'below'
           ELSE 'pass'
         END
    FROM (SELECT (SELECT pf.min_net_fcfa FROM public.pay_floors pf WHERE pf.deliverable_type = p_type) AS min_net_fcfa) f;
$$;
REVOKE ALL ON FUNCTION private.managed_floor_check(bigint, integer, integer, public.deliverable_type) FROM PUBLIC, anon, authenticated;

-- ── 4. managed_briefs (internal intake tracker) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.managed_briefs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_name            text NOT NULL,                 -- internal; may be the real legal/trade name
  brand_label           text,                          -- public descriptor or consented name
  brand_consent         boolean NOT NULL DEFAULT false,
  brand_consent_proof   text,                          -- E7: where the written consent is (screenshot path / note)
  contact_name          text,
  contact_whatsapp      text,
  country               public.country_code,
  city                  text,
  sector                text,
  category              text,                          -- campaign category (falls back to sector)
  service               text,
  title                 text,                          -- public listing title (falls back to service)
  deliverables          text,                          -- becomes campaigns.brief
  deliverable_type      public.deliverable_type,
  deliverable_count     integer NOT NULL DEFAULT 1,
  places                integer NOT NULL DEFAULT 1,
  total_budget_fcfa     bigint,                        -- brand total, Bayele fee (25 %) included (M4)
  platforms             text[] NOT NULL DEFAULT '{}',
  content_type          text,
  language              text,
  usage_rights          text,
  creator_requirements  text,
  equipment             text,
  claims_verified       boolean NOT NULL DEFAULT false, -- Legal: claims substantiated (Immobilier / Finance / Santé)
  deadline              date,
  order_confirmed_at    timestamptz,                   -- proof of the brand's « OUI » (M2)
  order_proof           text,
  deposit_status        text NOT NULL DEFAULT 'none',
  floor_check           text NOT NULL DEFAULT 'not_set',
  status                text NOT NULL DEFAULT 'draft',
  decline_reason        text,
  declined_at           timestamptz,
  campaign_id           uuid UNIQUE REFERENCES public.campaigns(id),
  notes                 text,
  created_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT managed_briefs_whatsapp_e164 CHECK (contact_whatsapp IS NULL OR contact_whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  CONSTRAINT managed_briefs_counts CHECK (deliverable_count BETWEEN 1 AND 1000 AND places BETWEEN 1 AND 1000),
  CONSTRAINT managed_briefs_budget_positive CHECK (total_budget_fcfa IS NULL OR total_budget_fcfa > 0),
  CONSTRAINT managed_briefs_deposit_status CHECK (deposit_status IN ('none', 'partial', 'full')),
  CONSTRAINT managed_briefs_floor_check CHECK (floor_check IN ('not_set', 'pass', 'below')),
  CONSTRAINT managed_briefs_status CHECK (status IN ('draft', 'awaiting_order', 'awaiting_payment', 'published', 'declined')),
  CONSTRAINT managed_briefs_text_lengths CHECK (
        char_length(brand_name) BETWEEN 1 AND 160
    AND coalesce(char_length(brand_label), 0)          <= 80
    AND coalesce(char_length(contact_name), 0)         <= 120
    AND coalesce(char_length(city), 0)                 <= 80
    AND coalesce(char_length(sector), 0)               <= 80
    AND coalesce(char_length(category), 0)             <= 80
    AND coalesce(char_length(service), 0)              <= 160
    AND coalesce(char_length(title), 0)                <= 160
    AND coalesce(char_length(deliverables), 0)         <= 4000
    AND coalesce(char_length(content_type), 0)         <= 80
    AND coalesce(char_length(language), 0)             <= 60
    AND coalesce(char_length(usage_rights), 0)         <= 500
    AND coalesce(char_length(creator_requirements), 0) <= 1000
    AND coalesce(char_length(equipment), 0)            <= 500
    AND coalesce(char_length(order_proof), 0)          <= 2000
    AND coalesce(char_length(brand_consent_proof), 0)  <= 2000
    AND coalesce(char_length(decline_reason), 0)       <= 500
    AND coalesce(char_length(notes), 0)                <= 4000
    AND coalesce(cardinality(platforms), 0)            <= 10
  )
);

COMMENT ON TABLE public.managed_briefs IS
  'Internal intake tracker for managed campaigns (plan §2/§5). Admin-only. Writes via admin_upsert_managed_brief / admin_publish_managed_brief.';

CREATE INDEX IF NOT EXISTS managed_briefs_created_by_idx ON public.managed_briefs (created_by);

ALTER TABLE public.managed_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.managed_briefs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.managed_briefs TO authenticated;   -- rows filtered to admins by the policy below

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
                  WHERE schemaname = 'public' AND tablename = 'managed_briefs'
                    AND policyname = 'admins read managed briefs') THEN
    CREATE POLICY "admins read managed briefs" ON public.managed_briefs
      FOR SELECT TO authenticated USING (private.is_admin((select auth.uid())));
  END IF;
END $$;

-- ── 4a. Pay-floor RPCs ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_pay_floor(
  p_deliverable_type public.deliverable_type, p_min_net_fcfa integer
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_deliverable_type IS NULL THEN RAISE EXCEPTION 'missing_fields' USING DETAIL = 'deliverable_type'; END IF;
  IF p_min_net_fcfa IS NULL OR p_min_net_fcfa <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  INSERT INTO public.pay_floors (deliverable_type, min_net_fcfa, updated_at, updated_by)
  VALUES (p_deliverable_type, p_min_net_fcfa, now(), auth.uid())
  ON CONFLICT (deliverable_type) DO UPDATE
    SET min_net_fcfa = EXCLUDED.min_net_fcfa, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  -- Refresh the stored floor check of briefs not yet turned into a campaign.
  UPDATE public.managed_briefs b
     SET floor_check = private.managed_floor_check(b.total_budget_fcfa, b.places, b.deliverable_count, b.deliverable_type)
   WHERE b.deliverable_type = p_deliverable_type AND NOT private.managed_campaign_live(b.campaign_id);
END;
$$;

-- "Clear" = set to NULL (not set) — an upsert, never a row removal (K8).
CREATE OR REPLACE FUNCTION public.admin_clear_pay_floor(p_deliverable_type public.deliverable_type)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF p_deliverable_type IS NULL THEN RAISE EXCEPTION 'missing_fields' USING DETAIL = 'deliverable_type'; END IF;
  INSERT INTO public.pay_floors (deliverable_type, min_net_fcfa, updated_at, updated_by)
  VALUES (p_deliverable_type, NULL, now(), auth.uid())
  ON CONFLICT (deliverable_type) DO UPDATE
    SET min_net_fcfa = NULL, updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by;
  UPDATE public.managed_briefs b
     SET floor_check = 'not_set'
   WHERE b.deliverable_type = p_deliverable_type AND NOT private.managed_campaign_live(b.campaign_id);
END;
$$;

-- Every deliverable type, with its floor or NULL (« Seuil non défini »).
CREATE OR REPLACE FUNCTION public.pay_floor_list()
RETURNS TABLE (deliverable_type public.deliverable_type, min_net_fcfa integer, updated_at timestamptz, updated_by uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY
    SELECT t.v, pf.min_net_fcfa, pf.updated_at, pf.updated_by
      FROM unnest(enum_range(NULL::public.deliverable_type)) WITH ORDINALITY AS t(v, ord)
      LEFT JOIN public.pay_floors pf ON pf.deliverable_type = t.v
     ORDER BY t.ord;
END;
$$;

-- R5: floors readable by any signed-in user (brand self-serve warning). Only floors that are set;
-- no updated_by / timestamps. Not anon. pay_floor_list() stays admin-only.
CREATE OR REPLACE FUNCTION public.pay_floors_public()
RETURNS TABLE (deliverable_type public.deliverable_type, min_net_fcfa integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT pf.deliverable_type, pf.min_net_fcfa
    FROM public.pay_floors pf
   WHERE pf.min_net_fcfa IS NOT NULL
   ORDER BY pf.deliverable_type;
$$;
REVOKE ALL ON FUNCTION public.pay_floors_public() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pay_floors_public() TO authenticated, service_role;

-- ── 4b. Brief helpers ────────────────────────────────────────────────────────
-- A brief is "live" while its linked campaign exists and is not cancelled (E5/E8).
CREATE OR REPLACE FUNCTION private.managed_campaign_live(p_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p_campaign_id IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = p_campaign_id AND c.status <> 'cancelled');
$$;
REVOKE ALL ON FUNCTION private.managed_campaign_live(uuid) FROM PUBLIC, anon, authenticated;

-- Legal: categories whose claims must be verified before publishing (QA D1: robust to free text).
-- Normalise: NFKC (folds NFD accents back, NBSP / narrow NBSP → space), lowercase, explicit NBSP /
-- U+202F → space, fold é è ê à â î ô û ç (+ ë ï ù) with translate(), collapse whitespace, strip spaces
-- around '/'. Then: contains immobilier | fintech | finance | sante.
CREATE OR REPLACE FUNCTION private.normalize_category(p_category text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT btrim(regexp_replace(regexp_replace(
           translate(lower(replace(replace(normalize(coalesce(p_category, ''), NFKC), U&'\00A0', ' '), U&'\202F', ' ')),
                     'éèêëàâäîïôöûüùç', 'eeeeaaaiiioouuuc'),
           '\s+', ' ', 'g'), '\s*/\s*', '/', 'g'));
$$;
REVOKE ALL ON FUNCTION private.normalize_category(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.category_needs_claims_check(p_category text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT private.normalize_category(p_category) ~ '(immobilier|fintech|finance|sante)';
$$;
REVOKE ALL ON FUNCTION private.category_needs_claims_check(text) FROM PUBLIC, anon, authenticated;

-- E3: the money split of a managed brief, consistent with admin_confirm_campaign_funding:
--   fee  = floor(total × 0.25)            (escrow fee)
--   pool = total − fee                     (escrow net, what creators can be paid from)
--   net per place = floor(total × 0.75 ÷ places)   (K7, = payout_per_creator_fcfa)
--   rounding remainder = pool − net × places        (≥ 0; stays in the escrow pool)
CREATE OR REPLACE FUNCTION public.managed_net_preview(
  p_total_budget_fcfa bigint, p_places integer, p_deliverable_count integer DEFAULT 1
) RETURNS TABLE (fee_fcfa bigint, creators_pool_fcfa bigint, net_per_place_fcfa bigint,
                 net_per_unit_fcfa bigint, rounding_remainder_fcfa bigint)
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT f.fee, p_total_budget_fcfa - f.fee, f.net,
         f.net / greatest(coalesce(p_deliverable_count, 1), 1),
         (p_total_budget_fcfa - f.fee) - f.net * p_places
    FROM (SELECT floor(p_total_budget_fcfa * 0.25)::bigint AS fee,
                 (p_total_budget_fcfa * 3) / (4 * nullif(greatest(p_places, 0), 0)) AS net) f
   WHERE p_total_budget_fcfa > 0 AND p_places >= 1;
$$;
COMMENT ON FUNCTION public.managed_net_preview(bigint, integer, integer) IS
  'E3: fee, escrow pool, net per place (K7), net per unit, rounding remainder (stays in the pool). Zero rows for invalid input.';

-- E4: decline + cancel the linked unfunded campaign (shared by the RPC and by upsert status = declined).
CREATE OR REPLACE FUNCTION private.decline_managed_brief(p_brief_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_campaign uuid;
  v_status   public.campaign_status;
BEGIN
  SELECT b.campaign_id INTO v_campaign FROM public.managed_briefs b WHERE b.id = p_brief_id FOR UPDATE;
  IF v_campaign IS NOT NULL THEN
    SELECT c.status INTO v_status FROM public.campaigns c WHERE c.id = v_campaign FOR UPDATE;
    IF v_status IN ('draft', 'pending_funding') THEN
      PERFORM public.cancel_campaign(v_campaign);       -- existing audited cancel (admin caller)
    ELSIF v_status IS NOT NULL AND v_status <> 'cancelled' THEN
      RAISE EXCEPTION 'campaign_already_funded';        -- funded: use admin_refund_campaign first
    END IF;
  END IF;
  UPDATE public.managed_briefs
     SET status = 'declined', decline_reason = nullif(btrim(p_reason), ''), declined_at = now(), updated_at = now()
   WHERE id = p_brief_id;
END;
$$;
REVOKE ALL ON FUNCTION private.decline_managed_brief(uuid, text) FROM PUBLIC, anon, authenticated;

-- ── 4c. Brief RPCs ───────────────────────────────────────────────────────────
-- Create (no "id" key) or partially update (with "id": only the keys present are changed; a key
-- with JSON null clears that field). System-managed and ignored from input: campaign_id,
-- floor_check (recomputed), created_by, created_at, updated_at, decline_reason, declined_at.
-- E6: status may be set manually only to draft | awaiting_order | declined (unchanged values pass).
-- E5: while the brief has a live campaign, only notes, status (→ declined), order_proof,
--     brand_consent_proof, contact_name, contact_whatsapp, deposit_status may change; any other
--     changed field raises brief_locked (DETAIL = the fields).
CREATE OR REPLACE FUNCTION public.admin_upsert_managed_brief(p_brief jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id      uuid;
  v_old     public.managed_briefs;
  v_rec     public.managed_briefs;
  v_in      jsonb := coalesce(p_brief, '{}'::jsonb);
  v_live    boolean := false;
  v_changed text[];
  v_decline boolean := false;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF jsonb_typeof(v_in) <> 'object' THEN RAISE EXCEPTION 'missing_fields' USING DETAIL = 'brief'; END IF;

  v_id := nullif(v_in->>'id', '')::uuid;
  v_in := v_in - ARRAY['id','campaign_id','floor_check','created_by','created_at','updated_at','decline_reason','declined_at'];

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_old FROM public.managed_briefs WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'brief_not_found'; END IF;
    v_live := private.managed_campaign_live(v_old.campaign_id);
    v_rec := jsonb_populate_record(v_old, v_in);
  ELSE
    v_rec.brand_consent := false;
    v_rec.claims_verified := false;
    v_rec.deliverable_count := 1;
    v_rec.places := 1;
    v_rec.platforms := '{}';
    v_rec.deposit_status := 'none';
    v_rec.status := 'draft';
    v_rec := jsonb_populate_record(v_rec, v_in);
  END IF;

  -- Normalise text: trim, empty → NULL.
  v_rec.brand_name           := nullif(btrim(v_rec.brand_name), '');
  v_rec.brand_label          := nullif(btrim(v_rec.brand_label), '');
  v_rec.brand_consent_proof  := nullif(btrim(v_rec.brand_consent_proof), '');
  v_rec.contact_name         := nullif(btrim(v_rec.contact_name), '');
  v_rec.contact_whatsapp     := nullif(btrim(v_rec.contact_whatsapp), '');
  v_rec.city                 := nullif(btrim(v_rec.city), '');
  v_rec.sector               := nullif(btrim(v_rec.sector), '');
  v_rec.category             := nullif(btrim(v_rec.category), '');
  v_rec.service              := nullif(btrim(v_rec.service), '');
  v_rec.title                := nullif(btrim(v_rec.title), '');
  v_rec.deliverables         := nullif(btrim(v_rec.deliverables), '');
  v_rec.content_type         := nullif(btrim(v_rec.content_type), '');
  v_rec.language             := nullif(btrim(v_rec.language), '');
  v_rec.usage_rights         := nullif(btrim(v_rec.usage_rights), '');
  v_rec.creator_requirements := nullif(btrim(v_rec.creator_requirements), '');
  v_rec.equipment            := nullif(btrim(v_rec.equipment), '');
  v_rec.order_proof          := nullif(btrim(v_rec.order_proof), '');
  v_rec.notes                := nullif(btrim(v_rec.notes), '');
  v_rec.brand_consent        := coalesce(v_rec.brand_consent, false);
  v_rec.claims_verified      := coalesce(v_rec.claims_verified, false);
  v_rec.deliverable_count    := coalesce(v_rec.deliverable_count, 1);
  v_rec.places               := coalesce(v_rec.places, 1);
  v_rec.platforms            := coalesce(v_rec.platforms, '{}');
  v_rec.deposit_status       := coalesce(v_rec.deposit_status, 'none');
  v_rec.status               := coalesce(v_rec.status, v_old.status, 'draft');

  IF v_rec.brand_name IS NULL THEN RAISE EXCEPTION 'missing_fields' USING DETAIL = 'brand_name'; END IF;

  -- E6: manual status changes.
  IF v_rec.status IS DISTINCT FROM v_old.status THEN
    IF v_rec.status NOT IN ('draft', 'awaiting_order', 'declined') THEN
      RAISE EXCEPTION 'invalid_status' USING DETAIL = 'manual status: draft, awaiting_order, declined';
    END IF;
    IF v_live THEN
      IF v_rec.status <> 'declined' THEN
        RAISE EXCEPTION 'invalid_status' USING DETAIL = 'brief has a live campaign: only declined';
      END IF;
      v_decline := true;
      v_rec.status := v_old.status;       -- applied by private.decline_managed_brief below
    END IF;
  END IF;

  -- E5: lock listing fields while a live campaign exists.
  IF v_live THEN
    SELECT array_agg(o.key ORDER BY o.key) INTO v_changed
      FROM jsonb_each(to_jsonb(v_old)) o
      JOIN jsonb_each(to_jsonb(v_rec)) n ON n.key = o.key
     WHERE o.value IS DISTINCT FROM n.value
       AND o.key NOT IN ('notes', 'status', 'order_proof', 'brand_consent_proof', 'contact_name',
                         'contact_whatsapp', 'deposit_status', 'updated_at');
    IF v_changed IS NOT NULL THEN
      RAISE EXCEPTION 'brief_locked' USING DETAIL = array_to_string(v_changed, ',');
    END IF;
  END IF;

  v_rec.floor_check := CASE WHEN v_live THEN v_old.floor_check
                            ELSE private.managed_floor_check(v_rec.total_budget_fcfa, v_rec.places,
                                                             v_rec.deliverable_count, v_rec.deliverable_type) END;

  IF v_id IS NULL THEN
    INSERT INTO public.managed_briefs (
      brand_name, brand_label, brand_consent, brand_consent_proof, contact_name, contact_whatsapp, country,
      city, sector, category, service, title, deliverables, deliverable_type, deliverable_count, places,
      total_budget_fcfa, platforms, content_type, language, usage_rights, creator_requirements,
      equipment, claims_verified, deadline, order_confirmed_at, order_proof, deposit_status, floor_check,
      status, notes, created_by)
    VALUES (
      v_rec.brand_name, v_rec.brand_label, v_rec.brand_consent, v_rec.brand_consent_proof, v_rec.contact_name,
      v_rec.contact_whatsapp, v_rec.country, v_rec.city, v_rec.sector, v_rec.category, v_rec.service, v_rec.title,
      v_rec.deliverables, v_rec.deliverable_type, v_rec.deliverable_count, v_rec.places, v_rec.total_budget_fcfa,
      v_rec.platforms, v_rec.content_type, v_rec.language, v_rec.usage_rights, v_rec.creator_requirements,
      v_rec.equipment, v_rec.claims_verified, v_rec.deadline, v_rec.order_confirmed_at, v_rec.order_proof,
      v_rec.deposit_status, v_rec.floor_check, v_rec.status, v_rec.notes, auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.managed_briefs SET
      brand_name = v_rec.brand_name, brand_label = v_rec.brand_label, brand_consent = v_rec.brand_consent,
      brand_consent_proof = v_rec.brand_consent_proof,
      contact_name = v_rec.contact_name, contact_whatsapp = v_rec.contact_whatsapp, country = v_rec.country,
      city = v_rec.city, sector = v_rec.sector, category = v_rec.category, service = v_rec.service,
      title = v_rec.title, deliverables = v_rec.deliverables, deliverable_type = v_rec.deliverable_type,
      deliverable_count = v_rec.deliverable_count, places = v_rec.places,
      total_budget_fcfa = v_rec.total_budget_fcfa, platforms = v_rec.platforms,
      content_type = v_rec.content_type, language = v_rec.language, usage_rights = v_rec.usage_rights,
      creator_requirements = v_rec.creator_requirements, equipment = v_rec.equipment,
      claims_verified = v_rec.claims_verified,
      deadline = v_rec.deadline, order_confirmed_at = v_rec.order_confirmed_at,
      order_proof = v_rec.order_proof, deposit_status = v_rec.deposit_status,
      floor_check = v_rec.floor_check, status = v_rec.status, notes = v_rec.notes,
      decline_reason = CASE WHEN v_rec.status = 'declined' THEN decline_reason END,
      declined_at    = CASE WHEN v_rec.status = 'declined' THEN coalesce(declined_at, now()) END,
      updated_at = now()
    WHERE id = v_id;
  END IF;

  IF v_decline THEN PERFORM private.decline_managed_brief(v_id, NULL); END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_managed_briefs()
RETURNS SETOF public.managed_briefs
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  RETURN QUERY SELECT * FROM public.managed_briefs ORDER BY created_at DESC, id;
END;
$$;

-- E4
CREATE OR REPLACE FUNCTION public.admin_decline_managed_brief(p_brief_id uuid, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.managed_briefs WHERE id = p_brief_id) THEN RAISE EXCEPTION 'brief_not_found'; END IF;
  IF char_length(p_reason) > 500 THEN RAISE EXCEPTION 'invalid_reason'; END IF;
  PERFORM private.decline_managed_brief(p_brief_id, p_reason);
END;
$$;

-- Creates the managed campaign from a confirmed brief. The campaign starts in 'pending_funding'
-- (listed on /admin/funding, invisible on the board); admin_confirm_campaign_funding later moves it
-- to 'published' (escrow held, alerts fire, brief → 'published' via trg_sync_managed_brief_status).
-- E8: a brief whose previous campaign was cancelled may be published again (new campaign).
CREATE OR REPLACE FUNCTION public.admin_publish_managed_brief(p_brief_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b          public.managed_briefs;
  v_missing  text[] := '{}';
  v_net      bigint;
  v_floor    integer;
  v_campaign uuid;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT * INTO b FROM public.managed_briefs WHERE id = p_brief_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'brief_not_found'; END IF;
  IF private.managed_campaign_live(b.campaign_id) OR b.status = 'published' THEN RAISE EXCEPTION 'already_published'; END IF;
  IF b.status = 'declined' THEN RAISE EXCEPTION 'brief_declined'; END IF;
  IF b.order_confirmed_at IS NULL THEN RAISE EXCEPTION 'order_not_confirmed'; END IF;

  -- Listing standard (plan §4).
  IF b.brand_label IS NULL                   THEN v_missing := v_missing || 'brand_label'::text; END IF;
  IF b.brand_consent AND b.brand_consent_proof IS NULL THEN v_missing := v_missing || 'brand_consent_proof'::text; END IF;
  IF coalesce(b.title, b.service) IS NULL    THEN v_missing := v_missing || 'title'::text; END IF;
  IF b.deliverables IS NULL                  THEN v_missing := v_missing || 'deliverables'::text; END IF;
  IF b.deliverable_type IS NULL              THEN v_missing := v_missing || 'deliverable_type'::text; END IF;
  IF coalesce(b.category, b.sector) IS NULL  THEN v_missing := v_missing || 'category'::text; END IF;
  IF b.country IS NULL                       THEN v_missing := v_missing || 'country'::text; END IF;
  IF b.city IS NULL                          THEN v_missing := v_missing || 'city'::text; END IF;
  IF b.language IS NULL                      THEN v_missing := v_missing || 'language'::text; END IF;
  IF b.usage_rights IS NULL                  THEN v_missing := v_missing || 'usage_rights'::text; END IF;
  IF b.deadline IS NULL                      THEN v_missing := v_missing || 'deadline'::text; END IF;
  IF b.total_budget_fcfa IS NULL             THEN v_missing := v_missing || 'total_budget_fcfa'::text; END IF;
  IF cardinality(b.platforms) = 0            THEN v_missing := v_missing || 'platforms'::text; END IF;
  IF b.content_type IS NULL                  THEN v_missing := v_missing || 'content_type'::text; END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'missing_fields' USING DETAIL = array_to_string(v_missing, ',');
  END IF;
  IF b.deadline < current_date THEN RAISE EXCEPTION 'deadline_passed'; END IF;

  -- Legal: real-estate / finance / health claims must be substantiated (M7).
  IF private.category_needs_claims_check(coalesce(b.category, b.sector)) AND NOT b.claims_verified THEN
    RAISE EXCEPTION 'claims_not_verified';
  END IF;

  -- K7: net per place = floor(total × 0.75 ÷ places) (integer arithmetic, exact floor).
  v_net := (b.total_budget_fcfa * 3) / (4 * b.places);
  IF v_net < 1 THEN RAISE EXCEPTION 'invalid_budget'; END IF;

  -- K1/M5/E10: never publish under a defined floor, checked on the brief's main deliverable_type.
  -- Net per unit = net per place ÷ deliverable_count.
  SELECT pf.min_net_fcfa INTO v_floor FROM public.pay_floors pf WHERE pf.deliverable_type = b.deliverable_type;
  IF v_floor IS NOT NULL AND v_net < v_floor::bigint * b.deliverable_count THEN
    RAISE EXCEPTION 'below_pay_floor'
      USING DETAIL = format('net_per_unit=%s floor=%s', v_net / b.deliverable_count, v_floor);
  END IF;

  INSERT INTO public.campaigns (
    owner_id, owner_role, title, brief, target_country, category, total_budget_fcfa,
    payout_per_creator_fcfa, creator_count_target, platform_fee_rate, status, is_public,
    platforms, content_type, deliverable_quantity, deadline,
    is_managed, brand_label, brand_consent, brand_city, language, usage_rights,
    creator_requirements, equipment, claims_verified)
  VALUES (
    auth.uid(), 'super_admin', coalesce(b.title, b.service), b.deliverables, b.country,
    coalesce(b.category, b.sector), b.total_budget_fcfa,
    v_net, b.places, 0.25, 'pending_funding', true,
    b.platforms, b.content_type, b.deliverable_count, b.deadline,
    true, b.brand_label, b.brand_consent, b.city, b.language, b.usage_rights,
    b.creator_requirements, b.equipment, b.claims_verified)
  RETURNING id INTO v_campaign;

  UPDATE public.managed_briefs
     SET campaign_id = v_campaign,
         status      = 'awaiting_payment',
         floor_check = CASE WHEN v_floor IS NULL THEN 'not_set' ELSE 'pass' END,
         updated_at  = now()
   WHERE id = b.id;

  RETURN v_campaign;
END;
$$;

-- Brief follows its campaign: published/in_progress ⇒ 'published'; cancelled ⇒ back to 'draft'
-- (E8, re-publishable) unless the brief was declined.
CREATE OR REPLACE FUNCTION private.sync_managed_brief_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.status IN ('published', 'in_progress') THEN
    UPDATE public.managed_briefs
       SET status = 'published', updated_at = now()
     WHERE campaign_id = NEW.id AND status <> 'published';
  ELSIF NEW.status = 'cancelled' THEN
    UPDATE public.managed_briefs
       SET status = 'draft', updated_at = now()
     WHERE campaign_id = NEW.id AND status <> 'declined';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION private.sync_managed_brief_status() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER trg_sync_managed_brief_status
  AFTER UPDATE OF status ON public.campaigns
  FOR EACH ROW
  WHEN (NEW.is_managed AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION private.sync_managed_brief_status();

-- ── E2: funding notification of an admin-owned managed campaign → /admin/briefs ──
-- Body identical to 0018 [M8] except the notification link. Same signature (CREATE OR REPLACE).
CREATE OR REPLACE FUNCTION public.admin_confirm_campaign_funding(
  p_campaign_id uuid, p_sokoclick_invoice_id text,
  p_provider public.payment_provider DEFAULT 'mtn_momo', p_sokoclick_receipt_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_owner uuid; v_fee_rate numeric; v_budget bigint; v_status public.campaign_status; v_title text; v_fee bigint; v_net bigint; v_txn uuid;
        v_managed boolean; v_owner_role public.user_role;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, platform_fee_rate, total_budget_fcfa, status, title, is_managed, owner_role
    INTO v_owner, v_fee_rate, v_budget, v_status, v_title, v_managed, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN
    SELECT id INTO v_txn FROM public.escrow_transactions WHERE provider_ref = p_sokoclick_invoice_id LIMIT 1;
    RETURN v_txn;
  END IF;
  IF v_status NOT IN ('draft','pending_funding') THEN RAISE EXCEPTION 'campaign_not_fundable'; END IF;
  v_fee := floor(v_budget * v_fee_rate); v_net := v_budget - v_fee;
  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, v_owner, 'campaign_escrow', v_budget, 'paid');
  INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES (p_campaign_id, 'inbound', v_budget, v_fee, v_net, p_provider, p_sokoclick_invoice_id, 'pending')
  RETURNING id INTO v_txn;
  PERFORM public.transition_escrow(v_txn, 'held', auth.uid(), jsonb_build_object('source','admin_confirm_campaign_funding','campaign_id',p_campaign_id));
  UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now() WHERE id = p_campaign_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_funded', 'Campagne financée ✅',
          'Le séquestre de « ' || v_title || ' » est actif — les créateurs peuvent désormais postuler.',
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_txn;
END; $$;
REVOKE ALL ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_campaign_funding(uuid, text, public.payment_provider, text) TO authenticated;

-- E2 (approved): the refund notification of an admin-owned managed campaign → /admin/briefs.
-- Body identical to 0018 [M5] except the selected columns and the notification link. Same signature.
CREATE OR REPLACE FUNCTION public.admin_refund_campaign(
  p_campaign_id uuid, p_sokoclick_receipt_id text DEFAULT NULL, p_reason text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_owner uuid; v_cstatus public.campaign_status; v_title text;
  v_managed boolean; v_owner_role public.user_role;
  v_in uuid; v_in_status public.escrow_status; v_paid int; v_out RECORD;
  v_meta jsonb := jsonb_build_object('source','admin_refund_campaign','receipt',p_sokoclick_receipt_id,'reason',p_reason);
BEGIN
  IF NOT private.is_admin(v_admin) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  SELECT owner_id, status, title, is_managed, owner_role INTO v_owner, v_cstatus, v_title, v_managed, v_owner_role
    FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  SELECT id, status INTO v_in, v_in_status
    FROM public.escrow_transactions WHERE campaign_id = p_campaign_id AND direction = 'inbound' FOR UPDATE;
  IF v_in IS NULL THEN RAISE EXCEPTION 'campaign_not_funded'; END IF;
  IF v_in_status = 'refunded' AND v_cstatus = 'cancelled' THEN RETURN v_in; END IF;

  -- Lock ALL outbound rows before counting paid-out, closing the TOCTOU vs admin_confirm_creator_payout.
  PERFORM 1 FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound' FOR UPDATE;
  SELECT count(*) INTO v_paid FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound' AND status = 'paid_out';
  IF v_paid > 0 THEN RAISE EXCEPTION 'partial_payouts_present'; END IF;

  FOR v_out IN
    SELECT id, status FROM public.escrow_transactions
    WHERE campaign_id = p_campaign_id AND direction = 'outbound'
      AND status IN ('pending','held','proof_pending','releasable','disputed') FOR UPDATE
  LOOP
    IF v_out.status = 'releasable' THEN
      PERFORM public.transition_escrow(v_out.id, 'disputed', v_admin, v_meta);
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSIF v_out.status = 'disputed' THEN
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    ELSE
      PERFORM public.transition_escrow(v_out.id, 'refunding', v_admin, v_meta);
    END IF;
    PERFORM public.transition_escrow(v_out.id, 'refunded', v_admin, v_meta);
  END LOOP;

  UPDATE public.campaign_creators SET status = 'rejected', updated_at = now()
    WHERE campaign_id = p_campaign_id
      AND status IN ('invited','applied','approved','content_submitted','verified','disputed');

  IF v_in_status = 'refunded' THEN
    NULL;
  ELSIF v_in_status IN ('pending','held','disputed') THEN
    PERFORM public.transition_escrow(v_in, 'refunding', v_admin, v_meta);
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSIF v_in_status = 'refunding' THEN
    PERFORM public.transition_escrow(v_in, 'refunded',  v_admin, v_meta);
  ELSE
    RAISE EXCEPTION 'inbound_not_refundable';
  END IF;

  UPDATE public.escrow_transactions SET provider_ref = COALESCE(p_sokoclick_receipt_id, provider_ref), updated_at = now() WHERE id = v_in;
  UPDATE public.campaigns SET status = 'cancelled', updated_at = now() WHERE id = p_campaign_id;
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_owner, 'campaign_refunded', 'Remboursement effectué',
          'Votre campagne « ' || v_title || ' » a été annulée et le séquestre remboursé' || COALESCE(' : ' || p_reason, '') || '.',
          CASE WHEN v_managed AND v_owner_role = 'super_admin' THEN '/admin/briefs' ELSE '/business/campaigns' END);
  RETURN v_in;
END; $$;
REVOKE ALL ON FUNCTION public.admin_refund_campaign(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_refund_campaign(uuid, text, text) TO authenticated;

-- ── Grants for the admin RPCs (Supabase default privileges grant EXECUTE to anon) ──
REVOKE ALL ON FUNCTION public.admin_set_pay_floor(public.deliverable_type, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_pay_floor(public.deliverable_type) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pay_floor_list() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_managed_brief(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_managed_briefs() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_publish_managed_brief(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_decline_managed_brief(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.managed_net_preview(bigint, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_pay_floor(public.deliverable_type, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_clear_pay_floor(public.deliverable_type) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pay_floor_list() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_upsert_managed_brief(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_managed_briefs() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_publish_managed_brief(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_decline_managed_brief(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.managed_net_preview(bigint, integer, integer) TO authenticated, service_role;
