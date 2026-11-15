// Panel «Capas»: lista de pantallas del proyecto.
import { $, esc } from '../util.js';
import { currentProject, session } from '../store.js';

export function render() {
  const project = currentProject();
  if (!project) return;
  $('treeCount').textContent = project.screens.length;
  $('treeProject').textContent = project.name;
  $('screenTree').innerHTML = project.screens.length
    ? project.screens.map(s => `<button class="tree-item ${s.id === session.screenId ? 'active' : ''}" data-tree="${esc(s.id)}" type="button" title="${esc(s.businessName)}"><svg class="ic"><use href="#i-phone"/></svg><span class="tree-name">${esc(s.businessName)}</span><span class="tree-code">${esc(s.code)}</span></button>`).join('')
    : '<p class="tree-empty">Aún no hay elementos. Agrega el primero desde «Herramientas».</p>';
}

// onPick(id): se eligió una pantalla en la lista.
export function initLayers(onPick) {
  $('screenTree').addEventListener('click', e => {
    const item = e.target.closest('[data-tree]');
    if (item) onPick(item.dataset.tree);
  });
}
