/**
 * 04_Transactions.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Handler Transaksi Lapangan (100% Flat Tabular Storage untuk Looker Studio)
 */

// =========================================================================
// 1. VISIT SHOWROOM & DETAIL CHECKLIST UNIT
// =========================================================================
function submitLaporanVisitServer(headerData, unitCheckList, currentUser) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    const visitSheet = getSheet(CONFIG.SHEETS.VISIT_HEADER || "TR_LAPORAN_VISIT");
    const unitCheckSheet = getSheet(CONFIG.SHEETS.VISIT_UNIT || "TR_VISIT_UNIT_CHECK");
    const dealerSheet = getSheet(CONFIG.SHEETS.DEALER || "M_DEALER");
    const facSheet = getSheet(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT");

    const now = new Date();
    const timestampStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    const dateTodayStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");

    const visitId = "VST-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd") + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();

    // 1. Simpan Header Visit
    const totalUnits = (unitCheckList && unitCheckList.length) ? unitCheckList.length : 0;
    visitSheet.appendRow([
      visitId,
      timestampStr,
      currentUser ? (currentUser.nip || currentUser.email) : (headerData.nip || "PIC-FIELD"),
      headerData.dealer_name || "",
      headerData.lokasi || "Showroom",
      headerData.bertemu_owner || "Ya",
      headerData.owner_reason || "",
      Number(headerData.stock || 0),
      Number(headerData.sales || 0),
      headerData.issue_digi || "",
      headerData.issue_internal || "",
      headerData.issue_komp || "",
      totalUnits,
      headerData.catatan_visit || "",
      Number(headerData.lat || 0),
      Number(headerData.long || 0),
      headerData.showroom_photo_url || "",
      headerData.tindak_lanjut_concern || "-"
    ]);

    // 2. Simpan Detail Unit (Flat Rows - 1 Baris Per Unit)
    const validSeenUnitsNopol = new Set();
    if (unitCheckList && unitCheckList.length > 0) {
      const unitRows = [];
      unitCheckList.forEach((u, idx) => {
        const checkId = "CHK-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd") + "-" + String(idx + 1).padStart(3, '0');
        const statusKeberadaan = String(u.terlihat || u.status_keberadaan || "Ada di Showroom").trim();

        unitRows.push([
          checkId,
          visitId,
          timestampStr,
          headerData.dealer_name || "",
          u.no_fasilitas || "",
          u.nopol || "",
          u.unit || u.unit_desc || "",
          statusKeberadaan,
          u.kondisi_unit || (u.terlihat === "Ya" ? "Terlihat Fisik" : (u.indikasi || "Tidak Terlihat")),
          u.odometer || "-",
          u.catatan_unit || (u.info_unit ? u.info_unit.join(", ") : "")
        ]);

        if (statusKeberadaan.toLowerCase() === "ya" || statusKeberadaan.toLowerCase() === "ada di showroom" || statusKeberadaan.toLowerCase() === "terlihat") {
          validSeenUnitsNopol.add(String(u.nopol || "").trim().toUpperCase());
        }
      });

      if (unitRows.length > 0) {
        unitCheckSheet.getRange(unitCheckSheet.getLastRow() + 1, 1, unitRows.length, unitRows[0].length).setValues(unitRows);
      }
    }

    const targetDealerName = String(headerData.dealer_name || "").trim().toLowerCase();

    // 2.5 Auto-Resolve Assignment Terbuka di T_ASSIGNMENT untuk Dealer Tersebut
    const assignSheet = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT || "T_ASSIGNMENT");
    if (assignSheet) {
      const assignData = assignSheet.getDataRange().getValues();
      for (let a = 1; a < assignData.length; a++) {
        const aDealer = String(assignData[a][4] || "").trim().toLowerCase();
        const aStatus = String(assignData[a][8] || "").trim().toUpperCase();
        if (aDealer === targetDealerName && aStatus !== "RESOLVED") {
          const rowIdx = a + 1;
          assignSheet.getRange(rowIdx, 9).setValue("RESOLVED");
          assignSheet.getRange(rowIdx, 10).setValue(timestampStr);
          assignSheet.getRange(rowIdx, 11).setValue(currentUser ? (currentUser.nip || currentUser.email) : (headerData.nip || "PIC-FIELD"));
        }
      }
    }

    // 3. Update Status Kunjungan di M_DEALER
    const isAtShowroom = String(headerData.lokasi || "").trim().toLowerCase() === "showroom";
    const isMetOwner = String(headerData.bertemu_owner || "").trim().toLowerCase() === "ya";
    if (isAtShowroom || isMetOwner) {
      const dealerData = dealerSheet.getDataRange().getValues();
      for (let i = 1; i < dealerData.length; i++) {
        const dName = String(dealerData[i][1] || "").trim().toLowerCase();
        if (dName === targetDealerName) {
          const rowIdx = i + 1;
          dealerSheet.getRange(rowIdx, 8).setValue(dateTodayStr); // last_visit_date
          dealerSheet.getRange(rowIdx, 9).setValue(0);            // aging_visit_mitra
          if (dealerData[0].length >= 13) {
            dealerSheet.getRange(rowIdx, 10).setValue(0);         // urgent_units_count
            dealerSheet.getRange(rowIdx, 11).setValue("Normal");  // priority_level
            dealerSheet.getRange(rowIdx, 12).setValue(0);         // priority_score
            dealerSheet.getRange(rowIdx, 13).setValue("Selesai Dikunjungi Hari Ini"); // priority_reason
          }
          break;
        }
      }
    }

    // 4. Update Status Kunjungan di M_FACILITY_UNIT
    if (validSeenUnitsNopol.size > 0) {
      const facData = facSheet.getDataRange().getValues();
      for (let i = 1; i < facData.length; i++) {
        const nopol = String(facData[i][2] || "").trim().toUpperCase();
        if (validSeenUnitsNopol.has(nopol)) {
          const rowIdx = i + 1;
          facSheet.getRange(rowIdx, 11).setValue(dateTodayStr);
          facSheet.getRange(rowIdx, 12).setValue(0);
        }
      }
    }

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(currentUser ? currentUser.email : "PIC", "SUBMIT_VISIT", `Visit ${headerData.dealer_name} (ID: ${visitId})`, "Web App");
    }

    return { success: true, visit_id: visitId, message: "Laporan visit berhasil disimpan!" };
  } catch (err) {
    Logger.log("Error submitLaporanVisitServer: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// Alias Handler Visit
function handleSubmitVisit(data) {
  let photoUrl = "";
  if (data.showroom_photo_base64 && typeof uploadVisitPhoto === "function") {
    const upRes = uploadVisitPhoto(data.dealer_name || "MITRA", "SHOWROOM", data.showroom_photo_base64);
    if (upRes && upRes.success) photoUrl = upRes.url;
  }
  data.showroom_photo_url = photoUrl;
  return submitLaporanVisitServer(data, data.unit_check_list || [], data.currentUser);
}

// =========================================================================
// 2. GPS MAINTENANCE (PASANG / GANTI / CABUT)
// =========================================================================
function submitGpsMaintenanceServer(data, currentUser) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    const maintSheet = getSheet(CONFIG.SHEETS.GPS_MAINTENANCE || "TR_GPS_MAINTENANCE");
    const facSheet = getSheet(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT");
    const devSheet = getSheet(CONFIG.SHEETS.GPS_DEVICE || "M_GPS_DEVICE");

    const now = new Date();
    const timestampStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
    const maintId = "MNT-" + Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd") + "-" + Utilities.getUuid().slice(0, 6).toUpperCase();

    const aktivitas = String(data.act_type || data.aktivitas || "Pasang Baru").trim();
    const targetNopol = String(data.nopol || "").trim().toUpperCase();
    const imeiBaru = String(data.imei_baru || "").trim();
    const imeiLama = String(data.imei_lama || "").trim();
    const picName = currentUser ? (currentUser.nama || currentUser.email) : "PIC Lapangan";

    maintSheet.appendRow([
      maintId,
      timestampStr,
      currentUser ? (currentUser.nip || currentUser.email) : (data.nip || "PIC-FIELD"),
      data.dealer_name || "",
      data.no_fasilitas || "",
      targetNopol,
      aktivitas,
      imeiLama,
      imeiBaru,
      data.foto_imei_lama_url || "",
      data.foto_imei_baru_url || "",
      data.foto_posisi_gps_url || "",
      data.catatan_teknis || data.catatan || "",
      Number(data.lat || 0),
      Number(data.long || 0)
    ]);

    // Update M_FACILITY_UNIT (Prioritaskan no_fasilitas, lalu fallback nopol)
    const facData = facSheet.getDataRange().getValues();
    const targetFasilitas = String(data.no_fasilitas || "").trim().toUpperCase();

    for (let i = 1; i < facData.length; i++) {
      const dbFasilitas = String(facData[i][0] || "").trim().toUpperCase();
      const dbNopol = String(facData[i][2] || "").trim().toUpperCase();

      const isMatch = targetFasilitas ? (dbFasilitas === targetFasilitas) : (dbNopol === targetNopol);
      if (isMatch) {
        const rowIdx = i + 1;
        if (aktivitas === "Cabut GPS") {
          facSheet.getRange(rowIdx, 9).setValue("");
          facSheet.getRange(rowIdx, 10).setValue("Tidak Pasang");
        } else {
          facSheet.getRange(rowIdx, 9).setValue(imeiBaru);
          facSheet.getRange(rowIdx, 10).setValue("Normal");
        }
        break;
      }
    }

    // Update M_GPS_DEVICE
    if (devSheet) {
      const devData = devSheet.getDataRange().getValues();
      if (imeiBaru && (aktivitas === "Pasang Baru" || aktivitas === "Pasang GPS" || aktivitas === "Ganti GPS")) {
        let found = false;
        for (let j = 1; j < devData.length; j++) {
          if (String(devData[j][0] || "").trim() === imeiBaru) {
            devSheet.getRange(j + 1, 2).setValue("Terpasang");
            devSheet.getRange(j + 1, 3).setValue(`Terpasang di ${targetNopol}`);
            found = true;
            break;
          }
        }
        if (!found) devSheet.appendRow([imeiBaru, "Terpasang", `Terpasang di ${targetNopol}`]);
      }

      if (imeiLama && (aktivitas === "Cabut GPS" || aktivitas === "Ganti GPS")) {
        for (let k = 1; k < devData.length; k++) {
          if (String(devData[k][0] || "").trim() === imeiLama) {
            // Karena GPS Portable, unit lama yang ditarik/swap kembali berstatus TERSEDIA (untuk dicas & rotasi)
            devSheet.getRange(k + 1, 2).setValue("TERSEDIA");
            break;
          }
        }
      }
    }

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(currentUser ? currentUser.email : "PIC", "GPS_MAINTENANCE", `${aktivitas} - ${targetNopol}`, "Web App");
    }

    return { success: true, maint_id: maintId, message: "Maintenance GPS berhasil disimpan!" };
  } catch (err) {
    Logger.log("Error submitGpsMaintenanceServer: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// Alias Handler GPS
function handleSubmitGpsMaintenance(data) {
  return submitGpsMaintenanceServer(data, data.currentUser);
}

// =========================================================================
// 3. ONBOARDING CALON MITRA
// =========================================================================
function saveOnboardingData(payload) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.ONBOARDING || "TR_ONBOARDING_LOG");
    const onbId = "ONB-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss");
    const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    let docStr = payload.dokumen_list || "";
    if (Array.isArray(docStr)) docStr = docStr.join(", ");

    sheet.appendRow([
      onbId,
      timestamp,
      payload.userId || payload.nip || "PIC-FIELD",
      payload.aktivitas || "Onboarding Baru",
      payload.status_db || "Prospek",
      payload.nama_pemohon || "",
      payload.nama_usaha || "",
      payload.alamat || "",
      payload.jenis_usaha || "",
      payload.detail_usaha || "",
      docStr,
      payload.catatan_hasil || payload.catatan || "",
      Number(payload.lat || 0),
      Number(payload.long || 0),
      payload.selfie_photo_url || payload.selfie_url || ""
    ]);

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(payload.userId || payload.nip, "SUBMIT_ONBOARDING", `Onboarding: ${payload.nama_usaha}`, "Web App");
    }

    return { success: true, onbId: onbId, message: "Data onboarding berhasil disimpan!" };
  } catch (e) {
    Logger.log("Error saveOnboardingData: " + e.toString());
    return { success: false, message: e.toString() };
  }
}

