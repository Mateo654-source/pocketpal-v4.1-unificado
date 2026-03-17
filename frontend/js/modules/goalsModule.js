/**
 * @file frontend/js/modules/goalsModule.js
 * @description Módulo CRUD de metas de ahorro + aportes.
 *
 * Funcionalidades:
 *   - Renderizar tarjetas de metas (activas y completadas).
 *   - Crear nueva meta (modal).
 *   - Editar título y monto objetivo (modal pre-relleno).
 *   - Abonar dinero a una meta (modal de aporte).
 *   - Eliminar meta con explicación clara del impacto financiero.
 *   - Flujo de meta completada: celebración + registro de decisión.
 *
 * SOBRE LA ELIMINACIÓN:
 *   Al eliminar una meta, los aportes previos (transacciones tipo 'saving')
 *   PERMANECEN en el historial. El servidor solo borra la meta y goal_allocations.
 *   Esto es correcto porque el dinero ya salió del balance al hacer los aportes.
 *   El modal de eliminación explica esto explícitamente al usuario.
 *
 * Estado local:
 *   _currentAllocateGoalId — ID de la meta activa en el modal de aporte.
 *   _deleteGoalId          — ID de la meta pendiente de eliminación.
 *
 * Expone como globales:
 *   renderGoals(goalsList)
 *   openCreateGoalModal()
 *   openEditGoalModal(goal)
 *   openAllocateModal(goalId, goalTitle, current, target)
 *   openDeleteGoalModal(goalId, goalTitle)
 *   handleAllocate(e)
 *   handleSubmitGoal(e)
 *   confirmDeleteGoal()
 *
 * Depende de: api.js (goals, fmt, toast), ui.js (openModal, closeModal, setButtonLoading).
 */

// ─── Estado del módulo ────────────────────────────────────────────────────────

/** ID de la meta activa en el modal de aporte. */
let _currentAllocateGoalId = null;

/** ID de la meta pendiente de eliminación. */
let _deleteGoalId = null;

// ─── Render de tarjetas de metas ──────────────────────────────────────────────

/**
 * Renderiza la lista de metas en el contenedor #goals-list.
 * Separa activas (sin completar) de completadas.
 * Cada tarjeta activa tiene botones: Abonar, Editar, Eliminar.
 * Las completadas solo muestran el botón Eliminar.
 *
 * @param {Array} goalsList - Lista de metas desde GET /api/goals.
 */
function renderGoals(goalsList) {
    const container = document.getElementById("goals-list");
    if (!container) return;

    if (!goalsList || goalsList.length === 0) {
        container.innerHTML = `
      <div style="text-align:center;padding:32px;color:#5a5073">
        <div style="font-size:2rem;margin-bottom:8px">🎯</div>
        <div style="font-size:13px">No hay metas activas. ¡Crea una!</div>
      </div>`;
        return;
    }

    const active = goalsList.filter((g) => !g.is_completed);
    const completed = goalsList.filter((g) => g.is_completed);

    let html = "";

    // ── Metas activas ──
    if (active.length > 0) {
        html += active.map((g) => renderGoalCard(g, false)).join("");
    }

    // ── Metas completadas (colapsadas visualmente) ──
    if (completed.length > 0) {
        html += `
      <div style="margin-top:12px;border-top:1px solid rgba(124,0,255,.1);padding-top:12px">
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#5a5073;margin-bottom:8px">
          Completadas (${completed.length})
        </p>
        ${completed.map((g) => renderGoalCard(g, true)).join("")}
      </div>`;
    }

    container.innerHTML = html;
}

/**
 * Genera el HTML de una tarjeta de meta individual.
 *
 * @param {object}  goal      - Objeto meta.
 * @param {boolean} completed - true si la meta está completada.
 * @returns {string} HTML de la tarjeta.
 */
