/* Espacio de trabajo de un proyecto. Coordina lienzo, capas, propiedades y paneles:
   esos módulos no se conocen entre sí, avisan aquí mediante callbacks. */
import { $, uid } from '../util.js';
import { session, findProject, currentProject, saveProject } from '../store.js';
import { showToast, isOpen } from '../ui/feedback.js';
import { showAppPage } from '../shell.js';
import * as canvas from './canvas.js';
import * as layers from './layers.js';
import * as properties from './properties.js';
import { initPanels, resetPanels, collapsePalette, collapseFloatingPanels, isPhone } from './panels.js';

export function openWorkspace(id) {
  const project = findProject(id);
  if (!project) return;
  session.projectId = id;
  session.screenId = project.screens[0]?.id || null;
  showAppPage('workspace', { title: project.name, saved: true });
  resetPanels();
  refresh();
  canvas.fit();
}

function select(id) {
  session.screenId = id;
  canvas.highlight(id);
  layers.render();
  properties.render();
}
function refresh() { canvas.render(); select(session.screenId) }

/* ---------- Pantallas ---------- */
const screenCode = n => `VC-${String(n).padStart(2, '0')}`;
// Primer número libre entre los códigos «VC-n» existentes.
function nextScreenNumber(project) {
  const used = new Set(project.screens.map(s => +(/^VC-(\d+)$/i.exec(s.code)?.[1] ?? 0)));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

// Sin coordenadas, se coloca en la siguiente celda de una cuadrícula de 4 columnas.
function addScreen(x, y) {
  const project = currentProject();
  if (!project) return;
  const n = nextScreenNumber(project), count = project.screens.length;
  const screen = {
    id: uid(), code: screenCode(n), technicalName: `Pantalla${n}`, businessName: `Nueva pantalla ${n}`,
    x: x ?? Math.max(40, 120 + (count % 4) * 290),
    y: y ?? Math.max(40, 90 + Math.floor(count / 4) * 165),
  };
  project.screens.push(screen);
  saveProject(project);
  canvas.add(screen);
  select(screen.id);
  canvas.reveal(screen);
  showToast('Pantalla agregada al lienzo.');
}

function deleteScreen(id) {
  const project = currentProject(), index = project?.screens.findIndex(s => s.id === id) ?? -1;
  if (index < 0) return;
  const [screen] = project.screens.splice(index, 1);
  saveProject(project);
  if (session.screenId === id) session.screenId = null;
  refresh();
  showToast('Elemento eliminado.', { action: { label: 'Deshacer', onClick: () => restoreScreen(project, screen, index) } });
}
function restoreScreen(project, screen, index) {
  if (session.user?.id !== project.userId || !findProject(project.id) || project.screens.some(s => s.id === screen.id)) return;
  if (project.screens.some(s => s.code === screen.code)) screen.code = screenCode(nextScreenNumber(project)); // su código se reutilizó
  project.screens.splice(Math.min(index, project.screens.length), 0, screen);
  saveProject(project);
  if (currentProject() === project) { session.screenId = screen.id; refresh() }
  showToast('Elemento restaurado.');
}

export function initWorkspace() {
  initPanels();
  canvas.initCanvas({
    select,
    edit: id => { select(id); properties.focus() },
    remove: deleteScreen,
    resize: s => { if (s.id === session.screenId) properties.fillSize(s) },
    drop: addScreen,
    background: collapseFloatingPanels,
  });
  properties.initProperties({
    rename: s => { canvas.updateNode(s); layers.render() },
    resize: canvas.applySize,
  });
  layers.initLayers(id => {
    const screen = currentProject()?.screens.find(s => s.id === id);
    if (!screen) return;
    select(id);
    canvas.reveal(screen);
    if (isPhone()) collapsePalette(); // en celular el panel tapa el lienzo: se cierra para ver la pantalla elegida
  });

  $('screenPalette').addEventListener('click', () => { addScreen(); if (isPhone()) collapsePalette() });
  $('screenPalette').addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', 'screen'); e.dataTransfer.effectAllowed = 'copy' });

  // Supr borra la pantalla seleccionada, salvo mientras se escribe o hay un diálogo abierto.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Delete' || !session.screenId || $('workspacePage').classList.contains('hidden') || isOpen($('dialogBackdrop'))) return;
    if (e.target.matches('input, textarea') || e.target.isContentEditable) return;
    e.preventDefault();
    deleteScreen(session.screenId);
  });
}
