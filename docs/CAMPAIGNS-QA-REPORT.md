# QA report: public campaign board (feat/campaign-board, uncommitted), 2026-10-10

Paths: S =  All evidence is in $S/qa/.

## Verdict
The DB layer is solid: every attack I ran was blocked. **Not ready to sign off**, because of two Major issues:
1. An open redirect through the `next` parameter, using a percent-encoded tab character.
2. The brand name shown on a board card differs from the one on `/campaigns/[id]`.

## Gate table

| # | Gate (§8 + extras) | Result | Evidence |
|---|---|---|---|
| 1 | Anon sees only public, open campaigns (no draft, private, completed, cancelled, under_review, pending_funding, or private in_progress) | PASS | t30.run.out, qa30.out |
| 2 | RPCs never return budget, fee, owner_id, brief or tags (column list plus output-text scan) | PASS | qa30.out, t30.run.out |
| 2b | Anon table access: brief, budget, fee and tags denied, including through WHERE/ORDER BY probes, whole-row refs, to_jsonb, TRUNCATE and writes | PASS | qa30.out |
| 3 | D5 hrefs for logged-out, pending creator, active creator, partner, brand and admin | PASS (code + unit tests) | campaign-ctas.ts/.test.ts, test.out |
| 4 | Sign-up from a card returns to that campaign; « voir plus » leads to /creator/campaigns; return path survives callback → dashboard → onboarding → done | PASS (unit) | return-path.test.ts |
| 5 | `next` rejects external URLs | **FAIL** | D1 |
| 6 | Soft wall: brief and apply absent from logged-out HTML | PASS (code review: brief is fetched only when `signedIn`; metadata and JSON-LD use the public teaser; LockedBrief carries no data). Anon also gets 42501 on brief at the DB level | page.tsx, public-campaigns.ts |
| 7 | Counts match the DB, hidden when 0, no invented figures | PASS for the DB (board = stats); copy scan found no invented figures. See D6 (disputed status) | qa30.out |
| 8 | Empty state with 0 campaigns | PASS | shots/campaigns-*.png |
| 8b | Thin state (1 campaign) and populated grid | NOT TESTED: the sandbox has no PostgREST. Code review only | — |
| 9 | 360/414 px, reduced motion, keyboard | PASS: no horizontal scroll on any page or viewport; reduced motion shows all content; focus rings visible on every tab stop. Card focus ring checked in code only (`has-[a[data-card-link]:focus-visible]`), since no cards render without data. Throttled 3G not run | browser.json, shots/ |
| 10 | `/campagnes` 301 → `/campaigns` (query string kept); sitemap has /campaigns; ItemList JSON-LD | PASS, with notes D7 and D8 | curl output below |
| 11 | Phase 2: referral set once, immutable, not readable by others, self-referral ignored | PASS | qa30.out, t30.run.out |
| X1 | Migrations 0030–0032 each apply in a single transaction (`psql -1`) on a DB at 0029; re-apply is idempotent; rollbacks run in reverse; forward again after rollback | PASS | migtx.out |
| X2 | Alerts: 5-alert limit, dedupe (case and whitespace), other user's alert unsubscribe returns false, limit holds under a 12-way concurrent race (got 5) | PASS | qa30.out, race.out |
| X3 | Publish trigger: notifies once, never the owner, not on re-toggle or status bounce, private → nothing until made public, suspended subscriber skipped, forged notification insert blocked by RLS | PASS (D5 is an edge case) | qa30.out |
| X4 | Admin stats as non-admin (creator, brand, pending) raise `not_authorized`; `my_referral_count` returns a bare integer; referrer cannot list referees | PASS | qa30.out |
| X5 | Limit abuse (100000, INT_MIN, INT_MAX, NULL, 0, negative); SQL-injection, LIKE-wildcard and 100k-character categories; bad enum or uuid values | PASS (clamped to 1..50; inputs treated as data; typed errors) | qa30.out |
| X6 | typecheck / vitest / build | PASS: tsc rc=0; 14 files and 129 tests pass; build rc=0 | typecheck.out, test.out, build.out |
| X7 | FR/EN key parity; FR typography in new keys; forbidden copy | PASS for dictionaries (351/351 keys, 0 typography errors in 111 new strings, no reward, « sans limite », email or WhatsApp-alert promises; WhatsApp appears only as a share target). Hard-coded strings: D9 | python scan (inline in report) |
| X8 | Tap targets ≥ 44 px | Minor fails, see D10 | browser.json |
| X9 | Bundle ≤ ~90 KB gzip | **FLAG** (over budget) | see Bundle |

