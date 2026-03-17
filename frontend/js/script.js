/**
 * @file js/script.js
 * @description Sidebar móvil del dashboard.
 *
 * En pantallas pequeñas (< 1024px) el sidebar está oculto por defecto
 * (transform: translateX(-100%) definido en dashboard.css).
 * Este script gestiona su apertura y cierre.
 *
 * Estrategia:
 *   - Abrir: añade clase .open al sidebar y al overlay.
 *   - Cerrar: remueve la clase .open.
 *   - El overlay recibe el clic fuera del sidebar para cerrarlo.
 *   - Los botones de scroll del nav se cierran en móvil después de navegar.
 *
 * Depende de: dashboard.html (IDs: sidebar, sidebar-overlay, btn-menu).
 * No depende de api.js ni de ningún módulo.
 */

const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("sidebar-overlay");
const btnMenu = document.getElementById("btn-menu");

/**
 * Abre el sidebar deslizándolo desde la izquierda.
 * También muestra el overlay oscuro detrás.
 */
function openSidebar() {
    sidebar?.classList.add("open");
    overlay?.classList.add("open");
}

/**
 * Cierra el sidebar y oculta el overlay.
 */
function closeSidebar() {
    sidebar?.classList.remove("open");
    overlay?.classList.remove("open");
}

/** Mostrar el botón de menú solo en pantallas pequeñas. */
function updateMenuVisibility() {
    if (btnMenu) {
        btnMenu.style.display = window.innerWidth < 1024 ? "grid" : "none";
    }
}

// Eventos
btnMenu?.addEventListener("click", openSidebar);
overlay?.addEventListener("click", closeSidebar);

// Cerrar sidebar al tocar cualquier nav-item o data-scroll en móvil
sidebar?.addEventListener("click", (e) => {
    const target = e.target.closest(".nav-item, [data-scroll]");
    if (target && window.innerWidth < 1024) closeSidebar();
});

// Mostrar/ocultar botón de menú según el ancho de pantalla
window.addEventListener("resize", updateMenuVisibility);
updateMenuVisibility(); // ejecutar una vez al cargar
