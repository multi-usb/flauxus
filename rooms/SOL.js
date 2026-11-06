/* ======================================================================
   FLAUXUS — Sala 5 · SOL♯ — El unicornio cyborg
   Cuerpo, sensor y máquina: captura los tres puntos y haz reaccionar el espacio.
   ====================================================================== */
import * as THREE from 'three';
import { placeFBX } from '../AssetManager.js';
import { pad, tone, pluck, hiss, A } from '../AudioSystem.js';
import { roomGroup, avatarObj, camera, bloom, mat, animAvatar, ctx, W, H, burst, ringFx, shake, glowCircle, bolt, LIME, LIMEH, PAPER, SERIF, damp, TOUCH, ptr, ptrActive, hint, toast, finish, T, roomGen } from './context.js';

/* Medidas tomadas del FBX de SOL tras el fit:
   - la plataforma principal queda a y≈0.234;
   - la terraza en espiral bajo la posición de juego (0, 1.5) tiene la cima
     a y≈0.358. */
const SOL_FLOOR = 0.234, SOL_DAIS = 0.358;

export const meta = {
  key: 'sol',
  id: 5, note: 'SOL♯4', short: 'SOL♯', title: 'El unicornio cyborg', desc: 'Cuerpo, sensor y máquina: captura los tres puntos y haz reaccionar el espacio.', source: 'sonido procedural · sin grabación', audio: 'none', color: 0xc9d000, hex: '#c9d000', avatar: 'cyborg',
  /* El suelo central del FBX queda a y≈0.23 tras el fit; el avatar y la
     cámara se elevan con él. SOL tiene terrazas a distintas alturas, así
     que el suelo se muestrea del propio escenario (`floorRay`) en vez de
     usar una única tarima: al subir la espiral las botas acompañan el
     desnivel y no quedan flotando ni hundidas. */
  floorY: 0.23,
  floorRay: true,
  start: { x: 0, y: SOL_FLOOR, z: 4.2, yaw: Math.PI },
  /* Antes 6.8: el paseo quedaba encerrado en el centro. 12.0 aprovecha las
     terrazas intermedias (radio visible ≈14.5) sin llegar al borde. */
  preludeR: 12.0,
  trigger: { x: 0, z: 0, r: 2.2 },
  /* La pose de juego se apoya en la cima de la terraza (0.358), no en la
     tarima baja. `plantFeet` corrige luego los pocos centímetros que el
     clip de idle mueve los tobillos. */
  gameAvatarPos: { x: 0, y: SOL_DAIS, z: 1.5, yaw: 0 },
  goal: 'Tres sensores flotan alrededor del cuerpo. Mantén el cursor (o el dedo) sobre cada uno hasta que el anillo se llene y se conecte.',
  ctl: [[['Mouse'], ['Dedo'], 'Seguir y mantener sobre el sensor']],
  light: {
    /* Fondo del nivel: #221e1d (ya no negro), compartido por las seis salas. */
    bg: 0x221e1d, fog: .024, exp: 1.0, env: .25, hemi: [0xdde4f0, 0x1a1e26, .3], key: { c: 0xe8f0ff, i: .8, p: [8, 16, 8] }, rim: { c: 0xc9d000, base: 2, k: 8 }, bloomT: .8,
    pts: [{ c: 0xc9d000, e: 2.0, r: 3.2, p: [0, 3.2, -3] }, { c: 0xaaccff, e: 1.0, r: 5, p: [4, 5, 2] }], spot: { c: 0xfffaec, e: 1.2, r: 14, p: [0, 14, 2], t: [0, 1.5, 0], ang: .9, pen: .5 }
  },
  /* Huella de SOL: el orden en que se conectaron los tres sensores. */
  motif(x, m, cx, cy, s) { const o = m.order || [0, 1, 2], P = [[cx - s * .7, cy + s * .5], [cx + s * .7, cy + s * .5], [cx, cy - s * .7]]; x.beginPath(); o.forEach((k, i) => { if (i) x.lineTo(P[k][0], P[k][1]); else x.moveTo(P[k][0], P[k][1]) }); x.stroke(); P.forEach(q => { x.beginPath(); x.arc(q[0], q[1], s * .1, 0, 6.283); x.fill() }) },
  /* Calibración del atrio: círculo guía y aro del portal. */
  nav: {
    cue: { x: -2.47, z: -1.82, y: 0.0 }, // SOL#4 (centro del pie de la escalera diagonal)
    portal: { x: 1.0, y: 0.2, z: 1.3, scale: 0.7, rotY: 10 }
  },
  vo: {
    trigger: 'CONECTAR EL CUERPO',
    text: [
      {
        "t": "Nadie me lo dijo explícitamente, tardé años en desenmarañar esa tensión incómoda y encontrar este conflicto iluminador. Ahora queda el vacío de entender que no importa qué haga, nunca estaré en gracia con todos. Entonces puedo hacer lo que quiera.",
        "src": "Carrusel 1 · lámina 8"
      }
    ],
    files: ['Voz_SOLs4']
  }
};

