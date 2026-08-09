/* =========================================================
 * LAPISAN DATA - PORTAL SUMATIF SMP TUNAS HIDUP HARAPAN KITA
 * ---------------------------------------------------------
 * Mode DEMO  : penyimpanan in-memory (bertahan selama server hidup).
 * Mode PROD  : jika SUPABASE_URL + SUPABASE_ANON_KEY diisi,
 *              server akan memakai tabel Supabase.
 * ========================================================= */

const config = require("./config");
const crypto = require("crypto");

/* ---------- Fungsi utilitas ---------- */
function nowISO() {
    return new Date().toISOString();
}

/* Awal hari berjalan menurut zona waktu sekolah, dikembalikan sebagai ISO UTC.
 * Server (Vercel) berjalan di UTC, jadi tanpa offset ini "hari ini" akan
 * bergeser 7 jam dan aktivitas dini hari WIB ikut terbuang. */
function startOfTodayISO() {
    const offsetMs = config.timezoneOffsetMinutes * 60 * 1000;
    const lokal = new Date(Date.now() + offsetMs);
    lokal.setUTCHours(0, 0, 0, 0);
    return new Date(lokal.getTime() - offsetMs).toISOString();
}

function generateId(prefix = "id") {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function examTitle(key) {
    const f = config.examFiles[key];
    return f ? f.title : "Soal Sumatif";
}

/* Gabungkan daftar peserta resmi (config) dengan sesi yang sudah login.
 * Peserta yang belum login tetap muncul dengan sessionId null → "Belum hadir". */
function lengkapiPeserta(masuk) {
    const byUser = new Map(masuk.map((s) => [s.username, s]));
    const daftar = config.studentCredentials.map(
        (c) => byUser.get(c.username) || {
            sessionId: null, username: c.username, name: c.name,
            className: c.className, exam: c.exam, room: c.room, examNumber: c.examNumber,
            attendance: false, examCompleted: false, isActive: false,
            lastEvent: null, lastDetail: "", lastAt: null, lastSeenAt: null,
            loginAt: null, presensiAt: null, selesaiAt: null, halaman: null, tokenLabel: null,
            signature: null,
        }
    );
    // Sesi yang usernamenya tidak ada lagi di config (siswa dihapus dari daftar
    // tapi masih duduk di ruang ujian) tetap ditampilkan, jangan dihilangkan.
    const resmi = new Set(config.studentCredentials.map((c) => c.username));
    return [...daftar, ...masuk.filter((s) => !resmi.has(s.username))];
}

/* =========================================================
 * STORE DEMO (in-memory)
 * ========================================================= */
class MemoryStore {
    constructor() {
        this.sessions = new Map(); // token -> { role, username, name, ... }
        this.attendance = [];
        this.beritaAcara = [];
        this.tracking = [];
        this.tokenUses = new Map(); // examToken -> [ sessionId ]
        this.tokens = new Map(); // examToken -> { examKey, label, createdAt, createdBy }
        // Penyelesaian ujian per (siswa, mapel). Tahan login ulang, jadi
        // menyelesaikan Matematika tidak mengunci akun untuk mapel lain.
        // Hanya pengawas/admin yang bisa membukanya lewat resetStudentLock().
        this.completedSubjects = new Map(); // username -> Set<examKey>
        // Seed token bawaan dari config (mode demo / kompatibilitas)
        Object.entries(config.examTokens || {}).forEach(([examToken, entry]) => {
            this.tokens.set(examToken, {
                examKey: entry.examKey,
                label: entry.label || `Token ${examToken}`,
                createdAt: nowISO(),
                createdBy: "system",
            });
        });
    }

    /* ---------------- Sesi ---------------- */
    createSession({ username, name, role, className, exam, room, examNumber }) {
        // Satu akun = satu sesi aktif. Sesi lama dari perangkat/login
        // sebelumnya dibuang agar tidak muncul dobel di Live Monitor.
        this._dropSessionsOf(username);

        const sessionId = generateId("ses");
        const session = {
            id: sessionId,
            token: this._newSessionToken(),
            username,
            name,
            role,
            className: className || null,
            exam: exam || null,
            room: room || null,
            examNumber: examNumber || null,
            // Sesi selalu mulai dengan percobaan belum selesai. Penyelesaian
            // yang bertahan lama disimpan per-mapel di completedSubjects.
            examCompleted: false,
            createdAt: nowISO(),
        };
        this.sessions.set(session.token, session);
        return session;
    }

    /* Buka kunci ujian seorang siswa (hanya dipanggil dari endpoint pengawas).
     * V1: mereset SELURUH mapel siswa (resetProgress). Upgrade per-mapel:
     * bawa argumen examKey bila perlu kelak. */
    resetStudentLock(username) {
        this.resetProgress(username);
        let liveSession = false;
        for (const s of this.sessions.values()) {
            if (s.username === username) {
                s.examCompleted = false;
                s.examCompletedAt = null;
                liveSession = true;
            }
        }
        return liveSession;
    }

    /* Buang sesi lama milik username yang sama (dipakai juga oleh SupabaseStore
     * untuk menyinkronkan cache in-memory setelah baris DB dinonaktifkan). */
    _dropSessionsOf(username) {
        if (!username) return;
        for (const [token, s] of this.sessions) {
            if (s.username === username) this.sessions.delete(token);
        }
    }

    _newSessionToken() {
        return crypto.randomBytes(32).toString("hex");
    }

    getSession(token) {
        if (!token) return null;
        return this.sessions.get(token) || null;
    }

    destroySession(token) {
        this.sessions.delete(token);
    }

    /* Mode demo: state hanya tersimpan di memory, tidak perlu persist.
     * Tetap async agar kontraknya sama dengan SupabaseStore — pemanggil
     * merangkai .catch() pada hasilnya (lihat login admin di index.js). */
    async updateSessionState(token, state) {
        const session = this.sessions.get(token);
        if (!session) return;
        Object.assign(session, state);
        // Catatan: penyelesaian yang tahan lama (markCompleted) tidak lewat
        // updateSessionState — dipanggil langsung oleh endpoint di index.js.
    }

    /* ---------------- Mapel / PDF ---------------- */
    async getExamDriveFileId(examKey, className) {
        // Mode demo: pakai env var config (tidak ada data per kelas)
        const f = config.examFiles[examKey];
        return f ? f.driveFileId || "" : "";
    }

    /* ---------------- Jadwal (mode demo) ----------------
     * Tanpa database, SEMUA mapel dianggap terjadwal hari ini agar
     * token demo TOKENR1/R2/R3 (indonesia/matematika/ipa) tetap jalan. */
    async getJadwalHariIni() {
        return Object.entries(config.examFiles)
            .map(([examKey, f]) => ({
                examKey,
                title: f.title,
                jamMulai: "",
                jamSelesai: "",
            }))
            .sort((a, b) => String(a.title).localeCompare(String(b.title), "id"));
    }

    async isJadwalAktif(examKey) {
        return Boolean(config.examFiles[examKey]);
    }

    /* ---------------- Progres per (siswa, mapel) ---------------- */
    async getCompletedSubjects(username) {
        return [...(this.completedSubjects.get(username) || [])];
    }

    async isCompleted(username, examKey) {
        const set = this.completedSubjects.get(username);
        return Boolean(set && set.has(examKey));
    }

    async markCompleted(username, examKey) {
        if (!this.completedSubjects.has(username)) {
            this.completedSubjects.set(username, new Set());
        }
        this.completedSubjects.get(username).add(examKey);
    }

    async resetProgress(username) {
        this.completedSubjects.delete(username);
    }

    /* ---------------- Presensi (siswa) ---------------- */
    addAttendance({ sessionId, name, className, examKey, examTitle, room, signature }) {
        const record = {
            id: generateId("hadir"),
            sessionId,
            name,
            className,
            examKey,
            examTitle,
            room,
            confirmedAt: nowISO(),
            signature: signature || null,
        };
        this.attendance.push(record);
        return record;
    }

    getAttendanceBySession(sessionId) {
        return this.attendance.find((a) => a.sessionId === sessionId) || null;
    }

    /* ---------------- Berita Acara (pengawas) ---------------- */
    addBeritaAcara({
        sessionId,
        supervisorName,
        room,
        examDate,
        examTime,
        supervisorCount,
        studentCount,
        incidents,
        notes,
    }) {
        const record = {
            id: generateId("ba"),
            sessionId,
            supervisorName,
            room,
            examDate,
            examTime,
            supervisorCount,
            studentCount,
            incidents,
            notes,
            submittedAt: nowISO(),
        };
        this.beritaAcara.push(record);
        return record;
    }

    getBeritaAcaraBySession(sessionId) {
        return this.beritaAcara.find((b) => b.sessionId === sessionId) || null;
    }

    /* ---------------- Token ujian ---------------- */
    createToken({ examKey, label, createdBy }) {
        // Nama mapel tersimpan di config.examFiles.
        const exam = config.examFiles[examKey];
        if (!exam) {
            throw new Error("Mapel tidak dikenal.");
        }

        // Buat kode token unik 6 karakter (huruf + angka, tanpa karakter ambigu)
        let code = this._newTokenCode();
        while (this.tokens.has(code)) {
            code = this._newTokenCode();
        }

        const record = {
            examKey,
            label: label || `Token ${exam.title}`,
            createdAt: nowISO(),
            createdBy: createdBy || "pengawas",
        };
        this.tokens.set(code, record);
        return { token: code, ...record };
    }

    _newTokenCode() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I, O, 0, 1
        let out = "";
        for (let i = 0; i < 6; i++) {
            out += alphabet[crypto.randomInt(alphabet.length)];
        }
        return out;
    }

    getTokens() {
        // Daftar token: tampilkan kode, mapel, label, pembuat, waktu, jumlah pemakaian
        const usedCount = new Map();
        this.tokenUses.forEach((sessions, token) => {
            usedCount.set(token, sessions.length);
        });

        return Object.keys(config.examFiles)
            .map((examKey) => {
                const list = [];
                this.tokens.forEach((rec, code) => {
                    if (rec.examKey === examKey) {
                        list.push({
                            token: code,
                            examKey: rec.examKey,
                            examTitle: examTitle(rec.examKey),
                            label: rec.label,
                            createdAt: rec.createdAt,
                            createdBy: rec.createdBy,
                            uses: usedCount.get(code) || 0,
                        });
                    }
                });
                list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
                return { examKey, examTitle: examTitle(examKey), tokens: list };
            });
    }

    useToken(examToken, sessionId) {
        const entry = this.tokens.get(examToken);
        if (!entry) return { ok: false, reason: "TOKEN_TIDAK_DITEMUKAN" };

        const usedBy = this.tokenUses.get(examToken) || [];
        // Satu token boleh dipakai beberapa sesi berbeda
        // (satu ruang ujian, banyak siswa). Tidak ada cap.
        if (!usedBy.includes(sessionId)) {
            usedBy.push(sessionId);
            this.tokenUses.set(examToken, usedBy);
        }
        return { ok: true, examKey: entry.examKey, label: entry.label };
    }

    deleteToken(examToken) {
        if (!this.tokens.has(examToken)) return false;
        this.tokens.delete(examToken);
        this.tokenUses.delete(examToken);
        return true;
    }

    /* ---------------- Pelacakan aktivitas ---------------- */
    addTracking({ sessionId, name, role, event, detail, page }) {
        const record = {
            id: generateId("trk"),
            sessionId,
            name,
            role,
            event,
            detail: detail || "",
            page: page || null,
            at: nowISO(),
        };
        this.tracking.push(record);
        return record;
    }

    getTracking() {
        // Hanya hari berjalan, terbaru dulu. Riwayat lintas hari membuat
        // dashboard ujian bercampur dengan sesi kemarin.
        const batas = startOfTodayISO();
        return this.tracking
            .filter((t) => !t.at || t.at >= batas)
            .sort((a, b) => (a.at < b.at ? 1 : -1));
    }

    getTrackingBySession(sessionId) {
        // Terbaru dulu: pemanggil selalu memakai elemen [0] sebagai peristiwa terakhir.
        return this.tracking
            .filter((t) => t.sessionId === sessionId)
            .sort((a, b) => (a.at < b.at ? 1 : -1));
    }

    /* ---------------- Statistik Live Monitor ---------------- */
    getLiveSnapshot() {
        const sessions = [...this.sessions.values()];
        const now = Date.now();
        const activeWindowMs = 3 * 60 * 1000;
        const masuk = sessions.filter((s) => s.role === "siswa").map((s) => {
            const trk = this.getTrackingBySession(s.id);
            const last = trk.length ? trk[0] : null;
            const lastAt = last ? last.at : s.createdAt;
            const isActive = Boolean(lastAt && now - new Date(lastAt).getTime() <= activeWindowMs);
            const hadir = this.getAttendanceBySession(s.id);
            return {
                sessionId: s.id,
                username: s.username,
                name: s.name,
                className: s.className,
                exam: s.exam,
                room: s.room || null,
                examNumber: s.examNumber || null,
                attendance: !!hadir,
                examCompleted: Boolean(s.examCompleted),
                isActive,
                lastEvent: last ? last.event : "login",
                lastDetail: last ? last.detail : "-",
                lastAt,
                lastSeenAt: lastAt,
                // Waktu penting ditampilkan di tabel kolom "Waktu".
                loginAt: s.createdAt || null,
                presensiAt: hadir ? hadir.confirmedAt : null,
                signature: hadir ? hadir.signature || null : null,
                selesaiAt: s.examCompletedAt || null,
                // Halaman PDF terakhir yang dikunjungi siswa (dari tracking).
                halaman: (trk.find((t) => t.page) || {}).page || null,
                tokenLabel: s.tokenLabel || null,
            };
        });
        // Peserta resmi yang belum login tetap tampil → "Belum hadir".
        const peserta = lengkapiPeserta(masuk);

        const aktifCount = peserta.filter((s) => s.isActive && !s.examCompleted).length;

        const kejadianHariIni = this.getTracking();

        return {
            generatedAt: nowISO(),
            stats: {
                // Sumbernya sama dengan tabel Siswa Aktif agar kartu dan tabel
                // tidak pernah bertentangan.
                totalSiswaLogin: peserta.filter((s) => s.attendance).length,
                totalSiswaAktif: aktifCount,
                totalBeritaAcara: this.beritaAcara.length,
                totalTokensDipakai: this.tokenUses.size,
                totalTokenValid: this.tokens.size,
                totalPeristiwa: kejadianHariIni.length,
            },
            siswa: peserta,
            beritaAcara: [...this.beritaAcara].reverse(),
            kejadian: kejadianHariIni,
        };
    }
}

