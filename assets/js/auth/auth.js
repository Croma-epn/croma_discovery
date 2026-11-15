// Iniciar sesión, crear cuenta y recuperar contraseña (simulado: el prototipo no tiene servidor).
import { $, uid, focusLater, isEmail } from '../util.js';
import { db, persist, findUser, socialLabel } from '../store.js';
import { check, emailError, setFieldError, setMessage, validateLive } from '../ui/forms.js';
import { showToast } from '../ui/feedback.js';
import { showAuthPage } from '../shell.js';

const passwordError = v => v.length < 6 ? 'Usa al menos 6 caracteres.' : '';
const matchError = (v, password) => !v || v !== password ? 'Las contraseñas deben coincidir.' : '';

// Reglas por id de campo: se usan al escribir y al enviar.
const RULES = {
  loginEmail: emailError,
  loginPassword: v => v ? '' : 'Ingresa tu contraseña.',
  registerName: v => v.trim() ? '' : 'Escribe tu nombre completo.',
  registerEmail: emailError, // el correo repetido solo se revisa al enviar
  registerPassword: passwordError,
  registerConfirm: v => matchError(v, $('registerPassword').value),
  recoverEmail: emailError,
  recoverCode: v => /^\d{6}$/.test(v) ? '' : 'Ingresa el código de 6 dígitos.',
  recoverPassword: passwordError,
  recoverConfirm: v => matchError(v, $('recoverPassword').value),
};
// extra: error adicional que solo se conoce al enviar.
const valid = (id, extra = '') => check(id, RULES[id]($(id).value) || extra);
const allValid = checks => checks.every(Boolean);
const FORMS = ['login', 'register', 'recover'];

export function showAuth(page) {
  showAuthPage(page);
  FORMS.forEach(form => setMessage(`${form}Message`, ''));
  Object.keys(RULES).forEach(id => setFieldError(id, ''));
  resetRecover();
}

function showLogin(email) {
  showAuth('login');
  $('loginEmail').value = email;
  $('loginPassword').value = '';
}

/* ---------- Recuperar contraseña: 1 correo → 2 código → 3 nueva contraseña ---------- */
let recovery = null, step = 1;
const STEPS = {
  1: { field: 'recoverEmail', label: 'Enviar código', intro: () => 'Escribe tu correo y te enviaremos un código de verificación.' },
  2: { field: 'recoverCode', label: 'Verificar código', intro: () => `Escribe el código de 6 dígitos que enviamos a ${recovery?.user.email ?? ''}.` },
  3: { field: 'recoverPassword', label: 'Cambiar contraseña', intro: () => 'Crea tu nueva contraseña. Debe tener al menos 6 caracteres.' },
};
function renderStep(n) {
  step = n;
  [1, 2, 3].forEach(i => $(`recoverStep${i}`).classList.toggle('hidden', i !== n));
  $('recoverIntro').textContent = STEPS[n].intro();
  $('recoverSubmitLabel').textContent = STEPS[n].label;
  setMessage('recoverMessage', '');
}
function goToStep(n) { renderStep(n); focusLater(STEPS[n].field) }
function resetRecover() {
  recovery = null;
  ['recoverCode', 'recoverPassword', 'recoverConfirm'].forEach(id => { $(id).value = ''; setFieldError(id, '') });
  renderStep(1);
}
function sendCode(user) {
  recovery = { user, code: String(Math.floor(100000 + Math.random() * 900000)) };
  showToast(`Correo simulado: tu código de recuperación es ${recovery.code}`, { ms: 20000 });
}
const submitStep = {
  1() {
    if (!valid('recoverEmail')) return;
    const user = findUser($('recoverEmail').value.trim().toLowerCase());
    if (!user) return setFieldError('recoverEmail', 'No encontramos una cuenta con ese correo.');
    if (!user.password) return setFieldError('recoverEmail', `Esta cuenta usa ${socialLabel(user)} para iniciar sesión.`);
    sendCode(user);
    goToStep(2);
  },
  2() {
    if (!valid('recoverCode', $('recoverCode').value !== recovery.code ? 'El código es incorrecto.' : '')) return;
    goToStep(3);
  },
  3() {
    if (!allValid([valid('recoverPassword'), valid('recoverConfirm')])) return;
    recovery.user.password = $('recoverPassword').value;
    persist();
    showLogin(recovery.user.email);
    showToast('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
  },
};

export function initAuth({ onLogin }) {
  Object.entries(RULES).forEach(([id, rule]) => validateLive(id, rule));
  // Al cambiar la contraseña se revisa otra vez la confirmación, si ya se escribió.
  [['registerPassword', 'registerConfirm'], ['recoverPassword', 'recoverConfirm']].forEach(([password, confirm]) =>
    $(password).addEventListener('input', () => { if ($(confirm).value) valid(confirm) }));
  // El aviso general de cada formulario se borra en cuanto el usuario vuelve a escribir.
  FORMS.forEach(form => $(`${form}Form`).addEventListener('input', () => setMessage(`${form}Message`, '')));

  $('goRegister').addEventListener('click', () => showAuth('register'));
  $('goLogin').addEventListener('click', () => showAuth('login'));
  $('goRecover').addEventListener('click', () => {
    $('recoverEmail').value = $('loginEmail').value.trim();
    showAuth('recover');
    focusLater('recoverEmail');
  });
  $('backToLogin').addEventListener('click', () => {
    const email = $('recoverEmail').value.trim();
    if (isEmail(email)) $('loginEmail').value = email;
    showAuth('login');
  });

  $('loginForm').addEventListener('submit', e => {
    e.preventDefault();
    setMessage('loginMessage', '');
    if (!allValid([valid('loginEmail'), valid('loginPassword')])) return;
    const user = findUser($('loginEmail').value.trim().toLowerCase());
    if (user && !user.password) {
      const label = socialLabel(user);
      return setMessage('loginMessage', `Esta cuenta usa ${label} para iniciar sesión. Pulsa “Continuar con ${label}”.`);
    }
    if (user?.password !== $('loginPassword').value) return setMessage('loginMessage', 'No encontramos una cuenta con esos datos. Revisa tus credenciales o crea una cuenta.');
    onLogin(user);
  });

  $('registerForm').addEventListener('submit', e => {
    e.preventDefault();
    setMessage('registerMessage', '');
    const email = $('registerEmail').value.trim().toLowerCase();
    const taken = findUser(email) ? 'Este correo ya tiene una cuenta.' : '';
    if (!allValid([valid('registerName'), valid('registerEmail', taken), valid('registerPassword'), valid('registerConfirm')])) return;
    db.users.push({ id: uid(), name: $('registerName').value.trim(), email, password: $('registerPassword').value, providers: ['password'] });
    persist();
    showLogin(email);
    showToast('Cuenta creada correctamente.');
  });

  $('recoverCode').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '') });
  $('recoverResend').addEventListener('click', () => {
    if (!recovery) return;
    sendCode(recovery.user);
    $('recoverCode').value = '';
    setFieldError('recoverCode', '');
  });
  $('recoverForm').addEventListener('submit', e => {
    e.preventDefault();
    setMessage('recoverMessage', '');
    submitStep[step]();
  });
}
