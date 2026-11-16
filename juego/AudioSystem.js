/* ======================================================================
   FLAUXUS — AudioSystem.js
   Gestión de AudioContext, buffers, análisis espectral, síntesis y clips
   ====================================================================== */
import { clamp, damp, lerp, rand, INKH, $ } from './core/util.js';
import { T } from './core/time.js';
import { VO } from './core/voiceState.js';
import { toast } from './ui/toast.js';

export const A = {
  ctx: null, master: null, an: null, anBuf: null, pan: null, bus: null, verb: null,
  muted: false, nodes: [], keep: [], noiseBuf: null, voices: new Set(),
  clip: { srcs: [], timers: [], el: null }, pre: null, lvl: 0, fake: 0, flute: null
};

export const trackFiles = new Map([
  [1, 'CPEBMov1.wav'],
  [2, 'Bourré JSBach discontinuo.wav'],
  [3, 'Sarabanda ornamentada.wav'],
  [4, 'Stockhausen.wav'],
  [6, 'CPE Bach Intervención.wav']
]);

/* Las grabaciones se publican comprimidas en audio/ (los .wav de la raíz quedan como másters, fuera de la build):
   Ogg Vorbis donde se puede (Chrome, Firefox, Edge) y AAC .m4a en Safari/iOS. Misma duración que el máster. */
const AUDIO_EXT = (() => {
  try { return new Audio().canPlayType('audio/ogg; codecs="vorbis"') ? '.ogg' : '.m4a'; } catch { return '.m4a'; }
})();
export const recUrl = id => new URL('audio/' + trackFiles.get(id).replace(/\.wav$/i, AUDIO_EXT), document.baseURI).href;
export const Rec = { buf: new Map(), el: new Map(), rev: new Map(), fb: new Set(), bad: new Set(), loading: new Map() };

export function ensureAudio() {
  if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return A.ctx; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return null;
  const x = A.ctx = new C();
  const comp = x.createDynamicsCompressor();
  A.master = x.createGain();
  A.master.gain.value = A.muted ? 0 : .75;
  A.master.connect(comp);
  comp.connect(x.destination);
  A.an = x.createAnalyser();
  A.an.fftSize = 512;
  comp.connect(A.an);
  A.anBuf = new Uint8Array(A.an.fftSize);
  return x;
}

export function audioLevel() {
  let l = 0;
  if (A.an) {
    A.an.getByteTimeDomainData(A.anBuf);
    let s = 0;
    for (let i = 0; i < A.anBuf.length; i++) {
      const d = (A.anBuf[i] - 128) / 128;
      s += d * d;
    }
    l = clamp(Math.sqrt(s / A.anBuf.length) * 3.6, 0, 1);
  }
  if (A.fake > 0) l = Math.max(l, .25 + .25 * Math.abs(Math.sin(T * 3.1) * Math.sin(T * 1.3)));
  A.lvl = lerp(A.lvl, l, .3);
}

