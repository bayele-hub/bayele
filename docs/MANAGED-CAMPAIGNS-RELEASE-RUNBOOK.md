# Release runbook: managed campaigns (« Géré par Bayele »)

Owner: DevOps & SRE seat · 2026-10-11 · branch `feat/managed-campaigns` (base origin/main `0c76e9e`) · Supabase project `oxesplxlshsdrijzckpq` (Postgres 17.6)

## 0. State at hand-off

| Item | State |
|---|---|
| Commits | (a) `feat(db): managed campaigns — briefs tracker, pay floors, board v2, guards (0033)` · (b) `feat(web): managed campaigns — admin briefs, Géré par Bayele, WhatsApp publishing, simpler brand form` |
| Patch | `managed-campaigns.patch` (2 commits). Verified on a fresh clone of origin/main: `git am` is clean, the tree is identical to the branch, and the offline install plus typecheck pass |
| Local gates | typecheck rc=0 · vitest 22 files / 219 tests · build with the font mock rc=0 · `MANIFEST.sha256` regenerated (33 files; `sha256sum -c` all OK) |
| **Production DB** | **0033 APPLIED on 2026-10-11** through the connector as `0033_managed_campaigns` (history version `20261010190148`). Pre-checks and post-checks pass (§2). The current web app is unaffected: v1 board and stats are unchanged, and the replaced functions keep their signatures. |
| Pending | Push, PR, preview, merge (§1) · smoke list (§5) · `NEXT_PUBLIC_BAYELE_WHATSAPP` once there is a number (§4) · retire v1 after deploy (§6) |

## 1. Order (do not reorder)

```
A. 0033 applied to production            DONE 2026-10-11 (the new web reads only the v2 RPCs and the new columns)
B. Push the branch → open the PR         user, Windows Git Bash (below)
C. Vercel preview Ready → smoke list §5 on the preview (it reads the production DB)
D. Merge → Vercel production deploy Ready → smoke list §5 on production
E. Later: set NEXT_PUBLIC_BAYELE_WHATSAPP (§4) · retire v1 board/stats (§6)
```

Git steps (Windows Git Bash). Put `managed-campaigns.patch` in the repo root, then:
```bash
git switch main && git pull --no-edit
git switch -c feat/managed-campaigns
git am managed-campaigns.patch
rm managed-campaigns.patch
git push -u origin feat/managed-campaigns
```
- Expect 2 new commits on top of `0c76e9e`. If `git am` stops, run `git am --abort`, check `git log -1 origin/main`, and send the error back.
- Open the PR `feat/managed-campaigns` → `main`, wait for the Vercel **preview** to be Ready, run §5, then merge.

## 2. Production evidence (0033)

**Pre-checks (read-only, all passed):**
- `list_migrations` ended at `0032_campaigns_anon_column_lockdown` (`20261010160119`).
- No 0033 objects existed: `managed_briefs`, `pay_floors`, `deliverable_type` and `public_campaign_board_v2` were all NULL; 0 new columns, 0 new constraints, no `trg_sync_managed_brief_status`.
- The existing campaigns satisfy the new CHECKs: 6 campaigns, all `is_managed` = false by default, and the new brand and text columns start NULL, so the length caps cannot fail.
- E9 guard compatibility:
  - campaigns whose `owner_role` is not held in `user_roles`: 0;
  - campaigns with an owner_role outside business/consultant: 0;
  - `business_profiles` without a business or consultant role: 0;
  - users holding both roles: 0.
- Handles: 0 mixed-case, 0 duplicates that differ only by case.
- **Drift check:** 0033 replaces `private.guard_campaigns`, `admin_confirm_campaign_funding` and `admin_refund_campaign`. Production's bodies match the repo's 0018 bodies apart from comments, which the connector strips. So the replacement changes only what 0033 intends.
- Local dry-run: the exact file applied in one transaction (`psql -1`) to a fresh local DB at 0032, rc=0.

**Apply:** `apply_migration(name='0033_managed_campaigns')` with the exact forward file (no DROP/DELETE, K8) returned `success: true`.