/* =========================================================
 * STORE PRODUKSI (Supabase)
 * ---------------------------------------------------------
 * Adapter Supabase lengkap. Dipakai saat env SUPABASE_URL
 * dan SUPABASE_ANON_KEY tersedia.
 *
 * Catatan penting untuk serverless (Vercel):
 * - Sesi tetap disimpan in-memory per-instance serverless.
 *   Di Vercel, instance bisa berbeda per request, jadi sesi
 *   ini BERSIFAT SEMENTARA. Untuk produksi penuh dengan
 *   banyak instance, pertimbangkan memakai token sesi
 *   self-contained (JWT) atau tabel `users` untuk validasi.
 * - Data persist (attendance, berita acara, tracking, token)
 *   ditulis langsung ke tabel Supabase.
 * ========================================================= */
class SupabaseStore {
    constructor() {
        const { createClient } = require("@supabase/supabase-js");
        this.client = createClient(config.supabase.url, config.supabase.anonKey);
        this.tables = config.supabase.tables;
        this.memory = new MemoryStore(); // cache sesi & snapshot live in-memory
        this._tokenUsesCache = new Map(); // token -> jumlah pemakaian (dari DB)
    }

    /* ---------------- Sesi ---------------- */
    async createSession({ username, name, role, className, exam, room, examNumber }) {
        // Sesi baru SELALU mulai dengan percobaan belum selesai. Penyelesaian
        // yang bertahan lama disimpan per-mapel di tabel `student_progress`;
        // login ulang tidak boleh mengunci seluruh akun (lihat /api/session
        // untuk status per-mapel yang benar).

        // Satu akun = satu sesi aktif. Baris sesi lama dinonaktifkan dulu,
        // kalau tidak Live Monitor menampilkan siswa yang sama berkali-kali
        // (baris hanya jadi non-aktif saat siswa menekan Keluar).
        // Kegagalan di sini tidak boleh menghalangi login saat ujian.
        try {
            await this.client
                .from(this.tables.users)
                .update({ active: false })
                .eq("username", username)
                .eq("active", true);
        } catch (e) {
            // abaikan - lanjutkan membuat sesi baru
        }
        this.memory._dropSessionsOf(username);

        const token = crypto.randomBytes(32).toString("hex");

        const payload = {
            username,
            name,
            role,
            class_name: className || null,
            exam: exam || null,
            room: room || null,
            exam_number: examNumber || null,
            token,
            active: true,
            exam_completed: false,
        };

        const { data, error } = await this.client
            .from(this.tables.users)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        // Bentuk sesi in-memory agar kompatibel dengan seluruh handler.
        // id = UUID dari baris tabel users, konsisten dengan getSession().
        const session = {
            id: data.id,
            token: data.token,
            username: data.username,
            name: data.name,
            role: data.role,
            className: data.class_name,
            exam: data.exam,
            room: data.room || null,
            examNumber: data.exam_number || null,
            examCompleted: data.exam_completed || false,
            createdAt: data.created_at || nowISO(),
        };
        this.memory.sessions.set(session.token, session);
        return session;
    }

