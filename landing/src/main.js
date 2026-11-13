import './styles/tokens.css';
import './styles/main.css';
import './styles/fonts.css';
import '@fontsource/poppins/latin-400.css';
import '@fontsource/poppins/latin-700.css';
import { MODELS } from './config.js';
import { detectProfile } from './profile.js';
import { createBoot, fetchWithProgress } from './ui/boot.js';
import { logoSVG, narrowFormat } from './ui/logo.js';

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
const bootGlassPanels = [...document.querySelectorAll('#boot .boot-glass')];
if (!profile.reducedMotion) {
  const glassMotion = new Map();
  const bootRoot = document.getElementById('boot');
  const driftGlass = (panel) => {
    if (document.hidden || bootRoot.classList.contains('off') || bootRoot.classList.contains('entering')) return;
    const state = glassMotion.get(panel);
    if (!state || state.evading) return;
    clearTimeout(state.timer);
    const duration = 4300 + Math.random() * 3900;
    state.x = Math.random() * 30 - 15;
    state.y = Math.random() * 22 - 11;
    state.angle = Math.random() * 12 - 6;
    panel.style.setProperty('--glass-drift-duration', `${duration}ms`);
    panel.style.setProperty('--glass-drift-easing', 'cubic-bezier(.42,0,.58,1)');
    // --glass-range (main.css) acota el recorrido en pantallas estrechas para que no salgan del borde
    panel.style.transform = `translate3d(calc(${state.x.toFixed(1)}vw * var(--glass-range, 1)), calc(${state.y.toFixed(1)}vh * var(--glass-range, 1)), 0) rotate(${state.angle.toFixed(1)}deg)`;
    state.timer = setTimeout(() => driftGlass(panel), duration + 120 + Math.random() * 400);
  };
  bootGlassPanels.forEach((panel, i) => {
    glassMotion.set(panel, { timer: 0, evading: false, lastEvasionAt: 0, x: 0, y: 0, angle: 0 });
    setTimeout(() => driftGlass(panel), 250 + i * (900 + Math.random() * 900));
  });

  // Glass starts fleeing as the pointer approaches; pointer-events stay off so controls remain clickable.
  document.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const homeIsVisible = bootRoot.classList.contains('ready') && !bootRoot.classList.contains('entering');
    bootGlassPanels.forEach((panel) => {
      const state = glassMotion.get(panel);
      if (!state) return;
      const rect = panel.getBoundingClientRect();
      const dx = Math.max(rect.left - event.clientX, 0, event.clientX - rect.right);
      const dy = Math.max(rect.top - event.clientY, 0, event.clientY - rect.bottom);
      const distance = Math.hypot(dx, dy);
      if (!homeIsVisible || distance > (state.evading ? 270 : 190)) {
        if (state.evading && (distance > 270 || !homeIsVisible)) {
          state.evading = false;
          clearTimeout(state.timer);
          driftGlass(panel);
        }
        return;
      }
      const now = performance.now();
      if (now - state.lastEvasionAt < 210) return;
      state.evading = true;
      state.lastEvasionAt = now;
      clearTimeout(state.timer);
      let vx = rect.left + rect.width / 2 - event.clientX;
      let vy = rect.top + rect.height / 2 - event.clientY;
      const magnitude = Math.hypot(vx, vy) || 1;
      vx /= magnitude;
      vy /= magnitude;
      const stepX = 7 + Math.random() * 4;
      const stepY = 5 + Math.random() * 3;
      state.x = Math.max(-27, Math.min(27, state.x + vx * stepX));
      state.y = Math.max(-22, Math.min(22, state.y + vy * stepY));
      state.angle = Math.max(-11, Math.min(11, state.angle + (vx > 0 ? 1 : -1) * (2 + Math.random() * 3)));
      panel.style.setProperty('--glass-drift-duration', '360ms');
      panel.style.setProperty('--glass-drift-easing', 'cubic-bezier(.16,.78,.25,1)');
      panel.style.transform = `translate3d(calc(${state.x.toFixed(1)}vw * var(--glass-range, 1)), calc(${state.y.toFixed(1)}vh * var(--glass-range, 1)), 0) rotate(${state.angle.toFixed(1)}deg)`;
    });
  }, { passive: true });

  window.addEventListener('blur', () => {
    bootGlassPanels.forEach((panel) => {
      const state = glassMotion.get(panel);
      if (!state?.evading) return;
      state.evading = false;
      driftGlass(panel);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    bootGlassPanels.forEach((panel) => {
      const state = glassMotion.get(panel);
      if (state && !state.evading) driftGlass(panel);
    });
  });
}
const bootFigures = [...document.querySelectorAll('#boot .boot-figure')];
Promise.all(bootFigures.map((img) => img.decode().catch(() => {}))).then(() => {
  html.classList.add('boot-art-ready');
});
// Logotipo estático: conserva intacta la composición del diseño de inicio.
const bootLogo = document.querySelector('#boot .boot-logo');
bootLogo.innerHTML = logoSVG({ format: narrowFormat(), animated: false, color: 'currentColor' });
// Reveal the shell only after its styles and logo are in place, so first paint cannot catch home elements mid-transition.
html.classList.add('boot-css-ready');

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
    await boot.waitForMinimumDuration(3000);
    await boot.waitForStart();
    html.classList.add('started', 'hero-entering');
    experience.start();
    await boot.transitionToHero(profile.reducedMotion);
    boot.hide();
    html.classList.remove('hero-entering', 'locked');
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
