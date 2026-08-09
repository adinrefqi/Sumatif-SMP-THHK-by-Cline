/**
 * Self-check: jadwal ujian hari ini + progres per (siswa, mapel).
 *
 * Mode demo (tanpa Supabase) memperlakukan SEMUA mapel sebagai terjadwal
 * hari ini, sehingga token demo TOKENR1/R2/R3 tetap berfungsi.
 *
 * Jalankan: node scripts/check-jadwal.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");
const { studentCredentials } = require("../server/config.js");

async function main() {
    const siswa = studentCredentials[0];

    // 1) Jadwal hari ini berisi mapel inti (mode demo: semua mapel).
    const jadwal = await store.getJadwalHariIni();
    assert.ok(Array.isArray(jadwal) && jadwal.length >= 3, "jadwal hari ini minimal 3 mapel");
    const keys = new Set(jadwal.map((j) => j.examKey));
    for (const k of ["indonesia", "matematika", "ipa"]) {
        assert.ok(keys.has(k), `mapel ${k} harus ada di jadwal`);
    }
    const baris = jadwal.find((j) => j.examKey === "matematika");
    assert.ok(baris && baris.title, "baris jadwal harus punya judul");

    // 2) isJadwalAktif benar untuk yang terjadwal, salah untuk yang tidak dikenal.
    assert.strictEqual(await store.isJadwalAktif("indonesia"), true, "indonesia harus terjadwal");
    assert.strictEqual(await store.isJadwalAktif("ghost"), false, "mapel tak dikenal harus tidak terjadwal");

    // 3) Round-trip progres per (siswa, mapel).
    assert.strictEqual(await store.isCompleted(siswa.username, "matematika"), false, "awalnya belum selesai");
    await store.markCompleted(siswa.username, "matematika");
    assert.strictEqual(await store.isCompleted(siswa.username, "matematika"), true, "markCompleted tidak tercatat");

    // 4) Satu mapel tidak memengaruhi mapel lain.
    assert.strictEqual(await store.isCompleted(siswa.username, "indonesia"), false, "matematika mengunci indonesia");
    const selesai = await store.getCompletedSubjects(siswa.username);
    assert.ok(selesai.length === 1 && selesai[0] === "matematika", "daftar mapel selesai salah");

    // 5) resetProgress membersihkan semua.
    await store.resetProgress(siswa.username);
    assert.strictEqual(await store.isCompleted(siswa.username, "matematika"), false, "resetProgress tidak membersihkan");

    console.log(`OK — jadwal hari ini ${jadwal.length} mapel, progres per-mapel berjalan`);
}

main().catch((err) => {
    console.error("GAGAL:", err.message);
    process.exit(1);
});