    /* Buka kunci ujian seorang siswa (hanya dipanggil dari endpoint pengawas).
     * Semua baris sesi milik username ini dibuka, termasuk sesi lama, dan
     * progres per-mapel di-reset. V1: mereset SELURUH mapel; upgrade per-mapel
     * bisa ditambah argumen examKey bila perlu. */
    async resetStudentLock(username) {
        const { data, error } = await this.client
            .from(this.tables.users)
            .update({ exam_completed: false, exam_completed_at: null })
            .eq("username", username)
            .eq("role", "siswa")
            .select("id");
        if (error) throw error;
        await this.resetProgress(username);
        this.memory.resetStudentLock(username);
        return Boolean(data && data.length);
    }

    _buildSession(data) {
        return {
            id: data.id,
            token: data.token,
            username: data.username,
            name: data.name,
            role: data.role,
            className: data.class_name,
            exam: data.exam,
            room: data.room || null,
            examNumber: data.exam_number || null,
            attendanceDone: data.attendance_done || false,
            beritaAcaraDone: data.berita_acara_done || false,
            tokenValid: data.token_valid || false,
            examKey: data.exam_key || null,
            tokenLabel: data.token_label || null,
            subjectConfirmed: data.subject_confirmed || false,
            examCompleted: data.exam_completed || false,
            examCompletedAt: data.exam_completed_at || null,
            createdAt: data.created_at || nowISO(),
        };
    }

