/**
 * CORE LOGIC & ENGINE DIGIASHA APP (PRODUCTION READY - GOOGLE SPREADSHEET API)
 */
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

// Hak Akses Modul per Role (Mendukung ID DB R-01 s/d R-04 dan Dynamic DB Permissions)
const ROLE_PERMISSIONS = {
  "Admin": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "R-01": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "Super Admin": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "Supervisor": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "Branch Manager": ["priority", "assignment", "visit", "onboarding", "gps"],
  "R-02": ["priority", "assignment", "visit", "onboarding", "gps"],
  "FAC": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "R-03": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
  "Other": ["priority"],
  "R-04": ["priority"],
  "Field PIC": ["priority", "visit", "onboarding", "gps"]
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
let ACTIVE_ABSEN_TYPE = null;
let CURRENT_ABSEN_SELFIE_BASE64 = null;

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
// API CALLER HELPER (GOOGLE APPS SCRIPT WEB APP)
// =========================================================================
async function callApi(action, data = {}) {
  if (typeof CONFIG === "undefined" || !CONFIG.USE_ONLINE_DB || !CONFIG.API_URL || CONFIG.API_URL.includes("MASUKKAN_URL")) {
    return { success: false, message: "Mode offline / URL API belum dikonfigurasi." };
  }

  try {
    const payload = { action, ...data };
    const res = await fetch(CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch (err) {
    console.error("API Call Error:", err);
    return { success: false, message: "Koneksi API Gagal: " + err.message };
  }
}

// Sinkronisasi Data Master dari Google Spreadsheet
async function syncMasterDataFromApi() {
  try {
    const res = await callApi("getMasterData");
    if (res && res.success) {
      let rawDealers = res.dealers || [];
      let rawUnits = res.units || [];
      let rawAssignments = res.assignments || [];

      // Hak Akses Berdasarkan Coverage Area:
      // Jika user Super Admin atau area_cover bernilai kosong / 'ALL' / '*', user dapat mengakses seluruh mitra.
      // Jika memiliki area_cover spesifik (mendukung multi-area dengan koma, misal: 'TNG-1, TNG-2'), lakukan filter scoping.
      if (CURRENT_USER && CURRENT_USER.role !== "Super Admin" && CURRENT_USER.area_cover && CURRENT_USER.area_cover.trim() !== "" && CURRENT_USER.area_cover.trim().toUpperCase() !== "ALL" && CURRENT_USER.area_cover.trim() !== "*") {
        const userAreas = CURRENT_USER.area_cover.split(/[,;/|]+/).map(a => a.trim().toLowerCase()).filter(Boolean);
        if (userAreas.length > 0) {
          rawDealers = rawDealers.filter(d => {
            const dArea = String(d.area_cover || "").trim().toLowerCase();
            return dArea && userAreas.includes(dArea);
          });
          const allowedDealerNames = new Set(rawDealers.map(d => String(d.dealer_name).trim().toLowerCase()));
          rawUnits = rawUnits.filter(u => allowedDealerNames.has(String(u.dealer_name).trim().toLowerCase()));
          rawAssignments = rawAssignments.filter(a => allowedDealerNames.has(String(a.dealer_name).trim().toLowerCase()));
        }
      }

      APP_STATE.dealers = rawDealers;
      APP_STATE.units = rawUnits;
      APP_STATE.idleGps = res.idleGps || [];
      APP_STATE.assignments = rawAssignments;

      // Sinkronkan daftar lokasi kantor geofence jika ada dari API
      if (res.workLocations && Array.isArray(res.workLocations) && res.workLocations.length > 0) {
        OFFICE_LOCATIONS = res.workLocations;
      }

      // Kelompokkan unit per dealer
      const vehiclesByDealer = {};
      APP_STATE.dealers.forEach(d => {
        d.units = APP_STATE.units.filter(u => String(u.dealer_name).trim().toLowerCase() === String(d.dealer_name).trim().toLowerCase());
        vehiclesByDealer[d.dealer_id] = d.units.map(u => ({
          no_fasilitas: u.no_fasilitas || "",
          nopol: u.nopol,
          unit: u.unit,
          contract_status: u.contract_status,
          gps_status: (u.imei_gps && u.gps_status !== "Tidak Pasang") ? "TERPASANG" : "BELUM_PASANG",
          imei: u.imei_gps
        }));
      });
      APP_STATE.masterVehiclesGps = vehiclesByDealer;
      // Pasangkan active assignments dari Google Spreadsheet ke Dealer & Unit Concern
      if (APP_STATE.assignments && APP_STATE.assignments.length > 0) {
        APP_STATE.assignments.forEach(a => {
          const d = APP_STATE.dealers.find(dlr => String(dlr.dealer_name).trim().toLowerCase() === String(a.dealer_name).trim().toLowerCase());
          if (d) {
            const unitFas = String(a.unit_fasilitas || "Umum").trim();
            if (unitFas === "Umum" || unitFas.toLowerCase().includes("seluruh")) {
              d.dealer_concern = { urgency: a.urgency_level || "Penting", note: a.instruksi || "-" };
            } else {
              const u = d.units?.find(unit => String(unit.nopol).trim().toLowerCase() === unitFas.toLowerCase() || unitFas.toLowerCase().includes(String(unit.nopol).trim().toLowerCase()));
              if (u) {
                u.unit_concern = { urgency: a.urgency_level || "Penting", note: a.instruksi || "-" };
              }
            }
          }
        });
      }

      MASTER_DEALER_PRIORITY_DATA = JSON.parse(JSON.stringify(APP_STATE.dealers));

      // Buat list FAC GPS Monitoring
      FAC_GPS_MONITORING_DATA = APP_STATE.units.map((u, i) => {
        let codes = [];
        if (u.gps_status === "Tidak Pasang") codes = ["1"];
        else if (u.gps_status === "Belum Lepas") codes = ["2"];
        else if (u.gps_status === "Belum Pasang") codes = ["3"];
        else if (u.gps_status === "Baterai Lemah") codes = ["4"];
        else if (u.gps_status === "Geser") codes = ["5"];
        else if (u.gps_status === "Pelepasan") codes = ["6"];
        else if (u.gps_status === "Offline") codes = ["7"];

        return {
          id: `U-${String(i + 1).padStart(2, '0')}`,
          no_fasilitas: u.no_fasilitas || "",
          dealer: u.dealer_name,
          asset_desc: `${u.unit} (${u.nopol})`,
          nopol: u.nopol,
          imei: u.imei_gps,
          status_kontrak: u.contract_status,
          gps_installed: !!u.imei_gps,
          status_codes: codes,
          catatan: ""
        };
      });

      console.log("Data master berhasil disinkronkan dari Google Spreadsheet!");
    }
  } catch (err) {
    console.warn("Gagal sync master data online:", err);
  }
}

// =========================================================================
// ROUTER & SCREEN LOADER
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

  if (screenName === "login") {
    topbar.classList.add("hidden");
  } else {
    topbar.classList.remove("hidden");
    const areaSuffix = CURRENT_USER.area_cover ? ` • Area: ${CURRENT_USER.area_cover}` : "";
    sub.innerText = `${CURRENT_USER.nama} • ${CURRENT_USER.role}${areaSuffix}`;
    if (screenName === "dashboard") {
      btnBack.classList.add("hidden");
      title.innerText = "Digiasha Monitoring";
    } else {
      btnBack.classList.remove("hidden");
      const titles = {
        visit: "Laporan Visit Mitra",
        onboarding: "Visit Calon Mitra",
        gps: "GPS Maintenance",
        priority: "Priority Visit",
        assignment: "Assign Concern Visit",
        fac: "Laporan GPS (FAC)",
        absensi: "Presensi Kehadiran"
      };
      title.innerText = titles[screenName] || "Monitoring";
    }
  }

  container.innerHTML = '<div class="py-12 text-center text-xs text-slate-400"><i class="fa-solid fa-circle-notch fa-spin text-lg mb-2 block text-slate-800"></i>Memuat halaman...</div>';

  try {
    if (!screenCache[screenName]) {
      const res = await fetch(`screens/${screenName}.html`);
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
    if (screenName === "gps") initGpsScreen();
    if (screenName === "fac") { renderLegendFilters(); renderFacGpsList(); }
    if (screenName === "absensi") acquireAbsenLocation();

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
    const res = await callApi("login", { identifier, password });
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;

    if (!res || !res.success) {
      alert("Gagal Login: " + (res?.message || "Akun tidak terdaftar atau kata sandi salah."));
      return;
    }

    CURRENT_USER = res.user;
    try {
      localStorage.setItem("DIGIASHA_AUTH_USER", JSON.stringify(res.user));
    } catch (err) {}

    await syncMasterDataFromApi();
    loadScreen("dashboard");
  } catch (err) {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
    alert("Error login: " + err.message);
  }
}

function handleLogout() {
  localStorage.removeItem("DIGIASHA_AUTH_USER");
  CURRENT_USER = null;
  loadScreen("login");
}

// Controller Dashboard
function initDashboard() {
  if (!CURRENT_USER) return;
  document.getElementById("dash-user-name").innerText = `Halo, ${CURRENT_USER.nama}!`;
  const areaInfo = CURRENT_USER.area_cover ? ` • Area: ${CURRENT_USER.area_cover}` : "";
  document.getElementById("dash-user-branch").innerText = `Cabang: ${CURRENT_USER.cabang}${areaInfo}`;
  document.getElementById("badge-role").innerText = CURRENT_USER.role || CURRENT_USER.role_id || "Karyawan";

  const perms = (Array.isArray(CURRENT_USER.permissions) && CURRENT_USER.permissions.length > 0)
    ? CURRENT_USER.permissions
    : (ROLE_PERMISSIONS[CURRENT_USER.role] || ROLE_PERMISSIONS[CURRENT_USER.role_id] || ["priority", "assignment", "visit", "onboarding", "gps", "fac"]);

  ["priority", "assignment", "visit", "onboarding", "gps", "fac"].forEach(key => {
    const btn = document.getElementById(`menu-btn-${key}`);
    if (btn) btn.style.display = perms.includes(key) ? "flex" : "none";
  });
}

// =========================================================================
// GEOFENCE & ABSENSI
// =========================================================================
function openAbsenChoiceModal() { document.getElementById("modal-absen-choice").classList.remove("hidden"); }
function closeAbsenChoiceModal() { document.getElementById("modal-absen-choice").classList.add("hidden"); }

function selectAbsenType(type) {
  ACTIVE_ABSEN_TYPE = type;
  closeAbsenChoiceModal();
  loadScreen("absensi");
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
  const banner = document.getElementById("absen-type-banner");
  const bannerTitle = document.getElementById("absen-type-title");
  const bannerIcon = document.getElementById("absen-type-icon");
  const boxDist = document.getElementById("box-distance-office");

  if (bannerTitle) bannerTitle.innerText = ACTIVE_ABSEN_TYPE || "Masuk Kantor";

  if (ACTIVE_ABSEN_TYPE === "Masuk Kantor") {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-slate-900";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-building text-2xl text-emerald-400";
    if (boxDist) boxDist.classList.remove("hidden");
  } else {
    if (banner) banner.className = "p-3.5 rounded-2xl text-white shadow-sm flex items-center justify-between bg-teal-700";
    if (bannerIcon) bannerIcon.className = "fa-solid fa-route text-2xl text-teal-200";
    if (boxDist) boxDist.classList.add("hidden");
  }

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

        if (ACTIVE_ABSEN_TYPE === "Masuk Kantor") {
          if (distDisplay) distDisplay.innerText = `${nearest.distance} Meter (Maks ${nearest.maxRadiusMeter}m)`;
          if (nearest.distance <= nearest.maxRadiusMeter) {
            CURRENT_USER_GEO.isInsideRadius = true;
            if (badge) { badge.innerText = `Radius Valid (${nearest.name})`; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800"; }
          } else {
            CURRENT_USER_GEO.isInsideRadius = false;
            if (badge) { badge.innerText = `Di Luar Radius (${nearest.distance}m)`; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-red-100 text-red-800"; }
          }
        } else {
          CURRENT_USER_GEO.isInsideRadius = true;
          if (badge) { badge.innerText = "Geotag Terverifikasi"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-teal-100 text-teal-800"; }
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

async function handleAbsenSelfieSelected(input) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    CURRENT_ABSEN_SELFIE_BASE64 = compressed;

    const imgPreview = document.getElementById("img-absen-selfie-preview");
    if (imgPreview) imgPreview.src = compressed;

    const triggerBtn = document.getElementById("btn-trigger-absen-selfie");
    const previewCard = document.getElementById("preview-absen-selfie-card");
    if (triggerBtn) triggerBtn.classList.add("hidden");
    if (previewCard) previewCard.classList.remove("hidden");
  }
}

function removeAbsenSelfie() {
  const fileInput = document.getElementById("file-absen-selfie");
  if (fileInput) fileInput.value = "";
  CURRENT_ABSEN_SELFIE_BASE64 = null;

  const triggerBtn = document.getElementById("btn-trigger-absen-selfie");
  const previewCard = document.getElementById("preview-absen-selfie-card");
  if (triggerBtn) triggerBtn.classList.remove("hidden");
  if (previewCard) previewCard.classList.add("hidden");
}

// Helper Toast Notification Auto-Close
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

async function handleAbsenSubmit(e) {
  e.preventDefault();
  if (ACTIVE_ABSEN_TYPE === "Masuk Kantor" && !CURRENT_USER_GEO.isInsideRadius) {
    showToast(`Lokasi di luar radius (${CURRENT_USER_GEO.distanceToOffice}m / Maks 100m)`, "error", 2500);
    return;
  }
  if (!CURRENT_ABSEN_SELFIE_BASE64) {
    showToast("Wajib mengambil foto selfie kehadiran!", "warning", 2000);
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.innerHTML : "Kirim Presensi Sekarang";
  if (submitBtn) {
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> Menyimpan Presensi...';
    submitBtn.disabled = true;
  }

  const catatan = document.getElementById("absen-input-catatan")?.value.trim() || "-";
  const selfieData = CURRENT_ABSEN_SELFIE_BASE64;

  try {
    const res = await callApi("submitAbsensi", {
      nip: CURRENT_USER?.nip || "-",
      nama: CURRENT_USER?.nama || "-",
      role: CURRENT_USER?.role || "-",
      cabang: CURRENT_USER?.cabang || "-",
      jenis_absen: ACTIVE_ABSEN_TYPE || "Masuk Kantor",
      lokasi_kantor: CURRENT_USER_GEO.nearestOffice?.name || "Kantor Pusat",
      distance_meters: CURRENT_USER_GEO.distanceToOffice || 0,
      lat: CURRENT_USER_GEO.lat || 0,
      long: CURRENT_USER_GEO.long || 0,
      catatan: catatan,
      selfie_base64: selfieData
    });

    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }

    // Reset state absensi
    removeAbsenSelfie();
    const inputCatatan = document.getElementById("absen-input-catatan");
    if (inputCatatan) inputCatatan.value = "";

    showToast(`Presensi "${ACTIVE_ABSEN_TYPE || 'Masuk Kantor'}" Berhasil Disimpan!`, "success", 1200);
    setTimeout(() => {
      loadScreen("dashboard");
    }, 1000);
  } catch (err) {
    if (submitBtn) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }
    showToast("Gagal kirim presensi: " + err.message, "error", 2000);
  }
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

  // 1. Filter Status Visit (ALL | PENDING | DONE)
  if (PRIORITY_VISIT_STATUS_FILTER === "PENDING") {
    computedList = computedList.filter(d => !d.visitedToday);
  } else if (PRIORITY_VISIT_STATUS_FILTER === "DONE") {
    computedList = computedList.filter(d => d.visitedToday);
  }

  // 2. Filter Level Urgensi
  if (PRIORITY_ACTIVE_FILTER !== "ALL") {
    computedList = computedList.filter(d => d.level === PRIORITY_ACTIVE_FILTER);
  }

  if (computedList.length === 0) {
    container.innerHTML = `
      <div class="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400 space-y-2">
        <i class="fa-solid fa-clipboard-check text-2xl text-slate-300 block"></i>
        <p class="font-semibold text-slate-700">Tidak ada data mitra untuk filter "${PRIORITY_ACTIVE_FILTER}"</p>
        <p class="text-[11px] text-slate-400">Jika sheet baru saja diisi atau diperbarui, muat ulang data master:</p>
        <button type="button" onclick="refreshPriorityData()" class="mt-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow inline-flex items-center space-x-1.5 transition">
          <i class="fa-solid fa-arrows-rotate"></i>
          <span>Muat Ulang Data dari Sheet</span>
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

  // Setup click outside listener to auto-close dropdown
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
  selectUnit.innerHTML = '<option value="Umum">-- Umum (Seluruh Showroom / Non-Fasilitas) --</option>';
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d || !d.units) return;

  d.units.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.nopol;
    opt.innerText = `${u.nopol} - ${u.unit}`;
    selectUnit.appendChild(opt);
  });
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

  document.querySelectorAll('input[name="modal_info_unit"]').forEach(cb => {
    cb.checked = u.info_unit.includes(cb.value);
  });

  const overdueContainer = document.getElementById("modal-box-overdue-container");
  if (u.is_ovd) {
    overdueContainer.classList.remove("hidden");
    document.getElementById("modal-input-ovd-plan").value = u.ovd_plan;
    document.getElementById("modal-select-komitmen").value = u.komitmen;
    onModalKomitmenChange(u.komitmen);
    document.getElementById("modal-input-tgl-komitmen").value = u.tgl_komitmen;
  } else {
    overdueContainer.classList.add("hidden");
    u.ovd_plan = "";
    u.komitmen = "Tidak Ada";
    u.tgl_komitmen = "";
  }

  document.getElementById("modal-unit").classList.remove("hidden");
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
  document.querySelectorAll('input[name="modal_info_unit"]:checked').forEach(cb => checkedInfo.push(cb.value));
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

function toggleDocUploadRow(checkbox, docKey) {
  const slotsContainer = document.getElementById("dynamic-upload-slots");
  const cleanKey = docKey.replace(/[^a-zA-Z0-9]/g, '_');
  const rowId = `doc-slot-${cleanKey}`;

  if (checkbox.checked) {
    const row = document.createElement("div");
    row.id = rowId;
    row.className = "p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs";
    row.innerHTML = `
      <div class="min-w-0 flex-1">
        <span class="font-bold text-slate-800 block truncate">${checkbox.value}</span>
        <span id="label-status-${cleanKey}" class="text-[10px] text-amber-600 block">Belum ada file</span>
      </div>
      <div class="shrink-0 flex items-center space-x-1.5">
        <button type="button" onclick="triggerCameraInput('file-doc-${cleanKey}')" class="px-2.5 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-semibold shadow">
          <i class="fa-solid fa-folder-open mr-1"></i> Upload
        </button>
        <input type="file" id="file-doc-${cleanKey}" accept="image/*" class="hidden" onchange="handleDocPhotoCaptured(this, '${docKey}', '${checkbox.value}', '${cleanKey}')" />
      </div>
    `;
    slotsContainer.appendChild(row);
  } else {
    const existingRow = document.getElementById(rowId);
    if (existingRow) existingRow.remove();
    delete ONB_DOC_FILES[docKey];
  }
}

async function handleDocPhotoCaptured(input, docKey, docTitle, cleanKey) {
  if (input.files && input.files[0]) {
    const compressed = await compressImage(input.files[0], 1024, 0.75);
    ONB_DOC_FILES[docKey] = { title: docTitle, base64: compressed };
    const label = document.getElementById(`label-status-${cleanKey}`);
    if (label) {
      label.innerText = "✓ File Terunggah";
      label.className = "text-[10px] text-emerald-600 font-bold block";
    }
  }
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
    alert("Pilih minimal 1 jenis aktivitas onboarding!");
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
    const selectedOption = selectLama.options[selectLama.selectedIndex];
    namaPemohon = selectedOption.getAttribute("data-pemohon") || selectedOption.text;
    namaUsaha = selectedOption.getAttribute("data-usaha") || "-";
    alamat = "- (Sesuai Database)";
    jenisUsaha = "On-Process Partner";
  }

  const docKeys = Object.keys(ONB_DOC_FILES);
  const docList = docKeys.length > 0 ? docKeys.map(k => `✓ ${ONB_DOC_FILES[k].title}`).join('\n') : '- Tidak ada dokumen fisik yang didapatkan pada visit ini';
  const catatanHasil = document.getElementById("onb-catatan-hasil").value.trim();

  let waText = `*LAPORAN VISIT ONBOARDING CALON MITRA*\n------------------------------------\n*Aktivitas:* ${actChecked.join(' & ')}\n*Status Database:* ${isDbBaru === 'Ya' ? 'Database Baru' : 'Database On-Process'}\n*Nama Pemohon:* ${namaPemohon}\n*Nama Usaha:* ${namaUsaha}\n`;
  if (isDbBaru === 'Ya') {
    waText += `*Alamat:* ${alamat}\n*Jenis Usaha:* ${jenisUsaha}\n${detailTambahan}\n`;
  }
  waText += `\n*DOKUMEN DIDAPATKAN:*\n${docList}\n\n*HASIL & CATATAN KUNJUNGAN:*\n${catatanHasil}\n\n• Foto Selfie: [Kamera Langsung OK]\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)}, ${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  callApi("submitOnboarding", {
    userId: CURRENT_USER?.nip || CURRENT_USER?.email,
    aktivitas: actChecked.join(', '),
    status_db: isDbBaru === 'Ya' ? 'Database Baru' : 'Database On-Process',
    nama_pemohon: namaPemohon,
    nama_usaha: namaUsaha,
    alamat: alamat,
    jenis_usaha: jenisUsaha,
    detail_usaha: detailTambahan,
    dokumen_list: docKeys.map(k => ONB_DOC_FILES[k].title).join(', '),
    catatan: catatanHasil,
    lat: CURRENT_USER_GEO.lat,
    long: CURRENT_USER_GEO.long,
    selfie_base64: CURRENT_ONB_SELFIE_BASE64
  });

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-teal-700");
}

// =========================================================================
// GPS MAINTENANCE CONTROLLER
// =========================================================================
let CURRENT_GPS_FILTERED_VEHICLES = [];

function initGpsScreen() {
  populateGpsDealerDropdown();
  populateIdleImeiOptions();
  onGpsActivityChange("Ganti GPS");
}

function populateGpsDealerDropdown() {
  const sel = document.getElementById("gps-select-dealer");
  if (sel) {
    sel.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
    MASTER_DEALER_PRIORITY_DATA.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.dealer_id;
      opt.innerText = `${d.dealer_name} (${d.cabang})`;
      sel.appendChild(opt);
    });
  }
  renderGpsDealerSearchDropdown("");
}

function renderGpsDealerSearchDropdown(query = "") {
  const dropdown = document.getElementById("gps-dealer-search-dropdown");
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
    item.className = "p-2.5 hover:bg-emerald-50 cursor-pointer flex items-center justify-between gap-2 text-xs transition";
    item.onmousedown = (e) => {
      e.preventDefault();
      selectGpsDealerFromSearch(d.dealer_id);
    };

    const lvl = d.priority_level || d.level || "Normal";
    const badgeClass = urgencyBadgeStyles[lvl] || urgencyBadgeStyles["Normal"];

    item.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="font-bold text-slate-900 truncate">${d.dealer_name}</div>
        <div class="text-[10px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
          <span>${d.cabang || "-"}</span>
          <span>•</span>
          <span>Total Unit: ${d.total_unit || (d.units ? d.units.length : 0)}</span>
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
  const dealerVal = document.getElementById("gps-select-dealer")?.value;

  if (actType === "Ganti GPS") {
    if (boxOld) boxOld.classList.remove("hidden");
    if (boxNew) boxNew.classList.remove("hidden");
  } else if (actType === "Cabut GPS") {
    if (boxOld) boxOld.classList.remove("hidden");
    if (boxNew) boxNew.classList.add("hidden");
  } else if (actType === "Pasang GPS") {
    if (boxOld) boxOld.classList.add("hidden");
    if (boxNew) boxNew.classList.remove("hidden");
  }

  if (dealerVal) {
    filterVehiclesByActivity(dealerVal, actType);
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
  if (actType === "Ganti GPS") {
    filtered = allVehicles.filter(v => v.contract_status === "LIVE" && v.gps_status === "TERPASANG");
  } else if (actType === "Cabut GPS") {
    filtered = allVehicles.filter(v => (v.contract_status === "LIVE" || v.contract_status === "EXPIRED") && v.gps_status === "TERPASANG");
  } else if (actType === "Pasang GPS") {
    filtered = allVehicles.filter(v => (v.contract_status === "LIVE" || v.contract_status === "IN_PROCESS") && v.gps_status === "BELUM_PASANG");
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

function populateIdleImeiOptions(keyword = "") {
  const select = document.getElementById("gps-select-imei-baru");
  if (!select) return;

  select.innerHTML = '<option value="">-- Pilih dari Daftar Stok Idle Cabang --</option>';
  const kw = String(keyword || "").trim().toLowerCase();
  const filtered = (APP_STATE.idleGps || []).filter(item => {
    if (!kw) return true;
    const imei = String(item.imei || "").toLowerCase();
    const pos = String(item.posisi_stock || item.tipe || "").toLowerCase();
    return imei.includes(kw) || pos.includes(kw);
  });

  filtered.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.imei;
    const loc = item.posisi_stock || item.tipe || "Stok Cabang";
    opt.innerText = `${item.imei} (${loc})`;
    select.appendChild(opt);
  });
}

function filterIdleImei(keyword) {
  populateIdleImeiOptions(keyword);
}

function onImeiBaruSelected(val) {
  if (val) {
    const searchInput = document.getElementById("gps-search-imei");
    if (searchInput) searchInput.value = val;
  }
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
    currentUser: CURRENT_USER
  });

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-emerald-600");
}

// =========================================================================
// FAC GPS AUDIT CONTROLLER
// =========================================================================
function renderLegendFilters() {
  const container = document.getElementById("legend-filter-container");
  if (!container) return;

  container.innerHTML = ["1", "2", "3", "4", "5", "6", "7"].map(code => {
    const isFilterActive = FAC_SELECTED_STATUS_FILTERS.includes(code);
    const activeCls = isFilterActive
      ? `${STATUS_MAP[code].activeBg} ring-2 ring-slate-900 font-black shadow-sm`
      : `${STATUS_MAP[code].normalBg} font-semibold opacity-80`;

    return `
      <button type="button" onclick="toggleStatusFilter('${code}')" class="p-1.5 rounded-xl border text-[10px] flex items-center justify-center space-x-1 transition cursor-pointer ${activeCls}">
        <span class="w-3.5 h-3.5 rounded-full text-center leading-3.5 text-[8px] font-black shrink-0 ${isFilterActive ? 'bg-white text-slate-900' : 'bg-slate-700 text-white'}">${code}</span>
        <span class="truncate">${STATUS_MAP[code].short}</span>
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
      <div class="flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-1.5">
            <span class="font-bold text-xs text-slate-900">${item.dealer}</span>
            <span class="text-[8px] px-1 py-0.2 rounded font-bold ${item.status_kontrak === 'LIVE' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">${item.status_kontrak}</span>
          </div>
          <p class="text-[11px] font-medium text-slate-600 truncate">${item.asset_desc}</p>
        </div>

        <div class="flex items-center space-x-1 shrink-0">
          ${["1", "2", "3", "4", "5", "6", "7"].map(code => {
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
        <input type="text" id="input-catatan-${item.id}" value="${item.catatan}" oninput="onFacCatatanInput('${item.id}', this.value)" placeholder="Wajib isi keterangan khusus..." class="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs focus:ring-2 focus:ring-cyan-700" />
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
  const missingNotes = FAC_GPS_MONITORING_DATA.filter(u => u.status_codes.length > 0 && (!u.catatan || !u.catatan.trim()));
  if (missingNotes.length > 0) {
    alert(`Peringatan: Terdapat ${missingNotes.length} unit dengan status anomali yang belum diisi keterangannya!`);
    return;
  }

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

function copyAndOpenWA() {
  const copyText = document.getElementById("text-wa-summary");
  copyText.select();
  copyText.setSelectionRange(0, 99999);
  navigator.clipboard.writeText(copyText.value);
  alert("Rekap berhasil disalin ke clipboard!");
  window.open(`https://wa.me/?text=${encodeURIComponent(copyText.value)}`, '_blank');
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
});

document.addEventListener("DOMContentLoaded", async () => {
  if (CURRENT_USER) {
    await syncMasterDataFromApi();
    loadScreen("dashboard");
  } else {
    loadScreen("login");
  }
});