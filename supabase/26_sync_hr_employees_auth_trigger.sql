-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 26_sync_hr_employees_auth_trigger.sql
-- SINKRONISASI OTOMATIS HR_EMPLOYEES KE SUPABASE AUTH (auth.users & identities)
-- =========================================================================
-- Fitur:
-- 1. Otomatis membuat akun auth.users & auth.identities saat karyawan aktif
--    baru ditambahkan atau diaktifkan kembali.
-- 2. Menghubungkan auth.users.id ke hr_employees.user_id.
-- 3. Otomatis menghapus akun dari auth.users saat karyawan dinonaktifkan
--    (deleted_at IS NOT NULL atau status_kerja IN ('RESIGNED', 'TERMINATED', 'INACTIVE')).
-- 4. Otomatis menghapus akun dari auth.users jika data di hr_employees di-DELETE.
-- 5. Script retroaktif untuk memperbaiki data yang ada saat ini (membuatkan auth
--    untuk DUMMY DUN dan menghapus auth karyawan non-aktif seperti ARPAN ARDIANSYAH).
-- =========================================================================

-- Pastikan pgcrypto aktif untuk enkripsi password bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -------------------------------------------------------------------------
-- 1. FUNGSI TRIGGER SINKRONISASI SEBELUM/SETELAH INSERT/UPDATE/DELETE
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_hr_employee_auth_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, pg_temp
AS $$
DECLARE
    v_final_email TEXT;
    v_existing_auth_id UUID;
    v_new_user_id UUID;
    v_encrypted_pw TEXT;
    v_is_inactive BOOLEAN;
BEGIN
    -- [KASUS 1: DELETE PADA TABEL HR_EMPLOYEES]
    IF TG_OP = 'DELETE' THEN
        IF OLD.user_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = OLD.user_id;
        ELSIF OLD.email IS NOT NULL AND TRIM(OLD.email) <> '' THEN
            DELETE FROM auth.users WHERE email = LOWER(TRIM(OLD.email));
        END IF;
        RETURN OLD;
    END IF;

    -- Evaluasi apakah karyawan berstatus tidak aktif atau sudah dihapus (soft-delete)
    v_is_inactive := (
        NEW.deleted_at IS NOT NULL 
        OR LOWER(COALESCE(NEW.status_kerja, '')) IN ('resigned', 'terminated', 'non-aktif', 'inactive')
    );

    -- [KASUS 2: KARYAWAN TIDAK AKTIF / DIHAPUS (SOFT-DELETE)]
    IF v_is_inactive THEN
        -- Hapus akun auth jika sebelumnya ada
        IF NEW.user_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = NEW.user_id;
            NEW.user_id := NULL;
        END IF;

        -- Bersihkan juga jika ada akun auth berdasarkan email yang sama
        IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
            DELETE FROM auth.users WHERE email = LOWER(TRIM(NEW.email));
        END IF;

        RETURN NEW;
    END IF;

    -- [KASUS 3: KARYAWAN AKTIF (INSERT / UPDATE)]
    -- Tentukan email valid (fallback ke nip@digiasha.com)
    v_final_email := LOWER(TRIM(COALESCE(NULLIF(TRIM(NEW.email), ''), TRIM(NEW.nip) || '@digiasha.com')));

    -- Cek apakah sudah ada akun di auth.users (berdasarkan user_id yang ada atau berdasarkan email)
    IF NEW.user_id IS NOT NULL THEN
        SELECT id INTO v_existing_auth_id FROM auth.users WHERE id = NEW.user_id;
    END IF;

    IF v_existing_auth_id IS NULL THEN
        SELECT id INTO v_existing_auth_id FROM auth.users WHERE email = v_final_email;
    END IF;

    -- Jika belum ada di auth.users, buat akun baru
    IF v_existing_auth_id IS NULL THEN
        v_new_user_id := gen_random_uuid();
        -- Password default: Password123!
        v_encrypted_pw := extensions.crypt('Password123!', extensions.gen_salt('bf'));

        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, recovery_sent_at, last_sign_in_at, 
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
            confirmation_token, email_change, email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000', v_new_user_id, 'authenticated', 'authenticated', 
            v_final_email, v_encrypted_pw, 
            NOW(), NULL, NULL, 
            '{"provider":"email","providers":["email"]}', 
            jsonb_build_object('name', NEW.name, 'nip', NEW.nip), 
            NOW(), NOW(), 
            '', '', '', ''
        );

        INSERT INTO auth.identities (
            id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
        ) VALUES (
            gen_random_uuid(), v_new_user_id::text, v_new_user_id, 
            format('{"sub":"%s","email":"%s"}', v_new_user_id::text, v_final_email)::jsonb, 
            'email', NULL, NOW(), NOW()
        );

        NEW.user_id := v_new_user_id;
    ELSE
        -- Jika akun auth sudah ada, sinkronkan data email / metadata jika ada perubahan
        UPDATE auth.users 
        SET email = v_final_email,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', NEW.name, 'nip', NEW.nip),
            updated_at = NOW()
        WHERE id = v_existing_auth_id;

        -- Update email pada identities
        UPDATE auth.identities
        SET identity_data = format('{"sub":"%s","email":"%s"}', v_existing_auth_id::text, v_final_email)::jsonb,
            updated_at = NOW()
        WHERE user_id = v_existing_auth_id AND provider = 'email';

        NEW.user_id := v_existing_auth_id;
    END IF;

    RETURN NEW;
