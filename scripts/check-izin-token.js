/**
 * Self-check: izin membuat token per (pengawas, mapel).
 * - Deny by default: tanpa izin, pengawas tidak bisa membuat token mapel itu.
 * - setIzinMapel memberi izin; revoke mencabutnya.
 *
 * Jalankan: node scripts/check-izin-token.js
 */
const assert = require("assert");
const { store } = require("../server/store.js");

async function main() {
    const username = "pengawas1";

    // 1) Deny by default.
    assert.deepStrictEqual(
        await store.getIzinMapel(username),
        [],
        "pengawas baru tidak boleh punya izin apa pun"
    );

    // 2) Beri izin matematika → muncul di daftar.
    await store.setIzinMapel(username, "matematika", true);
    const izin = await store.getIzinMapel(username);
    assert.ok(izin.includes("matematika"), "izin matematika tidak tercatat");
    assert.ok(!izin.includes("indonesia"), "mapel lain ikut terizinkan");

    // 3) Revoke → hilang dari daftar.
    await store.setIzinMapel(username, "matematika", false);
    assert.ok(
        !(await store.getIzinMapel(username)).includes("matematika"),
        "revoke tidak mencabut izin"
    );

    // 4) getAllIzin mengembalikan array (untuk render matriks admin).
    assert.ok(Array.isArray(await store.getAllIzin()), "getAllIzin harus array");

    // 5) getSemuaDriveFileId tersedia (mode demo: semua level = env var).
    const ids = await store.getSemuaDriveFileId("matematika");
    assert.ok("7" in ids && "8" in ids && "9" in ids && "" in ids, "semua level harus ada");

    console.log("OK — izin token per pengawas×mapel berjalan (deny by default)");
}

main().catch((err) => {
    console.error("GAGAL:", err.message);
    process.exit(1);
});
