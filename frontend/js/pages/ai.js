/**
 * @file js/pages/ai.js
 * @description Lógica del chat con el agente NOVA (ai.html).
 *
 * Responsabilidades:
 *   - Verificar autenticación y redirigir si no hay sesión.
 *   - Inicializar la hora de bienvenida.
 *   - Gestionar el envío de mensajes (Enter / botón).
 *   - Añadir burbujas de usuario y del agente al DOM.
 *   - Mostrar y ocultar el indicador de "escribiendo…".
 *   - Manejar auto-resize del textarea.
 *   - Conectar los botones de acciones rápidas.
 *
 * Depende de: api.js (ai, requireAuth, toast, getUser).
 * Se carga DESPUÉS de api.js (ver ai.html).
 */

// ── Protección de ruta ────────────────────────────────────────────────────────
if (!requireAuth()) throw new Error('[ai.js] Usuario no autenticado');

// ── Estado del módulo ─────────────────────────────────────────────────────────

/** Historial local de la conversación (máx 8 mensajes para el contexto de OpenAI). */
let conversationHistory = [];

/** Bloquea el envío mientras el agente está procesando. */
let isTyping = false;

// ── Referencias al DOM ────────────────────────────────────────────────────────

const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const sendBtn      = document.getElementById('send-btn');
const welcomeTime  = document.getElementById('welcome-time');

// ── Inicialización ────────────────────────────────────────────────────────────

/** Mostrar hora actual en la burbuja de bienvenida. */
if (welcomeTime) {
  welcomeTime.textContent = new Date().toLocaleTimeString('es-CO', {
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ── Event listeners ───────────────────────────────────────────────────────────

/** Enviar con el botón. */
sendBtn.addEventListener('click', sendMessage);

/**
 * Enviar con Enter (sin Shift).
 * Shift+Enter inserta un salto de línea normal.
 */
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

/** Auto-resize del textarea según el contenido. */
chatInput.addEventListener('input', () => autoResize(chatInput));

/**
 * Delegación de eventos para los botones de acciones rápidas.
 * Cada botón tiene un atributo data-prompt con el texto a enviar.
 */
document.getElementById('quick-actions').addEventListener('click', (e) => {
  const btn = e.target.closest('.quick-btn');
  if (!btn) return;
  const prompt = btn.dataset.prompt;
  if (prompt) {
    chatInput.value = prompt;
    sendMessage();
  }
});

// ── Funciones principales ─────────────────────────────────────────────────────

/**
 * Lee el texto del input, añade la burbuja del usuario y envía el mensaje
 * al backend (POST /api/ai/chat). Muestra el indicador de typing mientras espera.
 * Al recibir la respuesta, añade la burbuja del agente y actualiza el historial.
 *
 * @returns {Promise<void>}
 */
async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message || isTyping) return;

  // Añadir burbuja del usuario inmediatamente (sensación de respuesta rápida)
  addBubble('user', message);

  // Limpiar input y resetear su altura
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Guardar en historial local
  conversationHistory.push({ role: 'user', content: message });

  // Bloquear UI durante la espera
  isTyping      = true;
  sendBtn.disabled = true;

  // Mostrar indicador de typing (tres puntos animados)
  const typingEl = showTypingIndicator();

  try {
    // Enviar al agente con los últimos 8 mensajes como contexto
    const res   = await ai.chat(message, conversationHistory.slice(-8));
    const reply = res.data.message;

    typingEl.remove();

    // Guardar respuesta del agente en el historial
    conversationHistory.push({ role: 'assistant', content: reply });

    addBubble('assistant', reply, new Date(res.data.timestamp));
  } catch (err) {
    typingEl.remove();
    addBubble('assistant', '⚠️ Ocurrió un error al conectar con NOVA. Por favor intenta de nuevo.');
    console.error('[ai.js] sendMessage error:', err);
  } finally {
    isTyping         = false;
    sendBtn.disabled = false;
    scrollToBottom();
  }
}

// ── Render de burbujas ────────────────────────────────────────────────────────

/**
 * Crea y añade una burbuja de chat al contenedor de mensajes.
 * Convierte Markdown básico (**negrita**, saltos de línea) a HTML.
 *
 * @param {'user'|'assistant'} role - Quién envía el mensaje.
 * @param {string} content          - Texto del mensaje.
 * @param {Date}   [time]           - Timestamp del mensaje (defecto: ahora).
 */
function addBubble(role, content, time = new Date()) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;

  // Conversión básica de Markdown a HTML
  const formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // **texto** → negrita
    .replace(/\n/g, '<br />');                         // saltos de línea

  const timeStr = time.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    <div class="bubble-body ${role}">
      ${formatted}
      <span class="bubble-time">${timeStr}</span>
    </div>`;

  chatMessages.appendChild(bubble);
  scrollToBottom();
}

/**
 * Crea y añade el indicador de "escribiendo…" (tres puntos animados).
 * El llamador es responsable de removerlo cuando llegue la respuesta.
 *
 * @returns {HTMLElement} Referencia al elemento para poder eliminarlo después.
 */
function showTypingIndicator() {
  const el = document.createElement('div');
  el.className = 'typing-indicator';
  el.innerHTML = `
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>`;
  chatMessages.appendChild(el);
  scrollToBottom();
  return el;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Hace scroll hasta el último mensaje del chat.
 * Se llama después de cada burbuja añadida.
 */
function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

/**
 * Ajusta dinámicamente la altura del textarea según su contenido.
 * Tiene un máximo de 120px (definido en ai.css con max-height).
 *
 * @param {HTMLTextAreaElement} el - El textarea a redimensionar.
 */
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}
