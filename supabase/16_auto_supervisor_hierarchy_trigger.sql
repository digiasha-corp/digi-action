-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 16_auto_supervisor_hierarchy_trigger.sql
-- OTOMATISASI SUPERVISOR ID BERDASARKAN HIERARKI JABATAN & UNIT KERJA
-- =========================================================================
-- Modul:
-- 1. Fungsi get_active_supervisor_id(p_position_id TEXT, p_location_id TEXT)
--    Menelusuri hierarki jabatan ke atas (bottom-up traversal) secara rekursif
--    sambil mencari di unit saat ini dan berlanjut ke parent_unit_id.
-- 2. Trigger trg_set_supervisor_on_upsert
--    BEFORE INSERT OR UPDATE OF position_id, location_id ON hr_employees
--    Otomatis mengisi supervisor_id untuk karyawan baru atau mutasi.
-- 3. Trigger trg_recalculate_subordinates_supervisor
--    AFTER UPDATE OF position_id, location_id, deleted_at, status_kerja ON hr_employees
--    Otomatis menghitung ulang supervisor_id seluruh bawahan jika atasan mutasi.
-- =========================================================================

-- -------------------------------------------------------------------------
-- A. FUNGSI PENCARIAN ATASAN AKTIF (HIERARCHY & LOCATION TRAVERSAL)
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_supervisor_id(p_position_id TEXT, p_location_id TEXT)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_curr_pos_id TEXT := p_position_id;
    v_parent_pos_id TEXT;
    v_curr_unit_id TEXT;
    v_supervisor_id UUID := NULL;
    v_loop_depth INT := 0;
    v_max_depth CONSTANT INT := 50; -- Mencegah infinite loop
BEGIN
    IF p_position_id IS NULL OR TRIM(p_position_id) = '' THEN
        RETURN NULL;
    END IF;

    -- Telusuri hierarki jabatan (reports_to_unit_id) ke atas secara bertahap
    WHILE v_curr_pos_id IS NOT NULL AND v_loop_depth < v_max_depth LOOP
        v_loop_depth := v_loop_depth + 1;

        -- 1. Cari jabatan atasan langsung dari jabatan saat ini
        SELECT jp.reports_to_unit_id
        INTO v_parent_pos_id
        FROM public.hr_job_positions jp
        WHERE jp.id_position = v_curr_pos_id;

        -- Jika tidak ada atasan lagi
        IF v_parent_pos_id IS NULL OR TRIM(v_parent_pos_id) = '' THEN
            EXIT;
        END IF;

        -- 2. Mulai pencarian atasan dari unit terkecil (lokasi saat ini) naik ke unit pusat
        v_curr_unit_id := p_location_id;
        
        WHILE v_curr_unit_id IS NOT NULL LOOP
            -- Coba cari karyawan aktif dengan jabatan atasan tersebut DI UNIT INI
            SELECT e.id
            INTO v_supervisor_id
            FROM public.hr_employees e
            WHERE e.position_id = v_parent_pos_id
              AND e.location_id = v_curr_unit_id
              AND e.deleted_at IS NULL
              AND (e.status_kerja IS NULL OR UPPER(TRIM(e.status_kerja)) != 'CALON')
            ORDER BY e.created_at ASC
            LIMIT 1;

            -- Jika ketemu atasan di unit ini (atau unit induknya), langsung return
            IF v_supervisor_id IS NOT NULL THEN
                RETURN v_supervisor_id;
            END IF;

            -- Jika tidak ketemu, naik satu level ke parent unit (dari Cabang ke Area, dsb)
            SELECT ou.parent_unit_id
            INTO v_curr_unit_id
            FROM public.hr_organization_units ou
            WHERE ou.id_unit = v_curr_unit_id;
        END LOOP;

        -- Jika jabatan atasan benar-benar kosong (vacant) di seluruh jalur unit ini,
        -- naik ke hierarki jabatan di atasnya lagi (Mencari atasan dari atasan)
        v_curr_pos_id := v_parent_pos_id;
    END LOOP;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.get_active_supervisor_id(TEXT, TEXT) IS 
'Mencari supervisor_id aktif dengan traverse bottom-up di hr_job_positions dan hr_organization_units secara bersilangan.';


-- -------------------------------------------------------------------------
-- B. TRIGGER 1: AUTO-SET SUPERVISOR SAAT INSERT ATAU PERUBAHAN JABATAN/LOKASI
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_set_supervisor_on_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.trg_set_supervisor_on_upsert() IS 
'Trigger function BEFORE INSERT OR UPDATE untuk mengisi supervisor_id otomatis sesuai get_active_supervisor_id(position, location).';

-- Pasang Trigger 1 pada hr_employees
DROP TRIGGER IF EXISTS trg_set_supervisor_on_upsert ON public.hr_employees;
CREATE TRIGGER trg_set_supervisor_on_upsert
    BEFORE INSERT OR UPDATE OF position_id, location_id
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
$$;

COMMENT ON FUNCTION public.trg_recalculate_subordinates_supervisor() IS 
'Trigger function AFTER UPDATE pada hr_employees untuk menghitung ulang supervisor_id bawahan jika atasan mutasi unit/jabatan atau resign.';

-- Pasang Trigger 2 pada hr_employees
DROP TRIGGER IF EXISTS trg_recalculate_subordinates_supervisor ON public.hr_employees;
CREATE TRIGGER trg_recalculate_subordinates_supervisor
    AFTER UPDATE OF position_id, location_id, deleted_at, status_kerja
    ON public.hr_employees
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_recalculate_subordinates_supervisor();
