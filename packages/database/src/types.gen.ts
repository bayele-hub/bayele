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
      campaign_alerts: {
        Row: {
          category: string | null
          country: Database["public"]["Enums"]["country_code"] | null
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          category?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          category?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_creators: {
        Row: {
          agreed_payout_fcfa: number
          applied_by: string | null
          campaign_id: string
          created_at: string
          creator_id: string
          id: string
          partner_commission_rate: number | null
          partner_id: string | null
          status: Database["public"]["Enums"]["creator_campaign_status"]
          updated_at: string
        }
        Insert: {
          agreed_payout_fcfa: number
          applied_by?: string | null
          campaign_id: string
          created_at?: string
          creator_id: string
          id?: string
          partner_commission_rate?: number | null
          partner_id?: string | null
          status?: Database["public"]["Enums"]["creator_campaign_status"]
          updated_at?: string
        }
        Update: {
          agreed_payout_fcfa?: number
          applied_by?: string | null
          campaign_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          partner_commission_rate?: number | null
          partner_id?: string | null
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
          {
            foreignKeyName: "campaign_creators_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_creators_applied_by_fkey"
            columns: ["applied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_city: string | null
          brand_consent: boolean
          brand_label: string | null
          brief: string
          category: string
          claims_verified: boolean
          content_type: string | null
          created_at: string
          creator_count_target: number
          creator_requirements: string | null
          deadline: string | null
          deliverable_quantity: number | null
          equipment: string | null
          id: string
          is_managed: boolean
          is_public: boolean
          language: string | null
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
          usage_rights: string | null
          updated_at: string
        }
        Insert: {
          brand_city?: string | null
          brand_consent?: boolean
          brand_label?: string | null
          brief: string
          category: string
          claims_verified?: boolean
          content_type?: string | null
          created_at?: string
          creator_count_target?: number
          creator_requirements?: string | null
          deadline?: string | null
          deliverable_quantity?: number | null
          equipment?: string | null
          id?: string
          is_managed?: boolean
          is_public?: boolean
          language?: string | null
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
          usage_rights?: string | null
          updated_at?: string
        }
        Update: {
          brand_city?: string | null
          brand_consent?: boolean
          brand_label?: string | null
          brief?: string
          category?: string
          claims_verified?: boolean
          content_type?: string | null
          created_at?: string
          creator_count_target?: number
          creator_requirements?: string | null
          deadline?: string | null
          deliverable_quantity?: number | null
          equipment?: string | null
          id?: string
          is_managed?: boolean
          is_public?: boolean
          language?: string | null
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
          usage_rights?: string | null
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
          business_muted: boolean
          context_id: string
          context_type: Database["public"]["Enums"]["conversation_context"]
          counterparty_id: string
          counterparty_last_read_at: string | null
          counterparty_muted: boolean
          created_at: string
          id: string
          last_message_at: string | null
        }
        Insert: {
          business_id: string
          business_last_read_at?: string | null
          business_muted?: boolean
          context_id: string
          context_type: Database["public"]["Enums"]["conversation_context"]
          counterparty_id: string
          counterparty_last_read_at?: string | null
          counterparty_muted?: boolean
          created_at?: string
          id?: string
          last_message_at?: string | null
        }
        Update: {
          business_id?: string
          business_last_read_at?: string | null
          business_muted?: boolean
          context_id?: string
          context_type?: Database["public"]["Enums"]["conversation_context"]
          counterparty_id?: string
          counterparty_last_read_at?: string | null
          counterparty_muted?: boolean
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
          momo_payout_phone_e164: string | null
          momo_provider: Database["public"]["Enums"]["payment_provider"] | null
          specialties: string[]
          tax_id: string | null
          user_id: string
          years_experience: number
        }
        Insert: {
          agency_access?: boolean
          momo_payout_phone_e164?: string | null
          momo_provider?: Database["public"]["Enums"]["payment_provider"] | null
          specialties?: string[]
          tax_id?: string | null
          user_id: string
          years_experience?: number
        }
        Update: {
          agency_access?: boolean
          momo_payout_phone_e164?: string | null
          momo_provider?: Database["public"]["Enums"]["payment_provider"] | null
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
      founder_creators: {
        Row: {
          awarded_at: string
          founder_number: number
          user_id: string
        }
        Insert: {
          awarded_at?: string
          founder_number: number
          user_id: string
        }
        Update: {
          awarded_at?: string
          founder_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "founder_creators_user_id_fkey"
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
      managed_briefs: {
        Row: {
          brand_consent: boolean
          brand_consent_proof: string | null
          brand_label: string | null
          brand_name: string
          campaign_id: string | null
          category: string | null
          city: string | null
          claims_verified: boolean
          contact_name: string | null
          contact_whatsapp: string | null
          content_type: string | null
          country: Database["public"]["Enums"]["country_code"] | null
          created_at: string
          created_by: string | null
          creator_requirements: string | null
          deadline: string | null
          decline_reason: string | null
          declined_at: string | null
          deliverable_count: number
          deliverable_type: Database["public"]["Enums"]["deliverable_type"] | null
          deliverables: string | null
          deposit_status: "none" | "partial" | "full"
          equipment: string | null
          floor_check: "not_set" | "pass" | "below"
          id: string
          language: string | null
          notes: string | null
          order_confirmed_at: string | null
          order_proof: string | null
          places: number
          platforms: string[]
          sector: string | null
          service: string | null
          status: "draft" | "awaiting_order" | "awaiting_payment" | "published" | "declined"
          title: string | null
          total_budget_fcfa: number | null
          updated_at: string
          usage_rights: string | null
        }
        Insert: {
          brand_consent?: boolean
          brand_consent_proof?: string | null
          brand_label?: string | null
          brand_name: string
          campaign_id?: string | null
          category?: string | null
          city?: string | null
          claims_verified?: boolean
          contact_name?: string | null
          contact_whatsapp?: string | null
          content_type?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          created_at?: string
          created_by?: string | null
          creator_requirements?: string | null
          deadline?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deliverable_count?: number
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null
          deliverables?: string | null
          deposit_status?: "none" | "partial" | "full"
          equipment?: string | null
          floor_check?: "not_set" | "pass" | "below"
          id?: string
          language?: string | null
          notes?: string | null
          order_confirmed_at?: string | null
          order_proof?: string | null
          places?: number
          platforms?: string[]
          sector?: string | null
          service?: string | null
          status?: "draft" | "awaiting_order" | "awaiting_payment" | "published" | "declined"
          title?: string | null
          total_budget_fcfa?: number | null
          updated_at?: string
          usage_rights?: string | null
        }
        Update: {
          brand_consent?: boolean
          brand_consent_proof?: string | null
          brand_label?: string | null
          brand_name?: string
          campaign_id?: string | null
          category?: string | null
          city?: string | null
          claims_verified?: boolean
          contact_name?: string | null
          contact_whatsapp?: string | null
          content_type?: string | null
          country?: Database["public"]["Enums"]["country_code"] | null
          created_at?: string
          created_by?: string | null
          creator_requirements?: string | null
          deadline?: string | null
          decline_reason?: string | null
          declined_at?: string | null
          deliverable_count?: number
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null
          deliverables?: string | null
          deposit_status?: "none" | "partial" | "full"
          equipment?: string | null
          floor_check?: "not_set" | "pass" | "below"
          id?: string
          language?: string | null
          notes?: string | null
          order_confirmed_at?: string | null
          order_proof?: string | null
          places?: number
          platforms?: string[]
          sector?: string | null
          service?: string | null
          status?: "draft" | "awaiting_order" | "awaiting_payment" | "published" | "declined"
          title?: string | null
          total_budget_fcfa?: number | null
          updated_at?: string
          usage_rights?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "managed_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "managed_briefs_created_by_fkey"
            columns: ["created_by"]
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
      partner_commissions: {
        Row: {
          campaign_creator_id: string
          commission_fcfa: number
          commission_rate: number
          created_at: string
          creator_id: string
          disbursement_ref: string | null
          gross_payout_fcfa: number
          id: string
          paid_at: string | null
          partner_id: string
          provider: Database["public"]["Enums"]["payment_provider"] | null
          status: string
        }
        Insert: {
          campaign_creator_id: string
          commission_fcfa: number
          commission_rate: number
          created_at?: string
          creator_id: string
          disbursement_ref?: string | null
          gross_payout_fcfa: number
          id?: string
          paid_at?: string | null
          partner_id: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          status?: string
        }
        Update: {
          campaign_creator_id?: string
          commission_fcfa?: number
          commission_rate?: number
          created_at?: string
          creator_id?: string
          disbursement_ref?: string | null
          gross_payout_fcfa?: number
          id?: string
          paid_at?: string | null
          partner_id?: string
          provider?: Database["public"]["Enums"]["payment_provider"] | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commissions_campaign_creator_id_fkey"
            columns: ["campaign_creator_id"]
            isOneToOne: true
            referencedRelation: "campaign_creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commissions_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_creator_links: {
        Row: {
          commission_rate: number
          creator_id: string
          ended_at: string | null
          ended_by: string | null
          id: string
          invited_at: string
          message: string | null
          partner_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["representation_status"]
        }
        Insert: {
          commission_rate: number
          creator_id: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          invited_at?: string
          message?: string | null
          partner_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["representation_status"]
        }
        Update: {
          commission_rate?: number
          creator_id?: string
          ended_at?: string | null
          ended_by?: string | null
          id?: string
          invited_at?: string
          message?: string | null
          partner_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["representation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "partner_creator_links_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_creator_links_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_creator_links_ended_by_fkey"
            columns: ["ended_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_floors: {
        Row: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          min_net_fcfa: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          min_net_fcfa?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"]
          min_net_fcfa?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_floors_updated_by_fkey"
            columns: ["updated_by"]
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
      signup_attribution: {
        Row: {
          created_at: string
          referred_by: string | null
          signup_source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          referred_by?: string | null
          signup_source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          referred_by?: string | null
          signup_source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signup_attribution_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signup_attribution_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      founder_badge_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          awarded: number
          remaining: number
        }[]
      }
      partner_invite_creator: {
        Args: {
          p_commission_rate: number
          p_creator_handle: string
          p_message?: string
        }
        Returns: string
      }
      respond_representation: {
        Args: {
          p_accept: boolean
          p_link_id: string
        }
        Returns: undefined
      }
      end_representation: {
        Args: {
          p_link_id: string
        }
        Returns: undefined
      }
      partner_apply_for_creator: {
        Args: {
          p_campaign_id: string
          p_creator_id: string
        }
        Returns: string
      }
      my_partner_links: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          my_side: string
          counterpart_id: string
          counterpart_handle: string
          counterpart_name: string
          counterpart_avatar: string | null
          counterpart_status: Database["public"]["Enums"]["account_status"]
          commission_rate: number
          status: Database["public"]["Enums"]["representation_status"]
          message: string | null
          invited_at: string
          responded_at: string | null
          ended_at: string | null
          deals_in_flight: number
          deals_paid: number
          commission_owed_fcfa: number
          commission_paid_fcfa: number
        }[]
      }
      partner_deals: {
        Args: Record<PropertyKey, never>
        Returns: {
          campaign_creator_id: string
          campaign_id: string
          campaign_title: string
          creator_id: string
          creator_handle: string
          creator_name: string
          status: Database["public"]["Enums"]["creator_campaign_status"]
          agreed_payout_fcfa: number
          commission_rate: number | null
          commission_fcfa: number
          commission_status: string
          applied_by_me: boolean
          updated_at: string
        }[]
      }
      admin_confirm_partner_commission: {
        Args: {
          p_commission_id: string
          p_disbursement_ref?: string
          p_provider?: Database["public"]["Enums"]["payment_provider"]
        }
        Returns: undefined
      }
      get_my_partner_payout_settings: {
        Args: Record<PropertyKey, never>
        Returns: {
          momo_payout_phone_e164: string | null
          momo_provider: Database["public"]["Enums"]["payment_provider"] | null
        }[]
      }
      admin_owed_commissions: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          partner_id: string
          partner_name: string
          partner_handle: string
          payout_phone: string | null
          payout_provider: Database["public"]["Enums"]["payment_provider"] | null
          creator_name: string
          campaign_title: string
          commission_fcfa: number
          commission_rate: number
          gross_payout_fcfa: number
          created_at: string
        }[]
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
      list_my_conversations: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          counterparty_id: string
          counterparty_name: string | null
          counterparty_avatar: string | null
          counterparty_handle: string | null
          last_body: string | null
          last_at: string
          unread: boolean
        }[]
      }
      my_unread_conversation_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      set_conversation_muted: {
        Args: {
          p_conversation_id: string
          p_muted: boolean
        }
        Returns: undefined
      }
      report_conversation: {
        Args: {
          p_conversation_id: string
          p_reason: string
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
      public_campaign_board: {
        Args: {
          p_category?: string
          p_country?: Database["public"]["Enums"]["country_code"]
          p_limit?: number
        }
        Returns: {
          id: string
          title: string
          category: string
          target_country: Database["public"]["Enums"]["country_code"]
          payout_per_creator_fcfa: number
          creator_count_target: number
          platforms: string[]
          content_type: string | null
          deliverable_quantity: number | null
          deadline: string | null
          created_at: string
          brand_name: string | null
          brand_handle: string | null
          applied_count: number
          places_left: number
        }[]
      }
      public_campaign_stats: {
        Args: {
          p_campaign_id: string
        }
        Returns: {
          applied_count: number
          places_left: number
          brand_name: string | null
          brand_handle: string | null
        }[]
      }
      public_campaign_board_v2: {
        Args: {
          p_category?: string
          p_country?: Database["public"]["Enums"]["country_code"]
          p_limit?: number
        }
        Returns: {
          id: string
          title: string
          category: string
          target_country: Database["public"]["Enums"]["country_code"]
          payout_per_creator_fcfa: number
          creator_count_target: number
          platforms: string[]
          content_type: string | null
          deliverable_quantity: number | null
          deadline: string | null
          created_at: string
          brand_name: string | null
          brand_handle: string | null
          applied_count: number
          places_left: number
          is_managed: boolean
          brand_city: string | null
        }[]
      }
      public_campaign_stats_v2: {
        Args: {
          p_campaign_id: string
        }
        Returns: {
          applied_count: number
          places_left: number
          brand_name: string | null
          brand_handle: string | null
          is_managed: boolean
          brand_city: string | null
        }[]
      }
      record_signup_attribution: {
        Args: {
          p_referrer_handle?: string
          p_source?: string
        }
        Returns: boolean
      }
      admin_signup_attribution_stats: {
        Args: Record<PropertyKey, never>
        Returns: {
          kind: string
          signup_source: string | null
          referrer_handle: string | null
          referrer_display_name: string | null
          signups: number
        }[]
      }
      my_referral_count: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      subscribe_campaign_alert: {
        Args: {
          p_category?: string
          p_country?: Database["public"]["Enums"]["country_code"]
        }
        Returns: string
      }
      campaign_alert_limit: {
        Args: Record<PropertyKey, never>
        Returns: number
      }
      unsubscribe_campaign_alert: {
        Args: {
          p_alert_id: string
        }
        Returns: boolean
      }
      my_campaign_alerts: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          country: Database["public"]["Enums"]["country_code"] | null
          category: string | null
          created_at: string
        }[]
      }
      admin_set_pay_floor: {
        Args: {
          p_deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          p_min_net_fcfa: number
        }
        Returns: undefined
      }
      admin_clear_pay_floor: {
        Args: {
          p_deliverable_type: Database["public"]["Enums"]["deliverable_type"]
        }
        Returns: undefined
      }
      pay_floor_list: {
        Args: Record<PropertyKey, never>
        Returns: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          min_net_fcfa: number | null
          updated_at: string | null
          updated_by: string | null
        }[]
      }
      pay_floors_public: {
        Args: Record<PropertyKey, never>
        Returns: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"]
          min_net_fcfa: number
        }[]
      }
      admin_upsert_managed_brief: {
        Args: {
          p_brief: Json
        }
        Returns: string
      }
      admin_list_managed_briefs: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Tables"]["managed_briefs"]["Row"][]
      }
      admin_publish_managed_brief: {
        Args: {
          p_brief_id: string
        }
        Returns: string
      }
      admin_decline_managed_brief: {
        Args: {
          p_brief_id: string
          p_reason?: string
        }
        Returns: undefined
      }
      managed_net_preview: {
        Args: {
          p_total_budget_fcfa: number
          p_places: number
          p_deliverable_count?: number
        }
        Returns: {
          fee_fcfa: number
          creators_pool_fcfa: number
          net_per_place_fcfa: number
          net_per_unit_fcfa: number
          rounding_remainder_fcfa: number
        }[]
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
      country_code: "CM" | "GA" | "CI" | "NG" | "KE" | "ZA"
      creator_campaign_status:
        | "invited"
        | "applied"
        | "approved"
        | "rejected"
        | "content_submitted"
        | "verified"
        | "paid"
        | "disputed"
      deliverable_type:
        | "photo"
        | "short_video"
        | "long_video"
        | "animation"
        | "shoot_day"
        | "post"
        | "story"
        | "ugc_video"
        | "other"
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
        | "mpesa"
        | "opay"
        | "palmpay"
      representation_status: "pending" | "active" | "declined" | "ended"
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
      country_code: ["CM", "GA", "CI", "NG", "KE", "ZA"],
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
      deliverable_type: [
        "photo",
        "short_video",
        "long_video",
        "animation",
        "shoot_day",
        "post",
        "story",
        "ugc_video",
        "other",
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
        "mpesa",
        "opay",
        "palmpay",
      ],
      representation_status: ["pending", "active", "declined", "ended"],
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
