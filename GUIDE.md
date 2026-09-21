# 📋 DIGI-ACTION — GUIDE UTAMA PROYEK

> **File ini adalah SATU-SATUNYA referensi kebenaran untuk semua AI Agent dan session kerja.**
> Sebelum mengerjakan apapun, baca file ini terlebih dahulu.
> Setelah selesai mengerjakan sesuatu, **UPDATE** file ini.

---

## 🌿 GIT BRANCHING WORKFLOW

> **ATURAN WAJIB**: Semua pekerjaan development dilakukan di branch `feature/fac-workflow`. **Jangan pernah push langsung ke `main`/`master`.**

### Struktur Branch
| Branch | Tujuan |
|--------|--------|
| `main` | **Production** — hanya menerima merge dari branch yang sudah ditest |
| `feature/fac-workflow` | **Development aktif** — semua perbaikan, fitur baru, dan eksperimen masuk sini |

### Prosedur Kerja (Wajib Diikuti Setiap Agent)

```powershell
# 1. Pastikan sudah di branch yang benar sebelum mulai
git checkout feature/fac-workflow
git pull origin feature/fac-workflow

# 2. Setelah selesai edit file, stage semua perubahan
git add -A

# 3. Commit dengan pesan deskriptif
git commit -m "fix: deskripsi singkat perubahan yang dilakukan"

# 4. Push ke remote branch (bukan ke main!)
git push origin feature/fac-workflow
```

### Konvensi Pesan Commit
| Prefix | Digunakan untuk |
|--------|-----------------|
| `fix:` | Perbaikan bug / data tidak sinkron |
| `feat:` | Fitur baru |
| `refactor:` | Refactor kode tanpa perubahan fungsional |
| `db:` | Perubahan skema / migrasi database |
| `docs:` | Update GUIDE.md atau dokumentasi |
| `chore:` | Maintenance, update dependency, config |

### Merge ke Production
Hanya dilakukan oleh owner proyek secara manual via GitHub Pull Request, setelah testing di branch `feature/fac-workflow` dinyatakan aman.

---

## 🏗️ ARSITEKTUR PROYEK

### Stack Teknologi
- **Frontend**: HTML + Vanilla JS (Single Page Application)
- **Backend**: Supabase (PostgreSQL + REST API)
- **Deploy**: Vercel
- **GAS Integration**: Google Apps Script (`gas/`) untuk sync data lama

### File Utama
| File | Peran |
|------|-------|
| `app.js` | ~1MB, ~22400 baris. Seluruh logika frontend (auth, CRUD, sync, screen controller) |
| `index.html` | Shell HTML + CSS + script loader |
| `screens/*.html` | Komponen per halaman (22 screen), di-inject dinamis ke index.html |
| `supabase/*.sql` | Migrasi database (01-11) |
| `gas/*.gs` | Google Apps Script sync |
| `config.js` | Konfigurasi Supabase URL & Key |

---

## 🗄️ SKEMA DATABASE

> **PENTING**: Semua tabel telah di-rename dengan prefix `hr_` (via migrasi 06). Nama lama (`employees`, `employee_personal_details`, dll.) adalah **SQL VIEW**, bukan tabel fisik. Operasi `UPDATE`/`INSERT` ke VIEW dari Supabase REST API **sering gagal silent** — selalu target tabel fisik `hr_*`.

### Tabel Fisik Aktif
| Tabel Fisik | View Lama | Keterangan |
|-------------|-----------|------------|
| `hr_employees` | `employees` | **Master data karyawan inti** |
| `hr_employee_personal_details` | `employee_personal_details` | Data pribadi sipil |
| `hr_employee_career_histories` | `employee_career_histories` | Riwayat karir |
| `hr_employee_transactions` | *(tidak ada view)* | Transaksi kepegawaian |
| `hr_transaction_staging_approvals` | *(tidak ada view)* | Approval bertingkat |
| `hr_transaction_agreements` | *(tidak ada view)* | Audit trail persetujuan elektronik |
| `hr_organization_units` | `organization_units` | Master unit org |
| `hr_job_positions` | `job_positions` | Master jabatan |
| `hr_master_levels` | `master_levels` | Level/grade jabatan |
| `hr_work_locations` | `work_locations` | Master lokasi kerja |

