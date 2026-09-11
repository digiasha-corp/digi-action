/**
 * 05_SupabaseSync.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Pipeline Sinkronisasi Data Master & Transaksi dari Google Spreadsheet ke Supabase PostgreSQL
 */

const SUPABASE_CONFIG = {
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
 * 1. Sync Lokasi Kantor (m_work_location)
 */
function syncWorkLocationsToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.WORK_LOCATION || "M_WORK_LOCATION");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0] || `LOC-${i}`).trim();
    const name = String(r[1] || "").trim();
    const lat = parseFloat(String(r[2] || "").replace(",", "."));
    const long = parseFloat(String(r[3] || "").replace(",", "."));
    const radius = parseInt(r[4]) || 100;
    const addr = String(r[5] || "");

    if (id && name && !isNaN(lat) && !isNaN(long)) {
      records.push({
        location_id: id,
        name: name,
        lat: lat,
        long: long,
        max_radius_meter: radius,
        address: addr
      });
    }
  }

  if (records.length > 0) {
    sendToSupabase("m_work_location", records, "location_id");
  }
}

/**
 * 2. Sync Karyawan & Akun (m_employee)
 */
function syncEmployeesToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEE || "M_EMPLOYEE");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const nip = String(r[0] || "").trim();
    const email = String(r[1] || "").trim().toLowerCase();
    const nama = String(r[2] || "").trim();
    const jabatan = String(r[3] || "").trim();
    const cabang = String(r[4] || "").trim();
    const area = String(r[5] || "").trim();
    const pass = String(r[6] || "Password123!").trim();
    const gantiPass = r[7] === true || String(r[7]).toUpperCase() === "TRUE";
    const roleId = String(r[8] || "R-04").trim();
    const statusAktif = String(r[9] || "AKTIF").trim().toUpperCase();
    const atasanNip = String(r[10] || "").trim();
    const atasanNama = String(r[11] || "").trim();

    if (nip && nama) {
      records.push({
        nip: nip,
        email: email || `${nip}@digiasha.corp`,
        nama_lengkap: nama,
        jabatan: jabatan,
        cabang: cabang,
        area_cover: area,
        password_hash: pass,
        role_id: roleId,
        status_ganti_pass: gantiPass,
        status_aktif: statusAktif,
        atasan_nip: atasanNip,
        atasan_nama: atasanNama
      });
    }
  }

  if (records.length > 0) {
    sendToSupabase("m_employee", records, "nip");
  }
}

/**
 * 3. Sync Dealer (m_dealer)
 */
function syncDealersToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DEALER || "M_DEALER");
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
 * 4. Sync Facility Units (m_facility_unit)
 */
function syncFacilityUnitsToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT");
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
 * 5. Sync GPS Devices (m_gps_device)
 */
function syncGpsDevicesToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GPS_DEVICE || "M_GPS_DEVICE");
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
 * 6. Sync Log Absensi (tr_absensi_log)
 */
function syncAbsensiLogsToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.ABSENSI || "TR_ABSENSI_LOG");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0] || "").trim();
    if (id) {
      records.push({
        absen_id: id,
        timestamp: String(r[1] || ""),
        nip: String(r[2] || ""),
        nama_karyawan: String(r[3] || ""),
        jenis_absen: String(r[4] || "Absen Datang"),
        cabang: String(r[5] || ""),
        lat: Number(r[6] || 0),
        long: Number(r[7] || 0),
        nearest_office: String(r[8] || ""),
        distance_meter: Number(r[9] || 0),
        status_geofence: String(r[10] || ""),
        menit_terlambat: Number(r[11] || 0),
        status_kehadiran: String(r[12] || ""),
        selfie_photo_url: String(r[13] || "")
      });
    }
  }

  if (records.length > 0) {
    for (let c = 0; c < records.length; c += 100) {
      sendToSupabase("tr_absensi_log", records.slice(c, c + 100), "absen_id");
    }
  }
}

/**
 * 7. Sync Log Izin (tr_izin_log)
 */
function syncIzinLogsToSupabase() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.IZIN || "TR_IZIN_LOG");
  if (!sheet) return;

  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return;

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const id = String(r[0] || "").trim();
    if (id) {
      records.push({
        izin_id: id,
        timestamp: String(r[1] || ""),
        nip: String(r[2] || ""),
        nama: String(r[3] || ""),
        cabang: String(r[4] || ""),
        jenis_izin: String(r[5] || "WFA"),
        tgl_mulai: String(r[6] || ""),
        tgl_selesai: String(r[7] || ""),
        catatan: String(r[8] || "-"),
        lat: Number(r[9] || 0),
        long: Number(r[10] || 0),
        selfie_url: String(r[11] || ""),
        pic_approval_nip: String(r[12] || ""),
        pic_approval_nama: String(r[13] || ""),
        status_approval: String(r[14] || "PENDING"),
        approved_at: String(r[15] || ""),
        approved_by: String(r[16] || ""),
        catatan_approval: String(r[17] || "")
      });
    }
  }

  if (records.length > 0) {
    for (let c = 0; c < records.length; c += 100) {
      sendToSupabase("tr_izin_log", records.slice(c, c + 100), "izin_id");
    }
  }
}

/**
 * FUNGSI UTAMA: Jalankan 1x di Apps Script Editor untuk memindahkan seluruh data awal ke Supabase!
 */
function syncAllMasterDataToSupabase() {
  Logger.log("=== MEMULAI SYNC SELURUH DATA MASTER & TRANSAKSI KE SUPABASE ===");
  syncWorkLocationsToSupabase();
  syncEmployeesToSupabase();
  syncDealersToSupabase();
  syncFacilityUnitsToSupabase();
  syncGpsDevicesToSupabase();
  syncAbsensiLogsToSupabase();
  syncIzinLogsToSupabase();
  Logger.log("=== SINKRONISASI KE SUPABASE SELESAI! ===");
}
