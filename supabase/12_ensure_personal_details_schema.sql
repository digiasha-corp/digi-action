-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 12_ensure_personal_details_schema.sql
-- MEMASTIKAN SKEMA hr_employee_personal_details LENGKAP & CACHE DI-RELOAD
-- Jalankan di Supabase SQL Editor
-- =========================================================================

-- 1. Pastikan semua kolom yang dibutuhkan ada (idempotent - aman dijalankan berkali-kali)
ALTER TABLE IF EXISTS public.hr_employee_personal_details
  ADD COLUMN IF NOT EXISTS name TEXT NULL,
  ADD COLUMN IF NOT EXISTS email TEXT NULL,
  ADD COLUMN IF NOT EXISTS dob DATE NULL,
  ADD COLUMN IF NOT EXISTS gender TEXT NULL,
  ADD COLUMN IF NOT EXISTS marital_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS spouse_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS education TEXT NULL,
  ADD COLUMN IF NOT EXISTS major TEXT NULL,
  ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;

-- 2. Pastikan semua kolom yang dibutuhkan ada di hr_employees juga
-- (hr_employees TIDAK boleh punya kolom pribadi seperti dob, gender, dll.)
-- Kolom yang valid di hr_employees: id, nip, name, email, user_id, location_id,
-- position_id, supervisor_id, role, must_change_password, current_session_id,
-- status_kerja, tanggal_masuk, tanggal_selesai_kontrak, deleted_at, created_at, updated_at

-- 3. Hak akses penuh ke tabel
GRANT ALL ON TABLE public.hr_employee_personal_details TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.hr_employees TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.hr_employee_transactions TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.hr_transaction_staging_approvals TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.hr_transaction_agreements TO anon, authenticated, service_role, postgres;
GRANT ALL ON TABLE public.hr_employee_career_histories TO anon, authenticated, service_role, postgres;

-- 4. Disable RLS agar tidak ada Row Level Security yang memblokir insert/update
ALTER TABLE public.hr_employee_personal_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees DISABLE ROW LEVEL SECURITY;

-- 5. Permissive policies (jika RLS sewaktu-waktu aktif di dashboard)
DROP POLICY IF EXISTS "Allow all on hr_employee_personal_details" ON public.hr_employee_personal_details;
CREATE POLICY "Allow all on hr_employee_personal_details"
  ON public.hr_employee_personal_details FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on hr_employees" ON public.hr_employees;
CREATE POLICY "Allow all on hr_employees"
  ON public.hr_employees FOR ALL TO public USING (true) WITH CHECK (true);

-- 6. Update VIEW employee_personal_details agar reflect kolom terbaru
DROP VIEW IF EXISTS public.employee_personal_details;
CREATE OR REPLACE VIEW public.employee_personal_details WITH (security_invoker = on)
AS SELECT * FROM public.hr_employee_personal_details;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;

-- 7. Reload schema cache Supabase PostgREST (WAJIB setelah ALTER TABLE)
NOTIFY pgrst, 'reload schema';

-- 8. Backfill otomatis: Pastikan setiap calon/karyawan di hr_employees memiliki baris di hr_employee_personal_details
INSERT INTO public.hr_employee_personal_details (
  id,
  employee_id,
  name,
  email,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  e.id,
  e.name,
  e.email,
  NOW(),
  NOW()
FROM public.hr_employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.hr_employee_personal_details p WHERE p.employee_id = e.id
);

-- 9. Verifikasi kolom yang ada
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'hr_employee_personal_details'
ORDER BY ordinal_position;

