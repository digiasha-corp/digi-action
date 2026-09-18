-- =========================================================================
-- SUPABASE POSTGRESQL: 10_employee_lifecycle_transactions.sql
-- ARSITEKTUR SIKLUS KEPEGAWAIAN & TRANSAKSI KARYAWAN (CORE HR TRANSACTION ENGINE)
-- =========================================================================
-- 1. Menambahkan kolom JSONB data pribadi pada hr_employee_personal_details
-- 2. Membuat tabel hr_employee_transactions (100% kolom relasional)
-- 3. Membuat tabel hr_transaction_staging_approvals (Persetujuan bertingkat)
-- 4. Membuat tabel hr_transaction_agreements (Dasar hukum persetujuan elektronik)
-- 5. Fungsi generate_employee_nip(date) format MMYYXXXX
-- 6. Disable RLS & Grant permissions API
-- =========================================================================

-- 1. PENYESUAIAN DATA PRIBADI SIPIL (hr_employee_personal_details)
ALTER TABLE IF EXISTS public.hr_employee_personal_details
ADD COLUMN IF NOT EXISTS name TEXT NULL,
ADD COLUMN IF NOT EXISTS dob DATE NULL,
ADD COLUMN IF NOT EXISTS gender TEXT NULL,
ADD COLUMN IF NOT EXISTS marital_status TEXT NULL,
ADD COLUMN IF NOT EXISTS email TEXT NULL,
ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;

-- Pastikan tabel fallback employee_personal_details juga memiliki kolom JSONB
ALTER TABLE IF EXISTS public.employee_personal_details
ADD COLUMN IF NOT EXISTS name TEXT NULL,
ADD COLUMN IF NOT EXISTS dob DATE NULL,
ADD COLUMN IF NOT EXISTS gender TEXT NULL,
ADD COLUMN IF NOT EXISTS marital_status TEXT NULL,
ADD COLUMN IF NOT EXISTS email TEXT NULL,
ADD COLUMN IF NOT EXISTS personal_details JSONB DEFAULT '{}'::jsonb;


-- 2. TABEL TRANSAKSI KEPEGAWAIAN (hr_employee_transactions)
CREATE TABLE IF NOT EXISTS public.hr_employee_transactions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID NOT NULL,
    nip TEXT NULL,
    transaction_types TEXT[] NOT NULL DEFAULT '{}',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL', -- 'DRAFT', 'PENDING_AGREEMENT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED'
    current_stage INT NOT NULL DEFAULT 1,
    created_by_nip TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- Kolom Relasional: Penerimaan & Kontrak
    work_location_id TEXT NULL,
    unit_id TEXT NULL,
    position_id TEXT NULL,
    join_date DATE NULL,
    employment_status TEXT NULL, -- 'Mitra Lepas', 'Magang', 'Probation', 'PKWT', 'PKWTT'
    contract_no TEXT NULL,
    contract_start_date DATE NULL,
    contract_end_date DATE NULL,

    -- Kolom Relasional: Pergerakan Posisi (Rotasi, Promosi, Demosi, Mutasi)
    prev_position_id TEXT NULL,
    new_position_id TEXT NULL,
    prev_level_id TEXT NULL,
    new_level_id TEXT NULL,
    prev_location_id TEXT NULL,
    new_location_id TEXT NULL,
    prev_unit_id TEXT NULL,
    new_unit_id TEXT NULL,

    -- Kolom Relasional: Penyesuaian Benefit & Remunerasi (#,##0)
    prev_basic_salary NUMERIC DEFAULT 0,
    new_basic_salary NUMERIC DEFAULT 0,
    prev_allowance_jabatan NUMERIC DEFAULT 0,
    new_allowance_jabatan NUMERIC DEFAULT 0,
    prev_allowance_transport NUMERIC DEFAULT 0,
    new_allowance_transport NUMERIC DEFAULT 0,
    prev_allowance_komunikasi NUMERIC DEFAULT 0,
    new_allowance_komunikasi NUMERIC DEFAULT 0,
    prev_allowance_tempat_tinggal NUMERIC DEFAULT 0,
    new_allowance_tempat_tinggal NUMERIC DEFAULT 0,
    prev_allowance_penempatan NUMERIC DEFAULT 0,
    new_allowance_penempatan NUMERIC DEFAULT 0,
    prev_allowance_kemahalan NUMERIC DEFAULT 0,
    new_allowance_kemahalan NUMERIC DEFAULT 0,

    -- Kolom Relasional: Pengakhiran Hubungan Kerja (Resign, PHK, Pensiun)
    uang_pisah NUMERIC DEFAULT 0,
    uang_pisah_notes TEXT NULL,
    exit_interview_no TEXT NULL,
    inventory_returned TEXT NULL,
    inventory_not_returned TEXT NULL,

    -- Kolom Relasional: Lampiran Berkas / Dokumen
    doc_cv_url TEXT NULL,
    doc_ktp_url TEXT NULL,
    doc_kk_url TEXT NULL,
    doc_npwp_url TEXT NULL,
    doc_kontrak_url TEXT NULL,

    -- Kolom Relasional: Pembaruan Data Pribadi Sipil (Biodata JSONB)
    personal_data_updates JSONB NULL
);