// Alias Handler Onboarding
function handleSubmitOnboarding(data) {
  return saveOnboardingData(data);
}

// =========================================================================
// 4. AUDIT FAC GPS REPORT
// =========================================================================
function submitFacGpsReportServer(reportList, userId) {
  try {
    if (!reportList || reportList.length === 0) return { success: false, message: "Data audit kosong." };

    const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID || SPREADSHEET_DB_ID);
    const facLogSheet = getSheet(CONFIG.SHEETS.FAC_AUDIT || "TR_GPS_FAC_CHECK");
    const facUnitSheet = getSheet(CONFIG.SHEETS.FACILITY_UNIT || "M_FACILITY_UNIT");

    const now = new Date();
    const timestampStr = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    const CODE_TO_STATUS = {
      "1": "Tidak Pasang", "2": "Belum Lepas", "3": "Belum Pasang",
      "4": "Baterai Lemah", "5": "Geser", "6": "Pelepasan", "7": "Offline"
    };

    const logRows = [];
    const statusUpdateMapByNopol = {};

    reportList.forEach(item => {
      let extractedNopol = item.nopol || "";
      if (!extractedNopol && item.asset_desc) {
        const match = item.asset_desc.match(/\(([^/]+)\//);
        if (match && match[1]) extractedNopol = match[1].trim();
      }

      let statusStr = "Normal";
      if (item.status_codes && item.status_codes.length > 0) {
        statusStr = item.status_codes.map(c => CODE_TO_STATUS[c] || c).join(", ");
      }

      const checkId = "CHK-" + Utilities.getUuid().slice(0, 8).toUpperCase();
      const noFasilitas = String(item.no_fasilitas || item.facility_no || "").trim();
      const imei = String(item.imei || "-").trim();
      const catatan = String(item.catatan || item.keterangan || "").trim();

      logRows.push([
        checkId,
        timestampStr,
        userId || "FAC-OFFICER",
        noFasilitas,
        imei,
        statusStr,
        catatan
      ]);

      if (extractedNopol) statusUpdateMapByNopol[extractedNopol.toUpperCase()] = statusStr;
      if (noFasilitas) statusUpdateMapByNopol[noFasilitas.toUpperCase()] = statusStr;
    });

    if (logRows.length > 0) {
      facLogSheet.getRange(facLogSheet.getLastRow() + 1, 1, logRows.length, logRows[0].length).setValues(logRows);
    }

    const unitValues = facUnitSheet.getDataRange().getValues();
    let updatedUnitsCount = 0;
    for (let r = 1; r < unitValues.length; r++) {
      const fasInDb = String(unitValues[r][0] || "").trim().toUpperCase();
      const nopolInDb = String(unitValues[r][2] || "").trim().toUpperCase();
      if ((nopolInDb && statusUpdateMapByNopol[nopolInDb]) || (fasInDb && statusUpdateMapByNopol[fasInDb])) {
        const newStatus = statusUpdateMapByNopol[nopolInDb] || statusUpdateMapByNopol[fasInDb];
        facUnitSheet.getRange(r + 1, 10).setValue(newStatus);
        updatedUnitsCount++;
      }
    }

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(userId || "FAC", "SUBMIT_FAC_GPS_REPORT", `Audit ${logRows.length} Unit GPS`, "Web App");
    }

    return { success: true, message: `Audit GPS berhasil disimpan (${updatedUnitsCount} unit terupdate)!` };
  } catch (err) {
    Logger.log("Error submitFacGpsReportServer: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// Alias Handler FAC
function handleSubmitFacGpsReport(data) {
  return submitFacGpsReportServer(data.reportList || [], data.userId);
}

// =========================================================================
// 5. PENUGASAN CONCERN / ASSIGNMENT
// =========================================================================
function saveAssignmentData(payload) {
  try {
    const sheet = getSheet(CONFIG.SHEETS.ASSIGNMENT || "T_ASSIGNMENT");
    const assignId = "ASN-" + Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd-HHmmss");
    const timestamp = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([
      assignId,
      timestamp,
      payload.assignedByUserId || "ADM",
      payload.assignedByUserName || "Supervisor",
      payload.dealerName || "",
      payload.unitFasilitas || "Umum (Seluruh Showroom)",
      payload.concernType || "Assign Concern",
      payload.urgencyLevel || "Penting",
      payload.instruksi || "-",
      "OPEN"
    ]);

    if (typeof recordAuditTrail === "function") {
      recordAuditTrail(payload.assignedByUserId, "CREATE_ASSIGNMENT", `Assign Concern: ${payload.dealerName}`, "Web App");
    }

    return { success: true, assignId: assignId, message: "Assign Concern berhasil dikirimkan!" };
  } catch (e) {
    Logger.log("Error saveAssignmentData: " + e.toString());
    return { success: false, message: e.toString() };
  }
}

// Alias Handler Assignment
function handleSaveAssignment(data) {
  return saveAssignmentData(data);
}
