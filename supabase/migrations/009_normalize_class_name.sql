-- =========================================================
-- MIGRASI 009 - SERAGAMKAN NAMA KELAS MENJADI 7 / 8 / 9
-- ---------------------------------------------------------
-- Sekolah hanya memakai tiga kelas: 7, 8, dan 9. Data lama
-- masih menyimpan nama bersuffix ("9A", "8B", "7A") pada sesi
-- dan presensi yang dibuat sebelum perubahan ini.
--
-- Migrasi memotong suffix huruf sehingga "9A" -> "9".
-- Baris yang sudah benar tidak tersentuh.
--
-- Idempotent: aman dijalankan berulang kali.
-- =========================================================

UPDATE public.users
SET class_name = substring(class_name FROM '^[789]')
WHERE class_name ~ '^[789][A-Za-z]';

UPDATE public.attendance
SET class_name = substring(class_name FROM '^[789]')
WHERE class_name ~ '^[789][A-Za-z]';

-- Periksa hasil: seharusnya hanya mengembalikan 7, 8, 9 (dan NULL).
-- SELECT DISTINCT class_name FROM public.users ORDER BY 1;
-- SELECT DISTINCT class_name FROM public.attendance ORDER BY 1;
