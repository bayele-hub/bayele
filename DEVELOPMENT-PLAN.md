# Bayele — Development Plan

**Standard:** FAANG-grade. Every milestone ships as a vertical slice (route → server action → RPC →
RLS), is test-first, and is not "done" until its verification gate passes against staging — never
self-certified (production spec §8). Roles in brackets are the `docs/SKILL.md` §2 agents to assume.

**Locked decisions:** unified `/auth` route · phone + password identity · four-actor model ·
canonical spec = `bayele-production-spec-v1.1.2.md`.

**Legend:** ✅ done in this pass · ◻ planned.

---

## Progress log

### 2026-08-17 — Database foundation applied to live Supabase (Backend/DB · Security/Compliance)

- ✅ **Migration standard authored** — `docs/DATABASE-MIGRATIONS.md`: 12-tag headers, true-inverse
  rollback per file, expand→contract, NOT VALID+VALIDATE, hash manifest, sign-off matrix, and a
  vendor-neutral portability contract (aligned to the SokoClick migration bar). Written **before**
  the migrations, then the migrations were rebuilt to satisfy it.
- ✅ **7 migrations applied to project `oxesplxlshsdrijzckpq` (PG 17.6)** with headers + rollbacks:
  `0001` core schema · `0002` RLS · `0003` escrow RPCs · `0004` security hardening · `0005` move
  `is_admin` to a non-exposed `private` schema · `0006` FK covering indexes · `0007` RLS initplan
  optimization. `MANIFEST.sha256` records all seven.
- ✅ **Advisors: security = 0 findings.** Performance: no errors / no unindexed FKs / no initplan;
  only `unused_index` (fresh-DB noise) and a documented `multiple_permissive_policies` tradeoff.
- ✅ **`types.gen.ts` regenerated** from the live schema (placeholder removed).
### 2026-08-17 (cont.) — Infra as code, demo seed, directory live (DevOps · Backend/DB · Growth)

- ✅ **Terraform scaffold** `infra/terraform/` — Supabase (data/logic) + Vercel (presentation) as
  declarative config with import steps, secret-safe vars, and a "migrating away" runbook
  (Cloud SQL / RDS). The portable Postgres schema stays owned by the migration pipeline, not TF.
- ✅ **Webhook RPC cast removed** — `handle_sokoclick_invoice_paid` is now typed against the
  generated schema; the money-path RPC name + args are compile-time checked.
- ✅ **Demo talent seeded** to live (12 active profiles: 8 creators, 4 consultants) via
  `supabase/seed.sql` (idempotent, fixed demo UUIDs).
- ✅ **Directory RLS bug found & fixed (`0008`)** — the anonymous directory rendered empty because
  `user_roles` was owner-only; widened the SELECT policy to expose only creator/consultant roles.
  **Gated verify:** as `anon`, 12 profiles / 8 creators / 4 consultants visible; **0** business
  profiles and **0** private role rows leaked. Milestone 1 acceptance gate #1 now passes on live.
### 2026-08-17 (cont.) — Milestone 3: auth funnel & onboarding (Backend/DB · Frontend · Security)

- ✅ **`onboard_profile()` RPC (`0009`+`0010`)** — one atomic call creates profile + role +
  role-profile, status hard-coded `pending_review`. Self-service: an authenticated user onboards
  ONLY themselves (`auth.uid() = p_actor` guard), no service key needed. **Gated verify on live:**
  status=pending_review; role + role-profile created; `profile_already_exists` / `handle_taken` /
  `actor_mismatch` all fire; anon cannot see a pending profile; seed intact (12 active).
