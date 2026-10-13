/**
 * 06_PeriodicSourceSync.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Script Sinkronisasi Data dari Spreadsheet Sumber Asli Operasional ke Supabase
 * Arsitektur: Apps Script bertindak murni sebagai ETL Kurir Operasional (Dealer & Unit) -> Supabase PostgreSQL Engine
 */

const PERIODIC_SYNC_CONFIG = {
  SUPABASE_URL: "https://pqfzkizqqhmsnidocumv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo",
  
  // Spreadsheet Dealer & Fasilitas Operasional
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
 * SINKRONISASI DATA DEALER & FASILITAS DARI SUMBER OPERASIONAL
 */
function syncDealersAndFacilitiesFromSource() {
  Logger.log("=== SINKRONISASI DEALER & FASILITAS DARI SUMBER ===");
  const ss = SpreadsheetApp.openById(PERIODIC_SYNC_CONFIG.DEALER_SOURCE_ID);
  const sheets = ss.getSheets();

  // A. Sheet Facility Unit (Data dimulai dari Baris ke-4)
  let facSheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.FACILITY_SHEET_GID) || ss.getSheetByName("M_FACILITY_UNIT");
  if (facSheet) {
    const fData = facSheet.getDataRange().getValues();
    if (fData.length > 3) {
      const existingUnits = fetchSupabaseExisting("m_facility_unit", "no_fasilitas,imei_gps,gps_status,last_visit_date");
      const uMap = {};
      existingUnits.forEach(u => { uMap[String(u.no_fasilitas).trim()] = u; });

      const fRows = [];
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

        fRows.push({
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
          last_visit_date: old?.last_visit_date || null
        });
      }

      for (let i = 0; i < fRows.length; i += 100) {
        upsertToSupabase("m_facility_unit", fRows.slice(i, i + 100), "no_fasilitas");
      }
      Logger.log(`[OK] Sinkronisasi Fasilitas selesai: ${fRows.length} unit fasilitas diproses.`);
    }
  }

  // B. Sheet Dealer
  let dealerSheet = sheets.find(s => String(s.getSheetId()) === PERIODIC_SYNC_CONFIG.DEALER_SHEET_GID) || ss.getSheetByName("M_DEALER") || sheets[0];
  if (dealerSheet) {
    const dData = dealerSheet.getDataRange().getValues();
    const existingDealers = fetchSupabaseExisting("m_dealer", "dealer_id,dealer_name,area_cover,last_visit_date");
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

      dRows.push({
        dealer_id: dealerId,
        dealer_name: name,
        owner_name: String(row[2] || "").trim(),     // Kolom C (Index 2)
        cabang: String(row[5] || "").trim(),         // Kolom F (Index 5)
        area_cover: old?.area_cover || "",           // Preserved dari In-App
        productivity: String(row[42] || "Normal").trim(), // Kolom AQ (Index 42)
        status: "AKTIF",
        tanggal_kerjasama: tglKerjasama,
        last_visit_date: old?.last_visit_date || null
      });
    }

    for (let i = 0; i < dRows.length; i += 100) {
      upsertToSupabase("m_dealer", dRows.slice(i, i + 100), "dealer_id");
    }
    Logger.log(`[OK] Sinkronisasi Dealer selesai: ${dRows.length} mitra dealer diproses.`);
  }
}

/**
 * 🚀 FUNGSI UTAMA HARIAN
 * Pasang fungsi ini pada Trigger Google Apps Script (misal: Timer Harian Jam 06:00 Pagi)
 */
function runPeriodicDailySync() {
  Logger.log("=== MEMULAI SINKRONISASI PERIODIK HARIAN ===");
  try {
    syncDealersAndFacilitiesFromSource();
    Logger.log("=== SINKRONISASI PERIODIK SELESAI DENGAN SUKSES ===");
  } catch (e) {
    Logger.log("Error sync periodik: " + e.toString());
  }
}
