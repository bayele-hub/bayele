import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/attribution';
import { withNext } from '@/lib/auth/return-path';

/**
 * Email-confirmation / OAuth callback. Supabase redirects here after the user clicks the
 * confirmation link; we exchange the code for a session (setting the auth cookies) and then hand
 * off to the dashboard dispatcher, which routes to onboarding or the role area as appropriate.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  // Same-origin only: "//evil.com" or "/\\evil.com" would otherwise become an open redirect.
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Always through the dispatcher, carrying `next`: a brand-new account must finish onboarding
      // first, and the dispatcher hands `next` to /onboarding/<role> so it survives to « Continuer ».
      return NextResponse.redirect(`${origin}${withNext('/dashboard', next)}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?mode=signin&error=confirmation`);
}
