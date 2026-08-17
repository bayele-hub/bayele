import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * MUST live at the app root (sibling of app/), never inside a route group —
 * Next.js only executes it here (production spec §0.1 #H).
 *
 * Middleware gates the *UI*; Postgres RLS is the real data boundary (invariant #1).
 * It refreshes the Supabase session and redirects unauthenticated users to /auth.
 */
export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured (e.g. local UI review without a Supabase project): let every
  // request through untouched. Auth gating activates automatically once the two
  // NEXT_PUBLIC_SUPABASE_* env vars are set.
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.next({ request: req });
  }

  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
        toSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        toSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  const needsAuth =
    path.startsWith('/creator') ||
    path.startsWith('/consultant') ||
    path.startsWith('/business') ||
    path.startsWith('/admin');

  if (needsAuth && !user) {
    const url = req.nextUrl.clone();
    url.pathname = '/auth';
    url.search = '?mode=signin';
    return NextResponse.redirect(url);
  }

  // Fine-grained role gating is enforced in each segment's layout + RLS.
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
