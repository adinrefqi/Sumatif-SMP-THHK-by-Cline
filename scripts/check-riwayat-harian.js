/**
 * Self-check: Riwayat Aktivitas hanya memuat kejadian hari berjalan
 * menurut zona waktu sekolah (WIB), bukan zona waktu server (UTC).
 *
 * Jalankan: node scripts/check-riwayat-harian.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");
const config = require("../server/config.js");

const offsetMs = config.timezoneOffsetMinutes * 60 * 1000;

// Awal hari menurut zona sekolah, dinyatakan dalam UTC.
const lokal = new Date(Date.now() + offsetMs);
lokal.setUTCHours(0, 0, 0, 0);
const awalHari = new Date(lokal.getTime() - offsetMs);

const jam = (n) => new Date(awalHari.getTime() + n * 3600 * 1000).toISOString();

store.tracking.length = 0;
store.tracking.push(
    { id: "t1", sessionId: "s1", name: "Kemarin Sore", event: "presensi", at: jam(-5) },
    { id: "t2", sessionId: "s1", name: "Tepat Tengah Malam", event: "presensi", at: jam(0) },
    // 01.49 WIB — pada server UTC ini masih "kemarin", jadi filter berbasis
    // UTC akan salah membuang baris ini.
    { id: "t3", sessionId: "s1", name: "Dini Hari WIB", event: "login_siswa", at: jam(1.82) },
    { id: "t4", sessionId: "s1", name: "Pagi Ini", event: "pdf_buka", at: jam(8) }
);

const hariIni = store.getTracking().map((t) => t.name);
assert.ok(!hariIni.includes("Kemarin Sore"), "kejadian kemarin masih ikut tampil");
assert.ok(hariIni.includes("Tepat Tengah Malam"), "batas tengah malam terbuang");
assert.ok(hariIni.includes("Dini Hari WIB"), "kejadian dini hari WIB terbuang oleh batas UTC");
assert.ok(hariIni.includes("Pagi Ini"), "kejadian pagi ini hilang");

// Terbaru harus di urutan pertama.
assert.strictEqual(hariIni[0], "Pagi Ini", "urutan tidak dari yang terbaru");

// Kartu statistik memakai angka yang sama dengan daftarnya.
const snapshot = store.getLiveSnapshot();
assert.strictEqual(
    snapshot.stats.totalPeristiwa,
    snapshot.kejadian.length,
    "kartu Peristiwa tidak sama dengan jumlah yang ditampilkan"
);

console.log(
    `OK — ${hariIni.length} kejadian hari ini (UTC+${config.timezoneOffsetMinutes / 60}), ` +
    `batas mulai ${awalHari.toISOString()}`
);