export function impulse(x, dur, decay) {
  const n = Math.floor(x.sampleRate * dur), b = x.createBuffer(2, n, x.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  return b;
}

export function newBus() {
  killBus();
  const x = ensureAudio();
  if (!x) return;
  A.bus = x.createGain();
  if (x.createStereoPanner) {
    A.pan = x.createStereoPanner();
    A.bus.connect(A.pan);
    A.pan.connect(A.master);
  } else {
    A.bus.connect(A.master);
  }
  A.verb = x.createConvolver();
  A.verb.buffer = impulse(x, 2.6, 2.4);
  const vg = x.createGain();
  vg.gain.value = .9;
  A.verb.connect(vg);
  vg.connect(A.bus);
}

export function killBus() {
  /* La música del preludio y la flauta del atrio viven fuera del bus: se
     retiran acá para que el Momento arranque su propia música desde el
     principio. */
  stopPreludeMusic(.18);
  stopAtriumFlute();
  for (const n of A.nodes) { try { n.stop?.(); } catch { } }
  A.nodes = [];
  for (const v of [...A.voices]) v.stop(true);
  A.voices.clear();
  stopClips();
  A.clip.el = null;
  A.fake = 0;
  try { A.bus?.disconnect(); } catch { }
  try { A.pan?.disconnect(); } catch { }
  A.bus = null;
  A.pan = null;
  A.verb = null;
}

export function setMuted(m) {
  A.muted = m;
  if (A.master) A.master.gain.setTargetAtTime(m ? 0 : .75, A.ctx.currentTime, .05);
  for (const v of A.voices) if (v.el) v.el.muted = m;
  if (A.clip.el) A.clip.el.muted = m;
  if (A.pre?.el) A.pre.el.muted = m;
  if (FLUTE.el) FLUTE.el.muted = m;
  if (VO?.el) VO.el.muted = m;
  $('btnSound')?.classList.toggle('off', m);
  toast(m ? 'Sonido desactivado' : 'Sonido activado');
}

export function noise() {
  const x = A.ctx;
  if (!A.noiseBuf) {
    A.noiseBuf = x.createBuffer(1, x.sampleRate * 2, x.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return A.noiseBuf;
}

export function tone(f, dur = .18, type = 'sine', g = .07, when = 0, out) {
  const x = ensureAudio();
  if (!x) return;
  const o = x.createOscillator(), e = x.createGain(), t = x.currentTime + when;
  o.type = type;
  o.frequency.value = f;
  e.gain.setValueAtTime(.0001, t);
  e.gain.exponentialRampToValueAtTime(Math.max(g, .0002), t + .012);
  e.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(e).connect(out || A.bus || A.master);
  o.start(t);
  o.stop(t + dur + .05);
}

export function hiss(dur = .3, g = .04, freq = 3000, when = 0, out) {
  const x = ensureAudio();
  if (!x) return;
  const s = x.createBufferSource();
  s.buffer = noise();
  const bp = x.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = .8;
  const e = x.createGain(), t = x.currentTime + when;
  e.gain.setValueAtTime(.0001, t);
  e.gain.linearRampToValueAtTime(g, t + Math.min(.05, dur / 2));
  e.gain.linearRampToValueAtTime(.0001, t + dur);
  s.connect(bp).connect(e).connect(out || A.bus || A.master);
  s.start(t);
  s.stop(t + dur + .05);
}

export function pluck(f, when = 0, dur = .5, g = .09, out) {
  tone(f, dur, 'triangle', g, when, out);
  tone(f * 2, dur * .6, 'sine', g * .35, when, out);
}

export function pad(freqs, g = .03, type = 'sine', store) {
  const x = ensureAudio();
  const out = x.createGain();
  out.gain.value = 0;
  out.connect(A.bus || A.master);
  const lp = x.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  lp.connect(out);
  for (const f of freqs) {
    const o = x.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = rand(-7, 7);
    o.connect(lp);
    o.start();
    (store || A.nodes).push(o);
  }
  return {
    set(v, tc = .5) { out.gain.setTargetAtTime(g * v, x.currentTime, tc); }
  };
}

/* ---- flauta del atrio ----
   El atrio ya no lleva un colchón sintético: su único fondo es María Clara
   tocando mientras camina. La toma sale de su propia grabación (CPEBMov1,
   23.30–35.20 s) y se reproduce en bucle con un fundido corto: aparece al
   andar, se retira al detenerse y nunca suena dentro de las salas. */
const FLUTE = { el: null, vol: 0, idle: 0, on: false };
const FLUTE_VOL = .72;
export function atriumFlute(sp = 0, dt = .016) {
  const on = sp > .45, k = on ? 3.2 : 4.5, step = clamp(dt || .016, .001, .1);
  FLUTE.on = on; FLUTE.vol = damp(FLUTE.vol, on ? FLUTE_VOL : 0, k, step);
  if (!FLUTE.el) {
    if (!on) return;
    const el = A.flute = FLUTE.el = new Audio(new URL('audio/atrio-flauta' + AUDIO_EXT, document.baseURI).href);
    el.loop = true; el.preload = 'auto'; el.volume = 0; el.muted = A.muted;
  }
  const el = FLUTE.el;
  el.muted = A.muted;
  if (on) {
    FLUTE.idle = 0;
    if (el.paused) {
      try { el.currentTime = 0 } catch { }
      el.play().catch(() => { });
    }
  } else {
    FLUTE.idle += step;
    if (FLUTE.idle > 1.2) { try { el.pause() } catch { } try { el.currentTime = 0 } catch { } }
  }
  el.volume = clamp(FLUTE.vol, 0, 1);
}
export function stopAtriumFlute() {
  const el = FLUTE.el; if (!el) return;
  try { el.pause() } catch { }
  try { el.currentTime = 0 } catch { }
  el.volume = 0; FLUTE.vol = 0; FLUTE.idle = 0; FLUTE.on = false;
}

/* ---- música del preludio ----
   La música de la sala suena por debajo de la locución mientras se camina.
   Va por una rama propia conectada al master, no al bus del minijuego: así
   `killBus()` puede retirarla y el Momento arranca su música desde 0
   (Voice y playClip siempre empiezan en el offset inicial). */
const PRE_LEVEL = .16;
const PRE_TRACK = new Set([1, 3, 4, 6]);
const PRE_CHORDS = {
  1: [130.81, 196, 261.63],
  3: [146.83, 220, 293.66],
  4: [55, 82.41, 110],
  6: [110, 165, 220]
};

/* ---- SOL: preludio propio ----
   Todavía no hay grabación de la sala, así que su preludio es una pieza
   sintética pensada para no competir con la voz: un acorde de La menor
   con novena, cálido y lento, sin seno grave ni diente de sierra. El
   filtro se abre y se cierra muy despacio y dos brillos altos, casi
   inaudibles, le dan el aire de los pads de Blade Runner. */
function solPrelude(x, pre, g) {
  const hp = x.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 95; hp.Q.value = .4;
  const lp = x.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = .35;
  const body = x.createGain(); body.gain.value = 1;
  hp.connect(lp); lp.connect(body); body.connect(g);
  const notes = [110, 164.81, 220, 261.63, 329.63]; // La2 · Mi3 · La3 · Do4 · Mi4
  notes.forEach((f, i) => {
    for (const [type, det, lvl] of [['triangle', -4, .07], ['sine', 4, .045]]) {
      const o = x.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = det + rand(-2, 2);
      const ng = x.createGain(); ng.gain.value = lvl * (i === 0 ? .75 : 1);
      o.connect(ng).connect(hp); o.start(); pre.nodes.push(o);
    }
  });
  /* Apertura y cierre del filtro: 22 s por ciclo, sin llegar nunca a un
     barrido brillante que se parezca a un zumbido. */
  const fl = x.createOscillator(); fl.frequency.value = .045;
  const fg = x.createGain(); fg.gain.value = 420;
  fl.connect(fg).connect(lp.frequency); fl.start(); pre.nodes.push(fl);
  /* Respiración del acorde sobre un gain aparte: el fundido de salida
     sigue pudiendo llegar a cero. */
  const al = x.createOscillator(); al.frequency.value = .07;
  const ag = x.createGain(); ag.gain.value = .035;
  al.connect(ag).connect(body.gain); al.start(); pre.nodes.push(al);
  for (const [f, v] of [[880, .007], [1318.51, .0045]]) {
    const o = x.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.detune.value = rand(-5, 5);
    const og = x.createGain(); og.gain.value = v; o.connect(og).connect(body); o.start(); pre.nodes.push(o);
    const sl = x.createOscillator(); sl.frequency.value = .05 + rand(0, .03);
    const sg = x.createGain(); sg.gain.value = v * .8;
    sl.connect(sg).connect(og.gain); sl.start(); pre.nodes.push(sl);
  }
}

export function startPreludeMusic(id) {
  stopPreludeMusic(0);
  /* RE aún no tiene su pieza: su preludio es silencio, solo la voz de
     María Clara. Cuando exista la música que identifica la sala, entra
     acá y deja de ser un caso vacío. */
  if (id === 2) return null;
  const x = ensureAudio();
  /* Sin Web Audio queda el <audio> para las salas con grabación real. */
  if (!x) {
    if (PRE_TRACK.has(id) && trackFiles.has(id)) {
      const el = new Audio(recUrl(id));
      el.loop = true; el.volume = PRE_LEVEL; el.muted = A.muted;
      el.play().catch(() => { });
      A.pre = { id, el, src: null, nodes: [], gain: null, stopped: false };
      return A.pre;
    }
    return null;
  }
  const pre = A.pre = { id, src: null, el: null, nodes: [], gain: null, stopped: false };
  const g = pre.gain = x.createGain();
  g.gain.value = 0;
  g.connect(A.master);
  const buf = Rec.buf.get(id);
  if (buf) {
    /* Grabación confirmada de la sala: la misma que usa el minijuego. */
    const src = x.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = x.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    lp.Q.value = .4;
    src.connect(lp).connect(g);
    src.start(0);
    pre.src = src;
  } else if (id === 5) {
    solPrelude(x, pre, g);
  } else {
    /* Salas con grabación todavía sin cargar (o sin ficha): un acorde
       sintético muy filtrado mantiene el ambiente hasta que llega el
       archivo. RE no entra acá: su preludio es silencio. */
    const freqs = PRE_CHORDS[id] || PRE_CHORDS[1];
    const lp = x.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = .5;
    lp.connect(g);
    for (const f of freqs) {
      const o = x.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = rand(-7, 7);
      o.connect(lp);
      o.start();
      pre.nodes.push(o);
    }
    const lfo = x.createOscillator();
    lfo.frequency.value = .12;
    const lg = x.createGain();
    lg.gain.value = .06;
    lfo.connect(lg).connect(g.gain);
    lfo.start();
    pre.nodes.push(lfo);
  }
  const level = id === 5 ? .11 : PRE_LEVEL;
  const t = x.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 1.2);
  /* En la entrada directa (?room=N) todavía no hubo gesto: el primer toque
     o tecla reanuda el contexto y la música aparece con la locución. */
  if (x.state === 'suspended') {
    const resume = () => {
      try { x.resume(); } catch { }
      removeEventListener('pointerdown', resume, true);
      removeEventListener('keydown', resume, true);
    };
    addEventListener('pointerdown', resume, true);
    addEventListener('keydown', resume, true);
    pre.resume = resume;
  }
  return pre;
}

export function stopPreludeMusic(fade = .35) {
  const pre = A.pre;
  if (!pre) return;
  A.pre = null;
  pre.stopped = true;
  if (pre.resume) {
    removeEventListener('pointerdown', pre.resume, true);
    removeEventListener('keydown', pre.resume, true);
    pre.resume = null;
  }
  if (pre.el) { try { pre.el.pause(); } catch { } }
  const x = A.ctx;
  if (!x || !pre.gain) return;
  const t = x.currentTime;
  try {
    pre.gain.gain.cancelScheduledValues(t);
    pre.gain.gain.setTargetAtTime(0, t, Math.max(.01, fade / 3));
  } catch { }
  setTimeout(() => {
    try { pre.src?.stop(); } catch { }
    for (const n of pre.nodes) { try { n.stop(); } catch { } }
    try { pre.gain?.disconnect(); } catch { }
    pre.nodes = [];
  }, (fade + .15) * 1000);
}

export function sting() {
  pluck(659.25, 0, .7, .06, A.master);
  pluck(987.77, .09, .9, .05, A.master);
}

/* ---- carga de grabaciones ---- */
export function recMeta(id) {
  return new Promise(res => {
    const e = new Audio();
    e.preload = 'metadata';
    Rec.el.set(id, e);
    const d = () => res();
    e.addEventListener('loadedmetadata', d, { once: true });
    e.addEventListener('error', () => { Rec.bad.add(id); d(); }, { once: true });
    setTimeout(d, 3500);
    e.src = recUrl(id);
  });
}

export function loadRec(id) {
  if (Rec.buf.has(id) || Rec.fb.has(id)) return Promise.resolve();
  if (Rec.loading.has(id)) return Rec.loading.get(id);
  const p = (async () => {
    const x = ensureAudio();
    let ok = false;
    if (x) {
      try {
        const r = await fetch(recUrl(id));
        if (r.ok) { Rec.buf.set(id, await x.decodeAudioData(await r.arrayBuffer())); ok = true; }
      } catch (e) { }
    }
    if (!ok) { Rec.fb.add(id); await recMeta(id); }
  })();
  Rec.loading.set(id, p);
  return p;
}

export function recDur(id) {
  const b = Rec.buf.get(id);
  if (b) return b.duration;
  const e = Rec.el.get(id);
  return e && isFinite(e.duration) ? e.duration : 0;
}

export const recOk = id => Rec.buf.has(id) || (!Rec.bad.has(id) && recDur(id) > 0);

/* Para LA♯ se usa el tramo 5:31–5:55 de «CPE Bach Intervención»: es el pasaje de mayor
   densidad y movimiento continuo de la toma (sin silencios largos), en vez del inicio,
   más fragmentado y con varios huecos de bajo nivel. */
export const REGIONS = { 3: { from: 0, to: 20, n: 4 }, 6: { from: 331, to: 355, n: 6 } };

export function regionFor(id) {
  const R = REGIONS[id], d = recDur(id) || R.to;
  return { from: Math.min(R.from, Math.max(0, d - 2)), to: Math.min(R.to, d), n: R.n };
}

export function splitRegion(id, from, to, n) {
  const out = [from], L = (to - from) / n, b = Rec.buf.get(id);
  if (!b) {
    for (let i = 1; i < n; i++) out.push(from + L * i);
  } else {
    const ch = b.getChannelData(0), sr = b.sampleRate, win = Math.floor(sr * .02);
    const rms = t => {
      const s0 = Math.floor(t * sr);
      let s = 0, c = 0;
      for (let k = 0; k < win && s0 + k < ch.length; k++) {
        s += ch[s0 + k] * ch[s0 + k];
        c++;
      }
      return c ? s / c : 1;
    };
    for (let i = 1; i < n; i++) {
      const c0 = from + L * i;
      let best = c0, bv = Infinity;
      for (let t = c0 - L * .35; t <= c0 + L * .35; t += .02) {
        const v = rms(t);
        if (v < bv) { bv = v; best = t; }
      }
      out.push(best);
    }
  }
  out.push(to);
  return out;
}

export function recPeaks(id, s, e, n) {
  const b = Rec.buf.get(id), o = [];
  if (!b) {
    for (let i = 0; i < n; i++) o.push(.25 + .45 * Math.abs(Math.sin(i * 1.7 + s * 3)));
    return o;
  }
  const ch = b.getChannelData(0), sr = b.sampleRate, a = Math.floor(s * sr), z = Math.floor(e * sr), step = Math.max(1, Math.floor((z - a) / n));
  let mx = .001;
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let k = a + i * step; k < a + (i + 1) * step && k < ch.length; k += 4) m = Math.max(m, Math.abs(ch[k]));
    o.push(m);
    mx = Math.max(mx, m);
  }
  return o.map(v => v / mx);
}

