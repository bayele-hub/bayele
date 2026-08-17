# Bayele — Development Plan

**Standard:** FAANG-grade. Every milestone ships as a vertical slice (route → server action → RPC →
RLS), is test-first, and is not "done" until its verification gate passes against staging — never
self-certified (production spec §8). Roles in brackets are the `docs/SKILL.md` §2 agents to assume.

**Locked decisions:** unified `/auth` route · phone + password identity · four-actor model ·
canonical spec = `bayele-production-spec-v1.1.2.md`.

**Legend:** ✅ done in this pass · ◻ planned.

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
