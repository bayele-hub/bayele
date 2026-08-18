-- ============================================================================
-- Rollback of:        20260819100000_0020_avatars_storage.sql
-- Author:             Principal Backend & Database Systems Engineer
-- Inverse type:       Drops the four avatar storage policies and the bucket.
-- WARNING: deleting the bucket removes every uploaded avatar object. profiles.avatar_url values are
--          left as-is (they will 404 until re-uploaded). Only roll back deliberately.
-- ============================================================================

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

DELETE FROM storage.objects WHERE bucket_id = 'avatars';
DELETE FROM storage.buckets WHERE id = 'avatars';

DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260819100000';
