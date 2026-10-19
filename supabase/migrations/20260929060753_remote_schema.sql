SET local check_function_bodies = off;

CREATE EXTENSION "pg_cron";

CREATE TABLE "public"."gps_devices" (
  "imei"          character varying(50)    NOT NULL,
  "status_device" character varying(50)    DEFAULT 'TERSEDIA'::character varying,
  "posisi_stock"  character varying(150)   DEFAULT 'Kantor Pusat'::character varying,
  "last_updated"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_gps_device_pkey" PRIMARY KEY (imei)
);

CREATE TABLE "public"."gps_fac_check" (
  "fac_report_id"      uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "created_at"         timestamp with time zone DEFAULT now(),
  "nip"                character varying(50),
  "nama_petugas"       character varying(150),
  "cabang"             character varying(100),
  "total_unit_checked" integer                  DEFAULT 0,
  "summary_findings"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "raw_details"        jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "catatan_fac"        text,
  CONSTRAINT "tr_gps_fac_check_pkey" PRIMARY KEY (fac_report_id)
);

ALTER TABLE "public"."gps_fac_check"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gps_maintenance" (
  "maint_id"            character varying(50)    NOT NULL,
  "created_at"          timestamp with time zone DEFAULT now(),
  "nip"                 character varying(50),
  "dealer_name"         character varying(150),
  "no_fasilitas"        character varying(50),
  "nopol"               character varying(30),
  "act_type"            character varying(50)    NOT NULL,
  "imei_lama"           character varying(50),
  "imei_baru"           character varying(50),
  "foto_imei_lama_url"  text,
  "foto_imei_baru_url"  text,
  "foto_posisi_gps_url" text,
  "catatan_teknis"      text,
  "lat"                 numeric(10,7),
  "long"                numeric(10,7),
  CONSTRAINT "tr_gps_maintenance_pkey" PRIMARY KEY (maint_id)
);

CREATE TABLE "public"."gps_vehicles_tracking_history" (
  "id"            bigint                   GENERATED ALWAYS AS IDENTITY (SEQUENCE NAME "public"."vehicles_tracking_history_id_seq") NOT NULL,
  "vehicle_id"    character varying(100)   NOT NULL,
  "plate_number"  character varying(100),
  "latitude"      double precision         NOT NULL,
  "longitude"     double precision         NOT NULL,
  "speed"         numeric(6,2)             DEFAULT 0,
  "direction"     integer                  DEFAULT 0,
  "engine_on"     boolean                  DEFAULT false,
  "motion_status" character varying(10),
  "battery"       integer,
  "trip_distance" numeric(10,2),
  "gps_timestamp" timestamp with time zone NOT NULL,
  "created_at"    timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT "vehicles_tracking_history_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."gps_vehicles_tracking_history"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."gps_vehicles_tracking" (
  "vehicle_id"         character varying(100)   NOT NULL,
  "plate_number"       character varying(100)   NOT NULL,
  "vehicle_name"       character varying(150),
  "imei"               character varying(50),
  "vehicle_group_name" character varying(150),
  "company_name"       character varying(150)   DEFAULT 'PT SURYA SARANA INVESTASI'::character varying,
  "latitude"           double precision,
  "longitude"          double precision,
  "speed"              numeric(6,2)             DEFAULT 0,
  "direction"          integer                  DEFAULT 0,
  "engine_on"          boolean                  DEFAULT false,
  "motion_status"      character varying(10),
  "battery"            integer,
  "signal_strength"    integer,
  "trip_distance"      numeric(10,2)            DEFAULT 0,
  "total_distance"     numeric(12,2)            DEFAULT 0,
  "address"            text,
  "gps_updated_at"     timestamp with time zone,
  "synced_at"          timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  "raw_data"           jsonb,
  CONSTRAINT "vehicles_tracking_pkey" PRIMARY KEY (vehicle_id)
);

ALTER TABLE "public"."gps_vehicles_tracking"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hr_absensi_log" (
  "absen_id"         character varying(50)    NOT NULL,
  "created_at"       timestamp with time zone DEFAULT now(),
  "nip"              character varying(50),
  "nama_karyawan"    character varying(150),
  "role"             character varying(50),
  "cabang"           character varying(100),
  "jenis_absen"      character varying(50),
  "lokasi_kantor"    character varying(100),
  "distance_meters"  integer,
  "lat"              numeric(10,7),
  "long"             numeric(10,7),
  "catatan"          text,
  "selfie_photo_url" text,
  "timestamp"        timestamp with time zone DEFAULT now(),
  "nearest_office"   character varying(150),
  "distance_meter"   numeric                  DEFAULT 0,
  "status_geofence"  character varying(50),
  "menit_terlambat"  numeric                  DEFAULT 0,
  "status_kehadiran" character varying(50),
  CONSTRAINT "tr_absensi_log_pkey" PRIMARY KEY (absen_id)
);

