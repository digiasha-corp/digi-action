-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 01_priority_scoring_engine.sql
-- Purpose: Closed-Loop Priority Scoring Logic Native di PostgreSQL Database
-- ============================================================================

-- 1. FUNGSI UTAMA: KALKULASI ULANG SEMUA PRIORITAS (UNIT & DEALER)
CREATE OR REPLACE FUNCTION recalculate_all_priorities()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_units_updated INT := 0;
  v_dealers_updated INT := 0;
BEGIN

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      -- 1. Hitung Aging Visit Unit (Hari ini - Last Visit / Lifetime)
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      
      -- 2. Ambil Concern Aktif dari t_assignment
      c.urgency AS concern_urgency,
      c.catatan AS concern_note,
      
      -- 3. Flag H-3 JTO
      (u.jto_date IS NOT NULL AND u.jto_date >= v_today AND u.jto_date <= (v_today + INTERVAL '3 days')::DATE) AS is_h3_jto,
      
      -- 4. Status Kontrak & Validitas IMEI
      (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
      ) AS is_eligible
    FROM m_facility_unit u
    LEFT JOIN (
      SELECT 
        LOWER(TRIM(target_id)) AS target_id_clean,
        LOWER(TRIM(target_name)) AS target_name_clean,
        urgency,
        catatan,
        ROW_NUMBER() OVER(PARTITION BY LOWER(TRIM(COALESCE(target_id, target_name))) ORDER BY created_at DESC) as rn
      FROM t_assignment
      WHERE UPPER(status) IN ('PENDING', 'OPEN')
    ) c ON (LOWER(TRIM(u.no_fasilitas)) = c.target_id_clean OR LOWER(TRIM(COALESCE(u.nopol, ''))) = c.target_name_clean) AND c.rn = 1
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
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 'Status Kontrak Non-Eligible (' || COALESCE(u.contract_status, 'Non-Live') || ')'

        -- Level: SANGAT PENTING (Score 3)
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 'Assign Concern: ' || COALESCE(uc.concern_note, 'Sangat Penting')
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 'Status GPS: ' || u.gps_status
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Aging Visit >= 22 hr (' || uc.calc_aging_visit || ' hr) & Lifetime > 90 hr (' || COALESCE(u.lifetime_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Aging Visit >= 15 hr (' || uc.calc_aging_visit || ' hr) & Kondisi H-3 JTO'

        -- Level: PENTING (Score 2)
        WHEN uc.concern_urgency = 'Penting' THEN 'Assign Concern: ' || COALESCE(uc.concern_note, 'Penting')
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'Status GPS: ' || u.gps_status
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Aging Visit >= 3 hr (' || uc.calc_aging_visit || ' hr) & Overdue >= 3 hr (' || COALESCE(u.overdue_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Aging Visit >= 5 hr (' || uc.calc_aging_visit || ' hr) & Kondisi H-3 JTO'
        WHEN uc.calc_aging_visit >= 22 THEN 'Aging Visit Unit >= 22 hr (' || uc.calc_aging_visit || ' hr)'

        -- Level: MODERAT (Score 1)
        WHEN uc.calc_aging_visit >= 15 THEN 'Aging Visit Unit >= 15 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN uc.concern_urgency = 'Moderat' THEN 'Assign Concern: ' || COALESCE(uc.concern_note, 'Moderat')

        -- Level: NORMAL (Score 0)
        ELSE 'Kondisi Normal / Terjadwal Baik'
      END AS calc_reason
    FROM m_facility_unit u
    JOIN unit_calc uc ON u.no_fasilitas = uc.no_fasilitas
  )
  UPDATE m_facility_unit u
  SET 
    aging_visit_unit = us.calc_aging_visit,
    priority_score = us.calc_score,
    priority_level = CASE us.calc_score
      WHEN 3 THEN 'Sangat Penting'
      WHEN 2 THEN 'Penting'
      WHEN 1 THEN 'Moderat'
      ELSE 'Normal'
    END,
    priority_reason = us.calc_reason,
    updated_at = NOW()
  FROM unit_scored us
  WHERE u.no_fasilitas = us.no_fasilitas;

  GET DIAGNOSTICS v_units_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- B. EVALUASI DAN UPDATE PRIORITAS DEALER / MITRA (m_dealer)
  -- --------------------------------------------------------------------------
  WITH dealer_calc AS (
    SELECT 
      d.dealer_id,
      d.dealer_name,
      d.productivity,
      d.status,
      -- 1. Hitung Aging Visit Mitra (Hari ini - Last Visit / Tanggal Kerjasama)
      GREATEST(0, (v_today - COALESCE(d.last_visit_date, d.tanggal_kerjasama, v_today))) AS calc_aging_mitra,
      
      -- 2. Cek apakah status Closed / Dormant
      (LOWER(COALESCE(d.productivity, '')) ILIKE ANY(ARRAY['%closed%', '%cloesed%', '%dormant%'])
       OR LOWER(COALESCE(d.status, '')) ILIKE ANY(ARRAY['%closed%', '%dormant%'])
      ) AS is_closed_or_dormant,

      -- 3. Concern Dealer Aktif dari t_assignment
      c.urgency AS concern_urgency,
      c.catatan AS concern_note
    FROM m_dealer d
    LEFT JOIN (
      SELECT 
        LOWER(TRIM(target_id)) AS target_id_clean,
        LOWER(TRIM(target_name)) AS target_name_clean,
        urgency,
        catatan,
        ROW_NUMBER() OVER(PARTITION BY LOWER(TRIM(COALESCE(target_id, target_name))) ORDER BY created_at DESC) as rn
      FROM t_assignment
      WHERE UPPER(status) IN ('PENDING', 'OPEN')
    ) c ON (LOWER(TRIM(d.dealer_id)) = c.target_id_clean OR LOWER(TRIM(d.dealer_name)) = c.target_name_clean) AND c.rn = 1
  ),
  mitra_internal_scored AS (
    SELECT 
      dc.dealer_id,
      dc.dealer_name,
      dc.calc_aging_mitra,
      CASE
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 61 THEN 3
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 31 THEN 2
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 21 THEN 1
        ELSE 0
      END AS internal_score,

      CASE
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, 'Sangat Penting')
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 61 THEN 'Aging Visit Mitra >= 61 hr (' || dc.calc_aging_mitra || ' hr)'
        WHEN dc.concern_urgency = 'Penting' THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, 'Penting')
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_mitra || ' hr)'
        WHEN dc.concern_urgency = 'Moderat' THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, 'Moderat')
        WHEN NOT dc.is_closed_or_dormant AND dc.calc_aging_mitra >= 21 THEN 'Aging Visit Mitra >= 21 hr (' || dc.calc_aging_mitra || ' hr)'
        WHEN dc.is_closed_or_dormant THEN 'Mitra Closed / Dormant'
        ELSE 'Kondisi Normal'
      END AS internal_reason
    FROM dealer_calc dc
  ),
  unit_aggregation AS (
    -- Agregasi Skor Tertinggi & Jumlah Unit Mendesak per Dealer
    SELECT 
      LOWER(TRIM(dealer_name)) AS dealer_name_clean,
      COALESCE(MAX(priority_score), 0) AS max_unit_score,
      COUNT(CASE WHEN priority_score > 0 THEN 1 END) AS urgent_units_count,
      (ARRAY_AGG(priority_reason ORDER BY priority_score DESC))[1] AS top_unit_reason
    FROM m_facility_unit
    WHERE dealer_name IS NOT NULL AND TRIM(dealer_name) <> ''
    GROUP BY LOWER(TRIM(dealer_name))
  ),
  final_dealer_scored AS (
    SELECT 
      mis.dealer_id,
      mis.calc_aging_mitra,
      COALESCE(ua.urgent_units_count, 0) AS final_urgent_units,
      GREATEST(mis.internal_score, COALESCE(ua.max_unit_score, 0)) AS final_score,
      CASE 
        WHEN COALESCE(ua.max_unit_score, 0) > mis.internal_score THEN 'Pemicu Unit: ' || COALESCE(ua.top_unit_reason, '')
        ELSE mis.internal_reason
      END AS final_reason
    FROM mitra_internal_scored mis
    LEFT JOIN unit_aggregation ua ON LOWER(TRIM(mis.dealer_name)) = ua.dealer_name_clean
  )
  UPDATE m_dealer d
  SET 
    aging_visit_mitra = fds.calc_aging_mitra,
    urgent_units_count = fds.final_urgent_units,
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

  RETURN json_build_object(
    'status', 'success',
    'message', 'Kalkulasi prioritas Supabase selesai',
    'facility_units_updated', v_units_updated,
    'dealers_updated', v_dealers_updated,
    'executed_at', NOW()
  );
