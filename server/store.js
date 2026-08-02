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

function generateId(prefix = "id") {
    return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function examTitle(key) {
    const f = config.examFiles[key];
    return f ? f.title : "Soal Sumatif";
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
    createSession({ username, name, role, className, exam }) {
        const sessionId = generateId("ses");
        const session = {
            id: sessionId,
            token: this._newSessionToken(),
            username,
            name,
            role,
            className: className || null,
            exam: exam || null,
            createdAt: nowISO(),
        };
        this.sessions.set(session.token, session);
        return session;
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

    /* ---------------- Presensi (siswa) ---------------- */
    addAttendance({ sessionId, name, className, examKey, examTitle, room }) {
        const record = {
            id: generateId("hadir"),
            sessionId,
            name,
            className,
            examKey,
            examTitle,
            room,
            confirmedAt: nowISO(),
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
        // Urutkan terbaru dulu
        return [...this.tracking].sort((a, b) => (a.at < b.at ? 1 : -1));
    }

    getTrackingBySession(sessionId) {
        return this.tracking.filter((t) => t.sessionId === sessionId);
    }

    /* ---------------- Statistik Live Monitor ---------------- */
    getLiveSnapshot() {
        const sessions = [...this.sessions.values()];
        const aktif = sessions.filter((s) => s.role === "siswa").map((s) => {
            const trk = this.getTrackingBySession(s.id);
            const last = trk.length ? trk[0] : null;
            return {
                sessionId: s.id,
                name: s.name,
                className: s.className,
                exam: s.exam,
                attendance: !!this.getAttendanceBySession(s.id),
                lastEvent: last ? last.event : "login",
                lastDetail: last ? last.detail : "-",
                lastAt: last ? last.at : s.createdAt,
            };
        });

        const pengawas = sessions.filter((s) => s.role === "pengawas").map((s) => ({ ...s }));

        return {
            generatedAt: nowISO(),
            stats: {
                totalSiswaLogin: this.attendance.length,
                totalSiswaAktif: aktif.length,
                totalBeritaAcara: this.beritaAcara.length,
                totalTokensDipakai: this.tokenUses.size,
                totalTokenValid: this.tokens.size,
                totalPeristiwa: this.tracking.length,
            },
            siswa: aktif,
            pengawas,
            beritaAcara: [...this.beritaAcara].reverse(),
            kejadian: this.getTracking(),
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
    async createSession({ username, name, role, className, exam }) {
        const token = crypto.randomBytes(32).toString("hex");
        const sessionId = generateId("ses");

        const payload = {
            username,
            name,
            role,
            class_name: className || null,
            exam: exam || null,
            token,
            active: true,
        };

        const { data, error } = await this.client
            .from(this.tables.users)
            .insert(payload)
            .select("*")
            .single();
        if (error) throw error;

        // Bentuk sesi in-memory agar kompatibel dengan seluruh handler
        const session = {
            id: sessionId,
            token: data.token,
            username: data.username,
            name: data.name,
            role: data.role,
            className: data.class_name,
            exam: data.exam,
            createdAt: data.created_at || nowISO(),
        };
        this.memory.sessions.set(session.token, session);
        return session;
    }

    getSession(token) {
        if (!token) return null;
        return this.memory.getSession(token);
    }

    async destroySession(token) {
        this.memory.destroySession(token);
        await this.client
            .from(this.tables.users)
            .update({ active: false })
            .eq("token", token);
    }

    /* ---------------- Presensi (siswa) ---------------- */
    async addAttendance({ sessionId, name, className, examKey, examTitle, room }) {
        const payload = {
            session_id: sessionId,
            student_name: name,
            class_name: className || null,
            exam_key: examKey || null,
            exam_title: examTitle || null,
            room,
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
        // Muat ulang data real dari Supabase untuk monitor pengawas
        try {
            const [beritaRes, trackingRes] = await Promise.all([
                this.client
                    .from(this.tables.beritaAcara)
                    .select("*")
                    .order("submitted_at", { ascending: false })
                    .limit(50),
                this.client
                    .from(this.tables.tracking)
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(100),
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
        } catch (e) {
            // Abaikan - pakai data cache
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