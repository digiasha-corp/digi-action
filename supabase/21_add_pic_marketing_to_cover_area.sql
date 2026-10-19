-- =========================================================================
-- 21_add_pic_marketing_to_cover_area.sql
-- DIGI-ACTION: Penambahan PIC Marketing & Rename PIC FAC pada Cover Area
-- =========================================================================

-- 1. Tambahkan kolom pic_marketing_id pada tabel m_cover_area
ALTER TABLE public.m_cover_area 
ADD COLUMN IF NOT EXISTS pic_marketing_id UUID REFERENCES public.hr_employees(id) ON DELETE SET NULL;

-- 2. Ganti nama kolom lama agar lebih jelas (pic_id -> pic_fac_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'm_cover_area' 
          AND column_name = 'pic_id'
    ) THEN
        ALTER TABLE public.m_cover_area RENAME COLUMN pic_id TO pic_fac_id;
    END IF;
END $$;

-- 3. Index untuk mempercepat query
CREATE INDEX IF NOT EXISTS idx_cover_area_pic_fac_id ON public.m_cover_area(pic_fac_id);
CREATE INDEX IF NOT EXISTS idx_cover_area_pic_marketing_id ON public.m_cover_area(pic_marketing_id);

-- 4. Reload Schema PostgREST
NOTIFY pgrst, 'reload schema';
