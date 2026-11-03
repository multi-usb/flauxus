/* ======================================================================
   FLAUXUS — Sala 2 · RE — El pulso
   Marca el pulso, escucha el click y desplázate fuera de la rejilla.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { tone } from '../AudioSystem.js';
import { S, roomGroup, avatarObj, bloom, mat, animAvatar, rimSet, ctx, W, H, burst, ringFx, ftext, shake, glowCircle, LIME, LIMEH, PAPER, SERIF, TOUCH, hint, finish, roomGen } from './context.js';

export const meta = {
  key: 're',
  id: 2, note: 'RE4', short: 'RE', title: 'El pulso', desc: 'Marca el pulso, escucha el click y desplázate fuera de la rejilla.', source: 'sonido provisional', audio: 'pending', color: 0xc9d000, hex: '#c9d000', avatar: 'disciplined',
  goal: 'Toca cuando cada nota cruce el círculo. Al principio caen sobre la rejilla; después se salen: sigue el click, no las marcas. 12 golpes.',
  ctl: [[['Espacio', 'D', 'Clic'], ['Toca'], 'Tocar el pulso']],
  light: {
    bg: 0x100d0a, fog: .022, exp: 1.0, env: .28, hemi: [0xffe0c0, 0x241a12, .3], key: { c: 0xffd9b0, i: 1.0, p: [6, 16, 9] }, rim: { c: 0xc9d000, base: 2.2, k: 8 }, bloomT: .82,
    pts: [{ c: 0xff9944, e: 1.3, r: 5, p: [5, 4, -3] }, { c: 0xc9d000, e: 1.0, r: 5, p: [-5, 3, 2] }], spot: { c: 0xffeedd, e: 1.3, r: 14, p: [0, 14, 3], t: [0, 0, 0], ang: .78, pen: .6 }
  },
  /* Huella de RE: los golpes certeros y las notas que se escaparon. */
  motif(x, m, cx, cy, s) { const n = Math.min(24, (m.hits || 0) + (m.miss || 0)); for (let i = 0; i < n; i++) { const ok = i < (m.hits || 0); x.globalAlpha = ok ? 1 : .35; x.beginPath(); x.arc(cx - s * .9 + i * (s * 1.8 / Math.max(1, n - 1)), cy + (ok ? 0 : s * .22), s * (ok && i < (m.perfect || 0) ? .09 : .05), 0, 6.283); x.fill() } },
  /* Calibración del atrio: círculo guía, aro del portal y tramo recto bloqueado. */
  nav: {
    cue: { x: 8.0, z: -3.05, y: 0.0 }, // RE4 (pie del tramo corto de la escalera en L)
    portal: { x: 0.0, y: 0.5, z: 0.01, scale: 1.0, rotY: 7 }, // RE4 intacto
    blockedStair: { index: 1, x: [-1.4, 0.85], z: [-3.3, -0.20], minY: 1.32 } // el suelo plano del atrio nunca se bloquea
  },
  vo: {
    trigger: 'JUGAR CON EL PULSO',
    text: [],
    files: []
  }
};

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
