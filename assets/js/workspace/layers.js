// Panel «Capas»: pantallas del proyecto y, debajo de la pantalla actual, su árbol: bloques y elementos con su jerarquía real.
import { $, esc } from '../util.js';
import { currentProject } from '../store.js';
import { startScreenId, COMPONENTS } from './model.js';

const compItem = (screenId, componentId, depth) => c => {
  const { label, icon } = COMPONENTS[c.kind];
  return `<button class="tree-item tree-comp tree-depth-${depth} ${c.id === componentId ? 'active' : ''}" data-tree="${esc(screenId)}" data-tree-comp="${esc(c.id)}" type="button" title="${esc(c.text)} · ${label}"><svg class="ic"><use href="#${icon}"/></svg><span class="tree-name">${esc(c.text)}</span></button>`;
};
// Árbol de una pantalla: sus elementos (nivel 1) y lo que contiene cada bloque (nivel 2), en el orden del lienzo.
const treeHtml = (s, componentId) => (s.components ?? [])
  .map(c => compItem(s.id, componentId, 1)(c) + (c.parts ?? []).map(compItem(s.id, componentId, 2)).join('')).join('');

/* selected: Set de pantallas seleccionadas; si hay una sola, es la pantalla actual y se despliega su árbol.
   componentId: componente seleccionado. La pantalla inicial se distingue con el ícono de casa. */
export function render(selected, componentId = null) {
  const project = currentProject();
  if (!project) return;
  const start = startScreenId(project), current = selected.size === 1 ? [...selected][0] : null;
  $('treeCount').textContent = project.screens.length;
  $('treeProject').textContent = project.name;
  $('screenTree').innerHTML = project.screens.length
    ? project.screens.map(s => `<button class="tree-item ${selected.has(s.id) ? 'active' : ''}" data-tree="${esc(s.id)}" type="button" title="${esc(s.businessName)}${s.id === start ? ' · pantalla inicial' : ''}"><svg class="ic"><use href="#${s.id === start ? 'i-home' : 'i-phone'}"/></svg><span class="tree-name">${esc(s.businessName)}</span><span class="tree-code">${esc(s.code)}</span></button>${s.id === current ? treeHtml(s, componentId) : ''}`).join('')
    : '<p class="tree-empty">Aún no hay elementos. Agrega el primero desde «Herramientas».</p>';
}

// onPick(id, additive): se eligió una pantalla (additive: Ctrl/Cmd). onPickComponent(screenId, componentId): un elemento del árbol.
export function initLayers(onPick, onPickComponent) {
  $('screenTree').addEventListener('click', e => {
    const item = e.target.closest('[data-tree]');
    if (!item) return;
    if (item.dataset.treeComp) onPickComponent(item.dataset.tree, item.dataset.treeComp);
    else onPick(item.dataset.tree, e.ctrlKey || e.metaKey);
  });
}
