/* Vistas del proyecto (pestañas Datos / Interfaces de la barra superior) y paneles laterales del lienzo:
   Herramientas/Capas (izquierda) y Propiedades (derecha).
   Tablet (≤980 px): Propiedades flota sobre el lienzo. Celular (≤760 px): los paneles izquierdos también. */
import { $, token } from '../util.js';

const PANELS = {
  tools: { icon: 'i-tool', label: 'Herramientas', rail: 'railTools' },
  nav: { icon: 'i-layers', label: 'Capas', rail: 'railNav' },
};
const body = () => $('workspaceBody');
export const isTablet = () => matchMedia(`(max-width:${token('quiebre-tablet')})`).matches;
export const isPhone = () => matchMedia(`(max-width:${token('quiebre-celular')})`).matches;

export function collapsePalette(collapsed = true) {
  body().classList.toggle('palette-collapsed', collapsed);
  $('collapsePalette').setAttribute('aria-expanded', String(!collapsed));
}
export function collapseProperties(collapsed = true) {
  body().classList.toggle('properties-collapsed', collapsed);
  $('collapseProperties').setAttribute('aria-expanded', String(!collapsed));
}
// En pantallas pequeñas, tocar el lienzo cierra los paneles que flotan sobre él.
export function collapseFloatingPanels() {
  if (isPhone()) collapsePalette();
  if (isTablet()) collapseProperties();
}

function setPanel(name) {
  body().dataset.panel = name;
  Object.entries(PANELS).forEach(([key, { rail }]) => $(rail).classList.toggle('active', key === name));
  // La lengüeta para volver a mostrar el panel indica el último panel usado.
  const { icon, label } = PANELS[name], tab = $('expandPalette');
  tab.querySelector('use').setAttribute('href', `#${icon}`);
  tab.querySelector('span').textContent = label;
  tab.title = `Mostrar panel ${label}`;
  tab.setAttribute('aria-label', tab.title);
}

// O se ven los datos o las interfaces (prueba de usabilidad Sprint 2): la vista elegida ocupa todo el espacio de trabajo.
const TABS = ['tabData', 'tabInterfaces'];
export const isDataView = () => !$('dataView').classList.contains('hidden');
export function setView(view) {
  $('dataView').classList.toggle('hidden', view !== 'data');
  body().classList.toggle('hidden', view === 'data');
  TABS.forEach(id => {
    const selected = $(id).dataset.view === view;
    $(id).setAttribute('aria-selected', String(selected));
    $(id).tabIndex = selected ? 0 : -1; // patrón de pestañas WAI-ARIA: Tab entra a la elegida, las flechas cambian
  });
}

// Cada proyecto abre en «Interfaces» con «Herramientas» activo (HU10 CA1). En celular los paneles empiezan ocultos,
// y en tablet Propiedades también, para dejar libre el lienzo.
export function resetPanels() {
  collapsePalette(isPhone());
  collapseProperties(isTablet());
  setPanel('tools');
  setView('interfaces');
}

export function initPanels() {
  const tabs = $('viewTabs');
  tabs.addEventListener('click', e => { const tab = e.target.closest('[role=tab]'); if (tab) setView(tab.dataset.view) });
  tabs.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const next = $(TABS.find(id => $(id).tabIndex === -1));
    setView(next.dataset.view);
    next.focus();
  });
  Object.entries(PANELS).forEach(([key, { rail }]) => $(rail).addEventListener('click', () => setPanel(key)));
  $('collapsePalette').addEventListener('click', () => collapsePalette());
  $('expandPalette').addEventListener('click', () => { if (isPhone()) collapseProperties(); collapsePalette(false) });
  ['collapseProperties', 'closePropertiesPanel'].forEach(id => $(id).addEventListener('click', () => collapseProperties()));
  $('expandProperties').addEventListener('click', () => { if (isPhone()) collapsePalette(); collapseProperties(false) });
}
