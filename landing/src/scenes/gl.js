import gsap from 'gsap';
import { createPipeline } from './postfx.js';
import { createHero } from './hero.js';
import { createXray } from './xray.js';
import { PORTAL } from './portal.js';
import { sampleKeys, span, smooth } from '../lib/math.js';

// Backend WebGL. Un solo renderer, un solo shader de posproceso.
// Plano secuencia continuo en una sola escena: M1 (primer plano extremo → giro a su espalda),
// M2 (pasa junto a su hombro y el portal se enciende frente a ella), M3 (toma alta del espacio),
// M4 (barrido por bandas que da paso al HTML editorial). M5 y M6 son HTML: el lienzo descansa.
const DEG = Math.PI / 180;
const SCENE_OF = { m1: 'hero', m2: 'hero', m3: 'hero', m4: 'hero', m5: null, m6: null };
const XRAY_MOMENTS = new Set(['m1', 'm2', 'm3']);
const PC = PORTAL.cy;

// M1: órbita [t, azimut°, distancia, altura cámara, altura de mira, desplazamiento lateral]
// Plano inicial americano: encuadre idéntico al diseño de referencia; luego gira hacia el portal.
const M1 = {
  desktop: [[0, 0, 1.98, 1.50, 1.44, 0], [0.3, 20, 2.9, 1.55, 1.5, -0.1], [0.65, 110, 3.3, 1.05, 1.2, 0], [1, 180, 3.4, 1.3, 1.7, 0]],
  mobile: [[0, 0, 3.2, 1.8, 1.3, 0], [0.3, 20, 3.5, 1.6, 1.35, 0], [0.65, 110, 4.4, 1.1, 1.15, 0], [1, 180, 4.6, 1.5, 1.7, 0]],
};
// M2 y M3: posiciones explícitas [t, px, py, pz, lx, ly, lz]
const M2 = {
  desktop: [[0, 0, 1.3, -3.4, 0, 1.7, 0], [0.5, 0.6, 1.25, -2.6, 0, 2.0, PORTAL.z], [1, 0.5, 1.45, -1.6, 0, PC - 0.05, PORTAL.z]],
  mobile: [[0, 0, 1.5, -4.6, 0, 1.7, 0], [0.5, 0.4, 1.9, -3.4, 0, 2.1, PORTAL.z], [1, 0.2, 2.2, -2.6, 0, PC + 0.05, PORTAL.z]],
};
const M3 = {
  desktop: (from) => [[0, ...from], [0.5, -4, 6.5, -5.5, 0, 0.4, 2], [1, -6, 7.5, -3, 0, 0.2, 2.5]],
  mobile: (from) => [[0, ...from], [0.5, -5, 8.5, -7, 0, 0.5, 2.2], [1, -7.5, 9.8, -4, 0, 0.3, 2.6]],
};

