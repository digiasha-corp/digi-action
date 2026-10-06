-- MIGRASI 15: SETUP PAYROLL PARAMETERS & ALLOWANCES
-- Tanggal: 2026-09-22
-- Tujuan: Menambahkan tabel master parameter rumus payroll dan kolom tunjangan baru untuk transaksi

-- 1. Buat Tabel Master Parameter Rumus
CREATE TABLE IF NOT EXISTS public.hr_payroll_parameters (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    kode_komponen TEXT NOT NULL UNIQUE,
    nama_komponen TEXT NOT NULL,
    jenis TEXT NOT NULL, -- 'SUBSIDI' atau 'POTONGAN'
    formula TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seeder Awal Parameter
INSERT INTO public.hr_payroll_parameters (kode_komponen, nama_komponen, jenis, formula) VALUES 
('POT_BPJS_KES', 'Potongan BPJS Kesehatan (1%)', 'POTONGAN', '({gaji_pokok} + {tunj_tetap}) * 0.01'),
('SUB_BPJS_KES', 'Subsidi BPJS Kesehatan (4%)', 'SUBSIDI', '({gaji_pokok} + {tunj_tetap}) * 0.04'),
('POT_BPJS_TK', 'Potongan BPJS Ketenagakerjaan (3%)', 'POTONGAN', '({gaji_pokok} + {tunj_tetap}) * 0.03'),
('POT_PPH21', 'Potongan PPh21 TER', 'POTONGAN', 'LOOKUP_TER({tax_status}, {bruto})')
ON CONFLICT (kode_komponen) DO NOTHING;

-- 2. Tambah Kolom di Tabel Transaksi & Histori
ALTER TABLE public.hr_employee_transactions 
ADD COLUMN IF NOT EXISTS prev_allowance_makan NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_makan NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prev_allowance_khusus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_khusus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS prev_allowance_insentif NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_insentif NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payroll_period_type TEXT DEFAULT 'CUT_OFF',
ADD COLUMN IF NOT EXISTS pph_scheme TEXT DEFAULT 'Gross',
ADD COLUMN IF NOT EXISTS payroll_deductions_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.hr_employee_career_histories 
ADD COLUMN IF NOT EXISTS previous_allowance_makan NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_makan NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_allowance_khusus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_khusus NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_allowance_insentif NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_allowance_insentif NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS payroll_period_type TEXT DEFAULT 'CUT_OFF',
ADD COLUMN IF NOT EXISTS pph_scheme TEXT DEFAULT 'Gross',
ADD COLUMN IF NOT EXISTS payroll_deductions_json JSONB DEFAULT '{}'::jsonb;
