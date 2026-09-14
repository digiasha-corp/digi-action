-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 01_priority_scoring_engine.sql
-- Purpose: Closed-Loop Priority Scoring & Unified Action Queue (t_priority_action)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. TABEL TERPADU ANTREAN PRIORITAS & PENUGASAN (t_priority_action)
--    Menyatukan penugasan manual atasan dan kalkulasi otomatis mesin jam 3 pagi
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS t_priority_action (
  action_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'AUTO_CALCULATE', -- 'AUTO_CALCULATE' | 'MANUAL_SUPERVISOR'
  assigned_by TEXT DEFAULT 'SYSTEM',             -- NIP Supervisor jika manual, 'SYSTEM' jika cron
  
  -- Target Entitas
  entity_type TEXT NOT NULL,                     -- 'DEALER' | 'UNIT'
  entity_id TEXT,                                -- dealer_id (misal MTR-0031) atau no_fasilitas (misal DL-2026...)
  entity_name TEXT NOT NULL,                     -- Nama Mitra atau Nopol (misal 'Garasi 69' atau 'B1898PJP')
  cabang TEXT,                                   -- Nama Cabang
  
  -- Tingkat Prioritas
  priority_level TEXT NOT NULL,                  -- 'Sangat Penting' | 'Penting' | 'Moderat'
  priority_score INT NOT NULL DEFAULT 1,         -- 3 | 2 | 1
  action_reason TEXT NOT NULL,                   -- Alasan auto trigger atau catatan instruksi atasan
  notes TEXT,                                    -- Catatan tambahan / concern notes
  
  -- Status Lifecycle & Closed-Loop SLA
  is_fu BOOLEAN NOT NULL DEFAULT false,          -- false = Aktif (OPEN), true = Selesai (RESOLVED)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Tanggal & jam tiket PERTAMA KALI dibuka (anti-duplikasi, tidak berubah)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Tanggal & jam terakhir di-refresh
  
  -- Bukti Penyelesaian (Tindak Lanjut Visit)
  fu_at TIMESTAMPTZ,                             -- Tanggal & jam submit visit
  fu_by TEXT,                                    -- NIP petugas PIC yang menyelesaikan visit
  fu_visit_id TEXT                               -- ID Laporan Visit (misal VST-1789...)
);

