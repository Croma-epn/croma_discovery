// Marco de la app: qué página se ve, barra superior (título, guardado) y menú de cuenta.
import { $, initials } from './util.js';
import { persist, onSaveStatus } from './store.js';
import { closeMenus, toggleMenu } from './ui/menus.js';
import { confirmDialog } from './ui/feedback.js';

const AUTH_PAGES = ['login', 'register', 'recover'];
const APP_PAGES = ['portfolio', 'createProject', 'workspace'];
const page = name => $(`${name}Page`);

export function showAuthPage(name) {
  $('appShell').classList.add('hidden');
  AUTH_PAGES.forEach(p => page(p).classList.toggle('hidden', p !== name));
  closeMenus();
}

/* title: texto de la barra superior. saved: muestra el indicador de guardado.
   editable: el título se puede editar con un clic (lo gestiona la página). */
export function showAppPage(name, { title, saved = false, editable = false }) {
  AUTH_PAGES.forEach(p => page(p).classList.add('hidden'));
  $('appShell').classList.remove('hidden');
  APP_PAGES.forEach(p => page(p).classList.toggle('hidden', p !== name));
  const heading = $('breadcrumbCurrent');
  heading.textContent = title;
  heading.classList.toggle('editable', editable);
  editable ? heading.setAttribute('tabindex', '0') : heading.removeAttribute('tabindex');
  heading.title = editable ? 'Cambiar nombre' : '';
  $('saveButton').classList.toggle('hidden', !saved);
  $('viewTabs').classList.toggle('hidden', name !== 'workspace');
  closeMenus();
}

export function renderAccount(user) {
  $('accountAvatar').textContent = $('menuAvatar').textContent = initials(user.name);
  $('accountName').textContent = user.name;
  $('accountEmail').textContent = user.email;
}

/* ---------- Guardado (HU07): indicador con el estado real + guardar a mano ---------- */
// La hora del último guardado responde «¿se guardó lo último?» (como Google Docs).
const now = () => new Date().toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const SAVE_STATES = {
  saved: { icon: 'i-check', text: () => `Guardado · ${now()}` },
  saving: { icon: 'i-save', text: () => 'Guardando…' },
  error: { icon: 'i-info', text: () => 'No se pudo guardar' },
};
function renderSaveState(state) {
  const button = $('saveButton'), { icon, text } = SAVE_STATES[state];
  button.dataset.state = state;
  button.querySelector('use').setAttribute('href', `#${icon}`);
  button.querySelector('span').textContent = text();
}
// Guarda de inmediato y lo confirma con un pulso en ícono y texto (sin mensajes grandes).
function saveNow() {
  persist();
  const button = $('saveButton');
  button.classList.remove('flash');
  void button.offsetWidth; // reinicia la animación si se guarda dos veces seguidas
  button.classList.add('flash');
}

export function initShell({ onHome, onLogout }) {
  onSaveStatus(renderSaveState);
  $('saveButton').addEventListener('click', saveNow);
  document.addEventListener('keydown', e => {
    if (e.key.toLowerCase() !== 's' || !(e.ctrlKey || e.metaKey) || $('appShell').classList.contains('hidden')) return;
    e.preventDefault(); // evita el «Guardar página» del navegador
    saveNow();
  });

  $('brandHome').addEventListener('click', onHome);
  $('userMenuBtn').addEventListener('click', () => toggleMenu($('userMenuBtn')));
  $('logoutButton').addEventListener('click', async () => {
    closeMenus();
    const confirmed = await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tus proyectos se mantienen guardados.', confirm: 'Cerrar sesión', cancel: 'Seguir aquí' });
    if (confirmed) onLogout();
  });
}
