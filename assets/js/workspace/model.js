// Reglas de las pantallas de un proyecto (sin interfaz): tamaño, código, pantalla inicial, ubicación y alineación.
export const SIZE = { defW: 260, defH: 80, minW: 200, maxW: 800, minH: 80, maxH: 600 };
export const sizeOf = s => ({ w: s.w || SIZE.defW, h: s.h || SIZE.defH });

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
