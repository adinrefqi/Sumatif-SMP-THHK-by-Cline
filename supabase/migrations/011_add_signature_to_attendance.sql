-- =========================================================
-- 011 — Kolom tanda tangan siswa pada presensi
-- Menyimpan TTD digital (data URL PNG) saat siswa mengisi presensi,
-- agar bisa ditampilkan pada lembar cetak daftar hadir.
-- Jalankan di Supabase Dashboard -> SQL Editor.
-- =========================================================
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS signature TEXT;