// Lienzo: dibuja las pantallas y gestiona seleccionar, arrastrar, redimensionar, desplazar y hacer zoom.
import { $, esc, clamp, plural } from '../util.js';
import { currentProject, saveProject } from '../store.js';
import { editInline } from '../ui/inline-edit.js';
import { SIZE, sizeOf } from './model.js';

const ZOOM = { min: .5, max: 1.6, step: .1, fitMax: 1.15 };
const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const START_BADGE = '<span class="start-badge"><svg class="ic"><use href="#i-home"/></svg>Inicio</span>';
const snap = v => Math.round(v / 10) * 10; // cuadrícula de 10 px

let view = { zoom: 1, x: 110, y: 80 };
let on; // callbacks del coordinador (ver initCanvas)
const world = () => $('canvasWorld');
const viewport = () => $('canvasViewport');
const screens = () => currentProject()?.screens ?? [];
const save = () => { const p = currentProject(); if (p) saveProject(p) };

/* ---------- Dibujo ---------- */
const nodeHtml = s => {
  const { w, h } = sizeOf(s);
  return `<article class="screen-node" data-screen="${esc(s.id)}" style="left:${s.x}px;top:${s.y}px;width:${w}px;height:${h}px">`
    + `<div class="node-head"><svg class="ic"><use href="#i-phone"/></svg><span class="node-business">${esc(s.businessName)}</span><span class="node-code">${esc(s.code)}</span>`
    + `<button class="node-del" type="button" title="Eliminar elemento" aria-label="Eliminar ${esc(s.businessName)}"><svg class="ic"><use href="#i-trash"/></svg></button></div>`
    + RESIZE_DIRS.map(d => `<span class="rz rz-${d}" data-rz="${d}" aria-hidden="true"></span>`).join('')
    + '<span class="rz-size" aria-hidden="true"></span></article>';
};
const nodeEl = id => world().querySelector(`[data-screen="${CSS.escape(id)}"]`);
const nodes = () => world().querySelectorAll('.screen-node');

function syncCount() {
  const n = screens().length;
  $('canvasEmpty').classList.toggle('is-off', n > 0);
  $('canvasScreenCount').textContent = plural(n, 'elemento', 'elementos');
}
export function render() { world().innerHTML = screens().map(nodeHtml).join(''); syncCount() }
// Solo añade el nodo nuevo, así los demás no repiten su animación de entrada.
export function add(s) { world().insertAdjacentHTML('beforeend', nodeHtml(s)); syncCount() }

// ids: Set de pantallas seleccionadas. Con varias, se ocultan las asas de tamaño.
export function highlight(ids) {
  world().classList.toggle('is-multi', ids.size > 1);
  nodes().forEach(n => n.classList.toggle('selected', ids.has(n.dataset.screen)));
}
// Marca permanente (contorno + «Inicio») en la pantalla inicial.
export function markStart(id) {
  nodes().forEach(n => {
    const isStart = n.dataset.screen === id;
    n.classList.toggle('is-start', isStart);
    n.querySelector('.start-badge')?.remove();
    if (isStart) n.insertAdjacentHTML('afterbegin', START_BADGE);
  });
}
export function updateNode(s) {
  const node = nodeEl(s.id);
  node.querySelector('.node-code').textContent = s.code;
  node.querySelector('.node-business').textContent = s.businessName;
  node.querySelector('.node-del').setAttribute('aria-label', `Eliminar ${s.businessName}`);
}
export function applySize(s) {
  const node = nodeEl(s.id), { w, h } = sizeOf(s);
  Object.assign(node.style, { left: `${s.x}px`, top: `${s.y}px`, width: `${w}px`, height: `${h}px` });
  node.querySelector('.rz-size').textContent = `${w} × ${h}`;
}
export const rename = (id, onCommit) =>
  editInline(nodeEl(id).querySelector('.node-business'), { label: 'Nombre de la pantalla', maxLength: 20, onCommit });

/* ---------- Vista: desplazamiento y zoom ---------- */
function applyView() {
  world().style.transform = `translate(${view.x}px,${view.y}px) scale(${view.zoom})`;
  world().style.setProperty('--z', view.zoom);
  $('zoomLabel').textContent = `${Math.round(view.zoom * 100)}%`;
}
const zoomBy = delta => { view.zoom = clamp(view.zoom + delta, ZOOM.min, ZOOM.max); applyView() };

export function fit() {
  const list = screens();
  if (!list.length) { view = { zoom: 1, x: 120, y: 100 }; return applyView() }
  const rect = viewport().getBoundingClientRect();
  const minX = Math.min(...list.map(s => s.x)), minY = Math.min(...list.map(s => s.y));
  const maxX = Math.max(...list.map(s => s.x + sizeOf(s).w)), maxY = Math.max(...list.map(s => s.y + sizeOf(s).h));
  const zoom = clamp(Math.min((rect.width - 100) / (maxX - minX + 40), (rect.height - 100) / (maxY - minY + 40)), ZOOM.min, ZOOM.fitMax);
  view = { zoom, x: (rect.width - (maxX - minX) * zoom) / 2 - minX * zoom, y: (rect.height - (maxY - minY) * zoom) / 2 - minY * zoom };
  applyView();
}

