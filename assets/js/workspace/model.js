import { uid } from '../util.js';
// Reglas de un proyecto (sin interfaz): pantallas (tamaño, código, componentes, pantalla inicial, ubicación, alineación) y modelo de dominio.
export const SIZE = { defW: 260, defH: 80, minW: 200, maxW: 800, minH: 80, maxH: 600 };

/* ---------- Componentes (HU14) y bloques (propuesta sin HU) ----------
   Nombres conocidos en la paleta; por debajo, el elemento IFML que representan (Spec IFML 1.0 §7.4, §8.1.4, §8.1.10).
   Dos niveles: la pantalla (ViewContainer) contiene elementos sueltos y bloques; los bloques contienen elementos (parts).
   - in: dónde puede ir (screen o el tipo de bloque). Un campo solo existe dentro de un Form (§8.3.53, §8.4.4): si se suelta
     en la pantalla, se crea un formulario. Un ViewComponent (texto fijo, bloques) solo va en la pantalla (§8.1.4).
   - block: 'form' o 'data' (lista y ficha, que exigen un DataBinding a una entidad: §8.4.1, §8.4.5).
   - family: tipos que son la misma clase IFML; el tipo solo cambia dentro de su familia (§8.3.25, §8.4.3).
   El botón no es un componente sino el evento de quien lo contiene (§7.2, §8.1.6): ver BUTTON_ROLES. */
const ANYWHERE = ['screen', 'form', 'list', 'details'];
export const COMPONENTS = {
  textbox: { label: 'Campo de texto', icon: 'i-textbox', prefix: 'txt', family: 'field', in: ['form'], place: 'dentro de un formulario', ifml: 'SimpleField (del Form)' },
  select: { label: 'Campo de selección', icon: 'i-select', prefix: 'sel', family: 'field', in: ['form'], place: 'dentro de un formulario', ifml: 'SelectionField (del Form)' },
  button: { label: 'Botón', icon: 'i-button', prefix: 'btn', family: 'event', in: ANYWHERE },
  label: { label: 'Texto fijo', icon: 'i-label', prefix: 'lbl', family: 'content', in: ['screen'], place: 'directo en la pantalla', ifml: 'ViewComponent' },
  form: { label: 'Formulario', icon: 'i-form', prefix: 'frm', family: 'form', in: ['screen'], place: 'directo en la pantalla', block: 'form', ifml: 'Form' },
  list: { label: 'Lista de datos', icon: 'i-list', prefix: 'lst', family: 'data', in: ['screen'], place: 'directo en la pantalla', block: 'data', ifml: 'List (con DataBinding)' },
  details: { label: 'Ficha de datos', icon: 'i-details', prefix: 'fch', family: 'data', in: ['screen'], place: 'directo en la pantalla', block: 'data', ifml: 'Details (con DataBinding)' },
};
// El tipo IFML del botón sale de dónde está: así se sabe si envía datos o solo navega.
export const BUTTON_ROLES = {
  screen: { role: 'navega', ifml: 'ViewElementEvent (de la pantalla)' },
  form: { role: 'envía datos', ifml: 'OnSubmitEvent (del Form)' },
  list: { role: 'elige un registro', ifml: 'OnSelectEvent (de la List)' },
  details: { role: 'usa el registro', ifml: 'ViewElementEvent (de la ficha)' },
};
export const ifmlOf = (c, parent) => (c.kind === 'button' ? BUTTON_ROLES[parent?.kind ?? 'screen'].ifml : COMPONENTS[c.kind].ifml);
const isField = kind => COMPONENTS[kind].family === 'field';
// Tipos a los que puede cambiar un componente (incluye el suyo).
export const kindsLike = kind => Object.keys(COMPONENTS).filter(k => COMPONENTS[k].family === COMPONENTS[kind].family);
// ¿Otro elemento de la lista ya usa ese nombre? (sin distinguir mayúsculas). freeName da el primer base1, base2… libre.
export const taken = (list, name, self) => list.some(x => x !== self && x.name.toLowerCase() === name.toLowerCase());
const freeName = (list, base, self) => { let n = 1; while (taken(list, `${base}${n}`, self)) n++; return `${base}${n}` };

