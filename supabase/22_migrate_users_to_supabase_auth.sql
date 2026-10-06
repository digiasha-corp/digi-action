-- =========================================================================
-- MIGRATION: MIGRATE ALL HR_EMPLOYEES TO SUPABASE AUTH (auth.users)
-- =========================================================================
-- Script ini akan mendaftarkan seluruh karyawan yang ada di hr_employees
-- ke dalam sistem keamanan Supabase (auth.users) secara otomatis,
-- lalu menautkan ID mereka kembali ke hr_employees.user_id.
-- Semua password di-reset menjadi: Password123!
-- =========================================================================

DO $$
DECLARE
    emp_record RECORD;
    new_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- Supabase menggunakan bcrypt untuk auth.users
    -- Membuat hash bcrypt untuk 'Password123!'
    encrypted_pw := crypt('Password123!', gen_salt('bf'));

    FOR emp_record IN 
        SELECT id, nip, email, name 
        FROM public.hr_employees 
        WHERE user_id IS NULL 
    LOOP
        -- 1. Pastikan email tidak kosong (gunakan fallback nip@digiasha.com)
        DECLARE
            final_email TEXT := COALESCE(NULLIF(TRIM(emp_record.email), ''), LOWER(TRIM(emp_record.nip)) || '@digiasha.com');
        BEGIN
            -- 2. Cek apakah user sudah ada di auth.users berdasarkan email
            SELECT id INTO new_user_id FROM auth.users WHERE email = final_email;

            IF new_user_id IS NULL THEN
                -- 3. Jika belum ada, buat UUID baru dan insert ke auth.users
                new_user_id := gen_random_uuid();
                
                INSERT INTO auth.users (
                    instance_id, id, aud, role, email, encrypted_password, 
                    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
                    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
                    confirmation_token, email_change, email_change_token_new, recovery_token
                ) VALUES (
                    '00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', final_email, encrypted_pw, 
                    NOW(), NULL, NULL, 
                    '{"provider":"email","providers":["email"]}', 
                    jsonb_build_object('name', emp_record.name, 'nip', emp_record.nip), 
                    NOW(), NOW(), 
                    '', '', '', ''
                );
                
                -- Insert ke auth.identities agar bisa login
                INSERT INTO auth.identities (
                    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
                ) VALUES (
                    gen_random_uuid(), new_user_id, format('{"sub":"%s","email":"%s"}', new_user_id::text, final_email)::jsonb, 'email', NULL, NOW(), NOW()
                );
            ELSE
                -- Jika email sudah ada di auth.users, kita paksa reset passwordnya ke default
                UPDATE auth.users SET encrypted_password = encrypted_pw WHERE id = new_user_id;
            END IF;

            -- 4. Tautkan auth.users.id ke hr_employees.user_id
            UPDATE public.hr_employees 
            SET user_id = new_user_id 
            WHERE id = emp_record.id;

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Gagal memigrasi NIP %: %', emp_record.nip, SQLERRM;
        END;
    END LOOP;
END $$;
