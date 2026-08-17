import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Database } from './types.gen';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

/** Supabase client for Server Components, Route Handlers, and Server Actions. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component render — safe to ignore; middleware refreshes the session.
        }
      },
    },
  });
}

/**
 * Service-role client. SERVER ONLY. Bypasses RLS — the SECRET key is read from env
 * only and never committed. Use exclusively for trusted paths (webhook RPCs).
 */
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(
    process.env.SUPABASE_URL ?? SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
