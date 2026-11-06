/* ======================================================================
   FLAUXUS — ui/loader.js
   Preloader animado y compartido por todas las transiciones que cargan
   assets: arranque del atrio, entrada a cada Momento, cambio de avatar,
   grabaciones y vuelta al atrio.

   Reglas:
   · Se muestra SIEMPRE antes de tocar la escena y se retira solo cuando el
     flujo confirma que el nivel está listo para jugar.
   · El porcentaje acompaña la carga real por etapas; nunca llega a 100
     hasta que `loaderFinish()` lo autoriza. Mientras tanto la animación y
     el barrido de luz mantienen la espera viva.
   · Si la pestaña se oculta, el temporizador sigue avanzando: al volver,
     la escena no queda atrapada detrás de una cortina.
   ====================================================================== */
import { $ } from '../core/util.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let visible = false;
let shown = 0;
let cap = 8;
let tick = null;
let run = 0;

/* Pinta el porcentaje y el ancho real de la barra. */
function paint() {
  const pct = Math.max(0, Math.min(100, shown));
  const bar = $('plBar'), num = $('plPct');
  if (bar) bar.style.width = pct.toFixed(2) + '%';
  if (num) num.textContent = Math.round(pct) + '%';
}

/* Avance asintótico hacia el techo de la etapa. El techo sube con
   `loaderStage()`: así la barra nunca "miente" llegando al final antes de
   que los assets estén listos. */
function step() {
  if (!visible) return;
  const d = cap - shown;
  if (d > .08) shown += d * .1 + .055;
  else shown = cap;
  paint();
}

function startTick() {
  if (tick) clearInterval(tick);
  tick = setInterval(step, 60);
}

function stopTick() {
  if (tick) clearInterval(tick);
  tick = null;
}

/* Texto del panel. Se usa al abrir el preloader y al cambiar de etapa. */
export function loaderText({ kicker, title, sub } = {}) {
  if (kicker !== undefined) $('plKicker').textContent = kicker;
  if (title !== undefined) $('plTitle').textContent = title;
  if (sub !== undefined) $('plSub').textContent = sub;
}

/**
 * Abre el preloader y devuelve una promesa que resuelve cuando la cortina
 * ya cubre la escena. A partir de ahí se puede desmontar/montar sin que se
 * vea un solo frame incompleto.
 */
export function loaderShow({ kicker, title, sub } = {}) {
  const el = $('preloader');
  if (!el) return Promise.resolve();
  run++;
  visible = true;
  shown = 4;
  cap = 8;
  loaderText({ kicker, title, sub });
  paint();
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('aria-busy', 'true');
  document.body.classList.add('loading');
  startTick();
  return new Promise(res => setTimeout(res, REDUCED ? 0 : 280));
}

/**
 * Declara una etapa de carga. `pct` es el techo aproximado al que puede
 * llegar la barra mientras se espera esta etapa; nunca se muestra 100
 * antes de `loaderFinish()`.
 */
export function loaderStage(pct, sub, title) {
  if (!visible) return;
  cap = Math.max(cap, Math.min(96, pct));
  if (sub !== undefined) $('plSub').textContent = sub;
  if (title !== undefined) $('plTitle').textContent = title;
}

/**
 * Cierra el preloader. Espera a que la barra alcance ~100 %, deja un
 * instante para que el primer frame completo se asiente y recién entonces
 * hace el fundido de salida.
 */
export function loaderFinish(sub) {
  if (!visible) return Promise.resolve();
  if (sub !== undefined) $('plSub').textContent = sub;
  cap = 100;
  const myRun = ++run;
  return new Promise(res => {
    const t0 = performance.now();
    const wait = () => {
      if (!visible) { res(); return; }
      if (shown >= 99.2 || performance.now() - t0 > 4200) {
        shown = 100;
        paint();
        setTimeout(() => {
          if (!visible || myRun !== run) { res(); return; }
          const el = $('preloader');
          el.classList.remove('on');
          el.setAttribute('aria-hidden', 'true');
          el.setAttribute('aria-busy', 'false');
          document.body.classList.remove('loading');
          setTimeout(() => {
            if (!el.classList.contains('on')) {
              visible = false;
              stopTick();
            }
            res();
          }, REDUCED ? 0 : 380);
        }, REDUCED ? 0 : 170);
      } else setTimeout(wait, 45);
    };
    wait();
  });
}

/* Salida de emergencia: si una carga falla, no se deja al usuario mirando
   una cortina infinita. */
export function loaderHide() {
  run++;
  const el = $('preloader');
  if (el) {
    el.classList.remove('on');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-busy', 'false');
  }
  document.body.classList.remove('loading');
  visible = false;
  stopTick();
}
