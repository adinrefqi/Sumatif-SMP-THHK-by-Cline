-- =========================================================
-- MIGRASI 013 - IZIN TOKEN PER PENGAWAS-PER MAPEL
-- ---------------------------------------------------------
-- Matriks izin pembuatan token ujian (admin -> pengawas).
-- Admin super user selalu boleh semua mapel (config.isAdmin),
-- tidak perlu baris di tabel ini.
-- Baris tidak ada = TIDAK diizinkan (deny by default).
-- Diisi lewat UI "Izin Token Pengawas" (admin) / Supabase
-- Table Editor -> token_izin, tanpa edit kode.
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.token_izin (
    pengawas_username TEXT NOT NULL,
    exam_key TEXT NOT NULL,
    allowed BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (pengawas_username, exam_key)
);

CREATE INDEX IF NOT EXISTS idx_izin_username ON public.token_izin (pengawas_username);

ALTER TABLE public.token_izin ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Server full access izin" ON public.token_izin;
CREATE POLICY "Server full access izin" ON public.token_izin
    FOR ALL USING (true) WITH CHECK (true);