Existing suites: t30 = T30 PASSED (95 ok), mc-test = ALL TESTS PASSED, t28 = T28 PASSED. My own qa30.sql = QA30 PASSED (83 ok, plus FINDING notices).

## Defects

### D1 Major: open redirect via `next` using a tab character (Frontend)
- **Cause:** `safeNextPath` (lib/attribution.ts) blocks `//` and `/\`, but it does not block ASCII tab, vertical tab or form feed. Browsers strip tab, LF and CR anywhere in a URL (WHATWG URL parsing), so `"/\t/evil.com"` resolves to `https://evil.com/`.
- **Repro (one click for any signed-in active or pending user):** `https://bayele.com/dashboard?next=/%09/evil.com` → `continueTarget()` accepts the value → `redirect('/\t/evil.com')` → the browser lands on evil.com.
- **Same payload on other entry points:** `/auth?mode=signin&next=/%09/evil.com` (router.push → dispatcher), the onboarding chain, and the « Continuer » link on /onboarding/done.
- **Not affected:** `/auth/callback`, because it prefixes `origin`.
- **New in this branch:** before, the dispatcher ignored `next`; it now honours it.
- **Evidence:** `open-redirect.repro.out` shows 2 failures, for `/%09/evil.com` and `%2F%09%2Fevil.com`. The repro test is `$S/qa/open-redirect.repro.test.ts`; I copied it into the repo temporarily to run it, then removed it.
- **Browser proof:** `browser.json` contains `openRedirectDemo`: Chromium resolves `'/\t/evil.example/phish'` to `http://evil.example/phish`.
- **Fix hint:** reject any control character or whitespace (`/[\u0000- \u007f]/`), or resolve with `new URL(v, base)` and require `origin === base`. Add these cases to attribution.test.ts.

### D2 Major: brand name differs between card and campaign page (Backend + Frontend)
- The board RPC is SECURITY DEFINER, so it shows the owner's `display_name` (e.g. "Brand X").
- `getPublicCampaign()` reads `profiles` through RLS. The policy "public profiles are readable" only covers active **creator/consultant** rows. Brand-owned campaigns therefore show « Une marque » on /campaigns/[id], in its metadata, JSON-LD `hiringOrganization` and OG image. This happens for anon **and** for signed-in creators.
- **Repro:** in the DB, `SET ROLE anon; SELECT count(*) FROM profiles WHERE id='<brand id>'` returns 0 (checked on the t30 fixture).
- **Fix hint:** return `brand_name` / `brand_handle` from `public_campaign_stats`, or add a small definer RPC.

### D3 Minor: a suspended account can be credited as referrer (Backend)
`record_signup_attribution` does not check the referrer's status (qa30.out FINDING, line 134). Admin stats and `my_referral_count` then count the sign-up for that account.

### D4 Minor (pre-existing, affects attribution): users can rename their handle to mixed case (Backend)
- `handle_format` uses `~*`, the unique key is case-sensitive, and `authenticated` holds UPDATE(handle).
- `UPDATE profiles SET handle='QA_C2'` succeeded while `qa_c2` exists (qa30.out, line 143).
- Effects: `?ref=QA_C2` credits `qa_c2`, and a mixed-case handle can never be resolved as a referrer. Possible impersonation of share links.
- Fix: `CHECK (handle = lower(handle))` or a guard in the trigger.

### D5 Minor: no alert when a private in_progress campaign is made public (Backend)
It appears on the board, but the trigger fires only for `status='published'` (qa30.out, line 226). It also re-notifies late subscribers after a private→public toggle. That is acceptable, and noted only.

### D6 Minor / question: `disputed` applications count as neither applied nor engaged (Backend / product)
The disputed creator's place reopens in `places_left`. Confirm this is intended.

### D7 Minor: unknown campaign id returns HTTP 200 (soft 404) (Frontend / DevOps)
- `/campaigns/<random-uuid>` and `/campaigns/not-a-uuid` return 200 with `noindex` and the 404 UI, because `(public)/loading.tsx` streams the shell first.
- This is pre-existing: `/creators/unknown` behaves the same; `/totally-unknown-page` correctly returns 404.
- The 404 page is French-only in EN (shots/campaign-404-*-en.png).

### D8 Minor: empty ItemList JSON-LD on the empty board (Frontend)
The page emits `ItemList` with `numberOfItems: 0` and no elements. Emit it only when there is at least 1 item. Also, `/campagnes/<id>` has no redirect (only `/campagnes`).

