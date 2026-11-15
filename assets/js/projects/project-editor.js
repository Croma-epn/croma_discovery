// Página «Crear proyecto» y modal «Editar proyecto».
import { $ } from '../util.js';
import { findProject } from '../store.js';
import { showToast, showModal, hideModal, isOpen, registerModal } from '../ui/feedback.js';
import { showAppPage } from '../shell.js';
import { createProject, updateProject } from './projects.js';
import { createProjectForm } from './project-form.js';

let createForm, editForm, editingId = null;

// Conserva el borrador: si el estudiante salió con el logo o «Cancelar», ve lo que había escrito.
export function showCreateProject() {
  showAppPage('createProject', { title: 'Crear proyecto' });
  createForm.clearFeedback();
  createForm.focus();
}
export const resetCreateForm = () => createForm.fill();

export function openEditProject(id) {
  const project = findProject(id);
  if (!project) return;
  editingId = id;
  editForm.fill(project);
  showModal($('editProjectBackdrop'));
  editForm.focus();
}
export function closeEditProject() {
  if (!isOpen($('editProjectBackdrop'))) return;
  hideModal($('editProjectBackdrop'));
  editingId = null;
}

// onCreated(project): abre el proyecto nuevo. onCancel: vuelve al catálogo. onSaved: refresca el catálogo.
export function initProjectEditor({ onCreated, onCancel, onSaved }) {
  createForm = createProjectForm('project', { withoutCoverNote: 'El proyecto se creará sin portada.' });
  editForm = createProjectForm('editProject', { withoutCoverNote: 'El proyecto se guardará sin portada.' });

  $('cancelProject').addEventListener('click', onCancel);
  $('projectForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!createForm.validate()) return; // el botón sigue activo: con errores simplemente no se crea
    const project = createProject(createForm.values());
    createForm.fill();
    onCreated(project);
    showToast('Proyecto creado. Agrega tu primera pantalla.');
  });

  registerModal($('editProjectBackdrop'), closeEditProject);
  ['closeEditProject', 'cancelEditProject'].forEach(id => $(id).addEventListener('click', closeEditProject));
  $('editProjectForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!editingId || !editForm.validate()) return;
    const project = findProject(editingId);
    if (project) {
      updateProject(project, editForm.values());
      onSaved();
      showToast('Proyecto actualizado.');
    }
    closeEditProject();
  });
}
