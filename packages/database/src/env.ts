// Public Supabase config. These are NEXT_PUBLIC values — safe in the browser bundle
// (the publishable key is protected by Row Level Security). Real env vars override the
// committed defaults, so setting them in Vercel/host still takes precedence.
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://oxesplxlshsdrijzckpq.supabase.co';

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_53K_BGESyQ2Du51xHQrGvg_7niefTuI';

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
