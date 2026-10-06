-- =========================================================================
-- SUPABASE POSTGRESQL: 09_job_position_multi_app_permissions.sql
-- SENTRALISASI HAK AKSES MULTI-APLIKASI BERBASIS JABATAN (RBAC)
-- =========================================================================
-- Ekosistem Aplikasi yang diatur terpusat:
-- 1. digi_active   -> Digi Active (Aplikasi Operasional & Workflow Lapangan)
-- 2. digicore      -> Digiasha Core Enterprise (Web Portal)
-- 3. digi_workapp  -> Digi Appwork (Mobile Operational & Presensi)
-- 4. digi_spector  -> Digispector (Aplikasi Inspeksi Kendaraan)
--
-- Format permission_code: {app_key}:{module_key}:{action}
-- Contoh:
--   - digi_active:priority:view
--   - digi_active:priority:edit
--   - digicore:org_structure:view
--   - digicore:org_structure:edit
--   - digi_workapp:attendance_gps:view
--   - digi_workapp:attendance_gps:edit
--   - digi_spector:inspection_queue:view
--   - digi_spector:inspection_queue:edit
-- =========================================================================

-- 1. PASTIKAN TABEL hr_job_position_permissions ADA & SESUAI
CREATE TABLE IF NOT EXISTS public.hr_job_position_permissions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    position_id TEXT NOT NULL,
    permission_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT hr_job_position_permissions_pos_perm_key UNIQUE (position_id, permission_code)
);

-- 2. PASTIKAN SQL VIEW job_position_permissions MENGARAH KE hr_job_position_permissions
CREATE OR REPLACE VIEW public.job_position_permissions WITH (security_invoker = on) AS
SELECT * FROM public.hr_job_position_permissions;

-- 3. NONAKTIFKAN RLS AGAR UNRESTRICTED & BERIKAN HAK AKSES API LENGKAP
ALTER TABLE public.hr_job_position_permissions DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.hr_job_position_permissions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.job_position_permissions TO anon, authenticated, service_role;

