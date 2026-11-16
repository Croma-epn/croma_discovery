/* Panel «Propiedades», en bloques como Figma.
   Una pantalla: Identificación, Flujo, Tamaño y Alinear (deshabilitado). Varias: Alinear.
   Un componente: su tipo, el elemento IFML que representa, Identificación y Datos (properties-data.js). Ninguna: ayuda. */
import { $ } from '../util.js';
import { currentProject, selectedScreen, saveProject } from '../store.js';
import { check, setFieldError } from '../ui/forms.js';
import { initSelectMenu } from '../ui/menus.js';
import { SIZE, sizeOf, startScreenId, COMPONENTS, nameTaken, changeKind, kindsLike, findComponent, ifmlOf } from './model.js';
import { renderData, initData } from './properties-data.js';

const TEXT_FIELDS = { screenBusiness: 'businessName', screenCode: 'code', screenTechnical: 'technicalName' };
const COMPONENT_FIELDS = { componentText: 'text', componentName: 'name' };
const SIZE_FIELDS = {
  screenWidth: { key: 'w', other: 'h', min: SIZE.minW, max: SIZE.maxW, empty: 'Escribe el ancho.' },
  screenHeight: { key: 'h', other: 'w', min: SIZE.minH, max: SIZE.maxH, empty: 'Escribe el alto.' },
};
const DEFAULT_SIZE = { w: SIZE.defW, h: SIZE.defH };
let on; // { rename(screen), resize(screen), start(id), align(kind), component(screen), openData() }
let component = null; // componente mostrado
let setKindLabel; // marca el tipo elegido en el menú «Tipo»

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

function fillText(fields, target) {
  Object.entries(fields).forEach(([id, key]) => {
    $(id).value = target[key];
    setFieldError(id, '');
    $(`${id}Count`).textContent = target[key].length;
  });
}
// Por qué se puede o no cambiar el tipo (el menú solo ofrece tipos de la misma familia IFML).
const KIND_HINTS = {
  field: 'Puedes cambiarlo por otro campo; se conserva el texto visible.',
  event: 'Un botón no cambia a otro tipo: dispara una acción y no guarda datos como un campo.',
  content: 'Un texto fijo no cambia a otro tipo: solo muestra contenido, como un título o una instrucción.',
  form: 'Un formulario no cambia a otro tipo: agrupa los campos y los botones que envían sus datos.',
  data: 'Puedes cambiarla entre lista y ficha de datos; se conservan la entidad y los botones.',
};
function renderKind(kind) {
  const options = kindsLike(kind);
  $('componentKindMenu').querySelectorAll('[data-value]').forEach(item => item.classList.toggle('hidden', !options.includes(item.dataset.value)));
  $('componentKind').disabled = options.length < 2;
  $('componentKindHint').textContent = KIND_HINTS[COMPONENTS[kind].family];
  setKindLabel(kind);
}
function renderComponent(c) {
  const { parent } = findComponent(selectedScreen(), c.id);
  $('componentIcon').setAttribute('href', `#${COMPONENTS[c.kind].icon}`);
  renderKind(c.kind);
  $('componentIfml').textContent = ifmlOf(c, parent);
  fillText(COMPONENT_FIELDS, c);
  renderData(c, parent);
}

// screens: pantallas seleccionadas. picked: componente seleccionado (su pantalla es la única seleccionada).
export function render(screens, picked) {
  const [s] = screens, count = screens.length;
  component = picked;
  $('propertiesEmpty').classList.toggle('hidden', count > 0);
  $('propertiesBody').classList.toggle('hidden', count === 0);
  $('inlineProperties').classList.toggle('hidden', count !== 1 || Boolean(component));
  $('componentProperties').classList.toggle('hidden', !component);
  $('alignSection').classList.toggle('hidden', Boolean(component));
  $('groupHeader').classList.toggle('hidden', count < 2);
  $('groupCount').textContent = `${count} pantallas seleccionadas`;
  renderAlign(count);
  if (component) return renderComponent(component);
  if (count !== 1) return;
  fillText(TEXT_FIELDS, s);
  renderStart(s);
  fillSize(s);
}

function textError(id, value, screen, project) {
  if (!value) return id === 'screenCode' ? 'El código es obligatorio.' : 'Este campo es obligatorio.';
  const duplicated = id === 'screenCode' && project.screens.some(x => x.id !== screen.id && x.code.toLowerCase() === value.toLowerCase());
  return duplicated ? 'Este código ya está en uso.' : '';
}
const componentError = (id, value, screen) => !value ? 'Este campo es obligatorio.'
  : id === 'componentName' && nameTaken(screen, value, component)
    ? 'Ya hay un componente con este nombre técnico en la pantalla.' : '';

// Valida el campo de texto `id` y, si es válido, lo guarda en target[key] y avisa con notify().
function applyText(id, target, key, error, notify) {
  const raw = $(id).value, value = raw.trim();
  $(`${id}Count`).textContent = raw.length;
  if (!check(id, error(value))) return;
  target[key] = value;
  saveProject(currentProject(), { debounce: true });
  notify();
}
function onTextInput(id) {
  const s = selectedScreen();
  if (s) applyText(id, s, TEXT_FIELDS[id], value => textError(id, value, s, currentProject()), () => on.rename(s));
}
function onKindChange(kind) {
  const s = selectedScreen();
  if (!s || !component || component.kind === kind) return;
  changeKind(s, component, kind);
  saveProject(currentProject());
  renderComponent(component);
  on.component(s);
}
const kindOption = ([kind, { label, icon }]) =>
  `<button type="button" role="menuitemradio" aria-checked="false" data-value="${kind}"><span class="kind-option"><svg class="ic"><use href="#${icon}"/></svg>${label}</span><svg class="ic"><use href="#i-check"/></svg></button>`;

function onComponentInput(id) {
  const s = selectedScreen();
  if (s && component) applyText(id, component, COMPONENT_FIELDS[id], value => componentError(id, value, s), () => on.component(s));
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
  Object.keys(COMPONENT_FIELDS).forEach(id => $(id).addEventListener('input', () => onComponentInput(id)));
  $('componentKindMenu').insertAdjacentHTML('beforeend', Object.entries(COMPONENTS).map(kindOption).join(''));
  setKindLabel = initSelectMenu($('componentKind'), onKindChange);
  initData({ changed: () => on.component(selectedScreen()), openData: () => on.openData() });
  Object.keys(SIZE_FIELDS).forEach(id => ['input', 'blur'].forEach(ev => $(id).addEventListener(ev, () => onSizeInput(id))));
  $('screenStart').addEventListener('change', () => on.start($('screenStart').checked ? selectedScreen().id : null));
  $('alignSection').addEventListener('click', e => {
    const button = e.target.closest('[data-align]');
    if (button) on.align(button.dataset.align);
  });
  ['inlineProperties', 'componentProperties'].forEach(id => $(id).addEventListener('submit', e => e.preventDefault()));
}
