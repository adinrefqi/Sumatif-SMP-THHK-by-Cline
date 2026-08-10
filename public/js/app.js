/* ============================================================
   PORTAL SUMATIF — SMP TUNAS HIDUP HARAPAN KITA
   ------------------------------------------------------------
   Modul utama klien:
   - Login tanpa SSO (siswa & pengawas)
   - Modal wajib (Presensi siswa / Berita Acara pengawas)
   - Gerbang token ujian
   - Penampil PDF aman berbasis Canvas (PDF.js)
   - Tracking aktivitas real-time (buka/tutup PDF, dll)
   - Live Monitor untuk pengawas
   ============================================================ */

/* ------------------------------------------------------------------
   KONSTANTA
   ------------------------------------------------------------------ */
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const PDF_DEFAULT_ZOOM = 140;
const PDF_MOBILE_DEFAULT_ZOOM = 180;
const PDF_MIN_ZOOM = 25;
const PDF_MAX_ZOOM = 400;
const PDF_ZOOM_STEP = 5;
const PDF_VIEW_STATE_PREFIX = "thhk-pdf-view";

const EXAM_LABELS = {
    agama_katolik: "Agama Katolik",
    agama_kristen: "Agama Kristen",
    agama_islam: "Agama Islam",
    agama_buddha: "Agama Buddha",
    agama_konghucu: "Agama Konghucu",
    pancasila: "Pendidikan Pancasila",
    indonesia: "Bahasa Indonesia",
    ipa: "IPA",
    tik: "TIK",
    matematika: "Matematika",
    ips: "IPS",
    inggris: "Bahasa Inggris",
    seni: "Seni Budaya",
    bahasa_jawa: "Bahasa Jawa",
    penjas: "PenJas",
    mandarin: "Bahasa Mandarin",
    bk: "BK",
    native_mandarin: "Native Mandarin",
    coding: "Coding",
};

const EVENT_LABELS = {
    login_siswa: "Login Siswa",
    login_pengawas: "Login Pengawas",
    presensi: "Presensi",
    token_valid: "Token Valid",
    token_gagal: "Token Gagal",
    minta_pdf: "Minta Berkas",
    pdf_dimuat_server: "PDF Terkirim",
    pdf_demo: "PDF Contoh",
    akses_ditolak: "Akses Ditolak",
    pdf_buka: "PDF Dibuka",
    pdf_halaman: "Ganti Halaman",
    pdf_aktif: "Masih Aktif",
    pdf_tutup: "PDF Ditutup",
    berita_acara: "Berita Acara",
    selesai_ujian: "Selesai Ujian",
    aktivitas_mencurigakan: "Aktivitas Mencurigakan",
    token_dibuat: "Token Dibuat",
    token_dihapus: "Token Dihapus",
    reset_ujian: "Reset Ujian",
    // 🚨 Event dari aplikasi Android Exambrowser
    keluar_paksa: "🚨 KELUAR PAKSA",
    floating_app: "🚨 FLOATING DETEKSI",
    back_diblokir: "Back Diblokir",
    keluar_domain: "Coba Keluar Domain",
    kembali_dari_background: "Kembali dari Background",
    headset_dipakai: "Headset Terdeteksi",
    dual_screen: "Dual Screen",
    coba_keluar: "Coba Keluar",
    pin_salah: "PIN Salah",
    ssl_error: "SSL Error",
    navigasi_diblokir: "Navigasi Diblokir",
    blokir_upload: "Upload Diblokir",
    kehilangan_fokus: "Kehilangan Fokus",
    pelanggaran_ditangani: "Pelanggaran Ditangani",
};

const SCREENS = ["screen-login", "screen-monitor", "screen-student"];

function defaultPdfZoom() {
    return window.matchMedia("(max-width: 640px)").matches ? PDF_MOBILE_DEFAULT_ZOOM : PDF_DEFAULT_ZOOM;
}

function pdfViewStateKey() {
    if (!state.session || !state.examKey) return null;
    return [PDF_VIEW_STATE_PREFIX, state.session.name, state.session.className, state.examKey].join(":");
}

function loadPdfViewState(pageCount) {
    try {
        const saved = JSON.parse(localStorage.getItem(pdfViewStateKey()) || "null");
        if (!saved) return 1;
        state.pdfZoom = clampPdfZoom(saved.zoom);
        return Math.min(pageCount, Math.max(1, Number(saved.page) || 1));
    } catch (e) {
        return 1;
    }
}

function savePdfViewState() {
    const key = pdfViewStateKey();
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify({ page: state.pdfPage, zoom: state.pdfZoom }));
    } catch (e) { /* penyimpanan lokal tidak wajib */ }
}

/* ------------------------------------------------------------------
   STATE
   ------------------------------------------------------------------ */
const state = {
    role: null,          // "siswa" | "pengawas"
    session: null,       // data sesi dari server
    examKey: null,       // kunci mapel ujian
    viewerActive: false, // apakah penampil PDF sedang aktif
    finished: false,     // apakah ujian sudah diselesaikan
    pdfDoc: null,        // dokumen PDF.js
    pdfPage: 1,
    pdfZoom: defaultPdfZoom(),
    monitorTimer: null,
    monitorLoading: false,
    siswaList: [],       // data siswa terakhir dari /api/monitor (untuk filter & urut)
    siswaShown: [],      // daftar siswa yang sedang dilihat (dipakai ekspor CSV & cetak)
    keepaliveTimer: null,
    todaySubjects: [],   // jadwal mapel hari ini (dari /api/session)
    completedSubjects: [], // mapel yang sudah diselesaikan siswa (dari /api/session)
    subjectConfirmed: false, // apakah siswa sudah memilih mapel pada sesi ini
    // Untuk deteksi event pelanggaran BARU dari aplikasi Android,
    // lalu tampilkan notifikasi menonjol di dashboard admin/pengawas.
    seenViolationIds: new Set(),
    lastViolationToastMs: 0,
};

/* ------------------------------------------------------------------
   UTILITAS
   ------------------------------------------------------------------ */
function $(id) {
    return document.getElementById(id);
}

function hide(el) {
    if (el) el.hidden = true;
}
function show(el) {
    if (el) el.hidden = false;
}

function showError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
}
function clearError(el) {
    if (el) el.hidden = true;
}

function setBusy(btn, busy) {
    if (!btn) return;
    const text = btn.querySelector(".btn-text");
    const spinner = btn.querySelector(".spinner");
    btn.disabled = busy;
    if (text) text.hidden = busy;
    if (spinner) spinner.hidden = !busy;
}

function examLabel(key) {
    return EXAM_LABELS[key] || (key ? String(key).toUpperCase() : "—");
}

function esc(str) {
    return String(str ?? "")
        .replace(/&/g, "&" + "amp;")
        .replace(/</g, "&" + "lt;")
        .replace(/>/g, "&" + "gt;")
        .replace(/"/g, "&" + "quot;")
        .replace(/'/g, "&#39;");
}

function fmtTime(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return "—";
    return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso) {
    if (!iso) return "—";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        t.hidden = true;
    }, 3400);
}

/* ---------- API helper ---------- */
async function api(path, options = {}) {
    let resp;
    try {
        resp = await fetch(path, {
            method: options.method || "GET",
            headers: options.body ? { "Content-Type": "application/json" } : undefined,
            body: options.body ? JSON.stringify(options.body) : undefined,
            credentials: "same-origin",
        });
        updateConnectionStatus(true);
    } catch (e) {
        updateConnectionStatus(false);
        const err = new Error("Gagal terhubung ke server. Pastikan server backend Node.js berjalan di port 3000.");
        err.status = 0;
        throw err;
    }

    let data = null;
    try {
        data = await resp.json();
    } catch (e) {
        data = null;
    }

    if (!resp.ok) {
        let msg = (data && data.error) || (data && data.message);
        if (!msg) {
            if (resp.status === 404) msg = "Endpoint API tidak ditemukan (404). Pastikan server backend yang tepat sedang berjalan.";
            else if (resp.status === 401) msg = "Sesi Anda telah berakhir. Silakan login ulang.";
            else if (resp.status === 403) msg = "Akses ditolak untuk akun Anda.";
            else if (resp.status === 500) msg = "Terjadi kesalahan internal pada server (500).";
            else msg = "Terjadi kesalahan. Silakan coba lagi.";
        }
        const err = new Error(msg);
        err.status = resp.status;
        err.data = data;
        throw err;
    }
    return data;
}

async function trackEvent(event, detail = "", page = null) {
    try {
        await api("/api/track", { method: "POST", body: { event, detail, page } });
    } catch (e) {
        /* tracking tidak boleh mengganggu alur utama */
    }
}

function sendBeaconTrack(event, detail) {
    try {
        navigator.sendBeacon(
            "/api/track",
            new Blob([JSON.stringify({ event, detail })], { type: "application/json" })
        );
    } catch (e) {
        /* abaikan */
    }
}

/* ---------- Navigasi layar ---------- */
function showScreen(id) {
    SCREENS.forEach((sid) => {
        $(sid).hidden = sid !== id;
    });
    window.scrollTo(0, 0);
}

/* ---------- Modal ---------- */
let lastModalFocus = null;

function openModal(id) {
    const modal = $(id);
    show(modal);
    document.body.style.overflow = "hidden";

    lastModalFocus = document.activeElement;

    // Fokus awal: elemen pertama yang dapat difokus di dalam modal
    const focusable = modal.querySelector(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable) focusable.focus();

    modal.addEventListener("keydown", trapModalFocus);
}

function closeModal(id) {
    const modal = $(id);
    if (!modal) return;
    hide(modal);
    document.body.style.overflow = "";
    modal.removeEventListener("keydown", trapModalFocus);

    if (lastModalFocus && document.contains(lastModalFocus)) {
        lastModalFocus.focus();
        lastModalFocus = null;
    }
}

