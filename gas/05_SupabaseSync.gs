/**
 * 05_SupabaseSync.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Script Standalone untuk Migrasi / Injeksi Data Master Awal ke Supabase
 */

const SYNC_CONFIG = {
  SPREADSHEET_ID: "1JbCMIePpNfPRfev7UIjyO763BfmJqzgtrLDMA0oFqVI",
  SUPABASE_URL: "https://pqfzkizqqhmsnidocumv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo",
  SHEETS: {
    WORK_LOCATION: "M_WORK_LOCATION",
    EMPLOYEE: "M_EMPLOYEE",
    DEALER: "M_DEALER",
    FACILITY_UNIT: "M_FACILITY_UNIT",
    GPS_DEVICE: "M_GPS_DEVICE"
  }
};

/**
 * Helper format tanggal ke YYYY-MM-DD aman
 */
function parseToDateString(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
  }
  const str = String(val).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined" || str === "-") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 1990) {
      return Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd");
    }
  } catch (e) {}
  return null;
}

/**
 * Helper HTTP POST / UPSERT ke Supabase REST API
 */
function sendToSupabase(tableName, payloadArray, onConflictColumn) {
  if (!payloadArray || payloadArray.length === 0) return { count: 0, status: "empty" };

  const endpoint = `${SYNC_CONFIG.SUPABASE_URL}/rest/v1/${tableName}${onConflictColumn ? '?on_conflict=' + onConflictColumn : ''}`;
  
  const options = {
    method: "POST",
    headers: {
      "apikey": SYNC_CONFIG.SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SYNC_CONFIG.SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=minimal"
    },
    payload: JSON.stringify(payloadArray),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(endpoint, options);
  const code = response.getResponseCode();
  if (code >= 200 && code < 300) {
    Logger.log(`[OK] Injeksi ${payloadArray.length} baris ke ${tableName} berhasil.`);
    return { success: true, count: payloadArray.length };
  } else {
    Logger.log(`[ERROR] Gagal injeksi ke ${tableName} (Status ${code}): ${response.getContentText()}`);
    return { success: false, error: response.getContentText(), status: code };
  }
}

/**
 * 🚀 FUNGSI UTAMA: Jalankan fungsi ini di Apps Script Editor
 */
function syncAllMasterDataToSupabase() {
  Logger.log("=== MULAI SINKRONISASI DATA MASTER KE SUPABASE ===");
  
  const ss = SpreadsheetApp.openById(SYNC_CONFIG.SPREADSHEET_ID);
  
  // 1. M_WORK_LOCATION
  try {
    const sLoc = ss.getSheetByName(SYNC_CONFIG.SHEETS.WORK_LOCATION);
    if (sLoc) {
      const d = sLoc.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < d.length; i++) {
        const locId = String(d[i][0] || "").trim();
        if (!locId) continue;
        rows.push({
          location_id: locId,
          name: String(d[i][1] || locId),
          lat: parseFloat(d[i][2]) || 0,
          long: parseFloat(d[i][3]) || 0,
          max_radius_meter: parseInt(d[i][4]) || 150,
          address: String(d[i][5] || "")
        });
      }
      if (rows.length > 0) {
        sendToSupabase("m_work_location", rows, "location_id");
      }
    }
  } catch(e) { 
    Logger.log("Err Loc: " + e.toString()); 
  }

  // 2. M_EMPLOYEE
  try {
    const sEmp = ss.getSheetByName(SYNC_CONFIG.SHEETS.EMPLOYEE);
    if (sEmp) {
      const d = sEmp.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < d.length; i++) {
        const nip = String(d[i][0] || "").trim();
        if (!nip) continue;
        const email = String(d[i][1] || "").trim() || `${nip}@digiasha.com`;
        rows.push({
          nip: nip,
          email: email,
          nama_lengkap: String(d[i][2] || nip),
          jabatan: String(d[i][3] || ""),
          cabang: String(d[i][4] || ""),
          area_cover: String(d[i][5] || ""),
          password_hash: String(d[i][6] || "Password123!"),
          status_ganti_pass: d[i][7] === true || String(d[i][7]).toLowerCase() === "true",
          role_id: String(d[i][8] || "R-04"),
          status_aktif: d[i][9] !== false && String(d[i][9]).toLowerCase() !== "false" ? "AKTIF" : "NONAKTIF"
        });
      }
      for (let i = 0; i < rows.length; i += 100) {
        sendToSupabase("m_employee", rows.slice(i, i + 100), "nip");
      }
    }
  } catch(e) { 
    Logger.log("Err Emp: " + e.toString()); 
  }

  // 3. M_DEALER
  try {
    const sDlr = ss.getSheetByName(SYNC_CONFIG.SHEETS.DEALER);
    if (sDlr) {
      const d = sDlr.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < d.length; i++) {
        const name = String(d[i][1] || "").trim();
        if (!name) continue;
        const dealerId = String(d[i][0] || "").trim() || `DLR-${i}`;
        const tglKerja = parseToDateString(d[i][7]);
        const lastVisit = parseToDateString(d[i][8]);
        
        rows.push({
          dealer_id: dealerId,
          dealer_name: name,
          owner_name: String(d[i][2] || ""),
          cabang: String(d[i][3] || ""),
          area_cover: String(d[i][4] || ""),
          productivity: String(d[i][5] || "Normal"),
          status: String(d[i][6] || "AKTIF"),
          tanggal_kerjasama: tglKerja,
          last_visit_date: lastVisit
        });
      }
      for (let i = 0; i < rows.length; i += 100) {
        sendToSupabase("m_dealer", rows.slice(i, i + 100), "dealer_id");
      }
    }
  } catch(e) { 
    Logger.log("Err Dealer: " + e.toString()); 
  }

  // 4. M_FACILITY_UNIT
  try {
    const sFac = ss.getSheetByName(SYNC_CONFIG.SHEETS.FACILITY_UNIT);
    if (sFac) {
      const d = sFac.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < d.length; i++) {
        const noFas = String(d[i][0] || "").trim();
        if (!noFas) continue;
        const jtoDate = parseToDateString(d[i][5]);
        const lastVisit = parseToDateString(d[i][10]);
        
        rows.push({
          no_fasilitas: noFas,
          dealer_name: String(d[i][1] || ""),
          nopol: String(d[i][2] || "-"),
          unit: String(d[i][3] || ""),
          contract_status: String(d[i][4] || "LIVE"),
          jto_date: jtoDate,
          overdue_days: parseInt(d[i][6]) || 0,
          lifetime_days: parseInt(d[i][7]) || 0,
          imei_gps: String(d[i][8] || ""),
          gps_status: String(d[i][9] || "Normal"),
          last_visit_date: lastVisit,
          aging_gps_maint: parseInt(d[i][12]) || 0
        });
      }
      for (let i = 0; i < rows.length; i += 100) {
        sendToSupabase("m_facility_unit", rows.slice(i, i + 100), "no_fasilitas");
      }
    }
  } catch(e) { 
    Logger.log("Err Fac: " + e.toString()); 
  }

  // 5. M_GPS_DEVICE
  try {
    const sGps = ss.getSheetByName(SYNC_CONFIG.SHEETS.GPS_DEVICE);
    if (sGps) {
      const d = sGps.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < d.length; i++) {
        const imei = String(d[i][0] || "").trim();
        if (!imei) continue;
        rows.push({
          imei: imei,
          status_device: String(d[i][1] || "TERSEDIA"),
          posisi_stock: String(d[i][2] || "Kantor Pusat"),
          last_updated: new Date().toISOString()
        });
      }
      for (let i = 0; i < rows.length; i += 100) {
        sendToSupabase("m_gps_device", rows.slice(i, i + 100), "imei");
      }
    }
  } catch(e) { 
    Logger.log("Err GPS: " + e.toString()); 
  }

  Logger.log("=== SINKRONISASI DATA MASTER KE SUPABASE SELESAI ===");
}
