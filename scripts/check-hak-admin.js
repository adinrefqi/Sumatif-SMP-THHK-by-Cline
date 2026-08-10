/**
 * Self-check Fitur 4 & 5:
 * - config.isAdmin benar untuk admin, salah untuk pengawas biasa & unknown
 * - setiap room pengawas ada di daftar ruang siswa (menangkap salah ketik "Ruang1")
 * Jalankan: node scripts/check-hak-admin.js
 */
const assert = require("assert");
const config = require("../server/config.js");

// 1. isAdmin
assert.strictEqual(config.isAdmin("admin"), true, 'config.isAdmin("admin") harus true');
assert.strictEqual(config.isAdmin("pengawas1"), false, 'config.isAdmin("pengawas1") harus false');
assert.strictEqual(config.isAdmin("tidakada"), false, 'config.isAdmin("tidakada") harus false');

// 2. Room pengawas harus valid: nilai persis sama dengan ruang siswa.
const studentRooms = new Set(config.studentCredentials.map((s) => s.room).filter(Boolean));
const supervisors = config.supervisorCredentials.filter((c) => c.room);
assert.ok(supervisors.length > 0, "harus ada pengawas yang dilingkupi ruang");
for (const c of supervisors) {
    assert.ok(studentRooms.has(c.room), `room "${c.room}" pengawas ${c.username} tidak ada di daftar ruang siswa`);
}

// 3. Admin tidak boleh punya room (melihat semua ruang).
const adminEntry = config.supervisorCredentials.find((c) => config.isAdmin(c.username));
assert.ok(adminEntry, "admin harus ada di config");
assert.strictEqual(adminEntry.room, undefined, "admin tidak boleh dilingkupi satu ruang");

console.log(`OK — isAdmin benar, ${supervisors.length} pengawas ber-ruang, semua room valid`);