### Kolom Kritis: `hr_employees`
```sql
id              UUID PRIMARY KEY
nip             TEXT UNIQUE          -- Format: MMYYXXXX (e.g. 09260001)
name            TEXT
email           TEXT UNIQUE
user_id         UUID
location_id     TEXT                 -- FK → hr_organization_units.id_unit (BOD, HO-CORP, dll.)
position_id     TEXT                 -- FK → hr_job_positions.id_position (COO, POS-GM-OPS, dll.)
supervisor_id   UUID                 -- FK → hr_employees.id
role            TEXT                 -- R-01 sampai R-07
status_kerja    TEXT                 -- 'PKWTT' | 'PKWT' | 'PROBATION' | 'MAGANG'
tanggal_masuk   DATE
tanggal_selesai_kontrak DATE
deleted_at      TIMESTAMPTZ          -- NULL = AKTIF; NOT NULL = NONAKTIF/Keluar
created_at, updated_at TIMESTAMPTZ
```

> **Kolom yang TIDAK ADA di hr_employees** (jangan dikirim!):
> `work_location_id`, `unit_id`, `basic_salary`, `level_id`, `status_aktif`, `is_active`, `tanggal_keluar`, `contract_no`, `contract_start_date`

### Kolom Kritis: `hr_employee_personal_details`
```sql
id UUID PRIMARY KEY
employee_id UUID UNIQUE       -- FK → hr_employees.id
ktp_number TEXT               -- NIK KTP 16 digit
pob TEXT                      -- Tempat Lahir
dob DATE                      -- Tanggal Lahir
gender TEXT                   -- 'Laki-laki' / 'Perempuan'
religion TEXT
marital_status TEXT            -- 'Lajang' | 'Menikah' | 'Cerai'
spouse_name TEXT
number_of_dependents INTEGER
address_ktp, address_domicile TEXT
phone TEXT
emergency_contact_name, emergency_contact_phone, emergency_contact_relation TEXT
foto_profile_url TEXT
name TEXT                     -- (added via migration 10)
email TEXT                    -- (added via migration 10)
personal_details JSONB        -- Raw data snapshot (added via migration 10 & 11)
education TEXT, major TEXT    -- (added via migration 11)
created_at, updated_at TIMESTAMPTZ
```

### Kolom Kritis: `hr_employee_transactions`
```sql
id UUID PRIMARY KEY
employee_id UUID
nip TEXT
transaction_types TEXT[]       -- Array jenis transaksi
effective_date DATE
status TEXT                   -- DRAFT | PENDING_AGREEMENT | PENDING_APPROVAL | IN_REVIEW | APPROVED | REJECTED
current_stage INT
created_by_nip TEXT
-- Posisi & Lokasi:
work_location_id TEXT          -- ID lokasi kerja (WL-HO-01, dll.)
unit_id TEXT                  -- ID unit organisasi baru (BOD, dll.)
position_id TEXT
new_position_id TEXT           -- Jabatan baru (Rotasi/Promosi)
prev_position_id TEXT
new_location_id TEXT           -- Lokasi baru
prev_location_id TEXT
new_unit_id TEXT               -- Unit baru (Mutasi)
prev_unit_id TEXT
-- Kontrak:
join_date DATE, employment_status TEXT
contract_no TEXT, contract_start_date DATE, contract_end_date DATE
-- Remunerasi (NUMERIC, 6 jenis tunjangan):
prev_basic_salary, new_basic_salary
prev_allowance_jabatan, new_allowance_jabatan
prev_allowance_transport, new_allowance_transport
prev_allowance_komunikasi, new_allowance_komunikasi
prev_allowance_tempat_tinggal, new_allowance_tempat_tinggal
prev_allowance_penempatan, new_allowance_penempatan
prev_allowance_kemahalan, new_allowance_kemahalan
-- PHK:
uang_pisah NUMERIC, uang_pisah_notes TEXT
exit_interview_no TEXT, inventory_returned TEXT, inventory_not_returned TEXT
-- Dokumen:
doc_cv_url, doc_ktp_url, doc_kk_url, doc_npwp_url, doc_kontrak_url TEXT
-- Data Pribadi:
personal_data_updates JSONB
```

