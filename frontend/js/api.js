/**
 * @file frontend/js/api.js
 * @description Cliente HTTP centralizado para consumir la API de PocketPal.
 *
 * Este archivo debe incluirse PRIMERO en cada página HTML, antes de cualquier
 * otro script. Exporta (como globales) todos los módulos necesarios:
 *
 *   auth         → register, login, logout, me
 *   transactions → list (con paginación), get, create, update, delete
 *   categories   → list, create, update, delete
 *   goals        → list, get, create, update, delete, contribute
 *   summary      → get, goals
 *   ai           → chat, history, clearHistory
 *   fmt          → currency, date, datetime, truncate
 *   toast        → success, error, info
 *
 * Funciones de autenticación:
 *   saveAuth(token, user)  → persiste en localStorage
 *   clearAuth()            → borra localStorage
 *   getToken()             → devuelve el token JWT guardado
 *   getUser()              → devuelve el objeto usuario guardado
 *   isLoggedIn()           → true si hay token
 *   requireAuth()          → redirige a login si no hay token
 */

// ─── Configuración ────────────────────────────────────────────────────────────

/** URL base de la API. Cambiar en producción. */
const API_BASE = "https://pocketpal-6ydq.onrender.com/api";

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/** @returns {string|null} Token JWT almacenado en localStorage. */
const getToken = () => localStorage.getItem("token");

/** @returns {object|null} Objeto usuario almacenado en localStorage. */
const getUser = () => JSON.parse(localStorage.getItem("user") || "null");

/**
 * Guarda token y datos del usuario en localStorage.
 * @param {string} token - Token JWT.
 * @param {object} user  - Datos del usuario.
 */
const saveAuth = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
};

/** Elimina token y datos del usuario de localStorage. */
const clearAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

/** @returns {boolean} true si el usuario está autenticado (tiene token). */
const isLoggedIn = () => !!getToken();

/**
 * Redirige al login si no hay token. Llamar al inicio de páginas protegidas.
 * @returns {boolean} true si el usuario está autenticado.
 */
const requireAuth = () => {
    if (!isLoggedIn()) {
        window.location.href = "./index.html";
        return false;
    }
    return true;
};

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

/**
 * Realiza una petición HTTP autenticada al backend.
 * Incluye automáticamente el header Authorization con el token JWT.
 * Si el servidor responde 401, limpia la sesión y redirige al login.
 *
 * @param {string} endpoint        - Ruta relativa, ej: '/transactions?page=1'.
 * @param {object} [options={}]    - Opciones de fetch (method, body, headers...).
 * @returns {Promise<object>}      - Respuesta JSON parseada del servidor.
 * @throws {Error}                 - Si la respuesta no es ok (status >= 400).
 */
const apiFetch = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        // Token expirado o inválido → redirigir al login
        if (response.status === 401) {
            clearAuth();
            window.location.href = "./index.html";
            return;
        }
        // Propagar el error con el mensaje del servidor
        throw new Error(data.message || `Error ${response.status}`);
    }

    return data;
};

// ─── Módulos de la API ────────────────────────────────────────────────────────

/**
 * Módulo de autenticación.
 * Gestiona registro, login y sesión del usuario.
 */
const auth = {
    /**
     * Registra un nuevo usuario.
     * @param {string} name     - Nombre completo.
     * @param {string} email    - Correo electrónico.
     * @param {string} password - Contraseña (mínimo 6 caracteres).
     */
    register: (name, email, password) =>
        apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({ name, email, password }),
        }),

    /**
     * Autentica un usuario con email y contraseña.
     * @param {string} email
     * @param {string} password
     */
    login: (email, password) =>
        apiFetch("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        }),

    /** @returns {Promise<object>} Datos del usuario autenticado. */
    me: () => apiFetch("/auth/me"),

    /** Cierra la sesión y redirige al login. */
    logout: () => {
        clearAuth();
        window.location.href = "./index.html";
    },
};

/**
 * Módulo de transacciones.
 * Incluye soporte completo de paginación y filtros.
 */
const transactions = {
    /**
     * Lista transacciones con paginación y filtros opcionales.
     * @param {object} [params={}] - Filtros: type, category_id, start_date, end_date, page, limit.
     * @returns {Promise<{transactions: Array, pagination: object}>}
     */
    list: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/transactions${qs ? "?" + qs : ""}`);
    },

    /**
     * Obtiene una transacción por ID.
     * @param {number} id
     */
    get: (id) => apiFetch(`/transactions/${id}`),

    /**
     * Crea una nueva transacción.
     * @param {{type, amount, category_id, description?, date?}} data
     */
    create: (data) =>
        apiFetch("/transactions", {
            method: "POST",
            body: JSON.stringify(data),
        }),

    /**
     * Actualiza una transacción existente.
     * @param {number} id
     * @param {{type, amount, category_id, description, date}} data
     */
    update: (id, data) =>
        apiFetch(`/transactions/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    /**
     * Elimina una transacción.
     * @param {number} id
     */
    delete: (id) => apiFetch(`/transactions/${id}`, { method: "DELETE" }),
};

/**
 * Módulo de categorías.
 * Las categorías globales se muestran pero no se pueden editar/borrar.
 */
