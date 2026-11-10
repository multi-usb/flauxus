import { SCROLL_SCREENS } from '../config.js';
import { track } from '../lib/track.js';
import { createTyper } from '../ui/type.js';
import { clamp01 } from '../lib/math.js';
import { buildMasks, MASK_STEPS } from '../ui/photomask.js';

// Dónde está su rostro en cada foto (centro nítido de la máscara)
const FACE = { 'ph-a': [0.54, 0.3], 'ph-b': [0.54, 0.4], 'ph-c': [0.48, 0.38], 'ph-d': [0.34, 0.52], 'ph-e': [0.46, 0.3] };

// Momento 4 · María Clara — composición editorial.
// Un "escenario" más alto que la pantalla se desplaza dentro de la sección fijada; cada capa (nombre gigante,
// fotografías, citas) tiene su propia profundidad (parallax). Cada fotografía se condensa desde su centro (máscara
// orgánica de nebulosa y partículas, ver main.css .ph) ligada al scroll; al subir, se vuelve a deshacer.
export function createM4({ profile }) {
  const section = document.getElementById('m4');
  const stage = section.querySelector('.m4-stage');
  const layers = [...stage.querySelectorAll('[data-depth]')].map((el) => ({ el, depth: +el.dataset.depth, y: 0 }));
  const photos = [...stage.querySelectorAll('.ph')].map((el, i) => {
    const key = [...el.classList].find((c) => FACE[c]);
    const img = el.querySelector('img');
    return { el, last: -1, step: -1, urls: null, face: FACE[key] || [0.5, 0.45], aspect: img.height / img.width, seed: 11 + i * 97 };
  });
  const quotes = [...stage.querySelectorAll('.m4-quote')].map((el) => ({ el, type: createTyper(el.querySelector('.type'), profile) }));
  const name = stage.querySelector('.m4-name');
  let stageH = 0;
  // Profundidad de cada capa: la del marcado (data-depth), salvo que la composición la ajuste por CSS (--depth;
  // en celular las fotos que flanquean la cita viajan con ella). Se lee al medir, nunca por cuadro.
  const depthOf = (el) => { const v = parseFloat(getComputedStyle(el).getPropertyValue('--depth')); return Number.isFinite(v) ? v : +el.dataset.depth; };
  const measure = () => {
    stageH = stage.offsetHeight;
    for (const l of layers) l.depth = depthOf(l.el);
  };
  addEventListener('resize', measure);
  measure();

  return {
    id: 'm4',
    track: track(section, SCROLL_SCREENS.m4),
    dom(e, q, { active }) {
      if (!stageH) measure();
      const vh = innerHeight;
      // El escenario sube con el scroll (empieza a moverse ya durante la entrada).
      const travel = Math.max(0, stageH - vh);
      const p = clamp01((e - 0.5) * 0.25 + q);
      stage.style.transform = `translate3d(0,${(-p * travel).toFixed(1)}px,0)`;
      // Parallax por profundidad (<1 se queda atrás, 1 = con el escenario, >1 más rápido). En p = 0, todo en su sitio.
      if (!profile.reducedMotion) {
        for (const l of layers) {
          const y = -(l.depth - 1) * p * vh * 0.9;
          if (Math.abs(y - l.y) > 0.5) { l.y = y; l.el.style.translate = `0 ${y.toFixed(1)}px`; }
        }
      }
      if (!active && e < 0.2) return;

      // Condensación de cada foto según su posición en pantalla
      for (const ph of photos) {
        const r = ph.el.getBoundingClientRect();
        // En táctil no hay hover: la foto que cruza el centro de la pantalla recupera su color real.
        if (profile.touch) ph.el.classList.toggle('color', Math.abs(r.top + r.height / 2 - vh / 2) < vh * 0.2);
        let v = clamp01((vh * 1.02 - r.top) / (r.height * 0.9 + vh * 0.25));
        v = 1 - Math.pow(1 - v, 2);
        if (profile.reducedMotion) v = v > 0.3 ? 1 : 0;
        if (Math.abs(v - ph.last) < 0.004) continue;
        ph.last = v;
        // máscara fragmentada: se genera la primera vez que la foto se acerca (≈ 30 ms por foto)
        if (!ph.urls && v > 0) ph.urls = buildMasks(ph.el.offsetHeight / ph.el.offsetWidth || ph.aspect, ph.face[0], ph.face[1], ph.seed);
        const step = v <= 0 ? -1 : Math.min(MASK_STEPS - 1, Math.floor(v * MASK_STEPS));
        if (step !== ph.step) {
          ph.step = step;
          ph.el.style.visibility = step < 0 ? 'hidden' : 'visible';
          if (step >= 0) { const u = `url(${ph.urls[step]})`; ph.el.style.maskImage = u; ph.el.style.webkitMaskImage = u; }
        }
      }
      // Citas: se escriben al cruzar la pantalla
      for (const qt of quotes) {
        const r = qt.el.getBoundingClientRect();
        qt.type(clamp01((vh * 0.85 - r.top) / (vh * 0.4)));
      }
      // El nombre se condensa al pasar (eje de ancho de la display)
      const nr = name.getBoundingClientRect();
      const w = 100 - clamp01((vh * 0.5 - nr.top) / vh) * 30;
      name.style.setProperty('--wdth', w.toFixed(1));
    },
  };
}
