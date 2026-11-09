-- ============================================================================
-- DIGIASHA FIELD MONITORING SYSTEM - SUPABASE POSTGRESQL ENGINE
-- File: 29_update_priority_done_clear_logic.sql
-- Purpose:
--   1. Menambahkan kolom tracking multi-visit Validasi Onboarding (New Mitra)
--      pada tabel public.m_dealer (onb_rumah_validated & onb_showroom_validated).
--   2. Backfill status validasi onboarding pada mitra eksisting dan riwayat
--      tr_laporan_visit.
--   3. Memperbarui Stored Procedure public.recalculate_all_priorities() agar:
--      - Parameter "New Mitra" hanya Done/Clear ketika KEDUA lokasi onboarding
--        (C.1 Lokasi Rumah/Domisili DAN C.2 Lokasi Showroom/Tempat Usaha)
--        sudah terisi/tervalidasi (baik dalam 1x visit maupun 2x visit terpisah).
--      - Unit Fasilitas yang sudah Done/Clear pada kunjungan hari ini
--        (last_visit_date = CURRENT_DATE) tidak tertimpa kembali menjadi
--        prioritas saat recalculate_all_priorities() dijalankan di hari yang sama.
-- ============================================================================

-- 1. Tambahkan kolom tracking Validasi Onboarding pada m_dealer
ALTER TABLE public.m_dealer
  ADD COLUMN IF NOT EXISTS onb_rumah_validated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onb_showroom_validated BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.m_dealer.onb_rumah_validated IS 'Status apakah Validasi Onboarding C.1 (Lokasi Rumah / Domisili) sudah terisi untuk New Mitra';
COMMENT ON COLUMN public.m_dealer.onb_showroom_validated IS 'Status apakah Validasi Onboarding C.2 (Lokasi Showroom / Tempat Usaha) sudah terisi untuk New Mitra';

-- 2. Sinkronisasi status validasi onboarding dari riwayat tr_laporan_visit (jika sudah ada inputan)
UPDATE public.m_dealer d
SET
  onb_rumah_validated = COALESCE(d.onb_rumah_validated, false) OR COALESCE(v.has_rumah, false),
  onb_showroom_validated = COALESCE(d.onb_showroom_validated, false) OR COALESCE(v.has_showroom, false)
FROM (
  SELECT
    LOWER(TRIM(dealer_name)) AS d_name,
    BOOL_OR(COALESCE(onb_visit_rumah, false)) AS has_rumah,
    BOOL_OR(COALESCE(onb_visit_showroom, false)) AS has_showroom
  FROM public.tr_laporan_visit
  GROUP BY LOWER(TRIM(dealer_name))
) v
WHERE LOWER(TRIM(d.dealer_name)) = v.d_name;

-- 3. Backfill mitra lama yang sudah pernah dikunjungi (last_visit_date IS NOT NULL)
--    dan bukan berstatus "New Mitra" agar tidak terdeteksi ulang sebagai New Mitra
UPDATE public.m_dealer
SET
  onb_rumah_validated = TRUE,
  onb_showroom_validated = TRUE
WHERE last_visit_date IS NOT NULL
  AND COALESCE(priority_reason, '') NOT ILIKE '%New Mitra%'
  AND NOT (COALESCE(onb_rumah_validated, false) = true AND COALESCE(onb_showroom_validated, false) = false)
  AND NOT (COALESCE(onb_rumah_validated, false) = false AND COALESCE(onb_showroom_validated, false) = true);

