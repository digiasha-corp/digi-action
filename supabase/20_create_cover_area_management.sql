-- =========================================================================
-- 20_create_cover_area_management.sql
-- DIGI-ACTION: Modul Manajemen Cover Area & Mitra Assignment
-- =========================================================================

-- 1. Buat tabel m_cover_area
CREATE TABLE IF NOT EXISTS public.m_cover_area (
    id_area UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_area TEXT NOT NULL,
    unit_id TEXT NOT NULL REFERENCES public.hr_organization_units(id_unit) ON DELETE CASCADE,
    pic_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk mempercepat query berdasarkan cabang/unit dan PIC
CREATE INDEX IF NOT EXISTS idx_cover_area_unit_id ON public.m_cover_area(unit_id);
CREATE INDEX IF NOT EXISTS idx_cover_area_pic_id ON public.m_cover_area(pic_id);

-- 2. Tambahkan kolom cover_area_id pada tabel m_dealer
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'm_dealer' 
          AND column_name = 'cover_area_id'
    ) THEN
        ALTER TABLE public.m_dealer 
        ADD COLUMN cover_area_id UUID REFERENCES public.m_cover_area(id_area) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_m_dealer_cover_area_id ON public.m_dealer(cover_area_id);

-- 3. Nonaktifkan Row Level Security (RLS) & Berikan Akses Penuh (Grant)
ALTER TABLE public.m_cover_area DISABLE ROW LEVEL SECURITY;

-- Jika RLS tetap aktif di level konfigurasi Supabase project, tambahkan policy izin penuh:
DROP POLICY IF EXISTS "Allow all for m_cover_area" ON public.m_cover_area;
CREATE POLICY "Allow all for m_cover_area" ON public.m_cover_area
    FOR ALL
    TO public, anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.m_cover_area TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.m_dealer TO anon, authenticated, service_role;

-- 4. Injeksi Hak Akses Default ke hr_job_position_permissions untuk Jabatan Terkait
INSERT INTO public.hr_job_position_permissions (position_id, permission_code)
SELECT v.pos_id, v.perm_code
FROM (
  VALUES
    ('POS-DIR-UTAMA', 'digi_active:cover_area_management:view'),
    ('POS-DIR-UTAMA', 'digi_active:cover_area_management:edit'),
    ('POS-GM-OPS', 'digi_active:cover_area_management:view'),
    ('POS-GM-OPS', 'digi_active:cover_area_management:edit'),
    ('POS-BM-SERANG', 'digi_active:cover_area_management:view'),
    ('POS-BM-SERANG', 'digi_active:cover_area_management:edit'),
    ('POS-BM-TGR', 'digi_active:cover_area_management:view'),
    ('POS-BM-TGR', 'digi_active:cover_area_management:edit'),
    ('POS-SPV-FAC', 'digi_active:cover_area_management:view'),
    ('POS-SPV-FAC', 'digi_active:cover_area_management:edit'),
    ('POS-ADMIN-HO', 'digi_active:cover_area_management:view'),
    ('POS-ADMIN-HO', 'digi_active:cover_area_management:edit')
) AS v(pos_id, perm_code)
WHERE EXISTS (
  SELECT 1 FROM public.hr_job_positions p WHERE p.id_position = v.pos_id
)
ON CONFLICT (position_id, permission_code) DO NOTHING;

-- 5. Reload Schema PostgREST
NOTIFY pgrst, 'reload schema';

