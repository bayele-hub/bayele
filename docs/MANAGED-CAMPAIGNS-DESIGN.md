# Managed campaigns (« Bayele gère tout ») — UI/UX design specification

| | |
|---|---|
| **Seat** | Principal UX Architect · Head of Growth + Mobile UX (UI/UX role) |
| **Implements** | `docs/MANAGED-CAMPAIGNS-PLAN.md` (council M1–M10, process §2, order form §3, listing standard §4, levers §7) + Co-CTO decisions K1–K9 |
| **Builds on** | `docs/CAMPAIGNS-PUBLIC-PAGE-DESIGN.md` (board, ticket, soft wall, WhatsApp share) — same tokens, same components, nothing re-invented |
| **Design standard** | `epic-design/SKILL.md` **Mode 2 — enhance existing site** (CSS-only motion) · `docs/SKILL.md` §6 |
| **Audience** | Frontend seat (build without guessing), Backend seat (data needs §0.4), QA (acceptance), Ops (admin flows) |
| **Date** | 2026-10-11 |

**Bottom line.** Managed campaigns are an *operations* feature first: an admin on a phone turns a
WhatsApp brief into a funded listing. So the boldness goes into **one admin object — the live
pay panel** (« Net par place » in display type, with the pay-floor verdict under it), and the public
side changes as little as possible: a quiet **« Géré par Bayele »** mark next to an honest brand line
(`brand_label · ville`) and a short « L'essentiel de l'offre » block on the campaign page. No new
tokens, no new keyframes, no new libraries. Publishing reuses the existing escrow path exactly:
**« Publier » creates the campaign (invisible), the admin then confirms the funding in the existing
Financement queue, and only that confirmation puts it online.** Nothing in this spec shows a number
that is not typed by an admin or computed from typed numbers; the pay-floor table ships empty and the
UI says so.

**Typography note for this file.** French strings contain the real U+00A0 (before `:` and inside
« ») and U+202F (before `?` `!` `;` `%`). Copy-paste them as-is into `messages/fr.json`. English
uses no space before `:` `?` `!` `%`.

---

## 0. Foundations

### 0.1 Tokens and existing pieces reused (no new tokens)

| Purpose | Token / component |
|---|---|
| Text, secondary, hairline, panel | `text-ink` · `text-muted` · `border-line` · `bg-surface` |
| Primary action | `bg-brand hover:bg-brand-600 text-white` (5.7:1) |
| Brand-colour labels on white | `text-brand-700` — never `text-accent` on white (2.2:1) |
| Signature accent | `bg-accent` fills and dots; `text-accent` only on `bg-ink` |
| Admin card | `rounded-2xl border border-line bg-white p-4 shadow-card` (as `FundingQueue`, `RetainerAdminRow`) |
| Public card / ticket | `CampaignCard`, `CampaignTicket`, `card-parts.tsx` — extended, not forked |
| WhatsApp glyph | `WhatsAppTile` from `card-parts.tsx` (green tile, white glyph; never white text on green) |
| Tap target | `min-h-tap` (48 px) everywhere, including admin |
| Money | `formatFcfa(n, locale)` (U+00A0 before FCFA) on public pages; `fmtFcfa` in admin (FR) |
| Status success / error | `bg-emerald-50 text-emerald-700` · `bg-rose-50 text-rose-700` (existing admin usage) |

### 0.2 New shared components (names are binding for the Frontend seat)

| Component | File | Used by |
|---|---|---|
| `ManagedBadge({ tone: 'light' \| 'dark', size: 'sm' \| 'md' })` | `components/campaigns/managed-badge.tsx` | card, ticket, home strip, campaign page, admin preview |
| `BrandLine({ c, tone })` — prints `brand_label · ville` + badge for managed, « par {brand} » otherwise | `components/campaigns/card-parts.tsx` (replaces `ByBrand` call sites) | card, ticket, campaign page |
| `PublishWhatsAppCta({ source, variant: 'button' \| 'link' \| 'band', tone })` — renders `null` when `NEXT_PUBLIC_BAYELE_WHATSAPP` is unset or invalid | `components/publish-whatsapp-cta.tsx` | home, `/campaigns`, auth (brand), new-campaign form, pricing |
| `bayeleWhatsappHref(text)` → `string \| null` (digits-only check `^\d{8,15}$`, else `null`) | `lib/whatsapp.ts` | the CTA above; never hardcode a number (K5) |
| `NetPayPanel`, `PayFloorVerdict`, `MandatoryChecklist`, `OrderFormCopy` | `app/(app)/admin/briefs/_components/*` | brief editor |
| `managedTemplates` (13 industry templates, text only, no prices) | `lib/managed-templates.ts` | admin editor + brand form |
| `DELIVERABLE_TYPES`, `RIGHTS_PRESETS`, `LANGUAGES` | `lib/managed-listing.ts` | admin editor, brand form, pay-floor page, public page |
| `netPerPlace(total, places)` = `Math.floor(total * 0.75 / places)` and `floorCheck(type, units, net, floors)` (same rule as `private.managed_floor_check`) | `lib/managed-listing.ts` (+ `.test.ts`) | editor preview; the **same** rule is enforced server-side (`below_pay_floor`, K1) |

### 0.3 Motion

Admin screens: **no motion** beyond existing `transition` on hover/focus and the `Loader2` spinner
on pending submits (ops tool; speed over show). Public side: the badge and the new campaign-page
block are static and inherit the card's existing `[data-reveal="up"]`. The WhatsApp CTAs are static.
Nothing new to add to the reduced-motion list.

Depth assignment for the new public elements (epic-design Mode 2): `ManagedBadge` = depth 4 (UI text,
part of the brand line — not a floating sticker); « L'essentiel de l'offre » block = depth 4 on the
existing card; the « Géré par Bayele » explainer panel = depth 4 on `bg-surface` (depth 0 panel).
No new depth 0–2 decoration.

### 0.4 Data the UI needs — aligned with migration `0033_managed_campaigns` (Backend seat, in progress)

The design follows the schema the Backend seat is writing; where the UI needs something the
migration does not have, it is listed in §12.2.

