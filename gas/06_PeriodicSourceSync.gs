/**
 * 06_PeriodicSourceSync.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Script Sinkronisasi Berkala dari Spreadsheet Sumber Asli (HR & Operasional) ke Supabase Database
 */

const PERIODIC_SYNC_CONFIG = {
  SUPABASE_URL: "https://pqfzkizqqhmsnidocumv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo",
  
  // 1. Spreadsheet HR Karyawan
  HR_SOURCE_ID: "1h2NiNffCNUrtoauLkdJXBKXTyOOnxBh6vPvLowOo5M8",
  HR_SHEET_GID: "1541309632",

  // 2. Spreadsheet Dealer & Fasilitas Operasional
  DEALER_SOURCE_ID: "1ST9KvTCE9iyhz0GD4gRQIBt6gS_3pnGOUZbHYkAO75M",
  DEALER_SHEET_GID: "126845644",
  FACILITY_SHEET_GID: "1137250571"
};

function parseDateValue(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
  const s = String(val).trim();
  if (!s || s === "-" || s.toLowerCase() === "null") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  return (!isNaN(d.getTime()) && d.getFullYear() > 1990) ? Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd") : null;
}

function fetchSupabaseExisting(tableName, selectColumns) {
  const url = `${PERIODIC_SYNC_CONFIG.SUPABASE_URL}/rest/v1/${tableName}?select=${selectColumns}`;
  const options = {
    method: "GET",
    headers: {
      "apikey": PERIODIC_SYNC_CONFIG.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${PERIODIC_SYNC_CONFIG.SUPABASE_ANON_KEY}`
    },
    muteHttpExceptions: true
  };
  try {
    const res = UrlFetchApp.fetch(url, options);
    if (res.getResponseCode() === 200) {
      return JSON.parse(res.getContentText());
    }
  } catch (e) {
    Logger.log(`Error fetch existing ${tableName}: ` + e.toString());
  }
  return [];
}

function upsertToSupabase(tableName, payloadArray, onConflict) {
  if (!payloadArray || payloadArray.length === 0) return;
  const endpoint = `${PERIODIC_SYNC_CONFIG.SUPABASE_URL}/rest/v1/${tableName}${onConflict ? '?on_conflict=' + onConflict : ''}`;
  const options = {
    method: "POST",
    headers: {
      "apikey": PERIODIC_SYNC_CONFIG.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${PERIODIC_SYNC_CONFIG.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    payload: JSON.stringify(payloadArray),
    muteHttpExceptions: true
  };
  try {
    const res = UrlFetchApp.fetch(endpoint, options);
    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log(`[OK] Upsert ${payloadArray.length} baris ke ${tableName} berhasil.`);
    } else {
      Logger.log(`[ERROR] Upsert ke ${tableName} (${code}): ${res.getContentText()}`);
    }
  } catch (e) {
    Logger.log(`Exception upsert ${tableName}: ` + e.toString());
  }
}

/**
 * DIAGNOSA HEADER & KOLOM HR SPREADSHEET
 * Jalankan fungsi ini di Apps Script untuk melihat nama & index semua kolom di Spreadsheet HR
 */
function debugCheckHrColumns() {
  Logger.log("=== CEK HEADER & SAMPLE DATA SPREADSHEET HR ===");
  const ss = SpreadsheetApp.openById(PERIODIC_SYNC_CONFIG.HR_SOURCE_ID);
  const sheets = ss.getSheets();
  let sheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.HR_SHEET_GID) || sheets[0];
  if (!sheet) {
    Logger.log("Sheet HR tidak ditemukan!");
    return;
  }
  
  const values = sheet.getRange(1, 1, Math.min(sheet.getLastRow(), 5), sheet.getLastColumn()).getValues();
  if (values.length < 1) {
    Logger.log("Sheet kosong!");
    return;
  }

  const headers = values[0];
  const sampleRow = values.length > 1 ? values[1] : [];
  
  Logger.log("DAFTAR KOLOM HR:");
  for (let c = 0; c < headers.length; c++) {
    const colLetter = String.fromCharCode(65 + (c % 26)); // A, B, C...
    const colPrefix = c >= 26 ? String.fromCharCode(65 + Math.floor(c / 26) - 1) : "";
    const colName = colPrefix + colLetter;
    const headerTitle = headers[c];
    const sampleVal = sampleRow[c];
    Logger.log(`Kolom ${colName} (Index ${c}) => Header: "${headerTitle}" | Contoh Data: "${sampleVal}"`);
  }
}

/**
 * 1. SINKRONISASI DATA HR (KARYAWAN)
 * Mapping Kolom Sumber HR:
 * - NO ID (NIP): Kolom F (Index 5) -> Wajib ada
 * - Nama Lengkap: Kolom G (Index 6)
 * - Jabatan: Kolom P (Index 15)
 * - Cabang: Kolom Q (Index 16)
 * - Email: Kolom N (Index 13)
 */
function syncHrEmployeesFromSource() {
  Logger.log("=== SINKRONISASI DATA HR DARI SUMBER ===");
  const ss = SpreadsheetApp.openById(PERIODIC_SYNC_CONFIG.HR_SOURCE_ID);
  const sheets = ss.getSheets();
  let sheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.HR_SHEET_GID) || sheets[0];
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  // Snapshot Supabase agar password, area_cover, role, status_aktif tidak tertimpa
  const existing = fetchSupabaseExisting("m_employee", "nip,password_hash,area_cover,role_id,status_aktif,status_ganti_pass");
  const existingMap = {};
  existing.forEach(e => { existingMap[String(e.nip).trim()] = e; });

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    // Kolom F = NO ID (Index 5)
    const nip = String(r[5] || "").trim();
    
    // Validasi: Jika NO ID di kolom F kosong / strip / kurang dari 3 karakter, karyawan belum aktif -> skip
    if (!nip || nip === "-" || nip.toLowerCase() === "null" || nip.length < 3) {
      continue;
    }

    // Kolom G = NAMA KARYAWAN (Index 6)
    const nama = String(r[6] || "").trim() || nip;

    const emailRaw = String(r[13] || "").trim();   // Kolom N (Index 13)
    const email = (emailRaw && emailRaw.includes("@")) ? emailRaw : `${nip}@digiasha.com`;
    const jabatan = String(r[15] || "").trim();    // Kolom P (Index 15)
    const cabang = String(r[16] || "Head Office").trim(); // Kolom Q (Index 16)

    const old = existingMap[nip];
    rows.push({
      nip: nip,
      nama_lengkap: nama,
      email: email,
      jabatan: jabatan,
      cabang: cabang,
      area_cover: old?.area_cover || "",
      password_hash: old?.password_hash || "Password123!",
      role_id: old?.role_id || "R-04",
      status_ganti_pass: old?.status_ganti_pass || false,
      status_aktif: old?.status_aktif || "AKTIF",
      updated_at: new Date().toISOString()
    });
  }

  for (let i = 0; i < rows.length; i += 100) {
    upsertToSupabase("m_employee", rows.slice(i, i + 100), "nip");
  }
  Logger.log(`[OK] Sinkronisasi HR selesai: ${rows.length} karyawan aktif diproses.`);
}

// =========================================================================
// CLOSED-LOOP PRIORITY SCORING ENGINE (PARAMETER PRIORITAS LENGKAP)
// =========================================================================

function calculateDaysDiff(d1, d2) {
  if (!d1 || !d2) return 0;
  const t1 = new Date(d1).setHours(0, 0, 0, 0);
  const t2 = new Date(d2).setHours(0, 0, 0, 0);
  const diff = Math.floor((t2 - t1) / (1000 * 60 * 60 * 24));
  return isNaN(diff) ? 0 : Math.max(0, diff);
}

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

/**
 * Kalkulasi Urgensi Unit Fasilitas
 */
function calculateUnitUrgency(u, now, concern) {
  const agingVisit = Number(u.aging_visit_unit || 0);
  const lifetime = Number(u.lifetime_days || 0);
  const overdue = Number(u.overdue_days || 0);
  const gpsStatus = String(u.gps_status || "Normal").trim();

  let nearJto = false;
  if (u.jto_date) {
    const diff = calculateDaysDiff(now, u.jto_date);
    if (diff >= 0 && diff <= 3) nearJto = true;
  }

  let concernUrgency = "";
  let concernNote = "";
  if (concern) {
    concernUrgency = concern.urgency || "";
    concernNote = concern.note || "";
  }

  const contractStatus = String(u.contract_status || "").trim().toUpperCase();
  const rawImei = String(u.imei_gps || "").trim();
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
  if (["Pelepasan", "Offline", "Baterai Lemah"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
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
  if (["Belum Lepas", "Belum Pasang", "Geser"].some(s => gpsStatus.toLowerCase().indexOf(s.toLowerCase()) !== -1)) {
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

  // 4. LEVEL "NORMAL" (Score: 0)
  return { level: "Normal", score: 0, reason: "Kondisi Normal / Terjadwal Baik" };
}

/**
 * Kalkulasi Urgensi Mitra Dealer (Termasuk Agregasi Unit Showroom)
 */
function calculateMitraUrgency(dealerData, unitsUnderDealer) {
  const agingMitra = Number(dealerData.aging_visit_mitra || 0);
  const rawProd = String(dealerData.productivity || "").trim().toLowerCase();
  const isClosedOrDormant = rawProd.includes("closed") || rawProd.includes("dormant") || rawProd.includes("7.closed") || rawProd.includes("5.dormant");
  const isAgingAllowed = !isClosedOrDormant;

  let concernUrgency = "";
  let concernNote = "";
  if (dealerData.dealer_concern) {
    concernUrgency = dealerData.dealer_concern.urgency || "";
    concernNote = dealerData.dealer_concern.note || "";
  }

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

  // Agregasi Pemicu Unit Showroom
  let highestUnitScore = 0;
  let urgentUnitsCount = 0;
  let topUnitReason = "";

  if (unitsUnderDealer && unitsUnderDealer.length > 0) {
    unitsUnderDealer.forEach(u => {
      const uContract = String(u.contract_status || "").trim().toUpperCase();
      const uImei = String(u.imei_gps || "").trim();
      const uHasImei = hasValidImei(uImei);
      const isULive = uContract === "LIVE" || uContract.indexOf("LIVE") !== -1;
      const isUExpiredWithImei = uContract.indexOf("EXPIRED") !== -1 && uHasImei;
      if (!isULive && !isUExpiredWithImei && !u.unit_concern) return;

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

/**
 * 2. SINKRONISASI DATA DEALER & FASILITAS DARI SUMBER OPERASIONAL + KALKULASI PRIORITAS OTOMATIS
 */
function syncDealersAndFacilitiesFromSource() {
  Logger.log("=== SINKRONISASI DEALER & FASILITAS DARI SUMBER ===");
  const ss = SpreadsheetApp.openById(PERIODIC_SYNC_CONFIG.DEALER_SOURCE_ID);
  const sheets = ss.getSheets();
  const now = new Date();
  
  // 1. Ambil Concerns & Kunjungan Terakhir dari Supabase
  const activeConcerns = fetchSupabaseExisting("t_assignment", "id,target_type,target_id,target_name,urgency,catatan,status");
  const dealerConcerns = {};
  const unitConcerns = {};
  activeConcerns.forEach(c => {
    if (String(c.status).toUpperCase() === "PENDING" || String(c.status).toUpperCase() === "OPEN") {
      const key = String(c.target_name || c.target_id).trim().toLowerCase();
      if (c.target_type === "Mitra" || c.target_type === "Dealer") {
        dealerConcerns[key] = { urgency: c.urgency, note: c.catatan };
      } else {
        unitConcerns[key] = { urgency: c.urgency, note: c.catatan };
      }
    }
  });

  // Sheet Facility Unit (Data dimulai dari Baris ke-4)
  let evaluatedUnits = [];
  let facSheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.FACILITY_SHEET_GID) || ss.getSheetByName("M_FACILITY_UNIT");
  if (facSheet) {
    const fData = facSheet.getDataRange().getValues();
    if (fData.length > 3) {
      const existingUnits = fetchSupabaseExisting("m_facility_unit", "no_fasilitas,imei_gps,gps_status,last_visit_date,aging_visit_unit");
      const uMap = {};
      existingUnits.forEach(u => { uMap[String(u.no_fasilitas).trim()] = u; });

      for (let i = 3; i < fData.length; i++) {
        const row = fData[i];
        const noFas = String(row[1] || "").trim().toUpperCase(); // Kolom B (Index 1)
        if (!noFas || noFas.includes("FASILITAS") || noFas.length < 5) continue;

        const rawStatusAju = String(row[18] || "").trim().toLowerCase(); // Kolom S
        if (!rawStatusAju.includes("cair") && !rawStatusAju.includes("aju")) continue;

        const old = uMap[noFas];
        const dealerName = String(row[5] || "").trim(); // Kolom F (Index 5)
        const assetDesc = String(row[6] || "").trim();  // Kolom G (Index 6)
        const tahun = String(row[7] || "").trim();      // Kolom H (Index 7)
        const unitDesc = tahun ? `${assetDesc} (${tahun})` : assetDesc;
        const nopol = String(row[8] || "-").trim().toUpperCase(); // Kolom I (Index 8)
        const jtoDate = parseDateValue(row[23]);        // Kolom X (Index 23)
        const lifetime = parseInt(row[24]) || 0;        // Kolom Y (Index 24)
        const overdue = parseInt(row[25]) || 0;         // Kolom Z (Index 25)
        const contractStatus = String(row[26] || "LIVE").trim().toUpperCase(); // Kolom AA (Index 26)

        // Hitung Aging Visit Unit
        let lastV = old?.last_visit_date ? parseDateValue(old.last_visit_date) : null;
        let agingVisitUnit = lastV ? calculateDaysDiff(lastV, now) : lifetime;

        const concern = unitConcerns[noFas.toLowerCase()] || (nopol !== "-" ? unitConcerns[nopol.toLowerCase()] : null);
        const uTemp = {
          no_fasilitas: noFas,
          dealer_name: dealerName,
          nopol: nopol,
          unit: unitDesc,
          contract_status: contractStatus,
          jto_date: jtoDate,
          overdue_days: overdue,
          lifetime_days: lifetime,
          imei_gps: old?.imei_gps || "",
          gps_status: old?.gps_status || "Normal",
          last_visit_date: old?.last_visit_date || null,
          aging_visit_unit: agingVisitUnit
        };

        const uUrgency = calculateUnitUrgency(uTemp, now, concern);
        evaluatedUnits.push({
          ...uTemp,
          priority_level: uUrgency.level,
          priority_score: uUrgency.score,
          priority_reason: uUrgency.reason,
          updated_at: new Date().toISOString()
        });
      }

      for (let i = 0; i < evaluatedUnits.length; i += 100) {
        upsertToSupabase("m_facility_unit", evaluatedUnits.slice(i, i + 100), "no_fasilitas");
      }
      Logger.log(`[OK] Sinkronisasi & Evaluasi Fasilitas selesai: ${evaluatedUnits.length} unit fasilitas diproses.`);
    }
  }

  // Sheet Dealer
  let dealerSheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.DEALER_SHEET_GID) || ss.getSheetByName("M_DEALER") || sheets[0];
  if (dealerSheet) {
    const dData = dealerSheet.getDataRange().getValues();
    const existingDealers = fetchSupabaseExisting("m_dealer", "dealer_id,dealer_name,area_cover,last_visit_date,aging_visit_mitra");
    const dMap = {};
    existingDealers.forEach(d => { dMap[String(d.dealer_name).trim().toLowerCase()] = d; });

    const dRows = [];
    for (let i = 1; i < dData.length; i++) {
      const row = dData[i];
      const name = String(row[1] || "").trim(); // Kolom B (Index 1)
      if (!name || name.toUpperCase() === "NAMA DEALER") continue;

      const tglKerjasama = parseDateValue(row[27]); // Kolom AB (Index 27)
      if (!tglKerjasama) continue;

      const rawNo = row[0]; // Kolom A (Index 0)
      let formattedId = "";
      if (!isNaN(rawNo) && String(rawNo).trim() !== "") {
        formattedId = "MTR-" + String(rawNo).trim().padStart(4, '0');
      } else {
        formattedId = "MTR-" + String(i).padStart(4, '0');
      }

      const old = dMap[name.toLowerCase()];
      const dealerId = old?.dealer_id || formattedId;

      // Hitung Aging Visit Mitra:
      let agingMitra = 0;
      if (old?.last_visit_date) {
        agingMitra = calculateDaysDiff(parseDateValue(old.last_visit_date), now);
      } else {
        agingMitra = calculateDaysDiff(tglKerjasama, now);
      }

      // Unit-unit di bawah dealer ini
      const matchedUnits = evaluatedUnits.filter(u => String(u.dealer_name || "").trim().toLowerCase() === name.toLowerCase());
      const concern = dealerConcerns[name.toLowerCase()] || dealerConcerns[dealerId.toLowerCase()] || null;

      const dUrgency = calculateMitraUrgency({
        aging_visit_mitra: agingMitra,
        productivity: String(row[42] || "Normal").trim(),
        dealer_concern: concern
      }, matchedUnits);

      dRows.push({
        dealer_id: dealerId,
        dealer_name: name,
        owner_name: String(row[2] || "").trim(),     // Kolom C (Index 2)
        cabang: String(row[5] || "").trim(),         // Kolom F (Index 5)
        area_cover: old?.area_cover || "",           // Preserved dari In-App
        productivity: String(row[42] || "Normal").trim(), // Kolom AQ (Index 42)
        status: "AKTIF",
        tanggal_kerjasama: tglKerjasama,
        last_visit_date: old?.last_visit_date || null,
        aging_visit_mitra: agingMitra,
        urgent_units_count: dUrgency.urgentUnitsCount,
        priority_level: dUrgency.level,
        priority_score: dUrgency.score,
        priority_reason: dUrgency.reason,
        updated_at: new Date().toISOString()
      });
    }

    for (let i = 0; i < dRows.length; i += 100) {
      upsertToSupabase("m_dealer", dRows.slice(i, i + 100), "dealer_id");
    }
    Logger.log(`[OK] Sinkronisasi & Evaluasi Dealer selesai: ${dRows.length} mitra dealer diproses.`);
  }
}

/**
 * 🚀 FUNGSI UTAMA HARIAN
 * Pasang fungsi ini pada Trigger Google Apps Script (misal: Timer Harian Jam 06:00 Pagi atau Pemicu 5 Menit)
 */
function runPeriodicDailySync() {
  Logger.log("=== MEMULAI SINKRONISASI PERIODIK HARIAN ===");
  try {
    syncHrEmployeesFromSource();
    syncDealersAndFacilitiesFromSource();
    Logger.log("=== SINKRONISASI PERIODIK SELESAI DENGAN SUKSES ===");
  } catch (e) {
    Logger.log("Error sync periodik: " + e.toString());
  }
}
