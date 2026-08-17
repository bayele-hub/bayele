-- ============================================================================
-- Migration:          Agency retainers — propose → invoice (SokoClick) → fund → active → completed
-- Version:            20260817121400_0015
-- Date:               2026-08-17
-- Author:             Principal Backend & Database Systems Engineer + Security/Compliance
-- Team:               Bayele Core Platform Engineering
-- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
-- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
-- Feature Ticket:     BAY-AGENCY-015  (Milestone 8 — agency retainers; ADR-001; spec §3.1 §5)
-- Dependencies:       0001 (agency_retainers/invoices), 0003 (handle_sokoclick_invoice_paid),
--                     0005 (private.is_admin)
-- Rollback Script:    supabase/migrations/rollback/20260817121400_0015_agency_retainers.rollback.sql
-- Estimated Duration: ~0.3s
-- ============================================================================
-- Description:        The authenticated-callable façade for the agency-retainer lifecycle. A BUSINESS
--                     commissions a CONSULTANT (from the public consultant directory) with a money
--                     split that must satisfy retainer_math_integrity (contract = cut + fee + media;
--                     the KPI bonus sits on top, earned on completion — spec §0 #8). Per ADR-001,
--                     SokoClick generates the OHADA invoice (its infra); Bayele records the invoice id
--                     and drives the lifecycle; funding reuses the SINGLE funding path
--                     handle_sokoclick_invoice_paid (idempotent on the SokoClick invoice id) via both
--                     the webhook and the admin bridge — never a second money path.
--                       • propose_retainer            — business creates a draft retainer for a consultant
--                       • attach_retainer_invoice     — record the SokoClick invoice id, draft → invoiced
--                       • admin_confirm_retainer_funding — admin/MoMo bridge → funded (delegates to 0003)
--                       • transition_retainer         — active / completed / terminated with a hop matrix
-- Breaking Changes:   NONE (all new functions). CREATE OR REPLACE so re-apply is idempotent.
-- Performance Impact: FOR UPDATE lock on the single retainer row; a few single-row writes. No scans.
-- Compliance Notes:   Each wrapper derives the actor from auth.uid() (unspoofable) and self-authorizes
--                     before any write: propose_retainer requires the caller to be an active business;
--                     attach requires business-owner/admin; funding is private.is_admin-gated (parity
--                     with admin_confirm_campaign_funding); transition is admin-gated for active/
--                     completed and party-or-admin for terminated. The money split is validated in code
--                     (invalid_split) in addition to the retainer_math_integrity CHECK. Advisor will
--                     list these as intentional authenticated-execute definers (auth is internal).
-- ============================================================================

-- (1) Business proposes a retainer to a consultant. Self-scoped: business_id is auth.uid().
CREATE OR REPLACE FUNCTION public.propose_retainer(
  p_consultant_id  uuid,
  p_contract_value bigint,
  p_bayele_cut     bigint,
  p_consultant_fee bigint,
  p_media_budget   bigint,
  p_kpi_bonus      bigint DEFAULT 0
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_retainer uuid;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_actor AND ur.role = 'business') THEN
    RAISE EXCEPTION 'not_a_business';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.status = 'active') THEN
    RAISE EXCEPTION 'profile_not_active';
  END IF;

  IF p_consultant_id = v_actor THEN RAISE EXCEPTION 'cannot_retain_self'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'consultant'
    WHERE p.id = p_consultant_id AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'consultant_not_found';
  END IF;

  IF p_contract_value <= 0 OR p_bayele_cut < 0 OR p_consultant_fee < 0 OR p_media_budget < 0 OR p_kpi_bonus < 0 THEN
    RAISE EXCEPTION 'invalid_amounts';
  END IF;
  IF p_contract_value <> (p_bayele_cut + p_consultant_fee + p_media_budget) THEN
    RAISE EXCEPTION 'invalid_split';  -- also enforced by retainer_math_integrity CHECK
  END IF;

  INSERT INTO public.agency_retainers
    (business_id, consultant_id, contract_value_fcfa, bayele_cut_fcfa, consultant_fee_fcfa, media_budget_fcfa, kpi_bonus_fcfa, status)
  VALUES (v_actor, p_consultant_id, p_contract_value, p_bayele_cut, p_consultant_fee, p_media_budget, p_kpi_bonus, 'draft')
  RETURNING id INTO v_retainer;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (p_consultant_id, 'retainer_proposed', 'Nouveau contrat agence 📄',
          'Une marque vous propose un rétainer de ' || p_consultant_fee::text || ' FCFA (honoraires).',
          '/consultant/dashboard');

  RETURN v_retainer;