export function wfImg(p) {
  const c = document.createElement('canvas');
  c.width = 160; c.height = 48;
  const x = c.getContext('2d');
  x.fillStyle = INKH;
  const w = 160 / p.length;
  p.forEach((v, i) => {
    const h = Math.max(3, v * 44);
    x.fillRect(i * w + 1, 24 - h / 2, Math.max(1, w - 2), h);
  });
  return c.toDataURL();
}

export function revBuf(id) {
  if (Rec.rev.has(id)) return Rec.rev.get(id);
  const b = Rec.buf.get(id), x = A.ctx, r = x.createBuffer(b.numberOfChannels, b.length, b.sampleRate);
  for (let c = 0; c < b.numberOfChannels; c++) {
    const s = b.getChannelData(c), d = r.getChannelData(c);
    for (let i = 0, n = s.length; i < n; i++) d[i] = s[n - 1 - i];
  }
  Rec.rev.set(id, r);
  return r;
}

export const fmt = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/* ---- Voice: una grabación en bucle, procesable en vivo ---- */
export function Voice(id, o = {}) {
  const x = ensureAudio(), buf = Rec.buf.get(id), rate = o.rate || 1, loop = o.loop !== false, v = { id, el: null, stopped: false };
  if (buf && x) {
    const src = x.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    src.playbackRate.value = rate;
    const lp = x.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = o.lp || 20000;
    lp.Q.value = .5;
    let tail = lp;
    src.connect(lp);
    if (o.hp) {
      const hp = x.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = o.hp;
      lp.connect(hp);
      tail = hp;
    }
    const g = x.createGain();
    g.gain.value = 0;
    tail.connect(g);
    g.connect(A.bus || A.master);
    const wet = x.createGain();
    wet.gain.value = o.wet || 0;
    if (A.verb) { tail.connect(wet); wet.connect(A.verb); }
    src.start(x.currentTime + (o.delay || 0), clamp(o.offset || 0, 0, Math.max(0, buf.duration - .05)));
    v.set = (p = {}) => {
      const t = x.currentTime;
      if (p.gain !== undefined) g.gain.setTargetAtTime(p.gain, t, .08);
      if (p.lp !== undefined) lp.frequency.setTargetAtTime(p.lp, t, .08);
      if (p.wet !== undefined) wet.gain.setTargetAtTime(p.wet, t, .12);
      if (p.rate !== undefined) src.playbackRate.setTargetAtTime(p.rate, t, .25);
    };
    v.stop = now => {
      if (v.stopped) return;
      v.stopped = true;
      A.voices.delete(v);
      const t = x.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0, t, now ? .02 : .15);
      try { src.stop(t + (now ? .12 : 1)); } catch { }
    };
  } else {
    const el = new Audio();
    el.src = recUrl(id);
    el.loop = loop;
    try { el.preservesPitch = false; } catch { }
    el.playbackRate = clamp(rate, .25, 4);
    el.volume = 0;
    el.muted = A.muted;
    v.el = el;
    A.fake++;
    const start = () => {
      if (v.stopped) return;
      try { el.currentTime = o.offset || 0; } catch { }
      el.play().catch(() => { });
    };
    if (o.delay) v.timer = setTimeout(start, o.delay * 1000); else start();
    v.set = (p = {}) => {
      if (p.gain !== undefined) el.volume = clamp(p.gain, 0, 1);
      if (p.rate !== undefined) el.playbackRate = clamp(p.rate, .25, 4);
    };
    v.stop = () => {
      if (v.stopped) return;
      v.stopped = true;
      A.voices.delete(v);
      A.fake = Math.max(0, A.fake - 1);
      clearTimeout(v.timer);
      try { el.pause(); } catch { }
    };
  }
  A.voices.add(v);
  return v;
}

