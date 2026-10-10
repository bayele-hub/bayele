# Public « Campagnes » — UI/UX design specification

| | |
|---|---|
| **Seat** | Principal UX Architect · Head of Growth + Mobile UX (UI/UX role) |
| **Implements** | `docs/CAMPAIGNS-PUBLIC-PAGE-PLAN.md` (decisions D1–D5 final) |
| **Design standard** | `epic-design/SKILL.md` **Mode 2 — enhance existing site** · `docs/SKILL.md` §6 |
| **Audience** | Frontend & Design Systems seat (build without guessing), QA (acceptance), Backend (data needs in §0.4) |
| **Date** | 2026-10-10 |

**Bottom line.** One signature element — the **#1 offer rendered as a Mobile-Money pay ticket**
(dark offer half, perforated tear line, white « Vous recevez » stub with the pay in display type and a
live places meter). Everything else reuses the home page's quiet vocabulary: `rounded-3xl` white
cards on `shadow-card`, `bg-surface` panels, chips as links, `[data-reveal="up"]` with a 60 ms
stagger. One new keyframe (`bl-meter`, transform only). No new libraries, no client state on the
list page, no invented figures: every number on screen comes from the board RPC and disappears when
zero or unknown.

**Typography note for this file.** French copy below contains the real U+00A0 (before `:` and inside
« ») and U+202F (before `?` `!` `;` `%`). Copy-paste the strings as-is into `messages/fr.json`.

---

## 0. Foundations (shared by every section)

### 0.1 Tokens used (no new tokens)

| Purpose | Token / class |
|---|---|
| Text / secondary / hairline / panel | `text-ink` · `text-muted` · `border-line` · `bg-surface` |
| Primary action | `bg-brand hover:bg-brand-600 text-white` (5.7:1 on white) |
| Labels in brand colour | `text-brand-700` (never `text-accent` on white — 2.2:1, fails) |
| Signature accent | `bg-accent` fills, `text-accent` **only on `bg-ink`** (7.6:1) |
| Card | `rounded-3xl border border-line bg-white shadow-card`, hover `shadow-cardHover` |
| Display numbers | `font-display font-extrabold tabular-nums` |
| Headlines | `font-headline font-bold tracking-[-0.03em]` (H1) |
| Tap target | `min-h-tap` (48 px) / `h-tap w-tap` for icon buttons |
| Example tag (only if an illustrative figure ever appears) | home pattern: `rounded-full border border-line px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-muted` + `t.orbit.example` |

### 0.2 Motion inventory (existing unless marked NEW)

| Class / attr | Used for |
|---|---|
| `.line-mask` + `.line-in` (`--i`) | H1 « Campagnes ouvertes » (2 lines) |
| `.anim-fade` / `.anim-rise` (`--d`) | Above-the-fold: eyebrow, subline, filters, featured ticket |
| `[data-reveal="up"]` (`--d`) | Cards 2–10, page CTA panel, alert panel, home strip cards |
| `[data-reveal="fill"]` | Places meter on below-the-fold cards (inner span, parent observed) |
| `.float-b` inside `[data-loop-scope]` | The single ambient loop on the page: the accent glow behind the ticket (auto-disabled by `.perf-lite` on touch / ≤ 4 cores) |
| **NEW `.meter-grow`** | Places meter on the featured ticket (above the fold, where `data-reveal` would be marked `is-in` immediately and never animate) |

NEW CSS — add to `app/globals.css` next to `bl-bar` / `.bar-grow`, and add `.meter-grow` to the
existing reduced-motion `animation: none !important` list:

```css
@keyframes bl-meter { from { transform: scaleX(0); } to { transform: scaleX(1); } }
.meter-grow { transform-origin: left center; animation: bl-meter .9s cubic-bezier(.2, .8, .2, 1) both; animation-delay: var(--d, 0ms); }
```

Every page that uses `[data-reveal]` mounts `<RevealRoot />` once (as the home page does). Stagger
helper: `const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties;` — card delays are
`d(Math.min(i, 5) * 60)` so a 9-card grid never waits more than 300 ms.

### 0.3 Card field rules (one table, used by the ticket, the grid card and the home strip)

| Field | Source (board RPC) | Render | Hidden when |
|---|---|---|---|
| Brand | brand display name | « par **{brand}** » | name empty |
| Title | `title` | `line-clamp-2` (ticket: `line-clamp-3`) | never (required) |
| Category | `category` | chip, label from `t.categories[index]` (EN) / DB value (FR) | empty |
| Country | `target_country` | `countryFlag()` + `countryName(code, locale)` — flag `aria-hidden`, name is text | null |
| Pay per creator | `payout_per_creator_fcfa` | `formatFcfa(n, locale)` + « par créateur » | ≤ 0 (should not happen; hide the whole pay row rather than print 0) |
| Platforms | `platforms[]` filtered to `SOCIAL_META` keys | 20 px brand-colour tiles (as `CampaignBriefDetails`), `<ul aria-label="Plateformes">`, each tile has `sr-only` label | array empty |
| Places left | `places_left`, `creator_count_target` | see meter rules below | `places_left` null or target ≤ 0 |
| Deadline | `deadline` (YYYY-MM-DD, compare in Africa/Douala calendar days) | N > 1 « Clôture dans N jours » · N = 1 « Clôture demain » · N = 0 « Clôture aujourd'hui » | null or past |
| Applied | `applied_count` | 1 « 1 créateur a postulé » · n « n créateurs ont postulé » | 0 or null |
| Pill (max one) | derived | « Bientôt complet » if `places_left ≥ 1` and `places_left ≤ ceil(target × 0.2)`; else « Nouveau » if `created_at` < 7 days | neither condition |

**Places meter rules.** The bar shows places **taken** filling up (`taken = target − places_left`).
- `0 < places_left < target` → label « **3 places restantes** sur 10 » + bar at `taken / target`.
- `places_left == target` (nobody selected yet) → text only « 10 places », **no bar** (an empty bar
  reads as "nobody wants this").
- `places_left == 0` → pill « Complet » (muted), no bar, no « Bientôt complet ». See council Q1.

Bar markup (width is static, only `scaleX` animates):
```html
<div aria-hidden class="h-2 overflow-hidden rounded-full bg-brand-50">
  <div class="h-full" style="width: 70%">            <!-- taken / target -->
    <span class="meter-grow block h-full rounded-full bg-accent" style="--d:600ms"></span>
    <!-- grid cards: <span data-reveal="fill" class="block h-full rounded-full bg-accent"> -->
  </div>
</div>
```
The visible label carries the information; the bar is decoration (`aria-hidden`).

