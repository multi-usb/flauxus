/* ======================================================================
   FLAUXUS — player.js
   Jugador en tercera persona: movimiento, física de rampas, cámara,
   picking del atrio, guía de luz y piloto automático.
   El flujo de salas entra por callback para no crear un ciclo.
   ====================================================================== */
import * as THREE from 'three';
import { S, nextRoomId } from './core/state.js';
import { PRELUDE } from './core/config.js';
import { $, clamp, lerp, damp, lerpAngle, TOUCH, LIME, PALE, V3 } from './core/util.js';
import { T } from './core/time.js';
import { keys, ptr } from './core/inputState.js';
import { A, tone } from './AudioSystem.js';
import {
  NAV, SPAWN, navY, setNavY, placeAtSpawn, navIdx, navCX, navCZ, navFree,
  navFloor, navSoft, navNode, navPath, navRampY, navPick
} from './NavMesh.js';
import { rooms } from './core/state.js';
import { world, scene, roomGroup, camera } from './engine/renderer.js';
import { W, H, getShake } from './engine/fx.js';
import { lightingManager } from './engine/lighting.js';
import { avatarObj, animAvatar } from './engine/avatar.js';
import { groundController, getAtriumFBXObj } from './engine/ground.js';
import { stairGroups, portalObjects, atriumFloor, floatingBlocks, updateFloatingBlocks } from './atrium/atrium.js';
import { toast } from './ui/toast.js';

/* Callbacks inyectados por Main.js para evitar player ↔ flow. */
let _enterRoom = () => { };
export function setPlayerCallbacks(cb) { if (cb.enterRoom) _enterRoom = cb.enterRoom }

/* ======================================================================
   CÁMARA + MOVIMIENTO (tercera persona, sin arrastrar el mouse)
   · La cámara sigue al avatar y se reorienta sola hacia donde caminas.
   · W/S avanzar·retroceder, A/D girar·desplazar, Shift correr. ←/→ ajustan la cámara.
   · Clic/toque en el suelo: el avatar camina solo. «Ir a la siguiente sala» (C) lo lleva hasta el portal.
   · Táctil: joystick izquierdo + botón ⟳ para girar la vista (opcional). Nunca hay que arrastrar la cámara.
   ====================================================================== */
export const rig = { yaw: Math.PI, pitch: -.12, dist: 5.6, height: 2.5, look: 2.8, hold: 0 }; // hold: segundos sin auto-orientar tras mover la cámara a mano
export const player = new V3(SPAWN.x, SPAWN.y, SPAWN.z), vel = new V3(), fwd = new V3(), rgt = new V3();
let stepPh = 0, heading = Math.PI;
// Físicas de salto y caída
let velY = 0, isGrounded = false;
const GRAVITY = 26.0, JUMP_FORCE = 8.8;

export function resetPlayerPhysics() { vel.set(0, 0, 0); velY = 0; isGrounded = false }
export function tryJump() {
  if (!isGrounded) return false;
  velY = JUMP_FORCE; isGrounded = false;
  if (A.ctx) tone(420, .1, 'triangle', .05, 0, A.master);
  return true
}
export function setLookHold(v) { lookHold = !!v }

const joy = { x: 0, y: 0, id: null, cx: 0, cy: 0, R: 52 };
function joyMove(e) { let dx = e.clientX - joy.cx, dy = e.clientY - joy.cy; const l = Math.hypot(dx, dy); if (l > joy.R) { dx *= joy.R / l; dy *= joy.R / l } $('joyKnob').style.transform = `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px))`; joy.x = dx / joy.R; joy.y = -dy / joy.R }
const joyEl = $('joy');
joyEl.addEventListener('pointerdown', e => { joy.id = e.pointerId; joyEl.setPointerCapture(e.pointerId); const r = joyEl.getBoundingClientRect(); joy.cx = r.left + r.width / 2; joy.cy = r.top + r.height / 2; joyMove(e) });
joyEl.addEventListener('pointermove', e => { if (e.pointerId === joy.id) joyMove(e) });
const joyEnd = e => { if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joyKnob').style.transform = 'translate(-50%,-50%)' } };
joyEl.addEventListener('pointerup', joyEnd); joyEl.addEventListener('pointercancel', joyEnd);

export function moveInput() {
  let ix = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0), iy = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  ix = clamp(ix + joy.x, -1, 1); iy = clamp(iy + joy.y, -1, 1); const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l } return { ix, iy }
}

/* ---------- Suelo, colisión y rutas: todo en el espacio FIJO de cada escalera (sin deriva) ---------- */
const STEP = .9;
export function stairLocal(g, x, z) { const u = g.userData, dx = x - g.position.x, dz = z - g.position.z; return { x: dx * u.cs - dz * u.sn, z: dx * u.sn + dz * u.cs } }
export function stairWorld(g, lx, lz) { const u = g.userData; return { x: g.position.x + lx * u.cs + lz * u.sn, z: g.position.z - lx * u.sn + lz * u.cs } }
function stairSurface(l) {
  // Rampa extendida y ancha para que no tropiece con los bordes de los escalones
  if (Math.abs(l.x) < 2.6 && l.z <= 1.4 && l.z >= -8.5) {
    const t = clamp((1.0 - l.z) / 7.8, 0, 1);
    return { y: 1.35 + t * 4.05, solid: true };
  }
  return null;
}
export function surfaceAt(x, z, py) {
  let best = null, bd = Infinity;
  for (const g of stairGroups) {
    const s = stairSurface(stairLocal(g, x, z)); if (!s) continue;
    const y = s.y + g.position.y * clamp((s.y - 1.35) / 4, 0, 1), d = Math.abs(y - py);
    // Permite subir la rampa sin interrupciones
    if (s.solid && y - py > 1.8 && py < 1.0) return { blocked: true };
    if (d <= STEP && d < bd) { bd = d; best = { y, g } }
  }
  return best;
}
groundController.surfaceAt = surfaceAt; // el controlador de suelo usa las rampas del atrio