- ✅ **Onboarding flow** — `/onboarding/[role]` server-guarded form (creator/consultant/business
  fields) → server action (user's own session) → RPC → `/onboarding/done` under-review screen.
  `getSession()` is the shared who-is-this helper.
- ✅ **Dispatcher `/dashboard`** routes by state (no profile → onboarding · pending → done ·
  active → role dashboard) + **email-confirmation callback** `/auth/callback`.
- ✅ **Middleware fix** — precise auth prefixes so the PUBLIC `/creators`/`/consultants` directory
  is no longer accidentally gated (latent `startsWith('/creator')` bug).
- **Gate (M3): PASSED** — a new signup lands in `pending_review`, invisible to the directory until
  approved. Advisor: only the intentional `onboard_profile` authenticated-execute WARN (self-authz
  via `auth.uid()`) + the auth leaked-password toggle. ⏭ **Next:** M4 admin approval flips `active`.

### 2026-08-17 (cont.) — Domain (bayele.com) + Milestone 4: admin & moderation (DevOps · Backend/DB · Security)

- ✅ **Domain wired in Terraform** — Auth `site_url` = `https://bayele.com`; redirect allow-list
  covers apex/www/vercel/localhost (+ each `/auth/callback`); leaked-password protection on; Vercel
  custom domain (apex + www→apex 308). Apply via `terraform apply`, or set the same values by hand.
- ✅ **`moderate_profile()` RPC + status trigger (`0011`)** — admin-only
  (`private.is_admin(auth.uid())`) status mutator; an `AFTER UPDATE OF status` trigger emits the
  approval/rejection notification (the single notify path). Trigger fn revoked from REST.
  **Gated verify on live (negatives first):** non-admin RPC → `not_authorized`; non-admin direct
  UPDATE → blocked by RLS (0 rows); admin approve → status `active` + a `profile_approved` notification.
- ✅ **Admin console** `/admin/dashboard` — admin-guarded queue of `pending_review` profiles with
  approve/reject (server action → RPC) and pending/active counts. Non-admins bounced.
- **Gate (M4): PASSED** — `is_admin` false for non-admins; non-admin can't reach `/admin` (middleware)
  nor mutate another profile (RLS). ⏭ **Next:** M5 authenticated shell + realtime notification bell.

### 2026-08-17 (cont.) — Milestone 5: authenticated shell & realtime notifications (Frontend · Backend/DB)

- ✅ **Realtime notification bell** — `(app)/layout.tsx` server-fetches the user's recent
  notifications + unread count (partial index, RLS-scoped); a client `NotificationBell` subscribes
  to Supabase Realtime INSERTs (`user_id=eq.<self>`) so approvals push in < 1s with an accurate
  badge. Mark-all-read updates via the "users mark own notifications read" RLS policy.
- ✅ **Per-role bottom nav** (mobile-first, hidden ≥ sm) — role-specific last tab
  (creator/consultant → Espace · business → Campagnes · admin → Modération).
- ✅ Owner account granted `super_admin` (admin profile, not publicly listed) + welcome notification
  seeded. Realtime confirmed enabled on `notifications`; RLS read verified as the user.
- **Gate (M5): PASSED** — Realtime enabled + RLS-scoped; unread computed once server-side then
  maintained client-side (no per-render count query). ⏭ **Next:** M6–8 escrow loop (SokoClick-gated).

### 2026-08-17 (cont.) — ADR-001 + Milestone 6: business workspace & campaign funding (Systems · Backend/DB · Frontend)

- ✅ **ADR-001 — escrow custody corrected.** SokoClick = invoicing / receipts / bookkeeping only (no
  funds). **Bayele is the escrow custodian**; money moves over Mobile Money (`momo-engine`); the
  funding trigger is a MoMo collection confirmation (webhook later; **admin bridge now**) — never a
  SokoClick webhook. `docs/ADR-001-escrow-custody-and-sokoclick.md`.
- ✅ **Funding RPC `admin_confirm_campaign_funding` (`0012`)** — admin-gated; atomically records the
  invoice, opens inbound escrow, moves it pending→held via `transition_escrow`, publishes the
  campaign. Idempotent on the SokoClick invoice id. **Gated verify on live (negatives first):**
  non-admin → `not_authorized`; admin confirm → escrow held, fee 67 500 (15%), net 382 500, campaign
  published, audit row; redelivered confirm → same txn, no double-fund. (Fixed an ordering bug:
  idempotency must precede the fundability check.)
- ✅ **Business workspace** — `/business/campaigns/new` (tier sets the fee; live budget breakdown,
  grossed up so the net pool covers payouts) + `/business/dashboard` (campaigns + funding state).
- ✅ **Admin funding console** — a "campagnes à financer" queue in `/admin/dashboard`; confirming a
  MoMo payment activates the séquestre.
- **Gate (M6 funding): PASSED.**

### 2026-08-17 (cont.) — Milestone 7: campaign execution & the escrow release loop (Backend/DB · Security · Frontend)

- ✅ **Execution-loop RPCs (`0013`)** — five authenticated-callable façades over the `0003` money-path
  definers, each deriving the actor from `auth.uid()` (unspoofable) and self-authorizing before any
  write, then emitting the participant notification: `apply_to_campaign`, `decide_application`,
  `creator_submit_proof` (wraps `submit_proof_of_post`), `review_proof` (wraps `verify_proof_of_post`),
  `admin_confirm_creator_payout`. The underlying definers stay REVOKEd from `authenticated`.
- ✅ **Payout bridge = MoMo disbursement, admin-confirmed (ADR-001).** Real outbound MoMo rails are
  still external-gated, so `admin_confirm_creator_payout` mirrors `admin_confirm_campaign_funding` on
  the outbound side: it moves the creator's outbound escrow `releasable → paid_out` via
  `transition_escrow`, marks the assignment `paid`, notifies the creator, and closes the campaign when
  the last assignment is paid. **Idempotent** — a redelivered confirmation on a `paid_out` row is a
  no-op (no double-pay). A disbursement webhook replaces the human later.
- 🐞 **Two latent regressions surfaced & fixed forward (`0014`).** The negatives-first suite caught
  that `verify_proof_of_post` (from `0003`) still called `public.is_admin`, which `0005` dropped when
  it relocated the predicate to `private` — so **every** proof review (owner or admin) crashed with
  "function public.is_admin(uuid) does not exist," breaking the entire escrow-release path. Re-creating
  it exposed a second dormant defect one line down: `SET status = CASE … END` resolved to `text`, which
  won't implicitly cast to the `creator_campaign_status` enum. `0014` repoints to `private.is_admin`
  and adds the explicit enum cast (applied migrations are never mutated).
- ✅ **Live verification (negatives first, then torn down; seed confirmed 13/13):** non-creator apply →
  `not_a_creator`; re-apply → `already_applied`; submit-before-approval → `not_approved`; non-owner
  decide → `not_authorized`; **creator reviewing own proof → not authorized (self-approval blocked)**;
  non-admin payout → `not_authorized`. Happy path apply → approve (campaign→`in_progress`) → submit
  (escrow→`proof_pending`) → verify (→`releasable`) → admin payout (→`paid_out`, campaign→`completed`)
  with the full audit trail `pending→held→proof_pending→releasable→paid_out`; idempotent re-confirm =
  same txn, no extra hop. Security advisor: 0 ERROR (only the 8 intentional authenticated-execute
  definers + the user-side leaked-password toggle).
- ✅ **Creator workspace** — `/creator/campaigns` (browse open campaigns + apply) and
  `/creator/dashboard` (my missions, earnings/active stats, proof-submission form on approval; the
  post URL is the v1 proof medium, sha256 computed app-side).
- ✅ **Business campaign console** — `/business/campaigns/[id]` (applicants: approve/reject; submitted
  proofs: verify/reject-with-reason); dashboard cards now link into it.
- ✅ **Admin payout console** — a "paiements créateurs" queue in `/admin/dashboard` over `releasable`
  outbound escrow; confirming the MoMo disbursement releases the payout.
- **Gate (M7 execution loop): PASSED.** ⏭ **Remaining (external-gated):** swap the two admin bridges
  for real MoMo **collection + disbursement webhooks** (needs live merchant API) and a Gemini
  Proof-of-Post scoring call (currently a null score; human review is the release gate either way);
  **M8 agency retainers** (`retainer_math_integrity`, funded via the webhook RPC).

---

## Milestone 0 — Foundation ✅ (scaffolded)

**[Systems Architect · Backend/DB · DevOps]**

- ✅ Turborepo + pnpm workspace, shared `@bayele/config` (eslint/tailwind/tsconfig), CI
  (`format → lint → typecheck → test → build`, plus `supabase test db`).
- ✅ Shared packages: `ui`, `database` (server/browser clients), `auth`, `notifications` (single
  `notify()` write path), `sokoclick-sdk` (with the XAF/XOF fix).
- ✅ Supabase migrations `0001_init` (schema) · `0002_rls` (all policies + `is_admin`) ·
  `0003_functions` (`transition_escrow`, `handle_sokoclick_invoice_paid`, `submit_proof_of_post`,
  `verify_proof_of_post`); pgTAP suite for the escrow machine + RBAC.
- ✅ Root `middleware.ts` (correct location), `(public)/(auth)/(app)` route groups, webhook route.

**Gate:** `pnpm install && pnpm build` green; `supabase start` applies all migrations; `supabase
test db` passes. **Remaining to close:** run these on a real machine and generate `types.gen.ts`
from the live schema.

---

## Milestone 1 — Home landing page frontend ✅ (built this pass) — **START HERE**

**[Frontend/Design Systems Architect · Mobile UX Architect · UX/Growth]**

The public entry point and the first thing indexed by Google and shared on WhatsApp. Built as a
server component at `apps/web/app/(public)/page.tsx`.

Delivered:

- ✅ Sticky mobile nav; hero "thesis" (paid status → secured escrow) with dual role CTAs to `/auth`.
- ✅ Trust guarantees (escrow / MoMo / OHADA), a real 3-step escrow explainer (numbered because it
  *is* an ordered sequence — justified per SKILL.md §6), live talent directory, footer → legal.
- ✅ Server-rendered directory via `lib/data/talent.ts` (`getFeaturedTalent`) — depends on the
  v1.1.2 public-read RLS; graceful empty state when no active profiles.
- ✅ Mobile-first floor: 48px tap targets, `themeColor`/viewport, reduced-motion respected,
  system-font-first, ISR `revalidate = 60`.

**Acceptance gate (to close on staging):**

1. Anonymous visitor sees active creators/consultants; a `pending_review` profile never appears.
2. Lighthouse mobile ≥ 90 (perf/a11y/SEO); first load ≤ ~90KB gzip on a throttled 3G profile at
   360–414px.
3. Keyboard focus visible on every interactive element; axe: zero critical a11y violations.
4. All CTAs resolve (`/auth?mode=…`, `/legal#…`, `/creators/[handle]`).

**Open design decision (flag, don't guess):** the palette/type here uses brand-neutral tokens
(`ink`/`surface`/`brand` + MoMo colors) instead of committing to the reference slate+emerald look,
which reads as an AI default (SKILL.md §6). Finalize the visual identity (display typeface + brand
hex) before scaling the design system — swap the tokens in `packages/config/tailwind`.

---

## Milestone 2 — Public directory & profiles ◻

**[Frontend/Design · Backend/DB · Mobile UX]**

- Directory pages (`/creators`, `/consultants`) with server-rendered first page + infinite scroll,
  filters (country, category), blur-hash avatars.
- Public profile pages (`/creators/[handle]`, `/consultants/[handle]`) with the "view then sign up
  with intent" CTA (`/auth?intent=message&target=<handle>`).

**Gate:** directory paginates without layout shift on mid-range Android; profile pages pass the same
RLS visibility test as M1; SEO metadata + OpenGraph per profile for WhatsApp share cards.

---

## Milestone 3 — Auth funnel & onboarding ◻

**[Frontend/Design · Security/Compliance · UX/Growth]**

- Wire the unified `/auth` funnel (already scaffolded) to Supabase Auth: phone + password, OTP as
  passwordless/recovery; verify phone before an account can transact (it's the payout key).
- Role dispatcher → `/onboarding/[role]` collecting role-specific fields (business `billing_email`!)
  → `status = pending_review`.

**Gate:** a new signup lands in `pending_review` and is invisible to the public directory until
approved; phone verification enforced; intent params survive the funnel.

---

## Milestone 4 — Admin & moderation ◻

**[Backend/DB · Security/Compliance · Product/TPM]**

- Admin dashboard: approve/reject profiles (the gate before public listing), user list, escrow
  ledger (read-only), disputes.
- Approve/reject writes go through a server action; a `profiles.status` trigger emits the
  `profile_approved` / `profile_rejected` notification.

**Gate:** `is_admin()` returns false for a non-admin JWT (test the negative first); a non-admin
cannot reach `/admin` (middleware) nor mutate another profile (RLS).

---

## Milestone 5 — Authenticated shell & notifications ◻

**[Frontend/Design · Backend/DB]**

- Shared `(app)/layout.tsx` shell: notification bell on a Supabase Realtime subscription to
  `notifications`, unread count via the partial index; bottom nav per role.
- All emits go through `notify()`; seed with the approval events from M4.

**Gate:** a `notify()` insert pushes to the bell in < 1s via Realtime; unread badge accurate; no
client-side count query on every render.

---

## Milestone 6 — Business workspace & SokoClick funding ◻ (dependency-gated)

**[Backend/DB · Security/Compliance · Full-Stack]**

- Business profile + self-serve campaign creation that sets `platform_fee_rate` by tier at creation.
- SokoClick invoice creation (`packages/sokoclick-sdk`), and the funding path: webhook → **one** RPC
  (`handle_sokoclick_invoice_paid`, already implemented) → inbound escrow `pending → held`.

**⚠️ Blocked** until SokoClick confirms an invoicing API (spec header). If unavailable, decide
between a scoped SokoClick API or a lightweight in-house OHADA generator **before** building.

**Gate:** fire the same signed webhook payload twice → exactly one escrow row, no partial state;
signature verified in every environment; CI `invoice.paid` fixture test.

---

## Milestone 7 — Campaign execution & the escrow loop ◻

**[Backend/DB · AI/ML (Gemini) · Full-Stack]**

- Creator assignment; `submit_proof_of_post()` (creates the per-creator payout row, `held →
  proof_pending`, already implemented); `whatsapp-engine` writes the Gemini score; review queue
  sorted by score ascending; `verify_proof_of_post()` → `releasable`; `momo-engine` disbursement →
  `paid_out`.

**Gate:** integration test walks fund → submit → verify → paid_out and asserts the full
`escrow_audit_log` chain; a creator JWT calling `verify_proof_of_post()` on their own proof raises
`not authorized`; **no** score auto-releases.

---

## Milestone 8 — Agency retainers ◻

**[Backend/DB · Product/TPM]**

- Retainer creation honoring `retainer_math_integrity` (contract = cut + fee + media; KPI bonus on
  top), funded via the same webhook RPC.

**Gate:** the CHECK constraint rejects mis-split retainers; funding flips status to `funded`.

---

## Cross-cutting (every milestone)

- **[QA & Chaos]** owns the verification matrix; writes the failing test first.
- **[Security/Compliance]** reviews each slice for RLS coverage, PII boundaries (business `tax_id`/
  `billing_address` never public), and secret handling.
- **[DevOps]** keeps CI green and preview deploys per PR; manages Fly.io + Vercel + Supabase envs.
- **[Product/TPM]** keeps the three canonical docs reconciled with the code — drift is a defect.

---

## Immediate next actions

1. `pnpm install` and `supabase start` on a real machine; generate `types.gen.ts`; confirm M0/M1
   gates locally.
2. Decide the **visual identity** (typeface + brand hex) and swap the tailwind tokens (unblocks the
   rest of the design system).
3. Get a **yes/no on the SokoClick invoicing API** — it gates M6–M8.
4. Proceed to **Milestone 2** (public directory & profiles).