**Formatting fix to ship with this work:** `formatFcfa()` (`i18n/format.ts`) joins the amount and
"FCFA" with a normal space, so « FCFA » can wrap onto its own line on 360 px. Use U+00A0 there.

### 0.4 Data the UI needs (for Backend; no schema decided here)
Board RPC fields already in the plan + `places_left`, `applied_count`. The campaign page needs the
same counts for one id (call the board RPC by id or add `places_left`/`applied_count` to
`getPublicCampaign`). The list page needs the **unfiltered total** to decide whether filters render
(§1.2) — one extra unfiltered call when a filter is active.

### 0.5 Card anatomy — one link per card
Cards contain a WhatsApp button, so the card cannot be one `<a>` (nested interactive content).
Pattern for every card:

```html
<li><article class="group relative ... has-[a[data-card-link]:focus-visible]:ring-2 has-[a[data-card-link]:focus-visible]:ring-brand has-[a[data-card-link]:focus-visible]:ring-offset-2">
  <h3><a data-card-link href="/campaigns/{id}" class="after:absolute after:inset-0 after:rounded-[inherit] focus-visible:outline-none">{title}</a></h3>
  …
  <span aria-hidden class="…">Voir l'offre →</span>     <!-- visual CTA, the title link is the accessible one -->
  <a href="https://wa.me/?text=…" class="relative z-10 …" aria-label="Partager « {title} » sur WhatsApp">…</a>
</article></li>
```
The accessible name of each card link is the campaign title (not ten « Voir l'offre »). The card
lifts on hover only for fine pointers: `transition hover:-translate-y-0.5 hover:shadow-cardHover`.

---

## 1. `/campaigns` — the board

### 1.1 Page skeleton and depth map

```
<SiteHeader current="campaigns" />
<main>
  section#board-hero      relative overflow-hidden   ← depth 0 wash lives ONLY here
    eyebrow · H1 · subline · trust line · filters
  section#board-list      bg-white
    <ol> li#1 = pay ticket (col-span-full) · li#2–10 = grid cards </ol>
    thin/empty panel (alert opt-in) when applicable
    page CTA panel (role-aware)
    compact alert band (≥ 3 results, guests + creators)
</main>
<SiteFooter /> <RevealRoot />
```

| Depth | Element | Treatment |
|---|---|---|
| 0 | Hero atmosphere | Exactly the home wash, `aria-hidden`, `pointer-events-none absolute inset-0 -z-10`, `style={{ background: 'radial-gradient(52rem 28rem at 12% -12%, #EAF2FB 0%, transparent 58%), radial-gradient(42rem 26rem at 100% 0%, #FEF1DF 0%, transparent 52%)' }}` — confined to `#board-hero` so the ticket notches sit on pure white |
| 1 | Glow behind the ticket | `aria-hidden absolute -top-6 left-1/2 -z-10 h-48 w-[80%] -translate-x-1/2 rounded-full bg-accent/25 blur-3xl` wrapped in a `float-b` div (`--fd:-3s`), parent has `data-loop-scope` |
| 2 | Ticket texture | Dot grid on the ink half (home partner section): `opacity-40`, `backgroundImage: radial-gradient(rgba(255,255,255,.12) 1px, transparent 1px)`, `backgroundSize: 18px 18px`, `aria-hidden` |
| 3 | **#1 pay ticket — the signature** | §1.4 |
| 4 | H1, subline, filters, cards 2–10, CTA panels | §1.2, §1.5, §1.7 |
| 5 | Pills « Nouveau » / « Bientôt complet » / « Complet », the brand dot after the H1 | Text pills are real text (not `aria-hidden`); the brand dot is `aria-hidden` |

### 1.2 Hero / header

**Mobile (360–414).** `mx-auto max-w-6xl px-4 pt-8 pb-6`.
1. Eyebrow (only when total ≥ 1): `anim-fade inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1 text-[12px] font-semibold text-brand-700` with a `h-1.5 w-1.5 rounded-full bg-accent` dot → « 3 offres ouvertes » / « 1 offre ouverte ». With a filter active the count is the filtered count.
2. H1 — home pattern exactly: `mt-4 font-headline text-[2.3rem] font-bold leading-[1.04] tracking-[-0.035em] text-ink sm:text-[2.9rem] lg:text-[3.35rem]`; `<span class="sr-only">Campagnes ouvertes</span>` + `aria-hidden` lines `["Campagnes", "ouvertes"]` in `.line-mask > .line-in` (`--i` 0,1), `.brand-dot` after the last line. Two lines at every width (it does not fit one line at 360 px anyway).
3. Subline: `anim-rise mt-3 max-w-xl text-[15px] leading-relaxed text-muted sm:text-base`, `--d:280ms`.
4. Trust line (product facts only): `anim-fade mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-medium text-ink/75`, `--d:420ms` — `Lock` « Budget bloqué sous séquestre » · MoMo dots (home markup) « Payé par Mobile Money ».
5. Filters (§1.3), `anim-fade`, `--d:480ms`, `mt-6`.

**Desktop (≥ lg).** Same column, `pt-14 pb-8`; trust line moves to the right of the subline
(`lg:flex lg:items-end lg:justify-between`). No visual on the right — the ticket below is the visual.

### 1.3 Filter chips

- Two rows: **Pays** (« Tous les pays » + 6 from `COUNTRY_CODES`, label `🇳🇬 Nigeria`) and **Catégorie**
  (« Toutes les catégories » + the 11 categories). Each row is `<nav aria-label="Filtrer par pays">`
  containing a `<ul>` of `<Link scroll={false}>` — SSR, no client state, works without JS.
- URL: `?country=NG&cat=beaute`. `country` validated with `isCountryCode`; `cat` is a **slug**
  (beaute, mode, tech, food, musique, sport, sante-bien-etre, humour, education, voyage, business)
  mapped to the DB value. Move the category list out of `campaign-form.tsx` into a shared lib
  (`{ slug, fr }` + EN label by index from `t.categories`). Each chip keeps the other param.
- Chip: `inline-flex min-h-tap shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-medium text-ink transition hover:border-brand hover:text-brand`.
  Active: `border-ink bg-ink text-white` + `aria-current="true"`.
- Mobile: each row is a horizontal rail `no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(90deg,#000_88%,transparent)]`; rows stacked `space-y-2`. Desktop: `flex-wrap`, no mask.
- When any filter is active, a third element « Effacer les filtres » (text link, `min-h-tap text-sm font-semibold text-brand-700`) after the rows.
- **Render rule:** filters show only when the unfiltered total ≥ 4 **or** a filter is active. Below
  4 offers, 17 chips promise a choice that does not exist; the alert opt-in carries the
  country/category choice instead.

### 1.4 The #1 offer — the pay ticket (signature element)

The most characteristic object in Bayele's world is the moment the creator is paid. The #1 offer is
drawn as a **Mobile-Money pay ticket**: the offer on a dark half, a perforated tear line with two
punched notches, and a white stub that reads « Vous recevez » with the pay in large display type.
It is the only dark, large, moving object on the page.

**Container.** `<li class="col-span-full">` → `<article class="anim-rise group relative isolate" style="--d:200ms">`
→ inner `relative overflow-hidden rounded-[2rem] shadow-cardHover ring-1 ring-ink/5 lg:grid lg:grid-cols-[1.4fr_1fr]`.

**Offer half** (`relative bg-ink p-5 text-white sm:p-7 lg:p-9`):
1. Row: label « Offre la mieux payée » (`rounded-full bg-white/10 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-accent`) — true by D4 ranking (pay first); right side: one pill if applicable (`rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-bold text-ink`; « Complet » uses `bg-white/15 text-white`).
2. Meta: category chip `rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase` + country `text-[13px] text-white/80`.
3. Title `<h3>` + stretched link: `mt-3 text-balance font-headline text-[1.6rem] font-bold leading-[1.1] tracking-[-0.02em] line-clamp-3 sm:text-[2rem]`.
4. « par **{brand}** » `mt-1 text-[14px] text-white/70`, brand `font-semibold text-white`.
5. Platforms row `mt-4 flex gap-1.5`: tiles `grid h-7 w-7 place-items-center rounded-lg bg-white/10` with the white glyph.
6. Facts `mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-white/80`: `CalendarClock` (accent) deadline · `Users` (accent) applied count.

**Tear line.** Mobile: the stub has `border-t-2 border-dashed border-ink/15` and two notches:
`before:` / `after:` pseudo-elements `absolute -top-3 h-6 w-6 rounded-full bg-white` at `-left-3` and
`-right-3` (`aria-hidden` by nature). Desktop (lg): the dashed border moves to `lg:border-l-2 lg:border-t-0`
and the notches to `lg:-left-3 lg:-top-3` / `lg:-left-3 lg:-bottom-3`. The page behind is pure white
(§1.1), so the notches read as punched holes.

**Stub** (`relative bg-white p-5 text-ink sm:p-7 lg:flex lg:flex-col lg:justify-center lg:p-9`):
1. « Vous recevez » `text-[12px] font-bold uppercase tracking-wide text-brand-700`.
2. Pay: `mt-1 font-display text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums sm:text-[3rem]`; the currency is a child span `ml-1 text-[0.42em] font-bold text-muted` (« FCFA »); below « par créateur » `text-[13px] text-muted`.
3. `mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink`: `Lock` (brand) « Budget bloqué sous séquestre ».
4. Places meter (§0.3) `mt-4`, `--d:600ms`, class `meter-grow`. Label row `flex justify-between text-[13px]`.
5. Footer `mt-5 flex items-center gap-2`: visual CTA `aria-hidden flex min-h-tap flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-bold text-white shadow-card transition group-hover:bg-brand-600` « Voir l'offre » + `ArrowRight`; WhatsApp icon button (§3) `relative z-10`.

**States.** Hover (fine pointer): inner container `group-hover:-translate-y-0.5` (transition transform only).
Focus: ring on the article via `has-[]` (§0.5). Missing fields collapse per §0.3 — the stub never
shows an empty meter or a « 0 ». Filters active: the ticket is #1 *of the filtered list* (label
unchanged; still true within the filter).

