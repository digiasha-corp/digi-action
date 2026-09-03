/**
 * 03_DriveUpload.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Layanan Penyimpanan Foto / Dokumen Langsung ke Google Drive Resmi
 */

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