**Post-checks (read-only, all passed):**
- **Fingerprint:** 69 items compared between production and the local dry-run are identical: 20 function bodies plus signature, result, security and config; 13 constraints; column sets of 3 tables; anon column grants; EXECUTE grants per role; the policy; 3 triggers; the enum.
- `public_campaign_board_v2()` returns the current public campaign "Joyjoy" with brand_name "Joyjoy", brand_handle `bellemio`, is_managed false, places_left 5.
  - Same ids and brand names as v1.
  - `public_campaign_stats_v2` returns applied 4, places 5 and the same brand.
- anon:
  - cannot SELECT `brand_consent`, `claims_verified` or `total_budget_fcfa`;
  - cannot read `managed_briefs` or `pay_floors`;
  - may read `brand_label` and `is_managed`;
  - may execute only the v2 board and stats among the new or changed RPCs.
- authenticated: no table privilege on `pay_floors`, and no INSERT on `managed_briefs`.
- RLS is on for both tables. `pay_floors` holds 0 rows, `managed_briefs` 0 rows, and there are 0 managed campaigns. Both new constraints are validated.
- Security advisors: **no missing-RLS (ERROR) items.** The new findings are expected:
  - INFO `rls_enabled_no_policy` on `pay_floors`: intended, deny-all, RPC-only.
  - WARN "SECURITY DEFINER executable" on the v2 RPCs and admin RPCs: each checks the caller itself.
  - Pre-existing, not from this release:
    - anon can execute several messaging RPCs and `set_campaign_visibility`;
    - leaked-password protection is off.
  - These go to a separate hardening ticket.

## 3. What the deploy changes (for reviewers)
- The web reads the board and stats through **v2** only. v1 stays live for old clients until §6.
- The brand form switches to total budget with a live net per creator (R4). A floor warning and an acknowledgement tick show once floors exist (R5).
- New admin routes: `/admin/briefs`, `/admin/briefs/new`, `/admin/briefs/[id]`, `/admin/pay-floors` (super_admin only).
- `pay_floors` ships empty, so the admin form shows « Seuil non défini » and nothing is blocked until floors are set (K1).

## 4. `NEXT_PUBLIC_BAYELE_WHATSAPP` (when the owner has a number)
- Vercel → Project → Settings → Environment Variables → add `NEXT_PUBLIC_BAYELE_WHATSAPP` for **Production** and **Preview**. The value is the E.164 number, digits only or with `+`/spaces (it is normalised), e.g. `+237 6xx xx xx xx`.
- It is a `NEXT_PUBLIC_` variable, inlined **at build time**. **Redeploy** (Deployments → latest → Redeploy) after setting or changing it.
- While it is unset, the « Publiez par WhatsApp » CTA is not rendered anywhere (K5). This is the expected state now; QA checked it on /, /campaigns, /pricing and /auth.
- After it is set:
  - /campaigns shows only a small footer text link « Vous êtes une marque ? Publiez par WhatsApp » (R6);
  - home and pricing show a secondary button;
  - the link opens wa.me with the prefilled message.
- Never commit the number to the repo.

## 5. Smoke list (QA-REPORT-MANAGED), on the preview and then on production
1. 0033 is applied (done). Smoke-test v2 on production data, then retire v1 after the switch (§6).
2. Admin end to end in the UI:
   - create a brief, enter the « OUI », publish (pending_funding), then fund it on /admin/funding;
   - the card shows « Géré par Bayele » with brand_label;
   - the in-app alert reaches a matching creator;
   - the funding notification opens /admin/briefs.
3. Locked fields, then decline and refund → republish from the UI. The pay-floor set and clear UI shows « Seuil non défini » while the table is empty.
4. Brand self-serve:
   - preview shows total → fee → net;
   - a below-floor warning plus the required tick appear once a floor exists;
   - the inserted row passes budget_math_check, and owner_role is business.
5. A signed-in creator sees the managed brief, deliverables, usage rights and language. Logged-out HTML shows only the public fields plus the R1 deliverable count and type.
6. A real WhatsApp number in the Vercel env (production build): the link opens with the prefilled message, and it is absent from /campaigns for signed-in creators and admins.
7. A non-admin session on /admin/briefs and /admin/pay-floors redirects to /dashboard with no data.