**Motion summary.** Ticket `anim-rise` 200 ms → meter `meter-grow` 600 ms → glow drifts on `float-b`
(desktop only in practice). Reduced motion: everything static, fully visible.

### 1.5 Cards 2–10

**Grid.** Cards 2–10 are `<li>` in the same `<ol>` as the ticket:
`<ol aria-label="Campagnes classées par rémunération" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">`
(ticket `col-span-full`, `mb-2`). Mobile: one column, full width.

**Card.** `<article data-reveal="up" style={d(Math.min(i,5)*60)} class="group relative flex flex-col rounded-3xl border border-line bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-cardHover">`
1. Top row `flex items-center justify-between gap-2`: left = category chip (`rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-bold uppercase text-brand-700`) + country (`text-[12px] text-muted`); right = pill (`rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-ink`; « Complet » `bg-surface text-muted`).
2. Title `<h3>` + stretched link `mt-3 font-display text-[17px] font-bold leading-snug text-ink line-clamp-2`.
3. « par **{brand}** » `mt-0.5 text-[13px] text-muted`.
4. Pay `mt-3 flex items-baseline gap-1.5`: `Coins` (accent, `self-center`) + `font-display text-xl font-extrabold tabular-nums text-ink` + « / créateur » `text-[12px] text-muted`.
5. Platforms tiles `mt-3` (20 px tiles, brand colour, as `CampaignBriefDetails`).
6. Places meter `mt-4` (bar uses `data-reveal="fill"`, §0.3).
7. Facts `mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted`: deadline · applied.
8. Footer `mt-auto flex items-center justify-between gap-2 border-t border-line pt-3` (`mt-auto` keeps footers aligned in a row): visual « Voir l'offre → » `aria-hidden inline-flex min-h-tap items-center gap-1.5 text-sm font-bold text-brand-700 group-hover:text-brand` + WhatsApp icon button.

### 1.6 Page CTA « Voir toutes les campagnes » (role-aware, D5)

Placement: after the list (or after the thin/empty panel), `mt-10`.
Panel: `data-reveal="up" rounded-3xl border border-line bg-surface p-6 text-center sm:p-10`;
heading `font-display text-xl font-bold text-ink sm:text-2xl`; helper `mx-auto mt-2 max-w-md text-[15px] text-muted`;
button `mt-5 inline-flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-6 text-[15px] font-bold text-white shadow-card transition hover:bg-brand-600 active:scale-95 sm:w-auto` + `ArrowRight`.

Hrefs resolve in `lib/auth/campaign-ctas.ts` (drift-guard test, `landing-ctas.ts` pattern):

| Viewer | Heading | Button label | Href | Under the button |
|---|---|---|---|---|
| Logged out | « Toutes les offres sont dans votre espace créateur » | « Voir toutes les campagnes » | `/auth?mode=signup&role=creator&intent=campaigns&source=campaigns_list&next=/creator/campaigns` (+ `&ref=` if the page was opened with a valid `?ref`) | « Déjà membre ? **Se connecter** » → `/auth?mode=signin&next=/creator/campaigns` |
| Creator (any status but suspended/rejected) | « Prêt à postuler ? » | « Voir toutes les campagnes » | `/creator/campaigns` | — |
| Partner (`consultant`) | « Vos créateurs peuvent postuler » | « Postuler pour mes créateurs » | `/partner/campaigns` | — |
| Brand | « Votre offre peut être ici » | « Lancer une campagne » | `/business/campaigns/new` | — |
| Admin | « Vue admin » | « Ouvrir le tableau de bord » | `/admin/dashboard` | — |

