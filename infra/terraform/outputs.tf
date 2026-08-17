# ============================================================================
# Outputs — consumed by CI (e.g. to feed the migration runner) and humans.
# ============================================================================

output "supabase_project_ref" {
  value       = var.supabase_project_ref
  description = "Supabase project ref hosting the portable Postgres schema."
}

output "supabase_url" {
  value = var.supabase_url
}

output "vercel_project_id" {
  value       = vercel_project.bayele.id
  description = "Vercel project id (use for `terraform import` and CI deploy hooks)."
}

output "production_url" {
  value = var.production_url
}
