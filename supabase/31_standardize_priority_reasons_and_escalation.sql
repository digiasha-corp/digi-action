-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 31_standardize_priority_reasons_and_escalation.sql
-- Purpose: Standardize Static Priority Reasons & Implement In-Ticket Escalation (Option A)
-- ============================================================================

-- 1. FUNGSI HELPER: Normalisasi Alasan Prioritas Statis (Anti-Dinamis)
CREATE OR REPLACE FUNCTION clean_priority_reason_text(p_reason TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_reason IS NULL OR p_reason = '' THEN
    RETURN 'Normal';
  END IF;
  -- Hapus teks dinamis trailing seperti (43 hr) atau (20 hari)
  RETURN TRIM(REGEXP_REPLACE(p_reason, '\s*\(\s*\d+\s*(?:hr|hari)\s*\)', '', 'gi'));
END;
$$;

-- 2. UPDATE FUNGSI UTAMA: recalculate_all_priorities() dengan Alasan Statis & In-Ticket Escalation
CREATE OR REPLACE FUNCTION recalculate_all_priorities()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_units_updated INT := 0;
  v_dealers_updated INT := 0;
  v_tickets_upgraded INT := 0;
  v_tickets_inserted INT := 0;
  v_active_tasks INT := 0;
  v_log_error TEXT := NULL;
  rec RECORD;
  v_clean_reason TEXT;
  v_existing_id UUID;
  v_existing_score INT;
  v_existing_level TEXT;
  v_existing_reason TEXT;
BEGIN

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      c.concern_urgency,
      c.concern_note,
      (u.jto_date IS NOT NULL AND u.jto_date >= v_today AND u.jto_date <= (v_today + INTERVAL '3 days')::DATE) AS is_h3_jto,
      (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
      ) AS is_eligible,
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
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 0
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 3
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 3
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 3
        WHEN uc.concern_urgency = 'Penting' THEN 2
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 2
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 2
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 2
        WHEN uc.calc_aging_visit >= 22 THEN 2
        WHEN uc.calc_aging_visit >= 15 THEN 1
        WHEN uc.concern_urgency = 'Moderat' THEN 1
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1
        ELSE 0
      END AS calc_score,

      CASE
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 'Normal'
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal'
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
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Moderat'
        ELSE 'Normal'
      END AS calc_level,

      -- REASON STATIS TANPA ANGKA DINAMIS DI DALAM KURUNG
      CASE
        WHEN uc.concern_urgency IS NOT NULL THEN 'Concern: ' || COALESCE(uc.concern_note, '-')
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal (Mitra Closed / Dormant)'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%', '%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'Anomali GPS (Offline/Pelepasan/Geser)'
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Aging Visit >= 22 hr & Lifetime > 90 hr'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Aging Visit >= 15 hr & H-3 JTO'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Aging Visit >= 3 hr & Overdue >= 3 hr'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Aging Visit >= 5 hr & H-3 JTO'
        WHEN uc.calc_aging_visit >= 22 THEN 'Aging Visit Unit > 21 hr'
        WHEN uc.calc_aging_visit >= 15 THEN 'Aging Visit Unit > 14 hr'
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
      COUNT(*) FILTER (WHERE u.priority_score > 0) AS urgent_units_count,
      MAX(u.priority_score) AS max_unit_score,
      (ARRAY_AGG(u.priority_reason ORDER BY u.priority_score DESC, u.aging_visit_unit DESC))[1] AS top_unit_reason
    FROM m_facility_unit u
    GROUP BY LOWER(TRIM(u.dealer_name))
  ),
  dealer_calc AS (
    SELECT 
      d.dealer_id,
      GREATEST(0, (v_today - COALESCE(d.last_visit_date, (v_today - INTERVAL '90 days')::DATE))) AS calc_aging_visit,
      c.concern_urgency,
      c.concern_note
    FROM m_dealer d
    LEFT JOIN (
      SELECT 
        REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') AS dealer_id_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'DEALER'
    ) c ON (
      REGEXP_REPLACE(UPPER(TRIM(d.dealer_id)), '[\s\-_.]', '', 'g') = c.dealer_id_clean
      AND c.dealer_id_clean <> ''
    ) AND c.rn = 1
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dc.calc_aging_visit,
      COALESCE(dua.urgent_units_count, 0) AS urgent_units_count,
      CASE
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 0
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN dc.calc_aging_visit >= 61 THEN 3
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN dc.calc_aging_visit >= 31 THEN 2
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        WHEN dc.calc_aging_visit >= 21 THEN 1
        ELSE 0
      END AS final_score,

      -- REASON DEALER MURNI (TANPA PEMICU UNIT - PEMISAHAN TANGGUNG JAWAB DEALER VS UNIT)
      CASE
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN dc.calc_aging_visit >= 61 THEN 'Aging Visit Mitra >= 61 hr'
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr'
        WHEN dc.calc_aging_visit >= 21 THEN 'Aging Visit Mitra >= 21 hr'
        ELSE 'Normal'
      END AS final_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
    LEFT JOIN dealer_unit_agg dua ON LOWER(TRIM(d.dealer_name)) = dua.dealer_name_clean
  )
  UPDATE m_dealer d
  SET 
    aging_visit_mitra = fds.calc_aging_visit,
    urgent_units_count = fds.urgent_units_count,
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
  -- C. ANTREAN TIKET TERPADU (t_priority_action) - OPSI A: IN-TICKET ESCALATION
  -- --------------------------------------------------------------------------
  BEGIN
    -- 1. Evaluasi Dealer Prioritas
    FOR rec IN 
      SELECT d.dealer_id, d.dealer_name, d.cabang, d.priority_level, d.priority_score, d.priority_reason
      FROM m_dealer d WHERE d.priority_score > 0
    LOOP
      v_existing_id := NULL;
      SELECT action_id, priority_score, priority_level, action_reason
      INTO v_existing_id, v_existing_score, v_existing_level, v_existing_reason
      FROM t_priority_action
      WHERE entity_type = 'DEALER' AND entity_id = rec.dealer_id AND is_fu = false AND source = 'AUTO_CALCULATE'
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        -- SUDAH ADA TIKET AKTIF -> HANYA UPDATE JIKA LEVEL / SKOR / REASON BERUBAH (ESKALASI)
        IF v_existing_score <> rec.priority_score OR v_existing_level <> rec.priority_level OR v_existing_reason <> rec.priority_reason THEN
          UPDATE t_priority_action
          SET priority_level = rec.priority_level,
              priority_score = rec.priority_score,
              action_reason = rec.priority_reason,
              cabang = COALESCE(rec.cabang, cabang),
              updated_at = NOW()
          WHERE action_id = v_existing_id;
          v_tickets_upgraded := v_tickets_upgraded + 1;
        END IF;
      ELSE
        -- BELUM ADA TIKET AKTIF -> BUAT TIKET BARU DENGAN gen_random_uuid()
        INSERT INTO t_priority_action (
          action_id, source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'AUTO_CALCULATE', 'SYSTEM', 'DEALER', rec.dealer_id, rec.dealer_name, rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
        v_tickets_inserted := v_tickets_inserted + 1;
      END IF;
    END LOOP;

    -- 2. Evaluasi Unit Prioritas
    FOR rec IN 
      SELECT u.no_fasilitas, u.nopol, u.unit, COALESCE(d.cabang, '-') AS cabang, u.dealer_name,
             u.priority_level, u.priority_score, u.priority_reason, u.gps_status
      FROM m_facility_unit u
      LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
      WHERE u.priority_score > 0
    LOOP
      v_existing_id := NULL;
      SELECT action_id, priority_score, priority_level, action_reason
      INTO v_existing_id, v_existing_score, v_existing_level, v_existing_reason
      FROM t_priority_action
      WHERE entity_type = 'UNIT' AND entity_id = rec.no_fasilitas AND is_fu = false AND source = 'AUTO_CALCULATE'
      LIMIT 1;

      IF v_existing_id IS NOT NULL THEN
        -- SUDAH ADA TIKET AKTIF -> HANYA UPDATE JIKA LEVEL / SKOR / REASON BERUBAH (ESKALASI)
        IF v_existing_score <> rec.priority_score OR v_existing_level <> rec.priority_level OR v_existing_reason <> rec.priority_reason THEN
          UPDATE t_priority_action
          SET priority_level = rec.priority_level,
              priority_score = rec.priority_score,
              action_reason = rec.priority_reason,
              notes = 'Mitra: ' || COALESCE(rec.dealer_name, '-') || ' | Status GPS: ' || COALESCE(rec.gps_status, 'Normal'),
              cabang = COALESCE(rec.cabang, cabang),
              updated_at = NOW()
          WHERE action_id = v_existing_id;
          v_tickets_upgraded := v_tickets_upgraded + 1;
        END IF;
      ELSE
        -- BELUM ADA TIKET AKTIF -> BUAT TIKET BARU DENGAN gen_random_uuid()
        INSERT INTO t_priority_action (
          action_id, source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, notes, is_fu, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), 'AUTO_CALCULATE', 'SYSTEM', 'UNIT', rec.no_fasilitas,
          rec.nopol || ' (' || COALESCE(rec.unit, '-') || ')', rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason,
          'Mitra: ' || COALESCE(rec.dealer_name, '-') || ' | Status GPS: ' || COALESCE(rec.gps_status, 'Normal'),
          false, NOW(), NOW()
        );
        v_tickets_inserted := v_tickets_inserted + 1;
      END IF;
    END LOOP;

    -- 3. Tutup Tiket Otomatis yang Sudah Tidak Prioritas (Skor = 0)
    UPDATE t_priority_action
    SET is_fu = true,
        fu_by = 'AUTO_CLEAR',
        notes = 'Otomatis selesai: status sudah Normal atau Closed',
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'DEALER'
      AND entity_id IN (SELECT dealer_id FROM m_dealer WHERE priority_score = 0);

    UPDATE t_priority_action
    SET is_fu = true,
        fu_by = 'AUTO_CLEAR',
        notes = 'Otomatis selesai: status sudah Normal atau Closed',
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'UNIT'
      AND entity_id IN (SELECT no_fasilitas FROM m_facility_unit WHERE priority_score = 0);

    SELECT COUNT(*) INTO v_active_tasks FROM t_priority_action WHERE is_fu = false;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
  END;

  RETURN json_build_object(
    'status', 'SUCCESS',
    'recalculated_at', NOW(),
    'units_evaluated', v_units_updated,
    'dealers_evaluated', v_dealers_updated,
    'tickets_upgraded_in_place', v_tickets_upgraded,
    'tickets_inserted_new', v_tickets_inserted,
    'active_priority_tasks', v_active_tasks,
    'error_detail', v_log_error
  );
END;
$$;
