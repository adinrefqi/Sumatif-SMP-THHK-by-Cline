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
    //
    // CARA MENGATUR PDF PER MAPEL (2 opsi):
    //   Opsi 1 (disarankan, tanpa edit kode):
    //     Simpan File ID di tabel Supabase `exams`:
    //     - Buka Supabase Dashboard → Table Editor → `exams`
    //     - Insert/update baris: { exam_key: "matematika", drive_file_id: "<FILE_ID>" }
    //     - Server otomatis memakai nilai ini (lebih unggul dari env var).
    //   Opsi 2:
    //     Isi env variables di Vercel: DRIVE_ID_<KEY> untuk setiap mapel.
    //
    // Langkah upload PDF di Google Drive:
    //   1. Buka https://drive.google.com → New → File upload (atau drag&drop)
    //   2. Klik kanan file → Share → "Anyone with the link" → Viewer → Done
    //   3. Klik Share → Copy link → link berbentuk:
    //      https://drive.google.com/file/d/<FILE_ID>/view
    //      → ambil bagian <FILE_ID> (karakter antara /d/ dan /view).
    //   4. Masukkan <FILE_ID> ke Supabase tabel `exams` ATAU Vercel env var.
    //
    // CATATAN: driveFileId di bawah hanya fallback env var. Nilai kosong
    // berarti memakai PDF demo (contoh) sampai diisi.
    examFiles: {
        // ---- Kelompok A (wajib kurikulum merdeka) ----
        agama: {
            title: "Pendidikan Agama & Budi Pekerti",
            driveFileId: process.env.DRIVE_ID_AGAMA || "",
        },
        ppkn: {
            title: "PPKn",
            driveFileId: process.env.DRIVE_ID_PPKN || "",
        },
        indonesia: {
            title: "Bahasa Indonesia",
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
        ips: {
            title: "IPS",
            driveFileId: process.env.DRIVE_ID_IPS || "",
        },
        inggris: {
            title: "Bahasa Inggris",
            driveFileId: process.env.DRIVE_ID_INGGRIS || "",
        },
        // ---- Kelompok B ----
        seni: {
            title: "Seni Budaya",
            driveFileId: process.env.DRIVE_ID_SENI || "",
        },
        pjok: {
            title: "PJOK",
            driveFileId: process.env.DRIVE_ID_PJOK || "",
        },
        prakarya: {
            title: "Prakarya",
            driveFileId: process.env.DRIVE_ID_PRAKARYA || "",
        },
        informatika: {
            title: "Informatika",
            driveFileId: process.env.DRIVE_ID_INFORMATIKA || "",
        },
        // ---- Muatan Lokal (sesuaikan dengan sekolah) ----
        mulok_bahasa_daerah: {
            title: "Muatan Lokal Bahasa Daerah",
            driveFileId: process.env.DRIVE_ID_MULOK_BAHASA_DAERAH || "",
        },
        mulok_bahasa_asing: {
            title: "Muatan Lokal Bahasa Asing",
            driveFileId: process.env.DRIVE_ID_MULOK_BAHASA_ASING || "",
        },
        // ---- Mapel tambahan (sesuaikan kebutuhan) ----
        pendalaman_agama: {
            title: "Pendalaman Agama",
            driveFileId: process.env.DRIVE_ID_PENDALAMAN_AGAMA || "",
        },
        bimbingan_konseling: {
            title: "Bimbingan Konseling",
            driveFileId: process.env.DRIVE_ID_BK || "",
        },
        literasi: {
            title: "Literasi Digital",
            driveFileId: process.env.DRIVE_ID_LITERASI || "",
        },
        kewirausahaan: {
            title: "Kewirausahaan",
            driveFileId: process.env.DRIVE_ID_KEWIRAUSAHAAN || "",
        },
        matematika_tambahan: {
            title: "Matematika Tambahan",
            driveFileId: process.env.DRIVE_ID_MATEMATIKA_TAMBAHAN || "",
        },
        ipa_tambahan: {
            title: "IPA Tambahan",
            driveFileId: process.env.DRIVE_ID_IPA_TAMBAHAN || "",
        },
        ips_tambahan: {
            title: "IPS Tambahan",
            driveFileId: process.env.DRIVE_ID_IPS_TAMBAHAN || "",
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