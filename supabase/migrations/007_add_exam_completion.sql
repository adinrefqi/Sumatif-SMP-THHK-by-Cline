-- =========================================================
-- MIGRASI 007 - TAMBAH STATE PENYELESAIAN UJIAN
-- ---------------------------------------------------------
-- Menandai siswa yang sudah menekan "Selesai Ujian" agar sesi
-- tidak dapat membuka PDF lagi setelah refresh / cold start.
-- `active` TETAP true setelah selesai (logout yang menonaktifkan),
-- sehingga monitor masih melihat siswa berstatus "Selesai".
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_completed_at TIMESTAMPTZ;

-- Indeks untuk kueri last-activity per sesi pada live monitor
CREATE INDEX IF NOT EXISTS idx_tracking_session_created
    ON public.tracking_activity (session_id, created_at DESC);