Multi-role accounts use `session.primary` (same ordering as `homeContinueCtas`).

### 1.7 Empty state (0) and thin state (1–2) — the alert opt-in is the conversion device

| Results | What renders (in order) |
|---|---|
| **0, no filter** | Hero (no eyebrow, no filters) → **Empty panel** with the alert opt-in (`variant="panel"`) → for brands only, the page CTA « Lancer une campagne »; for everyone else no page CTA (there is nothing more to see). |
| **0, filter active** | Hero with filters → **Filtered-empty panel**: « Aucune campagne ne correspond à ces filtres pour l'instant » + link « Voir toutes les campagnes ouvertes » (`/campaigns`, resets filters) + alert opt-in prefilled with the active filters → page CTA. |
| **1** | Ticket → **Thin panel** (alert opt-in) → page CTA. |
| **2** | Ticket → card #2 and the thin panel side by side on `lg` (card 1 col, panel `lg:col-span-2`); stacked on mobile → page CTA. |
| **≥ 3** | Ticket → grid → page CTA → compact alert band (§4, guests and creators only). |

**Empty panel.** `data-reveal="up" rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10`,
`lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-10`. Left: icon tile `grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand` (`Megaphone`), H2 `mt-4 font-display text-xl font-bold text-ink sm:text-2xl`, body `mt-2 text-[15px] leading-relaxed text-muted`, and for logged-out visitors a quiet link « Vous êtes une marque ? **Lancer une campagne** » (`/auth?mode=signup&role=business`). Right: the opt-in form.
**Thin panel.** Same shell on `bg-surface`, no shadow, H2 « Soyez prévenu des prochaines campagnes ».
Never render placeholder or "example" campaigns in these states.

Brands, partners and admins never see the alert form (alerts belong to creators); in its place
they see the page CTA for their role.

### 1.8 SEO hooks (for the Frontend seat; no visual impact)
`ItemList` JSON-LD in the same order as the `<ol>`; metadata title « Campagnes ouvertes pour créateurs · Bayele »;
`alternates.canonical: '/campaigns'` (filtered URLs canonicalise to the unfiltered page).

---

## 2. Soft wall on `/campaigns/[id]` (D1)

### 2.1 Logged-out layout (mobile first; desktop keeps the existing `max-w-3xl` column)

1. Back link becomes « ← Toutes les campagnes » → `/campaigns` (replaces « Découvrir Bayele »).
2. Existing card header kept (gradient band, megaphone tile, category, country, H1, « Proposée par »).
3. **Public facts block** (new order, all public per D1): pay + places tiles (existing two `bg-surface`
   tiles; the « Créateurs recherchés » tile shows « 3 places restantes / sur 10 » when the meter rule
   applies, else the target), then a facts row: deadline · applied count · platforms tiles. Hide per §0.3.
4. Escrow trust line (existing emerald strip) — kept, it is the best argument on the page.
5. **Locked brief panel** (replaces brief text + `CampaignBriefDetails` + `CampaignApplyCTA`).
6. WhatsApp share (§3) below the panel.

### 2.2 Locked brief panel

```
section aria-labelledby="wall-title"  relative overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6
  div aria-hidden  space-y-2.5 blur-[2px] select-none          ← depth 2, decorative skeleton
    5 bars: h-2.5 rounded-full bg-ink/10, widths 92% · 100% · 78% · 96% · 54%
  div aria-hidden  absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-transparent to-surface   ← fade
  div  relative -mt-6 text-center                             ← depth 4
    span grid h-11 w-11 place-items-center rounded-full bg-white shadow-card mx-auto → Lock (text-brand)
    h2#wall-title  mt-3 font-display text-lg font-bold text-ink
    p  mt-1 text-[14px] text-muted
    ul  mt-3 inline-flex flex-col gap-1.5 text-left text-[13px] font-medium text-ink → Check (brand) × 3 generic labels
    a  mt-5 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-[15px] font-bold text-white shadow-card hover:bg-brand-600 active:scale-95 sm:mx-auto sm:w-auto
       « Créer mon compte pour postuler »
    p  mt-2 text-[13px] text-muted « Déjà membre ? » a.font-semibold.text-brand-700 « Se connecter »
```

- The skeleton bars are pure decoration: **no brief text, no deliverables, no tags anywhere in the
  logged-out HTML** — not in a hidden element, not in `<meta name="description">`, not in OpenGraph,
  not in the JSON-LD. ⚠️ Today `generateMetadata` and `jobPostingLd` use `c.brief`; both must switch
  to a teaser built from public fields: « {brand} recrute des créateurs pour une campagne {category}
  {countryIn}. {pay} par créateur, paiement sécurisé par séquestre sur Bayele. » (the existing
  fallback string). The checklist labels are generic product nouns, not campaign content.
- CTA hrefs (unchanged funnel + attribution): sign-up
  `/auth?mode=signup&role=creator&intent=apply&target={id}&source=campaign_page&next=/campaigns/{id}`
  (+ `&ref={ref}` when the page was opened with a valid `?ref`, in which case `source=referral`);
  sign-in `/auth?mode=signin&next=/campaigns/{id}`.
- Motion: none beyond the page (the panel is the answer, not a show). Reduced motion unaffected.
- Accessibility: the heading names the lock; the skeleton and fade are `aria-hidden`; the lock icon
  is decorative.

### 2.3 Signed in
The panel is not rendered. In its place, the existing blocks in this order: brief text →
`CampaignBriefDetails` (full) → `CampaignApplyCTA` (all its existing role states) → WhatsApp share.
No "unlocked" animation; after sign-up the visitor simply lands on the full page (`next`).

### 2.4 Auth page banner (small copy addition)
`app/(auth)/auth/page.tsx` shows its intent banner only when `intent && target`. Extend it so
`intent=campaigns` and `intent=alerts` show a banner **without** a target (copy in §7). Same styling.

---

## 3. WhatsApp share (cards + campaign page)

**Why WhatsApp only.** It is where creator offers circulate in our markets (status, groups). One
clear button beats a share sheet of logos.

