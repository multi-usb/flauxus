/* ======================================================================
   FLAUXUS — Sala 1 · DO — El sonido bello
   Control del aire: encuentra un sonido y sostén su claridad.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { recOk, Voice, pad, A } from '../AudioSystem.js';
import { roomGroup, avatarObj, bloom, makeDust, animAvatar, rimSet, ctx, W, H, burst, ringFx, glowCircle, LIME, LIMEH, PAPER, SERIF, clamp, lerp, damp, rand, TOUCH, ptr, keys, ptrActive, hint, finish, roomGen, T } from './context.js';

export const meta = {
  key: 'do',
  id: 1, note: 'DO4', short: 'DO', title: 'El sonido bello', desc: 'Control del aire: encuentra un sonido y sostén su claridad.', source: 'CPEBMov1.wav', audio: 'real', color: 0xc2fe0b, hex: '#c2fe0b', avatar: 'disciplined',
  goal: 'El sonido empieza velado, como detrás de una pared. Sopla y mantén la luz dentro del campo: se abre y se aclara. Llena el círculo.',
  ctl: [[['Mouse'], ['Dedo'], 'Sigue la luz que se mueve'], [['Clic', 'Espacio'], ['Mantén'], 'Mantén para soplar (con el dedo: mantenlo sobre la luz)']],
  light: {
    /* Fondo del nivel: #221e1d (ya no negro), compartido por las seis salas. */
    bg: 0x221e1d, fog: .020, exp: 1.05, env: .32, hemi: [0xf0e8d0, 0x2a281c, .38], key: { c: 0xffe8c0, i: 1.2, p: [8, 18, 10] }, rim: { c: 0xc2fe0b, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xffe8c0, e: 1.2, r: 5, p: [0, 5, -2] }, { c: 0xc2fe0b, e: .9, r: 5, p: [-3, 3, 4] }], spot: { c: 0xfff6e0, e: 1.3, r: 12, p: [0, 12, 0], t: [0, 0, 0], ang: .62, pen: .5 }
  },
  /* Huella de DO: cuatro aros que se abren con el aire sostenido. */
  motif(x, m, cx, cy, s) { for (let i = 1; i <= 4; i++) { x.globalAlpha = .95 / i; x.beginPath(); x.arc(cx, cy, s * .2 * i + Math.min(s * .1, (m.air || 0) * .6), 0, 6.283); x.stroke() } },
  /* Posición inicial en el escenario (preludio) */
  /* Posición inicial en el escenario (preludio) */
  start: { x: 0.0, y: 2.42, z: 4.2, yaw: Math.PI },
  preludeR: 15,
  nav: {
    cue: { x: 0.0, z: 0.9, y: 0.0 }, // DO4 (centrado, sin cambios)
    portal: { x: 0.0, y: 0.0, z: 0.0, scale: 1.0, rotY: 0 }
  },
  vo: {
    trigger: 'ENCONTRAR EL SONIDO',
    text: [
      {
        "t": "Construir un cuerpo disciplinado para la interpretación de música académica occidental implica un conflicto silencioso: una tensión entre la estandarización de la práctica y la demanda de ser yo, una artista única y original.",
        "src": "Carrusel 1 · lámina 1"
      }
    ],
    files: ['Voz_DO4']
  }
};

export const DO = (() => {
  const NEED = 8; let voice, stable = 0, air = 0, purity = 0, ang = 0, R = 60, inside = false, tgt = { x: 0, y: 0 }, ring3, col, dust, spark = 0, idle = 0, airT = 0, best = 0, tick = 0, real = false, fb = null;
  return {
    // Posición y objetivo de cámara elevados para la tarima (suelo en Y=2.42)
    camPos: new THREE.Vector3(0, 4.9, 8.0),
    camLook: new THREE.Vector3(0, 4.0, 0),
    build() {
      const floorY = 2.42;
      ring3 = new THREE.Mesh(new THREE.TorusGeometry(2.1, .04, 10, 96), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .4 })); ring3.rotation.x = Math.PI / 2; ring3.position.y = floorY + 1.5; roomGroup.add(ring3);
      col = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 14, 8), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); col.position.y = floorY + 7; roomGroup.add(col);
      dust = makeDust(300, 8, 7, 0xf0eddc, .14); dust.position.y = floorY; roomGroup.add(dust); avatarObj.scale.setScalar(1.15);
      /* Room 1 FBX + lighting */
      return placeFBX(1, roomGroup, 16, { roughness: 0.85, metalness: 0.08 }, () => roomGen);
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
      const bx = tgt.x, by = tgt.y; ctx.save(); ctx.globalCompositeOperation = 'lighter'; glowCircle(bx, by, R * 2.4, `rgba(194,254,11,${.1 + purity * .3})`, 'rgba(194,254,11,0)');
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(194,254,11,${.07 + purity * .1})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(bx, by, R * (1.4 + i * .55 + Math.sin(T * 2 + i) * .06 * (1 + purity)), 0, 6.283); ctx.stroke() } ctx.restore();
      ctx.lineWidth = 3; ctx.strokeStyle = inside ? LIMEH : 'rgba(194,254,11,.6)'; ctx.beginPath(); ctx.arc(bx, by, R, 0, 6.283); ctx.stroke();
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
