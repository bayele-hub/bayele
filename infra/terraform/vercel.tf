# ============================================================================
# Vercel — the PRESENTATION tier (does the bare minimum).
# ============================================================================
# Vercel only builds and serves the stateless Next.js app. No state, no business logic. That is the
# whole point: replacing Vercel is a host swap (Cloud Run / Amplify / a Node server), not a rewrite,
# and it never touches the data tier — so there is no extended downtime in a migration.
#
# The project already exists. Import it once, then Terraform manages it:
#   terraform import vercel_project.bayele <project_id>   # prj_PzZ3A0KPiHcGyL4oxZAHA7cniTJ8
# ============================================================================

resource "vercel_project" "bayele" {
  name      = var.vercel_project_name
  framework = "nextjs"

  # Monorepo: the Next app is in apps/web (matches the dashboard setting we rely on for a green build).
  root_directory = "apps/web"

  git_repository = {
    type              = "github"
    repo              = var.github_repo
    production_branch = "main"
  }

  # Turborepo is auto-detected; leave build/install on framework defaults so this stays in lockstep
  # with local `pnpm build`.
}

# --- Environment variables --------------------------------------------------
# Public values (also baked into code as safe defaults); Terraform sets the authoritative values.
resource "vercel_project_environment_variable" "supabase_url" {
  project_id = vercel_project.bayele.id
  key        = "NEXT_PUBLIC_SUPABASE_URL"
  value      = var.supabase_url
  target     = ["production", "preview", "development"]
}

resource "vercel_project_environment_variable" "supabase_anon" {
  project_id = vercel_project.bayele.id
  key        = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  value      = var.supabase_publishable_key
  target     = ["production", "preview", "development"]
}

# Secret service-role key — production only, sensitive. Managed only when supplied via TF_VAR
# (count=0 otherwise) so a missing secret never blocks a plan. NEVER put this in a committed tfvars.
resource "vercel_project_environment_variable" "supabase_service_role" {
  count      = var.supabase_service_role_key == "" ? 0 : 1
  project_id = vercel_project.bayele.id
  key        = "SUPABASE_SERVICE_ROLE_KEY"
  value      = var.supabase_service_role_key
  target     = ["production"]
  sensitive  = true
}

# --- Custom domain ----------------------------------------------------------
# Apex bayele.com is production; www redirects to it. After apply, Vercel prints the DNS records to
# add at your registrar (an A record for the apex + a CNAME for www). Keep bayele.vercel.app too.
resource "vercel_project_domain" "apex" {
  project_id = vercel_project.bayele.id
  domain     = "bayele.com"
}

resource "vercel_project_domain" "www" {
  project_id           = vercel_project.bayele.id
  domain               = "www.bayele.com"
  redirect             = "bayele.com"
  redirect_status_code = 308
}
