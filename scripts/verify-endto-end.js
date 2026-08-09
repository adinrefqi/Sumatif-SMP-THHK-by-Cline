/**
 * Verifikasi end-to-end (sesuai rencana):
 * Jalankan server lokal mode demo (PORT=3999), lalu uji dengan fetch + cookie jar.
 * 1. Login admin → /api/monitor → siswa.length = jumlah peserta + ada baris sessionId null.
 * 2. Login siswa → presensi → token → track pdf_halaman → lastEvent = pdf_halaman, halaman terisi.
 * 3. Login pengawas ber-room → /api/monitor hanya berisi siswa ruang itu, kejadian tidak memuat ruang lain.
 * 4. Pengawas non-admin → POST /api/reset-siswa = 403; DELETE /api/tokens/xxx = 403. Admin reset = 200.
 * 5. Siswa → POST /api/pelanggaran-ditangani = 403. Pengawas → 200.
 * 6. "pengawas" in snapshot === false.
 *
 * Jalankan: node scripts/verify-endto-end.js
 */
const { spawn } = require("child_process");
const assert = require("assert");
const config = require("../server/config.js");

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;

/* Cookie jar sederhana: simpan cookie dari Set-Cookie terakhir. */
let cookie = "";
function jar(cookieHeader) {
    if (!cookieHeader) return;
    cookie = cookieHeader.split(";")[0];
}

async function api(path, { method = "GET", body } = {}) {
    const resp = await fetch(BASE + path, {
        method,
        headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
    });
    jar(resp.headers.get("set-cookie"));
    return resp;
}

