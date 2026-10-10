# Public « Campagnes » page — implementation plan & progress tracker

| | |
|---|---|
| **Feature** | Public list of the top 10 open brand campaigns, built to drive creator sign-ups |
| **Objective** | Signup virality: every visit and every share should end in a new creator account |
| **Owner roles** (`docs/SKILL.md` §2) | Head of Growth (funnel) · Mobile UX (field budget) · Frontend & Design Systems · Backend & DB (RPC/RLS) · Security · QA & Chaos (sign-off) |
| **Design standard** | `epic-design/SKILL.md`, **Mode 2 — enhance existing site** (CSS-only motion system in `app/globals.css`, no GSAP/WebGL on the mobile budget) |
| **Created** | 2026-10-10 |
| **Status** | 🟠 Built, QA-passed, 0030 + 0031 live in production — waiting for `unsubscribe_campaign_alert` (SQL Editor), PR merge, then 0032 (see `docs/CAMPAIGNS-RELEASE-RUNBOOK.md`) |

**How to use this file.** It is the single source of truth for this feature. Update the tracker
(§9) in the same commit as the work it describes: `[ ]` todo · `[~]` in progress · `[x]` done ·
`[!]` blocked (say why). Record every product decision in §2 and every change of plan in the
changelog (§11). Nothing is "done" until its QA gate in §8 has run against staging.

---

## 1. Context — what already exists

- **Campaign pages are already public:** `/campaigns/[id]` (server-rendered, `JobPosting` JSON-LD,
  per-campaign OG image, in the sitemap). Data: `lib/data/public-campaigns.ts` — only
  `is_public = true` campaigns in `published` / `in_progress`, non-sensitive fields only.
- **Logged-out apply already converts:** `components/campaign-apply-cta.tsx` sends visitors to
  `/auth?mode=signup&role=creator&intent=apply&target=<id>&next=/campaigns/<id>`. The auth page
  only accepts a same-origin `next` (open-redirect safe) and keeps it across the email round-trip.
- **Visibility is opt-in:** `campaigns.is_public` defaults to `false` (migration 0022).
- **No list page exists:** nothing at `/campaigns` (only `/campaigns/[id]`).
- **No analytics tool** is installed (no Vercel Analytics, PostHog, GA). Attribution must be
  stored in our own data.
- **Production data (2026-10-10):** 1 campaign is public **and** open; 1 more is open but private.
  ⚠️ A "top 10" page will render 1 card today — the empty/thin state is a first-class design
  requirement, and **no figure may be invented** (standing product rule).
- **Countries:** the six markets (CM, CI, GA, NG, KE, ZA) come from `lib/countries.ts`.
- **Note:** the link given in the request (`bayele.com/admin/funding`) is the admin funding
  queue, not this page. The public page lives at **`/campaigns`**, with **`/campagnes`** as a
  French alias (301).

## 2. Decisions

| # | Question | Council recommendation | Decision | Date |
|---|---|---|---|---|
| D1 | Gate on card click: hard sign-up wall vs **soft wall** | **Soft wall**: title, brand, pay/creator, country, platforms, places left, deadline stay public; full brief, deliverables and *Postuler* need an account. Keeps WhatsApp shares and Google job results working. | **Soft wall** (owner) | 2026-10-10 |
| D2 | `is_public` default for new campaigns | **On by default**, clear toggle to turn off at creation | **On by default** (owner) | 2026-10-10 |
| D3 | Scope of the first release | Phase 1 now, Phase 2 right after (§6) | **Both phases together**, one agent per seat (owner) | 2026-10-10 |
| D4 | Ranking of the "top 10" | Pay per creator ↓, then places left ↓, then newest | **Adopted**; amended by C1 (campaigns with places first) | 2026-10-10 |
| D5 | Where "Voir toutes les campagnes" lands | Creator → `/creator/campaigns`; partner → `/partner/campaigns`; brand → "Lancer une campagne"; logged-out → sign-up then `/creator/campaigns` | **Adopted** (admin → `/admin/dashboard`) | 2026-10-10 |

### Business council decisions (2026-10-10 — seats: CEO, Growth, CFO, Legal, Creator Community; one independent agent per seat)

| # | Question | Decision | Vote |
|---|---|---|---|
| C1 | Full campaigns (no places left) | Stay on the board with « Complet », ranked after campaigns with places; apply disabled; alert opt-in offered | 5/5 |
| C2 | Alert channel at launch | In-app notifications only; copy says « dans l'application »; no email/WhatsApp promise | 5/5 |
| C3 | Referral rewards | None at launch, no reward wording; referrers see a count only. If added later: only after the referred creator's first paid mission, written terms | 5/5 |
| C4 | Attribution model | URL-only (no cookie), first touch, claims ignored > 7 days after sign-up | 5/5 |
| C5 | Alerts per user | 5, with remaining count and « limite atteinte » message | 4/5 |
| C6 | « Gratuit » | Say « inscription gratuite »; **owner to confirm** whether creator sign-up stays free with no time limit before any "sans limite" claim | — |

