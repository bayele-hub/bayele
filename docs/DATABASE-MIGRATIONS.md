# Bayele — Database Migration Standards & Guardrails

**Owner:** Principal Backend & Database Systems Engineer (`docs/SKILL.md` §2)
**Authority:** binding. A migration that violates a **MUST**, or ships without the mandatory header
and a true-inverse rollback, is a release-blocking defect regardless of whether it applies cleanly.
**Read before writing any file under `supabase/migrations/`.**

> This playbook is deliberately aligned with the SokoClick Core Infrastructure migration standard
> (our sister product and OHADA invoicing provider) so an engineer or agent moving between the two
> code-bases meets one bar, not two. Where SokoClick targets Cloud SQL + Prisma, Bayele targets
> **Supabase Postgres (currently 17.6)** applied through `supabase/migrations/`; the rigor is
> identical, the platform specifics are adapted below.

---

## 0. Principles

1. **Migrations are irreversible in production and run as superuser.** Treat every file as a
   one-way door: it gets a mandatory header, a true-inverse rollback, and a post-apply verification
   query **run against the real schema**, never inferred from an exit code.
2. **Supabase does the heavy lifting; Vercel does the bare minimum.** All domain logic — escrow
   state machine, RLS, triggers, RPCs — lives in Postgres, because Postgres is portable and Vercel
   is replaceable. See `infra/terraform/README.md` for the infrastructure half of this strategy.
3. **No vendor trap.** Plain PostgreSQL 15+ SQL; every Supabase-specific dependency is quarantined
   and tagged so a move to Cloud SQL / RDS is a contained task, not a rewrite (Part 9).
4. **The header is a contract.** Its claims must match the SQL line-for-line. A header that
   describes work the body does not do is a defect (Part 2.2).

---

## Part 1 — Pre-flight (before you write a line)

- **1.1 — Confirm it's new.** Check `supabase_migrations.schema_migrations` on staging: this
  version has never applied. Never edit a migration that has run anywhere; fix forward.
- **1.2 — Read the dependencies.** List the exact prior migrations this one assumes (by version).
  If it depends on an object, that object's migration is named in the `Dependencies` header tag.
- **1.3 — No collisions.** Grep the migration set: no other pending file already claims the same
  `DROP`/`ADD`/`CREATE` of the same object. Two files fighting over one object is a defect.

## Part 2 — File & header

- **2.1 — Filename.** `<YYYYMMDDHHMMSS>_<NNNN>_<snake_summary>.sql` (Supabase convention). The
  UTC timestamp MUST sort strictly after every existing migration; `NNNN` is a human-readable
  sequence. Apply order = filename order. Never renumber a shipped file.
- **2.2 — Mandatory header (all 12 tags).** Every file opens with this block; its claims match the
  body exactly:

  ```
  -- ============================================================================
  -- Migration:          <human title>
  -- Version:            <YYYYMMDDHHMMSS_NNNN>
  -- Date:               <UTC date>
  -- Author:             <SKILL.md role assumed>
  -- Team:               Bayele Core Platform Engineering
  -- Target Database:    Supabase Postgres 17.x (managed) — portable to Cloud SQL / RDS Postgres 15+
  -- Infrastructure Ref: infra/terraform/ · supabase_project.bayele (ref oxesplxlshsdrijzckpq)
  -- Feature Ticket:     BAY-<area>-<n>  (spec: bayele-production-spec-v1.1.2 §X)
  -- Dependencies:       <prior versions, or "none (greenfield)">
  -- Rollback Script:    supabase/migrations/rollback/<same_name>.rollback.sql
  -- Estimated Duration: <seconds> on an empty/steady-state DB
  -- ============================================================================
  -- Description:        <what and why, in prose>
  -- Breaking Changes:   <NONE, or the exact contract break>
  -- Performance Impact: <locks taken, index cost, storage/row>
  -- Compliance Notes:   <what the schema actually enforces — OHADA/CEMAC/UEMOA/PII —
  --                      described as what THIS change does, never a future program>
  -- ============================================================================
  ```

## Part 3 — Writing DDL safely

- **3.1 — Idempotent.** `CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`,
  `DROP POLICY IF EXISTS` before `CREATE POLICY`, `CREATE INDEX IF NOT EXISTS`. A file that fails
  halfway is safe to re-apply.