const GC = .5, GM = 112, GO = -28; let GRID = null;
export function groundBlocked(x, z) {
  if (x * x + z * z > 720) return true;
  for (const g of stairGroups) {
    const l = stairLocal(g, x, z);
    if (Math.abs(l.x) < 2.0 && l.z < .85 && l.z > -7.8) return true;
  }
  return false;
}
export function buildGrid() { GRID = new Uint8Array(GM * GM); for (let j = 0; j < GM; j++)for (let i = 0; i < GM; i++)GRID[j * GM + i] = groundBlocked(GO + (i + .5) * GC, GO + (j + .5) * GC) ? 1 : 0 }
const gi = v => Math.floor((v - GO) / GC);
function losClear(a, b) { const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .25)); for (let k = 0; k <= n; k++) { const t = k / n; if (groundBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false } return true }
export function groundPath(a, b) { // A* sobre rejilla de 0,5 m + suavizado por línea de vista
  if (!GRID) buildGrid();
  if (losClear(a, b)) return [{ x: b.x, z: b.z }];
  const sI = clamp(gi(a.x), 0, GM - 1), sJ = clamp(gi(a.z), 0, GM - 1); let tI = clamp(gi(b.x), 0, GM - 1), tJ = clamp(gi(b.z), 0, GM - 1);
  if (GRID[tJ * GM + tI]) { let f = null; for (let r = 1; r < 8 && !f; r++)for (let dj = -r; dj <= r && !f; dj++)for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const ii = tI + di, jj = tJ + dj; if (ii >= 0 && jj >= 0 && ii < GM && jj < GM && !GRID[jj * GM + ii]) { f = [ii, jj]; break } } if (!f) return null; tI = f[0]; tJ = f[1] }
  const N = GM * GM, gs = new Float32Array(N).fill(1e9), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N), heap = [];
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break;[heap[p], heap[i]] = [heap[i], heap[p]]; i = p } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (; ;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break;[heap[m], heap[i]] = [heap[i], heap[m]]; i = m } } return top[1] };
  const h = (i, j) => Math.hypot(i - tI, j - tJ), s0 = sJ * GM + sI, t0 = tJ * GM + tI; gs[s0] = 0; push(s0, h(sI, sJ)); let found = false;
  while (heap.length) {
    const k = pop(); if (closed[k]) continue; closed[k] = 1; if (k === t0) { found = true; break }
    const ki = k % GM, kj = (k / GM) | 0;
    for (let dj = -1; dj <= 1; dj++)for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue; const ni = ki + di, nj = kj + dj; if (ni < 0 || nj < 0 || ni >= GM || nj >= GM) continue; const nk = nj * GM + ni; if (GRID[nk] || closed[nk]) continue;
      if (di && dj && (GRID[kj * GM + ni] || GRID[nj * GM + ki])) continue;
      const ng = gs[k] + (di && dj ? 1.414 : 1); if (ng < gs[nk]) { gs[nk] = ng; came[nk] = k; push(nk, ng + h(ni, nj)) }
    }
  }
  if (!found) return null;
  const raw = []; for (let k = t0; k !== -1; k = came[k])raw.push({ x: GO + (k % GM + .5) * GC, z: GO + (((k / GM) | 0) + .5) * GC }); raw.reverse();
  const out = []; let anchor = { x: a.x, z: a.z }, idx = 0;
  while (idx < raw.length) { let far = idx; for (let q = raw.length - 1; q > idx; q--) { if (losClear(anchor, raw[q])) { far = q; break } } out.push(raw[far]); anchor = raw[far]; idx = far + 1 }
  if (!groundBlocked(b.x, b.z)) out[out.length - 1] = { x: b.x, z: b.z };
  return out
}
const stairUp = (g, l) => {
  const w = [];
  if (l.z > .4) w.push(stairWorld(g, 0, .4));
  if (l.z > -3.4) w.push(stairWorld(g, 0, -3.4));
  w.push(stairWorld(g, 0, -6.8));
  return w;
};
const stairDown = (g, l) => {
  const w = [];
  if (l.z < -3.4) w.push(stairWorld(g, 0, -3.4));
  w.push(stairWorld(g, 0, 1.6));
  return w;
};

