/* Punto de entrada: monta las plantillas, inicia cada módulo y define la navegación entre páginas.
   Los módulos no se importan entre sí para navegar: reciben aquí lo que deben hacer (callbacks). */
import { mountTemplates } from './util.js';
import { session } from './store.js';
import { initDialog, showToast } from './ui/feedback.js';
import { initMaxLengthWarnings, initPasswordToggles } from './ui/forms.js';
import { initShell, renderAccount } from './shell.js';
import { initAuth, showAuth } from './auth/auth.js';
import { initOauth } from './auth/oauth.js';
import { initPortfolio, renderProjects, showPortfolio } from './projects/portfolio.js';
import { initProjectEditor, showCreateProject, openEditProject, closeEditProject, resetCreateForm } from './projects/project-editor.js';
import { initWorkspace, openWorkspace } from './workspace/workspace.js';
import { seedDemo } from './demo.js'; // solo para la prueba de usabilidad del Sprint 2

seedDemo();
mountTemplates();
initPasswordToggles();
initMaxLengthWarnings();
initDialog();

const nav = {
  login(user) {
    session.user = user;
    renderAccount(user);
    nav.portfolio();
    showToast('Sesión iniciada correctamente.');
  },
  logout() {
    Object.assign(session, { user: null, projectId: null, screenId: null });
    resetCreateForm(); // el borrador no pasa a la siguiente cuenta
    showAuth('login');
    showToast('Sesión cerrada.');
  },
  portfolio() {
    session.projectId = session.screenId = null;
    closeEditProject();
    showPortfolio();
  },
};

initAuth({ onLogin: nav.login });
initOauth({ onLogin: nav.login });
initShell({ onHome: nav.portfolio, onLogout: nav.logout });
initPortfolio({ onOpen: openWorkspace, onCreate: showCreateProject, onEdit: openEditProject });
initProjectEditor({ onCreated: project => openWorkspace(project.id), onCancel: nav.portfolio, onSaved: renderProjects });
initWorkspace();

showAuth('login');
