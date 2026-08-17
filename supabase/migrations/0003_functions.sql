-- Escrow state machine + money-path RPCs — production spec v1.1.2 §3.3, §4.2, §5, §5.1.

-- §3.3 The only mutator of escrow_transactions.status. Validates + audits every hop.
CREATE OR REPLACE FUNCTION public.transition_escrow(
  p_txn_id UUID, p_to_status public.escrow_status, p_actor UUID, p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_from public.escrow_status;
  v_allowed BOOLEAN;
BEGIN
  SELECT status INTO v_from FROM public.escrow_transactions WHERE id = p_txn_id FOR UPDATE;
  IF v_from IS NULL THEN RAISE EXCEPTION 'escrow transaction % not found', p_txn_id; END IF;
  IF v_from = p_to_status THEN RETURN; END IF;

  v_allowed := CASE
    WHEN v_from = 'pending'       AND p_to_status IN ('held', 'refunding')                    THEN TRUE
    WHEN v_from = 'held'          AND p_to_status IN ('proof_pending', 'disputed', 'refunding') THEN TRUE
    WHEN v_from = 'proof_pending' AND p_to_status IN ('releasable', 'disputed', 'refunding')    THEN TRUE
    WHEN v_from = 'releasable'    AND p_to_status IN ('paid_out', 'disputed')                 THEN TRUE
    WHEN v_from = 'disputed'      AND p_to_status IN ('releasable', 'refunding')              THEN TRUE
    WHEN v_from = 'refunding'     AND p_to_status = 'refunded'                                THEN TRUE
    ELSE FALSE
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'illegal escrow transition: % -> %', v_from, p_to_status; END IF;

  UPDATE public.escrow_transactions SET status = p_to_status, updated_at = now() WHERE id = p_txn_id;
  INSERT INTO public.escrow_audit_log (transaction_id, from_status, to_status, actor_id, metadata)
  VALUES (p_txn_id, v_from, p_to_status, p_actor, p_metadata);
END;
$$;
REVOKE ALL ON FUNCTION public.transition_escrow(UUID, public.escrow_status, UUID, JSONB) FROM anon, authenticated;

-- §4.2 One atomic, idempotent funding path called by the webhook.
CREATE OR REPLACE FUNCTION public.handle_sokoclick_invoice_paid(
  p_sokoclick_invoice_id TEXT, p_sokoclick_receipt_id TEXT, p_business_id UUID,
  p_invoice_type public.invoice_type, p_amount_fcfa BIGINT, p_pdf_url TEXT,
  p_campaign_id UUID DEFAULT NULL, p_retainer_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_fee_rate NUMERIC; v_fee_fcfa BIGINT; v_net_fcfa BIGINT; v_txn_id UUID;
BEGIN
  IF EXISTS (SELECT 1 FROM public.invoices WHERE sokoclick_invoice_id = p_sokoclick_invoice_id) THEN RETURN; END IF;

  INSERT INTO public.invoices (sokoclick_invoice_id, sokoclick_receipt_id, business_id, invoice_type, amount_fcfa, pdf_url, status)
  VALUES (p_sokoclick_invoice_id, p_sokoclick_receipt_id, p_business_id, p_invoice_type, p_amount_fcfa, p_pdf_url, 'paid');

  IF p_campaign_id IS NOT NULL THEN
    SELECT platform_fee_rate INTO v_fee_rate FROM public.campaigns WHERE id = p_campaign_id;
    IF v_fee_rate IS NULL THEN RAISE EXCEPTION 'campaign % has no platform_fee_rate set', p_campaign_id; END IF;
    v_fee_fcfa := floor(p_amount_fcfa * v_fee_rate);
    v_net_fcfa := p_amount_fcfa - v_fee_fcfa;
    UPDATE public.campaigns SET status = 'published', match_pass_paid = true, updated_at = now() WHERE id = p_campaign_id;
    INSERT INTO public.escrow_transactions (campaign_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
    VALUES (p_campaign_id, 'inbound', p_amount_fcfa, v_fee_fcfa, v_net_fcfa, 'mtn_momo', p_sokoclick_invoice_id, 'pending')
    RETURNING id INTO v_txn_id;
    PERFORM public.transition_escrow(v_txn_id, 'held', p_business_id);
  ELSIF p_retainer_id IS NOT NULL THEN
    UPDATE public.agency_retainers SET status = 'funded' WHERE id = p_retainer_id;
  END IF;
END;
$$;

-- §5.1 Creator submits proof -> creates per-creator payout row, held -> proof_pending.
CREATE OR REPLACE FUNCTION public.submit_proof_of_post(
  p_campaign_creator_id UUID, p_actor UUID, p_media_storage_path TEXT, p_media_sha256 TEXT,
  p_media_type TEXT, p_gemini_raw JSONB DEFAULT NULL, p_verification_score NUMERIC DEFAULT NULL,
  p_provider public.payment_provider DEFAULT 'mtn_momo'
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_creator_id UUID; v_campaign_id UUID; v_agreed BIGINT; v_txn_id UUID; v_proof_id UUID;
BEGIN
  SELECT cc.creator_id, cc.campaign_id, cc.agreed_payout_fcfa
    INTO v_creator_id, v_campaign_id, v_agreed
    FROM public.campaign_creators cc WHERE cc.id = p_campaign_creator_id FOR UPDATE;
  IF v_creator_id IS NULL THEN RAISE EXCEPTION 'campaign_creator % not found', p_campaign_creator_id; END IF;
  IF v_creator_id <> p_actor THEN RAISE EXCEPTION 'actor % is not the assigned creator for %', p_actor, p_campaign_creator_id; END IF;

  INSERT INTO public.proof_of_post (campaign_creator_id, media_storage_path, media_sha256, media_type, gemini_raw_response, verification_score, is_valid)
  VALUES (p_campaign_creator_id, p_media_storage_path, p_media_sha256, p_media_type, p_gemini_raw, p_verification_score, NULL)
  RETURNING id INTO v_proof_id;

  UPDATE public.campaign_creators SET status = 'content_submitted', updated_at = now() WHERE id = p_campaign_creator_id;

  INSERT INTO public.escrow_transactions (campaign_id, campaign_creator_id, recipient_profile_id, direction, amount_fcfa, fee_fcfa, net_amount_fcfa, provider, provider_ref, status)
  VALUES (v_campaign_id, p_campaign_creator_id, v_creator_id, 'outbound', v_agreed, 0, v_agreed, p_provider, 'payout:' || p_campaign_creator_id::text, 'pending')
  RETURNING id INTO v_txn_id;

  PERFORM public.transition_escrow(v_txn_id, 'held', p_actor, jsonb_build_object('reason','earmarked_from_campaign_pool','campaign_id',v_campaign_id));
  PERFORM public.transition_escrow(v_txn_id, 'proof_pending', p_actor, jsonb_build_object('proof_id',v_proof_id));
  RETURN v_proof_id;
END;
$$;

-- §5 Human review. Authorization guard is the ONLY thing stopping self-approval (spec §0.1 #C).
CREATE OR REPLACE FUNCTION public.verify_proof_of_post(
  p_proof_id UUID, p_approve BOOLEAN, p_actor UUID, p_rejection_reason TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_campaign_creator_id UUID; v_campaign_id UUID; v_owner_id UUID; v_txn_id UUID;
BEGIN
  SELECT cc.id, cc.campaign_id, c.owner_id INTO v_campaign_creator_id, v_campaign_id, v_owner_id
    FROM public.proof_of_post pp
    JOIN public.campaign_creators cc ON cc.id = pp.campaign_creator_id
    JOIN public.campaigns c ON c.id = cc.campaign_id
    WHERE pp.id = p_proof_id;
  IF v_campaign_creator_id IS NULL THEN RAISE EXCEPTION 'proof % not found', p_proof_id; END IF;

  IF NOT (v_owner_id = p_actor OR public.is_admin(p_actor)) THEN
    RAISE EXCEPTION 'actor % not authorized to verify proofs on campaign %', p_actor, v_campaign_id;
  END IF;

  UPDATE public.proof_of_post
    SET is_valid = p_approve, reviewed_by = p_actor, reviewed_at = now(),
        rejection_reason = CASE WHEN p_approve THEN NULL ELSE p_rejection_reason END
    WHERE id = p_proof_id;
  UPDATE public.campaign_creators
    SET status = CASE WHEN p_approve THEN 'verified' ELSE 'rejected' END, updated_at = now()
    WHERE id = v_campaign_creator_id;

  IF p_approve THEN
    SELECT id INTO v_txn_id FROM public.escrow_transactions
      WHERE campaign_creator_id = v_campaign_creator_id AND status = 'proof_pending' LIMIT 1;
    IF v_txn_id IS NOT NULL THEN PERFORM public.transition_escrow(v_txn_id, 'releasable', p_actor); END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.verify_proof_of_post(UUID, BOOLEAN, UUID, TEXT) FROM anon;
