/**
 * CORE LOGIC & ENGINE DIGIASHA APP (PRODUCTION READY - GOOGLE SPREADSHEET API)
 */
const APP_BUILD_VERSION = "20260911_v47";
const screenCache = {};

// Sesi Pengguna Aktif (Disimpan di localStorage)
let CURRENT_USER = (() => {
  try {
    const saved = localStorage.getItem("DIGIASHA_AUTH_USER");
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
})();

// Definisi Matriks Role & Hak Akses Standar
const DEFAULT_ROLE_PERMISSIONS = {
  "R-01": {
    name: "Super Admin",
    icon: "fa-crown",
    color: "purple",
    badgeBg: "bg-purple-100 text-purple-800 border border-purple-200",
    desc: "Akses penuh seluruh modul operasional, presensi, persetujuan, support, dan pengaturan sistem.",
    permissions: ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "izin", "persetujuan", "attendance_summary", "work_calendar", "expense_claim", "internal_memo", "employee_loan", "helpdesk_support", "settings"]
  },
  "R-02": {
    name: "Branch Manager / Supervisor",
    icon: "fa-user-tie",
    color: "blue",
    badgeBg: "bg-blue-100 text-blue-800 border border-blue-200",
    desc: "Monitoring cabang, kelola prioritas, penugasan concern, persetujuan, dan layanan support karyawan.",
    permissions: ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history", "izin", "persetujuan", "attendance_summary", "work_calendar", "expense_claim", "internal_memo", "employee_loan", "helpdesk_support"]
  },
  "R-03": {
    name: "FAC Officer",
    icon: "fa-satellite-dish",
    color: "cyan",
    badgeBg: "bg-cyan-100 text-cyan-800 border border-cyan-200",
    desc: "Monitoring dan operasional GPS armada dealer, laporan berkala FAC, dan support karyawan.",
    permissions: ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "izin", "attendance_summary", "work_calendar", "expense_claim", "internal_memo", "helpdesk_support"]
  },
  "R-04": {
    name: "Field PIC",
    icon: "fa-person-walking",
    color: "emerald",
    badgeBg: "bg-emerald-100 text-emerald-800 border border-emerald-200",
    desc: "Eksekusi kunjungan lapangan, visit mitra berkala, onboarding calon mitra, presensi, dan klaim biaya.",
    permissions: ["priority", "visit", "onboarding", "pipeline", "gps", "history", "izin", "attendance_summary", "work_calendar", "expense_claim", "internal_memo", "helpdesk_support"]
  }
};

const ALL_APP_MODULES = [
  // 1. Operasional Lapangan
  { key: "priority", title: "Priority Visit", desc: "Scorecard & prioritas mitra", icon: "fa-triangle-exclamation", category: "Operasional Lapangan" },
  { key: "assignment", title: "Assign Concern", desc: "Tandai concern visit mitra", icon: "fa-bullhorn", category: "Operasional Lapangan" },
  { key: "visit", title: "Laporan Visit Mitra", desc: "Input regular & unit OVD", icon: "fa-clipboard-check", category: "Operasional Lapangan" },
  { key: "onboarding", title: "Visit Calon Mitra", desc: "Input onboarding baru", icon: "fa-user-plus", category: "Operasional Lapangan" },
  { key: "pipeline", title: "Pipeline Onboarding", desc: "Progres & folder dokumen", icon: "fa-bars-progress", category: "Operasional Lapangan" },
  { key: "gps", title: "GPS Maintenance", desc: "Pasang / ganti / cabut GPS", icon: "fa-satellite-dish", category: "Operasional Lapangan" },
  { key: "fac", title: "Report GPS", desc: "Monitoring sinyal GPS harian", icon: "fa-tower-broadcast", category: "Operasional Lapangan" },
  { key: "history", title: "Riwayat Aktivitas", desc: "Log visit, calon mitra & GPS", icon: "fa-clock-rotate-left", category: "Operasional Lapangan" },

  // 2. Presensi & Persetujuan
  { key: "izin", title: "Pengajuan Izin", desc: "Permohonan WFA, Cuti, Sakit", icon: "fa-file-signature", category: "Presensi & Persetujuan" },
  { key: "persetujuan", title: "Persetujuan (Approval Hub)", desc: "Pusat persetujuan permohonan", icon: "fa-stamp", category: "Presensi & Persetujuan" },
  { key: "attendance_summary", title: "Rekap Absen & Jam Kerja", desc: "Statistik & rekapitulasi presensi", icon: "fa-calendar-check", category: "Presensi & Persetujuan" },
  { key: "work_calendar", title: "Jadwal Kerja & Kalender", desc: "Kalender kerja & jam masuk 09:00", icon: "fa-calendar-days", category: "Presensi & Persetujuan" },

  // 3. Layanan & Support Karyawan
  { key: "expense_claim", title: "Klaim Biaya (Reimbursement)", desc: "Pengajuan biaya BBM/Tol/Ops", icon: "fa-money-bill-wave", category: "Layanan & Support" },
  { key: "internal_memo", title: "Memo Pengajuan Internal", desc: "Pembuatan surat memo resmi", icon: "fa-file-lines", category: "Layanan & Support" },
  { key: "employee_loan", title: "Pinjaman Karyawan (Kasbon)", desc: "Fasilitas pinjaman darurat karyawan", icon: "fa-hand-holding-dollar", category: "Layanan & Support" },
  { key: "helpdesk_support", title: "IT & Helpdesk Support", desc: "Bantuan kendala sistem & SOP", icon: "fa-headset", category: "Layanan & Support" },

  // 4. Administrasi & Sistem
  { key: "settings", title: "Pengaturan (Admin)", desc: "Kelola Akun, Area, GPS & Banner", icon: "fa-sliders", category: "Administrasi & Sistem" }
];

let ROLE_PERMISSIONS_STATE = (() => {
  try {
    const saved = localStorage.getItem("DIGIASHA_ROLE_PERMS");
    if (saved) {
      const parsed = JSON.parse(saved);
      const merged = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
      Object.keys(parsed).forEach(k => {
        if (merged[k]) merged[k].permissions = parsed[k].permissions || merged[k].permissions;
      });
      return merged;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
})();

function getPermissionsForRole(roleKey, userObj = null) {
  const roleId = String(userObj?.role_id || roleKey || "").trim();
  const roleName = String(userObj?.role || userObj?.jabatan || roleKey || "").trim();

  if (ROLE_PERMISSIONS_STATE[roleId] && Array.isArray(ROLE_PERMISSIONS_STATE[roleId].permissions) && ROLE_PERMISSIONS_STATE[roleId].permissions.length > 0) {
    return ROLE_PERMISSIONS_STATE[roleId].permissions;
  }
  const match = Object.values(ROLE_PERMISSIONS_STATE).find(r => r.name.toLowerCase() === roleName.toLowerCase() || r.name.toLowerCase().includes(roleName.toLowerCase()) || roleName.toLowerCase().includes(r.name.toLowerCase()));
  if (match && Array.isArray(match.permissions) && match.permissions.length > 0) {
    return match.permissions;
  }
  if (userObj && Array.isArray(userObj.permissions) && userObj.permissions.length > 0) {
    return userObj.permissions;
  }

  return ["priority", "visit", "onboarding", "pipeline", "gps", "history"];
}

// Hak Akses Modul per Role (Legacy Fallback)
const ROLE_PERMISSIONS = {
  "Admin": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "settings"],
  "R-01": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "settings"],
  "Super Admin": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history", "settings"],
  "Supervisor": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history"],
  "Branch Manager": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history"],
  "R-02": ["priority", "assignment", "visit", "onboarding", "pipeline", "gps", "history"],
  "FAC": ["priority", "assignment", "visit", "onboarding", "gps", "fac", "history"],
  "R-03": ["priority", "assignment", "visit", "onboarding", "gps", "fac", "history"],
  "Other": ["priority"],
  "R-04": ["priority", "visit", "onboarding", "pipeline", "gps", "history"],
  "Field PIC": ["priority", "visit", "onboarding", "pipeline", "gps", "history"]
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

let CURRENT_USER_GEO = { lat: -6.295218, long: 106.638482, accuracy: 25, nearestOffice: null, distanceToOffice: 0, isInsideRadius: false };
let ACTIVE_ABSEN_TYPE = "Absen Datang";
let TODAY_ABSEN_STATUS = "BELUM_ABSEN"; // BELUM_ABSEN, SUDAH_DATANG, SUDAH_PULANG
let CURRENT_ABSEN_SELFIE_BASE64 = null;

// State Modul Izin & Approval
let SELECTED_IZIN_CATEGORY = "WFA";
let CURRENT_IZIN_GEO = { lat: -6.295218, long: 106.638482, accuracy: 25 };
let APPROVALS_CACHE = [];
let ACTIVE_APPROVAL_FILTER = "PENDING";
let PENDING_APPROVAL_ACTION_PAYLOAD = null;
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

  let permissions = ROLE_PERMISSIONS[user.role_id] || ROLE_PERMISSIONS[user.jabatan] || ["priority", "assignment", "visit", "onboarding", "gps", "fac"];
  try {
    const { data: rolePerms } = await supabaseClient
      .from("m_role_permission")
      .select("permission_keys")
      .eq("role_id", user.role_id)
      .limit(1);
    if (rolePerms && rolePerms.length > 0 && Array.isArray(rolePerms[0].permission_keys)) {
      permissions = rolePerms[0].permission_keys;
    }
  } catch (e) {}

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

  const [resLoc, resDlr, resFac, resGps, resAssign] = await Promise.all([
    supabaseClient.from("m_work_location").select("*"),
    supabaseClient.from("m_dealer").select("*").order("dealer_name"),
    supabaseClient.from("m_facility_unit").select("*").order("dealer_name"),
    supabaseClient.from("m_gps_device").select("*"),
    supabaseClient.from("t_assignment").select("*").eq("status", "OPEN")
  ]);

  const workLocations = (resLoc.data || []).map(l => ({
    location_id: l.location_id,
    name: l.name || l.location_name,
    lat: parseFloat(l.lat || l.latitude),
    long: parseFloat(l.long || l.longitude),
    maxRadiusMeter: parseInt(l.max_radius_meter || l.radius_meter || 100),
    address: l.address || l.alamat || ""
  }));

  const now = new Date();
  const dealers = (resDlr.data || []).map(d => {
    let agingMitra = d.aging_visit_mitra || 0;
    if (d.last_visit_date) {
      const diffMs = now.getTime() - new Date(d.last_visit_date).getTime();
      agingMitra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    } else if (d.tanggal_kerjasama) {
      const diffMs = now.getTime() - new Date(d.tanggal_kerjasama).getTime();
      agingMitra = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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
      urgent_units_count: d.urgent_units_count || 0,
      priority_level: d.priority_level || "NORMAL",
      priority_score: d.priority_score || 0,
      priority_reason: d.priority_reason || ""
    };
  });

  const units = (resFac.data || []).map(u => {
    let agingUnit = u.aging_visit_unit || 0;
    if (u.last_visit_date) {
      const diffMs = now.getTime() - new Date(u.last_visit_date).getTime();
      agingUnit = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
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
      priority_level: u.priority_level || "NORMAL",
      priority_score: u.priority_score || 0,
      priority_reason: u.priority_reason || ""
    };
  });

  const idleGps = (resGps.data || []).filter(g => {
    const s = String(g.status_device || "").toUpperCase();
    return s === "TERSEDIA" || s === "IDLE" || s === "READY";
  });

  const assignments = resAssign.data || [];

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
  
  const visitId = `VST-${Date.now()}-${Math.floor(Math.random()*1000)}`;
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

      if (u.no_fasilitas) {
        await supabaseClient.from("m_facility_unit")
          .update({ last_visit_date: new Date().toISOString().slice(0, 10) })
          .eq("no_fasilitas", u.no_fasilitas);
      }
    }

    if (checkedRows.length > 0) {
      await supabaseClient.from("tr_visit_unit_check").insert(checkedRows);
    }
  }

  await supabaseClient.from("m_dealer")
    .update({ last_visit_date: new Date().toISOString().slice(0, 10), aging_visit_mitra: 0 })
    .eq("dealer_name", data.dealer_name);

  return { success: true, visitId };
}

