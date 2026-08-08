/**
 * Self-check: satu akun hanya boleh punya satu sesi aktif.
 * Login ulang tanpa menekan Keluar tidak boleh membuat siswa muncul
 * dua kali di Live Monitor.
 *
 * Jalankan: node scripts/check-sesi.js
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

// Login pertama, lalu login lagi tanpa logout (browser ditutup, HP restart, dsb).
const sesi1 = store.createSession(akun);
const sesi2 = store.createSession(akun);
assert.notStrictEqual(sesi1.token, sesi2.token, "sesi baru harus punya token berbeda");

const snapshot = store.getLiveSnapshot();
const munculan = snapshot.siswa.filter((s) => s.name === siswa.name);
assert.strictEqual(
    munculan.length,
    1,
    `${siswa.name} muncul ${munculan.length}× di Live Monitor, seharusnya 1×`
);

// Sesi lama harus mati, sesi baru harus hidup.
assert.strictEqual(store.getSession(sesi1.token), null, "sesi lama masih bisa dipakai");
assert.ok(store.getSession(sesi2.token), "sesi baru justru hilang");

// Ruang & nomor ujian ikut terbawa ke monitor (bukan '-').
assert.strictEqual(munculan[0].room, siswa.room, "ruang tidak sampai ke Live Monitor");
assert.strictEqual(munculan[0].examNumber, siswa.examNumber, "nomor ujian tidak sampai ke Live Monitor");

console.log(`OK — ${siswa.name} login 2×, muncul 1× di monitor (${munculan[0].room}, No. ${munculan[0].examNumber})`);
