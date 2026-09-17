-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 07_duplicate_m_employee_to_new_core_hr.sql
-- DUPLIKASI DATA LAMA (m_employee) KE DATABASE BARU (employees / hr_employees)
-- DENGAN PEMBERSIHAN TABEL BARU (TRUNCATE) & 100% ISOLASI DARI TABEL LAMA
-- =========================================================================
-- Tujuan:
-- 1. Melepaskan (DROP) trigger sinkronisasi otomatis ke m_employee.
--    Database Personalia Baru kini 100% terisolasi dan tidak menyentuh m_employee live.
-- 2. Membersihkan secara tuntas (TRUNCATE CASCADE) tabel baru agar fresh & bersih.
--    Tabel lama m_employee 100% AMAN dan TIDAK DISENTUH.
-- 3. Memasukkan Unit & Jabatan unik dengan GROUP BY + ON CONFLICT DO NOTHING
--    (Mencegah error 21000: ON CONFLICT DO UPDATE cannot affect row a second time).
-- 4. Menduplikasi 13 karyawan aktif dari m_employee ke employees.
-- 5. Membuat baris data awal di employee_personal_details & employee_career_histories.
-- =========================================================================

-- 1. PUTUSKAN TRIGGER KE TABEL LAMA (ISOLASI DATABASE BARU)
DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.employees;
DROP TRIGGER IF EXISTS trg_sync_employees_to_legacy ON public.hr_employees;
DROP FUNCTION IF EXISTS public.sync_employees_to_legacy_m_employee();


-- 2. BERSIHKAN TABEL DATA BARU AGAR FRESH (Tabel lama m_employee TIDAK disentuh)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_career_histories') THEN
        TRUNCATE TABLE public.employee_career_histories CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employee_personal_details') THEN
        TRUNCATE TABLE public.employee_personal_details CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employees') THEN
        TRUNCATE TABLE public.employees CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'hr_employees') THEN
        TRUNCATE TABLE public.hr_employees CASCADE;
    END IF;
END $$;


-- 3. PASTIKAN MASTER UNIT TERISI DARI CABANG m_employee (DI-GROUP BY UNTUK CEGAH DUPLIKAT BATCH)
INSERT INTO public.organization_units (id_unit, tipe_unit, nama_unit, parent_unit_id, is_active)
SELECT 
    u.id_unit,
    'CABANG' AS tipe_unit,
    u.nama_unit,
    'HO-CORP' AS parent_unit_id,
    TRUE AS is_active
FROM (
    SELECT 
        'UNIT-' || UPPER(REGEXP_REPLACE(TRIM(cabang), '[^a-zA-Z0-9]+', '-', 'g')) AS id_unit,
        MIN(TRIM(cabang)) AS nama_unit
    FROM public.m_employee
    WHERE cabang IS NOT NULL AND TRIM(cabang) <> ''
    GROUP BY 'UNIT-' || UPPER(REGEXP_REPLACE(TRIM(cabang), '[^a-zA-Z0-9]+', '-', 'g'))
) u
ON CONFLICT (id_unit) DO NOTHING;


-- 4. PASTIKAN MASTER JABATAN TERISI DARI JABATAN m_employee (DI-GROUP BY UNTUK CEGAH DUPLIKAT BATCH)
INSERT INTO public.job_positions (id_position, nama_jabatan, level_id, unit_id, is_active)
SELECT 
    p.id_position,
    p.nama_jabatan,
    'L-04' AS level_id,
    'HO-CORP' AS unit_id,
    TRUE AS is_active
FROM (
    SELECT 
        'POS-' || UPPER(REGEXP_REPLACE(TRIM(jabatan), '[^a-zA-Z0-9]+', '-', 'g')) AS id_position,
        MIN(TRIM(jabatan)) AS nama_jabatan
    FROM public.m_employee
    WHERE jabatan IS NOT NULL AND TRIM(jabatan) <> ''
    GROUP BY 'POS-' || UPPER(REGEXP_REPLACE(TRIM(jabatan), '[^a-zA-Z0-9]+', '-', 'g'))
) p
ON CONFLICT (id_position) DO NOTHING;


-- 5. DUPLIKASI DATA KARYAWAN DARI m_employee KE employees (NEW CORE HR DATABASE)
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
    -- Pastikan email unik per NIP untuk mencegah duplikasi constraint email
    CASE 
        WHEN m.email IS NOT NULL AND TRIM(m.email) <> '' 
             AND (SELECT COUNT(*) FROM public.m_employee me WHERE LOWER(TRIM(me.email)) = LOWER(TRIM(m.email))) = 1
        THEN LOWER(TRIM(m.email))
        ELSE LOWER(REGEXP_REPLACE(TRIM(m.nip), '[^a-zA-Z0-9]', '', 'g')) || '@digiasha.com'
    END AS email,
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
FROM (
    SELECT DISTINCT ON (TRIM(nip)) *
    FROM public.m_employee
    WHERE nip IS NOT NULL AND TRIM(nip) <> ''
    ORDER BY TRIM(nip), created_at DESC NULLS LAST
) m
ON CONFLICT (nip) DO NOTHING;


-- 6. SAMBUNGKAN ATASAN LANGSUNG (SUPERVISOR) BERDASARKAN atasan_nip
UPDATE public.employees e
SET supervisor_id = atasan.id
FROM public.m_employee m
JOIN public.employees atasan ON atasan.nip = m.atasan_nip
WHERE e.nip = m.nip AND m.atasan_nip IS NOT NULL AND m.atasan_nip <> '';


-- 7. BUAT BARIS DATA PRIBADI SIPIL AWAL DI employee_personal_details
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


-- 8. BUAT TRANSAKSI AWAL KEPEGAWAIAN (employee_career_histories)
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
FROM public.employees e;


-- 9. BERIKAN HAK AKSES API SUPABASE
GRANT ALL ON TABLE public.employees TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_career_histories TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.organization_units TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_positions TO anon, authenticated, service_role;
