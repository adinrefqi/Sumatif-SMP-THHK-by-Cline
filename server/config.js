/* =========================================================
 * KONFIGURASI SERVER - PORTAL SUMATIF SMP TUNAS HIDUP HARAPAN KITA
 * =========================================================
 * CATATAN PRODUKSI:
 * - Ganti semua kredensial demo di bawah dengan nilai asli.
 * - Untuk produksi, gunakan Supabase sebagai database
 *   (lihat server/store.js untuk adapter database).
 * - Letakkan kredensial di environment variables, bukan di file.
 */

module.exports = {
    // Port server HTTP
    port: process.env.PORT || 3000,

    // ============ BERKAS SOAL (Google Drive) ============
    // ID berkas publik Google Drive untuk setiap mata pelajaran.
    // Format tautan: https://drive.google.com/file/d/<FILE_ID>/view
    // Cara membuat tautan unduhan langsung tanpa API key:
    //   https://drive.google.com/uc?export=download&id=<FILE_ID>
    examFiles: {
        indonesia: {
            title: "Bahasa Indonesia",
            // Kosongkan jika belum ada berkas asli; server akan memakai PDF demo.
            driveFileId: process.env.DRIVE_ID_INDONESIA || "",
        },
        matematika: {
            title: "Matematika",
            driveFileId: process.env.DRIVE_ID_MATEMATIKA || "",
        },
        ipa: {
            title: "IPA",
            driveFileId: process.env.DRIVE_ID_IPA || "",
        },
    },

    // Grafik "waktu render per berkas" untuk meniru pengambilan PDF
    // pada mode DEMO (ketika tidak ada berkas asli Google Drive).
    demoFile: {
        title: "Soal Sumatif - Contoh (DEMO)",
        pdf: {
            // 12 halaman soal contoh (teks)
            pageCount: 12,
        },
    },

    // ============ OTAK/ADMIN & PENGAWAS ============
    // Kredensial login pengawas (demonstrasi).
    supervisorCredentials: [
        {
            username: "pengawas",
            password: "thhk2026",
            name: "Pak Budi Santoso",
            role: "Pengawas",
        },
    ],

    // ============ SISWA ============
    // Kredensial login siswa tanpa SSO (demonstrasi).
    studentCredentials: [
        {
            username: "siswa1",
            password: "rahasia123",
            name: "Anita Kusuma",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "siswa2",
            password: "rahasia123",
            name: "Bima Pratama",
            className: "9A",
            exam: "matematika",
        },
        {
            username: "siswa3",
            password: "rahasia123",
            name: "Citra Lestari",
            className: "9B",
            exam: "ipa",
        },
    ],

    // ============ TOKEN UJIAN ============
    // Token diberikan oleh pengawas di ruang ujian.
    // Format: { token: { examKey, label } }
    examTokens: {
        TOKEN9A: { examKey: "indonesia", label: "Token Sesi Ruang 9A" },
        TOKEN9B: { examKey: "matematika", label: "Token Sesi Ruang 9B" },
        TOKEN9C: { examKey: "ipa", label: "Token Sesi Ruang 9C" },
    },

    // ============ OPSI KEAMANAN ============
    security: {
        // Deteksi upaya membuka penampil PDF (klik kanan, shortcut, dll)
        blockContextMenu: true,
        blockDevToolsShortcut: true,
        blockCopyPaste: true,
        blockSelection: true,
        // Pesan peringatan pada aktivitas mencurigakan
        warnOnSuspiciousActivity: true,
    },

    // ============ SUPABASE (OPSIONAL - PRODUKSI) ============
    // Jika diisi, server akan memakai tabel Supabase sebagai sumber data.
    // Jika tidak, server memakai penyimpanan in-memory (MODE DEMO).
    supabase: {
        url: process.env.SUPABASE_URL || "",
        anonKey: process.env.SUPABASE_ANON_KEY || "",
        tables: {
            users: "users",
            tokens: "exam_tokens",
            attendance: "attendance",
            beritaAcara: "berita_acara",
            tracking: "tracking_activity",
            exams: "exams",
        },
    },
};