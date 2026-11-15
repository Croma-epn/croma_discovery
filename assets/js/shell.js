// Marco de la app: qué página se ve, barra superior y menú de cuenta.
import { $, initials } from './util.js';
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

// title: texto de la barra superior. saved: muestra «Guardado automáticamente».
export function showAppPage(name, { title, saved = false }) {
  AUTH_PAGES.forEach(p => page(p).classList.add('hidden'));
  $('appShell').classList.remove('hidden');
  APP_PAGES.forEach(p => page(p).classList.toggle('hidden', p !== name));
  $('breadcrumbCurrent').textContent = title;
  $('savedState').classList.toggle('hidden', !saved);
  closeMenus();
}

export function renderAccount(user) {
  $('accountAvatar').textContent = $('menuAvatar').textContent = initials(user.name);
  $('accountName').textContent = user.name;
  $('accountEmail').textContent = user.email;
}

export function initShell({ onHome, onLogout }) {
  $('brandHome').addEventListener('click', onHome);
  $('userMenuBtn').addEventListener('click', () => toggleMenu($('userMenuBtn')));
  $('logoutButton').addEventListener('click', async () => {
    closeMenus();
    const confirmed = await confirmDialog({ title: '¿Cerrar sesión?', message: 'Tus proyectos se mantienen guardados.', confirm: 'Cerrar sesión', cancel: 'Seguir aquí' });
    if (confirmed) onLogout();
  });
}