-- 4. SEED HAK AKSES DEFAULT UNTUK JABATAN STANDAR (AMAT AMAN / CONDITIONAL)
-- Script ini hanya akan memasukkan izin jika ID jabatan tersebut memang ADA di tabel hr_job_positions.
-- Jika tabel jabatan masih kosong (karena Anda sedang menyiapkan struktur organisasi baru), query ini otomatis dilewati dengan aman tanpa error!
INSERT INTO public.hr_job_position_permissions (position_id, permission_code)
SELECT v.pos_id, v.perm_code
FROM (
  VALUES
    -- POS-DIR-UTAMA (Direktur Utama - Akses Penuh Seluruh Aplikasi)
    ('POS-DIR-UTAMA', 'digi_active:priority:view'),
    ('POS-DIR-UTAMA', 'digi_active:priority:edit'),
    ('POS-DIR-UTAMA', 'digi_active:visit:view'),
    ('POS-DIR-UTAMA', 'digi_active:visit:edit'),
    ('POS-DIR-UTAMA', 'digi_active:onboarding:view'),
    ('POS-DIR-UTAMA', 'digi_active:onboarding:edit'),
    ('POS-DIR-UTAMA', 'digi_active:pipeline:view'),
    ('POS-DIR-UTAMA', 'digi_active:pipeline:edit'),
    ('POS-DIR-UTAMA', 'digi_active:gps:view'),
    ('POS-DIR-UTAMA', 'digi_active:gps:edit'),
    ('POS-DIR-UTAMA', 'digi_active:fac:view'),
    ('POS-DIR-UTAMA', 'digi_active:fac:edit'),
    ('POS-DIR-UTAMA', 'digi_active:assignment:view'),
    ('POS-DIR-UTAMA', 'digi_active:assignment:edit'),
    ('POS-DIR-UTAMA', 'digi_active:history:view'),
    ('POS-DIR-UTAMA', 'digi_active:history:edit'),
    ('POS-DIR-UTAMA', 'digi_active:laporan_activity:view'),
    ('POS-DIR-UTAMA', 'digi_active:laporan_activity:edit'),
    ('POS-DIR-UTAMA', 'digi_active:izin:view'),
    ('POS-DIR-UTAMA', 'digi_active:izin:edit'),
    ('POS-DIR-UTAMA', 'digi_active:persetujuan:view'),
    ('POS-DIR-UTAMA', 'digi_active:persetujuan:edit'),
    ('POS-DIR-UTAMA', 'digi_active:attendance_summary:view'),
    ('POS-DIR-UTAMA', 'digi_active:attendance_summary:edit'),
    ('POS-DIR-UTAMA', 'digi_active:rekap_tim:view'),
    ('POS-DIR-UTAMA', 'digi_active:rekap_tim:edit'),
    ('POS-DIR-UTAMA', 'digi_active:slip_gaji:view'),
    ('POS-DIR-UTAMA', 'digi_active:slip_gaji:edit'),
    ('POS-DIR-UTAMA', 'digi_active:personalia:view'),
    ('POS-DIR-UTAMA', 'digi_active:personalia:edit'),
    ('POS-DIR-UTAMA', 'digi_active:expense_claim:view'),
    ('POS-DIR-UTAMA', 'digi_active:expense_claim:edit'),
    ('POS-DIR-UTAMA', 'digi_active:internal_memo:view'),
    ('POS-DIR-UTAMA', 'digi_active:internal_memo:edit'),
    ('POS-DIR-UTAMA', 'digi_active:employee_loan:view'),
    ('POS-DIR-UTAMA', 'digi_active:employee_loan:edit'),
    ('POS-DIR-UTAMA', 'digi_active:helpdesk_support:view'),
    ('POS-DIR-UTAMA', 'digi_active:helpdesk_support:edit'),
    ('POS-DIR-UTAMA', 'digi_active:ketentuan:view'),
    ('POS-DIR-UTAMA', 'digi_active:ketentuan:edit'),
    ('POS-DIR-UTAMA', 'digi_active:sop_management:view'),
    ('POS-DIR-UTAMA', 'digi_active:sop_management:edit'),
    ('POS-DIR-UTAMA', 'digi_active:organization_setting:view'),
    ('POS-DIR-UTAMA', 'digi_active:organization_setting:edit'),
    ('POS-DIR-UTAMA', 'digi_active:settings:view'),
    ('POS-DIR-UTAMA', 'digi_active:settings:edit'),
    ('POS-DIR-UTAMA', 'digicore:org_structure:view'),
    ('POS-DIR-UTAMA', 'digicore:org_structure:edit'),
    ('POS-DIR-UTAMA', 'digicore:employee_mgmt:view'),
    ('POS-DIR-UTAMA', 'digicore:employee_mgmt:edit'),
    ('POS-DIR-UTAMA', 'digicore:approval_onboarding:view'),
    ('POS-DIR-UTAMA', 'digicore:approval_onboarding:edit'),
    ('POS-DIR-UTAMA', 'digicore:approval_pre_komite:view'),
    ('POS-DIR-UTAMA', 'digicore:approval_pre_komite:edit'),
    ('POS-DIR-UTAMA', 'digicore:approval_final_komite:view'),
    ('POS-DIR-UTAMA', 'digicore:approval_final_komite:edit'),
    ('POS-DIR-UTAMA', 'digicore:approval_cek_bpkb:view'),
    ('POS-DIR-UTAMA', 'digicore:approval_cek_bpkb:edit'),
    ('POS-DIR-UTAMA', 'digicore:approval_inspeksi:view'),
    ('POS-DIR-UTAMA', 'digicore:approval_inspeksi:edit'),
    ('POS-DIR-UTAMA', 'digicore:vehicle_pricelist:view'),
    ('POS-DIR-UTAMA', 'digicore:vehicle_pricelist:edit'),
    ('POS-DIR-UTAMA', 'digicore:package_maintenance:view'),
    ('POS-DIR-UTAMA', 'digicore:package_maintenance:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:attendance_gps:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:attendance_gps:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:task_assignment:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:task_assignment:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:visit_dealer:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:visit_dealer:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:onboarding_partner:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:onboarding_partner:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:daily_activity:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:daily_activity:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:expense_claim:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:expense_claim:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:leave_permit:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:leave_permit:edit'),
    ('POS-DIR-UTAMA', 'digi_workapp:payslip_info:view'),
    ('POS-DIR-UTAMA', 'digi_workapp:payslip_info:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:inspection_queue:view'),
    ('POS-DIR-UTAMA', 'digi_spector:inspection_queue:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:field_inspection_form:view'),
    ('POS-DIR-UTAMA', 'digi_spector:field_inspection_form:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:engine_body_checklist:view'),
    ('POS-DIR-UTAMA', 'digi_spector:engine_body_checklist:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:vehicle_photo_doc:view'),
    ('POS-DIR-UTAMA', 'digi_spector:vehicle_photo_doc:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:bpkb_stnk_validation:view'),
    ('POS-DIR-UTAMA', 'digi_spector:bpkb_stnk_validation:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:market_price_scoring:view'),
    ('POS-DIR-UTAMA', 'digi_spector:market_price_scoring:edit'),
    ('POS-DIR-UTAMA', 'digi_spector:inspection_approval:view'),
    ('POS-DIR-UTAMA', 'digi_spector:inspection_approval:edit'),

    -- POS-BM-SERANG & POS-BM-TGR (Branch Manager)
    ('POS-BM-SERANG', 'digi_active:priority:view'),
    ('POS-BM-SERANG', 'digi_active:priority:edit'),
    ('POS-BM-SERANG', 'digi_active:visit:view'),
    ('POS-BM-SERANG', 'digi_active:visit:edit'),
    ('POS-BM-SERANG', 'digi_active:pipeline:view'),
    ('POS-BM-SERANG', 'digi_active:pipeline:edit'),
    ('POS-BM-SERANG', 'digi_active:assignment:view'),
    ('POS-BM-SERANG', 'digi_active:assignment:edit'),
    ('POS-BM-SERANG', 'digi_active:history:view'),
    ('POS-BM-SERANG', 'digi_active:laporan_activity:view'),
    ('POS-BM-SERANG', 'digi_active:persetujuan:view'),
    ('POS-BM-SERANG', 'digi_active:persetujuan:edit'),
    ('POS-BM-SERANG', 'digi_active:attendance_summary:view'),
    ('POS-BM-SERANG', 'digi_active:rekap_tim:view'),
    ('POS-BM-SERANG', 'digi_active:expense_claim:view'),
    ('POS-BM-SERANG', 'digi_active:expense_claim:edit'),
    ('POS-BM-SERANG', 'digi_active:ketentuan:view'),
    ('POS-BM-SERANG', 'digicore:org_structure:view'),
    ('POS-BM-SERANG', 'digicore:employee_mgmt:view'),
    ('POS-BM-SERANG', 'digicore:approval_onboarding:view'),
    ('POS-BM-SERANG', 'digicore:approval_onboarding:edit'),
    ('POS-BM-SERANG', 'digicore:approval_pre_komite:view'),
    ('POS-BM-SERANG', 'digicore:approval_pre_komite:edit'),
    ('POS-BM-SERANG', 'digicore:approval_cek_bpkb:view'),
    ('POS-BM-SERANG', 'digicore:approval_inspeksi:view'),
    ('POS-BM-SERANG', 'digi_workapp:attendance_gps:view'),
    ('POS-BM-SERANG', 'digi_workapp:attendance_gps:edit'),
    ('POS-BM-SERANG', 'digi_workapp:task_assignment:view'),
    ('POS-BM-SERANG', 'digi_workapp:task_assignment:edit'),
    ('POS-BM-SERANG', 'digi_workapp:visit_dealer:view'),
    ('POS-BM-SERANG', 'digi_workapp:daily_activity:view'),
    ('POS-BM-SERANG', 'digi_workapp:expense_claim:view'),
    ('POS-BM-SERANG', 'digi_workapp:expense_claim:edit'),
    ('POS-BM-SERANG', 'digi_workapp:leave_permit:view'),
    ('POS-BM-SERANG', 'digi_workapp:leave_permit:edit'),
    ('POS-BM-SERANG', 'digi_workapp:payslip_info:view'),
    ('POS-BM-SERANG', 'digi_spector:inspection_queue:view'),
    ('POS-BM-SERANG', 'digi_spector:inspection_approval:view'),
    ('POS-BM-SERANG', 'digi_spector:inspection_approval:edit'),

    -- POS-FAC-OFFICER (Field Action Coordinator)
    ('POS-FAC-OFFICER', 'digi_active:priority:view'),
    ('POS-FAC-OFFICER', 'digi_active:visit:view'),
    ('POS-FAC-OFFICER', 'digi_active:visit:edit'),
    ('POS-FAC-OFFICER', 'digi_active:pipeline:view'),
    ('POS-FAC-OFFICER', 'digi_active:assignment:view'),
    ('POS-FAC-OFFICER', 'digi_active:assignment:edit'),
    ('POS-FAC-OFFICER', 'digi_active:history:view'),
    ('POS-FAC-OFFICER', 'digi_active:laporan_activity:view'),
    ('POS-FAC-OFFICER', 'digi_active:laporan_activity:edit'),
    ('POS-FAC-OFFICER', 'digi_active:izin:view'),
    ('POS-FAC-OFFICER', 'digi_active:izin:edit'),
    ('POS-FAC-OFFICER', 'digi_active:expense_claim:view'),
    ('POS-FAC-OFFICER', 'digi_active:expense_claim:edit'),
    ('POS-FAC-OFFICER', 'digi_active:ketentuan:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:attendance_gps:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:attendance_gps:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:task_assignment:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:task_assignment:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:visit_dealer:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:visit_dealer:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:onboarding_partner:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:onboarding_partner:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:daily_activity:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:daily_activity:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:expense_claim:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:expense_claim:edit'),
    ('POS-FAC-OFFICER', 'digi_workapp:leave_permit:view'),
    ('POS-FAC-OFFICER', 'digi_workapp:payslip_info:view')
) AS v(pos_id, perm_code)
WHERE EXISTS (
    SELECT 1 FROM public.hr_job_positions p 
    WHERE p.id_position = v.pos_id
)
ON CONFLICT (position_id, permission_code) DO NOTHING;
