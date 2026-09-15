-- ============================================================================
-- DIGI ACTION - SUPABASE POSTGRESQL TABLE & POLICIES
-- File: 03_ketentuan_pdf_portal.sql
-- Purpose: Tabel Penyimpanan Dokumen Ketentuan, SOP, & Hak Akses Role
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.m_ketentuan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    judul VARCHAR(255) NOT NULL,
    nomor_dokumen VARCHAR(100),
    kategori VARCHAR(100) DEFAULT 'SOP Operasional',
    tgl_berlaku DATE NOT NULL,
    pdf_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_size INTEGER DEFAULT 0,
    allowed_roles JSONB DEFAULT '["ALL"]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexing untuk pencarian cepat
CREATE INDEX IF NOT EXISTS idx_ketentuan_kategori ON public.m_ketentuan (kategori);
CREATE INDEX IF NOT EXISTS idx_ketentuan_tgl_berlaku ON public.m_ketentuan (tgl_berlaku DESC);
CREATE INDEX IF NOT EXISTS idx_ketentuan_active ON public.m_ketentuan (is_active);

-- Enable RLS
ALTER TABLE public.m_ketentuan ENABLE ROW LEVEL SECURITY;

-- Allow anon & authenticated users to read & manage ketentuan
DROP POLICY IF EXISTS "Allow anon all on m_ketentuan" ON public.m_ketentuan;
CREATE POLICY "Allow anon all on m_ketentuan"
ON public.m_ketentuan FOR ALL TO anon
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.m_ketentuan IS 'Tabel Master Portal Ketentuan & SOP Perusahaan Terproteksi';
