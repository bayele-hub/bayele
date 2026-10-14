# Partner governance — tracker (2026-10-14)

Decisions: `briefs/CONTEXT-PARTNER-GOV.md` G1–G12 with the owner overrides P1–P7. Contract: `briefs/BACKEND-CONTRACT-PARTNER-GOV.md` (0038–0040). Design: `docs/PARTNER-GOVERNANCE-DESIGN.md`. QA: `qa/QA-REPORT-PARTNER-GOV.md`, final verdict GO (PG-13 and PG-14 fixed by Backend, all suites green). Release steps: `docs/MANAGED-CAMPAIGNS-RELEASE-RUNBOOK.md` §11.

**Status:** RELEASED 2026-10-14. Both web deploys are live (admin-review PR #10, partner-governance PR #11 `dd96cc4`). All migrations are applied to production: 0038 + 0039 (07:33 / 07:42 UTC), 0037 (09:34 UTC), 0040 (09:56 UTC). Remaining: QA smoke list, counsel review, G12.

## Tracker

### Build
- [x] G1 fixed specialty list (14 codes, max 3, aliases); the « Non vérifié » label is replaced by « Spécialités déclarées ». Validation ships in 0040.
- [x] G2 admin partner hub: delist and relist with a reason, freeze on suspension, end a representation (logged), a read-only overview, admin-only commission rate change.
- [x] G3 admin assignments, effective immediately (P3), with a 30-day thread; the partner can « Demander la fin »; `admin_propose_retainer`.
- [x] G4 brand → partner contact requests, an admin queue with reason codes, approve → assignment and open thread.
- [x] G5 server-side masking before a funded retainer; flags queue; P5 masked originals admin-only (deny-all RLS, logged reads, 90-day purge by pg_cron).
- [x] G6 self-dealing flags → partner payout hold; commission rate lock; « Signaler ».
- [x] G7 consents (CGU non-circumvention, versioned; contact-request consent); current version enforced in 0040.
- [x] G8 WhatsApp proof screenshots (private `proofs` bucket, duplicate-image check, « Demander une nouvelle capture »).
- [x] G9 city lists per country (CM, CI, GA, NG, KE, ZA) with « Autre » and normalisation.
- [x] G10 /legal: non-circumvention clause and privacy additions with the decided retention values.

### Release
- [x] DevOps: 0038 + 0039 applied to production. All 147 function fingerprints match the local dry run; 134 bodies are byte-identical (the other 13 predate this release and differ only in comments). Seed data matches. Cron job, bucket, policies, deny-all store, old-web session check and a rolled-back masking simulation all verified (runbook §11.2).
- [x] DevOps: commits + `partner-governance.patch` (stacked on `admin-review.patch`), verified on a fresh clone of origin/main.
- [x] Owner: `admin-review.patch` (PR #10) and `partner-governance.patch` (PR #11, `dd96cc4`) merged and deployed.
- [x] 0037 (phone lockdown; Co-CTO, 09:34 UTC, post-verified), then 0040 (enforcement; DevOps, 09:56 UTC): 150 function fingerprints match the dry run; specialties hold codes only; 5 correction requests and 5 notifications; consent, assignment and retainer-thread gating verified by a rolled-back simulation; no 4xx/5xx in the edge logs (runbook §11.7).
- [ ] QA smoke list on production (runbook §11.4).

## Pending outside engineering

- **Local counsel review — PENDING.** The texts on /legal were written to the Legal seat's brief and contain no placeholder, but local counsel has not reviewed them yet. This covers:
  - the CGU non-circumvention clause (12 months from the introduction or the last paid job; warning → suspension → delisting; a charge equal to Bayele's lost fee; withholding of unpaid commission);
  - the privacy-notice additions (admins review profiles; views, reveals and decisions are logged; retention: views 12 months, decisions and reveals 5 years, masked originals 90 days, proof screenshots 30 days after payment or dispute closure);
  - the consent wording and version strings;
  - **the legal basis for cross-border data transfers** (hosting and processors outside the members' countries).

  A change to any of these texts after review needs a new consent version, bumped together in the web (`NON_CIRCUMVENTION_VERSION`) and the database (`private.current_consent_version`, new migration).

## G12 — deferred (documented, not built)

- **Admin two-factor sign-in**: postponed by the owner.
- **Dispute window N** after campaign validation: N is an owner decision; nothing in the payout flow waits for it yet.
- **Screenshot purge job**: proof screenshots are kept 30 days after payment (P6). Deleting storage objects needs DELETE, so this is an owner/ops job, not a migration, and isn't automated yet. The masked-original purge *is* automated (pg_cron `bayele_purge_masked_originals`, daily 03:17 UTC).
- **Creator reassignment** between partners.
