# Release runbook: public Campagnes board (feat/campaign-board)

Owner: DevOps & SRE seat · 2026-10-10 · Supabase project `oxesplxlshsdrijzckpq` (Postgres 17.6)

## 0. State at hand-off

| Item | State |
|---|---|
| Branch commits (on top of origin/main `b733139`) | `c1674a0` feat(db) 0030–0032 · `cc14dc8` feat(web) |
| Patch | `campaign-board.patch` (2 commits, ~309 KB). Verified: fresh clone of main → `git am` → tree identical to the branch (`57f091c`); offline install, `typecheck` rc=0, `vitest` 14 files / 153 tests pass |
| Note | The plan-doc commit is **already on main** (`b733139`, same tree as the local `c2b31f6`), so the patch carries only the db + web commits. A 3-commit patch would fail `git am` on "already exists in index". |
| Production DB | **Unchanged, still at 0029.** Pre-checks pass (see §3.1). `apply_migration` for 0030 timed out twice from the DevOps seat with no effect (verified afterwards: no function, default still `false`, no migration row, no running or blocked session). Most likely cause: the write was waiting for owner approval. **0030 and 0031 still need applying (§3).** |
| Local checks on the branch | `pnpm --filter web typecheck` rc=0 · `pnpm --filter web test` 153/153 · build with the font mock rc=0 |

## 1. Required order (do not reorder)

```
A. Apply 0030 → 0031 to production    (additive; safe with the CURRENT web app)
B. Push the branch, open the PR, test the Vercel preview (the preview reads the production DB, so it needs A)
C. Merge → wait for the Vercel production deploy to finish (status Ready)
D. Apply 0032 (anon column lockdown) → verify → smoke-test logged out
```
Why: the new web app calls `public_campaign_board`, `public_campaign_stats`, the alert RPCs and the attribution RPCs, so it needs A first. The **currently deployed** `/campaigns/[id]` still selects `brief, mandatory_tags` as anon. If 0032 goes in before C, every logged-out campaign page returns a 404 and its OG image breaks.

## 2. Git steps for the user (Windows Git Bash)

Put `campaign-board.patch` in the repo root, then:

```bash
git switch main && git pull --no-edit
git switch -c feat/campaign-board
git am campaign-board.patch
rm campaign-board.patch
git push -u origin feat/campaign-board
```
- If `git am` stops, run `git am --abort`, check `git log -1 origin/main` is `b733139` (or newer) and send the error back. Do not use `--3way` blindly.
- Expect 2 new commits: `feat(db): …` and `feat(web): …`.
- Open the PR on GitHub (`feat/campaign-board` → `main`). Wait for the Vercel **preview** to be Ready and click through `/campaigns`, one `/campaigns/<id>`, `/campagnes`, then **merge** once §3 (A) is done and the preview looks right.
- After the merge, wait for the Vercel **production** deployment to show Ready before §4.

## 3. Step A: apply 0030 and 0031 to production

### 3.1 Pre-checks (read-only). Results on 2026-10-10:

```sql
SELECT count(*) FROM public.profiles WHERE handle <> lower(handle);              -- must be 0   (was 0)
SELECT count(*) FROM (SELECT lower(handle) FROM public.profiles
                      GROUP BY 1 HAVING count(*) > 1) d;                         -- must be 0   (was 0)
SELECT to_regclass('public.signup_attribution'), to_regclass('public.campaign_alerts'),
       to_regprocedure('public.public_campaign_board(public.country_code,text,integer)'); -- all NULL (were NULL)
```
`list_migrations` must end at `0029_new_markets_ng_ke_za` (it did: version `20261010112222`).
Schema compatibility was checked too: the enums hold every literal the functions use (`creator_campaign_status` includes `disputed`; `account_status` includes `suspended, rejected`); `notifications.type` is free text with no CHECK; `private.is_admin(uuid)` exists; the only trigger on campaigns is `trg_guard_campaigns`. The deployed app sends `is_public` explicitly on create, so the new default has no effect until the new form ships. It also never calls `public_campaign_stats`, so the `DROP FUNCTION IF EXISTS` in 0030 is harmless.

If the mixed-case count is not 0, **stop**: 0031's `VALIDATE CONSTRAINT handle_lowercase` would fail. It fails atomically, so nothing would be half-applied.

### 3.2 Apply

**Preferred (Supabase MCP, owner approves the call):**
- `apply_migration(project_id='oxesplxlshsdrijzckpq', name='0030_public_campaign_board', query=<full contents of supabase/migrations/20261010120000_0030_public_campaign_board.sql>)`
- then `apply_migration(..., name='0031_signup_attribution_and_alerts', query=<full contents of supabase/migrations/20261010120100_0031_signup_attribution_and_alerts.sql>)`