- **3.2 — Constraints on populated tables use two steps.** Adding a CHECK/FK to a table that
  already holds rows: `ALTER TABLE … ADD CONSTRAINT … NOT VALID;` then, in the same file or a
  follow-up, `VALIDATE CONSTRAINT` (which takes only a `SHARE UPDATE EXCLUSIVE` lock and does not
  block writes). **Greenfield `CREATE TABLE` uses inline constraints** — the two-step rule applies
  only when the table already has data.
- **3.3 — Indexes.** `CREATE INDEX CONCURRENTLY` cannot run inside a transaction; Supabase wraps
  each migration file in one. So a concurrent index gets its **own** migration file that says so in
  the header. Inline indexes on new/empty tables are fine.
- **3.4 — Destructive changes are expand → migrate → contract across separate deploys** (see
  Part 10). Never drop-and-re-add in one file.
- **3.5 — No hardcoded generated IDs.** Look rows up by natural key (`handle`,
  `sokoclick_invoice_id`), never by a UUID captured from another environment.
- **3.6 — Enum changes.** A new enum value MUST NOT be used in the same file that adds it (Postgres
  commits the value first). Update every contract layer (types.gen.ts, app switch statements) and
  provide **en + fr** strings for any user-visible value (Part 8).

## Part 4 — Backfills

- Idempotent (guard with `WHERE` so a re-run is a no-op), preserve prior values before overwrite,
  and **batched** (e.g. `LIMIT 10000` loops) on large tables so a backfill never holds one long
  transaction. A destructive backfill without a preserving step is a defect.

## Part 5 — Rollback script (mandatory, true inverse)

- Every migration ships `supabase/migrations/rollback/<same_name>.rollback.sql`. It is the **exact
  inverse**, in correct drop-order (dependents first), or it documents in a header comment precisely
  why a clean inverse is impossible (e.g. a destructive contract step) and what the recovery path is.
- The rollback is itself idempotent (`IF EXISTS`) and leaves `schema_migrations` consistent.

## Part 6 — Post-apply verification (evidence, not exit codes)

- Each migration defines a verification query that proves the intended end-state against the actual
  schema — row in `pg_policies`, `information_schema.table_constraints`, `pg_proc.prosecdef`, a
  `count(*)` of expected objects. "Exit code 0" is not verification.
- After **any** DDL, run the Supabase **security** and **performance** advisors and clear them
  (missing RLS, `rls_enabled_no_policy`, mutable function `search_path`, missing FK indexes).

## Part 7 — RLS is not optional (invariant §3.1)

- Every table exposed to PostgREST gets `ENABLE ROW LEVEL SECURITY` **and ≥1 policy in the same
  migration**. RLS-enabled-with-no-policy is deny-all and silently breaks reads (this killed the
  directory in v1.1.1).
- PII tables (`business_profiles.tax_id`/`billing_address`, `notifications`) are owner+admin only —
  no public `SELECT`, ever (invariants §3.6, §3.7).
- Every `SECURITY DEFINER` function: (a) carries its own authorization check as its first act,
  (b) pins `search_path` (empty, with fully-qualified references), (c) is `REVOKE`d from
  `PUBLIC, anon, authenticated` unless a policy expression must call it. Passing `p_actor` is not
  authorization unless the caller cannot spoof it (invariant §3.3).
- Write the **negative** authorization test first (pgTAP): prove denial before proving access.

## Part 8 — Money-path & i18n rules

- Money is `BIGINT` **minor units of FCFA** (whole francs — XAF/XOF have no subunit). Never
  float/numeric for money. Rates are `NUMERIC(4,3)` constrained to the tier set. *(SokoClick stores
  a USD base at `NUMERIC(15,4)` for FX resilience; Bayele is single-currency-per-union and stores
  FCFA directly — if we ever add cross-union settlement, adopt the USD-base pattern.)*
- Currency follows the monetary union, not the word "FCFA": CM & GA = **XAF** (CEMAC), CI = **XOF**
  (UEMOA); never mix two ISO codes on one invoice (invariant §3.8).
- Idempotency keys (`provider_ref`, `sokoclick_invoice_id`) are `UNIQUE NOT NULL` on financial rows
  — a redelivered webhook is a no-op by constraint, not by luck (invariant §3.5).
- Encode money math as DB CHECKs (`budget_math_check`, `retainer_math_integrity`, `valid_fee_rate`),
  not app assertions — they travel with the data.
- Any user-visible enum/string ships **en + fr**.

## Part 9 — Portability contract (anti-vendor-lock-in)

- Target PostgreSQL 15+ features only (shared floor of Supabase, RDS, Aurora, Cloud SQL). No
  proprietary Supabase SQL.
