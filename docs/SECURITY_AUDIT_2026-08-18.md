# Bayele — QA Security Audit & Remediation

**Date:** 18 August 2026 · **Scope:** data-leakage, authorization, and business/system-logic correctness across the live Supabase database and the web app. Roles assumed per SKILL.md §2 (Lead Security & Compliance, Principal Backend/DB, QA & Chaos). Every finding below was reproduced against the **live** database and every fix re-verified there (negatives-first, in rolled-back transactions; seed left intact at 13 profiles).

---

## 1. Summary

The audit combined a live database introspection (RLS coverage, every SECURITY DEFINER function, column grants, advisors) with two parallel code audits (frontend data-boundary; business-logic wiring). RLS is enabled on all 13 tables and the application layer is clean — every server action derives the actor from `auth.uid()` (no IDOR), admin pages gate on `super_admin`, and secrets never reach the client bundle. The real defects were at the data tier: a set of escrow money-safety holes and a **PII leak that exposed creators' Mobile-Money payout phone numbers to the public anon key**.

All confirmed defects were remediated in **migration 0018** plus a small app change, and verified live. The most serious — an escrow drain via post-funding re-pricing, and the payout-phone leak — are now closed.

---

## 2. Confirmed findings & fixes (all verified live)

### Critical / High — money safety

**M1 — Escrow drain by re-pricing a funded campaign.** The write-guard from migration 0016 pinned a campaign's status and fee against direct writes but **not** its economic terms. A campaign owner could `UPDATE campaigns SET payout_per_creator_fcfa = 999999999` on a funded campaign via PostgREST; a subsequent creator's agreed payout is copied from that value, and an admin could disburse far more than was ever funded. *Reproduced live: payout re-priced to 999,999,999 on a published campaign.* **Fix:** `guard_campaigns` now pins `payout_per_creator_fcfa`, `total_budget_fcfa`, and `creator_count_target` on UPDATE. *Verified: the same attack now leaves the values unchanged.*

**M2 — No escrow-pool solvency check.** Nothing compared the sum of outbound creator earmarks against the funded inbound pool, so a mis-priced or oversized campaign could earmark (and pay) beyond what was collected. **Fix:** `submit_proof_of_post` now locks the inbound pool row, refuses if the campaign is unfunded (`campaign_not_funded`), and rejects any earmark that would push Σ(outbound) past the pool (`escrow_pool_exceeded`). *Verified: an over-pool earmark and an unfunded submit both raise; a within-pool earmark succeeds.* This is defense-in-depth beneath M1.

**M4 — Double-funding via a second invoice id.** `handle_sokoclick_invoice_paid` was idempotent only on the invoice id, so a second (different) invoice referencing an already-funded campaign created a second inbound escrow and re-published it. **Fix:** it now no-ops when the campaign is already funded (status past draft/pending or an inbound row exists). *Verified: a second invoice id leaves exactly one inbound escrow.*

**M5 — Refund/payout race (TOCTOU double-spend).** `admin_refund_campaign` checked "no creator paid out" without locking the outbound rows, so a concurrent `admin_confirm_creator_payout` could pay a creator *and* let the full pool be refunded to the business. **Fix:** the refund now locks all outbound rows before counting paid-outs, serializing it against payout.

**M3 — Approval capacity race.** `decide_application` counted approvals without locking the campaign, so concurrent approvals could exceed `creator_count_target` (and, with M2 absent, overspend). **Fix:** it now takes a campaign row lock before the capacity count.

### High — data leakage (PII)

**S1 — Creators' Mobile-Money payout phone leaked to the public.** RLS is row-level, and the "public read active creator profiles" policy exposed **every column** of active creator rows — including `momo_payout_phone_e164` and `momo_provider` — to the browser's anon key. *Reproduced live: an anonymous query returned a creator's payout phone.* This is directly monetizable fraud material. **Fix (note the subtlety):** a column-level `REVOKE` is a no-op because Supabase grants `anon`/`authenticated` **table-level** SELECT. The effective fix revokes the table grant and re-grants only the safe directory columns; the owner reads their own payout settings through a new owner-scoped `get_my_payout_settings()` definer RPC (three app reads rerouted accordingly). *Verified: momo columns now return **permission denied** for both anonymous and cross-user authenticated callers, while the directory still returns all creators.*

**S2 — Consultants' `tax_id` leaked to the public** via the same row-level exposure. **Fix:** `tax_id` revoked from anon and authenticated (no app path reads it). *Verified denied.*

**S3 — `phone_e164` leaked to anonymous users** on every active creator/consultant profile. **Fix:** anon restricted to safe `profiles` columns (authenticated retains full self-row read used by the session helper). *Verified: anon can no longer read `phone_e164`.* (`phone_e164` is unpopulated pre-v2; the authenticated-self read is preserved.)

### Medium — status coherence

**M6 — A paid creator could regress to "verified"** if a proof was re-reviewed. **Fix:** `verify_proof_of_post` is now a no-op once the creator is `paid`.

**M7 — Orphaned applicants.** A campaign could auto-complete while leaving applications stuck in `applied` forever. **Fix:** `admin_confirm_creator_payout` now rejects outstanding applications when it completes a campaign.

**M8 — No funding notification.** Every money event notified the relevant user except funding. **Fix:** `admin_confirm_campaign_funding` now notifies the business that escrow is live.

---

## 3. Verified secure (no change needed)

RLS is enabled on all 13 tables. Every server action scopes writes by `session.userId` or delegates to an `auth.uid()`-based RPC — no IDOR. Admin pages gate the render on `session.primary === 'super_admin'` (not just RLS). The self-approval guard (a creator cannot verify their own proof) holds. The SokoClick webhook verifies a constant-time HMAC before its single idempotent RPC, and the `service_role` client is confined to `server-only` modules — no secret reaches the client bundle. The auth-callback `next` param is origin-prefixed (no open redirect). `business_profiles` (tax_id, billing_address, billing_email) was already correctly non-public.

---

## 4. Residuals & deferred (documented, not money-stranding data leaks)

`phone_e164` remains readable by *authenticated* users cross-user (only anon was closed) because the session helper reads the full own-profile row; it is unpopulated until phone auth ships in v2, at which point the session read should move to explicit columns so the column can be locked for authenticated too. The previously-noted deferred features stand: retainer consultant-fee/KPI disbursement records no payable (collect-without-obligation — needs a ledger entry), `pro_subscription`/`match_pass` invoices don't grant the entitlement, and `rating_avg` is never computed. None of these are exploitable data leaks; they are tracked product gaps.

---

## 5. Change set

Migration **0018_security_hardening_audit** (applied + verified live; rollback + MANIFEST written) replaces the eight hardened functions, adds `get_my_payout_settings()`, and locks the PII columns. App: `creator/dashboard`, `creator/wallet`, and `profile` pages reroute their own payout read to the RPC; generated types updated. All app files passed a strict static type review. No seed data was modified.

The two operational blockers from prior reviews are unchanged and remain yours: set the Supabase Auth **Site URL to `https://bayele.com`**, and enable **leaked-password protection** (still flagged by the advisor).
