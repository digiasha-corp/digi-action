/**
 * DUMMY DATABASE LOKAL DIGIASHA
 */
const DUMMY_DB = {
  currentUser: {
    userId: "USR-001",
    nama: "Ahmad Khusnudin",
    role: "Super Admin",
    cabang: "Tangerang 1",
    is_first_login: false
  },

  officeLocations: [
    { name: "Kantor Utama (Tangsel)", lat: -6.358972, long: 106.716583, maxRadiusMeter: 100 },
    { name: "Kantor Cabang Tangerang", lat: -6.295218, long: 106.638482, maxRadiusMeter: 100 }
  ],

  rolePermissions: {
    "Super Admin": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
    "Supervisor": ["priority", "assignment", "visit", "onboarding", "gps", "fac"],
    "FAC": ["priority", "gps", "fac"],
    "Field PIC": ["priority", "visit", "onboarding", "gps"]
  },

  dealers: [
    {
      dealer_id: "DLR-01",
      dealer_name: "Gosyen Auto Garage",
      cabang: "Tangerang 1",
      pic_handling: ["admin@digiasha.com"],
      aging_visit_mitra: 15,
      dealer_concern: { urgency: "Penting", note: "Mitra berencana menambah fasilitas baru." },
      units: [
        {
          no_fasilitas: "DC-202509100001",
          nopol: "B 1084 FZP",
          unit: "MAZDA CX5 2.5 AT GT (2016)",
          gps_status: "Normal",
          imei_gps: "867192837192001",
          contract_status: "LIVE",
          aging_visit_unit: 16,
          lifetime_days: 80,
          is_h3_jto: false,
          overdue_days: 0,
          aging_gps_maint: 15,
          unit_concern: null
        }
      ]
    },
    {
      dealer_id: "DLR-02",
      dealer_name: "Benny Motor Sport",
      cabang: "Tangerang 1",
      pic_handling: ["admin@digiasha.com"],
      aging_visit_mitra: 35,
      dealer_concern: null,
      units: [
        {
          no_fasilitas: "DT-202508160001",
          nopol: "B 1898 CZM",
          unit: "MITSUBISHI XPANDER 1.5 EXCEED AT (2019)",
          gps_status: "Offline",
          imei_gps: "867192837192002",
          contract_status: "LIVE",
          aging_visit_unit: 18,
          lifetime_days: 120,
          is_h3_jto: true,
          overdue_days: 5,
          aging_gps_maint: 40,
          unit_concern: { urgency: "Sangat Penting", note: "Fasilitas nunggak 5 hari & GPS offline." }
        },
        {
          no_fasilitas: "DC-202509080001",
          nopol: "B 2428 FMU",
          unit: "TOYOTA NEW AVANZA VELOZ 1.5 AT (2013)",
          gps_status: "Belum Pasang",
          imei_gps: "",
          contract_status: "LIVE",
          aging_visit_unit: 6,
          lifetime_days: 45,
          is_h3_jto: true,
          overdue_days: 0,
          aging_gps_maint: 10,
          unit_concern: null
        }
      ]
    },
    {
      dealer_id: "DLR-03",
      dealer_name: "Garasi 69",
      cabang: "Tangerang 1",
      pic_handling: ["admin@digiasha.com"],
      aging_visit_mitra: 22,
      dealer_concern: null,
      units: [
        {
          no_fasilitas: "DC-202509270002",
          nopol: "B 1139 VOW",
          unit: "TOYOTA AGYA 1.2 G M/T (2022)",
          gps_status: "Normal",
          imei_gps: "867192837192003",
          contract_status: "LIVE",
          aging_visit_unit: 8,
          lifetime_days: 30,
          is_h3_jto: false,
          overdue_days: 0,
          aging_gps_maint: 5,
          unit_concern: null
        }
      ]
    },
    {
      dealer_id: "DLR-04",
      dealer_name: "Mitra Regular Non-Fasilitas",
      cabang: "Tangerang 1",
      pic_handling: ["admin@digiasha.com"],
      aging_visit_mitra: 45,
      dealer_concern: null,
      units: []
    }
  ],

  facGpsMonitoring: [
    { id: "U-01", dealer: "ARJM", asset_desc: "XPANDER (B 1898 CZM / 2019)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["7"], catatan: "" },
    { id: "U-02", dealer: "JMB", asset_desc: "BMW (B 2011 JMB / 2017)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["7"], catatan: "" },
    { id: "U-03", dealer: "ABU BAKAR", asset_desc: "AVANZA (B 1409 ABK / 2016)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["7"], catatan: "" },
    { id: "U-04", dealer: "PUTRA", asset_desc: "FREED (B 1184 PTR / 2014)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["7"], catatan: "" },
    { id: "U-05", dealer: "ARJM", asset_desc: "FREED (B 1589 ARJ / 2015)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["5"], catatan: "Unit Disimpan Dirumah Diminasaupa" },
    { id: "U-06", dealer: "AKS", asset_desc: "FREED (B 2309 AKS / 2013)", status_kontrak: "LIVE", gps_installed: true, status_codes: ["5"], catatan: "Dipakai Mobile" },
    { id: "U-07", dealer: "JATIA", asset_desc: "CRV (B 1948 JTA / 2018)", status_kontrak: "EXPIRED", gps_installed: true, status_codes: ["2"], catatan: "" },
    { id: "U-08", dealer: "JMB", asset_desc: "CRV (B 1029 JMB / 2019)", status_kontrak: "EXPIRED", gps_installed: true, status_codes: ["2"], catatan: "" },
    { id: "U-09", dealer: "GOSYEN", asset_desc: "CX5 (B 1084 FZP / 2016)", status_kontrak: "LIVE", gps_installed: true, status_codes: [], catatan: "" },
    { id: "U-10", dealer: "GARASI 69", asset_desc: "AGYA (B 1139 VOW / 2022)", status_kontrak: "LIVE", gps_installed: true, status_codes: [], catatan: "" }
  ]
};

// Tambahkan atau pastikan property ini ada di dalam DUMMY_DB pada dummy-data.js
DUMMY_DB.masterVehiclesGps = {
  "DLR-01": [
    { nopol: "B 1084 FZP", unit: "MAZDA CX5 2.5 AT GT (2016)", contract_status: "LIVE", gps_status: "TERPASANG", imei: "864502049102931" },
    { nopol: "B 9912 KLA", unit: "HONDA HR-V 1.5 E CVT (2020)", contract_status: "LIVE", gps_status: "BELUM_PASANG", imei: "" },
    { nopol: "B 8831 ZZZ", unit: "TOYOTA INNOVA 2.0 G (2018)", contract_status: "EXPIRED", gps_status: "TERPASANG", imei: "861928371928471" }
  ],
  "DLR-02": [
    { nopol: "B 1898 CZM", unit: "MITSUBISHI XPANDER EXCEED (2019)", contract_status: "LIVE", gps_status: "TERPASANG", imei: "867192837192019" },
    { nopol: "B 2428 FMU", unit: "TOYOTA AVANZA VELOZ (2013)", contract_status: "IN_PROCESS", gps_status: "BELUM_PASANG", imei: "" },
    { nopol: "B 3102 PQR", unit: "DAIHATSU XENIA 1.3 (2017)", contract_status: "EXPIRED", gps_status: "TERPASANG", imei: "863391827461920" }
  ],
  "DLR-03": [
    { nopol: "B 1139 VOW", unit: "TOYOTA AGYA 1.2 G MT (2022)", contract_status: "LIVE", gps_status: "BELUM_PASANG", imei: "" }
  ]
};

DUMMY_DB.branchIdleImeiList = [
  { imei: "865910293847192", tipe: "GPS Concox GT06N - Stok Cabang" },
  { imei: "865910293847193", tipe: "GPS Concox GT06N - Stok Cabang" },
  { imei: "864491028371625", tipe: "GPS Meitrack T333 - Stok Cabang" },
  { imei: "867728192837461", tipe: "GPS Sinotrack ST-901 - Stok Cabang" },
  { imei: "869918273645129", tipe: "GPS Concox GT06N - Stok Cabang" }
];