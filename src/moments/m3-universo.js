import { SCROLL_SCREENS } from '../config.js';
import { track } from '../lib/track.js';
import { span } from '../ui/type.js';
import { createWords } from '../ui/words.js';
import { logoSVG } from '../ui/logo.js';
import { sharpHTML } from '../ui/sharp.js';

// Momento 3 · Qué es FLAUXUS, sobre la pantalla inundada de verde (tinta negra).
// Tres cuadros que se suceden con el scroll — nunca dos a la vez, cada uno con su espacio:
//   A · «Un dispositivo de identidad:» a escala máxima, palabra por palabra; debajo, desplazada, la explicación.
//   B · «Cuando algo falla, el tiempo se rebobina.» → dispara un rebobinado real.
//   C · «Aquí nadie pierde.» entra a gran escala por máscaras; la escala de seis notas se enciende.
export function createM3({ profile, pulseRewind }) {
  const section = document.getElementById('m3');
  const rm = { reducedMotion: profile.reducedMotion };
  const frameA = section.querySelector('.m3-a');
  const frameB = section.querySelector('.m3-b');
  const a1 = createWords(section.querySelector('.m3-a1'), rm);
  const a2 = createWords(section.querySelector('.m3-a2'), rm);
  const b1 = createWords(section.querySelector('.m3-b1'), rm);
  const mega = section.querySelector('.m3-c');
  const lines = [...mega.querySelectorAll('span')];
  const notes = [...section.querySelectorAll('.scale li')];
  section.querySelectorAll('[data-sharp]').forEach((el) => { el.outerHTML = sharpHTML('♯'); });
  // Marca vertical gigante en negro sobre el verde (la pantalla inundada): el formato vertical (FLA / UX / US) en
  // escritorio; en móvil, el horizontal como banda superior.
  const vert = matchMedia('(max-width: 767px)').matches ? 'horizontal' : 'vertical';
  section.querySelector('.m3-vert').innerHTML = logoSVG({ format: vert, color: '#000' });
  let lastLit = -1;
  let lastQ = 0;
  let lastMega = '';
  const outA = { v: -1 };
  const outB = { v: -1 };

  // Salida de un cuadro: sube y se recorta desde abajo (en pasos), libera el espacio para el siguiente.
  function leave(el, v, memo) {
    v = profile.reducedMotion ? (v > 0.5 ? 1 : 0) : Math.round(v * 8) / 8;
    if (v === memo.v) return;
    memo.v = v;
    el.style.transform = v ? `translate3d(0,${(-v * 12).toFixed(1)}vh,0)` : '';
    el.style.clipPath = v ? `inset(-0.3em -0.2em ${(v * 100).toFixed(1)}% -0.2em)` : '';
    el.style.visibility = v >= 1 ? 'hidden' : 'visible';
  }

  return {
    id: 'm3',
    track: track(section, SCROLL_SCREENS.m3),
    dom(e, q) {
      // A
      a1(span(q, 0.0, 0.16));
      a2(span(q, 0.12, 0.26));
      leave(frameA, span(q, 0.32, 0.38), outA);
      // B
      b1(span(q, 0.38, 0.47));
      if (lastQ < 0.48 && q >= 0.48 && q < 0.6) pulseRewind(0.6);
      lastQ = q;
      leave(frameB, span(q, 0.56, 0.62), outB);

      // C · revelado por máscara de cada línea (de abajo hacia arriba), en pasos.
      const r = lines.map((_, i) => span(q, 0.62 + i * 0.06, 0.72 + i * 0.06));
      const key = r.map((v) => v.toFixed(2)).join();
      if (key !== lastMega) {
        lastMega = key;
        lines.forEach((ln, i) => {
          const v = profile.reducedMotion ? (r[i] > 0.5 ? 1 : 0) : Math.round(r[i] * 6) / 6;
          // el margen negativo deja respirar tildes y descendentes fuera de la caja de línea
          ln.style.clipPath = `inset(calc(${((1 - v) * 100).toFixed(1)}% - .3em) -.2em -.2em -.2em)`;
          ln.style.transform = `translateY(${((1 - v) * 0.35).toFixed(3)}em)`;
          ln.style.visibility = v > 0 ? 'visible' : 'hidden';
        });
      }

      const lit = q < 0.82 ? 0 : Math.ceil(span(q, 0.82, 0.96) * notes.length);
      if (lit !== lastLit) {
        notes.forEach((li, i) => li.classList.toggle('on', i < lit));
        lastLit = lit;
      }
    },
  };
}
