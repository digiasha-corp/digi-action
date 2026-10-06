-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 13_sync_approved_transactions_and_fix_dossier.sql
-- SINKRONISASI NIP & DATA KARYAWAN DARI TRANSAKSI APPROVED KE TABEL FISIK hr_employees
-- Jalankan di Supabase SQL Editor
-- =========================================================================

-- 1. Update NIP dan atribut kepegawaian hr_employees berdasarkan transaksi yang berstatus APPROVED
UPDATE public.hr_employees e
SET 
    nip = COALESCE(NULLIF(t.nip, ''), e.nip),
    location_id = COALESCE(NULLIF(t.new_unit_id, ''), NULLIF(t.new_location_id, ''), NULLIF(t.unit_id, ''), NULLIF(t.work_location_id, ''), e.location_id),
    position_id = COALESCE(NULLIF(t.new_position_id, ''), NULLIF(t.position_id, ''), e.position_id),
    status_kerja = COALESCE(NULLIF(t.employment_status, ''), e.status_kerja),
    tanggal_masuk = COALESCE(t.join_date, e.tanggal_masuk),
    tanggal_selesai_kontrak = COALESCE(t.contract_end_date, e.tanggal_selesai_kontrak),
    updated_at = NOW()
FROM (
    SELECT DISTINCT ON (employee_id) *
    FROM public.hr_employee_transactions
    WHERE status = 'APPROVED'
      AND nip IS NOT NULL 
      AND nip NOT LIKE 'CAND-%'
    ORDER BY employee_id, effective_date DESC, created_at DESC
) t
WHERE e.id = t.employee_id;

-- 2. Pastikan view employees mencerminkan data terbaru
CREATE OR REPLACE VIEW public.employees WITH (security_invoker = on) 
AS SELECT * FROM public.hr_employees;

GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employees TO anon, authenticated, service_role, postgres;

-- 3. Reload cache schema PostgREST
NOTIFY pgrst, 'reload schema';

-- 4. Verifikasi hasil update untuk calon karyawan yang telah diterima
SELECT id, nip, name, status_kerja, location_id, position_id, tanggal_masuk, tanggal_selesai_kontrak, updated_at
FROM public.hr_employees
WHERE nip = '09260001' OR name ILIKE '%DUL%';
