/**
 * Self-check: penyelesaian ujian kini per (siswa, mapel), bukan kunci global.
 * - Login ulang TIDAK mengunci seluruh akun.
 * - Menyelesaikan satu mapel tidak menghalangi mapel lain.
 * - Reset pengawas membuka kembali mapel yang sudah selesai.
 *
 * Jalankan: node scripts/check-kunci-ujian.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");
const { studentCredentials } = require("../server/config.js");

async function main() {
    const siswa = studentCredentials[0];
    const akun = {
        username: siswa.username,
        name: siswa.name,
        role: "siswa",
        className: siswa.className,
        exam: siswa.exam,
        room: siswa.room,
        examNumber: siswa.examNumber,
    };

    // 1) Sesi baru tidak mewarisi kunci dari login sebelumnya.
    const sesi1 = store.createSession(akun);
    assert.strictEqual(sesi1.examCompleted, false, "sesi baru seharusnya belum terkunci");

    // 2) Siswa selesai mapel "matematika" → tercatat per-mapel.
    await store.markCompleted(siswa.username, "matematika");
    assert.strictEqual(
        await store.isCompleted(siswa.username, "matematika"),
        true,
        "markCompleted tidak tercatat"
    );

    // 3) Login ulang: sesi tetap bersih, tapi progres per-mapel bertahan.
    const sesi2 = store.createSession(akun);
    assert.strictEqual(sesi2.examCompleted, false, "login ulang membawa kunci global");
    assert.strictEqual(
        await store.isCompleted(siswa.username, "matematika"),
        true,
        "progres per-mapel hilang saat login ulang"
    );

    // 4) Satu mapel selesai tidak menghalangi mapel lain.
    assert.strictEqual(
        await store.isCompleted(siswa.username, "indonesia"),
        false,
        "menyelesaikan matematika ikut mengunci indonesia"
    );
    const mapelSelesai = await store.getCompletedSubjects(siswa.username);
    assert.ok(
        mapelSelesai.includes("matematika") && !mapelSelesai.includes("indonesia"),
        "daftar mapel selesai salah"
    );

    // 5) Pengawas mereset → seluruh progres dibuka kembali.
    await store.resetProgress(siswa.username);
    assert.strictEqual(
        await store.isCompleted(siswa.username, "matematika"),
        false,
        "reset tidak membuka mapel yang selesai"
    );

    // 6) resetStudentLock juga membersihkan sesi yang sedang berjalan.
    await store.markCompleted(siswa.username, "matematika");
    const sesi3 = store.createSession(akun);
    store.updateSessionState(sesi3.token, { examCompleted: true });
    assert.strictEqual(store.getSession(sesi3.token).examCompleted, true, "sesi belum ditandai selesai");
    store.resetStudentLock(siswa.username);
    assert.strictEqual(
        store.getSession(sesi3.token).examCompleted,
        false,
        "sesi yang sedang berjalan masih terkunci setelah reset"
    );

    console.log(`OK — ${siswa.name}: selesai per-mapel → login ulang bersih → mapel lain bebas → reset membuka kembali`);
}

main().catch((err) => {
    console.error("GAGAL:", err.message);
    process.exit(1);
});
