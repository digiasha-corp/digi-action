/**
 * CORE LOGIC & ENGINE DIGIASHA APP
 */
const screenCache = {};
let CURRENT_USER = DUMMY_DB.currentUser;
let MASTER_DEALER_PRIORITY_DATA = JSON.parse(JSON.stringify(DUMMY_DB.dealers));
let FAC_GPS_MONITORING_DATA = JSON.parse(JSON.stringify(DUMMY_DB.facGpsMonitoring));

// Helper Pemanggil API Google Apps Script
async function callApi(action, data = {}) {
  if (typeof CONFIG === "undefined" || !CONFIG.USE_ONLINE_DB || !CONFIG.API_URL || CONFIG.API_URL.includes("MASUKKAN_URL")) {
    return null; // Fallback ke lokal jika offline / demo
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

// Sinkronisasi Data Master dari Google Spreadsheet ke State Frontend
async function syncMasterDataFromApi() {
  if (typeof CONFIG === "undefined" || !CONFIG.USE_ONLINE_DB) return;
  try {
    const res = await callApi("getMasterData");
    if (res && res.success) {
      if (res.dealers && res.dealers.length > 0) {
        MASTER_DEALER_PRIORITY_DATA = res.dealers;
      }
      if (res.idleGps && res.idleGps.length > 0) {
        DUMMY_DB.branchIdleImeiList = res.idleGps;
      }
      console.log("Master data berhasil disinkronkan dari Google Spreadsheet!");
    }
  } catch (err) {
    console.warn("Gagal sync master data online, menggunakan data lokal:", err);
  }
}

// Handler Submit Form Login
async function handleLoginSubmit(e) {
  e.preventDefault();
  const identifier = document.getElementById("login-email")?.value.trim();
  const password = document.getElementById("login-pass")?.value.trim();

  if (!identifier || !password) {
    alert("Email/NIP dan Password wajib diisi!");
    return;
  }

  // Jika online mode aktif, verifikasi ke Apps Script
  if (typeof CONFIG !== "undefined" && CONFIG.USE_ONLINE_DB) {
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Memverifikasi...';
    submitBtn.disabled = true;

    try {
      const res = await callApi("login", { identifier, password });
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;

      if (!res || !res.success) {
        alert("Gagal Login: " + (res?.message || "Koneksi terputus."));
        return;
      }

      CURRENT_USER = res.user;
      await syncMasterDataFromApi();
      loadScreen("dashboard");
    } catch (err) {
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
      alert("Error login: " + err.message);
    }
  } else {
    // Mode offline / demo
    loadScreen("dashboard");
  }
}

let CURRENT_USER_GEO = { lat: -6.295218, long: 106.638482, accuracy: 25, nearestOffice: null, distanceToOffice: 0, isInsideRadius: false };
let ACTIVE_ABSEN_TYPE = null;
let CURRENT_ABSEN_SELFIE_BASE64 = null;

let PRIORITY_ACTIVE_FILTER = "ALL";
let FAC_ACTIVE_CONTRACT_FILTER = "ALL";
let FAC_SELECTED_STATUS_FILTERS = [];

// State modul visit & onboarding
let CURRENT_UNIT_INDEX = null;
let ACTIVE_UNITS_STATE = [];
let CURRENT_SHOWROOM_PHOTO_BASE64 = null;
let CURRENT_ONB_SELFIE_BASE64 = null;
let TEMP_MODAL_PHOTO_BASE64 = null;
let ONB_DOC_FILES = {};

const STATUS_MAP = {
  "1": { name: "Tidak Pasang", short: "Tdk Pasang", activeBg: "bg-rose-600 text-white border-rose-600", normalBg: "hover:border-rose-400 text-rose-700 bg-rose-50 border-rose-200" },
  "2": { name: "Belum Lepas", short: "Blm Lepas", activeBg: "bg-purple-600 text-white border-purple-600", normalBg: "hover:border-purple-400 text-purple-700 bg-purple-50 border-purple-200" },
  "3": { name: "Belum Pasang", short: "Blm Pasang", activeBg: "bg-amber-500 text-white border-amber-500", normalBg: "hover:border-amber-400 text-amber-700 bg-amber-50 border-amber-200" },
  "4": { name: "Baterai Lemah", short: "Batt Lemah", activeBg: "bg-yellow-500 text-white border-yellow-500", normalBg: "hover:border-yellow-400 text-yellow-700 bg-yellow-50 border-yellow-200" },
  "5": { name: "Geser", short: "Geser", activeBg: "bg-blue-600 text-white border-blue-600", normalBg: "hover:border-blue-400 text-blue-700 bg-blue-50 border-blue-200" },
  "6": { name: "Pelepasan", short: "Pelepasan", activeBg: "bg-orange-600 text-white border-orange-600", normalBg: "hover:border-orange-400 text-orange-700 bg-orange-50 border-orange-200" },
  "7": { name: "Offline", short: "Offline", activeBg: "bg-slate-800 text-white border-slate-800", normalBg: "hover:border-slate-400 text-slate-800 bg-slate-100 border-slate-200" }
};

// Router Pemanggil Layar Modular
async function loadScreen(screenName) {
  const container = document.getElementById("main-view-container");
  const topbar = document.getElementById("topbar");
  const btnBack = document.getElementById("btn-back-home");
  const title = document.getElementById("topbar-title");
  const sub = document.getElementById("topbar-sub");

  if (screenName === "login") {
    topbar.classList.add("hidden");
  } else {
    topbar.classList.remove("hidden");
    sub.innerText = `${CURRENT_USER.nama} •${CURRENT_USER.role}`;
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
    if (screenName === "priority") renderPriorityList();
    if (screenName === "assignment") populateAssignDealerOptions();
    if (screenName === "visit") populateVisitDealerOptions();
    if (screenName === "gps") populateGpsMaintDealerOptions();
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

// Controller Dashboard
function initDashboard() {
  document.getElementById("dash-user-name").innerText = `Halo, ${CURRENT_USER.nama}!`;
  document.getElementById("dash-user-branch").innerText = `Cabang: ${CURRENT_USER.cabang}`;
  document.getElementById("badge-role").innerText = CURRENT_USER.role;

  const perms = DUMMY_DB.rolePermissions[CURRENT_USER.role] || ["priority", "visit", "onboarding", "gps", "fac", "assignment"];
  ["priority", "assignment", "visit", "onboarding", "gps", "fac"].forEach(key => {
    const btn = document.getElementById(`menu-btn-${key}`);
    if (btn) btn.style.display = perms.includes(key) ? "flex" : "none";
  });
}

// Geofence & Absensi
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
        DUMMY_DB.officeLocations.forEach(o => {
          const d = calculateDistanceMeters(crd.latitude, crd.longitude, o.lat, o.long);
          if (d < minD) { minD = d; nearest = { ...o, distance: d }; }
        });
        CURRENT_USER_GEO.nearestOffice = nearest;
        CURRENT_USER_GEO.distanceToOffice = nearest.distance;

        if (coordsDisplay) coordsDisplay.innerText = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (\u00B1${Math.round(crd.accuracy)}m)`;
        if (officeNameDisplay) officeNameDisplay.innerText = nearest.name;

        if (ACTIVE_ABSEN_TYPE === "Masuk Kantor") {
          if (distDisplay) distDisplay.innerText = `${nearest.distance} Meter (Maks${nearest.maxRadiusMeter}m)`;
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
        CURRENT_USER_GEO.lat = -6.358972;
        CURRENT_USER_GEO.long = 106.716583;
        CURRENT_USER_GEO.distanceToOffice = 10;
        CURRENT_USER_GEO.isInsideRadius = true;
        CURRENT_USER_GEO.nearestOffice = DUMMY_DB.officeLocations[0];
        if (coordsDisplay) coordsDisplay.innerText = "-6.358972, 106.716583 (Default GPS)";
        if (officeNameDisplay) officeNameDisplay.innerText = DUMMY_DB.officeLocations[0].name;
        if (distDisplay) distDisplay.innerText = "10 Meter (Valid Radius)";
        if (badge) { badge.innerText = "Radius Valid (Testing GPS)"; badge.className = "text-[9px] px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800"; }
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
}

function handleAbsenSelfieSelected(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      CURRENT_ABSEN_SELFIE_BASE64 = e.target.result;
      document.getElementById("preview-absen-selfie-card").classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeAbsenSelfie() {
  document.getElementById("file-absen-selfie").value = "";
  CURRENT_ABSEN_SELFIE_BASE64 = null;
  document.getElementById("preview-absen-selfie-card").classList.add("hidden");
}

function handleAbsenSubmit(e) {
  e.preventDefault();
  if (ACTIVE_ABSEN_TYPE === "Masuk Kantor" && !CURRENT_USER_GEO.isInsideRadius) {
    alert(`Gagal: Lokasi Anda berada ${CURRENT_USER_GEO.distanceToOffice} meter dari kantor. Wajib dalam radius 100 meter.`);
    return;
  }
  if (!CURRENT_ABSEN_SELFIE_BASE64) {
    alert("Wajib mengambil foto selfie kehadiran (kelihatan badan / setengah badan)!");
    return;
  }

  const catatan = document.getElementById("absen-input-catatan").value.trim() || "-";
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  let waText = `*PRESENSI KEHADIRAN DIGIASHA*\n------------------------------------\n*Jenis Absensi:* ${ACTIVE_ABSEN_TYPE}\n*Nama Karyawan:*${CURRENT_USER.nama}\n*Role / Cabang:* ${CURRENT_USER.role} \u2022${CURRENT_USER.cabang}\n*Waktu Presensi:* ${dateStr} pukul${timeStr} WIB\n\n`;
  if (ACTIVE_ABSEN_TYPE === "Masuk Kantor") {
    waText += `*Lokasi Kantor:* ${CURRENT_USER_GEO.nearestOffice?.name || 'Kantor Utama'}\n*Status Geofence:* Radius Valid (${CURRENT_USER_GEO.distanceToOffice} Meter dari Kantor)\n`;
  }
  waText += `*Koordinat Geotag:* ${CURRENT_USER_GEO.lat.toFixed(6)}, ${CURRENT_USER_GEO.long.toFixed(6)}\n*Catatan Aktivitas:*${catatan}\n\u2022 Foto Selfie: [Kamera Langsung OK (Full Body)]\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  openSummaryModal("Presensi Berhasil Disimpan!", "Siap diteruskan ke WhatsApp", waText, "bg-teal-700");
}

// Priority Visit Scoring Engine
function calculateUnitUrgency(u) {
  if (u.unit_concern && u.unit_concern.urgency === "Sangat Penting") return { level: "Sangat Penting", score: 3, reason: "Concern 'Sangat Penting'" };
  if (["Pelepasan", "Offline", "Baterai Lemah"].includes(u.gps_status)) return { level: "Sangat Penting", score: 3, reason: `GPS ${u.gps_status}` };
  if (u.aging_visit_unit > 21 && u.lifetime_days > 90) return { level: "Sangat Penting", score: 3, reason: "Aging Visit >21 hr & Lifetime >90" };
  if (u.aging_visit_unit > 14 && u.is_h3_jto) return { level: "Sangat Penting", score: 3, reason: "Aging Visit >14 hr & H-3 JTO" };

  if (u.unit_concern && u.unit_concern.urgency === "Penting") return { level: "Penting", score: 2, reason: "Concern 'Penting'" };
  if (["Belum Lepas", "Belum Pasang", "Geser"].includes(u.gps_status)) return { level: "Penting", score: 2, reason: `GPS ${u.gps_status}` };
  if (u.aging_visit_unit > 3 && u.overdue_days > 3) return { level: "Penting", score: 2, reason: "Aging Visit >3 hr & OVD >3" };
  if (u.aging_visit_unit > 5 && u.is_h3_jto) return { level: "Penting", score: 2, reason: "Aging Visit >5 hr & H-3 JTO" };
  if (u.aging_visit_unit > 21 && u.lifetime_days <= 90) return { level: "Penting", score: 2, reason: "Aging Visit >21 hr & Lifetime \u226490" };

  if (u.aging_visit_unit > 14) return { level: "Moderat", score: 1, reason: "Aging Visit Unit >14 hr" };
  if (u.unit_concern && u.unit_concern.urgency === "Moderat") return { level: "Moderat", score: 1, reason: "Concern 'Moderat'" };
  if (u.aging_gps_maint > 30) return { level: "Moderat", score: 1, reason: "Aging GPS Maint >30 hr" };

  return { level: "Normal", score: 0, reason: "Normal" };
}

function calculateMitraUrgency(dealer) {
  let highestScore = 0;
  let finalLevel = "Normal";
  let mitraScore = 0;
  let mitraLevel = "Normal";

  if (dealer.dealer_concern && dealer.dealer_concern.urgency === "Sangat Penting") { mitraScore = 3; mitraLevel = "Sangat Penting"; }
  else if (dealer.aging_visit_mitra > 60) { mitraScore = 3; mitraLevel = "Sangat Penting"; }
  else if (dealer.dealer_concern && dealer.dealer_concern.urgency === "Penting") { mitraScore = 2; mitraLevel = "Penting"; }
  else if (dealer.aging_visit_mitra > 30) { mitraScore = 2; mitraLevel = "Penting"; }
  else if (dealer.dealer_concern && dealer.dealer_concern.urgency === "Moderat") { mitraScore = 1; mitraLevel = "Moderat"; }
  else if (dealer.aging_visit_mitra > 20) { mitraScore = 1; mitraLevel = "Moderat"; }

  highestScore = mitraScore;
  finalLevel = mitraLevel;

  let urgentUnitsCount = 0;
  if (dealer.units && dealer.units.length > 0) {
    dealer.units.forEach(u => {
      const uRes = calculateUnitUrgency(u);
      if (uRes.score > 0) urgentUnitsCount++;
      if (uRes.score > highestScore) {
        highestScore = uRes.score;
        finalLevel = uRes.level;
      }
    });
  }

  return { level: finalLevel, score: highestScore, mitraLevel, mitraScore, urgentUnitsCount };
}

function setPriorityFilter(lvl) {
  PRIORITY_ACTIVE_FILTER = lvl;
  document.querySelectorAll('#p-filter-all, #p-filter-sp, #p-filter-p, #p-filter-m').forEach(b => {
    b.className = "flex-1 py-1.5 rounded-xl bg-slate-200 text-slate-700 text-xs font-bold";
  });

  const btnMap = { 'ALL': 'p-filter-all', 'Sangat Penting': 'p-filter-sp', 'Penting': 'p-filter-p', 'Moderat': 'p-filter-m' };
  const activeBtn = document.getElementById(btnMap[lvl]);
  if (activeBtn) activeBtn.className = "flex-1 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xs";

  renderPriorityList();
}

function renderPriorityList() {
  const container = document.getElementById("priority-list-container");
  if (!container) return;
  container.innerHTML = "";

  let computedList = MASTER_DEALER_PRIORITY_DATA.map(d => ({ ...d, ...calculateMitraUrgency(d) }));
  computedList.sort((a, b) => b.score - a.score);

  if (PRIORITY_ACTIVE_FILTER !== "ALL") {
    computedList = computedList.filter(d => d.level === PRIORITY_ACTIVE_FILTER);
  }

  if (computedList.length === 0) {
    container.innerHTML = `<div class="p-6 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-400">Tidak ada mitra dalam kategori ini.</div>`;
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
    card.className = "bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2";

    const hasMitraUrgency = d.mitraScore > 0 || !!d.dealer_concern;
    const houseBtnClass = hasMitraUrgency ? `${urgencyPillStyles[d.mitraLevel]} shadow-xs` : 'bg-slate-100 text-slate-400 border border-slate-200';
    const hasUnitUrgency = d.urgentUnitsCount > 0;
    const carBtnClass = hasUnitUrgency ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-400 border border-slate-200';

    card.innerHTML = `
      <div class="min-w-0 flex-1">
        <div class="flex items-center space-x-1.5">
          <h4 class="font-bold text-xs text-slate-900 truncate">${d.dealer_name}</h4>
          <span class="text-[8px] font-black px-1.5 py-0.2 rounded-md ${urgencyPillStyles[d.level]} uppercase shrink-0">${d.level}</span>
        </div>
        <p class="text-[10px] text-slate-400 truncate mt-0.5">Cabang: ${d.cabang} \u2022 Aging: <strong>${d.aging_visit_mitra} hr</strong> \u2022${d.units.length} Unit</p>
      </div>

      <div class="flex items-center space-x-1.5 shrink-0">
        <button type="button" onclick="openMitraDetailModal('${d.dealer_id}')" title="Pemicu Urgensi Mitra" class="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition active:scale-95 ${houseBtnClass}">
          <i class="fa-solid fa-house"></i>
        </button>
        <button type="button" onclick="openFacilityDetailModal('${d.dealer_id}')" title="Pemicu Urgensi Fasilitas" class="w-8 h-8 rounded-xl flex items-center justify-center text-xs transition active:scale-95 relative ${carBtnClass}">
          <i class="fa-solid fa-car"></i>
          ${d.urgentUnitsCount > 0 ? `<span class="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white text-[8px] font-black flex items-center justify-center border border-white">${d.urgentUnitsCount}</span>` : ''}
        </button>
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
  document.getElementById("dtl-mitra-aging").innerText = `${d.aging_visit_mitra} Hari Terakhir Visit`;

  const badge = document.getElementById("dtl-mitra-urgency-badge");
  badge.innerText = evalRes.mitraLevel.toUpperCase();
  badge.className = evalRes.mitraLevel === "Sangat Penting" ? "font-bold px-2 py-0.5 rounded text-[10px] bg-red-600 text-white" : evalRes.mitraLevel === "Penting" ? "font-bold px-2 py-0.5 rounded text-[10px] bg-orange-600 text-white" : "font-bold px-2 py-0.5 rounded text-[10px] bg-amber-500 text-white";

  const boxConcern = document.getElementById("box-dtl-mitra-concern");
  if (d.dealer_concern) {
    boxConcern.classList.remove("hidden");
    document.getElementById("dtl-mitra-concern-text").innerText = `"${d.dealer_concern.note}" (Urgensi: ${d.dealer_concern.urgency})`;
  } else {
    boxConcern.classList.add("hidden");
  }
  document.getElementById("modal-mitra-detail").classList.remove("hidden");
}

function closeMitraModal() { document.getElementById("modal-mitra-detail").classList.add("hidden"); }

function openFacilityDetailModal(dealerId) {
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d) return;

  document.getElementById("modal-facility-title").innerText = `Fasilitas: ${d.dealer_name}`;
  document.getElementById("modal-facility-sub").innerText = `Total ${d.units.length} Unit Terdaftar`;

  const listContainer = document.getElementById("modal-facility-list");
  listContainer.innerHTML = "";

  const urgencyPillStyles = {
    "Sangat Penting": "bg-red-100 text-red-700 border-red-200",
    "Penting": "bg-orange-100 text-orange-700 border-orange-200",
    "Moderat": "bg-amber-100 text-amber-700 border-amber-200",
    "Normal": "bg-slate-100 text-slate-600 border-slate-200"
  };

  d.units.forEach(u => {
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
        <div>GPS: <strong class="text-slate-700">${u.gps_status}</strong></div>
        <div>Aging Visit: <strong class="text-slate-700">${u.aging_visit_unit} hr</strong></div>
        <div>Lifetime: <strong class="text-slate-700">${u.lifetime_days} hr</strong></div>
        <div>Status: <strong class="text-slate-700">${u.is_h3_jto ? 'H-3 JTO' : u.overdue_days > 0 ? 'OVD ' + u.overdue_days + ' hr' : 'Lancar'}</strong></div>
      </div>

      <div class="text-[10px] text-amber-900 bg-amber-50 p-1.5 rounded-lg border border-amber-200 font-medium">
        Pemicu: <strong>${uEval.reason}</strong>${u.unit_concern ? `<br><span class="text-purple-800">Concern: "${u.unit_concern.note}"</span>` : ''}
      </div>
    `;
    listContainer.appendChild(itemCard);
  });

  document.getElementById("modal-facility-detail").classList.remove("hidden");
}

function closeFacilityModal() { document.getElementById("modal-facility-detail").classList.add("hidden"); }
function openParamModal() { document.getElementById("modal-param-info").classList.remove("hidden"); }
function closeParamModal() { document.getElementById("modal-param-info").classList.add("hidden"); }

// Assign Concern Logic
function populateAssignDealerOptions() {
  const selectDealer = document.getElementById("assign-select-dealer");
  if (!selectDealer) return;
  selectDealer.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang})`;
    selectDealer.appendChild(opt);
  });
}

function onAssignDealerSelected(dealerId) {
  const selectUnit = document.getElementById("assign-select-unit");
  selectUnit.innerHTML = '<option value="Umum">-- Umum (Seluruh Showroom / Non-Fasilitas) --</option>';
  const d = MASTER_DEALER_PRIORITY_DATA.find(item => item.dealer_id === dealerId);
  if (!d || !d.units) return;

  d.units.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.nopol;
    opt.innerText = `${u.nopol} -${u.unit}`;
    selectUnit.appendChild(opt);
  });
}

function handleAssignConcernSubmit(e) {
  e.preventDefault();
  const dealerId = document.getElementById("assign-select-dealer").value;
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

  alert(`Concern ${urgencyVal} berhasil disimpan ke Priority Visit!`);
  loadScreen('priority');
}

// Controller Laporan Visit Mitra (Dengan Modal Unit Checklist)
function populateVisitDealerOptions() {
  const sel = document.getElementById("input-dealer");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang})`;
    sel.appendChild(opt);
  });
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

  container.innerHTML = "";
  ACTIVE_UNITS_STATE = [];

  const dealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_id === dealerId);

  if (!dealerId || !dealer || !dealer.units || dealer.units.length === 0) {
    emptyBox.innerText = dealerId ? "Mitra ini tidak memiliki fasilitas unit aktif." : "Pilih partner dealer di Segmen 1.";
    emptyBox.classList.remove("hidden");
    container.classList.add("hidden");
    countBadge.innerText = "0 Unit";
    return;
  }

  emptyBox.classList.add("hidden");
  container.classList.remove("hidden");

  const units = dealer.units;
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
  if (TEMP_MODAL_PHOTO_BASE64) {
    document.getElementById("modal-unit-photo-preview").classList.remove("hidden");
  } else {
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

function handleModalUnitPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      TEMP_MODAL_PHOTO_BASE64 = e.target.result;
      document.getElementById("modal-unit-photo-preview").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
}

