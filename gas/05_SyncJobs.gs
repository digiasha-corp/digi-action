/**
 * 05_SyncJobs.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Job Sinkronisasi & Kalkulasi Otomatis "Priority Visit" (Harian Pukul 02.00 Dini Hari)
 * Format Data: 100% Flat Tabular (Siap untuk Looker Studio Dashboard)
 */

/**
 * Trigger Otomatis: Dijalankan setiap hari pukul 02:00 - 03:00 WIB
 */
function dailyPrioritySyncJob() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  Logger.log("=== MEMULAI DAILY PRIORITY SYNC JOB: " + now.toISOString() + " ===");

  // 0. Tarik Data Terbaru dari Spreadsheet Sumber Jika Tersedia
  try {
    if (typeof syncDealerAndFacilityFromSource === "function") {
      syncDealerAndFacilityFromSource();
    }
  } catch (errSync) {
    Logger.log("Warning sync source: " + errSync.toString());
  }

  // 1. Ambil Sheet Terkait
  const sheetDealer = ss.getSheetByName(CONFIG.SHEETS.DEALER);
  const sheetUnit = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT);
  const sheetAssign = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT);
  const sheetVisit = ss.getSheetByName(CONFIG.SHEETS.VISIT_HEADER);
  const sheetVisitUnit = ss.getSheetByName(CONFIG.SHEETS.VISIT_UNIT);
  const sheetGpsMaint = ss.getSheetByName(CONFIG.SHEETS.GPS_MAINTENANCE);
  const sheetFacAudit = ss.getSheetByName(CONFIG.SHEETS.FAC_AUDIT || "TR_GPS_FAC_CHECK");

  if (!sheetDealer || !sheetUnit) {
    Logger.log("ERROR: Sheet M_DEALER atau M_FACILITY_UNIT tidak ditemukan.");
    return;
  }

  // 2. Baca Data Tabel ke Objek
  const dealers = getTableObjects(sheetDealer);
  const units = getTableObjects(sheetUnit);
  const assignments = sheetAssign ? getTableObjects(sheetAssign).filter(a => String(a.status || "").toUpperCase() !== "RESOLVED") : [];
  const visits = sheetVisit ? getTableObjects(sheetVisit) : [];
  const unitChecks = sheetVisitUnit ? getTableObjects(sheetVisitUnit) : [];
  const gpsMaints = sheetGpsMaint ? getTableObjects(sheetGpsMaint) : [];
  const facAudits = sheetFacAudit ? getTableObjects(sheetFacAudit) : [];

  // Hitung Status GPS Terakhir & Tanggal Log dari TR_GPS_FAC_CHECK
  const lastFacGpsStatusByUnit = {};
  const lastFacGpsDateByUnit = {};
  facAudits.forEach(f => {
    const fasKey = String(f.no_fasilitas || "").trim().toUpperCase();
    const nopolKey = String(f.nopol || "").trim().toLowerCase();
    const statusGps = String(f.status_gps || f.status || f.status_device || "").trim();
    const tglLog = parseDateValue(f.timestamp || f.created_at || f.tanggal);
    if (statusGps && statusGps !== "-") {
      if (fasKey) {
        if (!lastFacGpsDateByUnit[fasKey] || (tglLog && tglLog > lastFacGpsDateByUnit[fasKey])) {
          lastFacGpsStatusByUnit[fasKey] = statusGps;
          if (tglLog) lastFacGpsDateByUnit[fasKey] = tglLog;
        }
      }
      if (nopolKey) {
        if (!lastFacGpsDateByUnit[nopolKey] || (tglLog && tglLog > lastFacGpsDateByUnit[nopolKey])) {
          lastFacGpsStatusByUnit[nopolKey] = statusGps;
          if (tglLog) lastFacGpsDateByUnit[nopolKey] = tglLog;
        }
      }
    }
  });

  // 3. Mapping Penugasan Concern Aktif ke Dealer & Unit
  const dealerConcerns = {};
  const unitConcerns = {};

  assignments.forEach(a => {
    const dealerKey = String(a.dealer_name || "").trim().toLowerCase();
    const unitKey = String(a.unit_fasilitas || "Umum").trim().toLowerCase();
    const urgency = String(a.urgency_level || "Penting").trim();
    const note = String(a.instruksi || "").trim();

    if (unitKey === "umum" || unitKey.includes("seluruh")) {
      if (!dealerConcerns[dealerKey] || getUrgencyScore(urgency) > getUrgencyScore(dealerConcerns[dealerKey].urgency)) {
        dealerConcerns[dealerKey] = { urgency: urgency, note: note };
      }
    } else {
      if (!unitConcerns[unitKey] || getUrgencyScore(urgency) > getUrgencyScore(unitConcerns[unitKey].urgency)) {
        unitConcerns[unitKey] = { urgency: urgency, note: note };
      }
    }
  });

  // 4. Hitung Riwayat Visit Terakhir (Mitra & Unit Fasilitas)
  const lastVisitByDealer = {};
  visits.forEach(v => {
    const key = String(v.dealer_name || "").trim().toLowerCase();
    const tgl = parseDateValue(v.created_at || v.timestamp || v.tanggal_visit);
    if (tgl && (!lastVisitByDealer[key] || tgl > lastVisitByDealer[key])) {
      lastVisitByDealer[key] = tgl;
    }
  });

  const lastCheckByUnit = {};
  unitChecks.forEach(c => {
    const fasKey = String(c.no_fasilitas || "").trim().toUpperCase();
    const nopolKey = String(c.nopol || "").trim().toLowerCase();
    const tgl = parseDateValue(c.created_at || c.timestamp || c.tanggal_visit || c.tanggal);
    if (tgl) {
      if (fasKey && (!lastCheckByUnit[fasKey] || tgl > lastCheckByUnit[fasKey])) lastCheckByUnit[fasKey] = tgl;
      if (nopolKey && (!lastCheckByUnit[nopolKey] || tgl > lastCheckByUnit[nopolKey])) lastCheckByUnit[nopolKey] = tgl;
    }
  });

  const lastGpsMaintByUnit = {};
  const lastImeiByUnit = {};
  const lastGpsActByUnit = {};

  gpsMaints.forEach(g => {
    const fasKey = String(g.no_fasilitas || "").trim().toUpperCase();
    const nopolKey = String(g.nopol || "").trim().toLowerCase();
    const tgl = parseDateValue(g.created_at || g.timestamp || g.tanggal || g.tgl_maintenance);
    const imei = String(g.imei_baru || g.imei || "").trim();
    const act = String(g.aktivitas || g.act_type || "").trim();

    if (tgl) {
      if (fasKey && (!lastGpsMaintByUnit[fasKey] || tgl > lastGpsMaintByUnit[fasKey])) {
        lastGpsMaintByUnit[fasKey] = tgl;
        lastImeiByUnit[fasKey] = act === "Cabut GPS" ? "" : imei;
        lastGpsActByUnit[fasKey] = act;
      }
      if (nopolKey && (!lastGpsMaintByUnit[nopolKey] || tgl > lastGpsMaintByUnit[nopolKey])) {
        lastGpsMaintByUnit[nopolKey] = tgl;
        lastImeiByUnit[nopolKey] = act === "Cabut GPS" ? "" : imei;
        lastGpsActByUnit[nopolKey] = act;
      }
    }
  });

  // 5. KALKULASI SKORING SETIAP UNIT (PRIORITY BY UNIT)
  const evaluatedUnits = units.map(u => {
    const fasKey = String(u.no_fasilitas || "").trim().toUpperCase();
    const nopolKey = String(u.nopol || "").trim().toLowerCase();
    const dealerKey = String(u.dealer_name || "").trim().toLowerCase();

    // Lifetime Kontrak (Hari)
    let lifetime = Number(u.lifetime_days || 0);
    let contractStartDate = parseDateValue(u.contract_start_date || u.tgl_pencairan || u.created_at);
    if (contractStartDate) {
      lifetime = calculateDaysDiff(contractStartDate, now);
    }

    // Aging Visit Unit:
    // Urutan prioritas: 1. TR_VISIT_UNIT_CHECK -> 2. TR_LAPORAN_VISIT Dealer -> 3. u.last_visit_date -> 4. Fallback ke Tanggal Kontrak
    let agingVisit = 0;
    let lastVisitUnitDate = null;

    if (fasKey && lastCheckByUnit[fasKey]) {
      lastVisitUnitDate = lastCheckByUnit[fasKey];
    } else if (nopolKey && lastCheckByUnit[nopolKey]) {
      lastVisitUnitDate = lastCheckByUnit[nopolKey];
    } else if (lastVisitByDealer[dealerKey]) {
      lastVisitUnitDate = lastVisitByDealer[dealerKey];
    } else if (u.last_visit_date) {
      lastVisitUnitDate = parseDateValue(u.last_visit_date);
    }

    if (lastVisitUnitDate) {
      agingVisit = calculateDaysDiff(lastVisitUnitDate, now);
    } else if (contractStartDate) {
      // Belum pernah divisit sejak kontrak cair -> aging dihitung sejak tanggal awal kontrak
      agingVisit = calculateDaysDiff(contractStartDate, now);
    } else if (lifetime > 0) {
      agingVisit = lifetime;
    } else {
      agingVisit = Number(u.aging_visit_days || u.aging_visit_unit || 0);
    }

    // Overdue Days
    const overdue = Number(u.overdue_days || 0);

    // Aging GPS Maintenance & Sync IMEI GPS (prioritaskan no_fasilitas, lalu fallback nopol)
    let agingGpsMaint = Number(u.aging_gps_maint || 0);
    let currentImei = String(u.imei_gps || "").trim();

    if (fasKey && lastGpsMaintByUnit[fasKey]) {
      agingGpsMaint = calculateDaysDiff(lastGpsMaintByUnit[fasKey], now);
      if (lastImeiByUnit[fasKey] !== undefined) currentImei = lastImeiByUnit[fasKey];
    } else if (nopolKey && lastGpsMaintByUnit[nopolKey]) {
      agingGpsMaint = calculateDaysDiff(lastGpsMaintByUnit[nopolKey], now);
      if (lastImeiByUnit[nopolKey] !== undefined) currentImei = lastImeiByUnit[nopolKey];
    }

    // Status GPS: 1. Log manual TR_GPS_FAC_CHECK -> 2. u.gps_status di M_FACILITY_UNIT -> 3. Fallback (currentImei ? "Normal" : "Belum Pasang")
    let gpsStatus = "";
    let facGpsLogDate = null;
    if (fasKey && lastFacGpsStatusByUnit[fasKey]) {
      gpsStatus = lastFacGpsStatusByUnit[fasKey];
      facGpsLogDate = lastFacGpsDateByUnit[fasKey] || null;
    } else if (nopolKey && lastFacGpsStatusByUnit[nopolKey]) {
      gpsStatus = lastFacGpsStatusByUnit[nopolKey];
      facGpsLogDate = lastFacGpsDateByUnit[nopolKey] || null;
    } else if (u.gps_status) {
      gpsStatus = String(u.gps_status).trim();
    } else {
      gpsStatus = currentImei ? "Normal" : "Belum Pasang";
    }

    if (!currentImei && gpsStatus.toLowerCase() === "normal") {
      gpsStatus = "Belum Pasang";
    }

    // Validasi Cerdas Status GPS (Tanggal Anomali vs Tanggal Visit Terakhir):
    // Jika PIC sudah melakukan visit pada atau setelah tanggal anomali GPS dicatat,
    // maka status anomali dianggap SUDAH DIVALIDASI di lapangan dan tidak memicu alarm prioritas berulang.
    let isGpsAnomalyActive = true;
    const isAnomalyStatus = ["pelepasan", "offline", "baterai lemah", "belum lepas", "belum pasang", "geser"].some(s => gpsStatus.toLowerCase().includes(s));
    
    if (isAnomalyStatus && facGpsLogDate && lastVisitUnitDate) {
      const dVisitTime = new Date(lastVisitUnitDate.getFullYear(), lastVisitUnitDate.getMonth(), lastVisitUnitDate.getDate()).getTime();
      const dLogTime = new Date(facGpsLogDate.getFullYear(), facGpsLogDate.getMonth(), facGpsLogDate.getDate()).getTime();
      if (dVisitTime >= dLogTime) {
        isGpsAnomalyActive = false; // Sudah divalidasi oleh PIC di lapangan
      }
    }

    // Pengecekan H-3 JTO
    const isH3Jto = checkIsH3JTO(u.jto_date || u.tgl_jatuh_tempo, now);

    // Concern
    const concern = unitConcerns[nopolKey] || null;

    // Hitung Urgensi Unit
    const urgency = calculateUnitUrgencyGAS({
      contract_status: u.contract_status,
      imei_gps: currentImei,
      gps_status: gpsStatus,
      is_gps_anomaly_active: isGpsAnomalyActive,
      aging_visit_unit: agingVisit,
      lifetime_days: lifetime,
      overdue_days: overdue,
      aging_gps_maint: agingGpsMaint,
      is_h3_jto: isH3Jto,
      unit_concern: concern
    });

    return {
      ...u,
      imei_gps: currentImei,
      gps_status: gpsStatus,
      aging_visit_unit: agingVisit,
      lifetime_days: lifetime,
      aging_gps_maint: agingGpsMaint,
      is_h3_jto: isH3Jto ? "TRUE" : "FALSE",
      priority_level: urgency.level,
      priority_score: urgency.score,
      priority_reason: urgency.reason
    };
  });

  // 6. KALKULASI SKORING SETIAP DEALER (PRIORITY BY DEALER)
  const evaluatedDealers = dealers.map(d => {
    const dealerKey = String(d.dealer_name || "").trim().toLowerCase();

    // Aging Visit Mitra:
    // Urutan prioritas: 1. TR_LAPORAN_VISIT -> 2. d.last_visit_date -> 3. Fallback ke Tanggal Kerjasama / Kontrak Unit Tertua
    let agingMitra = 0;
    let lastVisitDealerDate = null;
    if (lastVisitByDealer[dealerKey]) {
      lastVisitDealerDate = lastVisitByDealer[dealerKey];
    } else if (d.last_visit_date) {
      lastVisitDealerDate = parseDateValue(d.last_visit_date);
    }

    if (lastVisitDealerDate) {
      agingMitra = calculateDaysDiff(lastVisitDealerDate, now);
    } else if (d.join_date || d.tanggal_kerjasama || d.created_at) {
      const joinDate = parseDateValue(d.join_date || d.tanggal_kerjasama || d.created_at);
      if (joinDate) agingMitra = calculateDaysDiff(joinDate, now);
    } else {
      // Fallback cerdas: Ambil masa aktif kontrak unit tertua di dealer tersebut
      const matchedUnits = units.filter(u => String(u.dealer_name || "").trim().toLowerCase() === dealerKey);
      let maxLifetime = 0;
      matchedUnits.forEach(u => {
        const lt = Number(u.lifetime_days || 0);
        if (lt > maxLifetime) maxLifetime = lt;
      });
      agingMitra = maxLifetime > 0 ? maxLifetime : Number(d.aging_visit_mitra || d.aging_visit_days || 0);
    }

    // Ambil unit yang berada di bawah dealer ini
    const dealerUnits = evaluatedUnits.filter(u => String(u.dealer_name || "").trim().toLowerCase() === dealerKey);
    const concern = dealerConcerns[dealerKey] || null;

    // Hitung Urgensi Dealer
    const urgency = calculateMitraUrgencyGAS({
      aging_visit_mitra: agingMitra,
      dealer_concern: concern,
      productivity: d.productivity,
      units: dealerUnits
    });

    return {
      ...d,
      aging_visit_mitra: agingMitra,
      urgent_units_count: urgency.urgentUnitsCount,
      priority_level: urgency.level,
      priority_score: urgency.score,
      priority_reason: urgency.reason,
      mitra_internal_level: urgency.mitraLevel
    };
  });

  // 7. Simpan Hasil Kalkulasi Kembali ke Spreadsheet Master (Current Snapshot)
  updateSheetWithCalculations(sheetUnit, evaluatedUnits, [
    "imei_gps", "gps_status", "aging_visit_unit", "lifetime_days", "aging_gps_maint", "is_h3_jto", "priority_level", "priority_score", "priority_reason"
  ]);

  updateSheetWithCalculations(sheetDealer, evaluatedDealers, [
    "aging_visit_mitra", "urgent_units_count", "priority_level", "priority_score", "priority_reason"
  ]);

  // 8. Catat Snapshot Historis Harian ke LOG_PRIORITY_DAILY (Time-series untuk Looker Studio)
  appendDailyPriorityHistory(ss, now, evaluatedDealers, evaluatedUnits);

  Logger.log("=== DAILY PRIORITY SYNC JOB SELESAI DENGAN SUKSES ===");
}

