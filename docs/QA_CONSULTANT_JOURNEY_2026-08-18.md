# Bayele — Consultant Journey QA & Production-Readiness

**Date:** 18 August 2026 · **Scope:** the consultant persona end-to-end — profile creation (onboarding), profile management + CRUD, the dashboard, retainers, and talent search. This pass also uncovered a database gap that affected **all roles**, including business.

## Verdict

The consultant-specific surfaces were largely correct — specialties/years/bio/city/country round-trip cleanly, `tax_id` is never read on a consultant path (so the 0018 lockdown doesn't 403), and the retainer flow is correctly view-plus-decline. But the audit surfaced two real blockers that would surface in a live session, both now fixed and verified against the live database.

## Blockers found and fixed

**A missing self-read policy locked business users out entirely (critical, all-roles).** `profiles` had only one SELECT policy — "public profiles are readable" (active creators/consultants). There was **no policy letting a user read their own row** when it isn't an active creator/consultant. Verified live: a `pending_review` user and *every business user* got zero rows back from `getSession()`'s own-profile read. Consequences: a newly-onboarded (pending) consultant was bounced back to the signup form instead of the "under review" screen, and a **business user was looped into onboarding forever — locked out of their dashboard**. It also silently defeated the active-status gate added in the previous pass. Fixed in **migration 0019** with an additive `FOR SELECT USING (auth.uid() = id)` policy. Verified live: pending and business users now read their own profile (1 row each); the anon directory is unchanged.

**Consultants couldn't see which brand a retainer was from.** Both the consultant dashboard and retainers page embed the counterparty business name, but business profiles aren't publicly readable, so PostgREST filtered the embed to null and the UI always showed the generic "Marque". Fixed in 0019 with a scoped policy letting the two parties of an `agency_retainer` read each other's profile (no recursion — the retainer table's own policy is party-or-admin). Verified live: the consultant now reads the real business name ("Marque Test SARL") through the existing embed — no UI change needed.

**Decline didn't refresh the list.** `declineRetainerAction` runs on the retainers page but only revalidated `/consultant/dashboard`, so a declined retainer kept showing (with its Decline button) until a manual reload. Fixed: it now revalidates `/consultant/retainers` as well.

## Verified clean (no change needed)

Specialties + years_experience round-trip fully (written by onboarding, read + prefilled + updated in the profile editor), alongside the shared fields (display name, city, country, bio). `agency_access` and `tax_id` are correctly system/admin-managed — not in the editor, pinned by the write-guard, and `tax_id` is never read by consultant code. The retainer flow is correctly scoped: the consultant views and can decline (`transition_retainer('terminated')`, party-authorized in the RPC); proposing/invoicing are business-side only. Retainer status labels cover all six states; empty states and pending disable-states are handled.

## Deferred / product decisions (documented, not blockers)

Talent search is open to any active consultant and is **not** gated on `agency_access`. That matches the spec's intent loosely, but crucially there is **no admin path to grant `agency_access`** yet — so gating talent search on it would lock every consultant out of the creator directory. Left open until an admin grant flow exists; the dashboard "Agence" badge simply never shows in the meantime (harmless). The decline control intentionally omits terminating an already-`active` retainer (a consultant shouldn't unilaterally abandon a live mission), even though the state machine would allow it.

## Change set

Migration **0019** (applied + verified live; rollback + MANIFEST written) adds the two SELECT policies. One app file — `consultant/actions.ts` — fixes the decline refresh. No new RPC or type changes. The `profiles` self-read policy is the important one: it makes the whole business persona usable and makes the previously-added status gates behave correctly.
