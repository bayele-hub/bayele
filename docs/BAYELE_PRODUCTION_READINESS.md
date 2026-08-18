# Bayele — Production Readiness & Competitive Benchmark

**Date:** 18 August 2026 · **Prepared for:** Claire · **Scope:** launch-readiness review of the Bayele escrow marketplace (web app + Supabase backend), benchmarked against Fiverr and the closest creator-marketplace competitor, Collabstr.

---

## 1. Executive summary

Bayele is an escrow-secured influence-marketing marketplace for Francophone Africa (Cameroon, Côte d'Ivoire, Gabon) connecting nano-creators, agency consultants and brands, with Mobile Money payouts and OHADA invoicing. As of this review the **core money loop is built and verified end-to-end**: a brand funds a campaign, funds are held in escrow, creators execute and submit proof, proof is human-verified, and payouts are released — every state change flowing through a single audited escrow state machine.

The verdict is that Bayele is **functionally launch-capable for a supervised (concierge) beta**, and close to a fully self-serve launch. The engineering work in this review closed the last two categories of hard blockers I found in the code and database: three critical privilege-escalation holes at the data tier, and the fact that escrowed money could never be returned to a brand. Both are now fixed and verified against the live database. What remains before an unsupervised public launch is a short list of **operational configuration items that only you can complete** (they require dashboard credentials I should not enter on your behalf) plus a set of clearly-scoped v2 features that are safe to defer.

The competitive picture is favourable: Bayele's escrow-on-approval model matches the best-in-class creator marketplace (Collabstr) while adding the two things those platforms do badly for this region — **Mobile Money rails and OHADA-compliant invoicing** — which is the defensible wedge.

---

## 2. Competitive benchmark

### 2.1 Head-to-head

| Dimension | **Bayele** | **Fiverr** | **Collabstr** |
|---|---|---|---|
| Primary market | Francophone Africa (CM · CI · GA) | Global (US/EU-centric) | Global (US-centric) |
| Category | Influence marketing, escrow | General freelance services | Influencer marketplace |
| Platform fee | **10% / 15% / 25%** platform rate, set once per campaign at creation | 20% seller commission **+** 5.5% buyer fee (min $2) | 10% brand fee (5% premium) **+** 15% creator payout fee |
| Escrow model | Held on funding → released on **human-verified proof of post** | Held, released after delivery + clearing period (2–14 days by seller tier) | Held from agreement → released on brand approval |
| Payments | **MTN MoMo, Orange Money, Wave, Airtel, bank wire** (Mobile Money-first) | Card / PayPal / Payoneer | Card / Stripe |
| Payout to creator | Mobile Money disbursement | Bank / PayPal / Payoneer (min thresholds, withdrawal fees) | Stripe / PayPal |
| Invoicing / tax | **OHADA invoices** via SokoClick | Generic invoice | US-style receipt |
| Verification | **Gemini proof-of-post scoring + human release** | Reputation / reviews | Manual brand approval |
| Agency layer | **Yes** — consultant retainers (contract value, media budget, KPI bonus) | No | No |
| Language | French-first UI | English-first | English-first |
| Mobile posture | **Mobile-first, ~95% mobile users assumed** | Responsive, desktop-heavy | Responsive |

*Fee and escrow figures for Fiverr and Collabstr are their publicly published 2026 terms (sources below); Bayele figures are from the implemented schema.*

### 2.2 Where Bayele wins

The decisive advantages are structural, not cosmetic. Fiverr and Collabstr both settle in cards/PayPal/Stripe — payment rails with thin penetration and high friction in Cameroon, Côte d'Ivoire and Gabon, where Mobile Money is the dominant consumer wallet. Bayele settling **into and out of MTN MoMo, Orange Money and Wave** removes the single biggest reason a nano-creator in Douala or Abidjan cannot currently get paid by a global platform. Layered on top, **OHADA-compliant invoicing** makes Bayele usable by formally-registered brands and agencies who need a compliant paper trail — something neither competitor provides for this jurisdiction. The **agency-consultant retainer layer** is also a genuine product surface neither Fiverr nor Collabstr offers, opening a higher-value B2B revenue line beyond per-campaign fees.

### 2.3 Where the competitors are still ahead (the honest gap list)

Fiverr and Collabstr have years of accreted surface that Bayele has not yet built, and it is worth being clear-eyed about it. The most material gaps, in rough order of how much they matter for launch, are: **in-app messaging** between brands and creators (both competitors have rich threaded messaging; Bayele currently drives contact through signup and has no direct-message system); a **ratings-and-reviews engine that actually computes reputation** (Bayele stores a `rating_avg` field but nothing writes to it yet — see §5); **dispute tooling as a first-class workflow** (Bayele now has the money mechanics for refunds and disputes, but not yet a full evidence-and-arbitration UI); and **self-serve creator payout configuration and Pro subscriptions** (the Pro tier exists in the schema but has no purchase-to-activation path). None of these are blockers for a supervised beta, and each is scoped in §5 and §6.

---

## 3. What is production-ready today

The spine of the product is complete and has been exercised against the live database with negatives-first tests (i.e. every guard was proven to *block* before any happy path was accepted).

The **escrow money machine** (`transition_escrow`) is the sole mutator of escrow state, is `SECURITY DEFINER` with its own authorization, and writes an immutable `escrow_audit_log` entry on every transition. Around it, the complete campaign lifecycle works end to end: onboarding and admin moderation of profiles; campaign creation as a draft; admin-confirmed Mobile Money funding that moves the campaign pool into escrow and publishes the campaign; creator application and brand approval; proof-of-post submission that earmarks a per-creator payout; human review that makes a payout releasable; and admin-confirmed disbursement that pays the creator and completes the campaign. The **agency retainer flow** (propose → invoice → fund → activate → transition) is likewise implemented over the same audited primitives.

The **four role workspaces** — admin console, creator, consultant and business — are built mobile-first with 48px tap targets, server-rendered first paint, and a scrollable section nav, consistent with the ~95%-mobile assumption. Access control rests on Postgres Row-Level Security as the authorization boundary, with privileged operations exposed only through `SECURITY DEFINER` RPC façades that each re-derive the actor from `auth.uid()`. Seventeen timestamped, individually-rollbackable migrations are under version control with a `MANIFEST.sha256` integrity file. The public marketing site now has SEO metadata, Open Graph / Twitter share cards for WhatsApp previews, a dynamic sitemap, a branded 404, and a mobile navigation row.

---

## 4. Hardening completed in this review

Two categories of launch-blocking defects were found by a database-and-UI audit and have been remediated and verified this session.

**Migration 0016 — column write-guards (critical security).** The "manage your own row" RLS policies gated *which row* a user could write but not *which columns*. Via a direct PostgREST write a user could therefore escalate privileged columns: self-approve their profile (bypassing moderation), self-publish a campaign or tamper with its platform fee (bypassing escrow custody), and self-grant Pro status or inflate their own rating. This is now closed at the data tier by `BEFORE INSERT/UPDATE` guard triggers that pin those columns to their safe values whenever the writer is a direct API role, while letting the legitimate `SECURITY DEFINER` RPCs (which run as the table owner) through untouched. Verified live: as an authenticated user, attempts to set `profiles.status='active'`, `creator_profiles.is_pro=true` and `campaigns.status='published'` were all silently no-ops, while the admin `moderate_profile` RPC still changed status correctly. Seed data left intact (13/13 profiles).

**Migration 0017 — campaign cancel & escrow refund (critical money-safety).** The escrow state machine already permitted the `held → refunding → refunded` and dispute paths, but no code ever drove them — meaning a funded campaign's money could **never be returned to the brand**. Two audited façades now close this: `cancel_campaign` lets a brand (or admin) self-cancel an *unfunded* campaign, refusing the moment any escrow exists; and `admin_refund_campaign` unwinds a funded campaign — releasing every in-flight creator earmark, refunding the campaign pool to the brand, marking un-fulfilled creators, cancelling the campaign, and notifying the brand — all through `transition_escrow`, so the full audit trail is preserved. For safety it refuses partial refunds once any creator has been paid out (that accounting is a documented v2 item). Verified live with a full funded-campaign fixture: the happy path produced `inbound=refunded, outbound=refunded, campaign=cancelled` with the audit trail intact, and every negative (non-admin, partial-payout, non-owner, cancel-while-funded) raised the correct error. All test fixtures rolled back; seed intact.

Alongside the database work, the web app gained **resilience and correctness fixes**: route-level `error.tsx` and `loading.tsx` boundaries across the app, public and auth route groups plus a root `global-error.tsx` (no more white-screens on a runtime error); a corrected notification bell that no longer renders dead `#` links; contextual continuity on the public "Invite / Message / Hire" calls-to-action so they carry intent and a safe return path through signup instead of dead-ending; and an admin **Litiges & remboursements** console plus a business-side self-serve cancel control wiring the new refund/cancel RPCs into the UI. All new and edited files passed a strict static type review against the pinned Supabase SDK types.

---

## 5. Remaining launch blockers (owner action required)

These are the items standing between the current state and a fully self-serve public launch. They are configuration and credential tasks that I deliberately did not perform, because they require entering account credentials or provisioning secrets — actions that must stay in your hands.

**Supabase Auth Site URL / redirect configuration.** Confirmation emails currently redirect new users to `localhost` instead of `bayele.com`. The application code and the Terraform definition already carry the correct `bayele.com` configuration, but it has not been applied to the live Auth settings. This must be set in the Supabase dashboard (Authentication → URL Configuration → Site URL = `https://bayele.com`, plus the `/auth/callback` redirect allow-list). This is the single most user-visible blocker for self-serve signup.

**Mobile Money & SokoClick webhook credentials.** Funding confirmations and creator disbursements are currently gated behind an admin action as the deliberate "launch bridge." Moving to automated settlement needs the MTN MoMo / Orange Money / Wave and SokoClick API credentials and webhook secrets provisioned as environment variables. Until then, the concierge (admin-confirmed) flow is the supported path — which is fine for a supervised beta.

**Leaked-password protection.** The Supabase security advisor flags that leaked-password protection (HaveIBeenPwned check) is disabled. Enable it in the dashboard (Authentication → Policies) before public signups open.

**Retire the obsolete `bayele-web` Vercel project.** Superseded by the current app; should be deleted in the Vercel dashboard to avoid confusion and stray deployments. There is no delete API available to me for this.

Note on the remaining security-advisor warnings: the advisor also lists every authenticated-callable `SECURITY DEFINER` function. **These are by design** — they are the intentional RPC façades (onboarding, moderation, funding, execution, refund) that each enforce their own `auth.uid()` / `is_admin` authorization internally. They are not a defect; they are the architecture.

---

## 6. Recommended fast-follows (safe to defer past launch)

None of these block a beta, but each closes a gap versus Fiverr/Collabstr and should be sequenced soon after launch. **In-app messaging** is the highest-value addition — it is the most visible missing surface against both competitors and the natural home for the current "Message" CTA. **Ratings computation** should follow: the `rating_avg` column exists but nothing writes to it, so a post-campaign review that recomputes a creator's average would make the trust signal real. **Pro subscription activation** needs a purchase-to-`is_pro` path (the tier and its guard exist; only the activation is missing). **Retainer disbursement of consultant fee and KPI bonus** should be wired so money actually moves at the end of a retainer, mirroring the campaign payout path. **Partial (post-payout) campaign refunds** need net-of-disbursement accounting to lift the current all-or-nothing refund restriction. And **phone-based identity** — deferred to v2 by design, with email/password shipping today — remains the eventual canonical-identity model for this market.

---

## 7. Launch checklist

| # | Item | Owner | Status |
|---|---|---|---|
| 1 | Close RLS column-escalation holes (migration 0016) | Eng | ✅ Done & verified |
| 2 | Reachable escrow refund + campaign cancel (migration 0017) | Eng | ✅ Done & verified |
| 3 | Error/loading resilience boundaries | Eng | ✅ Done |
| 4 | Notification-bell + public CTA continuity fixes | Eng | ✅ Done |
| 5 | Admin refund console + business self-cancel UI | Eng | ✅ Done |
| 6 | Regenerate & commit Supabase types | Eng | ✅ Done |
| 7 | Set Supabase Auth Site URL → `bayele.com` | **You** | ⛔ Blocker |
| 8 | Enable leaked-password protection | **You** | ⛔ Blocker |
| 9 | Provision MoMo / SokoClick webhook secrets | **You** | ◻ For automated settlement |
| 10 | Delete obsolete `bayele-web` Vercel project | **You** | ◻ Cleanup |
| 11 | In-app messaging | Eng | ◻ v2 fast-follow |
| 12 | Ratings computation from reviews | Eng | ◻ v2 fast-follow |
| 13 | Pro subscription activation path | Eng | ◻ v2 fast-follow |
| 14 | Retainer fee / KPI-bonus disbursement | Eng | ◻ v2 fast-follow |
| 15 | Partial (post-payout) refunds | Eng | ◻ v2 fast-follow |

**Bottom line:** the platform can open to a supervised beta now, with admin-confirmed funding and payouts as the settlement bridge. The two red blockers (items 7–8) are quick dashboard changes on your side; clearing them plus wiring automated settlement (item 9) gets you to a self-serve public launch. The competitive position — escrow-on-approval parity with the best creator marketplace, plus Mobile Money and OHADA invoicing that the incumbents lack — is strong for the Francophone-Africa wedge.

---

### Sources

- [Fiverr Seller Fees 2026 — official guide (FreelancerCalculator)](https://freelancercalculator.com/fiverr-seller-fees-2026-official-guide/)
- [Collabstr — Pricing & escrow / payment protection](https://collabstr.com/pricing)
- [Best influencer marketplaces 2026 (Influencer Marketing Hub)](https://influencermarketinghub.com/influencer-marketplaces/)
