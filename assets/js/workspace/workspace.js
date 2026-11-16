/* Espacio de trabajo de un proyecto. Coordina lienzo, capas, propiedades y paneles:
   esos módulos no se conocen entre sí, avisan aquí mediante callbacks. */
import { $, uid, plural } from '../util.js';
import { session, findProject, currentProject, saveProject } from '../store.js';
import { showToast, isOpen } from '../ui/feedback.js';
import { editInline } from '../ui/inline-edit.js';
import { showAppPage } from '../shell.js';
import { NAME_MAX, updateProject } from '../projects/projects.js';
import * as model from './model.js';
import * as canvas from './canvas.js';
import * as layers from './layers.js';
import * as properties from './properties.js';
import * as dataPanel from './data-panel.js';
import { initPanels, resetPanels, collapsePalette, collapseFloatingPanels, isPhone, showPanel } from './panels.js';

// Pantallas seleccionadas. session.screenId es la última elegida (la que muestran las propiedades).
const selection = new Set();
const selectedScreens = () => currentProject().screens.filter(s => selection.has(s.id));
// Componente seleccionado (suelto o dentro de un bloque): pertenece a la pantalla session.screenId, que queda seleccionada sola.
let componentId = null;
const findScreen = id => currentProject().screens.find(s => s.id === id);
const pickedComponent = () => (componentId && model.findComponent(findScreen(session.screenId) ?? {}, componentId)?.component) || null;

export function openWorkspace(id) {
  const project = findProject(id);
  if (!project) return;
  session.projectId = id;
  if (project.screens.map(model.nestLooseFields).some(Boolean)) saveProject(project); // campos sueltos de versiones anteriores
  showAppPage('workspace', { title: project.name, saved: true, editable: true });
  resetPanels();
  selection.clear();
  if (project.screens[0]) selection.add(project.screens[0].id);
  refresh();
  dataPanel.render();
  canvas.fit();
}

/* ---------- Selección ---------- */
function renderSelection() {
  canvas.highlight(selection, componentId);
  layers.render(selection);
  properties.render(selectedScreens(), pickedComponent());
}
// toggle: agrega o quita la pantalla de la selección (Ctrl/Cmd + clic).
function select(id, { toggle = false } = {}) {
  componentId = null;
  if (!toggle) selection.clear();
  if (id && toggle && selection.has(id)) selection.delete(id);
  else if (id) selection.add(id);
  session.screenId = [...selection].at(-1) ?? null;
  renderSelection();
}
function setSelection(ids) {
  componentId = null;
  selection.clear();
  ids.forEach(id => selection.add(id));
  session.screenId = ids.at(-1) ?? null;
  renderSelection();
}
let marqueeBase = []; // selección previa que se conserva con Ctrl/Cmd + rectángulo
function refresh() {
  const project = currentProject();
  canvas.render();
  canvas.markStart(model.startScreenId(project));
  [...selection].forEach(id => { if (!project.screens.some(s => s.id === id)) selection.delete(id) });
  session.screenId = [...selection].at(-1) ?? null;
  if (!pickedComponent()) componentId = null;
  renderSelection();
}

/* ---------- Pantallas ---------- */
// Sin coordenadas, aparece junto a la pantalla seleccionada (o en la cuadrícula si no hay ninguna).
function addScreen(x, y) {
  const project = currentProject();
  if (!project) return;
  const n = model.nextScreenNumber(project), ref = selection.size === 1 && project.screens.find(s => s.id === session.screenId);
  const spot = x === undefined ? (ref ? model.spotNextTo(project, ref) : model.gridSpot(project)) : { x, y };
  const screen = { id: uid(), code: model.screenCode(n), technicalName: `Pantalla${n}`, businessName: `Nueva pantalla ${n}`, ...spot };
  project.screens.push(screen);
  saveProject(project);
  canvas.add(screen);
  select(screen.id);
  canvas.reveal(screen);
  showToast('Pantalla agregada al lienzo.');
}

function renameScreen(id, name) {
  const screen = currentProject().screens.find(s => s.id === id);
  screen.businessName = name;
  saveProject(currentProject());
  canvas.updateNode(screen);
  renderSelection();
}

function setStart(id) {
  const project = currentProject();
  model.setStart(project, id);
  saveProject(project);
  canvas.markStart(id);
  renderSelection();
}

function align(kind) {
  const screens = selectedScreens();
  model.alignScreens(screens, kind);
  screens.forEach(canvas.applySize);
  saveProject(currentProject());
}

