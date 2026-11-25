// Página «Mis proyectos»: buscar, ordenar, cambiar de vista y acciones de cada proyecto.
import { $, esc, initials, plural } from '../util.js';
import { prefs, userProjects, findProject } from '../store.js';
import { showToast, confirmDialog } from '../ui/feedback.js';
import { closeMenus, toggleMenu, initSelectMenu } from '../ui/menus.js';
import { showAppPage } from '../shell.js';
import { deleteProject, duplicateProject } from './projects.js';

let searchQuery = '', setSortLabel;
let viewMode = prefs.get('view-mode', ['grid', 'list']);
let sortOrder = prefs.get('sort-order', ['recent', 'oldest']);
const grid = () => $('projectGrid');
const query = () => searchQuery.trim().toLowerCase();

/* ---------- Plantillas HTML ---------- */
const cover = p => p.image
  ? `<img src="${esc(p.image)}" alt="Portada de ${esc(p.name)}">`
  : `<span class="cover-initials">${esc(initials(p.name))}</span>`;

const meta = p => ({
  date: new Date(p.updatedAt || p.createdAt).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }),
  screens: plural(p.screens.length, 'pantalla', 'pantallas'),
});

const menu = p => `<div class="card-menu-wrap">
  <button class="card-menu-btn" type="button" aria-haspopup="menu" aria-expanded="false" aria-controls="menu-${esc(p.id)}" title="Opciones del proyecto" aria-label="Opciones de ${esc(p.name)}"><svg class="ic"><use href="#i-more"/></svg></button>
  <div id="menu-${esc(p.id)}" class="menu card-menu hidden" role="menu" aria-label="Opciones de ${esc(p.name)}">
    <button class="menu-item" data-action="edit" type="button" role="menuitem"><svg class="ic"><use href="#i-edit"/></svg><span>Editar proyecto</span></button>
    <button class="menu-item" data-action="duplicate" type="button" role="menuitem"><svg class="ic"><use href="#i-copy"/></svg><span>Duplicar proyecto</span></button>
    <button class="menu-item danger" data-action="delete" type="button" role="menuitem"><svg class="ic"><use href="#i-trash"/></svg><span>Borrar proyecto</span></button>
  </div></div>`;

const card = (p, i) => { const m = meta(p); return `<article class="project-card" role="button" tabindex="0" data-project="${esc(p.id)}" style="--i:${i}">
  <div class="project-cover">${cover(p)}</div>
  <div class="card-title-row"><h3>${esc(p.name)}</h3>${menu(p)}</div>
  <p class="desc">${esc(p.description || 'Sin descripción. Abre el proyecto para comenzar a modelar sus pantallas.')}</p>
  <div class="card-meta"><span>Actualizado ${m.date}</span><span class="screen-count">${m.screens}</span></div></article>` };

const row = p => { const m = meta(p); return `<article class="project-row" role="button" tabindex="0" data-project="${esc(p.id)}">
  <div class="row-thumb">${cover(p)}</div>
  <div class="row-main"><h3>${esc(p.name)}</h3><p>${esc(p.description || 'Sin descripción.')}</p></div>
  <div class="row-meta"><span>${m.date}</span><span class="screen-count">${m.screens}</span></div>
  <div class="row-actions">${menu(p)}<svg class="ic row-arrow"><use href="#i-chev-right"/></svg></div></article>` };

const createButton = () => `<button id="createProjectCard" class="create-card" type="button"><span class="create-plus">+</span><strong>Crear proyecto</strong>${viewMode === 'list' ? '<svg class="ic"><use href="#i-chev-right"/></svg>' : ''}</button>`;

const empty = (icon, title, text) => `<div class="projects-empty"><svg class="ic"><use href="#${icon}"/></svg><h3>${title}</h3><p>${text}</p></div>`;