function removeModalUnitPhoto() {
  document.getElementById("file-modal-unit-photo").value = "";
  TEMP_MODAL_PHOTO_BASE64 = null;
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
        const locStr = `${crd.latitude.toFixed(6)}, ${crd.longitude.toFixed(6)} (\u00B1${Math.round(crd.accuracy)}m)`;
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

function handleShowroomPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      CURRENT_SHOWROOM_PHOTO_BASE64 = e.target.result;
      document.getElementById("preview-photo-card").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
}

function removePhoto() {
  document.getElementById("file-visit-photo").value = "";
  CURRENT_SHOWROOM_PHOTO_BASE64 = null;
  document.getElementById("preview-photo-card").classList.add("hidden");
}

function handleFormSubmit(e) {
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
  const dealerName = dealerSelect.options[dealerSelect.selectedIndex].text;
  const lokasi = document.querySelector('input[name="lokasi_visit"]:checked').value;
  const lokasiDetail = (lokasi === "Tempat Lainnya") ? document.getElementById("input-lokasi-lain").value : "Showroom";
  const bertemuOwner = document.querySelector('input[name="bertemu_owner"]:checked').value;
  const ownerReason = (bertemuOwner === "Tidak") ? document.getElementById("input-owner-reason").value : "-";

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
  if (lokasi === "Showroom") {
    waText += `*Stock Unit Showroom:* ${stock} Unit\n*Penjualan Bulan Ini:*${sales} Unit\n\n`;
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

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-emerald-600");
}

// Controller Visit Calon Mitra (Onboarding)
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

function handleDocPhotoCaptured(input, docKey, docTitle, cleanKey) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      ONB_DOC_FILES[docKey] = { title: docTitle, base64: e.target.result };
      const label = document.getElementById(`label-status-${cleanKey}`);
      if (label) {
        label.innerText = "\u2713 File Terunggah";
        label.className = "text-[10px] text-emerald-600 font-bold block";
      }
    };
    reader.readAsDataURL(file);
  }
}