/* Piloto automático: lo usan «clic para ir», «Ir a la siguiente sala» y la auto-subida */
let auto = null, lookHold = false, navStuck = 0;
export function startAuto(pts, o = {}) { if (!pts || !pts.length) return false; auto = { pts, i: 0, t: 0, stuck: 0, back: 0, dx: 0, dz: 0, ride: !!o.ride, enter: o.enter || 0, mark: o.mark || null }; return true }
export function stopAuto() { auto = null }
export function walkTo(dest) { // dest: {g} → hasta la plataforma de esa escalera · {x,z} → punto del suelo
  if (NAV.ready) { const from = { x: player.x, z: player.z, y: navY }, tg = dest.g ? dest.g.userData.top : dest, pts = navPath(from, tg); if (!pts) return false; const last = pts[pts.length - 1]; return startAuto(pts, { enter: dest.enter && dest.g ? dest.g.userData.roomId : 0, mark: { x: last.x, y: last.y + .08, z: last.z } }) }
  const here = surfaceAt(player.x, player.z, player.y), onStair = player.y > .8 && here && here.g; let pts = [], from = { x: player.x, z: player.z };
  const topMark = g => { const q = stairWorld(g, 0, -6.8); return { x: q.x, y: g.position.y + 5.2, z: q.z } };
  if (onStair) {
    const l = stairLocal(here.g, player.x, player.z);
    if (dest.g === here.g) return startAuto(stairUp(here.g, l), { mark: topMark(here.g) });
    pts = stairDown(here.g, l); from = pts[pts.length - 1]
  }
  const tgt = dest.g ? stairWorld(dest.g, 0, 1.6) : { x: dest.x, z: dest.z };
  const gp = groundPath(from, tgt); if (!gp) return false; pts = pts.concat(gp);
  if (dest.g) pts = pts.concat(stairUp(dest.g, { x: 0, z: 1.6 }));
  return startAuto(pts, { mark: dest.g ? topMark(dest.g) : { x: gp[gp.length - 1].x, y: .08, z: gp[gp.length - 1].z } })
}
export function walkNext() { if (S.phase !== 'atrium') return; const t = nextRoomId(); if (!t || S.nearby === t) return; if (!walkTo({ g: stairGroups[t - 1], enter: true })) toast('No encuentro el camino · camina con el círculo o WASD') }
function gateWorld(g, out = new V3()) { return g.userData.gate.getWorldPosition(out) }
const _pq = new V3();
// Cache nearestPortal result to avoid 6 getWorldPosition calls per frame
let _nearestPortalFrame = -1, _nearestPortalCache = 0;
function nearestPortal() {
  if (_nearestPortalFrame === T) return _nearestPortalCache;
  _nearestPortalFrame = T;
  let best = 0, bd = Infinity;
  for (const g of portalObjects) { const q = gateWorld(g, _pq); const d = Math.hypot(player.x - q.x, player.z - q.z), dy = Math.abs(player.y - (q.y - (g.userData.gateDY ?? 1.3))); if (d < bd && dy < (g.userData.measured ? 1.5 : 2.8)) { bd = d; best = g.userData.roomId } }
  _nearestPortalCache = bd < (NAV.ready && NAV.info?.ok ? 4.2 : 5.0) ? best : 0;
  return _nearestPortalCache;
}

/* ---- estado auxiliar del atrio: DOM cacheado, cámara con colisión, guía sin asignaciones, auto-entrada ---- */
const DOM = { arrow: $('cmpArrow'), lbl: $('cmpLabel'), mk: document.querySelector('#compass .mk') };
const setTxt = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s } };
let camK = 1, camDt = .016, pendEnter = null, guideHidden = false, gpn = 0;
const GPMAX = 512, gpx = new Float32Array(GPMAX), gpy = new Float32Array(GPMAX), gpz = new Float32Array(GPMAX), gcum = new Float32Array(GPMAX);
let viewY = 0, camY = 0; // alturas SUAVIZADAS (avatar / cámara): subir escalones se ve como rampa, no como golpes
export function setCamDt(dt) { camDt = dt }
export function updateCam() {
  fwd.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)); const tg = new V3(player.x, camY + 1.2, player.z); const look = new V3(tg.x + fwd.x * rig.look, tg.y + Math.sin(rig.pitch) * 3.1, tg.z + fwd.z * rig.look);
  /* la cámara no atraviesa arcos ni escaleras: se acorta el brazo según la ocupación del NavMesh (8 muestras) */
  const cy = camY + rig.height + rig.pitch * 1.4, ty = camY + 1.2; let k = 1;
  if (NAV.ready && S.phase === 'atrium') {
    for (let s = 1; s <= 8; s++) {
      const f = s / 8, yy = lerp(ty, cy, f), c = navIdx(player.x - fwd.x * rig.dist * f, player.z - fwd.z * rig.dist * f);
      if (c >= 0 && !navFree(NAV.occ, c, yy - .15, yy + .15)) { k = Math.max(.3, (s - 1) / 8); break }
    }
  }
  camK = damp(camK, k, k < camK ? 14 : 2.5, camDt);
  camera.position.set(player.x - fwd.x * rig.dist * camK, lerp(ty, cy, camK), player.z - fwd.z * rig.dist * camK); camera.lookAt(look)
}

