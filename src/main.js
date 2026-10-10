import './styles/tokens.css';
import './styles/main.css';
import './styles/fonts.css';
import { MODELS } from './config.js';
import { detectProfile } from './profile.js';
import { createBoot, fetchWithProgress } from './ui/boot.js';
import { logoSVG, animateLogo, narrowFormat } from './ui/logo.js';

history.scrollRestoration = 'manual';
scrollTo(0, 0);

const profile = detectProfile();
const html = document.documentElement;
html.dataset.input = profile.touch ? 'touch' : 'desktop';
html.dataset.crt = profile.crt ? 'shader' : 'css';

// El 3D es fijo (regla de Jaime, 08/10): solo sin WebGL se usa el respaldo con imágenes.
// Con prefers-reduced-motion se mantiene el 3D, sin efectos automáticos (rebobinado, glitch, autoplay).
// ?flat fuerza el respaldo y ?gl ignora reduced-motion (solo para pruebas).
const params = new URLSearchParams(location.search);
const forceFlat = params.has('flat');
if (params.has('gl')) profile.reducedMotion = false;
const mode = !forceFlat && hasWebGL() ? 'gl' : 'flat';
html.dataset.mode = mode;

const boot = createBoot();
// El logotipo de la pantalla de inicio se reconstruye por bandas apenas carga la página.
const bootLogo = document.querySelector('#boot .boot-logo');
bootLogo.innerHTML = logoSVG({ format: narrowFormat(), animated: true, color: 'var(--rw-verde)' });
animateLogo(bootLogo.querySelector('svg'), profile).rebuild(1100);

// Reloj vivo en la telemetría del preloader
const bootTs = document.getElementById('boot-ts');
if (bootTs) {
  const tick = () => {
    const d = new Date();
    bootTs.textContent = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  };
  tick();
  const tsInterval = setInterval(tick, 1000);
  // Se detiene cuando el boot desaparece
  document.getElementById('boot').addEventListener('transitionend', () => clearInterval(tsInterval), { once: true });
}

// Progreso real: en modo 3D, 15 % el código y 85 % los bytes del GLB de María Clara.
let jsDone = 0;
let glbDone = mode === 'gl' ? 0 : 1;
const report = () => boot.setProgress(jsDone * 0.15 + glbDone * 0.85);

// Lo pesado (Three.js y el GLB) empieza a bajar después del primer pintado de la pantalla de inicio,
// para que no compita con ella.
const afterLoad = new Promise((resolve) => {
  const go = () => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 250)));
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
});
const code = Promise.all([
  import('./experience.js'),
  mode === 'gl' ? afterLoad.then(() => import('./scenes/gl.js')) : null,
]).then((mods) => {
  jsDone = 1;
  report();
  return mods;
});
const glb = mode === 'gl'
  ? afterLoad.then(() => fetchWithProgress(MODELS[profile.model], (p) => { glbDone = p; report(); }))
  : null;

Promise.all([code, glb])
  .then(async ([[{ createExperience }, glModule], buffer]) => {
    const experience = await createExperience({
      canvas: document.getElementById('gl'),
      glbBuffer: buffer,
      profile,
      glModule,
    });
    await boot.waitForStart();
    boot.hide();
    html.classList.remove('locked');
    html.classList.add('started');
    experience.start();
  })
  .catch((err) => {
    console.error(err);
    // Copy del manual §09 para pérdida de red durante una carga.
    boot.fail('SIN CONEXIÓN — La cinta sigue aquí. Reintentar carga.');
  });

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
