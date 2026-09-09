-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - STORAGE RLS POLICIES
-- File: 02_storage_policies.sql
-- Purpose: Membuka Hak Akses Upload (INSERT) & Baca (SELECT) pada Storage Bucket 'digiasha-media'
-- ============================================================================

-- 1. Hapus policy lama jika ada agar tidak duplikat
DROP POLICY IF EXISTS "Public Upload digiasha-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read digiasha-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Update digiasha-media" ON storage.objects;

-- 2. Policy INSERT: Mengizinkan upload foto dari Web App (Role anon / public)
CREATE POLICY "Public Upload digiasha-media"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'digiasha-media');

-- 3. Policy SELECT: Mengizinkan semua orang melihat / membuka URL foto
CREATE POLICY "Public Read digiasha-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'digiasha-media');

-- 4. Policy UPDATE: Mengizinkan update / overwrite foto jika diperlukan
CREATE POLICY "Public Update digiasha-media"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'digiasha-media');
