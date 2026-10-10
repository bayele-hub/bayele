# Managed campaigns (« Bayele gère tout ») — council decisions, process & tracker

| | |
|---|---|
| **Feature** | Publish and run campaigns for brands that have no account and want Bayele to manage everything, including paying creators |
| **Objective** | More real, funded offers on `/campaigns` (creator sign-ups) without breaking creator trust |
| **Council** | 6 independent seats, one agent each: CEO, Growth, CFO, Legal, Creator Community, Campaign Operations (2026-10-10) |
| **Status** | 🟡 Decided, not built — waiting on owner decisions O1–O4 (§8) |

**How to use this file.** Single source of truth for managed campaigns. Track every brief in §5,
tick §9 as work lands, log changes in §10. A managed listing goes public only when every
mandatory field (§4) is filled **and** the money is in escrow.

---

## 1. Council decisions

| # | Question | Decision | Vote |
|---|---|---|---|
| M1 | Brand identity | Real brand name **only with written consent** (a screenshotted WhatsApp « OK » counts). Otherwise an honest descriptor, e.g. « Restaurant · Douala ». **Every managed listing carries a « Géré par Bayele » badge.** Listings may show different brands; they must **not** be made to look like they come from different independent publishers — Bayele is the publisher. Never invent a brand. | 6/6 |
| M2 | Intake & commitment | WhatsApp/phone brief → one-page **order form** (bon de commande) confirmed in writing: legal name or trade name, contact of record, scope, budget, fee, rights, deadline. **Nothing goes public before the money is in escrow** (provider receipt, not a screenshot). | 6/6 |
| M3 | Deposit | **100 %** for a first campaign. Returning brands above 150 000 FCFA may pay 50 % before publishing and 50 % before delivery. | Ops/Community; CEO/CFO prefer 100 % → 100 % default |
| M4 | Budget meaning & fee | The brand's stated budget is the **total**, fee included. Managed = **Agency tier, 25 %** → creators share 75 %. Stated in the order form. | 6/6 |
| M5 | Fair pay | A **pay floor per deliverable**, set by Finance + Community from real Bayele data (no invented figures). Briefs below it get a counter-offer (smaller scope or bigger budget) or are declined; **never published under the floor.** #6, #7, #9, #20 are flagged as unworkable as written. | 6/6 |
| M6 | Selection & payment | Bayele shortlists 2–3 creators per place; the brand approves on WhatsApp within **48 h** (silence → Bayele picks). **2 revision rounds** (3rd paid). Bayele QA checks against the brief; the brand has **72 h** to object, then silence = acceptance and payment is released. | 6/6 |
| M7 | Usage rights | Default: **organic use on the brand's own channels, in the campaign country, 6 months.** Paid ads, longer terms, more countries = priced extras with the creator's written agreement. Creators keep authorship and portfolio use. « #pub / #ad » disclosure on sponsored posts. Written consent from people filmed (parents for minors); music must be licensed; finance, health and real-estate claims (#5, #8, #12) must be substantiated. Local counsel to confirm country specifics (OHADA zone, NDPA, KE DPA, POPIA, ARCON/FCCPC, ASA/CPA, ASK). | 6/6 (6 vs 12 months: 6 adopted) |
| M8 | Listing standard | Adopt **BRAND → SERVICE → DELIVERABLES → DEADLINE → BUDGET → CREATOR REQUIREMENTS → APPLICATION**, plus mandatory fields in §4. The headline figure is the **creator's net pay per place**; the brand total may appear as a secondary line. | 6/6 (Ops: side by side) |
| M9 | Multi-creator / recurring | #18 = one campaign with N places, pay per place. **Recurring monthly work declined for now** (#20) → sold as one funded month, renewed by a new order. Demand logged for later. | 6/6 |
| M10 | Seeding | **Publish only confirmed + funded + above-floor briefs, 2–3 per week**, spread across sectors and countries. No unfunded listings on the board (not even « en cours de financement »). Never publish all 20 at once. | 5/6 (CFO: allow marked unfunded) |

## 2. End-to-end process (WhatsApp-first)

