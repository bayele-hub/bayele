# Admin member review and creator experience — UI/UX discovery and design spec

| | |
|---|---|
| **Seat** | Principal UX Architect · Head of Growth + Mobile UX (UI/UX role) |
| **Brief** | `$S/briefs/CONTEXT-ADMIN-REVIEW.md` — owner requests 1–3 (request 4, the partner flow audit, belongs to another seat) |
| **Binding** | CONTEXT.md (C1–C6, standing product rules), CONTEXT-MANAGED.md (K, R, E decisions), `docs/SKILL.md` §6, epic-design Mode 2 (CSS-only motion) |
| **Evidence** | Playwright screenshots in `$S/qa/` (temporary seeded route, deleted after capture; no code left in the repo) |
| **Date** | 2026-10-14 |
| **Status** | Discovery spec — waiting for the Co-CTO's « Decisions » section; questions at the end of each part |

**Bottom line.** The overflow on `/admin/users` is a two-line CSS bug (the city sits in a `shrink-0`
box that refuses to wrap), but it shows a bigger gap: admins approve people from a single line of
text, and the creator forms let anyone type anything anywhere. The design answers both sides of the
same problem: **a robust member card that always opens a full member page before any decision**, and
**creator forms that explain each field where it is typed** (reusing `SectionTip`), with light
validation so a bio can no longer land in the city field. No new tokens, no new libraries, no invented
figures.

**Typography note.** French strings contain the real U+00A0 (before `:` and inside « ») and U+202F
(before `?` `!` `;` `%`). Copy them as-is into `messages/fr.json`.

---

## §A — Admin member review

### A.1 Audit of `/admin/users` and `/admin/moderation`

Reproduced with seeded data (the real @leopoldine city string, 167 characters):

| Width | Page `scrollWidth` | Overflow of the bad card | Screenshot |
|---|---|---|---|
| 360 px | **1033 px** (horizontal scroll) | 513 px | `qa/admin-users-current-360.png` |
| 768 px | **1033 px** | 282 px | `qa/admin-users-current-768.png` |
| 1280 px | 1280 px | 26 px (clipped, buttons pushed) | `qa/admin-users-current-1280.png` |

| # | Finding | Where | Impact |
|---|---|---|---|
| 1 | **Root cause of the overflow:** the city line is `<span class="inline-flex shrink-0 …">` inside a `flex` row; `shrink-0` + no wrapping lets a 167-char city set the width of the whole page. The same markup is copied in `moderation-queue.tsx`. | `users-table.tsx` L~140, `moderation-queue.tsx` L~50 | High — breaks the page on phones, where admins work |
| 2 | **No way to see a member before deciding.** The card shows name, handle, city, country code; « Approuver » / « Rejeter » act immediately. Bio, socials, audience, payout, company data are never shown to the admin. | both pages | High — owner request 1 |
| 3 | « Rejeter » has **no reason and no confirmation**; the member gets « Contactez le support pour en savoir plus » (trigger in migration 0011). One mis-tap rejects a real creator. | `moderate_profile` + trigger | High |
| 4 | Two pages with two copies of the same card (`/admin/moderation` = pending list, `/admin/users` = all). They drift (the moderation card prints the raw role: « CREATOR » in English uppercase). | `moderation-queue.tsx` | Medium |
| 5 | Search covers name and handle only; **no country filter**, no « Rejetés » status chip; filters are client-side over the first 2 000 profiles, and live in component state (lost on reload, not shareable). | `users-table.tsx`, `users/page.tsx` | Medium |
| 6 | Count line « 92 membres » has no breakdown (how many waiting?) and no sort control; pending members are mixed with everyone, newest first, so the oldest pending request is at the bottom. | `users-table.tsx` | Medium |
| 7 | « En attente » pill is `bg-accent-soft text-accent` — orange on light orange, **2.2:1**, fails WCAG AA. Same pattern on creator pages (§B). | `STATUS_CLASS` | Medium (accessibility) |
| 8 | Country shown as a code (« CM »); no flag for « Kayes · CM » (Kayes is in Mali) or « Aboubacar » (a first name) — nothing warns the admin. | card | Medium |
| 9 | Button row: `flex-wrap` on the header makes buttons jump below or beside the text depending on name length — the layout is not stable from card to card. | card | Medium |
| 10 | Empty state uses an emoji (« 🎉 ») and the subtitle cites « spec §3.1 » (internal jargon). | moderation page | Low |

### A.2 Member card (one component for both lists)

`components/admin/member-card.tsx` — used by `/admin/users` (all statuses). `/admin/moderation`
becomes a redirect to `/admin/users?status=pending_review` (one card, one list, no drift; the nav tab
« Profils » keeps its place and points to the filtered URL).

Prototype of this spec, same seeded data: `qa/admin-users-proposed-360.png`, `qa/admin-users-proposed-1280.png`
— `scrollWidth` = viewport at 360 and 1280.

```
┌──────────────────────────────────────────────┐
│ (LÉ)  Léopoldine Mbarga              il y a 2 j │  avatar 40 · name (link, truncate) · age (nowrap)
│       @leopoldine                              │  handle (truncate)
│ [CRÉATEUR] [En attente] [⚠ Ville à vérifier]   │  chips (wrap allowed, only chips wrap)
│ ⌖ DoualaCréatrice de contenus lifestyle et…    │  city · country NAME (line-clamp-1)
│ ────────────────────────────────────────────── │
│ Voir le profil ›                               │  full row < sm
│ [ ✕ Rejeter ]            [ ✓ Approuver ]       │  2 equal columns < sm
└──────────────────────────────────────────────┘
```

