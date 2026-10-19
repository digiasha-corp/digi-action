SET local check_function_bodies = off;

CREATE TABLE "public"."m_cover_area" (
  "id_area"    uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nama_area"  text                     NOT NULL,
  "unit_id"    text                     NOT NULL,
  "pic_id"     uuid,
  "is_active"  boolean                  NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "m_cover_area_pkey" PRIMARY KEY (id_area)
);

ALTER TABLE "public"."m_dealer"
  ADD COLUMN "cover_area_id" uuid;

CREATE OR REPLACE FUNCTION public.admin_reset_employee_password (
  target_nip text
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    target_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- Only allow authenticated users to execute this
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the user_id from hr_employees based on NIP
    SELECT user_id INTO target_user_id
    FROM public.hr_employees
    WHERE nip = target_nip
    LIMIT 1;

    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'Employee with NIP % not found or has no linked auth user.', target_nip;
    END IF;

    -- Hash the default password 'Password123!'
    encrypted_pw := extensions.crypt('Password123!', extensions.gen_salt('bf'));

    -- Update auth.users directly
    UPDATE auth.users
    SET encrypted_password = encrypted_pw,
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Flag the employee in hr_employees to force password change on next login
    UPDATE public.hr_employees
    SET must_change_password = true,
        updated_at = NOW()
    WHERE nip = target_nip;

    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.debug_supervisor (
  p_pos text,
  p_loc text
)
  RETURNS text
  LANGUAGE plpgsql
  AS $function$
DECLARE
    v_curr_pos TEXT := p_pos;
    v_parent_pos TEXT;
    v_curr_unit TEXT;
    v_parent_unit TEXT;
    v_found UUID;
    v_log TEXT := 'START DIAGNOSA (' || p_pos || ' di ' || p_loc || '):' || CHR(10);
BEGIN
    WHILE v_curr_pos IS NOT NULL AND TRIM(v_curr_pos) <> '' LOOP
        SELECT jp.reports_to_unit_id INTO v_parent_pos FROM public.hr_job_positions jp WHERE TRIM(jp.id_position) = TRIM(v_curr_pos);
        v_log := v_log || '- Atasan dari [' || v_curr_pos || '] adalah [' || COALESCE(v_parent_pos, 'KOSONG/NULL') || ']' || CHR(10);
        IF v_parent_pos IS NULL OR TRIM(v_parent_pos) = '' THEN EXIT; END IF;
        
        v_curr_unit := p_loc;
        WHILE v_curr_unit IS NOT NULL AND TRIM(v_curr_unit) <> '' LOOP
            v_log := v_log || '  -> Mencari [' || v_parent_pos || '] di unit [' || v_curr_unit || ']... ';
            SELECT e.id INTO v_found FROM public.hr_employees e WHERE TRIM(e.position_id) = TRIM(v_parent_pos) AND (TRIM(e.location_id) = TRIM(v_curr_unit) OR e.location_id IS NULL) LIMIT 1;
            
            IF v_found IS NOT NULL THEN
                v_log := v_log || 'KETEMU! (Selesai)' || CHR(10);
                RETURN v_log;
            ELSE
                v_log := v_log || 'Gagal.' || CHR(10);
            END IF;
            
            SELECT ou.parent_unit_id INTO v_parent_unit FROM public.hr_organization_units ou WHERE TRIM(ou.id_unit) = TRIM(v_curr_unit);
            v_curr_unit := v_parent_unit;
        END LOOP;
        v_curr_pos := v_parent_pos;
    END LOOP;
    RETURN v_log || 'HASIL AKHIR: KOSONG (Semua silsilah buntu)';
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_apply_eod_transactions()
  RETURNS void
  LANGUAGE plpgsql
  AS $function$
DECLARE
    tx RECORD;
    v_now TIMESTAMP := NOW();
    v_pu JSONB;
    v_allowances_new NUMERIC;
    v_allowances_prev NUMERIC;
    v_new_status_kerja TEXT;
BEGIN
    FOR tx IN 
        SELECT * FROM hr_employee_transactions 
        WHERE status = 'APPROVED' AND (is_applied = FALSE OR is_applied IS NULL) AND effective_date <= CURRENT_DATE
    LOOP
        -- 1. UPDATE hr_employees
        UPDATE hr_employees
        SET 
            nip = COALESCE(NULLIF(tx.nip, 'N/A'), nip),
            location_id = COALESCE(tx.new_unit_id, tx.new_location_id, tx.unit_id, tx.work_location_id, location_id),
            position_id = COALESCE(tx.new_position_id, tx.position_id, position_id),
            status_kerja = CASE 
                WHEN tx.transaction_types::text ILIKE '%Tetap (PKWTT)%' OR tx.is_permanent_appointment THEN 'PKWTT'
                WHEN tx.transaction_types::text ILIKE '%Penerimaan Karyawan%' THEN COALESCE(tx.employment_status, 'PKWT')
                WHEN tx.transaction_types::text ILIKE '%Pengangkatan Kontrak%' OR tx.transaction_types::text ILIKE '%Perpanjang Kontrak%' THEN 'PKWT'
                ELSE status_kerja END,
            tanggal_masuk = COALESCE(tx.join_date, tanggal_masuk),
            tanggal_selesai_kontrak = CASE 
                WHEN tx.transaction_types::text ILIKE '%Tetap (PKWTT)%' THEN NULL 
                ELSE COALESCE(tx.contract_end_date, tanggal_selesai_kontrak) END,
            deleted_at = CASE 
                WHEN tx.transaction_types::text ILIKE '%Resign%' OR tx.transaction_types::text ILIKE '%PHK%' OR tx.transaction_types::text ILIKE '%Pensiun%' THEN COALESCE(tx.effective_date::timestamp, v_now)
                ELSE deleted_at END,
            updated_at = v_now
        WHERE id = tx.employee_id
        RETURNING status_kerja INTO v_new_status_kerja;

        -- 2. UPDATE PERSONAL DETAILS
        v_pu := tx.personal_data_updates;
        IF tx.transaction_types::text ILIKE '%Pembaruan Data Pribadi%' OR (v_pu IS NOT NULL AND v_pu::text != '{}') THEN
            UPDATE hr_employees SET
                name = COALESCE(v_pu->>'nama_lengkap', v_pu->>'name', name),
                email = COALESCE(v_pu->>'email', email)
            WHERE id = tx.employee_id;

            INSERT INTO hr_employee_personal_details (
                employee_id, ktp_number, npwp_number, pob, dob, gender, religion, marital_status, spouse_name, number_of_dependents, address_ktp, address_domicile, phone, emergency_contact_name, emergency_contact_relation, emergency_contact_phone, personal_details, updated_at
            ) VALUES (
                tx.employee_id,
                COALESCE(v_pu->>'ktp_number', v_pu->>'nik_ktp'), v_pu->>'npwp_number', v_pu->>'pob',
                NULLIF(v_pu->>'dob', '')::date, v_pu->>'gender', v_pu->>'religion', v_pu->>'marital_status',
                v_pu->>'spouse_name', COALESCE(NULLIF(v_pu->>'number_of_dependents', '')::int, 0), v_pu->>'address_ktp',
                v_pu->>'address_domicile', v_pu->>'phone', v_pu->>'emergency_contact_name', v_pu->>'emergency_contact_relation',
                v_pu->>'emergency_contact_phone', v_pu, v_now
            ) ON CONFLICT (employee_id) DO UPDATE SET
                ktp_number = COALESCE(EXCLUDED.ktp_number, hr_employee_personal_details.ktp_number),
                npwp_number = COALESCE(EXCLUDED.npwp_number, hr_employee_personal_details.npwp_number),
                pob = COALESCE(EXCLUDED.pob, hr_employee_personal_details.pob),
                dob = COALESCE(EXCLUDED.dob, hr_employee_personal_details.dob),
                gender = COALESCE(EXCLUDED.gender, hr_employee_personal_details.gender),
                religion = COALESCE(EXCLUDED.religion, hr_employee_personal_details.religion),
                marital_status = COALESCE(EXCLUDED.marital_status, hr_employee_personal_details.marital_status),
                spouse_name = COALESCE(EXCLUDED.spouse_name, hr_employee_personal_details.spouse_name),
                number_of_dependents = COALESCE(EXCLUDED.number_of_dependents, hr_employee_personal_details.number_of_dependents),
                address_ktp = COALESCE(EXCLUDED.address_ktp, hr_employee_personal_details.address_ktp),
                address_domicile = COALESCE(EXCLUDED.address_domicile, hr_employee_personal_details.address_domicile),
                phone = COALESCE(EXCLUDED.phone, hr_employee_personal_details.phone),
                emergency_contact_name = COALESCE(EXCLUDED.emergency_contact_name, hr_employee_personal_details.emergency_contact_name),
                emergency_contact_relation = COALESCE(EXCLUDED.emergency_contact_relation, hr_employee_personal_details.emergency_contact_relation),
                emergency_contact_phone = COALESCE(EXCLUDED.emergency_contact_phone, hr_employee_personal_details.emergency_contact_phone),
                personal_details = EXCLUDED.personal_details,
                updated_at = v_now;
        END IF;

        -- 3. INSERT CAREER HISTORY
        v_allowances_new := COALESCE(tx.new_allowance_jabatan, 0) + COALESCE(tx.new_allowance_transport, 0) + COALESCE(tx.new_allowance_komunikasi, 0) + COALESCE(tx.new_allowance_tempat_tinggal, 0) + COALESCE(tx.new_allowance_penempatan, 0) + COALESCE(tx.new_allowance_kemahalan, 0) + COALESCE(tx.new_allowance_makan, 0) + COALESCE(tx.new_allowance_khusus, 0) + COALESCE(tx.new_allowance_insentif, 0);
        v_allowances_prev := COALESCE(tx.prev_allowance_jabatan, 0) + COALESCE(tx.prev_allowance_transport, 0) + COALESCE(tx.prev_allowance_komunikasi, 0) + COALESCE(tx.prev_allowance_tempat_tinggal, 0) + COALESCE(tx.prev_allowance_penempatan, 0) + COALESCE(tx.prev_allowance_kemahalan, 0) + COALESCE(tx.prev_allowance_makan, 0) + COALESCE(tx.prev_allowance_khusus, 0) + COALESCE(tx.prev_allowance_insentif, 0);

        INSERT INTO hr_employee_career_histories (
            employee_id, transaction_date, effective_date, transaction_type, no_sk, description,
            new_position_id, previous_position_id, new_location_id, previous_location_id,
            new_status_kerja, new_basic_salary, previous_basic_salary, new_allowances, previous_allowances,
            new_allowance_makan, previous_allowance_makan, new_allowance_khusus, previous_allowance_khusus,
            new_allowance_insentif, previous_allowance_insentif, payroll_period_type, pph_scheme,
            bank_name, bank_account_no, bank_account_holder, payroll_deductions_json, created_at
        ) VALUES (
            tx.employee_id, COALESCE(tx.effective_date, v_now::date), COALESCE(tx.effective_date, v_now::date), tx.transaction_types::text, COALESCE(tx.contract_no, 'SK/' || LEFT(tx.id::text, 8)), 'Transaksi disetujui otomatis EOD: ' || tx.transaction_types::text,
            COALESCE(tx.new_position_id, tx.position_id), tx.prev_position_id, COALESCE(tx.new_unit_id, tx.new_location_id, tx.unit_id), COALESCE(tx.prev_unit_id, tx.prev_location_id),
            v_new_status_kerja, tx.new_basic_salary, tx.prev_basic_salary, v_allowances_new, v_allowances_prev,
            tx.new_allowance_makan, tx.prev_allowance_makan, tx.new_allowance_khusus, tx.prev_allowance_khusus,
            tx.new_allowance_insentif, tx.prev_allowance_insentif, COALESCE(tx.payroll_period_type, 'CUT_OFF'), COALESCE(tx.pph_scheme, 'Gross'),
            COALESCE(tx.bank_name, tx.payroll_deductions_json->>'bank_name'), COALESCE(tx.bank_account_no, tx.payroll_deductions_json->>'bank_account_no'), COALESCE(tx.bank_account_holder, tx.payroll_deductions_json->>'bank_account_holder'), COALESCE(tx.payroll_deductions_json, '{}'::jsonb), v_now
        );

        -- 4. TANDAI SEBAGAI APPLIED
        UPDATE hr_employee_transactions SET is_applied = TRUE, updated_at = v_now WHERE id = tx.id;
    END LOOP;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_supervisor_id (
  p_position_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
    v_curr_pos_id TEXT := p_position_id;
    v_parent_pos_id TEXT;
    v_supervisor_id UUID := NULL;
    v_loop_depth INT := 0;
    v_max_depth CONSTANT INT := 50; -- Mencegah infinite loop pada circular hierarchy
BEGIN
    IF p_position_id IS NULL OR TRIM(p_position_id) = '' THEN
        RETURN NULL;
    END IF;

    -- Telusuri hierarki atasan (reports_to_unit_id) ke atas secara bertahap
    WHILE v_curr_pos_id IS NOT NULL AND v_loop_depth < v_max_depth LOOP
        v_loop_depth := v_loop_depth + 1;

        -- Cari jabatan atasan langsung dari jabatan saat ini
        SELECT jp.reports_to_unit_id
        INTO v_parent_pos_id
        FROM public.hr_job_positions jp
        WHERE jp.id_position = v_curr_pos_id;

        -- Jika tidak ada atasan lagi (sudah di puncak hierarki, misal Direktur Utama)
        IF v_parent_pos_id IS NULL OR TRIM(v_parent_pos_id) = '' THEN
            EXIT;
        END IF;

        -- Cari apakah ada karyawan aktif yang menduduki jabatan atasan tersebut
        -- Syarat karyawan aktif: deleted_at IS NULL dan status_kerja != 'CALON'
        SELECT e.id
        INTO v_supervisor_id
        FROM public.hr_employees e
        WHERE e.position_id = v_parent_pos_id
          AND e.deleted_at IS NULL
          AND (e.status_kerja IS NULL OR UPPER(TRIM(e.status_kerja)) != 'CALON')
        ORDER BY e.created_at ASC
        LIMIT 1;

        -- Jika ditemukan karyawan aktif di jabatan atasan tersebut, kembalikan id-nya
        IF v_supervisor_id IS NOT NULL THEN
            RETURN v_supervisor_id;
        END IF;

        -- Jika jabatan atasan kosong (VACANT), terus naik ke jabatan atasan di atasnya
        v_curr_pos_id := v_parent_pos_id;
    END LOOP;

    -- Return NULL jika tidak ada atasan aktif yang ditemukan hingga puncak hierarki
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_active_supervisor_id (
  p_position_id text,
  p_location_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
    v_curr_pos_id TEXT := p_position_id;
    v_parent_pos_id TEXT;
    v_curr_unit_id TEXT;
    v_supervisor_id UUID := NULL;
    v_loop_depth INT := 0;
    v_max_depth CONSTANT INT := 50; 
BEGIN
    IF p_position_id IS NULL OR TRIM(p_position_id) = '' THEN RETURN NULL; END IF;

    WHILE v_curr_pos_id IS NOT NULL AND TRIM(v_curr_pos_id) <> '' AND v_loop_depth < v_max_depth LOOP
        v_loop_depth := v_loop_depth + 1;

        SELECT jp.reports_to_unit_id INTO v_parent_pos_id
        FROM public.hr_job_positions jp
        WHERE TRIM(jp.id_position) = TRIM(v_curr_pos_id);

        IF v_parent_pos_id IS NULL OR TRIM(v_parent_pos_id) = '' THEN EXIT; END IF;

        v_curr_unit_id := p_location_id;
        
        IF v_curr_unit_id IS NULL OR TRIM(v_curr_unit_id) = '' THEN
            SELECT e.id INTO v_supervisor_id FROM public.hr_employees e
            WHERE TRIM(e.position_id) = TRIM(v_parent_pos_id) AND e.deleted_at IS NULL AND (e.status_kerja IS NULL OR UPPER(TRIM(e.status_kerja)) != 'CALON')
            ORDER BY e.created_at ASC LIMIT 1;
            IF v_supervisor_id IS NOT NULL THEN RETURN v_supervisor_id; END IF;
        ELSE
            WHILE v_curr_unit_id IS NOT NULL AND TRIM(v_curr_unit_id) <> '' LOOP
                SELECT e.id INTO v_supervisor_id FROM public.hr_employees e
                WHERE TRIM(e.position_id) = TRIM(v_parent_pos_id)
                  AND (TRIM(e.location_id) = TRIM(v_curr_unit_id) OR e.location_id IS NULL OR TRIM(e.location_id) = '')
                  AND e.deleted_at IS NULL AND (e.status_kerja IS NULL OR UPPER(TRIM(e.status_kerja)) != 'CALON')
                ORDER BY e.created_at ASC LIMIT 1;

                IF v_supervisor_id IS NOT NULL THEN RETURN v_supervisor_id; END IF;

                SELECT ou.parent_unit_id INTO v_curr_unit_id FROM public.hr_organization_units ou WHERE TRIM(ou.id_unit) = TRIM(v_curr_unit_id);
            END LOOP;
        END IF;

        v_curr_pos_id := v_parent_pos_id;
    END LOOP;
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_position_permissions (
  p_position_id text
)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    v_result TEXT[];
BEGIN
    SELECT array_agg(permission_code) INTO v_result
    FROM public.hr_job_position_permissions
    WHERE position_id = p_position_id;
    
    RETURN COALESCE(v_result, ARRAY[]::TEXT[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_hr_employee_auth_sync()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
  AS $function$
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

    -- Evaluasi apakah Calon Karyawan, Nonaktif, atau Dihapus (Soft-Delete)
    v_is_inactive := (
        NEW.deleted_at IS NOT NULL 
        OR UPPER(TRIM(COALESCE(NEW.status_kerja, ''))) IN ('CALON', 'RESIGNED', 'TERMINATED', 'NONAKTIF', 'NON-AKTIF', 'INACTIVE')
        OR UPPER(TRIM(COALESCE(NEW.nip, ''))) LIKE 'CAND-%'
    );

    -- [KASUS 2: CALON KARYAWAN / NONAKTIF / DIHAPUS -> HAPUS DARI AUTH.USERS]
    IF v_is_inactive THEN
        IF NEW.user_id IS NOT NULL THEN
            DELETE FROM auth.users WHERE id = NEW.user_id;
            NEW.user_id := NULL;
        END IF;

        IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
            DELETE FROM auth.users WHERE email = LOWER(TRIM(NEW.email));
        END IF;

        RETURN NEW;
    END IF;

    -- [KASUS 3: KARYAWAN RESMI AKTIF (PKWTT, PKWT, PROBATION, INTERNSHIP)]
    v_final_email := LOWER(TRIM(COALESCE(NULLIF(TRIM(NEW.email), ''), TRIM(NEW.nip) || '@digiasha.com')));

    IF NEW.user_id IS NOT NULL THEN
        SELECT id INTO v_existing_auth_id FROM auth.users WHERE id = NEW.user_id;
    END IF;

    IF v_existing_auth_id IS NULL THEN
        SELECT id INTO v_existing_auth_id FROM auth.users WHERE email = v_final_email;
    END IF;

    -- Jika belum ada di auth.users, buat akun baru
    IF v_existing_auth_id IS NULL THEN
        v_new_user_id := gen_random_uuid();
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
        -- Otomatis wajib ganti password pada login pertama
        NEW.must_change_password := TRUE;
    ELSE
        -- Update profil jika email / nama / NIP diperbarui
        UPDATE auth.users 
        SET email = v_final_email,
            raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('name', NEW.name, 'nip', NEW.nip),
            updated_at = NOW()
        WHERE id = v_existing_auth_id;

        UPDATE auth.identities
        SET identity_data = format('{"sub":"%s","email":"%s"}', v_existing_auth_id::text, v_final_email)::jsonb,
            updated_at = NOW()
        WHERE user_id = v_existing_auth_id AND provider = 'email';

        NEW.user_id := v_existing_auth_id;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_priority_fu (
  p_entity_type       text,
  p_entity_name_or_id text,
  p_nip               text,
  p_visit_id          text,
  p_log_date          date DEFAULT CURRENT_DATE
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  IF UPPER(p_entity_type) = 'DEALER' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'DEALER'
      AND (entity_name ILIKE '%' || p_entity_name_or_id || '%' OR entity_id = p_entity_name_or_id);

  ELSIF UPPER(p_entity_type) = 'UNIT' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'UNIT'
      AND (entity_id = p_entity_name_or_id OR entity_name ILIKE '%' || p_entity_name_or_id || '%');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_priorities()
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_units_updated INT := 0;
  v_dealers_updated INT := 0;
  v_active_tasks INT := 0;
  v_log_error TEXT := NULL;
  rec RECORD;
BEGIN

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      -- 1. Hitung Aging Visit Unit (Hari ini - Last Visit / Lifetime)
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      
      -- 2. Ambil Concern Aktif dari t_priority_action (Manual Supervisor)
      c.concern_urgency,
      c.concern_note,
      
      -- 3. Flag H-3 JTO
      (u.jto_date IS NOT NULL AND u.jto_date >= v_today AND u.jto_date <= (v_today + INTERVAL '3 days')::DATE) AS is_h3_jto,
      
      -- 4. Status Kontrak & Validitas IMEI
      (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
      ) AS is_eligible,

      -- 5. Status Closed / Dormant dari Dealer Induk (Productivity: 7.Closed, 5. Dormant)
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_dealer_closed_or_dormant
    FROM m_facility_unit u
    LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
    LEFT JOIN (
      SELECT 
        REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') AS unit_fasilitas_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'UNIT'
    ) c ON (
      REGEXP_REPLACE(UPPER(TRIM(u.no_fasilitas)), '[\s\-_.]', '', 'g') = c.unit_fasilitas_clean
      AND c.unit_fasilitas_clean <> ''
    ) AND c.rn = 1
  ),
  unit_scored AS (
    SELECT 
      u.no_fasilitas,
      uc.calc_aging_visit,
      CASE
        -- Non-eligible contract check
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 0

        -- Status Dealer Closed / Dormant: Jangan jadi prioritas otomatis kecuali ada assign concern
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0

        -- Level: SANGAT PENTING (Score 3)
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 3
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 3
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 3
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 3

        -- Level: PENTING (Score 2)
        WHEN uc.concern_urgency = 'Penting' THEN 2
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 2
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 11 THEN 2
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 2
        WHEN uc.calc_aging_visit >= 22 THEN 2

        -- Level: MODERAT (Score 1)
        WHEN uc.calc_aging_visit >= 15 THEN 1
        WHEN uc.concern_urgency = 'Moderat' THEN 1
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1

        -- Level: NORMAL (Score 0)
        ELSE 0
      END AS calc_score,

      CASE
        -- Non-eligible contract
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 'Normal'

        -- Status Dealer Closed / Dormant
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal'

        WHEN uc.concern_urgency = 'Sangat Penting' THEN 'Sangat Penting'
        WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 'Sangat Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Sangat Penting'

        WHEN uc.concern_urgency = 'Penting' THEN 'Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'Penting'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 11 THEN 'Penting'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Penting'
        WHEN uc.calc_aging_visit >= 22 THEN 'Penting'

        WHEN uc.calc_aging_visit >= 15 THEN 'Moderat'
        WHEN uc.concern_urgency = 'Moderat' THEN 'Moderat'
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Moderat'

        ELSE 'Normal'
      END AS calc_level,

      CASE
        WHEN uc.concern_urgency IS NOT NULL THEN 'Concern: ' || COALESCE(uc.concern_note, '-')
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal (Mitra Closed / Dormant)'
        WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 'SP Terbit (OVD 3/6/9 Hari)'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%', '%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'GPS Alert: ' || u.gps_status
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Aging Visit >= 22 hr (' || uc.calc_aging_visit || ' hr) & Lifetime > 90 hr (' || COALESCE(u.lifetime_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Aging Visit >= 15 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 11 THEN 'Aging Visit >= 3 hr & OVD >= 11 hr (' || uc.calc_aging_visit || ' hr & ' || COALESCE(u.overdue_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Aging Visit >= 5 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 22 THEN 'Aging Visit Unit >= 22 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN uc.calc_aging_visit >= 15 THEN 'Aging Visit Unit >= 15 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Aging Maintenance GPS > 30 hr (' || COALESCE(u.aging_gps_maint, 0) || ' hr)'
        ELSE 'Normal'
      END AS calc_reason
    FROM m_facility_unit u
    JOIN unit_calc uc ON u.no_fasilitas = uc.no_fasilitas
  )
  UPDATE m_facility_unit u
  SET 
    aging_visit_unit = us.calc_aging_visit,
    priority_score = us.calc_score,
    priority_level = us.calc_level,
    priority_reason = us.calc_reason,
    updated_at = NOW()
  FROM unit_scored us
  WHERE u.no_fasilitas = us.no_fasilitas;

  GET DIAGNOSTICS v_units_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- B. EVALUASI DAN UPDATE PRIORITAS MITRA DEALER (m_dealer)
  -- --------------------------------------------------------------------------
  WITH dealer_unit_agg AS (
    SELECT 
      LOWER(TRIM(u.dealer_name)) AS dealer_name_clean,
      COALESCE(MAX(u.priority_score), 0) AS max_unit_score,
      COALESCE(
        MAX(CASE WHEN u.priority_score > 0 THEN u.priority_reason END), 
        'Normal'
      ) AS unit_highest_reason,
      BOOL_OR(u.priority_reason LIKE 'Concern: %') AS has_assigned_unit_concern
    FROM m_facility_unit u
    WHERE UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
    GROUP BY LOWER(TRIM(u.dealer_name))
  ),
  dealer_calc AS (
    SELECT 
      d.dealer_id,
      GREATEST(0, (v_today - COALESCE(d.last_visit_date, d.tanggal_kerjasama, d.created_at::DATE, v_today))) AS calc_aging_visit,
      c.concern_urgency,
      c.concern_note
    FROM m_dealer d
    LEFT JOIN (
      SELECT 
        COALESCE(entity_id, '') AS dealer_id_clean,
        LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) AS dealer_name_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(NULLIF(entity_id, ''), LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', ''))) ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'DEALER'
    ) c ON (
      (c.dealer_id_clean <> '' AND d.dealer_id = c.dealer_id_clean)
      OR LOWER(TRIM(d.dealer_name)) = c.dealer_name_clean 
      OR LOWER(REGEXP_REPLACE(TRIM(d.dealer_name), '\s*\([^)]*\)\s*$', '')) = c.dealer_name_clean
    ) AND c.rn = 1
  ),
  dealer_mitra_rules AS (
    SELECT 
      d.dealer_id,
      dc.calc_aging_visit,
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_closed_or_dormant,
      CASE 
        -- Pengecekan Closed & Dormant tetap di paling atas (Skor 0)
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 0
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN dc.calc_aging_visit >= 61 THEN 3
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN dc.calc_aging_visit >= 31 THEN 2
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        WHEN dc.calc_aging_visit >= 21 THEN 1
        ELSE 0
      END AS mitra_score,

      CASE 
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN dc.calc_aging_visit >= 61 THEN 'Aging Visit Mitra >= 61 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 21 THEN 'Aging Visit Mitra >= 21 hr (' || dc.calc_aging_visit || ' hr)'
        ELSE 'Normal'
      END AS mitra_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dmr.calc_aging_visit,
      CASE 
        -- Jika Closed / Dormant dan tidak ada concern dealer maupun unit concern yang di-assign: skor = 0 (Normal)
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 0
        ELSE GREATEST(dmr.mitra_score, COALESCE(dua.max_unit_score, 0))
      END AS final_score,
      CASE 
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dmr.mitra_score >= COALESCE(dua.max_unit_score, 0) AND dmr.mitra_score > 0 THEN dmr.mitra_reason
        WHEN COALESCE(dua.max_unit_score, 0) > 0 THEN 'Pemicu Unit: ' || dua.unit_highest_reason
        ELSE 'Normal'
      END AS final_reason
    FROM m_dealer d
    JOIN dealer_mitra_rules dmr ON d.dealer_id = dmr.dealer_id
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
    LEFT JOIN dealer_unit_agg dua ON LOWER(TRIM(d.dealer_name)) = dua.dealer_name_clean
  )
  UPDATE m_dealer d
  SET 
    aging_visit_mitra = fds.calc_aging_visit,
    priority_score = fds.final_score,
    priority_level = CASE fds.final_score
      WHEN 3 THEN 'Sangat Penting'
      WHEN 2 THEN 'Penting'
      WHEN 1 THEN 'Moderat'
      ELSE 'Normal'
    END,
    priority_reason = fds.final_reason,
    updated_at = NOW()
  FROM final_dealer_scored fds
  WHERE d.dealer_id = fds.dealer_id;

  GET DIAGNOSTICS v_dealers_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- C. ANTREAN TUGAS TERPADU (t_priority_action) - ACTIVE TASK LIFECYCLE
  -- --------------------------------------------------------------------------
  BEGIN
    -- A. Evaluasi Dealer Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        d.dealer_id,
        d.dealer_name,
        d.cabang,
        d.priority_level,
        d.priority_score,
        d.priority_reason
      FROM m_dealer d
      WHERE d.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk dealer ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'DEALER', rec.dealer_id, rec.dealer_name, rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- B. Evaluasi Unit Fasilitas Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        u.no_fasilitas,
        u.nopol,
        u.unit,
        COALESCE(d.cabang, '-') AS cabang,
        u.priority_level,
        u.priority_score,
        u.priority_reason
      FROM m_facility_unit u
      LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
      WHERE u.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk unit ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif untuk unit ini
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'UNIT', rec.no_fasilitas, 
          rec.nopol || ' (' || COALESCE(rec.unit, '-') || ')', 
          rec.cabang, rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- C. Tutup tiket otomatis (AUTO_CALCULATE) untuk dealer atau unit yang skornya sudah 0 (misal: normal atau Closed/Dormant)
    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'DEALER'
      AND entity_id IN (
        SELECT dealer_id FROM m_dealer WHERE priority_score = 0
      );

    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'UNIT'
      AND entity_id IN (
        SELECT no_fasilitas FROM m_facility_unit WHERE priority_score = 0
      );

    -- Hitung total tiket aktif saat ini
    SELECT COUNT(*) INTO v_active_tasks FROM t_priority_action WHERE is_fu = false;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
    RAISE NOTICE 'Antrean t_priority_action notice: %', SQLERRM;
  END;

  RETURN json_build_object(
    'status', 'success',
    'message', 'Kalkulasi prioritas Supabase selesai (Unified Active Task Lifecycle)',
    'facility_units_updated', v_units_updated,
    'dealers_updated', v_dealers_updated,
    'active_priority_tasks', v_active_tasks,
    'execution_date', v_today,
    'error_detail', v_log_error
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_auto_recalculate_concern()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  PERFORM recalculate_all_priorities();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_hr_transaction_generate_nip()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
DECLARE
    v_join_date date;
    v_yy text;
    v_mm text;
    v_max_seq int;
    v_next_seq int;
    v_prefix text;
    v_lock_key bigint;
BEGIN
    -- Hanya untuk transaksi Penerimaan Karyawan
    IF (NEW.transaction_types::text LIKE '%Penerimaan Karyawan%') THEN
        -- Jika NIP diset ke flag AUTO_GENERATE atau NIP lama kandidat, kita buat yang asli
        IF (NEW.nip IS NULL OR NEW.nip = '' OR NEW.nip = 'N/A' OR NEW.nip LIKE 'CAND-%' OR NEW.nip = 'AUTO_GENERATE') THEN
            
            v_join_date := COALESCE(NEW.join_date, CURRENT_DATE);
            v_yy := to_char(v_join_date, 'YY');
            v_mm := to_char(v_join_date, 'MM');
            v_prefix := v_mm || v_yy;
            
            -- Gunakan advisory lock berdasarkan tahun untuk mencegah race condition (duplikat NIP)
            -- Misalnya tahun 2026 -> 2026
            v_lock_key := to_char(v_join_date, 'YYYY')::bigint;
            PERFORM pg_advisory_xact_lock(v_lock_key);

            -- Cari NIP paling maksimal di tahun yang sama pada tabel hr_employees dan hr_employee_transactions
            -- Menggunakan filter '__' || v_yy || '%' untuk mengabaikan bulan, nomor urut berlanjut tahunan
            SELECT COALESCE(MAX(SUBSTRING(nip FROM 5 FOR 4)::int), 0) INTO v_max_seq
            FROM (
                SELECT nip FROM public.hr_employees
                UNION ALL
                SELECT nip FROM public.hr_employee_transactions 
                WHERE nip IS NOT NULL AND nip NOT LIKE 'CAND-%' AND id != NEW.id
            ) all_nips
            WHERE nip LIKE '__' || v_yy || '%' AND LENGTH(nip) >= 8;

            v_next_seq := v_max_seq + 1;
            NEW.nip := v_prefix || lpad(v_next_seq::text, 4, '0');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_subordinates_supervisor()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
    -- Menyala jika position_id, location_id, deleted_at, atau status_kerja berubah
    IF (NEW.position_id IS DISTINCT FROM OLD.position_id) OR
       (NEW.location_id IS DISTINCT FROM OLD.location_id) OR
       (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) OR
       (NEW.status_kerja IS DISTINCT FROM OLD.status_kerja) THEN

        -- Cari semua bawahan langsung yang mencatat OLD.id sebagai supervisor_id
        -- Hitung ulang supervisor_id mereka berdasarkan lokasi bawahan masing-masing
        UPDATE public.hr_employees sub
        SET supervisor_id = public.get_active_supervisor_id(sub.position_id, sub.location_id),
            updated_at = NOW()
        WHERE sub.supervisor_id = OLD.id
          AND sub.id <> OLD.id; -- Menghindari circular self-reference
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_supervisor_on_upsert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
    -- Dijalankan pada INSERT, atau pada UPDATE jika position_id/location_id berubah
    IF TG_OP = 'INSERT' OR 
       (TG_OP = 'UPDATE' AND (NEW.position_id IS DISTINCT FROM OLD.position_id OR NEW.location_id IS DISTINCT FROM OLD.location_id)) THEN
        
        IF NEW.position_id IS NOT NULL AND TRIM(NEW.position_id) <> '' THEN
            -- Panggil fungsi dengan 2 parameter: jabatan dan lokasi
            NEW.supervisor_id := public.get_active_supervisor_id(NEW.position_id, NEW.location_id);
        ELSE
            NEW.supervisor_id := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_permission_for_positions (
  p_permission_code text,
  p_position_ids    text[]
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    v_pos_id TEXT;
BEGIN
    -- Hapus hak akses (kode modul ini) dari seluruh jabatan
    DELETE FROM public.hr_job_position_permissions 
    WHERE permission_code = p_permission_code;
    
    -- Tanamkan hak akses ini HANYA ke jabatan-jabatan yang dipilih
    IF p_position_ids IS NOT NULL THEN
        FOREACH v_pos_id IN ARRAY p_position_ids LOOP
            IF v_pos_id IS NOT NULL AND TRIM(v_pos_id) <> '' THEN
                INSERT INTO public.hr_job_position_permissions (position_id, permission_code)
                VALUES (TRIM(v_pos_id), p_permission_code)
                ON CONFLICT (position_id, permission_code) DO NOTHING;
            END IF;
        END LOOP;
    END IF;
    
    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_position_permissions (
  p_position_id text,
  p_permissions text[]
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    v_perm TEXT;
BEGIN
    -- Hapus seluruh hak akses lama untuk jabatan ini di tabel hr_
    DELETE FROM public.hr_job_position_permissions WHERE position_id = p_position_id;
    
    -- Jika array permission kosong, berarti hapus semua hak akses (Selesai)
    IF p_permissions IS NULL OR array_length(p_permissions, 1) IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Masukkan hak akses baru satu per satu ke tabel hr_
    FOREACH v_perm IN ARRAY p_permissions LOOP
        IF v_perm IS NOT NULL AND TRIM(v_perm) <> '' THEN
            INSERT INTO public.hr_job_position_permissions (position_id, permission_code)
            VALUES (p_position_id, TRIM(UPPER(v_perm)))
            ON CONFLICT (position_id, permission_code) DO NOTHING;
        END IF;
    END LOOP;
    RETURN TRUE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_sso_token (
  p_auth_code     character varying,
  p_client_id     character varying,
  p_client_secret character varying
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
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
$function$;

ALTER TABLE "public"."m_cover_area"
  ADD CONSTRAINT "m_cover_area_pic_id_fkey" FOREIGN KEY (pic_id) REFERENCES public.hr_employees(id) ON DELETE SET NULL;

ALTER TABLE "public"."m_cover_area"
  ADD CONSTRAINT "m_cover_area_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE CASCADE;

ALTER TABLE "public"."m_dealer"
  ADD CONSTRAINT "m_dealer_cover_area_id_fkey" FOREIGN KEY (cover_area_id) REFERENCES public.m_cover_area(id_area) ON DELETE SET NULL;

CREATE INDEX idx_cover_area_pic_id ON public.m_cover_area USING btree (pic_id);

CREATE INDEX idx_cover_area_unit_id ON public.m_cover_area USING btree (unit_id);

CREATE INDEX idx_m_dealer_cover_area_id ON public.m_dealer USING btree (cover_area_id);

CREATE POLICY "Allow all for m_cover_area" ON "public"."m_cover_area"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_cover_area" TO "anon", "authenticated", "postgres", "service_role";

