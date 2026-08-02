-- =========================================================
-- MIGRASI 006 - DUKUNGAN PDF PER MAPEL PER KELAS
-- ---------------------------------------------------------
-- Tabel `exams` diubah agar mendukung File ID Google Drive
-- yang BERBEDA untuk setiap kelas (7, 8, 9) pada 1 mapel.
--
-- Struktur baru: unique (exam_key, class_name)
--   - class_name = '7'  → PDF untuk Kelas 7
--   - class_name = '8'  → PDF untuk Kelas 8
--   - class_name = '9'  → PDF untuk Kelas 9
--   - class_name = ''   → PDF default (dipakai bila level tidak ada)
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

-- 1) Tambahkan kolom class_name jika belum ada
ALTER TABLE public.exams ADD COLUMN IF NOT EXISTS class_name TEXT DEFAULT '';

-- 2) Hapus constraint unique lama (exam_key saja)
ALTER TABLE public.exams DROP CONSTRAINT IF EXISTS exams_exam_key_key;

-- 3) Buat constraint unique baru (exam_key + class_name)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'exams_exam_key_class_name_key'
    ) THEN
        ALTER TABLE public.exams
            ADD CONSTRAINT exams_exam_key_class_name_key UNIQUE (exam_key, class_name);
    END IF;
END $$;

-- 4) Hapus data lama (akan di-seed ulang)
DELETE FROM public.exams;

-- 5) Seed: 19 mapel dengan class_name = '' (default semua kelas)
INSERT INTO public.exams (exam_key, title, class_name, drive_file_id) VALUES
    ('agama_katolik',   'Agama Katolik', '', ''),
    ('agama_kristen',   'Agama Kristen', '', ''),
    ('agama_islam',     'Agama Islam', '', ''),
    ('agama_buddha',    'Agama Buddha', '', ''),
    ('agama_konghucu',  'Agama Konghucu', '', ''),
    ('pancasila',       'Pendidikan Pancasila', '', ''),
    ('indonesia',       'Bahasa Indonesia', '', ''),
    ('ipa',             'IPA', '', ''),
    ('tik',             'TIK', '', ''),
    ('matematika',      'Matematika', '', ''),
    ('ips',             'IPS', '', ''),
    ('inggris',         'Bahasa Inggris', '', ''),
    ('seni',            'Seni Budaya', '', ''),
    ('bahasa_jawa',     'Bahasa Jawa', '', ''),
    ('penjas',          'PenJas', '', ''),
    ('mandarin',        'Bahasa Mandarin', '', ''),
    ('bk',              'BK', '', ''),
    ('native_mandarin', 'Native Mandarin', '', ''),
    ('coding',          'Coding', '', '')
ON CONFLICT (exam_key, class_name) DO UPDATE SET title = EXCLUDED.title;

-- 6) Seed: 19 mapel x 3 level kelas (7, 8, 9)
INSERT INTO public.exams (exam_key, title, class_name, drive_file_id)
SELECT e.exam_key, e.title, l.class_name, ''
FROM (
    VALUES
        ('agama_katolik', 'Agama Katolik'),
        ('agama_kristen', 'Agama Kristen'),
        ('agama_islam', 'Agama Islam'),
        ('agama_buddha', 'Agama Buddha'),
        ('agama_konghucu', 'Agama Konghucu'),
        ('pancasila', 'Pendidikan Pancasila'),
        ('indonesia', 'Bahasa Indonesia'),
        ('ipa', 'IPA'),
        ('tik', 'TIK'),
        ('matematika', 'Matematika'),
        ('ips', 'IPS'),
        ('inggris', 'Bahasa Inggris'),
        ('seni', 'Seni Budaya'),
        ('bahasa_jawa', 'Bahasa Jawa'),
        ('penjas', 'PenJas'),
        ('mandarin', 'Bahasa Mandarin'),
        ('bk', 'BK'),
        ('native_mandarin', 'Native Mandarin'),
        ('coding', 'Coding')
) AS e(exam_key, title)
CROSS JOIN (VALUES ('7'), ('8'), ('9')) AS l(class_name)
ON CONFLICT (exam_key, class_name) DO UPDATE SET title = EXCLUDED.title;