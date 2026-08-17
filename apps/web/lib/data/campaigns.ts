// Campaign tiers & money math. The platform fee is set ONCE at creation by tier (invariant §9)
// and read at funding time. Fee rates match the valid_fee_rate CHECK: {0.10, 0.15, 0.25}.

export const TIERS = [
  { id: 'spark', label: 'Spark', rate: 0.1, blurb: 'Auto-service · petites campagnes' },
  { id: 'managed', label: 'Managed', rate: 0.15, blurb: 'Accompagnement standard' },
  { id: 'agency', label: 'Agency', rate: 0.25, blurb: 'Gestion agence complète' },
] as const;

export type TierId = (typeof TIERS)[number]['id'];

export function feeRateForTier(t: string): number {
  return TIERS.find((x) => x.id === t)?.rate ?? 0.1;
}

/**
 * Gross up the budget so the creator pool (net, after the platform fee) still covers
 * payout × count. The business funds `total`; Bayele keeps `fee`; creators share `pool`.
 */
export function computeBudget(payout: number, count: number, rate: number) {
  const pool = Math.max(0, Math.round(payout)) * Math.max(0, Math.round(count));
  const total = rate < 1 ? Math.ceil(pool / (1 - rate)) : pool;
  const fee = total - pool;
  return { pool, total, fee };
}

export function fmtFcfa(n: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(Math.round(n || 0))} FCFA`;
}

export const CAMPAIGN_STATUS_FR: Record<string, string> = {
  draft: 'Brouillon — à financer',
  pending_funding: 'En attente de paiement',
  published: 'Publiée — séquestre actif',
  in_progress: 'En cours',
  under_review: 'En revue',
  completed: 'Terminée',
  disputed: 'Litige',
  cancelled: 'Annulée',
};

// Per-creator assignment lifecycle (campaign_creators.status), creator-facing wording.
export const CREATOR_STATUS_FR: Record<string, string> = {
  invited: 'Invité',
  applied: 'Candidature envoyée',
  approved: 'Accepté — à publier',
  rejected: 'Non retenu',
  content_submitted: 'Preuve en cours de revue',
  verified: 'Validé — paiement en préparation',
  paid: 'Payé ✅',
  disputed: 'Litige',
};

// Escrow ledger status, participant-facing wording.
export const ESCROW_STATUS_FR: Record<string, string> = {
  pending: 'En attente',
  held: 'Sous séquestre',
  proof_pending: 'Preuve en revue',
  releasable: 'Prêt à décaisser',
  disputed: 'Litige',
  paid_out: 'Décaissé',
  refunding: 'Remboursement',
  refunded: 'Remboursé',
};

// Mobile Money / disbursement rails (matches the payment_provider enum).
export const PROVIDERS = [
  { id: 'mtn_momo', label: 'MTN MoMo' },
  { id: 'orange_money', label: 'Orange Money' },
  { id: 'wave', label: 'Wave' },
  { id: 'airtel_money', label: 'Airtel Money' },
  { id: 'bank_wire', label: 'Virement' },
] as const;
