-- RLS — canonical, from production spec v1.1.2 §3.2. RLS is the real RBAC boundary.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultant_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_creators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_retainers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admin check. Param renamed so it can never shadow the column (spec §0 #1).
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_user_id AND ur.role = 'super_admin'
  );
$$;

-- Public marketplace: Creators & Consultants only, active only.
CREATE POLICY "public profiles are readable"
  ON public.profiles FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = profiles.id AND ur.role IN ('creator', 'consultant')
    )
  );
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admins manage all profiles" ON public.profiles FOR ALL USING (public.is_admin(auth.uid()));

-- Role-profile public reads (spec §0.1 #B) — without these the directory is dead.
CREATE POLICY "public read active creator profiles"
  ON public.creator_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'creator'
    WHERE p.id = creator_profiles.user_id AND p.status = 'active'
  ));
CREATE POLICY "creators manage own creator profile"
  ON public.creator_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "public read active consultant profiles"
  ON public.consultant_profiles FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
    WHERE p.id = consultant_profiles.user_id AND p.status = 'active'
  ));
CREATE POLICY "consultants manage own consultant profile"
  ON public.consultant_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "users read own roles"
  ON public.user_roles FOR SELECT USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Businesses: owner + admin only. No public policy (spec §0 #6).
CREATE POLICY "businesses manage their own profile"
  ON public.business_profiles FOR ALL USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- Campaigns.
CREATE POLICY "campaign owners manage their campaigns"
  ON public.campaigns FOR ALL USING (owner_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "active campaigns are viewable by creators"
  ON public.campaigns FOR SELECT USING (status IN ('published', 'in_progress', 'completed'));

CREATE POLICY "campaign_creators visible to creator, owner, admin"
  ON public.campaign_creators FOR SELECT
  USING (
    creator_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

-- Invoices.
CREATE POLICY "businesses view their invoices"
  ON public.invoices FOR SELECT USING (business_id = auth.uid() OR public.is_admin(auth.uid()));

-- Escrow: two involved parties + admin.
CREATE POLICY "escrow visible to involved parties"
  ON public.escrow_transactions FOR SELECT
  USING (
    recipient_profile_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_id AND c.owner_id = auth.uid())
  );

-- Notifications: strictly private (spec §0.1 #E).
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users mark own notifications read"
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());
