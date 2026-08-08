/**
 * Self-check pembagian ruang & nomor ujian.
 * Jalankan: node scripts/check-ruang.js
 */
const assert = require("assert");
const { studentCredentials: students } = require("../server/config.js");

const perRoom = {};
const perClass = {};
for (const s of students) {
    assert.ok(s.room, `${s.name} belum punya ruang`);
    assert.ok(s.examNumber, `${s.name} belum punya nomor ujian`);
    perRoom[s.room] = (perRoom[s.room] || 0) + 1;
    perClass[s.className] = perClass[s.className] || {};
    perClass[s.className][s.room] = (perClass[s.className][s.room] || 0) + 1;
}

const roomNames = Object.keys(perRoom).sort();
const counts = Object.values(perRoom);
assert.strictEqual(roomNames.length, 3, `jumlah ruang harus 3, dapat ${roomNames.length}`);
assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `ruang tidak seimbang: ${JSON.stringify(perRoom)}`);
assert.strictEqual(
    new Set(students.map((s) => s.examNumber)).size,
    students.length,
    "nomor ujian ada yang duplikat"
);

// Tiap kelas harus muncul di semua ruang, selisih maksimal 1 siswa.
for (const [className, rooms] of Object.entries(perClass)) {
    const n = roomNames.map((r) => rooms[r] || 0);
    assert.ok(
        Math.min(...n) > 0 && Math.max(...n) - Math.min(...n) <= 1,
        `kelas ${className} tidak tersebar merata: ${JSON.stringify(rooms)}`
    );
}

console.log(`OK — ${students.length} siswa, ${JSON.stringify(perRoom)}`);
for (const [className, rooms] of Object.entries(perClass).sort()) {
    console.log(`  ${className}: ${roomNames.map((r) => `${r}=${rooms[r] || 0}`).join("  ")}`);
}
