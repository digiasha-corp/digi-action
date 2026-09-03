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

  // 1. Ambil Sheet Terkait
  const sheetDealer = ss.getSheetByName(CONFIG.SHEETS.DEALER);
  const sheetUnit = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT);
  const sheetAssign = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT);
  const sheetVisit = ss.getSheetByName(CONFIG.SHEETS.VISIT_HEADER);
  const sheetGpsMaint = ss.getSheetByName(CONFIG.SHEETS.GPS_MAINTENANCE);

  if (!sheetDealer || !sheetUnit) {
    Logger.log("ERROR: Sheet M_DEALER atau M_FACILITY_UNIT tidak ditemukan.");
    return;
  }

  // 2. Baca Data Tabel ke Objek
  const dealers = getTableObjects(sheetDealer);
  const units = getTableObjects(sheetUnit);
  const assignments = sheetAssign ? getTableObjects(sheetAssign).filter(a => String(a.status || "").toUpperCase() !== "RESOLVED") : [];
  const visits = sheetVisit ? getTableObjects(sheetVisit) : [];
  const gpsMaints = sheetGpsMaint ? getTableObjects(sheetGpsMaint) : [];

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

  // 4. Hitung Aging Visit & Maintenance Terakhir
  const lastVisitByDealer = {};
  visits.forEach(v => {
    const key = String(v.dealer_name || "").trim().toLowerCase();
    const tgl = parseDateValue(v.created_at || v.timestamp || v.tanggal_visit);
    if (tgl && (!lastVisitByDealer[key] || tgl > lastVisitByDealer[key])) {
      lastVisitByDealer[key] = tgl;
    }
  });

  const lastGpsMaintByUnit = {};
  gpsMaints.forEach(g => {
    const key = String(g.nopol || "").trim().toLowerCase();
    const tgl = parseDateValue(g.created_at || g.timestamp);
    if (tgl && (!lastGpsMaintByUnit[key] || tgl > lastGpsMaintByUnit[key])) {
      lastGpsMaintByUnit[key] = tgl;
    }
  });

  // 5. KALKULASI SKORING SETIAP UNIT (PRIORITY BY UNIT)
  const evaluatedUnits = units.map(u => {
    const nopolKey = String(u.nopol || "").trim().toLowerCase();
    const dealerKey = String(u.dealer_name || "").trim().toLowerCase();

    // Aging Visit Unit
    let agingVisit = Number(u.aging_visit_days || u.aging_visit_unit || 0);
    if (lastVisitByDealer[dealerKey]) {
      agingVisit = calculateDaysDiff(lastVisitByDealer[dealerKey], now);
    }

    // Lifetime Kontrak (Hari)
    let lifetime = Number(u.lifetime_days || 0);
    if (u.contract_start_date) {
      const startTgl = parseDateValue(u.contract_start_date);
      if (startTgl) lifetime = calculateDaysDiff(startTgl, now);
    }

    // Overdue Days
    const overdue = Number(u.overdue_days || 0);

    // Aging GPS Maintenance
    let agingGpsMaint = Number(u.aging_gps_maint || 0);
    if (lastGpsMaintByUnit[nopolKey]) {
      agingGpsMaint = calculateDaysDiff(lastGpsMaintByUnit[nopolKey], now);
    }

    // Pengecekan H-3 JTO
    const isH3Jto = checkIsH3JTO(u.jto_date || u.tgl_jatuh_tempo, now);

    // Status GPS
    const gpsStatus = String(u.gps_status || (u.imei_gps ? "Normal" : "Belum Pasang")).trim();

    // Concern
    const concern = unitConcerns[nopolKey] || null;

    // Hitung Urgensi Unit
    const urgency = calculateUnitUrgencyGAS({
      gps_status: gpsStatus,
      aging_visit_unit: agingVisit,
      lifetime_days: lifetime,
      overdue_days: overdue,
      aging_gps_maint: agingGpsMaint,
      is_h3_jto: isH3Jto,
      unit_concern: concern
    });

    return {
      ...u,
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

    // Aging Visit Mitra
    let agingMitra = Number(d.aging_visit_mitra || d.aging_visit_days || 0);
    if (lastVisitByDealer[dealerKey]) {
      agingMitra = calculateDaysDiff(lastVisitByDealer[dealerKey], now);
    }

    // Ambil unit yang berada di bawah dealer ini
    const dealerUnits = evaluatedUnits.filter(u => String(u.dealer_name || "").trim().toLowerCase() === dealerKey);
    const concern = dealerConcerns[dealerKey] || null;

    // Hitung Urgensi Dealer
    const urgency = calculateMitraUrgencyGAS({
      aging_visit_mitra: agingMitra,
      dealer_concern: concern,
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
    "aging_visit_unit", "lifetime_days", "aging_gps_maint", "is_h3_jto", "priority_level", "priority_score", "priority_reason"
  ]);

  updateSheetWithCalculations(sheetDealer, evaluatedDealers, [
    "aging_visit_mitra", "urgent_units_count", "priority_level", "priority_score", "priority_reason", "mitra_internal_level"
  ]);

  // 8. Catat Snapshot Historis Harian ke LOG_PRIORITY_DAILY (Time-series untuk Looker Studio)
  appendDailyPriorityHistory(ss, now, evaluatedDealers, evaluatedUnits);

  Logger.log("=== DAILY PRIORITY SYNC JOB SELESAI DENGAN SUKSES ===");
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
  const nearJto = (u.is_h3_jto === true || u.is_h3_jto === "TRUE");

  let concernUrgency = "";
  let concernNote = "";
  if (u.unit_concern) {
    concernUrgency = u.unit_concern.urgency || "";
    concernNote = u.unit_concern.note || "";
  }

  // 1. LEVEL "SANGAT PENTING" (Score: 3)
  if (concernUrgency === "Sangat Penting") {
    return { level: "Sangat Penting", score: 3, reason: "Assign Concern '" + (concernNote || "Sangat Penting") + "'" };
  }
  if (["Pelepasan", "Offline", "Baterai Lemah"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
    return { level: "Sangat Penting", score: 3, reason: "Status GPS: " + gpsStatus };
  }
  if (agingVisit > 21 && lifetime > 90) {
    return { level: "Sangat Penting", score: 3, reason: "Aging Visit > 21 hr (" + agingVisit + " hr) & Lifetime > 90 hr (" + lifetime + " hr)" };
  }
  if (agingVisit > 14 && nearJto) {
    return { level: "Sangat Penting", score: 3, reason: "Aging Visit > 14 hr (" + agingVisit + " hr) & Kondisi H-3 JTO" };
  }

  // 2. LEVEL "PENTING" (Score: 2)
  if (concernUrgency === "Penting") {
    return { level: "Penting", score: 2, reason: "Assign Concern '" + (concernNote || "Penting") + "'" };
  }
  if (["Belum Lepas", "Belum Pasang", "Geser"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
    return { level: "Penting", score: 2, reason: "Status GPS: " + gpsStatus };
  }
  if (agingVisit > 3 && overdue > 3) {
    return { level: "Penting", score: 2, reason: "Aging Visit > 3 hr (" + agingVisit + " hr) & Overdue > 3 hr (" + overdue + " hr)" };
  }
  if (agingVisit > 5 && nearJto) {
    return { level: "Penting", score: 2, reason: "Aging Visit > 5 hr (" + agingVisit + " hr) & Kondisi H-3 JTO" };
  }
  if (agingVisit > 21 && lifetime <= 90) {
    return { level: "Penting", score: 2, reason: "Aging Visit > 21 hr (" + agingVisit + " hr) & Lifetime <= 90 hr (" + lifetime + " hr)" };
  }

  // 3. LEVEL "MODERAT" (Score: 1)
  if (agingVisit > 14) {
    return { level: "Moderat", score: 1, reason: "Aging Visit Unit > 14 hr (" + agingVisit + " hr)" };
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

  let concernUrgency = "";
  let concernNote = "";
  if (dealerData.dealer_concern) {
    concernUrgency = dealerData.dealer_concern.urgency || "";
    concernNote = dealerData.dealer_concern.note || "";
  }

  // A. Evaluasi Internal Dealer
  let mitraScore = 0;
  let mitraLevel = "Normal";
  let mitraReason = "Kondisi Normal";

  if (concernUrgency === "Sangat Penting") {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = "Concern Mitra: '" + (concernNote || "Sangat Penting") + "'";
  } else if (agingMitra > 60) {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = "Aging Visit Mitra > 60 hr (" + agingMitra + " hr)";
  } else if (concernUrgency === "Penting") {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = "Concern Mitra: '" + (concernNote || "Penting") + "'";
  } else if (agingMitra > 30) {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = "Aging Visit Mitra > 30 hr (" + agingMitra + " hr)";
  } else if (concernUrgency === "Moderat") {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = "Concern Mitra: '" + (concernNote || "Moderat") + "'";
  } else if (agingMitra > 20) {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = "Aging Visit Mitra > 20 hr (" + agingMitra + " hr)";
  }

  // B. Agregasi Unit di Showroom
  let highestUnitScore = 0;
  let urgentUnitsCount = 0;
  let topUnitReason = "";

  if (dealerData.units && dealerData.units.length > 0) {
    dealerData.units.forEach(u => {
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
      obj[headers[c]] = data[r][c];
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

  // 1. Record History Mitra Dealer
  dealers.forEach((d, idx) => {
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

  // 2. Record History Unit Fasilitas
  units.forEach((u, idx) => {
    const logId = "LOG-UNT-" + dateStr.replace(/-/g, '') + "-" + String(idx + 1).padStart(3, '0');
    const concernText = u.unit_concern ? (typeof u.unit_concern === 'object' ? u.unit_concern.note : u.unit_concern) : "-";
    rowsToAppend.push([
      logId,
      dateStr,
      timeStr,
      "UNIT",
      u.nopol || "-",
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
