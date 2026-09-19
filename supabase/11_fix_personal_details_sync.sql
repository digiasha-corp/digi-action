-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 11_fix_personal_details_sync.sql
-- MEMPERBAIKI SKEMA & SINKRONISASI DATA PRIBADI (hr_employee_personal_details)
-- =========================================================================

-- 1. Tambah kolom yang diperlukan oleh modul pembaruan profil / transaksi ke tabel fisik
ALTER TABLE IF EXISTS public.hr_employee_personal_details
ADD COLUMN IF NOT EXISTS spouse_name TEXT NULL,
ADD COLUMN IF NOT EXISTS education TEXT NULL,
ADD COLUMN IF NOT EXISTS major TEXT NULL,
ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;

-- 2. Buat Ulang View backward compatibility agar langsung mengenali kolom-kolom baru
DROP VIEW IF EXISTS public.employee_personal_details;
CREATE OR REPLACE VIEW public.employee_personal_details WITH (security_invoker = on) 
AS SELECT * FROM public.hr_employee_personal_details;

-- 3. Berikan permission akses ke view & tabel
GRANT ALL ON TABLE public.hr_employee_personal_details TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.employee_personal_details TO anon, authenticated, service_role;

-- 4. KOREKSI OTOMATIS: Terapkan transaksi yang sudah APPROVED tapi belum masuk ke employee_personal_details
-- Khusus untuk data transaksi yang sudah disetujui (seperti transaksi 34254f8b-9e6c-4403-99fb-0b262f16c547)
DO $$
DECLARE
    r RECORD;
    v_pu JSONB;
BEGIN
    FOR r IN 
        SELECT id, employee_id, personal_data_updates 
        FROM public.hr_employee_transactions 
        WHERE status = 'APPROVED' AND personal_data_updates IS NOT NULL
    LOOP
        -- Konversi text ke jsonb jika perlu
        BEGIN
            v_pu := r.personal_data_updates::jsonb;
        EXCEPTION WHEN OTHERS THEN
            v_pu := NULL;
        END;

        IF v_pu IS NOT NULL THEN
            UPDATE public.hr_employee_personal_details
            SET 
                ktp_number = COALESCE(v_pu->>'ktp_number', v_pu->>'nik_ktp', ktp_number),
                pob = COALESCE(v_pu->>'pob', pob),
                dob = CASE WHEN (v_pu->>'dob') IS NOT NULL AND (v_pu->>'dob') != '' THEN (v_pu->>'dob')::date ELSE dob END,
                gender = COALESCE(v_pu->>'gender', gender),
                religion = COALESCE(v_pu->>'religion', religion),
                marital_status = COALESCE(v_pu->>'marital_status', marital_status),
                spouse_name = COALESCE(v_pu->>'spouse_name', spouse_name),
                number_of_dependents = COALESCE((v_pu->>'number_of_dependents')::integer, number_of_dependents),
                address_ktp = COALESCE(v_pu->>'address_ktp', address_ktp),
                address_domicile = COALESCE(v_pu->>'address_domicile', address_domicile),
                phone = COALESCE(v_pu->>'phone', phone),
                emergency_contact_name = COALESCE(v_pu->>'emergency_contact_name', emergency_contact_name),
                emergency_contact_relation = COALESCE(v_pu->>'emergency_contact_relation', emergency_contact_relation),
                emergency_contact_phone = COALESCE(v_pu->>'emergency_contact_phone', emergency_contact_phone),
                education = COALESCE(v_pu->>'education_level', education),
                major = COALESCE(v_pu->>'education_major', major),
                personal_details = COALESCE(personal_details, '{}'::jsonb) || v_pu,
                updated_at = NOW()
            WHERE employee_id = r.employee_id;
        END IF;
    END LOOP;
END $$;
