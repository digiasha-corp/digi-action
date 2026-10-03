-- ===========================================================================
-- MIGRATION PARSIAL: Tambah Kolom NPWP
-- ===========================================================================

-- Tambahkan kolom NPWP ke tabel data pribadi
ALTER TABLE IF EXISTS public.hr_employee_personal_details ADD COLUMN IF NOT EXISTS npwp_number VARCHAR(50);