| Part | Classes / rule |
|---|---|
| Root | `<li class="min-w-0">` → `<article class="min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card">`. Grid parent `grid gap-3 lg:grid-cols-2` (two columns from 1024 px). |
| Header row | `flex min-w-0 items-start gap-3`: avatar `SmartAvatar h-10 w-10 shrink-0`; text block `min-w-0 flex-1`; age `shrink-0 whitespace-nowrap text-[11px] text-muted` (« il y a 2 j », `<time dateTime>`). |
| Name | `<Link href="/admin/users/{id}" class="block truncate font-bold text-ink hover:underline">` — the name **is** the link to the detail page. |
| Handle | `truncate text-xs text-muted` « @handle ». |
| Chips row | `mt-2 flex flex-wrap items-center gap-1.5`: role chip (`bg-brand-50 text-brand-700`, label from the dictionary, never the raw enum), status chip (§A.5 colours), up to 2 data-quality chips (§A.4.4) then « +N ». |
| Location | `mt-2 flex min-w-0 items-start gap-1 text-xs text-muted` → `MapPin h-3 w-3 shrink-0 mt-0.5` + `<span class="line-clamp-1 [overflow-wrap:anywhere]">{city} · {countryName}</span>`. **Never `shrink-0` / `whitespace-nowrap` on user text.** |
| Bio (optional, `lg` only) | `mt-1 line-clamp-2 text-xs text-ink/80 [overflow-wrap:anywhere]` — gives desktop admins context without opening the page; hidden on phones to keep cards short. |
| Action row | `mt-3 grid grid-cols-2 items-center gap-2 border-t border-line pt-3 sm:grid-cols-[1fr_auto_auto]`. « Voir le profil › » `col-span-2 sm:col-span-1 inline-flex min-h-tap items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-700`. Decision buttons `inline-flex min-h-tap items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-bold` (secondary `border border-line text-ink`, primary `bg-brand text-white`). The row has the same shape on every card, whatever the text length. |
| Buttons by status | `pending_review`: Rejeter · Approuver. `active`: Suspendre (secondary) only. `suspended` / `rejected`: Réactiver (primary). |
| Reject from the card | Opens the **same reject panel as the detail page** (§A.4.6) inline under the card (reason required). No one-tap reject. |
| Approve from the card | One tap (it is reversible by suspension). If the card carries a data-quality chip, the button label stays « Approuver » but a confirm line appears first: « Ce profil a des points à vérifier. Approuver quand même ? » [Approuver] [Voir le profil]. |
| Errors | `role="alert" mt-2 text-xs text-rose-700`. Success: the card leaves the pending filter with `role="status"` « {Nom} approuvé » announced. |

Overflow guarantees (apply to every admin card): `min-w-0` on every flex child that holds user text,
`truncate` for single-line identity, `line-clamp-N` + `[overflow-wrap:anywhere]` for free text, no
`shrink-0` on text, long handles truncate. QA: no horizontal scroll at 360, 390, 768, 1024, 1280 px
with the seed set in §A.7.

### A.3 List — filters, search, count

All filters are **URL parameters read on the server** (shareable, survive reload, work without JS):
`/admin/users?status=pending_review&role=creator&country=CM&q=leo&flag=1&page=2`.

| Control | Spec |
|---|---|
| Search | GET form, `name="q"`, placeholder « Nom, @identifiant, ville ou téléphone »; matches display_name, handle, city, phone digits, company_name (brands). `type="search"`, 16 px on phones, submit on Enter + a visible « Rechercher » button (`sr-only` on ≥ sm with the icon). |
| Statut | Chip rail: « À valider » (`pending_review`, **first and default when there are pending members**) · « Actifs » · « Suspendus » · « Rejetés » · « Tous ». Each chip shows its count (`tabular-nums text-muted`). |
| Rôle | `<select>` « Tous les rôles · Créateurs · Marques · Partenaires · Admins ». |
| Pays | `<select>` « Tous les pays » + the 6 countries by name. |
| À vérifier | Toggle chip « ⚠ À vérifier » (`flag=1`) — members with at least one data-quality warning (§A.4.4). |
| Sort | Pending: oldest first (first come, first served). Other statuses: newest first. No sort control in v1. |
| Count line | `text-xs text-muted`, always above the list: « **{n} membres** · {p} à valider · {f} à vérifier » + active filters in words (« Créateurs · Cameroun »), and a « Effacer les filtres » link when any filter is set. Plurals with One/Many keys. |
| Pagination | 50 per page, server-side (`range`). « Précédent / Suivant » links + « 51–100 sur 312 ». Replaces the 2 000-row client filter. |
| Empty | Filtered: « Aucun membre ne correspond à ces filtres. » + « Effacer les filtres ». Pending empty: « Aucun profil à valider pour le moment. » (no emoji). |

Mobile layout: search full width; status rail horizontal scroll (`no-scrollbar -mx-4 px-4`, the only
horizontal scroller, inside its own box); rôle + pays selects side by side (`grid grid-cols-2 gap-2`);
« À vérifier » chip at the end of the status rail.

### A.4 Member detail page — `/admin/users/[id]`

Available for **any role and any status** (before and after approval). Admin-only (layout gate +
SECURITY DEFINER RPC with `private.is_admin`).

#### A.4.1 Layout

```
← Membres
HEADER   (avatar 56) Display name                                [Créateur] [En attente]
         @handle · inscrit le 12 oct. 2026 · via « Page d'une campagne »
WARNINGS banner (if any)  ⚠ 2 points à vérifier : Ville ressemble à une bio · Aucun réseau renseigné
SECTIONS (cards, one column on phones, two columns ≥ lg: main 2/3 + side 1/3)
  main: Identité · Localisation · [role sections] · Activité
  side: Contact · Paiement · Attribution · Journal de modération
DECISION BAR (sticky bottom)  [ Rejeter ] [ Approuver ]     (or Suspendre / Réactiver)
```

- Back link « ← Membres » returns to the list **with its filters** (the list passes
  `?from=<encoded query>`; validated same-origin like `next`).
- Header: `flex min-w-0 items-start gap-3`, name `font-display text-xl font-extrabold truncate`,
  chips wrap below on phones.
- Section card: `min-w-0 rounded-2xl border border-line bg-white p-4 shadow-card`; title
  `text-sm font-bold text-ink` + `SectionTip` (§A.5.2); content is a `<dl class="grid gap-3 sm:grid-cols-2">`
  of label (`text-[11px] font-semibold uppercase tracking-wide text-muted`) / value
  (`text-sm text-ink [overflow-wrap:anywhere]`). Missing value → « Non renseigné » in `text-muted`
  (never an empty gap, never « null »).
- Long free text (bio, billing address): shown in full here (it is the detail page), `whitespace-pre-line`,
  with « Voir moins / Voir plus » only if > 8 lines (`line-clamp-8` + toggle).

#### A.4.2 Sections common to every role

