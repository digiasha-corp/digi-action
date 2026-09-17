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


-- 2. PASTIKAN MASTER UNIT TERISI DARI CABANG m_employee
INSERT INTO public.organization_units (id_unit, tipe_unit, nama_unit, parent_unit_id, is_active)
SELECT DISTINCT
    'UNIT-' || UPPER(REPLACE(REPLACE(TRIM(cabang), ' ', '-'), '/', '-')),
    'CABANG',
    TRIM(cabang),
    'HO-CORP',
    TRUE
FROM public.m_employee
WHERE cabang IS NOT NULL AND TRIM(cabang) <> ''
ON CONFLICT (id_unit) DO UPDATE SET
    nama_unit = EXCLUDED.nama_unit;


-- 3. PASTIKAN MASTER JABATAN TERISI DARI JABATAN m_employee
INSERT INTO public.job_positions (id_position, nama_jabatan, level_id, unit_id, is_active)
SELECT DISTINCT
    'POS-' || UPPER(REPLACE(REPLACE(REPLACE(TRIM(jabatan), ' ', '-'), '/', '-'), '&', 'AND')),
    TRIM(jabatan),
    'L-04',
    'HO-CORP',
    TRUE
FROM public.m_employee
WHERE jabatan IS NOT NULL AND TRIM(jabatan) <> ''
ON CONFLICT (id_position) DO UPDATE SET
    nama_jabatan = EXCLUDED.nama_jabatan;


-- 4. DUPLIKASI DATA KARYAWAN DARI m_employee KE employees
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
SELECT DISTINCT ON (m.nip)
    gen_random_uuid(),
    m.nip,
    COALESCE(m.nama_lengkap, m.nip),
    COALESCE(m.email, LOWER(m.nip) || '@digiasha.com'),
    COALESCE(
        (SELECT id_unit FROM public.organization_units WHERE LOWER(nama_unit) = LOWER(TRIM(m.cabang)) LIMIT 1),
        'HO-CORP'
    ),
    COALESCE(
        (SELECT id_position FROM public.job_positions WHERE LOWER(nama_jabatan) = LOWER(TRIM(m.jabatan)) LIMIT 1),
        'POS-SPV-FAC'
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


-- 5. SAMBUNGKAN ATASAN LANGSUNG (SUPERVISOR) BERDASARKAN atasan_nip
UPDATE public.employees e
SET supervisor_id = atasan.id
FROM public.m_employee m
JOIN public.employees atasan ON atasan.nip = m.atasan_nip
WHERE e.nip = m.nip AND m.atasan_nip IS NOT NULL AND m.atasan_nip <> '';


-- 6. BUAT BARIS DATA PRIBADI SIPIL AWAL DI employee_personal_details
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
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    e.id,
    NULL,
    NULL,
    NULL,
    'Laki-laki',
    'Islam',
    'Lajang',
    0,
    NULL,
    NULL,
    NULL,
    NOW(),
    NOW()
FROM public.employees e
ON CONFLICT (employee_id) DO NOTHING;


-- 7. BUAT TRANSAKSI AWAL KEPEGAWAIAN (employee_career_histories)
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
    NULL,
    NULL,
    'BCA',
    NULL,
    e.name,
    NULL,
    NULL,
    NULL,
    'TK/0',
    NOW()
FROM public.employees e
WHERE NOT EXISTS (
    SELECT 1 FROM public.employee_career_histories ech WHERE ech.employee_id = e.id
);

-- Hak akses penuh
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_career_histories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_positions TO anon, authenticated, service_role;
