-- =========================================================================
-- SUPABASE POSTGRESQL: 08_disable_rls_and_fix_permissions.sql
-- NONAKTIFKAN RLS PADA SELURUH TABEL CORE HR (STATUS UNRESTRICTED)
-- =========================================================================
-- Tujuan:
-- 1. Membuat tabel-tabel baru (hr_*) berstatus UNRESTRICTED persis seperti
--    tabel m_work_location dan m_employee.
-- 2. Memastikan API Key Supabase (anon) pada frontend dapat langsung
--    melakukan SELECT, INSERT, UPDATE, dan DELETE tanpa diblokir RLS.
-- 3. Memastikan apa yang dihapus atau diedit di database / aplikasi langsung
--    tersinkronisasi secara real-time.
-- =========================================================================

-- 1. NONAKTIFKAN ROW LEVEL SECURITY (RLS) AGAR MENJADI UNRESTRICTED
ALTER TABLE public.hr_work_locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_organization_units DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_job_positions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_job_position_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_master_levels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_personal_details DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_employee_career_histories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_clients DISABLE ROW LEVEL SECURITY;

-- 2. BERIKAN HAK AKSES API LENGKAP (GRANT)
GRANT ALL ON TABLE public.hr_work_locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_job_positions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_job_position_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_master_levels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employee_career_histories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.sso_clients TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.work_locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_positions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_levels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_career_histories TO anon, authenticated, service_role;

-- 3. REFRESH SCHEMA CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
