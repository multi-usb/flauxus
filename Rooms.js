/* ======================================================================
   FLAUXUS — Rooms.js
   Lógica específica de cada sala:
   DO (Resonancia pura), RE (El pulso), MI (El fraseo),
   FA (El cuerpo), SOL (Sinestesia), LA (Deconstrucción)
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from './AssetManager.js';
import {
  recOk, Voice, pad, tone, pluck, hiss, playClip, stopClips, A,
  regionFor, splitRegion, recPeaks, wfImg, ensureAudio, fmt
} from './AudioSystem.js';
import { GX } from './GameContext.js';

/* ── Todas las variables de contexto que el código de las salas usa directamente ── */
let S, roomGroup, avatarObj, camera, bloom, scene, mat, makeDust,
    glowSprite, makeTextSprite, animAvatar, rimSet, ctx, W, H, DPR,
    burst, ringFx, ftext, shake, glowCircle, bolt, toScreen,
    LIME, LIMEH, PAPER, SERIF, FONT, PALE, CARDS, OPLIST, HAND, EXPERIMENT,
    V3, clamp, lerp, damp, rand, lerpAngle, TOUCH, ptr, keys, ptrActive,
    hint, toast, finish, moveInput, groundController, roomGen, T, $;

/**
 * Llamar desde Main.js justo después de inicializar todo.
 * Rellena todas las referencias (estáticas y dinámicas).
 */
export function roomsInit() {
  S = GX.S; roomGroup = GX.roomGroup; avatarObj = GX.avatarObj;
  camera = GX.camera; bloom = GX.bloom; scene = GX.scene;
  mat = GX.mat; makeDust = GX.makeDust; glowSprite = GX.glowSprite;
  makeTextSprite = GX.makeTextSprite; animAvatar = GX.animAvatar;
  rimSet = GX.rimSet; ctx = GX.ctx2d; W = GX.W; H = GX.H; DPR = GX.DPR;
  burst = GX.burst; ringFx = GX.ringFx; ftext = GX.ftext; shake = GX.shake;
  glowCircle = GX.glowCircle; bolt = GX.bolt; toScreen = GX.toScreen;
  LIME = GX.LIME; LIMEH = GX.LIMEH; PAPER = GX.PAPER; SERIF = GX.SERIF;
  FONT = GX.FONT; PALE = GX.PALE; CARDS = GX.CARDS; OPLIST = GX.OPLIST;
  HAND = GX.HAND; EXPERIMENT = GX.EXPERIMENT; V3 = GX.V3;
  clamp = GX.clamp; lerp = GX.lerp; damp = GX.damp; rand = GX.rand;
  lerpAngle = GX.lerpAngle; TOUCH = GX.TOUCH; ptr = GX.ptr; keys = GX.keys;
  ptrActive = GX.ptrActive; hint = GX.hint; toast = GX.toast;
  finish = GX.finish; moveInput = GX.moveInput;
  groundController = GX.groundController;
  roomGen = GX.roomGen; T = GX.T; $ = GX.$;
}

/**
 * Llamar al inicio de cada frame para refrescar los valores dinámicos.
 * Costo ~0: solo asignaciones de referencias en JS.
 */
export function roomsUpdate() {
  S = GX.S; roomGroup = GX.roomGroup; avatarObj = GX.avatarObj;
  camera = GX.camera; bloom = GX.bloom; scene = GX.scene;
  ctx = GX.ctx2d; W = GX.W; H = GX.H; DPR = GX.DPR;
  ptr = GX.ptr; roomGen = GX.roomGen; T = GX.T;
}







