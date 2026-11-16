/* Panel «Propiedades», en bloques como Figma.
   Una pantalla: Identificación, Flujo, Tamaño y Alinear (deshabilitado). Varias: Alinear. Ninguna: ayuda. */
import { $ } from '../util.js';
import { currentProject, selectedScreen, saveProject } from '../store.js';
import { check, setFieldError } from '../ui/forms.js';
import { SIZE, sizeOf, startScreenId } from './model.js';

const TEXT_FIELDS = { screenBusiness: 'businessName', screenCode: 'code', screenTechnical: 'technicalName' };
const SIZE_FIELDS = {
  screenWidth: { key: 'w', other: 'h', min: SIZE.minW, max: SIZE.maxW, empty: 'Escribe el ancho.' },
  screenHeight: { key: 'h', other: 'w', min: SIZE.minH, max: SIZE.maxH, empty: 'Escribe el alto.' },
};
const DEFAULT_SIZE = { w: SIZE.defW, h: SIZE.defH };
let on; // { rename(screen), resize(screen), start(id), align(kind) }

export function fillSize(s) {
  const { w, h } = sizeOf(s);
  $('screenWidth').value = w;
  $('screenHeight').value = h;
  Object.keys(SIZE_FIELDS).forEach(id => setFieldError(id, ''));
}

const START_HINTS = {
  this: 'Es la primera pantalla que verá el usuario.',
  none: 'Aún no hay pantalla inicial: márcala para definir dónde empieza el flujo.',
  other: 'Márcala para que el flujo empiece aquí en lugar de la pantalla inicial actual.',
};
function renderStart(s) {
  const start = startScreenId(currentProject());
  $('screenStart').checked = start === s.id;
  $('screenStartHint').textContent = START_HINTS[start === s.id ? 'this' : start ? 'other' : 'none'];
}

// Alinear siempre está a la vista; con menos de 2 pantallas se ve deshabilitado y explica cómo activarlo.
function renderAlign(count) {
  const enabled = count > 1;
  document.querySelectorAll('[data-align]').forEach(button => { button.disabled = !enabled });
  $('alignHint').textContent = enabled
    ? 'Ctrl + clic agrega o quita pantallas de la selección. Arrastra una para mover todo el grupo.'
    : 'Selecciona 2 o más pantallas (Ctrl + clic o arrastrando sobre el fondo) para alinearlas.';
}

// screens: pantallas seleccionadas.
export function render(screens) {
  const [s] = screens, count = screens.length;
  $('propertiesEmpty').classList.toggle('hidden', count > 0);
  $('propertiesBody').classList.toggle('hidden', count === 0);
  $('inlineProperties').classList.toggle('hidden', count !== 1);
  $('groupHeader').classList.toggle('hidden', count < 2);
  $('groupCount').textContent = `${count} pantallas seleccionadas`;
  renderAlign(count);
  if (count !== 1) return;
  Object.entries(TEXT_FIELDS).forEach(([id, key]) => {
    $(id).value = s[key];
    setFieldError(id, '');
    $(`${id}Count`).textContent = s[key].length;
  });
  renderStart(s);
  fillSize(s);
}

function textError(id, value, screen, project) {
  if (!value) return id === 'screenCode' ? 'El código es obligatorio.' : 'Este campo es obligatorio.';
  const duplicated = id === 'screenCode' && project.screens.some(x => x.id !== screen.id && x.code.toLowerCase() === value.toLowerCase());
  return duplicated ? 'Este código ya está en uso.' : '';
}
function onTextInput(id) {
  const project = currentProject(), s = selectedScreen();
  if (!s) return;
  const raw = $(id).value, value = raw.trim();
  $(`${id}Count`).textContent = raw.length;
  if (!check(id, textError(id, value, s, project))) return;
  s[TEXT_FIELDS[id]] = value;
  saveProject(project, { debounce: true });
  on.rename(s);
}

// Alternativa al arrastre (WCAG 2.5.7). Un valor inválido no se aplica y se conserva el último válido.
function onSizeInput(id) {
  const project = currentProject(), s = selectedScreen();
  if (!s) return;
  const { key, other, min, max, empty } = SIZE_FIELDS[id], raw = $(id).value.trim();
  const error = !raw ? empty : !/^\d+$/.test(raw) ? 'Usa solo números enteros.' : +raw < min || +raw > max ? `Usa un valor entre ${min} y ${max}.` : '';
  if (!check(id, error)) return;
  s[key] = +raw;
  s[other] ||= DEFAULT_SIZE[other];
  on.resize(s);
  saveProject(project, { debounce: true });
}

export function initProperties(callbacks) {
  on = callbacks;
  Object.keys(TEXT_FIELDS).forEach(id => $(id).addEventListener('input', () => onTextInput(id)));
  Object.keys(SIZE_FIELDS).forEach(id => ['input', 'blur'].forEach(ev => $(id).addEventListener(ev, () => onSizeInput(id))));
  $('screenStart').addEventListener('change', () => on.start($('screenStart').checked ? selectedScreen().id : null));
  $('alignSection').addEventListener('click', e => {
    const button = e.target.closest('[data-align]');
    if (button) on.align(button.dataset.align);
  });
  $('inlineProperties').addEventListener('submit', e => e.preventDefault());
}
