/**
 * @file js/pages/login.js
 * @description Lógica de la página de autenticación (index.html).
 *
 * Responsabilidades:
 *   - Redirigir al dashboard si el usuario ya está autenticado.
 *   - Gestionar el switch entre las pestañas "Iniciar sesión" y "Crear cuenta".
 *   - Manejar el submit del formulario de login (POST /api/auth/login).
 *   - Manejar el submit del formulario de registro (POST /api/auth/register).
 *   - Redirigir al flujo de Google OAuth.
 *
 * Depende de: api.js (auth, toast, saveAuth, isLoggedIn).
 * Se carga DESPUÉS de api.js (ver index.html).
 */

// ── Redirección si ya hay sesión activa ───────────────────────────────────────

if (isLoggedIn()) {
    window.location.href = "./dashboard.html";
}

// ── Referencias a elementos del DOM ──────────────────────────────────────────

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const btnGoogle = document.getElementById("btn-google");

// ── Cambio de pestañas ────────────────────────────────────────────────────────

/**
 * Activa la pestaña indicada y muestra el formulario correspondiente.
 * Oculta el formulario que no está activo usando el atributo `hidden`.
 *
 * @param {'login'|'register'} tab - Pestaña a activar.
 */
function switchTab(tab) {
    const isLogin = tab === "login";

    // Alternar clase activa en los botones de pestaña
    tabLogin.classList.toggle("active", isLogin);
    tabRegister.classList.toggle("active", !isLogin);

    // Actualizar atributos ARIA para accesibilidad
    tabLogin.setAttribute("aria-selected", isLogin);
    tabRegister.setAttribute("aria-selected", !isLogin);

    // Mostrar/ocultar formularios con el atributo hidden (semántico)
    loginForm.hidden = !isLogin;
    registerForm.hidden = isLogin;
}

// Escuchar clics en los botones de pestaña usando delegación
document.querySelector(".auth-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".auth-tab");
    if (btn) switchTab(btn.dataset.tab);
});

// ── Formulario de login ───────────────────────────────────────────────────────

/**
 * Maneja el submit del formulario de login.
 * Muestra estado de carga en el botón y redirige al dashboard en caso de éxito.
 *
 * @param {SubmitEvent} e
 */
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("login-btn");
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Entrando…';

    try {
        const res = await auth.login(email, password);
        saveAuth(res.data.token, res.data.user);
        window.location.href = "./dashboard.html";
    } catch (err) {
        toast.error(err.message);
        btn.disabled = false;
        btn.textContent = "Iniciar sesión";
    }
});

// ── Formulario de registro ────────────────────────────────────────────────────

/**
 * Maneja el submit del formulario de registro.
 * Crea la cuenta y redirige al dashboard automáticamente.
 *
 * @param {SubmitEvent} e
 */
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const btn = document.getElementById("register-btn");
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creando cuenta…';

    try {
        const res = await auth.register(name, email, password);
        saveAuth(res.data.token, res.data.user);
        window.location.href = "./dashboard.html";
    } catch (err) {
        toast.error(err.message);
        btn.disabled = false;
        btn.textContent = "Crear mi cuenta";
    }
});

// ── Google OAuth ──────────────────────────────────────────────────────────────

/**
 * Redirige al endpoint de inicio de Google OAuth.
 * El backend (passport.js) maneja el flujo completo y redirige de vuelta
 * al dashboard con el token en los query params.
 */
btnGoogle.addEventListener("click", () => {
    window.location.href = "https://pocketpal-6ydq.onrender.com/api/auth/google";
});
