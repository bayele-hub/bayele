# ============================================================================
# Supabase — the DATA + LOGIC tier (does the heavy lifting).
# ============================================================================
# Terraform manages the project's SETTINGS, not its lifecycle. The schema (escrow machine, RLS,
# RPCs) lives in supabase/migrations and is applied by the Supabase CLI/CI — so the portable
# Postgres core is never coupled to Terraform state or to Supabase itself.
#
# The project already exists. Import its settings once, then `terraform apply` manages them:
#   terraform import supabase_settings.bayele ${var.supabase_project_ref}
# ============================================================================

resource "supabase_settings" "bayele" {
  project_ref = var.supabase_project_ref

  # API exposure. CRITICAL: keep the exposed schemas to public + graphql_public. The `private`
  # schema (which holds private.is_admin, migration 0005) MUST NOT be exposed to PostgREST.
  api = jsonencode({
    db_schema            = "public,graphql_public"
    db_extra_search_path = "public,extensions"
    max_rows             = 1000
  })

  # Auth. Email/password is the primary identity (phone auth is deferred to v2 → external_phone off).
  # site_url + uri_allow_list must include production and localhost or the email redirect breaks.
  auth = jsonencode({
    site_url               = var.production_url
    uri_allow_list         = "${var.production_url},${var.local_dev_url}"
    jwt_expiry             = 3600
    refresh_token_rotation_enabled = true
    enable_signup          = true
    mailer_autoconfirm     = false
    external_email_enabled = true
    external_phone_enabled = false
  })
}

# NOTE ON PORTABILITY (README §"Migrating away"):
# To move the data tier off Supabase, replace this file with a Postgres module for the target —
# e.g. infra/terraform/modules/cloudsql (google_sql_database_instance) or an aws_db_instance /
# aws_rds_cluster (Aurora Postgres). The supabase/migrations set applies unchanged; only the
# auth.uid()/anon/authenticated shims (DATABASE-MIGRATIONS.md §9) are repointed. Nothing in the
# application layer changes except the connection string + JWT verification source.