export const DO = (() => {
  const NEED = 8; let voice, stable = 0, air = 0, purity = 0, ang = 0, R = 60, inside = false, tgt = { x: 0, y: 0 }, ring3, col, dust, spark = 0, idle = 0, airT = 0, best = 0, tick = 0, real = false, fb = null;
  return {
    build() {
      ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.1, .04, 10, 96), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .4 })); ring3.rotation.x = Math.PI / 2; ring3.position.y = 1.5; roomGroup.add(ring3);
      col = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 14, 8), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); col.position.y = 7; roomGroup.add(col);
      dust = makeDust(300, 8, 7, 0xf0eddc, .14); roomGroup.add(dust); avatarObj.scale.setScalar(1.15);
      /* Room 1 FBX + lighting */
      placeFBX(1, roomGroup, 16, { roughness: 0.85, metalness: 0.08 }, () => roomGen);
    },
    start() {
      stable = 0; air = 0; purity = 0; ang = 0; idle = 0; airT = 0; best = 0; real = recOk(1); voice = null; fb = null;
      if (real) { voice = Voice(1, { lp: 380, wet: .5 }); voice.set({ gain: .2 }) } else { fb = pad([130.81, 196, 261.63], .05); fb.set(.3) }
      hint(TOUCH ? 'Pon el dedo sobre la luz y síguela' : 'Mueve el cursor sobre la luz · mantén clic o Espacio para soplar')
    },
    update(dt) {
      const hold = ptr.down || keys.has('Space'); ang += dt * (.5 + stable / NEED * .3); tgt.x = W / 2 + Math.cos(ang) * W * .2; tgt.y = H * .44 + Math.sin(ang * 1.31) * H * .15; R = clamp(Math.min(W, H) * .09, 52, 90);
      const d = Math.hypot(ptr.x - tgt.x, ptr.y - tgt.y); inside = d < R && ptrActive(); air = damp(air, hold ? 1 : 0, hold ? 9 : 6, dt);
      purity = damp(purity, hold ? (inside ? 1 : clamp(1 - (d - R) / (R * 2.4), 0, .6)) : 0, 8, dt);
      const clar = air * purity;
      if (voice) voice.set({ gain: lerp(.18, 1, air * (.3 + .7 * purity)), lp: lerp(380, 15000, Math.pow(clar, .75)), wet: lerp(.5, .12, purity) });
      if (fb) fb.set(.3 + clar * 1.4, .2);
      if (hold) airT += dt;
      if (hold && inside) { stable += dt; best = Math.max(best, stable); spark -= dt; if (spark <= 0) { spark = .07; burst(tgt.x + rand(-R, R) * .6, tgt.y + rand(-R, R) * .6, LIMEH, 3, 120, .6, 3) } tick += dt; if (tick > .5) { tick = 0; ringFx(tgt.x, tgt.y, LIMEH, R, R + 60, .7, 2) } }
      else if (hold) stable = Math.max(0, stable - dt * .5); else stable = Math.max(0, stable - dt * .9);
      if (!hold) idle += dt; else idle = 0;
      hint(!hold ? (idle > 2.5 ? (TOUCH ? 'Mantén el dedo pulsado sobre la luz' : 'Mantén pulsado el clic (o Espacio) para soplar') : (TOUCH ? 'Pon el dedo sobre la luz y síguela' : 'Mantén clic o Espacio para soplar')) : inside ? 'Ahí está: sostén la claridad' : 'Sigue la luz');
      if (stable >= NEED) finish({ stable: NEED, air: airT }, [['Aire sostenido', airT.toFixed(1) + ' s'], ['Mejor racha en resonancia', best.toFixed(1) + ' s']])
    },
    update3d(dt, t) { ring3.scale.setScalar(1 + purity * .3 + Math.sin(t * 2) * .03); ring3.material.opacity = .25 + stable / NEED * .7; col.material.opacity = purity * .25; dust.rotation.y += dt * (.05 + purity * .3); rimSet(2 + purity * 3 + A.lvl * 1.75); if (bloom) bloom.strength = .5 + purity * .4; animAvatar(avatarObj, 0, t, true, air * .5 + A.lvl) },
    draw() {
      const bx = tgt.x, by = tgt.y; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(bx, by, R * 2.4, `rgba(201,208,0,${.1 + purity * .3})`, 'rgba(201,208,0,0)');
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(201,208,0,${.07 + purity * .1})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, R * (1.4 + i * .55 + Math.sin(T * 2 + i) * .06 * (1 + purity)), 0, 6.283); ctx.stroke() } ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = inside ? LIMEH : 'rgba(201,208,0,.6)'; ctx.beginPath(); ctx.arc(bx, by, R, 0, 6.283); ctx.stroke();
      ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.strokeStyle = PAPER; ctx.beginPath(); ctx.arc(bx, by, R + 14, -Math.PI / 2, -Math.PI / 2 + 6.283 * stable / NEED); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.fillStyle = inside && air > .3 ? LIMEH : 'rgba(239,234,219,.55)'; ctx.font = `italic 700 15px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText(Math.round(stable / NEED * 100) + '%', bx, by + 5);
      if (ptrActive()) {
        ctx.strokeStyle = 'rgba(239,234,219,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 16, -Math.PI / 2, -Math.PI / 2 + 6.283 * air); ctx.stroke(); ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 5 + air * 3, 0, 6.283); ctx.fill();
        if (air > .1 && purity < .3) { ctx.fillStyle = 'rgba(239,234,219,.55)'; ctx.font = `italic 400 14px ${SERIF}`; ctx.fillText('aire sin resonancia', ptr.x, ptr.y + 36) }
      }
    },
    stop() { }
  }
})();

/* ======================================================================
   SALA 2 · RE — PENDIENTE DE VALIDACIÓN con María Clara (audio provisional)
   ====================================================================== */
export const RE = (() => {
  const BPM = 96, B = 60 / BPM, NEED = 12; let t = 0, notes = [], nt = 0, k = 0, nextClick = 0, hits = 0, perfect = 0, miss = 0, combo = 0, bestCombo = 0, devs = [], pulse = 0, red = 0, pillars = [], floorL;
  const sc = [293.66, 329.63, 392, 440, 523.25, 587.33, 659.25], hx = () => W * (TOUCH ? .2 : .26), ly = () => H * .5, spd = () => W * .34;
  function gen() { while (nt < t + 9) { let T0; if (k === 0) T0 = B * 4; else if (k < 8) T0 = nt + B; else T0 = nt + ((k % 2) ? B * .75 : B * 1.25); nt = T0; notes.push({ t: T0, done: false, off: Math.abs(T0 / B - Math.round(T0 / B)) > .1 }); k++ } }
  function press() {
    if (S.phase !== 'play' || t < B * 3.5) return; let best = null, bd = 1; for (const n of notes) { if (n.done) continue; const d = Math.abs(n.t - t); if (d < bd) { bd = d; best = n } }
    const X = hx(), Y = ly();
    if (best && bd <= .17) {
      best.done = true; const signed = (t - best.t) * 1000; if (bd < .055) { perfect++; hits++; combo++; judge('Perfecto', LIMEH, true) } else if (bd < .11) { hits++; combo++; judge('Bien', PAPER, true) } else { miss++; combo = 0; red = 1; judge(signed < 0 ? 'Temprano' : 'Tarde', '#ff7a5c', false) }
      devs.push(Math.abs(signed)); bestCombo = Math.max(bestCombo, combo);
      if (hits >= NEED) { const avg = devs.reduce((a, b) => a + b, 0) / devs.length; finish({ hits, perfect, miss, bestCombo, avgMs: avg }, [['Golpes certeros', `${hits}`], ['Perfectos', `${perfect}`], ['Desviación media', Math.round(avg) + ' ms'], ['Mejor racha', `${bestCombo}`]]) }
    }
    else { combo = 0; tone(150, .07, 'sawtooth', .04); ftext(X, Y - 70, 'sin nota', '#a6a392', 15) }
  }
  function judge(txt, c, ok) { const X = hx(), Y = ly(); ftext(X, Y - 82, txt, c, 24); if (ok) { burst(X, Y, c, 18, 300, .6, 3); ringFx(X, Y, c, 40, 130, .5, 3); tone(sc[combo % sc.length], .14, 'triangle', .11); tone(sc[combo % sc.length] * 2, .1, 'sine', .04); shake(3); pulse = Math.max(pulse, .8) } else { tone(140, .1, 'sawtooth', .05); shake(2) } }
  return {
    camPos: new THREE.Vector3(0, 2.6, 9.2), camLook: new THREE.Vector3(0, 1.6, 0),
    build() {
      /* Keep functional invisible geometry for pulse effects */
      floorL = new THREE.Mesh(new THREE.BoxGeometry(22, .1, 3.2), mat(0x191a13, { roughness: 1, emissive: LIME, emissiveIntensity: 0 })); floorL.position.set(0, .05, 3); floorL.visible = false; roomGroup.add(floorL);
      pillars = []; for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(.5, 4, .5), mat(0x282a1f, { emissive: LIME, emissiveIntensity: 0 })); const a = -1.1 + i * .275; p.position.set(Math.sin(a) * 8, 2, -Math.cos(a) * 5 - 1); p.visible = false; roomGroup.add(p); pillars.push(p) }
      avatarObj.scale.setScalar(1.1);
      /* Room 2 FBX + lighting */
      placeFBX(2, roomGroup, 16, { roughness: 0.86, metalness: 0.09 }, () => roomGen);
    },
    start() { t = 0; notes = []; nt = 0; k = 0; nextClick = 0; hits = 0; perfect = 0; miss = 0; combo = 0; bestCombo = 0; devs = []; pulse = 0; red = 0; gen(); hint(TOUCH ? 'Escucha 4 clicks · toca cuando la nota cruce el círculo' : 'Escucha 4 clicks · luego Espacio / D / clic cuando la nota cruce el círculo') },
    onKey(c) { if (c === 'Space' || c === 'KeyD' || c === 'KeyK' || c === 'KeyF' || c === 'KeyJ') press() }, onDown() { press() },
    update(dt) {
      t += dt; gen(); while (t >= nextClick) { const n = Math.round(nextClick / B); tone(n % 4 === 0 ? 1760 : 1200, .035, 'square', .03); pulse = Math.max(pulse, .6); nextClick += B }
      for (const n of notes) { if (!n.done && t > n.t + .17) { n.done = true; miss++; combo = 0; red = 1; ftext(hx(), ly() - 82, 'Se fue', '#ff7a5c', 20); tone(110, .12, 'sawtooth', .04) } }
      while (notes.length && notes[0].done && notes[0].t < t - 1) notes.shift(); pulse = Math.max(0, pulse - dt * 3.5); red = Math.max(0, red - dt * 3);
      if (t >= B * 4) hint(`${hits} de ${NEED} golpes · racha ${combo}${notes.find(n => !n.done && n.off && n.t - t < 2) ? ' · fuera de la rejilla: sigue el click' : ''}`)
    },
    update3d(dt, t3) { pillars.forEach((p, i) => { p.material.emissiveIntensity = pulse * (.7 + .3 * Math.sin(i)) * 1.2; p.scale.y = 1 + pulse * .15 }); floorL.material.emissiveIntensity = pulse * .35; animAvatar(avatarObj, 0, t3, true, pulse); if (bloom) bloom.strength = .4 + pulse * .25; rimSet(2.2 + pulse * 3.5) },
    draw() {
      const X = hx(), Y = ly(), sp = spd(); ctx.save();
      if (red > 0) { ctx.fillStyle = `rgba(255,122,92,${red * .08})`; ctx.fillRect(0, 0, W, H) }
      ctx.strokeStyle = 'rgba(239,234,219,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W * .04, Y); ctx.lineTo(W * .97, Y); ctx.stroke();
      const b0 = Math.floor((t - .5) / B), b1 = Math.ceil((t + (W - X) / sp) / B); for (let n = Math.max(0, b0); n <= b1; n++) { const x = X + (n * B - t) * sp; if (x < W * .03 || x > W * .98) continue; ctx.strokeStyle = n % 4 === 0 ? 'rgba(239,234,219,.42)' : 'rgba(239,234,219,.17)'; ctx.lineWidth = n % 4 === 0 ? 3 : 2; ctx.beginPath(); ctx.moveTo(x, Y - 22); ctx.lineTo(x, Y + 22); ctx.stroke() }
      const pr = 46 + pulse * 8; ctx.globalCompositeOperation = 'lighter'; glowCircle(X, Y, pr * 2.2, `rgba(201,208,0,${.1 + pulse * .3})`, 'rgba(201,208,0,0)'); ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = 4; ctx.strokeStyle = LIMEH; ctx.beginPath(); ctx.arc(X, Y, pr, 0, 6.283); ctx.stroke();
      for (const n of notes) {
        if (n.done) continue; const x = X + (n.t - t) * sp; if (x > W * 1.02 || x < -40) continue; const near = Math.abs(n.t - t) < .11; ctx.save(); ctx.translate(x, Y); ctx.fillStyle = n.off ? LIMEH : PAPER; ctx.shadowColor = n.off ? LIMEH : PAPER; ctx.shadowBlur = near ? 30 : 12;
        if (n.off) { ctx.rotate(Math.PI / 4); ctx.fillRect(-17, -17, 34, 34) } else { ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.283); ctx.fill() } ctx.restore();
        if (n.off && x < W * .9) { ctx.fillStyle = 'rgba(201,208,0,.8)'; ctx.font = `italic 400 13px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('contratiempo', x, Y - 42) }
      }
      if (t < B * 4) { const n = 4 - Math.floor(t / B), f = 1 - ((t % B) / B); ctx.globalAlpha = .25 + f * .65; ctx.fillStyle = PAPER; ctx.font = `italic 800 ${150 + f * 50}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n, W / 2, H * .3); ctx.globalAlpha = 1 }
      for (let i = 0; i < NEED; i++) { const x = W / 2 + (i - (NEED - 1) / 2) * 26; ctx.fillStyle = i < hits ? LIMEH : 'rgba(239,234,219,.16)'; ctx.beginPath(); ctx.arc(x, Y + 120, 7, 0, 6.283); ctx.fill() }
      if (combo > 2) { ctx.fillStyle = PAPER; ctx.font = `italic 800 ${34 + Math.min(combo, 10) * 2}px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('x' + combo, X, Y + 190) }
      ctx.restore()
    }, stop() { }
  }
})();

