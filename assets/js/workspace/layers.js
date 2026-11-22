/* Panel «Capas»: árbol del proyecto (pantallas → elementos → contenido de los bloques), como el explorador de VS Code:
   guías verticales por nivel y flecha para expandir o contraer los nodos con hijos. */
import { $, esc } from '../util.js';
import { currentProject } from '../store.js';
import { startScreenId, COMPONENTS, findComponent } from './model.js';

const expanded = new Set(); // ids de pantallas y bloques abiertos
let last = [new Set(), null], shownScreen = null, shownComponent = null;

/* Una fila: una guía por cada nivel de ancestro, la flecha (o su hueco si no tiene hijos), el ícono y el nombre.
   kids: id del nodo si tiene hijos (falsy si no). */
function row({ data, depth, icon, name, title, active, kids, extra = '' }) {
  const twist = kids ? '<svg class="ic tree-twist" aria-hidden="true"><use href="#i-chev-down"/></svg>' : '<span class="tree-twist"></span>';
  return `<button class="tree-item${depth ? ' tree-comp' : ''}${active ? ' active' : ''}" ${data} type="button" title="${esc(title)}"${kids ? ` aria-expanded="${expanded.has(kids)}"` : ''}>`
    + `${'<span class="tree-guide"></span>'.repeat(depth)}${twist}<svg class="ic"><use href="#${icon}"/></svg><span class="tree-name">${esc(name)}</span>${extra}</button>`;
}
// Los hijos solo se dibujan si el nodo está abierto.
const children = (id, list, html) => list?.length && expanded.has(id) ? list.map(html).join('') : '';

const compHtml = (screenId, componentId, depth) => c => {
  const { label, icon } = COMPONENTS[c.kind];
  return row({ data: `data-tree="${esc(screenId)}" data-tree-comp="${esc(c.id)}"`, depth, icon, name: c.text, title: `${c.text} · ${label}`, active: c.id === componentId, kids: c.parts?.length && c.id })
    + children(c.id, c.parts, compHtml(screenId, componentId, depth + 1));
};

// Mostrar la ubicación de lo seleccionado: al cambiar de pantalla se abre con sus bloques; al elegir un elemento, su bloque.
function reveal(project, current, componentId) {
  const screen = project.screens.find(s => s.id === current);
  if (current !== shownScreen && screen) [screen, ...(screen.components ?? [])].forEach(n => expanded.add(n.id));
  if (componentId !== shownComponent && screen && componentId) {
    const found = findComponent(screen, componentId);
    [screen, found?.parent, found?.component].forEach(n => n && expanded.add(n.id));
  }
  shownScreen = current; shownComponent = componentId;
}

/* selected: Set de pantallas seleccionadas; si hay una sola, es la pantalla actual.
   componentId: componente seleccionado. La pantalla inicial se distingue con el ícono de casa. */
export function render(selected, componentId = null) {
  const project = currentProject();
  if (!project) return;
  last = [selected, componentId];
  const start = startScreenId(project), current = selected.size === 1 ? [...selected][0] : null;
  reveal(project, current, componentId);
  $('treeCount').textContent = project.screens.length;
  $('treeProject').textContent = project.name;
  $('screenTree').innerHTML = project.screens.length
    ? project.screens.map(s => row({ data: `data-tree="${esc(s.id)}"`, depth: 0, icon: s.id === start ? 'i-home' : 'i-phone', name: s.businessName,
        title: `${s.businessName}${s.id === start ? ' · pantalla inicial' : ''}`, active: selected.has(s.id), kids: s.components?.length && s.id,
        extra: `<span class="tree-code">${esc(s.code)}</span>` }) + children(s.id, s.components, compHtml(s.id, componentId, 1))).join('')
    : '<p class="tree-empty">Aún no hay elementos. Agrega el primero desde «Herramientas».</p>';
}

// Abre o cierra un nodo y deja el foco en su fila.
function toggle(item, open = !expanded.has(nodeId(item))) {
  const id = nodeId(item);
  if (open) expanded.add(id); else expanded.delete(id);
  render(...last);
  $('screenTree').querySelector(item.dataset.treeComp ? `[data-tree-comp="${CSS.escape(id)}"]` : `[data-tree="${CSS.escape(id)}"]:not([data-tree-comp])`)?.focus();
}
const nodeId = item => item.dataset.treeComp || item.dataset.tree;

/* onPick(id, additive): se eligió una pantalla (additive: Ctrl/Cmd). onPickComponent(screenId, componentId): un elemento.
   Clic en la flecha o ←/→ con la fila enfocada: contraer / expandir sin cambiar la selección. */
export function initLayers(onPick, onPickComponent) {
  $('screenTree').addEventListener('click', e => {
    const item = e.target.closest('[data-tree]');
    if (!item) return;
    if (item.hasAttribute('aria-expanded') && e.target.closest('.tree-twist')) return toggle(item);
    if (item.dataset.treeComp) onPickComponent(item.dataset.tree, item.dataset.treeComp);
    else onPick(item.dataset.tree, e.ctrlKey || e.metaKey);
  });
  $('screenTree').addEventListener('keydown', e => {
    const item = e.target.closest('[aria-expanded]'), open = { ArrowRight: true, ArrowLeft: false }[e.key];
    if (!item || open === undefined) return;
    e.preventDefault();
    toggle(item, open);
  });
}
