-- Tambahkan kolom is_applied jika belum ada
ALTER TABLE hr_employee_transactions ADD COLUMN IF NOT EXISTS is_applied BOOLEAN DEFAULT FALSE;
UPDATE hr_employee_transactions SET is_applied = TRUE WHERE status = 'APPROVED' AND (is_applied IS NULL OR is_applied = FALSE);

CREATE OR REPLACE FUNCTION fn_apply_eod_transactions() RETURNS void AS $$
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
$$ LANGUAGE plpgsql;

-- Jadwalkan function ini dengan pg_cron (Jam 03:00 WIB / 20:00 UTC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-eod-transactions-0300-wib') THEN
            PERFORM cron.unschedule('daily-eod-transactions-0300-wib');
        END IF;
        
        -- Berjalan setiap jam 20:00 UTC (03:00 WIB keesokan harinya)
        PERFORM cron.schedule(
            'daily-eod-transactions-0300-wib',
            '0 20 * * *',
            'SELECT fn_apply_eod_transactions();'
        );
    END IF;
END $$;
