/* ======================================================================
   FLAUXUS — Sala 3 · MI — El fraseo
   Decide dónde respira la música. La pausa es una decisión, no un botón.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { recOk, pad, tone, playClip, stopClips, A, regionFor, splitRegion, recPeaks, ensureAudio } from '../AudioSystem.js';
import { S, roomGroup, avatarObj, bloom, glowSprite, animAvatar, ctx, W, H, burst, LIME, LIMEH, PAPER, SERIF, FONT, CARDS, OPLIST, HAND, clamp, lerp, damp, hint, toast, finish, roomGen, $ } from './context.js';

export const meta = {
  key: 'mi',
  id: 3, note: 'MI4', short: 'MI', title: 'El fraseo', desc: 'Decide dónde respira la música. La pausa es una decisión, no un botón.', source: 'Sarabanda ornamentada.wav', audio: 'real', color: 0xc9d000, hex: '#c9d000', avatar: 'disciplined',
  goal: 'La grabación se parte en cuatro frases. Entre una y otra hay una respiración: tú decides cuánto dura. Arrastra cada punto hacia arriba para alargarla, escucha y confirma.',
  ctl: [[['Arrastrar ↕'], ['Arrastrar ↕'], 'Duración de cada pausa'], [['▶ Original'], ['▶ Original'], 'Cómo suena sin tus decisiones']],
  light: {
    bg: 0x0f110c, fog: .020, exp: 1.05, env: .32, hemi: [0xf4f0dc, 0x262a1c, .4], key: { c: 0xfff0d4, i: 1.1, p: [6, 14, 10] }, rim: { c: 0xc9d000, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xfff0d4, e: 1.1, r: 5, p: [3, 5, -3] }, { c: 0xd4e8a0, e: .9, r: 5, p: [-4, 3, 2] }], spot: { c: 0xfff8e8, e: 1.2, r: 10, p: [0, 10, 4], t: [0, 0, -2], ang: 1.0, pen: .7 }
  },
  /* Huella de MI: cuatro respiraciones, cada una con su altura. */
  motif(x, m, cx, cy, s) { (m.vals || []).forEach((v, i) => { x.fillRect(cx - s * .8 + i * s * .45, cy + s * .4 - v * s * .9, s * .28, v * s * .9 + 2) }) },
  /* Calibración del atrio: círculo guía y aro del portal. */
  nav: {
    cue: { x: 2.01, z: -0.74, y: 0.0 }, // MI4 (centro del pie de la escalera diagonal)
    portal: { x: -0.2, y: 0.0, z: 0.2, scale: 0.85, rotY: -4 }
  },
  vo: {
    trigger: 'DECIDIR LA FRASE',
    text: [
      {
        "t": "¿Hay realmente una intención? ¿Trasciende la ganancia que suponía el componer? Y, si la hay ¿Puedo acceder a ella? ¿Necesito acceder a ella? Con o sin conocimiento de la intención, el canon suena. Y ha sonado. Y seguirá sonando con o sin mí (con o sin ti). Tal vez la revelación es que no hay nada que entender y, si lo hay, está perdido. De lo único de lo que puedo estar segura, es de mi intención.",
        "src": "Carrusel 2 · lámina 5"
      }
    ],
    files: ['Voz_MI4']
  }
};