function trapModalFocus(e) {
    if (e.key !== "Tab") return;
    const modal = e.currentTarget;
    const focusable = Array.from(
        modal.querySelectorAll(
            'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
        )
    ).filter((el) => el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
}

/* ------------------------------------------------------------------
   PENGAMAN PENAMPIL (Exam-Browser Readiness)
   ------------------------------------------------------------------ */
let hiddenTimer = null;

function setupSecurityGuards() {
    // 1. Blokir klik kanan
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (state.viewerActive) {
            trackEvent("aktivitas_mencurigakan", "Klik kanan diblokir");
            showToast("Menu klik kanan tidak tersedia pada soal ujian.");
        }
    });

    // 2. Blokir shortcut pengembang & aksi berbahaya
    document.addEventListener("keydown", (e) => {
        const k = (e.key || "").toUpperCase();

        const blockedDevTools =
            e.key === "F12" ||
            (e.ctrlKey && e.shiftKey && ["I", "J", "C", "K"].includes(k)) ||
            (e.ctrlKey && k === "U") ||
            k === "PRINTSCREEN" ||
            e.key === "PrintScreen";

        if (blockedDevTools) {
            e.preventDefault();
            if (state.viewerActive) {
                trackEvent("aktivitas_mencurigakan", "Shortcut akses pengembang diblokir");
                showToast("Akses perangkat pengembang diblokir.");
            }
            return;
        }

        // Blokir simpan halaman & cetak saat penampil aktif
        if (state.viewerActive && e.ctrlKey && (k === "P" || k === "S")) {
            e.preventDefault();
            trackEvent("aktivitas_mencurigakan", `Shortcut Ctrl+${k} diblokir`);
            showToast("Aksi tersebut tidak diizinkan selama ujian.");
            return;
        }

        // Escape tidak boleh menutup modal wajib (Presensi / Berita Acara)
        if (e.key === "Escape") {
            const blockModal = document.querySelector(".modal-block:not([hidden])");
            if (blockModal) {
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });

    // 3. Blokir salin/tempel/seret saat penampil aktif
    ["copy", "cut", "paste", "dragstart", "drop"].forEach((evt) => {
        document.addEventListener(evt, (e) => {
            if (state.viewerActive) {
                e.preventDefault();
                trackEvent("aktivitas_mencurigakan", `Tindakan ${evt} diblokir`);
            }
        });
    });

    // 4. Deteksi halaman ditinggalkan (unmount / pindah tab)
    document.addEventListener("visibilitychange", () => {
        clearTimeout(hiddenTimer);
        if (document.hidden && state.viewerActive) {
            hiddenTimer = setTimeout(() => {
                sendBeaconTrack("pdf_tutup", "Halaman ditinggalkan (aplikasi tidak aktif)");
            }, 5000);
        }
    });

    // 5. Sesi/halaman ditutup
    window.addEventListener("beforeunload", () => {
        clearTimeout(hiddenTimer);
        if (state.viewerActive) {
            sendBeaconTrack("pdf_tutup", "Halaman/sesi ditutup oleh siswa");
        }
    });
}

/* ------------------------------------------------------------------
   LOGIN
   ------------------------------------------------------------------ */
function selectRole(btn) {
    document.querySelectorAll(".role-btn").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-checked", String(active));
        if (active) b.tabIndex = 0;
        else b.tabIndex = -1;
    });
    $("login-role").value = btn.dataset.role;
    clearError($("login-error"));
}

