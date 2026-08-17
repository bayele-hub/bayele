'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './types.gen';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './env';

export { isSupabaseConfigured };

export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
}
