// SECUENCIA DE ACTIVACIÓN — lo que pasa entre PRESS START y María Clara en pantalla (≈ 2,8 s).
// No es una aparición: el sistema FLAUXUS se enciende y la reconstruye.
//   0,0 s  la retícula de cruces se enciende por filas; un golpe grave.
//   0,25 s el registro de arranque escribe lo que el sistema monta (datos reales del proyecto).
//   0,35 s ella existe primero como código (caracteres F L A U X S); la cámara viene de lejos y de lado.
//   1,5 s  la línea de escaneo baja y el código se vuelve imagen; la luz arranca como un fluorescente.
//   2,1 s  el halo se cierra detrás de su cabeza; suena DO4 + DO5 (la octava de su corrección).
//   2,35 s el logotipo se reconstruye; 2,6 s SISTEMA EN LÍNEA y la telemetría queda viva.
// Cualquier scroll o tecla la adelanta al final. Con movimiento reducido, todo aparece ya encendido.
const T_END = 3.0;
const DO4 = 261.63;

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 4);
const span = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));

export function createActivation({ profile, backend, sfx, onLogo }) {
  const root = document.getElementById('sys');
  const log = root.querySelector('.sys-log');
  const tri = profile.model === 'mobile' ? '20.584' : '61.752';
  const W = profile.mobile ? 26 : 34;
  const dots = (label, value) => `${label} ${'.'.repeat(Math.max(2, W - label.length - value.length - 2))} ${value}`;
  const LINES = [
    { t: 0.25, text: 'FLAUXUS · SISTEMA DE IDENTIDAD', cls: 'head' },
    { t: 0.5, text: dots('> MONTANDO CINTA', 'OK') },
    { t: 0.75, text: dots('> AFINACIÓN LA4 = 440 HZ', 'OK') },
    { t: 1.0, text: '> ESCALA DO4 RE4 MI4 FA♯4 SOL♯4 LA♯4' },
    { t: 1.25, text: dots(`> MODELO ${tri} TRIÁNGULOS`, 'OK') },
    { t: 1.5, text: '> SUJETO MARÍA CLARA LOZADA OCAMPO' },
    { t: 2.25, text: dots('> ESCANEANDO CUERPO', '100 %') },
    { t: 2.45, text: dots('> EXHALANDO EXPERIENCIA', 'ACTIVO') },
    { t: 3.0, text: '■ SISTEMA EN LÍNEA', cls: 'ok' },
  ];

  let t = -1; // -1 = no iniciada
  let printed = 0;
  let logoDone = false;
  let chord = false;
  let scanSound = false;
  let pulse = 0;
  let liveAt = 0; // la telemetría se refresca a 10 Hz
  const mouse = { x: 0, y: 0 };

  function line(text, cls = '') {
    const p = document.createElement('p');
    p.className = `ln ${cls}`;
    p.textContent = text;
    log.append(p);
    while (log.children.length > (profile.mobile ? 6 : 10)) log.firstChild.remove();
    return p;
  }

  function stage(name) { root.dataset.stage = name; }

  function start() {
    root.hidden = false;
    t = profile.reducedMotion ? T_END : 0;
    stage('grid');
    sfx('boot');
    if (profile.reducedMotion) finish();
  }

  // Adelanta todo al estado final (scroll, tecla o movimiento reducido).
  function finish() {
    if (t < 0) return;
    t = T_END;
  }

  addEventListener('keydown', () => { if (t >= 0 && t < T_END) finish(); });
  addEventListener('wheel', () => { if (t >= 0 && t < T_END) finish(); }, { passive: true });
  addEventListener('touchmove', () => { if (t >= 0 && t < T_END) finish(); }, { passive: true });

  // Cursor: la retícula se enciende alrededor del puntero y la telemetría lo sigue.
  addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / innerWidth) * 2 - 1;
    mouse.y = -((e.clientY / innerHeight) * 2 - 1);
    root.style.setProperty('--mx', `${e.clientX}px`);
    root.style.setProperty('--my', `${e.clientY}px`);
  }, { passive: true });

  // Clic / toque sobre la escena: un pulso en DO4 — la imagen vuelve a ser código un instante.
  addEventListener('pointerdown', (e) => {
    if (t < T_END || root.dataset.stage !== 'live' || root.classList.contains('away')) return;
    if (e.target.closest('button, a, #player')) return;
    pulse = 1;
    backend.glitch?.(0.6);
    sfx('pulse', { freq: DO4, dur: 0.8 });
    line(dots('> PULSO DO4', '261,63 HZ'), 'pulse');
  });

  function update(dt, { level = 0, xray = 0, q = 0, active = true }) {
    root.classList.toggle('away', !active || q > 0.32);
    root.classList.toggle('compact', q < 0.24); // mientras el logotipo está en pantalla
    if (t < 0) return;
    const prev = t;
    if (t < T_END) t = Math.min(T_END, t + dt);

    // Registro
    while (printed < LINES.length && LINES[printed].t <= t) {
      const L = LINES[printed++];
      line(L.text, L.cls);
      if (!profile.reducedMotion && prev < T_END) sfx('tick');
    }
    // Contador de carga y barra (0,3 → 1,5 s)

    if (t >= 0.35 && root.dataset.stage === 'grid') stage('code');
    if (t >= 1.5 && !scanSound) { scanSound = true; if (prev < T_END - 0.01) sfx('whoosh'); stage('scan'); }
    if (t >= 2.1 && !chord) { chord = true; sfx('chord', { freq: DO4 }); }
    if (t >= 2.35 && !logoDone) { logoDone = true; onLogo?.(); }
    if (t >= T_END && root.dataset.stage !== 'live') stage('live');

    // Valores para el motor 3D
    const reduced = profile.reducedMotion;
    const dolly = reduced ? 0 : 1 - ease(span(t, 0.35, 2.6));
    const code = t < 0.35 ? 0 : 1;
    const codeLine = t < 1.5 ? 1 : 1 - span(t, 1.5, 2.3);
    // Luz: arranca como un fluorescente (encendidos y apagados en saltos) y se queda.
    let light = 0;
    if (t >= 2.0) light = 1;
    else if (t >= 1.5) light = [1, 0, 0.6, 0, 1, 0.2, 1][Math.floor(span(t, 1.5, 2.0) * 7)] ?? 1;
    if (reduced) light = 1;
    const halo = Math.round(span(t, 2.1, 2.5) * 5) / 5;
    pulse = Math.max(0, pulse - dt * 4);
    // Pantalla monumental: línea CRT → retícula por filas → marca → cifra (carga → Hz) → frase → en línea
    const wall = reduced ? { power: 1, grid: 1, logo: 1, num: 1, load: 1, tag: 1, live: true } : {
      power: span(t, 0.05, 0.4),
      grid: span(t, 0.25, 0.9),
      logo: span(t, 0.55, 1.3),
      num: t < 0.3 ? 0 : t < 2.2 ? 0.5 : 1,
      load: span(t, 0.3, 2.0),
      tag: span(t, 2.25, 2.95),
      live: t >= T_END,
    };
    if (t >= T_END && !liveAt) liveAt = performance.now();
    backend.setBoot?.({ dolly, code: t >= T_END ? 0 : code, codeLine: t >= T_END ? 0 : codeLine, light, halo, pulse, wall, liveAt });

    // Los datos vivos están en la pantalla 3D (scenes/wall.js); aquí solo el estado de la radiografía.
    root.classList.toggle('xr-on', xray > 0.05);
  }

  return { start, finish, update, get done() { return t >= T_END; }, get t() { return t; } };
}
