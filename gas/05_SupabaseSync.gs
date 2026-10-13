/**
 * 05_SupabaseSync.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Pipeline Sinkronisasi Data Master Operasional (Dealer, Unit, Device) ke Supabase PostgreSQL
 * 
 * CATATAN PEROMBAKAN (ETL Murni Operasional):
 * Seluruh fungsi yang berkaitan dengan HR (m_employee) dan lokasi kerja (m_work_location)
 * telah Dihapus. File ini didedikasikan murni untuk injeksi master operasional secara mandiri.
 */

const SUPABASE_CONFIG = {
  SPREADSHEET_ID: "1ST9KvTCE9iyhz0GD4gRQIBt6gS_3pnGOUZbHYkAO75M",
  URL: "https://pqfzkizqqhmsnidocumv.supabase.co",
  ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxZnpraXpxcWhtc25pZG9jdW12Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4Nzc2MTUsImV4cCI6MjEwNDQ1MzYxNX0.06q1t6BEk01wwQOO68hH_HtcsIdfUgbtBbcOhoXukKo"
};

/**
 * Helper HTTP REST Caller ke Supabase dengan mode UPSERT
 */
function sendToSupabase(endpoint, payload, onConflictKey = "") {
  try {
    const url = `${SUPABASE_CONFIG.URL}/rest/v1/${endpoint}${onConflictKey ? '?on_conflict=' + onConflictKey : ''}`;
    const headers = {
      "apikey": SUPABASE_CONFIG.ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`,
      "Content-Type": "application/json",
      "Prefer": onConflictKey ? "resolution=merge-duplicates" : "return=minimal"
    };

    const options = {
      method: "post",
      headers: headers,
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      Logger.log(`[OK] Sukses sync ke ${endpoint}: ${Array.isArray(payload) ? payload.length : 1} records.`);
      return { success: true };
    } else {
      Logger.log(`[ERR] Gagal sync ke ${endpoint} (HTTP ${code}): ${response.getContentText()}`);
      return { success: false, message: response.getContentText() };
    }
  } catch (err) {
    Logger.log(`[EXCEPTION] sendToSupabase error: ${err.toString()}`);
    return { success: false, message: err.toString() };
  }
}

/**
 * 1. Sync Dealer (m_dealer)
 */
function syncDealersToSupabase() {
  const ss = SpreadsheetApp.openById(SUPABASE_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("M_DEALER");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0] || `DLR-${i}`).trim();
    const name = String(r[1] || "").trim();
    const owner = String(r[2] || "").trim();
    const cabang = String(r[3] || "").trim();
    const area = String(r[4] || "").trim();
    const prod = String(r[5] || "Normal").trim();
    const status = String(r[6] || "AKTIF").trim();

    if (id && name) {
      records.push({
        dealer_id: id,
        dealer_name: name,
        owner_name: owner,
        cabang: cabang,
        area_cover: area,
        productivity: prod,
        status: status
      });
    }
  }

  if (records.length > 0) {
    sendToSupabase("m_dealer", records, "dealer_id");
  }
}

/**
 * 2. Sync Facility Units (m_facility_unit)
 */
function syncFacilityUnitsToSupabase() {
  const ss = SpreadsheetApp.openById(SUPABASE_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("M_FACILITY_UNIT");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const noFas = String(r[0] || "").trim();
    const dealer = String(r[1] || "").trim();
    const nopol = String(r[2] || "").trim().toUpperCase();
    const unit = String(r[3] || "").trim();
    const contract = String(r[4] || "LIVE").trim().toUpperCase();
    const imei = String(r[8] || "").trim();
    const gpsStatus = String(r[9] || "Normal").trim();

    if (noFas && nopol) {
      records.push({
        no_fasilitas: noFas,
        dealer_name: dealer,
        nopol: nopol,
        unit: unit,
        contract_status: contract,
        imei_gps: imei,
        gps_status: gpsStatus
      });
    }
  }

  if (records.length > 0) {
    for (let c = 0; c < records.length; c += 100) {
      sendToSupabase("m_facility_unit", records.slice(c, c + 100), "no_fasilitas");
    }
  }
}

/**
 * 3. Sync GPS Devices (m_gps_device)
 */
function syncGpsDevicesToSupabase() {
  const ss = SpreadsheetApp.openById(SUPABASE_CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName("M_GPS_DEVICE");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const imei = String(r[0] || "").trim();
    const status = String(r[1] || "TERSEDIA").trim();
    const pos = String(r[2] || "Kantor Pusat").trim();

    if (imei) {
      records.push({
        imei: imei,
        status_device: status,
        posisi_stock: pos
      });
    }
  }

  if (records.length > 0) {
    sendToSupabase("m_gps_device", records, "imei");
  }
}

/**
 * FUNGSI UTAMA: Jalankan untuk memindahkan data master operasional (Dealer, Unit, Device) ke Supabase.
 */
function syncAllMasterDataToSupabase() {
  Logger.log("=== MEMULAI SYNC MASTER OPERASIONAL KE SUPABASE ===");
  syncDealersToSupabase();
  syncFacilityUnitsToSupabase();
  syncGpsDevicesToSupabase();
  Logger.log("=== SINKRONISASI KE SUPABASE SELESAI! ===");
}
