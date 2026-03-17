/**
 * @file frontend/js/modules/txModule.js
 * @description Módulo CRUD de transacciones + paginación del dashboard.
 *
 * Gestiona todo el ciclo de vida de una transacción desde el frontend:
 *   - Render de la tabla con paginación server-side.
 *   - Modal para crear una nueva transacción.
 *   - Modal para editar una transacción existente (pre-rellena el formulario).
 *   - Modal de confirmación para eliminar.
 *   - Filtros por tipo, categoría y rango de fechas (enviados al servidor).
 *
 * Estado local:
 *   _txPagination  — página actual, limit, total y totalPages.
 *   _txFilters     — filtros activos que se envían a la API.
 *   _deleteTxId    — ID guardado para el modal de confirmación de eliminación.
 *
 * Expone como globales:
 *   loadTransactions(resetPage)   — carga/recarga las transacciones.
 *   openCreateTxModal()           — abre el modal en modo "crear".
 *   openEditTxModal(tx)           — abre el modal en modo "editar" con datos precargados.
 *   openDeleteTxModal(id, info)   — abre el modal de confirmación de eliminación.
 *   confirmDeleteTx()             — ejecuta la eliminación confirmada.
 *   handleSubmitTx(e)             — submit del formulario (crear o actualizar).
 *   applyFilters()                — aplica los filtros activos y recarga.
 *   clearFilters()                — limpia todos los filtros y recarga.
 *   changePage(newPage)           — navega a una página específica.
 *
 * Depende de: api.js (transactions, fmt, toast), ui.js (openModal, closeModal, setTxType, setButtonLoading).
 */

// ─── Estado del módulo ────────────────────────────────────────────────────────

/** Paginación actual. Se actualiza con cada respuesta del servidor. */
let _txPagination = { page: 1, limit: 10, total: 0, totalPages: 1 };

/** Filtros activos. Se incluyen en cada petición de listado. */
let _txFilters = {};

/** ID de la transacción pendiente de eliminación (guardado para el modal de confirmación). */
let _deleteTxId = null;

// ─── Carga de transacciones ───────────────────────────────────────────────────

/**
 * Carga la página actual de transacciones desde el servidor.
 * Combina paginación y filtros activos en los query params.
 * Actualiza `_txPagination` con los datos devueltos.
 *
 * @param {boolean} [resetPage=false] - Si es true, resetea a página 1 antes de cargar.
 * @returns {Promise<Array>} Lista de transacciones de la página actual.
 */
async function loadTransactions(resetPage = false) {
    if (resetPage) _txPagination.page = 1;

    try {
        const res = await transactions.list({
            ..._txFilters,
            page: _txPagination.page,
            limit: _txPagination.limit,
        });

        const { transactions: txList, pagination } = res.data;

        // Actualizar estado de paginación con los datos reales del servidor
        _txPagination = { ..._txPagination, ...pagination };

        renderTransactionsTable(txList);
        renderPagination();
        updateTxSubtitle(pagination.total);

        return txList;
    } catch (err) {
        toast.error("Error cargando transacciones: " + err.message);
        return [];
    }
}

/**
 * Actualiza el subtítulo de la sección de transacciones con el total.
 *
 * @param {number} total - Total de transacciones del filtro actual.
 */
function updateTxSubtitle(total) {
    const el = document.getElementById("tx-subtitle");
    if (el)
        el.textContent =
            total === 0
                ? "Sin resultados"
                : `${total} registro${total !== 1 ? "s" : ""}`;
}

// ─── Render de la tabla ───────────────────────────────────────────────────────

/**
 * Renderiza la tabla de transacciones en el DOM.
 * Cada fila incluye botones de editar (lápiz) y eliminar (×).
 *
 * @param {Array} txList - Lista de transacciones a renderizar.
 */