// =========================================================================
// HELPER VALIDASI IMEI GPS
// =========================================================================
function hasValidImei(imeiVal) {
  if (!imeiVal) return false;
  const s = String(imeiVal).trim();
  if (!s || s === "-" || s === "0" || s === "null" || s === "undefined") return false;
  const lower = s.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "none" || lower === "tidak ada" || lower === "belum pasang" || lower === "tidak terpasang") {
    return false;
  }
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6;
}

// =========================================================================
// LOGIKA SKORING LEVEL UNIT (APPS SCRIPT VERSION)
// =========================================================================
function calculateUnitUrgencyGAS(u) {
  const agingVisit = Number(u.aging_visit_unit || 0);
  const lifetime = Number(u.lifetime_days || 0);
  const overdue = Number(u.overdue_days || 0);
  const agingGpsMaint = Number(u.aging_gps_maint || 0);
  const gpsStatus = String(u.gps_status || "Normal").trim();
  const isGpsAnomalyActive = (u.is_gps_anomaly_active !== false);
  const nearJto = (u.is_h3_jto === true || u.is_h3_jto === "TRUE");

  let concernUrgency = "";
  let concernNote = "";
  if (u.unit_concern) {
    concernUrgency = u.unit_concern.urgency || "";
    concernNote = u.unit_concern.note || "";
  }

  // Pengecekan Kelayakan Status Kontrak Unit:
  // HANYA proses jika status LIVE, atau status EXPIRED tetapi memiliki nomor IMEI GPS valid
  const contractStatus = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
  const rawImei = String(u.imei_gps || u.imei || "").trim();
  const hasImei = hasValidImei(rawImei);
  const isLive = contractStatus === "LIVE" || contractStatus.indexOf("LIVE") !== -1;
  const isExpiredWithImei = contractStatus.indexOf("EXPIRED") !== -1 && hasImei;
  const isEligibleContract = isLive || isExpiredWithImei;

  if (!isEligibleContract && !concernUrgency) {
    return { level: "Normal", score: 0, reason: "Status Kontrak Non-Eligible (" + (contractStatus || "Non-Live") + ")" };
  }

  // 1. LEVEL "SANGAT PENTING" (Score: 3)
  if (concernUrgency === "Sangat Penting") {
    return { level: "Sangat Penting", score: 3, reason: "Assign Concern '" + (concernNote || "Sangat Penting") + "'" };
  }
  if (isGpsAnomalyActive && ["Pelepasan", "Offline", "Baterai Lemah"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
    return { level: "Sangat Penting", score: 3, reason: "Status GPS: " + gpsStatus };
  }
  if (agingVisit >= 22 && lifetime > 90) {
    return { level: "Sangat Penting", score: 3, reason: "Aging Visit >= 22 hr (" + agingVisit + " hr) & Lifetime > 90 hr (" + lifetime + " hr)" };
  }
  if (agingVisit >= 15 && nearJto) {
    return { level: "Sangat Penting", score: 3, reason: "Aging Visit >= 15 hr (" + agingVisit + " hr) & Kondisi H-3 JTO" };
  }

  // 2. LEVEL "PENTING" (Score: 2)
  if (concernUrgency === "Penting") {
    return { level: "Penting", score: 2, reason: "Assign Concern '" + (concernNote || "Penting") + "'" };
  }
  if (isGpsAnomalyActive && ["Belum Lepas", "Belum Pasang", "Geser"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
    return { level: "Penting", score: 2, reason: "Status GPS: " + gpsStatus };
  }
  if (agingVisit >= 3 && overdue >= 3) {
    return { level: "Penting", score: 2, reason: "Aging Visit >= 3 hr (" + agingVisit + " hr) & Overdue >= 3 hr (" + overdue + " hr)" };
  }
  if (agingVisit >= 5 && nearJto) {
    return { level: "Penting", score: 2, reason: "Aging Visit >= 5 hr (" + agingVisit + " hr) & Kondisi H-3 JTO" };
  }
  if (agingVisit >= 22) {
    return { level: "Penting", score: 2, reason: "Aging Visit Unit >= 22 hr (" + agingVisit + " hr)" };
  }

  // 3. LEVEL "MODERAT" (Score: 1)
  if (agingVisit >= 15) {
    return { level: "Moderat", score: 1, reason: "Aging Visit Unit >= 15 hr (" + agingVisit + " hr)" };
  }
  if (concernUrgency === "Moderat") {
    return { level: "Moderat", score: 1, reason: "Assign Concern '" + (concernNote || "Moderat") + "'" };
  }
  if (agingGpsMaint > 30) {
    return { level: "Moderat", score: 1, reason: "Aging Maintenance GPS > 30 hr (" + agingGpsMaint + " hr)" };
  }

  // 4. LEVEL "NORMAL" (Score: 0)
  return { level: "Normal", score: 0, reason: "Kondisi Normal / Terjadwal Baik" };
}

// =========================================================================
// LOGIKA SKORING LEVEL MITRA (APPS SCRIPT VERSION)
// =========================================================================
function calculateMitraUrgencyGAS(dealerData) {
  const agingMitra = Number(dealerData.aging_visit_mitra || 0);
  const rawProd = String(dealerData.productivity || "").trim().toLowerCase();
  const rawStatus = String(dealerData.status || "").trim().toLowerCase();

  // Status Closed / Dormant (Cek kolom productivity maupun kolom status)
  const isClosedOrDormant = rawProd.includes("closed") || rawProd.includes("cloesed") || rawProd.includes("dormant") || rawProd.includes("7.closed") || rawProd.includes("5.dormant") || rawStatus.includes("closed") || rawStatus.includes("dormant");
  const isAgingAllowed = !isClosedOrDormant;

  let concernUrgency = "";
  let concernNote = "";
  if (dealerData.dealer_concern) {
    concernUrgency = dealerData.dealer_concern.urgency || "";
    concernNote = dealerData.dealer_concern.note || "";
  }

  // A. Evaluasi Internal Dealer
  let mitraScore = 0;
  let mitraLevel = "Normal";
  let mitraReason = isClosedOrDormant ? "Mitra Closed / Dormant" : "Kondisi Normal";

  if (concernUrgency === "Sangat Penting") {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = "Concern Mitra: '" + (concernNote || "Sangat Penting") + "'";
  } else if (isAgingAllowed && agingMitra >= 61) {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = "Aging Visit Mitra >= 61 hr (" + agingMitra + " hr)";
  } else if (concernUrgency === "Penting") {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = "Concern Mitra: '" + (concernNote || "Penting") + "'";
  } else if (isAgingAllowed && agingMitra >= 31) {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = "Aging Visit Mitra >= 31 hr (" + agingMitra + " hr)";
  } else if (concernUrgency === "Moderat") {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = "Concern Mitra: '" + (concernNote || "Moderat") + "'";
  } else if (isAgingAllowed && agingMitra >= 21) {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = "Aging Visit Mitra >= 21 hr (" + agingMitra + " hr)";
  }

  // B. Agregasi Unit di Showroom (Unit LIVE atau EXPIRED dengan IMEI valid dapat memicu dealer)
  let highestUnitScore = 0;
  let urgentUnitsCount = 0;
  let topUnitReason = "";

  if (dealerData.units && dealerData.units.length > 0) {
    dealerData.units.forEach(u => {
      const uContract = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
      const uImei = String(u.imei_gps || u.imei || "").trim();
      const uHasImei = hasValidImei(uImei);
      const isULive = uContract === "LIVE" || uContract.indexOf("LIVE") !== -1;
      const isUExpiredWithImei = uContract.indexOf("EXPIRED") !== -1 && uHasImei;
      
      // Lewati unit jika tidak eligible (misal EXPIRED tanpa IMEI dan tanpa concern)
      if (!isULive && !isUExpiredWithImei && !u.unit_concern) {
        return;
      }

      const score = Number(u.priority_score || 0);
      if (score > 0) urgentUnitsCount++;
      if (score > highestUnitScore) {
        highestUnitScore = score;
        topUnitReason = u.priority_reason || "";
      }
    });
  }

  const finalScore = Math.max(mitraScore, highestUnitScore);
  const scoreMap = { 3: "Sangat Penting", 2: "Penting", 1: "Moderat", 0: "Normal" };
  const finalLevel = scoreMap[finalScore] || "Normal";

  let finalReason = mitraReason;
  if (highestUnitScore > mitraScore) {
    finalReason = "Pemicu Unit: " + topUnitReason;
  }

  return {
    level: finalLevel,
    score: finalScore,
    reason: finalReason,
    mitraLevel: mitraLevel,
    mitraScore: mitraScore,
    urgentUnitsCount: urgentUnitsCount
  };
}

// =========================================================================
// HELPER FUNCTIONS & SPREADSHEET WRITERS
// =========================================================================

function getUrgencyScore(urgency) {
  if (urgency === "Sangat Penting") return 3;
  if (urgency === "Penting") return 2;
  if (urgency === "Moderat") return 1;
  return 0;
}

function calculateDaysDiff(fromDate, toDate) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const d1 = new Date(fromDate);
  const d2 = new Date(toDate);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / msPerDay));
}