-- Indeks Performa Tinggi untuk Pencarian dan Filter Cepat
CREATE INDEX IF NOT EXISTS idx_priority_action_active ON t_priority_action (is_fu, priority_score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_priority_action_entity ON t_priority_action (entity_type, entity_id, is_fu);
CREATE INDEX IF NOT EXISTS idx_priority_action_name ON t_priority_action (entity_type, entity_name, is_fu);

-- Kebijakan Akses (RLS)
ALTER TABLE t_priority_action ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow select t_priority_action" ON t_priority_action;
CREATE POLICY "Allow select t_priority_action" ON t_priority_action FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow update t_priority_action" ON t_priority_action;
CREATE POLICY "Allow update t_priority_action" ON t_priority_action FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow insert t_priority_action" ON t_priority_action;
CREATE POLICY "Allow insert t_priority_action" ON t_priority_action FOR INSERT WITH CHECK (true);


-- ----------------------------------------------------------------------------
-- 1. FUNGSI UTAMA: KALKULASI ULANG SEMUA PRIORITAS (UNIT & DEALER)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION recalculate_all_priorities()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_units_updated INT := 0;
  v_dealers_updated INT := 0;
  v_active_tasks INT := 0;
  v_log_error TEXT := NULL;
  rec RECORD;
BEGIN

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      -- 1. Hitung Aging Visit Unit (Hari ini - Last Visit / Lifetime)
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      
      -- 2. Ambil Concern Aktif dari t_priority_action (Manual Supervisor)
      c.concern_urgency,
      c.concern_note,
      
      -- 3. Flag H-3 JTO
      (u.jto_date IS NOT NULL AND u.jto_date >= v_today AND u.jto_date <= (v_today + INTERVAL '3 days')::DATE) AS is_h3_jto,
      
      -- 4. Status Kontrak & Validitas IMEI
      (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
      ) AS is_eligible
    FROM m_facility_unit u
    LEFT JOIN (
      SELECT 
        LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) AS dealer_name_clean,
        REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, 'UMUM'))), '[\s\-_.]', '', 'g') AS unit_fasilitas_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')), REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, 'UMUM'))), '[\s\-_.]', '', 'g') ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR'
    ) c ON (
      (LOWER(TRIM(u.dealer_name)) = c.dealer_name_clean OR LOWER(REGEXP_REPLACE(TRIM(u.dealer_name), '\s*\([^)]*\)\s*$', '')) = c.dealer_name_clean)
      AND (
        c.unit_fasilitas_clean = 'UMUM' 
        OR c.unit_fasilitas_clean = '-'
        OR REGEXP_REPLACE(UPPER(TRIM(u.no_fasilitas)), '[\s\-_.]', '', 'g') = c.unit_fasilitas_clean
      )
    ) AND c.rn = 1
  ),
  unit_scored AS (
    SELECT 
      u.no_fasilitas,
      uc.calc_aging_visit,
      CASE
        -- Non-eligible contract check
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 0

        -- Level: SANGAT PENTING (Score 3)
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 3
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 3
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 3

        -- Level: PENTING (Score 2)
        WHEN uc.concern_urgency = 'Penting' THEN 2
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 2
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 2
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 2
        WHEN uc.calc_aging_visit >= 22 THEN 2

        -- Level: MODERAT (Score 1)
        WHEN uc.calc_aging_visit >= 15 THEN 1
        WHEN uc.concern_urgency = 'Moderat' THEN 1

        -- Level: NORMAL (Score 0)
        ELSE 0
      END AS calc_score,

      CASE
        -- Non-eligible contract
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 'Normal'

        WHEN uc.concern_urgency = 'Sangat Penting' THEN 'Sangat Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Sangat Penting'

        WHEN uc.concern_urgency = 'Penting' THEN 'Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'Penting'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Penting'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Penting'
        WHEN uc.calc_aging_visit >= 22 THEN 'Penting'

        WHEN uc.calc_aging_visit >= 15 THEN 'Moderat'
        WHEN uc.concern_urgency = 'Moderat' THEN 'Moderat'

        ELSE 'Normal'
      END AS calc_level,

      CASE
        WHEN uc.concern_urgency IS NOT NULL THEN 'Concern: ' || COALESCE(uc.concern_note, '-')
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%', '%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'GPS Alert: ' || u.gps_status
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Aging Visit >= 22 hr (' || uc.calc_aging_visit || ' hr) & Lifetime > 90 hr (' || COALESCE(u.lifetime_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Aging Visit >= 15 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Aging Visit >= 3 hr (' || uc.calc_aging_visit || ' hr) & Overdue >= 3 hr (' || COALESCE(u.overdue_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Aging Visit >= 5 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 22 THEN 'Aging Visit Unit >= 22 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN uc.calc_aging_visit >= 15 THEN 'Aging Visit Unit >= 15 hr (' || uc.calc_aging_visit || ' hr)'
        ELSE 'Normal'
      END AS calc_reason
    FROM m_facility_unit u
    JOIN unit_calc uc ON u.no_fasilitas = uc.no_fasilitas
  )
  UPDATE m_facility_unit u
  SET 
    aging_visit_unit = us.calc_aging_visit,
    priority_score = us.calc_score,
    priority_level = us.calc_level,
    priority_reason = us.calc_reason,
    updated_at = NOW()
  FROM unit_scored us
  WHERE u.no_fasilitas = us.no_fasilitas;

  GET DIAGNOSTICS v_units_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- B. EVALUASI DAN UPDATE PRIORITAS MITRA DEALER (m_dealer)
  -- --------------------------------------------------------------------------
  WITH dealer_unit_agg AS (
    SELECT 
      LOWER(TRIM(u.dealer_name)) AS dealer_name_clean,
      COALESCE(MAX(u.priority_score), 0) AS max_unit_score,
      COALESCE(
        MAX(CASE WHEN u.priority_score > 0 THEN u.priority_reason END), 
        'Normal'
      ) AS unit_highest_reason
    FROM m_facility_unit u
    WHERE UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
    GROUP BY LOWER(TRIM(u.dealer_name))
  ),
  dealer_calc AS (
    SELECT 
      d.dealer_id,
      GREATEST(0, (v_today - COALESCE(d.last_visit_date, d.tanggal_kerjasama, d.created_at::DATE, v_today))) AS calc_aging_visit,
      c.concern_urgency,
      c.concern_note
    FROM m_dealer d
    LEFT JOIN (
      SELECT 
        LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) AS dealer_name_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'DEALER'
    ) c ON (
      LOWER(TRIM(d.dealer_name)) = c.dealer_name_clean 
      OR LOWER(REGEXP_REPLACE(TRIM(d.dealer_name), '\s*\([^)]*\)\s*$', '')) = c.dealer_name_clean
    ) AND c.rn = 1
  ),
  dealer_mitra_rules AS (
    SELECT 
      d.dealer_id,
      dc.calc_aging_visit,
      CASE 
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN dc.calc_aging_visit >= 31 THEN 2
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        WHEN dc.calc_aging_visit >= 22 THEN 1
        ELSE 0
      END AS mitra_score,

      CASE 
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 22 THEN 'Aging Visit Mitra >= 22 hr (' || dc.calc_aging_visit || ' hr)'
        ELSE 'Normal'
      END AS mitra_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dmr.calc_aging_visit,
      GREATEST(dmr.mitra_score, COALESCE(dua.max_unit_score, 0)) AS final_score,
      CASE 
        WHEN dmr.mitra_score >= COALESCE(dua.max_unit_score, 0) AND dmr.mitra_score > 0 THEN dmr.mitra_reason
        WHEN COALESCE(dua.max_unit_score, 0) > 0 THEN 'Pemicu Unit: ' || dua.unit_highest_reason
        ELSE 'Normal'
      END AS final_reason
    FROM m_dealer d
    JOIN dealer_mitra_rules dmr ON d.dealer_id = dmr.dealer_id
    LEFT JOIN dealer_unit_agg dua ON LOWER(TRIM(d.dealer_name)) = dua.dealer_name_clean
  )
  UPDATE m_dealer d
  SET 
    aging_visit_mitra = fds.calc_aging_visit,
    priority_score = fds.final_score,
    priority_level = CASE fds.final_score
      WHEN 3 THEN 'Sangat Penting'
      WHEN 2 THEN 'Penting'
      WHEN 1 THEN 'Moderat'
      ELSE 'Normal'
    END,
    priority_reason = fds.final_reason,
    updated_at = NOW()
  FROM final_dealer_scored fds
  WHERE d.dealer_id = fds.dealer_id;

  GET DIAGNOSTICS v_dealers_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- C. ANTREAN TUGAS TERPADU (t_priority_action) - ACTIVE TASK LIFECYCLE
  -- --------------------------------------------------------------------------
  BEGIN
    -- A. Evaluasi Dealer Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        d.dealer_id,
        d.dealer_name,
        d.cabang,
        d.priority_level,
        d.priority_score,
        d.priority_reason
      FROM m_dealer d
      WHERE d.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk dealer ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'DEALER', rec.dealer_id, rec.dealer_name, rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- B. Evaluasi Unit Fasilitas Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        u.no_fasilitas,
        u.nopol,
        u.unit,
        COALESCE(d.cabang, '-') AS cabang,
        u.priority_level,
        u.priority_score,
        u.priority_reason
      FROM m_facility_unit u
      LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
      WHERE u.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk unit ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif untuk unit ini
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'UNIT', rec.no_fasilitas, 
          rec.nopol || ' (' || COALESCE(rec.unit, '-') || ')', 
          rec.cabang, rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- Hitung total tiket aktif saat ini
    SELECT COUNT(*) INTO v_active_tasks FROM t_priority_action WHERE is_fu = false;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
    RAISE NOTICE 'Antrean t_priority_action notice: %', SQLERRM;
  END;

  RETURN json_build_object(
    'status', 'success',
    'message', 'Kalkulasi prioritas Supabase selesai (Unified Active Task Lifecycle)',
    'facility_units_updated', v_units_updated,
    'dealers_updated', v_dealers_updated,
    'active_priority_tasks', v_active_tasks,
    'execution_date', v_today,
    'error_detail', v_log_error
  );
END;
$$;


-- ----------------------------------------------------------------------------
-- 2. FUNCTION HELPER UNTUK UPDATE FOLLOW-UP (is_fu) DENGAN SECURITY DEFINER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_priority_fu(
  p_entity_type TEXT,
  p_entity_name_or_id TEXT,
  p_nip TEXT,
  p_visit_id TEXT,
  p_log_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF UPPER(p_entity_type) = 'DEALER' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'DEALER'
      AND (entity_name ILIKE '%' || p_entity_name_or_id || '%' OR entity_id = p_entity_name_or_id);

  ELSIF UPPER(p_entity_type) = 'UNIT' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'UNIT'
      AND (entity_id = p_entity_name_or_id OR entity_name ILIKE '%' || p_entity_name_or_id || '%');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_priority_fu TO anon, authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 3. JADWAL OTOMATIS SUPABASE PG_CRON (JAM 03:00 WIB / 20:00 UTC)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-priority-recalc-0300-wib') THEN
    PERFORM cron.unschedule('daily-priority-recalc-0300-wib');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-priority-recalc-0300-wib',
  '0 20 * * *',
  $$SELECT recalculate_all_priorities()$$
);


-- ----------------------------------------------------------------------------
-- 4. MIGRASI DATA TERAKHIR & PEMBERSIHAN TABEL LAMA (t_assignment & log_priority_daily)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- A. Migrasi data penugasan terbuka dari t_assignment (jika tabel masih ada)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 't_assignment') THEN
    INSERT INTO t_priority_action (
      source, assigned_by, entity_type, entity_id, entity_name, priority_level, priority_score, action_reason, is_fu, created_at
    )
    SELECT 
      'MANUAL_SUPERVISOR',
      COALESCE(supervisor_nip, 'SUPERVISOR'),
      CASE WHEN UPPER(COALESCE(unit_fasilitas, '')) IN ('UMUM', '-', '') THEN 'DEALER' ELSE 'UNIT' END,
      CASE WHEN UPPER(COALESCE(unit_fasilitas, '')) IN ('UMUM', '-', '') THEN NULL ELSE unit_fasilitas END,
      dealer_name,
      COALESCE(urgency_level, 'Penting'),
      CASE WHEN urgency_level = 'Sangat Penting' THEN 3 WHEN urgency_level = 'Penting' THEN 2 ELSE 1 END,
      COALESCE(instruksi, 'Penugasan Manual'),
      (UPPER(status) = 'RESOLVED'),
      COALESCE(created_at, NOW())
    FROM t_assignment
    WHERE NOT EXISTS (
      SELECT 1 FROM t_priority_action a 
      WHERE a.source = 'MANUAL_SUPERVISOR' 
        AND a.entity_name = t_assignment.dealer_name
    );

    -- Hapus tabel t_assignment
    DROP TABLE IF EXISTS t_assignment CASCADE;
  END IF;

  -- B. Hapus tabel log_priority_daily
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'log_priority_daily') THEN
    DROP TABLE IF EXISTS log_priority_daily CASCADE;
  END IF;
END $$;
