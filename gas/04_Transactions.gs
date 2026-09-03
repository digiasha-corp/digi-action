/**
 * 04_Transactions.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Handler Transaksi Lapangan (100% Flat Tabular Storage untuk Looker Studio)
 */

function handleSubmitVisit(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  const visitId = "VISIT-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

  let photoUrl = "";
  if (data.showroom_photo_base64) {
    photoUrl = uploadBase64ToDrive(data.showroom_photo_base64, CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID, "VISIT_SHOWROOM_" + (data.dealer_name || "DEALER").replace(/[^a-zA-Z0-9]/g, '_'));
  }

  // 1. Simpan Header ke TR_LAPORAN_VISIT
  const sheetHeader = ss.getSheetByName(CONFIG.SHEETS.VISIT_HEADER);
  if (sheetHeader) {
    sheetHeader.appendRow([
      visitId,
      now,
      data.currentUser?.nip || "-",
      data.currentUser?.nama || "-",
      data.dealer_name || "-",
      data.lokasi || "Showroom",
      data.owner_reason || "-",
      data.bertemu_owner || "Ya",
      data.stock || "0",
      data.sales || "0",
      data.issue_digi || "-",
      data.issue_internal || "-",
      data.issue_komp || "-",
      data.catatan_visit || "-",
      data.lat || 0,
      data.long || 0,
      photoUrl
    ]);
  }

  // 2. Simpan Detail Pemeriksaan Unit ke TR_VISIT_UNIT_CHECK (Flat Rows)
  const sheetUnit = ss.getSheetByName(CONFIG.SHEETS.VISIT_UNIT);
  if (sheetUnit && data.unit_check_list && Array.isArray(data.unit_check_list)) {
    data.unit_check_list.forEach(u => {
      let unitPhotoUrl = "";
      if (u.foto_unit) {
        unitPhotoUrl = uploadBase64ToDrive(u.foto_unit, CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID, "UNIT_" + String(u.nopol || "NOPOL").replace(/[^a-zA-Z0-9]/g, '_'));
      }

      sheetUnit.appendRow([
        visitId,
        now,
        data.dealer_name || "-",
        u.nopol || "-",
        u.unit || "-",
        u.is_ovd ? "OVERDUE" : "LANCAR",
        u.terlihat || "Ya",
        u.indikasi || "-",
        u.gps_match || "Ya",
        Array.isArray(u.info_unit) ? u.info_unit.join(', ') : (u.info_unit || "-"),
        u.ovd_plan || "-",
        u.komitmen || "Tidak Ada",
        u.tgl_komitmen || "-",
        unitPhotoUrl
      ]);
    });
  }

  return { success: true, visitId: visitId, message: "Laporan visit berhasil disimpan." };
}

