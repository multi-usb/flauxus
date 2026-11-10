/* ======================================================================
   FLAUXUS — Sala 4 · FA♯ — El cuerpo
   Tocar ocupando espacio: el movimiento modifica la música y deja memoria.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { createMagicTrail, createFloorRibbon } from '../engine/trail.js';
import { GX } from '../GameContext.js';
import { recOk, Voice, pad, A } from '../AudioSystem.js';
import { S, roomGroup, avatarObj, camera, bloom, makeDust, makeTextSprite, animAvatar, ctx, W, H, burst, ringFx, shake, toScreen, LIME, LIMEH, SERIF, PALE, EXPERIMENT, clamp, lerp, lerpAngle, TOUCH, keys, hint, toast, finish, moveInput, groundController, roomGen } from './context.js';

export const meta = {
  key: 'fa',
  id: 4, note: 'FA♯4', short: 'FA♯', title: 'El cuerpo', desc: 'Tocar ocupando espacio: el movimiento modifica la música y deja memoria.', source: 'Stockhausen.wav', audio: 'real', color: 0xc2fe0b, hex: '#c2fe0b', avatar: 'body',
  /* Altura de suelo y configuración espacial de FA */
  floorY: 1.80,
  start: { x: 0.0, y: 1.80, z: 4.2, yaw: Math.PI },
  preludeR: 14.0, // Radio del límite durante la narración (ajústalo al tamaño que desees)
  goal: 'La grabación suena todo el rato y tu posición la transforma. Quédate dentro de cada campo hasta que se encienda: cada uno añade una capa. Tu recorrido queda inscrito.',
  ctl: [[['W', 'A', 'S', 'D'], ['Círculo'], 'Mover el cuerpo'], [['Clic'], ['Toca'], 'Ir a un punto del suelo']],
  light: {
    /* Fondo del nivel: #221e1d (ya no negro), compartido por las seis salas. */
    bg: 0x221e1d, fog: .020, exp: 1.0, env: .28, hemi: [0xdfe8e4, 0x1c241e, .32], key: { c: 0xfff4dc, i: 1.0, p: [8, 18, 10] }, rim: { c: 0xc2fe0b, base: 2, k: 8 }, bloomT: .85,
    pts: [{ c: 0xff6633, e: 1.2, r: 5, p: [5, 5, -3] }, { c: 0x33ccff, e: 1.1, r: 5, p: [-5, 4, 4] }], spot: { c: 0xfff4dc, e: 1.2, r: 18, p: [0, 18, 5], t: [0, 0, 0], ang: 1.0, pen: .5 }
  },
  /* Huella de FA: el recorrido corporal inscrito en el espacio. */
  motif(x, m, cx, cy, s) { const pa = m.path || []; if (pa.length > 1) { x.beginPath(); pa.forEach((q, i) => { const px = cx + q[0] / 9.2 * s, py = cy + q[1] / 9.2 * s; if (i) x.lineTo(px, py); else x.moveTo(px, py) }); x.stroke() } },
  /* Calibración del atrio: círculo guía y aro del portal. */
  nav: {
    cue: { x: 1.87, z: -0.66, y: 0.0 }, // FA#4 (centro del pie de la escalera corta)
    portal: { x: 0.0, y: -0.5, z: 0.0, scale: 1.0, rotY: 2 }
  },
  vo: {
    trigger: 'HABITAR EL ESPACIO',
    text: [
      {
        "t": "Sobrevivimos buscando la propia voz sobre una técnica estandarizada, modificándonos para ella, muy rara vez modificando la obra para que se amolde a nosotras. Hablamos sobre nuestro cuerpo para reprocharle lo que no podemos hacer, pero dejamos de lado que la dimensión corporal no se agota en la técnica y que concientizar esto nos podría dotar de agencia.",
        "src": "Carrusel 1 · lámina 6"
      }
    ],
    files: ['Voz_FAs4']
  }
};