function renderTransactionsTable(txList) {
    const tbody = document.getElementById("tx-tbody");
    if (!tbody) return;

    if (!txList || txList.length === 0) {
        tbody.innerHTML = `
      <tr><td colspan="6">
        <div style="text-align:center;padding:32px;color:#5a5073">
          <div style="font-size:2rem;margin-bottom:8px">💸</div>
          <div style="font-size:13px">No hay transacciones en este período</div>
        </div>
      </td></tr>`;
        return;
    }

    tbody.innerHTML = txList
        .map((tx) => {
            // Normalizar la fecha — puede venir como Date object de MySQL o como string
            const dateStr = tx.date ? tx.date.toString().split("T")[0] : "—";
            const amountCls =
                tx.type === "income" ? "amount-income" : "amount-expense";
            const badgeCls =
                tx.type === "income"
                    ? "badge-income"
                    : tx.type === "saving"
                      ? "badge-saving"
                      : "badge-expense";
            const badgeTxt =
                tx.type === "income"
                    ? "↑ Ingreso"
                    : tx.type === "saving"
                      ? "→ Ahorro"
                      : "↓ Gasto";

            // Los aportes a metas (saving) son de solo lectura — no se pueden editar
            const isSaving = tx.type === "saving";

            // Escapar el objeto para embeber en onclick (el JSON se pasa como atributo HTML)
            const txJson = JSON.stringify(tx).replace(/"/g, "&quot;");
            const deleteInfo = `${fmt.currency(tx.amount)} — ${(tx.description || tx.category_name || "").replace(/'/g, "\\'")}`;

            return `
      <tr>
        <td data-label="Fecha">${dateStr}</td>
        <td data-label="Tipo"><span class="badge ${badgeCls}">${badgeTxt}</span></td>
        <td data-label="Monto"><span class="${amountCls}">${fmt.currency(tx.amount)}</span></td>
        <td data-label="Categoría">${tx.category_name || "—"}</td>
        <td data-label="Descripción">${fmt.truncate(tx.description || "—", 28)}</td>
        <td>
          <div style="display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap">
            ${
                !isSaving
                    ? `
              <button
                class="btn btn-ghost btn-sm"
                onclick="openEditTxModal(${txJson})"
                title="Editar transacción"
                style="padding:6px 10px">✏</button>`
                    : ""
            }
            <button
              class="btn btn-ghost btn-sm"
              onclick="openDeleteTxModal(${tx.id}, '${deleteInfo}')"
              title="Eliminar transacción"
              style="color:#ff4d6d;padding:6px 10px">✕</button>
          </div>
        </td>
      </tr>`;
        })
        .join("");
}

// ─── Paginación ───────────────────────────────────────────────────────────────

/**
 * Renderiza los controles de paginación debajo de la tabla.
 * Muestra: "[← Anterior]  Pág X de Y  [Siguiente →]  (Z registros)"
 */
function renderPagination() {
    const container = document.getElementById("pagination-controls");
    if (!container) return;

    const { page, totalPages, total, limit } = _txPagination;
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    container.innerHTML = `
    <div class="pagination-wrap">
      <span class="pagination-info">
        ${total === 0 ? "Sin resultados" : `Mostrando ${from}–${to} de ${total}`}
      </span>
      <div class="pagination-controls">
        <button class="btn btn-ghost btn-sm" onclick="changePage(${page - 1})" ${page <= 1 ? "disabled" : ""}>← Anterior</button>
        <span class="pagination-page">${page} / ${totalPages || 1}</span>
        <button class="btn btn-ghost btn-sm" onclick="changePage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>Siguiente →</button>
      </div>
    </div>`;
}

/**
 * Navega a una página específica del historial de transacciones.
 * Valida que la página sea válida antes de hacer la petición.
 *
 * @param {number} newPage - Número de página destino.
 */
async function changePage(newPage) {
    if (newPage < 1 || newPage > _txPagination.totalPages) return;
    _txPagination.page = newPage;
    await loadTransactions();
    // Scroll suave hacia la tabla para que el usuario vea los nuevos datos
    document
        .getElementById("section-transactions")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─── Filtros ──────────────────────────────────────────────────────────────────

/**
 * Lee los valores de los controles de filtro y recarga las transacciones.
 * Siempre resetea a página 1 al cambiar filtros.
 */
async function applyFilters() {
    const type = document.getElementById("filter-type")?.value;
    const categoryId = document.getElementById("filter-category")?.value;
    const startDate = document.getElementById("filter-start")?.value;
    const endDate = document.getElementById("filter-end")?.value;

    // Solo incluir filtros que tienen valor (no enviar params vacíos)
    _txFilters = {};
    if (type) _txFilters.type = type;
    if (categoryId) _txFilters.category_id = categoryId;
    if (startDate) _txFilters.start_date = startDate;
    if (endDate) _txFilters.end_date = endDate;

    await loadTransactions(true); // resetPage = true
}

/**
 * Limpia todos los controles de filtro y recarga sin filtros.
 */
function clearFilters() {
    ["filter-type", "filter-category", "filter-start", "filter-end"].forEach(
        (id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        },
    );
    _txFilters = {};
    loadTransactions(true);
}

// ─── Modal crear ──────────────────────────────────────────────────────────────

/**
 * Abre el modal de transacción en modo "crear".
 * Limpia todos los campos y resetea el tipo a "expense" (el más común).
 */
function openCreateTxModal() {
    // Limpiar ID oculto (sin ID = modo crear)
    document.getElementById("tx-id").value = "";
    document.getElementById("form-tx").reset();
    document.getElementById("modal-tx-title").textContent = "Nueva transacción";
    document.getElementById("submit-tx-btn").textContent = "Guardar";

    // Resetear toggle de tipo a "gasto"
    setTxType("expense");

    // Fecha de hoy por defecto
    const dateInput = document.getElementById("tx-date");
    if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

    openModal("modal-tx");
}

// ─── Modal editar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal de transacción en modo "editar" con los datos precargados.
 * El objeto `tx` viene del botón en la tabla (datos embebidos como JSON en el atributo onclick).
 *
 * @param {object} tx - Objeto transacción completo.
 * @param {number} tx.id
 * @param {string} tx.type
 * @param {number} tx.amount
 * @param {number} tx.category_id
 * @param {string} tx.description
 * @param {string} tx.date
 */
function openEditTxModal(tx) {
    // Poner el ID para que handleSubmitTx() sepa que es un UPDATE
    document.getElementById("tx-id").value = tx.id;
    document.getElementById("modal-tx-title").textContent =
        "Editar transacción";
    document.getElementById("submit-tx-btn").textContent = "Actualizar";

    // Pre-rellenar campos con los datos actuales
    setTxType(tx.type);
    document.getElementById("tx-amount").value = tx.amount;
    document.getElementById("tx-date").value = tx.date
        ? tx.date.toString().split("T")[0]
        : "";
    document.getElementById("tx-description").value = tx.description || "";

    // Pre-seleccionar categoría — necesita un tick de evento para que las opciones estén disponibles
    const catSelect = document.getElementById("tx-category");
    if (catSelect) {
        // Mostrar todas las opciones del tipo correcto antes de seleccionar
        Array.from(catSelect.options).forEach((opt) => {
            if (opt.dataset.type) opt.hidden = false;
        });
        catSelect.value = tx.category_id;
    }

    openModal("modal-tx");
}

// ─── Modal eliminar ───────────────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación.
 * Guarda el ID en `_deleteTxId` para usarlo cuando el usuario confirme.
 *
 * @param {number} id   - ID de la transacción a eliminar.
 * @param {string} info - Descripción breve para mostrar al usuario (monto + descripción).
 */
function openDeleteTxModal(id, info) {
    _deleteTxId = id;
    const infoEl = document.getElementById("delete-tx-info");
    if (infoEl) infoEl.textContent = info;
    openModal("modal-delete-tx");
}

/**
 * Ejecuta la eliminación de la transacción guardada en `_deleteTxId`.
 * Cierra el modal, llama a la API y recarga los datos.
 * Si era el último elemento de la página actual, retrocede una página.
 */
async function confirmDeleteTx() {
    if (!_deleteTxId) return;
    closeModal("modal-delete-tx");

    try {
        await transactions.delete(_deleteTxId);
        toast.success("Transacción eliminada");
        _deleteTxId = null;

        // Si era el único elemento de la página, ir a la página anterior
        const currentCount = document.querySelectorAll("#tx-tbody tr").length;
        if (currentCount <= 1 && _txPagination.page > 1) {
            _txPagination.page -= 1;
        }

        // Recargar transacciones y también el resumen (el balance cambió)
        if (typeof loadAllData === "function") await loadAllData();
        else await loadTransactions();
    } catch (err) {
        toast.error(err.message);
    }
}

// ─── Submit del formulario (crear / editar) ───────────────────────────────────

/**
 * Maneja el submit del formulario de transacción.
 * Detecta si es modo "crear" (tx-id vacío) o "editar" (tx-id con valor).
 *
 * @param {Event} e - Evento submit del formulario.
 */
async function handleSubmitTx(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-tx-btn");
    setButtonLoading(btn, "Guardando...");

    const txId = document.getElementById("tx-id").value;
    const isEdit = !!txId;

    const payload = {
        type: document.getElementById("tx-type").value,
        amount: parseFloat(document.getElementById("tx-amount").value),
        category_id: parseInt(document.getElementById("tx-category").value),
        description:
            document.getElementById("tx-description").value.trim() || undefined,
        date: document.getElementById("tx-date").value || undefined,
    };

    try {
        if (isEdit) {
            // Actualizar transacción existente — el endpoint PUT requiere fecha obligatoria
            if (!payload.date) {
                toast.error("La fecha es requerida para actualizar");
                setButtonReady(btn);
                return;
            }
            await transactions.update(txId, payload);
            toast.success("Transacción actualizada ✓");
        } else {
            // Crear nueva transacción
            await transactions.create(payload);
            toast.success("Transacción registrada ✓");
        }

        closeModal("modal-tx");
        document.getElementById("form-tx").reset();

        // Ir a página 1 para ver el resultado más reciente (ordenado por fecha DESC)
        _txPagination.page = 1;
        if (typeof loadAllData === "function") await loadAllData();
        else await loadTransactions();
    } catch (err) {
        toast.error(err.message);
        setButtonReady(btn);
    }
}
