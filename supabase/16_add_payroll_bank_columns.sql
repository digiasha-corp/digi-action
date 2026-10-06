-- =========================================================================
-- MIGRATION: ADD PAYROLL BANK COLUMNS TO EMPLOYEE TRANSACTIONS & EMPLOYEES
-- =========================================================================

-- 1. Tambah kolom Bank di hr_employee_transactions
ALTER TABLE public.hr_employee_transactions 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
ADD COLUMN IF NOT EXISTS bank_account_no TEXT;

-- 2. Pastikan kolom Bank juga ada di hr_employee_career_histories
ALTER TABLE public.hr_employee_career_histories 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS bank_account_holder TEXT,
ADD COLUMN IF NOT EXISTS bank_account_no TEXT;

-- 3. Pastikan kolom pph_scheme juga tersedia
ALTER TABLE public.hr_employee_transactions 
ADD COLUMN IF NOT EXISTS pph_scheme TEXT DEFAULT 'Gross';

ALTER TABLE public.hr_employee_career_histories 
ADD COLUMN IF NOT EXISTS pph_scheme TEXT DEFAULT 'Gross';

-- 4. Reload schema cache Supabase / PostgREST
NOTIFY pgrst, 'reload schema';