1. **Brief** — brand writes or sends a voice note to the Bayele WhatsApp number (or calls / an agent). Ops replies with 6 questions: what, how many, city & country, deadline, budget, rights.
2. **Draft listing** — Ops fills the standard (§4) and checks the pay floor. Under the floor → counter-offer.
3. **Order form** — sent as a short PDF or a WhatsApp message with the full terms; brand replies « OUI » (kept as proof).
4. **Payment** — Mobile Money request / payment link (MTN, Orange, Wave, M-Pesa, OPay, PalmPay) or SokoClick invoice. Admin confirms funding from the provider receipt (`admin_confirm_campaign_funding`).
5. **Publish** — admin creates the campaign as **managed** (§6): brand descriptor, « Géré par Bayele », net pay per place. It appears on `/campaigns` and in the creator alerts.
6. **Shortlist** — Bayele shortlists 2–3 per place → brand approves on WhatsApp (48 h).
7. **Delivery** — creator delivers; Bayele QA; brand has 72 h to object; up to 2 revisions.
8. **Payout** — existing escrow → Mobile Money payout to the creator; partner commission if the creator is represented.

## 3. Order-form template (FR, WhatsApp-ready)

```
BON DE COMMANDE — Campagne gérée par Bayele
Marque : ………………  (affichage public : ☐ nom réel  ☐ « {secteur} · {ville} »)
Contact : ………………  Tél. WhatsApp : ………………
Service : ………………
Livrables : ………………   Nombre de créateurs : ……
Ville / pays : ………………   Langue : ………………
Date limite de livraison : ……/……/……
Droits : usage organique sur vos réseaux, {pays}, 6 mois (publicité payante en option : ……)
Budget total : ……… FCFA, frais Bayele 25 % inclus → rémunération créateurs : ……… FCFA
Paiement : 100 % avant publication (Mobile Money / facture).
Validation : sélection sous 48 h ; 2 séries de retouches ; sans réponse sous 72 h après livraison, la livraison est acceptée.
Répondez « OUI » pour valider.
```

## 4. Listing standard — mandatory before publishing

BRAND (descriptor or consented name) · SERVICE · DELIVERABLES (counted) · **CITY & COUNTRY** · **LANGUAGE** ·
**DEADLINE** · **NET PAY PER PLACE** (FCFA) · **PLACES** · **USAGE RIGHTS** · CREATOR REQUIREMENTS ·
EQUIPMENT (if any) · FUNDED ✅ · APPLICATION (via Bayele, account required).

## 5. The 20 requests — normalised (intake tracker)

Net pay = budget × 75 % ÷ places (arithmetic only). **No brief is publishable yet:** all lack city,
deadline, rights, language and funding confirmation; floor checks pending (O1).