/* ======================================================================
   SALA 3 · MI — la grabación real se parte en frases; tú decides cada respiración.
   ====================================================================== */
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

/* ======================================================================
   SALA 4 · FA — Stockhausen suena siempre; tu posición lo transforma y cada campo añade una capa.
   ====================================================================== */
export const FA = (() => {
  const zones = [{ x: -5.2, z: -2.6 }, { x: 5.4, z: -3.6 }, { x: .4, z: 5.0 }], ZR = 1.9, DW = 1.5, RM = 9.2, NAMES = ['I · grave', 'II · eco', 'III · brillo'];
  let pos = new THREE.Vector3(0, 0, 3.2), target = null, prog = [0, 0, 0], on = [false, false, false], pads = null, zObj = [], trail, tPos, tCol, tN = 0, discs = [], discI = 0, lastDrop = new THREE.Vector3(), path = [], dist = 0, doneT = 0, moving = false, startedMove = false, base = null, layers = [], real = false;
  const rc = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  return {
    noParallax: true,
    cam() { return { pos: new THREE.Vector3(pos.x * .8, 8.2, pos.z + 9.4), look: new THREE.Vector3(pos.x * .9, .8, pos.z * .9) } },
    build() {
      /* Keep functional overlays for zones, trail, etc. */
      const edge = new THREE.Mesh(new THREE.RingGeometry(RM, RM + .12, 96), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .3, side: THREE.DoubleSide })); edge.rotation.x = -Math.PI / 2; edge.position.y = .04; roomGroup.add(edge);
      zObj = zones.map((z, i) => {
        const g = new THREE.Group(); g.position.set(z.x, 0, z.z); const ring = new THREE.Mesh(new THREE.RingGeometry(ZR - .1, ZR, 64), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .85, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = .06; g.add(ring);
        const fill = new THREE.Mesh(new THREE.CircleGeometry(ZR - .1, 48), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); fill.rotation.x = -Math.PI / 2; fill.position.y = .05; g.add(fill);
        const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 9, 8, 1, true), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 4.5; g.add(beam);
        const lb = makeTextSprite(NAMES[i], '#efeadb', 4, 30, true); lb.position.y = 2; g.add(lb); roomGroup.add(g); return { ring, fill, beam, g }
      });
      tN = 0; tPos = new Float32Array(240 * 3); tCol = new Float32Array(240 * 3); const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tCol, 3)); trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .95 })); trail.frustumCulled = false; trail.geometry.setDrawRange(0, 0); roomGroup.add(trail);
      discs = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.28, 16), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); d.rotation.x = -Math.PI / 2; d.position.y = .07; roomGroup.add(d); discs.push(d) }
      roomGroup.add(makeDust(180, RM, 5, 0xf0eddc, .12));
      /* Room 4 FBX + dramatic body-aware lighting */
      placeFBX(4, roomGroup, 16, { roughness: 0.88, metalness: 0.08 }, () => roomGen);
    },
    start() {
      pos.set(0, 0, 3.2); target = null; prog = [0, 0, 0]; on = [false, false, false]; discI = 0; lastDrop.copy(pos); path = []; dist = 0; doneT = 0; startedMove = false; tN = 0; layers = []; base = null; pads = null; real = recOk(4);
      if (real) {
        let rate = 1; const mi = S.metrics[3];
        if (EXPERIMENT.miToFa && mi && !mi.skipped && mi.vals) { const avg = mi.vals.reduce((a, b) => a + b, 0) / mi.vals.length; rate = lerp(.94, 1.06, avg); toast('Tu fraseo en MI marca el pulso de esta sala') }
        base = Voice(4, { rate, lp: 6000, wet: .2 }); base.set({ gain: .95 });
        layers = [Voice(4, { rate: .5 * rate, lp: 600 }), Voice(4, { rate, delay: .42, lp: 3200, wet: .35 }), Voice(4, { rate: 2 * rate, hp: 1100, wet: .4 })];
      } else { pads = [pad([55, 82.41, 110], .13), pad([523.25, 659.25, 783.99], .03, 'triangle'), pad([220, 277.18, 329.63], .05, 'sine')]; pads.forEach(p => p.set(0)) }
      hint(TOUCH ? 'Usa el círculo o toca el suelo · entra a los 3 campos' : 'WASD para mover · o haz clic en el suelo · entra a los 3 campos')
    },
    onDown(e) { rc.setFromCamera(new THREE.Vector2(e.clientX / W * 2 - 1, -(e.clientY / H) * 2 + 1), camera); const p = new THREE.Vector3(); if (rc.ray.intersectPlane(plane, p)) { const r = Math.hypot(p.x, p.z); if (r > RM - .4) { p.x *= (RM - .4) / r; p.z *= (RM - .4) / r } target = p; ringFx(e.clientX, e.clientY, LIMEH, 6, 50, .5, 2) } },
    update(dt) {
      const { ix, iy } = moveInput(), d = new THREE.Vector3(ix, 0, -iy);
      const sprint = keys.has('ShiftLeft'), sp = sprint ? 8 : 5.4; moving = false;
      if (d.lengthSq() > .01) { target = null; pos.addScaledVector(d, sp * dt); moving = true; avatarObj.rotation.y = lerpAngle(avatarObj.rotation.y, Math.atan2(d.x, d.z), 1 - Math.exp(-14 * dt)) }
      else if (target) { const to = target.clone().sub(pos), l = to.length(); if (l < .2) target = null; else { to.normalize(); pos.addScaledVector(to, Math.min(l, sp * dt)); moving = true; avatarObj.rotation.y = lerpAngle(avatarObj.rotation.y, Math.atan2(to.x, to.z), 1 - Math.exp(-14 * dt)) } }
      const r = Math.hypot(pos.x, pos.z); if (r > RM - .4) { pos.x *= (RM - .4) / r; pos.z *= (RM - .4) / r }
      const gy = groundController.getHeight(pos.x, pos.z, pos.y, false);
      pos.y += clamp(gy - pos.y, -14 * dt, 14 * dt);
      avatarObj.position.copy(pos); if (moving) startedMove = true;
      if (pos.distanceTo(lastDrop) > .45) {
        dist += pos.distanceTo(lastDrop); lastDrop.copy(pos); path.push([+pos.x.toFixed(2), +pos.z.toFixed(2)]); const dd = discs[discI++ % discs.length]; dd.position.set(pos.x, .07, pos.z); dd.material.opacity = .8; dd.scale.setScalar(1);
        if (tN < 240) { tPos.set([pos.x, .09, pos.z], tN * 3); tN++ } else { tPos.copyWithin(0, 3); tPos.set([pos.x, .09, pos.z], 239 * 3) }
        for (let i = 0; i < tN; i++) { const f = i / Math.max(1, tN - 1); tCol[i * 3] = .35 + .4 * f; tCol[i * 3 + 1] = .36 + .4 * f; tCol[i * 3 + 2] = .1 } trail.geometry.attributes.position.needsUpdate = true; trail.geometry.attributes.color.needsUpdate = true; trail.geometry.setDrawRange(0, tN)
      }
      let nOn = 0; zones.forEach((z, i) => {
        const inside = Math.hypot(pos.x - z.x, pos.z - z.z) < ZR;
        if (!on[i]) { prog[i] = inside ? prog[i] + dt / DW : Math.max(0, prog[i] - dt * .5); if (prog[i] >= 1) { on[i] = true; prog[i] = 1; const s = toScreen(new THREE.Vector3(z.x, .5, z.z)); burst(s.x, s.y, LIMEH, 46, 380, 1, 4); ringFx(s.x, s.y, '#fff', 20, 200, .8, 3); shake(8); toast(`Campo ${NAMES[i]} encendido · una capa nueva`) } }
        if (on[i]) nOn++;
        if (real) { layers[i].set({ gain: on[i] ? .85 : prog[i] * .5 }) } else pads[i].set(on[i] ? 1 : prog[i] * .6)
      });
      const rr = Math.hypot(pos.x, pos.z) / RM;
      if (base) base.set({ lp: lerp(900, 14000, clamp((-pos.z + RM) / (2 * RM), 0, 1)), wet: lerp(.12, .55, rr), gain: .95 });
      if (A.pan) A.pan.pan.setTargetAtTime(clamp(pos.x / RM, -1, 1), A.ctx.currentTime, .1);
      hint(startedMove ? `Campos encendidos ${nOn} de 3 · quédate dentro hasta que el anillo se llene` : (TOUCH ? 'Usa el círculo o toca el suelo' : 'WASD para mover · o haz clic en el suelo'));
      if (nOn === 3) { doneT += dt; if (doneT > .9) finish({ path, dist }, [['Campos encendidos', '3 de 3'], ['Recorrido', dist.toFixed(0) + ' m'], ['Huellas inscritas', `${path.length}`]]) }
    },
    update3d(dt, t3) {
      zObj.forEach((o, i) => { const p = prog[i], done = on[i]; o.fill.material.opacity = p * .4; o.fill.scale.setScalar(.2 + p * .8); o.ring.material.color.setHex(done || p > 0 ? LIME : PALE); o.beam.material.color.setHex(done || p > 0 ? LIME : PALE); o.beam.material.opacity = .12 + p * .4; o.ring.rotation.z += dt * .5 });
      discs.forEach(d => { d.material.opacity = Math.max(0, d.material.opacity - dt * .35); d.scale.setScalar(Math.max(.2, d.scale.x - dt * .1)) }); animAvatar(avatarObj, moving ? 5.4 : 0, t3, false, A.lvl); if (bloom) bloom.strength = .6
    },
    draw() {
      const k = TOUCH ? .78 : 1, cx = W - 112 * k, cy = H - (TOUCH ? 250 : 200), r = 74 * k, s = r / RM; ctx.save(); ctx.fillStyle = 'rgba(13,14,9,.72)'; ctx.strokeStyle = 'rgba(201,208,0,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill(); ctx.stroke();
      zones.forEach((z, i) => { ctx.strokeStyle = on[i] ? LIMEH : 'rgba(239,234,219,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s, 0, 6.283); ctx.stroke(); if (prog[i] > 0 && !on[i]) { ctx.fillStyle = 'rgba(201,208,0,.35)'; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s * prog[i], 0, 6.283); ctx.fill() } if (on[i]) { ctx.fillStyle = 'rgba(201,208,0,.45)'; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s, 0, 6.283); ctx.fill() } });
      ctx.strokeStyle = 'rgba(239,234,219,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); path.slice(-120).forEach((p, i) => { const x = cx + p[0] * s, y = cy + p[1] * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.lineTo(cx + pos.x * s, cy + pos.z * s); ctx.stroke();
      ctx.fillStyle = LIMEH; ctx.beginPath(); ctx.arc(cx + pos.x * s, cy + pos.z * s, 4, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(239,234,219,.6)'; ctx.font = `italic 400 13px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('mapa · memoria', cx, cy + r + 17); ctx.restore()
    },
    stop() { }
  }
})();