// Todos los componentes de la pantalla, incluidos los de sus bloques (el nombre técnico es único en la pantalla).
export const allComponents = screen => (screen.components ?? []).flatMap(c => [c, ...(c.parts ?? [])]);
export const nameTaken = (screen, name, self) => taken(allComponents(screen), name, self);
// El componente `id`, el bloque que lo contiene (null si está suelto) y la lista donde está.
export function findComponent(screen, id) {
  for (const c of screen.components ?? []) {
    if (c.id === id) return { component: c, parent: null, list: screen.components };
    const part = c.parts?.find(p => p.id === id);
    if (part) return { component: part, parent: c, list: c.parts };
  }
  return null;
}

// '' si `kind` puede ir en `block` (o en la pantalla si no hay bloque); si no, el motivo para avisar al usuario.
export function placementError(kind, block) {
  const { in: where, label, place } = COMPONENTS[kind];
  return where.includes(block?.kind ?? 'screen') || (!block && isField(kind)) ? '' : `«${label}» va ${place}.`;
}
function create(kind, all) {
  const { label, prefix, block } = COMPONENTS[kind];
  const c = { id: uid(), kind, name: freeName(all, prefix), text: label };
  if (block) Object.assign(c, { entityId: null, parts: [] }, block === 'data' && { shown: [] });
  all.push(c);
  return c;
}
// Nuevo componente al final de la pantalla o del bloque (validar antes con placementError). Un campo suelto crea su formulario.
export function addComponent(screen, kind, block = null) {
  const all = allComponents(screen);
  let list = block ? block.parts : (screen.components ??= []);
  if (!block && isField(kind)) { const form = create('form', all); list.push(form); list = form.parts }
  const component = create(kind, all);
  list.push(component);
  return component;
}
/* Mover (HU16) dentro de la pantalla: a `block` (null = la pantalla) en la posición index, contada con el componente aún en
   su lugar. Validar antes con placementError. Un campo llevado a la pantalla queda en un formulario nuevo. */
export function moveComponent(screen, id, block, index) {
  const { component, list } = findComponent(screen, id), target = block ? block.parts : screen.components;
  const from = list.indexOf(component);
  list.splice(from, 1);
  if (list === target && from < index) index--;
  let item = component;
  if (!block && isField(component.kind)) { item = create('form', allComponents(screen)); item.parts.push(component) }
  target.splice(Math.min(index, target.length), 0, item);
}
// Proyectos anteriores a los bloques: cada grupo seguido de campos sueltos pasa a un formulario. Devuelve si cambió algo.
export function nestLooseFields(screen) {
  if (!(screen.components ?? []).some(c => isField(c.kind))) return false;
  const all = allComponents(screen);
  let form = null;
  screen.components = screen.components.flatMap(c => {
    if (!isField(c.kind)) { form = null; return [c] }
    const isNew = !form;
    form ??= create('form', all);
    form.parts.push(c);
    return isNew ? [form] : [];
  });
  return true;
}
/* Cambiar el tipo (dentro de la familia, ver kindsLike) conserva el texto visible, la posición y lo que contiene. Si el nombre
   técnico empieza con el prefijo del tipo anterior, se cambia el prefijo: btnGuardar → txtGuardar; btn1 → primer txtN libre. */
export function changeKind(screen, component, kind) {
  const old = COMPONENTS[component.kind].prefix, { prefix } = COMPONENTS[kind];
  component.kind = kind;
  if (!component.name.toLowerCase().startsWith(old)) return;
  const rest = component.name.slice(old.length), base = /^\d*$/.test(rest) ? prefix : prefix + rest; // solo número → numeración nueva
  component.name = base !== prefix && !nameTaken(screen, base, component) ? base : freeName(allComponents(screen), base, component);
}

/* ---------- Modelo de dominio ----------
   Basta el nivel entidad-relación (Libro cap. 3 p.25): entidades = clases UML (DomainConcept, Spec §8.3.20) con atributos
   tipados (FeatureConcept, §8.3.27). Sin relaciones por ahora. Se guarda en project.domain.
   Tipos: Texto, Número y Sí/No son String, Real y Boolean de UML; Fecha es un tipo propio de Croma. */
export const ATTR_TYPES = { text: 'Texto', number: 'Número', boolean: 'Sí/No', date: 'Fecha' };
export function addEntity(project) {
  const domain = (project.domain ??= []), entity = { id: uid(), name: freeName(domain, 'Entidad'), attributes: [] };
  domain.push(entity);
  return entity;
}
export const entityOf = (project, id) => project.domain?.find(e => e.id === id);
export function addAttribute(entity) {
  const attribute = { id: uid(), name: freeName(entity.attributes, 'atributo'), type: 'text' };
  entity.attributes.push(attribute);
  return attribute;
}

