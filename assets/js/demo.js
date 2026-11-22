/* Solo para la prueba de usabilidad del Sprint 2 (discovery/sprint-2/prueba/plan.md, §4). Quitar después: este archivo y su llamada en main.js.
   La prueba es virtual: el profesor abre el link desde su equipo, así que la cuenta y el proyecto vienen en el prototipo.
   Se crean una sola vez por navegador; si la cuenta ya existe, no se toca lo que el profesor haya hecho. */
import { $, uid } from './util.js';
import { db, persist, findUser } from './store.js';

const EMAIL = 'test@croma.com', PASSWORD = '123456';
const field = (name, text) => ({ id: uid(), kind: 'textbox', name, text });
const screen = (n, technicalName, businessName, x, y, components = []) => ({ id: uid(), code: `VC-0${n}`, technicalName, businessName, x, y, components });

// El login ya trae las credenciales de prueba: el profesor solo pulsa «Iniciar sesión».
export function seedDemo() {
  $('loginEmail').value = EMAIL;
  $('loginPassword').value = PASSWORD;
  if (findUser(EMAIL)) return;
  const user = { id: uid(), name: 'Profesor de prueba', email: EMAIL, password: PASSWORD, providers: ['password'] }, now = Date.now();
  const form = { id: uid(), kind: 'form', name: 'frmRegistro', text: 'Formulario de registro', entityId: null, parts: [
    field('txtNombre', 'Nombre'), field('txtApellido', 'Apellido'), field('txtCedula', 'Cédula'), field('txtCorreo', 'Correo'),
    field('txtClave', 'Clave'), field('txtConfirmar', 'Confirmar clave'), field('txtCarrera', 'Carrera'), field('txtSemestre', 'Semestre')] };
  db.users.push(user);
  db.projects.push({ id: uid(), userId: user.id, name: 'Sistema de Tutorías', description: 'App para agendar tutorías entre estudiantes y docentes', image: '', createdAt: now, updatedAt: now, screens: [
    screen(1, 'Pantalla1', 'Pantala1', 60, 300), // error de escritura intencional (tarea 2)
    screen(2, 'Registro', 'Registro', 380, 120, [form]), // sin teléfono y contraída (tarea 8)
    screen(3, 'Tutorias', 'Tutorías', 760, 40),
    screen(4, 'DetalleTutoria', 'Detalle de tutoría', 1100, 380)] });
  persist();
}
