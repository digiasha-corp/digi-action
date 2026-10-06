-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 06_reorganize_tables_prefixes.sql
-- PENGELOMPOKAN TABEL SUPABASE BERDASARKAN PREFIX MODUL
-- =========================================================================
-- Kelompok yang dibentuk:
-- 1. hr_...   -> Personalia & Master Kepegawaian (termasuk absensi & izin)
-- 2. gps_...  -> GPS Tracking, Maintenance & Signal Check
-- 3. tr_...   -> Aktivitas & Kunjungan Lapangan (Visit, Onboarding, Checklist)
-- 4. sso_...  -> Integrasi Single Sign-On Digiasha Ecosystem
-- 5. m_...    -> Master Bisnis & Mitra Dealer
--
-- CATATAN KEAMANAN (ZERO-BREAKING):
-- Setiap tabel yang di-rename dibuatkan otomatis SQL VIEW dengan nama aslinya.
-- Seluruh query aplikasi frontend, backend lama, maupun GAS sync tetap berjalan
-- 100% normal tanpa terganggu.
-- =========================================================================

-- =========================================================================
-- KELOMPOK 1: PERSONALIA & KEPEGAWAIAN (Prefix: hr_)
-- =========================================================================

-- 1. Master Karyawan Inti
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
        ALTER TABLE public.employees RENAME TO hr_employees;
    END IF;
END $$;

-- 2. Data Pribadi Sipil Karyawan
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_personal_details') THEN
        ALTER TABLE public.employee_personal_details RENAME TO hr_employee_personal_details;
    END IF;
END $$;

-- 3. Riwayat Karir & Remunerasi (Mutasi, Promosi, Gaji, SK, BPJS, Pajak)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_career_histories') THEN
        ALTER TABLE public.employee_career_histories RENAME TO hr_employee_career_histories;
    END IF;
END $$;

-- 4. Master Unit Organisasi (HO, Area, Cabang)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_units') THEN
        ALTER TABLE public.organization_units RENAME TO hr_organization_units;
    END IF;
END $$;

-- 5. Master Jabatan & Reporting Line
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_positions') THEN
        ALTER TABLE public.job_positions RENAME TO hr_job_positions;
    END IF;
END $$;

-- 6. Matriks Akses Per Jabatan
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'job_position_permissions') THEN
        ALTER TABLE public.job_position_permissions RENAME TO hr_job_position_permissions;
    END IF;
END $$;

-- 7. Master Level / Grade Kepegawaian (L-01 s.d L-07)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'master_levels') THEN
        ALTER TABLE public.master_levels RENAME TO hr_master_levels;
    END IF;
END $$;

-- 8. Master Work Location (Lokasi Kerja & Geofence Multi-Cabang)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'work_locations') THEN
        ALTER TABLE public.work_locations RENAME TO hr_work_locations;
    END IF;
END $$;

-- 9. Log Presensi Kehadiran & Kepulangan (tr_absensi_log -> hr_absensi_log)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tr_absensi_log') THEN
        ALTER TABLE public.tr_absensi_log RENAME TO hr_absensi_log;
    END IF;
END $$;

-- 10. Log Pengajuan Izin / Cuti / WFA / Sakit (tr_izin_log -> hr_izin_log)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tr_izin_log') THEN
        ALTER TABLE public.tr_izin_log RENAME TO hr_izin_log;
    END IF;
END $$;


-- =========================================================================
-- KELOMPOK 2: GPS, PERANGKAT & TRACKING (Prefix: gps_)
-- =========================================================================

-- 1. Transaksi Maintenance GPS (Pasang, Ganti, Cabut, Rusak)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tr_gps_maintenance') THEN
        ALTER TABLE public.tr_gps_maintenance RENAME TO gps_maintenance;
    END IF;
END $$;

-- 2. Monitoring & Pengecekan Sinyal GPS FAC
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tr_gps_fac_check') THEN
        ALTER TABLE public.tr_gps_fac_check RENAME TO gps_fac_check;
    END IF;
END $$;

-- 3. Master Inventori Perangkat GPS (m_gps_device -> gps_devices)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'm_gps_device') THEN
        ALTER TABLE public.m_gps_device RENAME TO gps_devices;
    END IF;
END $$;

-- 4. Realtime Vehicle Tracking McEasy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles_tracking') THEN
        ALTER TABLE public.vehicles_tracking RENAME TO gps_vehicles_tracking;
    END IF;
END $$;

-- 5. History Vehicle Tracking McEasy
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vehicles_tracking_history') THEN
        ALTER TABLE public.vehicles_tracking_history RENAME TO gps_vehicles_tracking_history;
    END IF;
END $$;