END;
$$;

-- (2) Record the SokoClick invoice on the retainer (draft → invoiced). The invoices ROW is created at
--     payment time by handle_sokoclick_invoice_paid — we only store the id here, so the funding path's
--     idempotency guard (EXISTS invoices …) is not pre-tripped.
CREATE OR REPLACE FUNCTION public.attach_retainer_invoice(
  p_retainer_id          uuid,
  p_sokoclick_invoice_id text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_status public.retainer_status; v_existing text;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_sokoclick_invoice_id IS NULL OR length(btrim(p_sokoclick_invoice_id)) = 0 THEN
    RAISE EXCEPTION 'missing_invoice_id';
  END IF;

  SELECT business_id, status, sokoclick_invoice_id
    INTO v_business, v_status, v_existing
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF NOT (v_business = v_actor OR private.is_admin(v_actor)) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  -- Idempotent: same invoice already attached → no-op.
  IF v_existing IS NOT NULL AND v_existing = p_sokoclick_invoice_id THEN RETURN; END IF;
  IF v_status <> 'draft' THEN RAISE EXCEPTION 'not_draft'; END IF;

  UPDATE public.agency_retainers
    SET sokoclick_invoice_id = p_sokoclick_invoice_id, status = 'invoiced'
    WHERE id = p_retainer_id;

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_invoiced', 'Facture prête',
          'Votre facture SokoClick pour le rétainer est prête. Réglez-la par Mobile Money pour activer le contrat.',
          '/business/retainers');
END;
$$;

