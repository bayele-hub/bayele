# Bayele — Mobile-First QA Audit + RBAC E2E Verification

**Date:** 18 August 2026 · **Scope:** UI/UX mobile audit (360–414px, mid-range Android) with surgical remediation, followed by an end-to-end RBAC verification that every persona can sign up, configure their account, and go live. Roles assumed per SKILL.md §2 (Principal Mobile UX Architect, Head of Growth, Lead Security).

---

## 1. Summary

Two parallel audits swept every surface — public landing + directory + profiles + auth/onboarding, and the four signed-in role workspaces plus the shared shell and design tokens — against the mobile invariant (SKILL.md §3 #10: 48px tap targets, no layout shift, server-rendered first paint, ~90KB budget). Thirty-plus concrete defects were found and remediated across 29 files. The most consequential were systemic and are now fixed once at the root: iOS zoom-on-focus, missing safe-area insets on fixed bars, and the core directory funnel not being tappable. Separately, the RBAC "signup → configure → go live" path was verified end-to-end against the live database — the directory visibility boundary, the pending→active moderation gate, business exclusion, and the admin authorization negative all behave correctly.

No competitor-parity features were in scope here; this was a correctness-and-usability pass on what exists.

---

## 2. Mobile UI/UX — findings & fixes

### Systemic (fixed once, whole-app impact)

**iOS zoom-on-focus / small input text.** Nearly every form control used 12–14px text, which makes iOS Safari zoom the viewport on focus and reflow the page, and is hard to read on mid-range Android. Fixed globally in `globals.css`: below the `sm` breakpoint, all `input`/`select`/`textarea` are pinned to 16px. One change neutralizes the zoom on every form in the app (auth, onboarding, campaign/retainer creation, profile, all admin queues).

**Safe-area insets on fixed bars.** The per-role bottom nav and the sticky headers had no `env(safe-area-inset-*)` padding, so on gesture-nav/notched Android the bottom row of the primary nav sat under the system gesture bar. Fixed by enabling `viewport-fit=cover` (root viewport export), adding `.pb-safe`/`.pt-safe` utilities, and applying them to the bottom nav and the app/public/legal headers.

### Core funnel & directory

**Directory cards weren't tappable.** The "view then sign up" funnel depended on a ~20px inline text link while the card body — the obvious tap target — did nothing. Reworked `talent-cards.tsx` so the entire creator/consultant card is the link (a 48px+ hit area), with the "Voir le profil" affordance demoted to a visual cue.

**Filter chips below 48px.** Country/category filter chips on the directory (`directory-view.tsx`), the home category rail, the onboarding category multi-select, the consultant talent-search filters, and the admin users filter were all ~30px tall. All raised to `min-h-tap` (48px).

**Profile-hero CTAs cramped.** On creator/consultant public profiles the "Inviter / Message / Hire" buttons stayed side-by-side on mobile, wrapping the long French labels into uneven boxes. Now stack full-width on mobile, inline on `sm+`.

### Workspaces

**Dashboard stat tiles clipped large FCFA amounts.** The creator and consultant dashboards used a 3-column stat grid (~77px cells) with no truncation, so 7-digit earnings overflowed. Switched to `grid-cols-2 sm:grid-cols-3` with `truncate tabular-nums` and a `title` tooltip carrying the full value.

**Wrong mobile keyboards.** The profile Mobile-Money number, billing email, and website fields, plus the FCFA amount fields in campaign/retainer creation, opened the default text keyboard. Added the correct `type`/`inputMode` (`tel`/`email`/`url`/`numeric`) and `autoComplete` so the right keypad appears.

**Short tap targets in admin/business action rows.** Inline inputs and selects in the funding, payout and refund queues, the proof-reject form's cancel, and various row controls were ~32px tall. Raised to `min-h-tap`.

**Overflow from long handles.** User/moderation/applicant meta rows rendered `@handle · city · country` without truncation, so a long handle pushed horizontal overflow inside the card. Added `min-w-0` + `truncate` on the handle and `shrink-0` on the trailing chips/badges.

**Secondary controls.** Language switcher (28px → 48px), footer legal links, legal-page table-of-contents tabs, and the notification "mark all read" control were all brought to 48px.

### Build-safety fix

**Auth page Suspense boundary.** The `/auth` page reads `useSearchParams()` in a client component with no Suspense wrapper — a Next 15 build hazard that also caused a signup→signin flash for users arriving via `?mode=signin`. Wrapped the inner form in `<Suspense>` with a spinner fallback.

All 29 changed files passed a strict static type review against the pinned Supabase SDK types (no `tsc --noEmit` / `next build` errors).

### Consciously deferred (low severity)

Explicit `<label htmlFor>`/`id` associations across form fields (accessibility nicety, not a functional break) and a handful of 11px non-interactive labels were left as-is to keep this pass surgical.

---

## 3. RBAC end-to-end verification (live database)

Every check ran against the live Supabase project with negatives-first, in rolled-back transactions (seed left intact at 13 profiles). The directory RLS policy is `status='active' AND role IN ('creator','consultant')` — the RBAC boundary lives in the data tier, exactly per invariant.

| Check | Expected | Result |
|---|---|---|
| Anon sees only active creators/consultants | 12 (8 + 4); admin excluded | ✅ 12 |
| Creator set to `pending_review` disappears from directory | 11 | ✅ 11 |
| Admin `moderate_profile` → `active` (go live) restores visibility | 12 | ✅ 12 |
| A `business`-role profile never appears in the public directory | 11 | ✅ 11 |
| `is_admin` for a creator | false | ✅ false |
| `is_admin` for the admin | true | ✅ true |

The post-auth dispatcher (`/dashboard`) routes correctly for the full lifecycle: no session → `/auth`; no profile → `/onboarding/<role from signup metadata>`; `pending_review` → the "under review" screen; `active` → the role's dashboard (admin / business / consultant / creator). Onboarding creates every profile as `pending_review`, so no persona goes live without an admin approval.

**Verdict per persona.** Creator and consultant: sign up → onboard (pending, hidden) → admin approves → appear in the public directory (go live). Business: sign up → onboard (pending) → admin approves → access the business workspace (businesses are B2B and intentionally never listed in the public directory, per invariant §3 #7). Admin: routed to the console; `is_admin` gate verified. All paths function correctly; **no RBAC defects found** — the authentication/authorization spine is sound.

The two operational blockers from the prior review still stand and remain on your side: set the Supabase Auth **Site URL to `https://bayele.com`** (fixes the confirmation-email localhost redirect so new signups complete) and enable **leaked-password protection**.
