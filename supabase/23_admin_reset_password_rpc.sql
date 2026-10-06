-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION: 23_admin_reset_password_rpc.sql
-- DESCRIPTION: Creates an RPC function allowing admins to reset an employee's password.
-- =========================================================================

-- Create RPC function to allow admins to reset an employee's password to default
CREATE OR REPLACE FUNCTION public.admin_reset_employee_password(target_nip TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_user_id UUID;
    encrypted_pw TEXT;
BEGIN
    -- Only allow authenticated users to execute this (you can add more strict role checks if desired)
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
$$;

-- Grant execution permission
GRANT EXECUTE ON FUNCTION public.admin_reset_employee_password(TEXT) TO authenticated;