// Centra la pantalla si está fuera de la vista o pegada al borde.
export function reveal(s) {
  const rect = viewport().getBoundingClientRect(), margin = 70, { w, h } = sizeOf(s);
  const left = s.x * view.zoom + view.x, top = s.y * view.zoom + view.y;
  const outside = left < margin || top < margin || left + w * view.zoom > rect.width - margin || top + h * view.zoom > rect.height - margin;
  if (!outside) return;
  view.x = rect.width / 2 - (s.x + w / 2) * view.zoom;
  view.y = rect.height / 2 - (s.y + h / 2) * view.zoom;
  applyView();
}

// Punto de la pantalla del navegador → coordenadas del lienzo.
function toCanvas(clientX, clientY) {
  const r = viewport().getBoundingClientRect();
  return { x: (clientX - r.left - view.x) / view.zoom, y: (clientY - r.top - view.y) / view.zoom };
}

/* ---------- Interacción con el puntero ---------- */
// Sigue un puntero hasta que se suelta o se cancela.
function trackPointer(down, onMove, onEnd) {
  const move = e => { if (e.pointerId === down.pointerId) onMove(e) };
  const end = e => {
    if (e.pointerId !== down.pointerId) return;
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    onEnd(e);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId) } catch { /* el puntero ya se soltó */ } };

/* Arrastra juntas las pantallas `ids`. Se ajusta el desplazamiento (no cada posición) a la cuadrícula,
   así las pantallas alineadas siguen alineadas. Si no hubo movimiento, fue un clic: onClick(). */
function startDrag(down, node, ids, onClick) {
  const start = toCanvas(down.clientX, down.clientY);
  const items = screens().filter(s => ids.includes(s.id)).map(s => ({ s, node: nodeEl(s.id), x: s.x, y: s.y }));
  let moved = false;
  capture(node, down);
  trackPointer(down, e => {
    if (!moved) {
      if (Math.abs(e.clientX - down.clientX) < 3 && Math.abs(e.clientY - down.clientY) < 3) return; // aún es un clic
      moved = true;
      items.forEach(item => item.node.classList.add('dragging'));
    }
    const pt = toCanvas(e.clientX, e.clientY), dx = snap(pt.x - start.x), dy = snap(pt.y - start.y);
    items.forEach(item => {
      item.s.x = item.x + dx;
      item.s.y = item.y + dy;
      item.node.style.left = `${item.s.x}px`;
      item.node.style.top = `${item.s.y}px`;
    });
  }, () => {
    items.forEach(item => item.node.classList.remove('dragging'));
    moved ? save() : onClick();
  });
}

function startResize(down, handle) {
  down.preventDefault();
  const node = handle.closest('.screen-node'), s = screens().find(x => x.id === node.dataset.screen);
  if (!s) return;
  const dir = handle.dataset.rz, start = toCanvas(down.clientX, down.clientY);
  const { w: w0, h: h0 } = sizeOf(s), x0 = s.x, y0 = s.y;
  let changed = false;
  node.classList.add('resizing');
  applySize(s);
  capture(handle, down);
  trackPointer(down, e => {
    const pt = toCanvas(e.clientX, e.clientY), dx = pt.x - start.x, dy = pt.y - start.y;
    let w = w0 + (dir.includes('e') ? dx : dir.includes('w') ? -dx : 0);
    let h = h0 + (dir.includes('s') ? dy : dir.includes('n') ? -dy : 0);
    if (e.shiftKey && dir.length === 2) {
      // Shift en una esquina: conserva la proporción según el eje que más cambió.
      const k = clamp(Math.abs(w / w0 - 1) > Math.abs(h / h0 - 1) ? w / w0 : h / h0,
        Math.max(SIZE.minW / w0, SIZE.minH / h0), Math.min(SIZE.maxW / w0, SIZE.maxH / h0));
      w = Math.round(w0 * k);
      h = Math.round(h0 * k);
    } else {
      // Ajuste a la cuadrícula y a los límites: al llegar al límite simplemente deja de cambiar.
      w = clamp(snap(w), SIZE.minW, SIZE.maxW);
      h = clamp(snap(h), SIZE.minH, SIZE.maxH);
    }
    // El borde opuesto queda fijo.
    Object.assign(s, { x: dir.includes('w') ? x0 + w0 - w : x0, y: dir.includes('n') ? y0 + h0 - h : y0, w, h });
    changed = true;
    applySize(s);
    on.resize(s);
  }, () => { node.classList.remove('resizing'); if (changed) save() });
}