    async getSession(token) {
        if (!token) return null;

        // Validasi state terbaru ke Supabase pada setiap request penting.
        // Cache memory tidak boleh menghidangkan exam_completed yang stale
        // setelah sesi selesai di instance serverless lain.
        const { data, error } = await this.client
            .from(this.tables.users)
            .select("*")
            .eq("token", token)
            .eq("active", true)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;

        // Sinkronkan cache memory dengan data DB terbaru agar state lintas instance konsisten
        const session = this._buildSession(data);
        this.memory.sessions.set(token, session);
        return session;
    }

    /* Persist state alur ujian ke tabel users agar tahan cold start serverless */
    async updateSessionState(token, state) {
        const patch = {};
        if (state.attendanceDone !== undefined) patch.attendance_done = state.attendanceDone;
        if (state.beritaAcaraDone !== undefined) patch.berita_acara_done = state.beritaAcaraDone;
        if (state.tokenValid !== undefined) patch.token_valid = state.tokenValid;
        if (state.examKey !== undefined) patch.exam_key = state.examKey;
        if (state.tokenLabel !== undefined) patch.token_label = state.tokenLabel;
        if (state.exam !== undefined) patch.exam = state.exam;
        if (state.subjectConfirmed !== undefined) patch.subject_confirmed = state.subjectConfirmed;
        if (state.examCompleted !== undefined) patch.exam_completed = state.examCompleted;
        if (state.examCompletedAt !== undefined) patch.exam_completed_at = state.examCompletedAt;

        if (Object.keys(patch).length === 0) return;

        const { error } = await this.client
            .from(this.tables.users)
            .update(patch)
            .eq("token", token);
        if (error) throw error;

        // Sinkronkan juga cache in-memory
        this.memory.updateSessionState(token, state);
    }

