-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA MIGRATION: 05_organization_and_sso_schema.sql
-- DIGIASHA CORE IDENTITY & ORGANIZATION SYSTEM (UNIFIED MASTER & SSO)
-- =========================================================================
-- Modul:
-- 1. work_locations (Tempat Kerja Fisik & Geofence Multi-Cabang/HO)
-- 2. master_levels (Tingkatan & Bobot Level Kepegawaian L-01 s.d L-07)
-- 3. organization_units (Unit Organisasi: HO, AREA, CABANG)
-- 4. job_positions & job_position_permissions (Master Jabatan & Matriks Akses)
-- 5. employees (Master Karyawan Inti)
-- 6. employee_personal_details (Identitas Sipil & Pribadi Murni)
-- 7. employee_career_histories (Historis Mutasi, Promosi, Gaji, Payroll, BPJS, Pajak, SK)
-- 8. sso_clients & sso_tokens (Ekosistem SSO: Digicore, Digi Workapp, Digi Active, Digi Spector)
-- 9. sync_employees_to_legacy_m_employee (Bridge Aman ke m_employee Lama)
-- =========================================================================

-- 1. TABEL TEMPAT KERJA FISIK (work_locations)
CREATE TABLE IF NOT EXISTS public.work_locations (
    id_work_location TEXT NOT NULL PRIMARY KEY,
    nama_lokasi TEXT NOT NULL,
    alamat_lengkap TEXT NOT NULL,
    kota TEXT,
    provinsi TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    radius_meter INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data Work Locations jika belum ada
INSERT INTO public.work_locations (id_work_location, nama_lokasi, alamat_lengkap, kota, provinsi, latitude, longitude, radius_meter, is_active)
VALUES 
  ('WL-HO-01', 'Head Office Graha Digiasha', 'Jl. Jenderal Sudirman Kav. 25, Jakarta Selatan', 'Jakarta Selatan', 'DKI Jakarta', -6.2146, 106.8214, 150, true),
  ('WL-SERANG-01', 'Kantor Operasional Serang', 'Jl. Ahmad Yani No. 88, Cipocok Jaya', 'Serang', 'Banten', -6.1200, 106.1500, 120, true),
  ('WL-TGR-01', 'Kantor Operasional Tangerang', 'Jl. MH Thamrin No. 12, Cikokol', 'Tangerang', 'Banten', -6.1783, 106.6319, 120, true)
ON CONFLICT (id_work_location) DO NOTHING;


-- 2. TABEL MASTER LEVEL KEPEGAWAIAN (master_levels)
CREATE TABLE IF NOT EXISTS public.master_levels (
    id_level TEXT NOT NULL PRIMARY KEY,
    nama_level TEXT NOT NULL,
    bobot_level INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data Master Levels (Bobot 1 = Tertinggi)
INSERT INTO public.master_levels (id_level, nama_level, bobot_level, is_active)
VALUES 
  ('L-01', 'Direksi / C-Level', 1, true),
  ('L-02', 'General Manager / Division Head', 2, true),
  ('L-03', 'Manager / Branch Manager', 3, true),
  ('L-04', 'Supervisor / Coordinator', 4, true),
  ('L-05', 'Senior Officer / Specialist', 5, true),
  ('L-06', 'Officer / Staff', 6, true),
  ('L-07', 'Field Staff / FAC / Pelaksana', 7, true)
ON CONFLICT (id_level) DO NOTHING;


-- 3. TABEL UNIT ORGANISASI (organization_units)
CREATE TABLE IF NOT EXISTS public.organization_units (
    id_unit TEXT NOT NULL PRIMARY KEY,
    tipe_unit TEXT NOT NULL,
    nama_unit TEXT NOT NULL,
    parent_unit_id TEXT NULL,
    work_location_id TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT organization_units_parent_unit_id_fkey FOREIGN KEY (parent_unit_id) REFERENCES public.organization_units (id_unit) ON DELETE SET NULL,
    CONSTRAINT organization_units_work_location_fkey FOREIGN KEY (work_location_id) REFERENCES public.work_locations (id_work_location) ON DELETE SET NULL,
    CONSTRAINT organization_units_tipe_unit_check CHECK (
        (tipe_unit = ANY (ARRAY['HO'::TEXT, 'AREA'::TEXT, 'CABANG'::TEXT]))
    )
);

-- Seed Data Unit Organisasi Awal
INSERT INTO public.organization_units (id_unit, tipe_unit, nama_unit, parent_unit_id, work_location_id, is_active)
VALUES 
  ('HO-CORP', 'HO', 'Head Office Digiasha', NULL, 'WL-HO-01', true),
  ('AREA-BANTEN', 'AREA', 'Area Regional Banten & Jabar', 'HO-CORP', 'WL-HO-01', true),
  ('CAB-SERANG', 'CABANG', 'Cabang Serang', 'AREA-BANTEN', 'WL-SERANG-01', true),
  ('CAB-TANGERANG', 'CABANG', 'Cabang Tangerang', 'AREA-BANTEN', 'WL-TGR-01', true),
  ('CAB-JAKARTA', 'CABANG', 'Cabang Jakarta Barat', 'HO-CORP', 'WL-HO-01', true)
ON CONFLICT (id_unit) DO NOTHING;


-- 4. TABEL MASTER JABATAN (job_positions) & HAK AKSES (job_position_permissions)
CREATE TABLE IF NOT EXISTS public.job_positions (
    id_position TEXT NOT NULL PRIMARY KEY,
    nama_jabatan TEXT NOT NULL,
    level_id TEXT NULL,
    reports_to_unit_id TEXT NULL,
    coordination_to_unit_id TEXT NULL,
    unit_id TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT job_positions_level_id_fkey FOREIGN KEY (level_id) REFERENCES public.master_levels (id_level) ON DELETE SET NULL,
    CONSTRAINT job_positions_reports_to_unit_id_fkey FOREIGN KEY (reports_to_unit_id) REFERENCES public.job_positions (id_position) ON DELETE SET NULL,
    CONSTRAINT job_positions_coordination_to_unit_id_fkey FOREIGN KEY (coordination_to_unit_id) REFERENCES public.job_positions (id_position) ON DELETE SET NULL,
    CONSTRAINT job_positions_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.organization_units (id_unit) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.job_position_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    position_id TEXT NULL,
    permission_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT job_position_permissions_position_id_permission_code_key UNIQUE (position_id, permission_code),
    CONSTRAINT job_position_permissions_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.job_positions (id_position) ON DELETE CASCADE
);

-- Seed Data Jabatan Standar
INSERT INTO public.job_positions (id_position, nama_jabatan, level_id, reports_to_unit_id, unit_id, is_active)
VALUES 
  ('POS-DIR-UTAMA', 'Direktur Utama', 'L-01', NULL, 'HO-CORP', true),
  ('POS-GM-OPS', 'General Manager Operasional', 'L-02', 'POS-DIR-UTAMA', 'HO-CORP', true),
  ('POS-BM-SERANG', 'Branch Manager Serang', 'L-03', 'POS-GM-OPS', 'CAB-SERANG', true),
  ('POS-BM-TGR', 'Branch Manager Tangerang', 'L-03', 'POS-GM-OPS', 'CAB-TANGERANG', true),
  ('POS-SPV-FAC', 'Supervisor FAC & Field Ops', 'L-04', 'POS-BM-SERANG', 'CAB-SERANG', true),
  ('POS-FAC-OFFICER', 'Field Action Coordinator (FAC)', 'L-07', 'POS-SPV-FAC', 'CAB-SERANG', true),
  ('POS-ADMIN-HO', 'Administrator Sistem & HR', 'L-05', 'POS-GM-OPS', 'HO-CORP', true)
ON CONFLICT (id_position) DO NOTHING;


-- 5. TABEL MASTER KARYAWAN POKOK (employees)
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    nip TEXT UNIQUE NULL,
    name TEXT NULL,
    email TEXT UNIQUE NULL,
    user_id UUID NULL,
    location_id TEXT NULL,
    position_id TEXT NULL,
    supervisor_id UUID NULL,
    role TEXT NULL,
    must_change_password BOOLEAN DEFAULT FALSE,
    current_session_id TEXT NULL,
    status_kerja TEXT DEFAULT 'PKWTT', -- 'PKWTT', 'PKWT', 'PROBATION', 'MAGANG'
    tanggal_masuk DATE NULL,
    tanggal_selesai_kontrak DATE NULL,
    deleted_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT employees_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.organization_units (id_unit) ON DELETE SET NULL,
    CONSTRAINT employees_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.job_positions (id_position) ON DELETE SET NULL,
    CONSTRAINT employees_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES public.employees (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_employees_nip ON public.employees (nip);
CREATE INDEX IF NOT EXISTS idx_employees_email ON public.employees (email);
CREATE INDEX IF NOT EXISTS idx_employees_location ON public.employees (location_id);
CREATE INDEX IF NOT EXISTS idx_employees_supervisor ON public.employees (supervisor_id);


-- 6. TABEL DATA PRIBADI SIPIL MURNI (employee_personal_details)
-- Khusus identitas sipil & kontak pribadi (Bebas dari data gaji/payroll/BPJS)
CREATE TABLE IF NOT EXISTS public.employee_personal_details (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL UNIQUE,
    ktp_number TEXT NULL,                   -- NIK KTP 16 digit
    pob TEXT NULL,                          -- Tempat Lahir
    dob DATE NULL,                          -- Tanggal Lahir
    gender TEXT NULL,                       -- 'Laki-laki' / 'Perempuan'
    religion TEXT NULL,                     -- Agama
    marital_status TEXT NULL,               -- 'Lajang', 'Menikah', 'Cerai'
    number_of_dependents INTEGER DEFAULT 0, -- Jumlah Tanggungan
    address_ktp TEXT NULL,                  -- Alamat sesuai KTP
    address_domicile TEXT NULL,             -- Alamat domisili saat ini
    phone TEXT NULL,                        -- Nomor HP / WhatsApp
    emergency_contact_name TEXT NULL,       -- Nama Kontak Darurat
    emergency_contact_phone TEXT NULL,      -- Nomor Telepon Darurat
    emergency_contact_relation TEXT NULL,   -- Hubungan (Orang Tua / Pasangan / Saudara)
    foto_profile_url TEXT NULL,             -- Pas Foto Karyawan
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT employee_personal_details_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees (id) ON DELETE CASCADE
);


-- 7. TABEL TRANSAKSI KARIR & REMUNERASI KARYAWAN (employee_career_histories)
-- Menampung seluruh riwayat mutasi, promosi, perubahan gaji, rekening payroll, BPJS, dan pajak
CREATE TABLE IF NOT EXISTS public.employee_career_histories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL,
    transaction_date DATE NOT NULL,
    effective_date DATE NOT NULL,
    transaction_type TEXT NOT NULL,         -- 'JOIN', 'PROMOTION', 'DEMOTION', 'MUTATION', 'ROTATION', 'SALARY_ADJUSTMENT', 'STATUS_CHANGE', 'RESIGN', 'TERMINATION'
    no_sk TEXT NULL,                        -- Nomor Surat Keputusan
    file_sk_url TEXT NULL,                  -- Lampiran Dokumen SK (PDF/Gambar)
    description TEXT NULL,                  -- Catatan & Alasan HR

    -- 1. Transaksi Struktural / Karir
    previous_position_id TEXT NULL,
    new_position_id TEXT NULL,
    previous_location_id TEXT NULL,
    new_location_id TEXT NULL,
    previous_level_id TEXT NULL,
    new_level_id TEXT NULL,
    previous_supervisor_id UUID NULL,
    new_supervisor_id UUID NULL,
    previous_status_kerja TEXT NULL,
    new_status_kerja TEXT NULL,

    -- 2. Transaksi Remunerasi, Gaji & Pajak (Historis Perubahan Gaji & Benefit)
    previous_basic_salary NUMERIC NULL,
    new_basic_salary NUMERIC NULL,
    previous_allowances NUMERIC NULL,
    new_allowances NUMERIC NULL,
    bank_name TEXT NULL,                    -- Bank Penggajian (BCA, Mandiri, BRI, BNI, dll.)
    bank_account_no TEXT NULL,              -- Nomor Rekening Payroll
    bank_account_holder TEXT NULL,          -- Nama Pemilik Rekening
    npwp_number TEXT NULL,                  -- Nomor Pokok Wajib Pajak
    tax_status TEXT NULL,                   -- Status Pajak (TK/0, K/0, K/1, K/2, K/3)
    bpjs_kesehatan_number TEXT NULL,        -- Nomor BPJS Kesehatan
    bpjs_ketenagakerjaan_number TEXT NULL,  -- Nomor BPJS Ketenagakerjaan

    approved_by_nip TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT employee_career_histories_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees (id) ON DELETE CASCADE,
    CONSTRAINT employee_career_histories_previous_position_fkey FOREIGN KEY (previous_position_id) REFERENCES public.job_positions (id_position) ON DELETE SET NULL,
    CONSTRAINT employee_career_histories_new_position_fkey FOREIGN KEY (new_position_id) REFERENCES public.job_positions (id_position) ON DELETE SET NULL,
    CONSTRAINT employee_career_histories_previous_location_fkey FOREIGN KEY (previous_location_id) REFERENCES public.organization_units (id_unit) ON DELETE SET NULL,
    CONSTRAINT employee_career_histories_new_location_fkey FOREIGN KEY (new_location_id) REFERENCES public.organization_units (id_unit) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_career_histories_employee ON public.employee_career_histories (employee_id, effective_date DESC);


-- 8. EKOSISTEM SSO TERPADU (sso_clients & sso_tokens)
CREATE TABLE IF NOT EXISTS public.sso_clients (
    client_id VARCHAR(50) PRIMARY KEY,
    client_name VARCHAR(100) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    app_icon TEXT,
    redirect_uris JSONB DEFAULT '[]'::jsonb,
    allowed_origins JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Data Aplikasi Satelit Ekosistem Digiasha
INSERT INTO public.sso_clients (client_id, client_name, client_secret, description)
VALUES 
  ('digicore', 'DigiCore Enterprise System', 'secret_digicore_2026', 'Core Business Engine & Operations'),
  ('digi_workapp', 'Digi Workapp', 'secret_workapp_2026', 'Aplikasi Penugasan Mobile Karyawan'),
  ('digi_active', 'Digi Active (Digi-Action)', 'secret_active_2026', 'Master HR, Presensi & SSO IdP'),
  ('digi_spector', 'Digi Spector', 'secret_spector_2026', 'Aplikasi Inspeksi Kendaraan & Aset')
ON CONFLICT (client_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.sso_tokens (
    token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_code VARCHAR(100) UNIQUE,
    nip VARCHAR(50),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    client_id VARCHAR(50) REFERENCES public.sso_clients(client_id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    session_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RPC Verifikasi Token SSO untuk Konsumsi Aplikasi Satelit
CREATE OR REPLACE FUNCTION public.verify_sso_token(
    p_auth_code VARCHAR,
    p_client_id VARCHAR,
    p_client_secret VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client RECORD;
    v_token RECORD;
    v_emp RECORD;
    v_detail RECORD;
    v_pos RECORD;
    v_unit RECORD;
    v_latest_career RECORD;
BEGIN
    SELECT * INTO v_client FROM public.sso_clients WHERE client_id = p_client_id AND client_secret = p_client_secret AND is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Kredensial client SSO tidak valid');
    END IF;

    SELECT * INTO v_token FROM public.sso_tokens 
    WHERE auth_code = p_auth_code AND client_id = p_client_id AND is_used = FALSE AND expires_at > NOW();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Token SSO tidak ditemukan atau kadaluarsa');
    END IF;

    UPDATE public.sso_tokens SET is_used = TRUE WHERE token_id = v_token.token_id;

    SELECT * INTO v_emp FROM public.employees WHERE id = v_token.employee_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Akun karyawan tidak ditemukan atau non-aktif');
    END IF;

    SELECT * INTO v_detail FROM public.employee_personal_details WHERE employee_id = v_emp.id;
    SELECT * INTO v_pos FROM public.job_positions WHERE id_position = v_emp.position_id;
    SELECT * INTO v_unit FROM public.organization_units WHERE id_unit = v_emp.location_id;
    SELECT * INTO v_latest_career FROM public.employee_career_histories WHERE employee_id = v_emp.id ORDER BY effective_date DESC LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_emp.id,
            'nip', v_emp.nip,
            'name', v_emp.name,
            'email', v_emp.email,
            'role', v_emp.role,
            'status_kerja', v_emp.status_kerja,
            'position_id', v_emp.position_id,
            'nama_jabatan', COALESCE(v_pos.nama_jabatan, '-'),
            'location_id', v_emp.location_id,
            'nama_unit', COALESCE(v_unit.nama_unit, '-'),
            'tipe_unit', COALESCE(v_unit.tipe_unit, '-'),
            'phone', COALESCE(v_detail.phone, '-'),
            'foto_profile_url', v_detail.foto_profile_url,
            'bank_name', COALESCE(v_latest_career.bank_name, '-'),
            'bank_account_no', COALESCE(v_latest_career.bank_account_no, '-')
        )
    );
END;
$$;


-- 9. BRIDGE SINKRONISASI OTOMATIS KE TABEL LAMA (m_employee)
-- Memastikan tabel m_employee tetap up-to-date sehingga sistem berjalan saat ini (login, presensi, visit) 100% aman
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
        COALESCE((SELECT nama_jabatan FROM public.job_positions WHERE id_position = NEW.position_id), NEW.role, '-'),
        COALESCE((SELECT nama_unit FROM public.organization_units WHERE id_unit = NEW.location_id), 'Head Office'),
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

DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.employees;
CREATE TRIGGER trg_sync_employees_to_legacy
AFTER INSERT OR UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.sync_employees_to_legacy_m_employee();
