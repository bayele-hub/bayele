-- ============================================================================
-- Migration:          Avatars storage bucket + owner-scoped policies
-- Version:            20260819100000_0020
-- Date:               2026-08-19
-- Author:             Principal Backend & Database Systems Engineer
-- Team:               Bayele Core Platform Engineering
-- Feature Ticket:     BAY-PROF-020 (profile photo CRUD)
-- Dependencies:       0001 (profiles.avatar_url), 0018 (avatar_url anon read grant)
-- Rollback Script:    supabase/migrations/rollback/20260819100000_0020_avatars_storage.rollback.sql
-- Estimated Duration: ~0.1s
-- ============================================================================
-- Description: Creates the public "avatars" storage bucket and the RLS on storage.objects that backs
--   profile-photo CRUD. Files live under a per-user folder ("{auth.uid}/..."), so a user can only
--   create/replace/delete their OWN avatar, while everyone (anon included) can READ — the public
--   directory and profile pages render these images via <img>. profiles.avatar_url stores the public
--   URL and is updated by the app (owner-scoped) when a photo is set or removed.
-- Breaking Changes: NONE (additive; new bucket + new policies).
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880,
        ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read of avatar objects (rendered on public profiles + directory).
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Owner may upload into their own "{uid}/" folder only.
DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Owner may replace their own objects.
DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- Owner may delete their own objects (the "remove photo" path).
DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ============================================================================
-- POST-APPLY VERIFICATION:
--   • bucket 'avatars' exists, public=true
--   • anon may SELECT storage.objects in bucket 'avatars'; may NOT insert
--   • authenticated user may insert under '{own uid}/...' but NOT under another uid's folder
-- ============================================================================
