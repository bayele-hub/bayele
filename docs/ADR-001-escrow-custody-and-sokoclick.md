# ADR-001 — Escrow custody, SokoClick's role, and the money path

**Status:** Accepted · 2026-08-17
**Owners:** CTO & Systems Lead · Principal Backend & Database Systems Engineer · Security/Compliance
**Supersedes:** the implicit assumption in `bayele-production-spec-v1.1.2` §4.2 that a SokoClick
"invoice.paid" webhook signals that funds have arrived.

## Context

The original design read as if SokoClick were a payment processor whose "invoice.paid" webhook meant
money had moved. **That is incorrect.** SokoClick is an **invoicing & bookkeeping** platform: it
generates OHADA-compliant invoices and receipts, and tracks income/expenses, projects, etc. **It does
not hold, move, or confirm funds.**

## Decision

1. **Bayele is the escrow custodian.** Campaign budgets are collected into a Bayele-controlled
   Mobile Money / bank account and held there. The `escrow_transactions` ledger is the authoritative
   record of custody; SokoClick never holds money.
2. **SokoClick = documents + books only.** `packages/sokoclick-sdk` calls SokoClick to (a) generate a
   campaign/retainer **invoice** (the OHADA document the business pays against) and (b) generate the
   **receipt** once paid, and to record income/expense lines. No fund movement, ever.
3. **Money moves over Mobile Money**, via `services/momo-engine`:
   - **Collection (inbound):** the business pays the invoice by MoMo (MTN MoMo / Orange Money / Wave)
     into Bayele's collection account.
   - **Disbursement (outbound):** creator payouts are sent by MoMo from Bayele's account.
4. **Payment confirmation is NOT from SokoClick.** The event that flips escrow `pending → held` is a
   confirmed **inbound MoMo collection**, sourced from either:
   - a **MoMo collection webhook / status poll** (real integration, `momo-engine`), or
   - an **admin confirmation** in the moderation console (the launch bridge, until MoMo webhooks are
     wired). Both call the same idempotent funding RPC.

## Consequences

- The funding RPC (`handle_sokoclick_invoice_paid`, spec §4.2) keeps its atomic, idempotent shape but
  is renamed in intent to "**confirm inbound collection**": its trigger is a MoMo/admin confirmation,
  not a SokoClick webhook. It is complemented by `admin_confirm_campaign_funding` (0012) — the
  admin-gated bridge that confirms a MoMo payment and funds the escrow.
- `sokoclick_invoice_id` / `sokoclick_receipt_id` remain the idempotency keys and the link to the
  bookkeeping documents; the **provider** (`escrow_transactions.provider`) records the actual MoMo
  rail the money moved on.
- **External dependencies to go fully live** (ops, not code): a SokoClick API credential for invoice
  generation, and MoMo **merchant/collection API** credentials (MTN MoMo, Orange Money, Wave). Until
  those exist, the admin-confirmation bridge runs the exact same escrow state machine — so the
  software loop is complete and testable now, and swapping in the real rails changes only the
  *caller* of the funding RPC, never the ledger logic.

## Invariants (unchanged, restated)

- `transition_escrow()` is still the only mutator of `escrow_transactions.status`; every hop is
  audited. Funding is idempotent on the invoice id. Currency follows the monetary union (XAF/XOF).
  Platform fee is read at funding time from `campaigns.platform_fee_rate` (set once by tier).
