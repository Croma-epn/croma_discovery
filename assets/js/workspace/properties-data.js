/* Bloque «Datos» de Propiedades (propuesta sin HU). Un solo patrón para capturar y mostrar (prueba de usabilidad Sprint 2,
   como Mendix, Power Apps o Bubble): el bloque elige su entidad y cada elemento dentro elige su atributo («Dato»).
   - Formulario: entidad opcional; sus campos eligen el atributo que guardan.
   - Lista y ficha: entidad obligatoria (DataBinding, Spec §8.4.1, §8.4.5); sus contenidos eligen el atributo que muestran
     (VisualizationAttribute, §8.3.58). */
import { $ } from '../util.js';
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
  const binds = Boolean(parent) && (family === 'field' || family === 'content'); // campo de formulario o contenido de lista/ficha
  show('componentData', Boolean(block || binds));
  show('entityField', Boolean(block));
  show('attributeField', binds);
  show('goToData', !domain.length);
  if (block) renderEntity(domain, block === 'data');
  if (binds) renderAttribute(entityOf(currentProject(), parent.entityId), family === 'field' ? 'guarda este campo' : 'muestra este contenido');
}
function renderEntity(domain, isData) {
  const entity = entityOfTarget();
  $('componentEntityLabel').innerHTML = isData ? 'Entidad <span class="req">*</span>' : 'Entidad que llena';
  mountSelect($('componentEntityHost'), { id: 'componentEntity', title: 'Entidad', options: options(domain, isData ? 'Elige una entidad' : 'Ninguna'),
    value: entity?.id ?? '', disabled: !domain.length, onSelect: chooseEntity });
  $('componentEntityHint').textContent = !domain.length ? ''
    : !isData ? 'Opcional. Sus campos podrán elegir su dato entre los atributos de esta entidad.'
      : entity ? `Muestra registros de «${entity.name}».` : 'Obligatoria: de qué entidad muestra registros.';
}
// role: qué hace el elemento con el atributo («guarda este campo», «muestra este contenido»).
function renderAttribute(entity, role) {
  const attributes = entity?.attributes ?? [];
  mountSelect($('componentAttributeHost'), { id: 'componentAttribute', title: 'Dato', options: options(attributes, 'Sin dato'),
    value: target.component.attributeId ?? '', disabled: !attributes.length, onSelect: id => apply(c => { c.attributeId = id || null }) });
  $('componentAttributeHint').textContent = !entity ? `Primero elige la entidad de «${target.parent.text}»: selecciónalo.`
    : !attributes.length ? `«${entity.name}» aún no tiene atributos.` : `Atributo de «${entity.name}» que ${role}.`;
}

const chooseEntity = id => apply(c => {
  c.entityId = id || null;
  c.parts.forEach(p => { p.attributeId = null }); // lo elegido era de la entidad anterior
});
// Aplica el cambio, guarda y actualiza el lienzo.
function apply(change) {
  change(target.component);
  saveProject(currentProject());
  renderData(target.component, target.parent);
  on.changed();
}

export function initData(callbacks) {
  on = callbacks;
  $('goToData').addEventListener('click', () => on.openData());
}