**Mechanics.** A plain server-rendered link — no client JS:
`<a href="https://wa.me/?text={encodeURIComponent(message)}" target="_blank" rel="noopener noreferrer">`.
`{url}` is absolute (`SITE_URL` from `lib/seo.ts`) `/campaigns/{id}`, plus `?ref={handle}` when the
viewer is signed in **as a creator or a partner** with a public handle. Logged-out visitors, brands
and admins share the clean URL. `{pay}` = `formatFcfa(payout, locale)`.

**Message templates** (one emoji-free line so it previews cleanly; WhatsApp unfurls the existing OG image):
- FR: `Offre pour créateurs sur Bayele : « {title} » — {pay} par créateur, budget déjà bloqué sous séquestre. Voir l'offre : {url}`
- EN: `Creator offer on Bayele: "{title}" — {pay} per creator, budget already locked in escrow. See the offer: {url}`

**On cards (ticket + grid + home strip).** Icon-only, right end of the card footer:
`relative z-10 grid h-tap w-tap shrink-0 place-items-center rounded-xl border border-line bg-white transition hover:border-[#25D366] active:scale-95`
containing a `h-6 w-6 rounded-md` tile in `SOCIAL_META.whatsapp.brand` with the white glyph (`SocialIcon`).
`aria-label="Partager « {title} » sur WhatsApp"`. On the dark ticket the button sits on the white
stub, so it is unchanged.

**On the campaign page.** Full-width secondary button under the apply CTA / wall:
`mt-3 flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 text-[15px] font-bold text-ink hover:border-[#25D366] sm:w-auto` + tile + « Partager sur WhatsApp ».
Signed-in creator/partner: one helper line below, `text-[12px] text-muted`: « Votre lien de partage
contient votre identifiant : les créateurs qui s'inscrivent grâce à vous vous sont attribués. »
(no reward promise — council Q3). Next to it, a text button « Copier le lien » reusing the clipboard
logic of `share-campaign-button.tsx` (copies the same URL, ref included).

**Contrast.** White text on `#25D366` is 2:1 — never use a solid green button with white text. The
green appears only as the glyph tile and the hover border.

**Attribution source map** (what each CTA appends for the auth page → `signup_source`):

| Entry | `source` |
|---|---|
| Any sign-up link on `/campaigns` (page CTA, alert opt-in) | `campaigns_list` |
| Wall CTA on `/campaigns/[id]` | `campaign_page` |
| Any page opened with a valid `?ref` (ref is forwarded into the sign-up href) | `referral` (wins) |
| Home strip → campaign → wall | `campaign_page` (the last page owns it; the home strip has no sign-up button) |
| Header « Commencer », home hero | unchanged (`direct` by default) |

Ref travels in URLs only (no cookie) in v1 — council Q4.

---

## 4. Campaign-alert opt-in

**Component** `CampaignAlertOptIn({ variant: 'panel' | 'band', defaults: { country?, cat? } })`.
A `<form>` whose `action` is a server action (works without JS, progressive enhancement).

**Fields** — two native `<select>` (16 px on mobile by the global rule, OS picker on Android):
- « Pays » — « Tous les pays » + 6 countries (`countryOptions(locale)`); default = active filter →
  signed-in profile country → « Tous les pays ».
- « Catégorie » — « Toutes les catégories » + 11; default = active filter → « Toutes ».
- Submit « M'alerter » (`Bell` icon).

**Layout.** Panel: labels `text-xs font-semibold text-ink`, selects `mt-1 w-full min-h-tap rounded-xl border border-line bg-white px-3 text-sm text-ink focus:border-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30`,
mobile stacked `grid gap-3`, `sm:grid-cols-2`, button full width below (`bg-brand` primary).
Band (≥ 3 results): `border-t border-line pt-8 mt-10`, one row on `lg` (`lg:grid-cols-[1fr_auto_auto_auto] lg:items-end`): title + the two selects + button; secondary button style (`border border-line bg-white text-ink`) so it never competes with the page CTA.

**Logged out.** Under the button: « Gratuit. Créez votre compte créateur pour activer l'alerte. »
The server action validates country/category and redirects to
`/auth?mode=signup&role=creator&intent=alerts&source=campaigns_list&next=/creator/campaigns?alert_country=NG&alert_cat=beaute#alertes`
(the `next` value encoded). Nothing is written before the account exists.

**Return after sign-up (one-tap confirm, no write on GET).** `/creator/campaigns` reads the two
params and shows, at the top of « Mes alertes », a highlighted card
(`rounded-2xl border border-brand-100 bg-brand-50 p-4`): « Activez votre alerte » · « 🇳🇬 Nigeria · Beauté »
· primary « Activer l'alerte ». One tap creates it and shows the confirmation state.

**Signed in (creator).** Submit creates the alert and the form is replaced in place by the
confirmation (`role="status"`):
`rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700` · `CheckCircle2` ·
**« Alerte activée »** · « Nigeria · Beauté » · « Vous serez prévenu dès qu'une campagne correspondante
est publiée. » · link « Gérer mes alertes » → `/creator/campaigns#alertes`.
Duplicate: same card in neutral (`bg-surface text-ink`) « Vous avez déjà cette alerte. ».
Limit reached (5 per creator, enforced server-side): inline error under the button.

**Management list — lives on `/creator/campaigns`**, section `id="alertes"` right under the H1
(where creators already go for offers):
- `<h2>` « Mes alertes » `text-sm font-bold text-ink`.
- Each alert is a removable chip: `inline-flex min-h-tap items-center gap-2 rounded-full border border-line bg-white pl-4 pr-1 text-sm text-ink`
  with a `h-10 w-10 rounded-full hover:bg-surface` `X` button, `aria-label="Supprimer l'alerte Nigeria · Beauté"` (inside a `<form>` with a server action).
- « Ajouter une alerte » = `<details>` (no JS) whose content is the `band` form.
- None yet: the `panel` form is shown open, with « Aucune alerte pour l'instant. ».
Not on `/profile` — profile is identity, alerts are about finding work.

---

## 5. Home « Campagnes ouvertes » strip + header nav

### 5.1 Home strip
- **Placement:** directly after the proof strip, before the categories marquee:
  `<section class="mx-auto max-w-6xl px-4 pt-14" aria-labelledby="home-campaigns">`. Highest intent
  spot that does not touch the hero.
- **Hidden entirely when the board returns 0** (no heading, no empty state on the home page).
- Header row `flex items-end justify-between`: H2 `data-reveal="up" font-headline text-2xl font-bold tracking-[-0.02em] text-ink` « Campagnes ouvertes » + link « Tout voir » `inline-flex min-h-tap items-center gap-1 text-sm font-bold text-brand-700` → `/campaigns`.
- Content: top 3 (D4 order), the **grid card** from §1.5 (same component, meter included — it is the urgency cue).
  - Mobile: snap rail `no-scrollbar -mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2`, cards `w-[84%] max-w-[340px] shrink-0 snap-start` so the next card peeks (signals scroll). Rail is a `<ul aria-label="Campagnes ouvertes">`.
  - 1 result: the single card at full width (no rail). ≥ sm: `sm:grid sm:grid-cols-3 sm:overflow-visible`.
