-- =========================================================================
-- MIGRASI 28: PENAMBAHAN KOLOM KHUSUS PADA TABEL VISIT FAC
-- Tabel: public.tr_laporan_visit & public.tr_visit_unit_check
-- =========================================================================

-- 1. Penambahan Kolom pada Tabel Header Kunjungan (public.tr_laporan_visit)
ALTER TABLE public.tr_laporan_visit
  ADD COLUMN IF NOT EXISTS onb_visit_rumah BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onb_domisili_status TEXT,
  ADD COLUMN IF NOT EXISTS onb_domisili_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS onb_domisili_long NUMERIC,
  ADD COLUMN IF NOT EXISTS onb_domisili_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS onb_domisili_note TEXT,
  ADD COLUMN IF NOT EXISTS onb_visit_showroom BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onb_showroom_status TEXT,
  ADD COLUMN IF NOT EXISTS onb_showroom_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS onb_showroom_long NUMERIC,
  ADD COLUMN IF NOT EXISTS onb_showroom_note TEXT,
  ADD COLUMN IF NOT EXISTS stock_media_urls JSONB DEFAULT '[]'::jsonb;

-- 2. Penambahan Kolom pada Tabel Detail Pemeriksaan Unit (public.tr_visit_unit_check)
ALTER TABLE public.tr_visit_unit_check
  ADD COLUMN IF NOT EXISTS indikasi_unit TEXT,
  ADD COLUMN IF NOT EXISTS info_status_fasilitas JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS komitmen_pembayaran TEXT,
  ADD COLUMN IF NOT EXISTS tanggal_komitmen DATE,
  ADD COLUMN IF NOT EXISTS ovd_plan TEXT;

-- 3. Reload Schema Cache PostgREST agar kolom baru langsung dikenali API
NOTIFY pgrst, 'reload schema';