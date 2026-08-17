# ============================================================================
# Provider configuration. All credentials come from variables (TF_VAR_* env or a gitignored
# *.tfvars) — never hardcoded. See variables.tf and terraform.tfvars.example.
# ============================================================================

provider "supabase" {
  # Supabase Management API personal access token (account → Access Tokens).
  access_token = var.supabase_access_token
}

provider "vercel" {
  # Vercel API token (Account Settings → Tokens), scoped to the team.
  api_token = var.vercel_api_token
  team      = var.vercel_team_slug
}
