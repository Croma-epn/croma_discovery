/* Ayudas de formulario. Convención: el error de un campo con id «x» va en el elemento «xError». */
import { $, esc, isEmail } from '../util.js';

export const emailError = value => {
  const email = value.trim();
  return !email ? 'Ingresa tu correo.' : !isEmail(email) ? 'Ingresa un correo válido.' : '';
};

export function setFieldError(id, message) {
  const field = $(id), note = $(id + 'Error');
  if (!field || !note) return;
  field.classList.toggle('invalid', Boolean(message));
  field.setAttribute('aria-invalid', String(Boolean(message)));
  if (message) { note.textContent = message; note.classList.remove('warn') }
  note.classList.toggle('show', Boolean(message));
  syncMaxWarning(id);
}

// Muestra el error y devuelve true si el campo es válido.
export function check(id, message) {
  setFieldError(id, message);
  return !message;
}

// Valida mientras se escribe y al salir del campo.
export function validateLive(id, rule) {
  const run = () => setFieldError(id, rule($(id).value));
  ['input', 'blur'].forEach(ev => $(id).addEventListener(ev, run));
}

/* Aviso ámbar (no bloquea) al llegar al máximo de caracteres. Usa la línea reservada del error,
   así que no mueve nada; si el campo tiene un error rojo, se muestra solo el error. */
function syncMaxWarning(id) {
  const field = $(id), note = $(id + 'Error');
  if (!field || !note || !(field.maxLength > 0) || field.hasAttribute('data-no-max-warning') || field.classList.contains('invalid')) return;
  if (field.value.length >= field.maxLength) {
    note.innerHTML = `<svg class="ic" aria-hidden="true"><use href="#i-info"/></svg>Alcanzaste el máximo de ${field.maxLength} caracteres.`;
    note.classList.add('warn', 'show');
  } else if (note.classList.contains('warn')) note.classList.remove('show');
}
export function initMaxLengthWarnings() {
  document.querySelectorAll('input[maxlength], textarea[maxlength]').forEach(field => {
    if ($(field.id + 'Error')) field.addEventListener('input', () => syncMaxWarning(field.id));
  });
}

// Mensaje general del formulario (p. ej. credenciales incorrectas).
export function setMessage(id, message) {
  const box = $(id);
  if (message) box.innerHTML = `<div><div class="form-error">${esc(message)}</div></div>`;
  box.classList.toggle('show', Boolean(message));
}

// Advertencia que no bloquea el envío (p. ej. portada inválida).
export function setWarning(id, message) {
  const box = $(id);
  box.querySelector('span').textContent = message;
  box.classList.toggle('show', Boolean(message));
}

// Añade el botón «ojo» a cada campo de contraseña.
export function initPasswordToggles() {
  document.querySelectorAll('input[type=password]').forEach(input => {
    const wrap = document.createElement('div'), button = document.createElement('button');
    wrap.className = 'pw-wrap';
    button.type = 'button';
    button.className = 'pw-toggle';
    const render = () => {
      const hidden = input.type === 'password';
      button.setAttribute('aria-label', hidden ? 'Mostrar contraseña' : 'Ocultar contraseña');
      button.innerHTML = `<svg class="ic"><use href="#${hidden ? 'i-eye' : 'i-eye-off'}"/></svg>`;
    };
    button.addEventListener('click', () => { input.type = input.type === 'password' ? 'text' : 'password'; render() });
    input.replaceWith(wrap);
    wrap.append(input, button);
    render();
  });
}
