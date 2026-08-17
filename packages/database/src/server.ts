import 'server-only';
import { createServerClient as createSsrClient, type CookieOptions } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.gen';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

export type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Framework-agnostic cookie store. The Next glue in apps/web adapts `next/headers`
 * cookies() to this shape — keeping this package free of any framework dependency
 * so it can be reused by edge functions, workers, and services alike.
 */
export interface CookieStore {
  getAll: () => { name: string; value: string }[];
  set: (name: string, value: string, options: CookieOptions) => void;
}

/** Cookie-aware Supabase client for Server Components, Route Handlers, and Server Actions. */
export function createServerClient(cookieStore: CookieStore) {
  return createSsrClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: CookieToSet[]) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — safe to ignore; middleware refreshes the session.
        }
      },
    },
  });
}

export type ServerClient = ReturnType<typeof createServerClient>;

/**
 * Service-role client. SERVER ONLY. Bypasses RLS — the SECRET key is read from env
 * only and never committed. Use exclusively for trusted paths (webhook RPCs).
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.SUPABASE_URL ?? SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
