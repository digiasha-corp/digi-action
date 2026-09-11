/**
 * 02_Auth.gs - DIGIASHA FIELD MONITORING SYSTEM
 * Layanan Autentikasi Pengguna & Pengambilan Master Data
 */

function handleLogin(identifier, password) {
  try {
    if (!identifier || !password) {
      return { success: false, message: "Email/NIP dan Password wajib diisi." };
    }

    const ssId = (typeof CONFIG !== "undefined" && CONFIG.MAIN_SPREADSHEET_ID) || (typeof SPREADSHEET_DB_ID !== "undefined" ? SPREADSHEET_DB_ID : "1JbCMIePpNfPRfev7UIjyO763BfmJqzgtrLDMA0oFqVI");
    const ss = SpreadsheetApp.openById(ssId);
    
    // Cari sheet user (M_USERS, M_EMPLOYEE, USERS, EMPLOYEE)
    const empSheetName = (typeof CONFIG !== "undefined" && CONFIG.SHEETS && CONFIG.SHEETS.EMPLOYEE) || "M_EMPLOYEE";
    let sheetUser = ss.getSheetByName(empSheetName) || 
                   ss.getSheetByName("M_USERS") || 
                   ss.getSheetByName("USERS") || 
                   ss.getSheetByName("EMPLOYEE");
                   
    if (!sheetUser) return { success: false, message: "Sheet data user/karyawan tidak ditemukan di Spreadsheet." };

    const data = sheetUser.getDataRange().getValues();
    if (data.length < 2) return { success: false, message: "Data user masih kosong." };
  
  const headers = data[0].map(h => String(h).trim().toLowerCase());

  const idxNip = headers.findIndex(h => h === "nip" || h === "nik" || h === "user_id" || h === "userid" || (h.includes("nip") && !h.includes("atasan") && !h.includes("spv")));
  const idxEmail = headers.findIndex(h => h === "email" || h.includes("email") || h.includes("mail"));
  const idxPass = headers.findIndex(h => h === "password" || h === "password_hash" || h.includes("password") || h.includes("pass") || h.includes("sandi"));
  const idxNama = headers.findIndex(h => (h === "nama" || h === "nama_lengkap" || h.includes("nama") || h.includes("name")) && !h.includes("atasan") && !h.includes("spv"));
  const idxJabatan = headers.findIndex(h => h === "jabatan" || h.includes("jabatan") || h.includes("position") || h.includes("role_name"));
  const idxRole = headers.findIndex(h => h === "role_id" || h === "role" || (h.includes("role") && !h.includes("name")));
  const idxCabang = headers.findIndex(h => h.includes("branch") || h.includes("cabang"));
  const idxAreaCover = headers.findIndex(h => h.includes("area_cover") || h.includes("area"));
  const idxStatus = headers.findIndex(h => h.includes("status_aktif") || h === "status" || h.includes("status"));
  const idxAtasanNip = headers.findIndex(h => h === "atasan_nip" || h.includes("atasan_nip") || h.includes("spv_nip") || h.includes("pic_approval_nip") || (h.includes("atasan") && h.includes("nip")));
  const idxAtasanNama = headers.findIndex(h => h === "atasan_nama" || h.includes("atasan_nama") || h.includes("nama_atasan") || h.includes("spv_nama") || h.includes("pic_approval_nama") || (h.includes("atasan") && (h.includes("nama") || h.includes("name"))));

  const cleanId = String(identifier).trim().toLowerCase();
  const cleanPass = String(password).trim();

  // Load Master Roles jika ada sheet M_ROLES / ROLES
  let sheetRoles = ss.getSheetByName("M_ROLES") || ss.getSheetByName("ROLES") || ss.getSheetByName("ROLE");
  let rolesMap = {};
  if (sheetRoles) {
    const roleData = sheetRoles.getDataRange().getValues();
    if (roleData.length > 1) {
      const rHeaders = roleData[0].map(h => String(h).trim().toLowerCase());
      const rIdxId = rHeaders.findIndex(h => h.includes("role_id") || h === "id");
      const rIdxName = rHeaders.findIndex(h => h.includes("role_name") || h.includes("nama") || h.includes("name"));
      const rIdxPerms = rHeaders.findIndex(h => h.includes("permission") || h.includes("akses"));

      for (let r = 1; r < roleData.length; r++) {
        const rRow = roleData[r];
        const rId = String(rRow[rIdxId !== -1 ? rIdxId : 0] || "").trim();
        const rName = String(rRow[rIdxName !== -1 ? rIdxName : 1] || "").trim();
        let rPerms = [];
        if (rIdxPerms !== -1 && rRow[rIdxPerms]) {
          try {
            rPerms = typeof rRow[rIdxPerms] === "string" && rRow[rIdxPerms].startsWith("[") ? JSON.parse(rRow[rIdxPerms]) : String(rRow[rIdxPerms]).split(",").map(p => p.trim());
          } catch(e) {
            rPerms = String(rRow[rIdxPerms]).replace(/[\[\]"]/g, "").split(",").map(p => p.trim());
          }
        }
        if (rId) {
          rolesMap[rId] = { role_name: rName || rId, permissions: rPerms };
          if (rName) rolesMap[rName] = { role_name: rName, permissions: rPerms };
        }
      }
    }
  }

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const email = idxEmail !== -1 ? String(row[idxEmail] || "").trim().toLowerCase() : "";
    const nip = idxNip !== -1 ? String(row[idxNip] || "").trim().toLowerCase() : "";
    const pass = idxPass !== -1 ? String(row[idxPass] || "").trim() : "";
    const rawStatus = idxStatus !== -1 ? String(row[idxStatus] || "Active").trim().toLowerCase() : "active";

    const isNipMatch = (nip === cleanId) || (nip.replace(/^0+/, '') === cleanId.replace(/^0+/, '') && cleanId.length >= 4);
    const isEmailMatch = (email === cleanId);

    if ((isEmailMatch || isNipMatch) && pass === cleanPass) {
      if (rawStatus === "inactive" || rawStatus === "non-active" || rawStatus === "nonaktif" || rawStatus === "tidak aktif") {
        return { success: false, message: "Akun Anda berstatus non-aktif. Hubungi Administrator." };
      }

      const areaCoverVal = idxAreaCover !== -1 ? String(row[idxAreaCover] || "").trim() : "";
      const rawRoleId = idxRole !== -1 ? String(row[idxRole] || "").trim() : "";
      const jabatanVal = idxJabatan !== -1 ? String(row[idxJabatan] || "").trim() : "";
      const atasanNipVal = idxAtasanNip !== -1 ? String(row[idxAtasanNip] || "").trim() : "";
      const atasanNamaVal = idxAtasanNama !== -1 ? String(row[idxAtasanNama] || "").trim() : "";

      let resolvedRoleName = rawRoleId;
      let resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac", "persetujuan"];

      if (rolesMap[rawRoleId]) {
        resolvedRoleName = rolesMap[rawRoleId].role_name || rawRoleId;
        if (rolesMap[rawRoleId].permissions && rolesMap[rawRoleId].permissions.length > 0) {
          resolvedPerms = rolesMap[rawRoleId].permissions;
        }
      } else if (rawRoleId === "R-01" || rawRoleId.toLowerCase().includes("admin")) {
        resolvedRoleName = "Admin";
        resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac", "persetujuan"];
      } else if (rawRoleId === "R-02" || rawRoleId.toLowerCase().includes("branch manager") || rawRoleId.toLowerCase().includes("bm")) {
        resolvedRoleName = "Branch Manager";
        resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "persetujuan"];
      } else if (rawRoleId === "R-03" || rawRoleId.toLowerCase().includes("fac")) {
        resolvedRoleName = "FAC";
        resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac"];
      } else if (rawRoleId === "R-04" || rawRoleId.toLowerCase().includes("other")) {
        resolvedRoleName = "Other";
        resolvedPerms = ["priority"];
      } else if (!rawRoleId) {
        resolvedRoleName = jabatanVal || "Field PIC";
      }

      return {
        success: true,
        user: {
          nip: (idxNip !== -1 ? row[idxNip] : "") || "-",
          nama: (idxNama !== -1 ? row[idxNama] : "") || "Karyawan Digiasha",
          email: (idxEmail !== -1 ? row[idxEmail] : "") || "",
          jabatan: jabatanVal,
          role_id: rawRoleId,
          role: resolvedRoleName,
          permissions: resolvedPerms,
          cabang: (idxCabang !== -1 ? row[idxCabang] : "") || "HEAD OFFICE",
          area_cover: areaCoverVal,
          atasan_nip: atasanNipVal,
          atasan_nama: atasanNamaVal
        }
      };
    }
  }

  // Fallback: Jika tidak ditemukan di Spreadsheet, cek langsung ke Supabase m_employee
  if (typeof SUPABASE_CONFIG !== "undefined" && SUPABASE_CONFIG.URL && SUPABASE_CONFIG.ANON_KEY) {
    try {
      const url = `${SUPABASE_CONFIG.URL}/rest/v1/m_employee?or=(nip.eq.${encodeURIComponent(identifier)},email.eq.${encodeURIComponent(identifier)})`;
      const res = UrlFetchApp.fetch(url, {
        method: "get",
        headers: {
          "apikey": SUPABASE_CONFIG.ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_CONFIG.ANON_KEY}`
        },
        muteHttpExceptions: true
      });
      if (res.getResponseCode() === 200) {
        const empList = JSON.parse(res.getContentText());
        if (empList && empList.length > 0) {
          const emp = empList[0];
          const pass = String(emp.password_hash || emp.password || "").trim();
          if (pass === cleanPass) {
            const rawStatus = String(emp.status_aktif || "AKTIF").toUpperCase();
            if (rawStatus === "INACTIVE" || rawStatus === "NON-ACTIVE" || rawStatus === "NONAKTIF" || rawStatus === "TIDAK AKTIF") {
              return { success: false, message: "Akun Anda berstatus non-aktif. Hubungi Administrator." };
            }

            const rawRoleId = String(emp.role_id || "R-01").trim();
            let resolvedRoleName = emp.jabatan || rawRoleId;
            let resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac", "persetujuan"];

            if (rolesMap[rawRoleId]) {
              resolvedRoleName = rolesMap[rawRoleId].role_name || rawRoleId;
              if (rolesMap[rawRoleId].permissions && rolesMap[rawRoleId].permissions.length > 0) {
                resolvedPerms = rolesMap[rawRoleId].permissions;
              }
            } else if (rawRoleId === "R-01" || rawRoleId.toLowerCase().includes("admin")) {
              resolvedRoleName = "Admin";
            } else if (rawRoleId === "R-02" || rawRoleId.toLowerCase().includes("branch manager") || rawRoleId.toLowerCase().includes("bm")) {
              resolvedRoleName = "Branch Manager";
              resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "persetujuan"];
            } else if (rawRoleId === "R-03" || rawRoleId.toLowerCase().includes("fac")) {
              resolvedRoleName = "FAC";
              resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac"];
            } else if (rawRoleId === "R-04" || rawRoleId.toLowerCase().includes("other")) {
              resolvedRoleName = "Other";
              resolvedPerms = ["priority"];
            }

            return {
              success: true,
              user: {
                nip: emp.nip || "-",
                nama: emp.nama_lengkap || "Karyawan Digiasha",
                email: emp.email || "",
                jabatan: emp.jabatan || "",
                role_id: rawRoleId,
                role: resolvedRoleName,
                permissions: resolvedPerms,
                cabang: emp.cabang || "HEAD OFFICE",
                area_cover: emp.area_cover || "",
                atasan_nip: emp.atasan_nip || "",
                atasan_nama: emp.atasan_nama || "",
                status_ganti_pass: emp.status_ganti_pass === true || String(emp.status_ganti_pass).toLowerCase() === "true" || cleanPass === "Password123!"
              }
            };
          }
        }
      }
    } catch (errSup) {
      Logger.log("Supabase login fallback error: " + errSup.toString());
    }
  }

  return { success: false, message: "Email/NIP atau kata sandi tidak sesuai." };
  } catch (err) {
    Logger.log("Error handleLogin: " + err.toString());
    return { success: false, message: "Terjadi kesalahan login server: " + err.toString() };
  }
}

function verifyUserLogin(identifier, password) {
  return handleLogin(identifier, password);
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

  const idleGps = gpsDevices.filter(g => {
    const st = String(g.status_device || g.status || "").toLowerCase();
    return st.includes("tersedia") || st.includes("ready") || st.includes("idle") || st.includes("stok");
  }).map(g => ({
    imei: String(g.imei || ""),
    tipe: String(g.posisi_stock || g.tipe_perangkat || g.tipe || "Stok Cabang"),
    status_device: String(g.status_device || g.status || "TERSEDIA"),
    posisi_stock: String(g.posisi_stock || "Stok Cabang")
  }));

  return {
    success: true,
    dealers: dealers,
    units: units,
    idleGps: idleGps,
    assignments: assignments
  };
}
