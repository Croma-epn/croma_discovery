/* Vista «Datos» (pestaña de la barra superior): modelo de dominio del proyecto como tarjetas de entidades con sus atributos (nombre y tipo).
   No es un diagrama: el profesor pidió una lista o estructura simple de clases y atributos (entrevista sprint 2, P14). */
import { $, esc, plural } from '../util.js';
import { currentProject, saveProject } from '../store.js';
import { showToast, confirmDialog } from '../ui/feedback.js';
import { editInline } from '../ui/inline-edit.js';
import { mountSelect } from '../ui/menus.js';
import { ATTR_TYPES, addEntity, addAttribute, taken } from './model.js';

const NAME_MAX = 30;
let onChange; // avisa al coordinador que cambió el modelo de dominio
const icon = id => `<svg class="ic"><use href="#${id}"/></svg>`;
const delButton = label => `<button class="del-btn data-del" type="button" data-delete aria-label="${label}" title="${label}">${icon('i-trash')}</button>`;
const nameButton = (name, label) => `<button class="data-name" type="button" data-rename title="${label}">${esc(name)}</button>`;
const TYPE_OPTIONS = Object.entries(ATTR_TYPES).map(([value, label]) => ({ value, label }));

const attributeHtml = a => `<li class="data-row" data-attr="${a.id}">${nameButton(a.name, 'Cambiar nombre del atributo')}<div class="toolbar-dropdown data-type"></div>${delButton(`Borrar atributo ${esc(a.name)}`)}</li>`;
const entityHtml = e => `<div class="data-entity" data-entity="${e.id}">
  <div class="data-row data-entity-head">${icon('i-entity')}${nameButton(e.name, 'Cambiar nombre de la entidad')}${delButton(`Borrar entidad ${esc(e.name)}`)}</div>
  <ul class="data-attrs">${e.attributes.map(attributeHtml).join('')}</ul>
  <button class="link-btn data-add-attr" type="button" data-add-attr>${icon('i-plus')} Atributo</button>
</div>`;

export function render() {
  const domain = currentProject()?.domain ?? [];
  $('dataCount').textContent = domain.length;
  $('dataList').innerHTML = domain.map(entityHtml).join('');
  // Tipo de dato: el mismo desplegable que «Ordenar por», compacto.
  $('dataList').querySelectorAll('.data-type').forEach(host => {
    const { item } = locate(host);
    mountSelect(host, { id: `type-${item.id}`, options: TYPE_OPTIONS, value: item.type, title: 'Tipo de dato', ariaLabel: `Tipo de ${item.name}`, compact: true,
      onSelect: type => { item.type = type; save() } });
  });
}

// Entidad y, si el elemento está en una fila de atributo, el atributo; list es donde su nombre debe ser único.
function locate(el) {
  const domain = currentProject().domain, entity = domain.find(e => e.id === el.closest('[data-entity]').dataset.entity);
  const attribute = entity.attributes.find(a => a.id === el.closest('[data-attr]')?.dataset.attr);
  return attribute ? { item: attribute, list: entity.attributes, entity } : { item: entity, list: domain, entity };
}
const save = () => { saveProject(currentProject()); onChange() };

function rename(button) {
  const { item, list, entity } = locate(button), isEntity = item === entity;
  editInline(button, {
    label: isEntity ? 'Nombre de la entidad' : 'Nombre del atributo', maxLength: NAME_MAX,
    onCommit: name => {
      if (taken(list, name, item)) {
        const message = isEntity ? `Ya existe una entidad «${name}».` : `Esta entidad ya tiene un atributo «${name}».`;
        return showToast(message, { icon: 'i-info' });
      }
      item.name = name;
      save();
      render();
    },
  });
}
// Tras crear un elemento, su nombre queda listo para escribirse.
const renameNew = id => rename($('dataList').querySelector(`[data-entity="${id}"] .data-name, [data-attr="${id}"] .data-name`));

async function remove(button) {
  const { item, list, entity } = locate(button);
  if (item === entity && entity.attributes.length) {
    const ok = await confirmDialog({ title: `¿Borrar la entidad «${entity.name}»?`, message: `También se borrará: ${plural(entity.attributes.length, 'atributo', 'atributos')}.`, confirm: 'Borrar entidad' });
    if (!ok) return;
  }
  list.splice(list.indexOf(item), 1);
  save();
  render();
}

export function initDataPanel(changed) {
  onChange = changed;
  $('addEntity').addEventListener('click', () => {
    const entity = addEntity(currentProject());
    save();
    render();
    renameNew(entity.id);
  });
  $('dataList').addEventListener('click', e => {
    const target = e.target.closest('[data-rename], [data-delete], [data-add-attr]');
    if (!target) return;
    if (target.matches('[data-rename]')) return rename(target);
    if (target.matches('[data-delete]')) return remove(target);
    const attribute = addAttribute(locate(target).entity);
    save();
    render();
    renameNew(attribute.id);
  });
}
