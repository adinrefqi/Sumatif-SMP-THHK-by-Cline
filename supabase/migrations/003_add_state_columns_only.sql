-- =========================================================
-- MIGRASI 003 - TAMBAH KOLOM STATE (MINIMAL, PASTI SUKSES)
-- ---------------------------------------------------------
-- HANYA menambahkan kolom ke tabel `users`.
-- TIDAK menyentuh policy RLS (policy yang ada sudah benar).
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS attendance_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS berita_acara_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_valid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_key TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_label TEXT;