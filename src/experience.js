import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { FPS_FLOOR, FPS_FALL_SECONDS } from './config.js';
import { createFlatBackend } from './scenes/flat.js';
import { createChannels } from './ui/channels.js';
import { createPlayer } from './ui/player.js';
import { createCursor } from './ui/cursor.js';
import { createSoundViz } from './ui/soundviz.js';
import { createNoteTrigger } from './ui/notes.js';
import { createHud } from './ui/hud.js';
import { createLens } from './ui/lens.js';
import { createTextFx } from './ui/textfx.js';
import { createAudio } from './audio/engine.js';
import { createActivation } from './ui/activation.js';
import { createM1 } from './moments/m1-impacto.js';
import { createM2 } from './moments/m2-portal.js';
import { createM3 } from './moments/m3-universo.js';
import { isoSVG } from './ui/logo.js';
import { createM4 } from './moments/m4-maria-clara.js';
import { createM5 } from './moments/m5-salas.js';
import { createM6 } from './moments/m6-cierre.js';

gsap.registerPlugin(ScrollTrigger);
ScrollTrigger.config({ ignoreMobileResize: true });

// Director de la landing. Lee el scroll (suavizado ~120 ms, sin inercia), decide qué momento manda,
// le pasa su progreso al backend visual (WebGL o respaldo) y al HTML de cada momento.
export async function createExperience({ canvas, glbBuffer, profile, glModule }) {
  const channels = createChannels({ autoplay: !profile.reducedMotion });
  const backend = glModule
    ? await glModule.createGlBackend({ canvas, glbBuffer, profile, channels })
    : createFlatBackend({ profile, channels });
  const hud = createHud();
  const lens = createLens();
  const audio = createAudio();
  const soundBtn = document.getElementById('sound');
  soundBtn.innerHTML = '<canvas class="viz" aria-hidden="true"></canvas><span class="snd-label" aria-hidden="true"></span>';
  document.querySelector('#hud .hud-iso').innerHTML = isoSVG({ color: 'currentColor' });
  const syncSound = (on) => soundBtn.setAttribute('aria-pressed', String(on));
  syncSound(audio.enabled);
  audio.onChange(syncSound);
  soundBtn.addEventListener('click', () => audio.toggle());
  createTextFx(profile);
  const player = createPlayer({ channels, profile });

  let forcedRewind = 0; // segundos de rebobinado forzado (frase del M3, botón del cierre)
  let rewinding = false;
  const ctx = {
    profile,
    backend,
    channels,
    player,
    pulseRewind: (s) => { forcedRewind = Math.max(forcedRewind, s); audio.sfx('glitch'); },
    sfx: (kind, opts) => audio.sfx(kind, opts),
    audioRunning: () => audio.running,
    rewindToStart,
  };

  // El orden importa: los ScrollTrigger se calculan de arriba hacia abajo.
  const moments = [createM1(ctx), createM2(ctx), createM3(ctx), createM4(ctx), createM5(ctx), createM6(ctx)];
  const portal = moments[1];
  // Evento musical → visual en el mismo instante: el golpe del clímax abre el portal.
  audio.onCue((name) => {
    if (name !== 'drop') return;
    backend.impact?.();
    document.documentElement.classList.add('drop');
    setTimeout(() => document.documentElement.classList.remove('drop'), 600);
  });
  const noteTrigger = createNoteTrigger({ audio, backend, lens });
  const viz = createSoundViz(soundBtn.querySelector('.viz'), audio, profile);
  const activation = createActivation({
    profile,
    backend,
    sfx: (k, o) => audio.sfx(k, o),
    onLogo: () => moments[0].start?.(),
  });

  let sy = 0;
  let lastY = 0;
  let velocity = 0;
  let mouse = 0;
  let mouseTarget = 0;
  let rewind = 0;
  let running = false;
  let started = false;
  let last = performance.now();
  let activeId = '';
  let flooded = false;
  const chapter = document.querySelector('#hud .hud-chapter');
  const fps = createFpsWatch(backend);

  if (!profile.touch) {
    addEventListener('pointermove', (e) => { mouseTarget = (e.clientX / innerWidth) * 2 - 1; }, { passive: true });
  }
  addEventListener('resize', () => backend.resize());

  function frame(now) {
    if (!running) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); // el primer cuadro puede llegar con marca anterior
    last = now;
    fps.tick(dt);

    const y = scrollY;
    const instant = dt > 0 ? (y - lastY) / dt : 0;
    lastY = y;
    velocity = instant < velocity ? instant : velocity + (instant - velocity) * (1 - Math.exp(-dt / 0.08));
    sy += (y - sy) * (1 - Math.exp(-dt / 0.12));
    if (Math.abs(y - sy) < 0.5) sy = y;
    mouse += (mouseTarget - mouse) * (1 - Math.exp(-dt / 0.4));

    // Momento activo = el último cuyo tramo ya empezó.
    let active = moments[0];
    for (const m of moments) if (m.track.start <= sy + 0.5) active = m;
    if (active.id !== activeId) {
      // Cada cambio de momento: un golpe breve de glitch y un barrido sonoro (no en el arranque).
      if (activeId && !rewinding) { backend.glitch?.(0.45); audio.sfx(Math.abs(velocity) > 2500 ? 'glitch' : 'whoosh'); }
      activeId = active.id;
      chapter.textContent = `${active.id.slice(1).padStart(2, '0')} / 06`;
      document.documentElement.dataset.moment = activeId;
    }
    // El video de JUEGA YA empieza a cargar una pantalla antes.
    if (started) portal.prepare(); // el video del portal baja después de PRESS START

    for (const m of moments) {
      const { e, q } = m.track.read(sy);
      m.dom(e, q, { active: m === active, time: now / 1000 });
      if (m === active) backend.update(m.id, e, q, dt, mouse);
    }

    // Rebobinado: al subir rápido, o forzado. Sube de golpe y se apaga con curva tape-stop (expo out).
    forcedRewind = Math.max(0, forcedRewind - dt);
    const want = velocity < -1400 || forcedRewind > 0 || rewinding ? 1 : 0;
    rewind = want > rewind ? Math.min(1, rewind + dt * 8) : rewind * Math.exp(-dt / 0.18);
    if (rewind < 0.01) rewind = 0;
    backend.setRewind(rewind);

    hud.update({ rewind, scrollY: y, moment: activeId });
    lens.update(backend.xrayState);
    noteTrigger.update(backend.xrayState, performance.now());

    // Pantalla inundada de verde: la interfaz pasa a negro sobre verde.
    const fl = backend.flood > 0.5;
    if (fl !== flooded) { flooded = fl; document.documentElement.classList.toggle('flood', fl); }

    // Banda sonora: mezcla por momento (al compás) y modulación por scroll, radiografía y rebobinado.
    audio.setMoment(activeId);
    const level = audio.frame({ velocity, xray: backend.xrayState.amount || 0, rewind, hidden: document.hidden });
    backend.setLevel(profile.reducedMotion ? level * 0.3 : level);
    backend.setBeat?.(audio.beat);
    // Visualización del sonido: onda orgánica en el control de sonido
    viz.frame(fl);
    if (y > 20) activation.finish();
    activation.update(dt, { level, xray: backend.xrayState.amount || 0, q: moments[0].track.read(sy).q, active: activeId === 'm1' });

    backend.render(now / 1000);
  }

  // ◀◀ Rebobinar al inicio: la página vuelve arriba hacia atrás, con el rebobinado encima, y frena en tape-stop.
  function rewindToStart() {
    if (rewinding) return;
    if (profile.reducedMotion) { scrollTo(0, 0); return; }
    rewinding = true;
    const proxy = { y: scrollY };
    gsap.to(proxy, {
      y: 0,
      duration: 3.4,
      ease: 'expo.inOut',
      onUpdate: () => scrollTo(0, proxy.y),
      onComplete: () => { rewinding = false; },
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running && started) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  function start() {
    started = true;
    running = true;
    createCursor();
    ScrollTrigger.refresh();
    last = performance.now();
    requestAnimationFrame(frame);
    backend.powerOn();
    activation.start();
    // Dentro del gesto de PRESS START (el navegador lo exige). Los stems (1,6 MB) bajan desde aquí,
    // fuera del presupuesto del héroe; la música entra con fundido cuando llegan.
    audio.start();
  }

  // Solo con ?fps: medición de costo por cuadro y control del rebobinado para pruebas.
  if (new URLSearchParams(location.search).has('fps')) {
    gsap.ticker.lagSmoothing(0); // en pruebas con la pestaña en segundo plano, las animaciones no se congelan
    window.__flauxus = {
      bench: (n) => backend.bench?.(n),
      debug: () => ({ ...backend.debug?.(), rewinding, forcedRewind }),
      rewind: rewindToStart,
      act: () => activation,
      audio: () => ({ t: +audio.time.toFixed(2), state: audio.state, notes: audio.notesState, exploring: audio.exploring, enabled: audio.enabled, level: +audio.level.toFixed(3), beat: +audio.beat.toFixed(2), section: audio.section, drop: document.documentElement.classList.contains('drop') }),
      marks: () => Object.fromEntries(moments.map((m) => [m.id, [Math.round(m.track.start), Math.round(m.track.end)]])),
      notes: () => ({ ...noteTrigger.stats, names: noteTrigger.stats.names.slice(-12) }),
      holdRewind: (on) => { forcedRewind = on ? 1e9 : 0; },
    };
  }

  return { start };
}

// Si el FPS cae por debajo de 30 durante 5 s, pasa a preset "baja" (sin posproceso). Con ?fps muestra el contador.
function createFpsWatch(backend) {
  const params = new URLSearchParams(location.search);
  const forced = params.get('q');
  if (forced) backend.setQuality(forced);
  const label = params.has('fps') ? Object.assign(document.createElement('p'), { className: 'fps' }) : null;
  if (label) document.body.append(label);
  let frames = 0;
  let acc = 0;
  let low = 0;
  let degraded = false;
  return {
    tick(dt) {
      frames++;
      acc += dt;
      if (acc < 0.5) return;
      const fps = frames / acc;
      if (label) label.textContent = `${Math.round(fps)} fps`;
      // Pestaña oculta o panel fuera de foco: el navegador frena el rAF; eso no cuenta como caída real.
      low = fps < FPS_FLOOR && document.hasFocus() ? low + acc : 0;
      if (!degraded && !forced && low >= FPS_FALL_SECONDS) {
        degraded = true;
        backend.setQuality('baja');
      }
      frames = 0;
      acc = 0;
    },
  };
}
