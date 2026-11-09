/* ======================================================================
   FLAUXUS — ui/loader.js
   Preloader compartido por todas las transiciones que cargan recursos:
   arranque del atrio, entrada a cada Momento, cambio de avatar,
   grabaciones y vuelta al atrio.

   Reglas:
   · Se muestra SIEMPRE antes de tocar la escena y se retira solo cuando el
     flujo confirma que el nivel está listo para jugar.
   · No inventa porcentajes. Lo que se muestra es real:
       – la etapa en curso y las ya terminadas (las anuncia el flujo);
       – el avance en bytes del escenario, solo cuando el servidor informa
         su tamaño (AssetManager → setLoadProgress).
     Sin una medición, la barra es un indicador de actividad (barrido), no
     una cifra.
   · Si una carga falla, la cortina no se queda muda: muestra un aviso
     claro con acciones (reintentar / volver) — loaderError().
   · La firma de las funciones se conserva (loaderShow, loaderText,
     loaderStage, loaderFinish, loaderHide): flow.js no cambia de forma.
   ====================================================================== */
import { $ } from '../core/util.js';
import { setLoadProgress } from '../AssetManager.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
let visible = false;
let run = 0;
let current = '';           // etapa en curso
let done = [];              // etapas terminadas en esta carga
let bytes = null;           // { loaded, total } del escenario en curso

const MB = n => (n / 1048576).toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/* ---------- pintura ---------- */
function paintSteps() {
  const ol = $('plSteps');
  if (!ol) return;
  /* Las dos últimas etapas terminadas + la actual: contexto suficiente sin hacer una lista larga. */
  const recent = done.slice(-2);
  ol.innerHTML = recent.map(s => `<li class="ok">${s}</li>`).join('') + (current ? `<li class="now">${current}</li>` : '');
}

function paintMeter() {
  const meter = $('plMeter'), bar = $('plBar'), num = $('plPct');
  if (!meter || !bar) return;
  if (bytes && bytes.total > 0) {
    /* Medición real: barra determinada + cifra en MB y %. */
    const k = Math.max(0, Math.min(1, bytes.loaded / bytes.total));
    meter.classList.add('measured');
    bar.style.width = (k * 100).toFixed(1) + '%';
    if (num) num.textContent = `${MB(bytes.loaded)} de ${MB(bytes.total)} MB · ${Math.round(k * 100)} %`;
  } else {
    meter.classList.remove('measured');
    bar.style.width = '';
    if (num) num.textContent = '';
  }
}

function setStage(label) {
  if (label === undefined || label === current) return;
  if (current) done.push(current);
  current = label;
  bytes = null;
  const sub = $('plSub');
  if (sub) sub.textContent = label;
  paintSteps();
  paintMeter();
}

/* El AssetManager informa los bytes del escenario que baja ahora mismo. */
setLoadProgress((loaded, total) => {
  if (!visible) return;
  bytes = { loaded, total };
  paintMeter();
});

function clearError() {
  const box = $('plError');
  if (box) box.hidden = true;
  $('preloader')?.classList.remove('failed');
}

/* ---------- API ---------- */

/* Textos del panel. Se usa al abrir el preloader y al cambiar de Momento. */
export function loaderText({ kicker, title, sub } = {}) {
  if (kicker !== undefined) $('plKicker').textContent = kicker;
  if (title !== undefined) $('plTitle').textContent = title;
  if (sub !== undefined) setStage(sub);
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
  current = ''; done = []; bytes = null;
  clearError();
  loaderText({ kicker, title, sub });
  paintSteps(); paintMeter();
  el.classList.add('on');
  el.setAttribute('aria-hidden', 'false');
  el.setAttribute('aria-busy', 'true');
  document.body.classList.add('loading');
  return new Promise(res => setTimeout(res, REDUCED ? 0 : 280));
}

/**
 * Declara una etapa de carga. El primer argumento (antes un techo de
 * porcentaje) ya no se muestra: se conserva por compatibilidad con flow.js.
 */
export function loaderStage(_pct, sub, title) {
  if (!visible) return;
  if (title !== undefined) $('plTitle').textContent = title;
  if (sub !== undefined) setStage(sub);
}

/**
 * Cierra el preloader: marca la última etapa como lista, deja un instante
 * para que el primer frame completo se asiente y hace el fundido de salida.
 */
export function loaderFinish(sub) {
  if (!visible) return Promise.resolve();
  setStage(sub ?? 'Todo listo');
  const el = $('preloader');
  el.classList.add('ready');
  const myRun = ++run;
  return new Promise(res => {
    setTimeout(() => {
      if (!visible || myRun !== run) { res(); return; }
      el.classList.remove('on', 'ready');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('aria-busy', 'false');
      document.body.classList.remove('loading');
      setTimeout(() => {
        if (!el.classList.contains('on')) visible = false;
        res();
      }, REDUCED ? 0 : 380);
    }, REDUCED ? 0 : 260);
  });
}

/**
 * Aviso de error dentro de la cortina. `actions` = [{ label, primary, onClick }].
 * La escena queda tapada hasta que el usuario elige: reintentar o volver.
 */
export function loaderError(message, actions = []) {
  const el = $('preloader'), box = $('plError');
  if (!el || !box) { loaderHide(); return; }
  if (!visible) { el.classList.add('on'); visible = true; }
  run++;
  el.classList.add('failed');
  el.setAttribute('aria-busy', 'false');
  $('plErrorMsg').textContent = message;
  const row = $('plErrorBtns');
  row.innerHTML = '';
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn' : 'btns';
    b.textContent = a.label;
    b.addEventListener('click', () => { clearError(); a.onClick?.(); }, { once: true });
    row.appendChild(b);
  }
  box.hidden = false;
  row.querySelector('button')?.focus();
}

/* Salida de emergencia: retira la cortina sin más (sin aviso). */
export function loaderHide() {
  run++;
  const el = $('preloader');
  if (el) {
    el.classList.remove('on', 'ready', 'failed');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-busy', 'false');
  }
  clearError();
  document.body.classList.remove('loading');
  visible = false;
}