- Confine Supabase/GoTrue dependencies to the quarantine list and tag each with
  `-- SUPABASE-SPECIFIC:` + its portable equivalent. Untagged = cannot merge.

  | Dependency | Portable equivalent |
  |---|---|
  | `auth.uid()` in RLS | `current_setting('request.jwt.claims',true)::json->>'sub'`; wrap in `app.current_user_id()` |
  | `auth.users` | any IdP user table; only `profiles.id` references it |
  | `anon`/`authenticated` roles | created by the roles bootstrap; map to the target's request roles |
  | Realtime publication | `LISTEN`/`NOTIFY` or Debezium CDC |
  | `pg_cron`, `pgcrypto` | first-class on RDS/Cloud SQL |

- Keep the identity seam to **one** FK: `public.profiles.id → auth.users(id)`. Re-pointing at
  another IdP is then a one-line change.

## Part 10 — Expand / Contract (safe deploys)

Every change is deployable **before** its application code and tolerable **without** it:

1. **Expand** — additive only (new nullable column, new table, new function). Deploy.
2. **Migrate** — backfill (Part 4); cut the app over. Deploy.
3. **Contract** — drop the old shape in a **later** migration, once nothing reads it.

A single file that both adds the new shape and drops the old one is a defect.

## Part 11 — Apply & sign-off workflow

1. `supabase start` → applies to the local stack.
2. `supabase test db` → pgTAP suite (escrow machine + RBAC **negatives**) passes.
3. Regenerate `packages/database/src/types.gen.ts` from the new schema; app compiles.
4. Apply to an **ephemeral DB** (CI branch / preview) and attach the apply evidence + the Part 6
   verification output to the PR.
5. Promotion to the linked project is done by **Terraform / the Supabase CLI in CI** — a human (or
   agent) running `apply_migration` against production by hand is a process violation, allowed only
   for an explicitly-authorized break-glass with the evidence attached.
6. Sign-off matrix: Backend/DB (author) · Security/Compliance (RLS + PII) · QA & Chaos (negative
   tests) · DevOps (apply evidence). No box unchecked ships.

## Part 12 — Integrity & the checklist

- **12.1 — Header ↔ body parity.** Reviewer confirms every header claim is true of the SQL.
- **12.2 — Hash manifest.** `supabase/migrations/MANIFEST.sha256` records `sha256(file)` for every
  migration; CI fails if a shipped migration's bytes change. This is how "never edit an applied
  migration" is enforced mechanically.

### Pre-merge checklist (paste into the PR)

- [ ] New file, verified against `schema_migrations` on staging (1.1); manifest updated (12.2)
- [ ] Filename timestamp sorts after every existing migration (2.1)
- [ ] All 12 header tags present; header matches the SQL line-for-line (2.2)
- [ ] Constraints on populated tables via `NOT VALID` + `VALIDATE CONSTRAINT` (3.2)
- [ ] No `CREATE INDEX CONCURRENTLY` inside a transaction-wrapped file (3.3)
- [ ] Enum changes: value not used in the same file; all contract layers + en/fr updated (3.6, 8)
- [ ] Backfills preserve prior values, idempotent (guarded WHERE), batched if large (4)
- [ ] Rollback script exists, is the true inverse (or documents why not) in correct drop-order (5)
- [ ] No other migration claims the same DROP/ADD (1.3)
- [ ] Expand/Contract: deployable before its code, tolerable without it (10)
- [ ] Post-apply verification query planned and run against the real schema (6)
- [ ] Every new table: RLS enabled + ≥1 policy; PII owner+admin only (7)
- [ ] Every SECURITY DEFINER fn: authz guard + pinned `search_path` + REVOKE (7)
- [ ] No direct `escrow_transactions.status` writes; money moves via `transition_escrow()` (8)
- [ ] Vendor-specific SQL tagged `-- SUPABASE-SPECIFIC:` with a portable fallback (9)
- [ ] `get_advisors(security)` and `(performance)` run clean after apply (6)
- [ ] Ephemeral-DB apply evidence attached; sign-off matrix satisfied (11)

## Part 13 — AI-agent addendum

- State the role assumed and the spec section, as a human would.
- Emit the **whole** file, never a fragment to hand-merge.
- Prefer additive, reversible changes. A destructive change stops and surfaces the
  expand→migrate→contract plan for human approval instead of executing the drop.
- Never invent IDs, secrets, or connection strings — read them from Terraform outputs / env, or ask.
- Re-run this checklist against your own diff and paste the result **with advisor output**.
  Self-certification without evidence is not "done" (SKILL.md verification gates).