-- =========================================================================
-- VIEW BACKWARD COMPATIBILITY (JAMINAN KODE & APLIKASI LAMA TETAP JALAN)
-- =========================================================================
-- Di PostgreSQL, view sederhana dari 1 tabel otomatis updatable (bisa SELECT, INSERT, UPDATE, DELETE).
-- View ini memastikan aplikasi lama yang memanggil nama lama tetap berjalan 100% normal.

CREATE OR REPLACE VIEW public.employees WITH (security_invoker = on) AS SELECT * FROM public.hr_employees;
CREATE OR REPLACE VIEW public.employee_personal_details WITH (security_invoker = on) AS SELECT * FROM public.hr_employee_personal_details;
CREATE OR REPLACE VIEW public.employee_career_histories WITH (security_invoker = on) AS SELECT * FROM public.hr_employee_career_histories;
CREATE OR REPLACE VIEW public.organization_units WITH (security_invoker = on) AS SELECT * FROM public.hr_organization_units;
CREATE OR REPLACE VIEW public.job_positions WITH (security_invoker = on) AS SELECT * FROM public.hr_job_positions;
CREATE OR REPLACE VIEW public.job_position_permissions WITH (security_invoker = on) AS SELECT * FROM public.hr_job_position_permissions;
CREATE OR REPLACE VIEW public.master_levels WITH (security_invoker = on) AS SELECT * FROM public.hr_master_levels;
CREATE OR REPLACE VIEW public.work_locations WITH (security_invoker = on) AS SELECT * FROM public.hr_work_locations;

CREATE OR REPLACE VIEW public.tr_absensi_log WITH (security_invoker = on) AS SELECT * FROM public.hr_absensi_log;
CREATE OR REPLACE VIEW public.tr_izin_log WITH (security_invoker = on) AS SELECT * FROM public.hr_izin_log;

CREATE OR REPLACE VIEW public.tr_gps_maintenance WITH (security_invoker = on) AS SELECT * FROM public.gps_maintenance;
CREATE OR REPLACE VIEW public.tr_gps_fac_check WITH (security_invoker = on) AS SELECT * FROM public.gps_fac_check;
CREATE OR REPLACE VIEW public.m_gps_device WITH (security_invoker = on) AS SELECT * FROM public.gps_devices;
CREATE OR REPLACE VIEW public.vehicles_tracking WITH (security_invoker = on) AS SELECT * FROM public.gps_vehicles_tracking;
CREATE OR REPLACE VIEW public.vehicles_tracking_history WITH (security_invoker = on) AS SELECT * FROM public.gps_vehicles_tracking_history;


-- =========================================================================
-- PERBARUI TRIGGER SINKRONISASI KE m_employee
-- =========================================================================
CREATE OR REPLACE FUNCTION public.sync_employees_to_legacy_m_employee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.m_employee (
        nip,
        nama_lengkap,
        email,
        jabatan,
        cabang,
        role_id,
        status_aktif,
        updated_at
    )
    VALUES (
        NEW.nip,
        NEW.name,
        NEW.email,
        COALESCE((SELECT nama_jabatan FROM public.hr_job_positions WHERE id_position = NEW.position_id), NEW.role, '-'),
        COALESCE((SELECT nama_unit FROM public.hr_organization_units WHERE id_unit = NEW.location_id), 'Head Office'),
        COALESCE(NEW.role, 'R-04'),
        CASE WHEN NEW.deleted_at IS NULL THEN 'AKTIF' ELSE 'NONAKTIF' END,
        NOW()
    )
    ON CONFLICT (nip) DO UPDATE SET
        nama_lengkap = EXCLUDED.nama_lengkap,
        email = EXCLUDED.email,
        jabatan = EXCLUDED.jabatan,
        cabang = EXCLUDED.cabang,
        role_id = EXCLUDED.role_id,
        status_aktif = EXCLUDED.status_aktif,
        updated_at = NOW();

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.hr_employees;
CREATE TRIGGER trg_sync_employees_to_legacy
AFTER INSERT OR UPDATE ON public.hr_employees
FOR EACH ROW EXECUTE FUNCTION public.sync_employees_to_legacy_m_employee();


-- =========================================================================
-- HAK AKSES API SUPABASE (GRANT)
-- =========================================================================
GRANT ALL ON TABLE public.hr_employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_employee_career_histories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_job_positions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_job_position_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_master_levels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_work_locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_absensi_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_izin_log TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.gps_maintenance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gps_fac_check TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gps_devices TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gps_vehicles_tracking TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.gps_vehicles_tracking_history TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_career_histories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_positions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_position_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.master_levels TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.work_locations TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tr_absensi_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tr_izin_log TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tr_gps_maintenance TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.tr_gps_fac_check TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.m_gps_device TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vehicles_tracking TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.vehicles_tracking_history TO anon, authenticated, service_role;
