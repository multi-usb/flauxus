/* ======================================================================
   FLAUXUS — ui/prelude.js
   Preludio de cada sala: el usuario camina mientras escucha a María Clara.
   Al final del texto se arma el círculo de luz y empieza el Momento.
   ====================================================================== */
import * as THREE from 'three';
import { S } from '../core/state.js';
import { PRELUDE } from '../core/config.js';
import { $, TOUCH, LIME, PALE, lerp } from '../core/util.js';
import { T } from '../core/time.js';
import { TRIG_LABEL, ROOMS } from '../Rooms.js';
import { roomGroup } from '../engine/renderer.js';
import { avatarObj } from '../engine/avatar.js';
import { glowSprite, makeTextSprite, clearGroup } from '../engine/materials.js';
import { A } from '../AudioSystem.js';
import { player, stopAuto, updateCam, resetPlayerForPrelude } from '../player.js';
import { voRun, voStop, VO } from './voice.js';
import { fade } from './hud.js';
import { toast } from './toast.js';

export const PRE = { grp: null, home: null, ring: null, halo: null, beam: null, dots: [] };
export function preBuild(id) {
  const r = ROOMS[id - 1];
  const floorY = r?.start?.y ?? 0;
  const g = new THREE.Group();
  g.position.set(0, floorY, 0);
  roomGroup.add(g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PRELUDE.trigR, .07, 10, 72), new THREE.MeshBasicMaterial({ color: PALE, transparent: true, opacity: .9 })); ring.rotation.x = Math.PI / 2; ring.position.y = .06; g.add(ring);
  const halo = glowSprite(LIME, PRELUDE.trigR * 3.4, .12); halo.position.y = .3; g.add(halo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.5, .5, 12, 16, 1, true), new THREE.MeshBasicMaterial({ color: LIME, transparent: true, opacity: .04, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); beam.position.y = 6; g.add(beam);
  const lab = makeTextSprite(TRIG_LABEL[id], '#efeadb', 6.2, 34, true); lab.position.set(0, 3.9, 0); g.add(lab);
  const dots = []; for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(.1, 8, 6), new THREE.MeshBasicMaterial({ color: LIME })); m.scale.setScalar(0); g.add(m); dots.push(m) }
  Object.assign(PRE, { grp: g, ring, halo, beam, dots })
}
export function initPrelude(id) {
  const r = ROOMS[id - 1];
  const floorY = r?.start?.y ?? 0;
  PRE.home = new THREE.Vector3(0, floorY, 0);
  preBuild(id);
  resetPlayerForPrelude(r?.start);
  avatarObj.position.copy(player); avatarObj.rotation.y = r?.start?.yaw ?? Math.PI;
  stopAuto(); A.ambient?.set(.35, .8); updateCam(); voRun(id)
}
export function updatePrelude(dt) {
  if (!PRE.grp) return; const id = S.room, r = ROOMS[id - 1], floorY = r?.start?.y ?? 0, d = Math.hypot(player.x, player.z), near = d < PRELUDE.trigR, armed = VO.armed;
  PRE.ring.material.color.setHex(armed ? LIME : PALE); PRE.ring.scale.setScalar(1 + .04 * Math.sin(T * 3)); PRE.halo.material.opacity = armed ? .4 + .2 * Math.sin(T * 3) : .12; PRE.beam.material.opacity = armed ? .12 + .04 * Math.sin(T * 3) : .04;
  const sx = r?.start?.x ?? PRELUDE.start.x, sz = r?.start?.z ?? PRELUDE.start.z;
  PRE.dots.forEach((m, i) => { const f = ((i / PRE.dots.length) + T * .3) % 1, sc = armed && d > PRELUDE.trigR + 1.5 ? Math.sin(f * Math.PI) : 0; m.position.set(lerp(sx, 0, f) * .9, floorY + .16, lerp(sz, 0, f) * .9); m.scale.setScalar(sc) });
  const pr = $('prompt'); if (armed && near) { const m = `${TRIG_LABEL[id]}${TOUCH ? '' : ' <kbd>E</kbd>'}`; if (pr.dataset.m !== m) { pr.dataset.m = m; pr.innerHTML = m } pr.classList.add('show') } else pr.classList.remove('show');
  const co = $('coach'); let msg = ''; if (!VO.active && !near) msg = TOUCH ? 'Camina hasta el círculo de luz · toca el suelo o usa el círculo' : 'Camina hasta el círculo de luz · clic en el suelo o <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>';
  if (msg) { if (co.dataset.m !== msg) { co.innerHTML = msg; co.dataset.m = msg } co.classList.add('show') } else { co.classList.remove('show'); co.dataset.m = '' }
}
export function enterZone() {
  if (S.phase !== 'prelude' || S.busy) return;
  if (!VO.armed) { toast('Escucha hasta el final, o pulsa «Saltar locución»'); return }
  if (Math.hypot(player.x, player.z) >= PRELUDE.trigR) { toast('Acércate al círculo de luz'); return }
  S.busy = true; voStop(); stopAuto(); fade(() => {
    if (PRE.grp) { clearGroup(PRE.grp); roomGroup.remove(PRE.grp) } PRE.grp = null; $('prompt').classList.remove('show'); $('coach').classList.remove('show');
    avatarObj.position.copy(PRE.home); avatarObj.rotation.y = 0; S.phase = 'brief'; $('brief').classList.add('show'); A.ambient?.set(0, .4); S.busy = false
  })
}
