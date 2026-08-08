/**
 * Self-check: siswa yang selesai/keluar tidak bisa mengerjakan soal lagi,
 * kecuali direset pengawas.
 *
 * Jalankan: node scripts/check-kunci-ujian.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");
const { studentCredentials } = require("../server/config.js");

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

// 1) Login pertama: belum terkunci.
const sesi1 = store.createSession(akun);
assert.strictEqual(sesi1.examCompleted, false, "sesi baru seharusnya belum terkunci");

// 2) Siswa menekan Selesai Ujian (atau keluar saat ujian berlangsung).
store.updateSessionState(sesi1.token, { examCompleted: true, examCompletedAt: new Date().toISOString() });
store.destroySession(sesi1.token);

// 3) Login ulang: kunci harus ikut terbawa, bukan sesi bersih.
const sesi2 = store.createSession(akun);
assert.strictEqual(sesi2.examCompleted, true, "login ulang membuka kunci — soal bisa dikerjakan lagi");

// 4) Pengawas mereset.
assert.ok(store.resetStudentLock(siswa.username), "reset melaporkan tidak ada yang dibuka");
assert.strictEqual(
    store.getSession(sesi2.token).examCompleted,
    false,
    "sesi yang sedang berjalan masih terkunci setelah direset"
);

// 5) Login setelah reset harus bersih kembali.
store.destroySession(sesi2.token);
const sesi3 = store.createSession(akun);
assert.strictEqual(sesi3.examCompleted, false, "kunci masih tersisa setelah reset");

// 6) Reset hanya mengenai siswa yang dimaksud.
const lain = studentCredentials[1];
const sesiLain = store.createSession({
    username: lain.username,
    name: lain.name,
    role: "siswa",
    className: lain.className,
    exam: lain.exam,
    room: lain.room,
    examNumber: lain.examNumber,
});
store.updateSessionState(sesiLain.token, { examCompleted: true });
store.resetStudentLock(siswa.username);
store.destroySession(sesiLain.token);
assert.strictEqual(
    store.createSession({ ...sesiLain, role: "siswa" }).examCompleted,
    true,
    "reset satu siswa ikut membuka kunci siswa lain"
);

console.log(`OK — ${siswa.name}: selesai → login ulang tetap terkunci → reset pengawas membuka kembali`);
