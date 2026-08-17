import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@bayele/database/server';

/**
 * Cookie-aware Supabase client for Server Components, Route Handlers, and Server Actions.
 * This is the Next-specific glue: it adapts `next/headers` cookies() to the framework-agnostic
 * cookie store the @bayele/database package expects, so the shared package stays free of any
 * Next dependency.
 */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient({
    getAll: () => cookieStore.getAll(),
    set: (name, value, options) => cookieStore.set(name, value, options),
  });
}

export { createServiceClient } from '@bayele/database/server';