---

## 🔄 ALUR PROSES TRANSAKSI KEPEGAWAIAN

```
[HR Input Form Transaksi]
    ↓ INSERT ke hr_employee_transactions (status: DRAFT / PENDING_AGREEMENT)
[Karyawan Tanda Tangan Elektronik]
    ↓ INSERT ke hr_transaction_agreements
    ↓ UPDATE hr_employee_transactions (status: IN_REVIEW, current_stage: 1)
[Atasan Level 1 Approve]
    ↓ UPDATE hr_transaction_staging_approvals (stage 1 → APPROVED)
    ↓ Jika ada stage berikutnya: UPDATE current_stage++
[Atasan Level N Approve — Final Stage]
    ↓ UPDATE hr_employee_transactions (status: APPROVED)
    ↓ CALL applyApprovedTransactionToEmployee(tx)
        ↓ UPDATE hr_employees (location_id, position_id, status_kerja, dll.)
        ↓ UPSERT hr_employee_personal_details (jika ada personal_data_updates)
        ↓ INSERT hr_employee_career_histories (audit trail riwayat karir)
```

### Mapping Jenis Transaksi → Efek ke hr_employees
| Jenis Transaksi | Kolom yang diupdate |
|----------------|---------------------|
| `Penerimaan Karyawan` | position_id, location_id, status_kerja, tanggal_masuk |
| `Perpanjang Kontrak` | status_kerja=PKWT, tanggal_selesai_kontrak |
| `Pengangkatan Kontrak` | status_kerja=PKWT, tanggal_selesai_kontrak |
| `Tetap (PKWTT)` | status_kerja=PKWTT, tanggal_selesai_kontrak=null |
| `Rotasi` | position_id (dari new_position_id) |
| `Mutasi` | location_id (dari new_unit_id → new_location_id → unit_id) |
| `Promosi` | position_id (dari new_position_id) |
| `Demosi` | position_id (dari new_position_id) |
| `Pembaruan Data Pribadi` | name, email di hr_employees + UPSERT hr_employee_personal_details |
| `Resign` / `PHK` / `Pensiun` | deleted_at = effective_date |

---

## 📁 FUNGSI KUNCI DI `app.js`

| Fungsi | Baris (approx) | Keterangan |
|--------|---------------|------------|
| `applyApprovedTransactionToEmployee(tx)` | ~22181 | **ENGINE UTAMA** — menerapkan transaksi ke hr_employees |
| `syncPendingApprovedTransactions()` | ~22356 | Scan & sync transaksi APPROVED saat app boot |
| `executeTransactionApproval(txId, stageId, action, notes)` | ~22078 | Controller approval atasan |
| `loadPersonaliaEmployees()` | ~19556 | Load daftar karyawan ke halaman Personalia |
| `initAppBootstrap()` | (awal file) | Bootstrap aplikasi + session |
| `supabaseClient` | (global) | Instance Supabase JS client |

---

## ✅ PROGRESS & STATUS PERBAIKAN

### [SELESAI] Fix Sinkronisasi Transaksi → hr_employees
**Tanggal**: 2026-09-19 s/d 2026-09-20
**Status**: ✅ DONE

**Root Cause Ditemukan**:
1. Query UPDATE menarget VIEW `employees` bukan tabel fisik `hr_employees` → silent fail
2. Payload membawa kolom yang tidak ada di skema (`work_location_id`, `contract_end_date`, dll.)
3. Error tersembunyi di balik `console.warn` — tidak terlihat saat production