export const MI = (() => {
  let vals, touched, playing, listened, ops = [null, null, null, null], hand = [], selCard = -1, handles = [], drag, bounds = [], wf = [], evs = [], lvl = 0, halo, arcs = [], ph0 = 0, seq = [], real = false, fbPad = null, origT = 0;
  const trackLen = () => clamp(H * .2, 90, 160), yBase = () => H * .74, yPh = () => H * .34;
  function layout() { const pw = W * .13, gb = W * .02, gv = W * .045; const total = 4 * pw + gb * 4 + gv * vals.reduce((a, b) => a + b, 0); let x = (W - total) / 2; const L = []; for (let i = 0; i < 4; i++) { const p = { x0: x, x1: x + pw }; x += pw; const g = { x0: x, x1: x + gb + gv * vals[i] }; x = g.x1; L.push({ p, g }) } return L }
  const readout = i => `Frase ${i + 1} · respiración de ${Math.round(vals[i] * 900)} ms`;
  function updBtns() { const n = touched.size; $('miListen').disabled = n < 4 || playing || !real; $('miListen').textContent = n < 4 ? `Mueve los 4 puntos (${n}/4)` : '▶ Mi fraseo'; $('miOrig').disabled = playing || !real; $('miConfirm').style.display = (listened && !playing) || (!real && n === 4) ? 'block' : 'none' }
  // Baraja → comportamiento: cada carta modifica UNA frase (tempo, repetición, silencio, orden interno, insistencia)
  function playPhrase(i, when) {
    const op = ops[i], s = bounds[i], e = bounds[i + 1], Ln = e - s; let dur = 0, extra = 0;
    switch (op) {
      case 'ACELERA': dur = playClip(3, s, e, { when, rate: 1.15, wet: .15 }); break;
      case 'RETARDA': dur = playClip(3, s, e, { when, rate: .86, wet: .22 }); break;
      case 'REPITE': dur = playClip(3, s, e, { when, wet: .15 }) + .18; dur += playClip(3, s, e, { when: when + dur, gain: .55, wet: .35 }); break;
      case 'SILENCIA': dur = Ln; break;
      case 'INSISTE': { const k = s + Ln * .62; dur = playClip(3, s, e, { when, wet: .15 }); for (let r = 0; r < 2; r++) { dur += .06; dur += playClip(3, k, e, { when: when + dur, gain: .8 - r * .2, wet: .25 }) } break }
      case 'DESVIA': { const k = s + Ln * .4; dur = playClip(3, k, e, { when, wet: .2 }) + .14; dur += playClip(3, s, k, { when: when + dur, wet: .3 }); break }
      default: dur = playClip(3, s, e, { when, wet: .15 })
    }
    if (op === 'PAUSA') extra = .55; return { dur, extra }
  }
  function preview(i) { if (playing || !real) return; stopClips(); playPhrase(i, 0) }
  function renderHand() {
    const hd = $('hand'); hd.innerHTML = hand.length ? '<span class="handlbl">Tu baraja</span>' : '';
    hand.forEach((h, k) => {
      const b = document.createElement('button'); b.className = 'cardchip' + (selCard === k ? ' sel' : '') + (h.used ? ' used' : ''); b.textContent = CARDS[h.c].n; b.title = CARDS[h.c].d;
      b.onclick = () => {
        if (playing) return;
        if (h.used) { if (h.at >= 0) ops[h.at] = null; h.used = false; h.at = -1; listened = false; updBtns(); renderHand(); hint('Carta devuelta a tu mano'); return }
        selCard = selCard === k ? -1 : k; $('intMenu').style.display = 'none'; renderHand();
        hint(selCard >= 0 ? (CARDS[h.c].wild ? 'MI INTENCIÓN: toca el punto de una frase y decide tú la regla' : `${CARDS[h.c].n} · ${CARDS[h.c].d} Toca el punto de la frase donde la aplicas.`) : 'Arrastra los puntos ↕ para alargar las respiraciones')
      };
      hd.appendChild(b)
    }); $('handWrap').style.display = hand.length ? 'flex' : 'none'
  }
  function openMenu(i) {
    const m = $('intMenu'); m.innerHTML = `<span class="handlbl">Frase ${i + 1} · ¿qué decides?</span>`;
    OPLIST.forEach(o => { const b = document.createElement('button'); b.className = 'cardchip menu'; b.textContent = CARDS[o].n; b.onclick = () => applyCard(i, o); m.appendChild(b) }); m.style.display = 'flex'
  }
  function applyCard(i, over) {
    const h = hand[selCard]; if (!h || playing) return;
    if (CARDS[h.c].wild && !over) { openMenu(i); return }
    const op = over || h.c; hand.forEach(x => { if (x !== h && x.at === i) { x.used = false; x.at = -1 } }); if (h.at >= 0 && h.at !== i) ops[h.at] = null;
    ops[i] = op; h.used = true; h.at = i; selCard = -1; $('intMenu').style.display = 'none'; listened = false; updBtns(); renderHand();
    tone(520, .08, 'triangle', .05, 0, A.master); toast(`${CARDS[op].n} · frase ${i + 1}`); hint('Carta jugada. Escucha tu fraseo o ajusta otra frase.'); preview(i)
  }
  function play() {
    if (touched.size < 4 || playing || !real) return; playing = true; updBtns(); ensureAudio(); stopClips(); const L = layout(); evs = []; seq = []; let t = 0;
    for (let i = 0; i < 4; i++) {
      const { dur, extra } = playPhrase(i, t); seq.push({ t, x: L[i].p.x0, i }); t += dur; seq.push({ t, x: L[i].p.x1, i });
      t += vals[i] * .9 + .1 + extra; seq.push({ t, x: L[i].g.x1, i })
    }
    ph0 = performance.now(); const total = t; hint('Escuchando tu fraseo…'); setTimeout(() => { playing = false; listened = true; updBtns(); hint('¿Te convence? Ajusta las respiraciones y vuelve a escuchar, o confirma.') }, total * 1000 + 400)
  }
  function playOrig() { if (playing || !real) return; playing = true; updBtns(); stopClips(); const d = playClip(3, bounds[0], bounds[4], { wet: .1 }); hint('Así suena sin tus decisiones…'); setTimeout(() => { playing = false; updBtns(); hint('Ahora decide dónde respira cada frase') }, d * 1000 + 300) }
  return {
    camPos: new THREE.Vector3(0, 2.2, 8.4), camLook: new THREE.Vector3(0, 1.9, 0),
    build() {
      halo = glowSprite(LIME, 9, .3); halo.position.set(0, 2.2, -1.5); roomGroup.add(halo);
      arcs = []; for (let i = 0; i < 4; i++) { const a = new THREE.Mesh(new THREE.TorusGeometry(2.4 + i * .55, .02, 6, 80, Math.PI), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .25 })); a.position.set(0, .1, -1); roomGroup.add(a); arcs.push(a) }
      avatarObj.scale.setScalar(1.1);
      /* Room 3 FBX + lighting */
      placeFBX(3, roomGroup, 14, { roughness: 0.86, metalness: 0.07 }, () => roomGen);
    },
    start() {
      vals = [.35, .45, .55, .38]; touched = new Set(); playing = false; listened = false; ops = [null, null, null, null]; selCard = -1; hand = HAND.map(c => ({ c, used: false, at: -1 })); drag = null; real = recOk(3);
      const reg = regionFor(3); bounds = splitRegion(3, reg.from, reg.to, 4); wf = [0, 1, 2, 3].map(i => recPeaks(3, bounds[i], bounds[i + 1], 44));
      if (!real) { fbPad = pad([146.83, 220, 293.66], .04); fbPad.set(1) }
      $('miUI').style.display = 'block'; $('intMenu').style.display = 'none'; renderHand(); const hc = $('miHandles'); hc.innerHTML = ''; handles = [];
      for (let i = 0; i < 4; i++) {
        const h = document.createElement('button'); h.className = 'breath untouched'; h.setAttribute('role', 'slider'); h.setAttribute('aria-label', 'Respiración tras la frase ' + (i + 1)); h.setAttribute('aria-valuemin', '0'); h.setAttribute('aria-valuemax', '900');
        h.addEventListener('pointerdown', e => { if (S.phase !== 'play' || playing) return; e.preventDefault(); if (selCard >= 0) { applyCard(i); return } h.setPointerCapture(e.pointerId); drag = { i, y0: e.clientY, v0: vals[i] }; h.classList.add('active') });
        h.addEventListener('pointermove', e => { if (!drag || drag.i !== i) return; const nv = clamp(drag.v0 - (e.clientY - drag.y0) / trackLen(), 0, 1); if (Math.floor(nv * 20) !== Math.floor(vals[i] * 20)) tone(400 + nv * 600, .04, 'sine', .02, 0, A.master); vals[i] = nv; touched.add(i); h.classList.remove('untouched'); listened = false; hint(readout(i)); updBtns() });
        const up = () => { if (drag && drag.i === i) { drag = null; h.classList.remove('active'); preview(i) } }; h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
        h.addEventListener('keydown', e => { if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { vals[i] = clamp(vals[i] + (e.code === 'ArrowUp' ? .06 : -.06), 0, 1); touched.add(i); h.classList.remove('untouched'); listened = false; hint(readout(i)); updBtns(); e.stopPropagation() } });
        h.textContent = ''; hc.appendChild(h); handles.push(h)
      }
      $('miListen').onclick = play; $('miOrig').onclick = playOrig; $('miConfirm').onclick = () => finish({ vals: [...vals], ops: [...ops] }, [['Respiraciones', vals.map(v => Math.round(v * 900)).join(' · ') + ' ms'], ...(HAND.length ? [['Cartas jugadas', ops.some(Boolean) ? ops.map(o => o ? CARDS[o].n : '—').join(' · ') : 'ninguna']] : [])]);
      updBtns(); hint(real ? 'Arrastra cada punto ↕ hacia arriba para alargar su respiración' : 'No encontré la grabación: fraseo en modo provisional (mueve los 4 puntos y confirma)')
    },
    update(dt) { const L = layout(); $('handWrap').style.top = (yPh() + 68) + 'px'; handles.forEach((h, i) => { const g = L[i].g; h.style.transform = `translate(${(g.x0 + g.x1) / 2}px,${yBase() - vals[i] * trackLen()}px)`; h.setAttribute('aria-valuenow', Math.round(vals[i] * 900)) }); lvl = damp(lvl, A.lvl, 6, dt) },
    update3d(dt, t3) { halo.material.opacity = .25 + lvl * .5; halo.scale.setScalar(9 + lvl * 2 + Math.sin(t3 * 1.2) * .4); arcs.forEach((a, i) => { a.material.opacity = .15 + (vals ? vals[i] * .5 : 0); a.rotation.z = Math.sin(t3 * .3 + i) * .05; a.scale.setScalar(1 + (vals ? vals[i] * .18 : 0)) }); animAvatar(avatarObj, 0, t3, true, lvl); if (bloom) bloom.strength = .5 + lvl * .3 },
    draw() {
      const L = layout(), yp = yPh(), tl = trackLen(), now = playing && seq.length ? (performance.now() - ph0) / 1000 : -1; ctx.save();
      let activeI = -1, px = null;
      if (now >= 0) { for (let i = 0; i < seq.length - 1; i++) { const a = seq[i], b = seq[i + 1]; if (now >= a.t && now <= b.t) { px = lerp(a.x, b.x, (now - a.t) / Math.max(.001, b.t - a.t)); activeI = a.i; if (i % 3 === 0) { } break } } if (px === null) px = seq[seq.length - 1].x }
      for (let i = 0; i < 4; i++) {
        const p = L[i].p, g = L[i].g, w = p.x1 - p.x0; const act = activeI === i;
        ctx.fillStyle = act ? 'rgba(201,208,0,.12)' : 'rgba(239,234,219,.05)'; ctx.strokeStyle = act ? LIMEH : 'rgba(239,234,219,.18)'; ctx.lineWidth = act ? 2 : 1.5; ctx.beginPath(); ctx.roundRect(p.x0, yp - 56, w, 112, 10); ctx.fill(); ctx.stroke();
        if (ops[i]) { ctx.fillStyle = LIMEH; ctx.font = `700 11px ${FONT}`; ctx.textAlign = 'right'; ctx.fillText(CARDS[ops[i]].n, p.x1 - 4, yp - 64) }
        ctx.fillStyle = 'rgba(239,234,219,.55)'; ctx.font = `italic 400 14px ${SERIF}`; ctx.textAlign = 'left'; ctx.fillText('frase ' + (i + 1), p.x0 + 8, yp - 64);
        // forma de onda REAL de la grabación
        const pk = wf[i] || [], bw = w / pk.length; ctx.fillStyle = act ? LIMEH : 'rgba(239,234,219,.75)'; pk.forEach((v, k) => { const h = Math.max(3, v * 88); ctx.fillRect(p.x0 + k * bw + 1, yp - h / 2, Math.max(1, bw - 2), h) });
        const gx = (g.x0 + g.x1) / 2; ctx.strokeStyle = 'rgba(239,234,219,.14)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.moveTo(gx, yBase()); ctx.lineTo(gx, yBase() - tl); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = LIMEH; ctx.lineWidth = 3; ctx.globalAlpha = .7; ctx.beginPath(); ctx.moveTo(gx, yBase()); ctx.lineTo(gx, yBase() - vals[i] * tl); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(201,208,0,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.x0 + 3, yp + 4); ctx.quadraticCurveTo(gx, yp + 4 + vals[i] * 38, g.x1 - 3, yp + 4); ctx.stroke();
        ctx.fillStyle = touched.has(i) ? LIMEH : 'rgba(239,234,219,.5)'; ctx.font = `italic 400 14px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText(touched.has(i) ? Math.round(vals[i] * 900) + ' ms' : 'respira', gx, yBase() + 40)
      }
      if (px !== null) { ctx.strokeStyle = PAPER; ctx.lineWidth = 2; ctx.shadowColor = LIMEH; ctx.shadowBlur = 18; ctx.beginPath(); ctx.moveTo(px, yp - 72); ctx.lineTo(px, yp + 72); ctx.stroke(); ctx.shadowBlur = 0; if (Math.random() < .25) burst(px, yp, LIMEH, 2, 80, .4, 2) }
      ctx.restore()
    }, stop() { $('miUI').style.display = 'none'; stopClips() }
  }
})();