async function supabaseSubmitGpsMaintenance(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const maintId = `GPSM-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  
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
    status_geofence: isDatang ? (distanceMeter <= maxRadius ? "VALID" : "OUTSIDE_RADIUS") : "N/A",
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
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const timeZone = resolveClientTimeZone(data.cabang, "", data.timezone);
  const now = new Date();
  const izinId = `IZN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const selfieUrl = data.selfie_base64
    ? await uploadToSupabaseStorage(data.selfie_base64, "absensi", `IZIN-${data.nip}-${Date.now()}`)
    : "";

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

  const { error } = await supabaseClient.from("tr_izin_log").insert([payload]);
  if (error) throw error;

  return {
    success: true,
    izinId: izinId,
    message: `Pengajuan Izin "${data.jenis_izin}" berhasil dikirimkan ke PIC Approval (${data.pic_approval_nama || 'Atasan Langsung'}).`
  };
}

async function supabaseProcessApproval(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const updateData = {
    status_approval: data.decision,
    approved_at: new Date().toISOString(),
    approved_by: data.approverNama || "Atasan",
    catatan_approval: data.note || "-"
  };

  const { error } = await supabaseClient
    .from("tr_izin_log")
    .update(updateData)
    .eq("izin_id", data.izin_id);

  if (error) throw error;
  return { success: true, message: `Permohonan berhasil di-${data.decision === 'APPROVED' ? 'Setujui' : 'Tolak'}.` };
}

async function supabaseSubmitOnboarding(data) {
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const onbId = `ONB-${Date.now()}-${Math.floor(Math.random()*1000)}`;
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
            const uploadedUrl = await uploadToSupabaseStorage(f.base64, "onboarding", `DOC-${docGroup.key}-${i+1}`);
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
  if (!supabaseClient) throw new Error("Supabase Client belum terinisialisasi");

  const assignId = `ASG-${Date.now()}-${Math.floor(Math.random()*1000)}`;
  await supabaseClient.from("t_assignment").insert([{
    assignment_id: assignId,
    supervisor_nip: data.assignedByUserId,
    dealer_name: data.dealerName,
    unit_fasilitas: data.unitFasilitas || "Umum",
    urgency_level: data.urgencyLevel || "Penting",
    instruksi: data.instruksi,
    status: "OPEN"
  }]);

  return { success: true, assignId };
}

// =========================================================================
// API CALLER HELPER (SUPABASE NATIVE + GAS FALLBACK)
// =========================================================================
async function callApi(action, data = {}) {
  // 1. Eksekusi melalui Supabase Client jika aktif
  if (supabaseClient) {
    try {
      if (action === "login") return await supabaseLogin(data.identifier, data.password);
      if (action === "getMasterData") return await supabaseGetMasterData();
      if (action === "submitVisit") return await supabaseSubmitVisit(data);
      if (action === "submitGpsMaintenance") return await supabaseSubmitGpsMaintenance(data);
      if (action === "submitAbsensi") return await supabaseSubmitAbsensi(data);
      if (action === "submitOnboarding") return await supabaseSubmitOnboarding(data);
      if (action === "saveAssignment") return await supabaseSaveAssignment(data);
      if (action === "resolveAssignment") {
        await supabaseClient.from("t_assignment").update({ status: "RESOLVED", resolved_at: new Date().toISOString(), resolved_by: data.resolvedByUserId }).eq("assignment_id", data.assignmentId);
        return { success: true };
      }
    } catch (supabaseErr) {
      console.error(`[Supabase Execution Error on ${action}]:`, supabaseErr);
    }
  }

  // 2. Fallback ke Google Apps Script
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
      const assignmentsByDealer = {};
      (APP_STATE.assignments || []).forEach(asg => {
        const dName = String(asg.dealer_name || "").toUpperCase();
        if (!assignmentsByDealer[dName]) assignmentsByDealer[dName] = [];
        assignmentsByDealer[dName].push(asg);
      });

      const unitsByDealer = {};
      (APP_STATE.units || []).forEach(u => {
        const dName = String(u.dealer_name || "").toUpperCase();
        if (!unitsByDealer[dName]) unitsByDealer[dName] = [];
        unitsByDealer[dName].push(u);
      });

      MASTER_DEALER_PRIORITY_DATA = (APP_STATE.dealers || []).map(d => {
        const dName = String(d.dealer_name || "").toUpperCase();
        const dUnits = unitsByDealer[dName] || [];
        const dAsg = assignmentsByDealer[dName] || [];
        const dealerConcern = dAsg.find(a => !a.unit_fasilitas || a.unit_fasilitas === "Umum" || a.unit_fasilitas === "-");

        return {
          ...d,
          units: dUnits,
          dealer_concern: dealerConcern ? { urgency: dealerConcern.urgency_level, note: dealerConcern.instruksi } : null
        };
      });

      return res;
    }
  } catch (err) {
    console.warn("[syncMasterDataFromApi Warning]:", err);
  }
  return null;
}

// =========================================================================
// UI HELPERS & SESSIONS
// =========================================================================
async function loadScreen(screenName) {
  const container = document.getElementById("main-view-container");
  const topbar = document.getElementById("topbar");
  const btnBack = document.getElementById("btn-back-home");
  const title = document.getElementById("topbar-title");
  const sub = document.getElementById("topbar-sub");

  // Auth Guard: Jika belum login dan mencoba buka selain login, redirect ke login
  if (!CURRENT_USER && screenName !== "login") {
    screenName = "login";
  }

  // Force Password Change Guard: Jika user wajib ganti password, cegah buka screen lain
  if (CURRENT_USER && (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") && screenName !== "login") {
    if (typeof openForceChangePassModal === "function") openForceChangePassModal();
    return;
  }

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
      title.innerText = "Digiasha Monitoring";
    } else {
      btnBack.classList.remove("hidden");
      const titles = {
        visit: "Laporan Visit Mitra",
        onboarding: "Visit Calon Mitra",
        pipeline: "Pipeline Onboarding",
        gps: "GPS Maintenance",
        priority: "Priority Visit",
        assignment: "Assign Concern Visit",
        fac: "Report GPS",
        absensi: "Presensi Kehadiran",
        izin: "Pengajuan Izin",
        persetujuan: "Pusat Persetujuan",
        settings: "In-App Management",
        history: "Riwayat Aktivitas PIC"
      };
      title.innerText = titles[screenName] || "Monitoring";
    }
  }

  container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-800"></i>Memuat halaman...</div>';

  try {
    if (!screenCache[screenName]) {
      const vParam = typeof APP_BUILD_VERSION !== "undefined" ? `?v=${APP_BUILD_VERSION}` : `?v=${Date.now()}`;
      const res = await fetch(`screens/${screenName}.html${vParam}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Gagal mengambil file screen");
      screenCache[screenName] = await res.text();
    }
    container.innerHTML = screenCache[screenName];

    // Inisialisasi controller tiap modul
    if (screenName === "dashboard") initDashboard();
    if (screenName === "priority") {
      if (!MASTER_DEALER_PRIORITY_DATA || MASTER_DEALER_PRIORITY_DATA.length === 0) {
        syncMasterDataFromApi().then(() => renderPriorityList());
      } else {
        renderPriorityList();
      }
    }
    if (screenName === "assignment") populateAssignDealerOptions();
    if (screenName === "visit") populateVisitDealerOptions();
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
    if (screenName === "settings" && typeof initSettingsScreen === "function") initSettingsScreen();
    if (screenName === "history" && typeof initHistory === "function") initHistory();

    window.scrollTo(0, 0);
  } catch (err) {
    container.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-xl text-xs">Error memuat layar: ${err.message}</div>`;
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
              let resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac", "izin", "persetujuan"];

              if (rawRoleId === "R-01" || rawRoleId.toLowerCase().includes("admin")) {
                resolvedRoleName = "Admin";
              } else if (rawRoleId === "R-02" || rawRoleId.toLowerCase().includes("branch manager") || rawRoleId.toLowerCase().includes("bm")) {
                resolvedRoleName = "Branch Manager";
                resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "persetujuan", "izin"];
              } else if (rawRoleId === "R-03" || rawRoleId.toLowerCase().includes("fac")) {
                resolvedRoleName = "FAC";
                resolvedPerms = ["priority", "assignment", "visit", "onboarding", "gps", "fac", "izin"];
              } else if (rawRoleId === "R-04" || rawRoleId.toLowerCase().includes("other")) {
                resolvedRoleName = "Other";
                resolvedPerms = ["priority", "izin"];
              }

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
    } catch (err) {}

    if (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") {
      openForceChangePassModal();
      return;
    }

    loadScreen("dashboard");
    syncMasterDataFromApi();
  } catch (err) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    alert("Error login: " + err.message);
  }
}