**Yang Sudah Diperbaiki** (di `app.js` baris ~22181-22353):
- [x] Target query: `"employees"` → `"hr_employees"`
- [x] Perbaiki pemetaan kolom: `work_location_id` → `location_id`, `contract_end_date` → `tanggal_selesai_kontrak`
- [x] Hapus kolom tidak valid dari payload: `basic_salary`, `level_id`, `contract_no`, `status_aktif`, `is_active`, `tanggal_keluar`
- [x] Mutasi: priority chain `new_unit_id → new_location_id → unit_id → work_location_id` → `location_id`
- [x] PHK/Resign: gunakan `deleted_at` (bukan `status_aktif`)
- [x] Fallback ke VIEW `employees` jika `hr_employees` gagal (toleransi hak akses)
- [x] Riwayat karir → `hr_employee_career_histories` (tabel fisik)
- [x] Tambah `syncPendingApprovedTransactions()` — jalankan otomatis saat app boot
- [x] Error logging: ganti `console.warn` → `console.error` agar terlihat di DevTools

### [SELESAI] Fix Form Input Calon Karyawan
**Tanggal**: 2026-09-21
**Status**: ✅ DONE

**Root Cause Ditemukan**:
1. `handleSaveCandidate()` insert ke VIEW `employees` (bukan `hr_employees`) → error "Could not find the 'dob' column of 'employees' in the schema cache"
2. Payload berisi kolom yang TIDAK ADA di `hr_employees`: `dob`, `gender`, `marital_status`, `status_aktif`, `is_active`
3. Label UI form menampilkan istilah teknis "(JSONB)" yang membingungkan user
4. Error message menampilkan detail teknis Supabase langsung ke user

**Yang Sudah Diperbaiki**:
- [x] Target query: `.from("employees")` → `.from("hr_employees")` (baris ~19978)
- [x] Hapus kolom tidak valid dari empPayload: `dob`, `gender`, `marital_status`, `status_aktif`, `is_active`
- [x] Data pribadi (dob, gender, marital_status, dll.) tetap disimpan di `hr_employee_personal_details` (sudah benar sejak awal)
- [x] Tambah kolom baru ke personalPayload: `name`, `email`, `spouse_name`, `education`, `major`
- [x] Hapus label "(JSONB)" dari 3 section UI di `index.html`: "Data Keluarga & Anak", "Alamat & Geotagging Domisili", "Kontak Darurat"
- [x] Error handling: pesan teknis Supabase di-log ke `console.error`, user hanya melihat pesan user-friendly
- [x] Tambah error handling eksplisit untuk upsert `hr_employee_personal_details`

---

## 🚨 MASALAH YANG MASIH TERBUKA (TODO)

### [OPEN] Submit Data Belum Konsisten
**Status**: 🔴 BELUM SELESAI
**Ditemukan**: 2026-09-20

**Yang Perlu Diinvestigasi**:

1. **FK Violation — `location_id`**: Nilai `new_unit_id` dari form transaksi mungkin tidak cocok dengan `id_unit` di `hr_organization_units`. Contoh: transaksi kirim `"BOD"` tapi tabel master mungkin pakai `"HO-BOD"`.

2. **FK Violation — `position_id`**: Nilai `new_position_id` dari form transaksi mungkin tidak cocok dengan `id_position` di `hr_job_positions`. Contoh: transaksi kirim `"COO"` tapi master pakai `"POS-COO"`.

3. **Form populate dropdown**: Cek apakah dropdown jabatan & unit di form transaksi terisi dengan **ID** (bukan label/teks) dari data master.

4. **Status APPLIED belum ada**: Setelah `applyApprovedTransactionToEmployee` berhasil, status transaksi tidak berubah. `syncPendingApprovedTransactions` akan terus memproses ulang transaksi yang sama setiap kali app dibuka.

5. **RLS Supabase**: Pastikan di dashboard Supabase, RLS semua tabel HR benar-benar disabled atau ada permissive policy.

---

## 📐 KONVENSI WAJIB UNTUK SEMUA AGENT

