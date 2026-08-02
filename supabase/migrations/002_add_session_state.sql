-- =========================================================
-- MIGRASI 002 - TAMBAH KOLOM STATE ALUR UJIAN
-- ---------------------------------------------------------
-- Menambahkan kolom state ke tabel `users` agar sesi siswa
-- tahan terhadap cold start serverless (Vercel).
--
-- File ini AMAN dijalankan berulang kali (idempotent).
-- =========================================================

-- 1) Tambahkan kolom state jika belum ada
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS attendance_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS berita_acara_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_valid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_key TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_label TEXT;

-- 2) Perbaiki policy RLS (hapus dulu jika sudah ada, lalu buat ulang)
DROP POLICY IF EXISTS "Server full access users" ON public.users;
CREATE POLICY "Server full access users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Server full access tokens" ON public.exam_tokens;
CREATE POLICY "Server full access tokens" ON public.exam_tokens
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Server full access attendance" ON public.attendance;
CREATE POLICY "Server full access attendance" ON public.attendance
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Server full access berita" ON public.berita_acara;
CREATE POLICY "Server full access berita" ON public.berita_acara
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Server full access tracking" ON public.tracking_activity;
CREATE POLICY "Server full access tracking" ON public.tracking_activity
    FOR ALL USING (true) WITH CHECK (true);