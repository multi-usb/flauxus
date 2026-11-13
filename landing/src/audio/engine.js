// BANDA SONORA — «Nocturnal Whispers» dirigida por el recorrido (Web Audio API, sin librerías).
//
// La composición se cortó en secciones (tools: ver CLAUDE.md § Audio). En lugar de sonar de corrido,
// el recorrido la "re-secuencia": cada momento pide una sección y el motor la encadena sin cortes.
//
//   0:00–0:16 intro-head  clásico, misterioso (una vez)        → M1 y la reprise del cierre
//   0:16–0:45 intro-loop  clásico (loop)                        → M1 si se queda, M4 (María Clara)
//   4:39–4:43 riser       los dos compases antes del clímax     → camino al portal
//   4:43–4:47 drop-hit    el golpe del clímax                   → PORTAL JUEGA YA (evento visual sincronizado)
//   4:47–5:16 drop        la parte más intensa (loop)           → portal
//   2:52–2:59 groove2     electrónica media (loop)              → M3, después del clímax
//   1:00–1:15 groove      el pulso principal (loop)             → M5 (las salas, interacción)
// La flauta de María Clara NUNCA suena junto a la composición (la capa de su Bourrée se retiró: saturaba la mezcla):
// su sonido aparece solo al explorar su cuerpo con la radiografía (ver NOTAS más abajo).
// Y sus NOTAS (radiografía): siete notas sostenidas cortadas de sus grabaciones (tools/notes.sh), de la pentatónica
// de FA (la tonalidad medida de la pieza), de grave a agudo según la altura del cuerpo que toca el cursor.
// EXPLORAR SU CUERPO = escuchar su memoria: mientras el cursor (o el dedo) está sobre ella, la composición se PAUSA
// (su contexto de audio se suspende: al salir sigue exactamente desde la misma muestra) y solo suenan sus notas, en
// un segundo contexto con reverberación y eco. Al salir, las notas se apagan (fundido breve) y la música vuelve.
const SECTIONS = {
  'intro-head': { next: 'intro-loop' },
  'intro-loop': { loop: true },
  riser: { next: 'drop-hit', cue: 'drop' }, // el final del riser = el golpe del clímax
  'drop-hit': { next: 'drop' },
  drop: { loop: true },
  groove2: { loop: true },
  groove: { loop: true },
};
const DROP_CHAIN = new Set(['riser', 'drop-hit', 'drop']);

// Qué sección pide cada momento.
const SCORE = {
  m1: { section: 'intro-head', again: 'intro-loop' },
  m2: { section: 'drop' },
  m3: { section: 'groove2' },
  m4: { section: 'intro-loop' },
  m5: { section: 'groove' },
  m6: { section: 'intro-head', again: 'intro-head' }, // reprise: el final vuelve al principio
};

// Notas de María Clara: posición en el sprite = índice × 2 s; cents = desvío medido (se corrige al reproducir).
export const NOTES = [
  { name: 'LA4', cents: -6, len: 1.3 },
  { name: 'DO5', cents: -13, len: 1.6 },
  { name: 'RE5', cents: 6, len: 0.95 },
  { name: 'FA5', cents: -3, len: 0.9 },
  { name: 'SOL5', cents: 19, len: 1.05 },
  { name: 'LA5', cents: 11, len: 1.5 },
  { name: 'DO6', cents: -1, len: 0.75 },
];
const TEMPO = 128.6;

const MASTER = 0.5; // volumen moderado por defecto
const FADE = 2.4; // fundido entre secciones (s)
const STORE_KEY = 'flauxus-sonido';

