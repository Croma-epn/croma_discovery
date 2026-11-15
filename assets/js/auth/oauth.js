// Acceso con Google / GitHub (simulado: el usuario escribe los datos que devolvería el proveedor).
import { $, uid, focusLater } from '../util.js';
import { db, persist, findUser, providersOf, PROVIDER_LABEL } from '../store.js';
import { check, emailError, setFieldError, setMessage, validateLive } from '../ui/forms.js';
import { showModal, hideModal, registerModal } from '../ui/feedback.js';

let provider = null, origin = 'login'; // origin: formulario desde el que se abrió («login» o «register»)
const isGitHub = () => provider === 'github';
const RULES = {
  oauthUser: v => isGitHub() && !v.trim() ? 'Escribe el usuario de GitHub.' : '',
  oauthName: v => provider === 'google' && !v.trim() ? 'Escribe el nombre de la cuenta.' : '',
  oauthEmail: v => isGitHub() && !$('oauthVerified').checked ? '' : emailError(v),
};

function open(name, from) {
  provider = name;
  origin = from;
  const label = PROVIDER_LABEL[name];
  setMessage(`${from}Message`, '');
  $('oauthTitle').textContent = `Continuar con ${label}`;
  $('oauthIntro').textContent = `Croma quiere acceder a tu nombre y a tu correo de ${label}.`;
  $('oauthNameLabel').textContent = isGitHub() ? 'Nombre del perfil (opcional)' : 'Nombre de la cuenta';
  ['oauthUserField', 'oauthVerifiedRow'].forEach(id => $(id).classList.toggle('hidden', !isGitHub()));
  Object.keys(RULES).forEach(id => { $(id).value = ''; setFieldError(id, '') });
  $('oauthVerified').checked = true;
  showModal($('oauthBackdrop'));
  focusLater(isGitHub() ? 'oauthUser' : 'oauthName');
}

function close() { hideModal($('oauthBackdrop')); provider = null }

function fail(kind) {
  if (!provider) return;
  const label = PROVIDER_LABEL[provider];
  close();
  setMessage(`${origin}Message`, kind === 'cancel' ? `No se completó el acceso con ${label}.` : `No pudimos conectar con ${label}. Inténtalo de nuevo.`);
}

function complete(onLogin) {
  if (!provider || !Object.keys(RULES).map(id => check(id, RULES[id]($(id).value))).every(Boolean)) return;
  const name = provider, verified = !isGitHub() || $('oauthVerified').checked;
  const email = $('oauthEmail').value.trim().toLowerCase();
  const displayName = $('oauthName').value.trim() || $('oauthUser').value.trim();
  close();
  if (!verified) return setMessage(`${origin}Message`, 'Tu cuenta de GitHub no tiene un correo verificado. Verifícalo en GitHub o usa otro método de acceso.');
  let user = findUser(email);
  if (!user) db.users.push(user = { id: uid(), name: displayName, email, providers: [name] });
  else if (!providersOf(user).includes(name)) user.providers = [...providersOf(user), name];
  persist();
  onLogin(user);
}

export function initOauth({ onLogin }) {
  Object.entries(RULES).forEach(([id, rule]) => validateLive(id, rule));
  document.querySelectorAll('[data-oauth]').forEach(button =>
    button.addEventListener('click', () => open(button.dataset.oauth, button.closest('#registerPage') ? 'register' : 'login')));
  $('oauthForm').addEventListener('submit', e => { e.preventDefault(); complete(onLogin) });
  ['cancelOauth', 'closeOauth'].forEach(id => $(id).addEventListener('click', () => fail('cancel')));
  $('oauthFail').addEventListener('click', () => fail('error'));
  registerModal($('oauthBackdrop'), () => fail('cancel'));
  // Al marcar o desmarcar «correo verificado», el error del correo se recalcula; un correo vacío sin tocar no muestra error.
  $('oauthVerified').addEventListener('change', () => {
    const email = $('oauthEmail');
    const untouched = $('oauthVerified').checked && !email.value.trim() && !email.classList.contains('invalid');
    setFieldError('oauthEmail', untouched ? '' : RULES.oauthEmail(email.value));
  });
}
