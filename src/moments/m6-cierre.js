import { track } from '../lib/track.js';
import { logoSVG, animateLogo, narrowFormat } from '../ui/logo.js';

// Momento 6 · Cierre editorial sobre negro puro. Apagado CRT (línea blanca, 300 ms); luego el título del proyecto:
// «REWIND/» gana peso y ancho con el scroll (ejes de Tektur) y FLAUXUS es el logotipo, que se reconstruye por franjas.
// Programa, créditos (COPY §E) y ◀◀ Rebobinar al inicio entran en cascada.
export function createM6({ profile, rewindToStart, sfx }) {
  const section = document.getElementById('m6');
  const inner = section.querySelector('.m6-inner');
  const holder = section.querySelector('.m6-logo');
  const title = section.querySelector('.m6-title');
  [...section.querySelectorAll('.r')].forEach((el, i) => el.style.setProperty('--i', i));
  let lastK = -1;
  holder.innerHTML = logoSVG({ format: narrowFormat(), animated: true, color: 'var(--rw-verde)' });
  const fx = animateLogo(holder.querySelector('svg'), profile);
  const crtoff = document.getElementById('crtoff');
  section.querySelector('.rewind-btn').addEventListener('click', () => { sfx('whoosh'); rewindToStart(); });
  let lastE = 0;
  let shown = false;

  return {
    id: 'm6',
    track: track(section, 0),
    dom(e) {
      if (lastE < 0.3 && e >= 0.3 && !profile.reducedMotion) {
        crtoff.classList.remove('play', 'enter');
        void crtoff.offsetWidth;
        crtoff.classList.add('play');
      }
      lastE = e;
      const on = e > 0.35;
      if (on !== shown) {
        shown = on;
        inner.classList.toggle('on', on);
        if (on) fx.rebuild(700);
      }
      // Peso y ancho del título ligados al scroll (en pasos de 1/10, sin reducir movimiento: directo al final)
      const k = profile.reducedMotion ? 1 : Math.round(Math.min(1, Math.max(0, (e - 0.35) / 0.55)) * 10) / 10;
      if (k !== lastK) { lastK = k; title.style.setProperty('--k', k); }
    },
  };
}
