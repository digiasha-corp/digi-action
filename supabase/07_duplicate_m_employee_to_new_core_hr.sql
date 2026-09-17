-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 07_duplicate_m_employee_to_new_core_hr.sql
-- DUPLIKASI DATA LAMA (m_employee) KE DATABASE BARU (employees / hr_employees)
-- DENGAN PEMUTUSAN KONEKSI OTOMATIS (100% ISOLASI & INDEPENDEN)
-- =========================================================================
-- Tujuan:
-- 1. Melepaskan (DROP) trigger sinkronisasi otomatis ke m_employee.
--    Database Personalia Baru kini 100% terisolasi dan tidak menyentuh tabel m_employee live.
-- 2. Menduplikasi seluruh 13 karyawan aktif dari m_employee ke employees (hr_employees).
-- 3. Membuat baris data awal di employee_personal_details (siap diisi NIK, TTL, Alamat, Darurat).
-- 4. Membuat baris data awal di employee_career_histories (JOIN / Pengangkatan Awal).
-- =========================================================================

-- 1. PUTUSKAN TRIGGER KE TABEL LAMA (ISOLASI DATABASE BARU)
DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.employees;
DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.hr_employees;
DROP FUNCTION IF EXISTS public.sync_employees_to_legacy_m_employee();


-- 2. PASTIKAN MASTER JABATAN & UNIT LENGKAP UNTUK MEMETAKAN DATA LAMA
-- Sinkronkan nama unit dari cabang m_employee jika belum ada di organization_units
INSERT INTO public.organization_units (id_unit, name, code, type, level, is_active)
SELECT 
    'UNIT_' || UPPER(REPLACE(REPLACE(cabang, ' ', '_'), '-', '_')),
    cabang,
    'CAB_' || UPPER(SUBSTRING(REPLACE(cabang, ' ', ''), 1, 6)),
    'CABANG',
    3,
    TRUE
FROM public.m_employee
WHERE cabang IS NOT NULL AND cabang <> ''
ON CONFLICT (id_unit) DO NOTHING;

-- Sinkronkan nama jabatan dari m_employee jika belum ada di job_positions
INSERT INTO public.job_positions (id_position, title, code, unit_id, level_id, is_active)
SELECT 
    'POS_' || UPPER(REPLACE(REPLACE(jabatan, ' ', '_'), '/', '_')),
    jabatan,
    'JAB_' || UPPER(SUBSTRING(REPLACE(jabatan, ' ', ''), 1, 6)),
    'HO_MAIN',
    'LVL_STAFF',
    TRUE
FROM public.m_employee
WHERE jabatan IS NOT NULL AND jabatan <> ''
ON CONFLICT (id_position) DO NOTHING;


-- 3. DUPLIKASI DATA KARYAWAN DARI m_employee KE employees (hr_employees)
INSERT INTO public.employees (
    id,
    nip,
    name,
    email,
    location_id,
    position_id,
    role,
    status_kerja,
    tanggal_masuk,
    deleted_at,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    m.nip,
    COALESCE(m.nama_lengkap, m.nip),
    COALESCE(m.email, LOWER(m.nip) || '@digiasha.com'),
    COALESCE(
        (SELECT id_unit FROM public.organization_units WHERE LOWER(name) = LOWER(m.cabang) LIMIT 1),
        'HO_MAIN'
    ),
    COALESCE(
        (SELECT id_position FROM public.job_positions WHERE LOWER(title) = LOWER(m.jabatan) LIMIT 1),
        'POS_STAFF_FAC'
    ),
    COALESCE(m.role_id, 'R-04'),
    'PKWTT',
    COALESCE(m.created_at::date, CURRENT_DATE),
    CASE WHEN m.status_aktif = 'NONAKTIF' THEN NOW() ELSE NULL END,
    NOW(),
    NOW()
FROM public.m_employee m
ON CONFLICT (nip) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    location_id = EXCLUDED.location_id,
    position_id = EXCLUDED.position_id,
    role = EXCLUDED.role,
    updated_at = NOW();


-- 4. SAMBUNGKAN ATASAN LANGSUNG (SUPERVISOR) BERDASARKAN atasan_nip
UPDATE public.employees e
SET supervisor_id = atasan.id
FROM public.m_employee m
JOIN public.employees atasan ON atasan.nip = m.atasan_nip
WHERE e.nip = m.nip AND m.atasan_nip IS NOT NULL;


-- 5. DUPLIKASI DATA AWAL KE TABEL IDENTITAS SIPIL (employee_personal_details)
INSERT INTO public.employee_personal_details (
    id,
    employee_id,
    ktp_number,
    pob,
    dob,
    gender,
    religion,
    marital_status,
    number_of_dependents,
    address_ktp,
    address_domicile,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    e.id,
    NULL,                     -- NIK KTP siap diisi
    NULL,                     -- Tempat Lahir siap diisi
    NULL,                     -- Tanggal Lahir siap diisi
    'Laki-laki',              -- Default Gender
    'Islam',                  -- Default Agama
    'Lajang',                 -- Default Status Pernikahan
    0,                        -- Tanggungan
    NULL,                     -- Alamat KTP siap diisi
    NULL,                     -- Alamat Domisili siap diisi
    NULL,                     -- No HP
    NULL,                     -- Kontak Darurat
    NULL,
    NULL,
    NOW(),
    NOW()
FROM public.employees e
ON CONFLICT (employee_id) DO NOTHING;


-- 6. BUAT TRANSAKSI AWAL KEPEGAWAIAN (employee_career_histories)
INSERT INTO public.employee_career_histories (
    id,
    employee_id,
    transaction_date,
    effective_date,
    transaction_type,
    no_sk,
    description,
    new_position_id,
    new_location_id,
    new_status_kerja,
    new_basic_salary,
    new_allowances,
    bank_name,
    bank_account_no,
    bank_account_holder,
    bpjs_kesehatan_number,
    bpjs_ketenagakerjaan_number,
    npwp_number,
    tax_status,
    created_at
)
SELECT 
    gen_random_uuid(),
    e.id,
    COALESCE(e.tanggal_masuk, CURRENT_DATE),
    COALESCE(e.tanggal_masuk, CURRENT_DATE),
    'JOIN',
    'SK/DIR/' || TO_CHAR(COALESCE(e.tanggal_masuk, CURRENT_DATE), 'YYYY') || '/' || e.nip,
    'Pengangkatan Awal Karyawan (Migrasi Core HR)',
    e.position_id,
    e.location_id,
    e.status_kerja,
    NULL,                     -- Gaji Pokok siap diinput
    NULL,                     -- Tunjangan siap diinput
    'BCA',                    -- Default Bank Payroll
    NULL,                     -- Nomor Rekening siap diinput
    e.name,                   -- Atas Nama Rekening
    NULL,                     -- BPJS Kesehatan
    NULL,                     -- BPJS Ketenagakerjaan
    NULL,                     -- NPWP
    'TK/0',                   -- Status Pajak Awal
    NOW()
FROM public.employees e
WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_career_histories ech WHERE ech.employee_id = e.id
);

-- Berikan izin akses penuh ke tabel baru
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_career_histories TO anon, authenticated, service_role;
