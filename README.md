# Bayele

Escrow-secured marketplace connecting **Nano-Creators**, **Agency Consultants**, and
**Businesses/Brands** in Francophone Africa (Cameroon 🇨🇲, Côte d'Ivoire 🇨🇮, Gabon 🇬🇦).
Money moves through a Postgres-native escrow state machine; invoices are OHADA-compliant via
SokoClick; payouts land on MTN MoMo / Orange Money / Wave; Proof-of-Post is scored by Gemini and
**released by a human**.

Canonical spec: [`docs/bayele-production-spec-v1.1.2.md`](docs/bayele-production-spec-v1.1.2.md).
Build & QA playbook: [`docs/SKILL.md`](docs/SKILL.md). Roadmap: [`DEVELOPMENT-PLAN.md`](DEVELOPMENT-PLAN.md).

## Stack

Next.js 15 (App Router) · Supabase (Postgres + Auth + Realtime + Storage) · Turborepo + pnpm ·
Vercel (web) · Fly.io / Paris (MoMo + WhatsApp engines) · Resend (email) · Gemini 2.5 Flash (PoP).

## Layout

```
apps/web            # single Next.js app — role-separated by route groups + root middleware
packages/
  ui                # shared primitives (mobile-first, 48px tap targets)
  database          # Supabase server/browser clients + generated types
  auth              # session + role helpers
  notifications     # notify() — the single notification write path
  sokoclick-sdk     # OHADA invoicing client (PROVISIONAL — see spec header)
  config            # shared eslint / tailwind / tsconfig
services/
  momo-engine       # Fly.io — Mobile Money callbacks → escrow reconciliation
  whatsapp-engine   # Fly.io — WhatsApp Cloud API + Gemini PoP scoring
supabase/
  migrations        # 0001 schema · 0002 RLS · 0003 functions
  tests             # pgTAP — escrow state machine + RBAC
```

## Quickstart

```bash
corepack enable
pnpm install
cp .env.example .env.local          # fill in Supabase + provider keys

# Local database (Docker required):
supabase start                      # applies migrations 0001–0003
pnpm db:types                       # regenerate packages/database/src/types.gen.ts
supabase test db                    # run the pgTAP suite

pnpm dev                            # turbo runs apps/web + services
```

Web app boots at http://localhost:3000. The home landing page (`/`) and directories render without
auth; everything under `/creator`, `/consultant`, `/business`, `/admin` is gated by root
`middleware.ts` and Postgres RLS.

## Non-negotiables (see `docs/SKILL.md` §3)

RLS is the RBAC boundary, not middleware · `transition_escrow()` is the only mutator of escrow
status · `SECURITY DEFINER` functions carry their own authz check · Gemini scores, humans release ·
financial writes are atomic + idempotent · phone is the canonical identity · directory lists
creators/consultants only · XAF (CM/GA) vs XOF (CI) never mixed.
