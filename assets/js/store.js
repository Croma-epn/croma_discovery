// Datos del prototipo (usuarios y proyectos) en localStorage, y la sesión en memoria.
const PREFIX = 'croma-';
const read = key => { try { return localStorage.getItem(PREFIX + key) } catch { return null } };
// Devuelve false si no se pudo guardar (almacenamiento lleno o bloqueado).
const write = (key, value) => { try { localStorage.setItem(PREFIX + key, value); return true } catch { return false } };

const emptyDb = () => ({ users: [], projects: [] });
export const db = (() => { try { return JSON.parse(read('data')) || emptyDb() } catch { return emptyDb() } })();
export const session = { user: null, projectId: null, screenId: null };

/* Guardado. El estado real ('saving' | 'saved' | 'error') se avisa a quien se suscriba (el indicador de la barra). */
let notifySave = () => {}, saveTimer;
export const onSaveStatus = listener => { notifySave = listener };
export function persist() {
  clearTimeout(saveTimer);
  notifySave(write('data', JSON.stringify(db)) ? 'saved' : 'error');
}
// Para cambios continuos (escribir en un campo): guarda una sola vez al terminar.
export function schedulePersist() {
  clearTimeout(saveTimer);
  notifySave('saving');
  saveTimer = setTimeout(persist, 300);
}

// Marca el proyecto como modificado y lo guarda.
export function saveProject(project, { debounce = false } = {}) {
  project.updatedAt = Date.now();
  debounce ? schedulePersist() : persist();
}

// Preferencias de vista. La primera opción de `allowed` es el valor por defecto.
export const prefs = {
  get: (key, allowed) => allowed.includes(read(key)) ? read(key) : allowed[0],
  set: (key, value) => write(key, value),
};

/* ---------- Usuarios ---------- */
export const PROVIDER_LABEL = { google: 'Google', github: 'GitHub' };
export const findUser = email => db.users.find(u => u.email === email);
export const providersOf = user => user.providers || (user.password ? ['password'] : []);
export const socialLabel = user => PROVIDER_LABEL[providersOf(user).find(p => p !== 'password')] || 'otro método';

/* ---------- Proyectos del usuario activo ---------- */
export const findProject = id => db.projects.find(p => p.id === id && p.userId === session.user?.id);
export const currentProject = () => findProject(session.projectId);
export const selectedScreen = () => currentProject()?.screens.find(s => s.id === session.screenId) || null;

export function userProjects(order = 'recent') {
  const time = p => p.updatedAt || p.createdAt || 0;
  return db.projects
    .filter(p => p.userId === session.user?.id)
    .sort((a, b) => order === 'oldest' ? time(a) - time(b) : time(b) - time(a));
}