- Motion: H2 `data-reveal="up"`, cards `data-reveal="up"` with `d(80 + i*60)`. No loop.
- Depth: 4 (content); no own atmosphere (it sits on white between the proof strip and the marquee).

### 5.2 Header nav « Campagnes »
- Desktop (`md:flex` nav): **first item**, before « Créateurs ». Mobile (scrollable second row):
  **first item**, so it is visible at 360 px without scrolling the row.
- Label from `t.nav.campaigns`. Same classes as siblings; no badge, no live count (a count in the
  header would need a query on every page and would go stale in cached HTML).
- Active state: `SiteHeader` gains an optional prop `current?: 'campaigns'`; when set, the item gets
  `aria-current="page"` and `text-ink font-semibold` (desktop) / `bg-brand-50 text-brand` (mobile).
  `/campaigns` and `/campaigns/[id]` pass it.

---

## 6. Admin attribution widget (`/admin/dashboard`)

Admin pages are French-only today (hard-coded strings); keep that convention here.

- **Placement:** a new card after « Répartition des membres », same shell
  (`rounded-2xl border border-line bg-white p-4 shadow-card`), `sm:grid sm:grid-cols-2 sm:gap-6` inside.
- Header row: « Origine des inscriptions · 30 derniers jours » (`text-sm font-bold text-ink`) and on
  the right « Campagnes publiques ouvertes : **N** » linking to `/campaigns` (tracks the thin-inventory risk).
- **Left — sources:** reuse the existing `Bar` component (`value/total`, pure CSS) for each
  `signup_source`, sorted by count: « Page Campagnes » (`campaigns_list`, `bg-brand`) · « Page d'une
  campagne » (`campaign_page`, `bg-brand-700`) · « Lien de parrainage » (`referral`, `bg-accent`) ·
  « Accueil » (`home`, `bg-emerald-500`) · « Direct » (`direct`, `bg-ink`). Each row: label · count ·
  share in % (FR: `42 %` with U+202F). A last muted line « Non suivi : N » counts sign-ups with a null
  source in the period (accounts created before tracking or via a path that sets none).
- **Right — top referrers:** `<ol>` of up to 5: `@handle` (`font-semibold text-ink`) · « N inscriptions »
  · « dont M actifs » (`text-muted`; active = profile status `active`, the honest quality signal
  against referral farming). Handle links to `/admin/users?q={handle}`.
- Empty (no attributed sign-ups in 30 days): one line « Aucune inscription attribuée sur la période. »
  — no zero-filled bars.
- Footer `border-t border-line pt-3 text-[11px] text-muted`: « Suivi depuis le {date de mise en
  service}. Les inscriptions antérieures ne sont pas attribuées. »
- No chart library, no motion.

---

## 7. Copy (FR + EN)

Namespaces: `nav.campaigns`, `campaignBoard.*`, `share.*`, `alerts.*`, `auth.intent*` (if the auth
page is moved to the dictionary; otherwise inline FR like its current banners). `{n}`, `{title}`,
`{pay}`, `{url}`, `{brand}`, `{total}` are replaced at render. Plurals use separate `One`/`Many` keys
(the codebase has no ICU).

