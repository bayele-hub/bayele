# Bayele — Creator Journey QA & Production-Readiness

**Date:** 18 August 2026 · **Scope:** the creator persona end-to-end — profile creation (onboarding), profile management + CRUD, the dashboard, wallet, and the apply/proof execution loop. Includes a regression check that the migration-0018 PII reroute didn't break the profile round-trip.

## Verdict

No hard production blocker remained. The riskiest recent change — reading Mobile-Money settings through the `get_my_payout_settings()` RPC after the 0018 column lockdown — is implemented correctly on both the read and write paths, verified live: a full profile update (city, country, momo phone/provider) writes and reads back through the RPC, and the socials editor's add/edit/remove round-trip works. The gaps found were state-gating, CRUD completeness, and input hardening; all are fixed below.

## Verified clean (no change needed)

The 0018 reroute is correct — `profile`, `creator/dashboard`, and `creator/wallet` read momo via the definer RPC, the momo write stays `return=minimal` (no read-back, so no permission error), and no query still selects the locked columns directly. Onboarding surfaces every RPC error code (handle taken/format, profile exists, missing fields). The socials editor round-trips fully, including removal (clearing a URL drops that network). Empty/null states don't crash, and submit buttons disable while pending. Handle is intentionally immutable after signup.

## Gaps found and remediated

**Status gate on the role workspaces (the one real correctness gap).** The creator/consultant/business layouts gated on *role* only, so a `pending_review`, `suspended`, or `rejected` user could reach the live dashboard/wallet by typing the URL — contradicting the "under review" screen the dispatcher shows. Server-side actions still blocked them (RLS + `profile_not_active`), so it was a broken state gate, not a data hole. Fixed: each role layout now redirects a non-active profile to the dispatcher (admins bypass).

**`country` was create-but-not-editable (CRUD gap).** Onboarding saved a creator's country but the profile editor never exposed it. Added a country selector to the profile form, wired it into the prefill, and persist it (validated against the enum) on save.

**Mobile-Money number stored raw (payout-safety).** The payout field wrote whatever was typed — spaces, local formats — straight into the `*_e164` column that disbursements read. Added server-side normalization to E.164 (strips spaces/dashes) with validation; a malformed number is now rejected with a clear field error instead of being saved.

**Unmapped escrow errors on proof submission.** `submitProofAction` didn't map the `campaign_not_funded` / `escrow_pool_exceeded` codes that the hardened `submit_proof_of_post` can raise, so a funding shortfall showed a generic "try again" and the creator would retry forever. Both now map to actionable copy directing the creator to the brand.

**No "get paid" nudge.** A creator could complete missions without realizing they'd never set a payout number. Added a dashboard banner (shown only when no Mobile-Money number is configured) linking to the profile editor.

## Deferred (documented, not a blocker)

Avatar upload: `avatar_url` is accepted by the schema and the public profile falls back to initials, but no creator surface collects a photo. A proper implementation needs a Supabase Storage bucket + policies + an upload widget; shipping a raw-URL text field would be poor UX, so this is left as a tracked follow-up rather than a stopgap. The public profile remains fully functional with initials in the meantime.

## Change set

Eight app-layer files (no DB migration this turn): the three role layouts (status gate), `creator/actions.ts` (escrow error mapping), `creator/dashboard` (payout RPC + nudge), and the profile `page`/`form`/`actions` (country CRUD + momo normalization). All passed a strict static type review; the create/update round-trip was verified against the live database (seed intact).
