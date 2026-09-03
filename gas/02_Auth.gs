/**
 * 02_Auth.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Layanan Autentikasi Pengguna & Pengambilan Master Data
 */

function handleLogin(identifier, password) {
  if (!identifier || !password) {
    return { success: false, message: "Email/NIP dan Password wajib diisi." };
  }

  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEE);
  if (!sheet) return { success: false, message: "Sheet M_EMPLOYEE tidak ditemukan." };

  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const idxEmail = headers.indexOf("email");
  const idxNip = headers.indexOf("nip");
  const idxPass = headers.indexOf("password");
  const idxNama = headers.indexOf("nama_lengkap");
  const idxRole = headers.indexOf("role");
  const idxCabang = headers.indexOf("cabang");
  const idxStatus = headers.indexOf("status");

  const cleanId = String(identifier).trim().toLowerCase();
  const cleanPass = String(password).trim();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = String(row[idxEmail] || "").trim().toLowerCase();
    const nip = String(row[idxNip] || "").trim().toLowerCase();
    const pass = String(row[idxPass] || "").trim();
    const status = String(row[idxStatus] || "Active").trim().toLowerCase();

    if ((email === cleanId || nip === cleanId) && pass === cleanPass) {
      if (status === "inactive" || status === "non-active") {
        return { success: false, message: "Akun Anda berstatus non-aktif. Hubungi Administrator." };
      }

      return {
        success: true,
        user: {
          nip: row[idxNip] || "-",
          nama: row[idxNama] || "Karyawan Digiasha",
          email: row[idxEmail] || "",
          role: row[idxRole] || "Field PIC",
          cabang: row[idxCabang] || "Kantor Pusat"
        }
      };
    }
  }

  return { success: false, message: "Email/NIP atau kata sandi tidak sesuai." };
}

function handleGetMasterData() {
  const ss = SpreadsheetApp.openById(CONFIG.MAIN_SPREADSHEET_ID);

  const sheetDealer = ss.getSheetByName(CONFIG.SHEETS.DEALER);
  const sheetUnit = ss.getSheetByName(CONFIG.SHEETS.FACILITY_UNIT);
  const sheetGps = ss.getSheetByName(CONFIG.SHEETS.GPS_DEVICE);
  const sheetAssign = ss.getSheetByName(CONFIG.SHEETS.ASSIGNMENT);

  const dealers = sheetDealer ? getTableObjects(sheetDealer) : [];
  const units = sheetUnit ? getTableObjects(sheetUnit) : [];
  const gpsDevices = sheetGps ? getTableObjects(sheetGps) : [];
  const assignments = sheetAssign ? getTableObjects(sheetAssign).filter(a => String(a.status || "").toUpperCase() !== "RESOLVED") : [];

  const idleGps = gpsDevices.filter(g => String(g.status || "").toLowerCase().includes("idle") || String(g.status || "").toLowerCase().includes("ready")).map(g => ({
    imei: String(g.imei || ""),
    tipe: String(g.tipe_gps || g.tipe || "GPS Tracker")
  }));

  return {
    success: true,
    dealers: dealers,
    units: units,
    idleGps: idleGps,
    assignments: assignments
  };
}