| Key | FR | EN |
|---|---|---|
| `nav.campaigns` | Campagnes | Campaigns |
| `campaignBoard.meta.title` | Campagnes ouvertes pour créateurs | Open campaigns for creators |
| `campaignBoard.meta.description` | Des marques paient des créateurs au Cameroun, en Côte d'Ivoire, au Gabon, au Nigeria, au Kenya et en Afrique du Sud. Budget bloqué sous séquestre, paiement par Mobile Money. | Brands pay creators in Cameroon, Côte d'Ivoire, Gabon, Nigeria, Kenya and South Africa. Budget locked in escrow, paid by Mobile Money. |
| `campaignBoard.title` | Campagnes ouvertes | Open campaigns |
| `campaignBoard.titleLines` | ["Campagnes", "ouvertes"] | ["Open", "campaigns"] |
| `campaignBoard.eyebrowOne` | 1 offre ouverte | 1 open offer |
| `campaignBoard.eyebrowMany` | {n} offres ouvertes | {n} open offers |
| `campaignBoard.subtitle` | Des marques paient des créateurs comme vous — le budget est déjà bloqué sous séquestre. | Brands pay creators like you — the budget is already locked in escrow. |
| `campaignBoard.trust` | ["Budget bloqué sous séquestre", "Payé par Mobile Money"] | ["Budget locked in escrow", "Paid by Mobile Money"] |
| `campaignBoard.filters.country` | Filtrer par pays | Filter by country |
| `campaignBoard.filters.category` | Filtrer par catégorie | Filter by category |
| `campaignBoard.filters.allCountries` | Tous les pays | All countries |
| `campaignBoard.filters.allCategories` | Toutes les catégories | All categories |
| `campaignBoard.filters.reset` | Effacer les filtres | Clear filters |
| `campaignBoard.listLabel` | Campagnes classées par rémunération | Campaigns ranked by pay |
| `campaignBoard.featured.label` | Offre la mieux payée | Best-paid offer |
| `campaignBoard.featured.youReceive` | Vous recevez | You receive |
| `campaignBoard.card.by` | par {brand} | by {brand} |
| `campaignBoard.card.perCreator` | par créateur | per creator |
| `campaignBoard.card.perCreatorShort` | / créateur | / creator |
| `campaignBoard.card.escrow` | Budget bloqué sous séquestre | Budget locked in escrow |
| `campaignBoard.card.cta` | Voir l'offre | See the offer |
| `campaignBoard.card.platforms` | Plateformes | Platforms |
| `campaignBoard.card.placesLeftOne` | 1 place restante | 1 spot left |
| `campaignBoard.card.placesLeftMany` | {n} places restantes | {n} spots left |
| `campaignBoard.card.placesOf` | sur {total} | of {total} |
| `campaignBoard.card.placesTotal` | {n} places | {n} spots |
| `campaignBoard.card.closesToday` | Clôture aujourd'hui | Closes today |
| `campaignBoard.card.closesTomorrow` | Clôture demain | Closes tomorrow |
| `campaignBoard.card.closesIn` | Clôture dans {n} jours | Closes in {n} days |
| `campaignBoard.card.appliedOne` | 1 créateur a postulé | 1 creator has applied |
| `campaignBoard.card.appliedMany` | {n} créateurs ont postulé | {n} creators have applied |
| `campaignBoard.card.pillNew` | Nouveau | New |
| `campaignBoard.card.pillAlmostFull` | Bientôt complet | Almost full |
| `campaignBoard.card.pillFull` | Complet | Full |
| `campaignBoard.cta.guest.heading` | Toutes les offres sont dans votre espace créateur | Every offer is waiting in your creator space |
| `campaignBoard.cta.guest.label` | Voir toutes les campagnes | See all campaigns |
| `campaignBoard.cta.guest.helper` | Créez votre profil créateur gratuitement pour tout voir et postuler en un clic. | Create your free creator profile to see everything and apply in one tap. |
| `campaignBoard.cta.guest.signinPrefix` | Déjà membre ? | Already a member? |
| `campaignBoard.cta.guest.signin` | Se connecter | Sign in |
| `campaignBoard.cta.creator.heading` | Prêt à postuler ? | Ready to apply? |
| `campaignBoard.cta.creator.label` | Voir toutes les campagnes | See all campaigns |
| `campaignBoard.cta.creator.helper` | Postulez depuis votre espace créateur. | Apply from your creator space. |
| `campaignBoard.cta.partner.heading` | Vos créateurs peuvent postuler | Your creators can apply |
| `campaignBoard.cta.partner.label` | Postuler pour mes créateurs | Apply for my creators |
| `campaignBoard.cta.partner.helper` | Proposez vos talents depuis votre espace partenaire. | Put your talent forward from your partner space. |
| `campaignBoard.cta.brand.heading` | Votre offre peut être ici | Your offer can be here |
| `campaignBoard.cta.brand.label` | Lancer une campagne | Launch a campaign |
| `campaignBoard.cta.brand.helper` | Votre campagne apparaît sur cette page dès que son budget est sous séquestre. | Your campaign appears on this page as soon as its budget is in escrow. |
| `campaignBoard.cta.admin.heading` | Vue admin | Admin view |
| `campaignBoard.cta.admin.label` | Ouvrir le tableau de bord | Open the dashboard |
| `campaignBoard.cta.admin.helper` | Campagnes, financements et inscriptions. | Campaigns, funding and sign-ups. |
| `campaignBoard.empty.title` | Aucune campagne ouverte pour l'instant | No open campaigns right now |
| `campaignBoard.empty.body` | Les marques publient ici leurs offres dès que le budget est bloqué sous séquestre. Activez une alerte : nous vous prévenons dès qu'une campagne correspond à votre pays. | Brands post their offers here as soon as the budget is locked in escrow. Turn on an alert: we'll tell you when a campaign matches your country. |
| `campaignBoard.empty.brandPrefix` | Vous êtes une marque ? | Are you a brand? |
| `campaignBoard.empty.brandLink` | Lancer une campagne | Launch a campaign |
| `campaignBoard.emptyFiltered.title` | Aucune campagne ne correspond à ces filtres pour l'instant | No campaign matches these filters yet |
| `campaignBoard.emptyFiltered.showAll` | Voir toutes les campagnes ouvertes | See all open campaigns |
| `campaignBoard.thin.title` | Soyez prévenu des prochaines campagnes | Hear about the next campaigns first |
| `campaignBoard.thin.body` | Choisissez votre pays et votre catégorie : nous vous prévenons dès qu'une nouvelle offre est publiée. | Pick your country and category: we'll tell you as soon as a new offer is posted. |
| `campaignBoard.wall.back` | Toutes les campagnes | All campaigns |
| `campaignBoard.wall.title` | Le brief complet est réservé aux créateurs inscrits | The full brief is for registered creators |
| `campaignBoard.wall.body` | Créez votre compte gratuit pour lire le brief, voir les livrables attendus et postuler. | Create your free account to read the brief, see the deliverables and apply. |
| `campaignBoard.wall.items` | ["Le brief de la marque", "Les livrables attendus", "Les éléments obligatoires"] | ["The brand's brief", "Expected deliverables", "Mandatory elements"] |
| `campaignBoard.wall.cta` | Créer mon compte pour postuler | Create my account to apply |
| `campaignBoard.wall.signinPrefix` | Déjà membre ? | Already a member? |
| `campaignBoard.wall.signin` | Se connecter | Sign in |
| `campaignBoard.wall.seoTeaser` | {brand} recrute des créateurs pour une campagne {category} {countryIn}. {pay} par créateur, paiement sécurisé par séquestre sur Bayele. | {brand} is hiring creators for a {category} campaign in {country}. {pay} per creator, payment secured by escrow on Bayele. |
| `campaignBoard.home.heading` | Campagnes ouvertes | Open campaigns |
| `campaignBoard.home.seeAll` | Tout voir | See all |
| `share.whatsapp` | Partager sur WhatsApp | Share on WhatsApp |
| `share.whatsappAria` | Partager « {title} » sur WhatsApp | Share "{title}" on WhatsApp |
| `share.message` | Offre pour créateurs sur Bayele : « {title} » — {pay} par créateur, budget déjà bloqué sous séquestre. Voir l'offre : {url} | Creator offer on Bayele: "{title}" — {pay} per creator, budget already locked in escrow. See the offer: {url} |
| `share.refNote` | Votre lien de partage contient votre identifiant : les créateurs qui s'inscrivent grâce à vous vous sont attribués. | Your share link carries your handle: creators who sign up through it are credited to you. |
| `share.copy` | Copier le lien | Copy link |
| `share.copied` | Lien copié | Link copied |
| `alerts.title` | Prévenez-moi des nouvelles campagnes | Tell me about new campaigns |
| `alerts.country` | Pays | Country |
| `alerts.category` | Catégorie | Category |
| `alerts.allCountries` | Tous les pays | All countries |
| `alerts.allCategories` | Toutes les catégories | All categories |
| `alerts.submit` | M'alerter | Alert me |
| `alerts.guestHint` | Gratuit. Créez votre compte créateur pour activer l'alerte. | Free. Create your creator account to turn on the alert. |
| `alerts.confirmTitle` | Activez votre alerte | Turn on your alert |
| `alerts.confirm` | Activer l'alerte | Turn on alert |
| `alerts.success` | Alerte activée | Alert on |
| `alerts.successBody` | Vous serez prévenu dès qu'une campagne correspondante est publiée. | We'll tell you as soon as a matching campaign is posted. |
| `alerts.duplicate` | Vous avez déjà cette alerte. | You already have this alert. |
| `alerts.limit` | Vous avez déjà 5 alertes. Supprimez-en une pour en ajouter une autre. | You already have 5 alerts. Remove one to add another. |
| `alerts.manage` | Gérer mes alertes | Manage my alerts |
| `alerts.listTitle` | Mes alertes | My alerts |
| `alerts.listEmpty` | Aucune alerte pour l'instant. | No alerts yet. |
| `alerts.add` | Ajouter une alerte | Add an alert |
| `alerts.remove` | Supprimer l'alerte {label} | Remove the {label} alert |
| `alerts.invalid` | Choisissez un pays et une catégorie valides. | Pick a valid country and category. |
| auth banner `intent=campaigns` | Créez votre compte créateur pour voir toutes les campagnes ouvertes et postuler. | Create your creator account to see every open campaign and apply. |
| auth banner `intent=alerts` | Créez votre compte créateur : votre alerte campagne sera prête à activer. | Create your creator account: your campaign alert will be ready to turn on. |