**Fallback (Dashboard → SQL editor):** paste each file on its own, in order, as one run. The editor wraps the run in a transaction. Then record the history row so `list_migrations` stays truthful:
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES (to_char(clock_timestamp() AT TIME ZONE 'utc','YYYYMMDDHH24MISS'), '0030_public_campaign_board');
-- after 0031 (run separately so the version differs):
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES (to_char(clock_timestamp() AT TIME ZONE 'utc','YYYYMMDDHH24MISS'), '0031_signup_attribution_and_alerts');
```
**Do not use `supabase db push`.** Production history versions are apply-time stamps (for example 0029 = `20261010112222`, while its file is `20261010110000`), so the CLI would treat every file as unapplied.

### 3.3 Verify (read-only)

```sql
SELECT
  to_regprocedure('public.public_campaign_board(public.country_code,text,integer)') AS board_fn,
  to_regprocedure('public.public_campaign_stats(uuid)')                            AS stats_fn,
  to_regprocedure('public.record_signup_attribution(text,text)')                   AS attrib_fn,
  to_regprocedure('public.admin_signup_attribution_stats()')                       AS admin_stats_fn,
  to_regprocedure('public.my_referral_count()')                                    AS ref_count_fn,
  to_regprocedure('public.subscribe_campaign_alert(public.country_code,text)')     AS sub_fn,
  to_regprocedure('public.unsubscribe_campaign_alert(uuid)')                       AS unsub_fn,
  to_regprocedure('public.my_campaign_alerts()')                                   AS my_alerts_fn,
  to_regprocedure('public.campaign_alert_limit()')                                 AS limit_fn,
  to_regclass('public.signup_attribution')                                         AS t_attrib,
  to_regclass('public.campaign_alerts')                                            AS t_alerts,
  (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_notify_campaign_alerts'
      AND tgrelid = 'public.campaigns'::regclass)                                  AS alert_trigger,   -- 1
  (SELECT convalidated FROM pg_constraint WHERE conname = 'handle_lowercase')      AS handle_lc_valid, -- true
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns' AND column_name='is_public') AS is_public_default, -- true
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.signup_attribution'::regclass) AS rls_attrib,  -- true
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.campaign_alerts'::regclass)    AS rls_alerts;  -- true

SELECT id, title, brand_name, applied_count, places_left FROM public.public_campaign_board();  -- no error; 1 row expected today
SELECT * FROM public.public_campaign_stats((SELECT id FROM public.public_campaign_board() LIMIT 1)); -- 1 row, brand_name not null

-- anon may execute the board and stats, but not the authenticated RPCs:
SELECT has_function_privilege('anon','public.public_campaign_board(public.country_code,text,integer)','EXECUTE') AS anon_board,  -- true
       has_function_privilege('anon','public.record_signup_attribution(text,text)','EXECUTE')                    AS anon_attrib, -- false
       has_function_privilege('anon','public.subscribe_campaign_alert(public.country_code,text)','EXECUTE')      AS anon_sub;    -- false
```
Afterwards, run `get_advisors(type='security')` and confirm there is no new ERROR-level advisory for these objects.

## 4. Step D: 0032 after the production deploy is live

**Gate (all three must hold):**
1. The Vercel production deployment of the merge commit is **Ready**.
2. Logged out, `https://bayele.com/campaigns` renders the new board, which shows that the new code is live.
3. View source of a logged-out `https://bayele.com/campaigns/<id>`: it has no brief text and shows the locked-brief block (new soft-wall code).

**Apply:** `apply_migration(name='0032_campaigns_anon_column_lockdown', query=<full contents of supabase/migrations/20261010120200_0032_campaigns_anon_column_lockdown.sql>)`, or use the SQL editor plus a history row as in §3.2.

**Verify (read-only):**
```sql
SELECT has_table_privilege('anon','public.campaigns','SELECT')                AS anon_table_select,   -- false (column grants only)
       has_column_privilege('anon','public.campaigns','title','SELECT')       AS anon_title,          -- true
       has_column_privilege('anon','public.campaigns','deadline','SELECT')    AS anon_deadline,       -- true
       has_column_privilege('anon','public.campaigns','brief','SELECT')       AS anon_brief,          -- false
       has_column_privilege('anon','public.campaigns','mandatory_tags','SELECT')    AS anon_tags,     -- false
       has_column_privilege('anon','public.campaigns','total_budget_fcfa','SELECT') AS anon_budget,   -- false
       has_column_privilege('anon','public.campaigns','platform_fee_rate','SELECT') AS anon_fee,      -- false
       has_table_privilege('anon','public.campaigns','TRUNCATE')              AS anon_truncate,       -- false
       has_table_privilege('anon','public.campaign_creators','SELECT')        AS anon_cc_select,      -- false
       has_table_privilege('anon','public.campaign_creators','TRUNCATE')      AS anon_cc_truncate,    -- false
       has_column_privilege('authenticated','public.campaigns','brief','SELECT') AS auth_brief;       -- true (unchanged)
SELECT count(*) FROM public.public_campaign_board();  -- same count as before 0032 (definer RPC unaffected)
```

