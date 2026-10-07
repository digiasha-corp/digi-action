-- =========================================================================
-- CREATE RPC get_all_subordinates
-- Mengambil seluruh bawahan (langsung dan tidak langsung) secara rekursif
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_all_subordinates(p_supervisor_id UUID)
RETURNS SETOF public.hr_employees AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE subordinate_tree AS (
        -- Base case: Bawahan langsung dari supervisor yang diberikan
        SELECT e.*, 1 AS level
        FROM public.hr_employees e
        WHERE e.supervisor_id = p_supervisor_id
        
        UNION ALL
        
        -- Recursive step: Bawahan dari bawahan (dan seterusnya)
        SELECT e.*, st.level + 1 AS level
        FROM public.hr_employees e
        INNER JOIN subordinate_tree st ON e.supervisor_id = st.id
    )
    SELECT id, nip, name, email, employee_name, phone, address, status, join_date, end_date, created_at, updated_at, position_id, department_id, supervisor_id, role, deleted_at, photo_url, user_id, must_change_password, id_employee, location_id, status_kerja
    FROM subordinate_tree;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternatif pencarian menggunakan NIP (agar lebih mudah jika di Frontend menggunakan NIP)
CREATE OR REPLACE FUNCTION public.get_all_subordinates_by_nip(p_supervisor_nip TEXT)
RETURNS SETOF public.hr_employees AS $$
DECLARE
    v_supervisor_id UUID;
BEGIN
    -- Ambil UUID supervisor dari NIP
    SELECT id INTO v_supervisor_id FROM public.hr_employees WHERE nip = p_supervisor_nip LIMIT 1;
    
    IF v_supervisor_id IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT * FROM public.get_all_subordinates(v_supervisor_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