function handleSubmitGpsMaintenance(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  const maintId = "GPS-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

  let photoOldUrl = uploadBase64ToDrive(data.foto_imei_lama_base64, CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID, "GPS_OLD_" + (data.nopol || "UNIT").replace(/[^a-zA-Z0-9]/g, '_'));
  let photoNewUrl = uploadBase64ToDrive(data.foto_imei_baru_base64, CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID, "GPS_NEW_" + (data.nopol || "UNIT").replace(/[^a-zA-Z0-9]/g, '_'));
  let photoPosUrl = uploadBase64ToDrive(data.foto_posisi_gps_base64, CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID, "GPS_POS_" + (data.nopol || "UNIT").replace(/[^a-zA-Z0-9]/g, '_'));

  // 1. Simpan ke TR_GPS_MAINTENANCE
  const sheetMaint = ss.getSheetByName(CONFIG.SHEETS.GPS_MAINTENANCE);
  if (sheetMaint) {
    sheetMaint.appendRow([
      maintId,
      now,
      data.currentUser?.nip || "-",
      data.currentUser?.nama || "-",
      data.dealer_name || "-",
      data.nopol || "-",
      data.act_type || "Ganti GPS",
      data.imei_lama || "-",
      data.imei_baru || "-",
      data.catatan_teknis || "-",
      data.lat || 0,
      data.long || 0,
      photoOldUrl,
      photoNewUrl,
      photoPosUrl
    ]);
  }

  // 2. Update Status di M_FACILITY_UNIT
  const sheetUnit = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT);
  if (sheetUnit) {
    const dataUnits = sheetUnit.getDataRange().getValues();
    const headers = dataUnits[0].map(h => String(h).trim());
    const idxNopol = headers.indexOf("nopol");
    const idxImei = headers.indexOf("imei_gps");
    const idxGpsStatus = headers.indexOf("gps_status");

    for (let r = 1; r < dataUnits.length; r++) {
      if (String(dataUnits[r][idxNopol]).trim().toLowerCase() === String(data.nopol).trim().toLowerCase()) {
        if (data.act_type === "Cabut GPS") {
          if (idxImei !== -1) sheetUnit.getRange(r + 1, idxImei + 1).setValue("");
          if (idxGpsStatus !== -1) sheetUnit.getRange(r + 1, idxGpsStatus + 1).setValue("Tidak Pasang");
        } else {
          if (idxImei !== -1) sheetUnit.getRange(r + 1, idxImei + 1).setValue(data.imei_baru || "");
          if (idxGpsStatus !== -1) sheetUnit.getRange(r + 1, idxGpsStatus + 1).setValue("Normal");
        }
        break;
      }
    }
  }

  return { success: true, maintId: maintId, message: "Aktivitas GPS maintenance berhasil dicatat." };
}

function handleSubmitOnboarding(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  const onbId = "ONB-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

  let selfieUrl = uploadBase64ToDrive(data.selfie_base64, CONFIG.DRIVE_FOLDERS.ONBOARDING_ID, "ONB_SELFIE_" + (data.nama_usaha || "CALON").replace(/[^a-zA-Z0-9]/g, '_'));

  const sheet = ss.getSheetByName(CONFIG.SHEETS.ONBOARDING);
  if (sheet) {
    sheet.appendRow([
      onbId,
      now,
      data.userId || "-",
      data.aktivitas || "Visit Awal",
      data.status_db || "Database Baru",
      data.nama_pemohon || "-",
      data.nama_usaha || "-",
      data.alamat || "-",
      data.jenis_usaha || "-",
      data.detail_usaha || "-",
      data.dokumen_list || "-",
      data.catatan || "-",
      data.lat || 0,
      data.long || 0,
      selfieUrl
    ]);
  }

  return { success: true, onbId: onbId, message: "Laporan onboarding berhasil disimpan." };
}

function handleSubmitFacGpsReport(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  const auditId = "FAC-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

  const sheet = ss.getSheetByName(CONFIG.SHEETS.FAC_AUDIT);
  if (sheet && data.reportList && Array.isArray(data.reportList)) {
    data.reportList.forEach(item => {
      sheet.appendRow([
        auditId,
        now,
        data.userId || "-",
        item.dealer || "-",
        item.asset_desc || "-",
        item.nopol || "-",
        item.status_kontrak || "-",
        item.status_codes ? item.status_codes.join(', ') : "-",
        item.catatan || "-"
      ]);
    });
  }

  return { success: true, auditId: auditId, message: "Laporan audit FAC GPS berhasil disimpan." };
}

function handleSaveAssignment(data) {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const now = new Date();
  const assignId = "ASN-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

  const sheet = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT);
  if (sheet) {
    sheet.appendRow([
      assignId,
      now,
      data.assignedByUserId || "ADM",
      data.assignedByUserName || "Supervisor",
      data.dealerName || "-",
      data.unitFasilitas || "Umum",
      data.concernType || "Concern Visit",
      data.urgencyLevel || "Penting",
      data.instruksi || "-",
      "OPEN"
    ]);
  }

  return { success: true, assignId: assignId, message: "Penugasan concern berhasil disimpan." };
}
