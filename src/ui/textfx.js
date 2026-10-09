import { SHARP_SVG } from './sharp.js';
// Microinteracciones tipográficas.
// · split: los titulares display se encienden letra a letra en orden aleatorio (como píxeles de un
//   panel dot-matrix) cuando su contenedor aparece o cambia el texto.
// · scramble: al pasar el cursor (o enfocar) por un botón/prompt, sus letras se revuelven y se
//   resuelven de izquierda a derecha.
// Con prefers-reduced-motion no se anima nada: el texto aparece completo.
const GLYPHS = '#%&*+=<>/01ABCDEFXZ';

export function createTextFx({ reducedMotion }) {
  // ---------- split ----------
  function split(el, text = el.textContent) {
    el.setAttribute('aria-label', text);
    el.textContent = '';
    [...text].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      if (ch === '♯') { s.classList.add('sharp'); s.innerHTML = SHARP_SVG; } else s.textContent = ch;
      s.style.setProperty('--d', `${Math.round(Math.random() * 7) * 45}ms`);
      el.append(s);
    });
    if (!reducedMotion) {
      el.classList.remove('lit');
      void el.offsetWidth;
      el.classList.add('lit');
    }
  }

  // Se re-lanza cada vez que el elemento se vuelve visible (clase .on del contenedor) o cambia su texto.
  document.querySelectorAll('.split').forEach((el) => {
    if (el.textContent.trim()) split(el);
    new MutationObserver(() => {
      if (el.querySelector('.ch')) return;
      split(el);
    }).observe(el, { childList: true });
    const host = el.closest('.m6-inner, .sala-detail');
    if (host) {
      new MutationObserver(() => {
        if (host.classList.contains('on') && !reducedMotion) {
          el.classList.remove('lit');
          void el.offsetWidth;
          el.classList.add('lit');
        }
      }).observe(host, { attributes: true, attributeFilter: ['class'] });
    }
  });

  // ---------- scramble ----------
  document.querySelectorAll('[data-scramble]').forEach((el) => {
    const original = el.textContent;
    el.setAttribute('aria-label', original);
    let raf = 0;
    const run = () => {
      if (reducedMotion) return;
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const dur = 360;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const fixed = Math.floor(k * original.length);
        let out = '';
        for (let i = 0; i < original.length; i++) {
          const c = original[i];
          out += i < fixed || c === ' ' || c === '[' || c === ']' || c === '◀' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (k < 1) raf = requestAnimationFrame(step);
        else el.textContent = original;
      };
      raf = requestAnimationFrame(step);
    };
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') run(); });
    el.addEventListener('focus', run);
  });

  return { split };
}
