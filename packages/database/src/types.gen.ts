// Generated from the live Supabase schema (project oxesplxlshsdrijzckpq) via
//   supabase gen types typescript  /  Supabase MCP generate_typescript_types
// Regenerate after every migration (DATABASE-MIGRATIONS.md Part 11 §3).
//
// SDK PIN: the Supabase client is pinned to @supabase/supabase-js 2.45.4 + @supabase/ssr 0.5.2
// (see root package.json "pnpm.overrides"). That generation predates the `__InternalSupabase`
// / `PostgrestVersion` header the newer type generator emits — and leaving that header in makes
// .rpc(...) collapse to an untyped `undefined` args signature (build error). So after any
// regeneration, DELETE the top-level `__InternalSupabase: { PostgrestVersion: "..." }` block
// from `export type Database` before committing. The `DatabaseWithoutInternals` Omit below then
// becomes a harmless no-op.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agency_retainers: {
        Row: {
          bayele_cut_fcfa: number
          business_id: string
          consultant_fee_fcfa: number
          consultant_id: string
          contract_value_fcfa: number
          created_at: string
          id: string
          kpi_bonus_fcfa: number
          media_budget_fcfa: number
          sokoclick_invoice_id: string | null
          status: Database["public"]["Enums"]["retainer_status"]
        }
        Insert: {
          bayele_cut_fcfa: number
          business_id: string
          consultant_fee_fcfa: number
          consultant_id: string
          contract_value_fcfa: number
          created_at?: string
          id?: string
          kpi_bonus_fcfa?: number
          media_budget_fcfa: number
          sokoclick_invoice_id?: string | null
          status?: Database["public"]["Enums"]["retainer_status"]
        }
        Update: {
          bayele_cut_fcfa?: number
          business_id?: string
          consultant_fee_fcfa?: number
          consultant_id?: string
          contract_value_fcfa?: number
          created_at?: string
          id?: string
          kpi_bonus_fcfa?: number
          media_budget_fcfa?: number
          sokoclick_invoice_id?: string | null
          status?: Database["public"]["Enums"]["retainer_status"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_retainers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_retainers_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          billing_address: string | null
          billing_email: string | null
          company_name: string
          created_at: string
          industry: string
          is_verified: boolean
          sokoclick_customer_id: string | null
          tax_id: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_email?: string | null
          company_name: string
          created_at?: string
          industry: string
          is_verified?: boolean
          sokoclick_customer_id?: string | null
          tax_id?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_email?: string | null
          company_name?: string
          created_at?: string
          industry?: string
          is_verified?: boolean
          sokoclick_customer_id?: string | null
          tax_id?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_creators: {
        Row: {
          agreed_payout_fcfa: number
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          status: Database["public"]["Enums"]["creator_campaign_status"]
          updated_at: string
        }
        Insert: {
          agreed_payout_fcfa: number
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          status?: Database["public"]["Enums"]["creator_campaign_status"]
          updated_at?: string
        }
        Update: {
          agreed_payout_fcfa?: number
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          status?: Database["public"]["Enums"]["creator_campaign_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_creators_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_creators_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brief: string
          category: string
          content_type: string | null
          created_at: string
          creator_count_target: number
          deadline: string | null
          deliverable_quantity: number | null
          id: string
          is_public: boolean
          mandatory_tags: string | null
          match_pass_paid: boolean
          platforms: string[]
          owner_id: string
          owner_role: Database["public"]["Enums"]["user_role"]
          payout_per_creator_fcfa: number
          platform_fee_rate: number
          status: Database["public"]["Enums"]["campaign_status"]
          target_country: Database["public"]["Enums"]["country_code"]
          title: string
          total_budget_fcfa: number
          updated_at: string
        }
        Insert: {
          brief: string
          category: string
          content_type?: string | null
          created_at?: string
          creator_count_target?: number
          deadline?: string | null
          deliverable_quantity?: number | null
          id?: string
          is_public?: boolean
          mandatory_tags?: string | null
          match_pass_paid?: boolean
          platforms?: string[]
          owner_id: string
          owner_role: Database["public"]["Enums"]["user_role"]
          payout_per_creator_fcfa: number
          platform_fee_rate?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          target_country: Database["public"]["Enums"]["country_code"]
          title: string
          total_budget_fcfa: number
          updated_at?: string
        }
        Update: {
          brief?: string
          category?: string
          content_type?: string | null
          created_at?: string
          creator_count_target?: number
          deadline?: string | null
          deliverable_quantity?: number | null
          id?: string
          is_public?: boolean
          mandatory_tags?: string | null
          match_pass_paid?: boolean
          platforms?: string[]
          owner_id?: string
          owner_role?: Database["public"]["Enums"]["user_role"]
          payout_per_creator_fcfa?: number
          platform_fee_rate?: number
          status?: Database["public"]["Enums"]["campaign_status"]
          target_country?: Database["public"]["Enums"]["country_code"]
          title?: string
          total_budget_fcfa?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          business_id: string
          business_last_read_at: string | null
          context_id: string
          context_type: Database["public"]["Enums"]["conversation_context"]
          counterparty_id: string
          counterparty_last_read_at: string | null
          created_at: string
          id: string
          last_message_at: string | null
        }
        Insert: {
          business_id: string
          business_last_read_at?: string | null
          context_id: string
          context_type: Database["public"]["Enums"]["conversation_context"]
          counterparty_id: string
          counterparty_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
        }
        Update: {
          business_id?: string
          business_last_read_at?: string | null
          context_id?: string
          context_type?: Database["public"]["Enums"]["conversation_context"]
          counterparty_id?: string
          counterparty_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_counterparty_id_fkey"
            columns: ["counterparty_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultant_profiles: {
        Row: {
          agency_access: boolean
          specialties: string[]
          tax_id: string | null
          user_id: string
          years_experience: number
        }
        Insert: {
          agency_access?: boolean
          specialties?: string[]
          tax_id?: string | null
          user_id: string
          years_experience?: number
        }
        Update: {
          agency_access?: boolean
          specialties?: string[]
          tax_id?: string | null
          user_id?: string
          years_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "consultant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profiles: {
        Row: {
          audience_size: number
          categories: string[]
          is_pro: boolean
          momo_payout_phone_e164: string | null
          momo_provider: Database["public"]["Enums"]["payment_provider"] | null
          platforms: Json
          pro_expires_at: string | null
          rating_avg: number
          user_id: string
        }
        Insert: {
          audience_size?: number
          categories?: string[]
          is_pro?: boolean
          momo_payout_phone_e164?: string | null
          momo_provider?: Database["public"]["Enums"]["payment_provider"] | null
          platforms?: Json
          pro_expires_at?: string | null
          rating_avg?: number
          user_id: string
        }
        Update: {
          audience_size?: number
          categories?: string[]
          is_pro?: boolean
          momo_payout_phone_e164?: string | null
          momo_provider?: Database["public"]["Enums"]["payment_provider"] | null
          platforms?: Json
          pro_expires_at?: string | null
          rating_avg?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_audit_log: {
        Row: {
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["escrow_status"]
          id: number
          metadata: Json
          to_status: Database["public"]["Enums"]["escrow_status"]
          transaction_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          from_status: Database["public"]["Enums"]["escrow_status"]
          id?: never
          metadata?: Json
          to_status: Database["public"]["Enums"]["escrow_status"]
          transaction_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["escrow_status"]
          id?: never
          metadata?: Json
          to_status?: Database["public"]["Enums"]["escrow_status"]
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_audit_log_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "escrow_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      escrow_transactions: {
        Row: {
          amount_fcfa: number
          campaign_creator_id: string | null
          campaign_id: string
          created_at: string
          direction: string
          fee_fcfa: number
          id: string
          net_amount_fcfa: number
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          recipient_profile_id: string | null
          status: Database["public"]["Enums"]["escrow_status"]
          updated_at: string
        }
        Insert: {
          amount_fcfa: number
          campaign_creator_id?: string | null
          campaign_id: string
          created_at?: string
          direction: string
          fee_fcfa?: number
          id?: string
          net_amount_fcfa: number
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          recipient_profile_id?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Update: {
          amount_fcfa?: number
          campaign_creator_id?: string | null
          campaign_id?: string
          created_at?: string
          direction?: string
          fee_fcfa?: number
          id?: string
          net_amount_fcfa?: number
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          recipient_profile_id?: string | null
          status?: Database["public"]["Enums"]["escrow_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_campaign_creator_id_fkey"
            columns: ["campaign_creator_id"]
            isOneToOne: false
            referencedRelation: "campaign_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_fcfa: number
          business_id: string
          created_at: string
          id: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          pdf_url: string | null
          sokoclick_invoice_id: string
          sokoclick_receipt_id: string | null
          status: string
          tax_amount_fcfa: number
        }
        Insert: {
          amount_fcfa: number
          business_id: string
          created_at?: string
          id?: string
          invoice_type: Database["public"]["Enums"]["invoice_type"]
          pdf_url?: string | null
          sokoclick_invoice_id: string
          sokoclick_receipt_id?: string | null
          status?: string
          tax_amount_fcfa?: number
        }
        Update: {
          amount_fcfa?: number
          business_id?: string
          created_at?: string
          id?: string
          invoice_type?: Database["public"]["Enums"]["invoice_type"]
          pdf_url?: string | null
          sokoclick_invoice_id?: string
          sokoclick_receipt_id?: string | null
          status?: string
          tax_amount_fcfa?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          city: string
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          display_name: string
          handle: string
          id: string
          phone_e164: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          city: string
          country: Database["public"]["Enums"]["country_code"]
          created_at?: string
          display_name: string
          handle: string
          id: string
          phone_e164?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          city?: string
          country?: Database["public"]["Enums"]["country_code"]
          created_at?: string
          display_name?: string
          handle?: string
          id?: string
          phone_e164?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
        }
        Relationships: []
      }
      proof_of_post: {
        Row: {
          campaign_creator_id: string
          created_at: string
          gemini_raw_response: Json | null
          id: string
          is_valid: boolean | null
          media_sha256: string
          media_storage_path: string
          media_type: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          verification_score: number | null
        }
        Insert: {
          campaign_creator_id: string
          created_at?: string
          gemini_raw_response?: Json | null
          id?: string
          is_valid?: boolean | null
          media_sha256: string
          media_storage_path: string
          media_type: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          verification_score?: number | null
        }
        Update: {
          campaign_creator_id?: string
          created_at?: string
          gemini_raw_response?: Json | null
          id?: string
          is_valid?: boolean | null
          media_sha256?: string
          media_storage_path?: string
          media_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          verification_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proof_of_post_campaign_creator_id_fkey"
            columns: ["campaign_creator_id"]
            isOneToOne: true
            referencedRelation: "campaign_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proof_of_post_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          role?: Database["public"]["Enums"]["user_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_confirm_campaign_funding: {
        Args: {
          p_campaign_id: string
          p_provider?: Database["public"]["Enums"]["payment_provider"]
          p_sokoclick_invoice_id: string
          p_sokoclick_receipt_id?: string
        }
        Returns: string
      }
      admin_confirm_creator_payout: {
        Args: {
          p_campaign_creator_id: string
          p_disbursement_ref?: string
          p_provider?: Database["public"]["Enums"]["payment_provider"]
        }
        Returns: string
      }
      admin_confirm_retainer_funding: {
        Args: {
          p_pdf_url?: string
          p_retainer_id: string
          p_sokoclick_receipt_id?: string
        }
        Returns: undefined
      }
      admin_refund_campaign: {
        Args: {
          p_campaign_id: string
          p_reason?: string
          p_sokoclick_receipt_id?: string
        }
        Returns: string
      }
      attach_retainer_invoice: {
        Args: {
          p_retainer_id: string
          p_sokoclick_invoice_id: string
        }
        Returns: undefined
      }
      cancel_campaign: {
        Args: {
          p_campaign_id: string
        }
        Returns: undefined
      }
      propose_retainer: {
        Args: {
          p_bayele_cut: number
          p_consultant_fee: number
          p_consultant_id: string
          p_contract_value: number
          p_kpi_bonus?: number
          p_media_budget: number
        }
        Returns: string
      }
      transition_retainer: {
        Args: {
          p_retainer_id: string
          p_to_status: Database["public"]["Enums"]["retainer_status"]
        }
        Returns: undefined
      }
      apply_to_campaign: {
        Args: {
          p_campaign_id: string
        }
        Returns: string
      }
      open_conversation: {
        Args: {
          p_context_id: string
          p_context_type: Database["public"]["Enums"]["conversation_context"]
        }
        Returns: string
      }
      send_message: {
        Args: {
          p_body: string
          p_conversation_id: string
        }
        Returns: string
      }
      mark_conversation_read: {
        Args: {
          p_conversation_id: string
        }
        Returns: undefined
      }
      set_campaign_visibility: {
        Args: {
          p_campaign_id: string
          p_is_public: boolean
        }
        Returns: undefined
      }
      creator_submit_proof: {
        Args: {
          p_campaign_creator_id: string
          p_media_sha256: string
          p_media_type?: string
          p_post_url: string
        }
        Returns: string
      }
      decide_application: {
        Args: {
          p_approve: boolean
          p_campaign_creator_id: string
        }
        Returns: undefined
      }
      review_proof: {
        Args: {
          p_approve: boolean
          p_proof_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      get_my_payout_settings: {
        Args: Record<PropertyKey, never>
        Returns: {
          is_pro: boolean
          momo_payout_phone_e164: string | null
          momo_provider: Database["public"]["Enums"]["payment_provider"] | null
        }[]
      }
      handle_sokoclick_invoice_paid: {
        Args: {
          p_amount_fcfa: number
          p_business_id: string
          p_campaign_id?: string
          p_invoice_type: Database["public"]["Enums"]["invoice_type"]
          p_pdf_url: string
          p_retainer_id?: string
          p_sokoclick_invoice_id: string
          p_sokoclick_receipt_id: string
        }
        Returns: undefined
      }
      moderate_profile: {
        Args: {
          p_status: Database["public"]["Enums"]["account_status"]
          p_target: string
        }
        Returns: undefined
      }
      onboard_profile: {
        Args: {
          p_actor: string
          p_audience_size?: number
          p_avatar_url?: string
          p_billing_email?: string
          p_bio?: string
          p_categories?: string[]
          p_city: string
          p_company_name?: string
          p_country: Database["public"]["Enums"]["country_code"]
          p_display_name: string
          p_handle: string
          p_industry?: string
          p_platforms?: Json
          p_role: Database["public"]["Enums"]["user_role"]
          p_specialties?: string[]
          p_years_experience?: number
        }
        Returns: {
          avatar_url: string | null
          bio: string | null
          city: string
          country: Database["public"]["Enums"]["country_code"]
          created_at: string
          display_name: string
          handle: string
          id: string
          phone_e164: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
        }
      }
      submit_proof_of_post: {
        Args: {
          p_actor: string
          p_campaign_creator_id: string
          p_gemini_raw?: Json
          p_media_sha256: string
          p_media_storage_path: string
          p_media_type: string
          p_provider?: Database["public"]["Enums"]["payment_provider"]
          p_verification_score?: number
        }
        Returns: string
      }
      transition_escrow: {
        Args: {
          p_actor: string
          p_metadata?: Json
          p_to_status: Database["public"]["Enums"]["escrow_status"]
          p_txn_id: string
        }
        Returns: undefined
      }
      verify_proof_of_post: {
        Args: {
          p_actor: string
          p_approve: boolean
          p_proof_id: string
          p_rejection_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      account_status: "pending_review" | "active" | "suspended" | "rejected"
      campaign_status:
        | "draft"
        | "pending_funding"
        | "published"
        | "in_progress"
        | "under_review"
        | "completed"
        | "disputed"
        | "cancelled"
      conversation_context: "campaign_creator" | "retainer"
      country_code: "CM" | "GA" | "CI"
      creator_campaign_status:
        | "invited"
        | "applied"
        | "approved"
        | "rejected"
        | "content_submitted"
        | "verified"
        | "paid"
        | "disputed"
      escrow_status:
        | "pending"
        | "held"
        | "proof_pending"
        | "releasable"
        | "disputed"
        | "paid_out"
        | "refunding"
        | "refunded"
      invoice_type:
        | "match_pass"
        | "campaign_escrow"
        | "agency_retainer"
        | "pro_subscription"
      payment_provider:
        | "mtn_momo"
        | "orange_money"
        | "wave"
        | "airtel_money"
        | "bank_wire"
      retainer_status:
        | "draft"
        | "invoiced"
        | "funded"
        | "active"
        | "completed"
        | "terminated"
      user_role: "super_admin" | "creator" | "consultant" | "business"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["pending_review", "active", "suspended", "rejected"],
      conversation_context: ["campaign_creator", "retainer"],
      campaign_status: [
        "draft",
        "pending_funding",
        "published",
        "in_progress",
        "under_review",
        "completed",
        "disputed",
        "cancelled",
      ],
      country_code: ["CM", "GA", "CI"],
      creator_campaign_status: [
        "invited",
        "applied",
        "approved",
        "rejected",
        "content_submitted",
        "verified",
        "paid",
        "disputed",
      ],
      escrow_status: [
        "pending",
        "held",
        "proof_pending",
        "releasable",
        "disputed",
        "paid_out",
        "refunding",
        "refunded",
      ],
      invoice_type: [
        "match_pass",
        "campaign_escrow",
        "agency_retainer",
        "pro_subscription",
      ],
      payment_provider: [
        "mtn_momo",
        "orange_money",
        "wave",
        "airtel_money",
        "bank_wire",
      ],
      retainer_status: [
        "draft",
        "invoiced",
        "funded",
        "active",
        "completed",
        "terminated",
      ],
      user_role: ["super_admin", "creator", "consultant", "business"],
    },
  },
} as const
