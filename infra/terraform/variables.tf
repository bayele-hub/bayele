# ============================================================================
# Input variables. Secrets are `sensitive = true` and MUST be supplied via TF_VAR_* env vars or a
# gitignored *.tfvars — the committed *.tfvars.example carries placeholders only.
# ============================================================================

# --- Credentials (secret) ---------------------------------------------------
variable "supabase_access_token" {
  type        = string
  sensitive   = true
  description = "Supabase Management API PAT. Provide via TF_VAR_supabase_access_token."
}

variable "vercel_api_token" {
  type        = string
  sensitive   = true
  description = "Vercel API token. Provide via TF_VAR_vercel_api_token."
}

variable "supabase_service_role_key" {
  type        = string
  sensitive   = true
  default     = ""
  description = <<-EOT
    Supabase SECRET service-role key (sb_secret_… / service_role JWT). Server-only; used by the
    SokoClick webhook + server actions. Leave "" to skip managing it in Vercel and set it by hand;
    otherwise supply via TF_VAR_supabase_service_role_key (NEVER commit it to a tfvars file).
  EOT
}

# --- Identifiers (non-secret) ----------------------------------------------
variable "supabase_project_ref" {
  type        = string
  default     = "oxesplxlshsdrijzckpq"
  description = "Ref of the existing Supabase project (bayele-hub)."
}

variable "supabase_url" {
  type        = string
  default     = "https://oxesplxlshsdrijzckpq.supabase.co"
}

variable "supabase_publishable_key" {
  type        = string
  sensitive   = true
  default     = "sb_publishable_53K_BGESyQ2Du51xHQrGvg_7niefTuI"
  description = "Public (publishable) Supabase key — safe in the browser (RLS-protected); treated as a var so rotation is a one-line change."
}

variable "vercel_team_slug" {
  type        = string
  default     = "bayele-hub"
}

variable "vercel_project_name" {
  type        = string
  default     = "bayele"
}

variable "github_repo" {
  type        = string
  default     = "bayele-hub/bayele"
  description = "owner/repo backing the Vercel project."
}

variable "production_url" {
  type        = string
  default     = "https://bayele.com"
  description = "Canonical production URL (custom domain) — drives the Supabase Auth site_url."
}

variable "vercel_url" {
  type        = string
  default     = "https://bayele.vercel.app"
  description = "Vercel-assigned URL — kept in the Auth allow-list so preview/fallback still works."
}

variable "local_dev_url" {
  type        = string
  default     = "http://localhost:3000"
}
