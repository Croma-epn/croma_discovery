// Lienzo: dibuja las pantallas y gestiona seleccionar, arrastrar, redimensionar, desplazar y hacer zoom.
import { $, esc, clamp, plural } from '../util.js';
import { currentProject, saveProject } from '../store.js';
import { editInline } from '../ui/inline-edit.js';
import { SIZE, sizeOf, canCollapse, listHeight, COMPONENTS, BUTTON_ROLES, entityOf, findComponent, placementError } from './model.js';

const ZOOM = { min: .5, max: 1.6, step: .1, fitMax: 1.15 };
const RESIZE_DIRS = ['e', 'w']; // solo el ancho: el alto es automático (HU11)
const MORE_BUTTON = '<button class="node-more hidden" type="button"><span></span><svg class="ic" aria-hidden="true"><use href="#i-chev-down"/></svg></button>';
const START_BADGE = '<span class="start-badge"><svg class="ic"><use href="#i-home"/></svg>Inicio</span>';
const snap = v => Math.round(v / 10) * 10; // cuadrícula de 10 px

let view = { zoom: 1, x: 110, y: 80 };
let on; // callbacks del coordinador (ver initCanvas)
const world = () => $('canvasWorld');
const viewport = () => $('canvasViewport');
const screens = () => currentProject()?.screens ?? [];
const save = () => { const p = currentProject(); if (p) saveProject(p) };

/* Arrastre de un componente desde la paleta: el tipo va en el nombre del formato (application/x-croma-component-boton…)
   porque durante el arrastre el navegador solo deja leer los formatos, no los datos. */
export const COMPONENT_MIME = 'application/x-croma-component';
const draggedKind = types => types.find(t => t.startsWith(`${COMPONENT_MIME}-`))?.slice(COMPONENT_MIME.length + 1);

/* ---------- Dibujo ---------- */
/* Componentes uno debajo del otro, en el orden en que se agregaron (el orden comunica qué es la pantalla).
   Un bloque (formulario, lista o ficha) es una caja con su fila de título y, debajo, lo que contiene. */
// Lo que se lee junto al tipo: qué hace el botón, la entidad del bloque o el dato del campo.
function detail(c, parent) {
  if (c.kind === 'button') return BUTTON_ROLES[parent?.kind ?? 'screen'].role;
  if (c.parts) return entityOf(currentProject(), c.entityId)?.name ?? '';
  return (parent && entityOf(currentProject(), parent.entityId)?.attributes.find(a => a.id === c.attributeId)?.name) ?? '';
}
const rowHtml = (c, parent, tag = 'li') => {
  const { label, icon } = COMPONENTS[c.kind], extra = detail(c, parent);
  return `<${tag} class="comp-row" data-comp="${esc(c.id)}"><svg class="ic"><use href="#${icon}"/></svg><span class="comp-text">${esc(c.text)}</span>`
    + `<span class="comp-kind">${label}${extra ? ` · ${esc(extra)}` : ''}</span>`
    + `<button class="del-btn comp-del" type="button" title="Eliminar" aria-label="Eliminar ${esc(c.text)}"><svg class="ic"><use href="#i-trash"/></svg></button></${tag}>`;
};
// Lista o ficha: qué atributos de su entidad muestra.
function shownHtml(c) {
  const entity = entityOf(currentProject(), c.entityId);
  if (!entity) return '<p class="comp-shown is-missing">Elige su entidad en Propiedades</p>';
  const names = entity.attributes.filter(a => c.shown.includes(a.id)).map(a => a.name);
  return `<p class="comp-shown">Muestra: ${names.length ? esc(names.join(', ')) : 'nada aún'}</p>`;
}
const EMPTY_BLOCK = { form: 'Arrastra campos y botones aquí', data: 'Arrastra botones aquí' };
const componentHtml = c => (!c.parts ? rowHtml(c) : `<li class="comp-block" data-block="${esc(c.id)}">${rowHtml(c, null, 'div')}`
  + `${c.shown ? shownHtml(c) : ''}<ol class="comp-parts" data-empty="${EMPTY_BLOCK[COMPONENTS[c.kind].block]}">${c.parts.map(p => rowHtml(p, c)).join('')}</ol></li>`);
