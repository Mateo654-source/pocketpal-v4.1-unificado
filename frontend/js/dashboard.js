/**
 * @file js/dashboard.js
 * @description Orquestador principal del dashboard de PocketPal.
 *
 * Responsabilidades:
 *   1. Capturar token de OAuth desde la URL (redirect de Google).
 *   2. Verificar autenticación y redirigir al login si no hay sesión.
 *   3. Mostrar los datos del usuario en sidebar y header.
 *   4. Conectar todos los event listeners de botones del dashboard
 *      (el HTML no tiene onclick= — todo se registra aquí).
 *   5. Llamar loadAllData() para inicializar el dashboard.
 *   6. Exponer loadAllData() globalmente para que los módulos la llamen
 *      después de operaciones CRUD.
 *
 * Arquitectura:
 *   Este archivo es el único que sabe del DOM de la página completa.
 *   Los módulos (txModule, goalsModule, categoriesModule) solo conocen
 *   sus propios elementos. dashboard.js los conecta con el DOM global.
 *
 * Dependencias (cargadas antes en dashboard.html):
 *   api.js, ui.js, charts.js, txModule.js, goalsModule.js, categoriesModule.js
 */

// ─── Captura de token OAuth ────────────────────────────────────────────────────

/**
 * Google redirige al dashboard con el token en los query params:
 *   /dashboard.html?token=<jwt>&name=...&email=...&avatar=...
 *
 * Se captura, se guarda en localStorage y se limpia la URL con
 * history.replaceState para no exponer el token en el historial del navegador.
 */
(function captureOAuthToken() {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (!urlToken) return;

    saveAuth(urlToken, {
        name: params.get("name") || "",
        email: params.get("email") || "",
        avatar: params.get("avatar") || "",
    });

    window.history.replaceState({}, document.title, "./dashboard.html");
})();

// Protección de ruta — redirigir al login si no hay token
if (!localStorage.getItem("token")) {
    window.location.href = "./index.html";
}

// ─── Inicialización ────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
    if (!requireAuth()) return;

    _initUserDisplay();
    _registerEventListeners();
    loadAllData();
});

// ─── Mostrar datos del usuario ─────────────────────────────────────────────────

/**
 * Rellena los elementos del sidebar y el header con los datos del usuario
 * guardados en localStorage al hacer login/registro.
 */
