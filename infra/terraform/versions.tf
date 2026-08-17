# ============================================================================
# Bayele — Terraform provider & version pins
# Team: Bayele Core Platform Engineering · DevOps & SRE
# ============================================================================
# Portability note: Terraform itself is the anti-lock-in tool. Supabase and Vercel are declared as
# swappable providers; the portable core (the Postgres schema in supabase/migrations) is NOT managed
# here — it is applied by the Supabase CLI/CI so it runs unchanged on Cloud SQL / RDS / self-hosted.
# See README.md §"Migrating away".

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.5"
    }
    vercel = {
      source  = "vercel/vercel"
      version = "~> 2.1"
    }
  }

  # Remote state on a portable object store (S3/GCS/R2) so state is not trapped in one vendor either.
  # Configure per-environment with `terraform init -backend-config=backend.hcl` (backend.hcl is
  # gitignored). Left commented so `terraform init` works locally before a backend is provisioned.
  #
  # backend "s3" {
  #   bucket = "bayele-tfstate"
  #   key    = "prod/terraform.tfstate"
  #   region = "eu-west-1"
  # }
}
