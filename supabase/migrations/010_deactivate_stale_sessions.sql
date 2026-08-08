-- =========================================================
-- MIGRASI 010 - BERSIHKAN BARIS SESI LAMA
-- ---------------------------------------------------------
-- Setiap login membuat satu baris di public.users, dan baris itu
-- hanya menjadi active = false saat pengguna menekan Keluar.
-- Data sebelum perbaikan "satu akun = satu sesi aktif" masih
-- menyimpan sesi menggantung, sehingga Live Monitor menampilkan
-- siswa yang sudah tidak ada atau muncul berkali-kali.
--
-- AMAN DIJALANKAN SAAT UJIAN BERLANGSUNG:
-- baris sesi TERBARU milik setiap akun tidak disentuh, jadi siswa
-- yang sedang mengerjakan tidak terputus. Yang dinonaktifkan hanya
-- sesi lama yang sudah tergantikan oleh login berikutnya.
--
-- Kolom exam_completed tidak diubah, jadi siswa yang memang sudah
-- selesai TETAP terkunci. Membuka kunci hanya lewat tombol Reset
-- di dashboard pengawas.
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

-- 1) Nonaktifkan sesi yang sudah tergantikan login yang lebih baru
UPDATE public.users u
SET active = false
WHERE u.active = true
  AND EXISTS (
      SELECT 1
      FROM public.users baru
      WHERE baru.username = u.username
        AND baru.role = u.role
        AND baru.created_at > u.created_at
  );

-- 2) Nonaktifkan sesi siswa dari hari-hari sebelumnya
--    (sesi ujian tidak pernah berlaku lintas hari)
UPDATE public.users
SET active = false
WHERE role = 'siswa'
  AND active = true
  AND created_at < date_trunc('day', now());

-- Periksa hasil: seharusnya tidak ada username siswa yang muncul
-- lebih dari sekali.
-- SELECT username, count(*) FROM public.users
-- WHERE role = 'siswa' AND active = true
-- GROUP BY username HAVING count(*) > 1;

-- Bila ingin memulai benar-benar dari nol SEBELUM siswa login
-- (perhatian: memutus semua sesi yang sedang berjalan):
-- UPDATE public.users SET active = false WHERE role = 'siswa';
