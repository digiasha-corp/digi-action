-- ============================================================================
-- DIGI ACTION - SUPABASE POSTGRESQL RLS POLICY FIX FOR m_ketentuan
-- File: 27_rls_m_ketentuan.sql
-- Purpose: Membuka hak akses SELECT, INSERT, UPDATE, DELETE pada m_ketentuan
--          dan bucket digiasha-media untuk role 'authenticated' (Supabase Auth)
-- ============================================================================

-- 1. Pastikan RLS aktif dan izinkan akses untuk anon maupun authenticated (PUBLIC)
ALTER TABLE public.m_ketentuan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on m_ketentuan" ON public.m_ketentuan;
DROP POLICY IF EXISTS "Allow authenticated all on m_ketentuan" ON public.m_ketentuan;
DROP POLICY IF EXISTS "Allow public all on m_ketentuan" ON public.m_ketentuan;

CREATE POLICY "Allow public all on m_ketentuan"
ON public.m_ketentuan
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 2. Pastikan GRANT tabel lengkap untuk anon, authenticated, dan service_role
GRANT ALL ON TABLE public.m_ketentuan TO anon, authenticated, service_role;

-- 3. Pastikan Storage Bucket 'digiasha-media' mengizinkan DELETE juga untuk public (anon & authenticated)
DROP POLICY IF EXISTS "Public Delete digiasha-media" ON storage.objects;
CREATE POLICY "Public Delete digiasha-media"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'digiasha-media');

NOTIFY pgrst, 'reload schema';