### D9 Minor: hard-coded French on /campaigns/[id] (Frontend)
- These strings are pre-existing but sit on a touched page, so the EN locale shows French: « Rémunération », « Créateurs recherchés », « Proposée par », « Paiement garanti … », « places », the footer line, and the `generateMetadata` title (« Campagne … /créateur »).
- « Paiement garanti : » uses ASCII U+0020 before ':' instead of U+00A0 (page.tsx line 171).
- The `(public)/loading.tsx` text « Chargement… » appears in EN.
- /auth is French-only in EN (pre-existing).

### D10 Minor: tap targets under 44 px (UI-UX)
Measured in browser.json:
- FR/EN header toggle: 40×48.
- Logo link: about 109×32.
- Footer « Tarifs »: 34×48.
- Desktop nav links: 20 px tall.
- Inline « Lancer une campagne » link on the empty state: 37 px tall on mobile.
- /auth: CGU checkbox 13×13 (the label helps) and « ← Retour à l'accueil » 117×14.

Separately, at 360 px the « Bayele. » wordmark's dot is cut off by the FR/EN switch (shots/campaigns-360x740-fr.png).

### D11 Info (pre-existing, Backend / product)
- Any signed-in account, including a competing brand, can read another brand's `total_budget_fcfa` and `platform_fee_rate` for public campaigns through the table. Sign-up is free, so that data is one sign-up away. The §8 RPC gate is still met.
- Anon still holds every grant, TRUNCATE included, on `campaign_creators` (Supabase default; RLS does not stop TRUNCATE). 0032 fixed this for `campaigns` only. Check the production grants.

## Bundle (First Load JS, gzip as reported by `next build`) vs the ~90 KB target (docs/SKILL.md §6.10)

| Route | Page | First Load |
|---|---|---|
| / | 3.06 kB | **114 kB** |
| /campaigns | 3.6 kB | **115 kB** |
| /campaigns/[id] | 2.4 kB | **113 kB** |

The shared baseline is already 102 kB (chunks of 46.2 kB and 54.2 kB), so every route is over before any page code loads. I am flagging this only, not fixing it. The new pages themselves are light.

## Curl checks (built app on :3311, no Supabase env)
```
/campaigns                                 200
/campagnes                                 301 → /campaigns
/campagnes?country=CM&ref=abc              301 → /campaigns?country=CM&ref=abc
/campaigns/<random uuid>                   200 (noindex, "Campagne introuvable")   ← D7
/sitemap.xml                               200, contains https://bayele.com/campaigns
/auth/callback?next=//evil.com             307 → /auth?mode=signin&error=confirmation
/auth/callback?code=x&next=/%09/evil.com   307 → /auth?…error   (callback is origin-prefixed; safe)
```
The header « Campagnes » link appears on / and /campaigns (desktop and mobile rail).

## Screenshots ($S/qa/shots/, all inspected)
- campaigns / home / auth-alerts / campaign-404, each at 360×740 and 414×896 (plus 1280×800 for the first three), in FR and EN.
- `-reduced` variants at 360 px.
- campaigns-focus-{fr,en}.png.
- home-360-scrolled-viewport.png.

Full-page home shots without reduced motion show blank below-the-fold sections. `reveal.mjs` proved this is a capture artifact: after scrolling like a real user, 0 of 34 `[data-reveal]` elements stay hidden.

## Files written
- $S/qa/qa30.sql, qa30.out
- $S/qa/migtx.sh, migtx.out
- $S/qa/race.out
- $S/qa/t30.run.out, mc.run.out, t28.run.out
- $S/qa/typecheck.out, test.out, build.out
- $S/qa/qa-browser.mjs, browser.json
- $S/qa/reveal.mjs
- $S/qa/open-redirect.repro.test.ts, open-redirect.repro.out
- $S/qa/shots/

I added no files to the repo. The only repo edit is to three tracker rows in docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md.

---

# Round 2 (re-verification after Backend + Frontend fixes), 2026-10-10

**Verdict: PASS. All gates that can be checked locally pass.** The tracker rows for Phase 1 and Phase 2 are now ticked. Only Minor leftovers outside the campaign surfaces remain, plus the smoke tests listed below.

## Re-run results