/* ---------- Render ---------- */
// animate=false: las tarjetas que ya estaban no repiten su animación de entrada.
export function renderProjects({ animate = true } = {}) {
  const projects = userProjects(sortOrder), q = query();
  const shown = q ? projects.filter(p => `${p.name || ''} ${p.description || ''}`.toLowerCase().includes(q)) : projects;
  $('projectCount').innerHTML = `<svg class="ic"><use href="#i-folder"/></svg> ${q ? `${shown.length} de ${projects.length}` : plural(projects.length, 'proyecto', 'proyectos')}`;
  const noResults = q
    ? empty('i-search', 'Sin resultados', `No encontramos proyectos que coincidan con «${esc(searchQuery.trim())}».`)
    : empty('i-folder', 'Aún no tienes proyectos', 'Crea tu primer proyecto con el botón «Crear proyecto».');
  grid().classList.toggle('no-enter', !animate);
  grid().classList.toggle('list-view', viewMode === 'list');
  grid().innerHTML = createButton() + (shown.length ? shown.map(viewMode === 'list' ? row : card).join('') : noResults);
}

export function showPortfolio() {
  showAppPage('portfolio', { title: 'Mis proyectos' });
  renderProjects();
}

function setView(mode) {
  viewMode = mode;
  prefs.set('view-mode', mode);
  renderViewToggle();
  renderProjects();
}
function renderViewToggle() {
  $('viewGrid').setAttribute('aria-pressed', String(viewMode === 'grid'));
  $('viewList').setAttribute('aria-pressed', String(viewMode === 'list'));
}

/* ---------- Acciones de proyecto ---------- */
function duplicate(id) {
  const copy = duplicateProject(findProject(id));
  // Si la búsqueda ocultaría la copia, se limpia para que el estudiante la vea.
  if (query() && !copy.name.toLowerCase().includes(query())) { searchQuery = ''; $('projectSearch').value = '' }
  renderProjects({ animate: false });
  const item = grid().querySelector(`[data-project="${copy.id}"]`);
  item?.classList.add('just-added');
  item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  showToast(`Se creó «${copy.name}».`);
}

async function remove(id) {
  const project = findProject(id);
  const count = project.screens.length;
  const detail = count ? `Se eliminará «${project.name}» y ${count === 1 ? 'su pantalla' : `sus ${count} pantallas`}.` : `Se eliminará «${project.name}».`;
  const confirmed = await confirmDialog({ title: '¿Borrar proyecto?', message: `${detail} Esta acción no se puede deshacer.`, confirm: 'Borrar proyecto' });
  if (!confirmed) return;
  deleteProject(id);
  renderProjects();
  showToast('Proyecto borrado.');
}

// onOpen(id): abre el lienzo. onCreate: va a «Crear proyecto». onEdit(id): abre el modal de edición.
export function initPortfolio({ onOpen, onCreate, onEdit }) {
  const actions = { edit: onEdit, duplicate, delete: remove };
  $('projectSearch').addEventListener('input', e => { searchQuery = e.target.value; renderProjects() });
  $('viewGrid').addEventListener('click', () => setView('grid'));
  $('viewList').addEventListener('click', () => setView('list'));
  setSortLabel = initSelectMenu($('sortProjects'), order => {
    sortOrder = order;
    prefs.set('sort-order', order);
    setSortLabel(order);
    renderProjects();
  });
  setSortLabel(sortOrder);
  renderViewToggle();

  // Un solo manejador para todas las tarjetas, aunque se vuelvan a dibujar.
  grid().addEventListener('click', e => {
    const menuButton = e.target.closest('.card-menu-btn');
    const action = e.target.closest('[data-action]');
    const item = e.target.closest('[data-project]');
    if (e.target.closest('#createProjectCard')) onCreate();
    else if (menuButton) toggleMenu(menuButton);
    else if (action) { closeMenus(); actions[action.dataset.action](item.dataset.project) }
    else if (item && !e.target.closest('.card-menu-wrap')) onOpen(item.dataset.project);
  });
  grid().addEventListener('keydown', e => {
    const item = e.target.closest('[data-project]');
    if (!item || e.target.closest('.card-menu-wrap') || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    onOpen(item.dataset.project);
  });
}
