// Logotipo FLAUXUS «glitch» en tres formatos — vectores entregados por Jaime (08/10/2026):
// horizontal (una fila), vertical (FLA / UX / US) y cuadrado (FLAU / XUS). Originales intactos en
// public/brand/flauxus-{horizontal,vertical,cuadrado}-original.svg.
// Cada fila trae 21 piezas en tres franjas, la central corrida. Para que el glitch sea una intervención sobre una forma
// sólida (y no un corte), las piezas se unen (tools/mergelogo.mjs → logo-paths.js). El color sale de currentColor
// (verde de marca #C2FE0B; el archivo trae #C0FC04).
import { FORMATS } from './logo-paths.js';

export { FORMATS };
// Formato principal (pantalla 3D, portal, cierre en escritorio)
const H = FORMATS.horizontal;
export const GLYPHS = H.letters;
export const ORIGIN = { x: H.box[0], y: H.box[1] };
export const WIDTH = H.box[2];

// Isotipo: la X del horizontal (una sola forma continua)
const X_LETTER = H.letters.find((d) => {
  const xs = [...d.matchAll(/(-?[\d.]+),/g)].map((m) => +m[1]);
  return Math.min(...xs) < 761 && Math.max(...xs) > 761 && Math.max(...xs) - Math.min(...xs) < 200;
});

const PAD = 12;
const paths = (list) => list.map((d) => `<path d="${d}" fill-rule="evenodd"/>`).join('');
let uid = 0;

// format: 'horizontal' | 'vertical' | 'cuadrado'. animated: en reposo es la forma sólida; durante el glitch / la
// reconstrucción, sus franjas se desplazan (recortes con 0,6 u de solape: nunca aparece una línea entre franjas).
export function logoSVG({ format = 'horizontal', color = 'currentColor', animated = false, title = 'FLAUXUS', className = '' } = {}) {
  const F = FORMATS[format];
  const [x, y, w, h] = F.box;
  const vb = `${x - PAD} ${y - PAD} ${w + PAD * 2} ${h + PAD * 2}`;
  const open = `<svg class="flx-logo flx-${format}${animated ? ' flx-anim' : ''} ${className}" viewBox="${vb}" role="img" aria-label="${title}" style="color:${color}" fill="currentColor">`;
  if (!animated) return `${open}${paths(F.letters)}</svg>`;
  const id = `flx${uid++}`;
  const clips = F.bands.map(([y0, y1], i) => `<clipPath id="${id}b${i}"><rect x="${x - 400}" y="${y0 - 0.6}" width="${w + 800}" height="${y1 - y0 + 1.2}"/></clipPath>`).join('');
  const bands = F.bands.map((_, i) => `<g class="flx-band" style="--i:${i}" clip-path="url(#${id}b${i})">${paths(F.letters)}</g>`).join('');
  return `${open}
    <defs>${clips}</defs>
    <g class="flx-solid">${paths(F.letters)}</g>
    <g class="flx-ghost" aria-hidden="true">${bands}</g>
    <g class="flx-main" aria-hidden="true">${bands}</g>
  </svg>`;
}

// Isotipo: la X de FLAUXUS.
export function isoSVG({ color = 'currentColor', className = '' } = {}) {
  return `<svg class="flx-iso ${className}" viewBox="${688.787 - 26 - 6} ${H.box[1] - 6} ${145.553 + 26 + 12} ${H.box[3] + 12}" role="img" aria-label="FLAUXUS" style="color:${color}" fill="currentColor">${paths([X_LETTER])}</svg>`;
}

// Anima los logos .flx-anim: reconstrucción franja por franja y una interferencia breve cada pocos segundos.
// En cada fila del logotipo, la franja central (la que ya viene corrida) es la que más se mueve.
export function animateLogo(svg, { reducedMotion = false } = {}) {
  const bands = [...svg.querySelectorAll('.flx-main .flx-band')];
  const ghosts = [...svg.querySelectorAll('.flx-ghost .flx-band')];
  const set = (els, f) => els.forEach((b, i) => b.style.setProperty('--dx', `${f(i)}px`));
  if (reducedMotion) return { glitch() {}, rebuild() {} };
  const mid = (i) => i % 3 === 1;

  let timer = 0;
  function rebuild(duration = 700) {
    // Las franjas llegan desde lados opuestos, en saltos, de arriba hacia abajo.
    set(bands, (i) => (i % 2 ? 1 : -1) * (160 + (i % 3) * 60));
    svg.classList.add('rebuilding');
    bands.forEach((b, k) => setTimeout(() => b.style.setProperty('--dx', '0px'), (duration / bands.length) * k + 80));
    setTimeout(() => svg.classList.remove('rebuilding'), duration + 120);
  }
  function glitch(strength = 1) {
    const n = 3 + ((Math.random() * 3) | 0);
    let k = 0;
    clearInterval(timer);
    svg.classList.add('glitching');
    timer = setInterval(() => {
      set(bands, (i) => (Math.random() < (mid(i) ? 0.8 : 0.35) ? (Math.random() - 0.5) * (mid(i) ? 46 : 18) * strength : 0));
      set(ghosts, () => (Math.random() - 0.5) * 16 * strength);
      if (++k > n) {
        clearInterval(timer);
        set(bands, () => 0);
        set(ghosts, () => 0);
        svg.classList.remove('glitching');
      }
    }, 55);
  }
  const loop = () => {
    if (document.visibilityState === 'visible' && svg.isConnected && svg.getBoundingClientRect().height > 0) glitch(0.6);
    setTimeout(loop, 5000 + Math.random() * 4000);
  };
  setTimeout(loop, 4000);
  svg.addEventListener('pointerenter', () => glitch(1));
  return { glitch, rebuild };
}

// Formato según el ancho: en pantallas angostas (retrato) el cuadrado; si no, el horizontal.
// «Estrecho» = celular en vertical. Un celular en horizontal (< 768 px de ancho pero ≤ 500 px de alto) usa la
// composición ancha, igual que main.css (misma condición en sus bloques de celular).
export const NARROW_QUERY = '(max-width: 767px) and (min-height: 501px), (max-width: 767px) and (orientation: portrait)';
export const narrowFormat = () => (matchMedia(NARROW_QUERY).matches ? 'cuadrado' : 'horizontal');
