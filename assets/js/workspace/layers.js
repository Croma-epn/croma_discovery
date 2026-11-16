// Panel «Capas»: lista de pantallas del proyecto.
import { $, esc } from '../util.js';
import { currentProject } from '../store.js';
import { startScreenId } from './model.js';

// selected: Set de pantallas seleccionadas. La pantalla inicial se distingue con el ícono de casa.
export function render(selected) {
  const project = currentProject();
  if (!project) return;
  const start = startScreenId(project);
  $('treeCount').textContent = project.screens.length;
  $('treeProject').textContent = project.name;
  $('screenTree').innerHTML = project.screens.length
    ? project.screens.map(s => `<button class="tree-item ${selected.has(s.id) ? 'active' : ''}" data-tree="${esc(s.id)}" type="button" title="${esc(s.businessName)}${s.id === start ? ' · pantalla inicial' : ''}"><svg class="ic"><use href="#${s.id === start ? 'i-home' : 'i-phone'}"/></svg><span class="tree-name">${esc(s.businessName)}</span><span class="tree-code">${esc(s.code)}</span></button>`).join('')
    : '<p class="tree-empty">Aún no hay elementos. Agrega el primero desde «Herramientas».</p>';
}

// onPick(id, additive): se eligió una pantalla en la lista (additive: Ctrl/Cmd).
export function initLayers(onPick) {
  $('screenTree').addEventListener('click', e => {
    const item = e.target.closest('[data-tree]');
    if (item) onPick(item.dataset.tree, e.ctrlKey || e.metaKey);
  });
}