**Production data hygiene:** steps 2–4 create real rows. Use an obviously test-titled brief, and keep it **private or unfunded** where possible. Cancel or refund it afterwards: decline cancels an unfunded campaign, and `admin_refund_campaign` handles a funded one. Do not leave a test managed campaign on the public board. Clear any test pay floor (`admin_clear_pay_floor`) unless the owner has decided O1.

## 6. Retire v1 board/stats (after the production deploy, QA D3)
- v1 still returns the owner admin's display name for managed rows. Retire it **before the first managed campaign is funded**, or right after the deploy.
- Check first that the deployed web no longer calls v1: Supabase → Logs → API, filter `rpc/public_campaign_board` without `_v2` over 24 h.
- In the **SQL editor**: it contains DROP, so the connector would block it.
```sql
REVOKE EXECUTE ON FUNCTION public.public_campaign_board(public.country_code, text, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.public_campaign_stats(uuid) FROM anon, authenticated;
-- after a quiet week, optionally:
-- DROP FUNCTION public.public_campaign_board(public.country_code, text, integer);
-- DROP FUNCTION public.public_campaign_stats(uuid);
```
The REVOKE step is reversible with `GRANT EXECUTE ... TO anon, authenticated`, so prefer it first.

## 7. Rollback (web first, then DB only if really needed)

**Web (instant):** Vercel → Deployments → the previous production deployment → **Promote to Production**. Then `git revert -m 1 <merge sha>` in a PR.
- The previous web app works with 0033 present: v1 board and stats are unchanged, the replaced functions keep their signatures, and the E9 guard only fixes owner_role for non-admin inserts.
- **So a web rollback alone is normally enough. Leave 0033 in place.**

**DB (only if 0033 itself is faulty), after the web rollback:**
1. The rollback contains DROP and DELETE, so run it in the **Supabase SQL editor**, not the connector (K8).
2. Precondition: no managed campaigns. The script aborts with `rollback_0033_blocked: managed campaigns exist`. Refund or cancel them first and decide what to do with the rows.
3. **Data loss:** `managed_briefs` and `pay_floors` are dropped. Export them first:
   ```sql
   COPY (SELECT * FROM public.managed_briefs) TO STDOUT WITH CSV HEADER;
   COPY (SELECT * FROM public.pay_floors)     TO STDOUT WITH CSV HEADER;
   ```
   In the dashboard, run `SELECT * …` and use "Download CSV".
4. Paste and run `supabase/migrations/rollback/20261011090000_0033_managed_campaigns.rollback.sql`. It also restores the 0018 bodies of `guard_campaigns`, `admin_confirm_campaign_funding` and `admin_refund_campaign`.
5. **History row:** the script deletes version `20261011090000` (the file version), but production recorded `20261010190148`. Also run:
   ```sql
   DELETE FROM supabase_migrations.schema_migrations WHERE name = '0033_managed_campaigns';
   ```
6. Verify: `to_regclass('public.managed_briefs')` is NULL, `public_campaign_board()` still returns the board, and anon still has the 0032 column grants only.

Do not use `supabase db push` on this project. Production history versions are apply-time stamps, so the CLI would treat every migration file as unapplied.

## 8. Follow-ups (not blocking)
- Security hardening ticket (pre-existing advisor findings):
  - anon can execute `list_my_conversations`, `mark_conversation_read`, `my_unread_conversation_count`, `open_conversation`, `report_conversation`, `send_message`, `set_conversation_muted` and `set_campaign_visibility` (they check `auth.uid()`, but EXECUTE should be revoked from anon);
  - turn on leaked-password protection in Auth.
- QA Minor (pre-existing): /auth logo is 28 px tall and the CGU checkbox is 20×20. The bundle flag is unchanged (shared code is 102 kB).
- Owner decisions O1–O4 are still open. No brief is published by this release (K2).

## 9. Follow-up release: funding-ref fix + section tooltips (branch `fix/funding-ref-and-brief-tooltips`, 2026-10-11)

**Incident:** on 2026-10-11 the FINEX managed campaign showed « Séquestre activé » but stayed `pending_funding`. Its invoice reference had already been used by another campaign. The idempotency check matched on the reference alone and silently returned the other campaign's transaction.

