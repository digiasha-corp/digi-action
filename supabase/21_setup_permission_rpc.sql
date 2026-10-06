-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION
-- Fungsi RPC (Remote Procedure Call) untuk Manajemen Hak Akses (SSO Central)
-- =========================================================================

-- 1. Fungsi untuk MEMPERBARUI Hak Akses (Menimpa yang lama dengan yang baru)
-- Cara kerja Frontend: memanggil supabase.rpc('update_position_permissions', { p_position_id: 'ADMIN_CABANG', p_permissions: ['ACTIVE.CALON_MITRA.VIEW', 'ACTIVE.CALON_MITRA.EDIT'] })
CREATE OR REPLACE FUNCTION public.update_position_permissions(
    p_position_id TEXT,
    p_permissions TEXT[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_perm TEXT;
BEGIN
    -- Validasi sederhana
    IF p_position_id IS NULL OR TRIM(p_position_id) = '' THEN
        RAISE EXCEPTION 'position_id tidak boleh kosong';
    END IF;

    -- Hapus seluruh hak akses lama untuk jabatan ini
    DELETE FROM public.job_position_permissions
    WHERE position_id = p_position_id;

    -- Jika array permission kosong, berarti hapus semua hak akses (Selesai)
    IF p_permissions IS NULL OR array_length(p_permissions, 1) IS NULL THEN
        RETURN TRUE;
    END IF;

    -- Masukkan hak akses baru satu per satu
    FOREACH v_perm IN ARRAY p_permissions
    LOOP
        IF v_perm IS NOT NULL AND TRIM(v_perm) <> '' THEN
            INSERT INTO public.job_position_permissions (position_id, permission_code)
            VALUES (p_position_id, TRIM(UPPER(v_perm)))
            ON CONFLICT (position_id, permission_code) DO NOTHING;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- 2. Fungsi untuk MENGAMBIL Hak Akses dengan format Array Flat (Mudah untuk Frontend)
-- Cara kerja Frontend: const { data } = await supabase.rpc('get_position_permissions', { p_position_id: 'ADMIN_CABANG' })
-- Hasil data: ['ACTIVE.CALON_MITRA.VIEW', 'ACTIVE.CALON_MITRA.EDIT']
CREATE OR REPLACE FUNCTION public.get_position_permissions(
    p_position_id TEXT
)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result TEXT[];
BEGIN
    SELECT array_agg(permission_code) INTO v_result
    FROM public.job_position_permissions
    WHERE position_id = p_position_id;
    
    RETURN COALESCE(v_result, ARRAY[]::TEXT[]);
END;
$$;
