# Bayele — Initial Tech Stack & Architecture (v1)

**Scope:** Public marketplace (Creators + Consultants), RBAC (Super Admin / Creator / Consultant), mobile-first, in-app notifications.
**Not yet in scope:** Payment/escrow integration (MoMo), WhatsApp webhook engine, Agency retainer billing — these plug into this foundation in a later phase.

> **Canonical status (added in QA pass):** This is the **phase-1 foundation** document. Where it overlaps with `bayele-production-spec-v1.1.2.md` (four-actor model, schema, RLS, escrow), **v1.1.2 is canonical** and wins. Two things below are corrected in the QA report and reconciled here inline: the `middleware.ts` location (§2 / §3.4) and the auth method (§6) — the production frontend (`bayele-home.md`) ships **phone + password** via Supabase Auth, with phone **OTP** as the passwordless option, not OTP-only.

---

## 1. Stack decision

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server components for the public marketplace = fast first paint on low-end Android/3G, which matters for your CMR/GA/CI user base. Server actions remove the need for a separate API layer for most mutations. |
| Monorepo tooling | Turborepo + pnpm workspaces | Native to Vercel, remote caching, simplest mental model for a solo/small team. |
| Database & Auth | Supabase (Postgres + Auth + Realtime + Storage) | RLS gives you RBAC enforcement at the data layer, not just in app code — important since you have three trust levels and public read access. Realtime is what powers in-app notifications without standing up a separate socket service. |
| Hosting | Vercel (web app) + Supabase Cloud (data) | Best-supported Next.js runtime, zero-config preview deployments per PR, edge caching for the public marketplace pages. |
| Background jobs / cron | Supabase Edge Functions (Deno) + `pg_cron` | Notification fan-out, badge expiry, digest emails — no separate worker infra needed at this stage. |
| Transactional email | Resend | Clean Next.js integration, generous free tier, good deliverability for auth emails. |
| Push (later) | Web Push (VAPID) via a Supabase Edge Function; OneSignal only if you need native mobile push before you have a native app | Keep in-app notifications as the primary channel now; push is additive. |

**Alternative worth naming and rejecting for now:** Railway or Fly.io instead of Vercel — better if you need a long-running Node process (e.g. a custom WhatsApp webhook listener) outside Vercel's serverless model. Not needed for v1; revisit when you build the WhatsApp Webhook Engine from the PRD, at which point that piece can live on Fly.io while the web app stays on Vercel.

---

## 2. Monorepo layout

```
bayele/
├── apps/
│   └── web/                      # single Next.js app — role-based routing, not separate apps per role
│       ├── app/
│       │   ├── (public)/         # marketplace — no auth required
│       │   │   ├── page.tsx                 # landing / marketplace home
│       │   │   ├── creators/
│       │   │   │   ├── page.tsx             # creator directory
│       │   │   │   └── [handle]/page.tsx    # public creator profile
│       │   │   ├── consultants/
│       │   │   │   ├── page.tsx             # consultant directory
│       │   │   │   └── [handle]/page.tsx    # public consultant profile
│       │   │   └── layout.tsx
│       │   ├── (auth)/            # unified funnel at /auth (locked); onboarding by role
│       │   │   ├── page.tsx        # sign-in + sign-up + role dispatcher
│       │   │   └── onboarding/[role]/page.tsx
│       │   ├── (app)/            # authenticated shell, role-gated by middleware
│       │   │   ├── creator/
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── profile/edit/page.tsx
│       │   │   │   └── notifications/page.tsx
│       │   │   ├── consultant/
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── profile/edit/page.tsx
│       │   │   │   └── notifications/page.tsx
│       │   │   ├── admin/
│       │   │   │   ├── dashboard/page.tsx
│       │   │   │   ├── users/page.tsx
│       │   │   │   └── moderation/page.tsx
│       │   │   └── layout.tsx    # shared authenticated shell (bottom nav, notif bell)
│       ├── middleware.ts         # role check + redirect — at the app ROOT (sibling of app/), NOT inside a route group; Next.js only runs it here
│       └── next.config.ts
├── packages/
│   ├── ui/                       # shared component library (mobile-first primitives)
│   ├── database/                 # Supabase generated types + query helpers
│   ├── auth/                     # role/session helpers shared by middleware + server actions
│   ├── notifications/            # notification event types + emit helpers
│   └── config/                   # eslint, tsconfig, tailwind config
├── supabase/
│   ├── migrations/
│   └── functions/                # edge functions (notification fan-out, digests)
├── turbo.json
└── pnpm-workspace.yaml
```