| Item | State |
|---|---|
| Migration `20261011120000_0034_funding_ref_per_campaign.sql` | **ALREADY APPLIED to production** by the Co-CTO on 2026-10-11 at 07:59 UTC (history `20261011075929 0034_funding_ref_per_campaign`). **Do not re-apply.** DevOps re-checked it read-only: the production body of `admin_confirm_campaign_funding` matches the repo file (whitespace and comments ignored); anon has no EXECUTE, authenticated does (grants unchanged). |
| What 0034 does | Idempotency is now per campaign. A reference already attached to *this* campaign returns its transaction (a real double-submit). A reference attached to another campaign raises `invoice_already_used`. Same signature, CREATE OR REPLACE, K8-clean. |
| Web | The funding card maps `invoice_already_used` to the F2 message. The placeholder is guidance with no digits. The action re-reads the campaign status and reports success only when it is `published` / `in_progress` (F3). The reference inputs disable autocapitalise and autocorrect. A « ? » section tooltip is added to the brief editor and the funding card (F4). No public page changed (F5). |
| Patch | `funding-fix-tooltips.patch`, 3 commits on top of main after PR #8. Apply it with the same Git Bash steps as §1, using branch `fix/funding-ref-and-brief-tooltips`. |
| QA | Final verdict PASS (no Blocker or Major). Open Minor items: N1 (the tooltip bubble can't be hovered) and N2 (duplicate `field-consent-proof` id, pre-existing). |
| Deferred | D3-db: references are compared exactly, so a re-cased reference (`soko-…`) could still fund a second campaign. Follow-up migration (K8-clean): normalise to `upper(btrim(ref))` in the RPC and the unique index. |

**Smoke test after deploy:**
1. On /admin/funding, a reused reference shows « Cette référence est déjà utilisée pour une autre campagne… » and the campaign stays `pending_funding`. A fresh reference publishes it and the card leaves the queue.
2. On a locked brief on a phone, every « ? » opens and closes with tap and with Esc.
3. `SOKO-2026-000123` is attached only to campaign bee9c557…; FINEX is funded with its own reference.

**Rollback:**
- Web: promote the previous Vercel deployment.
- DB: only if really needed. Run `rollback/20261011120000_0034_funding_ref_per_campaign.rollback.sql`, which restores the 0033 body (the ref-only check that caused the incident, so avoid it).
- If you do run it, remove the history row by name: `0034_funding_ref_per_campaign`. Production's version is `20261011075929`, not the file version.

## 10. Admin member review release (branch `feat/admin-profile-review`, 2026-10-14)

Migrations 0035 (security and money fixes), 0036 (moderation, read model, access log, text limits) and 0037 (phone lockdown). Contract: `briefs/BACKEND-CONTRACT-ADMIN-REVIEW.md`; QA: `qa/QA-REPORT-ADMIN-REVIEW.md` (final verdict GO).

### 10.1 Order (binding)
```
A. 0035 + 0036 applied to production      DONE 2026-10-14 (history 20261014035625, 20261014035916)
B. Owner applies the patch, pushes, opens the PR, checks the Vercel preview, merges → production deploy Ready
C. 0037 (phone lockdown)                  ONLY after B is Ready; never before (it breaks every signed-in page of the old web)
```
Keep the gap between A and B short. During that window the old web runs on 0035 + 0036 with these accepted limits:
- no retainer can be funded, because the old web has no partner « Accepter » button;
- funded retainers can't be ended (that needs the new settlement UI);
- leftover refunds wait for the new /admin/disputes queue;
- the old /admin/ledger labels a refund row « Paiement ».

### 10.2 Production evidence for 0035 + 0036 (2026-10-14)

**Pre-checks (read-only):**
- Production was at `0034_funding_ref_per_campaign`; none of the new objects existed.
- The only super_admin (`bayele_admin`) is active, so A7 doesn't lock anyone out.
- The Co-CTO's leftover-backfill preview returned 0 rows.
- Text limits: 1 city over 60 characters (grandfathered), 0 names over 80, 0 bios over 500.
- Before 0035, anon/authenticated held 28 TRUNCATE grants and authenticated could read `phone_e164`.

**Drift check:** every function in public/private matched the repo's 0034 state, with two exceptions:
- the v1 board/stats, retired on purpose (§6);
- `on_profile_status_change`, where one word of the « rejected » copy differed. 0036 replaces it entirely.

**Dry-run:** both files applied, one transaction each, to a fresh local DB at 0034.

**Apply:** `apply_migration` with each exact file returned `success` on the first try.

**Post-checks:**
- **All 96 functions** in public/private match the local dry-run exactly (body, result, security definer, volatility, search_path).
- The 12 new RPCs are executable by authenticated and **not** by anon.
- **TRUNCATE grants to anon/authenticated on existing tables: 0** (was 28). The `postgres` default ACL no longer includes TRUNCATE.
- **`profiles.phone_e164` is still readable by authenticated** (0037 not applied). A simulated signed-in creator (`SET LOCAL ROLE authenticated`, read-only, rolled back) gets 1 row from `select *` on its own profile, `get_my_contact()` returns 1 row, and `my_moderation_status()` works.
- `private.is_admin` requires `status = 'active'`; bayele_admin is still admin, and a creator is not.
- The 4 new tables exist with RLS on.
- The 3 text CHECKs are present as NOT VALID; 92 of 92 existing profiles are grandfathered.
- 0 leftover-refund rows, 0 settlements, 0 moderation events.
- The « browse open campaigns » policy now uses `private.is_active_partner`.
- Security advisors: no missing-RLS errors. The new SECURITY DEFINER warnings are expected.

**Notes:**
- The `supabase_admin` default ACL still grants TRUNCATE on tables that role creates later. The migration role can't change another role's defaults; this is a follow-up for the owner (Supabase support or dashboard). It doesn't affect any existing table.
- 1 existing retainer is `invoiced` without partner acceptance. Under O7 it can't be funded until the partner clicks « Accepter » in the new web (`respond_retainer` accepts legacy invoiced rows).

### 10.3 Step C: apply 0037 after the deploy is Ready

**Gate:**
1. The Vercel production deployment of the merge is **Ready**.
2. Signed in on production, /dashboard and /profile load, and /profile shows your own phone (through `get_my_contact`).

**Apply** with the connector (no DROP/DELETE in the file): `apply_migration(name='0037_profiles_phone_lockdown')` with the exact contents of `supabase/migrations/20261014090200_0037_profiles_phone_lockdown.sql`.

**Post-check (read-only):**
```sql
SELECT has_table_privilege('authenticated','public.profiles','SELECT')                         AS auth_table_select,   -- false
       has_column_privilege('authenticated','public.profiles','phone_e164','SELECT')           AS auth_phone,          -- false
       has_column_privilege('authenticated','public.profiles','text_limits_grandfathered','SELECT') AS auth_flag,       -- false
       has_column_privilege('authenticated','public.profiles','handle','SELECT')               AS auth_handle,         -- true
       has_column_privilege('authenticated','public.profiles','resubmitted_at','SELECT')       AS auth_resubmitted,    -- true
       has_column_privilege('anon','public.profiles','phone_e164','SELECT')                    AS anon_phone,          -- false
       (SELECT version||' '||name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1) AS last;  -- …0037_profiles_phone_lockdown
```
Simulated signed-in read: the explicit column list works and `select *` is refused.
```sql
BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub', '<an active member uuid>', true);
SET LOCAL ROLE authenticated;
SELECT id, handle, display_name, avatar_url, bio, city, country, status, created_at, updated_at, resubmitted_at
  FROM public.profiles WHERE id = auth.uid();          -- 1 row
SELECT count(*) FROM public.get_my_contact();          -- 1
ROLLBACK;
-- (a separate run of  SELECT * FROM public.profiles  as authenticated must fail with 42501)
```
**Smoke test right after 0037:**
- signed-in page loads (getSession) for a creator, a brand, a partner and the admin;
- /profile shows your own phone, and saving the phone still works;
- /admin/users/[id] « Afficher » reveals a phone;
- the public directories /creators and /partners still render logged out.

If any signed-in page shows an error, roll back 0037 at once (§10.5) and investigate.

### 10.4 Smoke list after deploy (QA)
1. Admin with a real session:
   - /admin/users filters and pagination; /admin/moderation redirects to `?status=pending_review`;
   - open @leopoldine and use « Demander une correction »;
   - the member edits their city and reappears at the top as resubmitted;
   - check the notification text for each decision type.
2. Reveal a field, then check that an `admin_access_log` row exists (reveal) and that a view is logged at most once per day.
3. Retainer end to end in the UI:
   - propose (25 % read-only) → partner Accepter → brand invoice → fund → complete → settlement paid;
   - an early end with a brand refund.
4. A leftover refund appears in /admin/disputes; confirm it with a receipt; the brand sees it.
5. Creator EN locale on /business/talent (AR-3); a creator with a legacy audience value saves their profile (AR-1).
6. Right after 0037: getSession and /profile work (own phone via `get_my_contact`).
7. @leopoldine changes only her avatar: it saves (AR-8 fix in 0036). Changing her city enforces the limit with a clear field error.
8. Funding a campaign or retainer of a non-approved brand shows « La marque n'est pas encore validée… » (O8).

### 10.5 Rollback (web first, then DB in reverse order)
1. **Web:** Vercel → promote the previous production deployment.
   - If 0037 is applied, **roll back 0037 at the same time**: the old web needs table-wide SELECT on profiles.
   - Then `git revert -m 1 <merge sha>` in a PR.
2. **0037** (connector-safe statements plus one history delete, so use the SQL editor): `rollback/20261014090200_0037_profiles_phone_lockdown.rollback.sql`. This re-exposes phone numbers to signed-in users, so treat it as temporary.
3. **0036** (SQL editor; DROP; **audit data loss**):
   - export `member_moderation_events`, `member_correction_requests` and `admin_access_log` first;
   - then run `rollback/20261014090100_0036_member_moderation_read_model.rollback.sql`;
   - it refuses to run while 0037 is still applied.
4. **0035** (SQL editor; DROP):
   - run `rollback/20261014090000_0035_member_review_security_money.rollback.sql`;
   - it refuses while retainer settlements or leftover-refund rows exist, or while 0036 or 0037 is still applied;
   - it re-grants TRUNCATE (A14).
5. **History rows:** each rollback deletes its *file* version (`2026101409xx00`), but production recorded apply-time versions. Also run:
   `DELETE FROM supabase_migrations.schema_migrations WHERE name IN ('0037_profiles_phone_lockdown', '0036_member_moderation_read_model', '0035_member_review_security_money');` (only for the ones rolled back).

### 10.6 Follow-ups (not blocking)
- `supabase_admin` default ACL still grants TRUNCATE (see 10.2).
- Pre-existing advisor warnings: anon can execute the messaging RPCs and `set_campaign_visibility`; leaked-password protection is off.
- QA carry-overs:
  - AR-4: « À vérifier » is capped at 2 000;
  - AR-5: a brand-refund settlement has no destination without a phone;
  - AR-7: the dashboard counts fees of fully refunded campaigns;
  - contract Q2/Q3 need owner answers.
- D3-db from §9: normalise the invoice reference case.

## 11. Partner governance release (branch `feat/partner-governance`, stacked on admin-review, 2026-10-14)

Migrations:
- 0038: enum value `partner_assignment`;
- 0039: governance, safe with the old web;
- 0040: enforcement, post-deploy.

Contract: `briefs/BACKEND-CONTRACT-PARTNER-GOV.md`; QA: `qa/QA-REPORT-PARTNER-GOV.md` (GO); tracker: `docs/PARTNER-GOVERNANCE-TRACKER.md`.

### 11.1 Order (binding)
```
A. 0038 → 0039 applied to production            DONE 2026-10-14 (history 20261014073339, 20261014074234)
B. Owner: git am admin-review.patch → push → PR → merge → Vercel Ready
C. Owner: git am partner-governance.patch → push → PR → merge → Vercel Ready
D. 0037 (phone lockdown, §10.3), then 0040   ONLY after B AND C are Ready
```
Git (Windows Git Bash), with both patches in the repo root:
```bash
git switch main && git pull --no-edit
git switch -c feat/admin-profile-review && git am admin-review.patch && git push -u origin feat/admin-profile-review
# open PR, merge, wait for Vercel production Ready, then:
git switch main && git pull --no-edit
git switch -c feat/partner-governance && git am partner-governance.patch && git push -u origin feat/partner-governance
# open PR, merge, wait for Vercel production Ready
rm admin-review.patch partner-governance.patch
```
`partner-governance.patch` applies only on top of the admin-review commits.

If you merge with GitHub's "Rebase" or "Squash" button, the commit IDs change. The partner-governance patch still applies, because `git am` matches file content, not commit IDs.

While A is live without D, the old web and the admin-review web keep working (QA t38_preweb + independent replay). They see the new behaviour only as new error codes:
- `conversation_frozen` / `closed` / `expired`;
- `payout_on_hold`;
- `recapture_pending`.

Brand↔partner threads before a funded retainer are already masked.

### 11.2 Production evidence for 0038 + 0039 (2026-10-14)

**Pre-checks (read-only):**
- Production was at 0036.
- **Drift check:** all 96 functions in public/private matched the repo's 0036 state (hash `fed49ff…`).
- pg_cron 1.6.4 was installed with no jobs.
- None of the new tables existed, and there was no `proofs` bucket.
- Data: 6 partners (all with free-text specialties), 0 legacy retainer pairs, 19 conversations (all deal threads).

**Dry-run:** both files applied in one transaction each to a fresh local DB at 0036.

**Apply:** `apply_migration` with the exact files returned `success` both times: `0038_partner_assignment_context`, then `0039_partner_governance` (153 KB).

**Post-checks:**
- **Functions:**
  - all 147 in public/private match the local dry run (body, result, security definer, volatility, search_path);
  - 134 are **byte-identical**, including every function from 0035–0039 (e.g. `mask_contacts` with its exact whitespace literals);
  - the other 13 predate this release and differ only in comment formatting from earlier applies.
- **Seed data identical:** 14 specialties, 81 aliases, 88 cities (md5 of the full content).
- **Cron:** `bayele_purge_masked_originals`, `17 3 * * *`, `SELECT private.purge_masked_originals()`, active.
- **`proofs` bucket:** private, 5 MB, jpeg/png/webp. Its policies are `proofs creator upload` (INSERT) and `proofs parties read` (SELECT), both for authenticated.
- **`message_originals`:**
  - RLS is on and forced, with 0 policies, 0 client grants and no realtime publication;
  - `authenticated` gets 42501 even on `select count(*)`.
- **Grants:** all 11 new tables have RLS on; none of the 27 new RPCs can be executed by anon; specialties and cities are publicly readable; aliases are not.
- **Old-web session:** a simulated signed-in brand's `select *` on its own profile returns 1 row, and `phone_e164` is still readable (0037 not applied).
- **Masking simulation** (brand on the existing unfunded retainer thread, everything in one transaction, then ROLLBACK):
  - input « Écris-moi au 677 12 34 56 ou wa.me/237677123456, budget 150 000 FCFA » was stored as « Écris-moi au [numéro masqué] ou [lien masqué], budget 150 000 FCFA » (the amount is kept);
  - `masked_kinds` = {messaging_link, phone};
  - the original was kept in `message_originals`;
  - one flag was raised;
  - the notification preview was masked;
  - afterwards: 19 conversations, 0 originals, 0 flags (nothing persisted).
- **Advisors:**
  - no ERROR;
  - INFO « RLS no policy » for `message_originals` and `partner_specialty_aliases` (deny-all by design) and `pay_floors` (existing);
  - the anon-executable list is unchanged and pre-existing.

**0040 preview (contract §11, read-only, taken now):**
- `rows_to_map` = 6 of 6 partners; 5 have at least one unmappable value, so **expect 5 correction requests and notifications** when 0040 runs;
- `legacy_pairs` = 0.

### 11.3 Step D: 0037, then 0040

**Gate:** both Vercel production deployments are Ready.
- admin-review: signed-in /dashboard and /profile load, and the own phone shows.
- partner-governance:
  - /admin/partners loads for the admin;
  - /business/partners loads for a brand;
  - the one-time CGU acknowledgement modal appears for a partner and a brand.

1. **0037** exactly as §10.3: apply, post-check and smoke test. Do not continue if a signed-in page fails.
2. **0040** through the connector: `apply_migration(name='0040_partner_governance_enforce')` with the exact contents of `supabase/migrations/20261014120200_0040_partner_governance_enforce.sql` (no DROP/DELETE).
   - Re-run the §11.2 preview first; if the counts changed, note them.

**0040 post-check (read-only):**
```sql
SELECT (SELECT version||' '||name FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 1)                AS last,   -- …0040_partner_governance_enforce
       (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_validate_specialties')                                    AS spec_trigger,  -- 1
       (SELECT count(*) FROM public.consultant_profiles kp
         WHERE EXISTS (SELECT 1 FROM unnest(kp.specialties) s WHERE s NOT IN (SELECT code FROM public.partner_specialties))) AS free_text_left, -- 0
       (SELECT count(*) FROM public.consultant_profiles WHERE cardinality(specialties) > 3)                           AS over_three,    -- 0
       (SELECT count(*) FROM public.consultant_profiles WHERE specialties_legacy IS NOT NULL)                         AS with_legacy,   -- ≈ 5
       (SELECT count(*) FROM public.member_correction_requests WHERE status = 'open' AND 'other' = ANY (fields))      AS spec_corrections, -- ≈ 5
       (SELECT count(*) FROM public.partner_assignments WHERE origin = 'legacy_retainer')                            AS legacy_assignments, -- = preview (0)
       private.current_consent_version()                                                                              AS consent_version;   -- '2026-10-14'
```
Also confirm the function fingerprint for `propose_retainer`, `open_conversation`, `request_partner_contact` and `onboard_profile` matches a local dry run of 0001–0040, using the same hash query as §11.2.

### 11.4 Smoke list (QA), on production after D
1. A brand submits a request, the admin approves it, and both parties land in `/messages/<id>` and can write.
   - A message with a phone number shows « Coordonnées masquées : … ».
   - The admin reads the original with a reason and finds the `admin_access_log` reveal row.
2. `select * from cron.job where jobname='bayele_purge_masked_originals'` returns the job (already verified after 0039).
3. WhatsApp proof upload on a real phone: compression, signed URLs, the brand « Demander une nouvelle capture », then a resubmit. This is low priority (P6).
4. After 0040:
   - the partner specialty picker (max 3);
   - the correction banner for unmapped legacy values on the 5 partners;
   - legacy retainer pairs show as assigned (0 today);
   - a brand proposing a retainer to an unassigned partner gets « Demander une mise en relation ».
5. Delist a partner: they disappear from /partners and their profile returns 404; their existing threads still work.
6. The admin-review smoke list (§10.4) on the combined release, in particular getSession and /profile after 0037.

### 11.5 Rollback (web first, then DB in reverse order)
1. **Web:** promote the previous Vercel deployment for each release, as needed.
   - If 0037 or 0040 is applied and you go back to a web that needs the old behaviour, roll those back at the same time:
     - the pre-admin-review web needs 0037 rolled back;
     - the pre-governance web needs 0040 rolled back (free-text specialties, retainers to unassigned partners).
2. **0040** (SQL editor; DELETE of legacy assignments): `rollback/20261014120200_0040_partner_governance_enforce.rollback.sql`.
   - **The specialty mapping is not reverted**: codes stay, and the originals of unmapped values remain in `specialties_legacy`. Correction requests already sent stay.
3. **0037** if needed (§10.5).
4. **0039** (SQL editor; DROP): `rollback/20261014120100_0039_partner_governance.rollback.sql`.
   - It refuses while 0040 is applied or while any governance data exists (assignments, requests, flags, originals, consents, proof media).
   - Export that data first if you must force it.
5. **0038** (SQL editor): it only un-records the migration, because Postgres can't drop an enum value. It refuses while `partner_assignment` conversations exist.
6. **History rows:** each rollback deletes its *file* version. Production recorded apply-time versions, so also run
   `DELETE FROM supabase_migrations.schema_migrations WHERE name IN ('0040_partner_governance_enforce', '0039_partner_governance', '0038_partner_assignment_context');` (only for the ones rolled back).

### 11.6 Pending outside engineering
- Local counsel review of the CGU clause, the privacy texts and the cross-border transfer basis (see the tracker).
- G12 deferred items: admin 2FA, the dispute window N, the screenshot purge job, creator reassignment.
