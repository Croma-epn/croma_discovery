// Utilidades sin estado, usadas por todos los módulos.
export const $ = id => document.getElementById(id);

export const uid = () => crypto.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2);

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s = '') => String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);

export const initials = (name = 'Estudiante') =>
  name.trim().split(/\s+/).slice(0, 2).map(word => word[0] || '').join('').toUpperCase() || 'ES';

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const isEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Espera a que termine la animación de entrada antes de enfocar.
export const focusLater = id => setTimeout(() => $(id).focus(), 40);

/* Inserta cada <template id="tpl-X"> en sus elementos [data-template="X"].
   Con data-prefix, antepone el prefijo a los id y a los for del contenido («Name» → «projectName»). */
export function mountTemplates() {
  document.querySelectorAll('[data-template]').forEach(host => {
    const content = $(`tpl-${host.dataset.template}`).content.cloneNode(true);
    const prefix = host.dataset.prefix;
    if (prefix) content.querySelectorAll('[id], label[for]').forEach(el => {
      if (el.id) el.id = prefix + el.id;
      if (el.htmlFor) el.htmlFor = prefix + el.htmlFor;
    });
    host.append(content);
  });
}
