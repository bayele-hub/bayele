import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@bayele/database';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Role = Database['public']['Enums']['user_role'];

export interface SessionContext {
  userId: string | null;
  email: string | null;
  metadata: Record<string, unknown>;
  profile: Profile | null;
  roles: Role[];
  /** Highest-privilege role the user holds, or null. */
  primary: Role | null;
}

// Admin > business > consultant > creator when a user wears several hats.
const ROLE_ORDER: Role[] = ['super_admin', 'business', 'consultant', 'creator'];

/**
 * Single source of truth for "who is this request". Reads the verified user, then their profile
 * and roles under RLS (a user can always read their own). Used by the dashboard dispatcher, the
 * onboarding guards, and the role dashboards.
 */
export const getSession = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { userId: null, email: null, metadata: {}, profile: null, roles: [], primary: null };
  }

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role) as Role[];
  const primary = ROLE_ORDER.find((r) => roles.includes(r)) ?? null;

  return {
    userId: user.id,
    email: user.email ?? null,
    metadata: (user.user_metadata ?? {}) as Record<string, unknown>,
    profile: (profile ?? null) as Profile | null,
    roles,
    primary,
  };
});