function checkIsH3JTO(jtoDateVal, now) {
  if (!jtoDateVal) return false;
  const jtoDate = parseDateValue(jtoDateVal);
  if (!jtoDate) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  jtoDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((jtoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return (diffDays >= 0 && diffDays <= 3);
}

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const str = String(val).trim();
  if (str.indexOf("-") !== -1) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  if (str.indexOf("/") !== -1) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const d = new Date(parts[2] + "-" + parts[1] + "-" + parts[0]);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function getTableObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  const rows = [];

  for (let r = 1; r < data.length; r++) {
    const obj = { _rowIndex: r + 1 };
    for (let c = 0; c < headers.length; c++) {
      const h = headers[c];
      obj[h] = data[r][c];
      if (h) obj[h.toLowerCase()] = data[r][c];
    }
    rows.push(obj);
  }
  return rows;
}

function updateSheetWithCalculations(sheet, items, targetColumns) {
  if (!items || items.length === 0) return;
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0].map(h => String(h).trim());

  // Pastikan seluruh kolom target ada di header sheet, jika belum ada tambahkan
  targetColumns.forEach(col => {
    if (headers.indexOf(col) === -1) {
      headers.push(col);
      sheet.getRange(1, headers.length).setValue(col);
    }
  });

  const fullData = sheet.getDataRange().getValues();
  const updatedHeaders = fullData[0].map(h => String(h).trim());
  const colIndexes = {};
  targetColumns.forEach(col => {
    colIndexes[col] = updatedHeaders.indexOf(col);
  });

  // Tulis nilai kalkulasi ke setiap baris
  items.forEach(item => {
    const rIdx = item._rowIndex;
    if (rIdx && rIdx <= fullData.length) {
      targetColumns.forEach(col => {
        const cIdx = colIndexes[col];
        if (cIdx !== -1) {
          sheet.getRange(rIdx, cIdx + 1).setValue(item[col] !== undefined ? item[col] : "");
        }
      });
    }
  });
}

