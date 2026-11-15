/* Menús desplegables. Convención: el botón tiene aria-haspopup="menu" y aria-controls con el id del panel,
   y botón y panel comparten un contenedor. Un clic fuera de ese contenedor cierra el menú. */
import { $ } from '../util.js';

const openTriggers = () => [...document.querySelectorAll('[aria-haspopup="menu"][aria-expanded="true"]')];
const isExpanded = trigger => trigger.getAttribute('aria-expanded') === 'true';

function setMenu(trigger, open) {
  trigger.setAttribute('aria-expanded', String(open));
  $(trigger.getAttribute('aria-controls')).classList.toggle('hidden', !open);
}
export const closeMenus = () => openTriggers().forEach(t => setMenu(t, false));
export function openMenu(trigger) { closeMenus(); setMenu(trigger, true) }
export function toggleMenu(trigger) { isExpanded(trigger) ? setMenu(trigger, false) : openMenu(trigger) }

document.addEventListener('click', e => openTriggers().forEach(t => { if (!t.parentElement.contains(e.target)) setMenu(t, false) }));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const owner = openTriggers().find(t => t.parentElement.contains(document.activeElement));
  closeMenus();
  owner?.focus();
});

/* Menú de opción única (role=menuitemradio) navegable con flechas, Inicio y Fin.
   Devuelve una función para marcar la opción elegida. */
export function initSelectMenu(trigger, onSelect) {
  const items = [...$(trigger.getAttribute('aria-controls')).querySelectorAll('[data-value]')];
  const focusChecked = () => (items.find(item => item.getAttribute('aria-checked') === 'true') || items[0]).focus();
  trigger.addEventListener('click', () => toggleMenu(trigger));
  trigger.addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    openMenu(trigger);
    focusChecked();
  });
  trigger.parentElement.addEventListener('keydown', e => { if (e.key === 'Tab') setMenu(trigger, false) });
  items.forEach((item, i) => {
    item.addEventListener('click', () => { onSelect(item.dataset.value); setMenu(trigger, false); trigger.focus() });
    item.addEventListener('keydown', e => {
      const next = { ArrowDown: (i + 1) % items.length, ArrowUp: (i + items.length - 1) % items.length, Home: 0, End: items.length - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      items[next].focus();
    });
  });
  return value => {
    items.forEach(item => item.setAttribute('aria-checked', String(item.dataset.value === value)));
    trigger.querySelector('.dropdown-label').textContent = items.find(item => item.dataset.value === value).textContent.trim();
  };
}
