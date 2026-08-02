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

const EXAM_LABELS = {
    agama: "Pendidikan Agama & Budi Pekerti",
    ppkn: "PPKn",
    indonesia: "Bahasa Indonesia",
    matematika: "Matematika",
    ipa: "IPA",
    ips: "IPS",
    inggris: "Bahasa Inggris",
    seni: "Seni Budaya",
    pjok: "PJOK",
    prakarya: "Prakarya",
    informatika: "Informatika",
    mulok_bahasa_daerah: "Muatan Lokal Bahasa Daerah",
    mulok_bahasa_asing: "Muatan Lokal Bahasa Asing",
    pendalaman_agama: "Pendalaman Agama",
    bimbingan_konseling: "Bimbingan Konseling",
    literasi: "Literasi Digital",
    kewirausahaan: "Kewirausahaan",
    matematika_tambahan: "Matematika Tambahan",
    ipa_tambahan: "IPA Tambahan",
    ips_tambahan: "IPS Tambahan",
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
    pdf_tutup: "PDF Ditutup",
    berita_acara: "Berita Acara",
    selesai_ujian: "Selesai Ujian",
    aktivitas_mencurigakan: "Aktivitas Mencurigakan",
    token_dibuat: "Token Dibuat",
    token_dihapus: "Token Dihapus",
};

const SCREENS = ["screen-login", "screen-monitor", "screen-student"];

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
    pdfZoom: 100,
    monitorTimer: null,
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
    el.hidden = true;
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
    } catch (e) {
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
function openModal(id) {
    show($(id));
    document.body.style.overflow = "hidden";
}

function closeModal(id) {
    hide($(id));
    document.body.style.overflow = "";
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
function setupLoginTabs() {
    document.querySelectorAll(".role-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".role-btn").forEach((b) => {
                b.classList.remove("is-active");
                b.setAttribute("aria-selected", "false");
            });
            btn.classList.add("is-active");
            btn.setAttribute("aria-selected", "true");
            $("login-role").value = btn.dataset.role;
            clearError($("login-error"));
        });
    });
}

function resetRoleTabs() {
    const siswaBtn = document.querySelector('.role-btn[data-role="siswa"]');
    if (siswaBtn) siswaBtn.click();
}

