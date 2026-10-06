-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 04_mceasy_tracking_schema.sql
-- Purpose: Schema Pelacakan GPS Armada McEasy (PT SURYA SARANA INVESTASI)
-- Verified against live McEasy VSMS v2 API Response
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TABEL STATUS POSISI LIVE TERKINI (vehicles_tracking)
--    Menyimpan posisi real-time 1 baris per unit armada (diupdate via Upsert)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles_tracking (
    vehicle_id VARCHAR(100) PRIMARY KEY,                    -- ID kendaraan McEasy (contoh: 97419)
    plate_number VARCHAR(100) NOT NULL,                     -- Plat / Label armada (contoh: MKS1-AKS-AVANZA-DD1152XDI)
    vehicle_name VARCHAR(150),                              -- Nama armada / device model (Concox AT4)
    imei VARCHAR(50),                                       -- Nomor IMEI GPS Tracker
    vehicle_group_name VARCHAR(150),                        -- Grup armada (contoh: AKS OTO - Mks 1)
    company_name VARCHAR(150) DEFAULT 'PT SURYA SARANA INVESTASI',
    
    -- Telemetri Posisi GPS & Pergerakan
    latitude DOUBLE PRECISION,                              -- Koordinat Lintang (-5.18129...)
    longitude DOUBLE PRECISION,                             -- Koordinat Bujur (119.41594...)
    speed NUMERIC(6, 2) DEFAULT 0,                          -- Kecepatan saat ini (km/jam)
    direction INT DEFAULT 0,                                -- Sudut hadap kompas (0 - 360 derajat)
    engine_on BOOLEAN DEFAULT false,                        -- Status kontak/mesin (true = ON / false = OFF)
    motion_status VARCHAR(10),                              -- Status gerak: M (Moving), I (Idling), S (Stop)
    
    -- Sensor & Kondisi Alat
    battery INT,                                            -- Persentase baterai GPS (contoh: 58%)
    signal_strength INT,                                    -- Kualitas sinyal GSM (1 - 5)
    trip_distance NUMERIC(10, 2) DEFAULT 0,                 -- Jarak tempuh perjalanan trip saat ini (km)
    total_distance NUMERIC(12, 2) DEFAULT 0,                -- Akumulasi total jarak tempuh / odometer (km)
    address TEXT,                                           -- Alamat terdekat jika tersedia
    
    -- Timestamp
    gps_updated_at TIMESTAMPTZ,                             -- Waktu satelit terakhir (lastPacket / lastMotion)
    synced_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL, -- Waktu sinkron ke Supabase
    
    -- Full Raw Payload untuk fleksibilitas sensor masa depan
    raw_data JSONB
);

-- Indeks performa untuk query cepat di Dashboard dan Web/Mobile App
CREATE INDEX IF NOT EXISTS idx_vtrack_plate ON public.vehicles_tracking (plate_number);
CREATE INDEX IF NOT EXISTS idx_vtrack_group ON public.vehicles_tracking (vehicle_group_name);
CREATE INDEX IF NOT EXISTS idx_vtrack_motion ON public.vehicles_tracking (motion_status);
CREATE INDEX IF NOT EXISTS idx_vtrack_updated ON public.vehicles_tracking (gps_updated_at DESC);


-- ----------------------------------------------------------------------------
-- 2. TABEL REKAM JEJAK HISTORI (vehicles_tracking_history)
--    Menyimpan titik log perjalanan berkala untuk rute / playback
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles_tracking_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id VARCHAR(100) NOT NULL,
    plate_number VARCHAR(100),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed NUMERIC(6, 2) DEFAULT 0,
    direction INT DEFAULT 0,
    engine_on BOOLEAN DEFAULT false,
    motion_status VARCHAR(10),
    battery INT,
    trip_distance NUMERIC(10, 2),
    gps_timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indeks komposit untuk mempercepat render polyline rute pada tanggal tertentu
CREATE INDEX IF NOT EXISTS idx_vhist_veh_time ON public.vehicles_tracking_history (vehicle_id, gps_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_vhist_plate_time ON public.vehicles_tracking_history (plate_number, gps_timestamp DESC);


-- ----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.vehicles_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles_tracking_history ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses Baca (SELECT) untuk public/authenticated
DROP POLICY IF EXISTS "Public Read vehicles_tracking" ON public.vehicles_tracking;
CREATE POLICY "Public Read vehicles_tracking" 
ON public.vehicles_tracking FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Public Read vehicles_tracking_history" ON public.vehicles_tracking_history;
CREATE POLICY "Public Read vehicles_tracking_history" 
ON public.vehicles_tracking_history FOR SELECT TO public USING (true);

-- Kebijakan Akses Tulis/Update (UPSERT) untuk proses sinkronisasi
DROP POLICY IF EXISTS "Public Upsert vehicles_tracking" ON public.vehicles_tracking;
CREATE POLICY "Public Upsert vehicles_tracking" 
ON public.vehicles_tracking FOR ALL TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert vehicles_tracking_history" ON public.vehicles_tracking_history;
CREATE POLICY "Public Insert vehicles_tracking_history" 
ON public.vehicles_tracking_history FOR ALL TO public USING (true) WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 4. REALTIME PUBLICATION
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'vehicles_tracking'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.vehicles_tracking;
  END IF;
END $$;
