-- =========================================================
-- MIGRASI 005 - UPDATE TABEL MAPEL SMP THHK (19 mapel)
-- ---------------------------------------------------------
-- Mengganti daftar mapel di tabel `exams` dengan daftar
-- asli SMP Tunas Hidup Harapan Kita.
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

-- Hapus data lama yang tidak dipakai
DELETE FROM public.exams
WHERE exam_key NOT IN (
    'agama_katolik', 'agama_kristen', 'agama_islam', 'agama_buddha', 'agama_konghucu',
    'pancasila', 'indonesia', 'ipa', 'tik', 'matematika',
    'ips', 'inggris', 'seni', 'bahasa_jawa', 'penjas',
    'mandarin', 'bk', 'native_mandarin', 'coding'
);

-- Upsert 19 mapel SMP THHK
INSERT INTO public.exams (exam_key, title, drive_file_id) VALUES
    ('agama_katolik',  'Agama Katolik', ''),
    ('agama_kristen',  'Agama Kristen', ''),
    ('agama_islam',    'Agama Islam', ''),
    ('agama_buddha',   'Agama Buddha', ''),
    ('agama_konghucu', 'Agama Konghucu', ''),
    ('pancasila',      'Pendidikan Pancasila', ''),
    ('indonesia',      'Bahasa Indonesia', ''),
    ('ipa',            'IPA', ''),
    ('tik',            'TIK', ''),
    ('matematika',     'Matematika', ''),
    ('ips',            'IPS', ''),
    ('inggris',        'Bahasa Inggris', ''),
    ('seni',           'Seni Budaya', ''),
    ('bahasa_jawa',    'Bahasa Jawa', ''),
    ('penjas',         'PenJas', ''),
    ('mandarin',       'Bahasa Mandarin', ''),
    ('bk',             'BK', ''),
    ('native_mandarin','Native Mandarin', ''),
    ('coding',         'Coding', '')
ON CONFLICT (exam_key) DO UPDATE SET
    title = EXCLUDED.title;