// Texto que se escribe con steps(): la cantidad de letras visibles depende del progreso del scroll,
// así que al subir el texto se "des-escribe" (rebobina) en lugar de desaparecer.
// En móvil usa data-short si existe (frase completa más corta, tomada de la misma fuente).
export function createTyper(el, { mobile = false } = {}) {
  const text = (mobile && el.dataset.short) || el.dataset.text || '';
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr-only';
  sr.textContent = text;
  const typed = document.createElement('span');
  typed.className = 'typed';
  typed.setAttribute('aria-hidden', 'true');
  const caret = document.createElement('span');
  caret.className = 'caret';
  caret.setAttribute('aria-hidden', 'true');
  el.append(sr, typed, caret);

  let last = -1;
  // p: 0..1 dentro de su tramo de scroll
  return function set(p) {
    const n = Math.round(Math.min(1, Math.max(0, p)) * text.length);
    if (n === last) return;
    last = n;
    typed.textContent = text.slice(0, n);
    el.classList.toggle('typing', n > 0 && n < text.length);
  };
}

export { span } from '../lib/math.js';
