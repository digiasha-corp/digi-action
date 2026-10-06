-- ===========================================================================
-- MIGRATION PARSIAL: Auto-Generate NIP using Postgres Trigger
-- (Berfungsi untuk mencegah duplikat NIP / Race Condition)
-- ===========================================================================

-- 1. Buat fungsi Trigger untuk generate NIP secara atomik (berurutan dan aman)
CREATE OR REPLACE FUNCTION trg_hr_transaction_generate_nip()
RETURNS trigger AS $$
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

            -- Cari NIP paling maksimal di tahun yang sama pada tabel m_employee dan hr_employee_transactions
            SELECT COALESCE(MAX(SUBSTRING(nip FROM 5 FOR 4)::int), 0) INTO v_max_seq
            FROM (
                SELECT nip FROM m_employee
                UNION ALL
                SELECT nip FROM hr_employee_transactions 
                WHERE nip IS NOT NULL AND nip NOT LIKE 'CAND-%' AND id != NEW.id
            ) all_nips
            WHERE nip LIKE '__' || v_yy || '%' AND LENGTH(nip) >= 8;

            v_next_seq := v_max_seq + 1;
            NEW.nip := v_prefix || lpad(v_next_seq::text, 4, '0');
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Hapus trigger lama jika ada, lalu pasang trigger baru ke tabel transaksi
DROP TRIGGER IF EXISTS trg_generate_nip_before_insert ON hr_employee_transactions;
CREATE TRIGGER trg_generate_nip_before_insert
BEFORE INSERT ON hr_employee_transactions
FOR EACH ROW
EXECUTE FUNCTION trg_hr_transaction_generate_nip();
