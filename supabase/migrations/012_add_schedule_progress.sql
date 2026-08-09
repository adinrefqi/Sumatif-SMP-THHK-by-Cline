-- =========================================================
-- MIGRASI 012 - JADWAL UJIAN + PROGRES PER (SISWA, MAPEL)
-- ---------------------------------------------------------
-- Dua tambahan besar untuk mendukung ujian ala ANBK:
--
-- 1) Tabel `jadwal_ujian`
--    Menentukan mapel apa yang "aktif" pada suatu tanggal.
--    Server membaca jadwal hari ini (tanggal lokal sekolah, WIB)
--    untuk memutuskan mapel mana yang boleh dipilih siswa.
--    Jam mulai/selesai bersifat INFORMASI saja (tidak digate).
--    Diisi lewat Supabase Dashboard -> Table Editor, tanpa edit kode.
--
-- 2) Tabel `student_progress`
--    Menyimpan penyelesaian ujian per (siswa, mapel).
--    Menyelesaikan Matematika tidak mengunci akun untuk mapel lain.
--    Pengganti model lama yang memakai satu boolean `exam_completed`
--    global per username (yang diwariskan saat login ulang).
--
-- 3) Kolom `subject_confirmed` pada tabel `users`
--    Menandai bahwa siswa sudah memilih mapel pada sesi ini
--    (setelah pemilih mapel, sebelum presensi).
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

-- ---------- Tabel jadwal ujian ----------
CREATE TABLE IF NOT EXISTS public.jadwal_ujian (
    id SERIAL PRIMARY KEY,
    exam_key TEXT NOT NULL,
    tanggal DATE NOT NULL,
    jam_mulai TEXT,
    jam_selesai TEXT,
    aktif BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (exam_key, tanggal)
);

CREATE INDEX IF NOT EXISTS idx_jadwal_tanggal ON public.jadwal_ujian (tanggal);

ALTER TABLE public.jadwal_ujian ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Server full access jadwal" ON public.jadwal_ujian;
CREATE POLICY "Server full access jadwal" ON public.jadwal_ujian
    FOR ALL USING (true) WITH CHECK (true);

-- ---------- Tabel progres per (siswa, mapel) ----------
CREATE TABLE IF NOT EXISTS public.student_progress (
    username TEXT NOT NULL,
    exam_key TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    PRIMARY KEY (username, exam_key)
);

CREATE INDEX IF NOT EXISTS idx_progress_username ON public.student_progress (username);

ALTER TABLE public.student_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Server full access progress" ON public.student_progress;
CREATE POLICY "Server full access progress" ON public.student_progress
    FOR ALL USING (true) WITH CHECK (true);

-- ---------- Penanda pilihan mapel pada sesi ----------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subject_confirmed BOOLEAN DEFAULT FALSE;

-- ---------- Backfill: siswa yang sudah exam_completed = true
-- pada sesi terakhirnya disalin ke student_progress, agar hari
-- pertama (setelah migrasi) status "sudah selesai" tidak hilang.
INSERT INTO public.student_progress (username, exam_key, completed, completed_at)
SELECT DISTINCT ON (username)
       username,
       COALESCE(exam_key, exam, ''),
       true,
       exam_completed_at
FROM public.users
WHERE role = 'siswa'
  AND exam_completed = true
  AND COALESCE(exam_key, exam, '') <> ''
ON CONFLICT (username, exam_key) DO NOTHING;