let guideT = 0, guideFor = 0, guideLen = 0, guideRoute = null; const guideFrom = { x: 1e9, z: 1e9 };
function refreshGuide(g, tid) { // ruta real (NavMesh o A* nativo) hacia la escalera; se pide poco y se mide el costo
  const t0 = performance.now(); guideFor = tid; guideFrom.x = player.x; guideFrom.z = player.z; let pts = null;
  if (NAV.ready) pts = navPath({ x: player.x, z: player.z, y: navY }, g.userData.top);
  else { const gp = groundPath({ x: player.x, z: player.z }, stairWorld(g, 0, 1.6)); if (gp) pts = gp.map(p => ({ x: p.x, z: p.z, y: player.y })) }
  guideRoute = pts && pts.length ? pts : null; guideT = performance.now() - t0 > 8 ? 1.5 : .5
}
function buildGuidePts() { // sin asignaciones por frame (arrays tipados) y descartando waypoints ya recorridos
  if (!guideRoute) { gpn = 0; guideLen = 0; return }
  while (guideRoute.length > 1) { const a = guideRoute[0], b = guideRoute[1]; if (Math.hypot(player.x - b.x, player.z - b.z) < Math.hypot(a.x - b.x, a.z - b.z)) guideRoute.shift(); else break }
  gpx[0] = player.x; gpy[0] = player.y; gpz[0] = player.z; gcum[0] = 0; gpn = 1; guideLen = 0;
  for (let i = 0; i < guideRoute.length && gpn < GPMAX; i++) { const p = guideRoute[i], j = gpn - 1; guideLen += Math.hypot(p.x - gpx[j], p.y - gpy[j], p.z - gpz[j]); gpx[gpn] = p.x; gpy[gpn] = p.y; gpz[gpn] = p.z; gcum[gpn++] = guideLen }
}

/* ======================================================================
   ACTUALIZACIÓN DEL ATRIO
   ====================================================================== */
const GN = 22, guide = new THREE.InstancedMesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIME }), GN); guide.frustumCulled = false; world.add(guide);
const dummy = new THREE.Object3D();
export { GN, guide, dummy };