| Section | Fields (source) |
|---|---|
| **Identité** | Avatar (large, opens the image in a new tab), display name, handle (link to the public profile `/creators/{handle}` or `/partners/{handle}` **only when active**; otherwise plain text « Profil public non visible tant qu'il n'est pas validé »), role(s) — all roles if several, bio (full). |
| **Localisation** | City, country name. Data-quality warnings shown inline next to the field they concern. |
| **Contact** | Account email (auth, via RPC), phone (`profiles.phone_e164`), with « Copier » and `tel:` / `wa.me` links. |
| **Activité** | Signed up on, last sign-in (auth), profile last updated, status history (from the moderation log, §A.4.6). |
| **Attribution** | `signup_source` in words (« Page Campagnes », « Page d'une campagne », « Lien de parrainage », « Accueil », « Direct », « Non suivi »), referrer (`referred_by` → @handle link to that member's detail page). |
| **Journal de modération** | Date · admin · action · reason · message sent (needs the log table, §A.6). Empty: « Aucune décision pour l'instant. » |

#### A.4.3 Sections by role

| Role | Section | Fields |
|---|---|---|
| **Créateur** | Réseaux et audience | One row per platform from `creator_profiles.platforms`: icon tile + link (opens in new tab, `rel="noopener noreferrer"`, URL shown truncated) + followers (`tabular-nums`). Then « Audience déclarée » (`audience_size`) and « Somme des réseaux » (computed), side by side — the admin sees both, the UI does not judge the gap. |
| | Catégories | Chips from `categories`. |
| | Statut Bayele | Pro (and expiry), founder number, rating (`rating_avg`) — with « Note par défaut, aucun avis » when no review exists. |
| | Paiement | Mobile Money number **masked** (« +237 6•• ••• •42 ») + provider; « Afficher » button (§A.4.5). Missing: « Aucun numéro : ce créateur ne peut pas être payé. » |
| | Activité créateur | Applications (count), approved, content submitted, paid missions, total received (net, FCFA) — each links to a filtered admin view when one exists; zero shows « 0 », never hidden here (admin context). |
| | Partenaire | Active representation (partner @handle, commission), pending offers count. |
| **Marque** | Entreprise | Company name, industry, website (link), `is_verified`. |
| | Facturation | Billing email, billing address, tax ID (NIU / RCCM) — **masked** like payout (PII, owner + admin only, migration 0002) with « Afficher ». |
| | Activité marque | Campaigns created, funded, total funded (FCFA), open now; managed briefs linked (if any). |
| **Partenaire** | Profil partenaire | Specialties (chips — free text today, see §A.8 Q3), years of experience, agency access. |
| | Paiement des commissions | Masked Mobile Money + provider, « Afficher ». |
| | Activité partenaire | Creators represented (active / ended), applications made for creators, commissions paid (FCFA), retainers. |
| | Note publique | `rating_avg` + « Note par défaut, aucun avis » when nothing backs it (the directory shows 6 partners at 5.0). |

#### A.4.4 Data-quality warnings (deterministic rules only)

Shown as chips on the card and as a banner + inline notes on the detail page
(`rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800`, `TriangleAlert`). They
**inform**; they never block approval. One shared function `memberWarnings(member)` in
`lib/member-quality.ts` (+ unit tests) so the card, the page and the « À vérifier » filter agree.

| Key | Rule (exact) | Card chip | Detail text |
|---|---|---|---|
| `cityLooksLikeBio` | city longer than 40 characters, **or** contains a sentence mark (`.` `!` `?` `,` followed by a word), a digit, `@`, `http`, or more than 4 words | « Ville à vérifier » | « La ville ressemble à une phrase ou à une bio. Demandez au membre de la corriger. » |
| `cityIsName` | city equals (case/accent-insensitive) one of the words of the display name | « Ville à vérifier » | « La ville reprend un mot du nom du membre. » |
| `noSocials` (creator) | no platform with a URL | « Aucun réseau » | « Aucun réseau social renseigné : impossible de vérifier l'audience. » |
| `audienceNoSource` (creator) | `audience_size > 0` and the sum of platform followers is 0 | « Audience non justifiée » | « Une audience est déclarée sans aucun réseau chiffré. » |
| `noPayout` (creator, partner) | no Mobile Money number | — (detail only) | « Aucun numéro Mobile Money : pas de paiement possible. » |
| `defaultRating` (creator, partner) | rating shown but no review exists | — (detail only) | « Note par défaut : aucun avis ne la justifie. » |
| `noAvatar` | no avatar | — (detail only) | « Pas de photo de profil. » |
| `businessNoBilling` (brand) | no billing email | — (detail only) | « Pas d'email de facturation. » |

**Not machine-checked in v1:** a city that exists but in another country (« Kayes · CM »). It would
need a curated list of cities per country — see §A.8 Q2. Until then the detail page shows city and
country **side by side in one line** (« Kayes · Cameroun ») so the admin's eye catches it.

#### A.4.5 Masked sensitive data (payout, tax ID, billing address)

- Default: masked in the HTML itself (the server returns the masked form; the full value is **not**
  in the page until revealed). Mask: keep the country code and the last 2 digits
  (« +237 6•• ••• •42 »); tax ID: first 2 + last 2 characters.
- « Afficher » (`Eye` icon, `min-h-tap`, secondary) calls a server action → RPC
  `admin_reveal_member_field(p_id, p_field)` that returns the value **and writes an audit row**
  (who, when, which field). The value then shows with « Masquer » and « Copier ».
- Revealed values re-mask on navigation (no client cache).
- `aria-live="polite"` on the value so a screen reader hears it once revealed.

#### A.4.6 Decision bar and reject reason

Sticky at the bottom of the page (`sticky bottom-0 -mx-4 border-t border-line bg-white/95 px-4 py-2 backdrop-blur`,
inside `<main>` so it sits above the mobile `BottomNav`; same pattern as the brief editor).

| Status | Buttons |
|---|---|
| `pending_review` | « Rejeter » (secondary) · « Demander une correction » (secondary, see Q1) · « Approuver » (primary) |
| `active` | « Suspendre » (secondary, rose on hover) |
| `suspended` / `rejected` | « Réactiver » (primary) |

**Reject / suspend panel** (opens above the bar, in flow, focus moves to the first field; `Esc` closes):
- « Motif » `<select>` **required**: « Informations fausses ou incohérentes » · « Profil incomplet » ·
  « Réseaux introuvables ou inactifs » · « Contenu inapproprié » · « Doublon d'un autre compte » ·
  « Autre ».
- « Message au membre » textarea (optional, 300 chars, counter), prefilled from the reason's template
  (§A.5.1 `admin.members.reasons.*.message`), editable.
- [Confirmer le rejet] (`bg-rose-700 text-white`) · [Annuler].
- The member's notification body becomes the message (instead of « Contactez le support… »), and
  the log stores reason + message.

