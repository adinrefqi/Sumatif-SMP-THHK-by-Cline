/* =========================================================
 * SERVER UTAMA - PORTAL SUMATIF SMP TUNAS HIDUP HARAPAN KITA
 * ---------------------------------------------------------
 * - Autentikasi sesi berbasis cookie HttpOnly (tanpa SSO)
 * - Proxy PDF Google Drive (frontend tidak pernah melihat URL asli)
 * - Token gate, presensi, berita acara, tracking real-time
 * - Live Monitor untuk pengawas
 * ========================================================= */

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { store, useSupabase } = require("./store");
const { generateDemoPdf } = require("./pdfgen");

const app = express();
const PUBLIC_DIR = path.join(__dirname, "..", "public");

/* ---------------------------------------------------------
 * UTILITAS
 * --------------------------------------------------------- */
const COOKIE_NAME = "thhk_sumatif_session";

function parseCookies(req) {
    const header = req.headers.cookie || "";
    const out = {};
    header.split(";").forEach((pair) => {
        const idx = pair.indexOf("=");
        if (idx > -1) {
            const key = pair.slice(0, idx).trim();
            const val = pair.slice(idx + 1).trim();
            out[key] = decodeURIComponent(val);
        }
    });
    return out;
}

function setSessionCookie(res, token) {
    res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${60 * 60 * 8}`
    );
}

function clearSessionCookie(res) {
    res.setHeader("Set-Cookie", `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
}

function requireSession(role) {
    // Catatan: sesi di Supabase disimpan di tabel `users`.
    // Di Vercel serverless, instance bisa berganti kapan saja, jadi
    // kita validasi token ke database bila tidak ada di memory.
    return async (req, res, next) => {
        try {
            const token = parseCookies(req)[COOKIE_NAME];
            const session = await store.getSession(token);
            if (!session) {
                return res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
            }
            if (role && session.role !== role) {
                return res.status(403).json({ error: "Akses ditolak untuk peran ini." });
            }
            req.session = session;
            req.sessionToken = token;
            next();
        } catch (e) {
            return res.status(500).json({ error: "Gagal memvalidasi sesi." });
        }
    };
}

/* Aksi merusak khusus Admin. Pengawas biasa cukup memantau. */
function requireAdmin() {
    const guard = requireSession("pengawas");
    return (req, res, next) =>
        guard(req, res, () => {
            if (!config.isAdmin(req.session.username)) {
                return res.status(403).json({ error: "Aksi ini khusus Administrator." });
            }
            next();
        });
}

function examTitle(key) {
    const f = config.examFiles[key];
    return f ? f.title : "Soal Sumatif";
}

function track(req, event, detail = "", page = null) {
    try {
        // Di mode Supabase, addTracking bersifat async (Promise).
        // Kita tidak menunggunya agar tidak memperlambat permintaan utama,
        // tapi tangani rejection-nya agar tidak menjadi unhandled rejection.
        const result = store.addTracking({
            sessionId: req.session.id,
            name: req.session.name,
            role: req.session.role,
            event,
            detail,
            page,
        });
        if (result && typeof result.catch === "function") {
            result.catch(() => { });
        }
    } catch (e) {
        // jangan sampai tracking merusak permintaan utama
    }
}

/* ---------------------------------------------------------
 * MIDDLEWARE GLOBAL
 * --------------------------------------------------------- */
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
    // Header keamanan dasar
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    next();
});

/* =========================================================
 * ENDPOINT API
 * ========================================================= */