`campaigns` (plan §6): `is_managed`, `brand_label`, `brand_consent` (internal), `brand_city`,
`language`, `usage_rights`, `creator_requirements`, `equipment`. Public reads go through
`public_campaign_board_v2` / `public_campaign_stats_v2`, which return `brand_name = brand_label` and
**`brand_handle = null` when managed** (so the brand line never links to the admin's profile) plus
`is_managed`, `brand_city`. The page also needs `language`, `usage_rights`, `creator_requirements`,
`equipment` — anon-readable columns (column grant in 0033), read with the existing public select.

`managed_briefs` (admin-only) — fields the editor reads/writes (via `admin_upsert_managed_brief`):

| Field | Editor use |
|---|---|
| `brand_name` | Internal brand name (required, never public) |
| `brand_label`, `brand_consent` | Public label + K3 consent switch |
| `contact_name`, `contact_whatsapp` (E.164 with `+`) | Nudges and « Ouvrir dans WhatsApp » (`wa.me` takes the digits) |
| `country`, `city` | Public once published |
| `sector` | The template picked (FR label), analytics only |
| `category` | Board category (always set explicitly by the editor) |
| `service`, `title` | SERVICE (order form) and public title (defaults to `service`) |
| `deliverables` | Members-only detail → `campaigns.brief` |
| `deliverable_type`, `deliverable_count` | **Main deliverable** and units per place → floor check (K1) |
| `content_type` | Set automatically by the editor from `deliverable_type` (FR label), not a separate input |
| `platforms` | Required by the publish RPC |
| `places`, `total_budget_fcfa`, `deadline` | K7 math, deadline |
| `language`, `usage_rights` (resolved preset text), `creator_requirements`, `equipment` | Public once published |
| `order_confirmed_at`, `order_proof` | The « OUI » step |
| `deposit_status` (`none` / `partial` / `full`) | Informational « Acompte reçu » in the Payment card |
| `floor_check` (`not_set` / `pass` / `below`, server-computed) | Tracker chips; the editor computes the same thing live |
| `status`, `campaign_id` | Lifecycle (§1.1); once `campaign_id` is set the lifecycle is system-owned |
| `notes` | Internal notes (decline reason is prepended, §2.10) |

`pay_floors(deliverable_type, min_net_fcfa, updated_at, updated_by)` — ships **empty**; read with
`pay_floor_list()`, written with `admin_set_pay_floor` / `admin_clear_pay_floor`.

**Publish.** `admin_publish_managed_brief(brief_id)` checks the listing standard + the « OUI » +
the floor, creates the campaign (`pending_funding`, invisible, owner = admin, fee 0.25, payout = K7
net) and sets the brief to `awaiting_payment`. `admin_confirm_campaign_funding` (unchanged, from the
Financement queue) publishes it; a trigger moves the brief to `published`.

**Funding queue (`/admin/funding`).** Its select must also read `is_managed, brand_label, brand_city`
so a managed row shows the brand label, not the admin's own display name (§4).

---

## 1. Admin « Briefs gérés » — intake tracker

Route `/admin/briefs`. New nav tab in `admin-nav.tsx`, **placed before « Campagnes »** so the tab
order follows the money: Briefs gérés → Campagnes (financement) → Paiements. Icon `ClipboardList`,
label « Briefs gérés ». No count badge in the nav (same rule as the public header: no per-page
queries in navigation).

### 1.1 Status pipeline (what each status means — one meaning, shown everywhere)

Order of the rail = order of the work: **Brouillon › En attente du « OUI » › Prête à publier ›
En attente du paiement › Publiée** (· Refusée). « Prête » comes *before* payment because creating the
campaign is harmless (it stays invisible in `pending_funding`) and the existing Financement
confirmation is the only way money and publication meet (M2, K6).

| Status | FR label | Means | Entered when | Next action shown |
|---|---|---|---|---|
| `draft` | Brouillon | Listing being filled | « Nouveau brief » or « Rouvrir » | « Compléter » |
| `awaiting_order` | En attente du « OUI » | Listing complete, order form sent | Admin taps « J'ai envoyé le bon de commande » (needs checklist items 1–14 green and floor not « Sous le seuil ») | « Enregistrer le OUI » · « Relancer » |
| `ready` | Prête à publier | « OUI » + proof recorded, listing complete | Admin records the « OUI » + proof | « Publier » |
| `awaiting_payment` | En attente du paiement | Campaign created, **invisible**, waiting for the money and its confirmation | « Publier » succeeded (`admin_publish_managed_brief`) | « Confirmer le financement » · « Relancer » |
| `published` | Publiée | Funded and online | Funding confirmed in Financement (trigger) | « Voir l'annonce » · « Dupliquer » |
| `declined` | Refusée | Will not be published | « Refuser le brief » from any status before `published` | « Rouvrir » |

Editing any public field while `awaiting_order` or `ready` drops the brief back to `draft` with a
notice (« Le bon de commande doit être renvoyé : vous avez modifié … ») — the brand must say « OUI »
to what is published. From `awaiting_payment` on, the listing fields are **read-only** in the editor
(the campaign exists); a read-only banner says « L'annonce est créée. Pour la changer avant le
financement, refusez ce brief puis dupliquez-le. »

### 1.2 Page layout (mobile first, 360 px)

```
H2 « Briefs gérés »  · muted count « 12 briefs »            [ + Nouveau brief ]   ← full width < sm
link « Seuils de rémunération → »  (text-xs, text-brand-700)

PIPELINE RAIL (filter)   Tous 12 › Brouillon 3 › « OUI » 2 › Prête 1 › Paiement 1 › Publiée 4 · Refusée 1
SEARCH  [ 🔍 Marque, descripteur ou téléphone ]   [ Pays ▾ ]

LIST of brief cards (oldest action first)
```

- **Pipeline rail** = the status filter. `<nav aria-label="Filtrer par statut">` → `<ul>` of
  `<Link scroll={false}>` chips, `?status=awaiting_order`. Chip:
  `inline-flex min-h-tap items-center gap-1.5 whitespace-nowrap rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink`
  + count in `tabular-nums text-muted`; active `border-brand bg-brand text-white` + `aria-current="true"`
  (same as `AdminNav`). The `›` separators between the five active-path statuses are `aria-hidden`
  `text-muted`; « Refusée » sits after a `·` because it is off the path. Mobile: horizontal rail
  `no-scrollbar -mx-4 overflow-x-auto px-4`; desktop: wraps.
- **Search** `q` (internal name, `brand_label`, contact phone digits) and **Pays** `<select>`
  (« Tous les pays » + `countryOptions`, names only, no flags). Both are a GET `<form>` (works without JS).
- **Sort.** Active statuses (`draft`, `awaiting_order`, `ready`, `awaiting_payment`): `updated_at` ascending — the brief waiting longest is
  on top. `published` / `declined` filters: `updated_at` descending.
- **Default view** (no `status`): every status except `published` and `declined` (the work queue).
  « Tous » shows everything.

### 1.3 Brief card (one per row)

`<li>` → `<article class="rounded-2xl border border-line bg-white p-4 shadow-card">`, the whole card is
not a link (it carries buttons); the internal name is the link to `/admin/briefs/{id}`.

```
┌──────────────────────────────────────────────────────────┐
│ [En attente du « OUI »]                    il y a 3 j  ⚠ │  status pill · age · stale flag
│ Saveurs du Wouri SARL                                    │  internal name (link, font-bold)
│ Public : Restaurant · Douala   [Descripteur]             │  eye icon + brand_label · city + consent chip
│ Pack contenu food pour un restaurant                     │  service (line-clamp-1)
│ Cameroun · Date limite 28 oct. · Français                │
│ ───────────────────────────────────────────────────────  │
│ 70 000 FCFA total  →  52 500 FCFA / place × 1            │  K7 figures, tabular-nums
│ (●) Seuil non défini        ▢▢▢▢▢▢▢▢▢▢▢▢ 13/15 champs     │  floor chip · checklist progress
│ [ Enregistrer le OUI ]  [ Relancer sur WhatsApp ]        │  next actions (status-specific)
└──────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Status pill | `rounded-full px-2.5 py-0.5 text-[11px] font-bold`: `draft` `bg-surface text-muted` · `awaiting_order` / `awaiting_payment` `bg-accent-soft text-ink` · `ready` `bg-brand-50 text-brand-700` · `published` `bg-emerald-50 text-emerald-700` · `declined` `bg-rose-50 text-rose-700`. Text always present (colour is never the only signal). |
| Age | « il y a 3 j » from `updated_at`, `text-[11px] text-muted`, `<time dateTime>` |
| Stale flag | `awaiting_order` or `awaiting_payment` untouched > 48 h → `AlarmClock` icon `text-rose-600` (`aria-hidden`) + visible-to-SR text « À relancer » (`sr-only`). 48 h mirrors the brand approval window in M6. |
| Internal name | `font-bold text-ink` link, `line-clamp-1` |
| Public line | `Eye` icon (muted) + « Public : » + `brand_label · city` (`font-semibold text-ink`) + consent chip: « Nom réel autorisé » (`bg-emerald-50 text-emerald-700`) or « Descripteur » (`bg-surface text-muted`). Empty label → « Public : à définir » in `text-rose-600`. |
| Facts row | `text-xs text-muted`, items separated by `·`, each hidden when empty |
| Money row | « {total} total → {net} / place × {places} » — `font-display font-extrabold text-ink` for the net; hidden until budget and places are both set |
| Floor chip | §2.6 states, compact: « Seuil non défini » / « Seuil OK » / « Sous le seuil » |
| Checklist progress | 15-segment bar `aria-hidden` (filled `bg-brand`, empty `bg-line`, `h-1.5`) + text « 13/15 champs » (the text carries the meaning) |
| Next actions | Max two buttons, primary `bg-brand text-white` (first) + secondary `border border-line bg-white text-ink`; both `min-h-tap rounded-lg px-3 text-xs font-bold`. Per status as in §1.1. « Relancer sur WhatsApp » is an `<a href="https://wa.me/{contact_whatsapp}?text=…">` with `WhatsAppTile` (messages in §10, `admin.briefs.nudge.*`); hidden when no contact number. |

### 1.4 Empty states

| Case | Render |
|---|---|
| No briefs at all | Centered panel `rounded-2xl border border-line bg-white p-8 text-center`: `ClipboardList` tile (`h-12 w-12 rounded-2xl bg-brand-50 text-brand`), H3 « Aucun brief géré pour l'instant », body « Quand une marque envoie son brief par WhatsApp, créez-le ici : le formulaire suit le standard d'annonce, calcule la rémunération nette et prépare le bon de commande. », primary « Nouveau brief ». No sample rows, no fake brief. |
| Filter returns nothing | One line `text-sm text-muted` « Aucun brief dans ce statut. » + link « Voir tous les briefs ». |
| Search returns nothing | « Aucun brief ne correspond à « {q} ». » + link « Effacer la recherche ». |

---

## 2. Admin brief editor — « Nouveau brief géré »

Routes `/admin/briefs/new` and `/admin/briefs/{id}`. One form, explicit saves (no autosave): drafts
may be incomplete; the server never rejects a draft save for missing fields, only for invalid ones
(negative budget, past deadline).

### 2.1 Layout

**Mobile (default).** Single column, sections as numbered cards. The numbers are true: they are the
listing standard's order (M8), which is also the order of the published page — numbering is
justified here (docs/SKILL.md §6).

```
← Briefs gérés
H2 « Nouveau brief géré »   [Brouillon]          (existing: « Brief géré · {internal name} »)
TEMPLATE RAIL  « Partir d'un modèle »  [Restaurant] [Mode] [Beauté] …
① Marque   ② Service   ③ Livrables   ④ Date limite   ⑤ Budget   ⑥ Droits d'usage
⑦ Profil créateur   ⑧ Candidature
— Bon de commande (internal) —   — Publication + Paiement —
Notes internes · Refuser le brief
STICKY BAR (bottom of <main>)
```

**Sticky bar (mobile, `sticky bottom-0`, inside the scrolling `<main>` so it sits above `BottomNav`):**
`-mx-4 border-t border-line bg-white/95 px-4 py-2 backdrop-blur` →
left: « Net / place » `text-[11px] text-muted` + amount `font-display text-lg font-extrabold tabular-nums`
(« — » until computable) and the floor chip under it; right: « 13/15 » checklist count (a button that
scrolls to the checklist) + primary « Enregistrer » (`min-h-tap rounded-xl bg-brand px-4 text-sm font-bold text-white`).
After a successful save the button shows `Check` « Enregistré » for 2 s and a `role="status"` line
« Enregistré à 14 h 32 ».

**Desktop (≥ lg).** `lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6`. Left: the sections. Right:
`lg:sticky lg:top-4` aside with, in order: **Aperçu public** (a non-interactive mini card: brand line +
`ManagedBadge`, title, net per place, places, deadline — what the board will show), **`NetPayPanel`**,
**`PayFloorVerdict`**, **`MandatoryChecklist`**, **status + primary action** for the current step.
The sticky bar is hidden at `lg`.

Unsaved-changes guard: a small client hook sets `beforeunload` while the form is dirty.

Field shell (all sections): label `text-xs font-semibold text-ink`; input
`mt-1 w-full min-h-tap rounded-xl border border-line bg-white px-3 text-[16px] sm:text-sm text-ink focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30`
(16 px on phones: no iOS zoom); helper `mt-1 text-[11px] text-muted`; error `mt-1 text-[11px] text-rose-600`
with `aria-describedby`. Each field carries a **visibility tag** at the right of its label:
`Globe` « Public » / `Lock` « Membres » / `EyeOff` « Interne » (`text-[10px] font-bold uppercase tracking-wide text-muted`)
— so the admin always knows who will read what they type (soft wall + K3).

### 2.2 Template rail — « Partir d'un modèle »

- Horizontal chip rail (13 templates, §9), same chip style as the pipeline rail, plus « Aucun ».
- **Fills text only** (K1): SERVICE, category, main deliverable type (units left empty), platforms,
  deliverables detail, creator requirements, equipment, rights preset, and an **admin-only compliance
  hint** shown as an amber note under ③ (e.g. « Allégations financières à justifier »). It **never**
  touches brand, city, country, deadline, budget, places, quantities, or any price.
- If any of those text fields is non-empty, choosing a template shows an inline confirm (not a modal):
  `rounded-xl border border-line bg-surface p-3 text-xs` « Ce modèle remplace le service, les
  livrables, le profil et les droits déjà saisis. » [Remplacer] [Annuler].
- Helper under the rail: « Les modèles proposent du texte, jamais de prix. »

### 2.3 ① Marque (BRAND + city/country)

| Field | Vis. | Rules |
|---|---|---|
| Nom de la marque (interne) | Interne | Required. Helper « Nom légal ou commercial, pour le bon de commande. Jamais affiché. » |
| Contact · Nom | Interne | Optional |
| Contact · WhatsApp | Interne | `type="tel" inputMode="tel"`, placeholder = dial prefix of the chosen country (`COUNTRIES[c].dial`), stored as E.164 with `+` (DB check). Enables « Relancer » and « Ouvrir dans WhatsApp ». |
| Affichage public | — | Two radio cards (same pattern as the brand form's Visibilité cards): **« Descripteur »** (default, `Store` icon, « Ex. Restaurant, Marque de mode ») / **« Nom réel »** (`BadgeCheck`, « Seulement avec un accord écrit »). |
| Libellé public (`brand_label`) | Public | Required. Descriptor mode helper: « Décrivez l'activité sans la ville (elle s'affiche à côté). N'utilisez jamais le nom d'une autre entreprise. » Real-name mode helper: « Le nom exact que la marque a accepté de voir publié. » |
| Consentement écrit reçu (`brand_consent`) | Interne | Switch, only in « Nom réel » mode, required ON there. Hint (K3): « Une capture du « OK » WhatsApp suffit. Sans accord, utilisez un descripteur : l'annonce affiche toujours « Géré par Bayele ». » |
| Preuve du consentement | Interne | Required when consent is ON: « Ex. capture WhatsApp du 12/10, enregistrée dans le dossier client. » (stored in `notes` until a column exists — Co-CTO question 7) |
| Ville | Public | Required, free text |
| Pays | Public | Required, `<select>` of the 6 countries, names only |

**Machine-checkable guard (the part of K3 that can be checked).** In descriptor mode, if
`brand_label` contains the internal name (case- and accent-insensitive), error: « Sans
consentement, le libellé public ne peut pas reprendre le nom de la marque. » Saving a draft is allowed;
sending the order form and publishing are not.

Live line under the section: « Aperçu : **Restaurant · Douala** [Géré par Bayele] » (real `BrandLine`
component, light tone).

### 2.4 ② Service · ③ Livrables · ④ Date limite

**② Service** — « Service » Public, required, max 90 chars with a counter, placeholder from the
template (« Pack contenu food pour un restaurant »); used in the order form and, by default, as the
listing title. « Titre de l'annonce » (Public, optional, same limit) overrides it on the board — most
admins leave it empty. « Catégorie » Public, required, `<select>` of `CATEGORY_VALUES` (board filters
and alerts).

**③ Livrables** — the schema carries **one main deliverable** per brief (K1 floors are per unit of a
type):
- Row `[Livrable principal ▾ (DELIVERABLE_TYPES)] [Unités par place]` — both required;
  `inputMode="numeric" min=1`. Helper: « Le livrable qui coûte le plus à produire. Les autres vont
  dans le détail. » (e.g. a restaurant pack of 10 photos + 5 videos → main = Vidéo courte × 5, the
  photos in the detail).
- « Plateformes » chip toggles (WhatsApp, TikTok, Instagram, Facebook, YouTube, LinkedIn) — Public,
  required (the publish RPC requires at least one).
- « Détail des livrables » textarea (Membres, required) — everything that will be delivered, formats,
  durations, what to show, do/don't. Prefilled by the template. Becomes the members-only brief.
- Template compliance hint (amber note `rounded-xl border border-accent/30 bg-accent-soft p-3 text-[12px] text-ink`,
  `TriangleAlert`), Interne. Includes the standing reminder « La mention « #pub » est obligatoire sur
  les publications sponsorisées. »

`content_type` is not asked: the editor writes the FR label of the main deliverable.

**④ Date limite** — `type="date"`, Public, required, must be after today (Africa/Douala calendar
day; the RPC raises `deadline_passed` otherwise). Helper « Date de livraison au plus tard, celle du
bon de commande. »

### 2.5 ⑤ Budget — `NetPayPanel` (the signature element)

Inputs: « Budget total de la marque (FCFA) » (required, `inputMode="numeric"`, helper « Frais Bayele
25 % inclus — le montant que la marque paie. ») and « Places (nombre de créateurs) » (required,
default 1). Fee line is fixed text, not an input: « Formule Agency · 25 % — fixe pour les campagnes
gérées. »

The panel (`rounded-2xl bg-ink p-5 text-white` — the only dark object in the admin; it is the number
the creator will see, so it gets the ticket's ink):

```
Budget total marque                 100 000 FCFA
Frais Bayele (25 %)               − 25 000 FCFA
Rémunération créateurs              75 000 FCFA
÷ 5 places
──────────────────────────────────────────────
NET PAR PLACE                                         ← text-[12px] font-bold uppercase text-accent
15 000 FCFA                                           ← font-display text-[2.25rem] font-extrabold tabular-nums
Par unité : 7 500 FCFA (2 vidéos courtes)             ← net ÷ units per place
C'est le montant affiché sur l'annonce.               ← text-[12px] text-white/70
```

- Math (K7): fee = `floor(total × 0.25)`, pool = `total − fee`, **net per place = `floor(total × 0.75 ÷ places)`**,
  per unit = `floor(net ÷ units)`. Same functions as the server (`lib/managed-listing.ts`).
- If `net × places < pool` (rounding), one muted line: « Arrondi non attribué : {n} FCFA » (see Co-CTO question 3).
- Incomplete inputs: amounts show « — », no zeros.
- Live: recomputed on input (client), `aria-live="polite"` on the net amount only (not every line), debounced 400 ms.
- `budget_math_check` holds by construction (`net × places ≤ total`); the server re-checks.

### 2.6 `PayFloorVerdict` — three states, always one visible

Floors are per **unit** of the main deliverable type (K1). Same rule as `private.managed_floor_check`:
`required_per_place = floor(type) × units_per_place`; verdict compares it with the K7 net per place.

| State | When | Render | Effect |
|---|---|---|---|
| **Seuil non défini** | No floor for this type (the launch state — the table ships empty), or budget/places not filled yet | `rounded-xl border border-line bg-surface p-3` · `CircleDashed` (muted) · « Seuil non défini » + « Aucun seuil n'est fixé pour ce livrable : la publication est autorisée. » + link « Seuils de rémunération » | Allowed |
| **OK** | `net ≥ required_per_place` | `border-emerald-100 bg-emerald-50 text-emerald-700` · `CheckCircle2` · « Au-dessus du seuil » + « {perUnit} par unité ≥ {floor} requis. » | Allowed |
| **Sous le seuil — contre-proposition** | `net < required_per_place` | `border-rose-200 bg-rose-50 text-rose-700` · `TriangleAlert` · « Sous le seuil — contre-proposition » + « Il manque {gap} par place. » + two computed options + « Copier la contre-proposition » | Order form and « Publier » disabled, with the reason in their helper text. The RPC raises `below_pay_floor` anyway. |

The two counter-offer options are pure arithmetic from the stored floor (no invented figure):
- « Même travail : budget total de **{ceil(floor × units × places ÷ 0.75)}** ».
- « Même budget : **{floor(net ÷ floor)} {type}** par place au lieu de {units} » (hidden when it would be 0).
« Copier la contre-proposition » copies `admin.briefs.nudge.counterOffer` filled with these values
(FR or EN per the order-form language toggle, §2.9). The tracker row uses the server's stored
`floor_check`; the editor computes live and the server re-checks on save and on publish.

### 2.7 ⑥ Droits d'usage · ⑦ Profil créateur · ⑧ Candidature

**⑥ Droits d'usage** (Public, required) — radio list of `RIGHTS_PRESETS` (§9.3), the M7 default
pre-selected: « Usage organique sur les réseaux de la marque, {pays}, 6 mois ». « Personnalisé » opens
a textarea (required then). `{pays}` resolves from ① live. A fixed line under the list, not editable:
« Le créateur garde la paternité du contenu et peut le montrer dans son portfolio. » (M7; shown on
the public page too).

**⑦ Profil créateur**
| Field | Vis. | Rules |
|---|---|---|
| Profil recherché (`creator_requirements`) | Public | Required, textarea 2 rows, template-prefilled. Helper « Ce qui compte pour réussir : style, expérience, langue parlée face caméra. Pas de critère physique ni d'âge. » |
| Langue du contenu | Public | Required `<select>` of `LANGUAGES` (§9.4); « Autre » reveals a text input |
| Matériel | Public | Optional; helper « Seulement si indispensable — sinon laissez vide. » |

**⑧ Candidature** — not editable, an info card `bg-surface` with `Info` icon: « Candidature via
Bayele, compte créateur requis. Bayele présélectionne 2 à 3 profils par place ; la marque valide sous
48 h (sans réponse, Bayele choisit). » This is the text the public page prints (§5.4).

### 2.8 `MandatoryChecklist` (§4 of the plan, 15 items)

Desktop: in the aside. Mobile: a card after ⑧, also reachable from the sticky bar count. Each item is a
`<li>` with `CheckCircle2` (emerald) or `Circle` (muted) + label; an unmet item is a link `href="#field-…"`
that focuses the field. Heading « Avant publication » + « 13/15 ». Items 1–14 mirror the publish RPC's
`missing_fields` list, so the UI never lets the admin press a button the server will refuse.

| # | Item | Green when |
|---|---|---|
| 1 | Libellé public | `brand_label` set and the K3 guard passes |
| 2 | Consentement cohérent | descriptor mode, or real-name mode with consent ON |
| 3 | Service | `service` (or `title`) set |
| 4 | Livrables | main type + units set, detail text set |
| 5 | Plateformes | ≥ 1 |
| 6 | Ville | set |
| 7 | Pays | set |
| 8 | Langue | set |
| 9 | Date limite | set and in the future |
| 10 | Budget total | > 0 |
| 11 | Places · net par place | places ≥ 1 and net per place ≥ 1 FCFA |
| 12 | Droits d'usage | preset chosen (custom: text set) |
| 13 | Profil créateur | set |
| 14 | Seuil | state is « non défini » or « OK » |
| 15 | « OUI » de la marque | `order_confirmed_at` + `order_proof` |

« Financé ✅ » (§4) is deliberately **not** an item: it is the Financement confirmation itself (§2.10).
Equipment is optional and has no item.

### 2.9 Bon de commande (internal section) — copy + « OUI »

Card heading « Bon de commande » + `EyeOff` « Interne ».
1. Language toggle « Texte en : [FR] [EN] » (segmented, default FR; the brand's language).
2. `<details>` « Voir le texte » with a read-only `<pre class="whitespace-pre-wrap rounded-xl bg-surface p-3 text-[12px]">` of the filled template (§2.9.1).
3. Buttons: **« Copier le bon de commande »** (primary; `navigator.clipboard.writeText`, fallback:
   select the `<pre>` text; success `role="status"` « Bon de commande copié ») and **« Ouvrir dans
   WhatsApp »** (secondary, `wa.me/{contact_whatsapp}?text=…`, hidden without a contact number).
   Both disabled until checklist items 1–14 are green; disabled helper lists what is missing
   (« Il manque : Date limite, Langue »).
4. « J'ai envoyé le bon de commande » (secondary) → `awaiting_order`.
5. **« OUI » reçu** — switch + `datetime-local` (default now) + « Preuve » text, required:
   placeholder « Ex. capture du « OUI » WhatsApp du 12/10 à 10 h 14 ». Saving with the switch ON (date → `order_confirmed_at`,
   proof → `order_proof`) → `ready`. (EN briefs accept « YES »; the label says « « OUI » (ou « YES ») reçu ».)

#### 2.9.1 Fill rules for the plan §3 template

The text is the plan's template verbatim with blanks filled; nothing is added except the per-creator
amount in brackets when places > 1.

| Blank | Value |
|---|---|
| Marque | `internal_brand_name` |
| affichage public | `☑ nom réel ☐ « … »` when consent, else `☐ nom réel ☑ « {brand_label} · {city} »` |
| Contact / Tél. WhatsApp | `contact_name` / `+{contact_whatsapp}` (blank stays « … » if empty) |
| Service | `title` |
| Livrables | « {units} × {main type} par créateur » + ` — ` + first sentence of the detail (« 5 × Vidéo courte par créateur — 10 photos du menu et 5 vidéos… ») |
| Nombre de créateurs | `places` |
| Ville / pays · Langue | `city`, country name (FR/EN) · language label |
| Date limite | `dd/mm/yyyy` |
| Droits | resolved `usage_rights` text (replaces the template's default sentence) |
| Budget total / rémunération créateurs | `formatFcfa(total)` / `formatFcfa(pool)` (+ « (soit {net} par créateur) » when places > 1) |
| Paiement / Validation / « OUI » lines | verbatim |

EN template (for the toggle; Ops tracker item « Order-form PDF (FR/EN) » can reuse it):

```
ORDER FORM — Campaign managed by Bayele
Brand: ………………  (public display: ☐ real name  ☐ "{sector} · {city}")
Contact: ………………  WhatsApp: ………………
Service: ………………
Deliverables: ………………   Number of creators: ……
City / country: ………………   Language: ………………
Delivery deadline: ……/……/……
Rights: organic use on your channels, {country}, 6 months (paid ads optional: ……)
Total budget: ……… FCFA, 25% Bayele fee included → creator pay: ……… FCFA
Payment: 100% before publishing (Mobile Money / invoice).
Approval: shortlist within 48 h; 2 revision rounds; no reply within 72 h after delivery = delivery accepted.
Reply "YES" to confirm.
```

### 2.10 Publication + Paiement — the funded gate, exactly as the admin lives it

**Publication card** (heading « Publication ») with a 2-step indicator that is literally the
mechanism (so numbering is honest): ① « Créer la campagne » ② « Confirmer le financement ».

1. In `ready` (all 15 green), primary **« Publier »** opens an inline confirm panel (not a modal):
   > « Publier se fait en 2 étapes. 1. La campagne est créée, invisible sur Bayele. 2. Dès que le
   > paiement est arrivé, vous confirmez le financement dans Financement avec la référence du reçu :
   > la campagne passe en ligne et les créateurs sont prévenus dans l'application. »
   > [Créer la campagne] [Annuler]
2. **« Créer la campagne »** → `admin_publish_managed_brief`. The brief moves to `awaiting_payment`.
   Error codes → copy: `below_pay_floor` « Sous le seuil de rémunération : envoyez une
   contre-proposition. » · `missing_fields` « Champ manquant : {fields}. » (field names mapped to
   checklist labels) · `order_not_confirmed` « Enregistrez d'abord le « OUI » de la marque. » ·
   `deadline_passed` « La date limite est passée : choisissez une nouvelle date. » · other « La
   création a échoué. Réessayez. »
3. The card now reads `Clock` « Étape 2 sur 2 — financement à confirmer » + « La campagne existe mais
   reste invisible tant que le financement n'est pas confirmé. » and shows the **Paiement** block:
   - « Acompte reçu » segmented control `Aucun · Partiel · Complet` (`deposit_status`, informational —
     helps the tracker; M3 default is 100 %).
   - Primary **« Confirmer le financement »** → `/admin/funding?campaign={campaign_id}`.
   - Secondary « Relancer sur WhatsApp » (payment nudge).
4. On `/admin/funding` the matching row is **pinned first**, outlined (`ring-2 ring-brand`) and
   scrolled into view. The admin types the provider receipt reference, picks the provider and taps
   the existing « Confirmer le séquestre ». Same component, same `fundCampaignAction`, same
   `admin_confirm_campaign_funding` RPC — no fork (K6). The reference is typed **only here**, from
   the receipt (never from a screenshot), exactly like every other campaign.
5. Success in the queue (existing message « Séquestre activé — la campagne est publiée. ») + for
   managed rows two links « Voir l'annonce publique » → `/campaigns/{id}` and « Retour au brief » →
   `/admin/briefs/{briefId}`. The trigger sets the brief to `published`; its Publication card shows
   `CheckCircle2` « Publiée le {date} » + « Voir l'annonce » + « Copier le lien » (to send to the
   brand on WhatsApp).

What the admin never sees: a « publish » that silently waits, or a public listing before funding.
Between steps 2 and 4 the campaign sits in the Financement queue with a « Gérée » chip **and** the
tracker shows it under « En attente du paiement » with its age and stale flag, so a forgotten step is
visible from both screens.

**Refuser le brief** (bottom of the page, quiet text button `text-rose-700`): reason `<select>`
(« Sous le seuil, contre-proposition refusée » · « Sans réponse de la marque » · « Hors périmètre
(récurrent, contenu interdit…) » · « Autre ») + note → `declined`; the reason is prepended to `notes`
(« [Refus] Sans réponse de la marque — … »). If a campaign was already created and is still
`pending_funding`, the action must also cancel it (Co-CTO question 4); the confirm text says so: « La
campagne créée (non financée) sera annulée. »

**Dupliquer** (published or declined briefs): copies every listing field into a new draft, without
status, « OUI », deposit and `campaign_id` — this is how a monthly renewal is sold (M9: one funded
month, renewed by a new order).

---

## 3. Admin « Seuils de rémunération » — `/admin/pay-floors`

Linked from the Briefs header, the floor verdict and the checklist; no nav tab (ten tabs would push
« Séquestre » off a 360 px rail).

**Header.** H2 « Seuils de rémunération » + body (honest, no numbers):
« Montant net minimum qu'un créateur doit recevoir par unité livrée, après les frais Bayele. Ces
seuils seront fixés par Finance et Communauté à partir des données réelles de Bayele. Tant qu'un seuil
n'est pas défini pour un type de livrable, les campagnes gérées de ce type peuvent être publiées. »

**Banner when the table is empty** (`rounded-xl border border-line bg-surface p-3 text-xs`,
`CircleDashed`): « Aucun seuil défini pour l'instant. »

**List** — one row per `DELIVERABLE_TYPES` entry (all 9, §9.2). Row (`rounded-2xl border border-line bg-white p-4`):

```
Vidéo courte (Reel, TikTok, Short)          Non défini           ← state chip (bg-surface text-muted)
par vidéo
[ ________ ] FCFA net / unité   [ Enregistrer ]
```
- Input: `inputMode="numeric"`, **empty, no placeholder number** (placeholder « — »). Saving a value
  asks inline confirmation: « Les campagnes gérées de ce type ne pourront plus être publiées en
  dessous de {value} par unité. Les campagnes déjà publiées ne changent pas. » [Confirmer].
- Set state: value `font-display font-extrabold tabular-nums` + « par vidéo » + `text-[11px] text-muted`
  « Modifié le {date} par {admin} » + text buttons « Modifier » · « Retirer le seuil » (confirm:
  « Sans seuil, la publication sera autorisée quel que soit le montant. »).
- Optional, if cheap for Backend: after saving, « {n} briefs en préparation passent sous ce seuil »
  linking to the tracker filtered on them.

---

## 4. Financement queue (`/admin/funding`) — small changes only

- Managed rows: company line shows `brand_label · city` and a `rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700` chip « Gérée » (instead of the admin's display name) + text link « Brief » → `/admin/briefs/{id}`.
- `?campaign=&ref=&provider=` → pin, outline, scroll, prefill (§2.10). Unknown id → ignored silently.
- Success line for managed rows adds the two links in §2.10 step 5.
- Backend note: `admin_confirm_campaign_funding` notifies the **owner** with link `/business/campaigns`; for a managed campaign the owner is an admin, so that notification should link to `/admin/briefs/{briefId}` (or be skipped). Not a design change — flagged in Co-CTO questions.

---

## 5. Public side

### 5.1 `ManagedBadge`

The mark reuses Bayele's own signature motif — the orange dot of the logo — so it reads as *Bayele's*
stamp, not as a generic "verified" tick (which already means "verified profile" on creator pages).

| Tone / size | Classes |
|---|---|
| light · sm (cards, home strip) | `inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-bold text-ink` + dot `h-1.5 w-1.5 rounded-full bg-accent` (`aria-hidden`) |
| dark · sm (featured ticket) | `… border-white/15 bg-white/10 text-white` + same accent dot |
| light · md (campaign page) | `… px-2.5 py-1 text-[12px]` |

Text « Géré par Bayele » / « Managed by Bayele » is real text (not `aria-hidden`). Contrast: ink on
white 17:1; white on ink/white-10 ≥ 12:1. It is **not a pill** (pills = Nouveau / Bientôt complet /
Complet, max one) — it lives in the brand line, so the one-pill rule is untouched.

### 5.2 Brand line (`BrandLine`)

| Campaign | Renders |
|---|---|
| Self-serve | unchanged « par **{brand}** » |
| Managed | `{brand_label} · {brand_city}` (`font-semibold text-ink`, city `text-muted`) + `ManagedBadge` — **no « par »** (avoids « par Restaurant … Géré par Bayele ») |

Layout: `flex flex-wrap items-center gap-x-2 gap-y-1`, label `min-w-0 truncate`, badge `shrink-0` — on
360 px a long label truncates before the badge wraps. City missing (should not happen, the DB check
requires it) → label alone. Never link the brand line for managed campaigns (`brand_handle` is null).

### 5.3 Where it appears

| Surface | Change |
|---|---|
| Board card (`CampaignCard`) | `ByBrand` → `BrandLine` (light, sm), under the title (same slot) |
| Featured ticket (`CampaignTicket`) | `BrandLine` (dark, sm) under the title |
| Home strip | Inherits from `CampaignCard` — no extra code |
| Campaign page header | « Proposée par {brand} » → `BrandLine` (light, md) for managed; unchanged otherwise |
| OG image | brand text = `brand_label · city`, followed by « · Géré par Bayele »; **no flag** (§8.2) |
| JSON-LD `JobPosting` | managed: `hiringOrganization` = Bayele (the publisher, M1); teaser uses `managed.seoTeaser` |
| Share message | unchanged (it does not name the brand) |

No board filter « Géré par Bayele » in v1 — with 2–3 managed listings a week (M10) it would be a
near-empty filter.

### 5.4 Campaign page (`/campaigns/[id]`) for managed campaigns

New order inside the existing card (self-serve campaigns unchanged):

1. Header (category, country **name**, H1, `BrandLine` md).
2. Public facts (pay tile, places tile, deadline · applied · platforms) — unchanged; the pay tile is the
   net per place by construction (K7).
3. **« L'essentiel de l'offre »** — NEW, public. `<section aria-labelledby="essentials-title" class="mt-5 rounded-2xl border border-line p-4 sm:p-5">`,
   H2 `text-sm font-bold text-ink`, then a `<dl class="grid gap-3 sm:grid-cols-2">`; each item
   `dt` = icon + label (`text-[11px] font-semibold uppercase tracking-wide text-muted`), `dd` = value
   (`mt-0.5 text-[14px] text-ink`). Items, each hidden when empty:
   - `MapPin` **Lieu** — « Douala, Cameroun »
   - `Languages` **Langue du contenu** — « Français »
   - `FileCheck2` **Droits d'usage** — resolved rights text + sub-line `text-[12px] text-muted` « Vous gardez la paternité du contenu et pouvez le montrer dans votre portfolio. »
   - `UserCheck` **Profil recherché** — `creator_requirements` (`sm:col-span-2`)
   - `Camera` **Matériel** — `equipment`
   - `ClipboardCheck` **Candidature** — the fixed ⑧ text (`sm:col-span-2`)
4. **« Géré par Bayele » explainer** — NEW, public. `rounded-2xl bg-surface p-4` · heading row
   `ManagedBadge` md + « Ce que cela change pour vous », then `<ul>` with `Check` (brand) bullets:
   « Bayele a rédigé l'annonce avec la marque. » · « Le budget est déjà bloqué sous séquestre. » ·
   « Bayele gère la sélection, les retours et votre paiement Mobile Money. » · « 2 séries de retouches
   incluses ; au-delà, elles sont rémunérées. »
5. Escrow strip (existing emerald) — kept.
6. Locked brief panel (logged out) / brief + details + apply (signed in) — unchanged mechanics.
7. WhatsApp share — unchanged.

### 5.5 Soft wall for managed listings (what is public vs members-only)

| Information | Logged out | Signed in | Why |
|---|---|---|---|
| Title (service), category, country, city, `brand_label`, badge | ✅ | ✅ | Identity of the offer (D1 + M1) |
| Net pay per place, places, deadline, applied, platforms | ✅ | ✅ | D1 |
| Language, usage rights, creator requirements, equipment, application process | ✅ | ✅ | **New public fields.** They tell a creator *whether they qualify* before signing up — the honest reason to create an account. None of it is the brand's brief. |
| « Géré par Bayele » explainer | ✅ | ✅ | Trust |
| Deliverables detail (`brief`), deliverable count, mandatory elements | ❌ (locked panel) | ✅ | D1 unchanged — see council question 1 on the count |
| Brand total budget, Bayele fee, internal brand name, contact | ❌ | ❌ | Never public (M8 allows the total as a secondary line; design says no — council question 4) |

The locked panel copy stays `campaignBoard.wall.*`. The new public fields are allowed in the
logged-out HTML; the meta description, OG and JSON-LD still use the teaser only (never `brief`).

---

## 6. « Publiez par WhatsApp » — brand CTA (K5)

### 6.1 Render rule
`PublishWhatsAppCta` returns `null` unless `process.env.NEXT_PUBLIC_BAYELE_WHATSAPP` matches
`^\d{8,15}$`. No placeholder, no disabled button, no « bientôt » — absent means absent. Hidden for
signed-in **creators** and **admins** on every surface (they are not brands).

### 6.2 Placements (ranked)

| # | Surface | Placement | Variant |
|---|---|---|---|
| 1 | `/business/campaigns/new` | Escape hatch at the top of the form (§7.4) | band |
| 2 | Home — « Pour les marques » card in How it works | Secondary button next to the existing primary (`h.brand.cta`), + microcopy under both | button |
| 3 | `/campaigns` | Footer band after the page CTA / alert band; viewers: guests, brands, partners | band |
| 4 | `/auth?role=business` (brand sign-up) | Text link under the submit button: « Pas le temps de créer un compte ? Publiez par WhatsApp » | link |
| 5 | `/pricing` | On the **Agency** tier block (« Gestion agence complète » = managed) + secondary in the final CTA | button |
| — | Site header, footer, creator pages | **Not placed** (would compete with « Commencer » and confuse creators) | — |

### 6.3 Visual treatment (contrast-safe)

- **button (on white):** `inline-flex min-h-tap items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-sm font-bold text-ink shadow-sm transition hover:border-[#25D366] active:scale-95` + `WhatsAppTile` (green tile, white glyph) + label. Full width on mobile when it stands alone.
- **button (on ink / brand panels — pricing final CTA):** `bg-white text-ink border-transparent hover:bg-white/90` + tile. Never green fill with white text (2:1), never `text-[#25D366]` on white (1.9:1).
- **link:** `inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand` + small tile (`h-5 w-5`).
- **band:** `rounded-2xl border border-line bg-white p-4 sm:flex sm:items-center sm:justify-between sm:gap-6` → left: title `text-[15px] font-bold text-ink` + body `text-[13px] text-muted`; right: the button variant (full width on mobile, `mt-3 sm:mt-0`).
- Opens `https://wa.me/{number}?text={encodeURIComponent(message)}` with `target="_blank" rel="noopener noreferrer"`; `aria-label` = visible label + « (ouvre WhatsApp) ».

### 6.4 Prefilled message (the 6 questions of plan §2, step 1)

The message ends with a short source code so Ops can count which surface brings briefs
(`home`, `campaigns`, `signup`, `new-campaign`, `pricing`). From the brand form (§7.4) the answers
already typed are inserted after each question.

FR (`publishWhatsapp.message`):
```
Bonjour Bayele, je souhaite publier une campagne gérée par Bayele.
1. Ce que je veux (vidéos, photos…) : {what}
2. Combien de contenus et de créateurs : {howMany}
3. Ville et pays : {where}
4. Date limite : {deadline}
5. Budget total (FCFA) : {budget}
6. Droits d'utilisation (réseaux, durée) : {rights}
Réf. : {source}
```
EN:
```
Hello Bayele, I'd like to publish a campaign managed by Bayele.
1. What I need (videos, photos…): {what}
2. How many pieces and creators: {howMany}
3. City and country: {where}
4. Deadline: {deadline}
5. Total budget (FCFA): {budget}
6. Usage rights (channels, duration): {rights}
Ref: {source}
```
Empty placeholders become an empty string (the brand types after the colon).

---

## 7. Brand self-serve form — `/business/campaigns/new`

Goal (lever #4): **six required answers**, everything else optional with defaults. Plain words, no
system vocabulary (no « invariant §9 », no « Formule » up front).

### 7.1 New page header
H1 « Nouvelle campagne » · subline « 6 questions, 2 minutes. Votre budget reste sous séquestre :
le créateur n'est payé qu'après votre validation. » (the §7 trust line).

### 7.2 Structure

```
[Escape hatch band — §7.4]                       (only when the WhatsApp env is set)
Secteur  [Restaurant] [Mode] [Beauté] … [Autre]   one tap — sets category + template text
1 Que voulez-vous ?        [Type de contenu ▾] [Quantité]
2 Combien de créateurs ?   [ 1 ]
3 Où ?                     [Ville] [Pays ▾]
4 Pour quand ?             [Date limite]
5 Budget total             [ 100 000 ] FCFA  → « Chaque créateur reçoit 45 000 FCFA »
6 Droits d'utilisation     (●) Vos réseaux, {pays}, 6 mois (recommandé)  ( ) + site web  ( ) + publicité payante  ( ) Autre
▸ Plus de détails (facultatif)
[ Créer la campagne → ]
« La campagne est créée en brouillon. Elle est publiée dès que le paiement Mobile Money est confirmé. »
```

| # | Required answer | Field(s) | Plain helper (FR) |
|---|---|---|---|
| — | Secteur (one tap, not a field) | template chips (§9) ; « Autre » reveals the category `<select>` | « Nous préremplissons le texte pour vous. Aucun prix. » |
| 1 | Que voulez-vous ? | content type `<select>` (existing `CONTENT_TYPES`) + quantity | « Ex. 3 vidéos courtes » |
| 2 | Combien de créateurs ? | count (default 1) | « Chaque créateur fait la quantité ci-dessus. » |
| 3 | Où ? | city (new, free text) + country | « La ville où le contenu est tourné. » |
| 4 | Pour quand ? | deadline (now required, future date) | « Date de publication au plus tard. » |
| 5 | Budget total | total FCFA (**replaces « Paiement / créateur »**) | « Tout compris. Chaque créateur reçoit : **{payout}** » |
| 6 | Droits d'utilisation | `RIGHTS_PRESETS` radios, default pre-selected | « Où et combien de temps vous pourrez utiliser les contenus. » |

**Budget model change.** Brands state totals (all 20 briefs did). The form asks the total and shows
the creator's pay live: `payout = floor(total × (1 − rate) ÷ count)` with the tier rate (default Spark
10 %). `total_budget_fcfa = total`, `payout_per_creator_fcfa = payout` — `budget_math_check` holds by
construction. Breakdown line under the input (`text-[12px] text-muted`): « Créateurs {pool} ·
Commission Bayele {fee} ({rate} %) ». If a pay floor exists for the content type and the payout is below
it, a soft amber hint (not a block — K1 blocks managed only): « En dessous du minimum que Bayele
recommande pour ce contenu ({floor} par unité) : vous risquez peu de candidatures. »

### 7.3 « Plus de détails » (native `<details>`, closed by default; opens automatically if a server error concerns a field inside)

Order: Titre de la campagne (auto-filled « {quantity} {type} · {secteur} · {ville} », editable) ·
Message et consignes (template-prefilled; `brief` gets this text, or a generated sentence from the six
answers when empty — the DB keeps `brief` NOT NULL) · Plateformes (template default) · Éléments
obligatoires · Profil recherché · Langue · Matériel · Formule (Spark / Managed / Agency cards, default
Spark, unchanged component) · Visibilité (default Publique, unchanged component).

Validation changes for Backend/Frontend: platforms become optional (board hides tiles when empty);
deadline and city become required; the server derives the title when empty.

### 7.4 Escape hatch — « Préférez-vous que Bayele s'en occupe ? »

Band at the very top of the form (variant band, §6.3): title « Préférez-vous que Bayele s'en occupe ? »
· body « Envoyez votre brief par WhatsApp : nous rédigeons l'annonce, encaissons le budget sous
séquestre et payons les créateurs. » · button « Publiez par WhatsApp » (source `new-campaign`, answers
already typed inserted into the message). Not repeated at the bottom (one clear exit, not a nag).

---

## 8. Fixes shipped with this work

### 8.1 EN leftovers on `/campaigns/[id]`
| Where | Today | Fix |
|---|---|---|
| `components/campaign-brief-details.tsx` | « Ce qui est attendu », « Livrable : », « Obligatoire : », « À publier avant le : », French month names | Strings via props or dictionary (`briefDetails.*`); date via `Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })`; `content_type` label translated by index of `CONTENT_TYPES` → `briefDetails.contentTypes[]` |
| `components/campaign-apply-cta.tsx` | « Vous êtes connecté avec un compte marque… » shown to brands **and partners and admins**; other FR strings | Role-aware, localized `applyCta.*`: brand / partner (with link « Proposer mes créateurs » → `/partner/campaigns`) / admin variants; `CREATOR_STATUS_FR` → `applyCta.status.*`; `ApplyButton` takes `label`/`sentLabel` props |
| Page header country | `COUNTRY_NAME[c.country]` (always French: « Cameroun » in EN) | `countryName(c.country, locale)` |

### 8.2 Flag fallback (Windows renders 🇨🇲 as « CM »)
Decision: **drop flag emoji from every meaning-bearing UI string**; show the country **name only**.
No platform sniffing, no image flags (extra bytes, and a flag is not needed to read a country).
- `countryLabel()` returns the name only (filter chips, selects, creator/partner campaign lists).
- Remove the `aria-hidden` flag spans in `CampaignCard`, `CampaignTicket`, the campaign page header.
- OG images (`campaigns`, `creators`, `partners`): `city · Country` text, no flag.
- `creator/dashboard` line `{category} · {flag}` (flag is the *only* country signal there) → country name.
- `talent-grid`, creator/partner profile headers (`city {flag}`) → « Douala, Cameroun ».
- Keep `countryFlag()` exported only if something still needs it; add a unit test that `countryLabel`
  contains no regional-indicator code points (U+1F1E6–U+1F1FF).

---

## 9. Content libraries

### 9.1 Industry templates (`lib/managed-templates.ts`) — text only, **no prices, no quantities**

Quantities are left empty on purpose: « combien » is one of the brand's six answers and the 20 briefs
show it varies widely. Rights preset is `organic_6m` unless stated.

| key | FR / EN label | Category (DB) | Service title FR · EN | Main type | Platforms | Profil recherché FR · EN | Matériel FR · EN | Admin hint (internal) | Seen in |
|---|---|---|---|---|---|---|---|---|---|
| `restaurant` | Restaurant / Restaurant | Food | Pack contenu food pour un restaurant · Food content pack for a restaurant | short_video (photos in the detail) | instagram, tiktok, facebook | Photographe ou vidéaste food, portfolio de plats ou de lieux · Food photographer or videographer with a portfolio of dishes or venues | Smartphone récent ou appareil photo ; lumière d'appoint · Recent smartphone or camera; fill light | Packs mensuels : vérifier le seuil | #3, #7 |
| `mode` | Mode / Fashion | Mode | Campagne Reels et TikTok pour une marque de mode · Reels and TikTok campaign for a fashion brand | short_video | instagram, tiktok | Créateur mode ou lifestyle, à l'aise face caméra, sens du stylisme · Fashion or lifestyle creator, comfortable on camera, with a styling eye | — | Photo + vidéo : 1 ou 2 places à confirmer | #2, #15 |
| `beaute` | Beauté / Beauty | Beauté | Vidéos UGC pour une marque beauté · UGC videos for a beauty brand | ugc_video | tiktok, instagram | Créateur beauté, démonstration produit naturelle face caméra · Beauty creator, natural on-camera product demos | — | Pas d'allégation santé non justifiée ; avant/après sans retouche trompeuse | #4 |
| `immobilier` | Immobilier / Real estate | Business | Visites vidéo de biens immobiliers · Video tours of properties | short_video | instagram, tiktok, facebook, youtube | Vidéaste immobilier ou lifestyle, plans stables, montage soigné · Real-estate or lifestyle videographer, steady shots, clean editing | Stabilisateur conseillé · Gimbal recommended | Allégations (prix, surface, rendement) à justifier par la marque | #5 |
| `hotel` | Hôtel / Hotel | Voyage | Shooting photo et vidéo pour un hôtel · Photo and video shoot for a hotel | shoot_day | instagram, facebook, tiktok | Photographe ou vidéaste hôtellerie / voyage · Hospitality or travel photographer / videographer | Appareil photo ou smartphone haut de gamme ; éclairage d'appoint · High-end camera or smartphone; fill light | Consentement écrit des clients filmés ; vérifier le seuil | #9 |
| `fintech` | Fintech / Fintech | Business | Vidéos pédagogiques pour un service financier · Explainer videos for a financial service | short_video | tiktok, facebook, instagram, youtube | Présentateur à l'aise avec la finance, langage simple · Presenter comfortable with finance, plain language | — | Allégations financières à justifier ; aucune promesse de gain | #8 |
| `tech` | Tech / App · Tech / App | Tech | Tutoriels vidéo pour une application · Video tutorials for an app | short_video (animated: animation) | tiktok, instagram, youtube | Créateur tech ou tutoriel, capture d'écran et face caméra · Tech or tutorial creator, screen recording and on camera | Smartphone avec capture d'écran ; logiciel d'animation si vidéo animée · Smartphone with screen recording; animation software for animated videos | Vidéo animée = type « animation » : vérifier le seuil | #6, #16 |
| `education` | Éducation / Education | Éducation | Vidéos de promotion de formations · Promo videos for courses | short_video | facebook, instagram, tiktok, youtube | Présentateur ou créateur éducation, diction claire · Presenter or education creator with clear delivery | — | — | #14 |
| `ong` | ONG / NGO | Business | Récits d'impact en vidéo pour une ONG · Impact stories on video for an NGO | long_video | facebook, youtube, instagram, linkedin | Créateur documentaire : interviews, narration, montage · Documentary creator: interviews, narration, editing | Micro-cravate ; trépied · Lavalier mic; tripod | Consentement écrit de chaque personne filmée ; mineurs : accord des parents | #11 |
| `agro` | Agro / Agribusiness | Food | Vidéos « de la ferme au marché » · Farm-to-market videos | short_video | facebook, tiktok, instagram, youtube | Vidéaste à l'aise en extérieur et sur site de production · Videographer comfortable outdoors and on production sites | — | — | #13 |
| `ecommerce` | E-commerce / E-commerce | Business | Démonstrations produit pour une boutique en ligne · Product demos for an online shop | short_video | tiktok, instagram, facebook | Créateur démo produit ou UGC · Product-demo or UGC creator | — | Rights preset `organic_web`; publicité payante à chiffrer avant le bon de commande | #10 |
| `b2b` | B2B / LinkedIn | Business | Contenu LinkedIn d'expertise · LinkedIn thought-leadership content | post | linkedin | Créateur LinkedIn ou B2B, à l'aise avec des experts en entreprise · LinkedIn or B2B creator, comfortable working with company experts | — | Film fondateur : type « long_video » | #17, #19 |
| `ugc` | UGC multi-créateurs / Multi-creator UGC | Business (à adapter) | Campagne UGC multi-créateurs · Multi-creator UGC campaign | ugc_video | tiktok, instagram, whatsapp | Micro-créateurs authentiques, communauté locale · Authentic micro-creators with a local community | — | Une campagne, N places, rémunération par place ; pas de récurrent (1 mois, renouvelé par une nouvelle commande). Rights preset `paid_ads` si demandé | #18, #20 |

**Deliverables detail text** (prefills « Détail des livrables » — members-only):

| key | FR | EN |
|---|---|---|
| restaurant | Photos du menu et du lieu, retouchées ; vidéos verticales courtes (plats, ambiance, équipe), sous-titrées. | Retouched photos of the menu and venue; short vertical videos (dishes, atmosphere, team) with subtitles. |
| mode | Concepts créatifs, tournage et montage de vidéos verticales portant les pièces de la marque. | Creative concepts, shooting and editing of vertical videos featuring the brand's pieces. |
| beaute | Vidéos authentiques : démonstration du produit, voix off ou face caméra. | Authentic videos: product demo, voice-over or on camera. |
| immobilier | Tournage sur place, montage, sous-titres, formats verticaux. | On-site shooting, editing, subtitles, vertical formats. |
| hotel | Chambres, services, restauration ; photos retouchées et vidéos verticales courtes. | Rooms, services, dining; retouched photos and short vertical videos. |
| fintech | Expliquer les services en langage simple, face caméra, avec sous-titres. | Explain the services in plain language, on camera, with subtitles. |
| tech | Tutoriels courts : installation, fonctions clés, cas d'usage. | Short tutorials: setup, key features, use cases. |
| education | Présenter les formations, leurs débouchés et l'inscription. | Present the courses, career outcomes and how to enrol. |
| ong | Interviews, tournage sur le terrain, narration et montage. | Interviews, field shooting, narration and editing. |
| agro | Opérations, produits et production, du champ au point de vente. | Operations, products and production, from field to market. |
| ecommerce | Vidéos de démonstration utilisables sur le site et les réseaux. | Demo videos usable on the website and social channels. |
| b2b | Posts d'expertise rédigés et vidéos professionnelles tournées avec les experts. | Written expertise posts and professional videos shot with the experts. |
| ugc | Par créateur : avis, témoignage, problème / solution, présentation d'offre. | Per creator: review, testimonial, problem / solution, offer showcase. |

### 9.2 Deliverable types (`DELIVERABLE_TYPES`) — keys = enum `public.deliverable_type` (0033)

| key | FR | EN | Unit FR / EN |
|---|---|---|---|
| `photo` | Photo retouchée | Retouched photo | par photo / per photo |
| `short_video` | Vidéo courte (Reel, TikTok, Short) | Short video (Reel, TikTok, Short) | par vidéo / per video |
| `ugc_video` | Vidéo UGC | UGC video | par vidéo / per video |
| `animation` | Vidéo explicative ou animée | Explainer or animated video | par vidéo / per video |
| `long_video` | Film ou vidéo longue (1 à 3 min) | Film or long video (1–3 min) | par film / per film |
| `story` | Story ou statut | Story or status | par story / per story |
| `post` | Post (LinkedIn, Facebook…) | Post (LinkedIn, Facebook…) | par post / per post |
| `shoot_day` | Journée de tournage ou shooting | Shoot day | par journée / per day |
| `other` | Autre | Other | par unité / per unit |

`photo`, `short_video`, `animation`, `shoot_day` and `post` are the five types named in owner decision O1.

### 9.3 Rights presets (`RIGHTS_PRESETS`) — `{pays}` / `{country}` resolved from the campaign country

| key | FR | EN |
|---|---|---|
| `organic_6m` (default, M7) | Usage organique sur les réseaux de la marque, {pays}, 6 mois. | Organic use on the brand's own channels, {country}, 6 months. |
| `organic_web` | Usage organique sur les réseaux et le site web de la marque, {pays}, 6 mois. | Organic use on the brand's channels and website, {country}, 6 months. |
| `paid_ads` | Usage organique et publicité payante sur les comptes de la marque, {pays}, 6 mois — option payante, avec l'accord écrit du créateur. | Organic use and paid ads on the brand's accounts, {country}, 6 months — a paid extra, with the creator's written agreement. |
| `custom` | (texte libre) | (free text) |

### 9.4 Languages (`LANGUAGES`)
`fr` Français / French · `en` Anglais / English · `fr_en` Français et anglais / French and English ·
`pcm` Pidgin / Pidgin · `sw` Swahili / Swahili · `other` Autre (préciser) / Other (specify).

---

## 10. Copy (FR + EN)

Namespaces: `managed.*` (public), `briefDetails.*`, `applyCta.*`, `publishWhatsapp.*`,
`brandForm.*`, `admin.briefs.*`, `payFloors.*`. The new admin screens read the dictionary (first
admin screens to do so; existing admin pages stay as they are). `{x}` placeholders are replaced at
render; plurals use `One`/`Many` keys (no ICU in the codebase). Template, type, rights and language
labels live in their TS libraries (§9) with `fr`/`en` fields, not in the dictionary.

### 10.1 Public — `managed.*`, `briefDetails.*`, `applyCta.*`

| Key | FR | EN |
|---|---|---|
| `managed.badge` | Géré par Bayele | Managed by Bayele |
| `managed.brandLine` | {label} · {city} | {label} · {city} |
| `managed.essentials.title` | L'essentiel de l'offre | Offer essentials |
| `managed.essentials.place` | Lieu | Location |
| `managed.essentials.language` | Langue du contenu | Content language |
| `managed.essentials.rights` | Droits d'usage | Usage rights |
| `managed.essentials.rightsKeep` | Vous gardez la paternité du contenu et pouvez le montrer dans votre portfolio. | You keep authorship and can show the content in your portfolio. |
| `managed.essentials.requirements` | Profil recherché | Who they're looking for |
| `managed.essentials.equipment` | Matériel | Equipment |
| `managed.essentials.application` | Candidature | How to apply |
| `managed.essentials.applicationText` | Candidature via Bayele, compte créateur requis. Bayele présélectionne 2 à 3 profils par place ; la marque valide sous 48 h. | Apply through Bayele with a creator account. Bayele shortlists 2 to 3 creators per spot; the brand approves within 48 h. |
| `managed.explainer.title` | Ce que cela change pour vous | What this means for you |
| `managed.explainer.items` | ["Bayele a rédigé l'annonce avec la marque.", "Le budget est déjà bloqué sous séquestre.", "Bayele gère la sélection, les retours et votre paiement Mobile Money.", "2 séries de retouches incluses ; au-delà, elles sont rémunérées."] | ["Bayele wrote this listing with the brand.", "The budget is already locked in escrow.", "Bayele handles selection, feedback and your Mobile Money payment.", "2 rounds of revisions included; any more are paid."] |
| `managed.seoTeaser` | {label} ({city}) recrute des créateurs via Bayele pour une campagne {category} {countryIn}. {pay} par créateur, budget bloqué sous séquestre. | {label} ({city}) is hiring creators through Bayele for a {category} campaign in {country}. {pay} per creator, budget locked in escrow. |
| `managed.ogSuffix` | Géré par Bayele | Managed by Bayele |
| `briefDetails.title` | Ce qui est attendu | What's expected |
| `briefDetails.deliverable` | Livrable : | Deliverable: |
| `briefDetails.mandatory` | Obligatoire : | Required: |
| `briefDetails.deadline` | À publier avant le : | Publish by: |
| `briefDetails.contentTypes` | ["Statut / Story", "Vidéo courte", "Post photo", "Reel", "Carrousel", "Live", "Autre"] | ["Status / Story", "Short video", "Photo post", "Reel", "Carousel", "Live", "Other"] |
| `applyCta.apply` | Postuler | Apply |
| `applyCta.applyLong` | Postuler à cette campagne | Apply to this campaign |
| `applyCta.sent` | Candidature envoyée | Application sent |
| `applyCta.finishSignup` | Terminez votre inscription pour postuler | Finish signing up to apply |
| `applyCta.brandNotice` | Vous êtes connecté avec un compte marque. Seuls les comptes créateurs peuvent postuler. | You're signed in with a brand account. Only creator accounts can apply. |
| `applyCta.partnerNotice` | Vous êtes connecté avec un compte partenaire. Proposez vos créateurs depuis votre espace partenaire. | You're signed in with a partner account. Put your creators forward from your partner space. |
| `applyCta.partnerLink` | Proposer mes créateurs | Put my creators forward |
| `applyCta.adminNotice` | Vue admin : seuls les comptes créateurs peuvent postuler. | Admin view: only creator accounts can apply. |
| `applyCta.ineligible` | Votre compte n'est pas éligible pour postuler pour le moment. | Your account can't apply right now. |
| `applyCta.pendingHint` | Votre profil est en cours de validation par Bayele : vous pourrez être retenu une fois vérifié. | Bayele is reviewing your profile: you can be selected once it's verified. |
| `applyCta.full` | Complet — plus de place disponible | Full — no spots left |
| `applyCta.signinPrefix` | Déjà membre ? | Already a member? |
| `applyCta.signin` | Se connecter | Sign in |
| `applyCta.status.applied` | Candidature envoyée | Application sent |
| `applyCta.status.approved` | Accepté — à publier | Accepted — ready to post |
| `applyCta.status.rejected` | Non retenu | Not selected |
| `applyCta.status.content_submitted` | Preuve en cours de revue | Proof under review |
| `applyCta.status.verified` | Validé — paiement en préparation | Approved — payment being prepared |
| `applyCta.status.paid` | Payé | Paid |
| `applyCta.status.invited` | Invité | Invited |
| `applyCta.status.disputed` | Litige en cours | Dispute open |

### 10.2 `publishWhatsapp.*`

| Key | FR | EN |
|---|---|---|
| `publishWhatsapp.cta` | Publiez par WhatsApp | Publish via WhatsApp |
| `publishWhatsapp.ariaSuffix` | (ouvre WhatsApp) | (opens WhatsApp) |
| `publishWhatsapp.homeHint` | Bayele s'occupe de tout : annonce, sélection, paiement des créateurs. | Bayele handles everything: listing, selection, creator payments. |
| `publishWhatsapp.band.title` | Vous êtes une marque ? | Are you a brand? |
| `publishWhatsapp.band.body` | Envoyez votre brief par WhatsApp : Bayele rédige l'annonce, bloque le budget sous séquestre et paie les créateurs. | Send your brief on WhatsApp: Bayele writes the listing, locks the budget in escrow and pays the creators. |
| `publishWhatsapp.signupLink` | Pas le temps de créer un compte ? Publiez par WhatsApp | No time to create an account? Publish via WhatsApp |
| `publishWhatsapp.formTitle` | Préférez-vous que Bayele s'en occupe ? | Would you rather Bayele handled it? |
| `publishWhatsapp.formBody` | Envoyez votre brief par WhatsApp : nous rédigeons l'annonce, bloquons le budget sous séquestre et payons les créateurs. | Send your brief on WhatsApp: we write the listing, lock the budget in escrow and pay the creators. |
| `publishWhatsapp.pricingHint` | Formule gérée : envoyez votre brief, Bayele fait le reste. | Managed plan: send your brief, Bayele does the rest. |
| `publishWhatsapp.message` | (FR block in §6.4) | (EN block in §6.4) |

### 10.3 `brandForm.*`

| Key | FR | EN |
|---|---|---|
| `brandForm.title` | Nouvelle campagne | New campaign |
| `brandForm.subtitle` | 6 questions, 2 minutes. Votre budget reste sous séquestre : le créateur n'est payé qu'après votre validation. | 6 questions, 2 minutes. Your budget stays in escrow: the creator is only paid after you approve. |
| `brandForm.sector` | Votre secteur | Your sector |
| `brandForm.sectorHint` | Nous préremplissons le texte pour vous. Aucun prix. | We prefill the text for you. No prices. |
| `brandForm.what` | Que voulez-vous ? | What do you need? |
| `brandForm.whatHint` | Ex. 3 vidéos courtes | E.g. 3 short videos |
| `brandForm.count` | Combien de créateurs ? | How many creators? |
| `brandForm.countHint` | Chaque créateur fait la quantité ci-dessus. | Each creator delivers the quantity above. |
| `brandForm.where` | Où ? | Where? |
| `brandForm.city` | Ville | City |
| `brandForm.cityHint` | La ville où le contenu est tourné. | The city where the content is shot. |
| `brandForm.country` | Pays | Country |
| `brandForm.when` | Pour quand ? | By when? |
| `brandForm.whenHint` | Date de publication au plus tard. | Latest publishing date. |
| `brandForm.budget` | Budget total (FCFA) | Total budget (FCFA) |
| `brandForm.budgetHint` | Tout compris. Chaque créateur reçoit : {payout} | All-in. Each creator receives: {payout} |
| `brandForm.budgetSplit` | Créateurs {pool} · Commission Bayele {fee} ({rate} %) | Creators {pool} · Bayele fee {fee} ({rate}%) |
| `brandForm.belowFloorHint` | En dessous du minimum que Bayele recommande pour ce contenu ({floor} par unité) : vous risquez de recevoir peu de candidatures. | Below the minimum Bayele recommends for this content ({floor} per unit): you may get few applications. |
| `brandForm.rights` | Droits d'utilisation | Usage rights |
| `brandForm.rightsHint` | Où et combien de temps vous pourrez utiliser les contenus. | Where and for how long you can use the content. |
| `brandForm.rightsRecommended` | (recommandé) | (recommended) |
| `brandForm.more` | Plus de détails (facultatif) | More details (optional) |
| `brandForm.titleField` | Titre de la campagne | Campaign title |
| `brandForm.message` | Message et consignes | Message and guidelines |
| `brandForm.platforms` | Plateformes | Platforms |
| `brandForm.mandatory` | Éléments obligatoires | Required elements |
| `brandForm.requirements` | Profil recherché | Who you're looking for |
| `brandForm.language` | Langue du contenu | Content language |
| `brandForm.equipment` | Matériel | Equipment |
| `brandForm.plan` | Formule | Plan |
| `brandForm.visibility` | Visibilité | Visibility |
| `brandForm.submit` | Créer la campagne | Create the campaign |
| `brandForm.footnote` | La campagne est créée en brouillon. Elle est publiée dès que le paiement Mobile Money est confirmé. | The campaign is saved as a draft. It goes live as soon as the Mobile Money payment is confirmed. |
| `brandForm.errors.required` | Répondez aux 6 questions pour créer la campagne. | Answer the 6 questions to create the campaign. |
| `brandForm.errors.deadline` | Choisissez une date à venir. | Pick a future date. |
| `brandForm.errors.budget` | Le budget doit permettre de payer chaque créateur. | The budget must be enough to pay each creator. |

### 10.4 `admin.briefs.*`

| Key | FR | EN |
|---|---|---|
| `admin.briefs.nav` | Briefs gérés | Managed briefs |
| `admin.briefs.title` | Briefs gérés | Managed briefs |
| `admin.briefs.countOne` | 1 brief | 1 brief |
| `admin.briefs.countMany` | {n} briefs | {n} briefs |
| `admin.briefs.new` | Nouveau brief | New brief |
| `admin.briefs.floorsLink` | Seuils de rémunération | Pay floors |
| `admin.briefs.filterLabel` | Filtrer par statut | Filter by status |
| `admin.briefs.all` | Tous | All |
| `admin.briefs.search` | Marque, descripteur ou téléphone | Brand, label or phone |
| `admin.briefs.allCountries` | Tous les pays | All countries |
| `admin.briefs.status.draft` | Brouillon | Draft |
| `admin.briefs.status.awaiting_order` | En attente du « OUI » | Waiting for "YES" |
| `admin.briefs.status.awaiting_payment` | En attente du paiement | Waiting for payment |
| `admin.briefs.status.ready` | Prête à publier | Ready to publish |
| `admin.briefs.status.published` | Publiée | Published |
| `admin.briefs.status.declined` | Refusée | Declined |
| `admin.briefs.row.public` | Public : | Public: |
| `admin.briefs.row.labelMissing` | à définir | not set |
| `admin.briefs.row.consentReal` | Nom réel autorisé | Real name approved |
| `admin.briefs.row.consentDescriptor` | Descripteur | Descriptor |
| `admin.briefs.row.deadline` | Date limite {date} | Deadline {date} |
| `admin.briefs.row.money` | {total} total → {net} / place × {places} | {total} total → {net} / spot × {places} |
| `admin.briefs.row.fields` | {done}/{total} champs | {done}/{total} fields |
| `admin.briefs.row.stale` | À relancer | Needs a nudge |
| `admin.briefs.row.age` | il y a {n} j | {n} d ago |
| `admin.briefs.action.complete` | Compléter | Complete |
| `admin.briefs.action.recordYes` | Enregistrer le OUI | Record the YES |
| `admin.briefs.action.publish` | Publier | Publish |
| `admin.briefs.action.confirmFunding` | Confirmer le financement | Confirm funding |
| `admin.briefs.action.viewListing` | Voir l'annonce | View listing |
| `admin.briefs.action.duplicate` | Dupliquer | Duplicate |
| `admin.briefs.action.reopen` | Rouvrir | Reopen |
| `admin.briefs.action.nudge` | Relancer sur WhatsApp | Nudge on WhatsApp |
| `admin.briefs.empty.title` | Aucun brief géré pour l'instant | No managed briefs yet |
| `admin.briefs.empty.body` | Quand une marque envoie son brief par WhatsApp, créez-le ici : le formulaire suit le standard d'annonce, calcule la rémunération nette et prépare le bon de commande. | When a brand sends its brief on WhatsApp, create it here: the form follows the listing standard, computes the net pay and prepares the order form. |
| `admin.briefs.empty.filtered` | Aucun brief dans ce statut. | No briefs in this status. |
| `admin.briefs.empty.search` | Aucun brief ne correspond à « {q} ». | No brief matches "{q}". |
| `admin.briefs.empty.showAll` | Voir tous les briefs | See all briefs |
| `admin.briefs.empty.clearSearch` | Effacer la recherche | Clear search |
| `admin.briefs.editor.newTitle` | Nouveau brief géré | New managed brief |
| `admin.briefs.editor.editTitle` | Brief géré · {name} | Managed brief · {name} |
| `admin.briefs.editor.back` | Briefs gérés | Managed briefs |
| `admin.briefs.editor.vis.public` | Public | Public |
| `admin.briefs.editor.vis.members` | Membres | Members |
| `admin.briefs.editor.vis.internal` | Interne | Internal |
| `admin.briefs.editor.save` | Enregistrer | Save |
| `admin.briefs.editor.saved` | Enregistré | Saved |
| `admin.briefs.editor.savedAt` | Enregistré à {time} | Saved at {time} |
| `admin.briefs.editor.resendNotice` | Le bon de commande doit être renvoyé : vous avez modifié {fields}. | The order form must be sent again: you changed {fields}. |
| `admin.briefs.template.title` | Partir d'un modèle | Start from a template |
| `admin.briefs.template.none` | Aucun | None |
| `admin.briefs.template.hint` | Les modèles proposent du texte, jamais de prix. | Templates suggest text, never prices. |
| `admin.briefs.template.confirm` | Ce modèle remplace le service, les livrables, le profil et les droits déjà saisis. | This template replaces the service, deliverables, profile and rights already entered. |
| `admin.briefs.template.replace` | Remplacer | Replace |
| `admin.briefs.template.cancel` | Annuler | Cancel |
| `admin.briefs.section.brand` | Marque | Brand |
| `admin.briefs.section.service` | Service | Service |
| `admin.briefs.section.deliverables` | Livrables | Deliverables |
| `admin.briefs.section.deadline` | Date limite | Deadline |
| `admin.briefs.section.budget` | Budget | Budget |
| `admin.briefs.section.rights` | Droits d'usage | Usage rights |
| `admin.briefs.section.profile` | Profil créateur | Creator profile |
| `admin.briefs.section.application` | Candidature | Application |
| `admin.briefs.section.order` | Bon de commande | Order form |
| `admin.briefs.section.payment` | Paiement | Payment |
| `admin.briefs.section.publish` | Publication | Publishing |
| `admin.briefs.section.notes` | Notes internes | Internal notes |
| `admin.briefs.brand.internalName` | Nom de la marque (interne) | Brand name (internal) |
| `admin.briefs.brand.internalNameHint` | Nom légal ou commercial, pour le bon de commande. Jamais affiché. | Legal or trade name, for the order form. Never shown. |
| `admin.briefs.brand.contactName` | Contact · nom | Contact · name |
| `admin.briefs.brand.contactWhatsapp` | Contact · WhatsApp | Contact · WhatsApp |
| `admin.briefs.brand.display` | Affichage public | Public display |
| `admin.briefs.brand.descriptor` | Descripteur | Descriptor |
| `admin.briefs.brand.descriptorHint` | Ex. Restaurant, Marque de mode | E.g. Restaurant, Fashion brand |
| `admin.briefs.brand.realName` | Nom réel | Real name |
| `admin.briefs.brand.realNameHint` | Seulement avec un accord écrit | Only with written consent |
| `admin.briefs.brand.label` | Libellé public | Public label |
| `admin.briefs.brand.labelHintDescriptor` | Décrivez l'activité sans la ville (elle s'affiche à côté). N'utilisez jamais le nom d'une autre entreprise. | Describe the business without the city (it's shown next to it). Never use another company's name. |
| `admin.briefs.brand.labelHintReal` | Le nom exact que la marque a accepté de voir publié. | The exact name the brand agreed to have published. |
| `admin.briefs.brand.consent` | Consentement écrit reçu | Written consent received |
| `admin.briefs.brand.consentHint` | Une capture du « OK » WhatsApp suffit. Sans accord, utilisez un descripteur : l'annonce affiche toujours « Géré par Bayele ». | A screenshot of the WhatsApp "OK" is enough. Without consent, use a descriptor: the listing always shows "Managed by Bayele". |
| `admin.briefs.brand.consentProof` | Preuve du consentement | Consent proof |
| `admin.briefs.brand.consentProofHint` | Ex. capture WhatsApp du 12/10, enregistrée dans le dossier client. | E.g. WhatsApp screenshot of 12/10, saved in the client folder. |
| `admin.briefs.brand.labelEqualsName` | Sans consentement, le libellé public ne peut pas reprendre le nom de la marque. | Without consent, the public label can't reuse the brand's name. |
| `admin.briefs.brand.city` | Ville | City |
| `admin.briefs.brand.country` | Pays | Country |
| `admin.briefs.brand.preview` | Aperçu : | Preview: |
| `admin.briefs.service.service` | Service | Service |
| `admin.briefs.service.title` | Titre de l'annonce (facultatif) | Listing title (optional) |
| `admin.briefs.service.category` | Catégorie | Category |
| `admin.briefs.deliv.main` | Livrable principal | Main deliverable |
| `admin.briefs.deliv.units` | Unités par place | Units per spot |
| `admin.briefs.deliv.mainHint` | Le livrable qui coûte le plus à produire. Les autres vont dans le détail. | The deliverable that costs the most to produce. The others go in the detail. |
| `admin.briefs.deliv.platforms` | Plateformes | Platforms |
| `admin.briefs.deliv.detail` | Détail des livrables | Deliverables detail |
| `admin.briefs.deliv.mandatory` | Éléments obligatoires | Required elements |
| `admin.briefs.deliv.disclosureHint` | La mention « #pub » est obligatoire sur les publications sponsorisées. | The "#ad" disclosure is required on sponsored posts. |
| `admin.briefs.deadline.label` | Date limite de livraison | Delivery deadline |
| `admin.briefs.deadline.hint` | Date de livraison au plus tard, celle du bon de commande. | Latest delivery date, the one on the order form. |
| `admin.briefs.budget.total` | Budget total de la marque (FCFA) | Brand's total budget (FCFA) |
| `admin.briefs.budget.totalHint` | Frais Bayele 25 % inclus — le montant que la marque paie. | 25% Bayele fee included — the amount the brand pays. |
| `admin.briefs.budget.places` | Places (nombre de créateurs) | Spots (number of creators) |
| `admin.briefs.budget.plan` | Formule Agency · 25 % — fixe pour les campagnes gérées. | Agency plan · 25% — fixed for managed campaigns. |
| `admin.briefs.pay.total` | Budget total marque | Brand total budget |
| `admin.briefs.pay.fee` | Frais Bayele (25 %) | Bayele fee (25%) |
| `admin.briefs.pay.pool` | Rémunération créateurs | Creator pay |
| `admin.briefs.pay.divide` | ÷ {n} places | ÷ {n} spots |
| `admin.briefs.pay.netLabel` | Net par place | Net per spot |
| `admin.briefs.pay.perUnit` | Par unité : {amount} ({qty} {type}) | Per unit: {amount} ({qty} {type}) |
| `admin.briefs.pay.shownOnListing` | C'est le montant affiché sur l'annonce. | This is the amount shown on the listing. |
| `admin.briefs.pay.remainder` | Arrondi non attribué : {amount} | Unallocated rounding: {amount} |
| `admin.briefs.floor.undefinedTitle` | Seuil non défini | No floor set |
| `admin.briefs.floor.undefinedBody` | Aucun seuil n'est fixé pour ce livrable : la publication est autorisée. | No floor is set for this deliverable: publishing is allowed. |
| `admin.briefs.floor.okTitle` | Au-dessus du seuil | Above the floor |
| `admin.briefs.floor.okBody` | {perUnit} par unité ≥ {floor} requis. | {perUnit} per unit ≥ {floor} required. |
| `admin.briefs.floor.belowTitle` | Sous le seuil — contre-proposition | Below the floor — counter-offer |
| `admin.briefs.floor.belowBody` | Il manque {gap} par place. | {gap} short per spot. |
| `admin.briefs.floor.optionBudget` | Même travail : budget total de {total} | Same work: total budget of {total} |
| `admin.briefs.floor.optionScope` | Même budget : {qty} {type} par place au lieu de {current} | Same budget: {qty} {type} per spot instead of {current} |
| `admin.briefs.floor.copyCounter` | Copier la contre-proposition | Copy the counter-offer |
| `admin.briefs.floor.blocked` | Sous le seuil de rémunération : envoyez une contre-proposition. | Below the pay floor: send a counter-offer. |
| `admin.briefs.rights.label` | Droits d'usage | Usage rights |
| `admin.briefs.rights.keep` | Le créateur garde la paternité du contenu et peut le montrer dans son portfolio. | The creator keeps authorship and can show the content in their portfolio. |
| `admin.briefs.profile.requirements` | Profil recherché | Who we're looking for |
| `admin.briefs.profile.requirementsHint` | Ce qui compte pour réussir : style, expérience, langue parlée face caméra. Pas de critère physique ni d'âge. | What matters to succeed: style, experience, on-camera language. No physical or age criteria. |
| `admin.briefs.profile.language` | Langue du contenu | Content language |
| `admin.briefs.profile.equipment` | Matériel | Equipment |
| `admin.briefs.profile.equipmentHint` | Seulement si indispensable — sinon laissez vide. | Only if essential — otherwise leave empty. |
| `admin.briefs.application.text` | Candidature via Bayele, compte créateur requis. Bayele présélectionne 2 à 3 profils par place ; la marque valide sous 48 h (sans réponse, Bayele choisit). | Apply through Bayele with a creator account. Bayele shortlists 2 to 3 creators per spot; the brand approves within 48 h (no reply: Bayele picks). |
| `admin.briefs.checklist.title` | Avant publication | Before publishing |
| `admin.briefs.checklist.items` | ["Libellé public", "Consentement cohérent", "Service", "Livrables", "Plateformes", "Ville", "Pays", "Langue", "Date limite", "Budget total", "Places · net par place", "Droits d'usage", "Profil créateur", "Seuil", "« OUI » de la marque"] | ["Public label", "Consistent consent", "Service", "Deliverables", "Platforms", "City", "Country", "Language", "Deadline", "Total budget", "Spots · net per spot", "Usage rights", "Creator profile", "Floor", "Brand's \"YES\""] |
| `admin.briefs.checklist.missing` | Il manque : {fields} | Missing: {fields} |
| `admin.briefs.order.lang` | Texte en : | Text in: |
| `admin.briefs.order.view` | Voir le texte | View the text |
| `admin.briefs.order.copy` | Copier le bon de commande | Copy the order form |
| `admin.briefs.order.copied` | Bon de commande copié | Order form copied |
| `admin.briefs.order.openWhatsapp` | Ouvrir dans WhatsApp | Open in WhatsApp |
| `admin.briefs.order.sent` | J'ai envoyé le bon de commande | I've sent the order form |
| `admin.briefs.order.yes` | « OUI » (ou « YES ») reçu | "YES" (or "OUI") received |
| `admin.briefs.order.yesAt` | Reçu le | Received on |
| `admin.briefs.order.proof` | Preuve | Proof |
| `admin.briefs.order.proofHint` | Ex. capture du « OUI » WhatsApp du 12/10 à 10 h 14 | E.g. screenshot of the WhatsApp "YES", 12/10 at 10:14 |
| `admin.briefs.payment.deposit` | Acompte reçu | Deposit received |
| `admin.briefs.payment.depositOptions` | ["Aucun", "Partiel", "Complet"] | ["None", "Partial", "Full"] |
| `admin.briefs.payment.refHint` | Saisissez la référence du reçu MTN, Orange, Wave… ou de la facture SokoClick dans Financement. Jamais une simple capture. | Enter the MTN, Orange, Wave… receipt or SokoClick invoice reference in Funding. Never just a screenshot. |
| `admin.briefs.publish.steps` | ["Créer la campagne", "Confirmer le financement"] | ["Create the campaign", "Confirm funding"] |
| `admin.briefs.publish.explain` | Publier se fait en 2 étapes. 1. La campagne est créée, invisible sur Bayele. 2. Dès que le paiement est arrivé, vous confirmez le financement dans Financement avec la référence du reçu : la campagne passe en ligne et les créateurs sont prévenus dans l'application. | Publishing takes 2 steps. 1. The campaign is created, invisible on Bayele. 2. Once the payment has arrived, you confirm the funding in Funding with the receipt reference: the campaign goes live and creators are notified in the app. |
| `admin.briefs.publish.errorFloor` | Sous le seuil de rémunération : envoyez une contre-proposition. | Below the pay floor: send a counter-offer. |
| `admin.briefs.publish.errorNoYes` | Enregistrez d'abord le « OUI » de la marque. | Record the brand's "YES" first. |
| `admin.briefs.publish.errorDeadline` | La date limite est passée : choisissez une nouvelle date. | The deadline has passed: pick a new date. |
| `admin.briefs.publish.readOnly` | L'annonce est créée. Pour la changer avant le financement, refusez ce brief puis dupliquez-le. | The listing has been created. To change it before funding, decline this brief and duplicate it. |
| `admin.briefs.publish.create` | Créer la campagne | Create the campaign |
| `admin.briefs.publish.step2Title` | Étape 2 sur 2 — financement à confirmer | Step 2 of 2 — funding to confirm |
| `admin.briefs.publish.step2Body` | La campagne existe mais reste invisible tant que le financement n'est pas confirmé. | The campaign exists but stays invisible until the funding is confirmed. |
| `admin.briefs.publish.done` | Publiée le {date} | Published on {date} |
| `admin.briefs.publish.copyLink` | Copier le lien | Copy link |
| `admin.briefs.publish.errorMissing` | Champ manquant : {fields}. | Missing field: {fields}. |
| `admin.briefs.publish.errorGeneric` | La création a échoué. Réessayez. | Creation failed. Try again. |
| `admin.briefs.decline.action` | Refuser le brief | Decline the brief |
| `admin.briefs.decline.reason` | Motif | Reason |
| `admin.briefs.decline.reasons` | ["Sous le seuil, contre-proposition refusée", "Sans réponse de la marque", "Hors périmètre (récurrent, contenu interdit…)", "Autre"] | ["Below the floor, counter-offer refused", "No reply from the brand", "Out of scope (recurring, prohibited content…)", "Other"] |
| `admin.briefs.decline.cancelsCampaign` | La campagne créée (non financée) sera annulée. | The created (unfunded) campaign will be cancelled. |
| `admin.briefs.funding.managedChip` | Gérée | Managed |
| `admin.briefs.funding.briefLink` | Brief | Brief |
| `admin.briefs.funding.viewPublic` | Voir l'annonce publique | View the public listing |
| `admin.briefs.funding.backToBrief` | Retour au brief | Back to the brief |
| `admin.briefs.nudge.order` | Bonjour {contact}, petit rappel : votre bon de commande Bayele pour « {service} » attend votre « OUI ». Répondez OUI pour valider, ou dites-nous ce qu'il faut changer. | Hello {contact}, a quick reminder: your Bayele order form for "{service}" is waiting for your "YES". Reply YES to confirm, or tell us what to change. |
| `admin.briefs.nudge.payment` | Bonjour {contact}, merci pour votre OUI. Votre campagne « {service} » sera publiée dès réception du paiement de {total}. Le budget reste sous séquestre : le créateur n'est payé qu'après votre validation. | Hello {contact}, thanks for your YES. Your campaign "{service}" goes live as soon as we receive the payment of {total}. The budget stays in escrow: the creator is only paid after you approve. |
| `admin.briefs.nudge.counterOffer` | Bonjour {contact}, pour « {service} », le budget actuel donne {net} par créateur, en dessous du minimum que Bayele applique pour ce type de contenu. Deux options : un budget total de {total} pour le même travail, ou {qty} {type} pour le budget actuel. Laquelle vous convient ? | Hello {contact}, for "{service}", the current budget gives {net} per creator, below the minimum Bayele applies for this type of content. Two options: a total budget of {total} for the same work, or {qty} {type} for the current budget. Which suits you? |

### 10.5 `payFloors.*`

| Key | FR | EN |
|---|---|---|
| `payFloors.title` | Seuils de rémunération | Pay floors |
| `payFloors.body` | Montant net minimum qu'un créateur doit recevoir par unité livrée, après les frais Bayele. Ces seuils seront fixés par Finance et Communauté à partir des données réelles de Bayele. Tant qu'un seuil n'est pas défini pour un type de livrable, les campagnes gérées de ce type peuvent être publiées. | The minimum net amount a creator must receive per delivered unit, after Bayele's fee. Finance and Community will set these floors from Bayele's real data. Until a floor is set for a deliverable type, managed campaigns of that type can be published. |
| `payFloors.empty` | Aucun seuil défini pour l'instant. | No floors set yet. |
| `payFloors.notSet` | Non défini | Not set |
| `payFloors.inputLabel` | FCFA net / unité | FCFA net / unit |
| `payFloors.save` | Enregistrer | Save |
| `payFloors.confirmSet` | Les campagnes gérées de ce type ne pourront plus être publiées en dessous de {value} par unité. Les campagnes déjà publiées ne changent pas. | Managed campaigns of this type can no longer be published below {value} per unit. Campaigns already published don't change. |
| `payFloors.confirm` | Confirmer | Confirm |
| `payFloors.edit` | Modifier | Edit |
| `payFloors.remove` | Retirer le seuil | Remove floor |
| `payFloors.confirmRemove` | Sans seuil, la publication sera autorisée quel que soit le montant. | Without a floor, publishing is allowed whatever the amount. |
| `payFloors.updated` | Modifié le {date} par {admin} | Updated on {date} by {admin} |
| `payFloors.impact` | {n} briefs en préparation passent sous ce seuil | {n} briefs in progress fall below this floor |

**Voice check.** Every action keeps its name through the flow: « Publier » → « Créer la campagne » →
« Confirmer le financement » → « Publiée »; « Enregistrer le OUI » → « Prête à publier »;
« Créer la campagne » → « En attente du paiement ». No figure is promised anywhere (no « en 24 h », no
« X créateurs »), alerts are « dans l'application » (C2), no reward wording (C3, K4).

---

## 11. Checklists

### 11.1 Accessibility

- [ ] **Tap targets ≥ 48 px** on admin too: pipeline chips, row actions, line remove buttons (`h-tap w-tap`), switches (48 px hit area around the visual switch), checklist links, sticky-bar buttons.
- [ ] **Inputs 16 px on phones** (no iOS zoom); `inputMode="numeric"` for money and quantities, `type="tel"` for WhatsApp, `type="date"` for deadlines.
- [ ] **Labels:** every field has a `<label for>`; visibility tags are inside the label text (« Libellé public · Public ») so screen readers hear who will read the field.
- [ ] **Errors:** `aria-invalid` + `aria-describedby` to the error text; the form-level error lists the fields and links to them; focus moves to the first invalid field after a failed save.
- [ ] **Live regions:** net-per-place amount `aria-live="polite"` (debounced); save / copy confirmations `role="status"`; server errors `role="alert"`. The floor verdict changes state with text, not only colour.
- [ ] **Status pills and floor chips** always carry text; icons are `aria-hidden`.
- [ ] **Checklist:** `<ul>` with each item's state in text (`sr-only` « fait » / « à faire »), unmet items are links to `#field-…`.
- [ ] **Inline confirms** (template replace, publish, decline, floor save) are in-flow regions with a heading and focus moved to their first button; `Escape` cancels. No modal traps.
- [ ] **Badge:** real text, contrast ≥ 12:1 in both tones; never the only cue for "managed" — the explainer panel says it in words on the campaign page.
- [ ] **WhatsApp CTAs:** green only as the glyph tile and the hover border; `aria-label` says it opens WhatsApp; `target="_blank"` + `rel="noopener noreferrer"`.
- [ ] **Country names, not flags**, everywhere (§8.2); EN pages print EN names and EN brief details (§8.1).
- [ ] **Reduced motion:** nothing new animates; existing rules apply.
- [ ] **360 px:** sticky bar fits « 1 500 000 FCFA » (amount `text-lg`, currency `text-[0.65em]`); brand line truncates the label before wrapping the badge; no horizontal page scroll (rails use `-mx-4 px-4` inside `overflow-x-auto`).

### 11.2 Virality and growth — element → funnel step

| Funnel step | Element | What it does |
|---|---|---|
| **Supply (brands)** | « Publiez par WhatsApp » on home, `/campaigns`, brand sign-up, new-campaign form, pricing | Gives SMEs the channel they already trust (lever #2) without forcing an account |
| | Source code in the WhatsApp message | Ops can see which surface brings briefs, honestly, without tracking scripts |
| | Brand form: 6 answers + templates + total budget + live creator pay | Raises complete-on-first-try (lever #4) and keeps creator pay visible to the brand |
| | Escape hatch on the form | Catches brands who stall on a form instead of losing them |
| **Ops throughput** | Tracker sorted by waiting time, stale flag, one-tap nudges | Shortens the brief → funded cycle (levers #1, #3) |
| | Order form filled and copied in one tap, FR/EN | Removes retyping; the « OUI » proof is attached to the brief |
| | Deep link + pinned row in Financement | The admin lands on the right campaign; the receipt reference is typed once, from the receipt |
| | Dupliquer | Renewals (M9) in seconds |
| **Creator trust** | « Géré par Bayele » badge + explainer | Explains who publishes and who pays (M1) without pretending to be many publishers |
| | Public rights, requirements, language, equipment | Creators self-qualify before sign-up → better applications, honest reason to register |
| | Net pay per place as the only headline (K7) and floors (K1) | No underpaid listing reaches the board; the number shown is the number paid |
| **Discover / share** | Managed listings use the same cards, ticket, home strip, WhatsApp share, JSON-LD | Inherits every distribution channel of the board for free |
| **Measure** | `managed_briefs` statuses + timestamps; WhatsApp source codes; `template_key` | Brief → funded conversion by stage, by surface and by industry |

---

## 12. Questions

### 12.1 For the business council

1. **Deliverable count public?** D1 locks deliverables behind sign-up; M8 lists DELIVERABLES (counted) in the listing standard. Design keeps D1 (count members-only) and makes rights / requirements / language / equipment public instead. Should « 3 vidéos courtes » be public for managed listings? It helps creators judge the net pay; it also gives away more of the brief.
2. **50 % deposit for returning brands (M3).** The escrow path funds the full budget in one confirmation. Design v1 offers 100 % only in the order form; the schema's `deposit_status = partial` is shown as information, it does not fund anything. If 50/50 is wanted, it needs an escrow change (two inbound confirmations) — a Finance and Engineering decision first.
3. **Brand total on the public page.** M8 allows it as a secondary line. Design does not show it (it reveals the Bayele fee, and anon access to `total_budget_fcfa` was revoked in migration 0032). Confirm.
4. **Badge promise.** The explainer says Bayele « gère … votre paiement Mobile Money ». Legal: is this the right wording for Bayele's role as escrow holder (ADR-001), or should it read « votre paiement est versé depuis le séquestre » only?
5. **Brand self-serve budget model.** Switching the input from « paiement par créateur » to « budget total » matches how brands talk and K7, but changes the existing brand flow. Confirm.
6. **Self-serve below the floor.** K1 blocks managed only; design shows a soft hint to self-serve brands. Should self-serve also be blocked once floors exist?
7. **WhatsApp CTA audience on `/campaigns`.** Shown to guests, brands and partners; hidden from signed-in creators. Most guests are creators — acceptable noise, or brands-only?
8. **Languages.** Pidgin and Swahili are listed for content language (Lagos, Nairobi). Confirm the list.
9. **Categories for NGO and multi-creator UGC.** There is no « Social / ONG » category; the templates default to « Business ». Add a category, or keep?

### 12.2 For the Co-CTO (engineering, not policy)

1. **One main deliverable** (`deliverable_type` + `deliverable_count`) as in 0033: the editor asks for
   the most expensive deliverable and puts the rest in the detail. A mixed pack (10 photos + 5 videos)
   is floor-checked on the main type only. Acceptable for v1? (Lines `[{type, qty}]` with
   Σ qty × floor would be exact.)
2. `admin_confirm_campaign_funding` notifies the **owner** with link `/business/campaigns`; for managed
   campaigns the owner is an admin — link to `/admin/briefs/{id}` or skip that notification.
3. Rounding: `floor(total × 0.75 ÷ places) × places` can be less than the escrow net
   (`total − floor(total × 0.25)`). Where does the remainder go at payout? The editor shows it as
   « Arrondi non attribué ».
4. Declining a brief in `awaiting_payment` must cancel its `pending_funding` campaign in the same
   action — no RPC for that in 0033 yet.
5. The upsert keeps updating listing fields after `campaign_id` is set, but the campaign keeps its
   creation values. The editor makes them read-only from `awaiting_payment`; the RPC should refuse
   those changes too.
6. Lifecycle order: 0033 lets the admin set `awaiting_payment` before publishing, and the publish RPC
   sets it again after. The UI only ever sets `draft`, `awaiting_order`, `ready`, `declined` (§1.1);
   consider restricting the upsert to those.
7. Consent proof (K3) has no column in 0033; the editor prepends it to `notes` (« [Consentement] … »).
   A `brand_consent_proof text` column would make it auditable.