function appendDailyPriorityHistory(ss, now, dealers, units) {
  let sheetLog = ss.getSheetByName(CONFIG.SHEETS.PRIORITY_LOG || "LOG_PRIORITY_DAILY");
  const headers = [
    "log_id",
    "log_date",
    "timestamp",
    "entity_type",
    "entity_id",
    "entity_name",
    "cabang",
    "priority_level",
    "priority_score",
    "priority_reason",
    "aging_visit",
    "lifetime_days",
    "overdue_days",
    "gps_status",
    "is_h3_jto",
    "urgent_units_count",
    "active_concern"
  ];

  if (!sheetLog) {
    sheetLog = ss.insertSheet(CONFIG.SHEETS.PRIORITY_LOG || "LOG_PRIORITY_DAILY");
    sheetLog.appendRow(headers);
    sheetLog.setFrozenRows(1);
  }

  const dateStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");
  const timeStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  const rowsToAppend = [];

  // 1. Record History Mitra Dealer (Hanya yang terkena parameter prioritas / Score > 0)
  dealers.forEach((d, idx) => {
    const score = Number(d.priority_score || 0);
    const level = String(d.priority_level || "").trim().toLowerCase();
    if (score <= 0 || level === "normal") return; // Skip normal untuk menghemat baris spreadsheet

    const logId = "LOG-DLR-" + dateStr.replace(/-/g, '') + "-" + String(idx + 1).padStart(3, '0');
    const concernText = d.dealer_concern ? (typeof d.dealer_concern === 'object' ? d.dealer_concern.note : d.dealer_concern) : "-";
    rowsToAppend.push([
      logId,
      dateStr,
      timeStr,
      "DEALER",
      d.dealer_id || "-",
      d.dealer_name || "-",
      d.cabang || "-",
      d.priority_level || "Normal",
      d.priority_score || 0,
      d.priority_reason || "-",
      d.aging_visit_mitra || 0,
      "-",
      "-",
      "-",
      "-",
      d.urgent_units_count || 0,
      concernText
    ]);
  });

  // 2. Record History Unit Fasilitas (Hanya yang terkena parameter prioritas / Score > 0)
  units.forEach((u, idx) => {
    const score = Number(u.priority_score || 0);
    const level = String(u.priority_level || "").trim().toLowerCase();
    if (score <= 0 || level === "normal") return; // Skip normal untuk menghemat baris spreadsheet

    const logId = "LOG-UNT-" + dateStr.replace(/-/g, '') + "-" + String(idx + 1).padStart(3, '0');
    const concernText = u.unit_concern ? (typeof u.unit_concern === 'object' ? u.unit_concern.note : u.unit_concern) : "-";
    rowsToAppend.push([
      logId,
      dateStr,
      timeStr,
      "UNIT",
      u.no_fasilitas || u.nopol || "-",
      (u.unit || "-") + " (" + (u.dealer_name || "-") + ")",
      u.cabang || "-",
      u.priority_level || "Normal",
      u.priority_score || 0,
      u.priority_reason || "-",
      u.aging_visit_unit || 0,
      u.lifetime_days || 0,
      u.overdue_days || 0,
      u.gps_status || "Normal",
      u.is_h3_jto || "FALSE",
      "-",
      concernText
    ]);
  });

  // 3. Bulk Insert ke Sheet
  if (rowsToAppend.length > 0) {
    const startRow = sheetLog.getLastRow() + 1;
    sheetLog.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }
}

