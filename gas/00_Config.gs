/**
 * 00_Config.gs - DIGIASHA FIELD MONITORING SYSTEM
 * File Konfigurasi Global Spreadsheet, GID Sumber, Folder Google Drive & Helper
 */

// =========================================================================
// 1. KONFIGURASI GLOBAL SPREADSHEET & GID SUMBER
// =========================================================================
const SPREADSHEET_DB_ID = "1JbCMIePpNfPRfev7UIjyO763BfmJqzgtrLDMA0oFqVI"; 
const SPREADSHEET_HR_SOURCE_ID = "1h2NiNffCNUrtoauLkdJXBKXTyOOnxBh6vPvLowOo5M8"; 
const HR_SHEET_GID = "1541309632";

const SPREADSHEET_DEALER_SOURCE_ID = "1ST9KvTCE9iyhz0GD4gRQIBt6gS_3pnGOUZbHYkAO75M"; 
const DEALER_SHEET_GID = "126845644";
const FACILITY_SHEET_GID = "1137250571";

const DEFAULT_PASSWORD = "Password123!";

const FOLDER_ID_ONBOARDING = "1Damd9YO6LqJyxbTZMxz_UZDWWuOU7AvJ";
const FOLDER_ID_VISIT_FOTO = "18VPAgr14_kkf3Y3nBBp9d-e4Vcn-fcDK";
const FOLDER_ID_ABSENSI = "1O3fuqC9zIv6zlIqkH76ae3shMOKodCUV";

// Objek CONFIG Terpadu untuk Modul Transaksi, Drive & Sync Jobs
const CONFIG = {
  MAIN_SPREADSHEET_ID: SPREADSHEET_DB_ID,
  HR_SOURCE_ID: SPREADSHEET_HR_SOURCE_ID,
  HR_SHEET_GID: HR_SHEET_GID,
  DEALER_FACILITY_SOURCE_ID: SPREADSHEET_DEALER_SOURCE_ID,
  DEALER_SHEET_GID: DEALER_SHEET_GID,
  FACILITY_SHEET_GID: FACILITY_SHEET_GID,
  DEFAULT_PASSWORD: DEFAULT_PASSWORD,

  SHEETS: {
    EMPLOYEE: "M_EMPLOYEE",
    WORK_LOCATION: "M_WORK_LOCATION",
    DEALER: "M_DEALER",
    FACILITY_UNIT: "M_FACILITY_UNIT",
    GPS_DEVICE: "M_GPS_DEVICE",
    ASSIGNMENT: "T_ASSIGNMENT",
    VISIT_HEADER: "TR_LAPORAN_VISIT",
    VISIT_UNIT: "TR_VISIT_UNIT_CHECK",
    GPS_MAINTENANCE: "TR_GPS_MAINTENANCE",
    ONBOARDING: "TR_ONBOARDING_LOG",
    FAC_AUDIT: "TR_GPS_FAC_CHECK",
    PRIORITY_LOG: "LOG_PRIORITY_DAILY",
    ABSENSI: "TR_ABSENSI_LOG",
    AUDIT_TRAIL: "SYS_AUDIT_TRAIL"
  },

  DRIVE_FOLDERS: {
    ONBOARDING_ID: FOLDER_ID_ONBOARDING,
    VISIT_FOTO_ID: FOLDER_ID_VISIT_FOTO,
    ABSENSI_ID: FOLDER_ID_ABSENSI
  }
};

// =========================================================================
// 2. HELPER SHEET & AUDIT TRAIL
// =========================================================================
function getSheet(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_DB_ID);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

function recordAuditTrail(userId, action, detailInfo, deviceInfo) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.AUDIT_TRAIL || "SYS_AUDIT_TRAIL");
    const logId = "LOG-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 1000);
    const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    sheet.appendRow([logId, timestamp, userId || "ANONYMOUS", action, detailInfo || "", deviceInfo || ""]);
  } catch (err) {
    Logger.log("Audit log error: " + err.toString());
  }
}

