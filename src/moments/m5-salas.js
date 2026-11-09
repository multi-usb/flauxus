import { SCROLL_SCREENS } from '../config.js';
import { track } from '../lib/track.js';
import { createTyper, span } from '../ui/type.js';
import { sharpHTML } from '../ui/sharp.js';

// Momento 5 · Las seis salas como OSCILOSCOPIO XY.
// Un osciloscopio en modo XY dibuja la relación entre dos frecuencias: en X, DO4 (donde empieza todo);
// en Y, la nota de cada sala. Cada sala tiene así una figura propia (Lissajous) que sale de su frecuencia
// real — nada inventado: escala de tonos enteros del GTI v3, afinación temperada con La4 = 440 Hz.
// Al cerrar, la corrección de María Clara —la octava «termina al doble de frecuencia»— se dibuja como la
// figura 2:1 (DO4 contra el doble de su frecuencia). No es una séptima sala: es su frase hecha forma.
// Al pasar el cursor (o tocar) una nota, suena su frecuencia exacta.
const DO4 = 261.63;
const SALAS = [
  { note: 'DO4', hz: 261.63, title: 'El sonido bello', prompt: '[E] ENCONTRAR EL SONIDO' },
  { note: 'RE4', hz: 293.66, title: 'El pulso', prompt: '[E] JUGAR CON EL PULSO' },
  { note: 'MI4', hz: 329.63, title: 'El fraseo', prompt: '[E] DECIDIR LA FRASE' },
  { note: 'FA♯4', hz: 369.99, title: 'El cuerpo en movimiento', prompt: '[E] HABITAR EL ESPACIO' },
  { note: 'SOL♯4', hz: 415.3, title: 'El unicornio cyborg', prompt: '[E] CONECTAR EL CUERPO' },
  { note: 'LA♯4', hz: 466.16, title: 'MataЯ al padre', prompt: '[E] INTERVENIR LA PARTITURA' },
];
const fmt = (hz) => `${hz.toFixed(2).replace('.', ',')} Hz`;

