// PLACEHOLDER — regenerate from the live schema with:
//   pnpm db:types   (supabase gen types typescript --local)
// Do not hand-edit. Until generated, this keeps the workspace type-checking.
export type Database = {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>;
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>;
    Enums: {
      user_role: 'super_admin' | 'creator' | 'consultant' | 'business';
      account_status: 'pending_review' | 'active' | 'suspended' | 'rejected';
      country_code: 'CM' | 'GA' | 'CI';
      escrow_status:
        | 'pending' | 'held' | 'proof_pending' | 'releasable'
        | 'disputed' | 'paid_out' | 'refunding' | 'refunded';
    };
  };
};
