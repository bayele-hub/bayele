---
name: bayele-build
description: >-
  End-to-end engineering playbook for the Bayele platform — the mobile-first
  creator/consultant/business escrow marketplace for Francophone Africa (Cameroon,
  Côte d'Ivoire, Gabon) built on Next.js 15 + Supabase + Fly.io, with SokoClick OHADA
  invoicing, Mobile Money payouts, and Gemini-assisted Proof-of-Post review. Use this
  whenever building, extending, reviewing, or QA-ing any part of Bayele: database
  migrations and RLS, the escrow state machine, the SokoClick webhook, the public
  marketplace and auth funnel, role dashboards, notifications, or the WhatsApp/MoMo
  engines. It defines the agent roles to assume, the architecture invariants that must
  never be violated, the canonical documents, the build order, and the verification
  gates that decide when work is actually "done."
license: Complete terms in LICENSE.txt
---

# Bayele — Build & QA Playbook

Bayele is an **escrow-secured marketplace** connecting three paying/earning actors in
Francophone Africa: **Nano-Creators** (who post paid WhatsApp Status / TikTok content),
**Agency Consultants** (who manage campaigns and query the creator database), and
**Businesses/Brands** (who fund campaigns). A fourth actor, the **Super Admin**, moderates
and oversees payouts. Money moves through a Postgres-native escrow state machine; invoices
are issued OHADA-compliant via SokoClick; payouts land on MTN MoMo, Orange Money, or Wave;
and every "proof of post" is scored by Gemini but **released by a human**.

This document is the operating manual for building it. Read it before writing code, and
return to the **Architecture invariants** and **Verification gates** sections before
declaring anything finished.

---

## 1. Canonical sources — read these first, in this order

| Order | Document | What it owns | Authority |
|---|---|---|---|
| 1 | `bayele-tech-stack-v1.md` | Phase-1 foundation: stack choices, monorepo layout, RBAC intent, notifications design, auth stance | Foundational; **superseded by the production spec wherever they overlap** |
| 2 | `bayele-production-spec-v1.1.2.md` | **Canonical** four-actor schema, RLS, escrow state machine, SokoClick webhook, Gemini PoP, verification matrix | **Wins every conflict** |
| 3 | `bayele-home.md` | Public web surface: home/directory, unified auth funnel, legal hub, mobile-first & security matrix | UI reference; must stay in step with the spec's routes and RLS |

**Rule of precedence:** on any disagreement, `bayele-production-spec-v1.1.2.md` is the source
of truth. If you change an invariant in one place, change it everywhere and note it in a QA
changelog — silent drift between these three documents is itself a defect.

---

## 2. The agents — roles to assume

Bayele is built by a small set of specialist agents. For any task, **assume the narrowest
role(s) that own it**, do the work to that role's standard, and hand off explicitly. When a
task spans roles (most do), state which roles you are wearing and why.

### Leadership & strategy
- **CTO & Systems Lead** — final technical authority; guards the architecture invariants in §3, approves anything that touches money movement or the trust model.
- **Principal Systems Architect & CSO** — owns the four-actor model, monorepo topology, and the "phase now / phase later" scoping; decides what is provisional (e.g. the SokoClick dependency) vs. committed.
- **Principal UX Architect & Head of Growth** — owns the sign-up → activation funnel, the "view then sign up with intent" flow, and directory discoverability (SEO + WhatsApp share).

### Domain & field
- **Principal Mobile UX Architect & Lead Field Systems Engineer** — owns real-device behavior on mid-range Android over 3G/4G in Douala, Abidjan, Libreville: payload budget, tap targets, offline/poor-connection states, MoMo/OM/Wave affordances.
- **Product Lead & TPM** — owns the build order (§4), keeps the three docs reconciled, runs the verification matrix as the definition of done.

### Core engineering
- **Principal Backend & Database Systems Engineer** — owns migrations, RLS, and every `SECURITY DEFINER` function; **`transition_escrow()` is this role's crown jewel** and the only function permitted to move escrow status.
- **Principal Frontend & Design Systems Architect** — owns the Next.js App Router surface, the `packages/ui` primitives, server components/actions, and the design system in §6.
- **Full-Stack Engineer (cross-domain)** — executes vertical slices end-to-end (route → server action → RPC → RLS) when a feature doesn't warrant a specialist handoff.
- **Principal AI Systems Architect & ML Lead (Gemini)** — owns the Gemini 2.5 Flash Proof-of-Post verifier: the structured-output schema, the prompt, and the scoring — **but never auto-release**; the score is a queue-priority signal only.

### Operations & reliability
- **DevOps & SRE** — owns Vercel (web), Supabase Cloud (data), and Fly.io (Paris region: `momo-engine`, `whatsapp-engine`); CI/CD, preview deploys, secrets, and the Google AI credential for Gemini.
- **Lead Security, Cryptography & Compliance Engineer** — owns webhook signature verification, secret handling, RLS as the real RBAC boundary, PII boundaries (business `tax_id`/`billing_address` never public), and OHADA/CEMAC/UEMOA compliance.
- **QA & Chaos Engineering Lead** — owns E2E suites and the adversarial tests ("fire the webhook twice," "self-approve your own proof"); **signs off the verification matrix**. Nothing ships "PASSED" until this role has run it against staging.

---

## 3. Architecture invariants — never violate these

These are the load-bearing decisions. Breaking one is a release-blocking defect regardless of
how green the feature looks.

1. **RLS is the RBAC boundary, not middleware.** Next.js middleware and route groups control
   *what UI a role sees*; Postgres RLS controls *what data any request can touch*, even if the
   client hits Supabase directly. Every table gets RLS **and at least one policy** — RLS enabled
   with no policy is deny-all and will silently break reads (this exact bug killed the public
   directory in v1.1.1; see spec §0.1 #B).
2. **`transition_escrow()` is the only mutator of `escrow_transactions.status`.** Every hop is
   validated against the allowed-transition table and writes one `escrow_audit_log` row. There is
   no legal way to move money that isn't logged. Never `UPDATE ... SET status` directly.
3. **`SECURITY DEFINER` functions must carry their own authorization check.** They bypass RLS, so
   the guard inside them is the only thing left. `verify_proof_of_post()` must confirm the caller
   is the campaign owner or an admin; `submit_proof_of_post()` must confirm the caller is the
   assigned creator. Passing `p_actor` is not authorization unless the caller cannot spoof it.
4. **Proof of post is scored by Gemini, released by a human.** The confidence score only sets
   queue priority (low-confidence surfaces first). No score auto-transitions escrow toward release.
   Revisit only with real false-positive data on WhatsApp-Status screenshots specifically.
5. **Financial writes are atomic and idempotent.** The SokoClick webhook does exactly two things:
   verify the signature, then call **one** RPC (`handle_sokoclick_invoice_paid`). The RPC checks
   `provider_ref` / `sokoclick_invoice_id` for a prior run before doing anything. A redelivered
   webhook is a no-op; a 500 is safe to retry.
6. **Phone number is the canonical identity and the payout key.** Auth is keyed on E.164 phone
   (verified before an account can transact). Email is secondary and, for businesses, only an
   invoice contact (`business_profiles.billing_email`).
7. **The public directory lists Creators and Consultants only.** Businesses are B2B clients you
   sign up for, never browse. `business_profiles` (with `tax_id`, `billing_address`) is owner+admin
   only — no public SELECT, ever.
8. **Currency follows the monetary union, not the word "FCFA."** Cameroon & Gabon = **XAF** (CEMAC);
   Côte d'Ivoire = **XOF** (UEMOA). They are distinct ISO codes and must never be mixed on one
   invoice, even though both are colloquially "FCFA."
9. **Platform fee is set once, at campaign creation, by tier** (`platform_fee_rate` ∈ {0.10 Spark,
   0.15 Managed, 0.25 Agency}) and **read** at funding time — never re-derived or guessed in the
   webhook.
10. **Mobile-first is a hard budget, not a vibe.** First-load target under ~90KB gzip; 48×48px tap
    targets; zero layout shift on poor connections; server-rendered first page of every directory
    (never a client fetch from an empty state).

---

## 4. Build order (end-to-end)

Ship in vertical slices, each gated by its verification row in §5 before moving on. This order
gets a real, gated, money-moving marketplace live without building phase-2 surface area first.

1. **Foundation** — Turborepo + pnpm scaffold; Supabase project; the full migration (§3.1 of the
   spec) including `notifications`; **all** RLS policies including the public-read policies for
   `creator_profiles` / `consultant_profiles`; `is_admin()`, `transition_escrow()`.
2. **Public marketplace shell** — home/landing + live directory, creator/consultant directories
   and public profiles, legal hub. Server-rendered, no auth. Verify the anon directory query
   returns active profiles (proves invariant #1 and #7).
3. **Auth funnel** — phone + password via Supabase Auth (OTP as passwordless/recovery), role
   dispatcher (creator / consultant / business), onboarding → `status = pending_review`. Root-level
   `middleware.ts` enforcing route gates.
4. **Admin** — approve/reject profiles (the moderation gate before public listing), user list,
   escrow ledger view, disputes.
5. **Authenticated shell + notifications** — shared `(app)/layout.tsx` with the notification bell
   wired to Supabase Realtime on `notifications`; unread count via the partial index; seed with
   `profile_approved` / `profile_rejected`. All emits go through the single `notify()` helper.
6. **Business workspace + funding** — company profile, self-serve campaign creation (sets
   `platform_fee_rate` by tier), SokoClick invoice creation, and the **webhook → one RPC** funding
   path. Provisional on the SokoClick API dependency — see spec header.
7. **Campaign execution & escrow loop** — creator assignment, `submit_proof_of_post()`
   (creates the per-creator payout row, `held → proof_pending`), Gemini scoring feed, the review
   queue, `verify_proof_of_post()` → `releasable`, and `momo-engine` disbursement → `paid_out`.
8. **Agency retainers** — retainer math-integrity contracts, funded via the same webhook RPC.

Phase-2 surface (WhatsApp webhook engine depth, advanced agency tooling, native push) sits on top
of this and is deferred deliberately.

---

## 5. Verification gates — the real definition of "done"

Adopt the spec's discipline: **nothing is "PASSED" until it has run against a live staging system.**
"Implemented on paper" is a starting point, not a finish line. For each slice, write the failing
test first, confirm it fails, then confirm the fix passes it.

Non-negotiable gates before any money-path slice ships:
- **Idempotency:** fire the same SokoClick payload twice → exactly one escrow row, no partial state.
- **State machine:** every legal `transition_escrow()` hop succeeds, every illegal hop raises, each
  writes exactly one audit row; two concurrent transitions on one row serialize (the `FOR UPDATE`).
- **Self-approval guard:** a creator JWT calling `verify_proof_of_post()` on their own proof raises
  `not authorized`; the campaign owner succeeds.
- **Public-directory RLS:** an anon JWT reads active creator/consultant profiles; a `pending_review`
  profile is invisible; `business_profiles` is never readable by anon or by other users.
- **RBAC:** `is_admin()` returns false for a non-admin JWT (test the negative first — the v1.1.0
  `WHERE user_id = user_id` bug always returned true).
- **Currency:** a CI business yields an `XOF` invoice; CM/GA yields `XAF`.
- **Mobile:** verify on real 360–414px viewports over throttled 3G, not just a desktop resize.

The QA & Chaos Engineering Lead owns this table and signs it off. If SokoClick's invoicing API is
still unconfirmed, the invoicing rows stay **BLOCKED**, not "designed and assumed working."

---

## 6. Frontend & design standard

Bayele must not look templated. Approach the UI as the design lead at a studio known for giving
each client an identity that couldn't be mistaken for anyone else's. Ground every choice in the
subject: Francophone-African mobile commerce, WhatsApp-status culture, Mobile-Money trust cues.

- **The hero is a thesis.** Open with the most characteristic thing in Bayele's world (paid status,
  secured escrow, instant MoMo), not a generic big-number-with-gradient template.
- **Typography carries the personality.** Pair a characterful display face (used with restraint)
  with a clean body face and a utility/data face. Set a deliberate type scale. On low-end Android,
  lead with a system-native stack for zero-layout-shift first paint, then enhance.
- **Structure encodes meaning.** Numbering, eyebrows, dividers should reflect something true (an
  actual escrow sequence, a real process) — not decorate. Question `01 / 02 / 03` markers unless the
  content genuinely is an ordered sequence.
- **Spend boldness in one place.** Pick one signature element to be memorable; keep everything else
  quiet and disciplined. Motion serves the subject or it's cut — scattered effects read as
  AI-generated. Respect `prefers-reduced-motion`, visible keyboard focus, and full responsiveness as
  a quality floor, not a feature.
- **Copy is design material.** Active voice, sentence case, plain verbs. Name things by what people
  control ("MoMo number," "Launch a campaign"), never by system internals. An action keeps its name
  through the whole flow: a button that says *Valider mon Inscription* leads to a confirmed state, not
  a vague "submitted." Errors explain what happened and how to fix it, in the interface's voice.
- **Watch CSS specificity.** Type-based (`.section`) and element-based selectors can cancel each
  other's padding/margins. In Tailwind, use only real utilities — invalid classes like `py-0.2` or
  `active:scale-98` do nothing (both were found and fixed in the QA pass; valid forms are `py-0.5`,
  `active:scale-95`).
- **French-first, franco-African register.** The product ships in French (CGU, Séquestre,
  Créateur, Marque). Keep terminology consistent with the legal hub and the schema.

Plan → critique → build → critique again. Before showing work, ask whether a similar prompt would
produce the same thing; if so, it's a default, not a choice — revise it.

---

## 7. Working conventions

- **One Next.js 15 app, role-separated by route groups + middleware** — not one app per role. Server
  components for public pages (fast first paint), server actions instead of a bespoke API layer for
  most mutations.
- **Money and state changes go through Postgres functions (RPC), not multi-call client sequences.**
  If a flow touches more than one table and must be consistent, it belongs in one `SECURITY DEFINER`
  function called once.
- **Notifications have a single write path** (`packages/notifications` `notify()` / triggers).
  Never insert into `notifications` ad hoc from a component.
- **Secrets** (`SOKOCLICK_*`, `SUPABASE_SERVICE_ROLE_KEY`, Gemini key) live in the platform env,
  never in the repo; the service-role key is server-only.
- **Webhook endpoints validate signatures in every environment** — a check that only runs in prod
  is not a check. Test against a real signed payload in staging.
- **Keep the three canonical docs reconciled.** A schema, route, or fee change lands in the spec
  first, then the tech-stack/home docs and code follow. Note drift in a changelog.

---

## 8. Open dependencies & known risks (carry these forward)

- **SokoClick invoicing API is unconfirmed.** Everything downstream of `packages/sokoclick-sdk` is
  provisional. If SokoClick doesn't expose `/v2/invoices`, Bayele needs either a scoped API added to
  SokoClick or its own lightweight OHADA-invoice generator — decide before committing to the webhook
  funding path in build step 6.
- **Business email sourcing.** `business_profiles.billing_email` is the invoice contact of record;
  ensure onboarding collects it, since `profiles` stores phone only.
- **Auto-release is deliberately off.** Only revisit with real Gemini false-positive data on this
  specific screenshot domain.
- **Duplicate/stale files.** Keep exactly one tech-stack file and one production-spec version as
  canonical; archive superseded copies rather than leaving ambiguous duplicates in `docs/`.
