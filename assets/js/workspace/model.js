import { uid } from '../util.js';
// Reglas de las pantallas de un proyecto (sin interfaz): tamaño, código, componentes, pantalla inicial, ubicación y alineación.
export const SIZE = { defW: 260, defH: 80, minW: 200, maxW: 800, minH: 80, maxH: 600 };

/* ---------- Componentes (HU14) ----------
   Nombres conocidos en la paleta; por debajo, el elemento IFML que representan (Spec IFML 1.0 §7.4, §8.1.4, §8.1.10).
   La caja de texto y la lista de selección son Fields: en IFML solo existen dentro de un Form, que la pantalla tendría
   implícito. El botón no es un componente sino el evento que dispara (Spec §7.2). La etiqueta no tiene clase propia:
   es un ViewComponent cuyo significado da su nombre (Libro §5.1).
   family agrupa los tipos que son la misma clase IFML: solo se puede cambiar el tipo dentro de su familia
   (un Field guarda un valor; un evento dispara flujos; Spec §8.3.25, §8.4.3). */
export const COMPONENTS = {
  button: { label: 'Botón', icon: 'i-button', prefix: 'btn', family: 'event', ifml: 'ViewElementEvent' },
  textbox: { label: 'Caja de texto', icon: 'i-textbox', prefix: 'txt', family: 'field', ifml: 'SimpleField (dentro de un Form)' },
  select: { label: 'Lista de selección', icon: 'i-select', prefix: 'sel', family: 'field', ifml: 'SelectionField (dentro de un Form)' },
  label: { label: 'Etiqueta', icon: 'i-label', prefix: 'lbl', family: 'content', ifml: 'ViewComponent' },
};
// Tipos a los que puede cambiar un componente (incluye el suyo).
export const kindsLike = kind => Object.keys(COMPONENTS).filter(k => COMPONENTS[k].family === COMPONENTS[kind].family);
// ¿Otro componente de la pantalla ya usa ese nombre técnico? (sin distinguir mayúsculas)
export const nameTaken = (screen, name, self) => (screen.components ?? []).some(c => c !== self && c.name.toLowerCase() === name.toLowerCase());
const freeName = (screen, base, self) => { let n = 1; while (nameTaken(screen, `${base}${n}`, self)) n++; return `${base}${n}` };

// Nuevo componente al final de la lista de la pantalla, con el primer nombre técnico libre (btn1, btn2…).
export function addComponent(screen, kind) {
  const { label, prefix } = COMPONENTS[kind];
  const component = { id: uid(), kind, name: freeName(screen, prefix), text: label };
  (screen.components ??= []).push(component);
  return component;
}
/* Cambiar el tipo (dentro de la familia, ver kindsLike) conserva el texto visible y la posición. Si el nombre técnico empieza con el prefijo
   del tipo anterior, se cambia el prefijo: btnGuardar → txtGuardar; btn1 → primer txtN libre. Otro nombre no se toca. */
export function changeKind(screen, component, kind) {
  const old = COMPONENTS[component.kind].prefix, { prefix } = COMPONENTS[kind];
  component.kind = kind;
  if (!component.name.toLowerCase().startsWith(old)) return;
  const rest = component.name.slice(old.length), base = /^\d*$/.test(rest) ? prefix : prefix + rest; // solo número → numeración nueva
  component.name = base !== prefix && !nameTaken(screen, base, component) ? base : freeName(screen, base, component);
}

/* La pantalla crece sola para mostrar todos sus componentes; el alto elegido por el usuario es el mínimo.
   Medidas en px del nodo (deben coincidir con .node-head y .comp-row de workspace.css). */
const NODE = { head: 43, row: 30, foot: 40 };
const contentHeight = s => (s.components?.length ? NODE.head + s.components.length * NODE.row + NODE.foot : 0);
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