function setupPasswordToggle() {
    $("toggle-password").addEventListener("click", () => {
        const input = $("login-password");
        const showPw = input.type === "password";
        input.type = showPw ? "text" : "password";
        $("icon-eye").style.display = showPw ? "none" : "";
        $("icon-eye-off").style.display = showPw ? "" : "none";
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
            state.session = { name: data.name, className: data.className, exam: data.exam, role: data.role };
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

function renderSiswa(list = []) {
    const body = $("monitor-siswa-body");
    $("badge-siswa-aktif").textContent = String(list.length);

    if (!list.length) {
        body.innerHTML = '<tr class="empty-row"><td colspan="6">Belum ada siswa yang masuk.</td></tr>';
        return;
    }

    body.innerHTML = list
        .map((s) => {
            const attendance = s.attendance
                ? '<span class="badge badge-success">Hadir</span>'
                : '<span class="badge badge-warn">Belum</span>';

            return `
                <tr>
                    <td><strong>${esc(s.name)}</strong></td>
                    <td>${esc(s.className || "—")}</td>
                    <td>${esc(examLabel(s.exam))}</td>
                    <td>${attendance}</td>
                    <td>${statusChip(s.lastEvent)}</td>
                    <td>
                        ${fmtTime(s.lastAt)}
                        <div style="color:#8a97a8;font-size:.72rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.lastDetail || "")}</div>
                    </td>
                </tr>`;
        })
        .join("");
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

async function loadMonitor() {
    try {
        const data = await api("/api/monitor");
        renderStats(data.stats);
        renderSiswa(data.siswa);
        renderLog(data.kejadian);
        renderBeritaAcara(data.beritaAcara);
    } catch (err) {
        if (err.status === 401 || err.status === 403) {
            clearInterval(state.monitorTimer);
            showToast("Sesi Anda berakhir. Silakan login ulang.");
            showScreen("screen-login");
        }
    }
}

function startMonitor() {
    clearInterval(state.monitorTimer);
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

    if (!groups.length) {
        container.innerHTML = '<div class="log-empty">Belum ada token. Buat token di atas.</div>';
        return;
    }

    const html = groups
        .map((group) => {
            const items = group.tokens.length
                ? group.tokens
                    .map((t) => {
                        const usedBadge = t.uses > 0
                            ? `<span class="badge badge-warn">Dipakai ${t.uses}×</span>`
                            : '<span class="badge badge-muted">Belum dipakai</span>';
                        return `
                            <div class="token-item">
                                <button type="button" class="token-code" data-token="${esc(t.token)}"
                                    title="Salin ${esc(t.token)}">${esc(t.token)}
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2"/>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                    </svg>
                                </button>
                                <div class="token-meta">
                                    <div class="token-label">${esc(t.label || t.examTitle)}</div>
                                    <div class="token-sub">${esc(t.examTitle)} • ${esc(t.createdBy || "pengawas")} • ${fmtTime(t.createdAt)}</div>
                                </div>
                                ${usedBadge}
                                <button type="button" class="btn btn-danger btn-xs" data-del="${esc(t.token)}">Hapus</button>
                            </div>`;
                    })
                    .join("")
                : '<div class="log-empty">Belum ada token untuk mapel ini.</div>';

            return `
                <div class="token-group">
                    <div class="token-group-head">
                        <strong>${esc(group.examTitle)}</strong>
                        <span class="panel-badge">${group.tokens.length}</span>
                    </div>
                    ${group.tokens.length ? items : '<div class="log-empty">Belum ada token untuk mapel ini.</div>'}
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
   ALUR SISWA
   ------------------------------------------------------------------ */
async function enterStudent() {
    showScreen("screen-student");
    renderStudentHead();

    try {
        const s = await api("/api/session");
        state.session = Object.assign(state.session, s);
        state.examKey = s.examKey || s.exam;
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
    $("stud-meta").textContent = `${state.session.className || "—"} • ${label}`;
    $("stud-subtitle").textContent = `Penilaian Sumatif • ${label}`;

    $("logout-btn-student").addEventListener("click", handleLogout);
    $("logout-fab").addEventListener("click", handleLogout);
}

function routeStudentStep() {
    const s = state.session;

    if (!s.attendanceDone) {
        renderAttendanceNeeded();
        openPresensiModal();
    } else if (!s.tokenValid) {
        renderTokenGate();
    } else {
        state.examKey = s.examKey || s.exam;
        renderPdfViewer();
    }
}

function renderAttendanceNeeded() {
    const node = $("tpl-attendance-needed").content.cloneNode(true);
    $("student-body").replaceChildren(node);
    $("open-presensi-btn").addEventListener("click", openPresensiModal);
}

/* ---------- Presensi wajib ---------- */
function openPresensiModal() {
    $("presensi-name").textContent = state.session.name;
    $("presensi-name-2").textContent = state.session.name;
    $("presensi-class").textContent = state.session.className || "—";
    $("presensi-exam").textContent = examLabel(state.session.exam || state.examKey);

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

    const btn = $("presensi-submit");
    setBusy(btn, true);
    clearError($("presensi-error"));

    try {
        await api("/api/presensi", { method: "POST", body: { room } });
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
    if (!state.examKey) {
        showToast("Sesi soal belum tersedia. Silakan login ulang.");
        showScreen("screen-login");
        return;
    }

    state.viewerActive = true;
    state.finished = false;
    state.pdfPage = 1;
    state.pdfZoom = 100;
    state.pdfDoc = null;

    const label = examLabel(state.examKey);
    $("stud-subtitle").textContent = `Soal: ${label}`;
    $("stud-meta").textContent = `${state.session.className || "—"} • Token valid`;

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
                    <span class="zoom-label" id="zoom-label">100%</span>
                    <button type="button" class="zoom-btn" id="zoom-in" aria-label="Perbesar">+</button>
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
        </div>`;

    $("prev-page").addEventListener("click", () => changePage(-1));
    $("next-page").addEventListener("click", () => changePage(1));
    $("zoom-in").addEventListener("click", () => changeZoom(20));
    $("zoom-out").addEventListener("click", () => changeZoom(-20));
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
        $("page-count").textContent = `1 / ${pdf.numPages}`;

        await renderPage(1);

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
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);

    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    await page.render({ canvasContext: ctx, viewport }).promise;

    state.pdfPage = num;
    updatePdfControls();

    if (num > 1) {
        await trackEvent("pdf_halaman", `Pindah ke halaman ${num}`, num);
    }
}

function updatePdfControls() {
    if (!state.pdfDoc) return;
    $("page-count").textContent = `${state.pdfPage} / ${state.pdfDoc.numPages}`;
    $("prev-page").disabled = state.pdfPage <= 1;
    $("next-page").disabled = state.pdfPage >= state.pdfDoc.numPages;
    $("zoom-label").textContent = `${state.pdfZoom}%`;
}

async function changePage(delta) {
    if (!state.pdfDoc) return;
    const next = Math.min(Math.max(1, state.pdfPage + delta), state.pdfDoc.numPages);
    if (next === state.pdfPage) return;
    await renderPage(next);
}

async function changeZoom(delta) {
    if (!state.pdfDoc) return;
    state.pdfZoom = Math.min(200, Math.max(50, state.pdfZoom + delta));
    await renderPage(state.pdfPage);
    updatePdfControls();
}

/* ---------- Selesai ujian ---------- */
function openFinishModal() {
    openModal("modal-finish");
}

async function handleFinishConfirm() {
    const btn = $("finish-confirm");
    setBusy(btn, true);

    // TRACK: PDF ditutup via tombol selesai
    try {
        await trackEvent("pdf_tutup", "Ujian diselesaikan oleh siswa");
        await trackEvent("selesai_ujian", "Siswa menekan Selesai Ujian");
    } catch (e) { /* abaikan */ }

    state.finished = true;
    state.viewerActive = false;
    closeModal("modal-finish");

    const body = $("student-body");
    body.replaceChildren();

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
            <button type="button" class="btn btn-outline btn-block" id="finish-logout">Keluar dari Ujian</button>
        </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector("#finish-logout").addEventListener("click", handleLogout);
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
    clearInterval(state.monitorTimer);
    state.monitorTimer = null;
    state.role = null;
    state.session = null;
    state.examKey = null;
    state.viewerActive = false;
    state.finished = false;
    state.pdfDoc = null;
    state.pdfPage = 1;
    state.pdfZoom = 100;

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
            state.session = { name: s.name, username: s.username, role: s.role, beritaAcaraDone: s.beritaAcaraDone };
            await enterSupervisor();
        } else if (s.role === "siswa") {
            state.session = {
                name: s.name,
                className: s.className,
                exam: s.exam,
                role: s.role,
                attendanceDone: s.attendanceDone,
                tokenValid: s.tokenValid,
                examKey: s.examKey,
                tokenLabel: s.tokenLabel,
            };
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

    $("login-form").addEventListener("submit", handleLogin);

    $("logout-btn").addEventListener("click", handleLogout);
    $("refresh-monitor").addEventListener("click", () => {
        loadMonitor();
        loadTokens();
        showToast("Monitor diperbarui.");
    });

    $("presensi-form").addEventListener("submit", handlePresensiSubmit);
    $("ba-form").addEventListener("submit", handleBaSubmit);

    populateTokenExamSelect();
    $("token-create-form").addEventListener("submit", handleTokenCreate);

    $("finish-cancel").addEventListener("click", () => closeModal("modal-finish"));
    $("finish-confirm").addEventListener("click", handleFinishConfirm);

    bootstrap();
}

document.addEventListener("DOMContentLoaded", init);