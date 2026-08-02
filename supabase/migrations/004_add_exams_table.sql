-- =========================================================
-- MIGRASI 004 - TABEL MAPEL (exams)
-- ---------------------------------------------------------
-- Menyimpan Google Drive File ID per mata pelajaran.
-- Kolom drive_file_id diisi dari Supabase Dashboard
-- (Table Editor → exams) TANPA perlu edit kode/redeploy.
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.exams (
    id SERIAL PRIMARY KEY,
    exam_key TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    drive_file_id TEXT DEFAULT '',
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Isi data awal 20 mapel (drive_file_id kosong = pakai PDF demo
-- sampai diisi lewat Table Editor)
INSERT INTO public.exams (exam_key, title, drive_file_id) VALUES
    ('agama', 'Pendidikan Agama & Budi Pekerti', ''),
    ('ppkn', 'PPKn', ''),
    ('indonesia', 'Bahasa Indonesia', ''),
    ('matematika', 'Matematika', ''),
    ('ipa', 'IPA', ''),
    ('ips', 'IPS', ''),
    ('inggris', 'Bahasa Inggris', ''),
    ('seni', 'Seni Budaya', ''),
    ('pjok', 'PJOK', ''),
    ('prakarya', 'Prakarya', ''),
    ('informatika', 'Informatika', ''),
    ('mulok_bahasa_daerah', 'Muatan Lokal Bahasa Daerah', ''),
    ('mulok_bahasa_asing', 'Muatan Lokal Bahasa Asing', ''),
    ('pendalaman_agama', 'Pendalaman Agama', ''),
    ('bimbingan_konseling', 'Bimbingan Konseling', ''),
    ('literasi', 'Literasi Digital', ''),
    ('kewirausahaan', 'Kewirausahaan', ''),
    ('matematika_tambahan', 'Matematika Tambahan', ''),
    ('ipa_tambahan', 'IPA Tambahan', ''),
    ('ips_tambahan', 'IPS Tambahan', '')
ON CONFLICT (exam_key) DO UPDATE SET
    title = EXCLUDED.title;

-- Indeks
CREATE INDEX IF NOT EXISTS idx_exams_key ON public.exams (exam_key);

-- RLS (optional, server memakai anon key server-side)
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Server full access exams" ON public.exams;
CREATE POLICY "Server full access exams" ON public.exams
    FOR ALL USING (true) WITH CHECK (true);