// =========================================================================
// SETUP TRIGGER OTOMATIS (PUKUL 02.00 DINI HARI)
// =========================================================================
function setupDailyPrioritySyncTrigger() {
  // Hapus trigger lama jika ada agar tidak double trigger
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === "dailyPrioritySyncJob") {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Buat trigger harian pukul 02:00
  ScriptApp.newTrigger("dailyPrioritySyncJob")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  Logger.log("Trigger 'dailyPrioritySyncJob' berhasil disetel untuk berjalan setiap hari pukul 02:00 Dini Hari!");
}

// =========================================================================
// =========================================================================
// SINKRONISASI MASTER DEALER & FASILITAS DARI SPREADSHEET SUMBER
// =========================================================================
function syncDealerAndFacilityFromSource() {
  try {
    const ssDb = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    const sourceId = CONFIG.DEALER_FACILITY_SOURCE_ID || SPREADSHEET_DEALER_SOURCE_ID;
    if (!sourceId) {
      Logger.log("ERROR: DEALER_FACILITY_SOURCE_ID belum dikonfigurasi.");
      return { success: false, message: "ID Spreadsheet Sumber belum dikonfigurasi." };
    }

    const ssSource = SpreadsheetApp.openById(sourceId);
    const now = new Date();

    // 1. SINKRONISASI M_DEALER
    let sourceDealerSheet = null;
    const sourceSheets = ssSource.getSheets();
    const targetDealerGid = Number(CONFIG.DEALER_SHEET_GID || DEALER_SHEET_GID || 0);

    for (let s of sourceSheets) {
      if (s.getSheetId() === targetDealerGid || s.getName().toLowerCase().includes("dealer") || s.getName().toLowerCase().includes("mitra")) {
        sourceDealerSheet = s;
        break;
      }
    }

    if (sourceDealerSheet) {
      const rawDealerData = sourceDealerSheet.getDataRange().getValues();
      if (rawDealerData.length > 6) { // Data dimulai dari baris ke-7 (index r = 6)
        const dbDealerSheet = ssDb.getSheetByName(CONFIG.SHEETS.DEALER || "M_DEALER");
        const sheetVisit = ssDb.getSheetByName(CONFIG.SHEETS.VISIT_HEADER || "TR_LAPORAN_VISIT");
        
        // Ambil riwayat visit terakhir dari TR_LAPORAN_VISIT
        const lastVisitByDealer = {};
        if (sheetVisit) {
          const visitData = sheetVisit.getDataRange().getValues();
          if (visitData.length > 1) {
            const vHeaders = visitData[0].map(h => String(h).trim().toLowerCase());
            const idxVDName = vHeaders.indexOf("dealer_name");
            const idxVTgl = vHeaders.findIndex(h => h.includes("tanggal") || h.includes("created_at") || h.includes("timestamp"));
            for (let v = 1; v < visitData.length; v++) {
              const dNameKey = String(visitData[v][idxVDName !== -1 ? idxVDName : 3] || "").trim().toLowerCase();
              const tglVal = visitData[v][idxVTgl !== -1 ? idxVTgl : 1];
              const tgl = parseDateValue(tglVal);
              if (dNameKey && tgl && (!lastVisitByDealer[dNameKey] || tgl > lastVisitByDealer[dNameKey])) {
                lastVisitByDealer[dNameKey] = tgl;
              }
            }
          }
        }

        if (dbDealerSheet) {
          // Ambil existing snapshot agar status (ACTIVE/INACTIVE) dan manual input user tidak hilang
          const existingData = dbDealerSheet.getDataRange().getValues();
          const existingMap = {};
          if (existingData.length > 1) {
            const exHeaders = existingData[0].map(h => String(h).trim().toLowerCase());
            const idxDId = exHeaders.indexOf("dealer_id");
            const idxDName = exHeaders.indexOf("dealer_name");
            const idxCabang = exHeaders.indexOf("cabang");
            const idxAreaCover = exHeaders.findIndex(h => h.includes("area_cover") || h.includes("area"));
            const idxStatus = exHeaders.indexOf("status");
            const idxLastVisit = exHeaders.indexOf("last_visit_date");
            const idxAging = exHeaders.findIndex(h => h.includes("aging_visit"));
            const idxUrgentUnits = exHeaders.indexOf("urgent_units_count");
            const idxPrioLevel = exHeaders.indexOf("priority_level");
            const idxPrioScore = exHeaders.indexOf("priority_score");
            const idxPrioReason = exHeaders.indexOf("priority_reason");
            
            for (let i = 1; i < existingData.length; i++) {
              const dId = idxDId !== -1 ? String(existingData[i][idxDId] || "").trim() : "";
              const name = String(existingData[i][idxDName !== -1 ? idxDName : 1] || "").trim().toLowerCase();
              const areaCoverVal = idxAreaCover !== -1 ? String(existingData[i][idxAreaCover] || "").trim() : "";
              
              // Status murni validasi ACTIVE / INACTIVE dari input manual admin sebelumnya
              let statusVal = "ACTIVE";
              if (idxStatus !== -1 && existingData[i][idxStatus]) {
                const rawSt = String(existingData[i][idxStatus]).trim().toUpperCase();
                if (rawSt === "INACTIVE" || rawSt === "NONACTIVE" || rawSt === "NON-ACTIVE" || rawSt === "TIDAK AKTIF") {
                  statusVal = "INACTIVE";
                } else {
                  statusVal = "ACTIVE";
                }
              }

              const lastVVal = idxLastVisit !== -1 ? existingData[i][idxLastVisit] : "";
              const agingVal = idxAging !== -1 ? existingData[i][idxAging] : 0;
              const urgentUnitsVal = idxUrgentUnits !== -1 ? Number(existingData[i][idxUrgentUnits] || 0) : 0;
              const prioLevelVal = idxPrioLevel !== -1 ? String(existingData[i][idxPrioLevel] || "Normal") : "Normal";
              const prioScoreVal = idxPrioScore !== -1 ? Number(existingData[i][idxPrioScore] || 0) : 0;
              const prioReasonVal = idxPrioReason !== -1 ? String(existingData[i][idxPrioReason] || "-") : "-";
              
              const item = {
                dealer_id: dId,
                status: statusVal,
                area_cover: areaCoverVal,
                last_visit_date: lastVVal,
                aging_visit_mitra: agingVal,
                urgent_units_count: urgentUnitsVal,
                priority_level: prioLevelVal,
                priority_score: prioScoreVal,
                priority_reason: prioReasonVal
              };
              if (name) existingMap[name] = item;
              if (dId) existingMap[dId] = item;
            }
          }

          // Susun header standar M_DEALER (14 kolom terstandar dengan area_cover)
          const targetHeaders = [
            "dealer_id", "dealer_name", "owner_name", "cabang", "area_cover", "productivity",
            "status", "tanggal_kerjasama", "last_visit_date", "aging_visit_mitra",
            "urgent_units_count", "priority_level", "priority_score", "priority_reason"
          ];

          const newDealerRows = [];
          
          // Mapping Kolom Sumber (0-indexed):
          // Kolom A = index 0 (No -> format unik MTR-0001)
          // Kolom B = index 1 (dealer_name)
          // Kolom C = index 2 (owner_name)
          // Kolom D & E = DILEWATKAN (tidak ditarik)
          // Kolom F = index 5 (cabang -> diupdate harian dari sumber)
          // Kolom AB = index 27 (tanggal_kerjasama)
          // Kolom AQ = index 42 (productivity)
          const idxSourceNo = 0;             // Kolom A
          const idxSourceDName = 1;          // Kolom B
          const idxSourceOwner = 2;          // Kolom C
          const idxSourceCabang = 5;         // Kolom F
          const idxSourceTglKerjasama = 27;  // Kolom AB
          const idxSourceProductivity = 42;  // Kolom AQ

          // Penarikan data dimulai dari baris ke-7 spreadsheet sumber (indeks r = 6)
          for (let r = 6; r < rawDealerData.length; r++) {
            const row = rawDealerData[r];
            const dName = String(row[idxSourceDName] || "").trim();
            if (!dName) continue;

            // Filter: Khusus data yang productivity-nya ADA ISINYA atau tanggal_kerjasamanya ADA
            const rawProdStr = (row[idxSourceProductivity] !== undefined && row[idxSourceProductivity] !== null) ? String(row[idxSourceProductivity]).trim() : "";
            const rawTglStr = (row[idxSourceTglKerjasama] !== undefined && row[idxSourceTglKerjasama] !== null) ? String(row[idxSourceTglKerjasama]).trim() : "";

            const hasProductivity = rawProdStr !== "" && rawProdStr !== "-";
            const hasTglKerjasama = rawTglStr !== "" && rawTglStr !== "-";

            if (!hasProductivity && !hasTglKerjasama) {
              continue; // Lewati dealer yang tidak memiliki productivity dan tidak memiliki tanggal kerjasama
            }

            const dNameKey = dName.toLowerCase();
            const existing = existingMap[dNameKey] || {};

            // 1. dealer_id: Kolom A dikonversi ke format unik MTR-0001
            let rawNo = row[idxSourceNo];
            let noNum = parseInt(rawNo, 10);
            if (isNaN(noNum) || noNum <= 0) {
              noNum = newDealerRows.length + 1;
            }
            const dealerId = "MTR-" + String(noNum).padStart(4, '0');

            // 2. dealer_name: Kolom B sumber
            const dealerName = dName;

            // 3. owner_name: Kolom C sumber
            const ownerName = String(row[idxSourceOwner] || "").trim() || "-";

            // 4. cabang: Kolom F sumber (update tiap hari)
            const cabang = String(row[idxSourceCabang] || "").trim() || "-";

            // 5. area_cover: Dikelola manual di database - pertahankan jika sudah diisi
            const areaCover = existing.area_cover || "";

            // 6. productivity: Kolom AQ sumber
            const productivity = (row[idxSourceProductivity] !== undefined && row[idxSourceProductivity] !== null && String(row[idxSourceProductivity]).trim() !== "")
              ? String(row[idxSourceProductivity]).trim()
              : "-";

            // 7. status: Murni manual admin (ACTIVE / INACTIVE) - TIDAK mengambil dari kolom sumber
            const status = (existing.status === "INACTIVE") ? "INACTIVE" : "ACTIVE";

            // 8. tanggal_kerjasama: Kolom AB sumber
            let tglKerjasama = "";
            let tglKerjasamaDate = null;
            if (row[idxSourceTglKerjasama]) {
              tglKerjasamaDate = parseDateValue(row[idxSourceTglKerjasama]);
              if (tglKerjasamaDate) {
                tglKerjasama = Utilities.formatDate(tglKerjasamaDate, "Asia/Jakarta", "yyyy-MM-dd");
              } else {
                tglKerjasama = String(row[idxSourceTglKerjasama]).trim();
              }
            }

            // 9. last_visit_date: Tanggal terakhir visit ke dealer / bertemu owner
            let lastVisitDateStr = "";
            let lastVisitDateObj = null;
            if (lastVisitByDealer[dNameKey]) {
              lastVisitDateObj = lastVisitByDealer[dNameKey];
              lastVisitDateStr = Utilities.formatDate(lastVisitDateObj, "Asia/Jakarta", "yyyy-MM-dd");
            } else if (existing.last_visit_date) {
              lastVisitDateObj = parseDateValue(existing.last_visit_date);
              if (lastVisitDateObj) {
                lastVisitDateStr = Utilities.formatDate(lastVisitDateObj, "Asia/Jakarta", "yyyy-MM-dd");
              } else {
                lastVisitDateStr = String(existing.last_visit_date).trim();
              }
            }

            // 10. aging_visit_mitra: Dihitung Today - Last Visit Date. Kalau belum pernah visit maka Today - Tanggal Kerja Sama
            let agingVisitMitra = 0;
            if (lastVisitDateObj) {
              agingVisitMitra = calculateDaysDiff(lastVisitDateObj, now);
            } else if (tglKerjasamaDate) {
              agingVisitMitra = calculateDaysDiff(tglKerjasamaDate, now);
            } else if (tglKerjasama) {
              const parsedTk = parseDateValue(tglKerjasama);
              if (parsedTk) {
                agingVisitMitra = calculateDaysDiff(parsedTk, now);
              }
            }

            newDealerRows.push([
              dealerId,
              dealerName,
              ownerName,
              cabang,
              areaCover,
              productivity,
              status,
              tglKerjasama || "-",
              lastVisitDateStr,
              agingVisitMitra,
              existing.urgent_units_count !== undefined ? existing.urgent_units_count : 0,
              existing.priority_level || "Normal",
              existing.priority_score !== undefined ? existing.priority_score : 0,
              existing.priority_reason || "-"
            ]);
          }

          // Tulis ulang ke M_DEALER (14 kolom terstandar dengan area_cover)
          dbDealerSheet.clearContents();
          dbDealerSheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
          if (newDealerRows.length > 0) {
            dbDealerSheet.getRange(2, 1, newDealerRows.length, targetHeaders.length).setValues(newDealerRows);
          }
          dbDealerSheet.setFrozenRows(1);
          Logger.log(`Berhasil sync ${newDealerRows.length} dealer dari Spreadsheet Sumber (14 Kolom M_DEALER Terstandar).`);
        }
      }
    }

    // 2. SINKRONISASI M_FACILITY_UNIT (Fasilitas, Kontrak Unit & Status Expired)
    let sourceFacilitySheet = null;
    const targetFacilityGid = Number(CONFIG.FACILITY_SHEET_GID || FACILITY_SHEET_GID || "1137250571");

    for (let s of sourceSheets) {
      if (s.getSheetId() === targetFacilityGid) {
        sourceFacilitySheet = s;
        break;
      }
    }

    if (sourceFacilitySheet) {
      const rawFacData = sourceFacilitySheet.getDataRange().getValues();
      if (rawFacData.length > 3) { // Data dimulai dari baris ke-4 (index r = 3)
        const dbFacSheet = ssDb.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT");
        const dbDealerSheet = ssDb.getSheetByName(CONFIG.SHEETS.DEALER || "M_DEALER");
        
        // Buat map cabang dealer dari M_DEALER
        const dealerCabangMap = {};
        if (dbDealerSheet) {
          const dData = dbDealerSheet.getDataRange().getValues();
          for (let d = 1; d < dData.length; d++) {
            const dName = String(dData[d][1] || "").trim().toLowerCase();
            const dCabang = String(dData[d][3] || "").trim();
            if (dName) dealerCabangMap[dName] = dCabang;
          }
        }

        if (dbFacSheet) {
          // Ambil snapshot existing agar data manual (nopol, unit, imei_gps, gps_status, last_visit_date, dll) tidak hilang/berubah
          const existingFacData = dbFacSheet.getDataRange().getValues();
          const existingFacMap = {};

          if (existingFacData.length > 1) {
            const exHeaders = existingFacData[0].map(h => String(h).trim().toLowerCase());
            const idxFas = exHeaders.indexOf("no_fasilitas");
            const idxNopol = exHeaders.indexOf("nopol");
            const idxUnit = exHeaders.indexOf("unit");
            const idxImei = exHeaders.indexOf("imei_gps");
            const idxGpsStatus = exHeaders.indexOf("gps_status");
            const idxLastVisit = exHeaders.indexOf("last_visit_date");
            const idxAgingVisit = exHeaders.indexOf("aging_visit_unit");
            const idxAgingGps = exHeaders.indexOf("aging_gps_maint");
            const idxPrioLevel = exHeaders.indexOf("priority_level");
            const idxPrioScore = exHeaders.indexOf("priority_score");
            const idxPrioReason = exHeaders.indexOf("priority_reason");
            const idxIsH3 = exHeaders.indexOf("is_h3_jto");

            for (let i = 1; i < existingFacData.length; i++) {
              const fasNo = idxFas !== -1 ? String(existingFacData[i][idxFas] || "").trim().toUpperCase() : "";
              const nopol = idxNopol !== -1 ? String(existingFacData[i][idxNopol] || "").trim().toUpperCase() : "";
              const unit = idxUnit !== -1 ? String(existingFacData[i][idxUnit] || "").trim() : "";
              
              const item = {
                nopol: nopol,
                unit: unit,
                imei_gps: idxImei !== -1 ? String(existingFacData[i][idxImei] || "") : "",
                gps_status: idxGpsStatus !== -1 ? String(existingFacData[i][idxGpsStatus] || "Normal") : "Normal",
                last_visit_date: idxLastVisit !== -1 ? existingFacData[i][idxLastVisit] : "",
                aging_visit_unit: idxAgingVisit !== -1 ? Number(existingFacData[i][idxAgingVisit] || 0) : 0,
                aging_gps_maint: idxAgingGps !== -1 ? Number(existingFacData[i][idxAgingGps] || 0) : 0,
                priority_level: idxPrioLevel !== -1 ? String(existingFacData[i][idxPrioLevel] || "Normal") : "Normal",
                priority_score: idxPrioScore !== -1 ? Number(existingFacData[i][idxPrioScore] || 0) : 0,
                priority_reason: idxPrioReason !== -1 ? String(existingFacData[i][idxPrioReason] || "-") : "-",
                is_h3_jto: idxIsH3 !== -1 ? String(existingFacData[i][idxIsH3] || "FALSE") : "FALSE"
              };

              if (fasNo) existingFacMap[fasNo] = item;
              if (nopol) existingFacMap[nopol] = item;
            }
          }

          // Susun header standar M_FACILITY_UNIT (17 kolom terstandar tanpa cabang)
          const targetFacHeaders = [
            "no_fasilitas", "dealer_name", "nopol", "unit", "contract_status",
            "jto_date", "overdue_days", "lifetime_days", "imei_gps", "gps_status",
            "last_visit_date", "aging_visit_unit", "aging_gps_maint",
            "priority_level", "priority_score", "priority_reason", "is_h3_jto"
          ];

          const newFacRows = [];

          // Mapping Kolom Sumber Fasilitas (0-indexed):
          let idxFas = 1;              // default Kolom B (index 1 / no_fasilitas)
          let idxDName = 5;            // default Kolom F (index 5 / dealer_name)
          let idxAsset = 6;            // default Kolom G (index 6 / asset_desc)
          let idxTahun = 7;            // default Kolom H (index 7 / tahun_unit)
          let idxNopol = 8;            // default Kolom I (index 8 / nopol)
          let idxStatusPengajuan = 18; // default Kolom S (index 18 / STATUS PENGAJUAN)
          let idxJto = 23;             // default Kolom X (index 23 / jto_date)
          let idxLifetime = 24;        // default Kolom Y (index 24 / lifetime_days)
          let idxOverdue = 25;         // default Kolom Z (index 25 / overdue_days)
          let idxContract = 26;        // default Kolom AA (index 26 / STATUS FASILITAS)

          // Pindai baris 1 s/d 3 di Spreadsheet Sumber untuk memastikan letak kolom persis
          for (let hr = 0; hr < Math.min(4, rawFacData.length); hr++) {
            const hRow = rawFacData[hr];
            for (let c = 0; c < hRow.length; c++) {
              const hText = String(hRow[c] || "").trim().toUpperCase();
              if (hText === "NO FASILITAS" || hText === "NO. FASILITAS") idxFas = c;
              else if (hText === "NAMA DEALER" || hText === "DEALER") idxDName = c;
              else if (hText === "DESKRIPSI ASSET" || hText === "ASSET DESC") idxAsset = c;
              else if (hText === "TAHUN") idxTahun = c;
              else if (hText === "NO POLISI" || hText === "NOPOL" || hText === "NO. POLISI") idxNopol = c;
              else if (hText === "STATUS PENGAJUAN" || hText.indexOf("STATUS PENGAJUAN") !== -1) idxStatusPengajuan = c;
              else if (hText === "JATUH TEMPO" || hText === "TGL JATUH TEMPO") idxJto = c;
              else if (hText === "LIFETIME") idxLifetime = c;
              else if (hText === "OVERDUE") idxOverdue = c;
              else if (hText === "STATUS FASILITAS" || hText.indexOf("STATUS FASILITAS") !== -1) {
                idxContract = c;
              }
            }
          }

          Logger.log(`[SYNC SOURCE] Posisi Kolom Sumber: NoFas=${idxFas}, Nopol=${idxNopol}, StatusPengajuan=${idxStatusPengajuan}, StatusFasilitas=${idxContract}`);

          // Data fasilitas dari spreadsheet sumber SELALU dimulai dari baris ke-4 (indeks r = 3)
          for (let r = 3; r < rawFacData.length; r++) {
            const row = rawFacData[r];
            const noFas = String(row[idxFas] || "").trim().toUpperCase();
            
            // Validasi: Lewati jika kosong atau jika baris berisi teks header
            if (!noFas || noFas === "NO FASILITAS" || noFas === "NO. FASILITAS" || noFas === "NO" || noFas === "FASILITAS" || (noFas.indexOf("FASILITAS") !== -1 && noFas.length < 12)) {
              continue;
            }

            const rawDName = String(row[idxDName] || "").trim();
            if (rawDName.toUpperCase() === "NAMA DEALER" || rawDName.toUpperCase() === "DEALER") {
              continue; // Lewati jika baris header
            }

            // FILTER: HANYA proses data dengan STATUS PENGAJUAN "Pencairan" atau "Pengajuan" (Kolom S)
            const rawStatusPengajuan = String(row[idxStatusPengajuan] || "").trim().toLowerCase();
            const isEligiblePengajuan = rawStatusPengajuan.includes("cair") || rawStatusPengajuan.includes("pencairan") || rawStatusPengajuan.includes("pengajuan") || rawStatusPengajuan.includes("aju");
            if (!isEligiblePengajuan) {
              continue; // Lewati jika status pengajuan bukan Pencairan / Pengajuan (misal Draft, Batal, Tolak, dll)
            }

            const existing = existingFacMap[noFas] || (row[idxNopol] ? existingFacMap[String(row[idxNopol]).trim().toUpperCase()] : {}) || {};
            const dealerName = rawDName;

            // Nopol & Unit: Utamakan data yang sudah ada di database, jika data baru ambil dari sumber
            const rawNopol = String(row[idxNopol] || "").trim().toUpperCase();
            const finalNopol = existing.nopol || rawNopol;

            const assetDesc = String(row[idxAsset] || "").trim();
            const tahunUnit = String(row[idxTahun] || "").trim();
            const sourceUnitDesc = tahunUnit ? `${assetDesc} (${tahunUnit})` : assetDesc;
            const finalUnitDesc = existing.unit || sourceUnitDesc;

            // contract_status dari sumber Kolom AA (STATUS FASILITAS - LIVE / EXPIRED / dll)
            const rawContract = String(row[idxContract] || "").trim().toUpperCase();
            const contractStatus = rawContract || "LIVE";

            // jto_date
            let jtoDateStr = "";
            if (row[idxJto]) {
              const parsedJto = parseDateValue(row[idxJto]);
              if (parsedJto) {
                jtoDateStr = Utilities.formatDate(parsedJto, "Asia/Jakarta", "yyyy-MM-dd");
              } else {
                jtoDateStr = String(row[idxJto]).trim();
              }
            }

            const lifetimeDays = (row[idxLifetime] !== undefined && row[idxLifetime] !== null && row[idxLifetime] !== "") ? Number(row[idxLifetime]) : 0;
            const overdueDays = (row[idxOverdue] !== undefined && row[idxOverdue] !== null && row[idxOverdue] !== "") ? Number(row[idxOverdue]) : 0;

            // Format last_visit_date jika ada
            let lastVStr = "";
            let agingVisitVal = existing.aging_visit_unit || 0;
            if (existing.last_visit_date) {
              const parsedLv = parseDateValue(existing.last_visit_date);
              if (parsedLv) {
                lastVStr = Utilities.formatDate(parsedLv, "Asia/Jakarta", "yyyy-MM-dd");
                agingVisitVal = calculateDaysDiff(parsedLv, now);
              } else {
                lastVStr = String(existing.last_visit_date).trim();
              }
            }

            newFacRows.push([
              noFas,
              dealerName,
              finalNopol,
              finalUnitDesc,
              contractStatus,
              jtoDateStr,
              overdueDays,
              lifetimeDays,
              existing.imei_gps || "",
              existing.gps_status || "Normal",
              lastVStr,
              agingVisitVal,
              existing.aging_gps_maint || 0,
              existing.priority_level || "Normal",
              existing.priority_score !== undefined ? existing.priority_score : 0,
              existing.priority_reason || "-",
              existing.is_h3_jto || "FALSE"
            ]);
          }

          // Tulis ulang ke M_FACILITY_UNIT (17 kolom terstandar tanpa cabang)
          dbFacSheet.clearContents();
          dbFacSheet.getRange(1, 1, 1, targetFacHeaders.length).setValues([targetFacHeaders]);
          if (newFacRows.length > 0) {
            dbFacSheet.getRange(2, 1, newFacRows.length, targetFacHeaders.length).setValues(newFacRows);
          }
          dbFacSheet.setFrozenRows(1);
          Logger.log(`Berhasil sync ${newFacRows.length} unit fasilitas dari Spreadsheet Sumber (17 Kolom M_FACILITY_UNIT Terstandar).`);
        }
      }
    }

    return { success: true, message: "Sinkronisasi master data Dealer & Fasilitas dari sumber berhasil!" };
  } catch (err) {
    Logger.log("Error syncDealerAndFacilityFromSource: " + err.toString());
    return { success: false, message: err.toString() };
  }
}
