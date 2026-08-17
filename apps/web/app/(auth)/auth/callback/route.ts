import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Email-confirmation / OAuth callback. Supabase redirects here after the user clicks the
 * confirmation link; we exchange the code for a session (setting the auth cookies) and then hand
 * off to the dashboard dispatcher, which routes to onboarding or the role area as appropriate.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/dashboard'}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth?mode=signin&error=confirmation`);
}