-- (3) Admin (or, later, the MoMo/SokoClick webhook) confirms the retainer invoice was paid. Delegates
--     to the ONE funding path handle_sokoclick_invoice_paid (idempotent on the invoice id → status
--     'funded'), then notifies both parties. Mirrors admin_confirm_campaign_funding on the retainer side.
CREATE OR REPLACE FUNCTION public.admin_confirm_retainer_funding(
  p_retainer_id          uuid,
  p_sokoclick_receipt_id text DEFAULT NULL,
  p_pdf_url              text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_business uuid; v_consultant uuid; v_value bigint; v_status public.retainer_status; v_invoice text;
BEGIN
  IF NOT private.is_admin(auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;

  SELECT business_id, consultant_id, contract_value_fcfa, status, sokoclick_invoice_id
    INTO v_business, v_consultant, v_value, v_status, v_invoice
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_status = 'funded' OR v_status = 'active' OR v_status = 'completed' THEN RETURN; END IF;  -- idempotent
  IF v_invoice IS NULL THEN RAISE EXCEPTION 'not_invoiced'; END IF;

  -- Single funding path: records the invoice (idempotent) and flips the retainer to 'funded'.
  PERFORM public.handle_sokoclick_invoice_paid(
    v_invoice, p_sokoclick_receipt_id, v_business, 'agency_retainer', v_value, p_pdf_url, NULL, p_retainer_id);

  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_business, 'retainer_funded', 'Rétainer financé ✅',
          'Votre paiement est confirmé — le contrat agence est actif côté financement.',
          '/business/retainers');
  INSERT INTO public.notifications (user_id, type, title, body, link)
  VALUES (v_consultant, 'retainer_funded', 'Rétainer financé ✅',
          'La marque a financé le contrat. Vous pouvez démarrer la mission.',
          '/consultant/dashboard');
END;
$$;

-- (4) Lifecycle transitions after funding. active/completed are admin-driven (launch bridge — the
--     consultant fee + KPI bonus disbursement rides MoMo, off the campaign escrow ledger); terminate is
--     available to either party or an admin. Validated against a small hop matrix.
CREATE OR REPLACE FUNCTION public.transition_retainer(
  p_retainer_id uuid,
  p_to_status   public.retainer_status
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_business uuid; v_consultant uuid; v_from public.retainer_status; v_is_admin boolean; v_allowed boolean;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT business_id, consultant_id, status INTO v_business, v_consultant, v_from
    FROM public.agency_retainers WHERE id = p_retainer_id FOR UPDATE;
  IF v_business IS NULL THEN RAISE EXCEPTION 'retainer_not_found'; END IF;
  IF v_from = p_to_status THEN RETURN; END IF;

  v_is_admin := private.is_admin(v_actor);

  -- Hop matrix.
  v_allowed := CASE
    WHEN v_from = 'funded' AND p_to_status = 'active'                                    THEN TRUE
    WHEN v_from = 'active' AND p_to_status = 'completed'                                 THEN TRUE
    WHEN v_from IN ('draft','invoiced','funded','active') AND p_to_status = 'terminated' THEN TRUE
    ELSE FALSE
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'illegal_retainer_transition'; END IF;

  -- Authorization by target: active/completed are admin-only; terminate is party-or-admin.
  IF p_to_status IN ('active','completed') THEN
    IF NOT v_is_admin THEN RAISE EXCEPTION 'not_authorized'; END IF;
  ELSE  -- terminated
    IF NOT (v_is_admin OR v_actor = v_business OR v_actor = v_consultant) THEN RAISE EXCEPTION 'not_authorized'; END IF;
  END IF;

  UPDATE public.agency_retainers SET status = p_to_status WHERE id = p_retainer_id;

  IF p_to_status = 'active' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_active', 'Mission démarrée 🚀', 'Le contrat agence est actif. Bon travail !', '/consultant/dashboard'),
      (v_business,   'retainer_active', 'Mission démarrée 🚀', 'Votre consultant a démarré la mission.', '/business/retainers');
  ELSIF p_to_status = 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_completed', 'Contrat terminé 🎉', 'La mission est clôturée — honoraires et bonus KPI en cours de versement.', '/consultant/dashboard'),
      (v_business,   'retainer_completed', 'Contrat terminé 🎉', 'La mission agence est clôturée.', '/business/retainers');
  ELSE  -- terminated
    INSERT INTO public.notifications (user_id, type, title, body, link) VALUES
      (v_consultant, 'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé.', '/consultant/dashboard'),
      (v_business,   'retainer_terminated', 'Contrat annulé', 'Le contrat agence a été annulé.', '/business/retainers');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.propose_retainer(uuid, bigint, bigint, bigint, bigint, bigint) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.propose_retainer(uuid, bigint, bigint, bigint, bigint, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.attach_retainer_invoice(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.attach_retainer_invoice(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_confirm_retainer_funding(uuid, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_confirm_retainer_funding(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.transition_retainer(uuid, public.retainer_status) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.transition_retainer(uuid, public.retainer_status) TO authenticated;

-- ============================================================================
-- POST-APPLY VERIFICATION (Part 6) — with a throwaway business + agency consultant:
--   • non-business propose_retainer                    → RAISES 'not_a_business'                (neg first)
--   • propose with cut+fee+media <> contract           → RAISES 'invalid_split' (CHECK backs it) (neg)
--   • non-admin admin_confirm_retainer_funding         → RAISES 'not_authorized'                 (neg)
--   • transition_retainer draft → active               → RAISES 'illegal_retainer_transition'    (neg)
--   • happy path: propose(draft) → attach(invoiced) → admin fund(funded, one invoice row) →
--     admin active → admin completed; retainer_math_integrity holds throughout                  (pos)
--   • second admin_confirm_retainer_funding on funded  → no-op, no duplicate invoice            (idempotent)
-- ============================================================================