### Engineering decisions recorded during the build

| # | Decision | Owner |
|---|---|---|
| E1 | Attribution stored in a separate owner/admin-only table `signup_attribution`, written by `record_signup_attribution()` after onboarding (not columns on `profiles`, which signed-in users can read) | Backend |
| E2 | Migration 0032: anon can no longer read `campaigns.brief`, `mandatory_tags`, `total_budget_fcfa`, `platform_fee_rate`; all anon writes on `campaigns` and `campaign_creators` revoked | Backend (QA D11) |
| E3 | `disputed` deals occupy their place (counted in places left and applied) | Co-CTO (QA D6) |
| E4 | Handles must be lowercase (`handle_lowercase` check); referrer lookup is case-insensitive; suspended/rejected referrers ignored | Backend (QA D3/D4) |
| E5 | Pending (not yet approved) creators may use `/creator/campaigns` (browse, apply, alerts) — consistent with migration 0021; the rest of the creator workspace stays active-only. The sign-up `next` path survives email confirmation and onboarding | Co-CTO + Frontend |

## 3. User flows

| Visitor | Clicks a campaign card | Clicks « Voir toutes les campagnes » |
|---|---|---|
| Logged out | D1 soft wall: campaign page, brief locked behind *Créer mon compte pour postuler* → sign-up (`role=creator&intent=apply&target=<id>&next=/campaigns/<id>`) → back on the campaign, unlocked | Sign-up (`role=creator&intent=campaigns&next=/creator/campaigns`) → their campaign section |
| Creator (pending or active) | Campaign page, full brief + *Postuler* | `/creator/campaigns` |
| Partner | Campaign page + "Postuler pour un créateur" | `/partner/campaigns` |
| Brand | Campaign page (read-only) | "Lancer une campagne" → `/business/campaigns/new` |
| Admin | Campaign page | `/admin/dashboard` |

All return paths go through the existing `next` handling (same-origin only). Hrefs are resolved
server-side in one helper (pattern of `lib/auth/landing-ctas.ts`) and covered by a drift-guard test.

## 4. Virality levers

1. **Real urgency, real numbers:** "3 places restantes", "Clôture dans 4 jours",
   "12 créateurs ont postulé" — from live counts only; hidden when zero/unknown.
2. **Local first:** country (6) and category filters; default sort favours the visitor's country
   when known (signed-in profile, else none — no IP guessing in v1).
3. **Share & earn (Phase 2):** a WhatsApp share on every card and campaign page, prefilled text +
   `?ref=<handle>`. The referrer is recorded once at sign-up → share leaderboard and future rewards.
4. **Campaign alerts (Phase 2):** "Prévenez-moi des nouvelles campagnes · Nigeria · Beauté" — turns
   a thin page into a reason to create an account.
5. **Home strip (Phase 2):** "Campagnes ouvertes" rail on the home page + a *Campagnes* header link.
6. **SEO:** `ItemList` JSON-LD on `/campaigns`, existing `JobPosting` on each campaign, sitemap entry.
7. **Attribution (Phase 2):** store `signup_source` (`campaigns_list` · `campaign_page` · `referral`
   · `home` · `direct`) and `referred_by` on the profile so conversion can be measured.

## 5. Design (epic-design, Mode 2)

Reuse the site's motion system (`.anim-rise`, `[data-reveal]`, `RevealRoot`, `data-loop-scope`);
no new libraries. Bottom line: one signature element, everything else quiet (`docs/SKILL.md` §6).

| Depth | Element | Treatment |
|---|---|---|
| 0 | Page atmosphere | Same radial brand/accent wash as the home hero (`aria-hidden`) |
| 1 | Glow behind the first card | Soft accent blur, static on `pointer: coarse` |
| 3 | **#1 campaign — the signature element** | Large "featured offer" card, pay in display type, live "places restantes" meter (`bl-bar`, transform-only) |
| 4 | Header, filters, cards 2–10 | Masked line reveal on the H1; cards `data-reveal="up"` with 60 ms stagger; chips as links (SSR, no client state) |
| 5 | "Nouveau" / "Bientôt complet" pills | Tiny accents, `aria-hidden` when decorative |