function deleteScreens(ids) {
  const project = currentProject();
  const removed = project.screens.map((screen, index) => ({ screen, index })).filter(({ screen }) => ids.includes(screen.id));
  if (!removed.length) return;
  const previousStart = model.startScreenId(project);
  project.screens = project.screens.filter(s => !ids.includes(s.id));
  model.dropMissingStart(project);
  saveProject(project);
  refresh();
  const message = removed.length === 1 ? 'Elemento eliminado.' : `${plural(removed.length, 'elemento', 'elementos')} eliminados.`;
  showToast(message, { action: { label: 'Deshacer', onClick: () => restoreScreens(project, removed, previousStart) } });
}
function restoreScreens(project, removed, previousStart) {
  if (session.user?.id !== project.userId || !findProject(project.id)) return;
  removed.forEach(({ screen, index }) => {
    if (project.screens.some(s => s.id === screen.id)) return;
    if (project.screens.some(s => s.code === screen.code)) screen.code = model.screenCode(model.nextScreenNumber(project)); // su código se reutilizó
    project.screens.splice(Math.min(index, project.screens.length), 0, screen);
  });
  if (removed.some(({ screen }) => screen.id === previousStart)) model.setStart(project, previousStart);
  saveProject(project);
  if (currentProject() === project) {
    selection.clear();
    removed.forEach(({ screen }) => selection.add(screen.id));
    refresh();
  }
  showToast(removed.length === 1 ? 'Elemento restaurado.' : `${plural(removed.length, 'elemento', 'elementos')} restaurados.`);
}

/* ---------- Componentes (HU14) ---------- */
function pick(screenId, id) {
  selection.clear();
  selection.add(screenId);
  session.screenId = screenId;
  componentId = id;
  renderSelection();
}
// blockId: bloque donde se soltó (null = la pantalla). Si el tipo no puede ir ahí, se avisa por qué.
function addComponent(screenId, kind, blockId = null) {
  const project = currentProject(), screen = findScreen(screenId), block = blockId && model.findComponent(screen, blockId).component;
  const error = model.placementError(kind, block);
  if (error) return showToast(error, { icon: 'i-info' });
  const component = model.addComponent(screen, kind, block || null);
  saveProject(project);
  canvas.updateComponents(screen);
  pick(screenId, component.id);
}
/* Clic en la paleta (alternativa al arrastre): va al bloque seleccionado (o al del elemento seleccionado) si puede ir ahí;
   si no, a la pantalla seleccionada. */
function addComponentToSelection(kind) {
  if (selection.size === 1) {
    const found = componentId && model.findComponent(findScreen(session.screenId), componentId);
    const block = found && (found.component.parts ? found.component : found.parent);
    return addComponent(session.screenId, kind, block && !model.placementError(kind, block) ? block.id : null);
  }
  showToast(selection.size ? 'Selecciona una sola pantalla para agregarle el componente.' : 'Selecciona una pantalla para agregarle el componente, o arrástralo sobre ella.', { icon: 'i-info' });
}
// Borrar un bloque borra también lo que contiene; «Deshacer» lo devuelve completo.
function deleteComponent(screenId, id) {
  const project = currentProject(), screen = findScreen(screenId), { list } = model.findComponent(screen, id);
  const index = list.findIndex(c => c.id === id), [removed] = list.splice(index, 1);
  saveProject(project);
  canvas.updateComponents(screen);
  if (!pickedComponent()) componentId = null;
  renderSelection();
  const message = removed.parts?.length ? 'Bloque eliminado con su contenido.' : 'Componente eliminado.';
  showToast(message, { action: { label: 'Deshacer', onClick: () => restoreComponent(project, screen, list, removed, index) } });
}
function restoreComponent(project, screen, list, component, index) {
  const listAlive = list === screen.components || model.allComponents(screen).some(c => c.parts === list);
  if (session.user?.id !== project.userId || !findProject(project.id) || !project.screens.includes(screen) || !listAlive) return;
  list.splice(Math.min(index, list.length), 0, component);
  saveProject(project);
  if (currentProject() === project) { canvas.updateComponents(screen); pick(screen.id, component.id) }
  showToast(component.parts ? 'Bloque restaurado.' : 'Componente restaurado.');
}
const PALETTE_GROUPS = [['Elementos', ({ block }) => !block], ['Bloques', ({ block }) => block]];
const paletteItem = ([kind, { label, icon }]) =>
  `<button class="palette-item" type="button" draggable="true" data-component="${kind}" aria-label="Agregar ${label.toLowerCase()}"><span class="palette-icon"><svg class="ic"><use href="#${icon}"/></svg></span><span><strong>${label}</strong></span></button>`;