export function updateAtrium(dt) {
  const on = S.phase === 'atrium', pre = S.phase === 'prelude';

  // Animar el giro y la flotación continua de los bloques
  if (world.visible && floatingBlocks.length) {
    updateFloatingBlocks(T);
  }

  stairGroups.forEach(g => {
    const u = g.userData, ph = u.phase; if (!world.visible) return; // dentro de una sala el atrio no se anima
    if (!u.measured) g.position.y = Math.sin(T * .68 + ph) * .1; // sólo la geometría provisional (sin FBX): el anillo de luz queda fijo, alineado con el arco
    const done = S.completed.has(u.roomId), isT = nextRoomId() === u.roomId;

    u.gate.material.opacity = .7 + .2 * Math.sin(T * 1.5 + ph);
    u.gate.rotation.z += dt * (isT ? 3.5 : 1.2);
    if (u.gate.parent && u.gate.parent.children[1]) {
      u.gate.parent.children[1].rotation.z -= dt * 4.5; // Gira las chispas en sentido opuesto
    }

    u.halo.material.opacity = isT ? .55 + .3 * Math.sin(T * 3) : done ? .35 : .15;
    u.beam.material.opacity = isT ? .16 + .06 * Math.sin(T * 3) : .04;
    u.gate.material.color.setHex(done || isT ? LIME : PALE); u.check.visible = done; if (u.labels) u.labels.note.visible = u.labels.sub.visible = S.nearby !== u.roomId; // el aviso «Entrar» ya nombra la sala
    /* (los peldaños son invisibles: ya no se les anima el material) */
    u.cue.material.opacity = isT ? .5 + .4 * Math.sin(T * 4) : .2; u.cue.scale.setScalar(isT ? 1 + .15 * Math.sin(T * 4) : 1)
  });
  lightingManager.gate(stairGroups, nextRoomId(), T);
  if (on || pre) {
    if (keys.has('ArrowLeft') || lookHold) rig.yaw += 1.9 * dt; if (keys.has('ArrowRight')) rig.yaw -= 1.9 * dt;
    const mi = moveInput(), mag = Math.hypot(mi.ix, mi.iy); fwd.set(Math.sin(rig.yaw), 0, Math.cos(rig.yaw)); rgt.set(-Math.cos(rig.yaw), 0, Math.sin(rig.yaw));
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight'); let sp = sprint ? 9.6 : 6.2, wx = fwd.x * mi.iy + rgt.x * mi.ix, wz = fwd.z * mi.iy + rgt.z * mi.ix;
    // C3 · auto-subida universal: detecta la proximidad al círculo indicador (cue) de cada escalera
    if (on && !auto && mag > .3 && player.y < (NAV.ready ? NAV.yg + 1.2 : 2.0)) {
      for (const g of stairGroups) {
        const u = g.userData;
        const cp = u.cue ? u.cue.position : new V3(0, 0, .9);
        const worldCue = g.localToWorld(new V3(cp.x, 0, cp.z));
        const distToCue = Math.hypot(player.x - worldCue.x, player.z - worldCue.z);

        // Si el avatar empuja hacia la entrada de la escalera cerca de su círculo indicador
        if (distToCue < 2.3 && (-u.sn * wx - u.cs * wz) / mag > -0.25) {
          const pts = NAV.ready ? navPath({ x: player.x, z: player.z, y: navY }, u.top) : stairUp(g, stairLocal(g, player.x, player.z));
          if (pts && pts.length) {
            startAuto(pts, { ride: true });
            break;
          }
        }
      }
    }
    if (auto) {
      const a = auto, ci = a.i, p = a.pts[ci], last = ci === a.pts.length - 1; let ddx = p.x - player.x, ddz = p.z - player.z; const d = Math.hypot(ddx, ddz); a.t += dt;
      if (d < (last ? .35 : .7)) { a.i++; if (a.i >= a.pts.length) { if (a.enter) pendEnter = { id: a.enter, t: .45 }; auto = null } }
      if (auto) {
        if (d > 1e-3) { ddx /= d; ddz /= d }
        if (!last && d < 1.3) { // a ≤1,3 m de la esquina: mezcla hacia el rumbo del siguiente tramo (giro suave, sin quiebre)
          const q = a.pts[ci + 1]; let nx = q.x - p.x, nz = q.z - p.z; const nl = Math.hypot(nx, nz);
          if (nl > 1e-3) { const w = (1 - d / 1.3) * .5; ddx += (nx / nl - ddx) * w; ddz += (nz / nl - ddz) * w; const l2 = Math.hypot(ddx, ddz) || 1; ddx /= l2; ddz /= l2 }
        }
        a.dx = ddx; a.dz = ddz;
        if (a.ride) { if (mag > .5 && (ddx * wx + ddz * wz) / mag < -.55) a.back += dt; else a.back = 0; if (a.back > .18) auto = null }   // empujar claramente hacia atrás cancela
        else if (a.t > .35 && mag > .3) auto = null;                                                                 // cualquier input nuevo cancela
        if (auto) { wx = ddx; wz = ddz; sp = (a.ride ? 6.6 : 7.2) * (last ? clamp(d / 1.6, .35, 1) : 1) }
      }
    }
    // Inercia fluida homogénea tanto en el atrio como en el preludio
    vel.x = damp(vel.x, wx * sp, 9, dt); vel.z = damp(vel.z, wz * sp, 9, dt);
    const before = player.clone(); let nx = player.x + vel.x * dt, nz = player.z + vel.z * dt;
    const curLimit = pre && S.room ? (rooms[S.room - 1]?.preludeR ?? PRELUDE.R) : (pre ? PRELUDE.R : 26);
    const rr = Math.hypot(nx, nz); if (rr > curLimit) { nx *= curLimit / rr; nz *= curLimit / rr }
    // colisión: barandas laterales cuando estás en altura en la escalera (>2m)
    const navOn = on && NAV.ready;
    if (navOn) { // colisión contra el modelo: subpasos de ≤0,15 m (no se atraviesan muros finos) + deslizamiento por las paredes
      const dx = nx - player.x, dz = nz - player.z, ns = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .15)), sx = dx / ns, sz = dz / ns; let px = player.x, pz = player.z, ph = navY, soft = navSoft(px, pz, ph);
      for (let k = 0; k < ns; k++) {
        let h = navFloor(px + sx, pz + sz, ph, soft);
        if (!isNaN(h)) { px += sx; pz += sz; ph = h; soft = navSoft(px, pz, ph); continue }
        const hx = navFloor(px + sx, pz, ph, soft), hz = navFloor(px, pz + sz, ph, soft);
        if (!isNaN(hx) && Math.abs(sx) > 1e-5) { px += sx; ph = hx; vel.z *= .2; soft = navSoft(px, pz, ph) } else if (!isNaN(hz) && Math.abs(sz) > 1e-5) { pz += sz; ph = hz; vel.x *= .2; soft = navSoft(px, pz, ph) } else { vel.x = vel.z = 0; break }
      }
      nx = px; nz = pz; setNavY(ph);
    }
    const sa = on ? surfaceAt : () => null, elevated = on && player.y > 2.0; let tgt = navOn ? null : sa(nx, nz, player.y);
    const allowed = t => t ? !t.blocked : !elevated;
    if (!navOn && !allowed(tgt)) {
      const tx = sa(nx, player.z, player.y), tz = sa(player.x, nz, player.y);
      if (allowed(tx)) { nz = player.z; tgt = tx; vel.z *= .2 } else if (allowed(tz)) { nx = player.x; tgt = tz; vel.x *= .2 } else { nx = player.x; nz = player.z; vel.x = vel.z = 0; tgt = sa(nx, nz, player.y) }
    }
    player.x = nx; player.z = nz; S.moved += Math.hypot(player.x - before.x, player.z - before.z);

    // Una sola fuente de verdad: en el atrio con NavMesh es navY; en el atrio sin NavMesh usa el estrado; en salas usa el suelo real del modelo
    let targetFloor;
    if (navOn) {
      const ry = navRampY(player.x, player.z, navY);
      targetFloor = isNaN(ry) ? navY : ry;
    } else if (on) {
      const floorHit = groundController.getHeight(player.x, player.z, player.y, true);
      const onDais = (player.x * player.x + player.z * player.z) < 27.5;
      targetFloor = Math.max(floorHit, onDais ? 2.42 : 1.10);
    } else {
      targetFloor = groundController.getHeight(player.x, player.z, player.y, false);
    }

    // FÍSICA DE RAMPA CONTINUA: cualquier escalón o relieve se sube deslizándose con suavidad
    if (player.y < targetFloor) {
      const diff = targetFloor - player.y;
      const climb = 14.0 * dt; // Ascenso suave a 14 m/s (evita golpes secos de cámara)
      if (diff <= climb) {
        player.y = targetFloor;
      } else {
        player.y += climb;
      }
      velY = 0;
      isGrounded = true;
    } else if (player.y > targetFloor) {
      velY -= GRAVITY * dt;
      player.y += velY * dt;
      if (player.y <= targetFloor) {
        player.y = targetFloor;
        velY = 0;
        isGrounded = true;
      } else {
        isGrounded = false;
      }
    } else {
      velY = 0;
      isGrounded = true;
    }

    // Altura visual: la cámara y el avatar siguen la rampa sin hundir los pies (≤14 cm)
    if (Math.abs(viewY - player.y) > 1.8) viewY = camY = player.y;
    viewY = (isGrounded || (velY <= 0 && player.y - targetFloor < .4))
      ? clamp(damp(viewY, player.y, 20, dt), player.y - .14, player.y + .14)
      : player.y;
    // Cámara vertical suave en el preludio igual que en el atrio
    camY = damp(camY, viewY, (on || pre) ? 6.0 : 12, dt);
    if (Math.abs(camY - viewY) > 2.6) camY = viewY;
    if (navOn) { const wantMove = mag > .3 || auto; navStuck = wantMove && Math.hypot(player.x - before.x, player.z - before.z) < .004 ? navStuck + dt : 0; if (navStuck > 1.6) { navStuck = 0; const nn = navNode(player.x, player.z, navY); if (nn >= 0) { const cc = (nn / NAV.K) | 0; player.x = navCX(cc); player.z = navCZ(cc); setNavY(NAV.H[nn]); player.y = navY; vel.set(0, 0, 0); stopAuto() } } }
    lightingManager.update(player, dt, on);
    if (auto) { const mv = Math.hypot(player.x - before.x, player.z - before.z) / dt; auto.stuck = mv < 0.08 ? auto.stuck + dt : 0; if (auto.stuck > 1.5) auto = null }
    const speed = Math.hypot(vel.x, vel.z); if (speed > .4) heading = Math.atan2(vel.x, vel.z);
    // Orientación del avatar suave y cámara en tercera persona sincronizada a 2.1
    avatarObj.rotation.y = lerpAngle(avatarObj.rotation.y, heading, 1 - Math.exp(-12 * dt));
    if (rig.hold > 0) rig.hold -= dt; else if (speed > .8) { const w = auto ? .9 : clamp(Math.max(0, mi.iy) * .9 + Math.abs(mi.ix) * .5, 0, 1); rig.yaw = lerpAngle(rig.yaw, heading, 1 - Math.exp(-2.1 * w * dt)) }
    else if (on && S.nearby && !lookHold) { const gq = gateWorld(stairGroups[S.nearby - 1]); rig.yaw = lerpAngle(rig.yaw, Math.atan2(gq.x - player.x, gq.z - player.z), 1 - Math.exp(-1.3 * dt)) }
    if (rig.hold <= 0) rig.pitch = damp(rig.pitch, -.12, 3, dt);
    stepPh += speed * dt * .28; if (Math.floor(stepPh * 2) !== Math.floor((stepPh - speed * dt * .28) * 2) && speed > 1.5 && A.ctx) tone(70 + Math.random() * 20, .06, 'triangle', .04, 0, A.master);
    avatarObj.position.set(player.x, viewY, player.z); animAvatar(avatarObj, speed, T);
    camera.fov = damp(camera.fov, 62 + (sprint && speed > 6 ? 7 : 0), 6, dt); camera.updateProjectionMatrix(); updateCam();
    S.nearby = on ? nearestPortal() : 0;
    if (pendEnter) { pendEnter.t -= dt; if (mag > .3 || auto || !on) pendEnter = null; else if (pendEnter.t <= 0) { const id = pendEnter.id; pendEnter = null; if (S.nearby === id) _enterRoom(id) } }
  } else if (S.phase === 'intro') { rig.yaw += dt * .12; viewY = camY = player.y; updateCam(); avatarObj.position.copy(player); animAvatar(avatarObj, 0, T); lightingManager.update(player, dt, false); }
  const tid = nextRoomId(), comp = $('compass');
  if (on && tid && !S.nearby && stairGroups.length) {
    const g = stairGroups[tid - 1];
    // La brújula y la línea de puntos guían exactamente hacia el círculo en el suelo
    const cp = g.userData.cue ? g.userData.cue.position : new V3(0, 0, .9);
    const base = g.localToWorld(new V3(cp.x, 0, cp.z));
    const dx = base.x - player.x, dz = base.z - player.z, dist = Math.hypot(dx, dz);
    const onGround = NAV.ready ? player.y < Math.max(NAV.yg, NAV.info?.daisY ?? 0) + 1.2 : player.y < 1.3, show = onGround && dist > 3;
    // Guía de luz: sigue la ruta real (no atraviesa muros) y se refresca solo si te mueves o cambia el objetivo
    if (show) {
      guideT -= dt; guideHidden = false;
      if (guideFor !== tid || !guideRoute || (guideT <= 0 && Math.hypot(player.x - guideFrom.x, player.z - guideFrom.z) > 1)) refreshGuide(g, tid);
      buildGuidePts();
    } else { guideRoute = null; guideFor = 0 }
    for (let i = 0; i < GN; i++) {
      const f = ((i / GN) + T * .3) % 1, s = show ? Math.sin(f * Math.PI) * (.8 + .4 * Math.sin(T * 5 + i)) : 0; let px = player.x + dx * f, pz = player.z + dz * f, py = player.y + .16;
      if (gpn > 1 && guideLen > .5) { const d = f * guideLen; let k = 1; while (k < gpn - 1 && gcum[k] < d) k++; const t = clamp((d - gcum[k - 1]) / Math.max(1e-6, gcum[k] - gcum[k - 1]), 0, 1); px = lerp(gpx[k - 1], gpx[k], t); pz = lerp(gpz[k - 1], gpz[k], t); py = lerp(gpy[k - 1], gpy[k], t) + .16 }
      dummy.position.set(px, py, pz); dummy.scale.setScalar(s); dummy.updateMatrix(); guide.setMatrixAt(i, dummy.matrix)
    } guide.instanceMatrix.needsUpdate = true;
    const q = gateWorld(g), v = q.clone().project(camera), behind = v.z > 1; let sx = v.x, sy = v.y; if (behind) { sx = -sx; sy = -sy }
    const onScr = !behind && Math.abs(sx) < .84 && Math.abs(sy) < .74; if (!onScr) { const m = Math.max(Math.abs(sx) / .84, Math.abs(sy) / .74) || 1; sx /= m; sy /= m }
    const px = (sx * .5 + .5) * W, py = (-sy * .5 + .5) * H; comp.style.display = 'block'; comp.style.transform = `translate(${px}px,${py}px)`;
    DOM.arrow.style.display = onScr ? 'none' : 'block'; DOM.arrow.style.transform = `rotate(${Math.atan2(py - H / 2, px - W / 2) + Math.PI / 2}rad) translateY(-38px)`;
    setTxt(DOM.lbl, `${rooms[tid - 1].note} · ${Math.round(Math.hypot(q.x - player.x, q.z - player.z))} m`); DOM.mk.style.display = onScr ? 'block' : 'none'
  }
  else { guideRoute = null; guideFor = 0; comp.style.display = 'none'; gpn = 0; if (!guideHidden) { guideHidden = true; for (let i = 0; i < GN; i++) { dummy.scale.setScalar(0); dummy.updateMatrix(); guide.setMatrixAt(i, dummy.matrix) } guide.instanceMatrix.needsUpdate = true } }
  const pr = $('prompt');
  if (on && S.nearby) { const r = rooms[S.nearby - 1]; const m = `Entrar · ${r.title}${TOUCH ? '' : ' <kbd>E</kbd>'}`; if (pr.dataset.m !== m) { pr.dataset.m = m; pr.innerHTML = m } pr.classList.add('show'); if (updateAtrium.near !== S.nearby) { tone(880, .3, 'sine', .04, 0, A.master); tone(1318, .35, 'sine', .03, .08, A.master) } updateAtrium.near = S.nearby } else { pr.classList.remove('show'); updateAtrium.near = 0 }
  const bw = $('btnWalk'), showW = on && tid && S.nearby !== tid && !auto; bw.classList.toggle('show', !!showW);
  const bl = $('btnLook'), wl = TOUCH && (on || pre) ? 'block' : 'none'; if (bl.style.display !== wl) bl.style.display = wl;
  clickMark.visible = (on || pre) && !!(auto && auto.mark); if (clickMark.visible) { clickMark.position.set(auto.mark.x, auto.mark.y, auto.mark.z); clickMark.scale.setScalar(1 + .16 * Math.sin(T * 6)) }
  hoverTick(on && !auto, dt);
  const co = $('coach'); let msg = '';
  if (on && !S.completed.size && !S.nearby) { const done = [() => S.moved > 4, () => player.y > (NAV.ready ? NAV.yg + 1.8 : 1.5)], txt = [TOUCH ? 'Toca el suelo para caminar, o usa el círculo' : 'Haz clic en el suelo para caminar · o usa <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', 'Sigue el hilo de luz hasta la escalera que late. Si te pierdes: «Ir a la siguiente sala»']; while (S.coach < 2 && done[S.coach]()) S.coach++; if (S.coach < 2) msg = txt[S.coach] }
  if (msg) { if (co.dataset.m !== msg) { co.innerHTML = msg; co.dataset.m = msg } co.classList.add('show') } else { co.classList.remove('show'); co.dataset.m = '' }
}