const categories = {
    /** @returns {Promise<Array>} Lista de categorías (globales + propias). */
    list: () => apiFetch("/categories"),

    /**
     * Crea una categoría personalizada.
     * @param {{name: string, type: 'income'|'expense'}} data
     */
    create: (data) =>
        apiFetch("/categories", { method: "POST", body: JSON.stringify(data) }),

    /**
     * Actualiza una categoría personalizada.
     * @param {number} id
     * @param {{name: string, type: 'income'|'expense'}} data
     */
    update: (id, data) =>
        apiFetch(`/categories/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        }),

    /**
     * Elimina una categoría personalizada (no debe tener transacciones).
     * @param {number} id
     */
    delete: (id) => apiFetch(`/categories/${id}`, { method: "DELETE" }),
};

/**
 * Módulo de metas de ahorro.
 */
const goals = {
    /** @returns {Promise<Array>} Lista de todas las metas. */
    list: () => apiFetch("/goals"),

    /**
     * Obtiene una meta con su historial de aportes.
     * @param {number} id
     */
    get: (id) => apiFetch(`/goals/${id}`),

    /**
     * Crea una nueva meta.
     * @param {{title: string, target_amount: number}} data
     */
    create: (data) =>
        apiFetch("/goals", { method: "POST", body: JSON.stringify(data) }),

    /**
     * Actualiza una meta.
     * @param {number} id
     * @param {{title: string, target_amount: number}} data
     */
    update: (id, data) =>
        apiFetch(`/goals/${id}`, { method: "PUT", body: JSON.stringify(data) }),

    /**
     * Elimina una meta y todos sus aportes.
     * @param {number} id
     */
    delete: (id) => apiFetch(`/goals/${id}`, { method: "DELETE" }),

    /**
     * Registra un aporte a una meta.
     * BUG FIX: endpoint correcto es /contribute (no /allocations).
     * @param {number} id     - ID de la meta.
     * @param {number} amount - Monto a abonar.
     */
    contribute: (id, amount) =>
        apiFetch(`/goals/${id}/contribute`, {
            method: "POST",
            body: JSON.stringify({ amount }),
        }),
};

/**
 * Módulo de resúmenes financieros.
 */
const summary = {
    /**
     * Resumen financiero con totales, categorías y tendencia mensual.
     * @param {object} [params={}] - Filtros: start_date, end_date.
     */
    get: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return apiFetch(`/summary${qs ? "?" + qs : ""}`);
    },

    /** Vista general de metas activas y completadas. */
    goals: () => apiFetch("/summary/goals"),
};

/**
 * Módulo del agente IA "NOVA".
 */
const ai = {
    /**
     * Envía un mensaje al agente y recibe una respuesta.
     * @param {string} message             - Mensaje del usuario.
     * @param {Array}  [history=[]]        - Historial de la conversación actual.
     * @returns {Promise<{data: {message, actionResult, timestamp}}>}
     */
    chat: (message, history = []) =>
        apiFetch("/ai/chat", {
            method: "POST",
            body: JSON.stringify({ message, history }),
        }),

    /** @returns {Promise} Historial guardado en la base de datos. */
    history: () => apiFetch("/ai/history"),

    /** Elimina todo el historial de la conversación. */
    clearHistory: () => apiFetch("/ai/history", { method: "DELETE" }),
};

// ─── Utilidades de formato ────────────────────────────────────────────────────

/**
 * Funciones de formato para mostrar datos en la UI.
 */
const fmt = {
    /**
     * Formatea un número como moneda colombiana (COP).
     * @param {number} n
     * @param {string} [currency='COP']
     * @returns {string} Ej: "$1.500.000"
     */
    currency: (n, currency = "COP") =>
        new Intl.NumberFormat("es-CO", {
            style: "currency",
            currency,
            maximumFractionDigits: 0,
        }).format(n),

    /**
     * Formatea una fecha ISO (YYYY-MM-DD) como texto legible.
     * @param {string} d - Fecha en formato YYYY-MM-DD.
     * @returns {string} Ej: "15 ene 2025"
     */
    date: (d) =>
        new Date(d + "T00:00:00").toLocaleDateString("es-CO", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        }),

    /**
     * Formatea un timestamp completo como fecha y hora legibles.
     * @param {string} d - Timestamp ISO.
     * @returns {string} Ej: "15 ene, 10:30"
     */
    datetime: (d) =>
        new Date(d).toLocaleString("es-CO", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        }),

    /**
     * Trunca un texto largo agregando "…" al final.
     * @param {string} str
     * @param {number} [max=30]
     * @returns {string}
     */
    truncate: (str, max = 30) =>
        str && str.length > max ? str.slice(0, max) + "…" : str,
};

// ─── Toast notifications ──────────────────────────────────────────────────────

/**
 * Sistema de notificaciones tipo toast.
 * Crea elementos flotantes en #toast-container y los elimina después de 3.5s.
 */
const toast = {
    /**
     * Muestra una notificación toast.
     * @param {string} message       - Texto a mostrar.
     * @param {'success'|'error'|'info'} [type='info'] - Tipo visual.
     */
    show: (message, type = "info") => {
        // Buscar o crear el contenedor de toasts
        const container =
            document.getElementById("toast-container") ||
            (() => {
                const el = document.createElement("div");
                el.id = "toast-container";
                document.body.appendChild(el);
                return el;
            })();

        const el = document.createElement("div");
        el.className = `toast toast-${type}`;
        el.innerHTML = `
      <span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span>
      <span>${message}</span>
    `;

        container.appendChild(el);

        // Animar entrada
        setTimeout(() => el.classList.add("show"), 10);

        // Animar salida y eliminar del DOM
        setTimeout(() => {
            el.classList.remove("show");
            setTimeout(() => el.remove(), 400);
        }, 3500);
    },

    /** Notificación de éxito (verde). */
    success: (msg) => toast.show(msg, "success"),

    /** Notificación de error (rojo). */
    error: (msg) => toast.show(msg, "error"),

    /** Notificación informativa (azul/gris). */
    info: (msg) => toast.show(msg, "info"),
};
