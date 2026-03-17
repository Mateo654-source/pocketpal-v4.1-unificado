/**
 * @file js/modules/ui.js
 * @description Helpers de UI compartidos por todos los módulos del dashboard.
 *
 * Funciones puras de DOM que NO hacen llamadas a la API.
 * Usa el patrón de delegación de eventos para los botones de cierre:
 * cualquier elemento con [data-close="modal-id"] cierra ese modal al hacer clic.
 *
 * Expone como globales:
 *   openModal(id)                      — abre un modal por ID
 *   closeModal(id)                     — cierra un modal por ID
 *   setTxType(type)                    — cambia tipo de tx en el modal
 *   setButtonLoading(btn, label)       — pone un botón en estado de carga
 *   setButtonReady(btn, label)         — restaura un botón al estado normal
 *   populateCategorySelects(list)      — rellena selects de categoría
 *
 * Depende de: nada (puede cargarse inmediatamente después de api.js).
 */

// ── Modales ────────────────────────────────────────────────────────────────────

/**
 * Abre un modal añadiendo la clase .open al overlay.
 * La clase es gestionada por components.css (opacity + pointer-events).
 *
 * @param {string} id - ID del elemento .modal-overlay.
 */
function openModal(id) {
    document.getElementById(id)?.classList.add("open");
}

/**
 * Cierra un modal removiendo la clase .open.
 *
 * @param {string} id - ID del elemento .modal-overlay.
 */
function closeModal(id) {
    document.getElementById(id)?.classList.remove("open");
}

/**
 * Delegación de eventos para cerrar modales.
 * Escucha dos patrones:
 *   1. Clic en el overlay oscuro (fuera del modal).
 *   2. Clic en cualquier elemento con [data-close="modal-id"].
 *
 * Esto evita tener onclick="closeModal('x')" dispersos por el HTML.
 */
document.addEventListener("click", (e) => {
    // Patrón 1: clic directo en el overlay
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.remove("open");
        return;
    }

    // Patrón 2: botón/elemento con data-close
    const closer = e.target.closest("[data-close]");
    if (closer) {
        const modalId = closer.dataset.close;
        document.getElementById(modalId)?.classList.remove("open");
    }
});

// ── Toggle tipo de transacción ────────────────────────────────────────────────

/**
 * Cambia el tipo de transacción en el modal (Ingreso / Gasto).
 * También filtra las opciones del select de categorías para mostrar
 * solo las que corresponden al tipo elegido.
 *
 * @param {'income'|'expense'} type
 */
function setTxType(type) {
    const txTypeInput = document.getElementById("tx-type");
    const catSelect = document.getElementById("tx-category");

    if (txTypeInput) txTypeInput.value = type;

    // Actualizar botones del type-toggle
    document.querySelectorAll(".type-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.type === type);
    });

    // Filtrar categorías según tipo
    if (catSelect) {
        Array.from(catSelect.options).forEach((opt) => {
            if (opt.dataset.type) opt.hidden = opt.dataset.type !== type;
        });

        // Limpiar selección si no corresponde al tipo nuevo
        const selected = catSelect.options[catSelect.selectedIndex];
        if (selected?.dataset.type && selected.dataset.type !== type) {
            catSelect.value = "";
        }
    }
}

/**
 * Delegación de eventos para el type-toggle del modal de transacción.
 * Evita onclick="setTxType('income')" en el HTML.
 */
document.addEventListener("click", (e) => {
    const btn = e.target.closest(".type-btn");
    if (btn && btn.dataset.type) setTxType(btn.dataset.type);
});

// ── Estado de botones ─────────────────────────────────────────────────────────

/**
 * Pone un botón en estado de carga.
 * Deshabilita el botón, guarda el texto original en dataset y muestra un spinner.
 *
 * @param {HTMLButtonElement} btn
 * @param {string} [label='Guardando…']
 */
function setButtonLoading(btn, label = "Guardando…") {
    if (!btn) return;
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.innerHTML = `<span class="spinner"></span> ${label}`;
}

/**
 * Restaura un botón al estado normal después de una operación.
 *
 * @param {HTMLButtonElement} btn
 * @param {string} [label] - Si no se pasa, usa el texto guardado por setButtonLoading.
 */
function setButtonReady(btn, label) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = label ?? btn.dataset.originalText ?? "Guardar";
}

// ── Selects de categoría ──────────────────────────────────────────────────────

/**
 * Rellena los selects de categoría en el modal de transacción y en los filtros.
 * Preserva la selección actual para no perder el filtro activo al recargar.
 *
 * @param {Array} categoriesList - Lista de categorías [{id, name, type, scope}].
 */
function populateCategorySelects(categoriesList) {
    ["tx-category", "filter-category"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;

        const current = el.value; // guardar selección previa

        el.innerHTML =
            id === "filter-category"
                ? '<option value="">Todas las categorías</option>'
                : '<option value="">Selecciona categoría</option>';

        categoriesList.forEach((c) => {
            const label = `${c.name} (${c.type === "income" ? "Ingreso" : "Gasto"})`;
            el.innerHTML += `<option value="${c.id}" data-type="${c.type}">${label}</option>`;
        });

        if (current) el.value = current; // restaurar
    });
}