export const SOL = (() => {
  const names = ['Muñeca I', 'Muñeca II', 'Cabeza'], HR = 1.0; let orbs = [], cap = [], hold = [0, 0, 0], core, rings = [], order = [], anch = [], pending = false;
  const v3 = new THREE.Vector3(); const proj = o => { o.getWorldPosition(v3); const p = v3.clone().project(camera); return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H } };
  const anchors = () => { avatarObj.updateMatrixWorld(true); camera.updateMatrixWorld(); const j = avatarObj.userData.joints; return [proj(j.wl), proj(j.wr), proj(j.head)] };
  /* Apoyo fino de las botas. El clip idle sube y baja los tobillos unos
     4 cm; si la raíz se deja fija, en unas fases las botas flotan y en
     otras se hunden en la terraza. Se mide la punta del pie más baja y se
     corrige la raíz para que la suela quede exactamente sobre `fy`.
     `SOL_TOE_SOLE` es la distancia vertical medida, a escala 1.5, entre la
     base del dedo y la suela del cyborg (≈0.174 m). */
  const SOL_TOE_SOLE = .174;
  const _soleV3 = new THREE.Vector3();
  const soleNames = ['mixamorigLeftToeBase', 'mixamorigRightToeBase', 'mixamorigLeftFoot', 'mixamorigRightFoot'];
  function plantFeet(fy) {
    const u = avatarObj.userData;
    if (!u?.bones) return;
    let low = Infinity;
    for (const n of soleNames) {
      const b = u.bones.get(n);
      if (!b) continue;
      const y = b.getWorldPosition(_soleV3).y;
      if (y < low) low = y;
    }
    if (!isFinite(low)) return;
    /* rel es la altura del hueso respecto de la raíz; al recolocar la raíz
       la relación no cambia, así que la corrección es estable frame a frame. */
    const rel = low - avatarObj.position.y;
    avatarObj.position.y = fy - rel + SOL_TOE_SOLE;
  }
  return {
    camPos: new THREE.Vector3(0, 2.63, 9), camLook: new THREE.Vector3(0, 2.33, 0),
    build() {
      const fy = meta.floorY ?? 0, gp = meta.gameAvatarPos;
      avatarObj.scale.setScalar(1.5);
      /* La terraza de juego está elevada: colocar la raíz en la cima evita
         que las botas nazcan dentro de la espiral mientras carga la sala. */
      avatarObj.position.set(gp.x, gp.y ?? fy, gp.z);
      core = new THREE.Mesh(new THREE.SphereGeometry(1.7, 28, 20), mat(0x15170f, { emissive: 0x4a5200, emissiveIntensity: .8, metalness: .4, roughness: .25 })); core.position.set(0, fy + 3.2, -3); roomGroup.add(core);
      rings = []; for (let i = 0; i < 9; i++) { const g = new THREE.Mesh(new THREE.TorusGeometry(2.1 + i * .4, .02, 6, 60), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xefeadb : LIME, transparent: true, opacity: .25 })); g.rotation.x = Math.random() * Math.PI; g.rotation.y = Math.random() * Math.PI; g.position.copy(core.position); roomGroup.add(g); rings.push(g) }
      /* Escenario real de SOL: plataforma circular de terrazas. */
      return placeFBX(5, roomGroup, 16, { roughness: .9, metalness: .05 }, () => roomGen);
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
      avatarObj.userData.glowBase = 1.5 + n * 1.2; hint(`Sensores conectados ${n} de 3`);
      if (n === 3 && !pending) { pending = true; setTimeout(() => finish({ order: [...order] }, [['Sensores', '3 de 3'], ['Orden de conexión', order.map(i => names[i]).join(' → ')]]), 900) }
    },
    update3d(dt, t3) { const n = cap.filter(Boolean).length; core.scale.setScalar(1 + n * .12 + Math.sin(t3 * 3) * .03); core.material.emissiveIntensity = .8 + n * 1.4; rings.forEach((r, i) => { r.rotation.z += dt * (.2 + i * .05) * (1 + n); r.material.opacity = .15 + n * .15 }); avatarObj.rotation.y = Math.sin(t3 * .4) * .25; animAvatar(avatarObj, 0, t3, true, n / 3); plantFeet(meta.gameAvatarPos?.y ?? meta.floorY ?? 0); if (bloom) bloom.strength = .5 + n * .25 },
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