/* ---------- Login (tanpa SSO) ---------- */
app.post("/api/login", async (req, res) => {
    const { role, username, password } = req.body || {};

    if (!role || !username || !password) {
        return res.status(400).json({ error: "Lengkapi semua kolom login." });
    }

    try {
        if (role === "pengawas") {
            const found = config.supervisorCredentials.find(
                (c) => c.username === username && c.password === password
            );
            if (!found) return res.status(401).json({ error: "Kredensial pengawas salah." });

            const session = await store.createSession({
                username: found.username,
                name: found.name,
                role: "pengawas",
            });

            // ADMIN SUPER USER: langsung masuk dashboard tanpa
            // diwajibkan mengisi Berita Acara.
            if (config.isAdmin(found.username)) {
                await store.updateSessionState(session.token, { beritaAcaraDone: true }).catch(() => { });
            }

            setSessionCookie(res, session.token);
            track({ session, sessionToken: session.token }, "login_pengawas", `Pengawas ${found.name} masuk`);
            return res.json({
                ok: true,
                role: "pengawas",
                name: found.name,
                username: found.username,
            });
        }

        if (role === "siswa") {
            const found = config.studentCredentials.find(
                (c) => c.username === username && c.password === password
            );
            if (!found) return res.status(401).json({ error: "Kredensial siswa salah." });

            const session = await store.createSession({
                username: found.username,
                name: found.name,
                role: "siswa",
                className: found.className,
                exam: found.exam,
                room: found.room,
                examNumber: found.examNumber,
            });
            setSessionCookie(res, session.token);
            track({ session, sessionToken: session.token }, "login_siswa", `${found.name} (${found.className}) masuk`);
            return res.json({
                ok: true,
                role: "siswa",
                name: found.name,
                className: found.className,
                exam: found.exam,
                room: found.room,
                examNumber: found.examNumber,
            });
        }

        return res.status(400).json({ error: "Peran tidak dikenal." });
    } catch (e) {
        return res.status(500).json({ error: "Gagal membuat sesi." });
    }
});

/* ---------- Info sesi saat ini ---------- */
app.get("/api/session", requireSession(null), async (req, res) => {
    const body = {
        role: req.session.role,
        name: req.session.name,
        username: req.session.username,
        className: req.session.className || null,
        exam: req.session.exam || null,
        room: req.session.room || null,
        examNumber: req.session.examNumber || null,
        attendanceDone: req.session.attendanceDone || false,
        beritaAcaraDone: req.session.beritaAcaraDone || false,
        tokenValid: req.session.tokenValid || false,
        tokenLabel: req.session.tokenLabel || null,
        subjectConfirmed: req.session.subjectConfirmed || false,
        examCompleted: req.session.examCompleted || false,
        examTitle: req.session.examKey ? examTitle(req.session.examKey) : null,
        isAdmin: config.isAdmin(req.session.username),
    };

    // Siswa: kirim jadwal hari ini + mapel yang sudah diselesaikan, agar
    // frontend bisa menampilkan pemilih mapel (ala ANBK). Gagal membaca
    // jadwal tidak boleh mengagalkan sesi — cukup kirim daftar kosong.
    if (req.session.role === "siswa") {
        try {
            body.todaySubjects = await store.getJadwalHariIni();
        } catch (e) {
            body.todaySubjects = [];
        }
        try {
            body.completedSubjects = await store.getCompletedSubjects(req.session.username);
        } catch (e) {
            body.completedSubjects = [];
        }
    }

    res.json(body);
});

/* ---------- Selesai ujian (siswa) ---------- */
app.post("/api/finish", requireSession("siswa"), async (req, res) => {
    if (!req.session.tokenValid) {
        return res.status(403).json({ error: "Token ujian belum divalidasi." });
    }

    // Idempotent: menandai ulang tidak berbahaya.
    req.session.examCompleted = true;
    req.session.examCompletedAt = new Date().toISOString();
    try {
        await store.updateSessionState(req.sessionToken, {
            examCompleted: true,
            examCompletedAt: req.session.examCompletedAt,
        });
        // Penyelesaian tahan lama disimpan per (siswa, mapel) — mengunci
        // mapel ini saja, bukan seluruh akun.
        if (req.session.examKey) {
            await store.markCompleted(req.session.username, req.session.examKey);
        }
    } catch (e) {
        return res.status(500).json({ error: "Gagal menyimpan penyelesaian ujian." });
    }

    // Catat di server (authoritative), bukan dari sisi klien.
    track(req, "selesai_ujian", "Siswa menekan Selesai Ujian");
    return res.json({ ok: true });
});