// =========================================================================
// 3. INISIALISASI / STANDARISASI HEADER SELURUH SHEET DATABASE
// =========================================================================
function setupAllDatabaseSheetHeaders() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  
  const schema = {
    [CONFIG.SHEETS.EMPLOYEE]: [
      "nip", "nama_lengkap", "email", "password", "role", "cabang", "area_cover", "status"
    ],
    [CONFIG.SHEETS.DEALER]: [
      "dealer_id", "dealer_name", "owner_name", "cabang", "area_cover", "productivity", "status", "tanggal_kerjasama", "last_visit_date", "aging_visit_mitra", "urgent_units_count", "priority_level", "priority_score", "priority_reason"
    ],
    [CONFIG.SHEETS.FACILITY_UNIT]: [
      "no_fasilitas", "dealer_name", "nopol", "unit", "contract_status", "jto_date", "overdue_days", "lifetime_days", "imei_gps", "gps_status", "last_visit_date", "aging_visit_unit", "aging_gps_maint", "priority_level", "priority_score", "priority_reason", "is_h3_jto"
    ],
    [CONFIG.SHEETS.GPS_DEVICE]: [
      "imei", "tipe_perangkat", "status_device", "posisi_stock", "last_updated"
    ],
    [CONFIG.SHEETS.ASSIGNMENT]: [
      "assignment_id", "created_at", "supervisor_nip", "assigned_to_nip", "dealer_name", "unit_fasilitas", "urgency_level", "instruksi", "status", "resolved_at", "resolved_by"
    ],
    [CONFIG.SHEETS.VISIT_HEADER]: [
      "visit_id", "timestamp", "nip", "dealer_name", "lokasi", "bertemu_owner", "owner_reason", "stock", "sales", "issue_digi", "issue_internal", "issue_komp", "total_unit", "catatan_visit", "lat", "long", "showroom_photo_url", "tindak_lanjut_concern"
    ],
    [CONFIG.SHEETS.VISIT_UNIT]: [
      "check_id", "visit_id", "timestamp", "dealer_name", "no_fasilitas", "nopol", "unit", "status_keberadaan", "odometer", "kondisi_fisik", "alasan_tidak_ada", "lokasi_unit_lain", "catatan_unit", "foto_unit_url", "foto_odometer_url"
    ],
    [CONFIG.SHEETS.GPS_MAINTENANCE]: [
      "maint_id", "timestamp", "nip", "no_fasilitas", "nopol", "dealer_name", "act_type", "imei_lama", "imei_baru", "alasan_cabut", "status_kondisi_gps", "keterangan", "lat", "long", "foto_gps_url"
    ],
    [CONFIG.SHEETS.ONBOARDING]: [
      "onboarding_id", "timestamp", "nip", "dealer_name", "owner_name", "lokasi_lat", "lokasi_long", "survei_kelayakan", "catatan_survey", "foto_ktp_url", "foto_showroom_url", "doc_legalitas_url"
    ],
    [CONFIG.SHEETS.FAC_AUDIT]: [
      "check_id", "timestamp", "user_id", "no_fasilitas", "imei", "status_gps", "keterangan"
    ],
    [CONFIG.SHEETS.ABSENSI]: [
      "absen_id", "timestamp", "nip", "nama_karyawan", "tipe_absen", "office_name", "lat", "long", "distance_meter", "selfie_photo_url", "status_presensi"
    ],
    [CONFIG.SHEETS.PRIORITY_LOG]: [
      "log_id", "log_date", "log_time", "entity_type", "entity_id", "entity_name", "cabang", "priority_level", "priority_score", "priority_reason", "aging_visit", "lifetime_days", "overdue_days", "gps_status", "is_h3_jto", "urgent_units_count", "concern_notes"
    ],
    [CONFIG.SHEETS.AUDIT_TRAIL]: [
      "log_id", "timestamp", "user_id", "action", "detail_info", "device_info"
    ]
  };

  Object.keys(schema).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const headers = schema[sheetName];
    // Tulis header jika sheet masih kosong
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });

  Logger.log("Inisialisasi & Verifikasi Header Database Selesai!");
}