export function createM5({ profile, sfx }) {
  const section = document.getElementById('m5');
  const canvas = section.querySelector('.osc');
  const ctx = canvas.getContext('2d');
  const freqEl = section.querySelector('.osc-freq');
  const list = section.querySelector('.notes');
  const detail = section.querySelector('.sala-detail');
  const noteEl = detail.querySelector('.sala-note');
  const titleEl = detail.querySelector('.sala-title');
  const promptEl = detail.querySelector('.sala-prompt');
  const quote = section.querySelector('.m5-quote');
  const typeQuote = createTyper(quote.querySelector('.type'), profile);

  let scrolled = -1;
  let manual = -1;
  let shownDetail = -2;
  let ratio = 1; // ratio dibujado (se acerca al objetivo)
  let target = 1;
  let octave = false;
  let size = 0;
  let dpr = 1;

  const buttons = SALAS.map((s, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'note';
    b.dataset.cursor = '';
    b.setAttribute('aria-label', `${s.note} — ${s.title}`);
    b.innerHTML = `<span class="n">${sharpHTML(s.note)}</span><span class="hz">${fmt(s.hz)}</span>`;
    li.append(b);
    list.append(li);
    const pick = () => { manual = i; render(); sfx('pulse', { freq: s.hz, dur: 0.9 }); };
    b.addEventListener('pointerenter', (ev) => { if (ev.pointerType === 'mouse') pick(); });
    b.addEventListener('pointerleave', (ev) => { if (ev.pointerType === 'mouse') { manual = -1; render(); } });
    b.addEventListener('click', pick);
    b.addEventListener('focus', () => { manual = i; render(); });
    b.addEventListener('blur', () => { manual = -1; render(); });
    return b;
  });

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    size = Math.round(r.width * dpr);
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
  }
  addEventListener('resize', resize);

  function render() {
    const show = octave ? -1 : (manual >= 0 ? manual : scrolled);
    buttons.forEach((b, i) => {
      b.classList.toggle('lit', i <= scrolled);
      b.classList.toggle('active', i === show);
    });
    target = octave ? 2 : (show >= 0 ? SALAS[show].hz / DO4 : 1);
    freqEl.textContent = octave ? `${fmt(DO4)} × 2` : (show >= 0 ? `${fmt(DO4)} : ${fmt(SALAS[show].hz)}` : '');
    if (show === shownDetail) return;
    shownDetail = show;
    detail.classList.toggle('on', show >= 0);
    if (show < 0) return;
    const s = SALAS[show];
    noteEl.textContent = s.note;
    setTitle(titleEl, s.title);
    promptEl.textContent = s.prompt;
    detail.classList.remove('step');
    void detail.offsetWidth;
    detail.classList.add('step');
  }

  // Osciloscopio: persistencia de fósforo (cada cuadro oscurece el anterior) y un trazo verde.
  function draw(time) {
    if (!size) resize();
    if (!size) return;
    const reduced = profile.reducedMotion;
    ctx.fillStyle = reduced ? '#000' : 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, 0, size, size);
    // Retícula del instrumento
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const p = (size * i) / 8;
      ctx.moveTo(p, 0); ctx.lineTo(p, size);
      ctx.moveTo(0, p); ctx.lineTo(size, p);
    }
    ctx.stroke();
    ctx.strokeStyle = '#383838';
    ctx.beginPath();
    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
    ctx.stroke();

    // Figura: x = sin(2π·DO4·s), y = sin(2π·nota·s + φ). Como un haz real: la traza avanza y su cola se apaga
    // poco a poco (sin extremos cortados); la cabeza es el punto brillante del haz. φ avanza lento: la figura respira.
    ratio += (target - ratio) * 0.12;
    const phase = reduced ? 0.6 : time * 0.35;
    const s0 = reduced ? 0 : time * 2.4;
    const cycles = 7;
    const N = 1400;
    const B = 28;
    const per = N / B;
    const R = size * 0.42;
    const c = size / 2;
    const at = (k) => {
      const s = s0 + (k / N) * cycles * Math.PI * 2;
      return [c + Math.sin(s) * R, c - Math.sin(s * ratio + phase) * R];
    };
    ctx.strokeStyle = '#C2FE0B';
    ctx.lineWidth = Math.max(1, 1.8 * dpr);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (let b = 0; b < B; b++) {
      ctx.globalAlpha = Math.pow((b + 1) / B, 1.6);
      ctx.beginPath();
      for (let k = Math.floor(b * per); k <= Math.ceil((b + 1) * per); k++) {
        const [x, y] = at(k);
        if (k === Math.floor(b * per)) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Punto del haz
    const [hx, hy] = at(N);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx, hy, 2.6 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    id: 'm5',
    track: track(section, SCROLL_SCREENS.m5),
    dom(e, q, { active, time }) {
      const idx = q < 0.04 ? -1 : Math.min(SALAS.length - 1, Math.floor(span(q, 0.04, 0.78) * SALAS.length));
      const oct = q > 0.84;
      if (idx !== scrolled || oct !== octave) {
        if (idx !== scrolled && idx >= 0 && active) sfx('pulse', { freq: SALAS[idx].hz, dur: 0.7, quiet: true });
        scrolled = idx;
        octave = oct;
        if (manual >= 0 && !matchMedia('(hover: hover)').matches) manual = -1;
        render();
      }
      typeQuote(span(q, 0.84, 0.96));
      quote.classList.toggle('on', q > 0.83);
      section.classList.toggle('octave', oct);
      if (active || e > 0.3) draw(time);
    },
  };
}

// «MataЯ al padre»: la Я como R espejada con la misma fuente (el subset latin no trae cirílico).
function setTitle(el, title) {
  el.setAttribute('aria-label', title);
  if (!title.includes('Я')) { el.textContent = title; return; }
  const [a, b] = title.split('Я');
  el.innerHTML = '';
  const mk = (txt, cls) => { const s = document.createElement('span'); s.setAttribute('aria-hidden', 'true'); s.textContent = txt; if (cls) s.className = cls; return s; };
  el.append(mk(a), mk('R', 'mirror'), mk(b));
}