/* ======================================================================
   SALA 5 · SOL — sin grabación en esta sala: sonido procedural (decisión de diseño actual).
   ====================================================================== */
export const SOL = (() => {
  const names = ['Muñeca I', 'Muñeca II', 'Cabeza'], HR = 1.0; let orbs = [], cap = [], hold = [0, 0, 0], core, rings = [], order = [], anch = [], pending = false;
  const v3 = new THREE.Vector3(); const proj = o => { o.getWorldPosition(v3); const p = v3.clone().project(camera); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H } };
  const anchors = () => { avatarObj.updateMatrixWorld(true); camera.updateMatrixWorld(); const j = avatarObj.userData.joints; return [proj(j.wl), proj(j.wr), proj(j.head)] };
  return {
    camPos: new THREE.Vector3(0, 2.4, 9), camLook: new THREE.Vector3(0, 2.1, 0),
    build() {
      avatarObj.scale.setScalar(1.5); avatarObj.position.set(0, 0, 1.5); core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), mat(0x15170f, { emissive: 0x4a5200, emissiveIntensity: .8, metalness: .4, roughness: .25 })); core.position.set(0, 3.2, -3); roomGroup.add(core);
      rings = []; for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(new THREE.TorusGeometry(2.1 + i * .4, .02, 6, 60), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xefeadb : LIME, transparent: true, opacity: .25 })); g.rotation.x = Math.random() * Math.PI; g.rotation.y = Math.random() * Math.PI; g.position.copy(core.position); roomGroup.add(g); rings.push(g) }
      /* Room 5 procedural cybernetic lighting */
    },
    start() {
      cap = [false, false, false]; hold = [0, 0, 0]; order = []; pending = false; orbs = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]; const p = pad([55, 110, 165], .09, 'sawtooth'); p.set(.5);
      hint(TOUCH ? 'Mantén el dedo sobre cada sensor hasta que el anillo se llene' : 'Mantén el cursor sobre cada sensor hasta que el anillo se llene');
      const a = anchors(); orbs.forEach((o, i) => { o.x = a[i].x + (i === 0 ? -W * .16 : i === 1 ? W * .16 : 0); o.y = a[i].y + (i === 2 ? -H * .15 : -H * .03) })
    },
    update(dt) {
      const a = anchors(); anch = a; let n = 0;
      orbs.forEach((o, i) => {
        const side = i === 0 ? -1 : i === 1 ? 1 : 0, bx = a[i].x + side * W * .16 + Math.sin(T * .9 + i * 2) * W * .025, by = a[i].y + (i === 2 ? -H * .17 : -H * .03) + Math.cos(T * .7 + i * 1.7) * H * .03;
        if (cap[i]) { o.x = damp(o.x, a[i].x, 5, dt); o.y = damp(o.y, a[i].y, 5, dt); n++ }
        else {
          o.x = damp(o.x, bx, 4, dt); o.y = damp(o.y, by, 4, dt); const inside = ptrActive() && Math.hypot(ptr.x - o.x, ptr.y - o.y) < (TOUCH ? 64 : 50);
          if (inside) { hold[i] += dt; if (Math.floor(hold[i] * 5) !== Math.floor((hold[i] - dt) * 5)) tone(300 + hold[i] * 400 + i * 80, .05, 'sine', .03) } else hold[i] = Math.max(0, hold[i] - dt * .8);
          if (hold[i] >= HR) { cap[i] = true; order.push(i); burst(o.x, o.y, LIMEH, 50, 420, 1, 4); ringFx(o.x, o.y, '#fff', 20, 200, .8, 3); shake(7); pluck([220, 330, 523][i], 0, .9, .1, A.master); hiss(.25, .06, 6000, 0, A.master); toast(names[i] + ' conectada') }
        }
      });
      avatarObj.userData.glowMat.emissiveIntensity = 1.5 + n * 1.2; hint(`Sensores conectados ${n} de 3`);
      if (n === 3 && !pending) { pending = true; setTimeout(() => finish({ order: [...order] }, [['Sensores', '3 de 3'], ['Orden de conexión', order.map(i => names[i]).join(' → ')]]), 900) }
    },
    update3d(dt, t3) { const n = cap.filter(Boolean).length; core.scale.setScalar(1 + n * .12 + Math.sin(t3 * 3) * .03); core.material.emissiveIntensity = .8 + n * 1.4; rings.forEach((r, i) => { r.rotation.z += dt * (.2 + i * .05) * (1 + n); r.material.opacity = .15 + n * .15 }); avatarObj.rotation.y = Math.sin(t3 * .4) * .25; animAvatar(avatarObj, 0, t3, true, n / 3); if (bloom) bloom.strength = .5 + n * .25 },
    draw() {
      orbs.forEach((o, i) => {
        if (!anch[i]) return; if (cap[i]) { bolt(o.x, o.y, anch[i].x, anch[i].y, LIMEH, 10, 16); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(anch[i].x, anch[i].y, 50, 'rgba(201,208,0,.5)', 'rgba(201,208,0,0)'); ctx.restore(); return }
        const p = hold[i] / HR, inside = ptrActive() && Math.hypot(ptr.x - o.x, ptr.y - o.y) < (TOUCH ? 64 : 50); ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(o.x, o.y, 70, `rgba(201,208,0,${.12 + p * .4})`, 'rgba(201,208,0,0)'); ctx.restore();
        ctx.strokeStyle = inside ? LIMEH : '#a6a392'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, 30 + Math.sin(T * 3 + i) * 2 + (inside ? 4 : 0), 0, 6.283); ctx.stroke(); ctx.fillStyle = `rgba(201,208,0,${.15 + p * .6})`; ctx.beginPath(); ctx.arc(o.x, o.y, 14, 0, 6.283); ctx.fill();
        if (p > 0) { ctx.strokeStyle = PAPER; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(o.x, o.y, 42, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); ctx.stroke(); ctx.lineCap = 'butt' }
        ctx.fillStyle = 'rgba(239,234,219,.7)'; ctx.font = `italic 400 14px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText(names[i], o.x, o.y + 64);
        if (ptrActive() && !inside && hold[i] === 0) { ctx.strokeStyle = 'rgba(201,208,0,.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(ptr.x, ptr.y); ctx.lineTo(o.x, o.y); ctx.stroke(); ctx.setLineDash([]) }
      });
      if (ptrActive()) { ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 5, 0, 6.283); ctx.fill(); ctx.strokeStyle = 'rgba(239,234,219,.5)'; ctx.beginPath(); ctx.arc(ptr.x, ptr.y, 12, 0, 6.283); ctx.stroke() }
    },
    stop() { }
  }
})();

/* ======================================================================
   SALA 6 · LA — fragmentos REALES de la grabación; intervenir = reensamblar (y, con cincel, invertir).
   ====================================================================== */
export const LA = (() => {
  const NAMES = ['Fragmento A', 'Fragmento B', 'Fragmento C', 'Fragmento D', 'Fragmento E', 'Fragmento F'];
  let bounds = [], wf = [], slots = [null, null, null, null], tray = [], cuts = new Map(), playing = false, listened = false, drag = null, ghost = null, chisel = false, papers = [], real = false, fbPad = null;
  // Cincel: 1 = invertido · 2 = tajo y separación (corta a la mitad, deja un silencio y la 2ª mitad vuelve al revés)
  function playFrag(i, when = 0, short = false) {
    const m = cuts.get(i) || 0, s = bounds[i], e = short ? Math.min(bounds[i + 1], s + 1.2) : bounds[i + 1];
    if (m === 1) return playClip(6, s, e, { when, reverse: true, rate: .9, wet: .3 });
    if (m === 2) { const mid = (s + e) / 2; let d = playClip(6, s, mid, { when, wet: .12 }); d += .32; d += playClip(6, mid, e, { when: when + d, reverse: true, wet: .35 }); return d }
    return playClip(6, s, e, { when, wet: .1 })
  }
  function status() { const n = slots.filter(s => s !== null).length; $('laStatus').textContent = `${n} de 4 espacios compuestos` + (cuts.size ? ` · ${cuts.size} intervenido${cuts.size > 1 ? 's' : ''}` : ''); $('laListen').disabled = n < 4 || playing || !real; $('laConfirm').style.display = (listened && !playing) || (!real && n === 4) ? 'block' : 'none' }
  function cardEl(i, asGhost) {
    const c = document.createElement('div'); c.className = 'lcard' + (cuts.has(i) ? ' cut' : '') + (!asGhost && drag && drag.i === i ? ' lifted' : ''); c.dataset.i = i; if (cuts.has(i)) c.dataset.tag = cuts.get(i) === 1 ? 'invertido' : 'tajo';
    c.innerHTML = `<strong>${NAMES[i]}</strong><img src="${wf[i]}" alt=""><div class="tiny">${fmt(bounds[i])} – ${fmt(bounds[i + 1])}</div>`; if (!asGhost) c.addEventListener('pointerdown', e => onCard(e, i)); return c
  }
  function render() {
    const fr = $('laFrame'); fr.innerHTML = ''; slots.forEach((c, i) => { const el = document.createElement('div'); el.className = 'slot' + (c !== null ? ' full' : ''); if (c === null) el.textContent = ['I', 'II', 'III', 'IV'][i]; else el.appendChild(cardEl(c)); fr.appendChild(el) });
    const tr = $('tray'); tr.innerHTML = ''; tray.forEach(c => tr.appendChild(cardEl(c))); status()
  }
  function slotEl(x, y) { return [...document.querySelectorAll('#laFrame .slot')].find(s => { const r = s.getBoundingClientRect(); return x > r.left - 14 && x < r.right + 14 && y > r.top - 14 && y < r.bottom + 14 }) }
  function removeFrom(i) { const si = slots.indexOf(i); if (si >= 0) slots[si] = null; const ti = tray.indexOf(i); if (ti >= 0) tray.splice(ti, 1) }
  function onCard(e, i) {
    if (S.phase !== 'play' || playing) return; e.preventDefault();
    if (chisel) { const n = ((cuts.get(i) || 0) + 1) % 3; if (n) cuts.set(i, n); else cuts.delete(i); hiss(.2, .08, 5000, 0, A.master); shake(n ? 5 : 2); burst(e.clientX, e.clientY, LIMEH, n ? 22 : 8, 260, .6, 3); toast(n === 1 ? 'Cincel · invertido' : n === 2 ? 'Cincel · tajo y separación' : 'Cincel · fragmento restaurado'); if (real && n) { stopClips(); playFrag(i, 0, true) } listened = false; render(); return }
    const r = e.currentTarget.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, ox = sx - r.left, oy = sy - r.top, pid = e.pointerId; let moved = false;
    ghost = cardEl(i, true); ghost.classList.add('drag'); ghost.style.width = r.width + 'px'; ghost.style.height = r.height + 'px';
    const mv = ev => {
      if (ev.pointerId !== pid) return; if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 7) { moved = true; document.body.appendChild(ghost); drag = { i }; render() }
      if (moved) { ghost.style.left = (ev.clientX - ox) + 'px'; ghost.style.top = (ev.clientY - oy) + 'px'; const s = slotEl(ev.clientX, ev.clientY); document.querySelectorAll('#laFrame .slot').forEach(x => x.classList.toggle('hover', x === s)) }
    };
    const up = ev => {
      if (ev.pointerId !== pid) return; removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (!moved) { ghost = null; if (real) { stopClips(); playFrag(i) } return } // toque = oír el fragmento
      const s = slotEl(ev.clientX, ev.clientY); ghost.remove(); ghost = null; drag = null;
      if (s) {
        const si = [...document.querySelectorAll('#laFrame .slot')].indexOf(s); const prev = slots[si]; removeFrom(i); if (prev !== null && prev !== i) tray.push(prev); slots[si] = i;
        burst(ev.clientX, ev.clientY, LIMEH, 16, 220, .5, 3); ringFx(ev.clientX, ev.clientY, LIMEH, 10, 80, .4, 2); ftext(ev.clientX, ev.clientY - 40, 'encaja', LIMEH, 18); if (real) { stopClips(); playFrag(i, 0, true) }
      }
      else { removeFrom(i); tray.push(i); tone(180, .08, 'triangle', .04, 0, A.master) }
      listened = false; render()
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up)
  }
  function play() {
    if (slots.some(s => s === null) || playing || !real) return; playing = true; status(); ensureAudio(); stopClips(); let t = 0; const els = [...document.querySelectorAll('#laFrame .slot')];
    slots.forEach((i, k) => { const d = playFrag(i, t); setTimeout(() => { els.forEach(x => x.classList.remove('playing')); els[k]?.classList.add('playing'); const rc = els[k]?.getBoundingClientRect(); if (rc) burst(rc.left + rc.width / 2, rc.top + rc.height / 2, LIMEH, 14, 200, .5, 3) }, t * 1000); t += d + .12 });
    hint('Escuchando tu reensamblaje…'); setTimeout(() => { document.querySelectorAll('#laFrame .slot').forEach(x => x.classList.remove('playing')); playing = false; listened = true; status(); hint('Puedes reordenar y volver a escuchar, o entregar la obra.') }, t * 1000 + 300)
  }
  return {
    camPos: new THREE.Vector3(0, 2.6, 9), camLook: new THREE.Vector3(0, 2, 0),
    build() {
      /* Keep floating paper planes as functional overlay (they animate) */
      papers = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.1), new THREE.MeshBasicMaterial({ color: i % 3 ? 0x25261d : 0x3b3f00, side: THREE.DoubleSide, transparent: true, opacity: .5 })); const a = i / 10 * Math.PI * 2; m.position.set(Math.cos(a) * 7, 2.4 + Math.sin(a * 2) * 1.4, Math.sin(a) * 7 - 2); m.rotation.y = -a; m.userData.a = a; roomGroup.add(m); papers.push(m) }
      avatarObj.position.set(0, 0, -1.5); avatarObj.scale.setScalar(1.1);
      /* Room 6 FBX + intense destructive lighting */
      placeFBX(6, roomGroup, 16, { roughness: 0.78, metalness: 0.16 }, () => roomGen);
    },
    start() {
      cuts = new Map(); playing = false; listened = false; drag = null; chisel = false; real = recOk(6);
      const reg = regionFor(6); bounds = splitRegion(6, reg.from, reg.to, 6); wf = [0, 1, 2, 3, 4, 5].map(i => wfImg(recPeaks(6, bounds[i], bounds[i + 1], 36)));
      slots = [null, null, null, null]; tray = [0, 1, 2, 3, 4, 5]; if (!real) { fbPad = pad([110, 165, 220], .05); fbPad.set(1) }
      $('laUI').style.display = 'block'; const cb = $('chiselBtn'); cb.style.display = S.mod.has('chisel') ? 'block' : 'none'; cb.classList.remove('on'); cb.classList.toggle('nudge', S.mod.has('chisel')); cb.textContent = '✂ Cincel'; if (S.mod.has('chisel')) setTimeout(() => { if (S.phase === 'play' && S.room === 6) toast('Cincel de Deconstrucción listo · actívalo para intervenir') }, 900);
      cb.onclick = () => { chisel = !chisel; cb.classList.remove('nudge'); cb.classList.toggle('on', chisel); cb.textContent = chisel ? '✂ Cincel activo' : '✂ Cincel'; hint(chisel ? 'Cincel activo: toca un fragmento · 1 toque invierte · 2 toques lo parte y separa · 3 lo restaura' : 'Toca un fragmento para oírlo · arrástralo al pentagrama') };
      $('laListen').onclick = play; $('laConfirm').onclick = () => finish({ slots: [...slots], cuts: cuts.size }, [['Secuencia', slots.map(i => NAMES[i].slice(-1)).join(' · ')], ['Fragmentos intervenidos', cuts.size ? `${cuts.size} (${[...cuts.values()].filter(v => v === 1).length} invertido · ${[...cuts.values()].filter(v => v === 2).length} tajo)` : '0']]);
      render(); hint(real ? 'Toca un fragmento para oírlo · arrástralo al pentagrama' : 'No encontré la grabación: modo provisional (compón la secuencia y entrégala)')
    },
    update() { }, update3d(dt, t3) { papers.forEach(p => { p.rotation.y += dt * .15; p.position.y = 2.4 + Math.sin(t3 * .6 + p.userData.a * 2) * .5 }); animAvatar(avatarObj, 0, t3, true, A.lvl); if (bloom) bloom.strength = .55 },
    draw() { }, stop() { $('laUI').style.display = 'none'; ghost?.remove(); ghost = null; stopClips() }
  }
})();
export const IMPL = { 1: DO, 2: RE, 3: MI, 4: FA, 5: SOL, 6: LA };