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
            if (found.role === "Admin" || found.username === "admin") {
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
            });
            setSessionCookie(res, session.token);
            track({ session, sessionToken: session.token }, "login_siswa", `${found.name} (${found.className}) masuk`);
            return res.json({
                ok: true,
                role: "siswa",
                name: found.name,
                className: found.className,
                exam: found.exam,
            });
        }

        return res.status(400).json({ error: "Peran tidak dikenal." });
    } catch (e) {
        return res.status(500).json({ error: "Gagal membuat sesi." });
    }
});

/* ---------- Info sesi saat ini ---------- */
app.get("/api/session", requireSession(null), (req, res) => {
    res.json({
        role: req.session.role,
        name: req.session.name,
        username: req.session.username,
        className: req.session.className || null,
        exam: req.session.exam || null,
        attendanceDone: req.session.attendanceDone || false,
        beritaAcaraDone: req.session.beritaAcaraDone || false,
        tokenValid: req.session.tokenValid || false,
        tokenLabel: req.session.tokenLabel || null,
        examTitle: req.session.examKey ? examTitle(req.session.examKey) : null,
    });
});

/* ---------- Logout ---------- */
app.post("/api/logout", requireSession(null), async (req, res) => {
    const sess = req.session;
    try {
        await store.destroySession(req.sessionToken);
    } catch (e) {
        // abaikan error saat destroy sesi
    }
    clearSessionCookie(res);
    return res.json({ ok: true });
});

/* ---------- Presensi (siswa) ---------- */
app.post("/api/presensi", requireSession("siswa"), async (req, res) => {
    const { room } = req.body || {};
    if (!room || !String(room).trim()) {
        return res.status(400).json({ error: "Ruang ujian wajib diisi." });
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
            room: String(room).trim(),
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

app.delete("/api/tokens/:token", requireSession("pengawas"), async (req, res) => {
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

/* ---------- Token ujian (siswa) ---------- */
app.post("/api/token", requireSession("siswa"), async (req, res) => {
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

    // Validasi token cocok dengan mapel sesi siswa
    if (result.examKey !== req.session.exam) {
        track(req, "token_salah_sesi", `Token ${result.label} tidak cocok dengan mapel ${req.session.exam}`);
        return res.status(400).json({
            error: "Token tidak sesuai untuk sesi mapel Anda. Pastikan mengambil token dari pengawas ruang yang benar.",
        });
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
    if (req.session.examKey !== examKey) {
        track(req, "akses_ditolak", `Coba akses PDF ${examKey} tanpa izin`);
        return res.status(403).json({ error: "Anda tidak memiliki akses ke berkas ini." });
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
    // Prioritas File ID: tabel `exams` di Supabase > env var di config.
    const driveFileId = await store.getExamDriveFileId(examKey);
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
        return res.json(await store.getLiveSnapshot());
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
        console.log("    Siswa    : siswa1 / rahasia123   (9A - B. Indonesia)");
        console.log("    Siswa    : siswa2 / rahasia123   (9A - Matematika)");
        console.log("    Siswa    : siswa3 / rahasia123   (9B - IPA)");
        console.log("  TOKEN DEMO : TOKEN9A, TOKEN9B, TOKEN9C");
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
