# Bayele Infrastructure (Terraform)

**Owner:** DevOps & SRE (`docs/SKILL.md` §2)
**Goal:** declarative, reproducible infrastructure with **no vendor lock-in** — the companion to
`docs/DATABASE-MIGRATIONS.md` §9 (the SQL-portability contract).

---

## The anti-lock-in architecture

Two tiers, deliberately unequal:

| Tier | Provider today | What it holds | Migration cost |
|---|---|---|---|
| **Data + logic** | Supabase Postgres | schema, RLS, escrow state machine, RPCs — **everything that matters** | Contained: the `supabase/migrations` set is plain Postgres and re-applies on Cloud SQL / RDS / self-hosted; only the auth shims repoint. |
| **Presentation** | Vercel | the stateless Next.js build | Trivial: a host swap (Cloud Run / Amplify / a Node server). No data moves. |

The strategy: **Supabase does the heavy lifting; Vercel does the bare minimum.** Because all state
and logic live in Postgres, moving off Vercel causes **no data migration and no extended downtime**,
and moving off Supabase is a database migration of a standard Postgres — not a rewrite of the app.

Terraform codifies *which* providers host each tier so the choice is config, not clicks. The schema
itself is intentionally **not** managed by Terraform — it is owned by the migration pipeline so it
stays a portable artifact.

## Layout

```
infra/terraform/
  versions.tf              provider pins + (commented) portable remote-state backend
  providers.tf             supabase + vercel providers, creds from vars
  variables.tf             inputs; secrets are sensitive + env-supplied
  supabase.tf              data/logic tier settings (API exposure, Auth URLs)
  vercel.tf                presentation tier (project, root dir, env vars)
  outputs.tf               ids/urls for CI
  terraform.tfvars.example placeholders (real tfvars is gitignored)
  modules/                 (future) e.g. cloudsql/ or rds/ for the migration target
```

## Usage

```bash
cd infra/terraform

# 1. Credentials as env vars (never commit secrets):
export TF_VAR_supabase_access_token="sbp_..."   # Supabase → Access Tokens
export TF_VAR_vercel_api_token="..."            # Vercel → Settings → Tokens

terraform init

# 2. The Supabase project and Vercel project ALREADY EXIST — import them once so Terraform manages
#    the resources we configured by hand instead of trying to recreate them:
terraform import supabase_settings.bayele oxesplxlshsdrijzckpq
terraform import vercel_project.bayele    prj_PzZ3A0KPiHcGyL4oxZAHA7cniTJ8

terraform plan     # review — should show only settings drift, no destroys
terraform apply
```

> **Never** run `apply` from a laptop against production once CI is wired. Terraform runs in CI with
> the state in a remote backend (versions.tf) and a required plan review — matching the migration
> sign-off rule in `docs/DATABASE-MIGRATIONS.md` Part 11.

## What Terraform manages (and what it doesn't)

- **Manages:** Supabase API exposure (keeps `private` schema hidden — migration 0005), Supabase Auth
  URL config (site_url + allow-list), the Vercel project (framework, `root_directory = apps/web`,
  git repo), and the Vercel env vars.
- **Does NOT manage:** the database schema (owned by `supabase/migrations` + the Supabase CLI), and
  the secret service-role key unless explicitly supplied via `TF_VAR_supabase_service_role_key`.

## Migrating away (the runbook this exists to make cheap)

**Off Vercel (hours, zero data downtime):**
1. Stand up the new host (Cloud Run / Amplify / Node) building the same `apps/web` Next.js output.
2. Point it at the same Supabase env vars. Cut DNS over. Done — no data touched.

**Off Supabase (a planned Postgres migration, not a rewrite):**
1. Add `infra/terraform/modules/cloudsql` (or `rds`) and provision a Postgres 15+ instance.
2. Apply `supabase/migrations/*` to it (they are plain Postgres). Repoint the auth shims
   (`app.current_user_id`, the `anon`/`authenticated` roles) per DATABASE-MIGRATIONS.md §9.
3. `pg_dump | pg_restore` the data; swap the app's connection string + JWT verification source.
4. Replace `supabase.tf` with the new module; `terraform apply`.

Nothing in the application layer changes except configuration — which is exactly the property the
whole design is built to preserve.