function _initUserDisplay() {
    const user = getUser();
    if (!user) return;

    // Nombre y email en el sidebar
    const nameEl = document.getElementById("user-name");
    const emailEl = document.getElementById("user-email");
    if (nameEl) nameEl.textContent = user.name || "—";
    if (emailEl) emailEl.textContent = user.email || "—";

    // Avatar: foto de Google o inicial del nombre
    const avatarEl = document.getElementById("user-avatar");
    if (avatarEl) {
        if (user.avatar) {
            avatarEl.innerHTML = `<img src="${user.avatar}" alt="foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else {
            avatarEl.textContent = user.name?.charAt(0).toUpperCase() || "?";
        }
    }

    // Saludo en el header (primer nombre)
    const greetingEl = document.getElementById("greeting-name");
    if (greetingEl) greetingEl.textContent = user.name?.split(" ")[0] || "";
}

// ─── Registro de event listeners ──────────────────────────────────────────────

/**
 * Registra TODOS los event listeners del dashboard aquí, en un solo lugar.
 * El HTML no contiene ningún onclick= — separación total de estructura y comportamiento.
 */
function _registerEventListeners() {
    // ── Logout ──
    document
        .getElementById("btn-logout")
        ?.addEventListener("click", () => auth.logout());

    // ── Abrir modal Nueva transacción (botón del sidebar y botón de la sección) ──
    document
        .getElementById("btn-new-tx")
        ?.addEventListener("click", openCreateTxModal);
    document
        .getElementById("nav-new-tx")
        ?.addEventListener("click", openCreateTxModal);

    // ── Abrir modal Nueva meta ──
    document
        .getElementById("btn-new-goal")
        ?.addEventListener("click", openCreateGoalModal);
    document
        .getElementById("nav-new-goal")
        ?.addEventListener("click", openCreateGoalModal);

    // ── Abrir modal Nueva categoría ──
    document
        .getElementById("btn-new-category")
        ?.addEventListener("click", openCreateCategoryModal);
    document
        .getElementById("nav-new-category")
        ?.addEventListener("click", openCreateCategoryModal);

    // ── Sincronizar Gmail ──
    document.getElementById("btn-sync")?.addEventListener("click", syncGmail);

    // ── Filtros de transacciones ──
    document
        .getElementById("filter-type")
        ?.addEventListener("change", applyFilters);
    document
        .getElementById("filter-category")
        ?.addEventListener("change", applyFilters);
    document
        .getElementById("filter-start")
        ?.addEventListener("change", applyFilters);
    document
        .getElementById("filter-end")
        ?.addEventListener("change", applyFilters);
    document
        .getElementById("btn-clear-filters")
        ?.addEventListener("click", clearFilters);

    // ── Submit de formularios de modal ──
    document
        .getElementById("form-tx")
        ?.addEventListener("submit", handleSubmitTx);
    document
        .getElementById("form-goal")
        ?.addEventListener("submit", handleSubmitGoal);
    document
        .getElementById("form-allocate")
        ?.addEventListener("submit", handleAllocate);
    document
        .getElementById("form-category")
        ?.addEventListener("submit", handleSubmitCategory);

    // ── Confirmaciones de eliminación ──
    document
        .getElementById("confirm-delete-tx-btn")
        ?.addEventListener("click", confirmDeleteTx);
    document
        .getElementById("confirm-delete-goal-btn")
        ?.addEventListener("click", confirmDeleteGoal);
    document
        .getElementById("confirm-delete-category-btn")
        ?.addEventListener("click", confirmDeleteCategory);

    // ── Scroll a sección desde el sidebar ──
    document.querySelectorAll("[data-scroll]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.scroll;
            document
                .getElementById(id)
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
}

// ─── Carga de datos ────────────────────────────────────────────────────────────

/**
 * Carga todos los datos del dashboard en paralelo y los distribuye a los módulos.
 *
 * Se expone como función global para que los módulos la llamen después
 * de crear, editar o eliminar recursos (mantiene el dashboard sincronizado).
 *
 * @returns {Promise<void>}
 */
async function loadAllData() {
    try {
        const [catsRes, goalsRes, sumRes] = await Promise.all([
            categories.list(),
            goals.list(),
            summary.get(),
        ]);

        const categoriesList = catsRes.data.categories;
        const goalsList = goalsRes.data.goals;
        const summaryData = sumRes.data;

        // Distribuir datos a cada módulo especializado
        renderStats(summaryData.totals, goalsList);
        renderCharts(summaryData);
        renderGoals(goalsList);
        renderCategories(categoriesList);
        populateCategorySelects(categoriesList);

        // Cargar transacciones (módulo propio con estado de paginación)
        await loadTransactions();
    } catch (err) {
        toast.error("Error al cargar el dashboard: " + err.message);
        console.error("[dashboard] loadAllData error:", err);
    }
}

// ─── Estadísticas (KPI cards) ─────────────────────────────────────────────────

/**
 * Actualiza los valores de las tarjetas KPI.
 *
 * @param {{total_income, total_expenses, net_balance}} totals
 * @param {Array} goalsList
 */
function renderStats(totals, goalsList) {
    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set("stat-income", fmt.currency(totals.total_income));
    set("stat-expense", fmt.currency(totals.total_expenses));

    const balanceEl = document.getElementById("stat-balance");
    if (balanceEl) {
        balanceEl.textContent = fmt.currency(totals.net_balance);
        // Verde si positivo, rojo si el usuario gasta más de lo que ingresa
        balanceEl.style.color =
            parseFloat(totals.net_balance) >= 0 ? "var(--green)" : "var(--red)";
    }

    const active = (goalsList || []).filter((g) => !g.is_completed).length;
    set("stat-goals", `${active} activa${active !== 1 ? "s" : ""}`);
}

// ─── Sincronización Gmail ──────────────────────────────────────────────────────

/**
 * Sincronización manual de transacciones desde Gmail.
 * Anima el botón con puntos mientras espera la respuesta del servidor.
 *
 * @returns {Promise<void>}
 */
async function syncGmail() {
    const btn = document.getElementById("btn-sync");
    if (!btn || btn.disabled) return;

    btn.disabled = true;

    let dots = 0;
    const interval = setInterval(() => {
        dots = (dots + 1) % 4;
        btn.innerHTML = `<span class="nav-item-icon">⟳</span> Buscando${"...".slice(0, dots)}`;
    }, 400);

    try {
        const data = await apiFetch("/gmail/sync", { method: "POST" });

        if (data.success) {
            if (data.data.inserted > 0) {
                toast.success(
                    `✅ ${data.data.inserted} nuevos movimientos importados`,
                );
                await loadAllData();
            } else {
                toast.info("No hay movimientos nuevos por importar");
            }
        } else {
            toast.error(data.message || "Error en la sincronización");
        }
    } catch (err) {
        toast.error("Error al conectar con Gmail");
        console.error("[dashboard] syncGmail error:", err);
    } finally {
        clearInterval(interval);
        btn.disabled = false;
        btn.innerHTML = `<span class="nav-item-icon">⟳</span> Sincronizar Gmail`;
    }
}
