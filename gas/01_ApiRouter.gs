/**
 * 01_ApiRouter.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Router Utama Web App (doGet & doPost) & Handlers Terpadu
 */

// =========================================================================
// 1. GET ROUTER (PENGUJIAN & MASTER DATA CEPAT)
// =========================================================================
function doGet(e) {
  try {
    const action = e.parameter ? e.parameter.action : "";
    let result = { 
      status: "online", 
      service: "Digiasha Field Monitoring API", 
      version: "2.0", 
      timestamp: new Date().toISOString() 
    };

    if (action === "ping") {
      result = { success: true, message: "Digiasha API Live!", time: new Date() };
    } else if (action === "getMasterData") {
      result = typeof getMasterDataForFrontend === "function" ? getMasterDataForFrontend() : handleGetMasterData();
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// 2. POST ROUTER (AUTENTIKASI & TRANSAKSI LAPANGAN)
// =========================================================================
function doPost(e) {
  try {
    let payload = {};
    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action;
    let result = { success: false, message: "Action tidak dikenali: " + action };

    // --- A. AUTH & USER MANAGEMENT ---
    if (action === "login") {
      if (typeof verifyUserLogin === "function") {
        result = verifyUserLogin(payload.identifier, payload.password);
      } else if (typeof handleLogin === "function") {
        result = handleLogin(payload.identifier, payload.password);
      }
    } else if (action === "changeFirstPassword") {
      if (typeof updateFirstLoginPassword === "function") {
        result = updateFirstLoginPassword(payload.email, payload.newPassword);
      }
    } else if (action === "changePassword") {
      if (typeof changeEmployeePassword === "function") {
        result = changeEmployeePassword(payload.nip, payload.oldPassword, payload.newPassword);
      }
    } else if (action === "getMasterData") {
      result = typeof getMasterDataForFrontend === "function" ? getMasterDataForFrontend() : handleGetMasterData();
    }

    // --- B. TRANSAKSI LAPANGAN ---
    else if (action === "submitVisit") {
      if (typeof submitLaporanVisitServer === "function") {
        result = submitLaporanVisitServer(payload, payload.unit_check_list || [], payload.currentUser);
      } else if (typeof handleSubmitVisit === "function") {
        result = handleSubmitVisit(payload);
      }
    }

    else if (action === "submitOnboarding") {
      let selfieUrl = "";
      if (payload.selfie_base64 && typeof uploadOnboardingAttachment === "function") {
        const upRes = uploadOnboardingAttachment(payload.nama_usaha || "CALON_MITRA", "SELFIE", payload.nama_usaha || "CALON_MITRA", payload.selfie_base64, "selfie.jpg");
        if (upRes && upRes.success) selfieUrl = upRes.url;
      } else if (payload.selfie_base64 && typeof uploadBase64ToDrive === "function") {
        selfieUrl = uploadBase64ToDrive(payload.selfie_base64, CONFIG.DRIVE_FOLDERS.ONBOARDING_ID, "ONB_SELFIE_" + (payload.nama_usaha || "CALON").replace(/[^a-zA-Z0-9]/g, '_'));
      }
      payload.selfie_photo_url = selfieUrl;
      payload.selfie_url = selfieUrl;

      if (typeof saveOnboardingData === "function") {
        result = saveOnboardingData(payload);
      } else if (typeof handleSubmitOnboarding === "function") {
        result = handleSubmitOnboarding(payload);
      }
    }

    else if (action === "submitGpsMaintenance") {
      if (payload.foto_imei_lama_base64 && typeof uploadVisitPhoto === "function") {
        const up = uploadVisitPhoto(payload.dealer_name || "MITRA", "GPS-OLD-IMEI", payload.foto_imei_lama_base64);
        if (up && up.success) payload.foto_imei_lama_url = up.url;
      }
      if (payload.foto_imei_baru_base64 && typeof uploadVisitPhoto === "function") {
        const up = uploadVisitPhoto(payload.dealer_name || "MITRA", "GPS-NEW-IMEI", payload.foto_imei_baru_base64);
        if (up && up.success) payload.foto_imei_baru_url = up.url;
      }
      if (payload.foto_posisi_gps_base64 && typeof uploadVisitPhoto === "function") {
        const up = uploadVisitPhoto(payload.dealer_name || "MITRA", "GPS-POSISI", payload.foto_posisi_gps_base64);
        if (up && up.success) payload.foto_posisi_gps_url = up.url;
      }

      if (typeof submitGpsMaintenanceServer === "function") {
        result = submitGpsMaintenanceServer(payload, payload.currentUser);
      } else if (typeof handleSubmitGpsMaintenance === "function") {
        result = handleSubmitGpsMaintenance(payload);
      }
    }

    else if (action === "submitFacGpsReport") {
      if (typeof submitFacGpsReportServer === "function") {
        result = submitFacGpsReportServer(payload.reportList || [], payload.userId);
      } else if (typeof handleSubmitFacGpsReport === "function") {
        result = handleSubmitFacGpsReport(payload);
      }
    }

    else if (action === "saveAssignment") {
      if (typeof saveAssignmentData === "function") {
        result = saveAssignmentData(payload);
      } else if (typeof handleSaveAssignment === "function") {
        result = handleSaveAssignment(payload);
      }
    }

    else if (action === "getTodayAbsenStatus") {
      if (typeof getTodayAbsenStatusServer === "function") {
        result = getTodayAbsenStatusServer(payload.nip || payload.user_id);
      }
    }

    else if (action === "submitAbsensi") {
      let selfieUrl = "";
      if (payload.selfie_base64) {
        if (typeof uploadAbsensiSelfie === "function") {
          selfieUrl = uploadAbsensiSelfie(payload.nip || payload.user_id || payload.userId || "USER", payload.selfie_base64);
        } else if (typeof uploadBase64ToDrive === "function") {
          selfieUrl = uploadBase64ToDrive(payload.selfie_base64, (CONFIG.DRIVE_FOLDERS && CONFIG.DRIVE_FOLDERS.ABSENSI_ID) || "1O3fuqC9zIv6zlIqkH76ae3shMOKodCUV", (payload.nip || payload.user_id || "USER") + "_" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss"));
        }
      }
      payload.selfie_url = selfieUrl;
      payload.selfie_photo_url = selfieUrl;

      if (typeof submitAbsensiServer === "function") {
        result = submitAbsensiServer(payload);
      } else if (typeof handleSubmitAbsensi === "function") {
        result = handleSubmitAbsensi(payload);
      }
    }

    else if (action === "submitIzin") {
      let selfieUrl = "";
      if (payload.selfie_base64) {
        if (typeof uploadAbsensiSelfie === "function") {
          selfieUrl = uploadAbsensiSelfie("IZIN_" + (payload.nip || "USER"), payload.selfie_base64);
        } else if (typeof uploadBase64ToDrive === "function") {
          selfieUrl = uploadBase64ToDrive(payload.selfie_base64, (CONFIG.DRIVE_FOLDERS && CONFIG.DRIVE_FOLDERS.ABSENSI_ID) || "1O3fuqC9zIv6zlIqkH76ae3shMOKodCUV", "IZIN_" + (payload.nip || "USER") + "_" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss"));
        }
      }
      payload.selfie_url = selfieUrl;
      if (typeof submitIzinServer === "function") {
        result = submitIzinServer(payload);
      }
    }

    else if (action === "getApprovalList") {
      if (typeof getApprovalListServer === "function") {
        result = getApprovalListServer(payload.nip || payload.user_id, payload.role);
      }
    }

    else if (action === "processApproval") {
      if (typeof processApprovalServer === "function") {
        result = processApprovalServer(payload);
      }
    }

    else if (action === "runPrioritySyncNow") {
      if (typeof dailyPrioritySyncJob === "function") {
        dailyPrioritySyncJob();
        result = { success: true, message: "Sinkronisasi kalkulasi prioritas berhasil dijalankan!" };
      }
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// =========================================================================
// 3. HANDLER STANDAR ABSENSI PRESENSI & PERIZINAN
// =========================================================================

// Helper Resolusi Timezone Indonesia (WIB, WITA, WIT) Berdasarkan Cabang / Lokasi Kantor / Parameter Klien
function resolveEmployeeTimeZone(cabang, officeName, clientTz) {
  if (clientTz && (clientTz.includes("Makassar") || clientTz.includes("Jayapura") || clientTz.includes("Jakarta") || clientTz.includes("Ujung_Pandang"))) {
    return clientTz;
  }
  const text = (String(cabang || "") + " " + String(officeName || "")).toUpperCase();
  // WIT (UTC+9)
  if (text.includes("JAYAPURA") || text.includes("AMBON") || text.includes("PAPUA") || text.includes("MALUKU") || text.includes("SORONG") || text.includes("MANOKWARI") || text.includes("TIMIKA") || text.includes("MERAUKE") || text.includes("BIAK")) {
    return "Asia/Jayapura";
  }
  // WITA (UTC+8)
  if (text.includes("MAKASSAR") || text.includes("BALIKPAPAN") || text.includes("BANJARMASIN") || text.includes("SAMARINDA") || text.includes("MANADO") || text.includes("PALU") || text.includes("KENDARI") || text.includes("GORONTALO") || text.includes("DENPASAR") || text.includes("BALI") || text.includes("MATARAM") || text.includes("LOMBOK") || text.includes("KUPANG") || text.includes("SULAWESI") || text.includes("KALIMANTAN") || text.includes("NTB") || text.includes("NTT")) {
    return "Asia/Makassar";
  }
  // Default WIB (UTC+7)
  return "Asia/Jakarta";
}

function submitAbsensiServer(payload) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    let sheet = ss.getSheetByName(CONFIG.SHEETS.ABSENSI || "TR_ABSENSI_LOG");
    const now = new Date();
    
    // Resolusi Timezone Lokal Sesuai Lokasi / Cabang Karyawan (WIB / WITA / WIT)
    const timeZone = resolveEmployeeTimeZone(payload.cabang, payload.lokasi_kantor || payload.nearest_office, payload.timezone);
    const tzAbbr = timeZone === "Asia/Jayapura" ? "WIT" : (timeZone === "Asia/Makassar" ? "WITA" : "WIB");

    const timestampStr = Utilities.formatDate(now, timeZone, "yyyy-MM-dd HH:mm:ss");
    const dateTodayStr = Utilities.formatDate(now, timeZone, "yyyy-MM-dd");
    const hourStr = Utilities.formatDate(now, timeZone, "HH");
    const minStr = Utilities.formatDate(now, timeZone, "mm");
    const timeStr = `${hourStr}:${minStr} ${tzAbbr}`;

    const jenisAbsen = payload.jenis_absen || "Absen Datang";
    const isDatang = jenisAbsen === "Absen Datang" || jenisAbsen === "Masuk Kantor";
    const distanceMeter = Number(payload.distance_meters || payload.distance_meter || 0);
    const maxRadius = Number(payload.max_radius || 100);

    // 1. Verifikasi Geofence hanya untuk Absen Datang
    if (isDatang && distanceMeter > maxRadius) {
      return {
        success: false,
        message: `Lokasi Anda berada di luar radius kantor terdaftar (${distanceMeter} Meter / Maks ${maxRadius}m).`
      };
    }

    // 2. Kalkulasi Jam Masuk 09:00 Waktu Setempat (WIB/WITA/WIT) untuk Absen Datang
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);
    const targetMinutes = 9 * 60; // 09:00:00 waktu lokal
    const isLate = isDatang && currentMinutes > targetMinutes;
    const lateMinutes = isLate ? (currentMinutes - targetMinutes) : 0;

    let statusKehadiran = "PULANG";
    let messageText = `Absensi Kepulangan Berhasil (${timeStr})`;

    if (isDatang) {
      if (isLate) {
        statusKehadiran = "TERLAMBAT";
        messageText = `Absensi Kedatangan Berhasil, Anda Terlambat ${lateMinutes} Menit (${timeStr})`;
      } else {
        statusKehadiran = "TEPAT_WAKTU";
        messageText = `Absensi Kedatangan Berhasil (Tepat Waktu - ${timeStr})`;
      }
    }

    const absenId = "ABS-" + Utilities.formatDate(now, timeZone, "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 100);

    const standardHeaders = [
      "absen_id", "timestamp", "nip", "nama_karyawan", "jenis_absen", 
      "cabang", "lat", "long", "nearest_office", "distance_meter", 
      "status_geofence", "menit_terlambat", "status_kehadiran", "selfie_photo_url"
    ];

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS.ABSENSI || "TR_ABSENSI_LOG");
      sheet.appendRow(standardHeaders);
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(standardHeaders);
      sheet.setFrozenRows(1);
    }

    const rowData = [
      absenId,
      timestampStr,
      payload.nip || payload.user_id || "-",
      payload.nama || payload.user_name || "Karyawan",
      isDatang ? "Absen Datang" : "Absen Pulang",
      payload.cabang || "-",
      Number(payload.lat || 0),
      Number(payload.long || 0),
      payload.lokasi_kantor || payload.nearest_office || "-",
      distanceMeter,
      isDatang ? (distanceMeter <= maxRadius ? "VALID" : "OUTSIDE_RADIUS") : "N/A",
      lateMinutes,
      statusKehadiran,
      payload.selfie_url || payload.selfie_photo_url || ""
    ];

    sheet.appendRow(rowData);

    // Sync to Supabase jika tersedia
    if (typeof sendToSupabase === "function") {
      sendToSupabase("tr_absensi_log", [{
        absen_id: absenId,
        timestamp: timestampStr,
        nip: payload.nip || payload.user_id || "-",
        nama_karyawan: payload.nama || payload.user_name || "Karyawan",
        jenis_absen: isDatang ? "Absen Datang" : "Absen Pulang",
        cabang: payload.cabang || "-",
        lat: Number(payload.lat || 0),
        long: Number(payload.long || 0),
        nearest_office: payload.lokasi_kantor || payload.nearest_office || "-",
        distance_meter: distanceMeter,
        status_geofence: isDatang ? (distanceMeter <= maxRadius ? "VALID" : "OUTSIDE_RADIUS") : "N/A",
        menit_terlambat: lateMinutes,
        status_kehadiran: statusKehadiran,
        selfie_photo_url: payload.selfie_url || payload.selfie_photo_url || ""
      }]);
    }

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(
        payload.nip || payload.user_id || payload.nama, 
        "SUBMIT_ABSENSI", 
        `${isDatang ? 'Absen Datang' : 'Absen Pulang'} (${statusKehadiran} - ${tzAbbr}) - ${distanceMeter}m`, 
        `GPS: ${payload.lat || 0}, ${payload.long || 0}`
      );
    }

    return { 
      success: true, 
      absenId: absenId, 
      jenis_absen: isDatang ? "Absen Datang" : "Absen Pulang",
      status_kehadiran: statusKehadiran,
      isLate: isLate,
      lateMinutes: lateMinutes,
      timeZone: timeZone,
      tzAbbr: tzAbbr,
      timeStr: timeStr,
      message: messageText 
    };
  } catch (err) {
    Logger.log("Error submitAbsensiServer: " + err.toString());
    return { success: false, message: "Gagal menyimpan absensi: " + err.toString() };
  }
}

function getTodayAbsenStatusServer(nip, cabang, clientTz) {
  try {
    if (!nip) return { success: true, status: "BELUM_ABSEN", hasAbsenDatang: false, hasAbsenPulang: false };
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ABSENSI || "TR_ABSENSI_LOG");
    if (!sheet || sheet.getLastRow() <= 1) {
      return { success: true, status: "BELUM_ABSEN", hasAbsenDatang: false, hasAbsenPulang: false };
    }

    const timeZone = resolveEmployeeTimeZone(cabang, "", clientTz);
    const todayDateStr = Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd");
    const rows = sheet.getDataRange().getValues();
    const cleanNip = String(nip).trim().toLowerCase();

    let hasDatang = false;
    let hasPulang = false;
    let datangTime = "";
    let pulangTime = "";

    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      const rTime = String(r[1] || "");
      const rNip = String(r[2] || "").trim().toLowerCase();
      const rJenis = String(r[4] || "").toLowerCase();

      if (rTime.startsWith(todayDateStr) && (rNip === cleanNip || rNip.replace(/^0+/, '') === cleanNip.replace(/^0+/, ''))) {
        if (rJenis.includes("datang") || rJenis.includes("masuk")) {
          hasDatang = true;
          if (!datangTime) datangTime = rTime.substring(11, 16);
        } else if (rJenis.includes("pulang")) {
          hasPulang = true;
          if (!pulangTime) pulangTime = rTime.substring(11, 16);
        }
      }
    }

    let overallStatus = "BELUM_ABSEN";
    if (hasPulang) {
      overallStatus = "SUDAH_PULANG";
    } else if (hasDatang) {
      overallStatus = "SUDAH_DATANG";
    }

    return {
      success: true,
      status: overallStatus,
      hasAbsenDatang: hasDatang,
      hasAbsenPulang: hasPulang,
      datangTime: datangTime,
      pulangTime: pulangTime
    };
  } catch (err) {
    return { success: false, message: err.toString(), status: "BELUM_ABSEN" };
  }
}

// =========================================================================
// 4. HANDLER MASTER DATA UNTUK FRONTEND
// =========================================================================
function getMasterDataForFrontend() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    
    // Master Dealer
    const dealerSheet = ss.getSheetByName(CONFIG.SHEETS.DEALER || "M_DEALER") || ss.getSheetByName("DEALER") || ss.getSheetByName("MITRA");
    const dealerRows = dealerSheet ? dealerSheet.getDataRange().getValues() : [];
    const dealers = [];
    if (dealerRows.length > 1) {
      const dHeaders = dealerRows[0].map(h => String(h).trim().toLowerCase());
      const idxDId = dHeaders.findIndex(h => h === "dealer_id" || h === "id_dealer" || h === "id_mitra" || h === "id" || (h.includes("id") && !h.includes("nama") && !h.includes("owner")));
      const idxDName = dHeaders.findIndex(h => (h === "dealer_name" || h === "nama_dealer" || h === "nama_showroom" || h === "nama_mitra" || h.includes("nama") || h === "dealer" || h === "mitra" || h === "showroom") && !h.includes("id") && !h.includes("owner"));
      const idxOwner = dHeaders.findIndex(h => h.includes("owner") || h.includes("pemilik"));
      const idxCabang = dHeaders.findIndex(h => h.includes("cabang") || h.includes("branch"));
      const idxAreaCover = dHeaders.findIndex(h => h.includes("area_cover") || h.includes("area"));
      const idxProd = dHeaders.findIndex(h => h.includes("productivity") || h.includes("prod"));
      const idxStatus = dHeaders.findIndex(h => h.includes("status"));
      const idxTglKerjasama = dHeaders.findIndex(h => h.includes("tanggal_kerjasama") || h.includes("tgl_kerjasama") || h.includes("kerjasama"));
      const idxLastVisit = dHeaders.findIndex(h => h.includes("last_visit") || h.includes("kunjungan_terakhir"));
      const idxAging = dHeaders.findIndex(h => h.includes("aging_visit") || h.includes("aging"));
      const idxUrgentUnits = dHeaders.findIndex(h => h.includes("urgent_units"));
      const idxPrioLevel = dHeaders.findIndex(h => h.includes("priority_level") || h.includes("level"));
      const idxPrioScore = dHeaders.findIndex(h => h.includes("priority_score") || h.includes("score"));
      const idxPrioReason = dHeaders.findIndex(h => h.includes("priority_reason") || h.includes("alasan"));

      for (let i = 1; i < dealerRows.length; i++) {
        const row = dealerRows[i];
        const idVal = String(row[idxDId !== -1 ? idxDId : 0] || `D-${i}`).trim();
        const nameVal = String(row[idxDName !== -1 ? idxDName : (idxDId !== 0 ? 0 : 1)] || "").trim();
        if (!nameVal && !idVal) continue;

        dealers.push({
          dealer_id: idVal || `D-${i}`,
          dealer_name: nameVal || idVal,
          owner_name: String(idxOwner !== -1 ? row[idxOwner] : ""),
          cabang: String(idxCabang !== -1 ? row[idxCabang] : ""),
          area_cover: String(idxAreaCover !== -1 ? row[idxAreaCover] : ""),
          productivity: String(idxProd !== -1 ? row[idxProd] : "Active"),
          status: String(idxStatus !== -1 ? row[idxStatus] : "ACTIVE"),
          tanggal_kerjasama: String(idxTglKerjasama !== -1 ? row[idxTglKerjasama] : ""),
          last_visit_date: String(idxLastVisit !== -1 ? row[idxLastVisit] : ""),
          aging_visit_mitra: Number(idxAging !== -1 ? row[idxAging] : 0) || 0,
          urgent_units_count: Number(idxUrgentUnits !== -1 ? row[idxUrgentUnits] : 0) || 0,
          priority_level: String(idxPrioLevel !== -1 ? row[idxPrioLevel] || "Normal" : "Normal"),
          priority_score: Number(idxPrioScore !== -1 ? row[idxPrioScore] : 0) || 0,
          priority_reason: String(idxPrioReason !== -1 ? row[idxPrioReason] || "-" : "-")
        });
      }
    }

    // Master Unit Fasilitas
    const facSheet = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT") || ss.getSheetByName("FACILITY_UNIT") || ss.getSheetByName("UNIT");
    const facRows = facSheet ? facSheet.getDataRange().getValues() : [];
    const units = [];
    if (facRows.length > 1) {
      const uHeaders = facRows[0].map(h => String(h).trim().toLowerCase());
      const idxNoFas = uHeaders.findIndex(h => h.includes("fasilitas") || h.includes("facility") || h.includes("kontrak"));
      const idxDlrName = uHeaders.findIndex(h => h.includes("dealer") || h.includes("mitra") || h.includes("showroom"));
      const idxNopol = uHeaders.findIndex(h => h.includes("nopol") || h.includes("polisi") || h.includes("plat"));
      const idxUnit = uHeaders.findIndex(h => h.includes("unit") || h.includes("kendaraan") || h.includes("tipe"));
      const idxContract = uHeaders.findIndex(h => h.includes("contract") || h.includes("status_kontrak") || h.includes("status_fasilitas") || h.includes("status"));
      const idxJto = uHeaders.findIndex(h => h.includes("jto") || h.includes("jatuh_tempo"));
      const idxOverdue = uHeaders.findIndex(h => h.includes("overdue") || h.includes("ovd"));
      const idxLifetime = uHeaders.findIndex(h => h.includes("lifetime") || h.includes("umur"));
      const idxImei = uHeaders.findIndex(h => h.includes("imei") || h.includes("gps_imei"));
      const idxGpsStatus = uHeaders.findIndex(h => h.includes("gps_status") || h.includes("status_gps"));
      const idxLastVisitUnit = uHeaders.findIndex(h => h.includes("last_visit") || h.includes("visit"));
      const idxAgingUnit = uHeaders.findIndex(h => h.includes("aging"));

      for (let i = 1; i < facRows.length; i++) {
        const row = facRows[i];
        const fasVal = String(row[idxNoFas !== -1 ? idxNoFas : 0] || "").trim();
        const dNameVal = String(row[idxDlrName !== -1 ? idxDlrName : 1] || "").trim();
        if (!fasVal && !dNameVal) continue;

        units.push({
          no_fasilitas: fasVal,
          dealer_name: dNameVal,
          nopol: String(row[idxNopol !== -1 ? idxNopol : 2] || ""),
          unit: String(row[idxUnit !== -1 ? idxUnit : 3] || ""),
          contract_status: String(row[idxContract !== -1 ? idxContract : 4] || "LIVE"),
          jto_date: String(idxJto !== -1 ? row[idxJto] : ""),
          overdue_days: Number(idxOverdue !== -1 ? row[idxOverdue] : 0) || 0,
          lifetime_days: Number(idxLifetime !== -1 ? row[idxLifetime] : 0) || 0,
          imei_gps: String(idxImei !== -1 ? row[idxImei] : ""),
          gps_status: String(idxGpsStatus !== -1 ? row[idxGpsStatus] || "Normal" : "Normal"),
          last_visit_date: String(idxLastVisitUnit !== -1 ? row[idxLastVisitUnit] : ""),
          aging_visit_unit: Number(idxAgingUnit !== -1 ? row[idxAgingUnit] : 0) || 0
        });
      }
    }

    // Stok GPS Idle
    const devSheet = ss.getSheetByName(CONFIG.SHEETS.GPS_DEVICE || "M_GPS_DEVICE");
    const devRows = devSheet ? devSheet.getDataRange().getValues() : [];
    const idleGps = [];
    if (devRows.length > 1) {
      const gHeaders = devRows[0].map(h => String(h).trim().toLowerCase());
      const idxGImei = gHeaders.findIndex(h => h.includes("imei"));
      const idxGStatus = gHeaders.findIndex(h => h.includes("status"));
      const idxGPos = gHeaders.findIndex(h => h.includes("posisi") || h.includes("stock") || h.includes("cabang") || h.includes("lokasi") || h.includes("tipe"));

      for (let i = 1; i < devRows.length; i++) {
        const gRow = devRows[i];
        const imeiVal = String(gRow[idxGImei !== -1 ? idxGImei : 0] || "").trim();
        const stVal = String(gRow[idxGStatus !== -1 ? idxGStatus : 1] || "").trim().toUpperCase();
        const posVal = String(gRow[idxGPos !== -1 ? idxGPos : 2] || "Stok Cabang").trim();

        if (imeiVal && (stVal.includes("TERSEDIA") || stVal.includes("READY") || stVal.includes("IDLE") || stVal.includes("STOK"))) {
          idleGps.push({
            imei: imeiVal,
            tipe: posVal || "Stok Cabang",
            status_device: stVal,
            posisi_stock: posVal || "Stok Cabang"
          });
        }
      }
    }

    // Open Assignments
    const assignSheet = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT || "T_ASSIGNMENT");
    const assignRows = assignSheet ? assignSheet.getDataRange().getValues() : [];
    const assignments = [];
    if (assignRows.length > 1) {
      const aHeaders = assignRows[0].map(h => String(h).trim().toLowerCase());
      const idxAId = aHeaders.findIndex(h => h.includes("assignment_id") || h.includes("id"));
      const idxATime = aHeaders.findIndex(h => h.includes("created_at") || h.includes("timestamp") || h.includes("tanggal"));
      const idxASpv = aHeaders.findIndex(h => h.includes("supervisor") || h.includes("assigned_by"));
      const idxADlr = aHeaders.findIndex(h => h.includes("dealer") || h.includes("mitra"));
      const idxAUnit = aHeaders.findIndex(h => h.includes("unit") || h.includes("fasilitas"));
      const idxAUrg = aHeaders.findIndex(h => h.includes("urgency") || h.includes("urgensi") || h.includes("prioritas"));
      const idxAInst = aHeaders.findIndex(h => h.includes("instruksi") || h.includes("catatan") || h.includes("note"));
      const idxAStatus = aHeaders.findIndex(h => h.includes("status"));

      for (let i = 1; i < assignRows.length; i++) {
        const aRow = assignRows[i];
        const st = String(aRow[idxAStatus !== -1 ? idxAStatus : 8] || "OPEN").trim().toUpperCase();
        if (st !== "RESOLVED" && st !== "SELESAI" && st !== "CLOSED") {
          assignments.push({
            assignment_id: String(aRow[idxAId !== -1 ? idxAId : 0] || ""),
            created_at: String(aRow[idxATime !== -1 ? idxATime : 1] || ""),
            supervisor_nip: String(aRow[idxASpv !== -1 ? idxASpv : 2] || ""),
            dealer_name: String(aRow[idxADlr !== -1 ? idxADlr : 4] || ""),
            unit_fasilitas: String(aRow[idxAUnit !== -1 ? idxAUnit : 5] || "Umum"),
            urgency_level: String(aRow[idxAUrg !== -1 ? idxAUrg : 6] || "Penting"),
            instruksi: String(aRow[idxAInst !== -1 ? idxAInst : 7] || "-"),
            status: st
          });
        }
      }
    }

    // Master Work Locations (Geofence Kantor)
    const locSheet = ss.getSheetByName(CONFIG.SHEETS.WORK_LOCATION || "M_WORK_LOCATION") || ss.getSheetByName("WORK_LOCATION") || ss.getSheetByName("LOKASI");
    const locRows = locSheet ? locSheet.getDataRange().getValues() : [];
    const workLocations = [];
    if (locRows.length > 1) {
      const lHeaders = locRows[0].map(h => String(h).trim().toLowerCase());
      const idxLId = lHeaders.findIndex(h => h.includes("location_id") || h.includes("id"));
      const idxLName = lHeaders.findIndex(h => h.includes("location_name") || h.includes("nama") || h.includes("name"));
      const idxLat = lHeaders.findIndex(h => h.includes("latitude") || h.includes("lat"));
      const idxLong = lHeaders.findIndex(h => h.includes("longitude") || h.includes("long") || h.includes("lng"));
      const idxRadius = lHeaders.findIndex(h => h.includes("radius"));
      const idxAddress = lHeaders.findIndex(h => h.includes("address") || h.includes("alamat"));

      for (let i = 1; i < locRows.length; i++) {
        const lRow = locRows[i];
        const nameVal = String(lRow[idxLName !== -1 ? idxLName : 1] || "").trim();
        const rawLat = String(lRow[idxLat !== -1 ? idxLat : 2] || "").replace(",", ".");
        const rawLong = String(lRow[idxLong !== -1 ? idxLong : 3] || "").replace(",", ".");
        const latVal = parseFloat(rawLat);
        const longVal = parseFloat(rawLong);
        const radiusVal = Number(lRow[idxRadius !== -1 ? idxRadius : 4]) || 100;
        const addrVal = String(idxAddress !== -1 ? lRow[idxAddress] : "");

        if (nameVal && !isNaN(latVal) && !isNaN(longVal)) {
          workLocations.push({
            location_id: String(lRow[idxLId !== -1 ? idxLId : 0] || `LOC-${i}`),
            name: nameVal,
            lat: latVal,
            long: longVal,
            maxRadiusMeter: radiusVal,
            address: addrVal
          });
        }
      }
    }

    return {
      success: true,
      dealers: dealers,
      units: units,
      idleGps: idleGps,
      assignments: assignments,
      workLocations: workLocations
    };
  } catch (err) {
    return { success: false, message: "Gagal mengambil data master: " + err.toString() };
  }
}
