/* Paneles laterales del lienzo: Herramientas/Capas/Datos (izquierda) y Propiedades (derecha).
   Tablet (≤980 px): Propiedades flota sobre el lienzo. Celular (≤760 px): los paneles izquierdos también. */
import { $ } from '../util.js';

const PANELS = {
  tools: { icon: 'i-tool', label: 'Herramientas', rail: 'railTools' },
  nav: { icon: 'i-layers', label: 'Capas', rail: 'railNav' },
  data: { icon: 'i-database', label: 'Datos', rail: 'railData' },
};
const body = () => $('workspaceBody');
export const isTablet = () => matchMedia('(max-width:980px)').matches;
export const isPhone = () => matchMedia('(max-width:760px)').matches;

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

// Abre un panel izquierdo (p. ej. «Datos» desde Propiedades).
export function showPanel(name) {
  if (isPhone()) collapseProperties();
  collapsePalette(false);
  setPanel(name);
}

// Cada proyecto abre con «Herramientas» activo (HU10 CA1). En celular los paneles empiezan ocultos,
// y en tablet Propiedades también, para dejar libre el lienzo.
export function resetPanels() {
  collapsePalette(isPhone());
  collapseProperties(isTablet());
  setPanel('tools');
}

export function initPanels() {
  Object.entries(PANELS).forEach(([key, { rail }]) => $(rail).addEventListener('click', () => setPanel(key)));
  $('collapsePalette').addEventListener('click', () => collapsePalette());
  $('expandPalette').addEventListener('click', () => { if (isPhone()) collapseProperties(); collapsePalette(false) });
  ['collapseProperties', 'closePropertiesPanel'].forEach(id => $(id).addEventListener('click', () => collapseProperties()));
  $('expandProperties').addEventListener('click', () => { if (isPhone()) collapsePalette(); collapseProperties(false) });
}