| Check | Result | Evidence |
|---|---|---|
| Fresh DB: t30 | PASS (T30 PASSED) | r2-t30.out |
| qa30.sql | PASS (QA30 PASSED). Two §6 expectations updated per the D6 decision: applied 3, places_left 1. I also added hard Round-2 assertions for D2, D3, D4, D5 and D11 (r1 copy kept as qa30.r1.sql) | r2-qa30.out |
| mc-test / t28 | PASS (ALL TESTS PASSED / T28 PASSED) | r2-mc.out, r2-t28.out |
| migtx.sh | PASS: each migration applies in one transaction (`psql -1`) on 0029; re-apply idempotent; rollbacks run 0032→0030; forward again after rollback. Rollbacks also undo `handle_lowercase`, the lowercase-handle index and the `campaign_creators` revoke | r2-migtx.out |
| typecheck / vitest / build | PASS: tsc rc=0; 14 files and 153 tests pass; build rc=0 | r2-typecheck.out, r2-test.out, r2-build.out |
| D1 open redirect | FIXED. The extended repro passes 19/19, covering %09, %0B, %0C, %20, U+3000, U+202E, `%5C`, `/%2F%2F`, double-encoding, CRLF, `javascript:`, `//`, `https://` and `/%2e%2e//`. The callback still returns 307 to /auth (origin-prefixed) | r2-open-redirect.out, r2-curl.out |
| D2 brand name | FIXED. `public_campaign_stats` returns `brand_name` / `brand_handle` to anon (qa30 Round-2 assertion), and `getPublicCampaign` reads the brand from that RPC, the same source as the board | r2-qa30.out, lib/data/public-campaigns.ts:84-96 |
| D3 suspended referrer | FIXED (assertion: `referred_by` IS NULL) | r2-qa30.out |
| D4 mixed-case handle | FIXED. The `handle_lowercase` constraint blocks `UPDATE … handle='QA_X'` | r2-qa30.out |
| D5 in_progress made public | FIXED (notifies) | r2-qa30.out |
| D6 disputed | DECIDED: counts as engaged. Board and stats agree | r2-qa30.out |
| D7 soft 404 | ACCEPTED as pre-existing (still 200 + noindex) | r2-curl.out |
| D8 empty ItemList / `/campagnes/:id` | FIXED. No ItemList on the empty board; `/campagnes/<id>` returns 301 to `/campaigns/<id>` | r2-curl.out |
| D9 hard-coded FR, typography | FIXED. EN shows « Loading… »; the hard-coded strings on /campaigns/[id] moved to the dictionaries; 0 typography errors in 123 new FR strings | python scan |
| D10 tap targets | FIXED on /campaigns and / at 360 and 414 px, FR and EN: no interactive element under 44 px. Wordmark dot no longer clipped. Desktop nav is 44 px tall, with « Tarifs » / « Billing » 37–43 px wide | r2-browser.json, shots-r2/ |
| D11 anon grants | FIXED. Anon has no grants on `campaign_creators`; TRUNCATE is denied | r2-qa30.out |
| No horizontal scroll; reduced motion; keyboard focus | PASS (all pages and viewports; reduced motion leaves 0 hidden; every tab stop shows a focus ring) | r2-browser.json |
| Key parity / forbidden copy | PASS (363/363 keys; no reward, « sans limite », or email/SMS alert wording) | python scan |
| Sitemap /campaigns; `/campagnes` 301 keeps the query | PASS | r2-curl.out |

## Remaining (none blocks the gates)

- **Minor (Frontend), outside the campaign surfaces:** on /auth, the logo link is 28 px tall and the CGU checkbox is 20×20; the inline CGU / Séquestre links are exempt. The 404 page logo is 32 px (D7 scope).
- **Flag (Frontend / DevOps), bundle:** First Load is unchanged: / 114 kB, /campaigns 115 kB, /campaigns/[id] 113 kB, against the ~90 KB target. The shared baseline alone is 102 kB.
- **Deploy note (Backend / DevOps):** 0031 runs `VALIDATE CONSTRAINT handle_lowercase` with no backfill. If production holds any mixed-case handle, the migration fails (atomically, so nothing half-applies). Run this before applying: `SELECT count(*) FROM profiles WHERE handle <> lower(handle);`
- **Info, pre-existing (product):** any signed-in account can read other brands' budget and fee rate on public campaigns through the table.

## Staging smoke test after deploy (needs live Supabase; not FAIL)
1. Thin board (1 campaign) and populated board, including a full campaign with the « Complet » pill ranked last.
2. Card brand name matches the name on /campaigns/[id] and in its share image.
3. Signed-in creator sees the brief and the apply button; logged-out HTML has neither.
4. Pending creator reaches /creator/campaigns and is bounced from dashboard, wallet and partner.
5. Alerts: subscribe, the 5-alert limit message, unsubscribe; publishing a campaign creates the in-app notification.
6. Sign-up with `?ref=` then onboarding writes `signup_attribution`; the referrer's count shows; admin attribution stats render.
7. Real email-confirmation round trip with `next` (card → campaign; « voir plus » → /creator/campaigns).

Round-2 files: r2-*.out, r2-browser.json, qa-browser-r2.mjs, shots-r2/, qa30.sql (r1 kept as qa30.r1.sql), open-redirect.repro.test.ts (extended). Server on :3311 stopped.
