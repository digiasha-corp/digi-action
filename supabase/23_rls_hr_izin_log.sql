-- =========================================================================================
-- 23_rls_hr_izin_log.sql
-- Mengaktifkan RLS (Row Level Security) pada tabel hr_izin_log untuk Supabase Auth
-- =========================================================================================

-- Aktifkan RLS
ALTER TABLE public.hr_izin_log ENABLE ROW LEVEL SECURITY;

-- 1. Semua orang yang login boleh membaca log izin (SELECT)
-- Anda bisa menyesuaikan ini jika ingin membatasi hanya atasan/pemohon yang bisa melihat
CREATE POLICY "Allow authenticated read" ON public.hr_izin_log
    FOR SELECT TO authenticated USING (true);

-- 2. Semua orang yang login boleh membuat pengajuan baru (INSERT)
CREATE POLICY "Allow authenticated insert" ON public.hr_izin_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- 3. Izinkan update pada log izin (UPDATE)
-- Digunakan saat pemohon membatalkan pengajuan (CANCEL) ATAU Atasan menyetujui (APPROVE/REJECT)
CREATE POLICY "Allow authenticated update" ON public.hr_izin_log
    FOR UPDATE TO authenticated
    USING (true)
    WITH CHECK (true);
