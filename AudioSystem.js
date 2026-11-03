/* ======================================================================
   FLAUXUS — AudioSystem.js
   Gestión de AudioContext, buffers, análisis espectral, síntesis y clips
   ====================================================================== */
import { clamp, lerp, rand, INKH, $ } from './core/util.js';
import { T } from './core/time.js';
import { VO } from './core/voiceState.js';
import { toast } from './ui/toast.js';

export const A = {
  ctx: null, master: null, an: null, anBuf: null, pan: null, bus: null, verb: null,
  muted: false, nodes: [], keep: [], ambient: null, noiseBuf: null, voices: new Set(),
  clip: { srcs: [], timers: [], el: null }, lvl: 0, fake: 0
};

export const trackFiles = new Map([
  [1, 'CPEBMov1.wav'],
  [2, 'Bourré JSBach discontinuo.wav'],
  [3, 'Sarabanda ornamentada.wav'],
  [4, 'Stockhausen.wav'],
  [6, 'CPE Bach Intervención.wav']
]);

export const recUrl = id => new URL(trackFiles.get(id), document.baseURI).href;
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

export function startAmbient() {
  if (A.ambient || !ensureAudio()) return;
  A.ambient = pad([55, 82.41, 110, 164.81], .045, 'sine', A.keep);
  A.ambient.set(1, 2);
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

export const REGIONS = { 3: { from: 0, to: 20, n: 4 }, 6: { from: 0, to: 24, n: 6 } };

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
