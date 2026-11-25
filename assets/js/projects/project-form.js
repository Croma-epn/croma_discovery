/* Campos de proyecto reutilizables (plantilla tpl-project-fields): nombre, descripción y portada.
   Los usan «Crear proyecto» y «Editar proyecto»; cada uno con su prefijo de id. */
import { $, esc, focusLater } from '../util.js';
import { check, setFieldError, setWarning, validateLive } from '../ui/forms.js';
import { NAME_MAX } from './projects.js';

const DESCRIPTION_MAX = 150;
const RULES = {
  Name: v => !v.trim() ? 'El nombre del proyecto es obligatorio.' : v.length > NAME_MAX ? `Usa máximo ${NAME_MAX} caracteres.` : '',
  Description: v => v.length > DESCRIPTION_MAX ? `Usa máximo ${DESCRIPTION_MAX} caracteres.` : '',
};
const COVER_KEPT = 'Archivo inválido, se mantiene la portada actual.';
const COVER_MAX_BYTES = 4 * 1024 * 1024, COVER_MAX_SIDE = 1000;

// Reduce la imagen a 1000 px como máximo y la devuelve como JPEG en data URL.
function readCoverImage(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('El archivo debe ser una imagen.'));
    if (file.size > COVER_MAX_BYTES) return reject(new Error('La imagen supera los 4 MB. Usa una más ligera.'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, COVER_MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--croma-color-superficie');
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL('image/jpeg', .82)) } catch { reject(new Error('No se pudo procesar la imagen.')) }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')) };
    img.src = url;
  });
}

// withoutCoverNote: qué pasa si la imagen no sirve (p. ej. «El proyecto se creará sin portada.»).
export function createProjectForm(prefix, { withoutCoverNote }) {
  const el = name => $(prefix + name);
  const fieldIds = Object.keys(RULES).map(key => prefix + key);
  let image = '';

  function renderCover() {
    el('Cover').innerHTML = image
      ? `<img src="${esc(image)}" alt="Vista previa de la portada">`
      : '<svg class="ic"><use href="#i-image"/></svg>';
    el('CoverRemove').classList.toggle('hidden', !image);
  }
  // La portada es opcional: un archivo inválido solo genera una advertencia y nunca bloquea el envío.
  function setCover(value, warning = '') {
    image = value;
    el('CoverInput').value = '';
    setWarning(prefix + 'CoverWarning', warning);
    renderCover();
  }
  const updateCount = key => { el(key + 'Count').textContent = el(key).value.length };

  Object.entries(RULES).forEach(([key, rule]) => {
    el(key).addEventListener('input', () => updateCount(key));
    validateLive(prefix + key, rule);
  });
  el('CoverPick').addEventListener('click', () => el('CoverInput').click());
  el('CoverRemove').addEventListener('click', () => setCover(''));
  el('CoverInput').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setCover(await readCoverImage(file)) }
    catch (err) { setCover(image, image ? COVER_KEPT : `${err.message} ${withoutCoverNote}`) }
  });

  const form = {
    // Limpia errores y advertencias, conservando lo escrito.
    clearFeedback() {
      fieldIds.forEach(id => setFieldError(id, ''));
      setCover(image);
    },
    fill({ name = '', description = '', image: cover = '' } = {}) {
      el('Name').value = name;
      el('Description').value = description;
      Object.keys(RULES).forEach(updateCount);
      image = cover;
      form.clearFeedback();
    },
    validate: () => Object.entries(RULES).map(([key, rule]) => check(prefix + key, rule(el(key).value))).every(Boolean),
    values: () => ({ name: el('Name').value.trim(), description: el('Description').value.trim(), image }),
    focus: () => focusLater(prefix + 'Name'),
  };
  form.fill();
  return form;
}