function handleOnbSelfieSelected(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = e => {
      CURRENT_ONB_SELFIE_BASE64 = e.target.result;
      document.getElementById("preview-onb-selfie-card").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }
}

function removeOnbSelfie() {
  document.getElementById("file-onb-selfie").value = "";
  CURRENT_ONB_SELFIE_BASE64 = null;
  document.getElementById("preview-onb-selfie-card").classList.add("hidden");
}

function handleOnboardingSubmit(e) {
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

  let waText = `*LAPORAN VISIT ONBOARDING CALON MITRA*\n------------------------------------\n*Aktivitas:* ${actChecked.join(' & ')}\n*Status Database:*${isDbBaru === 'Ya' ? 'Database Baru' : 'Database On-Process'}\n*Nama Pemohon:* ${namaPemohon}\n*Nama Usaha:*${namaUsaha}\n`;
  if (isDbBaru === 'Ya') {
    waText += `*Alamat:* ${alamat}\n*Jenis Usaha:* ${jenisUsaha}\n${detailTambahan}\n`;
  }
  waText += `\n*DOKUMEN DIDAPATKAN:*\n${docList}\n\n*HASIL & CATATAN KUNJUNGAN:*\n${catatanHasil}\n\n• Foto Selfie: [Kamera Langsung OK]\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)},${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-teal-700");
}

// Controller GPS Maintenance
function populateGpsMaintDealerOptions() {
  const sel = document.getElementById("gps-maint-dealer");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Showroom --</option>';
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_name;
    opt.innerText = d.dealer_name;
    sel.appendChild(opt);
  });
}

function onGpsMaintDealerSelected(dealerName) {
  const selUnit = document.getElementById("gps-maint-unit");
  selUnit.innerHTML = '<option value="">-- Pilih Nopol --</option>';
  const dealer = MASTER_DEALER_PRIORITY_DATA.find(d => d.dealer_name === dealerName);
  if (!dealer || !dealer.units) return;

  dealer.units.forEach(u => {
    const opt = document.createElement("option");
    opt.value = u.nopol;
    opt.innerText = `${u.nopol} -${u.unit}`;
    selUnit.appendChild(opt);
  });
}

function onGpsMaintUnitSelected(nopol) {
  let currentImei = "";
  MASTER_DEALER_PRIORITY_DATA.forEach(d => {
    const u = d.units?.find(unit => unit.nopol === nopol);
    if (u) currentImei = u.imei_gps || "";
  });
  document.getElementById("gps-imei-lama").value = currentImei || "-";
}

function toggleGpsImeiInputs(action) {
  const boxLama = document.getElementById("box-imei-lama");
  const boxBaru = document.getElementById("box-imei-baru");
  const inputBaru = document.getElementById("gps-imei-baru");

  if (action === "Cabut GPS") {
    boxLama.classList.remove("hidden");
    boxBaru.classList.add("hidden");
    inputBaru.removeAttribute("required");
  } else if (action === "Ganti GPS") {
    boxLama.classList.remove("hidden");
    boxBaru.classList.remove("hidden");
    inputBaru.setAttribute("required", "true");
  } else {
    boxLama.classList.add("hidden");
    boxBaru.classList.remove("hidden");
    inputBaru.setAttribute("required", "true");
  }
}

function handleGpsMaintenanceSubmit(e) {
  e.preventDefault();
  const dealerName = document.getElementById("gps-maint-dealer").value;
  const nopol = document.getElementById("gps-maint-unit").value;
  const action = document.getElementById("gps-maint-action").value;
  const imeiLama = document.getElementById("gps-imei-lama").value;
  const imeiBaru = document.getElementById("gps-imei-baru").value.trim();
  const notes = document.getElementById("gps-maint-notes").value.trim();

  let waText = `*LAPORAN GPS MAINTENANCE*\n------------------------------------\n*Mitra:* ${dealerName}\n*Unit:* ${nopol}\n*Aktivitas:*${action}\n`;
  if (action === "Ganti GPS") {
    waText += `*IMEI Lama:* ${imeiLama}\n*IMEI Baru:*${imeiBaru}\n`;
  } else if (action === "Cabut GPS") {
    waText += `*IMEI Dicabut:* ${imeiLama}\n`;
  } else {
    waText += `*IMEI Terpasang:* ${imeiBaru}\n`;
  }
  waText += `*Catatan:* ${notes || '-'}\n------------------------------------`;

  openSummaryModal("Maintenance GPS Berhasil!", "Status unit & inventaris telah disinkronkan", waText, "bg-emerald-800");
}

// Controller Audit GPS (FAC)
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

function submitFacGpsReport() {
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

  openSummaryModal("Audit GPS Disimpan!", "Format rekap siap untuk WhatsApp", waText, "bg-cyan-800");
}

// Modal Summary Helper
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

// Start
document.addEventListener("DOMContentLoaded", () => {
  loadScreen("dashboard");
});

// Variable State Foto Khusus GPS Maintenance
let GPS_PHOTO_OLD_BASE64 = null;
let GPS_PHOTO_NEW_IMEI_BASE64 = null;
let GPS_PHOTO_POSITION_BASE64 = null;

// Dipanggil otomatis saat loadScreen('gps')
function initGpsScreen() {
  populateGpsDealerDropdown();
  populateIdleImeiOptions();
  onGpsActivityChange("Ganti GPS");
}

function populateGpsDealerDropdown() {
  const sel = document.getElementById("gps-select-dealer");
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Pilih Partner Dealer --</option>';
  DUMMY_DB.dealers.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.dealer_id;
    opt.innerText = `${d.dealer_name} (${d.cabang})`;
    sel.appendChild(opt);
  });
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
  const infoText = document.getElementById("gps-kendaraan-info");
  if (!selectKendaraan) return;

  selectKendaraan.innerHTML = '<option value="">-- Pilih Kendaraan --</option>';
  const inputImeiLama = document.getElementById("gps-input-imei-lama");
  if (inputImeiLama) inputImeiLama.value = "-";

  const allVehicles = DUMMY_DB.masterVehiclesGps[dealerId];
  if (!dealerId || !allVehicles) {
    if (infoText) infoText.classList.add("hidden");
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

  if (filtered.length === 0) {
    selectKendaraan.innerHTML = `<option value="">-- Tidak ada unit yang memenuhi kriteria ${actType} --</option>`;
    if (infoText) {
      infoText.innerText = `Tidak ditemukan kendaraan mitra dengan kriteria ${actType}.`;
      infoText.className = "text-[10px] text-red-500 font-semibold mt-1 block";
    }
    return;
  }

  if (infoText) {
    infoText.innerText = `Menampilkan ${filtered.length} unit kendaraan yang sesuai kriteria ${actType}.`;
    infoText.className = "text-[10px] text-emerald-600 font-semibold mt-1 block";
  }

  filtered.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v.nopol;
    opt.setAttribute("data-imei", v.imei);
    opt.setAttribute("data-unit", v.unit);
    opt.setAttribute("data-status", v.contract_status);
    opt.innerText = `${v.nopol} | ${v.unit} (${v.contract_status})`;
    selectKendaraan.appendChild(opt);
  });
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
  const filtered = DUMMY_DB.branchIdleImeiList.filter(item =>
    item.imei.includes(keyword) || item.tipe.toLowerCase().includes(keyword.toLowerCase())
  );

  filtered.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.imei;
    opt.innerText = `${item.imei} - ${item.tipe}`;
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

function handleGpsOldPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      GPS_PHOTO_OLD_BASE64 = e.target.result;
      document.getElementById("preview-gps-old-photo")?.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeGpsOldPhoto() {
  const fileInput = document.getElementById("file-gps-photo-old");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_OLD_BASE64 = null;
  document.getElementById("preview-gps-old-photo")?.classList.add("hidden");
}

function handleGpsNewImeiPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      GPS_PHOTO_NEW_IMEI_BASE64 = e.target.result;
      document.getElementById("preview-gps-new-imei-photo")?.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeGpsNewImeiPhoto() {
  const fileInput = document.getElementById("file-gps-photo-new-imei");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_NEW_IMEI_BASE64 = null;
  document.getElementById("preview-gps-new-imei-photo")?.classList.add("hidden");
}

function handleGpsPositionPhotoSelected(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      GPS_PHOTO_POSITION_BASE64 = e.target.result;
      document.getElementById("preview-gps-position-photo")?.classList.remove("hidden");
    };
    reader.readAsDataURL(input.files[0]);
  }
}

function removeGpsPositionPhoto() {
  const fileInput = document.getElementById("file-gps-photo-position");
  if (fileInput) fileInput.value = "";
  GPS_PHOTO_POSITION_BASE64 = null;
  document.getElementById("preview-gps-position-photo")?.classList.add("hidden");
}

function handleGpsSubmit(e) {
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

  let waText = `*LAPORAN AKTIVITAS GPS MAINTENANCE*\n------------------------------------\n*Aktivitas:* ${actType}\n*Mitra:* ${dealerName}\n*Kendaraan:* ${nopol} - ${unitDesc}\n`;
  if (actType === "Ganti GPS") {
    waText += `• IMEI Dicabut: ${imeiLama} [Foto OK]\n• IMEI Baru: ${imeiBaru} [Foto IMEI & Posisi OK]\n`;
  } else if (actType === "Cabut GPS") {
    waText += `• IMEI Dicabut: ${imeiLama} [Foto IMEI Dicabut OK]\n`;
  } else if (actType === "Pasang GPS") {
    waText += `• IMEI Terpasang: ${imeiBaru} [Foto IMEI & Posisi OK]\n`;
  }
  waText += `• Catatan Teknis: ${catatanTeknis}\n• Geotag: ${CURRENT_USER_GEO.lat.toFixed(5)}, ${CURRENT_USER_GEO.long.toFixed(5)}\n------------------------------------\n_Dikirim via Digiasha Field App_`;

  openSummaryModal("Laporan Berhasil Dibuat!", "Siap disalin ke WhatsApp Group", waText, "bg-emerald-600");
}