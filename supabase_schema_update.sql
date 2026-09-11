-- =========================================================================
-- SUPABASE POSTGRESQL SCHEMA MIGRATION SCRIPT (ROBUST & IDEMPOTENT)
-- DIGIASHA FIELD MONITORING SYSTEM - PRESENSI, IZIN & APPROVAL
-- =========================================================================
-- Jalankan script SQL ini di SQL Editor dashboard Supabase Anda
-- (https://supabase.com/dashboard/project/pqfzkizqqhmsnidocumv/sql)
-- =========================================================================

-- 1. PEMBARUAN TABEL MASTER EMPLOYEE (m_employee)
CREATE TABLE IF NOT EXISTS public.m_employee (
    nip VARCHAR(50) PRIMARY KEY,
    email VARCHAR(150),
    nama_lengkap VARCHAR(150),
    jabatan VARCHAR(100),
    cabang VARCHAR(100),
    area_cover VARCHAR(100),
    password_hash VARCHAR(255),
    role_id VARCHAR(50),
    status_ganti_pass BOOLEAN DEFAULT false,
    status_aktif VARCHAR(20) DEFAULT 'AKTIF',
    atasan_nip VARCHAR(50),
    atasan_nama VARCHAR(150),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE IF EXISTS public.m_employee 
ADD COLUMN IF NOT EXISTS atasan_nip VARCHAR(50),
ADD COLUMN IF NOT EXISTS atasan_nama VARCHAR(150);

-- 2. PEMBARUAN / PEMBUATAN TABEL LOG PRESENSI (tr_absensi_log)
CREATE TABLE IF NOT EXISTS public.tr_absensi_log (
    absen_id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    nip VARCHAR(50),
    nama_karyawan VARCHAR(150),
    jenis_absen VARCHAR(50),          -- 'Absen Datang' / 'Absen Pulang'
    cabang VARCHAR(100),
    lat NUMERIC,
    long NUMERIC,
    nearest_office VARCHAR(150),
    distance_meter NUMERIC DEFAULT 0,
    status_geofence VARCHAR(50),       -- 'VALID' / 'OUTSIDE_RADIUS' / 'N/A'
    menit_terlambat NUMERIC DEFAULT 0, -- Dihitung dari 09:00:00 waktu setempat (WIB/WITA/WIT)
    status_kehadiran VARCHAR(50),      -- 'TEPAT_WAKTU' / 'TERLAMBAT' / 'PULANG'
    selfie_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan seluruh kolom jika tabel tr_absensi_log sudah pernah dibuat dengan skema lama
ALTER TABLE IF EXISTS public.tr_absensi_log 
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS nip VARCHAR(50),
ADD COLUMN IF NOT EXISTS nama_karyawan VARCHAR(150),
ADD COLUMN IF NOT EXISTS jenis_absen VARCHAR(50),
ADD COLUMN IF NOT EXISTS cabang VARCHAR(100),
ADD COLUMN IF NOT EXISTS lat NUMERIC,
ADD COLUMN IF NOT EXISTS long NUMERIC,
ADD COLUMN IF NOT EXISTS nearest_office VARCHAR(150),
ADD COLUMN IF NOT EXISTS distance_meter NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_geofence VARCHAR(50),
ADD COLUMN IF NOT EXISTS menit_terlambat NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_kehadiran VARCHAR(50),
ADD COLUMN IF NOT EXISTS selfie_photo_url TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Index pencarian cepat untuk status harian per NIP
CREATE INDEX IF NOT EXISTS idx_absensi_nip_timestamp ON public.tr_absensi_log (nip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_absensi_jenis ON public.tr_absensi_log (jenis_absen);

-- 3. PEMBUATAN TABEL LOG PERIZINAN & APPROVAL (tr_izin_log)
CREATE TABLE IF NOT EXISTS public.tr_izin_log (
    izin_id VARCHAR(50) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    nip VARCHAR(50),
    nama VARCHAR(150),
    cabang VARCHAR(100),
    jenis_izin VARCHAR(50),           -- 'WFA', 'Datang Terlambat', 'Cuti', 'Sakit'
    tgl_mulai DATE,
    tgl_selesai DATE,
    catatan TEXT,
    lat NUMERIC,
    long NUMERIC,
    selfie_url TEXT,
    pic_approval_nip VARCHAR(50),      -- NIP atasan yang berhak approve
    pic_approval_nama VARCHAR(150),    -- Nama atasan
    status_approval VARCHAR(50) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
    approved_at TIMESTAMPTZ,
    approved_by VARCHAR(150),
    catatan_approval TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tambahkan seluruh kolom jika tabel tr_izin_log sudah pernah dibuat sebelumnya
ALTER TABLE IF EXISTS public.tr_izin_log 
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS nip VARCHAR(50),
ADD COLUMN IF NOT EXISTS nama VARCHAR(150),
ADD COLUMN IF NOT EXISTS cabang VARCHAR(100),
ADD COLUMN IF NOT EXISTS jenis_izin VARCHAR(50),
ADD COLUMN IF NOT EXISTS tgl_mulai DATE,
ADD COLUMN IF NOT EXISTS tgl_selesai DATE,
ADD COLUMN IF NOT EXISTS catatan TEXT,
ADD COLUMN IF NOT EXISTS lat NUMERIC,
ADD COLUMN IF NOT EXISTS long NUMERIC,
ADD COLUMN IF NOT EXISTS selfie_url TEXT,
ADD COLUMN IF NOT EXISTS pic_approval_nip VARCHAR(50),
ADD COLUMN IF NOT EXISTS pic_approval_nama VARCHAR(150),
ADD COLUMN IF NOT EXISTS status_approval VARCHAR(50) DEFAULT 'PENDING',
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS approved_by VARCHAR(150),
ADD COLUMN IF NOT EXISTS catatan_approval TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Index pencarian cepat untuk Approval Hub PIC
CREATE INDEX IF NOT EXISTS idx_izin_pic_approval ON public.tr_izin_log (pic_approval_nip, status_approval);
CREATE INDEX IF NOT EXISTS idx_izin_nip ON public.tr_izin_log (nip, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_izin_status ON public.tr_izin_log (status_approval);

-- 4. HAK AKSES DAN RLS (ROW LEVEL SECURITY)
ALTER TABLE public.m_employee ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.m_role_permission ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tr_absensi_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tr_izin_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon all on m_employee" ON public.m_employee;
CREATE POLICY "Allow anon all on m_employee" ON public.m_employee FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on m_role_permission" ON public.m_role_permission;
CREATE POLICY "Allow anon all on m_role_permission" ON public.m_role_permission FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on tr_absensi_log" ON public.tr_absensi_log;
CREATE POLICY "Allow anon all on tr_absensi_log" ON public.tr_absensi_log FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon all on tr_izin_log" ON public.tr_izin_log;
CREATE POLICY "Allow anon all on tr_izin_log" ON public.tr_izin_log FOR ALL TO anon USING (true) WITH CHECK (true);

-- Verifikasi Komentar Tabel
COMMENT ON TABLE public.m_employee IS 'Tabel Master Karyawan dan Kredensial Login';
COMMENT ON TABLE public.m_role_permission IS 'Tabel Konfigurasi Akses Menu Berdasarkan Role';
COMMENT ON TABLE public.tr_absensi_log IS 'Tabel Rekapitulasi Presensi Kehadiran dan Kepulangan Lapangan';
COMMENT ON TABLE public.tr_izin_log IS 'Tabel Pengajuan Izin Karyawan dan Pusat Approval PIC';