function renderGoalCard(goal, completed) {
    const pct = Math.min(
        Math.round((goal.current_amount / goal.target_amount) * 100),
        100,
    );
    const titleEsc = goal.title.replace(/'/g, "\\'").replace(/"/g, "&quot;");
    const goalJson = JSON.stringify(goal).replace(/"/g, "&quot;");
    // Color de la barra según progreso
    const barColor =
        pct >= 100
            ? "#00e5a0"
            : pct >= 60
              ? "#7c00ff"
              : pct >= 30
                ? "#4d9fff"
                : "#9b8ec4";

    return `
    <div class="goal-card ${completed ? "completed" : ""}">

      <!-- Encabezado: título + botones de acción -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px">
        <div class="goal-title">${goal.title}${completed ? " ✅" : ""}</div>
        <div class="goal-actions">
          ${
              !completed
                  ? `
            <button
              class="btn btn-ghost btn-sm"
              onclick="openEditGoalModal(${goalJson})"
              title="Editar meta"
              style="padding:5px 8px;font-size:13px">✏</button>`
                  : ""
          }
          <button
            class="btn btn-ghost btn-sm"
            onclick="openDeleteGoalModal(${goal.id}, '${titleEsc}')"
            title="Eliminar meta"
            style="padding:5px 8px;font-size:13px;color:#ff4d6d">✕</button>
        </div>
      </div>

      <!-- Montos: ahorrado y porcentaje -->
      <div class="goal-amounts">
        <span>${fmt.currency(goal.current_amount)} <span style="color:#5a5073">ahorrado</span></span>
        <span class="goal-pct">${pct}%</span>
      </div>

      <!-- Barra de progreso -->
      <div class="progress-bar-wrap">
        <div class="progress-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${barColor},${barColor}cc)"></div>
      </div>

      <!-- Pie: objetivo + botón abonar -->
      <div class="goal-amounts" style="margin-top:10px">
        <span style="color:#5a5073">Objetivo: <span style="color:#9b8ec4">${fmt.currency(goal.target_amount)}</span></span>
        ${
            !completed
                ? `
          <button
            class="btn btn-ghost btn-sm"
            onclick="openAllocateModal(${goal.id}, '${titleEsc}', ${goal.current_amount}, ${goal.target_amount})"
            style="color:#7c00ff;font-weight:700;border:1px solid rgba(124,0,255,.25);border-radius:8px;padding:5px 10px">
            + Abonar
          </button>`
                : ""
        }
      </div>

    </div>`;
}

// ─── Modal crear meta ─────────────────────────────────────────────────────────

/**
 * Abre el modal de meta en modo "crear".
 * Limpia el formulario y ajusta los textos del modal.
 */
function openCreateGoalModal() {
    document.getElementById("goal-id").value = "";
    document.getElementById("form-goal").reset();
    document.getElementById("modal-goal-title").textContent =
        "Nueva meta de ahorro";
    document.getElementById("submit-goal-btn").textContent = "Crear meta";

    const hint = document.getElementById("goal-amount-hint");
    if (hint) {
        hint.textContent = "";
        hint.classList.add("hidden");
    }

    openModal("modal-goal");
}

// ─── Modal editar meta ────────────────────────────────────────────────────────

/**
 * Abre el modal de meta en modo "editar" con los datos precargados.
 * Muestra un aviso con el mínimo permitido para el objetivo (no puede ser menor
 * al monto ya ahorrado).
 *
 * @param {object} goal - Objeto meta completo (del render de la tarjeta).
 */
function openEditGoalModal(goal) {
    document.getElementById("goal-id").value = goal.id;
    document.getElementById("goal-title-input").value = goal.title;
    document.getElementById("goal-amount").value = goal.target_amount;
    document.getElementById("modal-goal-title").textContent = "Editar meta";
    document.getElementById("submit-goal-btn").textContent = "Actualizar meta";

    // Mostrar aviso del mínimo permitido
    const hint = document.getElementById("goal-amount-hint");
    if (hint && parseFloat(goal.current_amount) > 0) {
        hint.textContent = `Mínimo permitido: ${fmt.currency(goal.current_amount)} (ya ahorrado)`;
        hint.classList.remove("hidden");
    }

    openModal("modal-goal");
}

// ─── Submit del formulario de meta (crear / editar) ───────────────────────────

/**
 * Maneja el submit del formulario de meta.
 * Detecta si es "crear" (goal-id vacío) o "editar" (goal-id con valor).
 *
 * @param {Event} e - Evento submit.
 */
async function handleSubmitGoal(e) {
    e.preventDefault();
    const btn = document.getElementById("submit-goal-btn");
    setButtonLoading(btn, "Guardando...");

    const goalId = document.getElementById("goal-id").value;
    const isEdit = !!goalId;

    const payload = {
        title: document.getElementById("goal-title-input").value.trim(),
        target_amount: parseFloat(document.getElementById("goal-amount").value),
    };

    try {
        if (isEdit) {
            await goals.update(goalId, payload);
            toast.success("Meta actualizada ✓");
        } else {
            await goals.create(payload);
            toast.success("Meta creada ✓");
        }
        closeModal("modal-goal");
        document.getElementById("form-goal").reset();
        if (typeof loadAllData === "function") await loadAllData();
    } catch (err) {
        toast.error(err.message);
        setButtonReady(btn);
    }
}

// ─── Modal abonar ─────────────────────────────────────────────────────────────

/**
 * Abre el modal de aporte con información de la meta prellenada.
 *
 * @param {number} goalId    - ID de la meta.
 * @param {string} goalTitle - Nombre de la meta.
 * @param {number} current   - Monto ya ahorrado.
 * @param {number} target    - Monto objetivo.
 */
function openAllocateModal(goalId, goalTitle, current, target) {
    _currentAllocateGoalId = goalId;

    const nameEl = document.getElementById("allocate-goal-name");
    const progressEl = document.getElementById("allocate-goal-progress");

    if (nameEl) nameEl.textContent = goalTitle;
    if (progressEl) {
        const remaining = parseFloat(target) - parseFloat(current);
        progressEl.textContent = `Ahorrado: ${fmt.currency(current)} · Faltan: ${fmt.currency(remaining)}`;
    }

    document.getElementById("allocate-amount").value = "";
    openModal("modal-allocate");
}

/**
 * Maneja el submit del formulario de aporte.
 * Si la meta se completa con este aporte, muestra celebración y registra la decisión.
 *
 * @param {Event} e - Evento submit.
 */
async function handleAllocate(e) {
    e.preventDefault();
    const btn = document.getElementById("allocate-btn");
    setButtonLoading(btn, "Abonando...");

    try {
        const amount = parseFloat(
            document.getElementById("allocate-amount").value,
        );
        const data = await goals.contribute(_currentAllocateGoalId, amount);

        closeModal("modal-allocate");
        document.getElementById("form-allocate").reset();

        if (data.data.completed) {
            // La meta se completó — celebrar y registrar decisión
            toast.success(`🎉 ¡Meta "${data.data.title}" completada!`);
            await _handleGoalCompletion(data.data.goalId, "saving");
        } else {
            toast.success("Abono registrado ✓");
            if (typeof loadAllData === "function") await loadAllData();
        }
    } catch (err) {
        toast.error(err.message);
        setButtonReady(btn);
    }
}

/**
 * Registra la decisión final del usuario cuando una meta se completa.
 * El tipo 'saving' significa que el dinero se mantiene ahorrado.
 * En el futuro se puede agregar un modal para elegir entre opciones.
 *
 * @param {number} goalId         - ID de la meta completada.
 * @param {string} completionType - Tipo de decisión ('saving').
 */
async function _handleGoalCompletion(goalId, completionType) {
    try {
        await apiFetch(`/goals/${goalId}/complete`, {
            method: "POST",
            body: JSON.stringify({ completionType }),
        });
        if (typeof loadAllData === "function") await loadAllData();
    } catch (err) {
        toast.error(err.message);
    }
}

// ─── Modal eliminar meta ──────────────────────────────────────────────────────

/**
 * Abre el modal de confirmación de eliminación de meta.
 * Muestra el nombre de la meta y explica qué pasa con los aportes previos.
 *
 * @param {number} goalId    - ID de la meta.
 * @param {string} goalTitle - Nombre de la meta.
 */
function openDeleteGoalModal(goalId, goalTitle) {
    _deleteGoalId = goalId;
    const infoEl = document.getElementById("delete-goal-info");
    if (infoEl) infoEl.textContent = `Vas a eliminar la meta "${goalTitle}".`;
    openModal("modal-delete-goal");
}

/**
 * Ejecuta la eliminación de la meta guardada en `_deleteGoalId`.
 *
 * COMPORTAMIENTO FINANCIERO AL ELIMINAR:
 *   - La meta y sus registros en goal_allocations se eliminan.
 *   - Las transacciones de tipo 'saving' creadas al abonar PERMANECEN.
 *   - El saldo ya fue descontado en cada aporte y no se revierte.
 *   - El usuario verá esas transacciones en el historial como aportes huérfanos.
 */
async function confirmDeleteGoal() {
    if (!_deleteGoalId) return;
    closeModal("modal-delete-goal");

    try {
        await goals.delete(_deleteGoalId);
        toast.success("Meta eliminada");
        _deleteGoalId = null;
        if (typeof loadAllData === "function") await loadAllData();
    } catch (err) {
        toast.error(err.message);
    }
}
