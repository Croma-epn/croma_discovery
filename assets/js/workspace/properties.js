// Panel «Propiedades» de la pantalla seleccionada: código, nombres y tamaño.
import { $, focusLater } from '../util.js';
import { currentProject, selectedScreen, saveProject } from '../store.js';
import { check, setFieldError } from '../ui/forms.js';
import { SIZE, sizeOf } from './canvas.js';

const TEXT_FIELDS = { screenCode: 'code', screenTechnical: 'technicalName', screenBusiness: 'businessName' };
const SIZE_FIELDS = {
  screenWidth: { key: 'w', other: 'h', min: SIZE.minW, max: SIZE.maxW, empty: 'Escribe el ancho.' },
  screenHeight: { key: 'h', other: 'w', min: SIZE.minH, max: SIZE.maxH, empty: 'Escribe el alto.' },
};
const DEFAULT_SIZE = { w: SIZE.defW, h: SIZE.defH };
let on; // { rename(screen), resize(screen) }

export function fillSize(s) {
  const { w, h } = sizeOf(s);
  $('screenWidth').value = w;
  $('screenHeight').value = h;
  Object.keys(SIZE_FIELDS).forEach(id => setFieldError(id, ''));
}

export function render() {
  const s = selectedScreen();
  $('propertiesEmpty').classList.toggle('hidden', Boolean(s));
  $('inlineProperties').classList.toggle('hidden', !s);
  if (!s) return;
  Object.entries(TEXT_FIELDS).forEach(([id, key]) => {
    $(id).value = s[key];
    setFieldError(id, '');
    $(`${id}Count`).textContent = s[key].length;
  });
  fillSize(s);
}

export const focus = () => focusLater('screenCode');

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
  $('inlineProperties').addEventListener('submit', e => e.preventDefault());
}
