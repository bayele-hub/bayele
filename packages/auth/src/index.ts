import 'server-only';
import { createClient } from '@bayele/database/server';
import type { UserRole } from '@bayele/database';

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Resolve a user's roles from the user_roles join table. Modelled as a set from
 * day one (tech-stack §3.1): a creator can also become a consultant later.
 */
export async function getUserRoles(userId: string): Promise<UserRole[]> {
  const supabase = await createClient();
  const { data } = await supabase.from('user_roles').select('role').eq('user_id', userId);
  return (data ?? []).map((r) => r.role as UserRole);
}

export function primaryRole(roles: UserRole[]): UserRole | null {
  const order: UserRole[] = ['super_admin', 'business', 'consultant', 'creator'];
  return order.find((r) => roles.includes(r)) ?? null;
}
