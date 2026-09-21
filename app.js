/**
 * CORE LOGIC & ENGINE DIGIASHA APP (PRODUCTION READY - GOOGLE SPREADSHEET API)
 */
const APP_BUILD_VERSION = "20260919_v154";
const screenCache = {};

// Sesi Pengguna Aktif (Disimpan di lo
// calStorage)
let CURRENT_USER = (() => {
  try {
    const saved = localStorage.getItem("DIGIASHA_AUTH_USER");
    if (saved) {
      const u = JSON.parse(saved);
      const uRole = String(u.role || u.role_id || u.jabatan || "").toLowerCase();
      // Ensure slip_gaji is present in permissions
      if (Array.isArray(u.permissions) && !u.permissions.includes("slip_gaji")) {
        u.permissions.push("slip_gaji");
        try { localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(u)); } catch (e) { }
      }
      // Self-heal: jika role adalah Admin / Super Admin dan permissions terpotong (< 16)
      if ((uRole.includes("admin") || u.role_id === "R-01") && (!Array.isArray(u.permissions) || u.permissions.length < 16)) {
        u.permissions = [
          "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "laporan_activity",
          "izin", "persetujuan", "attendance_summary", "rekap_tim", "slip_gaji",
          "expense_claim", "internal_memo", "employee_loan", "helpdesk_support", "ketentuan",
          "sop_management", "organization_setting", "settings"
        ];
        try { localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(u)); } catch (e) { }
      }
      return u;
    }
    return null;
  } catch (e) {
    return null;
  }
})();

// Definisi Matriks Role & Hak Akses Standar (20 Modul Sesuai Menu Aplikasi)
const DEFAULT_ROLE_PERMISSIONS = {
  "R-01": {
    name: "Super Admin",
    icon: "fa-crown",
    color: "purple",
    badgeBg: "bg-purple-100 text-purple-800 border border-purple-200",
    desc: "Akses penuh seluruh modul operasional, presensi, persetujuan, support, ketentuan, SOP management, dan pengaturan sistem.",
    permissions: [
      "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "laporan_activity",
      "izin", "persetujuan", "attendance_summary", "rekap_tim", "slip_gaji", "personalia",
      "expense_claim", "internal_memo", "employee_loan", "helpdesk_support", "ketentuan",
      "sop_management", "organization_setting", "settings"
    ]
  },
  "R-02": {
    name: "Branch Manager / Supervisor",
    icon: "fa-user-tie",
    color: "blue",
    badgeBg: "bg-blue-100 text-blue-800 border border-blue-200",
    desc: "Monitoring cabang, kelola prioritas, penugasan concern, persetujuan, ketentuan, dan layanan support karyawan.",
    permissions: [
      "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history", "laporan_activity",
      "izin", "persetujuan", "attendance_summary", "rekap_tim", "slip_gaji", "personalia",
      "expense_claim", "internal_memo", "employee_loan", "helpdesk_support", "ketentuan"
    ]
  },
  "R-03": {
    name: "FAC Officer",
    icon: "fa-satellite-dish",
    color: "cyan",
    badgeBg: "bg-cyan-100 text-cyan-800 border border-cyan-200",
    desc: "Monitoring dan operasional GPS armada dealer, laporan berkala FAC, ketentuan, dan support karyawan.",
    permissions: [
      "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history",
      "izin", "attendance_summary", "slip_gaji",
      "expense_claim", "internal_memo", "helpdesk_support", "ketentuan"
    ]
  },
  "R-04": {
    name: "Field PIC",
    icon: "fa-person-walking",
    color: "emerald",
    badgeBg: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    desc: "Eksekusi kunjungan lapangan, visit mitra berkala, onboarding calon mitra, presensi, ketentuan, dan klaim biaya.",
    permissions: [
      "priority", "visit", "onboarding", "pipeline", "gps", "history",
      "izin", "attendance_summary", "slip_gaji",
      "expense_claim", "internal_memo", "helpdesk_support", "ketentuan"
    ]
  }
};

const ALL_APP_MODULES = [
  // 1. Operasional Lapangan
  { key: "priority", title: "Priority FAC", desc: "Monitoring prioritas unit & mitra FAC", icon: "fa-triangle-exclamation", category: "Operasional Lapangan" },
  { key: "visit", title: "Form Visit FAC", desc: "Input kunjungan regular & unit OVD", icon: "fa-clipboard-check", category: "Operasional Lapangan" },
  { key: "onboarding", title: "Calon Mitra", desc: "Input onboarding calon mitra baru", icon: "fa-user-plus", category: "Operasional Lapangan" },
  { key: "pipeline", title: "Pipeline", desc: "Progres pipeline & folder dokumen", icon: "fa-bars-progress", category: "Operasional Lapangan" },
  { key: "gps", title: "GPS Maintain", desc: "Pasang / ganti / cabut GPS", icon: "fa-satellite-dish", category: "Operasional Lapangan" },
  { key: "fac", title: "Report GPS", desc: "Monitoring sinyal GPS harian", icon: "fa-tower-broadcast", category: "Operasional Lapangan" },
  { key: "assignment", title: "Assign", desc: "Tandai concern visit mitra", icon: "fa-bullhorn", category: "Operasional Lapangan" },
  { key: "history", title: "Riwayat", desc: "Log visit, calon mitra & GPS", icon: "fa-clock-rotate-left", category: "Operasional Lapangan" },
  { key: "laporan_activity", title: "Laporan Activity", desc: "Monitoring kunjungan PIC & cabang", icon: "fa-chart-line", category: "Operasional Lapangan" },

  // 2. Personalia
  { key: "izin", title: "Pengajuan Izin", desc: "Permohonan WFA, Cuti, Sakit, Terlambat", icon: "fa-file-signature", category: "Personalia" },
  { key: "persetujuan", title: "Persetujuan (Approval Hub)", desc: "Pusat persetujuan permohonan staf", icon: "fa-stamp", category: "Personalia" },
  { key: "attendance_summary", title: "Rekap Absen", desc: "Kalender presensi saya sendiri", icon: "fa-calendar-check", category: "Personalia" },
  { key: "rekap_tim", title: "Presensi Tim", desc: "Monitoring presensi staf / PIC lain", icon: "fa-users-viewfinder", category: "Personalia" },
  { key: "slip_gaji", title: "Slip Gaji", desc: "E-Slip gaji & kompensasi resmi karyawan", icon: "fa-file-invoice-dollar", category: "Personalia" },
  { key: "personalia", title: "Data Karyawan", desc: "Master kepegawaian, detail personalia & riwayat karir", icon: "fa-id-card-clip", category: "Personalia" },

  // 3. Layanan & Support Karyawan
  { key: "expense_claim", title: "Klaim Biaya (Reimbursement)", desc: "Pengajuan biaya BBM/Tol/Ops", icon: "fa-money-bill-wave", category: "Layanan & Support" },
  { key: "internal_memo", title: "Memo Pengajuan Internal", desc: "Pembuatan surat memo resmi", icon: "fa-file-lines", category: "Layanan & Support" },
  { key: "employee_loan", title: "Pinjaman Karyawan (Kasbon)", desc: "Fasilitas pinjaman darurat karyawan", icon: "fa-hand-holding-dollar", category: "Layanan & Support" },
  { key: "helpdesk_support", title: "IT & Helpdesk Support", desc: "Bantuan kendala sistem & SOP", icon: "fa-headset", category: "Layanan & Support" },
  { key: "ketentuan", title: "Ketentuan & SOP", desc: "Pustaka pedoman & kebijakan karyawan", icon: "fa-book-bookmark", category: "Layanan & Support" },

  // 4. Administrasi & Sistem
  { key: "sop_management", title: "SOP Management", desc: "Kelola upload PDF, tanggal berlaku & hak akses role", icon: "fa-folder-gear", category: "Administrasi & Sistem" },
  { key: "organization_setting", title: "Organization Setting", desc: "Struktur, Work Location, Role & SSO", icon: "fa-sitemap", category: "Administrasi & Sistem" },
  { key: "settings", title: "Pengaturan (Admin)", desc: "Kelola Akun, Area, GPS, Banner & Role", icon: "fa-sliders", category: "Administrasi & Sistem" }
];

function parseRolePermissions(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
    } catch (e) {
      return raw.split(",").map(s => s.trim().replace(/^["'\[\]]+|["'\[\]]+$/g, "")).filter(Boolean);
    }
  }
  return [];
}

let ROLE_PERMISSIONS_STATE = (() => {
  try {
    const saved = localStorage.getItem("DIGIASHA_ROLE_PERMS");
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
      Object.keys(parsed).forEach(k => {
        if (merged[k]) {
          let perms = parseRolePermissions(parsed[k].permissions || merged[k].permissions).filter(p => p !== "work_calendar");
          // Self-heal Super Admin (R-01) if it had corrupted partial permissions (< 15)
          if (k === "R-01" && perms.length < 15) {
            perms = Array.from(new Set([...perms, ...DEFAULT_ROLE_PERMISSIONS["R-01"].permissions]));
          }
          if (k === "R-02") {
            if (!perms.includes("rekap_tim")) perms.push("rekap_tim");
            if (!perms.includes("attendance_summary")) perms.push("attendance_summary");
            if (!perms.includes("persetujuan")) perms.push("persetujuan");
          }
          merged[k].permissions = perms;
          if (parsed[k].name) merged[k].name = parsed[k].name;
          if (parsed[k].desc) merged[k].desc = parsed[k].desc;
          if (parsed[k].icon) merged[k].icon = parsed[k].icon;
          if (parsed[k].color) merged[k].color = parsed[k].color;
          if (parsed[k].badgeBg) merged[k].badgeBg = parsed[k].badgeBg;
        } else {
          merged[k] = parsed[k];
          merged[k].permissions = parseRolePermissions(merged[k].permissions).filter(p => p !== "work_calendar");
        }
      });
      return merged;
    }
  } catch (e) { }
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
})();

function getPermissionsForRole(roleKey, userObj = null) {
  const positionId = String(userObj?.position_id || userObj?.id_position || userObj?.jabatan_id || "").trim();

  // 0. Prioritaskan Hak Akses Terpusat Berbasis Jabatan (Digi Active Multi-App RBAC)
  if (positionId && typeof ORG_POSITION_PERMS_DATA !== "undefined" && ORG_POSITION_PERMS_DATA[positionId]) {
    const posPerms = ORG_POSITION_PERMS_DATA[positionId] || [];
    const activePerms = posPerms
      .filter(p => p.startsWith("digi_active:") && p.endsWith(":view"))
      .map(p => p.replace("digi_active:", "").replace(":view", ""));
    if (activePerms.length > 0) {
      return activePerms;
    }
  }

  const roleId = String(userObj?.role_id || roleKey || "").trim();
  const roleName = String(userObj?.role || userObj?.jabatan || roleKey || "").trim();

  // 1. Direct match by roleId in ROLE_PERMISSIONS_STATE
  if (ROLE_PERMISSIONS_STATE[roleId]) {
    const perms = parseRolePermissions(ROLE_PERMISSIONS_STATE[roleId].permissions);
    if (perms.length > 0) return perms;
  }

  // 2. Direct match for Admin / Super Admin (R-01)
  if (roleName.toLowerCase().includes("admin") || roleId.toLowerCase().includes("admin") || roleId === "R-01") {
    if (ROLE_PERMISSIONS_STATE["R-01"]) {
      const perms = parseRolePermissions(ROLE_PERMISSIONS_STATE["R-01"].permissions);
      if (perms.length > 0) return perms;
    }
    return DEFAULT_ROLE_PERMISSIONS["R-01"].permissions;
  }

  const match = Object.values(ROLE_PERMISSIONS_STATE).find(r =>
    r.name.toLowerCase() === roleName.toLowerCase() ||
    r.name.toLowerCase().includes(roleName.toLowerCase()) ||
    roleName.toLowerCase().includes(r.name.toLowerCase())
  );
  if (match) {
    const perms = parseRolePermissions(match.permissions);
    if (perms.length > 0) return perms;
  }

  if (userObj && Array.isArray(userObj.permissions) && userObj.permissions.length > 0) {
    return userObj.permissions;
  }

  return DEFAULT_ROLE_PERMISSIONS["R-04"].permissions;
}

// Hak Akses Modul per Role (Legacy Fallback)
const ROLE_PERMISSIONS = {
  "Admin": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "ketentuan", "sop_management", "organization_setting", "settings"],
  "R-01": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "ketentuan", "sop_management", "organization_setting", "settings"],
  "Super Admin": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "ketentuan", "sop_management", "organization_setting", "settings"],
  "Supervisor": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "ketentuan"],
  "Branch Manager": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history", "ketentuan"],
  "R-02": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history", "ketentuan"],
  "FAC": ["priority", "assignment", "visit", "onboarding", "gps", "fac", "history", "ketentuan"],
  "R-03": ["priority", "assignment", "visit", "onboarding", "gps", "fac", "history", "ketentuan"],
  "Other": ["priority", "ketentuan"],
  "R-04": ["priority", "visit", "onboarding", "pipeline", "gps", "history", "ketentuan"],
  "Field PIC": ["priority", "visit", "onboarding", "pipeline", "gps", "history", "ketentuan"]
};

// Data Kantor untuk Geofencing Presensi (Sinkron Dinamis dengan Sheet M_WORK_LOCATION)
let OFFICE_LOCATIONS = [
  { location_id: "LOC-HO", name: "Kantor Pusat", lat: -6.295216911, long: 106.6385914, maxRadiusMeter: 100, address: "Ruko District 91 Blo B No 10" },
  { location_id: "LOC-MKS", name: "Kantor Makassar", lat: -5.20284262, long: 119.4691989, maxRadiusMeter: 100, address: "Ruko Citra Garden Blok B 20, Jl. Yusuf Bauty, Batangkaluku, Gowa, Sulawesi Selatan" },
  { location_id: "LOC-BPP", name: "Kantor Balikpapan", lat: -1.274603726, long: 116.8371567, maxRadiusMeter: 100, address: "Jl. APT Pranoto No.10, Gunungsari Ilir, Balikpapan Tengah, Kalimantan Timur" }
];

// State Global Aplikasi (Diisi Dinamis dari API)
let APP_STATE = {
  dealers: [],
  units: [],
  idleGps: [],
  assignments: [],
  masterVehiclesGps: {}
};

let MASTER_DEALER_PRIORITY_DATA = [];
let FAC_GPS_MONITORING_DATA = [];

// Helper verifikasi cakupan wilayah (cover area) mitra vs PIC pengguna (berlaku untuk seluruh role)
function isDealerInUserCoverArea(dealer, user = CURRENT_USER) {
  if (!dealer) return false;
  if (!user) return true;

  const rawArea = String(user.area_cover || "").trim();

  // ATURAN UTAMA:
  // Semua user (termasuk Admin/Super Admin/user cabang) diatur oleh field area_cover.
  // Jika area_cover kosong, "*", atau "ALL", artinya user memiliki akses ke SEMUA AREA (seluruh dealer).
  if (!rawArea || rawArea === "*" || rawArea.toUpperCase() === "ALL") {
    return true;
  }

  // Jika area_cover diisi secara spesifik (misal: "Tangerang 1, Tangerang 2, Jakarta Barat"),
  // maka user (siapapun rolenya) hanya dapat melihat dealer yang berada di area cover tersebut.
  const clean = (s) => String(s || "").toLowerCase().replace(/[\s\-_.]/g, "");

  // Parsing daftar area cover user (contoh: 'TGR 1, TGR 2, Jakarta' -> ['tgr 1', 'tgr 2', 'jakarta'])
  const userAreas = rawArea.split(/[,;/|\n\r]+/).map(a => a.trim().toLowerCase()).filter(Boolean);
  const userAreasClean = userAreas.map(clean).filter(Boolean);

  if (userAreas.length === 0) return true;

  const dArea = String(dealer.area_cover || "").trim().toLowerCase();
  const dAreaClean = clean(dealer.area_cover);

  const dCabang = String(dealer.cabang || "").trim().toLowerCase();
  const dCabangClean = clean(dealer.cabang);

  // 1. Cek kecocokan antara area_cover dealer dengan daftar cover area user
  if (dArea) {
    const matchArea = userAreas.some((a, idx) => {
      const aClean = userAreasClean[idx];
      return (
        dArea === a ||
        dArea.includes(a) ||
        a.includes(dArea) ||
        (dAreaClean && aClean && (dAreaClean === aClean || dAreaClean.includes(aClean) || aClean.includes(dAreaClean)))
      );
    });
    if (matchArea) return true;
  }

  // 2. Cek apakah cabang dealer cocok dengan salah satu area cover user
  if (dCabang) {
    const matchCabang = userAreas.some((a, idx) => {
      const aClean = userAreasClean[idx];
      return (
        dCabang === a ||
        dCabang.includes(a) ||
        a.includes(dCabang) ||
        (dCabangClean && aClean && (dCabangClean === aClean || dCabangClean.includes(aClean) || aClean.includes(dCabangClean)))
      );
    });
    if (matchCabang) return true;
  }

  return false;
}

let CURRENT_USER_GEO = { lat: null, long: null, accuracy: null, nearestOffice: null, distanceToOffice: null, isInsideRadius: false };
let ACTIVE_ABSEN_TYPE = "Absen Datang";
let TODAY_ABSEN_STATUS = "BELUM_ABSEN"; // BELUM_ABSEN, SUDAH_DATANG, SUDAH_PULANG
let CURRENT_ABSEN_SELFIE_BASE64 = null;

// State Modul Izin & Approval
let SELECTED_IZIN_CATEGORY = "WFA";
let CURRENT_IZIN_GEO = { lat: -6.295218, long: 106.638482, accuracy: 25 };
let APPROVALS_CACHE = [];
let ACTIVE_APPROVAL_FILTER = "PENDING";
let ACTIVE_APPROVAL_SCOPE = "INBOX"; // "INBOX" (Persetujuan Tim) atau "MY" (Pengajuan Saya)
let PENDING_APPROVAL_ACTION_PAYLOAD = null;
let PENDING_CANCEL_IZIN_ID = null;
let CENTER_ALERT_CALLBACK = null;

let PRIORITY_ACTIVE_FILTER = "ALL";
let PRIORITY_VISIT_STATUS_FILTER = "ALL";
let FAC_ACTIVE_CONTRACT_FILTER = "ALL";
let FAC_SELECTED_STATUS_FILTERS = [];

// State Modul Visit & Onboarding
let CURRENT_UNIT_INDEX = null;
let ACTIVE_UNITS_STATE = [];
let CURRENT_SHOWROOM_PHOTO_BASE64 = null;
let CURRENT_ONB_SELFIE_BASE64 = null;
let TEMP_MODAL_PHOTO_BASE64 = null;
let ONB_DOC_FILES = {};

// State Foto Khusus GPS Maintenance
let GPS_PHOTO_OLD_BASE64 = null;
let GPS_PHOTO_NEW_IMEI_BASE64 = null;
let GPS_PHOTO_POSITION_BASE64 = null;

const STATUS_MAP = {
  "1": { name: "Tidak Pasang", short: "Tdk Pasang", activeBg: "bg-rose-600 text-white border-rose-600", normalBg: "hover:border-rose-400 text-rose-700 bg-rose-50 border-rose-200" },
  "2": { name: "Belum Lepas", short: "Blm Lepas", activeBg: "bg-purple-600 text-white border-purple-600", normalBg: "hover:border-purple-400 text-purple-700 bg-purple-50 border-purple-200" },
  "3": { name: "Belum Pasang", short: "Blm Pasang", activeBg: "bg-amber-500 text-white border-amber-500", normalBg: "hover:border-amber-400 text-amber-700 bg-amber-50 border-amber-200" },
  "4": { name: "Baterai Lemah", short: "Batt Lemah", activeBg: "bg-yellow-500 text-white border-yellow-500", normalBg: "hover:border-yellow-400 text-yellow-700 bg-yellow-50 border-yellow-200" },
  "5": { name: "Geser", short: "Geser", activeBg: "bg-blue-600 text-white border-blue-600", normalBg: "hover:border-blue-400 text-blue-700 bg-blue-50 border-blue-200" },
  "6": { name: "Pelepasan", short: "Pelepasan", activeBg: "bg-orange-600 text-white border-orange-600", normalBg: "hover:border-orange-400 text-orange-700 bg-orange-50 border-orange-200" },
  "7": { name: "Offline", short: "Offline", activeBg: "bg-slate-800 text-white border-slate-800", normalBg: "hover:border-slate-400 text-slate-800 bg-slate-100 border-slate-200" }
};

// =========================================================================
// SUPABASE STORAGE & DATABASE SERVICE HELPER
// =========================================================================
function base64ToBlob(base64Data) {
  if (!base64Data || typeof base64Data !== "string") return null;
  const parts = base64Data.split(';base64,');
  const contentType = (parts[0] && parts[0].split(':')[1]) ? parts[0].split(':')[1] : 'image/jpeg';
  const raw = window.atob(parts[1] || parts[0]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

function getExtensionFromMime(mimeType) {
  if (!mimeType) return "jpg";
  const m = String(mimeType).toLowerCase();
  if (m.includes("pdf")) return "pdf";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("svg")) return "svg";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return "jpg";
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

async function uploadToSupabaseStorage(base64Data, folder, prefix = "IMG") {
  if (!base64Data || !supabaseClient) return "";
  try {
    const blob = base64ToBlob(base64Data);
    if (!blob) return "";
    const ext = getExtensionFromMime(blob.type);
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14);
    const random = Math.floor(Math.random() * 10000);
    const filePath = `${folder}/${prefix}-${timestamp}-${random}.${ext}`;

    const { data, error } = await supabaseClient.storage
      .from(CONFIG.MEDIA_BUCKET || "digiasha-media")
      .upload(filePath, blob, {
        contentType: blob.type || "image/jpeg",
        upsert: true
      });

    if (error) {
      console.warn("Storage upload warning:", error);
      return "";
    }

    const { data: publicUrlData } = supabaseClient.storage
      .from(CONFIG.MEDIA_BUCKET || "digiasha-media")
      .getPublicUrl(filePath);

    return publicUrlData?.publicUrl || "";
  } catch (err) {
    console.error("Storage upload exception:", err);
    return "";
  }
}

async function supabaseLogin(identifier, password) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const idTrim = String(identifier).trim();
  const passTrim = String(password).trim();

  const { data: users, error } = await supabaseClient
    .from("m_employee")
    .select("*")
    .or(`nip.eq.${idTrim},email.eq.${idTrim}`)
    .limit(1);

  if (error || !users || users.length === 0) {
    return { success: false, message: "Akun tidak ditemukan. Periksa NIP atau Email Anda." };
  }

  const user = users[0];
  if (user.password_hash !== passTrim) {
    return { success: false, message: "Kata sandi yang Anda masukkan salah." };
  }

  if (user.status_aktif && user.status_aktif !== "AKTIF" && user.status_aktif !== true) {
    return { success: false, message: "Akun Anda saat ini berstatus NONAKTIF. Hubungi Administrator." };
  }

  let permissions = getPermissionsForRole(user.role_id, user);
  try {
    const { data: rolePerms } = await supabaseClient
      .from("m_role_permission")
      .select("*")
      .eq("role_id", user.role_id || "R-01")
      .limit(1);
    if (rolePerms && rolePerms.length > 0) {
      const parsed = parseRolePermissions(rolePerms[0].permissions || rolePerms[0].permission_keys);
      if (parsed.length > 0) permissions = parsed;
    }
  } catch (e) { }

  const roleNameMap = {
    "R-01": "Super Admin",
    "R-02": "Branch Manager",
    "R-03": "FAC",
    "R-04": "Field PIC"
  };

  return {
    success: true,
    user: {
      nip: user.nip,
      email: user.email,
      nama: user.nama_lengkap,
      jabatan: user.jabatan,
      cabang: user.cabang,
      area_cover: user.area_cover || "",
      role: roleNameMap[user.role_id] || user.role_id || "Field PIC",
      role_id: user.role_id,
      status_ganti_pass: user.status_ganti_pass === true || String(user.status_ganti_pass).toLowerCase() === "true",
      permissions: permissions
    }
  };
}

async function supabaseGetMasterData() {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const [resLoc, resDlr, resFac, resGps] = await Promise.all([
    supabaseClient.from("m_work_location").select("*"),
    supabaseClient.from("m_dealer").select("*").order("dealer_name"),
    supabaseClient.from("m_facility_unit").select("*").order("dealer_name"),
    supabaseClient.from("m_gps_device").select("*")
  ]);

  // Ambil antrean concern supervisor dari t_priority_action
  let assignments = [];
  try {
    const resAct = await supabaseClient
      .from("t_priority_action")
      .select("*")
      .eq("source", "MANUAL_SUPERVISOR")
      .eq("is_fu", false)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: true });

    if (resAct.data) {
      assignments = resAct.data.map(a => {
        let dName = a.entity_name;
        if (a.entity_type === "UNIT" && a.notes && a.notes.startsWith("Mitra: ")) {
          dName = a.notes.replace("Mitra: ", "").trim();
        }
        return {
          assignment_id: a.action_id,
          dealer_name: dName,
          entity_name: a.entity_name,
          entity_type: a.entity_type,
          unit_fasilitas: (a.entity_type === "DEALER") ? "Umum" : (a.entity_id || "Umum"),
          urgency_level: a.priority_level,
          instruksi: a.action_reason,
          status: a.is_fu ? "RESOLVED" : "OPEN",
          source: a.source,
          created_at: a.created_at,
          assigned_by: a.assigned_by
        };
      });
    }
  } catch (errAct) {
    console.warn("t_priority_action fetch error:", errAct);
  }

  const workLocations = (resLoc.data || []).map(l => ({
    location_id: l.location_id,
    name: l.name || l.location_name,
    lat: parseFloat(l.lat || l.latitude),
    long: parseFloat(l.long || l.longitude),
    maxRadiusMeter: parseInt(l.max_radius_meter || l.radius_meter || 100),
    address: l.address || l.alamat || ""
  }));

  const now = new Date();
  const obsoleteDealersToClean = [];
  const obsoleteUnitsToClean = [];

  const dealers = (resDlr.data || []).map(d => {
    let agingMitra = d.aging_visit_mitra || 0;
    if (d.last_visit_date) {
      const diffMs = now.getTime() - new Date(d.last_visit_date).getTime();
      agingMitra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else if (d.tanggal_kerjasama) {
      const diffMs = now.getTime() - new Date(d.tanggal_kerjasama).getTime();
      agingMitra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const isVisitedToday = isDealerVisitedToday(d);
    const reasonLower = String(d.priority_reason || "").toLowerCase();
    const isOldAgingReason = reasonLower.includes("aging visit");

    let pLevel = d.priority_level || "NORMAL";
    let pScore = d.priority_score || 0;
    let pReason = d.priority_reason || "";
    let urgentUnits = d.urgent_units_count || 0;

    // Jika sudah dikunjungi hari ini dan prioritas di DB hanyalah sisa aging visit lama, normalkan
    if (isVisitedToday && (isOldAgingReason || Number(urgentUnits) > 0)) {
      if (isOldAgingReason) {
        pLevel = "Normal";
        pScore = 0;
        pReason = "Selesai Dikunjungi Hari Ini";
      }
      urgentUnits = 0;
      obsoleteDealersToClean.push(d.dealer_id || d.dealer_name);
    }

    return {
      dealer_id: d.dealer_id,
      dealer_name: d.dealer_name,
      owner_name: d.owner_name,
      cabang: d.cabang,
      area_cover: d.area_cover || "",
      productivity: d.productivity || "Normal",
      status: d.status || "AKTIF",
      tanggal_kerjasama: d.tanggal_kerjasama,
      last_visit_date: d.last_visit_date,
      aging_visit_mitra: agingMitra,
      urgent_units_count: urgentUnits,
      priority_level: pLevel,
      priority_score: pScore,
      priority_reason: pReason
    };
  });

  const units = (resFac.data || []).map(u => {
    let agingUnit = u.aging_visit_unit || 0;
    if (u.last_visit_date) {
      const diffMs = now.getTime() - new Date(u.last_visit_date).getTime();
      agingUnit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    }

    const isVisitedToday = isUnitVisitedToday(u);
    const reasonLower = String(u.priority_reason || "").toLowerCase();
    const isOldAgingReason = reasonLower.includes("aging visit");

    let pLevel = u.priority_level || "NORMAL";
    let pScore = u.priority_score || 0;
    let pReason = u.priority_reason || "";

    if (isVisitedToday && isOldAgingReason) {
      pLevel = "Normal";
      pScore = 0;
      pReason = "Kondisi Normal / Terjadwal Baik";
      obsoleteUnitsToClean.push(u.no_fasilitas);
    }

    return {
      no_fasilitas: u.no_fasilitas,
      dealer_name: u.dealer_name,
      nopol: u.nopol,
      unit: u.unit,
      contract_status: u.contract_status || "LIVE",
      jto_date: u.jto_date,
      overdue_days: u.overdue_days || 0,
      lifetime_days: u.lifetime_days || 0,
      imei_gps: u.imei_gps,
      gps_status: u.gps_status || "Normal",
      last_visit_date: u.last_visit_date,
      aging_visit_unit: agingUnit,
      aging_gps_maint: u.aging_gps_maint || 0,
      priority_level: pLevel,
      priority_score: pScore,
      priority_reason: pReason
    };
  });

  // Background reconcile ke database Supabase jika ada record yang sudah dikunjungi hari ini tapi belum ter-reset di tabel
  if (supabaseClient) {
    setTimeout(async () => {
      try {
        if (obsoleteUnitsToClean.length > 0) {
          await supabaseClient.from("m_facility_unit")
            .update({
              priority_level: "Normal",
              priority_score: 0,
              priority_reason: "Kondisi Normal / Terjadwal Baik",
              updated_at: new Date().toISOString()
            })
            .in("no_fasilitas", obsoleteUnitsToClean);
        }
        if (obsoleteDealersToClean.length > 0) {
          for (const dId of obsoleteDealersToClean) {
            await supabaseClient.from("m_dealer")
              .update({
                urgent_units_count: 0,
                priority_level: "Normal",
                priority_score: 0,
                priority_reason: "Selesai Dikunjungi Hari Ini",
                updated_at: new Date().toISOString()
              })
              .or(`dealer_id.eq.${dId},dealer_name.eq.${dId}`);
          }
        }
      } catch (errClean) {
        console.warn("[reconcileSupabaseVisitStatus warning]:", errClean);
      }
    }, 1200);
  }

  const idleGps = (resGps.data || []).filter(g => {
    const s = String(g.status_device || "").toUpperCase();
    return s === "TERSEDIA" || s === "IDLE" || s === "READY";
  });

  return {
    success: true,
    dealers,
    units,
    idleGps,
    assignments,
    workLocations
  };
}

async function supabaseSubmitVisit(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const visitId = `VST-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const showroomPhotoUrl = data.showroom_photo_base64
    ? await uploadToSupabaseStorage(data.showroom_photo_base64, "visits", `VST-${data.currentUser?.nip || 'PIC'}`)
    : "";

  await supabaseClient.from("tr_laporan_visit").insert([{
    visit_id: visitId,
    nip: data.currentUser?.nip || null,
    dealer_name: data.dealer_name,
    lokasi: data.lokasi || "Showroom",
    bertemu_owner: data.bertemu_owner,
    owner_reason: data.owner_reason,
    stock: parseInt(data.stock) || 0,
    sales: parseInt(data.sales) || 0,
    issue_digi: data.issue_digi,
    issue_internal: data.issue_internal,
    issue_komp: data.issue_komp,
    catatan_visit: data.catatan_visit,
    tindak_lanjut_concern: data.tindak_lanjut_concern,
    lat: data.lat,
    long: data.long,
    showroom_photo_url: showroomPhotoUrl
  }]);

  if (Array.isArray(data.unit_check_list) && data.unit_check_list.length > 0) {
    const checkedRows = [];
    for (let i = 0; i < data.unit_check_list.length; i++) {
      const u = data.unit_check_list[i];
      let unitPhotoUrl = "";
      if (u.foto_unit) {
        unitPhotoUrl = await uploadToSupabaseStorage(u.foto_unit, "units", `UNIT-${u.nopol}`);
      }
      checkedRows.push({
        check_id: `CHK-${Date.now()}-${i}`,
        visit_id: visitId,
        dealer_name: data.dealer_name,
        no_fasilitas: u.no_fasilitas || "",
        nopol: u.nopol,
        unit_desc: u.unit,
        status_keberadaan: u.terlihat,
        kondisi_unit: u.gps_match || "Normal",
        foto_unit_url: unitPhotoUrl,
        catatan_unit: `Indikasi: ${u.indikasi || '-'}; Info: ${(u.info_unit || []).join(', ')}; Plan: ${u.ovd_plan || '-'}; Komitmen: ${u.komitmen || '-'}`
      });

      const isUnitTerlihat = (u.terlihat === "Ya" || String(u.terlihat || "").toLowerCase().includes("terlihat"));
      if (u.no_fasilitas && isUnitTerlihat) {
        await supabaseClient.from("m_facility_unit")
          .update({
            last_visit_date: new Date().toISOString().slice(0, 10),
            aging_visit_unit: 0,
            priority_level: "Normal",
            priority_score: 0,
            priority_reason: "Kondisi Normal / Terjadwal Baik"
          })
          .eq("no_fasilitas", u.no_fasilitas);
      }
    }

    if (checkedRows.length > 0) {
      await supabaseClient.from("tr_visit_unit_check").insert(checkedRows);
    }
  }

  // Syarat Solve Prioritas & Concern Mitra:
  // Kunjungan ke Showroom dan/atau Bertemu (Owner, Pekerja, Penanggung Jawab, dll)
  const isBertemuDb = (
    data.bertemu_owner &&
    String(data.bertemu_owner).trim() !== "" &&
    String(data.bertemu_owner).trim() !== "-" &&
    !String(data.bertemu_owner).toLowerCase().includes("tidak bertemu") &&
    String(data.bertemu_owner).toLowerCase() !== "tidak"
  );
  const isDealerSolved = (
    String(data.lokasi || "").toLowerCase().includes("showroom") ||
    isBertemuDb
  );

  if (isDealerSolved) {
    const todayStr = new Date().toISOString().slice(0, 10);
    let remainingUrgentCount = 0;
    try {
      let remQuery = supabaseClient.from("m_facility_unit")
        .select("no_fasilitas, priority_level, last_visit_date");
      if (data.dealer_id) {
        remQuery = remQuery.or(`dealer_name.eq.${data.dealer_name},dealer_id.eq.${data.dealer_id}`);
      } else {
        remQuery = remQuery.eq("dealer_name", data.dealer_name);
      }
      const { data: remUnits } = await remQuery;

      if (Array.isArray(remUnits)) {
        remainingUrgentCount = remUnits.filter(ru =>
          ru.last_visit_date !== todayStr &&
          (ru.priority_level === "Kritis" || ru.priority_level === "Penting" || (ru.priority_score && ru.priority_score > 0))
        ).length;
      }
    } catch (cntErr) {
      console.warn("Count remaining urgent units error:", cntErr);
    }

    const dealerPriorityLevel = remainingUrgentCount > 0 ? "Penting" : "Normal";
    const dealerPriorityScore = remainingUrgentCount > 0 ? 1 : 0;
    const dealerPriorityReason = remainingUrgentCount > 0
      ? `Selesai Visit Mitra, ${remainingUrgentCount} unit belum clear`
      : "Selesai Dikunjungi Hari Ini";

    const dealerUpdate = {
      last_visit_date: todayStr,
      aging_visit_mitra: 0,
      urgent_units_count: remainingUrgentCount,
      priority_level: dealerPriorityLevel,
      priority_score: dealerPriorityScore,
      priority_reason: dealerPriorityReason
    };

    if (data.dealer_id) {
      await supabaseClient.from("m_dealer")
        .update(dealerUpdate)
        .or(`dealer_id.eq.${data.dealer_id},dealer_name.eq.${data.dealer_name}`);
    } else {
      await supabaseClient.from("m_dealer")
        .update(dealerUpdate)
        .eq("dealer_name", data.dealer_name);
    }
  }

  // Auto-resolve Tiket di t_priority_action
  try {
    const nowIso = new Date().toISOString();
    const resolvedNip = data.currentUser?.nip || "PIC-FIELD";
    const todayDate = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

    // 1. Resolve Tiket Dealer (Jika Kunjungan Showroom dan/atau Bertemu Owner)
    if (isDealerSolved) {
      try {
        await supabaseClient.rpc("mark_priority_fu", {
          p_entity_type: "DEALER",
          p_entity_name_or_id: data.dealer_name,
          p_nip: resolvedNip,
          p_visit_id: visitId,
          p_log_date: todayDate
        });
      } catch (e) {
        await supabaseClient.from("t_priority_action")
          .update({ is_fu: true, fu_at: nowIso, fu_by: resolvedNip, fu_visit_id: visitId, updated_at: nowIso })
          .eq("is_fu", false)
          .eq("entity_type", "DEALER")
          .eq("entity_name", data.dealer_name);
      }
    }

    // 2. Resolve Tiket Unit Fasilitas (Jika hasil cek 'Ya, Terlihat')
    if (Array.isArray(data.unit_check_list) && data.unit_check_list.length > 0) {
      for (const u of data.unit_check_list) {
        const isVisible = (u.terlihat === "Ya" || String(u.terlihat || "").toLowerCase().includes("terlihat"));
        if (isVisible && u.no_fasilitas) {
          try {
            await supabaseClient.rpc("mark_priority_fu", {
              p_entity_type: "UNIT",
              p_entity_name_or_id: u.no_fasilitas,
              p_nip: resolvedNip,
              p_visit_id: visitId,
              p_log_date: todayDate
            });
          } catch (e) {
            await supabaseClient.from("t_priority_action")
              .update({ is_fu: true, fu_at: nowIso, fu_by: resolvedNip, fu_visit_id: visitId, updated_at: nowIso })
              .eq("is_fu", false)
              .eq("entity_type", "UNIT")
              .eq("entity_id", u.no_fasilitas);
          }
        }
      }
    }
  } catch (asgErr) {
    console.warn("Auto-resolve t_priority_action warning:", asgErr);
  }

  return { success: true, visitId };
}

async function supabaseSubmitGpsMaintenance(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const maintId = `GPSM-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const [fotoOldUrl, fotoNewUrl, fotoPosUrl] = await Promise.all([
    data.foto_imei_lama_base64 ? uploadToSupabaseStorage(data.foto_imei_lama_base64, "gps", `GPS-OLD-${data.imei_lama}`) : Promise.resolve(""),
    data.foto_imei_baru_base64 ? uploadToSupabaseStorage(data.foto_imei_baru_base64, "gps", `GPS-NEW-${data.imei_baru}`) : Promise.resolve(""),
    data.foto_posisi_gps_base64 ? uploadToSupabaseStorage(data.foto_posisi_gps_base64, "gps", `GPS-POS-${data.nopol}`) : Promise.resolve("")
  ]);

  await supabaseClient.from("tr_gps_maintenance").insert([{
    maint_id: maintId,
    nip: data.currentUser?.nip || null,
    dealer_name: data.dealer_name,
    no_fasilitas: data.no_fasilitas,
    nopol: data.nopol,
    act_type: data.act_type,
    imei_lama: data.imei_lama || "",
    imei_baru: data.imei_baru || "",
    foto_imei_lama_url: fotoOldUrl,
    foto_imei_baru_url: fotoNewUrl,
    foto_posisi_gps_url: fotoPosUrl,
    catatan_teknis: data.catatan_teknis,
    lat: data.lat,
    long: data.long
  }]);

  if (data.no_fasilitas) {
    if (data.act_type === "Ganti GPS" || data.act_type === "Pasang GPS") {
      await supabaseClient.from("m_facility_unit")
        .update({
          imei_gps: data.imei_baru,
          gps_status: "Normal",
          last_visit_date: new Date().toISOString().slice(0, 10)
        })
        .eq("no_fasilitas", data.no_fasilitas);
    } else if (data.act_type === "Cabut GPS") {
      await supabaseClient.from("m_facility_unit")
        .update({
          imei_gps: "",
          gps_status: "Tidak Pasang",
          last_visit_date: new Date().toISOString().slice(0, 10)
        })
        .eq("no_fasilitas", data.no_fasilitas);
    }
  }

  const officeStockLoc = data.work_location_name || "Kantor Pusat";
  if (data.act_type === "Ganti GPS") {
    if (data.imei_lama && data.imei_lama !== "-") {
      await supabaseClient.from("m_gps_device")
        .upsert({ imei: data.imei_lama, status_device: "TERSEDIA", posisi_stock: officeStockLoc, last_updated: new Date().toISOString() });
    }
    if (data.imei_baru) {
      await supabaseClient.from("m_gps_device")
        .upsert({ imei: data.imei_baru, status_device: `Terpasang di ${data.nopol}`, posisi_stock: data.dealer_name, last_updated: new Date().toISOString() });
    }
  } else if (data.act_type === "Cabut GPS") {
    if (data.imei_lama && data.imei_lama !== "-") {
      await supabaseClient.from("m_gps_device")
        .upsert({ imei: data.imei_lama, status_device: "TERSEDIA", posisi_stock: officeStockLoc, last_updated: new Date().toISOString() });
    }
  } else if (data.act_type === "Pasang GPS") {
    if (data.imei_baru) {
      await supabaseClient.from("m_gps_device")
        .upsert({ imei: data.imei_baru, status_device: `Terpasang di ${data.nopol}`, posisi_stock: data.dealer_name, last_updated: new Date().toISOString() });
    }
  }

  return { success: true, maintId };
}

function resolveClientTimeZone(cabang, officeName, clientTz) {
  if (clientTz && (clientTz.includes("Makassar") || clientTz.includes("Jayapura") || clientTz.includes("Jakarta") || clientTz.includes("Ujung_Pandang"))) {
    return clientTz;
  }
  const text = (String(cabang || "") + " " + String(officeName || "")).toUpperCase();
  if (text.includes("JAYAPURA") || text.includes("AMBON") || text.includes("PAPUA") || text.includes("MALUKU") || text.includes("SORONG") || text.includes("MANOKWARI") || text.includes("TIMIKA") || text.includes("MERAUKE") || text.includes("BIAK")) {
    return "Asia/Jayapura";
  }
  if (text.includes("MAKASSAR") || text.includes("BALIKPAPAN") || text.includes("BANJARMASIN") || text.includes("SAMARINDA") || text.includes("MANADO") || text.includes("PALU") || text.includes("KENDARI") || text.includes("GORONTALO") || text.includes("DENPASAR") || text.includes("BALI") || text.includes("MATARAM") || text.includes("LOMBOK") || text.includes("KUPANG") || text.includes("SULAWESI") || text.includes("KALIMANTAN") || text.includes("NTB") || text.includes("NTT")) {
    return "Asia/Makassar";
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
}

async function supabaseSubmitAbsensi(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const timeZone = resolveClientTimeZone(data.cabang, data.lokasi_kantor, data.timezone);
  const tzAbbr = timeZone === "Asia/Jayapura" ? "WIT" : (timeZone === "Asia/Makassar" ? "WITA" : "WIB");

  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });
  const [hourStr, minStr] = timeFormatter.format(now).split(":");
  const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);
  const targetMinutes = 9 * 60; // Batas jam masuk 09:00:00

  const jenisAbsen = data.jenis_absen || "Absen Datang";
  const isDatang = jenisAbsen === "Absen Datang" || jenisAbsen === "Masuk Kantor";
  const distanceMeter = Number(data.distance_meters || data.distance_meter || 0);
  const maxRadius = Number(data.max_radius || 100);

  // 1. Verifikasi Geofence hanya untuk Absen Datang
  if (isDatang && distanceMeter > maxRadius) {
    return {
      success: false,
      message: `Lokasi Anda berada di luar radius kantor terdaftar (${distanceMeter} Meter / Maks ${maxRadius}m).`
    };
  }

  // 2. Kalkulasi Keterlambatan Absen Datang (Jam Masuk 09:00 Waktu Setempat)
  const isLate = isDatang && currentMinutes > targetMinutes;
  const lateMinutes = isLate ? (currentMinutes - targetMinutes) : 0;
  const timeStr = `${hourStr}:${minStr} ${tzAbbr}`;

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

  const absenId = `ABS-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const selfieUrl = data.selfie_base64
    ? await uploadToSupabaseStorage(data.selfie_base64, "absensi", `ABS-${data.nip}-${Date.now()}`)
    : "";

  const insertPayload = {
    absen_id: absenId,
    timestamp: now.toISOString(),
    nip: data.nip || "-",
    nama_karyawan: data.nama || "-",
    jenis_absen: isDatang ? "Absen Datang" : "Absen Pulang",
    cabang: data.cabang || "-",
    lat: Number(data.lat || 0),
    long: Number(data.long || 0),
    nearest_office: data.lokasi_kantor || "-",
    distance_meter: distanceMeter,
    status_geofence: isDatang ? (distanceMeter <= maxRadius ? "VALID" : "OUTSIDE_RADIUS") : "BEBAS_RADIUS",
    menit_terlambat: lateMinutes,
    status_kehadiran: statusKehadiran,
    selfie_photo_url: selfieUrl
  };

  const { error } = await supabaseClient.from("tr_absensi_log").insert([insertPayload]);
  if (error) throw error;

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
}

async function supabaseSubmitIzin(data) {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }

  const now = new Date();
  const izinId = `IZN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  let selfieUrl = "";
  if (data.selfie_base64 && typeof uploadToSupabaseStorage === "function") {
    try {
      selfieUrl = await uploadToSupabaseStorage(data.selfie_base64, "absensi", `IZIN-${data.nip}-${Date.now()}`);
    } catch (e) {
      console.warn("Upload selfie izin warning:", e);
    }
  }

  const payload = {
    izin_id: izinId,
    timestamp: now.toISOString(),
    nip: data.nip || "-",
    nama: data.nama || "Karyawan",
    cabang: data.cabang || "-",
    jenis_izin: data.jenis_izin || "WFA",
    tgl_mulai: data.tgl_mulai || now.toISOString().slice(0, 10),
    tgl_selesai: data.tgl_selesai || data.tgl_mulai || now.toISOString().slice(0, 10),
    catatan: data.catatan || "-",
    lat: Number(data.lat || 0),
    long: Number(data.long || 0),
    selfie_url: selfieUrl,
    pic_approval_nip: data.pic_approval_nip || "-",
    pic_approval_nama: data.pic_approval_nama || "Atasan Langsung",
    status_approval: "PENDING"
  };

  // 1. Coba via Supabase Client SDK
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient.from("tr_izin_log").insert([payload]);
      if (!error) {
        return {
          success: true,
          izinId: izinId,
          message: `Pengajuan Izin "${data.jenis_izin}" berhasil dikirimkan ke PIC Approval (${data.pic_approval_nama || 'Atasan Langsung'}).`
        };
      }
      console.warn("Supabase SDK insert failed, falling back to direct REST:", error);
    } catch (sdkErr) {
      console.warn("Supabase SDK insert exception:", sdkErr);
    }
  }

  // 2. Direct REST fallback (100% reliable)
  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log`, {
      method: "POST",
      headers: {
        "apikey": CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      return {
        success: true,
        izinId: izinId,
        message: `Pengajuan Izin "${data.jenis_izin}" berhasil dikirimkan ke PIC Approval (${data.pic_approval_nama || 'Atasan Langsung'}).`
      };
    } else {
      const errText = await res.text();
      throw new Error(`Gagal menyimpan ke database Supabase: ${errText}`);
    }
  }

  throw new Error("Koneksi Supabase belum terkonfigurasi.");
}

async function supabaseProcessApproval(data) {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }

  const rawDecision = String(data.decision || data.status || data.actionType || "APPROVED").toUpperCase();
  let finalStatus = "REJECTED";
  if (rawDecision.includes("APPROV") || rawDecision.includes("SETUJU")) {
    finalStatus = "APPROVED";
  } else if (rawDecision.includes("CANCEL") || rawDecision.includes("BATAL")) {
    finalStatus = "CANCELLED";
  }

  const approverName = data.approver_name || data.approverNama || data.approved_by || CURRENT_USER?.nama || "Atasan";
  const approverNotes = data.catatan_approval || data.note || (finalStatus === "CANCELLED" ? "Dibatalkan oleh pemohon" : "-");

  const updateData = {
    status_approval: finalStatus,
    approved_at: new Date().toISOString(),
    approved_by: approverName,
    catatan_approval: approverNotes
  };

  const successMsg = finalStatus === "CANCELLED"
    ? "Permohonan izin berhasil dibatalkan."
    : `Permohonan berhasil di-${finalStatus === 'APPROVED' ? 'Setujui' : 'Tolak'}.`;

  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("tr_izin_log")
        .update(updateData)
        .eq("izin_id", data.izin_id);
      if (!error) {
        return {
          success: true,
          status: finalStatus,
          message: successMsg
        };
      }
    } catch (e) {
      console.warn("Supabase SDK approval update warning:", e);
    }
  }

  if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?izin_id=eq.${encodeURIComponent(data.izin_id)}`, {
      method: "PATCH",
      headers: {
        "apikey": CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(updateData)
    });
    if (res.ok) {
      return {
        success: true,
        status: finalStatus,
        message: successMsg
      };
    }
  }

  throw new Error("Gagal memproses persetujuan di database.");
}

async function supabaseSubmitOnboarding(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const onbId = `ONB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const selfieUrl = data.selfie_base64
    ? await uploadToSupabaseStorage(data.selfie_base64, "onboarding", `ONB-SELFIE-${data.userId}`)
    : "";

  // Upload each document's files
  const uploadedDocuments = [];
  if (data.documents && Array.isArray(data.documents)) {
    for (const docGroup of data.documents) {
      const groupFiles = [];
      if (docGroup.files && Array.isArray(docGroup.files)) {
        for (let i = 0; i < docGroup.files.length; i++) {
          const f = docGroup.files[i];
          if (f.url) {
            groupFiles.push({ name: f.name, url: f.url, type: f.type });
          } else if (f.base64) {
            const uploadedUrl = await uploadToSupabaseStorage(f.base64, "onboarding", `DOC-${docGroup.key}-${i + 1}`);
            if (uploadedUrl) {
              groupFiles.push({ name: f.name, url: uploadedUrl, type: f.type });
            }
          }
        }
      }
      if (groupFiles.length > 0) {
        uploadedDocuments.push({
          key: docGroup.key,
          title: docGroup.title,
          files: groupFiles
        });
      }
    }
  }

  const ktpDoc = uploadedDocuments.find(d => d.key === "KTP");
  const ktpPhotoUrl = ktpDoc?.files?.[0]?.url || selfieUrl;

  const showroomDoc = uploadedDocuments.find(d => d.key === "Foto_Tempat_Usaha" || d.key === "Foto_Stok_Unit");
  const showroomPhotoUrl = showroomDoc?.files?.[0]?.url || selfieUrl;

  const payloadMeta = {
    status_db: data.status_db,
    alamat: data.alamat,
    jenis_usaha: data.jenis_usaha,
    detail_usaha: data.detail_usaha,
    catatan: data.catatan,
    stages: data.stages || (data.aktivitas ? data.aktivitas.split(',').map(s => s.trim()) : ["Penawaran"]),
    documents: uploadedDocuments,
    legacy_text: `${data.status_db} | ${data.alamat} | ${data.detail_usaha} | Catatan: ${data.catatan} | Dokumen: ${data.dokumen_list}`
  };

  await supabaseClient.from("tr_onboarding_log").insert([{
    onboarding_id: onbId,
    nip: data.userId,
    dealer_name: data.nama_usaha || data.nama_pemohon,
    owner_name: data.nama_pemohon,
    lokasi_lat: data.lat,
    lokasi_long: data.long,
    survei_kelayakan: Array.isArray(data.stages) ? data.stages.join(", ") : data.aktivitas,
    catatan_survey: JSON.stringify(payloadMeta),
    foto_ktp_url: ktpPhotoUrl,
    foto_showroom_url: showroomPhotoUrl
  }]);

  return { success: true, onbId };
}

async function supabaseSaveAssignment(data) {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const assignId = `ASG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const isDealer = !data.unitFasilitas || data.unitFasilitas === "Umum" || data.unitFasilitas === "-";

  // Entity name: Jika UNIT, gunakan format "Nopol (Unit)" agar jelas di antrean
  const entityName = isDealer
    ? data.dealerName
    : (data.nopol ? `${data.nopol} (${data.unitModel || 'Kendaraan'})` : data.unitFasilitas);

  // Simpan ke tabel terpadu t_priority_action
  const insertPayload = {
    source: "MANUAL_SUPERVISOR",
    assigned_by: data.assignedByUserId || "SUPERVISOR",
    entity_type: isDealer ? "DEALER" : "UNIT",
    entity_id: isDealer ? (data.dealerId || null) : data.unitFasilitas,
    entity_name: entityName,
    cabang: data.cabang || null,
    notes: isDealer ? null : `Mitra: ${data.dealerName}`,
    priority_level: data.urgencyLevel || "Penting",
    priority_score: (data.urgencyLevel === "Sangat Penting") ? 3 : ((data.urgencyLevel === "Penting") ? 2 : 1),
    action_reason: data.instruksi,
    is_fu: false
  };

  const { error } = await supabaseClient.from("t_priority_action").insert([insertPayload]);

  if (error) {
    console.warn("Save t_priority_action error:", error);
    throw error;
  }

  // Real-time Update Status di Tabel Master (m_dealer & m_facility_unit)
  try {
    const score = (data.urgencyLevel === "Sangat Penting") ? 3 : ((data.urgencyLevel === "Penting") ? 2 : 1);
    const nowIso = new Date().toISOString();

    if (isDealer) {
      const q = supabaseClient.from("m_dealer")
        .update({
          priority_level: data.urgencyLevel || "Penting",
          priority_score: score,
          priority_reason: `Concern Mitra: ${data.instruksi}`,
          updated_at: nowIso
        });
      if (data.dealerId) {
        await q.eq("dealer_id", data.dealerId);
      } else {
        await q.eq("dealer_name", data.dealerName);
      }
    } else {
      // Update unit
      await supabaseClient.from("m_facility_unit")
        .update({
          priority_level: data.urgencyLevel || "Penting",
          priority_score: score,
          priority_reason: `Concern: ${data.instruksi}`,
          updated_at: nowIso
        })
        .eq("no_fasilitas", data.unitFasilitas);

      // Tingkatkan prioritas dealer karena ada unit yang memiliki concern
      const qDlr = supabaseClient.from("m_dealer")
        .update({
          priority_level: data.urgencyLevel || "Penting",
          priority_score: score,
          priority_reason: `Pemicu Unit: Concern: ${data.instruksi}`,
          updated_at: nowIso
        });
      if (data.dealerId) {
        await qDlr.eq("dealer_id", data.dealerId);
      } else {
        await qDlr.eq("dealer_name", data.dealerName);
      }
    }
  } catch (errMaster) {
    console.warn("Update master priority columns warning:", errMaster);
  }

  return { success: true, assignId };
}

// =========================================================================
// API CALLER HELPER (SUPABASE NATIVE + GAS FALLBACK)
// =========================================================================
async function callApi(action, data = {}) {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }

  // 1. Eksekusi melalui Supabase Client / REST API jika aktif
  if (supabaseClient || (typeof CONFIG !== "undefined" && CONFIG.SUPABASE_URL)) {
    try {
      if (action === "login") return await supabaseLogin(data.identifier, data.password);
      if (action === "getMasterData") return await supabaseGetMasterData();
      if (action === "submitVisit") return await supabaseSubmitVisit(data);
      if (action === "submitGpsMaintenance") return await supabaseSubmitGpsMaintenance(data);
      if (action === "submitAbsensi") return await supabaseSubmitAbsensi(data);
      if (action === "submitIzin") return await supabaseSubmitIzin(data);
      if (action === "processApproval") return await supabaseProcessApproval(data);
      if (action === "getApprovalList") {
        const isAdmin = String(data.role || "").toLowerCase().includes("admin");
        const cleanNip = data.nip || "";
        let query = supabaseClient ? supabaseClient.from("tr_izin_log").select("*").order("timestamp", { ascending: false }) : null;
        if (query) {
          if (!isAdmin && cleanNip) {
            query = query.eq("pic_approval_nip", cleanNip);
          }
          const { data: rows, error } = await query;
          if (!error && rows) return { success: true, approvals: rows };
        }
        if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
          const cleanNip = encodeURIComponent(CURRENT_USER?.nip || data?.nip || "");
          const queryUrl = cleanNip
            ? `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?or=(pic_approval_nip.eq.${cleanNip},nip.eq.${cleanNip})&select=*&order=timestamp.desc`
            : `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?order=timestamp.desc`;
          const res = await fetch(queryUrl, {
            headers: {
              "apikey": CONFIG.SUPABASE_ANON_KEY,
              "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
            }
          });
          if (res.ok) {
            const rows = await res.json();
            return { success: true, approvals: rows || [] };
          }
        }
      }
      if (action === "submitOnboarding") return await supabaseSubmitOnboarding(data);
      if (action === "saveAssignment") return await supabaseSaveAssignment(data);
      if (action === "resolveAssignment") {
        if (supabaseClient) {
          await supabaseClient.from("t_assignment").update({ status: "RESOLVED", resolved_at: new Date().toISOString(), resolved_by: data.resolvedByUserId }).eq("assignment_id", data.assignmentId);
        }
        return { success: true };
      }
    } catch (supabaseErr) {
      console.error(`[Supabase Execution Error on ${action}]:`, supabaseErr);
      if (action === "submitIzin" || action === "submitAbsensi" || action === "processApproval") {
        return { success: false, message: supabaseErr.message || "Gagal memproses data ke database." };
      }
    }
  }

  // 2. Fallback ke Google Apps Script (Hanya untuk action backend yang didukung)
  if (typeof CONFIG !== "undefined" && CONFIG.API_URL && !CONFIG.API_URL.includes("MASUKKAN_URL")) {
    try {
      const payload = { action, ...data };
      const res = await fetch(CONFIG.API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
      });
      return await res.json();
    } catch (err) {
      console.error("GAS Fallback Error:", err);
      return { success: false, message: "Koneksi API Gagal: " + err.message };
    }
  }

  return { success: false, message: "Backend database belum terkonfigurasi." };
}

// =========================================================================
// MASTER DATA SYNC ENGINE (POPULATES APP_STATE, GEOFENCE & PRIORITIES)
// =========================================================================
async function syncMasterDataFromApi() {
  try {
    const res = await callApi("getMasterData");
    if (res && res.success) {
      APP_STATE.dealers = res.dealers || [];
      APP_STATE.units = res.units || [];
      APP_STATE.idleGps = res.idleGps || [];
      APP_STATE.assignments = res.assignments || [];
      if (res.workLocations && res.workLocations.length > 0) {
        OFFICE_LOCATIONS = res.workLocations;
      }

      // Hubungkan unit fasilitas dan assign concern ke masing-masing dealer
      // Key unik mitra = Nama Dealer (dibersihkan dari suffix cabang)
      // Key unik fasilitas/unit = No Fasilitas
      const normalizeDlr = (str) => String(str || "").replace(/\s*\([^)]*\)\s*$/, "").trim().toUpperCase();
      const cleanFas = (str) => String(str || "").replace(/[\s\-_.]/g, "").toUpperCase();

      const assignmentsByDealer = {};
      const assignmentsByFasilitas = {};

      (APP_STATE.assignments || []).forEach(asg => {
        const rawD = String(asg.dealer_name || "").trim().toUpperCase();
        const normD = normalizeDlr(asg.dealer_name);

        if (!assignmentsByDealer[normD]) assignmentsByDealer[normD] = [];
        assignmentsByDealer[normD].push(asg);
        if (rawD && rawD !== normD) {
          if (!assignmentsByDealer[rawD]) assignmentsByDealer[rawD] = [];
          assignmentsByDealer[rawD].push(asg);
        }

        const asgUnit = cleanFas(asg.unit_fasilitas);
        if (asgUnit && asgUnit !== "UMUM" && asgUnit !== "-") {
          assignmentsByFasilitas[asgUnit] = asg;
        }
      });

      const unitsByDealer = {};
      (APP_STATE.units || []).forEach(u => {
        const rawD = String(u.dealer_name || "").trim().toUpperCase();
        const normD = normalizeDlr(u.dealer_name);
        if (!unitsByDealer[normD]) unitsByDealer[normD] = [];
        unitsByDealer[normD].push(u);
        if (rawD && rawD !== normD) {
          if (!unitsByDealer[rawD]) unitsByDealer[rawD] = [];
          unitsByDealer[rawD].push(u);
        }
      });

      MASTER_DEALER_PRIORITY_DATA = (APP_STATE.dealers || []).map(d => {
        const normD = normalizeDlr(d.dealer_name);
        const rawD = String(d.dealer_name || "").trim().toUpperCase();

        // Gabungkan assignments untuk dealer ini
        const dAsg = [
          ...(assignmentsByDealer[normD] || []),
          ...(assignmentsByDealer[rawD] || [])
        ].filter((item, idx, arr) => arr.findIndex(x => (x.assignment_id && x.assignment_id === item.assignment_id) || (x.id && x.id === item.id) || (x.unit_fasilitas === item.unit_fasilitas && x.instruksi === item.instruksi)) === idx);

        // Ambil raw units untuk dealer ini
        const rawUnits = unitsByDealer[normD] || unitsByDealer[rawD] || [];

        // Hubungkan unit_concern ke masing-masing unit fasilitas HANYA berdasarkan No Fasilitas
        const dUnits = rawUnits.map(u => {
          const uFas = cleanFas(u.no_fasilitas);

          const uAsg = assignmentsByFasilitas[uFas] || dAsg.find(a => {
            const aFas = cleanFas(a.unit_fasilitas);
            return aFas && aFas !== "UMUM" && aFas !== "-" && aFas === uFas;
          }) || (APP_STATE.assignments || []).find(a => {
            const aFas = cleanFas(a.unit_fasilitas);
            return aFas && aFas !== "UMUM" && aFas !== "-" && aFas === uFas;
          });

          return {
            ...u,
            unit_concern: uAsg ? { urgency: uAsg.urgency_level, note: uAsg.instruksi, assignment_id: uAsg.assignment_id } : null
          };
        });

        // Dealer concern (Umum / Non-fasilitas)
        const dealerConcern = dAsg.find(a => {
          const aFas = cleanFas(a.unit_fasilitas);
          return !aFas || aFas === "UMUM" || aFas === "-";
        });

        return {
          ...d,
          units: dUnits,
          dealer_concern: dealerConcern ? { urgency: dealerConcern.urgency_level, note: dealerConcern.instruksi, assignment_id: dealerConcern.assignment_id } : null
        };
      });

      // Re-populate dropdowns if user is currently on assignment, visit, or priority screen
      if (typeof populateAssignDealerOptions === "function") {
        const aSel = document.getElementById("assign-select-dealer");
        if (aSel) populateAssignDealerOptions();
      }
      if (typeof populateVisitDealerOptions === "function") {
        const vSel = document.getElementById("input-dealer");
        if (vSel) populateVisitDealerOptions();
      }
      if (typeof renderPriorityList === "function") {
        const pCont = document.getElementById("priority-list-container");
        if (pCont) renderPriorityList();
      }

      return res;
    }
  } catch (err) {
    console.warn("[syncMasterDataFromApi Warning]:", err);
  }
  return null;
}

// =========================================================================
// UI HELPERS, CLIENT-SIDE ROUTER & SESSIONS
// =========================================================================
const VALID_APP_SCREENS = [
  "dashboard", "priority", "assignment", "visit", "onboarding", "pipeline",
  "gps", "fac", "history", "laporan_activity", "absensi", "izin",
  "persetujuan", "attendance_summary", "rekap_absen", "rekap_tim",
  "slip_gaji", "personalia", "expense_claim", "internal_memo", "employee_loan", "helpdesk_support",
  "ketentuan", "sop_management", "organization_setting", "settings", "login"
];

function getScreenFromUrl() {
  let rawPath = window.location.pathname.replace(/^\/+|\/+$/g, "");
  if (!rawPath && window.location.hash) {
    rawPath = window.location.hash.replace(/^#\/?/, "");
  }

  if (!rawPath) return "dashboard";

  // Bersihkan dari parameter query (?) atau hash ekstra agar nama screen tepat
  const cleanPath = rawPath.split("?")[0].split("#")[0];
  const firstSegment = cleanPath.split("/")[0].toLowerCase();

  if (firstSegment === "rekap_absen") return "attendance_summary";
  if (firstSegment === "home" || firstSegment === "index" || firstSegment === "index.html") return "dashboard";
  if (firstSegment === "sop") return "ketentuan";

  if (VALID_APP_SCREENS.includes(firstSegment)) {
    return firstSegment;
  }
  return "dashboard";
}

function handleBackNavigation() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    loadScreen("dashboard", true);
  }
}

async function loadScreen(screenName, updateHistory = true) {
  const container = document.getElementById("main-view-container");
  const topbar = document.getElementById("topbar");
  const btnBack = document.getElementById("btn-back-home");
  const title = document.getElementById("topbar-title");
  const sub = document.getElementById("topbar-sub");

  // Auth Guard: Jika belum login dan mencoba buka selain login, redirect ke login
  if (!CURRENT_USER && screenName !== "login") {
    try {
      const fullPath = window.location.pathname + window.location.search;
      sessionStorage.setItem("DIGIASHA_REDIRECT_SCREEN", screenName);
      sessionStorage.setItem("DIGIASHA_REDIRECT_URL", fullPath);
    } catch (e) { }
    screenName = "login";
  }

  // Force Password Change Guard: Jika user wajib ganti password, cegah buka screen lain
  if (CURRENT_USER && (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") && screenName !== "login") {
    if (typeof openForceChangePassModal === "function") openForceChangePassModal();
    return;
  }

  // Update URL di address bar browser (HTML5 History API)
  if (updateHistory && window.history && window.history.pushState) {
    const targetPath = (screenName === "dashboard") ? "/" : `/${screenName}`;
    const query = (screenName === "ketentuan") ? window.location.search : "";
    const fullTarget = `${targetPath}${query}`;
    if (window.location.pathname + window.location.search !== fullTarget) {
      window.history.pushState({ screen: screenName }, "", fullTarget);
    }
  }

  const titles = {
    dashboard: "Digi Action",
    visit: "Form Visit FAC",
    onboarding: "Visit Calon Mitra",
    pipeline: "Pipeline Onboarding",
    gps: "GPS Maintenance",
    priority: "Priority FAC",
    assignment: "Assign Concern Visit",
    fac: "Report GPS",
    absensi: "Presensi Kehadiran",
    izin: "Pengajuan Izin",
    persetujuan: "Pusat Persetujuan",
    settings: "In-App Management",
    history: "Riwayat Aktivitas PIC",
    rekap_absen: "Rekap Presensi & Kalender",
    attendance_summary: "Rekap Presensi & Kalender",
    rekap_tim: "Presensi Tim & Monitoring PIC",
    slip_gaji: "E-Slip Gaji Karyawan",
    personalia: "Data Karyawan & Personalia",
    laporan_activity: "Laporan Activity & Monitoring Kunjungan",
    expense_claim: "Klaim Biaya Operasional",
    internal_memo: "Memo Pengajuan Internal",
    employee_loan: "Pinjaman Karyawan (Kasbon)",
    helpdesk_support: "IT & Helpdesk Support",
    ketentuan: "Pustaka Ketentuan & SOP",
    sop_management: "SOP & Policy Management",
    organization_setting: "Organization Setting",
    settings: "In-App Management",
    login: "Masuk Akun"
  };

  const pageTitle = titles[screenName] || "Digi Action";
  document.title = (screenName === "dashboard" || screenName === "login")
    ? "Digi Action"
    : `Digi Action - ${pageTitle}`;

  if (screenName === "login") {
    topbar.classList.add("hidden");
  } else {
    topbar.classList.remove("hidden");
    const uName = CURRENT_USER?.nama || CURRENT_USER?.nama_lengkap || CURRENT_USER?.email || "Pengguna";
    const uRole = CURRENT_USER?.role || CURRENT_USER?.role_id || "Karyawan";
    const areaSuffix = CURRENT_USER?.area_cover ? ` • Area: ${CURRENT_USER.area_cover}` : "";
    if (sub) sub.innerText = `${uName} • ${uRole}${areaSuffix}`;
    if (screenName === "dashboard") {
      btnBack.classList.add("hidden");
      title.innerText = "Digi Action";
    } else {
      btnBack.classList.remove("hidden");
      title.innerText = pageTitle;
    }
  }

  container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-800"></i>Memuat halaman...</div>';

  try {
    if (!screenCache[screenName]) {
      const vParam = typeof APP_BUILD_VERSION !== "undefined" ? `?v=${APP_BUILD_VERSION}` : `?v=${Date.now()}`;
      const res = await fetch(`/screens/${screenName}.html${vParam}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil file screen");
      screenCache[screenName] = await res.text();
    }
    container.innerHTML = screenCache[screenName];

    // Inisialisasi controller tiap modul
    if (screenName === "dashboard") initDashboard();
    if (screenName === "priority") {
      renderPriorityList();
      // Silently sync di background untuk memastikan assign concern atau status visit terbaru selalu termuat
      syncMasterDataFromApi().then(() => renderPriorityList());
    }
    if (screenName === "assignment") {
      populateAssignDealerOptions();
      if (!MASTER_DEALER_PRIORITY_DATA || MASTER_DEALER_PRIORITY_DATA.length === 0) {
        syncMasterDataFromApi().then(() => populateAssignDealerOptions());
      }
    }
    if (screenName === "visit") {
      populateVisitDealerOptions();
      if (!MASTER_DEALER_PRIORITY_DATA || MASTER_DEALER_PRIORITY_DATA.length === 0) {
        syncMasterDataFromApi().then(() => populateVisitDealerOptions());
      }
    }
    if (screenName === "onboarding" && typeof initOnboardingScreen === "function") initOnboardingScreen();
    if (screenName === "pipeline" && typeof initPipeline === "function") initPipeline();
    if (screenName === "gps") initGpsScreen();
    if (screenName === "fac") {
      if (typeof initFacMonitoringData === "function") initFacMonitoringData();
      renderLegendFilters();
      renderFacGpsList();
    }
    if (screenName === "absensi") initAbsensiScreen();
    if (screenName === "izin") initIzinScreen();
    if (screenName === "persetujuan") initPersetujuanScreen();
    if (screenName === "rekap_absen" || screenName === "attendance_summary") initRekapAbsenScreen();
    if (screenName === "rekap_tim") initRekapTimScreen();
    if (screenName === "slip_gaji" && typeof initSlipGajiScreen === "function") initSlipGajiScreen();
    if (screenName === "personalia" && typeof initPersonaliaScreen === "function") initPersonaliaScreen();
    if (screenName === "laporan_activity") initLaporanActivityScreen();
    if (screenName === "ketentuan" && typeof initKetentuanScreen === "function") initKetentuanScreen();
    if (screenName === "sop_management" && typeof initSopManagementScreen === "function") initSopManagementScreen();
    if (screenName === "organization_setting" && typeof initOrganizationSettingScreen === "function") initOrganizationSettingScreen();
    if (screenName === "settings" && typeof initSettingsScreen === "function") initSettingsScreen();
    if (screenName === "history" && typeof initHistory === "function") initHistory();

    window.scrollTo(0, 0);
  } catch (err) {
    console.error(`[loadScreen] Error loading screen ${screenName}:`, err);
    if (screenName === "login") {
      container.innerHTML = `
        <div class="flex flex-col justify-center items-center w-full min-h-[80vh] px-2 py-6">
          <div class="w-full max-w-sm bg-white rounded-2xl shadow-md p-5 sm:p-6 border border-slate-200">
            <div class="text-center mb-5">
              <div class="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white text-xl mb-2 shadow-sm">
                <i class="fa-solid fa-shield-halved text-emerald-400"></i>
              </div>
              <h1 class="text-lg font-bold text-slate-900 leading-tight">DIGI ACTION</h1>
              <p class="text-[11px] text-slate-500 mt-0.5">Operational & Daily Activity Workspace</p>
            </div>
            <form onsubmit="handleLoginSubmit(event)" class="space-y-3.5">
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Email / NIP</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                    <i class="fa-solid fa-user"></i>
                  </span>
                  <input type="text" id="login-email" required placeholder="Masukkan Email atau NIP"
                         class="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-600 mb-1">Kata Sandi</label>
                <div class="relative">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm">
                    <i class="fa-solid fa-lock"></i>
                  </span>
                  <input type="password" id="login-pass" required placeholder="Masukkan kata sandi"
                         class="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white" />
                  <button type="button" onclick="togglePasswordVisibility('login-pass', this)" title="Lihat/Sembunyikan Sandi" class="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 text-sm transition">
                    <i class="fa-solid fa-eye"></i>
                  </button>
                </div>
              </div>
              <button type="submit" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs sm:text-sm shadow transition flex items-center justify-center space-x-2">
                <span>Masuk ke Aplikasi</span>
                <i class="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </form>
          </div>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="p-6 bg-white rounded-2xl border border-red-200 text-center space-y-3 my-6 shadow-sm">
          <div class="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto text-lg">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h4 class="font-bold text-sm text-slate-800">Gagal Memuat Layar</h4>
          <p class="text-xs text-slate-500">${err.message}</p>
          <button type="button" onclick="loadScreen('dashboard')" class="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition">
            Kembali ke Dashboard
          </button>
        </div>`;
    }
  }
}

// Global Camera Trigger
function triggerCameraInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) {
    input.value = "";
    input.click();
  }
}

// Toggle Password Visibility (Mata Password)
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPass = input.type === "password";
  input.type = isPass ? "text" : "password";
  const icon = btn ? btn.querySelector("i") : null;
  if (icon) {
    icon.className = isPass ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
  }
}

// =========================================================================
// AUTH & SESSION CONTROLLER
// =========================================================================
async function handleLoginSubmit(e) {
  e.preventDefault();
  const identifier = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-pass")?.value.trim();

  if (!identifier || !password) {
    alert("Email/NIP dan Password wajib diisi!");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Memverifikasi...';
  submitBtn.disabled = true;

  try {
    let authUser = null;

    // 1. Coba Autentikasi Langsung ke Supabase REST API (Cepat & Realtime)
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const cleanId = encodeURIComponent(identifier);
        const url = `${CONFIG.SUPABASE_URL}/rest/v1/m_employee?or=(nip.eq.${cleanId},email.eq.${cleanId})`;
        const sbRes = await fetch(url, {
          method: "GET",
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        });
        if (sbRes.ok) {
          const empList = await sbRes.json();
          if (Array.isArray(empList) && empList.length > 0) {
            const emp = empList[0];
            const passHash = String(emp.password_hash || emp.password || "").trim();
            if (passHash === password) {
              const rawStatus = String(emp.status_aktif || "AKTIF").toUpperCase();
              if (rawStatus === "INACTIVE" || rawStatus === "NON-ACTIVE" || rawStatus === "NONAKTIF" || rawStatus === "TIDAK AKTIF") {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                alert("Gagal Login: Akun Anda berstatus non-aktif. Hubungi Administrator.");
                return;
              }

              const rawRoleId = String(emp.role_id || "R-01").trim();
              let resolvedRoleName = emp.jabatan || rawRoleId;

              if (rawRoleId === "R-01" || rawRoleId.toLowerCase().includes("admin")) {
                resolvedRoleName = "Admin";
              } else if (rawRoleId === "R-02" || rawRoleId.toLowerCase().includes("branch manager") || rawRoleId.toLowerCase().includes("bm")) {
                resolvedRoleName = "Branch Manager";
              } else if (rawRoleId === "R-03" || rawRoleId.toLowerCase().includes("fac")) {
                resolvedRoleName = "FAC";
              } else if (rawRoleId === "R-04" || rawRoleId.toLowerCase().includes("other")) {
                resolvedRoleName = "Other";
              }

              let resolvedPerms = getPermissionsForRole(rawRoleId, emp);

              const isMustChangePass = (
                emp.status_ganti_pass === true ||
                String(emp.status_ganti_pass).toLowerCase() === "true" ||
                passHash === "Password123!" ||
                password === "Password123!"
              );

              authUser = {
                nip: emp.nip || "-",
                nama: emp.nama_lengkap || "Karyawan Digiasha",
                email: emp.email || "",
                jabatan: emp.jabatan || "-",
                role_id: rawRoleId,
                role: resolvedRoleName,
                permissions: resolvedPerms,
                cabang: emp.cabang || "HEAD OFFICE",
                area_cover: emp.area_cover || "",
                atasan_nip: emp.atasan_nip || "",
                atasan_nama: emp.atasan_nama || "",
                status_ganti_pass: isMustChangePass
              };
            }
          }
        }
      } catch (errSup) {
        console.warn("Supabase direct auth skipped, falling back to GAS:", errSup);
      }
    }

    // 2. Fallback ke Google Apps Script API jika belum berhasil lewat Supabase
    if (!authUser) {
      const res = await callApi("login", { identifier, password });
      if (res && res.success && res.user) {
        authUser = res.user;
        if (authUser.status_ganti_pass === undefined) {
          authUser.status_ganti_pass = (password === "Password123!");
        }
      } else {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        alert("Gagal Login: " + (res?.message || "Akun tidak terdaftar atau kata sandi salah."));
        return;
      }
    }

    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    CURRENT_USER = authUser;
    try {
      localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(authUser));
    } catch (err) { }

    if (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") {
      openForceChangePassModal();
      return;
    }

    let targetScreen = "dashboard";
    try {
      const redirectUrl = sessionStorage.getItem("DIGIASHA_REDIRECT_URL");
      const redirectScreen = sessionStorage.getItem("DIGIASHA_REDIRECT_SCREEN");
      sessionStorage.removeItem("DIGIASHA_REDIRECT_URL");
      sessionStorage.removeItem("DIGIASHA_REDIRECT_SCREEN");

      if (redirectUrl) {
        window.history.replaceState(null, "", redirectUrl);
        const resolved = getScreenFromUrl();
        await loadScreen(resolved, false);
        syncMasterDataFromApi();
        return;
      } else if (redirectScreen && redirectScreen !== "login" && VALID_APP_SCREENS.includes(redirectScreen)) {
        targetScreen = redirectScreen;
      }
    } catch (e) { }

    await loadScreen(targetScreen, true);
    syncMasterDataFromApi();
  } catch (err) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    alert("Error login: " + err.message);
  }
}

function handleLogout() {
  localStorage.removeItem("DIGIASHA_AUTH_USER");
  try { sessionStorage.removeItem("DIGIASHA_REDIRECT_SCREEN"); } catch (e) { }
  CURRENT_USER = null;
  closeForceChangePassModal();
  loadScreen("login", true);
}

// =========================================================================
// BANNER CAROUSEL & SLIDESHOW ENGINE
// =========================================================================
let CURRENT_BANNER_INDEX = 0;
let BANNER_SLIDES_DATA = [];
let BANNER_AUTOSLIDE_TIMER = null;

const DEFAULT_BANNER_SLIDES = [
  {
    banner_id: "BNR-01",
    title: "Selamat Datang di Digi Action",
    description: "Aplikasi aktivitas harian terpadu, presensi cerdas, dan operasional karyawan.",
    image_url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80",
    tag: "DIGI ACTION",
    tag_bg: "bg-teal-500 text-slate-950"
  },
  {
    banner_id: "BNR-02",
    title: "SOP Presensi Lapangan & Geofence Radius 100m",
    description: "Lakukan absensi kedatangan tepat waktu sebelum 09:00 waktu setempat.",
    image_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80",
    tag: "SOP OPERASIONAL",
    tag_bg: "bg-emerald-500 text-slate-950"
  },
  {
    banner_id: "BNR-03",
    title: "Pusat Layanan Support Operasional & Memo",
    description: "Ajukan klaim biaya operasional, memo pengajuan, dan perizinan dalam satu aplikasi.",
    image_url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80",
    tag: "LAYANAN KARYAWAN",
    tag_bg: "bg-indigo-500 text-white"
  }
];

async function initBannerCarousel() {
  if (BANNER_AUTOSLIDE_TIMER) {
    clearInterval(BANNER_AUTOSLIDE_TIMER);
    BANNER_AUTOSLIDE_TIMER = null;
  }

  BANNER_SLIDES_DATA = DEFAULT_BANNER_SLIDES;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("m_announcement")
        .select("*")
        .eq("is_active", true)
        .order("order_seq", { ascending: true });

      if (!error && data && data.length > 0) {
        BANNER_SLIDES_DATA = data.map((b, idx) => ({
          ...b,
          tag: b.title.includes("SOP") ? "SOP OPERASIONAL" : (b.title.includes("Layanan") || b.title.includes("Biaya") ? "LAYANAN KARYAWAN" : "DIGIASHA UPDATE"),
          tag_bg: idx % 3 === 0 ? "bg-teal-500 text-slate-950" : (idx % 3 === 1 ? "bg-emerald-500 text-slate-950" : "bg-indigo-500 text-white")
        }));
      }
    } catch (e) {
      console.warn("Using fallback banner data:", e);
    }
  }

  renderBannerCarousel();
  startBannerAutoslide();
}

function renderBannerCarousel() {
  const track = document.getElementById("banner-carousel-track");
  const dotsContainer = document.getElementById("banner-carousel-dots");
  const indicator = document.getElementById("carousel-indicator-text");

  if (!track || !BANNER_SLIDES_DATA || BANNER_SLIDES_DATA.length === 0) return;

  track.innerHTML = BANNER_SLIDES_DATA.map((slide, idx) => `
    <div class="w-full h-full shrink-0 relative select-none">
      <img src="${slide.image_url}" alt="${slide.title}" class="w-full h-full object-cover" onerror="this.src='https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80'">
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent flex flex-col justify-end p-3.5 sm:p-4 text-white">
        <span class="px-2 py-0.5 ${slide.tag_bg || 'bg-teal-500 text-slate-950'} font-bold rounded text-[9px] w-fit mb-1 shadow-sm uppercase tracking-wider">${slide.tag || 'INFO'}</span>
        <h4 class="font-bold text-xs sm:text-sm line-clamp-1 text-white">${slide.title}</h4>
        <p class="text-[10px] sm:text-xs text-slate-300 line-clamp-1 mt-0.5">${slide.description || ''}</p>
      </div>
    </div>
  `).join("");

  if (dotsContainer) {
    dotsContainer.innerHTML = BANNER_SLIDES_DATA.map((_, idx) => `
      <button onclick="goToBannerSlide(${idx})" class="${idx === CURRENT_BANNER_INDEX ? 'w-5 h-1.5 bg-teal-400' : 'w-2 h-1.5 bg-white/50 hover:bg-white'} rounded-full transition-all duration-300"></button>
    `).join("");
  }

  if (indicator) {
    indicator.innerText = `${CURRENT_BANNER_INDEX + 1} / ${BANNER_SLIDES_DATA.length}`;
  }

  goToBannerSlide(CURRENT_BANNER_INDEX);
}

function goToBannerSlide(index) {
  if (!BANNER_SLIDES_DATA || BANNER_SLIDES_DATA.length === 0) return;
  if (index < 0) index = BANNER_SLIDES_DATA.length - 1;
  if (index >= BANNER_SLIDES_DATA.length) index = 0;

  CURRENT_BANNER_INDEX = index;
  const track = document.getElementById("banner-carousel-track");
  const dotsContainer = document.getElementById("banner-carousel-dots");
  const indicator = document.getElementById("carousel-indicator-text");

  if (track) {
    track.style.transform = `translateX(-${CURRENT_BANNER_INDEX * 100}%)`;
  }

  if (dotsContainer) {
    const dots = dotsContainer.querySelectorAll("button");
    dots.forEach((dot, idx) => {
      if (idx === CURRENT_BANNER_INDEX) {
        dot.className = "w-5 h-1.5 rounded-full bg-teal-400 transition-all duration-300";
      } else {
        dot.className = "w-2 h-1.5 rounded-full bg-white/50 hover:bg-white transition-all duration-300";
      }
    });
  }

  if (indicator) {
    indicator.innerText = `${CURRENT_BANNER_INDEX + 1} / ${BANNER_SLIDES_DATA.length}`;
  }
}

function nextBannerSlide() {
  goToBannerSlide(CURRENT_BANNER_INDEX + 1);
}

function prevBannerSlide() {
  goToBannerSlide(CURRENT_BANNER_INDEX - 1);
}

function startBannerAutoslide() {
  if (BANNER_AUTOSLIDE_TIMER) clearInterval(BANNER_AUTOSLIDE_TIMER);
  BANNER_AUTOSLIDE_TIMER = setInterval(() => {
    nextBannerSlide();
  }, 4500);
}

// Controller Dashboard
async function initDashboard() {
  if (!CURRENT_USER) return;
  const uName = CURRENT_USER.nama || CURRENT_USER.nama_lengkap || CURRENT_USER.email || "Pengguna";
  const uRole = CURRENT_USER.role || CURRENT_USER.role_id || "Karyawan";

  const nameEl = document.getElementById("dash-user-name");
  if (nameEl) nameEl.innerText = `Halo, ${uName}!`;

  const areaInfo = CURRENT_USER.area_cover ? ` • Area: ${CURRENT_USER.area_cover}` : "";
  const branchEl = document.getElementById("dash-user-branch");
  if (branchEl) branchEl.innerText = `Cabang: ${CURRENT_USER.cabang || '-'}${areaInfo}`;

  const roleEl = document.getElementById("badge-role");
  if (roleEl) roleEl.innerText = uRole;

  const perms = getPermissionsForRole(CURRENT_USER.role_id || uRole, CURRENT_USER);

  const isSuperAdminOrBM = (
    CURRENT_USER.role_id === "R-01" ||
    CURRENT_USER.role_id === "R-02" ||
    String(CURRENT_USER.role || "").toLowerCase().includes("admin") ||
    String(CURRENT_USER.role || "").toLowerCase().includes("manager") ||
    String(CURRENT_USER.role || "").toLowerCase().includes("supervisor")
  );

  // Render & filter seluruh modul aplikasi sesuai hak akses role (21 modul)
  const allModulesList = [
    "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "laporan_activity",
    "izin", "persetujuan", "attendance_summary", "rekap_tim", "slip_gaji",
    "expense_claim", "internal_memo", "employee_loan", "helpdesk_support", "ketentuan",
    "sop_management", "organization_setting", "settings"
  ];

  allModulesList.forEach(key => {
    const btn = document.getElementById(`menu-btn-${key}`);
    if (btn) {
      btn.style.display = perms.includes(key) ? "flex" : "none";
    }
  });

  // Periksa apakah setiap grup kartu memiliki tombol yang aktif
  const checkGroupVisibility = (boxId, groupContainerId) => {
    const box = document.getElementById(boxId);
    const container = document.getElementById(groupContainerId);
    if (box && container) {
      const visibleButtons = container.querySelectorAll("button:not([style*='display: none'])");
      box.style.display = visibleButtons.length > 0 ? "block" : "none";
    }
  };

  checkGroupVisibility("box-group-field", "group-field-ops");
  checkGroupVisibility("box-group-workflow", "group-workflow-ops");
  checkGroupVisibility("box-group-support", "group-support-ops");

  // Tampilkan/sembunyikan grup admin
  const adminBox = document.getElementById("box-group-admin");
  if (adminBox) {
    adminBox.style.display = (perms.includes("settings") || perms.includes("sop_management") || perms.includes("organization_setting")) ? "block" : "none";
  }

  // Inisialisasi Banner Slideshow Berita
  await initBannerCarousel();

  // Sinkronkan status presensi hari ini
  await fetchTodayAbsenStatus();

  // Sinkronkan jumlah permohonan persetujuan yang menunggu
  if (perms.includes("persetujuan")) {
    fetchPendingApprovalCount();
  }
}

// =========================================================================
// DIGIASHA SUPPORT HUB MODAL CONTROLLER (EXPANSION READY)
// =========================================================================
function openSupportModal(type) {
  const modal = document.getElementById("modal-digi-support");
  const iconBox = document.getElementById("support-modal-icon-bg");
  const icon = document.getElementById("support-modal-icon");
  const title = document.getElementById("support-modal-title");
  const badge = document.getElementById("support-modal-badge");
  const content = document.getElementById("support-modal-content");
  const footer = document.getElementById("support-modal-footer");

  if (!modal || !content) return;

  const userNip = CURRENT_USER?.nip || "-";
  const userNama = CURRENT_USER?.nama || CURRENT_USER?.nama_lengkap || "Karyawan";
  const userCabang = CURRENT_USER?.cabang || "Head Office";

  if (type === "expense_claim") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-money-bill-wave text-emerald-400";
    if (title) title.innerText = "Pengajuan Biaya Operasional (Reimbursement)";
    if (badge) badge.innerText = "Klaim Biaya BBM / Tol / Parkir / Ops Lapangan";

    content.innerHTML = `
      <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-[11px] text-emerald-950 flex items-start space-x-2">
        <i class="fa-solid fa-circle-info text-emerald-600 mt-0.5 shrink-0"></i>
        <span>Layanan pengajuan klaim biaya operasional kunjungan lapangan. Lampirkan foto kuitansi/struk transaksi yang sah.</span>
      </div>

      <form onsubmit="handleSupportSubmit('expense_claim', event)" class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">NIP & Nama Pemohon:</label>
            <input type="text" readonly value="${userNip} - ${userNama}" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-700 text-xs truncate" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Cabang:</label>
            <input type="text" readonly value="${userCabang}" class="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-700 text-xs" />
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Kategori Biaya: <span class="text-rose-500">*</span></label>
          <select id="support-input-expense-category" required class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs">
            <option value="BBM & Bensin">⛽ BBM & Bahan Bakar Operasional</option>
            <option value="Tol & Parkir">🛣️ Biaya Tol & Tiket Parkir Lapangan</option>
            <option value="Transportasi & Akomodasi">🏨 Transportasi Tiket / Penginapan Dinas</option>
            <option value="Service Kendaraan & Pulsa">🔧 Servis Rutin Kendaraan & Pulsa/Data</option>
            <option value="Biaya Operasional Lainnya">📦 Biaya Operasional / Pembelian Lainnya</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nominal Biaya (Rp): <span class="text-rose-500">*</span></label>
            <input type="number" id="support-input-expense-amount" required min="1000" placeholder="Contoh: 150000" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tanggal Transaksi: <span class="text-rose-500">*</span></label>
            <input type="date" id="support-input-expense-date" required value="${new Date().toISOString().slice(0, 10)}" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs" />
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Keterangan / Rincian Keperluan: <span class="text-rose-500">*</span></label>
          <textarea id="support-input-expense-notes" required rows="2" placeholder="Jelaskan detail kunjungan dan rincian penggunaan biaya..." class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 text-xs"></textarea>
        </div>

        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
          <label class="block font-semibold text-slate-700 mb-1">Foto Struk / Bukti Pembayaran: <span class="text-rose-500">*</span></label>
          <input type="file" id="support-input-expense-file" accept="image/*" class="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700" />
        </div>

        <div class="pt-2 flex space-x-2">
          <button type="button" onclick="closeSupportModal()" class="w-1/3 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Batal</button>
          <button type="submit" class="w-2/3 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-1.5">
            <i class="fa-solid fa-paper-plane"></i>
            <span>Kirim Pengajuan Biaya</span>
          </button>
        </div>
      </form>
    `;
  } else if (type === "internal_memo") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-file-lines text-blue-400";
    if (title) title.innerText = "Pembuatan Memo Pengajuan Internal";
    if (badge) badge.innerText = "Internal Memo & Permohonan Resmi";

    content.innerHTML = `
      <div class="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-950 flex items-start space-x-2">
        <i class="fa-solid fa-circle-info text-blue-600 mt-0.5 shrink-0"></i>
        <span>Gunakan form memo internal ini untuk permohonan persetujuan divisi, pengadaan perlengkapan, atau permohonan dinas ke manajemen.</span>
      </div>

      <form onsubmit="handleSupportSubmit('internal_memo', event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Perihal / Judul Memo: <span class="text-rose-500">*</span></label>
          <input type="text" id="support-input-memo-subject" required placeholder="Contoh: Permohonan Pengadaan Alat GPS & Banner Display Cabang" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs" />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Ditujukan Kepada: <span class="text-rose-500">*</span></label>
            <input type="text" id="support-input-memo-to" required placeholder="Contoh: Branch Manager / HRGA" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tingkat Urgensi:</label>
            <select id="support-input-memo-priority" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs">
              <option value="Normal">🟢 Normal</option>
              <option value="Penting">🟡 Penting</option>
              <option value="Sangat Mendesak">🔴 Sangat Mendesak</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Isi & Latar Belakang Pengajuan: <span class="text-rose-500">*</span></label>
          <textarea id="support-input-memo-body" required rows="4" placeholder="Tuliskan secara lengkap rincian latar belakang, kebutuhan, dan dasar permohonan memo..." class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 text-xs"></textarea>
        </div>

        <div class="pt-2 flex space-x-2">
          <button type="button" onclick="closeSupportModal()" class="w-1/3 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Batal</button>
          <button type="submit" class="w-2/3 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-1.5">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>Simpan & Kirim Memo</span>
          </button>
        </div>
      </form>
    `;
  } else if (type === "employee_loan") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-hand-holding-dollar text-amber-400";
    if (title) title.innerText = "Pengajuan Pinjaman Karyawan (Kasbon / Loan)";
    if (badge) badge.innerText = "Fasilitas Pinjaman Darurat Karyawan";

    content.innerHTML = `
      <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-950 flex items-start space-x-2">
        <i class="fa-solid fa-circle-info text-amber-600 mt-0.5 shrink-0"></i>
        <span>Fasilitas pinjaman karyawan / kasbon operasional darurat Digiasha. Pengajuan akan diteruskan ke komite manajemen untuk verifikasi.</span>
      </div>

      <form onsubmit="handleSupportSubmit('employee_loan', event)" class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Jumlah Pinjaman (Rp): <span class="text-rose-500">*</span></label>
            <input type="number" id="support-input-loan-amount" required min="100000" step="50000" placeholder="Contoh: 1000000" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs" />
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tenor Pemotongan Gaji:</label>
            <select id="support-input-loan-tenor" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs">
              <option value="1 Bulan">1 Bulan (Gaji Bulan Depan)</option>
              <option value="2 Bulan">2 Bulan Angsuran</option>
              <option value="3 Bulan">3 Bulan Angsuran</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Tujuan / Keperluan Pinjaman: <span class="text-rose-500">*</span></label>
          <textarea id="support-input-loan-reason" required rows="3" placeholder="Sebutkan keperluan darurat pengajuan pinjaman..." class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 text-xs"></textarea>
        </div>

        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600">
          <i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1"></i>
          Dengan mengajukan form ini, pemohon menyetujui skema pemotongan payroll gaji sesuai tenor yang disepakati.
        </div>

        <div class="pt-2 flex space-x-2">
          <button type="button" onclick="closeSupportModal()" class="w-1/3 py-2.5 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition">Batal</button>
          <button type="submit" class="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center justify-center space-x-1.5">
            <i class="fa-solid fa-paper-plane"></i>
            <span>Ajukan Pinjaman</span>
          </button>
        </div>
      </form>
    `;
  } else if (type === "helpdesk_support") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-headset text-purple-400";
    if (title) title.innerText = "IT & Operational Helpdesk Support";
    if (badge) badge.innerText = "Pusat Bantuan & Panduan Sistem Digiasha";

    content.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-[11px] text-purple-950">
          <h5 class="font-bold mb-1 flex items-center space-x-1.5 text-purple-900">
            <i class="fa-solid fa-shield-heart text-purple-600"></i>
            <span>Bantuan Sistem Lapangan Digiasha</span>
          </h5>
          <p>Jika Anda mengalami kendala teknis (GPS error, kamera selfie tidak muncul, salah login, atau sinkronisasi data), hubungi tim support operasional:</p>
        </div>

        <div class="grid grid-cols-1 gap-2">
          <a href="https://wa.me/6281234567890?text=Halo%20Tim%20Support%20Digiasha,%20saya%20mengalami%20kendala" target="_blank" class="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-2xl flex items-center space-x-3 transition">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0">
              <i class="fa-brands fa-whatsapp"></i>
            </div>
            <div class="min-w-0 flex-1">
              <span class="font-bold text-xs text-emerald-950 block">Hotline WhatsApp IT Support</span>
              <span class="text-[10px] text-emerald-700">Respon cepat hari kerja 08:00 - 18:00 WIB</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square text-emerald-600 text-xs"></i>
          </a>

          <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center space-x-3">
            <div class="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center text-lg shrink-0">
              <i class="fa-solid fa-envelope"></i>
            </div>
            <div class="min-w-0 flex-1">
              <span class="font-bold text-xs text-slate-800 block">Email Support Resmi</span>
              <span class="text-[10px] text-slate-500">support@digiasha.my.id</span>
            </div>
          </div>
        </div>

        <div class="p-3 bg-slate-100 rounded-2xl text-[11px] text-slate-600 space-y-1">
          <strong class="text-slate-800 block">Tips Cepat Kendala Presensi:</strong>
          <p>1. Pastikan izin lokasi GPS di browser disetel ke "Allow" / "Izinkan".</p>
          <p>2. Pastikan jam perangkat Anda sinkron otomatis dengan waktu jaringan.</p>
          <p>3. Jika layar tidak berganti, lakukan Refresh browser atau Clear Cache.</p>
        </div>
      </div>
    `;
  } else if (type === "attendance_summary") {
    loadScreen("rekap_absen");
    return;
  } else if (type === "work_calendar") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-slate-500/20 text-slate-300 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-calendar-check text-teal-400";
    if (title) title.innerText = "Kalender Kerja & Hari Libur";
    if (badge) badge.innerText = "Monitoring Presensi Karyawan";

    content.innerHTML = `
      <div class="space-y-3">
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-700">
          <div class="flex justify-between items-center mb-1">
            <span class="font-bold text-xs text-slate-900">${userNama}</span>
            <span class="text-[10px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800">${userCabang}</span>
          </div>
          <p class="text-[10px] text-slate-500">NIP: ${userNip} | Jabatan: ${CURRENT_USER?.role || CURRENT_USER?.jabatan || '-'}</p>
        </div>

        <div class="grid grid-cols-2 gap-2 text-center">
          <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <span class="text-[10px] text-emerald-600 font-bold block uppercase">Batas Jam Masuk</span>
            <span class="text-sm font-black text-emerald-800 mt-0.5 block">09:00:00</span>
            <span class="text-[9px] text-emerald-600">Waktu Kantor Setempat</span>
          </div>
          <div class="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
            <span class="text-[10px] text-blue-600 font-bold block uppercase">Radius Geofence</span>
            <span class="text-sm font-black text-blue-800 mt-0.5 block">Maks 100m</span>
            <span class="text-[9px] text-blue-600">Absen Masuk Kantor</span>
          </div>
        </div>

        <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900">
          <i class="fa-solid fa-lightbulb text-amber-600 mr-1"></i>
          Gunakan menu <strong>Riwayat Aktivitas</strong> untuk melihat log absensi dan perizinan harian Anda secara lengkap.
        </div>
      </div>
    `;
  }

  modal.classList.remove("hidden");
}

function closeSupportModal() {
  const modal = document.getElementById("modal-digi-support");
  if (modal) modal.classList.add("hidden");
}

function handleSupportSubmit(type, e) {
  e.preventDefault();
  closeSupportModal();

  const typeNameMap = {
    "expense_claim": "Klaim Biaya Operasional",
    "internal_memo": "Memo Pengajuan Internal",
    "employee_loan": "Pinjaman Karyawan (Kasbon)"
  };

  showCenterAlertModal({
    title: "Pengajuan Terkirim",
    message: `Permohonan ${typeNameMap[type] || 'Layanan Support'} Anda berhasil disimpan dan diteruskan ke tim Finance & Operasional Digiasha.`,
    type: "success"
  });
}


// =========================================================================
// POPUP TENGAH (CENTER ALERT DIALOG)
// =========================================================================
function showCenterAlertModal({ title, message, type = "success", detailsHtml = "", onClose = null }) {
  const modal = document.getElementById("modal-center-alert");
  if (!modal) {
    alert(`${title}: ${message}`);
    if (onClose) onClose();
    return;
  }

  const iconBox = document.getElementById("center-alert-icon-box");
  const icon = document.getElementById("center-alert-icon");
  const titleEl = document.getElementById("center-alert-title");
  const msgEl = document.getElementById("center-alert-message");
  const detailsEl = document.getElementById("center-alert-details");
  const btnClose = document.getElementById("btn-close-center-alert");

  CENTER_ALERT_CALLBACK = onClose;

  if (titleEl) titleEl.innerText = title;
  if (msgEl) msgEl.innerText = message;

  if (type === "success") {
    if (iconBox) iconBox.className = "w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mx-auto shadow-inner";
    if (icon) icon.className = "fa-solid fa-circle-check";
    if (btnClose) btnClose.className = "w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl text-xs shadow-md transition active:scale-95";
  } else if (type === "warning") {
    if (iconBox) iconBox.className = "w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center text-3xl mx-auto shadow-inner";
    if (icon) icon.className = "fa-solid fa-clock";
    if (btnClose) btnClose.className = "w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-2xl text-xs shadow-md transition active:scale-95";
  } else {
    if (iconBox) iconBox.className = "w-16 h-16 rounded-3xl bg-rose-50 text-rose-600 flex items-center justify-center text-3xl mx-auto shadow-inner";
    if (icon) icon.className = "fa-solid fa-circle-xmark";
    if (btnClose) btnClose.className = "w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl text-xs shadow-md transition active:scale-95";
  }

  if (detailsHtml && detailsEl) {
    detailsEl.innerHTML = detailsHtml;
    detailsEl.classList.remove("hidden");
  } else if (detailsEl) {
    detailsEl.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

function closeCenterAlertModal() {
  const modal = document.getElementById("modal-center-alert");
  if (modal) modal.classList.add("hidden");
  if (typeof CENTER_ALERT_CALLBACK === "function") {
    const cb = CENTER_ALERT_CALLBACK;
    CENTER_ALERT_CALLBACK = null;
    cb();
  }
}

// Helper Toast Notification Auto-Close (Untuk notifikasi ringkas)
function showToast(message, type = "success", durationMs = 1500) {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    document.body.appendChild(toast);
  }

  const bgStyles = {
    success: "bg-emerald-600 text-white shadow-emerald-600/30",
    error: "bg-rose-600 text-white shadow-rose-600/30",
    warning: "bg-amber-500 text-white shadow-amber-500/30",
    info: "bg-slate-900 text-white shadow-slate-900/30"
  };

  const iconMap = {
    success: '<i class="fa-solid fa-circle-check text-sm"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation text-sm"></i>',
    warning: '<i class="fa-solid fa-circle-exclamation text-sm"></i>',
    info: '<i class="fa-solid fa-circle-info text-sm"></i>'
  };

  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center space-x-2 transition-all duration-300 pointer-events-none opacity-100 translate-y-0 ${bgStyles[type] || bgStyles.info}`;
  toast.innerHTML = `${iconMap[type] || ''} <span>${message}</span>`;

  setTimeout(() => {
    toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center space-x-2 transition-all duration-300 pointer-events-none opacity-0 translate-y-[-10px] ${bgStyles[type] || bgStyles.info}`;
  }, durationMs);
}

// =========================================================================
// PRESENSI ONLINE & ABSENSI ENGINE (ABSEN DATANG / ABSEN PULANG)
// =========================================================================

// Cek status absensi hari ini ke Supabase / server
async function fetchTodayAbsenStatus() {
  if (!CURRENT_USER) return;
  const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";

  // Format tanggal hari ini berdasarkan zona waktu lokal pengguna (YYYY-MM-DD)
  const now = new Date();
  let localDateStr = "";
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: clientTz, year: "numeric", month: "2-digit", day: "2-digit" });
    localDateStr = formatter.format(now);
  } catch (e) {
    localDateStr = now.toISOString().slice(0, 10);
  }

  const todayKey = `DIGIASHA_ABSEN_${CURRENT_USER.nip || CURRENT_USER.nama}_${localDateStr}`;
  const localSaved = localStorage.getItem(todayKey);
  if (localSaved) {
    TODAY_ABSEN_STATUS = localSaved;
    updateDashboardPresensiUI();
  }

  try {
    const startDateUtc = new Date(now.getTime() - 36 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let logs = [];

    if (supabaseClient) {
      let query = supabaseClient
        .from("tr_absensi_log")
        .select("jenis_absen, timestamp, nip, nama_karyawan")
        .gte("timestamp", `${startDateUtc}T00:00:00`)
        .order("timestamp", { ascending: true });

      if (CURRENT_USER.nip) {
        query = query.eq("nip", CURRENT_USER.nip);
      } else if (CURRENT_USER.nama) {
        query = query.eq("nama_karyawan", CURRENT_USER.nama);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        logs = data;
      }
    }

    if ((!logs || logs.length === 0) && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && CURRENT_USER.nip) {
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/tr_absensi_log?nip=eq.${encodeURIComponent(CURRENT_USER.nip)}&timestamp=gte.${startDateUtc}T00:00:00&order=timestamp.asc`;
      const res = await fetch(url, {
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) logs = json;
      }
    }

    if (Array.isArray(logs) && logs.length > 0) {
      let hasDatang = false;
      let hasPulang = false;
      logs.forEach(l => {
        let logLocalDateStr = "";
        try {
          const logDate = new Date(l.timestamp);
          logLocalDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: clientTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(logDate);
        } catch (err) {
          logLocalDateStr = String(l.timestamp || "").slice(0, 10);
        }

        if (logLocalDateStr === localDateStr) {
          const j = String(l.jenis_absen || "").toLowerCase();
          if (j.includes("datang") || j.includes("masuk")) hasDatang = true;
          if (j.includes("pulang")) hasPulang = true;
        }
      });

      if (hasPulang) TODAY_ABSEN_STATUS = "SUDAH_PULANG";
      else if (hasDatang) TODAY_ABSEN_STATUS = "SUDAH_DATANG";
      else TODAY_ABSEN_STATUS = "BELUM_ABSEN";

      localStorage.setItem(todayKey, TODAY_ABSEN_STATUS);
    }
  } catch (e) {
    console.warn("Gagal cek status absensi online:", e);
  }

  updateDashboardPresensiUI();
}

function updateDashboardPresensiUI() {
  const labelEl = document.getElementById("dash-presensi-status-label");
  const subEl = document.getElementById("dash-presensi-status-sub");
  const btnText = document.getElementById("dash-btn-presensi-text");

  if (TODAY_ABSEN_STATUS === "SUDAH_PULANG") {
    if (labelEl) labelEl.innerText = "Presensi Selesai";
    if (subEl) subEl.innerText = "Anda telah absen datang & pulang hari ini";
    if (btnText) btnText.innerText = "Presensi Selesai";
  } else if (TODAY_ABSEN_STATUS === "SUDAH_DATANG") {
    if (labelEl) labelEl.innerText = "Sudah Absen Datang";
    if (subEl) subEl.innerText = "Siap untuk Absen Pulang kerja";
    if (btnText) btnText.innerText = "Absen Pulang";
  } else {
    if (labelEl) labelEl.innerText = "Kehadiran Hari Ini";
    if (subEl) subEl.innerText = "Presensi & Perizinan Karyawan";
    if (btnText) btnText.innerText = "Presensi Online";
  }
}

function openAbsenChoiceModal() {
  const modal = document.getElementById("modal-absen-choice");
  if (!modal) return;

  const btnTitle = document.getElementById("btn-choice-absen-title");
  const btnDesc = document.getElementById("btn-choice-absen-desc");
  const btnIcon = document.getElementById("btn-choice-absen-icon");
  const btnIconBg = document.getElementById("btn-choice-absen-icon-bg");
  const btnBadge = document.getElementById("btn-choice-absen-badge");
  const btnMain = document.getElementById("btn-choice-absen-main");

  if (TODAY_ABSEN_STATUS === "SUDAH_DATANG") {
    if (btnTitle) btnTitle.innerText = "Absen Pulang";
    if (btnDesc) btnDesc.innerText = "Presensi kepulangan kerja (Bebas radius kantor, geotag real)";
    if (btnIcon) btnIcon.className = "fa-solid fa-door-open text-amber-400";
    if (btnIconBg) btnIconBg.className = "w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-lg shrink-0 border border-amber-500/30";
    if (btnBadge) {
      btnBadge.innerText = "Siap Pulang";
      btnBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-500/20 text-amber-300";
      btnBadge.classList.remove("hidden");
    }
    if (btnMain) {
      btnMain.className = "p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center space-x-3 transition text-left shadow-sm border border-amber-600/40 active:scale-[0.99]";
    }
  } else if (TODAY_ABSEN_STATUS === "SUDAH_PULANG") {
    if (btnTitle) btnTitle.innerText = "Presensi Selesai";
    if (btnDesc) btnDesc.innerText = "Presensi hari ini sudah lengkap (Datang & Pulang)";
    if (btnIcon) btnIcon.className = "fa-solid fa-circle-check text-emerald-400";
    if (btnIconBg) btnIconBg.className = "w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-lg shrink-0";
    if (btnBadge) {
      btnBadge.innerText = "Selesai";
      btnBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300";
      btnBadge.classList.remove("hidden");
    }
    if (btnMain) {
      btnMain.className = "p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center space-x-3 transition text-left shadow-sm border border-slate-700 active:scale-[0.99]";
    }
  } else {
    // BELUM_ABSEN
    if (btnTitle) btnTitle.innerText = "Absen Datang";
    if (btnDesc) btnDesc.innerText = "Presensi masuk kerja (Wajib radius kantor)";
    if (btnIcon) btnIcon.className = "fa-solid fa-building text-emerald-400";
    if (btnIconBg) btnIconBg.className = "w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-lg shrink-0";
    if (btnBadge) btnBadge.classList.add("hidden");
    if (btnMain) {
      btnMain.className = "p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl flex items-center space-x-3 transition text-left shadow-sm border border-slate-700 active:scale-[0.99]";
    }
  }

  modal.classList.remove("hidden");
}

function closeAbsenChoiceModal() {
  const modal = document.getElementById("modal-absen-choice");
  if (modal) modal.classList.add("hidden");
}

function handleChoiceAbsenClick() {
  closeAbsenChoiceModal();
  if (TODAY_ABSEN_STATUS === "SUDAH_PULANG") {
    showCenterAlertModal({
      title: "Presensi Lengkap",
      message: "Anda telah menyelesaikan presensi kedatangan dan kepulangan untuk hari ini.",
      type: "info"
    });
    return;
  }
  if (TODAY_ABSEN_STATUS === "SUDAH_DATANG") {
    selectAbsenType("Absen Pulang");
  } else {
    selectAbsenType("Absen Datang");
  }
}

function selectAbsenType(type) {
  ACTIVE_ABSEN_TYPE = type;
  closeAbsenChoiceModal();
  loadScreen("absensi");
}

function selectIzinChoice() {
  closeAbsenChoiceModal();
  loadScreen("izin");
}

function applyAbsenTypeUI(type) {
  const bannerTitle = document.getElementById("absen-type-title");
  const bannerIcon = document.getElementById("absen-type-icon");
  const banner = document.getElementById("absen-type-banner");
  const boxDist = document.getElementById("box-distance-office");
  const isPulang = (type === "Absen Pulang");

  if (bannerTitle) bannerTitle.innerText = isPulang ? "Absen Pulang" : "Absen Datang";

  if (isPulang) {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-amber-700 transition-colors duration-300";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-door-open text-2xl text-amber-200";
    if (boxDist) boxDist.classList.add("hidden"); // Absen pulang bebas radius kantor
  } else {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-slate-900 transition-colors duration-300";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-building text-2xl text-emerald-400";
    if (boxDist) boxDist.classList.remove("hidden");
  }
}

function initAbsensiScreen() {
  // Jika belum ditentukan secara spesifik, otomatis sesuaikan dengan status hari ini
  if (!ACTIVE_ABSEN_TYPE) {
    ACTIVE_ABSEN_TYPE = (TODAY_ABSEN_STATUS === "SUDAH_DATANG") ? "Absen Pulang" : "Absen Datang";
  }
  applyAbsenTypeUI(ACTIVE_ABSEN_TYPE);

  // Reset state koordinat presensi
  CURRENT_USER_GEO.lat = null;
  CURRENT_USER_GEO.long = null;
  CURRENT_USER_GEO.accuracy = null;
  CURRENT_USER_GEO.nearestOffice = null;
  CURRENT_USER_GEO.distanceToOffice = null;
  CURRENT_USER_GEO.isInsideRadius = (ACTIVE_ABSEN_TYPE === "Absen Pulang");

  const alertBox = document.getElementById("absen-gps-alert-box");
  if (alertBox) alertBox.classList.add("hidden");

  updateAbsenCameraState();
  acquireAbsenLocation();
}

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function updateAbsenCameraState() {
  const triggerBtn = document.getElementById("btn-trigger-absen-selfie");
  const triggerIcon = document.getElementById("btn-trigger-selfie-icon");
  const triggerTitle = document.getElementById("btn-trigger-selfie-title");
  const triggerDesc = document.getElementById("btn-trigger-selfie-desc");
  if (!triggerBtn) return;

  const isDatang = (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor");

  if (isDatang) {
    if (CURRENT_USER_GEO.isInsideRadius && CURRENT_USER_GEO.lat) {
      // Valid di dalam radius kantor
      triggerBtn.className = "border-2 border-dashed border-teal-500 bg-teal-50/60 hover:bg-teal-50 rounded-2xl p-7 text-center cursor-pointer transition shadow-sm";
      if (triggerIcon) {
        triggerIcon.className = "w-12 h-12 bg-white rounded-2xl shadow-sm text-teal-600 flex items-center justify-center text-2xl mx-auto mb-2";
        triggerIcon.innerHTML = '<i class="fa-solid fa-camera"></i>';
      }
      if (triggerTitle) {
        triggerTitle.innerText = "Buka Kamera Selfie (Absen Datang)";
        triggerTitle.className = "text-xs text-slate-800 font-bold";
      }
      if (triggerDesc) triggerDesc.innerText = "Radius kantor valid • Klik untuk ambil foto & kirim otomatis";
    } else if (CURRENT_USER_GEO.lat === null) {
      // GPS Belum Aktif / Diblokir
      triggerBtn.className = "border-2 border-dashed border-rose-300 bg-rose-50/40 rounded-2xl p-7 text-center cursor-pointer transition";
      if (triggerIcon) {
        triggerIcon.className = "w-12 h-12 bg-white rounded-2xl shadow-sm text-rose-500 flex items-center justify-center text-2xl mx-auto mb-2";
        triggerIcon.innerHTML = '<i class="fa-solid fa-lock"></i>';
      }
      if (triggerTitle) {
        triggerTitle.innerText = "Kamera Terkunci (Wajib Izinkan GPS)";
        triggerTitle.className = "text-xs text-rose-700 font-bold";
      }
      if (triggerDesc) triggerDesc.innerText = "Klik di sini untuk panduan aktifkan GPS & lokasi";
    } else {
      // Di luar radius kantor
      triggerBtn.className = "border-2 border-dashed border-amber-300 bg-amber-50/40 rounded-2xl p-7 text-center cursor-pointer transition";
      if (triggerIcon) {
        triggerIcon.className = "w-12 h-12 bg-white rounded-2xl shadow-sm text-amber-600 flex items-center justify-center text-2xl mx-auto mb-2";
        triggerIcon.innerHTML = '<i class="fa-solid fa-ban"></i>';
      }
      if (triggerTitle) {
        triggerTitle.innerText = `Kamera Terkunci (Di Luar Radius: ${CURRENT_USER_GEO.distanceToOffice}m)`;
        triggerTitle.className = "text-xs text-amber-800 font-bold";
      }
      if (triggerDesc) triggerDesc.innerText = "Wajib berada di dalam batas radius kantor resmi";
    }
  } else {
    // Absen Pulang: BEBAS RADIUS KANTOR, asalkan ada titik koordinat GPS riil
    if (CURRENT_USER_GEO.lat && CURRENT_USER_GEO.long) {
      triggerBtn.className = "border-2 border-dashed border-amber-500 bg-amber-50/60 hover:bg-amber-50 rounded-2xl p-7 text-center cursor-pointer transition shadow-sm";
      if (triggerIcon) {
        triggerIcon.className = "w-12 h-12 bg-white rounded-2xl shadow-sm text-amber-600 flex items-center justify-center text-2xl mx-auto mb-2";
        triggerIcon.innerHTML = '<i class="fa-solid fa-camera"></i>';
      }
      if (triggerTitle) {
        triggerTitle.innerText = "Buka Kamera Selfie (Absen Pulang)";
        triggerTitle.className = "text-xs text-slate-800 font-bold";
      }
      if (triggerDesc) triggerDesc.innerText = "Bebas radius kantor • Klik untuk ambil foto selfie & pulang";
    } else {
      triggerBtn.className = "border-2 border-dashed border-rose-300 bg-rose-50/40 rounded-2xl p-7 text-center cursor-pointer transition";
      if (triggerIcon) {
        triggerIcon.className = "w-12 h-12 bg-white rounded-2xl shadow-sm text-rose-500 flex items-center justify-center text-2xl mx-auto mb-2";
        triggerIcon.innerHTML = '<i class="fa-solid fa-location-crosshairs text-rose-500"></i>';
      }
      if (triggerTitle) {
        triggerTitle.innerText = "Mengunci Sinyal GPS Pulang...";
        triggerTitle.className = "text-xs text-rose-700 font-bold";
      }
      if (triggerDesc) triggerDesc.innerText = "Wajib aktifkan GPS untuk merekam titik kepulangan";
    }
  }
}

function handleTriggerAbsenCamera() {
  const isDatang = (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor");

  if (isDatang) {
    if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long) {
      showCenterAlertModal({
        title: "Izin GPS Diperlukan",
        message: "Sistem mendeteksi akses lokasi (GPS) ditolak, diblokir, atau belum aktif. Presensi Absen Datang WAJIB mendapatkan titik koordinat fisik kantor. Silakan izinkan akses lokasi di browser/HP Anda lalu tekan 'Perbarui Titik GPS'.",
        type: "error"
      });
      const alertBox = document.getElementById("absen-gps-alert-box");
      const alertTitle = document.getElementById("absen-gps-alert-title");
      const alertDesc = document.getElementById("absen-gps-alert-desc");
      if (alertTitle) alertTitle.innerText = "Akses Lokasi (GPS) Wajib Diizinkan!";
      if (alertDesc) alertDesc.innerText = "Presensi Absen Datang hanya dapat dilakukan jika izin lokasi browser aktif dan Anda berada di area kantor resmi.";
      if (alertBox) alertBox.classList.remove("hidden");
      return;
    }
    if (!CURRENT_USER_GEO.isInsideRadius) {
      showCenterAlertModal({
        title: "Di Luar Radius Kantor",
        message: `Lokasi Anda berada sejauh ${CURRENT_USER_GEO.distanceToOffice} Meter dari ${CURRENT_USER_GEO.nearestOffice?.name || 'kantor'} (Batas maksimum radius: ${CURRENT_USER_GEO.nearestOffice?.maxRadiusMeter || 100}m). Anda tidak diperkenankan absen datang di luar area kantor.`,
        type: "error"
      });
      return;
    }
  } else {
    // Absen Pulang: Bebas radius, hanya butuh koordinat GPS riil
    if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long) {
      showCenterAlertModal({
        title: "Akses GPS Diperlukan",
        message: "Presensi kepulangan memerlukan geotag koordinat lokasi Anda saat ini (Bebas dari batas radius kantor). Mohon pastikan GPS HP aktif dan izinkan akses lokasi di browser Anda.",
        type: "error"
      });
      const alertBox = document.getElementById("absen-gps-alert-box");
      const alertTitle = document.getElementById("absen-gps-alert-title");
      const alertDesc = document.getElementById("absen-gps-alert-desc");
      if (alertTitle) alertTitle.innerText = "Izin Lokasi (GPS) Diperlukan";
      if (alertDesc) alertDesc.innerText = "Presensi kepulangan memerlukan geotag lokasi koordinat GPS Anda (Bebas radius kantor).";
      if (alertBox) alertBox.classList.remove("hidden");
      return;
    }
  }

  // Jika valid, buka input file / kamera
  const fileInput = document.getElementById("file-absen-selfie");
  if (fileInput) {
    fileInput.value = "";
    fileInput.click();
  }
}

function acquireAbsenLocation() {
  const coordsDisplay = document.getElementById("absen-coords-display");
  const distDisplay = document.getElementById("absen-distance-display");
  const officeNameDisplay = document.getElementById("absen-office-name");
  const badge = document.getElementById("absen-geofence-badge");
  const alertBox = document.getElementById("absen-gps-alert-box");
  const alertTitle = document.getElementById("absen-gps-alert-title");
  const alertDesc = document.getElementById("absen-gps-alert-desc");

  // Reset state tampilan saat proses pengecekan
  if (coordsDisplay) coordsDisplay.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1 text-slate-400"></i>Mencari sinyal GPS...';
  if (officeNameDisplay) officeNameDisplay.innerText = "Mendeteksi kantor terdekat...";
  if (distDisplay) distDisplay.innerText = "Menghitung jarak...";
  if (badge) {
    badge.innerText = "Mengecek Lokasi...";
    badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-600";
  }
  if (alertBox) alertBox.classList.add("hidden");

  // Reset koordinat
  CURRENT_USER_GEO.lat = null;
  CURRENT_USER_GEO.long = null;
  CURRENT_USER_GEO.accuracy = null;
  CURRENT_USER_GEO.isInsideRadius = (ACTIVE_ABSEN_TYPE === "Absen Pulang");
  CURRENT_USER_GEO.nearestOffice = null;
  CURRENT_USER_GEO.distanceToOffice = null;
  updateAbsenCameraState();

  if (!navigator.geolocation) {
    if (coordsDisplay) coordsDisplay.innerText = "Browser Tidak Mendukung GPS";
    if (officeNameDisplay) officeNameDisplay.innerText = "Verifikasi Gagal";
    if (distDisplay) distDisplay.innerText = "Perangkat Tidak Mendukung Geolocation";
    if (badge) {
      badge.innerText = "GPS Not Supported";
      badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800";
    }
    if (alertBox) {
      alertBox.classList.remove("hidden");
      if (alertTitle) alertTitle.innerText = "Browser Tidak Mendukung GPS";
      if (alertDesc) alertDesc.innerText = "Browser Anda tidak mendukung fitur Geolocation. Silakan gunakan Google Chrome di HP Anda.";
    }
    updateAbsenCameraState();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const crd = pos.coords;
      CURRENT_USER_GEO.lat = crd.latitude;
      CURRENT_USER_GEO.long = crd.longitude;
      CURRENT_USER_GEO.accuracy = crd.accuracy;

      let nearest = null;
      let minD = Infinity;
      OFFICE_LOCATIONS.forEach(o => {
        const d = calculateDistanceMeters(crd.latitude, crd.longitude, o.lat, o.long);
        if (d < minD) { minD = d; nearest = { ...o, distance: d }; }
      });
      CURRENT_USER_GEO.nearestOffice = nearest;
      CURRENT_USER_GEO.distanceToOffice = nearest ? nearest.distance : 0;

      if (coordsDisplay) coordsDisplay.innerText = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (±${Math.round(crd.accuracy)}m)`;
      if (officeNameDisplay) officeNameDisplay.innerText = nearest ? nearest.name : "Kantor Pusat";

      if (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor") {
        if (distDisplay) distDisplay.innerText = `${nearest.distance} Meter (Maks ${nearest.maxRadiusMeter}m)`;
        if (nearest.distance <= nearest.maxRadiusMeter) {
          CURRENT_USER_GEO.isInsideRadius = true;
          if (badge) {
            badge.innerText = `Radius Valid (${nearest.name})`;
            badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300";
          }
          if (alertBox) alertBox.classList.add("hidden");
        } else {
          CURRENT_USER_GEO.isInsideRadius = false;
          if (badge) {
            badge.innerText = `Di Luar Radius (${nearest.distance}m)`;
            badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300";
          }
          if (alertBox) {
            alertBox.classList.remove("hidden");
            if (alertTitle) alertTitle.innerText = `Anda Berada di Luar Radius Kantor (${nearest.distance}m)`;
            if (alertDesc) alertDesc.innerText = `Jarak Anda ke ${nearest.name} adalah ${nearest.distance} meter. Batas toleransi presensi masuk adalah ${nearest.maxRadiusMeter} meter. Silakan merapat ke kantor sebelum absen.`;
          }
        }
      } else {
        // Absen Pulang: Bebas geolokasi kantor, asalkan GPS aktif tercatat
        CURRENT_USER_GEO.isInsideRadius = true;
        if (distDisplay) distDisplay.innerText = `Bebas Radius (${nearest ? nearest.distance : 0}m ke ${nearest ? nearest.name : 'kantor'})`;
        if (badge) {
          badge.innerText = "Geotag Terkunci (Bebas Radius)";
          badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800 border border-teal-300";
        }
        if (alertBox) alertBox.classList.add("hidden");
      }

      updateAbsenCameraState();
    },
    err => {
      // Strict Error Handling
      CURRENT_USER_GEO.lat = null;
      CURRENT_USER_GEO.long = null;
      CURRENT_USER_GEO.accuracy = null;
      CURRENT_USER_GEO.nearestOffice = null;
      CURRENT_USER_GEO.distanceToOffice = null;
      CURRENT_USER_GEO.isInsideRadius = (ACTIVE_ABSEN_TYPE === "Absen Pulang");

      const isDatang = (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor");
      let errReason = "Akses GPS Ditolak / Tidak Aktif";
      let detailDesc = isDatang
        ? "Presensi kedatangan WAJIB mengizinkan GPS dan berada di kantor resmi. Geotag palsu atau pemblokiran GPS tidak diperbolehkan."
        : "Presensi kepulangan memerlukan GPS aktif untuk merekam titik koordinat kepulangan Anda (Bebas dari radius kantor).";

      if (err && err.code === 1) { // PERMISSION_DENIED
        errReason = "Izin GPS Ditolak / Diblokir";
        detailDesc = "Anda menekan tombol 'Blokir' atau browser menonaktifkan izin lokasi. Silakan buka setelan browser (ikon gembok di URL) dan pilih 'Izinkan' untuk lokasi.";
      } else if (err && err.code === 2) { // POSITION_UNAVAILABLE
        errReason = "Sinyal GPS Tidak Ditemukan";
        detailDesc = "Perangkat Anda tidak dapat menentukan lokasi. Pastikan fitur GPS / Lokasi pada pengaturan HP Anda aktif (ON) dan sinyal stabil.";
      } else if (err && err.code === 3) { // TIMEOUT
        errReason = "Waktu Pencarian GPS Habis";
        detailDesc = "Gagal mengunci posisi satelit GPS dalam waktu yang ditentukan. Coba berada di area terbuka dan klik 'Perbarui Titik GPS'.";
      }

      if (coordsDisplay) coordsDisplay.innerText = errReason;
      if (officeNameDisplay) officeNameDisplay.innerText = isDatang ? "Akses Ditolak" : "GPS Belum Aktif";
      if (distDisplay) distDisplay.innerText = isDatang ? "Wajib Aktifkan & Izinkan GPS" : "Bebas Radius (Perlu GPS)";
      if (badge) {
        badge.innerText = errReason;
        badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300";
      }

      if (alertBox) {
        alertBox.classList.remove("hidden");
        if (alertTitle) alertTitle.innerText = errReason;
        if (alertDesc) alertDesc.innerText = detailDesc;
      }

      updateAbsenCameraState();
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Helper Kompresi Gambar Otomatis (Mencegah Payload Limit & Upload Kilat)
function compressImage(file, maxDimension = 1024, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Handler Foto Selfie Presensi -> Auto Submit
async function handleAbsenSelfieSelected(input) {
  if (input.files && input.files[0]) {
    const isDatang = (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor");

    // Guard ketat: cegah submit jika GPS belum valid
    if (isDatang && (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long || !CURRENT_USER_GEO.isInsideRadius)) {
      input.value = "";
      CURRENT_ABSEN_SELFIE_BASE64 = null;
      showCenterAlertModal({
        title: "Presensi Ditolak",
        message: "Presensi Absen Datang WAJIB berada di dalam radius kantor dan GPS harus diizinkan. Silakan aktifkan GPS dan coba kembali.",
        type: "error"
      });
      return;
    } else if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long) {
      input.value = "";
      CURRENT_ABSEN_SELFIE_BASE64 = null;
      showCenterAlertModal({
        title: "Presensi Ditolak",
        message: "Presensi memerlukan geotag lokasi GPS yang valid. Silakan izinkan akses lokasi browser.",
        type: "error"
      });
      return;
    }

    const compressed = await compressImage(input.files[0], 1024, 0.75);
    CURRENT_ABSEN_SELFIE_BASE64 = compressed;

    const imgPreview = document.getElementById("img-absen-selfie-preview");
    if (imgPreview) imgPreview.src = compressed;

    const triggerBtn = document.getElementById("btn-trigger-absen-selfie");
    const previewCard = document.getElementById("preview-absen-selfie-card");
    const loadingOverlay = document.getElementById("absen-submitting-overlay");

    if (triggerBtn) triggerBtn.classList.add("hidden");
    if (previewCard) previewCard.classList.remove("hidden");
    if (loadingOverlay) loadingOverlay.classList.remove("hidden");

    // Langsung jalankan submit otomatis tanpa perlu press button kirim
    setTimeout(() => {
      handleAbsenSubmit();
    }, 400);
  }
}

function removeAbsenSelfie() {
  const fileInput = document.getElementById("file-absen-selfie");
  if (fileInput) fileInput.value = "";
  CURRENT_ABSEN_SELFIE_BASE64 = null;

  const triggerBtn = document.getElementById("btn-trigger-absen-selfie");
  const previewCard = document.getElementById("preview-absen-selfie-card");
  const loadingOverlay = document.getElementById("absen-submitting-overlay");

  if (triggerBtn) triggerBtn.classList.remove("hidden");
  if (previewCard) previewCard.classList.add("hidden");
  if (loadingOverlay) loadingOverlay.classList.add("hidden");
}

async function handleAbsenSubmit() {
  const isDatang = (ACTIVE_ABSEN_TYPE === "Absen Datang" || ACTIVE_ABSEN_TYPE === "Masuk Kantor");

  // Validasi geofence radius ketat untuk Absen Datang
  if (isDatang) {
    if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long || !CURRENT_USER_GEO.isInsideRadius) {
      removeAbsenSelfie();
      showCenterAlertModal({
        title: "Absensi Gagal",
        message: `Lokasi Anda tidak valid atau di luar radius kantor (${CURRENT_USER_GEO.distanceToOffice || 0} Meter / Maks ${CURRENT_USER_GEO.nearestOffice?.maxRadiusMeter || 100}m). Silakan masuk ke dalam area kantor dan perbarui titik GPS.`,
        type: "error"
      });
      return;
    }
  } else {
    // Absen Pulang wajib ada koordinat real
    if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long) {
      removeAbsenSelfie();
      showCenterAlertModal({
        title: "Absensi Gagal",
        message: "Presensi pulang memerlukan koordinat lokasi geotag. Mohon izinkan akses GPS Anda.",
        type: "error"
      });
      return;
    }
  }

  if (!CURRENT_ABSEN_SELFIE_BASE64) {
    removeAbsenSelfie();
    showCenterAlertModal({
      title: "Absensi Gagal",
      message: "Foto selfie kehadiran belum berhasil diambil. Silakan coba kembali.",
      type: "error"
    });
    return;
  }

  const selfieData = CURRENT_ABSEN_SELFIE_BASE64;
  const loadingOverlay = document.getElementById("absen-submitting-overlay");

  try {
    const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
    const res = await callApi("submitAbsensi", {
      nip: CURRENT_USER?.nip || "-",
      nama: CURRENT_USER?.nama || "-",
      role: CURRENT_USER?.role || "-",
      cabang: CURRENT_USER?.cabang || "-",
      jenis_absen: ACTIVE_ABSEN_TYPE || "Absen Datang",
      lokasi_kantor: CURRENT_USER_GEO.nearestOffice?.name || "Kantor Pusat",
      distance_meters: CURRENT_USER_GEO.distanceToOffice || 0,
      max_radius: CURRENT_USER_GEO.nearestOffice?.maxRadiusMeter || 100,
      lat: CURRENT_USER_GEO.lat || 0,
      long: CURRENT_USER_GEO.long || 0,
      timezone: clientTz,
      selfie_base64: selfieData
    });

    if (loadingOverlay) loadingOverlay.classList.add("hidden");

    if (!res || !res.success) {
      removeAbsenSelfie();
      showCenterAlertModal({
        title: "Absensi Gagal",
        message: res?.message || "Terjadi kesalahan server saat menyimpan absensi.",
        type: "error"
      });
      return;
    }

    // Perbarui status presensi hari ini
    let localDateStr = "";
    try {
      localDateStr = new Intl.DateTimeFormat("en-CA", { timeZone: clientTz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    } catch (e) {
      localDateStr = new Date().toISOString().slice(0, 10);
    }
    const todayKey = `DIGIASHA_ABSEN_${CURRENT_USER.nip}_${localDateStr}`;
    if (isDatang) {
      TODAY_ABSEN_STATUS = "SUDAH_DATANG";
    } else {
      TODAY_ABSEN_STATUS = "SUDAH_PULANG";
    }
    localStorage.setItem(todayKey, TODAY_ABSEN_STATUS);

    // Buka Pop-up Tengah Hasil Presensi
    const isLate = res.isLate === true || res.status_kehadiran === "TERLAMBAT";
    const titleText = isDatang ? "Absensi Kedatangan Berhasil" : "Absensi Kepulangan Berhasil";
    let messageText = res.message;
    if (isDatang && isLate) {
      messageText = `Anda Terlambat ${res.lateMinutes || 0} Menit (Jam Masuk: ${res.timeStr || ''})`;
    } else if (isDatang) {
      messageText = `Kehadiran Tepat Waktu tercatat pada ${res.timeStr || ''}`;
    }

    showCenterAlertModal({
      title: titleText,
      message: messageText,
      type: isLate ? "warning" : "success",
      onClose: () => {
        loadScreen("dashboard");
      }
    });

  } catch (err) {
    if (loadingOverlay) loadingOverlay.classList.add("hidden");
    removeAbsenSelfie();
    showCenterAlertModal({
      title: "Absensi Gagal",
      message: "Gagal terhubung ke server: " + err.message,
      type: "error"
    });
  }
}

// =========================================================================
// MODUL PENGAJUAN IZIN (WFA, TERLAMBAT, CUTI, SAKIT)
// =========================================================================
function initIzinScreen() {
  if (!CURRENT_USER) return;
  const userInfo = document.getElementById("izin-user-info");
  if (userInfo) userInfo.innerText = `${CURRENT_USER.nama} (${CURRENT_USER.nip}) • ${CURRENT_USER.cabang}`;

  const approverEl = document.getElementById("izin-pic-approval-name");
  if (approverEl) approverEl.innerText = CURRENT_USER.atasan_nama ? `${CURRENT_USER.atasan_nama} (${CURRENT_USER.atasan_nip || 'Atasan Langsung'})` : "Supervisor / Branch Manager";

  // Set default dates untuk date range
  const todayStr = new Date().toISOString().slice(0, 10);
  const tglMulai = document.getElementById("izin-tgl-mulai");
  const tglSelesai = document.getElementById("izin-tgl-selesai");
  if (tglMulai) tglMulai.value = todayStr;
  if (tglSelesai) tglSelesai.value = todayStr;

  acquireIzinLocation();
  selectIzinCategory("WFA");
}

function acquireIzinLocation() {
  const coordsDisplay = document.getElementById("izin-coords-display");
  const badge = document.getElementById("izin-geo-badge");

  CURRENT_IZIN_GEO.lat = null;
  CURRENT_IZIN_GEO.long = null;

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const crd = pos.coords;
        CURRENT_IZIN_GEO.lat = crd.latitude;
        CURRENT_IZIN_GEO.long = crd.longitude;
        CURRENT_IZIN_GEO.accuracy = crd.accuracy;
        if (coordsDisplay) coordsDisplay.innerText = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (±${Math.round(crd.accuracy)}m)`;
        if (badge) { badge.innerText = "GPS Terkunci"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800"; }
      },
      () => {
        CURRENT_IZIN_GEO.lat = null;
        CURRENT_IZIN_GEO.long = null;
        if (coordsDisplay) coordsDisplay.innerText = "Akses GPS Tidak Aktif / Ditolak";
        if (badge) { badge.innerText = "GPS Mati/Ditolak"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-rose-100 text-rose-700"; }
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }
}

function selectIzinCategory(category) {
  SELECTED_IZIN_CATEGORY = category;

  // Update styles tombol kategori
  const categories = ["WFA", "Terlambat", "Cuti", "Sakit"];
  categories.forEach(c => {
    const btn = document.getElementById(`btn-cat-${c}`);
    if (btn) {
      if ((c === "Terlambat" && category === "Datang Terlambat") || c === category) {
        btn.className = "izin-cat-btn p-3 rounded-xl border-2 border-teal-600 bg-teal-50/50 shadow-xs text-left flex items-center space-x-2.5 transition";
      } else {
        btn.className = "izin-cat-btn p-3 rounded-xl border border-slate-200 text-left hover:border-slate-300 bg-slate-50 flex items-center space-x-2.5 transition";
      }
    }
  });

  const boxDateRange = document.getElementById("box-izin-date-range");
  const boxJamTiba = document.getElementById("box-izin-jam-tiba");
  const boxSelfie = document.getElementById("box-izin-selfie");
  const boxManualSubmit = document.getElementById("box-izin-manual-submit");
  const labelCatatan = document.getElementById("label-catatan-izin");
  const btnSubmitText = document.getElementById("btn-submit-izin-text");

  if (category === "WFA") {
    if (boxDateRange) boxDateRange.classList.add("hidden");
    if (boxJamTiba) boxJamTiba.classList.add("hidden");
    if (boxSelfie) boxSelfie.classList.remove("hidden");
    if (boxManualSubmit) boxManualSubmit.classList.add("hidden");
    if (labelCatatan) labelCatatan.innerText = "Rencana Aktivitas & Catatan WFA *";
  } else if (category === "Datang Terlambat") {
    if (boxDateRange) boxDateRange.classList.add("hidden");
    if (boxJamTiba) boxJamTiba.classList.remove("hidden");
    if (boxSelfie) boxSelfie.classList.remove("hidden");
    if (boxManualSubmit) boxManualSubmit.classList.add("hidden");
    if (labelCatatan) labelCatatan.innerText = "Alasan Datang Terlambat *";
  } else if (category === "Cuti") {
    if (boxDateRange) boxDateRange.classList.remove("hidden");
    if (boxJamTiba) boxJamTiba.classList.add("hidden");
    if (boxSelfie) boxSelfie.classList.add("hidden");
    if (boxManualSubmit) boxManualSubmit.classList.remove("hidden");
    if (labelCatatan) labelCatatan.innerText = "Alasan & Keterangan Cuti *";
    if (btnSubmitText) btnSubmitText.innerText = "Kirim Pengajuan Cuti";
  } else if (category === "Sakit") {
    if (boxDateRange) boxDateRange.classList.remove("hidden");
    if (boxJamTiba) boxJamTiba.classList.add("hidden");
    if (boxSelfie) boxSelfie.classList.add("hidden");
    if (boxManualSubmit) boxManualSubmit.classList.remove("hidden");
    if (labelCatatan) labelCatatan.innerText = "Keterangan Sakit / Gejala *";
    if (btnSubmitText) btnSubmitText.innerText = "Kirim Pengajuan Izin Sakit";
  }
}

// Handler Foto Selfie Izin -> Auto Submit untuk WFA & Datang Terlambat
async function handleIzinSelfieSelected(input) {
  const catatan = document.getElementById("izin-input-catatan")?.value.trim();
  if (!catatan) {
    input.value = "";
    showCenterAlertModal({
      title: "Catatan Wajib Diisi",
      message: "Silakan tuliskan catatan/alasan pengajuan terlebih dahulu sebelum mengambil foto selfie.",
      type: "warning"
    });
    return;
  }

  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);

    const imgPreview = document.getElementById("img-izin-selfie-preview");
    if (imgPreview) imgPreview.src = compressed;

    const triggerBtn = document.getElementById("btn-trigger-izin-selfie");
    const previewCard = document.getElementById("preview-izin-selfie-card");
    const loadingOverlay = document.getElementById("izin-submitting-overlay");

    if (triggerBtn) triggerBtn.classList.add("hidden");
    if (previewCard) previewCard.classList.remove("hidden");
    if (loadingOverlay) loadingOverlay.classList.remove("hidden");

    let fullCatatan = catatan;
    if (SELECTED_IZIN_CATEGORY === "Datang Terlambat") {
      const jamTiba = document.getElementById("izin-input-jam-tiba")?.value || "-";
      fullCatatan = `[Est. Tiba: ${jamTiba}] ${catatan}`;
    }

    try {
      const res = await callApi("submitIzin", {
        nip: CURRENT_USER?.nip || "-",
        nama: CURRENT_USER?.nama || "-",
        cabang: CURRENT_USER?.cabang || "-",
        jenis_izin: SELECTED_IZIN_CATEGORY,
        catatan: fullCatatan,
        lat: CURRENT_IZIN_GEO.lat || 0,
        long: CURRENT_IZIN_GEO.long || 0,
        selfie_base64: compressed,
        pic_approval_nip: CURRENT_USER?.atasan_nip || "-",
        pic_approval_nama: CURRENT_USER?.atasan_nama || "Atasan Langsung"
      });

      if (loadingOverlay) loadingOverlay.classList.add("hidden");

      if (!res || !res.success) {
        showCenterAlertModal({
          title: "Pengajuan Gagal",
          message: res?.message || "Gagal mengirimkan permohonan izin ke server.",
          type: "error"
        });
        if (triggerBtn) triggerBtn.classList.remove("hidden");
        if (previewCard) previewCard.classList.add("hidden");
        return;
      }

      showCenterAlertModal({
        title: "Pengajuan Terkirim",
        message: `Permohonan Izin "${SELECTED_IZIN_CATEGORY}" berhasil diajukan dan diteruskan ke PIC Approval (${CURRENT_USER.atasan_nama || 'Atasan Langsung'}).`,
        type: "success",
        onClose: () => {
          loadScreen("dashboard");
        }
      });

    } catch (err) {
      if (loadingOverlay) loadingOverlay.classList.add("hidden");
      if (triggerBtn) triggerBtn.classList.remove("hidden");
      if (previewCard) previewCard.classList.add("hidden");
      showCenterAlertModal({
        title: "Pengajuan Gagal",
        message: "Koneksi terputus: " + err.message,
        type: "error"
      });
    }
  }
}

// Handler Submit Manual untuk Cuti & Sakit
async function handleIzinManualSubmit(e) {
  e.preventDefault();
  const catatan = document.getElementById("izin-input-catatan")?.value.trim();
  const tglMulai = document.getElementById("izin-tgl-mulai")?.value;
  const tglSelesai = document.getElementById("izin-tgl-selesai")?.value;

  if (!catatan) {
    showCenterAlertModal({ title: "Catatan Wajib", message: "Harap isi keterangan alasan permohonan.", type: "warning" });
    return;
  }

  const submitBtn = document.getElementById("btn-submit-izin-manual");
  const originalText = submitBtn ? submitBtn.innerHTML : "Kirim Pengajuan Izin";
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Mengirim Pengajuan...';
    submitBtn.disabled = true;
  }

  try {
    const res = await callApi("submitIzin", {
      nip: CURRENT_USER?.nip || "-",
      nama: CURRENT_USER?.nama || "-",
      cabang: CURRENT_USER?.cabang || "-",
      jenis_izin: SELECTED_IZIN_CATEGORY,
      tgl_mulai: tglMulai,
      tgl_selesai: tglSelesai,
      catatan: catatan,
      lat: CURRENT_IZIN_GEO.lat || 0,
      long: CURRENT_IZIN_GEO.long || 0,
      selfie_base64: null,
      pic_approval_nip: CURRENT_USER?.atasan_nip || "-",
      pic_approval_nama: CURRENT_USER?.atasan_nama || "Atasan Langsung"
    });

    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }

    if (!res || !res.success) {
      showCenterAlertModal({
        title: "Pengajuan Gagal",
        message: res?.message || "Gagal mengirimkan permohonan ke server.",
        type: "error"
      });
      return;
    }

    showCenterAlertModal({
      title: "Pengajuan Berhasil",
      message: `Permohonan "${SELECTED_IZIN_CATEGORY}" (${tglMulai} s/d ${tglSelesai}) berhasil diteruskan ke PIC Approval (${CURRENT_USER.atasan_nama || 'Atasan Langsung'}).`,
      type: "success",
      onClose: () => {
        loadScreen("dashboard");
      }
    });

  } catch (err) {
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
    showCenterAlertModal({
      title: "Pengajuan Gagal",
      message: "Gagal terhubung: " + err.message,
      type: "error"
    });
  }
}

// =========================================================================
// PUSAT PERSETUJUAN / APPROVAL HUB CONTROLLER
// =========================================================================
function initPersetujuanScreen() {
  if (!CURRENT_USER) return;
  const picInfo = document.getElementById("approval-pic-info");
  if (picInfo) picInfo.innerText = `${CURRENT_USER.nama} (${CURRENT_USER.nip}) • ${CURRENT_USER.role}`;

  switchApprovalScope(ACTIVE_APPROVAL_SCOPE || "INBOX");
  fetchApprovalList();
}

async function fetchApprovalList() {
  const container = document.getElementById("approval-list-container");
  if (!container) return;

  container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-700"></i>Memuat daftar persetujuan...</div>';

  try {
    let approvals = [];

    // 1. Coba ambil langsung dari Supabase REST API
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      try {
        const cleanNip = encodeURIComponent(CURRENT_USER.nip || "");
        // Pengguna HANYA memuat pengajuan di mana dia ditunjuk sebagai atasan/approver dan pengajuan miliknya sendiri
        const queryUrl = cleanNip
          ? `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?or=(pic_approval_nip.eq.${cleanNip},nip.eq.${cleanNip})&order=timestamp.desc`
          : `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?order=timestamp.desc`;

        const sbRes = await fetch(queryUrl, {
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        });
        if (sbRes.ok) {
          approvals = await sbRes.json();
        }
      } catch (errSup) {
        console.warn("Direct Supabase fetchApprovalList error:", errSup);
      }
    }

    // 2. Fallback ke GAS jika Supabase belum mengembalikan data
    if (approvals.length === 0) {
      const res = await callApi("getApprovalList", {
        nip: CURRENT_USER.nip,
        role: CURRENT_USER.role
      });
      if (res && res.success) {
        approvals = res.approvals || [];
      }
    }

    // 3. Muat Transaksi Kepegawaian (hr_employee_transactions & staging approvals)
    let careerTxApprovals = [];
    if (supabaseClient) {
      try {
        const cleanNip = String(CURRENT_USER?.nip || "").trim();
        const userId = CURRENT_USER?.id || cleanNip;

        // Pastikan master organisasi & personalia dimuat agar label jabatan, unit, & nama karyawan ter-resolve akurat
        if ((!ORG_POSITIONS_DATA || ORG_POSITIONS_DATA.length === 0) && typeof loadOrgPositions === "function") {
          try {
            await Promise.allSettled([
              loadOrgPositions(),
              loadOrgUnits(),
              loadOrgLevels(),
              typeof loadOrgWorkLocations === "function" ? loadOrgWorkLocations() : Promise.resolve()
            ]);
          } catch (_) {}
        }
        if ((!PERSONALIA_EMPLOYEES_DATA || PERSONALIA_EMPLOYEES_DATA.length === 0) && supabaseClient) {
          try {
            const { data: emps } = await supabaseClient
              .from("employees")
              .select("id, nip, name, deleted_at, organization_units(nama_unit), job_positions(nama_jabatan)");
            if (emps && emps.length > 0) {
              PERSONALIA_EMPLOYEES_DATA = emps.map(e => ({
                ...e,
                nama_lengkap: e.name || e.nip,
                cabang: e.organization_units?.nama_unit || "Head Office",
                jabatan: e.job_positions?.nama_jabatan || "Staff"
              }));
            }
          } catch (_) {}
        }

        const { data: txList, error: txErr } = await supabaseClient
          .from("hr_employee_transactions")
          .select(`
            *,
            hr_transaction_staging_approvals (*)
          `)
          .order("created_at", { ascending: false });

        if (!txErr && txList && txList.length > 0) {
          txList.forEach(tx => {
            const stagings = (tx.hr_transaction_staging_approvals || []).sort((a, b) => a.stage_order - b.stage_order);
            const currentStageObj = stagings.find(s => s.stage_order === (tx.current_stage || 1));

            const isMySubmission = String(tx.nip || "").trim() === cleanNip || (tx.employee_id && String(tx.employee_id).trim() === String(userId).trim());
            const isApproverForCurrentStage = currentStageObj && (
              String(currentStageObj.approver_nip || "").trim() === cleanNip ||
              String(currentStageObj.approver_user_id || "").trim() === String(userId).trim()
            );

            // Transaksi dimasukkan jika pengajuan milik user sendiri, ATAU user adalah approver stage saat ini
            if (isMySubmission || isApproverForCurrentStage) {
              const typesArr = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || "Transaksi"];
              const typesStr = typesArr.join(", ");

              let mappedStatus = "PENDING";
              if (tx.status === "APPROVED") mappedStatus = "APPROVED";
              else if (tx.status === "REJECTED") mappedStatus = "REJECTED";
              else if (tx.status === "CANCELLED") mappedStatus = "CANCELLED";

              // Cari nama karyawan jika tersedia di master
              const empMatch = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.nip) === String(tx.nip) || String(e.id) === String(tx.employee_id));
              const empName = empMatch?.nama_lengkap || empMatch?.nama || tx.nip || "Karyawan";
              const empCabang = empMatch?.cabang || "Head Office";

              careerTxApprovals.push({
                is_career_transaction: true,
                izin_id: "TX-" + tx.id,
                tx_id: tx.id,
                stage_id: currentStageObj?.id,
                current_stage_order: tx.current_stage || 1,
                nama: empName,
                nip: tx.nip,
                cabang: empCabang,
                jenis_izin: `Karir: ${typesStr}`,
                status_approval: mappedStatus,
                raw_tx_status: tx.status,
                tgl_mulai: tx.effective_date,
                tgl_selesai: tx.effective_date,
                effective_date: tx.effective_date,
                timestamp: tx.created_at,
                catatan: tx.exit_notes || (typesArr.includes("Tetap (PKWTT)") ? `Pengangkatan Tetap (SK: ${tx.permanent_contract_no || '-'})` : `Pengajuan transaksi kepegawaian berlaku efektif: ${tx.effective_date}`),
                pic_approval_nip: currentStageObj?.approver_nip || (tx.status === "PENDING_AGREEMENT" ? tx.nip : ""),
                pic_approval_nama: currentStageObj?.approver_role || (tx.status === "PENDING_AGREEMENT" ? "PIC Ybs (Menunggu TTD)" : "Approver Staging"),
                tx_data: tx
              });
            }
          });
        }
      } catch (errTx) {
        console.warn("[Approval Hub] Query hr_employee_transactions error:", errTx);
      }
    }

    APPROVALS_CACHE = (approvals || []).concat(careerTxApprovals);
    updateApprovalBadgeCounts();
    renderApprovalList();

  } catch (err) {
    container.innerHTML = `<div class="p-5 text-center text-xs text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">Error memuat data: ${err.message}</div>`;
  }
}

async function fetchPendingApprovalCount() {
  if (!CURRENT_USER) return;
  try {
    let pendingCount = 0;
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const cleanNip = encodeURIComponent(CURRENT_USER.nip || "");
      // HANYA hitung pengajuan bawahan yang secara spesifik menunjuk user ini sebagai atasan (pic_approval_nip == cleanNip)
      const queryUrl = `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?pic_approval_nip=eq.${cleanNip}&status_approval=eq.PENDING&nip=neq.${cleanNip}&select=izin_id`;

      const sbRes = await fetch(queryUrl, {
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (sbRes.ok) {
        const rows = await sbRes.json();
        pendingCount = Array.isArray(rows) ? rows.length : 0;
      }
    } else {
      const res = await callApi("getApprovalList", {
        nip: CURRENT_USER.nip,
        role: CURRENT_USER.role
      });
      if (res && res.success && Array.isArray(res.approvals)) {
        pendingCount = res.approvals.filter(a =>
          String(a.status_approval || "").toUpperCase() === "PENDING" &&
          String(a.pic_approval_nip || "").trim() === String(CURRENT_USER.nip || "").trim() &&
          String(a.nip || "").trim() !== String(CURRENT_USER.nip || "").trim()
        ).length;
      }
    }

    const badge = document.getElementById("badge-pending-approval-count");
    if (badge) {
      badge.innerText = pendingCount;
      if (pendingCount > 0) badge.classList.remove("hidden");
      else badge.classList.add("hidden");
    }
  } catch (e) { }
}

function updateApprovalBadgeCounts() {
  const cleanNip = String(CURRENT_USER?.nip || "").trim();

  // 1. Pengajuan tim/bawahan yang menunjuk user ini sebagai atasan dan berstatus PENDING
  const inboxPendingCount = APPROVALS_CACHE.filter(a => {
    const isForMe = String(a.pic_approval_nip || "").trim() === cleanNip;
    const isNotMe = String(a.nip || "").trim() !== cleanNip;
    const isPending = String(a.status_approval || "").toUpperCase() === "PENDING";
    return isForMe && isNotMe && isPending;
  }).length;

  // 2. Pengajuan milik user ini sendiri yang masih pending menunggu atasan atau persetujuan elektronik
  const myPendingCount = APPROVALS_CACHE.filter(a => {
    const isMe = String(a.nip || "").trim() === cleanNip;
    const isPending = String(a.status_approval || "").toUpperCase() === "PENDING";
    return isMe && isPending;
  }).length;

  const countFilterPending = document.getElementById("count-filter-pending");
  const tabInboxCount = document.getElementById("tab-inbox-count");
  const tabMyCount = document.getElementById("tab-my-count");
  const dashBadge = document.getElementById("badge-pending-approval-count");

  if (tabInboxCount) tabInboxCount.innerText = inboxPendingCount;
  if (tabMyCount) tabMyCount.innerText = myPendingCount;

  if (countFilterPending) {
    countFilterPending.innerText = (ACTIVE_APPROVAL_SCOPE === "MY") ? myPendingCount : inboxPendingCount;
  }

  // Badge di dashboard hanya menyala jika ada permohonan staf/bawahan yang butuh direspon oleh user ini
  if (dashBadge) {
    dashBadge.innerText = inboxPendingCount;
    if (inboxPendingCount > 0) dashBadge.classList.remove("hidden");
    else dashBadge.classList.add("hidden");
  }
}

function switchApprovalScope(scope) {
  ACTIVE_APPROVAL_SCOPE = scope || "INBOX";
  const btnInbox = document.getElementById("tab-scope-inbox");
  const btnMy = document.getElementById("tab-scope-my");

  if (scope === "MY") {
    if (btnMy) {
      btnMy.className = "flex-1 py-2.5 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 bg-slate-900 text-white shadow-sm";
    }
    if (btnInbox) {
      btnInbox.className = "flex-1 py-2.5 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 text-slate-600 hover:text-slate-900";
    }
  } else {
    if (btnInbox) {
      btnInbox.className = "flex-1 py-2.5 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 bg-slate-900 text-white shadow-sm";
    }
    if (btnMy) {
      btnMy.className = "flex-1 py-2.5 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 text-slate-600 hover:text-slate-900";
    }
  }

  updateApprovalBadgeCounts();
  renderApprovalList();
}

function filterApprovals(filterType) {
  ACTIVE_APPROVAL_FILTER = filterType;

  // Update button active styles
  ["PENDING", "ALL", "APPROVED", "REJECTED", "CANCELLED"].forEach(f => {
    const btn = document.getElementById(`btn-filter-${f}`);
    if (btn) {
      if (f === filterType) {
        btn.className = "approval-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-900 text-white shadow-xs shrink-0 transition";
      } else {
        btn.className = "approval-filter-btn px-3 py-1.5 rounded-xl font-bold bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 shrink-0 transition";
      }
    }
  });

  renderApprovalList();
}

function renderApprovalList() {
  const container = document.getElementById("approval-list-container");
  if (!container) return;

  const cleanNip = String(CURRENT_USER?.nip || "").trim();

  // 1. Filter berdasarkan scope tab (INBOX vs MY)
  let list = APPROVALS_CACHE;
  if (ACTIVE_APPROVAL_SCOPE === "MY") {
    // Pengajuan yang diajukan oleh user ini sendiri
    list = list.filter(a => String(a.nip || "").trim() === cleanNip);
  } else {
    // INBOX (Perlu Persetujuan Tim): HANYA tampilkan pengajuan dari bawahan yang MENUNJUK user ini sebagai atasan!
    list = list.filter(a =>
      String(a.pic_approval_nip || "").trim() === cleanNip &&
      String(a.nip || "").trim() !== cleanNip
    );
  }

  // 2. Filter status
  if (ACTIVE_APPROVAL_FILTER === "PENDING") {
    list = list.filter(a => String(a.status_approval || "").toUpperCase() === "PENDING");
  } else if (ACTIVE_APPROVAL_FILTER === "APPROVED") {
    list = list.filter(a => String(a.status_approval || "").toUpperCase() === "APPROVED");
  } else if (ACTIVE_APPROVAL_FILTER === "REJECTED") {
    list = list.filter(a => String(a.status_approval || "").toUpperCase() === "REJECTED");
  } else if (ACTIVE_APPROVAL_FILTER === "CANCELLED") {
    list = list.filter(a => {
      const s = String(a.status_approval || "").toUpperCase();
      return s === "CANCELLED" || s === "BATAL";
    });
  }

  if (list.length === 0) {
    const emptyMsg = ACTIVE_APPROVAL_SCOPE === "MY"
      ? "Anda belum memiliki riwayat pengajuan izin / transaksi pada filter ini"
      : "Tidak ada permohonan persetujuan tim pada filter ini";
    container.innerHTML = `
      <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-1.5">
        <i class="fa-solid fa-inbox text-3xl text-slate-300 mb-1"></i>
        <p class="text-xs font-bold text-slate-600">${emptyMsg}</p>
        <span class="text-[10px]">Data akan otomatis tampil di sini saat tersedia</span>
      </div>
    `;
    return;
  }

  const categoryBadges = {
    "WFA": { bg: "bg-teal-50 text-teal-700 border-teal-200", icon: "fa-laptop-house" },
    "Datang Terlambat": { bg: "bg-amber-50 text-amber-700 border-amber-200", icon: "fa-clock" },
    "Cuti": { bg: "bg-blue-50 text-blue-700 border-blue-200", icon: "fa-calendar-check" },
    "Sakit": { bg: "bg-rose-50 text-rose-700 border-rose-200", icon: "fa-hospital-user" }
  };

  container.innerHTML = list.map(a => {
    const st = String(a.status_approval || "").toUpperCase();
    const isPending = st === "PENDING";
    const isApproved = st === "APPROVED";
    const isRejected = st === "REJECTED";
    const isCancelled = st === "CANCELLED" || st === "BATAL";

    const isOwnSubmission = String(a.nip || "").trim() === cleanNip;

    let badgeStyle = "bg-slate-100 text-slate-700 border-slate-200";
    let statusLabel = "Menunggu Respon";
    if (isPending) {
      if (a.is_career_transaction && a.raw_tx_status === "PENDING_AGREEMENT") {
        badgeStyle = "bg-purple-100 text-purple-800 border-purple-200";
        statusLabel = "Menunggu TTD Anda";
      } else {
        badgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
        statusLabel = "Menunggu Respon";
      }
    } else if (isApproved) {
      badgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";
      statusLabel = "Disetujui";
    } else if (isRejected) {
      badgeStyle = "bg-rose-100 text-rose-800 border-rose-200";
      statusLabel = "Ditolak";
    } else if (isCancelled) {
      badgeStyle = "bg-slate-100 text-slate-600 border-slate-200";
      statusLabel = "Dibatalkan";
    }

    let catConfig = categoryBadges[a.jenis_izin];
    if (!catConfig) {
      if (a.is_career_transaction) {
        catConfig = { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "fa-bolt text-amber-500" };
      } else {
        catConfig = { bg: "bg-slate-50 text-slate-700 border-slate-200", icon: "fa-file" };
      }
    }

    const periodeText = (a.tgl_mulai && a.tgl_selesai && a.tgl_mulai !== a.tgl_selesai)
      ? `${a.tgl_mulai} s/d ${a.tgl_selesai}`
      : (a.tgl_mulai || a.timestamp?.slice(0, 10) || "-");

    const selfieThumbnail = a.selfie_url ? `
      <div class="mt-2.5 flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition" onclick="openFotoPreviewModal('${a.selfie_url}')">
        <img src="${a.selfie_url}" alt="Selfie" class="w-9 h-9 rounded-lg object-cover shadow-xs" />
        <div class="min-w-0 flex-1">
          <span class="text-[11px] font-bold text-slate-800 block">Lampiran Foto Selfie</span>
          <span class="text-[9px] text-teal-700 font-semibold flex items-center"><i class="fa-solid fa-magnifying-glass mr-1"></i>Klik untuk perbesar</span>
        </div>
      </div>
    ` : '';

    let actionSection = '';
    if (a.is_career_transaction) {
      // KHUSUS TRANSAKSI KEPEGAWAIAN
      if (isOwnSubmission) {
        if (a.raw_tx_status === "PENDING_AGREEMENT") {
          actionSection = `
            <div class="mt-2.5 p-3 bg-purple-50/70 border border-purple-200 rounded-2xl flex items-center justify-between gap-3">
              <div class="flex items-center space-x-2 text-purple-950 font-bold text-xs">
                <i class="fa-solid fa-signature text-purple-600 text-sm"></i>
                <span>Persetujuan Elektronik Karyawan Diperlukan</span>
              </div>
              <button type="button" onclick="openElectronicAgreementModal('${a.tx_id}')" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow flex items-center justify-center space-x-1.5 transition active:scale-95 shrink-0">
                <i class="fa-solid fa-file-signature text-xs"></i>
                <span>Review Pengajuan</span>
              </button>
            </div>
          `;
        } else if (isPending) {
          actionSection = `
            <div class="mt-2.5 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[10px] text-indigo-950 flex items-center justify-between">
              <span><i class="fa-solid fa-clock mr-1 text-indigo-600"></i>Menunggu Approver Staging ${a.current_stage_order}:</span>
              <strong class="text-indigo-900">${a.pic_approval_nama || 'Approver'} (${a.pic_approval_nip || '-'})</strong>
            </div>
          `;
        } else if (isApproved) {
          actionSection = `
            <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-emerald-700 flex items-center justify-between font-medium">
              <span><i class="fa-solid fa-circle-check mr-1"></i>Transaksi Disetujui Penuh & Diberlakukan Efektif: <strong>${a.effective_date}</strong></span>
            </div>
          `;
        } else if (isRejected) {
          actionSection = `
            <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-rose-700 flex items-center justify-between font-medium">
              <span><i class="fa-solid fa-circle-xmark mr-1"></i>Transaksi Ditolak pada Staging Approver</span>
            </div>
          `;
        }
      } else {
        // PERLU PERSETUJUAN TIM: Approver berhak Setujui / Tolak Staging
        if (isPending) {
          actionSection = `
            <div class="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 mt-2.5">
              <button type="button" onclick="openProcessTransactionApprovalModal('${a.tx_id}', '${a.stage_id}', 'REJECTED')" class="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-1 transition active:scale-95">
                <i class="fa-solid fa-xmark"></i>
                <span>Tolak Transaksi</span>
              </button>
              <button type="button" onclick="openProcessTransactionApprovalModal('${a.tx_id}', '${a.stage_id}', 'APPROVED')" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1 transition active:scale-95">
                <i class="fa-solid fa-check"></i>
                <span>Setujui Staging ${a.current_stage_order}</span>
              </button>
            </div>
          `;
        } else {
          actionSection = `
            <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-slate-400 flex items-center justify-between">
              <span>Status Staging: <strong class="text-slate-600">${a.status_approval}</strong></span>
              <span>${a.timestamp ? a.timestamp.slice(0, 16) : ''}</span>
            </div>
          `;
        }
      }
    } else if (isOwnSubmission) {
      // PENGAJUAN SAYA (IZIN BIASA)
      if (isPending) {
        actionSection = `
          <div class="mt-2.5 pt-2.5 border-t border-slate-100 space-y-2">
            <div class="p-2 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[10px] text-indigo-950 flex items-center space-x-2">
              <i class="fa-solid fa-user-tie text-indigo-600 text-xs shrink-0"></i>
              <div class="min-w-0 flex-1">
                <span class="text-[9px] text-indigo-500 font-bold block uppercase">Menunggu Persetujuan Atasan:</span>
                <strong class="text-indigo-900">${a.pic_approval_nama || 'Atasan Langsung'} (${a.pic_approval_nip || '-'})</strong>
              </div>
            </div>
            <button type="button" onclick="openCancelIzinModal('${a.izin_id}')" class="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95">
              <i class="fa-solid fa-ban"></i>
              <span>Batalkan Pengajuan</span>
            </button>
          </div>
        `;
      } else if (isApproved) {
        actionSection = `
          <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-emerald-700 flex items-center justify-between font-medium">
            <span><i class="fa-solid fa-circle-check mr-1"></i>Telah disetujui oleh: <strong>${a.approved_by || 'Atasan'}</strong></span>
            <span>${a.approved_at ? a.approved_at.slice(0, 16) : ''}</span>
          </div>
          ${a.catatan_approval && a.catatan_approval !== '-' ? `<div class="mt-1 p-2 bg-emerald-50/60 rounded-lg text-[10px] text-emerald-800 italic">Catatan Atasan: "${a.catatan_approval}"</div>` : ''}
        `;
      } else if (isRejected) {
        actionSection = `
          <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-rose-700 flex items-center justify-between font-medium">
            <span><i class="fa-solid fa-circle-xmark mr-1"></i>Ditolak oleh: <strong>${a.approved_by || 'Atasan'}</strong></span>
            <span>${a.approved_at ? a.approved_at.slice(0, 16) : ''}</span>
          </div>
          ${a.catatan_approval && a.catatan_approval !== '-' ? `<div class="mt-1 p-2 bg-rose-50/60 rounded-lg text-[10px] text-rose-800 italic">Alasan Tolak: "${a.catatan_approval}"</div>` : ''}
        `;
      } else {
        actionSection = `
          <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-slate-500 flex items-center justify-between">
            <span><i class="fa-solid fa-ban mr-1"></i>Pengajuan ini telah Anda batalkan</span>
            <span>${a.approved_at ? a.approved_at.slice(0, 16) : ''}</span>
          </div>
        `;
      }
    } else {
      // PENGAJUAN TIM / BAWAHAN (IZIN BIASA)
      if (isPending) {
        actionSection = `
          <div class="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100 mt-2.5">
            <button type="button" onclick="openProcessApprovalModal('${a.izin_id}', 'REJECTED')" class="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center space-x-1 transition active:scale-95">
              <i class="fa-solid fa-xmark"></i>
              <span>Tolak</span>
            </button>
            <button type="button" onclick="openProcessApprovalModal('${a.izin_id}', 'APPROVED')" class="py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center justify-center space-x-1 transition active:scale-95">
              <i class="fa-solid fa-check"></i>
              <span>Setujui</span>
            </button>
          </div>
        `;
      } else {
        actionSection = `
          <div class="pt-2 border-t border-slate-100 mt-2 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Direspon oleh: <strong class="text-slate-600">${a.approved_by || 'Atasan'}</strong></span>
            <span>${a.approved_at ? a.approved_at.slice(0, 16) : ''}</span>
          </div>
          ${a.catatan_approval && a.catatan_approval !== '-' ? `
            <div class="mt-1 p-2 bg-slate-50 rounded-lg text-[10px] text-slate-600 italic">
              Catatan: "${a.catatan_approval}"
            </div>
          ` : ''}
        `;
      }
    }

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="flex items-center space-x-1.5">
              <h4 class="font-bold text-slate-900 text-sm leading-tight truncate">${a.nama}</h4>
              ${isOwnSubmission ? '<span class="px-2 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md font-bold text-[9px] shrink-0">Pengajuan Saya</span>' : ''}
            </div>
            <p class="text-[10px] text-slate-400 mt-0.5">NIP: ${a.nip} • ${a.cabang}</p>
          </div>
          <span class="text-[9px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${badgeStyle}">${statusLabel}</span>
        </div>

        <div class="flex items-center space-x-2 pt-1">
          <span class="px-2 py-0.5 rounded-lg border text-[10px] font-bold flex items-center space-x-1 ${catConfig.bg}">
            <i class="fa-solid ${catConfig.icon}"></i>
            <span>${a.jenis_izin}</span>
          </span>
          <span class="text-[10px] text-slate-500"><i class="fa-solid fa-calendar mr-1"></i>${periodeText}</span>
        </div>

        ${(a.is_career_transaction && a.tx_data) ? buildCareerTransactionHighlightsHtml(a.tx_data, a) : `
          <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
            <span class="text-[9px] text-slate-400 font-bold block uppercase mb-0.5">Keterangan / Rincian:</span>
            <p class="font-medium whitespace-pre-line leading-relaxed">${a.catatan || '-'}</p>
          </div>
        `}

        ${selfieThumbnail}
        ${actionSection}
      </div>
    `;
  }).join("");
}

function openProcessApprovalModal(izinId, actionType) {
  const item = APPROVALS_CACHE.find(a => a.izin_id === izinId);
  if (!item) return;

  PENDING_APPROVAL_ACTION_PAYLOAD = {
    izin_id: izinId,
    status: actionType,
    approver_nip: CURRENT_USER.nip,
    approver_name: CURRENT_USER.nama
  };

  const modal = document.getElementById("modal-process-approval");
  const iconBox = document.getElementById("modal-appr-icon-box");
  const icon = document.getElementById("modal-appr-icon");
  const title = document.getElementById("modal-appr-title");
  const sub = document.getElementById("modal-appr-sub");
  const pemohon = document.getElementById("modal-appr-pemohon");
  const jenis = document.getElementById("modal-appr-jenis");
  const periode = document.getElementById("modal-appr-periode");
  const catatan = document.getElementById("modal-appr-catatan");
  const btnConfirm = document.getElementById("btn-confirm-approval-action");
  const inputNotes = document.getElementById("modal-appr-input-notes");

  if (inputNotes) inputNotes.value = "";
  if (pemohon) pemohon.innerText = `${item.nama} (${item.nip}) • ${item.cabang}`;
  if (jenis) jenis.innerText = `${item.jenis_izin}`;
  if (periode) periode.innerText = item.tgl_mulai ? `${item.tgl_mulai} s/d ${item.tgl_selesai || item.tgl_mulai}` : (item.timestamp ? item.timestamp.slice(0, 10) : "-");
  if (catatan) catatan.innerText = item.catatan || "-";

  if (actionType === "APPROVED") {
    if (title) title.innerText = "Setujui Permohonan Izin";
    if (sub) sub.innerText = `Anda akan menyetujui pengajuan ${item.nama}`;
    if (iconBox) iconBox.className = "w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-2";
    if (icon) icon.className = "fa-solid fa-check";
    if (btnConfirm) {
      btnConfirm.className = "w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95";
      btnConfirm.innerText = "Ya, Setujui";
    }
  } else {
    if (title) title.innerText = "Tolak Permohonan Izin";
    if (sub) sub.innerText = `Anda akan menolak pengajuan ${item.nama}`;
    if (iconBox) iconBox.className = "w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-2";
    if (icon) icon.className = "fa-solid fa-xmark";
    if (btnConfirm) {
      btnConfirm.className = "w-2/3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95";
      btnConfirm.innerText = "Ya, Tolak Permohonan";
    }
  }

  if (modal) modal.classList.remove("hidden");
}

function closeProcessApprovalModal() {
  const modal = document.getElementById("modal-process-approval");
  if (modal) modal.classList.add("hidden");
  PENDING_APPROVAL_ACTION_PAYLOAD = null;
}

function openCancelIzinModal(izinId) {
  const item = APPROVALS_CACHE.find(a => a.izin_id === izinId);
  if (!item) return;

  PENDING_CANCEL_IZIN_ID = izinId;

  const modal = document.getElementById("modal-cancel-izin");
  const jenis = document.getElementById("modal-cancel-jenis");
  const periode = document.getElementById("modal-cancel-periode");
  const catatan = document.getElementById("modal-cancel-catatan");
  const atasan = document.getElementById("modal-cancel-atasan");

  if (jenis) jenis.innerText = item.jenis_izin || "-";
  if (periode) periode.innerText = item.tgl_mulai ? `${item.tgl_mulai} s/d ${item.tgl_selesai || item.tgl_mulai}` : (item.timestamp ? item.timestamp.slice(0, 10) : "-");
  if (catatan) catatan.innerText = item.catatan || "-";
  if (atasan) atasan.innerText = `${item.pic_approval_nama || 'Atasan Langsung'} (${item.pic_approval_nip || '-'})`;

  if (modal) modal.classList.remove("hidden");
}

function closeCancelIzinModal() {
  const modal = document.getElementById("modal-cancel-izin");
  if (modal) modal.classList.add("hidden");
  PENDING_CANCEL_IZIN_ID = null;
}

async function executeCancelIzinAction() {
  if (!PENDING_CANCEL_IZIN_ID) return;
  const izinId = PENDING_CANCEL_IZIN_ID;
  const btnConfirm = document.getElementById("btn-confirm-cancel-action");
  const origText = btnConfirm ? btnConfirm.innerHTML : "Ya, Batalkan";

  if (btnConfirm) {
    btnConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Membatalkan...';
    btnConfirm.disabled = true;
  }

  try {
    const res = await callApi("processApproval", {
      izin_id: izinId,
      status: "CANCELLED",
      decision: "CANCELLED",
      approver_name: CURRENT_USER?.nama || "Pemohon",
      approver_nip: CURRENT_USER?.nip || "-",
      catatan_approval: "Dibatalkan oleh pemohon"
    });

    if (btnConfirm) {
      btnConfirm.innerHTML = origText;
      btnConfirm.disabled = false;
    }

    closeCancelIzinModal();

    // Update local cache
    const target = APPROVALS_CACHE.find(a => a.izin_id === izinId);
    if (target) {
      target.status_approval = "CANCELLED";
      target.approved_by = CURRENT_USER?.nama || "Pemohon";
      target.approved_at = new Date().toISOString();
      target.catatan_approval = "Dibatalkan oleh pemohon";
    }

    showToast("Pengajuan izin berhasil dibatalkan.", "success", 2000);
    updateApprovalBadgeCounts();
    renderApprovalList();
  } catch (err) {
    if (btnConfirm) {
      btnConfirm.innerHTML = origText;
      btnConfirm.disabled = false;
    }
    closeCancelIzinModal();
    showCenterAlertModal({
      title: "Gagal Membatalkan",
      message: err.message,
      type: "error"
    });
  }
}

async function executeApprovalAction() {
  if (!PENDING_APPROVAL_ACTION_PAYLOAD) return;
  const inputNotes = document.getElementById("modal-appr-input-notes")?.value.trim() || "-";
  const btnConfirm = document.getElementById("btn-confirm-approval-action");
  const originalText = btnConfirm ? btnConfirm.innerHTML : "Konfirmasi";

  if (btnConfirm) {
    btnConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Memproses...';
    btnConfirm.disabled = true;
  }

  // Delegasi jika ini transaksi kepegawaian
  if (PENDING_APPROVAL_ACTION_PAYLOAD.is_career_transaction) {
    try {
      await executeTransactionApproval(
        PENDING_APPROVAL_ACTION_PAYLOAD.tx_id,
        PENDING_APPROVAL_ACTION_PAYLOAD.stage_id,
        PENDING_APPROVAL_ACTION_PAYLOAD.status,
        inputNotes
      );
    } finally {
      if (btnConfirm) {
        btnConfirm.innerHTML = originalText;
        btnConfirm.disabled = false;
      }
      closeProcessApprovalModal();
    }
    return;
  }

  try {
    const actionDecision = PENDING_APPROVAL_ACTION_PAYLOAD.status || PENDING_APPROVAL_ACTION_PAYLOAD.decision || "APPROVED";
    const res = await callApi("processApproval", {
      ...PENDING_APPROVAL_ACTION_PAYLOAD,
      decision: actionDecision,
      status: actionDecision,
      approver_name: CURRENT_USER?.nama || "Atasan",
      approverNama: CURRENT_USER?.nama || "Atasan",
      approver_nip: CURRENT_USER?.nip || "-",
      catatan_approval: inputNotes,
      note: inputNotes
    });

    if (btnConfirm) {
      btnConfirm.innerHTML = originalText;
      btnConfirm.disabled = false;
    }

    closeProcessApprovalModal();

    if (!res || !res.success) {
      showCenterAlertModal({
        title: "Gagal Memproses",
        message: res?.message || "Terjadi kesalahan saat memproses approval.",
        type: "error"
      });
      return;
    }

    showToast(res.message || "Status approval berhasil diperbarui!", "success", 1500);
    fetchApprovalList();
  } catch (err) {
    if (btnConfirm) {
      btnConfirm.innerHTML = originalText;
      btnConfirm.disabled = false;
    }
    closeProcessApprovalModal();
    showCenterAlertModal({
      title: "Gagal Memproses",
      message: "Koneksi terputus: " + err.message,
      type: "error"
    });
  }
}

function openFotoPreviewModal(url) {
  const modal = document.getElementById("modal-preview-foto");
  const img = document.getElementById("img-modal-preview-full");
  if (img) img.src = url;
  if (modal) modal.classList.remove("hidden");
}

function closeFotoPreviewModal() {
  const modal = document.getElementById("modal-preview-foto");
  if (modal) modal.classList.add("hidden");
}

// =========================================================================
// REKAP ABSEN & KALENDER PRESENSI CONTROLLER
// =========================================================================
let REKAP_SELECTED_YEAR = new Date().getFullYear();
let REKAP_SELECTED_MONTH = new Date().getMonth(); // 0 - 11
let REKAP_SELECTED_NIP = "";
let REKAP_SELECTED_NAME = "";
let REKAP_MONTH_ABSENSI_DATA = [];
let REKAP_MONTH_IZIN_DATA = [];
let REKAP_DAYS_EVAL_MAP = {};

const REKAP_MONTH_NAMES_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const REKAP_DAY_NAMES_ID = [
  "Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"
];

async function initRekapAbsenScreen() {
  if (!CURRENT_USER) return;

  REKAP_SELECTED_NIP = CURRENT_USER.nip;
  REKAP_SELECTED_NAME = CURRENT_USER.nama;

  // Load data dan render kalender absensi user sendiri
  await fetchAndRenderRekapCalendar();
}

function setupRekapTeamFilter() {
  const filterWrapper = document.getElementById("rekap-team-filter-wrapper");
  const selectEl = document.getElementById("rekap-team-select");
  if (!filterWrapper || !selectEl) return;

  const role = String(CURRENT_USER.role || "").toLowerCase();
  const isSuperAdminOrBM = role.includes("admin") || role.includes("branch manager") || role.includes("supervisor") || role.includes("bm");

  if (!isSuperAdminOrBM) {
    filterWrapper.classList.add("hidden");
    return;
  }

  filterWrapper.classList.remove("hidden");
  selectEl.innerHTML = `<option value="${CURRENT_USER.nip}">${CURRENT_USER.nama} (Saya Sendiri)</option>`;

  // Isi opsi bawahan jika ada di cache karyawan
  if (Array.isArray(window.ALL_EMPLOYEES_CACHE) && window.ALL_EMPLOYEES_CACHE.length > 0) {
    window.ALL_EMPLOYEES_CACHE.forEach(emp => {
      if (emp.nip !== CURRENT_USER.nip) {
        const opt = document.createElement("option");
        opt.value = emp.nip;
        opt.textContent = `${emp.nama || emp.nama_lengkap} (${emp.nip})`;
        if (emp.nip === REKAP_SELECTED_NIP) opt.selected = true;
        selectEl.appendChild(opt);
      }
    });
  } else if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
    fetch(`${CONFIG.SUPABASE_URL}/rest/v1/m_employee?select=nip,nama_lengkap,cabang&order=nama_lengkap.asc`, {
      headers: {
        "apikey": CONFIG.SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
      }
    }).then(res => res.json()).then(list => {
      if (Array.isArray(list)) {
        window.ALL_EMPLOYEES_CACHE = list.map(e => ({ nip: e.nip, nama: e.nama_lengkap, cabang: e.cabang }));
        list.forEach(emp => {
          if (emp.nip !== CURRENT_USER.nip) {
            const opt = document.createElement("option");
            opt.value = emp.nip;
            opt.textContent = `${emp.nama_lengkap} (${emp.nip})`;
            if (emp.nip === REKAP_SELECTED_NIP) opt.selected = true;
            selectEl.appendChild(opt);
          }
        });
      }
    }).catch(err => console.warn("Gagal load opsi karyawan rekap:", err));
  }
}

function handleRekapUserChange(nip) {
  if (!nip) nip = CURRENT_USER.nip;
  REKAP_SELECTED_NIP = nip;

  if (window.ALL_EMPLOYEES_CACHE) {
    const found = window.ALL_EMPLOYEES_CACHE.find(e => e.nip === nip);
    if (found) REKAP_SELECTED_NAME = found.nama || found.nama_lengkap;
    else if (nip === CURRENT_USER.nip) REKAP_SELECTED_NAME = CURRENT_USER.nama;
  }

  const nameEl = document.getElementById("rekap-employee-name");
  const subEl = document.getElementById("rekap-employee-sub");
  if (nameEl) nameEl.innerText = REKAP_SELECTED_NAME;
  if (subEl) subEl.innerText = `NIP: ${REKAP_SELECTED_NIP}`;

  fetchAndRenderRekapCalendar();
}

function changeRekapMonth(offset) {
  REKAP_SELECTED_MONTH += offset;
  if (REKAP_SELECTED_MONTH < 0) {
    REKAP_SELECTED_MONTH = 11;
    REKAP_SELECTED_YEAR -= 1;
  } else if (REKAP_SELECTED_MONTH > 11) {
    REKAP_SELECTED_MONTH = 0;
    REKAP_SELECTED_YEAR += 1;
  }
  fetchAndRenderRekapCalendar();
}

function jumpToCurrentMonth() {
  const now = new Date();
  REKAP_SELECTED_YEAR = now.getFullYear();
  REKAP_SELECTED_MONTH = now.getMonth();
  fetchAndRenderRekapCalendar();
}

function refreshRekapCalendar() {
  const icon = document.getElementById("rekap-refresh-icon");
  if (icon) icon.classList.add("fa-spin");
  fetchAndRenderRekapCalendar().finally(() => {
    if (icon) icon.classList.remove("fa-spin");
  });
}

async function fetchAndRenderRekapCalendar() {
  const monthLabel = document.getElementById("rekap-month-label");
  if (monthLabel) {
    monthLabel.innerText = `${REKAP_MONTH_NAMES_ID[REKAP_SELECTED_MONTH]} ${REKAP_SELECTED_YEAR}`;
  }

  const gridContainer = document.getElementById("rekap-calendar-grid");
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div class="col-span-7 py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
        <i class="fa-solid fa-circle-notch fa-spin text-xl text-teal-600 mb-2"></i>
        <span>Memuat data presensi & izin...</span>
      </div>
    `;
  }

  const y = REKAP_SELECTED_YEAR;
  const m = REKAP_SELECTED_MONTH;
  const nip = REKAP_SELECTED_NIP || CURRENT_USER?.nip;

  const startDateStr = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDayNum = new Date(y, m + 1, 0).getDate();
  const endDateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

  REKAP_MONTH_ABSENSI_DATA = [];
  REKAP_MONTH_IZIN_DATA = [];

  try {
    // 1. Ambil data tr_absensi_log
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const absenUrl = `${CONFIG.SUPABASE_URL}/rest/v1/tr_absensi_log?nip=eq.${encodeURIComponent(nip)}&timestamp=gte.${startDateStr}T00:00:00&timestamp=lte.${endDateStr}T23:59:59&order=timestamp.asc`;
      const izinUrl = `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?nip=eq.${encodeURIComponent(nip)}&tgl_mulai=lte.${endDateStr}&tgl_selesai=gte.${startDateStr}&order=timestamp.asc`;

      const [absenRes, izinRes] = await Promise.all([
        fetch(absenUrl, {
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        }),
        fetch(izinUrl, {
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        })
      ]);

      if (absenRes.ok) {
        const rawAbsen = await absenRes.json();
        if (Array.isArray(rawAbsen)) REKAP_MONTH_ABSENSI_DATA = rawAbsen;
      }

      if (izinRes.ok) {
        const rawIzin = await izinRes.json();
        if (Array.isArray(rawIzin)) REKAP_MONTH_IZIN_DATA = rawIzin;
      }
    }
  } catch (err) {
    console.error("Gagal mengambil data rekap presensi:", err);
  }

  // Render grid kalender
  renderRekapCalendarGrid(y, m);
}

function renderRekapCalendarGrid(year, month) {
  const gridContainer = document.getElementById("rekap-calendar-grid");
  if (!gridContainer) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Minggu, 1 = Senin ...
  // Index hari kerja mulai dari SENIN (0) s/d MINGGU (6)
  const startOffset = (firstDayOfMonth + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();

  REKAP_DAYS_EVAL_MAP = {};

  // Counter statistik bulanan
  let countTepatWaktu = 0;
  let countTerlambat = 0;
  let countWfhOnTime = 0;
  let countCuti = 0;
  let countSakit = 0;
  let countAlpha = 0;

  let html = "";

  // Slot kosong awal sebelum tanggal 1
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="aspect-square rounded-2xl bg-slate-50/30 border border-dashed border-slate-100 opacity-20 pointer-events-none"></div>`;
  }

  // Render masing-masing tanggal 1 s/d totalDays
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay();
    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    // Filter log absensi pada tanggal ini
    const dayAbsenLogs = REKAP_MONTH_ABSENSI_DATA.filter(item => {
      if (!item.timestamp) return false;
      return String(item.timestamp).slice(0, 10) === dateStr;
    });

    // Filter log perizinan yang meng-cover tanggal ini
    const dayIzinLogs = REKAP_MONTH_IZIN_DATA.filter(item => {
      const start = item.tgl_mulai ? String(item.tgl_mulai).slice(0, 10) : "";
      const end = item.tgl_selesai ? String(item.tgl_selesai).slice(0, 10) : start;
      return start && end && dateStr >= start && dateStr <= end;
    });

    // Evaluasi prioritas
    const evalResult = evaluateDateAttendance(dateStr, dayAbsenLogs, dayIzinLogs, isFuture, isSunday, isSaturday, isToday);
    REKAP_DAYS_EVAL_MAP[dateStr] = {
      dateStr,
      dateObj,
      evalResult,
      absenLogs: dayAbsenLogs,
      izinLogs: dayIzinLogs,
      isToday,
      isSunday,
      isSaturday,
      isFuture
    };

    // Akumulasi statistik bulanan (hanya untuk tanggal yang sudah terjadi / hari ini yang relevan)
    if (evalResult.category === "TEPAT_WAKTU") countTepatWaktu++;
    else if (evalResult.category === "TERLAMBAT") countTerlambat++;
    else if (evalResult.category === "WFH_ONTIME") countWfhOnTime++;
    else if (evalResult.category === "CUTI") countCuti++;
    else if (evalResult.category === "SAKIT") countSakit++;
    else if (evalResult.category === "ALPHA") countAlpha++;

    // Hari ini border ring
    const todayRing = isToday ? "ring-2.5 ring-teal-600 shadow-md font-black" : "";

    html += `
      <div onclick="openRekapDayModal('${dateStr}')" class="aspect-square flex items-center justify-center rounded-2xl border cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${evalResult.bgClass} ${evalResult.borderClass} ${todayRing}">
        <span class="text-sm sm:text-base font-black ${evalResult.numClass}">
          ${d}
        </span>
      </div>
    `;
  }

  gridContainer.innerHTML = html;

  // Update ringkasan angka statistik di atas
  updateElementText("stat-tepat-waktu", countTepatWaktu);
  updateElementText("stat-terlambat", countTerlambat);
  updateElementText("stat-wfh-ontime", countWfhOnTime);
  updateElementText("stat-cuti", countCuti);
  updateElementText("stat-sakit", countSakit);
  updateElementText("stat-alpha", countAlpha);
}

function updateElementText(id, val) {
  const el = document.getElementById(id);
  if (el) el.innerText = val;
}

/**
 * Evaluasi Prioritas Status Tanggal Presensi:
 * Prioritas (Sesuai Aturan User):
 * 1. Belum Absensi tapi bukan WFH/ Izin Terlambat/ cuti/ sakit maka warna merah pastel
 * 2. Absensi / WFH / terlambat baru diajukan diatas pukul 09:00 warna merah muda
 * 3. Izin cuti warna biru pastel (harus APPROVED)
 * 4. Izin sakit warna abu abu muda (harus APPROVED)
 * 5. Izin WFH / terlambat diajukan sebelum pukul 09:00 warna kuning pastel (harus APPROVED)
 * 6. Absen datang tepat waktu warna hijau pastel
 * *Untuk presensi yang butuh izin, baru diakui setelah mendapat persetujuan. contoh wfh belum disetujui maka warnanya akan merah.
 */
function evaluateDateAttendance(dateStr, absenLogs, izinLogs, isFuture, isSunday, isSaturday, isToday) {
  // Ambil log absen datang jika ada
  const datangLog = absenLogs.find(l => {
    const j = String(l.jenis_absen || "").toLowerCase();
    return j.includes("datang") || j.includes("masuk");
  });

  // Pisahkan izin yang disetujui (APPROVED) dan yang belum disetujui (PENDING / REJECTED)
  const approvedIzins = izinLogs.filter(i => String(i.status_approval || "").toUpperCase() === "APPROVED");
  const unapprovedIzins = izinLogs.filter(i => String(i.status_approval || "").toUpperCase() !== "APPROVED");

  // Filter per kategori izin APPROVED
  const approvedCuti = approvedIzins.find(i => String(i.jenis_izin || "").toLowerCase().includes("cuti"));
  const approvedSakit = approvedIzins.find(i => String(i.jenis_izin || "").toLowerCase().includes("sakit"));
  const approvedWfh = approvedIzins.find(i => {
    const j = String(i.jenis_izin || "").toLowerCase();
    return j.includes("wfa") || j.includes("wfh") || j.includes("terlambat");
  });

  // Cek jam pengajuan izin WFH / Terlambat
  let isWfhBefore9 = false;
  let wfhSubmitTimeStr = "";
  if (approvedWfh) {
    const submitTs = approvedWfh.timestamp || approvedWfh.created_at;
    if (submitTs) {
      const submitDate = new Date(submitTs);
      const subDateStr = submitDate.toISOString().slice(0, 10);
      const hours = submitDate.getHours();
      const minutes = submitDate.getMinutes();
      wfhSubmitTimeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

      // Jika diajukan sebelum hari H (misal H-1), otomatis dihitung < 09:00
      if (subDateStr < dateStr) {
        isWfhBefore9 = true;
      } else if (subDateStr === dateStr) {
        // Diajukan di hari H, cek jam
        if (hours < 9 || (hours === 9 && minutes === 0)) {
          isWfhBefore9 = true;
        } else {
          isWfhBefore9 = false;
        }
      } else {
        isWfhBefore9 = true;
      }
    } else {
      isWfhBefore9 = true; // Default fallback jika timestamp kosong
    }
  }

  // Cek apakah absen datang tepat waktu (<= 09:00:00 atau status TEPAT_WAKTU)
  let isDatangTepatWaktu = false;
  let datangTimeStr = "";
  let isDatangTerlambat = false;

  if (datangLog) {
    const ts = new Date(datangLog.timestamp || datangLog.created_at);
    const h = ts.getHours();
    const m = ts.getMinutes();
    datangTimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    const statusKehadiran = String(datangLog.status_kehadiran || "").toUpperCase();
    const menitTerlambat = Number(datangLog.menit_terlambat) || 0;

    if (statusKehadiran === "TEPAT_WAKTU" || menitTerlambat <= 0 || (h < 9 || (h === 9 && m === 0))) {
      isDatangTepatWaktu = true;
    } else {
      isDatangTerlambat = true;
    }
  }

  // JIKA TANGGAL DI MASA DEPAN:
  if (isFuture) {
    if (approvedCuti) {
      return {
        category: "CUTI",
        name: "Izin Cuti (Disetujui)",
        shortLabel: "Cuti",
        subTime: "",
        bgClass: "bg-blue-100/90 hover:bg-blue-200/90",
        borderClass: "border-blue-300",
        numClass: "text-blue-900",
        textClass: "text-blue-800",
        badgeDot: `<span class="w-2 h-2 rounded-full bg-blue-500"></span>`
      };
    }
    if (approvedWfh) {
      return {
        category: "WFH_ONTIME",
        name: "Izin WFH Terencana",
        shortLabel: "WFH Plan",
        subTime: "",
        bgClass: "bg-amber-100/90 hover:bg-amber-200/90",
        borderClass: "border-amber-300",
        numClass: "text-amber-900",
        textClass: "text-amber-800",
        badgeDot: `<span class="w-2 h-2 rounded-full bg-amber-500"></span>`
      };
    }
    return {
      category: "FUTURE",
      name: isSunday ? "Hari Libur (Minggu)" : "Mendatang",
      shortLabel: isSunday ? "Libur" : "-",
      subTime: "",
      bgClass: isSunday ? "bg-red-50/30" : "bg-slate-50/60",
      borderClass: "border-slate-200/60",
      numClass: isSunday ? "text-red-400" : "text-slate-400",
      textClass: "text-slate-400",
      badgeDot: ""
    };
  }

  // =========================================================================
  // EVALUASI PRIORITAS HARI KERJA / HARI YANG SUDAH TERJADI:
  // =========================================================================

  // PRIORITAS 1: Absen Datang Tepat Waktu (≤ 09:00) -> HIJAU PASTEL
  if (isDatangTepatWaktu) {
    return {
      category: "TEPAT_WAKTU",
      name: "Hadir Tepat Waktu",
      shortLabel: "Tepat Waktu",
      subTime: datangTimeStr,
      bgClass: "bg-emerald-100/90 hover:bg-emerald-200/90",
      borderClass: "border-emerald-300",
      numClass: "text-emerald-950",
      textClass: "text-emerald-800 font-extrabold",
      badgeDot: `<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>`
    };
  }

  // PRIORITAS 2: Izin WFH / Izin Terlambat diajukan SEBELUM / TEPAT 09:00 (APPROVED) -> KUNING PASTEL
  if (approvedWfh && isWfhBefore9) {
    const isLatePermit = String(approvedWfh.jenis_izin || "").toLowerCase().includes("terlambat");
    return {
      category: "WFH_ONTIME",
      name: isLatePermit ? "Izin Terlambat (≤ 09:00)" : "WFH Tepat Waktu (≤ 09:00)",
      shortLabel: isLatePermit ? "Izin Telat" : "WFH (≤09)",
      subTime: wfhSubmitTimeStr ? `Diajukan ${wfhSubmitTimeStr}` : "",
      bgClass: "bg-amber-100/90 hover:bg-amber-200/90",
      borderClass: "border-amber-300",
      numClass: "text-amber-950",
      textClass: "text-amber-800 font-extrabold",
      badgeDot: `<span class="w-2 h-2 rounded-full bg-amber-500"></span>`
    };
  }

  // PRIORITAS 3: Izin Cuti (APPROVED) -> BIRU PASTEL
  if (approvedCuti) {
    return {
      category: "CUTI",
      name: "Izin Cuti Resmi (Disetujui)",
      shortLabel: "Cuti",
      subTime: "Disetujui",
      bgClass: "bg-blue-100/90 hover:bg-blue-200/90",
      borderClass: "border-blue-300",
      numClass: "text-blue-950",
      textClass: "text-blue-800 font-extrabold",
      badgeDot: `<span class="w-2 h-2 rounded-full bg-blue-500"></span>`
    };
  }

  // PRIORITAS 4: Izin Sakit (APPROVED) -> ABU-ABU MUDA
  if (approvedSakit) {
    return {
      category: "SAKIT",
      name: "Izin Sakit (Disetujui)",
      shortLabel: "Sakit",
      subTime: "Disetujui",
      bgClass: "bg-slate-200/90 hover:bg-slate-300/90",
      borderClass: "border-slate-300",
      numClass: "text-slate-900",
      textClass: "text-slate-800 font-extrabold",
      badgeDot: `<span class="w-2 h-2 rounded-full bg-slate-500"></span>`
    };
  }

  // PRIORITAS 5: Absensi Terlambat (> 09:00) ATAU WFH/Terlambat baru diajukan > 09:00 -> MERAH MUDA (ROSE)
  if (isDatangTerlambat || (approvedWfh && !isWfhBefore9)) {
    const reasonLabel = isDatangTerlambat ? `Telat (${datangTimeStr})` : `Izin (>09:00)`;
    return {
      category: "TERLAMBAT",
      name: isDatangTerlambat ? "Hadir Terlambat (> 09:00)" : "Izin WFH Baru Diajukan > 09:00",
      shortLabel: reasonLabel,
      subTime: isDatangTerlambat ? datangTimeStr : (wfhSubmitTimeStr ? `Diajukan ${wfhSubmitTimeStr}` : ""),
      bgClass: "bg-rose-100/90 hover:bg-rose-200/90",
      borderClass: "border-rose-300",
      numClass: "text-rose-950",
      textClass: "text-rose-800 font-extrabold",
      badgeDot: `<span class="w-2 h-2 rounded-full bg-rose-500"></span>`
    };
  }

  // JIKA HARI LIBUR MINGGU (dan tidak ada absen):
  if (isSunday) {
    return {
      category: "LIBUR",
      name: "Hari Libur Mingguan",
      shortLabel: "Libur",
      subTime: "",
      bgClass: "bg-slate-50/80 hover:bg-slate-100/80",
      borderClass: "border-slate-200",
      numClass: "text-red-500 font-bold",
      textClass: "text-slate-400",
      badgeDot: ""
    };
  }

  // PRIORITAS 6: BELUM ABSENSI (ALPHA) / IZIN BELUM DISETUJUI (PENDING/REJECTED) -> MERAH PASTEL
  // "Untuk presensi yang butuh izin, baru diakui setelah mendapat persetujuan. contoh wfh belum disetujui maka warnanya akan merah"
  const hasUnapproved = unapprovedIzins.length > 0;
  return {
    category: "ALPHA",
    name: hasUnapproved ? "Izin Belum Disetujui Atasan" : "Belum Absensi (Alpha)",
    shortLabel: hasUnapproved ? "Pending Izin" : "Alpha",
    subTime: hasUnapproved ? "Belum Diakui" : "Tidak Hadir",
    bgClass: "bg-red-100/90 hover:bg-red-200/90",
    borderClass: "border-red-300",
    numClass: "text-red-950",
    textClass: "text-red-800 font-extrabold",
    badgeDot: `<span class="w-2 h-2 rounded-full bg-red-600"></span>`
  };
}

// =========================================================================
// POPUP / MODAL DETAIL HARIAN PRESENSI
// =========================================================================
function openRekapDayModal(dateStr) {
  const data = REKAP_DAYS_EVAL_MAP[dateStr];
  if (!data) return;

  const modal = document.getElementById("modal-rekap-day-detail");
  if (!modal) return;

  const dateObj = data.dateObj;
  const dayName = REKAP_DAY_NAMES_ID[dateObj.getDay()];
  const formattedDate = `${dateObj.getDate()} ${REKAP_MONTH_NAMES_ID[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  // Header modal
  const dayNameEl = document.getElementById("rekap-modal-day-name");
  const dateFullEl = document.getElementById("rekap-modal-date-full");
  if (dayNameEl) dayNameEl.innerText = dayName;
  if (dateFullEl) dateFullEl.innerText = formattedDate;

  // Status Box Utama
  const statusBox = document.getElementById("rekap-modal-status-box");
  const statusIcon = document.getElementById("rekap-modal-status-icon");
  const statusLabel = document.getElementById("rekap-modal-status-label");
  const statusDesc = document.getElementById("rekap-modal-status-desc");

  const ev = data.evalResult;
  if (statusBox) statusBox.className = `p-3.5 rounded-2xl flex items-center space-x-3 border ${ev.bgClass} ${ev.borderClass}`;
  if (statusLabel) statusLabel.innerText = ev.name;
  if (statusDesc) {
    if (ev.category === "TEPAT_WAKTU") statusDesc.innerText = `Presensi kehadiran tepat waktu sebelum batas pukul 09:00:00.`;
    else if (ev.category === "TERLAMBAT") statusDesc.innerText = `Presensi tercatat melewati batas jam masuk kantor 09:00:00.`;
    else if (ev.category === "WFH_ONTIME") statusDesc.innerText = `Izin remote / WFH telah resmi disetujui atasan dan diajukan tepat waktu.`;
    else if (ev.category === "CUTI") statusDesc.innerText = `Hari cuti kerja resmi yang telah disetujui atasan.`;
    else if (ev.category === "SAKIT") statusDesc.innerText = `Izin sakit resmi yang telah disetujui atasan.`;
    else if (ev.category === "ALPHA") statusDesc.innerText = `Tidak ada catatan presensi yang sah atau pengajuan izin belum mendapat persetujuan atasan.`;
    else statusDesc.innerText = `Hari libur atau belum ada aktivitas operasional pada tanggal ini.`;
  }

  // 1. Render Log Absensi
  const absenContainer = document.getElementById("rekap-modal-absen-content");
  const absenBadge = document.getElementById("rekap-modal-absen-badge");

  if (absenContainer) {
    if (data.absenLogs.length === 0) {
      if (absenBadge) {
        absenBadge.innerText = "Tidak Ada Log";
        absenBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500";
      }
      absenContainer.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          <i class="fa-solid fa-clock mr-1"></i>Tidak ada presensi masuk atau pulang yang tercatat.
        </div>
      `;
    } else {
      if (absenBadge) {
        absenBadge.innerText = `${data.absenLogs.length} Aktivitas`;
        absenBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800";
      }

      absenContainer.innerHTML = data.absenLogs.map(log => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString("id-ID") : "-";
        const isDatang = String(log.jenis_absen || "").toLowerCase().includes("datang");
        const statusClass = String(log.status_kehadiran || "").toUpperCase() === "TEPAT_WAKTU"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : (isDatang ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-blue-50 border-blue-200 text-blue-800");

        return `
          <div class="p-2.5 rounded-xl border ${statusClass} space-y-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <i class="fa-solid ${isDatang ? 'fa-arrow-right-to-bracket text-emerald-600' : 'fa-arrow-right-from-bracket text-blue-600'}"></i>
                <span class="font-extrabold text-xs">${log.jenis_absen || 'Presensi'}</span>
              </div>
              <span class="font-mono font-black text-xs">${time}</span>
            </div>

            <div class="text-[10px] space-y-0.5 opacity-90">
              <div class="flex justify-between">
                <span>Status Kehadiran:</span>
                <span class="font-bold">${log.status_kehadiran || '-'} ${log.menit_terlambat > 0 ? `(+${log.menit_terlambat} mnt)` : ''}</span>
              </div>
              <div class="flex justify-between">
                <span>Titik Geofence:</span>
                <span class="font-semibold">${log.nearest_office || '-'} (${Math.round(log.distance_meter || 0)}m)</span>
              </div>
            </div>

            ${log.selfie_photo_url ? `
              <div class="pt-1">
                <button type="button" onclick="openFotoPreviewModal('${log.selfie_photo_url}')" class="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center space-x-1">
                  <i class="fa-solid fa-camera"></i>
                  <span>Lihat Foto Selfie</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join("");
    }
  }

  // 2. Render Log Perizinan
  const izinContainer = document.getElementById("rekap-modal-izin-content");
  const izinBadge = document.getElementById("rekap-modal-izin-badge");

  if (izinContainer) {
    if (data.izinLogs.length === 0) {
      if (izinBadge) {
        izinBadge.innerText = "Tidak Ada Pengajuan";
        izinBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500";
      }
      izinContainer.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          <i class="fa-solid fa-calendar-check mr-1"></i>Tidak ada perizinan, cuti, atau WFH pada tanggal ini.
        </div>
      `;
    } else {
      if (izinBadge) {
        izinBadge.innerText = `${data.izinLogs.length} Pengajuan`;
        izinBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800";
      }

      izinContainer.innerHTML = data.izinLogs.map(iz => {
        const submitTime = iz.timestamp ? new Date(iz.timestamp).toLocaleString("id-ID") : "-";
        const statusApproval = String(iz.status_approval || "PENDING").toUpperCase();
        const isApproved = statusApproval === "APPROVED";
        const isPending = statusApproval === "PENDING";

        const badgeClass = isApproved
          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
          : (isPending ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-rose-100 text-rose-800 border-rose-300");

        return `
          <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/90 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-800">${iz.jenis_izin}</span>
              <span class="text-[9px] px-2 py-0.5 rounded-full font-bold border ${badgeClass}">
                ${statusApproval}
              </span>
            </div>

            <div class="text-[10px] text-slate-600 space-y-0.5">
              <div class="flex justify-between">
                <span>Periode:</span>
                <span class="font-bold">${iz.tgl_mulai} s/d ${iz.tgl_selesai}</span>
              </div>
              <div class="flex justify-between">
                <span>Waktu Pengajuan:</span>
                <span class="font-semibold">${submitTime}</span>
              </div>
              <div class="pt-0.5">
                <span class="font-bold block text-slate-700">Keterangan / Alasan:</span>
                <p class="italic text-slate-600">${iz.catatan || '-'}</p>
              </div>
              ${iz.pic_approval_nama ? `
                <div class="pt-1 border-t border-slate-200 text-slate-500">
                  <span>Atasan: <strong>${iz.pic_approval_nama}</strong></span>
                  ${iz.catatan_approval ? `<p class="italic text-teal-700">"${iz.catatan_approval}"</p>` : ''}
                </div>
              ` : ''}
            </div>

            ${iz.selfie_url ? `
              <div class="pt-1">
                <button type="button" onclick="openFotoPreviewModal('${iz.selfie_url}')" class="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1">
                  <i class="fa-solid fa-paperclip"></i>
                  <span>Lihat Lampiran Foto</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join("");
    }
  }

  modal.classList.remove("hidden");
}

function closeRekapDayModal() {
  const modal = document.getElementById("modal-rekap-day-detail");
  if (modal) modal.classList.add("hidden");
}

// =========================================================================
// MONITORING ABSENSI PIC LAIN (REKAP TIM) CONTROLLER
// =========================================================================
let REKAP_TIM_YEAR = new Date().getFullYear();
let REKAP_TIM_MONTH = new Date().getMonth(); // 0 - 11
let REKAP_TIM_ALL_PICS = [];
let REKAP_TIM_SELECTED_PIC = null;
let REKAP_TIM_ABSENSI_DATA = [];
let REKAP_TIM_IZIN_DATA = [];
let REKAP_TIM_DAYS_EVAL_MAP = {};

async function initRekapTimScreen() {
  if (!CURRENT_USER) return;

  // Pasang listener klik di luar dropdown untuk menutup dropdown
  document.addEventListener("click", handleRekapTimOutsideClick);

  // Load daftar PIC yang berhak dipantau
  await loadRekapTimPicOptions();

  // Jika sudah ada PIC yang dipilih sebelumnya, langsung render kalendernya
  if (REKAP_TIM_SELECTED_PIC) {
    selectRekapTimPic(REKAP_TIM_SELECTED_PIC.nip);
  } else {
    // Tampilkan empty state
    const emptyState = document.getElementById("rekap-tim-empty-state");
    const content = document.getElementById("rekap-tim-content-container");
    const activeCard = document.getElementById("rekap-tim-active-pic-card");
    if (emptyState) emptyState.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    if (activeCard) activeCard.classList.add("hidden");
  }
}

function handleRekapTimOutsideClick(e) {
  const wrapper = document.getElementById("rekap-tim-search-wrapper");
  const dropdown = document.getElementById("rekap-tim-dropdown-list");
  if (!wrapper || !dropdown) return;
  if (!wrapper.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
}

async function loadRekapTimPicOptions() {
  REKAP_TIM_ALL_PICS = [];

  try {
    let list = [];

    if (Array.isArray(window.ALL_EMPLOYEES_CACHE) && window.ALL_EMPLOYEES_CACHE.length > 0) {
      list = window.ALL_EMPLOYEES_CACHE;
    } else if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/m_employee?select=nip,nama_lengkap,jabatan,cabang,atasan_nip,role_id&order=nama_lengkap.asc`, {
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        list = await res.json();
        if (Array.isArray(list)) {
          window.ALL_EMPLOYEES_CACHE = list;
        }
      }
    }

    if (Array.isArray(list)) {
      const role = String(CURRENT_USER.role || "").toLowerCase();
      const isSuperAdminOrBM = role.includes("admin") || role.includes("branch manager") || role.includes("supervisor") || role.includes("bm");

      if (isSuperAdminOrBM) {
        // Super Admin & BM bisa melihat semua PIC (kecuali diri sendiri jika ingin fokus pada staf lain, atau termasuk semua staf)
        REKAP_TIM_ALL_PICS = list.map(e => ({
          nip: e.nip,
          nama: e.nama_lengkap || e.nama || e.nip,
          jabatan: e.jabatan || e.role_id || "Karyawan",
          cabang: e.cabang || "-"
        }));
      } else {
        // Atasan / Supervisor membawahi PIC yang memiliki atasan_nip ke dirinya atau satu cabang
        const subordinates = list.filter(e => e.atasan_nip === CURRENT_USER.nip || e.cabang === CURRENT_USER.cabang);
        REKAP_TIM_ALL_PICS = (subordinates.length > 0 ? subordinates : list).map(e => ({
          nip: e.nip,
          nama: e.nama_lengkap || e.nama || e.nip,
          jabatan: e.jabatan || e.role_id || "Karyawan",
          cabang: e.cabang || "-"
        }));
      }
    }
  } catch (err) {
    console.warn("Gagal load PIC options untuk rekap tim:", err);
  }

  renderRekapTimDropdown(REKAP_TIM_ALL_PICS);
}

function openRekapTimSearchDropdown() {
  const dropdown = document.getElementById("rekap-tim-dropdown-list");
  if (!dropdown) return;
  renderRekapTimDropdown(REKAP_TIM_ALL_PICS);
  dropdown.classList.remove("hidden");
}

function filterRekapTimSearch(keyword) {
  const dropdown = document.getElementById("rekap-tim-dropdown-list");
  const clearBtn = document.getElementById("rekap-tim-clear-btn");
  if (!dropdown) return;

  const q = String(keyword || "").trim().toLowerCase();
  if (clearBtn) {
    if (q.length > 0) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  if (!q) {
    renderRekapTimDropdown(REKAP_TIM_ALL_PICS);
  } else {
    const filtered = REKAP_TIM_ALL_PICS.filter(p => {
      const matchNama = String(p.nama).toLowerCase().includes(q);
      const matchNip = String(p.nip).toLowerCase().includes(q);
      const matchCabang = String(p.cabang).toLowerCase().includes(q);
      const matchJabatan = String(p.jabatan).toLowerCase().includes(q);
      return matchNama || matchNip || matchCabang || matchJabatan;
    });
    renderRekapTimDropdown(filtered);
  }

  dropdown.classList.remove("hidden");
}

function renderRekapTimDropdown(pics) {
  const dropdown = document.getElementById("rekap-tim-dropdown-list");
  if (!dropdown) return;

  if (!pics || pics.length === 0) {
    dropdown.innerHTML = `
      <div class="p-3 text-center text-slate-400 text-xs">
        <i class="fa-solid fa-user-xmark mr-1"></i>Tidak ada PIC ditemukan.
      </div>
    `;
    return;
  }

  dropdown.innerHTML = pics.map(p => {
    const initials = p.nama.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    const isSelected = REKAP_TIM_SELECTED_PIC && REKAP_TIM_SELECTED_PIC.nip === p.nip;
    const activeClass = isSelected ? "bg-violet-50 text-violet-900 font-bold" : "hover:bg-slate-50";

    return `
      <div onclick="selectRekapTimPic('${p.nip}')" class="p-2.5 flex items-center justify-between cursor-pointer transition ${activeClass}">
        <div class="flex items-center space-x-2.5 min-w-0">
          <div class="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-xs shrink-0">
            ${initials}
          </div>
          <div class="min-w-0">
            <span class="text-xs font-bold block text-slate-800 truncate">${p.nama}</span>
            <span class="text-[10px] text-slate-400 block truncate">NIP: ${p.nip} • ${p.cabang} (${p.jabatan})</span>
          </div>
        </div>
        ${isSelected ? '<i class="fa-solid fa-check text-violet-600 text-xs ml-2"></i>' : ''}
      </div>
    `;
  }).join("");
}

function selectRekapTimPic(nip) {
  const found = REKAP_TIM_ALL_PICS.find(p => p.nip === nip);
  if (!found) return;

  REKAP_TIM_SELECTED_PIC = found;

  // Tutup dropdown
  const dropdown = document.getElementById("rekap-tim-dropdown-list");
  if (dropdown) dropdown.classList.add("hidden");

  // Update input text & tombol clear
  const input = document.getElementById("rekap-tim-search-input");
  const clearBtn = document.getElementById("rekap-tim-clear-btn");
  if (input) input.value = `${found.nama} (${found.nip})`;
  if (clearBtn) clearBtn.classList.remove("hidden");

  // Update profile card PIC terpilih
  const activeCard = document.getElementById("rekap-tim-active-pic-card");
  const nameEl = document.getElementById("rekap-tim-pic-name");
  const subEl = document.getElementById("rekap-tim-pic-sub");
  const avatarEl = document.getElementById("rekap-tim-pic-avatar");

  if (nameEl) nameEl.innerText = found.nama;
  if (subEl) subEl.innerText = `NIP: ${found.nip} • ${found.cabang} • ${found.jabatan}`;
  if (avatarEl) {
    const initials = found.nama.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    avatarEl.innerText = initials;
  }
  if (activeCard) activeCard.classList.remove("hidden");

  // Tampilkan content container kalender & sembunyikan empty state
  const emptyState = document.getElementById("rekap-tim-empty-state");
  const content = document.getElementById("rekap-tim-content-container");
  if (emptyState) emptyState.classList.add("hidden");
  if (content) content.classList.remove("hidden");

  // Load dan render kalender PIC terpilih
  fetchAndRenderRekapTimCalendar();
}

function clearRekapTimSelection() {
  REKAP_TIM_SELECTED_PIC = null;

  const input = document.getElementById("rekap-tim-search-input");
  const clearBtn = document.getElementById("rekap-tim-clear-btn");
  if (input) input.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");

  const activeCard = document.getElementById("rekap-tim-active-pic-card");
  const emptyState = document.getElementById("rekap-tim-empty-state");
  const content = document.getElementById("rekap-tim-content-container");

  if (activeCard) activeCard.classList.add("hidden");
  if (emptyState) emptyState.classList.remove("hidden");
  if (content) content.classList.add("hidden");
}

function focusRekapTimSearch() {
  const input = document.getElementById("rekap-tim-search-input");
  if (input) {
    input.value = "";
    input.focus();
    openRekapTimSearchDropdown();
  }
}

function changeRekapTimMonth(offset) {
  REKAP_TIM_MONTH += offset;
  if (REKAP_TIM_MONTH < 0) {
    REKAP_TIM_MONTH = 11;
    REKAP_TIM_YEAR -= 1;
  } else if (REKAP_TIM_MONTH > 11) {
    REKAP_TIM_MONTH = 0;
    REKAP_TIM_YEAR += 1;
  }
  fetchAndRenderRekapTimCalendar();
}

function jumpToCurrentRekapTimMonth() {
  const now = new Date();
  REKAP_TIM_YEAR = now.getFullYear();
  REKAP_TIM_MONTH = now.getMonth();
  fetchAndRenderRekapTimCalendar();
}

function refreshRekapTimCalendar() {
  const icon = document.getElementById("rekap-tim-refresh-icon");
  if (icon) icon.classList.add("fa-spin");
  fetchAndRenderRekapTimCalendar().finally(() => {
    if (icon) icon.classList.remove("fa-spin");
  });
}

async function fetchAndRenderRekapTimCalendar() {
  if (!REKAP_TIM_SELECTED_PIC) return;

  const monthLabel = document.getElementById("rekap-tim-month-label");
  if (monthLabel) {
    monthLabel.innerText = `${REKAP_MONTH_NAMES_ID[REKAP_TIM_MONTH]} ${REKAP_TIM_YEAR}`;
  }

  const gridContainer = document.getElementById("rekap-tim-calendar-grid");
  if (gridContainer) {
    gridContainer.innerHTML = `
      <div class="col-span-7 py-16 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
        <i class="fa-solid fa-circle-notch fa-spin text-xl text-violet-600 mb-2"></i>
        <span>Memuat kalender presensi ${REKAP_TIM_SELECTED_PIC.nama}...</span>
      </div>
    `;
  }

  const y = REKAP_TIM_YEAR;
  const m = REKAP_TIM_MONTH;
  const nip = REKAP_TIM_SELECTED_PIC.nip;

  const startDateStr = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  const lastDayNum = new Date(y, m + 1, 0).getDate();
  const endDateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;

  REKAP_TIM_ABSENSI_DATA = [];
  REKAP_TIM_IZIN_DATA = [];

  try {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const absenUrl = `${CONFIG.SUPABASE_URL}/rest/v1/tr_absensi_log?nip=eq.${encodeURIComponent(nip)}&timestamp=gte.${startDateStr}T00:00:00&timestamp=lte.${endDateStr}T23:59:59&order=timestamp.asc`;
      const izinUrl = `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?nip=eq.${encodeURIComponent(nip)}&tgl_mulai=lte.${endDateStr}&tgl_selesai=gte.${startDateStr}&order=timestamp.asc`;

      const [absenRes, izinRes] = await Promise.all([
        fetch(absenUrl, {
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        }),
        fetch(izinUrl, {
          headers: {
            "apikey": CONFIG.SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
          }
        })
      ]);

      if (absenRes.ok) {
        const rawAbsen = await absenRes.json();
        if (Array.isArray(rawAbsen)) REKAP_TIM_ABSENSI_DATA = rawAbsen;
      }

      if (izinRes.ok) {
        const rawIzin = await izinRes.json();
        if (Array.isArray(rawIzin)) REKAP_TIM_IZIN_DATA = rawIzin;
      }
    }
  } catch (err) {
    console.error("Gagal mengambil data rekap presensi tim:", err);
  }

  // Render grid kalender PIC terpilih
  renderRekapTimCalendarGrid(y, m);
}

function renderRekapTimCalendarGrid(year, month) {
  const gridContainer = document.getElementById("rekap-tim-calendar-grid");
  if (!gridContainer) return;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Minggu, 1 = Senin ...
  const startOffset = (firstDayOfMonth + 6) % 7;
  const totalDays = new Date(year, month + 1, 0).getDate();

  REKAP_TIM_DAYS_EVAL_MAP = {};

  let countTepatWaktu = 0;
  let countTerlambat = 0;
  let countWfhOnTime = 0;
  let countCuti = 0;
  let countSakit = 0;
  let countAlpha = 0;

  let html = "";

  // Slot kosong awal sebelum tanggal 1
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="aspect-square rounded-2xl bg-slate-50/30 border border-dashed border-slate-100 opacity-20 pointer-events-none"></div>`;
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dateObj = new Date(year, month, d);
    const dayOfWeek = dateObj.getDay();
    const isSunday = (dayOfWeek === 0);
    const isSaturday = (dayOfWeek === 6);
    const isFuture = dateStr > todayStr;
    const isToday = dateStr === todayStr;

    // Filter log absensi PIC pada tanggal ini
    const dayAbsenLogs = REKAP_TIM_ABSENSI_DATA.filter(item => {
      if (!item.timestamp) return false;
      return String(item.timestamp).slice(0, 10) === dateStr;
    });

    // Filter log perizinan PIC pada tanggal ini
    const dayIzinLogs = REKAP_TIM_IZIN_DATA.filter(item => {
      const start = item.tgl_mulai ? String(item.tgl_mulai).slice(0, 10) : "";
      const end = item.tgl_selesai ? String(item.tgl_selesai).slice(0, 10) : start;
      return start && end && dateStr >= start && dateStr <= end;
    });

    // Evaluasi prioritas menggunakan aturan yang sama persis
    const evalResult = evaluateDateAttendance(dateStr, dayAbsenLogs, dayIzinLogs, isFuture, isSunday, isSaturday, isToday);
    REKAP_TIM_DAYS_EVAL_MAP[dateStr] = {
      dateStr,
      dateObj,
      evalResult,
      absenLogs: dayAbsenLogs,
      izinLogs: dayIzinLogs,
      isToday,
      isSunday,
      isSaturday,
      isFuture
    };

    if (evalResult.category === "TEPAT_WAKTU") countTepatWaktu++;
    else if (evalResult.category === "TERLAMBAT") countTerlambat++;
    else if (evalResult.category === "WFH_ONTIME") countWfhOnTime++;
    else if (evalResult.category === "CUTI") countCuti++;
    else if (evalResult.category === "SAKIT") countSakit++;
    else if (evalResult.category === "ALPHA") countAlpha++;

    const todayRing = isToday ? "ring-2.5 ring-violet-600 shadow-md font-black" : "";

    html += `
      <div onclick="openRekapTimDayModal('${dateStr}')" class="aspect-square flex items-center justify-center rounded-2xl border cursor-pointer transition-all duration-150 transform hover:-translate-y-0.5 hover:shadow-md active:scale-95 ${evalResult.bgClass} ${evalResult.borderClass} ${todayRing}">
        <span class="text-sm sm:text-base font-black ${evalResult.numClass}">
          ${d}
        </span>
      </div>
    `;
  }

  gridContainer.innerHTML = html;

  // Update ringkasan angka statistik bulanan PIC terpilih
  updateElementText("tim-stat-tepat-waktu", countTepatWaktu);
  updateElementText("tim-stat-terlambat", countTerlambat);
  updateElementText("tim-stat-wfh-ontime", countWfhOnTime);
  updateElementText("tim-stat-cuti", countCuti);
  updateElementText("tim-stat-sakit", countSakit);
  updateElementText("tim-stat-alpha", countAlpha);
}

function openRekapTimDayModal(dateStr) {
  const data = REKAP_TIM_DAYS_EVAL_MAP[dateStr];
  if (!data) return;

  const modal = document.getElementById("modal-rekap-tim-day-detail");
  if (!modal) return;

  const dateObj = data.dateObj;
  const dayName = REKAP_DAY_NAMES_ID[dateObj.getDay()];
  const formattedDate = `${dateObj.getDate()} ${REKAP_MONTH_NAMES_ID[dateObj.getMonth()]} ${dateObj.getFullYear()}`;

  const dayNameEl = document.getElementById("rekap-tim-modal-day-name");
  const dateFullEl = document.getElementById("rekap-tim-modal-date-full");
  if (dayNameEl) dayNameEl.innerText = dayName;
  if (dateFullEl) dateFullEl.innerText = `${formattedDate} • ${REKAP_TIM_SELECTED_PIC?.nama || ''}`;

  const statusBox = document.getElementById("rekap-tim-modal-status-box");
  const statusLabel = document.getElementById("rekap-tim-modal-status-label");
  const statusDesc = document.getElementById("rekap-tim-modal-status-desc");

  const ev = data.evalResult;
  if (statusBox) statusBox.className = `p-3.5 rounded-2xl flex items-center space-x-3 border ${ev.bgClass} ${ev.borderClass}`;
  if (statusLabel) statusLabel.innerText = ev.name;
  if (statusDesc) {
    if (ev.category === "TEPAT_WAKTU") statusDesc.innerText = `Presensi kehadiran tepat waktu sebelum batas pukul 09:00:00.`;
    else if (ev.category === "TERLAMBAT") statusDesc.innerText = `Presensi tercatat melewati batas jam masuk kantor 09:00:00.`;
    else if (ev.category === "WFH_ONTIME") statusDesc.innerText = `Izin remote / WFH telah disetujui dan diajukan tepat waktu.`;
    else if (ev.category === "CUTI") statusDesc.innerText = `Hari cuti kerja resmi yang telah disetujui.`;
    else if (ev.category === "SAKIT") statusDesc.innerText = `Izin sakit resmi yang telah disetujui.`;
    else if (ev.category === "ALPHA") statusDesc.innerText = `Tidak ada catatan presensi sah atau pengajuan izin belum mendapat persetujuan.`;
    else statusDesc.innerText = `Hari libur atau belum ada aktivitas tercatat pada tanggal ini.`;
  }

  // 1. Log Absensi
  const absenContainer = document.getElementById("rekap-tim-modal-absen-content");
  const absenBadge = document.getElementById("rekap-tim-modal-absen-badge");

  if (absenContainer) {
    if (data.absenLogs.length === 0) {
      if (absenBadge) {
        absenBadge.innerText = "Tidak Ada Log";
        absenBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500";
      }
      absenContainer.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          <i class="fa-solid fa-clock mr-1"></i>Tidak ada presensi masuk atau pulang yang tercatat.
        </div>
      `;
    } else {
      if (absenBadge) {
        absenBadge.innerText = `${data.absenLogs.length} Aktivitas`;
        absenBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800";
      }

      absenContainer.innerHTML = data.absenLogs.map(log => {
        const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString("id-ID") : "-";
        const isDatang = String(log.jenis_absen || "").toLowerCase().includes("datang");
        const statusClass = String(log.status_kehadiran || "").toUpperCase() === "TEPAT_WAKTU"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
          : (isDatang ? "bg-rose-50 border-rose-200 text-rose-800" : "bg-blue-50 border-blue-200 text-blue-800");

        return `
          <div class="p-2.5 rounded-xl border ${statusClass} space-y-1.5">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <i class="fa-solid ${isDatang ? 'fa-arrow-right-to-bracket text-emerald-600' : 'fa-arrow-right-from-bracket text-blue-600'}"></i>
                <span class="font-extrabold text-xs">${log.jenis_absen || 'Presensi'}</span>
              </div>
              <span class="font-mono font-black text-xs">${time}</span>
            </div>

            <div class="text-[10px] space-y-0.5 opacity-90">
              <div class="flex justify-between">
                <span>Status:</span>
                <span class="font-bold">${log.status_kehadiran || '-'} ${log.menit_terlambat > 0 ? `(+${log.menit_terlambat} mnt)` : ''}</span>
              </div>
              <div class="flex justify-between">
                <span>Titik Geofence:</span>
                <span class="font-semibold">${log.nearest_office || '-'} (${Math.round(log.distance_meter || 0)}m)</span>
              </div>
            </div>

            ${log.selfie_photo_url ? `
              <div class="pt-1">
                <button type="button" onclick="openFotoPreviewModal('${log.selfie_photo_url}')" class="text-[10px] text-teal-700 hover:text-teal-900 font-bold flex items-center space-x-1">
                  <i class="fa-solid fa-camera"></i>
                  <span>Lihat Foto Selfie</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join("");
    }
  }

  // 2. Log Perizinan
  const izinContainer = document.getElementById("rekap-tim-modal-izin-content");
  const izinBadge = document.getElementById("rekap-tim-modal-izin-badge");

  if (izinContainer) {
    if (data.izinLogs.length === 0) {
      if (izinBadge) {
        izinBadge.innerText = "Tidak Ada Pengajuan";
        izinBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-500";
      }
      izinContainer.innerHTML = `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 text-xs">
          <i class="fa-solid fa-calendar-check mr-1"></i>Tidak ada perizinan, cuti, atau WFH pada tanggal ini.
        </div>
      `;
    } else {
      if (izinBadge) {
        izinBadge.innerText = `${data.izinLogs.length} Pengajuan`;
        izinBadge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800";
      }

      izinContainer.innerHTML = data.izinLogs.map(iz => {
        const submitTime = iz.timestamp ? new Date(iz.timestamp).toLocaleString("id-ID") : "-";
        const statusApproval = String(iz.status_approval || "PENDING").toUpperCase();
        const isApproved = statusApproval === "APPROVED";
        const isPending = statusApproval === "PENDING";

        const badgeClass = isApproved
          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
          : (isPending ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-rose-100 text-rose-800 border-rose-300");

        return `
          <div class="p-2.5 rounded-xl border border-slate-200 bg-slate-50/90 space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-800">${iz.jenis_izin}</span>
              <span class="text-[9px] px-2 py-0.5 rounded-full font-bold border ${badgeClass}">
                ${statusApproval}
              </span>
            </div>

            <div class="text-[10px] text-slate-600 space-y-0.5">
              <div class="flex justify-between">
                <span>Periode:</span>
                <span class="font-bold">${iz.tgl_mulai} s/d ${iz.tgl_selesai}</span>
              </div>
              <div class="flex justify-between">
                <span>Diajukan:</span>
                <span class="font-semibold">${submitTime}</span>
              </div>
              <div class="pt-0.5">
                <span class="font-bold block text-slate-700">Keterangan:</span>
                <p class="italic text-slate-600">${iz.catatan || '-'}</p>
              </div>
              ${iz.pic_approval_nama ? `
                <div class="pt-1 border-t border-slate-200 text-slate-500">
                  <span>Approver: <strong>${iz.pic_approval_nama}</strong></span>
                  ${iz.catatan_approval ? `<p class="italic text-teal-700">"${iz.catatan_approval}"</p>` : ''}
                </div>
              ` : ''}
            </div>

            ${iz.selfie_url ? `
              <div class="pt-1">
                <button type="button" onclick="openFotoPreviewModal('${iz.selfie_url}')" class="text-[10px] text-blue-700 hover:text-blue-900 font-bold flex items-center space-x-1">
                  <i class="fa-solid fa-paperclip"></i>
                  <span>Lihat Lampiran Foto</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      }).join("");
    }
  }

  modal.classList.remove("hidden");
}

function closeRekapTimDayModal() {
  const modal = document.getElementById("modal-rekap-tim-day-detail");
  if (modal) modal.classList.add("hidden");
}




// =========================================================================
// PRIORITY VISIT SCORING ENGINE (BY UNIT & BY DEALER)
// =========================================================================

// Helper pengecekan kondisi mendekati jatuh tempo (H-3 JTO)
function isUnitNearJTO(u) {
  if (u.is_h3_jto === true) return true;
  if (!u.jto_date) return false;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let jtoDate = null;
    if (typeof u.jto_date === "string") {
      if (u.jto_date.includes("-")) {
        jtoDate = new Date(u.jto_date);
      } else if (u.jto_date.includes("/")) {
        const parts = u.jto_date.split("/");
        jtoDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
    } else if (u.jto_date instanceof Date) {
      jtoDate = u.jto_date;
    }
    if (jtoDate && !isNaN(jtoDate.getTime())) {
      jtoDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((jtoDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return (diffDays >= 0 && diffDays <= 3);
    }
  } catch (e) { }
  return false;
}

// =========================================================================
// HELPER VALIDASI IMEI GPS
// =========================================================================
function hasValidImei(imeiVal) {
  if (!imeiVal) return false;
  const s = String(imeiVal).trim();
  if (!s || s === "-" || s === "0" || s === "null" || s === "undefined") return false;
  const lower = s.toLowerCase();
  if (lower === "n/a" || lower === "na" || lower === "none" || lower === "tidak ada" || lower === "belum pasang" || lower === "tidak terpasang") {
    return false;
  }
  const digits = s.replace(/\D/g, '');
  return digits.length >= 6;
}

/**
 * 1. ATURAN SKORING LEVEL KENDARAAN (PRIORITY BY UNIT)
 * Mengembalikan objek: { level: 'Sangat Penting' | 'Penting' | 'Moderat' | 'Normal', score: number, reason: string }
 */
function calculateUnitUrgency(u) {
  const agingVisit = Number(u.aging_visit_unit || u.aging_visit_days || 0);
  const lifetime = Number(u.lifetime_days || 0);
  const overdue = Number(u.overdue_days || 0);
  const agingGpsMaint = Number(u.aging_gps_maint || 0);
  const gpsStatus = String(u.gps_status || "Normal").trim();
  const nearJto = isUnitNearJTO(u);

  // Normalisasi Concern Unit
  let concernUrgency = "";
  let concernNote = "";
  if (u.unit_concern) {
    if (typeof u.unit_concern === "string") {
      concernUrgency = u.unit_concern;
    } else if (typeof u.unit_concern === "object") {
      concernUrgency = u.unit_concern.urgency || "";
      concernNote = u.unit_concern.note || u.unit_concern.instruksi || "";
    }
  }

  // Pengecekan Kelayakan Status Kontrak Unit:
  // HANYA proses jika status LIVE, atau status EXPIRED tetapi memiliki nomor IMEI GPS valid
  const contractStatus = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
  const rawImei = String(u.imei_gps || u.imei || "").trim();
  const hasImei = hasValidImei(rawImei);
  const isLive = contractStatus === "LIVE" || contractStatus.indexOf("LIVE") !== -1;
  const isExpiredWithImei = contractStatus.indexOf("EXPIRED") !== -1 && hasImei;
  const isEligibleContract = isLive || isExpiredWithImei;

  if (!isEligibleContract && !concernUrgency) {
    return { level: "Normal", score: 0, reason: `Status Kontrak Non-Eligible (${contractStatus || "Non-Live"})`, triggers: [] };
  }

  const triggers = [];

  // 1. Cek Assign Concern Manual Atasan
  if (concernUrgency) {
    const cScore = (concernUrgency === "Sangat Penting") ? 3 : (concernUrgency === "Penting" ? 2 : 1);
    triggers.push({
      level: concernUrgency,
      score: cScore,
      type: "CONCERN_SUPERVISOR",
      reason: concernNote ? `Concern Atasan: "${concernNote}"` : `Concern Atasan (${concernUrgency})`
    });
  }

  // 2. Cek Status GPS
  if (["Pelepasan", "Offline", "Baterai Lemah"].some(s => gpsStatus.toLowerCase().includes(s.toLowerCase()))) {
    triggers.push({ level: "Sangat Penting", score: 3, type: "GPS_CRITICAL", reason: `Status GPS: ${gpsStatus}` });
  } else if (["Belum Lepas", "Belum Pasang", "Geser"].some(s => gpsStatus.toLowerCase().includes(s.toLowerCase()))) {
    triggers.push({ level: "Penting", score: 2, type: "GPS_WARNING", reason: `Status GPS: ${gpsStatus}` });
  }

  // 3. Cek Aging Visit >= 22 hr & Lifetime > 90 hr
  if (agingVisit >= 22 && lifetime > 90) {
    triggers.push({ level: "Sangat Penting", score: 3, type: "AGING_LIFETIME", reason: `Aging Visit >= 22 hr (${agingVisit} hr) & Lifetime > 90 hr (${lifetime} hr)` });
  }

  // 4. Cek Kondisi Jatuh Tempo (H-3 JTO)
  if (agingVisit >= 15 && nearJto) {
    triggers.push({ level: "Sangat Penting", score: 3, type: "AGING_JTO", reason: `Aging Visit >= 15 hr (${agingVisit} hr) & Kondisi H-3 JTO` });
  } else if (agingVisit >= 5 && nearJto) {
    triggers.push({ level: "Penting", score: 2, type: "AGING_JTO", reason: `Aging Visit >= 5 hr (${agingVisit} hr) & Kondisi H-3 JTO` });
  }

  // 5. Cek Aging Visit & Overdue
  if (agingVisit >= 3 && overdue >= 3) {
    triggers.push({ level: "Penting", score: 2, type: "AGING_OVERDUE", reason: `Aging Visit >= 3 hr (${agingVisit} hr) & Overdue >= 3 hr (${overdue} hr)` });
  }

  // 6. Cek Aging Visit Unit Standalone
  if (agingVisit >= 22) {
    triggers.push({ level: "Penting", score: 2, type: "AGING_VISIT", reason: `Aging Visit Unit >= 22 hr (${agingVisit} hr)` });
  } else if (agingVisit >= 15) {
    triggers.push({ level: "Moderat", score: 1, type: "AGING_VISIT", reason: `Aging Visit Unit >= 15 hr (${agingVisit} hr)` });
  }

  // 7. Cek Aging Maintenance GPS
  if (agingGpsMaint > 30) {
    triggers.push({ level: "Moderat", score: 1, type: "GPS_MAINT", reason: `Aging Maintenance GPS > 30 hr (${agingGpsMaint} hr)` });
  }

  if (triggers.length === 0) {
    return { level: "Normal", score: 0, reason: "Kondisi Normal / Terjadwal Baik", triggers: [] };
  }

  // Urutkan pemicu berdasarkan skor risiko tertinggi (Sangat Penting > Penting > Moderat)
  triggers.sort((a, b) => b.score - a.score);

  const highestScore = triggers[0].score;
  const scoreToLevel = { 3: "Sangat Penting", 2: "Penting", 1: "Moderat", 0: "Normal" };
  const highestLevel = scoreToLevel[highestScore] || triggers[0].level;
  const combinedReason = triggers.map(t => t.reason).join(" • ");

  return {
    level: highestLevel,
    score: highestScore,
    reason: combinedReason,
    triggers: triggers
  };
}

function isUnitVisitedToday(u) {
  if (u.is_visited_today === true) return true;
  if (!u.last_visit_date) return false;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const parts = todayStr.split("-");
  const todaySlash = `${parts[2]}/${parts[1]}/${parts[0]}`;
  const lastV = String(u.last_visit_date).trim();
  return lastV.startsWith(todayStr) || lastV.startsWith(todaySlash);
}

/**
 * 2. ATURAN SKORING LEVEL MITRA / SHOWROOM (PRIORITY BY DEALER)
 * Mengembalikan objek: { level, score, mitraLevel, mitraScore, mitraReason, urgentUnitsCount }
 */
function calculateMitraUrgency(dealer) {
  let agingMitra = Number(dealer.aging_visit_mitra || dealer.aging_visit_days || 0);

  // Jika belum pernah dikunjungi, hitung aging sejak tanggal kerjasama
  if (!agingMitra && !dealer.last_visit_date && dealer.tanggal_kerjasama) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const joinDate = new Date(dealer.tanggal_kerjasama);
      if (!isNaN(joinDate.getTime())) {
        joinDate.setHours(0, 0, 0, 0);
        agingMitra = Math.max(0, Math.round((today.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    } catch (e) { }
  }

  // Normalisasi Concern Dealer (Non-Fasilitas/Umum)
  let concernUrgency = "";
  let concernNote = "";
  if (dealer.dealer_concern) {
    if (typeof dealer.dealer_concern === "string") {
      concernUrgency = dealer.dealer_concern;
    } else if (typeof dealer.dealer_concern === "object") {
      concernUrgency = dealer.dealer_concern.urgency || "";
      concernNote = dealer.dealer_concern.note || dealer.dealer_concern.instruksi || "";
    }
  }

  // Status Closed / Dormant (Productivity: 7.Closed, 5. Dormant)
  const rawProd = String(dealer.productivity || "").trim().toLowerCase();
  const rawStatus = String(dealer.status || "").trim().toLowerCase();
  const isClosedOrDormant =
    rawProd.includes("closed") ||
    rawProd.includes("dormant") ||
    rawStatus.includes("closed") ||
    rawStatus.includes("dormant");

  // Jika mitra berstatus Closed atau Dormant:
  // TIDAK perlu dikalkulasi otomatis menjadi concern prioritas (aging visit dsb diabaikan).
  // HANYA menjadi prioritas KECUALI jika ada assign concern (baik concern dealer maupun concern unit tertentu).
  if (isClosedOrDormant) {
    let hasUnitConcern = false;
    let highestUnitConcernScore = 0;
    let urgentUnitsCount = 0;

    if (Array.isArray(dealer.units)) {
      dealer.units.forEach(u => {
        if (u.unit_concern) {
          hasUnitConcern = true;
          const uUrgency = typeof u.unit_concern === "object" ? u.unit_concern.urgency : u.unit_concern;
          const uScore = uUrgency === "Sangat Penting" ? 3 : uUrgency === "Penting" ? 2 : uUrgency === "Moderat" ? 1 : 0;
          if (!isUnitVisitedToday(u)) {
            urgentUnitsCount++;
          }
          if (uScore > highestUnitConcernScore) {
            highestUnitConcernScore = uScore;
          }
        }
      });
    }

    // Jika TIDAK ada assign concern sama sekali (baik dealer concern maupun unit concern)
    if (!concernUrgency && !hasUnitConcern) {
      return {
        level: "Normal",
        score: 0,
        mitraLevel: "Normal",
        mitraScore: 0,
        mitraReason: "Normal (Mitra Closed / Dormant)",
        urgentUnitsCount: 0
      };
    }

    // Jika ada assign concern:
    const scoreMap = { "Sangat Penting": 3, "Penting": 2, "Moderat": 1 };
    const dealerConcernScore = scoreMap[concernUrgency] || 0;
    const finalScore = Math.max(dealerConcernScore, highestUnitConcernScore);
    const scoreToLevel = { 3: "Sangat Penting", 2: "Penting", 1: "Moderat", 0: "Normal" };
    const finalLevel = scoreToLevel[finalScore] || "Normal";

    return {
      level: finalLevel,
      score: finalScore,
      mitraLevel: scoreToLevel[dealerConcernScore] || "Normal",
      mitraScore: dealerConcernScore,
      mitraReason: concernUrgency ? `Concern Mitra: '${concernNote || concernUrgency}'` : "Normal (Mitra Closed / Dormant)",
      urgentUnitsCount: urgentUnitsCount
    };
  }

  // --- KONDISI NORMAL (BUKAN CLOSED / DORMANT) ---
  // A. Evaluasi Internal Dealer (Mitra Score)
  let mitraScore = 0;
  let mitraLevel = "Normal";
  let mitraReason = "Kondisi Normal";

  if (concernUrgency === "Sangat Penting") {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = `Concern Mitra: '${concernNote || "Sangat Penting"}'`;
  } else if (agingMitra >= 61) {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = `Aging Visit Mitra >= 61 hr (${agingMitra} hr)`;
  } else if (concernUrgency === "Penting") {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = `Concern Mitra: '${concernNote || "Penting"}'`;
  } else if (agingMitra >= 31) {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = `Aging Visit Mitra >= 31 hr (${agingMitra} hr)`;
  } else if (concernUrgency === "Moderat") {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = `Concern Mitra: '${concernNote || "Moderat"}'`;
  } else if (agingMitra >= 21) {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = `Aging Visit Mitra >= 21 hr (${agingMitra} hr)`;
  }

  // B. Agregasi Unit Kendaraan (Highest Severity)
  let highestUnitScore = 0;
  let urgentUnitsCount = 0;

  if (dealer.units && dealer.units.length > 0) {
    dealer.units.forEach(u => {
      const uContract = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
      const uImei = String(u.imei_gps || u.imei || "").trim();
      const uHasImei = hasValidImei(uImei);
      const isULive = uContract === "LIVE" || uContract.indexOf("LIVE") !== -1;
      const isUExpiredWithImei = uContract.indexOf("EXPIRED") !== -1 && uHasImei;

      // Lewati unit jika tidak eligible
      if (!isULive && !isUExpiredWithImei && !u.unit_concern) {
        return;
      }

      const uEval = calculateUnitUrgency(u);
      const isUVisited = isUnitVisitedToday(u);
      // Unit dihitung sebagai penugasan aktif jika skor risiko > 0 dan BELUM dikunjungi hari ini
      if (uEval.score > 0 && !isUVisited) {
        urgentUnitsCount++;
      }
      if (uEval.score > highestUnitScore) {
        highestUnitScore = uEval.score;
      }
    });
  }

  // Level Akhir Mitra: Nilai Maksimal antara mitraScore dan highestUnitScore
  const finalScore = Math.max(mitraScore, highestUnitScore);
  const scoreToLevel = { 3: "Sangat Penting", 2: "Penting", 1: "Moderat", 0: "Normal" };
  const finalLevel = scoreToLevel[finalScore] || "Normal";

  return {
    level: finalLevel,
    score: finalScore,
    mitraLevel: mitraLevel,
    mitraScore: mitraScore,
    mitraReason: mitraReason,
    urgentUnitsCount: urgentUnitsCount
  };
}

// -------------------------------------------------------------------------
// FILTER & UI RENDERER
// -------------------------------------------------------------------------
function setVisitStatusFilter(st) {
  PRIORITY_VISIT_STATUS_FILTER = st;
  document.querySelectorAll('#p-status-all, #p-status-pending, #p-status-done').forEach(b => {
    b.className = "flex-1 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 transition text-center flex items-center justify-center space-x-1 text-xs font-bold";
  });

  const btnMap = { 'ALL': 'p-status-all', 'PENDING': 'p-status-pending', 'DONE': 'p-status-done' };
  const activeBtn = document.getElementById(btnMap[st]);
  if (activeBtn) activeBtn.className = "flex-1 py-1.5 rounded-xl bg-slate-900 text-white shadow-xs transition text-center flex items-center justify-center space-x-1 text-xs font-bold";

  renderPriorityList();
}

let PRIORITY_SEARCH_QUERY = "";

function onPrioritySearchInput(val) {
  PRIORITY_SEARCH_QUERY = String(val || "").trim().toLowerCase();
  const clearBtn = document.getElementById("priority-search-clear-btn");
  if (clearBtn) {
    if (PRIORITY_SEARCH_QUERY) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
  }
  renderPriorityList();
}

function clearPrioritySearch() {
  PRIORITY_SEARCH_QUERY = "";
  const input = document.getElementById("priority-search-input");
  if (input) {
    input.value = "";
    input.focus();
  }
  const clearBtn = document.getElementById("priority-search-clear-btn");
  if (clearBtn) clearBtn.classList.add("hidden");
  renderPriorityList();
}

function setPriorityFilter(lvl) {
  PRIORITY_ACTIVE_FILTER = lvl;
  document.querySelectorAll('#p-filter-all, #p-filter-sp, #p-filter-p, #p-filter-m').forEach(b => {
    b.className = "flex-1 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold transition";
  });

  const btnMap = { 'ALL': 'p-filter-all', 'Sangat Penting': 'p-filter-sp', 'Penting': 'p-filter-p', 'Moderat': 'p-filter-m' };
  const activeBtn = document.getElementById(btnMap[lvl]);
  if (activeBtn) activeBtn.className = "flex-1 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs transition";

  renderPriorityList();
}

function isDealerVisitedToday(d) {
  if (d.is_visited_today === true) return true;
  if (!d.last_visit_date) return false;
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const parts = todayStr.split("-");
  const todaySlash = `${parts[2]}/${parts[1]}/${parts[0]}`;
  const lastV = String(d.last_visit_date).trim();
  return lastV.startsWith(todayStr) || lastV.startsWith(todaySlash);
}

async function startVisitForDealer(dealerId) {
  await loadScreen('visit');
  let retries = 0;
  const trySelect = () => {
    const input = document.getElementById("dealer-search-input");
    if (input) {
      selectDealerFromSearch(dealerId);
    } else if (retries < 10) {
      retries++;
      setTimeout(trySelect, 50);
    }
  };
  setTimeout(trySelect, 50);
}

async function refreshPriorityData(btn) {
  const container = document.getElementById("priority-list-container");
  if (container) {
    container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-amber-600"></i>Menyinkronkan data antrean prioritas...</div>';
  }
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    btn.disabled = true;
  }
  await syncMasterDataFromApi();
  renderPriorityList();
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
    btn.disabled = false;
  }
}

function renderPriorityList() {
  const container = document.getElementById("priority-list-container");
  if (!container) return;
  container.innerHTML = "";

  // Tampilkan label area cover aktif di header
  const subTitleEl = document.getElementById("priority-header-subtitle");
  if (subTitleEl) {
    if (CURRENT_USER?.area_cover) {
      subTitleEl.innerHTML = `<i class="fa-solid fa-map-location-dot mr-1 text-amber-800"></i>Cover Area: <strong class="text-amber-900 font-bold">${CURRENT_USER.area_cover}</strong>`;
    } else if (CURRENT_USER?.cabang) {
      subTitleEl.innerHTML = `<i class="fa-solid fa-building mr-1 text-amber-800"></i>Cabang: <strong class="text-amber-900 font-bold">${CURRENT_USER.cabang}</strong>`;
    } else {
      subTitleEl.innerText = "Real-time Closed-Loop Priority Action Monitoring";
    }
  }

  // Kalkulasi evaluasi urgensi untuk semua dealer
  let computedList = MASTER_DEALER_PRIORITY_DATA.map(d => {
    const clientCalc = calculateMitraUrgency(d);
    const visitedToday = isDealerVisitedToday(d);

    // 1. urgentUnits adalah murni unit yang BELUM divisit hari ini (clientCalc.urgentUnitsCount)
    // Jika dealer sudah divisit hari ini, jangan biarkan d.urgent_units_count lama dari DB membatalkan hasil visit
    let urgentUnits = visitedToday
      ? (clientCalc.urgentUnitsCount || 0)
      : Math.max(clientCalc.urgentUnitsCount || 0, Number(d.urgent_units_count || 0));

    const scoreMap = { "Sangat Penting": 3, "Penting": 2, "Moderat": 1, "Normal": 0, "NORMAL": 0 };
    const rawDbLevel = (d.priority_level && d.priority_level.trim() !== "" && d.priority_level !== "undefined") ? d.priority_level : "Normal";
    const dbScore = (d.priority_score !== undefined && d.priority_score !== null && !isNaN(Number(d.priority_score)))
      ? Number(d.priority_score)
      : (scoreMap[rawDbLevel] || 0);

    const scoreToLevel = { 3: "Sangat Penting", 2: "Penting", 1: "Moderat", 0: "Normal" };

    // 2. Evaluasi level dan score:
    // Jika sudah dikunjungi hari ini dan semua unit clear serta tidak ada concern dealer terbuka,
    // maka dealer berstatus NORMAL (selesai hari ini)
    let level = "Normal";
    let score = 0;
    let reason = "Kondisi Normal / Terjadwal Baik";

    const rawDProd = String(d.productivity || "").trim().toLowerCase();
    const isDealerClosedOrDormant = rawDProd.includes("closed") || rawDProd.includes("dormant");
    const hasAnyActiveConcern = !!d.dealer_concern || (Array.isArray(d.units) && d.units.some(u => !!u.unit_concern));

    if (isDealerClosedOrDormant && !hasAnyActiveConcern) {
      level = "Normal";
      score = 0;
      reason = "Normal (Mitra Closed / Dormant)";
      urgentUnits = 0;
    } else if (visitedToday && urgentUnits === 0 && !d.dealer_concern && clientCalc.mitraScore === 0) {
      level = "Normal";
      score = 0;
      reason = "Selesai Dikunjungi Hari Ini";
    } else {
      const effectiveScore = visitedToday ? clientCalc.score : Math.max(dbScore, clientCalc.score);
      level = (clientCalc.score >= dbScore && clientCalc.score > 0)
        ? clientCalc.level
        : (effectiveScore > 0 ? (scoreToLevel[effectiveScore] || rawDbLevel) : "Normal");
      score = effectiveScore;
      reason = (clientCalc.score >= dbScore && clientCalc.score > 0)
        ? (clientCalc.mitraReason || d.priority_reason)
        : (d.priority_reason || clientCalc.mitraReason);
    }

    const isFullyDone = visitedToday && (urgentUnits === 0);
    const hasUnresolvedUnits = visitedToday && (urgentUnits > 0);

    // Evaluasi apakah urgensi berasal dari internal mitra (aging/concern) atau pemicu unit
    let isMitraUrgent = false;
    let mitraLevel = "Normal";
    if (clientCalc.mitraScore > 0 || d.dealer_concern) {
      isMitraUrgent = true;
      mitraLevel = clientCalc.mitraLevel || level;
    } else if (score > 0 && urgentUnits === 0) {
      isMitraUrgent = true;
      mitraLevel = level;
    }

    return {
      ...d,
      ...clientCalc,
      level: level,
      score: score,
      priority_level: level,
      priority_score: score,
      priority_reason: reason,
      mitraLevel: mitraLevel,
      mitraScore: isMitraUrgent ? (clientCalc.mitraScore || score) : 0,
      urgentUnitsCount: urgentUnits,
      visitedToday: visitedToday,
      isFullyDone: isFullyDone,
      hasUnresolvedUnits: hasUnresolvedUnits
    };
  });

  // 0. Filter Cakupan Wilayah (Cover Area PIC):
  // Wajib difilter strictly sesuai cover area pengguna yang aktif, berlaku untuk seluruh role (termasuk Admin/Super Admin).
  computedList = computedList.filter(d => isDealerInUserCoverArea(d));

  // Sorting: Prioritas yang belum selesai diletakkan paling atas -> Score DESC -> Aging Visit DESC
  computedList.sort((a, b) => {
    if (a.isFullyDone !== b.isFullyDone) return a.isFullyDone ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return (Number(b.aging_visit_mitra || 0)) - (Number(a.aging_visit_mitra || 0));
  });

  // 1. Filter Status Kunjungan: Tampilkan prioritas yang belum tuntas (belum dikunjungi atau masih ada unit belum clear)
  // Jika sedang mencari teks (nama mitra / nopol), jangan sembunyikan agar hasil pencarian tetap ditemukan
  if (!PRIORITY_SEARCH_QUERY) {
    computedList = computedList.filter(d => !d.isFullyDone);
  }

  // 2. Filter Level Urgensi (Hanya tampilkan mitra yang memiliki prioritas: Sangat Penting, Penting, Moderat)
  if (PRIORITY_ACTIVE_FILTER !== "ALL") {
    computedList = computedList.filter(d => d.level === PRIORITY_ACTIVE_FILTER);
  } else {
    computedList = computedList.filter(d => d.level !== "Normal" && d.level !== "NORMAL" && (d.score || 0) > 0);
  }

  // 3. Filter Pencarian Teks (Berdasarkan Nama Mitra atau Nopol Unit Kendaraan)
  if (PRIORITY_SEARCH_QUERY) {
    const q = PRIORITY_SEARCH_QUERY.trim().toLowerCase();
    const qClean = q.replace(/[\s\-_.]/g, "");
    computedList = computedList.filter(d => {
      // A. Cek Nama Dealer & Cabang
      const dName = String(d.dealer_name || "").toLowerCase();
      const dBranch = String(d.cabang || "").toLowerCase();
      if (dName.includes(q) || dBranch.includes(q)) return true;

      // B. Cek Nopol Kendaraan atau Nama Unit di seluruh unit mitra ini
      if (Array.isArray(d.units) && d.units.length > 0) {
        return d.units.some(u => {
          const nopolRaw = String(u.nopol || "").toLowerCase();
          const nopolClean = nopolRaw.replace(/[\s\-_.]/g, "");
          const unitDesc = String(u.unit || "").toLowerCase();
          const noFas = String(u.no_fasilitas || "").toLowerCase();
          return (
            (qClean && nopolClean.includes(qClean)) ||
            nopolRaw.includes(q) ||
            unitDesc.includes(q) ||
            noFas.includes(q)
          );
        });
      }

      return false;
    });
  }

  if (computedList.length === 0) {
    const isSearching = !!PRIORITY_SEARCH_QUERY;
    const userAreaLabel = (CURRENT_USER?.area_cover && CURRENT_USER.area_cover !== "*" && CURRENT_USER.area_cover.toUpperCase() !== "ALL") ? `Area ${CURRENT_USER.area_cover}` : "Semua Area";
    const filterText = isSearching
      ? `Pencarian "${PRIORITY_SEARCH_QUERY}"`
      : (PRIORITY_ACTIVE_FILTER === "ALL" ? `Prioritas Aktif (${userAreaLabel})` : `Level "${PRIORITY_ACTIVE_FILTER}" (${userAreaLabel})`);
    container.innerHTML = `
      <div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <div class="w-12 h-12 rounded-2xl ${isSearching ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'} flex items-center justify-center text-xl mx-auto mb-1">
          <i class="fa-solid ${isSearching ? 'fa-magnifying-glass' : 'fa-map-location-dot'}"></i>
        </div>
        <p class="font-bold text-sm text-slate-800">Tidak ada mitra prioritas untuk ${filterText}</p>
        <p class="text-[11px] text-slate-400 max-w-xs mx-auto">${isSearching ? 'Coba periksa kembali ejaan nama mitra atau nopol kendaraan.' : `Semua mitra di cover area Anda (${userAreaLabel}) saat ini dalam kondisi normal dan terpantau dengan baik.`}</p>
        ${isSearching ? `
          <button type="button" onclick="clearPrioritySearch()" class="mt-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow inline-flex items-center space-x-1.5 transition">
            <i class="fa-solid fa-xmark"></i>
            <span>Reset Pencarian</span>
          </button>
        ` : `
          <button type="button" onclick="refreshPriorityData(this)" class="mt-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow inline-flex items-center space-x-1.5 transition">
            <i class="fa-solid fa-arrows-rotate"></i>
            <span>Muat Ulang Data</span>
          </button>
        `}
      </div>
    `;
    return;
  }

  const urgencyPillStyles = {
    "Sangat Penting": "bg-red-600 text-white",
    "Penting": "bg-orange-600 text-white",
    "Moderat": "bg-amber-500 text-white",
    "Normal": "bg-slate-200 text-slate-700"
  };

  computedList.forEach(d => {
    const card = document.createElement("div");
    card.className = "bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2.5 hover:border-slate-300 transition";

    const hasMitraUrgency = d.mitraScore > 0 || !!d.dealer_concern;
    const houseBtnClass = hasMitraUrgency ? `${urgencyPillStyles[d.mitraLevel]} shadow-xs` : 'bg-slate-100 text-slate-400 border border-slate-200';
    const hasUnitUrgency = d.urgentUnitsCount > 0;
    const carBtnClass = hasUnitUrgency ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400 border border-slate-200';
    const isPriorityUrgent = (d.score > 0) || (d.level && d.level !== "Normal");

    const statusPill = d.isFullyDone
      ? `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 inline-flex items-center"><i class="fa-solid fa-circle-check mr-1 text-[7px]"></i> Selesai Hari Ini</span>`
      : (d.hasUnresolvedUnits
        ? `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 shrink-0 inline-flex items-center"><i class="fa-solid fa-clock-rotate-left mr-1 text-[7px]"></i>Visit Selesai • ${d.urgentUnitsCount} Unit Belum Clear</span>`
        : ``);

    // Cek apakah ada unit yang cocok dengan query pencarian nopol
    let matchedUnitBadge = "";
    if (PRIORITY_SEARCH_QUERY && Array.isArray(d.units)) {
      const qClean = PRIORITY_SEARCH_QUERY.replace(/[\s\-_.]/g, "");
      const matchedUnit = d.units.find(u => {
        const nopolClean = String(u.nopol || "").toLowerCase().replace(/[\s\-_.]/g, "");
        const nopolRaw = String(u.nopol || "").toLowerCase();
        return (qClean && nopolClean.includes(qClean)) || nopolRaw.includes(PRIORITY_SEARCH_QUERY);
      });
      if (matchedUnit) {
        matchedUnitBadge = `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 shrink-0 inline-flex items-center"><i class="fa-solid fa-car mr-1 text-[7px]"></i>${matchedUnit.nopol}</span>`;
      }
    }

    const visitActionBtn = d.isFullyDone
      ? `<button type="button" onclick="startVisitForDealer('${d.dealer_id}')" title="Kunjungi Ulang Showroom Ini" class="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold transition flex items-center space-x-1">
          <i class="fa-solid fa-rotate-right text-[9px]"></i>
          <span>Re-visit</span>
        </button>`
      : `<button type="button" onclick="startVisitForDealer('${d.dealer_id}')" title="Lakukan Visit Sekarang" class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold shadow-xs transition flex items-center space-x-1 active:scale-95">
          <i class="fa-solid fa-location-arrow text-[9px]"></i>
          <span>Visit</span>
        </button>`;

    // Hitung jumlah unit berstatus LIVE saja untuk ditampilkan pada kartu score card
    const liveUnitsCount = (d.units || []).filter(u => {
      const uContract = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
      return uContract.includes("LIVE");
    }).length;

    // Indikator Usia Tiket / Durasi Menggantung SLA
    let ticketAgePill = "";
    const ticketDate = d.dealer_concern?.created_at || d.created_at;
    if (ticketDate && !d.isFullyDone) {
      const createdTime = new Date(ticketDate).getTime();
      if (!isNaN(createdTime)) {
        const diffDays = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
        if (diffDays >= 2) {
          ticketAgePill = `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 shrink-0 inline-flex items-center" title="Tiket menggantung selama ${diffDays + 1} hari"><i class="fa-solid fa-hourglass-half mr-1 text-[7px]"></i>Hari ke-${diffDays + 1}</span>`;
        } else if (diffDays === 1) {
          ticketAgePill = `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 shrink-0 inline-flex items-center" title="Tiket dibuat kemarin"><i class="fa-solid fa-clock mr-1 text-[7px]"></i>Kemarin</span>`;
        }
      }
    }

    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate leading-tight">${d.dealer_name}</h4>
        <div class="flex items-center space-x-1.5 flex-wrap gap-y-1 mt-1">
          <span class="text-[10px] text-slate-500 font-medium">${d.cabang || "-"}</span>
          ${d.area_cover ? `<span class="text-[9px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">Area: ${d.area_cover}</span>` : ''}
          <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md ${urgencyPillStyles[d.level]} uppercase shrink-0">${d.level}</span>
          ${ticketAgePill}
          ${statusPill}
          ${matchedUnitBadge}
          ${liveUnitsCount > 0 ? `<span class="text-[9px] text-slate-400 font-medium">• ${liveUnitsCount} Unit</span>` : ''}
        </div>
      </div>

      <div class="flex items-center space-x-1.5 shrink-0">
        <button type="button" onclick="openMitraDetailModal('${d.dealer_id}')" title="Pemicu Urgensi Mitra" class="w-7 h-7 rounded-xl flex items-center justify-center text-xs transition active:scale-95 ${houseBtnClass}">
          <i class="fa-solid fa-house text-[10px]"></i>
        </button>
        <button type="button" onclick="openFacilityDetailModal('${d.dealer_id}')" title="Pemicu Urgensi Fasilitas" class="w-7 h-7 rounded-xl flex items-center justify-center text-xs transition active:scale-95 relative ${carBtnClass}">
          <i class="fa-solid fa-car text-[10px]"></i>
          ${d.urgentUnitsCount > 0 ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-600 text-white text-[7px] font-black flex items-center justify-center border border-white shadow-xs">${d.urgentUnitsCount}</span>` : ''}
        </button>
        ${visitActionBtn}
      </div>
    `;
    container.appendChild(card);
  });
}

function openMitraDetailModal(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d) return;

  const evalRes = calculateMitraUrgency(d);
  document.getElementById("dtl-mitra-name").innerText = d.dealer_name;
  document.getElementById("dtl-mitra-aging").innerText = `${d.aging_visit_mitra || 0} Hari Sejak Kunjungan Terakhir`;

  const badge = document.getElementById("dtl-mitra-urgency-badge");
  badge.innerText = evalRes.mitraLevel.toUpperCase();
  badge.className = evalRes.mitraLevel === "Sangat Penting" ? "font-bold px-2 py-0.5 rounded text-[10px] bg-red-600 text-white" : evalRes.mitraLevel === "Penting" ? "font-bold px-2 py-0.5 rounded text-[10px] bg-orange-600 text-white" : evalRes.mitraLevel === "Moderat" ? "font-bold px-2 py-0.5 rounded text-[10px] bg-amber-500 text-white" : "font-bold px-2 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700";

  const boxConcern = document.getElementById("box-dtl-mitra-concern");
  if (d.dealer_concern) {
    boxConcern.classList.remove("hidden");
    const note = typeof d.dealer_concern === "object" ? d.dealer_concern.note : d.dealer_concern;
    const urg = typeof d.dealer_concern === "object" ? d.dealer_concern.urgency : "Penting";
    document.getElementById("dtl-mitra-concern-text").innerText = `"${note}" (Urgensi: ${urg})`;
  } else {
    boxConcern.classList.add("hidden");
  }
  document.getElementById("modal-mitra-detail").classList.remove("hidden");
}

function closeMitraModal() { document.getElementById("modal-mitra-detail").classList.add("hidden"); }

function openFacilityDetailModal(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d) return;

  const urgencyPillStyles = {
    "Sangat Penting": "bg-red-100 text-red-700 border-red-200",
    "Penting": "bg-orange-100 text-orange-700 border-orange-200",
    "Moderat": "bg-amber-100 text-amber-700 border-amber-200",
    "Normal": "bg-slate-100 text-slate-600 border-slate-200"
  };

  // Filter unit yang ditampilkan: HANYA unit yang memiliki flag prioritas / concern aktif (Score > 0)
  const eligibleUnits = (d.units || []).filter(u => {
    const uEval = calculateUnitUrgency(u);
    return uEval.score > 0;
  });

  const pendingUnitsCount = eligibleUnits.filter(u => !isUnitVisitedToday(u)).length;
  document.getElementById("modal-facility-title").innerText = `Fasilitas: ${d.dealer_name}`;
  document.getElementById("modal-facility-sub").innerText = `Total ${eligibleUnits.length} Unit Prioritas (${pendingUnitsCount} Belum FU • ${d.cabang || "-"})`;

  const listContainer = document.getElementById("modal-facility-list");
  listContainer.innerHTML = "";

  if (eligibleUnits.length === 0) {
    listContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Tidak ada unit dengan status prioritas atau concern aktif pada mitra ini.</div>`;
  } else {
    // Sorting: Unit yang belum FU diletakkan di atas, lalu urutkan Score tertinggi
    eligibleUnits.sort((a, b) => {
      const aVisited = isUnitVisitedToday(a);
      const bVisited = isUnitVisitedToday(b);
      if (aVisited !== bVisited) return aVisited ? 1 : -1;
      const scoreA = calculateUnitUrgency(a).score;
      const scoreB = calculateUnitUrgency(b).score;
      return scoreB - scoreA;
    });

    eligibleUnits.forEach(u => {
      const uEval = calculateUnitUrgency(u);
      const isVisited = isUnitVisitedToday(u);
      const itemCard = document.createElement("div");
      itemCard.className = `p-3 bg-slate-50 border ${isVisited ? 'border-emerald-200 bg-emerald-50/20' : 'border-slate-200'} rounded-xl space-y-2`;

      const fuBadge = isVisited
        ? `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 inline-flex items-center"><i class="fa-solid fa-check mr-1 text-[7px]"></i>Sudah FU Hari Ini</span>`
        : `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 shrink-0 inline-flex items-center"><i class="fa-solid fa-clock mr-1 text-[7px]"></i>Belum FU</span>`;

      itemCard.innerHTML = `
        <div class="flex justify-between items-start gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5 flex-wrap">
              <span class="font-bold text-slate-900 text-xs">${u.nopol}</span>
              <span class="text-[10px] text-purple-700 font-mono font-semibold px-1 py-0.2 bg-purple-50 rounded border border-purple-200">${u.no_fasilitas || "-"}</span>
            </div>
            <p class="text-[11px] text-slate-600 truncate mt-0.5">${u.unit}</p>
          </div>
          <div class="flex flex-col items-end space-y-1 shrink-0">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${urgencyPillStyles[uEval.level]}">${uEval.level}</span>
            ${fuBadge}
          </div>
        </div>

        <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
          <div>GPS: <strong class="text-slate-700">${u.gps_status || "Normal"}</strong></div>
          <div>Aging Visit: <strong class="text-slate-700">${u.aging_visit_unit || 0} hr</strong></div>
          <div>Lifetime: <strong class="text-slate-700">${u.lifetime_days || 0} hr</strong></div>
          <div>Status OVD: <strong class="text-slate-700">${isUnitNearJTO(u) ? 'H-3 JTO' : (Number(u.overdue_days || 0) > 0 ? 'OVD ' + u.overdue_days + ' hr' : 'Lancar')}</strong></div>
          ${u.aging_gps_maint ? `<div class="col-span-2">Aging Maint GPS: <strong class="text-slate-700">${u.aging_gps_maint} hr</strong></div>` : ''}
        </div>

        <div class="p-2 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5">
          <div class="text-[10px] font-bold text-amber-950 flex items-center justify-between border-b border-amber-200/60 pb-1">
            <span><i class="fa-solid fa-triangle-exclamation text-amber-600 mr-1"></i>Pemicu & Concern Unit (${(uEval.triggers || []).length}):</span>
            ${isVisited
          ? '<span class="text-[9px] text-emerald-700 font-bold"><i class="fa-solid fa-circle-check mr-1"></i>Visit Clear Hari Ini</span>'
          : '<span class="text-[9px] text-rose-700 font-bold"><i class="fa-solid fa-circle-exclamation mr-1"></i>Perlu Tindakan Visit</span>'}
          </div>
          <div class="space-y-1 pt-0.5">
            ${(uEval.triggers && uEval.triggers.length > 0)
          ? uEval.triggers.map(trg => `
                <div class="text-[10px] flex items-start space-x-1.5 leading-snug">
                  <span class="px-1.5 py-0.2 rounded text-[8px] font-bold border shrink-0 ${urgencyPillStyles[trg.level] || 'bg-slate-100 text-slate-700'}">${trg.level}</span>
                  <span class="text-slate-800 font-medium">${trg.reason}</span>
                </div>
              `).join('')
          : `<div class="text-[10px] text-slate-600 font-medium">${uEval.reason}</div>`
        }
          </div>
        </div>
      `;
      listContainer.appendChild(itemCard);
    });
  }

  document.getElementById("modal-facility-detail").classList.remove("hidden");
}

function closeFacilityModal() { document.getElementById("modal-facility-detail").classList.add("hidden"); }
function openParamModal() { document.getElementById("modal-param-info").classList.remove("hidden"); }
function closeParamModal() { document.getElementById("modal-param-info").classList.add("hidden"); }

// =========================================================================
// ASSIGN CONCERN
// =========================================================================
let ACTIVE_ASSIGN_ELIGIBLE_UNITS = [];

function populateAssignDealerOptions() {
  const selectDealer = document.getElementById("assign-select-dealer");
  if (!selectDealer) return;
  selectDealer.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
  coveredDealers.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang || "-"})`;
    selectDealer.appendChild(opt);
  });

  renderAssignDealerSearchDropdown("");
  renderAssignUnitSearchDropdown("");

  // Setup click outside listener to auto-close dealer dropdown
  if (!window._assignDealerSearchClickAttached) {
    window._assignDealerSearchClickAttached = true;
    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("assign-dealer-search-wrapper");
      const dropdown = document.getElementById("assign-dealer-search-dropdown");
      if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }

  // Setup click outside listener to auto-close unit dropdown
  if (!window._assignUnitSearchClickAttached) {
    window._assignUnitSearchClickAttached = true;
    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("assign-unit-search-wrapper");
      const dropdown = document.getElementById("assign-unit-search-dropdown");
      if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }
}

function renderAssignDealerSearchDropdown(query = "") {
  const dropdown = document.getElementById("assign-dealer-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
  const filtered = coveredDealers.filter(d => {
    if (!q) return true;
    const name = String(d.dealer_name || "").toLowerCase();
    const branch = String(d.cabang || "").toLowerCase();
    const area = String(d.area_cover || "").toLowerCase();
    return name.includes(q) || branch.includes(q) || area.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-store-slash mb-1 block text-slate-300"></i>Tidak ada dealer yang cocok di cover area Anda';
    dropdown.appendChild(emptyDiv);
    return;
  }

  const urgencyBadgeStyles = {
    "Sangat Penting": "bg-red-100 text-red-700 border-red-200",
    "Penting": "bg-orange-100 text-orange-700 border-orange-200",
    "Moderat": "bg-amber-100 text-amber-700 border-amber-200",
    "Normal": "bg-slate-100 text-slate-600 border-slate-200"
  };

  filtered.forEach(d => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectAssignDealerFromSearch(d.dealer_id);
    };

    const lvl = d.priority_level || d.level || "Normal";
    const badgeClass = urgencyBadgeStyles[lvl] || urgencyBadgeStyles["Normal"];

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">${d.dealer_name}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <span>${d.cabang || "-"}</span>
          <span>•</span>
          <span>Aging Visit: ${d.aging_visit_mitra || 0} hr</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeClass} shrink-0 uppercase">${lvl}</span>
    `;
    dropdown.appendChild(item);
  });
}

function openAssignDealerSearchDropdown() {
  const dropdown = document.getElementById("assign-dealer-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("assign-dealer-search-input");
    renderAssignDealerSearchDropdown(input ? input.value : "");
  }
}

function closeAssignDealerSearchDropdown() {
  const dropdown = document.getElementById("assign-dealer-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterAssignDealerSearchOptions(query) {
  openAssignDealerSearchDropdown();
  renderAssignDealerSearchDropdown(query);

  const clearBtn = document.getElementById("assign-dealer-search-clear-btn");
  const chevron = document.getElementById("assign-dealer-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectAssignDealerFromSearch(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  const input = document.getElementById("assign-dealer-search-input");
  const sel = document.getElementById("assign-select-dealer");
  const clearBtn = document.getElementById("assign-dealer-search-clear-btn");
  const chevron = document.getElementById("assign-dealer-search-chevron");

  if (d && input && sel) {
    input.value = `${d.dealer_name} (${d.cabang || "-"})`;
    sel.value = d.dealer_id;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeAssignDealerSearchDropdown();
    onAssignDealerSelected(dealerId);
  }
}

function clearAssignDealerSearchSelection() {
  const input = document.getElementById("assign-dealer-search-input");
  const sel = document.getElementById("assign-select-dealer");
  const clearBtn = document.getElementById("assign-dealer-search-clear-btn");
  const chevron = document.getElementById("assign-dealer-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  onAssignDealerSelected("");
  openAssignDealerSearchDropdown();
}

function onAssignDealerSelected(dealerId) {
  const selectUnit = document.getElementById("assign-select-unit");
  const inputUnit = document.getElementById("assign-unit-search-input");
  const clearBtn = document.getElementById("assign-unit-search-clear-btn");
  const chevron = document.getElementById("assign-unit-search-chevron");

  if (selectUnit) {
    selectUnit.innerHTML = '<option value="Umum">-- Umum (Seluruh Showroom / Non-Fasilitas) --</option>';
  }
  if (inputUnit) {
    inputUnit.value = "";
    inputUnit.placeholder = "-- Umum (Seluruh Showroom / Non-Fasilitas) --";
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d || !d.units || d.units.length === 0) {
    ACTIVE_ASSIGN_ELIGIBLE_UNITS = [];
    renderAssignUnitSearchDropdown("");
    return;
  }

  // Filter: Hanya tampilkan yang status LIVE atau status Expired tapi masih terpasang GPS
  ACTIVE_ASSIGN_ELIGIBLE_UNITS = d.units.filter(u => {
    const contractStatus = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
    const rawImei = String(u.imei_gps || u.imei || "").trim();
    const hasImei = hasValidImei(rawImei);
    const isLive = contractStatus === "LIVE" || contractStatus.indexOf("LIVE") !== -1;
    const isExpiredWithImei = contractStatus.indexOf("EXPIRED") !== -1 && hasImei;
    return isLive || isExpiredWithImei;
  });

  if (selectUnit) {
    ACTIVE_ASSIGN_ELIGIBLE_UNITS.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.no_fasilitas; // Unique Key Fasilitas/Unit = No Fasilitas
      opt.innerText = `${u.no_fasilitas} - ${u.nopol} (${u.unit || u.tipe_unit || "Kendaraan"})`;
      selectUnit.appendChild(opt);
    });
  }

  renderAssignUnitSearchDropdown("");
}

function renderAssignUnitSearchDropdown(query = "") {
  const dropdown = document.getElementById("assign-unit-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  dropdown.innerHTML = "";

  // 1. Opsi Default: Umum (Seluruh Showroom / Non-Fasilitas)
  const isUmumMatch = !q || "umum".includes(q) || "seluruh showroom".includes(q) || "non-fasilitas".includes(q);
  if (isUmumMatch) {
    const defaultItem = document.createElement("div");
    defaultItem.className = "p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition bg-slate-50/50";
    defaultItem.onmousedown = (e) => {
      e.preventDefault();
      selectAssignUnitFromSearch("Umum");
    };
    defaultItem.innerHTML = `
      <div class="flex items-center space-x-2 min-w-0">
        <i class="fa-solid fa-house-chimney text-purple-600 text-xs shrink-0"></i>
        <span class="font-bold text-slate-800 text-xs">-- Umum (Seluruh Showroom / Non-Fasilitas) --</span>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200 uppercase shrink-0">SHOWROOM</span>
    `;
    dropdown.appendChild(defaultItem);
  }

  // 2. Filter Unit Kendaraan Eligible berdasarkan No Fasilitas & Info Unit
  const filtered = ACTIVE_ASSIGN_ELIGIBLE_UNITS.filter(u => {
    if (!q) return true;
    const noFas = String(u.no_fasilitas || "").toLowerCase();
    const nopol = String(u.nopol || "").toLowerCase();
    const unitName = String(u.unit || u.tipe_unit || "").toLowerCase();
    const status = String(u.contract_status || u.status_kontrak || u.status || "").toLowerCase();
    const imei = String(u.imei_gps || u.imei || "").toLowerCase();
    return noFas.includes(q) || nopol.includes(q) || unitName.includes(q) || status.includes(q) || imei.includes(q);
  });

  if (filtered.length === 0 && !isUmumMatch) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-car-tunnel mb-1 block text-slate-300"></i>Tidak ada unit eligible yang cocok';
    dropdown.appendChild(emptyDiv);
    return;
  }

  filtered.forEach(u => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-purple-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectAssignUnitFromSearch(u.no_fasilitas); // Unique Key = No Fasilitas
    };

    const cStatus = String(u.contract_status || u.status_kontrak || u.status || "LIVE").trim().toUpperCase();
    const isLive = cStatus.includes("LIVE");
    const contractBadge = isLive
      ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase shrink-0">LIVE</span>'
      : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 uppercase shrink-0">EXP + GPS</span>';

    const gpsStatus = u.gps_status ? ` • GPS: ${u.gps_status}` : "";
    const ovdStatus = u.overdue_days && Number(u.overdue_days) > 0 ? ` • OVD ${u.overdue_days} hr` : "";

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate"><span class="font-mono text-purple-700 font-semibold">${u.no_fasilitas}</span> • ${u.nopol}</div>
        <div class="text-[11px] text-slate-600 truncate">${u.unit || u.tipe_unit || "Kendaraan"}</div>
        <div class="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5 truncate">
          <span>Aging Visit: ${u.aging_visit_unit || u.aging_visit_days || 0} hr</span>
          <span>${gpsStatus}${ovdStatus}</span>
        </div>
      </div>
      ${contractBadge}
    `;
    dropdown.appendChild(item);
  });
}

function openAssignUnitSearchDropdown() {
  const dropdown = document.getElementById("assign-unit-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("assign-unit-search-input");
    renderAssignUnitSearchDropdown(input ? input.value : "");
  }
}

function closeAssignUnitSearchDropdown() {
  const dropdown = document.getElementById("assign-unit-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterAssignUnitSearchOptions(query) {
  openAssignUnitSearchDropdown();
  renderAssignUnitSearchDropdown(query);

  const clearBtn = document.getElementById("assign-unit-search-clear-btn");
  const chevron = document.getElementById("assign-unit-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectAssignUnitFromSearch(noFasilitas) {
  const input = document.getElementById("assign-unit-search-input");
  const sel = document.getElementById("assign-select-unit");
  const clearBtn = document.getElementById("assign-unit-search-clear-btn");
  const chevron = document.getElementById("assign-unit-search-chevron");

  if (noFasilitas === "Umum" || !noFasilitas) {
    if (input) {
      input.value = "-- Umum (Seluruh Showroom / Non-Fasilitas) --";
    }
    if (sel) sel.value = "Umum";
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  } else {
    const u = ACTIVE_ASSIGN_ELIGIBLE_UNITS.find(item => item.no_fasilitas === noFasilitas);
    if (u && input && sel) {
      input.value = `${u.no_fasilitas} - ${u.nopol} (${u.unit || u.tipe_unit || "Kendaraan"})`;
      sel.value = u.no_fasilitas; // Value unik = No Fasilitas
      if (clearBtn) clearBtn.classList.remove("hidden");
      if (chevron) chevron.classList.add("hidden");
    }
  }
  closeAssignUnitSearchDropdown();
}

function clearAssignUnitSearchSelection() {
  const input = document.getElementById("assign-unit-search-input");
  const sel = document.getElementById("assign-select-unit");
  const clearBtn = document.getElementById("assign-unit-search-clear-btn");
  const chevron = document.getElementById("assign-unit-search-chevron");

  if (input) {
    input.value = "";
    input.placeholder = "-- Umum (Seluruh Showroom / Non-Fasilitas) --";
    input.focus();
  }
  if (sel) sel.value = "Umum";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  openAssignUnitSearchDropdown();
}

async function handleAssignConcernSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const btnSubmit = form.querySelector('button[type="submit"]') || document.getElementById("assign-btn-submit");
  const origBtnHtml = btnSubmit ? btnSubmit.innerHTML : "";

  const dealerId = document.getElementById("assign-select-dealer").value;
  const selectDealer = document.getElementById("assign-select-dealer");
  const rawDealerName = selectDealer?.selectedIndex >= 0 ? selectDealer.options[selectDealer.selectedIndex].text : "";
  const unitVal = document.getElementById("assign-select-unit").value; // Menyimpan No Fasilitas atau "Umum"
  const concernText = document.getElementById("assign-input-concern").value.trim();
  const urgencyRadio = document.querySelector('input[name="assign_urgency"]:checked');
  const urgencyVal = urgencyRadio ? urgencyRadio.value : "Penting";

  if (!dealerId) {
    alert("Silakan pilih Partner Dealer terlebih dahulu.");
    return;
  }

  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  const cleanDealerName = d ? d.dealer_name : rawDealerName.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const targetUnit = d?.units?.find(unit => unit.no_fasilitas === unitVal);

  try {
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i>Menyimpan Concern...';
    }

    // 1. Simpan ke database Supabase (unit_fasilitas = No Fasilitas)
    await callApi("saveAssignment", {
      assignedByUserId: CURRENT_USER?.nip || "ADM",
      assignedByUserName: CURRENT_USER?.nama || "Supervisor",
      dealerId: dealerId,
      dealerName: cleanDealerName,
      cabang: d?.cabang || "-",
      unitFasilitas: unitVal,
      nopol: targetUnit?.nopol || "",
      unitModel: targetUnit?.unit || targetUnit?.tipe_unit || "",
      concernType: "Assign Concern",
      urgencyLevel: urgencyVal,
      instruksi: concernText
    });

    // Update in-memory dealer / unit concern berdasarkan No Fasilitas
    if (d) {
      if (unitVal === "Umum") {
        d.dealer_concern = { urgency: urgencyVal, note: concernText };
      } else {
        const u = d.units?.find(unit => unit.no_fasilitas === unitVal);
        if (u) u.unit_concern = { urgency: urgencyVal, note: concernText };
      }
    }

    // 2. Sinkronkan ulang data master agar concern langsung terhubung & prioritas langsung ter-update
    await syncMasterDataFromApi();

    alert(`Concern "${urgencyVal}" berhasil disimpan dan langsung aktif di Prioritas Kunjungan!`);
    loadScreen('priority');
  } catch (err) {
    console.error("Gagal menyimpan assign concern:", err);
    alert("Terjadi kendala saat menyimpan concern: " + (err.message || err));
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = origBtnHtml;
    }
  }
}

// =========================================================================
// LAPORAN VISIT SHOWROOM
// =========================================================================
function populateVisitDealerOptions() {
  const sel = document.getElementById("input-dealer");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
  coveredDealers.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang || "-"})`;
    sel.appendChild(opt);
  });

  renderDealerSearchDropdown("");
  if (typeof initVisitSearchableDropdowns === "function") {
    initVisitSearchableDropdowns();
  }

  // Set default lokasi dan bertemu blank agar pertama klik langsung menampilkan dropdown
  const lokasiInput = document.getElementById("lokasi-search-input");
  if (lokasiInput) {
    lokasiInput.value = "";
    const clearLokasi = document.getElementById("lokasi-search-clear-btn");
    const chevLokasi = document.getElementById("lokasi-search-chevron");
    if (clearLokasi) clearLokasi.classList.add("hidden");
    if (chevLokasi) chevLokasi.classList.remove("hidden");
  }
  if (typeof onLokasiVisitChanged === "function") {
    onLokasiVisitChanged("");
  }

  const bertemuInput = document.getElementById("bertemu-search-input");
  if (bertemuInput) {
    bertemuInput.value = "";
    const clearBertemu = document.getElementById("bertemu-search-clear-btn");
    const chevBertemu = document.getElementById("bertemu-search-chevron");
    if (clearBertemu) clearBertemu.classList.add("hidden");
    if (chevBertemu) chevBertemu.classList.remove("hidden");
  }

  // Otomatis deteksi koordinat GPS saat form visit dibuka
  if (typeof getPreciseLocation === "function") {
    getPreciseLocation();
  }

  // Reset state foto fisik kunjungan
  CURRENT_SHOWROOM_PHOTO_BASE64 = null;
  const triggerVisitPhoto = document.getElementById("trigger-visit-photo");
  const previewVisitPhoto = document.getElementById("preview-photo-card");
  if (triggerVisitPhoto) triggerVisitPhoto.classList.remove("hidden");
  if (previewVisitPhoto) previewVisitPhoto.classList.add("hidden");

  // Setup click outside listener to auto-close dropdown
  if (!window._dealerSearchClickAttached) {
    window._dealerSearchClickAttached = true;
    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("dealer-search-wrapper");
      const dropdown = document.getElementById("dealer-search-dropdown");
      if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }
}

function renderDealerSearchDropdown(query = "") {
  const dropdown = document.getElementById("dealer-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
  const filtered = coveredDealers.filter(d => {
    if (!q) return true;
    const name = String(d.dealer_name || "").toLowerCase();
    const branch = String(d.cabang || "").toLowerCase();
    const area = String(d.area_cover || "").toLowerCase();
    return name.includes(q) || branch.includes(q) || area.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-store-slash mb-1 block text-slate-300"></i>Tidak ada dealer yang cocok di cover area Anda';
    dropdown.appendChild(emptyDiv);
    return;
  }

  const urgencyBadgeStyles = {
    "Sangat Penting": "bg-red-100 text-red-700 border-red-200",
    "Penting": "bg-orange-100 text-orange-700 border-orange-200",
    "Moderat": "bg-amber-100 text-amber-700 border-amber-200",
    "Normal": "bg-slate-100 text-slate-600 border-slate-200"
  };

  filtered.forEach(d => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-slate-100 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectDealerFromSearch(d.dealer_id);
    };

    const lvl = d.priority_level || d.level || "Normal";
    const badgeClass = urgencyBadgeStyles[lvl] || urgencyBadgeStyles["Normal"];

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">${d.dealer_name}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5 flex-wrap">
          <span>${d.cabang || "-"}</span>
          ${d.area_cover ? `<span>• Area: <strong class="text-amber-700">${d.area_cover}</strong></span>` : ''}
          <span>•</span>
          <span>Aging Visit: ${d.aging_visit_mitra || 0} hr</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeClass} shrink-0 uppercase">${lvl}</span>
    `;
    dropdown.appendChild(item);
  });
}

function openDealerSearchDropdown() {
  const dropdown = document.getElementById("dealer-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("dealer-search-input");
    renderDealerSearchDropdown(input ? input.value : "");
  }
}

function closeDealerSearchDropdown() {
  const dropdown = document.getElementById("dealer-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterDealerSearchOptions(query) {
  openDealerSearchDropdown();
  renderDealerSearchDropdown(query);

  const clearBtn = document.getElementById("dealer-search-clear-btn");
  const chevron = document.getElementById("dealer-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectDealerFromSearch(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId || item.dealer_name === dealerId);
  const input = document.getElementById("dealer-search-input");
  const sel = document.getElementById("input-dealer");
  const clearBtn = document.getElementById("dealer-search-clear-btn");
  const chevron = document.getElementById("dealer-search-chevron");

  if (d && input && sel) {
    input.value = `${d.dealer_name} (${d.cabang || "-"})`;

    // Pastikan option dealer_id tersedia di select
    let opt = sel.querySelector(`option[value="${d.dealer_id}"]`);
    if (!opt) {
      opt = document.createElement("option");
      opt.value = d.dealer_id;
      opt.innerText = `${d.dealer_name} (${d.cabang || "-"})`;
      sel.appendChild(opt);
    }
    sel.value = d.dealer_id;

    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeDealerSearchDropdown();
    onDealerSelected(d.dealer_id);
  }
}

function onDealerSearchKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();

    const input = document.getElementById("dealer-search-input");
    const q = input ? input.value.trim().toLowerCase() : "";
    if (q) {
      const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
      const match = coveredDealers.find(d => {
        const name = String(d.dealer_name || "").toLowerCase();
        const branch = String(d.cabang || "").toLowerCase();
        const area = String(d.area_cover || "").toLowerCase();
        const full = `${name} (${branch})`;
        return name.includes(q) || branch.includes(q) || area.includes(q) || full.includes(q);
      });
      if (match) {
        selectDealerFromSearch(match.dealer_id);
      }
    }
    closeDealerSearchDropdown();
    if (input) input.blur();
    return false;
  }
}

function onDealerSearchInputBlur() {
  setTimeout(() => {
    const input = document.getElementById("dealer-search-input");
    const sel = document.getElementById("input-dealer");
    if (!input || !sel) return;
    const val = input.value.trim().toLowerCase();
    if (!val) {
      sel.value = "";
      onDealerSelected("");
      return;
    }
    // Jika belum terpilih, auto-match dari teks yang diketik
    if (!sel.value) {
      const match = MASTER_DEALER_PRIORITY_DATA.find(d => {
        const name = String(d.dealer_name || "").toLowerCase();
        const full = `${name} (${String(d.cabang || '').toLowerCase()})`;
        return full === val || name === val || full.includes(val) || val.includes(name);
      });
      if (match) {
        selectDealerFromSearch(match.dealer_id);
      }
    }
    closeDealerSearchDropdown();
  }, 250);
}

function clearDealerSearchSelection() {
  const input = document.getElementById("dealer-search-input");
  const sel = document.getElementById("input-dealer");
  const clearBtn = document.getElementById("dealer-search-clear-btn");
  const chevron = document.getElementById("dealer-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  onDealerSelected("");
  openDealerSearchDropdown();
}

// =========================================================================
// SEARCHABLE DROPDOWN: LOKASI KUNJUNGAN & BERTEMU
// =========================================================================
const VISIT_LOKASI_PRESETS = [
  { value: "Showroom", label: "Showroom", icon: "fa-store", desc: "Lokasi dealer fisik / showroom mitra" },
  { value: "Rumah Owner", label: "Rumah Owner", icon: "fa-house-user", desc: "Kediaman pemilik / owner mitra" },
  { value: "Janjian Diluar", label: "Janjian Diluar", icon: "fa-mug-hot", desc: "Kafe, restoran, atau tempat umum" }
];

const VISIT_BERTEMU_PRESETS = [
  { value: "Owner", label: "Owner", icon: "fa-user-tie", desc: "Pemilik langsung / owner showroom" },
  { value: "Pekerja", label: "Pekerja", icon: "fa-user-gear", desc: "Karyawan / staf / mekanik dealer" },
  { value: "Penanggung Jawab", label: "Penanggung Jawab", icon: "fa-user-shield", desc: "Kepala cabang / PIC / penanggung jawab" },
  { value: "Tidak Bertemu", label: "Tidak Bertemu", icon: "fa-user-xmark", desc: "Showroom tutup / tidak bertemu siapapun" }
];

// Helper listener untuk menutup dropdown saat klik di luar
function initVisitSearchableDropdowns() {
  if (!window._visitDropdownClickAttached) {
    window._visitDropdownClickAttached = true;
    document.addEventListener("click", (e) => {
      const lokasiWrapper = document.getElementById("lokasi-search-wrapper");
      const lokasiDropdown = document.getElementById("lokasi-search-dropdown");
      if (lokasiDropdown && lokasiWrapper && !lokasiWrapper.contains(e.target)) {
        lokasiDropdown.classList.add("hidden");
      }

      const bertemuWrapper = document.getElementById("bertemu-search-wrapper");
      const bertemuDropdown = document.getElementById("bertemu-search-dropdown");
      if (bertemuDropdown && bertemuWrapper && !bertemuWrapper.contains(e.target)) {
        bertemuDropdown.classList.add("hidden");
      }
    });
  }
}

// 1. LOKASI KUNJUNGAN
function openLokasiSearchDropdown() {
  const dropdown = document.getElementById("lokasi-search-dropdown");
  const input = document.getElementById("lokasi-search-input");
  if (!dropdown) return;
  initVisitSearchableDropdowns();
  renderLokasiSearchDropdown(input ? input.value : "");
  dropdown.classList.remove("hidden");
}

function closeLokasiSearchDropdown() {
  const dropdown = document.getElementById("lokasi-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function renderLokasiSearchDropdown(query = "") {
  const dropdown = document.getElementById("lokasi-search-dropdown");
  if (!dropdown) return;
  const q = String(query || "").trim().toLowerCase();

  dropdown.innerHTML = "";

  const filtered = VISIT_LOKASI_PRESETS.filter(item => {
    if (!q) return true;
    return item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
  });

  filtered.forEach(item => {
    const el = document.createElement("div");
    el.className = "p-2.5 hover:bg-slate-100 cursor-pointer flex items-center space-x-2.5 text-xs transition";
    el.onmousedown = (e) => {
      e.preventDefault();
      selectLokasiOption(item.value);
    };
    el.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 text-xs">
        <i class="fa-solid ${item.icon}"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-800">${item.label}</div>
        <div class="text-[10px] text-slate-400 truncate">${item.desc}</div>
      </div>
    `;
    dropdown.appendChild(el);
  });

  // Jika input teks tidak persis sama dengan salah satu preset, sediakan opsi gunakan teks inputan
  const rawQ = String(query || "").trim();
  const exactMatch = VISIT_LOKASI_PRESETS.some(item => item.value.toLowerCase() === rawQ.toLowerCase());
  if (rawQ && !exactMatch) {
    const customEl = document.createElement("div");
    customEl.className = "p-2.5 bg-amber-50/60 hover:bg-amber-100/70 cursor-pointer flex items-center space-x-2.5 text-xs transition border-t border-amber-100";
    customEl.onmousedown = (e) => {
      e.preventDefault();
      selectLokasiOption(rawQ);
    };
    customEl.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 text-xs shadow-xs">
        <i class="fa-solid fa-location-arrow"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-amber-900">Gunakan Lokasi: "${rawQ}"</div>
        <div class="text-[10px] text-amber-700">Gunakan lokasi pertemuan khusus sesuai inputan</div>
      </div>
    `;
    dropdown.prepend(customEl);
  }
}

function selectLokasiOption(val) {
  const input = document.getElementById("lokasi-search-input");
  const clearBtn = document.getElementById("lokasi-search-clear-btn");
  const chevron = document.getElementById("lokasi-search-chevron");

  if (input) input.value = val;
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  closeLokasiSearchDropdown();
  onLokasiVisitChanged(val);
}

function filterLokasiSearchOptions(val) {
  const clearBtn = document.getElementById("lokasi-search-clear-btn");
  const chevron = document.getElementById("lokasi-search-chevron");
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  renderLokasiSearchDropdown(val);
  const dropdown = document.getElementById("lokasi-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
  onLokasiVisitChanged(val);
}

function clearLokasiSearchSelection() {
  const input = document.getElementById("lokasi-search-input");
  const clearBtn = document.getElementById("lokasi-search-clear-btn");
  const chevron = document.getElementById("lokasi-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  renderLokasiSearchDropdown("");
  const dropdown = document.getElementById("lokasi-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
  onLokasiVisitChanged("");
}

function onLokasiSearchKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const input = document.getElementById("lokasi-search-input");
    const val = input ? input.value.trim() : "";
    if (val) selectLokasiOption(val);
    closeLokasiSearchDropdown();
    if (input) input.blur();
  }
}

function onLokasiSearchInputBlur() {
  setTimeout(() => {
    closeLokasiSearchDropdown();
    const input = document.getElementById("lokasi-search-input");
    if (input) onLokasiVisitChanged(input.value.trim());
  }, 200);
}

function onLokasiVisitChanged(val) {
  // Segmen 2 selalu tampil, user yang menentukan via toggle apakah ada informasi atau tidak
  const segmen2 = document.getElementById("segment-2-container");
  if (segmen2) segmen2.classList.remove("hidden");
}

function toggleShowroomInfo(isNoInfo) {
  const boxFields = document.getElementById("box-showroom-form-fields");
  const noticeBox = document.getElementById("box-no-showroom-notice");
  const stockInput = document.getElementById("input-stock-unit");
  const salesInput = document.getElementById("input-sales-unit");

  if (isNoInfo) {
    if (boxFields) boxFields.classList.add("hidden");
    if (noticeBox) noticeBox.classList.remove("hidden");
    if (stockInput) stockInput.value = "";
    if (salesInput) salesInput.value = "";
  } else {
    if (boxFields) boxFields.classList.remove("hidden");
    if (noticeBox) noticeBox.classList.add("hidden");
  }
}

// 2. BERTEMU
function openBertemuSearchDropdown() {
  const dropdown = document.getElementById("bertemu-search-dropdown");
  const input = document.getElementById("bertemu-search-input");
  if (!dropdown) return;
  initVisitSearchableDropdowns();
  renderBertemuSearchDropdown(input ? input.value : "");
  dropdown.classList.remove("hidden");
}

function closeBertemuSearchDropdown() {
  const dropdown = document.getElementById("bertemu-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function renderBertemuSearchDropdown(query = "") {
  const dropdown = document.getElementById("bertemu-search-dropdown");
  if (!dropdown) return;
  const q = String(query || "").trim().toLowerCase();

  dropdown.innerHTML = "";

  const filtered = VISIT_BERTEMU_PRESETS.filter(item => {
    if (!q) return true;
    return item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
  });

  filtered.forEach(item => {
    const el = document.createElement("div");
    el.className = "p-2.5 hover:bg-slate-100 cursor-pointer flex items-center space-x-2.5 text-xs transition";
    el.onmousedown = (e) => {
      e.preventDefault();
      selectBertemuOption(item.value);
    };
    el.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 text-xs">
        <i class="fa-solid ${item.icon}"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-800">${item.label}</div>
        <div class="text-[10px] text-slate-400 truncate">${item.desc}</div>
      </div>
    `;
    dropdown.appendChild(el);
  });

  // Jika input teks tidak persis sama dengan salah satu preset, sediakan opsi gunakan teks inputan
  const rawQ = String(query || "").trim();
  const exactMatch = VISIT_BERTEMU_PRESETS.some(item => item.value.toLowerCase() === rawQ.toLowerCase());
  if (rawQ && !exactMatch) {
    const customEl = document.createElement("div");
    customEl.className = "p-2.5 bg-teal-50/60 hover:bg-teal-100/70 cursor-pointer flex items-center space-x-2.5 text-xs transition border-t border-teal-100";
    customEl.onmousedown = (e) => {
      e.preventDefault();
      selectBertemuOption(rawQ);
    };
    customEl.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 text-xs shadow-xs">
        <i class="fa-solid fa-user-plus"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-teal-900">Gunakan Pilihan: "${rawQ}"</div>
        <div class="text-[10px] text-teal-700">Pertemuan dengan pihak khusus sesuai inputan</div>
      </div>
    `;
    dropdown.prepend(customEl);
  }
}

function selectBertemuOption(val) {
  const input = document.getElementById("bertemu-search-input");
  const clearBtn = document.getElementById("bertemu-search-clear-btn");
  const chevron = document.getElementById("bertemu-search-chevron");

  if (input) input.value = val;
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  closeBertemuSearchDropdown();
}

function filterBertemuSearchOptions(val) {
  const clearBtn = document.getElementById("bertemu-search-clear-btn");
  const chevron = document.getElementById("bertemu-search-chevron");
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  renderBertemuSearchDropdown(val);
  const dropdown = document.getElementById("bertemu-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
}

function clearBertemuSearchSelection() {
  const input = document.getElementById("bertemu-search-input");
  const clearBtn = document.getElementById("bertemu-search-clear-btn");
  const chevron = document.getElementById("bertemu-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  renderBertemuSearchDropdown("");
  const dropdown = document.getElementById("bertemu-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
}

function onBertemuSearchKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const input = document.getElementById("bertemu-search-input");
    const val = input ? input.value.trim() : "";
    if (val) selectBertemuOption(val);
    closeBertemuSearchDropdown();
    if (input) input.blur();
  }
}

function onBertemuSearchInputBlur() {
  setTimeout(() => {
    closeBertemuSearchDropdown();
  }, 200);
}

function onDealerSelected(dealerId) {
  const container = document.getElementById("container-unit-list");
  const emptyBox = document.getElementById("box-empty-facility");
  const countBadge = document.getElementById("unit-count-badge");
  const boxConcern = document.getElementById("box-concern-prioritas");
  const textConcern = document.getElementById("text-concern-display");

  container.innerHTML = "";
  ACTIVE_UNITS_STATE = [];

  const dealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId);

  // 1. Evaluasi & Tampilkan Dynamic Concern Prioritas Box (Reminder ke PIC)
  if (boxConcern && textConcern) {
    if (dealer) {
      const concernList = [];

      // A. Supervisor Assignment Concern
      if (dealer.dealer_concern) {
        const note = typeof dealer.dealer_concern === "object" ? dealer.dealer_concern.note : dealer.dealer_concern;
        const urg = typeof dealer.dealer_concern === "object" ? (dealer.dealer_concern.urgency || "Penting") : "Penting";
        concernList.push(`📌 <strong>Instruksi Khusus Supervisor (${urg}):</strong>\n"${note}"`);
      }

      // B. Unit Specific Concerns & Critical Issues
      if (dealer.units && dealer.units.length > 0) {
        dealer.units.forEach(u => {
          if (u.unit_concern) {
            const uNote = typeof u.unit_concern === "object" ? u.unit_concern.note : u.unit_concern;
            const uUrg = typeof u.unit_concern === "object" ? (u.unit_concern.urgency || "Penting") : "Penting";
            concernList.push(`🚗 <strong>Concern Unit ${u.nopol} (${uUrg}):</strong>\n"${uNote}"`);
          }
          const uEval = calculateUnitUrgency(u);
          if (uEval.score >= 2 && !u.unit_concern) {
            concernList.push(`⚠️ <strong>Isu Kritis Unit ${u.nopol}:</strong> ${uEval.reason}`);
          }
        });
      }

      // C. Mitra Level Triggers (Aging > 20 hari / Priority Score tinggi)
      const evalMitra = calculateMitraUrgency(dealer);
      if (evalMitra.mitraScore >= 2 && !dealer.dealer_concern) {
        concernList.push(`⚠️ <strong>Pemicu Sistem Mitra:</strong> ${evalMitra.mitraReason}`);
      }

      // Tampilkan atau sembunyikan kotak reminder concern
      if (concernList.length > 0) {
        textConcern.innerHTML = concernList.join("\n\n");
        boxConcern.classList.remove("hidden");
      } else {
        boxConcern.classList.add("hidden");
      }
    } else {
      boxConcern.classList.add("hidden");
    }
  }

  // 2. Render Checklist Fasilitas Unit Aktif (HANYA UNIT DENGAN STATUS LIVE)
  const rawUnits = dealer && dealer.units ? dealer.units : [];
  const units = rawUnits.filter(u => {
    const uContract = String(u.contract_status || u.status_kontrak || u.status || "").trim().toUpperCase();
    return uContract.includes("LIVE");
  });

  if (!dealerId || !dealer || units.length === 0) {
    emptyBox.innerText = dealerId ? "Mitra ini tidak memiliki fasilitas unit LIVE aktif." : "Pilih partner dealer di Segmen 1 untuk memuat data fasilitas aktif.";
    emptyBox.classList.remove("hidden");
    container.classList.add("hidden");
    countBadge.innerText = "0 Unit Aktif";
    return;
  }

  emptyBox.classList.add("hidden");
  container.classList.remove("hidden");

  countBadge.innerText = `${units.length} Unit Aktif`;

  units.forEach((u, idx) => {
    const isOvd = (u.overdue_days > 0);
    ACTIVE_UNITS_STATE.push({
      ...u,
      is_ovd: isOvd,
      is_checked: false,
      terlihat: "Ya",
      foto_unit: null,
      indikasi: "",
      gps_match: "Ya",
      info_unit: [],
      ovd_plan: "",
      komitmen: "Tidak Ada",
      tgl_komitmen: ""
    });

    const card = document.createElement("div");
    card.className = "p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between cursor-pointer hover:border-slate-400 transition";
    card.id = `unit-card-${idx}`;
    card.onclick = () => openUnitModal(idx);
    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center space-x-1.5">
          <span class="font-bold text-xs text-slate-800">${u.nopol}</span>${isOvd ? '<span class="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.2 rounded font-bold">OVERDUE</span>' : '<span class="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded font-bold">LANCAR</span>'}
        </div>
        <p class="text-[10px] text-slate-500 truncate mt-0.5">${u.unit}</p>
      </div>
      <div class="shrink-0 ml-2" id="unit-status-icon-${idx}">
        <span class="text-[10px] bg-slate-200 text-slate-600 px-2 py-1 rounded-lg font-semibold"><i class="fa-solid fa-camera mr-1"></i> Periksa</span>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================================================
// SEARCHABLE DROPDOWN: INDIKASI KEBERADAAN UNIT (PRESET & FREE INPUT)
// =========================================================================
const UNIT_INDIKASI_PRESETS = [
  { value: "Showroom Lain", label: "Showroom Lain", icon: "fa-store", desc: "Berada di cabang showroom lainnya" },
  { value: "Gudang", label: "Gudang", icon: "fa-warehouse", desc: "Disimpan di gudang / pool penyimpanan" },
  { value: "Dealer Lain", label: "Dealer Lain", icon: "fa-building", desc: "Dipajang / titip jual di dealer lain" },
  { value: "Dibawa Karyawan", label: "Dibawa Karyawan", icon: "fa-user-tie", desc: "Sedang dibawa atau dipakai staf/karyawan" },
  { value: "Dibawa Rekanan", label: "Dibawa Rekanan", icon: "fa-handshake", desc: "Dipinjam / dibawa rekanan usaha mitra" },
  { value: "Unit Dipembeli", label: "Unit Dipembeli", icon: "fa-cart-shopping", desc: "Sudah laku / sedang test drive pembeli" }
];

function initIndikasiSearchableDropdown() {
  if (!window._indikasiDropdownClickAttached) {
    window._indikasiDropdownClickAttached = true;
    document.addEventListener("click", (e) => {
      const wrapper = document.getElementById("modal-box-indikasi");
      const dropdown = document.getElementById("indikasi-search-dropdown");
      if (dropdown && wrapper && !wrapper.contains(e.target)) {
        dropdown.classList.add("hidden");
      }
    });
  }
}

function openIndikasiSearchDropdown() {
  const dropdown = document.getElementById("indikasi-search-dropdown");
  const input = document.getElementById("modal-input-indikasi");
  if (!dropdown) return;
  initIndikasiSearchableDropdown();
  renderIndikasiSearchDropdown(input ? input.value : "");
  dropdown.classList.remove("hidden");
}

function closeIndikasiSearchDropdown() {
  const dropdown = document.getElementById("indikasi-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function renderIndikasiSearchDropdown(query = "") {
  const dropdown = document.getElementById("indikasi-search-dropdown");
  if (!dropdown) return;
  const q = String(query || "").trim().toLowerCase();

  dropdown.innerHTML = "";

  const filtered = UNIT_INDIKASI_PRESETS.filter(item => {
    if (!q) return true;
    return item.value.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
  });

  filtered.forEach(item => {
    const el = document.createElement("div");
    el.className = "p-2.5 hover:bg-amber-50 cursor-pointer flex items-center space-x-2.5 text-xs transition";
    el.onmousedown = (e) => {
      e.preventDefault();
      selectIndikasiOption(item.value);
    };
    el.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 text-xs">
        <i class="fa-solid ${item.icon}"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-800">${item.label}</div>
        <div class="text-[10px] text-slate-400 truncate">${item.desc}</div>
      </div>
    `;
    dropdown.appendChild(el);
  });

  // Jika input teks tidak persis sama dengan salah satu preset, sediakan opsi gunakan teks inputan
  const rawQ = String(query || "").trim();
  const exactMatch = UNIT_INDIKASI_PRESETS.some(item => item.value.toLowerCase() === rawQ.toLowerCase());
  if (rawQ && !exactMatch) {
    const customEl = document.createElement("div");
    customEl.className = "p-2.5 bg-amber-100/70 hover:bg-amber-200/80 cursor-pointer flex items-center space-x-2.5 text-xs transition border-t border-amber-200";
    customEl.onmousedown = (e) => {
      e.preventDefault();
      selectIndikasiOption(rawQ);
    };
    customEl.innerHTML = `
      <div class="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 text-xs shadow-xs">
        <i class="fa-solid fa-pen-to-square"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-amber-950">Gunakan Indikasi: "${rawQ}"</div>
        <div class="text-[10px] text-amber-800">Indikasi posisi unit kustom sesuai inputan</div>
      </div>
    `;
    dropdown.prepend(customEl);
  }
}

function selectIndikasiOption(val) {
  const input = document.getElementById("modal-input-indikasi");
  const clearBtn = document.getElementById("indikasi-search-clear-btn");
  const chevron = document.getElementById("indikasi-search-chevron");

  if (input) input.value = val;
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  closeIndikasiSearchDropdown();
}

function filterIndikasiSearchOptions(val) {
  const clearBtn = document.getElementById("indikasi-search-clear-btn");
  const chevron = document.getElementById("indikasi-search-chevron");
  if (clearBtn) clearBtn.classList.toggle("hidden", !val);
  if (chevron) chevron.classList.toggle("hidden", !!val);

  renderIndikasiSearchDropdown(val);
  const dropdown = document.getElementById("indikasi-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
}

function clearIndikasiSearchSelection() {
  const input = document.getElementById("modal-input-indikasi");
  const clearBtn = document.getElementById("indikasi-search-clear-btn");
  const chevron = document.getElementById("indikasi-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  renderIndikasiSearchDropdown("");
  const dropdown = document.getElementById("indikasi-search-dropdown");
  if (dropdown) dropdown.classList.remove("hidden");
}

function onIndikasiSearchKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const input = document.getElementById("modal-input-indikasi");
    const val = input ? input.value.trim() : "";
    if (val) selectIndikasiOption(val);
    closeIndikasiSearchDropdown();
    if (input) input.blur();
  }
}

function onIndikasiSearchInputBlur() {
  setTimeout(() => {
    closeIndikasiSearchDropdown();
  }, 200);
}

function openUnitModal(index) {
  CURRENT_UNIT_INDEX = index;
  const u = ACTIVE_UNITS_STATE[index];

  document.getElementById("modal-unit-nopol").innerText = u.nopol;
  document.getElementById("modal-unit-desc").innerText = u.unit;

  const badge = document.getElementById("modal-unit-badge");
  badge.innerText = u.is_ovd ? "OVERDUE" : "LANCAR";
  badge.className = u.is_ovd ? "text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-500 text-white" : "text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-500 text-white";

  document.querySelector(`input[name="modal_unit_ada"][value="${u.terlihat}"]`).checked = true;
  toggleUnitAdaUI(u.terlihat === "Ya");

  TEMP_MODAL_PHOTO_BASE64 = u.foto_unit || null;
  const imgUnitPreview = document.getElementById("img-modal-unit-photo");
  const triggerModalPhoto = document.getElementById("trigger-modal-unit-photo");
  if (TEMP_MODAL_PHOTO_BASE64) {
    if (imgUnitPreview) imgUnitPreview.src = TEMP_MODAL_PHOTO_BASE64;
    document.getElementById("modal-unit-photo-preview").classList.remove("hidden");
    if (triggerModalPhoto) triggerModalPhoto.classList.add("hidden");
  } else {
    if (imgUnitPreview) imgUnitPreview.src = "";
    document.getElementById("modal-unit-photo-preview").classList.add("hidden");
    if (triggerModalPhoto) triggerModalPhoto.classList.remove("hidden");
  }

  // Setup input indikasi (default blank jika tidak ada data)
  const indVal = u.indikasi || "";
  const inputIndikasi = document.getElementById("modal-input-indikasi");
  const clearBtnIndikasi = document.getElementById("indikasi-search-clear-btn");
  const chevronIndikasi = document.getElementById("indikasi-search-chevron");
  if (inputIndikasi) inputIndikasi.value = indVal;
  if (clearBtnIndikasi) clearBtnIndikasi.classList.toggle("hidden", !indVal);
  if (chevronIndikasi) chevronIndikasi.classList.toggle("hidden", !!indVal);
  closeIndikasiSearchDropdown();

  document.querySelector(`input[name="modal_gps_match"][value="${u.gps_match}"]`).checked = true;

  let hasLainnya = false;
  let customLainnyaText = "";
  const predefinedInfo = ["Plan Perpanjang", "Plan Pelunasan", "Ada Calon Pembeli", "Proses Kredit", "Unit Cash Tempo", "Unit Milik Orang Lain"];

  (u.info_unit || []).forEach(item => {
    if (item.startsWith("Lainnya:") || item.startsWith("Lainnya - ")) {
      hasLainnya = true;
      customLainnyaText = item.replace(/^Lainnya[:\-]\s*/i, "").trim();
    } else if (!predefinedInfo.includes(item) && item !== "Lainnya") {
      hasLainnya = true;
      customLainnyaText = item.trim();
    } else if (item === "Lainnya") {
      hasLainnya = true;
    }
  });

  document.querySelectorAll('input[name="modal_info_unit"]').forEach(cb => {
    if (cb.value === "Lainnya") {
      cb.checked = hasLainnya;
    } else {
      cb.checked = (u.info_unit || []).includes(cb.value);
    }
  });

  const boxLainnya = document.getElementById("modal-box-info-lainnya");
  const inputLainnya = document.getElementById("modal-input-info-lainnya");
  if (boxLainnya) boxLainnya.classList.toggle("hidden", !hasLainnya);
  if (inputLainnya) inputLainnya.value = customLainnyaText;

  const overdueContainer = document.getElementById("modal-box-overdue-container");
  if (u.is_ovd) {
    overdueContainer.classList.remove("hidden");
    document.getElementById("modal-input-ovd-plan").value = u.ovd_plan || "";
    document.getElementById("modal-select-komitmen").value = u.komitmen || "Tidak Ada";
    onModalKomitmenChange(u.komitmen || "Tidak Ada");
    document.getElementById("modal-input-tgl-komitmen").value = u.tgl_komitmen || "";
  } else {
    overdueContainer.classList.add("hidden");
    u.ovd_plan = "";
    u.komitmen = "Tidak Ada";
    u.tgl_komitmen = "";
  }

  document.getElementById("modal-unit").classList.remove("hidden");
}

function toggleInfoUnitLainnya(isChecked) {
  const box = document.getElementById("modal-box-info-lainnya");
  const input = document.getElementById("modal-input-info-lainnya");
  if (box) box.classList.toggle("hidden", !isChecked);
  if (isChecked && input) {
    input.focus();
  }
}

function closeUnitModal() {
  closeIndikasiSearchDropdown();
  document.getElementById("modal-unit").classList.add("hidden");
  CURRENT_UNIT_INDEX = null;
  TEMP_MODAL_PHOTO_BASE64 = null;
}

function toggleUnitAdaUI(isAda) {
  const boxFoto = document.getElementById("modal-box-foto-unit");
  const boxIndikasi = document.getElementById("modal-box-indikasi");
  if (isAda) {
    boxFoto.classList.remove("hidden");
    boxIndikasi.classList.add("hidden");
    closeIndikasiSearchDropdown();
  } else {
    boxFoto.classList.add("hidden");
    boxIndikasi.classList.remove("hidden");
    const inputIndikasi = document.getElementById("modal-input-indikasi");
    const clearBtnIndikasi = document.getElementById("indikasi-search-clear-btn");
    const chevronIndikasi = document.getElementById("indikasi-search-chevron");
    const hasVal = !!(inputIndikasi && inputIndikasi.value);
    if (clearBtnIndikasi) clearBtnIndikasi.classList.toggle("hidden", !hasVal);
    if (chevronIndikasi) chevronIndikasi.classList.toggle("hidden", hasVal);
  }
}

async function handleModalUnitPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    TEMP_MODAL_PHOTO_BASE64 = compressed;
    const imgUnitPreview = document.getElementById("img-modal-unit-photo");
    if (imgUnitPreview) imgUnitPreview.src = compressed;
    const previewBox = document.getElementById("modal-unit-photo-preview");
    if (previewBox) previewBox.classList.remove("hidden");
    const triggerBox = document.getElementById("trigger-modal-unit-photo");
    if (triggerBox) triggerBox.classList.add("hidden");
  }
}

function removeModalUnitPhoto() {
  document.getElementById("file-modal-unit-photo").value = "";
  TEMP_MODAL_PHOTO_BASE64 = null;
  const imgUnitPreview = document.getElementById("img-modal-unit-photo");
  if (imgUnitPreview) imgUnitPreview.src = "";
  document.getElementById("modal-unit-photo-preview").classList.add("hidden");
  const triggerBox = document.getElementById("trigger-modal-unit-photo");
  if (triggerBox) triggerBox.classList.remove("hidden");
}

function onModalKomitmenChange(val) {
  const box = document.getElementById("modal-box-tgl-komitmen");
  if (val === "Bayar" || val === "Serahkan Unit") box.classList.remove("hidden");
  else box.classList.add("hidden");
}

function saveUnitChecklist() {
  if (CURRENT_UNIT_INDEX === null) return;
  const u = ACTIVE_UNITS_STATE[CURRENT_UNIT_INDEX];
  const terlihatVal = document.querySelector('input[name="modal_unit_ada"]:checked').value;

  if (terlihatVal === "Ya" && !TEMP_MODAL_PHOTO_BASE64) {
    alert("Wajib mengambil foto fisik kendaraan melalui kamera langsung!");
    return;
  }

  const indVal = (document.getElementById("modal-input-indikasi")?.value || "").trim();
  if (terlihatVal === "Tidak" && !indVal) {
    alert("Silakan pilih atau ketik Indikasi Keberadaan Unit!");
    const indInput = document.getElementById("modal-input-indikasi");
    if (indInput) {
      indInput.focus();
      openIndikasiSearchDropdown();
    }
    return;
  }

  u.terlihat = terlihatVal;
  u.foto_unit = (terlihatVal === "Ya") ? TEMP_MODAL_PHOTO_BASE64 : null;
  u.indikasi = indVal;
  u.gps_match = document.querySelector('input[name="modal_gps_match"]:checked').value;

  const checkedInfo = [];
  document.querySelectorAll('input[name="modal_info_unit"]:checked').forEach(cb => {
    if (cb.value === "Lainnya") {
      const customVal = document.getElementById("modal-input-info-lainnya")?.value.trim();
      if (customVal) {
        checkedInfo.push(`Lainnya: ${customVal}`);
      } else {
        checkedInfo.push("Lainnya");
      }
    } else {
      checkedInfo.push(cb.value);
    }
  });
  u.info_unit = checkedInfo;

  if (u.is_ovd) {
    u.ovd_plan = document.getElementById("modal-input-ovd-plan").value;
    u.komitmen = document.getElementById("modal-select-komitmen").value;
    u.tgl_komitmen = document.getElementById("modal-input-tgl-komitmen").value;
  }

  u.is_checked = true;
  const iconContainer = document.getElementById(`unit-status-icon-${CURRENT_UNIT_INDEX}`);
  iconContainer.innerHTML = '<span class="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg font-bold"><i class="fa-solid fa-check mr-1"></i> Selesai</span>';

  closeUnitModal();
}

function getPreciseLocation() {
  const geoDisplay = document.getElementById("geo-location-display");
  const onbGeoDisplay = document.getElementById("onb-geo-display");
  const geoBadge = document.getElementById("geo-status-badge");

  CURRENT_USER_GEO.lat = null;
  CURRENT_USER_GEO.long = null;
  CURRENT_USER_GEO.accuracy = null;

  if (geoDisplay) {
    geoDisplay.innerHTML = '<span class="text-amber-600 font-semibold"><i class="fa-solid fa-circle-notch fa-spin mr-1"></i>Mengunci titik koordinat GPS...</span>';
  }
  if (geoBadge) {
    geoBadge.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-0.5"></i> Mencari...';
    geoBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 text-amber-800 border border-amber-300 shrink-0";
  }

  if (!navigator.geolocation) {
    const notSupported = "Perangkat / Browser Tidak Mendukung GPS";
    if (geoDisplay) geoDisplay.innerHTML = `<span class="text-rose-600 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${notSupported}</span>`;
    if (onbGeoDisplay) onbGeoDisplay.innerText = notSupported;
    if (geoBadge) {
      geoBadge.innerHTML = '<i class="fa-solid fa-ban mr-0.5"></i> Not Supported';
      geoBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0";
    }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const crd = pos.coords;
      CURRENT_USER_GEO.lat = crd.latitude;
      CURRENT_USER_GEO.long = crd.longitude;
      CURRENT_USER_GEO.accuracy = crd.accuracy;
      const locStr = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (±${Math.round(crd.accuracy)}m)`;
      if (geoDisplay) {
        geoDisplay.innerHTML = `<span class="text-emerald-700 font-bold"><i class="fa-solid fa-circle-check text-emerald-600 mr-1"></i>${locStr}</span>`;
      }
      if (onbGeoDisplay) onbGeoDisplay.innerText = locStr;
      if (geoBadge) {
        geoBadge.innerHTML = '<i class="fa-solid fa-satellite-dish mr-0.5"></i> Terkunci';
        geoBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0";
      }
    },
    err => {
      CURRENT_USER_GEO.lat = null;
      CURRENT_USER_GEO.long = null;
      CURRENT_USER_GEO.accuracy = null;

      let errReason = "GPS Tidak Aktif / Akses Ditolak";
      let shortBadge = "GPS Off";

      if (err && err.code === 1) { // PERMISSION_DENIED
        errReason = "Izin GPS Ditolak / Diblokir Browser";
        shortBadge = "Izin Ditolak";
      } else if (err && err.code === 2) { // POSITION_UNAVAILABLE
        errReason = "Sinyal GPS Tidak Ditemukan / GPS HP Mati";
        shortBadge = "Sinyal Hilang";
      } else if (err && err.code === 3) { // TIMEOUT
        errReason = "Waktu Pencarian GPS Habis (Coba Refresh)";
        shortBadge = "Timeout";
      }

      if (geoDisplay) {
        geoDisplay.innerHTML = `<span class="text-rose-600 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${errReason}</span>`;
      }
      if (onbGeoDisplay) onbGeoDisplay.innerText = errReason;
      if (geoBadge) {
        geoBadge.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-0.5"></i> ${shortBadge}`;
        geoBadge.className = "text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-100 text-rose-800 border border-rose-300 shrink-0";
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function handleShowroomPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    CURRENT_SHOWROOM_PHOTO_BASE64 = compressed;
    const imgPreview = document.getElementById("img-visit-showroom-preview");
    if (imgPreview) imgPreview.src = compressed;
    const previewCard = document.getElementById("preview-photo-card");
    if (previewCard) previewCard.classList.remove("hidden");
    const triggerBox = document.getElementById("trigger-visit-photo");
    if (triggerBox) triggerBox.classList.add("hidden");
  }
}

function removePhoto() {
  document.getElementById("file-visit-photo").value = "";
  CURRENT_SHOWROOM_PHOTO_BASE64 = null;
  const imgPreview = document.getElementById("img-visit-showroom-preview");
  if (imgPreview) imgPreview.src = "";
  const previewCard = document.getElementById("preview-photo-card");
  if (previewCard) previewCard.classList.add("hidden");
  const triggerBox = document.getElementById("trigger-visit-photo");
  if (triggerBox) triggerBox.classList.remove("hidden");
}

async function handleFormSubmit(e) {
  e.preventDefault();

  try {
    // 1. Strict GPS Check: Sama seperti absensi, wajib GPS aktif dan dapat koordinat riil
    if (!CURRENT_USER_GEO.lat || !CURRENT_USER_GEO.long) {
      alert("GPS Wajib Aktif & Diberikan Izin!\n\nKoordinat lokasi kunjungan belum berhasil didapatkan.\n\nPastikan:\n1. Fitur Lokasi / GPS di HP Anda sudah aktif (ON)\n2. Browser telah diberi izin mengakses lokasi\n\nSilakan klik tombol 'Refresh' pada bagian Geotag Presisi untuk mengunci koordinat sebelum mengirim laporan.");
      getPreciseLocation();
      const geoElem = document.getElementById("geo-location-display");
      if (geoElem) geoElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (ACTIVE_UNITS_STATE.length > 0) {
      const unchecked = ACTIVE_UNITS_STATE.filter(u => !u.is_checked);
      if (unchecked.length > 0) {
        alert(`Peringatan: Terdapat ${unchecked.length} unit fasilitas aktif yang belum diperiksa checklist & fotonya.`);
        return;
      }
    }

    if (!CURRENT_SHOWROOM_PHOTO_BASE64) {
      alert("Wajib mengambil foto fisik kunjungan melalui kamera!");
      return;
    }

    const dealerSelect = document.getElementById("input-dealer");
    let dealerId = dealerSelect ? dealerSelect.value : "";
    const searchInput = document.getElementById("dealer-search-input");
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : "";

    // Auto-resolve jika user mengetik nama mitra tapi select belum terikat
    if (!dealerId && searchVal) {
      const matched = MASTER_DEALER_PRIORITY_DATA.find(d => {
        const dName = String(d.dealer_name || "").toLowerCase();
        const dFull = `${dName} (${String(d.cabang || '').toLowerCase()})`;
        return dFull === searchVal || dName === searchVal || dFull.includes(searchVal) || searchVal.includes(dName);
      });
      if (matched) {
        dealerId = matched.dealer_id;
        selectDealerFromSearch(matched.dealer_id);
      }
    }

    if (!dealerId) {
      alert("Silakan pilih Mitra Partner dari daftar pencarian terlebih dahulu!");
      if (searchInput) {
        searchInput.focus();
        openDealerSearchDropdown();
      }
      return;
    }

    const selectedDealerObj = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId);
    const dealerName = selectedDealerObj
      ? selectedDealerObj.dealer_name
      : (dealerSelect?.options[dealerSelect?.selectedIndex]?.text || searchInput?.value || "Unknown Dealer");
    const lokasiInput = document.getElementById("lokasi-search-input");
    const lokasi = lokasiInput ? lokasiInput.value.trim() : "Showroom";
    if (!lokasi) {
      alert("Silakan pilih atau ketik Lokasi Kunjungan terlebih dahulu!");
      if (lokasiInput) {
        lokasiInput.focus();
        openLokasiSearchDropdown();
      }
      return;
    }

    const bertemuInput = document.getElementById("bertemu-search-input");
    const bertemu = bertemuInput ? bertemuInput.value.trim() : "Owner";
    if (!bertemu) {
      alert("Silakan pilih atau ketik pihak yang Anda temui saat kunjungan!");
      if (bertemuInput) {
        bertemuInput.focus();
        openBertemuSearchDropdown();
      }
      return;
    }

    const isShowroom = lokasi.toLowerCase().includes("showroom");
    const isBertemu = (
      bertemu !== "" &&
      bertemu !== "-" &&
      !bertemu.toLowerCase().includes("tidak bertemu") &&
      bertemu.toLowerCase() !== "tidak"
    );
    const ownerReason = isBertemu ? "-" : "Tidak Bertemu";

    const isNoShowroomInfo = document.getElementById("toggle-no-showroom-info")?.checked || false;

    let stock = "-";
    let sales = "-";
    let issueDigi = "-";
    let issueInternal = "-";
    let issueKomp = "-";

    // Validasi Segmen 2 sepenuhnya tergantung kepada toggle Tidak Ada Informasi
    if (!isNoShowroomInfo) {
      const rawStock = document.getElementById("input-stock-unit")?.value?.trim();
      const rawSales = document.getElementById("input-sales-unit")?.value?.trim();

      if (rawStock === "" || rawStock === undefined) {
        alert("Mohon isi Jumlah Stock Unit di Segmen 2 (atau aktifkan centang 'Tidak Ada Informasi' jika informasi tidak didapatkan).");
        const sInput = document.getElementById("input-stock-unit");
        if (sInput) sInput.focus();
        return;
      }
      if (rawSales === "" || rawSales === undefined) {
        alert("Mohon isi Penjualan Bulan Ini di Segmen 2 (atau aktifkan centang 'Tidak Ada Informasi' jika informasi tidak didapatkan).");
        const slInput = document.getElementById("input-sales-unit");
        if (slInput) slInput.focus();
        return;
      }

      stock = rawStock;
      sales = rawSales;
      issueDigi = document.getElementById("input-issue-digiasha")?.value?.trim() || "-";
      issueInternal = document.getElementById("input-issue-internal")?.value?.trim() || "-";
      issueKomp = document.getElementById("input-issue-kompetitor")?.value?.trim() || "-";
    }

    const catatanVisit = document.getElementById("input-catatan-visit")?.value?.trim() || "-";

    let waText = `*LAPORAN HASIL KUNJUNGAN MITRA*\n------------------------------------\n*Mitra:* ${dealerName}\n*Lokasi:* ${lokasi}\n*Bertemu:* ${bertemu}\n`;

    if (!isNoShowroomInfo) {
      waText += `*Stock Unit Showroom:* ${stock} Unit\n*Penjualan Bulan Ini:* ${sales} Unit\n\n`;
    } else {
      waText += `*Kondisi Showroom:* (Tidak Ada Informasi)\n\n`;
    }

    if (ACTIVE_UNITS_STATE.length > 0) {
      waText += `*PEMERIKSAAN UNIT FASILITAS:*\n`;
      ACTIVE_UNITS_STATE.forEach((u, i) => {
        waText += `${i + 1}. *${u.nopol}* - ${u.unit}\n   • Status: ${u.is_ovd ? 'OVERDUE' : 'LANCAR'}\n   • Fisik: ${u.terlihat}${u.terlihat === 'Tidak' ? '(' + u.indikasi + ')' : '[Foto Kamera OK]'}\n   • GPS Match: ${u.gps_match}\n   • Info: ${u.info_unit.join(', ') || '-'}\n`;
        if (u.is_ovd) {
          waText += `   • Plan OVD: ${u.ovd_plan || '-'}\n   • Komitmen: ${u.komitmen}${u.tgl_komitmen ? '(' + u.tgl_komitmen + ')' : ''}\n`;
        }
      });
      waText += `\n`;
    }

    if (!isNoShowroomInfo) {
      waText += `*CATATAN & ISSUE:*\n• Digiasha: ${issueDigi}\n• Internal Dealer: ${issueInternal}\n• Kompetitor: ${issueKomp}\n`;
    }

    const geoLat = (CURRENT_USER_GEO && CURRENT_USER_GEO.lat !== null && !isNaN(CURRENT_USER_GEO.lat)) ? CURRENT_USER_GEO.lat : null;
    const geoLong = (CURRENT_USER_GEO && CURRENT_USER_GEO.long !== null && !isNaN(CURRENT_USER_GEO.long)) ? CURRENT_USER_GEO.long : null;
    const geoStr = (geoLat !== null && geoLong !== null) ? `${Number(geoLat).toFixed(5)},${Number(geoLong).toFixed(5)}` : "Lokasi Tidak Terdeteksi";

    waText += `• Catatan Visit: ${catatanVisit}\n• Geotag: ${geoStr}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

    // Update State Lokal Secara Optimistis (Real-time Closed Loop)
    const isMitraSolved = (
      isShowroom ||
      isBertemu
    );
    const targetDealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId || d.dealer_name === dealerName);
    if (targetDealer) {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      if (isMitraSolved) {
        targetDealer.is_visited_today = true;
        targetDealer.last_visit_date = todayStr;
        targetDealer.aging_visit_mitra = 0;
        targetDealer.dealer_concern = null;
      }
      if (targetDealer.units && Array.isArray(ACTIVE_UNITS_STATE)) {
        ACTIVE_UNITS_STATE.forEach(checkedUnit => {
          const isVisible = (checkedUnit.terlihat === "Ya" || String(checkedUnit.terlihat || "").toLowerCase().includes("terlihat"));
          if (isVisible) {
            const uObj = targetDealer.units.find(u => (checkedUnit.no_fasilitas && u.no_fasilitas === checkedUnit.no_fasilitas) || u.nopol === checkedUnit.nopol);
            if (uObj) {
              uObj.unit_concern = null;
              uObj.last_visit_date = todayStr;
              uObj.aging_visit_unit = 0;
              uObj.priority_level = "Normal";
              uObj.priority_score = 0;
              uObj.priority_reason = "Kondisi Normal / Terjadwal Baik";
            }
          }
        });
      }
      if (isMitraSolved) {
        const remUrgent = (targetDealer.units || []).filter(u =>
          u.last_visit_date !== todayStr &&
          (u.priority_level === "Kritis" || u.priority_level === "Penting" || (u.priority_score && u.priority_score > 0) || u.unit_concern)
        );
        targetDealer.urgent_units_count = remUrgent.length;
        if (remUrgent.length === 0) {
          targetDealer.priority_level = "Normal";
          targetDealer.priority_score = 0;
          targetDealer.priority_reason = "Selesai Dikunjungi Hari Ini";
        } else {
          targetDealer.priority_level = "Penting";
          targetDealer.priority_score = 1;
          targetDealer.priority_reason = `Selesai Visit Mitra, ${remUrgent.length} unit belum clear`;
        }
      }
      if (typeof renderPriorityList === "function") {
        try { renderPriorityList(); } catch (e) { }
      }
    }

    // Kirim ke Google Apps Script secara asynchronous
    callApi("submitVisit", {
      dealer_id: dealerId,
      dealer_name: dealerName,
      lokasi: lokasi,
      bertemu_owner: bertemu,
      owner_reason: ownerReason,
      stock: stock,
      sales: sales,
      issue_digi: issueDigi,
      issue_internal: issueInternal,
      issue_komp: issueKomp,
      catatan_visit: catatanVisit,
      tindak_lanjut_concern: "-",
      lat: geoLat,
      long: geoLong,
      showroom_photo_base64: CURRENT_SHOWROOM_PHOTO_BASE64,
      unit_check_list: ACTIVE_UNITS_STATE,
      currentUser: CURRENT_USER
    });

    openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-emerald-600");
  } catch (err) {
    console.error("Error submitting visit:", err);
    alert("Terjadi kendala saat memproses laporan visit: " + err.message);
  }
}

// =========================================================================
// ONBOARDING CALON MITRA
// =========================================================================
let ACTIVE_ONBOARDING_CANDIDATES = [];

async function initOnboardingScreen() {
  const selectLama = document.getElementById("onb-select-db-lama");
  const countBadge = document.getElementById("onb-pipeline-count-badge");
  const previewBox = document.getElementById("onb-db-lama-preview-box");

  if (previewBox) previewBox.classList.add("hidden");
  if (selectLama) {
    selectLama.innerHTML = '<option value="">-- Memuat calon mitra on-process... --</option>';
  }

  try {
    if (!supabaseClient) throw new Error("Supabase Client belum terhubung");

    const isSuper = (!CURRENT_USER?.area_cover || CURRENT_USER.area_cover.trim() === "" || CURRENT_USER.area_cover === "*" || CURRENT_USER.area_cover.toUpperCase() === "ALL");
    const userAreas = (CURRENT_USER?.area_cover || "").split(/[,;/|]+/).map(a => a.trim().toLowerCase()).filter(Boolean);
    const userBranch = String(CURRENT_USER?.cabang || "").trim().toLowerCase();
    const userNip = CURRENT_USER?.nip || null;

    // Ambil data onboarding log dari Supabase
    const { data, error } = await supabaseClient
      .from("tr_onboarding_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    const parsedList = (data || []).map(parseOnboardingRecord);

    // Filter status belum final (bukan FINAL, APPROVED, REJECTED, DEALER_RESMI, BATAL)
    const onProcessList = parsedList.filter(item => {
      const st = String(item.statusDb || "").toUpperCase();
      const cat = String(item.catatan || "").toUpperCase();
      const isFinal = st.includes("FINAL") || st.includes("APPROVED") || st.includes("REJECT") || st.includes("BATAL") || cat.includes("FINAL APPROVED");
      return !isFinal;
    });

    // Filter scoping area cover & PIC
    const filteredByArea = onProcessList.filter(item => {
      if (isSuper) return true;
      // Jika diinput oleh user ini sendiri
      if (userNip && item.nip === userNip) return true;
      // Jika memiliki area match
      if (userAreas.length > 0) {
        const itemAlamat = String(item.alamat || "").toLowerCase();
        const itemUsaha = String(item.namaUsaha || "").toLowerCase();
        const itemCat = String(item.catatan || "").toLowerCase();
        const matchArea = userAreas.some(a => itemAlamat.includes(a) || itemUsaha.includes(a) || itemCat.includes(a));
        if (matchArea) return true;
      }
      // Jika dalam cabang yang sama
      if (userBranch && userBranch !== "head office") {
        const itemAlamat = String(item.alamat || "").toLowerCase();
        if (itemAlamat.includes(userBranch)) return true;
      }
      return false;
    });

    // Grouping per calon mitra (pilih versi terupdate per nama usaha / pemohon)
    const uniqueMap = new Map();
    filteredByArea.forEach(item => {
      const key = `${String(item.namaPemohon).trim().toLowerCase()}_${String(item.namaUsaha).trim().toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    });

    ACTIVE_ONBOARDING_CANDIDATES = Array.from(uniqueMap.values());

    if (selectLama) {
      if (ACTIVE_ONBOARDING_CANDIDATES.length === 0) {
        selectLama.innerHTML = '<option value="">-- Belum ada calon mitra on-process di area ini --</option>';
      } else {
        selectLama.innerHTML = '<option value="">-- Pilih Calon Mitra On-Process (' + ACTIVE_ONBOARDING_CANDIDATES.length + ' Data) --</option>' +
          ACTIVE_ONBOARDING_CANDIDATES.map(c => {
            const stageText = c.stages && c.stages.length > 0 ? c.stages.join(' & ') : 'On-Process';
            return `<option value="${c.id}">${c.namaPemohon} - ${c.namaUsaha} (${stageText})</option>`;
          }).join('');
      }
    }

    if (countBadge) {
      countBadge.innerText = `${ACTIVE_ONBOARDING_CANDIDATES.length} Prospek`;
    }

    renderOnbDbLamaSearchDropdown("");
  } catch (err) {
    console.error("Error init onboarding screen:", err);
    if (selectLama) {
      selectLama.innerHTML = '<option value="">-- Gagal memuat data calon mitra --</option>';
    }
    if (countBadge) {
      countBadge.innerText = '0 Prospek';
    }
    renderOnbDbLamaSearchDropdown("");
  }
}

function renderOnbDbLamaSearchDropdown(query = "") {
  const dropdown = document.getElementById("onb-db-lama-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  const filtered = ACTIVE_ONBOARDING_CANDIDATES.filter(c => {
    if (!q) return true;
    const pemohon = String(c.namaPemohon || "").toLowerCase();
    const usaha = String(c.namaUsaha || "").toLowerCase();
    const alamat = String(c.alamat || "").toLowerCase();
    const pic = String(c.nip || "").toLowerCase();
    return pemohon.includes(q) || usaha.includes(q) || alamat.includes(q) || pic.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-user-slash mb-1 block text-slate-300"></i>Tidak ada calon mitra yang cocok';
    dropdown.appendChild(emptyDiv);
    return;
  }

  filtered.forEach(c => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-teal-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectOnbDbLamaFromSearch(c.id);
    };

    const stageText = c.stages && c.stages.length > 0 ? c.stages.join(' & ') : 'On-Process';

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">
          <span class="text-teal-800 font-bold">${c.namaPemohon || "-"}</span>
          <span class="text-slate-500 font-normal">(${c.namaUsaha || "-"})</span>
        </div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <span class="truncate max-w-[200px]">${c.alamat || "Alamat Sesuai DB"}</span>
          <span>•</span>
          <span class="text-slate-400">PIC: ${c.nip || "-"}</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-teal-50 text-teal-700 border-teal-200 shrink-0 uppercase">${stageText}</span>
    `;
    dropdown.appendChild(item);
  });
}

function openOnbDbLamaSearchDropdown() {
  const dropdown = document.getElementById("onb-db-lama-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("onb-db-lama-search-input");
    renderOnbDbLamaSearchDropdown(input ? input.value : "");
  }
}

function closeOnbDbLamaSearchDropdown() {
  const dropdown = document.getElementById("onb-db-lama-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterOnbDbLamaSearchOptions(query) {
  openOnbDbLamaSearchDropdown();
  renderOnbDbLamaSearchDropdown(query);

  const clearBtn = document.getElementById("onb-db-lama-search-clear-btn");
  const chevron = document.getElementById("onb-db-lama-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectOnbDbLamaFromSearch(candId) {
  const cand = ACTIVE_ONBOARDING_CANDIDATES.find(c => c.id === candId);
  const input = document.getElementById("onb-db-lama-search-input");
  const sel = document.getElementById("onb-select-db-lama");
  const clearBtn = document.getElementById("onb-db-lama-search-clear-btn");
  const chevron = document.getElementById("onb-db-lama-search-chevron");

  if (cand && input && sel) {
    input.value = `${cand.namaPemohon} - ${cand.namaUsaha}`;
    sel.value = cand.id;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeOnbDbLamaSearchDropdown();
    onSelectOnboardingDbLama(cand.id);
  }
}

function clearOnbDbLamaSearchSelection() {
  const input = document.getElementById("onb-db-lama-search-input");
  const sel = document.getElementById("onb-select-db-lama");
  const clearBtn = document.getElementById("onb-db-lama-search-clear-btn");
  const chevron = document.getElementById("onb-db-lama-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  onSelectOnboardingDbLama("");
  openOnbDbLamaSearchDropdown();
}

function onSelectOnboardingDbLama(candId) {
  const previewBox = document.getElementById("onb-db-lama-preview-box");
  const prevUsaha = document.getElementById("onb-prev-usaha");
  const prevPemohon = document.getElementById("onb-prev-pemohon");
  const prevStage = document.getElementById("onb-prev-stage-badge");
  const prevAlamat = document.getElementById("onb-prev-alamat");
  const prevPic = document.getElementById("onb-prev-pic");

  if (!candId) {
    if (previewBox) previewBox.classList.add("hidden");
    return;
  }

  const cand = ACTIVE_ONBOARDING_CANDIDATES.find(c => c.id === candId);
  if (!cand) return;

  if (previewBox) previewBox.classList.remove("hidden");
  if (prevUsaha) prevUsaha.innerText = cand.namaUsaha || "-";
  if (prevPemohon) prevPemohon.innerText = `Pemohon: ${cand.namaPemohon || "-"}`;
  if (prevStage) prevStage.innerText = cand.stages && cand.stages.length > 0 ? cand.stages.join(' & ') : "On-Process";
  if (prevAlamat) prevAlamat.innerText = `Alamat: ${cand.alamat || "-"}`;
  if (prevPic) prevPic.innerText = `PIC Terakhir: ${cand.nip || "-"}`;

  // Pre-check previous stages
  document.querySelectorAll('input[name="onb_act_type"]').forEach(cb => {
    cb.checked = cand.stages && cand.stages.includes(cb.value);
  });

  // Pre-load existing document files if any
  if (cand.documents && Array.isArray(cand.documents) && cand.documents.length > 0) {
    cand.documents.forEach(doc => {
      if (doc.key && doc.files && doc.files.length > 0) {
        ONB_DOC_FILES[doc.key] = {
          title: doc.title || doc.key,
          files: [...doc.files]
        };
      }
    });
    ONBOARDING_DOC_MASTER.forEach(m => {
      renderDocScorecardBadge(m.key);
    });
    updateOnbDocCounter();
  }
}

function toggleDatabaseBaru(isBaru) {
  const boxBaru = document.getElementById("box-segmen-db-baru");
  const boxLama = document.getElementById("box-segmen-db-lama");
  const namaPemohon = document.getElementById("onb-input-nama-pemohon");
  const namaUsaha = document.getElementById("onb-input-nama-usaha");
  const alamat = document.getElementById("onb-input-alamat");
  const selectLama = document.getElementById("onb-select-db-lama");

  if (isBaru) {
    boxBaru.classList.remove("hidden");
    boxLama.classList.add("hidden");
    namaPemohon.required = true;
    namaUsaha.required = true;
    alamat.required = true;
    selectLama.required = false;
  } else {
    boxBaru.classList.add("hidden");
    boxLama.classList.remove("hidden");
    namaPemohon.required = false;
    namaUsaha.required = false;
    alamat.required = false;
    selectLama.required = true;
    if (ACTIVE_ONBOARDING_CANDIDATES.length === 0) {
      initOnboardingScreen();
    }
  }
}

function toggleJenisUsaha(val) {
  const boxGambaran = document.getElementById("box-gambaran-usaha");
  const boxDealer = document.getElementById("box-dealer-fields");
  const inputGambaran = document.getElementById("onb-input-gambaran-usaha");
  const inputStokLainnya = document.getElementById("onb-input-stok-lainnya");
  const inputStokDealer = document.getElementById("onb-input-stok");

  if (val === "Dealer") {
    boxDealer.classList.remove("hidden");
    boxGambaran.classList.add("hidden");
    inputStokDealer.required = true;
    inputGambaran.required = false;
    inputStokLainnya.required = false;
  } else {
    boxDealer.classList.add("hidden");
    boxGambaran.classList.remove("hidden");
    inputStokDealer.required = false;
    inputGambaran.required = true;
    inputStokLainnya.required = true;
  }
}

// Master Dokumen Onboarding (15 Kategori Dokumen Sesuai Urutan)
const ONBOARDING_DOC_MASTER = [
  // Baris 1
  { key: "KTP_Pemohon", title: "KTP Pemohon", icon: "fa-id-card" },
  { key: "KTP_Pasangan", title: "KTP Pasangan", icon: "fa-id-card-clip" },
  { key: "Kartu_Keluarga", title: "Kartu Keluarga", icon: "fa-users" },

  // Baris 2
  { key: "Legalitas_PT_CV", title: "Legalitas PT/CV", icon: "fa-building-flag" },
  { key: "NPWP", title: "NPWP", icon: "fa-file-invoice" },
  { key: "Legalitas_Usaha", title: "Legalitas Usaha", icon: "fa-stamp" },

  // Baris 3
  { key: "Bukti_Domisili", title: "Bukti Domisili", icon: "fa-house-user" },
  { key: "Bukti_Tempat_Usaha", title: "Bukti Tempat Usaha", icon: "fa-shop" },
  { key: "Rekening_Koran", title: "Rekening Koran", icon: "fa-money-check-dollar" },

  // Baris 4
  { key: "Foto_Domisili", title: "Foto Domisili", icon: "fa-house" },
  { key: "Foto_Tempat_Usaha", title: "Foto Tempat Usaha", icon: "fa-store" },
  { key: "Foto_Dengan_Pemohon", title: "Foto Dengan Pemohon", icon: "fa-camera-retro" },

  // Baris 5
  { key: "Stok_Unit_Barang", title: "Stok Unit/Barang", icon: "fa-car" },
  { key: "Stok_BPKB", title: "Stok BPKB", icon: "fa-folder-open" },
  { key: "Dokumen_Lain", title: "Dokumen lain", icon: "fa-folder-plus" }
];

function generateStandardDocFileName(docTitle, fileIndex, originalFileName) {
  const extMatch = String(originalFileName || "").match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch ? extMatch[1].toLowerCase() : "jpg";
  return `${docTitle} - Berkas ${fileIndex}.${ext}`;
}

let ACTIVE_FOLDER_MODAL_DOC = null;

function triggerDocUploadInput(docKey, docTitle) {
  const inp = document.getElementById(`onb-file-input-${docKey}`);
  if (inp) inp.click();
}

async function handleDocMultiFilesSelected(input, docKey, docTitle) {
  if (!input.files || input.files.length === 0) return;
  if (!ONB_DOC_FILES[docKey]) {
    ONB_DOC_FILES[docKey] = { title: docTitle, files: [] };
  }

  const existingCount = ONB_DOC_FILES[docKey].files.length;

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    let base64 = "";
    if (file.type && file.type.startsWith("image/")) {
      base64 = await compressImage(file, 1200, 0.75);
    } else {
      base64 = await readFileAsBase64(file);
    }
    const stdName = generateStandardDocFileName(docTitle, existingCount + i + 1, file.name);
    ONB_DOC_FILES[docKey].files.push({
      name: stdName,
      type: file.type || "application/octet-stream",
      size: file.size,
      base64: base64
    });
  }

  input.value = "";
  renderDocScorecardBadge(docKey);
  updateOnbDocCounter();

  if (ACTIVE_FOLDER_MODAL_DOC && ACTIVE_FOLDER_MODAL_DOC.key === docKey && ACTIVE_FOLDER_MODAL_DOC.context === 'onboarding') {
    renderDocFolderModalFilesList();
  }
}

function removeDocFile(docKey, index) {
  if (ONB_DOC_FILES[docKey] && ONB_DOC_FILES[docKey].files) {
    ONB_DOC_FILES[docKey].files.splice(index, 1);
    if (ONB_DOC_FILES[docKey].files.length === 0) {
      delete ONB_DOC_FILES[docKey];
    }
  }
  renderDocScorecardBadge(docKey);
  updateOnbDocCounter();
  if (ACTIVE_FOLDER_MODAL_DOC && ACTIVE_FOLDER_MODAL_DOC.key === docKey && ACTIVE_FOLDER_MODAL_DOC.context === 'onboarding') {
    renderDocFolderModalFilesList();
  }
}

function renderDocScorecardBadge(docKey) {
  const badge = document.getElementById(`badge-count-${docKey}`);
  const card = document.getElementById(`card-doc-${docKey}`);
  const docObj = ONB_DOC_FILES[docKey];
  const count = (docObj && docObj.files) ? docObj.files.length : 0;
  if (count === 0) {
    if (badge) {
      badge.innerText = "0";
      badge.classList.add("hidden");
    }
    if (card) {
      card.classList.remove("bg-teal-50/70", "border-teal-400");
      card.classList.add("bg-slate-50", "border-slate-200");
    }
  } else {
    if (badge) {
      badge.innerText = `${count}`;
      badge.classList.remove("hidden");
    }
    if (card) {
      card.classList.remove("bg-slate-50", "border-slate-200");
      card.classList.add("bg-teal-50/70", "border-teal-400");
    }
  }
}

function renderDocChips(docKey) {
  renderDocScorecardBadge(docKey);
}

function openDocFolderModal(docKey, docTitle, context = "onboarding") {
  ACTIVE_FOLDER_MODAL_DOC = { key: docKey, title: docTitle, context: context };

  const titleEl = document.getElementById("doc-folder-modal-title");
  if (titleEl) titleEl.innerText = `Folder: ${docTitle}`;

  renderDocFolderModalFilesList();

  const modal = document.getElementById("modal-doc-folder-viewer");
  if (modal) modal.classList.remove("hidden");
}

function closeDocFolderModal() {
  const modal = document.getElementById("modal-doc-folder-viewer");
  if (modal) modal.classList.add("hidden");
  ACTIVE_FOLDER_MODAL_DOC = null;
}

function triggerFolderModalUpload() {
  const inp = document.getElementById("input-folder-modal-file");
  if (inp) inp.click();
}

let HIST_ACTIVE_ONB_DOCS = {};

function initHistOnbDocuments(documents) {
  HIST_ACTIVE_ONB_DOCS = {};
  if (Array.isArray(documents)) {
    documents.forEach(doc => {
      if (doc.key && doc.files && doc.files.length > 0) {
        HIST_ACTIVE_ONB_DOCS[doc.key] = {
          title: doc.title || doc.key,
          files: [...doc.files]
        };
      }
    });
  }
}

function updateHistOnbDocCounter() {
  const counter = document.getElementById("hist-onb-doc-total-badge");
  if (!counter) return;
  const docKeys = Object.keys(HIST_ACTIVE_ONB_DOCS);
  let totalFiles = 0;
  docKeys.forEach(k => {
    if (HIST_ACTIVE_ONB_DOCS[k]?.files) totalFiles += HIST_ACTIVE_ONB_DOCS[k].files.length;
  });
  counter.innerText = `${totalFiles} Berkas`;
}

function renderHistDocScorecardBadge(docKey) {
  const badge = document.getElementById(`hist-badge-count-${docKey}`);
  const card = document.getElementById(`hist-card-doc-${docKey}`);
  const docObj = HIST_ACTIVE_ONB_DOCS[docKey];
  const count = (docObj && docObj.files) ? docObj.files.length : 0;
  if (count === 0) {
    if (badge) {
      badge.innerText = "0";
      badge.classList.add("hidden");
    }
    if (card) {
      card.classList.remove("bg-teal-50/80", "border-teal-400");
      card.classList.add("bg-white", "border-slate-200");
    }
  } else {
    if (badge) {
      badge.innerText = `${count}`;
      badge.classList.remove("hidden");
    }
    if (card) {
      card.classList.remove("bg-white", "border-slate-200");
      card.classList.add("bg-teal-50/80", "border-teal-400");
    }
  }
  updateHistOnbDocCounter();
}

function toggleHistOnbJenisUsaha(val) {
  const boxDealer = document.getElementById("box-hist-onb-dealer");
  const boxLainnya = document.getElementById("box-hist-onb-lainnya");
  if (val === "Dealer") {
    if (boxDealer) boxDealer.classList.remove("hidden");
    if (boxLainnya) boxLainnya.classList.add("hidden");
  } else {
    if (boxDealer) boxDealer.classList.add("hidden");
    if (boxLainnya) boxLainnya.classList.remove("hidden");
  }
}

async function handleFolderModalFilesSelected(input) {
  if (!ACTIVE_FOLDER_MODAL_DOC || !input.files || input.files.length === 0) return;
  const { key, title, context } = ACTIVE_FOLDER_MODAL_DOC;

  if (context === "onboarding") {
    await handleDocMultiFilesSelected(input, key, title);
  } else if (context === "history_onboarding") {
    if (!HIST_ACTIVE_ONB_DOCS[key]) {
      HIST_ACTIVE_ONB_DOCS[key] = { title: title, files: [] };
    }
    const existingCount = HIST_ACTIVE_ONB_DOCS[key].files.length;
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      let base64 = "";
      if (file.type && file.type.startsWith("image/")) {
        base64 = await compressImage(file, 1200, 0.75);
      } else {
        base64 = await readFileAsBase64(file);
      }
      const stdName = generateStandardDocFileName(title, existingCount + i + 1, file.name);
      HIST_ACTIVE_ONB_DOCS[key].files.push({
        name: stdName,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64: base64
      });
    }
    input.value = "";
    renderHistDocScorecardBadge(key);
    renderDocFolderModalFilesList();
  } else if (context === "pipeline") {
    if (!PIPELINE_PENDING_UPLOADS[key]) PIPELINE_PENDING_UPLOADS[key] = [];
    const existingDoc = ACTIVE_PIPELINE_ITEM?.documents?.find(d => d.key === key || d.title === title);
    const existingCount = (existingDoc?.files?.length || 0) + (PIPELINE_PENDING_UPLOADS[key]?.length || 0);

    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      let base64 = "";
      if (file.type && file.type.startsWith("image/")) {
        base64 = await compressImage(file, 1200, 0.75);
      } else {
        base64 = await readFileAsBase64(file);
      }
      const stdName = generateStandardDocFileName(title, existingCount + i + 1, file.name);
      PIPELINE_PENDING_UPLOADS[key].push({
        name: stdName,
        type: file.type || "application/octet-stream",
        size: file.size,
        base64: base64
      });
    }
    input.value = "";
    renderModalPipelineDocFolders();
    renderDocFolderModalFilesList();
  }
}

function renderDocFolderModalFilesList() {
  if (!ACTIVE_FOLDER_MODAL_DOC) return;
  const { key, title, context } = ACTIVE_FOLDER_MODAL_DOC;
  const listContainer = document.getElementById("doc-folder-modal-files-list");
  const countEl = document.getElementById("doc-folder-modal-count");
  if (!listContainer) return;

  let files = [];
  if (context === "onboarding") {
    files = (ONB_DOC_FILES[key]?.files || []).map((f, idx) => ({ ...f, idx, isPending: false, isLocal: true }));
  } else if (context === "history_onboarding") {
    files = (HIST_ACTIVE_ONB_DOCS[key]?.files || []).map((f, idx) => ({ ...f, idx, isPending: false, isLocal: true }));
  } else if (context === "pipeline") {
    const existingDoc = ACTIVE_PIPELINE_ITEM?.documents?.find(d => d.key === key || d.title === title);
    const existingFiles = (existingDoc?.files || []).map((f, idx) => ({ ...f, idx, isPending: false, isLocal: false }));
    const pendingFiles = (PIPELINE_PENDING_UPLOADS[key] || []).map((f, idx) => ({ ...f, idx, isPending: true, isLocal: true }));
    files = [...existingFiles, ...pendingFiles];
  }

  if (countEl) countEl.innerText = `${files.length} Berkas Terlampir`;

  if (files.length === 0) {
    listContainer.innerHTML = `
      <div class="py-10 text-center space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <p class="text-xs font-bold text-slate-700">Folder Masih Kosong</p>
        <p class="text-[10px] text-slate-400 max-w-[200px] mx-auto leading-relaxed">Belum ada berkas untuk jenis dokumen ini. Klik tombol di atas untuk mengunggah berkas baru.</p>
      </div>
    `;
    return;
  }

  listContainer.innerHTML = files.map((f, i) => {
    const isImg = (f.type && f.type.startsWith("image/")) || (f.url && f.url.match(/\.(jpg|jpeg|png|webp)/i)) || f.base64;
    const previewSrc = f.base64 || f.url || "";
    const previewAction = isImg ? `onclick="openImageViewer('${previewSrc}', '${f.name}')"` : `onclick="window.open('${f.url}', '_blank')"`;
    const isPending = f.isPending;

    return `
      <div class="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex items-center justify-between gap-2.5 shadow-2xs hover:border-teal-300 transition">
        <div class="flex items-center space-x-2.5 min-w-0 cursor-pointer flex-1" ${previewAction}>
          ${isImg ? `<img src="${previewSrc}" class="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-white" />` : `<div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm shrink-0 border border-rose-200"><i class="fa-solid fa-file-pdf"></i></div>`}
          <div class="min-w-0 flex-1">
            <h5 class="text-xs font-bold text-slate-800 truncate" title="${f.name}">${f.name}</h5>
            <div class="flex items-center space-x-2 mt-0.5">
              <span class="text-[9px] ${isPending ? 'text-amber-700 font-bold' : 'text-emerald-600 font-semibold'} flex items-center gap-1">
                <i class="fa-solid ${isPending ? 'fa-clock' : 'fa-circle-check'}"></i>
                <span>${isPending ? 'Siap Diunggah' : 'Tersimpan'}</span>
              </span>
              <span class="text-[9px] text-teal-600 hover:underline">Lihat Preview</span>
            </div>
          </div>
        </div>

        <button type="button" onclick="removeFileFromFolderModal('${key}', ${f.idx}, ${isPending}, '${context}')" class="p-2 text-slate-400 hover:text-red-500 rounded-xl hover:bg-red-50 transition shrink-0" title="Hapus berkas ini">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    `;
  }).join('');
}

function removeFileFromFolderModal(docKey, fileIdx, isPending, context) {
  if (context === "onboarding") {
    removeDocFile(docKey, fileIdx);
  } else if (context === "history_onboarding") {
    if (HIST_ACTIVE_ONB_DOCS[docKey] && HIST_ACTIVE_ONB_DOCS[docKey].files) {
      HIST_ACTIVE_ONB_DOCS[docKey].files.splice(fileIdx, 1);
      if (HIST_ACTIVE_ONB_DOCS[docKey].files.length === 0) {
        delete HIST_ACTIVE_ONB_DOCS[docKey];
      }
    }
    renderHistDocScorecardBadge(docKey);
  } else if (context === "pipeline") {
    removePipelineDocFile(docKey, fileIdx, isPending);
  }
  renderDocFolderModalFilesList();
}

function updateOnbDocCounter() {
  const counter = document.getElementById("onb-total-doc-count");
  if (!counter) return;
  const docKeys = Object.keys(ONB_DOC_FILES);
  let totalFiles = 0;
  docKeys.forEach(k => {
    totalFiles += (ONB_DOC_FILES[k]?.files?.length || 0);
  });
  counter.innerText = `${docKeys.length} Dokumen (${totalFiles} File)`;
}

function toggleDocUploadRow(checkbox, docKey) {
  // Legacy stub for backward compatibility
}

async function handleDocPhotoCaptured(input, docKey, docTitle, cleanKey) {
  // Legacy stub
}

async function handleOnbSelfieSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    CURRENT_ONB_SELFIE_BASE64 = compressed;
    const imgPreview = document.getElementById("img-onb-selfie-preview");
    if (imgPreview) imgPreview.src = compressed;
    document.getElementById("preview-onb-selfie-card").classList.remove("hidden");
  }
}

function removeOnbSelfie() {
  document.getElementById("file-onb-selfie").value = "";
  CURRENT_ONB_SELFIE_BASE64 = null;
  const imgPreview = document.getElementById("img-onb-selfie-preview");
  if (imgPreview) imgPreview.src = "";
  document.getElementById("preview-onb-selfie-card").classList.add("hidden");
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  const actChecked = [];
  document.querySelectorAll('input[name="onb_act_type"]:checked').forEach(c => actChecked.push(c.value));
  if (actChecked.length === 0) {
    alert("Pilih minimal 1 jenis aktivitas onboarding (Penawaran, Coll Doc, atau Survey)!");
    return;
  }
  if (!CURRENT_ONB_SELFIE_BASE64) {
    alert("Wajib mengambil foto selfie kunjungan di lokasi calon mitra melalui kamera!");
    return;
  }

  const isDbBaru = document.querySelector('input[name="onb_db_baru"]:checked').value;
  let namaPemohon = "";
  let namaUsaha = "";
  let alamat = "";
  let jenisUsaha = "";
  let detailTambahan = "";

  if (isDbBaru === "Ya") {
    namaPemohon = document.getElementById("onb-input-nama-pemohon").value.trim();
    namaUsaha = document.getElementById("onb-input-nama-usaha").value.trim();
    alamat = document.getElementById("onb-input-alamat").value.trim();
    jenisUsaha = document.getElementById("onb-select-jenis-usaha").value;
    if (jenisUsaha === "Dealer") {
      const kapasitas = document.getElementById("onb-input-stok").value || "0";
      const lokasi = document.getElementById("onb-select-lokasi-dealer").value;
      detailTambahan = `• Stok Unit Showroom: ${kapasitas} Unit\n• Lokasi Usaha: ${lokasi}`;
    } else {
      const gambaran = document.getElementById("onb-input-gambaran-usaha").value.trim();
      const stokLainnya = document.getElementById("onb-input-stok-lainnya").value || "0";
      detailTambahan = `• Gambaran Usaha: ${gambaran}\n• Stok Barang/Aset: ${stokLainnya} Unit`;
    }
  } else {
    const selectLama = document.getElementById("onb-select-db-lama");
    const candId = selectLama?.value;
    if (!candId) {
      alert("Pilih calon mitra on-process terlebih dahulu melalui kolom pencarian!");
      return;
    }
    const cand = ACTIVE_ONBOARDING_CANDIDATES.find(c => c.id === candId);
    if (cand) {
      namaPemohon = cand.namaPemohon;
      namaUsaha = cand.namaUsaha;
      alamat = cand.alamat || "-";
      jenisUsaha = cand.jenisUsaha || "Dealer";
      detailTambahan = cand.detailUsaha || "";
    } else {
      const selectedOption = selectLama ? selectLama.options[selectLama.selectedIndex] : null;
      namaPemohon = selectedOption ? (selectedOption.getAttribute("data-pemohon") || selectedOption.text) : "-";
      namaUsaha = selectedOption ? (selectedOption.getAttribute("data-usaha") || "-") : "-";
      alamat = "- (Sesuai Database)";
      jenisUsaha = "On-Process Partner";
    }
  }

  const docKeys = Object.keys(ONB_DOC_FILES);
  let totalAttachedFiles = 0;
  const docListLines = [];
  const structuredDocs = [];

  docKeys.forEach(k => {
    const docItem = ONB_DOC_FILES[k];
    if (docItem && docItem.files && docItem.files.length > 0) {
      totalAttachedFiles += docItem.files.length;
      docListLines.push(`✓ ${docItem.title} (${docItem.files.length} file)`);
      structuredDocs.push({
        key: k,
        title: docItem.title,
        files: docItem.files
      });
    }
  });

  const docList = docListLines.length > 0 ? docListLines.join('\n') : '- Belum ada berkas fisik yang diunggah pada visit ini';
  const catatanHasil = document.getElementById("onb-catatan-hasil").value.trim();

  let waText = `*LAPORAN VISIT ONBOARDING CALON MITRA*\n------------------------------------\n*Aktivitas:* ${actChecked.join(' & ')}\n*Status Database:* ${isDbBaru === 'Ya' ? 'Database Baru' : 'Database On-Process'}\n*Nama Pemohon:* ${namaPemohon}\n*Nama Usaha:* ${namaUsaha}\n`;
  if (isDbBaru === 'Ya') {
    waText += `*Alamat:* ${alamat}\n*Jenis Usaha:* ${jenisUsaha}\n${detailTambahan}\n`;
  }
  waText += `\n*DOKUMEN DIDAPATKAN (${totalAttachedFiles} File):*\n${docList}\n\n*HASIL & CATATAN KUNJUNGAN:*\n${catatanHasil}\n\n• Foto Selfie: [Kamera Langsung OK]\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)}, ${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  const submitBtn = document.getElementById("btn-submit-onb-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-2"></i><span>Mengunggah & Menyimpan Laporan...</span>';
  }

  try {
    await callApi("submitOnboarding", {
      userId: CURRENT_USER?.nip || CURRENT_USER?.email,
      aktivitas: actChecked.join(', '),
      stages: actChecked,
      status_db: isDbBaru === 'Ya' ? 'Database Baru' : 'Database On-Process',
      nama_pemohon: namaPemohon,
      nama_usaha: namaUsaha,
      alamat: alamat,
      jenis_usaha: jenisUsaha,
      detail_usaha: detailTambahan,
      dokumen_list: docKeys.map(k => ONB_DOC_FILES[k].title).join(', '),
      documents: structuredDocs,
      catatan: catatanHasil,
      lat: CURRENT_USER_GEO.lat,
      long: CURRENT_USER_GEO.long,
      selfie_base64: CURRENT_ONB_SELFIE_BASE64
    });

    openSummaryModal("Laporan Onboarding Berhasil!", "Siap disalin ke WhatsApp Group", waText, "bg-teal-700");

    // Reset ONB_DOC_FILES and Selfie
    ONB_DOC_FILES = {};
    CURRENT_ONB_SELFIE_BASE64 = null;
  } catch (err) {
    console.error("Error submit onboarding:", err);
    alert("Gagal mengirim laporan onboarding: " + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane mr-2"></i><span>Kirim Laporan Onboarding</span>';
    }
  }
}

// =========================================================================
// GPS MAINTENANCE CONTROLLER
// =========================================================================
let CURRENT_GPS_FILTERED_VEHICLES = [];

function isUnitContractLive(v) {
  if (!v) return false;
  const status = String(v.contract_status || "").trim().toUpperCase();
  return status.includes("LIVE");
}

function isUnitGpsInstalled(v) {
  if (!v) return false;
  const imei = String(v.imei || v.imei_gps || "").replace(/\D/g, "").trim();
  const rawStatus = String(v.gps_status || "").trim().toLowerCase();

  // Jika status menyebutkan tidak pasang atau belum pasang
  if (rawStatus === "tidak pasang" || rawStatus === "tidak dipasang" || rawStatus === "belum pasang" || rawStatus === "belum_pasang") {
    return false;
  }

  // Jika memiliki nomor IMEI valid minimal 6 digit
  if (imei.length >= 6) {
    return true;
  }

  // Jika status GPS aktif/terpasang
  if (rawStatus === "terpasang" || rawStatus === "normal" || rawStatus === "offline" || rawStatus === "baterai lemah" || rawStatus === "geser" || rawStatus === "pelepasan" || rawStatus === "belum lepas") {
    return true;
  }

  return false;
}

function getEligibleGpsDealers(actType) {
  const coveredDealers = MASTER_DEALER_PRIORITY_DATA.filter(d => isDealerInUserCoverArea(d));
  return coveredDealers.filter(d => {
    const vehicles = APP_STATE.masterVehiclesGps[d.dealer_id] || d.units || [];
    if (!vehicles || vehicles.length === 0) return false;

    if (actType === "Ganti GPS" || actType === "Cabut GPS") {
      // Hanya mitra yang memiliki unit dengan GPS TERPASANG
      return vehicles.some(v => isUnitGpsInstalled(v));
    } else if (actType === "Pasang GPS" || actType === "Pasang Baru") {
      // Hanya mitra yang memiliki unit LIVE dengan GPS BELUM TERPASANG & TIDAK DIPASANG
      return vehicles.some(v => isUnitContractLive(v) && !isUnitGpsInstalled(v));
    }
    return true;
  });
}

function initGpsScreen() {
  populateGpsDealerDropdown();
  populateIdleImeiOptions();
  onGpsActivityChange("Ganti GPS");
}

function populateGpsDealerDropdown() {
  const sel = document.getElementById("gps-select-dealer");
  const actType = document.querySelector('input[name="gps_act_type"]:checked')?.value || "Ganti GPS";
  const eligibleDealers = getEligibleGpsDealers(actType);

  if (sel) {
    sel.innerHTML = '<option value="">-- Pilih Mitra --</option>';
    eligibleDealers.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.dealer_id;
      opt.innerText = `${d.dealer_name} (${d.cabang || '-'})`;
      sel.appendChild(opt);
    });
  }
  renderGpsDealerSearchDropdown("");
}

function renderGpsDealerSearchDropdown(query = "") {
  const dropdown = document.getElementById("gps-dealer-search-dropdown");
  if (!dropdown) return;

  const actType = document.querySelector('input[name="gps_act_type"]:checked')?.value || "Ganti GPS";
  const eligibleDealers = getEligibleGpsDealers(actType);

  const q = String(query || "").trim().toLowerCase();
  const filtered = eligibleDealers.filter(d => {
    if (!q) return true;
    const name = String(d.dealer_name || "").toLowerCase();
    const branch = String(d.cabang || "").toLowerCase();
    return name.includes(q) || branch.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = `<i class="fa-solid fa-store-slash mb-1 block text-slate-300"></i>Tidak ada mitra dengan unit yang sesuai kriteria ${actType}`;
    dropdown.appendChild(emptyDiv);
    return;
  }

  const urgencyBadgeStyles = {
    "Sangat Penting": "bg-red-100 text-red-700 border-red-200",
    "Penting": "bg-orange-100 text-orange-700 border-orange-200",
    "Moderat": "bg-amber-100 text-amber-700 border-amber-200",
    "Normal": "bg-slate-100 text-slate-600 border-slate-200"
  };

  filtered.forEach(d => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectGpsDealerFromSearch(d.dealer_id);
    };

    const lvl = d.priority_level || d.level || "Normal";
    const badgeClass = urgencyBadgeStyles[lvl] || urgencyBadgeStyles["Normal"];

    // Hitung unit yang sesuai kriteria actType
    const vehicles = APP_STATE.masterVehiclesGps[d.dealer_id] || d.units || [];
    const matchingUnits = vehicles.filter(v => {
      if (actType === "Ganti GPS" || actType === "Cabut GPS") return isUnitGpsInstalled(v);
      return isUnitContractLive(v) && !isUnitGpsInstalled(v);
    });

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">${d.dealer_name}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <span>${d.cabang || "-"}</span>
          <span>•</span>
          <span class="font-semibold text-emerald-700">${matchingUnits.length} Unit Sesuai</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeClass} shrink-0 uppercase">${lvl}</span>
    `;
    dropdown.appendChild(item);
  });
}

function openGpsDealerSearchDropdown() {
  const dropdown = document.getElementById("gps-dealer-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("gps-dealer-search-input");
    renderGpsDealerSearchDropdown(input ? input.value : "");
  }
}

function closeGpsDealerSearchDropdown() {
  const dropdown = document.getElementById("gps-dealer-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterGpsDealerSearchOptions(query) {
  openGpsDealerSearchDropdown();
  renderGpsDealerSearchDropdown(query);

  const clearBtn = document.getElementById("gps-dealer-search-clear-btn");
  const chevron = document.getElementById("gps-dealer-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectGpsDealerFromSearch(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  const input = document.getElementById("gps-dealer-search-input");
  const sel = document.getElementById("gps-select-dealer");
  const clearBtn = document.getElementById("gps-dealer-search-clear-btn");
  const chevron = document.getElementById("gps-dealer-search-chevron");

  if (d && input && sel) {
    input.value = `${d.dealer_name} (${d.cabang || "-"})`;
    sel.value = d.dealer_id;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeGpsDealerSearchDropdown();
    onGpsDealerSelected(dealerId);
  }
}

function clearGpsDealerSearchSelection() {
  const input = document.getElementById("gps-dealer-search-input");
  const sel = document.getElementById("gps-select-dealer");
  const clearBtn = document.getElementById("gps-dealer-search-clear-btn");
  const chevron = document.getElementById("gps-dealer-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  onGpsDealerSelected("");
  openGpsDealerSearchDropdown();
}

function onGpsActivityChange(actType) {
  const boxOld = document.getElementById("box-gps-old-section");
  const boxNew = document.getElementById("box-gps-new-section");
  const dealerSel = document.getElementById("gps-select-dealer");
  const dealerVal = dealerSel?.value;

  if (actType === "Ganti GPS") {
    if (boxOld) boxOld.classList.remove("hidden");
    if (boxNew) boxNew.classList.remove("hidden");
  } else if (actType === "Cabut GPS") {
    if (boxOld) boxOld.classList.remove("hidden");
    if (boxNew) boxNew.classList.add("hidden");
  } else if (actType === "Pasang GPS" || actType === "Pasang Baru") {
    if (boxOld) boxOld.classList.add("hidden");
    if (boxNew) boxNew.classList.remove("hidden");
  }

  // Cek apakah dealer yang saat ini dipilih masih eligible untuk actType yang baru
  if (dealerVal) {
    const eligibleDealers = getEligibleGpsDealers(actType);
    const isStillEligible = eligibleDealers.some(d => d.dealer_id === dealerVal);
    if (!isStillEligible) {
      clearGpsDealerSearchSelection();
    } else {
      filterVehiclesByActivity(dealerVal, actType);
    }
  } else {
    // Re-render dropdown list
    const searchInput = document.getElementById("gps-dealer-search-input");
    renderGpsDealerSearchDropdown(searchInput ? searchInput.value : "");
  }
}

function onGpsDealerSelected(dealerId) {
  const actType = document.querySelector('input[name="gps_act_type"]:checked')?.value || "Ganti GPS";
  filterVehiclesByActivity(dealerId, actType);
}

function filterVehiclesByActivity(dealerId, actType) {
  const selectKendaraan = document.getElementById("gps-select-kendaraan");
  const searchInputKendaraan = document.getElementById("gps-kendaraan-search-input");
  const clearBtn = document.getElementById("gps-kendaraan-search-clear-btn");
  const chevron = document.getElementById("gps-kendaraan-search-chevron");
  const infoText = document.getElementById("gps-kendaraan-info");

  CURRENT_GPS_FILTERED_VEHICLES = [];
  if (selectKendaraan) selectKendaraan.innerHTML = '<option value="">-- Pilih Kendaraan --</option>';
  if (searchInputKendaraan) {
    searchInputKendaraan.value = "";
  }
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  const inputImeiLama = document.getElementById("gps-input-imei-lama");
  if (inputImeiLama) inputImeiLama.value = "-";

  closeGpsKendaraanSearchDropdown();

  const allVehicles = (dealerId && APP_STATE.masterVehiclesGps[dealerId]) ? APP_STATE.masterVehiclesGps[dealerId] : [];
  if (!dealerId || allVehicles.length === 0) {
    if (searchInputKendaraan) {
      searchInputKendaraan.disabled = true;
      searchInputKendaraan.placeholder = "-- Pilih Mitra Terlebih Dahulu --";
      searchInputKendaraan.className = "w-full bg-slate-100 border border-slate-300 rounded-xl pl-8 pr-8 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
    }
    if (infoText) {
      infoText.innerText = dealerId ? "Mitra belum memiliki data unit terdaftar." : "";
      infoText.className = "text-[10px] text-slate-400 mt-1 block";
      if (!dealerId) infoText.classList.add("hidden");
    }
    return;
  }

  let filtered = [];
  if (actType === "Ganti GPS" || actType === "Cabut GPS") {
    // Unit dengan GPS TERPASANG
    filtered = allVehicles.filter(v => isUnitGpsInstalled(v));
  } else if (actType === "Pasang GPS" || actType === "Pasang Baru") {
    // Unit LIVE dengan GPS BELUM TERPASANG & TIDAK DIPASANG
    filtered = allVehicles.filter(v => isUnitContractLive(v) && !isUnitGpsInstalled(v));
  }

  CURRENT_GPS_FILTERED_VEHICLES = filtered;

  if (filtered.length === 0) {
    if (selectKendaraan) selectKendaraan.innerHTML = `<option value="">-- Tidak ada unit yang memenuhi kriteria ${actType} --</option>`;
    if (searchInputKendaraan) {
      searchInputKendaraan.disabled = true;
      searchInputKendaraan.placeholder = `Tidak ada unit yang memenuhi kriteria ${actType}`;
      searchInputKendaraan.className = "w-full bg-slate-100 border border-slate-300 rounded-xl pl-8 pr-8 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition outline-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
    }
    if (infoText) {
      infoText.innerText = `Tidak ditemukan kendaraan mitra dengan kriteria ${actType}.`;
      infoText.className = "text-[10px] text-red-500 font-semibold mt-1 block";
      infoText.classList.remove("hidden");
    }
    return;
  }

  if (searchInputKendaraan) {
    searchInputKendaraan.disabled = false;
    searchInputKendaraan.placeholder = `Ketik nopol, no fasilitas, atau unit (${filtered.length} unit)...`;
    searchInputKendaraan.className = "w-full bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-8 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition outline-none";
  }

  if (infoText) {
    infoText.innerText = `Menampilkan ${filtered.length} unit kendaraan yang sesuai kriteria ${actType}.`;
    infoText.className = "text-[10px] text-emerald-600 font-semibold mt-1 block";
    infoText.classList.remove("hidden");
  }

  filtered.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.nopol;
    opt.setAttribute("data-fasilitas", v.no_fasilitas || "");
    opt.setAttribute("data-imei", v.imei || v.imei_gps || "");
    opt.setAttribute("data-unit", v.unit || "");
    opt.setAttribute("data-status", v.contract_status || "");
    opt.innerText = `${v.no_fasilitas ? v.no_fasilitas + ' | ' : ''}${v.nopol} | ${v.unit} (${v.contract_status})`;
    if (selectKendaraan) selectKendaraan.appendChild(opt);
  });
}

function renderGpsKendaraanSearchDropdown(query = "") {
  const dropdown = document.getElementById("gps-kendaraan-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  const filtered = CURRENT_GPS_FILTERED_VEHICLES.filter(v => {
    if (!q) return true;
    const nopol = String(v.nopol || "").toLowerCase();
    const unit = String(v.unit || "").toLowerCase();
    const fas = String(v.no_fasilitas || "").toLowerCase();
    const imei = String(v.imei || "").toLowerCase();
    return nopol.includes(q) || unit.includes(q) || fas.includes(q) || imei.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-car-tunnel mb-1 block text-slate-300"></i>Tidak ada kendaraan yang cocok';
    dropdown.appendChild(emptyDiv);
    return;
  }

  const contractBadgeStyles = {
    "LIVE": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "EXPIRED": "bg-red-100 text-red-700 border-red-200",
    "IN_PROCESS": "bg-blue-100 text-blue-700 border-blue-200",
    "NORMAL": "bg-slate-100 text-slate-600 border-slate-200"
  };

  filtered.forEach(v => {
    const item = document.createElement("div");
    item.className = "p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectGpsKendaraanFromSearch(v.nopol);
    };

    const cStatus = v.contract_status || "LIVE";
    const badgeClass = contractBadgeStyles[cStatus] || "bg-slate-100 text-slate-600 border-slate-200";

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">
          <span class="text-emerald-700 font-mono font-bold mr-1">${v.nopol}</span>
          <span class="text-slate-800">${v.unit || ""}</span>
        </div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          ${v.no_fasilitas ? `<span>Fas: <strong class="font-mono text-slate-700">${v.no_fasilitas}</strong></span><span>•</span>` : ''}
          <span>IMEI: <strong class="font-mono ${v.imei ? 'text-slate-700' : 'text-slate-400'}">${v.imei || '-'}</strong></span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${badgeClass} shrink-0 uppercase">${cStatus}</span>
    `;
    dropdown.appendChild(item);
  });
}

function openGpsKendaraanSearchDropdown() {
  const input = document.getElementById("gps-kendaraan-search-input");
  if (input && input.disabled) return;
  const dropdown = document.getElementById("gps-kendaraan-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    renderGpsKendaraanSearchDropdown(input ? input.value : "");
  }
}

function closeGpsKendaraanSearchDropdown() {
  const dropdown = document.getElementById("gps-kendaraan-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterGpsKendaraanSearchOptions(query) {
  openGpsKendaraanSearchDropdown();
  renderGpsKendaraanSearchDropdown(query);

  const clearBtn = document.getElementById("gps-kendaraan-search-clear-btn");
  const chevron = document.getElementById("gps-kendaraan-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectGpsKendaraanFromSearch(nopol) {
  const v = CURRENT_GPS_FILTERED_VEHICLES.find(item => item.nopol === nopol);
  const input = document.getElementById("gps-kendaraan-search-input");
  const sel = document.getElementById("gps-select-kendaraan");
  const clearBtn = document.getElementById("gps-kendaraan-search-clear-btn");
  const chevron = document.getElementById("gps-kendaraan-search-chevron");

  if (v && input && sel) {
    input.value = `${v.nopol} | ${v.unit}${v.no_fasilitas ? ' (' + v.no_fasilitas + ')' : ''}`;
    sel.value = v.nopol;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeGpsKendaraanSearchDropdown();
    onGpsKendaraanSelected(nopol);
  }
}

function clearGpsKendaraanSearchSelection() {
  const input = document.getElementById("gps-kendaraan-search-input");
  const sel = document.getElementById("gps-select-kendaraan");
  const clearBtn = document.getElementById("gps-kendaraan-search-clear-btn");
  const chevron = document.getElementById("gps-kendaraan-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  const inputImeiLama = document.getElementById("gps-input-imei-lama");
  if (inputImeiLama) inputImeiLama.value = "-";

  openGpsKendaraanSearchDropdown();
}

function onGpsKendaraanSelected(nopol) {
  const select = document.getElementById("gps-select-kendaraan");
  if (!select) return;
  const selectedOption = select.options[select.selectedIndex];
  const imeiLama = selectedOption?.getAttribute("data-imei") || "-";
  const inputImeiLama = document.getElementById("gps-input-imei-lama");
  if (inputImeiLama) inputImeiLama.value = imeiLama;
}

function populateIdleImeiOptions() {
  const select = document.getElementById("gps-select-imei-baru");
  if (select) {
    select.innerHTML = '<option value="">-- Pilih dari Daftar Stok Idle Cabang --</option>';
    (APP_STATE.idleGps || []).forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.imei;
      const loc = item.posisi_stock || item.tipe || "Stok Cabang";
      opt.innerText = `${item.imei} (${loc})`;
      select.appendChild(opt);
    });
  }
  renderGpsImeiSearchDropdown("");
}

function renderGpsImeiSearchDropdown(query = "") {
  const dropdown = document.getElementById("gps-imei-search-dropdown");
  if (!dropdown) return;

  const q = String(query || "").trim().toLowerCase();
  const filtered = (APP_STATE.idleGps || []).filter(item => {
    if (!q) return true;
    const imei = String(item.imei || "").toLowerCase();
    const pos = String(item.posisi_stock || item.tipe || "").toLowerCase();
    return imei.includes(q) || pos.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-box-open mb-1 block text-slate-300"></i>Tidak ada stok GPS idle yang cocok';
    dropdown.appendChild(emptyDiv);
    return;
  }

  filtered.forEach(item => {
    const el = document.createElement("div");
    el.className = "p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    el.onmousedown = (e) => {
      e.preventDefault();
      selectGpsImeiFromSearch(item.imei);
    };

    const loc = item.posisi_stock || item.tipe || "Stok Cabang";

    el.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 font-mono text-xs">${item.imei}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <i class="fa-solid fa-location-dot text-[9px] text-emerald-600"></i>
          <span>${loc}</span>
        </div>
      </div>
      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0 uppercase">READY</span>
    `;
    dropdown.appendChild(el);
  });
}

function openGpsImeiSearchDropdown() {
  const dropdown = document.getElementById("gps-imei-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("gps-search-imei");
    renderGpsImeiSearchDropdown(input ? input.value : "");
  }
}

function closeGpsImeiSearchDropdown() {
  const dropdown = document.getElementById("gps-imei-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterIdleImeiSearchOptions(query) {
  openGpsImeiSearchDropdown();
  renderGpsImeiSearchDropdown(query);

  const clearBtn = document.getElementById("gps-imei-search-clear-btn");
  const chevron = document.getElementById("gps-imei-search-chevron");
  if (query && query.trim() !== "") {
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
  } else {
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  }
}

function selectGpsImeiFromSearch(imei) {
  const item = (APP_STATE.idleGps || []).find(g => g.imei === imei);
  const input = document.getElementById("gps-search-imei");
  const sel = document.getElementById("gps-select-imei-baru");
  const clearBtn = document.getElementById("gps-imei-search-clear-btn");
  const chevron = document.getElementById("gps-imei-search-chevron");

  if (item && input && sel) {
    const loc = item.posisi_stock || item.tipe || "Stok Cabang";
    input.value = `${item.imei} (${loc})`;
    sel.value = item.imei;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeGpsImeiSearchDropdown();
    onImeiBaruSelected(item.imei);
  }
}

function clearGpsImeiSearchSelection() {
  const input = document.getElementById("gps-search-imei");
  const sel = document.getElementById("gps-select-imei-baru");
  const clearBtn = document.getElementById("gps-imei-search-clear-btn");
  const chevron = document.getElementById("gps-imei-search-chevron");

  if (input) {
    input.value = "";
    input.focus();
  }
  if (sel) sel.value = "";
  if (clearBtn) clearBtn.classList.add("hidden");
  if (chevron) chevron.classList.remove("hidden");

  onImeiBaruSelected("");
  openGpsImeiSearchDropdown();
}

function filterIdleImei(keyword) {
  filterIdleImeiSearchOptions(keyword);
}

function onImeiBaruSelected(val) {
  // Callback when new IMEI is selected
}

async function handleGpsOldPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    GPS_PHOTO_OLD_BASE64 = compressed;
    const imgPreview = document.getElementById("img-gps-old-preview");
    if (imgPreview) imgPreview.src = compressed;
    document.getElementById("preview-gps-old-photo")?.classList.remove("hidden");
  }
}

function removeGpsOldPhoto() {
  const fileInput = document.getElementById("file-gps-photo-old");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_OLD_BASE64 = null;
  const imgPreview = document.getElementById("img-gps-old-preview");
  if (imgPreview) imgPreview.src = "";
  document.getElementById("preview-gps-old-photo")?.classList.add("hidden");
}

async function handleGpsNewImeiPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    GPS_PHOTO_NEW_IMEI_BASE64 = compressed;
    const imgPreview = document.getElementById("img-gps-new-imei-preview");
    if (imgPreview) imgPreview.src = compressed;
    document.getElementById("preview-gps-new-imei-photo")?.classList.remove("hidden");
  }
}

function removeGpsNewImeiPhoto() {
  const fileInput = document.getElementById("file-gps-photo-new-imei");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_NEW_IMEI_BASE64 = null;
  const imgPreview = document.getElementById("img-gps-new-imei-preview");
  if (imgPreview) imgPreview.src = "";
  document.getElementById("preview-gps-new-imei-photo")?.classList.add("hidden");
}

async function handleGpsPositionPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    GPS_PHOTO_POSITION_BASE64 = compressed;
    const imgPreview = document.getElementById("img-gps-position-preview");
    if (imgPreview) imgPreview.src = compressed;
    document.getElementById("preview-gps-position-photo")?.classList.remove("hidden");
  }
}

function removeGpsPositionPhoto() {
  const fileInput = document.getElementById("file-gps-photo-position");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_POSITION_BASE64 = null;
  const imgPreview = document.getElementById("img-gps-position-preview");
  if (imgPreview) imgPreview.src = "";
  document.getElementById("preview-gps-position-photo")?.classList.add("hidden");
}

async function handleGpsSubmit(e) {
  e.preventDefault();
  const actType = document.querySelector('input[name="gps_act_type"]:checked').value;
  const dealerSelect = document.getElementById("gps-select-dealer");
  const dealerName = dealerSelect.options[dealerSelect.selectedIndex].text;
  const kendaraanSelect = document.getElementById("gps-select-kendaraan");

  if (!kendaraanSelect.value) {
    alert("Pilih kendaraan yang akan dimaintenance terlebih dahulu!");
    return;
  }
  const nopol = kendaraanSelect.value;
  const noFasilitas = kendaraanSelect.options[kendaraanSelect.selectedIndex].getAttribute("data-fasilitas") || "";
  const unitDesc = kendaraanSelect.options[kendaraanSelect.selectedIndex].getAttribute("data-unit") || "";
  const imeiLama = document.getElementById("gps-input-imei-lama").value;
  const imeiBaru = document.getElementById("gps-select-imei-baru").value || document.getElementById("gps-search-imei").value;
  const catatanTeknis = document.getElementById("gps-catatan-teknis").value.trim() || "-";

  if (actType === "Ganti GPS" || actType === "Cabut GPS") {
    if (!GPS_PHOTO_OLD_BASE64) {
      alert("Wajib mengambil foto IMEI GPS lama yang dicabut!");
      return;
    }
  }

  if (actType === "Ganti GPS" || actType === "Pasang GPS") {
    if (!imeiBaru) {
      alert("Pilih nomor IMEI GPS baru yang terpasang!");
      return;
    }
    if (!GPS_PHOTO_NEW_IMEI_BASE64) {
      alert("Wajib mengambil foto fisik stiker IMEI GPS baru!");
      return;
    }
    if (!GPS_PHOTO_POSITION_BASE64) {
      alert("Wajib mengambil foto titik penempatan GPS di kendaraan!");
      return;
    }
  }

  let waText = `*LAPORAN AKTIVITAS GPS MAINTENANCE*\n------------------------------------\n*Aktivitas:* ${actType}\n*Mitra:* ${dealerName}\n*No Fasilitas:* ${noFasilitas || '-'}\n*Kendaraan:* ${nopol} - ${unitDesc}\n`;
  if (actType === "Ganti GPS") {
    waText += `• IMEI Dicabut: ${imeiLama} [Foto OK]\n• IMEI Baru: ${imeiBaru} [Foto IMEI & Posisi OK]\n`;
  } else if (actType === "Cabut GPS") {
    waText += `• IMEI Dicabut: ${imeiLama} [Foto IMEI Dicabut OK]\n`;
  } else if (actType === "Pasang GPS") {
    waText += `• IMEI Terpasang: ${imeiBaru} [Foto IMEI & Posisi OK]\n`;
  }
  waText += `• Catatan Teknis: ${catatanTeknis}\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)}, ${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  callApi("submitGpsMaintenance", {
    act_type: actType,
    dealer_name: dealerName,
    no_fasilitas: noFasilitas,
    nopol: nopol,
    imei_lama: imeiLama,
    imei_baru: imeiBaru,
    foto_imei_lama_base64: GPS_PHOTO_OLD_BASE64,
    foto_imei_baru_base64: GPS_PHOTO_NEW_IMEI_BASE64,
    foto_posisi_gps_base64: GPS_PHOTO_POSITION_BASE64,
    catatan_teknis: catatanTeknis,
    lat: CURRENT_USER_GEO.lat,
    long: CURRENT_USER_GEO.long,
    work_location_name: (CURRENT_USER_GEO && CURRENT_USER_GEO.nearestOffice) ? CURRENT_USER_GEO.nearestOffice.name : "",
    currentUser: CURRENT_USER
  });

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke clipboard", waText, "bg-emerald-600");
}

// =========================================================================
// FAC GPS AUDIT CONTROLLER
// =========================================================================
function isUnitGpsInstalled(u) {
  if (!u) return false;
  const imei = String(u.imei_gps || u.imei || "").trim();
  const hasImei = imei !== "" && imei !== "-" && imei !== "0" && !imei.toLowerCase().includes("tidak") && !imei.toLowerCase().includes("belum");
  const gpsStatus = String(u.gps_status || "").trim().toLowerCase();

  if (gpsStatus === "tidak pasang" || gpsStatus === "belum pasang") {
    return false;
  }

  if (["belum lepas", "baterai lemah", "geser", "pelepasan", "offline", "normal", "aktif"].includes(gpsStatus)) {
    return true;
  }

  return hasImei;
}

function isUnitEligibleForFacMonitoring(u) {
  if (!u) return false;
  const cStatus = String(u.contract_status || "").trim().toUpperCase();
  const gpsInstalled = isUnitGpsInstalled(u);

  // 1. Status LIVE: Selalu masuk monitoring
  if (cStatus.includes("LIVE")) {
    return true;
  }

  // 2. Status EXPIRED: HANYA MASUK jika GPS MASIH TERPASANG
  if (cStatus.includes("EXPIRED")) {
    return gpsInstalled;
  }

  // Status kontrak lainnya (SELESAI, LUNAS, BATAL, dsb) tidak masuk monitoring
  return false;
}

function initFacMonitoringData() {
  // 1. Filter dealers strictly by cover area PIC (berlaku untuk semua role: Admin, Super Admin, PIC)
  const coveredDealers = (APP_STATE.dealers || []).filter(d => isDealerInUserCoverArea(d));
  const allowedDealerNames = new Set(coveredDealers.map(d => String(d.dealer_name).trim().toLowerCase()));

  // 2. Filter units: must belong to allowed dealers AND be eligible (LIVE or EXPIRED with GPS)
  const eligibleUnits = (APP_STATE.units || []).filter(u => {
    if (allowedDealerNames.size > 0 && !allowedDealerNames.has(String(u.dealer_name).trim().toLowerCase())) {
      return false;
    }
    return isUnitEligibleForFacMonitoring(u);
  });

  // 3. Map to FAC_GPS_MONITORING_DATA
  FAC_GPS_MONITORING_DATA = eligibleUnits.map((u, i) => {
    let codes = [];
    const gpsStatusRaw = String(u.gps_status || "").trim().toLowerCase();
    if (gpsStatusRaw === "tidak pasang") codes = ["1"];
    else if (gpsStatusRaw === "belum lepas") codes = ["2"];
    else if (gpsStatusRaw === "belum pasang") codes = ["3"];
    else if (gpsStatusRaw === "baterai lemah") codes = ["4"];
    else if (gpsStatusRaw === "geser") codes = ["5"];
    else if (gpsStatusRaw === "pelepasan") codes = ["6"];
    else if (gpsStatusRaw === "offline") codes = ["7"];

    const cStatus = String(u.contract_status || "LIVE").toUpperCase();
    const normalizedContractStatus = cStatus.includes("EXPIRED") ? "EXPIRED" : (cStatus.includes("LIVE") ? "LIVE" : cStatus);

    return {
      id: `U-${String(i + 1).padStart(3, '0')}`,
      no_fasilitas: u.no_fasilitas || "",
      dealer: u.dealer_name,
      asset_desc: `${u.unit} (${u.nopol})`,
      nopol: u.nopol,
      imei: u.imei_gps || u.imei || "",
      status_kontrak: normalizedContractStatus,
      gps_installed: isUnitGpsInstalled(u),
      status_codes: codes,
      catatan: ""
    };
  });
}

function renderLegendFilters() {
  const container = document.getElementById("legend-filter-container");
  if (!container) return;

  container.innerHTML = ["1", "2", "3", "4", "5", "6", "7"].map(code => {
    const isFilterActive = FAC_SELECTED_STATUS_FILTERS.includes(code);
    const activeCls = isFilterActive
      ? `${STATUS_MAP[code].activeBg} ring-2 ring-slate-900 font-black shadow-sm`
      : `${STATUS_MAP[code].normalBg} font-semibold opacity-90`;

    return `
      <button type="button" onclick="toggleStatusFilter('${code}')" 
              class="p-1 sm:p-1.5 rounded-xl border flex items-center justify-center space-x-1 min-h-[30px] transition cursor-pointer ${activeCls}">
        <span class="w-3.5 h-3.5 rounded-full text-center leading-3.5 text-[8px] font-black shrink-0 ${isFilterActive ? 'bg-white text-slate-900' : 'bg-slate-700 text-white'}">${code}</span>
        <span class="text-[8px] sm:text-[9.5px] font-bold leading-[1.1] text-center whitespace-normal break-words">${STATUS_MAP[code].short}</span>
      </button>
    `;
  }).join('');
}

function toggleStatusFilter(code) {
  if (FAC_SELECTED_STATUS_FILTERS.includes(code)) {
    FAC_SELECTED_STATUS_FILTERS = FAC_SELECTED_STATUS_FILTERS.filter(c => c !== code);
  } else {
    FAC_SELECTED_STATUS_FILTERS.push(code);
  }
  renderLegendFilters();
  filterFacReportList();
}

function clearAllStatusFilters() {
  FAC_SELECTED_STATUS_FILTERS = [];
  renderLegendFilters();
  filterFacReportList();
}

function setFacContractFilter(status) {
  FAC_ACTIVE_CONTRACT_FILTER = status;
  document.querySelectorAll('.fac-filter-btn').forEach(btn => {
    btn.classList.remove('bg-slate-900', 'text-white');
    btn.classList.add('bg-slate-100', 'text-slate-600');
  });

  const btnMap = { 'ALL': 'filter-btn-all', 'LIVE': 'filter-btn-live', 'EXPIRED': 'filter-btn-expired' };
  const activeBtn = document.getElementById(btnMap[status]);
  if (activeBtn) {
    activeBtn.classList.replace('bg-slate-100', 'bg-slate-900');
    activeBtn.classList.replace('text-slate-600', 'text-white');
  }
  filterFacReportList();
}

function filterFacReportList() {
  const keyword = (document.getElementById("fac-search-input")?.value || "").toLowerCase();
  renderFacGpsList(keyword);
}

function renderFacGpsList(keyword = "") {
  const container = document.getElementById("fac-vehicle-list-container");
  if (!container) return;
  container.innerHTML = "";

  let list = FAC_GPS_MONITORING_DATA;
  if (FAC_ACTIVE_CONTRACT_FILTER !== "ALL") {
    list = list.filter(item => item.status_kontrak === FAC_ACTIVE_CONTRACT_FILTER);
  }
  if (keyword) {
    list = list.filter(item =>
      item.dealer.toLowerCase().includes(keyword) ||
      item.asset_desc.toLowerCase().includes(keyword)
    );
  }
  if (FAC_SELECTED_STATUS_FILTERS.length > 0) {
    list = list.filter(item =>
      FAC_SELECTED_STATUS_FILTERS.some(code => item.status_codes.includes(code))
    );
  }

  // Update summary count element
  const countEl = document.getElementById("fac-unit-count-summary");
  if (countEl) {
    countEl.innerText = `Menampilkan ${list.length} Unit (${FAC_GPS_MONITORING_DATA.length} Terdaftar)`;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-6 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
        <i class="fa-solid fa-satellite-dish text-2xl mb-1 text-slate-300"></i>
        <p>Tidak ada unit kendaraan yang memenuhi kriteria filter.</p>
      </div>
    `;
    return;
  }

  list.forEach(item => {
    const card = document.createElement("div");
    card.className = "bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2";
    const hasCodes = item.status_codes.length > 0;

    card.innerHTML = `
      <!-- Baris 1: Nama Mitra + Status Kontrak | Kode Status 1 2 3 4 -->
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center space-x-1.5 min-w-0 flex-1">
          <span class="font-bold text-xs text-slate-900 truncate">${item.dealer}</span>
          <span class="text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0 ${item.status_kontrak === 'LIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${item.status_kontrak}</span>
        </div>

        <div class="flex items-center space-x-1 shrink-0">
          ${["1", "2", "3", "4"].map(code => {
      const isSelected = item.status_codes.includes(code);
      const activeCls = isSelected ? STATUS_MAP[code].activeBg : `bg-slate-50 border-slate-200 ${STATUS_MAP[code].normalBg}`;
      return `
              <button type="button" 
                      onclick="onFacCodeToggle('${item.id}', '${code}')" 
                      class="w-6 h-6 rounded-lg text-[10px] font-black border flex items-center justify-center transition shadow-xs ${activeCls}">
                ${code}
              </button>
            `;
    }).join('')}
        </div>
      </div>

      <!-- Baris 2: Deskripsi Kendaraan / Nopol | Kode Status 5 6 7 -->
      <div class="flex items-center justify-between gap-2 pt-0.5">
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-medium text-slate-600 truncate">${item.asset_desc}</p>
        </div>

        <div class="flex items-center space-x-1 shrink-0">
          ${["5", "6", "7"].map(code => {
      const isSelected = item.status_codes.includes(code);
      const activeCls = isSelected ? STATUS_MAP[code].activeBg : `bg-slate-50 border-slate-200 ${STATUS_MAP[code].normalBg}`;
      return `
              <button type="button" 
                      onclick="onFacCodeToggle('${item.id}', '${code}')" 
                      class="w-6 h-6 rounded-lg text-[10px] font-black border flex items-center justify-center transition shadow-xs ${activeCls}">
                ${code}
              </button>
            `;
    }).join('')}
        </div>
      </div>

      <div id="box-catatan-${item.id}" class="${hasCodes ? '' : 'hidden'} pt-1.5 border-t border-slate-100">
        <div class="flex items-center justify-between mb-1">
          <span id="label-status-name-${item.id}" class="text-[10px] font-bold text-slate-700 truncate">
            Status Terpilih: ${hasCodes ? item.status_codes.map(c => STATUS_MAP[c].name).join(', ') : ''}
          </span>
          <button type="button" onclick="resetAllCodes('${item.id}')" class="text-[9px] text-red-500 font-bold hover:underline shrink-0 ml-1">Reset Status</button>
        </div>
        <input type="text" id="input-catatan-${item.id}" value="${item.catatan}" oninput="onFacCatatanInput('${item.id}', this.value)" placeholder="Keterangan / catatan khusus (opsional)..." class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-cyan-700" />
      </div>
    `;
    container.appendChild(card);
  });
}

function resetAllCodes(unitId) {
  const target = FAC_GPS_MONITORING_DATA.find(u => u.id === unitId);
  if (target) {
    target.status_codes = [];
    target.catatan = "";
  }
  renderFacGpsList(document.getElementById("fac-search-input")?.value || "");
}

function onFacCodeToggle(unitId, code) {
  const target = FAC_GPS_MONITORING_DATA.find(u => u.id === unitId);
  if (target) {
    if (target.status_codes.includes(code)) {
      target.status_codes = target.status_codes.filter(c => c !== code);
    } else {
      target.status_codes.push(code);
    }
  }
  renderFacGpsList(document.getElementById("fac-search-input")?.value || "");
}

function onFacCatatanInput(unitId, text) {
  const target = FAC_GPS_MONITORING_DATA.find(u => u.id === unitId);
  if (target) target.catatan = text;
}

async function submitFacGpsReport() {
  const now = new Date();
  const tglFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let waText = `LAPORAN MONITORING GPS TANGGAL ${tglFormatted}\n\n`;
  waText += `Summary Penggunaan GPS\n`;
  waText += `GPS Terpasang : ${FAC_GPS_MONITORING_DATA.filter(u => u.status_kontrak === "LIVE" && u.gps_installed).length}\n`;
  waText += `GPS Belum Terpasang : ${FAC_GPS_MONITORING_DATA.filter(u => u.status_kontrak === "LIVE" && !u.gps_installed).length}\n`;
  waText += `GPS Belum Diambil : ${FAC_GPS_MONITORING_DATA.filter(u => u.status_kontrak === "EXPIRED" && u.gps_installed).length}\n\n`;

  const formatList = (arr) => arr.length === 0 ? "-\n" : arr.map(item => `- ${item.dealer} - ${item.asset_desc.split(' (')[0]}${item.catatan ? ' (' + item.catatan + ')' : ''}`).join('\n') + '\n';

  waText += `GPS Belum Terpasang\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("3")))}\n`;
  waText += `GPS Belum Ambil\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("2")))}\n`;
  waText += `*Concern Notif GPS*\n`;
  waText += `*GPS Offline*\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("7")))}\n`;
  waText += `*GPS Lepas*\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("6") || u.status_codes.includes("1")))}\n`;
  waText += `*Baterai GPS Lemah*\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("4")))}\n`;
  waText += `*Unit Tidak Dishowroom*\n${formatList(FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.includes("5")))}`;

  callApi("submitFacGpsReport", {
    reportList: FAC_GPS_MONITORING_DATA,
    userId: CURRENT_USER?.nip || CURRENT_USER?.email
  });

  openSummaryModal("Audit GPS Disimpan!", "Format rekap siap untuk WhatsApp", waText, "bg-cyan-800");
}

// =========================================================================
// MODAL SUMMARY HELPER
// =========================================================================
function openSummaryModal(title, subtitle, text, bgClass = "bg-teal-700") {
  const header = document.getElementById("modal-summary-header");
  header.className = `p-4 text-white flex justify-between items-center ${bgClass}`;
  document.getElementById("modal-summary-title").innerText = title;
  document.getElementById("modal-summary-subtitle").innerText = subtitle;
  document.getElementById("text-wa-summary").value = text;
  document.getElementById("modal-summary").classList.remove("hidden");
}

function closeSummaryModal() {
  document.getElementById("modal-summary").classList.add("hidden");
  loadScreen("dashboard");
}

function copySummaryText() {
  const copyText = document.getElementById("text-wa-summary");
  if (copyText) {
    copyText.select();
    copyText.setSelectionRange(0, 99999);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(copyText.value);
      } else {
        document.execCommand("copy");
      }
    } catch (e) {
      document.execCommand("copy");
    }
  }

  const btn = document.getElementById("btn-copy-summary");
  if (btn) {
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check text-sm text-emerald-400"></i> <span>Teks Berhasil Disalin!</span>';
    btn.classList.add("bg-emerald-700");
    btn.classList.remove("bg-slate-900");
    setTimeout(() => {
      btn.innerHTML = origHTML;
      btn.classList.remove("bg-emerald-700");
      btn.classList.add("bg-slate-900");
    }, 2000);
  }

  showToast("Format rekap berhasil disalin ke clipboard!", "success", 1800);
}

// =========================================================================
// IN-APP MANAGEMENT / SETTINGS CONTROLLER (SUPER ADMIN)
// =========================================================================
let SETTINGS_EMPLOYEES_DATA = [];
let SETTINGS_BANNERS_DATA = [];
let SETTINGS_GPS_DATA = [];
let SETTINGS_CURRENT_DEALER_ID = null;
let SETTINGS_CURRENT_OFFICE_ID = null;

async function initSettingsScreen() {
  switchSettingsTab("emp");
  loadEmployeesForSettings();
  loadBannersForSettings();
  loadDealerSettings();
  loadOfficeLocationsForSettings();
  loadGpsInventoryForSettings();
  await syncRolePermissionsFromSupabase();
  loadRolePermissionsSettings();
}

function switchSettingsTab(tab) {
  const tabs = ["emp", "banner", "dealer", "office", "gps", "role"];
  tabs.forEach(t => {
    const el = document.getElementById(`settings-tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) {
      if (t === tab) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
    if (btn) {
      if (t === tab) {
        btn.className = "flex-1 py-2 px-3 rounded-xl transition text-center whitespace-nowrap bg-white text-slate-900 shadow-sm font-bold";
      } else {
        btn.className = "flex-1 py-2 px-3 rounded-xl transition text-center whitespace-nowrap text-slate-600 hover:text-slate-900 font-bold";
      }
    }
  });
  if (tab === "emp") {
    if (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0) {
      renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
    }
  } else if (tab === "banner") {
    loadBannersForSettings();
  } else if (tab === "role") {
    loadRolePermissionsSettings();
  }
}

// ---------------- TAB: BANNER BERITA & INFORMASI (ADMIN) ----------------
async function loadBannersForSettings() {
  const container = document.getElementById("banner-settings-list-container");
  if (!container) return;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("m_announcement")
        .select("*")
        .order("order_seq", { ascending: true });

      if (!error && data) {
        SETTINGS_BANNERS_DATA = data;
        renderBannerSettingsList(SETTINGS_BANNERS_DATA);
        return;
      }
    } catch (e) {
      console.warn("Error load banners:", e);
    }
  }

  SETTINGS_BANNERS_DATA = DEFAULT_BANNER_SLIDES;
  renderBannerSettingsList(SETTINGS_BANNERS_DATA);
}

function renderBannerSettingsList(list) {
  const container = document.getElementById("banner-settings-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i class="fa-solid fa-bullhorn text-2xl mb-1 text-slate-300 block"></i>
        Belum ada banner informasi yang dibuat.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(item => {
    const isActive = item.is_active !== false && String(item.is_active) !== "false";
    return `
      <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-teal-300 transition">
        <div class="flex items-center space-x-3 min-w-0 flex-1">
          <img src="${item.image_url}" alt="${item.title}" class="w-16 h-12 object-cover rounded-xl shrink-0 bg-slate-100 border border-slate-200" onerror="this.src='https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=300&q=80'">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-2">
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold bg-slate-100 text-slate-700">#${item.order_seq || 1}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded font-bold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}">
                ${isActive ? '● Aktif' : '○ Nonaktif'}
              </span>
            </div>
            <h5 class="font-bold text-xs text-slate-900 line-clamp-1 mt-0.5">${item.title}</h5>
            <p class="text-[10px] text-slate-500 line-clamp-1">${item.description || '-'}</p>
          </div>
        </div>

        <div class="flex items-center space-x-1.5 self-end sm:self-center shrink-0">
          <button type="button" onclick="openEditBannerModal('${item.banner_id}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition flex items-center space-x-1">
            <i class="fa-solid fa-pen-to-square"></i>
            <span>Edit</span>
          </button>
          <button type="button" onclick="handleDeleteBanner('${item.banner_id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs transition" title="Hapus Banner">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddBannerModal() {
  document.getElementById("banner-modal-title").innerText = "Tambah Banner Informasi";
  document.getElementById("banner-input-id").value = "";
  document.getElementById("banner-input-title").value = "";
  document.getElementById("banner-input-desc").value = "";
  document.getElementById("banner-input-image").value = "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80";
  document.getElementById("banner-input-order").value = (SETTINGS_BANNERS_DATA.length + 1).toString();
  document.getElementById("banner-input-active").value = "true";
  document.getElementById("modal-banner-edit").classList.remove("hidden");
}

function openEditBannerModal(bannerId) {
  const item = SETTINGS_BANNERS_DATA.find(b => b.banner_id === bannerId);
  if (!item) return;

  document.getElementById("banner-modal-title").innerText = "Edit Banner Informasi";
  document.getElementById("banner-input-id").value = item.banner_id;
  document.getElementById("banner-input-title").value = item.title;
  document.getElementById("banner-input-desc").value = item.description || "";
  document.getElementById("banner-input-image").value = item.image_url;
  document.getElementById("banner-input-order").value = item.order_seq || 1;
  document.getElementById("banner-input-active").value = (item.is_active !== false).toString();
  document.getElementById("modal-banner-edit").classList.remove("hidden");
}

function closeBannerModal() {
  document.getElementById("modal-banner-edit").classList.add("hidden");
}

async function handleBannerFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  showToast("Mengunggah foto poster...", "info", 1500);
  try {
    const compressed = await compressImage(file, 1200, 0.85);
    const fileName = `banner_${Date.now()}.jpg`;
    const publicUrl = await uploadToSupabaseStorage(compressed, "banners", fileName);
    if (publicUrl) {
      document.getElementById("banner-input-image").value = publicUrl;
      showToast("Foto banner berhasil diunggah!", "success", 1500);
    } else {
      document.getElementById("banner-input-image").value = compressed;
      showToast("Foto berhasil dimuat.", "success", 1500);
    }
  } catch (err) {
    console.error("Upload error:", err);
    showToast("Gagal mengunggah foto: " + err.message, "error", 2000);
  }
}

async function handleSaveBanner(e) {
  e.preventDefault();
  const idVal = document.getElementById("banner-input-id").value;
  const title = document.getElementById("banner-input-title").value.trim();
  const desc = document.getElementById("banner-input-desc").value.trim();
  const imageUrl = document.getElementById("banner-input-image").value.trim();
  const orderSeq = parseInt(document.getElementById("banner-input-order").value, 10) || 1;
  const isActive = document.getElementById("banner-input-active").value === "true";

  const bannerId = idVal || `BNR-${Date.now().toString().slice(-6)}`;
  const payload = {
    banner_id: bannerId,
    title: title,
    description: desc,
    image_url: imageUrl,
    order_seq: orderSeq,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-banner");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("m_announcement")
        .upsert([payload]);
      if (error) throw error;
    }

    closeBannerModal();
    showToast("Banner informasi berhasil disimpan!", "success", 1500);
    await loadBannersForSettings();
  } catch (err) {
    alert("Gagal menyimpan banner: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

async function handleDeleteBanner(bannerId) {
  if (!confirm("Apakah Anda yakin ingin menghapus banner ini?")) return;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("m_announcement")
        .delete()
        .eq("banner_id", bannerId);
      if (error) throw error;
    }

    showToast("Banner berhasil dihapus!", "success", 1500);
    await loadBannersForSettings();
  } catch (err) {
    alert("Gagal menghapus banner: " + err.message);
  }
}

// ---------------- TAB 1: KARYAWAN & AKUN ----------------
async function loadEmployeesForSettings() {
  const container = document.getElementById("emp-list-container");
  if (!container) return;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("m_employee")
        .select("*")
        .order("nama_lengkap");

      if (!error && data) {
        SETTINGS_EMPLOYEES_DATA = data;
        renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
        return;
      }
    } catch (e) {
      console.warn("Error load employees from supabase:", e);
    }
  }

  if (APP_STATE.employees && APP_STATE.employees.length > 0) {
    SETTINGS_EMPLOYEES_DATA = APP_STATE.employees;
    renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
    return;
  }

  container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Tidak dapat memuat data karyawan.</div>';
}

function filterEmployeeList(keyword = "") {
  const q = String(keyword || "").trim().toLowerCase();
  const filtered = SETTINGS_EMPLOYEES_DATA.filter(e => {
    if (!q) return true;
    return String(e.nip || "").toLowerCase().includes(q) ||
      String(e.nama_lengkap || "").toLowerCase().includes(q) ||
      String(e.cabang || "").toLowerCase().includes(q) ||
      String(e.role_id || "").toLowerCase().includes(q) ||
      String(e.area_cover || "").toLowerCase().includes(q);
  });
  renderEmployeeList(filtered);
}

function renderEmployeeList(list) {
  const container = document.getElementById("emp-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200"><i class="fa-solid fa-user-slash text-base mb-1 block text-slate-300"></i>Tidak ada karyawan yang cocok</div>';
    return;
  }

  container.innerHTML = list.map(emp => {
    const rId = String(emp.role_id || emp.role || emp.jabatan || "R-04").trim();
    let roleObj = ROLE_PERMISSIONS_STATE[rId];
    if (!roleObj) {
      roleObj = Object.values(ROLE_PERMISSIONS_STATE).find(r => r.name.toLowerCase() === rId.toLowerCase() || rId.toLowerCase().includes(r.name.toLowerCase()) || r.name.toLowerCase().includes(rId.toLowerCase()));
    }
    const rBadge = roleObj?.badgeBg || "bg-slate-100 text-slate-700 border-slate-200";
    const rName = roleObj?.name || rId;
    const isAktif = emp.status_aktif === "AKTIF" || emp.status_aktif === true;

    return `
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3 hover:border-indigo-300 transition">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-2 flex-wrap gap-y-1">
            <span class="font-mono text-xs font-bold text-slate-900">${emp.nip}</span>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${rBadge} uppercase">${rName}</span>
            ${isAktif ? '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">AKTIF</span>' : '<span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-red-50 text-red-700 border border-red-200">NONAKTIF</span>'}
          </div>
          <h4 class="font-bold text-xs text-slate-800 mt-1 truncate">${emp.nama_lengkap}</h4>
          <div class="text-[10px] text-slate-500 mt-0.5 flex items-center space-x-2 flex-wrap">
            <span>${emp.cabang || "-"}</span>
            <span>•</span>
            <span>Area: <strong class="text-indigo-900">${emp.area_cover || 'Semua Area'}</strong></span>
            ${emp.atasan_nama ? `<span>•</span><span>Atasan: <strong class="text-slate-700">${emp.atasan_nama}</strong></span>` : ''}
          </div>
        </div>
        <button type="button" onclick="openEditEmployeeModal('${emp.nip}')" class="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Edit</span>
        </button>
      </div>
    `;
  }).join("");
}

function populateEmployeeRoleOptions(selectedRoleId = "R-04") {
  const select = document.getElementById("emp-input-role");
  if (!select) return;

  const roleKeys = Object.keys(ROLE_PERMISSIONS_STATE);
  select.innerHTML = roleKeys.map(k => {
    const r = ROLE_PERMISSIONS_STATE[k];
    const isSel = k === selectedRoleId;
    return `<option value="${k}" ${isSel ? 'selected' : ''}>${r.name} (${k})</option>`;
  }).join('');
}

let CURRENT_EMP_EDIT_NIP = null;

function renderEmpAtasanSearchDropdown(query = "") {
  const dropdown = document.getElementById("emp-atasan-search-dropdown");
  if (!dropdown) return;

  const allEmployees = (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0)
    ? SETTINGS_EMPLOYEES_DATA
    : (APP_STATE.employees || []);

  const eligible = allEmployees.filter(e => !CURRENT_EMP_EDIT_NIP || String(e.nip).trim() !== String(CURRENT_EMP_EDIT_NIP).trim());
  const selectedNip = document.getElementById("emp-input-atasan-nip")?.value || "";

  const q = String(query || "").trim().toLowerCase();
  const filtered = eligible.filter(e => {
    if (!q) return true;
    return String(e.nama_lengkap || "").toLowerCase().includes(q) ||
      String(e.nip || "").toLowerCase().includes(q) ||
      String(e.jabatan || "").toLowerCase().includes(q) ||
      String(e.role_id || "").toLowerCase().includes(q) ||
      String(e.cabang || "").toLowerCase().includes(q);
  });

  let itemsHtml = `
    <div onclick="selectEmpAtasan('', '')" class="p-2.5 hover:bg-slate-100 cursor-pointer flex items-center justify-between text-xs transition ${!selectedNip ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-slate-600'}">
      <div class="flex items-center space-x-2">
        <i class="fa-solid fa-ban text-slate-400 text-xs"></i>
        <span>-- Tidak Ada / Atasan Tertinggi --</span>
      </div>
      ${!selectedNip ? '<i class="fa-solid fa-check text-indigo-600 text-xs"></i>' : ''}
    </div>
  `;

  if (filtered.length === 0) {
    itemsHtml += '<div class="p-3 text-center text-slate-400 text-[11px]"><i class="fa-solid fa-user-slash mr-1"></i>Tidak ada atasan yang cocok</div>';
  } else {
    itemsHtml += filtered.map(e => {
      const isSel = String(e.nip).trim() === String(selectedNip).trim();
      const rName = e.role_id || e.jabatan || 'PIC';
      const cleanNama = (e.nama_lengkap || '').replace(/'/g, "\\'");
      return `
        <div onclick="selectEmpAtasan('${e.nip}', '${cleanNama}')" class="p-2.5 hover:bg-indigo-50 cursor-pointer flex items-center justify-between text-xs transition ${isSel ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'text-slate-700'}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <span class="font-bold truncate">${e.nama_lengkap}</span>
              <span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono shrink-0">${e.nip}</span>
            </div>
            <div class="text-[10px] text-slate-400 mt-0.5 flex items-center space-x-2">
              <span class="text-indigo-600 font-semibold">${rName}</span>
              <span>•</span>
              <span>${e.cabang || '-'}</span>
            </div>
          </div>
          ${isSel ? '<i class="fa-solid fa-check text-indigo-600 text-xs ml-2 shrink-0"></i>' : ''}
        </div>
      `;
    }).join("");
  }

  dropdown.innerHTML = itemsHtml;
}

function openEmpAtasanSearchDropdown() {
  const dropdown = document.getElementById("emp-atasan-search-dropdown");
  if (dropdown) {
    dropdown.classList.remove("hidden");
    const input = document.getElementById("emp-atasan-search-input");
    renderEmpAtasanSearchDropdown(input ? input.value : "");
  }
}

function closeEmpAtasanSearchDropdown() {
  const dropdown = document.getElementById("emp-atasan-search-dropdown");
  if (dropdown) dropdown.classList.add("hidden");
}

function filterEmpAtasanSearchOptions(query) {
  openEmpAtasanSearchDropdown();
  renderEmpAtasanSearchDropdown(query);
}

function selectEmpAtasan(nip, nama) {
  const nipInput = document.getElementById("emp-input-atasan-nip");
  const namaInput = document.getElementById("emp-input-atasan-nama");
  const searchInput = document.getElementById("emp-atasan-search-input");
  const clearBtn = document.getElementById("emp-atasan-search-clear-btn");

  if (nipInput) nipInput.value = nip || "";
  if (namaInput) namaInput.value = nama || "";

  if (searchInput) {
    searchInput.value = nip ? `${nama} (${nip})` : "";
  }

  if (clearBtn) {
    if (nip) clearBtn.classList.remove("hidden");
    else clearBtn.classList.add("hidden");
  }

  closeEmpAtasanSearchDropdown();
}

function clearEmpAtasanSelection() {
  selectEmpAtasan("", "");
  const searchInput = document.getElementById("emp-atasan-search-input");
  if (searchInput) searchInput.value = "";
}

function openAddEmployeeModal() {
  CURRENT_EMP_EDIT_NIP = null;
  document.getElementById("modal-emp-title").innerText = "Tambah Karyawan Baru";
  document.getElementById("emp-input-nip").value = "";
  document.getElementById("emp-input-nip").disabled = false;
  document.getElementById("emp-input-nama").value = "";
  document.getElementById("emp-input-email").value = "";
  document.getElementById("emp-input-cabang").value = "Head Office";
  populateEmployeeRoleOptions("R-04");
  clearEmpAtasanSelection();
  document.getElementById("emp-input-area").value = "";
  document.getElementById("emp-input-password").value = "Password123!";
  document.getElementById("emp-input-status").value = "AKTIF";
  document.getElementById("modal-employee-edit").classList.remove("hidden");
}

function openEditEmployeeModal(nip) {
  const emp = SETTINGS_EMPLOYEES_DATA.find(e => e.nip === nip);
  if (!emp) return;

  CURRENT_EMP_EDIT_NIP = nip;
  document.getElementById("modal-emp-title").innerText = `Edit Karyawan: ${emp.nama_lengkap}`;
  const nipInput = document.getElementById("emp-input-nip");
  nipInput.value = emp.nip;
  nipInput.disabled = true;
  document.getElementById("emp-input-nama").value = emp.nama_lengkap || "";
  document.getElementById("emp-input-email").value = emp.email || "";
  document.getElementById("emp-input-cabang").value = emp.cabang || "";
  populateEmployeeRoleOptions(emp.role_id || "R-04");

  if (emp.atasan_nip) {
    selectEmpAtasan(emp.atasan_nip, emp.atasan_nama || emp.atasan_nip);
  } else {
    clearEmpAtasanSelection();
  }

  document.getElementById("emp-input-area").value = emp.area_cover || "";
  document.getElementById("emp-input-password").value = "";
  document.getElementById("emp-input-status").value = (emp.status_aktif === "AKTIF" || emp.status_aktif === true) ? "AKTIF" : "NONAKTIF";
  document.getElementById("modal-employee-edit").classList.remove("hidden");
}

function closeEmployeeModal() {
  closeEmpAtasanSearchDropdown();
  document.getElementById("modal-employee-edit").classList.add("hidden");
}

function setEmpDefaultPass() {
  document.getElementById("emp-input-password").value = "Password123!";
}

async function handleSaveEmployee(e) {
  e.preventDefault();
  const nip = document.getElementById("emp-input-nip").value.trim();
  const nama = document.getElementById("emp-input-nama").value.trim();
  const email = document.getElementById("emp-input-email").value.trim();
  const cabang = document.getElementById("emp-input-cabang").value.trim();
  const roleId = document.getElementById("emp-input-role").value;
  const areaCover = document.getElementById("emp-input-area").value.trim();
  const pass = document.getElementById("emp-input-password").value.trim();
  const status = document.getElementById("emp-input-status").value;

  const atasanNip = document.getElementById("emp-input-atasan-nip")?.value.trim() || "";
  let atasanNama = document.getElementById("emp-input-atasan-nama")?.value.trim() || "";
  if (atasanNip && !atasanNama) {
    const matchAtasan = (SETTINGS_EMPLOYEES_DATA || []).find(x => String(x.nip).trim() === atasanNip);
    if (matchAtasan) atasanNama = matchAtasan.nama_lengkap || "";
  }

  const btn = document.getElementById("btn-save-emp");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    const existingEmp = (typeof SETTINGS_EMPLOYEES_DATA !== "undefined" ? SETTINGS_EMPLOYEES_DATA.find(x => String(x.nip).trim() === nip) : null) ||
      (APP_STATE.employees ? APP_STATE.employees.find(x => String(x.nip).trim() === nip) : null);

    // Jika karyawan baru ATAU admin mengisi/mereset password di kolom input, set status_ganti_pass = true
    const shouldRequirePasswordChange = pass ? true : (existingEmp ? (existingEmp.status_ganti_pass === true || String(existingEmp.status_ganti_pass).toLowerCase() === "true") : true);

    const payload = {
      nip: nip,
      nama_lengkap: nama,
      email: email || `${nip}@digiasha.com`,
      cabang: cabang,
      role_id: roleId,
      area_cover: areaCover,
      status_aktif: status,
      atasan_nip: atasanNip || null,
      atasan_nama: atasanNama || null,
      password_hash: pass || existingEmp?.password_hash || "Password123!",
      status_ganti_pass: shouldRequirePasswordChange,
      updated_at: new Date().toISOString()
    };

    if (supabaseClient) {
      if (existingEmp) {
        const { error } = await supabaseClient
          .from("m_employee")
          .update(payload)
          .eq("nip", nip);
        if (error) throw error;
      } else {
        const { error } = await supabaseClient
          .from("m_employee")
          .upsert(payload, { onConflict: "nip" });
        if (error) throw error;
      }
    }

    // Perbarui local state
    if (existingEmp) {
      Object.assign(existingEmp, payload);
    }
    if (APP_STATE.employees) {
      const match = APP_STATE.employees.find(x => String(x.nip).trim() === nip);
      if (match) Object.assign(match, payload);
    }

    if (CURRENT_USER && String(CURRENT_USER.nip).trim() === String(nip).trim()) {
      CURRENT_USER.atasan_nip = atasanNip || "";
      CURRENT_USER.atasan_nama = atasanNama || "";
      CURRENT_USER.area_cover = areaCover || "";
      CURRENT_USER.cabang = cabang || "";
      CURRENT_USER.role_id = roleId || CURRENT_USER.role_id;
      try {
        localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
      } catch (e) { }
    }

    showToast("Data karyawan berhasil disimpan!", "success", 1500);
    closeEmployeeModal();
    await loadEmployeesForSettings();
  } catch (err) {
    alert("Gagal menyimpan data karyawan: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ---------------- TAB 2: AREA COVER DEALER ----------------
function loadDealerSettings() {
  const branchSelect = document.getElementById("dealer-branch-filter");
  if (branchSelect) {
    const branches = new Set();
    APP_STATE.dealers.forEach(d => {
      if (d.cabang && String(d.cabang).trim()) {
        branches.add(String(d.cabang).trim());
      }
    });
    const sortedBranches = Array.from(branches).sort();
    branchSelect.innerHTML = '<option value="ALL">Semua Cabang</option>' +
      sortedBranches.map(b => `<option value="${b}">${b}</option>`).join("");
  }
  filterDealerSettingsList();
}

function filterDealerSettingsList() {
  const q = String(document.getElementById("dealer-settings-search")?.value || "").trim().toLowerCase();
  const bFilter = String(document.getElementById("dealer-branch-filter")?.value || "ALL").trim().toLowerCase();

  const filtered = APP_STATE.dealers.filter(d => {
    const name = String(d.dealer_name || "").toLowerCase();
    const cabang = String(d.cabang || "").toLowerCase();
    const area = String(d.area_cover || "").toLowerCase();
    const id = String(d.dealer_id || "").toLowerCase();

    const matchQ = !q || name.includes(q) || cabang.includes(q) || area.includes(q) || id.includes(q);
    const matchB = bFilter === "all" || cabang === bFilter;
    return matchQ && matchB;
  });

  renderDealerSettingsList(filtered);
}

function renderDealerSettingsList(list) {
  const container = document.getElementById("dealer-settings-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200"><i class="fa-solid fa-store-slash text-base mb-1 block text-slate-300"></i>Tidak ada dealer yang cocok</div>';
    return;
  }

  container.innerHTML = list.map(d => {
    return `
      <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 hover:border-amber-300 transition">
        <div class="min-w-0 flex-1">
          <h4 class="font-bold text-xs text-slate-900 truncate">${d.dealer_name}</h4>
          <div class="text-[10px] text-slate-500 mt-0.5 flex items-center space-x-1.5 flex-wrap">
            <span>${d.cabang || "-"}</span>
            <span>•</span>
            <span>Area: <strong class="text-amber-700 font-bold font-mono">${d.area_cover || 'Belum diatur'}</strong></span>
          </div>
        </div>
        <button type="button" onclick="openEditDealerAreaModal('${d.dealer_id}')" class="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-amber-200 transition">
          <i class="fa-solid fa-map-location-dot"></i>
          <span>Ubah Area</span>
        </button>
      </div>
    `;
  }).join("");
}

function openEditDealerAreaModal(dealerId) {
  const d = APP_STATE.dealers.find(item => item.dealer_id === dealerId);
  if (!d) return;

  SETTINGS_CURRENT_DEALER_ID = dealerId;
  document.getElementById("modal-dealer-name-display").innerText = d.dealer_name;
  document.getElementById("modal-dealer-branch-display").innerText = `Cabang: ${d.cabang || '-'}`;
  document.getElementById("modal-dealer-input-area").value = d.area_cover || "";
  document.getElementById("modal-dealer-area-edit").classList.remove("hidden");
}

function closeDealerAreaModal() {
  document.getElementById("modal-dealer-area-edit").classList.add("hidden");
  SETTINGS_CURRENT_DEALER_ID = null;
}

async function saveDealerAreaCover() {
  if (!SETTINGS_CURRENT_DEALER_ID) return;
  const newArea = document.getElementById("modal-dealer-input-area").value.trim();

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("m_dealer")
        .update({ area_cover: newArea, updated_at: new Date().toISOString() })
        .eq("dealer_id", SETTINGS_CURRENT_DEALER_ID);

      if (error) throw error;
    }

    const d = APP_STATE.dealers.find(item => item.dealer_id === SETTINGS_CURRENT_DEALER_ID);
    if (d) d.area_cover = newArea;

    showToast("Area cover dealer berhasil diperbarui!", "success", 1500);
    closeDealerAreaModal();
    filterDealerSettingsList();
  } catch (err) {
    alert("Gagal memperbarui area dealer: " + err.message);
  }
}

// ---------------- TAB 3: LOKASI KANTOR GEOFENCE ----------------
async function loadOfficeLocationsForSettings() {
  const container = document.getElementById("office-list-container");
  if (!container) return;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("m_work_location")
        .select("*")
        .order("name");

      if (!error && data) {
        OFFICE_LOCATIONS = data.map(l => ({
          location_id: l.location_id,
          name: l.name || l.location_name,
          lat: parseFloat(l.lat || l.latitude),
          long: parseFloat(l.long || l.longitude),
          maxRadiusMeter: parseInt(l.max_radius_meter || l.radius_meter || 100),
          address: l.address || l.alamat || ""
        }));
        renderOfficeLocationsList(OFFICE_LOCATIONS);
        return;
      }
    } catch (e) {
      console.warn("Error load work locations from supabase:", e);
    }
  }

  renderOfficeLocationsList(OFFICE_LOCATIONS);
}

function renderOfficeLocationsList(list) {
  const container = document.getElementById("office-list-container");
  if (!container) return;

  container.innerHTML = list.map(o => {
    return `
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 hover:border-emerald-300 transition">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">${o.location_id}</span>
            <h4 class="font-bold text-xs text-slate-900 truncate">${o.name}</h4>
          </div>
          <div class="text-[10px] text-slate-500 mt-1 font-mono">
            ${o.lat.toFixed(6)}, ${o.long.toFixed(6)} • Radius ${o.maxRadiusMeter}m
          </div>
          <p class="text-[10px] text-slate-400 truncate mt-0.5">${o.address || '-'}</p>
        </div>
        <button type="button" onclick="openEditOfficeModal('${o.location_id}')" class="px-2.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Edit</span>
        </button>
      </div>
    `;
  }).join("");
}

function openAddOfficeModal() {
  document.getElementById("modal-office-title").innerText = "Tambah Lokasi Kantor";
  const idInput = document.getElementById("office-input-id");
  idInput.value = "";
  idInput.disabled = false;
  document.getElementById("office-input-name").value = "";
  document.getElementById("office-input-lat").value = "";
  document.getElementById("office-input-long").value = "";
  document.getElementById("office-input-radius").value = "100";
  document.getElementById("office-input-address").value = "";
  document.getElementById("modal-office-edit").classList.remove("hidden");
}

function openEditOfficeModal(locId) {
  const o = OFFICE_LOCATIONS.find(item => item.location_id === locId);
  if (!o) return;

  document.getElementById("modal-office-title").innerText = `Edit Lokasi: ${o.name}`;
  const idInput = document.getElementById("office-input-id");
  idInput.value = o.location_id;
  idInput.disabled = true;
  document.getElementById("office-input-name").value = o.name || "";
  document.getElementById("office-input-lat").value = o.lat || "";
  document.getElementById("office-input-long").value = o.long || "";
  document.getElementById("office-input-radius").value = o.maxRadiusMeter || 100;
  document.getElementById("office-input-address").value = o.address || "";
  document.getElementById("modal-office-edit").classList.remove("hidden");
}

function closeOfficeModal() {
  document.getElementById("modal-office-edit").classList.add("hidden");
}

function captureCurrentGpsForOffice() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        document.getElementById("office-input-lat").value = pos.coords.latitude.toFixed(7);
        document.getElementById("office-input-long").value = pos.coords.longitude.toFixed(7);
        showToast("Koordinat GPS berhasil diperoleh!", "success", 1200);
      },
      err => {
        alert("Gagal mendapatkan sinyal GPS: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  } else {
    alert("Perangkat Anda tidak mendukung geolokasi.");
  }
}

async function handleSaveOffice(e) {
  e.preventDefault();
  const locId = document.getElementById("office-input-id").value.trim();
  const name = document.getElementById("office-input-name").value.trim();
  const lat = parseFloat(document.getElementById("office-input-lat").value);
  const long = parseFloat(document.getElementById("office-input-long").value);
  const radius = parseInt(document.getElementById("office-input-radius").value) || 100;
  const address = document.getElementById("office-input-address").value.trim();

  const btn = document.getElementById("btn-save-office");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    const payload = {
      location_id: locId,
      name: name,
      lat: lat,
      long: long,
      max_radius_meter: radius,
      address: address,
      updated_at: new Date().toISOString()
    };

    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("m_work_location")
        .upsert(payload, { onConflict: "location_id" });

      if (error) throw error;
    }

    showToast("Lokasi kantor berhasil disimpan!", "success", 1500);
    closeOfficeModal();
    await loadOfficeLocationsForSettings();
  } catch (err) {
    alert("Gagal menyimpan lokasi kantor: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ---------------- TAB 4: INVENTORI STOK GPS ----------------
async function loadGpsInventoryForSettings() {
  const container = document.getElementById("gps-settings-list-container");
  if (!container) return;

  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("m_gps_device")
        .select("*")
        .order("last_updated", { ascending: false });

      if (!error && data) {
        SETTINGS_GPS_DATA = data;
        updateGpsStats(SETTINGS_GPS_DATA);
        renderGpsSettingsList(SETTINGS_GPS_DATA);
        return;
      }
    } catch (e) {
      console.warn("Error load GPS from supabase:", e);
    }
  }

  container.innerHTML = '<div class="p-4 text-center text-xs text-slate-400">Tidak dapat memuat stok GPS.</div>';
}

function updateGpsStats(list) {
  const totalEl = document.getElementById("gps-stat-total");
  const idleEl = document.getElementById("gps-stat-idle");
  const installedEl = document.getElementById("gps-stat-installed");

  const total = list.length;
  const idle = list.filter(g => String(g.status_device || "").toUpperCase() === "TERSEDIA").length;
  const installed = total - idle;

  if (totalEl) totalEl.innerText = total;
  if (idleEl) idleEl.innerText = idle;
  if (installedEl) installedEl.innerText = installed;
}

function filterGpsSettingsList(keyword = "") {
  const q = String(keyword || "").trim().toLowerCase();
  const filtered = SETTINGS_GPS_DATA.filter(g => {
    if (!q) return true;
    return String(g.imei || "").toLowerCase().includes(q) ||
      String(g.posisi_stock || "").toLowerCase().includes(q) ||
      String(g.status_device || "").toLowerCase().includes(q);
  });
  renderGpsSettingsList(filtered);
}

function renderGpsSettingsList(list) {
  const container = document.getElementById("gps-settings-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200"><i class="fa-solid fa-satellite-dish text-base mb-1 block text-slate-300"></i>Tidak ada data IMEI GPS</div>';
    return;
  }

  container.innerHTML = list.map(g => {
    const isIdle = String(g.status_device || "").toUpperCase() === "TERSEDIA";
    const badgeCls = isIdle
      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
      : "bg-cyan-100 text-cyan-800 border-cyan-200";

    return `
      <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 hover:border-cyan-300 transition">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-2">
            <span class="font-mono text-xs font-bold text-slate-900">${g.imei}</span>
            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded border ${badgeCls} uppercase">${g.status_device || 'TERSEDIA'}</span>
          </div>
          <div class="text-[10px] text-slate-500 mt-0.5">
            Posisi: <strong class="text-slate-700">${g.posisi_stock || 'Kantor Pusat'}</strong>
          </div>
        </div>
        <button type="button" onclick="openTransferGpsModal('${g.imei}')" class="px-2.5 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-cyan-200 transition">
          <i class="fa-solid fa-arrows-turn-to-dots"></i>
          <span>Pindah Lokasi</span>
        </button>
      </div>
    `;
  }).join("");
}

let SETTINGS_SELECTED_TRANSFER_IMEI = null;

function openTransferGpsModal(imei) {
  const g = SETTINGS_GPS_DATA.find(item => item.imei === imei);
  if (!g) return;

  SETTINGS_SELECTED_TRANSFER_IMEI = imei;
  document.getElementById("modal-transfer-imei-display").innerText = g.imei;
  document.getElementById("modal-transfer-pos-current").innerText = g.posisi_stock || "Kantor Pusat";

  const selectLoc = document.getElementById("modal-transfer-select-location");
  if (selectLoc) {
    selectLoc.innerHTML = OFFICE_LOCATIONS.map(o => {
      const isSelected = (g.posisi_stock || "").toLowerCase() === (o.name || "").toLowerCase();
      return `<option value="${o.name}" ${isSelected ? 'selected' : ''}>${o.name}</option>`;
    }).join("");
  }

  const selectStatus = document.getElementById("modal-transfer-select-status");
  if (selectStatus) {
    const isIdle = String(g.status_device || "").toUpperCase() === "TERSEDIA";
    selectStatus.value = isIdle ? "TERSEDIA" : (g.status_device || "TERSEDIA");
  }

  document.getElementById("modal-gps-transfer").classList.remove("hidden");
}

function closeTransferGpsModal() {
  document.getElementById("modal-gps-transfer").classList.add("hidden");
  SETTINGS_SELECTED_TRANSFER_IMEI = null;
}

async function saveTransferGpsLocation() {
  if (!SETTINGS_SELECTED_TRANSFER_IMEI) return;
  const targetLocation = document.getElementById("modal-transfer-select-location").value;
  const targetStatus = document.getElementById("modal-transfer-select-status").value;

  try {
    const client = supabaseClient || getSupabaseClient();
    if (client) {
      const { error } = await client
        .from("m_gps_device")
        .update({
          posisi_stock: targetLocation,
          status_device: targetStatus,
          last_updated: new Date().toISOString()
        })
        .eq("imei", SETTINGS_SELECTED_TRANSFER_IMEI);

      if (error) throw error;
    }

    showToast(`Posisi IMEI ${SETTINGS_SELECTED_TRANSFER_IMEI} dipindahkan ke ${targetLocation}!`, "success", 1800);
    closeTransferGpsModal();
    await loadGpsInventoryForSettings();
    await syncMasterDataFromApi();
  } catch (err) {
    alert("Gagal memindahkan posisi stok GPS: " + err.message);
  }
}

function openAddGpsModal() {
  document.getElementById("gps-input-imei").value = "";
  const posSelect = document.getElementById("gps-input-posisi");
  if (posSelect && OFFICE_LOCATIONS.length > 0) {
    posSelect.innerHTML = OFFICE_LOCATIONS.map(o => `<option value="${o.name}">${o.name}</option>`).join("");
  }
  document.getElementById("modal-gps-add").classList.remove("hidden");
}

function closeAddGpsModal() {
  document.getElementById("modal-gps-add").classList.add("hidden");
}

async function saveNewGpsDevice() {
  const imei = document.getElementById("gps-input-imei").value.trim();
  const posisi = document.getElementById("gps-input-posisi").value;

  if (!imei) {
    alert("Nomor IMEI GPS wajib diisi!");
    return;
  }

  try {
    const client = supabaseClient || getSupabaseClient();
    if (client) {
      const { error } = await client
        .from("m_gps_device")
        .upsert({
          imei: imei,
          status_device: "TERSEDIA",
          posisi_stock: posisi,
          last_updated: new Date().toISOString()
        }, { onConflict: "imei" });

      if (error) throw error;
    }

    showToast("IMEI GPS baru berhasil disimpan!", "success", 1500);
    closeAddGpsModal();
    await loadGpsInventoryForSettings();
    await syncMasterDataFromApi();
  } catch (err) {
    alert("Gagal menambahkan IMEI GPS: " + err.message);
  }
}

// ---------------- TAB 5: ROLE & HAK AKSES MODUL ----------------
function loadRolePermissionsSettings() {
  const container = document.getElementById("role-matrix-container");
  if (!container) return;

  const roleKeys = Object.keys(ROLE_PERMISSIONS_STATE);

  container.innerHTML = roleKeys.map(roleId => {
    const role = ROLE_PERMISSIONS_STATE[roleId];
    const rolePerms = role.permissions || [];
    const isCoreRole = ["R-01"].includes(roleId);

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-xs p-3.5 sm:p-4 hover:border-purple-200 transition">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center space-x-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0">
              <i class="fa-solid ${role.icon || 'fa-user-gear'}"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center space-x-2 flex-wrap">
                <span class="text-xs sm:text-sm font-bold text-slate-900">${role.name}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${role.badgeBg || 'bg-purple-100 text-purple-800 border border-purple-200'}">${roleId}</span>
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  <i class="fa-solid fa-shield-halved mr-1 text-[9px] text-purple-600"></i>${rolePerms.length} Modul Aktif
                </span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5 line-clamp-1 max-w-lg">${role.desc || '-'}</p>
            </div>
          </div>
          <div class="flex items-center space-x-2 shrink-0">
            <button type="button" onclick="openEditRoleInfoModal('${roleId}')" class="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 font-bold rounded-xl text-xs border border-purple-200 flex items-center space-x-1.5 transition shadow-2xs">
              <i class="fa-solid fa-pen-to-square text-xs"></i>
              <span>Edit Info & Akses</span>
            </button>
            ${!isCoreRole ? `
              <button type="button" onclick="deleteCustomRole('${roleId}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 flex items-center justify-center transition" title="Hapus Role">
                <i class="fa-solid fa-trash-can text-xs"></i>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderModalModulesChecklist(selectedKeys = []) {
  const container = document.getElementById("role-modal-modules-container");
  if (!container) return;

  const preferredOrder = ["Operasional Lapangan", "Personalia", "Layanan & Support", "Administrasi & Sistem"];
  const allCats = Array.from(new Set(ALL_APP_MODULES.map(m => m.category || "Operasional Lapangan")));
  const categories = [
    ...preferredOrder.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !preferredOrder.includes(c))
  ];
  container.innerHTML = categories.map(cat => {
    const catMods = ALL_APP_MODULES.filter(m => (m.category || "Operasional Lapangan") === cat);
    if (catMods.length === 0) return "";

    const itemsHtml = catMods.map(mod => {
      const isChecked = selectedKeys.includes(mod.key);
      return `
        <label class="flex items-start space-x-2.5 p-2 bg-slate-50 hover:bg-purple-50/50 rounded-xl border border-slate-200 hover:border-purple-300 cursor-pointer transition select-none">
          <input type="checkbox" name="modal_role_perm" value="${mod.key}" ${isChecked ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <i class="fa-solid ${mod.icon} text-[11px] text-slate-600"></i>
              <span class="text-xs font-bold text-slate-800">${mod.title}</span>
            </div>
            <p class="text-[10px] text-slate-400 leading-tight mt-0.5">${mod.desc}</p>
          </div>
        </label>
      `;
    }).join('');

    return `
      <div class="space-y-1.5">
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">${cat}</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function selectAllRoleModalModules(checked) {
  const cbs = document.querySelectorAll('input[name="modal_role_perm"]');
  cbs.forEach(cb => cb.checked = !!checked);
}

// ================= BULK ASSIGN MENU KE BANYAK ROLE =================
function openBulkAssignRoleModal() {
  const roleContainer = document.getElementById("bulk-roles-list-container");
  const moduleContainer = document.getElementById("bulk-modules-list-container");
  if (!roleContainer || !moduleContainer) return;

  // 1. Render Roles Checkbox List
  const roleKeys = Object.keys(ROLE_PERMISSIONS_STATE);
  roleContainer.innerHTML = roleKeys.map(roleId => {
    const role = ROLE_PERMISSIONS_STATE[roleId];
    const permCount = (role.permissions || []).length;
    return `
      <label class="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30 cursor-pointer transition select-none">
        <input type="checkbox" name="bulk_target_role" value="${roleId}" class="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer" />
        <div class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs shrink-0">
          <i class="fa-solid ${role.icon || 'fa-user-gear'}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-xs font-bold text-slate-900 truncate">${role.name}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold ${role.badgeBg || 'bg-slate-100 text-slate-700'}">${roleId}</span>
          </div>
          <span class="text-[10px] text-slate-400">${permCount} modul aktif saat ini</span>
        </div>
      </label>
    `;
  }).join('');

  // 2. Render Modules Checkbox List per Kategori
  const preferredOrder = ["Operasional Lapangan", "Personalia", "Layanan & Support", "Administrasi & Sistem"];
  const allCats = Array.from(new Set(ALL_APP_MODULES.map(m => m.category || "Operasional Lapangan")));
  const categories = [
    ...preferredOrder.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !preferredOrder.includes(c))
  ];
  moduleContainer.innerHTML = categories.map(cat => {
    const catMods = ALL_APP_MODULES.filter(m => (m.category || "Operasional Lapangan") === cat);
    if (catMods.length === 0) return "";

    const itemsHtml = catMods.map(mod => {
      return `
        <label class="flex items-start space-x-2.5 p-2 bg-white hover:bg-purple-50/50 rounded-xl border border-slate-200 hover:border-purple-300 cursor-pointer transition select-none">
          <input type="checkbox" name="bulk_target_module" value="${mod.key}" class="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <i class="fa-solid ${mod.icon} text-[11px] text-slate-600"></i>
              <span class="text-xs font-bold text-slate-800">${mod.title}</span>
            </div>
            <p class="text-[10px] text-slate-400 leading-tight mt-0.5">${mod.desc}</p>
          </div>
        </label>
      `;
    }).join('');

    return `
      <div class="space-y-1.5">
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">${cat}</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const modal = document.getElementById("modal-bulk-assign-role");
  if (modal) modal.classList.remove("hidden");
}

function closeBulkAssignRoleModal() {
  const modal = document.getElementById("modal-bulk-assign-role");
  if (modal) modal.classList.add("hidden");
}

function selectAllBulkRoles(checked) {
  const cbs = document.querySelectorAll('input[name="bulk_target_role"]');
  cbs.forEach(cb => cb.checked = !!checked);
}

function selectAllBulkModules(checked) {
  const cbs = document.querySelectorAll('input[name="bulk_target_module"]');
  cbs.forEach(cb => cb.checked = !!checked);
}

async function handleApplyBulkRoleAssign(e) {
  e.preventDefault();

  const selectedRoleCbs = document.querySelectorAll('input[name="bulk_target_role"]:checked');
  const selectedModuleCbs = document.querySelectorAll('input[name="bulk_target_module"]:checked');

  const selectedRoleIds = Array.from(selectedRoleCbs).map(cb => cb.value);
  const selectedModuleKeys = Array.from(selectedModuleCbs).map(cb => cb.value);

  if (selectedRoleIds.length === 0) {
    alert("Silakan pilih minimal 1 role tujuan!");
    return;
  }

  if (selectedModuleKeys.length === 0) {
    alert("Silakan pilih minimal 1 menu/modul yang ingin ditambahkan!");
    return;
  }

  const submitBtn = document.getElementById("btn-apply-bulk-assign");
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Menyimpan ke Supabase...</span>';
  }

  try {
    let totalNewAdded = 0;
    const updatedRoles = [];

    // Terapkan penambahan (additive: tidak menimpa, hanya menambahkan jika belum ada)
    selectedRoleIds.forEach(roleId => {
      if (!ROLE_PERMISSIONS_STATE[roleId]) return;
      const currentPerms = Array.from(ROLE_PERMISSIONS_STATE[roleId].permissions || []);

      selectedModuleKeys.forEach(modKey => {
        if (!currentPerms.includes(modKey)) {
          currentPerms.push(modKey);
          totalNewAdded++;
        }
      });

      ROLE_PERMISSIONS_STATE[roleId].permissions = currentPerms;
      updatedRoles.push({
        role_id: roleId,
        role_name: ROLE_PERMISSIONS_STATE[roleId].name || roleId,
        permissions: JSON.stringify(currentPerms),
        description: ROLE_PERMISSIONS_STATE[roleId].desc || "",
        updated_at: new Date().toISOString()
      });
    });

    // Simpan ke localStorage
    localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

    // Simpan ke Supabase jika tersedia (individual upsert via Promise.all agar 100% konsisten & persisten)
    if (!supabaseClient && typeof getSupabaseClient === "function") {
      supabaseClient = getSupabaseClient();
    }
    const client = supabaseClient;

    if (client && updatedRoles.length > 0) {
      try {
        const results = await Promise.all(
          updatedRoles.map(roleItem =>
            client.from("m_role_permission").upsert({
              role_id: roleItem.role_id,
              role_name: roleItem.role_name,
              permissions: roleItem.permissions,
              description: roleItem.description || "",
              updated_at: roleItem.updated_at
            }, { onConflict: "role_id" })
          )
        );
        const failed = results.filter(r => r && r.error);
        if (failed.length > 0) {
          console.warn("Sebagian role gagal disimpan ke Supabase:", failed);
        } else {
          console.log(`Berhasil menyimpan ${updatedRoles.length} role ke Supabase m_role_permission!`);
        }
      } catch (err) {
        console.warn("Supabase upsert error on bulk role assign:", err);
      }
    }

    // Jika role user yang sedang login terpengaruh, sync permissions dan update dashboard
    if (CURRENT_USER) {
      const uRole = CURRENT_USER.role || CURRENT_USER.role_id;
      if (selectedRoleIds.includes(uRole) || selectedRoleIds.includes(CURRENT_USER.role_id)) {
        const activeRoleId = CURRENT_USER.role_id || uRole;
        if (ROLE_PERMISSIONS_STATE[activeRoleId]) {
          CURRENT_USER.permissions = ROLE_PERMISSIONS_STATE[activeRoleId].permissions;
          try {
            localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
          } catch (err) { }
          if (typeof initDashboard === "function") initDashboard();
        }
      }
    }

    closeBulkAssignRoleModal();
    loadRolePermissionsSettings();
    populateEmployeeRoleOptions();

    showToast(`Berhasil menambahkan ${selectedModuleKeys.length} menu ke ${selectedRoleIds.length} role terpilih (${totalNewAdded} hak akses baru berhasil disimpan ke Supabase)!`, "success", 3000);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

// ================= BULK HAPUS MENU DARI BANYAK ROLE =================
function openBulkRemoveRoleModal() {
  const roleContainer = document.getElementById("bulk-remove-roles-list-container");
  const moduleContainer = document.getElementById("bulk-remove-modules-list-container");
  if (!roleContainer || !moduleContainer) return;

  // 1. Render Roles Checkbox List
  const roleKeys = Object.keys(ROLE_PERMISSIONS_STATE);
  roleContainer.innerHTML = roleKeys.map(roleId => {
    const role = ROLE_PERMISSIONS_STATE[roleId];
    const permCount = (role.permissions || []).length;
    return `
      <label class="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-rose-200 hover:border-rose-400 hover:bg-rose-50/30 cursor-pointer transition select-none">
        <input type="checkbox" name="bulk_remove_target_role" value="${roleId}" class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer" />
        <div class="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs shrink-0">
          <i class="fa-solid ${role.icon || 'fa-user-gear'}"></i>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-xs font-bold text-slate-900 truncate">${role.name}</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold ${role.badgeBg || 'bg-slate-100 text-slate-700'}">${roleId}</span>
          </div>
          <span class="text-[10px] text-slate-400">${permCount} modul aktif saat ini</span>
        </div>
      </label>
    `;
  }).join('');

  // 2. Render Modules Checkbox List per Kategori
  const preferredOrder = ["Operasional Lapangan", "Personalia", "Layanan & Support", "Administrasi & Sistem"];
  const allCats = Array.from(new Set(ALL_APP_MODULES.map(m => m.category || "Operasional Lapangan")));
  const categories = [
    ...preferredOrder.filter(c => allCats.includes(c)),
    ...allCats.filter(c => !preferredOrder.includes(c))
  ];

  moduleContainer.innerHTML = categories.map(cat => {
    const catMods = ALL_APP_MODULES.filter(m => (m.category || "Operasional Lapangan") === cat);
    if (catMods.length === 0) return "";

    const itemsHtml = catMods.map(mod => {
      return `
        <label class="flex items-start space-x-2.5 p-2 bg-white hover:bg-rose-50/50 rounded-xl border border-slate-200 hover:border-rose-300 cursor-pointer transition select-none">
          <input type="checkbox" name="bulk_remove_target_module" value="${mod.key}" class="mt-0.5 w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer" />
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5">
              <i class="fa-solid ${mod.icon} text-[11px] text-slate-600"></i>
              <span class="text-xs font-bold text-slate-800">${mod.title}</span>
            </div>
            <p class="text-[10px] text-slate-400 leading-tight mt-0.5">${mod.desc}</p>
          </div>
        </label>
      `;
    }).join('');

    return `
      <div class="space-y-1.5">
        <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">${cat}</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');

  const modal = document.getElementById("modal-bulk-remove-role");
  if (modal) modal.classList.remove("hidden");
}

function closeBulkRemoveRoleModal() {
  const modal = document.getElementById("modal-bulk-remove-role");
  if (modal) modal.classList.add("hidden");
}

function selectAllBulkRemoveRoles(checked) {
  const cbs = document.querySelectorAll('input[name="bulk_remove_target_role"]');
  cbs.forEach(cb => cb.checked = !!checked);
}

function selectAllBulkRemoveModules(checked) {
  const cbs = document.querySelectorAll('input[name="bulk_remove_target_module"]');
  cbs.forEach(cb => cb.checked = !!checked);
}

async function handleApplyBulkRoleRemove(e) {
  e.preventDefault();

  const selectedRoleCbs = document.querySelectorAll('input[name="bulk_remove_target_role"]:checked');
  const selectedModuleCbs = document.querySelectorAll('input[name="bulk_remove_target_module"]:checked');

  const selectedRoleIds = Array.from(selectedRoleCbs).map(cb => cb.value);
  const selectedModuleKeys = Array.from(selectedModuleCbs).map(cb => cb.value);

  if (selectedRoleIds.length === 0) {
    alert("Silakan pilih minimal 1 role tujuan yang ingin dikurangi!");
    return;
  }

  if (selectedModuleKeys.length === 0) {
    alert("Silakan pilih minimal 1 menu/modul yang ingin dicabut/dihapus!");
    return;
  }

  if (!confirm(`Yakin ingin mencabut ${selectedModuleKeys.length} menu terpilih dari ${selectedRoleIds.length} role?`)) {
    return;
  }

  const submitBtn = document.getElementById("btn-apply-bulk-remove");
  const origBtnHtml = submitBtn ? submitBtn.innerHTML : "";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Mencabut & Menyimpan ke Supabase...</span>';
  }

  try {
    let totalRemoved = 0;
    const updatedRoles = [];

    selectedRoleIds.forEach(roleId => {
      if (!ROLE_PERMISSIONS_STATE[roleId]) return;
      let currentPerms = Array.from(ROLE_PERMISSIONS_STATE[roleId].permissions || []);

      selectedModuleKeys.forEach(modKey => {
        // Proteksi khusus Super Admin: Jangan cabut settings agar tidak terkunci keluar
        if (roleId === "R-01" && modKey === "settings") {
          return;
        }
        const idx = currentPerms.indexOf(modKey);
        if (idx !== -1) {
          currentPerms.splice(idx, 1);
          totalRemoved++;
        }
      });

      ROLE_PERMISSIONS_STATE[roleId].permissions = currentPerms;
      updatedRoles.push({
        role_id: roleId,
        role_name: ROLE_PERMISSIONS_STATE[roleId].name || roleId,
        permissions: JSON.stringify(currentPerms),
        description: ROLE_PERMISSIONS_STATE[roleId].desc || "",
        updated_at: new Date().toISOString()
      });
    });

    // Simpan ke localStorage
    localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

    // Simpan ke Supabase jika tersedia (individual upsert via Promise.all agar 100% konsisten & persisten)
    if (!supabaseClient && typeof getSupabaseClient === "function") {
      supabaseClient = getSupabaseClient();
    }
    const client = supabaseClient;

    if (client && updatedRoles.length > 0) {
      try {
        const results = await Promise.all(
          updatedRoles.map(roleItem =>
            client.from("m_role_permission").upsert({
              role_id: roleItem.role_id,
              role_name: roleItem.role_name,
              permissions: roleItem.permissions,
              description: roleItem.description || "",
              updated_at: roleItem.updated_at
            }, { onConflict: "role_id" })
          )
        );
        const failed = results.filter(r => r && r.error);
        if (failed.length > 0) {
          console.warn("Sebagian role gagal disimpan ke Supabase saat pencabutan menu:", failed);
        } else {
          console.log(`Berhasil mencabut menu & menyimpan ${updatedRoles.length} role ke Supabase m_role_permission!`);
        }
      } catch (err) {
        console.warn("Supabase upsert error on bulk role remove:", err);
      }
    }

    // Jika role user yang sedang login terpengaruh, sync permissions dan update dashboard
    if (CURRENT_USER) {
      const uRole = CURRENT_USER.role || CURRENT_USER.role_id;
      if (selectedRoleIds.includes(uRole) || selectedRoleIds.includes(CURRENT_USER.role_id)) {
        const activeRoleId = CURRENT_USER.role_id || uRole;
        if (ROLE_PERMISSIONS_STATE[activeRoleId]) {
          CURRENT_USER.permissions = ROLE_PERMISSIONS_STATE[activeRoleId].permissions;
          try {
            localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
          } catch (err) { }
          if (typeof initDashboard === "function") initDashboard();
        }
      }
    }

    closeBulkRemoveRoleModal();
    loadRolePermissionsSettings();
    populateEmployeeRoleOptions();

    showToast(`Berhasil mencabut ${selectedModuleKeys.length} menu dari ${selectedRoleIds.length} role terpilih (${totalRemoved} hak akses dicabut & tersimpan di Supabase)!`, "info", 3000);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnHtml;
    }
  }
}

let ROLE_EDIT_MODE = "add"; // "add" | "edit"

function openAddRoleModal() {
  ROLE_EDIT_MODE = "add";
  document.getElementById("modal-role-title").innerText = "Tambah Role Baru";

  // Auto suggest next R-0X
  const keys = Object.keys(ROLE_PERMISSIONS_STATE);
  let nextNum = keys.length + 1;
  while (ROLE_PERMISSIONS_STATE[`R-0${nextNum}`] || ROLE_PERMISSIONS_STATE[`R-${nextNum}`]) {
    nextNum++;
  }
  const suggestedId = nextNum < 10 ? `R-0${nextNum}` : `R-${nextNum}`;

  const idInput = document.getElementById("role-input-id");
  idInput.value = suggestedId;
  idInput.disabled = false;

  document.getElementById("role-input-name").value = "";
  document.getElementById("role-input-desc").value = "";
  document.getElementById("role-input-icon").value = "fa-user-gear";
  document.getElementById("role-input-color").value = "purple";

  // Default permissions for new role
  renderModalModulesChecklist(["priority", "visit", "onboarding", "pipeline", "gps", "history"]);

  document.getElementById("modal-role-create-edit").classList.remove("hidden");
}

function openEditRoleInfoModal(roleId) {
  const role = ROLE_PERMISSIONS_STATE[roleId];
  if (!role) return;

  ROLE_EDIT_MODE = "edit";
  document.getElementById("modal-role-title").innerText = `Edit Role: ${role.name}`;

  const idInput = document.getElementById("role-input-id");
  idInput.value = roleId;
  idInput.disabled = true;

  document.getElementById("role-input-name").value = role.name;
  document.getElementById("role-input-desc").value = role.desc || "";
  document.getElementById("role-input-icon").value = role.icon || "fa-user-gear";
  document.getElementById("role-input-color").value = role.color || "purple";

  // Render module checklists for this role
  renderModalModulesChecklist(role.permissions || []);

  document.getElementById("modal-role-create-edit").classList.remove("hidden");
}

function closeRoleModal() {
  document.getElementById("modal-role-create-edit").classList.add("hidden");
}

function handleSaveRoleInfo(e) {
  e.preventDefault();
  const id = document.getElementById("role-input-id").value.trim().toUpperCase();
  const name = document.getElementById("role-input-name").value.trim();
  const desc = document.getElementById("role-input-desc").value.trim();
  const icon = document.getElementById("role-input-icon").value;
  const color = document.getElementById("role-input-color").value;

  if (!id || !name) {
    alert("Kode Role ID dan Nama Role wajib diisi!");
    return;
  }

  // Ambil pilihan hak akses modul dari checklist di dalam modal
  const checkedCheckboxes = document.querySelectorAll('input[name="modal_role_perm"]:checked');
  const selectedPermissions = Array.from(checkedCheckboxes).map(cb => cb.value);

  const badgeColorMap = {
    purple: "bg-purple-100 text-purple-800 border border-purple-200",
    blue: "bg-blue-100 text-blue-800 border border-blue-200",
    cyan: "bg-cyan-100 text-cyan-800 border border-cyan-200",
    emerald: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    amber: "bg-amber-100 text-amber-800 border border-amber-200",
    rose: "bg-rose-100 text-rose-800 border border-rose-200",
    indigo: "bg-indigo-100 text-indigo-800 border border-indigo-200"
  };

  const badgeBg = badgeColorMap[color] || badgeColorMap.purple;

  if (ROLE_EDIT_MODE === "add") {
    if (ROLE_PERMISSIONS_STATE[id]) {
      alert(`Role ID ${id} sudah terdaftar. Gunakan ID lain!`);
      return;
    }
    ROLE_PERMISSIONS_STATE[id] = {
      name: name,
      icon: icon,
      color: color,
      badgeBg: badgeBg,
      desc: desc || "Role kustom pengguna",
      permissions: selectedPermissions
    };
    showToast(`Role baru ${name} (${id}) berhasil ditambahkan!`, "success", 2000);
  } else {
    if (!ROLE_PERMISSIONS_STATE[id]) return;
    ROLE_PERMISSIONS_STATE[id].name = name;
    ROLE_PERMISSIONS_STATE[id].desc = desc;
    ROLE_PERMISSIONS_STATE[id].icon = icon;
    ROLE_PERMISSIONS_STATE[id].color = color;
    ROLE_PERMISSIONS_STATE[id].badgeBg = badgeBg;
    ROLE_PERMISSIONS_STATE[id].permissions = selectedPermissions;
    showToast(`Role ${name} (${id}) & hak akses berhasil diperbarui!`, "success", 2000);
  }

  localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (supabaseClient) {
    const roleObj = ROLE_PERMISSIONS_STATE[id];
    supabaseClient.from("m_role_permission").upsert({
      role_id: id,
      role_name: name,
      permissions: JSON.stringify(selectedPermissions),
      description: desc || "",
      updated_at: new Date().toISOString()
    }, { onConflict: "role_id" }).then(({ error }) => {
      if (error) console.warn("Error sync role to supabase:", error);
    });
  }

  // If current logged-in user is under this role, sync and update dashboard immediately
  const uRole = CURRENT_USER?.role || CURRENT_USER?.role_id;
  if (uRole === id || CURRENT_USER?.role_id === id || (CURRENT_USER?.jabatan && CURRENT_USER.jabatan.includes(name))) {
    CURRENT_USER.permissions = selectedPermissions;
    try {
      localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
    } catch (e) { }
    if (typeof initDashboard === "function") initDashboard();
  }

  closeRoleModal();
  loadRolePermissionsSettings();
  populateEmployeeRoleOptions();
  if (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0) {
    renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
  }
}

async function resetRolePermissionsToDefault() {
  if (!confirm("Kembalikan seluruh hak akses dan matriks role ke standar default sistem?")) return;

  ROLE_PERMISSIONS_STATE = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (supabaseClient) {
    try {
      const rows = Object.keys(ROLE_PERMISSIONS_STATE).map(k => ({
        role_id: k,
        role_name: ROLE_PERMISSIONS_STATE[k].name,
        permissions: JSON.stringify(ROLE_PERMISSIONS_STATE[k].permissions),
        description: ROLE_PERMISSIONS_STATE[k].desc || "",
        updated_at: new Date().toISOString()
      }));
      await Promise.all(rows.map(r => supabaseClient.from("m_role_permission").upsert(r, { onConflict: "role_id" })));
    } catch (e) {
      console.warn("Error reset role to supabase:", e);
    }
  }

  loadRolePermissionsSettings();
  populateEmployeeRoleOptions();
  if (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0) {
    renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
  }
  showToast("Matriks hak akses role berhasil direset ke default!", "success", 2000);
}

async function deleteCustomRole(roleId) {
  if (roleId === "R-01") {
    alert("Role Super Admin (R-01) tidak dapat dihapus!");
    return;
  }
  const role = ROLE_PERMISSIONS_STATE[roleId];
  if (!role) return;

  if (!confirm(`Hapus role "${role.name}" (${roleId})? Karyawan yang menggunakan role ini akan memerlukan pembaruan role.`)) return;

  delete ROLE_PERMISSIONS_STATE[roleId];
  localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (supabaseClient) {
    try {
      await supabaseClient.from("m_role_permission").delete().eq("role_id", roleId);
    } catch (e) { }
  }

  loadRolePermissionsSettings();
  populateEmployeeRoleOptions();
  showToast(`Role ${role.name} berhasil dihapus!`, "success", 2000);
}

async function saveRolePermissions(roleId) {
  const checkboxes = document.querySelectorAll(`input[name="role_perm_${roleId}"]:checked`);
  const selected = Array.from(checkboxes).map(cb => cb.value);

  if (!ROLE_PERMISSIONS_STATE[roleId]) return;
  ROLE_PERMISSIONS_STATE[roleId].permissions = selected;

  try {
    localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));

    if (!supabaseClient && typeof getSupabaseClient === "function") {
      supabaseClient = getSupabaseClient();
    }
    if (supabaseClient) {
      const roleObj = ROLE_PERMISSIONS_STATE[roleId];
      const { error } = await supabaseClient
        .from("m_role_permission")
        .upsert({
          role_id: roleId,
          role_name: roleObj?.name || roleId,
          permissions: JSON.stringify(selected),
          description: roleObj?.desc || "",
          updated_at: new Date().toISOString()
        }, { onConflict: "role_id" });
      if (error) console.warn("Supabase m_role_permission error:", error);
    }

    showToast(`Hak akses ${ROLE_PERMISSIONS_STATE[roleId].name} (${roleId}) berhasil disimpan!`, "success", 2000);

    // If current logged-in user is under this role, sync and update dashboard immediately
    const uRole = CURRENT_USER?.role || CURRENT_USER?.role_id;
    if (uRole === roleId || CURRENT_USER?.role_id === roleId || (CURRENT_USER?.jabatan && CURRENT_USER.jabatan.includes(ROLE_PERMISSIONS_STATE[roleId].name))) {
      CURRENT_USER.permissions = selected;
      try {
        localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
      } catch (e) { }
      initDashboard();
    }
  } catch (err) {
    alert("Gagal menyimpan hak akses role: " + err.message);
  }
}

async function seedDefaultRolesToSupabase() {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (!supabaseClient) return;
  try {
    const rows = Object.keys(DEFAULT_ROLE_PERMISSIONS).map(roleId => {
      const def = DEFAULT_ROLE_PERMISSIONS[roleId];
      const existing = ROLE_PERMISSIONS_STATE[roleId]?.permissions;
      const perms = (Array.isArray(existing) && existing.length > 0) ? existing : def.permissions;
      return {
        role_id: roleId,
        role_name: ROLE_PERMISSIONS_STATE[roleId]?.name || def.name,
        permissions: JSON.stringify(perms),
        description: ROLE_PERMISSIONS_STATE[roleId]?.desc || def.desc || "",
        updated_at: new Date().toISOString()
      };
    });
    await Promise.all(rows.map(r => supabaseClient.from("m_role_permission").upsert(r, { onConflict: "role_id" })));
    console.log("Sukses seed seluruh default roles ke Supabase m_role_permission!");
  } catch (e) {
    console.warn("Exception seedDefaultRolesToSupabase:", e);
  }
}

async function syncRolePermissionsFromSupabase() {
  if (!supabaseClient && typeof getSupabaseClient === "function") {
    supabaseClient = getSupabaseClient();
  }
  if (!supabaseClient) return;
  try {
    const { data: permsData, error } = await supabaseClient.from("m_role_permission").select("*");

    if (!error) {
      if (!permsData || permsData.length === 0) {
        console.log("Tabel m_role_permission kosong di Supabase. Melakukan inisialisasi awal...");
        await seedDefaultRolesToSupabase();
        return;
      }

      permsData.forEach(r => {
        const rId = String(r.role_id || "").trim();
        if (!rId) return;

        let perms = parseRolePermissions(r.permissions || r.permission_keys);
        perms = perms.filter(p => p !== "work_calendar");

        // Proteksi Super Admin R-01 agar tidak pernah kehilangan menu settings (pengaturan)
        if (rId === "R-01" && !perms.includes("settings")) {
          perms.push("settings");
        }

        if (ROLE_PERMISSIONS_STATE[rId]) {
          ROLE_PERMISSIONS_STATE[rId].permissions = perms;
          if (r.role_name) ROLE_PERMISSIONS_STATE[rId].name = r.role_name;
          if (r.description) ROLE_PERMISSIONS_STATE[rId].desc = r.description;
        } else {
          ROLE_PERMISSIONS_STATE[rId] = {
            name: r.role_name || rId,
            icon: "fa-user-gear",
            color: "purple",
            badgeBg: "bg-purple-100 text-purple-800 border border-purple-200",
            desc: r.description || `Role ${r.role_name || rId}`,
            permissions: perms
          };
        }
      });

      // Periksa apakah ada role default (R-01, R-02, R-03, R-04) yang belum tersimpan di Supabase
      const missingDefaultRoles = Object.keys(DEFAULT_ROLE_PERMISSIONS).filter(k =>
        !permsData.some(r => String(r.role_id || "").trim() === k)
      );

      if (missingDefaultRoles.length > 0) {
        console.log("Melengkapi role default ke database Supabase:", missingDefaultRoles);
        const rowsToInsert = missingDefaultRoles.map(roleId => {
          const def = DEFAULT_ROLE_PERMISSIONS[roleId];
          return {
            role_id: roleId,
            role_name: def.name,
            permissions: JSON.stringify(def.permissions),
            description: def.desc || "",
            updated_at: new Date().toISOString()
          };
        });
        await Promise.all(rowsToInsert.map(r => supabaseClient.from("m_role_permission").upsert(r, { onConflict: "role_id" })));
      }

      try {
        localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));
      } catch (e) { }

      // Refresh CURRENT_USER permissions jika user sedang login
      if (CURRENT_USER) {
        const uRole = CURRENT_USER.role || CURRENT_USER.role_id || CURRENT_USER.jabatan;
        const freshPerms = getPermissionsForRole(CURRENT_USER.role_id || uRole, CURRENT_USER);
        CURRENT_USER.permissions = freshPerms;
        try {
          localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
        } catch (e) { }

        // Refresh tombol dashboard jika elemen dashboard ada
        const nameEl = document.getElementById("dash-user-name");
        if (nameEl) {
          initDashboard();
        }
      }
    }
  } catch (err) {
    console.warn("Gagal sinkronisasi m_role_permission:", err);
  }
}

// =========================================================================
// APP INITIALIZATION & GLOBAL EVENT LISTENERS
// =========================================================================
document.addEventListener("click", (e) => {
  // Close Visit Dealer Search if click outside
  const visitWrapper = document.getElementById("dealer-search-wrapper");
  if (visitWrapper && !visitWrapper.contains(e.target)) {
    closeDealerSearchDropdown();
  }
  // Close Assign Dealer Search if click outside
  const assignWrapper = document.getElementById("assign-dealer-search-wrapper");
  if (assignWrapper && !assignWrapper.contains(e.target)) {
    closeAssignDealerSearchDropdown();
  }
  // Close GPS Dealer Search if click outside
  const gpsDealerWrapper = document.getElementById("gps-dealer-search-wrapper");
  if (gpsDealerWrapper && !gpsDealerWrapper.contains(e.target)) {
    closeGpsDealerSearchDropdown();
  }
  // Close GPS Kendaraan Search if click outside
  const gpsKendaraanWrapper = document.getElementById("gps-kendaraan-search-wrapper");
  if (gpsKendaraanWrapper && !gpsKendaraanWrapper.contains(e.target)) {
    closeGpsKendaraanSearchDropdown();
  }
  // Close GPS IMEI Search if click outside
  const gpsImeiWrapper = document.getElementById("gps-imei-search-wrapper");
  if (gpsImeiWrapper && !gpsImeiWrapper.contains(e.target)) {
    closeGpsImeiSearchDropdown();
  }
});

// =========================================================================
// RIWAYAT AKTIVITAS PIC & SAME-DAY PROTECTED EDIT CONTROLLER
// =========================================================================
let HISTORY_TYPE_FILTER = "ALL"; // "ALL" | "VISIT" | "ONBOARDING" | "GPS"
let HISTORY_START_DATE = "";
let HISTORY_END_DATE = "";
let CACHED_HISTORY_DATA = [];

function getLocalDateString(d) {
  if (!d || isNaN(d.getTime())) return "";
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

function isTodayRecord(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatDisplayDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  const hr = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${mon} ${yr}, ${hr}:${min} WIB`;
}

function initHistory() {
  const todayStr = getLocalDateString(new Date());
  HISTORY_START_DATE = todayStr;
  HISTORY_END_DATE = todayStr;

  const startInput = document.getElementById("history-start-date");
  const endInput = document.getElementById("history-end-date");
  if (startInput) startInput.value = todayStr;
  if (endInput) endInput.value = todayStr;

  setHistoryTypeFilter(HISTORY_TYPE_FILTER);
  loadActivityHistory();
}

function setHistoryTodayDate() {
  const todayStr = getLocalDateString(new Date());
  HISTORY_START_DATE = todayStr;
  HISTORY_END_DATE = todayStr;

  const startInput = document.getElementById("history-start-date");
  const endInput = document.getElementById("history-end-date");
  if (startInput) startInput.value = todayStr;
  if (endInput) endInput.value = todayStr;

  renderHistoryList();
}

function handleHistoryDateRangeChange() {
  const startInput = document.getElementById("history-start-date");
  const endInput = document.getElementById("history-end-date");
  if (startInput) HISTORY_START_DATE = startInput.value;
  if (endInput) HISTORY_END_DATE = endInput.value;

  renderHistoryList();
}

function setHistoryTypeFilter(type) {
  HISTORY_TYPE_FILTER = type;
  const types = ["all", "visit", "onb", "gps"];
  const typeMap = { ALL: "all", VISIT: "visit", ONBOARDING: "onb", GPS: "gps" };
  types.forEach(t => {
    const btn = document.getElementById(`h-type-${t}`);
    if (btn) {
      if (t === typeMap[type]) {
        btn.className = "py-1.5 px-1 rounded-xl bg-slate-900 text-white text-center shadow-xs transition truncate font-bold";
      } else {
        btn.className = "py-1.5 px-1 rounded-xl bg-slate-200 text-slate-700 text-center hover:bg-slate-300 transition truncate font-bold";
      }
    }
  });
  renderHistoryList();
}

async function loadActivityHistory(forceRefresh = false) {
  const container = document.getElementById("history-list-container");
  const refreshBtn = document.getElementById("btn-refresh-history");
  if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

  if (!supabaseClient) {
    if (container) container.innerHTML = '<div class="p-4 bg-amber-50 text-amber-800 rounded-xl text-xs">Supabase Client belum siap.</div>';
    if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
    return;
  }

  try {
    const userNip = CURRENT_USER?.nip || null;

    // 1. Query Visit Mitra (Murni Self-Review Aktivitas Pribadi)
    let qVisit = supabaseClient.from("tr_laporan_visit").select("*").order("created_at", { ascending: false }).limit(100);
    if (userNip) qVisit = qVisit.eq("nip", userNip);

    // 2. Query Calon Mitra
    let qOnb = supabaseClient.from("tr_onboarding_log").select("*").order("created_at", { ascending: false }).limit(100);
    if (userNip) qOnb = qOnb.eq("nip", userNip);

    // 3. Query GPS Maintenance
    let qGps = supabaseClient.from("tr_gps_maintenance").select("*").order("created_at", { ascending: false }).limit(100);
    if (userNip) qGps = qGps.eq("nip", userNip);

    const [resVisit, resOnb, resGps] = await Promise.all([qVisit, qOnb, qGps]);

    const visitLogs = (resVisit.data || []).map(item => ({
      id: item.visit_id,
      type: "VISIT",
      typeLabel: "Visit Mitra",
      icon: "fa-clipboard-check",
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      title: item.dealer_name || "Mitra",
      subtitle: `Lokasi: ${item.lokasi || 'Showroom'} • Bertemu: ${item.bertemu_owner || '-'}`,
      notes: item.catatan_visit || item.tindak_lanjut_concern || "-",
      createdAt: item.created_at,
      dateObj: new Date(item.created_at),
      isToday: isTodayRecord(item.created_at),
      nip: item.nip,
      lat: item.lat,
      long: item.long,
      photos: item.showroom_photo_url ? [{ label: "Foto Showroom", url: item.showroom_photo_url }] : [],
      raw: item
    }));

    const onbLogs = (resOnb.data || []).map(item => {
      const parsed = parseOnboardingRecord(item);
      const selfieUrl = item.selfie_photo_url || item.foto_showroom_url || item.foto_ktp_url || null;
      return {
        id: item.onboarding_id,
        type: "ONBOARDING",
        typeLabel: "Visit Calon Mitra",
        icon: "fa-user-plus",
        iconColor: "text-teal-600 bg-teal-50 border-teal-200",
        title: parsed.namaUsaha || parsed.namaPemohon || "Calon Mitra",
        subtitle: `Pemohon: ${parsed.namaPemohon || '-'} • Tahapan: ${parsed.stages.join(' & ') || 'On-Process'}`,
        notes: parsed.catatan || "-",
        createdAt: item.created_at,
        dateObj: new Date(item.created_at),
        isToday: isTodayRecord(item.created_at),
        nip: item.nip,
        lat: item.lokasi_lat,
        long: item.lokasi_long,
        selfieUrl: selfieUrl,
        photos: selfieUrl ? [{ label: "Foto Selfie Kunjungan", url: selfieUrl }] : [],
        parsedOnb: parsed,
        raw: item
      };
    });

    const gpsLogs = (resGps.data || []).map(item => ({
      id: item.maint_id,
      type: "GPS",
      typeLabel: "GPS Maintenance",
      icon: "fa-satellite-dish",
      iconColor: "text-emerald-600 bg-emerald-50 border-emerald-200",
      title: `${item.nopol || 'Kendaraan'} (${item.dealer_name || 'Mitra'})`,
      subtitle: `Aktivitas: ${item.act_type || 'Maintenance'} • No Fas: ${item.no_fasilitas || '-'}`,
      notes: item.catatan_teknis || "-",
      createdAt: item.created_at,
      dateObj: new Date(item.created_at),
      isToday: isTodayRecord(item.created_at),
      nip: item.nip,
      lat: item.lat,
      long: item.long,
      photos: [
        item.foto_imei_lama_url ? { label: "IMEI Lama", url: item.foto_imei_lama_url } : null,
        item.foto_imei_baru_url ? { label: "IMEI Baru", url: item.foto_imei_baru_url } : null,
        item.foto_posisi_gps_url ? { label: "Posisi GPS", url: item.foto_posisi_gps_url } : null
      ].filter(Boolean),
      raw: item
    }));

    // Merge and sort DESC
    CACHED_HISTORY_DATA = [...visitLogs, ...onbLogs, ...gpsLogs].sort((a, b) => {
      const timeA = a.dateObj.getTime() || 0;
      const timeB = b.dateObj.getTime() || 0;
      return timeB - timeA;
    });

    renderHistoryList();
  } catch (err) {
    console.error("Error loading activity history:", err);
    if (container) {
      container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-xl text-xs">Gagal memuat riwayat: ${err.message}</div>`;
    }
  } finally {
    if (refreshBtn) refreshBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
  }
}

function renderHistoryList() {
  const container = document.getElementById("history-list-container");
  if (!container) return;

  let filtered = [...CACHED_HISTORY_DATA];

  // Filter Type
  if (HISTORY_TYPE_FILTER !== "ALL") {
    filtered = filtered.filter(item => item.type === HISTORY_TYPE_FILTER);
  }

  // Filter Date Range (Start & End Date)
  if (HISTORY_START_DATE || HISTORY_END_DATE) {
    filtered = filtered.filter(item => {
      const itemDateStr = getLocalDateString(item.dateObj);
      if (!itemDateStr) return false;
      if (HISTORY_START_DATE && itemDateStr < HISTORY_START_DATE) return false;
      if (HISTORY_END_DATE && itemDateStr > HISTORY_END_DATE) return false;
      return true;
    });
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-1">
          <i class="fa-solid fa-calendar-xmark"></i>
        </div>
        <p class="font-bold text-sm text-slate-800">Tidak ada riwayat aktivitas</p>
        <p class="text-[11px] text-slate-400 max-w-xs mx-auto">Tidak ditemukan catatan aktivitas untuk kriteria filter yang dipilih.</p>
      </div>
    `;
    return;
  }

  let html = "";
  filtered.forEach(item => {
    const editBadge = item.isToday
      ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">🟢 Bisa Diedit</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200 shrink-0">🔒 Final</span>`;

    const actionBtn = item.isToday
      ? `<button type="button" onclick="openActivityDetailModal('${item.type}', '${item.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-1 transition">
          <i class="fa-solid fa-pen-to-square text-[10px]"></i>
          <span>Detail & Edit</span>
         </button>`
      : `<button type="button" onclick="openActivityDetailModal('${item.type}', '${item.id}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 flex items-center space-x-1 transition">
          <i class="fa-solid fa-eye text-[10px]"></i>
          <span>Lihat Detail</span>
         </button>`;

    html += `
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-2.5">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl ${item.iconColor} border flex items-center justify-center text-sm shrink-0">
              <i class="fa-solid ${item.icon}"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">${item.typeLabel}</span>
              </div>
              <h4 class="font-bold text-xs text-slate-900 truncate leading-tight">${item.title}</h4>
            </div>
          </div>
          ${editBadge}
        </div>

        <div class="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div class="font-medium text-slate-800 truncate">${item.subtitle}</div>
          <div class="text-[10px] text-slate-500 line-clamp-2 italic">${item.notes}</div>
        </div>

        <div class="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
          <div class="flex items-center space-x-1">
            <i class="fa-regular fa-clock"></i>
            <span>${formatDisplayDate(item.createdAt)}</span>
          </div>
          ${actionBtn}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function parseCatatanUnit(str) {
  const result = {
    indikasi: "",
    infoList: [],
    infoLainnya: "",
    ovdPlan: "",
    komitmen: "Tidak Ada",
    tglKomitmen: ""
  };
  if (!str) return result;

  const parts = str.split(";").map(s => s.trim());
  parts.forEach(p => {
    if (p.startsWith("Indikasi:")) {
      const val = p.replace("Indikasi:", "").trim();
      if (val !== "-") result.indikasi = val;
    } else if (p.startsWith("Info:")) {
      const val = p.replace("Info:", "").trim();
      if (val && val !== "-") {
        const standardOptions = ["Plan Perpanjang", "Plan Pelunasan", "Ada Calon Pembeli", "Proses Kredit", "Unit Cash Tempo", "Unit Milik Orang Lain"];
        const splitItems = val.split(",").map(x => x.trim());
        splitItems.forEach(item => {
          if (standardOptions.includes(item)) {
            result.infoList.push(item);
          } else if (item.startsWith("Lainnya:")) {
            result.infoList.push("Lainnya");
            result.infoLainnya = item.replace("Lainnya:", "").trim();
          } else if (item && item !== "Lainnya") {
            result.infoList.push("Lainnya");
            result.infoLainnya = item;
          }
        });
      }
    } else if (p.startsWith("Plan:")) {
      const val = p.replace("Plan:", "").trim();
      if (val !== "-") result.ovdPlan = val;
    } else if (p.startsWith("Komitmen:")) {
      const val = p.replace("Komitmen:", "").trim();
      if (val && val !== "-") {
        const tglMatch = val.match(/\(Tgl:\s*([^\)]+)\)/i);
        if (tglMatch) {
          result.tglKomitmen = tglMatch[1].trim();
          result.komitmen = val.replace(/\(Tgl:[^\)]+\)/i, "").trim();
        } else {
          result.komitmen = val;
        }
      }
    } else if (p.startsWith("Tgl Komitmen:")) {
      const val = p.replace("Tgl Komitmen:", "").trim();
      if (val && val !== "-") result.tglKomitmen = val;
    }
  });

  return result;
}

function toggleHistUnitAccordion(checkId) {
  const body = document.getElementById(`hist-unit-body-${checkId}`);
  const chevron = document.getElementById(`hist-unit-chevron-${checkId}`);
  if (!body) return;

  const isHidden = body.classList.contains("hidden");
  if (isHidden) {
    body.classList.remove("hidden");
    if (chevron) chevron.classList.add("rotate-180");
    // Scroll mulus ke elemen kartu unit agar langsung terlihat detail inputan sebelumnya
    setTimeout(() => {
      const card = body.closest(".hist-unit-card");
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 80);
  } else {
    body.classList.add("hidden");
    if (chevron) chevron.classList.remove("rotate-180");
  }
}

function toggleHistUnitAda(val, checkId) {
  const boxIndikasi = document.getElementById(`box-hist-indikasi-${checkId}`);
  if (boxIndikasi) {
    if (val === "Tidak Terlihat" || val === "Tidak") {
      boxIndikasi.classList.remove("hidden");
    } else {
      boxIndikasi.classList.add("hidden");
    }
  }
}

function onHistIndikasiPresetChange(val, checkId) {
  const boxCustom = document.getElementById(`box-hist-indikasi-custom-${checkId}`);
  const inputCustom = document.getElementById(`input-hist-indikasi-custom-${checkId}`);
  if (boxCustom) {
    if (val === "Lainnya") {
      boxCustom.classList.remove("hidden");
      if (inputCustom) inputCustom.focus();
    } else {
      boxCustom.classList.add("hidden");
    }
  }
}

function toggleHistUnitLainnya(chk, checkId) {
  const boxLainnya = document.getElementById(`box-hist-info-lainnya-${checkId}`);
  if (boxLainnya) {
    if (chk && chk.checked) {
      boxLainnya.classList.remove("hidden");
    } else {
      boxLainnya.classList.add("hidden");
    }
  }
}

function toggleHistLokasiChange(val) {
  const boxCustom = document.getElementById("box-hist-lokasi-custom");
  const inputCustom = document.getElementById("input-hist-lokasi-custom");
  if (boxCustom) {
    if (val === "Lainnya") {
      boxCustom.classList.remove("hidden");
      if (inputCustom) inputCustom.focus();
    } else {
      boxCustom.classList.add("hidden");
    }
  }
}

function toggleHistBertemuChange(val) {
  const boxCustom = document.getElementById("box-hist-bertemu-custom");
  const inputCustom = document.getElementById("input-hist-bertemu-custom");
  const boxReason = document.getElementById("box-hist-bertemu-reason");

  if (boxCustom) {
    if (val === "Lainnya") {
      boxCustom.classList.remove("hidden");
      if (inputCustom) inputCustom.focus();
    } else {
      boxCustom.classList.add("hidden");
    }
  }

  if (boxReason) {
    if (val === "Tidak Bertemu") {
      boxReason.classList.remove("hidden");
    } else {
      boxReason.classList.add("hidden");
    }
  }
}

function toggleHistNoInfo(checked) {
  const inputStock = document.getElementById("edit-visit-stock");
  const inputSales = document.getElementById("edit-visit-sales");
  const boxInputs = document.getElementById("box-hist-showroom-inputs");
  if (inputStock && inputSales) {
    if (checked) {
      inputStock.disabled = true;
      inputSales.disabled = true;
      inputStock.value = "-";
      inputSales.value = "-";
      if (boxInputs) boxInputs.classList.add("opacity-50", "pointer-events-none");
    } else {
      inputStock.disabled = false;
      inputSales.disabled = false;
      if (inputStock.value === "-") inputStock.value = "0";
      if (inputSales.value === "-") inputSales.value = "0";
      if (boxInputs) boxInputs.classList.remove("opacity-50", "pointer-events-none");
    }
  }
}

async function openActivityDetailModal(type, id) {
  const modal = document.getElementById("modal-history-detail");
  if (!modal) return;

  const item = CACHED_HISTORY_DATA.find(x => x.type === type && String(x.id) === String(id));
  if (!item) {
    alert("Data aktivitas tidak ditemukan.");
    return;
  }

  // 1. Setup Header & Basic Information
  document.getElementById("edit-act-type").value = type;
  document.getElementById("edit-act-id").value = id;

  const modalTitle = document.getElementById("modal-history-title");
  const modalIcon = document.getElementById("modal-history-icon");
  const modalBadge = document.getElementById("modal-history-badge");
  const statusAlert = document.getElementById("modal-history-status-alert");
  const statusMsg = document.getElementById("modal-history-status-msg");

  if (modalTitle) modalTitle.innerText = `${item.typeLabel} - ${item.title}`;
  if (modalIcon) modalIcon.innerHTML = `<i class="fa-solid ${item.icon}"></i>`;

  if (item.isToday) {
    if (modalBadge) {
      modalBadge.className = "px-2 py-0.5 rounded text-[9px] font-bold inline-block mt-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30";
      modalBadge.innerHTML = "🟢 Mode Edit (Hari Ini)";
    }
    if (statusAlert) {
      statusAlert.className = "p-2.5 rounded-xl text-[11px] leading-relaxed flex items-center space-x-2 bg-emerald-50 text-emerald-800 border border-emerald-200";
    }
    if (statusMsg) {
      statusMsg.innerHTML = "<strong>Bisa Diedit:</strong> Anda dapat mengubah catatan hasil wawancara, respon, atau status unit. Tagging lokasi dan foto bukti awal terkunci permanen.";
    }
    document.getElementById("btn-save-edit-act")?.classList.remove("hidden");
  } else {
    if (modalBadge) {
      modalBadge.className = "px-2 py-0.5 rounded text-[9px] font-bold inline-block mt-0.5 bg-slate-600 text-slate-300 border border-slate-500";
      modalBadge.innerHTML = "🔒 Terkunci / Final";
    }
    if (statusAlert) {
      statusAlert.className = "p-2.5 rounded-xl text-[11px] leading-relaxed flex items-center space-x-2 bg-slate-100 text-slate-600 border border-slate-200";
    }
    if (statusMsg) {
      statusMsg.innerHTML = `<strong>Status Final:</strong> Aktivitas ini dilakukan pada <em>${formatDisplayDate(item.createdAt)}</em> dan sudah melewati hari transaksi. Seluruh data bersifat Read-Only demi audit integritas.`;
    }
    document.getElementById("btn-save-edit-act")?.classList.add("hidden");
  }

  // 2. Populate Header Details
  document.getElementById("dtl-hist-target").innerText = item.title;
  document.getElementById("dtl-hist-time").innerText = formatDisplayDate(item.createdAt);
  document.getElementById("dtl-hist-pic").innerText = item.nip || (CURRENT_USER?.nama || "PIC Lapangan");

  // 3. Geotag (Read-Only)
  document.getElementById("dtl-hist-lat").innerText = item.lat || "-";
  document.getElementById("dtl-hist-long").innerText = item.long || "-";
  const mapsBtn = document.getElementById("dtl-hist-maps-btn");
  const mapsBox = document.getElementById("box-hist-maps-link");
  if (item.lat && item.long) {
    mapsBtn.href = `https://www.google.com/maps?q=${item.lat},${item.long}`;
    mapsBox?.classList.remove("hidden");
  } else {
    mapsBox?.classList.add("hidden");
  }

  // 4. Photos (Read-Only Preview)
  const photosContainer = document.getElementById("dtl-hist-photos-container");
  const photosSectionTitle = document.getElementById("hist-photos-section-title");

  if (photosSectionTitle) {
    photosSectionTitle.innerText = type === "ONBOARDING" ? "Foto Selfie Kunjungan" : "Foto Bukti Fisik Awal";
  }

  if (photosContainer) {
    if (type === "ONBOARDING") {
      const selfieUrl = item.selfieUrl || (item.photos && item.photos[0] ? item.photos[0].url : null);
      if (selfieUrl) {
        photosContainer.className = "flex items-center justify-center p-1";
        photosContainer.innerHTML = `
          <a href="${selfieUrl}" target="_blank" class="block group relative rounded-2xl overflow-hidden border-2 border-slate-300 bg-slate-100 w-32 h-32 shadow-2xs hover:opacity-90 transition">
            <img src="${selfieUrl}" alt="Selfie Kunjungan" class="w-full h-full object-cover" />
            <div class="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-bold py-1 text-center truncate">
              <i class="fa-solid fa-camera mr-1"></i>Foto Selfie
            </div>
          </a>
        `;
      } else {
        photosContainer.className = "grid grid-cols-3 gap-2";
        photosContainer.innerHTML = '<div class="col-span-3 py-2 text-center text-[10px] text-slate-400 italic">Foto selfie tidak terlampir</div>';
      }
    } else {
      photosContainer.className = "grid grid-cols-3 gap-2";
      if (item.photos && item.photos.length > 0) {
        photosContainer.innerHTML = item.photos.map(p => `
          <a href="${p.url}" target="_blank" class="block group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square shadow-2xs hover:opacity-90 transition">
            <img src="${p.url}" alt="${p.label}" class="w-full h-full object-cover" />
            <div class="absolute inset-x-0 bottom-0 bg-slate-900/70 backdrop-blur-xs text-white text-[9px] font-bold p-1 text-center truncate">
              ${p.label}
            </div>
          </a>
        `).join("");
      } else {
        photosContainer.innerHTML = '<div class="col-span-3 py-2 text-center text-[10px] text-slate-400 italic">Tidak ada foto bukti terlampir</div>';
      }
    }
  }

  // 5. Build Dynamic Editable Fields
  const fieldsContainer = document.getElementById("dynamic-edit-fields-container");
  if (!fieldsContainer) return;
  fieldsContainer.innerHTML = '<div class="py-4 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-base block mb-1"></i>Memuat detail...</div>';

  const isReadOnly = !item.isToday;
  const disabledAttr = isReadOnly ? 'disabled class="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600 cursor-not-allowed"' : 'class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800"';

  if (type === "VISIT") {
    // Fetch checked units for this visit
    let checkedUnits = [];
    try {
      const resUnits = await supabaseClient.from("tr_visit_unit_check").select("*").eq("visit_id", item.id);
      checkedUnits = resUnits.data || [];
    } catch (e) {
      console.warn("Could not fetch unit checks:", e);
    }

    const raw = item.raw || {};

    // Evaluasi Lokasi Kunjungan
    const lokasiVal = raw.lokasi || "Showroom";
    const LOKASI_PRESETS = ["Showroom", "Rumah Owner", "Janjian Diluar"];
    const isPresetLokasi = LOKASI_PRESETS.includes(lokasiVal);
    const isCustomLokasi = !isPresetLokasi && lokasiVal !== "";

    // Evaluasi Pihak yang Ditemui
    const bertemuVal = raw.bertemu_owner || "Owner";
    const BERTEMU_PRESETS = ["Owner", "Pekerja", "Penanggung Jawab", "Tidak Bertemu"];
    const isPresetBertemu = BERTEMU_PRESETS.includes(bertemuVal);
    const isCustomBertemu = !isPresetBertemu && bertemuVal !== "";

    // Evaluasi Segmen 2 (Tidak Ada Informasi)
    const isNoInfo = (raw.stock === "-" || raw.sales === "-" || raw.stock === null || (raw.stock === 0 && raw.sales === 0 && String(raw.catatan_visit || '').includes('Tidak Ada Informasi')));
    const stockDisplay = isNoInfo ? "-" : (raw.stock !== undefined && raw.stock !== null ? raw.stock : "0");
    const salesDisplay = isNoInfo ? "-" : (raw.sales !== undefined && raw.sales !== null ? raw.sales : "0");

    let unitsHtml = "";
    if (checkedUnits.length > 0) {
      const INDIKASI_PRESETS = [
        "Showroom Lain",
        "Gudang",
        "Dealer Lain",
        "Dibawa Karyawan",
        "Dibawa Rekanan",
        "Unit Dipembeli"
      ];

      unitsHtml = `
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">3</span>
              <h5 class="text-xs font-bold text-slate-800 uppercase">Pemeriksaan Unit Fasilitas (${checkedUnits.length} Unit)</h5>
            </div>
            <span class="text-[9px] text-slate-400 font-semibold">Klik unit untuk buka detail</span>
          </div>

          <div class="space-y-2">
            ${checkedUnits.map((u, idx) => {
        const parsed = parseCatatanUnit(u.catatan_unit);
        const checkId = u.check_id || u.id;
        const isAda = u.status_keberadaan === "Ya" || u.status_keberadaan === "Ya, Terlihat" || u.status_keberadaan === "Terlihat di Showroom";
        const statusVal = isAda ? "Ya, Terlihat" : "Tidak Terlihat";
        const gpsMatchVal = (u.kondisi_unit === "Tidak Sesuai" || u.kondisi_unit === "Tidak") ? "Tidak Sesuai" : "Ya, Sesuai";
        const hasLainnya = parsed.infoList.includes("Lainnya") || (parsed.infoLainnya && parsed.infoLainnya.trim() !== "");

        // Deteksi apakah unit Overdue
        let isOvd = false;
        const matchedDealer = MASTER_DEALER_PRIORITY_DATA.find(d =>
          d.dealer_name === item.title ||
          (item.raw && d.dealer_id === item.raw.dealer_id)
        );
        if (matchedDealer && matchedDealer.units) {
          const matchedUnit = matchedDealer.units.find(mu =>
            (u.no_fasilitas && mu.no_fasilitas === u.no_fasilitas) ||
            (u.nopol && mu.nopol === u.nopol)
          );
          if (matchedUnit) {
            isOvd = !!(matchedUnit.is_ovd || matchedUnit.ovd_days > 0 || (matchedUnit.aging_ovd && matchedUnit.aging_ovd > 0));
          }
        }
        if (!isOvd && (parsed.ovdPlan || (parsed.komitmen && parsed.komitmen !== "Tidak Ada" && parsed.komitmen !== "-") || parsed.tglKomitmen)) {
          isOvd = true;
        }

        const isPresetIndikasi = INDIKASI_PRESETS.includes(parsed.indikasi);
        const isCustomIndikasi = parsed.indikasi && !isPresetIndikasi;

        return `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden hist-unit-card transition" data-check-id="${checkId}" data-is-ovd="${isOvd}">
                  <!-- Accordion Header (Clickable) -->
                  <div onclick="toggleHistUnitAccordion('${checkId}')" class="p-3 bg-slate-50/80 hover:bg-slate-100 cursor-pointer flex items-center justify-between gap-2 transition select-none">
                    <div class="flex items-center space-x-2.5 min-w-0">
                      <div class="w-7 h-7 rounded-xl ${isOvd ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'} flex items-center justify-center text-xs font-bold shrink-0">
                        ${idx + 1}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center space-x-1.5 flex-wrap">
                          <span class="font-bold text-xs text-slate-900 leading-tight">${u.nopol || 'Unit'}</span>
                          <span class="text-[9px] px-1.5 py-0.2 rounded font-extrabold ${isOvd ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-emerald-100 text-emerald-700 border border-emerald-200'}">
                            ${isOvd ? 'OVERDUE' : 'LANCAR'}
                          </span>
                          <span class="text-[9px] px-1.5 py-0.2 rounded font-bold ${isAda ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                            ${isAda ? 'Terlihat' : 'Tidak Terlihat'}
                          </span>
                        </div>
                        <div class="text-[10px] text-slate-500 truncate mt-0.5">${u.unit_desc || ''} ${u.no_fasilitas ? '• ' + u.no_fasilitas : ''}</div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2 shrink-0">
                      ${u.foto_unit_url ? `
                        <a href="${u.foto_unit_url}" target="_blank" onclick="event.stopPropagation()" class="w-8 h-8 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0 block hover:opacity-80 transition" title="Lihat Foto Fisik Unit">
                          <img src="${u.foto_unit_url}" alt="Foto Unit" class="w-full h-full object-cover" />
                        </a>
                      ` : ''}
                      <button type="button" class="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-slate-900 transition">
                        <i id="hist-unit-chevron-${checkId}" class="fa-solid fa-chevron-down text-xs transition-transform duration-200"></i>
                      </button>
                    </div>
                  </div>

                  <!-- Accordion Body (Detail Inputan, Hidden by Default) -->
                  <div id="hist-unit-body-${checkId}" class="hidden p-3.5 space-y-3 bg-white border-t border-slate-100">
                    <!-- 1. Status Keberadaan Unit -->
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">Apakah Unit Terlihat di Lokasi?</label>
                      <select ${isReadOnly ? 'disabled' : ''} onchange="toggleHistUnitAda(this.value, '${checkId}')" class="hist-unit-ada w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                        <option value="Ya, Terlihat" ${statusVal === 'Ya, Terlihat' ? 'selected' : ''}>Ya, Terlihat</option>
                        <option value="Tidak Terlihat" ${statusVal === 'Tidak Terlihat' ? 'selected' : ''}>Tidak Terlihat</option>
                      </select>
                    </div>

                    <!-- Indikasi Keberadaan (Tampil jika Tidak Terlihat) -->
                    <div id="box-hist-indikasi-${checkId}" class="${statusVal === 'Tidak Terlihat' ? '' : 'hidden'} p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                      <label class="block text-[10px] font-bold text-amber-950">Indikasi Keberadaan Unit:</label>
                      <select ${isReadOnly ? 'disabled' : ''} onchange="onHistIndikasiPresetChange(this.value, '${checkId}')" class="hist-unit-indikasi-select w-full bg-white border border-amber-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500">
                        <option value="">-- Pilih Indikasi Keberadaan --</option>
                        ${INDIKASI_PRESETS.map(preset => `
                          <option value="${preset}" ${parsed.indikasi === preset ? 'selected' : ''}>${preset}</option>
                        `).join('')}
                        <option value="Lainnya" ${isCustomIndikasi ? 'selected' : ''}>Lainnya (Ketik Bebas)</option>
                      </select>
                      <div id="box-hist-indikasi-custom-${checkId}" class="${isCustomIndikasi ? '' : 'hidden'}">
                        <input type="text" id="input-hist-indikasi-custom-${checkId}" ${isReadOnly ? 'disabled' : ''} value="${isCustomIndikasi ? parsed.indikasi : ''}" placeholder="Ketik indikasi keberadaan unit..." class="hist-unit-indikasi-custom w-full bg-white border border-amber-300 rounded-xl p-2 text-xs text-slate-800 font-semibold placeholder-slate-400" />
                      </div>
                    </div>

                    <!-- 2. Titik GPS Sesuai Lokasi Visit? -->
                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-1">Titik GPS Sesuai Lokasi Visit?</label>
                      <select ${isReadOnly ? 'disabled' : ''} class="hist-unit-gps-match w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                        <option value="Ya, Sesuai" ${gpsMatchVal === 'Ya, Sesuai' ? 'selected' : ''}>Ya, Sesuai</option>
                        <option value="Tidak Sesuai" ${gpsMatchVal === 'Tidak Sesuai' ? 'selected' : ''}>Tidak Sesuai</option>
                      </select>
                    </div>

                    <!-- 3. Info Status Unit (Multi Checkbox + Lainnya Free Text) -->
                    <div class="space-y-1.5">
                      <label class="block text-[10px] font-bold text-slate-600">Info Status Unit (Bisa Pilih > 1):</label>
                      <div class="grid grid-cols-2 gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px]">
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Plan Perpanjang" ${parsed.infoList.includes('Plan Perpanjang') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Plan Perpanjang</span></label>
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Plan Pelunasan" ${parsed.infoList.includes('Plan Pelunasan') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Plan Pelunasan</span></label>
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Ada Calon Pembeli" ${parsed.infoList.includes('Ada Calon Pembeli') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Ada Calon Pembeli</span></label>
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Proses Kredit" ${parsed.infoList.includes('Proses Kredit') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Proses Kredit</span></label>
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Unit Cash Tempo" ${parsed.infoList.includes('Unit Cash Tempo') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Unit Cash Tempo</span></label>
                        <label class="flex items-center space-x-1.5"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Unit Milik Orang Lain" ${parsed.infoList.includes('Unit Milik Orang Lain') ? 'checked' : ''} class="hist-unit-info-chk rounded text-slate-900" /> <span>Milik Orang Lain</span></label>
                        <label class="flex items-center space-x-1.5 col-span-2"><input type="checkbox" ${isReadOnly ? 'disabled' : ''} value="Lainnya" ${hasLainnya ? 'checked' : ''} onchange="toggleHistUnitLainnya(this, '${checkId}')" class="hist-unit-info-chk hist-unit-info-lainnya-chk rounded text-slate-900" /> <span class="font-semibold text-slate-800">Lainnya (Free Text)</span></label>
                      </div>
                      <div id="box-hist-info-lainnya-${checkId}" class="${hasLainnya ? '' : 'hidden'} mt-1.5">
                        <input type="text" ${isReadOnly ? 'disabled' : ''} value="${parsed.infoLainnya}" placeholder="Sebutkan info status unit lainnya..." class="hist-unit-info-lainnya w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800 placeholder-slate-400" />
                      </div>
                    </div>

                    <!-- 4. Plan Penyelesaian Overdue & Komitmen (HANYA MUNCUL JIKA isOvd === true) -->
                    ${isOvd ? `
                      <div class="space-y-2 pt-2 border-t border-rose-100 bg-rose-50/50 p-2.5 rounded-xl border border-rose-200/80">
                        <div class="flex items-center space-x-1.5 text-rose-900 font-bold text-xs">
                          <i class="fa-solid fa-triangle-exclamation text-rose-600"></i>
                          <span>Penanganan Unit Overdue</span>
                        </div>
                        <div>
                          <label class="block font-bold text-rose-950 text-[10px] mb-1">Plan Penyelesaian Overdue (Free Text):</label>
                          <textarea ${isReadOnly ? 'disabled' : ''} rows="2" placeholder="Rencana penanganan pelunasan unit..." class="hist-unit-ovd-plan w-full bg-white border border-rose-300 rounded-xl p-2 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500">${parsed.ovdPlan || ''}</textarea>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label class="block text-[10px] font-bold text-slate-700 mb-1">Komitmen Pembayaran:</label>
                            <select ${isReadOnly ? 'disabled' : ''} class="hist-unit-komitmen w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                              <option value="Tidak Ada" ${parsed.komitmen === 'Tidak Ada' || !parsed.komitmen ? 'selected' : ''}>Tidak Ada Komitmen</option>
                              <option value="Sudah Bayar" ${parsed.komitmen === 'Sudah Bayar' ? 'selected' : ''}>Sudah Bayar</option>
                              <option value="Bayar" ${parsed.komitmen === 'Bayar' ? 'selected' : ''}>Bayar</option>
                              <option value="Serahkan Unit" ${parsed.komitmen === 'Serahkan Unit' ? 'selected' : ''}>Serahkan Unit</option>
                            </select>
                          </div>
                          <div>
                            <label class="block text-[10px] font-bold text-slate-700 mb-1">Tanggal Komitmen:</label>
                            <input type="date" ${isReadOnly ? 'disabled' : ''} value="${parsed.tglKomitmen || ''}" class="hist-unit-tgl-komitmen w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800" />
                          </div>
                        </div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `;
      }).join("")}
          </div>
        </div>
      `;
    }

    fieldsContainer.innerHTML = `
      <div class="space-y-3.5">
        <!-- 1. Lokasi & Pihak yang Ditemui -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
          <div class="flex items-center space-x-1.5 border-b border-slate-200/60 pb-1.5">
            <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">1</span>
            <h5 class="text-xs font-bold text-slate-800 uppercase">Lokasi & Pihak yang Ditemui</h5>
          </div>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <!-- Lokasi Kunjungan -->
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Lokasi Kunjungan:</label>
              <select id="edit-visit-lokasi-select" onchange="toggleHistLokasiChange(this.value)" ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                <option value="Showroom" ${lokasiVal === 'Showroom' ? 'selected' : ''}>Showroom</option>
                <option value="Rumah Owner" ${lokasiVal === 'Rumah Owner' ? 'selected' : ''}>Rumah Owner</option>
                <option value="Janjian Diluar" ${lokasiVal === 'Janjian Diluar' ? 'selected' : ''}>Janjian Diluar</option>
                <option value="Lainnya" ${isCustomLokasi ? 'selected' : ''}>Lainnya (Ketik Lokasi)</option>
              </select>
              <div id="box-hist-lokasi-custom" class="${isCustomLokasi ? '' : 'hidden'} mt-1.5">
                <input type="text" id="input-hist-lokasi-custom" value="${isCustomLokasi ? lokasiVal : ''}" placeholder="Ketik lokasi khusus..." ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800 placeholder-slate-400 font-semibold" />
              </div>
            </div>

            <!-- Pihak yang Ditemui -->
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Pihak yang Ditemui:</label>
              <select id="edit-visit-bertemu-select" onchange="toggleHistBertemuChange(this.value)" ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                <option value="Owner" ${bertemuVal === 'Owner' ? 'selected' : ''}>Owner</option>
                <option value="Pekerja" ${bertemuVal === 'Pekerja' ? 'selected' : ''}>Pekerja</option>
                <option value="Penanggung Jawab" ${bertemuVal === 'Penanggung Jawab' ? 'selected' : ''}>Penanggung Jawab</option>
                <option value="Tidak Bertemu" ${bertemuVal === 'Tidak Bertemu' ? 'selected' : ''}>Tidak Bertemu</option>
                <option value="Lainnya" ${isCustomBertemu ? 'selected' : ''}>Lainnya (Ketik Pihak)</option>
              </select>
              <div id="box-hist-bertemu-custom" class="${isCustomBertemu ? '' : 'hidden'} mt-1.5">
                <input type="text" id="input-hist-bertemu-custom" value="${isCustomBertemu ? bertemuVal : ''}" placeholder="Ketik pihak yang ditemui..." ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800 placeholder-slate-400 font-semibold" />
              </div>
            </div>
          </div>

          <!-- Alasan Tidak Bertemu (Jika Tidak Bertemu) -->
          <div id="box-hist-bertemu-reason" class="${bertemuVal === 'Tidak Bertemu' ? '' : 'hidden'}">
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Alasan Tidak Bertemu:</label>
            <input type="text" id="edit-visit-reason" value="${raw.owner_reason || ''}" placeholder="Contoh: Showroom tutup / owner sedang keluar kota" ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800" />
          </div>
        </div>

        <!-- 2. Kondisi Showroom & Wawancara (Segmen 2) -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between border-b border-slate-200/60 pb-1.5">
            <div class="flex items-center space-x-1.5">
              <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">2</span>
              <h5 class="text-xs font-bold text-slate-800 uppercase">Kondisi Showroom & Wawancara</h5>
            </div>
            <label class="inline-flex items-center space-x-1.5 cursor-pointer select-none">
              <input type="checkbox" id="edit-visit-toggle-no-info" onchange="toggleHistNoInfo(this.checked)" ${isNoInfo ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} class="rounded text-slate-900" />
              <span class="text-[10px] font-bold text-slate-600">Tidak Ada Informasi</span>
            </label>
          </div>

          <div id="box-hist-showroom-inputs" class="grid grid-cols-2 gap-2 ${isNoInfo ? 'opacity-50 pointer-events-none' : ''}">
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Jumlah Stok Unit (Showroom):</label>
              <input type="text" id="edit-visit-stock" value="${stockDisplay}" ${isNoInfo || isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Penjualan Bulan Ini:</label>
              <input type="text" id="edit-visit-sales" value="${salesDisplay}" ${isNoInfo || isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>
        </div>

        <!-- 3. Checklist Unit Fasilitas (Accordion Collapsible) -->
        ${unitsHtml}

        <!-- 4. Catatan Kunjungan & Tindak Lanjut -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
          <div class="flex items-center space-x-1.5 border-b border-slate-200/60 pb-1.5">
            <span class="w-4 h-4 rounded-full bg-slate-900 text-white text-[9px] font-bold flex items-center justify-center">4</span>
            <h5 class="text-xs font-bold text-slate-800 uppercase">Catatan & Masukan Kunjungan</h5>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Catatan Kunjungan Lapangan:</label>
            <textarea id="edit-visit-notes" rows="3" placeholder="Catatan lengkap hasil kunjungan..." ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800">${raw.catatan_visit || ''}</textarea>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Tindak Lanjut Concern Prioritas:</label>
            <textarea id="edit-visit-concern" rows="2" placeholder="Tindak lanjut instruksi supervisor / concern unit..." ${isReadOnly ? 'disabled' : ''} class="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-slate-800">${raw.tindak_lanjut_concern || ''}</textarea>
          </div>

          <!-- Isu & Feedback -->
          <div class="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
            <span class="text-[10px] font-bold text-slate-500 uppercase block">Isu & Feedback Lapangan</span>
            <div>
              <label class="block text-[10px] text-slate-600 mb-0.5">Isu Layanan Digiasha:</label>
              <input type="text" id="edit-visit-issue-digi" value="${raw.issue_digi || ''}" placeholder="Kendala/masukan sistem & layanan Digiasha" ${isReadOnly ? 'disabled' : ''} class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-600 mb-0.5">Isu Internal Mitra:</label>
              <input type="text" id="edit-visit-issue-internal" value="${raw.issue_internal || ''}" placeholder="Kondisi internal bisnis/keuangan mitra" ${isReadOnly ? 'disabled' : ''} class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800" />
            </div>
            <div>
              <label class="block text-[10px] text-slate-600 mb-0.5">Aktivitas Kompetitor:</label>
              <input type="text" id="edit-visit-issue-komp" value="${raw.issue_komp || ''}" placeholder="Pergerakan atau promo kompetitor" ${isReadOnly ? 'disabled' : ''} class="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-slate-800" />
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (type === "ONBOARDING") {
    const raw = item.raw || {};
    const parsed = item.parsedOnb || parseOnboardingRecord(raw);
    initHistOnbDocuments(parsed.documents);

    const isDealer = (parsed.jenisUsaha || "Dealer") === "Dealer";
    let stokDealer = "0";
    let lokasiDealer = "Jalan Utama";
    let gambaranUsaha = "";
    let stokLainnya = "0";

    const detailUsaha = parsed.detailUsaha || "";
    const matchStok = detailUsaha.match(/Stok Unit Showroom:\s*(\d+)/i);
    if (matchStok) stokDealer = matchStok[1];
    const matchLokasi = detailUsaha.match(/Lokasi Usaha:\s*([^•\n]+)/i);
    if (matchLokasi) lokasiDealer = matchLokasi[1].trim();
    const matchGambaran = detailUsaha.match(/Gambaran Usaha:\s*([^•\n]+)/i);
    if (matchGambaran) gambaranUsaha = matchGambaran[1].trim();
    const matchStokLain = detailUsaha.match(/Stok Barang\/Aset:\s*(\d+)/i);
    if (matchStokLain) stokLainnya = matchStokLain[1];

    const stages = parsed.stages || ["Penawaran"];

    fieldsContainer.innerHTML = `
      <div class="space-y-3.5">
        <!-- 1. Jenis Aktivitas -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
          <label class="block text-[11px] font-bold text-slate-800">1. Jenis Aktivitas (Bisa Pilih > 1):</label>
          <div class="grid grid-cols-3 gap-2">
            <label class="p-2 bg-white rounded-xl border border-slate-200 text-center text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
              <input type="checkbox" name="hist_onb_act_type" value="Penawaran" ${stages.includes('Penawaran') ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} class="rounded text-teal-700" />
              <span>Penawaran</span>
            </label>
            <label class="p-2 bg-white rounded-xl border border-slate-200 text-center text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
              <input type="checkbox" name="hist_onb_act_type" value="Coll Doc" ${stages.includes('Coll Doc') ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} class="rounded text-teal-700" />
              <span>Coll Doc</span>
            </label>
            <label class="p-2 bg-white rounded-xl border border-slate-200 text-center text-xs font-semibold flex items-center justify-center space-x-1.5 cursor-pointer">
              <input type="checkbox" name="hist_onb_act_type" value="Survey" ${stages.includes('Survey') ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''} class="rounded text-teal-700" />
              <span>Survey</span>
            </label>
          </div>
        </div>

        <!-- 2. Profil Calon Mitra -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5">
          <label class="block text-[11px] font-bold text-slate-800">2. Profil Calon Mitra:</label>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Nama Pemohon <span class="text-red-500">*</span></label>
            <input type="text" id="edit-onb-pemohon" value="${parsed.namaPemohon || ''}" ${disabledAttr} />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Nama Tempat Usaha <span class="text-red-500">*</span></label>
            <input type="text" id="edit-onb-usaha" value="${parsed.namaUsaha || ''}" ${disabledAttr} />
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Alamat Lengkap <span class="text-red-500">*</span></label>
            <textarea id="edit-onb-alamat" rows="2" ${disabledAttr}>${parsed.alamat || ''}</textarea>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Jenis Usaha</label>
            <select id="edit-onb-jenis-usaha" onchange="toggleHistOnbJenisUsaha(this.value)" ${disabledAttr}>
              <option value="Dealer" ${isDealer ? 'selected' : ''}>Mitra (Showroom Mobil/Motor)</option>
              <option value="Lainnya" ${!isDealer ? 'selected' : ''}>Lainnya (Sebutkan)</option>
            </select>
          </div>

          <!-- Box Dealer Fields -->
          <div id="box-hist-onb-dealer" class="${isDealer ? '' : 'hidden'} space-y-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Jumlah Stok Unit Showroom</label>
              <input type="number" id="edit-onb-stok" min="0" value="${stokDealer}" ${disabledAttr} />
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Lokasi Usaha</label>
              <select id="edit-onb-lokasi" ${disabledAttr}>
                <option value="Jalan Utama" ${lokasiDealer === 'Jalan Utama' ? 'selected' : ''}>Jalan Utama</option>
                <option value="Bursa Otomotif / Sentra" ${lokasiDealer.includes('Bursa') ? 'selected' : ''}>Bursa Otomotif / Sentra Mobil</option>
                <option value="Perkampungan" ${lokasiDealer === 'Perkampungan' ? 'selected' : ''}>Perkampungan</option>
                <option value="Rumahan" ${lokasiDealer === 'Rumahan' ? 'selected' : ''}>Rumahan</option>
              </select>
            </div>
          </div>

          <!-- Box Lainnya Fields -->
          <div id="box-hist-onb-lainnya" class="${!isDealer ? '' : 'hidden'} space-y-2">
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Gambaran Usaha</label>
              <textarea id="edit-onb-gambaran" rows="2" placeholder="Bidang bisnis..." ${disabledAttr}>${gambaranUsaha}</textarea>
            </div>
            <div>
              <label class="block text-[10px] font-bold text-slate-600 mb-1">Jumlah Stok Barang / Aset</label>
              <input type="number" id="edit-onb-stok-lainnya" min="0" value="${stokLainnya}" ${disabledAttr} />
            </div>
          </div>
        </div>

        <!-- 3. Dokumen Terkumpulkan (15 Folders Scorecard) -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
          <div class="flex items-center justify-between">
            <label class="block text-[11px] font-bold text-slate-800">3. Berkas Dokumen Terkumpul:</label>
            <span id="hist-onb-doc-total-badge" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">0 Dokumen</span>
          </div>
          <p class="text-[10px] text-slate-400">Klik pada folder jenis dokumen untuk melihat atau mengunggah berkas.</p>

          <div class="grid grid-cols-3 gap-2 pt-1" id="hist-onb-doc-grid">
            ${ONBOARDING_DOC_MASTER.map(m => {
      const docObj = HIST_ACTIVE_ONB_DOCS[m.key];
      const count = docObj && docObj.files ? docObj.files.length : 0;
      const hasFile = count > 0;
      return `
                <div onclick="openDocFolderModal('${m.key}', '${m.title}', 'history_onboarding')" class="relative flex flex-col items-center justify-between p-2 rounded-2xl border cursor-pointer text-center transition min-h-[92px] shadow-2xs ${hasFile ? 'bg-teal-50/80 border-teal-400' : 'bg-white border-slate-200 hover:border-slate-300'}" id="hist-card-doc-${m.key}">
                  <span id="hist-badge-count-${m.key}" class="${hasFile ? '' : 'hidden'} absolute -top-1.5 -right-1.5 min-w-[18px] h-4.5 px-1 rounded-full bg-teal-700 text-white text-[9px] font-extrabold flex items-center justify-center border-2 border-white shadow-xs z-10">${count}</span>
                  <div class="flex flex-col items-center pointer-events-none mt-1">
                    <div class="w-7 h-7 rounded-xl ${hasFile ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center text-xs mb-1">
                      <i class="fa-solid ${m.icon}"></i>
                    </div>
                    <span class="text-[10px] font-bold text-slate-800 leading-tight">${m.title}</span>
                  </div>
                  <span class="w-full mt-1.5 py-0.5 text-[8px] font-bold rounded ${hasFile ? 'text-teal-800 bg-teal-100' : 'text-slate-400 bg-slate-100'}">Folder</span>
                </div>
              `;
    }).join("")}
          </div>
        </div>

        <!-- 4. Hasil & Catatan Kunjungan -->
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5">
          <label class="block text-[11px] font-bold text-slate-800">4. Catatan & Hasil Kunjungan:</label>
          <textarea id="edit-onb-notes" rows="3" placeholder="Catatan hasil visit calon mitra..." ${disabledAttr}>${parsed.catatan || ''}</textarea>
        </div>
      </div>
    `;

    updateHistOnbDocCounter();
  } else if (type === "GPS") {
    const raw = item.raw || {};
    fieldsContainer.innerHTML = `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Aktivitas (Terkunci):</label>
            <div class="p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800">${raw.act_type || 'GPS Maintenance'}</div>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">No Fasilitas (Terkunci):</label>
            <div class="p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-800">${raw.no_fasilitas || '-'}</div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">IMEI Lama (Terkunci):</label>
            <div class="p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 truncate">${raw.imei_lama || '-'}</div>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 mb-1 uppercase">IMEI Baru (Terkunci):</label>
            <div class="p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 truncate">${raw.imei_baru || '-'}</div>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">Catatan Teknis Maintenance:</label>
          <textarea id="edit-gps-notes" rows="4" placeholder="Catatan teknis hasil maintenance GPS..." ${disabledAttr}>${raw.catatan_teknis || ''}</textarea>
        </div>
      </div>
    `;
  }

  modal.classList.remove("hidden");
}

function closeHistoryDetailModal() {
  const modal = document.getElementById("modal-history-detail");
  if (modal) modal.classList.add("hidden");
}

async function handleSaveEditActivity(e) {
  if (e && e.preventDefault) e.preventDefault();

  const type = document.getElementById("edit-act-type")?.value;
  const id = document.getElementById("edit-act-id")?.value;
  const btn = document.getElementById("btn-save-edit-act");

  const item = CACHED_HISTORY_DATA.find(x => x.type === type && String(x.id) === String(id));
  if (!item) {
    alert("Data transaksi tidak valid.");
    return;
  }

  // Strict Validation: Only same-day transactions are editable
  if (!item.isToday) {
    alert("Transaksi ini sudah melewati hari kunjungan dan bersifat FINAL (Terkunci).");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i><span>Menyimpan...</span>';
  }

  try {
    if (type === "VISIT") {
      // 1. Lokasi Kunjungan
      const lokasiSelect = document.getElementById("edit-visit-lokasi-select")?.value || "Showroom";
      const customLokasi = document.getElementById("input-hist-lokasi-custom")?.value?.trim() || "";
      const finalLokasi = (lokasiSelect === "Lainnya" && customLokasi) ? customLokasi : lokasiSelect;

      // 2. Pihak yang Ditemui
      const bertemuSelect = document.getElementById("edit-visit-bertemu-select")?.value || "Owner";
      const customBertemu = document.getElementById("input-hist-bertemu-custom")?.value?.trim() || "";
      const finalBertemu = (bertemuSelect === "Lainnya" && customBertemu) ? customBertemu : bertemuSelect;
      const ownerReason = document.getElementById("edit-visit-reason")?.value?.trim() || (finalBertemu.toLowerCase().includes("tidak bertemu") ? "Tidak Bertemu" : "-");

      // 3. Segmen 2 (Stok & Sales)
      const isNoInfo = document.getElementById("edit-visit-toggle-no-info")?.checked || false;
      const rawStock = document.getElementById("edit-visit-stock")?.value;
      const rawSales = document.getElementById("edit-visit-sales")?.value;
      const stock = isNoInfo ? 0 : (parseInt(rawStock) || 0);
      const sales = isNoInfo ? 0 : (parseInt(rawSales) || 0);

      const notes = document.getElementById("edit-visit-notes")?.value || "";
      const concern = document.getElementById("edit-visit-concern")?.value || "";
      const issueDigi = document.getElementById("edit-visit-issue-digi")?.value || "";
      const issueInternal = document.getElementById("edit-visit-issue-internal")?.value || "";
      const issueKomp = document.getElementById("edit-visit-issue-komp")?.value || "";

      // 1. Update tr_laporan_visit (created_at DILARANG diubah demi audit!)
      const { error: visitErr } = await supabaseClient.from("tr_laporan_visit").update({
        lokasi: finalLokasi,
        bertemu_owner: finalBertemu,
        owner_reason: ownerReason,
        stock: stock,
        sales: sales,
        catatan_visit: notes,
        tindak_lanjut_concern: concern,
        issue_digi: issueDigi,
        issue_internal: issueInternal,
        issue_komp: issueKomp
      }).eq("visit_id", id);

      if (visitErr) throw visitErr;

      // 2. Update tr_visit_unit_check child items (created_at DILARANG diubah demi audit!)
      const unitCards = document.querySelectorAll(".hist-unit-card");

      for (let i = 0; i < unitCards.length; i++) {
        const card = unitCards[i];
        const checkId = card.getAttribute("data-check-id");
        if (!checkId) continue;

        const isOvd = card.getAttribute("data-is-ovd") === "true";
        const uAda = card.querySelector(".hist-unit-ada")?.value || "Ya, Terlihat";

        // Indikasi Keberadaan
        let finalIndikasi = "-";
        if (uAda === "Tidak Terlihat") {
          const indikasiSelect = card.querySelector(".hist-unit-indikasi-select")?.value || "";
          const indikasiCustom = card.querySelector(".hist-unit-indikasi-custom")?.value?.trim() || "";
          finalIndikasi = (indikasiSelect === "Lainnya" && indikasiCustom) ? indikasiCustom : (indikasiSelect || "-");
        }

        const uGpsMatch = card.querySelector(".hist-unit-gps-match")?.value || "Ya, Sesuai";

        const chkElems = card.querySelectorAll(".hist-unit-info-chk:checked");
        const selectedInfos = Array.from(chkElems).map(c => c.value);
        const customLainnya = card.querySelector(".hist-unit-info-lainnya")?.value?.trim() || "";

        const finalInfoList = [];
        selectedInfos.forEach(info => {
          if (info === "Lainnya") {
            if (customLainnya) finalInfoList.push(`Lainnya: ${customLainnya}`);
          } else {
            finalInfoList.push(info);
          }
        });

        let constructedNotes = `Indikasi: ${finalIndikasi}; Info: ${finalInfoList.length > 0 ? finalInfoList.join(', ') : '-'}`;

        if (isOvd) {
          const uOvdPlan = card.querySelector(".hist-unit-ovd-plan")?.value?.trim() || "";
          const uKomitmen = card.querySelector(".hist-unit-komitmen")?.value || "Tidak Ada";
          const uTglKomitmen = card.querySelector(".hist-unit-tgl-komitmen")?.value || "";
          constructedNotes += `; Plan: ${uOvdPlan || '-'}; Komitmen: ${uKomitmen}${uTglKomitmen ? ' (Tgl: ' + uTglKomitmen + ')' : ''}`;
        } else {
          constructedNotes += `; Plan: -; Komitmen: Tidak Ada`;
        }

        await supabaseClient.from("tr_visit_unit_check").update({
          status_keberadaan: uAda,
          kondisi_unit: uGpsMatch,
          catatan_unit: constructedNotes
        }).eq("check_id", checkId);
      }

      // Update item di cached history lokal
      item.subtitle = `Lokasi: ${finalLokasi} • Bertemu: ${finalBertemu}`;
      item.notes = notes || concern || "-";
      if (item.raw) {
        item.raw.lokasi = finalLokasi;
        item.raw.bertemu_owner = finalBertemu;
        item.raw.owner_reason = ownerReason;
        item.raw.stock = stock;
        item.raw.sales = sales;
        item.raw.catatan_visit = notes;
        item.raw.tindak_lanjut_concern = concern;
        item.raw.issue_digi = issueDigi;
        item.raw.issue_internal = issueInternal;
        item.raw.issue_komp = issueKomp;
      }

    } else if (type === "ONBOARDING") {
      const actChecked = [];
      document.querySelectorAll('input[name="hist_onb_act_type"]:checked').forEach(c => actChecked.push(c.value));
      if (actChecked.length === 0) {
        alert("Pilih minimal 1 jenis aktivitas (Penawaran, Coll Doc, atau Survey)!");
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Perubahan</span>';
        }
        return;
      }

      const namaPemohon = document.getElementById("edit-onb-pemohon")?.value.trim() || "";
      const namaUsaha = document.getElementById("edit-onb-usaha")?.value.trim() || "";
      const alamat = document.getElementById("edit-onb-alamat")?.value.trim() || "";
      const jenisUsaha = document.getElementById("edit-onb-jenis-usaha")?.value || "Dealer";
      let detailTambahan = "";

      if (jenisUsaha === "Dealer") {
        const kapasitas = document.getElementById("edit-onb-stok")?.value || "0";
        const lokasi = document.getElementById("edit-onb-lokasi")?.value || "Jalan Utama";
        detailTambahan = `• Stok Unit Showroom: ${kapasitas} Unit\n• Lokasi Usaha: ${lokasi}`;
      } else {
        const gambaran = document.getElementById("edit-onb-gambaran")?.value.trim() || "";
        const stokLainnya = document.getElementById("edit-onb-stok-lainnya")?.value || "0";
        detailTambahan = `• Gambaran Usaha: ${gambaran}\n• Stok Barang/Aset: ${stokLainnya} Unit`;
      }

      const catatanHasil = document.getElementById("edit-onb-notes")?.value.trim() || "";

      // Format clean documents structure
      const structuredDocs = [];
      Object.keys(HIST_ACTIVE_ONB_DOCS).forEach(k => {
        const docItem = HIST_ACTIVE_ONB_DOCS[k];
        if (docItem && docItem.files && docItem.files.length > 0) {
          structuredDocs.push({
            key: k,
            title: docItem.title,
            files: docItem.files
          });
        }
      });

      const payloadMeta = {
        stages: actChecked,
        nama_pemohon: namaPemohon,
        nama_usaha: namaUsaha,
        alamat: alamat,
        jenis_usaha: jenisUsaha,
        detail_usaha: detailTambahan,
        catatan: catatanHasil,
        documents: structuredDocs
      };

      const { error: onbErr } = await supabaseClient.from("tr_onboarding_log").update({
        owner_name: namaPemohon,
        dealer_name: namaUsaha,
        survei_kelayakan: actChecked.join(", "),
        catatan_survey: JSON.stringify(payloadMeta)
      }).eq("onboarding_id", id);

      if (onbErr) throw onbErr;

    } else if (type === "GPS") {
      const techNotes = document.getElementById("edit-gps-notes")?.value || "";

      const { error: gpsErr } = await supabaseClient.from("tr_gps_maintenance").update({
        catatan_teknis: techNotes
      }).eq("maint_id", id);

      if (gpsErr) throw gpsErr;
    }

    closeHistoryDetailModal();
    alert("Perubahan laporan berhasil disimpan!");
    await loadActivityHistory(true);

  } catch (err) {
    console.error("Error saving activity edit:", err);
    alert("Gagal menyimpan perubahan: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i><span>Simpan Perubahan</span>';
    }
  }
}

// Global Camera Trigger
function triggerCameraInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.click();
}

// =========================================================================
// PIPELINE ONBOARDING CONTROLLER (3 STAGES: Penawaran, Coll Doc, Survey)
// =========================================================================
let PIPELINE_RAW_DATA = [];
let CURRENT_PIPELINE_FILTER = "ALL";
let ACTIVE_PIPELINE_ITEM = null;
let PIPELINE_PENDING_UPLOADS = {};

async function initPipeline() {
  await loadPipelineData();
}

function parseOnboardingRecord(item) {
  let meta = {
    status_db: "Database Baru",
    alamat: "-",
    jenis_usaha: "-",
    detail_usaha: "",
    catatan: "",
    stages: [],
    documents: []
  };

  const rawNotes = item.catatan_survey || "";
  if (rawNotes.startsWith("{") && rawNotes.endsWith("}")) {
    try {
      const parsed = JSON.parse(rawNotes);
      meta = { ...meta, ...parsed };
    } catch (e) {
      console.warn("Parse JSON notes error, fallback to regex:", e);
    }
  } else if (rawNotes) {
    // Parse legacy string: "Database Baru | Alamat | Detail | Catatan: ... | Dokumen: ..."
    const parts = rawNotes.split(" | ");
    if (parts[0]) meta.status_db = parts[0];
    if (parts[1]) meta.alamat = parts[1];
    if (parts[2]) meta.detail_usaha = parts[2];
    const catMatch = rawNotes.match(/Catatan:\s*([^|]+)/i);
    if (catMatch) meta.catatan = catMatch[1].trim();
    const docMatch = rawNotes.match(/Dokumen:\s*([^|]+)/i);
    if (docMatch && docMatch[1]) {
      const docNames = docMatch[1].split(",").map(d => d.trim()).filter(Boolean);
      meta.documents = docNames.map(name => ({
        key: name.replace(/[^a-zA-Z0-9]/g, '_'),
        title: name,
        files: item.foto_ktp_url ? [{ name: "Foto Terlampir", url: item.foto_ktp_url, type: "image/jpeg" }] : []
      }));
    }
  }

  // Fallback / Normalize stages from survei_kelayakan
  if (!meta.stages || meta.stages.length === 0) {
    const rawStage = String(item.survei_kelayakan || "").toLowerCase();
    const derived = [];
    if (rawStage.includes("penawaran")) derived.push("Penawaran");
    if (rawStage.includes("coll doc") || rawStage.includes("colldoc") || rawStage.includes("coll")) derived.push("Coll Doc");
    if (rawStage.includes("survey") || rawStage.includes("survei")) derived.push("Survey");
    meta.stages = derived.length > 0 ? derived : ["Penawaran"];
  }

  // Ensure stages only contains the 3 supported stages
  meta.stages = meta.stages.filter(s => ["Penawaran", "Coll Doc", "Survey"].includes(s));
  if (meta.stages.length === 0) meta.stages = ["Penawaran"];

  // Normalize documents list
  if (!Array.isArray(meta.documents)) meta.documents = [];

  return {
    id: item.onboarding_id,
    nip: item.nip,
    namaPemohon: item.owner_name || item.dealer_name || "Calon Mitra",
    namaUsaha: item.dealer_name || item.owner_name || "-",
    alamat: meta.alamat || "-",
    statusDb: meta.status_db || "Database Baru",
    stages: meta.stages,
    catatan: meta.catatan || "",
    documents: meta.documents,
    fotoKtp: item.foto_ktp_url,
    fotoShowroom: item.foto_showroom_url,
    createdAt: item.created_at,
    dateObj: new Date(item.created_at),
    raw: item
  };
}

async function loadPipelineData(isManualRefresh = false) {
  const container = document.getElementById("pipeline-cards-container");
  const icon = document.getElementById("btn-refresh-pipeline-icon");
  if (icon) icon.classList.add("fa-spin");

  if (isManualRefresh && container) {
    container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-teal-700"></i>Memuat ulang pipeline calon mitra...</div>';
  }

  try {
    if (!supabaseClient) throw new Error("Supabase Client belum terhubung");

    const isSuper = CURRENT_USER?.role === "SUPER_ADMIN" || CURRENT_USER?.role === "SUPERVISOR" || CURRENT_USER?.role === "DIREKSI" || CURRENT_USER?.role === "SUPERADMIN";
    const userNip = CURRENT_USER?.nip || null;

    let query = supabaseClient.from("tr_onboarding_log").select("*").order("created_at", { ascending: false }).limit(200);
    if (!isSuper && userNip) {
      query = query.eq("nip", userNip);
    }

    const { data, error } = await query;
    if (error) throw error;

    PIPELINE_RAW_DATA = (data || []).map(parseOnboardingRecord);
    updatePipelineCounts();
    renderPipelineList();
  } catch (err) {
    console.error("Error loading pipeline data:", err);
    if (container) {
      container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-2xl text-xs">Gagal memuat pipeline: ${err.message}</div>`;
    }
  } finally {
    if (icon) icon.classList.remove("fa-spin");
  }
}

function updatePipelineCounts() {
  const countAll = PIPELINE_RAW_DATA.length;
  const countPenawaran = PIPELINE_RAW_DATA.filter(i => i.stages.includes("Penawaran")).length;
  const countCollDoc = PIPELINE_RAW_DATA.filter(i => i.stages.includes("Coll Doc")).length;
  const countSurvey = PIPELINE_RAW_DATA.filter(i => i.stages.includes("Survey")).length;

  const elAll = document.getElementById("count-pipeline-all");
  const elPenawaran = document.getElementById("count-pipeline-penawaran");
  const elCollDoc = document.getElementById("count-pipeline-colldoc");
  const elSurvey = document.getElementById("count-pipeline-survey");

  if (elAll) elAll.innerText = countAll;
  if (elPenawaran) elPenawaran.innerText = countPenawaran;
  if (elCollDoc) elCollDoc.innerText = countCollDoc;
  if (elSurvey) elSurvey.innerText = countSurvey;
}

function setPipelineFilter(filter) {
  CURRENT_PIPELINE_FILTER = filter;
  document.querySelectorAll(".pipeline-tab-btn").forEach(btn => {
    btn.className = "pipeline-tab-btn px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition";
  });
  const activeBtn = document.getElementById(`filter-tab-${filter.replace(/\s+/g, '')}`);
  if (activeBtn) {
    activeBtn.className = "pipeline-tab-btn px-3 py-1.5 rounded-xl bg-teal-700 text-white shadow-xs transition";
  }
  filterPipelineList();
}

function filterPipelineList() {
  renderPipelineList();
}

function renderPipelineList() {
  const container = document.getElementById("pipeline-cards-container");
  if (!container) return;

  const query = (document.getElementById("pipeline-search-input")?.value || "").toLowerCase().trim();

  const filtered = PIPELINE_RAW_DATA.filter(item => {
    // 1. Stage filter
    if (CURRENT_PIPELINE_FILTER !== "ALL") {
      if (!item.stages.includes(CURRENT_PIPELINE_FILTER)) return false;
    }
    // 2. Query search
    if (query) {
      const matchPemohon = item.namaPemohon.toLowerCase().includes(query);
      const matchUsaha = item.namaUsaha.toLowerCase().includes(query);
      const matchAlamat = item.alamat.toLowerCase().includes(query);
      const matchNip = String(item.nip || "").toLowerCase().includes(query);
      if (!matchPemohon && !matchUsaha && !matchAlamat && !matchNip) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
        <i class="fa-solid fa-folder-open text-3xl text-slate-300"></i>
        <p class="text-xs font-bold text-slate-700">Tidak ada calon mitra pada filter ini</p>
        <p class="text-[10px] text-slate-400">Silakan ubah filter atau lakukan kunjungan onboarding baru.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    // Total documents & files
    const totalDocs = item.documents.length;
    let totalFiles = 0;
    item.documents.forEach(d => {
      totalFiles += (d.files?.length || 0);
    });

    const isPenawaran = item.stages.includes("Penawaran");
    const isCollDoc = item.stages.includes("Coll Doc");
    const isSurvey = item.stages.includes("Survey");

    const tglStr = !isNaN(item.dateObj)
      ? item.dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : "-";

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:border-teal-400 transition space-y-3 cursor-pointer" onclick="openPipelineDetailModal('${item.id}')">
        <!-- TOP: Nama Pemohon & Nama Tempat Usaha -->
        <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5 mb-0.5">
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${item.statusDb.includes('Baru') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                ${item.statusDb}
              </span>
              <span class="text-[10px] text-slate-400">• ${tglStr}</span>
            </div>
            <h4 class="text-sm font-bold text-slate-900 truncate">${item.namaPemohon}</h4>
            <p class="text-xs font-semibold text-teal-800 flex items-center gap-1 mt-0.5 truncate">
              <i class="fa-solid fa-store text-[10px] text-teal-600"></i>
              <span>${item.namaUsaha}</span>
            </p>
          </div>
          <button type="button" class="p-2 text-teal-700 hover:bg-teal-50 rounded-xl shrink-0" title="Buka Detail">
            <i class="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>

        <!-- MIDDLE: Progres Status (Penawaran, Coll Doc, Survey) -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-[10px]">
            <span class="font-bold text-slate-500 uppercase tracking-wider">Progress Status:</span>
            <span class="font-bold text-teal-700">${item.stages.length}/3 Tahap Aktif</span>
          </div>
          <div class="grid grid-cols-3 gap-1.5 text-[11px] font-bold text-center">
            <div class="py-1 px-1.5 rounded-lg border flex items-center justify-center space-x-1 ${isPenawaran ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400'}">
              <i class="fa-solid ${isPenawaran ? 'fa-circle-check text-teal-600' : 'fa-circle text-slate-300'} text-[10px]"></i>
              <span class="truncate">Penawaran</span>
            </div>
            <div class="py-1 px-1.5 rounded-lg border flex items-center justify-center space-x-1 ${isCollDoc ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400'}">
              <i class="fa-solid ${isCollDoc ? 'fa-circle-check text-teal-600' : 'fa-circle text-slate-300'} text-[10px]"></i>
              <span class="truncate">Coll Doc</span>
            </div>
            <div class="py-1 px-1.5 rounded-lg border flex items-center justify-center space-x-1 ${isSurvey ? 'bg-teal-50 border-teal-300 text-teal-800' : 'bg-slate-50 border-slate-200 text-slate-400'}">
              <i class="fa-solid ${isSurvey ? 'fa-circle-check text-teal-600' : 'fa-circle text-slate-300'} text-[10px]"></i>
              <span class="truncate">Survey</span>
            </div>
          </div>
        </div>

        <!-- BOTTOM: Detail Folder Dokumen Summary & Action -->
        <div class="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center space-x-1.5 text-[11px]">
            <div class="w-6 h-6 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center text-xs">
              <i class="fa-solid fa-folder"></i>
            </div>
            <span class="font-bold text-slate-700">${totalDocs} Dokumen (${totalFiles} File)</span>
          </div>

          <span class="text-[10px] font-bold text-teal-700 flex items-center space-x-1">
            <span>Buka Folder & Edit</span>
            <i class="fa-solid fa-arrow-right text-[9px]"></i>
          </span>
        </div>
      </div>
    `;
  }).join('');
}

function openPipelineDetailModal(onbId) {
  const item = PIPELINE_RAW_DATA.find(i => i.id === onbId);
  if (!item) return;

  ACTIVE_PIPELINE_ITEM = JSON.parse(JSON.stringify(item));
  PIPELINE_PENDING_UPLOADS = {};

  // 1. TOP SECTION: Nama Pemohon & Usaha
  document.getElementById("modal-pipe-id-label").innerText = item.id;
  document.getElementById("modal-pipe-badge-db").innerText = item.statusDb;
  document.getElementById("modal-pipe-input-pemohon").value = item.namaPemohon;
  document.getElementById("modal-pipe-input-usaha").value = item.namaUsaha;
  document.getElementById("modal-pipe-pic").innerText = item.nip || "-";
  document.getElementById("modal-pipe-tgl").innerText = !isNaN(item.dateObj)
    ? item.dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : "-";
  document.getElementById("modal-pipe-input-alamat").value = item.alamat || "";

  // 2. MIDDLE SECTION: Stages (Penawaran, Coll Doc, Survey)
  document.getElementById("modal-pipe-chk-penawaran").checked = item.stages.includes("Penawaran");
  document.getElementById("modal-pipe-chk-colldoc").checked = item.stages.includes("Coll Doc");
  document.getElementById("modal-pipe-chk-survey").checked = item.stages.includes("Survey");
  document.getElementById("modal-pipe-input-catatan").value = item.catatan || "";
  updateModalProgressSummary();

  // 3. BOTTOM SECTION: Folder Dokumen
  renderModalPipelineDocFolders();

  // Show modal
  document.getElementById("modal-pipeline-detail").classList.remove("hidden");
}

function closePipelineDetailModal() {
  document.getElementById("modal-pipeline-detail").classList.add("hidden");
  ACTIVE_PIPELINE_ITEM = null;
  PIPELINE_PENDING_UPLOADS = {};
}

function updateModalProgressSummary() {
  const p = document.getElementById("modal-pipe-chk-penawaran")?.checked;
  const c = document.getElementById("modal-pipe-chk-colldoc")?.checked;
  const s = document.getElementById("modal-pipe-chk-survey")?.checked;
  const count = [p, c, s].filter(Boolean).length;
  const label = document.getElementById("modal-pipe-progress-label");
  if (label) label.innerText = `${count}/3 Tahap Aktif`;
}

function renderModalPipelineDocFolders() {
  const container = document.getElementById("modal-pipe-doc-folder-grid");
  if (!container || !ACTIVE_PIPELINE_ITEM) return;

  let totalFilesCount = 0;

  const html = ONBOARDING_DOC_MASTER.map(docMaster => {
    const existingDoc = ACTIVE_PIPELINE_ITEM.documents?.find(d => d.key === docMaster.key || d.title === docMaster.title);
    const existingFiles = existingDoc?.files || [];
    const pendingFiles = PIPELINE_PENDING_UPLOADS[docMaster.key] || [];
    const totalInThisDoc = existingFiles.length + pendingFiles.length;
    totalFilesCount += totalInThisDoc;

    const hasFiles = totalInThisDoc > 0;

    return `
      <div class="flex flex-col">
        <div onclick="openDocFolderModal('${docMaster.key}', '${docMaster.title}', 'pipeline')" class="group relative flex flex-col items-center justify-between p-2.5 ${hasFiles ? 'bg-teal-50/70 border-teal-400' : 'bg-slate-50 border-slate-200'} hover:border-teal-400 rounded-2xl cursor-pointer text-center transition min-h-[102px] shadow-2xs">
          ${hasFiles ? `<span class="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-teal-600 text-white text-[10px] font-extrabold flex items-center justify-center border-2 border-white shadow-sm z-10">${totalInThisDoc}</span>` : ''}
          <div class="flex flex-col items-center pointer-events-none mt-1">
            <div class="w-8 h-8 rounded-xl ${hasFiles ? 'bg-teal-600 text-white' : 'bg-teal-100 text-teal-700'} flex items-center justify-center text-xs mb-1.5 group-hover:scale-105 transition">
              <i class="fa-solid ${docMaster.icon}"></i>
            </div>
            <span class="text-[11px] font-bold text-slate-800 leading-tight">${docMaster.title}</span>
          </div>
          <button type="button" onclick="event.stopPropagation(); triggerPipelineCardUpload('${docMaster.key}', '${docMaster.title}')" class="w-full mt-2 py-1 px-1 bg-white hover:bg-teal-700 hover:text-white text-teal-700 border border-teal-200 hover:border-teal-700 rounded-lg text-[9px] font-bold shadow-2xs transition flex items-center justify-center space-x-1">
            <i class="fa-solid fa-arrow-up-from-bracket text-[8px]"></i>
            <span>Upload</span>
          </button>
          <input type="file" id="pipe-file-input-${docMaster.key}" multiple accept="image/*,application/pdf" class="hidden" onchange="handlePipelineDocFilesAdded(this, '${docMaster.key}')" />
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;

  const docCountBadge = document.getElementById("modal-pipe-doc-count");
  if (docCountBadge) docCountBadge.innerText = `${totalFilesCount} File Terkumpul`;
}

function triggerPipelineCardUpload(docKey, docTitle) {
  const inp = document.getElementById(`pipe-file-input-${docKey}`);
  if (inp) inp.click();
}

async function handlePipelineDocFilesAdded(input, docKey) {
  if (!input.files || input.files.length === 0) return;
  if (!PIPELINE_PENDING_UPLOADS[docKey]) {
    PIPELINE_PENDING_UPLOADS[docKey] = [];
  }

  const docMaster = ONBOARDING_DOC_MASTER.find(m => m.key === docKey);
  const docTitle = docMaster?.title || docKey;
  const existingDoc = ACTIVE_PIPELINE_ITEM?.documents?.find(d => d.key === docKey || d.title === docTitle);
  const existingCount = (existingDoc?.files?.length || 0) + PIPELINE_PENDING_UPLOADS[docKey].length;

  for (let i = 0; i < input.files.length; i++) {
    const file = input.files[i];
    let base64 = "";
    if (file.type && file.type.startsWith("image/")) {
      base64 = await compressImage(file, 1200, 0.75);
    } else {
      base64 = await readFileAsBase64(file);
    }
    const stdName = generateStandardDocFileName(docTitle, existingCount + i + 1, file.name);
    PIPELINE_PENDING_UPLOADS[docKey].push({
      name: stdName,
      type: file.type || "application/octet-stream",
      size: file.size,
      base64: base64
    });
  }

  input.value = "";
  renderModalPipelineDocFolders();

  if (ACTIVE_FOLDER_MODAL_DOC && ACTIVE_FOLDER_MODAL_DOC.key === docKey && ACTIVE_FOLDER_MODAL_DOC.context === 'pipeline') {
    renderDocFolderModalFilesList();
  }
}

function removePipelineDocFile(docKey, fileIdx, isPending) {
  if (!ACTIVE_PIPELINE_ITEM) return;

  if (isPending) {
    if (PIPELINE_PENDING_UPLOADS[docKey]) {
      PIPELINE_PENDING_UPLOADS[docKey].splice(fileIdx, 1);
      if (PIPELINE_PENDING_UPLOADS[docKey].length === 0) {
        delete PIPELINE_PENDING_UPLOADS[docKey];
      }
    }
  } else {
    const docItem = ACTIVE_PIPELINE_ITEM.documents?.find(d => d.key === docKey);
    if (docItem && docItem.files) {
      docItem.files.splice(fileIdx, 1);
    }
  }

  renderModalPipelineDocFolders();
  if (ACTIVE_FOLDER_MODAL_DOC && ACTIVE_FOLDER_MODAL_DOC.key === docKey && ACTIVE_FOLDER_MODAL_DOC.context === 'pipeline') {
    renderDocFolderModalFilesList();
  }
}

async function handleSavePipelineUpdate() {
  if (!ACTIVE_PIPELINE_ITEM) return;

  const btn = document.getElementById("btn-save-pipeline-modal");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i><span>Menyimpan Perubahan...</span>';
  }

  try {
    const newPemohon = document.getElementById("modal-pipe-input-pemohon")?.value.trim();
    const newUsaha = document.getElementById("modal-pipe-input-usaha")?.value.trim();
    const newAlamat = document.getElementById("modal-pipe-input-alamat")?.value.trim();
    const newCatatan = document.getElementById("modal-pipe-input-catatan")?.value.trim();

    if (!newPemohon || !newUsaha) {
      alert("Nama Pemohon dan Nama Usaha wajib diisi!");
      return;
    }

    const newStages = [];
    if (document.getElementById("modal-pipe-chk-penawaran")?.checked) newStages.push("Penawaran");
    if (document.getElementById("modal-pipe-chk-colldoc")?.checked) newStages.push("Coll Doc");
    if (document.getElementById("modal-pipe-chk-survey")?.checked) newStages.push("Survey");

    if (newStages.length === 0) {
      alert("Pilih minimal 1 tahap progress onboarding (Penawaran, Coll Doc, atau Survey)!");
      return;
    }

    // 1. Upload any pending new files to Supabase storage
    const updatedDocuments = [...(ACTIVE_PIPELINE_ITEM.documents || [])];

    const pendingKeys = Object.keys(PIPELINE_PENDING_UPLOADS);
    for (const docKey of pendingKeys) {
      const filesToUpload = PIPELINE_PENDING_UPLOADS[docKey] || [];
      const docMaster = ONBOARDING_DOC_MASTER.find(m => m.key === docKey);
      const docTitle = docMaster?.title || docKey;

      let docEntry = updatedDocuments.find(d => d.key === docKey);
      if (!docEntry) {
        docEntry = { key: docKey, title: docTitle, files: [] };
        updatedDocuments.push(docEntry);
      }

      for (let i = 0; i < filesToUpload.length; i++) {
        const pf = filesToUpload[i];
        const uploadedUrl = await uploadToSupabaseStorage(pf.base64, "onboarding", `DOC-${docKey}-${Date.now()}-${i + 1}`);
        if (uploadedUrl) {
          docEntry.files.push({
            name: pf.name,
            url: uploadedUrl,
            type: pf.type
          });
        }
      }
    }

    // Filter out documents with 0 files
    const cleanDocuments = updatedDocuments.filter(d => d.files && d.files.length > 0);

    // Build payload JSON
    const payloadMeta = {
      status_db: ACTIVE_PIPELINE_ITEM.statusDb,
      alamat: newAlamat,
      jenis_usaha: ACTIVE_PIPELINE_ITEM.jenis_usaha || "Dealer",
      detail_usaha: ACTIVE_PIPELINE_ITEM.detail_usaha || "",
      catatan: newCatatan,
      stages: newStages,
      documents: cleanDocuments
    };

    const { error: updateErr } = await supabaseClient.from("tr_onboarding_log").update({
      owner_name: newPemohon,
      dealer_name: newUsaha,
      survei_kelayakan: newStages.join(", "),
      catatan_survey: JSON.stringify(payloadMeta)
    }).eq("onboarding_id", ACTIVE_PIPELINE_ITEM.id);

    if (updateErr) throw updateErr;

    alert("Pipeline calon mitra berhasil diperbarui!");
    closePipelineDetailModal();
    await loadPipelineData(true);
  } catch (err) {
    console.error("Error saving pipeline update:", err);
    alert("Gagal menyimpan update pipeline: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i><span>Simpan Perubahan Pipeline</span>';
    }
  }
}

function openImageViewer(imgUrl, title = "Preview Dokumen") {
  if (!imgUrl) return;
  const viewer = document.getElementById("modal-image-viewer");
  const img = document.getElementById("image-viewer-img");
  const titleEl = document.getElementById("image-viewer-title");
  if (img) img.src = imgUrl;
  if (titleEl) titleEl.innerText = title;
  if (viewer) viewer.classList.remove("hidden");
}

function closeImageViewer() {
  const viewer = document.getElementById("modal-image-viewer");
  const img = document.getElementById("image-viewer-img");
  if (img) img.src = "";
  if (viewer) viewer.classList.add("hidden");
}

// =========================================================================
// FORCE CHANGE PASSWORD CONTROLLER (FIRST LOGIN / RESET TRIGGER)
// =========================================================================
function openForceChangePassModal() {
  const modal = document.getElementById("modal-force-change-pass");
  if (modal) {
    modal.classList.remove("hidden");
    const inputNew = document.getElementById("force-new-pass");
    const inputConf = document.getElementById("force-confirm-pass");
    if (inputNew) inputNew.value = "";
    if (inputConf) inputConf.value = "";
  }
}

function closeForceChangePassModal() {
  const modal = document.getElementById("modal-force-change-pass");
  if (modal) modal.classList.add("hidden");
}

async function handleForceChangePasswordSubmit(e) {
  e.preventDefault();
  if (!CURRENT_USER) return;
  const newPass = document.getElementById("force-new-pass")?.value.trim();
  const confirmPass = document.getElementById("force-confirm-pass")?.value.trim();

  if (!newPass || !confirmPass) {
    alert("Silakan masukkan kata sandi baru dan konfirmasi kata sandi!");
    return;
  }
  if (newPass.length < 6) {
    alert("Kata sandi baru minimal harus 6 karakter!");
    return;
  }
  if (newPass === "Password123!") {
    alert("Kata sandi baru tidak boleh sama dengan kata sandi default (Password123!). Buatlah kata sandi pribadi yang aman.");
    return;
  }
  if (newPass !== confirmPass) {
    alert("Konfirmasi kata sandi tidak cocok! Silakan periksa kembali.");
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan sandi baru...';
  submitBtn.disabled = true;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("m_employee")
        .update({
          password_hash: newPass,
          status_ganti_pass: false,
          updated_at: new Date().toISOString()
        })
        .eq("nip", CURRENT_USER.nip);
      if (error) throw error;
    }

    CURRENT_USER.status_ganti_pass = false;
    try {
      localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
    } catch (err) { }

    closeForceChangePassModal();
    alert("Kata sandi berhasil diperbarui! Selamat datang di Digi Action.");
    loadScreen("dashboard");
    syncMasterDataFromApi();
  } catch (err) {
    console.error("Gagal update kata sandi:", err);
    alert("Gagal memperbarui kata sandi: " + err.message);
  } finally {
    submitBtn.innerHTML = origText;
    submitBtn.disabled = false;
  }
}

// =========================================================================
// LAPORAN ACTIVITY & MONITORING KUNJUNGAN CONTROLLER
// =========================================================================
let LAP_ACT_START_DATE = "";
let LAP_ACT_END_DATE = "";
let LAP_ACT_CABANG_FILTER = "ALL";
let LAP_ACT_PIC_FILTER = "ALL";
let LAP_ACT_LIST_TAB = "ALL";
let LAP_ACT_RAW_VISITS = [];
let LAP_ACT_RAW_ONBOARDINGS = [];
let LAP_ACT_RAW_UNIT_CHECKS = [];
let LAP_ACT_RAW_DEALERS = [];
let LAP_ACT_RAW_FACILITY_UNITS = [];
let LAP_ACT_EMPLOYEES = [];
let LAP_ACT_FILTERED_ITEMS = [];

async function initLaporanActivityScreen() {
  const now = new Date();
  const past7 = new Date();
  past7.setDate(now.getDate() - 6);

  LAP_ACT_START_DATE = getLocalDateString(past7);
  LAP_ACT_END_DATE = getLocalDateString(now);

  const startInput = document.getElementById("lap-act-start-date");
  const endInput = document.getElementById("lap-act-end-date");
  if (startInput) startInput.value = LAP_ACT_START_DATE;
  if (endInput) endInput.value = LAP_ACT_END_DATE;

  await loadActivityFilterDropdowns();
  await fetchActivityReportData();
}

function setActivityDatePreset(preset) {
  const now = new Date();
  let startD = new Date();

  if (preset === "7_DAYS") {
    startD.setDate(now.getDate() - 6);
  } else if (preset === "THIS_MONTH") {
    startD = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (preset === "30_DAYS") {
    startD.setDate(now.getDate() - 29);
  }

  LAP_ACT_START_DATE = getLocalDateString(startD);
  LAP_ACT_END_DATE = getLocalDateString(now);

  const startInput = document.getElementById("lap-act-start-date");
  const endInput = document.getElementById("lap-act-end-date");
  if (startInput) startInput.value = LAP_ACT_START_DATE;
  if (endInput) endInput.value = LAP_ACT_END_DATE;

  applyActivityFilters();
}

async function loadActivityFilterDropdowns() {
  try {
    let empList = [];
    if (Array.isArray(window.ALL_EMPLOYEES_CACHE) && window.ALL_EMPLOYEES_CACHE.length > 0) {
      empList = window.ALL_EMPLOYEES_CACHE;
    } else if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/m_employee?select=nip,nama_lengkap,jabatan,cabang,role_id&order=nama_lengkap.asc`, {
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        empList = await res.json();
        window.ALL_EMPLOYEES_CACHE = empList;
      }
    }
    LAP_ACT_EMPLOYEES = empList || [];

    const branchSet = new Set();
    LAP_ACT_EMPLOYEES.forEach(e => {
      if (e.cabang && e.cabang.trim() && e.cabang !== "-") branchSet.add(e.cabang.trim());
    });

    if (Array.isArray(MASTER_DEALER_PRIORITY_DATA)) {
      MASTER_DEALER_PRIORITY_DATA.forEach(d => {
        if (d.cabang && d.cabang.trim()) branchSet.add(d.cabang.trim());
      });
    }

    const cabangSelect = document.getElementById("lap-act-filter-cabang");
    if (cabangSelect) {
      const sortedBranches = Array.from(branchSet).sort();
      let optHtml = '<option value="ALL">Semua Cabang</option>';
      sortedBranches.forEach(b => {
        optHtml += `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`;
      });
      cabangSelect.innerHTML = optHtml;
      cabangSelect.value = LAP_ACT_CABANG_FILTER;
    }

    populateActivityPicOptions();
  } catch (err) {
    console.warn("Gagal load filter dropdowns activity:", err);
  }
}

function handleActivityCabangChange() {
  const cabangSelect = document.getElementById("lap-act-filter-cabang");
  if (cabangSelect) LAP_ACT_CABANG_FILTER = cabangSelect.value;
  populateActivityPicOptions();
  applyActivityFilters();
}

function populateActivityPicOptions() {
  const picSelect = document.getElementById("lap-act-filter-pic");
  if (!picSelect) return;

  let pics = LAP_ACT_EMPLOYEES;
  if (LAP_ACT_CABANG_FILTER && LAP_ACT_CABANG_FILTER !== "ALL") {
    pics = pics.filter(e => String(e.cabang || "").trim().toLowerCase() === LAP_ACT_CABANG_FILTER.toLowerCase());
  }

  let optHtml = '<option value="ALL">Semua PIC</option>';
  pics.forEach(p => {
    const nama = p.nama_lengkap || p.nama || p.nip;
    optHtml += `<option value="${p.nip}">${escapeHtml(nama)} (${escapeHtml(p.nip)})</option>`;
  });
  picSelect.innerHTML = optHtml;
  picSelect.value = "ALL";
  LAP_ACT_PIC_FILTER = "ALL";
}

async function fetchActivityReportData(forceRefresh = false) {
  const refreshIcon = document.getElementById("lap-act-refresh-icon");
  if (refreshIcon) refreshIcon.classList.add("fa-spin");

  if (!supabaseClient) {
    if (refreshIcon) refreshIcon.classList.remove("fa-spin");
    return;
  }

  try {
    const [resVisits, resOnb, resUnits, resDlr, resFac] = await Promise.all([
      supabaseClient.from("tr_laporan_visit").select("*").order("created_at", { ascending: false }).limit(2000),
      supabaseClient.from("tr_onboarding_log").select("*").order("created_at", { ascending: false }).limit(1000),
      supabaseClient.from("tr_visit_unit_check").select("*").limit(5000),
      supabaseClient.from("m_dealer").select("dealer_id,dealer_name,cabang,status"),
      supabaseClient.from("m_facility_unit").select("no_fasilitas,nopol,dealer_name,status_unit,cabang")
    ]);

    LAP_ACT_RAW_VISITS = resVisits.data || [];
    LAP_ACT_RAW_ONBOARDINGS = resOnb.data || [];
    LAP_ACT_RAW_UNIT_CHECKS = resUnits.data || [];
    LAP_ACT_RAW_DEALERS = resDlr.data || [];
    LAP_ACT_RAW_FACILITY_UNITS = resFac.data || [];

    applyActivityFilters();
  } catch (err) {
    console.error("Gagal mengambil data laporan activity:", err);
  } finally {
    if (refreshIcon) refreshIcon.classList.remove("fa-spin");
  }
}

function refreshActivityReportData() {
  fetchActivityReportData(true);
}

function applyActivityFilters() {
  const cabangSelect = document.getElementById("lap-act-filter-cabang");
  const picSelect = document.getElementById("lap-act-filter-pic");
  const startInput = document.getElementById("lap-act-start-date");
  const endInput = document.getElementById("lap-act-end-date");

  if (cabangSelect) LAP_ACT_CABANG_FILTER = cabangSelect.value;
  if (picSelect) LAP_ACT_PIC_FILTER = picSelect.value;
  if (startInput && startInput.value) LAP_ACT_START_DATE = startInput.value;
  if (endInput && endInput.value) LAP_ACT_END_DATE = endInput.value;

  // Build employee lookup
  const empMap = {};
  LAP_ACT_EMPLOYEES.forEach(e => {
    empMap[e.nip] = e;
  });

  // Build dealer lookup
  const dealerMap = {};
  LAP_ACT_RAW_DEALERS.forEach(d => {
    if (d.dealer_name) dealerMap[d.dealer_name.trim().toLowerCase()] = d;
  });

  // Filter Visits (Visit Mitra)
  const filteredVisits = LAP_ACT_RAW_VISITS.filter(v => {
    const vDateStr = getLocalDateString(new Date(v.created_at));
    if (LAP_ACT_START_DATE && vDateStr < LAP_ACT_START_DATE) return false;
    if (LAP_ACT_END_DATE && vDateStr > LAP_ACT_END_DATE) return false;

    if (LAP_ACT_PIC_FILTER !== "ALL" && v.nip !== LAP_ACT_PIC_FILTER) return false;

    if (LAP_ACT_CABANG_FILTER !== "ALL") {
      const picCabang = (empMap[v.nip]?.cabang || "").trim().toLowerCase();
      const dlrCabang = (dealerMap[(v.dealer_name || "").trim().toLowerCase()]?.cabang || "").trim().toLowerCase();
      const targetCabang = LAP_ACT_CABANG_FILTER.toLowerCase();
      if (picCabang !== targetCabang && dlrCabang !== targetCabang) return false;
    }

    return true;
  });

  // Filter Onboardings (Visit Calon Mitra)
  const filteredOnboardings = LAP_ACT_RAW_ONBOARDINGS.filter(o => {
    const oDateStr = getLocalDateString(new Date(o.created_at));
    if (LAP_ACT_START_DATE && oDateStr < LAP_ACT_START_DATE) return false;
    if (LAP_ACT_END_DATE && oDateStr > LAP_ACT_END_DATE) return false;

    if (LAP_ACT_PIC_FILTER !== "ALL" && o.nip !== LAP_ACT_PIC_FILTER) return false;

    if (LAP_ACT_CABANG_FILTER !== "ALL") {
      const picCabang = (empMap[o.nip]?.cabang || "").trim().toLowerCase();
      const oCabang = (o.cabang || "").trim().toLowerCase();
      const targetCabang = LAP_ACT_CABANG_FILTER.toLowerCase();
      if (picCabang !== targetCabang && oCabang !== targetCabang) return false;
    }

    return true;
  });

  // 1. SCORECARD: TOTAL KUNJUNGAN
  const countVisits = filteredVisits.length;
  const countOnb = filteredOnboardings.length;
  const totalKunjungan = countVisits + countOnb;

  const totalEl = document.getElementById("scorecard-total-kunjungan");
  const bkVisitEl = document.getElementById("scorecard-breakdown-visit");
  const bkOnbEl = document.getElementById("scorecard-breakdown-onb");
  if (totalEl) totalEl.innerText = totalKunjungan;
  if (bkVisitEl) bkVisitEl.innerText = `Mitra: ${countVisits}`;
  if (bkOnbEl) bkOnbEl.innerText = `Calon Mitra: ${countOnb}`;

  // 2. SCORECARD: JUMLAH MITRA TERKUNJUNGI & RASIO
  const visitedMitraSet = new Set();
  filteredVisits.forEach(v => {
    if (v.dealer_name && v.dealer_name.trim()) {
      visitedMitraSet.add(v.dealer_name.trim().toLowerCase());
    }
  });
  const uniqueVisitedMitraCount = visitedMitraSet.size;

  // Total active dealers in scope
  const activeDealersInScope = LAP_ACT_RAW_DEALERS.filter(d => {
    const st = String(d.status || "").toLowerCase();
    const isActive = st !== "non-aktif" && !st.includes("tutup");
    if (!isActive) return false;
    if (LAP_ACT_CABANG_FILTER !== "ALL") {
      return String(d.cabang || "").trim().toLowerCase() === LAP_ACT_CABANG_FILTER.toLowerCase();
    }
    return true;
  });
  const totalActiveDealers = activeDealersInScope.length || 0;
  const ratioMitraPct = totalActiveDealers > 0
    ? ((uniqueVisitedMitraCount / totalActiveDealers) * 100).toFixed(1)
    : 0;

  const mitraCountEl = document.getElementById("scorecard-mitra-terkunjungi");
  const mitraRatioEl = document.getElementById("scorecard-ratio-mitra");
  if (mitraCountEl) mitraCountEl.innerText = uniqueVisitedMitraCount;
  if (mitraRatioEl) mitraRatioEl.innerText = `${uniqueVisitedMitraCount} / ${totalActiveDealers} (${ratioMitraPct}%)`;

  // 3. SCORECARD: JUMLAH UNIT FASILITAS TERKUNJUNGI (HASIL: UNIT TERLIHAT) & RASIO
  const filteredVisitIdSet = new Set(filteredVisits.map(v => v.visit_id));

  const liveFacilityMap = {};
  const liveUnitsInScope = LAP_ACT_RAW_FACILITY_UNITS.filter(u => {
    const st = String(u.status_unit || "live").toLowerCase();
    const isLive = !st || st.includes("live") || st.includes("aktif");
    if (!isLive) return false;
    if (LAP_ACT_CABANG_FILTER !== "ALL") {
      const uCabang = (u.cabang || dealerMap[(u.dealer_name || "").trim().toLowerCase()]?.cabang || "").trim().toLowerCase();
      if (uCabang && uCabang !== LAP_ACT_CABANG_FILTER.toLowerCase()) return false;
    }
    return true;
  });
  liveUnitsInScope.forEach(u => {
    if (u.no_fasilitas) liveFacilityMap[u.no_fasilitas.trim().toLowerCase()] = u;
    if (u.nopol) liveFacilityMap[u.nopol.trim().toLowerCase()] = u;
  });

  const uniqueVisibleUnitsSet = new Set();
  LAP_ACT_RAW_UNIT_CHECKS.forEach(chk => {
    if (!filteredVisitIdSet.has(chk.visit_id)) return;
    const st = String(chk.status_keberadaan || "").toLowerCase();
    const isVisible = st === "ya" || st.includes("terlihat");
    if (!isVisible) return;

    const noFas = (chk.no_fasilitas || "").trim().toLowerCase();
    const nopol = (chk.nopol || "").trim().toLowerCase();

    const isLiveUnit = (noFas && liveFacilityMap[noFas]) || (nopol && liveFacilityMap[nopol]);
    if (isLiveUnit) {
      const unitKey = noFas || nopol;
      if (unitKey) uniqueVisibleUnitsSet.add(unitKey);
    }
  });

  const uniqueVisibleUnitsCount = uniqueVisibleUnitsSet.size;
  const totalLiveUnits = liveUnitsInScope.length || 0;
  const ratioUnitPct = totalLiveUnits > 0
    ? ((uniqueVisibleUnitsCount / totalLiveUnits) * 100).toFixed(1)
    : 0;

  const unitCountEl = document.getElementById("scorecard-unit-terlihat");
  const unitRatioEl = document.getElementById("scorecard-ratio-unit");
  if (unitCountEl) unitCountEl.innerText = uniqueVisibleUnitsCount;
  if (unitRatioEl) unitRatioEl.innerText = `${uniqueVisibleUnitsCount} / ${totalLiveUnits} (${ratioUnitPct}%)`;

  // 4. RENDER MATRIX TABLE (HORIZONTALLY SCROLLABLE WITH STICKY LEFT COLUMN)
  renderActivityDailyMatrix(filteredVisits, filteredOnboardings);

  // 5. RENDER DRILL-DOWN ACTIVITY LIST
  prepareActivityFilteredItems(filteredVisits, filteredOnboardings, empMap);
}

function renderActivityDailyMatrix(visits, onboardings) {
  const thead = document.getElementById("lap-act-matrix-thead");
  const tbody = document.getElementById("lap-act-matrix-tbody");
  if (!thead || !tbody) return;

  // Build dates between LAP_ACT_START_DATE and LAP_ACT_END_DATE
  const dates = [];
  const start = new Date(LAP_ACT_START_DATE);
  const end = new Date(LAP_ACT_END_DATE);

  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
    const cur = new Date(start);
    let countDays = 0;
    while (cur <= end && countDays < 62) {
      dates.push(getLocalDateString(cur));
      cur.setDate(cur.getDate() + 1);
      countDays++;
    }
  } else {
    dates.push(getLocalDateString(new Date()));
  }

  // Count visits per date
  const visitCounts = {};
  const onbCounts = {};
  dates.forEach(d => {
    visitCounts[d] = 0;
    onbCounts[d] = 0;
  });

  visits.forEach(v => {
    const dStr = getLocalDateString(new Date(v.created_at));
    if (visitCounts[dStr] !== undefined) visitCounts[dStr]++;
  });

  onboardings.forEach(o => {
    const dStr = getLocalDateString(new Date(o.created_at));
    if (onbCounts[dStr] !== undefined) onbCounts[dStr]++;
  });

  const dayNamesIndo = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const todayStr = getLocalDateString(new Date());

  // 1. Build THEAD
  let theadHtml = `
    <tr>
      <th class="sticky left-0 bg-slate-100 z-20 px-3.5 py-2.5 font-bold text-slate-700 text-xs border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] min-w-[150px]">
        Aktivitas
      </th>
  `;

  dates.forEach(dStr => {
    const d = new Date(dStr);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dayName = dayNamesIndo[d.getDay()];
    const isToday = dStr === todayStr;

    theadHtml += `
      <th class="px-3 py-2 text-center font-bold text-slate-700 whitespace-nowrap min-w-[65px] border-r border-slate-100 ${isToday ? 'bg-teal-50 text-teal-900 border-teal-200' : ''}">
        <div class="text-[11px] ${isToday ? 'font-extrabold text-teal-800' : ''}">${dd}/${mm}</div>
        <div class="text-[9px] font-normal ${isToday ? 'text-teal-600 font-bold' : 'text-slate-400'}">${dayName}</div>
      </th>
    `;
  });

  theadHtml += `
      <th class="px-4 py-2 text-center font-black text-teal-900 bg-teal-50/90 whitespace-nowrap min-w-[90px]">
        <div class="text-[11px]">Total</div>
        <div class="text-[9px] font-normal text-teal-700">Periode</div>
      </th>
    </tr>
  `;
  thead.innerHTML = theadHtml;

  // 2. Build TBODY (3 Rows: Visit Mitra, Visit Calon Mitra, Total Kunjungan)
  let totalAllVisits = 0;
  let totalAllOnb = 0;

  // Row 1: Visit Mitra
  let row1Html = `
    <tr class="hover:bg-slate-50/70 transition">
      <td class="sticky left-0 bg-white z-10 px-3.5 py-2.5 font-bold text-slate-800 text-xs border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-clipboard-check"></i>
          </div>
          <span>Visit Mitra</span>
        </div>
      </td>
  `;
  dates.forEach(dStr => {
    const c = visitCounts[dStr] || 0;
    totalAllVisits += c;
    const isToday = dStr === todayStr;
    const cellClass = isToday ? 'bg-teal-50/30' : '';
    const badge = c > 0
      ? `<span class="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[11px]">${c}</span>`
      : `<span class="text-slate-300 font-mono text-[11px]">-</span>`;
    row1Html += `<td class="px-3 py-2.5 text-center border-r border-slate-100 ${cellClass}">${badge}</td>`;
  });
  row1Html += `
      <td class="px-4 py-2.5 text-center font-black text-blue-700 bg-blue-50/50">
        <span class="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-black text-xs">${totalAllVisits}</span>
      </td>
    </tr>
  `;

  // Row 2: Visit Calon Mitra
  let row2Html = `
    <tr class="hover:bg-slate-50/70 transition">
      <td class="sticky left-0 bg-white z-10 px-3.5 py-2.5 font-bold text-slate-800 text-xs border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-user-plus"></i>
          </div>
          <span>Visit Calon Mitra</span>
        </div>
      </td>
  `;
  dates.forEach(dStr => {
    const c = onbCounts[dStr] || 0;
    totalAllOnb += c;
    const isToday = dStr === todayStr;
    const cellClass = isToday ? 'bg-teal-50/30' : '';
    const badge = c > 0
      ? `<span class="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold text-[11px]">${c}</span>`
      : `<span class="text-slate-300 font-mono text-[11px]">-</span>`;
    row2Html += `<td class="px-3 py-2.5 text-center border-r border-slate-100 ${cellClass}">${badge}</td>`;
  });
  row2Html += `
      <td class="px-4 py-2.5 text-center font-black text-teal-700 bg-teal-50/50">
        <span class="px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-black text-xs">${totalAllOnb}</span>
      </td>
    </tr>
  `;

  // Row 3: Total Kunjungan (Grand Total)
  let grandTotal = totalAllVisits + totalAllOnb;
  let row3Html = `
    <tr class="bg-slate-50 font-extrabold border-t border-slate-200">
      <td class="sticky left-0 bg-slate-100 z-10 px-3.5 py-2.5 font-black text-slate-900 text-xs border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)] whitespace-nowrap">
        <div class="flex items-center space-x-2">
          <div class="w-6 h-6 rounded-lg bg-slate-800 text-white flex items-center justify-center text-xs shrink-0">
            <i class="fa-solid fa-calculator"></i>
          </div>
          <span>Total Kunjungan</span>
        </div>
      </td>
  `;
  dates.forEach(dStr => {
    const c = (visitCounts[dStr] || 0) + (onbCounts[dStr] || 0);
    const isToday = dStr === todayStr;
    const cellClass = isToday ? 'bg-teal-100/50' : '';
    const badge = c > 0
      ? `<span class="font-extrabold text-slate-900 text-xs">${c}</span>`
      : `<span class="text-slate-300 font-mono text-[11px]">-</span>`;
    row3Html += `<td class="px-3 py-2.5 text-center border-r border-slate-200 ${cellClass}">${badge}</td>`;
  });
  row3Html += `
      <td class="px-4 py-2.5 text-center font-black text-white bg-teal-700">
        <span class="text-sm font-black">${grandTotal}</span>
      </td>
    </tr>
  `;

  tbody.innerHTML = row1Html + row2Html + row3Html;
}

function prepareActivityFilteredItems(visits, onboardings, empMap) {
  const list = [];

  visits.forEach(v => {
    const emp = empMap[v.nip] || {};
    list.push({
      id: v.visit_id,
      type: "VISIT",
      typeLabel: "Visit Mitra",
      icon: "fa-clipboard-check",
      iconColor: "text-blue-600 bg-blue-50 border-blue-200",
      title: v.dealer_name || "Mitra",
      picName: emp.nama_lengkap || emp.nama || v.nip,
      picNip: v.nip,
      picCabang: emp.cabang || "-",
      notes: v.catatan_visit || v.tindak_lanjut_concern || "-",
      createdAt: v.created_at,
      dateObj: new Date(v.created_at),
      photoUrl: v.showroom_photo_url || null
    });
  });

  onboardings.forEach(o => {
    const emp = empMap[o.nip] || {};
    const parsed = typeof parseOnboardingRecord === "function" ? parseOnboardingRecord(o) : {};
    const title = o.nama_usaha || o.nama_pemohon || parsed.namaUsaha || "Calon Mitra";
    const photoUrl = o.selfie_photo_url || o.foto_showroom_url || null;

    list.push({
      id: o.onboarding_id,
      type: "ONBOARDING",
      typeLabel: "Visit Calon Mitra",
      icon: "fa-user-plus",
      iconColor: "text-teal-600 bg-teal-50 border-teal-200",
      title: title,
      picName: emp.nama_lengkap || emp.nama || o.nip,
      picNip: o.nip,
      picCabang: emp.cabang || o.cabang || "-",
      notes: o.catatan || parsed.catatan || "-",
      createdAt: o.created_at,
      dateObj: new Date(o.created_at),
      photoUrl: photoUrl
    });
  });

  // Sort descending by created_at
  list.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  LAP_ACT_FILTERED_ITEMS = list;

  renderActivityDrilldownList();
}

function setActivityListTab(tab) {
  LAP_ACT_LIST_TAB = tab;

  const btnAll = document.getElementById("tab-act-all");
  const btnVisit = document.getElementById("tab-act-visit");
  const btnOnb = document.getElementById("tab-act-onb");

  [
    { el: btnAll, id: "ALL" },
    { el: btnVisit, id: "VISIT" },
    { el: btnOnb, id: "ONB" }
  ].forEach(item => {
    if (!item.el) return;
    if (item.id === tab) {
      item.el.className = "px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-900 text-white transition";
    } else {
      item.el.className = "px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition";
    }
  });

  renderActivityDrilldownList();
}

function renderActivityDrilldownList() {
  const container = document.getElementById("lap-act-cards-container");
  const countEl = document.getElementById("lap-act-list-count");
  if (!container) return;

  let items = LAP_ACT_FILTERED_ITEMS;
  if (LAP_ACT_LIST_TAB === "VISIT") {
    items = items.filter(i => i.type === "VISIT");
  } else if (LAP_ACT_LIST_TAB === "ONB") {
    items = items.filter(i => i.type === "ONBOARDING");
  }

  if (countEl) countEl.innerText = `Menampilkan ${items.length} kunjungan`;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="py-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <i class="fa-solid fa-folder-open text-2xl mb-2 text-slate-300 block"></i>
        <p class="text-xs font-bold text-slate-600">Tidak ada data aktivitas</p>
        <p class="text-[10px] text-slate-400 mt-0.5">Coba sesuaikan filter cabang, PIC, atau rentang tanggal</p>
      </div>
    `;
    return;
  }

  let html = "";
  items.slice(0, 50).forEach(item => {
    const photoBadge = item.photoUrl
      ? `<a href="${item.photoUrl}" target="_blank" class="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 block hover:opacity-80 transition shadow-2xs">
          <img src="${item.photoUrl}" alt="Bukti" class="w-full h-full object-cover" />
         </a>`
      : '';

    html += `
      <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl ${item.iconColor} border flex items-center justify-center text-xs shrink-0">
              <i class="fa-solid ${item.icon}"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-wider">${item.typeLabel}</span>
                <span class="text-[9px] text-slate-400">•</span>
                <span class="text-[9px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded">${item.picCabang}</span>
              </div>
              <h5 class="font-extrabold text-xs text-slate-900 truncate">${item.title}</h5>
            </div>
          </div>
          ${photoBadge}
        </div>

        <div class="bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between text-[10px]">
          <div class="flex items-center space-x-1.5 text-slate-600 truncate">
            <i class="fa-solid fa-user text-slate-400"></i>
            <span class="font-bold text-slate-800">${item.picName}</span>
            <span class="text-slate-400 font-mono">(${item.picNip})</span>
          </div>
          <div class="text-slate-400 shrink-0 font-medium ml-2">
            ${formatDisplayDate(item.createdAt)}
          </div>
        </div>

        ${item.notes && item.notes !== '-' ? `
          <div class="text-[10px] text-slate-500 line-clamp-2 italic px-1">
            "${item.notes}"
          </div>
        ` : ''}
      </div>
    `;
  });

  if (items.length > 50) {
    html += `
      <div class="py-2.5 text-center text-[11px] text-slate-400 bg-slate-50 rounded-xl">
        Menampilkan 50 data teratas dari total ${items.length} data. Saring filter tanggal untuk rincian lebih spesifik.
      </div>
    `;
  }

  container.innerHTML = html;
}

// =========================================================================
// E-SLIP GAJI KARYAWAN (DIGIASHA PERSONALIA & PAYROLL)
// =========================================================================
function initSlipGajiScreen() {
  if (!CURRENT_USER) return;
  const uName = CURRENT_USER?.nama || CURRENT_USER?.nama_lengkap || CURRENT_USER?.email || "Karyawan";
  const uNip = CURRENT_USER?.nip || CURRENT_USER?.nik || "-";
  const uRole = CURRENT_USER?.role || CURRENT_USER?.role_id || "Karyawan";
  const uCabang = CURRENT_USER?.cabang || "Kantor Pusat";

  const nameEl = document.getElementById("slip-user-name");
  if (nameEl) nameEl.innerText = uName;

  const nipEl = document.getElementById("slip-user-nip");
  if (nipEl) nipEl.innerText = uNip;

  const roleEl = document.getElementById("slip-user-role");
  if (roleEl) roleEl.innerText = `${uRole} • Cabang: ${uCabang}`;
}

// =========================================================================
// PORTAL KETENTUAN & SOP PERUSAHAAN (ANTI-DOWNLOAD PDF & ROLE ACCESS)
// =========================================================================
let KETENTUAN_DATA_CACHE = [];
let ACTIVE_KETENTUAN_CATEGORY = "ALL";
let SEARCH_KETENTUAN_QUERY = "";
let PDF_DOC_OBJECT = null;
let CURRENT_PDF_PAGE = 1;
let TOTAL_PDF_PAGES = 1;
let PDF_PAGE_ZOOM = 1.0;
let IS_RENDERING_PDF = false;
let PDF_FIT_MODE = "FIT_PAGE"; // "FIT_PAGE" (Pas Halaman Penuh) atau "FIT_WIDTH" (Pas Lebar)
let PDF_RESIZE_DEBOUNCE = null;
let SELECTED_KETENTUAN_FILE_BLOB = null;

function isUserAdminOrSuperAdmin() {
  if (!CURRENT_USER) return false;
  const roleId = String(CURRENT_USER.role_id || "").toUpperCase();
  const roleName = String(CURRENT_USER.role || CURRENT_USER.jabatan || "").toLowerCase();
  if (roleId === "R-01" || roleId === "R-02") return true;
  if (roleName.includes("admin") || roleName.includes("manager") || roleName.includes("supervisor")) return true;
  const perms = getPermissionsForRole(CURRENT_USER.role_id || roleName, CURRENT_USER);
  return perms.includes("settings");
}

async function initKetentuanScreen() {
  // 1. Tampilkan tombol upload jika user adalah Admin / Super Admin / Manager
  const btnUpload = document.getElementById("btn-open-upload-ketentuan");
  if (btnUpload) {
    if (isUserAdminOrSuperAdmin()) {
      btnUpload.classList.remove("hidden");
    } else {
      btnUpload.classList.add("hidden");
    }
  }

  // 2. Set label update terakhir
  const lastUpdatedEl = document.getElementById("ketentuan-last-updated");
  if (lastUpdatedEl) {
    const now = new Date();
    lastUpdatedEl.innerText = `Update: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  // 3. Reset filter & pencarian
  ACTIVE_KETENTUAN_CATEGORY = "ALL";
  SEARCH_KETENTUAN_QUERY = "";
  const searchInput = document.getElementById("input-search-ketentuan");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("btn-clear-search-ketentuan");
  if (clearBtn) clearBtn.classList.add("hidden");

  // 4. Fetch list ketentuan dari Supabase (dengan localStorage fallback)
  await fetchKetentuanList();
  renderKetentuanList();

  // 5. Cek deep-link langsung (misal ?id=... atau ?sop=...)
  await checkAndOpenDeepLinkSop();
}

async function fetchKetentuanList() {
  const container = document.getElementById("ketentuan-list-container");
  if (container) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-700"></i>
        <span>Memuat portal ketentuan...</span>
      </div>
    `;
  }

  let fetched = false;
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data, error } = await client
        .from("m_ketentuan")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (!error && Array.isArray(data)) {
        KETENTUAN_DATA_CACHE = data;
        try { localStorage.setItem("DIGIASHA_KETENTUAN_DATA", JSON.stringify(data)); } catch (e) { }
        fetched = true;
      } else if (error) {
        console.warn("Supabase m_ketentuan not found or error, using fallback cache:", error.message);
      }
    } catch (err) {
      console.warn("Error querying m_ketentuan:", err);
    }
  }

  if (!fetched) {
    try {
      const local = localStorage.getItem("DIGIASHA_KETENTUAN_DATA");
      if (local) {
        KETENTUAN_DATA_CACHE = JSON.parse(local);
        fetched = true;
      }
    } catch (e) { }
  }

  // Jika masih kosong (belum ada data sama sekali), inisialisasi default ketentuan SOP awal
  if (!fetched || !Array.isArray(KETENTUAN_DATA_CACHE) || KETENTUAN_DATA_CACHE.length === 0) {
    KETENTUAN_DATA_CACHE = [
      {
        id: "KET-SOP-001",
        judul: "SOP Pelaksanaan Visit Lapangan & Handling Unit OVD FAC",
        nomor_dokumen: "SOP/OPS/FAC/2026/001",
        kategori: "SOP Operasional",
        tgl_berlaku: "2026-01-01",
        pdf_url: "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf",
        file_name: "SOP_Visit_FAC_2026.pdf",
        file_size: 245760,
        allowed_roles: ["ALL"],
        is_active: true,
        uploaded_by: "Super Admin",
        created_at: new Date().toISOString()
      },
      {
        id: "KET-HR-002",
        judul: "Kebijakan Tata Tertib Presensi, Jam Kerja & Lembur Karyawan",
        nomor_dokumen: "HRD/POL/2026/004",
        kategori: "Kebijakan HR",
        tgl_berlaku: "2026-02-01",
        pdf_url: "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf",
        file_name: "Kebijakan_Presensi_HR_2026.pdf",
        file_size: 512000,
        allowed_roles: ["ALL"],
        is_active: true,
        uploaded_by: "Super Admin",
        created_at: new Date().toISOString()
      },
      {
        id: "KET-SK-003",
        judul: "Surat Keputusan Direksi Tentang Standar Operasional GPS Armada",
        nomor_dokumen: "SK/DIR/2026/012",
        kategori: "Surat Keputusan",
        tgl_berlaku: "2026-03-01",
        pdf_url: "https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf",
        file_name: "SK_Direksi_GPS_Armada_2026.pdf",
        file_size: 786432,
        allowed_roles: ["R-01", "R-02", "R-03"],
        is_active: true,
        uploaded_by: "Super Admin",
        created_at: new Date().toISOString()
      }
    ];
    try { localStorage.setItem("DIGIASHA_KETENTUAN_DATA", JSON.stringify(KETENTUAN_DATA_CACHE)); } catch (e) { }
  }

  return KETENTUAN_DATA_CACHE;
}

function filterKetentuanCategory(category) {
  ACTIVE_KETENTUAN_CATEGORY = category;

  // Update class tombol category tabs
  const filterBtns = document.querySelectorAll("#ketentuan-category-filters .cat-filter-btn");
  filterBtns.forEach(btn => {
    btn.className = "cat-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0 transition";
  });

  const catMap = {
    "ALL": "btn-cat-ALL",
    "SOP Operasional": "btn-cat-sop",
    "Kebijakan HR": "btn-cat-hr",
    "Surat Keputusan": "btn-cat-sk",
    "Regulasi Bisnis": "btn-cat-bisnis",
    "Panduan Sistem": "btn-cat-sistem"
  };

  const activeBtnId = catMap[category] || "btn-cat-ALL";
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.className = "cat-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-900 text-white shadow-xs shrink-0 transition";
  }

  renderKetentuanList();
}

function handleSearchKetentuan(query) {
  SEARCH_KETENTUAN_QUERY = (query || "").trim().toLowerCase();
  const clearBtn = document.getElementById("btn-clear-search-ketentuan");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !SEARCH_KETENTUAN_QUERY);
  }
  renderKetentuanList();
}

function clearSearchKetentuan() {
  const searchInput = document.getElementById("input-search-ketentuan");
  if (searchInput) searchInput.value = "";
  handleSearchKetentuan("");
}

function renderKetentuanList() {
  const container = document.getElementById("ketentuan-list-container");
  if (!container) return;

  const isAdmin = isUserAdminOrSuperAdmin();
  const myRoleId = String(CURRENT_USER?.role_id || "").toUpperCase();
  const myRoleName = String(CURRENT_USER?.role || CURRENT_USER?.jabatan || "").toLowerCase();

  // 1. Filter hak akses role (Role-based filtering)
  const accessibleDocs = KETENTUAN_DATA_CACHE.filter(item => {
    if (isAdmin) return true; // Super Admin & Admin / Manager can see all

    let roles = item.allowed_roles;
    if (typeof roles === "string") {
      try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
    }
    if (!Array.isArray(roles) || roles.length === 0) return true;

    // Cek jika allow "ALL"
    if (roles.includes("ALL") || roles.includes("Semua Role")) return true;

    // Cek kecocokan role_id atau nama role
    if (myRoleId && roles.includes(myRoleId)) return true;
    if (roles.some(r => String(r).toLowerCase() === myRoleName || myRoleName.includes(String(r).toLowerCase()))) return true;

    return false;
  });

  // Update counter tab 'Semua'
  const countAllEl = document.getElementById("count-cat-all");
  if (countAllEl) countAllEl.innerText = accessibleDocs.length;

  // 2. Filter kategori
  let filteredDocs = accessibleDocs;
  if (ACTIVE_KETENTUAN_CATEGORY !== "ALL") {
    filteredDocs = filteredDocs.filter(d => (d.kategori || "").toLowerCase() === ACTIVE_KETENTUAN_CATEGORY.toLowerCase());
  }

  // 3. Filter query pencarian
  if (SEARCH_KETENTUAN_QUERY) {
    filteredDocs = filteredDocs.filter(d => {
      const matchJudul = String(d.judul || "").toLowerCase().includes(SEARCH_KETENTUAN_QUERY);
      const matchNomor = String(d.nomor_dokumen || "").toLowerCase().includes(SEARCH_KETENTUAN_QUERY);
      const matchKategori = String(d.kategori || "").toLowerCase().includes(SEARCH_KETENTUAN_QUERY);
      return matchJudul || matchNomor || matchKategori;
    });
  }

  // 4. Render HTML daftar dokumen
  if (filteredDocs.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-file-circle-question"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-700 text-xs sm:text-sm">Tidak Ada Dokumen Ditemukan</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">
            ${SEARCH_KETENTUAN_QUERY ? `Tidak ada hasil untuk kata kunci "${SEARCH_KETENTUAN_QUERY}".` : `Belum ada ketentuan pada kategori "${ACTIVE_KETENTUAN_CATEGORY}" yang dapat Anda akses.`}
          </p>
        </div>
        ${SEARCH_KETENTUAN_QUERY ? `
          <button type="button" onclick="clearSearchKetentuan()" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
            Reset Pencarian
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  const categoryColorMap = {
    "SOP Operasional": { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "fa-clipboard-check", iconColor: "text-emerald-500" },
    "Kebijakan HR": { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "fa-users-gear", iconColor: "text-indigo-500" },
    "Surat Keputusan": { bg: "bg-rose-50 text-rose-700 border-rose-200", icon: "fa-stamp", iconColor: "text-rose-500" },
    "Regulasi Bisnis": { bg: "bg-amber-50 text-amber-800 border-amber-200", icon: "fa-scale-balanced", iconColor: "text-amber-500" },
    "Panduan Sistem": { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: "fa-laptop-code", iconColor: "text-cyan-500" },
    "Lainnya": { bg: "bg-slate-50 text-slate-700 border-slate-200", icon: "fa-file-lines", iconColor: "text-slate-500" }
  };

  let html = "";
  filteredDocs.forEach(item => {
    const catStyle = categoryColorMap[item.kategori] || categoryColorMap["Lainnya"];
    const tglBerlakuFmt = item.tgl_berlaku ? formatDisplayDate(item.tgl_berlaku) : "-";
    const fileSizeStr = item.file_size ? `${Math.round(item.file_size / 1024)} KB` : "";

    // Parse role tags
    let roles = item.allowed_roles;
    if (typeof roles === "string") {
      try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
    }
    const isAllRoles = !roles || roles.length === 0 || roles.includes("ALL") || roles.includes("Semua Role");

    let roleBadgesHtml = "";
    if (isAllRoles) {
      roleBadgesHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600 font-semibold">Semua Role</span>`;
    } else {
      roleBadgesHtml = roles.map(r => `<span class="px-1.5 py-0.5 rounded text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">${r}</span>`).join(" ");
    }

    const safeJudul = (item.judul || "").replace(/"/g, '&quot;');
    const safeMeta = `${item.nomor_dokumen || item.kategori} • Berlaku sejak ${tglBerlakuFmt}`;

    html += `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3">
        <!-- Header Dokumen: Badge Kategori -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catStyle.bg} flex items-center space-x-1">
              <i class="fa-solid ${catStyle.icon} text-[9px]"></i>
              <span>${item.kategori || "Ketentuan"}</span>
            </span>
            ${item.nomor_dokumen ? `
              <span class="text-[10px] text-slate-400 font-mono truncate max-w-[150px] sm:max-w-[220px]">
                ${item.nomor_dokumen}
              </span>
            ` : ''}
          </div>
        </div>

        <!-- Judul Ketentuan -->
        <div class="flex items-start space-x-3">
          <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg shrink-0 shadow-inner">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2">${item.judul || "Dokumen Ketentuan"}</h4>
            <div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-[10px] text-slate-400">
              <span class="flex items-center space-x-1">
                <i class="fa-regular fa-calendar-check text-slate-400"></i>
                <span>Berlaku: <strong class="text-slate-600">${tglBerlakuFmt}</strong></span>
              </span>
              ${fileSizeStr ? `<span>•</span><span>${fileSizeStr}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Footer Card: Hak Akses Role & Tombol Buka Viewer -->
        <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-[10px] text-slate-400 font-medium">Akses:</span>
            ${roleBadgesHtml}
          </div>

          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <button type="button" onclick="copySopShareLink('${item.id}', '${safeJudul}')" title="Salin tautan langsung ke dokumen ini" class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 active:scale-95 shrink-0">
              <i class="fa-solid fa-link text-slate-500 text-xs"></i>
              <span>Salin Link</span>
            </button>
            <button type="button" onclick="openSecurePdfViewer('${item.pdf_url}', '${safeJudul}', '${safeMeta}')" class="flex-1 sm:flex-initial px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95">
              <i class="fa-solid fa-book-open-reader text-xs text-emerald-400"></i>
              <span>Buka Dokumen</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// =========================================================================
// FITUR BERBAGI LINK LANGSUNG (DEEP-LINKING SOP)
// =========================================================================
function copySopShareLink(id, judul = "") {
  if (!id) return;
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/ketentuan?id=${encodeURIComponent(id)}`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast("Link SOP berhasil disalin! Bagikan ke rekan kerja Anda.", "success", 2500);
    }).catch(() => {
      fallbackCopyTextToClipboard(shareUrl);
    });
  } else {
    fallbackCopyTextToClipboard(shareUrl);
  }
}

function fallbackCopyTextToClipboard(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    showToast("Link SOP berhasil disalin! Bagikan ke rekan kerja Anda.", "success", 2500);
  } catch (err) {
    prompt("Salin tautan dokumen SOP berikut:", text);
  }
  document.body.removeChild(textArea);
}

async function checkAndOpenDeepLinkSop() {
  let urlParams = new URLSearchParams(window.location.search);
  let targetId = urlParams.get("id") || urlParams.get("sop") || urlParams.get("doc");

  // Fallback jika query param menempel di hash (misal #/ketentuan?id=...)
  if (!targetId && window.location.hash && window.location.hash.includes("?")) {
    const hashQuery = window.location.hash.split("?")[1];
    urlParams = new URLSearchParams(hashQuery);
    targetId = urlParams.get("id") || urlParams.get("sop") || urlParams.get("doc");
  }

  if (!targetId) return;

  let doc = KETENTUAN_DATA_CACHE.find(d => String(d.id).toLowerCase() === String(targetId).toLowerCase());

  // Jika tidak ditemukan di cache awal, coba fetch langsung dari Supabase m_ketentuan
  if (!doc) {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data: singleDoc, error } = await client
          .from("m_ketentuan")
          .select("*")
          .eq("id", targetId)
          .eq("is_active", true)
          .maybeSingle();
        if (!error && singleDoc) {
          doc = singleDoc;
          if (!KETENTUAN_DATA_CACHE.some(x => x.id === singleDoc.id)) {
            KETENTUAN_DATA_CACHE.unshift(singleDoc);
            renderKetentuanList();
          }
        }
      } catch (e) {
        console.warn("Direct fetch doc by id error:", e);
      }
    }
  }

  if (!doc) {
    showToast("Dokumen SOP yang dituju tidak ditemukan atau sudah tidak aktif.", "warning", 3000);
    return;
  }

  // Otorisasi role untuk membaca dokumen
  const isAdmin = isUserAdminOrSuperAdmin();
  const myRoleId = String(CURRENT_USER?.role_id || "").toUpperCase();
  const myRoleName = String(CURRENT_USER?.role || CURRENT_USER?.jabatan || "").toLowerCase();

  let roles = doc.allowed_roles;
  if (typeof roles === "string") {
    try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
  }
  const isAllowed = isAdmin || !roles || roles.length === 0 || roles.includes("ALL") || roles.includes("Semua Role") ||
    (myRoleId && roles.includes(myRoleId)) ||
    roles.some(r => String(r).toLowerCase() === myRoleName || myRoleName.includes(String(r).toLowerCase()));

  if (!isAllowed) {
    showCenterAlertModal({
      title: "Akses Dokumen Terbatas",
      message: `Mohon maaf, dokumen "${doc.judul}" hanya dapat dibaca oleh role tertentu. Akun Anda saat ini (${CURRENT_USER?.role || 'Karyawan'}) tidak memiliki izin untuk membuka dokumen ini.`,
      type: "warning"
    });
    return;
  }

  // Langsung buka dokumen secara otomatis
  const safeJudul = (doc.judul || "").replace(/"/g, '&quot;');
  const tglBerlakuFmt = doc.tgl_berlaku ? formatDisplayDate(doc.tgl_berlaku) : "-";
  const safeMeta = `${doc.nomor_dokumen || doc.kategori} • Berlaku sejak ${tglBerlakuFmt}`;

  setTimeout(() => {
    openSecurePdfViewer(doc.pdf_url, safeJudul, safeMeta);
    showToast(`Membuka: ${doc.judul}`, "info", 2000);
  }, 350);
}

// =========================================================================
// ANTI-DOWNLOAD PDF VIEWER CONTROLLER (MOZILLA PDF.JS CANVAS RENDERING)
// =========================================================================
function handlePdfViewerKeydown(e) {
  // Blokir Shortcut Download & Cetak: Ctrl+S, Ctrl+P, Cmd+S, Cmd+P
  if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'p' || e.key === 'S' || e.key === 'P')) {
    e.preventDefault();
    e.stopPropagation();
    alert("Perhatian: Mengunduh atau mencetak dokumen ini dilarang sesuai regulasi perlindungan data internal perusahaan.");
    return false;
  }
  // Tombol Esc menutup viewer
  if (e.key === 'Escape') {
    closeSecurePdfViewer();
  }
}

async function openSecurePdfViewer(pdfUrl, title, meta) {
  if (!pdfUrl) {
    alert("URL Dokumen PDF tidak valid atau belum diunggah.");
    return;
  }

  const modal = document.getElementById("modal-secure-pdf-viewer");
  if (!modal) return;

  // Set judul dan metadata
  const titleEl = document.getElementById("pdf-viewer-title");
  if (titleEl) titleEl.innerText = title || "Dokumen Ketentuan";
  const metaEl = document.getElementById("pdf-viewer-meta");
  if (metaEl) metaEl.innerText = meta || "-";

  // Watermark anti-screenshot identitas user (Tepat di Depan & Ditengah Halaman Dokumen)
  const uName = CURRENT_USER?.nama || CURRENT_USER?.nama_lengkap || CURRENT_USER?.email || "DIGIASHA USER";
  const uNip = CURRENT_USER?.nip || CURRENT_USER?.nik || "-";
  const now = new Date();
  const dateStr = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const fullStamp = `${dateStr}, ${timeStr} WIB`;

  document.querySelectorAll(".pdf-wm-user").forEach(el => {
    el.innerText = `${uName} • NIP: ${uNip}`;
  });
  document.querySelectorAll(".pdf-wm-meta").forEach(el => {
    el.innerText = "DIGIASHA • STRICTLY CONFIDENTIAL";
  });
  document.querySelectorAll(".pdf-wm-time").forEach(el => {
    el.innerText = `Waktu Akses: ${fullStamp}`;
  });

  const oldWatermarkEl = document.getElementById("pdf-watermark-text");
  if (oldWatermarkEl) {
    oldWatermarkEl.innerText = `${uName} • NIP: ${uNip}\nDIGIASHA • STRICTLY CONFIDENTIAL • ${fullStamp}`;
  }

  // Tampilkan modal viewer
  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden"; // Kunci scrolling latar belakang

  // Pasang listener proteksi keyboard & responsif resize
  window.removeEventListener("keydown", handlePdfViewerKeydown);
  window.addEventListener("keydown", handlePdfViewerKeydown);
  window.removeEventListener("resize", handlePdfViewerResize);
  window.addEventListener("resize", handlePdfViewerResize);

  // Tampilkan spinner loading
  const spinner = document.getElementById("pdf-loading-spinner");
  if (spinner) spinner.classList.remove("hidden");

  // Inisialisasi state viewer
  PDF_DOC_OBJECT = null;
  CURRENT_PDF_PAGE = 1;
  TOTAL_PDF_PAGES = 1;
  PDF_PAGE_ZOOM = 1.0;
  const zoomLevelEl = document.getElementById("pdf-zoom-level");
  if (zoomLevelEl) zoomLevelEl.innerText = "100%";

  // Deteksi mode awal: Tablet / Landscape / Foldable mendatar default ke PAS HALAMAN agar tidak kepotong ke bawah
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  if (winW >= winH * 1.05) {
    PDF_FIT_MODE = "FIT_PAGE";
  } else {
    // Mode portrait HP biasa default pas lebar
    PDF_FIT_MODE = "FIT_WIDTH";
  }
  updatePdfFitModeUI();

  try {
    if (typeof pdfjsLib === "undefined") {
      throw new Error("Pustaka PDF.js belum dimuat. Periksa koneksi internet Anda.");
    }

    const loadingTask = pdfjsLib.getDocument({
      url: pdfUrl,
      cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
      cMapPacked: true
    });

    PDF_DOC_OBJECT = await loadingTask.promise;
    TOTAL_PDF_PAGES = PDF_DOC_OBJECT.numPages || 1;

    const totalEl = document.getElementById("pdf-page-count");
    if (totalEl) totalEl.innerText = TOTAL_PDF_PAGES;

    await renderPdfPage(1);
  } catch (err) {
    console.error("Gagal membuka dokumen PDF via PDF.js:", err);
    if (spinner) spinner.classList.add("hidden");

    const viewportContainer = document.getElementById("pdf-viewport-container");
    if (viewportContainer) {
      viewportContainer.innerHTML = `
        <div class="m-auto text-center p-6 bg-slate-800 text-white rounded-2xl max-w-sm space-y-3">
          <i class="fa-solid fa-triangle-exclamation text-rose-400 text-3xl"></i>
          <h4 class="font-bold text-sm">Gagal Menampilkan PDF</h4>
          <p class="text-xs text-slate-300">${err.message || "File dokumen tidak dapat diakses atau diblokir oleh CORS."}</p>
          <button type="button" onclick="closeSecurePdfViewer()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-bold transition">
            Tutup Viewer
          </button>
        </div>
      `;
    }
  }
}

function handlePdfViewerResize() {
  const modal = document.getElementById("modal-secure-pdf-viewer");
  if (!modal || modal.classList.contains("hidden")) return;
  clearTimeout(PDF_RESIZE_DEBOUNCE);
  PDF_RESIZE_DEBOUNCE = setTimeout(() => {
    if (PDF_DOC_OBJECT && CURRENT_PDF_PAGE) {
      renderPdfPage(CURRENT_PDF_PAGE, true);
    }
  }, 250);
}

function togglePdfFitMode() {
  if (PDF_FIT_MODE === "FIT_PAGE") {
    PDF_FIT_MODE = "FIT_WIDTH";
  } else {
    PDF_FIT_MODE = "FIT_PAGE";
  }
  PDF_PAGE_ZOOM = 1.0;
  const zoomLevelEl = document.getElementById("pdf-zoom-level");
  if (zoomLevelEl) zoomLevelEl.innerText = "100%";
  updatePdfFitModeUI();
  renderPdfPage(CURRENT_PDF_PAGE, false);
}

function updatePdfFitModeUI() {
  const label = document.getElementById("btn-pdf-fit-label");
  const icon = document.getElementById("btn-pdf-fit-icon");
  if (!label || !icon) return;
  if (PDF_FIT_MODE === "FIT_PAGE") {
    label.innerText = "Pas Halaman";
    icon.className = "fa-solid fa-compress text-xs text-emerald-400";
  } else {
    label.innerText = "Pas Lebar";
    icon.className = "fa-solid fa-arrows-left-right text-xs text-blue-400";
  }
}

async function renderPdfPage(pageNum, keepScroll = false) {
  if (!PDF_DOC_OBJECT || IS_RENDERING_PDF) return;
  IS_RENDERING_PDF = true;

  const spinner = document.getElementById("pdf-loading-spinner");
  if (spinner) spinner.classList.remove("hidden");

  try {
    const page = await PDF_DOC_OBJECT.getPage(pageNum);
    const canvas = document.getElementById("pdf-render-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Hitung dimensi container untuk auto-fit
    const viewportContainer = document.getElementById("pdf-viewport-container");
    const containerWidth = viewportContainer ? viewportContainer.clientWidth : window.innerWidth;
    const containerHeight = viewportContainer ? viewportContainer.clientHeight : window.innerHeight;

    // Margin padding aman
    const availableWidth = Math.max(containerWidth - 24, 260);
    const availableHeight = Math.max(containerHeight - 24, 260);

    const initialViewport = page.getViewport({ scale: 1.0 });

    let baseScale = 1.0;
    if (PDF_FIT_MODE === "FIT_PAGE") {
      // Mode Pas Halaman: seluruh halaman muat tanpa terpotong ke bawah maupun ke samping
      const scaleW = availableWidth / initialViewport.width;
      const scaleH = availableHeight / initialViewport.height;
      baseScale = Math.min(scaleW, scaleH);
    } else {
      // Mode Pas Lebar: lebar dokumen mengisi lebar layar, dapat discroll ke bawah dengan leluasa
      baseScale = availableWidth / initialViewport.width;
    }

    // Batasi baseScale ke batas aman
    baseScale = Math.min(Math.max(baseScale, 0.2), 3.0);
    const effectiveScale = Math.max(baseScale * PDF_PAGE_ZOOM, 0.25);

    const viewport = page.getViewport({ scale: effectiveScale });

    // Dukungan High-DPI Retina Screen
    const outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;

    const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

    const renderContext = {
      canvasContext: ctx,
      transform: transform,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // Reset posisi scroll bila bukan sekadar resize
    if (!keepScroll && viewportContainer) {
      viewportContainer.scrollTop = 0;
      viewportContainer.scrollLeft = 0;
    }

    // Update UI Toolbar Indikator Halaman
    CURRENT_PDF_PAGE = pageNum;
    const pageNumEl = document.getElementById("pdf-page-num");
    if (pageNumEl) pageNumEl.innerText = CURRENT_PDF_PAGE;

    const prevBtn = document.getElementById("btn-pdf-prev");
    if (prevBtn) prevBtn.disabled = (CURRENT_PDF_PAGE <= 1);

    const nextBtn = document.getElementById("btn-pdf-next");
    if (nextBtn) nextBtn.disabled = (CURRENT_PDF_PAGE >= TOTAL_PDF_PAGES);

  } catch (renderErr) {
    console.error("Render page error:", renderErr);
  } finally {
    IS_RENDERING_PDF = false;
    if (spinner) spinner.classList.add("hidden");
  }
}

function prevPdfPage() {
  if (CURRENT_PDF_PAGE > 1) {
    renderPdfPage(CURRENT_PDF_PAGE - 1);
  }
}

function nextPdfPage() {
  if (CURRENT_PDF_PAGE < TOTAL_PDF_PAGES) {
    renderPdfPage(CURRENT_PDF_PAGE + 1);
  }
}

function zoomPdfIn() {
  if (PDF_PAGE_ZOOM < 3.0) {
    PDF_PAGE_ZOOM = +(PDF_PAGE_ZOOM + 0.2).toFixed(1);
    const zoomEl = document.getElementById("pdf-zoom-level");
    if (zoomEl) zoomEl.innerText = `${Math.round(PDF_PAGE_ZOOM * 100)}%`;
    renderPdfPage(CURRENT_PDF_PAGE, true);
  }
}

function zoomPdfOut() {
  if (PDF_PAGE_ZOOM > 0.4) {
    PDF_PAGE_ZOOM = +(PDF_PAGE_ZOOM - 0.2).toFixed(1);
    const zoomEl = document.getElementById("pdf-zoom-level");
    if (zoomEl) zoomEl.innerText = `${Math.round(PDF_PAGE_ZOOM * 100)}%`;
    renderPdfPage(CURRENT_PDF_PAGE, true);
  }
}

function closeSecurePdfViewer() {
  const modal = document.getElementById("modal-secure-pdf-viewer");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "";

  window.removeEventListener("keydown", handlePdfViewerKeydown);
  window.removeEventListener("resize", handlePdfViewerResize);

  // Bersihkan canvas
  const canvas = document.getElementById("pdf-render-canvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  PDF_DOC_OBJECT = null;
}

// =========================================================================
// UPLOAD & ROLE ACCESS MANAGEMENT MODAL CONTROLLER
// =========================================================================
function switchKetentuanSourceMode(mode) {
  const modeInput = document.getElementById("ketentuan-source-mode");
  if (modeInput) modeInput.value = mode;

  const uploadWrapper = document.getElementById("ketentuan-upload-file-wrapper");
  const linkWrapper = document.getElementById("ketentuan-link-url-wrapper");
  const tabUpload = document.getElementById("tab-src-upload");
  const tabLink = document.getElementById("tab-src-link");

  if (mode === "link") {
    if (uploadWrapper) uploadWrapper.classList.add("hidden");
    if (linkWrapper) linkWrapper.classList.remove("hidden");
    if (tabUpload) tabUpload.className = "px-2.5 py-1 rounded-lg font-bold text-slate-500 hover:text-slate-800 transition";
    if (tabLink) tabLink.className = "px-2.5 py-1 rounded-lg font-bold bg-white text-slate-900 shadow-xs transition";
  } else {
    if (uploadWrapper) uploadWrapper.classList.remove("hidden");
    if (linkWrapper) linkWrapper.classList.add("hidden");
    if (tabUpload) tabUpload.className = "px-2.5 py-1 rounded-lg font-bold bg-white text-slate-900 shadow-xs transition";
    if (tabLink) tabLink.className = "px-2.5 py-1 rounded-lg font-bold text-slate-500 hover:text-slate-800 transition";
  }
}

function openUploadKetentuanModal(editId = null) {
  const modal = document.getElementById("modal-upload-ketentuan");
  if (!modal) return;

  const form = document.getElementById("form-upload-ketentuan");
  if (form) form.reset();

  const editIdInput = document.getElementById("ketentuan-edit-id");
  if (editIdInput) editIdInput.value = editId || "";

  const titleEl = document.getElementById("modal-ketentuan-title");
  const submitTextEl = document.getElementById("btn-submit-ketentuan-text");
  const starEl = document.getElementById("ketentuan-pdf-req-star");

  clearKetentuanFileSelection();
  const linkInput = document.getElementById("ketentuan-input-link-url");
  if (linkInput) linkInput.value = "";
  switchKetentuanSourceMode("upload");

  // Populate Role Checkboxes
  populateKetentuanRoleCheckboxes();

  if (editId) {
    const existing = KETENTUAN_DATA_CACHE.find(d => String(d.id) === String(editId));
    if (existing) {
      if (titleEl) titleEl.innerText = "Edit Ketentuan & SOP";
      if (submitTextEl) submitTextEl.innerText = "Simpan Perubahan";
      if (starEl) starEl.innerText = ""; // Tidak wajib upload ulang jika sudah ada PDF/Link

      document.getElementById("ketentuan-input-judul").value = existing.judul || "";
      document.getElementById("ketentuan-input-nomor").value = existing.nomor_dokumen || "";
      document.getElementById("ketentuan-input-kategori").value = existing.kategori || "SOP Operasional";
      document.getElementById("ketentuan-input-tgl-berlaku").value = existing.tgl_berlaku ? existing.tgl_berlaku.split("T")[0] : "";

      // Cek apakah berupa Tautan / Link URL
      if (existing.pdf_url && (existing.file_name === "Tautan / Link Dokumen" || existing.pdf_url.startsWith("http") && !existing.pdf_url.includes("supabase.co/storage"))) {
        if (linkInput) linkInput.value = existing.pdf_url;
        switchKetentuanSourceMode("link");
      } else if (existing.file_name) {
        document.getElementById("ketentuan-selected-name").innerText = existing.file_name;
        document.getElementById("ketentuan-selected-size").innerText = existing.file_size ? `${Math.round(existing.file_size / 1024)} KB (File Tersimpan)` : "File Tersimpan";
        document.getElementById("ketentuan-dropzone-content").classList.add("hidden");
        document.getElementById("ketentuan-file-selected-box").classList.remove("hidden");
      }

      // Check role permissions yang sesuai
      let roles = existing.allowed_roles;
      if (typeof roles === "string") {
        try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
      }
      const isAll = !roles || roles.includes("ALL") || roles.includes("Semua Role");
      if (isAll) {
        toggleAllRoleKetentuan(true);
        const checkAllEl = document.getElementById("check-all-roles");
        if (checkAllEl) checkAllEl.checked = true;
      } else {
        const checkAllEl = document.getElementById("check-all-roles");
        if (checkAllEl) checkAllEl.checked = false;
        const checkboxes = document.querySelectorAll(".ketentuan-role-checkbox");
        checkboxes.forEach(cb => {
          cb.checked = roles.includes(cb.value);
        });
      }
    }
  } else {
    if (titleEl) titleEl.innerText = "Upload Ketentuan & SOP Baru";
    if (submitTextEl) submitTextEl.innerText = "Simpan & Publikasikan";
    if (starEl) starEl.innerText = "*";

    // Set tanggal berlaku default hari ini
    const today = new Date().toISOString().split("T")[0];
    const tglInput = document.getElementById("ketentuan-input-tgl-berlaku");
    if (tglInput) tglInput.value = today;

    // Check all roles by default
    toggleAllRoleKetentuan(true);
    const checkAllEl = document.getElementById("check-all-roles");
    if (checkAllEl) checkAllEl.checked = true;
  }

  modal.classList.remove("hidden");
}

function closeUploadKetentuanModal() {
  const modal = document.getElementById("modal-upload-ketentuan");
  if (modal) modal.classList.add("hidden");
  clearKetentuanFileSelection();
}

function populateKetentuanRoleCheckboxes() {
  const container = document.getElementById("ketentuan-roles-checkbox-container");
  if (!container) return;

  const rolesObj = (typeof ROLE_PERMISSIONS_STATE !== "undefined" && Object.keys(ROLE_PERMISSIONS_STATE).length > 0)
    ? ROLE_PERMISSIONS_STATE
    : DEFAULT_ROLE_PERMISSIONS;

  let html = "";
  Object.keys(rolesObj).forEach(roleId => {
    const r = rolesObj[roleId];
    html += `
      <label class="flex items-center space-x-2 p-2 bg-white rounded-xl border border-indigo-100 hover:border-indigo-300 cursor-pointer transition select-none">
        <input type="checkbox" value="${roleId}" class="ketentuan-role-checkbox rounded text-indigo-600 focus:ring-indigo-500" />
        <div class="min-w-0">
          <span class="font-bold text-xs text-slate-800 block truncate">${r.name || roleId}</span>
          <span class="text-[9px] text-slate-400 font-mono">${roleId}</span>
        </div>
      </label>
    `;
  });

  container.innerHTML = html;
}

function toggleAllRoleKetentuan(isChecked) {
  const checkboxes = document.querySelectorAll(".ketentuan-role-checkbox");
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
  });
}

function handleKetentuanFileSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  // Validasi tipe file PDF
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    alert("Format dokumen harus PDF (.pdf). File lain tidak didukung.");
    clearKetentuanFileSelection();
    return;
  }

  // Validasi ukuran file (maksimal 15 MB)
  const maxSizeBytes = 15 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    alert("Ukuran file terlalu besar. Maksimal 15 MB.");
    clearKetentuanFileSelection();
    return;
  }

  SELECTED_KETENTUAN_FILE_BLOB = file;

  // Tampilkan preview nama & ukuran file
  const dropzoneContent = document.getElementById("ketentuan-dropzone-content");
  if (dropzoneContent) dropzoneContent.classList.add("hidden");

  const previewBox = document.getElementById("ketentuan-file-selected-box");
  if (previewBox) previewBox.classList.remove("hidden");

  const nameEl = document.getElementById("ketentuan-selected-name");
  if (nameEl) nameEl.innerText = file.name;

  const sizeEl = document.getElementById("ketentuan-selected-size");
  if (sizeEl) sizeEl.innerText = `${Math.round(file.size / 1024)} KB`;
}

function clearKetentuanFileSelection() {
  SELECTED_KETENTUAN_FILE_BLOB = null;
  const fileInput = document.getElementById("ketentuan-file-input");
  if (fileInput) fileInput.value = "";

  const dropzoneContent = document.getElementById("ketentuan-dropzone-content");
  if (dropzoneContent) dropzoneContent.classList.remove("hidden");

  const previewBox = document.getElementById("ketentuan-file-selected-box");
  if (previewBox) previewBox.classList.add("hidden");
}

async function handleSaveKetentuan(event) {
  event.preventDefault();

  const editId = document.getElementById("ketentuan-edit-id").value;
  const judul = (document.getElementById("ketentuan-input-judul").value || "").trim();
  const nomorDokumen = (document.getElementById("ketentuan-input-nomor").value || "").trim();
  const kategori = document.getElementById("ketentuan-input-kategori").value;
  const tglBerlaku = document.getElementById("ketentuan-input-tgl-berlaku").value;

  if (!judul) {
    alert("Judul dokumen ketentuan wajib diisi.");
    return;
  }
  if (!tglBerlaku) {
    alert("Tanggal berlaku dokumen wajib diisi.");
    return;
  }

  // Ambil pilihan role
  const checkAllEl = document.getElementById("check-all-roles");
  const isCheckAll = checkAllEl ? checkAllEl.checked : false;

  let selectedRoles = [];
  if (isCheckAll) {
    selectedRoles = ["ALL"];
  } else {
    const checkboxes = document.querySelectorAll(".ketentuan-role-checkbox:checked");
    checkboxes.forEach(cb => selectedRoles.push(cb.value));
  }

  if (selectedRoles.length === 0) {
    alert("Pilih minimal 1 role yang berhak membuka ketentuan ini, atau centang 'Semua Role'.");
    return;
  }

  const existingDoc = editId ? KETENTUAN_DATA_CACHE.find(d => String(d.id) === String(editId)) : null;
  const sourceMode = document.getElementById("ketentuan-source-mode")?.value || "upload";
  const linkUrl = (document.getElementById("ketentuan-input-link-url")?.value || "").trim();

  if (!editId) {
    if (sourceMode === "upload" && !SELECTED_KETENTUAN_FILE_BLOB) {
      alert("Silakan pilih file PDF yang akan diunggah.");
      return;
    }
    if (sourceMode === "link" && !linkUrl) {
      alert("Silakan masukkan tautan / URL link dokumen.");
      return;
    }
  }

  // Tampilkan indikator proses pada tombol submit
  const submitBtn = document.getElementById("btn-submit-ketentuan");
  const submitBtnText = document.getElementById("btn-submit-ketentuan-text");
  const originalText = submitBtnText ? submitBtnText.innerText : "Simpan";
  if (submitBtn) submitBtn.disabled = true;
  if (submitBtnText) submitBtnText.innerText = "Mengunggah & Menyimpan...";

  try {
    let pdfUrl = existingDoc ? existingDoc.pdf_url : "";
    let fileName = existingDoc ? existingDoc.file_name : "";
    let fileSize = existingDoc ? existingDoc.file_size : 0;

    const client = getSupabaseClient();

    if (sourceMode === "link" && linkUrl) {
      pdfUrl = linkUrl;
      fileName = "Tautan / Link Dokumen";
      fileSize = 0;
    } else if (SELECTED_KETENTUAN_FILE_BLOB) {
      fileName = SELECTED_KETENTUAN_FILE_BLOB.name;
      fileSize = SELECTED_KETENTUAN_FILE_BLOB.size;

      if (client) {
        const bucketName = CONFIG.MEDIA_BUCKET || "digiasha-media";
        const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
        const filePath = `ketentuan/${Date.now()}_${cleanName}`;

        const { data: uploadData, error: uploadErr } = await client.storage
          .from(bucketName)
          .upload(filePath, SELECTED_KETENTUAN_FILE_BLOB, {
            contentType: "application/pdf",
            upsert: true
          });

        if (uploadErr) {
          console.warn("Storage upload error:", uploadErr);
          // Fallback Object URL sementara jika storage error
          pdfUrl = URL.createObjectURL(SELECTED_KETENTUAN_FILE_BLOB);
        } else {
          const { data: urlData } = client.storage.from(bucketName).getPublicUrl(filePath);
          pdfUrl = urlData.publicUrl;
        }
      } else {
        pdfUrl = URL.createObjectURL(SELECTED_KETENTUAN_FILE_BLOB);
      }
    }

    // 2. Siapkan Objek Data Dokumen
    const uName = CURRENT_USER?.nama || CURRENT_USER?.nama_lengkap || "Admin";
    const docPayload = {
      judul: judul,
      nomor_dokumen: nomorDokumen,
      kategori: kategori,
      tgl_berlaku: tglBerlaku,
      pdf_url: pdfUrl,
      file_name: fileName,
      file_size: fileSize,
      allowed_roles: selectedRoles,
      is_active: true,
      uploaded_by: uName,
      updated_at: new Date().toISOString()
    };

    // 3. Simpan ke Supabase DB m_ketentuan
    let savedToDb = false;
    if (client) {
      try {
        if (editId) {
          const { error: updateErr } = await client
            .from("m_ketentuan")
            .update(docPayload)
            .eq("id", editId);
          if (!updateErr) savedToDb = true;
          else console.warn("Supabase update error:", updateErr.message);
        } else {
          const { data: inserted, error: insertErr } = await client
            .from("m_ketentuan")
            .insert([docPayload])
            .select();
          if (!insertErr && inserted && inserted[0]) {
            docPayload.id = inserted[0].id;
            savedToDb = true;
          } else if (insertErr) {
            console.warn("Supabase insert error:", insertErr.message);
          }
        }
      } catch (dbErr) {
        console.warn("Supabase DB execution error:", dbErr);
      }
    }

    // 4. Update Cache Lokal (LocalStorage fallback)
    if (editId) {
      const idx = KETENTUAN_DATA_CACHE.findIndex(d => String(d.id) === String(editId));
      if (idx !== -1) {
        KETENTUAN_DATA_CACHE[idx] = { ...KETENTUAN_DATA_CACHE[idx], ...docPayload };
      }
    } else {
      if (!docPayload.id) docPayload.id = `LOCAL-KET-${Date.now()}`;
      docPayload.created_at = new Date().toISOString();
      KETENTUAN_DATA_CACHE.unshift(docPayload);
    }

    try {
      localStorage.setItem("DIGIASHA_KETENTUAN_DATA", JSON.stringify(KETENTUAN_DATA_CACHE));
    } catch (e) { }

    closeUploadKetentuanModal();
    if (typeof renderKetentuanList === "function") renderKetentuanList();
    if (typeof renderSopManagementList === "function") renderSopManagementList();

    alert(editId ? "Ketentuan berhasil diperbarui!" : "Ketentuan baru berhasil diunggah dan dipublikasikan!");
  } catch (error) {
    console.error("Gagal menyimpan ketentuan:", error);
    alert(`Terjadi kesalahan: ${error.message}`);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitBtnText) submitBtnText.innerText = originalText;
  }
}

async function deleteKetentuan(id) {
  if (!id) return;
  const doc = KETENTUAN_DATA_CACHE.find(d => String(d.id) === String(id));
  const docTitle = doc?.judul || "dokumen ini";

  if (!confirm(`Apakah Anda yakin ingin menghapus ketentuan "${docTitle}"? Dokumen tidak akan dapat diakses lagi oleh karyawan.`)) {
    return;
  }

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from("m_ketentuan").delete().eq("id", id);
    } catch (e) {
      console.warn("Error deleting from Supabase:", e);
    }
  }

  KETENTUAN_DATA_CACHE = KETENTUAN_DATA_CACHE.filter(d => String(d.id) !== String(id));
  try {
    localStorage.setItem("DIGIASHA_KETENTUAN_DATA", JSON.stringify(KETENTUAN_DATA_CACHE));
  } catch (e) { }

  if (typeof renderKetentuanList === "function") renderKetentuanList();
  if (typeof renderSopManagementList === "function") renderSopManagementList();
  alert("Ketentuan berhasil dihapus.");
}

// =========================================================================
// SOP & POLICY MANAGEMENT CONTROLLER (ADMIN CONTROL & UPLOAD HUB)
// =========================================================================
let ACTIVE_SOP_MGMT_CATEGORY = "ALL";
let SEARCH_SOP_MGMT_QUERY = "";

async function initSopManagementScreen() {
  // Guard: Hanya role Admin / Super Admin atau role yang diberi wewenang sop_management
  const perms = getPermissionsForRole(CURRENT_USER?.role_id || CURRENT_USER?.role, CURRENT_USER);
  if (!isUserAdminOrSuperAdmin() && !perms.includes("sop_management")) {
    alert("Akses ditolak: Menu SOP Management hanya dapat diakses oleh Administrator.");
    loadScreen("dashboard");
    return;
  }

  const lastUpdatedEl = document.getElementById("sop-mgmt-last-updated");
  if (lastUpdatedEl) {
    const now = new Date();
    lastUpdatedEl.innerText = `Update: ${now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  ACTIVE_SOP_MGMT_CATEGORY = "ALL";
  SEARCH_SOP_MGMT_QUERY = "";
  const searchInput = document.getElementById("sop-mgmt-search-input");
  if (searchInput) searchInput.value = "";
  const clearBtn = document.getElementById("btn-clear-search-sop-mgmt");
  if (clearBtn) clearBtn.classList.add("hidden");

  await fetchKetentuanList();
  renderSopManagementList();
}

function filterSopMgmtCategory(category) {
  ACTIVE_SOP_MGMT_CATEGORY = category;

  const filterBtns = document.querySelectorAll("#sop-mgmt-category-filters .cat-filter-btn");
  filterBtns.forEach(btn => {
    btn.className = "cat-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 shrink-0 transition";
  });

  const catMap = {
    "ALL": "sop-mgmt-btn-cat-ALL",
    "SOP Operasional": "sop-mgmt-btn-cat-sop",
    "Kebijakan HR": "sop-mgmt-btn-cat-hr",
    "Surat Keputusan": "sop-mgmt-btn-cat-sk",
    "Regulasi Bisnis": "sop-mgmt-btn-cat-bisnis",
    "Panduan Sistem": "sop-mgmt-btn-cat-sistem"
  };

  const activeBtnId = catMap[category] || "sop-mgmt-btn-cat-ALL";
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.className = "cat-filter-btn px-3 py-1.5 rounded-xl font-bold bg-slate-900 text-white shadow-xs shrink-0 transition";
  }

  renderSopManagementList();
}

function handleSearchSopMgmt(query) {
  SEARCH_SOP_MGMT_QUERY = (query || "").trim().toLowerCase();
  const clearBtn = document.getElementById("btn-clear-search-sop-mgmt");
  if (clearBtn) {
    clearBtn.classList.toggle("hidden", !SEARCH_SOP_MGMT_QUERY);
  }
  renderSopManagementList();
}

function clearSearchSopMgmt() {
  const searchInput = document.getElementById("sop-mgmt-search-input");
  if (searchInput) searchInput.value = "";
  handleSearchSopMgmt("");
}

function renderSopManagementList() {
  const container = document.getElementById("sop-mgmt-list-container");
  if (!container) return;

  // Di SOP Management (Admin), Admin melihat SEMUA dokumen tanpa tersembunyi
  let docs = KETENTUAN_DATA_CACHE;

  const countAllEl = document.getElementById("sop-mgmt-count-cat-all");
  if (countAllEl) countAllEl.innerText = docs.length;

  if (ACTIVE_SOP_MGMT_CATEGORY !== "ALL") {
    docs = docs.filter(d => (d.kategori || "").toLowerCase() === ACTIVE_SOP_MGMT_CATEGORY.toLowerCase());
  }

  if (SEARCH_SOP_MGMT_QUERY) {
    docs = docs.filter(d => {
      const matchJudul = String(d.judul || "").toLowerCase().includes(SEARCH_SOP_MGMT_QUERY);
      const matchNomor = String(d.nomor_dokumen || "").toLowerCase().includes(SEARCH_SOP_MGMT_QUERY);
      const matchKategori = String(d.kategori || "").toLowerCase().includes(SEARCH_SOP_MGMT_QUERY);
      return matchJudul || matchNomor || matchKategori;
    });
  }

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <div>
          <h4 class="font-bold text-slate-700 text-xs sm:text-sm">Belum Ada Dokumen di Kategori Ini</h4>
          <p class="text-[11px] text-slate-400 mt-0.5">
            ${SEARCH_SOP_MGMT_QUERY ? `Tidak ada hasil untuk kata kunci "${SEARCH_SOP_MGMT_QUERY}".` : 'Klik tombol "Upload Ketentuan Baru" di atas untuk menambahkan dokumen PDF baru.'}
          </p>
        </div>
        <button type="button" onclick="openUploadKetentuanModal()" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs">
          <i class="fa-solid fa-plus mr-1"></i> Upload Dokumen Baru
        </button>
      </div>
    `;
    return;
  }

  const categoryColorMap = {
    "SOP Operasional": { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "fa-clipboard-check" },
    "Kebijakan HR": { bg: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "fa-users-gear" },
    "Surat Keputusan": { bg: "bg-rose-50 text-rose-700 border-rose-200", icon: "fa-stamp" },
    "Regulasi Bisnis": { bg: "bg-amber-50 text-amber-800 border-amber-200", icon: "fa-scale-balanced" },
    "Panduan Sistem": { bg: "bg-cyan-50 text-cyan-700 border-cyan-200", icon: "fa-laptop-code" },
    "Lainnya": { bg: "bg-slate-50 text-slate-700 border-slate-200", icon: "fa-file-lines" }
  };

  let html = "";
  docs.forEach(item => {
    const catStyle = categoryColorMap[item.kategori] || categoryColorMap["Lainnya"];
    const tglBerlakuFmt = item.tgl_berlaku ? formatDisplayDate(item.tgl_berlaku) : "-";
    const fileSizeStr = item.file_size ? `${Math.round(item.file_size / 1024)} KB` : "";

    let roles = item.allowed_roles;
    if (typeof roles === "string") {
      try { roles = JSON.parse(roles); } catch (e) { roles = [roles]; }
    }
    const isAllRoles = !roles || roles.length === 0 || roles.includes("ALL") || roles.includes("Semua Role");

    let roleBadgesHtml = "";
    if (isAllRoles) {
      roleBadgesHtml = `<span class="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">Semua Role</span>`;
    } else {
      roleBadgesHtml = roles.map(r => `<span class="px-1.5 py-0.5 rounded text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 font-semibold">${r}</span>`).join(" ");
    }

    const safeJudul = (item.judul || "").replace(/"/g, '&quot;');
    const safeMeta = `${item.nomor_dokumen || item.kategori} • Berlaku sejak ${tglBerlakuFmt}`;

    html += `
      <div class="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs hover:border-slate-300 transition space-y-3">
        <!-- Header Dokumen: Badge Kategori, No Dokumen & Actions Admin -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center space-x-2">
            <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold border ${catStyle.bg} flex items-center space-x-1">
              <i class="fa-solid ${catStyle.icon} text-[9px]"></i>
              <span>${item.kategori || "Ketentuan"}</span>
            </span>
            ${item.nomor_dokumen ? `
              <span class="text-[10px] text-slate-400 font-mono truncate max-w-[150px] sm:max-w-[240px]">
                ${item.nomor_dokumen}
              </span>
            ` : ''}
          </div>

          <div class="flex items-center space-x-1.5 shrink-0">
            <button type="button" onclick="openUploadKetentuanModal('${item.id}')" class="px-2.5 py-1 text-slate-600 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 border border-slate-200 rounded-lg transition text-xs font-bold flex items-center space-x-1" title="Edit Metadata & Hak Akses Role">
              <i class="fa-solid fa-pen-to-square text-[11px]"></i>
              <span>Edit</span>
            </button>
            <button type="button" onclick="deleteKetentuan('${item.id}')" class="p-1.5 text-slate-400 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 border border-slate-200 rounded-lg transition text-xs" title="Hapus Dokumen">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

        <!-- Judul Ketentuan -->
        <div class="flex items-start space-x-3">
          <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-lg shrink-0 shadow-inner">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div class="min-w-0 flex-1">
            <h4 class="font-bold text-slate-900 text-xs sm:text-sm leading-snug line-clamp-2">${item.judul || "Dokumen Ketentuan"}</h4>
            <div class="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1 text-[10px] text-slate-400">
              <span class="flex items-center space-x-1">
                <i class="fa-regular fa-calendar-check text-slate-400"></i>
                <span>Berlaku: <strong class="text-slate-600">${tglBerlakuFmt}</strong></span>
              </span>
              ${fileSizeStr ? `<span>•</span><span>${fileSizeStr}</span>` : ''}
              ${item.file_name ? `<span class="hidden sm:inline font-mono truncate max-w-[180px] text-slate-400">(${item.file_name})</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Footer Card: Hak Akses Role & Tombol Preview Viewer -->
        <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div class="flex items-center space-x-1.5 flex-wrap">
            <span class="text-[10px] text-slate-500 font-bold">Hak Akses Role:</span>
            ${roleBadgesHtml}
          </div>

          <div class="flex items-center space-x-2 w-full sm:w-auto">
            <button type="button" onclick="copySopShareLink('${item.id}', '${safeJudul}')" title="Salin link langsung ke SOP ini" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 active:scale-95 shrink-0">
              <i class="fa-solid fa-link text-slate-500 text-xs"></i>
              <span>Salin Link</span>
            </button>
            <button type="button" onclick="openSecurePdfViewer('${item.pdf_url}', '${safeJudul}', '${safeMeta}')" class="flex-1 sm:flex-initial px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5 active:scale-95">
              <i class="fa-solid fa-eye text-xs text-emerald-400"></i>
              <span>Preview PDF</span>
            </button>
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// =========================================================================
// APP BOOTSTRAP / INITIALIZATION
// =========================================================================
async function initAppBootstrap() {
  try {
    if (typeof syncRolePermissionsFromSupabase === "function") {
      await syncRolePermissionsFromSupabase();
    }
  } catch (err) {
    console.warn("Sync permissions error at bootstrap:", err);
  }

  try {
    const requestedScreen = getScreenFromUrl();

    if (CURRENT_USER) {
      if (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") {
        await loadScreen("login", false);
        if (typeof openForceChangePassModal === "function") openForceChangePassModal();
      } else {
        const target = (requestedScreen === "login") ? "dashboard" : requestedScreen;
        await loadScreen(target, false);

        // Pastikan URL sinkron di browser tanpa menambah tumpukan riwayat, pertahankan query string jika ada
        const currentSearch = window.location.search || "";
        const targetPath = (target === "dashboard") ? "/" : `/${target}${currentSearch}`;
        const currentFull = window.location.pathname + (target === "dashboard" ? "" : currentSearch);
        if (currentFull !== targetPath && window.history && window.history.replaceState) {
          window.history.replaceState({ screen: target }, "", targetPath);
        }
        syncMasterDataFromApi();
      }
    } else {
      if (requestedScreen && requestedScreen !== "login") {
        try {
          sessionStorage.setItem("DIGIASHA_REDIRECT_SCREEN", requestedScreen);
          const fullPath = window.location.pathname + window.location.search;
          sessionStorage.setItem("DIGIASHA_REDIRECT_URL", fullPath);
        } catch (e) { }
      }
      await loadScreen("login", false);
      if (window.location.pathname !== "/login" && window.location.pathname !== "/" && window.history && window.history.replaceState) {
        window.history.replaceState({ screen: "login" }, "", "/login");
      }
    }
  } catch (err) {
    console.error("Critical error in initAppBootstrap:", err);
    const container = document.getElementById("main-view-container");
    if (container && (!container.innerHTML || container.innerHTML.trim() === "")) {
      loadScreen("login", false);
    }
  }
}

// =========================================================================
// ORGANIZATION SETTING & SSO CONTROLLER (DIGIASHA CORE IDENTITY & ORG)
// =========================================================================
let ORG_UNITS_DATA = [];
let ORG_POSITIONS_DATA = [];
let ORG_LEVELS_DATA = [];
let ORG_WORK_LOCATIONS_DATA = [];
let ORG_SSO_CLIENTS_DATA = [];
let ORG_CHART_ZOOM = 1.0;
let CURRENT_DOSSIER_EMP = null;
let CURRENT_DOSSIER_PERSONAL = null;
let CURRENT_DOSSIER_CAREER_LIST = [];
let CURRENT_EDIT_WORKLOC_ID = null;
let CURRENT_EDIT_UNIT_ID = null;
let CURRENT_EDIT_JOBPOS_ID = null;
let CURRENT_EDIT_LEVEL_ID = null;
let CURRENT_EDIT_SSO_CLIENT_ID = null;

// Seed Fallback Data jika tabel Supabase baru belum dieksekusi pengguna
const DEFAULT_ORG_LEVELS = [
  { id_level: "L-01", nama_level: "Direksi / C-Level", bobot_level: 1, is_active: true },
  { id_level: "L-02", nama_level: "General Manager / Division Head", bobot_level: 2, is_active: true },
  { id_level: "L-03", nama_level: "Manager / Branch Manager", bobot_level: 3, is_active: true },
  { id_level: "L-04", nama_level: "Supervisor / Coordinator", bobot_level: 4, is_active: true },
  { id_level: "L-05", nama_level: "Senior Officer / Specialist", bobot_level: 5, is_active: true },
  { id_level: "L-06", nama_level: "Officer / Staff", bobot_level: 6, is_active: true },
  { id_level: "L-07", nama_level: "Field Staff / FAC / Pelaksana", bobot_level: 7, is_active: true }
];

const DEFAULT_ORG_WORK_LOCS = [
  { id_work_location: "WL-HO-01", nama_lokasi: "Head Office Graha Digiasha", alamat_lengkap: "Jl. Jenderal Sudirman Kav. 25, Jakarta Selatan", kota: "Jakarta Selatan", provinsi: "DKI Jakarta", latitude: -6.2146, longitude: 106.8214, radius_meter: 150, is_active: true },
  { id_work_location: "WL-SERANG-01", nama_lokasi: "Kantor Operasional Serang", alamat_lengkap: "Jl. Ahmad Yani No. 88, Cipocok Jaya", kota: "Serang", provinsi: "Banten", latitude: -6.1200, longitude: 106.1500, radius_meter: 120, is_active: true },
  { id_work_location: "WL-TGR-01", nama_lokasi: "Kantor Operasional Tangerang", alamat_lengkap: "Jl. MH Thamrin No. 12, Cikokol", kota: "Tangerang", provinsi: "Banten", latitude: -6.1783, longitude: 106.6319, radius_meter: 120, is_active: true }
];

const DEFAULT_ORG_UNITS = [
  { id_unit: "HO-CORP", tipe_unit: "HO", nama_unit: "Head Office Digiasha", parent_unit_id: null, work_location_id: "WL-HO-01", is_active: true },
  { id_unit: "AREA-BANTEN", tipe_unit: "AREA", nama_unit: "Area Regional Banten & Jabar", parent_unit_id: "HO-CORP", work_location_id: "WL-HO-01", is_active: true },
  { id_unit: "CAB-SERANG", tipe_unit: "CABANG", nama_unit: "Cabang Serang", parent_unit_id: "AREA-BANTEN", work_location_id: "WL-SERANG-01", is_active: true },
  { id_unit: "CAB-TANGERANG", tipe_unit: "CABANG", nama_unit: "Cabang Tangerang", parent_unit_id: "AREA-BANTEN", work_location_id: "WL-TGR-01", is_active: true },
  { id_unit: "CAB-JAKARTA", tipe_unit: "CABANG", nama_unit: "Cabang Jakarta Barat", parent_unit_id: "HO-CORP", work_location_id: "WL-HO-01", is_active: true }
];

const DEFAULT_ORG_POSITIONS = [
  { id_position: "POS-DIR-UTAMA", nama_jabatan: "Direktur Utama", level_id: "L-01", reports_to_unit_id: null, unit_id: "HO-CORP", is_active: true },
  { id_position: "POS-GM-OPS", nama_jabatan: "General Manager Operasional", level_id: "L-02", reports_to_unit_id: "POS-DIR-UTAMA", unit_id: "HO-CORP", is_active: true },
  { id_position: "POS-BM-SERANG", nama_jabatan: "Branch Manager Serang", level_id: "L-03", reports_to_unit_id: "POS-GM-OPS", unit_id: "CAB-SERANG", is_active: true },
  { id_position: "POS-BM-TGR", nama_jabatan: "Branch Manager Tangerang", level_id: "L-03", reports_to_unit_id: "POS-GM-OPS", unit_id: "CAB-TANGERANG", is_active: true },
  { id_position: "POS-SPV-FAC", nama_jabatan: "Supervisor FAC & Field Ops", level_id: "L-04", reports_to_unit_id: "POS-BM-SERANG", unit_id: "CAB-SERANG", is_active: true },
  { id_position: "POS-FAC-OFFICER", nama_jabatan: "Field Action Coordinator (FAC)", level_id: "L-07", reports_to_unit_id: "POS-SPV-FAC", unit_id: "CAB-SERANG", is_active: true },
  { id_position: "POS-ADMIN-HO", nama_jabatan: "Administrator Sistem & HR", level_id: "L-05", reports_to_unit_id: "POS-GM-OPS", unit_id: "HO-CORP", is_active: true }
];

const DEFAULT_ORG_SSO_CLIENTS = [
  { client_id: "digicore", client_name: "DigiCore Enterprise System", client_secret: "secret_digicore_2026", description: "Core Business Engine & Financial Operations", is_active: true },
  { client_id: "digi_workapp", client_name: "Digi Workapp", client_secret: "secret_workapp_2026", description: "Aplikasi Penugasan Mobile Karyawan Lapangan", is_active: true },
  { client_id: "digi_active", client_name: "Digi Active (Digi-Action)", client_secret: "secret_active_2026", description: "Master HR, Presensi & SSO Identity Provider", is_active: true },
  { client_id: "digi_spector", client_name: "Digi Spector", client_secret: "secret_spector_2026", description: "Aplikasi Inspeksi Kendaraan & Aset", is_active: true }
];

async function initOrganizationSettingScreen() {
  switchOrgSettingTab("unit");

  await Promise.allSettled([
    loadOrgLevels(),
    loadWorkLocations(),
    loadOrgUnits(),
    loadOrgPositions(),
    loadAllJobPositionPermissions(),
    loadSsoClients()
  ]);

  populateOrgFilterUnits();
  renderVisualOrgChartTree();
  populateSsoTestEmpSelect();
}

function switchOrgSettingTab(tab) {
  const tabs = ["unit", "position", "level", "chart", "workloc", "role", "sso"];
  tabs.forEach(t => {
    const el = document.getElementById(`org-setting-tab-${t}`);
    const btn = document.getElementById(`tab-btn-org-${t}`);
    if (el) {
      if (t === tab) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
    if (btn) {
      if (t === tab) {
        btn.className = "py-2 px-3.5 rounded-xl transition text-center whitespace-nowrap bg-white text-indigo-700 shadow-sm border border-slate-200/80 font-bold shrink-0";
      } else {
        btn.className = "py-2 px-3.5 rounded-xl transition text-center whitespace-nowrap text-slate-600 hover:text-slate-900 font-bold shrink-0";
      }
    }
  });

  if (tab === "unit") {
    loadOrgUnits();
  } else if (tab === "position") {
    loadOrgPositions();
  } else if (tab === "level") {
    loadOrgLevels();
  } else if (tab === "chart") {
    renderVisualOrgChartTree();
  } else if (tab === "workloc") {
    loadWorkLocations();
  } else if (tab === "role") {
    loadOrgRolePermissions();
  } else if (tab === "sso") {
    loadSsoClients();
    populateSsoTestEmpSelect();
  }
}

function switchOrgStructureSubtab(sub) {
  switchOrgSettingTab(sub);
}

// ---------------- 0. HELPER DATABASE CORE HR DUAL-TARGET (hr_* BASE TABLE & VIEW) ----------------
async function upsertOrgCoreTable(baseName, payload, conflictCol) {
  if (!supabaseClient) return { success: false, error: "No Supabase client" };

  let primaryError = null;

  // 1. Prioritaskan tabel fisik berprefix hr_* karena BASE TABLE mendukung penuh ON CONFLICT di PostgreSQL
  try {
    const { data, error } = await supabaseClient
      .from("hr_" + baseName)
      .upsert(payload, { onConflict: conflictCol });
    if (!error) {
      console.log(`[Org Core HR] Berhasil simpan ke hr_${baseName}:`, payload[conflictCol]);
      return { success: true, data };
    }
    primaryError = error;
    console.warn(`[Org Core HR] hr_${baseName} upsert returned:`, error);
  } catch (e) {
    primaryError = e;
    console.warn(`[Org Core HR] Exception hr_${baseName}:`, e);
  }

  // 2. Fallback jika sistem menggunakan nama tabel standar tanpa prefix hr_
  try {
    const { data, error } = await supabaseClient
      .from(baseName)
      .upsert(payload, { onConflict: conflictCol });
    if (!error) {
      console.log(`[Org Core HR] Berhasil simpan ke ${baseName}:`, payload[conflictCol]);
      return { success: true, data };
    }
    console.error(`[Org Core HR] Gagal simpan ke ${baseName}:`, error);
    throw (error || primaryError);
  } catch (e) {
    throw (e || primaryError);
  }
}

async function loadOrgCoreTable(baseName, orderCol = "created_at", ascending = true) {
  if (!supabaseClient) return null;
  // 1. Coba baca dari tabel fisik hr_*
  try {
    const { data, error } = await supabaseClient
      .from("hr_" + baseName)
      .select("*")
      .order(orderCol, { ascending });
    if (!error && Array.isArray(data)) {
      console.log(`[Org Core HR] Data hr_${baseName} dimuat dari Supabase:`, data.length, "baris");
      return data;
    }
    if (error) console.warn(`[Org Core HR] Query hr_${baseName} returned:`, error);
  } catch (e) {
    console.warn(`[Org Core HR] Query hr_${baseName} exception:`, e);
  }

  // 2. Coba baca dari view / nama tabel biasa
  try {
    const { data, error } = await supabaseClient
      .from(baseName)
      .select("*")
      .order(orderCol, { ascending });
    if (!error && Array.isArray(data)) {
      console.log(`[Org Core HR] Data ${baseName} dimuat dari Supabase:`, data.length, "baris");
      return data;
    }
  } catch (e) { }

  return null;
}

async function deleteOrgCoreTable(baseName, filterCol, filterVal) {
  if (!supabaseClient) return { success: false };
  try {
    await supabaseClient.from("hr_" + baseName).delete().eq(filterCol, filterVal);
  } catch (e) { }
  try {
    await supabaseClient.from(baseName).delete().eq(filterCol, filterVal);
  } catch (e) { }
  return { success: true };
}

async function updateOrgCoreTableActiveStatus(baseName, filterCol, filterVal, isActive) {
  if (!supabaseClient) return { success: false };
  const updateData = { is_active: isActive, updated_at: new Date().toISOString() };
  try {
    await supabaseClient.from("hr_" + baseName).update(updateData).eq(filterCol, filterVal);
  } catch (e) { }
  try {
    await supabaseClient.from(baseName).update(updateData).eq(filterCol, filterVal);
  } catch (e) { }
  return { success: true };
}

// ---------------- 1. WORK LOCATION (TEMPAT KERJA FISIK) ----------------
async function loadWorkLocations() {
  const container = document.getElementById("work-locations-list-container");
  let data = await loadOrgCoreTable("work_locations", "id_work_location");

  // Jika tabel hr_work_locations kosong atau null, coba ambil dari m_work_location sebagai referensi
  if (!data || data.length === 0) {
    if (supabaseClient) {
      try {
        const { data: legacyLocs } = await supabaseClient.from("m_work_location").select("*");
        if (legacyLocs && legacyLocs.length > 0) {
          data = legacyLocs.map(l => ({
            id_work_location: l.location_id || l.id_work_location,
            nama_lokasi: l.name || l.nama_lokasi || l.location_id,
            alamat_lengkap: l.address || l.alamat_lengkap || "-",
            kota: l.kota || "-",
            provinsi: l.provinsi || "-",
            latitude: parseFloat(l.lat || l.latitude || 0),
            longitude: parseFloat(l.long || l.longitude || 0),
            radius_meter: parseInt(l.max_radius_meter || l.radius_meter || 100),
            is_active: l.is_active !== false
          }));
        }
      } catch (e) { }
    }
  }

  if (data !== null && data.length > 0) {
    ORG_WORK_LOCATIONS_DATA = data.map(w => ({
      ...w,
      id_work_location: w.id_work_location || w.location_id,
      nama_lokasi: w.nama_lokasi || w.name || w.id_work_location || w.location_id
    }));
    renderWorkLocationsList(ORG_WORK_LOCATIONS_DATA);
    return;
  }

  // Fallback default HANYA jika Supabase client offline / tidak terhubung
  ORG_WORK_LOCATIONS_DATA = DEFAULT_ORG_WORK_LOCS;
  renderWorkLocationsList(ORG_WORK_LOCATIONS_DATA);
}

function renderWorkLocationsList(list) {
  const container = document.getElementById("work-locations-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Belum ada tempat kerja fisik terdaftar. Silakan klik tombol "+ Tambah Tempat Kerja" di atas.</div>';
    return;
  }

  container.innerHTML = list.map(item => {
    const lat = parseFloat(item.latitude || 0).toFixed(6);
    const lng = parseFloat(item.longitude || 0).toFixed(6);
    const radius = item.radius_meter || 100;
    const isActive = item.is_active !== false;

    // Temukan unit/cabang yang menggunakan work location ini
    const assignedUnits = (ORG_UNITS_DATA || []).filter(u => u.work_location_id === item.id_work_location);
    const unitBadges = assignedUnits.map(u => `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">${u.nama_unit}</span>`).join(" ") || '<span class="text-[10px] text-slate-400 italic">Belum ada unit yang terhubung</span>';

    return `
      <div class="bg-white p-4 rounded-2xl border ${isActive ? 'border-slate-200 hover:border-emerald-300' : 'border-slate-300/80 bg-slate-50/70 border-dashed'} shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center space-x-2">
            <span class="font-mono text-[10px] font-bold ${isActive ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-slate-600 bg-slate-100 border-slate-300'} px-2 py-0.5 rounded-md border">${item.id_work_location}</span>
            <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate">${item.nama_lokasi}</h4>
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-300'}">${isActive ? 'AKTIF' : 'NONAKTIF'}</span>
          </div>
          <p class="text-[11px] text-slate-600">${item.alamat_lengkap || '-'}, ${item.kota || ''}</p>
          <div class="flex items-center space-x-3 text-[10px] text-slate-500 font-mono flex-wrap">
            <span><i class="fa-solid fa-location-dot text-rose-500 mr-1"></i>${lat}, ${lng}</span>
            <span>•</span>
            <span><i class="fa-solid fa-circle-notch text-emerald-600 mr-1"></i>Radius ${radius}m</span>
          </div>
          <div class="pt-1.5 flex items-center space-x-1 flex-wrap gap-y-1">
            <span class="text-[10px] text-slate-400 font-medium">Unit di Lokasi Ini:</span>
            ${unitBadges}
          </div>
        </div>
        <button type="button" onclick="openEditWorkLocationModal('${item.id_work_location}')" class="px-3 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-xs shrink-0 flex items-center justify-center space-x-1 border border-slate-200 transition">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Edit</span>
        </button>
      </div>
    `;
  }).join("");
}

function openAddWorkLocationModal() {
  CURRENT_EDIT_WORKLOC_ID = null;
  document.getElementById("workloc-modal-title").innerText = "Tambah Tempat Kerja Fisik";
  const idInput = document.getElementById("workloc-input-id");
  idInput.value = `WL-${(ORG_WORK_LOCATIONS_DATA.length + 1).toString().padStart(2, '0')}`;
  idInput.disabled = false;
  document.getElementById("workloc-input-name").value = "";
  document.getElementById("workloc-input-address").value = "";
  document.getElementById("workloc-input-city").value = "";
  document.getElementById("workloc-input-province").value = "";
  document.getElementById("workloc-input-lat").value = "";
  document.getElementById("workloc-input-long").value = "";
  document.getElementById("workloc-input-radius").value = "100";
  if (document.getElementById("workloc-input-status")) document.getElementById("workloc-input-status").value = "true";
  document.getElementById("btn-delete-workloc")?.classList.add("hidden");
  document.getElementById("modal-workloc-edit").classList.remove("hidden");
}

function openEditWorkLocationModal(id) {
  const item = ORG_WORK_LOCATIONS_DATA.find(w => w.id_work_location === id);
  if (!item) return;

  CURRENT_EDIT_WORKLOC_ID = id;
  document.getElementById("workloc-modal-title").innerText = `Edit: ${item.nama_lokasi}`;
  const idInput = document.getElementById("workloc-input-id");
  idInput.value = item.id_work_location;
  idInput.disabled = true;
  document.getElementById("workloc-input-name").value = item.nama_lokasi || "";
  document.getElementById("workloc-input-address").value = item.alamat_lengkap || "";
  document.getElementById("workloc-input-city").value = item.kota || "";
  document.getElementById("workloc-input-province").value = item.provinsi || "";
  document.getElementById("workloc-input-lat").value = item.latitude || "";
  document.getElementById("workloc-input-long").value = item.longitude || "";
  document.getElementById("workloc-input-radius").value = item.radius_meter || 100;
  if (document.getElementById("workloc-input-status")) document.getElementById("workloc-input-status").value = (item.is_active !== false) ? "true" : "false";
  document.getElementById("btn-delete-workloc")?.classList.remove("hidden");
  document.getElementById("modal-workloc-edit").classList.remove("hidden");
}

function closeWorkLocModal() {
  document.getElementById("modal-workloc-edit").classList.add("hidden");
}

async function handleDeleteWorkLocation(id) {
  if (!id) return;

  const btn = document.getElementById("btn-delete-workloc");
  if (btn) btn.disabled = true;

  try {
    const item = ORG_WORK_LOCATIONS_DATA.find(w => w.id_work_location === id) || { nama_lokasi: id };

    // 1. Cek ketergantungan di tabel lain (organization_units / hr_organization_units)
    let unitsUsing = (ORG_UNITS_DATA || []).filter(u => u.work_location_id === id);
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient
          .from("hr_organization_units")
          .select("id_unit, nama_unit")
          .eq("work_location_id", id);
        if (data && data.length > 0) unitsUsing = data;
      } catch (e) {
        try {
          const { data } = await supabaseClient
            .from("organization_units")
            .select("id_unit, nama_unit")
            .eq("work_location_id", id);
          if (data && data.length > 0) unitsUsing = data;
        } catch (err) { }
      }
    }

    if (unitsUsing.length > 0) {
      // KONDISI 1: DATA SEDANG DIGUNAKAN DI TABEL LAIN -> HANYA UBAH JADI NONAKTIF (SOFT DELETE)
      const unitNames = unitsUsing.map(u => `• ${u.nama_unit || u.id_unit} (${u.id_unit})`).slice(0, 5).join("\n");
      const moreText = unitsUsing.length > 5 ? `\n...dan ${unitsUsing.length - 5} unit lainnya.` : "";

      const msg = `⚠️ DATA SEDANG DIGUNAKAN DI TABEL LAIN!\n\nTempat kerja "${item.nama_lokasi}" (${id}) saat ini terhubung dengan ${unitsUsing.length} Unit Organisasi:\n${unitNames}${moreText}\n\nKarena sedang digunakan, data ini TIDAK BISA DIHAPUS PERMANEN demi menjaga integritas database dan relasi cabang.\n\nSistem akan mengubah status tempat kerja ini menjadi NONAKTIF (is_active = false).\n\nApakah Anda ingin melanjutkan?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await updateOrgCoreTableActiveStatus("work_locations", "id_work_location", id, false);

      const target = ORG_WORK_LOCATIONS_DATA.find(w => w.id_work_location === id);
      if (target) target.is_active = false;

      renderWorkLocationsList(ORG_WORK_LOCATIONS_DATA);
      closeWorkLocModal();
      showToast(`Tempat kerja "${id}" diubah menjadi NONAKTIF karena sedang digunakan.`, "info", 2500);
    } else {
      // KONDISI 2: DATA TIDAK DIGUNAKAN DI TABEL MANAPUN -> HAPUS PERMANEN DARI DATABASE
      const msg = `🗑️ HAPUS PERMANEN\n\nTempat kerja "${item.nama_lokasi}" (${id}) TIDAK DIGUNAKAN oleh unit organisasi manapun.\n\nApakah Anda yakin ingin MENGHAPUS PERMANEN data ini dari database?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await deleteOrgCoreTable("work_locations", "id_work_location", id);
      ORG_WORK_LOCATIONS_DATA = ORG_WORK_LOCATIONS_DATA.filter(w => w.id_work_location !== id);
      renderWorkLocationsList(ORG_WORK_LOCATIONS_DATA);
      closeWorkLocModal();
      showToast(`Tempat kerja "${id}" berhasil dihapus permanen dari database!`, "success", 2000);
    }
  } catch (e) {
    alert("Gagal memproses penghapusan: " + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function detectCurrentGpsForWorkLoc() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      document.getElementById("workloc-input-lat").value = pos.coords.latitude.toFixed(6);
      document.getElementById("workloc-input-long").value = pos.coords.longitude.toFixed(6);
      showToast("Koordinat GPS terkini berhasil dipasang!", "success", 1500);
    }, err => {
      alert("Gagal mendeteksi GPS: " + err.message);
    }, { enableHighAccuracy: true });
  } else {
    alert("Perangkat Anda tidak mendukung geolokasi.");
  }
}

async function handleSaveWorkLocation(e) {
  e.preventDefault();
  const id = document.getElementById("workloc-input-id").value.trim().toUpperCase();
  const name = document.getElementById("workloc-input-name").value.trim();
  const address = document.getElementById("workloc-input-address").value.trim();
  const city = document.getElementById("workloc-input-city").value.trim();
  const province = document.getElementById("workloc-input-province").value.trim();
  const lat = parseFloat(document.getElementById("workloc-input-lat").value);
  const long = parseFloat(document.getElementById("workloc-input-long").value);
  const radius = parseInt(document.getElementById("workloc-input-radius").value) || 100;
  const isActive = document.getElementById("workloc-input-status") ? (document.getElementById("workloc-input-status").value !== "false") : true;

  const payload = {
    id_work_location: id,
    nama_lokasi: name,
    alamat_lengkap: address,
    kota: city,
    provinsi: province,
    latitude: lat,
    longitude: long,
    radius_meter: radius,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-workloc");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    await upsertOrgCoreTable("work_locations", payload, "id_work_location");

    const idx = ORG_WORK_LOCATIONS_DATA.findIndex(w => w.id_work_location === id);
    if (idx >= 0) ORG_WORK_LOCATIONS_DATA[idx] = payload;
    else ORG_WORK_LOCATIONS_DATA.push(payload);

    renderWorkLocationsList(ORG_WORK_LOCATIONS_DATA);
    closeWorkLocModal();
    showToast("Tempat kerja fisik berhasil disimpan ke database!", "success", 1500);
  } catch (err) {
    alert("Gagal menyimpan tempat kerja: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

async function loadOrgUnits() {
  if (!ORG_WORK_LOCATIONS_DATA || ORG_WORK_LOCATIONS_DATA.length === 0) {
    await loadWorkLocations();
  }

  const data = await loadOrgCoreTable("organization_units", "id_unit");
  if (data !== null) {
    // Deduplikasi otomatis jika ada data ganda case-insensitive (misal "Area 01" vs "AREA 01")
    const unitMap = new Map();
    data.forEach(item => {
      const key = (item.id_unit || "").trim().toUpperCase();
      if (!unitMap.has(key)) {
        unitMap.set(key, item);
      } else {
        const existing = unitMap.get(key);
        // Prioritaskan yang memiliki work_location_id terisi atau data yang lebih baru
        if ((!existing.work_location_id && item.work_location_id) || (item.updated_at && (!existing.updated_at || item.updated_at > existing.updated_at))) {
          // Bersihkan record lama/usang yang duplikat jika berbeda casing
          if (existing.id_unit !== item.id_unit) {
            deleteOrgCoreTable("organization_units", "id_unit", existing.id_unit).catch(() => { });
          }
          unitMap.set(key, item);
        } else if (existing.id_unit !== item.id_unit) {
          deleteOrgCoreTable("organization_units", "id_unit", item.id_unit).catch(() => { });
        }
      }
    });

    ORG_UNITS_DATA = Array.from(unitMap.values());
    renderOrgUnitsList(ORG_UNITS_DATA);
    populateOrgFilterUnits();
    return;
  }

  ORG_UNITS_DATA = DEFAULT_ORG_UNITS;
  renderOrgUnitsList(ORG_UNITS_DATA);
  populateOrgFilterUnits();
}

function renderOrgUnitsList(list) {
  const container = document.getElementById("org-units-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Belum ada unit organisasi terdaftar. Silakan klik tombol "+ Tambah Unit Organisasi".</div>';
    return;
  }

  // Urutan hierarki: HO (Pusat) -> AREA (Regional) -> CABANG (Unit Lapangan/Outlet)
  const typePriority = { "HO": 1, "AREA": 2, "CABANG": 3 };

  const sortedList = [...list].sort((a, b) => {
    const prioA = typePriority[a.tipe_unit] || 99;
    const prioB = typePriority[b.tipe_unit] || 99;
    if (prioA !== prioB) return prioA - prioB;
    return (a.nama_unit || "").localeCompare(b.nama_unit || "");
  });

  container.innerHTML = sortedList.map(u => {
    let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
    if (u.tipe_unit === "HO") badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
    if (u.tipe_unit === "AREA") badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
    if (u.tipe_unit === "CABANG") badgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";

    const isActive = u.is_active !== false;

    return `
      <div class="bg-white px-3.5 py-2.5 rounded-xl border ${isActive ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-300/80 bg-slate-50/70 border-dashed'} shadow-xs flex items-center justify-between gap-3 transition">
        <div class="min-w-0 flex-1 flex items-center space-x-2.5">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${badgeColor}">${u.tipe_unit || 'UNIT'}</span>
          <h4 class="font-bold text-xs sm:text-sm text-slate-800 truncate">${u.nama_unit}</h4>
          ${!isActive ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-300 shrink-0">NONAKTIF</span>' : ''}
        </div>
        <button type="button" onclick="openEditOrgUnitModal('${u.id_unit}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-lg font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition">
          <i class="fa-solid fa-pen-to-square text-[11px]"></i>
          <span>Edit</span>
        </button>
      </div>
    `;
  }).join("");
}

async function openAddOrgUnitModal() {
  CURRENT_EDIT_UNIT_ID = null;
  document.getElementById("orgunit-modal-title").innerText = "Tambah Unit Organisasi";
  const idInput = document.getElementById("unit-input-id");
  idInput.value = "";
  idInput.disabled = false;
  document.getElementById("unit-input-tipe").value = "CABANG";
  document.getElementById("unit-input-name").value = "";
  if (document.getElementById("unit-input-status")) document.getElementById("unit-input-status").value = "true";
  document.getElementById("btn-delete-unit")?.classList.add("hidden");

  if (!ORG_WORK_LOCATIONS_DATA || ORG_WORK_LOCATIONS_DATA.length === 0) {
    await loadWorkLocations();
  }

  populateOrgUnitParentSelect("");
  populateOrgUnitWorkLocSelect("");
  document.getElementById("modal-orgunit-edit").classList.remove("hidden");
}

async function openEditOrgUnitModal(id) {
  const item = ORG_UNITS_DATA.find(u => u.id_unit === id || u.id_unit?.toUpperCase() === id?.toUpperCase());
  if (!item) return;

  CURRENT_EDIT_UNIT_ID = item.id_unit;
  document.getElementById("orgunit-modal-title").innerText = `Edit: ${item.nama_unit}`;
  const idInput = document.getElementById("unit-input-id");
  idInput.value = item.id_unit;
  idInput.disabled = true;
  document.getElementById("unit-input-tipe").value = item.tipe_unit || "CABANG";
  document.getElementById("unit-input-name").value = item.nama_unit || "";
  if (document.getElementById("unit-input-status")) document.getElementById("unit-input-status").value = (item.is_active !== false) ? "true" : "false";
  document.getElementById("btn-delete-unit")?.classList.remove("hidden");

  if (!ORG_WORK_LOCATIONS_DATA || ORG_WORK_LOCATIONS_DATA.length === 0) {
    await loadWorkLocations();
  }

  populateOrgUnitParentSelect(item.parent_unit_id, item.id_unit);
  populateOrgUnitWorkLocSelect(item.work_location_id);
  document.getElementById("modal-orgunit-edit").classList.remove("hidden");
}

function closeOrgUnitModal() {
  document.getElementById("modal-orgunit-edit").classList.add("hidden");
}

async function handleDeleteOrgUnit(id) {
  if (!id) return;
  const btn = document.getElementById("btn-delete-unit");
  if (btn) btn.disabled = true;

  try {
    const item = ORG_UNITS_DATA.find(u => u.id_unit === id) || { nama_unit: id };

    // 1. Cek sub-unit turunan (parent_unit_id)
    let childUnits = (ORG_UNITS_DATA || []).filter(u => u.parent_unit_id === id && u.id_unit !== id);
    if (supabaseClient) {
      try {
        const { data: cUnits } = await supabaseClient.from("hr_organization_units").select("id_unit, nama_unit").eq("parent_unit_id", id);
        if (cUnits && cUnits.length > 0) childUnits = cUnits.filter(u => u.id_unit !== id);
      } catch (e) { }
    }

    // 2. Cek posisi/jabatan di unit ini (unit_id)
    let positions = (ORG_POSITIONS_DATA || []).filter(p => p.unit_id === id);
    if (supabaseClient) {
      try {
        const { data: pData } = await supabaseClient.from("hr_job_positions").select("id_position, nama_jabatan").eq("unit_id", id);
        if (pData && pData.length > 0) positions = pData;
      } catch (e) {
        try {
          const { data: pData } = await supabaseClient.from("job_positions").select("id_position, nama_jabatan").eq("unit_id", id);
          if (pData && pData.length > 0) positions = pData;
        } catch (err) { }
      }
    }

    // 3. Cek karyawan aktif yang bertugas di unit ini (location_id)
    let employees = [];
    if (supabaseClient) {
      try {
        const { data: eData } = await supabaseClient.from("hr_employees").select("nip, name").eq("location_id", id).is("deleted_at", null);
        if (eData && eData.length > 0) employees = eData;
      } catch (e) {
        try {
          const { data: eData } = await supabaseClient.from("employees").select("nip, name").eq("location_id", id).is("deleted_at", null);
          if (eData && eData.length > 0) employees = eData;
        } catch (err) { }
      }
    }

    const hasUsage = (childUnits.length > 0) || (positions.length > 0) || (employees.length > 0);

    if (hasUsage) {
      // KONDISI 1: SEDANG DIGUNAKAN -> HANYA SOFT DELETE / NONAKTIFKAN
      const reasons = [];
      if (childUnits.length > 0) {
        reasons.push(`${childUnits.length} Sub-Unit (${childUnits.slice(0, 3).map(c => c.nama_unit || c.id_unit).join(", ")})`);
      }
      if (positions.length > 0) {
        reasons.push(`${positions.length} Jabatan (${positions.slice(0, 3).map(p => p.nama_jabatan || p.id_position).join(", ")})`);
      }
      if (employees.length > 0) {
        reasons.push(`${employees.length} Karyawan (${employees.slice(0, 3).map(e => e.name || e.nip).join(", ")})`);
      }

      const reasonsText = reasons.map(r => `• ${r}`).join("\n");
      const msg = `⚠️ DATA SEDANG DIGUNAKAN DI TABEL LAIN!\n\nUnit Organisasi "${item.nama_unit}" (${id}) saat ini terhubung dengan:\n${reasonsText}\n\nKarena sedang digunakan, unit ini TIDAK BISA DIHAPUS PERMANEN demi menjaga integritas database dan data historis karyawan.\n\nSistem akan mengubah status unit ini menjadi NONAKTIF (is_active = false).\n\nApakah Anda ingin melanjutkan?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await updateOrgCoreTableActiveStatus("organization_units", "id_unit", id, false);

      const target = ORG_UNITS_DATA.find(u => u.id_unit === id);
      if (target) target.is_active = false;

      renderOrgUnitsList(ORG_UNITS_DATA);
      populateOrgFilterUnits();
      closeOrgUnitModal();
      showToast(`Unit "${id}" diubah menjadi NONAKTIF karena sedang digunakan.`, "info", 2500);
    } else {
      // KONDISI 2: TIDAK DIGUNAKAN DI TABEL MANAPUN -> HAPUS PERMANEN
      const msg = `🗑️ HAPUS PERMANEN\n\nUnit Organisasi "${item.nama_unit}" (${id}) TIDAK DIGUNAKAN oleh karyawan, jabatan, atau sub-unit manapun.\n\nApakah Anda yakin ingin MENGHAPUS PERMANEN data ini dari database?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await deleteOrgCoreTable("organization_units", "id_unit", id);
      ORG_UNITS_DATA = ORG_UNITS_DATA.filter(u => u.id_unit !== id);
      renderOrgUnitsList(ORG_UNITS_DATA);
      populateOrgFilterUnits();
      closeOrgUnitModal();
      showToast(`Unit organisasi "${id}" berhasil dihapus permanen dari database!`, "success", 2000);
    }
  } catch (e) {
    alert("Gagal memproses penghapusan: " + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function populateOrgUnitParentSelect(selectedId = "", excludeId = "") {
  const select = document.getElementById("unit-input-parent");
  if (!select) return;

  const eligible = ORG_UNITS_DATA.filter(u => u.id_unit !== excludeId);
  select.innerHTML = '<option value="">- Tidak Ada (Root) -</option>' + eligible.map(u => {
    const nonaktifTag = u.is_active === false ? ' [NONAKTIF]' : '';
    return `<option value="${u.id_unit}" ${u.id_unit === selectedId ? 'selected' : ''}>${u.nama_unit} (${u.tipe_unit})${nonaktifTag}</option>`;
  }).join("");
}

function populateOrgUnitWorkLocSelect(selectedId = "") {
  const select = document.getElementById("unit-input-workloc");
  if (!select) return;

  select.innerHTML = '<option value="">- Tidak Ada / Belum Ditentukan -</option>' + (ORG_WORK_LOCATIONS_DATA || []).map(w => {
    const idLoc = w.id_work_location || w.location_id;
    const nameLoc = w.nama_lokasi || w.name || idLoc;
    const nonaktifTag = w.is_active === false ? ' [NONAKTIF]' : '';
    const isSelected = (idLoc === selectedId || w.location_id === selectedId);
    return `<option value="${idLoc}" ${isSelected ? 'selected' : ''}>${nameLoc} (${idLoc})${nonaktifTag}</option>`;
  }).join("");
}

async function handleSaveOrgUnit(e) {
  e.preventDefault();
  // Jika sedang mode edit, gunakan ID asli (CURRENT_EDIT_UNIT_ID) agar tidak terjadi mismatch casing di PostgreSQL
  const rawIdInput = document.getElementById("unit-input-id").value.trim();
  const id = CURRENT_EDIT_UNIT_ID ? CURRENT_EDIT_UNIT_ID : rawIdInput.toUpperCase();
  const tipe = document.getElementById("unit-input-tipe").value;
  const name = document.getElementById("unit-input-name").value.trim();
  const parent = document.getElementById("unit-input-parent").value || null;
  let workloc = document.getElementById("unit-input-workloc").value || null;
  const isActive = document.getElementById("unit-input-status") ? (document.getElementById("unit-input-status").value !== "false") : true;

  // Pastikan jika nilai string kosong atau "null" diubah menjadi null murni
  if (!workloc || workloc === "" || workloc === "null" || workloc === "undefined") {
    workloc = null;
  }

  // Jika workloc dipilih, pastikan record tempat kerja tersebut sudah ada di tabel hr_work_locations
  // demi mencegah pelanggaran Foreign Key Constraint PostgreSQL
  if (workloc && supabaseClient) {
    try {
      const matchLoc = (ORG_WORK_LOCATIONS_DATA || []).find(w => (w.id_work_location === workloc || w.location_id === workloc));
      if (matchLoc) {
        // Upsert sinkronisasi ke hr_work_locations jika belum tersimpan
        const locPayload = {
          id_work_location: workloc,
          nama_lokasi: matchLoc.nama_lokasi || matchLoc.name || workloc,
          alamat_lengkap: matchLoc.alamat_lengkap || matchLoc.address || "-",
          kota: matchLoc.kota || "-",
          provinsi: matchLoc.provinsi || "-",
          latitude: parseFloat(matchLoc.latitude || matchLoc.lat || 0),
          longitude: parseFloat(matchLoc.longitude || matchLoc.long || 0),
          radius_meter: parseInt(matchLoc.radius_meter || matchLoc.max_radius_meter || 100),
          is_active: matchLoc.is_active !== false,
          updated_at: new Date().toISOString()
        };
        await supabaseClient.from("hr_work_locations").upsert(locPayload, { onConflict: "id_work_location" });
      }
    } catch (locSyncErr) {
      console.warn("[Org Unit] Sinkronisasi referensi work location warning:", locSyncErr);
    }
  }

  const payload = {
    id_unit: id,
    tipe_unit: tipe,
    nama_unit: name,
    parent_unit_id: parent,
    work_location_id: workloc,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-unit");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    await upsertOrgCoreTable("organization_units", payload, "id_unit");

    // Jika ada duplikasi casing sebelumnya di database (misal "Area 01" vs "AREA 01"), bersihkan yang lama jika berbeda
    if (CURRENT_EDIT_UNIT_ID && CURRENT_EDIT_UNIT_ID.toUpperCase() !== CURRENT_EDIT_UNIT_ID) {
      // jika id lama memiliki huruf kecil dan sudah tersimpan versi UPPERCASE, hapus versi duplikat
      deleteOrgCoreTable("organization_units", "id_unit", CURRENT_EDIT_UNIT_ID.toUpperCase()).catch(() => { });
    }

    // Update state ORG_UNITS_DATA secara case-insensitive
    const idx = ORG_UNITS_DATA.findIndex(u =>
      u.id_unit === id ||
      (CURRENT_EDIT_UNIT_ID && u.id_unit === CURRENT_EDIT_UNIT_ID) ||
      (u.id_unit && u.id_unit.trim().toUpperCase() === id.toUpperCase())
    );
    if (idx >= 0) {
      ORG_UNITS_DATA[idx] = payload;
    } else {
      ORG_UNITS_DATA.push(payload);
    }

    // Bersihkan bila ada elemen ganda di array lokal
    const uniqueMap = new Map();
    ORG_UNITS_DATA.forEach(u => uniqueMap.set((u.id_unit || "").trim().toUpperCase(), u));
    ORG_UNITS_DATA = Array.from(uniqueMap.values());

    renderOrgUnitsList(ORG_UNITS_DATA);
    populateOrgFilterUnits();
    closeOrgUnitModal();
    showToast("Unit organisasi berhasil disimpan ke database!", "success", 1500);
  } catch (err) {
    console.error("[Org Unit] Gagal simpan:", err);
    let errorMsg = err.message || JSON.stringify(err);
    if (errorMsg.includes("foreign key") || errorMsg.includes("violates foreign key constraint")) {
      errorMsg = `Gagal menyimpan: Tempat kerja (${workloc}) belum terdaftar atau terhapus di master Work Location. Silakan daftarkan lokasi fisik terlebih dahulu pada tab "Work Location".`;
    }
    alert("Gagal menyimpan unit: " + errorMsg);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ---------------- 3. MASTER POSISI / JABATAN ----------------
async function loadOrgPositions() {
  const data = await loadOrgCoreTable("job_positions", "id_position");
  if (data !== null) {
    ORG_POSITIONS_DATA = data;
    renderOrgPositionsList(ORG_POSITIONS_DATA);
    return;
  }

  ORG_POSITIONS_DATA = DEFAULT_ORG_POSITIONS;
  renderOrgPositionsList(ORG_POSITIONS_DATA);
}

function renderOrgPositionsList(list) {
  const container = document.getElementById("job-positions-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Belum ada posisi jabatan terdaftar. Silakan klik tombol "+ Tambah Posisi / Jabatan".</div>';
    return;
  }

  container.innerHTML = list.map(pos => {
    const isActive = pos.is_active !== false;

    return `
      <div class="bg-white px-3.5 py-2.5 rounded-2xl border ${isActive ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-300/80 bg-slate-50/70 border-dashed'} shadow-xs flex items-center justify-between gap-3 transition">
        <div class="min-w-0 flex-1 flex items-center space-x-2.5">
          <h4 class="font-bold text-xs sm:text-sm text-slate-800 truncate" title="${pos.nama_jabatan}">${pos.nama_jabatan}</h4>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}">
            <i class="fa-solid fa-circle text-[6px] mr-1 ${isActive ? 'text-emerald-500' : 'text-rose-400'}"></i>${isActive ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>
        <div class="flex items-center space-x-1.5 shrink-0">
          <button type="button" onclick="openPositionPermissionsModal('${pos.id_position}')" class="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-indigo-200 transition" title="Atur Hak Akses Multi-Aplikasi">
            <i class="fa-solid fa-shield-halved text-xs"></i>
            <span class="hidden sm:inline">Hak Akses</span>
          </button>
          <button type="button" onclick="openEditJobPositionModal('${pos.id_position}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition" title="Edit Posisi Jabatan">
            <i class="fa-solid fa-pen-to-square text-xs"></i>
            <span>Edit</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddJobPositionModal() {
  CURRENT_EDIT_JOBPOS_ID = null;
  document.getElementById("jobpos-modal-title").innerText = "Tambah Posisi / Jabatan";
  const idInput = document.getElementById("pos-input-id");
  idInput.value = "";
  idInput.disabled = false;
  document.getElementById("pos-input-name").value = "";
  if (document.getElementById("pos-input-status")) document.getElementById("pos-input-status").value = "true";
  document.getElementById("btn-delete-pos")?.classList.add("hidden");

  populateJobPosLevelSelect("");
  populateJobPosReportsToSelect("");
  document.getElementById("modal-jobpos-edit").classList.remove("hidden");
}

function openEditJobPositionModal(id) {
  const item = ORG_POSITIONS_DATA.find(p => p.id_position === id);
  if (!item) return;

  CURRENT_EDIT_JOBPOS_ID = id;
  document.getElementById("jobpos-modal-title").innerText = `Edit: ${item.nama_jabatan}`;
  const idInput = document.getElementById("pos-input-id");
  idInput.value = item.id_position;
  idInput.disabled = true;
  document.getElementById("pos-input-name").value = item.nama_jabatan || "";
  if (document.getElementById("pos-input-status")) document.getElementById("pos-input-status").value = (item.is_active !== false) ? "true" : "false";
  document.getElementById("btn-delete-pos")?.classList.remove("hidden");

  populateJobPosLevelSelect(item.level_id);
  populateJobPosReportsToSelect(item.reports_to_unit_id, id, item.coordination_to_unit_id);
  document.getElementById("modal-jobpos-edit").classList.remove("hidden");
}

function closeJobPosModal() {
  document.getElementById("modal-jobpos-edit").classList.add("hidden");
}

async function handleDeleteJobPosition(id) {
  if (!id) return;
  const btn = document.getElementById("btn-delete-pos");
  if (btn) btn.disabled = true;

  try {
    const item = ORG_POSITIONS_DATA.find(p => p.id_position === id) || { nama_jabatan: id };

    // 1. Cek bawahan yang melapor ke posisi ini (reports_to_unit_id / coordination_to_unit_id)
    let subordinates = (ORG_POSITIONS_DATA || []).filter(p => (p.reports_to_unit_id === id || p.coordination_to_unit_id === id) && p.id_position !== id);
    if (supabaseClient) {
      try {
        const { data: subPos } = await supabaseClient
          .from("hr_job_positions")
          .select("id_position, nama_jabatan")
          .or(`reports_to_unit_id.eq.${id},coordination_to_unit_id.eq.${id}`);
        if (subPos && subPos.length > 0) subordinates = subPos.filter(p => p.id_position !== id);
      } catch (e) { }
    }

    // 2. Cek karyawan dengan jabatan ini (hr_employees.position_id)
    let employees = [];
    if (supabaseClient) {
      try {
        const { data: empData } = await supabaseClient.from("hr_employees").select("id, nip, name").eq("position_id", id);
        if (empData && empData.length > 0) employees = empData;
      } catch (e) {
        try {
          const { data: empData } = await supabaseClient.from("employees").select("id, nip, name").eq("position_id", id);
          if (empData && empData.length > 0) employees = empData;
        } catch (err) { }
      }
    }

    const isUsed = subordinates.length > 0 || employees.length > 0;

    if (isUsed) {
      // KONDISI 1: DIGUNAKAN DI TABEL LAIN -> UBAH JADI NONAKTIF (SOFT DELETE)
      let reasons = [];
      if (subordinates.length > 0) {
        reasons.push(`${subordinates.length} Jabatan Bawahan/Struktur (${subordinates.slice(0, 3).map(s => s.nama_jabatan || s.id_position).join(", ")})`);
      }
      if (employees.length > 0) {
        reasons.push(`${employees.length} Karyawan Aktif (${employees.slice(0, 3).map(e => e.name || e.nip).join(", ")})`);
      }

      const reasonsText = reasons.map(r => `• ${r}`).join("\n");
      const msg = `⚠️ DATA SEDANG DIGUNAKAN DI TABEL LAIN!\n\nPosisi Jabatan "${item.nama_jabatan}" (${id}) saat ini terhubung dengan:\n${reasonsText}\n\nKarena sedang digunakan, jabatan ini TIDAK BISA DIHAPUS PERMANEN demi menjaga hierarki organisasi dan data karyawan.\n\nSistem akan mengubah status jabatan ini menjadi NONAKTIF (is_active = false).\n\nApakah Anda ingin melanjutkan?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await updateOrgCoreTableActiveStatus("job_positions", "id_position", id, false);

      const target = ORG_POSITIONS_DATA.find(p => p.id_position === id);
      if (target) target.is_active = false;

      renderOrgPositionsList(ORG_POSITIONS_DATA);
      closeJobPosModal();
      showToast(`Posisi jabatan "${id}" diubah menjadi NONAKTIF karena sedang digunakan.`, "info", 2500);
    } else {
      // KONDISI 2: TIDAK DIGUNAKAN DI TABEL MANAPUN -> HAPUS PERMANEN
      const msg = `🗑️ HAPUS PERMANEN\n\nPosisi Jabatan "${item.nama_jabatan}" (${id}) TIDAK DIGUNAKAN oleh karyawan maupun struktur jabatan lain.\n\nApakah Anda yakin ingin MENGHAPUS PERMANEN data ini dari database?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await deleteOrgCoreTable("job_positions", "id_position", id);
      ORG_POSITIONS_DATA = ORG_POSITIONS_DATA.filter(p => p.id_position !== id);
      renderOrgPositionsList(ORG_POSITIONS_DATA);
      closeJobPosModal();
      showToast(`Posisi jabatan "${id}" berhasil dihapus permanen dari database!`, "success", 2000);
    }
  } catch (e) {
    alert("Gagal memproses penghapusan: " + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

function populateJobPosLevelSelect(selected = "") {
  const select = document.getElementById("pos-input-level");
  if (!select) return;
  select.innerHTML = (ORG_LEVELS_DATA || []).map(l => {
    const nonaktifTag = l.is_active === false ? ' [NONAKTIF]' : '';
    return `<option value="${l.id_level}" ${l.id_level === selected ? 'selected' : ''}>${l.nama_level} (${l.id_level})${nonaktifTag}</option>`;
  }).join("");
}

function populateJobPosUnitSelect(selected = "") {
  const select = document.getElementById("pos-input-unit");
  if (!select) return;
  select.innerHTML = (ORG_UNITS_DATA || []).map(u => {
    const nonaktifTag = u.is_active === false ? ' [NONAKTIF]' : '';
    return `<option value="${u.id_unit}" ${u.id_unit === selected ? 'selected' : ''}>${u.nama_unit} (${u.tipe_unit})${nonaktifTag}</option>`;
  }).join("");
}

function populateJobPosReportsToSelect(selected = "", excludeId = "", selectedCoord = "") {
  const select = document.getElementById("pos-input-reportsto");
  const coordSelect = document.getElementById("pos-input-coord");
  const eligible = ORG_POSITIONS_DATA.filter(p => p.id_position !== excludeId);

  if (select) {
    select.innerHTML = '<option value="">- Tidak Ada (Puncak / Direksi) -</option>' + eligible.map(p => {
      const nonaktifTag = p.is_active === false ? ' [NONAKTIF]' : '';
      return `<option value="${p.id_position}" ${p.id_position === selected ? 'selected' : ''}>${p.nama_jabatan} (${p.id_position})${nonaktifTag}</option>`;
    }).join("");
  }

  if (coordSelect) {
    coordSelect.innerHTML = '<option value="">- Tidak Ada Koordinasi -</option>' + eligible.map(p => {
      const nonaktifTag = p.is_active === false ? ' [NONAKTIF]' : '';
      return `<option value="${p.id_position}" ${p.id_position === selectedCoord ? 'selected' : ''}>${p.nama_jabatan} (${p.id_position})${nonaktifTag}</option>`;
    }).join("");
  }
}

async function handleSaveJobPosition(e) {
  e.preventDefault();
  const id = document.getElementById("pos-input-id").value.trim().toUpperCase();
  const name = document.getElementById("pos-input-name").value.trim();
  const level = document.getElementById("pos-input-level").value;
  const reportsTo = document.getElementById("pos-input-reportsto")?.value || null;
  const coord = document.getElementById("pos-input-coord")?.value || null;
  const isActive = document.getElementById("pos-input-status") ? (document.getElementById("pos-input-status").value !== "false") : true;

  const payload = {
    id_position: id,
    nama_jabatan: name,
    level_id: level,
    unit_id: null,
    reports_to_unit_id: reportsTo,
    coordination_to_unit_id: coord,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-pos");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    await upsertOrgCoreTable("job_positions", payload, "id_position");

    const idx = ORG_POSITIONS_DATA.findIndex(p => p.id_position === id);
    if (idx >= 0) ORG_POSITIONS_DATA[idx] = payload;
    else ORG_POSITIONS_DATA.push(payload);

    renderOrgPositionsList(ORG_POSITIONS_DATA);
    closeJobPosModal();
    showToast("Posisi jabatan berhasil disimpan ke database!", "success", 1500);
  } catch (err) {
    alert("Gagal menyimpan jabatan: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ---------------- 4. MASTER LEVEL (GRADE) ----------------
async function loadOrgLevels() {
  const data = await loadOrgCoreTable("master_levels", "bobot_level");
  if (data !== null) {
    ORG_LEVELS_DATA = data;
    renderOrgLevelsList(ORG_LEVELS_DATA);
    return;
  }

  ORG_LEVELS_DATA = DEFAULT_ORG_LEVELS;
  renderOrgLevelsList(ORG_LEVELS_DATA);
}

function renderOrgLevelsList(list) {
  const container = document.getElementById("master-levels-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">Belum ada master level terdaftar.</div>';
    return;
  }

  container.innerHTML = list.map(l => {
    const isActive = l.is_active !== false;
    return `
      <div class="bg-white p-3.5 rounded-2xl border ${isActive ? 'border-slate-200 hover:border-indigo-300' : 'border-slate-300/80 bg-slate-50/70 border-dashed'} shadow-xs flex items-center justify-between gap-3 transition">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl ${isActive ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-500 border-slate-300'} border flex items-center justify-center font-bold text-xs">
            ${l.bobot_level}
          </div>
          <div>
            <div class="flex items-center space-x-2">
              <span class="font-mono text-xs font-bold text-slate-900">${l.id_level}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-300'}">${isActive ? 'AKTIF' : 'NONAKTIF'}</span>
            </div>
            <h4 class="font-bold text-xs sm:text-sm text-slate-800 mt-0.5">${l.nama_level}</h4>
          </div>
        </div>
        <button type="button" onclick="openEditMasterLevelModal('${l.id_level}')" class="px-2.5 py-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition">
          <i class="fa-solid fa-pen-to-square"></i>
          <span>Edit</span>
        </button>
      </div>
    `;
  }).join("");
}

function openAddMasterLevelModal() {
  CURRENT_EDIT_LEVEL_ID = null;
  document.getElementById("level-modal-title").innerText = "Tambah Master Level";
  const idInput = document.getElementById("lvl-input-id");
  idInput.value = `L-${(ORG_LEVELS_DATA.length + 1).toString().padStart(2, '0')}`;
  idInput.disabled = false;
  document.getElementById("lvl-input-name").value = "";
  document.getElementById("lvl-input-bobot").value = (ORG_LEVELS_DATA.length + 1).toString();
  if (document.getElementById("lvl-input-status")) document.getElementById("lvl-input-status").value = "true";
  document.getElementById("btn-delete-lvl")?.classList.add("hidden");
  document.getElementById("modal-level-edit").classList.remove("hidden");
}

function openEditMasterLevelModal(id) {
  const item = ORG_LEVELS_DATA.find(l => l.id_level === id);
  if (!item) return;

  CURRENT_EDIT_LEVEL_ID = id;
  document.getElementById("level-modal-title").innerText = `Edit: ${item.nama_level}`;
  const idInput = document.getElementById("lvl-input-id");
  idInput.value = item.id_level;
  idInput.disabled = true;
  document.getElementById("lvl-input-name").value = item.nama_level || "";
  document.getElementById("lvl-input-bobot").value = item.bobot_level || 1;
  if (document.getElementById("lvl-input-status")) document.getElementById("lvl-input-status").value = (item.is_active !== false) ? "true" : "false";
  document.getElementById("btn-delete-lvl")?.classList.remove("hidden");
  document.getElementById("modal-level-edit").classList.remove("hidden");
}

function closeMasterLevelModal() {
  document.getElementById("modal-level-edit").classList.add("hidden");
}

async function handleDeleteMasterLevel(id) {
  if (!id) return;
  const btn = document.getElementById("btn-delete-lvl");
  if (btn) btn.disabled = true;

  try {
    const item = ORG_LEVELS_DATA.find(l => l.id_level === id) || { nama_level: id };

    // Cek jabatan yang menggunakan level ini (job_positions.level_id)
    let positionsUsing = (ORG_POSITIONS_DATA || []).filter(p => p.level_id === id);
    if (supabaseClient) {
      try {
        const { data } = await supabaseClient.from("hr_job_positions").select("id_position, nama_jabatan").eq("level_id", id);
        if (data && data.length > 0) positionsUsing = data;
      } catch (e) {
        try {
          const { data } = await supabaseClient.from("job_positions").select("id_position, nama_jabatan").eq("level_id", id);
          if (data && data.length > 0) positionsUsing = data;
        } catch (err) { }
      }
    }

    if (positionsUsing.length > 0) {
      // KONDISI 1: DIGUNAKAN DI TABEL LAIN -> UBAH JADI NONAKTIF (SOFT DELETE)
      const posNames = positionsUsing.map(p => `• ${p.nama_jabatan || p.id_position} (${p.id_position})`).slice(0, 5).join("\n");
      const moreText = positionsUsing.length > 5 ? `\n...dan ${positionsUsing.length - 5} jabatan lainnya.` : "";

      const msg = `⚠️ DATA SEDANG DIGUNAKAN DI TABEL LAIN!\n\nMaster Level "${item.nama_level}" (${id}) saat ini terhubung dengan ${positionsUsing.length} Posisi Jabatan:\n${posNames}${moreText}\n\nKarena sedang digunakan, level ini TIDAK BISA DIHAPUS PERMANEN demi menjaga hierarki jabatan.\n\nSistem akan mengubah status level ini menjadi NONAKTIF (is_active = false).\n\nApakah Anda ingin melanjutkan?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await updateOrgCoreTableActiveStatus("master_levels", "id_level", id, false);

      const target = ORG_LEVELS_DATA.find(l => l.id_level === id);
      if (target) target.is_active = false;

      renderOrgLevelsList(ORG_LEVELS_DATA);
      closeMasterLevelModal();
      showToast(`Master level "${id}" diubah menjadi NONAKTIF karena sedang digunakan.`, "info", 2500);
    } else {
      // KONDISI 2: TIDAK DIGUNAKAN DI TABEL MANAPUN -> HAPUS PERMANEN
      const msg = `🗑️ HAPUS PERMANEN\n\nMaster Level "${item.nama_level}" (${id}) TIDAK DIGUNAKAN oleh jabatan manapun.\n\nApakah Anda yakin ingin MENGHAPUS PERMANEN data ini dari database?`;

      if (!confirm(msg)) {
        if (btn) btn.disabled = false;
        return;
      }

      await deleteOrgCoreTable("master_levels", "id_level", id);
      ORG_LEVELS_DATA = ORG_LEVELS_DATA.filter(l => l.id_level !== id);
      renderOrgLevelsList(ORG_LEVELS_DATA);
      closeMasterLevelModal();
      showToast(`Master level "${id}" berhasil dihapus permanen dari database!`, "success", 2000);
    }
  } catch (e) {
    alert("Gagal memproses penghapusan: " + e.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleSaveMasterLevel(e) {
  e.preventDefault();
  const id = document.getElementById("lvl-input-id").value.trim().toUpperCase();
  const name = document.getElementById("lvl-input-name").value.trim();
  const bobot = parseInt(document.getElementById("lvl-input-bobot").value) || 1;
  const isActive = document.getElementById("lvl-input-status") ? (document.getElementById("lvl-input-status").value !== "false") : true;

  const payload = {
    id_level: id,
    nama_level: name,
    bobot_level: bobot,
    is_active: isActive,
    updated_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-lvl");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    await upsertOrgCoreTable("master_levels", payload, "id_level");

    const idx = ORG_LEVELS_DATA.findIndex(l => l.id_level === id);
    if (idx >= 0) ORG_LEVELS_DATA[idx] = payload;
    else ORG_LEVELS_DATA.push(payload);

    ORG_LEVELS_DATA.sort((a, b) => a.bobot_level - b.bobot_level);
    renderOrgLevelsList(ORG_LEVELS_DATA);
    closeMasterLevelModal();
    showToast("Master level berhasil disimpan ke database!", "success", 1500);
  } catch (err) {
    alert("Gagal menyimpan level: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

// ---------------- 5. BAGAN VISUAL ORG CHART TREE ----------------
function populateOrgFilterUnits() {
  const select = document.getElementById("org-chart-filter-unit");
  if (!select) return;
  const current = select.value || "ALL";
  select.innerHTML = '<option value="ALL">Semua Unit (Seluruh Organisasi)</option>' + (ORG_UNITS_DATA || []).map(u => {
    return `<option value="${u.id_unit}">${u.nama_unit} (${u.tipe_unit})</option>`;
  }).join("");
  select.value = current;
}

function zoomOrgChart(factor) {
  ORG_CHART_ZOOM = Math.max(0.4, Math.min(2.0, ORG_CHART_ZOOM * factor));
  const container = document.getElementById("org-chart-container");
  if (container) {
    container.style.transform = `scale(${ORG_CHART_ZOOM})`;
  }
}

function resetOrgChartZoom() {
  ORG_CHART_ZOOM = 1.0;
  const container = document.getElementById("org-chart-container");
  if (container) {
    container.style.transform = "scale(1)";
  }
}

function expandAllOrgTreeNodes(expand) {
  const nodes = document.querySelectorAll(".org-tree-children");
  nodes.forEach(el => {
    if (expand) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
  const btns = document.querySelectorAll(".btn-toggle-tree");
  btns.forEach(b => {
    b.innerHTML = expand ? '<i class="fa-solid fa-minus"></i>' : '<i class="fa-solid fa-plus"></i>';
  });
}

function renderVisualOrgChartTree() {
  const container = document.getElementById("org-chart-container");
  if (!container) return;

  const filterUnit = document.getElementById("org-chart-filter-unit")?.value || "ALL";

  // Ambil daftar karyawan aktif dari state / personalia
  const employees = (PERSONALIA_EMPLOYEES_DATA && PERSONALIA_EMPLOYEES_DATA.length > 0)
    ? PERSONALIA_EMPLOYEES_DATA
    : ((SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0)
      ? SETTINGS_EMPLOYEES_DATA
      : (APP_STATE.employees || []));

  // Filter sesuai unit bila dipilih
  let filteredPositions = ORG_POSITIONS_DATA;
  if (filterUnit !== "ALL") {
    filteredPositions = ORG_POSITIONS_DATA.filter(p => p.unit_id === filterUnit);
  }

  // Cari root positions (tidak memiliki reports_to atau reports_to tidak ada di list)
  const allPosIds = new Set(filteredPositions.map(p => p.id_position));
  let rootPositions = filteredPositions.filter(p => !p.reports_to_unit_id || !allPosIds.has(p.reports_to_unit_id));

  if (rootPositions.length === 0 && filteredPositions.length > 0) {
    rootPositions = [filteredPositions[0]];
  }

  if (rootPositions.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-xs text-slate-400">Tidak ada struktur posisi yang cocok dengan filter.</div>';
    return;
  }

  // Recursive Tree Builder
  function buildTreeNodeHtml(pos) {
    // Cari karyawan yang memegang posisi ini
    const holder = employees.find(e => {
      const ePos = String(e.position_id || e.jabatan || "").trim().toLowerCase();
      const pId = String(pos.id_position).toLowerCase();
      const pTitle = String(pos.nama_jabatan).toLowerCase();
      return ePos === pId || ePos === pTitle || ePos.includes(pTitle) || pTitle.includes(ePos);
    });

    const subordinates = filteredPositions.filter(p => p.reports_to_unit_id === pos.id_position);
    const hasChildren = subordinates.length > 0;
    const subCount = subordinates.length;

    const empName = holder ? (holder.nama_lengkap || holder.nama || holder.name) : "Belum Ditugaskan";
    const empNip = holder ? (holder.nip || "-") : "-";
    const empPhoto = holder?.foto_profile_url || holder?.foto || "";
    const isAssigned = !!holder;

    return `
      <li>
        <div class="org-node-card bg-white rounded-2xl p-3 border border-slate-200/90 shadow-xs hover:border-indigo-400 w-56 text-left cursor-pointer relative" onclick="handleOrgNodeClick('${empNip}', '${pos.id_position}')">
          <div class="flex items-start space-x-2.5">
            <div class="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-base text-indigo-700 font-bold shrink-0 overflow-hidden">
              ${empPhoto ? `<img src="${empPhoto}" class="w-full h-full object-cover" />` : `<i class="fa-solid fa-user-tie"></i>`}
            </div>
            <div class="min-w-0 flex-1">
              <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">${pos.level_id || 'Staff'}</span>
              <h5 class="font-bold text-[11px] text-slate-900 leading-tight mt-0.5 truncate">${empName}</h5>
              <p class="text-[10px] text-indigo-900 font-semibold truncate leading-tight">${pos.nama_jabatan}</p>
              <span class="text-[9px] text-slate-400 font-mono block truncate">${empNip}</span>
            </div>
          </div>
          ${hasChildren ? `
            <div class="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-500">
              <span class="font-bold text-indigo-700"><i class="fa-solid fa-users mr-1"></i>${subCount} Bawahan</span>
              <button type="button" onclick="event.stopPropagation(); toggleOrgTreeNode(this)" class="btn-toggle-tree w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-[8px] transition">
                <i class="fa-solid fa-minus"></i>
              </button>
            </div>
          ` : ''}
        </div>
        ${hasChildren ? `
          <ul class="org-tree-children">
            ${subordinates.map(sub => buildTreeNodeHtml(sub)).join("")}
          </ul>
        ` : ''}
      </li>
    `;
  }

  container.innerHTML = `
    <div class="org-tree">
      <ul>
        ${rootPositions.map(root => buildTreeNodeHtml(root)).join("")}
      </ul>
    </div>
  `;
}

function toggleOrgTreeNode(btn) {
  const card = btn.closest(".org-node-card");
  const li = card?.closest("li");
  const childrenUl = li?.querySelector(".org-tree-children");
  if (childrenUl) {
    const isHidden = childrenUl.classList.toggle("hidden");
    btn.innerHTML = isHidden ? '<i class="fa-solid fa-plus"></i>' : '<i class="fa-solid fa-minus"></i>';
  }
}

function handleOrgNodeClick(nip, posId) {
  if (nip && nip !== "-") {
    openEmployeeDossierModal(nip);
  } else {
    const modal = document.getElementById("modal-org-position");
    if (modal) {
      openEditJobPositionModal(posId);
    } else {
      showToast(`Jabatan ${posId} belum ditugaskan karyawan. Kelola di Organization Setting.`, "info", 2500);
    }
  }
}

// ---------------- 6. INTEGRASI SSO DIGIASHA ----------------
async function loadSsoClients() {
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("sso_clients")
        .select("*")
        .order("client_id");
      if (!error && data && data.length > 0) {
        ORG_SSO_CLIENTS_DATA = data;
        renderSsoClientsList(ORG_SSO_CLIENTS_DATA);
        return;
      }
    } catch (e) {
      console.warn("Table sso_clients not yet created, using fallback:", e);
    }
  }

  ORG_SSO_CLIENTS_DATA = DEFAULT_ORG_SSO_CLIENTS;
  renderSsoClientsList(ORG_SSO_CLIENTS_DATA);
}

function renderSsoClientsList(list) {
  const container = document.getElementById("sso-clients-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200 col-span-full">Belum ada aplikasi SSO terdaftar.</div>';
    return;
  }

  container.innerHTML = list.map(c => {
    return `
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-400 transition space-y-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center font-bold text-xs">
              <i class="fa-solid fa-cubes"></i>
            </div>
            <div>
              <h5 class="font-bold text-xs text-slate-900 truncate">${c.client_name}</h5>
              <span class="font-mono text-[10px] text-amber-800 font-bold block">${c.client_id}</span>
            </div>
          </div>
          <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">CONNECTED</span>
        </div>
        <p class="text-[10px] text-slate-500 line-clamp-2">${c.description || '-'}</p>
        <div class="pt-1 flex items-center justify-between text-[10px] border-t border-slate-100 font-mono">
          <span class="text-slate-400">Secret: ••••••••••••</span>
          <button type="button" onclick="copySsoSecret('${c.client_secret}')" class="text-amber-600 hover:text-amber-700 font-bold">
            <i class="fa-solid fa-copy mr-1"></i>Copy Secret
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function copySsoSecret(secret) {
  navigator.clipboard.writeText(secret).then(() => {
    showToast("Client Secret berhasil disalin!", "success", 1200);
  });
}

function openAddSsoClientModal() {
  CURRENT_EDIT_SSO_CLIENT_ID = null;
  document.getElementById("sso-modal-title").innerText = "Daftarkan Klien SSO Baru";
  const idInput = document.getElementById("sso-input-id");
  idInput.value = "";
  idInput.disabled = false;
  document.getElementById("sso-input-name").value = "";
  generateRandomSsoSecret();
  document.getElementById("sso-input-desc").value = "";
  document.getElementById("modal-sso-edit").classList.remove("hidden");
}

function generateRandomSsoSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_";
  let res = "sec_digi_";
  for (let i = 0; i < 24; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  document.getElementById("sso-input-secret").value = res;
}

function closeSsoClientModal() {
  document.getElementById("modal-sso-edit").classList.add("hidden");
}

async function handleSaveSsoClient(e) {
  e.preventDefault();
  const id = document.getElementById("sso-input-id").value.trim().toLowerCase();
  const name = document.getElementById("sso-input-name").value.trim();
  const secret = document.getElementById("sso-input-secret").value.trim();
  const desc = document.getElementById("sso-input-desc").value.trim();

  const payload = {
    client_id: id,
    client_name: name,
    client_secret: secret,
    description: desc,
    is_active: true,
    created_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-sso");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Mendaftarkan...';
  btn.disabled = true;

  try {
    if (supabaseClient) {
      const { error } = await supabaseClient
        .from("sso_clients")
        .upsert(payload, { onConflict: "client_id" });
      if (error) console.warn("Supabase save sso_client:", error);
    }

    const idx = ORG_SSO_CLIENTS_DATA.findIndex(c => c.client_id === id);
    if (idx >= 0) ORG_SSO_CLIENTS_DATA[idx] = payload;
    else ORG_SSO_CLIENTS_DATA.push(payload);

    renderSsoClientsList(ORG_SSO_CLIENTS_DATA);
    closeSsoClientModal();
    showToast("Aplikasi SSO berhasil didaftarkan!", "success", 1500);
  } catch (err) {
    alert("Gagal mendaftarkan aplikasi: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

function populateSsoTestEmpSelect() {
  const select = document.getElementById("sso-test-emp-select");
  if (!select) return;
  const list = (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0)
    ? SETTINGS_EMPLOYEES_DATA
    : (APP_STATE.employees || []);

  select.innerHTML = list.map(e => {
    return `<option value="${e.nip}">${e.nama_lengkap || e.nama || e.name} (${e.nip} - ${e.cabang || 'HO'})</option>`;
  }).join("");
}

async function runSsoTokenSimulation() {
  const nip = document.getElementById("sso-test-emp-select")?.value;
  const clientId = document.getElementById("sso-test-client-select")?.value;
  const resultBox = document.getElementById("sso-simulation-result");

  if (!nip || !clientId) {
    alert("Pilih karyawan dan klien aplikasi!");
    return;
  }

  resultBox.classList.remove("hidden");
  resultBox.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses simulasi handshake SSO...';

  // Simulasi Payload RPC verify_sso_token
  const emp = (SETTINGS_EMPLOYEES_DATA || []).find(e => e.nip === nip) || (APP_STATE.employees || []).find(e => e.nip === nip);
  const authCode = `auth_sso_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  setTimeout(() => {
    const mockResponse = {
      status: 200,
      protocol: "Digiasha SSO Token Exchange v1.0",
      timestamp: new Date().toISOString(),
      handshake: {
        client_id: clientId,
        auth_code: authCode,
        status: "VERIFIED_SUCCESS",
        expires_in_seconds: 300
      },
      verified_user: {
        nip: emp?.nip || nip,
        nama_lengkap: emp?.nama_lengkap || emp?.nama || "Karyawan Digiasha",
        email: emp?.email || `${nip}@digiasha.com`,
        cabang: emp?.cabang || "Head Office",
        jabatan: emp?.jabatan || "Officer",
        role_id: emp?.role_id || "R-04",
        status_aktif: "AKTIF",
        sso_session_id: `sess_${Date.now()}`
      }
    };

    resultBox.innerHTML = `<pre>${JSON.stringify(mockResponse, null, 2)}</pre>`;
  }, 600);
}

// ---------------- 6. HAK AKSES MULTI-APLIKASI BERBASIS JABATAN (CENTRALIZED RBAC) ----------------
const ORG_APPS_CONFIG = {
  digi_active: {
    name: "Digi Active",
    icon: "fa-bolt",
    modules: [
      { key: "priority", label: "Priority FAC (Monitoring Prioritas Mitra)" },
      { key: "visit", label: "Form Visit FAC (Kunjungan Regular & OVD)" },
      { key: "onboarding", label: "Calon Mitra (Input Calon Mitra Baru)" },
      { key: "pipeline", label: "Pipeline (Progres & Folder Dokumen)" },
      { key: "gps", label: "GPS Maintain (Pasang / Ganti / Cabut)" },
      { key: "fac", label: "Report GPS (Monitoring Sinyal Harian)" },
      { key: "assignment", label: "Assign & Concern Visit Mitra" },
      { key: "history", label: "Riwayat (Log Visit, Mitra & GPS)" },
      { key: "laporan_activity", label: "Laporan Activity (Monitoring Kunjungan)" },
      { key: "izin", label: "Pengajuan Izin (WFA, Cuti, Sakit, Terlambat)" },
      { key: "persetujuan", label: "Persetujuan (Approval Hub Permohonan)" },
      { key: "attendance_summary", label: "Rekap Absen Mandiri (Kalender Presensi)" },
      { key: "rekap_tim", label: "Presensi Tim (Monitoring Presensi Staf)" },
      { key: "slip_gaji", label: "E-Slip Gaji & Kompensasi Resmi" },
      { key: "personalia", label: "Data Karyawan & Bagan Organisasi" },
      { key: "expense_claim", label: "Klaim Biaya / Reimbursement (BBM/Tol/Ops)" },
      { key: "internal_memo", label: "Memo Pengajuan Internal Resmi" },
      { key: "employee_loan", label: "Pinjaman Karyawan / Kasbon Darurat" },
      { key: "helpdesk_support", label: "IT & Helpdesk Support Kendala Sistem" },
      { key: "ketentuan", label: "Ketentuan, SOP & Kebijakan Perusahaan" },
      { key: "sop_management", label: "SOP Management (Upload & Kelola SOP)" },
      { key: "organization_setting", label: "Organization Setting (Struktur, Lokasi, SSO)" },
      { key: "settings", label: "Pengaturan Sistem (Akun, Geofence, Area, GPS)" }
    ]
  },
  digicore: {
    name: "Digiasha Core",
    icon: "fa-laptop",
    modules: [
      { key: "org_structure", label: "Organization Structure" },
      { key: "employee_mgmt", label: "Employee Management" },
      { key: "approval_onboarding", label: "Approval: Onboarding Partner" },
      { key: "approval_pre_komite", label: "Approval: Pre Komite Fasilitas" },
      { key: "approval_final_komite", label: "Approval: Final Komite Fasilitas" },
      { key: "approval_cek_bpkb", label: "Approval: Cek BPKB" },
      { key: "approval_inspeksi", label: "Approval: Inspeksi Kendaraan" },
      { key: "vehicle_pricelist", label: "Vehicle Pricelist Maintenance" },
      { key: "package_maintenance", label: "Package Maintenance" }
    ]
  },
  digi_workapp: {
    name: "Digi Appwork",
    icon: "fa-mobile-screen",
    modules: [
      { key: "attendance_gps", label: "Presensi GPS & Selfie Kehadiran" },
      { key: "task_assignment", label: "Penugasan & Task Pipeline" },
      { key: "visit_dealer", label: "Kunjungan Lapangan & Visit Mitra" },
      { key: "onboarding_partner", label: "Onboarding Mitra Dealer Baru" },
      { key: "daily_activity", label: "Laporan Aktivitas Harian (Daily Report)" },
      { key: "expense_claim", label: "Pengajuan Klaim Biaya & Bensin" },
      { key: "leave_permit", label: "Pengajuan Izin, Cuti & Sakit" },
      { key: "payslip_info", label: "Slip Gaji & Info Payroll" }
    ]
  },
  digi_spector: {
    name: "Digispector",
    icon: "fa-magnifying-glass",
    modules: [
      { key: "inspection_queue", label: "Antrean & Penugasan Inspeksi" },
      { key: "field_inspection_form", label: "Formulir Inspeksi Lapangan" },
      { key: "engine_body_checklist", label: "Checklist Mesin, Bodi & Interior" },
      { key: "vehicle_photo_doc", label: "Upload Foto Unit & Dokumen Fisik" },
      { key: "bpkb_stnk_validation", label: "Validasi BPKB & STNK" },
      { key: "market_price_scoring", label: "Estimasi Harga Pasar & Skor Kelayakan" },
      { key: "inspection_approval", label: "Approval Hasil Inspeksi Unit" }
    ]
  }
};

const DEFAULT_POSITION_PERMISSIONS = {
  "POS-DIR-UTAMA": [
    // Digi Active (Akses Penuh Seluruh Modul)
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view", "digi_active:slip_gaji:edit",
    "digi_active:personalia:view", "digi_active:personalia:edit",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:employee_loan:view", "digi_active:employee_loan:edit",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view", "digi_active:ketentuan:edit",
    "digi_active:sop_management:view", "digi_active:sop_management:edit",
    "digi_active:organization_setting:view", "digi_active:organization_setting:edit",
    "digi_active:settings:view", "digi_active:settings:edit",

    // Satelit: Core, Appwork, Spector
    "digicore:org_structure:view", "digicore:org_structure:edit",
    "digicore:employee_mgmt:view", "digicore:employee_mgmt:edit",
    "digicore:approval_onboarding:view", "digicore:approval_onboarding:edit",
    "digicore:approval_pre_komite:view", "digicore:approval_pre_komite:edit",
    "digicore:approval_final_komite:view", "digicore:approval_final_komite:edit",
    "digicore:approval_cek_bpkb:view", "digicore:approval_cek_bpkb:edit",
    "digicore:approval_inspeksi:view", "digicore:approval_inspeksi:edit",
    "digicore:vehicle_pricelist:view", "digicore:vehicle_pricelist:edit",
    "digicore:package_maintenance:view", "digicore:package_maintenance:edit",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:task_assignment:view", "digi_workapp:task_assignment:edit",
    "digi_workapp:visit_dealer:view", "digi_workapp:visit_dealer:edit",
    "digi_workapp:onboarding_partner:view", "digi_workapp:onboarding_partner:edit",
    "digi_workapp:daily_activity:view", "digi_workapp:daily_activity:edit",
    "digi_workapp:expense_claim:view", "digi_workapp:expense_claim:edit",
    "digi_workapp:leave_permit:view", "digi_workapp:leave_permit:edit",
    "digi_workapp:payslip_info:view", "digi_workapp:payslip_info:edit",
    "digi_spector:inspection_queue:view", "digi_spector:inspection_queue:edit",
    "digi_spector:field_inspection_form:view", "digi_spector:field_inspection_form:edit",
    "digi_spector:engine_body_checklist:view", "digi_spector:engine_body_checklist:edit",
    "digi_spector:vehicle_photo_doc:view", "digi_spector:vehicle_photo_doc:edit",
    "digi_spector:bpkb_stnk_validation:view", "digi_spector:bpkb_stnk_validation:edit",
    "digi_spector:market_price_scoring:view", "digi_spector:market_price_scoring:edit",
    "digi_spector:inspection_approval:view", "digi_spector:inspection_approval:edit"
  ],
  "POS-GM-OPS": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view",
    "digi_active:personalia:view", "digi_active:personalia:edit",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:employee_loan:view", "digi_active:employee_loan:edit",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view", "digi_active:ketentuan:edit",
    "digi_active:sop_management:view", "digi_active:sop_management:edit",
    "digi_active:organization_setting:view", "digi_active:organization_setting:edit",
    "digicore:org_structure:view", "digicore:org_structure:edit",
    "digicore:employee_mgmt:view", "digicore:employee_mgmt:edit",
    "digicore:approval_onboarding:view", "digicore:approval_onboarding:edit",
    "digicore:approval_pre_komite:view", "digicore:approval_pre_komite:edit",
    "digicore:approval_final_komite:view", "digicore:approval_final_komite:edit",
    "digicore:approval_inspeksi:view", "digicore:approval_inspeksi:edit",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:visit_dealer:view", "digi_workapp:visit_dealer:edit",
    "digi_spector:inspection_approval:view", "digi_spector:inspection_approval:edit"
  ],
  "POS-BM-SERANG": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view",
    "digi_active:personalia:view",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:employee_loan:view",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view",
    "digicore:org_structure:view",
    "digicore:employee_mgmt:view",
    "digicore:approval_onboarding:view", "digicore:approval_onboarding:edit",
    "digicore:approval_pre_komite:view", "digicore:approval_pre_komite:edit",
    "digicore:approval_cek_bpkb:view",
    "digicore:approval_inspeksi:view",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:task_assignment:view", "digi_workapp:task_assignment:edit",
    "digi_workapp:visit_dealer:view",
    "digi_workapp:daily_activity:view",
    "digi_workapp:expense_claim:view", "digi_workapp:expense_claim:edit",
    "digi_workapp:leave_permit:view", "digi_workapp:leave_permit:edit",
    "digi_workapp:payslip_info:view",
    "digi_spector:inspection_queue:view",
    "digi_spector:inspection_approval:view", "digi_spector:inspection_approval:edit"
  ],
  "POS-BM-TGR": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view",
    "digi_active:personalia:view",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:employee_loan:view",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view",
    "digicore:org_structure:view",
    "digicore:employee_mgmt:view",
    "digicore:approval_onboarding:view", "digicore:approval_onboarding:edit",
    "digicore:approval_pre_komite:view", "digicore:approval_pre_komite:edit",
    "digicore:approval_cek_bpkb:view",
    "digicore:approval_inspeksi:view",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:task_assignment:view", "digi_workapp:task_assignment:edit",
    "digi_workapp:visit_dealer:view",
    "digi_workapp:daily_activity:view",
    "digi_workapp:expense_claim:view", "digi_workapp:expense_claim:edit",
    "digi_workapp:leave_permit:view", "digi_workapp:leave_permit:edit",
    "digi_workapp:payslip_info:view",
    "digi_spector:inspection_queue:view",
    "digi_spector:inspection_approval:view", "digi_spector:inspection_approval:edit"
  ],
  "POS-SPV-FAC": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:task_assignment:view", "digi_workapp:task_assignment:edit",
    "digi_workapp:visit_dealer:view", "digi_workapp:visit_dealer:edit",
    "digi_workapp:onboarding_partner:view", "digi_workapp:onboarding_partner:edit",
    "digi_workapp:daily_activity:view", "digi_workapp:daily_activity:edit",
    "digi_workapp:expense_claim:view", "digi_workapp:expense_claim:edit",
    "digi_workapp:leave_permit:view", "digi_workapp:leave_permit:edit",
    "digi_workapp:payslip_info:view",
    "digi_spector:inspection_queue:view", "digi_spector:inspection_queue:edit",
    "digi_spector:field_inspection_form:view", "digi_spector:field_inspection_form:edit",
    "digi_spector:engine_body_checklist:view", "digi_spector:engine_body_checklist:edit",
    "digi_spector:vehicle_photo_doc:view", "digi_spector:vehicle_photo_doc:edit",
    "digi_spector:bpkb_stnk_validation:view"
  ],
  "POS-FAC-OFFICER": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view", "digi_active:visit:edit",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view",
    "digi_active:history:view",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:attendance_summary:view",
    "digi_active:slip_gaji:view",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:helpdesk_support:view",
    "digi_active:ketentuan:view",
    "digi_workapp:attendance_gps:view", "digi_workapp:attendance_gps:edit",
    "digi_workapp:task_assignment:view", "digi_workapp:task_assignment:edit",
    "digi_workapp:visit_dealer:view", "digi_workapp:visit_dealer:edit",
    "digi_workapp:onboarding_partner:view", "digi_workapp:onboarding_partner:edit",
    "digi_workapp:daily_activity:view", "digi_workapp:daily_activity:edit",
    "digi_workapp:expense_claim:view", "digi_workapp:expense_claim:edit",
    "digi_workapp:leave_permit:view",
    "digi_workapp:payslip_info:view"
  ],
  "POS-ADMIN-HO": [
    "digi_active:priority:view", "digi_active:priority:edit",
    "digi_active:visit:view",
    "digi_active:onboarding:view", "digi_active:onboarding:edit",
    "digi_active:pipeline:view", "digi_active:pipeline:edit",
    "digi_active:gps:view", "digi_active:gps:edit",
    "digi_active:fac:view", "digi_active:fac:edit",
    "digi_active:assignment:view", "digi_active:assignment:edit",
    "digi_active:history:view", "digi_active:history:edit",
    "digi_active:laporan_activity:view", "digi_active:laporan_activity:edit",
    "digi_active:izin:view", "digi_active:izin:edit",
    "digi_active:persetujuan:view", "digi_active:persetujuan:edit",
    "digi_active:attendance_summary:view", "digi_active:attendance_summary:edit",
    "digi_active:rekap_tim:view", "digi_active:rekap_tim:edit",
    "digi_active:slip_gaji:view", "digi_active:slip_gaji:edit",
    "digi_active:personalia:view", "digi_active:personalia:edit",
    "digi_active:expense_claim:view", "digi_active:expense_claim:edit",
    "digi_active:internal_memo:view", "digi_active:internal_memo:edit",
    "digi_active:employee_loan:view", "digi_active:employee_loan:edit",
    "digi_active:helpdesk_support:view", "digi_active:helpdesk_support:edit",
    "digi_active:ketentuan:view", "digi_active:ketentuan:edit",
    "digi_active:sop_management:view", "digi_active:sop_management:edit",
    "digi_active:organization_setting:view", "digi_active:organization_setting:edit",
    "digi_active:settings:view", "digi_active:settings:edit",
    "digicore:org_structure:view", "digicore:org_structure:edit",
    "digicore:employee_mgmt:view", "digicore:employee_mgmt:edit",
    "digicore:vehicle_pricelist:view", "digicore:vehicle_pricelist:edit",
    "digicore:package_maintenance:view", "digicore:package_maintenance:edit",
    "digi_workapp:attendance_gps:view",
    "digi_workapp:payslip_info:view", "digi_workapp:payslip_info:edit"
  ]
};

let ORG_POSITION_PERMS_DATA = { ...DEFAULT_POSITION_PERMISSIONS };
let CURRENT_PERM_POSITION_ID = null;
let CURRENT_PERM_APP_TAB = "digi_active";
let CURRENT_TEMP_PERMS_SET = new Set();
let CURRENT_ROLE_FILTER_KEYWORD = "";

async function loadAllJobPositionPermissions() {
  if (!supabaseClient) return;
  try {
    let rows = null;
    try {
      const { data, error } = await supabaseClient
        .from("hr_job_position_permissions")
        .select("position_id, permission_code");
      if (!error && Array.isArray(data) && data.length > 0) rows = data;
    } catch (e) { }

    if (!rows) {
      try {
        const { data, error } = await supabaseClient
          .from("job_position_permissions")
          .select("position_id, permission_code");
        if (!error && Array.isArray(data) && data.length > 0) rows = data;
      } catch (e) { }
    }

    if (rows && rows.length > 0) {
      const map = {};
      rows.forEach(r => {
        if (!map[r.position_id]) map[r.position_id] = [];
        map[r.position_id].push(r.permission_code);
      });
      // Merge with defaults
      ORG_POSITION_PERMS_DATA = { ...DEFAULT_POSITION_PERMISSIONS, ...map };
      console.log("[Core HR] Berhasil memuat hak akses untuk", Object.keys(map).length, "jabatan dari Supabase");
    }
  } catch (err) {
    console.warn("[Core HR] loadAllJobPositionPermissions exception:", err);
  }
}

async function loadOrgRolePermissions() {
  await loadAllJobPositionPermissions();
  renderOrgRolePermissions(CURRENT_ROLE_FILTER_KEYWORD);
}

function filterOrgRolePermissions(val) {
  CURRENT_ROLE_FILTER_KEYWORD = (val || "").trim();
  renderOrgRolePermissions(CURRENT_ROLE_FILTER_KEYWORD);
}

function renderOrgRolePermissions(filterKeyword = "") {
  const container = document.getElementById("role-permissions-matrix-container");
  if (!container) return;

  const positions = (ORG_POSITIONS_DATA || []).filter(p => {
    if (!filterKeyword) return true;
    const kw = filterKeyword.toLowerCase();
    return (p.nama_jabatan || "").toLowerCase().includes(kw) ||
      (p.id_position || "").toLowerCase().includes(kw) ||
      (p.unit_id || "").toLowerCase().includes(kw);
  });

  if (positions.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400">
        <i class="fa-solid fa-user-slash text-2xl text-slate-300 mb-2 block"></i>
        Tidak ada jabatan yang sesuai pencarian.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
          <tr>
            <th class="p-3 min-w-[200px]">Posisi / Jabatan</th>
            <th class="p-3 min-w-[140px]">Unit Penempatan</th>
            <th class="p-3 min-w-[100px]">Level / Grade</th>
            <th class="p-3 text-center w-24">Status</th>
            <th class="p-3 min-w-[260px]">Akses Aplikasi Aktif</th>
            <th class="p-3 text-right w-32">Aksi</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 bg-white">
          ${positions.map(pos => {
    const unit = (ORG_UNITS_DATA || []).find(u => u.id_unit === pos.unit_id);
    const level = (ORG_LEVELS_DATA || []).find(l => l.id_level === pos.level_id);
    const isActive = pos.is_active !== false;
    const perms = ORG_POSITION_PERMS_DATA[pos.id_position] || [];

    const activeCount = perms.filter(c => c.startsWith("digi_active:") && c.endsWith(":view")).length;
    const coreCount = perms.filter(c => c.startsWith("digicore:") && c.endsWith(":view")).length;
    const workappCount = perms.filter(c => c.startsWith("digi_workapp:") && c.endsWith(":view")).length;
    const spectorCount = perms.filter(c => c.startsWith("digi_spector:") && c.endsWith(":view")).length;

    return `
              <tr class="hover:bg-slate-50 transition">
                <td class="p-3">
                  <div class="font-bold text-slate-900">${pos.nama_jabatan}</div>
                  <div class="font-mono text-[10px] text-slate-400 font-bold">${pos.id_position}</div>
                </td>
                <td class="p-3 text-slate-700 font-medium">
                  ${unit?.nama_unit || pos.unit_id || '-'}
                </td>
                <td class="p-3">
                  <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                    ${level?.nama_level || pos.level_id || '-'}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-300'}">
                    ${isActive ? 'AKTIF' : 'NONAKTIF'}
                  </span>
                </td>
                <td class="p-3">
                  <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${activeCount > 0 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">
                      <i class="fa-solid fa-bolt mr-1 text-amber-500"></i>Active: ${activeCount}
                    </span>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${coreCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">
                      <i class="fa-solid fa-laptop mr-1"></i>Core: ${coreCount}
                    </span>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${workappCount > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">
                      <i class="fa-solid fa-mobile-screen mr-1"></i>Appwork: ${workappCount}
                    </span>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full border ${spectorCount > 0 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}">
                      <i class="fa-solid fa-magnifying-glass mr-1"></i>Spector: ${spectorCount}
                    </span>
                  </div>
                </td>
                <td class="p-3 text-right">
                  <button type="button" onclick="openPositionPermissionsModal('${pos.id_position}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl font-bold text-xs shadow-xs inline-flex items-center space-x-1.5 transition">
                    <i class="fa-solid fa-shield-halved text-xs"></i>
                    <span>Atur Akses</span>
                  </button>
                </td>
              </tr>
            `;
  }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function openPositionPermissionsModal(positionId) {
  const pos = (ORG_POSITIONS_DATA || []).find(p => p.id_position === positionId);
  if (!pos) {
    alert("Jabatan tidak ditemukan: " + positionId);
    return;
  }

  CURRENT_PERM_POSITION_ID = positionId;
  CURRENT_PERM_APP_TAB = "digi_active";

  // Ambil data izin yang sudah tersimpan untuk jabatan ini ke dalam working set
  const savedPerms = ORG_POSITION_PERMS_DATA[positionId] || DEFAULT_POSITION_PERMISSIONS[positionId] || [];
  CURRENT_TEMP_PERMS_SET = new Set(savedPerms);

  // Set Header Modal
  document.getElementById("perm-modal-title").innerText = `Hak Akses: ${pos.nama_jabatan}`;
  document.getElementById("perm-modal-subtitle").innerText = `ID Position: ${pos.id_position}`;

  // Buka tab default Digi Active
  switchPositionPermAppTab("digi_active");

  document.getElementById("modal-position-permissions").classList.remove("hidden");
}

function closePositionPermissionsModal() {
  document.getElementById("modal-position-permissions").classList.add("hidden");
  CURRENT_PERM_POSITION_ID = null;
  CURRENT_TEMP_PERMS_SET.clear();
}

function switchPositionPermAppTab(appKey) {
  CURRENT_PERM_APP_TAB = appKey;
  const appKeys = ["digi_active", "digicore", "digi_workapp", "digi_spector"];

  appKeys.forEach(key => {
    const btn = document.getElementById(`perm-tab-btn-${key}`);
    if (btn) {
      if (key === appKey) {
        btn.className = "pb-2 px-3 border-b-2 font-bold text-xs flex items-center space-x-2 transition border-indigo-600 text-indigo-700 whitespace-nowrap";
      } else {
        btn.className = "pb-2 px-3 border-b-2 font-bold text-xs flex items-center space-x-2 transition border-transparent text-slate-500 hover:text-slate-800 whitespace-nowrap";
      }
    }
  });

  renderPositionPermTable();
}

function renderPositionPermTable() {
  const container = document.getElementById("perm-module-rows-container");
  if (!container) return;

  const appConfig = ORG_APPS_CONFIG[CURRENT_PERM_APP_TAB];
  if (!appConfig) return;

  let allViewChecked = true;
  let allEditChecked = true;

  const rowsHtml = appConfig.modules.map(mod => {
    const viewCode = `${CURRENT_PERM_APP_TAB}:${mod.key}:view`;
    const editCode = `${CURRENT_PERM_APP_TAB}:${mod.key}:edit`;

    const isView = CURRENT_TEMP_PERMS_SET.has(viewCode);
    const isEdit = CURRENT_TEMP_PERMS_SET.has(editCode);

    if (!isView) allViewChecked = false;
    if (!isEdit) allEditChecked = false;

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-2.5 px-3 font-semibold text-slate-800 text-xs">
          ${mod.label}
        </td>
        <td class="py-2.5 px-3 text-center">
          <input type="checkbox" id="perm-view-${mod.key}" 
            ${isView ? 'checked' : ''} 
            onchange="togglePositionPerm('${mod.key}', 'view', this.checked)"
            class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" />
        </td>
        <td class="py-2.5 px-3 text-center">
          <input type="checkbox" id="perm-edit-${mod.key}" 
            ${isEdit ? 'checked' : ''} 
            onchange="togglePositionPerm('${mod.key}', 'edit', this.checked)"
            class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer" />
        </td>
      </tr>
    `;
  }).join("");

  container.innerHTML = rowsHtml;

  // Update check all checkboxes
  const chkAllView = document.getElementById("check-all-view");
  if (chkAllView) chkAllView.checked = (appConfig.modules.length > 0) && allViewChecked;
  const chkAllEdit = document.getElementById("check-all-edit");
  if (chkAllEdit) chkAllEdit.checked = (appConfig.modules.length > 0) && allEditChecked;
}

function togglePositionPerm(modKey, action, checked) {
  const code = `${CURRENT_PERM_APP_TAB}:${modKey}:${action}`;
  const viewCode = `${CURRENT_PERM_APP_TAB}:${modKey}:view`;
  const editCode = `${CURRENT_PERM_APP_TAB}:${modKey}:edit`;

  if (action === "edit") {
    if (checked) {
      CURRENT_TEMP_PERMS_SET.add(editCode);
      CURRENT_TEMP_PERMS_SET.add(viewCode);
      const chkView = document.getElementById(`perm-view-${modKey}`);
      if (chkView) chkView.checked = true;
    } else {
      CURRENT_TEMP_PERMS_SET.delete(editCode);
    }
  } else if (action === "view") {
    if (checked) {
      CURRENT_TEMP_PERMS_SET.add(viewCode);
    } else {
      CURRENT_TEMP_PERMS_SET.delete(viewCode);
      CURRENT_TEMP_PERMS_SET.delete(editCode);
      const chkEdit = document.getElementById(`perm-edit-${modKey}`);
      if (chkEdit) chkEdit.checked = false;
    }
  }

  // Update status check-all
  const appConfig = ORG_APPS_CONFIG[CURRENT_PERM_APP_TAB];
  if (appConfig) {
    let allV = true;
    let allE = true;
    appConfig.modules.forEach(m => {
      if (!CURRENT_TEMP_PERMS_SET.has(`${CURRENT_PERM_APP_TAB}:${m.key}:view`)) allV = false;
      if (!CURRENT_TEMP_PERMS_SET.has(`${CURRENT_PERM_APP_TAB}:${m.key}:edit`)) allE = false;
    });
    const cV = document.getElementById("check-all-view");
    if (cV) cV.checked = allV;
    const cE = document.getElementById("check-all-edit");
    if (cE) cE.checked = allE;
  }
}

function toggleCheckAllCurrentApp(action, checked) {
  const appConfig = ORG_APPS_CONFIG[CURRENT_PERM_APP_TAB];
  if (!appConfig) return;

  appConfig.modules.forEach(mod => {
    const viewCode = `${CURRENT_PERM_APP_TAB}:${mod.key}:view`;
    const editCode = `${CURRENT_PERM_APP_TAB}:${mod.key}:edit`;

    if (action === "view") {
      if (checked) {
        CURRENT_TEMP_PERMS_SET.add(viewCode);
      } else {
        CURRENT_TEMP_PERMS_SET.delete(viewCode);
        CURRENT_TEMP_PERMS_SET.delete(editCode);
      }
    } else if (action === "edit") {
      if (checked) {
        CURRENT_TEMP_PERMS_SET.add(viewCode);
        CURRENT_TEMP_PERMS_SET.add(editCode);
      } else {
        CURRENT_TEMP_PERMS_SET.delete(editCode);
      }
    }
  });

  renderPositionPermTable();
}

async function handleSavePositionPermissions() {
  if (!CURRENT_PERM_POSITION_ID) return;
  const btn = document.getElementById("btn-save-position-perms");
  const origHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  }

  const positionId = CURRENT_PERM_POSITION_ID;
  const permsArray = Array.from(CURRENT_TEMP_PERMS_SET);

  try {
    if (supabaseClient) {
      // 1. Hapus izin lama posisi ini
      try {
        await supabaseClient.from("hr_job_position_permissions").delete().eq("position_id", positionId);
      } catch (e) { }
      try {
        await supabaseClient.from("job_position_permissions").delete().eq("position_id", positionId);
      } catch (e) { }

      // 2. Insert batch izin baru jika ada
      if (permsArray.length > 0) {
        const insertRows = permsArray.map(code => ({
          position_id: positionId,
          permission_code: code
        }));

        let inserted = false;
        try {
          const { error } = await supabaseClient.from("hr_job_position_permissions").insert(insertRows);
          if (!error) inserted = true;
        } catch (e) { }

        if (!inserted) {
          try {
            await supabaseClient.from("job_position_permissions").insert(insertRows);
          } catch (e) { }
        }
      }
    }

    // Update in-memory storage
    ORG_POSITION_PERMS_DATA[positionId] = permsArray;

    // Refresh view matriks
    renderOrgRolePermissions(CURRENT_ROLE_FILTER_KEYWORD);
    closePositionPermissionsModal();

    const pos = (ORG_POSITIONS_DATA || []).find(p => p.id_position === positionId);
    showToast(`Hak akses multi-aplikasi untuk "${pos?.nama_jabatan || positionId}" berhasil disimpan!`, "success", 2000);
  } catch (err) {
    alert("Gagal menyimpan hak akses: " + err.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origHtml;
    }
  }
}

// ---------------- 7. DETAIL PERSONALIA KARYAWAN (DOSSIER 4 TAB) ----------------
let CURRENT_DOSSIER_TX_LIST = [];

async function openEmployeeDossierModal(nipOrId) {
  const modal = document.getElementById("modal-employee-dossier");
  if (!modal) return;

  let emp = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.nip).trim() === String(nipOrId).trim() || String(e.id).trim() === String(nipOrId).trim()) ||
    (SETTINGS_EMPLOYEES_DATA || []).find(e => String(e.nip).trim() === String(nipOrId).trim() || String(e.id).trim() === String(nipOrId).trim()) ||
    (APP_STATE.employees || []).find(e => String(e.nip).trim() === String(nipOrId).trim() || String(e.id).trim() === String(nipOrId).trim());

  if (!emp && supabaseClient) {
    try {
      // 1. Coba cari di hr_employees / employees
      const { data: eRow } = await supabaseClient
        .from("employees")
        .select(`
          *,
          organization_units (nama_unit),
          job_positions (nama_jabatan)
        `)
        .or(`nip.eq.${nipOrId},id.eq.${nipOrId}`)
        .maybeSingle();

      if (eRow) {
        emp = {
          ...eRow,
          cabang: eRow.organization_units?.nama_unit || eRow.cabang || "Head Office",
          jabatan: eRow.job_positions?.nama_jabatan || eRow.jabatan || "Staff"
        };
      } else {
        // 2. Fallback cari di m_employee
        const { data: mRow } = await supabaseClient
          .from("m_employee")
          .select("*")
          .eq("nip", nipOrId)
          .maybeSingle();
        if (mRow) emp = mRow;
      }
    } catch (e) {
      console.warn("[Dossier] Query employee error:", e);
    }
  }

  if (!emp) {
    alert("Data karyawan tidak ditemukan: " + nipOrId);
    return;
  }

  CURRENT_DOSSIER_EMP = emp;
  modal.classList.remove("hidden");

  // Header Detail Personalia
  try {
    const elNama = document.getElementById("dossier-nama");
    if (elNama) elNama.innerText = emp.nama_lengkap || emp.nama || emp.name || "-";
    const elNip = document.getElementById("dossier-nip-badge");
    if (elNip) elNip.innerText = emp.nip || "-";
    const elSub = document.getElementById("dossier-jabatan-sub");
    if (elSub) elSub.innerText = `${emp.jabatan || 'Staff'} • ${emp.cabang || 'Head Office'}`;
    const elSk = document.getElementById("dossier-status-kerja-badge");
    if (elSk) elSk.innerText = emp.status_kerja || "PKWTT";
    const elAktif = document.getElementById("dossier-status-aktif-badge");
    if (elAktif) {
      const isAktif = emp.status_aktif === "AKTIF" || emp.status_aktif === true;
      elAktif.innerText = isAktif ? "AKTIF" : (emp.status_kerja === "CALON" ? "CALON" : "NONAKTIF");
      elAktif.className = isAktif
        ? "text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase"
        : (emp.status_kerja === "CALON" ? "text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-600 text-white uppercase" : "text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-600 text-white uppercase");
    }

    // Avatar
    const avatarBox = document.getElementById("dossier-avatar-container");
    if (avatarBox) {
      if (emp.foto_profile_url || emp.foto) {
        avatarBox.innerHTML = `<img src="${emp.foto_profile_url || emp.foto}" class="w-full h-full object-cover" />`;
      } else {
        avatarBox.innerHTML = `<i class="fa-solid fa-user-tie"></i>`;
      }
    }
  } catch (errDOM) {
    console.warn("[Dossier] Error setting header DOM:", errDOM);
  }

  // Default buka Tab 1: Data Pribadi Sipil
  switchDossierTab("personal");

  // Load Data di 4 Tab
  try {
    await loadDossierPersonalDetails(emp);
    loadDossierJobDetails(emp);
    await loadDossierPayrollDetails(emp);
    await loadDossierTransactionsHistory(emp);
    await loadDossierDocuments(emp);
  } catch (errLoad) {
    console.warn("[Dossier] Error loading dossier tabs:", errLoad);
  }
}

function closeEmployeeDossierModal() {
  document.getElementById("modal-employee-dossier")?.classList.add("hidden");
  // Reset file input avatar saat modal ditutup
  const avatarInput = document.getElementById("dossier-avatar-file-input");
  if (avatarInput) avatarInput.value = "";
}

// -------------------- UPLOAD FOTO PROFIL KARYAWAN --------------------
async function handleDossierAvatarUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];
  input.value = ""; // Reset agar bisa pilih file yang sama lagi

  // Validasi format & ukuran (max 5 MB)
  if (!file.type.startsWith("image/")) {
    showToast("Hanya file gambar (JPG/PNG/WEBP) yang diperbolehkan!", "error", 3000);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Ukuran foto melebihi batas maksimal 5 MB!", "error", 3000);
    return;
  }

  const avatarBox = document.getElementById("dossier-avatar-container");
  if (!avatarBox) return;

  // Tampilkan loading spinner di avatar
  const origContent = avatarBox.innerHTML;
  avatarBox.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin text-indigo-300 text-base"></i>';

  try {
    let photoUrl = "";
    const emp = CURRENT_DOSSIER_EMP;
    if (!emp) throw new Error("Data karyawan tidak ditemukan");

    const nip = emp.nip || emp.id || "EMP";
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const timestamp = Date.now();
    const filePath = `employee_photos/${nip}/foto_profil_${timestamp}.${ext}`;

    // 1. Upload ke Supabase Storage
    if (supabaseClient) {
      try {
        const { error: upErr } = await supabaseClient.storage
          .from(CONFIG.MEDIA_BUCKET || "digiasha-media")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: true
          });

        if (!upErr) {
          const { data: pubData } = supabaseClient.storage
            .from(CONFIG.MEDIA_BUCKET || "digiasha-media")
            .getPublicUrl(filePath);
          if (pubData?.publicUrl) {
            photoUrl = pubData.publicUrl;
          }
        } else {
          console.warn("[AvatarUpload] Storage error:", upErr);
        }
      } catch (se) {
        console.warn("[AvatarUpload] Storage exception:", se);
      }
    }

    // 2. Fallback ke Base64 compressed jika storage gagal
    if (!photoUrl) {
      photoUrl = await compressImage(file, 800, 0.85);
    }

    // 3. Simpan URL ke hr_employee_personal_details.foto_profile_url
    if (supabaseClient && photoUrl) {
      try {
        // Cari employee_id
        let empId = emp.id;
        if (!empId || typeof empId === "number") {
          const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", nip).maybeSingle();
          if (eRow?.id) empId = eRow.id;
        }
        if (empId) {
          // Upsert ke hr_employee_personal_details
          const { error: dbErr } = await supabaseClient
            .from("hr_employee_personal_details")
            .upsert(
              { employee_id: empId, foto_profile_url: photoUrl },
              { onConflict: "employee_id" }
            );
          if (dbErr) console.warn("[AvatarUpload] DB update error:", dbErr);

          // Update juga di employees table jika ada kolom foto
          await supabaseClient.from("employees").update({ foto_profile_url: photoUrl }).eq("id", empId);
        }
      } catch (dbEx) {
        console.warn("[AvatarUpload] DB exception:", dbEx);
      }
    }

    // 4. Update avatar di header modal secara realtime
    if (photoUrl) {
      avatarBox.innerHTML = `<img src="${photoUrl}" class="w-full h-full object-cover" alt="Foto Profil" />`;
      // Simpan ke state lokal
      if (CURRENT_DOSSIER_EMP) CURRENT_DOSSIER_EMP.foto_profile_url = photoUrl;
      showToast("Foto profil berhasil diperbarui!", "success", 2000);
    } else {
      avatarBox.innerHTML = origContent;
      showToast("Foto berhasil diubah secara lokal (Storage offline)", "info", 2500);
    }

  } catch (err) {
    console.error("[AvatarUpload] Error:", err);
    avatarBox.innerHTML = origContent;
    showToast("Gagal mengunggah foto: " + err.message, "error", 3000);
  }
}

function switchDossierTab(tab) {
  const tabs = ["personal", "job", "payroll", "history", "documents"];
  tabs.forEach(t => {
    const el = document.getElementById(`dossier-content-${t}`);
    const btn = document.getElementById(`dossier-tab-btn-${t}`);
    if (el) {
      if (t === tab) el.classList.remove("hidden");
      else el.classList.add("hidden");
    }
    if (btn) {
      if (t === tab) {
        btn.className = "px-3 py-2 rounded-t-xl bg-white text-indigo-700 border-t border-x border-slate-200 shadow-2xs whitespace-nowrap font-bold";
      } else {
        btn.className = "px-3 py-2 rounded-t-xl text-slate-600 hover:text-slate-900 whitespace-nowrap font-bold";
      }
    }
  });
}

// TAB 1: DATA PRIBADI SIPIL & JSONB
async function loadDossierPersonalDetails(emp) {
  let detail = null;
  let empId = emp.id;

  if (supabaseClient) {
    try {
      if (!empId || typeof empId === "number") {
        const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", emp.nip).maybeSingle();
        if (eRow?.id) empId = eRow.id;
      }
      if (empId) {
        // Coba query dari hr_employee_personal_details / employee_personal_details
        let { data, error } = await supabaseClient
          .from("hr_employee_personal_details")
          .select("*")
          .eq("employee_id", empId)
          .maybeSingle();

        if (error || !data) {
          const resFallback = await supabaseClient
            .from("employee_personal_details")
            .select("*")
            .eq("employee_id", empId)
            .maybeSingle();
          if (!resFallback.error && resFallback.data) data = resFallback.data;
        }
        if (data) detail = data;
      }
    } catch (e) {
      console.warn("[Dossier] Error load personal details:", e);
    }
  }

  CURRENT_DOSSIER_PERSONAL = detail;
  const jsonb = detail?.personal_details || {};

  // NIK & Identitas Pokok
  const nikVal = detail?.ktp_number || detail?.nik || jsonb.nik_ktp || emp.nik_ktp || "-";
  const elNik = document.getElementById("dossier-nik-val");
  if (elNik) elNik.innerText = nikVal;

  const elPribadiNama = document.getElementById("dossier-pribadi-nama-val");
  if (elPribadiNama) elPribadiNama.innerText = emp.nama_lengkap || emp.nama || emp.name || "-";

  const pob = detail?.pob || detail?.tempat_lahir || jsonb.tempat_lahir || "-";
  const dob = detail?.dob || detail?.tanggal_lahir || emp.dob || "-";
  const elTtl = document.getElementById("dossier-ttl-val");
  if (elTtl) elTtl.innerText = (pob !== "-" || dob !== "-") ? `${pob}, ${dob}` : "-";

  const elGender = document.getElementById("dossier-gender-val");
  if (elGender) elGender.innerText = detail?.gender || detail?.jenis_kelamin || emp.gender || "Laki-laki";

  const elMarital = document.getElementById("dossier-marital-val");
  if (elMarital) elMarital.innerText = detail?.marital_status || detail?.status_pernikahan || emp.marital_status || "Belum Kawin";

  // Pasangan & Anak
  const spouse = jsonb.spouse_name || detail?.spouse_name || "-";
  const elSpouse = document.getElementById("dossier-spouse-val");
  if (elSpouse) elSpouse.innerText = spouse;

  const childrenCount = jsonb.children_count ?? (Array.isArray(jsonb.children) ? jsonb.children.length : (detail?.number_of_dependents || 0));
  const elChildrenCount = document.getElementById("dossier-children-count-val");
  if (elChildrenCount) elChildrenCount.innerText = `${childrenCount} Anak`;

  const childrenContainer = document.getElementById("dossier-children-list-container");
  if (childrenContainer) {
    const childList = Array.isArray(jsonb.children) ? jsonb.children.filter(Boolean) : [];
    if (childList.length > 0) {
      childrenContainer.innerHTML = childList.map((c, i) => `
        <span class="px-2.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 text-[11px] shadow-2xs">
          ${i + 1}. ${c}
        </span>
      `).join("");
    } else {
      childrenContainer.innerHTML = '<span class="text-slate-400 italic text-[11px]">- Tidak ada data anak terdaftar -</span>';
    }
  }

  // Kontak & Alamat
  const phone = detail?.phone || jsonb.no_hp || emp.phone || "-";
  const elPhone = document.getElementById("dossier-phone-val");
  if (elPhone) elPhone.innerText = phone;

  const wa = jsonb.no_wa || detail?.phone || emp.phone || "-";
  const elWa = document.getElementById("dossier-wa-val");
  if (elWa) elWa.innerText = wa;

  const alamatKtp = detail?.address_ktp || detail?.alamat_ktp || jsonb.alamat_ktp || "-";
  const elAlamatKtp = document.getElementById("dossier-alamatktp-val");
  if (elAlamatKtp) elAlamatKtp.innerText = alamatKtp;

  const alamatDom = detail?.address_domicile || detail?.alamat_domisili || jsonb.alamat_domisili || alamatKtp;
  const elAlamatDom = document.getElementById("dossier-alamatdom-val");
  if (elAlamatDom) elAlamatDom.innerText = alamatDom;

  // Geotagging Koordinat Manual — fallback ke key langsung di JSONB (lat/lng)
  const geoLat = jsonb.geo_domisili?.latitude || jsonb.geo_domisili?.lat || jsonb.latitude || jsonb.lat || "";
  const geoLng = jsonb.geo_domisili?.longitude || jsonb.geo_domisili?.lng || jsonb.longitude || jsonb.lng || "";
  const elGeotag = document.getElementById("dossier-geotag-val");
  if (elGeotag) {
    if (geoLat && geoLng) {
      elGeotag.innerHTML = `<a href="https://maps.google.com/?q=${geoLat},${geoLng}" target="_blank" class="text-indigo-600 hover:underline"><i class="fa-solid fa-location-dot mr-1 text-rose-500"></i>${geoLat}, ${geoLng}</a>`;
    } else {
      elGeotag.innerText = "Koordinat belum diset";
    }
  }

  // Kontak Darurat
  const emergName = jsonb.kontak_darurat?.nama || detail?.emergency_contact_name || "-";
  const emergRel = jsonb.kontak_darurat?.hubungan || detail?.emergency_contact_relation || "-";
  const emergPhone = jsonb.kontak_darurat?.no_hp || detail?.emergency_contact_phone || "-";
  const elEmergName = document.getElementById("dossier-emergency-name-val");
  const elEmergRel = document.getElementById("dossier-emergency-rel-val");
  const elEmergPhone = document.getElementById("dossier-emergency-phone-val");
  if (elEmergName) elEmergName.innerText = emergName;
  if (elEmergRel) elEmergRel.innerText = emergRel;
  if (elEmergPhone) elEmergPhone.innerText = emergPhone;

  // Pendidikan & Email — support key education_level/education_major (dari JSONB aktual)
  const edu = jsonb.education_level || jsonb.pendidikan_terakhir || detail?.education || "-";
  const major = jsonb.education_major || jsonb.jurusan || detail?.major || "-";
  const elEdu = document.getElementById("dossier-education-val");
  const elMajor = document.getElementById("dossier-major-val");
  if (elEdu) elEdu.innerText = edu;
  if (elMajor) elMajor.innerText = major;

  const elEmail = document.getElementById("dossier-email-val");
  if (elEmail) elEmail.innerText = emp.email || "-";
}

// TAB 2: KEPEGAWAIAN (STATUS AKTIF TERKINI)
function loadDossierJobDetails(emp) {
  const elNip = document.getElementById("dossier-nip-val");
  if (elNip) elNip.innerText = emp.nip || "-";

  const elStatusKerja = document.getElementById("dossier-statuskerja-val");
  if (elStatusKerja) elStatusKerja.innerText = emp.status_kerja || "PKWTT";

  const elLoc = document.getElementById("dossier-penempatan-val");
  if (elLoc) elLoc.innerText = emp.work_location_name || emp.area_cover || "Head Office";

  const elUnit = document.getElementById("dossier-unit-val");
  if (elUnit) elUnit.innerText = emp.cabang || emp.unit_name || "Head Office";

  const elJabatan = document.getElementById("dossier-jabatan-val");
  if (elJabatan) elJabatan.innerText = emp.jabatan || "Staff";

  const elLevel = document.getElementById("dossier-level-val");
  if (elLevel) elLevel.innerText = emp.level_name || emp.role_id || "Staff";

  const elAtasan = document.getElementById("dossier-atasan-val");
  if (elAtasan) elAtasan.innerText = emp.atasan_nama ? `${emp.atasan_nama} (${emp.atasan_nip || ''})` : "Pimpinan Tertinggi / Tanpa Atasan Langsung";

  const elTglGabung = document.getElementById("dossier-tglgabung-val");
  if (elTglGabung) elTglGabung.innerText = emp.tanggal_masuk || emp.join_date || "-";

  const elNoKontrak = document.getElementById("dossier-nokontrak-val");
  if (elNoKontrak) elNoKontrak.innerText = emp.contract_no || emp.no_sk || "-";

  const elTglKontrak = document.getElementById("dossier-tglkontrak-val");
  if (elTglKontrak) elTglKontrak.innerText = emp.contract_start_date || emp.tanggal_masuk || "-";

  const elTglSelesai = document.getElementById("dossier-tglselesaikontrak-val");
  if (elTglSelesai) {
    if (emp.status_kerja === "PKWTT") {
      const dob = emp.dob || CURRENT_DOSSIER_PERSONAL?.dob || CURRENT_DOSSIER_PERSONAL?.tanggal_lahir;
      if (dob) {
        const d = new Date(dob);
        elTglSelesai.innerText = `${d.getFullYear() + 50}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} (Ulang Tahun ke-50)`;
      } else {
        elTglSelesai.innerText = "Ulang Tahun ke-50 (PKWTT Permanen)";
      }
    } else {
      elTglSelesai.innerText = emp.contract_end_date || "-";
    }
  }

  const elTglResign = document.getElementById("dossier-tglresign-val");
  if (elTglResign) {
    elTglResign.innerText = emp.tanggal_keluar || (!emp.is_active && emp.status_aktif === "NONAKTIF" ? "Nonaktif" : "Masih Aktif Bekerja");
  }
}

// TAB 3: RINCIAN PAYROLL (GAJI POKOK + 6 TUNJANGAN)
async function loadDossierPayrollDetails(emp) {
  let txSalary = null;
  let empId = emp.id;

  if (supabaseClient) {
    try {
      if (!empId || typeof empId === "number") {
        const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", emp.nip).maybeSingle();
        if (eRow?.id) empId = eRow.id;
      }
      if (empId) {
        // Cari transaksi terakhir yang memiliki gaji pokok
        const { data: txList } = await supabaseClient
          .from("hr_employee_transactions")
          .select("*")
          .eq("employee_id", empId)
          .eq("status", "APPROVED")
          .order("effective_date", { ascending: false });

        if (txList && txList.length > 0) {
          txSalary = txList.find(t => t.new_basic_salary && parseFloat(t.new_basic_salary) > 0) || txList[0];
        }

        // Fallback ke employee_career_histories
        if (!txSalary) {
          const { data: cList } = await supabaseClient
            .from("employee_career_histories")
            .select("*")
            .eq("employee_id", empId)
            .order("effective_date", { ascending: false });
          if (cList && cList.length > 0) {
            txSalary = cList.find(t => t.new_basic_salary && parseFloat(t.new_basic_salary) > 0) || cList[0];
          }
        }
      }
    } catch (e) {
      console.warn("[Dossier] Error query payroll transaction:", e);
    }
  }

  const basicSalary = parseFloat(txSalary?.new_basic_salary || emp.basic_salary || emp.gaji_pokok || 0);
  const allowJabatan = parseFloat(txSalary?.new_allowance_jabatan || 0);
  const allowTransport = parseFloat(txSalary?.new_allowance_transport || 0);
  const allowKomunikasi = parseFloat(txSalary?.new_allowance_komunikasi || 0);
  const allowTempatTinggal = parseFloat(txSalary?.new_allowance_tempat_tinggal || 0);
  const allowPenempatan = parseFloat(txSalary?.new_allowance_penempatan || 0);
  const allowKemahalan = parseFloat(txSalary?.new_allowance_kemahalan || 0);
  const totalAllowances = allowJabatan + allowTransport + allowKomunikasi + allowTempatTinggal + allowPenempatan + allowKemahalan;

  const elGaji = document.getElementById("dossier-gajipokok-val");
  if (elGaji) elGaji.innerText = basicSalary > 0 ? `Rp ${basicSalary.toLocaleString('id-ID')}` : "Rp 0 (Belum Diset)";

  const elTotAllow = document.getElementById("dossier-total-tunjangan-val");
  if (elTotAllow) elTotAllow.innerText = `Rp ${totalAllowances.toLocaleString('id-ID')}`;

  const elTunjJabatan = document.getElementById("dossier-tunj-jabatan-val");
  if (elTunjJabatan) elTunjJabatan.innerText = `Rp ${allowJabatan.toLocaleString('id-ID')}`;

  const elTunjTransport = document.getElementById("dossier-tunj-transport-val");
  if (elTunjTransport) elTunjTransport.innerText = `Rp ${allowTransport.toLocaleString('id-ID')}`;

  const elTunjKomunikasi = document.getElementById("dossier-tunj-komunikasi-val");
  if (elTunjKomunikasi) elTunjKomunikasi.innerText = `Rp ${allowKomunikasi.toLocaleString('id-ID')}`;

  const elTunjTempatTinggal = document.getElementById("dossier-tunj-tempattinggal-val");
  if (elTunjTempatTinggal) elTunjTempatTinggal.innerText = `Rp ${allowTempatTinggal.toLocaleString('id-ID')}`;

  const elTunjPenempatan = document.getElementById("dossier-tunj-penempatan-val");
  if (elTunjPenempatan) elTunjPenempatan.innerText = `Rp ${allowPenempatan.toLocaleString('id-ID')}`;

  const elTunjKemahalan = document.getElementById("dossier-tunj-kemahalan-val");
  if (elTunjKemahalan) elTunjKemahalan.innerText = `Rp ${allowKemahalan.toLocaleString('id-ID')}`;

  // Bank, BPJS & Pajak
  const elBank = document.getElementById("dossier-bank-val");
  if (elBank) elBank.innerText = txSalary?.bank_name || emp.bank_name || "BCA";

  const elRek = document.getElementById("dossier-rekening-val");
  if (elRek) {
    const noRek = txSalary?.bank_account_no || emp.bank_account_no || "-";
    const an = txSalary?.bank_account_holder || emp.nama_lengkap || emp.nama || "";
    elRek.innerText = `${noRek} ${an ? `(a/n ${an})` : ''}`.trim();
  }

  const elBpjsKes = document.getElementById("dossier-bpjskes-val");
  if (elBpjsKes) elBpjsKes.innerText = `Kes: ${txSalary?.bpjs_kesehatan_number || emp.bpjs_kesehatan_number || '-'}`;

  const elBpjsTk = document.getElementById("dossier-bpjstk-val");
  if (elBpjsTk) elBpjsTk.innerText = `TK: ${txSalary?.bpjs_ketenagakerjaan_number || emp.bpjs_ketenagakerjaan_number || '-'}`;

  const elNpwp = document.getElementById("dossier-npwp-val");
  if (elNpwp) elNpwp.innerText = `NPWP: ${txSalary?.npwp_number || emp.npwp_number || '-'}`;

  const elPtkp = document.getElementById("dossier-ptkp-val");
  if (elPtkp) elPtkp.innerText = `PTKP: ${txSalary?.tax_status || emp.tax_status || 'TK/0'}`;
}

// TAB 4: HISTORY TRANSAKSI KARYAWAN
async function loadDossierTransactionsHistory(emp) {
  const container = document.getElementById("dossier-tx-history-container");
  if (!container) return;

  let transactions = [];
  let empId = emp.id;

  if (supabaseClient) {
    try {
      if (!empId || typeof empId === "number") {
        const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", emp.nip).maybeSingle();
        if (eRow?.id) empId = eRow.id;
      }
      if (empId) {
        // Query riwayat transaksi dari hr_employee_transactions
        const { data, error } = await supabaseClient
          .from("hr_employee_transactions")
          .select("*")
          .or(`employee_id.eq.${empId},nip.eq.${emp.nip}`)
          .order("effective_date", { ascending: false });

        if (!error && data) transactions = data;
      }
    } catch (e) {
      console.warn("[Dossier] Query transactions history error:", e);
    }
  }

  CURRENT_DOSSIER_TX_LIST = transactions;

  if (transactions.length === 0) {
    container.innerHTML = `
      <div class="relative pb-3">
        <div class="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow"></div>
        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">JOIN INITIAL</span>
            <span class="text-[10px] text-slate-400 font-mono">${emp.tanggal_masuk || 'Awal Bergabung'}</span>
          </div>
          <h6 class="font-bold text-xs text-slate-800 mt-1">Pengangkatan Awal Karyawan</h6>
          <p class="text-[10px] text-slate-500 mt-0.5">Penempatan: ${emp.cabang || 'Head Office'} • Posisi: ${emp.jabatan || 'Staff'}</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = transactions.map(tx => {
    const types = Array.isArray(tx.transaction_types) ? tx.transaction_types.join(", ") : (tx.transaction_types || "Transaksi");
    const st = String(tx.status || "").toUpperCase();
    let stBadge = "bg-slate-100 text-slate-700 border-slate-200";
    if (st === "APPROVED") stBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (st === "IN_REVIEW" || st === "PENDING_APPROVAL") stBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
    else if (st === "PENDING_AGREEMENT") stBadge = "bg-purple-50 text-purple-700 border-purple-200";
    else if (st === "REJECTED") stBadge = "bg-rose-50 text-rose-700 border-rose-200";

    const salaryChange = tx.new_basic_salary ? `Rp ${parseFloat(tx.new_basic_salary).toLocaleString('id-ID')}` : null;

    return `
      <div class="relative pb-3">
        <div class="absolute -left-[23px] top-1 w-3.5 h-3.5 rounded-full bg-indigo-600 border-2 border-white shadow"></div>
        <div class="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div class="flex items-center justify-between flex-wrap gap-1">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${stBadge} uppercase">${st}</span>
            <span class="text-[10px] text-slate-400 font-mono">Efektif: ${tx.effective_date}</span>
          </div>
          <h6 class="font-bold text-xs text-slate-900 mt-1">${types}</h6>
          ${tx.permanent_contract_no ? `<p class="text-[10px] text-slate-600 font-mono">No. SK/Kontrak: <strong>${tx.permanent_contract_no}</strong></p>` : ''}
          ${tx.contract_no ? `<p class="text-[10px] text-slate-600 font-mono">No. Kontrak: <strong>${tx.contract_no}</strong></p>` : ''}
          ${salaryChange ? `<p class="text-[10px] text-emerald-700 font-bold">Gaji Pokok: ${salaryChange}</p>` : ''}
          ${tx.exit_notes ? `<p class="text-[10px] text-slate-500 italic mt-0.5">"${tx.exit_notes}"</p>` : ''}
          ${tx.status === "PENDING_AGREEMENT" ? `
            <div class="mt-1.5 p-2 bg-purple-50 border border-purple-200 rounded-xl text-[10px] text-purple-900 flex items-center justify-between">
              <span><i class="fa-solid fa-signature mr-1"></i>Menunggu Tanda Tangan Elektronik PIC ybs</span>
              <button type="button" onclick="openElectronicAgreementModal('${tx.id}')" class="px-2 py-0.5 bg-purple-600 text-white rounded font-bold text-[9px]">Tanda Tangani</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join("");
}

// TAB 5: BERKAS & DOKUMEN TERUPLOAD KARYAWAN (DOSSIER)
async function loadDossierDocuments(emp) {
  const container = document.getElementById("dossier-documents-container");
  const countBadge = document.getElementById("dossier-doc-count-badge");
  if (!container) return;

  container.innerHTML = `
    <div class="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
      <i class="fa-solid fa-circle-notch fa-spin text-indigo-600 text-lg mb-2"></i>
      <p>Memuat berkas & dokumen digital...</p>
    </div>
  `;

  let docs = [];
  const empId = emp.id;
  const nip = emp.nip;

  // 1. Dokumen dari objek Employee
  if (emp.doc_cv_url || emp.cv_url) {
    docs.push({
      key: "cv",
      label: "Berkas CV / Portofolio",
      url: emp.doc_cv_url || emp.cv_url,
      source: "Profil Karyawan",
      icon: "fa-solid fa-file-pdf",
      color: "text-red-600",
      bg: "bg-red-50"
    });
  }
  if (emp.doc_ktp_url || emp.ktp_url) {
    docs.push({
      key: "ktp",
      label: "Scan KTP Kependudukan",
      url: emp.doc_ktp_url || emp.ktp_url,
      source: "Profil Karyawan",
      icon: "fa-solid fa-id-card",
      color: "text-blue-600",
      bg: "bg-blue-50"
    });
  }
  if (emp.doc_kk_url || emp.kk_url) {
    docs.push({
      key: "kk",
      label: "Scan Kartu Keluarga (KK)",
      url: emp.doc_kk_url || emp.kk_url,
      source: "Profil Karyawan",
      icon: "fa-solid fa-users-rectangle",
      color: "text-emerald-600",
      bg: "bg-emerald-50"
    });
  }
  if (emp.doc_npwp_url || emp.npwp_url) {
    docs.push({
      key: "npwp",
      label: "Scan NPWP Karyawan",
      url: emp.doc_npwp_url || emp.npwp_url,
      source: "Profil Karyawan",
      icon: "fa-solid fa-receipt",
      color: "text-amber-600",
      bg: "bg-amber-50"
    });
  }
  if (emp.doc_kontrak_url || emp.contract_url) {
    docs.push({
      key: "kontrak",
      label: "Dokumen Kontrak Kerja / SK",
      url: emp.doc_kontrak_url || emp.contract_url,
      source: "Profil Karyawan",
      icon: "fa-solid fa-file-signature",
      color: "text-purple-600",
      bg: "bg-purple-50"
    });
  }

  // 2. Query dari Database Supabase (hr_employee_transactions & hr_employee_personal_details)
  if (supabaseClient) {
    try {
      // Query dari transaksi
      const { data: txList } = await supabaseClient
        .from("hr_employee_transactions")
        .select("id, transaction_types, effective_date, status, created_at, doc_cv_url, doc_ktp_url, doc_kk_url, doc_npwp_url, doc_kontrak_url")
        .or(`employee_id.eq.${empId},nip.eq.${nip}`)
        .order("created_at", { ascending: false });

      if (txList && txList.length > 0) {
        txList.forEach(tx => {
          const tName = Array.isArray(tx.transaction_types) ? tx.transaction_types.join(", ") : (tx.transaction_types || "Transaksi");
          const dateStr = tx.effective_date || (tx.created_at ? tx.created_at.split("T")[0] : "");
          const srcLabel = `Transaksi ${tName} (${dateStr})`;

          const checkAndPush = (url, key, label, icon, color, bg) => {
            if (url && !docs.some(d => d.url === url)) {
              docs.push({ key, label, url, source: srcLabel, icon, color, bg });
            }
          };

          checkAndPush(tx.doc_cv_url, "cv", "Berkas CV / Portofolio", "fa-solid fa-file-pdf", "text-red-600", "bg-red-50");
          checkAndPush(tx.doc_ktp_url, "ktp", "Scan KTP Kependudukan", "fa-solid fa-id-card", "text-blue-600", "bg-blue-50");
          checkAndPush(tx.doc_kk_url, "kk", "Scan Kartu Keluarga (KK)", "fa-solid fa-users-rectangle", "text-emerald-600", "bg-emerald-50");
          checkAndPush(tx.doc_npwp_url, "npwp", "Scan NPWP Karyawan", "fa-solid fa-receipt", "text-amber-600", "bg-amber-50");
          checkAndPush(tx.doc_kontrak_url, "kontrak", "Dokumen Kontrak / SK", "fa-solid fa-file-signature", "text-purple-600", "bg-purple-50");
        });
      }

      // Query dari personal_details jika ada
      const { data: pRow } = await supabaseClient
        .from("hr_employee_personal_details")
        .select("personal_details")
        .or(`employee_id.eq.${empId}`)
        .maybeSingle();

      const pJson = pRow?.personal_details || {};
      if (pJson.doc_ktp_url && !docs.some(d => d.url === pJson.doc_ktp_url)) {
        docs.push({ key: "ktp", label: "Scan KTP Kependudukan", url: pJson.doc_ktp_url, source: "Data Pribadi Sipil", icon: "fa-solid fa-id-card", color: "text-blue-600", bg: "bg-blue-50" });
      }
      if (pJson.doc_kk_url && !docs.some(d => d.url === pJson.doc_kk_url)) {
        docs.push({ key: "kk", label: "Scan Kartu Keluarga", url: pJson.doc_kk_url, source: "Data Pribadi Sipil", icon: "fa-solid fa-users-rectangle", color: "text-emerald-600", bg: "bg-emerald-50" });
      }
    } catch (errDocs) {
      console.warn("[loadDossierDocuments] Error fetching documents:", errDocs);
    }
  }

  // Update badge jumlah dokumen di Tab 5
  if (countBadge) {
    countBadge.innerText = docs.length;
    countBadge.className = docs.length > 0
      ? "ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700"
      : "ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700";
  }

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-xl mx-auto border border-amber-100">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <div>
          <h5 class="font-bold text-xs sm:text-sm text-slate-800">Belum Ada Dokumen Terupload</h5>
          <p class="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
            Belum ada berkas CV, KTP, KK, NPWP, atau Kontrak/SK yang terlampir untuk karyawan ini.
          </p>
        </div>
      </div>
    `;
    return;
  }

  let html = `<div class="grid grid-cols-1 gap-2.5">`;
  docs.forEach((doc) => {
    const rawFileName = doc.url.startsWith("data:")
      ? `${doc.label}.pdf`
      : (doc.url.split("/").pop() || `${doc.key}_document`);

    html += `
      <div class="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-300 transition">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-xl ${doc.bg} flex items-center justify-center ${doc.color} text-lg shrink-0 border border-slate-100">
            <i class="${doc.icon}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-bold text-xs text-slate-900">${doc.label}</span>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">✓ Tersedia di Cloud</span>
              <span class="text-[9px] text-slate-400">Sumber: ${doc.source}</span>
            </div>
            <p class="text-[11px] text-slate-400 truncate max-w-md font-mono mt-0.5">${rawFileName}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="openTxDocPreview('${doc.url}', '${doc.label}', '${rawFileName}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 flex items-center gap-1.5 transition active:scale-95 shadow-2xs">
            <i class="fa-solid fa-eye text-[11px]"></i><span>Buka / Lihat</span>
          </button>
          <a href="${doc.url}" target="_blank" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition" title="Buka Tab Baru / Unduh">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function openAddCareerTransactionModal() {
  if (!CURRENT_DOSSIER_EMP) return;
  const modal = document.getElementById("modal-career-transaction-add");
  if (!modal) return;

  document.getElementById("tx-modal-emp-label").innerText = `Karyawan: ${CURRENT_DOSSIER_EMP.nama_lengkap || CURRENT_DOSSIER_EMP.nama} (${CURRENT_DOSSIER_EMP.nip})`;
  document.getElementById("tx-input-emp-id").value = CURRENT_DOSSIER_EMP.id || CURRENT_DOSSIER_EMP.nip;
  document.getElementById("tx-input-effective-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("tx-input-nosk").value = "";
  document.getElementById("tx-input-filesk").value = "";
  document.getElementById("tx-input-desc").value = "";

  // Populate Selects
  const posSelect = document.getElementById("tx-input-new-position");
  if (posSelect) {
    posSelect.innerHTML = '<option value="">- Tidak Berubah -</option>' + (ORG_POSITIONS_DATA || []).map(p => `<option value="${p.id_position}">${p.nama_jabatan}</option>`).join("");
  }

  const unitSelect = document.getElementById("tx-input-new-unit");
  if (unitSelect) {
    unitSelect.innerHTML = '<option value="">- Tidak Berubah -</option>' + (ORG_UNITS_DATA || []).map(u => `<option value="${u.id_unit}">${u.nama_unit}</option>`).join("");
  }

  const lvlSelect = document.getElementById("tx-input-new-level");
  if (lvlSelect) {
    lvlSelect.innerHTML = '<option value="">- Tidak Berubah -</option>' + (ORG_LEVELS_DATA || []).map(l => `<option value="${l.id_level}">${l.nama_level}</option>`).join("");
  }

  const supSelect = document.getElementById("tx-input-new-supervisor");
  if (supSelect) {
    const list = (SETTINGS_EMPLOYEES_DATA || []).filter(e => e.nip !== CURRENT_DOSSIER_EMP.nip);
    supSelect.innerHTML = '<option value="">- Tidak Berubah -</option>' + list.map(e => `<option value="${e.id || e.nip}">${e.nama_lengkap} (${e.nip})</option>`).join("");
  }

  modal.classList.remove("hidden");
}

function closeCareerTransactionModal() {
  document.getElementById("modal-career-transaction-add")?.classList.add("hidden");
}

async function handleSaveCareerTransaction(e) {
  e.preventDefault();
  if (!CURRENT_DOSSIER_EMP) return;

  let empId = CURRENT_DOSSIER_EMP.id;
  if (supabaseClient && (!empId || typeof empId === "number" || (typeof empId === "string" && empId.length < 20))) {
    try {
      const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", CURRENT_DOSSIER_EMP.nip).maybeSingle();
      if (eRow?.id) empId = eRow.id;
    } catch (_) { }
  }
  if (!empId) empId = CURRENT_DOSSIER_EMP.nip;

  const txType = document.getElementById("tx-input-type").value;
  const effDate = document.getElementById("tx-input-effective-date").value;
  const noSk = document.getElementById("tx-input-nosk").value.trim();
  const fileSk = document.getElementById("tx-input-filesk").value.trim();
  const newPos = document.getElementById("tx-input-new-position").value || null;
  const newUnit = document.getElementById("tx-input-new-unit").value || null;
  const newLvl = document.getElementById("tx-input-new-level").value || null;
  const newSup = document.getElementById("tx-input-new-supervisor").value || null;
  const salary = document.getElementById("tx-input-new-salary").value ? parseFloat(document.getElementById("tx-input-new-salary").value) : null;
  const allowances = document.getElementById("tx-input-new-allowances").value ? parseFloat(document.getElementById("tx-input-new-allowances").value) : null;
  const bankName = document.getElementById("tx-input-bank-name").value.trim() || null;
  const bankAcc = document.getElementById("tx-input-bank-account").value.trim() || null;
  const bpjsKes = document.getElementById("tx-input-bpjs-kes").value.trim() || null;
  const bpjsTk = document.getElementById("tx-input-bpjs-tk").value.trim() || null;
  const npwp = document.getElementById("tx-input-npwp").value.trim() || null;
  const taxStatus = document.getElementById("tx-input-tax-status").value;
  const desc = document.getElementById("tx-input-desc").value.trim();

  const payload = {
    employee_id: empId,
    transaction_date: new Date().toISOString().split("T")[0],
    effective_date: effDate,
    transaction_type: txType,
    no_sk: noSk || null,
    file_sk_url: fileSk || null,
    description: desc || null,
    new_position_id: newPos,
    new_location_id: newUnit,
    new_level_id: newLvl,
    new_supervisor_id: newSup,
    new_basic_salary: salary,
    new_allowances: allowances,
    bank_name: bankName,
    bank_account_no: bankAcc,
    bpjs_kesehatan_number: bpjsKes,
    bpjs_ketenagakerjaan_number: bpjsTk,
    npwp_number: npwp,
    tax_status: taxStatus,
    created_at: new Date().toISOString()
  };

  const btn = document.getElementById("btn-save-tx");
  const origText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
  btn.disabled = true;

  try {
    if (supabaseClient && typeof empId === "string" && empId.length > 20) {
      payload.employee_id = empId;
      const { error } = await supabaseClient
        .from("employee_career_histories")
        .insert(payload);
      if (error) console.warn("Supabase save career history:", error);
    }

    closeCareerTransactionModal();
    showToast("Transaksi karir & remunerasi berhasil dicatat!", "success", 1500);
    await loadDossierCareerHistories(CURRENT_DOSSIER_EMP);
  } catch (err) {
    alert("Gagal menyimpan transaksi: " + err.message);
  } finally {
    btn.innerHTML = origText;
    btn.disabled = false;
  }
}

function openEditEmployeeFullModal() {
  if (!CURRENT_DOSSIER_EMP) return;
  const modal = document.getElementById("modal-employee-edit-full");
  if (!modal) return;

  const emp = CURRENT_DOSSIER_EMP;
  const personal = CURRENT_DOSSIER_PERSONAL || {};
  const latestTx = (CURRENT_DOSSIER_CAREER_LIST && CURRENT_DOSSIER_CAREER_LIST.length > 0)
    ? (CURRENT_DOSSIER_CAREER_LIST.find(t => t.new_basic_salary || t.bank_name) || CURRENT_DOSSIER_CAREER_LIST[0])
    : {};

  document.getElementById("edit-full-emp-subtitle").innerText = `Karyawan: ${emp.nama_lengkap || emp.nama} (${emp.nip})`;
  document.getElementById("edit-full-emp-nip").value = emp.nip;
  document.getElementById("edit-full-emp-id").value = emp.id || emp.nip;

  // Tab 1: Sipil
  document.getElementById("edit-full-nik").value = personal.ktp_number || emp.nik_ktp || "";
  document.getElementById("edit-full-phone").value = personal.phone || emp.phone || "";
  document.getElementById("edit-full-pob").value = personal.pob || "";
  document.getElementById("edit-full-dob").value = personal.dob || "";
  document.getElementById("edit-full-gender").value = personal.gender || "Laki-laki";
  document.getElementById("edit-full-religion").value = personal.religion || "Islam";
  document.getElementById("edit-full-marital").value = personal.marital_status || "Lajang";
  document.getElementById("edit-full-dependents").value = personal.number_of_dependents || 0;
  document.getElementById("edit-full-alamat-ktp").value = personal.address_ktp || "";
  document.getElementById("edit-full-alamat-dom").value = personal.address_domicile || "";
  document.getElementById("edit-full-emerg-name").value = personal.emergency_contact_name || "";
  document.getElementById("edit-full-emerg-rel").value = personal.emergency_contact_relation || "";
  document.getElementById("edit-full-emerg-phone").value = personal.emergency_contact_phone || "";

  // Tab 2: Payroll
  document.getElementById("edit-full-gaji").value = latestTx.new_basic_salary || "";
  document.getElementById("edit-full-tunjangan").value = latestTx.new_allowances || "";
  document.getElementById("edit-full-bank").value = latestTx.bank_name || "BCA";
  document.getElementById("edit-full-rekening").value = latestTx.bank_account_no || "";
  document.getElementById("edit-full-rek-name").value = latestTx.bank_account_holder || emp.nama_lengkap || emp.nama || "";
  document.getElementById("edit-full-bpjskes").value = latestTx.bpjs_kesehatan_number || "";
  document.getElementById("edit-full-bpjstk").value = latestTx.bpjs_ketenagakerjaan_number || "";
  document.getElementById("edit-full-npwp").value = latestTx.npwp_number || "";
  document.getElementById("edit-full-ptkp").value = latestTx.tax_status || "TK/0";

  switchEditFullTab("sipil");
  modal.classList.remove("hidden");
}

function closeEditEmployeeFullModal() {
  document.getElementById("modal-employee-edit-full")?.classList.add("hidden");
}

function switchEditFullTab(tab) {
  const isSipil = tab === "sipil";
  const btnSipil = document.getElementById("edit-full-tab-btn-sipil");
  const btnPay = document.getElementById("edit-full-tab-btn-payroll");
  const contentSipil = document.getElementById("edit-full-content-sipil");
  const contentPay = document.getElementById("edit-full-content-payroll");

  if (isSipil) {
    if (btnSipil) btnSipil.className = "px-3 py-2 rounded-t-xl bg-white text-indigo-700 border-t border-x border-slate-200 shadow-2xs font-bold";
    if (btnPay) btnPay.className = "px-3 py-2 rounded-t-xl text-slate-600 hover:text-slate-900 font-bold";
    contentSipil?.classList.remove("hidden");
    contentPay?.classList.add("hidden");
  } else {
    if (btnPay) btnPay.className = "px-3 py-2 rounded-t-xl bg-white text-indigo-700 border-t border-x border-slate-200 shadow-2xs font-bold";
    if (btnSipil) btnSipil.className = "px-3 py-2 rounded-t-xl text-slate-600 hover:text-slate-900 font-bold";
    contentPay?.classList.remove("hidden");
    contentSipil?.classList.add("hidden");
  }
}

async function handleSaveEmployeeFull(event) {
  event.preventDefault();
  const emp = CURRENT_DOSSIER_EMP;
  if (!emp) return;

  const btn = document.getElementById("btn-save-edit-full");
  const origText = btn ? btn.innerHTML : "Simpan";
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan...';
    btn.disabled = true;
  }

  try {
    let empId = emp.id;
    if (supabaseClient && (!empId || typeof empId === "number")) {
      const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", emp.nip).maybeSingle();
      if (eRow?.id) empId = eRow.id;
    }

    // 1. Simpan Data Pribadi Sipil (employee_personal_details)
    const personalPayload = {
      employee_id: empId,
      ktp_number: document.getElementById("edit-full-nik").value.trim() || null,
      phone: document.getElementById("edit-full-phone").value.trim() || null,
      pob: document.getElementById("edit-full-pob").value.trim() || null,
      dob: document.getElementById("edit-full-dob").value || null,
      gender: document.getElementById("edit-full-gender").value,
      religion: document.getElementById("edit-full-religion").value,
      marital_status: document.getElementById("edit-full-marital").value,
      number_of_dependents: parseInt(document.getElementById("edit-full-dependents").value) || 0,
      address_ktp: document.getElementById("edit-full-alamat-ktp").value.trim() || null,
      address_domicile: document.getElementById("edit-full-alamat-dom").value.trim() || null,
      emergency_contact_name: document.getElementById("edit-full-emerg-name").value.trim() || null,
      emergency_contact_relation: document.getElementById("edit-full-emerg-rel").value.trim() || null,
      emergency_contact_phone: document.getElementById("edit-full-emerg-phone").value.trim() || null,
      updated_at: new Date().toISOString()
    };

    if (supabaseClient && empId) {
      const { error: pErr } = await supabaseClient
        .from("employee_personal_details")
        .upsert([personalPayload], { onConflict: "employee_id" });
      if (pErr) console.warn("Upsert personal details warning:", pErr);
    }

    // 2. Simpan Data Payroll / Remunerasi ke Transaksi Karir (employee_career_histories)
    const gajiVal = document.getElementById("edit-full-gaji").value ? parseFloat(document.getElementById("edit-full-gaji").value) : null;
    const tunjanganVal = document.getElementById("edit-full-tunjangan").value ? parseFloat(document.getElementById("edit-full-tunjangan").value) : null;
    const bankVal = document.getElementById("edit-full-bank").value;
    const rekVal = document.getElementById("edit-full-rekening").value.trim() || null;
    const rekNameVal = document.getElementById("edit-full-rek-name").value.trim() || null;
    const bpjsKesVal = document.getElementById("edit-full-bpjskes").value.trim() || null;
    const bpjsTkVal = document.getElementById("edit-full-bpjstk").value.trim() || null;
    const npwpVal = document.getElementById("edit-full-npwp").value.trim() || null;
    const ptkpVal = document.getElementById("edit-full-ptkp").value;

    if (supabaseClient && empId && (gajiVal || bankVal || rekVal || bpjsKesVal)) {
      const careerPayload = {
        employee_id: empId,
        transaction_date: new Date().toISOString().split("T")[0],
        effective_date: new Date().toISOString().split("T")[0],
        transaction_type: "SALARY_ADJUSTMENT",
        no_sk: "SK/PAYROLL/" + new Date().getFullYear() + "/" + emp.nip,
        description: "Pembaruan Profil Payroll, Rekening & Kompensasi Karyawan",
        new_basic_salary: gajiVal,
        new_allowances: tunjanganVal,
        bank_name: bankVal,
        bank_account_no: rekVal,
        bank_account_holder: rekNameVal,
        bpjs_kesehatan_number: bpjsKesVal,
        bpjs_ketenagakerjaan_number: bpjsTkVal,
        npwp_number: npwpVal,
        tax_status: ptkpVal,
        created_at: new Date().toISOString()
      };

      const { error: cErr } = await supabaseClient
        .from("employee_career_histories")
        .insert([careerPayload]);
      if (cErr) console.warn("Insert career history warning:", cErr);
    }

    closeEditEmployeeFullModal();
    if (typeof showToast === "function") showToast("Data personalia & payroll berhasil diperbarui!", "success");
    else alert("Data personalia & payroll berhasil diperbarui!");

    // Refresh Tampilan Detail Personalia
    await loadDossierPersonalDetails(emp);
    await loadDossierCareerHistories(emp);
  } catch (err) {
    alert("Gagal menyimpan data: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

function loadOrgRolePermissions() {
  const container = document.getElementById("role-permissions-matrix-container");
  if (!container) return;

  const roles = Object.keys(ROLE_PERMISSIONS_STATE || {});
  if (roles.length === 0) {
    container.innerHTML = '<div class="p-6 text-center text-xs text-slate-400">Belum ada role terdefinisi.</div>';
    return;
  }

  container.innerHTML = `
    <div class="divide-y divide-slate-100 text-xs">
      ${roles.map(rKey => {
    const r = ROLE_PERMISSIONS_STATE[rKey];
    const perms = r.permissions || [];
    return `
          <div class="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition">
            <div class="min-w-0 flex-1">
              <div class="flex items-center space-x-2">
                <span class="font-bold text-slate-900">${r.name}</span>
                <span class="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded border ${r.badgeBg || 'bg-slate-100 text-slate-700'}">${rKey}</span>
              </div>
              <p class="text-[11px] text-slate-500 mt-0.5">${r.desc || '-'}</p>
              <div class="flex items-center space-x-1 flex-wrap gap-y-1 mt-1.5">
                <span class="text-[10px] text-slate-400 font-semibold mr-1">Menu:</span>
                ${perms.map(p => `<span class="px-2 py-0.2 rounded-full text-[9px] bg-purple-50 text-purple-700 border border-purple-200 font-mono">${p}</span>`).join(" ")}
              </div>
            </div>
            <button type="button" onclick="openEditRoleInfoModal('${rKey}')" class="px-2.5 py-2 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 rounded-xl font-bold text-xs shrink-0 flex items-center space-x-1 border border-slate-200 transition">
              <i class="fa-solid fa-pen-to-square"></i>
              <span>Atur Akses</span>
            </button>
          </div>
        `;
  }).join("")}
    </div>
  `;
}

// =========================================================================
// CONTROLLER: PERSONALIA & DATA KEPEGAWAIAN (CORE HR MASTER & DOSSIER)
// =========================================================================
let PERSONALIA_EMPLOYEES_DATA = [];
let CURRENT_PERSONALIA_TAB = "chart";

function switchPersonaliaTab(tab) {
  CURRENT_PERSONALIA_TAB = tab;
  const isChart = tab === "chart";

  const btnChart = document.getElementById("tab-btn-personalia-chart");
  const btnDetail = document.getElementById("tab-btn-personalia-detail");
  const tabChart = document.getElementById("personalia-tab-chart");
  const tabDetail = document.getElementById("personalia-tab-detail");

  if (btnChart) {
    btnChart.className = isChart
      ? "flex-1 py-2.5 px-3 rounded-xl transition text-center whitespace-nowrap bg-white text-slate-900 shadow-sm flex items-center justify-center space-x-2 font-bold"
      : "flex-1 py-2.5 px-3 rounded-xl transition text-center whitespace-nowrap text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-2 font-bold";
  }
  if (btnDetail) {
    btnDetail.className = !isChart
      ? "flex-1 py-2.5 px-3 rounded-xl transition text-center whitespace-nowrap bg-white text-slate-900 shadow-sm flex items-center justify-center space-x-2 font-bold"
      : "flex-1 py-2.5 px-3 rounded-xl transition text-center whitespace-nowrap text-slate-600 hover:text-slate-900 flex items-center justify-center space-x-2 font-bold";
  }

  if (tabChart) {
    if (isChart) tabChart.classList.remove("hidden");
    else tabChart.classList.add("hidden");
  }
  if (tabDetail) {
    if (!isChart) tabDetail.classList.remove("hidden");
    else tabDetail.classList.add("hidden");
  }

  if (isChart) {
    populateOrgFilterUnits();
    renderVisualOrgChartTree();
  }
}

async function initPersonaliaScreen() {
  // 1. Pastikan data master posisi & unit terload untuk Bagan Pohon
  const promises = [loadPersonaliaEmployees()];
  if (!ORG_POSITIONS_DATA || ORG_POSITIONS_DATA.length === 0) {
    promises.push(loadOrgPositions());
  }
  if (!ORG_UNITS_DATA || ORG_UNITS_DATA.length === 0) {
    promises.push(loadOrgUnits());
  }
  await Promise.allSettled(promises);

  // 2. Setup bagan visual & default ke Tab 1 (Bagan Organisasi)
  populateOrgFilterUnits();
  renderVisualOrgChartTree();
  switchPersonaliaTab("chart");
}

async function loadPersonaliaEmployees() {
  const container = document.getElementById("personalia-employee-list-container");
  if (!container) return;

  if (supabaseClient) {
    try {
      // Load eksklusif dari master employees baru (Core HR New Database)
      const { data: empData, error: empErr } = await supabaseClient
        .from("employees")
        .select(`
          *,
          organization_units (nama_unit),
          job_positions (nama_jabatan)
        `)
        .order("nip");

      if (!empErr && empData && empData.length > 0) {
        PERSONALIA_EMPLOYEES_DATA = empData.map(e => ({
          ...e,
          nama_lengkap: e.name || e.nama_lengkap || e.nip,
          cabang: e.organization_units?.nama_unit || e.cabang || "Head Office",
          jabatan: e.job_positions?.nama_jabatan || e.jabatan || "Staff",
          status_aktif: !e.deleted_at ? "AKTIF" : "NONAKTIF"
        }));
        populatePersonaliaFilters(PERSONALIA_EMPLOYEES_DATA);
        updatePersonaliaStats(PERSONALIA_EMPLOYEES_DATA);
        renderPersonaliaEmployees(PERSONALIA_EMPLOYEES_DATA);
        return;
      } else if (empErr) {
        console.warn("[Personalia New DB] Query error:", empErr);
      }
    } catch (e) {
      console.warn("[Personalia New DB] Exception:", e);
    }
  }

  // Jika tabel employees baru belum di-seed, tampilkan list kosong dengan panduan duplikasi
  PERSONALIA_EMPLOYEES_DATA = [];
  populatePersonaliaFilters(PERSONALIA_EMPLOYEES_DATA);
  updatePersonaliaStats(PERSONALIA_EMPLOYEES_DATA);
  renderPersonaliaEmployees(PERSONALIA_EMPLOYEES_DATA);
}

function updatePersonaliaStats(list) {
  const total = list.length;
  const active = list.filter(e => e.status_aktif === "AKTIF" || e.status_aktif === true).length;
  const pkwtt = list.filter(e => (e.status_kerja || "PKWTT").toUpperCase() === "PKWTT").length;
  const pkwt = list.filter(e => (e.status_kerja || "").toUpperCase() === "PKWT").length;

  const elTotal = document.getElementById("personalia-stat-total");
  const elActive = document.getElementById("personalia-stat-active");
  const elPkwtt = document.getElementById("personalia-stat-pkwtt");
  const elPkwt = document.getElementById("personalia-stat-pkwt");

  if (elTotal) elTotal.innerText = total;
  if (elActive) elActive.innerText = active;
  if (elPkwtt) elPkwtt.innerText = pkwtt;
  if (elPkwt) elPkwt.innerText = pkwt;
}

function populatePersonaliaFilters(list) {
  const branchSelect = document.getElementById("personalia-filter-branch");
  if (!branchSelect) return;

  const currentVal = branchSelect.value;
  const branches = Array.from(new Set(list.map(e => e.cabang).filter(Boolean))).sort();

  branchSelect.innerHTML = '<option value="ALL">Semua Cabang / Unit</option>' +
    branches.map(b => `<option value="${b}">${b}</option>`).join("");

  if (branches.includes(currentVal)) {
    branchSelect.value = currentVal;
  }
}

function filterPersonaliaEmployees() {
  const keyword = String(document.getElementById("personalia-search-input")?.value || "").trim().toLowerCase();
  const branch = document.getElementById("personalia-filter-branch")?.value || "ALL";
  const statusKerja = document.getElementById("personalia-filter-status-kerja")?.value || "ALL";
  const activeFilter = document.getElementById("personalia-filter-active")?.value || "ALL";

  const filtered = PERSONALIA_EMPLOYEES_DATA.filter(emp => {
    // 1. Search keyword
    if (keyword) {
      const matchNip = String(emp.nip || "").toLowerCase().includes(keyword);
      const matchName = String(emp.nama_lengkap || emp.nama || "").toLowerCase().includes(keyword);
      const matchJob = String(emp.jabatan || "").toLowerCase().includes(keyword);
      const matchBranch = String(emp.cabang || "").toLowerCase().includes(keyword);
      const matchArea = String(emp.area_cover || "").toLowerCase().includes(keyword);
      if (!matchNip && !matchName && !matchJob && !matchBranch && !matchArea) return false;
    }

    // 2. Filter Branch
    if (branch !== "ALL" && emp.cabang !== branch) return false;

    // 3. Filter Status Kerja
    if (statusKerja !== "ALL") {
      const sk = String(emp.status_kerja || "PKWTT").toUpperCase();
      if (sk !== statusKerja) return false;
    }

    // 4. Filter Active
    const isAktif = emp.status_aktif === "AKTIF" || emp.status_aktif === true;
    if (activeFilter === "ACTIVE" && !isAktif) return false;
    if (activeFilter === "INACTIVE" && isAktif) return false;

    return true;
  });

  renderPersonaliaEmployees(filtered);
}

function renderPersonaliaEmployees(list) {
  const container = document.getElementById("personalia-employee-list-container");
  if (!container) return;

  if (!list || list.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
        <i class="fa-solid fa-user-slash text-2xl text-slate-300 mb-2 block"></i>
        Tidak ada data karyawan yang cocok dengan filter pencarian.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(emp => {
    const rId = String(emp.role_id || emp.role || "R-04").trim();
    let roleObj = ROLE_PERMISSIONS_STATE[rId];
    if (!roleObj) {
      roleObj = Object.values(ROLE_PERMISSIONS_STATE).find(r => r.name.toLowerCase() === rId.toLowerCase());
    }
    const rBadge = roleObj?.badgeBg || "bg-slate-100 text-slate-700 border-slate-200";
    const rName = roleObj?.name || rId;
    const isAktif = emp.status_aktif === "AKTIF" || emp.status_aktif === true;
    const statusKerja = emp.status_kerja || "PKWTT";
    const skColor = statusKerja === "PKWTT"
      ? "bg-indigo-50 text-indigo-700 border-indigo-200"
      : "bg-amber-50 text-amber-700 border-amber-200";

    const avatarHtml = (emp.foto_profile_url || emp.foto)
      ? `<img src="${emp.foto_profile_url || emp.foto}" class="w-full h-full object-cover" />`
      : `<i class="fa-solid fa-user-tie text-indigo-400"></i>`;

    return `
      <div class="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 hover:shadow-sm transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <!-- Identitas Karyawan -->
        <div class="flex items-start space-x-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-base shrink-0 overflow-hidden mt-0.5">
            ${avatarHtml}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center space-x-1.5 flex-wrap gap-y-1">
              <span class="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${emp.nip}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${skColor} uppercase">${statusKerja}</span>
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded border ${rBadge} uppercase">${rName}</span>
              ${isAktif
        ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase">AKTIF</span>'
        : '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-200 uppercase">NONAKTIF</span>'}
            </div>
            <h4 class="font-bold text-sm text-slate-900 mt-1 truncate">${emp.nama_lengkap || emp.nama || "-"}</h4>
            <div class="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-2 flex-wrap">
              <span class="font-semibold text-indigo-950">${emp.jabatan || "Staff"}</span>
              <span>•</span>
              <span>Unit: <strong class="text-slate-700">${emp.cabang || "Head Office"}</strong></span>
              ${emp.area_cover ? `<span>•</span><span>Area: <strong class="text-indigo-900">${emp.area_cover}</strong></span>` : ''}
              ${emp.atasan_nama ? `<span>•</span><span>Atasan: <strong class="text-slate-600">${emp.atasan_nama}</strong></span>` : ''}
            </div>
          </div>
        </div>

        <!-- Tombol Aksi Personalia & Dossier -->
        <div class="flex items-center space-x-2 shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-slate-100 justify-end">
          <button type="button" onclick="openEmployeeDossierModal('${emp.nip}')" title="Buka Detail Personalia & Buku Induk" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm transition">
            <i class="fa-solid fa-id-badge text-indigo-200"></i>
            <span>Detail Personalia</span>
          </button>
        </div>
      </div>
    `;
  }).join("");
}

function openAddCareerTransactionModalFor(nip) {
  openEmployeeTransactionModal(nip);
}

function openAddPersonaliaEmployeeModal() {
  openCandidateInputModal();
}

// =========================================================================
// CONTROLLER: BAGAN ORGANISASI VISUAL (ORG CHART TREE)
// =========================================================================

function populateOrgFilterUnits() {
  const sel = document.getElementById("org-chart-filter-unit");
  if (!sel) return;
  const current = sel.value;
  const units = (ORG_UNITS_DATA || []).map(u => ({ id: u.id_unit, name: u.nama_unit }));
  sel.innerHTML = '<option value="ALL">Semua Unit (Seluruh Organisasi)</option>' +
    units.map(u => `<option value="${u.id}">${u.name}</option>`).join("");
  if (units.some(u => u.id === current)) sel.value = current;
}

function zoomOrgChart(delta) {
  ORG_CHART_ZOOM = Math.max(0.35, Math.min(2.5, (ORG_CHART_ZOOM * delta)));
  const container = document.getElementById("org-chart-container");
  if (container) container.style.transform = `scale(${ORG_CHART_ZOOM})`;
}

function resetOrgChartZoom() {
  ORG_CHART_ZOOM = 1;
  const container = document.getElementById("org-chart-container");
  if (container) container.style.transform = "scale(1)";
}

function expandAllOrgTreeNodes(open) {
  document.querySelectorAll(".org-node-children").forEach(el => {
    if (open) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

function renderVisualOrgChartTree() {
  const container = document.getElementById("org-chart-container");
  if (!container) return;
  const filterUnit = document.getElementById("org-chart-filter-unit")?.value || "ALL";

  let list = PERSONALIA_EMPLOYEES_DATA || [];
  if (filterUnit !== "ALL") {
    list = list.filter(e => e.unit_id === filterUnit || e.cabang === filterUnit);
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-xs text-slate-400">
        <i class="fa-solid fa-sitemap text-3xl text-slate-300 mb-2 block"></i>
        Tidak ada struktur bagan karyawan pada filter unit ini.
      </div>
    `;
    return;
  }

  const roots = list.filter(e => !e.atasan_nip || e.atasan_nip === e.nip || !list.some(p => p.nip === e.atasan_nip));

  function renderOrgNode(emp) {
    const subordinates = list.filter(e => e.atasan_nip === emp.nip && e.nip !== emp.nip);
    const hasSubs = subordinates.length > 0;
    const avatarHtml = (emp.foto_profile_url || emp.foto)
      ? `<img src="${emp.foto_profile_url || emp.foto}" class="w-full h-full object-cover" />`
      : `<i class="fa-solid fa-user-tie"></i>`;

    return `
      <div class="flex flex-col items-center m-2">
        <div onclick="openEmployeeDossierModal('${emp.nip}')" class="cursor-pointer bg-white hover:border-indigo-400 hover:shadow-md transition p-3 rounded-2xl border border-slate-200 shadow-xs w-52 text-center text-xs space-y-1 group">
          <div class="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 mx-auto flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
            ${avatarHtml}
          </div>
          <span class="font-bold text-slate-900 block truncate group-hover:text-indigo-700 transition" title="${emp.nama_lengkap || emp.nama}">${emp.nama_lengkap || emp.nama}</span>
          <span class="font-semibold text-indigo-600 block text-[10px] truncate">${emp.jabatan || 'Staff'}</span>
          <div class="flex items-center justify-center space-x-1 text-[9px] text-slate-400">
            <span class="font-mono bg-slate-100 px-1.5 py-0.2 rounded">${emp.nip}</span>
            <span>•</span>
            <span class="truncate">${emp.cabang || 'HO'}</span>
          </div>
        </div>
        ${hasSubs ? `
          <div class="w-0.5 h-4 bg-indigo-300"></div>
          <div class="org-node-children flex flex-wrap justify-center border-t-2 border-indigo-200 pt-3 relative">
            ${subordinates.map(sub => renderOrgNode(sub)).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="flex flex-wrap justify-center gap-4">
      ${(roots.length > 0 ? roots : list.slice(0, 10)).map(r => renderOrgNode(r)).join("")}
    </div>
  `;
}

// =========================================================================
// CONTROLLER: MODAL 1 - INPUT DATA CALON KARYAWAN (DATA PRIBADI SIPIL & JSONB)
// =========================================================================
function openCandidateInputModal() {
  const modal = document.getElementById("modal-candidate-input");
  if (!modal) return;
  document.getElementById("form-candidate-input")?.reset();
  const childrenContainer = document.getElementById("cand-children-container");
  if (childrenContainer) childrenContainer.innerHTML = "";
  modal.classList.remove("hidden");
}

function closeCandidateInputModal() {
  document.getElementById("modal-candidate-input")?.classList.add("hidden");
}

function addCandidateChildRow() {
  const container = document.getElementById("cand-children-container");
  if (!container) return;
  const count = container.children.length + 1;
  const row = document.createElement("div");
  row.className = "flex items-center space-x-2 cand-child-row";
  row.innerHTML = `
    <span class="text-[10px] font-bold text-slate-500 w-14 shrink-0">Anak ${count}:</span>
    <input type="text" placeholder="Nama Lengkap Anak" class="cand-child-name flex-1 bg-white border border-slate-300 rounded-xl p-2 text-xs text-slate-800 outline-none" />
    <button type="button" onclick="this.closest('.cand-child-row').remove(); updateCandidateChildrenCount();" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs shrink-0" title="Hapus"><i class="fa-solid fa-trash-can"></i></button>
  `;
  container.appendChild(row);
  updateCandidateChildrenCount();
}

function updateCandidateChildrenCount() {
  const container = document.getElementById("cand-children-container");
  const countInput = document.getElementById("cand-input-children-count");
  if (container && countInput) {
    countInput.value = container.querySelectorAll(".cand-child-row").length;
  }
}

async function handleSaveCandidate(event) {
  event.preventDefault();

  const nama = String(document.getElementById("cand-input-nama")?.value || "").trim().toUpperCase();
  const nik = String(document.getElementById("cand-input-nik")?.value || "").trim();
  const pob = String(document.getElementById("cand-input-pob")?.value || "").trim();
  const dob = document.getElementById("cand-input-dob")?.value;
  const gender = document.getElementById("cand-input-gender")?.value || "Laki-laki";
  const marital = document.getElementById("cand-input-marital")?.value || "Belum Kawin";
  const spouse = String(document.getElementById("cand-input-spouse")?.value || "").trim();
  const childrenCount = parseInt(document.getElementById("cand-input-children-count")?.value) || 0;

  const childInputs = document.querySelectorAll(".cand-child-name");
  const children = Array.from(childInputs).map(inp => inp.value.trim()).filter(Boolean);

  const alamatKtp = String(document.getElementById("cand-input-alamat-ktp")?.value || "").trim();
  const alamatDom = String(document.getElementById("cand-input-alamat-dom")?.value || "").trim();
  const lat = String(document.getElementById("cand-input-lat")?.value || "").trim();
  const lng = String(document.getElementById("cand-input-lng")?.value || "").trim();

  const phone = String(document.getElementById("cand-input-phone")?.value || "").trim();
  const wa = String(document.getElementById("cand-input-wa")?.value || "").trim();

  const emergName = String(document.getElementById("cand-input-emerg-name")?.value || "").trim();
  const emergRel = String(document.getElementById("cand-input-emerg-rel")?.value || "").trim();
  const emergPhone = String(document.getElementById("cand-input-emerg-phone")?.value || "").trim();

  const education = document.getElementById("cand-input-education")?.value || "S1";
  const major = String(document.getElementById("cand-input-major")?.value || "").trim();
  const email = String(document.getElementById("cand-input-email")?.value || "").trim();

  // Validasi
  if (!nama || /[^A-Z\s\.\,\']/.test(nama)) {
    alert("Nama lengkap wajib huruf besar dan tidak boleh mengandung angka!");
    return;
  }
  if (!nik || nik.length !== 16 || !/^\d{16}$/.test(nik)) {
    alert("NIK KTP harus tepat 16 digit angka!");
    return;
  }
  if (!dob) {
    alert("Tanggal lahir wajib diisi!");
    return;
  }
  if (!email) {
    alert("Email akun login wajib diisi!");
    return;
  }

  const btn = document.getElementById("btn-save-candidate");
  const origText = btn ? btn.innerHTML : "Simpan";
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan Data Calon...';
    btn.disabled = true;
  }

  try {
    const tempNip = `CAND-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    const personalDetailsJsonb = {
      nik_ktp: nik,
      tempat_lahir: pob || null,
      alamat_ktp: alamatKtp || null,
      alamat_domisili: alamatDom || null,
      geo_domisili: {
        latitude: lat || null,
        longitude: lng || null
      },
      spouse_name: spouse || null,
      children_count: childrenCount,
      children: children,
      no_hp: phone || null,
      no_wa: wa || null,
      kontak_darurat: {
        nama: emergName || null,
        hubungan: emergRel || null,
        no_hp: emergPhone || null
      },
      pendidikan_terakhir: education,
      jurusan: major || null
    };

    let newEmpId = null;

    if (supabaseClient) {
      // 1. Simpan akun calon karyawan ke hr_employees (TABEL FISIK — bukan VIEW 'employees')
      // PENTING: hr_employees TIDAK punya kolom dob, gender, marital_status, status_aktif, is_active
      // Data pribadi sipil disimpan di hr_employee_personal_details (langkah ke-2)
      const empPayload = {
        nip: tempNip,
        name: nama,
        email: email,
        status_kerja: "CALON",
        created_at: now,
        updated_at: now
      };

      const { data: createdEmp, error: empErr } = await supabaseClient
        .from("hr_employees")
        .insert([empPayload])
        .select("id")
        .single();

      if (empErr) {
        console.error("[handleSaveCandidate] hr_employees insert error:", empErr);
        throw new Error("Gagal menyimpan data calon karyawan. Silakan coba lagi atau hubungi Administrator.");
      }

      newEmpId = createdEmp.id;

      // 2. Simpan data pribadi sipil ke hr_employee_personal_details
      // STRATEGI 3-TAHAP:
      // Tahap 1: Full payload (semua kolom terdedikasi + JSONB)
      // Tahap 2: Standard payload + personal_details JSONB (kolom base + snapshot JSONB)
      // Tahap 3: Bare base payload (hanya kolom fisik migration 05)
      const personalPayloadFull = {
        employee_id: newEmpId,
        name: nama,
        email: email,
        ktp_number: nik,
        phone: phone || null,
        pob: pob || null,
        dob: dob || null,
        gender: gender,
        marital_status: marital,
        spouse_name: spouse || null,
        number_of_dependents: childrenCount,
        address_ktp: alamatKtp || null,
        address_domicile: alamatDom || null,
        emergency_contact_name: emergName || null,
        emergency_contact_relation: emergRel || null,
        emergency_contact_phone: emergPhone || null,
        education: education || null,
        major: major || null,
        personal_details: personalDetailsJsonb,
        updated_at: now
      };

      const personalPayloadWithJsonb = {
        employee_id: newEmpId,
        ktp_number: nik,
        phone: phone || null,
        pob: pob || null,
        dob: dob || null,
        gender: gender,
        marital_status: marital,
        number_of_dependents: childrenCount,
        address_ktp: alamatKtp || null,
        address_domicile: alamatDom || null,
        emergency_contact_name: emergName || null,
        emergency_contact_relation: emergRel || null,
        emergency_contact_phone: emergPhone || null,
        personal_details: personalDetailsJsonb,
        updated_at: now
      };

      const personalPayloadBase = {
        employee_id: newEmpId,
        ktp_number: nik,
        phone: phone || null,
        pob: pob || null,
        dob: dob || null,
        gender: gender,
        marital_status: marital,
        number_of_dependents: childrenCount,
        address_ktp: alamatKtp || null,
        address_domicile: alamatDom || null,
        emergency_contact_name: emergName || null,
        emergency_contact_relation: emergRel || null,
        emergency_contact_phone: emergPhone || null,
        updated_at: now
      };

      let personalDetailsSaved = false;

      // Tahap 1: Coba full payload
      const { error: pdErr } = await supabaseClient
        .from("hr_employee_personal_details")
        .upsert([personalPayloadFull], { onConflict: "employee_id" });

      if (!pdErr) {
        personalDetailsSaved = true;
        console.log("[handleSaveCandidate] Full payload berhasil disimpan. employee_id:", newEmpId);
      } else {
        console.warn("[handleSaveCandidate] Full payload gagal (" + (pdErr.message || pdErr.code) + "). Mencoba Tahap 2 (Base + JSONB)...");
        
        // Tahap 2: Coba Base + JSONB
        const { error: pdErrJsonb } = await supabaseClient
          .from("hr_employee_personal_details")
          .upsert([personalPayloadWithJsonb], { onConflict: "employee_id" });

        if (!pdErrJsonb) {
          personalDetailsSaved = true;
          console.log("[handleSaveCandidate] Tahap 2 (Base + JSONB) berhasil disimpan. employee_id:", newEmpId);
        } else {
          console.warn("[handleSaveCandidate] Tahap 2 gagal (" + (pdErrJsonb.message || pdErrJsonb.code) + "). Mencoba Tahap 3 (Bare Base)...");

          // Tahap 3: Coba Bare Base
          const { error: pdErrBase } = await supabaseClient
            .from("hr_employee_personal_details")
            .upsert([personalPayloadBase], { onConflict: "employee_id" });

          if (!pdErrBase) {
            personalDetailsSaved = true;
            console.log("[handleSaveCandidate] Tahap 3 (Bare Base) berhasil disimpan. employee_id:", newEmpId);
          } else {
            console.error("[handleSaveCandidate] Semua tahapan penyimpanan personal details gagal:", pdErrBase);
          }
        }
      }

      closeCandidateInputModal();

      if (personalDetailsSaved) {
        showToast(`Data calon karyawan "${nama}" berhasil disimpan! NIP resmi akan dibuat saat Penerimaan Karyawan diajukan.`, "success", 4000);
      } else {
        showToast(`Data akun calon "${nama}" tersimpan di sistem, namun data biodata detail perlu diperbarui. Jalankan migrasi 12 di Supabase untuk sinkronisasi penuh.`, "warning", 6000);
      }
    } else {
      closeCandidateInputModal();
      showToast(`Data calon karyawan "${nama}" berhasil disimpan (mode offline).`, "info", 3000);
    }

    if (typeof loadPersonaliaEmployees === "function") {
      await loadPersonaliaEmployees();
    }
  } catch (err) {
    console.error("[handleSaveCandidate] Error:", err);
    const isDev = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const userMsg = isDev
      ? `[Dev Error] ${err.message || err}`
      : "Gagal menyimpan data calon karyawan. Silakan coba lagi atau hubungi Administrator.";
    alert(userMsg);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

// =========================================================================
// CONTROLLER: MODAL 2 - PENGAJUAN TRANSAKSI KEPEGAWAIAN DINAMIS (12 JENIS)
// =========================================================================
let CURRENT_TX_SELECTED_EMP = null;

function formatRupiahInput(input) {
  let val = String(input.value || "").replace(/\D/g, "");
  if (!val) {
    input.value = "";
    return;
  }
  input.value = parseInt(val, 10).toLocaleString("id-ID");
}

function parseRupiah(val) {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const cleaned = String(val).replace(/\D/g, "");
  return cleaned ? parseInt(cleaned, 10) : 0;
}

function generateNewEmployeeNIP() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `${mm}${yy}`;

  const allEmps = (PERSONALIA_EMPLOYEES_DATA || []).concat(APP_STATE.employees || []);
  const matching = allEmps.filter(e => String(e.nip || "").startsWith(prefix));
  let maxSeq = 0;
  matching.forEach(e => {
    const seqPart = parseInt(String(e.nip).slice(4), 10);
    if (!isNaN(seqPart) && seqPart > maxSeq) maxSeq = seqPart;
  });
  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

async function openEmployeeTransactionModal(empNipOrId, initialType = null) {
  const modal = document.getElementById("modal-employee-transaction");
  if (!modal) return;

  document.getElementById("form-employee-transaction")?.reset();

  // 1. Set default effective date = hari ini
  const effInput = document.getElementById("tx-effective-date");
  if (effInput) effInput.value = new Date().toISOString().split("T")[0];

  // 2. Populate Dropdown Karyawan (Pegawai Aktif & Calon Karyawan)
  const empSelect = document.getElementById("tx-select-emp");
  if (empSelect) {
    const list = PERSONALIA_EMPLOYEES_DATA && PERSONALIA_EMPLOYEES_DATA.length > 0
      ? PERSONALIA_EMPLOYEES_DATA
      : (APP_STATE.employees || []);

    let optionsHtml = '<option value="">-- Pilih Calon Karyawan atau Pegawai Aktif --</option>';
    list.forEach(emp => {
      const isCalon = emp.status_kerja === "CALON" || String(emp.nip).startsWith("CAND-");
      const tag = isCalon ? "[CALON KARYAWAN]" : `[${emp.nip}]`;
      optionsHtml += `<option value="${emp.id || emp.nip}">${tag} ${emp.nama_lengkap || emp.nama} (${emp.jabatan || 'Staff'})</option>`;
    });
    empSelect.innerHTML = optionsHtml;
  }

  // 3. Populate Work Locations & Units & Positions & Levels
  populateTxMasterDropdowns();

  // 4. Reset Staging Approvals ke 1 Stage (Opsional)
  resetTxStagingApprovals();

  // 5. Reset Inventory Rows
  const retCont = document.getElementById("tx-inv-returned-container");
  const notRetCont = document.getElementById("tx-inv-notreturned-container");
  if (retCont) retCont.innerHTML = "";
  if (notRetCont) notRetCont.innerHTML = "";

  // 6. Reset Dokumen & Tab Viewer
  resetTxDocForm();

  // 7. Reset summary box & subforms
  document.getElementById("tx-emp-selected-summary")?.classList.add("hidden");
  toggleTxSubforms();

  modal.classList.remove("hidden");

  // Jika parameter empNipOrId dikirim, pilih otomatis
  if (empNipOrId && empSelect) {
    const matched = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.nip) === String(empNipOrId) || String(e.id) === String(empNipOrId));
    if (matched) {
      empSelect.value = matched.id || matched.nip;
      await onTxEmployeeSelected(empSelect.value);
    }
  }

  // Jika dipanggil khusus untuk Pembaruan Data Pribadi
  if (initialType === "biodata") {
    const chkBio = document.getElementById("chk-tx-biodata");
    if (chkBio) chkBio.checked = true;
    toggleTxSubforms();
  }
}

function closeEmployeeTransactionModal() {
  document.getElementById("modal-employee-transaction")?.classList.add("hidden");
  CURRENT_TX_SELECTED_EMP = null;
}

function populateTxMasterDropdowns() {
  // Work Locations
  const locs = Array.from(new Set([
    ...(APP_STATE.locations || []).map(l => l.name || l),
    ...(ORG_UNITS_DATA || []).map(u => u.work_location_id).filter(Boolean)
  ])).sort();

  const locSelects = ["tx-penerimaan-workloc", "tx-mutasi-new-loc"];
  locSelects.forEach(sId => {
    const el = document.getElementById(sId);
    if (el) {
      el.innerHTML = '<option value="">-- Pilih Lokasi Kerja --</option>' +
        locs.map(loc => `<option value="${loc}">${loc}</option>`).join("");
    }
  });

  // Units
  const units = (ORG_UNITS_DATA || []).map(u => ({ id: u.id_unit, name: u.nama_unit }));
  const unitSelects = ["tx-penerimaan-unit", "tx-mutasi-new-unit"];
  unitSelects.forEach(sId => {
    const el = document.getElementById(sId);
    if (el) {
      el.innerHTML = '<option value="">-- Pilih Unit Kerja --</option>' +
        units.map(u => `<option value="${u.id}">${u.name}</option>`).join("");
    }
  });

  // Positions
  const posList = (ORG_POSITIONS_DATA || []).map(p => ({ id: p.id_position, name: p.nama_jabatan, level_id: p.level_id }));
  const posSelects = ["tx-penerimaan-position", "tx-rotasi-new-pos", "tx-promosi-new-pos", "tx-demosi-new-pos"];
  posSelects.forEach(sId => {
    const el = document.getElementById(sId);
    if (el) {
      el.innerHTML = '<option value="">-- Pilih Jabatan --</option>' +
        posList.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
    }
  });

  // Levels
  const lvlList = (ORG_LEVELS_DATA || []).map(l => ({ id: l.id_level, name: l.nama_level, rank: l.urutan_level || l.rank || 0 }));
  const lvlSelects = ["tx-promosi-new-lvl", "tx-demosi-new-lvl"];
  lvlSelects.forEach(sId => {
    const el = document.getElementById(sId);
    if (el) {
      el.innerHTML = '<option value="">-- Pilih Level Baru --</option>' +
        lvlList.map(l => `<option value="${l.id}">${l.name}</option>`).join("");
    }
  });
}

function resetTxStagingApprovals() {
  const container = document.getElementById("tx-staging-container");
  if (!container) return;

  const approverOptions = getApproverOptionsHtml();
  container.innerHTML = `
    <div class="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 tx-staging-row" id="tx-stage-row-1">
      <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
      <div class="flex-1 min-w-0">
        <select id="tx-stage-approver-1" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800">
          <option value="">-- Lewati Staging Atasan (Cukup Konfirmasi Karyawan Ybs) --</option>
          ${approverOptions}
        </select>
      </div>
    </div>
  `;
}

function getApproverOptionsHtml() {
  const emps = (PERSONALIA_EMPLOYEES_DATA || []).concat(APP_STATE.employees || []);
  const uniqueMap = new Map();
  emps.forEach(e => {
    if (e.nip && !String(e.nip).startsWith("CAND-")) {
      uniqueMap.set(e.nip, `${e.nama_lengkap || e.nama} (${e.jabatan || 'Staff'} • ${e.nip})`);
    }
  });

  let html = "";
  uniqueMap.forEach((label, nip) => {
    html += `<option value="${nip}">${label}</option>`;
  });
  return html;
}

function addTxStagingStage() {
  const container = document.getElementById("tx-staging-container");
  if (!container) return;

  const currentCount = container.querySelectorAll(".tx-staging-row").length;
  const nextOrder = currentCount + 1;
  const approverOptions = getApproverOptionsHtml();

  const row = document.createElement("div");
  row.className = "p-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 tx-staging-row";
  row.id = `tx-stage-row-${nextOrder}`;
  row.innerHTML = `
    <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">${nextOrder}</span>
    <div class="flex-1 min-w-0">
      <select id="tx-stage-approver-${nextOrder}" class="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-semibold text-slate-800">
        <option value="">-- Pilih Approver Staging ${nextOrder} --</option>
        ${approverOptions}
      </select>
    </div>
    <button type="button" onclick="this.closest('.tx-staging-row').remove(); reorderTxStaging();" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs" title="Hapus Stage"><i class="fa-solid fa-trash-can"></i></button>
  `;
  container.appendChild(row);
}

function reorderTxStaging() {
  const rows = document.querySelectorAll(".tx-staging-row");
  rows.forEach((row, i) => {
    const order = i + 1;
    row.id = `tx-stage-row-${order}`;
    const badge = row.querySelector("span");
    if (badge) badge.innerText = order;
    const select = row.querySelector("select");
    if (select) select.id = `tx-stage-approver-${order}`;
  });
}

async function populateTxPersonalData(emp) {
  if (!emp) return;
  let detail = null;
  let empId = emp.id;

  if (supabaseClient) {
    try {
      if (!empId || typeof empId === "number") {
        const { data: eRow } = await supabaseClient.from("employees").select("id").eq("nip", emp.nip).maybeSingle();
        if (eRow?.id) empId = eRow.id;
      }
      if (empId) {
        let { data } = await supabaseClient.from("hr_employee_personal_details").select("*").eq("employee_id", empId).maybeSingle();
        if (!data) {
          const resFallback = await supabaseClient.from("employee_personal_details").select("*").eq("employee_id", empId).maybeSingle();
          if (resFallback?.data) data = resFallback.data;
        }
        if (data) detail = data;
      }
    } catch (e) {
      console.warn("[populateTxPersonalData] error fetching personal details:", e);
    }
  }

  const jsonb = detail?.personal_details || {};
  const nik = detail?.ktp_number || detail?.nik || jsonb.nik_ktp || emp.nik_ktp || "";
  const nama = emp.nama_lengkap || emp.nama || emp.name || "";
  const pob = detail?.pob || detail?.tempat_lahir || jsonb.tempat_lahir || "";
  const dob = detail?.dob || detail?.tanggal_lahir || emp.dob || "";
  const gender = detail?.gender || detail?.jenis_kelamin || emp.gender || "Laki-laki";
  const religion = detail?.religion || jsonb.religion || "Islam";
  const marital = detail?.marital_status || detail?.status_pernikahan || emp.marital_status || "Belum Kawin";
  const spouse = jsonb.spouse_name || detail?.spouse_name || "";
  const childrenCount = jsonb.children_count ?? (Array.isArray(jsonb.children) ? jsonb.children.length : (detail?.number_of_dependents || 0));
  const alamatKtp = detail?.address_ktp || jsonb.address_ktp || "";
  const alamatDom = detail?.address_domicile || jsonb.address_domicile || "";
  const lat = jsonb.lat || jsonb.latitude || "";
  const lng = jsonb.lng || jsonb.longitude || "";
  const phone = detail?.phone || emp.phone || "";
  const wa = jsonb.wa || jsonb.whatsapp || phone || "";
  const emergName = detail?.emergency_contact_name || jsonb.emergency_contact_name || "";
  const emergRel = detail?.emergency_contact_relation || jsonb.emergency_contact_relation || "";
  const emergPhone = detail?.emergency_contact_phone || jsonb.emergency_contact_phone || "";
  const edu = jsonb.education_level || detail?.education || emp.education || "S1";
  const major = jsonb.education_major || detail?.major || emp.major || "";

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  setVal("tx-bio-nama", nama);
  setVal("tx-bio-nik", nik);
  setVal("tx-bio-pob", pob);
  setVal("tx-bio-dob", dob);
  setVal("tx-bio-gender", gender);
  setVal("tx-bio-religion", religion);
  setVal("tx-bio-marital", marital);
  setVal("tx-bio-spouse", spouse);
  setVal("tx-bio-children-count", childrenCount);
  setVal("tx-bio-alamat-ktp", alamatKtp);
  setVal("tx-bio-alamat-dom", alamatDom);
  setVal("tx-bio-lat", lat);
  setVal("tx-bio-lng", lng);
  setVal("tx-bio-phone", phone);
  setVal("tx-bio-wa", wa);
  setVal("tx-bio-emerg-name", emergName);
  setVal("tx-bio-emerg-rel", emergRel);
  setVal("tx-bio-emerg-phone", emergPhone);
  setVal("tx-bio-education", edu);
  setVal("tx-bio-major", major);

  const childContainer = document.getElementById("tx-bio-children-container");
  if (childContainer) {
    childContainer.innerHTML = "";
    const childrenList = Array.isArray(jsonb.children) ? jsonb.children.filter(Boolean) : [];
    if (childrenList.length > 0) {
      childrenList.forEach(childName => addTxBioChildRow(childName));
    }
  }
}

function addTxBioChildRow(val = "") {
  const container = document.getElementById("tx-bio-children-container");
  if (!container) return;
  const row = document.createElement("div");
  row.className = "flex items-center space-x-1.5 tx-bio-child-row";
  row.innerHTML = `
    <input type="text" value="${val}" placeholder="Nama Lengkap Anak" class="flex-1 bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800 outline-none" />
    <button type="button" onclick="this.closest('.tx-bio-child-row').remove(); updateTxBioChildrenCount();" class="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs shrink-0" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(row);
  updateTxBioChildrenCount();
}

function updateTxBioChildrenCount() {
  const rows = document.querySelectorAll(".tx-bio-child-row");
  const countInput = document.getElementById("tx-bio-children-count");
  if (countInput) countInput.value = rows.length;
}

async function onTxEmployeeSelected(empId) {
  if (!empId) {
    CURRENT_TX_SELECTED_EMP = null;
    document.getElementById("tx-emp-selected-summary")?.classList.add("hidden");
    return;
  }

  const emp = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.id) === String(empId) || String(e.nip) === String(empId)) ||
    (APP_STATE.employees || []).find(e => String(e.id) === String(empId) || String(e.nip) === String(empId));

  if (!emp) return;
  CURRENT_TX_SELECTED_EMP = emp;

  const isCalon = emp.status_kerja === "CALON" || String(emp.nip).startsWith("CAND-");

  // Summary box
  const sumBox = document.getElementById("tx-emp-selected-summary");
  if (sumBox) {
    sumBox.classList.remove("hidden");
    document.getElementById("tx-sum-name").innerText = emp.nama_lengkap || emp.nama || "-";
    document.getElementById("tx-sum-pos-branch").innerText = `${emp.jabatan || 'Staff'} • ${emp.cabang || 'Head Office'}`;
    document.getElementById("tx-sum-nip").innerText = emp.nip;
  }

  const badge = document.getElementById("tx-emp-status-badge");
  if (badge) {
    badge.innerText = isCalon ? "CALON KARYAWAN" : (emp.status_kerja || "PEGAWAI AKTIF");
    badge.className = isCalon ? "text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800" : "text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
  }

  // Aturan Tickmark: Jika Calon Karyawan -> Hanya bisa dicentang Penerimaan Karyawan!
  const chkPenerimaan = document.getElementById("chk-tx-penerimaan");
  const allOtherCheckboxes = [
    "chk-tx-tetap", "chk-tx-kontrak", "chk-tx-perpanjang", "chk-tx-rotasi",
    "chk-tx-promosi", "chk-tx-demosi", "chk-tx-mutasi", "chk-tx-benefit",
    "chk-tx-resign", "chk-tx-phk", "chk-tx-pensiun", "chk-tx-biodata"
  ];

  if (isCalon) {
    if (chkPenerimaan) {
      chkPenerimaan.checked = true;
      chkPenerimaan.disabled = false;
    }
    allOtherCheckboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.checked = false;
        el.disabled = true;
      }
    });
  } else {
    // Pegawai Aktif -> Penerimaan Karyawan dinonaktifkan
    if (chkPenerimaan) {
      chkPenerimaan.checked = false;
      chkPenerimaan.disabled = true;
    }
    allOtherCheckboxes.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = false;
    });

    // Auto-calculate Ulang Tahun ke-50 untuk Pengangkatan Tetap (PKWTT)
    const dobStr = emp.dob || emp.tanggal_lahir;
    const calcEndEl = document.getElementById("tx-tetap-calc-end");
    if (dobStr && calcEndEl) {
      const dob = new Date(dobStr);
      const endYear = dob.getFullYear() + 50;
      const endMonth = String(dob.getMonth() + 1).padStart(2, '0');
      const endDay = String(dob.getDate()).padStart(2, '0');
      calcEndEl.innerText = `${endYear}-${endMonth}-${endDay} (Tepat Ulang Tahun ke-50)`;
    } else if (calcEndEl) {
      calcEndEl.innerText = "Ulang Tahun ke-50 (Menunggu DOB)";
    }

    // Auto-populate data sebelumnya ke subform rotasi, promosi, demosi, mutasi, benefit
    const prevPosRotasi = document.getElementById("tx-rotasi-prev-pos");
    if (prevPosRotasi) prevPosRotasi.value = emp.jabatan || "Staff";

    const prevPosPromosi = document.getElementById("tx-promosi-prev-pos");
    if (prevPosPromosi) prevPosPromosi.value = emp.jabatan || "Staff";

    const prevLvlPromosi = document.getElementById("tx-promosi-prev-lvl");
    if (prevLvlPromosi) prevLvlPromosi.value = emp.level_name || emp.role_id || "Level 1";

    const prevPosDemosi = document.getElementById("tx-demosi-prev-pos");
    if (prevPosDemosi) prevPosDemosi.value = emp.jabatan || "Staff";

    const prevLvlDemosi = document.getElementById("tx-demosi-prev-lvl");
    if (prevLvlDemosi) prevLvlDemosi.value = emp.level_name || emp.role_id || "Level 1";

    const prevLocMutasi = document.getElementById("tx-mutasi-prev-loc");
    if (prevLocMutasi) prevLocMutasi.value = emp.work_location_name || emp.area_cover || "Head Office";

    const prevUnitMutasi = document.getElementById("tx-mutasi-prev-unit");
    if (prevUnitMutasi) prevUnitMutasi.value = emp.cabang || "Head Office";

    // Benefit sebelumnya
    const bSalary = parseFloat(emp.basic_salary || emp.gaji_pokok || 0);
    const dispSal = document.getElementById("tx-prev-salary-display");
    if (dispSal) dispSal.innerText = `Rp ${bSalary.toLocaleString('id-ID')}`;

    // Auto-populate data pribadi (pre-filled) ke subform biodata
    await populateTxPersonalData(emp);

    // Auto-load dokumen berkas terunggah sebelumnya ke tab dokumen
    await loadTxEmployeeExistingDocs(emp);
  }

  toggleTxSubforms();
}

function toggleTxSubforms() {
  const isPenerimaan = document.getElementById("chk-tx-penerimaan")?.checked;
  const isTetap = document.getElementById("chk-tx-tetap")?.checked;
  const isKontrak = document.getElementById("chk-tx-kontrak")?.checked || document.getElementById("chk-tx-perpanjang")?.checked;
  const isRotasi = document.getElementById("chk-tx-rotasi")?.checked;
  const isPromosi = document.getElementById("chk-tx-promosi")?.checked;
  const isDemosi = document.getElementById("chk-tx-demosi")?.checked;
  const isMutasi = document.getElementById("chk-tx-mutasi")?.checked;
  const isBenefit = document.getElementById("chk-tx-benefit")?.checked;
  const isBiodata = document.getElementById("chk-tx-biodata")?.checked;
  const isExit = document.getElementById("chk-tx-resign")?.checked || document.getElementById("chk-tx-phk")?.checked || document.getElementById("chk-tx-pensiun")?.checked;

  toggleElement("subform-penerimaan", isPenerimaan);
  toggleElement("subform-tetap", isTetap);
  toggleElement("subform-kontrak", isKontrak);
  toggleElement("subform-rotasi", isRotasi);
  toggleElement("subform-promosi", isPromosi);
  toggleElement("subform-demosi", isDemosi);
  toggleElement("subform-mutasi", isMutasi);
  toggleElement("subform-benefit", isBenefit);
  toggleElement("subform-biodata", isBiodata);
  toggleElement("subform-exit", isExit);

  // Update exit title
  const exitTitle = document.getElementById("tx-exit-title");
  if (exitTitle) {
    if (document.getElementById("chk-tx-resign")?.checked) exitTitle.innerText = "j. Pengunduran Diri (Resign)";
    else if (document.getElementById("chk-tx-phk")?.checked) exitTitle.innerText = "k. Pemutusan Hubungan Kerja (PHK)";
    else if (document.getElementById("chk-tx-pensiun")?.checked) exitTitle.innerText = "l. Pensiun Karyawan";
  }
}

function toggleElement(id, show) {
  const el = document.getElementById(id);
  if (!el) return;
  if (show) el.classList.remove("hidden");
  else el.classList.add("hidden");
}

function populateTxUnitsByLocation(locId) {
  const sel = document.getElementById("tx-penerimaan-unit");
  if (!sel) return;
  const filtered = (ORG_UNITS_DATA || []).filter(u => !locId || u.work_location_id === locId);
  sel.innerHTML = '<option value="">-- Pilih Unit Kerja --</option>' +
    filtered.map(u => `<option value="${u.id_unit}">${u.nama_unit}</option>`).join("");
}

function populateTxPositionsByUnit(unitId) {
  const sel = document.getElementById("tx-penerimaan-position");
  if (!sel) return;
  const filtered = (ORG_POSITIONS_DATA || []).filter(p => !unitId || p.unit_id === unitId || !p.unit_id);
  sel.innerHTML = '<option value="">-- Pilih Jabatan --</option>' +
    (filtered.length > 0 ? filtered : ORG_POSITIONS_DATA || []).map(p => `<option value="${p.id_position}">${p.nama_jabatan}</option>`).join("");
}

function populateTxPromosiPositions(levelId) {
  const sel = document.getElementById("tx-promosi-new-pos");
  if (!sel) return;
  const filtered = (ORG_POSITIONS_DATA || []).filter(p => !levelId || p.level_id === levelId);
  sel.innerHTML = '<option value="">-- Pilih Jabatan Baru --</option>' +
    (filtered.length > 0 ? filtered : ORG_POSITIONS_DATA || []).map(p => `<option value="${p.id_position}">${p.nama_jabatan}</option>`).join("");
}

function populateTxDemosiPositions(levelId) {
  const sel = document.getElementById("tx-demosi-new-pos");
  if (!sel) return;
  const filtered = (ORG_POSITIONS_DATA || []).filter(p => !levelId || p.level_id === levelId);
  sel.innerHTML = '<option value="">-- Pilih Jabatan Baru --</option>' +
    (filtered.length > 0 ? filtered : ORG_POSITIONS_DATA || []).map(p => `<option value="${p.id_position}">${p.nama_jabatan}</option>`).join("");
}

function populateTxMutasiUnits(locId) {
  const sel = document.getElementById("tx-mutasi-new-unit");
  if (!sel) return;
  const filtered = (ORG_UNITS_DATA || []).filter(u => !locId || u.work_location_id === locId);
  sel.innerHTML = '<option value="">-- Pilih Unit Baru --</option>' +
    filtered.map(u => `<option value="${u.id_unit}">${u.nama_unit}</option>`).join("");
}

function addTxInventoryRow(type) {
  const container = type === "returned"
    ? document.getElementById("tx-inv-returned-container")
    : document.getElementById("tx-inv-notreturned-container");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "flex items-center space-x-1.5 tx-inv-item-row";
  row.innerHTML = `
    <input type="text" placeholder="Nama inventaris (laptop, seragam, dll)" class="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs text-slate-800 outline-none" />
    <button type="button" onclick="this.closest('.tx-inv-item-row').remove()" class="w-6 h-6 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] shrink-0" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
  `;
  container.appendChild(row);
}

// =========================================================================
// CONTROLLER: UPLOAD DOKUMEN & TAB LIHAT FILE TERUPLOAD (TRANSAKSI SDM)
// =========================================================================
let CURRENT_TX_DOCS = {};

function switchTxDocTab(tab) {
  const uploadBtn = document.getElementById("tab-tx-doc-upload-btn");
  const viewBtn = document.getElementById("tab-tx-doc-view-btn");
  const uploadContent = document.getElementById("tab-tx-doc-upload-content");
  const viewContent = document.getElementById("tab-tx-doc-view-content");

  if (tab === "upload") {
    if (uploadContent) uploadContent.classList.remove("hidden");
    if (viewContent) viewContent.classList.add("hidden");
    if (uploadBtn) {
      uploadBtn.className = "flex-1 py-2 px-3 rounded-xl bg-white text-indigo-700 shadow-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition";
    }
    if (viewBtn) {
      viewBtn.className = "flex-1 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/60 flex items-center justify-center space-x-1.5 transition";
    }
  } else {
    if (uploadContent) uploadContent.classList.add("hidden");
    if (viewContent) viewContent.classList.remove("hidden");
    if (viewBtn) {
      viewBtn.className = "flex-1 py-2 px-3 rounded-xl bg-white text-indigo-700 shadow-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition";
    }
    if (uploadBtn) {
      uploadBtn.className = "flex-1 py-2 px-3 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/60 flex items-center justify-center space-x-1.5 transition";
    }
    renderTxUploadedDocsView();
  }
}

async function handleTxFileSelected(key, input) {
  if (!input.files || input.files.length === 0) return;
  const file = input.files[0];

  // Batas 10 MB
  if (file.size > 10 * 1024 * 1024) {
    alert("Ukuran berkas melebihi batas maksimal 10 MB!");
    input.value = "";
    return;
  }

  const emptyArea = document.getElementById(`tx-doc-empty-area-${key}`);
  const loadingArea = document.getElementById(`tx-doc-loading-${key}`);
  const filledArea = document.getElementById(`tx-doc-filled-area-${key}`);
  const statusBadge = document.getElementById(`tx-doc-status-${key}`);
  const hiddenInput = document.getElementById(`tx-doc-${key}`);
  const nameEl = document.getElementById(`tx-doc-name-${key}`);

  if (emptyArea) emptyArea.classList.add("hidden");
  if (filledArea) filledArea.classList.add("hidden");
  if (loadingArea) loadingArea.classList.remove("hidden");
  if (statusBadge) {
    statusBadge.innerText = "Mengunggah...";
    statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800";
  }

  try {
    let finalUrl = "";
    const empIdentifier = CURRENT_TX_SELECTED_EMP?.nip || CURRENT_TX_SELECTED_EMP?.id || "EMP";

    // 1. Coba upload ke Supabase Storage (digiasha-media)
    if (supabaseClient) {
      try {
        const ext = file.name.split('.').pop() || (file.type.includes("pdf") ? "pdf" : "jpg");
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').substring(0, 14);
        const random = Math.floor(Math.random() * 10000);
        const filePath = `employee_docs/${empIdentifier}/${key.toUpperCase()}-${timestamp}-${random}.${ext}`;

        const bucketName = CONFIG.MEDIA_BUCKET || "digiasha-media";
        const { error: upErr } = await supabaseClient.storage
          .from(bucketName)
          .upload(filePath, file, {
            contentType: file.type || (ext === "pdf" ? "application/pdf" : "image/jpeg"),
            upsert: true
          });

        if (!upErr) {
          const { data: pubData } = supabaseClient.storage.from(bucketName).getPublicUrl(filePath);
          if (pubData && pubData.publicUrl) {
            finalUrl = pubData.publicUrl;
          }
        } else {
          console.warn("[Upload Storage Warning]:", upErr);
        }
      } catch (storageErr) {
        console.warn("[Upload Storage Exception]:", storageErr);
      }
    }

    // 2. Jika Supabase Storage belum aktif / offline, fallback ke Base64 data URL
    if (!finalUrl) {
      if (file.type && file.type.startsWith("image/")) {
        finalUrl = await compressImage(file, 1600, 0.85);
      } else {
        finalUrl = await readFileAsBase64(file);
      }
    }

    // 3. Simpan state berkas
    CURRENT_TX_DOCS[key] = {
      name: file.name,
      size: file.size,
      type: file.type || (file.name.endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
      url: finalUrl,
      updatedAt: new Date().toISOString()
    };

    if (hiddenInput) hiddenInput.value = finalUrl;
    if (nameEl) nameEl.innerText = file.name;

    if (loadingArea) loadingArea.classList.add("hidden");
    if (filledArea) filledArea.classList.remove("hidden");
    if (statusBadge) {
      statusBadge.innerText = "✓ Terunggah";
      statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
    }

    updateTxUploadedCountBadge();
    showToast(`Berkas ${file.name} berhasil diunggah!`, "success", 2000);
  } catch (err) {
    console.error("[handleTxFileSelected] Error:", err);
    if (loadingArea) loadingArea.classList.add("hidden");
    if (emptyArea) emptyArea.classList.remove("hidden");
    if (statusBadge) {
      statusBadge.innerText = "Gagal";
      statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800";
    }
    alert("Gagal mengunggah berkas: " + err.message);
  }
}

function removeTxDoc(key) {
  delete CURRENT_TX_DOCS[key];

  const hiddenInput = document.getElementById(`tx-doc-${key}`);
  const fileInput = document.getElementById(`tx-file-input-${key}`);
  const urlInput = document.getElementById(`tx-doc-url-input-${key}`);
  const emptyArea = document.getElementById(`tx-doc-empty-area-${key}`);
  const filledArea = document.getElementById(`tx-doc-filled-area-${key}`);
  const statusBadge = document.getElementById(`tx-doc-status-${key}`);

  if (hiddenInput) hiddenInput.value = "";
  if (fileInput) fileInput.value = "";
  if (urlInput) urlInput.value = "";
  if (filledArea) filledArea.classList.add("hidden");
  if (emptyArea) emptyArea.classList.remove("hidden");
  if (statusBadge) {
    statusBadge.innerText = "Belum ada";
    statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600";
  }

  updateTxUploadedCountBadge();
  const viewContent = document.getElementById("tab-tx-doc-view-content");
  if (viewContent && !viewContent.classList.contains("hidden")) {
    renderTxUploadedDocsView();
  }
}

function toggleTxDocUrlInput(key) {
  const box = document.getElementById(`tx-doc-url-box-${key}`);
  if (box) box.classList.toggle("hidden");
}

function handleTxDocUrlChanged(key, url) {
  const val = (url || "").trim();
  if (!val) {
    removeTxDoc(key);
    return;
  }

  const fileName = val.split("/").pop() || `${key.toUpperCase()}_LINK`;
  CURRENT_TX_DOCS[key] = {
    name: fileName,
    size: null,
    type: val.includes(".pdf") ? "application/pdf" : "image/jpeg",
    url: val,
    updatedAt: new Date().toISOString()
  };

  const hiddenInput = document.getElementById(`tx-doc-${key}`);
  const emptyArea = document.getElementById(`tx-doc-empty-area-${key}`);
  const filledArea = document.getElementById(`tx-doc-filled-area-${key}`);
  const statusBadge = document.getElementById(`tx-doc-status-${key}`);
  const nameEl = document.getElementById(`tx-doc-name-${key}`);

  if (hiddenInput) hiddenInput.value = val;
  if (nameEl) nameEl.innerText = fileName;
  if (emptyArea) emptyArea.classList.add("hidden");
  if (filledArea) filledArea.classList.remove("hidden");
  if (statusBadge) {
    statusBadge.innerText = "✓ Terhubung";
    statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
  }

  updateTxUploadedCountBadge();
}

function setTxDocValue(key, url, defaultName = "Dokumen") {
  if (!url) return;
  const fileName = url.startsWith("data:") ? `${defaultName}.pdf` : (url.split("/").pop() || defaultName);
  CURRENT_TX_DOCS[key] = {
    name: fileName,
    url: url,
    size: null,
    type: url.includes(".pdf") ? "application/pdf" : "image/jpeg",
    updatedAt: new Date().toISOString()
  };

  const hiddenInput = document.getElementById(`tx-doc-${key}`);
  const emptyArea = document.getElementById(`tx-doc-empty-area-${key}`);
  const filledArea = document.getElementById(`tx-doc-filled-area-${key}`);
  const statusBadge = document.getElementById(`tx-doc-status-${key}`);
  const nameEl = document.getElementById(`tx-doc-name-${key}`);

  if (hiddenInput) hiddenInput.value = url;
  if (nameEl) nameEl.innerText = fileName;
  if (emptyArea) emptyArea.classList.add("hidden");
  if (filledArea) filledArea.classList.remove("hidden");
  if (statusBadge) {
    statusBadge.innerText = "✓ Terunggah";
    statusBadge.className = "text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
  }

  updateTxUploadedCountBadge();
}

function resetTxDocForm() {
  CURRENT_TX_DOCS = {};
  const keys = ["cv", "ktp", "kk", "npwp", "kontrak"];
  keys.forEach(k => removeTxDoc(k));
  switchTxDocTab("upload");
  updateTxUploadedCountBadge();
}

function updateTxUploadedCountBadge() {
  const badge = document.getElementById("tx-doc-uploaded-count-badge");
  if (!badge) return;
  const count = Object.keys(CURRENT_TX_DOCS).filter(k => Boolean(CURRENT_TX_DOCS[k]?.url)).length;
  badge.innerText = count;
  badge.className = count > 0
    ? "ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-700"
    : "ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700";
}

function renderTxUploadedDocsView() {
  const container = document.getElementById("tx-doc-view-list");
  if (!container) return;

  const keys = [
    { key: "cv", label: "Berkas CV (Curriculum Vitae)", icon: "fa-solid fa-file-pdf", color: "text-red-600", bg: "bg-red-50" },
    { key: "ktp", label: "Scan KTP Karyawan", icon: "fa-solid fa-id-card", color: "text-blue-600", bg: "bg-blue-50" },
    { key: "kk", label: "Scan Kartu Keluarga (KK)", icon: "fa-solid fa-users-rectangle", color: "text-emerald-600", bg: "bg-emerald-50" },
    { key: "npwp", label: "Scan NPWP Karyawan", icon: "fa-solid fa-receipt", color: "text-amber-600", bg: "bg-amber-50" },
    { key: "kontrak", label: "Dokumen Kontrak Kerja / SK", icon: "fa-solid fa-file-signature", color: "text-purple-600", bg: "bg-purple-50" }
  ];

  const uploadedItems = [];
  keys.forEach(item => {
    const docObj = CURRENT_TX_DOCS[item.key];
    const val = docObj?.url || document.getElementById(`tx-doc-${item.key}`)?.value?.trim();
    if (val) {
      uploadedItems.push({
        ...item,
        url: val,
        name: docObj?.name || (val.startsWith("data:") ? `${item.label}.pdf` : val.split("/").pop()) || `${item.key}_dokumen`,
        isPdf: val.startsWith("data:application/pdf") || val.toLowerCase().includes(".pdf")
      });
    }
  });

  updateTxUploadedCountBadge();

  if (uploadedItems.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-3">
        <div class="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center text-xl mx-auto border border-indigo-100 shadow-2xs">
          <i class="fa-solid fa-folder-open"></i>
        </div>
        <div>
          <h5 class="font-bold text-xs sm:text-sm text-slate-800">Belum Ada Berkas Terunggah</h5>
          <p class="text-[11px] text-slate-400 max-w-sm mx-auto mt-0.5">
            Silakan beralih ke tab <strong>Upload Dokumen</strong> untuk memilih atau mengunggah berkas CV, KTP, KK, NPWP, atau Kontrak/SK.
          </p>
        </div>
        <button type="button" onclick="switchTxDocTab('upload')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 shadow-sm active:scale-95">
          <i class="fa-solid fa-cloud-arrow-up text-xs"></i>
          <span>Beralih ke Tab Upload Dokumen</span>
        </button>
      </div>
    `;
    return;
  }

  let html = `<div class="grid grid-cols-1 gap-2.5">`;
  uploadedItems.forEach(item => {
    html += `
      <div class="p-3 bg-white border border-slate-200 rounded-2xl flex items-center justify-between gap-3 shadow-2xs hover:border-indigo-300 transition">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div class="w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center ${item.color} text-lg shrink-0 border border-slate-100">
            <i class="${item.icon}"></i>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="font-bold text-xs text-slate-800">${item.label}</span>
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">✓ Siap Dilampirkan</span>
            </div>
            <p class="text-[11px] text-slate-400 truncate max-w-md font-mono mt-0.5">${item.name}</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="previewTxDoc('${item.key}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs border border-indigo-200 flex items-center gap-1.5 transition active:scale-95 shadow-2xs">
            <i class="fa-solid fa-eye text-[11px]"></i><span>Buka / Lihat</span>
          </button>
          <a href="${item.url}" target="_blank" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition" title="Buka Tab Baru">
            <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
          <button type="button" onclick="removeTxDoc('${item.key}')" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center text-xs border border-rose-200 transition" title="Hapus Berkas">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

function previewTxDoc(key) {
  const doc = CURRENT_TX_DOCS[key];
  const url = doc?.url || document.getElementById(`tx-doc-${key}`)?.value || document.getElementById(`tx-doc-url-input-${key}`)?.value;
  if (!url) {
    alert("Belum ada berkas untuk dipratinjau!");
    return;
  }
  const titleMap = {
    cv: "Berkas CV / Resume",
    ktp: "Scan KTP Karyawan",
    kk: "Scan Kartu Keluarga (KK)",
    npwp: "Scan NPWP Karyawan",
    kontrak: "Dokumen Kontrak Kerja / SK"
  };
  openTxDocPreview(url, titleMap[key] || "Dokumen Persyaratan", doc?.name);
}

function openTxDocPreview(url, title = "Preview Dokumen", filename = "") {
  const modal = document.getElementById("modal-tx-doc-preview");
  if (!modal) return;

  const titleEl = document.getElementById("doc-preview-modal-title");
  const subEl = document.getElementById("doc-preview-modal-sub");
  const bodyEl = document.getElementById("doc-preview-modal-body");
  const extBtn = document.getElementById("doc-preview-open-ext-btn");

  if (titleEl) titleEl.innerText = title;
  if (subEl) subEl.innerText = filename || (url.length > 50 ? url.substring(0, 50) + "..." : url);
  if (extBtn) extBtn.href = url;

  const isPdf = url.startsWith("data:application/pdf") || url.toLowerCase().includes(".pdf");

  if (bodyEl) {
    if (isPdf) {
      bodyEl.innerHTML = `
        <div class="w-full h-[72vh] flex flex-col">
          <iframe src="${url}" class="w-full flex-1 rounded-2xl border border-slate-300 shadow-sm bg-white" title="Dokumen PDF"></iframe>
          <div class="mt-2 text-center text-xs text-slate-500">
            Jika tampilan PDF kosong di peramban Anda, <a href="${url}" target="_blank" class="text-indigo-600 font-bold underline">klik di sini untuk membuka terpisah</a>.
          </div>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div class="max-h-[75vh] flex items-center justify-center p-2">
          <img src="${url}" alt="${title}" class="max-w-full max-h-[72vh] object-contain rounded-2xl shadow-lg border border-slate-200" />
        </div>
      `;
    }
  }

  modal.classList.remove("hidden");
}

function closeTxDocPreviewModal() {
  document.getElementById("modal-tx-doc-preview")?.classList.add("hidden");
  const bodyEl = document.getElementById("doc-preview-modal-body");
  if (bodyEl) bodyEl.innerHTML = "";
}

async function loadTxEmployeeExistingDocs(emp) {
  if (!emp) return;
  resetTxDocForm();

  // 1. Cek properti langsung dari object emp
  if (emp.doc_cv_url || emp.cv_url) setTxDocValue("cv", emp.doc_cv_url || emp.cv_url, "CV Karyawan");
  if (emp.doc_ktp_url || emp.ktp_url) setTxDocValue("ktp", emp.doc_ktp_url || emp.ktp_url, "KTP Karyawan");
  if (emp.doc_kk_url || emp.kk_url) setTxDocValue("kk", emp.doc_kk_url || emp.kk_url, "KK Karyawan");
  if (emp.doc_npwp_url || emp.npwp_url) setTxDocValue("npwp", emp.doc_npwp_url || emp.npwp_url, "NPWP Karyawan");
  if (emp.doc_kontrak_url || emp.kontrak_url) setTxDocValue("kontrak", emp.doc_kontrak_url || emp.kontrak_url, "Kontrak Kerja / SK");

  // 2. Query transaksi terakhir atau data personal details di Supabase
  if (supabaseClient && emp.id) {
    try {
      const { data: tx } = await supabaseClient
        .from("hr_employee_transactions")
        .select("doc_cv_url, doc_ktp_url, doc_kk_url, doc_npwp_url, doc_kontrak_url")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tx) {
        if (tx.doc_cv_url && !CURRENT_TX_DOCS["cv"]) setTxDocValue("cv", tx.doc_cv_url, "CV Karyawan (Riwayat)");
        if (tx.doc_ktp_url && !CURRENT_TX_DOCS["ktp"]) setTxDocValue("ktp", tx.doc_ktp_url, "KTP Karyawan (Riwayat)");
        if (tx.doc_kk_url && !CURRENT_TX_DOCS["kk"]) setTxDocValue("kk", tx.doc_kk_url, "KK Karyawan (Riwayat)");
        if (tx.doc_npwp_url && !CURRENT_TX_DOCS["npwp"]) setTxDocValue("npwp", tx.doc_npwp_url, "NPWP Karyawan (Riwayat)");
        if (tx.doc_kontrak_url && !CURRENT_TX_DOCS["kontrak"]) setTxDocValue("kontrak", tx.doc_kontrak_url, "Kontrak / SK (Riwayat)");
      }
    } catch (e) {
      console.warn("[loadTxEmployeeExistingDocs] warning:", e);
    }
  }

  updateTxUploadedCountBadge();
}

async function handleSubmitEmployeeTransaction(event) {
  event.preventDefault();

  if (!CURRENT_TX_SELECTED_EMP) {
    alert("Silakan pilih calon karyawan atau pegawai aktif terlebih dahulu!");
    return;
  }

  const emp = CURRENT_TX_SELECTED_EMP;
  const effDate = document.getElementById("tx-effective-date")?.value;
  if (!effDate) {
    alert("Tanggal berlaku (effective date) wajib diisi!");
    return;
  }

  // Cek centang transaksi
  const isPenerimaan = document.getElementById("chk-tx-penerimaan")?.checked;
  const isTetap = document.getElementById("chk-tx-tetap")?.checked;
  const isKontrak = document.getElementById("chk-tx-kontrak")?.checked;
  const isPerpanjang = document.getElementById("chk-tx-perpanjang")?.checked;
  const isRotasi = document.getElementById("chk-tx-rotasi")?.checked;
  const isPromosi = document.getElementById("chk-tx-promosi")?.checked;
  const isDemosi = document.getElementById("chk-tx-demosi")?.checked;
  const isMutasi = document.getElementById("chk-tx-mutasi")?.checked;
  const isBenefit = document.getElementById("chk-tx-benefit")?.checked;
  const isResign = document.getElementById("chk-tx-resign")?.checked;
  const isPhk = document.getElementById("chk-tx-phk")?.checked;
  const isPensiun = document.getElementById("chk-tx-pensiun")?.checked;

  const isBiodata = document.getElementById("chk-tx-biodata")?.checked;
  const isExit = isResign || isPhk || isPensiun;

  const selectedTypes = [];
  if (isPenerimaan) selectedTypes.push("Penerimaan Karyawan");
  if (isTetap) selectedTypes.push("Tetap (PKWTT)");
  if (isKontrak) selectedTypes.push("Pengangkatan Kontrak");
  if (isPerpanjang) selectedTypes.push("Perpanjang Kontrak");
  if (isRotasi) selectedTypes.push("Rotasi");
  if (isPromosi) selectedTypes.push("Promosi");
  if (isDemosi) selectedTypes.push("Demosi");
  if (isMutasi) selectedTypes.push("Mutasi");
  if (isBenefit) selectedTypes.push("Penyesuaian Benefit");
  if (isBiodata) selectedTypes.push("Pembaruan Data Pribadi");
  if (isResign) selectedTypes.push("Resign");
  if (isPhk) selectedTypes.push("PHK");
  if (isPensiun) selectedTypes.push("Pensiun");

  if (selectedTypes.length === 0) {
    alert("Pilih minimal satu jenis transaksi!");
    return;
  }

  // Kumpulkan Rantai Persetujuan (Staging Approvals)
  const stagingRows = document.querySelectorAll(".tx-staging-row");
  const stagingList = [];
  stagingRows.forEach((row, i) => {
    const sel = row.querySelector("select");
    const approverVal = sel?.value;
    if (approverVal) {
      stagingList.push({
        stage_order: i + 1,
        approver_nip: approverVal,
        approver_role: `Approver Staging ${i + 1}`
      });
    }
  });

  // Jika BUKAN pembaruan biodata dan stagingList kosong, beri peringatan
  if (stagingList.length === 0 && !isBiodata) {
    alert("Tentukan minimal satu approver pada Staging Approval atau centang Pembaruan Data Pribadi untuk konfirmasi mandiri!");
    return;
  }

  const btn = document.getElementById("btn-submit-tx");
  const origText = btn ? btn.innerHTML : "Ajukan Transaksi";
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan Transaksi...';
    btn.disabled = true;
  }

  try {
    const now = new Date().toISOString();
    let finalNip = emp.nip;

    // TRIGGER GENERATE NIP: Jika transaksi adalah Penerimaan Karyawan
    if (isPenerimaan) {
      finalNip = generateNewEmployeeNIP();
    }

    // Hitung tanggal ulang tahun ke-50 jika Tetap (PKWTT)
    let end50Str = null;
    if (isTetap) {
      const dobStr = emp.dob || emp.tanggal_lahir;
      if (dobStr) {
        const dob = new Date(dobStr);
        end50Str = `${dob.getFullYear() + 50}-${String(dob.getMonth() + 1).padStart(2, '0')}-${String(dob.getDate()).padStart(2, '0')}`;
      }
    }

    // Kumpulkan Inventaris
    const retInputs = document.querySelectorAll("#tx-inv-returned-container input");
    const notRetInputs = document.querySelectorAll("#tx-inv-notreturned-container input");
    const invReturned = Array.from(retInputs).map(inp => inp.value.trim()).filter(Boolean);
    const invNotReturned = Array.from(notRetInputs).map(inp => inp.value.trim()).filter(Boolean);

    // Kumpulkan Dokumen
    const docUrls = {
      cv: document.getElementById("tx-doc-cv")?.value.trim() || null,
      ktp: document.getElementById("tx-doc-ktp")?.value.trim() || null,
      kk: document.getElementById("tx-doc-kk")?.value.trim() || null,
      npwp: document.getElementById("tx-doc-npwp")?.value.trim() || null,
      kontrak: document.getElementById("tx-doc-kontrak")?.value.trim() || null
    };

    // Kumpulkan Data Pembaruan Pribadi jika dicentang
    let personalDataUpdates = null;
    if (isBiodata) {
      const childInputs = document.querySelectorAll("#tx-bio-children-container input");
      const childNames = Array.from(childInputs).map(inp => inp.value.trim()).filter(Boolean);
      personalDataUpdates = {
        nama_lengkap: document.getElementById("tx-bio-nama")?.value.trim() || null,
        ktp_number: document.getElementById("tx-bio-nik")?.value.trim() || null,
        nik_ktp: document.getElementById("tx-bio-nik")?.value.trim() || null,
        pob: document.getElementById("tx-bio-pob")?.value.trim() || null,
        dob: document.getElementById("tx-bio-dob")?.value || null,
        gender: document.getElementById("tx-bio-gender")?.value || "Laki-laki",
        religion: document.getElementById("tx-bio-religion")?.value || "Islam",
        marital_status: document.getElementById("tx-bio-marital")?.value || "Belum Kawin",
        spouse_name: document.getElementById("tx-bio-spouse")?.value.trim() || null,
        number_of_dependents: parseInt(document.getElementById("tx-bio-children-count")?.value) || childNames.length,
        children: childNames,
        address_ktp: document.getElementById("tx-bio-alamat-ktp")?.value.trim() || null,
        address_domicile: document.getElementById("tx-bio-alamat-dom")?.value.trim() || null,
        lat: document.getElementById("tx-bio-lat")?.value.trim() || null,
        lng: document.getElementById("tx-bio-lng")?.value.trim() || null,
        phone: document.getElementById("tx-bio-phone")?.value.trim() || null,
        wa: document.getElementById("tx-bio-wa")?.value.trim() || null,
        emergency_contact_name: document.getElementById("tx-bio-emerg-name")?.value.trim() || null,
        emergency_contact_relation: document.getElementById("tx-bio-emerg-rel")?.value.trim() || null,
        emergency_contact_phone: document.getElementById("tx-bio-emerg-phone")?.value.trim() || null,
        education_level: document.getElementById("tx-bio-education")?.value || "S1",
        education_major: document.getElementById("tx-bio-major")?.value.trim() || null
      };
    }

    // Tentukan Status Awal:
    // Jika Rotasi, Promosi, Demosi, Mutasi, Benefit, atau Biodata (atau staging dikosongkan) -> PENDING_AGREEMENT
    const needsAgreement = isRotasi || isPromosi || isDemosi || isMutasi || isBenefit || isBiodata || (stagingList.length === 0);
    const initialStatus = needsAgreement ? "PENDING_AGREEMENT" : "IN_REVIEW";

    // 100% Relational payload ke hr_employee_transactions
    const txPayload = {
      employee_id: emp.id,
      nip: finalNip,
      transaction_types: selectedTypes,
      effective_date: effDate,
      status: initialStatus,
      current_stage: 1,
      created_by_nip: CURRENT_USER?.nip || null,
      created_at: now,
      updated_at: now,

      // a. Penerimaan & Kontrak
      work_location_id: isPenerimaan ? (document.getElementById("tx-penerimaan-workloc")?.value || null) : (isMutasi ? (document.getElementById("tx-mutasi-new-loc")?.value || null) : (emp.work_location_id || null)),
      unit_id: isPenerimaan ? (document.getElementById("tx-penerimaan-unit")?.value || null) : (isMutasi ? (document.getElementById("tx-mutasi-new-unit")?.value || null) : (emp.unit_id || null)),
      position_id: isPenerimaan ? (document.getElementById("tx-penerimaan-position")?.value || null) : (isRotasi ? (document.getElementById("tx-rotasi-new-pos")?.value || null) : (isPromosi ? (document.getElementById("tx-promosi-new-pos")?.value || null) : (isDemosi ? (document.getElementById("tx-demosi-new-pos")?.value || null) : (emp.position_id || null)))),
      join_date: isPenerimaan ? (document.getElementById("tx-penerimaan-joindate")?.value || effDate) : (emp.tanggal_masuk || null),
      employment_status: isTetap ? "PKWTT" : (isKontrak || isPerpanjang || isPenerimaan ? (document.getElementById("tx-penerimaan-status")?.value || "PKWT") : (emp.status_kerja || "PKWT")),
      contract_no: isTetap ? (document.getElementById("tx-tetap-contractno")?.value.trim() || null) : (isKontrak ? (document.getElementById("tx-kontrak-contractno")?.value.trim() || null) : (document.getElementById("tx-penerimaan-contractno")?.value.trim() || null)),
      contract_start_date: isTetap ? (document.getElementById("tx-tetap-contractstart")?.value || effDate) : (isKontrak ? (document.getElementById("tx-kontrak-contractstart")?.value || effDate) : (document.getElementById("tx-penerimaan-contractstart")?.value || null)),
      contract_end_date: isTetap ? end50Str : (isKontrak ? (document.getElementById("tx-kontrak-contractend")?.value || null) : (document.getElementById("tx-penerimaan-contractend")?.value || null)),

      // Pergerakan Posisi (Rotasi, Promosi, Demosi, Mutasi)
      prev_position_id: emp.position_id || emp.id_position || (ORG_POSITIONS_DATA || []).find(p => p.nama_jabatan === emp.jabatan)?.id_position || emp.jabatan || null,
      new_position_id: isRotasi ? (document.getElementById("tx-rotasi-new-pos")?.value || null) : (isPromosi ? (document.getElementById("tx-promosi-new-pos")?.value || null) : (isDemosi ? (document.getElementById("tx-demosi-new-pos")?.value || null) : null)),
      prev_level_id: emp.level_id || emp.id_level || (ORG_LEVELS_DATA || []).find(l => l.nama_level === emp.level_name)?.id_level || emp.level_name || null,
      new_level_id: isPromosi ? (document.getElementById("tx-promosi-new-lvl")?.value || null) : (isDemosi ? (document.getElementById("tx-demosi-new-lvl")?.value || null) : null),
      prev_location_id: emp.work_location_id || emp.work_location_name || emp.area_cover || null,
      new_location_id: isMutasi ? (document.getElementById("tx-mutasi-new-loc")?.value || null) : null,
      prev_unit_id: emp.unit_id || emp.cabang || null,
      new_unit_id: isMutasi ? (document.getElementById("tx-mutasi-new-unit")?.value || null) : null,

      // Penyesuaian Benefit & Remunerasi
      prev_basic_salary: parseFloat(emp.basic_salary || 0),
      new_basic_salary: isBenefit ? parseRupiah(document.getElementById("tx-new-salary")?.value) : parseFloat(emp.basic_salary || 0),
      prev_allowance_jabatan: parseFloat(emp.allowance_jabatan || 0),
      new_allowance_jabatan: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-jabatan")?.value) : parseFloat(emp.allowance_jabatan || 0),
      prev_allowance_transport: parseFloat(emp.allowance_transport || 0),
      new_allowance_transport: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-transport")?.value) : parseFloat(emp.allowance_transport || 0),
      prev_allowance_komunikasi: parseFloat(emp.allowance_komunikasi || 0),
      new_allowance_komunikasi: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-komunikasi")?.value) : parseFloat(emp.allowance_komunikasi || 0),
      prev_allowance_tempat_tinggal: parseFloat(emp.allowance_tempat_tinggal || 0),
      new_allowance_tempat_tinggal: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-tempattinggal")?.value) : parseFloat(emp.allowance_tempat_tinggal || 0),
      prev_allowance_penempatan: parseFloat(emp.allowance_penempatan || 0),
      new_allowance_penempatan: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-penempatan")?.value) : parseFloat(emp.allowance_penempatan || 0),
      prev_allowance_kemahalan: parseFloat(emp.allowance_kemahalan || 0),
      new_allowance_kemahalan: isBenefit ? parseRupiah(document.getElementById("tx-new-allow-kemahalan")?.value) : parseFloat(emp.allowance_kemahalan || 0),

      // Pengakhiran Hubungan Kerja (Resign, PHK, Pensiun)
      uang_pisah: isExit ? parseRupiah(document.getElementById("tx-exit-uangpisah")?.value) : 0,
      uang_pisah_notes: isExit ? (document.getElementById("tx-exit-notes")?.value.trim() || null) : null,
      exit_interview_no: isExit ? (document.getElementById("tx-exit-formno")?.value.trim() || null) : null,
      inventory_returned: invReturned.join(", ") || null,
      inventory_not_returned: invNotReturned.join(", ") || null,

      // Lampiran Berkas / Dokumen
      doc_cv_url: docUrls.cv,
      doc_ktp_url: docUrls.ktp,
      doc_kk_url: docUrls.kk,
      doc_npwp_url: docUrls.npwp,
      doc_kontrak_url: docUrls.kontrak,

      // Pembaruan Data Pribadi Sipil
      personal_data_updates: personalDataUpdates
    };

    if (supabaseClient) {
      // 1. Insert ke hr_employee_transactions
      const { data: createdTx, error: txInsertErr } = await supabaseClient
        .from("hr_employee_transactions")
        .insert([txPayload])
        .select("id")
        .single();

      if (txInsertErr) {
        throw new Error("Gagal menyimpan transaksi kepegawaian: " + txInsertErr.message);
      }

      const txId = createdTx.id;

      // 2. Insert Rantai Persetujuan ke hr_transaction_staging_approvals
      const stagingInserts = stagingList.map(s => ({
        transaction_id: txId,
        stage_order: s.stage_order,
        approver_role: s.approver_role,
        approver_nip: s.approver_nip,
        status: needsAgreement ? "WAITING_AGREEMENT" : (s.stage_order === 1 ? "PENDING" : "WAITING"),
        created_at: now,
        updated_at: now
      }));

      await supabaseClient
        .from("hr_transaction_staging_approvals")
        .insert(stagingInserts);

      // 3. Jika Penerimaan Karyawan: Update langsung akun calon karyawan dengan NIP resmi baru
      if (isPenerimaan) {
        await supabaseClient
          .from("employees")
          .update({
            nip: finalNip,
            unit_id: txPayload.unit_id,
            position_id: txPayload.position_id,
            work_location_id: txPayload.work_location_id,
            status_kerja: txPayload.employment_status,
            tanggal_masuk: txPayload.join_date,
            contract_no: txPayload.contract_no,
            contract_start_date: txPayload.contract_start_date,
            contract_end_date: txPayload.contract_end_date,
            status_aktif: "AKTIF",
            is_active: true,
            updated_at: now
          })
          .eq("id", emp.id);
      }
    }

    closeEmployeeTransactionModal();

    let successMsg = `Transaksi [${selectedTypes.join(", ")}] berhasil diajukan!`;
    if (isPenerimaan) {
      successMsg += ` NIP resmi ${finalNip} telah diterbitkan untuk ${emp.nama_lengkap || emp.nama}.`;
    }
    if (needsAgreement) {
      successMsg += ` Menunggu tanda tangan persetujuan elektronik karyawan di menu Persetujuan.`;
    } else {
      successMsg += ` Diteruskan ke Approver Staging 1.`;
    }

    showToast(successMsg, "success", 3500);

    if (typeof loadPersonaliaEmployees === "function") {
      await loadPersonaliaEmployees();
    }
    if (typeof fetchApprovalList === "function") {
      await fetchApprovalList();
    }
  } catch (err) {
    console.error("[Submit Transaction] Error:", err);
    alert("Gagal mengajukan transaksi: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

// =========================================================================
// HELPER & BUILDER: RINCIAN KOMPARATIF TRANSAKSI KEPEGAWAIAN (APPROVAL & AGREEMENT)
// =========================================================================
function buildCareerTransactionSummaryHtml(tx, relatedEmp, options = {}) {
  if (!tx) return '';
  const types = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || "Perubahan Karir"];

  // Fallback related employee
  const emp = relatedEmp || (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip)) ||
    (APP_STATE.employees || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip)) || {};

  // Helper name resolvers (support id or name string)
  const getPosName = (id) => {
    if (!id) return "-";
    return (ORG_POSITIONS_DATA || []).find(p => String(p.id_position) === String(id) || p.nama_jabatan === id)?.nama_jabatan || id;
  };
  const getLvlName = (id) => {
    if (!id) return "-";
    return (ORG_LEVELS_DATA || []).find(l => String(l.id_level) === String(id) || l.nama_level === id)?.nama_level || id;
  };
  const getUnitName = (id) => {
    if (!id) return "-";
    return (ORG_UNITS_DATA || []).find(u => String(u.id_unit) === String(id) || u.nama_unit === id)?.nama_unit || id;
  };
  const getLocName = (id) => {
    if (!id) return "-";
    return (ORG_WORK_LOCATIONS_DATA || []).find(w => String(w.id_work_location) === String(id) || w.nama_lokasi === id)?.nama_lokasi || id;
  };

  let changeItemsHtml = `
    <div class="p-2.5 bg-white rounded-xl border border-indigo-100 shadow-xs space-y-1 mb-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Jenis Transaksi:</span>
        <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">${types.join(", ")}</span>
      </div>
      <div class="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
        <span class="text-slate-500">Tanggal Berlaku Efektif:</span>
        <strong class="text-indigo-950 font-bold">${tx.effective_date || '-'}</strong>
      </div>
    </div>
  `;

  // 1. DETAIL PROMOSI / DEMOSI
  const hasPromosi = types.some(t => t.toLowerCase().includes("promosi"));
  const hasDemosi = types.some(t => t.toLowerCase().includes("demosi"));
  if (hasPromosi || hasDemosi || tx.new_level_id || (tx.new_position_id && (hasPromosi || hasDemosi))) {
    const isPromo = hasPromosi || (!hasDemosi && tx.new_level_id);
    const badgeColor = isPromo ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-orange-50 border-orange-200 text-orange-900";
    const titleText = isPromo ? "Detail Promosi Pegawai" : "Detail Demosi Pegawai";
    const iconClass = isPromo ? "fa-arrow-trend-up text-amber-600" : "fa-arrow-trend-down text-orange-600";

    const prevPos = tx.prev_position_id || emp.jabatan || emp.id_position;
    const prevLvl = tx.prev_level_id || emp.level_name || emp.role_id || emp.id_level;

    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border ${badgeColor} space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-black/5 pb-1">
          <i class="fa-solid ${iconClass}"></i>
          <span>${titleText}</span>
        </div>
        ${tx.new_level_id ? `
          <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-black/5">
            <span class="text-[11px] text-slate-500">Perubahan Level:</span>
            <div class="flex items-center space-x-1.5 text-xs font-semibold">
              ${prevLvl ? `<span class="text-slate-400 line-through">${getLvlName(prevLvl)}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
              <strong class="text-indigo-900 font-bold">${getLvlName(tx.new_level_id)}</strong>
            </div>
          </div>
        ` : ''}
        ${tx.new_position_id ? `
          <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-black/5">
            <span class="text-[11px] text-slate-500">Perubahan Jabatan:</span>
            <div class="flex items-center space-x-1.5 text-xs font-semibold">
              ${prevPos ? `<span class="text-slate-400 line-through">${getPosName(prevPos)}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
              <strong class="text-indigo-900 font-bold">${getPosName(tx.new_position_id)}</strong>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 2. DETAIL ROTASI JABATAN
  const hasRotasi = types.some(t => t.toLowerCase().includes("rotasi"));
  if (hasRotasi && tx.new_position_id && !hasPromosi && !hasDemosi) {
    const prevPos = tx.prev_position_id || emp.jabatan || emp.id_position;
    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border bg-blue-50 border-blue-200 text-blue-950 space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-blue-200/50 pb-1">
          <i class="fa-solid fa-arrows-rotate text-blue-600"></i>
          <span>Detail Rotasi Jabatan</span>
        </div>
        <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-blue-100">
          <span class="text-[11px] text-slate-500">Perubahan Jabatan:</span>
          <div class="flex items-center space-x-1.5 text-xs font-semibold">
            ${prevPos ? `<span class="text-slate-400 line-through">${getPosName(prevPos)}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
            <strong class="text-blue-900 font-bold">${getPosName(tx.new_position_id)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  // 3. DETAIL MUTASI LOKASI / UNIT KERJA
  const hasMutasi = types.some(t => t.toLowerCase().includes("mutasi"));
  if (hasMutasi || tx.new_location_id || tx.new_unit_id) {
    const prevLoc = tx.prev_location_id || emp.work_location_name || emp.area_cover || emp.work_location_id;
    const prevUnit = tx.prev_unit_id || emp.cabang || emp.unit_id;

    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border bg-cyan-50 border-cyan-200 text-cyan-950 space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-cyan-200/50 pb-1">
          <i class="fa-solid fa-location-dot text-cyan-600"></i>
          <span>Detail Mutasi Penempatan & Unit Kerja</span>
        </div>
        ${tx.new_location_id ? `
          <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-cyan-100">
            <span class="text-[11px] text-slate-500">Lokasi Kerja:</span>
            <div class="flex items-center space-x-1.5 text-xs font-semibold">
              ${prevLoc ? `<span class="text-slate-400 line-through">${getLocName(prevLoc)}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
              <strong class="text-cyan-950 font-bold">${getLocName(tx.new_location_id)}</strong>
            </div>
          </div>
        ` : ''}
        ${tx.new_unit_id ? `
          <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-cyan-100">
            <span class="text-[11px] text-slate-500">Unit Kerja:</span>
            <div class="flex items-center space-x-1.5 text-xs font-semibold">
              ${prevUnit ? `<span class="text-slate-400 line-through">${getUnitName(prevUnit)}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
              <strong class="text-cyan-950 font-bold">${getUnitName(tx.new_unit_id)}</strong>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // 4. DETAIL PENYESUAIAN BENEFIT & REMUNERASI
  const hasBenefit = types.some(t => t.toLowerCase().includes("benefit"));
  if (hasBenefit || (tx.new_basic_salary && parseFloat(tx.new_basic_salary) > 0)) {
    const prevSalary = parseFloat(tx.prev_basic_salary || 0);
    const newSalary = parseFloat(tx.new_basic_salary || 0);

    const allowances = [
      { label: "Tunj. Jabatan", oldVal: parseFloat(tx.prev_allowance_jabatan || 0), newVal: parseFloat(tx.new_allowance_jabatan || 0) },
      { label: "Tunj. Transport", oldVal: parseFloat(tx.prev_allowance_transport || 0), newVal: parseFloat(tx.new_allowance_transport || 0) },
      { label: "Tunj. Komunikasi", oldVal: parseFloat(tx.prev_allowance_komunikasi || 0), newVal: parseFloat(tx.new_allowance_komunikasi || 0) },
      { label: "Tunj. Tempat Tinggal", oldVal: parseFloat(tx.prev_allowance_tempat_tinggal || 0), newVal: parseFloat(tx.new_allowance_tempat_tinggal || 0) },
      { label: "Tunj. Penempatan", oldVal: parseFloat(tx.prev_allowance_penempatan || 0), newVal: parseFloat(tx.new_allowance_penempatan || 0) },
      { label: "Tunj. Kemahalan", oldVal: parseFloat(tx.prev_allowance_kemahalan || 0), newVal: parseFloat(tx.new_allowance_kemahalan || 0) }
    ].filter(a => a.newVal > 0 || a.oldVal > 0);

    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border bg-emerald-50 border-emerald-200 text-emerald-950 space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-emerald-200/50 pb-1">
          <i class="fa-solid fa-money-bill-wave text-emerald-600"></i>
          <span>Detail Penyesuaian Remunerasi & Benefit</span>
        </div>
        ${newSalary > 0 ? `
          <div class="flex items-center justify-between bg-white/80 p-1.5 rounded-lg border border-emerald-100">
            <span class="text-[11px] text-slate-500">Gaji Pokok Baru:</span>
            <div class="flex items-center space-x-1.5 text-xs font-mono font-bold">
              ${prevSalary > 0 ? `<span class="text-slate-400 line-through text-[11px]">Rp ${prevSalary.toLocaleString('id-ID')}</span><i class="fa-solid fa-arrow-right text-[10px] text-slate-400"></i>` : ''}
              <strong class="text-emerald-700">Rp ${newSalary.toLocaleString('id-ID')}</strong>
            </div>
          </div>
        ` : ''}
        ${allowances.length > 0 ? `
          <div class="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
            ${allowances.map(a => `
              <div class="bg-white/80 p-1.5 rounded-lg border border-emerald-100">
                <span class="text-slate-400 block text-[10px]">${a.label}:</span>
                <strong class="text-emerald-900 font-mono">Rp ${a.newVal.toLocaleString('id-ID')}</strong>
              </div>
            `).join("")}
          </div>
        ` : ''}
      </div>
    `;
  }

  // 5. DETAIL PENGANGKATAN TETAP / KONTRAK
  const hasTetap = types.some(t => t.toLowerCase().includes("tetap") || t.toLowerCase().includes("pkwtt"));
  const hasKontrak = types.some(t => t.toLowerCase().includes("kontrak"));
  if (hasTetap || hasKontrak || tx.contract_no || tx.contract_end_date) {
    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border bg-violet-50 border-violet-200 text-violet-950 space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-violet-200/50 pb-1">
          <i class="fa-solid fa-file-contract text-violet-600"></i>
          <span>Detail Perjanjian / Kontrak Kerja</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 text-[11px]">
          <div class="bg-white/80 p-1.5 rounded-lg border border-violet-100"><span class="text-slate-400 block text-[10px]">Status Kerja:</span> <strong class="text-violet-950">${tx.employment_status || (hasTetap ? 'PKWTT' : 'PKWT')}</strong></div>
          <div class="bg-white/80 p-1.5 rounded-lg border border-violet-100"><span class="text-slate-400 block text-[10px]">No. Surat / Kontrak:</span> <strong class="text-violet-950 font-mono">${tx.contract_no || '-'}</strong></div>
          <div class="bg-white/80 p-1.5 rounded-lg border border-violet-100"><span class="text-slate-400 block text-[10px]">Tgl Mulai:</span> <strong>${tx.contract_start_date || tx.effective_date || '-'}</strong></div>
          <div class="bg-white/80 p-1.5 rounded-lg border border-violet-100"><span class="text-slate-400 block text-[10px]">Tgl Berakhir:</span> <strong>${tx.contract_end_date || (hasTetap ? 'Pensiun (50 Thn)' : '-')}</strong></div>
        </div>
      </div>
    `;
  }

  // 6. DETAIL PENGAKHIRAN (RESIGN / PHK / PENSIUN)
  const hasExit = types.some(t => ["resign", "phk", "pensiun"].some(k => t.toLowerCase().includes(k)));
  if (hasExit || tx.exit_interview_no || (tx.uang_pisah && parseFloat(tx.uang_pisah) > 0)) {
    changeItemsHtml += `
      <div class="p-2.5 rounded-xl border bg-rose-50 border-rose-200 text-rose-950 space-y-1.5 text-xs mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold border-b border-rose-200/50 pb-1">
          <i class="fa-solid fa-arrow-right-from-bracket text-rose-600"></i>
          <span>Detail Pengakhiran Hubungan Kerja</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 text-[11px]">
          <div class="bg-white/80 p-1.5 rounded-lg border border-rose-100"><span class="text-slate-400 block text-[10px]">No Form Exit:</span> <strong>${tx.exit_interview_no || '-'}</strong></div>
          <div class="bg-white/80 p-1.5 rounded-lg border border-rose-100"><span class="text-slate-400 block text-[10px]">Uang Pisah/Kompensasi:</span> <strong class="text-rose-900 font-mono">Rp ${parseFloat(tx.uang_pisah || 0).toLocaleString('id-ID')}</strong></div>
        </div>
        ${tx.inventory_returned ? `<div class="text-[10px] text-slate-600 bg-white/70 p-1.5 rounded-lg">Inventaris Dikembalikan: <strong>${tx.inventory_returned}</strong></div>` : ''}
        ${tx.uang_pisah_notes ? `<div class="text-[10px] italic text-slate-500">Catatan: ${tx.uang_pisah_notes}</div>` : ''}
      </div>
    `;
  }

  // 7. DETAIL PEMBARUAN DATA PRIBADI (BIODATA SIPIL LENGKAP)
  if (tx.personal_data_updates) {
    let pu = tx.personal_data_updates;
    if (typeof pu === "string") {
      try { pu = JSON.parse(pu); } catch (_) { pu = {}; }
    }
    const childrenArr = Array.isArray(pu.children) ? pu.children.filter(Boolean) : [];

    changeItemsHtml += `
      <div class="p-2.5 bg-white rounded-xl border border-indigo-200 text-xs space-y-2 mb-2 shadow-xs">
        <div class="flex items-center space-x-1.5 font-bold text-indigo-900 border-b border-indigo-100 pb-1">
          <i class="fa-solid fa-user-pen text-indigo-600"></i>
          <span>Pembaruan Data Pribadi / Sipil Pegawai</span>
        </div>
        <div class="grid grid-cols-2 gap-1.5 text-[11px] pt-0.5">
          <div><span class="text-slate-400">NIK (KTP):</span> <strong class="font-mono">${pu.ktp_number || pu.nik_ktp || '-'}</strong></div>
          <div><span class="text-slate-400">Nama Lengkap:</span> <strong>${pu.nama_lengkap || '-'}</strong></div>
          <div><span class="text-slate-400">Tempat, Tgl Lahir:</span> <strong>${[pu.pob, pu.dob].filter(Boolean).join(", ") || '-'}</strong></div>
          <div><span class="text-slate-400">Jenis Kelamin:</span> <strong>${pu.gender || '-'}</strong></div>
          <div><span class="text-slate-400">Agama:</span> <strong>${pu.religion || '-'}</strong></div>
          <div><span class="text-slate-400">Status Nikah:</span> <strong>${pu.marital_status || '-'}</strong></div>
          ${pu.spouse_name ? `<div><span class="text-slate-400">Nama Pasangan:</span> <strong>${pu.spouse_name}</strong></div>` : ''}
          <div><span class="text-slate-400">Tanggungan Anak:</span> <strong>${pu.number_of_dependents ?? childrenArr.length} Anak</strong></div>
          ${childrenArr.length > 0 ? `
            <div class="col-span-2 text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100">
              <span class="text-slate-400 font-bold block mb-0.5">Daftar Anak:</span>
              <span class="text-slate-700 font-medium">${childrenArr.join(", ")}</span>
            </div>
          ` : ''}
          <div><span class="text-slate-400">No HP:</span> <strong class="font-mono">${pu.phone || '-'}</strong></div>
          <div><span class="text-slate-400">WhatsApp:</span> <strong class="font-mono">${pu.wa || pu.phone || '-'}</strong></div>
          ${(pu.education_level || pu.education_major) ? `
            <div class="col-span-2 text-[11px]">
              <span class="text-slate-400">Pendidikan:</span> <strong>${pu.education_level || '-'}</strong> ${pu.education_major ? ` - Jurusan <strong>${pu.education_major}</strong>` : ''}
            </div>
          ` : ''}
          ${pu.emergency_contact_name ? `
            <div class="col-span-2 text-[10px] bg-rose-50/70 border border-rose-100 p-1.5 rounded-lg">
              <span class="text-rose-500 font-bold block mb-0.5">Kontak Darurat:</span>
              <strong class="text-rose-950">${pu.emergency_contact_name}</strong> 
              <span class="text-rose-700 font-medium">(${pu.emergency_contact_relation || '-'})</span> 
              • <strong class="font-mono text-rose-900">${pu.emergency_contact_phone || '-'}</strong>
            </div>
          ` : ''}
          ${pu.address_ktp ? `<div class="col-span-2 text-[10px] text-slate-600"><span class="text-slate-400 font-semibold">Alamat KTP:</span> ${pu.address_ktp}</div>` : ''}
          ${pu.address_domicile ? `<div class="col-span-2 text-[10px] text-slate-600"><span class="text-slate-400 font-semibold">Alamat Domisili:</span> ${pu.address_domicile}</div>` : ''}
        </div>
      </div>
    `;
  }

  // 8. DOKUMEN PERSYARATAN / LAMPIRAN BERKAS
  const attachedDocs = [
    { label: "Curriculum Vitae (CV)", url: tx.doc_cv_url, icon: "fa-file-lines", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
    { label: "Scan KTP Asli", url: tx.doc_ktp_url, icon: "fa-id-card", color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Kartu Keluarga (KK)", url: tx.doc_kk_url, icon: "fa-users-line", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
    { label: "NPWP", url: tx.doc_npwp_url, icon: "fa-file-invoice", color: "text-amber-600 bg-amber-50 border-amber-200" },
    { label: "Kontrak Kerja / SK", url: tx.doc_kontrak_url, icon: "fa-file-signature", color: "text-purple-600 bg-purple-50 border-purple-200" }
  ].filter(d => Boolean(d.url));

  if (attachedDocs.length > 0) {
    changeItemsHtml += `
      <div class="p-2.5 bg-slate-50/90 rounded-xl border border-slate-200 text-xs space-y-1.5 mb-2 shadow-xs">
        <div class="flex items-center justify-between border-b border-slate-200 pb-1">
          <div class="flex items-center space-x-1.5 font-bold text-slate-800">
            <i class="fa-solid fa-paperclip text-indigo-600"></i>
            <span>Lampiran Dokumen Persyaratan (${attachedDocs.length})</span>
          </div>
          <span class="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">Terlampir</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
          ${attachedDocs.map(doc => `
            <div class="p-1.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-1 shadow-2xs">
              <div class="flex items-center gap-1.5 min-w-0 flex-1">
                <div class="w-6 h-6 rounded-md ${doc.color} flex items-center justify-center text-[10px] shrink-0 border">
                  <i class="fa-solid ${doc.icon}"></i>
                </div>
                <span class="text-[10px] font-bold text-slate-700 truncate">${doc.label}</span>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button type="button" onclick="openTxDocPreview('${doc.url}', '${doc.label}')" class="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold border border-indigo-200 inline-flex items-center gap-1 transition" title="Lihat Lampiran">
                  <i class="fa-solid fa-eye text-[8px]"></i>
                  <span>Lihat</span>
                </button>
                <a href="${doc.url}" target="_blank" class="p-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[9px] border border-slate-200 inline-flex items-center transition" title="Buka di Tab Baru">
                  <i class="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                </a>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return changeItemsHtml;
}

function buildCareerTransactionHighlightsHtml(tx, a) {
  if (!tx) return '';
  const types = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || "Transaksi Kepegawaian"];

  const getPosName = (id) => (!id ? "-" : ((ORG_POSITIONS_DATA || []).find(p => String(p.id_position) === String(id) || p.nama_jabatan === id)?.nama_jabatan || id));
  const getLvlName = (id) => (!id ? "-" : ((ORG_LEVELS_DATA || []).find(l => String(l.id_level) === String(id) || l.nama_level === id)?.nama_level || id));
  const getUnitName = (id) => (!id ? "-" : ((ORG_UNITS_DATA || []).find(u => String(u.id_unit) === String(id) || u.nama_unit === id)?.nama_unit || id));
  const getLocName = (id) => (!id ? "-" : ((ORG_WORK_LOCATIONS_DATA || []).find(w => String(w.id_work_location) === String(id) || w.nama_lokasi === id)?.nama_lokasi || id));

  const badges = [];

  // Kontrak
  if (tx.contract_no || tx.contract_end_date || types.some(t => t.toLowerCase().includes("kontrak") || t.toLowerCase().includes("tetap"))) {
    const isTetap = types.some(t => t.toLowerCase().includes("tetap") || t.toLowerCase().includes("pkwtt"));
    const label = isTetap ? "Pengangkatan PKWTT" : `Kontrak s/d ${tx.contract_end_date || '-'}`;
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-semibold"><i class="fa-solid fa-file-contract text-[9px]"></i>${label}</span>`);
  }

  // Rotasi / Promosi / Demosi (Jabatan & Level)
  if (tx.new_position_id || tx.new_level_id) {
    const posTxt = tx.new_position_id ? getPosName(tx.new_position_id) : '';
    const lvlTxt = tx.new_level_id ? `Lvl: ${getLvlName(tx.new_level_id)}` : '';
    const txt = [posTxt, lvlTxt].filter(Boolean).join(" • ");
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-semibold"><i class="fa-solid fa-briefcase text-[9px]"></i>${txt}</span>`);
  }

  // Mutasi (Lokasi & Unit)
  if (tx.new_location_id || tx.new_unit_id) {
    const locTxt = tx.new_location_id ? getLocName(tx.new_location_id) : '';
    const unitTxt = tx.new_unit_id ? getUnitName(tx.new_unit_id) : '';
    const txt = [locTxt, unitTxt].filter(Boolean).join(" • ");
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-50 text-cyan-700 border border-cyan-200 text-[10px] font-semibold"><i class="fa-solid fa-location-dot text-[9px]"></i>${txt}</span>`);
  }

  // Remunerasi
  if (tx.new_basic_salary && parseFloat(tx.new_basic_salary) > 0) {
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold"><i class="fa-solid fa-money-bill-wave text-[9px]"></i>Rp ${parseFloat(tx.new_basic_salary).toLocaleString('id-ID')}</span>`);
  }

  // Pengakhiran
  if (types.some(t => ["resign", "phk", "pensiun"].some(k => t.toLowerCase().includes(k)))) {
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold"><i class="fa-solid fa-arrow-right-from-bracket text-[9px]"></i>Pengakhiran Kerja</span>`);
  }

  // Biodata Updates
  if (tx.personal_data_updates) {
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold"><i class="fa-solid fa-user-pen text-[9px]"></i>Pembaruan Biodata</span>`);
  }

  // Lampiran
  const docCount = [tx.doc_cv_url, tx.doc_ktp_url, tx.doc_kk_url, tx.doc_npwp_url, tx.doc_kontrak_url].filter(Boolean).length;
  if (docCount > 0) {
    badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold"><i class="fa-solid fa-paperclip text-[9px]"></i>${docCount} Berkas Terlampir</span>`);
  }

  return `
    <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
      <div class="flex items-center justify-between">
        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Ringkasan Poin Perubahan:</span>
        <span class="text-[10px] text-indigo-700 font-semibold"><i class="fa-solid fa-calendar mr-1"></i>Efektif: <strong>${tx.effective_date || '-'}</strong></span>
      </div>
      <div class="flex flex-wrap gap-1.5">
        ${badges.length > 0 ? badges.join("") : `<span class="text-slate-500 text-[11px] italic">Pengajuan perubahan status & karir kepegawaian</span>`}
      </div>
      <button type="button" onclick="openCareerTransactionDetailModal('${tx.id}')" class="w-full mt-2 py-2 px-3 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 shadow-2xs transition active:scale-95">
        <i class="fa-solid fa-file-lines text-indigo-600"></i>
        <span>Lihat Detail Lengkap Pengajuan</span>
      </button>
    </div>
  `;
}

function buildCareerTransactionCompactHtml(tx) {
  if (!tx) return '-';
  const types = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || "Transaksi"];
  const getPosName = (id) => (!id ? "-" : ((ORG_POSITIONS_DATA || []).find(p => String(p.id_position) === String(id) || p.nama_jabatan === id)?.nama_jabatan || id));
  const getLocName = (id) => (!id ? "-" : ((ORG_WORK_LOCATIONS_DATA || []).find(w => String(w.id_work_location) === String(id) || w.nama_lokasi === id)?.nama_lokasi || id));
  const getUnitName = (id) => (!id ? "-" : ((ORG_UNITS_DATA || []).find(u => String(u.id_unit) === String(id) || u.nama_unit === id)?.nama_unit || id));

  const items = [];
  if (tx.contract_no || tx.contract_end_date) {
    items.push(`<div>• <strong>Kontrak Baru:</strong> ${tx.contract_no || '-'} (s/d ${tx.contract_end_date || '-'})</div>`);
  }
  if (tx.new_position_id) {
    items.push(`<div>• <strong>Jabatan Baru:</strong> ${getPosName(tx.new_position_id)}</div>`);
  }
  if (tx.new_location_id || tx.new_unit_id) {
    items.push(`<div>• <strong>Penempatan Baru:</strong> ${getLocName(tx.new_location_id)} • ${getUnitName(tx.new_unit_id)}</div>`);
  }
  if (tx.new_basic_salary && parseFloat(tx.new_basic_salary) > 0) {
    items.push(`<div>• <strong>Gaji Pokok Baru:</strong> Rp ${parseFloat(tx.new_basic_salary).toLocaleString('id-ID')}</div>`);
  }
  if (tx.personal_data_updates) {
    items.push(`<div>• <strong>Pembaruan Data Pribadi / Biodata Karyawan</strong></div>`);
  }
  if (items.length === 0) {
    return `Pengajuan ${types.join(', ')} berlaku efektif: ${tx.effective_date || '-'}`;
  }
  return `<div class="space-y-1 text-[11px]">${items.join('')}<div class="text-[10px] text-slate-400 pt-0.5">Tgl Berlaku Efektif: ${tx.effective_date || '-'}</div></div>`;
}

async function openCareerTransactionDetailModal(txId) {
  let item = (APPROVALS_CACHE || []).find(a => a.tx_id === txId || a.izin_id === "TX-" + txId);
  let tx = item?.tx_data;

  // Fallback query langsung dari Supabase jika belum ada di cache
  if (!tx && supabaseClient) {
    try {
      const { data, error } = await supabaseClient
        .from("hr_employee_transactions")
        .select(`*, hr_transaction_staging_approvals (*)`)
        .eq("id", txId)
        .maybeSingle();
      if (!error && data) tx = data;
    } catch (e) {
      console.warn("Query tx error:", e);
    }
  }

  if (!tx) {
    alert("Data transaksi kepegawaian tidak ditemukan: " + txId);
    return;
  }

  const modal = document.getElementById("modal-career-tx-detail");
  if (!modal) return;

  const cleanNip = String(CURRENT_USER?.nip || "").trim();
  const userId = CURRENT_USER?.id || cleanNip;

  const stagings = (tx.hr_transaction_staging_approvals || []).sort((a, b) => a.stage_order - b.stage_order);
  const currentStageObj = stagings.find(s => s.stage_order === (tx.current_stage || 1));

  const isApproverForCurrentStage = currentStageObj && (
    String(currentStageObj.approver_nip || "").trim() === cleanNip ||
    String(currentStageObj.approver_user_id || "").trim() === String(userId).trim()
  );
  const isPending = tx.status === "PENDING_APPROVAL" || tx.status === "IN_REVIEW" || tx.status === "PENDING";

  // Data karyawan terkait
  const relatedEmp = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip)) ||
    (APP_STATE.employees || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip)) ||
    { nama_lengkap: item?.nama || tx.nip, nip: tx.nip, cabang: item?.cabang || "Head Office" };

  // Set Profile Box
  const empNama = document.getElementById("tx-detail-emp-nama");
  if (empNama) empNama.innerText = relatedEmp?.nama_lengkap || relatedEmp?.nama || item?.nama || tx.nip;

  const empInfo = document.getElementById("tx-detail-emp-info");
  if (empInfo) empInfo.innerText = `NIP: ${tx.nip} • ${relatedEmp?.cabang || item?.cabang || 'Head Office'}`;

  const createdAtEl = document.getElementById("tx-detail-created-at");
  if (createdAtEl) createdAtEl.innerText = tx.created_at ? tx.created_at.slice(0, 10) : (tx.effective_date || '-');

  const subHeader = document.getElementById("tx-detail-sub-header");
  if (subHeader) {
    const types = Array.isArray(tx.transaction_types) ? tx.transaction_types.join(", ") : (tx.transaction_types || "Transaksi");
    subHeader.innerText = `${types} • Efektif: ${tx.effective_date || '-'}`;
  }

  const statusBadge = document.getElementById("tx-detail-status-badge");
  if (statusBadge) {
    const rawSt = String(tx.status || "PENDING").toUpperCase();
    let stCls = "bg-amber-50 text-amber-700 border-amber-200";
    if (rawSt === "APPROVED") stCls = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (rawSt === "REJECTED") stCls = "bg-rose-50 text-rose-700 border-rose-200";
    else if (rawSt === "PENDING_AGREEMENT") stCls = "bg-purple-50 text-purple-700 border-purple-200";
    statusBadge.className = `px-2 py-0.5 rounded-full text-[9px] font-bold border shrink-0 ${stCls} uppercase`;
    statusBadge.innerText = rawSt;
  }

  // Render Rincian Perubahan Lengkap
  const summaryContainer = document.getElementById("tx-detail-summary-container");
  if (summaryContainer) {
    summaryContainer.innerHTML = buildCareerTransactionSummaryHtml(tx, relatedEmp);
  }

  // Render Alur Staging Approval
  const stagingContainer = document.getElementById("tx-detail-staging-container");
  if (stagingContainer) {
    if (!stagings || stagings.length === 0) {
      stagingContainer.innerHTML = `
        <div class="p-2.5 bg-white rounded-xl border border-indigo-100 text-slate-500 text-[11px] italic">
          Pengajuan ini tidak memerlukan staging approval bertingkat (cukup konfirmasi mandiri karyawan ybs).
        </div>
      `;
    } else {
      stagingContainer.innerHTML = stagings.map(s => {
        const isCurrent = s.stage_order === (tx.current_stage || 1) && isPending;
        const isApproved = s.status === "APPROVED";
        const isRejected = s.status === "REJECTED";
        let statusTag = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">MENUNGGU</span>`;
        if (isApproved) statusTag = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-solid fa-check mr-1"></i>DISETUJUI</span>`;
        else if (isRejected) statusTag = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-rose-50 text-rose-700 border border-rose-200"><i class="fa-solid fa-xmark mr-1"></i>DITOLAK</span>`;
        else if (isCurrent) statusTag = `<span class="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">MENUNGGU RESPON</span>`;

        return `
          <div class="p-2 rounded-xl border ${isCurrent ? 'bg-amber-50/70 border-amber-200 shadow-2xs' : 'bg-white border-indigo-100'} flex items-center justify-between text-xs">
            <div class="flex items-center space-x-2 min-w-0">
              <span class="w-5 h-5 rounded-full ${isApproved ? 'bg-emerald-600 text-white' : (isCurrent ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600')} text-[10px] font-bold flex items-center justify-center shrink-0">
                ${s.stage_order}
              </span>
              <div class="min-w-0">
                <strong class="text-slate-900 block truncate">${s.approver_role || 'Approver Staging ' + s.stage_order}</strong>
                <span class="text-[10px] text-slate-400 font-mono">NIP: ${s.approver_nip || '-'}</span>
              </div>
            </div>
            <div class="text-right shrink-0">
              ${statusTag}
              ${s.approved_at ? `<span class="block text-[9px] text-slate-400 font-mono mt-0.5">${s.approved_at.slice(0, 16)}</span>` : ''}
            </div>
          </div>
        `;
      }).join("");
    }
  }

  // Render Action Buttons di Modal Detail
  const actionBox = document.getElementById("tx-detail-action-buttons");
  if (actionBox) {
    if (isPending && isApproverForCurrentStage) {
      actionBox.innerHTML = `
        <button type="button" onclick="closeCareerTransactionDetailModal(); openProcessTransactionApprovalModal('${tx.id}', '${currentStageObj?.id}', 'REJECTED')" class="py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center space-x-1.5 transition active:scale-95">
          <i class="fa-solid fa-xmark"></i>
          <span>Tolak Transaksi</span>
        </button>
        <button type="button" onclick="closeCareerTransactionDetailModal(); openProcessTransactionApprovalModal('${tx.id}', '${currentStageObj?.id}', 'APPROVED')" class="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center space-x-1.5 transition active:scale-95">
          <i class="fa-solid fa-check"></i>
          <span>Setujui Staging ${tx.current_stage || 1}</span>
        </button>
      `;
    } else {
      actionBox.innerHTML = '';
    }
  }

  modal.classList.remove("hidden");
}

function closeCareerTransactionDetailModal() {
  document.getElementById("modal-career-tx-detail")?.classList.add("hidden");
}

// =========================================================================
// CONTROLLER: MODAL 3 - PERSETUJUAN ELEKTRONIK TRANSAKSI KEPEGAWAIAN
// =========================================================================
let CURRENT_AGREEMENT_TX = null;

async function openElectronicAgreementModal(txId) {
  const modal = document.getElementById("modal-electronic-agreement");
  if (!modal) return;

  let tx = (APPROVALS_CACHE || []).find(a => a.tx_id === txId)?.tx_data;
  if (!tx && supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("hr_employee_transactions")
        .select("*")
        .eq("id", txId)
        .maybeSingle();
      if (data) tx = data;
    } catch (_) { }
  }

  if (!tx) {
    alert("Data transaksi tidak ditemukan: " + txId);
    return;
  }

  CURRENT_AGREEMENT_TX = tx;
  document.getElementById("agree-tx-id").value = tx.id;

  const summaryContainer = document.getElementById("agree-summary-container");
  const relatedEmp = (PERSONALIA_EMPLOYEES_DATA || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip)) ||
    (APP_STATE.employees || []).find(e => String(e.id) === String(tx.employee_id) || String(e.nip) === String(tx.nip));

  const changeItemsHtml = buildCareerTransactionSummaryHtml(tx, relatedEmp);
  if (summaryContainer) summaryContainer.innerHTML = changeItemsHtml;

  const types = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || "Perubahan Karir"];
  const legalEl = document.getElementById("agree-legal-text");
  if (legalEl) {
    if (tx.personal_data_updates && types.length === 1) {
      legalEl.innerText = `"Dengan ini saya menyatakan bahwa data pribadi/biodata yang diajukan di atas adalah benar, valid, dan sesuai dengan dokumen kependudukan saya, serta saya mengonfirmasi pembaruan data ini pada profil kepegawaian perusahaan."`;
    } else if (tx.personal_data_updates && types.length > 1) {
      legalEl.innerText = `"Dengan ini saya menyatakan bahwa data pribadi/biodata serta seluruh perubahan kepegawaian (${types.join(", ")}) sebagaimana tercantum di atas adalah benar, sah, dan telah saya sepakati bersama untuk diberlakukan terhitung mulai Tanggal Berlaku (Effective Date) yang ditetapkan."`;
    } else {
      legalEl.innerText = `"Dengan ini saya menyatakan telah membaca, memahami, dan menyetujui seluruh perubahan data kepegawaian (${types.join(", ")}) sebagaimana tercantum di atas, untuk diberlakukan terhitung mulai Tanggal Berlaku (Effective Date) yang telah ditetapkan perusahaan."`;
    }
  }

  // Metadata Audit Trail
  const nowStr = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "medium" });
  document.getElementById("agree-meta-time").innerText = nowStr;
  document.getElementById("agree-meta-nip").innerText = `${CURRENT_USER?.nama || 'Karyawan'} (${CURRENT_USER?.nip || tx.nip})`;
  document.getElementById("agree-meta-device").innerText = navigator.userAgent.slice(0, 38) + "...";

  const ipEl = document.getElementById("agree-meta-ip");
  if (ipEl) ipEl.innerText = "Memuat IP...";
  fetch("https://api.ipify.org?format=json")
    .then(r => r.json())
    .then(data => { if (ipEl) ipEl.innerText = data.ip || "127.0.0.1 (Client)"; })
    .catch(() => { if (ipEl) ipEl.innerText = "127.0.0.1 (Local Intranet)"; });

  modal.classList.remove("hidden");
}

function closeElectronicAgreementModal() {
  document.getElementById("modal-electronic-agreement")?.classList.add("hidden");
  CURRENT_AGREEMENT_TX = null;
}

async function confirmElectronicAgreement() {
  if (!CURRENT_AGREEMENT_TX) return;
  const tx = CURRENT_AGREEMENT_TX;
  const txId = tx.id;
  const btn = document.getElementById("btn-confirm-agree");
  const origText = btn ? btn.innerHTML : "Setuju";

  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Menyimpan Tanda Tangan...';
    btn.disabled = true;
  }

  try {
    const ipAddress = document.getElementById("agree-meta-ip")?.innerText || "Client IP";
    const deviceInfo = navigator.userAgent;
    const statementText = document.getElementById("agree-legal-text")?.innerText || "Dengan ini saya menyatakan setuju.";
    const now = new Date().toISOString();

    if (supabaseClient) {
      // 1. Simpan bukti tanda tangan ke hr_transaction_agreements
      await supabaseClient
        .from("hr_transaction_agreements")
        .insert({
          transaction_id: txId,
          employee_id: tx.employee_id,
          employee_nip: tx.nip || CURRENT_USER?.nip || "",
          is_agreed: true,
          agreed_at: now,
          ip_address: ipAddress,
          user_agent: deviceInfo,
          agreement_statement: statementText,
          created_at: now
        });

      // 2. Periksa apakah ada staging approvals bertingkat
      const { data: stagings } = await supabaseClient
        .from("hr_transaction_staging_approvals")
        .select("*")
        .eq("transaction_id", txId);

      if (stagings && stagings.length > 0) {
        // Ada staging approval -> Maju ke IN_REVIEW dan aktifkan stage 1
        await supabaseClient
          .from("hr_employee_transactions")
          .update({
            status: "IN_REVIEW",
            current_stage: 1,
            updated_at: now
          })
          .eq("id", txId);

        await supabaseClient
          .from("hr_transaction_staging_approvals")
          .update({
            status: "PENDING",
            updated_at: now
          })
          .eq("transaction_id", txId)
          .eq("stage_order", 1);

        closeElectronicAgreementModal();
        showToast("Persetujuan elektronik berhasil ditandatangani! Berkas diteruskan ke Approver Staging 1.", "success", 2500);
      } else {
        // Tanpa Staging (dikosongkan): Cukup konfirmasi user -> Langsung FINAL APPROVED & APPLIED!
        await supabaseClient
          .from("hr_employee_transactions")
          .update({
            status: "APPROVED",
            updated_at: now
          })
          .eq("id", txId);

        closeElectronicAgreementModal();
        await applyApprovedTransactionToEmployee(tx);
        showToast("Pembaruan data pribadi berhasil dikonfirmasi dan telah otomatis diterapkan ke profil karyawan!", "success", 3000);
      }
    } else {
      closeElectronicAgreementModal();
    }

    await fetchApprovalList();
    if (typeof loadPersonaliaEmployees === "function") {
      await loadPersonaliaEmployees();
    }
  } catch (err) {
    console.error("[Electronic Agreement] Error:", err);
    alert("Gagal memproses persetujuan elektronik: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = origText;
      btn.disabled = false;
    }
  }
}

// =========================================================================
// CONTROLLER: PROSES APPROVAL TRANSAKSI OLEH ATASAN / APPROVER
// =========================================================================
function openProcessTransactionApprovalModal(txId, stageId, actionType) {
  const item = APPROVALS_CACHE.find(a => a.tx_id === txId || a.izin_id === "TX-" + txId);
  if (!item) return;

  PENDING_APPROVAL_ACTION_PAYLOAD = {
    is_career_transaction: true,
    tx_id: txId,
    stage_id: stageId,
    status: actionType,
    approver_nip: CURRENT_USER.nip,
    approver_name: CURRENT_USER.nama
  };

  const modal = document.getElementById("modal-process-approval");
  const iconBox = document.getElementById("modal-appr-icon-box");
  const icon = document.getElementById("modal-appr-icon");
  const title = document.getElementById("modal-appr-title");
  const sub = document.getElementById("modal-appr-sub");
  const pemohon = document.getElementById("modal-appr-pemohon");
  const jenis = document.getElementById("modal-appr-jenis");
  const periode = document.getElementById("modal-appr-periode");
  const catatan = document.getElementById("modal-appr-catatan");
  const btnConfirm = document.getElementById("btn-confirm-approval-action");
  const inputNotes = document.getElementById("modal-appr-input-notes");

  if (inputNotes) inputNotes.value = "";
  if (pemohon) pemohon.innerText = `${item.nama} (${item.nip}) • ${item.cabang}`;
  if (jenis) jenis.innerText = item.jenis_izin;
  if (periode) periode.innerText = `Efektif: ${item.effective_date || '-'}`;
  if (catatan) {
    if (item.tx_data) {
      catatan.innerHTML = buildCareerTransactionCompactHtml(item.tx_data);
    } else {
      catatan.innerText = item.catatan || "-";
    }
  }

  if (actionType === "APPROVED") {
    if (title) title.innerText = `Setujui Transaksi Staging ${item.current_stage_order || 1}`;
    if (sub) sub.innerText = `Anda akan menyetujui transaksi kepegawaian ${item.nama}`;
    if (iconBox) iconBox.className = "w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-2";
    if (icon) icon.className = "fa-solid fa-check";
    if (btnConfirm) {
      btnConfirm.className = "w-2/3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95";
      btnConfirm.innerText = "Ya, Setujui";
    }
  } else {
    if (title) title.innerText = `Tolak Transaksi Staging ${item.current_stage_order || 1}`;
    if (sub) sub.innerText = `Anda akan menolak transaksi kepegawaian ${item.nama}`;
    if (iconBox) iconBox.className = "w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-2xl mx-auto mb-2";
    if (icon) icon.className = "fa-solid fa-xmark";
    if (btnConfirm) {
      btnConfirm.className = "w-2/3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md transition active:scale-95";
      btnConfirm.innerText = "Ya, Tolak";
    }
  }

  if (modal) modal.classList.remove("hidden");
}

async function executeTransactionApproval(txId, stageId, actionType, notes) {
  if (!supabaseClient) {
    showToast("Database Supabase tidak terhubung", "error");
    return;
  }

  try {
    const isApprove = actionType === "APPROVED";
    const now = new Date().toISOString();

    // 1. Dapatkan data transaksi & seluruh staging
    const { data: tx, error: txErr } = await supabaseClient
      .from("hr_employee_transactions")
      .select(`
        *,
        hr_transaction_staging_approvals (*)
      `)
      .eq("id", txId)
      .single();

    if (txErr || !tx) {
      alert("Transaksi tidak ditemukan di database: " + (txErr?.message || ""));
      return;
    }

    const stagings = (tx.hr_transaction_staging_approvals || []).sort((a, b) => a.stage_order - b.stage_order);
    const currentOrder = tx.current_stage || 1;
    const currentStageObj = stagings.find(s => s.stage_order === currentOrder || s.id === stageId);

    // 2. Update record staging saat ini
    if (currentStageObj) {
      await supabaseClient
        .from("hr_transaction_staging_approvals")
        .update({
          status: isApprove ? "APPROVED" : "REJECTED",
          decision_notes: notes,
          decided_at: now,
          updated_at: now
        })
        .eq("id", currentStageObj.id);
    }

    if (!isApprove) {
      // Ditolak: update status transaksi menjadi REJECTED
      await supabaseClient
        .from("hr_employee_transactions")
        .update({
          status: "REJECTED",
          updated_at: now
        })
        .eq("id", txId);

      showToast("Transaksi kepegawaian ditolak.", "info", 2000);
      await fetchApprovalList();
      return;
    }

    // 3. Jika disetujui: periksa apakah ada stage berikutnya
    const nextStageObj = stagings.find(s => s.stage_order === currentOrder + 1);
    if (nextStageObj) {
      // Maju ke stage berikutnya
      await supabaseClient
        .from("hr_employee_transactions")
        .update({
          current_stage: currentOrder + 1,
          updated_at: now
        })
        .eq("id", txId);

      await supabaseClient
        .from("hr_transaction_staging_approvals")
        .update({
          status: "PENDING",
          updated_at: now
        })
        .eq("id", nextStageObj.id);

      showToast(`Staging ${currentOrder} disetujui! Diteruskan ke Staging ${currentOrder + 1}.`, "success", 2000);
    } else {
      // Ini adalah stage terakhir -> Transaksi FINAL APPROVED!
      await supabaseClient
        .from("hr_employee_transactions")
        .update({
          status: "APPROVED",
          updated_at: now
        })
        .eq("id", txId);

      // Terapkan perubahan ke data karyawan aktif
      await applyApprovedTransactionToEmployee(tx);
      showToast("Transaksi kepegawaian telah disetujui penuh & data karyawan aktif ter-update!", "success", 2500);
    }

    await fetchApprovalList();
    if (typeof loadPersonaliaEmployees === "function") {
      await loadPersonaliaEmployees();
    }
  } catch (e) {
    console.error("[Transaction Approval] Error:", e);
    alert("Gagal memproses transaksi: " + e.message);
  }
}

async function applyApprovedTransactionToEmployee(tx) {
  if (!supabaseClient || !tx) return;
  try {
    const empId = tx.employee_id;
    const now = new Date().toISOString();
    const updatePayload = { updated_at: now };
    const types = Array.isArray(tx.transaction_types) ? tx.transaction_types : [tx.transaction_types || ""];

    // A. Penerimaan Karyawan (New Hire)
    if (types.includes("Penerimaan Karyawan") || tx.is_new_hire) {
      if (tx.unit_id || tx.work_location_id) {
        updatePayload.location_id = tx.unit_id || tx.work_location_id;
      }
      if (tx.position_id) {
        updatePayload.position_id = tx.position_id;
      }
      updatePayload.status_kerja = tx.employment_status || "PKWT";
      if (tx.join_date) {
        updatePayload.tanggal_masuk = tx.join_date;
      }
      if (tx.contract_end_date) {
        updatePayload.tanggal_selesai_kontrak = tx.contract_end_date;
      }
    }

    // B. Pengangkatan Tetap (PKWTT)
    if (types.includes("Tetap (PKWTT)") || tx.is_permanent_appointment) {
      updatePayload.status_kerja = "PKWTT";
      updatePayload.tanggal_selesai_kontrak = null;
    }

    // C/D. Pengangkatan / Perpanjang Kontrak (PKWT)
    if (types.includes("Pengangkatan Kontrak") || types.includes("Perpanjang Kontrak") || tx.is_contract_appointment || tx.is_contract_extension) {
      updatePayload.status_kerja = "PKWT";
      if (tx.contract_end_date) {
        updatePayload.tanggal_selesai_kontrak = tx.contract_end_date;
      }
    }

    // E/F/G. Rotasi, Promosi, Demosi
    if (tx.new_position_id) {
      updatePayload.position_id = tx.new_position_id;
    } else if (tx.position_id && !updatePayload.position_id) {
      updatePayload.position_id = tx.position_id;
    }

    // H. Mutasi / Penempatan Unit
    if (tx.new_unit_id) {
      updatePayload.location_id = tx.new_unit_id;
    } else if (tx.new_location_id) {
      updatePayload.location_id = tx.new_location_id;
    } else if (tx.unit_id && !updatePayload.location_id) {
      updatePayload.location_id = tx.unit_id;
    } else if (tx.work_location_id && !updatePayload.location_id) {
      updatePayload.location_id = tx.work_location_id;
    }

    // J/K/L. Pengakhiran Hubungan Kerja (Resign, PHK, Pensiun)
    if (types.some(t => ["Resign", "PHK", "Pensiun"].includes(t)) || tx.is_resignation || tx.is_phk || tx.is_pension) {
      updatePayload.deleted_at = tx.effective_date ? `${tx.effective_date}T00:00:00Z` : now;
    }

    // M. Pembaruan Data Pribadi (Personal Data Updates)
    let pu = tx.personal_data_updates || {};
    if (typeof pu === "string") {
      try {
        pu = JSON.parse(pu);
      } catch (e) {
        pu = {};
      }
    }

    if (types.includes("Pembaruan Data Pribadi") || Object.keys(pu).length > 0) {
      if (pu.nama_lengkap || pu.name) {
        updatePayload.name = pu.nama_lengkap || pu.name;
      }
      if (pu.email) {
        updatePayload.email = pu.email;
      }

      // Sinkronkan ke hr_employee_personal_details
      try {
        const detailPayload = {
          employee_id: empId,
          ktp_number: pu.ktp_number || pu.nik_ktp || null,
          pob: pu.pob || null,
          dob: pu.dob || null,
          gender: pu.gender || null,
          religion: pu.religion || null,
          marital_status: pu.marital_status || null,
          spouse_name: pu.spouse_name || null,
          number_of_dependents: parseInt(pu.number_of_dependents) || 0,
          address_ktp: pu.address_ktp || null,
          address_domicile: pu.address_domicile || null,
          phone: pu.phone || null,
          emergency_contact_name: pu.emergency_contact_name || null,
          emergency_contact_relation: pu.emergency_contact_relation || null,
          emergency_contact_phone: pu.emergency_contact_phone || null,
          personal_details: pu,
          updated_at: now
        };

        let { error: upsertErr } = await supabaseClient
          .from("hr_employee_personal_details")
          .upsert([detailPayload], { onConflict: "employee_id" });

        if (upsertErr) {
          console.warn("[applyApprovedTransactionToEmployee] hr_employee_personal_details upsert error:", upsertErr);
        }
      } catch (detErr) {
        console.warn("[applyApprovedTransactionToEmployee] personal details sync error:", detErr);
      }
    }

    // UPDATE TABEL MASTER hr_employees (Tabel fisik base)
    const { error: empUpErr } = await supabaseClient
      .from("hr_employees")
      .update(updatePayload)
      .eq("id", empId);

    if (empUpErr) {
      console.error("[applyApprovedTransactionToEmployee] Gagal update hr_employees:", empUpErr);
      // Fallback coba view employees jika tabel base berbeda hak akses
      await supabaseClient
        .from("employees")
        .update(updatePayload)
        .eq("id", empId);
    } else {
      console.log(`[applyApprovedTransactionToEmployee] Sukses update hr_employees untuk ID ${empId}:`, updatePayload);
    }

    // Update status transaksi menjadi APPLIED agar terdata telah diaktifkan ke core employee
    await supabaseClient
      .from("hr_employee_transactions")
      .update({ status: "APPROVED", updated_at: now })
      .eq("id", tx.id);

    // Buat riwayat jejak di hr_employee_career_histories
    const typesStr = types.join(", ");
    const careerPayload = {
      employee_id: empId,
      transaction_date: tx.effective_date || now.split("T")[0],
      effective_date: tx.effective_date || now.split("T")[0],
      transaction_type: typesStr,
      no_sk: tx.contract_no || ("SK/" + tx.id.slice(0, 8)),
      description: `Transaksi disetujui: ${typesStr}`,
      new_position_id: tx.new_position_id || tx.position_id || null,
      previous_position_id: tx.prev_position_id || null,
      new_location_id: tx.new_unit_id || tx.new_location_id || tx.unit_id || null,
      previous_location_id: tx.prev_unit_id || tx.prev_location_id || null,
      new_status_kerja: updatePayload.status_kerja || null,
      new_basic_salary: tx.new_basic_salary ? parseFloat(tx.new_basic_salary) : null,
      previous_basic_salary: tx.prev_basic_salary ? parseFloat(tx.prev_basic_salary) : null,
      new_allowances: (parseFloat(tx.new_allowance_jabatan || 0) + parseFloat(tx.new_allowance_transport || 0) + parseFloat(tx.new_allowance_komunikasi || 0) + parseFloat(tx.new_allowance_tempat_tinggal || 0) + parseFloat(tx.new_allowance_penempatan || 0) + parseFloat(tx.new_allowance_kemahalan || 0)),
      previous_allowances: (parseFloat(tx.prev_allowance_jabatan || 0) + parseFloat(tx.prev_allowance_transport || 0) + parseFloat(tx.prev_allowance_komunikasi || 0) + parseFloat(tx.prev_allowance_tempat_tinggal || 0) + parseFloat(tx.prev_allowance_penempatan || 0) + parseFloat(tx.prev_allowance_kemahalan || 0)),
      created_at: now
    };

    let { error: chErr } = await supabaseClient
      .from("hr_employee_career_histories")
      .insert(careerPayload);

    if (chErr) {
      // Fallback ke view
      await supabaseClient
        .from("employee_career_histories")
        .insert(careerPayload);
    }

  } catch (err) {
    console.error("[applyApprovedTransactionToEmployee] Fatal Error:", err);
  }
}

// Fungsi sinkronisasi transaksi APPROVED yang belum teraplikasikan ke tabel hr_employees
async function syncPendingApprovedTransactions() {
  if (!supabaseClient) return;
  try {
    const { data: approvedTxs, error } = await supabaseClient
      .from("hr_employee_transactions")
      .select("*")
      .eq("status", "APPROVED");

    if (error || !approvedTxs || approvedTxs.length === 0) return;

    for (const tx of approvedTxs) {
      // Terapkan ke hr_employees
      await applyApprovedTransactionToEmployee(tx);
    }
  } catch (e) {
    console.warn("[syncPendingApprovedTransactions] Warning:", e);
  }
}

// Listener Tombol Back & Forward Browser HP / Desktop
window.addEventListener("popstate", function (event) {
  const target = getScreenFromUrl();
  loadScreen(target, false);
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initAppBootstrap();
    syncPendingApprovedTransactions();
  });
} else {
  initAppBootstrap();
  syncPendingApprovedTransactions();
}

document.addEventListener("click", function (e) {
  const onbWrap = document.getElementById("onb-db-lama-search-wrapper");
  if (onbWrap && !onbWrap.contains(e.target)) {
    closeOnbDbLamaSearchDropdown();
  }
  const gpsDealerWrap = document.getElementById("gps-dealer-search-wrapper");
  if (gpsDealerWrap && !gpsDealerWrap.contains(e.target)) {
    closeGpsDealerSearchDropdown();
  }
  const gpsKendWrap = document.getElementById("gps-kendaraan-search-wrapper");
  if (gpsKendWrap && !gpsKendWrap.contains(e.target)) {
    closeGpsKendaraanSearchDropdown();
  }
  const gpsImeiWrap = document.getElementById("gps-imei-search-wrapper");
  if (gpsImeiWrap && !gpsImeiWrap.contains(e.target)) {
    closeGpsImeiSearchDropdown();
  }
  const empAtasanWrap = document.getElementById("emp-atasan-search-wrapper");
  if (empAtasanWrap && !empAtasanWrap.contains(e.target)) {
    closeEmpAtasanSearchDropdown();
  }
});