/* La pantalla crece sola para mostrar todo su contenido; el alto elegido por el usuario es el mínimo.
   Medidas en px (deben coincidir con workspace.css): .node-head, .comp-row (26 + 4 de separación), y en un bloque
   .comp-block (borde y relleno: 8), su línea «Muestra» (.comp-shown: 20) y su lista vacía (.comp-parts:empty: 22). */
const NODE = { head: 43, row: 26, gap: 4, foot: 40, block: 8, shown: 20, empty: 22 };
const partsHeight = n => (n ? n * (NODE.row + NODE.gap) - NODE.gap : NODE.empty);
const itemHeight = c => (!c.parts ? NODE.row
  : NODE.block + NODE.row + NODE.gap + (COMPONENTS[c.kind].block === 'data' ? NODE.shown + NODE.gap : 0) + partsHeight(c.parts.length));
const contentHeight = s => (s.components?.length ? NODE.head + s.components.reduce((h, c) => h + itemHeight(c) + NODE.gap, 0) + NODE.foot : 0);
export const sizeOf = s => ({ w: s.w || SIZE.defW, h: Math.max(s.h || SIZE.defH, contentHeight(s)) });

export const screenCode = n => `VC-${String(n).padStart(2, '0')}`;
// Primer número libre entre los códigos «VC-n» existentes.
export function nextScreenNumber(project) {
  const used = new Set(project.screens.map(s => +(/^VC-(\d+)$/i.exec(s.code)?.[1] ?? 0)));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

/* ---------- Pantalla inicial (HU13) ----------
   Se guarda en el flujo «Principal» para que, cuando haya varios flujos, no haya que migrar los datos.
   La marca el usuario (puede no haber ninguna, como permite IFML: «one could be the default»). */
export const startScreenId = project => project.flows?.[0]?.startScreenId ?? null;
export function setStart(project, id) {
  project.flows ??= [{ name: 'Principal', startScreenId: null }];
  project.flows[0].startScreenId = id;
}
// Si la pantalla inicial se borró, el proyecto queda sin inicial.
export function dropMissingStart(project) {
  const current = startScreenId(project);
  if (current && !project.screens.some(s => s.id === current)) setStart(project, null);
}

/* ---------- Ubicación de una pantalla nueva ---------- */
const GAP = 40;
const overlaps = (a, b) => {
  const sa = sizeOf(a), sb = sizeOf(b);
  return a.x < b.x + sb.w && a.x + sa.w > b.x && a.y < b.y + sb.h && a.y + sa.h > b.y;
};
// A la derecha de la pantalla de referencia; si el lugar está ocupado, baja hasta encontrar espacio.
export function spotNextTo(project, ref) {
  const spot = { x: ref.x + sizeOf(ref).w + GAP, y: ref.y };
  while (project.screens.some(s => overlaps(spot, s))) spot.y += SIZE.defH + GAP;
  return spot;
}
// Sin referencia: siguiente celda de una cuadrícula de 4 columnas.
export function gridSpot(project) {
  const n = project.screens.length;
  return { x: Math.max(GAP, 120 + (n % 4) * 290), y: Math.max(GAP, 90 + Math.floor(n / 4) * 165) };
}

/* ---------- Alinear (HU11) ----------
   Se alinea respecto al rectángulo que encierra a las pantallas seleccionadas, como en Figma. */
export function alignScreens(screens, kind) {
  const right = s => s.x + sizeOf(s).w, bottom = s => s.y + sizeOf(s).h;
  const box = {
    left: Math.min(...screens.map(s => s.x)), right: Math.max(...screens.map(right)),
    top: Math.min(...screens.map(s => s.y)), bottom: Math.max(...screens.map(bottom)),
  };
  const MOVES = {
    left: s => { s.x = box.left },
    hcenter: s => { s.x = Math.round((box.left + box.right - sizeOf(s).w) / 2) },
    right: s => { s.x = box.right - sizeOf(s).w },
    top: s => { s.y = box.top },
    vcenter: s => { s.y = Math.round((box.top + box.bottom - sizeOf(s).h) / 2) },
    bottom: s => { s.y = box.bottom - sizeOf(s).h },
  };
  screens.forEach(MOVES[kind]);
}