/* ---------- Logout ---------- */
app.post("/api/logout", requireSession(null), async (req, res) => {
    const sess = req.session;

    // Siswa yang keluar setelah token ujian valid dianggap selesai:
    // soal tidak boleh dibuka lagi lewat login ulang. Hanya reset oleh
    // pengawas/admin yang membukanya kembali. Siswa yang keluar sebelum
    // token divalidasi (belum masuk ujian) tidak dikunci.
    if (sess.role === "siswa" && sess.tokenValid && !sess.examCompleted) {
        try {
            await store.updateSessionState(req.sessionToken, {
                examCompleted: true,
                examCompletedAt: new Date().toISOString(),
            });
            // Keluar saat ujian = mapel ini dianggap selesai (per-mapel,
            // bukan mengunci seluruh akun).
            if (sess.examKey) {
                await store.markCompleted(sess.username, sess.examKey);
            }
            track(req, "selesai_ujian", "Siswa keluar saat ujian berlangsung");
        } catch (e) {
            // abaikan - logout tetap dilanjutkan
        }
    }

    try {
        await store.destroySession(req.sessionToken);
    } catch (e) {
        // abaikan error saat destroy sesi
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
});

/* ---------- Reset kunci ujian siswa (khusus admin) ---------- */
app.post("/api/reset-siswa", requireAdmin(), async (req, res) => {
    const username = String((req.body || {}).username || "").trim();
    if (!username) {
        return res.status(400).json({ error: "Username siswa wajib diisi." });
    }

    const siswa = config.studentCredentials.find((c) => c.username === username);
    if (!siswa) {
        return res.status(404).json({ error: "Siswa tidak ditemukan." });
    }

    try {
        // V1: resetStudentLock juga memanggil resetProgress(username),
        // jadi seluruh mapel siswa dibuka kembali.
        await store.resetStudentLock(username);
    } catch (e) {
        return res.status(500).json({ error: "Gagal mereset ujian siswa." });
    }

    track(req, "reset_ujian", `${req.session.name} mereset ujian ${siswa.name}`);
    return res.json({ ok: true, name: siswa.name });
});

/* ---------- Tandai pelanggaran sudah ditangani (pengawas) ---------- */
app.post("/api/pelanggaran-ditangani", requireSession("pengawas"), (req, res) => {
    const key = String((req.body || {}).key || "").trim();
    if (!key) return res.status(400).json({ error: "Kunci pelanggaran wajib diisi." });
    track(req, "pelanggaran_ditangani", key);
    return res.json({ ok: true });
});

/* ---------- Presensi (siswa) ---------- */
app.post("/api/presensi", requireSession("siswa"), async (req, res) => {
    if (req.session.examCompleted) {
        return res.status(403).json({ error: "Anda telah menyelesaikan ujian ini." });
    }
    // Pemilih mapel wajib sebelum presensi, supaya catatan kehadiran
    // memakai mapel yang benar (bukan mapel default dari config).
    if (!req.session.subjectConfirmed) {
        return res.status(403).json({ error: "Pilih mata pelajaran terlebih dahulu." });
    }

    const room = req.session.room;
    if (!room) {
        return res.status(409).json({ error: "Pembagian ruang belum tersedia. Silakan login ulang." });
    }

    // Tanda tangan digital siswa berupa data URL PNG. Wajib diisi dan
    // dibatasi ukurannya agar database tidak dibanjiri data besar.
    const signature = String((req.body || {}).signature || "");
    if (!signature.startsWith("data:image/png;base64,")) {
        return res.status(400).json({ error: "Tanda tangan wajib diisi." });
    }
    if (Buffer.byteLength(signature, "utf8") > 200 * 1024) {
        return res.status(400).json({ error: "Ukuran tanda tangan terlalu besar." });
    }

    const sudah = await store.getAttendanceBySession(req.session.id);
    if (sudah) {
        req.session.attendanceDone = true;
        return res.json({ ok: true, sudah: true, attendance: sudah });
    }

    try {
        const attendance = await store.addAttendance({
            sessionId: req.session.id,
            name: req.session.name,
            className: req.session.className,
            examKey: req.session.exam,
            examTitle: examTitle(req.session.exam),
            room,
            signature,
        });
        req.session.attendanceDone = true;
        try {
            await store.updateSessionState(req.sessionToken, { attendanceDone: true });
        } catch (e) {
            // abaikan - respons tetap sukses
        }
        track(req, "presensi", `Presensi dikonfirmasi - Ruang ${room}`);
        return res.json({ ok: true, attendance });
    } catch (e) {
        return res.status(500).json({ error: "Gagal menyimpan presensi." });
    }
});

/* ---------- Berita Acara (pengawas) ---------- */
app.post("/api/berita-acara", requireSession("pengawas"), async (req, res) => {
    const {
        room,
        examDate,
        examTime,
        supervisorCount,
        studentCount,
        incidents,
        notes,
    } = req.body || {};

    // Validasi kolom wajib
    if (!room || !examDate || !examTime) {
        return res.status(400).json({ error: "Ruang, tanggal, dan waktu ujian wajib diisi." });
    }
    if (!supervisorCount || supervisorCount < 1) {
        return res.status(400).json({ error: "Jumlah pengawas minimal 1." });
    }
    if (!studentCount || studentCount < 1) {
        return res.status(400).json({ error: "Jumlah peserta minimal 1." });
    }

    const sudah = await store.getBeritaAcaraBySession(req.session.id);
    if (sudah) {
        req.session.beritaAcaraDone = true;
        return res.json({ ok: true, sudah: true, beritaAcara: sudah });
    }

    try {
        const ba = await store.addBeritaAcara({
            sessionId: req.session.id,
            supervisorName: req.session.name,
            room: String(room).trim(),
            examDate,
            examTime,
            supervisorCount: Number(supervisorCount),
            studentCount: Number(studentCount),
            incidents: incidents || "Tidak ada kejadian khusus",
            notes: notes || "-",
        });
        req.session.beritaAcaraDone = true;
        try {
            await store.updateSessionState(req.sessionToken, { beritaAcaraDone: true });
        } catch (e) {
            // abaikan - respons tetap sukses
        }
        track(req, "berita_acara", `Berita Acara disubmit - Ruang ${room}`);
        return res.json({ ok: true, beritaAcara: ba });
    } catch (e) {
        return res.status(500).json({ error: "Gagal menyimpan Berita Acara." });
    }
});

/* ---------- Kelola token ujian (pengawas) ---------- */
app.get("/api/tokens", requireSession("pengawas"), async (req, res) => {
    try {
        const groups = await store.getTokens();
        return res.json({ groups });
    } catch (e) {
        return res.status(500).json({ error: "Gagal memuat daftar token." });
    }
});

app.post("/api/tokens", requireSession("pengawas"), async (req, res) => {
    const { examKey, label } = req.body || {};

    if (!examKey || !config.examFiles[examKey]) {
        return res.status(400).json({ error: "Pilih mata pelajaran yang valid." });
    }

    // Admin super user boleh semua mapel. Pengawas hanya untuk mapel yang
    // diizinkan admin (deny by default — tidak ada baris izin = ditolak).
    if (!config.isAdmin(req.session.username)) {
        const izin = await store.getIzinMapel(req.session.username);
        if (!izin.includes(examKey)) {
            return res.status(403).json({ error: "Anda belum diizinkan membuat token untuk mapel ini." });
        }
    }

    try {
        const created = await store.createToken({
            examKey,
            label: label ? String(label).trim() : "",
            createdBy: req.session.name,
        });
        track(req, "token_dibuat", `Token ${created.token} dibuat untuk ${examTitle(examKey)}`);
        return res.json({ ok: true, token: created });
    } catch (e) {
        return res.status(500).json({ error: "Gagal membuat token." });
    }
});

app.delete("/api/tokens/:token", requireAdmin(), async (req, res) => {
    const token = String(req.params.token || "").trim().toUpperCase();
    if (!token) {
        return res.status(400).json({ error: "Token tidak valid." });
    }

    const deleted = await store.deleteToken(token);
    if (!deleted) {
        return res.status(404).json({ error: "Token tidak ditemukan." });
    }

    track(req, "token_dihapus", `Token ${token} dihapus`);
    return res.json({ ok: true });
});

/* ---------- Izin token (khusus admin) ---------- */
app.get("/api/izin", requireAdmin(), async (req, res) => {
    try {
        const rows = await store.getAllIzin();
        const allowed = {};
        for (const r of rows) {
            if (!r.allowed) continue;
            if (!allowed[r.pengawas_username]) allowed[r.pengawas_username] = {};
            allowed[r.pengawas_username][r.exam_key] = true;
        }
        res.json({
            pengawas: config.supervisorCredentials.map((c) => ({
                username: c.username,
                name: c.name,
                isAdmin: config.isAdmin(c.username),
            })),
            examKeys: Object.keys(config.examFiles),
            allowed,
        });
    } catch (e) {
        res.status(500).json({ error: "Gagal memuat izin token." });
    }
});

app.post("/api/izin", requireAdmin(), async (req, res) => {
    const { username, examKey, allowed } = req.body || {};

    const pengawas = config.supervisorCredentials.find((c) => c.username === username);
    if (!pengawas || config.isAdmin(username)) {
        return res.status(400).json({ error: "Pengawas tidak valid." });
    }
    if (!config.examFiles[examKey]) {
        return res.status(400).json({ error: "Mata pelajaran tidak valid." });
    }

    try {
        await store.setIzinMapel(username, examKey, allowed !== false);
        track(
            req,
            "izin_token",
            `${req.session.name} ${allowed ? "mengizinkan" : "mencabut izin"} ${pengawas.name} untuk ${examTitle(examKey)}`
        );
        return res.json({ ok: true });
    } catch (e) {
        return res.status(500).json({ error: "Gagal menyimpan izin token." });
    }
});

/* ---------- Cek kesiapan soal (khusus admin) ---------- */
const CEK_SOAL_LEVELS = ["7", "8", "9", ""];

/* Status instan: mapel mana yang punya PDF (per level), tanpa unduh.
 * Cepat dan aman — tidak ada fetch Google Drive. */
app.get("/api/cek-soal", requireAdmin(), async (req, res) => {
    try {
        const results = [];
        for (const examKey of Object.keys(config.examFiles)) {
            const byLevel = await store.getSemuaDriveFileId(examKey);
            results.push({
                examKey,
                title: examTitle(examKey),
                byLevel: CEK_SOAL_LEVELS.map((level) => {
                    const id = byLevel[level] || "";
                    return { level, hasFile: Boolean(id), driveFileId: id, status: id ? "TERSEDIA" : "BELUM" };
                }),
            });
        }
        res.json({ results });
    } catch (e) {
        res.status(500).json({ error: "Gagal mengecek soal." });
    }
});

/* Uji unduh satu mapel: 4 level paralel (≤ ~8 dtk), aman di Vercel.
 * OK = PDF berhasil diambil + ukuran; ERROR = gagal; DEMO = tanpa berkas. */
app.get("/api/cek-soal/:examKey", requireAdmin(), async (req, res) => {
    const examKey = String(req.params.examKey || "").trim();
    if (!config.examFiles[examKey]) {
        return res.status(400).json({ error: "Mata pelajaran tidak dikenal." });
    }

    try {
        const ids = await store.getSemuaDriveFileId(examKey);
        const settled = await Promise.allSettled(
            CEK_SOAL_LEVELS.map(async (level) => {
                const id = ids[level] || "";
                if (!id) return { level, status: "DEMO", size: null };
                const buf = await fetchDrivePdf(id);
                return buf
                    ? { level, status: "OK", size: buf.length }
                    : { level, status: "ERROR", size: null };
            })
        );
        const byLevel = settled.map((r) => (r.status === "fulfilled" ? r.value : { level: "", status: "ERROR", size: null }));
        return res.json({ examKey, title: examTitle(examKey), byLevel });
    } catch (e) {
        return res.status(500).json({ error: "Gagal menguji soal." });
    }
});

/* ---------- Pilih mapel (siswa, sebelum presensi) ---------- */
app.post("/api/pilih-mapel", requireSession("siswa"), async (req, res) => {
    if (req.session.examCompleted) {
        return res.status(403).json({ error: "Anda telah menyelesaikan ujian ini." });
    }

    const examKey = String((req.body || {}).examKey || "").trim();
    if (!examKey || !config.examFiles[examKey]) {
        return res.status(400).json({ error: "Pilih mata pelajaran yang valid." });
    }

    // Sudah di tengah mengerjakan mapel lain? Jangan ubah pilihan.
    if (req.session.tokenValid) {
        return res.status(409).json({ error: "Anda sudah mulai mengerjakan mapel lain. Selesaikan atau keluar terlebih dahulu." });
    }

    try {
        if (!(await store.isJadwalAktif(examKey))) {
            return res.status(403).json({ error: "Mapel tidak terjadwal hari ini." });
        }
        if (await store.isCompleted(req.session.username, examKey)) {
            return res.status(403).json({ error: "Anda telah menyelesaikan mapel ini." });
        }
    } catch (e) {
        return res.status(500).json({ error: "Gagal memvalidasi jadwal mapel." });
    }

    req.session.exam = examKey;
    req.session.examKey = examKey;
    req.session.subjectConfirmed = true;
    try {
        await store.updateSessionState(req.sessionToken, {
            exam: examKey,
            examKey,
            subjectConfirmed: true,
        });
    } catch (e) {
        // abaikan - respons tetap sukses
    }

    let jam = { jamMulai: "", jamSelesai: "" };
    try {
        const jadwal = await store.getJadwalHariIni();
        const row = jadwal.find((j) => j.examKey === examKey);
        if (row) jam = { jamMulai: row.jamMulai, jamSelesai: row.jamSelesai };
    } catch (e) { /* abaikan */ }

    track(req, "pilih_mapel", `Mapel dipilih: ${examTitle(examKey)}`);
    return res.json({
        ok: true,
        examKey,
        examTitle: examTitle(examKey),
        jamMulai: jam.jamMulai,
        jamSelesai: jam.jamSelesai,
    });
});

/* ---------- Token ujian (siswa) ---------- */
app.post("/api/token", requireSession("siswa"), async (req, res) => {
    if (req.session.examCompleted) {
        return res.status(403).json({ error: "Anda telah menyelesaikan ujian ini." });
    }

    const { token } = req.body || {};
    if (!token || !String(token).trim()) {
        return res.status(400).json({ error: "Token wajib diisi." });
    }

    const cleaned = String(token).trim().toUpperCase();
    let result;
    try {
        result = await store.useToken(cleaned, req.session.id);
    } catch (e) {
        return res.status(500).json({ error: "Gagal memvalidasi token." });
    }

    if (!result.ok) {
        track(req, "token_gagal", `Percobaan token salah: ${cleaned}`);
        return res.status(400).json({ error: "Token tidak valid. Hubungi pengawas ruang ujian." });
    }

    // Validasi token cocok dengan mapel yang DIPILIH siswa
    if (result.examKey !== req.session.exam) {
        track(req, "token_salah_sesi", `Token ${result.label} tidak cocok dengan mapel ${req.session.exam}`);
        return res.status(400).json({
            error: "Token tidak sesuai untuk sesi mapel Anda. Pastikan mengambil token dari pengawas ruang yang benar.",
        });
    }

    // Defense-in-depth: mapel token harus terjadwal hari ini & belum diselesaikan
    // (menjaga kalau pemilih mapel dilewati atau jadwal berubah di tengah hari).
    try {
        if (!(await store.isJadwalAktif(result.examKey))) {
            return res.status(403).json({ error: "Mapel tidak terjadwal hari ini." });
        }
        if (await store.isCompleted(req.session.username, result.examKey)) {
            return res.status(403).json({ error: "Anda telah menyelesaikan mapel ini." });
        }
    } catch (e) {
        return res.status(500).json({ error: "Gagal memvalidasi jadwal mapel." });
    }

    req.session.tokenValid = true;
    req.session.examKey = result.examKey;
    req.session.tokenLabel = result.label;
    try {
        await store.updateSessionState(req.sessionToken, {
            tokenValid: true,
            examKey: result.examKey,
            tokenLabel: result.label,
        });
    } catch (e) {
        // abaikan - respon tetap sukses
    }
    track(req, "token_valid", `Token ${result.label} diterima`);

    return res.json({
        ok: true,
        examKey: result.examKey,
        examTitle: examTitle(result.examKey),
        label: result.label,
    });
});

/* ---------------------------------------------------------
 * PROXY PDF GOOGLE DRIVE (AMAN)
 * ---------------------------------------------------------
 * Frontend hanya memanggil /api/pdf/<examKey>. Server yang
 * mengambil berkas dari Google Drive lalu mengalirkannya.
 * Tautan asli Google Drive TIDAK PERNAH dikirim ke browser.
 */
app.get("/api/pdf/:examKey", requireSession("siswa"), async (req, res) => {
    const { examKey } = req.params;

    // Wajib sudah presensi + token valid
    if (!req.session.attendanceDone) {
        return res.status(403).json({ error: "Presensi wajib dikonfirmasi terlebih dahulu." });
    }
    if (!req.session.tokenValid) {
        return res.status(403).json({ error: "Token ujian belum divalidasi." });
    }
    if (req.session.examCompleted) {
        track(req, "akses_ditolak", "Mencoba buka PDF setelah ujian selesai");
        return res.status(403).json({ error: "Anda telah menyelesaikan ujian ini." });
    }
    if (req.session.examKey !== examKey) {
        track(req, "akses_ditolak", `Coba akses PDF ${examKey} tanpa izin`);
        return res.status(403).json({ error: "Anda tidak memiliki akses ke berkas ini." });
    }

    // Per-mapel: mapel yang sudah diselesaikan tidak boleh dibuka lagi.
    if (await store.isCompleted(req.session.username, examKey)) {
        track(req, "akses_ditolak", `Coba buka PDF ${examKey} setelah mapel selesai`);
        return res.status(403).json({ error: "Anda telah menyelesaikan mapel ini." });
    }

    const file = config.examFiles[examKey];
    const title = examTitle(examKey);
    const fileName = `Soal_Sumatif_${title.replace(/\s+/g, "_")}.pdf`;

    // Header anti-download / anti-save
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    track(req, "minta_pdf", `Meminta berkas soal ${title}`);

    let buf = null;
    // Prioritas File ID: tabel `exams` di Supabase (per kelas siswa)
    // > env var di config. Mengirim className agar siswa 7/8/9 mendapat
    // PDF yang berbeda untuk mapel yang sama.
    const driveFileId = await store.getExamDriveFileId(examKey, req.session.className);
    if (driveFileId) {
        buf = await fetchDrivePdf(driveFileId);
    }

    if (buf) {
        track(req, "pdf_dimuat_server", `Berkas ${title} berhasil diambil dari server`);
        res.end(buf);
    } else {
        // Fallback: PDF contoh (demo) agar alur tetap berfungsi
        track(req, "pdf_demo", `Berkas asli tidak tersedia - memakai PDF contoh`);
        generateDemoPdf(res, {
            examTitle: title,
            studentName: req.session.name,
            className: req.session.className,
        });
    }
});

async function fetchDrivePdf(fileId) {
    const url = `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const resp = await fetch(url, { redirect: "follow", signal: controller.signal });
        if (!resp.ok) return null;

        const contentType = (resp.headers.get("content-type") || "").toLowerCase();
        if (
            !contentType.includes("pdf") &&
            !contentType.includes("octet-stream") &&
            !contentType.includes("application/binary")
        ) {
            // Google Drive bisa mengembalikan halaman HTML "virus scan". Tangani sebagai gagal.
            return null;
        }

        const arrayBuffer = await resp.arrayBuffer();
        if (!arrayBuffer || arrayBuffer.byteLength < 100) return null;
        return Buffer.from(arrayBuffer);
    } catch (e) {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/* ---------- Tracking event (buka/tutup PDF, dll) ---------- */
app.post("/api/track", requireSession(null), (req, res) => {
    const { event, detail, page } = req.body || {};
    if (!event) return res.status(400).json({ error: "Event wajib diisi." });
    track(req, String(event), String(detail || ""), page ? Number(page) : null);
    return res.json({ ok: true });
});

/* ---------- Live Monitor (pengawas) ---------- */
app.get("/api/monitor", requireSession("pengawas"), async (req, res) => {
    try {
        const snap = await store.getLiveSnapshot();
        // Jadwal bersifat global (untuk semua ruang) — tidak ikut difilter ruang.
        snap.jadwal = await store.getJadwalHariIni();
        const c = config.supervisorCredentials.find((x) => x.username === req.session.username);
        const ruang = c && c.room && !config.isAdmin(req.session.username) ? c.room : null;
        if (ruang) {
            snap.siswa = snap.siswa.filter((s) => s.room === ruang);
            // Riwayat & pelanggaran ikut disaring agar tidak timpang dengan tabel:
            // simpan kejadian milik siswa di ruang ini, plus kejadian non-siswa
            // (token dibuat, berita acara, reset) yang memang lingkupnya global.
            const sesi = new Set(snap.siswa.map((s) => s.sessionId).filter(Boolean));
            snap.kejadian = snap.kejadian.filter((k) => k.role !== "siswa" || sesi.has(k.sessionId));
            snap.stats.totalSiswaLogin = snap.siswa.filter((s) => s.attendance).length;
            snap.stats.totalSiswaAktif = snap.siswa.filter((s) => s.isActive && !s.examCompleted).length;
            snap.stats.totalPeristiwa = snap.kejadian.length;
        }
        return res.json(snap);
    } catch (e) {
        return res.status(500).json({ error: "Gagal memuat data monitor." });
    }
});

/* ---------- Daftar Pilihan Mapel (untuk debug/utility) ---------- */
app.get("/api/exams", (req, res) => {
    const list = Object.entries(config.examFiles).map(([key, f]) => ({
        key,
        title: f.title,
        hasDriveFile: Boolean(f.driveFileId),
    }));
    res.json({ exams: list });
});

/* =========================================================
 * STATIC FRONTEND
 * ========================================================= */
app.use(express.static(PUBLIC_DIR, { index: "index.html", extensions: ["html"] }));

// Fallback SPA
app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

/* =========================================================
 * JALANKAN SERVER
 * ---------------------------------------------------------
 * Guard ini penting untuk deployment Vercel:
 * - Saat dijalankan langsung (`npm start` / `node server/index.js`),
 *   server Express berjalan seperti biasa.
 * - Saat diimport oleh Vercel sebagai serverless function,
 *   handler Express diekspor tanpa memanggil listen().
 * ========================================================= */
if (require.main === module) {
    const PORT = config.port;

    const server = app.listen(PORT, () => {
        console.log("================================================");
        console.log("  PORTAL SUMATIF — SMP TUNAS HIDUP HARAPAN KITA");
        console.log(`  Mode data     : ${useSupabase ? "SUPABASE (produksi)" : "DEMO (in-memory)"}`);
        console.log(`  Server aktif  : http://localhost:${PORT}`);
        console.log("------------------------------------------------");
        console.log("  AKUN DEMO:");
        console.log("    Pengawas : pengawas / thhk2026");
        console.log("    Siswa    : siswa2 / rahasia123   (Kelas 9 - Matematika)");
        console.log("    Siswa    : siswa3 / rahasia123   (Kelas 9 - IPA)");
        console.log("  TOKEN DEMO : TOKENR1, TOKENR2, TOKENR3");
        console.log("================================================");
    });

    server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
            console.error(`\n[ERROR BENTROK PORT] Port ${PORT} sedang digunakan oleh aplikasi lain!`);
            console.error(`Silakan hentikan proses di port ${PORT} atau jalankan server di port lain (contoh: PORT=3001 npm start).\n`);
        } else {
            console.error("Gagal menjalankan server:", err);
        }
    });
}

// Ekspor app untuk Vercel serverless
module.exports = app;