-- 4. Perbarui fungsi public.recalculate_all_priorities()
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

  -- Sinkronkan akumulasi Validasi Onboarding dari tr_laporan_visit ke m_dealer
  UPDATE public.m_dealer d
  SET
    onb_rumah_validated = COALESCE(d.onb_rumah_validated, false) OR COALESCE(v.has_rumah, false),
    onb_showroom_validated = COALESCE(d.onb_showroom_validated, false) OR COALESCE(v.has_showroom, false)
  FROM (
    SELECT
      LOWER(TRIM(dealer_name)) AS d_name,
      BOOL_OR(COALESCE(onb_visit_rumah, false)) AS has_rumah,
      BOOL_OR(COALESCE(onb_visit_showroom, false)) AS has_showroom
    FROM public.tr_laporan_visit
    WHERE COALESCE(onb_visit_rumah, false) = true OR COALESCE(onb_visit_showroom, false) = true
    GROUP BY LOWER(TRIM(dealer_name))
  ) v
  WHERE LOWER(TRIM(d.dealer_name)) = v.d_name
    AND (
      (v.has_rumah = true AND COALESCE(d.onb_rumah_validated, false) = false)
      OR (v.has_showroom = true AND COALESCE(d.onb_showroom_validated, false) = false)
    );

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      -- 1. Hitung Aging Visit Unit (Hari ini - Last Visit / Lifetime)
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      (u.last_visit_date IS NOT NULL AND u.last_visit_date >= v_today) AS is_cleared_today,
      
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

        -- Jika unit sudah Done/Clear pada kunjungan hari ini dan tidak ada concern manual aktif baru
        WHEN uc.is_cleared_today AND uc.concern_urgency IS NULL THEN 0

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
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal (Mitra Closed/Dormant)'
        WHEN uc.is_cleared_today AND uc.concern_urgency IS NULL THEN 'Kondisi Normal / Terjadwal Baik'
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
  -- B. EVALUASI DAN UPDATE PRIORITAS MITRA DEALER (m_dealer)
  -- --------------------------------------------------------------------------
  WITH dealer_unit_agg AS (
    SELECT 
      LOWER(TRIM(u.dealer_name)) AS dealer_name_clean,
      COALESCE(MAX(u.priority_score), 0) AS max_unit_score,
      COUNT(CASE WHEN u.priority_score > 0 THEN 1 END)::INT AS urgent_unit_cnt,
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
      c.concern_note,
      COALESCE(d.onb_rumah_validated, false) AS is_onb_rumah_done,
      COALESCE(d.onb_showroom_validated, false) AS is_onb_showroom_done,
      (
        d.last_visit_date IS NULL
        OR COALESCE(d.onb_rumah_validated, false) = false
        OR COALESCE(d.onb_showroom_validated, false) = false
      ) AS is_new_mitra_pending
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
        WHEN dc.is_new_mitra_pending THEN 1 -- New Mitra (Belum Done kedua segmen Validasi Onboarding Rumah & Showroom)
        ELSE 0
      END AS mitra_score,

      CASE
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN dc.calc_aging_visit >= 61 THEN 'Aging Visit Mitra >= 61 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 21 THEN 'Aging Visit Mitra >= 21 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.is_new_mitra_pending THEN
          CASE
            WHEN dc.is_onb_rumah_done = true AND dc.is_onb_showroom_done = false THEN 'New Mitra (Validasi Showroom Belum Selesai)'
            WHEN dc.is_onb_rumah_done = false AND dc.is_onb_showroom_done = true THEN 'New Mitra (Validasi Rumah Belum Selesai)'
            ELSE 'New Mitra (Belum Ada Visit)'
          END
        ELSE 'Normal'
      END AS mitra_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dmr.calc_aging_visit,
      COALESCE(dua.urgent_unit_cnt, 0) AS calc_urgent_units_cnt,
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
    urgent_units_count = fds.calc_urgent_units_cnt,
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
      IF NOT EXISTS (
        SELECT 1 FROM t_priority_action
        WHERE is_fu = false
          AND entity_type = 'DEALER'
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
      ) THEN
        INSERT INTO t_priority_action (
          action_id, log_date, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, source, is_fu, created_at, updated_at
        ) VALUES (
          'ACT-DLR-' || rec.dealer_id || '-' || TO_CHAR(v_today, 'YYYYMMDD'),
          v_today, 'DEALER', rec.dealer_id, rec.dealer_name, rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason,
          'AUTO_SYSTEM', false, NOW(), NOW()
        )
        ON CONFLICT (action_id) DO UPDATE
        SET
          priority_level = EXCLUDED.priority_level,
          priority_score = EXCLUDED.priority_score,
          action_reason = EXCLUDED.action_reason,
          updated_at = NOW();
      ELSE
        UPDATE t_priority_action
        SET
          priority_level = rec.priority_level,
          priority_score = rec.priority_score,
          action_reason = CASE WHEN source = 'MANUAL_SUPERVISOR' THEN action_reason ELSE rec.priority_reason END,
          updated_at = NOW()
        WHERE is_fu = false
          AND entity_type = 'DEALER'
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)));
      END IF;
    END LOOP;

    -- Auto-close tiket DEALER AUTO_SYSTEM yang skornya sudah 0 (Normal)
    UPDATE t_priority_action t
    SET is_fu = true, fu_at = NOW(), fu_by = 'AUTO_CLEAR', updated_at = NOW()
    WHERE t.is_fu = false
      AND t.entity_type = 'DEALER'
      AND t.source = 'AUTO_SYSTEM'
      AND NOT EXISTS (
        SELECT 1 FROM m_dealer d
        WHERE (d.dealer_id = t.entity_id OR LOWER(TRIM(d.dealer_name)) = LOWER(TRIM(t.entity_name)))
          AND d.priority_score > 0
      );

    -- B. Evaluasi Unit Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        u.no_fasilitas,
        u.nopol,
        u.unit,
        u.dealer_name,
        u.priority_level,
        u.priority_score,
        u.priority_reason
      FROM m_facility_unit u
      WHERE u.priority_score > 0
        AND (
          UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
          OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
        )
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM t_priority_action
        WHERE is_fu = false
          AND entity_type = 'UNIT'
          AND entity_id = rec.no_fasilitas
      ) THEN
        INSERT INTO t_priority_action (
          action_id, log_date, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, source, notes, is_fu, created_at, updated_at
        ) VALUES (
          'ACT-UNT-' || REGEXP_REPLACE(rec.no_fasilitas, '[^A-Za-z0-9]', '', 'g') || '-' || TO_CHAR(v_today, 'YYYYMMDD'),
          v_today, 'UNIT', rec.no_fasilitas, COALESCE(rec.nopol, rec.no_fasilitas) || ' - ' || COALESCE(rec.unit, ''),
          '-', rec.priority_level, rec.priority_score, rec.priority_reason,
          'AUTO_SYSTEM', 'Mitra: ' || COALESCE(rec.dealer_name, '-'), false, NOW(), NOW()
        )
        ON CONFLICT (action_id) DO UPDATE
        SET
          priority_level = EXCLUDED.priority_level,
          priority_score = EXCLUDED.priority_score,
          action_reason = EXCLUDED.action_reason,
          updated_at = NOW();
      ELSE
        UPDATE t_priority_action
        SET
          priority_level = rec.priority_level,
          priority_score = rec.priority_score,
          action_reason = CASE WHEN source = 'MANUAL_SUPERVISOR' THEN action_reason ELSE rec.priority_reason END,
          updated_at = NOW()
        WHERE is_fu = false
          AND entity_type = 'UNIT'
          AND entity_id = rec.no_fasilitas;
      END IF;
    END LOOP;

    -- Auto-close tiket UNIT AUTO_SYSTEM yang skornya sudah 0 (Normal)
    UPDATE t_priority_action t
    SET is_fu = true, fu_at = NOW(), fu_by = 'AUTO_CLEAR', updated_at = NOW()
    WHERE t.is_fu = false
      AND t.entity_type = 'UNIT'
      AND t.source = 'AUTO_SYSTEM'
      AND NOT EXISTS (
        SELECT 1 FROM m_facility_unit u
        WHERE u.no_fasilitas = t.entity_id
          AND u.priority_score > 0
      );

    SELECT COUNT(*) INTO v_active_tasks FROM t_priority_action WHERE is_fu = false;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
  END;

  RETURN json_build_object(
    'status', 'SUCCESS',
    'recalculated_at', NOW(),
    'units_evaluated', v_units_updated,
    'dealers_evaluated', v_dealers_updated,
    'active_priority_tasks', v_active_tasks,
    'task_sync_warning', v_log_error
  );
END;
$$;

-- Jalankan kalkulasi ulang prioritas langsung setelah fungsi diperbarui
SELECT public.recalculate_all_priorities();

