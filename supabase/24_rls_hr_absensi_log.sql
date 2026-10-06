-- 1. Aktifkan RLS di tabel fisik
ALTER TABLE public.hr_absensi_log ENABLE ROW LEVEL SECURITY;

-- 2. Izinkan karyawan melihat riwayat absensi mereka
CREATE POLICY "Allow authenticated read absensi" ON public.hr_absensi_log
    FOR SELECT TO authenticated USING (true);

-- 3. Izinkan karyawan membuat absensi baru (Absen Datang/Pulang)
CREATE POLICY "Allow authenticated insert absensi" ON public.hr_absensi_log
    FOR INSERT TO authenticated WITH CHECK (true);

-- 4. Izinkan karyawan meng-update absensi mereka (misalnya update jam pulang)
CREATE POLICY "Allow authenticated update absensi" ON public.hr_absensi_log
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
