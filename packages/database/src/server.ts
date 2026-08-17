import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from './types.gen';

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Reads the anon key; RLS is the security boundary (SKILL.md invariant #1).
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component render — safe to ignore; middleware refreshes the session.
          }
        },
      },
    },
  );
}

/**
 * Service-role client. SERVER ONLY. Bypasses RLS — use exclusively for trusted
 * paths like the SokoClick webhook that call SECURITY DEFINER RPCs.
 */
export function createServiceClient() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
