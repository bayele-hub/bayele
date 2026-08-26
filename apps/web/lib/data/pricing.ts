// Central pricing config.
//
// The COMMISSION tiers are the LIVE model — their rates come from lib/data/campaigns (TIERS), the
// single source of truth enforced by the valid_fee_rate DB check, so the marketing page can never
// drift from what the product actually charges.
//
// Pro plans, the match-pass fee and Spotlight are PROPOSED revenue lines: modelled in the schema
// (invoice_type = 'pro_subscription' | 'match_pass') but not yet purchasable. The pricing page renders
// them as "Bientôt" with no checkout, so we never advertise a flow that doesn't exist. Adjust the
// amounts here — they are launch proposals, not final prices.

import { TIERS, type TierId } from '@/lib/data/campaigns';

export type PricingStatus = 'live' | 'coming_soon';

/** Marketing copy per commission tier, keyed to the real TIERS (rate + label come from there). */
export const TIER_COPY: Record<TierId, { tagline: string; features: string[]; footnote: string; featured?: boolean }> = {
  spark: {
    tagline: 'Auto-service, petites campagnes lancées seul.',
    features: ['Séquestre Mobile Money inclus', 'Vérification proof-of-post', 'Facture OHADA générée', 'Paiement créateur automatique'],
    footnote: 'Idéal pour un budget < 500 000 FCFA',
  },
  managed: {
    tagline: 'Accompagnement standard sur la mise en place.',
    features: ['Tout Spark, plus :', 'Aide au brief & au ciblage', 'Sélection assistée des créateurs', 'Suivi de campagne prioritaire'],
    footnote: 'Le meilleur rapport accompagnement / coût',
    featured: true,
  },
  agency: {
    tagline: 'Gestion agence complète, clé en main.',
    features: ['Tout Managed, plus :', 'Consultant dédié (rétainer)', 'Production & média gérés', 'Reporting de performance'],
    footnote: 'Contrats via rétainer agence',
  },
};

/** Commission tiers in display order, joined to their live rate. */
export const COMMISSION_TIERS = TIERS.map((tier) => ({ ...tier, ...TIER_COPY[tier.id] }));

export interface ProPlan {
  id: string;
  name: string;
  audience: string;
  blurb: string;
  priceMonthlyFcfa: number;
  priceYearlyFcfa: number;
  features: string[];
}

export const PRO_PLANS: ProPlan[] = [
  {
    id: 'pro_brand',
    name: 'Pro Marques',
    audience: 'Marques',
    blurb: 'Pour les marques qui lancent régulièrement.',
    priceMonthlyFcfa: 25_000,
    priceYearlyFcfa: 250_000,
    features: [
      'Commission réduite : service Managed au taux Spark (10 %)',
      'Campagnes privées illimitées',
      'Badge « Marque vérifiée Pro »',
      'Analytique de campagne avancée',
      'Modération & support prioritaires',
    ],
  },
  {
    id: 'pro_talent',
    name: 'Pro Créateurs & Consultants',
    audience: 'Créateurs & Consultants',
    blurb: "Pour se démarquer dans l'annuaire.",
    priceMonthlyFcfa: 5_000,
    priceYearlyFcfa: 50_000,
    features: [
      "Placement prioritaire dans l'annuaire",
      'Badge « Pro » sur le profil',
      'Accès anticipé aux campagnes publiques',
      "Portfolio enrichi & statistiques d'audience",
      'Seuil de retrait abaissé',
    ],
  },
];

/** One-off "mise en relation" fee (invoice_type = 'match_pass'). Proposed. */
export const MATCH_PASS_FCFA = 2_500;

/** Optional paid visibility boost — proposed. Verification itself always stays free. */
export const SPOTLIGHT_WEEKLY_FCFA = 10_000;
