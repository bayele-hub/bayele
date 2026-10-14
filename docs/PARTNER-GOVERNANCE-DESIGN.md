# Partner governance — UI/UX design specification

| | |
|---|---|
| **Seat** | Principal UX Architect · Head of Growth + Mobile UX (UI/UX role) |
| **Implements** | `$S/briefs/CONTEXT-PARTNER-GOV.md` G1–G12, on the backend contract `$S/briefs/BACKEND-CONTRACT-PARTNER-GOV.md` (migrations 0038–0040) |
| **Still binding** | CONTEXT.md (C1–C6), CONTEXT-MANAGED.md, CONTEXT-ADMIN-REVIEW.md (O5–O8, D1–D11), `docs/SKILL.md` §6, epic-design Mode 2 |
| **Builds on** | `docs/ADMIN-REVIEW-AND-CREATOR-UX-DESIGN.md` (member card, detail page, decision panels), `docs/MANAGED-CAMPAIGNS-DESIGN.md` §13 (`SectionTip`) |
| **Audience** | Frontend (build without questions), QA (acceptance), Legal/Ops (copy review) |
| **Date** | 2026-10-14 |

**Bottom line.** Bayele becomes the only door between brands and partners. Every surface in this
spec says the same thing in the same calm voice: *Bayele introduces you, keeps your exchanges and
your money safe, and the contact details come once there is a contract.* Brands **ask** for a partner
(they no longer message or hire one cold); admins **approve and assign**, and the conversation opens
at once (P3 — no acceptance step; the partner's one-time acknowledgement covers it); threads **mask
contact details** before a funded retainer and say so kindly, while the safety team can read a masked
original for 90 days with a logged reason (P5). WhatsApp creators get a simple screenshot proof path
(low priority, P6), and the city field becomes a picker. No new
tokens, no new libraries, CSS-only motion, nothing invented: every number here is a decision (G1–G10)
or a server limit from the contract.

**Typography note.** French strings contain the real U+00A0 (before `:` and inside « ») and U+202F
(before `?` `!` `;` `%`). Copy them as-is into `messages/fr.json`.

---

## 0. Foundations

### 0.1 Tokens and shared pieces (no new tokens)

| Purpose | Reused |
|---|---|
| Cards | `rounded-2xl border border-line bg-white p-4 shadow-card`; `min-w-0` on every flex child holding user text (§A.2 rules of the admin-review spec) |
| Primary / secondary buttons | `min-h-tap rounded-xl bg-brand px-4 text-sm font-bold text-white` / `border border-line bg-white text-ink` |
| Destructive confirm | `bg-rose-700 text-white` (6.2:1) |
| Status pills | Contrast-safe set: `bg-accent-soft text-ink` (waiting), `bg-emerald-50 text-emerald-700` (active), `bg-rose-50 text-rose-700` (blocked), `bg-surface text-muted` (closed). Never `text-accent` on light backgrounds. |
| Protection notices | `rounded-xl border border-brand-100 bg-brand-50 p-3 text-[12px] text-ink` + `ShieldCheck` (`text-brand-700`) — **blue = protection**, not amber (amber reads as a warning/blame). |
| Tooltips | `SectionTip` (`components/admin/section-tip.tsx`), `ariaTemplate` = « Aide : {section} » |
| Inline decision panels | The pattern from admin review §A.4.6: in-flow region, heading, focus moves to the first field, `Esc` cancels, reason required where the RPC requires it |
| Error mapping | One map per namespace, keyed by the RPC's `error.message` code (lists below). Unknown code → `common.genericError`. |

### 0.2 New routes (from the contract §10)

| Route | Who | Nav |
|---|---|---|
| `/admin/partners` | admin | new admin tab « Partenaires » (`Handshake` icon) after « Utilisateurs » |
| `/admin/partners/[id]` | admin | — |
| `/admin/partners/requests` | admin | sub-tab inside the partner hub |
| `/admin/partners/assignments` | admin | sub-tab inside the partner hub (« Demander la fin » queue) |
| `/admin/partners/flags` | admin | sub-tab inside the partner hub |
| `/business/partners` | brand | new brand tab « Partenaires » (`Handshake`) after « Créateurs »; « Rétainers » stays |
| `/business/partners/request?partner={handle}` | brand | — |
| `/partner/assignments` | partner | new partner tab « Mises en relation » (`Link2`) after « Accueil » |

Hub sub-navigation (admin): a segmented rail at the top of the four hub pages
`Partenaires · Demandes (n) · Fins demandées (n) · Signalements (n)` — counts are the open items
(`pending` contact requests, `open` end requests, `open` flags); a count is hidden when 0.

### 0.3 Consent versions (G7, P3)

`lib/legal.ts` exports `NON_CIRCUMVENTION_VERSION = '2026-10-14'` (matches `^[A-Za-z0-9._-]{1,20}$`).
The same string is sent as `p_consent_version` by `request_partner_contact` (brand, at each request)
and recorded with `record_consent('cgu_non_circumvention', …)` (the one-time acknowledgement, §7).
**There is no consent at assignment time (P3):** the partner's one-time acknowledgement covers every
introduction. Changing the clause = new version string = the acknowledgement modal shows again.

---

## 1. Admin partner hub

### 1.1 `/admin/partners` — the list

Source: `admin_partner_list(p_search, p_status, p_listed, p_specialty, p_limit = 50, p_offset)`,
newest first, `total_count` for pagination. Layout (mobile first): H2 « Partenaires » + count line;
hub rail; filters; cards.

| Control | Spec → RPC parameter |
|---|---|
| Statut d'annuaire (chips, URL `?listing=`) | « Listés » (`p_listed=true`, `p_status='active'`) · « Retirés » (`p_listed=false`) · « Suspendus » (`p_status='suspended'`) · « En attente » (`p_status='pending_review'`) · « Tous ». Default « Tous ». |
| Recherche (`?q=`) | `p_search` (handle and name, accent- and case-insensitive). GET form. |
| Spécialité (`?spec=`) | `p_specialty`, `<select>` of the 14 labels. |
| Count line | « **{n} partenaires** » from `total_count` + the active filters in words + « Effacer les filtres ». |
| Pagination | 50 per page (`p_offset`), « Précédent / Suivant » + « 51–100 sur {total} ». |

No country or « paiements bloqués » filter in v1 (the RPC doesn't take them); the hold and the flags
show as chips on each card instead.

**Partner card** (same anatomy and overflow rules as the member card):

```
┌──────────────────────────────────────────────┐
│ (AB) Agence Balafon                 il y a 3 j │
│      @balafon · Abidjan, Côte d'Ivoire        │
│ [Listé] [Actif] [⏸ Paiements bloqués] [⚑ 2] [Fin demandée] │
│ Gestion de talents · UGC · Photographie       │  specialties (line-clamp-1)
│ 4 créateurs · 2 mises en relation             │  creators_active · assignments_active
│ ───────────────────────────────────────────── │
│ Voir la fiche partenaire ›                    │
└──────────────────────────────────────────────┘
```
- Listing chip: « Listé » `bg-emerald-50 text-emerald-700` / « Retiré de l'annuaire » `bg-surface text-muted`.
- Flag chip only when `open_flags + open_self_dealing > 0`: `bg-rose-50 text-rose-700` « ⚑ {n} » with `sr-only` « signalements ouverts ».
- « Fin demandée » chip (`bg-accent-soft text-ink`) when `open_end_requests > 0`.
- « Paiements bloqués » chip when `payouts_on_hold`.
- The name is the link; « Voir la fiche partenaire » is the visible secondary link.
- Empty: « Aucun partenaire ne correspond à ces filtres. » + « Effacer les filtres ».

### 1.2 `/admin/partners/[id]` — the partner overview

Source: `admin_partner_overview` (read-only, logged as a view). Header + action bar + sections.

**Header.** Avatar 56, name, @handle, chips (listing, status, « Paiements bloqués »), a muted line
« Règle de non-contournement acceptée (version {cgu_version}) » or « Règle de non-contournement pas
encore acceptée » (from `partner.cgu_version`, informative, not blocking), link « Fiche
membre complète › » → `/admin/users/[id]` (identity, contact, payout reveal live there — not duplicated).

**Action bar** (under the header, wraps on phones into a 2-column grid of `min-h-tap` buttons):
`Retirer de l'annuaire` / `Remettre dans l'annuaire` · `Mettre en relation` · `Proposer un rétainer` ·
`Suspendre` / `Réactiver` (reuses `admin_moderate_member`). Every button opens an inline panel (§1.3–1.7).

**Sections** (cards; one column < lg; two columns ≥ lg: left = work, right = governance):

| Section (+ tooltip key) | Content | Row actions |
|---|---|---|
| **Annuaire** `tips.listing` | « Listé depuis {date} » or « Retiré le {date} — Motif : {listing_reason} ». | — |
| **Spécialités déclarées** `tips.specialties` | Chips from codes. If `specialties_legacy`: muted box « Ancien texte non reconnu : {values} » + « Une correction a été demandée » when the D4 request is open. | — |
| **Créateurs représentés** `tips.links` | Rows: @creator, commission « {rate} % », status pill, since {date}. Ended links collapsed under « Voir l'historique ({n}) ». | « Modifier la commission » (§1.6) · « Mettre fin » (§1.5) on open links |
| **Missions** `tips.deals` | Latest 100: campaign title (link), @creator, status, payout FCFA, rate, « Postulé par le partenaire » marker. | — |
| **Commissions** `tips.commissions` | « Dues : {owed} · Versées : {paid} · {count} missions ». If on hold: rose notice « Paiements bloqués : un signalement d'auto-transaction est ouvert. » + link to the flag. | — |
| **Rétainers** | Brand, status, value, accepted on, settlements (kind, amount, status). | — |
| **Mises en relation** `tips.assignments` | Brand (+ campaign scope), origin label (« Proposée par Bayele » / « Demande de la marque » / « Rétainer existant »), status pill (Active / Terminée + end reason), dates, link to the thread. Below each, its « Demander la fin » requests (`end_requests`: reason, status, decision note). | « Mettre fin » on `active` (§1.4) |
| **Demandes de contact** | Brand, status, decision reason label, date. Link to the queue item. | — |
| **Signalements** `tips.flags` | « {open} ouverts · {n30} sur 30 jours », recent 20 (source label, kinds, count, status, date). Self-dealing rows with kinds. | link to `/admin/partners/flags?partner={id}` |

Empty section bodies print one muted line (« Aucun créateur représenté. », « Aucune mise en relation. »…),
never an empty card.

### 1.3 Delist / relist

Panel (from the action bar):
- **Retirer de l'annuaire** — heading « Retirer {name} de l'annuaire ? »; effect text
  `adminPartners.delist.effect`; « Motif » textarea **required**, ≤ 500 with counter (`reason_required`,
  `reason_too_long`); [Retirer de l'annuaire] (`bg-rose-700`) · [Annuler].
- **Remettre dans l'annuaire** — « Motif (facultatif) » ≤ 500; [Remettre dans l'annuaire] (primary).
- Success: `role="status"` line « {name} est retiré de l'annuaire. » / « … est de nouveau listé. »; chips update.
- The partner is notified by the server (`partner_delisted` / `partner_relisted`).

### 1.4 Assign (« Mettre en relation ») and unassign — effective immediately (P3)

**Assign panel:**
1. « Marque » — combobox (§6 pattern) on `admin_search_brands(p_query)`: starts after **2 characters**
   (below that, the hint « Tapez au moins 2 lettres »; server `query_too_short`), debounced 300 ms,
   approved brands only. Option row: avatar, company name (or display name), @handle, city,
   « {n} mises en relation actives » when > 0. Required.
2. « Campagne (facultatif) » — `<select>` of that brand's campaigns (title · status), first option
   « Toute la marque ». Loaded after a brand is picked.
3. « Note (facultatif) » — textarea, **≤ 280** with counter « {n}/280 » (`note_too_long`). Visible to
   both parties as the first context of the conversation.
4. [Mettre en relation] (primary) · [Annuler].
- Helper: `adminPartners.assign.help` — the conversation opens at once; no acceptance step.
- Errors: `partner_not_available`, `brand_not_active`, `campaign_not_found`, `assignment_exists`,
  `note_too_long`, `query_too_short` (copy §10.1).
- Success: `role="status"` « Mise en relation faite. La conversation est ouverte pour 30 jours. » + link
  « Ouvrir la conversation » (`/messages/{conversation_id}`); the new row appears as « Active ».
- If the server raises a self-dealing flag (visible in Signalements), the row shows the « ⚑ » chip.

**Unassign (« Mettre fin »):** on any `active` assignment. Panel « Mettre fin à la mise en relation avec
{brand} ? »; effect `adminPartners.unassign.effect`; « Motif » required ≤ 500; [Mettre fin]
(`bg-rose-700`). An open « Demander la fin » request for it is marked accepted by the server.

### 1.4b « Demander la fin » queue — `/admin/partners/assignments`

Source `admin_assignment_end_requests(p_status)`; default `open`, oldest first. Status chips « Ouvertes ·
Acceptées · Refusées · Toutes ».

```
┌──────────────────────────────────────────────┐
│ Il y a 2 j                                     │
│ @balafon  →  Saveurs du Wouri (@saveurs)       │  partner → brand (company)
│ Campagne : Lancement menu d'été                │  scope, or « Toute la marque »
│ « La marque ne répond plus depuis… »           │  reason (line-clamp-3, already masked)
│ ───────────────────────────────────────────── │
│ [ Refuser la demande ]        [ Mettre fin ]   │
└──────────────────────────────────────────────┘
```
- **Mettre fin** → the §1.4 unassign panel prefilled with « Fin demandée par le partenaire : {reason} »
  (editable, required) → `admin_end_assignment`.
- **Refuser la demande** → panel « Note pour le partenaire » required ≤ 500 (`note_required`,
  `note_too_long`) → `admin_dismiss_assignment_end_request`; the partner receives the note in the app.
- `request_already_decided` → « Cette demande a déjà été traitée. » + refresh.
- Empty: « Aucune demande de fin en attente. »
- The partner overview (§1.2) lists the same requests under « Mises en relation ».

### 1.5 End representation

Panel « Mettre fin à la représentation de @{creator} ? »; effect `adminPartners.endLink.effect`;
« Motif » required ≤ 500; [Mettre fin à la représentation] (`bg-rose-700`). Errors `link_not_found`.

### 1.6 Change commission rate (the rate lock, G6)

Panel « Modifier la commission de @{creator} »; current rate shown; « Nouveau taux (%) » numeric input
(`inputMode="decimal"`, accepts « 12,5 »); « Motif » required ≤ 500; helper `adminPartners.rate.help`.
Errors: `invalid_commission_rate` « Taux invalide. » · `link_not_open` « La représentation n'est plus active. »

### 1.7 Admin retainer on the brand's behalf

« Proposer un rétainer » opens the existing retainer form in admin mode (`admin_propose_retainer`):
brand picker (approved brands) + the amounts of the brand form; the 25 % cut is fixed and shown, not
editable (O7). Helper `adminPartners.retainer.help`. Errors `brand_not_active`, `invalid_amounts`.

### 1.8 Flags queue — `/admin/partners/flags`

Three tabs (URL `?tab=`), each with a status filter « Ouverts / Traités / Tous » (default Ouverts):

| Tab | Source | Row facts | Actions |
|---|---|---|---|
| **Coordonnées masquées** (`auto`) | `admin_message_flags`, `source='auto_mask'` | Sender @handle (partner or brand), pair « @partner ↔ @brand », kinds as chips (« Numéro », « E-mail », « Lien de messagerie », « Compte social »), count, « {n} signalements sur 30 jours » for the partner, date, link « Ouvrir la conversation » | « Voir l'original » (when `original_available`) · « Marquer comme traité » (note optional ≤ 500) |
| **Signalements** (`report`) | `admin_message_flags`, `source` = report | Reported by @handle, reason (already masked), pair, date | « Voir l'original » on the reported message when available · « Marquer comme traité » |
| **Auto-transactions** (`self`) | `admin_self_dealing_flags` | Pair, brand company, kinds (« Même téléphone », « Numéro de paiement partagé », « Même e-mail »), source (§10.1 `selfSource.*`: mise en relation, demande de contact, candidature pour un créateur, rétainer proposé par Bayele), date, « Paiements du partenaire bloqués » note | « Lever le signalement » (note optional) · « Confirmer » (note **required**, `note_required`) |

**« Voir l'original » (P5)** — the original text of a masked message, kept 90 days for the safety team:
- Button `Eye` « Voir l'original » (secondary, `min-h-tap`) shown only when `original_available` is true.
  When the original was purged, the row shows « Original supprimé (plus de 90 jours) » in `text-muted`
  instead.
- Opens an inline panel: heading « Voir le message d'origine »; notice (blue)
  `adminPartners.original.notice` (« Accès réservé à l'équipe de sécurité. Cette consultation est
  enregistrée avec votre motif. »); « Motif » **required**, ≤ 500 (`reason_required`,
  `reason_too_long`), with quick-pick chips that fill it (« Vérifier un signalement », « Contrôle d'un
  échange hors plateforme », « Litige en cours »); [Afficher l'original] (primary) · [Annuler].
- On success (`admin_read_masked_original`): the original appears in a box
  `rounded-xl border border-line bg-surface p-3 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]`
  under the label « Original (consulté le {date}) », with « Masquer » to close it. Not cached: leaving
  the page or masking it again requires a new reason. Never copied into notes automatically.
- Errors: `original_not_found` « Ce message n'a pas été masqué : il n'y a pas d'original. » ·
  `original_purged` « L'original a été supprimé après 90 jours. »
- Opening the thread from a flag is a normal admin read (already logged server-side).
- Empty per tab: « Aucun signalement ouvert. »
- `flag_already_decided` → « Ce signalement a déjà été traité. » + refresh.

### 1.9 Contact-request queue — `/admin/partners/requests`

Source `admin_contact_requests(p_status)`; default `pending`, oldest first.

```
┌──────────────────────────────────────────────┐
│ Il y a 26 h  [> 24 h]                [⚑ Auto]  │  age · overdue chip · self-dealing chip
│ Saveurs du Wouri (@saveurs) [Marque validée]  │  brand company · handle · brand status
│ → Agence Balafon (@balafon)                   │
│ « Lancer notre nouveau menu sur TikTok… »     │  goal (line-clamp-3), masked markers styled
│ Budget : à définir · Échéance : 30 nov. 2026  │
│ ───────────────────────────────────────────── │
│ [ Refuser ]                    [ Approuver ]  │
└──────────────────────────────────────────────┘
```
- Overdue chip « > 24 h » (`bg-rose-50 text-rose-700`) when older than the 24 h target (G4).
- Brand status chip: « Marque validée » (emerald) or « Marque non validée » (rose).
- Self-dealing chip « ⚑ Auto-transaction possible » when `self_dealing = true` (links to the flag).
- Masked goal: if `masked_kinds`, a line « Des coordonnées ont été masquées dans cette demande. » (`text-[11px] text-muted`).
- **Approve (P3: effective at once):** the button opens a small panel with an optional « Message à la
  marque (facultatif) » (≤ 500; the server appends it to the brand's notification) and the line
  « La conversation s'ouvre tout de suite entre la marque et le partenaire, pour 30 jours. »
  [Approuver et mettre en relation]. Success: `role="status"` « Demande approuvée. La conversation est
  ouverte. » + « Ouvrir la conversation ».
- **Refuse panel:** « Motif » radio list (required): Demande incomplète · Compte marque à compléter ·
  Partenaire peu adapté à ce besoin · Échanges hors plateforme suspectés · Autre motif. « Message à la
  marque » textarea, ≤ 500, **required for « Autre motif »**, optional otherwise, prefilled from the
  reason's template (`adminPartners.requests.reasons.*.message`). Preview line: « La marque recevra :
  Motif : {label}. {message} » (exactly what the server sends). [Refuser la demande] (`bg-rose-700`).
- Status filter chips: « En attente · Approuvées · Refusées · Retirées · Expirées · Toutes ».
- Errors: `not_pending` « Cette demande a déjà été traitée. », `message_required`, `message_too_long`,
  `invalid_reason_code`, plus the assignment errors of §1.4.

---

## 2. Brand side

### 2.1 « Demander ce partenaire » — entry points

**On `/partners/[handle]`** (`ProfileContactCTA`, kind `consultant`):

| Viewer | Renders |
|---|---|
| Logged out | Primary « Demander ce partenaire » → `/auth?mode=signup&role=business&intent=hire&target={handle}&next=/partners/{handle}` (same funnel, new label). The secondary « Envoyer un message » link is **removed** (no cold contact). |
| Brand, approved, no open request, not assigned | Primary « Demander ce partenaire » → `/business/partners/request?partner={handle}` + helper `partnerRequest.cta.help` |
| Brand, request `pending` | Secondary « Demande envoyée · voir le suivi » → `/business/partners` |
| Brand, assignment active (after approval or a direct Bayele introduction) | Primary « Ouvrir la conversation » → `/messages/{conversation_id}` + secondary « Proposer un rétainer » |
| Brand **not approved** (O8) | Block `rounded-xl bg-surface p-3 text-[13px]` « Votre compte marque doit être validé avant de demander un partenaire. » + link « Compléter mon profil » |
| Creator, partner, admin | nothing (unchanged) |

The old `/business/retainers/new?partner={handle}` link is gone from this page (G3: retainers only to
assigned partners).

**On `/business/talent`:** the page gets two tabs (URL `?tab=partners`): « Créateurs » (unchanged) ·
« Partenaires ». The partners tab lists **listed, active** partners (public directory data): name, city,
« Spécialités déclarées » chips, « Nouveau » rating label (D6), and per card the same CTA states as
above. Filter by specialty and country.

### 2.2 Request form — `/business/partners/request?partner={handle}`

Full page on phones (`max-w-lg mx-auto`), same on desktop.

```
← Partenaires
H1 « Demander un partenaire »
Partner summary card: avatar · name · @handle · specialties
PROTECTION NOTICE (blue): Bayele lit votre demande. Si elle est approuvée, la conversation s'ouvre ici…
1. Votre besoin *            [textarea, 0/280]
2. Budget envisagé           [text, 0/60]           (facultatif)
3. Échéance                  [date ≥ today]         (facultatif)
[☐] J'accepte de travailler avec ce partenaire uniquement via Bayele… (lire la clause)   *
[ Envoyer la demande ]
« Bayele vous répond dans l'application. »
```

| Field | Spec |
|---|---|
| Votre besoin | Required, 1–280 chars after trimming (`invalid_goal`). Placeholder `partnerRequest.goalPlaceholder` (no numbers). Counter « {n}/280 ». `SectionTip` `partnerRequest.tips.goal`. |
| Budget envisagé | Optional, ≤ 60 (`budget_too_long`). Placeholder « Une fourchette, si vous la connaissez » — **no example amounts** (they would be invented figures). |
| Échéance | Optional, `type="date" min={today}` (`deadline_in_past`). |
| Consent tick | Required (`consent_required`). Label `consent.request.label` + inline link « Lire la clause » → `/legal#non-contournement` (`target="_blank"`). The submit stays enabled; an unticked submit shows the field error and focuses the box (better than a silently disabled button). |
| Pre-send masking notice | If the goal/budget contains contact-like text (same client detector as §4.1), show under the field: « Les coordonnées seront masquées : Bayele vous met en relation dans l'application. » (blue notice). |
| Submit | « Envoyer la demande » → `request_partner_contact(…, NON_CIRCUMVENTION_VERSION)` → redirect `/business/partners?sent=1` with `role="status"` « Demande envoyée. Bayele vous répond dans l'application. » |

Errors (`partnerRequest.errors.*`): `owner_not_active`, `partner_not_available`, `cannot_contact_self`,
`request_already_open` (with a link to the tracking), `too_many_requests` (« Vous avez déjà 5 demandes
en attente. Attendez une réponse ou retirez-en une. »), `invalid_goal`, `budget_too_long`,
`deadline_in_past`, `consent_required`.

### 2.3 `/business/partners` — assigned partners and requests

Sections, in order:

1. **Partenaires assignés** (`partner_assignments` status `active`) — card: partner avatar, name,
   @handle, scope (« Toute la marque » / « Campagne : {title} »), origin (« Proposée par Bayele » /
   « Suite à votre demande »), Bayele's note when present, and:
   - thread state: « Conversation ouverte jusqu'au {date} » (the `expires_at`; once a funded retainer
     exists → « Contrat signé : coordonnées visibles ») with `SectionTip` `businessPartners.tips.window`;
   - buttons: « Ouvrir la conversation » (primary) · « Proposer un rétainer » (secondary →
     `/business/retainers/new?partner={handle}`).
2. **En revue par Bayele** — requests `pending`: pill « En revue par Bayele », goal (line-clamp-2), date
   sent, « Retirer la demande » (`withdraw_contact_request`, inline confirm).
3. **Historique** (collapsed `<details>` « Voir l'historique ({n}) ») — declined requests with the reason
   label + message, ended introductions, expired windows (« Fenêtre de 30 jours écoulée sans contrat —
   vous pouvez refaire une demande. » + « Refaire une demande »), withdrawn requests.

Status pill map:

| State | Pill | Classes |
|---|---|---|
| request `pending` | En revue par Bayele | `bg-accent-soft text-ink` |
| assignment `active` | Actif | `bg-emerald-50 text-emerald-700` |
| request `declined` | Refusée | `bg-rose-50 text-rose-700` |
| request `withdrawn` | Retirée | `bg-surface text-muted` |
| assignment `ended` / request `closed` | Terminée | `bg-surface text-muted` |
| request `expired` | Expirée | `bg-surface text-muted` |

The approval notification links straight to the conversation (`/messages/{conversation_id}`), so the
brand usually lands in the thread, not on this page.

Empty (nothing at all): icon tile `Handshake`, « Aucun partenaire pour l'instant », body
`businessPartners.empty.body`, CTA « Trouver un partenaire » → `/business/talent?tab=partners`.

### 2.4 Retainers only to assigned partners

`/business/retainers/new`: the free « identifiant du partenaire » field becomes a **`<select>` of the
brand's active assignments** (name · @handle). `?partner={handle}` preselects it when assigned.
- No active assignment: the form is replaced by an empty state « Vous pourrez proposer un rétainer
  après une mise en relation acceptée par le partenaire. » + « Demander un partenaire ».
- Server error `partner_not_assigned` (race) → same message + link.
- Helper under the select: `businessPartners.retainerHelp`.

---

## 3. Partner side

### 3.1 `/partner/assignments` — read-only introductions + « Demander la fin » (P3)

There is no accept/decline step: an introduction is active as soon as Bayele makes it, and the
conversation is already open (`partner_assignment_started` links straight to it). The partner's
one-time non-circumvention acknowledgement (§7) covers every introduction.

Sections « Actives » and « Terminées » (collapsed `<details>`).

Active card:
```
┌──────────────────────────────────────────────┐
│ [Proposée par Bayele]                il y a 2 h │  origin chip (or « Demande de la marque »)
│ Saveurs du Wouri · Douala                      │  brand company · city
│ Campagne : Lancement menu d'été                │  scope (or « Toute la marque »)
│ Besoin : « Lancer notre nouveau menu… »        │  brand's goal (contact-request origin)
│ Note de Bayele : …                             │  admin note (≤ 280)
│ Conversation ouverte jusqu'au 13 nov. 2026     │
│ ───────────────────────────────────────────── │
│ [ Ouvrir la conversation ]  Demander la fin    │  primary · text button
└──────────────────────────────────────────────┘
```
- **Demander la fin** → inline panel: « Pourquoi souhaitez-vous mettre fin à cette mise en relation ? »;
  « Motif » textarea required, 1–300 with counter (`reason_required`, `reason_too_long`); helper
  « Bayele examine votre demande et vous répond dans l'application. Vos messages restent consultables. »;
  [Envoyer la demande] (primary) · [Annuler] → `request_assignment_end`.
- After sending: the card shows the pill « Fin demandée » (`bg-accent-soft text-ink`) and « Demande
  envoyée le {date} »; the button is replaced by that line (`end_already_requested` if sent twice).
- If the admin dismisses it: the card shows « Demande de fin refusée : {note} » (`text-[12px] text-muted`)
  and « Demander la fin » is available again.
- Ended card: brand, scope, « Terminée le {date} », end reason when shown to the partner, « Voir les
  messages » (read-only thread).
- Errors: `assignment_not_active` « Cette mise en relation est déjà terminée. »
- Empty: « Aucune mise en relation pour l'instant. Bayele vous propose des marques quand votre profil
  correspond à leurs besoins. » + `SectionTip` `partnerAssignments.tips.howItWorks`.
- Delisted partner: a banner on `/partner/dashboard` and here: « Vous n'êtes plus visible dans
  l'annuaire. Vos missions en cours continuent. Écrivez à support@bayele.com pour en savoir plus. »

### 3.2 Conversations

`partner_assignment` and `retainer` threads use the existing thread UI with these additions:

| State (server) | Header line | Composer |
|---|---|---|
| Masked (no funded retainer) | `Lock` « Mise en relation Bayele · coordonnées masquées jusqu'au contrat » + `SectionTip` `messaging.tips.masked` | normal + §4 notices |
| Window open | « Ouverte jusqu'au {date} » appended (`<time>`) | normal |
| `conversation_expired` | « Fenêtre de 30 jours écoulée » | replaced by a read-only box: « Cette conversation est close : la fenêtre de 30 jours est écoulée sans contrat. La marque peut refaire une demande. » |
| `conversation_frozen` (`member_suspended`) | « Conversation suspendue » | « Cette conversation est suspendue pendant la vérification d'un compte. » |
| `conversation_frozen` (`assignment_ended` / `admin`) / `conversation_closed` | « Conversation fermée » | « Cette mise en relation est terminée. Les messages restent consultables. » |
| Funded retainer | « Contrat signé · conversation liée au rétainer » | normal, no masking notices |

The read-only box: `rounded-xl bg-surface p-3 text-[13px] text-muted`, replaces the textarea (not a
disabled textarea). History stays readable in every state.

### 3.3 Specialty picker (G1)

Used in partner onboarding and `/profile` (partner card). Replaces the comma-separated input.

```
Spécialités  (?)                                   2/3
[✓ Gestion de talents] [✓ UGC] [Photographie] [Production vidéo] …
« Choisissez jusqu'à 3 spécialités dans la liste. »
```
- Chips = `<button type="button" aria-pressed>` (same style as campaign categories), labels from
  `partner_specialties` (`label_fr` / `label_en` by locale), order by `sort`, active only.
- Counter « {n}/3 » `tabular-nums` right-aligned, `aria-live="polite"`.
- At 3 selected, unselected chips get `aria-disabled="true"` + `opacity-50`; tapping one shows the
  inline hint « 3 spécialités au maximum. Retirez-en une pour en choisir une autre. » (`role="status"`).
- Group: `<fieldset><legend>Spécialités</legend>` + `SectionTip` `specialties.tip`.
- Hidden input `specialties` = comma-joined **codes**.
- Errors: `invalid_specialty` « Choisissez dans la liste. »; `too_many_specialties` « 3 spécialités au maximum. »
- Legacy (0040 correction request): above the picker, the D4 correction banner + a muted line « Votre
  ancien texte : {legacy} — choisissez les spécialités qui correspondent. »
- Public display (`/partners/[handle]`, directory, brand talent tab): heading « Spécialités déclarées »
  (replaces « Non vérifié »), chips by label, tooltip `specialties.publicTip`.

---

## 4. Masked-message UX (brand ↔ partner threads before a funded retainer)

**Tone (Community seat direction, applied):** protective, not accusatory. We explain *why* (safety of
payment, both sides protected), never imply the reader is cheating, never use « interdit », « fraude »
or « sanction » in member-facing copy. Blue protection styling, `ShieldCheck` icon. The sanction
ladder lives in the CGU, linked, not repeated in the thread.

### 4.1 Before sending — inline notice

- Client detector `lib/contact-detect.ts`: a **lighter mirror** of the server rules (phones of 8–15
  digits except FCFA/thousand-grouped amounts, e-mails incl. « arobase », `wa.me` / `t.me` links,
  `@handle`, social profile URLs). It only drives the notice; the server is the authority.
- Shown only in masked threads, above the textarea, as the user types (debounced 300 ms):
  `messaging.mask.preSend` — « Pour votre sécurité, les coordonnées (numéro, e-mail, lien WhatsApp,
  compte social) seront masquées à l'envoi. Échangez ici jusqu'à la signature du contrat. »
- It never blocks sending. `aria-live="polite"` on first appearance only.
- In other threads (creator deals, funded retainers) the existing amber nudge is kept as is.

### 4.2 The masked marker in the message

- The body arrives already masked with « [numéro masqué] », « [e-mail masqué] », « [lien masqué] »,
  « [compte masqué] ». The bubble renders these exact tokens as inline marks:
  `<mark class="rounded bg-black/10 px-1 font-semibold not-italic text-inherit">` inside my
  (blue) bubbles (`bg-white/20` on `bg-brand`), with a 12 px `EyeOff` icon `aria-hidden`. The token text
  itself is what screen readers read.
- Under any bubble with `masked_kinds`, to both sides (contract UI rule):
  `text-[11px] text-muted` + `ShieldCheck` — « Coordonnées masquées : échangez sur Bayele jusqu'à la
  signature du contrat. » (on my own blue bubble the note sits under the bubble, outside it, so it keeps
  `text-muted` on the page background).

### 4.3 Sender feedback (right after sending)

When the sent message comes back with `masked_kinds`, show under the composer for 8 s (and keep it in
the DOM as `role="status"` until the next send):

« Nous avons masqué {kinds} dans votre message. C'est pour protéger les deux parties : le paiement
n'est garanti que sur Bayele. » + `SectionTip` « Pourquoi ? » (`messaging.tips.why`).

`{kinds}` = joined labels: « un numéro de téléphone », « une adresse e-mail », « un lien de
messagerie », « un compte social » (FR « et » before the last; EN "and").
**False positive** (a long reference): the same feedback appears; the tip text explains « Une longue
suite de chiffres (par exemple une référence) peut être masquée par erreur : écrivez-la avec des
lettres, par exemple « Réf. A-2026… ». » — honest about the measured false positive (G5).

### 4.4 « Signaler » (off-platform contact)

- In masked threads and retainer threads, the thread menu gets a second item **above** the existing
  one: `Flag` « Signaler une demande hors plateforme ». The existing « Signaler la conversation »
  (moderation) stays.
- Panel (same shell as the existing report panel, but blue protection styling, not rose):
  heading « Signaler une demande hors plateforme »; body `messaging.report.body`; « Ce qui s'est passé
  (facultatif) » textarea ≤ 300; [Envoyer le signalement] (primary) · [Annuler].
- Success: « Merci. Bayele examine la conversation. L'autre partie n'est pas prévenue. »
- `rate_limited`: « Vous avez déjà envoyé plusieurs signalements aujourd'hui. Réessayez demain ou écrivez à support@bayele.com. »

---

## 5. Creator WhatsApp proof upload (G8 — low priority, simplified per P6)

URL proof stays the main path (most campaigns run on TikTok, Facebook, YouTube and Instagram). The
screenshot path is kept **minimal**: guidance + 3 upload slots + compression + retry. **No crop step**
(P6: no extra polish); the guidance asks creators to crop with their phone's own editor before
uploading.

### 5.1 When it shows

On the mission row (`/creator/dashboard`, status `approved`, or `content_submitted` with
`recapture_requested_at` set and not yet resubmitted), for **any campaign whose platforms include
`whatsapp`** (Co-CTO answer):
- platforms = only `whatsapp` → the screenshot form only;
- `whatsapp` plus other platforms → a segmented control « Lien de la publication » (default) ·
  « Captures WhatsApp ».

### 5.2 Layout (360 px)

```
Preuve WhatsApp  (?)
GUIDANCE (blue box, always visible, 3 short lines):
  1. Capture du statut publié, avec la date visible.
  2. Au moins 24 h après, capture du nombre de vues.
  Avant d'envoyer, recadrez avec votre téléphone pour cacher les noms et numéros des personnes qui ont vu votre statut.
  Vos captures restent privées : seuls la marque et Bayele les voient.
SLOT 1  Statut publié *                     [ + Ajouter une capture ]
SLOT 2  Nombre de vues (24 h après) *       [ + Ajouter une capture ]
SLOT 3  Capture supplémentaire (facultatif) [ + Ajouter ]
[ Envoyer la preuve ]   (enabled when slots 1 and 2 are ready)
```
Slots stack one per row (`grid gap-3`); from `sm` slots 1–2 sit side by side, slot 3 below.

### 5.3 Slot states

| State | Render |
|---|---|
| Empty | Dashed tile `min-h-[7rem] rounded-xl border-2 border-dashed border-line bg-surface`, label + `ImagePlus` icon; the tile is a `<label>` for a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` (no `capture`, so the gallery opens). |
| Working | Thumbnail + `Loader2` « Envoi… » (compression and upload share one state — no progress bar). |
| Ready | Thumbnail (`object-cover aspect-[9/16] max-h-40`) + `CheckCircle2` emerald « Prête » + « Remplacer » text button. |
| Error | Rose outline + message + « Réessayer » (re-uses the prepared file) and « Choisir une autre image ». |

**Client pipeline (per slot):** decode → canvas, longest side ≤ 1600 px → encode WebP (fallback JPEG),
stepping quality down until ≈ 300 KB (G8 target) → if still > 5 MB, `proofShots.errors.tooLarge` →
SHA-256 of the final bytes → upload to `proofs/{creator_id}/{cc_id}/{uuid}.webp` (`upsert:false`) →
Ready. Network failure: 2 automatic retries, then Error with « Réessayer ».

Same image in slots 1 and 2 (same hash) is caught before submit (`proofShots.identicalClient`).

**Submit:** `creator_submit_whatsapp_proof(...)` → success line on the row « Preuve envoyée — la marque
la vérifie. » Errors: §10.6 `proofShots.errors.*`.

### 5.4 After « Demander une nouvelle capture »

Mission row banner (blue): « La marque demande une nouvelle capture. Motif : {reason} »; the slots
reset for a new round; previous round collapsed under « Captures précédentes ({n}) » (thumbnails,
read-only). Submit label « Renvoyer la preuve ».

### 5.5 Brand review (`/business/campaigns/[id]`, proof row)

- For `media_type = whatsapp_screenshots`: 2–3 thumbnails labelled « Statut publié », « Vues »,
  « Supplémentaire »; each opens the full image in a new tab via a short-lived signed URL (no custom
  viewer — P6). A failed load shows « Image expirée — rechargez la page. »
- Actions: « Valider » (existing) · **« Demander une nouvelle capture »** (secondary) · « Rejeter »
  (existing, for real failures).
- Recapture panel: « Motif » required ≤ 300 (`reason_required`, `reason_too_long`) with quick-pick chips
  that fill it (« La date n'est pas visible », « Le nombre de vues manque », « La capture des vues a été
  prise trop tôt », « L'image est illisible »); helper « Le créateur pourra renvoyer ses captures.
  {left} demande(s) restante(s) sur 3. »; [Envoyer la demande].
- While pending: pill « Nouvelle capture demandée »; Valider/Rejeter disabled with the reason
  (`recapture_pending`). `too_many_recaptures` → « Vous avez déjà demandé 3 nouvelles captures. Validez
  ou rejetez la preuve. »

---

## 6. City picker (G9)

Used in onboarding (all roles) and `/profile`. Component `CityPicker({ country, value })`.

- **Pattern:** WAI-ARIA 1.2 combobox: `<input role="combobox" aria-expanded aria-controls aria-autocomplete="list">`
  + `<ul role="listbox">`; options from `cities` for the selected country (ordered by `sort`).
- Typing filters accent- and case-insensitively (« yaounde » finds « Yaoundé »). Max list height
  `max-h-60 overflow-y-auto`; option rows `min-h-tap`.
- Last option, always present: « Autre ville… ». Choosing it reveals a text input « Nom de votre
  ville » (`maxLength={60}`, `autoComplete="address-level2"`) with the city helper from admin-review §B.
- Typed text that matches no option + Enter → treated as « Autre ».
- Keyboard: ↓/↑ move, Enter selects, Esc closes, Tab leaves with the current value.
- Changing the country clears a listed city (not an « Autre » text) and focuses the city field with a
  `role="status"` « Choisissez une ville du nouveau pays. »
- **No JS:** server-rendered `<select>` of the country's cities + « Autre » and the text input (the
  combobox enhances it).
- Field order: **Pays first, then Ville** (the list depends on it) — swaps today's order.
- Admin: `city_not_in_list` warning on the member detail page with a button « Ajouter « {city} » à la
  liste ({country}) » → `admin_add_city`; errors `city_exists` « Cette ville est déjà dans la liste. »,
  `invalid_city`.
- Tooltip `cityPicker.tip` on the label.

---

## 7. One-time non-circumvention acknowledgement (G7)

**Who / when:** signed-in members with role `business` or `consultant` whose `my_consents()` has no
`cgu_non_circumvention` row with the current `NON_CIRCUMVENTION_VERSION`. Checked in the `(app)`
layout. New partners/brands tick the same clause in onboarding (§7.3), so they never see the modal.
Since introductions need no acceptance (P3), this acknowledgement is what covers every introduction
for a partner: it must show on the partner's first visit to any `(app)` page, before `/partner/assignments`
or a `partner_assignment` thread is usable. Admins see the version on the partner overview (§1.2).

**Modal** (`<dialog>` opened with `showModal()`, CSS-only fade/scale 150 ms, reduced-motion: none):

```
┌──────────────────────────────────────────┐
│ (ShieldCheck)                             │
│ Une règle simple pour vous protéger       │  H2
│ Quand Bayele vous met en relation avec    │
│ une marque (ou un partenaire), vous       │
│ travaillez ensemble via Bayele pendant    │
│ 12 mois…                                  │  body (§10.7)
│ • Paiement garanti par le séquestre       │
│ • Échanges conservés en cas de litige     │
│ Lire la clause complète ↗                 │  /legal#non-contournement (new tab)
│ [☐] J'ai lu et j'accepte cette règle      │
│ [ Continuer ]                             │  primary, full width
│ Se déconnecter                            │  text button
└──────────────────────────────────────────┘
```
- Not dismissable by `Esc` or backdrop (prevent the `cancel` event) — it's a required, one-time step;
  the exit is « Se déconnecter ». `aria-labelledby` = H2, `aria-describedby` = body. Focus starts on
  the H2 (`tabIndex=-1`), trapped by the native dialog.
- « Continuer » with the box unticked → field error « Cochez la case pour continuer. » and focus on the
  box. Ticked → `record_consent('cgu_non_circumvention', NON_CIRCUMVENTION_VERSION)` → close, page
  stays where it was. Failure → « L'enregistrement a échoué. Réessayez. » (modal stays).
- 360 px: `w-[calc(100vw-2rem)] max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl p-5`.
- `/legal` itself never shows the modal (so the clause can be read).

### 7.3 Onboarding tick (new partners and brands)

Above « Finaliser mon profil » for roles `consultant` and `business`: the same checkbox
(`consent.onboarding.label` + « Lire la clause ») — required; recorded with `record_consent` right
after `onboard_profile` succeeds.

---

## 8. `/legal` additions (G7, G10, P5, P6)

Layout stays (sticky header, chip TOC, numbered sections). New structure and anchors:

| # | Anchor | Section | Change |
|---|---|---|---|
| 1 | `#cgu` | Conditions générales d'utilisation | unchanged intro |
| 1.1 | `#non-contournement` | Mise en relation et non-contournement | **new** — G7 clause |
| 2 | `#escrow` | Protocole de séquestre | copy cleaned of code words (`held`/`releasable` → « bloqués » / « libérés ») |
| 3 | `#privacy` | Données personnelles | intro kept |
| 3.1 | `#privacy-review` | Examen des profils | **new** (Legal seat text) |
| 3.2 | `#privacy-logs` | Journalisation | **new** — views 12 months; decisions and reveals 5 years |
| 3.3 | `#privacy-proofs` | Captures d'écran | **new** — 30 days after payment (or dispute close) |
| 3.4 | `#privacy-messages` | Modération des messages | **new** — masked originals 90 days, safety team only, every access logged |
| 3.5 | `#privacy-rights` | Vos droits | **new** — support@bayele.com |
| 4 | `#ohada` | Facturation OHADA | unchanged |

- TOC chips: « 1. CGU · Non-contournement · 2. Séquestre · 3. Données · 4. Facturation ».
- Sub-sections: `h3` `text-sm font-bold text-ink`, `scroll-mt-20`, a « # » copy-link button
  (`aria-label` « Copier le lien de la section »). Each sub-section is a lead-in word in bold
  (« **Examen des profils.** ») followed by the text, as in the Legal seat's draft.
- « Dernière mise à jour : 14 octobre 2026 ».
- FR/EN from the dictionary (`legal.*`, §10.8). The text is the **Legal seat's**, completed with the
  decided values; there is no « [À CONFIRMER] » anywhere. The pending local-counsel review is recorded
  in `docs/`, not on the page.

---

## 9. Tooltips (`SectionTip`, ≤ 200 characters)

| Key | Placement | FR | EN |
|---|---|---|---|
| `adminPartners.tips.listing` | overview « Annuaire » | Retirer un partenaire le cache de l'annuaire et bloque les nouvelles mises en relation. Son travail en cours continue. Un motif est obligatoire. | Delisting hides a partner from the directory and blocks new introductions. Current work continues. A reason is required. |
| `adminPartners.tips.specialties` | « Spécialités déclarées » | Choisies par le partenaire dans la liste Bayele (3 au plus). Elles sont déclarées, pas vérifiées. | Picked by the partner from Bayele's list (3 at most). They are declared, not verified. |
| `adminPartners.tips.links` | « Créateurs représentés » | La commission est fixée quand le créateur accepte. Seul un admin peut la modifier, avec un motif ; les missions déjà commencées gardent leur taux. | The commission is set when the creator accepts. Only an admin can change it, with a reason; missions already started keep their rate. |
| `adminPartners.tips.commissions` | « Commissions » | Versées seulement après validation de la campagne et libération du séquestre. Bloquées tant qu'un signalement d'auto-transaction est ouvert. | Paid only after the campaign is validated and escrow is released. Held while a self-dealing flag is open. |
| `adminPartners.tips.assignments` | « Mises en relation » | Seul Bayele met une marque en relation avec un partenaire. La conversation s'ouvre tout de suite, pour 30 jours. Le partenaire peut demander la fin. | Only Bayele introduces a brand to a partner. The conversation opens right away, for 30 days. The partner can ask to end it. |
| `adminPartners.tips.flags` | « Signalements » | Coordonnées masquées et signalements des membres. L'original d'un message masqué est gardé 90 jours, lisible avec un motif enregistré. | Masked contact details and member reports. A masked message's original is kept 90 days, readable with a logged reason. |
| `adminPartners.tips.flagsQueue` | flags page title | Chaque ligne indique le type de coordonnée masquée. « Voir l'original » demande un motif et chaque lecture est enregistrée. Après 90 jours, l'original est supprimé. | Each row shows the type of detail masked. "View original" needs a reason and every read is logged. After 90 days, the original is deleted. |
| `adminPartners.tips.selfDealing` | « Auto-transactions » tab | Un partenaire et une marque partagent un téléphone, un numéro de paiement ou un e-mail. Ses paiements sont bloqués jusqu'à votre décision. | A partner and a brand share a phone, payout number or e-mail. Their payouts are held until you decide. |
| `adminPartners.tips.requests` | requests page title | Répondez sous 24 h. Approuver met la marque et le partenaire en relation tout de suite. Refuser envoie le motif à la marque. | Reply within 24 h. Approving connects the brand and the partner right away. Declining sends the reason to the brand. |
| `adminPartners.tips.endRequests` | end-requests page title | Un partenaire demande à arrêter une mise en relation. Mettez-y fin, ou refusez avec une note qu'il recevra dans l'application. | A partner asks to stop an introduction. End it, or decline with a note they'll receive in the app. |
| `partnerRequest.tips.goal` | « Votre besoin » | Une ou deux phrases : ce que vous voulez obtenir. Bayele lit la demande avant de la transmettre au partenaire. | One or two sentences: what you want to achieve. Bayele reads the request before passing it to the partner. |
| `businessPartners.tips.window` | « Conversation ouverte jusqu'au » | La conversation reste ouverte 30 jours. Proposer ou signer un rétainer la prolonge ; une fois le contrat signé, les coordonnées s'affichent. | The conversation stays open 30 days. Proposing or signing a retainer extends it; once the contract is signed, contact details show. |
| `partnerAssignments.tips.howItWorks` | assignments empty state | Les marques passent par Bayele pour vous contacter. Gardez vos spécialités à jour : elles aident Bayele à vous proposer les bonnes marques. | Brands go through Bayele to reach you. Keep your specialties up to date: they help Bayele suggest the right brands. |
| `specialties.tip` | specialty picker legend | Choisissez jusqu'à 3 domaines où vous travaillez vraiment. Les marques les voient sur votre profil public. | Pick up to 3 areas you really work in. Brands see them on your public profile. |
| `specialties.publicTip` | public « Spécialités déclarées » | Spécialités choisies par le partenaire dans la liste Bayele. Elles ne sont pas vérifiées par Bayele. | Specialties chosen by the partner from Bayele's list. Bayele does not verify them. |
| `messaging.tips.masked` | thread header | Avant la signature d'un contrat, les numéros, e-mails, liens et comptes sont masqués. Le paiement n'est garanti que sur Bayele. | Before a contract is signed, numbers, e-mails, links and accounts are masked. Payment is only guaranteed on Bayele. |
| `messaging.tips.why` | sender feedback « Pourquoi ? » | Bayele vous protège tant que vous échangez ici. Une longue suite de chiffres, comme une référence, peut être masquée par erreur : ajoutez-y des lettres. | Bayele protects you while you talk here. A long string of digits, like a reference, may be masked by mistake: add letters to it. |
| `proofShots.tip` | « Preuve WhatsApp » | Deux captures : le statut publié avec sa date, puis le nombre de vues au moins 24 h après. Recadrez-les pour cacher les noms des personnes qui l'ont vu. | Two screenshots: the posted status with its date, then the view count at least 24 h later. Crop them to hide the names of people who viewed it. |
| `proofShots.reviewTip` | brand proof row | Vérifiez la date du statut et le nombre de vues. S'il manque quelque chose, demandez une nouvelle capture plutôt que de rejeter. | Check the status date and the view count. If something is missing, ask for a new screenshot instead of rejecting. |
| `cityPicker.tip` | « Ville » | Choisissez votre ville dans la liste du pays. Si elle n'y est pas, choisissez « Autre ville » et écrivez seulement son nom. | Pick your city from the country's list. If it isn't there, choose "Other city" and type only its name. |

All ≤ 200 characters. No banned words (« gagne », « récompense », « bonus », "reward", "earn",
« cadeau »).

---

## 10. Copy (FR / EN)

### 10.1 `adminPartners.*`

| Key | FR | EN |
|---|---|---|
| `adminPartners.title` | Partenaires | Partners |
| `adminPartners.rail` | ["Partenaires", "Demandes", "Signalements"] | ["Partners", "Requests", "Flags"] |
| `adminPartners.filter.listed` | Listés | Listed |
| `adminPartners.filter.delisted` | Retirés | Delisted |
| `adminPartners.filter.suspended` | Suspendus | Suspended |
| `adminPartners.filter.pending` | En attente | Pending |
| `adminPartners.filter.all` | Tous | All |
| `adminPartners.filter.hold` | Paiements bloqués | Payouts on hold |
| `adminPartners.search` | Nom, @identifiant ou ville | Name, @handle or city |
| `adminPartners.countMany` | {n} partenaires | {n} partners |
| `adminPartners.countOne` | 1 partenaire | 1 partner |
| `adminPartners.countBreakdown` | {l} listés · {d} retirés · {s} suspendus | {l} listed · {d} delisted · {s} suspended |
| `adminPartners.chip.listed` | Listé | Listed |
| `adminPartners.chip.delisted` | Retiré de l'annuaire | Delisted |
| `adminPartners.chip.hold` | Paiements bloqués | Payouts on hold |
| `adminPartners.chip.flagsSr` | signalements ouverts | open flags |
| `adminPartners.card.counts` | {c} créateurs · {a} mises en relation · {r} rétainers | {c} creators · {a} introductions · {r} retainers |
| `adminPartners.card.open` | Voir la fiche partenaire | View partner page |
| `adminPartners.empty` | Aucun partenaire ne correspond à ces filtres. | No partner matches these filters. |
| `adminPartners.memberLink` | Fiche membre complète | Full member page |
| `adminPartners.action.delist` | Retirer de l'annuaire | Delist |
| `adminPartners.action.relist` | Remettre dans l'annuaire | Relist |
| `adminPartners.action.assign` | Mettre en relation | Introduce to a brand |
| `adminPartners.action.retainer` | Proposer un rétainer | Propose a retainer |
| `adminPartners.section.listing` | Annuaire | Directory |
| `adminPartners.section.specialties` | Spécialités déclarées | Declared specialties |
| `adminPartners.section.links` | Créateurs représentés | Represented creators |
| `adminPartners.section.deals` | Missions | Missions |
| `adminPartners.section.commissions` | Commissions | Commissions |
| `adminPartners.section.retainers` | Rétainers | Retainers |
| `adminPartners.section.assignments` | Mises en relation | Introductions |
| `adminPartners.section.requests` | Demandes de contact | Contact requests |
| `adminPartners.section.flags` | Signalements | Flags |
| `adminPartners.listing.since` | Listé depuis le {date} | Listed since {date} |
| `adminPartners.listing.delistedOn` | Retiré le {date} — Motif : {reason} | Delisted on {date} — Reason: {reason} |
| `adminPartners.legacy` | Ancien texte non reconnu : {values} | Unrecognised old text: {values} |
| `adminPartners.legacyFix` | Une correction a été demandée | A correction has been requested |
| `adminPartners.origin.admin` | Proposée par Bayele | Proposed by Bayele |
| `adminPartners.origin.contact_request` | Demande de la marque | Brand's request |
| `adminPartners.origin.legacy_retainer` | Rétainer existant | Existing retainer |
| `adminPartners.scope.brand` | Toute la marque | Whole brand |
| `adminPartners.scope.campaign` | Campagne : {title} | Campaign: {title} |
| `adminPartners.status.active` | Active | Active |
| `adminPartners.status.ended` | Terminée | Ended |
| `adminPartners.commissions.line` | Dues : {owed} · Versées : {paid} · {count} missions | Owed: {owed} · Paid: {paid} · {count} missions |
| `adminPartners.commissions.hold` | Paiements bloqués : un signalement d'auto-transaction est ouvert. | Payouts on hold: a self-dealing flag is open. |
| `adminPartners.flags.line` | {open} ouverts · {n30} sur 30 jours | {open} open · {n30} in 30 days |
| `adminPartners.historyToggle` | Voir l'historique ({n}) | Show history ({n}) |
| `adminPartners.emptyLinks` | Aucun créateur représenté. | No represented creators. |
| `adminPartners.emptyAssignments` | Aucune mise en relation. | No introductions. |
| `adminPartners.emptyRetainers` | Aucun rétainer. | No retainers. |
| `adminPartners.emptyRequests` | Aucune demande de contact. | No contact requests. |
| `adminPartners.emptyFlags` | Aucun signalement. | No flags. |
| `adminPartners.reason` | Motif | Reason |
| `adminPartners.reasonOptional` | Motif (facultatif) | Reason (optional) |
| `adminPartners.cancel` | Annuler | Cancel |
| `adminPartners.delist.title` | Retirer {name} de l'annuaire ? | Delist {name}? |
| `adminPartners.delist.effect` | Le partenaire disparaît de l'annuaire et ne reçoit plus de nouvelles mises en relation ni demandes. Ses missions et rétainers en cours continuent. Il est prévenu dans l'application. | The partner disappears from the directory and gets no new introductions or requests. Current missions and retainers continue. They are notified in the app. |
| `adminPartners.delist.done` | {name} est retiré de l'annuaire. | {name} has been delisted. |
| `adminPartners.relist.done` | {name} est de nouveau listé. | {name} is listed again. |
| `adminPartners.assign.brand` | Marque | Brand |
| `adminPartners.assign.campaign` | Campagne (facultatif) | Campaign (optional) |
| `adminPartners.assign.note` | Note (facultatif) | Note (optional) |
| `adminPartners.assign.noteCounter` | {n}/280 | {n}/280 |
| `adminPartners.assign.searchHint` | Tapez au moins 2 lettres | Type at least 2 letters |
| `adminPartners.assign.activeCount` | {n} mises en relation actives | {n} active introductions |
| `adminPartners.assign.submit` | Mettre en relation | Connect them |
| `adminPartners.assign.help` | La mise en relation est active tout de suite : une conversation s'ouvre entre la marque et le partenaire pour 30 jours. Les deux sont prévenus dans l'application. | The introduction is active right away: a conversation opens between the brand and the partner for 30 days. Both are notified in the app. |
| `adminPartners.assign.done` | Mise en relation faite. La conversation est ouverte pour 30 jours. | Introduction made. The conversation is open for 30 days. |
| `adminPartners.assign.openThread` | Ouvrir la conversation | Open the conversation |
| `adminPartners.unassign.title` | Mettre fin à la mise en relation avec {brand} ? | End the introduction with {brand}? |
| `adminPartners.unassign.effect` | La conversation est fermée (les messages restent lisibles). Les deux parties sont prévenues. | The conversation is closed (messages stay readable). Both parties are notified. |
| `adminPartners.unassign.submit` | Mettre fin | End it |
| `adminPartners.endLink.title` | Mettre fin à la représentation de @{creator} ? | End the representation of @{creator}? |
| `adminPartners.endLink.effect` | Les missions déjà acceptées gardent leurs conditions. Le créateur et le partenaire sont prévenus. | Missions already accepted keep their terms. The creator and the partner are notified. |
| `adminPartners.endLink.submit` | Mettre fin à la représentation | End the representation |
| `adminPartners.rate.title` | Modifier la commission de @{creator} | Change @{creator}'s commission |
| `adminPartners.rate.current` | Taux actuel : {rate} % | Current rate: {rate}% |
| `adminPartners.rate.new` | Nouveau taux (%) | New rate (%) |
| `adminPartners.rate.help` | Les missions déjà commencées gardent leur taux. Le créateur et le partenaire sont prévenus. | Missions already started keep their rate. The creator and the partner are notified. |
| `adminPartners.rate.submit` | Enregistrer le taux | Save the rate |
| `adminPartners.retainer.help` | Bayele propose ce rétainer au nom de la marque. La part Bayele est fixée à 25 %. Le partenaire doit l'accepter. | Bayele proposes this retainer on the brand's behalf. Bayele's share is fixed at 25%. The partner must accept it. |
| `adminPartners.errors.partner_not_available` | Ce partenaire n'est pas disponible (en attente, suspendu ou retiré de l'annuaire). | This partner isn't available (pending, suspended or delisted). |
| `adminPartners.errors.brand_not_active` | Cette marque n'est pas encore validée. | This brand isn't approved yet. |
| `adminPartners.errors.campaign_not_found` | Cette campagne n'appartient pas à la marque choisie. | This campaign doesn't belong to the chosen brand. |
| `adminPartners.errors.assignment_exists` | Une mise en relation est déjà ouverte pour ce partenaire et cette marque. | An introduction is already open for this partner and brand. |
| `adminPartners.errors.reason_required` | Indiquez un motif. | Enter a reason. |
| `adminPartners.errors.reason_too_long` | Motif trop long (500 caractères au plus). | Reason too long (500 characters at most). |
| `adminPartners.errors.note_too_long` | Note trop longue (280 caractères au plus). | Note too long (280 characters at most). |
| `adminPartners.errors.query_too_short` | Tapez au moins 2 lettres. | Type at least 2 letters. |
| `adminPartners.errors.request_already_decided` | Cette demande a déjà été traitée. | This request has already been handled. |
| `adminPartners.errors.original_not_found` | Ce message n'a pas été masqué : il n'y a pas d'original. | This message wasn't masked: there is no original. |
| `adminPartners.errors.original_purged` | L'original a été supprimé après 90 jours. | The original was deleted after 90 days. |
| `adminPartners.errors.invalid_commission_rate` | Taux invalide. | Invalid rate. |
| `adminPartners.errors.link_not_open` | La représentation n'est plus active. | The representation is no longer active. |
| `adminPartners.errors.invalid_amounts` | Montants invalides. | Invalid amounts. |
| `adminPartners.errors.flag_already_decided` | Ce signalement a déjà été traité. | This flag has already been handled. |
| `adminPartners.errors.note_required` | Une note est obligatoire pour confirmer. | A note is required to confirm. |
| `adminPartners.errors.not_pending` | Cette demande a déjà été traitée. | This request has already been handled. |
| `adminPartners.errors.message_required` | Un message est obligatoire pour « Autre motif ». | A message is required for "Other reason". |
| `adminPartners.errors.message_too_long` | Message trop long (500 caractères au plus). | Message too long (500 characters at most). |
| `adminPartners.flagsTabs` | ["Coordonnées masquées", "Signalements", "Auto-transactions"] | ["Masked details", "Reports", "Self-dealing"] |
| `adminPartners.flagStatus` | ["Ouverts", "Traités", "Tous"] | ["Open", "Handled", "All"] |
| `adminPartners.kinds.phone` | Numéro | Number |
| `adminPartners.kinds.email` | E-mail | E-mail |
| `adminPartners.kinds.messaging_link` | Lien de messagerie | Messaging link |
| `adminPartners.kinds.social_handle` | Compte social | Social account |
| `adminPartners.selfKinds.phone` | Même téléphone | Same phone |
| `adminPartners.selfKinds.payout_number` | Numéro de paiement partagé | Shared payout number |
| `adminPartners.selfKinds.email` | Même e-mail | Same e-mail |
| `adminPartners.selfSource.assignment` | Mise en relation par Bayele | Introduction by Bayele |
| `adminPartners.selfSource.contact_request` | Demande de contact approuvée | Approved contact request |
| `adminPartners.selfSource.campaign_application` | Candidature pour un créateur | Application for a creator |
| `adminPartners.selfSource.retainer` | Rétainer proposé par Bayele | Retainer proposed by Bayele |
| `adminPartners.original.show` | Voir l'original | View original |
| `adminPartners.original.title` | Voir le message d'origine | View the original message |
| `adminPartners.original.notice` | Accès réservé à l'équipe de sécurité. Cette consultation est enregistrée avec votre motif. | Safety team access only. This read is logged with your reason. |
| `adminPartners.original.quick` | ["Vérifier un signalement", "Contrôle d'un échange hors plateforme", "Litige en cours"] | ["Check a report", "Review a possible off-platform exchange", "Ongoing dispute"] |
| `adminPartners.original.submit` | Afficher l'original | Show the original |
| `adminPartners.original.label` | Original (consulté le {date}) | Original (viewed on {date}) |
| `adminPartners.original.hide` | Masquer | Hide |
| `adminPartners.original.purged` | Original supprimé (plus de 90 jours) | Original deleted (over 90 days) |
| `adminPartners.endRequests.title` | Fins demandées | End requests |
| `adminPartners.endRequests.status` | ["Ouvertes", "Acceptées", "Refusées", "Toutes"] | ["Open", "Accepted", "Declined", "All"] |
| `adminPartners.endRequests.end` | Mettre fin | End it |
| `adminPartners.endRequests.dismiss` | Refuser la demande | Decline the request |
| `adminPartners.endRequests.prefill` | Fin demandée par le partenaire : {reason} | End requested by the partner: {reason} |
| `adminPartners.endRequests.noteLabel` | Note pour le partenaire | Note for the partner |
| `adminPartners.endRequests.empty` | Aucune demande de fin en attente. | No pending end requests. |
| `adminPartners.cgu.accepted` | Règle de non-contournement acceptée (version {version}) | Non-circumvention rule accepted (version {version}) |
| `adminPartners.cgu.missing` | Règle de non-contournement pas encore acceptée | Non-circumvention rule not yet accepted |
| `adminPartners.chip.endRequested` | Fin demandée | End requested |
| `adminPartners.flags.partner30` | {n} signalements sur 30 jours | {n} flags in 30 days |
| `adminPartners.flags.openThread` | Ouvrir la conversation | Open the conversation |
| `adminPartners.flags.resolve` | Marquer comme traité | Mark as handled |
| `adminPartners.flags.clear` | Lever le signalement | Clear the flag |
| `adminPartners.flags.confirm` | Confirmer | Confirm |
| `adminPartners.flags.holdNote` | Paiements du partenaire bloqués | Partner payouts on hold |
| `adminPartners.flags.reportedBy` | Signalé par @{handle} | Reported by @{handle} |
| `adminPartners.flags.empty` | Aucun signalement ouvert. | No open flags. |
| `adminPartners.requests.status` | ["En attente", "Approuvées", "Refusées", "Retirées", "Expirées", "Toutes"] | ["Pending", "Approved", "Declined", "Withdrawn", "Expired", "All"] |
| `adminPartners.requests.overdue` | > 24 h | > 24 h |
| `adminPartners.requests.brandApproved` | Marque validée | Approved brand |
| `adminPartners.requests.brandNotApproved` | Marque non validée | Brand not approved |
| `adminPartners.requests.selfDealing` | Auto-transaction possible | Possible self-dealing |
| `adminPartners.requests.budget` | Budget : {value} | Budget: {value} |
| `adminPartners.requests.budgetNone` | Budget : non précisé | Budget: not given |
| `adminPartners.requests.deadline` | Échéance : {date} | Deadline: {date} |
| `adminPartners.requests.masked` | Des coordonnées ont été masquées dans cette demande. | Contact details were masked in this request. |
| `adminPartners.requests.approve` | Approuver | Approve |
| `adminPartners.requests.decline` | Refuser | Decline |
| `adminPartners.requests.approved` | Demande approuvée. La conversation est ouverte. | Request approved. The conversation is open. |
| `adminPartners.requests.approveMessage` | Message à la marque (facultatif) | Message to the brand (optional) |
| `adminPartners.requests.approveNote` | La conversation s'ouvre tout de suite entre la marque et le partenaire, pour 30 jours. | The conversation opens right away between the brand and the partner, for 30 days. |
| `adminPartners.requests.approveSubmit` | Approuver et mettre en relation | Approve and connect |
| `adminPartners.requests.messageLabel` | Message à la marque | Message to the brand |
| `adminPartners.requests.preview` | La marque recevra : Motif : {label}. {message} | The brand will receive: Reason: {label}. {message} |
| `adminPartners.requests.submitDecline` | Refuser la demande | Decline the request |
| `adminPartners.requests.empty` | Aucune demande en attente. | No pending requests. |
| `adminPartners.requests.reasons.incomplete.label` | Demande incomplète | Incomplete request |
| `adminPartners.requests.reasons.incomplete.message` | Précisez votre besoin (objectif, délai) et renvoyez une demande. | Please describe your need (goal, timing) and send a new request. |
| `adminPartners.requests.reasons.brand_unverified.label` | Compte marque à compléter | Brand account to complete |
| `adminPartners.requests.reasons.brand_unverified.message` | Complétez votre profil marque ; nous pourrons ensuite traiter votre demande. | Complete your brand profile; we can then handle your request. |
| `adminPartners.requests.reasons.poor_fit.label` | Partenaire peu adapté à ce besoin | Partner not a good fit for this need |
| `adminPartners.requests.reasons.poor_fit.message` | Ce partenaire ne correspond pas à ce besoin. Bayele peut vous en proposer un autre. | This partner doesn't match this need. Bayele can suggest another one. |
| `adminPartners.requests.reasons.suspected_offplatform.label` | Échanges hors plateforme suspectés | Suspected off-platform dealings |
| `adminPartners.requests.reasons.suspected_offplatform.message` | Nous ne pouvons pas donner suite à cette demande. Les échanges et paiements doivent passer par Bayele. | We can't follow up on this request. Exchanges and payments must go through Bayele. |
| `adminPartners.requests.reasons.other.label` | Autre motif | Other reason |
| `adminPartners.requests.reasons.other.message` | "" (empty string: the admin must write it) | "" |

(The decline reason labels match the server's notification labels exactly — contract §4.)

### 10.2 `partnerRequest.*` (brand)

| Key | FR | EN |
|---|---|---|
| `partnerRequest.cta.request` | Demander ce partenaire | Request this partner |
| `partnerRequest.cta.help` | Bayele examine votre demande et vous répond dans l'application. | Bayele reviews your request and replies in the app. |
| `partnerRequest.cta.sent` | Demande envoyée · voir le suivi | Request sent · see status |
| `partnerRequest.cta.openThread` | Ouvrir la conversation | Open the conversation |
| `partnerRequest.cta.proposeRetainer` | Proposer un rétainer | Propose a retainer |
| `partnerRequest.cta.notApproved` | Votre compte marque doit être validé avant de demander un partenaire. | Your brand account must be approved before you request a partner. |
| `partnerRequest.cta.completeProfile` | Compléter mon profil | Complete my profile |
| `partnerRequest.title` | Demander un partenaire | Request a partner |
| `partnerRequest.notice` | Bayele lit votre demande. Si elle est approuvée, la conversation avec le partenaire s'ouvre tout de suite ici. Vos échanges et vos paiements restent protégés sur Bayele. | Bayele reads your request. If it's approved, the conversation with the partner opens here right away. Your exchanges and payments stay protected on Bayele. |
| `partnerRequest.goal` | Votre besoin | Your need |
| `partnerRequest.goalPlaceholder` | Ce que vous voulez obtenir, en une ou deux phrases. | What you want to achieve, in one or two sentences. |
| `partnerRequest.goalCounter` | {n}/280 | {n}/280 |
| `partnerRequest.budget` | Budget envisagé (facultatif) | Expected budget (optional) |
| `partnerRequest.budgetPlaceholder` | Une fourchette, si vous la connaissez | A range, if you know it |
| `partnerRequest.deadline` | Échéance (facultatif) | Deadline (optional) |
| `partnerRequest.maskNotice` | Les coordonnées seront masquées : Bayele vous met en relation dans l'application. | Contact details will be masked: Bayele introduces you in the app. |
| `partnerRequest.submit` | Envoyer la demande | Send the request |
| `partnerRequest.footnote` | Bayele vous répond dans l'application. | Bayele replies in the app. |
| `partnerRequest.sent` | Demande envoyée. Bayele vous répond dans l'application. | Request sent. Bayele replies in the app. |
| `partnerRequest.errors.owner_not_active` | Votre compte marque doit être validé avant de demander un partenaire. | Your brand account must be approved before you request a partner. |
| `partnerRequest.errors.partner_not_available` | Ce partenaire n'est pas disponible pour le moment. | This partner isn't available right now. |
| `partnerRequest.errors.cannot_contact_self` | Vous ne pouvez pas vous demander vous-même. | You can't request yourself. |
| `partnerRequest.errors.request_already_open` | Une demande est déjà en cours pour ce partenaire. | A request is already open for this partner. |
| `partnerRequest.errors.too_many_requests` | Vous avez déjà 5 demandes en attente. Attendez une réponse ou retirez-en une. | You already have 5 pending requests. Wait for a reply or withdraw one. |
| `partnerRequest.errors.invalid_goal` | Décrivez votre besoin (280 caractères au plus). | Describe your need (280 characters at most). |
| `partnerRequest.errors.budget_too_long` | Budget trop long (60 caractères au plus). | Budget too long (60 characters at most). |
| `partnerRequest.errors.deadline_in_past` | Choisissez une date à venir. | Pick a future date. |
| `partnerRequest.errors.consent_required` | Cochez la case pour envoyer la demande. | Tick the box to send the request. |

### 10.3 `businessPartners.*`

| Key | FR | EN |
|---|---|---|
| `businessPartners.nav` | Partenaires | Partners |
| `businessPartners.title` | Mes partenaires | My partners |
| `businessPartners.assigned` | Partenaires assignés | Assigned partners |
| `businessPartners.pending` | En attente | Pending |
| `businessPartners.history` | Voir l'historique ({n}) | Show history ({n}) |
| `businessPartners.windowUntil` | Conversation ouverte jusqu'au {date} | Conversation open until {date} |
| `businessPartners.contractSigned` | Contrat signé : coordonnées visibles | Contract signed: contact details visible |
| `businessPartners.withdraw` | Retirer la demande | Withdraw the request |
| `businessPartners.withdrawConfirm` | Retirer cette demande ? Vous pourrez en envoyer une autre. | Withdraw this request? You can send another one. |
| `businessPartners.expired` | Fenêtre de 30 jours écoulée sans contrat — vous pouvez refaire une demande. | 30-day window ended without a contract — you can send a new request. |
| `businessPartners.requestAgain` | Refaire une demande | Request again |
| `businessPartners.declinedReason` | Motif : {label}. {message} | Reason: {label}. {message} |
| `businessPartners.sentOn` | Envoyée le {date} | Sent on {date} |
| `businessPartners.pill.review` | En revue par Bayele | Under review by Bayele |
| `businessPartners.pill.active` | Actif | Active |
| `businessPartners.pill.declined` | Refusée | Declined |
| `businessPartners.pill.withdrawn` | Retirée | Withdrawn |
| `businessPartners.pill.ended` | Terminée | Ended |
| `businessPartners.pill.expired` | Expirée | Expired |
| `businessPartners.empty.title` | Aucun partenaire pour l'instant | No partners yet |
| `businessPartners.empty.body` | Un partenaire gère vos campagnes et vos créateurs. Choisissez-en un dans l'annuaire : Bayele vous met en relation. | A partner runs your campaigns and creators. Pick one from the directory: Bayele introduces you. |
| `businessPartners.empty.cta` | Trouver un partenaire | Find a partner |
| `businessPartners.retainerHelp` | Vous pouvez proposer un rétainer aux partenaires avec qui Bayele vous a mis en relation. | You can propose a retainer to partners Bayele has introduced you to. |
| `businessPartners.retainerNone` | Vous pourrez proposer un rétainer après une mise en relation par Bayele. | You can propose a retainer once Bayele has introduced you to a partner. |
| `businessPartners.origin.admin` | Proposée par Bayele | Proposed by Bayele |
| `businessPartners.origin.contact_request` | Suite à votre demande | Following your request |
| `businessPartners.retainerSelect` | Partenaire | Partner |
| `businessPartners.talentTabs` | ["Créateurs", "Partenaires"] | ["Creators", "Partners"] |

### 10.4 `partnerAssignments.*` (partner), `specialties.*`

| Key | FR | EN |
|---|---|---|
| `partnerAssignments.nav` | Mises en relation | Introductions |
| `partnerAssignments.title` | Mises en relation | Introductions |
| `partnerAssignments.active` | Actives | Active |
| `partnerAssignments.ended` | Terminées | Ended |
| `partnerAssignments.need` | Besoin : « {goal} » | Need: "{goal}" |
| `partnerAssignments.note` | Note de Bayele : {note} | Note from Bayele: {note} |
| `partnerAssignments.until` | Conversation ouverte jusqu'au {date} | Conversation open until {date} |
| `partnerAssignments.openThread` | Ouvrir la conversation | Open the conversation |
| `partnerAssignments.viewMessages` | Voir les messages | View messages |
| `partnerAssignments.endedOn` | Terminée le {date} | Ended on {date} |
| `partnerAssignments.requestEnd` | Demander la fin | Ask to end it |
| `partnerAssignments.requestEndTitle` | Pourquoi souhaitez-vous mettre fin à cette mise en relation ? | Why do you want to end this introduction? |
| `partnerAssignments.requestEndReason` | Motif | Reason |
| `partnerAssignments.requestEndHelp` | Bayele examine votre demande et vous répond dans l'application. Vos messages restent consultables. | Bayele reviews your request and replies in the app. Your messages remain readable. |
| `partnerAssignments.requestEndSubmit` | Envoyer la demande | Send the request |
| `partnerAssignments.endRequested` | Fin demandée | End requested |
| `partnerAssignments.endRequestedOn` | Demande envoyée le {date} | Request sent on {date} |
| `partnerAssignments.endDismissed` | Demande de fin refusée : {note} | End request declined: {note} |
| `partnerAssignments.cancel` | Annuler | Cancel |
| `partnerAssignments.empty` | Aucune mise en relation pour l'instant. Bayele vous propose des marques quand votre profil correspond à leurs besoins. | No introductions yet. Bayele suggests brands when your profile matches their needs. |
| `partnerAssignments.delisted` | Vous n'êtes plus visible dans l'annuaire. Vos missions en cours continuent. Écrivez à support@bayele.com pour en savoir plus. | You're no longer visible in the directory. Your current missions continue. Write to support@bayele.com to find out more. |
| `partnerAssignments.errors.reason_required` | Indiquez un motif. | Enter a reason. |
| `partnerAssignments.errors.reason_too_long` | Motif trop long (300 caractères au plus). | Reason too long (300 characters at most). |
| `partnerAssignments.errors.end_already_requested` | Vous avez déjà demandé la fin de cette mise en relation. | You've already asked to end this introduction. |
| `partnerAssignments.errors.assignment_not_active` | Cette mise en relation est déjà terminée. | This introduction has already ended. |
| `specialties.legend` | Spécialités | Specialties |
| `specialties.counter` | {n}/3 | {n}/3 |
| `specialties.help` | Choisissez jusqu'à 3 spécialités dans la liste. | Choose up to 3 specialties from the list. |
| `specialties.max` | 3 spécialités au maximum. Retirez-en une pour en choisir une autre. | 3 specialties at most. Remove one to choose another. |
| `specialties.publicHeading` | Spécialités déclarées | Declared specialties |
| `specialties.legacy` | Votre ancien texte : {legacy} — choisissez les spécialités qui correspondent. | Your old text: {legacy} — choose the matching specialties. |
| `specialties.errors.invalid_specialty` | Choisissez dans la liste. | Choose from the list. |
| `specialties.errors.too_many_specialties` | 3 spécialités au maximum. | 3 specialties at most. |

### 10.5 `messaging.*`

| Key | FR | EN |
|---|---|---|
| `messaging.header.masked` | Mise en relation Bayele · coordonnées masquées jusqu'au contrat | Bayele introduction · contact details masked until the contract |
| `messaging.header.until` | Ouverte jusqu'au {date} | Open until {date} |
| `messaging.header.signed` | Contrat signé · conversation liée au rétainer | Contract signed · conversation linked to the retainer |
| `messaging.mask.preSend` | Pour votre sécurité, les coordonnées (numéro, e-mail, lien WhatsApp, compte social) seront masquées à l'envoi. Échangez ici jusqu'à la signature du contrat. | For your safety, contact details (number, e-mail, WhatsApp link, social account) will be masked when sent. Talk here until the contract is signed. |
| `messaging.mask.bubbleNote` | Coordonnées masquées : échangez sur Bayele jusqu'à la signature du contrat. | Contact details masked: talk on Bayele until the contract is signed. |
| `messaging.mask.sent` | Nous avons masqué {kinds} dans votre message. C'est pour protéger les deux parties : le paiement n'est garanti que sur Bayele. | We masked {kinds} in your message. It protects both sides: payment is only guaranteed on Bayele. |
| `messaging.mask.why` | Pourquoi ? | Why? |
| `messaging.mask.kinds.phone` | un numéro de téléphone | a phone number |
| `messaging.mask.kinds.email` | une adresse e-mail | an e-mail address |
| `messaging.mask.kinds.messaging_link` | un lien de messagerie | a messaging link |
| `messaging.mask.kinds.social_handle` | un compte social | a social account |
| `messaging.mask.and` | et | and |
| `messaging.closed.expired` | Cette conversation est close : la fenêtre de 30 jours est écoulée sans contrat. La marque peut refaire une demande. | This conversation is closed: the 30-day window ended without a contract. The brand can send a new request. |
| `messaging.closed.suspended` | Cette conversation est suspendue pendant la vérification d'un compte. | This conversation is paused while an account is being checked. |
| `messaging.closed.ended` | Cette mise en relation est terminée. Les messages restent consultables. | This introduction has ended. Messages remain readable. |
| `messaging.report.menu` | Signaler une demande hors plateforme | Report an off-platform request |
| `messaging.report.title` | Signaler une demande hors plateforme | Report an off-platform request |
| `messaging.report.body` | On vous propose de continuer sur WhatsApp, par téléphone ou de payer hors de Bayele ? Dites-le-nous : Bayele examine la conversation. | Asked to continue on WhatsApp, by phone, or to pay outside Bayele? Tell us: Bayele will review the conversation. |
| `messaging.report.reason` | Ce qui s'est passé (facultatif) | What happened (optional) |
| `messaging.report.submit` | Envoyer le signalement | Send the report |
| `messaging.report.done` | Merci. Bayele examine la conversation. L'autre partie n'est pas prévenue. | Thank you. Bayele is reviewing the conversation. The other party isn't notified. |
| `messaging.report.rate_limited` | Vous avez déjà envoyé plusieurs signalements aujourd'hui. Réessayez demain ou écrivez à support@bayele.com. | You've already sent several reports today. Try again tomorrow or write to support@bayele.com. |
| `messaging.errors.conversation_expired` | La fenêtre de 30 jours est écoulée : ce message n'a pas été envoyé. | The 30-day window has ended: this message wasn't sent. |
| `messaging.errors.conversation_frozen` | Cette conversation est suspendue : ce message n'a pas été envoyé. | This conversation is paused: this message wasn't sent. |
| `messaging.errors.conversation_closed` | Cette mise en relation est terminée : ce message n'a pas été envoyé. | This introduction has ended: this message wasn't sent. |
| `messaging.errors.not_assigned` | Cette conversation s'ouvre après une mise en relation par Bayele. | This conversation opens after Bayele introduces you. |

### 10.6 `proofShots.*`

| Key | FR | EN |
|---|---|---|
| `proofShots.title` | Preuve WhatsApp | WhatsApp proof |
| `proofShots.modeLink` | Lien de la publication | Post link |
| `proofShots.modeShots` | Captures WhatsApp | WhatsApp screenshots |
| `proofShots.guide.title` | Comment faire | How to do it |
| `proofShots.guide.steps` | ["Capture du statut publié, avec la date visible.", "Au moins 24 h après, capture du nombre de vues.", "Avant d'envoyer, recadrez avec votre téléphone pour cacher les noms et numéros des personnes qui ont vu votre statut."] | ["Screenshot of the posted status, with the date visible.", "At least 24 h later, screenshot of the view count.", "Before sending, crop with your phone to hide the names and numbers of people who viewed your status."] |
| `proofShots.guide.private` | Vos captures restent privées : seuls la marque et Bayele les voient. | Your screenshots stay private: only the brand and Bayele see them. |
| `proofShots.slot.posted` | Statut publié | Posted status |
| `proofShots.slot.views` | Nombre de vues (24 h après) | View count (24 h later) |
| `proofShots.slot.extra` | Capture supplémentaire (facultatif) | Extra screenshot (optional) |
| `proofShots.add` | Ajouter une capture | Add a screenshot |
| `proofShots.other` | Choisir une autre image | Choose another image |
| `proofShots.state.uploading` | Envoi… | Uploading… |
| `proofShots.state.ready` | Prête | Ready |
| `proofShots.replace` | Remplacer | Replace |
| `proofShots.retry` | Réessayer | Try again |
| `proofShots.submit` | Envoyer la preuve | Send the proof |
| `proofShots.resubmit` | Renvoyer la preuve | Send the proof again |
| `proofShots.sent` | Preuve envoyée — la marque la vérifie. | Proof sent — the brand is checking it. |
| `proofShots.recaptureBanner` | La marque demande une nouvelle capture. Motif : {reason} | The brand asks for a new screenshot. Reason: {reason} |
| `proofShots.previous` | Captures précédentes ({n}) | Previous screenshots ({n}) |
| `proofShots.identicalClient` | Les deux captures sont identiques. Ajoutez la capture des vues prise au moins 24 h après. | Both screenshots are identical. Add the view-count screenshot taken at least 24 h later. |
| `proofShots.errors.tooLarge` | Image trop lourde (5 Mo au plus après compression). Choisissez une autre capture. | Image too large (5 MB at most after compression). Choose another screenshot. |
| `proofShots.errors.type` | Format non pris en charge. Utilisez une capture JPG, PNG ou WebP. | Unsupported format. Use a JPG, PNG or WebP screenshot. |
| `proofShots.errors.network` | L'envoi a échoué. Vérifiez votre connexion puis réessayez. | Upload failed. Check your connection, then try again. |
| `proofShots.errors.screenshots_required` | Ajoutez les deux captures obligatoires. | Add the two required screenshots. |
| `proofShots.errors.screenshot_not_uploaded` | Une capture n'a pas fini de s'envoyer. Réessayez. | A screenshot hasn't finished uploading. Try again. |
| `proofShots.errors.proof_duplicate_image` | Cette capture a déjà servi pour une autre mission. Ajoutez une capture de ce statut. | This screenshot was already used for another mission. Add a screenshot of this status. |
| `proofShots.errors.screenshot_already_used` | Cette capture a déjà été envoyée. Ajoutez une nouvelle capture. | This screenshot was already sent. Add a new one. |
| `proofShots.errors.screenshots_identical` | Les deux captures sont identiques. | Both screenshots are identical. |
| `proofShots.errors.invalid_screenshot` | Capture illisible. Choisissez-la à nouveau. | Unreadable screenshot. Pick it again. |
| `proofShots.errors.already_submitted` | La preuve a déjà été envoyée. | The proof has already been sent. |
| `proofShots.review.labels` | ["Statut publié", "Vues", "Supplémentaire"] | ["Posted status", "Views", "Extra"] |
| `proofShots.review.recapture` | Demander une nouvelle capture | Ask for a new screenshot |
| `proofShots.review.reason` | Motif | Reason |
| `proofShots.review.quick` | ["La date n'est pas visible", "Le nombre de vues manque", "La capture des vues a été prise trop tôt", "L'image est illisible"] | ["The date isn't visible", "The view count is missing", "The view-count screenshot was taken too early", "The image is unreadable"] |
| `proofShots.review.left` | Le créateur pourra renvoyer ses captures. {left} demande(s) restante(s) sur 3. | The creator can send new screenshots. {left} request(s) left out of 3. |
| `proofShots.review.send` | Envoyer la demande | Send the request |
| `proofShots.review.pending` | Nouvelle capture demandée | New screenshot requested |
| `proofShots.review.expired` | Image expirée — rechargez la page. | Image expired — reload the page. |
| `proofShots.review.errors.too_many_recaptures` | Vous avez déjà demandé 3 nouvelles captures. Validez ou rejetez la preuve. | You've already asked for 3 new screenshots. Approve or reject the proof. |
| `proofShots.review.errors.reason_required` | Indiquez ce qu'il faut corriger. | Say what needs fixing. |
| `proofShots.review.errors.reason_too_long` | Motif trop long (300 caractères au plus). | Reason too long (300 characters at most). |
| `proofShots.review.errors.recapture_pending` | Une nouvelle capture est attendue : vous pourrez valider après son envoi. | A new screenshot is pending: you can approve once it's sent. |

### 10.7 `cityPicker.*`, `consent.*`

| Key | FR | EN |
|---|---|---|
| `cityPicker.label` | Ville | City |
| `cityPicker.placeholder` | Rechercher votre ville | Search your city |
| `cityPicker.other` | Autre ville… | Other city… |
| `cityPicker.otherLabel` | Nom de votre ville | Your city's name |
| `cityPicker.noMatch` | Aucune ville trouvée : choisissez « Autre ville ». | No city found: choose "Other city". |
| `cityPicker.countryChanged` | Choisissez une ville du nouveau pays. | Choose a city in the new country. |
| `cityPicker.admin.add` | Ajouter « {city} » à la liste ({country}) | Add "{city}" to the list ({country}) |
| `cityPicker.admin.added` | Ville ajoutée à la liste. | City added to the list. |
| `cityPicker.admin.errors.city_exists` | Cette ville est déjà dans la liste. | This city is already in the list. |
| `cityPicker.admin.errors.invalid_city` | Nom de ville invalide. | Invalid city name. |
| `consent.readClause` | Lire la clause | Read the clause |
| `consent.request.label` | J'accepte de travailler avec ce partenaire uniquement via Bayele pendant 12 mois après la mise en relation. | I agree to work with this partner only through Bayele for 12 months after the introduction. |
| `consent.onboarding.label` | J'accepte de passer par Bayele pour toute collaboration née d'une mise en relation Bayele, pendant 12 mois. | I agree to go through Bayele for any collaboration that starts from a Bayele introduction, for 12 months. |
| `consent.modal.title` | Une règle simple pour vous protéger | A simple rule to protect you |
| `consent.modal.body` | Quand Bayele vous met en relation avec une marque ou un partenaire, vous travaillez ensemble via Bayele pendant 12 mois après la mise en relation ou la dernière mission payée. | When Bayele introduces you to a brand or a partner, you work together through Bayele for 12 months after the introduction or the last paid job. |
| `consent.modal.points` | ["Votre paiement est garanti par le séquestre.", "Vos échanges sont conservés en cas de désaccord."] | ["Your payment is guaranteed by escrow.", "Your exchanges are kept in case of disagreement."] |
| `consent.modal.tick` | J'ai lu et j'accepte cette règle. | I have read and accept this rule. |
| `consent.modal.continue` | Continuer | Continue |
| `consent.modal.signOut` | Se déconnecter | Sign out |
| `consent.modal.tickError` | Cochez la case pour continuer. | Tick the box to continue. |
| `consent.modal.saveError` | L'enregistrement a échoué. Réessayez. | Saving failed. Try again. |

### 10.8 `legal.*` (Legal seat text, decided values applied)

| Key | FR | EN |
|---|---|---|
| `legal.updated` | Dernière mise à jour : 14 octobre 2026 | Last updated: 14 October 2026 |
| `legal.toc` | ["1. CGU", "Non-contournement", "2. Séquestre", "3. Données", "4. Facturation"] | ["1. Terms", "Non-circumvention", "2. Escrow", "3. Data", "4. Invoicing"] |
| `legal.nonCircumvention.title` | 1.1 Mise en relation et non-contournement | 1.1 Introductions and non-circumvention |
| `legal.nonCircumvention.body` | ["Quand Bayele met en relation une marque et un partenaire, ils s'engagent à conclure et payer via Bayele toute collaboration entre eux pendant 12 mois à compter de la mise en relation ou de la dernière mission payée sur Bayele.", "En cas de contournement, Bayele peut, selon la gravité : adresser un avertissement, suspendre le compte, retirer le partenaire de l'annuaire, facturer un montant égal aux frais Bayele perdus et retenir les commissions non encore versées.", "Cet engagement est accepté par une case à cocher, enregistrée avec sa version et sa date."] | ["When Bayele introduces a brand and a partner, they agree to contract and pay through Bayele for any collaboration between them for 12 months from the introduction or from the last job paid on Bayele.", "If this is circumvented, Bayele may, depending on severity: issue a warning, suspend the account, remove the partner from the directory, charge an amount equal to Bayele's lost fees, and withhold commissions not yet paid.", "This commitment is accepted with a tick box, recorded with its version and date."] |
| `legal.escrow.body` | Les fonds restent bloqués sous séquestre jusqu'à la validation de la preuve de diffusion, puis sont libérés et versés par Mobile Money. | Funds stay locked in escrow until the proof of posting is approved, then they are released and paid by Mobile Money. |
| `legal.privacy.review.title` | 3.1 Examen des profils | 3.1 Profile review |
| `legal.privacy.review.body` | Nos administrateurs peuvent consulter votre profil, avant et après son approbation, pour vérifier votre identité et protéger la communauté. Les numéros de paiement Mobile Money et les identifiants fiscaux sont masqués par défaut et ne sont affichés que pour un paiement, un litige ou une obligation légale. | Our administrators may view your profile, before and after it is approved, to verify your identity and protect the community. Mobile Money payout numbers and tax identifiers are masked by default and are only shown for a payment, a dispute or a legal obligation. |
| `legal.privacy.logs.title` | 3.2 Journalisation | 3.2 Logging |
| `legal.privacy.logs.body` | Nous enregistrons les consultations de profils, les affichages de données masquées et les décisions (approbation, rejet, demande de correction, suspension), avec la date, l'administrateur et le motif. Le journal ne contient pas les données affichées. Les consultations sont conservées 12 mois ; les décisions et les affichages de données masquées, 5 ans. | We log profile views, displays of masked data and decisions (approval, rejection, correction request, suspension), with the date, the administrator and the reason. The log does not contain the data displayed. Views are kept for 12 months; decisions and displays of masked data for 5 years. |
| `legal.privacy.proofs.title` | 3.3 Captures d'écran | 3.3 Screenshots |
| `legal.privacy.proofs.body` | Les captures d'écran envoyées comme preuve d'un statut WhatsApp sont privées : seuls le créateur, la marque de la campagne et nos administrateurs peuvent les voir. Elles sont conservées 30 jours après le paiement, ou après la clôture d'un litige si elle est plus tardive, puis supprimées. Cachez les noms et numéros des personnes visibles sur vos captures. | Screenshots sent as proof of a WhatsApp status are private: only the creator, the campaign's brand and our administrators can see them. They are kept for 30 days after payment, or after a dispute closes if that is later, and then deleted. Hide the names and numbers of anyone visible in your screenshots. |
| `legal.privacy.messages.title` | 3.4 Modération des messages | 3.4 Message moderation |
| `legal.privacy.messages.body` | Avant la signature d'un contrat, les coordonnées (téléphone, e-mail, lien WhatsApp, identifiant de réseau social) sont masquées automatiquement dans les messages. Quand un message est masqué, l'original est conservé 90 jours, accessible uniquement à l'équipe de sécurité ; chaque consultation est journalisée. Après la signature d'un contrat, les messages ne sont ni masqués ni analysés. | Before a contract is signed, contact details (phone, e-mail, WhatsApp link, social media handle) are automatically masked in messages. When a message is masked, the original is kept for 90 days, accessible only to the safety team; every access is logged. Once a contract is signed, messages are neither masked nor scanned. |
| `legal.privacy.rights.title` | 3.5 Vos droits | 3.5 Your rights |
| `legal.privacy.rights.body` | Vous pouvez demander l'accès à vos données, les corriger, et présenter à nouveau votre profil après un rejet. Écrivez-nous à support@bayele.com. | You can ask to access your data, correct it, and submit your profile again after a rejection. Write to us at support@bayele.com. |
| `legal.copyLink` | Copier le lien de la section | Copy the section link |

---

## 11. Accessibility and 360 px checklist

- [ ] Every new list/card follows the overflow rules (`min-w-0`, `truncate`, `line-clamp-N`, `[overflow-wrap:anywhere]`); no horizontal scroll at 360 / 390 / 768 / 1024 / 1280 px on all new routes.
- [ ] Tap targets ≥ 48 px: chips, slot tiles, dialog buttons, menu items, « Voir l'original ».
- [ ] Consent ticks: real `<input type="checkbox">` with a `<label>` wrapping the text; the « Lire la clause » link sits outside the label (so tapping it doesn't toggle); errors via `aria-describedby` + `aria-invalid`.
- [ ] Specialty chips `aria-pressed`; limit state announced (`role="status"`); counter `aria-live="polite"`.
- [ ] City combobox follows WAI-ARIA 1.2 (`role="combobox"`, `aria-activedescendant`, listbox options with `aria-selected`); works without JS (select fallback).
- [ ] Masked markers: the marker text is read as is; the `EyeOff` icon is `aria-hidden`; the bubble note is plain text; sender feedback `role="status"`.
- [ ] Upload slots: the tile is a `<label>` for the file input; every state change has text (« Envoi… », « Prête », the error), not only colour/icon; slot status changes are announced (`aria-live="polite"`).
- [ ] Consent modal: native `<dialog>` + `showModal()`; focus starts on the heading; it ignores `Esc` (required step) with « Se déconnecter » as the exit. Proof images open in a new tab (no custom viewer).
- [ ] « Voir l'original »: the reason field is required (`aria-required`, error via `aria-describedby`); the revealed text is announced once (`aria-live="polite"`) and hidden again on « Masquer ».
- [ ] Read-only thread states replace the composer with text (no disabled textarea).
- [ ] Contrast: protection notices ink on `bg-brand-50` (15:1); pills from §0.1; never `text-accent` on light; destructive buttons `bg-rose-700` with white (6.2:1).
- [ ] Motion: dialogs fade/scale 150 ms (opacity, transform only); everything static with `prefers-reduced-motion`.
- [ ] FR/EN key parity for every namespace above; French spacing test; banned-words test.

---

## 12. Open items

### 12.1 For the business council / owner
1. **Dispute window N** (G6/G12) after validation — not built; « Signaler » outcomes carry no time limit in the copy until decided.
2. **Consent wording** (§10.7) and the clause (§10.8) wait for local counsel (G10/G12); version strings change when the text changes, which re-shows the modal.

### 12.2 For the Co-CTO / Backend
All earlier questions are answered (partner list RPC, brand search, note ≤ 280, screenshots for any
campaign listing WhatsApp, `self_dealing_flags.source` values). Remaining:
1. **End reason shown to the partner** on ended introductions: `admin_partner_overview` has `end_reason`, but the partner's own read of `partner_assignments` — confirm `end_reason` is readable by the partner (the ended card shows it when present, hides it otherwise).