**Smoke check (logged out, private window), right after:**
```bash
ID=$(curl -s https://bayele.com/sitemap.xml | grep -o 'https://bayele.com/campaigns/[0-9a-f-]\{36\}' | head -1); echo $ID
curl -s -o /dev/null -w '%{http_code}\n' "$ID"                       # 200
curl -s "$ID" | grep -c 'Campagne introuvable'                       # 0  (a 404 UI here means rollback 0032 now)
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' "$ID/opengraph-image"   # 200 image/png
curl -s -o /dev/null -w '%{http_code}\n' https://bayele.com/campaigns           # 200
```
Then, in a browser while logged out: the campaign page shows the title, brand (not « Une marque » for a brand campaign), pay, places and the locked brief. Signed in as a creator: the brief and « Postuler » appear.
If the logged-out page shows « Campagne introuvable » or the OG image fails, run the 0032 rollback (§6) immediately, then investigate.

## 5. Staging / production smoke test (QA-REPORT Round 2)

Run on the Vercel preview (after §3) and again on production (after §4):
1. Thin board (1 campaign) and populated board, including a full campaign with the « Complet » pill ranked last.
2. The card's brand name matches the name on /campaigns/[id] and in its share image.
3. A signed-in creator sees the brief and the apply button; the logged-out HTML has neither.
4. A pending creator reaches /creator/campaigns and is bounced from dashboard, wallet and partner.
5. Alerts: subscribe, the 5-alert limit message, unsubscribe; publishing a campaign creates the in-app notification.
6. Sign-up with `?ref=`, then onboarding, writes `signup_attribution`; the referrer's count shows; admin attribution stats render.
7. A real email-confirmation round trip with `next` (card → campaign; « voir plus » → /creator/campaigns).

Plus: `/campagnes?country=CM` → 301 `/campaigns?country=CM`; `/campagnes/<id>` → 301 `/campaigns/<id>`; `/sitemap.xml` lists `/campaigns`; `/dashboard?next=/%09/evil.com` stays on bayele.com.
Use test accounts for 5–6 and delete the test alerts afterwards (`unsubscribe` in the UI). Attribution rows are immutable from the client, so use a real new test account.

## 6. Rollback

Roll back the **web first, DB second**. The old web app works with 0030 and 0031 present, but not with 0032.

| Situation | Action |
|---|---|
| New web app broken in production | Vercel → Deployments → previous production deployment → **Promote to Production** (instant). Then `git revert -m 1 <merge sha>` in a PR. If 0032 is applied, **roll back 0032 first or at the same moment**, because the old app needs anon `brief`. |
| Logged-out /campaigns/[id] 404s after 0032 | Run `supabase/migrations/rollback/20261010120200_0032_campaigns_anon_column_lockdown.rollback.sql` (it restores the pre-0032 anon grants; this re-exposes brief, budget and fee to anon, so fix the client query and re-apply 0032). |
| 0031 must go | Export first (`COPY public.signup_attribution TO STDOUT WITH CSV HEADER;` and the same for `campaign_alerts`), then run `rollback/20261010120100_0031_signup_attribution_and_alerts.rollback.sql`. **Destructive:** drops attribution and alerts. Already-sent notifications stay. |
| 0030 must go | Only after no deployed web calls the board or stats RPCs: `rollback/20261010120000_0030_public_campaign_board.rollback.sql`. Campaigns created while the default was `true` stay public. |

Order for a full DB rollback: 0032 → 0031 → 0030.
**History rows:** the rollback scripts delete `schema_migrations` by *file* version (`20261010120x00`). Production records apply-time versions, so also run:
```sql
DELETE FROM supabase_migrations.schema_migrations
 WHERE name IN ('0032_campaigns_anon_column_lockdown');   -- add the 0031/0030 names when rolling those back
```

## 7. Pending after this hand-off

- [ ] §3: apply 0030 + 0031 to production (owner approval needed), then run the verification queries.
- [ ] §2: the user applies the patch, pushes, opens the PR and tests the preview.
- [ ] Merge, then wait for the production deploy to be Ready.
- [ ] §4: apply 0032, verify, run the logged-out smoke check.
- [ ] §5: run the smoke list on production; then tick the "PR merged + production check" rows in docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md §9 and the "Apply 0030 to production" row.
- Known flags (non-blocking): First Load JS of 113–115 kB against the ~90 kB budget (the shared baseline is 102 kB); unknown campaign ids return a soft 404 (200 + noindex); signed-in users can read other brands' budget and fee on public campaigns (pre-existing).