/**
 * Paksa perbaiki dan perbarui baris 1 (Header) seluruh sheet database
 * Jalankan fungsi ini di Apps Script Editor untuk menyelaraskan seluruh kolom header
 */
function fixAndStandardizeSheetHeaders() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
  
  const schema = {
    [CONFIG.SHEETS.EMPLOYEE]: [
      "nip", "nama_lengkap", "email", "password", "role", "cabang", "area_cover", "status"
    ],
    [CONFIG.SHEETS.DEALER]: [
      "dealer_id", "dealer_name", "owner_name", "cabang", "area_cover", "productivity", "status", "tanggal_kerjasama", "last_visit_date", "aging_visit_mitra", "urgent_units_count", "priority_level", "priority_score", "priority_reason"
    ],
    [CONFIG.SHEETS.FACILITY_UNIT]: [
      "no_fasilitas", "dealer_name", "nopol", "unit", "contract_status", "jto_date", "overdue_days", "lifetime_days", "imei_gps", "gps_status", "last_visit_date", "aging_visit_unit", "aging_gps_maint", "priority_level", "priority_score", "priority_reason", "is_h3_jto"
    ],
    [CONFIG.SHEETS.GPS_DEVICE]: [
      "imei", "tipe_perangkat", "status_device", "posisi_stock", "last_updated"
    ],
    [CONFIG.SHEETS.ASSIGNMENT]: [
      "assignment_id", "created_at", "supervisor_nip", "assigned_to_nip", "dealer_name", "unit_fasilitas", "urgency_level", "instruksi", "status", "resolved_at", "resolved_by"
    ],
    [CONFIG.SHEETS.VISIT_HEADER]: [
      "visit_id", "timestamp", "nip", "dealer_name", "lokasi", "bertemu_owner", "owner_reason", "stock", "sales", "issue_digi", "issue_internal", "issue_komp", "total_unit", "catatan_visit", "lat", "long", "showroom_photo_url", "tindak_lanjut_concern"
    ],
    [CONFIG.SHEETS.VISIT_UNIT]: [
      "check_id", "visit_id", "timestamp", "dealer_name", "no_fasilitas", "nopol", "unit", "status_keberadaan", "kondisi_fisik", "odometer", "catatan_unit"
    ],
    [CONFIG.SHEETS.GPS_MAINTENANCE]: [
      "maint_id", "timestamp", "nip", "no_fasilitas", "nopol", "dealer_name", "act_type", "imei_lama", "imei_baru", "alasan_cabut", "status_kondisi_gps", "keterangan", "lat", "long", "foto_gps_url"
    ],
    [CONFIG.SHEETS.ONBOARDING]: [
      "onboarding_id", "timestamp", "nip", "dealer_name", "owner_name", "lokasi_lat", "lokasi_long", "survei_kelayakan", "catatan_survey", "foto_ktp_url", "foto_showroom_url", "doc_legalitas_url"
    ],
    [CONFIG.SHEETS.FAC_AUDIT]: [
      "check_id", "timestamp", "user_id", "no_fasilitas", "imei", "status_gps", "keterangan"
    ],
    [CONFIG.SHEETS.ABSENSI]: [
      "absen_id", "timestamp", "nip", "nama_karyawan", "tipe_absen", "office_name", "lat", "long", "distance_meter", "selfie_photo_url", "status_presensi"
    ],
    [CONFIG.SHEETS.PRIORITY_LOG]: [
      "log_id", "log_date", "log_time", "entity_type", "entity_id", "entity_name", "cabang", "priority_level", "priority_score", "priority_reason", "aging_visit", "lifetime_days", "overdue_days", "gps_status", "is_h3_jto", "urgent_units_count", "concern_notes"
    ],
    [CONFIG.SHEETS.AUDIT_TRAIL]: [
      "log_id", "timestamp", "user_id", "action", "detail_info", "device_info"
    ]
  };

  Object.keys(schema).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const headers = schema[sheetName];
    // Paksa update Baris 1
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#0f172a").setFontColor("#ffffff");
    sheet.setFrozenRows(1);
  });

  Logger.log("Seluruh Header Database Berhasil Diperbaiki dan Diselaraskan!");
}