**Demander une correction** (recommended, Q1): same panel with « Ce qu'il faut corriger » (checkboxes:
Ville · Bio · Photo · Réseaux · Numéro Mobile Money · Autre) + message. Status **stays**
`pending_review`; the member gets an in-app notification (C2) linking to `/profile`, and the card shows
« Correction demandée le {date} ».

**Approve:** one tap; if warnings exist, the inline confirm from §A.2 appears first.

#### A.4.7 Data the UI needs (for Backend)

| Need | Proposal |
|---|---|
| One read for the page | `admin_member_detail(p_id uuid) RETURNS jsonb` (SECURITY DEFINER, `is_admin`): profile, roles, role tables, auth email + last sign-in, attribution, activity counts, **masked** payout/tax/address, review count, moderation log. |
| Reveal | `admin_reveal_member_field(p_id uuid, p_field text) RETURNS text` + audit row. Fields: `payout_phone`, `tax_id`, `billing_address`, `email`, `phone`. |
| Decisions with reason | `moderate_profile_v2(p_target uuid, p_status account_status, p_reason text, p_message text)` (new name, K8) + `profile_moderation_log` table; the notification trigger uses `p_message` when present. |
| Correction request | `admin_request_profile_fix(p_target uuid, p_fields text[], p_message text)` → notification + log row, status unchanged. |
| List | Server-side filters + `count: 'exact'` per status chip (one grouped count query). |
| City guard (from §B) | `profiles.city` length ≤ 60 (CHECK added `NOT VALID` so existing rows don't fail; admins fix them through « Demander une correction »). |

### A.5 Copy — `admin.members.*` (FR / EN)

#### A.5.1 Labels

| Key | FR | EN |
|---|---|---|
| `admin.members.title` | Membres | Members |
| `admin.members.back` | Membres | Members |
| `admin.members.search` | Nom, @identifiant, ville ou téléphone | Name, @handle, city or phone |
| `admin.members.searchSubmit` | Rechercher | Search |
| `admin.members.status.pending_review` | À valider | To review |
| `admin.members.status.active` | Actifs | Active |
| `admin.members.status.suspended` | Suspendus | Suspended |
| `admin.members.status.rejected` | Rejetés | Rejected |
| `admin.members.status.all` | Tous | All |
| `admin.members.pill.pending_review` | En attente | Pending |
| `admin.members.pill.active` | Actif | Active |
| `admin.members.pill.suspended` | Suspendu | Suspended |
| `admin.members.pill.rejected` | Rejeté | Rejected |
| `admin.members.role.all` | Tous les rôles | All roles |
| `admin.members.role.creator` | Créateur | Creator |
| `admin.members.role.business` | Marque | Brand |
| `admin.members.role.consultant` | Partenaire | Partner |
| `admin.members.role.super_admin` | Admin | Admin |
| `admin.members.country.all` | Tous les pays | All countries |
| `admin.members.flagFilter` | À vérifier | Needs checking |
| `admin.members.countOne` | 1 membre | 1 member |
| `admin.members.countMany` | {n} membres | {n} members |
| `admin.members.countPending` | {n} à valider | {n} to review |
| `admin.members.countFlagged` | {n} à vérifier | {n} to check |
| `admin.members.clearFilters` | Effacer les filtres | Clear filters |
| `admin.members.range` | {from}–{to} sur {total} | {from}–{to} of {total} |
| `admin.members.prev` | Précédent | Previous |
| `admin.members.next` | Suivant | Next |
| `admin.members.emptyFiltered` | Aucun membre ne correspond à ces filtres. | No member matches these filters. |
| `admin.members.emptyPending` | Aucun profil à valider pour le moment. | No profiles to review right now. |
| `admin.members.age` | il y a {n} j | {n} d ago |
| `admin.members.viewProfile` | Voir le profil | View profile |
| `admin.members.approve` | Approuver | Approve |
| `admin.members.reject` | Rejeter | Reject |
| `admin.members.suspend` | Suspendre | Suspend |
| `admin.members.reactivate` | Réactiver | Reactivate |
| `admin.members.requestFix` | Demander une correction | Ask for a correction |
| `admin.members.approveWarn` | Ce profil a des points à vérifier. Approuver quand même ? | This profile has points to check. Approve anyway? |
| `admin.members.approved` | {name} approuvé | {name} approved |
| `admin.members.notSet` | Non renseigné | Not provided |
| `admin.members.joined` | Inscrit le {date} | Joined on {date} |
| `admin.members.via` | via « {source} » | via "{source}" |
| `admin.members.publicHidden` | Profil public non visible tant qu'il n'est pas validé | Public profile hidden until approved |
| `admin.members.section.identity` | Identité | Identity |
| `admin.members.section.location` | Localisation | Location |
| `admin.members.section.contact` | Contact | Contact |
| `admin.members.section.socials` | Réseaux et audience | Socials and audience |
| `admin.members.section.categories` | Catégories | Categories |
| `admin.members.section.standing` | Statut Bayele | Bayele standing |
| `admin.members.section.payout` | Paiement | Payout |
| `admin.members.section.company` | Entreprise | Company |
| `admin.members.section.billing` | Facturation | Billing |
| `admin.members.section.partnerProfile` | Profil partenaire | Partner profile |
| `admin.members.section.partner` | Partenaire | Partner |
| `admin.members.section.activity` | Activité | Activity |
| `admin.members.section.attribution` | Attribution | Attribution |
| `admin.members.section.log` | Journal de modération | Moderation log |
| `admin.members.audienceDeclared` | Audience déclarée | Declared audience |
| `admin.members.audienceSum` | Somme des réseaux | Sum of platforms |
| `admin.members.defaultRating` | Note par défaut, aucun avis | Default rating, no reviews |
| `admin.members.reveal` | Afficher | Show |
| `admin.members.hide` | Masquer | Hide |
| `admin.members.copy` | Copier | Copy |
| `admin.members.noPayout` | Aucun numéro : ce membre ne peut pas être payé. | No number: this member can't be paid. |
| `admin.members.logEmpty` | Aucune décision pour l'instant. | No decisions yet. |
| `admin.members.warningsTitleOne` | 1 point à vérifier | 1 point to check |
| `admin.members.warningsTitleMany` | {n} points à vérifier | {n} points to check |
| `admin.members.warn.cityLooksLikeBio` | La ville ressemble à une phrase ou à une bio. Demandez au membre de la corriger. | The city looks like a sentence or a bio. Ask the member to fix it. |
| `admin.members.warn.cityIsName` | La ville reprend un mot du nom du membre. | The city repeats a word from the member's name. |
| `admin.members.warn.noSocials` | Aucun réseau social renseigné : impossible de vérifier l'audience. | No social account provided: the audience can't be checked. |
| `admin.members.warn.audienceNoSource` | Une audience est déclarée sans aucun réseau chiffré. | An audience is declared with no platform figures. |
| `admin.members.warn.noPayout` | Aucun numéro Mobile Money : pas de paiement possible. | No Mobile Money number: no payment possible. |
| `admin.members.warn.defaultRating` | Note par défaut : aucun avis ne la justifie. | Default rating: no review backs it. |
| `admin.members.warn.noAvatar` | Pas de photo de profil. | No profile photo. |
| `admin.members.warn.businessNoBilling` | Pas d'email de facturation. | No billing email. |
| `admin.members.chip.city` | Ville à vérifier | Check city |
| `admin.members.chip.noSocials` | Aucun réseau | No socials |
| `admin.members.chip.audience` | Audience non justifiée | Audience not backed |
| `admin.members.reasonLabel` | Motif | Reason |
| `admin.members.messageLabel` | Message au membre | Message to the member |
| `admin.members.fixLabel` | Ce qu'il faut corriger | What needs fixing |
| `admin.members.fixFields` | ["Ville", "Bio", "Photo", "Réseaux", "Numéro Mobile Money", "Autre"] | ["City", "Bio", "Photo", "Socials", "Mobile Money number", "Other"] |
| `admin.members.fixRequested` | Correction demandée le {date} | Correction requested on {date} |
| `admin.members.confirmReject` | Confirmer le rejet | Confirm rejection |
| `admin.members.confirmSuspend` | Confirmer la suspension | Confirm suspension |
| `admin.members.sendFix` | Envoyer la demande | Send the request |
| `admin.members.cancel` | Annuler | Cancel |
| `admin.members.reasons.false.label` | Informations fausses ou incohérentes | False or inconsistent information |
| `admin.members.reasons.false.message` | Certaines informations de votre profil sont incohérentes. Corrigez-les dans votre profil puis écrivez-nous. | Some details on your profile don't add up. Fix them in your profile, then write to us. |
| `admin.members.reasons.incomplete.label` | Profil incomplet | Incomplete profile |
| `admin.members.reasons.incomplete.message` | Votre profil est incomplet. Ajoutez vos réseaux, votre ville et une courte bio, puis écrivez-nous. | Your profile is incomplete. Add your socials, your city and a short bio, then write to us. |
| `admin.members.reasons.socials.label` | Réseaux introuvables ou inactifs | Socials not found or inactive |
| `admin.members.reasons.socials.message` | Nous n'avons pas pu vérifier vos réseaux. Vérifiez les liens dans votre profil puis écrivez-nous. | We couldn't check your social accounts. Check the links in your profile, then write to us. |
| `admin.members.reasons.content.label` | Contenu inapproprié | Inappropriate content |
| `admin.members.reasons.content.message` | Votre profil ne respecte pas nos conditions d'utilisation. | Your profile doesn't meet our terms of use. |
| `admin.members.reasons.duplicate.label` | Doublon d'un autre compte | Duplicate of another account |
| `admin.members.reasons.duplicate.message` | Vous avez déjà un compte Bayele. Connectez-vous avec celui-ci. | You already have a Bayele account. Please sign in with it. |
| `admin.members.reasons.other.label` | Autre | Other |
| `admin.members.reasons.other.message` | Votre profil n'a pas été validé. Écrivez-nous pour en savoir plus. | Your profile wasn't approved. Write to us to find out more. |
| `admin.members.source.campaigns_list` | Page Campagnes | Campaigns page |
| `admin.members.source.campaign_page` | Page d'une campagne | Campaign page |
| `admin.members.source.referral` | Lien de parrainage | Referral link |
| `admin.members.source.home` | Accueil | Home |
| `admin.members.source.direct` | Direct | Direct |
| `admin.members.source.none` | Non suivi | Not tracked |

#### A.5.2 Section tooltips (admin detail page, `SectionTip`, ≤ 200 characters)

`ariaTemplate` = `admin.briefs.tips.aria` (already « Aide : {section} »). Keys `admin.members.tips.*`:

| Key | FR | EN |
|---|---|---|
| `admin.members.tips.identity` | Ce que le membre a déclaré. Avant validation, rien n'est public. Vérifiez que le nom, la photo et la bio décrivent une vraie personne ou une vraie entreprise. | What the member declared. Before approval, nothing is public. Check that the name, photo and bio describe a real person or business. |
| `admin.members.tips.location` | Ville et pays servent aux filtres et aux campagnes locales. La ville doit être un nom de ville, pas une phrase. Les points douteux sont signalés, sans bloquer. | City and country drive filters and local campaigns. The city must be a city name, not a sentence. Doubtful points are flagged, never blocked. |
| `admin.members.tips.socials` | Les liens permettent de vérifier l'audience déclarée. Ouvrez au moins un lien avant de valider un créateur. | The links let you check the declared audience. Open at least one link before approving a creator. |
| `admin.members.tips.payout` | Numéro privé, masqué par défaut. L'afficher est enregistré dans le journal. Sans numéro, le membre ne peut pas être payé. | A private number, masked by default. Showing it is logged. Without a number, the member can't be paid. |
| `admin.members.tips.billing` | Données de facturation privées (marque et admin seulement). Masquées par défaut ; chaque affichage est enregistré. | Private billing data (brand and admin only). Masked by default; each reveal is logged. |
| `admin.members.tips.activity` | Ce que le membre a fait sur Bayele, compté depuis la base. Aucune estimation. | What the member has done on Bayele, counted from the database. No estimates. |
| `admin.members.tips.attribution` | Par où le membre est arrivé et qui l'a invité. Le parrainage est compté, sans contrepartie. | How the member arrived and who invited them. Referrals are counted, with nothing in return. |
| `admin.members.tips.decision` | Valider rend le profil public. Rejeter ou suspendre demande un motif, envoyé au membre dans l'application. Chaque décision est enregistrée. | Approving makes the profile public. Rejecting or suspending needs a reason, sent to the member in the app. Every decision is logged. |

(The attribution tip follows C3: referrals are counted, with no reward wording — the dictionary test bans it.)

### A.6 Status chip colours (contrast-safe, all admin and creator pages)

| Status | Classes | Contrast |
|---|---|---|
| En attente | `bg-accent-soft text-ink` (+ `Clock` icon `text-accent` decorative) | 15:1 |
| Actif | `bg-emerald-50 text-emerald-700` | 5.6:1 |
| Suspendu | `bg-rose-50 text-rose-700` | 6.2:1 |
| Rejeté | `bg-surface text-muted` | 5.2:1 |

**Rule:** `text-accent` is never used for text on white or `bg-accent-soft`. Replace it in
`users-table.tsx`, `wallet/page.tsx`, `creator/dashboard/page.tsx`, `creator/campaigns/page.tsx`.

### A.7 Acceptance (QA)

- [ ] Seed set: a 167-char city, a 60-char display name, a 30-char handle, a city equal to a first name, a member with no socials, a brand with no billing email.
- [ ] No horizontal scroll at 360 / 390 / 768 / 1024 / 1280 px on `/admin/users` and `/admin/users/[id]` (`document.documentElement.scrollWidth === clientWidth`).
- [ ] Action rows have the same height and order on every card; buttons never wrap under text.
- [ ] Every card opens `/admin/users/[id]` for every role and status; the page renders all sections with « Non renseigné » for missing data.
- [ ] Payout / tax ID / billing address are absent from the HTML until « Afficher »; each reveal writes an audit row.
- [ ] Reject and suspend cannot be sent without a reason; the member receives the message in the app.
- [ ] Filters live in the URL and survive reload; counts per status are correct.
- [ ] `/admin/moderation` redirects to `/admin/users?status=pending_review`.

### A.8 Questions (council / Co-CTO)

1. **« Demander une correction »** keeps the member pending and asks for fixes (city, bio, socials…). It turns many rejections into fixes. Adopt it (new RPC + notification type)?
2. **City vs country check** (« Kayes · CM »): add a curated list of main cities per country (suggestions in the form, warning for admins), or keep free text + the visual check only?
3. **Partner specialties** are free text (« Vue whatsapp », « Balafon »). A fixed list like categories would clean the directory — a Partner-flow seat decision.
4. **Default rating 5.00** (`rating_avg DEFAULT 5.00`) shows on profiles with no reviews. Hide the rating until a first review exists? (Affects the public directory: council.)
5. Who may **reveal** payout numbers — every admin, or a finance role only? The audit row is designed either way.

---

## §B — Creator experience

### B.1 Journey walked (code + seeded render)

Sign-up (`/auth?mode=signup&role=creator`) → onboarding form (`/onboarding/creator`,
`qa/creator-onboarding-current-360.png`) → status screen (`/onboarding/done`, pending) → Campagnes
(pending creators may browse and apply) → after approval: Accueil (`/creator/dashboard`), apply,
submit proof, Portefeuille (`/creator/wallet`), Mon partenaire (`/creator/partner`), Profil
(`/profile`).

### B.2 Friction points, ranked by impact

Impact = (how many creators hit it) × (how badly it blocks being paid or trusted).

| Rank | Friction | Where | Why it matters | Fix (spec) |
|---|---|---|---|---|
| 1 | **A pending creator who applies loses sight of the application.** Applied campaigns disappear from `/creator/campaigns`, and Accueil (where missions live) is disabled until approval. | `creator/campaigns/page.tsx` filters `appliedTo`; `creator-gate` | The first action we invite them to take leaves no trace — they re-apply elsewhere or give up. | Add « Mes candidatures » at the top of `/creator/campaigns` for every creator: one compact row per application (title, net pay, status pill, date). Pending creators see « Votre candidature sera examinée après la validation de votre profil. » |
| 2 | **City and bio are unguided free text** — a bio landed in the city field, a first name too. | onboarding + `/profile` | Bad data on cards, filters and campaigns by city; admins can't trust the profile. | City: `maxLength={60}`, `autoComplete="address-level2"`, helper + tooltip (§B.3), server check (≤ 60 chars, no digit, no `@`/`http`, ≤ 4 words) with message `creatorForm.errors.city`. Bio: counter « 0/280 », tooltip. |
| 3 | **Mobile Money number is buried** in « Profil créateur » between categories and audience; the nudges link to the top of `/profile`. | `/profile`, dashboard + wallet nudges | No number = no payment. It is the most important field for a creator. | New first card on `/profile` for creators: « Paiement » (`id="paiement"`), number + operator; operators filtered by the profile's country (`PROVIDERS` by country); all nudges link to `/profile#paiement`. Tooltip (§B.3). |
| 4 | **Proof of a WhatsApp status has no link.** The proof form only accepts a URL; WhatsApp — the first platform in our list — has no public post URL. | `proof-form.tsx` | Creators doing the most common deliverable can't submit proof. | Product decision needed (Q1): screenshot upload for statuses. Until then, the field helper says what to paste per platform and the tooltip tells WhatsApp creators to contact the brand in the mission chat. |
| 5 | **Dead-end status screen.** Pending creators land on « Profil envoyé pour validation » with only « Retour à l'accueil » (unless they came from a campaign) — yet they *can* browse and apply. | `onboarding/done/page.tsx` | We lose the most motivated moment. | Pending screen buttons: primary « Voir les campagnes » → `/creator/campaigns`, secondary « Compléter mon profil » → `/profile`, then « Retour à l'accueil ». |
| 6 | **Invented time and frequency claims:** « en général sous 24–48h » (pending screen), « les marques publient régulièrement » (campaigns empty state). | `onboarding/done`, `creator/campaigns` | Standing rule: no figure or frequency not backed by data. | Replace with copy in §B.4 (no duration; in-app notification per C2). |
| 7 | **Developer jargon shown to creators:** « Statut à la création : `pending_review` — validé par un admin » (onboarding header); « Prêt à décaisser » (wallet — the creator can't trigger a payout). | onboarding, wallet | Confuses and looks unfinished. | §B.4 replacements. |
| 8 | **Disabled tabs explain themselves only with `title`** (« Disponible après la validation… »), which never shows on touch. | `creator-nav.tsx` | On phones the tabs look broken. | Disabled tab becomes a `<button>` that opens a `SectionTip`-style bubble with `creatorTips.lockedTab`; keep `aria-disabled="true"`. |
| 9 | **Categories: chips at sign-up, comma-separated free text in Profil.** | onboarding vs `/profile` | Typos create categories that match no campaign or alert. | Same chip picker in `/profile` (shared component), values from `CAMPAIGN_CATEGORIES`. |
| 10 | **Audience asked twice** (« Audience cumulée » + followers per network), with a placeholder « 45000 » that reads like a suggestion. | onboarding, profile | Inconsistent numbers; an illustrative figure without an « Exemple » tag. | Followers per network only; « Audience totale » is computed and shown read-only (« Somme de vos réseaux : … »). No numeric placeholder. |
| 11 | **Followers inputs clipped at 360 px** (`w-20`; « abo… »). | onboarding social rows | Creators can't read what the field is. | Social row = two lines on < sm: link full width, then « Abonnés » input `w-full` with a visible label; one line from `sm`. |
| 12 | **Low-contrast notices** (`text-accent` on `bg-accent-soft`, 2.2:1) on mission status pills, « Non configuré », proof-pending notes. | dashboard, wallet, campaigns | Hard to read in sunlight on low-end phones. | §A.6 rule. |
| 13 | **Creator campaign list ignores full campaigns and managed listings:** no « Complet » (C1), no places left, no « Géré par Bayele » badge, apply always enabled. | `creator/campaigns/page.tsx` | Apply errors and lost trust; inconsistent with the public board. | Reuse `CampaignCard` data (places, pill, `BrandLine`); « Complet » disables Apply (C1). |
| 14 | « Contacter la marque » on managed campaigns opens a chat with Bayele (owner = admin). | dashboard mission row | Small confusion. | Label « Contacter Bayele » when `is_managed`. |
| 15 | Creator workspace is French-only (EN visitors switch language and lose it after sign-up). | `(app)` area | Nigeria, Kenya, South Africa creators. | Out of this brief's scope; listed for the roadmap. |

### B.3 Tooltips — `creatorTips.*` (reuse `SectionTip`, ≤ 200 characters)

Placement: `SectionTip` at the end of the **field label** (or card title), `id="creator-{key}"`,
`ariaTemplate` = `creatorTips.aria`. Same interaction and tokens as §13.1 of
`MANAGED-CAMPAIGNS-DESIGN.md`. A tip never replaces a visible helper for required rules: the
city's « Ville uniquement » helper stays visible under the field; the tip adds the why.

| Key | Where | FR | EN |
|---|---|---|---|
| `creatorTips.aria` | — | Aide : {section} | Help: {section} |
| `creatorTips.city` | « Ville » (onboarding, profile) | Écrivez seulement le nom de votre ville, par exemple Douala. Votre présentation va dans la bio. Les marques cherchent des créateurs par ville. | Write only your city's name, for example Douala. Your introduction goes in the bio. Brands look for creators by city. |
| `creatorTips.bio` | « Bio » | Une ou deux phrases : ce que vous publiez et pour qui. Elle s'affiche sur votre profil public après validation. 280 caractères au plus. | One or two sentences: what you post and for whom. It shows on your public profile once approved. 280 characters at most. |
| `creatorTips.handle` | « Identifiant » | Votre adresse publique : bayele.com/creators/identifiant. Lettres, chiffres et « _ » seulement. Choisissez-le simple à partager. | Your public address: bayele.com/creators/handle. Letters, numbers and "_" only. Pick one that's easy to share. |
| `creatorTips.categories` | « Catégories » | Choisissez les thèmes que vous publiez vraiment. Ils servent à vous proposer les bonnes campagnes et alertes. | Pick the topics you really post about. They are used to show you the right campaigns and alerts. |
| `creatorTips.socials` | « Réseaux sociaux » | Ajoutez le lien de chaque compte et son nombre d'abonnés. Bayele les vérifie avant de valider votre profil. Un lien qui marche vaut mieux qu'un gros chiffre. | Add the link to each account and its follower count. Bayele checks them before approving your profile. A working link beats a big number. |
| `creatorTips.audience` | « Audience totale » (read-only) | La somme des abonnés de vos réseaux. Elle se met à jour quand vous modifiez vos réseaux. | The sum of your followers across platforms. It updates when you edit your accounts. |
| `creatorTips.payout` | « Numéro Mobile Money » | Le numéro qui reçoit vos paiements, avec l'indicatif du pays. Il reste privé. Sans numéro, Bayele ne peut pas vous payer. | The number that receives your payments, with the country code. It stays private. Without a number, Bayele can't pay you. |
| `creatorTips.provider` | « Opérateur » | L'opérateur de ce numéro (MTN, Orange, Wave…). S'il ne correspond pas, le paiement peut échouer. | The operator for this number (MTN, Orange, Wave…). If it doesn't match, the payment may fail. |
| `creatorTips.pending` | « En attente » pill / pending screen title | Bayele vérifie votre profil. Vous pouvez déjà voir les campagnes et postuler. Vous serez prévenu dans l'application dès la décision. | Bayele is checking your profile. You can already browse campaigns and apply. You'll be notified in the app as soon as it's decided. |
| `creatorTips.lockedTab` | disabled tabs (Accueil, Portefeuille, Mon partenaire) | Disponible après la validation de votre profil. En attendant, vous pouvez voir les campagnes et compléter votre profil. | Available once your profile is approved. Meanwhile, you can browse campaigns and complete your profile. |
| `creatorTips.applications` | « Mes candidatures » | Les campagnes auxquelles vous avez postulé. La marque choisit parmi les profils validés ; vous êtes prévenu dans l'application. | Campaigns you applied to. The brand chooses among approved profiles; you're notified in the app. |
| `creatorTips.proof` | « Lien de votre publication » | Collez le lien de la publication elle-même (pas de votre profil). Pour un statut WhatsApp, écrivez à la marque dans la discussion de la mission. | Paste the link to the post itself (not your profile). For a WhatsApp status, write to the brand in the mission chat. |
| `creatorTips.walletInProgress` | « En cours » (wallet) | Missions acceptées dont le budget est bloqué sous séquestre. Il vous est versé après la validation de votre preuve. | Accepted missions whose budget is locked in escrow. It's paid to you once your proof is approved. |
| `creatorTips.walletApproved` | « Validé, paiement en cours » (wallet, was « Prêt à décaisser ») | Votre preuve est validée. Bayele prépare le versement sur votre numéro Mobile Money. | Your proof is approved. Bayele is preparing the payment to your Mobile Money number. |
| `creatorTips.partnerCommission` | commission line (Mon partenaire, mission row) | Votre partenaire touche ce pourcentage sur les missions acceptées pendant la représentation. Le montant affiché « vous recevez » est déjà net. | Your partner takes this percentage on missions accepted during the representation. The "you receive" amount shown is already net. |
| `creatorTips.alerts` | « Mes alertes » | Nous vous prévenons dans l'application quand une campagne correspond. 5 alertes au plus. | We notify you in the app when a campaign matches. 5 alerts at most. |

Lengths: all ≤ 200 characters in both languages (longest 159 characters, measured after French spacing); recheck
in the parity/typography test after French spacing. Words banned by the dictionary test
(« gagne », « récompense », « bonus », "reward", "earn", « cadeau ») are absent.

### B.4 Field guidance and copy replacements (`creatorForm.*`, `creatorUx.*`)

| Key | FR | EN | Replaces |
|---|---|---|---|
| `creatorForm.cityLabel` | Ville | City | — |
| `creatorForm.cityHelp` | Ville uniquement (ex. Douala). | City only (e.g. Douala). | — (new visible helper) |
| `creatorForm.errors.city` | Indiquez seulement le nom de votre ville (60 caractères au plus, sans phrase ni lien). Votre présentation va dans la bio. | Enter only your city's name (60 characters at most, no sentence or link). Your introduction goes in the bio. | — |
| `creatorForm.bioPlaceholder` | Ce que vous publiez et pour qui, en une ou deux phrases. | What you post and for whom, in one or two sentences. | « Présentez votre contenu et votre audience en une phrase. » |
| `creatorForm.bioCounter` | {n}/280 | {n}/280 | — |
| `creatorForm.followers` | Abonnés | Followers | placeholder « abonnés » |
| `creatorForm.audienceTotal` | Audience totale : {n} | Total audience: {n} | « Audience cumulée (abonnés) » input |
| `creatorForm.payoutTitle` | Paiement | Payout | — (new first card on `/profile`) |
| `creatorForm.statusNote` | Votre profil sera vérifié par Bayele avant d'être visible. Vous pouvez déjà voir les campagnes et postuler. | Bayele will check your profile before it goes public. You can already browse campaigns and apply. | « Statut à la création : pending_review — validé par un admin. » |
| `creatorUx.pending.title` | Profil envoyé pour validation | Profile sent for review | (same) |
| `creatorUx.pending.body` | Merci ! Bayele vérifie votre profil. Vous serez prévenu dans l'application dès la décision. En attendant, vous pouvez voir les campagnes et postuler. | Thank you! Bayele is checking your profile. You'll be notified in the app as soon as it's decided. Meanwhile, you can browse campaigns and apply. | « … en général sous 24–48h. » (invented figure) |
| `creatorUx.pending.ctaCampaigns` | Voir les campagnes | See campaigns | — |
| `creatorUx.pending.ctaProfile` | Compléter mon profil | Complete my profile | — |
| `creatorUx.rejected.body` | Votre profil n'a pas été validé. Le motif est dans vos notifications. Vous pouvez corriger votre profil puis nous écrire à support@bayele.com. | Your profile wasn't approved. The reason is in your notifications. You can fix your profile, then write to us at support@bayele.com. | generic rejected body (needs §A.4.6 reasons) |
| `creatorUx.campaignsEmpty` | Aucune nouvelle campagne pour le moment. Activez une alerte : nous vous prévenons dans l'application dès qu'une campagne correspond. | No new campaigns right now. Turn on an alert: we'll notify you in the app as soon as one matches. | « … les marques publient régulièrement. » |
| `creatorUx.applicationsTitle` | Mes candidatures | My applications | — |
| `creatorUx.applicationsPending` | Votre candidature sera examinée après la validation de votre profil. | Your application will be reviewed once your profile is approved. | — |
| `creatorUx.walletApproved` | Validé, paiement en cours | Approved, payment in progress | « Prêt à décaisser » |
| `creatorUx.walletNotSet` | Non renseigné | Not set | « Non configuré » (in `text-accent`) |
| `creatorUx.contactBayele` | Contacter Bayele | Contact Bayele | « Contacter la marque » on managed missions |
| `creatorUx.proofHelp` | Le lien de la publication (Instagram, TikTok, Facebook, YouTube…). | The link to the post (Instagram, TikTok, Facebook, YouTube…). | — |

Visual treatment of the city field (onboarding and profile): label row « Ville » + `SectionTip`;
input `maxLength={60}`; helper `creatorForm.cityHelp` always visible (`text-[11px] text-muted`); on a
server error the input gets `aria-invalid` and the error (`text-[11px] text-rose-700`, `role="alert"`)
replaces the helper. On onboarding the city/country row becomes **one column on < sm**
(`grid gap-3 sm:grid-cols-2`) so the helper has room.

### B.5 Council-rule check

- C2: every "we'll tell you" says « dans l'application » (pending body, alerts, applications).
- C3: no reward wording; the attribution tip says referrals are counted, with nothing in return.
- C6: sign-up copy keeps « inscription gratuite » / « profil gratuit »; nothing here adds « sans limite ».
- No invented figures: the « 24–48h » and « régulièrement » claims are removed; the only numbers in
  the new copy are product limits that exist in code (280-character bio proposed, 60-character city
  proposed, 5 alerts — C5).

### B.6 Questions (council / Co-CTO)

1. **WhatsApp status proof:** allow a screenshot upload (storage + brand review) for status deliverables? Today those creators can't submit proof in-product.
2. **Bio length 280 and city length 60:** confirm the limits (proposed from current UI space, not data).
3. **Show applications to pending creators** (rank 1): confirm it's acceptable to show « en attente de validation de votre profil » on each application.
4. **Operators by country:** confirm the provider list per country (CM/GA: MTN, Orange; CI: Orange, MTN, Wave, Moov; NG: OPay, PalmPay; KE: M-Pesa, Airtel; ZA: bank transfer?) — Finance to validate before the filter ships.

### B.7 Screenshots (in `$S/qa/`)

| File | Shows |
|---|---|
| `admin-users-current-360.png` / `-768.png` / `-1280.png` | Current card with the real 167-char city: page wider than the screen, buttons pushed |
| `admin-moderation-current-360.png` | Current moderation card (raw role « CREATOR », same overflow) |
| `admin-users-proposed-360.png` / `-1280.png` | Prototype of §A.2 with the same data: no overflow, stable action row, warning chip |
| `creator-onboarding-current-360.png` | Onboarding today: `pending_review` jargon, « 45000 » placeholder, clipped followers inputs |