const componentsHtml = s => (s.components ?? []).map(componentHtml).join('');
const nodeHtml = s => {
  const { w, h } = sizeOf(s);
  return `<article class="screen-node" data-screen="${esc(s.id)}" style="left:${s.x}px;top:${s.y}px;width:${w}px;height:${h}px">`
    + `<div class="node-head"><svg class="ic"><use href="#i-phone"/></svg><span class="node-business">${esc(s.businessName)}</span><span class="node-code">${esc(s.code)}</span>`
    + `<button class="del-btn node-del" type="button" title="Eliminar elemento" aria-label="Eliminar ${esc(s.businessName)}"><svg class="ic"><use href="#i-trash"/></svg></button></div>`
    + `<ol class="comp-list">${componentsHtml(s)}</ol>${MORE_BUTTON}`
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
export function render() { world().innerHTML = screens().map(nodeHtml).join(''); screens().forEach(applySize); syncCount() }
// Solo añade el nodo nuevo, así los demás no repiten su animación de entrada.
export function add(s) { world().insertAdjacentHTML('beforeend', nodeHtml(s)); applySize(s); syncCount() }

// ids: Set de pantallas seleccionadas (con varias, se ocultan las asas de tamaño). componentId: componente seleccionado.
export function highlight(ids, componentId) {
  world().classList.toggle('is-multi', ids.size > 1);
  nodes().forEach(n => n.classList.toggle('selected', ids.has(n.dataset.screen)));
  world().querySelectorAll('.comp-row').forEach(r => r.classList.toggle('selected', r.dataset.comp === componentId));
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
export function updateComponents(s) {
  nodeEl(s.id).querySelector('.comp-list').innerHTML = componentsHtml(s);
  applySize(s);
}
export function applySize(s) {
  const node = nodeEl(s.id), { w, h } = sizeOf(s);
  Object.assign(node.style, { left: `${s.x}px`, top: `${s.y}px`, width: `${w}px`, height: `${h}px` });
  node.querySelector('.rz-size').textContent = `${w} px`;
  syncCollapse(s, node);
}
/* Pantalla contraída (HU11): la lista se corta a su alto visible y el pie dice cuántos elementos quedan ocultos, contando
   los de los bloques; expandida, ofrece «Ver menos». Sin nada oculto no hay botón. */
const hiddenRows = list => { const cut = list.getBoundingClientRect().bottom; return [...list.querySelectorAll('.comp-row')].filter(r => r.getBoundingClientRect().bottom > cut + 1) };
function syncCollapse(s, node) {
  const list = node.querySelector('.comp-list'), more = node.querySelector('.node-more'), collapsed = !s.expanded && canCollapse(s);
  node.classList.toggle('is-collapsed', collapsed);
  list.style.maxHeight = collapsed ? `${listHeight(s)}px` : '';
  more.classList.toggle('hidden', !canCollapse(s));
  more.setAttribute('aria-expanded', String(!collapsed));
  const hidden = collapsed && hiddenRows(list).length; // 0 si solo se oculta el espacio vacío de un bloque
  more.firstElementChild.textContent = collapsed ? (hidden ? `Ver ${hidden} más` : 'Ver más') : 'Ver menos';
}
// Expande la pantalla si el componente id quedó oculto (se acaba de agregar o se eligió en «Capas»).
export function showComponent(s, id) {
  const node = nodeEl(s.id);
  if (!node?.classList.contains('is-collapsed') || !hiddenRows(node.querySelector('.comp-list')).some(r => r.dataset.comp === id)) return;
  s.expanded = true;
  save();
  applySize(s);
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
// Zoom que deja fijo el punto del lienzo bajo el puntero (clientX, clientY), como en Figma.
function zoomAt(zoom, clientX, clientY) {
  const r = viewport().getBoundingClientRect(), pt = toCanvas(clientX, clientY);
  view.zoom = clamp(zoom, ZOOM.min, ZOOM.max);
  view.x = clientX - r.left - pt.x * view.zoom;
  view.y = clientY - r.top - pt.y * view.zoom;
  applyView();
}

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
  const dir = handle.dataset.rz, start = toCanvas(down.clientX, down.clientY).x, w0 = sizeOf(s).w, x0 = s.x;
  let changed = false;
  node.classList.add('resizing');
  applySize(s);
  capture(handle, down);
  trackPointer(down, e => {
    // Ajuste a la cuadrícula y a los límites (al llegar al límite deja de cambiar); el borde opuesto queda fijo.
    const dx = toCanvas(e.clientX, e.clientY).x - start, w = clamp(snap(w0 + (dir === 'e' ? dx : -dx)), SIZE.minW, SIZE.maxW);
    Object.assign(s, { x: dir === 'w' ? x0 + w0 - w : x0, w });
    changed = true;
    applySize(s);
    on.resize(s);
  }, () => { node.classList.remove('resizing'); if (changed) save() });
}

/* Dónde caería un componente arrastrado con el puntero en (x, y): bloque destino (null = la pantalla), posición y la línea
   que lo indica. Sobre un bloque que no lo acepta, va a la pantalla antes o después de ese bloque. Fuera de la pantalla: null. */
function dropSpot(node, screen, component, x, y) {
  const rect = node.getBoundingClientRect();
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
  const hit = document.elementFromPoint(x, y)?.closest('.comp-block'), block = hit && node.contains(hit) && findComponent(screen, hit.dataset.block).component;
  const inBlock = block && block !== component && !placementError(component.kind, block);
  const listEl = inBlock ? hit.querySelector('.comp-parts') : node.querySelector('.comp-list'), items = [...listEl.children];
  const found = items.findIndex(el => { const r = el.getBoundingClientRect(); return y < r.top + r.height / 2 });
  const index = found < 0 ? items.length : found, list = listEl.getBoundingClientRect();
  const top = items[index] ? items[index].getBoundingClientRect().top - 3 : items.length ? items.at(-1).getBoundingClientRect().bottom + 1 : list.top + list.height / 2;
  const local = (v, origin, border) => `${(v - origin) / view.zoom - border}px`;
  return {
    blockId: inBlock ? block.id : null, index,
    style: { left: local(list.left, rect.left, node.clientLeft), top: local(top, rect.top, node.clientTop), width: `${list.width / view.zoom}px` },
  };
}
// Arrastrar un componente lo mueve dentro de su pantalla (HU16); sin movimiento fue un clic y lo selecciona.
function startComponentDrag(down, node, row) {
  const screen = screens().find(s => s.id === node.dataset.screen), id = row.dataset.comp, { component } = findComponent(screen, id);
  const dimmed = row.matches('.comp-block > .comp-row') ? row.parentElement : row, line = document.createElement('div');
  let moved = false, spot = null;
  line.className = 'drop-line';
  capture(row, down);
  trackPointer(down, e => {
    if (!moved) {
      if (Math.abs(e.clientX - down.clientX) < 3 && Math.abs(e.clientY - down.clientY) < 3) return; // aún es un clic
      moved = true;
      dimmed.classList.add('moving');
      node.append(line);
    }
    spot = dropSpot(node, screen, component, e.clientX, e.clientY);
    viewport().classList.toggle('no-drop', !spot);
    line.hidden = !spot;
    if (spot) Object.assign(line.style, spot.style);
  }, () => {
    line.remove();
    dimmed.classList.remove('moving');
    viewport().classList.remove('no-drop');
    if (!moved) on.pick(screen.id, id);
    else if (spot) on.moveComponent(screen.id, id, spot.blockId, spot.index);
    else on.refuse('Solo puedes mover un componente dentro de su pantalla.');
  });
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
     pick(screenId, componentId), dropComponent(screenId, kind, blockId), removeComponent(screenId, componentId)
     moveComponent(screenId, componentId, blockId, index), refuse(message)
   } */
const OUTSIDE = 'Suelta el componente dentro de una pantalla.';
let refusal = OUTSIDE; // por qué no se pudo soltar el último componente arrastrado
export const dropRefusal = () => refusal;

export function initCanvas(callbacks) {
  on = callbacks;
  $('zoomIn').addEventListener('click', () => zoomBy(ZOOM.step));
  $('zoomOut').addEventListener('click', () => zoomBy(-ZOOM.step));
  $('fitCanvas').addEventListener('click', fit);

  ['keydown', 'keyup'].forEach(type => document.addEventListener(type, trackSpace));
  /* Rueda o trackpad, como en Figma: desplaza el lienzo (Shift = horizontal). Ctrl/Cmd + rueda, o pellizcar en el trackpad
     (el navegador lo envía como Ctrl + rueda), hace zoom hacia el puntero. */
  viewport().addEventListener('wheel', e => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1; // algunas ruedas informan líneas en vez de píxeles
    if (e.ctrlKey || e.metaKey) return zoomAt(view.zoom * Math.exp(-e.deltaY * unit * .002), e.clientX, e.clientY);
    view.x -= (e.shiftKey ? e.deltaY : e.deltaX) * unit;
    view.y -= (e.shiftKey ? 0 : e.deltaY) * unit;
    applyView();
  }, { passive: false });
  viewport().addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault() }); // sin autodesplazamiento del navegador
  viewport().addEventListener('pointerdown', e => {
    if (e.target.closest('.inline-edit')) return;
    const node = e.target.closest('.screen-node');
    if (!node) on.background();
    // Mover el lienzo: rueda presionada, Espacio + arrastrar, o arrastrar con el dedo sobre el fondo.
    if (e.button === 1 || (e.button === 0 && spaceHeld)) return startPan(e, { clearOnTap: false });
    if (e.button !== 0 || e.target.closest('.node-del, .comp-del, .node-more')) return;
    if (!node) return e.pointerType === 'touch' ? startPan(e, { clearOnTap: true }) : startMarquee(e, e.ctrlKey || e.metaKey);
    const handle = e.target.closest('[data-rz]');
    if (handle) return startResize(e, handle);
    const id = node.dataset.screen, additive = e.ctrlKey || e.metaKey, onName = Boolean(e.target.closest('.node-business'));
    // Una fila, o cualquier zona libre de un bloque (su línea «Muestra», su lista vacía o su borde), que equivale a su título.
    const row = !additive && (e.target.closest('.comp-row') || e.target.closest('.comp-block')?.querySelector(':scope > .comp-row'));
    if (row) return startComponentDrag(e, node, row);
    const ids = on.press(id, additive);
    // Un clic (sin arrastrar) sobre el nombre lo edita ahí mismo.
    const click = () => (onName && !additive ? on.edit(id) : on.release(id, additive));
    if (ids.length) startDrag(e, node, ids, click);
  });
  world().addEventListener('click', e => {
    const more = e.target.closest('.node-more'), moreScreen = more && screens().find(x => x.id === more.closest('.screen-node').dataset.screen);
    if (moreScreen) { moreScreen.expanded = more.getAttribute('aria-expanded') !== 'true'; save(); return applySize(moreScreen) }
    const del = e.target.closest('.node-del, .comp-del'), screenId = del?.closest('.screen-node').dataset.screen;
    if (del?.matches('.comp-del')) on.removeComponent(screenId, del.closest('.comp-row').dataset.comp);
    else if (del) on.remove(screenId);
  });
  world().addEventListener('dblclick', e => {
    const node = e.target.closest('.screen-node');
    if (node && !e.target.closest('.node-del, .node-more, .inline-edit, .comp-row, .comp-block')) on.edit(node.dataset.screen);
  });

  /* Soltar desde la paleta. «Pantalla» se centra en el punto donde se suelta; un componente va al final del bloque o de la
     pantalla sobre la que se suelta, que se resalta mientras se arrastra. Donde no puede ir, el cursor muestra prohibido
     y dropRefusal() explica por qué. */
  const markTarget = el => world().querySelectorAll('.screen-node, .comp-block').forEach(n => n.classList.toggle('drop-target', n === el));
  const target = e => {
    const node = e.target.closest('.screen-node'), blockEl = node && e.target.closest('.comp-block');
    const block = blockEl && findComponent(screens().find(s => s.id === node.dataset.screen), blockEl.dataset.block).component;
    return { node, blockEl, block };
  };
  viewport().addEventListener('dragover', e => {
    e.preventDefault();
    const kind = draggedKind([...e.dataTransfer.types]);
    if (!kind) return markTarget(null); // «Pantalla» se puede soltar en cualquier lugar
    const { node, blockEl, block } = target(e);
    refusal = node ? placementError(kind, block) : OUTSIDE;
    e.dataTransfer.dropEffect = refusal ? 'none' : 'copy';
    markTarget(!refusal && (blockEl || node));
  });
  // Al cancelar el arrastre el navegador también avisa dragleave: el motivo solo se reinicia si el puntero salió del lienzo.
  viewport().addEventListener('dragleave', e => {
    if (viewport().contains(e.relatedTarget)) return;
    markTarget(null);
    const r = viewport().getBoundingClientRect();
    if (e.clientX <= r.left || e.clientX >= r.right || e.clientY <= r.top || e.clientY >= r.bottom) refusal = OUTSIDE;
  });
  viewport().addEventListener('drop', e => {
    e.preventDefault();
    markTarget(null);
    const kind = draggedKind([...e.dataTransfer.types]), { node, block } = target(e);
    if (kind) return node && on.dropComponent(node.dataset.screen, kind, block?.id ?? null);
    const pt = toCanvas(e.clientX, e.clientY);
    on.drop(snap(pt.x - SIZE.defW / 2), snap(pt.y - SIZE.defH / 2));
  });
}
