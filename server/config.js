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
        // ===== DAFTAR MAPEL SMP TUNAS HIDUP HARAPAN KITA (19 mapel) =====
        // ---- Pendidikan Agama (pilih sesuai agama siswa) ----
        agama_katolik: {
            title: "Agama Katolik",
            driveFileId: process.env.DRIVE_ID_AGAMA_KATOLIK || "",
        },
        agama_kristen: {
            title: "Agama Kristen",
            driveFileId: process.env.DRIVE_ID_AGAMA_KRISTEN || "",
        },
        agama_islam: {
            title: "Agama Islam",
            driveFileId: process.env.DRIVE_ID_AGAMA_ISLAM || "",
        },
        agama_buddha: {
            title: "Agama Buddha",
            driveFileId: process.env.DRIVE_ID_AGAMA_BUDDHA || "",
        },
        agama_konghucu: {
            title: "Agama Konghucu",
            driveFileId: process.env.DRIVE_ID_AGAMA_KONGHUCU || "",
        },
        // ---- Kelompok inti ----
        pancasila: {
            title: "Pendidikan Pancasila",
            driveFileId: process.env.DRIVE_ID_PANCASILA || "",
        },
        indonesia: {
            title: "Bahasa Indonesia",
            driveFileId: process.env.DRIVE_ID_INDONESIA || "",
        },
        ipa: {
            title: "IPA",
            driveFileId: process.env.DRIVE_ID_IPA || "",
        },
        tik: {
            title: "TIK",
            driveFileId: process.env.DRIVE_ID_TIK || "",
        },
        matematika: {
            title: "Matematika",
            driveFileId: process.env.DRIVE_ID_MATEMATIKA || "",
        },
        ips: {
            title: "IPS",
            driveFileId: process.env.DRIVE_ID_IPS || "",
        },
        inggris: {
            title: "Bahasa Inggris",
            driveFileId: process.env.DRIVE_ID_INGGRIS || "",
        },
        seni: {
            title: "Seni Budaya",
            driveFileId: process.env.DRIVE_ID_SENI || "",
        },
        // ---- Muatan lokal & khusus SMP THHK ----
        bahasa_jawa: {
            title: "Bahasa Jawa",
            driveFileId: process.env.DRIVE_ID_BAHASA_JAWA || "",
        },
        penjas: {
            title: "PenJas",
            driveFileId: process.env.DRIVE_ID_PENJAS || "",
        },
        mandarin: {
            title: "Bahasa Mandarin",
            driveFileId: process.env.DRIVE_ID_MANDARIN || "",
        },
        bk: {
            title: "BK",
            driveFileId: process.env.DRIVE_ID_BK || "",
        },
        native_mandarin: {
            title: "Native Mandarin",
            driveFileId: process.env.DRIVE_ID_NATIVE_MANDARIN || "",
        },
        coding: {
            title: "Coding",
            driveFileId: process.env.DRIVE_ID_CODING || "",
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
    // Kredensial login siswa tanpa SSO.
    // username = nama depan (huruf kecil, tanpa spasi)
    // password = kata sandi default (ganti di produksi bila perlu)
    //
    // CATATAN MAPEL: setiap akun siswa terikat SATU mapel (kolom `exam`).
    // Untuk ujian lintas mapel, pembuat token harus memilih mapel yang
    // sama dengan sesi siswa tersebut. Ubah kolom `exam` sesuai jadwal.
    studentCredentials: [
        // ---------- AKUN DEMO (bawaan) ----------
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

        // ---------- SISWA KELAS 9 SMP THHK (27 siswa) ----------
        // Password default semua siswa: thhk2026
        {
            username: "calvin",
            password: "thhk2026",
            name: "Calvin Fransisco",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "celine",
            password: "thhk2026",
            name: "Celine Octavia Kusuma",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "clarice",
            password: "thhk2026",
            name: "Clarice Siera Elisabeth Rahardjo",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "clement",
            password: "thhk2026",
            name: "Clement Raphael Kurnia",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "desiani",
            password: "thhk2026",
            name: "Desiani Natalia Siallagan",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "darwin",
            password: "thhk2026",
            name: "Darwin Adelio Alvaro",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "erland",
            password: "thhk2026",
            name: "Erland Adriano Budiman",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "faris",
            password: "thhk2026",
            name: "Faris Mahardika Luki",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "flourencia",
            password: "thhk2026",
            name: "Flourencia Alvina",
            className: "9A",
            exam: "indonesia",
        },
        {
            username: "giovanni",
            password: "thhk2026",
            name: "Giovanni Agnell Tanuwijaya",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "gisella",
            password: "thhk2026",
            name: "Gisella Cellena Cleola Andrian",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "graciana",
            password: "thhk2026",
            name: "Graciana Shinta Dewi",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "henedictus",
            password: "thhk2026",
            name: "Henedictus Greffy Jeisen Putra",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "ivana",
            password: "thhk2026",
            name: "Ivana Jacinda",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "jefferson",
            password: "thhk2026",
            name: "Jefferson Setiawan",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "jesslyn1",
            password: "thhk2026",
            name: "Jesslyn Anna Belle Arminta Prawiro",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "jesslyn2",
            password: "thhk2026",
            name: "Jesslyn Yoewono",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "jocelyn",
            password: "thhk2026",
            name: "Jocelyn Octavia Gunawan",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "johan",
            password: "thhk2026",
            name: "Johan Faizal",
            className: "9B",
            exam: "indonesia",
        },
        {
            username: "keiko",
            password: "thhk2026",
            name: "Keiko Lee Yohanes",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "marquez",
            password: "thhk2026",
            name: "Marquez Loris",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "michelle",
            password: "thhk2026",
            name: "Michelle Angelica Setiono",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "mikhaela",
            password: "thhk2026",
            name: "Mikhaela Josephine Soetjipto",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "octavelie",
            password: "thhk2026",
            name: "Octavelie Sila Kirana",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "reynaldo",
            password: "thhk2026",
            name: "Reynaldo Xavier Alexander Gunawan",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "sebastian",
            password: "thhk2026",
            name: "Sebastian Moses Firlandi",
            className: "9C",
            exam: "indonesia",
        },
        {
            username: "yuriko",
            password: "thhk2026",
            name: "Yuriko Jessi Setiawan",
            className: "9C",
            exam: "indonesia",
        },

        // ---------- SISWA KELAS 8 SMP THHK (14 siswa) ----------
        // Password default semua siswa: thhk2026
        {
            username: "cathleen",
            password: "thhk2026",
            name: "Cathleen Hava Eliora.S",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "chrisna",
            password: "thhk2026",
            name: "Chrisna Monica Onggowarsito",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "eleanore",
            password: "thhk2026",
            name: "Eleanore Kimberly Wong",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "engracia",
            password: "thhk2026",
            name: "Engracia Sarah Chrisyabelle.S",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "jasson",
            password: "thhk2026",
            name: "Jasson Alvaro Gunarto",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "jennifer",
            password: "thhk2026",
            name: "Jennifer Aurelia Febriana",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "keane",
            password: "thhk2026",
            name: "Keane William Gunawan",
            className: "8A",
            exam: "indonesia",
        },
        {
            username: "kenichi",
            password: "thhk2026",
            name: "Kenichi Alvaro Gavriel",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "keyzia",
            password: "thhk2026",
            name: "Keyzia El Ryansyah",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "melvin",
            password: "thhk2026",
            name: "Melvin Antan Djaya",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "akhil",
            password: "thhk2026",
            name: "M. Akhil Fadillah",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "nathasya",
            password: "thhk2026",
            name: "Nathasya Michelle Lee",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "nicholas",
            password: "thhk2026",
            name: "Nicholas Willson Kasuya",
            className: "8B",
            exam: "indonesia",
        },
        {
            username: "vincentius",
            password: "thhk2026",
            name: "Vincentius Fernandez Suharto",
            className: "8B",
            exam: "indonesia",
        },

        // ---------- SISWA KELAS 7 SMP THHK (10 siswa) ----------
        // Password default semua siswa: thhk2026
        {
            username: "aerilyn",
            password: "thhk2026",
            name: "Aerilyn Felycia Natania Andrian",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "amon",
            password: "thhk2026",
            name: "Amon Micha Wiyanto",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "gabriela",
            password: "thhk2026",
            name: "Gabriela Princessha Christabele",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "griselda",
            password: "thhk2026",
            name: "Griselda Aurelia",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "jadden",
            password: "thhk2026",
            name: "Jadden Nathanael Kang",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "king",
            password: "thhk2026",
            name: "King Joshua Salim",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "lionel",
            password: "thhk2026",
            name: "Lionel Melvin",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "mutiara",
            password: "thhk2026",
            name: "Mutiara Angelina",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "sendi",
            password: "thhk2026",
            name: "Sendi Kurniawan",
            className: "7A",
            exam: "indonesia",
        },
        {
            username: "velove",
            password: "thhk2026",
            name: "Velove Chloe Himawan",
            className: "7A",
            exam: "indonesia",
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