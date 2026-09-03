/**
 * 01_ApiRouter.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Router Utama Web App (doGet & doPost)
 */

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "Digiasha Field Monitoring API",
    version: "2.0",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const rawContent = e.postData.contents;
    const body = JSON.parse(rawContent);
    const action = body.action;

    let result = { success: false, message: "Action tidak dikenali." };

    switch (action) {
      case "login":
        result = handleLogin(body.identifier, body.password);
        break;

      case "getMasterData":
        result = handleGetMasterData();
        break;

      case "submitVisit":
        result = handleSubmitVisit(body);
        break;

      case "submitGpsMaintenance":
        result = handleSubmitGpsMaintenance(body);
        break;

      case "submitOnboarding":
        result = handleSubmitOnboarding(body);
        break;

      case "submitFacGpsReport":
        result = handleSubmitFacGpsReport(body);
        break;

      case "saveAssignment":
        result = handleSaveAssignment(body);
        break;

      case "runPrioritySyncNow":
        dailyPrioritySyncJob();
        result = { success: true, message: "Sinkronisasi kalkulasi prioritas berhasil dijalankan!" };
        break;

      default:
        result = { success: false, message: "Action '" + action + "' tidak didukung." };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("API Error: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Internal Server Error: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
