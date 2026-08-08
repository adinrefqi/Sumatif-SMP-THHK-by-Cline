-- =========================================================
-- SKEMA DATABASE SUPABASE - PORTAL SUMATIF SMP THHK
-- Jalankan di Supabase Dashboard -> SQL Editor
-- =========================================================

-- ============ TABEL: users (sesi & autentikasi) ============
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('pengawas', 'siswa')),
    class_name TEXT,
    exam TEXT,
    room TEXT,
    exam_number TEXT,
    token TEXT UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    -- State alur ujian (persisten agar tahan terhadap cold start serverless)
    attendance_done BOOLEAN DEFAULT FALSE,
    berita_acara_done BOOLEAN DEFAULT FALSE,
    token_valid BOOLEAN DEFAULT FALSE,
    exam_key TEXT,
    token_label TEXT,
    exam_completed BOOLEAN DEFAULT FALSE,
    exam_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Jika tabel users sudah ada (dari skema versi lama), tambahkan kolom state baru
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS attendance_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS berita_acara_done BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_valid BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_key TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_label TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_completed_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS room TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS exam_number TEXT;

-- ============ TABEL: exam_tokens (token ujian) ============
CREATE TABLE IF NOT EXISTS public.exam_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    exam_key TEXT NOT NULL,
    label TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ TABEL: attendance (presensi siswa) ============
CREATE TABLE IF NOT EXISTS public.attendance (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    class_name TEXT,
    exam_key TEXT,
    exam_title TEXT,
    room TEXT NOT NULL,
    confirmed_at TIMESTAMPTZ DEFAULT now()
);

-- ============ TABEL: berita_acara (pengawas) ============
CREATE TABLE IF NOT EXISTS public.berita_acara (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    supervisor_name TEXT NOT NULL,
    room TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    exam_time TEXT NOT NULL,
    supervisor_count INTEGER NOT NULL,
    student_count INTEGER NOT NULL,
    incidents TEXT,
    notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- ============ TABEL: tracking_activity (log aktivitas) ============
CREATE TABLE IF NOT EXISTS public.tracking_activity (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_name TEXT,
    user_role TEXT,
    event TEXT NOT NULL,
    detail TEXT,
    page INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============ INDEKS UNTUK PERFORMA ============
CREATE INDEX IF NOT EXISTS idx_users_token ON public.users (token);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS idx_berita_acara_session ON public.berita_acara (session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_session ON public.tracking_activity (session_id);
CREATE INDEX IF NOT EXISTS idx_tracking_created ON public.tracking_activity (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracking_session_created ON public.tracking_activity (session_id, created_at DESC);

-- ============ ROW LEVEL SECURITY (amat disarankan) ============
-- Catatan: Karena aplikasi memakai anon key dari klien server,
-- aktifkan RLS & buat policy sesuai kebutuhan. Contoh dasar:

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.berita_acara ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_activity ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan akses penuh untuk service_role (server)
-- (anon key dipakai server-side, bukan browser, jadi aman)

CREATE POLICY "Server full access users" ON public.users
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Server full access tokens" ON public.exam_tokens
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Server full access attendance" ON public.attendance
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Server full access berita" ON public.berita_acara
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Server full access tracking" ON public.tracking_activity
    FOR ALL USING (true) WITH CHECK (true);

-- ============ SEED DATA AWAL (opsional) ============
-- Token default agar mudah dicoba:
-- INSERT INTO public.exam_tokens (token, exam_key, label, created_by)
-- VALUES
--     ('TOKEN9A', 'indonesia', 'Token Sesi Ruang 9A', 'system'),
--     ('TOKEN9B', 'matematika', 'Token Sesi Ruang 9B', 'system'),
--     ('TOKEN9C', 'ipa', 'Token Sesi Ruang 9C', 'system');
