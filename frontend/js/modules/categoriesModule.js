/**
 * @file frontend/js/modules/categoriesModule.js
 * @description Módulo CRUD de categorías personalizadas del usuario.
 *
 * Las categorías tienen dos scopes:
 *   - 'global'  → Creadas por el sistema en db/init.js. Solo lectura para el usuario.
 *   - 'custom'  → Creadas por el usuario. Se pueden editar y eliminar.
 *
 * Este módulo solo gestiona las categorías custom del usuario.
 * Las globales se muestran en el listado pero SIN botones de editar/eliminar.
 *
 * Funcionalidades:
 *   - Renderizar el listado de categorías separado por scope.
 *   - Crear nueva categoría (nombre + tipo).
 *   - Editar nombre y tipo de una categoría propia.
 *   - Eliminar categoría propia (el backend impide borrarla si tiene transacciones).
 *
 * Estado local:
 *   _deleteCategoryId — ID de la categoría pendiente de eliminación.
 *
 * Expone como globales:
 *   renderCategories(categoriesList)
 *   openCreateCategoryModal()
 *   openEditCategoryModal(cat)
 *   openDeleteCategoryModal(id, name)
 *   handleSubmitCategory(e)
 *   confirmDeleteCategory()
 *
 * Depende de: api.js (categories, toast), ui.js (openModal, closeModal, setButtonLoading).
 */

// ─── Estado del módulo ────────────────────────────────────────────────────────

/** ID de la categoría pendiente de eliminación. */
let _deleteCategoryId = null;

// ─── Render del listado ───────────────────────────────────────────────────────

/**
 * Renderiza las categorías personalizadas del usuario en #categories-list.
 * Muestra solo las custom (scope === 'custom') con botones de editar y eliminar.
 * Las globales se muestran en un listado compacto de solo lectura debajo.
 *
 * @param {Array} categoriesList - Lista completa de categorías (globales + custom).
 */
