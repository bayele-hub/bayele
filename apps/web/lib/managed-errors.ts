// Contract error codes (briefs/BACKEND-CONTRACT-MANAGED.md §6) → user-facing copy, French first.
// An RPC error arrives as error.message === '<code>' with optional context in error.details; a
// CHECK violation is a Postgres 23514 whose message names the constraint.

import type { Locale } from '@/i18n/config';

export const MANAGED_ERROR_CODES = [
  'not_authorized', 'brief_not_found', 'already_published', 'brief_declined', 'order_not_confirmed',
  'missing_fields', 'deadline_passed', 'invalid_budget', 'below_pay_floor', 'invalid_status', 'invalid_amount',
  'brief_locked', 'claims_not_verified', 'campaign_already_funded', 'invalid_reason',
] as const;
export type ManagedErrorCode = (typeof MANAGED_ERROR_CODES)[number];

type Copy = Record<Locale, string>;

const CODES: Record<ManagedErrorCode, Copy> = {
  not_authorized: { fr: 'Action réservée aux administrateurs Bayele.', en: 'Bayele admins only.' },
  brief_not_found: { fr: 'Brief introuvable\u00a0: il a peut-être été supprimé.', en: 'Brief not found.' },
  already_published: { fr: 'Ce brief a déjà une campagne en cours.', en: 'This brief already has a live campaign.' },
  brief_declined: { fr: 'Ce brief est refusé\u00a0: rouvrez-le avant de publier.', en: 'This brief is declined: reopen it before publishing.' },
  order_not_confirmed: { fr: 'Enregistrez d’abord le « OUI » de la marque.', en: 'Record the brand\'s "YES" first.' },
  missing_fields: { fr: 'Champ manquant : {fields}.', en: 'Missing field: {fields}.' },
  deadline_passed: { fr: 'La date limite est passée : choisissez une nouvelle date.', en: 'The deadline has passed: pick a new date.' },
  invalid_budget: { fr: 'Le budget ne permet pas de payer chaque place (au moins 1 FCFA net).', en: 'The budget cannot pay each spot (at least 1 FCFA net).' },
  below_pay_floor: { fr: 'Sous le seuil de rémunération : envoyez une contre-proposition.', en: 'Below the pay floor: send a counter-offer.' },
  invalid_status: { fr: 'Ce statut ne peut pas être choisi à la main.', en: 'This status cannot be set manually.' },
  invalid_amount: { fr: 'Saisissez un montant supérieur à 0.', en: 'Enter an amount above 0.' },
  brief_locked: {
    fr: 'L’annonce est créée : ces champs ne peuvent plus changer ({fields}). Refusez le brief puis dupliquez-le pour les modifier.',
    en: 'The listing has been created: these fields can no longer change ({fields}). Decline the brief, then duplicate it to edit them.',
  },
  claims_not_verified: {
    fr: 'Catégorie sensible : cochez « Allégations vérifiées » après avoir vérifié les justificatifs.',
    en: 'Sensitive category: tick "Claims verified" once the evidence has been checked.',
  },
  campaign_already_funded: {
    fr: 'La campagne est déjà financée : remboursez-la d’abord depuis le séquestre.',
    en: 'The campaign is already funded: refund it from escrow first.',
  },
  invalid_reason: { fr: 'Le motif est trop long (500 caractères maximum).', en: 'The reason is too long (500 characters max).' },
};

/** DB field names (missing_fields / brief_locked details) → readable labels. */
const FIELDS: Record<string, Copy> = {
  brand_label: { fr: 'Libellé public', en: 'Public label' },
  brand_consent_proof: { fr: 'Preuve du consentement', en: 'Consent proof' },
  brand_name: { fr: 'Nom de la marque', en: 'Brand name' },
  brand_consent: { fr: 'Consentement', en: 'Consent' },
  title: { fr: 'Service', en: 'Service' },
  service: { fr: 'Service', en: 'Service' },
  deliverables: { fr: 'Détail des livrables', en: 'Deliverables detail' },
  deliverable_type: { fr: 'Livrable principal', en: 'Main deliverable' },
  deliverable_count: { fr: 'Unités par place', en: 'Units per spot' },
  category: { fr: 'Catégorie', en: 'Category' },
  sector: { fr: 'Secteur', en: 'Sector' },
  country: { fr: 'Pays', en: 'Country' },
  city: { fr: 'Ville', en: 'City' },
  language: { fr: 'Langue', en: 'Language' },
  usage_rights: { fr: 'Droits d’usage', en: 'Usage rights' },
  deadline: { fr: 'Date limite', en: 'Deadline' },
  total_budget_fcfa: { fr: 'Budget total', en: 'Total budget' },
  places: { fr: 'Places', en: 'Spots' },
  platforms: { fr: 'Plateformes', en: 'Platforms' },
  content_type: { fr: 'Livrable principal', en: 'Main deliverable' },
  creator_requirements: { fr: 'Profil recherché', en: 'Creator profile' },
  equipment: { fr: 'Matériel', en: 'Equipment' },
  claims_verified: { fr: 'Allégations vérifiées', en: 'Claims verified' },
};

const CHECKS: Record<string, Copy> = {
  managed_briefs_whatsapp_e164: { fr: 'Numéro WhatsApp invalide : format international, ex. +237690000000.', en: 'Invalid WhatsApp number: international format, e.g. +237690000000.' },
  managed_briefs_counts: { fr: 'Places et unités : entre 1 et 1000.', en: 'Spots and units: between 1 and 1000.' },
  managed_briefs_budget_positive: { fr: 'Le budget total doit être supérieur à 0.', en: 'The total budget must be above 0.' },
  managed_briefs_deposit_status: { fr: 'Statut d’acompte invalide.', en: 'Invalid deposit status.' },
  managed_briefs_status: { fr: 'Statut invalide.', en: 'Invalid status.' },
  managed_briefs_text_lengths: { fr: 'Un texte dépasse la longueur autorisée.', en: 'A text is longer than allowed.' },
};

const GENERIC: Copy = { fr: 'L’opération a échoué. Réessayez.', en: 'Something went wrong. Try again.' };

export function fieldLabels(details: string | null | undefined, locale: Locale): string {
  return (details ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => FIELDS[f]?.[locale] ?? f)
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(', ');
}

export interface RpcErrorLike {
  message?: string | null;
  details?: string | null;
  code?: string | null;
}

/** Every contract code, CHECK constraint and enum error mapped to copy; anything else → generic. */
export function managedErrorMessage(err: RpcErrorLike | null | undefined, locale: Locale = 'fr', fallback?: string): string {
  const msg = (err?.message ?? '').trim();
  if ((MANAGED_ERROR_CODES as readonly string[]).includes(msg)) {
    const copy = CODES[msg as ManagedErrorCode][locale];
    return copy.replace('{fields}', fieldLabels(err?.details, locale) || '—');
  }
  const check = Object.keys(CHECKS).find((k) => msg.includes(k));
  if (check) return CHECKS[check]![locale];
  if (/invalid input value for enum/i.test(msg)) return locale === 'fr' ? 'Valeur invalide dans le formulaire.' : 'Invalid value in the form.';
  return fallback ?? GENERIC[locale];
}

/** below_pay_floor details « net_per_unit=<n> floor=<n> » → numbers (null when absent). */
export function parseFloorDetails(details: string | null | undefined): { netPerUnit: number; floor: number } | null {
  const m = /net_per_unit=(\d+)\s+floor=(\d+)/.exec(details ?? '');
  return m ? { netPerUnit: Number(m[1]), floor: Number(m[2]) } : null;
}
