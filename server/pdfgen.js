/* =========================================================
 * GENERATOR PDF DEMO - PORTAL SUMATIF SMP THHK
 * ---------------------------------------------------------
 * Menghasilkan PDF soal contoh saat berkas Google Drive
 * belum dikonfigurasi (mode demo). Dipakai juga sebagai
 * fallback bila Google Drive menolak permintaan.
 * ========================================================= */

const PDFDocument = require("pdfkit");

const SOAL_POOL = [
    "Jelaskan makna dari sila pertama Pancasila beserta contoh pengamalannya dalam kehidupan sehari-hari!",
    "Hitunglah nilai dari ekspresi matematika berikut dan tuliskan langkah-langkah pengerjaannya secara lengkap!",
    "Sebutkan dan jelaskan tiga ciri makhluk hidup beserta masing-masing satu contohnya!",
    "Apa yang dimaksud dengan teks persuasi? Tuliskan struktur dan ciri kebahasaannya!",
    "Sebuah segitiga memiliki alas 12 cm dan tinggi 8 cm. Tentukan luas segitiga tersebut!",
    "Jelaskan proses terjadinya fotosintesis beserta faktor-faktor yang memengaruhinya!",
    "Tuliskan contoh kalimat efektif dan tidak efektif, lalu perbaiki kalimat yang tidak efektif tersebut!",
    "Selesaikan persamaan linear berikut: 3x + 7 = 22. Tuliskan langkah penyelesaiannya!",
    "Apa perbedaan antara zat tunggal dan campuran? Berikan masing-masing dua contohnya!",
    "Buatlah sebuah teks deskripsi singkat tentang lingkungan sekolahmu menggunakan kalimat yang padu!",
    "Tentukan keliling dan luas lingkaran dengan jari-jari 14 cm (π = 22/7)!",
    "Jelaskan pengertian energi alternatif dan sebutkan lima contoh sumber energi alternatif!",
];

/**
 * Stream PDF soal demo ke response.
 * @param {object} res - Response Express
 * @param {object} options - { examTitle, studentName, className }
 */
function generateDemoPdf(res, { examTitle, studentName, className }) {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    doc.pipe(res);

    const now = new Date();
    const tgl = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    // ---------- KOP ----------
    doc
        .font("Helvetica-Bold")
        .fontSize(14)
        .text("YAYASAN TUNAS HIDUP HARAPAN KITA", { align: "center" });
    doc
        .font("Helvetica-Bold")
        .fontSize(18)
        .text("SMP TUNAS HIDUP HARAPAN KITA", { align: "center" });
    doc
        .font("Helvetica")
        .fontSize(9)
        .text("Jalan Pendidikan No. 1, Jakarta — Telp. (021) 123-4567", { align: "center" });
    doc.moveDown(0.3);
    doc
        .fontSize(10)
        .text("Email: info@smptunas-harapan.sch.id | Website: www.smptunas-harapan.sch.id", {
            align: "center",
        });

    // Garis kop
    doc.moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#1e3a5f").lineWidth(2).stroke();
    doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#c9a227")
        .lineWidth(1)
        .stroke();
    doc.moveDown(0.6);

    // ---------- JUDUL ----------
    doc
        .font("Helvetica-Bold")
        .fontSize(13)
        .text("PENILAIAN SUMATIF AKHIR SEMESTER", { align: "center" });
    doc
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(examTitle, { align: "center" });
    doc.moveDown(0.4);

    // ---------- INFORMASI ----------
    doc
        .font("Helvetica")
        .fontSize(10)
        .text(`Hari / Tanggal  : ${tgl}`, { continued: false });
    doc.text(`Waktu           : 90 Menit`);
    doc.text(`Kelas           : ${className || "IX (Sembilan)"}`);
    doc.text(`Nama Siswa      : ${studentName || "________________"}`);
    doc.moveDown(0.3);
    doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("PETUNJUK UMUM:", { underline: true });
    doc
        .font("Helvetica")
        .fontSize(9.5)
        .text(
            "1. Berdoalah sebelum mengerjakan soal.\n" +
            "2. Tulislah nama dan kelas pada tempat yang telah disediakan.\n" +
            "3. Bacalah setiap soal dengan teliti sebelum menjawab.\n" +
            "4. Kerjakan dahulu soal yang dianggap mudah.\n" +
            "5. Periksalah kembali pekerjaanmu sebelum dikumpulkan.",
            { lineGap: 2 }
        );
    doc.moveDown(0.5);

    // ---------- BATAS PATOKAN ----------
    doc
        .moveTo(50, doc.y)
        .lineTo(545, doc.y)
        .strokeColor("#999")
        .lineWidth(0.75)
        .stroke();
    doc.moveDown(0.8);

    // ---------- SOAL ----------
    doc.font("Helvetica-Bold").fontSize(11).text("A. SOAL URAIAN", { underline: true });
    doc.moveDown(0.3);

    let index = 1;
    const perPage = 3;
    SOAL_POOL.forEach((soal, i) => {
        if (index > 1 && (index - 1) % perPage === 0) {
            doc.addPage();
            doc.moveDown(0.5);
        }
        doc
            .font("Helvetica-Bold")
            .fontSize(10)
            .text(`${index}. `, { continued: true });
        doc
            .font("Helvetica")
            .fontSize(10)
            .text(soal, { lineGap: 3 });
        doc.moveDown(0.4);
        // Ruang jawaban
        for (let r = 0; r < 5; r++) {
            doc
                .moveTo(70, doc.y + 4)
                .lineTo(525, doc.y + 4)
                .strokeColor("#bbb")
                .lineWidth(0.5)
                .stroke();
            if (r < 4) doc.moveDown(0.55);
        }
        doc.moveDown(0.8);
        index++;
    });

    // ---------- PENUTUP ----------
    doc.moveDown(1);
    doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("— Semoga Sukses —", { align: "center" });
    doc.moveDown(1);
    doc
        .font("Helvetica")
        .fontSize(9)
        .text("Dokumen ini dilindungi oleh Sistem Ujian Sumatif SMP Tunas Hidup Harapan Kita.", {
            align: "center",
        });

    doc.end();
}

module.exports = { generateDemoPdf };