function renderCategories(categoriesList) {
    const container = document.getElementById("categories-list");
    if (!container) return;

    const custom = categoriesList.filter((c) => c.scope === "custom");
    const global = categoriesList.filter((c) => c.scope === "global");

    if (custom.length === 0 && global.length === 0) {
        container.innerHTML = `<p style="font-size:13px;color:#5a5073">No hay categorías aún.</p>`;
        return;
    }

    let html = "";

    // ── Categorías personalizadas del usuario ──
    if (custom.length > 0) {
        html += custom
            .map((c) => {
                const nameEsc = c.name
                    .replace(/'/g, "\\'")
                    .replace(/"/g, "&quot;");
                const catJson = JSON.stringify(c).replace(/"/g, "&quot;");
                const colorCls =
                    c.type === "income" ? "badge-income" : "badge-expense";
                const typeLbl = c.type === "income" ? "↑" : "↓";

                return `
        <div class="category-pill">
          <span class="badge ${colorCls}" style="padding:2px 7px;font-size:10px">${typeLbl} ${c.type === "income" ? "Ingreso" : "Gasto"}</span>
          <span style="color:#e8e0ff">${c.name}</span>
          <button
            onclick="openEditCategoryModal(${catJson})"
            style="color:#9b8ec4;background:none;border:none;cursor:pointer;padding:0 3px;font-size:13px;line-height:1"
            title="Editar">✏</button>
          <button
            onclick="openDeleteCategoryModal(${c.id}, '${nameEsc}')"
            style="color:#ff4d6d;background:none;border:none;cursor:pointer;padding:0 3px;font-size:13px;line-height:1"
            title="Eliminar">✕</button>
        </div>`;
            })
            .join("");
    } else {
        html += `<p style="font-size:13px;color:#5a5073;width:100%;margin-bottom:8px">Aún no tienes categorías propias.</p>`;
    }

    // ── Categorías globales (solo lectura) ──
    if (global.length > 0) {
        html += `
      <div style="width:100%;margin-top:12px;border-top:1px solid rgba(124,0,255,.1);padding-top:12px">
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#5a5073;margin-bottom:8px">
          Globales del sistema (${global.length}) — solo lectura
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${global
              .map((c) => {
                  const colorCls =
                      c.type === "income" ? "badge-income" : "badge-expense";
                  return `<span class="badge ${colorCls}" style="font-size:11px">${c.name}</span>`;
              })
              .join("")}
        </div>
      </div>`;
    }

    container.innerHTML = html;
}

// ─── Modal crear categoría ────────────────────────────────────────────────────

/**
 * Abre el modal de categoría en modo "crear".
 * Limpia el formulario y resetea los textos.
 */
function openCreateCategoryModal() {
    document.getElementById("category-id").value = "";
    document.getElementById("form-category").reset();
    document.getElementById("modal-category-title").textContent =
        "Nueva categoría";
    document.getElementById("submit-category-btn").textContent = "Crear";
    openModal("modal-category");
}

// ─── Modal editar categoría ───────────────────────────────────────────────────

/**
 * Abre el modal de categoría en modo "editar" con los datos precargados.
 *
 * @param {object} cat - Objeto categoría.
 * @param {number} cat.id
 * @param {string} cat.name
 * @param {string} cat.type
 */
function openEditCategoryModal(cat) {
    document.getElementById("category-id").value = cat.id;
    document.getElementById("category-name").value = cat.name;
    document.getElementById("category-type").value = cat.type;
    document.getElementById("modal-category-title").textContent =
        "Editar categoría";
    document.getElementById("submit-category-btn").textContent = "Actualizar";
    openModal("modal-category");
}

// ─── Submit del formulario de categoría (crear / editar) ──────────────────────

/**
 * Maneja el submit del formulario de categoría.
 * Detecta si es "crear" (category-id vacío) o "editar".
 *
 * @param {Event} e - Evento submit.
 */
async function handleSubmitCategory(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-category-btn");
    setButtonLoading(btn, "Guardando...");

    const catId = document.getElementById("category-id").value;
    const isEdit = !!catId;

    const payload = {
        name: document.getElementById("category-name").value.trim(),
        type: document.getElementById("category-type").value,
    };

    try {
        if (isEdit) {
            await categories.update(catId, payload);
            toast.success("Categoría actualizada ✓");
        } else {
            await categories.create(payload);
            toast.success("Categoría creada ✓");
        }
        closeModal("modal-category");
        document.getElementById("form-category").reset();
        // Recargar todo para que los selects de categoría se actualicen
        if (typeof loadAllData === "function") await loadAllData();
    } catch (err) {
        toast.error(err.message);
        setButtonReady(btn);
    }
}

// ─── Modal eliminar categoría ─────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación de categoría.
 *
 * @param {number} id   - ID de la categoría.
 * @param {string} name - Nombre de la categoría para mostrar al usuario.
 */
function openDeleteCategoryModal(id, name) {
    _deleteCategoryId = id;
    const infoEl = document.getElementById("delete-category-info");
    if (infoEl) {
        infoEl.textContent =
            `¿Seguro que quieres eliminar la categoría "${name}"? ` +
            `Si tiene transacciones asociadas, el servidor no permitirá borrarla.`;
    }
    openModal("modal-delete-category");
}

/**
 * Ejecuta la eliminación de la categoría guardada en `_deleteCategoryId`.
 * El backend retorna 409 CONFLICT si la categoría tiene transacciones.
 */
async function confirmDeleteCategory() {
    if (!_deleteCategoryId) return;
    closeModal("modal-delete-category");

    try {
        await categories.delete(_deleteCategoryId);
        toast.success("Categoría eliminada");
        _deleteCategoryId = null;
        if (typeof loadAllData === "function") await loadAllData();
    } catch (err) {
        // El backend retorna un mensaje descriptivo si la categoría está en uso
        toast.error(err.message);
        _deleteCategoryId = null;
    }
}