function handleLogout() {
  localStorage.removeItem("DIGIASHA_AUTH_USER");
  CURRENT_USER = null;
  closeForceChangePassModal();
  loadScreen("login");
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
    title: "Selamat Datang di Digiasha Monitoring System",
    description: "Aplikasi monitoring terpadu, presensi cerdas, dan support operasional karyawan.",
    image_url: "https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&w=1000&q=80",
    tag: "DIGIASHA UPDATE",
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

  const perms = (Array.isArray(CURRENT_USER.permissions) && CURRENT_USER.permissions.length > 0)
    ? CURRENT_USER.permissions
    : (typeof getPermissionsForRole === "function" ? getPermissionsForRole(CURRENT_USER.role_id || uRole, CURRENT_USER) : (ROLE_PERMISSIONS[CURRENT_USER.role] || ROLE_PERMISSIONS[CURRENT_USER.role_id] || ["priority", "assignment", "visit", "onboarding", "gps", "fac", "persetujuan"]));

  // Render & filter seluruh modul aplikasi sesuai hak akses role
  const allModulesList = [
    "priority", "assignment", "visit", "onboarding", "pipeline", "gps", "fac", "history",
    "izin", "persetujuan", "attendance_summary", "work_calendar",
    "expense_claim", "internal_memo", "employee_loan", "helpdesk_support",
    "settings"
  ];

  allModulesList.forEach(key => {
    const btn = document.getElementById(`menu-btn-${key}`);
    if (btn) {
      if (key === "izin") {
        btn.style.display = "flex"; // Modul Izin selalu tersedia
      } else {
        btn.style.display = perms.includes(key) ? "flex" : "none";
      }
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
    adminBox.style.display = perms.includes("settings") ? "block" : "none";
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
            <input type="date" id="support-input-expense-date" required value="${new Date().toISOString().slice(0,10)}" class="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800 text-xs" />
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
  } else if (type === "attendance_summary" || type === "work_calendar") {
    if (iconBox) iconBox.className = "w-9 h-9 rounded-xl bg-slate-500/20 text-slate-300 flex items-center justify-center text-base";
    if (icon) icon.className = "fa-solid fa-calendar-check text-teal-400";
    if (title) title.innerText = type === "attendance_summary" ? "Rekapitulasi Presensi & Jam Kerja" : "Kalender Kerja & Hari Libur";
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
  const todayKey = `DIGIASHA_ABSEN_${CURRENT_USER.nip}_${new Date().toISOString().slice(0, 10)}`;
  const localSaved = localStorage.getItem(todayKey);
  if (localSaved) {
    TODAY_ABSEN_STATUS = localSaved;
  }

  try {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const todayIso = new Date().toISOString().slice(0, 10);
      const url = `${CONFIG.SUPABASE_URL}/rest/v1/tr_absensi_log?nip=eq.${encodeURIComponent(CURRENT_USER.nip)}&timestamp=gte.${todayIso}T00:00:00&order=timestamp.asc`;
      const res = await fetch(url, {
        headers: {
          "apikey": CONFIG.SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const logs = await res.json();
        let hasDatang = false;
        let hasPulang = false;
        if (Array.isArray(logs)) {
          logs.forEach(l => {
            const j = String(l.jenis_absen || "").toLowerCase();
            if (j.includes("datang") || j.includes("masuk")) hasDatang = true;
            if (j.includes("pulang")) hasPulang = true;
          });
        }
        if (hasPulang) TODAY_ABSEN_STATUS = "SUDAH_PULANG";
        else if (hasDatang) TODAY_ABSEN_STATUS = "SUDAH_DATANG";
        else TODAY_ABSEN_STATUS = "BELUM_ABSEN";
        localStorage.setItem(todayKey, TODAY_ABSEN_STATUS);
      }
    } else {
      const res = await callApi("getTodayAbsenStatus", {
        nip: CURRENT_USER.nip,
        cabang: CURRENT_USER.cabang,
        timezone: clientTz
      });
      if (res && res.success) {
        TODAY_ABSEN_STATUS = res.status || "BELUM_ABSEN";
        localStorage.setItem(todayKey, TODAY_ABSEN_STATUS);
      }
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
    if (btnText) btnText.innerText = "Presensi Online";
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
  const btnBadge = document.getElementById("btn-choice-absen-badge");

  if (TODAY_ABSEN_STATUS === "SUDAH_DATANG") {
    if (btnTitle) btnTitle.innerText = "Absen Pulang";
    if (btnDesc) btnDesc.innerText = "Presensi kepulangan kerja harian (Geotag lokasi)";
    if (btnIcon) btnIcon.className = "fa-solid fa-door-open text-amber-400";
    if (btnBadge) btnBadge.classList.add("hidden");
  } else if (TODAY_ABSEN_STATUS === "SUDAH_PULANG") {
    if (btnTitle) btnTitle.innerText = "Absen Pulang";
    if (btnDesc) btnDesc.innerText = "Presensi hari ini sudah lengkap selesai";
    if (btnIcon) btnIcon.className = "fa-solid fa-circle-check text-emerald-400";
    if (btnBadge) { btnBadge.innerText = "Selesai"; btnBadge.classList.remove("hidden"); }
  } else {
    if (btnTitle) btnTitle.innerText = "Absen Datang";
    if (btnDesc) btnDesc.innerText = "Presensi masuk harian (Wajib radius kantor)";
    if (btnIcon) btnIcon.className = "fa-solid fa-building text-emerald-400";
    if (btnBadge) btnBadge.classList.add("hidden");
  }

  modal.classList.remove("hidden");
}

function closeAbsenChoiceModal() {
  const modal = document.getElementById("modal-absen-choice");
  if (modal) modal.classList.add("hidden");
}

function handleChoiceAbsenClick() {
  closeAbsenChoiceModal();
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

function initAbsensiScreen() {
  const bannerTitle = document.getElementById("absen-type-title");
  const bannerIcon = document.getElementById("absen-type-icon");
  const banner = document.getElementById("absen-type-banner");
  const boxDist = document.getElementById("box-distance-office");

  if (bannerTitle) bannerTitle.innerText = ACTIVE_ABSEN_TYPE || "Absen Datang";

  if (ACTIVE_ABSEN_TYPE === "Absen Pulang") {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-amber-700 transition-colors";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-door-open text-2xl text-amber-200";
    if (boxDist) boxDist.classList.add("hidden"); // Absen pulang tidak wajib di kantor
  } else {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-slate-900 transition-colors";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-building text-2xl text-emerald-400";
    if (boxDist) boxDist.classList.remove("hidden");
  }

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

function acquireAbsenLocation() {
  const coordsDisplay = document.getElementById("absen-coords-display");
  const distDisplay = document.getElementById("absen-distance-display");
  const officeNameDisplay = document.getElementById("absen-office-name");
  const badge = document.getElementById("absen-geofence-badge");

  if (navigator.geolocation) {
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
        CURRENT_USER_GEO.distanceToOffice = nearest.distance;

        if (coordsDisplay) coordsDisplay.innerText = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (±${Math.round(crd.accuracy)}m)`;
        if (officeNameDisplay) officeNameDisplay.innerText = nearest.name;

        if (ACTIVE_ABSEN_TYPE === "Absen Datang") {
          if (distDisplay) distDisplay.innerText = `${nearest.distance} Meter (Maks ${nearest.maxRadiusMeter}m)`;
          if (nearest.distance <= nearest.maxRadiusMeter) {
            CURRENT_USER_GEO.isInsideRadius = true;
            if (badge) { badge.innerText = `Radius Valid (${nearest.name})`; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800"; }
          } else {
            CURRENT_USER_GEO.isInsideRadius = false;
            if (badge) { badge.innerText = `Di Luar Radius (${nearest.distance}m)`; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-red-100 text-red-800"; }
          }
        } else {
          // Absen Pulang: Bebas geolokasi kantor
          CURRENT_USER_GEO.isInsideRadius = true;
          if (badge) { badge.innerText = "Geotag Terkunci (Bebas Radius)"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800"; }
        }
      },
      () => {
        const defaultOffice = OFFICE_LOCATIONS[0] || { name: "Kantor Pusat", lat: -6.295217, long: 106.638591, maxRadiusMeter: 100 };
        CURRENT_USER_GEO.lat = defaultOffice.lat;
        CURRENT_USER_GEO.long = defaultOffice.long;
        CURRENT_USER_GEO.distanceToOffice = 10;
        CURRENT_USER_GEO.isInsideRadius = true;
        CURRENT_USER_GEO.nearestOffice = defaultOffice;
        if (coordsDisplay) coordsDisplay.innerText = `${defaultOffice.lat.toFixed(6)}, ${defaultOffice.long.toFixed(6)} (Default GPS)`;
        if (officeNameDisplay) officeNameDisplay.innerText = defaultOffice.name;
        if (distDisplay) distDisplay.innerText = "10 Meter (Valid Radius)";
        if (badge) { badge.innerText = `Radius Valid (${defaultOffice.name})`; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800"; }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
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

  // Validasi geofence radius hanya untuk Absen Datang
  if (isDatang && !CURRENT_USER_GEO.isInsideRadius) {
    removeAbsenSelfie();
    showCenterAlertModal({
      title: "Absensi Gagal",
      message: `Lokasi Anda berada di luar radius kantor (${CURRENT_USER_GEO.distanceToOffice} Meter / Maks 100m). Silakan dekati kantor dan perbarui titik GPS.`,
      type: "error"
    });
    return;
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
    const todayKey = `DIGIASHA_ABSEN_${CURRENT_USER.nip}_${new Date().toISOString().slice(0, 10)}`;
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
        if (coordsDisplay) coordsDisplay.innerText = "-6.295217, 106.638591 (Default)";
        if (badge) { badge.innerText = "GPS Default"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-slate-100 text-slate-700"; }
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
  if (picInfo) picInfo.innerText = `PIC Approver: ${CURRENT_USER.nama} (${CURRENT_USER.nip}) • ${CURRENT_USER.role}`;

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
        const isAdmin = String(CURRENT_USER.role || "").toLowerCase().includes("admin");
        const cleanNip = encodeURIComponent(CURRENT_USER.nip || "");
        const queryUrl = isAdmin 
          ? `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?select=*&order=timestamp.desc`
          : `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?pic_approval_nip=eq.${cleanNip}&order=timestamp.desc`;

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

    APPROVALS_CACHE = approvals || [];
    renderApprovalList();
    updateApprovalBadgeCounts();

  } catch (err) {
    container.innerHTML = `<div class="p-5 text-center text-xs text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">Error memuat data: ${err.message}</div>`;
  }
}

async function fetchPendingApprovalCount() {
  if (!CURRENT_USER) return;
  try {
    let pendingCount = 0;
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY) {
      const isAdmin = String(CURRENT_USER.role || "").toLowerCase().includes("admin");
      const cleanNip = encodeURIComponent(CURRENT_USER.nip || "");
      const queryUrl = isAdmin
        ? `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?status_approval=eq.PENDING&select=izin_id`
        : `${CONFIG.SUPABASE_URL}/rest/v1/tr_izin_log?pic_approval_nip=eq.${cleanNip}&status_approval=eq.PENDING&select=izin_id`;

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
        pendingCount = res.approvals.filter(a => String(a.status_approval || "").toUpperCase() === "PENDING").length;
      }
    }

    const badge = document.getElementById("badge-pending-approval-count");
    if (badge) {
      badge.innerText = pendingCount;
      if (pendingCount > 0) badge.classList.remove("hidden");
      else badge.classList.add("hidden");
    }
  } catch (e) {}
}

function updateApprovalBadgeCounts() {
  const pendingCount = APPROVALS_CACHE.filter(a => String(a.status_approval || "").toUpperCase() === "PENDING").length;
  const countFilterPending = document.getElementById("count-filter-pending");
  const tabCount = document.getElementById("tab-personalia-count");
  const dashBadge = document.getElementById("badge-pending-approval-count");

  if (countFilterPending) countFilterPending.innerText = pendingCount;
  if (tabCount) tabCount.innerText = pendingCount;
  if (dashBadge) {
    dashBadge.innerText = pendingCount;
    if (pendingCount > 0) dashBadge.classList.remove("hidden");
    else dashBadge.classList.add("hidden");
  }
}

function filterApprovals(filterType) {
  ACTIVE_APPROVAL_FILTER = filterType;

  // Update button active styles
  ["PENDING", "ALL", "APPROVED", "REJECTED"].forEach(f => {
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

  let filtered = APPROVALS_CACHE;
  if (ACTIVE_APPROVAL_FILTER === "PENDING") {
    filtered = filtered.filter(a => String(a.status_approval || "").toUpperCase() === "PENDING");
  } else if (ACTIVE_APPROVAL_FILTER === "APPROVED") {
    filtered = filtered.filter(a => String(a.status_approval || "").toUpperCase() === "APPROVED");
  } else if (ACTIVE_APPROVAL_FILTER === "REJECTED") {
    filtered = filtered.filter(a => String(a.status_approval || "").toUpperCase() === "REJECTED");
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-400 space-y-1.5">
        <i class="fa-solid fa-inbox text-3xl text-slate-300 mb-1"></i>
        <p class="text-xs font-bold text-slate-600">Tidak ada pengajuan permohonan</p>
        <span class="text-[10px]">Daftar pengajuan izin karyawan akan tampil di sini</span>
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

  container.innerHTML = filtered.map(a => {
    const isPending = String(a.status_approval || "").toUpperCase() === "PENDING";
    const isApproved = String(a.status_approval || "").toUpperCase() === "APPROVED";
    const isRejected = String(a.status_approval || "").toUpperCase() === "REJECTED";

    const badgeStyle = isPending
      ? "bg-amber-100 text-amber-800 border-amber-200"
      : (isApproved ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-rose-100 text-rose-800 border-rose-200");

    const statusLabel = isPending ? "Menunggu Respon" : (isApproved ? "Disetujui" : "Ditolak");
    const catConfig = categoryBadges[a.jenis_izin] || { bg: "bg-slate-50 text-slate-700 border-slate-200", icon: "fa-file" };

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

    const actionButtons = isPending ? `
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
    ` : `
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

    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 text-xs">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h4 class="font-bold text-slate-900 text-sm leading-tight truncate">${a.nama}</h4>
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

        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700">
          <span class="text-[9px] text-slate-400 font-bold block uppercase mb-0.5">Keterangan / Alasan:</span>
          <p class="font-medium whitespace-pre-line leading-relaxed">${a.catatan || '-'}</p>
        </div>

        ${selfieThumbnail}
        ${actionButtons}
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
  const jenis = document.getElementById("modal-appr-jenis");
  const periode = document.getElementById("modal-appr-periode");
  const catatan = document.getElementById("modal-appr-catatan");
  const btnConfirm = document.getElementById("btn-confirm-approval-action");
  const inputNotes = document.getElementById("modal-appr-input-notes");

  if (inputNotes) inputNotes.value = "";
  if (jenis) jenis.innerText = `${item.jenis_izin} (${item.nama})`;
  if (periode) periode.innerText = item.tgl_mulai ? `${item.tgl_mulai} s/d ${item.tgl_selesai || item.tgl_mulai}` : item.timestamp;
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

async function executeApprovalAction() {
  if (!PENDING_APPROVAL_ACTION_PAYLOAD) return;
  const inputNotes = document.getElementById("modal-appr-input-notes")?.value.trim() || "-";
  const btnConfirm = document.getElementById("btn-confirm-approval-action");
  const originalText = btnConfirm ? btnConfirm.innerHTML : "Konfirmasi";

  if (btnConfirm) {
    btnConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Memproses...';
    btnConfirm.disabled = true;
  }

  try {
    const res = await callApi("processApproval", {
      ...PENDING_APPROVAL_ACTION_PAYLOAD,
      catatan_approval: inputNotes
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
  } catch (e) {}
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
    return { level: "Normal", score: 0, reason: `Status Kontrak Non-Eligible (${contractStatus || "Non-Live"})` };
  }

  // -------------------------------------------------------------
  // LEVEL 1: SANGAT PENTING (Score: 3)
  // -------------------------------------------------------------
  if (concernUrgency === "Sangat Penting") {
    return { level: "Sangat Penting", score: 3, reason: `Assign Concern '${concernNote || "Sangat Penting"}'` };
  }
  if (["Pelepasan", "Offline", "Baterai Lemah"].some(s => gpsStatus.toLowerCase().includes(s.toLowerCase()))) {
    return { level: "Sangat Penting", score: 3, reason: `Status GPS: ${gpsStatus}` };
  }
  if (agingVisit >= 22 && lifetime > 90) {
    return { level: "Sangat Penting", score: 3, reason: `Aging Visit >= 22 hr (${agingVisit} hr) & Lifetime > 90 hr (${lifetime} hr)` };
  }
  if (agingVisit >= 15 && nearJto) {
    return { level: "Sangat Penting", score: 3, reason: `Aging Visit >= 15 hr (${agingVisit} hr) & Kondisi H-3 JTO` };
  }

  // -------------------------------------------------------------
  // LEVEL 2: PENTING (Score: 2)
  // -------------------------------------------------------------
  if (concernUrgency === "Penting") {
    return { level: "Penting", score: 2, reason: `Assign Concern '${concernNote || "Penting"}'` };
  }
  if (["Belum Lepas", "Belum Pasang", "Geser"].some(s => gpsStatus.toLowerCase().includes(s.toLowerCase()))) {
    return { level: "Penting", score: 2, reason: `Status GPS: ${gpsStatus}` };
  }
  if (agingVisit >= 3 && overdue >= 3) {
    return { level: "Penting", score: 2, reason: `Aging Visit >= 3 hr (${agingVisit} hr) & Overdue >= 3 hr (${overdue} hr)` };
  }
  if (agingVisit >= 5 && nearJto) {
    return { level: "Penting", score: 2, reason: `Aging Visit >= 5 hr (${agingVisit} hr) & Kondisi H-3 JTO` };
  }
  if (agingVisit >= 22) {
    return { level: "Penting", score: 2, reason: `Aging Visit Unit >= 22 hr (${agingVisit} hr)` };
  }

  // -------------------------------------------------------------
  // LEVEL 3: MODERAT (Score: 1)
  // -------------------------------------------------------------
  if (agingVisit >= 15) {
    return { level: "Moderat", score: 1, reason: `Aging Visit Unit >= 15 hr (${agingVisit} hr)` };
  }
  if (concernUrgency === "Moderat") {
    return { level: "Moderat", score: 1, reason: `Assign Concern '${concernNote || "Moderat"}'` };
  }
  if (agingGpsMaint > 30) {
    return { level: "Moderat", score: 1, reason: `Aging Maintenance GPS > 30 hr (${agingGpsMaint} hr)` };
  }

  // -------------------------------------------------------------
  // LEVEL 4: NORMAL (Score: 0)
  // -------------------------------------------------------------
  return { level: "Normal", score: 0, reason: "Kondisi Normal / Terjadwal Baik" };
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
    } catch (e) {}
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

  // Status Closed / Dormant
  const rawProd = String(dealer.productivity || "").trim().toLowerCase();
  const rawStatus = String(dealer.status || "").trim().toLowerCase();
  const isClosedOrDormant = rawProd.includes("closed") || rawProd.includes("cloesed") || rawProd.includes("dormant") || rawProd.includes("7.closed") || rawProd.includes("5.dormant") || rawStatus.includes("closed") || rawStatus.includes("dormant");
  const isAgingAllowed = !isClosedOrDormant;

  // A. Evaluasi Internal Dealer (Mitra Score)
  let mitraScore = 0;
  let mitraLevel = "Normal";
  let mitraReason = isClosedOrDormant ? "Mitra Closed / Dormant" : "Kondisi Normal";

  if (concernUrgency === "Sangat Penting") {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = `Concern Mitra: '${concernNote || "Sangat Penting"}'`;
  } else if (isAgingAllowed && agingMitra >= 61) {
    mitraScore = 3;
    mitraLevel = "Sangat Penting";
    mitraReason = `Aging Visit Mitra >= 61 hr (${agingMitra} hr)`;
  } else if (concernUrgency === "Penting") {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = `Concern Mitra: '${concernNote || "Penting"}'`;
  } else if (isAgingAllowed && agingMitra >= 31) {
    mitraScore = 2;
    mitraLevel = "Penting";
    mitraReason = `Aging Visit Mitra >= 31 hr (${agingMitra} hr)`;
  } else if (concernUrgency === "Moderat") {
    mitraScore = 1;
    mitraLevel = "Moderat";
    mitraReason = `Concern Mitra: '${concernNote || "Moderat"}'`;
  } else if (isAgingAllowed && agingMitra >= 21) {
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

      // Jika mitra berstatus Closed/Dormant, HANYA terima pemicu jika ada unit LIVE dengan concern atau anomali
      if (isClosedOrDormant && !isULive && !u.unit_concern) {
        return;
      }

      const uEval = calculateUnitUrgency(u);
      if (uEval.score > 0) {
        urgentUnitsCount++;
      }
      if (uEval.score > highestUnitScore) {
        highestUnitScore = uEval.score;
      }
    });
  }

  // Jika mitra Closed/Dormant dan tidak ada concern khusus dealer dan tidak ada unit LIVE yang urgent
  if (isClosedOrDormant && !concernUrgency && highestUnitScore === 0) {
    return {
      level: "Normal",
      score: 0,
      mitraLevel: "Normal",
      mitraScore: 0,
      mitraReason: "Mitra Closed / Dormant",
      urgentUnitsCount: urgentUnitsCount
    };
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

function startVisitForDealer(dealerId) {
  loadScreen('visit');
  setTimeout(() => {
    selectDealerFromSearch(dealerId);
  }, 120);
}

async function refreshPriorityData(btn) {
  const container = document.getElementById("priority-list-container");
  if (container) {
    container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-800"></i>Menyinkronkan data mitra dari Spreadsheet...</div>';
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

  // Kalkulasi evaluasi urgensi untuk semua dealer
  let computedList = MASTER_DEALER_PRIORITY_DATA.map(d => {
    const hasDbLevel = d.priority_level && d.priority_level.trim() !== "" && d.priority_level !== "undefined";
    const clientCalc = calculateMitraUrgency(d);

    const level = hasDbLevel ? d.priority_level : clientCalc.level;
    const score = (d.priority_score !== undefined && d.priority_score !== null && !isNaN(Number(d.priority_score))) ? Number(d.priority_score) : clientCalc.score;
    const reason = (d.priority_reason && d.priority_reason.trim() !== "" && d.priority_reason !== "-") ? d.priority_reason : clientCalc.mitraReason;
    const urgentUnits = (d.urgent_units_count !== undefined && d.urgent_units_count !== null && !isNaN(Number(d.urgent_units_count))) ? Number(d.urgent_units_count) : clientCalc.urgentUnitsCount;

    // Evaluasi apakah urgensi berasal dari internal mitra (aging/concern) atau pemicu unit
    let isMitraUrgent = false;
    let mitraLevel = "Normal";
    if (score > 0) {
      if (reason && reason.startsWith("Pemicu Unit")) {
        isMitraUrgent = false;
        mitraLevel = "Normal";
      } else {
        isMitraUrgent = true;
        mitraLevel = level;
      }
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
      mitraScore: isMitraUrgent ? score : 0,
      urgentUnitsCount: urgentUnits,
      visitedToday: isDealerVisitedToday(d)
    };
  });

  // Sorting: Pending First -> Prioritas tertinggi (Score DESC) -> Aging Visit tertinggi (Aging DESC)
  computedList.sort((a, b) => {
    if (a.visitedToday !== b.visitedToday) return a.visitedToday ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return (Number(b.aging_visit_mitra || 0)) - (Number(a.aging_visit_mitra || 0));
  });

  // 1. Filter Status Visit: Sembunyikan mitra yang sudah dikunjungi hari ini dari daftar aksi aktif
  if (PRIORITY_VISIT_STATUS_FILTER === "DONE") {
    computedList = computedList.filter(d => d.visitedToday);
  } else {
    // Default: Hanya tampilkan mitra yang belum dikunjungi hari ini
    computedList = computedList.filter(d => !d.visitedToday);
  }

  // 2. Filter Level Urgensi (Hanya tampilkan mitra yang memiliki prioritas: Sangat Penting, Penting, Moderat)
  if (PRIORITY_ACTIVE_FILTER !== "ALL") {
    computedList = computedList.filter(d => d.level === PRIORITY_ACTIVE_FILTER);
  } else {
    computedList = computedList.filter(d => d.level !== "Normal" && d.level !== "NORMAL" && (d.score || 0) > 0);
  }

  if (computedList.length === 0) {
    const filterText = PRIORITY_ACTIVE_FILTER === "ALL" ? "Prioritas Kunjungan Aktif" : `Level "${PRIORITY_ACTIVE_FILTER}"`;
    container.innerHTML = `
      <div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-1">
          <i class="fa-solid fa-circle-check"></i>
        </div>
        <p class="font-bold text-sm text-slate-800">Tidak ada data untuk ${filterText}</p>
        <p class="text-[11px] text-slate-400 max-w-xs mx-auto">Semua mitra saat ini dalam kondisi normal dan terjadwal dengan baik.</p>
        <button type="button" onclick="refreshPriorityData(this)" class="mt-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow inline-flex items-center space-x-1.5 transition">
          <i class="fa-solid fa-arrows-rotate"></i>
          <span>Muat Ulang Data</span>
        </button>
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

    // Status pill hanya ditampilkan jika sudah selesai hari ini (perlu dikunjungi cukup difilter di tab atas)
    const statusPill = d.visitedToday
      ? `<span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0 inline-flex items-center"><i class="fa-solid fa-circle-check mr-1 text-[7px]"></i> Selesai Hari Ini</span>`
      : ``;

    const visitActionBtn = d.visitedToday
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

    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <h4 class="font-bold text-xs sm:text-sm text-slate-900 truncate leading-tight">${d.dealer_name}</h4>
        <div class="flex items-center space-x-1.5 flex-wrap gap-y-1 mt-1">
          <span class="text-[10px] text-slate-500 font-medium">${d.cabang || "-"}</span>
          <span class="text-[8px] font-bold px-1.5 py-0.5 rounded-md ${urgencyPillStyles[d.level]} uppercase shrink-0">${d.level}</span>
          ${statusPill}
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

  document.getElementById("modal-facility-title").innerText = `Fasilitas: ${d.dealer_name}`;
  document.getElementById("modal-facility-sub").innerText = `Total ${eligibleUnits.length} Unit Prioritas/Concern (${d.cabang || "-"})`;

  const listContainer = document.getElementById("modal-facility-list");
  listContainer.innerHTML = "";

  if (eligibleUnits.length === 0) {
    listContainer.innerHTML = `<div class="p-6 text-center text-xs text-slate-400">Tidak ada unit dengan status prioritas atau concern aktif pada mitra ini.</div>`;
  } else {
    // Sorting: Unit urgent (Score tertinggi) di atas
    eligibleUnits.sort((a, b) => {
      const scoreA = calculateUnitUrgency(a).score;
      const scoreB = calculateUnitUrgency(b).score;
      return scoreB - scoreA;
    });

    eligibleUnits.forEach(u => {
      const uEval = calculateUnitUrgency(u);
      const itemCard = document.createElement("div");
      itemCard.className = "p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5";

      itemCard.innerHTML = `
        <div class="flex justify-between items-start">
          <div class="min-w-0 flex-1">
            <span class="font-bold text-slate-900 text-xs">${u.nopol}</span>
            <p class="text-[11px] text-slate-600 truncate">${u.unit}</p>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded border ${urgencyPillStyles[uEval.level]} shrink-0">${uEval.level}</span>
        </div>

        <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-500 pt-1 border-t border-slate-100">
          <div>GPS: <strong class="text-slate-700">${u.gps_status || "Normal"}</strong></div>
          <div>Aging Visit: <strong class="text-slate-700">${u.aging_visit_unit || 0} hr</strong></div>
          <div>Lifetime: <strong class="text-slate-700">${u.lifetime_days || 0} hr</strong></div>
          <div>Status OVD: <strong class="text-slate-700">${isUnitNearJTO(u) ? 'H-3 JTO' : (Number(u.overdue_days || 0) > 0 ? 'OVD ' + u.overdue_days + ' hr' : 'Lancar')}</strong></div>
        </div>

        <div class="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200 font-medium">
          Pemicu: <strong>${uEval.reason}</strong>${u.unit_concern ? `<br><span class="text-purple-800">Concern: "${typeof u.unit_concern === 'object' ? u.unit_concern.note : u.unit_concern}"</span>` : ''}
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
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
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
  const filtered = MASTER_DEALER_PRIORITY_DATA.filter(d => {
    if (!q) return true;
    const name = String(d.dealer_name || "").toLowerCase();
    const branch = String(d.cabang || "").toLowerCase();
    return name.includes(q) || branch.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-store-slash mb-1 block text-slate-300"></i>Tidak ada dealer yang cocok';
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
      opt.value = u.nopol;
      opt.innerText = `${u.nopol} - ${u.unit || u.tipe_unit || "Kendaraan"}`;
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

  // 2. Filter Unit Kendaraan Eligible
  const filtered = ACTIVE_ASSIGN_ELIGIBLE_UNITS.filter(u => {
    if (!q) return true;
    const nopol = String(u.nopol || "").toLowerCase();
    const unitName = String(u.unit || u.tipe_unit || "").toLowerCase();
    const status = String(u.contract_status || u.status_kontrak || u.status || "").toLowerCase();
    const imei = String(u.imei_gps || u.imei || "").toLowerCase();
    return nopol.includes(q) || unitName.includes(q) || status.includes(q) || imei.includes(q);
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
      selectAssignUnitFromSearch(u.nopol);
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
        <div class="font-bold text-slate-900 truncate">${u.nopol} - ${u.unit || u.tipe_unit || "Kendaraan"}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5 truncate">
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

function selectAssignUnitFromSearch(nopol) {
  const input = document.getElementById("assign-unit-search-input");
  const sel = document.getElementById("assign-select-unit");
  const clearBtn = document.getElementById("assign-unit-search-clear-btn");
  const chevron = document.getElementById("assign-unit-search-chevron");

  if (nopol === "Umum" || !nopol) {
    if (input) {
      input.value = "-- Umum (Seluruh Showroom / Non-Fasilitas) --";
    }
    if (sel) sel.value = "Umum";
    if (clearBtn) clearBtn.classList.add("hidden");
    if (chevron) chevron.classList.remove("hidden");
  } else {
    const u = ACTIVE_ASSIGN_ELIGIBLE_UNITS.find(item => item.nopol === nopol);
    if (u && input && sel) {
      input.value = `${u.nopol} - ${u.unit || u.tipe_unit || "Kendaraan"}`;
      sel.value = u.nopol;
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
  const dealerId = document.getElementById("assign-select-dealer").value;
  const selectDealer = document.getElementById("assign-select-dealer");
  const dealerName = selectDealer.options[selectDealer.selectedIndex].text;
  const unitVal = document.getElementById("assign-select-unit").value;
  const concernText = document.getElementById("assign-input-concern").value.trim();
  const urgencyVal = document.querySelector('input[name="assign_urgency"]:checked').value;

  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (d) {
    if (unitVal === "Umum") {
      d.dealer_concern = { urgency: urgencyVal, note: concernText };
    } else {
      const u = d.units?.find(unit => unit.nopol === unitVal);
      if (u) u.unit_concern = { urgency: urgencyVal, note: concernText };
    }
  }

  // Kirim ke backend Spreadsheet jika online
  callApi("saveAssignment", {
    assignedByUserId: CURRENT_USER?.nip || "ADM",
    assignedByUserName: CURRENT_USER?.nama || "Supervisor",
    dealerName: dealerName,
    unitFasilitas: unitVal,
    concernType: "Assign Concern",
    urgencyLevel: urgencyVal,
    instruksi: concernText
  });

  alert(`Concern ${urgencyVal} berhasil disimpan ke Priority Visit!`);
  loadScreen('priority');
}

// =========================================================================
// LAPORAN VISIT SHOWROOM
// =========================================================================
function populateVisitDealerOptions() {
  const sel = document.getElementById("input-dealer");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang || "-"})`;
    sel.appendChild(opt);
  });

  renderDealerSearchDropdown("");

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
  const filtered = MASTER_DEALER_PRIORITY_DATA.filter(d => {
    if (!q) return true;
    const name = String(d.dealer_name || "").toLowerCase();
    const branch = String(d.cabang || "").toLowerCase();
    return name.includes(q) || branch.includes(q);
  });

  dropdown.innerHTML = "";

  if (filtered.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "p-3 text-center text-xs text-slate-400";
    emptyDiv.innerHTML = '<i class="fa-solid fa-store-slash mb-1 block text-slate-300"></i>Tidak ada dealer yang cocok';
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
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  const input = document.getElementById("dealer-search-input");
  const sel = document.getElementById("input-dealer");
  const clearBtn = document.getElementById("dealer-search-clear-btn");
  const chevron = document.getElementById("dealer-search-chevron");

  if (d && input && sel) {
    input.value = `${d.dealer_name} (${d.cabang || "-"})`;
    sel.value = d.dealer_id;
    if (clearBtn) clearBtn.classList.remove("hidden");
    if (chevron) chevron.classList.add("hidden");
    closeDealerSearchDropdown();
    onDealerSelected(dealerId);
  }
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

function onLokasiVisitChanged(val) {
  const boxLain = document.getElementById("box-lokasi-lain");
  const inputLain = document.getElementById("input-lokasi-lain");
  const segmen2 = document.getElementById("segment-2-container");
  const stockInput = document.getElementById("input-stock-unit");
  const salesInput = document.getElementById("input-sales-unit");

  if (val === "Showroom") {
    boxLain.classList.add("hidden");
    inputLain.required = false;
    segmen2.classList.remove("hidden");
    stockInput.required = true;
    salesInput.required = true;
  } else {
    boxLain.classList.remove("hidden");
    inputLain.required = true;
    segmen2.classList.add("hidden");
    stockInput.required = false;
    salesInput.required = false;
  }
}

function toggleOwnerReason(show) {
  const box = document.getElementById("box-owner-reason");
  const input = document.getElementById("input-owner-reason");
  if (show) {
    box.classList.remove("hidden");
    input.required = true;
  } else {
    box.classList.add("hidden");
    input.required = false;
  }
}

function onDealerSelected(dealerId) {
  const container = document.getElementById("container-unit-list");
  const emptyBox = document.getElementById("box-empty-facility");
  const countBadge = document.getElementById("unit-count-badge");
  const boxConcern = document.getElementById("box-concern-prioritas");
  const textConcern = document.getElementById("text-concern-display");
  const inputTindakLanjut = document.getElementById("input-tindak-lanjut-concern");

  container.innerHTML = "";
  ACTIVE_UNITS_STATE = [];

  const dealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId);

  // 1. Evaluasi & Tampilkan Dynamic Concern Prioritas Box
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

      // Tampilkan atau sembunyikan kotak concern
      if (concernList.length > 0) {
        textConcern.innerHTML = concernList.join("\n\n");
        boxConcern.classList.remove("hidden");
        if (inputTindakLanjut) inputTindakLanjut.required = true;
      } else {
        boxConcern.classList.add("hidden");
        if (inputTindakLanjut) {
          inputTindakLanjut.required = false;
          inputTindakLanjut.value = "";
        }
      }
    } else {
      boxConcern.classList.add("hidden");
      if (inputTindakLanjut) {
        inputTindakLanjut.required = false;
        inputTindakLanjut.value = "";
      }
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
  if (TEMP_MODAL_PHOTO_BASE64) {
    if (imgUnitPreview) imgUnitPreview.src = TEMP_MODAL_PHOTO_BASE64;
    document.getElementById("modal-unit-photo-preview").classList.remove("hidden");
  } else {
    if (imgUnitPreview) imgUnitPreview.src = "";
    document.getElementById("modal-unit-photo-preview").classList.add("hidden");
  }

  document.getElementById("modal-input-indikasi").value = u.indikasi;
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
  } else {
    boxFoto.classList.add("hidden");
    boxIndikasi.classList.remove("hidden");
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
  }
}

function removeModalUnitPhoto() {
  document.getElementById("file-modal-unit-photo").value = "";
  TEMP_MODAL_PHOTO_BASE64 = null;
  const imgUnitPreview = document.getElementById("img-modal-unit-photo");
  if (imgUnitPreview) imgUnitPreview.src = "";
  document.getElementById("modal-unit-photo-preview").classList.add("hidden");
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

  u.terlihat = terlihatVal;
  u.foto_unit = (terlihatVal === "Ya") ? TEMP_MODAL_PHOTO_BASE64 : null;
  u.indikasi = document.getElementById("modal-input-indikasi").value;
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

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const crd = pos.coords;
        CURRENT_USER_GEO.lat = crd.latitude;
        CURRENT_USER_GEO.long = crd.longitude;
        CURRENT_USER_GEO.accuracy = crd.accuracy;
        const locStr = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (±${Math.round(crd.accuracy)}m)`;
        if (geoDisplay) geoDisplay.innerText = locStr;
        if (onbGeoDisplay) onbGeoDisplay.innerText = locStr;
      },
      () => {
        const fallback = "-6.295218, 106.638482 (Default GPS)";
        if (geoDisplay) geoDisplay.innerText = fallback;
        if (onbGeoDisplay) onbGeoDisplay.innerText = fallback;
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
}

async function handleShowroomPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    CURRENT_SHOWROOM_PHOTO_BASE64 = compressed;
    const imgPreview = document.getElementById("img-visit-showroom-preview");
    if (imgPreview) imgPreview.src = compressed;
    document.getElementById("preview-photo-card").classList.remove("hidden");
  }
}

function removePhoto() {
  document.getElementById("file-visit-photo").value = "";
  CURRENT_SHOWROOM_PHOTO_BASE64 = null;
  const imgPreview = document.getElementById("img-visit-showroom-preview");
  if (imgPreview) imgPreview.src = "";
  document.getElementById("preview-photo-card").classList.add("hidden");
}

async function handleFormSubmit(e) {
  e.preventDefault();

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
  const dealerId = dealerSelect.value;
  const dealerName = dealerSelect.options[dealerSelect.selectedIndex].text;
  const lokasi = document.querySelector('input[name="lokasi_visit"]:checked').value;
  const lokasiDetail = (lokasi === "Tempat Lainnya") ? document.getElementById("input-lokasi-lain").value : "Showroom";
  const bertemuOwner = document.querySelector('input[name="bertemu_owner"]:checked').value;
  const ownerReason = (bertemuOwner === "Tidak") ? document.getElementById("input-owner-reason").value : "-";

  // Tangkap Nilai Tindak Lanjut Concern Prioritas
  const boxConcern = document.getElementById("box-concern-prioritas");
  const tindakLanjutConcern = (!boxConcern || boxConcern.classList.contains("hidden")) 
    ? "-" 
    : (document.getElementById("input-tindak-lanjut-concern")?.value.trim() || "-");

  if (boxConcern && !boxConcern.classList.contains("hidden") && tindakLanjutConcern === "-") {
    alert("Wajib mengisi Tindak Lanjut / Hasil Pengecekan atas Concern Prioritas!");
    return;
  }

  let stock = "-";
  let sales = "-";
  let issueDigi = "-";
  let issueInternal = "-";
  let issueKomp = "-";

  if (lokasi === "Showroom") {
    stock = document.getElementById("input-stock-unit").value || "0";
    sales = document.getElementById("input-sales-unit").value || "0";
    issueDigi = document.getElementById("input-issue-digiasha").value || "-";
    issueInternal = document.getElementById("input-issue-internal").value || "-";
    issueKomp = document.getElementById("input-issue-kompetitor").value || "-";
  }

  const catatanVisit = document.getElementById("input-catatan-visit").value.trim() || "-";

  let waText = `*LAPORAN HASIL KUNJUNGAN MITRA*\n------------------------------------\n*Mitra:* ${dealerName}\n*Lokasi:* ${lokasi} (${lokasiDetail})\n*Bertemu Owner:* ${bertemuOwner}${bertemuOwner === 'Tidak' ? '(' + ownerReason + ')' : ''}\n`;
  
  if (tindakLanjutConcern !== "-") {
    waText += `*TINDAK LANJUT CONCERN PRIORITAS:*\n${tindakLanjutConcern}\n\n`;
  }

  if (lokasi === "Showroom") {
    waText += `*Stock Unit Showroom:* ${stock} Unit\n*Penjualan Bulan Ini:* ${sales} Unit\n\n`;
  } else {
    waText += `\n`;
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

  if (lokasi === "Showroom") {
    waText += `*CATATAN & ISSUE:*\n• Digiasha: ${issueDigi}\n• Internal Dealer: ${issueInternal}\n• Kompetitor: ${issueKomp}\n`;
  }

  waText += `• Catatan Visit: ${catatanVisit}\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)},${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  // Update State Lokal Secara Optimistis (Real-time Closed Loop)
  const targetDealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId || d.dealer_name === dealerName);
  if (targetDealer) {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    targetDealer.is_visited_today = true;
    targetDealer.last_visit_date = todayStr;
    targetDealer.aging_visit_mitra = 0;
    targetDealer.dealer_concern = null;
    if (targetDealer.units) {
      targetDealer.units.forEach(u => u.unit_concern = null);
    }
  }

  // Kirim ke Google Apps Script secara asynchronous
  callApi("submitVisit", {
    dealer_name: dealerName,
    lokasi: lokasi,
    bertemu_owner: bertemuOwner,
    owner_reason: ownerReason,
    stock: stock,
    sales: sales,
    issue_digi: issueDigi,
    issue_internal: issueInternal,
    issue_komp: issueKomp,
    catatan_visit: catatanVisit,
    tindak_lanjut_concern: tindakLanjutConcern,
    lat: CURRENT_USER_GEO.lat,
    long: CURRENT_USER_GEO.long,
    showroom_photo_base64: CURRENT_SHOWROOM_PHOTO_BASE64,
    unit_check_list: ACTIVE_UNITS_STATE,
    currentUser: CURRENT_USER
  });

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-emerald-600");
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

    const isSuper = CURRENT_USER?.role === "Super Admin" || CURRENT_USER?.role_id === "R-01" || !CURRENT_USER?.area_cover || CURRENT_USER?.area_cover === "*" || CURRENT_USER?.area_cover?.toUpperCase() === "ALL";
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
  return MASTER_DEALER_PRIORITY_DATA.filter(d => {
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
  const isSuper = !CURRENT_USER || 
    CURRENT_USER.role === "Super Admin" || 
    CURRENT_USER.role_id === "R-01" || 
    CURRENT_USER.role === "SUPERADMIN" || 
    CURRENT_USER.role === "DIREKSI" || 
    !CURRENT_USER.area_cover || 
    CURRENT_USER.area_cover.trim() === "" || 
    CURRENT_USER.area_cover.trim() === "*" || 
    CURRENT_USER.area_cover.trim().toUpperCase() === "ALL";

  const userAreas = (CURRENT_USER?.area_cover || "").split(/[,;/|]+/).map(a => a.trim().toLowerCase()).filter(Boolean);
  const userBranch = String(CURRENT_USER?.cabang || "").trim().toLowerCase();

  // 1. Filter dealers by cover area
  let coveredDealers = APP_STATE.dealers || [];
  if (!isSuper) {
    coveredDealers = coveredDealers.filter(d => {
      const dArea = String(d.area_cover || "").trim().toLowerCase();
      const dBranch = String(d.cabang || "").trim().toLowerCase();
      const matchArea = userAreas.length > 0 && userAreas.some(a => dArea.includes(a) || a.includes(dArea));
      const matchBranch = userBranch && userBranch !== "head office" && dBranch === userBranch;
      return matchArea || matchBranch;
    });
  }
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
      try {
        localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
      } catch (e) {}
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

    // Kelompokkan modul berdasarkan kategori
    const categories = ["Operasional Lapangan", "Presensi & Persetujuan", "Layanan & Support", "Administrasi & Sistem"];
    const groupedModulesHtml = categories.map(cat => {
      const catMods = ALL_APP_MODULES.filter(m => (m.category || "Operasional Lapangan") === cat);
      if (catMods.length === 0) return "";

      const itemsHtml = catMods.map(mod => {
        const isChecked = rolePerms.includes(mod.key);
        return `
          <label class="flex items-start space-x-2.5 p-2 bg-slate-50 hover:bg-purple-50/50 rounded-xl border border-slate-200 hover:border-purple-300 cursor-pointer transition select-none">
            <input type="checkbox" name="role_perm_${roleId}" value="${mod.key}" ${isChecked ? 'checked' : ''} class="mt-0.5 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer" />
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
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div class="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
          <div class="flex items-center space-x-2.5 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-base shrink-0">
              <i class="fa-solid ${role.icon || 'fa-user-gear'}"></i>
            </div>
            <div class="min-w-0">
              <div class="flex items-center space-x-2 flex-wrap">
                <span class="text-xs font-bold text-slate-900">${role.name}</span>
                <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${role.badgeBg || 'bg-purple-100 text-purple-800 border border-purple-200'}">${roleId}</span>
              </div>
              <p class="text-[10px] text-slate-500 mt-0.5">${role.desc || '-'}</p>
            </div>
          </div>
          <div class="flex items-center space-x-1.5 shrink-0 flex-wrap">
            <button type="button" onclick="openEditRoleInfoModal('${roleId}')" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 flex items-center space-x-1 transition" title="Ubah Nama & Info Role">
              <i class="fa-solid fa-pen text-[10px]"></i>
              <span>Edit Info</span>
            </button>
            ${!isCoreRole ? `
              <button type="button" onclick="deleteCustomRole('${roleId}')" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs border border-rose-200 flex items-center space-x-1 transition" title="Hapus Role">
                <i class="fa-solid fa-trash-can text-[10px]"></i>
              </button>
            ` : ''}
            <button type="button" onclick="saveRolePermissions('${roleId}')" class="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs shadow-xs flex items-center space-x-1.5 transition">
              <i class="fa-solid fa-floppy-disk text-xs"></i>
              <span>Simpan Hak Akses</span>
            </button>
          </div>
        </div>

        <div class="space-y-3">
          ${groupedModulesHtml}
        </div>
      </div>
    `;
  }).join('');
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
      permissions: ["priority", "visit", "onboarding", "pipeline", "gps", "history"]
    };
    showToast(`Role baru ${name} (${id}) berhasil ditambahkan!`, "success", 2000);
  } else {
    if (!ROLE_PERMISSIONS_STATE[id]) return;
    ROLE_PERMISSIONS_STATE[id].name = name;
    ROLE_PERMISSIONS_STATE[id].desc = desc;
    ROLE_PERMISSIONS_STATE[id].icon = icon;
    ROLE_PERMISSIONS_STATE[id].color = color;
    ROLE_PERMISSIONS_STATE[id].badgeBg = badgeBg;
    showToast(`Informasi role ${name} (${id}) berhasil diperbarui!`, "success", 2000);
  }

  localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));
  
  if (supabaseClient) {
    const roleObj = ROLE_PERMISSIONS_STATE[id];
    supabaseClient.from("m_role_permission").upsert({
      role_id: id,
      role_name: name,
      permission_keys: roleObj?.permissions || [],
      updated_at: new Date().toISOString()
    }, { onConflict: "role_id" }).then(({ error }) => {
      if (error) console.warn("Error sync role to supabase:", error);
    });
  }

  closeRoleModal();
  loadRolePermissionsSettings();
  populateEmployeeRoleOptions();
  if (SETTINGS_EMPLOYEES_DATA && SETTINGS_EMPLOYEES_DATA.length > 0) {
    renderEmployeeList(SETTINGS_EMPLOYEES_DATA);
  }
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

  if (supabaseClient) {
    try {
      await supabaseClient.from("m_role_permission").delete().eq("role_id", roleId);
    } catch (e) {}
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

    if (supabaseClient) {
      const roleObj = ROLE_PERMISSIONS_STATE[roleId];
      const { error } = await supabaseClient
        .from("m_role_permission")
        .upsert({
          role_id: roleId,
          role_name: roleObj?.name || roleId,
          permission_keys: selected,
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
      } catch (e) {}
      initDashboard();
    }
  } catch (err) {
    alert("Gagal menyimpan hak akses role: " + err.message);
  }
}

async function syncRolePermissionsFromSupabase() {
  if (!supabaseClient) return;
  try {
    const { data: permsData, error } = await supabaseClient.from("m_role_permission").select("*");
    if (!error && permsData && permsData.length > 0) {
      permsData.forEach(r => {
        const rId = String(r.role_id || "").trim();
        if (!rId) return;
        if (ROLE_PERMISSIONS_STATE[rId]) {
          if (Array.isArray(r.permission_keys)) {
            ROLE_PERMISSIONS_STATE[rId].permissions = r.permission_keys;
          }
          if (r.role_name) ROLE_PERMISSIONS_STATE[rId].name = r.role_name;
        } else {
          ROLE_PERMISSIONS_STATE[rId] = {
            name: r.role_name || rId,
            icon: "fa-user-gear",
            color: "purple",
            badgeBg: "bg-purple-100 text-purple-800 border border-purple-200",
            desc: `Role ${r.role_name || rId}`,
            permissions: Array.isArray(r.permission_keys) ? r.permission_keys : []
          };
        }
      });
      try {
        localStorage.setItem("DIGIASHA_ROLE_PERMS", JSON.stringify(ROLE_PERMISSIONS_STATE));
      } catch (e) {}

      // Refresh CURRENT_USER permissions if logged in
      if (CURRENT_USER) {
        const uRole = CURRENT_USER.role || CURRENT_USER.role_id || CURRENT_USER.jabatan;
        const freshPerms = getPermissionsForRole(CURRENT_USER.role_id || uRole, CURRENT_USER);
        CURRENT_USER.permissions = freshPerms;
        try {
          localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(CURRENT_USER));
        } catch (e) {}
        // Refresh dashboard buttons if on dashboard
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

function resetRolePermissionsToDefault() {
  if (!confirm("Kembalikan seluruh konfigurasi hak akses role ke pengaturan default sistem?")) return;
  ROLE_PERMISSIONS_STATE = JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  localStorage.removeItem("DIGIASHA_ROLE_PERMS");
  loadRolePermissionsSettings();
  populateEmployeeRoleOptions();
  showToast("Hak akses seluruh role telah dikembalikan ke default!", "success", 2000);
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
    const isSuper = CURRENT_USER?.role === "SUPER_ADMIN" || CURRENT_USER?.role === "SUPERVISOR" || CURRENT_USER?.role === "DIREKSI" || CURRENT_USER?.role === "SUPERADMIN";
    const userNip = CURRENT_USER?.nip || null;

    // 1. Query Visit Mitra
    let qVisit = supabaseClient.from("tr_laporan_visit").select("*").order("created_at", { ascending: false }).limit(100);
    if (!isSuper && userNip) qVisit = qVisit.eq("nip", userNip);

    // 2. Query Calon Mitra
    let qOnb = supabaseClient.from("tr_onboarding_log").select("*").order("created_at", { ascending: false }).limit(100);
    if (!isSuper && userNip) qOnb = qOnb.eq("nip", userNip);

    // 3. Query GPS Maintenance
    let qGps = supabaseClient.from("tr_gps_maintenance").select("*").order("created_at", { ascending: false }).limit(100);
    if (!isSuper && userNip) qGps = qGps.eq("nip", userNip);

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
    komitmen: "Tidak Ada"
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
      if (val && val !== "-") result.komitmen = val;
    }
  });

  return result;
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
    let unitsHtml = "";
    if (checkedUnits.length > 0) {
      unitsHtml = `
        <div class="mt-3 pt-3 border-t border-slate-200 space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-slate-800 block">Checklist Unit yang Dikunjungi (${checkedUnits.length} Unit):</span>
            <span class="text-[10px] text-slate-400">Status, checklist & plan</span>
          </div>
          <div class="space-y-3">
            ${checkedUnits.map((u, idx) => {
              const parsed = parseCatatanUnit(u.catatan_unit);
              const checkId = u.check_id || u.id;
              const isAda = u.status_keberadaan === "Ya" || u.status_keberadaan === "Ya, Terlihat" || u.status_keberadaan === "Terlihat di Showroom";
              const statusVal = isAda ? "Ya, Terlihat" : "Tidak Terlihat";
              const gpsMatchVal = (u.kondisi_unit === "Tidak Sesuai" || u.kondisi_unit === "Tidak") ? "Tidak Sesuai" : "Ya, Sesuai";
              const hasLainnya = parsed.infoList.includes("Lainnya") || (parsed.infoLainnya && parsed.infoLainnya.trim() !== "");

              return `
                <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2.5 hist-unit-card" data-check-id="${checkId}">
                  <!-- Unit Header -->
                  <div class="flex justify-between items-start">
                    <div class="min-w-0">
                      <span class="font-bold text-xs text-slate-900 block leading-tight">${idx + 1}. ${u.nopol || 'Unit'} - ${u.unit_desc || ''}</span>
                      <span class="text-[10px] text-slate-400 font-mono">${u.no_fasilitas || '-'}</span>
                    </div>
                    ${u.foto_unit_url ? `
                      <a href="${u.foto_unit_url}" target="_blank" class="w-10 h-10 rounded-lg overflow-hidden border border-slate-300 bg-slate-200 shrink-0 block hover:opacity-80 transition" title="Lihat Foto Fisik Unit">
                        <img src="${u.foto_unit_url}" alt="Foto Unit" class="w-full h-full object-cover" />
                      </a>
                    ` : ''}
                  </div>

                  <!-- 1. Status Keberadaan Unit -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-600">Apakah Unit Terlihat di Lokasi?</label>
                    <select ${isReadOnly ? 'disabled' : ''} onchange="toggleHistUnitAda(this.value, '${checkId}')" class="hist-unit-ada w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                      <option value="Ya, Terlihat" ${statusVal === 'Ya, Terlihat' ? 'selected' : ''}>Ya, Terlihat</option>
                      <option value="Tidak Terlihat" ${statusVal === 'Tidak Terlihat' ? 'selected' : ''}>Tidak Terlihat</option>
                    </select>
                  </div>

                  <!-- Indikasi Keberadaan (Tampil jika Tidak Terlihat) -->
                  <div id="box-hist-indikasi-${checkId}" class="${statusVal === 'Tidak Terlihat' ? '' : 'hidden'} p-2 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                    <label class="block text-[10px] font-bold text-amber-900">Indikasi Keberadaan Unit:</label>
                    <input type="text" ${isReadOnly ? 'disabled' : ''} value="${parsed.indikasi}" placeholder="Contoh: Unit dipinjam owner / test drive" class="hist-unit-indikasi w-full bg-white border border-amber-300 rounded-lg p-1.5 text-xs text-slate-800" />
                  </div>

                  <!-- 2. Titik GPS Sesuai Lokasi Visit? -->
                  <div class="space-y-1">
                    <label class="block text-[10px] font-bold text-slate-600">Titik GPS Sesuai Lokasi Visit?</label>
                    <select ${isReadOnly ? 'disabled' : ''} class="hist-unit-gps-match w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                      <option value="Ya, Sesuai" ${gpsMatchVal === 'Ya, Sesuai' ? 'selected' : ''}>Ya, Sesuai</option>
                      <option value="Tidak Sesuai" ${gpsMatchVal === 'Tidak Sesuai' ? 'selected' : ''}>Tidak Sesuai</option>
                    </select>
                  </div>

                  <!-- 3. Info Status Unit (Multi Checkbox + Lainnya Free Text) -->
                  <div class="space-y-1.5">
                    <label class="block text-[10px] font-bold text-slate-600">Info Status Unit (Bisa Pilih >1):</label>
                    <div class="grid grid-cols-2 gap-1.5 bg-white p-2.5 rounded-xl border border-slate-200 text-[11px]">
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

                  <!-- 4. Plan Penyelesaian Overdue & Komitmen -->
                  <div class="space-y-2 pt-1 border-t border-slate-200">
                    <div class="p-2.5 bg-red-50/60 rounded-xl border border-red-200 space-y-1">
                      <label class="block font-bold text-red-900 text-[10px]">Plan Penyelesaian Overdue (Free Text):</label>
                      <textarea ${isReadOnly ? 'disabled' : ''} rows="2" placeholder="Rencana penanganan pelunasan unit..." class="hist-unit-ovd-plan w-full bg-white border border-red-300 rounded-lg p-2 text-xs text-slate-800 focus:ring-2 focus:ring-red-500">${parsed.ovdPlan}</textarea>
                    </div>

                    <div>
                      <label class="block text-[10px] font-bold text-slate-600 mb-0.5">Komitmen Pembayaran:</label>
                      <select ${isReadOnly ? 'disabled' : ''} class="hist-unit-komitmen w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-slate-800">
                        <option value="Tidak Ada" ${parsed.komitmen === 'Tidak Ada' ? 'selected' : ''}>Tidak Ada Komitmen</option>
                        <option value="Sudah Bayar" ${parsed.komitmen === 'Sudah Bayar' ? 'selected' : ''}>Sudah Bayar</option>
                        <option value="Bayar" ${parsed.komitmen === 'Bayar' ? 'selected' : ''}>Bayar</option>
                        <option value="Serahkan Unit" ${parsed.komitmen === 'Serahkan Unit' ? 'selected' : ''}>Serahkan Unit</option>
                      </select>
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    fieldsContainer.innerHTML = `
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Bertemu Owner:</label>
            <select id="edit-visit-bertemu" ${disabledAttr}>
              <option value="Ya" ${raw.bertemu_owner === 'Ya' ? 'selected' : ''}>Ya</option>
              <option value="Tidak" ${raw.bertemu_owner === 'Tidak' ? 'selected' : ''}>Tidak</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Alasan Tidak Bertemu:</label>
            <input type="text" id="edit-visit-reason" value="${raw.owner_reason || ''}" placeholder="Jika tidak bertemu" ${disabledAttr} />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Total Stok Unit:</label>
            <input type="number" id="edit-visit-stock" value="${raw.stock || 0}" ${disabledAttr} />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-600 mb-1">Total Sales Bulanan:</label>
            <input type="number" id="edit-visit-sales" value="${raw.sales || 0}" ${disabledAttr} />
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">Catatan Kunjungan:</label>
          <textarea id="edit-visit-notes" rows="3" placeholder="Catatan hasil kunjungan mitra..." ${disabledAttr}>${raw.catatan_visit || ''}</textarea>
        </div>

        <div>
          <label class="block text-[10px] font-bold text-slate-600 mb-1">Tindak Lanjut Concern Prioritas:</label>
          <textarea id="edit-visit-concern" rows="2" placeholder="Tindak lanjut concern yang ditugaskan..." ${disabledAttr}>${raw.tindak_lanjut_concern || ''}</textarea>
        </div>

        <div class="grid grid-cols-1 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <span class="text-[10px] font-bold text-slate-500 uppercase">Isu / Feedback Lapangan</span>
          <div>
            <label class="block text-[10px] text-slate-600 mb-0.5">Isu Digiasha:</label>
            <input type="text" id="edit-visit-issue-digi" value="${raw.issue_digi || ''}" placeholder="Isu sistem/layanan Digiasha" ${disabledAttr} />
          </div>
          <div>
            <label class="block text-[10px] text-slate-600 mb-0.5">Isu Internal Mitra:</label>
            <input type="text" id="edit-visit-issue-internal" value="${raw.issue_internal || ''}" placeholder="Isu internal mitra" ${disabledAttr} />
          </div>
          <div>
            <label class="block text-[10px] text-slate-600 mb-0.5">Isu Kompetitor:</label>
            <input type="text" id="edit-visit-issue-komp" value="${raw.issue_komp || ''}" placeholder="Aktivitas kompetitor" ${disabledAttr} />
          </div>
        </div>

        ${unitsHtml}
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
      const bertemuOwner = document.getElementById("edit-visit-bertemu")?.value || "Ya";
      const ownerReason = document.getElementById("edit-visit-reason")?.value || "";
      const stock = parseInt(document.getElementById("edit-visit-stock")?.value) || 0;
      const sales = parseInt(document.getElementById("edit-visit-sales")?.value) || 0;
      const notes = document.getElementById("edit-visit-notes")?.value || "";
      const concern = document.getElementById("edit-visit-concern")?.value || "";
      const issueDigi = document.getElementById("edit-visit-issue-digi")?.value || "";
      const issueInternal = document.getElementById("edit-visit-issue-internal")?.value || "";
      const issueKomp = document.getElementById("edit-visit-issue-komp")?.value || "";

      // 1. Update tr_laporan_visit
      const { error: visitErr } = await supabaseClient.from("tr_laporan_visit").update({
        bertemu_owner: bertemuOwner,
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

      // 2. Update tr_visit_unit_check child items
      const unitCards = document.querySelectorAll(".hist-unit-card");

      for (let i = 0; i < unitCards.length; i++) {
        const card = unitCards[i];
        const checkId = card.getAttribute("data-check-id");
        if (!checkId) continue;

        const uAda = card.querySelector(".hist-unit-ada")?.value || "Ya, Terlihat";
        const uIndikasi = card.querySelector(".hist-unit-indikasi")?.value || "";
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

        const uOvdPlan = card.querySelector(".hist-unit-ovd-plan")?.value?.trim() || "";
        const uKomitmen = card.querySelector(".hist-unit-komitmen")?.value || "Tidak Ada";

        const constructedNotes = `Indikasi: ${uIndikasi || '-'}; Info: ${finalInfoList.length > 0 ? finalInfoList.join(', ') : '-'}; Plan: ${uOvdPlan || '-'}; Komitmen: ${uKomitmen}`;

        await supabaseClient.from("tr_visit_unit_check").update({
          status_keberadaan: uAda,
          kondisi_unit: uGpsMatch,
          catatan_unit: constructedNotes
        }).eq("check_id", checkId);
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
        const uploadedUrl = await uploadToSupabaseStorage(pf.base64, "onboarding", `DOC-${docKey}-${Date.now()}-${i+1}`);
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
    } catch (err) {}

    closeForceChangePassModal();
    alert("Kata sandi berhasil diperbarui! Selamat datang di Digiasha Monitoring.");
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
    if (CURRENT_USER) {
      if (CURRENT_USER.status_ganti_pass === true || String(CURRENT_USER.status_ganti_pass).toLowerCase() === "true") {
        await loadScreen("login");
        if (typeof openForceChangePassModal === "function") openForceChangePassModal();
      } else {
        await loadScreen("dashboard");
        syncMasterDataFromApi();
      }
    } else {
      await loadScreen("login");
    }
  } catch (err) {
    console.error("Critical error in initAppBootstrap:", err);
    const container = document.getElementById("main-view-container");
    if (container && (!container.innerHTML || container.innerHTML.trim() === "")) {
      loadScreen("login");
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAppBootstrap);
} else {
  initAppBootstrap();
}

document.addEventListener("click", function(e) {
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