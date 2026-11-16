/* Edición en el sitio: reemplaza un texto por un campo. Enter o salir del campo guarda; Escape cancela.
   Si queda vacío o sin cambios, se conserva el texto anterior. */
export function editInline(target, { label, maxLength, onCommit }) {
  const input = document.createElement('input');
  input.className = 'inline-edit';
  input.value = target.textContent;
  input.maxLength = maxLength;
  input.setAttribute('aria-label', label);
  let done = false;
  const finish = save => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    input.remove();
    target.classList.remove('hidden');
    if (save && value && value !== target.textContent) onCommit(value);
  };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') finish(true);
    if (e.key === 'Escape') { e.stopPropagation(); finish(false) }
  });
  input.addEventListener('blur', () => finish(true));
  target.classList.add('hidden');
  target.after(input);
  input.focus();
  input.select();
}