    async destroySession(token) {
        this.memory.destroySession(token);
        await this.client
            .from(this.tables.users)
            .update({ active: false })
            .eq("token", token);
    }

    /* ---------------- Mapel / PDF ---------------- */
    /* Mengambil Google Drive File ID untuk mapel tertentu.
     * Mendukung PDF yang BERBEDA per kelas (7, 8, 9):
     *   1) Cari baris dengan class_name = level kelas siswa (misal "7")
     *   2) Jika tidak ada, fallback ke class_name = '' (default)
     *   3) Terakhir, fallback ke env var config.
     * Tabel `exams` diisi lewat Supabase Dashboard (Table Editor)
     * sehingga tidak perlu edit kode/redeploy saat mengganti PDF. */
    async getExamDriveFileId(examKey, className) {
        const f = config.examFiles[examKey];
        const fallback = f ? f.driveFileId || "" : "";

        // Ambil level kelas dari className: "7" -> "7". Tetap toleran terhadap
        // format lama bersuffix ("7A" -> "7") bila ada data sesi lama.
        const level = String(className || "").replace(/\D/g, "").slice(0, 1);

        try {
            // 1) Cari File ID spesifik per kelas (class_name = level)
            if (level) {
                const { data: levelData, error: levelError } = await this.client
                    .from(this.tables.exams)
                    .select("drive_file_id")
                    .eq("exam_key", examKey)
                    .eq("class_name", level)
                    .maybeSingle();
                if (!levelError && levelData && levelData.drive_file_id) {
                    return levelData.drive_file_id;
                }
            }

            // 2) Fallback: File ID default (class_name = '')
            const { data, error } = await this.client
                .from(this.tables.exams)
                .select("drive_file_id")
                .eq("exam_key", examKey)
                .eq("class_name", "")
                .maybeSingle();
            if (!error && data && data.drive_file_id) {
                return data.drive_file_id;
            }
        } catch (e) {
            // fallback ke env var config
        }
        return fallback;
    }

    /* ---------------- Jadwal (produksi) ----------------
     * `tanggal` di tabel jadwal_ujian adalah tanggal LOKAL sekolah (WIB).
     * startOfTodayISO() sudah menerapkan timezoneOffsetMinutes, jadi slice(0,10)
     * menghasilkan tanggal WIB hari ini — bukan tanggal UTC server. */
    async getJadwalHariIni() {
        const today = startOfTodayISO().slice(0, 10);
        const { data, error } = await this.client
            .from(this.tables.jadwal)
            .select("exam_key, jam_mulai, jam_selesai")
            .eq("tanggal", today)
            .eq("aktif", true);
        if (error) throw error;
        return (data || [])
            .map((j) => ({
                examKey: j.exam_key,
                title: examTitle(j.exam_key),
                jamMulai: j.jam_mulai || "",
                jamSelesai: j.jam_selesai || "",
            }))
            .sort((a, b) => String(a.jamMulai).localeCompare(String(b.jamMulai), "id"));
    }