One Next.js app, not one app per role. Role separation happens through route groups and middleware, not separate deployments — simpler auth/session handling, one place to enforce RBAC, and the public marketplace and authenticated dashboards share the same session context for the "view then sign up" flow you want.

---

## 3. RBAC model

### 3.1 Roles

- `super_admin` — full platform access, moderation, payouts oversight (added later), impersonation for support.
- `creator` — manages own public profile, campaign inbox, earnings (later).
- `consultant` — manages own public profile, client roster, campaign management tools.

Design the `role` as a single enum column now, but don't hardcode assumption that a user has exactly one role forever — a creator who becomes a consultant, or a consultant who's also brand-side, is realistic for this market. Model it as a join table (`user_roles`) even though v1 only ever inserts one row per user; it costs nothing now and avoids a migration later.

### 3.2 Core schema

```sql
-- Supabase auth.users is the source of truth for identity.
-- Everything else extends it.

create type user_role as enum ('super_admin', 'creator', 'consultant');
create type account_status as enum ('active', 'pending_review', 'suspended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,              -- public profile slug
  display_name text not null,
  avatar_url text,
  bio text,
  city text,
  country text,                             -- CM / GA / CI at launch
  phone_e164 text,                          -- primary channel for this market
  status account_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid references public.profiles(id) on delete cascade,
  role user_role not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.creator_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  categories text[],                        -- e.g. beauty, food, tech
  audience_size int,
  platforms jsonb,                          -- {tiktok: {...}, whatsapp_status: {...}}
  is_pro boolean not null default false,    -- Pro SaaS badge, from PRD pillar 2
  pro_expires_at timestamptz
);

create table public.consultant_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  specialties text[],                       -- PR, growth, media buying
  tax_id text,                              -- NIU / NCC, required before first payout
  agency_access boolean not null default false, -- gates the "database privilege" from PRD
  years_experience int
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null,                       -- 'new_message', 'campaign_invite', 'profile_approved', ...
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
```

### 3.3 RLS — enforce RBAC at the database, not just in Next.js

```sql
alter table public.profiles enable row level security;
alter table public.notifications enable row level security;

-- Public marketplace: anyone (including anon) can read active profiles.
create policy "public profiles are readable"
  on public.profiles for select
  using (status = 'active');

-- Users manage only their own profile.
create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Super admin bypass via a helper function checked against user_roles.
create policy "admins manage all profiles"
  on public.profiles for all
  using (exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'super_admin'
  ));

-- Notifications are private.
create policy "users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "users mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id);
```

This is the important architectural point: RLS is your real RBAC boundary. Next.js middleware and route groups control *what UI a role sees*; Postgres RLS controls *what data any given request can actually touch*, even if someone bypasses the UI and hits Supabase directly from the client. Don't rely on middleware alone.

### 3.4 Middleware (route-level gate)