**Admin (FR only, hard-coded like the rest of `/admin`):** « Origine des inscriptions · 30 derniers
jours » · « Campagnes publiques ouvertes : N » · « Page Campagnes » · « Page d'une campagne » · « Lien
de parrainage » · « Accueil » · « Direct » · « Non suivi : N » · « Meilleurs parrains » · « N inscriptions »
· « dont M actifs » · « Aucune inscription attribuée sur la période. » · « Suivi depuis le {date}. Les
inscriptions antérieures ne sont pas attribuées. »

Voice check: every button is a verb the user controls (« Voir l'offre », « M'alerter », « Créer mon
compte pour postuler », « Lancer une campagne »); the action keeps its name through the flow
(« M'alerter » → « Activer l'alerte » → « Alerte activée »). No frequency claims (« chaque semaine »
was removed from the plan's empty-state copy: it is not backed by data today).

---

## 8. Checklists

### 8.1 Virality — element → funnel step

| Funnel step | Element | What it does |
|---|---|---|
| **Discover** | Header « Campagnes » (first item, desktop + mobile) | Every public page becomes an entry point |
| | Home strip (top 3, hidden at 0) | Converts brand-curious and creator traffic already on the home page |
| | WhatsApp share (cards, ticket, campaign page) | Puts offers in groups and statuses, with OG image unfurl |
| | `ItemList` + `JobPosting` (teaser description) | Google job results keep working under the soft wall |
| **Evaluate** | Pay ticket (#1) | Makes « real money, already locked » the first thing seen |
| | Card fields with live counts (places, deadline, applied) | Real urgency; nothing invented, hidden at zero |
| | Country/category filters (≥ 4 offers) | Local relevance |
| | Public facts on the campaign page | Enough to decide; brief withheld as the reason to sign up |
| **Convert** | Locked brief panel « Créer mon compte pour postuler » | Primary sign-up from a specific offer, returns to it |
| | Page CTA « Voir toutes les campagnes » (role-aware) | Sign-up from browsing; signed-in users routed, never re-funnelled |
| | Alert opt-in (panel in empty/thin, band otherwise) | Turns "nothing for me yet" into an account |
| **Return** | Alert notification + `/creator/campaigns#alertes` | Brings the creator back when inventory appears |
| **Share** | `?ref=` on creator/partner shares + ref note | Each signed-in creator becomes a distribution channel |
| **Measure** | `source` on every sign-up link, admin widget, public-open count | Honest read of which surface converts |

### 8.2 Accessibility

- [ ] **Tap targets ≥ 48 px:** chips, filter reset, card WhatsApp button (`h-tap w-tap`), alert remove buttons (40 px icon inside a 48 px chip row — the chip itself is `min-h-tap`), all CTAs `min-h-tap`.
- [ ] **One link per card**, named by the campaign title; visual « Voir l'offre » is `aria-hidden`; WhatsApp link has its own `aria-label` with the title.
- [ ] **Focus:** visible ring on cards via `has-[a[data-card-link]:focus-visible]:ring-2 ring-brand ring-offset-2`; selects `focus-visible:ring-2 ring-brand/30`; no `outline-none` without a replacement.
- [ ] **Headings:** H1 page → H2 sections (sr-only H2 is not needed: the `<ol>` has `aria-label`) → H3 card titles. Wall panel `aria-labelledby`.
- [ ] **Decor is `aria-hidden`:** atmosphere, glow, dot texture, notches (pseudo), skeleton bars, fade, meter bars, flags next to a country name, brand dot, H1 line-mask spans (real text in `sr-only`).
- [ ] **Filters:** `<nav aria-label>` per row, active chip `aria-current="true"`, `scroll={false}`.
- [ ] **Status messages:** alert confirmation / duplicate / errors in `role="status"` (errors `role="alert"`).
- [ ] **Reduced motion:** covered by the global rule + `.meter-grow` added to the explicit list; nothing is hidden without JS (`RevealRoot` arms reveals only after mount).
- [ ] **Contrast:** `text-muted` on white 5.5:1 and on `bg-surface` 5.2:1 ✓; `text-brand-700`/`text-brand` on white ✓; white on `bg-brand` 5.7:1 ✓; `text-accent` **only on `bg-ink`** (7.6:1); `text-white/70` on ink ✓ for 14 px+; ink on `bg-accent` pills 7.6:1 ✓; never white on WhatsApp green (2:1).
- [ ] **Mobile:** 360 px — ticket pay `text-[2.5rem]` fits « 1 500 000 FCFA » (currency at 0.42 em); no horizontal page scroll (rails use `-mx-4 px-4` inside `overflow-x-auto` only); selects are 16 px (no iOS zoom).
- [ ] **Language:** EN pages set `lang="en"`; country names come from `countryName(code, locale)`.

---

## Questions for the business council

1. **Full campaigns** (`places_left = 0` while still `published`/`in_progress`): keep them on the
   board (design ready: « Complet » pill, no meter, ranked as D4 says) or exclude them in the RPC?
   Design recommends excluding, but it changes what « ouvertes » means for brands.
2. **Alert channel:** in-app notification only, or also email / WhatsApp? In-app alone requires the
   creator to come back on their own; the copy says « nous vous prévenons » and must stay true.
3. **Referral rewards:** will referrers ever be rewarded? Until decided, the UI only says shares are
   « attribués » and shows no leaderboard to creators.
4. **Attribution window:** `ref` travels in URLs only (lost if the visitor wanders off and returns
   later). Do we want a first-party cookie (window? first or last touch?) — a policy and consent question.
5. **Alert cap:** 5 alerts per creator proposed to keep notifications meaningful. Confirm the number.
6. **« Inscription gratuite » / « gratuitement »:** confirm creator sign-up stays free with no time
   limit (used in the guest CTA, wall and alert hint).