CREATE INDEX IF NOT EXISTS idx_emp_tx_employee_id ON public.hr_employee_transactions (employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_tx_nip ON public.hr_employee_transactions (nip);
CREATE INDEX IF NOT EXISTS idx_emp_tx_status ON public.hr_employee_transactions (status);
CREATE INDEX IF NOT EXISTS idx_emp_tx_effective_date ON public.hr_employee_transactions (effective_date);

ALTER TABLE IF EXISTS public.hr_employee_transactions
ADD COLUMN IF NOT EXISTS personal_data_updates JSONB NULL;


-- 3. TABEL STAGING APPROVAL BERTINGKAT (hr_transaction_staging_approvals)
CREATE TABLE IF NOT EXISTS public.hr_transaction_staging_approvals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL,
    stage_order INT NOT NULL DEFAULT 1,
    approver_nip TEXT NOT NULL,
    approver_role TEXT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_staging_tx FOREIGN KEY (transaction_id) REFERENCES public.hr_employee_transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staging_tx_id ON public.hr_transaction_staging_approvals (transaction_id);
CREATE INDEX IF NOT EXISTS idx_staging_approver_nip ON public.hr_transaction_staging_approvals (approver_nip);


-- 4. TABEL AUDIT TRAIL PERJANJIAN ELEKTRONIK KARYAWAN (hr_transaction_agreements)
-- Khusus transaksi Rotasi, Promosi, Demosi, Mutasi, Penyesuaian Benefit
CREATE TABLE IF NOT EXISTS public.hr_transaction_agreements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL,
    employee_id UUID NULL,
    employee_nip TEXT NOT NULL,
    is_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    agreed_at TIMESTAMPTZ NULL,
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    agreement_statement TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_agreement_tx FOREIGN KEY (transaction_id) REFERENCES public.hr_employee_transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agreement_tx_id ON public.hr_transaction_agreements (transaction_id);
CREATE INDEX IF NOT EXISTS idx_agreement_emp_nip ON public.hr_transaction_agreements (employee_nip);


-- 5. FUNGSI GENERATE NOMOR INDUK PEGAWAI (NIP): MMYYXXXX
CREATE OR REPLACE FUNCTION public.generate_employee_nip(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT AS $$
DECLARE
    v_target_date DATE := COALESCE(p_date, CURRENT_DATE);
    v_mmyy TEXT := TO_CHAR(v_target_date, 'MMYY');
    v_year_2digit TEXT := TO_CHAR(v_target_date, 'YY');
    v_seq INT := 1;
    v_new_nip TEXT;
BEGIN
    SELECT COALESCE(MAX(RIGHT(n.nip, 4)::INT), 0) + 1 INTO v_seq
    FROM (
        SELECT nip FROM public.hr_employees 
        WHERE nip IS NOT NULL AND LENGTH(nip) = 8 AND SUBSTRING(nip FROM 3 FOR 2) = v_year_2digit
        UNION
        SELECT nip FROM public.employees 
        WHERE nip IS NOT NULL AND LENGTH(nip) = 8 AND SUBSTRING(nip FROM 3 FOR 2) = v_year_2digit
        UNION
        SELECT nip FROM public.hr_employee_transactions 
        WHERE nip IS NOT NULL AND LENGTH(nip) = 8 AND SUBSTRING(nip FROM 3 FOR 2) = v_year_2digit
    ) n;

    v_new_nip := v_mmyy || LPAD(v_seq::TEXT, 4, '0');
    RETURN v_new_nip;
END;
$$ LANGUAGE plpgsql;


-- 6. NONAKTIFKAN RLS & BERIKAN HAK AKSES API LENGKAP (UNRESTRICTED)
ALTER TABLE public.hr_employee_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_transaction_staging_approvals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.hr_transaction_agreements DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.hr_employee_transactions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_transaction_staging_approvals TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.hr_transaction_agreements TO anon, authenticated, service_role;

-- 7. REFRESH CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
