/* Bloque «Datos» de Propiedades (propuesta sin HU): la entidad de un bloque, el dato de un campo y qué atributos muestra una
   lista o ficha.
   - Formulario: entidad opcional; sus campos eligen su dato solo entre los atributos de esa entidad.
   - Lista y ficha: entidad obligatoria (DataBinding, Spec §8.4.1, §8.4.5); empiezan sin atributos marcados y tienen
     «Marcar todos / Quitar todos» (VisualizationAttribute, §8.3.58). */
import { $, esc } from '../util.js';
import { currentProject, saveProject } from '../store.js';
import { mountSelect } from '../ui/menus.js';
import { COMPONENTS, entityOf } from './model.js';

let on; // { changed(), openData() }
let target; // { component, parent } mostrado

const show = (id, visible) => $(id).classList.toggle('hidden', !visible);
// Opciones del desplegable: la vacía primero (value '') y luego entidades o atributos.
const options = (items, empty) => [{ value: '', label: empty }, ...items.map(x => ({ value: x.id, label: x.name }))];
const entityOfTarget = () => entityOf(currentProject(), target.component.entityId);

export function renderData(component, parent) {
  target = { component, parent };
  const domain = currentProject().domain ?? [], { block, family } = COMPONENTS[component.kind];
  const isField = parent?.kind === 'form' && family === 'field';
  show('componentData', Boolean(block || isField));
  show('entityField', Boolean(block));
  show('attributeField', isField);
  show('shownField', false);
  show('goToData', !domain.length);
  if (block) renderEntity(domain, block === 'data');
  if (isField) renderAttribute(entityOf(currentProject(), parent.entityId));
}
function renderEntity(domain, isData) {
  const entity = entityOfTarget();
  $('componentEntityLabel').innerHTML = isData ? 'Entidad <span class="req">*</span>' : 'Entidad que llena';
  mountSelect($('componentEntityHost'), { id: 'componentEntity', title: 'Entidad', options: options(domain, isData ? 'Elige una entidad' : 'Ninguna'),
    value: entity?.id ?? '', disabled: !domain.length, onSelect: chooseEntity });
  $('componentEntityHint').textContent = !domain.length ? ''
    : !isData ? 'Opcional. Sus campos podrán elegir su dato entre los atributos de esta entidad.'
      : entity ? `Muestra registros de «${entity.name}».` : 'Obligatoria: de qué entidad muestra registros.';
  if (isData && entity) renderShown(entity);
}
function renderShown(entity) {
  const { shown } = target.component;
  show('shownField', true);
  $('shownList').innerHTML = entity.attributes.length
    ? entity.attributes.map(a => `<label class="prop-check"><input type="checkbox" value="${esc(a.id)}"${shown.includes(a.id) ? ' checked' : ''}> ${esc(a.name)}</label>`).join('')
    : '<small class="prop-hint">Esta entidad aún no tiene atributos.</small>';
  syncToggle(entity);
}
const allShown = entity => entity.attributes.every(a => target.component.shown.includes(a.id));
function syncToggle(entity) {
  $('toggleShown').disabled = !entity.attributes.length;
  $('toggleShown').textContent = entity.attributes.length && allShown(entity) ? 'Quitar todos' : 'Marcar todos';
}
function renderAttribute(entity) {
  const attributes = entity?.attributes ?? [];
  mountSelect($('componentAttributeHost'), { id: 'componentAttribute', title: 'Dato', options: options(attributes, 'Sin dato'),
    value: target.component.attributeId ?? '', disabled: !attributes.length, onSelect: id => apply(c => { c.attributeId = id || null }) });
  $('componentAttributeHint').textContent = !entity ? 'Primero elige la entidad del formulario: selecciona el formulario.'
    : !attributes.length ? `«${entity.name}» aún no tiene atributos.` : `Atributo de «${entity.name}» que guarda este campo.`;
}

const chooseEntity = id => apply(c => {
  c.entityId = id || null;
  if (c.shown) c.shown = []; // lo elegido era de la entidad anterior
  else c.parts.forEach(p => { p.attributeId = null });
});
// Aplica el cambio, guarda y actualiza el lienzo. rerender: false conserva el foco en la casilla que se marcó.
function apply(change, rerender = true) {
  change(target.component);
  saveProject(currentProject());
  if (rerender) renderData(target.component, target.parent);
  on.changed();
}

export function initData(callbacks) {
  on = callbacks;
  $('shownList').addEventListener('change', () => {
    apply(c => { c.shown = [...$('shownList').querySelectorAll('input:checked')].map(input => input.value) }, false);
    syncToggle(entityOfTarget());
  });
  $('toggleShown').addEventListener('click', () => apply(c => {
    const ids = entityOfTarget().attributes.map(a => a.id);
    c.shown = allShown(entityOfTarget()) ? [] : ids;
  }));
  $('goToData').addEventListener('click', () => on.openData());
}
