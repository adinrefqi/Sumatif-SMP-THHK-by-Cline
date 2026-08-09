/**
 * Self-check Fase 0 + Fitur 1:
 * - daftar peserta lengkap (yang belum login tetap tampil)
 * - field waktu baru (loginAt, presensiAt, selesaiAt, halaman)
 * - sort tracking terbaru dulu (bug 0.1)
 * - token pengawas tidak bocor (bug 0.2)
 * Jalankan: node scripts/check-peserta-lengkap.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");
const config = require("../server/config.js");

// 1. Tanpa satu pun login → daftar siswa = jumlah peserta resmi.
let snap = store.getLiveSnapshot();
assert.strictEqual(
    snap.siswa.length,
    config.studentCredentials.length,
    "tanpa login, jumlah baris siswa harus sama dengan daftar peserta"
);

// 2. Semua baris belum-login: sessionId null & attendance false.
for (const s of snap.siswa) {
    assert.strictEqual(s.sessionId, null, `${s.name} seharusnya belum login`);
    assert.strictEqual(s.attendance, false, `${s.name} seharusnya belum hadir`);
}

// 3. Login satu siswa → jumlah tetap, barisnya punya sessionId & loginAt.
const c = config.studentCredentials[0];
const s1 = store.createSession({
    username: c.username,
    name: c.name,
    role: "siswa",
    className: c.className,
    exam: c.exam,
    room: c.room,
    examNumber: c.examNumber,
});
snap = store.getLiveSnapshot();
assert.strictEqual(
    snap.siswa.length,
    config.studentCredentials.length,
    "setelah login, jumlah baris siswa harus tetap (peserta + sesi digabung)"
);
const masuk = snap.siswa.find((x) => x.username === c.username);
assert.ok(masuk.sessionId, `${c.name} harus punya sessionId setelah login`);
assert.ok(masuk.loginAt, `${c.name} harus punya loginAt`);

// 4. Sesi username di luar config tetap muncul (jumlah + 1).
const alien = store.createSession({
    username: "ghost",
    name: "Hantu Ujian",
    role: "siswa",
});
snap = store.getLiveSnapshot();
assert.strictEqual(
    snap.siswa.length,
    config.studentCredentials.length + 1,
    "sesi username di luar config harus tetap tampil"
);
assert.ok(
    snap.siswa.some((x) => x.username === "ghost"),
    "siswa ghost harus ada di daftar"
);

// 5. Sort tracking: lastEvent = event TERAKHIR yang ditambahkan (bug 0.1).
store.addTracking({ sessionId: s1.id, name: c.name, role: "siswa", event: "login_siswa", detail: "masuk" });
store.addTracking({ sessionId: s1.id, name: c.name, role: "siswa", event: "pdf_halaman", detail: "hal 7", page: 7 });
snap = store.getLiveSnapshot();
const s1baris = snap.siswa.find((x) => x.username === c.username);
assert.strictEqual(s1baris.lastEvent, "pdf_halaman", "lastEvent harus event terbaru, bukan login_siswa");
assert.strictEqual(s1baris.halaman, 7, "halaman harus diambil dari tracking ber-page");
assert.strictEqual(s1baris.lastAt, store.getTrackingBySession(s1.id)[0].at, "lastAt harus waktu event terbaru");

// 6. Token pengawas tidak bocor (bug 0.2).
assert.ok(!("pengawas" in snap), 'snapshot tidak boleh punya key "pengawas"');

// 7. totalSiswaLogin = jumlah baris ber-attendance.
const hadir = snap.siswa.filter((s) => s.attendance).length;
assert.strictEqual(snap.stats.totalSiswaLogin, hadir, "statistik presensi harus konsisten dengan tabel");

console.log(`OK — ${snap.siswa.length} baris siswa, ${hadir} hadir, lastEvent=${s1baris.lastEvent}`);