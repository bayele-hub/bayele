import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Public Supabase config, inlined here (NOT imported from @bayele/database) so this
 * file compiles into a self-contained Edge Function. Vercel's Edge runtime cannot
 * reference workspace-package modules, so the middleware must not import them.
 * These are NEXT_PUBLIC values — safe in the edge bundle (the publishable key is
 * protected by Row Level Security). Real env vars still override the defaults.
 */
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://oxesplxlshsdrijzckpq.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'sb_publishable_53K_BGESyQ2Du51xHQrGvg_7niefTuI';

/**
 * MUST live at the app root (sibling of app/), never inside a route group.
 * Middleware gates the UI; Postgres RLS is the real data boundary.
 */
export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
};
