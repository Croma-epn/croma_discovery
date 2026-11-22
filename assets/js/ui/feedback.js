// Notificaciones, modales y diálogo de confirmación.
import { $, esc, focusLater } from '../util.js';

/* ---------- Notificaciones ---------- */
// action: { label, onClick } añade un botón (p. ej. «Deshacer»). icon: 'i-info' para avisos que no confirman un éxito.
// La notificación no se cierra mientras se apunta o enfoca. Se apilan hasta MAX_TOASTS.
const MAX_TOASTS = 5;
export function showToast(message, { action, ms, icon = 'i-check' } = {}) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<svg class="ic"><use href="#${icon}"/></svg><span>${esc(message)}</span>`;
  let timer;
  const dismiss = () => { clearTimeout(timer); toast.remove() };
  const pause = () => clearTimeout(timer);
  const schedule = () => { pause(); timer = setTimeout(dismiss, ms || (action ? 8000 : 3400)) };
  if (action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toast-action';
    button.textContent = action.label;
    button.addEventListener('click', () => { dismiss(); action.onClick() }, { once: true });
    toast.append(button);
  }
  ['mouseenter', 'focusin'].forEach(ev => toast.addEventListener(ev, pause));
  ['mouseleave', 'focusout'].forEach(ev => toast.addEventListener(ev, schedule));
  const stack = $('toastStack');
  stack.append(toast);
  while (stack.children.length > MAX_TOASTS) stack.firstElementChild.remove(); // la más antigua deja espacio a la nueva
  schedule();
}

/* ---------- Modales ---------- */
export const isOpen = backdrop => !backdrop.classList.contains('hidden');
export const showModal = backdrop => backdrop.classList.remove('closing', 'hidden');
export function hideModal(backdrop) {
  if (!isOpen(backdrop)) return;
  backdrop.classList.add('closing'); // deja terminar la animación de salida
  setTimeout(() => { if (backdrop.classList.contains('closing')) backdrop.classList.replace('closing', 'hidden') }, 170);
}

// Clic fuera del modal o Escape ejecutan onDismiss del modal abierto.
const dismissers = new Map();
export function registerModal(backdrop, onDismiss) {
  dismissers.set(backdrop, onDismiss);
  backdrop.addEventListener('click', e => { if (e.target === backdrop) onDismiss() });
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = [...dismissers].find(([backdrop]) => isOpen(backdrop));
  open?.[1]();
});

/* ---------- Confirmación de acciones destructivas ---------- */
let resolveDialog = null;
function finishDialog(confirmed) {
  hideModal($('dialogBackdrop'));
  resolveDialog?.(confirmed);
  resolveDialog = null;
}
export function initDialog() {
  registerModal($('dialogBackdrop'), () => finishDialog(false));
  $('dialogConfirm').addEventListener('click', () => finishDialog(true));
  $('dialogCancel').addEventListener('click', () => finishDialog(false));
}
// Devuelve una promesa que se resuelve en true si el usuario confirma. El foco empieza en «Cancelar».
export function confirmDialog({ title, message, confirm, cancel = 'Cancelar' }) {
  $('dialogTitle').textContent = title;
  $('dialogCopy').textContent = message;
  $('dialogConfirm').textContent = confirm;
  $('dialogCancel').textContent = cancel;
  showModal($('dialogBackdrop'));
  focusLater('dialogCancel');
  return new Promise(resolve => { resolveDialog = resolve });
}