| # | Marque (affichage) | Service | Livrables | Budget marque | Places | Rémunération nette / créateur (après 25 %) | Profil recherché | Statut / alertes |
|---|---|---|---|---|---|---|---|---|
| 1 | FINEX SARL (nom réel — consentement écrit requis, sinon « Entreprise · produits ») | Vidéos publicitaires produit | 3 vidéos verticales courtes (FB/IG/TikTok) : scripts, tournage, montage, sous-titres | 30 000 FCFA | 1 | **22 500 FCFA** | Créateur vidéo court format, expérience contenu commercial | À confirmer : ville, date limite, droits, langue, financement |
| 2 | Marque de mode | Campagne Reels/TikTok | 8 Reels/TikToks + concepts créatifs + montage | 150 000 FCFA | 1 | **112 500 FCFA** | Créateur mode / lifestyle | À confirmer : ville, date limite, droits, langue, financement |
| 3 | Restaurant | Pack contenu food | 10 photos pro + 5 vidéos courtes du menu | 70 000 FCFA | 1 | **52 500 FCFA** | Photographe / vidéaste food | À confirmer : ville, date limite, droits, langue, financement |
| 4 | Marque beauté | Vidéos UGC | 5 vidéos UGC authentiques : démonstration, voix off, face caméra | 50 000 FCFA | 1 | **37 500 FCFA** | Créateur beauté / lifestyle | À confirmer : ville, date limite, droits, langue, financement |
| 5 | Agence immobilière | Visites vidéo de biens | 4 vidéos de visite : tournage, montage, sous-titres, formats verticaux | 80 000 FCFA | 1 | **60 000 FCFA** | Vidéaste immobilier / lifestyle | À confirmer : ville, date limite, droits, langue, financement · Allégations immobilières à justifier |
| 6 | Startup tech | Vidéos explicatives animées | 3 vidéos animées : script, voix off, animation, montage | 30 000 FCFA | 1 | **22 500 FCFA** | Motion designer / créateur explicatif | À confirmer : ville, date limite, droits, langue, financement · ⚠️ Sous le seuil probable — contre-proposition |
| 7 | Restaurant | Pack contenu mensuel | 12 posts, 8 Reels, 20 Stories + calendrier éditorial (1 mois) | 20 000 FCFA | 1 | **15 000 FCFA** | Social media / créateur food | À confirmer : ville, date limite, droits, langue, financement · ⚠️ Sous le seuil probable — contre-proposition |
| 8 | Fintech | Vidéos pédagogiques | 6 vidéos expliquant les services en langage simple | 50 000 FCFA | 1 | **37 500 FCFA** | Présentateur à l'aise avec la finance | À confirmer : ville, date limite, droits, langue, financement · Allégations financières à justifier |
| 9 | Hôtel | Shooting d'une journée | 30 photos retouchées + 8 vidéos courtes (chambres, services, restauration, clients) | 40 000 FCFA | 1 | **30 000 FCFA** | Photographe / vidéaste | À confirmer : ville, date limite, droits, langue, financement · ⚠️ Sous le seuil probable — contre-proposition |
| 10 | Boutique en ligne | Démonstrations produit | 10 vidéos de démonstration (site + publicités) | 50 000 FCFA | 1 | **37 500 FCFA** | Créateur démo produit / UGC | À confirmer : ville, date limite, droits, langue, financement · Droits publicité payante à chiffrer |
| 11 | ONG | Récits d'impact | 3 vidéos documentaires : interviews, tournage, narration, montage | 70 000 FCFA | 1 | **52 500 FCFA** | Créateur documentaire | À confirmer : ville, date limite, droits, langue, financement · Consentement écrit des personnes filmées (mineurs : parents) |
| 12 | Marque fitness | Campagne créateur fitness | 12 vidéos courtes entraînement + intégration produit (IG/TikTok) | 155 000 FCFA | 1 | **116 250 FCFA** | Créateur fitness | À confirmer : ville, date limite, droits, langue, financement · Allégations santé à justifier |
| 13 | Agrobusiness | De la ferme au marché | 5 vidéos courtes : opérations, produits, production | 60 000 FCFA | 1 | **45 000 FCFA** | Vidéaste | À confirmer : ville, date limite, droits, langue, financement |
| 14 | Startup éducation | Promotion de formations | 5 vidéos promotionnelles (présentateur) | 50 000 FCFA | 1 | **37 500 FCFA** | Présentateur / créateur éducation | À confirmer : ville, date limite, droits, langue, financement |
| 15 | Créateur de mode | Shooting lancement de collection | Photos lookbook + 5 Reels + coulisses | 70 000 FCFA | 1 | **52 500 FCFA** | Photographe + vidéaste (1 ou 2 profils, à confirmer) | À confirmer : ville, date limite, droits, langue, financement · Nombre de places à confirmer |
| 16 | Application mobile | Tutoriels d'application | 6 vidéos tutoriels courtes | 50 000 FCFA | 1 | **37 500 FCFA** | Créateur tech / tutoriel | À confirmer : ville, date limite, droits, langue, financement |
| 17 | PME | Film « histoire du fondateur » | Film de 2–3 min : interview, B-roll, montage, sous-titres + déclinaisons réseaux | 120 000 FCFA | 1 | **90 000 FCFA** | Réalisateur / vidéaste | À confirmer : ville, date limite, droits, langue, financement |
| 18 | Marque grande consommation | Campagne micro-influenceurs | Par créateur : 2 vidéos + Stories ; droit de réutilisation par la marque | 100 000 FCFA | 5 | **15 000 FCFA** | Micro-créateurs | À confirmer : ville, date limite, droits, langue, financement · Droits de réutilisation à préciser (durée, payant ?) |
| 19 | Cabinet de conseil | Contenu LinkedIn | 8 posts d'expertise + 4 vidéos professionnelles avec les experts | 70 000 FCFA | 1 | **52 500 FCFA** | Créateur LinkedIn / B2B | À confirmer : ville, date limite, droits, langue, financement |
| 20 | Enseigne de distribution | Campagne UGC (1 mois) | Par créateur : 4 vidéos (avis, témoignages, problème/solution, offres) — droits commerciaux | 50 000 FCFA | 3 | **12 500 FCFA** | Créateurs UGC | À confirmer : ville, date limite, droits, langue, financement · ⚠️ Récurrent refusé pour l'instant → 1 mois ; sous le seuil probable |
Total stated budgets: 1 365 000 FCFA across 20 briefs.

## 6. Engineering plan (to build after O1–O4)