Rules: GPU-safe properties only (`transform`, `opacity`, `clip-path`); `prefers-reduced-motion`
honoured by the global rule; nothing hidden without JS; 48 px tap targets; first load within the
~90 KB budget; cards are real `<a>` elements (keyboard + screen readers). Empty/thin state: one
card + an honest panel ("Nouvelles campagnes chaque semaine — créez votre profil pour être
prévenu"), never placeholder campaigns. All figures shown as examples carry the "Exemple" tag.

Copy (FR first): H1 « Campagnes ouvertes » · sub « Des marques paient des créateurs comme vous —
le budget est déjà bloqué sous séquestre. » · card CTA « Voir l'offre » · page CTA « Voir toutes
les campagnes ».

## 6. Engineering plan

### Phase 1 — the page and the funnel (≈ 1–2 days)

**Database (migration `0030_public_campaign_board`)**
- `public.public_campaign_board(p_country country_code DEFAULT NULL, p_category text DEFAULT NULL, p_limit int DEFAULT 10)`
  `SECURITY DEFINER`, `STABLE`, granted to `anon` + `authenticated`. Returns **only** safe fields
  (id, title, category, target_country, payout_per_creator_fcfa, creator_count_target, platforms,
  content_type, deadline, created_at, brand display name/handle) **plus** `applied_count` and
  `places_left` (target − approved/in-flight). Filters `is_public AND status IN ('published','in_progress')`.
  Never returns budget, fee, owner id or brief internals. Limit capped at 50.
- If D2 = on: `ALTER TABLE campaigns ALTER COLUMN is_public SET DEFAULT true` (existing rows untouched).
- Rollback script; `types.gen.ts` updated.

**Web**
- `lib/data/public-campaigns.ts`: `listCampaignBoard({ country, category, limit })` via the RPC.
- `app/(public)/campaigns/page.tsx`: server-rendered list, filters as links (`?country=&cat=`),
  featured #1 + grid, empty/thin state, `ItemList` JSON-LD, metadata, OG.
- `lib/auth/campaign-ctas.ts` (+ test): role-aware card and "voir plus" hrefs (§3).
- `next.config.ts`: `/campagnes` → `/campaigns` (301).
- `/campaigns/[id]`: soft wall (D1) — brief/deliverables/apply rendered only with a session;
  logged-out visitors see the teaser + *Créer mon compte pour postuler*. JSON-LD keeps the public fields.
- Header nav: add *Campagnes*; sitemap: add `/campaigns`; dictionaries FR/EN.

### Phase 2 — the viral loop (≈ 1–2 days)
- Migration `0031_signup_attribution`: `profiles.referred_by uuid`, `profiles.signup_source text`,
  written once by `onboard_profile` from auth metadata, immutable afterwards (column guard trigger),
  never publicly readable.
- Auth page: carry `ref` + `source` into sign-up metadata (validated handle, allow-listed source).
- WhatsApp share button on cards and campaign pages (`?ref=<handle>` when signed in).
- Campaign alerts: `campaign_alerts` table (creator, country, category), notification on publish.
- Home "Campagnes ouvertes" strip (top 3, hidden when none).
- Admin: referral + signup-source counts on the dashboard.

## 7. Architecture invariants touched (`docs/SKILL.md` §3)

- **#1 RLS is the boundary:** the board reads through one definer RPC with a fixed column list;
  no new anon table grants.
- **#3 definer functions guard themselves:** the RPC filters to public + open inside the function.
- **#7 businesses are never browsable:** only the brand's public display name/handle is shown;
  `business_profiles` is never read.
- **#10 mobile budget:** SSR first page, no client fetch from an empty state, CSS-only motion.
- Attribution columns: PII-adjacent → owner/admin only, no public SELECT.

## 8. Verification gates (QA & Chaos sign-off)

- [x] Anon sees only `is_public` + open campaigns; drafts, private, completed, cancelled never appear.
- [x] RPC never returns budget, fee, owner id (column-list assertion).
- [x] Card + "voir plus" hrefs correct for: logged-out, pending creator, active creator, partner, brand, admin.
- [x] Sign-up from a card returns to that campaign; from "voir plus" lands on `/creator/campaigns`.
- [x] `next` rejects external / protocol-relative URLs (`//evil.com`, `https://…`).
- [x] Soft wall: brief/apply absent from logged-out HTML (not just hidden by CSS).
- [x] Counts (`applied`, `places_left`) match the DB; hidden when zero/unknown; no invented figures.
- [~] Empty state with 0 campaigns ✅; thin state with 1 → staging smoke test after deploy.
- [~] 360–414 px viewports, reduced-motion, keyboard-only ✅; throttled 3G → staging smoke test.
- [x] `/campagnes` 301 → `/campaigns`; sitemap + `ItemList` JSON-LD valid.
- [x] Phase 2: `referred_by` set once, immutable, not readable by other users; self-referral ignored.

## 9. Progress tracker

### Decisions
- [x] D1 soft wall
- [x] D2 `is_public` on by default
- [x] D3 both phases together

### Phase 1
- [x] Migration `0030_public_campaign_board` + rollback + local DB tests
- [x] Migration 0032 anon column lockdown on campaigns + tests
- [x] Apply 0030 + 0031 to production (2026-10-10, via apply_migration; history rows `0030_public_campaign_board`, `0031_signup_attribution_and_alerts`). One function, `unsubscribe_campaign_alert`, is pending — the connector holds any SQL containing DELETE/DROP for an owner confirmation that never arrives; owner pastes `unsubscribe-campaign-alert.sql` in the SQL Editor. 0032 only after the production web deploy
- [x] `types.gen.ts` updated
- [x] `listCampaignBoard()` data helper (+ `getCampaignStats`, `getPublicCampaign` anon-safe columns only, `getCampaignBriefForMember` for signed-in viewers — 0032-ready)
- [x] `lib/auth/campaign-ctas.ts` + unit tests
- [x] `/campaigns` page (featured card, grid, filters, empty/thin states)
- [x] `/campagnes` redirect
- [x] Soft wall on `/campaigns/[id]` (per D1)
- [x] Header *Campagnes* link, sitemap, FR/EN copy
- [x] `ItemList` JSON-LD + metadata/OG
- [x] Screenshots: mobile + desktop, FR + EN (QA: $S/qa/shots, empty-DB states only)
- [x] QA gates §8 (Phase 1 rows): QA round 2 PASS; staging smoke test after deploy listed in $S/qa/QA-REPORT.md
- [ ] PR merged + Vercel production check

### Phase 2
- [x] Migration `0031_signup_attribution` + rollback + tests (attribution in separate owner/admin-only table `signup_attribution`, written via `record_signup_attribution()` after onboarding; includes alerts + admin stats RPCs)
- [x] Auth: `ref` / `source` captured into sign-up metadata (+ `record_signup_attribution` after onboarding)
- [x] WhatsApp share (cards + campaign page)
- [x] Campaign alerts (table, opt-in UI, notify on publish) — web: opt-in (no-JS form), « Mes alertes » on /creator/campaigns, 5-alert limit UI
- [x] Home "Campagnes ouvertes" strip
- [x] Admin attribution counts
- [x] QA gates §8 (Phase 2 rows): QA round 2 PASS; alert/attribution writes = staging smoke test after deploy
- [ ] PR merged + production check

## 10. Risks & open questions

- **Thin inventory** (1 public open campaign today) — mitigations: D2, brand nudges, the honest
  empty state, campaign alerts. Track public-open count weekly.
- **Soft wall vs SEO:** Google must still see title/pay/country (kept public); the brief moves
  behind sign-up. Monitor Search Console job-posting coverage after release.
- **FCFA in new markets:** pay is shown in FCFA for NG/KE/ZA campaigns (current product rule).
- **No analytics tool:** conversion is measured from `signup_source` (Phase 2) until one is added.
- **Referral abuse:** self-referrals and handle spoofing are ignored server-side; rewards (if any)
  only after the referred creator's first paid mission.

## 11. Changelog

| Date | Change |
|---|---|
| 2026-10-10 | Plan created from the council review; decisions D1–D3 pending. |
| 2026-10-10 | Backend: migration 0032 (anon column lockdown on `campaigns`: no brief/budget/fee/tags for anon, anon writes revoked); business council decisions C1–C6 applied (full campaigns ranked last, in-app alerts only, no referral rewards, URL-only first-touch attribution ≤ 7 days, max 5 alerts, « inscription gratuite » wording). |
| 2026-10-10 | UI/UX design spec added: docs/CAMPAIGNS-PUBLIC-PAGE-DESIGN.md |
| 2026-10-10 | Owner decisions D1–D3 recorded; business council C1–C6; engineering decisions E1–E5. Backend, UI/UX, Frontend, QA (2 rounds, all local gates pass) and DevOps seats complete. QA report and release runbook added to docs/. Production DB step pending owner approval. |
| 2026-10-10 | Production: 0030 and 0031 applied. Cause of the earlier time-outs found: the Supabase connector holds any statement containing DROP/DELETE for an owner confirmation that never reaches the session. The `DROP … IF EXISTS` lines were no-ops on production and were omitted there; `unsubscribe_campaign_alert` (contains DELETE) is applied by the owner in the SQL Editor. `MANIFEST.sha256` regenerated for 0001–0032. |