export const FA = (() => {
  // Coordenadas individuales para cada estación (X = horizontal, Z = profundidad)
  const zones = [
    { x: -8.67, z: 3.1 },   // I · grave   (Círculo Izquierdo)
    { x:  8.65, z: 2.3 },   // II · eco    (Círculo Derecho)
    { x:  -0.3, z: -10 }   // III · brillo (Círculo del Fondo)
  ];
  const ZR = 2.4, DW = 1.5, RM = 14.0, NAMES = ['I · grave', 'II · eco', 'III · brillo'];
  
  let pos = new THREE.Vector3(0, 0, 3.2), target = null, prog = [0, 0, 0], on = [false, false, false], pads = null, zObj = [], trail, tPos, tCol, tN = 0, discs = [], discI = 0, lastDrop = new THREE.Vector3(), path = [], dist = 0, doneT = 0, moving = false, startedMove = false, base = null, layers = [], real = false, magic = null, ribbon = null;
  const rc = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const getFloorY = () => meta.floorY ?? 1.80;
  const _camPos = new THREE.Vector3(), _camLook = new THREE.Vector3();
  return {
    noParallax: true,
    cam() {
      const fy = getFloorY();
      /* Celular en horizontal: con ~390 px de alto la avatar medía 50 px. La cámara se acerca sobre su línea de
         mirada en proporción al alto disponible (táctil, hasta un 22 %); en vertical y escritorio no cambia. */
      const k = TOUCH ? clamp(H / 560, .78, 1) : 1, lx = pos.x * .9, ly = fy + 0.8, lz = pos.z * .9;
      _camPos.set(lx + (pos.x * .8 - lx) * k, ly + (fy + 7.4 - ly) * k, lz + (pos.z + 9.4 - lz) * k);
      _camLook.set(lx, ly, lz);
      return { pos: _camPos, look: _camLook };
    },
    build() {
      const fy = getFloorY();
      /* Elementos funcionales del minijuego elevados a la altura de la tarima */
      const edge = new THREE.Mesh(new THREE.RingGeometry(RM, RM + .12, 96), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .3, side: THREE.DoubleSide })); edge.rotation.x = -Math.PI / 2; edge.position.y = fy + .04; roomGroup.add(edge);
      zObj = zones.map((z, i) => {
        const g = new THREE.Group();
        // Elevamos la base del grupo 10 cm sobre el piso para salvar el relieve del escenario
        g.position.set(z.x, fy + 0.10, z.z);

        const ringMat = new THREE.MeshBasicMaterial({
          color: PALE,
          transparent: true,
          opacity: 0.9,
          side: THREE.DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(ZR - .12, ZR, 64), ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03; // Queda a +13 cm sobre el piso
        g.add(ring);

        const fillMat = new THREE.MeshBasicMaterial({
          color: LIME,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1
        });
        const fill = new THREE.Mesh(new THREE.CircleGeometry(ZR - .12, 48), fillMat);
        fill.rotation.x = -Math.PI / 2;
        fill.position.y = 0.02; // Queda a +12 cm sobre el piso
        g.add(fill);

        const beam = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, 9, 8, 1, true), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .2, depthWrite: false, blending: THREE.AdditiveBlending }));
        beam.position.y = 4.5;
        g.add(beam);

        const lb = makeTextSprite(NAMES[i], '#efeadb', 4, 30, true);
        lb.position.y = 2.4;
        g.add(lb);

        roomGroup.add(g);
        return { ring, fill, beam, g };
      });
      tN = 0; tPos = new Float32Array(240 * 3); tCol = new Float32Array(240 * 3); const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tPos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(tCol, 3)); trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: .6 })); trail.frustumCulled = false; trail.geometry.setDrawRange(0, 0); roomGroup.add(trail);
      discs = []; for (let i = 0; i < 40; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(.28, 16), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); d.rotation.x = -Math.PI / 2; d.position.y = fy + .07; roomGroup.add(d); discs.push(d) }
      const dust = makeDust(180, RM, 5, 0xf0eddc, .12); dust.position.y = fy; roomGroup.add(dust);
      /* Estela mágica: partículas verdes que nacen del cuerpo al moverse y se disipan girando (engine/trail.js). */
      magic = createMagicTrail({ low: TOUCH }); roomGroup.add(magic.points);
      /* Cinta de recorrido sobre el piso (reemplaza la línea de 1 px): búfer fijo de 160 puntos, viva en el shader. */
      ribbon = createFloorRibbon({ max: 160 }); roomGroup.add(ribbon.mesh); trail.visible = false;
      /* Room 4 FBX + lighting (retornamos la promesa para sincronizar con la cortina negra) */
      return placeFBX(4, roomGroup, 16, { roughness: 0.88, metalness: 0.08 }, () => roomGen);
    },
    start() {
      const fy = getFloorY();
      pos.set(0, fy, 3.2); target = null; prog = [0, 0, 0]; on = [false, false, false]; discI = 0; lastDrop.copy(pos); path = []; dist = 0; doneT = 0; startedMove = false; tN = 0; layers = []; base = null; pads = null; real = recOk(4);
      plane.set(new THREE.Vector3(0, 1, 0), -fy);
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
        dist += pos.distanceTo(lastDrop); lastDrop.copy(pos); path.push([+pos.x.toFixed(2), +pos.z.toFixed(2)]); const dd = discs[discI++ % discs.length]; dd.position.set(pos.x, pos.y + .07, pos.z); dd.material.opacity = .8; dd.scale.setScalar(1);
        ribbon?.push(pos.x, pos.y + .06, pos.z);
        if (tN < 240) { tPos.set([pos.x, pos.y + .09, pos.z], tN * 3); tN++ } else { tPos.copyWithin(0, 3); tPos.set([pos.x, pos.y + .09, pos.z], 239 * 3) }
        for (let i = 0; i < tN; i++) { const f = i / Math.max(1, tN - 1); tCol[i * 3] = .35 + .4 * f; tCol[i * 3 + 1] = .36 + .4 * f; tCol[i * 3 + 2] = .1 } trail.geometry.attributes.position.needsUpdate = true; trail.geometry.attributes.color.needsUpdate = true; trail.geometry.setDrawRange(0, tN)
      }
      let nOn = 0; zones.forEach((z, i) => {
        const inside = Math.hypot(pos.x - z.x, pos.z - z.z) < ZR;
        if (!on[i]) { prog[i] = inside ? prog[i] + dt / DW : Math.max(0, prog[i] - dt * .5); if (prog[i] >= 1) { on[i] = true; prog[i] = 1; const s = toScreen(new THREE.Vector3(z.x, pos.y + .5, z.z)); burst(s.x, s.y, LIMEH, 46, 380, 1, 4); ringFx(s.x, s.y, '#fff', 20, 200, .8, 3); shake(8); toast(`Campo ${NAMES[i]} encendido · una capa nueva`) } }
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
      discs.forEach(d => { d.material.opacity = Math.max(0, d.material.opacity - dt * .35); d.scale.setScalar(Math.max(.2, d.scale.x - dt * .1)) });
      if (magic) { magic.emit(avatarObj.position, moving ? (keys.has('ShiftLeft') ? 8 : 5.4) : 0, dt); magic.update(dt, GX.renderer) }
      ribbon?.update(t3, .85 + Math.min(.6, (A.lvl || 0) * .6)); // la cinta late con el volumen de la música animAvatar(avatarObj, moving ? 5.4 : 0, t3, !moving, A.lvl); if (bloom) bloom.strength = .6
    },
    draw() {
      const k = TOUCH ? .78 : 1, cx = W - 112 * k, cy = H - (TOUCH ? 250 : 200), r = 74 * k, s = r / RM; ctx.save(); ctx.fillStyle = 'rgba(13,14,9,.72)'; ctx.strokeStyle = 'rgba(194,254,11,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.283); ctx.fill(); ctx.stroke();
      zones.forEach((z, i) => { ctx.strokeStyle = on[i] ? LIMEH : 'rgba(239,234,219,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s, 0, 6.283); ctx.stroke(); if (prog[i] > 0 && !on[i]) { ctx.fillStyle = 'rgba(194,254,11,.35)'; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s * prog[i], 0, 6.283); ctx.fill() } if (on[i]) { ctx.fillStyle = 'rgba(194,254,11,.45)'; ctx.beginPath(); ctx.arc(cx + z.x * s, cy + z.z * s, ZR * s, 0, 6.283); ctx.fill() } });
      ctx.strokeStyle = 'rgba(239,234,219,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); path.slice(-120).forEach((p, i) => { const x = cx + p[0] * s, y = cy + p[1] * s; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y) }); ctx.lineTo(cx + pos.x * s, cy + pos.z * s); ctx.stroke();
      ctx.fillStyle = LIMEH; ctx.beginPath(); ctx.arc(cx + pos.x * s, cy + pos.z * s, 4, 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(239,234,219,.6)'; ctx.font = `italic 400 13px ${SERIF}`; ctx.textAlign = 'center'; ctx.fillText('mapa · memoria', cx, cy + r + 17); ctx.restore()
    },
    stop() { }
  }
})();