function setupLoginTabs() {
    const btns = Array.from(document.querySelectorAll(".role-btn"));
    btns.forEach((btn) => {
        btn.addEventListener("click", () => selectRole(btn));

        btn.addEventListener("keydown", (e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const idx = btns.indexOf(btn);
            const next = btns[(idx + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length];
            selectRole(next);
            next.focus();
        });
    });
    // Inisialisasi tabindex radio: hanya yang aktif bisa difokus
    const active = btns.find((b) => b.getAttribute("aria-checked") === "true") || btns[0];
    btns.forEach((b) => {
        b.tabIndex = b === active ? 0 : -1;
    });
}

function resetRoleTabs() {
    const siswaBtn = document.querySelector('.role-btn[data-role="siswa"]');
    if (siswaBtn) siswaBtn.click();
}

function setupPasswordToggle() {
    const toggle = $("toggle-password");
    toggle.addEventListener("click", () => {
        const input = $("login-password");
        const showPw = input.type === "password";
        input.type = showPw ? "text" : "password";
        $("icon-eye").style.display = showPw ? "none" : "";
        $("icon-eye-off").style.display = showPw ? "" : "none";
        toggle.setAttribute("aria-pressed", String(showPw));
        toggle.setAttribute("aria-label", showPw ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
        input.focus();
    });
}

function setupDemoChips() {
    $("demo-chips").addEventListener("click", (e) => {
        const chip = e.target.closest(".chip");
        if (!chip) return;
        const role = chip.dataset.u === "pengawas" ? "pengawas" : "siswa";
        const btn = document.querySelector(`.role-btn[data-role="${role}"]`);
        if (btn) btn.click();
        $("login-username").value = chip.dataset.u;
        $("login-password").value = chip.dataset.p;
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const role = $("login-role").value;
    const username = $("login-username").value.trim();
    const password = $("login-password").value;

    if (!username || !password) {
        showError($("login-error"), "Lengkapi nama pengguna dan kata sandi.");
        return;
    }

    const btn = $("login-submit");
    setBusy(btn, true);
    clearError($("login-error"));

    try {
        const data = await api("/api/login", {
            method: "POST",
            body: { role, username, password },
        });

        if (data.role === "pengawas") {
            state.role = "pengawas";
            state.session = { name: data.name, username: data.username, role: data.role };
            await enterSupervisor();
        } else {
            state.role = "siswa";
            state.session = {
                name: data.name,
                className: data.className,
                exam: data.exam,
                room: data.room,
                examNumber: data.examNumber,
                role: data.role,
            };
            await enterStudent();
        }
    } catch (err) {
        showError($("login-error"), err.message);
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   ALUR PENGAWAS
   ------------------------------------------------------------------ */
async function enterSupervisor() {
    showScreen("screen-monitor");
    $("monitor-who").textContent = `Pengawas: ${state.session.name}`;

    try {
        const s = await api("/api/session");
        state.session = Object.assign(state.session, s);
        state.session.isAdmin = Boolean(s.isAdmin);
    } catch (e) {
        /* abaikan */
    }

    if (!state.session.beritaAcaraDone) {
        openBeritaAcaraModal();
    } else {
        showToast(`Selamat datang kembali, ${state.session.name}`);
    }

    startMonitor();
    loadTokens();

    // Panel khusus admin (izin token pengawas + cek kesiapan soal).
    const adminPanels = document.querySelectorAll(".admin-only");
    if (state.session.isAdmin) {
        adminPanels.forEach((el) => { el.hidden = false; });
        loadIzin();
        loadCekSoal();
    } else {
        adminPanels.forEach((el) => { el.hidden = true; });
    }
}

function openBeritaAcaraModal() {
    $("ba-name").textContent = state.session.name;

    const today = new Date();
    const iso =
        `${today.getFullYear()}-` +
        `${String(today.getMonth() + 1).padStart(2, "0")}-` +
        `${String(today.getDate()).padStart(2, "0")}`;
    $("ba-date").value = iso;

    openModal("modal-berita-acara");
}

async function handleBaSubmit(e) {
    e.preventDefault();

    const room = $("ba-room").value.trim();
    const examDate = $("ba-date").value;
    const examTime = $("ba-time").value;
    const supervisorCount = $("ba-supervisor-count").value;
    const studentCount = $("ba-student-count").value;
    const incidents = $("ba-incidents").value;
    const notes = $("ba-notes").value.trim();

    if (!room || !examDate || !examTime) {
        showError($("ba-error"), "Isi ruang, tanggal, dan waktu ujian.");
        return;
    }
    if (!supervisorCount || Number(supervisorCount) < 1) {
        showError($("ba-error"), "Jumlah pengawas minimal 1.");
        return;
    }
    if (!studentCount || Number(studentCount) < 1) {
        showError($("ba-error"), "Jumlah peserta minimal 1.");
        return;
    }
    if (!$("ba-confirm").checked) {
        showError($("ba-error"), "Centang pernyataan tanggung jawab Berita Acara.");
        return;
    }

    const btn = $("ba-submit");
    setBusy(btn, true);
    clearError($("ba-error"));

    try {
        await api("/api/berita-acara", {
            method: "POST",
            body: { room, examDate, examTime, supervisorCount, studentCount, incidents, notes },
        });
        state.session.beritaAcaraDone = true;
        closeModal("modal-berita-acara");
        showToast("Berita Acara berhasil disubmit. Live Monitor dibuka.");
        await loadMonitor();
        startMonitor();
    } catch (err) {
        showError($("ba-error"), err.message);
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   LIVE MONITOR
   ------------------------------------------------------------------ */
function renderStats(stats = {}) {
    $("stat-siswa-login").textContent = stats.totalSiswaLogin || 0;
    $("stat-siswa-aktif").textContent = stats.totalSiswaAktif || 0;
    $("stat-token").textContent = stats.totalTokenValid || 0;
    $("stat-kejadian").textContent = stats.totalPeristiwa || 0;
}

function statusChip(event) {
    switch (event) {
        case "pdf_buka":
        case "pdf_halaman":
            return '<span class="badge badge-success">Mengerjakan</span>';
        case "pdf_tutup":
            return '<span class="badge badge-danger">Selesai/Keluar</span>';
        case "selesai_ujian":
            return '<span class="badge badge-danger">Selesai</span>';
        case "token_valid":
            return '<span class="badge badge-warn">Token Dipakai</span>';
        case "token_gagal":
            return '<span class="badge badge-danger">Token Gagal</span>';
        case "presensi":
            return '<span class="badge badge-muted">Presensi</span>';
        case "login_siswa":
            return '<span class="badge badge-muted">Login</span>';
        default:
            return `<span class="badge badge-muted">${esc(event || "-")}</span>`;
    }
}

// Isi ulang <select> filter tanpa menghilangkan pilihan pengawas saat polling.
function syncFilterOptions(el, values, allLabel) {
    const keep = el.value;
    const opts = [...new Set(values.filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "id", { numeric: true })
    );
    el.innerHTML =
        `<option value="">${allLabel}</option>` +
        opts.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("");
    el.value = opts.includes(keep) ? keep : "";
}

function renderSiswa(list = []) {
    state.siswaList = list;
    const body = $("monitor-siswa-body");
    const activeCount = list.filter((s) => s.isActive && !s.examCompleted).length;
    $("badge-siswa-aktif").textContent = String(activeCount);

    const selRuang = $("siswa-filter-ruang");
    const selKelas = $("siswa-filter-kelas");
    syncFilterOptions(selRuang, list.map((s) => s.room), "Semua Ruang");
    syncFilterOptions(selKelas, list.map((s) => s.className), "Semua Kelas");

    const q = ($("siswa-search").value || "").trim().toLowerCase();
    const shown = list
        .filter(
            (s) =>
                (!selRuang.value || s.room === selRuang.value) &&
                (!selKelas.value || s.className === selKelas.value) &&
                (!q || String(s.name || "").toLowerCase().includes(q))
        )
        // Urut: ruang → kelas → nomor ujian / nama
        .sort((a, b) =>
            String(a.room || "").localeCompare(String(b.room || ""), "id", { numeric: true }) ||
            String(a.className || "").localeCompare(String(b.className || ""), "id", { numeric: true }) ||
            String(a.examNumber || a.name || "").localeCompare(String(b.examNumber || b.name || ""), "id", { numeric: true })
        );

    // Daftar yang sedang dilihat dipakai ekspor CSV & cetak (mengikuti filter aktif).
    state.siswaShown = shown;

    $("siswa-filter-count").textContent = list.length
        ? `${shown.length} dari ${list.length} siswa`
        : "";

    if (!shown.length) {
        body.innerHTML = `<tr class="empty-row"><td colspan="10">${list.length ? "Tidak ada siswa yang cocok dengan filter." : "Belum ada siswa yang masuk."
            }</td></tr>`;
        return;
    }

    body.innerHTML = shown
        .map((s) => {
            const attendance = s.attendance
                ? '<span class="badge badge-success">Hadir</span>'
                : '<span class="badge badge-warn">Belum</span>';

            // Status terakhir yang jujur: belum login > selesai > tidak aktif > peristiwa terakhir
            let status;
            if (!s.sessionId) {
                status = '<span class="badge badge-muted">Belum hadir</span>';
            } else if (s.examCompleted) {
                status = '<span class="badge badge-danger">Selesai</span>';
            } else if (!s.isActive) {
                status = '<span class="badge badge-muted">Tidak aktif</span>';
            } else {
                status = statusChip(s.lastEvent);
            }

            // Waktu dibuat satu kolom saja agar tabel tidak melebar terlalu jauh.
            const jam = (t) => (t ? fmtTime(t) : "—");

            return `
                <tr>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td>${esc(s.examNumber || "-")}</td>
                    <td>${esc(s.className || "—")}</td>
                    <td>${esc(s.room || "-")}</td>
                    <td>${esc(examLabel(s.exam))}</td>
                    <td>${attendance}</td>
                    <td class="waktu-sel">
                        <div>Masuk ${jam(s.loginAt)}</div>
                        <div>Hadir ${jam(s.presensiAt)}</div>
                        <div>Selesai ${jam(s.selesaiAt)}</div>
                    </td>
                    <td>${status}</td>
                    <td>
                        ${fmtTime(s.lastAt)}
                        <div class="baris-sub">${s.halaman ? `Hal. ${esc(s.halaman)} · ` : ""}${esc(s.lastDetail || "")}</div>
                    </td>
                    <td>${s.examCompleted && s.username && state.session?.isAdmin
                    ? `<button type="button" class="btn btn-outline btn-xs" data-reset="${esc(s.username)}">Reset</button>`
                    : '<span class="token-sub">—</span>'
                }</td>
                </tr>`;
        })
        .join("");

    body.querySelectorAll("[data-reset]").forEach((btn) => {
        btn.addEventListener("click", () => handleResetSiswa(btn.dataset.reset, btn));
    });
}

/* Buka kembali ujian siswa yang sudah selesai/keluar (pengawas & admin). */
async function handleResetSiswa(username, btn) {
    const row = state.siswaList.find((s) => s.username === username);
    const nama = row ? row.name : username;
    if (!confirm(`Buka kembali ujian untuk ${nama}?\n\nSiswa dapat login dan mengerjakan soal lagi.`)) return;

    setBusy(btn, true);
    try {
        await api("/api/reset-siswa", { method: "POST", body: { username } });
        showToast(`Ujian ${nama} dibuka kembali.`);
        await loadMonitor();
    } catch (err) {
        showToast(err.message || "Gagal mereset ujian siswa.");
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   REKAP CSV & CETAK DAFTAR HADIR
   ------------------------------------------------------------------ */
/* Satu sel CSV. Selalu dikutip, dan nilai yang diawali =+-@ diberi kutip
 * tunggal supaya Excel tidak menjalankannya sebagai rumus. */
function sel(v) {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = "'" + t;
    return `"${t.replace(/"/g, '""')}"`;
}

function jamCsv(t) {
    return t ? fmtTime(t).replace("—", "") : "";
}

/* Unduh rekap mengikuti daftar siswa yang sedang dilihat (state.siswaShown).
 * Kolom: No. Ujian, Nama, Kelas, Ruang, Mapel, Presensi, Jam Login, Jam Presensi,
 * Jam Selesai, Halaman, Status. */
function unduhRekapCsv() {
    const daftar = state.siswaShown || [];
    if (!daftar.length) {
        showToast("Tidak ada data untuk diunduh.");
        return;
    }

    const baris = [
        [
            "No. Ujian", "Nama", "Kelas", "Ruang", "Mapel",
            "Presensi", "Jam Login", "Jam Presensi", "Jam Selesai", "Halaman", "Status",
        ],
        ...daftar.map((s) => [
            s.examNumber || "",
            s.name || "",
            s.className || "",
            s.room || "",
            examLabel(s.exam),
            s.attendance ? "Hadir" : "Belum",
            jamCsv(s.loginAt),
            jamCsv(s.presensiAt),
            jamCsv(s.selesaiAt),
            s.halaman || "",
            (() => {
                if (!s.sessionId) return "Belum hadir";
                if (s.examCompleted) return "Selesai";
                if (!s.isActive) return "Tidak aktif";
                return eventLabel(s.lastEvent);
            })(),
        ]),
    ];

    // BOM agar Excel membaca nama beraksen dengan benar.
    const csv = "\uFEFF" + baris.map((r) => r.map(sel).join(",")).join("\r\n");
    const nama = `presensi-${new Date().toISOString().slice(0, 10)}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nama;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Rekap CSV diunduh.");
}

/* ------------------------------------------------------------------
   CETAK DAFTAR HADIR (Lembar khusus per ruang)
   ------------------------------------------------------------------ */
/* "2026-08-09" → "9 Agustus 2026". Dipecah manual, bukan new Date(str),
 * supaya tanggalnya tidak bergeser sehari akibat penguraian sebagai UTC. */
function tanggalPanjang(v) {
    if (!v) return "";
    const [y, m, d] = String(v).split("-").map(Number);
    if (!y || !m || !d) return v;
    return new Date(y, m - 1, d).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

/* Rakit satu lembar daftar hadir untuk satu ruang. */
function lembarHadir(ruang, peserta, opsi) {
    const baris = peserta
        .slice()
        // Urutan baris: nomor ujian menaik (nomor urut ujian, bukan abjad).
        .sort((a, b) => String(a.examNumber || "").localeCompare(String(b.examNumber || ""), "id", { numeric: true }))
        .map((s, i) => `
                <tr>
                    <td>${i + 1}</td>
                    <td>${esc(s.examNumber || "-")}</td>
                    <td>${esc(s.name || "")}</td>
                    <td>${esc(s.className || "")}</td>
                    <td class="tanda-tangan">${s.signature
                ? `<img class="ttd-img" src="${esc(s.signature)}" alt="Tanda tangan ${esc(s.name || "")}" />`
                : ""
            }</td>
                </tr>`)
        .join("");

    return `
        <div class="lembar">
            <div class="lembar-kop">
                <img src="logo.png" alt="" />
                <div>
                    <h1>SMP TUNAS HIDUP HARAPAN KITA</h1>
                    <p>Yayasan Tri Dharma — Penilaian Sumatif Akhir Semester</p>
                </div>
            </div>
            <h2>DAFTAR HADIR PESERTA PENILAIAN SUMATIF</h2>
            <div class="lembar-info">
                <div><span>Ruang:</span> ${esc(ruang)}</div>
                <div><span>Mata Pelajaran:</span> ${esc(opsi.mapel || "")}</div>
                <div><span>Tanggal:</span> ${esc(tanggalPanjang(opsi.tanggal))}</div>
                <div><span>Waktu:</span> ${esc(opsi.waktu || "")}</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>No</th>
                        <th>No. Ujian</th>
                        <th>Nama</th>
                        <th>Kelas</th>
                        <th>Tanda Tangan</th>
                    </tr>
                </thead>
                <tbody>${baris}</tbody>
            </table>
            <div class="lembar-kaki">
                <div>Jumlah peserta: ${peserta.length}</div>
                <div class="lembar-ttd">
                    <div>Pengawas,</div>
                    <div class="garis"></div>
                    <div>${esc(opsi.pengawas || "")}</div>
                    <div>Tanggal: ${esc(tanggalPanjang(opsi.tanggal))}</div>
                </div>
            </div>
        </div>`;
}

/* Isi pilihan Ruang pada modal cetak dari data terbaru.
 * Pola sama dengan syncFilterOptions — tidak menulis daftar ruang secara keras. */
function populateCetakRuang() {
    const select = $("cetak-ruang");
    const rooms = [...new Set(state.siswaList.map((s) => s.room).filter(Boolean))].sort((a, b) =>
        String(a).localeCompare(String(b), "id", { numeric: true })
    );
    select.innerHTML =
        `<option value="">Semua Ruang</option>` +
        rooms.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
}

/* Buka modal cetak: isi pilihan ruang dan nilai default dari sesi. */
function bukaModalCetak() {
    populateCetakRuang();
    const today = new Date();
    $("cetak-tanggal").value =
        `${today.getFullYear()}-` +
        `${String(today.getMonth() + 1).padStart(2, "0")}-` +
        `${String(today.getDate()).padStart(2, "0")}`;
    $("cetak-pengawas").value = state.session?.name || "";
    openModal("modal-cetak");
}

/* Kumpulkan peserta per ruang sesuai pilihan modal, rakit lembarnya, lalu cetak. */
function cetakDaftarHadir(e) {
    e.preventDefault();
    const btn = $("cetak-submit");
    setBusy(btn, true);

    const ruang = $("cetak-ruang").value;
    const opsi = {
        mapel: $("cetak-mapel").value.trim(),
        tanggal: $("cetak-tanggal").value,
        waktu: $("cetak-waktu").value.trim(),
        pengawas: $("cetak-pengawas").value.trim() || state.session?.name || "",
    };

    // Sumber data state.siswaList, bukan siswaShown — cetak administrasi tidak
    // boleh ikut terpengaruh kotak pencarian yang kebetulan terisi di dashboard.
    const sumber = state.siswaList || [];

    // Kelompokkan peserta per ruang; peserta tanpa ruang dikumpulkan ke
    // "Tanpa Ruang" supaya data yang perlu dibetulkan tidak hilang diam-diam.
    const perRuang = new Map();
    for (const s of sumber) {
        const r = s.room || "Tanpa Ruang";
        if (!perRuang.has(r)) perRuang.set(r, []);
        perRuang.get(r).push(s);
    }

    const rooms = ruang
        ? [ruang]
        : [...perRuang.keys()].sort((a, b) =>
            String(a).localeCompare(String(b), "id", { numeric: true })
        );

    // Ruang tanpa peserta tidak menghasilkan lembar.
    const lembar = rooms
        .filter((r) => (perRuang.get(r) || []).length > 0)
        .map((r) => lembarHadir(r, perRuang.get(r), opsi))
        .join("");

    if (!lembar) {
        showToast("Tidak ada peserta untuk ruang yang dipilih.");
        setBusy(btn, false);
        return;
    }

    // Polling dimatikan supaya isi tidak berubah saat dialog cetak terbuka.
    clearInterval(state.monitorTimer);
    $("lembar-cetak").innerHTML = lembar;
    document.body.classList.add("cetak-lembar");
    closeModal("modal-cetak");
    window.print();
    // onafterprint tidak dipanggil konsisten di semua browser, jadi pakai timer.
    setTimeout(() => {
        document.body.classList.remove("cetak-lembar");
        $("lembar-cetak").innerHTML = "";
        // Tombol harus pulih, kalau tidak cetakan kedua mustahil sampai halaman di-reload.
        setBusy(btn, false);
        startMonitor();
    }, 800);
}

function eventDotClass(event) {
    const map = {
        pdf_buka: "event-pdf_buka",
        pdf_tutup: "event-pdf_tutup",
        presensi: "event-presensi",
        token_valid: "event-token_valid",
        token_gagal: "event-token_gagal",
        akses_ditolak: "event-akses_ditolak",
    };
    return map[event] || "default";
}

function eventLabel(event) {
    return EVENT_LABELS[event] || String(event || "").replace(/_/g, " ");
}

function renderLog(kejadian = []) {
    const list = $("monitor-log");
    $("badge-kejadian").textContent = String(kejadian.length);

    if (!kejadian.length) {
        list.innerHTML = '<div class="log-empty">Belum ada aktivitas.</div>';
        return;
    }

    list.innerHTML = kejadian
        .map((k) => {
            return `
                <div class="log-item">
                    <span class="log-dot ${eventDotClass(k.event)}"></span>
                    <div class="log-body">
                        <div class="log-title">
                            <strong>${esc(k.name || "—")}</strong>
                            <span>·</span>
                            <span>${esc(eventLabel(k.event))}</span>
                        </div>
                        <div class="log-detail">${esc(k.detail || "")}</div>
                    </div>
                    <span class="log-time">${fmtTime(k.at)}</span>
                </div>`;
        })
        .join("");
}

// 🚨 Event dari aplikasi Android yang dianggap pelanggaran serius
// dan harus memunculkan notifikasi menonjol di dashboard admin/pengawas.
const VIOLATION_EVENTS = new Set([
    "keluar_paksa",
    "floating_app",
    "dual_screen",
    "headset_dipakai",
    "keluar_domain",
    "navigasi_diblokir",
    "blokir_upload",
    "pin_salah",
    "back_diblokir",
]);

/* Kunci unik satu pelanggaran. Bentuknya sama dengan yang dipakai
 * checkForViolationAlerts agar kedua fitur tidak berbeda pendapat
 * soal "kejadian yang sama". */
function violationKey(k) {
    return `${k.sessionId || ""}:${k.event}:${k.at}`;
}

function renderPelanggaran(kejadian = []) {
    const container = $("monitor-pelanggaran");
    if (!container) return;

    // Saring hanya event pelanggaran serius (dari aplikasi Android).
    const pelanggaran = kejadian.filter((k) => VIOLATION_EVENTS.has(k.event));
    // Tanda "ditangani" disimpan sebagai event tracking pelanggaran_ditangani
    // dengan `detail` = kunci pelanggaran yang dimaksud.
    const ditangani = new Set(
        kejadian
            .filter((k) => k.event === "pelanggaran_ditangani")
            .map((k) => k.detail)
            .filter(Boolean)
    );

    const belum = pelanggaran.filter((k) => !ditangani.has(violationKey(k))).length;
    $("badge-pelanggaran").textContent = String(belum);

    if (!pelanggaran.length) {
        container.innerHTML = '<div class="log-empty">Tidak ada pelanggaran hari ini.</div>';
        return;
    }

    container.innerHTML = pelanggaran
        .map((k) => {
            const key = violationKey(k);
            const sudah = ditangani.has(key);
            const aksi = sudah
                ? '<span class="badge badge-success">Ditangani</span>'
                : `<button type="button" class="btn btn-outline btn-xs no-print" data-tangani="${esc(key)}">Tandai Ditangani</button>`;
            return `
                <div class="log-item">
                    <span class="log-dot ${eventDotClass(k.event)}"></span>
                    <div class="log-body">
                        <div class="log-title">
                            <strong>${esc(k.name || "—")}</strong>
                            <span>·</span>
                            <span>${esc(eventLabel(k.event))}</span>
                        </div>
                        <div class="log-detail">${esc(k.detail || "")}</div>
                    </div>
                    <div class="log-aksi">${aksi}</div>
                    <span class="log-time">${fmtTime(k.at)}</span>
                </div>`;
        })
        .join("");

    // Wiring tombol "Tandai Ditangani" memakai pola yang sama dengan reset siswa.
    container.querySelectorAll("[data-tangani]").forEach((btn) => {
        btn.addEventListener("click", () => handlePelanggaranDitangani(btn.dataset.tangani, btn));
    });
}

/* Tandai pelanggaran sudah ditangani oleh pengawas (tercatat di riwayat). */
async function handlePelanggaranDitangani(key, btn) {
    setBusy(btn, true);
    try {
        await api("/api/pelanggaran-ditangani", { method: "POST", body: { key } });
        showToast("Pelanggaran ditandai sudah ditangani.");
        await loadMonitor();
    } catch (err) {
        showToast(err.message || "Gagal menandai pelanggaran.");
    } finally {
        setBusy(btn, false);
    }
}

/**
 * Deteksi event pelanggaran BARU dari aplikasi Android lalu tampilkan
 * notifikasi menonjol (alert merah) di Live Monitor admin/pengawas.
 */
function checkForViolationAlerts(kejadian = []) {
    for (const k of kejadian) {
        if (!VIOLATION_EVENTS.has(k.event)) continue;
        // Identitas unik untuk mencegah notifikasi berulang.
        const id = `${k.sessionId || k.id || ""}:${k.event}:${k.at}`;
        if (state.seenViolationIds.has(id)) continue;
        state.seenViolationIds.add(id);

        // Batasi notifikasi maksimal 1 per 2 detik agar tidak spam.
        const now = Date.now();
        if (now - state.lastViolationToastMs < 2000) continue;
        state.lastViolationToastMs = now;

        const student = esc(k.name || "Siswa");
        const label = esc(eventLabel(k.event));
        showToast(`🚨 ${student} — ${label}`);
    }
}

function renderBeritaAcara(list = []) {
    const body = $("monitor-ba-body");
    $("badge-ba").textContent = String(list.length);

    if (!list.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="8">Belum ada Berita Acara yang disubmit.</td></tr>';
        return;
    }

    body.innerHTML = list
        .map((ba) => {
            return `
                <tr>
                    <td>${fmtTime(ba.submittedAt)}</td>
                    <td>${esc(ba.supervisorName)}</td>
                    <td>${esc(ba.room)}</td>
                    <td>${esc(formatDate(ba.examDate))}</td>
                    <td>${esc(ba.examTime || "—")}</td>
                    <td>${ba.supervisorCount} / ${ba.studentCount}</td>
                    <td>${esc(ba.incidents || "—")}</td>
                    <td>${esc(ba.notes || "-")}</td>
                </tr>`;
        })
        .join("");
}

/* Panel "Jadwal Ujian Hari Ini" di Live Monitor (hanya-baca, global). */
function renderJadwal(jadwal = []) {
    const container = $("jadwal-hari-ini");
    if (!container) return;

    if (!jadwal.length) {
        container.innerHTML = '<div class="log-empty">Belum ada jadwal untuk hari ini.</div>';
        return;
    }

    container.innerHTML = jadwal
        .map((j) => {
            const jam =
                j.jamMulai || j.jamSelesai
                    ? `${esc(j.jamMulai || "…")} – ${esc(j.jamSelesai || "…")}`
                    : "jam tidak diisi";
            return `
                <div class="log-item">
                    <span class="log-dot event-presensi"></span>
                    <div class="log-body">
                        <div class="log-title"><strong>${esc(j.title)}</strong></div>
                        <div class="log-detail">${esc(jam)}</div>
                    </div>
                </div>`;
        })
        .join("");
}

function setMonitorFreshness(live) {
    const pill = $("live-pill");
    if (!pill) return;

    if (live) {
        pill.classList.remove("stale");
        const text = $("live-pill-text");
        if (text) text.textContent = "Real-time";
        const fresh = $("monitor-fresh");
        if (fresh) fresh.textContent = `Terakhir ${fmtTime(new Date())}`;
    } else {
        pill.classList.add("stale");
        const text = $("live-pill-text");
        if (text) text.textContent = "Menunggu koneksi…";
    }
}

async function loadMonitor() {
    if (state.monitorLoading) return; // hindari tumpukan request
    state.monitorLoading = true;
    try {
        const data = await api("/api/monitor");
        renderStats(data.stats);
        renderJadwal(data.jadwal);
        renderSiswa(data.siswa);
        renderLog(data.kejadian);
        renderPelanggaran(data.kejadian);
        renderBeritaAcara(data.beritaAcara);
        // 🚨 Notifikasi pelanggaran dari aplikasi Android di dashboard
        checkForViolationAlerts(data.kejadian);
        setMonitorFreshness(true);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            clearInterval(state.monitorTimer);
            showToast("Sesi Anda berakhir. Silakan login ulang.");
            showScreen("screen-login");
        } else {
            // Gagal jaringan/server: tandai pill sebagai stale
            setMonitorFreshness(false);
        }
    } finally {
        state.monitorLoading = false;
    }
}

function startMonitor() {
    clearInterval(state.monitorTimer);
    // Muat segera, lalu poll tiap 4 detik
    loadMonitor();
    state.monitorTimer = setInterval(loadMonitor, 4000);
}

/* ------------------------------------------------------------------
   KELOLA TOKEN UJIAN (PENGAWAS)
   ------------------------------------------------------------------ */
async function loadTokens() {
    try {
        const data = await api("/api/tokens");
        renderTokens(data.groups || []);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            showToast("Sesi Anda berakhir. Silakan login ulang.");
            showScreen("screen-login");
        }
    }
}

function populateTokenExamSelect() {
    const select = $("token-create-exam");
    if (!select) return;
    if (select.options.length > 1) return; // sudah terisi

    Object.entries(EXAM_LABELS).forEach(([key, label]) => {
        const opt = document.createElement("option");
        opt.value = key;
        opt.textContent = label;
        select.appendChild(opt);
    });
}

function renderTokens(groups = []) {
    const container = $("token-list");
    if (!container) return;

    let total = 0;
    groups.forEach((g) => { total += g.tokens.length; });
    const badge = $("badge-token");
    if (badge) badge.textContent = String(total);

    // Mapel tanpa token tidak perlu kartu kosong — daftar jadi jauh lebih ringkas.
    const filled = groups.filter((g) => g.tokens.length);

    if (!filled.length) {
        container.innerHTML = '<div class="log-empty">Belum ada token. Buat token di atas.</div>';
        return;
    }

    const html = filled
        .map((group) => {
            const items = group.tokens
                .map((t) => {
                    const usedBadge = t.uses > 0
                        ? `<span class="badge badge-warn">${t.uses}×</span>`
                        : '<span class="badge badge-muted">Belum</span>';
                    return `
                            <div class="token-item">
                                <button type="button" class="token-code" data-token="${esc(t.token)}"
                                    title="Salin ${esc(t.token)}">${esc(t.token)}
                                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                                <div class="token-meta">
                                    <div class="token-label">${esc(t.label || t.examTitle)}</div>
                                    <div class="token-sub">${esc(t.createdBy || "pengawas")} • ${fmtTime(t.createdAt)}</div>
                                </div>
                                ${usedBadge}
                                ${state.session?.isAdmin
                            ? `<button type="button" class="btn btn-danger btn-xs" data-del="${esc(t.token)}"
                                        title="Hapus token ${esc(t.token)}" aria-label="Hapus token ${esc(t.token)}">&times;</button>`
                            : ""
                        }
                            </div>`;
                })
                .join("");

            return `
                <div class="token-group">
                    <div class="token-group-head">
                        <strong>${esc(group.examTitle)}</strong>
                        <span class="panel-badge">${group.tokens.length}</span>
                    </div>
                    ${items}
                </div>`;
        })
        .join("");

    container.innerHTML = html;

    // Event: salin kode token
    container.querySelectorAll(".token-code").forEach((btn) => {
        btn.addEventListener("click", async () => {
            const code = btn.dataset.token;
            try {
                await navigator.clipboard.writeText(code);
                showToast(`Token ${code} disalin.`);
            } catch (e) {
                showToast(`Token: ${code}`);
            }
        });
    });

    // Event: hapus token
    container.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => handleTokenDelete(btn.dataset.del, btn));
    });
}

async function handleTokenCreate(e) {
    e.preventDefault();

    const examKey = $("token-create-exam").value;
    const label = $("token-create-label").value.trim();
    const btn = $("token-create-submit");

    if (!examKey) {
        showError($("token-create-error"), "Pilih mata pelajaran terlebih dahulu.");
        return;
    }

    setBusy(btn, true);
    clearError($("token-create-error"));

    try {
        const data = await api("/api/tokens", {
            method: "POST",
            body: { examKey, label },
        });
        showToast(`Token ${data.token.token} berhasil dibuat.`);
        $("token-create-label").value = "";
        await loadTokens();
        await loadMonitor();
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            showToast("Sesi Anda berakhir. Silakan login ulang.");
            showScreen("screen-login");
            return;
        }
        showError($("token-create-error"), err.message);
    } finally {
        setBusy(btn, false);
    }
}

async function handleTokenDelete(token, btn) {
    if (!window.confirm(`Hapus token ${token}? Siswa yang sudah masuk tetap dapat mengerjakan, tetapi token tidak bisa dipakai lagi.`)) {
        return;
    }

    setBusy(btn, true);
    try {
        await api(`/api/tokens/${encodeURIComponent(token)}`, { method: "DELETE" });
        showToast(`Token ${token} dihapus.`);
        await loadTokens();
        await loadMonitor();
    } catch (err) {
        showToast(err.message || "Gagal menghapus token.");
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   KHUSUS ADMIN: IZIN TOKEN PENGAWAS
   ------------------------------------------------------------------ */
async function loadIzin() {
    const container = $("izin-matrix");
    if (!container) return;
    // Jangan pernah menggantung di "Memuat izin…" — selalu ada hasil.
    container.innerHTML = '<tr class="empty-row"><td colspan="2">Memuat izin…</td></tr>';
    try {
        const data = await api("/api/izin");
        renderIzinMatrix(data);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            showToast("Sesi Anda berakhir. Silakan login ulang.");
            showScreen("screen-login");
            return;
        }
        container.innerHTML =
            '<tr class="empty-row"><td colspan="2" class="matrix-error">' +
            "Gagal memuat izin. Pastikan tabel <code>token_izin</code> sudah dibuat " +
            "(jalankan migrasi 013 di Supabase). " +
            `<button type="button" class="btn btn-outline btn-xs" data-muat-izin="1">Coba lagi</button>` +
            "</td></tr>";
        container.querySelector("[data-muat-izin]")?.addEventListener("click", loadIzin);
    }
}

function renderIzinMatrix(data) {
    const body = $("izin-matrix");
    const pengawas = (data.pengawas || []).filter((p) => !p.isAdmin);
    if (!pengawas.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="2">Tidak ada pengawas non-admin.</td></tr>';
        return;
    }

    body.innerHTML = pengawas
        .map((p) => {
            const roomTag = p.room
                ? `<span class="matrix-room-tag">${esc(p.room)}</span>`
                : "";
            const checks = (data.examKeys || [])
                .map((key) => {
                    const checked = data.allowed?.[p.username]?.[key] ? "checked" : "";
                    const label = data.examKeys.length > 12 ? key : examLabel(key);
                    return `<label class="matrix-cell" title="${esc(examLabel(key))}">
                                <input type="checkbox" data-username="${esc(p.username)}" data-exam="${esc(key)}" ${checked} />
                                <span class="matrix-exam">${esc(label)}</span>
                            </label>`;
                })
                .join("");
            return `<tr><td class="matrix-user"><strong>${esc(p.name)}</strong>${roomTag}</td><td class="matrix-checks">${checks}</td></tr>`;
        })
        .join("");
}

async function handleIzinToggle(evt) {
    const input = evt.target;
    if (!input.dataset.username || !input.dataset.exam) return;
    try {
        await api("/api/izin", {
            method: "POST",
            body: { username: input.dataset.username, examKey: input.dataset.exam, allowed: input.checked },
        });
        showToast(`Izin ${input.checked ? "diberikan" : "dicabut"} untuk ${examLabel(input.dataset.exam)}.`);
    } catch (err) {
        showToast(err.message || "Gagal menyimpan izin.");
        input.checked = !input.checked; // kembalikan
    }
}

/* ------------------------------------------------------------------
   KHUSUS ADMIN: CEK KESIAPAN SOAL
   ------------------------------------------------------------------ */
async function loadCekSoal() {
    const result = $("cek-soal-result");
    if (!result) return;
    const btn = $("cek-soal-btn");
    try {
        setBusy(btn, true);
        const data = await api("/api/cek-soal");
        renderCekSoal(data.results || [], false);
    } catch (err) {
        if (result) result.innerHTML = `<div class="log-empty">Gagal memuat status soal: ${esc(err.message)}</div>`;
    } finally {
        setBusy(btn, false);
    }
}

/* renderDaftarMapel: tampilkan daftar mapel + badge per level + tombol uji.
 * Jika byLevel diisi (hasil uji), tampilkan status per level; jika tidak,
 * tampilkan status instan (TERSEDIA/BELUM) dari /api/cek-soal. */
function renderCekSoal(results, isDetail) {
    const result = $("cek-soal-result");
    if (!result) return;

    if (!results.length) {
        result.innerHTML = '<div class="log-empty">Tidak ada mapel.</div>';
        return;
    }

    result.innerHTML = results
        .map((r) => {
            const levels = (r.byLevel || [])
                .map((l) => {
                    const cls = l.status === "OK" ? "badge-success" : l.status === "ERROR" ? "badge-danger" : "badge-muted";
                    const size = l.size ? ` · ${Math.round(l.size / 1024)} KB` : "";
                    const lvl = l.level || "default";
                    return `<span class="badge ${cls} cek-level" title="Kelas ${esc(lvl)}">${esc(lvl)}: ${esc(l.status)}${size}</span>`;
                })
                .join(" ");
            return `
                <div class="log-item">
                    <span class="log-dot event-presensi"></span>
                    <div class="log-body">
                        <div class="log-title"><strong>${esc(r.title)}</strong></div>
                        <div class="log-detail">${levels}</div>
                    </div>
                    ${state.session?.isAdmin
                        ? `<button type="button" class="btn btn-outline btn-xs" data-cek="${esc(r.examKey)}">Uji</button>`
                        : ""}
                </div>`;
        })
        .join("");

    // Wiring tombol uji per mapel
    result.querySelectorAll("[data-cek]").forEach((btn) => {
        btn.addEventListener("click", () => runCekSoalMapel(btn.dataset.cek, btn));
    });
}

async function runCekSoalMapel(examKey, btn) {
    setBusy(btn, true);
    try {
        const data = await api(`/api/cek-soal/${encodeURIComponent(examKey)}`);
        // Ganti badge baris ini dengan hasil uji aktual
        renderCekSoalDetail(data);
    } catch (err) {
        showToast(err.message || "Gagal menguji mapel.");
    } finally {
        setBusy(btn, false);
    }
}

function renderCekSoalDetail(data) {
    const result = $("cek-soal-result");
    const levels = (data.byLevel || [])
        .map((l) => {
            const cls = l.status === "OK" ? "badge-success" : l.status === "ERROR" ? "badge-danger" : "badge-muted";
            const size = l.size ? ` · ${Math.round(l.size / 1024)} KB` : "";
            const lvl = l.level || "default";
            return `<span class="badge ${cls} cek-level">${esc(lvl)}: ${esc(l.status)}${size}</span>`;
        })
        .join("");

    // Update baris mapel yang sesuai (cari title)
    const items = result.querySelectorAll(".log-item");
    let updated = false;
    for (const item of items) {
        const title = item.querySelector(".log-title strong");
        if (title && title.textContent === data.title) {
            const detail = item.querySelector(".log-detail");
            if (detail) detail.innerHTML = levels;
            updated = true;
            break;
        }
    }
    if (!updated) {
        // fallback: tampilkan di atas
        const div = document.createElement("div");
        div.className = "log-item";
        div.innerHTML = `<span class="log-dot event-presensi"></span><div class="log-body"><div class="log-title"><strong>${esc(data.title)}</strong></div><div class="log-detail">${levels}</div></div>`;
        result.prepend(div);
    }
}

/* ------------------------------------------------------------------
   ALUR SISWA
   ------------------------------------------------------------------ */
async function enterStudent() {
    showScreen("screen-student");
    renderStudentHead();

    try {
        const s = await api("/api/session");
        state.session = Object.assign(state.session, s);
        state.examKey = s.examKey || s.exam;
        state.todaySubjects = s.todaySubjects || [];
        state.completedSubjects = s.completedSubjects || [];
        state.subjectConfirmed = Boolean(s.subjectConfirmed);
    } catch (e) {
        /* abaikan */
    }

    routeStudentStep();
}

function renderStudentHead() {
    const node = $("tpl-student-head").content.cloneNode(true);
    const head = $("student-head");
    head.replaceChildren(node);

    const label = examLabel(state.session.exam || state.examKey);
    $("stud-name").textContent = state.session.name;
    $("stud-meta").textContent = `${state.session.examNumber || "-"} / ${state.session.className || "-"} / ${state.session.room || "-"} / ${label}`;
    $("stud-subtitle").textContent = `Penilaian Sumatif • ${label}`;

    updateConnectionStatus();
    $("logout-btn-student").addEventListener("click", handleLogout);
    $("logout-fab").addEventListener("click", handleLogout);
}

function routeStudentStep() {
    const s = state.session;

    if (s.examCompleted) {
        state.finished = true;
        state.viewerActive = false;
        renderFinishedOverlay(remainingSubjects());
    } else if (!s.subjectConfirmed) {
        renderSubjectPicker();
    } else if (!s.attendanceDone) {
        renderAttendanceNeeded();
        openPresensiModal();
    } else if (!s.tokenValid) {
        renderTokenGate();
    } else {
        state.examKey = s.examKey || s.exam;
        renderPdfViewer();
    }
}

/* Mapel hari ini yang masih bisa dikerjakan: belum selesai dan bukan
 * mapel yang sedang/sudah dikerjakan pada percobaan ini. */
function remainingSubjects() {
    const done = new Set(state.completedSubjects || []);
    const current = state.session?.examKey || state.examKey;
    return (state.todaySubjects || []).filter(
        (t) => !done.has(t.examKey) && t.examKey !== current
    );
}

/* ---------- Pemilih mapel (ala ANBK) ---------- */
function renderSubjectPicker() {
    const node = $("tpl-subject-picker").content.cloneNode(true);
    $("student-body").replaceChildren(node);

    const done = new Set(state.completedSubjects || []);
    const list = $("subject-list");
    const items = (state.todaySubjects || []).map((t) => {
        const sudah = done.has(t.examKey);
        const jam =
            (t.jamMulai || t.jamSelesai)
                ? `${esc(t.jamMulai || "…")} – ${esc(t.jamSelesai || "…")}`
                : "";
        return `
            <button type="button" class="subject-item" data-exam="${esc(t.examKey)}" ${sudah ? "disabled" : ""}>
                <span class="subject-name">${esc(t.title || examLabel(t.examKey))}</span>
                <span class="subject-meta">${sudah ? "Selesai" : (jam ? esc(jam) : "Tersedia")}</span>
            </button>`;
    }).join("");

    if (!items) {
        $("subject-empty").hidden = false;
    } else {
        list.innerHTML = items;
        list.querySelectorAll(".subject-item").forEach((btn) => {
            btn.addEventListener("click", () => handleSubjectPick(btn.dataset.exam, btn));
        });
    }
}

async function handleSubjectPick(examKey, btn) {
    setBusy(btn, true);
    clearError($("subject-error"));
    try {
        const data = await api("/api/pilih-mapel", { method: "POST", body: { examKey } });
        state.session.exam = data.examKey;
        state.session.examKey = data.examKey;
        state.examKey = data.examKey;
        state.subjectConfirmed = true;
        state.session.subjectConfirmed = true;
        showToast(`Mapel dipilih: ${data.examTitle}`);
        renderStudentHead();
        routeStudentStep();
    } catch (err) {
        showError($("subject-error"), err.message);
        setBusy(btn, false);
    }
}

function renderAttendanceNeeded() {
    const node = $("tpl-attendance-needed").content.cloneNode(true);
    $("student-body").replaceChildren(node);
    $("open-presensi-btn").addEventListener("click", openPresensiModal);
}

/* ---------- Tanda tangan digital ---------- */
const TTD_DRAWING = "_ttd_drawing";
function setupTtdCanvas() {
    const canvas = $("ttd-canvas");
    if (!canvas) return;
    clearTtdCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let drawing = false;
    const pos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const src = e.touches && e.touches[0] ? e.touches[0] : e;
        return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
    };
    const start = (e) => {
        e.preventDefault();
        drawing = true;
        state[TTD_DRAWING] = true;
        const p = pos(e);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#1b2430";
    };
    const move = (e) => {
        if (!drawing) return;
        e.preventDefault();
        const p = pos(e);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    };
    const stop = (e) => {
        if (!drawing) return;
        e.preventDefault();
        drawing = false;
        ctx.beginPath();
    };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", stop);
    canvas.addEventListener("mouseleave", stop);
    canvas.addEventListener("touchstart", start, { passive: false });
    canvas.addEventListener("touchmove", move, { passive: false });
    canvas.addEventListener("touchend", stop);
}

function clearTtdCanvas() {
    const canvas = $("ttd-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    state[TTD_DRAWING] = false;
}

/* Hasilkan data URL PNG tanda tangan; kosong bila belum digambar. */
function ttdDataUrl() {
    const canvas = $("ttd-canvas");
    if (!canvas || !state[TTD_DRAWING]) return "";
    return canvas.toDataURL("image/png");
}

/* ---------- Presensi wajib ---------- */
function openPresensiModal() {
    $("presensi-name").textContent = state.session.name;
    $("presensi-name-2").textContent = state.session.name;
    $("presensi-class").textContent = state.session.className || "—";
    $("presensi-exam").textContent = examLabel(state.session.exam || state.examKey);
    $("presensi-room").value = state.session.room || "";

    setupTtdCanvas();
    openModal("modal-presensi");
    setTimeout(() => $("presensi-room") && $("presensi-room").focus(), 60);
}

async function handlePresensiSubmit(e) {
    e.preventDefault();

    const room = $("presensi-room").value.trim();
    if (!room) {
        showError($("presensi-error"), "Ruang ujian wajib diisi.");
        return;
    }
    if (!$("presensi-confirm").checked) {
        showError($("presensi-error"), "Centang pernyataan kehadiran Anda.");
        return;
    }

    // Tanda tangan digital wajib digambar sebelum presensi dikirim.
    const signature = ttdDataUrl();
    if (!signature) {
        showError($("presensi-error"), "Gambar tanda tangan Anda terlebih dahulu.");
        return;
    }

    const btn = $("presensi-submit");
    setBusy(btn, true);
    clearError($("presensi-error"));

    try {
        await api("/api/presensi", { method: "POST", body: { room, signature } });
        state.session.attendanceDone = true;
        closeModal("modal-presensi");
        showToast(`Presensi berhasil untuk ruang ${esc(room)}.`);
        renderTokenGate();
    } catch (err) {
        showError($("presensi-error"), err.message);
    } finally {
        setBusy(btn, false);
    }
}

/* ---------- Gerbang token ---------- */
function renderTokenGate() {
    const node = $("tpl-token-gate").content.cloneNode(true);
    $("student-body").replaceChildren(node);

    $("token-form").addEventListener("submit", handleTokenSubmit);
    setTimeout(() => $("token-input") && $("token-input").focus(), 60);
}

async function handleTokenSubmit(e) {
    e.preventDefault();

    const token = $("token-input").value.trim();
    if (!token) {
        showError($("token-error"), "Masukkan token ujian.");
        return;
    }

    const btn = $("token-submit");
    setBusy(btn, true);
    clearError($("token-error"));

    try {
        const data = await api("/api/token", { method: "POST", body: { token } });
        state.session.tokenValid = true;
        state.session.examKey = data.examKey;
        state.examKey = data.examKey;
        showToast(`Token valid: ${data.label}`);
        renderPdfViewer();
    } catch (err) {
        showError($("token-error"), err.message);
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   PENAMPIL PDF AMAN (PDF.JS)
   ------------------------------------------------------------------ */
function loadPdfJs() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            configurePdfWorker();
            resolve(window.pdfjsLib);
            return;
        }
        const script = document.createElement("script");
        script.src = PDFJS_CDN;
        script.async = true;
        script.onload = () => {
            configurePdfWorker();
            if (window.pdfjsLib) resolve(window.pdfjsLib);
            else reject(new Error("Komponen penampil tidak ditemukan."));
        };
        script.onerror = () =>
            reject(new Error("Gagal memuat komponen penampil PDF. Periksa koneksi internet."));
        document.head.appendChild(script);
    });
}

function configurePdfWorker() {
    if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    }
}

async function renderPdfViewer() {
    if (state.finished || state.session?.examCompleted) {
        renderFinishedOverlay();
        return;
    }
    if (!state.examKey) {
        showToast("Sesi soal belum tersedia. Silakan login ulang.");
        showScreen("screen-login");
        return;
    }

    state.viewerActive = true;
    state.finished = false;
    state.pdfPage = 1;
    state.pdfZoom = defaultPdfZoom();
    state.pdfDoc = null;
    startKeepalive();

    const label = examLabel(state.examKey);
    $("stud-subtitle").textContent = `Soal: ${label}`;
    $("stud-meta").textContent = `${state.session.examNumber || "-"} / ${state.session.className || "-"} / ${state.session.room || "-"} / Token valid`;

    $("student-body").innerHTML = `
        <div class="viewer-shell">
            <div class="viewer-toolbar">
                <div class="viewer-toolbar-info">
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                    <div>
                        <strong>${esc(label)}</strong>
                        <span>Penilaian Sumatif • SMP Tunas Hidup Harapan Kita</span>
                    </div>
                </div>
                <div class="viewer-controls">
                    <button type="button" class="page-nav" id="prev-page" aria-label="Halaman sebelumnya">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <span class="page-count" id="page-count">1 / –</span>
                    <button type="button" class="page-nav" id="next-page" aria-label="Halaman berikutnya">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                    <button type="button" class="zoom-btn" id="zoom-out" aria-label="Perkecil">−</button>
                    <span class="zoom-label" id="zoom-label">${state.pdfZoom}%</span>
                    <input type="range" class="zoom-range" id="zoom-range" min="${PDF_MIN_ZOOM}" max="${PDF_MAX_ZOOM}" step="${PDF_ZOOM_STEP}" value="${state.pdfZoom}" aria-label="Atur zoom PDF" />
                    <button type="button" class="zoom-btn" id="zoom-in" aria-label="Perbesar">+</button>
                    <button type="button" class="fit-width-btn" id="fit-width" aria-label="Pas Lebar" title="Pas Lebar">?</button>
                    <button type="button" class="fullscreen-btn" id="fullscreen-btn" aria-label="Layar penuh PDF" title="Layar Penuh" aria-pressed="false">
                        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="viewer-window" id="viewer-window">
                <div class="viewer-loader" id="viewer-loader">
                    <div class="loader-ring"></div>
                    <p>Memuat berkas soal secara aman...</p>
                </div>
                <div class="pdf-canvas-wrap" id="pdf-wrap">
                    <canvas id="pdf-canvas"></canvas>
                </div>
            </div>

            <div class="viewer-actions">
                <button type="button" class="btn btn-danger" id="finish-btn">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Selesai Ujian
                </button>
            </div>
            <button type="button" class="fullscreen-exit" id="fullscreen-exit" aria-label="Keluar dari layar penuh" hidden>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 3v4a2 2 0 0 1-2 2H3M15 3v4a2 2 0 0 0 2 2h4M9 21v-4a2 2 0 0 0-2-2H3M15 21v-4a2 2 0 0 1 2-2h4"/>
                </svg>
            </button>
        </div>`;

    $("prev-page").addEventListener("click", () => changePage(-1));
    $("next-page").addEventListener("click", () => changePage(1));
    $("zoom-in").addEventListener("click", () => changeZoom(20));
    $("zoom-out").addEventListener("click", () => changeZoom(-20));
    $("zoom-range").addEventListener("input", (event) => previewPdfZoom(event.target.value));
    $("zoom-range").addEventListener("change", () => renderPage(state.pdfPage));
    $("fit-width").addEventListener("click", fitPdfWidth);
    $("fullscreen-btn").addEventListener("click", () => togglePdfFullscreen(true));
    $("fullscreen-exit").addEventListener("click", () => togglePdfFullscreen(false));
    setupPdfPinchZoom();
    $("finish-btn").addEventListener("click", openFinishModal);

    $("finish-title").textContent = "Selesaikan Ujian?";
    $("finish-desc").textContent =
        "Setelah menekan Selesai, sesi ujian Anda akan ditutup dan pengawas akan melihat bahwa Anda telah selesai. Pastikan Anda telah mengerjakan semua soal.";

    await loadExamPdf();
}

async function loadExamPdf() {
    const loader = $("viewer-loader");
    try {
        await loadPdfJs();

        const resp = await fetch(`/api/pdf/${state.examKey}`, { credentials: "same-origin" });
        if (!resp.ok) {
            let msg = "Gagal memuat berkas soal.";
            try {
                const d = await resp.json();
                if (d && d.error) msg = d.error;
            } catch (e) { /* non-JSON */ }
            throw new Error(msg);
        }

        const data = await resp.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;

        state.pdfDoc = pdf;
        const savedPage = loadPdfViewState(pdf.numPages);
        $("page-count").textContent = `${savedPage} / ${pdf.numPages}`;

        await renderPage(savedPage);

        // TRACK: PDF berhasil dirender di layar siswa
        await trackEvent("pdf_buka", "Berkas soal berhasil dirender di layar");

        if (loader) loader.hidden = true;
    } catch (err) {
        showToast(err.message || "Gagal memuat soal.");
        $("page-count").textContent = "—";
        if (loader) loader.hidden = true;
    }
}

async function renderPage(num) {
    if (!state.pdfDoc) return;

    const page = await state.pdfDoc.getPage(num);
    const canvas = $("pdf-canvas");
    if (!canvas) return;

    const viewport = page.getViewport({ scale: state.pdfZoom / 100 });
    const dpr = state.pdfZoom > 200 ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    canvas.dataset.renderZoom = String(state.pdfZoom);
    canvas.dataset.renderWidth = String(viewport.width);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({ canvasContext: ctx, viewport }).promise;

    state.pdfPage = num;
    updatePdfControls();
    savePdfViewState();

    if (num > 1) {
        await trackEvent("pdf_halaman", `Pindah ke halaman ${num}`, num);
    }
}

function updatePdfControls() {
    if (!state.pdfDoc) return;
    const windowEl = $("viewer-window");
    $("page-count").textContent = `${state.pdfPage} / ${state.pdfDoc.numPages}`;
    $("prev-page").disabled = state.pdfPage <= 1;
    $("next-page").disabled = state.pdfPage >= state.pdfDoc.numPages;
    $("zoom-label").textContent = `${state.pdfZoom}%`;
    $("zoom-range").value = String(state.pdfZoom);

    // Di atas 100%, biarkan canvas melebar sehingga zoom benar-benar terlihat;
    // viewer-window tetap dapat discroll (vertikal & horizontal).
    if (windowEl) {
        windowEl.classList.toggle("zoom-large", state.pdfZoom > 100);
    }
}

async function changePage(delta) {
    if (!state.pdfDoc) return;
    const next = Math.min(Math.max(1, state.pdfPage + delta), state.pdfDoc.numPages);
    if (next === state.pdfPage) return;
    await renderPage(next);
}

async function changeZoom(delta) {
    if (!state.pdfDoc) return;
    state.pdfZoom = clampPdfZoom(state.pdfZoom + delta);
    await renderPage(state.pdfPage);
}

async function fitPdfWidth() {
    if (!state.pdfDoc) return;
    const viewer = $("viewer-window");
    const page = await state.pdfDoc.getPage(state.pdfPage);
    const naturalWidth = page.getViewport({ scale: 1 }).width;
    state.pdfZoom = clampPdfZoom((viewer.clientWidth - 32) / naturalWidth * 100);
    await renderPage(state.pdfPage);
}

function togglePdfFullscreen(enabled) {
    const screen = $("screen-student");
    const button = $("fullscreen-btn");
    const exitButton = $("fullscreen-exit");
    if (!screen) return;

    screen.classList.toggle("pdf-fullscreen", enabled);
    button?.setAttribute("aria-pressed", String(enabled));
    if (exitButton) exitButton.hidden = !enabled;
    document.body.classList.toggle("pdf-fullscreen-open", enabled);
}

function clampPdfZoom(zoom) {
    const numericZoom = Number(zoom);
    if (!Number.isFinite(numericZoom)) return defaultPdfZoom();
    return Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, Math.round(numericZoom / PDF_ZOOM_STEP) * PDF_ZOOM_STEP));
}

function previewPdfZoom(zoom) {
    const canvas = $("pdf-canvas");
    const viewer = $("viewer-window");
    const previousZoom = Number(canvas?.dataset.renderZoom || state.pdfZoom);
    state.pdfZoom = clampPdfZoom(zoom);
    $("zoom-label").textContent = `${state.pdfZoom}%`;
    $("zoom-range").value = String(state.pdfZoom);
    viewer?.classList.toggle("zoom-large", state.pdfZoom > 100);

    if (canvas && previousZoom) {
        const ratio = state.pdfZoom / previousZoom;
        canvas.style.width = `${Math.floor(Number(canvas.dataset.renderWidth) * ratio)}px`;
        canvas.style.height = "auto";
    }
}

function setupPdfPinchZoom() {
    const viewer = $("viewer-window");
    let startDistance = 0;
    let startZoom = state.pdfZoom;
    let startScrollLeft = 0;
    let startScrollTop = 0;
    let focusX = 0;
    let focusY = 0;

    const touchDistance = (touches) => Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
    );

    viewer.addEventListener("touchstart", (event) => {
        if (event.touches.length !== 2 || !state.pdfDoc) return;
        startDistance = touchDistance(event.touches);
        startZoom = state.pdfZoom;
        startScrollLeft = viewer.scrollLeft;
        startScrollTop = viewer.scrollTop;
        const rect = viewer.getBoundingClientRect();
        focusX = (event.touches[0].clientX + event.touches[1].clientX) / 2 - rect.left;
        focusY = (event.touches[0].clientY + event.touches[1].clientY) / 2 - rect.top;
    }, { passive: true });

    viewer.addEventListener("touchmove", (event) => {
        if (event.touches.length !== 2 || !startDistance) return;
        event.preventDefault();
        previewPdfZoom(startZoom * touchDistance(event.touches) / startDistance);
        const ratio = state.pdfZoom / startZoom;
        viewer.scrollLeft = (startScrollLeft + focusX) * ratio - focusX;
        viewer.scrollTop = (startScrollTop + focusY) * ratio - focusY;
    }, { passive: false });

    viewer.addEventListener("touchend", (event) => {
        if (!startDistance || event.touches.length > 1) return;
        startDistance = 0;
        renderPage(state.pdfPage);
    });

    viewer.addEventListener("touchcancel", () => {
        if (!startDistance) return;
        startDistance = 0;
        renderPage(state.pdfPage);
    });
}

/* ---------- Keepalive siswa saat viewer aktif ---------- */
function startKeepalive() {
    clearInterval(state.keepaliveTimer);
    state.keepaliveTimer = setInterval(() => {
        if (state.viewerActive && !state.finished) {
            sendBeaconTrack("pdf_aktif", "Siswa masih aktif di penampil PDF");
        }
    }, 60 * 1000);
}

function stopKeepalive() {
    clearInterval(state.keepaliveTimer);
    state.keepaliveTimer = null;
}

function updateConnectionStatus(online = navigator.onLine) {
    const indicator = $("connection-status");
    if (!indicator) return;
    const connected = online && navigator.onLine;
    indicator.classList.toggle("is-offline", !connected);
    indicator.textContent = connected ? "Online" : "Offline";
}

/* ---------- Selesai ujian ---------- */
function openFinishModal() {
    openModal("modal-finish");
}

function renderFinishedOverlay(remaining = []) {
    // Hapus overlay lama bila sudah ada
    document.querySelectorAll(".finished-overlay").forEach((el) => el.remove());

    const body = $("student-body");
    if (body) body.replaceChildren();

    const sisa = remaining.length
        ? `
            <div class="finished-remaining">
                <strong>Mapel lain hari ini:</strong>
                <span>${remaining.map((t) => esc(t.title || examLabel(t.examKey))).join(" · ")}</span>
                <p class="finished-hint">Keluar, lalu pilih mapel berikutnya untuk melanjutkan.</p>
            </div>`
        : "";

    const overlay = document.createElement("div");
    overlay.className = "finished-overlay";
    overlay.innerHTML = `
        <div class="finished-card">
            <div class="finished-check">
                <svg viewBox="0 0 24 24" width="42" height="42" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
            </div>
            <h2>Terima kasih!</h2>
            <p>Kehadiran Anda telah tercatat dan sesi ujian selesai. Silakan serahkan perangkat kepada pengawas ruang ujian.</p>
            ${sisa}
            <button type="button" class="btn btn-outline btn-block" id="finish-logout">Keluar dari Ujian</button>
        </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector("#finish-logout").addEventListener("click", handleLogout);
}

async function handleFinishConfirm() {
    const btn = $("finish-confirm");
    setBusy(btn, true);

    try {
        // Simpan penyelesaian di server (authoritative, tahan refresh)
        await api("/api/finish", { method: "POST" });

        state.finished = true;
        state.viewerActive = false;
        state.session.examCompleted = true;
        // Mapel ini kini selesai; mapel lain masih bisa dikerjakan.
        const doneKey = state.examKey || state.session.examKey;
        if (doneKey && !state.completedSubjects.includes(doneKey)) {
            state.completedSubjects.push(doneKey);
        }
        stopKeepalive();
        closeModal("modal-finish");
        renderFinishedOverlay(remainingSubjects());
    } catch (err) {
        showToast(err.message || "Gagal menyimpan penyelesaian ujian. Coba lagi.");
    } finally {
        setBusy(btn, false);
    }
}

/* ------------------------------------------------------------------
   LOGOUT & SESSION TEARDOWN
   ------------------------------------------------------------------ */
async function handleLogout() {
    try {
        await api("/api/logout", { method: "POST" });
    } catch (e) { /* abaikan */ }

    teardownSession();
    showScreen("screen-login");
    showToast("Anda telah keluar dari portal.");
}

function teardownSession() {
    togglePdfFullscreen(false);
    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
    stopKeepalive();
    state.role = null;
    state.session = null;
    state.examKey = null;
    state.viewerActive = false;
    state.finished = false;
    state.pdfDoc = null;
    state.pdfPage = 1;
    state.pdfZoom = defaultPdfZoom();

    document.querySelectorAll(".finished-overlay").forEach((el) => el.remove());

    closeModal("modal-finish");
    closeModal("modal-presensi");
    closeModal("modal-berita-acara");

    const form = $("login-form");
    if (form) form.reset();
    resetRoleTabs();
    clearError($("login-error"));
    clearError($("presensi-error"));
    clearError($("ba-error"));
    clearError($("token-error"));
}

/* ------------------------------------------------------------------
   BOOTSTRAP (restore sesi saat halaman dimuat ulang)
   ------------------------------------------------------------------ */
async function bootstrap() {
    try {
        const s = await api("/api/session");
        state.session = s;
        state.role = s.role;

        if (s.role === "pengawas") {
            state.session = { name: s.name, username: s.username, role: s.role, beritaAcaraDone: s.beritaAcaraDone, isAdmin: Boolean(s.isAdmin) };
            await enterSupervisor();
        } else if (s.role === "siswa") {
            state.session = {
                name: s.name,
                className: s.className,
                exam: s.exam,
                room: s.room,
                examNumber: s.examNumber,
                role: s.role,
                attendanceDone: s.attendanceDone,
                tokenValid: s.tokenValid,
                examKey: s.examKey,
                tokenLabel: s.tokenLabel,
                subjectConfirmed: Boolean(s.subjectConfirmed),
                examCompleted: s.examCompleted,
            };
            state.todaySubjects = s.todaySubjects || [];
            state.completedSubjects = s.completedSubjects || [];
            state.subjectConfirmed = Boolean(s.subjectConfirmed);
            await enterStudent();
        } else {
            showScreen("screen-login");
        }
    } catch (err) {
        showScreen("screen-login");
    }
}

/* ------------------------------------------------------------------
   INISIALISASI
   ------------------------------------------------------------------ */
function init() {
    setupLoginTabs();
    setupPasswordToggle();
    setupDemoChips();
    setupSecurityGuards();
    window.addEventListener("online", updateConnectionStatus);
    window.addEventListener("offline", updateConnectionStatus);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") togglePdfFullscreen(false);
    });

    $("login-form").addEventListener("submit", handleLogin);

    $("logout-btn").addEventListener("click", handleLogout);

    for (const id of ["siswa-search", "siswa-filter-ruang", "siswa-filter-kelas"]) {
        $(id).addEventListener("input", () => renderSiswa(state.siswaList));
    }
    $("ttd-ulang").addEventListener("click", clearTtdCanvas);
    $("refresh-monitor").addEventListener("click", async () => {
        await Promise.all([loadMonitor(), loadTokens()]);
        if (!$("live-pill")?.classList.contains("stale")) {
            showToast("Monitor diperbarui.");
        }
    });

    $("btn-unduh-csv").addEventListener("click", unduhRekapCsv);
    $("btn-cetak-hadir").addEventListener("click", bukaModalCetak);
    $("cetak-batal").addEventListener("click", () => closeModal("modal-cetak"));
    $("cetak-form").addEventListener("submit", cetakDaftarHadir);

    $("presensi-form").addEventListener("submit", handlePresensiSubmit);
    $("ba-form").addEventListener("submit", handleBaSubmit);

    populateTokenExamSelect();
    $("token-create-form").addEventListener("submit", handleTokenCreate);

    $("izin-matrix")?.addEventListener("change", handleIzinToggle);
    $("cek-soal-btn")?.addEventListener("click", loadCekSoal);

    $("finish-cancel").addEventListener("click", () => closeModal("modal-finish"));
    $("finish-confirm").addEventListener("click", handleFinishConfirm);

    bootstrap();
}

document.addEventListener("DOMContentLoaded", init);