export function createAudio() {
  const probe = document.createElement('audio');
  const ext = probe.canPlayType?.('audio/ogg; codecs="vorbis"') ? 'ogg' : 'm4a';
  let ctx = null;
  let nodes = null;
  let nctx = null; // contexto de las notas de María Clara
  let nn = null;
  let exploring = false;
  let exploreTimer = 0;
  const raw = new Map(); // nombre → Promise<ArrayBuffer>
  const buffers = new Map(); // nombre → AudioBuffer
  let enabled = readPref();
  let started = false;
  let moment = '';
  let deck = null; // sección sonando: { name, srcs, gain, filter }
  const visited = new Set();
  const cueListeners = new Set();
  const listeners = new Set();
  const timeData = new Uint8Array(1024);
  const freqData = new Uint8Array(512);
  const wave = new Float32Array(48); // forma de onda suavizada para la visualización
  const kickData = new Float32Array(512);
  let level = 0;
  let beat = 0;
  let lowAvg = 0;
  let lastLow = 0;
  let lastHit = 0;
  const bands = [0, 0, 0, 0, 0];

  function readPref() { try { return localStorage.getItem(STORE_KEY) !== 'off'; } catch { return true; } }
  function writePref(on) { try { localStorage.setItem(STORE_KEY, on ? 'on' : 'off'); } catch { /* sin almacenamiento */ } }

  const urlOf = (name) => (name === 'notas' ? `/audio/stems/notas.${ext}` : `/audio/score/${name}.${ext}`);
  function fetchRaw(name) {
    if (!raw.has(name)) {
      raw.set(name, fetch(urlOf(name)).then((r) => { if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`); return r.arrayBuffer(); }));
    }
    return raw.get(name);
  }
  async function buffer(name) {
    if (buffers.has(name)) return buffers.get(name);
    const b = await ctx.decodeAudioData((await fetchRaw(name)).slice(0));
    buffers.set(name, b);
    return b;
  }

  async function unlock() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) ctx = new AC({ latencyHint: 'interactive' });
    if (!nctx) nctx = new AC({ latencyHint: 'interactive' }); // notas: su propio reloj, sigue sonando con la música en pausa
    if (ctx.state === 'suspended' && !exploring) await ctx.resume().catch(() => {});
    if (nctx.state === 'suspended') await nctx.resume().catch(() => {});
    if (!nodes) build();
    if (!nn) buildNotes();
    return true;
  }

  // Espacio de las notas: seco + reverberación larga (respuesta sintetizada) + eco ping-pong a la corchea con puntillo,
  // que también se aleja en la sala. Misterioso, profundo, sin saturar (las notas llegan a −20 LUFS).
  function buildNotes() {
    const c = nctx;
    const bus = c.createGain();
    bus.gain.value = 0.9;
    const out = c.createGain(); // fundido de salida (silencio / explorar)
    out.gain.value = 0;
    const dry = c.createGain();
    dry.gain.value = 0.42;
    const verb = c.createConvolver();
    verb.buffer = impulse(4.2, c);
    const verbGain = c.createGain();
    verbGain.gain.value = 0.7;
    const echoT = (0.75 * 60) / TEMPO; // ≈ 0,35 s
    const dL = c.createDelay(2);
    const dR = c.createDelay(2);
    dL.delayTime.value = echoT;
    dR.delayTime.value = echoT;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const dark = c.createBiquadFilter();
    dark.type = 'lowpass';
    dark.frequency.value = 2200;
    const pL = c.createStereoPanner();
    const pR = c.createStereoPanner();
    pL.pan.value = -0.75;
    pR.pan.value = 0.75;
    const echoGain = c.createGain();
    echoGain.gain.value = 0.26; // eco sutil
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.ratio.value = 8;
    const an = c.createAnalyser();
    an.fftSize = 1024;
    an.smoothingTimeConstant = 0.5;
    bus.connect(dry).connect(out);
    bus.connect(verb).connect(verbGain).connect(out);
    bus.connect(dL);
    dL.connect(dark).connect(dR);
    dR.connect(fb).connect(dL);
    dL.connect(pL).connect(echoGain);
    dR.connect(pR).connect(echoGain);
    echoGain.connect(out);
    echoGain.connect(verb);
    out.connect(limiter).connect(an).connect(c.destination);
    nn = { bus, out, fb, analyser: an };
  }

  function build() {
    const master = ctx.createGain();
    master.gain.value = 0;
    const music = ctx.createGain(); // secciones de la composición
    // "Escuchar por dentro": paso bajo general que cierra con la radiografía y el rebobinado.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 20000;
    lowpass.Q.value = 0.7;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 4;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.5;
    music.connect(lowpass);
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.7;
    lowpass.connect(master);
    sfxBus.connect(master);
    master.connect(limiter).connect(analyser).connect(ctx.destination);
    // Detector de bombo: solo graves (< 120 Hz), sin suavizado.
    const kickLp = ctx.createBiquadFilter();
    kickLp.type = 'lowpass';
    kickLp.frequency.value = 120;
    const kick = ctx.createAnalyser();
    kick.fftSize = 512;
    kick.smoothingTimeConstant = 0;
    limiter.connect(kickLp).connect(kick);

    // Aire del scroll: ruido filtrado continuo cuyo volumen sigue a la velocidad (muy tenue).
    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer(2);
    air.loop = true;
    const airBand = ctx.createBiquadFilter();
    airBand.type = 'bandpass';
    airBand.frequency.value = 1400;
    airBand.Q.value = 0.8;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    air.connect(airBand).connect(airGain).connect(sfxBus);
    air.start();
    nodes = { master, music, lowpass, analyser, kick, sfxBus, airGain, airBand };
  }

  // ---------- Secciones ----------
  // Arranca una sección (y su cadena de "next") en el instante `at`, en su propio canal con filtro.
  async function play(name, at, fadeIn = 0) {
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    filter.connect(gain).connect(nodes.music);
    const d = { name, srcs: [], gain, filter, chain: [] };
    let t = Math.max(at, ctx.currentTime + 0.02);
    gain.gain.setValueAtTime(fadeIn ? 0.0001 : 1, t);
    if (fadeIn) gain.gain.exponentialRampToValueAtTime(1, t + fadeIn);
    let cur = name;
    // Cadena sample-accurate: cada segmento empieza exactamente cuando termina el anterior.
    for (let guard = 0; guard < 4 && cur; guard++) {
      const b = await buffer(cur);
      const src = ctx.createBufferSource();
      src.buffer = b;
      const def = SECTIONS[cur];
      src.loop = !!def.loop;
      src.connect(filter);
      src.start(t);
      d.srcs.push(src);
      d.chain.push({ name: cur, at: t });
      if (def.cue) fireCue(def.cue, t + b.duration);
      if (def.loop || !def.next) break;
      t += b.duration;
      cur = def.next;
    }
    return d;
  }

  // Pasa a una sección: el canal actual se aleja (paso bajo que se cierra + fundido) mientras entra el nuevo.
  let switching = Promise.resolve();
  function goTo(name, { fade = FADE } = {}) {
    switching = switching.then(async () => {
      if (!nodes) return;
      // Hacia el clímax: si ya estamos en la cadena del drop, no se interrumpe.
      if (name === 'drop') {
        if (deck && DROP_CHAIN.has(deck.name)) return;
        name = 'riser';
        fade = 0.5;
      }
      if (deck && deck.name === name && SECTIONS[name].loop) return;
      const now = ctx.currentTime;
      const old = deck;
      deck = await play(name, now + 0.03, old ? Math.min(fade, 1.2) : 0);
      if (old) {
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value || 1, now);
        old.gain.gain.linearRampToValueAtTime(0.0001, now + fade);
        old.filter.frequency.setValueAtTime(20000, now);
        old.filter.frequency.exponentialRampToValueAtTime(500, now + fade);
        old.srcs.forEach((s) => { try { s.stop(now + fade + 0.05); } catch { /* ya detenida */ } });
      }
    }).catch((err) => console.warn('[audio]', err));
    return switching;
  }

  // Eventos musicales con fecha del reloj de audio → callbacks visuales en el mismo instante.
  function fireCue(name, at) {
    const ms = Math.max(0, (at - ctx.currentTime) * 1000);
    setTimeout(() => cueListeners.forEach((fn) => fn(name)), ms);
  }

  function applyMoment(id) {
    const s = SCORE[id];
    if (!s || !started) return;
    const name = visited.has(id) && s.again ? s.again : s.section;
    visited.add(id);
    goTo(name);
  }

  // ---------- Efectos de interfaz (cada uno marca un evento concreto) ----------
  let noiseCache = null;
  // Respuesta de sala sintetizada: ruido estéreo con caída exponencial, oscurecido con el tiempo.
  function impulse(seconds, c = ctx) {
    const n = Math.round(c.sampleRate * seconds);
    const b = c.createBuffer(2, n, c.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        const k = 0.15 + t * 0.8; // cada vez más oscuro
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.02 ? 0 : 1);
      }
    }
    return b;
  }

  // ---------- Notas de María Clara ----------
  // Respuesta inmediata (la música está en pausa: no hay compás que esperar). UNA voz: cada nota nueva apaga la anterior
  // en ~0,12 s, así nunca se superponen; lo que queda en el aire es solo su eco y su sala.
  const voices = [];
  let notesBuf = null;
  async function notesBuffer() {
    if (notesBuf) return notesBuf;
    notesBuf = await nctx.decodeAudioData((await fetchRaw('notas')).slice(0));
    return notesBuf;
  }
  async function note(i, { gain = 1, pan = 0 } = {}) {
    if (!nctx || !nn || !started || !enabled || nctx.state !== 'running') return false;
    const n = NOTES[i];
    if (!n) return false;
    const b = await notesBuffer().catch(() => null);
    if (!b) return false;
    const c = nctx;
    const t = c.currentTime + 0.005;
    const src = c.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = 2 ** (-n.cents / 1200);
    const g = c.createGain();
    const p = c.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.setTargetAtTime(0.0001, t + n.len, 0.16);
    src.connect(g).connect(p).connect(nn.bus);
    src.start(t, i * 2, n.len + 0.8);
    for (const old of voices) {
      old.g.gain.cancelScheduledValues(t);
      old.g.gain.setTargetAtTime(0.0001, t, 0.04);
      try { old.src.stop(t + 0.25); } catch { /* ya detenida */ }
    }
    const v = { src, g };
    voices.push(v);
    src.onended = () => { const k = voices.indexOf(v); if (k >= 0) voices.splice(k, 1); };
    while (voices.length > 1) voices.shift();
    return { delay: 0, name: n.name };
  }

  // Entrar / salir del cuerpo. Sin clics: cada paso es un fundido sobre ganancias, nunca un corte.
  function explore(on) {
    if (on === exploring) return;
    // Sin audio listo (antes de PRESS START) no hay nada que pausar: no se marca el estado, así no bloquea
    // la reanudación de la música cuando el audio arranque.
    if (!ctx || !nodes || !nn || !started) { exploring = false; return; }
    exploring = on;
    clearTimeout(exploreTimer);
    const t = ctx.currentTime;
    const nt = nctx.currentTime;
    const mg = nodes.master.gain;
    const og = nn.out.gain;
    if (on) {
      // la composición se aleja en 180 ms y se detiene en su punto exacto
      mg.cancelScheduledValues(t);
      mg.setValueAtTime(mg.value, t);
      mg.linearRampToValueAtTime(0, t + 0.18);
      exploreTimer = setTimeout(() => { if (exploring) ctx.suspend().catch(() => {}); }, 220);
      nn.fb.gain.cancelScheduledValues(nt);
      nn.fb.gain.setValueAtTime(0.38, nt);
      og.cancelScheduledValues(nt);
      og.setValueAtTime(og.value, nt);
      og.linearRampToValueAtTime(enabled ? MASTER * 1.6 : 0, nt + 0.06);
    } else {
      // las notas (con su eco y su sala) se apagan en ~0,4 s; el eco se vacía para no reaparecer en la próxima entrada
      og.cancelScheduledValues(nt);
      og.setValueAtTime(og.value, nt);
      og.linearRampToValueAtTime(0, nt + 0.4);
      nn.fb.gain.setValueAtTime(0, nt + 0.4);
      for (const v of voices) { try { v.src.stop(nt + 0.45); } catch { /* ya detenida */ } }
      // la música sigue donde quedó, con un fundido de entrada
      if (enabled) {
        ctx.resume().then(() => {
          if (exploring) return;
          const r = ctx.currentTime;
          mg.cancelScheduledValues(r);
          mg.setValueAtTime(0, r);
          mg.linearRampToValueAtTime(MASTER * 0.35, r + 0.5);
          mg.linearRampToValueAtTime(MASTER, r + 1.6); // recupera su volumen de forma progresiva
        }).catch(() => {});
      }
    }
  }

  function noiseBuffer(seconds = 1) {
    if (noiseCache && noiseCache.duration >= seconds) return noiseCache;
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache = b;
    return b;
  }

  function sfx(kind, { freq = 440, dur = 0.5, quiet = false } = {}) {
    if (!ctx || !nodes || !enabled || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.connect(nodes.sfxBus);
    const env = (peak, attack, release) => {
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(peak, t + attack);
      out.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    };
    const noise = (len) => { const n = ctx.createBufferSource(); n.buffer = noiseBuffer(2); n.start(t, Math.random(), len); return n; };
    if (kind === 'pulse') {
      // La frecuencia exacta de la nota (fundamental + una octava suave): suena la sala, no un bip.
      const o1 = ctx.createOscillator(); o1.frequency.value = freq;
      const o2 = ctx.createOscillator(); o2.frequency.value = freq * 2;
      const g2 = ctx.createGain(); g2.gain.value = 0.18;
      o1.connect(out); o2.connect(g2).connect(out);
      env(quiet ? 0.05 : 0.1, 0.012, dur);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    } else if (kind === 'whoosh') {
      // Desplazamiento espacial: ruido por un pasabanda que sube.
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
      bp.frequency.setValueAtTime(320, t); bp.frequency.exponentialRampToValueAtTime(3600, t + 0.55);
      noise(0.75).connect(bp).connect(out);
      env(0.14, 0.22, 0.5);
    } else if (kind === 'glitch') {
      // Interferencia digital: ruido agudo + chasquido de onda cuadrada.
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
      const sq = ctx.createOscillator(); sq.type = 'square'; sq.frequency.setValueAtTime(1800, t); sq.frequency.setValueAtTime(240, t + 0.05);
      const sg = ctx.createGain(); sg.gain.value = 0.25;
      noise(0.16).connect(hp).connect(out); sq.connect(sg).connect(out);
      env(0.09, 0.005, 0.14);
      sq.start(t); sq.stop(t + 0.16);
    } else if (kind === 'tick') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
      noise(0.03).connect(hp).connect(out);
      env(0.05, 0.002, 0.025);
    } else if (kind === 'boot') {
      // Encendido del sistema: golpe grave y un barrido que se abre.
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130.81, t); o.frequency.exponentialRampToValueAtTime(65.41, t + 0.35);
      const og = ctx.createGain(); og.gain.value = 0.9;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
      o.connect(og).connect(out); noise(0.7).connect(lp).connect(out);
      env(0.26, 0.01, 0.75);
      o.start(t); o.stop(t + 0.9);
    } else if (kind === 'chord') {
      // Activación: DO4 y DO5 juntas — la octava que "termina al doble de frecuencia".
      for (const [m, g] of [[1, 0.1], [2, 0.07]]) {
        const o = ctx.createOscillator(); o.frequency.value = freq * m;
        const gg = ctx.createGain(); gg.gain.value = g;
        o.connect(gg).connect(out); o.start(t); o.stop(t + 2.2);
      }
      env(1, 0.03, 2);
    } else if (kind === 'enter') {
      // Entrar al portal: subgrave que cae + ruido que se cierra (succión).
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(36, t + 0.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(8000, t); lp.frequency.exponentialRampToValueAtTime(200, t + 0.5);
      o.connect(out); noise(0.6).connect(lp).connect(out);
      env(0.3, 0.02, 0.55);
      o.start(t); o.stop(t + 0.7);
    }
  }

  async function setEnabled(on, { fromGesture = false } = {}) {
    enabled = on;
    writePref(on);
    listeners.forEach((fn) => fn(on));
    if (on) {
      if (fromGesture) await unlock();
      if (!ctx) return;
      if (!started) { await ctx.resume().catch(() => {}); await begin(); }
      if (exploring) {
        if (nn) { nn.out.gain.cancelScheduledValues(nctx.currentTime); nn.out.gain.linearRampToValueAtTime(MASTER * 1.6, nctx.currentTime + 0.3); }
        return;
      }
      await ctx.resume().catch(() => {});
      const g = nodes.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(MASTER, ctx.currentTime + 1.2);
    } else if (ctx && nodes) {
      const g = nodes.master.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
      if (nn) { nn.out.gain.cancelScheduledValues(nctx.currentTime); nn.out.gain.setValueAtTime(nn.out.gain.value, nctx.currentTime); nn.out.gain.linearRampToValueAtTime(0, nctx.currentTime + 0.3); }
    }
  }

  // Apertura: la composición entra con SISTEMA EN LÍNEA (2,6 s), con fundido.
  async function begin() {
    started = true;
    ['intro-head', 'intro-loop'].forEach(fetchRaw);
    setTimeout(() => ['riser', 'drop-hit', 'drop', 'groove2', 'groove'].forEach(fetchRaw), 1500);
    setTimeout(() => notesBuffer().catch(() => {}), 3000);
    const id = moment || 'm1';
    const s = SCORE[id];
    visited.add(id);
    deck = await play(s.section, ctx.currentTime + 2.6, 1.6).catch((e) => { console.warn('[audio]', e); return null; });
  }

  // Pestaña oculta = la cinta se detiene (el bucle de animación no corre en segundo plano, así que no se puede
  // depender de frame()); al volver, sigue donde estaba si el sonido está activo.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend().catch(() => {}); nctx?.suspend().catch(() => {}); return; }
    nctx?.resume().catch(() => {});
    if (enabled && started && !exploring) ctx.resume().catch(() => {});
  });

  return {
    get enabled() { return enabled; },
    get level() { return level; },
    get beat() { return beat; },
    get bands() { return bands; },
    get wave() { return wave; },
    get state() { return ctx ? ctx.state : 'none'; },
    get time() { return ctx ? ctx.currentTime : 0; },
    get section() { return deck ? deck.chain.reduce((n, c) => (c.at <= ctx.currentTime ? c.name : n), deck.chain[0].name) : null; },
    get running() { return !!(ctx && started && enabled && ctx.state === 'running'); },
    onChange(fn) { listeners.add(fn); },
    onCue(fn) { cueListeners.add(fn); },
    sfx,
    note,
    explore,
    get exploring() { return exploring; },
    get notesState() { return nctx ? nctx.state : 'none'; },
    // PRESS START: desbloquea el audio en el mismo gesto y arranca si la preferencia es "con sonido".
    async start() {
      await unlock();
      if (enabled) await setEnabled(true);
    },
    toggle() { return setEnabled(!enabled, { fromGesture: true }); },
    setMoment(id) {
      if (id === moment) return;
      const first = !moment;
      moment = id;
      if (!first) applyMoment(id);
    },
    // Modulación por cuadro: scroll, radiografía y rebobinado; lectura del nivel y del pulso.
    frame({ velocity = 0, xray = 0, rewind = 0, hidden = false }) {
      if (!nodes || !started) { level = 0; beat = 0; return 0; }
      if (hidden && ctx.state === 'running') ctx.suspend();
      else if (!hidden && enabled && !exploring && ctx.state === 'suspended') ctx.resume();
      const t = ctx.currentTime;
      const speed = Math.min(1, Math.abs(velocity) / 2500);
      const cutoff = 20000 * Math.pow(600 / 20000, Math.max(xray * 0.8, rewind * 0.8));
      nodes.lowpass.frequency.setTargetAtTime(cutoff, t, 0.08);
      nodes.airGain.gain.setTargetAtTime(speed * 0.04, t, 0.1);
      nodes.airBand.frequency.setTargetAtTime(900 + speed * 2600, t, 0.1);
      // Rebobinado = la cinta frena (solo en secciones en loop, para no descuadrar las cadenas).
      if (deck && SECTIONS[deck.name].loop) {
        for (const s of deck.srcs) s.playbackRate.setTargetAtTime(1 - rewind * 0.45, t, 0.05);
      }

      // Mientras se explora, la visualización escucha las notas (la música está en pausa)
      (exploring && nn ? nn.analyser : nodes.analyser).getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) { const v = (timeData[i] - 128) / 128; sum += v * v; }
      const target = Math.min(1, Math.sqrt(sum / timeData.length) * 2);
      level += (target - level) * (target > level ? 0.5 : 0.08);
      // 48 muestras promediadas de la forma de onda real (suavizadas en el tiempo: se mueve como un fluido)
      const step = timeData.length / wave.length;
      for (let k = 0; k < wave.length; k++) {
        let a = 0;
        for (let i = 0; i < step; i++) a += timeData[(k * step + i) | 0] - 128;
        wave[k] += (a / step / 128 - wave[k]) * 0.35;
      }

      // Pulso: la energía de graves sube de golpe por encima de su promedio = bombo.
      nodes.kick.getFloatTimeDomainData(kickData);
      let ks = 0;
      for (let i = 0; i < kickData.length; i++) ks += kickData[i] * kickData[i];
      const low = Math.sqrt(ks / kickData.length);
      const hit = low > lowAvg * 1.3 && low > 0.04 && low > lastLow && t - lastHit > 0.28;
      if (hit) lastHit = t;
      lowAvg += (low - lowAvg) * 0.04;
      lastLow = low;
      beat = hit ? 1 : beat * 0.86;
      nodes.analyser.getByteFrequencyData(freqData);
      // Cinco bandas para el control de sonido
      const edges = [1, 4, 12, 40, 110, 260];
      for (let k = 0; k < 5; k++) {
        let s = 0;
        for (let i = edges[k]; i < edges[k + 1]; i++) s += freqData[i];
        bands[k] = s / ((edges[k + 1] - edges[k]) * 255);
      }
      return level;
    },
  };
}