### Aturan Database
```javascript
// ✅ BENAR — selalu target tabel fisik
await supabaseClient
  .from("hr_employees")          // TABEL FISIK
  .update({ 
    location_id: "BOD",          // ID dari hr_organization_units.id_unit
    position_id: "POS-COO",      // ID dari hr_job_positions.id_position
    status_kerja: "PKWT",
    tanggal_selesai_kontrak: "2027-09-19",
    updated_at: new Date().toISOString()
  })
  .eq("id", empId);

// ❌ SALAH
await supabaseClient
  .from("employees")             // VIEW — silent fail di Supabase REST!
  .update({ work_location_id: "WL-HO-01" })  // Kolom TIDAK ADA!
  .eq("id", empId);
```

### Aturan Error Handling
- **Selalu destructure error**: `const { data, error } = await supabase...`
- **Selalu log error eksplisit**: `if (error) console.error("[FunctionName]", error);`
- **Jangan sembunyikan error** dengan `console.warn` di catch blok utama

---

## 🔜 RENCANA KERJA SELANJUTNYA (PRIORITAS)

### P1 — Verifikasi FK & Konsistensi ID (Segera)
- [ ] Trace nilai `unit_id`, `new_unit_id` yang dikirim form transaksi
- [ ] Bandingkan dengan `id_unit` di `hr_organization_units`
- [ ] Trace nilai `position_id`, `new_position_id` vs `id_position` di `hr_job_positions`
- [ ] Fix populate dropdown form agar pakai ID yang valid

### P2 — Tambah Status APPLIED (Segera)
- [ ] Buat migrasi `12_add_applied_status.sql`: tambah `applied_at TIMESTAMPTZ NULL` ke `hr_employee_transactions`
- [ ] Update `applyApprovedTransactionToEmployee`: set `applied_at = NOW()` setelah sukses
- [ ] Update `syncPendingApprovedTransactions`: query `WHERE status = 'APPROVED' AND applied_at IS NULL`

### P3 — Audit & Validasi Form Submit (Berikutnya)
- [ ] Trace fungsi submit form transaksi di app.js
- [ ] Pastikan semua ID relasional (jabatan, unit) terisi dengan benar
- [ ] Tambah client-side validation sebelum submit

### P4 — Testing End-to-End (Setelah P1-P3)
- [ ] Buat transaksi baru dari form
- [ ] Approve transaksi
- [ ] Verifikasi data terupdate di hr_employees, hr_employee_personal_details, hr_employee_career_histories

---

## 📊 STATUS MIGRASI DATABASE

| File | Status | Keterangan |
|------|--------|------------|
| `01_priority_scoring_engine.sql` | ✅ Applied | Engine scoring prioritas |
| `02_storage_policies.sql` | ✅ Applied | Kebijakan storage |
| `03_ketentuan_pdf_portal.sql` | ✅ Applied | Portal ketentuan |
| `04_mceasy_tracking_schema.sql` | ✅ Applied | Tracking GPS |
| `05_organization_and_sso_schema.sql` | ✅ Applied | Skema organisasi & SSO awal |
| `06_reorganize_tables_prefixes.sql` | ✅ Applied | Rename tabel → prefix hr_, gps_, dll. + VIEW lama |
| `07_duplicate_m_employee_to_new_core_hr.sql` | ✅ Applied | Duplikasi data m_employee → hr_employees |
| `08_disable_rls_and_fix_permissions.sql` | ✅ Applied | Disable RLS + fix GRANT |
| `09_job_position_multi_app_permissions.sql` | ✅ Applied | Izin multi-app per jabatan |
| `10_employee_lifecycle_transactions.sql` | ✅ Applied | Tabel transaksi kepegawaian |
| `11_fix_personal_details_sync.sql` | ✅ Applied | Fix skema personal_details + backfill APPROVED |
| `12_add_applied_status.sql` | ⏳ PLANNED | Tambah applied_at + status APPLIED |

---

*Last updated: 2026-09-20 11:34 WIB — Claude Sonnet*
*Project path: `c:\Users\DIGIASHA\.gemini\antigravity-ide\scratch\Digi-Action\`*
*Active branch: `feature/fac-workflow` (development) → `main` (production)*
