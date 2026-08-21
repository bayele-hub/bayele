-- 0022 — Structured campaign brief fields + public/private visibility.
-- Campaigns are PRIVATE by default (visible only to signed-in creators in-app). A brand opts a
-- campaign public to get the shareable page + JobPosting SEO. Structured fields make expectations
-- explicit, which is what proof-of-post is judged against (fewer escrow disputes).

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS platforms text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_type text,
  ADD COLUMN IF NOT EXISTS deliverable_quantity integer,
  ADD COLUMN IF NOT EXISTS mandatory_tags text,
  ADD COLUMN IF NOT EXISTS deadline date;

-- Is this user a creator? SECURITY DEFINER so the RLS policy below never recurses into user_roles RLS.
CREATE OR REPLACE FUNCTION private.is_creator(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'creator');
$function$;

-- Replace the browse policy: a published campaign is readable if it's public, OR the viewer is a
-- signed-in creator (the audience for private campaigns). Owners/admins keep full access via the
-- existing "campaign owners manage their campaigns" policy, so drafts stay owner-only.
DROP POLICY IF EXISTS "active campaigns are viewable by creators" ON public.campaigns;
CREATE POLICY "browse open campaigns" ON public.campaigns FOR SELECT USING (
  status IN ('published','in_progress','completed')
  AND (is_public OR private.is_creator((SELECT auth.uid())))
);

-- Owner-only visibility toggle. A dedicated RPC keeps the client from writing arbitrary campaign
-- columns while still letting a brand flip public/private on their own campaign.
CREATE OR REPLACE FUNCTION public.set_campaign_visibility(p_campaign_id uuid, p_is_public boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT owner_id INTO v_owner FROM public.campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF v_owner IS NULL THEN RAISE EXCEPTION 'campaign_not_found'; END IF;
  IF NOT (v_owner = auth.uid() OR private.is_admin(auth.uid())) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  UPDATE public.campaigns SET is_public = p_is_public, updated_at = now() WHERE id = p_campaign_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.set_campaign_visibility(uuid, boolean) TO authenticated;
