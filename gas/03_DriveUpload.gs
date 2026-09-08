/**
 * 03_DriveUpload.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Layanan Penyimpanan Foto / Dokumen Langsung ke Google Drive Resmi
 */

// =========================================================================
// 1. UPLOAD FOTO KUNJUNGAN / VISIT SHOWROOM & GPS
// =========================================================================
function uploadVisitPhoto(partnerName, photoType, base64Data) {
  try {
    if (!base64Data || base64Data.indexOf(",") === -1) {
      return { success: false, message: "Data base64 tidak valid." };
    }
    const folderId = (typeof FOLDER_ID_VISIT_FOTO !== "undefined" ? FOLDER_ID_VISIT_FOTO : null) || (CONFIG.DRIVE_FOLDERS && CONFIG.DRIVE_FOLDERS.VISIT_FOTO_ID) || "18VPAgr14_kkf3Y3nBBp9d-e4Vcn-fcDK";
    const targetFolder = DriveApp.getFolderById(folderId);
    const now = new Date();
    const timeFormatted = Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");
    
    const cleanPartner = String(partnerName).replace(/[/\\?%*:|"<>]/g, "");
    const cleanType = String(photoType).replace(/[/\\?%*:|"<>]/g, "");
    const finalFileName = cleanType + "-" + cleanPartner + "-" + timeFormatted + ".jpg";

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, finalFileName);

    const uploadedFile = targetFolder.createFile(blob);
    uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: uploadedFile.getUrl(), name: finalFileName };
  } catch (err) {
    Logger.log("Gagal Upload Visit Photo: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// 2. UPLOAD DOKUMEN & SELFIE ONBOARDING MITRA
// =========================================================================
function uploadOnboardingAttachment(folderName, docType, usahaName, base64Data, originalFileName, fileIndex) {
  try {
    if (!base64Data || base64Data.indexOf(",") === -1) {
      return { success: false, message: "Data base64 tidak valid." };
    }
    const parentFolderId = (typeof FOLDER_ID_ONBOARDING !== "undefined" ? FOLDER_ID_ONBOARDING : null) || (CONFIG.DRIVE_FOLDERS && CONFIG.DRIVE_FOLDERS.ONBOARDING_ID) || "1Damd9YO6LqJyxbTZMxz_UZDWWuOU7AvJ";
    const parentFolder = DriveApp.getFolderById(parentFolderId);
    let targetFolder;
    const folders = parentFolder.getFoldersByName(folderName);
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = parentFolder.createFolder(folderName);
    }

    const now = new Date();
    const timeFormatted = Utilities.formatDate(now, "Asia/Jakarta", "yyyyMMdd-HHmmss");

    let ext = "jpg";
    if (originalFileName && originalFileName.indexOf(".") !== -1) {
      ext = originalFileName.split('.').pop().toLowerCase();
    }

    const cleanUsaha = String(usahaName).replace(/[/\\?%*:|"<>]/g, "");
    const cleanDoc = String(docType).replace(/[/\\?%*:|"<>]/g, "");
    const suffixIndex = fileIndex ? ("-" + fileIndex) : "";
    const finalFileName = cleanDoc + "-" + cleanUsaha + "-" + timeFormatted + suffixIndex + "." + ext;

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.split(',')[1]);
    const blob = Utilities.newBlob(bytes, contentType, finalFileName);

    const uploadedFile = targetFolder.createFile(blob);
    uploadedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: uploadedFile.getUrl(), name: finalFileName };
  } catch (err) {
    Logger.log("Gagal Upload Onboarding Attachment: " + err.toString());
    return { success: false, message: err.toString() };
  }
}

// =========================================================================
// 3. UPLOAD SELFIE ABSENSI PRESENSI KARYAWAN
// =========================================================================
function uploadAbsensiSelfie(userId, base64Data) {
  if (!base64Data || typeof base64Data !== "string" || base64Data.length < 20) return "";

  try {
    const folderId = (typeof FOLDER_ID_ABSENSI !== "undefined" ? FOLDER_ID_ABSENSI : null) || (CONFIG.DRIVE_FOLDERS && CONFIG.DRIVE_FOLDERS.ABSENSI_ID) || "1O3fuqC9zIv6zlIqkH76ae3shMOKodCUV";
    const folder = DriveApp.getFolderById(folderId);
    let rawBase64 = base64Data;
    let contentType = "image/jpeg";

    if (base64Data.indexOf("data:") === 0) {
      const parts = base64Data.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) contentType = mimeMatch[1];
      rawBase64 = parts[1];
    }

    const decoded = Utilities.base64Decode(rawBase64);
    const dateStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd");
    const cleanUserId = String(userId || "USER").replace(/[^a-zA-Z0-9]/g, '');
    
    // Format nama file: Userid-YYYYMMDD.jpg (Contoh: 4250001-20260904.jpg)
    const ext = contentType.indexOf("png") !== -1 ? ".png" : ".jpg";
    const filename = cleanUserId + "-" + dateStr + ext;

    const blob = Utilities.newBlob(decoded, contentType, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (err) {
    Logger.log("Gagal Upload Selfie Absensi ke Drive: " + err.toString());
    return "";
  }
}

// =========================================================================
// 4. HELPER UMUM BASE64 KE DRIVE
// =========================================================================
function uploadBase64ToDrive(base64Data, folderId, fileNamePrefix) {
  if (!base64Data || typeof base64Data !== "string") return "";

  try {
    const folder = DriveApp.getFolderById(folderId);
    let rawBase64 = base64Data;
    let contentType = "image/jpeg";

    if (base64Data.indexOf("data:") === 0) {
      const parts = base64Data.split(",");
      const mimeMatch = parts[0].match(/:(.*?);/);
      if (mimeMatch) contentType = mimeMatch[1];
      rawBase64 = parts[1];
    }

    const decoded = Utilities.base64Decode(rawBase64);
    const nowStr = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyyMMdd_HHmmss");
    const ext = contentType.indexOf("png") !== -1 ? ".png" : ".jpg";
    const filename = (fileNamePrefix || "UPLOAD") + "_" + nowStr + "_" + Math.floor(Math.random() * 1000) + ext;

    const blob = Utilities.newBlob(decoded, contentType, filename);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  } catch (err) {
    Logger.log("Gagal Upload Foto ke Drive: " + err.toString());
    return "";
  }
}