/* ======================================================================
   PICKING DEL ATRIO + MARCA DE DESTINO
   ====================================================================== */
const rcA = new THREE.Raycaster(); rcA.far = 120;
const ndc = new THREE.Vector2();
function pickAtrium(cx, cy) {
  ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); rcA.setFromCamera(ndc, camera);
  if (NAV.ready) { // picking contra el NavMesh: sin raycast de mallas (rápido y no atraviesa geometría invisible)
    const h = navPick(rcA.ray.origin, rcA.ray.direction); if (!h) return null;
    const hi = h.y > NAV.yg + .5;
    for (const g of stairGroups) { const l = stairLocal(g, h.x, h.z); if (Math.abs(l.x) < 2.5 && l.z <= 1.2 && l.z >= -((g.userData.len || 6.8) + 1.2) && (hi || l.z > -.5)) return { g } }
    return h
  }
  const atriumFBXObj = getAtriumFBXObj();
  const targets = [atriumFloor, ...stairGroups];
  //if (atriumFBXObj) targets.push(atriumFBXObj);
  for (const h of rcA.intersectObjects(targets, true)) {
    let o = h.object; while (o && !stairGroups.includes(o) && o !== atriumFBXObj) o = o.parent;
    if (o && stairGroups.includes(o)) return { g: o };
    if (o === atriumFBXObj) {
      for (const g of stairGroups) {
        const l = stairLocal(g, h.point.x, h.point.z);
        if (Math.abs(l.x) < 2.5 && l.z <= 1.2 && l.z >= -((g.userData.len || 6.8) + 1.2)) return { g };
      }
      return { x: h.point.x, y: h.point.y, z: h.point.z };
    }
    if (h.object === atriumFloor) return { x: h.point.x, y: NAV.ready ? NAV.yg : undefined, z: h.point.z };
  }
  return null;
}
let roomFloor = null;
export function setRoomFloor(f) { roomFloor = f }
export function clickToGo(cx, cy) {
  if (S.phase === 'prelude') {
    ndc.set(cx / W * 2 - 1, -(cy / H) * 2 + 1); rcA.setFromCamera(ndc, camera);
    const hits = rcA.intersectObjects([roomFloor, roomGroup], true);
    const valid = hits.find(h => h.object.isMesh && h.object.visible);
    if (valid) {
      const curLimit = S.room ? (rooms[S.room - 1]?.preludeR ?? PRELUDE.R) : PRELUDE.R;
      const pt = valid.point, r = Math.hypot(pt.x, pt.z), k = r > curLimit ? curLimit / r : 1, x = pt.x * k, z = pt.z * k;
      startAuto([{ x, z }], { mark: { x, y: pt.y + .08, z } });
    }
    return;
  }
  const d = pickAtrium(cx, cy); if (!d) return; if (!walkTo(d)) toast('No puedo llegar ahí · prueba otro punto')
}
const hoverMark = new THREE.Mesh(new THREE.RingGeometry(.3, .4, 32), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide })); hoverMark.rotation.x = -Math.PI / 2; hoverMark.visible = false; scene.add(hoverMark);
const clickMark = new THREE.Mesh(new THREE.RingGeometry(.38, .52, 36), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .95, depthWrite: false, depthTest: false, side: THREE.DoubleSide })); clickMark.rotation.x = -Math.PI / 2; clickMark.renderOrder = 6; clickMark.visible = false; scene.add(clickMark);
let hoverT = 0;
export function hoverTick(act, dt) { // anillo guía bajo el mouse (solo escritorio)
  if (!act || TOUCH || ptr.type !== 'mouse' || ptr.ui) { hoverMark.visible = false; if (document.body.style.cursor) document.body.style.cursor = ''; return }
  hoverT -= dt; if (hoverT > 0) return; hoverT = .12; const d = pickAtrium(ptr.x, ptr.y);
  if (d && !d.g && (NAV.ready || !groundBlocked(d.x, d.z))) { hoverMark.visible = true; hoverMark.position.set(d.x, (d.y ?? 0) + .08, d.z) } else hoverMark.visible = false;
  const c = d && (d.g || NAV.ready || !groundBlocked(d.x, d.z)) ? 'pointer' : ''; if (document.body.style.cursor !== c) document.body.style.cursor = c
}

