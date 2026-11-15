// Lienzo: dibuja las pantallas y gestiona arrastrar, redimensionar, desplazar y hacer zoom.
import { $, esc, clamp, plural } from '../util.js';
import { currentProject, saveProject } from '../store.js';

export const SIZE = { defW: 260, defH: 80, minW: 200, maxW: 800, minH: 80, maxH: 600 };
const ZOOM = { min: .5, max: 1.6, step: .1, fitMax: 1.15 };
const RESIZE_DIRS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const snap = v => Math.round(v / 10) * 10; // cuadrícula de 10 px
export const sizeOf = s => ({ w: s.w || SIZE.defW, h: s.h || SIZE.defH });

let view = { zoom: 1, x: 110, y: 80 };
let on; // callbacks del coordinador (ver initCanvas)
const world = () => $('canvasWorld');
const viewport = () => $('canvasViewport');
const screens = () => currentProject()?.screens ?? [];
const screenOf = node => screens().find(s => s.id === node.dataset.screen);
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

function syncCount() {
  const n = screens().length;
  $('canvasEmpty').classList.toggle('is-off', n > 0);
  $('canvasScreenCount').textContent = plural(n, 'elemento', 'elementos');
}
export function render() { world().innerHTML = screens().map(nodeHtml).join(''); syncCount() }
// Solo añade el nodo nuevo, así los demás no repiten su animación de entrada.
export function add(s) { world().insertAdjacentHTML('beforeend', nodeHtml(s)); syncCount() }
export const highlight = id => world().querySelectorAll('.screen-node').forEach(n => n.classList.toggle('selected', n.dataset.screen === id));
export function updateNode(s) {
  const node = nodeEl(s.id);
  node.querySelector('.node-code').textContent = s.code;
  node.querySelector('.node-business').textContent = s.businessName;
}
export function applySize(s) {
  const node = nodeEl(s.id), { w, h } = sizeOf(s);
  Object.assign(node.style, { left: `${s.x}px`, top: `${s.y}px`, width: `${w}px`, height: `${h}px` });
  node.querySelector('.rz-size').textContent = `${w} × ${h}`;
}

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

function startDrag(down, node) {
  const s = screenOf(node);
  if (!s) return;
  const start = toCanvas(down.clientX, down.clientY), offsetX = start.x - s.x, offsetY = start.y - s.y;
  let moved = false;
  capture(node, down);
  trackPointer(down, e => {
    if (!moved) {
      if (Math.abs(e.clientX - down.clientX) < 3 && Math.abs(e.clientY - down.clientY) < 3) return; // aún es un clic
      moved = true;
      node.classList.add('dragging');
    }
    const pt = toCanvas(e.clientX, e.clientY);
    s.x = snap(pt.x - offsetX);
    s.y = snap(pt.y - offsetY);
    node.style.left = `${s.x}px`;
    node.style.top = `${s.y}px`;
  }, () => { node.classList.remove('dragging'); if (moved) save() });
}

function startResize(down, handle) {
  down.preventDefault();
  const node = handle.closest('.screen-node'), s = screenOf(node);
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

function startPan(down) {
  const start = { x: down.clientX, y: down.clientY, viewX: view.x, viewY: view.y };
  let moved = false;
  viewport().classList.add('panning');
  trackPointer(down, e => {
    if (Math.abs(e.clientX - start.x) > 3 || Math.abs(e.clientY - start.y) > 3) moved = true;
    view.x = start.viewX + e.clientX - start.x;
    view.y = start.viewY + e.clientY - start.y;
    applyView();
  }, () => { viewport().classList.remove('panning'); if (!moved) on.select(null) }); // un clic en el vacío quita la selección
}

/* on: { select(id), edit(id), remove(id), resize(screen), drop(x, y), background() } */
export function initCanvas(callbacks) {
  on = callbacks;
  $('zoomIn').addEventListener('click', () => zoomBy(ZOOM.step));
  $('zoomOut').addEventListener('click', () => zoomBy(-ZOOM.step));
  $('fitCanvas').addEventListener('click', fit);

  viewport().addEventListener('pointerdown', e => {
    const node = e.target.closest('.screen-node');
    if (!node) on.background();
    if (e.button !== 0 || e.target.closest('.node-del')) return;
    const handle = e.target.closest('[data-rz]');
    if (handle) startResize(e, handle);
    else if (node) { on.select(node.dataset.screen); startDrag(e, node) }
    else startPan(e);
  });
  world().addEventListener('click', e => {
    const del = e.target.closest('.node-del');
    if (del) on.remove(del.closest('.screen-node').dataset.screen);
  });
  world().addEventListener('dblclick', e => {
    const node = e.target.closest('.screen-node');
    if (node && !e.target.closest('.node-del')) on.edit(node.dataset.screen);
  });

  // Soltar «Pantalla» desde la paleta: se centra en el punto donde se suelta.
  viewport().addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' });
  viewport().addEventListener('drop', e => {
    e.preventDefault();
    const pt = toCanvas(e.clientX, e.clientY);
    on.drop(snap(pt.x - SIZE.defW / 2), snap(pt.y - SIZE.defH / 2));
  });
}