const startRename = id => { select(id); canvas.rename(id, name => renameScreen(id, name)) };

// Clic en el nombre del proyecto (barra superior) para cambiarlo ahí mismo.
function renameProject() {
  editInline($('breadcrumbCurrent'), {
    label: 'Nombre del proyecto', maxLength: NAME_MAX,
    onCommit: name => {
      updateProject(currentProject(), { name });
      $('breadcrumbCurrent').textContent = name;
      layers.render(selection);
    },
  });
}

const isTyping = target => target.matches('input, textarea, select') || target.isContentEditable;
const inWorkspace = () => !$('workspacePage').classList.contains('hidden') && !isOpen($('dialogBackdrop'));

export function initWorkspace() {
  initPanels();
  canvas.initCanvas({
    press(id, additive) {
      if (additive) select(id, { toggle: true });
      else if (!selection.has(id)) select(id);
      return selection.has(id) ? [...selection] : [];
    },
    release(id, additive) { if (!additive && (selection.size > 1 || componentId)) select(id) },
    marqueeStart: additive => { marqueeBase = additive ? [...selection] : [] },
    marqueeMove: ids => setSelection([...new Set([...marqueeBase, ...ids])]),
    clear: () => select(null),
    edit: startRename,
    remove: id => deleteScreens([id]),
    resize: s => { if (s.id === session.screenId) properties.fillSize(s) },
    drop: addScreen,
    background: collapseFloatingPanels,
    pick,
    dropComponent: addComponent,
    removeComponent: deleteComponent,
  });
  properties.initProperties({
    rename: s => { canvas.updateNode(s); layers.render(selection) },
    resize: canvas.applySize,
    start: setStart,
    align,
    component: s => { canvas.updateComponents(s); canvas.highlight(selection, componentId) },
    openData: () => showPanel('data'),
  });
  // Cambiar el modelo de dominio actualiza los nombres de entidades y datos que muestran las pantallas.
  dataPanel.initDataPanel(() => { currentProject().screens.forEach(canvas.updateComponents); renderSelection() });
  layers.initLayers((id, additive) => {
    const screen = currentProject()?.screens.find(s => s.id === id);
    if (!screen) return;
    select(id, { toggle: additive });
    canvas.reveal(screen);
    if (isPhone() && !additive) collapsePalette(); // en celular el panel tapa el lienzo: se cierra para ver la pantalla elegida
  });

  $('screenPalette').addEventListener('click', () => { addScreen(); if (isPhone()) collapsePalette() });
  $('screenPalette').addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'screen'); e.dataTransfer.effectAllowed = 'copy' });

  const palette = $('componentPalette'), kindOf = e => e.target.closest('[data-component]')?.dataset.component;
  palette.innerHTML = PALETTE_GROUPS.map(([title, inGroup]) => `<p class="palette-group">${title}</p>`
    + Object.entries(model.COMPONENTS).filter(([, c]) => inGroup(c)).map(paletteItem).join('')).join('');
  palette.addEventListener('click', e => { const kind = kindOf(e); if (kind) { addComponentToSelection(kind); if (isPhone()) collapsePalette() } });
  palette.addEventListener('dragstart', e => { e.dataTransfer.setData(`${canvas.COMPONENT_MIME}-${kindOf(e)}`, kindOf(e)); e.dataTransfer.effectAllowed = 'copy' });
  palette.addEventListener('dragend', e => { if (e.dataTransfer.dropEffect === 'none') showToast(canvas.dropRefusal(), { icon: 'i-info' }) });

  const title = $('breadcrumbCurrent');
  title.addEventListener('click', () => { if (title.classList.contains('editable')) renameProject() });
  title.addEventListener('keydown', e => { if (e.key === 'Enter' && title.classList.contains('editable')) { e.preventDefault(); renameProject() } });

  // Teclado: Supr o Retroceso borran el componente o las pantallas seleccionadas; F2 renombra la pantalla (salvo mientras se escribe).
  document.addEventListener('keydown', e => {
    if (!inWorkspace() || isTyping(e.target) || !selection.size) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); componentId ? deleteComponent(session.screenId, componentId) : deleteScreens([...selection]) }
    if (e.key === 'F2' && selection.size === 1 && !componentId) { e.preventDefault(); startRename(session.screenId) }
  });
}