/* ---- clips: cortes de la grabación (frases de MI, fragmentos de LA) ---- */
export function stopClips() {
  const c = A.clip;
  c.srcs.forEach(s => { try { s.stop(); } catch { } });
  c.srcs = [];
  c.timers.forEach(clearTimeout);
  c.timers = [];
  if (c.el) { try { c.el.pause(); } catch { } }
}

export function playClip(id, s, e, o = {}) {
  const when = o.when || 0, gain = o.gain ?? 1, x = A.ctx, buf = Rec.buf.get(id);
  let rate = o.rate || 1;
  if (buf && x) {
    let b = buf, so = s;
    if (o.reverse) { b = revBuf(id); so = buf.duration - e; }
    const dur = (e - s) / rate, src = x.createBufferSource();
    src.buffer = b;
    src.playbackRate.value = rate;
    const g = x.createGain(), t0 = x.currentTime + when, f = Math.min(.04, dur / 4);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + f);
    g.gain.setValueAtTime(gain, t0 + Math.max(f, dur - f));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    let tail = src;
    if (o.lp) {
      const lp = x.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lp;
      src.connect(lp);
      tail = lp;
    }
    tail.connect(g);
    g.connect(A.bus || A.master);
    if (o.wet && A.verb) {
      const w = x.createGain();
      w.gain.value = o.wet;
      tail.connect(w);
      w.connect(A.verb);
    }
    src.start(t0, so, e - s);
    A.clip.srcs.push(src);
    return dur;
  }
  if (o.reverse) rate *= .7;
  const dur = (e - s) / rate;
  if (!A.clip.el) {
    const el = new Audio(recUrl(id));
    try { el.preservesPitch = false; } catch { }
    A.clip.el = el;
  }
  const el = A.clip.el;
  el.muted = A.muted;
  A.clip.timers.push(
    setTimeout(() => {
      try { el.currentTime = s; } catch { }
      el.playbackRate = clamp(rate, .25, 4);
      el.volume = clamp(gain, 0, 1);
      el.play().catch(() => { });
    }, when * 1000),
    setTimeout(() => {
      try { el.pause(); } catch { }
    }, (when + dur) * 1000)
  );
  return dur;
}
