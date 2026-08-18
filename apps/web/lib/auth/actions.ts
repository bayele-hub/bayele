'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Sign the current user out. Runs on the server so the Supabase SSR client clears the auth cookies;
 * then sends the user to the sign-in screen. Used by the header AccountMenu across every role.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/auth?mode=signin');
}
