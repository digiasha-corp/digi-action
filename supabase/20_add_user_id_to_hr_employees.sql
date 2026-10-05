-- =========================================================================
-- SUPABASE POSTGRESQL MIGRATION
-- Menambahkan relasi Supabase Auth ke hr_employees
-- =========================================================================

-- 1. Tambahkan kolom user_id
ALTER TABLE public.hr_employees 
ADD COLUMN IF NOT EXISTS user_id UUID;

-- 2. Buat relasi (Foreign Key) ke tabel bawaan Supabase Auth (auth.users)
-- Jika user di Supabase Auth dihapus, user_id di hr_employees menjadi NULL (jangan hapus data karyawannya)
ALTER TABLE public.hr_employees
DROP CONSTRAINT IF EXISTS hr_employees_user_id_fkey;

ALTER TABLE public.hr_employees
ADD CONSTRAINT hr_employees_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users (id) 
ON DELETE SET NULL;

-- 3. Tambahkan Index untuk mempercepat pencarian saat login
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id 
ON public.hr_employees (user_id);