    async isJadwalAktif(examKey) {
        const today = startOfTodayISO().slice(0, 10);
        const { data, error } = await this.client
            .from(this.tables.jadwal)
            .select("exam_key")
            .eq("exam_key", examKey)
            .eq("tanggal", today)
            .eq("aktif", true)
            .maybeSingle();
        if (error) throw error;
        return Boolean(data);
    }

    /* ---------------- Progres per (siswa, mapel) ---------------- */
    async getCompletedSubjects(username) {
        const { data, error } = await this.client
            .from(this.tables.progress)
            .select("exam_key")
            .eq("username", username)
            .eq("completed", true);
        if (error) throw error;
        return (data || []).map((r) => r.exam_key);
    }

    async isCompleted(username, examKey) {
        const { data, error } = await this.client
            .from(this.tables.progress)
            .select("completed")
            .eq("username", username)
            .eq("exam_key", examKey)
            .maybeSingle();
        if (error) throw error;
        return Boolean(data && data.completed);
    }

    async markCompleted(username, examKey) {
        const { error } = await this.client
            .from(this.tables.progress)
            .upsert(
                {
                    username,
                    exam_key: examKey,
                    completed: true,
                    completed_at: nowISO(),
                },
                { onConflict: "username,exam_key" }
            );
        if (error) throw error;
    }

    async resetProgress(username) {
        const { error } = await this.client
            .from(this.tables.progress)
            .delete()
            .eq("username", username);
        if (error) throw error;
    }

    /* ---------------- Presensi (siswa) ---------------- */
    async addAttendance({ sessionId, name, className, examKey, examTitle, room, signature }) {
        const payload = {
            session_id: sessionId,
            student_name: name,
            class_name: className || null,
            exam_key: examKey || null,
            exam_title: examTitle || null,
            room,
            signature: signature || null,
        };

        const { data, error } = await this.client
            .from(this.tables.attendance)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        const record = {
            id: data.id,
            sessionId: data.session_id,
            name: data.student_name,
            className: data.class_name,
            examKey: data.exam_key,
            examTitle: data.exam_title,
            room: data.room,
            confirmedAt: data.confirmed_at,
            signature: data.signature || null,
        };
        this.memory.attendance.push(record);
        return record;
    }