/* ---------------- cámara de sala ---------------- */
export const camCur = new V3(0, 2.3, 8.6), camLook = new V3(0, 1.7, 0);
export function roomCamera(dt, cur) {
  let tp = cur.camPos || new V3(0, 2.3, 8.6), tl = cur.camLook || new V3(0, 1.7, 0);
  if (cur.cam) { const c = cur.cam(); tp = c.pos; tl = c.look }
  const px = (ptr.x / W - .5), py = (ptr.y / H - .5), par = cur.noParallax || TOUCH ? 0 : 1;
  camCur.x = damp(camCur.x, tp.x + px * .6 * par, cur.cam ? 5 : 3, dt); camCur.y = damp(camCur.y, tp.y - py * .3 * par, cur.cam ? 5 : 3, dt); camCur.z = damp(camCur.z, tp.z, cur.cam ? 5 : 3, dt); camLook.lerp(tl, 1 - Math.exp(-6 * dt));
  camera.position.copy(camCur); const sh = getShake(); if (sh > .05) { camera.position.x += (Math.random() - .5) * sh * .03; camera.position.y += (Math.random() - .5) * sh * .03 } camera.lookAt(camLook); camera.updateMatrixWorld()
}

/* ---------------- colocación del jugador ---------------- */
export function placePlayerAtSpawn(yaw = Math.PI) {
  placeAtSpawn(); vel.set(0, 0, 0); rig.yaw = yaw; rig.pitch = -.12; heading = yaw;
  viewY = camY = player.y; updateCam()
}
export function resetPlayerForPrelude(start = PRELUDE.start) {
  const s = start || PRELUDE.start;
  const sy = s.y ?? 2.42;
  player.set(s.x, sy, s.z); vel.set(0, 0, 0); velY = 0; isGrounded = true;
  const yaw = s.yaw ?? Math.PI;
  rig.yaw = yaw; rig.pitch = -.12; heading = yaw; viewY = camY = sy;
  stopAuto(); updateCam()
}
export function placePlayerAtAtrium() {
  stopAuto(); placeAtSpawn(); vel.set(0, 0, 0);
  const t = nextRoomId(); let yaw = Math.PI;
  if (t) { const g = stairGroups[t - 1]; if (g) { const b = g.localToWorld(new V3(0, 0, .9)); yaw = Math.atan2(b.x, b.z) } }
  rig.yaw = yaw; rig.pitch = -.12; heading = yaw; viewY = camY = player.y; updateCam()
}

/* Reexport útil para Main/debug sin repetir imports del NavMesh. */
export { NAV, SPAWN, navY, setNavY, placeAtSpawn };