async function main() {
    // 1. Admin login → monitor: semua peserta tampil, ada sessionId null.
    let r = await api("/api/login", { method: "POST", body: { role: "pengawas", username: "admin", password: "admin123" } });
    assert.strictEqual(r.status, 200, "login admin harus 200");
    r = await api("/api/monitor");
    assert.strictEqual(r.status, 200, "monitor admin harus 200");
    let snap = await r.json();
    assert.strictEqual(snap.siswa.length, config.studentCredentials.length, "admin melihat semua peserta");
    assert.ok(snap.siswa.some((s) => s.sessionId === null), "ada baris belum login (sessionId null)");
    assert.ok(!("pengawas" in snap), 'snapshot tidak boleh punya key "pengawas"');

    // 6. (sebagian) token pengawas tidak bocor — sudah dicek di atas.

    // 2. Siswa: login → presensi → token → track pdf_halaman.
    r = await api("/api/login", { method: "POST", body: { role: "siswa", username: "siswa2", password: "rahasia123" } });
    assert.strictEqual(r.status, 200, "login siswa harus 200");
    const siswaSesi = await r.json();
    assert.ok(siswaSesi.room, "siswa harus punya ruang");

    // TTD digital minimal 1×1 piksel PNG data URL agar lolos validasi server.
    const sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    r = await api("/api/presensi", { method: "POST", body: { room: siswaSesi.room, signature: sig } });
    assert.strictEqual(r.status, 200, "presensi harus 200");

    // Tanpa TTD harus ditolak (400).
    r = await api("/api/login", { method: "POST", body: { role: "siswa", username: "siswa3", password: "rahasia123" } });
    r = await api("/api/presensi", { method: "POST", body: { room: "Ruang 1" } });
    assert.strictEqual(r.status, 400, "presensi tanpa tanda tangan harus 400");

    // Kembali login siswa2 (cookie jar hanya satu). Sesi baru = presensi baru,
    // supaya baris monitor tetap punya presensiAt & signature.
    r = await api("/api/login", { method: "POST", body: { role: "siswa", username: "siswa2", password: "rahasia123" } });
    assert.strictEqual(r.status, 200, "login ulang siswa2 harus 200");
    r = await api("/api/presensi", { method: "POST", body: { room: "Ruang 1", signature: sig } });
    assert.strictEqual(r.status, 200, "presensi ulang siswa2 harus 200");
    r = await api("/api/token", { method: "POST", body: { token: "TOKENR2" } });
    assert.strictEqual(r.status, 200, "token TOKENR2 harus valid untuk siswa2 (matematika)");
    r = await api("/api/track", { method: "POST", body: { event: "pdf_halaman", detail: "hal 7", page: 7 } });
    assert.strictEqual(r.status, 200, "track pdf_halaman harus 200");

    // Kembali login admin (cookie jar hanya satu) untuk melihat monitor.
    r = await api("/api/login", { method: "POST", body: { role: "pengawas", username: "admin", password: "admin123" } });
    assert.strictEqual(r.status, 200, "login ulang admin harus 200");

    // Admin melihat baris siswa2: lastEvent pdf_halaman, halaman 7, presensiAt terisi.
    r = await api("/api/monitor");
    snap = await r.json();
    const barisSiswa2 = snap.siswa.find((s) => s.username === "siswa2");
    assert.ok(barisSiswa2, "siswa2 harus tampil");
    assert.strictEqual(barisSiswa2.lastEvent, "pdf_halaman", "lastEvent harus pdf_halaman, bukan login_siswa");
    assert.strictEqual(barisSiswa2.halaman, 7, "halaman harus 7");
    assert.ok(barisSiswa2.presensiAt, "presensiAt harus terisi");

    // 3. Pengawas ber-room "Ruang 1": hanya siswa Ruang 1, kejadian tidak memuat siswa ruang lain.
    r = await api("/api/login", { method: "POST", body: { role: "pengawas", username: "adin", password: "thhk2026" } });
    assert.strictEqual(r.status, 200, "login pengawas adin harus 200");
    r = await api("/api/monitor");
    snap = await r.json();
    assert.ok(snap.siswa.length > 0, "pengawas Ruang 1 melihat siswa");
    for (const s of snap.siswa) {
        assert.strictEqual(s.room, "Ruang 1", `pengawas Ruang 1 hanya boleh melihat Ruang 1, dapat ${s.room}`);
    }
    for (const k of snap.kejadian) {
        if (k.role === "siswa") {
            assert.ok(
                k.name === "Bima Pratama" || k.name === "Calvin Fransisco",
                `kejadian siswa di luar Ruang 1 tidak boleh tampil: ${k.name}`
            );
        }
    }

    // Siswa2 (Bima Pratama) ada di Ruang 1 — pastikan rahasia dihapus dulu dari cookie
    // karena cookie jar hanya satu. Login siswa2 lagi untuk cek 403 pelanggaran.

    // 5. Siswa tidak boleh menandai pelanggaran (403).
    r = await api("/api/login", { method: "POST", body: { role: "siswa", username: "siswa2", password: "rahasia123" } });
    assert.strictEqual(r.status, 200, "login ulang siswa2 harus 200");
    r = await api("/api/pelanggaran-ditangani", { method: "POST", body: { key: "x:y:z" } });
    assert.strictEqual(r.status, 403, "siswa menandai pelanggaran harus 403");

    // 4. Pengawas non-admin tidak boleh reset siswa / hapus token (403).
    r = await api("/api/login", { method: "POST", body: { role: "pengawas", username: "adin", password: "thhk2026" } });
    assert.strictEqual(r.status, 200, "login ulang adin harus 200");
    r = await api("/api/reset-siswa", { method: "POST", body: { username: "siswa2" } });
    assert.strictEqual(r.status, 403, "pengawas non-admin reset siswa harus 403");
    r = await api("/api/tokens/TOKENR2", { method: "DELETE" });
    assert.strictEqual(r.status, 403, "pengawas non-admin hapus token harus 403");

    // Pengawas boleh menandai pelanggaran (200).
    r = await api("/api/pelanggaran-ditangani", { method: "POST", body: { key: "x:y:z" } });
    assert.strictEqual(r.status, 200, "pengawas menandai pelanggaran harus 200");

    // 4b. Admin boleh reset siswa (200).
    r = await api("/api/login", { method: "POST", body: { role: "pengawas", username: "admin", password: "admin123" } });
    assert.strictEqual(r.status, 200, "login ulang admin harus 200");
    r = await api("/api/reset-siswa", { method: "POST", body: { username: "siswa2" } });
    assert.strictEqual(r.status, 200, "admin reset siswa harus 200");

    console.log("OK — seluruh verifikasi end-to-end lulus");
}

const server = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (d) => process.stdout.write(`[server] ${d}`));
server.stderr.on("data", (d) => process.stderr.write(`[server-err] ${d}`));

// Tunggu server siap.
const wait = async () => {
    for (let i = 0; i < 50; i++) {
        try {
            const r = await fetch(BASE + "/api/session");
            if (r.status === 401) return true;
        } catch (e) {
            // server belum siap
        }
        await new Promise((res) => setTimeout(res, 200));
    }
    return false;
};

(async () => {
    const ready = await wait();
    if (!ready) {
        console.error("Server tidak siap dalam 10 detik.");
        server.kill();
        process.exit(1);
    }
    try {
        await main();
    } catch (err) {
        console.error("VERIFIKASI GAGAL:", err.message);
        process.exitCode = 1;
    } finally {
        server.kill();
    }
})();