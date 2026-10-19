-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 22_update_priority_scoring_params.sql
-- Purpose: Memperbarui Stored Procedure recalculate_all_priorities()
--          dengan parameter bisnis skoring terbaru untuk:
--          1. Unit Fasilitas (CTE unit_scored & calc_reason)
--          2. Mitra Dealer (CTE dealer_mitra_rules)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_priorities()
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
      ) AS is_eligible,

      -- 5. Status Closed / Dormant dari Dealer Induk (Productivity: 7.Closed, 5. Dormant)
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_dealer_closed_or_dormant
    FROM m_facility_unit u
    LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
    LEFT JOIN (
      SELECT 
        REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') AS unit_fasilitas_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'UNIT'
    ) c ON (
      REGEXP_REPLACE(UPPER(TRIM(u.no_fasilitas)), '[\s\-_.]', '', 'g') = c.unit_fasilitas_clean
      AND c.unit_fasilitas_clean <> ''
    ) AND c.rn = 1
  ),
  unit_scored AS (
    SELECT 
      u.no_fasilitas,
      uc.calc_aging_visit,
      CASE
        -- Abaikan jika dealer Closed/Dormant dan tidak ada concern manual
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0

        -- LEVEL 3: SANGAT PENTING (SP)
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN uc.calc_aging_visit > 21 THEN 3
        WHEN u.gps_status ILIKE ANY(ARRAY['%Offline%', '%Pelepasan%', '%Pindah%', '%Geser%']) THEN 3
        WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 3
        WHEN COALESCE(u.overdue_days, 0) > 11 AND uc.calc_aging_visit > 3 THEN 3

        -- LEVEL 2: PENTING (P)
        WHEN uc.concern_urgency = 'Penting' THEN 2
        WHEN uc.calc_aging_visit > 14 THEN 2
        WHEN u.gps_status ILIKE '%Baterai Lemah%' THEN 2
        WHEN (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6) THEN 2
        WHEN (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' AND (LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) < 6 OR u.gps_status ILIKE '%Belum Pasang%')) THEN 2
        WHEN uc.is_h3_jto AND uc.calc_aging_visit > 4 THEN 2

        -- LEVEL 1: MODERAT (M)
        WHEN uc.concern_urgency = 'Moderat' THEN 1
        WHEN uc.calc_aging_visit > 7 THEN 1
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1

        ELSE 0
      END AS calc_score,

      CASE
        WHEN (
          CASE
            WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0
            WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
            WHEN uc.calc_aging_visit > 21 THEN 3
            WHEN u.gps_status ILIKE ANY(ARRAY['%Offline%', '%Pelepasan%', '%Pindah%', '%Geser%']) THEN 3
            WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 3
            WHEN COALESCE(u.overdue_days, 0) > 11 AND uc.calc_aging_visit > 3 THEN 3
            WHEN uc.concern_urgency = 'Penting' THEN 2
            WHEN uc.calc_aging_visit > 14 THEN 2
            WHEN u.gps_status ILIKE '%Baterai Lemah%' THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6) THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' AND (LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) < 6 OR u.gps_status ILIKE '%Belum Pasang%')) THEN 2
            WHEN uc.is_h3_jto AND uc.calc_aging_visit > 4 THEN 2
            WHEN uc.concern_urgency = 'Moderat' THEN 1
            WHEN uc.calc_aging_visit > 7 THEN 1
            WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1
            ELSE 0
          END
        ) = 3 THEN 'Sangat Penting'
        WHEN (
          CASE
            WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0
            WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
            WHEN uc.calc_aging_visit > 21 THEN 3
            WHEN u.gps_status ILIKE ANY(ARRAY['%Offline%', '%Pelepasan%', '%Pindah%', '%Geser%']) THEN 3
            WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 3
            WHEN COALESCE(u.overdue_days, 0) > 11 AND uc.calc_aging_visit > 3 THEN 3
            WHEN uc.concern_urgency = 'Penting' THEN 2
            WHEN uc.calc_aging_visit > 14 THEN 2
            WHEN u.gps_status ILIKE '%Baterai Lemah%' THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6) THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' AND (LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) < 6 OR u.gps_status ILIKE '%Belum Pasang%')) THEN 2
            WHEN uc.is_h3_jto AND uc.calc_aging_visit > 4 THEN 2
            WHEN uc.concern_urgency = 'Moderat' THEN 1
            WHEN uc.calc_aging_visit > 7 THEN 1
            WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1
            ELSE 0
          END
        ) = 2 THEN 'Penting'
        WHEN (
          CASE
            WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0
            WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
            WHEN uc.calc_aging_visit > 21 THEN 3
            WHEN u.gps_status ILIKE ANY(ARRAY['%Offline%', '%Pelepasan%', '%Pindah%', '%Geser%']) THEN 3
            WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 3
            WHEN COALESCE(u.overdue_days, 0) > 11 AND uc.calc_aging_visit > 3 THEN 3
            WHEN uc.concern_urgency = 'Penting' THEN 2
            WHEN uc.calc_aging_visit > 14 THEN 2
            WHEN u.gps_status ILIKE '%Baterai Lemah%' THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6) THEN 2
            WHEN (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' AND (LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) < 6 OR u.gps_status ILIKE '%Belum Pasang%')) THEN 2
            WHEN uc.is_h3_jto AND uc.calc_aging_visit > 4 THEN 2
            WHEN uc.concern_urgency = 'Moderat' THEN 1
            WHEN uc.calc_aging_visit > 7 THEN 1
            WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1
            ELSE 0
          END
        ) = 1 THEN 'Moderat'
        ELSE 'Normal'
      END AS calc_level,

      CASE
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal (Mitra Closed/Dormant)'
        WHEN uc.concern_urgency IS NOT NULL THEN 'Concern Unit: ' || COALESCE(uc.concern_note, '-')
        WHEN uc.calc_aging_visit > 21 THEN 'Aging Visit Unit > 21 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Offline%', '%Pelepasan%', '%Pindah%', '%Geser%']) THEN 'Anomali GPS (Offline/Pelepasan/Geser)'
        WHEN COALESCE(u.overdue_days, 0) IN (3, 6, 9) THEN 'Fasilitas OVD ' || u.overdue_days || ' Hari'
        WHEN COALESCE(u.overdue_days, 0) > 11 AND uc.calc_aging_visit > 3 THEN 'Fasilitas OVD > 11 hr & Aging Visit > 3 hr'
        WHEN uc.calc_aging_visit > 14 THEN 'Aging Visit Unit > 14 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN u.gps_status ILIKE '%Baterai Lemah%' THEN 'Baterai GPS Lemah'
        WHEN (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6) THEN 'Fasilitas Expired, GPS Belum Dilepas'
        WHEN (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' AND (LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) < 6 OR u.gps_status ILIKE '%Belum Pasang%')) THEN 'Fasilitas Live, GPS Belum Pasang'
        WHEN uc.is_h3_jto AND uc.calc_aging_visit > 4 THEN 'H-3 JTO & Aging Visit > 4 hr'
        WHEN uc.calc_aging_visit > 7 THEN 'Aging Visit Unit > 7 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Aging Maintenance GPS > 30 hr'
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
      ) AS unit_highest_reason,
      BOOL_OR(u.priority_reason LIKE 'Concern: %' OR u.priority_reason LIKE 'Concern Unit: %') AS has_assigned_unit_concern
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
        COALESCE(entity_id, '') AS dealer_id_clean,
        LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) AS dealer_name_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(NULLIF(entity_id, ''), LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', ''))) ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'DEALER'
    ) c ON (
      (c.dealer_id_clean <> '' AND d.dealer_id = c.dealer_id_clean)
      OR LOWER(TRIM(d.dealer_name)) = c.dealer_name_clean 
      OR LOWER(REGEXP_REPLACE(TRIM(d.dealer_name), '\s*\([^)]*\)\s*$', '')) = c.dealer_name_clean
    ) AND c.rn = 1
  ),
  dealer_mitra_rules AS (
    SELECT 
      d.dealer_id,
      dc.calc_aging_visit,
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_closed_or_dormant,
      CASE
        -- Kunci Status Closed & Dormant tetap di paling atas (Skor 0)
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 0
        
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN dc.calc_aging_visit >= 61 THEN 3
        
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN dc.calc_aging_visit >= 31 THEN 2
        
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        WHEN dc.calc_aging_visit >= 21 THEN 1
        WHEN d.last_visit_date IS NULL THEN 1 -- New Mitra
        ELSE 0
      END AS mitra_score,

      CASE
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN dc.calc_aging_visit >= 61 THEN 'Aging Visit Mitra >= 61 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 21 THEN 'Aging Visit Mitra >= 21 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN d.last_visit_date IS NULL THEN 'New Mitra (Belum Ada Visit)'
        ELSE 'Normal'
      END AS mitra_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dmr.calc_aging_visit,
      CASE 
        -- Jika Closed / Dormant dan tidak ada concern dealer maupun unit concern yang di-assign: skor = 0 (Normal)
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 0
        ELSE GREATEST(dmr.mitra_score, COALESCE(dua.max_unit_score, 0))
      END AS final_score,
      CASE 
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dmr.mitra_score >= COALESCE(dua.max_unit_score, 0) AND dmr.mitra_score > 0 THEN dmr.mitra_reason
        WHEN COALESCE(dua.max_unit_score, 0) > 0 THEN 'Pemicu Unit: ' || dua.unit_highest_reason
        ELSE 'Normal'
      END AS final_reason
    FROM m_dealer d
    JOIN dealer_mitra_rules dmr ON d.dealer_id = dmr.dealer_id
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
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

    -- C. Tutup tiket otomatis (AUTO_CALCULATE) untuk dealer atau unit yang skornya sudah 0 (misal: normal atau Closed/Dormant)
    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'DEALER'
      AND entity_id IN (
        SELECT dealer_id FROM m_dealer WHERE priority_score = 0
      );

    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'UNIT'
      AND entity_id IN (
        SELECT no_fasilitas FROM m_facility_unit WHERE priority_score = 0
      );

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
