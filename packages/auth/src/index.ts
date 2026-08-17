import 'server-only';
import type { ServerClient } from '@bayele/database/server';
import type { UserRole } from '@bayele/database';

/**
 * Auth helpers are framework-agnostic: callers pass the cookie-aware Supabase server
 * client (built by the app's Next glue), keeping this package free of any Next dependency.
 */
export async function getUser(supabase: ServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Resolve a user's roles from the user_roles join table. Modelled as a set from
 * day one (tech-stack §3.1): a creator can also become a consultant later.
 */
export async function getUserRoles(supabase: ServerClient, userId: string): Promise<UserRole[]> {
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return (data ?? []).map((r) => r.role as UserRole);
}

export function primaryRole(roles: UserRole[]): UserRole | null {
  const order: UserRole[] = ['super_admin', 'business', 'consultant', 'creator'];
  return order.find((r) => roles.includes(r)) ?? null;
}
