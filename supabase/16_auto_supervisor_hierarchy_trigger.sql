-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 16_auto_supervisor_hierarchy_trigger.sql
-- OTOMATISASI SUPERVISOR ID BERDASARKAN HIERARKI JABATAN (reports_to_unit_id)
-- =========================================================================
-- Modul:
-- 1. Fungsi get_active_supervisor_id(p_position_id TEXT)
--    Menelusuri hierarki jabatan ke atas (bottom-up traversal) secara rekursif
--    hingga menemukan karyawan aktif yang menduduki jabatan atasan (atau level atasnya jika vacant).
-- 2. Trigger trg_set_supervisor_on_upsert
--    BEFORE INSERT OR UPDATE OF position_id ON hr_employees
--    Otomatis mengisi supervisor_id untuk karyawan baru atau yang mengalami mutasi/promosi.
-- 3. Trigger trg_recalculate_subordinates_supervisor
--    AFTER UPDATE OF position_id, deleted_at, status_kerja ON hr_employees
--    Otomatis menghitung ulang supervisor_id seluruh bawahan jika atasan resign,
--    dinonaktifkan, berganti status kerja, atau mutasi jabatan.
-- =========================================================================

-- -------------------------------------------------------------------------
-- A. FUNGSI PENCARIAN ATASAN AKTIF (BOTTOM-UP HIERARCHY TRAVERSAL)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_supervisor_id(p_position_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.get_active_supervisor_id(TEXT) IS 
'Mencari supervisor_id aktif dengan bottom-up traversal di hr_job_positions (reports_to_unit_id) dan hr_employees (deleted_at IS NULL, status_kerja != CALON).';


-- -------------------------------------------------------------------------
-- B. TRIGGER 1: AUTO-SET SUPERVISOR SAAT INSERT ATAU PERUBAHAN JABATAN
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_set_supervisor_on_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Dijalankan pada INSERT, atau pada UPDATE jika position_id berubah
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.position_id IS DISTINCT FROM OLD.position_id) THEN
        IF NEW.position_id IS NOT NULL AND TRIM(NEW.position_id) <> '' THEN
            NEW.supervisor_id := public.get_active_supervisor_id(NEW.position_id);
        ELSE
            NEW.supervisor_id := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_set_supervisor_on_upsert() IS 
'Trigger function BEFORE INSERT OR UPDATE untuk mengisi supervisor_id otomatis sesuai get_active_supervisor_id().';

-- Pasang Trigger 1 pada hr_employees
DROP TRIGGER IF EXISTS trg_set_supervisor_on_upsert ON public.hr_employees;
CREATE TRIGGER trg_set_supervisor_on_upsert
    BEFORE INSERT OR UPDATE OF position_id
    ON public.hr_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_set_supervisor_on_upsert();


-- -------------------------------------------------------------------------
-- C. TRIGGER 2: RECALCULATE SUBORDINATES SAAT ATASAN BERUBAH/RESIGN/MUTASI
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_recalculate_subordinates_supervisor()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Menyala jika position_id, deleted_at, atau status_kerja berubah
    IF (NEW.position_id IS DISTINCT FROM OLD.position_id) OR
       (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) OR
       (NEW.status_kerja IS DISTINCT FROM OLD.status_kerja) THEN

        -- Cari semua bawahan langsung yang mencatat OLD.id sebagai supervisor_id
        -- Hitung ulang supervisor_id mereka secara dinamis agar dialihkan ke atasan aktif berikutnya
        UPDATE public.hr_employees sub
        SET supervisor_id = public.get_active_supervisor_id(sub.position_id),
            updated_at = NOW()
        WHERE sub.supervisor_id = OLD.id
          AND sub.id <> OLD.id; -- Menghindari circular self-reference
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_recalculate_subordinates_supervisor() IS 
'Trigger function AFTER UPDATE pada hr_employees untuk menghitung ulang supervisor_id bawahan jika atasan mutasi, non-aktif, atau resign.';

-- Pasang Trigger 2 pada hr_employees
DROP TRIGGER IF EXISTS trg_recalculate_subordinates_supervisor ON public.hr_employees;
CREATE TRIGGER trg_recalculate_subordinates_supervisor
    AFTER UPDATE OF position_id, deleted_at, status_kerja
    ON public.hr_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_recalculate_subordinates_supervisor();