    async getAttendanceBySession(sessionId) {
        // Cek cache dulu
        const cached = this.memory.getAttendanceBySession(sessionId);
        if (cached) return cached;

        // Ambil dari Supabase
        const { data, error } = await this.client
            .from(this.tables.attendance)
            .select("*")
            .eq("session_id", sessionId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;

        const record = {
            id: data.id,
            sessionId: data.session_id,
            name: data.student_name,
            className: data.class_name,
            examKey: data.exam_key,
            examTitle: data.exam_title,
            room: data.room,
            confirmedAt: data.confirmed_at,
            signature: data.signature || null,
        };
        this.memory.attendance.push(record);
        return record;
    }

    /* ---------------- Berita Acara (pengawas) ---------------- */
    async addBeritaAcara({
        sessionId,
        supervisorName,
        room,
        examDate,
        examTime,
        supervisorCount,
        studentCount,
        incidents,
        notes,
    }) {
        const payload = {
            session_id: sessionId,
            supervisor_name: supervisorName,
            room,
            exam_date: examDate,
            exam_time: examTime,
            supervisor_count: supervisorCount,
            student_count: studentCount,
            incidents: incidents || "Tidak ada kejadian khusus",
            notes: notes || "-",
        };

        const { data, error } = await this.client
            .from(this.tables.beritaAcara)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        const record = {
            id: data.id,
            sessionId: data.session_id,
            supervisorName: data.supervisor_name,
            room: data.room,
            examDate: data.exam_date,
            examTime: data.exam_time,
            supervisorCount: data.supervisor_count,
            studentCount: data.student_count,
            incidents: data.incidents,
            notes: data.notes,
            submittedAt: data.submitted_at,
        };
        this.memory.beritaAcara.push(record);
        return record;
    }

    async getBeritaAcaraBySession(sessionId) {
        const cached = this.memory.getBeritaAcaraBySession(sessionId);
        if (cached) return cached;

        const { data, error } = await this.client
            .from(this.tables.beritaAcara)
            .select("*")
            .eq("session_id", sessionId)
            .maybeSingle();
        if (error) throw error;
        if (!data) return null;

        const record = {
            id: data.id,
            sessionId: data.session_id,
            supervisorName: data.supervisor_name,
            room: data.room,
            examDate: data.exam_date,
            examTime: data.exam_time,
            supervisorCount: data.supervisor_count,
            studentCount: data.student_count,
            incidents: data.incidents,
            notes: data.notes,
            submittedAt: data.submitted_at,
        };
        this.memory.beritaAcara.push(record);
        return record;
    }

    /* ---------------- Token ujian ---------------- */
    _newTokenCode() {
        const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa I, O, 0, 1
        let out = "";
        for (let i = 0; i < 6; i++) {
            out += alphabet[crypto.randomInt(alphabet.length)];
        }
        return out;
    }

    async createToken({ examKey, label, createdBy }) {
        const exam = config.examFiles[examKey];
        if (!exam) throw new Error("Mapel tidak dikenal.");

        // Buat kode unik (periksa ke DB)
        let code = this._newTokenCode();
        let exists = true;
        while (exists) {
            const { data } = await this.client
                .from(this.tables.tokens)
                .select("token")
                .eq("token", code)
                .maybeSingle();
            exists = !!data;
            if (exists) code = this._newTokenCode();
        }

        const payload = {
            token: code,
            exam_key: examKey,
            label: label || `Token ${exam.title}`,
            created_by: createdBy || "pengawas",
        };

        const { data, error } = await this.client
            .from(this.tables.tokens)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        return {
            token: data.token,
            examKey: data.exam_key,
            label: data.label,
            createdAt: data.created_at,
            createdBy: data.created_by,
        };
    }

    async getTokens() {
        // Ambil semua token dari Supabase
        const { data, error } = await this.client
            .from(this.tables.tokens)
            .select("*")
            .order("created_at", { ascending: false });
        if (error) throw error;

        const groups = Object.keys(config.examFiles).map((examKey) => {
            const list = (data || [])
                .filter((t) => t.exam_key === examKey)
                .map((t) => ({
                    token: t.token,
                    examKey: t.exam_key,
                    examTitle: examTitle(t.exam_key),
                    label: t.label,
                    createdAt: t.created_at,
                    createdBy: t.created_by,
                    uses: this._tokenUsesCache.get(t.token) || 0,
                }));
            return { examKey, examTitle: examTitle(examKey), tokens: list };
        });

        return groups;
    }

    async useToken(examToken, sessionId) {
        const { data, error } = await this.client
            .from(this.tables.tokens)
            .select("*")
            .eq("token", examToken)
            .maybeSingle();
        if (error) throw error;
        if (!data) return { ok: false, reason: "TOKEN_TIDAK_DITEMUKAN" };

        // Catat pemakaian di cache (untuk statistik live monitor)
        const prev = this._tokenUsesCache.get(examToken) || 0;
        this._tokenUsesCache.set(examToken, prev + 1);

        // Catat ke tabel tracking sebagai jejak pemakaian token
        try {
            await this.client
                .from(this.tables.tracking)
                .insert({
                    session_id: sessionId,
                    user_role: "siswa",
                    event: "token_dipakai",
                    detail: `Token ${examToken} (${data.label || ""})`,
                });
        } catch (e) {
            // abaikan jika tracking gagal
        }

        return { ok: true, examKey: data.exam_key, label: data.label };
    }

    async deleteToken(examToken) {
        const { data, error } = await this.client
            .from(this.tables.tokens)
            .delete()
            .eq("token", examToken)
            .select("token");
        if (error) throw error;
        this._tokenUsesCache.delete(examToken);
        return data && data.length > 0;
    }

    /* ---------------- Pelacakan aktivitas ---------------- */
    async addTracking({ sessionId, name, role, event, detail, page }) {
        const payload = {
            session_id: sessionId,
            student_name: name || null,
            user_role: role || null,
            event,
            detail: detail || "",
            page: page || null,
        };

        const { data, error } = await this.client
            .from(this.tables.tracking)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        const record = {
            id: data.id,
            sessionId: data.session_id,
            name: data.student_name,
            role: data.user_role,
            event: data.event,
            detail: data.detail,
            page: data.page,
            at: data.created_at,
        };
        this.memory.tracking.push(record);
        return record;
    }

    getTracking() {
        return this.memory.getTracking();
    }

    getTrackingBySession(sessionId) {
        return this.memory.getTrackingBySession(sessionId);
    }

    /* ---------------- Statistik Live Monitor ---------------- */
    async getLiveSnapshot() {
        const now = Date.now();
        const activeWindowMs = 3 * 60 * 1000;

        // Riwayat aktivitas dibatasi hari berjalan (zona waktu sekolah).
        const awalHari = startOfTodayISO();

        // Ambil data real dari Supabase agar akurat lintas instance serverless.
        try {
            const [beritaRes, trackingRes, usersRes, attendanceRes, tokenRes, eventCountRes] = await Promise.all([
                this.client
                    .from(this.tables.beritaAcara)
                    .select("*")
                    .order("submitted_at", { ascending: false })
                    .limit(50),
                this.client
                    .from(this.tables.tracking)
                    .select("session_id, student_name, user_role, event, detail, page, created_at")
                    .gte("created_at", awalHari)
                    .order("created_at", { ascending: false })
                    // ponytail: plafon 200 baris tracking; naikkan limit kalau halaman terakhir mulai kosong.
                    .limit(200),
                this.client
                    .from(this.tables.users)
                    .select("*")
                    .eq("role", "siswa")
                    .eq("active", true),
                this.client
                    .from(this.tables.attendance)
                    .select("session_id, confirmed_at, signature"),
                this.client
                    .from(this.tables.tokens)
                    .select("token"),
                // Jumlah peristiwa hari ini yang sebenarnya. Tanpa ini kartu
                // statistik hanya menghitung baris yang terambil, sehingga
                // mentok di 200 (batas limit query di atas) dan berhenti bergerak.
                this.client
                    .from(this.tables.tracking)
                    .select("*", { count: "exact", head: true })
                    .gte("created_at", awalHari),
            ]);

            if (!beritaRes.error && beritaRes.data) {
                this.memory.beritaAcara = beritaRes.data.map((b) => ({
                    id: b.id,
                    sessionId: b.session_id,
                    supervisorName: b.supervisor_name,
                    room: b.room,
                    examDate: b.exam_date,
                    examTime: b.exam_time,
                    supervisorCount: b.supervisor_count,
                    studentCount: b.student_count,
                    incidents: b.incidents,
                    notes: b.notes,
                    submittedAt: b.submitted_at,
                }));
            }
            if (!trackingRes.error && trackingRes.data) {
                this.memory.tracking = trackingRes.data.map((t) => ({
                    id: t.id,
                    sessionId: t.session_id,
                    name: t.student_name,
                    role: t.user_role,
                    event: t.event,
                    detail: t.detail,
                    page: t.page,
                    at: t.created_at,
                }));
            }

            // Siswa aktif dihitung dari tabel `users` (bukan memory per-instance).
            // lastEvent/lastAt diambil dari baris tracking paling baru per sesi.
            const hadirMap = new Map((attendanceRes.data || []).map((a) => [a.session_id, a]));
            const tokenCount = (tokenRes.data || []).length;
            const students = (usersRes.data || []).map((u) => {
                const trk = this.getTrackingBySession(u.id);
                const last = trk.length ? trk[0] : null;
                const lastAt = last ? last.at : u.created_at;
                const isActive = Boolean(lastAt && now - new Date(lastAt).getTime() <= activeWindowMs);
                return {
                    sessionId: u.id,
                    username: u.username,
                    name: u.name,
                    className: u.class_name,
                    exam: u.exam,
                    room: u.room || null,
                    examNumber: u.exam_number || null,
                    attendance: hadirMap.has(u.id),
                    examCompleted: Boolean(u.exam_completed),
                    isActive,
                    lastEvent: last ? last.event : "login",
                    lastDetail: last ? last.detail : "-",
                    lastAt,
                    lastSeenAt: lastAt,
                    // Waktu penting ditampilkan di tabel kolom "Waktu".
                    loginAt: u.created_at || null,
                    presensiAt: hadirMap.get(u.id)?.confirmed_at || null,
                    signature: hadirMap.get(u.id)?.signature || null,
                    selesaiAt: u.exam_completed_at || null,
                    // Halaman PDF terakhir yang dikunjungi siswa (dari tracking).
                    halaman: (trk.find((t) => t.page) || {}).page || null,
                    tokenLabel: u.token_label || null,
                };
            });
            // Peserta resmi yang belum login tetap tampil → "Belum hadir".
            const peserta = lengkapiPeserta(students);

            const aktifCount = peserta.filter((s) => s.isActive && !s.examCompleted).length;

            const stats = {
                // Dihitung dari daftar siswa yang sama dengan tabel di dashboard,
                // bukan dari seluruh baris presensi sepanjang masa. Kalau tidak,
                // kartu bisa menampilkan "10 Siswa Presensi" saat tabelnya kosong.
                totalSiswaLogin: peserta.filter((s) => s.attendance).length,
                totalSiswaAktif: aktifCount,
                totalBeritaAcara: this.memory.beritaAcara.length,
                totalTokensDipakai: this._tokenUsesCache.size,
                totalTokenValid: tokenCount,
                totalPeristiwa:
                    typeof eventCountRes.count === "number"
                        ? eventCountRes.count
                        : this.memory.tracking.length,
            };

            return {
                generatedAt: nowISO(),
                stats,
                siswa: peserta,
                beritaAcara: [...this.memory.beritaAcara].reverse(),
                kejadian: this.memory.getTracking(),
            };
        } catch (e) {
            // Abaikan - pakai data cache bila kueri DB gagal
        }

        return this.memory.getLiveSnapshot();
    }
}

/* =========================================================
 * EKSPOR STORE (pilih mode otomatis)
 * ========================================================= */
const useSupabase = Boolean(config.supabase.url && config.supabase.anonKey);

module.exports = {
    useSupabase,
    store: useSupabase ? new SupabaseStore() : new MemoryStore(),
};