export async function createGlBackend({ canvas, glbBuffer, profile, channels }) {
  const pipeline = createPipeline(canvas, { quality: profile.quality, crt: profile.crt });
  const hero = await createHero({ glbBuffer, profile, channels });
  const xray = createXray(hero, { ...profile, renderer: pipeline.renderer });
  const kind = profile.mobile ? 'mobile' : 'desktop';
  const pc = PORTAL.cy;
  M2.desktop[2][5] = pc - 0.05;
  M2.mobile[2][5] = pc + 0.05;
  const m2End = M2[kind][M2[kind].length - 1].slice(1);
  const m3Keys = M3[kind](m2End);
  const KEY_BASE = hero.key.intensity;
  const AMB_BASE = hero.ambient.intensity;
  // Estado de la secuencia de activación (lo escribe ui/activation.js). Por defecto: sistema ya activo.
  const boot = { dolly: 0, code: 0, codeLine: 0, light: 1, halo: 1, pulse: 0, wall: { power: 1, grid: 1, logo: 1, num: 1, load: 1, tag: 1, live: true }, liveAt: 0 };
  const ptr = { x: -1, y: -1 };
  addEventListener('pointermove', (e) => { ptr.x = e.clientX; ptr.y = e.clientY; }, { passive: true });
  const u = pipeline.uniforms;

  let shown = 'hero';
  let wanted = 'hero';
  let switching = null;
  let level = 0;
  let portalState = { on: false, ready: false };
  let xrayState = { amount: 0 };
  let glitchT = 0;
  let floodState = 0;
  let beat = 0;
  let flash = 0;
  const HEAD = new hero.camera.position.constructor(0, 1.66, 0);
  const tmpV = new hero.camera.position.constructor();
  // Halo detrás de la cabeza, de frente a la cámara; aparece por pasos y se encoge al irse.
  function placeHalo(k) {
    hero.halo.visible = k > 0.01;
    if (!hero.halo.visible) return;
    tmpV.copy(HEAD).sub(hero.camera.position).normalize();
    hero.halo.position.copy(HEAD).addScaledVector(tmpV, 0.5);
    hero.halo.lookAt(hero.camera.position);
    hero.halo.scale.setScalar(Math.max(0.01, Math.round(k * 5) / 5) * (1 + beat * 0.07));
  }

  const look = new hero.camera.position.constructor();
  function place(p) {
    hero.camera.position.set(p[0], p[1], p[2]);
    look.set(p[3], p[4], p[5]);
    hero.camera.lookAt(look);
  }
  function orbit(az, dist, y, lookY, ox = 0) {
    hero.camera.position.set(Math.sin(az) * dist + ox, y, Math.cos(az) * dist);
    hero.camera.lookAt(ox, lookY, 0);
  }

  function aspect() {
    hero.camera.clearViewOffset();
    hero.setAspect(pipeline.aspect);
    // La lluvia de palabras se recompone con el encuadre: tamaño, calles y recorrido salen del plano inicial de M1.
    hero.wordsRain?.layout({ aspect: pipeline.aspect, fov: hero.camera.fov, key: M1[kind][0] });
  }
  aspect();

  function update(id, e, q, dt, mouse) {
    wanted = SCENE_OF[id];
    hero.reticle.visible = id === 'm1' && q < 0.4;
    if (hero.bgGlow) hero.bgGlow.visible = id === 'm1' && q < 0.4;
    if (hero.wordsRain) hero.wordsRain.group.visible = id === 'm1' && q < 0.4;
    hero.grid.mesh.visible = id !== 'm1';
    hero.figure.scale.setScalar(1);
    u.uScanEnabled.value = id === 'm1' ? 0 : 1;
    if (id === 'm1') u.uVignette.value = 0;
    else u.uVignette.value = profile.crt ? 0.35 : 0;
    let ign = 0;
    let wipe = 0;
    let code = 0;
    let codeLine = 1;
    let flood = 0;
    let halo = 0;

    hero.figure.rotation.y = 0;
    hero.reticle.position.x = 0;
    if (hero.bgGlow) hero.bgGlow.position.x = 0;
    if (hero.wordsRain) hero.wordsRain.group.position.x = 0;

    if (id === 'm1') {
      const [az, dist, y, ly, ox] = sampleKeys(M1[kind], q, 1);
      // Secuencia de activación (ui/activation.js): la cámara llega desde lejos y de lado, y se clava en el visor.
      const d = boot.dolly;
      // Movimiento suave y sutil sin saltos ni tirones al entrar/salir de la radiografía
      const pointerFollow = mouse * 0.02 * (1 - q);
      orbit((az + d * 40) * DEG + pointerFollow, dist * (1 + d * 1.6), y + d * 0.6, ly, ox);

      // Punto 1: Telemetría sonora viva en la retícula radar (rotación y pulso)
      hero.reticle.update?.(dt, performance.now() / 1000, beat);

      // Lluvia lenta de palabras (ESCUCHA, RECORRE, INTERVIENE): cede ante el texto del héroe mientras se lee
      // y se disuelve con el giro de cámara hacia el portal, para que el paso al Momento 2 no tenga corte.
      hero.wordsRain?.update(dt, performance.now() / 1000, beat, hero.camera, {
        fade: 1 - smooth(span(q, 0.1, 0.36)),
        textFade: 1 - smooth(span(q, 0.08, 0.32)),
      });

      // Punto 4: Parallax multicapa cinematográfico
      // Plano medio: María Clara se orienta apenas hacia el cursor
      hero.figure.rotation.y = mouse * 0.055 * (1 - q);
      // Fondo: la retícula polar, el resplandor y la lluvia de palabras reaccionan en profundidad inversa
      hero.reticle.position.x = -mouse * 0.065 * (1 - q);
      if (hero.bgGlow) hero.bgGlow.position.x = mouse * 0.095 * (1 - q);
      if (hero.wordsRain) hero.wordsRain.group.position.x = -mouse * 0.12 * (1 - q);

      hero.wall.setVisible(false);
      hero.setScan(-0.1);
      // María Clara existe primero como código; la línea de escaneo la convierte en imagen.
      code = boot.code;
      codeLine = boot.codeLine;
      halo = 0;
      // Pantalla: estado de la activación + cursor + pulso; la franja central del logo salta con el bombo.
      const now = performance.now();
      if (ptr.x >= 0) hero.wall.pointer(ptr.x, ptr.y, hero.camera);
      const jolt = boot.pulse > 0.5 && !profile.reducedMotion ? (Math.random() - 0.5) * 80 : 0; // la franja central salta con el pulso DO4
      hero.wall.set({ ...boot.wall, grid: 0, invert: boot.pulse > 0.5 ? 1 : 0, tape: boot.liveAt ? (now - boot.liveAt) / 1000 : 0, rowsDx: [0, jolt, 0] }, now);
    } else if (id === 'm2') {
      hero.wall.setVisible(false);
      const t = (e + q * 2) / 3;
      const p = sampleKeys(M2[kind], t);
      p[0] += mouse * 0.08; // el encuadre sigue apenas al mouse
      place(p);
      ign = span(t, 0.12, 0.62);
      hero.setScan(-0.1);
    } else if (id === 'm3') {
      place(sampleKeys(m3Keys, (e + q * 2) / 3));
      ign = 1;
      hero.setScan(-0.1);
      // Inundación verde en 4 pasos: el espacio se vuelve señal y ella, tinta negra.
      flood = Math.ceil(span(e, 0.55, 1) * 4) / 4;
    } else if (id === 'm4') {
      place(sampleKeys(m3Keys, 1));
      ign = 1;
      wipe = e; // barrido por bandas mientras entra la sección editorial
      flood = e < 1 ? 1 : 0; // el verde sale con el barrido
      if (q >= 1) wanted = null;
    }
    u.uWipe.value = profile.reducedMotion ? (wipe > 0.5 ? 1 : 0) : wipe;

    if (boot.pulse > 0) { code = Math.max(code, boot.pulse); codeLine = Math.max(codeLine, 1.01); }
    u.uCode.value = profile.reducedMotion ? 0 : code;
    u.uCodeLine.value = codeLine;
    u.uFlood.value = flood;
    // La interfaz vuelve a verde sobre negro cuando el barrido va por la mitad.
    floodState = id === 'm4' ? (e < 0.5 ? 1 : 0) : flood;
    placeHalo(id === 'm1' ? 0 : halo);
    hero.grid.update(hero.camera, ptr, dt, beat);

    portalState = hero.portal.update(ign, dt, Math.max(level, beat));
    // El portal es otra escena: ocultarlo durante el retrato inicial evita que su pantalla negra
    // aparezca como un rectángulo delante del ciclorama cuando la cámara aún está cerca.
    hero.portal.setVisible(id !== 'm1');
    // El clímax: la pantalla se abre en blanco un instante y decae en ~350 ms.
    flash = Math.max(0, flash - dt * 3);
    u.uFlash.value = profile.reducedMotion ? 0 : flash * flash;
    hero.portal.setLogo(id !== 'm1'); // el logo 3D solo cuando la cámara ya mira el portal

    xrayState = xray.update({
      enabled: XRAY_MOMENTS.has(id) && shown === 'hero' && !switching,
      dt, time: performance.now() / 1000, scale: pipeline.scale, level,
    });
    hero.key.intensity = KEY_BASE * (1 + level * 0.3) * (id === 'm1' ? boot.light : 1);
    hero.ambient.intensity = AMB_BASE * (id === 'm1' ? 0.25 + boot.light * 0.75 : 1);

    // Golpe de glitch (transiciones): decae en ~300 ms
    glitchT = Math.max(0, glitchT - dt * 3.2);
    u.uGlitch.value = profile.reducedMotion ? 0 : glitchT;

    if (wanted !== shown && !switching) cut();
  }

  // Entrada/salida del lienzo (antes y después de las secciones HTML): apagado/encendido CRT.
  function cut() {
    if (!pipeline.postfx || profile.reducedMotion) { shown = wanted; u.uPower.value = shown ? 1 : 0; return; }
    switching = gsap.timeline({ onComplete: () => { switching = null; } })
      .to(u.uPower, { value: 0, duration: 0.15, ease: 'none' })
      .add(() => { shown = wanted; })
      .to(u.uPower, { value: () => (shown ? 1 : 0), duration: 0.3, ease: 'none' });
  }

  let idle = false;
  function render(time) {
    if (!shown && !switching) {
      if (!idle) { pipeline.render(hero.scene, hero.camera, time); idle = true; }
      canvas.style.visibility = 'hidden';
      return;
    }
    idle = false;
    canvas.style.visibility = 'visible';
    pipeline.render(hero.scene, hero.camera, time);
  }

  return {
    mode: 'gl',
    update,
    render,
    resize() { pipeline.resize(); aspect(); },
    setRewind(v) { u.uRewind.value = profile.reducedMotion ? 0 : v; },
    glitch(v = 1) { glitchT = Math.max(glitchT, v); },
    powerOn() {
      gsap.fromTo(u.uPower, { value: 0 }, { value: 1, duration: profile.reducedMotion ? 0 : 0.7, delay: 0.15, ease: 'none' });
    },
    powerOff(onDone) { gsap.to(u.uPower, { value: 0, duration: 0.3, ease: 'none', onComplete: onDone }); },
    osdRect: () => hero.portal.screenRect(hero.camera),
    get crtState() { return portalState; },
    get xrayState() { return xrayState; },
    xrayNote: (v) => xray.note(v),
    // Zonas de texto del héroe (fracciones de pantalla) que la lluvia de palabras no debe cruzar encendida.
    setHeroAvoid(rects) { hero.wordsRain?.setAvoid(rects); },
    // Juego abierto/cerrado: la radiografía se apaga, suelta sus oyentes y vuelve limpia (scenes/xray.js).
    setXrayActive(on) { xray.setActive(on); xrayState = { amount: 0 }; },
    get flood() { return floodState; },
    setBoot(v) { Object.assign(boot, v); },
    setBeat(v) { beat = profile.reducedMotion ? 0 : v; },
    impact() { flash = 1; glitchT = Math.max(glitchT, 1); },
    // Telemetría real de la cámara para la interfaz.
    camInfo() {
      const p = hero.camera.position;
      return { az: ((Math.atan2(p.x, p.z) / DEG) + 360) % 360, dist: Math.hypot(p.x, p.z), alt: p.y };
    },
    setLevel(v) { level = v; u.uLevel.value = v; },
    kick: () => {},
    setQuality: (name) => pipeline.setQuality(name),
    debug: () => ({ shown, wanted, power: u.uPower.value, switching: !!switching, rain: hero.wordsRain?.debug(), xray: xrayState.amount || 0 }),
    bench(n = 60) {
      const gl = pipeline.renderer.getContext();
      const px = new Uint8Array(4);
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        update('m1', 1, i / n, 0, 0);
        pipeline.render(hero.scene, hero.camera, i / 60);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      }
      return +((performance.now() - t0) / n).toFixed(2);
    },
  };
}
