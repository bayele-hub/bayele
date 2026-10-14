-- ============================================================================
-- Migration:          Conversation context value for partner assignments (enum value only)
-- Version:            20261014120000_0038
-- Date:               2026-10-14
-- Team:               Bayele Core Platform Engineering
-- Dependencies:       0023 (conversation_context)
-- Rollback Script:    supabase/migrations/rollback/20261014120000_0038_partner_assignment_context.rollback.sql
-- Decisions:          briefs/CONTEXT-PARTNER-GOV.md G3, G4, G11
-- ============================================================================
-- A new enum value cannot be used in the transaction that adds it, so it ships alone and BEFORE 0039
-- (which opens 'partner_assignment' conversations). Inert on its own. K8: no destructive keyword.
-- ============================================================================

ALTER TYPE public.conversation_context ADD VALUE IF NOT EXISTS 'partner_assignment';
