import { NextResponse, type NextRequest } from 'next/server';

/**
 * MUST live at the app root (sibling of app/), never inside a route group.
 *
 * This is a lightweight UI gate ONLY. It runs in Vercel's Edge runtime, so it must
 * NOT import the Supabase client: `@supabase/ssr` pulls in Node-only code (it
 * references `__dirname`), which does not exist on the Edge and crashes the function
 * (MIDDLEWARE_INVOCATION_FAILED). Instead we cheaply check for the presence of a
 * Supabase auth cookie and redirect logged-out visitors away from protected areas.
 *
 * Real authorization is enforced where it belongs: Postgres RLS is the data boundary,
 * and the protected Server Components / Route Handlers (which run in Node) verify the
 * session with `supabase.auth.getUser()`. A stale/expired cookie that slips past this
 * gate is still rejected there — this check only decides whether to show the page shell
 * or bounce to sign-in.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  // Precise prefixes: the trailing slash on /creator/ and /consultant/ is deliberate so the PUBLIC
  // directory (/creators, /consultants — plural) is NOT gated, only the role areas (/creator/…).
  const AUTH_PREFIXES = ['/dashboard', '/onboarding', '/admin', '/creator/', '/consultant/', '/business/', '/profile', '/messages'];
  const needsAuth = AUTH_PREFIXES.some((p) => path === p || path.startsWith(p));

  if (!needsAuth) return NextResponse.next();

  // @supabase/ssr stores the session in cookies named `sb-<project-ref>-auth-token`
  // (sometimes chunked with `.0`, `.1` suffixes). Presence is enough for a UI gate.
  const hasSession = req.cookies
    .getAll()
    .some((c) => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '?mode=signin';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
