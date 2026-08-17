-- ============================================================================
-- Rollback of:        20260817120400_0005_is_admin_private_schema.sql
-- Author:             Lead Security, Cryptography & Compliance Engineer
-- Inverse type:       TRUE INVERSE — recreate public.is_admin, repoint every policy back to it,
--                     drop private.is_admin (and the private schema if now empty). Returns the
--                     schema to the 0004 end-state (which re-introduces the 2 advisor WARNs).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = p_user_id AND ur.role = 'super_admin');
$$;

DROP POLICY IF EXISTS "admins manage all profiles" ON public.profiles;
CREATE POLICY "admins manage all profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "creators manage own creator profile" ON public.creator_profiles;
CREATE POLICY "creators manage own creator profile" ON public.creator_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "consultants manage own consultant profile" ON public.consultant_profiles;
CREATE POLICY "consultants manage own consultant profile" ON public.consultant_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "businesses manage their own profile" ON public.business_profiles;
CREATE POLICY "businesses manage their own profile" ON public.business_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "campaign owners manage their campaigns" ON public.campaigns;
CREATE POLICY "campaign owners manage their campaigns" ON public.campaigns FOR ALL USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "campaign_creators visible to creator, owner, admin" ON public.campaign_creators;
CREATE POLICY "campaign_creators visible to creator, owner, admin" ON public.campaign_creators FOR SELECT
  USING (creator_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "businesses view their invoices" ON public.invoices;
CREATE POLICY "businesses view their invoices" ON public.invoices FOR SELECT USING (business_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "escrow visible to involved parties" ON public.escrow_transactions;
CREATE POLICY "escrow visible to involved parties" ON public.escrow_transactions FOR SELECT
  USING (recipient_profile_id = auth.uid() OR public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid()));
DROP POLICY IF EXISTS "proof visible to creator, owner, admin" ON public.proof_of_post;
CREATE POLICY "proof visible to creator, owner, admin" ON public.proof_of_post FOR SELECT
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.campaign_creators cc JOIN public.campaigns c ON c.id = cc.campaign_id WHERE cc.id = proof_of_post.campaign_creator_id AND (cc.creator_id = auth.uid() OR c.owner_id = auth.uid())));
DROP POLICY IF EXISTS "audit visible to involved parties and admin" ON public.escrow_audit_log;
CREATE POLICY "audit visible to involved parties and admin" ON public.escrow_audit_log FOR SELECT
  USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.escrow_transactions et LEFT JOIN public.campaigns c ON c.id = et.campaign_id WHERE et.id = escrow_audit_log.transaction_id AND (et.recipient_profile_id = auth.uid() OR c.owner_id = auth.uid())));
DROP POLICY IF EXISTS "retainer visible to parties and admin" ON public.agency_retainers;
CREATE POLICY "retainer visible to parties and admin" ON public.agency_retainers FOR SELECT
  USING (business_id = auth.uid() OR consultant_id = auth.uid() OR public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "admins manage retainers" ON public.agency_retainers;
CREATE POLICY "admins manage retainers" ON public.agency_retainers FOR ALL USING (public.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS private.is_admin(uuid);
DROP SCHEMA IF EXISTS private;  -- only succeeds if empty

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260817120400';
