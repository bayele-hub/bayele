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