END;
$$;

-- -------------------------------------------------------------------------
-- 2. MEMASANG TRIGGER PADA TABEL PUBLIC.HR_EMPLOYEES
-- -------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_hr_employees_auth_biu ON public.hr_employees;
CREATE TRIGGER trg_sync_hr_employees_auth_biu
BEFORE INSERT OR UPDATE OF name, nip, email, deleted_at, status_kerja
ON public.hr_employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_hr_employee_auth_sync();

DROP TRIGGER IF EXISTS trg_sync_hr_employees_auth_del ON public.hr_employees;
CREATE TRIGGER trg_sync_hr_employees_auth_del
BEFORE DELETE
ON public.hr_employees
FOR EACH ROW
EXECUTE FUNCTION public.handle_hr_employee_auth_sync();

-- -------------------------------------------------------------------------
-- 3. EKSEKUSI SINKRONISASI RETROAKTIF (DATA YANG SUDAH ADA SEKARANG)
-- -------------------------------------------------------------------------
DO $$
DECLARE
    emp RECORD;
    v_encrypted_pw TEXT;
    v_final_email TEXT;
    v_target_user_id UUID;
BEGIN
    v_encrypted_pw := extensions.crypt('Password123!', extensions.gen_salt('bf'));

    -- A. HAPUS DARI AUTH.USERS UNTUK SEMUA KARYAWAN YANG SUDAH DELETED ATAU TIDAK AKTIF
    FOR emp IN 
        SELECT id, nip, email, user_id 
        FROM public.hr_employees 
        WHERE deleted_at IS NOT NULL 
           OR LOWER(COALESCE(status_kerja, '')) IN ('resigned', 'terminated', 'non-aktif', 'inactive')
    LOOP
        IF emp.user_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = emp.user_id;
            UPDATE public.hr_employees SET user_id = NULL WHERE id = emp.id;
        END IF;

        IF emp.email IS NOT NULL AND TRIM(emp.email) <> '' THEN
            DELETE FROM auth.users WHERE email = LOWER(TRIM(emp.email));
        END IF;
    END LOOP;

    -- B. BUATKAN / SINKRONKAN AKUN AUTH UNTUK SEMUA KARYAWAN AKTIF YANG BELUM PUNYA AUTH
    FOR emp IN 
        SELECT id, nip, email, name, user_id 
        FROM public.hr_employees 
        WHERE deleted_at IS NULL 
          AND LOWER(COALESCE(status_kerja, '')) NOT IN ('resigned', 'terminated', 'non-aktif', 'inactive')
    LOOP
        v_final_email := LOWER(TRIM(COALESCE(NULLIF(TRIM(emp.email), ''), TRIM(emp.nip) || '@digiasha.com')));
        v_target_user_id := NULL;

        IF emp.user_id IS NOT NULL THEN
            SELECT id INTO v_target_user_id FROM auth.users WHERE id = emp.user_id;
        END IF;

        IF v_target_user_id IS NULL THEN
            SELECT id INTO v_target_user_id FROM auth.users WHERE email = v_final_email;
        END IF;

        IF v_target_user_id IS NULL THEN
            v_target_user_id := gen_random_uuid();

            INSERT INTO auth.users (
                instance_id, id, aud, role, email, encrypted_password, 
                email_confirmed_at, recovery_sent_at, last_sign_in_at, 
                raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
                confirmation_token, email_change, email_change_token_new, recovery_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000', v_target_user_id, 'authenticated', 'authenticated', 
                v_final_email, v_encrypted_pw, 
                NOW(), NULL, NULL, 
                '{"provider":"email","providers":["email"]}', 
                jsonb_build_object('name', emp.name, 'nip', emp.nip), 
                NOW(), NOW(), 
                '', '', '', ''
            );

            INSERT INTO auth.identities (
                id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
            ) VALUES (
                gen_random_uuid(), v_target_user_id::text, v_target_user_id, 
                format('{"sub":"%s","email":"%s"}', v_target_user_id::text, v_final_email)::jsonb, 
                'email', NULL, NOW(), NOW()
            );
        END IF;

        -- Tautkan user_id ke hr_employees jika belum tertaut
        UPDATE public.hr_employees 
        SET user_id = v_target_user_id 
        WHERE id = emp.id AND (user_id IS NULL OR user_id <> v_target_user_id);
    END LOOP;
END $$;