```ts
// apps/web/middleware.ts (conceptual) — app root, NOT app/(app)/middleware.ts.
// A middleware file placed inside a route group never executes, silently disabling every gate below.
export async function middleware(req: NextRequest) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth?mode=signin', req.url)); // unified auth route (locked decision)

  const role = await getUserRole(user.id); // from user_roles
  const path = req.nextUrl.pathname;

  if (path.startsWith('/admin') && role !== 'super_admin')
    return NextResponse.redirect(new URL('/', req.url));
  if (path.startsWith('/creator') && !['creator','super_admin'].includes(role))
    return NextResponse.redirect(new URL('/', req.url));
  if (path.startsWith('/consultant') && !['consultant','super_admin'].includes(role))
    return NextResponse.redirect(new URL('/', req.url));

  return NextResponse.next();
}
```

---

## 4. Public marketplace vs. gated interaction

Landing page (`/`) and the two directories (`/creators`, `/creators/[handle]`, `/consultants`, `/consultants/[handle]`) render server-side with no auth check — this is what gets indexed by Google and shared on WhatsApp. Every interactive element on a public profile (message, invite to campaign, save/follow) is a client component that checks session state; if there's no session, it opens a sign-up modal pre-filled with intent (`?intent=message&target=<handle>`) so the person lands on the right onboarding step post-signup instead of a generic sign-up page.

Practical mobile-first note: build the public directory pages as infinite-scroll with server-rendered first page (not client-fetched from empty state) — this is what makes the marketplace feel instant on a shared WhatsApp link opened on mid-range Android.

---

## 5. In-app notifications

Given how central this is to the brief, treat it as a first-class subsystem, not a bolted-on table.

- **Write path:** every event that should notify someone (new message, campaign invite, profile approved/rejected, badge expiring) is emitted through a single `packages/notifications` helper (`notify(userId, type, payload)`) called from server actions or Postgres triggers — never written ad hoc from a component. This keeps notification copy and types centralized and consistent.
- **Read path:** Supabase Realtime subscription on `notifications` filtered by `user_id`, feeding a notification bell in the authenticated shell layout (`(app)/layout.tsx`) shared across all three roles. Unread count via the partial index above, not a client-side count query on every render.
- **Fan-out for system events** (e.g. "your profile was approved") runs via a Postgres trigger on `profiles.status` change → inserts into `notifications` → Realtime pushes it. Fan-out for user-generated events (e.g. a consultant messaging a creator) is inserted directly by the server action handling that message.
- **Digest fallback:** a daily `pg_cron` job + Edge Function rolls up unread notifications older than 24h into a single email via Resend, so nothing gets lost if someone isn't in the app.

---

## 6. Auth

Use Supabase Auth keyed on the **phone number** as the identity of record — WhatsApp-adjacent, Mobile-Money-linked users in this market are far more reliably reachable by phone than email, and phone is also your future MoMo payout identifier. Route `sign-up` to collect phone → verify → role selection (`creator` / `consultant`) → profile completion, with `status = pending_review` until an admin approves (this is your moderation gate before someone shows up in the public directory — worth keeping manual at this scale rather than auto-publishing).

> **Auth decision (v1):** the app authenticates with **email + password as the primary method** (`supabase.auth.signInWithPassword` / `signUp` on email). **Phone authentication is deferred to v2** — `profiles.phone_e164` is therefore **optional** in v1 and, when collected, serves the MoMo payout identity rather than login. Country is still captured at signup as a profile attribute.

---

## 7. Build order for v1

1. Monorepo scaffold, Supabase project, RLS policies, `profiles` / `user_roles` tables.
2. Public marketplace shell: landing, creator/consultant directories, public profile pages (no auth).
3. Auth flow: phone OTP, role selection, onboarding forms → `pending_review`.
4. Admin dashboard: approve/reject profiles, basic user list.
5. Authenticated shell + notification bell wired to Realtime, seeded with `profile_approved` / `profile_rejected` events.
6. Creator and Consultant dashboards (profile edit, own notification feed).

Everything from the PRD's Spark escrow, WhatsApp webhook engine, and Agency retainer billing sits on top of this foundation as phase 2 — this v1 is deliberately scoped to get a real, gated marketplace live first.