// Mover el lienzo. clearOnTap: un toque sin arrastrar quita la selección (pantallas táctiles).
function startPan(down, { clearOnTap }) {
  const start = { x: down.clientX, y: down.clientY, viewX: view.x, viewY: view.y };
  let moved = false;
  viewport().classList.add('panning');
  trackPointer(down, e => {
    if (Math.abs(e.clientX - start.x) > 3 || Math.abs(e.clientY - start.y) > 3) moved = true;
    view.x = start.viewX + e.clientX - start.x;
    view.y = start.viewY + e.clientY - start.y;
    applyView();
  }, () => { viewport().classList.remove('panning'); if (!moved && clearOnTap) on.clear() });
}

// Rectángulo de selección: selecciona las pantallas que toca. Con Ctrl/Cmd se suma a la selección actual.
function startMarquee(down, additive) {
  const area = viewport().getBoundingClientRect(), box = document.createElement('div');
  const x0 = down.clientX - area.left, y0 = down.clientY - area.top;
  let moved = false;
  box.className = 'marquee';
  on.marqueeStart(additive);
  trackPointer(down, e => {
    const x1 = e.clientX - area.left, y1 = e.clientY - area.top;
    if (!moved && Math.abs(x1 - x0) < 3 && Math.abs(y1 - y0) < 3) return; // aún es un clic
    if (!moved) viewport().append(box);
    moved = true;
    const left = Math.min(x0, x1), top = Math.min(y0, y1), width = Math.abs(x1 - x0), height = Math.abs(y1 - y0);
    Object.assign(box.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
    const a = toCanvas(area.left + left, area.top + top), b = toCanvas(area.left + left + width, area.top + top + height);
    on.marqueeMove(screens().filter(s => { const { w, h } = sizeOf(s); return s.x < b.x && s.x + w > a.x && s.y < b.y && s.y + h > a.y }).map(s => s.id));
  }, () => { box.remove(); if (!moved && !additive) on.clear() }); // un clic en el vacío quita la selección
}

/* Espacio mantenido = modo mano (como en Figma o draw.io). No aplica mientras se escribe ni sobre un control
   enfocado con teclado (ahí Espacio debe seguir activándolo). */
let spaceHeld = false;
function trackSpace(e) {
  const keyboardControl = e.target.matches('button, [role=button], a, select, input[type=checkbox]') && e.target.matches(':focus-visible');
  if (e.code !== 'Space' || e.target.matches('input:not([type=checkbox]), textarea') || keyboardControl || $('workspacePage').classList.contains('hidden')) return;
  e.preventDefault(); // evita desplazar la página o pulsar el botón enfocado
  spaceHeld = e.type === 'keydown';
  viewport().classList.toggle('pan-ready', spaceHeld);
}

/* on: {
     press(id, additive) → ids a arrastrar   (additive: Ctrl/Cmd agrega o quita de la selección)
     release(id, additive)                   (clic sin arrastrar)
     marqueeStart(additive), marqueeMove(ids)
     clear(), edit(id), remove(id), resize(screen), drop(x, y), background()
   } */
export function initCanvas(callbacks) {
  on = callbacks;
  $('zoomIn').addEventListener('click', () => zoomBy(ZOOM.step));
  $('zoomOut').addEventListener('click', () => zoomBy(-ZOOM.step));
  $('fitCanvas').addEventListener('click', fit);

  ['keydown', 'keyup'].forEach(type => document.addEventListener(type, trackSpace));
  viewport().addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault() }); // sin autodesplazamiento del navegador
  viewport().addEventListener('pointerdown', e => {
    if (e.target.closest('.inline-edit')) return;
    const node = e.target.closest('.screen-node');
    if (!node) on.background();
    // Mover el lienzo: rueda presionada, Espacio + arrastrar, o arrastrar con el dedo sobre el fondo.
    if (e.button === 1 || (e.button === 0 && spaceHeld)) return startPan(e, { clearOnTap: false });
    if (e.button !== 0 || e.target.closest('.node-del')) return;
    if (!node) return e.pointerType === 'touch' ? startPan(e, { clearOnTap: true }) : startMarquee(e, e.ctrlKey || e.metaKey);
    const handle = e.target.closest('[data-rz]');
    if (handle) return startResize(e, handle);
    const id = node.dataset.screen, additive = e.ctrlKey || e.metaKey, onName = Boolean(e.target.closest('.node-business'));
    const ids = on.press(id, additive);
    // Un clic (sin arrastrar) sobre el nombre lo edita ahí mismo.
    if (ids.length) startDrag(e, node, ids, () => (onName && !additive ? on.edit(id) : on.release(id, additive)));
  });
  world().addEventListener('click', e => {
    const del = e.target.closest('.node-del');
    if (del) on.remove(del.closest('.screen-node').dataset.screen);
  });
  world().addEventListener('dblclick', e => {
    const node = e.target.closest('.screen-node');
    if (node && !e.target.closest('.node-del, .inline-edit')) on.edit(node.dataset.screen);
  });

  // Soltar «Pantalla» desde la paleta: se centra en el punto donde se suelta.
  viewport().addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' });
  viewport().addEventListener('drop', e => {
    e.preventDefault();
    const pt = toCanvas(e.clientX, e.clientY);
    on.drop(snap(pt.x - SIZE.defW / 2), snap(pt.y - SIZE.defH / 2));
  });
}