**Database (one migration, additive)**
- `campaigns`: `is_managed boolean default false`, `brand_label text` (public descriptor or consented name), `brand_city text`, `language text`, `usage_rights text`, `creator_requirements text`, `equipment text`; check: managed ⇒ brand_label, city, language, rights, deadline set.
- `public_campaign_board` / `public_campaign_stats`: return `brand_label` instead of the owner profile name when `is_managed`, plus `is_managed`, `brand_city`.
- Internal (admin-only) `managed_briefs` table for the intake tracker: brand contact, order-form proof, deposit status, floor check, linked campaign.

**Web**
- Admin « Nouvelle campagne gérée » form (owner = Bayele admin, Agency tier 25 %, net-pay preview, mandatory-field checklist, funded gate).
- « Géré par Bayele » badge on cards and campaign pages; brand line shows the descriptor.
- « Publiez par WhatsApp » CTA for brands (home, `/campaigns`, brand sign-up) opening a prefilled chat.
- Industry templates (restaurant, mode, beauté, immobilier, fintech, hôtel…) prefilled in the admin form and the brand form.
- The brand self-serve form trimmed to 6 required fields; the rest optional with defaults.
- Fix seen on the live site: in EN, the brief box « Ce qui est attendu » and the apply notice are still French (QA D9 leftover); on Windows the flag emoji renders as « CM » letters — show the country name only there.

## 7. Making publishing easy for non-tech SMEs (Operations + Growth seats)

| Rank | Lever | Why it works here | Watch |
|---|---|---|---|
| 1 | **Brief desk** — Bayele staff turn any brief (text, voice note, call) into the standard listing and send a preview to approve | SMEs trust a person on WhatsApp more than a form; no new software | Minutes per listing; cap volume |
| 2 | **WhatsApp-first intake** — one number, 6 quick-reply questions, voice notes accepted | WhatsApp is the business channel in Douala, Abidjan, Lagos, Nairobi | Chat → approved-listing rate; a human checks every draft (FR/EN/Pidgin/Swahili) |
| 3 | **Pay-by-Mobile-Money link** sent with the preview | Brands already pay this way daily; replaces the escrow screen | Deposit conversion; confirm from provider receipts only |
| 4 | **6 required fields** (what, how many, city/country, deadline, budget, rights); Bayele fills the rest | The 20 briefs always state deliverables + budget, almost never deadline or rights | Complete-on-first-try rate |
| 5 | **Industry templates** with real sample listings | Most briefs repeat a few patterns | No prices until real data exists |
| 6 | **Agents & partners** (agencies, accountants, business associations) refer briefs | Trust travels person to person | Funded campaigns per partner; agents never take cash or set prices |

Plus trust signals for first-time brands: plain-words escrow explainer (« le créateur n'est payé qu'après votre validation »), a named WhatsApp contact, real payment confirmations only.

## 8. Owner decisions needed

- **O1** Pay floor per deliverable (photo, short video, explainer/animation, shoot day, LinkedIn post) — Finance + Community to propose from real data; the council will not invent it.
- **O2** Which of the 20 briefs are confirmed by the brand and paid? Only those can be published (M10).
- **O3** Written consent to name FINEX SARL (#1); otherwise « Entreprise · produits ».
- **O4** Referral reward for **agents/partners who bring brands** (Growth seat suggests one, paid only once the campaign is funded). This is separate from council decision C3 (no reward for creator referrals) and needs your call.

## 9. Tracker

### Decisions
- [x] M1–M10 council decisions (2026-10-10)
- [ ] O1 pay floor  - [ ] O2 confirmed/paid briefs  - [ ] O3 FINEX consent  - [ ] O4 agent referral reward

### Operations (no code)
- [ ] WhatsApp Business number + 6-question script
- [ ] Order-form PDF (FR/EN) from §3
- [ ] Mobile Money collection set-up per country
- [ ] Contact the 20 brands: fill §5 gaps, counter-offers for #6, #7, #9, #20

### Build
- [ ] Migration: managed fields + board/stats changes + `managed_briefs`
- [ ] Admin managed-campaign form + funded gate
- [ ] « Géré par Bayele » badge + brand descriptor on board and campaign page
- [ ] « Publiez par WhatsApp » CTA
- [ ] Industry templates; brand form trimmed to 6 required fields
- [ ] EN leftovers on `/campaigns/[id]`; flag fallback on Windows
- [ ] QA + release

## 10. Changelog

| Date | Change |
|---|---|
| 2026-10-10 | Council (6 seats) decided M1–M10; Operations + Growth seats ranked easy-publishing levers; 20 briefs normalised; owner decisions O1–O4 opened. |