END;
$$;

-- 2. TRIGGER REALTIME HANYA UNTUK ASSIGNMENT CONCERN (t_assignment)
-- Ketika Super Admin / Manager membuat concern baru atau menyelesaikan concern,
-- level prioritas mitra/unit langsung dihitung ulang secara real-time.
CREATE OR REPLACE FUNCTION trg_auto_recalculate_concern()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM recalculate_all_priorities();
  RETURN NULL;
END;
$$;

-- Drop trigger lama jika ada agar bisa di-run berulang kali
DROP TRIGGER IF EXISTS trg_recalc_on_assignment ON t_assignment;
DROP TRIGGER IF EXISTS trg_recalc_on_visit ON tr_laporan_visit;

-- Trigger Realtime t_assignment
CREATE TRIGGER trg_recalc_on_assignment
AFTER INSERT OR UPDATE OR DELETE ON t_assignment
FOR EACH STATEMENT
EXECUTE FUNCTION trg_auto_recalculate_concern();

-- 3. JADWAL OTOMATIS PG_CRON HARIAN PUKUL 03:00 WIB (20:00 UTC)
-- Mengaktifkan ekstensi pg_cron dan menjadwalkan kalkulasi mandiri setiap jam 03:00 WIB
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Hapus jadwal lama jika ada agar tidak duplikat
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-priority-recalc-0300-wib') THEN
    PERFORM cron.unschedule('daily-priority-recalc-0300-wib');
  END IF;
END $$;

-- Daftarkan jadwal baru: Pukul 03:00 WIB = Pukul 20:00 UTC
SELECT cron.schedule(
  'daily-priority-recalc-0300-wib',
  '0 20 * * *',
  $$SELECT recalculate_all_priorities()$$
);

