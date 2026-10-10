// Order form (bon de commande, plan §3) and WhatsApp nudges for a managed brief. The text follows the
// BRAND's language (FR/EN toggle in the editor), not the admin UI locale, so both versions live here
// rather than in the dictionaries. The plan §3 template is used verbatim; only the blanks are filled
// (design §2.9.1). Blanks with no value stay « …… ».

import type { Locale } from '@/i18n/config';
import { formatFcfa } from '@/i18n/format';
import { countryName } from '@/lib/countries';
import { deliverableCount, languageLabel, managedNetPreview, type DeliverableType } from '@/lib/managed-listing';

export interface OrderFormInput {
  brandName: string;
  brandLabel: string;
  brandConsent: boolean;
  city: string;
  country: string;
  contactName: string;
  contactWhatsapp: string;
  title: string; // service or listing title
  deliverableType: DeliverableType | '';
  deliverableCount: number | null;
  deliverables: string;
  places: number | null;
  language: string;
  deadline: string; // YYYY-MM-DD
  rightsText: string;
  totalBudget: number | null;
}

const NB = ' ';
const BLANK = '………………';
const v = (s: string | null | undefined, blank = BLANK) => (s ?? '').trim() || blank;

/** « 28/10/2026 » (both languages, as on the paper form). */
export function ddmmyyyy(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '……/……/……';
}

function firstSentence(s: string): string {
  const t = s.trim().replace(/\s+/g, ' ');
  const m = /^(.+?[.;!?])(\s|$)/.exec(t);
  return (m ? m[1]! : t).replace(/[.;]$/, '');
}

export function orderFormText(b: OrderFormInput, lang: Locale): string {
  const fr = lang === 'fr';
  const sep = fr ? `${NB}:` : ':';
  const label = [b.brandLabel.trim(), b.city.trim()].filter(Boolean).join(' · ');
  const display = b.brandConsent
    ? fr ? '☑ nom réel  ☐ «…»' : '☑ real name  ☐ "…"'
    : fr ? `☐ nom réel  ☑ «${NB}${v(label, '…')}${NB}»` : `☐ real name  ☑ "${v(label, '…')}"`;
  const units =
    b.deliverableType && b.deliverableCount
      ? fr
        ? `${deliverableCount(b.deliverableType, b.deliverableCount, 'fr')} par créateur`
        : `${deliverableCount(b.deliverableType, b.deliverableCount, 'en')} per creator`
      : '';
  const detail = b.deliverables.trim() ? firstSentence(b.deliverables) : '';
  const deliverables = [units, detail].filter(Boolean).join(' — ');
  const place = [b.city.trim(), b.country ? countryName(b.country, lang) : ''].filter(Boolean).join(', ');
  const net = managedNetPreview(b.totalBudget, b.places ?? 1, b.deliverableCount ?? 1);
  const total = net ? formatFcfa(net.totalFcfa, lang) : `……… FCFA`;
  const pool = net ? formatFcfa(net.poolFcfa, lang) : `……… FCFA`;
  const perCreator =
    net && (b.places ?? 1) > 1 ? (fr ? ` (soit ${formatFcfa(net.netPerPlaceFcfa, 'fr')} par créateur)` : ` (i.e. ${formatFcfa(net.netPerPlaceFcfa, 'en')} per creator)`) : '';
  const phone = b.contactWhatsapp.trim();

  if (fr) {
    return [
      'BON DE COMMANDE — Campagne gérée par Bayele',
      `Marque${sep} ${v(b.brandName)}  (affichage public${sep} ${display})`,
      `Contact${sep} ${v(b.contactName)}  Tél. WhatsApp${sep} ${v(phone)}`,
      `Service${sep} ${v(b.title)}`,
      `Livrables${sep} ${v(deliverables)}   Nombre de créateurs${sep} ${b.places ?? '……'}`,
      `Ville / pays${sep} ${v(place)}   Langue${sep} ${v(languageLabel(b.language, 'fr'))}`,
      `Date limite de livraison${sep} ${ddmmyyyy(b.deadline)}`,
      `Droits${sep} ${v(b.rightsText)}`,
      `Budget total${sep} ${total}, frais Bayele 25${' '}% inclus → rémunération créateurs${sep} ${pool}${perCreator}`,
      `Paiement${sep} 100${' '}% avant publication (Mobile Money / facture).`,
      `Validation${sep} sélection sous 48 h${' '}; 2 séries de retouches${' '}; sans réponse sous 72 h après livraison, la livraison est acceptée.`,
      `Répondez «${NB}OUI${NB}» pour valider.`,
    ].join('\n');
  }
  return [
    'ORDER FORM — Campaign managed by Bayele',
    `Brand: ${v(b.brandName)}  (public display: ${display})`,
    `Contact: ${v(b.contactName)}  WhatsApp: ${v(phone)}`,
    `Service: ${v(b.title)}`,
    `Deliverables: ${v(deliverables)}   Number of creators: ${b.places ?? '……'}`,
    `City / country: ${v(place)}   Language: ${v(languageLabel(b.language, 'en'))}`,
    `Delivery deadline: ${ddmmyyyy(b.deadline)}`,
    `Rights: ${v(b.rightsText)}`,
    `Total budget: ${total}, 25% Bayele fee included → creator pay: ${pool}${perCreator}`,
    'Payment: 100% before publishing (Mobile Money / invoice).',
    'Approval: shortlist within 48 h; 2 revision rounds; no reply within 72 h after delivery = delivery accepted.',
    'Reply "YES" to confirm.',
  ].join('\n');
}

export type NudgeKind = 'order' | 'payment' | 'counterOffer';

export interface NudgeVars {
  contact: string;
  service: string;
  total?: string;
  net?: string;
  qty?: string;
}

const NUDGES: Record<NudgeKind, Record<Locale, string>> = {
  order: {
    fr: `Bonjour {contact}, petit rappel${NB}: votre bon de commande Bayele pour «${NB}{service}${NB}» attend votre «${NB}OUI${NB}». Répondez OUI pour valider, ou dites-nous ce qu’il faut changer.`,
    en: 'Hello {contact}, a quick reminder: your Bayele order form for "{service}" is waiting for your "YES". Reply YES to confirm, or tell us what to change.',
  },
  payment: {
    fr: `Bonjour {contact}, merci pour votre OUI. Votre campagne «${NB}{service}${NB}» sera publiée dès réception du paiement de {total}. Le budget reste sous séquestre${NB}: le créateur n’est payé qu’après votre validation.`,
    en: 'Hello {contact}, thanks for your YES. Your campaign "{service}" goes live as soon as we receive the payment of {total}. The budget stays in escrow: the creator is only paid after you approve.',
  },
  counterOffer: {
    fr: `Bonjour {contact}, pour «${NB}{service}${NB}», le budget actuel donne {net} par créateur, en dessous du minimum que Bayele applique pour ce type de contenu. Deux options${NB}: un budget total de {total} pour le même travail, ou {qty} pour le budget actuel. Laquelle vous convient${' '}?`,
    en: 'Hello {contact}, for "{service}", the current budget gives {net} per creator, below the minimum Bayele applies for this type of content. Two options: a total budget of {total} for the same work, or {qty} for the current budget. Which suits you?',
  },
};

export function nudgeText(kind: NudgeKind, lang: Locale, vars: NudgeVars): string {
  const all: Record<string, string> = { total: '', net: '', qty: '', ...vars };
  return NUDGES[kind][lang].replace(/\{(\w+)\}/g, (m, k: string) => (k in all ? all[k]! : m)).replace(/ ,/g, ',').replace(/\s{2,}/g, ' ');
}
