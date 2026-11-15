// Operaciones sobre los proyectos del usuario activo (sin interfaz).
import { uid } from '../util.js';
import { db, session, persist, saveProject, userProjects } from '../store.js';

export const NAME_MAX = 30;

export function createProject({ name, description, image }) {
  const now = Date.now();
  const project = { id: uid(), userId: session.user.id, name, description, image, createdAt: now, updatedAt: now, screens: [] };
  db.projects.push(project);
  persist();
  return project;
}

export function updateProject(project, fields) {
  Object.assign(project, fields);
  saveProject(project);
}

export function deleteProject(id) {
  db.projects = db.projects.filter(p => p.id !== id);
  if (session.projectId === id) session.projectId = null;
  persist();
}

// Nombre de la copia: «Nombre (copia)», «Nombre (copia 2)»… Se recorta el nombre, nunca la marca, para no pasar de 30 caracteres.
function copyName(name) {
  const taken = new Set(userProjects().map(p => p.name.toLowerCase()));
  const base = name.replace(/\s\(copia(?: \d+)?\)$/, '');
  for (let n = 1; ; n++) {
    const mark = n === 1 ? ' (copia)' : ` (copia ${n})`;
    const candidate = base.slice(0, NAME_MAX - mark.length).trimEnd() + mark;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function duplicateProject(source) {
  const now = Date.now();
  const copy = { ...source, id: uid(), name: copyName(source.name), createdAt: now, updatedAt: now, screens: source.screens.map(s => ({ ...s, id: uid() })) };
  db.projects.push(copy);
  persist();
  return copy;
}