ALTER TABLE "public"."hr_absensi_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hr_employee_career_histories" (
  "id"                          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"                 uuid                     NOT NULL,
  "transaction_date"            date                     NOT NULL,
  "effective_date"              date                     NOT NULL,
  "transaction_type"            text                     NOT NULL,
  "no_sk"                       text,
  "file_sk_url"                 text,
  "description"                 text,
  "previous_position_id"        text,
  "new_position_id"             text,
  "previous_location_id"        text,
  "new_location_id"             text,
  "previous_level_id"           text,
  "new_level_id"                text,
  "previous_supervisor_id"      uuid,
  "new_supervisor_id"           uuid,
  "previous_status_kerja"       text,
  "new_status_kerja"            text,
  "previous_basic_salary"       numeric,
  "new_basic_salary"            numeric,
  "previous_allowances"         numeric,
  "new_allowances"              numeric,
  "bank_name"                   text,
  "bank_account_no"             text,
  "bank_account_holder"         text,
  "npwp_number"                 text,
  "tax_status"                  text,
  "bpjs_kesehatan_number"       text,
  "bpjs_ketenagakerjaan_number" text,
  "approved_by_nip"             text,
  "created_at"                  timestamp with time zone DEFAULT now(),
  "previous_allowance_makan"    numeric                  DEFAULT 0,
  "new_allowance_makan"         numeric                  DEFAULT 0,
  "previous_allowance_khusus"   numeric                  DEFAULT 0,
  "new_allowance_khusus"        numeric                  DEFAULT 0,
  "previous_allowance_insentif" numeric                  DEFAULT 0,
  "new_allowance_insentif"      numeric                  DEFAULT 0,
  "payroll_period_type"         text                     DEFAULT 'CUT_OFF'::text,
  "payroll_deductions_json"     jsonb                    DEFAULT '{}'::jsonb,
  CONSTRAINT "employee_career_histories_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_employee_personal_details" (
  "id"                         uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"                uuid                     NOT NULL,
  "ktp_number"                 text,
  "pob"                        text,
  "dob"                        date,
  "gender"                     text,
  "religion"                   text,
  "marital_status"             text,
  "number_of_dependents"       integer                  DEFAULT 0,
  "address_ktp"                text,
  "address_domicile"           text,
  "phone"                      text,
  "emergency_contact_name"     text,
  "emergency_contact_phone"    text,
  "emergency_contact_relation" text,
  "foto_profile_url"           text,
  "created_at"                 timestamp with time zone DEFAULT now(),
  "updated_at"                 timestamp with time zone DEFAULT now(),
  "personal_details"           jsonb                    DEFAULT '{}'::jsonb,
  "spouse_name"                text,
  "education"                  text,
  "major"                      text,
  "name"                       text,
  "email"                      text,
  CONSTRAINT "employee_personal_details_employee_id_key" UNIQUE (employee_id),
  CONSTRAINT "employee_personal_details_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_employee_transactions" (
  "id"                            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "employee_id"                   uuid                     NOT NULL,
  "nip"                           text,
  "transaction_types"             text[]                   NOT NULL DEFAULT '{}'::text[],
  "effective_date"                date                     NOT NULL DEFAULT CURRENT_DATE,
  "status"                        text                     NOT NULL DEFAULT 'PENDING_APPROVAL'::text,
  "current_stage"                 integer                  NOT NULL DEFAULT 1,
  "created_by_nip"                text,
  "created_at"                    timestamp with time zone DEFAULT now(),
  "updated_at"                    timestamp with time zone DEFAULT now(),
  "work_location_id"              text,
  "unit_id"                       text,
  "position_id"                   text,
  "join_date"                     date,
  "employment_status"             text,
  "contract_no"                   text,
  "contract_start_date"           date,
  "contract_end_date"             date,
  "prev_position_id"              text,
  "new_position_id"               text,
  "prev_level_id"                 text,
  "new_level_id"                  text,
  "prev_location_id"              text,
  "new_location_id"               text,
  "prev_unit_id"                  text,
  "new_unit_id"                   text,
  "prev_basic_salary"             numeric                  DEFAULT 0,
  "new_basic_salary"              numeric                  DEFAULT 0,
  "prev_allowance_jabatan"        numeric                  DEFAULT 0,
  "new_allowance_jabatan"         numeric                  DEFAULT 0,
  "prev_allowance_transport"      numeric                  DEFAULT 0,
  "new_allowance_transport"       numeric                  DEFAULT 0,
  "prev_allowance_komunikasi"     numeric                  DEFAULT 0,
  "new_allowance_komunikasi"      numeric                  DEFAULT 0,
  "prev_allowance_tempat_tinggal" numeric                  DEFAULT 0,
  "new_allowance_tempat_tinggal"  numeric                  DEFAULT 0,
  "prev_allowance_penempatan"     numeric                  DEFAULT 0,
  "new_allowance_penempatan"      numeric                  DEFAULT 0,
  "prev_allowance_kemahalan"      numeric                  DEFAULT 0,
  "new_allowance_kemahalan"       numeric                  DEFAULT 0,
  "uang_pisah"                    numeric                  DEFAULT 0,
  "uang_pisah_notes"              text,
  "exit_interview_no"             text,
  "inventory_returned"            text,
  "inventory_not_returned"        text,
  "doc_cv_url"                    text,
  "doc_ktp_url"                   text,
  "doc_kk_url"                    text,
  "doc_npwp_url"                  text,
  "doc_kontrak_url"               text,
  "personal_data_updates"         jsonb,
  "prev_allowance_makan"          numeric                  DEFAULT 0,
  "new_allowance_makan"           numeric                  DEFAULT 0,
  "prev_allowance_khusus"         numeric                  DEFAULT 0,
  "new_allowance_khusus"          numeric                  DEFAULT 0,
  "prev_allowance_insentif"       numeric                  DEFAULT 0,
  "new_allowance_insentif"        numeric                  DEFAULT 0,
  "payroll_period_type"           text                     DEFAULT 'CUT_OFF'::text,
  "payroll_deductions_json"       jsonb                    DEFAULT '{}'::jsonb,
  CONSTRAINT "hr_employee_transactions_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_employees" (
  "id"                      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "nip"                     text,
  "name"                    text,
  "email"                   text,
  "location_id"             text,
  "position_id"             text,
  "supervisor_id"           uuid,
  "must_change_password"    boolean                  DEFAULT false,
  "current_session_id"      text,
  "status_kerja"            text                     DEFAULT 'PKWTT'::text,
  "tanggal_masuk"           date,
  "tanggal_selesai_kontrak" date,
  "deleted_at"              timestamp with time zone,
  "created_at"              timestamp with time zone DEFAULT now(),
  "updated_at"              timestamp with time zone DEFAULT now(),
  CONSTRAINT "employees_email_key" UNIQUE (email),
  CONSTRAINT "employees_nip_key" UNIQUE (nip),
  CONSTRAINT "employees_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_izin_log" (
  "izin_id"           character varying(50)    NOT NULL,
  "timestamp"         timestamp with time zone DEFAULT now(),
  "nip"               character varying(50),
  "nama"              character varying(150),
  "cabang"            character varying(100),
  "jenis_izin"        character varying(50),
  "tgl_mulai"         date,
  "tgl_selesai"       date,
  "catatan"           text,
  "lat"               numeric,
  "long"              numeric,
  "selfie_url"        text,
  "pic_approval_nip"  character varying(50),
  "pic_approval_nama" character varying(150),
  "status_approval"   character varying(50)    DEFAULT 'PENDING'::character varying,
  "approved_at"       timestamp with time zone,
  "approved_by"       character varying(150),
  "catatan_approval"  text,
  "created_at"        timestamp with time zone DEFAULT now(),
  CONSTRAINT "tr_izin_log_pkey" PRIMARY KEY (izin_id)
);

ALTER TABLE "public"."hr_izin_log"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hr_job_position_permissions" (
  "id"              uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "position_id"     text,
  "permission_code" text                     NOT NULL,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "job_position_permissions_pkey" PRIMARY KEY (id),
  CONSTRAINT "job_position_permissions_position_id_permission_code_key" UNIQUE (position_id, permission_code)
);

ALTER TABLE "public"."hr_job_position_permissions"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hr_job_positions" (
  "id_position"             text                     NOT NULL,
  "nama_jabatan"            text                     NOT NULL,
  "level_id"                text,
  "reports_to_unit_id"      text,
  "coordination_to_unit_id" text,
  "unit_id"                 text,
  "is_active"               boolean                  DEFAULT true,
  "created_at"              timestamp with time zone DEFAULT now(),
  "updated_at"              timestamp with time zone DEFAULT now(),
  CONSTRAINT "job_positions_pkey" PRIMARY KEY (id_position)
);

CREATE TABLE "public"."hr_master_levels" (
  "id_level"    text                     NOT NULL,
  "nama_level"  text                     NOT NULL,
  "bobot_level" integer                  NOT NULL,
  "is_active"   boolean                  DEFAULT true,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "master_levels_pkey" PRIMARY KEY (id_level)
);

CREATE TABLE "public"."hr_organization_units" (
  "id_unit"          text                     NOT NULL,
  "tipe_unit"        text                     NOT NULL,
  "nama_unit"        text                     NOT NULL,
  "parent_unit_id"   text,
  "work_location_id" text,
  "is_active"        boolean                  DEFAULT true,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "organization_units_pkey" PRIMARY KEY (id_unit),
  CONSTRAINT "organization_units_tipe_unit_check" CHECK ((tipe_unit = ANY (ARRAY['HO'::text, 'AREA'::text, 'CABANG'::text])))
);

CREATE TABLE "public"."hr_payroll_parameters" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "kode_komponen" text                     NOT NULL,
  "nama_komponen" text                     NOT NULL,
  "jenis"         text                     NOT NULL,
  "formula"       text                     NOT NULL,
  "is_active"     boolean                  DEFAULT true,
  "created_at"    timestamp with time zone DEFAULT now(),
  "updated_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "hr_payroll_parameters_kode_komponen_key" UNIQUE (kode_komponen),
  CONSTRAINT "hr_payroll_parameters_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."hr_payroll_parameters"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."hr_transaction_agreements" (
  "id"                  uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id"      uuid                     NOT NULL,
  "employee_id"         uuid,
  "employee_nip"        text                     NOT NULL,
  "is_agreed"           boolean                  NOT NULL DEFAULT false,
  "agreed_at"           timestamp with time zone,
  "ip_address"          text,
  "user_agent"          text,
  "agreement_statement" text,
  "created_at"          timestamp with time zone DEFAULT now(),
  CONSTRAINT "hr_transaction_agreements_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_transaction_staging_approvals" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" uuid                     NOT NULL,
  "stage_order"    integer                  NOT NULL DEFAULT 1,
  "approver_nip"   text                     NOT NULL,
  "approver_role"  text,
  "status"         text                     NOT NULL DEFAULT 'PENDING'::text,
  "approved_at"    timestamp with time zone,
  "notes"          text,
  "created_at"     timestamp with time zone DEFAULT now(),
  "updated_at"     timestamp with time zone DEFAULT now(),
  CONSTRAINT "hr_transaction_staging_approvals_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."hr_work_locations" (
  "id_work_location" text                     NOT NULL,
  "nama_lokasi"      text                     NOT NULL,
  "alamat_lengkap"   text                     NOT NULL,
  "kota"             text,
  "provinsi"         text,
  "latitude"         numeric                  NOT NULL,
  "longitude"        numeric                  NOT NULL,
  "radius_meter"     integer                  DEFAULT 100,
  "is_active"        boolean                  DEFAULT true,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "work_locations_pkey" PRIMARY KEY (id_work_location)
);

CREATE TABLE "public"."m_dealer" (
  "dealer_id"          character varying(50)    NOT NULL,
  "dealer_name"        character varying(150)   NOT NULL,
  "owner_name"         character varying(150),
  "cabang"             character varying(100),
  "area_cover"         character varying(100)   DEFAULT ''::character varying,
  "productivity"       character varying(100)   DEFAULT 'Normal'::character varying,
  "status"             character varying(50)    DEFAULT 'AKTIF'::character varying,
  "tanggal_kerjasama"  date,
  "last_visit_date"    date,
  "aging_visit_mitra"  integer                  DEFAULT 0,
  "urgent_units_count" integer                  DEFAULT 0,
  "priority_level"     character varying(50)    DEFAULT 'Normal'::character varying,
  "priority_score"     integer                  DEFAULT 0,
  "priority_reason"    text,
  "created_at"         timestamp with time zone DEFAULT now(),
  "updated_at"         timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_dealer_pkey" PRIMARY KEY (dealer_id)
);

CREATE TABLE "public"."m_employee" (
  "nip"               character varying(50)    NOT NULL,
  "email"             character varying(100)   NOT NULL,
  "nama_lengkap"      character varying(150)   NOT NULL,
  "jabatan"           character varying(100),
  "cabang"            character varying(100),
  "area_cover"        text                     DEFAULT ''::text,
  "password_hash"     text                     NOT NULL,
  "role_id"           character varying(20)    NOT NULL DEFAULT 'R-04'::character varying,
  "status_ganti_pass" boolean                  DEFAULT false,
  "status_aktif"      character varying(20)    DEFAULT 'AKTIF'::character varying,
  "created_at"        timestamp with time zone DEFAULT now(),
  "updated_at"        timestamp with time zone DEFAULT now(),
  "atasan_nip"        character varying(50),
  "atasan_nama"       character varying(150),
  CONSTRAINT "m_employee_email_key" UNIQUE (email),
  CONSTRAINT "m_employee_pkey" PRIMARY KEY (nip)
);

ALTER TABLE "public"."m_employee"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."m_facility_unit" (
  "no_fasilitas"     character varying(50)    NOT NULL,
  "dealer_name"      character varying(150)   NOT NULL,
  "nopol"            character varying(30)    NOT NULL,
  "unit"             character varying(150),
  "contract_status"  character varying(50)    DEFAULT 'LIVE'::character varying,
  "jto_date"         date,
  "overdue_days"     integer                  DEFAULT 0,
  "lifetime_days"    integer                  DEFAULT 0,
  "imei_gps"         character varying(50),
  "gps_status"       character varying(50)    DEFAULT 'Normal'::character varying,
  "last_visit_date"  date,
  "aging_visit_unit" integer                  DEFAULT 0,
  "aging_gps_maint"  integer                  DEFAULT 0,
  "priority_level"   character varying(50)    DEFAULT 'Normal'::character varying,
  "priority_score"   integer                  DEFAULT 0,
  "priority_reason"  text,
  "is_h3_jto"        boolean                  DEFAULT false,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_facility_unit_pkey" PRIMARY KEY (no_fasilitas)
);

CREATE TABLE "public"."m_ketentuan" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "judul"         character varying(255)   NOT NULL,
  "nomor_dokumen" character varying(100),
  "kategori"      character varying(100)   DEFAULT 'SOP Operasional'::character varying,
  "tgl_berlaku"   date                     NOT NULL,
  "pdf_url"       text                     NOT NULL,
  "file_name"     character varying(255),
  "file_size"     integer                  DEFAULT 0,
  "allowed_roles" jsonb                    DEFAULT '["ALL"]'::jsonb,
  "is_active"     boolean                  DEFAULT true,
  "uploaded_by"   character varying(100),
  "created_at"    timestamp with time zone DEFAULT now(),
  "updated_at"    timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_ketentuan_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."m_ketentuan"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."m_organization_unit" (
  "org_id"     character varying(50)    NOT NULL,
  "org_name"   character varying(100)   NOT NULL,
  "org_type"   character varying(50)    DEFAULT 'CABANG'::character varying,
  "parent_id"  character varying(50),
  "head_nip"   character varying(50),
  "created_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_organization_unit_pkey" PRIMARY KEY (org_id)
);

ALTER TABLE "public"."m_organization_unit"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."m_role_permission" (
  "role_id"     character varying(20)    NOT NULL,
  "role_name"   character varying(100)   NOT NULL,
  "permissions" jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "description" text,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_role_permission_pkey" PRIMARY KEY (role_id)
);

ALTER TABLE "public"."m_role_permission"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."m_work_location" (
  "location_id"      character varying(50)    NOT NULL,
  "name"             character varying(100)   NOT NULL,
  "lat"              numeric(10,7)            NOT NULL,
  "long"             numeric(10,7)            NOT NULL,
  "max_radius_meter" integer                  DEFAULT 100,
  "address"          text,
  "created_at"       timestamp with time zone DEFAULT now(),
  "updated_at"       timestamp with time zone DEFAULT now(),
  CONSTRAINT "m_work_location_pkey" PRIMARY KEY (location_id)
);

CREATE TABLE "public"."sso_clients" (
  "client_id"       character varying(50)    NOT NULL,
  "client_name"     character varying(100)   NOT NULL,
  "client_secret"   character varying(255)   NOT NULL,
  "app_icon"        text,
  "redirect_uris"   jsonb                    DEFAULT '[]'::jsonb,
  "allowed_origins" jsonb                    DEFAULT '[]'::jsonb,
  "description"     text,
  "is_active"       boolean                  DEFAULT true,
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "sso_clients_pkey" PRIMARY KEY (client_id)
);

CREATE TABLE "public"."sso_tokens" (
  "token_id"     uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "auth_code"    character varying(100),
  "nip"          character varying(50),
  "employee_id"  uuid,
  "client_id"    character varying(50),
  "expires_at"   timestamp with time zone NOT NULL,
  "is_used"      boolean                  DEFAULT false,
  "session_data" jsonb,
  "created_at"   timestamp with time zone DEFAULT now(),
  CONSTRAINT "sso_tokens_auth_code_key" UNIQUE (auth_code),
  CONSTRAINT "sso_tokens_pkey" PRIMARY KEY (token_id)
);

ALTER TABLE "public"."sso_tokens"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."sys_audit_trail" (
  "trail_id"    uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "created_at"  timestamp with time zone DEFAULT now(),
  "user_id"     character varying(100)   NOT NULL,
  "action"      character varying(100)   NOT NULL,
  "detail_info" text,
  "device_info" text,
  "ip_address"  character varying(50),
  CONSTRAINT "sys_audit_trail_pkey" PRIMARY KEY (trail_id)
);

ALTER TABLE "public"."sys_audit_trail"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."t_priority_action" (
  "action_id"      uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "source"         text                     NOT NULL DEFAULT 'AUTO_CALCULATE'::text,
  "assigned_by"    text                     DEFAULT 'SYSTEM'::text,
  "entity_type"    text                     NOT NULL,
  "entity_id"      text,
  "entity_name"    text                     NOT NULL,
  "cabang"         text,
  "priority_level" text                     NOT NULL,
  "priority_score" integer                  NOT NULL DEFAULT 1,
  "action_reason"  text                     NOT NULL,
  "notes"          text,
  "is_fu"          boolean                  NOT NULL DEFAULT false,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "fu_at"          timestamp with time zone,
  "fu_by"          text,
  "fu_visit_id"    text,
  CONSTRAINT "t_priority_action_pkey" PRIMARY KEY (action_id)
);

ALTER TABLE "public"."t_priority_action"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."tr_laporan_visit" (
  "visit_id"              character varying(50)    NOT NULL,
  "created_at"            timestamp with time zone DEFAULT now(),
  "nip"                   character varying(50),
  "dealer_name"           character varying(150)   NOT NULL,
  "lokasi"                character varying(100)   DEFAULT 'Showroom'::character varying,
  "bertemu_owner"         character varying(10),
  "owner_reason"          text,
  "stock"                 integer                  DEFAULT 0,
  "sales"                 integer                  DEFAULT 0,
  "issue_digi"            text,
  "issue_internal"        text,
  "issue_komp"            text,
  "total_unit"            integer                  DEFAULT 0,
  "catatan_visit"         text,
  "lat"                   numeric(10,7),
  "long"                  numeric(10,7),
  "showroom_photo_url"    text,
  "tindak_lanjut_concern" text,
  CONSTRAINT "tr_laporan_visit_pkey" PRIMARY KEY (visit_id)
);

CREATE TABLE "public"."tr_onboarding_log" (
  "onboarding_id"     character varying(50)    NOT NULL,
  "created_at"        timestamp with time zone DEFAULT now(),
  "nip"               character varying(50),
  "dealer_name"       character varying(150)   NOT NULL,
  "owner_name"        character varying(150),
  "lokasi_lat"        numeric(10,7),
  "lokasi_long"       numeric(10,7),
  "survei_kelayakan"  character varying(50),
  "catatan_survey"    text,
  "foto_ktp_url"      text,
  "foto_showroom_url" text,
  "doc_legalitas_url" text,
  CONSTRAINT "tr_onboarding_log_pkey" PRIMARY KEY (onboarding_id)
);

CREATE TABLE "public"."tr_visit_unit_check" (
  "check_id"          character varying(50)    NOT NULL,
  "visit_id"          character varying(50),
  "created_at"        timestamp with time zone DEFAULT now(),
  "dealer_name"       character varying(150),
  "no_fasilitas"      character varying(50),
  "nopol"             character varying(30),
  "unit_desc"         character varying(150),
  "status_keberadaan" character varying(50),
  "kondisi_unit"      character varying(50),
  "foto_unit_url"     text,
  "catatan_unit"      text,
  CONSTRAINT "tr_visit_unit_check_pkey" PRIMARY KEY (check_id)
);

CREATE OR REPLACE FUNCTION public.get_active_supervisor_id (
  p_position_id text
)
  RETURNS uuid
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
DECLARE
    v_curr_pos_id TEXT := p_position_id;
    v_parent_pos_id TEXT;
    v_supervisor_id UUID := NULL;
    v_loop_depth INT := 0;
    v_max_depth CONSTANT INT := 50; -- Mencegah infinite loop pada circular hierarchy
BEGIN
    IF p_position_id IS NULL OR TRIM(p_position_id) = '' THEN
        RETURN NULL;
    END IF;

    -- Telusuri hierarki atasan (reports_to_unit_id) ke atas secara bertahap
    WHILE v_curr_pos_id IS NOT NULL AND v_loop_depth < v_max_depth LOOP
        v_loop_depth := v_loop_depth + 1;

        -- Cari jabatan atasan langsung dari jabatan saat ini
        SELECT jp.reports_to_unit_id
        INTO v_parent_pos_id
        FROM public.hr_job_positions jp
        WHERE jp.id_position = v_curr_pos_id;

        -- Jika tidak ada atasan lagi (sudah di puncak hierarki, misal Direktur Utama)
        IF v_parent_pos_id IS NULL OR TRIM(v_parent_pos_id) = '' THEN
            EXIT;
        END IF;

        -- Cari apakah ada karyawan aktif yang menduduki jabatan atasan tersebut
        -- Syarat karyawan aktif: deleted_at IS NULL dan status_kerja != 'CALON'
        SELECT e.id
        INTO v_supervisor_id
        FROM public.hr_employees e
        WHERE e.position_id = v_parent_pos_id
          AND e.deleted_at IS NULL
          AND (e.status_kerja IS NULL OR UPPER(TRIM(e.status_kerja)) != 'CALON')
        ORDER BY e.created_at ASC
        LIMIT 1;

        -- Jika ditemukan karyawan aktif di jabatan atasan tersebut, kembalikan id-nya
        IF v_supervisor_id IS NOT NULL THEN
            RETURN v_supervisor_id;
        END IF;

        -- Jika jabatan atasan kosong (VACANT), terus naik ke jabatan atasan di atasnya
        v_curr_pos_id := v_parent_pos_id;
    END LOOP;

    -- Return NULL jika tidak ada atasan aktif yang ditemukan hingga puncak hierarki
    RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.mark_priority_fu (
  p_entity_type       text,
  p_entity_name_or_id text,
  p_nip               text,
  p_visit_id          text,
  p_log_date          date DEFAULT CURRENT_DATE
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
BEGIN
  IF UPPER(p_entity_type) = 'DEALER' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'DEALER'
      AND (entity_name ILIKE '%' || p_entity_name_or_id || '%' OR entity_id = p_entity_name_or_id);

  ELSIF UPPER(p_entity_type) = 'UNIT' THEN
    UPDATE t_priority_action
    SET is_fu = true, fu_at = NOW(), fu_by = p_nip, fu_visit_id = p_visit_id, updated_at = NOW()
    WHERE is_fu = false
      AND entity_type = 'UNIT'
      AND (entity_id = p_entity_name_or_id OR entity_name ILIKE '%' || p_entity_name_or_id || '%');
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalculate_all_priorities()
  RETURNS json
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_units_updated INT := 0;
  v_dealers_updated INT := 0;
  v_active_tasks INT := 0;
  v_log_error TEXT := NULL;
  rec RECORD;
BEGIN

  -- --------------------------------------------------------------------------
  -- A. EVALUASI DAN UPDATE PRIORITAS UNIT FASILITAS (m_facility_unit)
  -- --------------------------------------------------------------------------
  WITH unit_calc AS (
    SELECT 
      u.no_fasilitas,
      -- 1. Hitung Aging Visit Unit (Hari ini - Last Visit / Lifetime)
      GREATEST(0, (v_today - COALESCE(u.last_visit_date, (v_today - (COALESCE(u.lifetime_days, 0) || ' days')::INTERVAL)::DATE, v_today))) AS calc_aging_visit,
      
      -- 2. Ambil Concern Aktif dari t_priority_action (Manual Supervisor)
      c.concern_urgency,
      c.concern_note,
      
      -- 3. Flag H-3 JTO
      (u.jto_date IS NOT NULL AND u.jto_date >= v_today AND u.jto_date <= (v_today + INTERVAL '3 days')::DATE) AS is_h3_jto,
      
      -- 4. Status Kontrak & Validitas IMEI
      (UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
      ) AS is_eligible,

      -- 5. Status Closed / Dormant dari Dealer Induk (Productivity: 7.Closed, 5. Dormant)
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_dealer_closed_or_dormant
    FROM m_facility_unit u
    LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
    LEFT JOIN (
      SELECT 
        REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') AS unit_fasilitas_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY REGEXP_REPLACE(UPPER(TRIM(COALESCE(entity_id, ''))), '[\s\-_.]', '', 'g') ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'UNIT'
    ) c ON (
      REGEXP_REPLACE(UPPER(TRIM(u.no_fasilitas)), '[\s\-_.]', '', 'g') = c.unit_fasilitas_clean
      AND c.unit_fasilitas_clean <> ''
    ) AND c.rn = 1
  ),
  unit_scored AS (
    SELECT 
      u.no_fasilitas,
      uc.calc_aging_visit,
      CASE
        -- Non-eligible contract check
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 0

        -- Status Dealer Closed / Dormant: Jangan jadi prioritas otomatis kecuali ada assign concern
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 0

        -- Level: SANGAT PENTING (Score 3)
        WHEN uc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 3
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 3
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 3

        -- Level: PENTING (Score 2)
        WHEN uc.concern_urgency = 'Penting' THEN 2
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 2
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 2
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 2
        WHEN uc.calc_aging_visit >= 22 THEN 2

        -- Level: MODERAT (Score 1)
        WHEN uc.calc_aging_visit >= 15 THEN 1
        WHEN uc.concern_urgency = 'Moderat' THEN 1
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 1

        -- Level: NORMAL (Score 0)
        ELSE 0
      END AS calc_score,

      CASE
        -- Non-eligible contract
        WHEN NOT uc.is_eligible AND uc.concern_urgency IS NULL THEN 'Normal'

        -- Status Dealer Closed / Dormant
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal'

        WHEN uc.concern_urgency = 'Sangat Penting' THEN 'Sangat Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%']) THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Sangat Penting'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Sangat Penting'

        WHEN uc.concern_urgency = 'Penting' THEN 'Penting'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'Penting'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Penting'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Penting'
        WHEN uc.calc_aging_visit >= 22 THEN 'Penting'

        WHEN uc.calc_aging_visit >= 15 THEN 'Moderat'
        WHEN uc.concern_urgency = 'Moderat' THEN 'Moderat'
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Moderat'

        ELSE 'Normal'
      END AS calc_level,

      CASE
        WHEN uc.concern_urgency IS NOT NULL THEN 'Concern: ' || COALESCE(uc.concern_note, '-')
        WHEN uc.is_dealer_closed_or_dormant AND uc.concern_urgency IS NULL THEN 'Normal (Mitra Closed / Dormant)'
        WHEN u.gps_status ILIKE ANY(ARRAY['%Pelepasan%', '%Offline%', '%Baterai Lemah%', '%Belum Lepas%', '%Belum Pasang%', '%Geser%']) THEN 'GPS Alert: ' || u.gps_status
        WHEN uc.calc_aging_visit >= 22 AND COALESCE(u.lifetime_days, 0) > 90 THEN 'Aging Visit >= 22 hr (' || uc.calc_aging_visit || ' hr) & Lifetime > 90 hr (' || COALESCE(u.lifetime_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 15 AND uc.is_h3_jto THEN 'Aging Visit >= 15 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 3 AND COALESCE(u.overdue_days, 0) >= 3 THEN 'Aging Visit >= 3 hr (' || uc.calc_aging_visit || ' hr) & Overdue >= 3 hr (' || COALESCE(u.overdue_days, 0) || ' hr)'
        WHEN uc.calc_aging_visit >= 5 AND uc.is_h3_jto THEN 'Aging Visit >= 5 hr (' || uc.calc_aging_visit || ' hr) & H-3 JTO (' || TO_CHAR(u.jto_date, 'YYYY-MM-DD') || ')'
        WHEN uc.calc_aging_visit >= 22 THEN 'Aging Visit Unit >= 22 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN uc.calc_aging_visit >= 15 THEN 'Aging Visit Unit >= 15 hr (' || uc.calc_aging_visit || ' hr)'
        WHEN COALESCE(u.aging_gps_maint, 0) > 30 THEN 'Aging Maintenance GPS > 30 hr (' || COALESCE(u.aging_gps_maint, 0) || ' hr)'
        ELSE 'Normal'
      END AS calc_reason
    FROM m_facility_unit u
    JOIN unit_calc uc ON u.no_fasilitas = uc.no_fasilitas
  )
  UPDATE m_facility_unit u
  SET 
    aging_visit_unit = us.calc_aging_visit,
    priority_score = us.calc_score,
    priority_level = us.calc_level,
    priority_reason = us.calc_reason,
    updated_at = NOW()
  FROM unit_scored us
  WHERE u.no_fasilitas = us.no_fasilitas;

  GET DIAGNOSTICS v_units_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- B. EVALUASI DAN UPDATE PRIORITAS MITRA DEALER (m_dealer)
  -- --------------------------------------------------------------------------
  WITH dealer_unit_agg AS (
    SELECT 
      LOWER(TRIM(u.dealer_name)) AS dealer_name_clean,
      COALESCE(MAX(u.priority_score), 0) AS max_unit_score,
      COALESCE(
        MAX(CASE WHEN u.priority_score > 0 THEN u.priority_reason END), 
        'Normal'
      ) AS unit_highest_reason,
      BOOL_OR(u.priority_reason LIKE 'Concern: %') AS has_assigned_unit_concern
    FROM m_facility_unit u
    WHERE UPPER(COALESCE(u.contract_status, 'LIVE')) LIKE '%LIVE%' 
       OR (UPPER(COALESCE(u.contract_status, '')) LIKE '%EXPIRED%' AND LENGTH(REGEXP_REPLACE(COALESCE(u.imei_gps, ''), '\D', '', 'g')) >= 6)
    GROUP BY LOWER(TRIM(u.dealer_name))
  ),
  dealer_calc AS (
    SELECT 
      d.dealer_id,
      GREATEST(0, (v_today - COALESCE(d.last_visit_date, d.tanggal_kerjasama, d.created_at::DATE, v_today))) AS calc_aging_visit,
      c.concern_urgency,
      c.concern_note
    FROM m_dealer d
    LEFT JOIN (
      SELECT 
        COALESCE(entity_id, '') AS dealer_id_clean,
        LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', '')) AS dealer_name_clean,
        priority_level AS concern_urgency,
        action_reason AS concern_note,
        ROW_NUMBER() OVER(PARTITION BY COALESCE(NULLIF(entity_id, ''), LOWER(REGEXP_REPLACE(TRIM(entity_name), '\s*\([^)]*\)\s*$', ''))) ORDER BY created_at DESC) as rn
      FROM t_priority_action
      WHERE is_fu = false AND source = 'MANUAL_SUPERVISOR' AND entity_type = 'DEALER'
    ) c ON (
      (c.dealer_id_clean <> '' AND d.dealer_id = c.dealer_id_clean)
      OR LOWER(TRIM(d.dealer_name)) = c.dealer_name_clean 
      OR LOWER(REGEXP_REPLACE(TRIM(d.dealer_name), '\s*\([^)]*\)\s*$', '')) = c.dealer_name_clean
    ) AND c.rn = 1
  ),
  dealer_mitra_rules AS (
    SELECT 
      d.dealer_id,
      dc.calc_aging_visit,
      (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') AS is_closed_or_dormant,
      CASE 
        WHEN dc.concern_urgency = 'Sangat Penting' THEN 3
        WHEN dc.concern_urgency = 'Penting' THEN 2
        WHEN dc.concern_urgency = 'Moderat' THEN 1
        -- Abaikan aging visit jika Closed / Dormant
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 0
        WHEN dc.calc_aging_visit >= 31 THEN 2
        WHEN dc.calc_aging_visit >= 22 THEN 1
        ELSE 0
      END AS mitra_score,

      CASE 
        WHEN dc.concern_urgency IS NOT NULL THEN 'Concern Mitra: ' || COALESCE(dc.concern_note, '-')
        WHEN (COALESCE(d.productivity, '') ILIKE '%Closed%' OR COALESCE(d.productivity, '') ILIKE '%Dormant%') THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dc.calc_aging_visit >= 31 THEN 'Aging Visit Mitra >= 31 hr (' || dc.calc_aging_visit || ' hr)'
        WHEN dc.calc_aging_visit >= 22 THEN 'Aging Visit Mitra >= 22 hr (' || dc.calc_aging_visit || ' hr)'
        ELSE 'Normal'
      END AS mitra_reason
    FROM m_dealer d
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
  ),
  final_dealer_scored AS (
    SELECT 
      d.dealer_id,
      dmr.calc_aging_visit,
      CASE 
        -- Jika Closed / Dormant dan tidak ada concern dealer maupun unit concern yang di-assign: skor = 0 (Normal)
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 0
        ELSE GREATEST(dmr.mitra_score, COALESCE(dua.max_unit_score, 0))
      END AS final_score,
      CASE 
        WHEN dmr.is_closed_or_dormant AND dc.concern_urgency IS NULL AND COALESCE(dua.has_assigned_unit_concern, false) = false THEN 'Normal (Mitra Closed / Dormant)'
        WHEN dmr.mitra_score >= COALESCE(dua.max_unit_score, 0) AND dmr.mitra_score > 0 THEN dmr.mitra_reason
        WHEN COALESCE(dua.max_unit_score, 0) > 0 THEN 'Pemicu Unit: ' || dua.unit_highest_reason
        ELSE 'Normal'
      END AS final_reason
    FROM m_dealer d
    JOIN dealer_mitra_rules dmr ON d.dealer_id = dmr.dealer_id
    JOIN dealer_calc dc ON d.dealer_id = dc.dealer_id
    LEFT JOIN dealer_unit_agg dua ON LOWER(TRIM(d.dealer_name)) = dua.dealer_name_clean
  )
  UPDATE m_dealer d
  SET 
    aging_visit_mitra = fds.calc_aging_visit,
    priority_score = fds.final_score,
    priority_level = CASE fds.final_score
      WHEN 3 THEN 'Sangat Penting'
      WHEN 2 THEN 'Penting'
      WHEN 1 THEN 'Moderat'
      ELSE 'Normal'
    END,
    priority_reason = fds.final_reason,
    updated_at = NOW()
  FROM final_dealer_scored fds
  WHERE d.dealer_id = fds.dealer_id;

  GET DIAGNOSTICS v_dealers_updated = ROW_COUNT;

  -- --------------------------------------------------------------------------
  -- C. ANTREAN TUGAS TERPADU (t_priority_action) - ACTIVE TASK LIFECYCLE
  -- --------------------------------------------------------------------------
  BEGIN
    -- A. Evaluasi Dealer Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        d.dealer_id,
        d.dealer_name,
        d.cabang,
        d.priority_level,
        d.priority_score,
        d.priority_reason
      FROM m_dealer d
      WHERE d.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk dealer ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'DEALER' 
          AND (entity_id = rec.dealer_id OR LOWER(TRIM(entity_name)) = LOWER(TRIM(rec.dealer_name)))
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'DEALER', rec.dealer_id, rec.dealer_name, rec.cabang,
          rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- B. Evaluasi Unit Fasilitas Prioritas (Skor > 0)
    FOR rec IN 
      SELECT 
        u.no_fasilitas,
        u.nopol,
        u.unit,
        COALESCE(d.cabang, '-') AS cabang,
        u.priority_level,
        u.priority_score,
        u.priority_reason
      FROM m_facility_unit u
      LEFT JOIN m_dealer d ON LOWER(TRIM(u.dealer_name)) = LOWER(TRIM(d.dealer_name))
      WHERE u.priority_score > 0
    LOOP
      -- Cek apakah sudah ada tiket otomatis aktif (is_fu = false) dari sistem untuk unit ini
      IF EXISTS (
        SELECT 1 FROM t_priority_action 
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE'
      ) THEN
        -- JANGAN DUPLIKAT TIKET OTOMATIS: Update skor & alasan terbaru, pertahankan created_at awal
        UPDATE t_priority_action
        SET priority_level = rec.priority_level,
            priority_score = rec.priority_score,
            action_reason = rec.priority_reason,
            cabang = COALESCE(rec.cabang, cabang),
            updated_at = NOW()
        WHERE entity_type = 'UNIT' 
          AND entity_id = rec.no_fasilitas
          AND is_fu = false
          AND source = 'AUTO_CALCULATE';
      ELSE
        -- BUAT TIKET BARU: Karena belum ada tiket otomatis sistem yang aktif untuk unit ini
        INSERT INTO t_priority_action (
          source, assigned_by, entity_type, entity_id, entity_name, cabang,
          priority_level, priority_score, action_reason, is_fu, created_at, updated_at
        ) VALUES (
          'AUTO_CALCULATE', 'SYSTEM', 'UNIT', rec.no_fasilitas, 
          rec.nopol || ' (' || COALESCE(rec.unit, '-') || ')', 
          rec.cabang, rec.priority_level, rec.priority_score, rec.priority_reason, false, NOW(), NOW()
        );
      END IF;
    END LOOP;

    -- C. Tutup tiket otomatis (AUTO_CALCULATE) untuk dealer atau unit yang skornya sudah 0 (misal: normal atau Closed/Dormant)
    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'DEALER'
      AND entity_id IN (
        SELECT dealer_id FROM m_dealer WHERE priority_score = 0
      );

    UPDATE t_priority_action
    SET is_fu = true,
        updated_at = NOW()
    WHERE is_fu = false
      AND source = 'AUTO_CALCULATE'
      AND entity_type = 'UNIT'
      AND entity_id IN (
        SELECT no_fasilitas FROM m_facility_unit WHERE priority_score = 0
      );

    -- Hitung total tiket aktif saat ini
    SELECT COUNT(*) INTO v_active_tasks FROM t_priority_action WHERE is_fu = false;
  EXCEPTION WHEN OTHERS THEN
    v_log_error := SQLERRM;
    RAISE NOTICE 'Antrean t_priority_action notice: %', SQLERRM;
  END;

  RETURN json_build_object(
    'status', 'success',
    'message', 'Kalkulasi prioritas Supabase selesai (Unified Active Task Lifecycle)',
    'facility_units_updated', v_units_updated,
    'dealers_updated', v_dealers_updated,
    'active_priority_tasks', v_active_tasks,
    'execution_date', v_today,
    'error_detail', v_log_error
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_auto_recalculate_concern()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
BEGIN
  PERFORM recalculate_all_priorities();
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_recalculate_subordinates_supervisor()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
    -- Menyala jika position_id, deleted_at, atau status_kerja berubah
    IF (NEW.position_id IS DISTINCT FROM OLD.position_id) OR
       (NEW.deleted_at IS DISTINCT FROM OLD.deleted_at) OR
       (NEW.status_kerja IS DISTINCT FROM OLD.status_kerja) THEN

        -- Cari semua bawahan langsung yang mencatat OLD.id sebagai supervisor_id
        -- Hitung ulang supervisor_id mereka secara dinamis agar dialihkan ke atasan aktif berikutnya
        UPDATE public.hr_employees sub
        SET supervisor_id = public.get_active_supervisor_id(sub.position_id),
            updated_at = NOW()
        WHERE sub.supervisor_id = OLD.id
          AND sub.id <> OLD.id; -- Menghindari circular self-reference
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_set_supervisor_on_upsert()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'pg_temp'
  AS $function$
BEGIN
    -- Dijalankan pada INSERT, atau pada UPDATE jika position_id berubah
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.position_id IS DISTINCT FROM OLD.position_id) THEN
        IF NEW.position_id IS NOT NULL AND TRIM(NEW.position_id) <> '' THEN
            NEW.supervisor_id := public.get_active_supervisor_id(NEW.position_id);
        ELSE
            NEW.supervisor_id := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_sso_token (
  p_auth_code     character varying,
  p_client_id     character varying,
  p_client_secret character varying
)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
DECLARE
    v_client RECORD;
    v_token RECORD;
    v_emp RECORD;
    v_detail RECORD;
    v_pos RECORD;
    v_unit RECORD;
    v_latest_career RECORD;
BEGIN
    SELECT * INTO v_client FROM public.sso_clients WHERE client_id = p_client_id AND client_secret = p_client_secret AND is_active = TRUE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Kredensial client SSO tidak valid');
    END IF;

    SELECT * INTO v_token FROM public.sso_tokens 
    WHERE auth_code = p_auth_code AND client_id = p_client_id AND is_used = FALSE AND expires_at > NOW();
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Token SSO tidak ditemukan atau kadaluarsa');
    END IF;

    UPDATE public.sso_tokens SET is_used = TRUE WHERE token_id = v_token.token_id;

    SELECT * INTO v_emp FROM public.employees WHERE id = v_token.employee_id AND deleted_at IS NULL;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Akun karyawan tidak ditemukan atau non-aktif');
    END IF;

    SELECT * INTO v_detail FROM public.employee_personal_details WHERE employee_id = v_emp.id;
    SELECT * INTO v_pos FROM public.job_positions WHERE id_position = v_emp.position_id;
    SELECT * INTO v_unit FROM public.organization_units WHERE id_unit = v_emp.location_id;
    SELECT * INTO v_latest_career FROM public.employee_career_histories WHERE employee_id = v_emp.id ORDER BY effective_date DESC LIMIT 1;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object(
            'id', v_emp.id,
            'nip', v_emp.nip,
            'name', v_emp.name,
            'email', v_emp.email,
            'role', v_emp.role,
            'status_kerja', v_emp.status_kerja,
            'position_id', v_emp.position_id,
            'nama_jabatan', COALESCE(v_pos.nama_jabatan, '-'),
            'location_id', v_emp.location_id,
            'nama_unit', COALESCE(v_unit.nama_unit, '-'),
            'tipe_unit', COALESCE(v_unit.tipe_unit, '-'),
            'phone', COALESCE(v_detail.phone, '-'),
            'foto_profile_url', v_detail.foto_profile_url,
            'bank_name', COALESCE(v_latest_career.bank_name, '-'),
            'bank_account_no', COALESCE(v_latest_career.bank_account_no, '-')
        )
    );
END;
$function$;

ALTER TABLE "public"."hr_employee_career_histories"
  ADD CONSTRAINT "employee_career_histories_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.hr_employees(id) ON DELETE CASCADE;

ALTER TABLE "public"."hr_employee_personal_details"
  ADD CONSTRAINT "employee_personal_details_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.hr_employees(id) ON DELETE CASCADE;

ALTER TABLE "public"."hr_employees"
  ADD CONSTRAINT "employees_supervisor_id_fkey" FOREIGN KEY (supervisor_id) REFERENCES public.hr_employees(id) ON DELETE CASCADE;

ALTER TABLE "public"."hr_employee_career_histories"
  ADD CONSTRAINT "employee_career_histories_new_position_fkey" FOREIGN KEY (new_position_id) REFERENCES public.hr_job_positions(id_position) ON DELETE SET NULL;

ALTER TABLE "public"."hr_employee_career_histories"
  ADD CONSTRAINT "employee_career_histories_previous_position_fkey" FOREIGN KEY (previous_position_id) REFERENCES public.hr_job_positions(id_position) ON DELETE SET NULL;

ALTER TABLE "public"."hr_employees"
  ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.hr_job_positions(id_position) ON DELETE SET NULL;

ALTER TABLE "public"."hr_job_position_permissions"
  ADD CONSTRAINT "job_position_permissions_position_id_fkey" FOREIGN KEY (position_id) REFERENCES public.hr_job_positions(id_position) ON DELETE CASCADE;

ALTER TABLE "public"."hr_job_positions"
  ADD CONSTRAINT "job_positions_coordination_to_unit_id_fkey" FOREIGN KEY (coordination_to_unit_id) REFERENCES public.hr_job_positions(id_position) ON DELETE SET NULL;

ALTER TABLE "public"."hr_job_positions"
  ADD CONSTRAINT "job_positions_reports_to_unit_id_fkey" FOREIGN KEY (reports_to_unit_id) REFERENCES public.hr_job_positions(id_position) ON DELETE SET NULL;

ALTER TABLE "public"."hr_job_positions"
  ADD CONSTRAINT "job_positions_level_id_fkey" FOREIGN KEY (level_id) REFERENCES public.hr_master_levels(id_level) ON DELETE SET NULL;

ALTER TABLE "public"."hr_employee_career_histories"
  ADD CONSTRAINT "employee_career_histories_new_location_fkey" FOREIGN KEY (new_location_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE SET NULL;

ALTER TABLE "public"."hr_employee_career_histories"
  ADD CONSTRAINT "employee_career_histories_previous_location_fkey" FOREIGN KEY (previous_location_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE SET NULL;

ALTER TABLE "public"."hr_employees"
  ADD CONSTRAINT "employees_location_id_fkey" FOREIGN KEY (location_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE SET NULL;

ALTER TABLE "public"."hr_job_positions"
  ADD CONSTRAINT "job_positions_unit_id_fkey" FOREIGN KEY (unit_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE SET NULL;

ALTER TABLE "public"."hr_organization_units"
  ADD CONSTRAINT "organization_units_parent_unit_id_fkey" FOREIGN KEY (parent_unit_id) REFERENCES public.hr_organization_units(id_unit) ON DELETE SET NULL;

ALTER TABLE "public"."hr_transaction_agreements"
  ADD CONSTRAINT "hr_transaction_agreements_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.hr_employee_transactions(id) ON DELETE CASCADE;

ALTER TABLE "public"."hr_transaction_staging_approvals"
  ADD CONSTRAINT "hr_transaction_staging_approvals_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.hr_employee_transactions(id) ON DELETE CASCADE;

ALTER TABLE "public"."hr_organization_units"
  ADD CONSTRAINT "organization_units_work_location_fkey" FOREIGN KEY (work_location_id) REFERENCES public.hr_work_locations(id_work_location) ON DELETE SET NULL;

ALTER TABLE "public"."sso_tokens"
  ADD CONSTRAINT "sso_tokens_client_id_fkey" FOREIGN KEY (client_id) REFERENCES public.sso_clients(client_id) ON DELETE CASCADE;

ALTER TABLE "public"."sso_tokens"
  ADD CONSTRAINT "sso_tokens_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.hr_employees(id) ON DELETE CASCADE;

ALTER TABLE "public"."tr_visit_unit_check"
  ADD CONSTRAINT "tr_visit_unit_check_visit_id_fkey" FOREIGN KEY (visit_id) REFERENCES public.tr_laporan_visit(visit_id) ON DELETE CASCADE;

CREATE VIEW "public"."employee_career_histories" WITH (security_invoker=on) AS  SELECT id,
    employee_id,
    transaction_date,
    effective_date,
    transaction_type,
    no_sk,
    file_sk_url,
    description,
    previous_position_id,
    new_position_id,
    previous_location_id,
    new_location_id,
    previous_level_id,
    new_level_id,
    previous_supervisor_id,
    new_supervisor_id,
    previous_status_kerja,
    new_status_kerja,
    previous_basic_salary,
    new_basic_salary,
    previous_allowances,
    new_allowances,
    bank_name,
    bank_account_no,
    bank_account_holder,
    npwp_number,
    tax_status,
    bpjs_kesehatan_number,
    bpjs_ketenagakerjaan_number,
    approved_by_nip,
    created_at
   FROM public.hr_employee_career_histories;

CREATE VIEW "public"."employee_personal_details" WITH (security_invoker=on) AS  SELECT id,
    employee_id,
    ktp_number,
    pob,
    dob,
    gender,
    religion,
    marital_status,
    number_of_dependents,
    address_ktp,
    address_domicile,
    phone,
    emergency_contact_name,
    emergency_contact_phone,
    emergency_contact_relation,
    foto_profile_url,
    created_at,
    updated_at,
    personal_details,
    spouse_name,
    education,
    major,
    name,
    email
   FROM public.hr_employee_personal_details;

CREATE VIEW "public"."employees" WITH (security_invoker=on) AS  SELECT id,
    nip,
    name,
    email,
    location_id,
    position_id,
    supervisor_id,
    must_change_password,
    current_session_id,
    status_kerja,
    tanggal_masuk,
    tanggal_selesai_kontrak,
    deleted_at,
    created_at,
    updated_at
   FROM public.hr_employees;

CREATE VIEW "public"."job_position_permissions" WITH (security_invoker=on) AS  SELECT id,
    position_id,
    permission_code,
    created_at
   FROM public.hr_job_position_permissions;

CREATE VIEW "public"."job_positions" WITH (security_invoker=on) AS  SELECT id_position,
    nama_jabatan,
    level_id,
    reports_to_unit_id,
    coordination_to_unit_id,
    unit_id,
    is_active,
    created_at,
    updated_at
   FROM public.hr_job_positions;

CREATE VIEW "public"."m_gps_device" WITH (security_invoker=on) AS  SELECT imei,
    status_device,
    posisi_stock,
    last_updated
   FROM public.gps_devices;

CREATE VIEW "public"."master_levels" WITH (security_invoker=on) AS  SELECT id_level,
    nama_level,
    bobot_level,
    is_active,
    created_at,
    updated_at
   FROM public.hr_master_levels;

CREATE VIEW "public"."organization_units" WITH (security_invoker=on) AS  SELECT id_unit,
    tipe_unit,
    nama_unit,
    parent_unit_id,
    work_location_id,
    is_active,
    created_at,
    updated_at
   FROM public.hr_organization_units;

CREATE VIEW "public"."tr_absensi_log" WITH (security_invoker=on) AS  SELECT absen_id,
    created_at,
    nip,
    nama_karyawan,
    role,
    cabang,
    jenis_absen,
    lokasi_kantor,
    distance_meters,
    lat,
    long,
    catatan,
    selfie_photo_url,
    "timestamp",
    nearest_office,
    distance_meter,
    status_geofence,
    menit_terlambat,
    status_kehadiran
   FROM public.hr_absensi_log;

CREATE VIEW "public"."tr_gps_fac_check" WITH (security_invoker=on) AS  SELECT fac_report_id,
    created_at,
    nip,
    nama_petugas,
    cabang,
    total_unit_checked,
    summary_findings,
    raw_details,
    catatan_fac
   FROM public.gps_fac_check;

CREATE VIEW "public"."tr_gps_maintenance" WITH (security_invoker=on) AS  SELECT maint_id,
    created_at,
    nip,
    dealer_name,
    no_fasilitas,
    nopol,
    act_type,
    imei_lama,
    imei_baru,
    foto_imei_lama_url,
    foto_imei_baru_url,
    foto_posisi_gps_url,
    catatan_teknis,
    lat,
    long
   FROM public.gps_maintenance;

CREATE VIEW "public"."tr_izin_log" WITH (security_invoker=on) AS  SELECT izin_id,
    "timestamp",
    nip,
    nama,
    cabang,
    jenis_izin,
    tgl_mulai,
    tgl_selesai,
    catatan,
    lat,
    long,
    selfie_url,
    pic_approval_nip,
    pic_approval_nama,
    status_approval,
    approved_at,
    approved_by,
    catatan_approval,
    created_at
   FROM public.hr_izin_log;

CREATE VIEW "public"."vehicles_tracking_history" WITH (security_invoker=on) AS  SELECT id,
    vehicle_id,
    plate_number,
    latitude,
    longitude,
    speed,
    direction,
    engine_on,
    motion_status,
    battery,
    trip_distance,
    gps_timestamp,
    created_at
   FROM public.gps_vehicles_tracking_history;

CREATE VIEW "public"."vehicles_tracking" WITH (security_invoker=on) AS  SELECT vehicle_id,
    plate_number,
    vehicle_name,
    imei,
    vehicle_group_name,
    company_name,
    latitude,
    longitude,
    speed,
    direction,
    engine_on,
    motion_status,
    battery,
    signal_strength,
    trip_distance,
    total_distance,
    address,
    gps_updated_at,
    synced_at,
    raw_data
   FROM public.gps_vehicles_tracking;

CREATE VIEW "public"."work_locations" WITH (security_invoker=on) AS  SELECT id_work_location,
    nama_lokasi,
    alamat_lengkap,
    kota,
    provinsi,
    latitude,
    longitude,
    radius_meter,
    is_active,
    created_at,
    updated_at
   FROM public.hr_work_locations;

CREATE INDEX idx_absensi_jenis ON public.hr_absensi_log USING btree (jenis_absen);

CREATE INDEX idx_absensi_nip_timestamp ON public.hr_absensi_log USING btree (nip, "timestamp" DESC);

CREATE INDEX idx_career_histories_employee ON public.hr_employee_career_histories USING btree (employee_id, effective_date DESC);

CREATE INDEX idx_emp_tx_employee_id ON public.hr_employee_transactions USING btree (employee_id);

CREATE INDEX idx_emp_tx_nip ON public.hr_employee_transactions USING btree (nip);

CREATE INDEX idx_emp_tx_status ON public.hr_employee_transactions USING btree (status);

CREATE INDEX idx_employees_email ON public.hr_employees USING btree (email);

CREATE INDEX idx_employees_location ON public.hr_employees USING btree (location_id);

CREATE INDEX idx_employees_nip ON public.hr_employees USING btree (nip);

CREATE INDEX idx_employees_supervisor ON public.hr_employees USING btree (supervisor_id);

CREATE INDEX idx_izin_nip ON public.hr_izin_log USING btree (nip, "timestamp" DESC);

CREATE INDEX idx_izin_pic_approval ON public.hr_izin_log USING btree (pic_approval_nip, status_approval);

CREATE INDEX idx_izin_status ON public.hr_izin_log USING btree (status_approval);

CREATE INDEX idx_ketentuan_active ON public.m_ketentuan USING btree (is_active);

CREATE INDEX idx_ketentuan_kategori ON public.m_ketentuan USING btree (kategori);

CREATE INDEX idx_ketentuan_tgl_berlaku ON public.m_ketentuan USING btree (tgl_berlaku DESC);

CREATE INDEX idx_priority_action_active ON public.t_priority_action USING btree (is_fu, priority_score DESC, created_at);

CREATE INDEX idx_priority_action_entity ON public.t_priority_action USING btree (entity_type, entity_id, is_fu);

CREATE INDEX idx_priority_action_name ON public.t_priority_action USING btree (entity_type, entity_name, is_fu);

CREATE INDEX idx_tx_agreements_tx_id ON public.hr_transaction_agreements USING btree (transaction_id);

CREATE INDEX idx_tx_staging_approver ON public.hr_transaction_staging_approvals USING btree (approver_nip);

CREATE INDEX idx_tx_staging_tx_id ON public.hr_transaction_staging_approvals USING btree (transaction_id);

CREATE INDEX idx_vhist_plate_time ON public.gps_vehicles_tracking_history USING btree (plate_number, gps_timestamp DESC);

CREATE INDEX idx_vhist_veh_time ON public.gps_vehicles_tracking_history USING btree (vehicle_id, gps_timestamp DESC);

CREATE INDEX idx_vtrack_group ON public.gps_vehicles_tracking USING btree (vehicle_group_name);

CREATE INDEX idx_vtrack_motion ON public.gps_vehicles_tracking USING btree (motion_status);

CREATE INDEX idx_vtrack_plate ON public.gps_vehicles_tracking USING btree (plate_number);

CREATE INDEX idx_vtrack_updated ON public.gps_vehicles_tracking USING btree (gps_updated_at DESC);

CREATE TRIGGER trg_recalculate_subordinates_supervisor
  AFTER UPDATE OF position_id, deleted_at, status_kerja ON public.hr_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_recalculate_subordinates_supervisor();

CREATE TRIGGER trg_set_supervisor_on_upsert
  BEFORE INSERT OR UPDATE OF position_id ON public.hr_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_supervisor_on_upsert();

CREATE POLICY "Public Read vehicles_tracking" ON "public"."gps_vehicles_tracking"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Public Upsert vehicles_tracking" ON "public"."gps_vehicles_tracking"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public Insert vehicles_tracking_history" ON "public"."gps_vehicles_tracking_history"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public Read vehicles_tracking_history" ON "public"."gps_vehicles_tracking_history"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow anon all on tr_absensi_log" ON "public"."hr_absensi_log"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on hr_employee_personal_details" ON "public"."hr_employee_personal_details"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public all on hr_employee_transactions" ON "public"."hr_employee_transactions"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all on hr_employees" ON "public"."hr_employees"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon all on tr_izin_log" ON "public"."hr_izin_log"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public all on hr_transaction_agreements" ON "public"."hr_transaction_agreements"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public all on hr_transaction_staging_approvals" ON "public"."hr_transaction_staging_approvals"
  FOR ALL
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon all on m_employee" ON "public"."m_employee"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon all on m_ketentuan" ON "public"."m_ketentuan"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon all on m_role_permission" ON "public"."m_role_permission"
  FOR ALL
  TO "anon"
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow insert t_priority_action" ON "public"."t_priority_action"
  FOR INSERT
  TO PUBLIC
  WITH CHECK (true);

CREATE POLICY "Allow select t_priority_action" ON "public"."t_priority_action"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "Allow update t_priority_action" ON "public"."t_priority_action"
  FOR UPDATE
  TO PUBLIC
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public Read digiasha-media" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'digiasha-media'::text));

CREATE POLICY "Public Update digiasha-media" ON "storage"."objects"
  FOR UPDATE
  TO PUBLIC
  USING ((bucket_id = 'digiasha-media'::text));

CREATE POLICY "Public Upload digiasha-media" ON "storage"."objects"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((bucket_id = 'digiasha-media'::text));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."gps_vehicles_tracking";

COMMENT ON EXTENSION "pg_cron" IS 'Job scheduler for PostgreSQL';

COMMENT ON FUNCTION "public"."get_active_supervisor_id"(text) IS 'Mencari supervisor_id aktif dengan bottom-up traversal di hr_job_positions (reports_to_unit_id) dan hr_employees (deleted_at IS NULL, status_kerja != CALON).';

COMMENT ON FUNCTION "public"."trg_recalculate_subordinates_supervisor"() IS 'Trigger function AFTER UPDATE pada hr_employees untuk menghitung ulang supervisor_id bawahan jika atasan mutasi, non-aktif, atau resign.';

COMMENT ON FUNCTION "public"."trg_set_supervisor_on_upsert"() IS 'Trigger function BEFORE INSERT OR UPDATE untuk mengisi supervisor_id otomatis sesuai get_active_supervisor_id().';

COMMENT ON TABLE "public"."hr_absensi_log" IS 'Tabel Rekapitulasi Presensi Kehadiran dan Kepulangan Lapangan';

COMMENT ON TABLE "public"."hr_izin_log" IS 'Tabel Pengajuan Izin Karyawan dan Pusat Approval PIC';

COMMENT ON TABLE "public"."m_ketentuan" IS 'Tabel Master Portal Ketentuan & SOP Perusahaan Terproteksi';

GRANT EXECUTE ON FUNCTION "public"."get_active_supervisor_id"(text) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."mark_priority_fu"(text, text, text, text, date) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."recalculate_all_priorities"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."trg_auto_recalculate_concern"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."trg_recalculate_subordinates_supervisor"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."trg_set_supervisor_on_upsert"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."verify_sso_token"(character varying, character varying, character varying) TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gps_devices" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gps_fac_check" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gps_maintenance" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."gps_vehicles_tracking" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."gps_vehicles_tracking_history"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_absensi_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."hr_employee_career_histories"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."hr_employee_personal_details"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_employee_transactions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_employees" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_izin_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_job_position_permissions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_job_positions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_master_levels" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_organization_units" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_payroll_parameters" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_transaction_agreements" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
  ON TABLE "public"."hr_transaction_staging_approvals"
  TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."hr_work_locations" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_dealer" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_employee" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_facility_unit" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_ketentuan" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_organization_unit" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_role_permission" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_work_location" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sso_clients" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sso_tokens" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sys_audit_trail" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."t_priority_action" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_laporan_visit" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_onboarding_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_visit_unit_check" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employee_career_histories" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employee_personal_details" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."employees" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_position_permissions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."job_positions" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."m_gps_device" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."master_levels" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."organization_units" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_absensi_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_gps_fac_check" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_gps_maintenance" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."tr_izin_log" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehicles_tracking" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vehicles_tracking_history" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."work_locations" TO "anon", "authenticated", "postgres", "service_role";

SELECT cron.schedule_in_database('daily-priority-recalc-0300-wib', '0 20 * * *', 'SELECT recalculate_all_priorities()', 'postgres', NULL, true);

SELECT cron.schedule_in_database('daily-priority-recalc', '0 20 * * *', 'SELECT recalculate_all_priorities()', 'postgres', NULL, true);

